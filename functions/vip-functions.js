/* VIP reserV Phase 2 — holds, consent, reservations, door check-in.
   Design: .cursor/rules/design-notes-vip-reservations.mdc · VIP-B-24 pre-ship done in receipt/redaction. */
"use strict";

const admin = require("firebase-admin");
const Stripe = require("stripe");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const {__featureServiceHelpers: featureAccess} = require("./feature-services-functions");
const assertFeatureAccess = (auth, key, req = null) => featureAccess.assertFeatureAccess(auth, key, req);
const core = require("./vip-core");
const betaCatalog = require("./vip-beta-catalog");
const tableStatus = require("./vip-table-status");
const vipPayments = require("./vip-payments-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_API_VERSION = "2026-06-24.dahlia";
const CALL_OPTS = {region: "us-central1", cors: true};
const CALL_OPTS_STRIPE = {region: "us-central1", cors: true, secrets: [STRIPE_SECRET_KEY]};
const {text, BETA_VENUES, BETA_TERMS, inventoryKey, computePartyAmounts, upcomingNights,
  validateNight, betaVenue, hashToken, newQrToken, consentChecksComplete, expandConsentChecks,
  holdExpiresAtMs, HOLD_MS, normalizeVipSettings, resolveDepositRequired, canMarkTableBooked,
  tableNumberFromSection, bookableNightsFromClub, isNightBookable, isTableBookedValue,
  nightPriceOverride, mergeExtraBookableNights} = core;

function catalogNightOverride(catalog, night, sectionId) {
  return nightPriceOverride(catalog?.nightPricing, night, sectionId);
}

function clubNightBookable(clubRow, catalog, night) {
  if (isNightBookable(clubRow, night)) return true;
  const extras = Array.isArray(catalog?.extraNights) ? catalog.extraNights : [];
  if (extras.some(n => validateNight(n) === night)) return true;
  if (catalog?.nightPricing && catalog.nightPricing[night]) return true;
  return false;
}

async function loadClubLocation(clubLocationId) {
  const id = text(clubLocationId, 120);
  if (!id) return {};
  const snap = await db.collection("clubLocations").doc(id).get();
  return snap.exists ? (snap.data() || {}) : {};
}

/** Free inventory + mark hold expired when expiresAtMs has passed. */
async function expireHoldRow(holdId, hold = {}, now = Date.now()) {
  const holdRef = db.collection("vipHolds").doc(holdId);
  const invKey = text(hold.inventoryKey, 200);
  await db.runTransaction(async tx => {
    const holdSnap = await tx.get(holdRef);
    if (!holdSnap.exists) return;
    const row = holdSnap.data() || {};
    if (!["active", "pendingPayment"].includes(text(row.status, 40))) return;
    if (Number(row.expiresAtMs || 0) > now) return;
    tx.set(holdRef, {status: "expired", updatedAtMs: now, expiredAtMs: now}, {merge: true});
    if (invKey) {
      const invRef = db.collection("vipInventory").doc(invKey);
      const invSnap = await tx.get(invRef);
      if (invSnap.exists) {
        const inv = invSnap.data() || {};
        if (inv.holdId === holdId && inv.status === "held") {
          tx.set(invRef, {
            status: "available",
            isReserved: 0,
            holdId: "",
            holdUid: "",
            expiresAtMs: 0,
            updatedAtMs: now
          }, {merge: true});
        }
      }
    }
    const uid = text(row.uid, 120);
    const night = text(row.night, 20);
    if (uid && night) {
      const pointerRef = db.collection("vipActiveHolds").doc(`${uid}_${night}`);
      const pointerSnap = await tx.get(pointerRef);
      if (pointerSnap.exists && text(pointerSnap.data()?.holdId, 120) === holdId) {
        tx.delete(pointerRef);
      }
    }
  });
}

function resolveTableNumber(holdOrRow = {}, section = null) {
  if (section) return tableNumberFromSection(section, holdOrRow.sectionId);
  const fromLabel = tableNumberFromSection({label: holdOrRow.sectionLabel}, holdOrRow.sectionId);
  return fromLabel;
}

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

async function requireClubManager(authContext, clubId) {
  requireAuth(authContext);
  const ok = await isClubManagerAuth(authContext, clubId);
  if (!ok) throw new HttpsError("permission-denied", "Club Admin access required for this venue.");
}

async function loadVipSettings(clubLocationId) {
  const snap = await db.collection("clubLocations").doc(text(clubLocationId, 120)).get();
  const row = snap.exists ? snap.data() || {} : {};
  return normalizeVipSettings(row.vipSettings || {});
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
    venueName: row.venueName || "",
    depositRequired: Number(row.depositRequired) === 0 ? 0 : 1,
    paymentCollector: row.paymentCollector || "floqrStripe",
    posProvider: row.posProvider || ""
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
    paymentConfirmed: Number(row.paymentConfirmed) === 1 ? 1 : 0,
    depositRequired: Number(row.depositRequired) === 0 ? 0 : 1,
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
  // Ensure every onboarded club night has table docs keyed by table number (isBooked "0" until booked).
  try {
    await tableStatus.ensureVipTablesForNightSafe(db, {
      clubLocationId,
      night,
      sections: catalog.sections || [],
      now
    });
  } catch (e) {
    console.warn("ensureVipTablesForNightSafe", clubLocationId, night, e?.message || e);
  }
  const vipSettings = await loadVipSettings(clubLocationId);
  const clubRow = await loadClubLocation(clubLocationId);
  const bookableNights = mergeExtraBookableNights(
    bookableNightsFromClub(clubRow, {count: 14, horizonDays: 90}),
    [
      ...(Array.isArray(catalog.extraNights) ? catalog.extraNights : []),
      ...Object.keys(catalog.nightPricing || {})
    ]
  );
  const tableRows = await tableStatus.listTablesForNight(db, clubLocationId, night);
  // Firestore isBooked is the booking-status control (set only after payment / admin confirm).
  const bookedByTable = new Map(tableRows.filter(t => t.isBooked === "1").map(t => [t.tableNumber, t]));
  const sections = [];
  const staleHoldCleanups = [];
  for (const section of catalog.sections) {
    const key = inventoryKey(clubLocationId, night, section.id);
    const invSnap = await db.collection("vipInventory").doc(key).get();
    const inv = invSnap.exists ? invSnap.data() || {} : {};
    const tableNumber = tableNumberFromSection(section);
    const tableBooked = bookedByTable.has(tableNumber);
    let status = "available";
    if (tableBooked) {
      status = "booked";
    } else if (inv.status === "held" && Number(inv.expiresAtMs || 0) > now) {
      status = "held";
    } else if (inv.status === "held" && Number(inv.expiresAtMs || 0) <= now && inv.holdId) {
      // Lazy free: expired hold still shows available; schedule write cleanup.
      staleHoldCleanups.push(expireHoldRow(text(inv.holdId, 120), inv, now));
      status = "available";
    } else if (inv.status === "blocked") {
      status = "closed";
    }
    // Do not treat legacy vipInventory.isReserved alone as booked — isBooked wins.
    const nightOverride = catalogNightOverride(catalog, night, section.id);
    const amounts = computePartyAmounts(section, section.includedGuests, {
      nightOverride,
      currency: catalog.currency || nightOverride?.currency || section.minimumAmount?.currency
    });
    const depositRequired = resolveDepositRequired(vipSettings, amounts) ? 1 : 0;
    sections.push({
      sectionId: section.id,
      label: section.label,
      tableNumber,
      type: section.type,
      maxCapacity: amounts.maxCapacity,
      includedGuests: amounts.includedGuests,
      status,
      isReserved: status === "booked" ? 1 : 0,
      isBooked: status === "booked" ? "1" : "0",
      holdExpiresAtMs: status === "held" ? Number(inv.expiresAtMs || 0) : 0,
      depositCents: amounts.depositCents,
      depositRequired,
      minimumAmountCents: amounts.minimumAmountCents,
      extraGuestFeeCents: amounts.extraGuestFeeCents,
      currency: amounts.currency || "USD",
      nightPriced: !!nightOverride,
      pricesPublished: Number(amounts.minimumAmountCents || 0) > 0
    });
  }
  if (staleHoldCleanups.length) {
    Promise.allSettled(staleHoldCleanups).catch(() => {});
  }
  return {
    clubLocationId,
    night,
    venueName: catalog.venueName,
    nights: bookableNights.map(n => n.night),
    bookableNights,
    nightOpen: clubNightBookable(clubRow, catalog, night),
    nightHours: (() => {
      try { return core.hoursForNight(clubRow, night); } catch (_) { return null; }
    })(),
    depositRequired: vipSettings.depositRequired,
    holdMinutes: Math.round(HOLD_MS / 60000),
    currency: catalog.currency || "USD",
    sections,
    tables: tableRows
  };
});

