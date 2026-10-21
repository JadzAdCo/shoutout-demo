/* floqCast live stream — preview, pay, approve, then WebRTC to venue floqCast board (display2). */
"use strict";

const crypto = require("crypto");
const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const {isServerAdminAuth} = require("./admin-trust");
const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

const REQUEST_TTL_MS = 3 * 60 * 60 * 1000;
const ICE_CACHE_DOC = "systemConfig/floqcastIceServers";
const ICE_CACHE_TTL_MS = 50 * 60 * 1000;

function secretOrEnv(secret, envName) {
  // Gen2 binds secrets as process.env[KEY] — prefer that (defineSecret.value() can
  // disagree with Secret Manager in some revisions and yield Twilio 401).
  const fromEnv = String(process.env[envName] || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const value = secret?.value?.();
    if (value) return String(value).trim();
  } catch (_) { /* secret not bound in this invoke */ }
  return "";
}

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function isMasterAdminAuth(authContext = {}) {
  if (!authContext.uid) return false;
  return isServerAdminAuth(authContext);
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

/**
 * floqCast is display2-only at every venue. Ignore client board hints that
 * would land on Display 1 (`display.html`) — live pointer is always
 * `{locationId}__secondary` and the answering player is display2.html.
 */
function boardFromRaw(_boardRaw = "") {
  return "secondary";
}

function liveDocId(locationId, _displayBoard) {
  return `${text(locationId, 120)}__secondary`;
}

function displayPageForBoard(_displayBoard) {
  return "display2.html";
}

async function assertFloqCastVenue(locationId) {
  const gateHelpers = require("./feature-gate-functions").__featureGateHelpers;
  await gateHelpers.assertClubFeature(locationId, "floqCast");
}

async function notifyClubFloqCastRequest(request = {}) {
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
    title: "floqCast awaiting approval",
    body: `${text(request.broadcasterEmail, 200) || "A patron"} paid for a floqCast live appearance at ${text(request.locationName, 160) || locationId}. Approve in Club Admin.`,
    clubLocationId: locationId,
    locationName: text(request.locationName, 160) || locationId,
    requestId: text(request.requestId, 120),
    referenceNumber: text(request.referenceNumber, 80),
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    link: `./admin.html?location=${encodeURIComponent(locationId)}&panel=floqcast`
  };
  const writes = [...adminUids].filter(Boolean).map(uid => db.collection("inboxNotifications").add({...payload, recipientUid: uid}));
  await Promise.all(writes);
}

/** Patron starts flow: pick venue → private preview page (camera only, not on venue board yet). */
exports.createFloqCastRequest = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const locationId = text(request.data?.locationId || request.data?.clubLocationId, 120);
  if (!locationId) throw new HttpsError("invalid-argument", "Choose a venue.");
  await assertFloqCastVenue(locationId);
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
    previewPath: `./floqcast-preview.html?t=${encodeURIComponent(accessToken)}`
  };
});

/** Club admin approves paid request — patron preview page can then go live. */
exports.approveFloqCastRequest = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const requestId = text(request.data?.requestId, 120);
  if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");
  const ref = db.collection("suprstarRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "floqCast request not found.");
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
      title: "floqCast approved",
      body: `${row.locationName || row.locationId} approved your floqCast. Keep your preview tab open — live starts after a 10-second countdown.`,
      clubLocationId: row.locationId,
      requestId,
      referenceNumber: row.referenceNumber || "",
      read: false,
      createdAt: now,
      link: `./floqcast-preview.html?t=${encodeURIComponent(row.accessToken || "")}`
    });
  } catch (_) {}
  return {ok: true, requestId, status: "approved"};
});

exports.rejectFloqCastRequest = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const requestId = text(request.data?.requestId, 120);
  const reason = text(request.data?.reason, 400);
  if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");
  const ref = db.collection("suprstarRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "floqCast request not found.");
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
      title: "floqCast not approved",
      body: reason || `${row.locationName || row.locationId} did not approve this floqCast request.`,
      clubLocationId: row.locationId,
      requestId,
      read: false,
      createdAt: now
    });
  } catch (_) {}
  return {ok: true, requestId, status: "rejected"};
});

