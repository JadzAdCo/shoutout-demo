/* VIP reserV Phase 2 — holds, consent, reservations, door check-in.
   Design: .cursor/rules/design-notes-vip-reservations.mdc · VIP-B-24 pre-ship done in receipt/redaction. */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {__featureServiceHelpers: featureAccess} = require("./feature-services-functions");
const assertFeatureAccess = (auth, key, req = null) => featureAccess.assertFeatureAccess(auth, key, req);
const core = require("./vip-core");
const betaCatalog = require("./vip-beta-catalog");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const CALL_OPTS = {region: "us-central1", cors: true};
const {text, BETA_VENUES, BETA_TERMS, inventoryKey, computePartyAmounts, upcomingNights,
  validateNight, betaVenue, hashToken, newQrToken, consentChecksComplete, holdExpiresAtMs, HOLD_MS} = core;

function requireAuth(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  return auth.uid;
}

function clientMeta(request) {
  const headers = request.rawRequest?.headers || {};
  const fwd = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
  return {
    ip: text(fwd || headers["x-appengine-user-ip"] || "", 80),
    userAgent: text(headers["user-agent"], 300)
  };
}

function resolveSection(clubLocationId, sectionId) {
  const club = text(clubLocationId, 120);
  const catalog = betaCatalog[club];
  if (!catalog) throw new HttpsError("failed-precondition", "This venue is not on VIP reserV beta yet.");
  const section = (catalog.sections || []).find(s => s.id === text(sectionId, 80));
  if (!section) throw new HttpsError("not-found", "That table section was not found.");
  return {catalog, section};
}

function publicHold(holdId, row) {
  return {
    holdId,
    clubLocationId: row.clubLocationId || "",
    night: row.night || "",
    sectionId: row.sectionId || "",
    sectionLabel: row.sectionLabel || "",
    partySize: row.partySize || 0,
    amounts: row.amounts || {},
    expiresAtMs: row.expiresAtMs || 0,
    status: row.status || "",
    venueName: row.venueName || ""
  };
}

function publicReservation(id, row, {includePassToken = false, passToken = ""} = {}) {
  const out = {
    reservationId: id,
    clubLocationId: row.clubLocationId || "",
    night: row.night || "",
    sectionId: row.sectionId || "",
    sectionLabel: row.sectionLabel || "",
    partySize: row.partySize || 0,
    status: row.status || "",
    amounts: row.amounts || {},
    venueName: row.venueName || "",
    IsCheckedIn: row.IsCheckedIn === 1 ? 1 : 0,
    IsNoShow: row.IsNoShow === 1 ? 1 : 0,
    confirmedAtMs: row.confirmedAtMs || 0,
    leadGuestName: row.leadGuestName || ""
  };
  if (includePassToken && passToken) out.passToken = passToken;
  return out;
}

/** Phase 1+2: beta venue list (VIP reserV–subscribed clubs only when gate is set). */
exports.getVipBetaVenues = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const venues = [];
  for (const v of BETA_VENUES) {
    let subscribed = true;
    try {
      const snap = await db.collection("clubLocations").doc(v.id).get();
      if (snap.exists) {
        const gates = (snap.data() || {}).featureGates || {};
        if (Object.prototype.hasOwnProperty.call(gates, "vipReservations")) {
          subscribed = gates.vipReservations !== false;
        } else {
          /* Beta catalog venues are subscribed until Club Admin turns the gate off. */
          subscribed = true;
        }
      }
    } catch (_) { /* keep beta row */ }
    if (!subscribed) continue;
    venues.push({
      id: v.id,
      name: v.name,
      planFile: v.planFile,
      city: v.city,
      pending: !!v.pending
    });
  }
  return {
    phase: 2,
    brand: "VIP reserV",
    terms: BETA_TERMS,
    holdMinutes: Math.round(HOLD_MS / 60000),
    venues
  };
});