/** Transactional inventory hold (30 min). */
async function runCreateVipHold(request) {
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
  const nightOverride = catalogNightOverride(catalog, night, sectionId);
  const maxCap = Math.max(1, Math.floor(Number(
    nightOverride?.maxCapacity || section.maxCapacity || 0
  )));
  if (partySize < 1 || partySize > maxCap) {
    throw new HttpsError("invalid-argument", `Party size must be between 1 and ${maxCap}.`);
  }
  const clubRow = await loadClubLocation(clubLocationId);
  if (!clubNightBookable(clubRow, catalog, night)) {
    throw new HttpsError("failed-precondition", "That night the club is closed. Pick an open night from the calendar.");
  }
  const amounts = computePartyAmounts(section, partySize, {
    nightOverride,
    currency: catalog.currency || nightOverride?.currency || section.minimumAmount?.currency
  });
  if (!(Number(amounts.minimumAmountCents || 0) > 0) && !(Number(amounts.depositCents || 0) > 0)) {
    throw new HttpsError(
      "failed-precondition",
      "Table prices for this night are not published yet. Pick a priced night or wait for Club Admin pricing."
    );
  }
  const vipSettings = await loadVipSettings(clubLocationId);
  const depositRequired = resolveDepositRequired(vipSettings, amounts);
  let paymentCollector = "floqrStripe";
  let posProvider = "";
  try {
    const {loadClubPaymentSettings} = require("./vip-pos-functions").__vipPosHelpers;
    const pay = await loadClubPaymentSettings(clubLocationId);
    paymentCollector = pay.paymentCollector || paymentCollector;
    posProvider = pay.posProvider || "";
  } catch (_) { /* default FloqR Stripe */ }
  const key = inventoryKey(clubLocationId, night, sectionId);
  const tableNumber = tableNumberFromSection(section);
  const tableRef = tableStatus.tableDocRef
    ? tableStatus.tableDocRef(db, clubLocationId, night, tableNumber)
    : db.collection("clubLocations").doc(clubLocationId)
      .collection("vipNights").doc(night)
      .collection("tables").doc(tableNumber);
  const now = Date.now();
  const expiresAtMs = holdExpiresAtMs(now);
  const holdRef = db.collection("vipHolds").doc();
  const invRef = db.collection("vipInventory").doc(key);
  const pointerRef = db.collection("vipActiveHolds").doc(`${uid}_${night}`);

  await db.runTransaction(async tx => {
    const tableSnap = await tx.get(tableRef);
    if (tableSnap.exists && isTableBookedValue(tableSnap.data()?.isBooked)) {
      throw new HttpsError("failed-precondition", "That table is already reserved for this night.");
    }
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
              tx.set(priorInv, {status: "available", isReserved: 0, holdId: "", holdUid: "", expiresAtMs: 0, updatedAtMs: now}, {merge: true});
            }
          }
        }
      }
    }

    const invSnap = await tx.get(invRef);
    const inv = invSnap.exists ? invSnap.data() || {} : {};
    // Paid booked uses vipNights tables.isBooked (checked above) AND inventory booked flags.
    if (Number(inv.isReserved) === 1 || inv.status === "booked" || inv.status === "confirmed") {
      throw new HttpsError("failed-precondition", "That table is already reserved for this night.");
    }
    if (inv.status === "blocked") {
      throw new HttpsError("failed-precondition", "That table is blocked for this night.");
    }
    if (inv.status === "held" && Number(inv.expiresAtMs || 0) > now && inv.holdUid !== uid) {
      throw new HttpsError("failed-precondition", "Someone else is holding that table. Try another section.");
    }
    // Stale held row past expiresAtMs → reclaim as free before writing the new hold.
    if (inv.status === "held" && Number(inv.expiresAtMs || 0) <= now) {
      /* fall through — overwrite with this hold */
    }

    // Hold never marks booked — isReserved stays 0 until payment (when required).
    // expiresAtMs is the hold TTL datapoint (30 min); scheduled expireVipHolds frees the table.
    tx.set(invRef, {
      inventoryKey: key,
      clubLocationId,
      night,
      sectionId,
      tableNumber,
      status: "held",
      isReserved: 0,
      isBooked: "0",
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
      tableNumber,
      venueName: catalog.venueName,
      partySize: amounts.partySize,
      includedGuests: amounts.includedGuests,
      extraGuests: amounts.extraGuests,
      depositRequired: depositRequired ? 1 : 0,
      paymentCollector,
      posProvider,
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
  return Object.assign(publicHold(holdRef.id, snap.data() || {}), {
    depositRequired: depositRequired ? 1 : 0,
    paymentCollector,
    posProvider
  });
}

exports.createVipHold = onCall(CALL_OPTS, runCreateVipHold);


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
        tx.set(invRef, {status: "available", isReserved: 0, holdId: "", holdUid: "", expiresAtMs: 0, updatedAtMs: now}, {merge: true});
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

async function runRecordVipConsent(request) {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const holdId = text(request.data?.holdId, 120);
  const checks = request.data?.checks && typeof request.data.checks === "object" ? request.data.checks : {};
  if (!holdId) throw new HttpsError("invalid-argument", "holdId is required.");
  if (!consentChecksComplete(checks)) {
    throw new HttpsError("invalid-argument", "Accept the VIP reserV Terms before paying.");
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
    checks: expandConsentChecks(checks),
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
}

exports.recordVipConsent = onCall(CALL_OPTS, runRecordVipConsent);


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
  // Mirror into generalized Passes collection (QR door beta).
  try {
    const passes = require("./passes-functions").__passesHelpers;
    if (passes?.upsertPassFromVipReservation) {
      await passes.upsertPassFromVipReservation(reservationId, {
        ...row,
        status: text(row.status, 40),
        patronUid: uid
      }, token);
    }
  } catch (_) { /* Passes mirror best-effort */ }
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

/** Inventory patch after a confirmed booking (callers must pass canMarkTableBooked first). */
function inventoryBookedPatch({reservationId, now, paymentConfirmed}) {
  return {
    status: "booked",
    isReserved: 1,
    reservationId: reservationId || "",
    holdId: "",
    holdUid: "",
    expiresAtMs: 0,
    paymentConfirmed: paymentConfirmed ? 1 : 0,
    updatedAtMs: now
  };
}

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
  // Stripe paid → always allowed to mark booked, even when depositRequired.
  if (!canMarkTableBooked({depositRequired: true, paymentConfirmed: 1})) {
    throw new Error("VIP paid-before-booked gate rejected fulfillment.");
  }

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
      paymentConfirmed: 1,
      depositRequired: Number(hold.depositRequired) === 0 ? 0 : 1,
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
    tx.set(invRef, inventoryBookedPatch({reservationId: reservationRef.id, now, paymentConfirmed: 1}), {merge: true});
    tableStatus.applyTableBooked(tx, db, {
      clubLocationId: hold.clubLocationId,
      night: hold.night,
      tableNumber: resolveTableNumber(hold),
      sectionId: hold.sectionId,
      sectionLabel: hold.sectionLabel,
      reservationId: reservationRef.id,
      now
    });
    const patronUid = text(hold.uid || order.ownerUid, 120);
    const night = text(hold.night, 20);
    if (patronUid && night) {
      const pointerRef = db.collection("vipActiveHolds").doc(`${patronUid}_${night}`);
      tx.delete(pointerRef);
    }
  });

  return {reservationId: reservationRef.id, passToken};
}

