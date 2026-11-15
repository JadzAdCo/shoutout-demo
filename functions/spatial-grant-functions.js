/* Spatial Studio grant references — Functions-write. Production Firestore rules
   are not changed in this pass (default-deny). Files stay on FloqMedia. */
"use strict";

const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const oidc = require("./floqr-oidc-core");
const core = require("./spatial-grant-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const CALL_OPTS = { region: "us-central1", cors: true, timeoutSeconds: 30, memory: "256MiB" };
const HTTP_OPTS = { region: "us-central1", cors: false, timeoutSeconds: 30, memory: "256MiB" };
const COLLECTION = "spatialGrantRefs";

function jwtSecret() {
  return String(process.env.FLOQR_OIDC_JWT_SECRET || "").trim();
}

function requireAuth(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in with your FloqR account.");
  return auth.uid;
}

function fail(reason) {
  throw new HttpsError("failed-precondition", reason || "grant_rejected");
}

async function writeGrant(grant) {
  if (core.containsSecrets(grant)) fail("tokens_forbidden");
  await db.collection(COLLECTION).doc(grant.grantId).set(grant);
  return grant;
}

exports.recordSpatialGrantRef = onCall(CALL_OPTS, async (request) => {
  const uid = requireAuth(request.auth);
  const built = core.buildGrantRef({ ...(request.data || {}), ownerFloqrSubject: uid }, {});
  if (!built.ok) fail(built.reason);
  return { grant: await writeGrant(built.grant) };
});

exports.listMySpatialGrants = onCall(CALL_OPTS, async (request) => {
  const uid = requireAuth(request.auth);
  const snap = await db.collection(COLLECTION).where("ownerFloqrSubject", "==", uid).limit(50).get();
  return { grants: snap.docs.map((doc) => doc.data()) };
});

exports.revokeSpatialGrantRef = onCall(CALL_OPTS, async (request) => {
  const uid = requireAuth(request.auth);
  const grantId = core.text(request.data?.grantId, 80);
  if (!grantId) fail("grant_id_required");
  const snap = await db.collection(COLLECTION).doc(grantId).get();
  if (!snap.exists) fail("missing");
  const grant = snap.data();
  if (grant.ownerFloqrSubject !== uid) {
    throw new HttpsError("permission-denied", "not_owner");
  }
  const revoked = core.revokeGrant(grant, {});
  await writeGrant(revoked);
  return { grant: revoked, cacheInvalidated: true };
});

exports.attachGuestDraftToSubject = onCall(CALL_OPTS, async (request) => {
  const uid = requireAuth(request.auth);
  const grantId = core.text(request.data?.grantId, 80);
  if (!grantId) fail("grant_id_required");
  const snap = await db.collection(COLLECTION).doc(grantId).get();
  if (!snap.exists) fail("missing");
  const attached = core.attachGuestDraft(snap.data(), {
    ownerFloqrSubject: uid,
    confirmed: request.data?.confirmed === true
  });
  if (!attached.ok) fail(attached.reason);
  await writeGrant(attached.grant);
  return { grant: attached.grant };
});

function applyCors(req, res) {
  const origin = oidc.corsOrigin(req.get("origin") || "", {
    allowLocalhost: process.env.FLOQR_OIDC_ALLOW_LOCALHOST === "1"
  });
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return origin;
}

exports.floqrSpatialGrant = onRequest(HTTP_OPTS, async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "invalid_request" });
    return;
  }
  const header = String(req.get("authorization") || "");
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const verified = oidc.verifyJwt(token, jwtSecret(), { issuer: oidc.DEFAULT_ISSUER });
  if (!verified.ok) {
    res.status(401).json({ error: "invalid_token", reason: verified.reason });
    return;
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const built = core.buildGrantRef({ ...body, ownerFloqrSubject: verified.payload.sub }, {});
  if (!built.ok) {
    res.status(400).json({ error: built.reason });
    return;
  }
  await writeGrant(built.grant);
  res.status(200).json({ grant: built.grant });
});
