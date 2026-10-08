/* Staff marketing media consent — append-only evidence log + server-stamped user record.
   Design notes: .cursor/rules/design-notes-staff-marketing-consent.mdc */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const core = require("./staff-marketing-consent-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;

const CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};

function requestContext(request) {
  const headers = request.rawRequest?.headers || {};
  return {
    ip: String(headers["x-forwarded-for"] || "").split(",")[0].trim() || String(request.rawRequest?.ip || ""),
    userAgent: String(headers["user-agent"] || "")
  };
}

exports.recordStaffMarketingConsent = onCall(CALL_OPTS, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const parsed = core.normalizeInput(request.data || {});
  if (!parsed.ok) throw new HttpsError("invalid-argument", parsed.error);
  const uid = request.auth.uid;
  const nowMs = Date.now();
  const throttleRef = db.collection(core.COLLECTIONS.throttle).doc(uid);
  const allowed = await db.runTransaction(async tx => {
    const snap = await tx.get(throttleRef);
    const step = core.throttleStep(snap.exists ? snap.data() || {} : {}, nowMs);
    if (step.allowed) tx.set(throttleRef, step.next);
    return step.allowed;
  });
  if (!allowed) throw new HttpsError("resource-exhausted", "Too many consent changes. Try again in a few minutes.");

  const {ip, userAgent} = requestContext(request);
  const logRef = db.collection(core.COLLECTIONS.logs).doc();
  const batch = db.batch();
  batch.set(logRef, {
    ...core.logRecord({uid, email: request.auth.token?.email || "", value: parsed.value, nowMs, ip, userAgent}),
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(db.collection("users").doc(uid), {
    marketingMediaConsent: core.userConsentPatch(parsed.value, nowMs, logRef.id),
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});
  try {
    await batch.commit();
  } catch (error) {
    console.error("recordStaffMarketingConsent write failed", {uid, action: parsed.value.action, code: error?.code});
    throw new HttpsError("internal", "Your consent could not be saved. Try again.");
  }
  return {ok: true, action: parsed.value.action, version: core.VERSION, logId: logRef.id};
});