/** Club Admin: read VIP deposit / booking settings for this venue. */
exports.getVipClubSettings = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubManager(request.auth, clubLocationId);
  const settings = await loadVipSettings(clubLocationId);
  return {clubLocationId, settings, brand: "VIP reserV"};
});

/** Club Admin: save depositRequired + refund policy (cancel → clear isBooked; Stripe refund by policy). */
exports.saveVipClubSettings = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubManager(request.auth, clubLocationId);
  const depositRequired = request.data?.depositRequired === 0 || request.data?.depositRequired === false || request.data?.depositRequired === "0"
    ? 0
    : 1;
  const existing = await loadVipSettings(clubLocationId);
  const refundPolicy = vipPayments.normalizeRefundPolicy({
    ...existing.refundPolicy,
    ...(request.data?.refundPolicy && typeof request.data.refundPolicy === "object" ? request.data.refundPolicy : {}),
    clubCancelRefundMode: request.data?.clubCancelRefundMode ?? request.data?.refundPolicy?.clubCancelRefundMode,
    allowStripeRefund: request.data?.allowStripeRefund ?? request.data?.refundPolicy?.allowStripeRefund,
    fullRefundHoursBeforeNight: request.data?.fullRefundHoursBeforeNight ?? request.data?.refundPolicy?.fullRefundHoursBeforeNight,
    partialRefundHoursBeforeNight: request.data?.partialRefundHoursBeforeNight ?? request.data?.refundPolicy?.partialRefundHoursBeforeNight,
    partialRefundPercent: request.data?.partialRefundPercent ?? request.data?.refundPolicy?.partialRefundPercent
  });
  const now = Date.now();
  await db.collection("clubLocations").doc(clubLocationId).set({
    vipSettings: {
      depositRequired,
      refundPolicy,
      updatedAtMs: now,
      updatedByUid: request.auth.uid
    },
    updatedAtMs: now
  }, {merge: true});
  return {ok: true, clubLocationId, settings: {depositRequired, refundPolicy}};
});

