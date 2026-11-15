/* BOT DEE six-phase callables — consent, export/delete, legal gates, later-fill slots, capability manifest.
   Auth + botDee gate. Master Admin SOS2FA for legal-gate and slot writes. No stored IP.
   getBotDeeProviderSlots / listBotDeeProviderSlots / setBotDeeProviderSlot stay mock-only (no live vendor HTTP). */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const bot = require("./bot-dee-core");
const threads = require("./bot-dee-thread");
const memory = require("./botdee-memory");
const research = require("./botdee-research");
const slots = require("./botdee-provider-slots");
const smart = require("./botdee-smartview-core");
const manifest = require("./botdee-upgrade-manifest");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");
const {assertSos2faSession} = require("./sos2fa-functions");
const {isServerAdminAuth} = require("./admin-trust");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;

const CALL_OPTS = {
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB",
  invoker: "public"
};
const REASON_MIN = 8;

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  console.error("BOT DEE upgrade callable failed", error?.message || error);
  return new HttpsError("internal", "BOT DEE could not complete that request. Try again.");
}

async function requireBotDee(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in to use BOT DEE.");
  }
  await audit.assertFeatureAccess(request.auth, "botDee", request);
  return request.auth.uid;
}

function threadRef(uid) {
  return db.collection("botDeeThreads").doc(uid);
}

function consentFromThread(data) {
  return memory.normalizeConsent(data && data.consent);
}

