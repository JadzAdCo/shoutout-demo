/* FLOQR Passes (beta) — QR door passes for VIP, guest entry, promoter clients.
   Design: docs/FEATURE-WIRING.md → Passes. Feature key: passes. */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {__featureServiceHelpers: featureAccess} = require("./feature-services-functions");
const assertFeatureAccess = (auth, key, req = null) => featureAccess.assertFeatureAccess(auth, key, req);
const core = require("./passes-core");
const {sendTwilioMessagesApi} = require("./twilio-log");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const CALL_OPTS = {region: "us-central1", cors: true};
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const CALL_OPTS_MSG = {
  region: "us-central1",
  cors: true,
  secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM]
};

const {
  text, newPassId, newQrToken, hashToken, passPublicUrl, publicPass,
  normalizeChannel, normalizeKind
} = core;

function requireAuth(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  return auth.uid;
}

function isMasterAdminAuth(authContext) {
  const claims = authContext?.token || {};
  return !!(claims.masterAdmin || claims.floqrMasterAdmin || claims.admin === true);
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

async function isClubPromoterAuth(authContext, clubId) {
  if (!authContext?.uid || !clubId) return false;
  if (await isClubManagerAuth(authContext, clubId)) return true;
  const uid = authContext.uid;
  const email = text(authContext.token?.email, 200).toLowerCase();
  const userSnap = await db.collection("users").doc(uid).get();
  const profile = userSnap.exists ? userSnap.data() || {} : {};
  const roles = []
    .concat(profile.roles || [])
    .concat(profile.serviceRoles || [])
    .concat(profile.electedRoles || [])
    .map(r => String(r || "").toLowerCase());
  const isPromoter = roles.some(r => r.includes("promoter")) || profile.IsPromoter === 1 || profile.isPromoter === true;
  if (!isPromoter) return false;
  const assocId = `${clubId}_${uid}`;
  const assoc = await db.collection("workerAssociations").doc(assocId).get().catch(() => null);
  if (assoc?.exists && ["active", "approved", "confirmed"].includes(text(assoc.data()?.status, 40))) return true;
  const des = await db.collection("clubEmployeeDesignations")
    .where("clubLocationId", "==", clubId)
    .where("uid", "==", uid)
    .limit(5)
    .get()
    .catch(() => null);
  if (des && !des.empty) {
    return des.docs.some(d => {
      const row = d.data() || {};
      const role = text(row.role || row.type || row.title, 40).toLowerCase();
      return role.includes("promoter") || text(row.status, 40) === "active";
    });
  }
  if (email) {
    const byEmail = await db.collection("clubLocations").doc(clubId).get();
    const promoters = byEmail.exists ? (byEmail.data()?.promoterEmails || []) : [];
    if (Array.isArray(promoters) && promoters.map(e => String(e).toLowerCase()).includes(email)) return true;
  }
  return false;
}

async function requireClubIssuer(authContext, clubId, {promoterOk = true} = {}) {
  requireAuth(authContext);
  if (await isClubManagerAuth(authContext, clubId)) return {role: "clubAdmin"};
  if (promoterOk && await isClubPromoterAuth(authContext, clubId)) return {role: "promoter"};
  throw new HttpsError("permission-denied", "Club Admin or assigned Promoter access required.");
}

function pagesOrigin(request) {
  const h = request.rawRequest?.headers || {};
  const origin = text(h.origin || h.referer, 300);
  if (origin.includes("jadzadco.github.io")) return "https://jadzadco.github.io/shoutout-demo";
  if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
    try { return new URL(origin).origin; } catch (_) { /* ignore */ }
  }
  return "https://jadzadco.github.io/shoutout-demo";
}

async function writePass({
  kind, clubLocationId, venueName, night, label, guestName, guestPhone, guestEmail,
  patronUid, issuedByUid, issuedByRole, promoterId, sourceReservationId, passToken
}) {
  const id = newPassId();
  const token = passToken || newQrToken();
  const now = Date.now();
  const row = {
    kind: normalizeKind(kind) || "guestEntry",
    status: "active",
    clubLocationId: text(clubLocationId, 120),
    venueName: text(venueName, 160),
    night: text(night, 40),
    label: text(label, 160),
    guestName: text(guestName, 120),
    guestPhone: text(guestPhone, 40),
    guestEmail: text(guestEmail, 160),
    patronUid: text(patronUid, 120),
    issuedByUid: text(issuedByUid, 120),
    issuedByRole: text(issuedByRole, 40),
    promoterId: text(promoterId, 120),
    sourceReservationId: text(sourceReservationId, 120),
    qrTokenHash: hashToken(token),
    createdAtMs: now,
    updatedAtMs: now,
    checkedInAtMs: 0,
    shareLog: [],
    beta: true
  };
  await db.collection("passes").doc(id).set(row);
  return {id, token, row};
}