/** Club Admin: block or reopen a section for a night (shows closed on the map). */
exports.setVipSectionBlocked = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const night = validateNight(request.data?.night);
  const sectionId = text(request.data?.sectionId, 80);
  const blocked = request.data?.blocked === true || request.data?.blocked === 1;
  if (!clubLocationId || !night || !sectionId) {
    throw new HttpsError("invalid-argument", "clubLocationId, night, and sectionId are required.");
  }
  await requireClubManager(request.auth, clubLocationId);
  resolveSection(clubLocationId, sectionId);
  const key = inventoryKey(clubLocationId, night, sectionId);
  const invRef = db.collection("vipInventory").doc(key);
  const now = Date.now();
  const snap = await invRef.get();
  const inv = snap.exists ? snap.data() || {} : {};
  if (blocked && (Number(inv.isReserved) === 1 || inv.status === "booked")) {
    throw new HttpsError("failed-precondition", "Cannot block a paid/booked table. Cancel the reservation first.");
  }
  if (blocked && inv.status === "held" && Number(inv.expiresAtMs || 0) > now) {
    throw new HttpsError("failed-precondition", "Release the active hold before blocking this table.");
  }
  await invRef.set({
    inventoryKey: key,
    clubLocationId,
    night,
    sectionId,
    status: blocked ? "blocked" : "available",
    isReserved: 0,
    holdId: "",
    holdUid: "",
    expiresAtMs: 0,
    blockedByUid: blocked ? request.auth.uid : "",
    updatedAtMs: now
  }, {merge: true});
  return {ok: true, inventoryKey: key, status: blocked ? "blocked" : "available"};
});