exports.getBotDeeCapabilityManifest = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    void uid;
    const role = isServerAdminAuth(request.auth) ? "master" : "patron";
    const described = manifest.describeForRole(role);
    return {
      ok: true,
      role,
      reply: described.reply,
      manifest: role === "master" ? described.manifest : {
        appLabel: manifest.packageLabel(),
        appVersion: manifest.packageVersion(),
        modelId: manifest.textModelId(),
        deployedClaim: false
      }
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.getBotDeeConsent = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const snap = await threadRef(uid).get();
    const data = snap.exists ? snap.data() : {};
    return {
      ok: true,
      consent: consentFromThread(data),
      hasUsedBotDee: memory.hasUsedFromThread(data)
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.setBotDeeConsent = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const next = memory.normalizeConsent({
      archive: request.data?.archive,
      memory: request.data?.memory,
      personalization: request.data?.personalization,
      publicProfileEnrichment: 0,
      updatedAtMs: Date.now()
    });
    next.updatedAtMs = Date.now();
    await threadRef(uid).set({
      uid,
      threadId: uid,
      consent: next,
      updatedAtMs: Date.now()
    }, {merge: true});
    if (next.archive === 0 || next.memory === 0) {
      const plan = memory.deletionPlan(next);
      const batch = db.batch();
      let writes = 0;
      if (plan.deleteArchive) {
        const archive = await threadRef(uid).collection("archive").limit(200).get();
        archive.docs.forEach(doc => {
          batch.delete(doc.ref);
          writes += 1;
        });
      }
      if (plan.deleteMemories) {
        const mems = await threadRef(uid).collection("memories").limit(50).get();
        mems.docs.forEach(doc => {
          batch.delete(doc.ref);
          writes += 1;
        });
      }
      if (writes) await batch.commit();
    }
    return {ok: true, consent: next};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.listBotDeeMemories = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const snap = await threadRef(uid).get();
    const consent = consentFromThread(snap.exists ? snap.data() : {});
    if (!memory.consentAllows(consent, "memory")) return {ok: true, memories: []};
    const rows = await threadRef(uid).collection("memories").limit(50).get();
    const items = rows.docs.map(doc => doc.data());
    return {ok: true, memories: memory.authorizedMemories(items, consent, Date.now())};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.upsertBotDeeMemory = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const snap = await threadRef(uid).get();
    const consent = consentFromThread(snap.exists ? snap.data() : {});
    if (!memory.consentAllows(consent, "memory")) {
      throw new HttpsError("failed-precondition", "Turn on BOT DEE memory to save facts.");
    }
    const row = memory.memoryRecord({
      memoryId: request.data?.memoryId,
      value: request.data?.value,
      explicitOrInferred: "explicit",
      approved: 1,
      purpose: request.data?.purpose,
      scope: "private",
      nowMs: Date.now()
    });
    if (!row.value) throw new HttpsError("invalid-argument", "Enter a memory value.");
    await threadRef(uid).collection("memories").doc(row.memoryId).set({...row, uid}, {merge: true});
    return {ok: true, memory: row};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.deleteBotDeeMemory = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const id = String(request.data?.memoryId || "").trim();
    if (!id) throw new HttpsError("invalid-argument", "memoryId required.");
    await threadRef(uid).collection("memories").doc(id).delete();
    return {ok: true};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.exportBotDeeData = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const snap = await threadRef(uid).get();
    const consent = consentFromThread(snap.exists ? snap.data() : {});
    const [archiveSnap, memSnap, researchSnap] = await Promise.all([
      threadRef(uid).collection("archive").limit(200).get(),
      threadRef(uid).collection("memories").limit(50).get(),
      threadRef(uid).collection("research").limit(50).get()
    ]);
    const payload = memory.exportPayload({
      uid,
      consent,
      archive: archiveSnap.docs.map(doc => doc.data()),
      memories: memSnap.docs.map(doc => doc.data()),
      research: researchSnap.docs.map(doc => doc.data())
    });
    return {ok: true, export: payload};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.deleteBotDeeArchive = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const confirm = String(request.data?.confirm || "").trim();
    if (confirm !== "DELETE") {
      throw new HttpsError("invalid-argument", "Type DELETE to confirm.");
    }
    const archive = await threadRef(uid).collection("archive").limit(200).get();
    const batch = db.batch();
    archive.docs.forEach(doc => batch.delete(doc.ref));
    if (!archive.empty) await batch.commit();
    return {ok: true, deleted: archive.size};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.listBotDeeSmartViews = onCall(CALL_OPTS, async request => {
  try {
    await requireBotDee(request);
    const kind = String(request.data?.kind || "").trim();
    const catalog = smart.mockCatalog();
    const views = kind ? catalog.filter(row => row.kind === kind) : catalog;
    return {
      ok: true,
      mock: true,
      cuisinePipeline: smart.cuisinePipelineMeta(),
      views
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.submitBotDeeEvidenceFeedback = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const row = research.feedbackRecord({
      uid,
      evidenceId: request.data?.evidenceId,
      vote: request.data?.vote,
      subjectUid: request.data?.subjectUid
    });
    if (!row.ok) throw new HttpsError("invalid-argument", row.error);
    await db.collection("botDeeFeedback").add({
      ...row,
      createdAt: FieldValue.serverTimestamp()
    });
    return row;
  } catch (error) {
    throw asHttps(error);
  }
});

exports.disputeBotDeeIdentityMatch = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireBotDee(request);
    const row = research.disputeRecord({
      uid,
      evidenceId: request.data?.evidenceId,
      reason: request.data?.reason
    });
    await db.collection("botDeeFeedback").add({
      ...row,
      type: "dispute",
      createdAt: FieldValue.serverTimestamp()
    });
    return row;
  } catch (error) {
    throw asHttps(error);
  }
});

exports.getBotDeeLegalGates = onCall(CALL_OPTS, async request => {
  try {
    await requireBotDee(request);
    const snap = await db.collection("botDeeLegalGates").get();
    const overrides = {};
    snap.docs.forEach(doc => {
      overrides[doc.id] = doc.data();
    });
    return {
      ok: true,
      prompt: research.MASTER_ADMIN_GATE_PROMPT,
      gates: research.gateMatrix(overrides)
    };
  } catch (error) {
    throw asHttps(error);
  }
});