/** Sections + inventory status for a night. */
exports.getVipAvailability = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const night = validateNight(request.data?.night);
  if (!clubLocationId || !night) throw new HttpsError("invalid-argument", "clubLocationId and night (YYYY-MM-DD) are required.");
  const venue = betaVenue(clubLocationId);
  if (!venue || venue.pending) throw new HttpsError("failed-precondition", "This venue is not bookable on VIP reserV yet.");
  const catalog = betaCatalog[clubLocationId];
  if (!catalog) throw new HttpsError("failed-precondition", "Floor plan catalog missing for this venue.");

  const now = Date.now();
  const sections = [];
  for (const section of catalog.sections) {
    const key = inventoryKey(clubLocationId, night, section.id);
    const invSnap = await db.collection("vipInventory").doc(key).get();
    const inv = invSnap.exists ? invSnap.data() || {} : {};
    let status = "available";
    if (inv.status === "booked" || inv.status === "confirmed") status = "booked";
    else if (inv.status === "held" && Number(inv.expiresAtMs || 0) > now) status = "held";
    else if (inv.status === "blocked") status = "closed";
    const amounts = computePartyAmounts(section, section.includedGuests);
    sections.push({
      sectionId: section.id,
      label: section.label,
      type: section.type,
      maxCapacity: amounts.maxCapacity,
      includedGuests: amounts.includedGuests,
      status,
      depositCents: amounts.depositCents,
      minimumAmountCents: amounts.minimumAmountCents,
      extraGuestFeeCents: amounts.extraGuestFeeCents
    });
  }
  return {
    clubLocationId,
    night,
    venueName: catalog.venueName,
    nights: upcomingNights(14),
    sections
  };
});

/** Transactional inventory hold (30 min). */
exports.createVipHold = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const night = validateNight(request.data?.night);
  const sectionId = text(request.data?.sectionId, 80);
  const partySize = Math.floor(Number(request.data?.partySize || 0));
  if (!clubLocationId || !night || !sectionId) {
    throw new HttpsError("invalid-argument", "clubLocationId, night, and sectionId are required.");
  }
  const venue = betaVenue(clubLocationId);
  if (!venue || venue.pending) throw new HttpsError("failed-precondition", "This venue is not bookable on VIP reserV yet.");
  const {catalog, section} = resolveSection(clubLocationId, sectionId);
  if (partySize < 1 || partySize > Number(section.maxCapacity || 0)) {
    throw new HttpsError("invalid-argument", `Party size must be between 1 and ${section.maxCapacity}.`);
  }
  const amounts = computePartyAmounts(section, partySize);
  const key = inventoryKey(clubLocationId, night, sectionId);
  const now = Date.now();
  const expiresAtMs = holdExpiresAtMs(now);
  const holdRef = db.collection("vipHolds").doc();
  const invRef = db.collection("vipInventory").doc(key);
  const pointerRef = db.collection("vipActiveHolds").doc(`${uid}_${night}`);

  await db.runTransaction(async tx => {
    const pointerSnap = await tx.get(pointerRef);
    if (pointerSnap.exists) {
      const priorId = text(pointerSnap.data()?.holdId, 120);
      if (priorId) {
        const priorRef = db.collection("vipHolds").doc(priorId);
        const priorSnap = await tx.get(priorRef);
        if (priorSnap.exists) {
          const prior = priorSnap.data() || {};
          if (["active", "pendingPayment"].includes(text(prior.status, 40)) && Number(prior.expiresAtMs || 0) > now) {
            throw new HttpsError("failed-precondition", "You already have an active hold for this night. Release it or finish checkout first.");
          }
          tx.set(priorRef, {status: "expired", updatedAtMs: now}, {merge: true});
          if (prior.inventoryKey) {
            const priorInv = db.collection("vipInventory").doc(text(prior.inventoryKey, 200));
            const priorInvSnap = await tx.get(priorInv);
            if (priorInvSnap.exists && priorInvSnap.data()?.holdId === priorId) {
              tx.set(priorInv, {status: "available", holdId: "", holdUid: "", expiresAtMs: 0, updatedAtMs: now}, {merge: true});
            }
          }
        }
      }
    }

    const invSnap = await tx.get(invRef);
    const inv = invSnap.exists ? invSnap.data() || {} : {};
    if (inv.status === "booked" || inv.status === "confirmed") {
      throw new HttpsError("failed-precondition", "That table is already booked for this night.");
    }
    if (inv.status === "blocked") {
      throw new HttpsError("failed-precondition", "That table is blocked for this night.");
    }
    if (inv.status === "held" && Number(inv.expiresAtMs || 0) > now && inv.holdUid !== uid) {
      throw new HttpsError("failed-precondition", "Someone else is holding that table. Try another section.");
    }

    tx.set(invRef, {
      inventoryKey: key,
      clubLocationId,
      night,
      sectionId,
      status: "held",
      holdId: holdRef.id,
      holdUid: uid,
      expiresAtMs,
      updatedAtMs: now
    }, {merge: true});

    tx.set(holdRef, {
      uid,
      inventoryKey: key,
      clubLocationId,
      night,
      sectionId,
      sectionLabel: section.label || sectionId,
      venueName: catalog.venueName,
      partySize: amounts.partySize,
      includedGuests: amounts.includedGuests,
      extraGuests: amounts.extraGuests,
      amounts: {
        minimumAmountCents: amounts.minimumAmountCents,
        depositCents: amounts.depositCents,
        extraGuestFeeCents: amounts.extraGuestFeeCents,
        extraGuestFeeTotalCents: amounts.extraGuestFeeTotalCents,
        chargedCents: amounts.chargedCents,
        currency: amounts.currency
      },
      status: "active",
      expiresAtMs,
      createdAtMs: now,
      updatedAtMs: now
    });
    tx.set(pointerRef, {holdId: holdRef.id, clubLocationId, night, expiresAtMs, updatedAtMs: now}, {merge: true});
  });

  const snap = await holdRef.get();
  return publicHold(holdRef.id, snap.data() || {});
});