/** Upsert a Passes row from a confirmed VIP reservation (idempotent by sourceReservationId). */
async function upsertPassFromVipReservation(reservationId, reservation = {}, passToken = "") {
  const sourceReservationId = text(reservationId, 120);
  if (!sourceReservationId) return null;
  const existing = await db.collection("passes")
    .where("sourceReservationId", "==", sourceReservationId)
    .limit(1)
    .get();
  const token = passToken || newQrToken();
  const now = Date.now();
  if (!existing.empty) {
    const doc = existing.docs[0];
    await doc.ref.set({
      qrTokenHash: hashToken(token),
      status: text(reservation.status, 40) === "checkedIn" ? "checkedIn" : "active",
      updatedAtMs: now,
      venueName: text(reservation.venueName, 160) || text(doc.data()?.venueName, 160),
      night: text(reservation.night, 40) || text(doc.data()?.night, 40),
      label: text(reservation.sectionLabel || reservation.sectionId, 160) || text(doc.data()?.label, 160),
      patronUid: text(reservation.patronUid, 120) || text(doc.data()?.patronUid, 120)
    }, {merge: true});
    return {id: doc.id, token, row: {...(doc.data() || {}), ...(await doc.ref.get()).data()}};
  }
  return writePass({
    kind: "vipReservation",
    clubLocationId: reservation.clubLocationId,
    venueName: reservation.venueName,
    night: reservation.night,
    label: reservation.sectionLabel || reservation.sectionId || "VIP table",
    guestName: reservation.leadGuestName || reservation.contactEmail,
    guestEmail: reservation.contactEmail,
    patronUid: reservation.patronUid,
    issuedByUid: reservation.patronUid,
    issuedByRole: "system",
    sourceReservationId,
    passToken: token
  });
}

/** Public resolve for pass.html — token holders see venue/night/status (no PII dump). */
exports.resolvePassToken = onCall(CALL_OPTS, async request => {
  const token = text(request.data?.token, 200);
  if (!token) throw new HttpsError("invalid-argument", "token is required.");
  const found = await db.collection("passes").where("qrTokenHash", "==", hashToken(token)).limit(1).get();
  if (found.empty) throw new HttpsError("not-found", "Pass not recognized.");
  const doc = found.docs[0];
  const row = doc.data() || {};
  if (!["active", "checkedIn"].includes(text(row.status, 40))) {
    throw new HttpsError("failed-precondition", "This pass is not active.");
  }
  return {
    passId: doc.id,
    kind: text(row.kind, 40),
    status: text(row.status, 40),
    venueName: text(row.venueName, 160),
    night: text(row.night, 40),
    label: text(row.label, 160),
    guestName: text(row.guestName, 120),
    beta: true
  };
});

exports.listMyPasses = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "passes", request);
  const uid = requireAuth(request.auth);
  const snap = await db.collection("passes").where("patronUid", "==", uid).limit(80).get();
  const rows = snap.docs
    .map(d => publicPass(d.id, d.data() || {}))
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return {passes: rows};
});

exports.listClubPasses = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "passes", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubIssuer(request.auth, clubLocationId, {promoterOk: true});
  const night = text(request.data?.night, 40);
  let query = db.collection("passes").where("clubLocationId", "==", clubLocationId);
  if (night) query = query.where("night", "==", night);
  const snap = await query.limit(120).get();
  const rows = snap.docs
    .map(d => publicPass(d.id, d.data() || {}))
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return {passes: rows};
});

exports.issuePass = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "passes", request);
  const uid = requireAuth(request.auth);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  const issuer = await requireClubIssuer(request.auth, clubLocationId, {promoterOk: true});
  let kind = normalizeKind(request.data?.kind) || "guestEntry";
  if (issuer.role === "promoter") kind = "promoterClient";
  const clubSnap = await db.collection("clubLocations").doc(clubLocationId).get();
  const venueName = text(clubSnap.exists ? (clubSnap.data()?.brandName || clubSnap.data()?.name || clubLocationId) : clubLocationId, 160);
  const {id, token, row} = await writePass({
    kind,
    clubLocationId,
    venueName,
    night: request.data?.night,
    label: request.data?.label || (kind === "promoterClient" ? "Promoter guest" : "Guest entry"),
    guestName: request.data?.guestName,
    guestPhone: request.data?.guestPhone,
    guestEmail: request.data?.guestEmail,
    patronUid: request.data?.patronUid || "",
    issuedByUid: uid,
    issuedByRole: issuer.role,
    promoterId: issuer.role === "promoter" ? uid : text(request.data?.promoterId, 120),
    sourceReservationId: request.data?.sourceReservationId
  });
  const origin = pagesOrigin(request);
  return publicPass(id, row, {includePassToken: true, passToken: token, origin});
});