/**
 * After approval: start WebRTC session and point venue floqCast board at it.
 * Payment was collected at checkout — no prepaid slot wallet.
 */
exports.startFloqCastLive = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const requestId = text(request.data?.requestId, 120);
  if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");
  const reqRef = db.collection("suprstarRequests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "floqCast request not found.");
  const req = reqSnap.data() || {};
  if (req.broadcasterUid !== request.auth.uid && !isMasterAdminAuth(request.auth)) {
    throw new HttpsError("permission-denied", "Only the patron who submitted this floqCast can go live.");
  }
  if (req.paymentStatus !== "paid") throw new HttpsError("failed-precondition", "Payment is required before going live.");
  const uid = request.auth.uid;
  // Idempotent: overlapping go-live calls must not fail+tear-down an active session.
  if (req.status === "live" && text(req.sessionId, 120) && (req.broadcasterUid === uid || isMasterAdminAuth(request.auth))) {
    const duration = [15, 30, 45, 60, 90].includes(Number(req.liveDurationSeconds)) ? Number(req.liveDurationSeconds) : 90;
    return {
      sessionId: text(req.sessionId, 120),
      requestId,
      locationId: text(req.locationId, 120),
      displayBoard: "secondary",
      liveDurationSeconds: duration,
      liveEndsAtMs: Number(req.liveEndsAtMs) || 0,
      resumed: true,
      displayPage: displayPageForBoard()
    };
  }
  if (req.status !== "approved") throw new HttpsError("failed-precondition", "Venue approval is required before going live.");
  const locationId = text(req.locationId, 120);
  const displayBoard = boardFromRaw(req.displayBoard);
  const liveId = liveDocId(locationId, displayBoard);
  const email = text(request.auth.token?.email, 200).toLowerCase();
  const sessionRef = db.collection("suprstrSessions").doc();
  const liveRef = db.collection("suprstrLive").doc(liveId);
  const now = admin.firestore.Timestamp.now();
  const ALLOWED_LIVE_SECONDS = [15, 30, 45, 60, 90];
  let liveDurationSeconds = 90;
  try {
    const clubSnap = await db.collection("clubLocations").doc(locationId).get();
    const fromClub = Number(clubSnap.exists ? clubSnap.data()?.suprstarLiveDurationSeconds : 90);
    const fromClient = Number(request.data?.liveDurationSeconds);
    const preferred = ALLOWED_LIVE_SECONDS.includes(fromClub) ? fromClub
      : (ALLOWED_LIVE_SECONDS.includes(fromClient) ? fromClient : 90);
    liveDurationSeconds = preferred;
  } catch (_) {
    liveDurationSeconds = 90;
  }
  // Duration clock arms when the patron WebRTC link is connected — not at approval / start call.
  const liveEndsAtMs = 0;

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(reqRef);
    const row = fresh.exists ? fresh.data() || {} : {};
    if (row.status === "live" && text(row.sessionId, 120) && row.broadcasterUid === uid) {
      return;
    }
    if (row.status !== "approved" || row.paymentStatus !== "paid") {
      throw new HttpsError("failed-precondition", "Request is not ready to go live.");
    }
    const liveSnap = await tx.get(liveRef);
    const existing = liveSnap.exists ? liveSnap.data() || {} : {};
    if (existing.status === "live" && existing.sessionId && existing.broadcasterUid !== uid) {
      throw new HttpsError("already-exists", "This venue board already has an active floqCast stream.");
    }
    tx.set(sessionRef, {
      sessionId: sessionRef.id,
      requestId,
      locationId,
      locationName: text(row.locationName, 160) || locationId,
      displayBoard,
      liveDocId: liveId,
      broadcasterUid: uid,
      status: "waiting",
      liveDurationSeconds,
      liveEndsAtMs,
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
      liveDurationSeconds,
      liveEndsAtMs,
      startedAt: now,
      updatedAt: now
    }, {merge: true});
    tx.set(reqRef, {
      status: "live",
      sessionId: sessionRef.id,
      liveStartedAt: now,
      liveDurationSeconds,
      liveEndsAtMs,
      updatedAt: now
    }, {merge: true});
  });

  const after = await reqRef.get();
  const afterRow = after.exists ? after.data() || {} : {};
  const sid = text(afterRow.sessionId, 120) || sessionRef.id;
  const durationOut = ALLOWED_LIVE_SECONDS.includes(Number(afterRow.liveDurationSeconds))
    ? Number(afterRow.liveDurationSeconds)
    : liveDurationSeconds;

  return {
    sessionId: sid,
    requestId,
    locationId,
    displayBoard: "secondary",
    liveDurationSeconds: durationOut,
    liveEndsAtMs: Number(afterRow.liveEndsAtMs) || 0,
    displayPage: displayPageForBoard()
  };
});