exports.releaseVipHold = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const holdId = text(request.data?.holdId, 120);
  if (!holdId) throw new HttpsError("invalid-argument", "holdId is required.");
  const holdRef = db.collection("vipHolds").doc(holdId);
  const now = Date.now();

  await db.runTransaction(async tx => {
    const holdSnap = await tx.get(holdRef);
    if (!holdSnap.exists) throw new HttpsError("not-found", "Hold not found.");
    const hold = holdSnap.data() || {};
    if (hold.uid !== uid) throw new HttpsError("permission-denied", "Not your hold.");
    if (!["active", "pendingPayment"].includes(text(hold.status, 40))) return;
    const invRef = db.collection("vipInventory").doc(text(hold.inventoryKey, 200));
    const invSnap = await tx.get(invRef);
    if (invSnap.exists) {
      const inv = invSnap.data() || {};
      if (inv.holdId === holdId && inv.status === "held") {
        tx.set(invRef, {status: "available", holdId: "", holdUid: "", expiresAtMs: 0, updatedAtMs: now}, {merge: true});
      }
    }
    const pointerRef = db.collection("vipActiveHolds").doc(`${uid}_${text(hold.night, 20)}`);
    const pointerSnap = await tx.get(pointerRef);
    if (pointerSnap.exists && text(pointerSnap.data()?.holdId, 120) === holdId) {
      tx.delete(pointerRef);
    }
    tx.set(holdRef, {status: "released", updatedAtMs: now}, {merge: true});
  });

  return {ok: true, holdId};
});

exports.recordVipConsent = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const holdId = text(request.data?.holdId, 120);
  const checks = request.data?.checks && typeof request.data.checks === "object" ? request.data.checks : {};
  if (!holdId) throw new HttpsError("invalid-argument", "holdId is required.");
  if (!consentChecksComplete(checks)) {
    throw new HttpsError("invalid-argument", "Accept all required VIP reserV Terms checkboxes.");
  }
  const holdSnap = await db.collection("vipHolds").doc(holdId).get();
  if (!holdSnap.exists) throw new HttpsError("not-found", "Hold not found.");
  const hold = holdSnap.data() || {};
  if (hold.uid !== uid) throw new HttpsError("permission-denied", "Not your hold.");
  if (hold.status !== "active") throw new HttpsError("failed-precondition", "This hold is no longer active.");
  if (Number(hold.expiresAtMs || 0) <= Date.now()) {
    throw new HttpsError("failed-precondition", "Your hold expired. Pick the table again.");
  }

  const meta = clientMeta(request);
  const consentRef = db.collection("vipConsents").doc();
  const now = Date.now();
  await consentRef.set({
    uid,
    holdId,
    clubLocationId: hold.clubLocationId || "",
    night: hold.night || "",
    sectionId: hold.sectionId || "",
    termsDocId: BETA_TERMS.termsDocId,
    termsVersion: BETA_TERMS.termsVersion,
    termsSha256: BETA_TERMS.termsSha256,
    checks: {
      terms: true,
      refund: true,
      noShow: true,
      age21: true,
      minimumSpend: true,
      marketing: checks.marketing === true
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
    createdAtMs: now
  });
  await holdSnap.ref.set({consentId: consentRef.id, updatedAtMs: now}, {merge: true});
  return {
    consentId: consentRef.id,
    termsDocId: BETA_TERMS.termsDocId,
    termsVersion: BETA_TERMS.termsVersion,
    holdId
  };
});

