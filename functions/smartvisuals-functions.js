"use strict";
/* SMARTvisuals callables — classify authorized titles, SOS2FA publish/override.
   Visual classification never invokes headless tools or AdSense. No deploy until Don asks. */

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");
const resolver = require("./smartvisuals-resolver");
const {sanitizeSvg} = require("./smartvisuals-svg-sanitize");
const catalog = require("./smartvisuals/catalog.json");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;

const CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};
const REASON_MIN = 8;
const COLLECTIONS = {
  drafts: "smartVisualDrafts",
  overrides: "smartVisualOverrides",
  selections: "smartVisualSelections",
  adPolicy: "smartVisualAdPolicy",
  audit: "smartVisualAuditLogs"
};

function text(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 200);
}

function deny(code, message) {
  throw new HttpsError(code, message);
}

exports.classifySmartVisual = onCall(CALL_OPTS, async request => {
  if (!request.auth) deny("unauthenticated", "Sign in to classify SMARTvisuals.");
  const sourceKind = text(request.data?.sourceKind, 40) || "authorized-room";
  if (sourceKind === "private-chat" || sourceKind === "privateChat") {
    deny("permission-denied", "Private chat is not used for SMARTvisual classification.");
  }
  const title = text(request.data?.title, 400);
  const description = text(request.data?.description, 400);
  const contentHash = resolver.contentHash(title, description);
  const cached = await db.collection(COLLECTIONS.selections).doc(contentHash).get();
  if (cached.exists) {
    const row = cached.data() || {};
    return {...row, cacheHit: true, modelCalls: 0, geminiUsed: false};
  }
  const selection = resolver.resolve({title, description, sourceKind}, catalog);
  const stored = {
    ...selection,
    uid: request.auth.uid,
    createdAtMs: Date.now(),
    cacheHit: false
  };
  await db.collection(COLLECTIONS.selections).doc(contentHash).set({
    backgroundId: selection.backgroundId,
    stencilId: selection.stencilId,
    reasonCode: selection.reasonCode,
    registryRevision: selection.registryRevision,
    contentHash,
    category: selection.category,
    tags: selection.tags,
    modelCalls: 0,
    geminiUsed: false,
    createdAt: FieldValue.serverTimestamp()
  }, {merge: true});
  return stored;
});

exports.publishSmartVisualDraft = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await audit.assertAdmin(request, "smartvisual.publish");
  const reason = text(request.data?.reason, 500);
  if (reason.length < REASON_MIN) deny("invalid-argument", "A reason of at least 8 characters is required.");
  const name = text(request.data?.name, 80);
  const license = text(request.data?.license, 240);
  const svg = String(request.data?.svg || "");
  if (!name) deny("invalid-argument", "Name is required.");
  if (!license) deny("invalid-argument", "License / provenance is required.");
  const sanit = sanitizeSvg(svg);
  if (!sanit.ok) {
    await db.collection(COLLECTIONS.audit).add({
      eventType: "smartvisual.upload_denied",
      outcome: "denied",
      actorEmail: email,
      reasonCode: sanit.reason,
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp()
    });
    deny("invalid-argument", `SVG rejected (${sanit.reason}).`);
  }
  const id = text(request.data?.id, 80) || `draft_${Date.now()}`;
  const expectedRev = Number(request.data?.revision || 0);
  const ref = db.collection(COLLECTIONS.drafts).doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number((snap.data() || {}).revision || 0) : 0;
    if (snap.exists && current !== expectedRev) {
      deny("failed-precondition", "Revision conflict — reload and retry.");
    }
    tx.set(ref, {
      id,
      name,
      description: text(request.data?.description, 400),
      type: text(request.data?.type, 20) || "stencil",
      tags: Array.isArray(request.data?.tags) ? request.data.tags.map(v => text(v, 40)).slice(0, 12) : [],
      license,
      approvalStatus: "review",
      bytes: sanit.bytes,
      revision: current + 1,
      updatedByEmail: email,
      sos2faSessionId: sessionId,
      reason,
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
  });
  return {ok: true, id, status: "review"};
});

exports.setSmartVisualOverride = onCall(CALL_OPTS, async request => {
  const {email} = await audit.assertAdmin(request, "smartvisual.override");
  const reason = text(request.data?.reason, 500);
  if (reason.length < REASON_MIN) deny("invalid-argument", "A reason of at least 8 characters is required.");
  const backgroundId = text(request.data?.backgroundId, 80);
  const stencilId = text(request.data?.stencilId, 80);
  const roomKey = text(request.data?.roomKey, 80);
  if (!roomKey) deny("invalid-argument", "Room key is required.");
  const probe = resolver.resolve({
    title: "override",
    override: {backgroundId, stencilId, authorized: true}
  }, catalog);
  if (probe.overrideRejected) deny("failed-precondition", "Override asset is not an approved published SMARTvisual.");
  await db.collection(COLLECTIONS.overrides).doc(roomKey).set({
    backgroundId: probe.backgroundId,
    stencilId: probe.stencilId,
    reason,
    updatedByEmail: email,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: Date.now()
  });
  return {ok: true, backgroundId: probe.backgroundId, stencilId: probe.stencilId};
});

exports.getSmartVisualAdPolicy = onCall(CALL_OPTS, async request => {
  if (!request.auth) deny("unauthenticated", "Sign in required.");
  return {
    adsEnabled: false,
    adsenseApproved: false,
    placement: "below-room-smartview",
    note: "AdSense is not loaded. Placement stays empty until a separate policy review."
  };
});
