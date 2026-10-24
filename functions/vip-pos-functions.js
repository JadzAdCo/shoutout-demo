/* VIP reserV POS connection + payment collector management (Club POS preferred). */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {__featureServiceHelpers: featureAccess} = require("./feature-services-functions");
const payments = require("./vip-payments-core");
const vipCore = require("./vip-core");
const tableStatus = require("./vip-table-status");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const CALL_OPTS = {region: "us-central1", cors: true};

const {
  text, normalizePaymentSettings, listCollectorsPublic, listProvidersPublic,
  buildVipReservationsCsv, publicBillingStatement, PAYMENT_COLLECTORS, POS_PROVIDERS
} = payments;

function requireAuth(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  return auth.uid;
}

function isMasterAdminAuth(authContext) {
  const claims = authContext?.token || {};
  return !!(claims.masterAdmin || claims.floqrMasterAdmin || claims.admin === true);
}

async function requireMasterAdmin(authContext) {
  requireAuth(authContext);
  if (!isMasterAdminAuth(authContext)) {
    throw new HttpsError("permission-denied", "Master Admin required.");
  }
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
  if (!(await isClubManagerAuth(authContext, clubId))) {
    throw new HttpsError("permission-denied", "Club Admin access required for this venue.");
  }
}

async function loadEnabledProviders() {
  const snap = await db.collection("vipPosProviders").get();
  const map = {};
  snap.docs.forEach(doc => {
    const d = doc.data() || {};
    map[doc.id] = Number(d.IsProviderEnabled) === 0 ? 0 : 1;
  });
  return map;
}

async function loadClubPaymentSettings(clubLocationId) {
  const snap = await db.collection("clubLocations").doc(text(clubLocationId, 120)).get();
  const row = snap.exists ? snap.data() || {} : {};
  const fromVip = row.vipSettings || {};
  const fromPos = row.vipPosConnection || {};
  return normalizePaymentSettings({
    ...fromVip,
    paymentCollector: fromVip.paymentCollector || fromPos.paymentCollector,
    posProvider: fromVip.posProvider || fromPos.provider,
    posMode: fromVip.posMode || fromPos.mode,
    posConnectionState: fromPos.state || fromVip.posConnectionState,
    stripeAccountMode: fromVip.stripeAccountMode
  });
}

async function loadClubStripeReady(clubLocationId) {
  const snap = await db.collection("clubLocations").doc(text(clubLocationId, 120)).get();
  const row = snap.exists ? snap.data() || {} : {};
  const acct = text(row.stripeConnectAccountId || row.stripeAccountId, 120);
  const transfers = row.stripeTransfersActive === true || row.stripeTransfersActive === 1
    || text(row.stripeCapabilityTransfers, 40) === "active";
  return {
    connectedAccountId: acct,
    transfersReady: !!(acct && transfers),
    livemode: row.stripeLivemode === true || row.stripeLivemode === 1
  };
}

/** Catalog for Club / Master Admin pickers (sandbox flags included). */
exports.getVipPaymentCatalog = onCall(CALL_OPTS, async request => {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
  requireAuth(request.auth);
  const enabled = await loadEnabledProviders();
  return {
    brand: "VIP reserV",
    preferredPath: "clubPos",
    preferredBlurb: "FLOQR books, holds, and maps the table. Toast or SpotOn owns deposit, open tab, and spend — one money system.",
    collectors: listCollectorsPublic(),
    providers: listProvidersPublic(enabled),
    sandboxes: Object.values(POS_PROVIDERS)
      .filter(p => p.sandbox)
      .map(p => ({id: p.id, label: p.label, sandboxLabel: p.sandboxLabel}))
  };
});

/** Club Admin: full payment + POS connection settings for this venue. */
exports.getVipPaymentSettings = onCall(CALL_OPTS, async request => {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubManager(request.auth, clubLocationId);
  const settings = await loadClubPaymentSettings(clubLocationId);
  const stripe = await loadClubStripeReady(clubLocationId);
  const enabled = await loadEnabledProviders();
  const connSnap = await db.collection("vipPosConnections").doc(clubLocationId).get();
  const conn = connSnap.exists ? connSnap.data() || {} : {};
  return {
    clubLocationId,
    settings,
    stripe,
    connection: {
      state: text(conn.state || settings.posConnectionState, 40) || "disconnected",
      provider: text(conn.provider || settings.posProvider, 40),
      mode: text(conn.mode || settings.posMode, 20) || "sandbox",
      capabilityLevel: Number(conn.capabilityLevel || 0) || 0,
      mappingComplete: Number(conn.mappingComplete) === 1 ? 1 : 0,
      lastSyncAtMs: Number(conn.lastSyncAtMs || 0) || 0,
      connectionCode: text(conn.connectionCode, 40)
    },
    collectors: listCollectorsPublic(),
    providers: listProvidersPublic(enabled)
  };
});