exports.getMyVipReservations = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const snap = await db.collection("vipReservations")
    .where("patronUid", "==", uid)
    .limit(40)
    .get();
  const rows = snap.docs
    .map(doc => publicReservation(doc.id, doc.data() || {}))
    .sort((a, b) => String(b.night).localeCompare(String(a.night)));
  return {reservations: rows};
});

exports.getVipReservationPass = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const reservationId = text(request.data?.reservationId, 120);
  if (!reservationId) throw new HttpsError("invalid-argument", "reservationId is required.");
  const snap = await db.collection("vipReservations").doc(reservationId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Reservation not found.");
  const row = snap.data() || {};
  if (row.patronUid !== uid) throw new HttpsError("permission-denied", "Not your reservation.");
  if (!["confirmed", "checkedIn"].includes(text(row.status, 40))) {
    throw new HttpsError("failed-precondition", "Pass is available after the deposit is confirmed.");
  }
  const token = newQrToken();
  const tokenHash = hashToken(token);
  await snap.ref.set({
    qrTokenHash: tokenHash,
    qrTokenIssuedAtMs: Date.now()
  }, {merge: true});
  return publicReservation(reservationId, row, {includePassToken: true, passToken: token});
});

exports.checkInVipReservation = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const token = text(request.data?.token, 200);
  const reservationId = text(request.data?.reservationId, 120);
  const id21Checked = request.data?.id21Checked === true || request.data?.id21Checked === 1;
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  if (!token && !reservationId) throw new HttpsError("invalid-argument", "Provide a pass token or reservationId.");

  let ref = null;
  let row = null;
  if (reservationId) {
    ref = db.collection("vipReservations").doc(reservationId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Reservation not found.");
    row = snap.data() || {};
  } else {
    const tokenHash = hashToken(token);
    const q = await db.collection("vipReservations")
      .where("clubLocationId", "==", clubLocationId)
      .where("qrTokenHash", "==", tokenHash)
      .limit(1)
      .get();
    if (q.empty) throw new HttpsError("not-found", "Pass not recognized.");
    ref = q.docs[0].ref;
    row = q.docs[0].data() || {};
  }

  if (text(row.clubLocationId, 120) !== clubLocationId) {
    throw new HttpsError("permission-denied", "Wrong venue for this pass.");
  }
  if (row.IsCheckedIn === 1 || text(row.status, 40) === "checkedIn") {
    return {ok: true, alreadyCheckedIn: true, reservation: publicReservation(ref.id, row)};
  }
  if (text(row.status, 40) !== "confirmed") {
    throw new HttpsError("failed-precondition", "Only confirmed reservations can check in.");
  }

  const now = Date.now();
  await ref.set({
    status: "checkedIn",
    IsCheckedIn: 1,
    checkIn: {atMs: now, byUid: uid, id21Checked: id21Checked ? 1 : 0, method: token ? "qr" : "manual"},
    updatedAtMs: now
  }, {merge: true});
  const updated = (await ref.get()).data() || {};
  return {ok: true, reservation: publicReservation(ref.id, updated)};
});