async function runGetBotDeeProviderSlots(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in as Master Admin.");
  if (!isServerAdminAuth(request.auth)) {
    throw new HttpsError("permission-denied", "Master Admin only.");
  }
  const snap = await db.collection("botDeeProviderSlots").get();
  const overrides = {};
  snap.docs.forEach(doc => {
    overrides[doc.id] = {id: doc.id, ...doc.data()};
  });
  const matrix = slots.slotMatrix(overrides, process.env, Date.now()).map(slots.publicSlot);
  return {ok: true, slots: matrix};
}

exports.getBotDeeProviderSlots = onCall(CALL_OPTS, async request => {
  try {
    return await runGetBotDeeProviderSlots(request);
  } catch (error) {
    throw asHttps(error);
  }
});

/** Fresh Gen2 create so Master Admin can load slots: getBotDeeProviderSlots
 *  stayed IAM-private after a cancelled first create (GFE 403). */
exports.listBotDeeProviderSlots = onCall(CALL_OPTS, async request => {
  try {
    return await runGetBotDeeProviderSlots(request);
  } catch (error) {
    throw asHttps(error);
  }
});

exports.setBotDeeProviderSlot = onCall(CALL_OPTS, async request => {
  try {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in as Master Admin.");
    if (!isServerAdminAuth(request.auth)) {
      throw new HttpsError("permission-denied", "Master Admin only.");
    }
    const {email} = await assertSos2faSession(request);
    const reason = String(request.data?.reason || "").trim();
    if (reason.length < REASON_MIN) {
      throw new HttpsError("invalid-argument", `Enter a reason of at least ${REASON_MIN} characters.`);
    }
    const providerId = String(request.data?.providerId || "").trim();
    const sanitized = slots.sanitizeSlotWrite(request.data, providerId);
    if (!sanitized.ok) {
      const message = sanitized.error === "secret_value_rejected"
        ? "Do not paste API keys here. Store the secret with the accounts profile, then save the slot."
        : "Unknown provider slot.";
      throw new HttpsError("invalid-argument", message);
    }
    const now = Date.now();
    const row = {
      ...sanitized.row,
      updatedAtMs: now,
      updatedByEmail: email || request.auth.token?.email || "",
      lastChangeReason: reason.slice(0, 500)
    };
    await db.collection("botDeeProviderSlots").doc(providerId).set({
      ...row,
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
    const resolved = slots.publicSlot(slots.normalizeSlot(row, process.env, now));
    return {ok: true, slot: resolved};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.setBotDeeLegalGate = onCall(CALL_OPTS, async request => {
  try {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in as Master Admin.");
    if (!isServerAdminAuth(request.auth)) {
      throw new HttpsError("permission-denied", "Master Admin only.");
    }
    const {email} = await assertSos2faSession(request);
    const reason = String(request.data?.reason || "").trim();
    if (reason.length < REASON_MIN) {
      throw new HttpsError("invalid-argument", `Enter a reason of at least ${REASON_MIN} characters.`);
    }
    const providerId = research.canonicalProviderId(request.data?.providerId);
    const known = manifest.PROVIDER_GATES.some(row => row.id === providerId);
    if (!known) throw new HttpsError("invalid-argument", "Unknown provider.");
    const evidenceRecorded = request.data?.evidenceRecorded === true;
    const status = evidenceRecorded && request.data?.status === "approved" ? "approved" : "blocked";
    const now = Date.now();
    const row = research.normalizeGate({
      id: providerId,
      status,
      evidenceRecorded,
      updatedAtMs: now,
      updatedByEmail: email || request.auth.token?.email || "",
      lastChangeReason: reason.slice(0, 500)
    });
    await db.collection("botDeeLegalGates").doc(providerId).set({
      ...row,
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
    return {ok: true, gate: row};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.__botDeeUpgradeHelpers = {
  requireBotDee,
  consentFromThread,
  threadRef
};

void bot;
void threads;