/** Club Admin: save collector + POS choice (Club POS preferred). */
exports.saveVipPaymentSettings = onCall(CALL_OPTS, async request => {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubManager(request.auth, clubLocationId);

  const next = normalizePaymentSettings({
    paymentCollector: request.data?.paymentCollector,
    posProvider: request.data?.posProvider,
    posMode: request.data?.posMode,
    depositRequired: request.data?.depositRequired,
    stripeAccountMode: request.data?.stripeAccountMode,
    posConnectionState: request.data?.posConnectionState
  });

  if (!PAYMENT_COLLECTORS[next.paymentCollector]) {
    throw new HttpsError("invalid-argument", "Unknown payment collector.");
  }
  if (next.paymentCollector === "clubPos") {
    if (!next.posProvider || !POS_PROVIDERS[next.posProvider]) {
      throw new HttpsError("invalid-argument", "Choose a POS (Toast, SpotOn, Square, Clover, or Generic).");
    }
    const enabled = await loadEnabledProviders();
    if (enabled[next.posProvider] === 0) {
      throw new HttpsError("failed-precondition", `${POS_PROVIDERS[next.posProvider].label} is not enabled by Master Admin yet.`);
    }
  }
  if (next.paymentCollector === "clubStripe") {
    const stripe = await loadClubStripeReady(clubLocationId);
    if (!stripe.transfersReady) {
      throw new HttpsError(
        "failed-precondition",
        "Club Stripe Connect must be ready (transfers active) before choosing Club Stripe as the VIP collector."
      );
    }
  }

  const now = Date.now();
  const uid = request.auth.uid;
  await db.collection("clubLocations").doc(clubLocationId).set({
    vipSettings: {
      depositRequired: next.depositRequired,
      paymentCollector: next.paymentCollector,
      posProvider: next.posProvider,
      posMode: next.posMode,
      stripeAccountMode: next.stripeAccountMode,
      updatedAtMs: now,
      updatedByUid: uid
    },
    updatedAtMs: now
  }, {merge: true});

  if (next.paymentCollector === "clubPos") {
    const connRef = db.collection("vipPosConnections").doc(clubLocationId);
    const prev = await connRef.get();
    const prevState = prev.exists ? text(prev.data()?.state, 40) : "";
    await connRef.set({
      clubLocationId,
      provider: next.posProvider,
      mode: next.posMode || "sandbox",
      paymentCollector: "clubPos",
      state: prevState && prevState !== "revoked" ? prevState : "disconnected",
      updatedAtMs: now,
      updatedByUid: uid
    }, {merge: true});
  }

  return {ok: true, clubLocationId, settings: next};
});

/**
 * Begin POS connect (sandbox or live).
 * Toast: issues connection code. Square/Clover/SpotOn: returns OAuth scaffold URL placeholder.
 * Real OAuth token exchange ships when partner credentials are provisioned.
 */