/**
 * Confirm a hold without Stripe when the club does not require a deposit
 * (or chargedCents is 0). Never marks booked when deposit is required.
 */
async function runConfirmVipReservationWithoutDeposit(request) {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const holdId = text(request.data?.holdId, 120);
  const consentId = text(request.data?.consentId, 120);
  if (!holdId || !consentId) throw new HttpsError("invalid-argument", "holdId and consentId are required.");
  const holdRef = db.collection("vipHolds").doc(holdId);
  const holdSnap = await holdRef.get();
  if (!holdSnap.exists) throw new HttpsError("not-found", "Hold not found.");
  const hold = holdSnap.data() || {};
  if (hold.uid !== uid) throw new HttpsError("permission-denied", "Not your hold.");
  if (!["active", "pendingPayment"].includes(text(hold.status, 40))) {
    throw new HttpsError("failed-precondition", "Hold is not active.");
  }
  if (Number(hold.expiresAtMs || 0) <= Date.now()) {
    throw new HttpsError("failed-precondition", "Hold expired. Hold the table again.");
  }
  const vipSettings = await loadVipSettings(hold.clubLocationId);
  const depositRequired = resolveDepositRequired(vipSettings, hold.amounts || {});
  if (depositRequired) {
    throw new HttpsError(
      "failed-precondition",
      "This venue requires a deposit before the table is marked booked. Pay the deposit to confirm."
    );
  }
  if (!canMarkTableBooked({depositRequired: false, paymentConfirmed: 0})) {
    throw new HttpsError("failed-precondition", "Cannot mark table booked without payment.");
  }

  const now = Date.now();
  const passToken = newQrToken();
  const reservationRef = db.collection("vipReservations").doc();
  const invRef = db.collection("vipInventory").doc(text(hold.inventoryKey, 200));

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
      patronUid: hold.uid || "",
      leadGuestName: "",
      contactEmail: text(request.auth.token?.email, 200),
      bookedByType: "patron",
      status: "confirmed",
      paymentConfirmed: 0,
      depositRequired: 0,
      termsDocId: BETA_TERMS.termsDocId,
      termsVersion: BETA_TERMS.termsVersion,
      termsSha256: BETA_TERMS.termsSha256,
      consentId,
      holdId,
      amounts: hold.amounts || {},
      qrTokenHash: hashToken(passToken),
      IsCheckedIn: 0,
      IsNoShow: 0,
      IsRefunded: 0,
      confirmedAtMs: now,
      createdAtMs: now,
      updatedAtMs: now
    });
    tx.set(holdRef, {status: "converted", reservationId: reservationRef.id, updatedAtMs: now}, {merge: true});
    tx.set(invRef, inventoryBookedPatch({reservationId: reservationRef.id, now, paymentConfirmed: 0}), {merge: true});
    tableStatus.applyTableBooked(tx, db, {
      clubLocationId: hold.clubLocationId,
      night: hold.night,
      tableNumber: resolveTableNumber(hold),
      sectionId: hold.sectionId,
      sectionLabel: hold.sectionLabel,
      reservationId: reservationRef.id,
      now
    });
    const pointerRef = db.collection("vipActiveHolds").doc(`${uid}_${text(hold.night, 20)}`);
    tx.delete(pointerRef);
  });

  return {
    ok: true,
    reservation: publicReservation(reservationRef.id, (await reservationRef.get()).data() || {}, {
      includePassToken: true,
      passToken
    })
  };
}

exports.confirmVipReservationWithoutDeposit = onCall(CALL_OPTS, runConfirmVipReservationWithoutDeposit);

/**
 * Club Admin walk-in / manage: confirm a table as booked.
 * If depositRequired, must pass paymentRecorded=true (cash/POS/card at door).
 */
