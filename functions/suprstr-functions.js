/* SupRstR live stream — start/end session, consume slot (Master Admin v1). */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bands.don@gmail.com,bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function isMasterAdminAuth(authContext = {}) {
  const uid = authContext.uid || "";
  const email = text(authContext.token?.email, 200).toLowerCase();
  if (!uid) return false;
  return authContext.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email);
}

/**
 * Start a SupRstR live session for a venue display.
 * Consumes one slot from suprstrEntitlements/{uid}.
 * Writes suprstrSessions/{id} + suprstrLive/{locationId} pointer (display.html watches the pointer).
 */
exports.startSuprstrLive = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (!await isMasterAdminAuth(request.auth)) {
    throw new HttpsError("permission-denied", "SupRstR go-live is Master Admin only for now.");
  }
  const locationId = text(request.data?.locationId || request.data?.clubLocationId, 120);
  if (!locationId) throw new HttpsError("invalid-argument", "Choose a venue (locationId) like a ShoutOut.");
  const locationName = text(request.data?.locationName, 160);
  const uid = request.auth.uid;
  const email = text(request.auth.token?.email, 200).toLowerCase();
  const entitlementRef = db.collection("suprstrEntitlements").doc(uid);
  const sessionRef = db.collection("suprstrSessions").doc();
  const liveRef = db.collection("suprstrLive").doc(locationId);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async (tx) => {
    const entSnap = await tx.get(entitlementRef);
    const ent = entSnap.exists ? entSnap.data() || {} : {};
    const remaining = Math.max(0, Math.floor(Number(ent.slotsRemaining || 0)));
    if (remaining < 1) {
      throw new HttpsError("failed-precondition", "No SupRstR slots remaining. Purchase a $20 slot first.");
    }
    const liveSnap = await tx.get(liveRef);
    const existing = liveSnap.exists ? liveSnap.data() || {} : {};
    if (existing.status === "live" && existing.sessionId && existing.broadcasterUid !== uid) {
      throw new HttpsError("already-exists", "This venue already has an active SupRstR stream. End it first.");
    }

    tx.set(entitlementRef, {
      slotsRemaining: remaining - 1,
      slotsConsumed: Math.max(0, Math.floor(Number(ent.slotsConsumed || 0))) + 1,
      lastConsumedSessionId: sessionRef.id,
      lastConsumedAt: now,
      updatedAt: now
    }, {merge: true});

    tx.set(sessionRef, {
      sessionId: sessionRef.id,
      locationId,
      locationName: locationName || locationId,
      broadcasterUid: uid,
      broadcasterEmail: email,
      status: "waiting", // waiting → offering → connected → ended
      offer: null,
      answer: null,
      createdAt: now,
      updatedAt: now,
      slotConsumed: true
    });

    tx.set(liveRef, {
      locationId,
      locationName: locationName || locationId,
      sessionId: sessionRef.id,
      broadcasterUid: uid,
      status: "live",
      startedAt: now,
      updatedAt: now
    }, {merge: true});
  });

  return {
    sessionId: sessionRef.id,
    locationId,
    displayUrl: `./display.html?location=${encodeURIComponent(locationId)}&suprstr=1`,
    slotsRemainingHint: "refresh entitlement listener"
  };
});

/** End live session and clear venue pointer. Does not refund the slot. */
exports.endSuprstrLive = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (!await isMasterAdminAuth(request.auth)) {
    throw new HttpsError("permission-denied", "Master Admin required.");
  }
  const sessionId = text(request.data?.sessionId, 120);
  const locationId = text(request.data?.locationId, 120);
  if (!sessionId && !locationId) {
    throw new HttpsError("invalid-argument", "sessionId or locationId required.");
  }
  const now = admin.firestore.Timestamp.now();
  let sid = sessionId;
  let loc = locationId;
  if (!sid && loc) {
    const live = await db.collection("suprstrLive").doc(loc).get();
    sid = text(live.data()?.sessionId, 120);
  }
  if (sid) {
    const sess = await db.collection("suprstrSessions").doc(sid).get();
    if (sess.exists) {
      loc = loc || text(sess.data()?.locationId, 120);
      const owner = text(sess.data()?.broadcasterUid, 160);
      if (owner && owner !== request.auth.uid && !(await isMasterAdminAuth(request.auth))) {
        throw new HttpsError("permission-denied", "Only the broadcaster can end this session.");
      }
      await sess.ref.set({status: "ended", endedAt: now, updatedAt: now}, {merge: true});
    }
  }
  if (loc) {
    await db.collection("suprstrLive").doc(loc).set({
      status: "idle",
      sessionId: "",
      endedAt: now,
      updatedAt: now
    }, {merge: true});
  }
  return {ok: true, sessionId: sid || "", locationId: loc || ""};
});
