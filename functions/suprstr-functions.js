/* supRstar live stream — preview, pay, approve, then WebRTC to venue SupRStar board (display2). */
"use strict";

const crypto = require("crypto");
const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

const REQUEST_TTL_MS = 3 * 60 * 60 * 1000;

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function isMasterAdminAuth(authContext = {}) {
  const uid = authContext.uid || "";
  const email = text(authContext.token?.email, 200).toLowerCase();
  if (!uid) return false;
  return authContext.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email);
}

async function isClubManagerAuth(authContext, clubId) {
  if (!authContext?.uid || !clubId) return false;
  if (isMasterAdminAuth(authContext)) return true;
  const snap = await db.collection("clubLocations").doc(clubId).get();
  if (!snap.exists) return false;
  const row = snap.data() || {};
  const uid = authContext.uid;
  const email = text(authContext.token?.email, 200).toLowerCase();
  if (Array.isArray(row.adminUids) && row.adminUids.includes(uid)) return true;
  if (Array.isArray(row.masterAdminUids) && row.masterAdminUids.includes(uid)) return true;
  if (email && Array.isArray(row.adminEmails) && row.adminEmails.map(e => String(e).toLowerCase()).includes(email)) return true;
  const assign = await db.collection("clubAdminAssignments").doc(`${clubId}_${uid}`).get();
  return assign.exists && text(assign.data()?.status, 40) === "active";
}

function boardFromRaw(boardRaw = "") {
  const board = text(boardRaw, 40).toLowerCase();
  return (board === "secondary" || board === "2" || board === "display2" || board === "displays") ? "secondary" : "primary";
}

function liveDocId(locationId, displayBoard) {
  return displayBoard === "secondary" ? `${locationId}__secondary` : locationId;
}

async function assertSuprstarVenue(locationId) {
  const gateHelpers = require("./feature-gate-functions").__featureGateHelpers;
  await gateHelpers.assertClubFeature(locationId, "supRstar");
}

async function notifyClubSuprstarRequest(request = {}) {
  const locationId = text(request.locationId, 120);
  if (!locationId) return;
  const snap = await db.collection("clubLocations").doc(locationId).get();
  const loc = snap.exists ? snap.data() || {} : {};
  const adminUids = new Set([
    ...(Array.isArray(loc.adminUids) ? loc.adminUids : []),
    ...(Array.isArray(loc.masterAdminUids) ? loc.masterAdminUids : [])
  ]);
  const payload = {
    type: "suprstarPending",
    title: "supRstar awaiting approval",
    body: `${text(request.broadcasterEmail, 200) || "A patron"} paid for a supRstar live appearance at ${text(request.locationName, 160) || locationId}. Approve in Club Admin.`,
    clubLocationId: locationId,
    locationName: text(request.locationName, 160) || locationId,
    requestId: text(request.requestId, 120),
    referenceNumber: text(request.referenceNumber, 80),
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    link: `./admin.html?location=${encodeURIComponent(locationId)}&panel=suprstar`
  };
  const writes = [...adminUids].filter(Boolean).map(uid => db.collection("inboxNotifications").add({...payload, recipientUid: uid}));
  await Promise.all(writes);
}

/** Patron starts flow: pick venue → private preview page (camera only, not on venue board yet). */
exports.createSuprstarRequest = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const locationId = text(request.data?.locationId || request.data?.clubLocationId, 120);
  if (!locationId) throw new HttpsError("invalid-argument", "Choose a venue.");
  await assertSuprstarVenue(locationId);
  const locationName = text(request.data?.locationName, 160) || locationId;
  const displayBoard = boardFromRaw(request.data?.displayBoard || request.data?.board);
  const uid = request.auth.uid;
  const email = text(request.auth.token?.email, 200).toLowerCase();
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + REQUEST_TTL_MS);
  // Doc id IS the unguessable token — preview URL cannot be predicted from venue id.
  const accessToken = randomToken(32);
  const requestRef = db.collection("suprstarRequests").doc(accessToken);
  const referenceNumber = `SR${Date.now().toString(36).toUpperCase()}${accessToken.slice(0, 6).toUpperCase()}`;
  const doc = {
    requestId: requestRef.id,
    accessToken,
    referenceNumber,
    locationId,
    locationName,
    displayBoard,
    liveDocId: liveDocId(locationId, displayBoard),
    broadcasterUid: uid,
    broadcasterEmail: email,
    status: "preview",
    paymentStatus: "unpaid",
    serviceOrderId: "",
    sessionId: "",
    createdAt: now,
    updatedAt: now,
    expiresAt
  };
  await requestRef.set(doc);
  return {
    requestId: requestRef.id,
    accessToken,
    referenceNumber,
    previewPath: `./suprstar-preview.html?t=${encodeURIComponent(accessToken)}`
  };
});