exports.adminConfirmVipReservation = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const night = validateNight(request.data?.night);
  const sectionId = text(request.data?.sectionId, 80);
  const partySize = Math.floor(Number(request.data?.partySize || 0));
  const leadGuestName = text(request.data?.leadGuestName, 120);
  const paymentRecorded = request.data?.paymentRecorded === true || request.data?.paymentRecorded === 1;
  const note = text(request.data?.note, 300);
  if (!clubLocationId || !night || !sectionId) {
    throw new HttpsError("invalid-argument", "clubLocationId, night, and sectionId are required.");
  }
  await requireClubManager(request.auth, clubLocationId);
  const {catalog, section} = resolveSection(clubLocationId, sectionId);
  const nightOverride = catalogNightOverride(catalog, night, sectionId);
  const maxCap = Math.max(1, Math.floor(Number(
    nightOverride?.maxCapacity || section.maxCapacity || 0
  )));
  if (partySize < 1 || partySize > maxCap) {
    throw new HttpsError("invalid-argument", `Party size must be between 1 and ${maxCap}.`);
  }
  const amounts = computePartyAmounts(section, partySize, {
    nightOverride,
    currency: catalog.currency || nightOverride?.currency
  });
  const vipSettings = await loadVipSettings(clubLocationId);
  const depositRequired = resolveDepositRequired(vipSettings, amounts);
  if (depositRequired && !paymentRecorded) {
    throw new HttpsError(
      "failed-precondition",
      "Deposit required: record payment (paymentRecorded) before marking this table booked."
    );
  }
  if (!canMarkTableBooked({depositRequired, paymentConfirmed: paymentRecorded || !depositRequired})) {
    throw new HttpsError("failed-precondition", "Cannot mark table booked until deposit is paid.");
  }

  const key = inventoryKey(clubLocationId, night, sectionId);
  const invRef = db.collection("vipInventory").doc(key);
  const reservationRef = db.collection("vipReservations").doc();
  const passToken = newQrToken();
  const now = Date.now();

  await db.runTransaction(async tx => {
    const invSnap = await tx.get(invRef);
    const inv = invSnap.exists ? invSnap.data() || {} : {};
    if (Number(inv.isReserved) === 1 || inv.status === "booked") {
      throw new HttpsError("failed-precondition", "That table is already booked for this night.");
    }
    if (inv.status === "held" && Number(inv.expiresAtMs || 0) > now) {
      throw new HttpsError("failed-precondition", "A patron hold is active. Release it first or wait for expiry.");
    }
    if (inv.status === "blocked") {
      throw new HttpsError("failed-precondition", "Table is blocked. Unblock it first.");
    }
    tx.set(reservationRef, {
      clubLocationId,
      night,
      sectionId,
      sectionLabel: section.label || sectionId,
      venueName: catalog.venueName,
      partySize: amounts.partySize,
      includedGuests: amounts.includedGuests,
      extraGuests: amounts.extraGuests,
      patronUid: "",
      leadGuestName,
      contactEmail: "",
      bookedByType: "clubAdmin",
      bookedByUid: uid,
      adminNote: note,
      status: "confirmed",
      paymentConfirmed: paymentRecorded || !depositRequired ? 1 : 0,
      depositRequired: depositRequired ? 1 : 0,
      amounts: {
        minimumAmountCents: amounts.minimumAmountCents,
        depositCents: amounts.depositCents,
        extraGuestFeeCents: amounts.extraGuestFeeCents,
        extraGuestFeeTotalCents: amounts.extraGuestFeeTotalCents,
        chargedCents: amounts.chargedCents,
        currency: amounts.currency
      },
      qrTokenHash: hashToken(passToken),
      IsCheckedIn: 0,
      IsNoShow: 0,
      IsRefunded: 0,
      confirmedAtMs: now,
      createdAtMs: now,
      updatedAtMs: now
    });
    tx.set(invRef, inventoryBookedPatch({
      reservationId: reservationRef.id,
      now,
      paymentConfirmed: paymentRecorded || !depositRequired ? 1 : 0
    }), {merge: true});
    tableStatus.applyTableBooked(tx, db, {
      clubLocationId,
      night,
      tableNumber: tableNumberFromSection(section, sectionId),
      sectionId,
      sectionLabel: section.label || sectionId,
      reservationId: reservationRef.id,
      now
    });
  });

  return {
    ok: true,
    reservation: publicReservation(reservationRef.id, (await reservationRef.get()).data() || {}, {
      includePassToken: true,
      passToken
    })
  };
});

/**
 * Club Admin: cancel a confirmed reservation, clear Firestore isBooked, and
 * optionally reverse FloqMedia / Club Stripe deposits per refund policy.
 * Club POS / CSV collectors never auto-refund cards here — club handles POS void.
 */
