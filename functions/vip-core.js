/* VIP ReserV Phase 2 — pure helpers (holds, pricing, nights, consent).
   Design: .cursor/rules/design-notes-vip-reservations.mdc */
"use strict";

const crypto = require("crypto");

const HOLD_MS = 30 * 60 * 1000;
const BETA_TERMS = Object.freeze({
  termsDocId: "vip-beta-terms-v1",
  termsVersion: "1",
  termsSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  title: "VIP ReserV beta Terms (placeholder — counsel publishes Live Terms)"
});

const REQUIRED_CONSENT_CHECKS = Object.freeze([
  "terms",
  "refund",
  "noShow",
  "age21",
  "minimumSpend"
]);

/** Beta venues with static plan files under vip-plans/. */
const BETA_VENUES = Object.freeze([
  {
    id: "decades-washington-dc",
    name: "Decades",
    planFile: "decades.json",
    city: "Washington, DC",
    clubCode: "DEC"
  },
  {
    id: "lima-twist-washington-dc",
    name: "Lima Twist Club",
    planFile: "lima-twist.json",
    city: "Washington, DC",
    clubCode: "LIM"
  },
  {
    id: "temp-democlub-1",
    name: "Aurelia",
    planFile: null,
    city: "Washington, DC",
    pending: true,
    clubCode: "AUR"
  }
]);

function text(value, max = 120) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function inventoryKey(clubLocationId, night, sectionId) {
  return `${text(clubLocationId, 120)}_${text(night, 20)}_${text(sectionId, 80)}`;
}

/** Demo pricing until Club Admin publishes real minimums/deposits (plan JSON placeholders). */
function demoPricesForSection(section = {}) {
  const type = text(section.type, 40);
  const maxCapacity = Math.max(1, Math.floor(Number(section.maxCapacity || 4)));
  const includedGuests = Math.max(1, Math.min(maxCapacity, Math.floor(Number(section.includedGuests || maxCapacity))));
  const fromPlanMin = Number(section.minimumAmount?.amountCents);
  const fromPlanExtra = Number(section.extraGuestFee?.amountCents);
  const fromPlanDeposit = Number(section.deposit?.amountCents);
  const minimumAmountCents = Number.isFinite(fromPlanMin) && fromPlanMin > 0
    ? Math.round(fromPlanMin)
    : (type === "vipTable" ? 100000 : maxCapacity >= 6 ? 50000 : maxCapacity >= 4 ? 30000 : 15000);
  const extraGuestFeeCents = Number.isFinite(fromPlanExtra) && fromPlanExtra >= 0
    ? Math.round(fromPlanExtra)
    : (section.extraGuestFee ? (type === "vipTable" ? 5000 : 4000) : 0);
  const depositCents = Number.isFinite(fromPlanDeposit) && fromPlanDeposit > 0
    ? Math.round(fromPlanDeposit)
    : Math.round(minimumAmountCents * 0.25);
  return {minimumAmountCents, extraGuestFeeCents, depositCents, includedGuests, maxCapacity};
}

function computePartyAmounts(section, partySize) {
  const prices = demoPricesForSection(section);
  const party = Math.max(1, Math.min(prices.maxCapacity, Math.floor(Number(partySize) || 1)));
  const extraGuests = Math.max(0, party - prices.includedGuests);
  const extraGuestFeeTotalCents = extraGuests * prices.extraGuestFeeCents;
  const chargedCents = prices.depositCents + extraGuestFeeTotalCents;
  return {
    ...prices,
    partySize: party,
    extraGuests,
    extraGuestFeeTotalCents,
    chargedCents,
    currency: "USD"
  };
}

function upcomingNights(count = 14, fromMs = Date.now()) {
  const nights = [];
  const start = new Date(fromMs);
  start.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    nights.push(d.toISOString().slice(0, 10));
  }
  return nights;
}

function validateNight(night) {
  const n = text(night, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n)) return "";
  return n;
}

function betaVenue(clubLocationId) {
  return BETA_VENUES.find(v => v.id === text(clubLocationId, 120)) || null;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function newQrToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function consentChecksComplete(checks = {}) {
  return REQUIRED_CONSENT_CHECKS.every(key => checks[key] === true);
}

function holdExpiresAtMs(nowMs = Date.now()) {
  return nowMs + HOLD_MS;
}

function sectionFromPlan(plan, sectionId) {
  const id = text(sectionId, 80);
  if (!plan || !Array.isArray(plan.sections)) return null;
  return plan.sections.find(s => text(s.id, 80) === id) || null;
}

module.exports = {
  HOLD_MS,
  BETA_TERMS,
  REQUIRED_CONSENT_CHECKS,
  BETA_VENUES,
  text,
  inventoryKey,
  demoPricesForSection,
  computePartyAmounts,
  upcomingNights,
  validateNight,
  betaVenue,
  hashToken,
  newQrToken,
  consentChecksComplete,
  holdExpiresAtMs,
  sectionFromPlan
};