/** Club admin approves paid request — patron preview page can then go live. */
exports.approveSuprstarRequest = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const requestId = text(request.data?.requestId, 120);
  if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");
  const ref = db.collection("suprstarRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "supRstar request not found.");
  const row = snap.data() || {};
  if (!(await isClubManagerAuth(request.auth, row.locationId))) {
    throw new HttpsError("permission-denied", "Club Admin access required.");
  }
  if (row.paymentStatus !== "paid") throw new HttpsError("failed-precondition", "Patron payment is not complete.");
  if (row.status !== "pending_approval") throw new HttpsError("failed-precondition", "Request is not awaiting approval.");
  const now = admin.firestore.Timestamp.now();
  await ref.set({
    status: "approved",
    approvedAt: now,
    approvedByUid: request.auth.uid,
    approvedByEmail: text(request.auth.token?.email, 200).toLowerCase(),
    updatedAt: now
  }, {merge: true});
  try {
    await db.collection("inboxNotifications").add({
      recipientUid: row.broadcasterUid,
      recipientEmail: row.broadcasterEmail || "",
      type: "suprstarApproved",
      title: "supRstar approved",
      body: `${row.locationName || row.locationId} approved your supRstar. Return to your preview tab to go live.`,
      clubLocationId: row.locationId,
      requestId,
      referenceNumber: row.referenceNumber || "",
      read: false,
      createdAt: now,
      link: `./suprstar-preview.html?t=${encodeURIComponent(row.accessToken || "")}`
    });
  } catch (_) {}
  return {ok: true, requestId, status: "approved"};
});

exports.rejectSuprstarRequest = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const requestId = text(request.data?.requestId, 120);
  const reason = text(request.data?.reason, 400);
  if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");
  const ref = db.collection("suprstarRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "supRstar request not found.");
  const row = snap.data() || {};
  if (!(await isClubManagerAuth(request.auth, row.locationId))) {
    throw new HttpsError("permission-denied", "Club Admin access required.");
  }
  if (!["pending_approval", "approved"].includes(row.status)) {
    throw new HttpsError("failed-precondition", "Request cannot be rejected in its current state.");
  }
  const now = admin.firestore.Timestamp.now();
  await ref.set({
    status: "rejected",
    rejectedAt: now,
    rejectedByUid: request.auth.uid,
    rejectionReason: reason || "Rejected by venue",
    updatedAt: now
  }, {merge: true});
  if (row.sessionId) {
    await db.collection("suprstrSessions").doc(row.sessionId).set({status: "ended", endedAt: now, updatedAt: now}, {merge: true});
    await db.collection("suprstrLive").doc(row.liveDocId || liveDocId(row.locationId, row.displayBoard)).set({
      status: "idle", sessionId: "", endedAt: now, updatedAt: now
    }, {merge: true});
  }
  try {
    await db.collection("inboxNotifications").add({
      recipientUid: row.broadcasterUid,
      recipientEmail: row.broadcasterEmail || "",
      type: "suprstarRejected",
      title: "supRstar not approved",
      body: reason || `${row.locationName || row.locationId} did not approve this supRstar request.`,
      clubLocationId: row.locationId,
      requestId,
      read: false,
      createdAt: now
    });
  } catch (_) {}
  return {ok: true, requestId, status: "rejected"};
});

/**
 * After approval: start WebRTC session and point venue SupRStar board at it.
 * Payment was collected at checkout — no prepaid slot wallet.
 */