exports.cancelVipReservation = onCall(CALL_OPTS_STRIPE, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const uid = requireAuth(request.auth);
  const reservationId = text(request.data?.reservationId, 120);
  const reason = text(request.data?.reason, 300);
  if (!reservationId) throw new HttpsError("invalid-argument", "reservationId is required.");
  const ref = db.collection("vipReservations").doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Reservation not found.");
  const row = snap.data() || {};
  const clubLocationId = text(row.clubLocationId, 120);
  await requireClubManager(request.auth, clubLocationId);
  if (row.IsCheckedIn === 1 || text(row.status, 40) === "checkedIn") {
    throw new HttpsError("failed-precondition", "Already checked in — cannot cancel.");
  }
  if (text(row.status, 40) === "cancelled") {
    return {ok: true, reservationId, status: "cancelled", alreadyCancelled: 1};
  }

  const vipSettings = await loadVipSettings(clubLocationId);
  let paySettings = {paymentCollector: text(row.paymentCollector, 40) || "floqrStripe"};
  try {
    const {loadClubPaymentSettings} = require("./vip-pos-functions").__vipPosHelpers;
    paySettings = await loadClubPaymentSettings(clubLocationId);
  } catch (_) { /* keep reservation collector */ }

  const processRefundRequested = !(
    request.data?.processRefund === false
    || request.data?.processRefund === 0
    || request.data?.processRefund === "0"
  );
  const forceMode = text(request.data?.refundMode, 20);
  const chargedCents = Math.max(
    0,
    Math.round(Number(row.amounts?.chargedCents || row.amounts?.depositCents || 0))
  );
  const refundPlan = vipPayments.computeVipRefundCents({
    chargedCents,
    night: row.night,
    policy: vipSettings.refundPolicy,
    actor: "club",
    forceMode,
    nowMs: Date.now()
  });
  const stripeCollector = vipPayments.collectorSupportsStripeRefund(
    paySettings.paymentCollector || row.paymentCollector
  );
  const wantsStripeRefund = processRefundRequested
    && stripeCollector
    && Number(row.paymentConfirmed) === 1
    && Number(row.IsRefunded) !== 1
    && refundPlan.refundCents > 0;

  let refundResult = {
    attempted: 0,
    refunded: 0,
    refundCents: 0,
    refundId: "",
    reason: refundPlan.reason,
    collector: paySettings.paymentCollector || row.paymentCollector || "",
    note: ""
  };

  if (processRefundRequested && !stripeCollector) {
    refundResult.note = paySettings.paymentCollector === "clubPos"
      ? "Club POS deposits are not reversed in FLOQR — void/refund on Toast/SpotOn if needed."
      : "No Stripe deposit on this collector — table freed without a card refund.";
  }

  if (wantsStripeRefund) {
    let paymentIntentId = text(row.stripe?.paymentIntentId || row.stripePaymentIntentId, 160);
    let orderId = text(row.serviceOrderId, 160);
    if (!paymentIntentId && orderId) {
      const orderSnap = await db.collection("serviceOrders").doc(orderId).get();
      if (orderSnap.exists) {
        paymentIntentId = text(orderSnap.data()?.stripePaymentIntentId, 160);
      }
    }
    if (!paymentIntentId) {
      refundResult.attempted = 1;
      refundResult.note = "Paid reservation has no Stripe payment intent; table freed without card refund.";
    } else {
      const key = STRIPE_SECRET_KEY.value();
      if (!key) {
        throw new HttpsError("failed-precondition", "Stripe is not configured for VIP refunds.");
      }
      const stripe = new Stripe(key, {apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 20000});
      try {
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundPlan.refundCents,
          reason: "requested_by_customer",
          metadata: {
            floqrAction: "vip_cancel_reservation",
            reservationId,
            clubLocationId,
            night: text(row.night, 20),
            refundReason: refundPlan.reason,
            actorUid: uid
          }
        }, {idempotencyKey: `vip-cancel-refund-${reservationId}`.slice(0, 255)});
        refundResult = {
          attempted: 1,
          refunded: 1,
          refundCents: Math.max(0, Math.round(Number(refund.amount || refundPlan.refundCents))),
          refundId: text(refund.id, 160),
          reason: refundPlan.reason,
          collector: paySettings.paymentCollector || "",
          note: refundPlan.percent < 100
            ? `Partial refund (${refundPlan.percent}%) per venue policy.`
            : "Full deposit refunded via Stripe."
        };
        if (orderId) {
          await db.collection("serviceOrders").doc(orderId).set({
            paymentStatus: "refunded",
            status: "refunded",
            stripeRefundId: refundResult.refundId,
            refundAmountCents: refundResult.refundCents,
            refundStatus: refundPlan.percent >= 100 ? "full" : "partial",
            updatedAtMs: Date.now()
          }, {merge: true});
        }
      } catch (err) {
        console.error("VIP cancel Stripe refund failed", reservationId, err?.message || err);
        throw new HttpsError(
          "failed-precondition",
          `Could not refund Stripe deposit (${err?.message || "stripe_error"}). Table was not cancelled — fix payment then retry, or cancel with processRefund=false.`
        );
      }
    }
  } else if (processRefundRequested && stripeCollector && refundPlan.refundCents <= 0) {
    refundResult.note = `No refund under policy (${refundPlan.reason}). Table will be freed.`;
  }

  const now = Date.now();
  const key = inventoryKey(clubLocationId, row.night, row.sectionId);
  await db.runTransaction(async tx => {
    const patch = {
      status: "cancelled",
      cancelledAtMs: now,
      cancelledByUid: uid,
      cancelReason: reason,
      updatedAtMs: now,
      refundPolicyReason: refundPlan.reason,
      refundRequested: processRefundRequested ? 1 : 0
    };
    if (refundResult.refunded) {
      patch.IsRefunded = 1;
      patch.stripeRefundId = refundResult.refundId;
      patch.refundAmountCents = refundResult.refundCents;
      patch.refundedAtMs = now;
      patch.paymentStatus = "refunded";
    }
    tx.set(ref, patch, {merge: true});
    const invRef = db.collection("vipInventory").doc(key);
    const invSnap = await tx.get(invRef);
    if (invSnap.exists && text(invSnap.data()?.reservationId, 120) === reservationId) {
      tx.set(invRef, {
        status: "available",
        isReserved: 0,
        reservationId: "",
        paymentConfirmed: 0,
        holdId: "",
        holdUid: "",
        expiresAtMs: 0,
        updatedAtMs: now
      }, {merge: true});
    }
    // Always clear Firestore isBooked on cancel (booking-status control).
    tableStatus.applyTableAvailable(tx, db, {
      clubLocationId,
      night: row.night,
      tableNumber: resolveTableNumber(row),
      sectionId: row.sectionId,
      sectionLabel: row.sectionLabel,
      now
    });
  });
  return {
    ok: true,
    reservationId,
    status: "cancelled",
    isBooked: "0",
    refund: refundResult,
    refundPolicy: refundPlan.policy
  };
});

