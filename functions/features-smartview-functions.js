"use strict";
/* Features SMARTview editorial approval. Git catalog.json is the Pages source of truth.
   Firestore holds reviewer stamps only. No deploy until Don asks. */

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");
const core = require("./features-smartview-core");
const catalog = require("./features-smartview/catalog.json");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;

const CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};
const REASON_MIN = 8;
const COLLECTIONS = {
  approvals: "featuresSmartviewApprovals",
  drafts: "featuresSmartviewDrafts",
  audit: "featuresSmartviewAuditLogs"
};

function text(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 200);
}

function deny(code, message) {
  throw new HttpsError(code, message);
}

function publicCatalog(access) {
  return core.publicProjection(catalog, access || {role: "patron", canAccessKeys: {}});
}

exports.getFeaturesSmartViewCatalog = onCall(CALL_OPTS, async request => {
  if (!request.auth) deny("unauthenticated", "Sign in to read Features SMARTview.");
  const access = {
    role: "patron",
    canAccessKeys: {},
    isMasterAdmin: false
  };
  const projection = publicCatalog(access);
  const leaked = JSON.stringify(projection);
  if (/sk_live_|whsec_|PRIVATE KEY|ignore previous instructions/i.test(leaked)) {
    deny("internal", "Catalog projection failed a secret scan.");
  }
  if (/\.github\.com\/.*\/pull\//.test(leaked)) {
    deny("internal", "Public catalog must not include pull request URLs.");
  }
  return projection;
});

exports.approveFeaturesSmartViewCopy = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await audit.assertAdmin(request, "featuresmartview.approve");
  const reason = text(request.data?.reason, 500);
  if (reason.length < REASON_MIN) deny("invalid-argument", "A reason of at least 8 characters is required.");
  const featureId = text(request.data?.featureId, 80);
  const record = (catalog.features || []).find(row => row.id === featureId);
  if (!record) deny("not-found", "Unknown feature id.");
  const payload = core.sanitizeUntrustedText(request.data?.publicCopy || record.shortDescription, 800);
  if (core.isMaliciousPrContent(payload)) deny("invalid-argument", "Untrusted instructions cannot be published.");
  await db.collection(COLLECTIONS.approvals).doc(featureId).set({
    featureId,
    publicCopyApproved: true,
    publicCopy: payload,
    publicCopyReviewer: email,
    publicCopyApprovedAtMs: Date.now(),
    reason,
    sos2faSessionHash: sessionId || "",
    catalogVersion: record.catalogVersion || catalog.catalogVersion || 1,
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});
  await db.collection(COLLECTIONS.audit).add({
    eventType: "featuresmartview.approved",
    featureId,
    actorEmail: email,
    reason,
    createdAt: FieldValue.serverTimestamp()
  });
  return {ok: true, featureId, publishedToGit: false, note: "Approval stamped. Pages catalog updates only on git merge."};
});

exports.rollbackFeaturesSmartViewCopy = onCall(CALL_OPTS, async request => {
  const {email} = await audit.assertAdmin(request, "featuresmartview.rollback");
  const reason = text(request.data?.reason, 500);
  if (reason.length < REASON_MIN) deny("invalid-argument", "A reason of at least 8 characters is required.");
  const featureId = text(request.data?.featureId, 80);
  if (!featureId) deny("invalid-argument", "featureId is required.");
  await db.collection(COLLECTIONS.approvals).doc(featureId).set({
    publicCopyApproved: false,
    rolledBackAtMs: Date.now(),
    rolledBackBy: email,
    rollbackReason: reason,
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});
  await db.collection(COLLECTIONS.audit).add({
    eventType: "featuresmartview.rolled_back",
    featureId,
    actorEmail: email,
    reason,
    createdAt: FieldValue.serverTimestamp()
  });
  return {ok: true, featureId};
});

exports.__featuresSmartViewHelpers = {publicCatalog, COLLECTIONS};
