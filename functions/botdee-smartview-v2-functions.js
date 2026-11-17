/* People SmartView v2 callables + profile trigger + translation jobs.
   Gemini drafts/translates asynchronously — getPeopleSmartView never calls Gemini.
   No live Places/Yelp. No stored IP. */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentWritten, onDocumentCreated} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");
const {GoogleGenAI} = require("@google/genai");
const v2 = require("./botdee-smartview-v2-core");
const smart = require("./botdee-smartview-core");
const tools = require("./bot-dee-tools");
const people = require("./people-directory-core");
const geminiAccessLog = require("./gemini-api-access-log");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";

const CALL_OPTS = {
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "256MiB",
  invoker: "public",
  secrets: [GEMINI_API_KEY]
};

const TRIGGER_OPTS = {
  region: "us-central1",
  secrets: [GEMINI_API_KEY]
};

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  console.error("people SmartView callable failed", error?.message || error);
  return new HttpsError("internal", "SmartView could not complete that request. Try again.");
}

function geminiKey() {
  const fromEnv = String(process.env.GEMINI_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  try {
    return String(GEMINI_API_KEY.value() || "").trim();
  } catch (_) {
    return "";
  }
}

async function requireSignedIn(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to use SmartView.");
  return request.auth.uid;
}

async function requireBotDee(request) {
  const uid = await requireSignedIn(request);
  await audit.assertFeatureAccess(request.auth, "botDee", request);
  return uid;
}

function analysisRef(uid) {
  return db.collection(v2.COLLECTION).doc(String(uid));
}

function jobRef(id) {
  return db.collection(v2.JOBS_COLLECTION).doc(String(id));
}

async function isBlocked(a, b) {
  if (!a || !b || a === b) return false;
  const ids = [`${a}_${b}`, `${b}_${a}`];
  try {
    const snaps = await db.getAll(...ids.map(id => db.collection("userBlocks").doc(id)));
    return snaps.some(snap => {
      const data = snap.data() || {};
      return snap.exists && data.active !== false;
    });
  } catch (error) {
    console.warn("SmartView block lookup failed", error?.message || error);
    return false;
  }
}

function snapshotFromUser(data, volunteered) {
  return v2.publicFieldsSnapshot({
    displayName: data.displayName || data.publicName,
    publicName: data.publicName,
    floqrHandle: data.floqrHandle || data.username,
    instagramHandle: data.instagramHandle || data.instagram,
    xHandle: data.xHandle || data.twitter || data.x,
    photoURL: data.photoURL || data.publicPhotoUrl,
    preferredLanguage: data.preferredLanguage || data.uiLanguage,
    uiLanguage: data.uiLanguage,
    identityVerified: data.identityVerified,
    floqrVerified: data.floqrVerified
  }, volunteered);
}

async function writeJobs(jobs) {
  const chunks = [];
  for (let i = 0; i < jobs.length; i += 400) chunks.push(jobs.slice(i, i + 400));
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach(job => {
      batch.set(jobRef(job.id), {
        ...job,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
  }
}

async function writeDiagnostic(event) {
  try {
    await db.collection(v2.DIAGNOSTICS_COLLECTION).add({
      ...event,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    });
  } catch (error) {
    console.warn("SmartView diagnostic write failed", error?.message || error);
  }
}

async function generateWithGemini(prompt, {uid, operation}) {
  const apiKey = geminiKey();
  if (!apiKey) {
    return {ok: false, unconfigured: true, text: "", usage: v2.usageFromGemini({})};
  }
  const started = Date.now();
  try {
    const ai = new GoogleGenAI({apiKey});
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {temperature: 0.2}
    });
    const usage = v2.usageFromGemini(response);
    const text = String(response?.text || response?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "").trim();
    await geminiAccessLog.logGeminiApiAccess(db, {
      ok: true,
      operation,
      uid,
      model: TEXT_MODEL,
      details: {totalTokens: usage.totalTokens, costUnknown: usage.costUnknown}
    });
    await writeDiagnostic(v2.diagnosticEvent({
      kind: operation,
      uid,
      usage,
      latencyMs: Date.now() - started,
      jobStatus: "ready"
    }));
    return {ok: true, text, usage, model: TEXT_MODEL};
  } catch (error) {
    await geminiAccessLog.logGeminiApiAccess(db, {
      ok: false,
      operation,
      uid,
      model: TEXT_MODEL,
      failureReason: String(error?.message || error).slice(0, 180)
    });
    await writeDiagnostic(v2.diagnosticEvent({
      kind: operation,
      uid,
      usage: v2.usageFromGemini({}),
      latencyMs: Date.now() - started,
      error: String(error?.message || error).slice(0, 180),
      jobStatus: "failed"
    }));
    return {ok: false, text: "", usage: v2.usageFromGemini({}), error: String(error?.message || error).slice(0, 180)};
  }
}

async function persistAnalysis(uid, doc, jobs) {
  await analysisRef(uid).set({
    ...doc,
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: false});
  if (jobs && jobs.length) await writeJobs(jobs);
}

async function draftAnalysis(uid, snap, existing) {
  const now = Date.now();
  let doc = v2.emptyAnalysis(uid, snap, now);
  if (existing && existing.sourceAuthoredBy === "owner") {
    return {
      ...existing,
      publicFieldsHash: v2.publicFieldsHash(snap),
      conflictFlag: true,
      updatedAtMs: now
    };
  }
  const generated = await generateWithGemini(v2.geminiAnalysisPrompt(snap), {
    uid,
    operation: "smartview_analysis"
  });
  if (generated.ok && generated.text) {
    doc.sourceText = v2.text(generated.text, v2.SUMMARY_MAX);
    doc.sourceHash = v2.sha256(doc.sourceText);
    doc.geminiUsage = generated.usage;
    doc.provenance = {...doc.provenance, engine: "gemini", model: generated.model};
  }
  const jobs = v2.enqueueTranslationJobs({
    uid,
    revision: doc.revision,
    sourceHash: doc.sourceHash,
    sourceLocale: doc.sourceLocale,
    now
  });
  return {doc, jobs};
}

exports.getPeopleSmartView = onCall(CALL_OPTS, async request => {
  try {
    const viewerUid = await requireBotDee(request);
    const subjectUid = String(request.data?.subjectUid || viewerUid).trim();
    if (!subjectUid) throw new HttpsError("invalid-argument", "subjectUid required.");
    const blocked = await isBlocked(viewerUid, subjectUid);
    if (blocked) {
      return {ok: true, blocked: true, views: []};
    }
    const snapUser = await db.collection("users").doc(subjectUid).get();
    if (!snapUser.exists) throw new HttpsError("not-found", "Profile not found.");
    const data = snapUser.data() || {};
    const isOwner = viewerUid === subjectUid;
    const viewerMaySee = isOwner || people.isPublic(data);
    if (!viewerMaySee) {
      return {ok: true, views: [smart.patronSmartView({
        displayName: data.displayName,
        volunteered: tools.volunteeredPublicDatapoints(data),
        viewerMaySee: false
      })]};
    }
    const volunteered = tools.volunteeredPublicDatapoints(data);
    volunteered.uid = subjectUid;
    volunteered.viewerUid = viewerUid;
    volunteered.viewerLocale = v2.normalizeLocale(request.data?.uiLanguage || data.uiLanguage || "en");
    volunteered.handle = String(data.floqrHandle || data.username || "").replace(/^@+/, "");
    volunteered.instagram = data.instagramHandle || data.instagram;
    volunteered.xHandle = data.xHandle || data.twitter;
    volunteered.photoUrl = data.photoURL || data.publicPhotoUrl;
    volunteered.verified = data.identityVerified === 1 || data.floqrVerified === 1;
    volunteered.sourceLocale = v2.normalizeLocale(data.preferredLanguage || data.uiLanguage || "en");
    volunteered.bio = data.publicBio || data.bio || volunteered.bio;
    volunteered.minglHref = volunteered.handle
      ? `./?start=search&q=${encodeURIComponent("@" + volunteered.handle)}`
      : "./?start=search";
    const analysisSnap = await analysisRef(subjectUid).get();
    if (analysisSnap.exists) volunteered.analysis = analysisSnap.data();
    const view = smart.patronSmartView({
      displayName: data.displayName || data.publicName,
      volunteered,
      profileHref: isOwner ? "./patron-portal.html?tab=profile" : volunteered.minglHref,
      viewerMaySee: true
    });
    return {ok: true, views: [view], geminiOnView: false};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.saveSmartSummary = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const userSnap = await db.collection("users").doc(uid).get();
    const data = userSnap.data() || {};
    const locale = v2.normalizeLocale(data.preferredLanguage || data.uiLanguage || request.data?.locale || "en");
    const check = v2.validateOwnerEdit({
      text: request.data?.summary,
      locale,
      previous: null
    });
    if (!check.ok) throw new HttpsError("invalid-argument", `Invalid summary (${check.errors.join(",")}).`);
    const now = Date.now();
    const result = await db.runTransaction(async tx => {
      const ref = analysisRef(uid);
      const snap = await tx.get(ref);
      const prev = snap.exists ? snap.data() : v2.emptyAnalysis(uid, snapshotFromUser(data, tools.volunteeredPublicDatapoints(data)), now);
      const saved = v2.applyOwnerSave(prev, {
        summary: check.summary,
        sourceLocale: check.sourceLocale,
        editorUid: uid,
        now
      });
      tx.set(ref, {...saved, updatedAt: FieldValue.serverTimestamp()});
      return saved;
    });
    const jobs = v2.enqueueTranslationJobs({
      uid,
      revision: result.revision,
      sourceHash: result.sourceHash,
      sourceLocale: result.sourceLocale,
      now
    });
    await writeJobs(jobs);
    await writeDiagnostic(v2.diagnosticEvent({
      kind: "smartview_owner_save",
      uid,
      revision: result.revision,
      jobStatus: "queued"
    }));
    return {
      ok: true,
      revision: result.revision,
      sourceLocale: result.sourceLocale,
      queued: jobs.length,
      summary: result.sourceText
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.queuePeopleSmartViewAnalysis = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) throw new HttpsError("not-found", "Profile not found.");
    const data = userSnap.data() || {};
    const snap = snapshotFromUser(data, tools.volunteeredPublicDatapoints(data));
    const existing = (await analysisRef(uid).get()).data() || null;
    if (existing && !v2.shouldRegenerate(existing, snap) && !v2.shouldFlagConflict(existing, snap)) {
      return {ok: true, skipped: true, revision: existing.revision};
    }
    if (existing && v2.shouldFlagConflict(existing, snap)) {
      await analysisRef(uid).set({
        conflictFlag: true,
        publicFieldsHash: v2.publicFieldsHash(snap),
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }, {merge: true});
      return {ok: true, conflict: true, revision: existing.revision};
    }
    const drafted = await draftAnalysis(uid, snap, existing);
    await persistAnalysis(uid, drafted.doc, drafted.jobs);
    return {ok: true, revision: drafted.doc.revision, queued: (drafted.jobs || []).length};
  } catch (error) {
    throw asHttps(error);
  }
});

async function runTranslationJob(job) {
  const analysisSnap = await analysisRef(job.uid).get();
  if (!analysisSnap.exists) {
    await jobRef(job.id).set({status: "dead_letter", error: "missing_analysis", updatedAtMs: Date.now()}, {merge: true});
    return {ok: false, reason: "missing_analysis"};
  }
  const doc = analysisSnap.data();
  if (Number(job.revision) !== Number(doc.revision) || String(job.sourceHash) !== String(doc.sourceHash)) {
    await jobRef(job.id).set({status: "cancelled_stale", updatedAtMs: Date.now()}, {merge: true});
    return {ok: false, reason: "stale_revision"};
  }
  const generated = await generateWithGemini(
    v2.geminiTranslatePrompt(doc.sourceText, doc.sourceLocale, job.locale),
    {uid: job.uid, operation: "smartview_translate"}
  );
  if (!generated.ok) {
    if (generated.unconfigured) {
      const stub = v2.translateStub(doc.sourceText, doc.sourceLocale, job.locale);
      const applied = v2.applyTranslationResult(doc, job, {
        text: stub.text,
        engine: stub.engine,
        status: "failed",
        error: "translator_unconfigured"
      });
      await persistAnalysis(job.uid, applied.doc, []);
      await jobRef(job.id).set({
        status: "failed",
        error: "translator_unconfigured",
        updatedAtMs: Date.now()
      }, {merge: true});
      return {ok: false, reason: "unconfigured"};
    }
    const next = v2.retryOrDeadLetter(job, generated.error || "translate_failed");
    await jobRef(job.id).set({...next, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    if (next.status === "dead_letter") {
      const applied = v2.applyTranslationResult(doc, job, {status: "failed", error: next.error, engine: "gemini"});
      await persistAnalysis(job.uid, applied.doc, []);
    }
    return {ok: false, reason: next.status};
  }
  const applied = v2.applyTranslationResult(doc, job, {
    text: generated.text,
    engine: "gemini",
    model: generated.model,
    usage: generated.usage
  });
  if (!applied.applied) {
    await jobRef(job.id).set({status: "cancelled_stale", updatedAtMs: Date.now()}, {merge: true});
    return {ok: false, reason: applied.reason};
  }
  await persistAnalysis(job.uid, applied.doc, []);
  await jobRef(job.id).set({
    status: "done",
    engine: "gemini",
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});
  return {ok: true};
}

exports.processSmartViewTranslationJob = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const jobId = String(request.data?.jobId || "").trim();
    if (!jobId) throw new HttpsError("invalid-argument", "jobId required.");
    const snap = await jobRef(jobId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = snap.data();
    if (job.uid !== uid && !(await audit.viewerFor(request.auth)).isMasterAdmin) {
      throw new HttpsError("permission-denied", "Not your translation job.");
    }
    const result = await runTranslationJob({...job, id: snap.id});
    return {ok: true, ...result};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.onUserProfileSmartViewWrite = onDocumentWritten({
  document: "users/{uid}",
  ...TRIGGER_OPTS
}, async event => {
  const after = event.data?.after;
  if (!after?.exists) {
    const uid = event.params.uid;
    try {
      await analysisRef(uid).delete();
    } catch (_) { /* missing is fine */ }
    return;
  }
  const uid = event.params.uid;
  const data = after.data() || {};
  const volunteered = tools.volunteeredPublicDatapoints(data);
  const snap = snapshotFromUser(data, volunteered);
  const existingSnap = await analysisRef(uid).get();
  const existing = existingSnap.exists ? existingSnap.data() : null;
  if (!existing) {
    const drafted = await draftAnalysis(uid, snap, null);
    await persistAnalysis(uid, drafted.doc, drafted.jobs);
    return;
  }
  if (v2.shouldFlagConflict(existing, snap)) {
    await analysisRef(uid).set({
      conflictFlag: true,
      publicFieldsHash: v2.publicFieldsHash(snap),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
    return;
  }
  if (v2.shouldRegenerate(existing, snap)) {
    const drafted = await draftAnalysis(uid, snap, existing);
    await persistAnalysis(uid, drafted.doc, drafted.jobs);
  }
});

exports.onSmartViewTranslationJobCreated = onDocumentCreated({
  document: `${v2.JOBS_COLLECTION}/{jobId}`,
  ...TRIGGER_OPTS
}, async event => {
  const data = event.data?.data();
  if (!data || data.status !== "queued") return;
  await runTranslationJob({...data, id: event.params.jobId});
});