/**
 * Arm the venue live duration clock once WebRTC is connected (not at approval / countdown).
 */
exports.armFloqCastLiveDuration = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const requestId = text(request.data?.requestId, 120);
  const sessionId = text(request.data?.sessionId, 120);
  if (!requestId) throw new HttpsError("invalid-argument", "requestId required.");
  const reqRef = db.collection("suprstarRequests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "floqCast request not found.");
  const req = reqSnap.data() || {};
  if (req.broadcasterUid !== request.auth.uid && !isMasterAdminAuth(request.auth)) {
    throw new HttpsError("permission-denied", "Only the broadcaster can arm the live timer.");
  }
  if (req.status !== "live") throw new HttpsError("failed-precondition", "Live session is not active.");
  const sid = sessionId || text(req.sessionId, 120);
  const ALLOWED_LIVE_SECONDS = [15, 30, 45, 60, 90];
  const liveDurationSeconds = ALLOWED_LIVE_SECONDS.includes(Number(req.liveDurationSeconds))
    ? Number(req.liveDurationSeconds)
    : 90;
  const existingEnds = Number(req.liveEndsAtMs) || 0;
  if (existingEnds > Date.now() + 2000) {
    return {
      ok: true,
      liveDurationSeconds,
      liveEndsAtMs: existingEnds,
      armedAtMs: Number(req.liveArmedAtMs) || 0,
      alreadyArmed: true
    };
  }
  const liveEndsAtMs = Date.now() + (liveDurationSeconds * 1000);
  const now = admin.firestore.Timestamp.now();
  const armedAtMs = Date.now();
  const locationId = text(req.locationId, 120);
  const displayBoard = boardFromRaw(req.displayBoard);
  const armSource = text(request.data?.armSource, 80) || "client";
  await reqRef.set({
    liveEndsAtMs,
    liveDurationSeconds,
    liveArmedAtMs: armedAtMs,
    liveArmSource: armSource,
    updatedAt: now
  }, {merge: true});
  if (sid) {
    await db.collection("suprstrSessions").doc(sid).set({
      liveEndsAtMs, liveDurationSeconds, liveArmedAtMs: armedAtMs, updatedAt: now
    }, {merge: true});
  }
  if (locationId) {
    await db.collection("suprstrLive").doc(liveDocId(locationId, displayBoard)).set({
      liveEndsAtMs, liveDurationSeconds, liveArmedAtMs: armedAtMs, updatedAt: now
    }, {merge: true});
  }
  return {ok: true, liveDurationSeconds, liveEndsAtMs, armedAtMs, alreadyArmed: false};
});

