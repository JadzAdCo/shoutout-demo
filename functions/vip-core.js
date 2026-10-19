/* VIP reserV Phase 2 — pure helpers (holds, pricing, nights, consent).
   Design: .cursor/rules/design-notes-vip-reservations.mdc
   Aurelia (temp-democlub-1) planFile aurelia.json — bookable as of s3.1.50. */
"use strict";

const crypto = require("crypto");

const HOLD_MS = 30 * 60 * 1000;
const BETA_TERMS = Object.freeze({
  termsDocId: "vip-beta-terms-v2",
  termsVersion: "2",
  termsSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  title: "VIP reserV Terms of use (beta — counsel publishes Live Terms)"
});

/** Single patron checkbox on vip-terms.html; server expands to full audit checks. */
const REQUIRED_CONSENT_CHECKS = Object.freeze(["terms"]);

/** Stored on vipConsents for refund / door / counsel audit (all true when Terms accepted). */
const EXPANDED_CONSENT_CHECKS = Object.freeze([
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
    name: "Aurelia (Demo Club)",
    planFile: "aurelia.json",
    city: "New York",
    pending: false,
    clubCode: "AUR",
    explore3dUrl: "./reports/vip-aurelia-demo/"
  }
]);

function text(value, max = 120) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function inventoryKey(clubLocationId, night, sectionId) {
  return `${text(clubLocationId, 120)}_${text(night, 20)}_${text(sectionId, 80)}`;
}

/**
 * Printed table number / label used as Firestore doc id under
 * clubLocations/{club}/vipNights/{night}/tables/{tableNumber}.
 * Prefer plan `label` (e.g. "12", "C1"); fall back to section id tail.
 */
function tableNumberFromSection(section = {}, sectionId = "") {
  const label = text(section.label || section.tableNumber || section.number, 40);
  if (label) return sanitizeTableNumberKey(label);
  const id = text(section.id || sectionId, 80);
  const tail = id.includes("-") ? id.split("-").pop() : id;
  return sanitizeTableNumberKey(tail || id || "unknown");
}

function sanitizeTableNumberKey(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\/\\#?[\]*]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 40) || "unknown";
}

/** Canonical string datapoint: "1" booked, "0" free. Also accepts yes/no when reading. */
function normalizeIsBooked(value) {
  if (value === true || value === 1 || value === "1" || String(value).toLowerCase() === "yes") return "1";
  return "0";
}

function isTableBookedValue(value) {
  return normalizeIsBooked(value) === "1";
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

/**
 * Club deposit policy (VIP-B-05). When deposit is required, inventory
 * `isReserved=1` / status `booked` is allowed only after payment (or an
 * explicit admin-recorded payment). Holds stay amber (`held`, isReserved=0).
 */
function normalizeVipSettings(raw = {}) {
  const row = raw && typeof raw === "object" ? raw : {};
  const hasExplicit = Object.prototype.hasOwnProperty.call(row, "depositRequired");
  let depositRequired = 1;
  if (hasExplicit) {
    depositRequired = row.depositRequired === 0 || row.depositRequired === false || row.depositRequired === "0"
      ? 0
      : 1;
  }
  let refundPolicy = {};
  try {
    const payments = require("./vip-payments-core");
    refundPolicy = payments.normalizeRefundPolicy(row.refundPolicy || row);
  } catch (_) {
    refundPolicy = {
      allowStripeRefund: 1,
      clubCancelRefundMode: "full",
      fullRefundHoursBeforeNight: 24,
      partialRefundHoursBeforeNight: 4,
      partialRefundPercent: 50
    };
  }
  return {
    depositRequired,
    depositRequiredExplicit: hasExplicit ? 1 : 0,
    refundPolicy
  };
}

/** Resolve whether this booking needs a paid deposit before the table shows booked. */
function resolveDepositRequired(vipSettings = {}, amounts = {}) {
  const settings = normalizeVipSettings(vipSettings);
  if (settings.depositRequiredExplicit) return settings.depositRequired === 1;
  return Number(amounts.depositCents || amounts.chargedCents || 0) > 0;
}

/**
 * Hard gate for marking a table booked/unavailable on the floor map.
 * paymentConfirmed = Stripe fulfillment or admin-recorded payment.
 */
function canMarkTableBooked({depositRequired, paymentConfirmed} = {}) {
  if (!depositRequired) return true;
  return paymentConfirmed === true || paymentConfirmed === 1 || paymentConfirmed === "1";
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

/** Expand one Terms acceptance into the full audit checklist (marketing stays optional). */
function expandConsentChecks(checks = {}) {
  const out = {};
  EXPANDED_CONSENT_CHECKS.forEach(key => { out[key] = true; });
  out.marketing = checks.marketing === true;
  return out;
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
  EXPANDED_CONSENT_CHECKS,
  BETA_VENUES,
  text,
  inventoryKey,
  tableNumberFromSection,
  sanitizeTableNumberKey,
  normalizeIsBooked,
  isTableBookedValue,
  demoPricesForSection,
  computePartyAmounts,
  normalizeVipSettings,
  resolveDepositRequired,
  canMarkTableBooked,
  upcomingNights,
  validateNight,
  betaVenue,
  hashToken,
  newQrToken,
  consentChecksComplete,
  expandConsentChecks,
  holdExpiresAtMs,
  sectionFromPlan
};