/**
 * List per-table Firestore status for a night (doc id = table number, isBooked "1"|"0").
 * Club Admin / Master Admin.
 */
exports.listVipTables = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const night = validateNight(request.data?.night);
  if (!clubLocationId || !night) {
    throw new HttpsError("invalid-argument", "clubLocationId and night are required.");
  }
  await requireClubManager(request.auth, clubLocationId);
  const tables = await tableStatus.listTablesForNight(db, clubLocationId, night);
  return {clubLocationId, night, tables};
});

/**
 * Seed / refresh table docs for an onboarded VIP club (upcoming nights).
 * Doc path: clubLocations/{id}/vipNights/{night}/tables/{tableNumber}
 */
exports.ensureVipTables = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubManager(request.auth, clubLocationId);
  const venue = betaVenue(clubLocationId);
  if (!venue || venue.pending) {
    throw new HttpsError("failed-precondition", "Club is not VIP-onboarded / bookable yet.");
  }
  const catalog = betaCatalog[clubLocationId];
  if (!catalog?.sections?.length) {
    throw new HttpsError("failed-precondition", "No floor-plan sections for this club.");
  }
  const nightCount = Math.min(30, Math.max(1, Math.floor(Number(request.data?.nights || 14))));
  const results = await tableStatus.ensureUpcomingNights(db, {
    clubLocationId,
    sections: catalog.sections,
    nights: nightCount
  });
  return {
    ok: true,
    clubLocationId,
    nightsEnsured: results.length,
    tablesPerNight: catalog.sections.length,
    path: `clubLocations/${clubLocationId}/vipNights/{night}/tables/{tableNumber}`
  };
});

/**
 * Scheduled: expire holds past expiresAtMs and free vipInventory (table available).
 * Complements lazy cleanup in getVipAvailability / createVipHold.
 */
exports.expireVipHolds = onSchedule({
  region: "us-central1",
  schedule: "every 5 minutes",
  timeZone: "UTC",
  timeoutSeconds: 120,
  memory: "256MiB"
}, async () => {
  const now = Date.now();
  const snap = await db.collection("vipHolds")
    .where("expiresAtMs", "<=", now)
    .limit(150)
    .get();
  let expired = 0;
  for (const doc of snap.docs) {
    const row = doc.data() || {};
    if (!["active", "pendingPayment"].includes(text(row.status, 40))) continue;
    try {
      await expireHoldRow(doc.id, row, now);
      expired += 1;
    } catch (err) {
      console.warn("expireVipHolds", doc.id, err?.message || err);
    }
  }
  console.log("expireVipHolds", {scanned: snap.size, expired, atMs: now});
  return {scanned: snap.size, expired};
});

exports.__vipHelpers = {
  runCreateVipHold,
  runRecordVipConsent,
  runConfirmVipReservationWithoutDeposit,
  fulfillVipReservationOrder,
  resolveSection,
  publicHold,
  publicReservation,
  loadVipSettings,
  inventoryBookedPatch,
  resolveTableNumber,
  expireHoldRow,
  BETA_TERMS,
  core,
  tableStatus
};