exports.revealPass = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "passes", request);
  const uid = requireAuth(request.auth);
  const passId = text(request.data?.passId, 120);
  if (!passId) throw new HttpsError("invalid-argument", "passId is required.");
  const snap = await db.collection("passes").doc(passId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Pass not found.");
  const row = snap.data() || {};
  const isOwner = text(row.patronUid, 120) === uid;
  const isIssuer = text(row.issuedByUid, 120) === uid;
  const clubOk = await isClubManagerAuth(request.auth, text(row.clubLocationId, 120));
  if (!isOwner && !isIssuer && !clubOk && !isMasterAdminAuth(request.auth)) {
    throw new HttpsError("permission-denied", "Not allowed to reveal this pass.");
  }
  if (!["active", "checkedIn"].includes(text(row.status, 40))) {
    throw new HttpsError("failed-precondition", "This pass cannot be shown.");
  }
  const token = newQrToken();
  await snap.ref.set({qrTokenHash: hashToken(token), updatedAtMs: Date.now()}, {merge: true});
  // Keep VIP reservation hash in sync when linked
  const resId = text(row.sourceReservationId, 120);
  if (resId) {
    await db.collection("vipReservations").doc(resId).set({
      qrTokenHash: hashToken(token),
      qrTokenIssuedAtMs: Date.now()
    }, {merge: true}).catch(() => {});
  }
  return publicPass(passId, row, {includePassToken: true, passToken: token, origin: pagesOrigin(request)});
});

exports.checkInPass = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "passes", request);
  requireAuth(request.auth);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const token = text(request.data?.token, 200);
  const passId = text(request.data?.passId, 120);
  const id21Checked = request.data?.id21Checked === true || request.data?.id21Checked === 1;
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubIssuer(request.auth, clubLocationId, {promoterOk: false});
  if (!id21Checked) throw new HttpsError("failed-precondition", "Confirm ID 21+ before check-in.");
  let snap = null;
  if (passId) {
    snap = await db.collection("passes").doc(passId).get();
  } else if (token) {
    const found = await db.collection("passes").where("qrTokenHash", "==", hashToken(token)).limit(1).get();
    if (!found.empty) snap = found.docs[0];
  }
  if (!snap || !snap.exists) throw new HttpsError("not-found", "Pass not found for this token.");
  const row = snap.data() || {};
  if (text(row.clubLocationId, 120) !== clubLocationId) {
    throw new HttpsError("permission-denied", "Pass belongs to a different venue.");
  }
  if (text(row.status, 40) === "checkedIn") {
    return publicPass(snap.id, row);
  }
  if (text(row.status, 40) !== "active") {
    throw new HttpsError("failed-precondition", `Pass status is ${row.status || "unknown"}.`);
  }
  const now = Date.now();
  await snap.ref.set({status: "checkedIn", checkedInAtMs: now, updatedAtMs: now, IsCheckedIn: 1}, {merge: true});
  const resId = text(row.sourceReservationId, 120);
  if (resId) {
    await db.collection("vipReservations").doc(resId).set({
      status: "checkedIn",
      IsCheckedIn: 1,
      checkedInAtMs: now,
      updatedAtMs: now
    }, {merge: true}).catch(() => {});
  }
  return publicPass(snap.id, {...row, status: "checkedIn", checkedInAtMs: now});
});