exports.markVipNoShow = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const reservationId = text(request.data?.reservationId, 120);
  if (!reservationId) throw new HttpsError("invalid-argument", "reservationId is required.");
  const ref = db.collection("vipReservations").doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Reservation not found.");
  const row = snap.data() || {};
  if (text(row.status, 40) === "checkedIn" || row.IsCheckedIn === 1) {
    throw new HttpsError("failed-precondition", "Already checked in — cannot mark no-show.");
  }
  const now = Date.now();
  await ref.set({
    status: "noShow",
    IsNoShow: 1,
    noShowAtMs: now,
    noShowByUid: uid,
    updatedAtMs: now
  }, {merge: true});
  return {ok: true, reservation: publicReservation(reservationId, {...row, status: "noShow", IsNoShow: 1})};
});

exports.listVipReservations = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  requireAuth(request.auth);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const night = validateNight(request.data?.night);
  if (!clubLocationId || !night) throw new HttpsError("invalid-argument", "clubLocationId and night are required.");
  const snap = await db.collection("vipReservations")
    .where("clubLocationId", "==", clubLocationId)
    .where("night", "==", night)
    .limit(100)
    .get();
  return {
    clubLocationId,
    night,
    reservations: snap.docs.map(doc => publicReservation(doc.id, doc.data() || {}))
  };
});

/** Fulfillment helper used by commerce webhook when orderType === vipReservation. */
async function fulfillVipReservationOrder(orderId, order = {}) {
  const holdId = text(order.payload?.holdId || order.holdId, 120);
  const consentId = text(order.payload?.consentId || order.consentId, 120);
  if (!holdId || !consentId) throw new Error("VIP fulfillment missing holdId or consentId.");
  const holdRef = db.collection("vipHolds").doc(holdId);
  const holdSnap = await holdRef.get();
  if (!holdSnap.exists) throw new Error(`VIP hold ${holdId} missing.`);
  const hold = holdSnap.data() || {};
  const now = Date.now();
  const passToken = newQrToken();
  const reservationRef = db.collection("vipReservations").doc();
  const invKey = text(hold.inventoryKey, 200);
  const invRef = db.collection("vipInventory").doc(invKey);

  await db.runTransaction(async tx => {
    tx.set(reservationRef, {
      clubLocationId: hold.clubLocationId || "",
      night: hold.night || "",
      sectionId: hold.sectionId || "",
      sectionLabel: hold.sectionLabel || "",
      venueName: hold.venueName || "",
      partySize: hold.partySize || 0,
      includedGuests: hold.includedGuests || 0,
      extraGuests: hold.extraGuests || 0,
      patronUid: hold.uid || order.ownerUid || "",
      leadGuestName: text(order.ownerEmail || "", 120),
      contactEmail: text(order.ownerEmail || "", 200),
      bookedByType: "patron",
      status: "confirmed",
      termsDocId: BETA_TERMS.termsDocId,
      termsVersion: BETA_TERMS.termsVersion,
      termsSha256: BETA_TERMS.termsSha256,
      consentId,
      holdId,
      amounts: hold.amounts || {},
      stripe: {
        checkoutSessionId: text(order.stripeCheckoutSessionId || order.sessionId, 160),
        paymentIntentId: text(order.stripePaymentIntentId || order.paymentIntentId, 160)
      },
      serviceOrderId: orderId,
      qrTokenHash: hashToken(passToken),
      IsCheckedIn: 0,
      IsNoShow: 0,
      IsRefunded: 0,
      confirmedAtMs: now,
      createdAtMs: now,
      updatedAtMs: now
    });
    tx.set(holdRef, {status: "converted", reservationId: reservationRef.id, updatedAtMs: now}, {merge: true});
    tx.set(invRef, {
      status: "booked",
      reservationId: reservationRef.id,
      holdId: "",
      holdUid: "",
      expiresAtMs: 0,
      updatedAtMs: now
    }, {merge: true});
    const patronUid = text(hold.uid || order.ownerUid, 120);
    const night = text(hold.night, 20);
    if (patronUid && night) {
      const pointerRef = db.collection("vipActiveHolds").doc(`${patronUid}_${night}`);
      tx.delete(pointerRef);
    }
  });

  return {reservationId: reservationRef.id, passToken};
}

exports.__vipHelpers = {
  fulfillVipReservationOrder,
  resolveSection,
  publicHold,
  publicReservation,
  BETA_TERMS,
  core
};