exports.beginVipPosConnect = onCall(CALL_OPTS, async request => {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const providerId = text(request.data?.posProvider || request.data?.provider, 40);
  const mode = text(request.data?.posMode || request.data?.mode, 20) === "live" ? "live" : "sandbox";
  if (!clubLocationId || !providerId) {
    throw new HttpsError("invalid-argument", "clubLocationId and posProvider are required.");
  }
  await requireClubManager(request.auth, clubLocationId);
  const provider = POS_PROVIDERS[providerId];
  if (!provider) throw new HttpsError("invalid-argument", "Unknown POS provider.");
  if (providerId === "generic") {
    throw new HttpsError("failed-precondition", "Generic POS uses CSV export — no live connect.");
  }
  const enabled = await loadEnabledProviders();
  if (enabled[providerId] === 0) {
    throw new HttpsError("failed-precondition", `${provider.label} is not enabled by Master Admin.`);
  }
  if (mode === "sandbox" && !provider.sandbox) {
    throw new HttpsError("failed-precondition", `${provider.label} has no published sandbox — use live after partner approval.`);
  }

  const now = Date.now();
  const code = `FLOQR-${clubLocationId.slice(0, 8).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await db.collection("vipPosConnections").doc(clubLocationId).set({
    clubLocationId,
    provider: providerId,
    mode,
    paymentCollector: "clubPos",
    state: "oauth_pending",
    connectionCode: provider.connectType === "partnerGrant" ? code : "",
    capabilityLevel: 0,
    mappingComplete: 0,
    updatedAtMs: now,
    updatedByUid: request.auth.uid
  }, {merge: true});
  await db.collection("clubLocations").doc(clubLocationId).set({
    vipSettings: {
      paymentCollector: "clubPos",
      posProvider: providerId,
      posMode: mode,
      updatedAtMs: now
    }
  }, {merge: true});

  return {
    ok: true,
    clubLocationId,
    provider: providerId,
    mode,
    connectType: provider.connectType,
    sandbox: mode === "sandbox",
    sandboxLabel: provider.sandboxLabel || "",
    connectionCode: provider.connectType === "partnerGrant" ? code : "",
    authorizeUrl: "", // filled when partner OAuth app credentials are configured
    nextSteps: provider.connectHint,
    statusMessage: mode === "sandbox"
      ? `${provider.label} sandbox connection started. Complete the steps below, then mark Connected.`
      : `${provider.label} live connection started. Complete partner steps, then mark Connected.`
  };
});

/** Club Admin confirms POS link after Toast paste / OAuth return (pre-credential phase). */
exports.confirmVipPosConnected = onCall(CALL_OPTS, async request => {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubManager(request.auth, clubLocationId);
  const connRef = db.collection("vipPosConnections").doc(clubLocationId);
  const snap = await connRef.get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Start Connect first.");
  const conn = snap.data() || {};
  const provider = POS_PROVIDERS[text(conn.provider, 40)];
  if (!provider) throw new HttpsError("failed-precondition", "Unknown provider on connection.");
  const now = Date.now();
  const level = Math.min(2, Number(provider.capabilityLevelMax || 0));
  await connRef.set({
    state: "connected",
    capabilityLevel: level,
    connectedAtMs: now,
    updatedAtMs: now,
    updatedByUid: request.auth.uid,
    note: "Connected (workflow). Live webhook adapters activate when partner credentials are deployed."
  }, {merge: true});
  return {
    ok: true,
    state: "connected",
    capabilityLevel: level,
    blurb: provider.openTabOnTable
      ? "Connected. FLOQR will book/hold/map; your POS owns the tab, deposit, and spend once webhooks are live."
      : "Connected for sales sync. Floor-plan open-tab is not available on this provider’s public API."
  };
});

exports.disconnectVipPos = onCall(CALL_OPTS, async request => {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubManager(request.auth, clubLocationId);
  const now = Date.now();
  await db.collection("vipPosConnections").doc(clubLocationId).set({
    state: "revoked",
    revokedAtMs: now,
    updatedAtMs: now,
    updatedByUid: request.auth.uid,
    connectionCode: ""
  }, {merge: true});
  return {ok: true, state: "revoked"};
});

/** CSV export for manualCsv / Generic reconciliation. */
exports.exportVipReservationsCsv = onCall(CALL_OPTS, async request => {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const night = text(request.data?.night, 20);
  if (!clubLocationId || !/^\d{4}-\d{2}-\d{2}$/.test(night)) {
    throw new HttpsError("invalid-argument", "clubLocationId and night (YYYY-MM-DD) are required.");
  }
  await requireClubManager(request.auth, clubLocationId);
  const snap = await db.collection("vipReservations")
    .where("clubLocationId", "==", clubLocationId)
    .where("night", "==", night)
    .limit(200)
    .get();
  const rows = snap.docs.map(doc => ({reservationId: doc.id, ...(doc.data() || {})}));
  const csv = buildVipReservationsCsv(rows);
  return {
    clubLocationId,
    night,
    filename: `vip-reserv-${clubLocationId}-${night}.csv`,
    rowCount: rows.length,
    csv
  };
});

/** Club + Master: VIP billing / fee statements (Model B + FloqR Stripe settlements). */
exports.listVipBillingStatements = onCall(CALL_OPTS, async request => {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
  requireAuth(request.auth);
  const clubLocationId = text(request.data?.clubLocationId, 120);
  const network = request.data?.network === true;
  if (network) {
    await requireMasterAdmin(request.auth);
    const snap = await db.collection("vipPosStatements").orderBy("issuedAtMs", "desc").limit(50).get();
    return {
      scope: "network",
      statements: snap.docs.map(d => publicBillingStatement(d.id, d.data() || {}))
    };
  }
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  await requireClubManager(request.auth, clubLocationId);
  const snap = await db.collection("vipPosStatements")
    .where("clubLocationId", "==", clubLocationId)
    .limit(24)
    .get();
  const statements = snap.docs
    .map(d => publicBillingStatement(d.id, d.data() || {}))
    .sort((a, b) => (b.issuedAtMs || 0) - (a.issuedAtMs || 0));
  return {scope: "club", clubLocationId, statements};
});

/** Master Admin: enable/disable a POS provider platform-wide. */
exports.setVipPosProviderEnabled = onCall(CALL_OPTS, async request => {
  await requireMasterAdmin(request.auth);
  const providerId = text(request.data?.provider || request.data?.posProvider, 40);
  if (!POS_PROVIDERS[providerId]) throw new HttpsError("invalid-argument", "Unknown provider.");
  const enabled = request.data?.enabled === 0 || request.data?.enabled === false ? 0 : 1;
  const now = Date.now();
  await db.collection("vipPosProviders").doc(providerId).set({
    provider: providerId,
    label: POS_PROVIDERS[providerId].label,
    IsProviderEnabled: enabled,
    sandbox: POS_PROVIDERS[providerId].sandbox ? 1 : 0,
    preferredForClubPos: POS_PROVIDERS[providerId].preferredForClubPos ? 1 : 0,
    updatedAtMs: now,
    updatedByUid: request.auth.uid
  }, {merge: true});
  return {ok: true, provider: providerId, IsProviderEnabled: enabled};
});

/** Master Admin: seed default provider rows (Toast/SpotOn preferred). */
exports.seedVipPosProviders = onCall(CALL_OPTS, async request => {
  await requireMasterAdmin(request.auth);
  const now = Date.now();
  const batch = db.batch();
  Object.values(POS_PROVIDERS).forEach(p => {
    batch.set(db.collection("vipPosProviders").doc(p.id), {
      provider: p.id,
      label: p.label,
      IsProviderEnabled: 1,
      sandbox: p.sandbox ? 1 : 0,
      preferredForClubPos: p.preferredForClubPos ? 1 : 0,
      programStatus: p.openApi ? "sandbox" : "notApplied",
      updatedAtMs: now,
      updatedByUid: request.auth.uid
    }, {merge: true});
  });
  await batch.commit();
  return {ok: true, providers: listProvidersPublic(await loadEnabledProviders())};
});

/**
 * Club POS path: FLOQR confirms the reservation after Terms; POS owns deposit/tab/spend.
 * Inventory marks booked so the map shows reserved; paymentConfirmed stays 0 until POS webhook (later).
 */
async function runConfirmVipReservationForClubPos(request) {
  await featureAccess.assertFeatureAccess(request.auth, "vipReservations", request);
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
  const clubLocationId = text(hold.clubLocationId, 120);
  const paySettings = await loadClubPaymentSettings(clubLocationId);
  if (paySettings.paymentCollector !== "clubPos") {
    throw new HttpsError("failed-precondition", "This venue is not on Club POS collection.");
  }
  const connSnap = await db.collection("vipPosConnections").doc(clubLocationId).get();
  const conn = connSnap.exists ? connSnap.data() || {} : {};
  if (text(conn.state, 40) !== "connected") {
    throw new HttpsError(
      "failed-precondition",
      "Club Admin must Connect the POS (sandbox or live) before patrons can confirm for POS payment."
    );
  }

  const {hashToken, newQrToken, BETA_TERMS} = vipCore;
  const now = Date.now();
  const passToken = newQrToken();
  const reservationRef = db.collection("vipReservations").doc();
  const invRef = db.collection("vipInventory").doc(text(hold.inventoryKey, 200));
  const provider = text(conn.provider || paySettings.posProvider, 40);

  await db.runTransaction(async tx => {
    tx.set(reservationRef, {
      clubLocationId,
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
      paymentCollector: "clubPos",
      posProvider: provider,
      posPaymentPending: 1,
      depositRequired: 1,
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
    tx.set(invRef, {
      status: "booked",
      isReserved: 1,
      reservationId: reservationRef.id,
      paymentConfirmed: 0,
      paymentCollector: "clubPos",
      holdId: "",
      holdUid: "",
      expiresAtMs: 0,
      updatedAtMs: now
    }, {merge: true});
    const tableNumber = vipCore.tableNumberFromSection(
      {label: hold.sectionLabel},
      hold.sectionId
    );
    tableStatus.applyTableBooked(tx, db, {
      clubLocationId,
      night: hold.night,
      tableNumber,
      sectionId: hold.sectionId,
      sectionLabel: hold.sectionLabel,
      reservationId: reservationRef.id,
      now
    });
    tx.delete(db.collection("vipActiveHolds").doc(`${uid}_${text(hold.night, 20)}`));
  });

  return {
    ok: true,
    paymentCollector: "clubPos",
    posProvider: provider,
    message: "Table reserved on FLOQR. Pay the deposit on the venue POS when you are seated — tab and spend stay on the POS.",
    reservationId: reservationRef.id,
    passToken
  };
}

exports.confirmVipReservationForClubPos = onCall(CALL_OPTS, runConfirmVipReservationForClubPos);

exports.__vipPosHelpers = {
  loadClubPaymentSettings,
  loadClubStripeReady,
  normalizePaymentSettings,
  runConfirmVipReservationForClubPos,
  payments
};