exports.startSuprstrLive = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const requestId = text(request.data?.requestId, 120);
  if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");
  const reqRef = db.collection("suprstarRequests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "supRstar request not found.");
  const req = reqSnap.data() || {};
  if (req.broadcasterUid !== request.auth.uid && !isMasterAdminAuth(request.auth)) {
    throw new HttpsError("permission-denied", "Only the patron who submitted this supRstar can go live.");
  }
  if (req.paymentStatus !== "paid") throw new HttpsError("failed-precondition", "Payment is required before going live.");
  if (req.status !== "approved") throw new HttpsError("failed-precondition", "Venue approval is required before going live.");
  const locationId = text(req.locationId, 120);
  const displayBoard = boardFromRaw(req.displayBoard);
  const liveId = liveDocId(locationId, displayBoard);
  const uid = request.auth.uid;
  const email = text(request.auth.token?.email, 200).toLowerCase();
  const sessionRef = db.collection("suprstrSessions").doc();
  const liveRef = db.collection("suprstrLive").doc(liveId);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(reqRef);
    const row = fresh.exists ? fresh.data() || {} : {};
    if (row.status !== "approved" || row.paymentStatus !== "paid") {
      throw new HttpsError("failed-precondition", "Request is not ready to go live.");
    }
    const liveSnap = await tx.get(liveRef);
    const existing = liveSnap.exists ? liveSnap.data() || {} : {};
    if (existing.status === "live" && existing.sessionId && existing.broadcasterUid !== uid) {
      throw new HttpsError("already-exists", "This venue board already has an active supRstar stream.");
    }
    tx.set(sessionRef, {
      sessionId: sessionRef.id,
      requestId,
      locationId,
      locationName: text(row.locationName, 160) || locationId,
      displayBoard,
      liveDocId: liveId,
      broadcasterUid: uid,
      broadcasterEmail: email,
      status: "waiting",
      offer: null,
      answer: null,
      createdAt: now,
      updatedAt: now
    });
    tx.set(liveRef, {
      locationId,
      locationName: text(row.locationName, 160) || locationId,
      displayBoard,
      liveDocId: liveId,
      sessionId: sessionRef.id,
      requestId,
      broadcasterUid: uid,
      status: "live",
      startedAt: now,
      updatedAt: now
    }, {merge: true});
    tx.set(reqRef, {
      status: "live",
      sessionId: sessionRef.id,
      liveStartedAt: now,
      updatedAt: now
    }, {merge: true});
  });

  return {
    sessionId: sessionRef.id,
    requestId,
    locationId,
    displayBoard,
    displayPage: displayBoard === "secondary" ? "display2.html" : "display.html"
  };
});

/** End live session and clear venue pointer. */
exports.endSuprstrLive = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const sessionId = text(request.data?.sessionId, 120);
  const requestId = text(request.data?.requestId, 120);
  const locationId = text(request.data?.locationId, 120);
  const displayBoard = boardFromRaw(request.data?.displayBoard || request.data?.board);
  const now = admin.firestore.Timestamp.now();
  let sid = sessionId;
  let loc = locationId;
  let board = displayBoard;
  let rid = requestId;

  if (!sid && rid) {
    const req = await db.collection("suprstarRequests").doc(rid).get();
    if (req.exists) {
      sid = text(req.data()?.sessionId, 120);
      loc = loc || text(req.data()?.locationId, 120);
      board = boardFromRaw(req.data()?.displayBoard || board);
    }
  }
  if (!sid && loc) {
    const live = await db.collection("suprstrLive").doc(liveDocId(loc, board)).get();
    sid = text(live.data()?.sessionId, 120);
    rid = rid || text(live.data()?.requestId, 120);
  }
  if (sid) {
    const sess = await db.collection("suprstrSessions").doc(sid).get();
    if (sess.exists) {
      const owner = text(sess.data()?.broadcasterUid, 160);
      if (owner && owner !== request.auth.uid && !isMasterAdminAuth(request.auth)) {
        throw new HttpsError("permission-denied", "Only the broadcaster can end this session.");
      }
      loc = loc || text(sess.data()?.locationId, 120);
      board = boardFromRaw(sess.data()?.displayBoard || board);
      rid = rid || text(sess.data()?.requestId, 120);
      await sess.ref.set({status: "ended", endedAt: now, updatedAt: now}, {merge: true});
    }
  }
  if (loc) {
    await db.collection("suprstrLive").doc(liveDocId(loc, board)).set({
      status: "idle",
      sessionId: "",
      endedAt: now,
      updatedAt: now
    }, {merge: true});
  }
  if (rid) {
    await db.collection("suprstarRequests").doc(rid).set({
      status: "ended",
      endedAt: now,
      updatedAt: now
    }, {merge: true});
  }
  return {ok: true, sessionId: sid || "", requestId: rid || "", locationId: loc || ""};
});

/** Called from commerce fulfillment after Stripe payment. */
exports.markSuprstarRequestPaid = async function markSuprstarRequestPaid({requestId, orderId, paidAt, amountCents = 2000}) {
  const ref = db.collection("suprstarRequests").doc(text(requestId, 120));
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`supRstar request ${requestId} not found for fulfillment.`);
  const row = snap.data() || {};
  if (row.paymentStatus === "paid" && row.serviceOrderId === orderId) return row;
  const now = paidAt || admin.firestore.Timestamp.now();
  const payload = {
    paymentStatus: "paid",
    status: "pending_approval",
    serviceOrderId: text(orderId, 160),
    paidAt: now,
    amountCents: Math.max(0, Math.round(Number(amountCents || 2000))),
    updatedAt: now
  };
  await ref.set(payload, {merge: true});
  await notifyClubSuprstarRequest({...row, ...payload, requestId: ref.id});
  return {...row, ...payload, requestId: ref.id};
};
