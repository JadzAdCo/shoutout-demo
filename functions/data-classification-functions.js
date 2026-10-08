/* Data classification register — Master Admin seed / edit / export log, SOS2FA-gated, on the shared audit chain.
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const core = require("./data-classification-core");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;

const CALL_OPTS = {region: "us-central1", timeoutSeconds: 60, memory: "256MiB"};

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  if (error?.code === "invalid-argument") return new HttpsError("invalid-argument", error.message);
  console.error("data classification request failed", error?.message || error);
  return new HttpsError("internal", "Data classification request failed. Try again.");
}

function ref(collection) {
  return db.collection(core.COLLECTION).doc(core.docIdFor(collection));
}

function stored(row, request, email, reason, nowMs) {
  const doc = {collection: row.collection, description: row.description, scope: row.scope, classificationLevel: core.deriveLevel(row)};
  core.FLAGS.forEach(key => { doc[key] = row[key] ? 1 : 0; });
  return {
    ...doc,
    retentionDays: row.retentionDays || 0,
    revision: row.revision,
    lastChangeReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: nowMs,
    updatedByUid: request.auth.uid,
    updatedByEmail: email
  };
}

function snapshot(row) {
  const out = {classificationLevel: core.deriveLevel(row), retentionDays: row.retentionDays || 0, revision: row.revision || 0};
  core.FLAGS.forEach(key => { out[key] = row[key] ? 1 : 0; });
  return out;
}

exports.seedDataClassification = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await audit.assertAdmin(request, "dataClass.seed");
  try {
    const nowMs = Date.now();
    const reason = "Initial seed from packaged classification catalog";
    const created = await db.runTransaction(async tx => {
      const snaps = await Promise.all(core.COLLECTIONS.map(collection => tx.get(ref(collection))));
      const head = await tx.get(audit.headRef());
      const missing = core.COLLECTIONS.filter((_, i) => !snaps[i].exists);
      if (!missing.length) return [];
      missing.forEach(collection => {
        const row = {...core.normalize(collection, null), revision: 1};
        tx.set(ref(collection), stored(row, request, email, reason, nowMs));
      });
      audit.appendChainedAudit(tx, head, audit.auditRecord(request, {
        eventType: "dataClass.seeded",
        target: {type: "dataClassification", id: core.COLLECTION},
        after: {count: missing.length, collections: missing.slice(0, 200)},
        reason,
        sessionId,
        nowMs
      }));
      return missing;
    });
    return {ok: true, created};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.setDataClassification = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await audit.assertAdmin(request, "dataClass.change");
  try {
    const {collection, next, reason} = core.validateChange(request.data || {});
    const nowMs = Date.now();
    return await db.runTransaction(async tx => {
      const docRef = ref(collection);
      const snap = await tx.get(docRef);
      const head = await tx.get(audit.headRef());
      const before = core.normalize(collection, snap.exists ? snap.data() : null);
      const after = core.normalize(collection, {...next, revision: before.revision + 1});
      const changed = core.diff(before, after);
      if (!changed.length) throw new HttpsError("failed-precondition", "Nothing changed — the collection already has those values.");
      tx.set(docRef, stored(after, request, email, reason, nowMs), {merge: true});
      const eventId = audit.appendChainedAudit(tx, head, audit.auditRecord(request, {
        eventType: "dataClass.changed",
        target: {type: "dataClassification", id: collection},
        before: snapshot(before),
        after: snapshot(after),
        detail: {changed},
        reason,
        sessionId,
        nowMs
      }));
      return {ok: true, eventId, row: snapshot(after), changed};
    });
  } catch (error) {
    throw asHttps(error);
  }
});

// ---- FloqAi enforcement: the caller's tier is resolved here, never taken from the request. ----

const FLOQAI_CONTENT = require("./floqai-content-classes.json");
const FLOQAI_JOB = "floqAiAccess";
const DENY_LOG_WINDOW_MS = 10 * 60 * 1000;
const DENY_LOG_MAX = 20;
const FLOQAI_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};

/** System reads are allowlisted per job (least privilege); systemJob throws for anything else. */
function systemCollection(collection) {
  core.systemJob(FLOQAI_JOB, collection);
  return db.collection(collection);
}