/** End live session and clear venue pointer. */
exports.endFloqCastLive = onCall({region: "us-central1"}, async (request) => {
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

/**
 * FLOQR-owned TURN for floqCast WebRTC (phone ↔ display2).
 * Prefer explicit FLOQR_TURN_* secrets; else Twilio Network Traversal tokens.
 * Public callable — display boards have no patron session.
 */
exports.getFloqCastIceServers = onCall({
  region: "us-central1",
  secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN],
  timeoutSeconds: 15,
  memory: "256MiB"
}, async () => {
  const stun = [
    {urls: "stun:stun.l.google.com:19302"},
    {urls: "stun:stun1.l.google.com:19302"}
  ];

  /** Optional Metered / coturn override via Functions env (not public OpenRelay). */
  const turnUrls = String(process.env.FLOQR_TURN_URLS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const turnUser = String(process.env.FLOQR_TURN_USERNAME || "");
  const turnCred = String(process.env.FLOQR_TURN_CREDENTIAL || "");
  if (turnUrls.length && turnUser && turnCred) {
    return {
      iceServers: [...stun, {urls: turnUrls, username: turnUser, credential: turnCred}],
      source: "floqr-turn",
      ttlMs: ICE_CACHE_TTL_MS
    };
  }

  try {
    const cached = await db.doc(ICE_CACHE_DOC).get();
    if (cached.exists) {
      const row = cached.data() || {};
      const until = Number(row.expiresAtMs || 0);
      if (until > Date.now() + 30_000 && Array.isArray(row.iceServers) && row.iceServers.length) {
        return {
          iceServers: row.iceServers,
          source: "twilio-cache",
          ttlMs: Math.max(60_000, until - Date.now())
        };
      }
    }
  } catch (err) {
    console.warn("getFloqCastIceServers cache read failed", String(err?.message || err).slice(0, 160));
  }

  const accountSid = secretOrEnv(TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID");
  const authToken = secretOrEnv(TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken || !/^AC[0-9a-fA-F]{32}$/.test(accountSid)) {
    console.warn("getFloqCastIceServers: Twilio secrets missing/invalid — STUN only", {
      sidLen: accountSid.length,
      sidPrefix: accountSid.slice(0, 4)
    });
    return {iceServers: stun, source: "stun-only", ttlMs: 120_000};
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "Ttl=3600"
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("getFloqCastIceServers Twilio token failed", res.status, body.slice(0, 200));
      return {iceServers: stun, source: "stun-only", ttlMs: 60_000, twilioStatus: res.status};
    }
    const payload = await res.json();
    const twilioServers = Array.isArray(payload.ice_servers) ? payload.ice_servers : [];
    const iceServers = twilioServers.length ? twilioServers : stun;
    const expiresAtMs = Date.now() + ICE_CACHE_TTL_MS;
    try {
      await db.doc(ICE_CACHE_DOC).set({
        iceServers,
        source: "twilio",
        expiresAtMs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
    } catch (err) {
      console.warn("getFloqCastIceServers cache write failed", String(err?.message || err).slice(0, 160));
    }
    return {iceServers, source: "twilio", ttlMs: ICE_CACHE_TTL_MS};
  } catch (err) {
    console.error("getFloqCastIceServers Twilio threw", String(err?.message || err).slice(0, 200));
    return {iceServers: stun, source: "stun-only", ttlMs: 60_000};
  }
});

/** Called from commerce fulfillment after Stripe payment. */
exports.markFloqCastRequestPaid = async function markFloqCastRequestPaid({requestId, orderId, paidAt, amountCents = 2000}) {
  const ref = db.collection("suprstarRequests").doc(text(requestId, 120));
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`floqCast request ${requestId} not found for fulfillment.`);
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
  await notifyClubFloqCastRequest({...row, ...payload, requestId: ref.id});
  return {...row, ...payload, requestId: ref.id};
};

/* Deprecated callable names — keep for one deploy cycle so older Pages clients still resolve. */
exports.createSuprstarRequest = exports.createFloqCastRequest;
exports.approveSuprstarRequest = exports.approveFloqCastRequest;
exports.rejectSuprstarRequest = exports.rejectFloqCastRequest;
exports.startSuprstrLive = exports.startFloqCastLive;
exports.armSuprstrLiveDuration = exports.armFloqCastLiveDuration;
exports.endSuprstrLive = exports.endFloqCastLive;
exports.markSuprstarRequestPaid = exports.markFloqCastRequestPaid;
