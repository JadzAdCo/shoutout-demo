/* Si-nema scene pins. Geometry stays on FloqMedia. 48h clock is FloqR-owned. */
"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { __featureServiceHelpers: featureAccess } = require("./feature-services-functions");
const grantCore = require("./spatial-grant-core");
const sceneCore = require("./sinema-scene-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const CALL_OPTS = { region: "us-central1", cors: true, timeoutSeconds: 30, memory: "256MiB" };
const GRANTS = "spatialGrantRefs";
const SCENES = "sinemaScenes";

function requireAuth(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in with your FloqR account.");
  return auth.uid;
}

async function requireSinema(auth, request) {
  const uid = requireAuth(auth);
  await featureAccess.assertFeatureAccess(auth, "sinema", request);
  return uid;
}

function fail(reason) {
  throw new HttpsError("failed-precondition", reason || "sinema_rejected");
}

async function loadGrant(grantId) {
  const id = grantCore.text(grantId, 80);
  if (!id) fail("grant_id_required");
  const snap = await db.collection(GRANTS).doc(id).get();
  if (!snap.exists) fail("missing");
  return snap.data();
}

exports.createSinemaScene = onCall(CALL_OPTS, async (request) => {
  const uid = await requireSinema(request.auth, request);
  const grant = await loadGrant(request.data?.grantId);
  if (grant.ownerFloqrSubject !== uid) throw new HttpsError("permission-denied", "not_owner");
  const created = sceneCore.createScene(grant, request.data || {}, {
    destinationTenantId: request.data?.destinationTenantId || grant.destinationTenantId
  });
  if (!created.ok) fail(created.reason);
  await db.collection(SCENES).doc(created.scene.sceneId).set(created.scene);
  return { scene: created.scene, virtualSet: created.scene.virtualSet };
});

exports.saveSinemaScene = onCall(CALL_OPTS, async (request) => {
  const uid = await requireSinema(request.auth, request);
  const sceneId = grantCore.text(request.data?.sceneId, 80);
  if (!sceneId) fail("scene_id_required");
  const snap = await db.collection(SCENES).doc(sceneId).get();
  if (!snap.exists) fail("missing_scene");
  const scene = snap.data();
  if (scene.ownerFloqrSubject !== uid) throw new HttpsError("permission-denied", "not_owner");
  const saved = sceneCore.saveScene(scene, request.data || {}, {
    exceptional: request.data?.exceptional || null
  });
  if (!saved.ok) fail(saved.reason);
  await db.collection(SCENES).doc(sceneId).set(saved.scene);
  return { scene: saved.scene, firstSave: saved.firstSave, exceptional: saved.exceptional };
});

exports.loadSinemaScene = onCall(CALL_OPTS, async (request) => {
  const uid = await requireSinema(request.auth, request);
  const sceneId = grantCore.text(request.data?.sceneId, 80);
  if (!sceneId) fail("scene_id_required");
  const snap = await db.collection(SCENES).doc(sceneId).get();
  if (!snap.exists) fail("missing_scene");
  const scene = snap.data();
  if (scene.ownerFloqrSubject !== uid) throw new HttpsError("permission-denied", "not_owner");
  const grant = await loadGrant(scene.grantId);
  const pin = sceneCore.resolvePinnedRevision(grant, request.data?.availableRevisionIds || []);
  return {
    scene,
    virtualSet: scene.virtualSet,
    pinRevisionId: pin.pinRevisionId,
    ignoredNewerRevisionIds: pin.ignoredNewerRevisionIds,
    usedLatest: false,
    geometryPreservation: sceneCore.GEOMETRY_PRESERVATION
  };
});