async function roleFactsFor(auth) {
  if (!auth?.uid) return {signedIn: false};
  const viewer = await audit.viewerFor(auth);
  if (viewer.isMasterAdmin) return {signedIn: true, isMasterAdmin: true};
  const uid = auth.uid;
  const email = String(auth.token?.email || "").trim().toLowerCase();
  const locations = systemCollection("clubLocations");
  const [byUid, byMasterUid, byEmail, assignments, designations] = await Promise.allSettled([
    locations.where("adminUids", "array-contains", uid).limit(40).get(),
    locations.where("masterAdminUids", "array-contains", uid).limit(40).get(),
    email ? locations.where("adminEmails", "array-contains", email).limit(40).get() : Promise.resolve({docs: []}),
    systemCollection("clubAdminAssignments").where("patronUid", "==", uid).limit(40).get(),
    systemCollection("clubEmployeeDesignations").where("workerUid", "==", uid).limit(60).get()
  ]);
  const docs = result => (result.status === "fulfilled" ? result.value.docs : []);
  const clubAdminClubIds = [
    ...[byUid, byMasterUid, byEmail].flatMap(docs).map(doc => doc.id),
    ...docs(assignments).map(doc => doc.data() || {})
      .filter(row => String(row.status || "").toLowerCase() === "active")
      .map(row => String(row.clubId || row.clubLocationId || ""))
  ].filter(Boolean);
  return {
    signedIn: true,
    isMasterAdmin: false,
    clubAdminClubIds,
    designations: docs(designations).map(doc => {
      const row = doc.data() || {};
      return {clubId: row.clubLocationId || row.clubId || "", status: row.status, rolePermissions: row.rolePermissions, roleElectionType: row.roleElectionType};
    })
  };
}

async function denialLogAllowed(throttleKey, nowMs) {
  const throttleRef = systemCollection("floqAiAccessThrottle").doc(throttleKey);
  return db.runTransaction(async tx => {
    const snap = await tx.get(throttleRef);
    const row = snap.exists ? snap.data() || {} : {};
    const fresh = nowMs - Number(row.windowStartMs || 0) > DENY_LOG_WINDOW_MS;
    const count = fresh ? 0 : Number(row.count || 0);
    if (count >= DENY_LOG_MAX) return false;
    tx.set(throttleRef, {windowStartMs: fresh ? nowMs : Number(row.windowStartMs), count: count + 1, updatedAtMs: nowMs});
    return true;
  });
}

function anonymousThrottleKey(request) {
  const ip = String(request.rawRequest?.headers?.["x-forwarded-for"] || request.rawRequest?.ip || "").split(",")[0].trim();
  return `anon_${require("crypto").createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 32)}`;
}

exports.getFloqAiAccess = onCall(FLOQAI_OPTS, async request => {
  const sourceIds = core.sanitizeSourceIds(request.data?.sourceIds);
  await audit.assertFeatureAccess(request.auth || null, "floqAi", request);
  try {
    const {role, clubIds} = core.resolveViewerRole(await roleFactsFor(request.auth));
    const {allowed, denied} = core.filterContent(sourceIds, FLOQAI_CONTENT, {role});
    const appCheck = request.app ? "verified" : "missing";
    console.info(JSON.stringify({event: "floqai.access", job: FLOQAI_JOB, purpose: core.SYSTEM_JOBS[FLOQAI_JOB].purpose, role, requested: sourceIds.length, denied: denied.length, appCheck}));
    const toLog = core.denialsToLog(denied);
    if (toLog.length) {
      const nowMs = Date.now();
      const key = request.auth?.uid || anonymousThrottleKey(request);
      if (await denialLogAllowed(key, nowMs)) {
        await audit.writeUnchainedAudit(audit.auditRecord(request, {
          role,
          eventType: "floqai.content_denied",
          outcome: "denied",
          target: {type: "floqAiContent", id: toLog[0].id},
          detail: {denied: toLog.slice(0, 20), deniedCount: toLog.length, requested: sourceIds.length, appCheck, surface: "server"},
          nowMs
        }));
      }
    }
    return {ok: true, role, clubCount: clubIds.length, allowed, denied: denied.map(row => row.id), appCheck};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.logDataClassificationExport = onCall(CALL_OPTS, async request => {
  const {sessionId} = await audit.assertAdmin(request, "dataClass.export");
  try {
    const format = request.data?.format === "json" ? "json" : "csv";
    const rows = Math.min(Math.max(Math.floor(Number(request.data?.rows) || 0), 0), 1000);
    const eventId = await audit.writeChainedAudit(audit.auditRecord(request, {
      eventType: "dataClass.exported",
      target: {type: "dataClassification", id: core.COLLECTION},
      detail: {format, rows},
      reason: "Register exported for review",
      sessionId,
      nowMs: Date.now()
    }));
    return {ok: true, eventId};
  } catch (error) {
    throw asHttps(error);
  }
});