exports.sharePass = onCall(CALL_OPTS_MSG, async request => {
  await assertFeatureAccess(request.auth, "passes", request);
  const uid = requireAuth(request.auth);
  const passId = text(request.data?.passId, 120);
  const channel = normalizeChannel(request.data?.channel);
  if (!passId) throw new HttpsError("invalid-argument", "passId is required.");
  if (!channel) throw new HttpsError("invalid-argument", "channel must be inbox, email, sms, or whatsapp.");
  const snap = await db.collection("passes").doc(passId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Pass not found.");
  const row = snap.data() || {};
  const clubOk = await isClubManagerAuth(request.auth, text(row.clubLocationId, 120));
  const issuerOk = text(row.issuedByUid, 120) === uid;
  const ownerOk = text(row.patronUid, 120) === uid;
  if (!clubOk && !issuerOk && !ownerOk && !isMasterAdminAuth(request.auth)) {
    throw new HttpsError("permission-denied", "Not allowed to share this pass.");
  }
  const token = newQrToken();
  await snap.ref.set({qrTokenHash: hashToken(token), updatedAtMs: Date.now()}, {merge: true});
  const origin = pagesOrigin(request);
  const passUrl = passPublicUrl(token, origin);
  const venue = text(row.venueName || row.clubLocationId, 160) || "the venue";
  const night = text(row.night, 40);
  const body = `Your FLOQR door pass for ${venue}${night ? ` (${night})` : ""}: ${passUrl}`;
  const toPhone = text(request.data?.toPhone || row.guestPhone, 40);
  const toEmail = text(request.data?.toEmail || row.guestEmail, 160);
  const toUid = text(request.data?.toUid || row.patronUid, 120);
  const delivery = {channel, ok: false, detail: ""};

  if (channel === "inbox") {
    if (!toUid) throw new HttpsError("invalid-argument", "Inbox share needs a recipient FLOQR user.");
    await db.collection("inboxNotifications").add({
      recipientUid: toUid,
      type: "door-pass",
      title: `Door pass · ${venue}`,
      body: `Open your pass for ${venue}${night ? ` on ${night}` : ""}.`,
      link: passUrl,
      linkLabel: "Open door pass",
      createdAtMs: Date.now(),
      read: false,
      from: "passes"
    });
    delivery.ok = true;
    delivery.detail = "inbox";
  } else if (channel === "email") {
    if (!toEmail) throw new HttpsError("invalid-argument", "Email address required.");
    // Soft path: inbox-style mail log when mailer available; always store share intent.
    try {
      const mailer = require("./mail-log-functions");
      if (typeof mailer.sendSimpleMail === "function") {
        await mailer.sendSimpleMail({to: toEmail, subject: `[FLOQR] Door pass · ${venue}`, text: body});
        delivery.ok = true;
      }
    } catch (_) { /* fall through */ }
    if (!delivery.ok) {
      await db.collection("mailOutbox").add({
        to: toEmail,
        subject: `[FLOQR] Door pass · ${venue}`,
        text: body,
        purpose: "door-pass",
        createdAtMs: Date.now(),
        status: "queued"
      }).catch(() => {});
      delivery.ok = true;
      delivery.detail = "queued";
    }
  } else if (channel === "sms" || channel === "whatsapp") {
    if (!toPhone) throw new HttpsError("invalid-argument", "Phone number required.");
    const accountSid = TWILIO_ACCOUNT_SID.value();
    const authToken = TWILIO_AUTH_TOKEN.value();
    const fromNumber = TWILIO_FROM_NUMBER.value();
    const waFrom = TWILIO_WHATSAPP_FROM.value();
    const useWa = channel === "whatsapp";
    const from = useWa
      ? (String(waFrom || fromNumber || "").startsWith("whatsapp:") ? (waFrom || fromNumber) : `whatsapp:${waFrom || fromNumber}`)
      : fromNumber;
    const to = useWa
      ? (String(toPhone).startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`)
      : toPhone;
    const result = await sendTwilioMessagesApi({
      accountSid,
      authToken,
      to,
      from,
      body,
      channel: useWa ? "whatsapp" : "sms",
      purpose: "door-pass",
      source: "passes-functions",
      clubLocationId: text(row.clubLocationId, 120)
    });
    delivery.ok = !!(result?.ok || result?.dryRun);
    delivery.detail = result?.status || "";
  }

  const shareEntry = {channel, atMs: Date.now(), byUid: uid, ok: delivery.ok, detail: delivery.detail};
  await snap.ref.set({
    shareLog: admin.firestore.FieldValue.arrayUnion(shareEntry),
    updatedAtMs: Date.now()
  }, {merge: true});

  return {
    ...publicPass(passId, row, {includePassToken: true, passToken: token, origin}),
    delivery
  };
});

/** Internal helper for VIP fulfillment / getVipReservationPass. */
exports.__passesHelpers = {
  upsertPassFromVipReservation,
  writePass,
  publicPass,
  hashToken,
  newQrToken,
  passPublicUrl
};
