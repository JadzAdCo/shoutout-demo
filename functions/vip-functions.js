/* VIP ReserV — Phase 1 foundations (feature gate + stubs).
   Full booking / holds / Stripe land in Phase 2. Design: .cursor/rules/design-notes-vip-reservations.mdc */
"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {assertFeatureAccess} = require("./feature-services-functions");

const CALL_OPTS = {region: "us-central1", cors: true};

function text(value, max = 120) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

/** Phase 1: confirm feature access + return beta venue plan hints (static publish). */
exports.getVipBetaVenues = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations");
  return {
    phase: 1,
    brand: "VIP ReserV",
    venues: [
      {id: "decades-washington-dc", name: "Decades", planFile: "decades.json", city: "Washington, DC"},
      {id: "lima-twist-washington-dc", name: "Lima Twist Club", planFile: "lima-twist.json", city: "Washington, DC"},
      {id: "temp-democlub-1", name: "Aurelia", planFile: null, city: "Washington, DC", pending: true}
    ]
  };
});

/** Phase 1 stub — real holds in Phase 2. */
exports.createVipHold = onCall(CALL_OPTS, async request => {
  await assertFeatureAccess(request.auth, "vipReservations");
  const sectionId = text(request.data?.sectionId, 80);
  if (!sectionId) throw new HttpsError("invalid-argument", "Pick a table section.");
  throw new HttpsError(
    "failed-precondition",
    "VIP ReserV table holds open in Phase 2. Floor maps are available now for beta venues."
  );
});
