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
  },
  {
    id: "shoko-barcelona-spain",
    name: "Shôko Barcelona",
    planFile: "shoko-barcelona.json",
    city: "Barcelona",
    pending: false,
    clubCode: "SHO",
    currency: "EUR"
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

/**
 * Night-scoped price row from catalog/plan `nightPricing[YYYY-MM-DD].sections[sectionId]`.
 * Used for event packages (e.g. Shôko NYE'27) while regular nights stay placeholders.
 */
function nightPriceOverride(nightPricing, night, sectionId) {
  const n = validateNight(night);
  const sid = text(sectionId, 80);
  if (!n || !sid || !nightPricing || typeof nightPricing !== "object") return null;
  const block = nightPricing[n];
  if (!block || typeof block !== "object") return null;
  const row = (block.sections || {})[sid];
  if (!row || typeof row !== "object") return null;
  return row;
}

/** Demo pricing until Club Admin publishes real minimums/deposits (plan JSON placeholders). */
function demoPricesForSection(section = {}, opts = {}) {
  const type = text(section.type, 40);
  const maxCapacity = Math.max(1, Math.floor(Number(section.maxCapacity || 4)));
  const includedGuests = Math.max(1, Math.min(maxCapacity, Math.floor(Number(section.includedGuests || maxCapacity))));
  const override = opts.nightOverride && typeof opts.nightOverride === "object" ? opts.nightOverride : null;
  if (override) {
    const oMax = Math.max(1, Math.floor(Number(override.maxCapacity || maxCapacity)));
    const oInc = Math.max(1, Math.min(oMax, Math.floor(Number(override.includedGuests || includedGuests))));
    const minimumAmountCents = Math.max(0, Math.round(Number(override.minimumAmountCents || 0)));
    const depositCents = Math.max(0, Math.round(Number(
      override.depositCents != null ? override.depositCents : minimumAmountCents
    )));
    const extraGuestFeeCents = Math.max(0, Math.round(Number(override.extraGuestFeeCents || 0)));
    const currency = text(override.currency || opts.currency || "USD", 8).toUpperCase() || "USD";
    return {minimumAmountCents, extraGuestFeeCents, depositCents, includedGuests: oInc, maxCapacity: oMax, currency};
  }
  const fromPlanMin = Number(section.minimumAmount?.amountCents);
  const fromPlanExtra = Number(section.extraGuestFee?.amountCents);
  const fromPlanDeposit = Number(section.deposit?.amountCents);
  const planCurrency = text(section.minimumAmount?.currency || section.deposit?.currency || opts.currency || "USD", 8).toUpperCase() || "USD";
  const minimumAmountCents = Number.isFinite(fromPlanMin) && fromPlanMin > 0
    ? Math.round(fromPlanMin)
    : (type === "vipTable" || type === "vipArea" ? 100000 : maxCapacity >= 6 ? 50000 : maxCapacity >= 4 ? 30000 : 15000);
  const extraGuestFeeCents = Number.isFinite(fromPlanExtra) && fromPlanExtra >= 0
    ? Math.round(fromPlanExtra)
    : (section.extraGuestFee ? (type === "vipTable" || type === "vipArea" ? 5000 : 4000) : 0);
  const depositCents = Number.isFinite(fromPlanDeposit) && fromPlanDeposit > 0
    ? Math.round(fromPlanDeposit)
    : Math.round(minimumAmountCents * 0.25);
  return {minimumAmountCents, extraGuestFeeCents, depositCents, includedGuests, maxCapacity, currency: planCurrency};
}

function computePartyAmounts(section, partySize, opts = {}) {
  const prices = demoPricesForSection(section, opts);
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
    currency: prices.currency || "USD"
  };
}

/** Merge event / catalog extra nights (e.g. NYE beyond the rolling horizon). */
function mergeExtraBookableNights(bookable = [], extraNights = [], fromDate = new Date()) {
  const out = Array.isArray(bookable) ? bookable.slice() : [];
  const have = new Set(out.map(row => text(row.night || row, 20)));
  const today = localYmd(fromDate);
  (Array.isArray(extraNights) ? extraNights : []).forEach(raw => {
    const night = validateNight(raw);
    if (!night || have.has(night) || night < today) return;
    const d = parseYmdLocal(night);
    const weekday = d
      ? d.toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"})
      : night;
    out.push({night, open: "", close: "", source: "event", label: `${weekday} · event`});
    have.add(night);
  });
  out.sort((a, b) => String(a.night).localeCompare(String(b.night)));
  return out;
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

/** Local YYYY-MM-DD (venue calendar day) — avoids UTC skew near midnight. */
function localYmd(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_KEYS = Object.freeze(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
const DAY_LABELS = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);

function parseYmdLocal(night) {
  const n = validateNight(night);
  if (!n) return null;
  const [y, m, d] = n.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

/**
 * Normalize clubLocations.hoursStructured (sun–sat open/closed + HH:MM).
 * Empty / all-closed → null (caller falls back to consecutive nights).
 */
function normalizeHoursStructured(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  let anyOpen = false;
  DAY_KEYS.forEach(key => {
    const row = src[key] && typeof src[key] === "object" ? src[key] : {};
    const closed = row.closed === true || row.closed === 1 || row.closed === "1"
      || (!row.open && !row.close && row.closed !== false);
    const open = text(row.open, 8);
    const close = text(row.close, 8);
    out[key] = closed || !open || !close
      ? {closed: true, open: "", close: ""}
      : {closed: false, open, close};
    if (!out[key].closed) anyOpen = true;
  });
  return anyOpen ? out : null;
}

function normalizeHoursExceptions(list) {
  if (!Array.isArray(list)) return [];
  return list.map(row => ({
    startDate: validateNight(row.startDate) || text(row.startDate, 12),
    endDate: validateNight(row.endDate || row.startDate) || text(row.endDate || row.startDate, 12),
    closed: row.closed === true || row.closed === 1 || row.closed === "1",
    open: text(row.open, 8),
    close: text(row.close, 8),
    label: text(row.label, 120)
  })).filter(row => row.startDate && row.endDate);
}

/** Effective hours for a VIP night (YYYY-MM-DD) from club schedule datapoints. */
function hoursForNight(club = {}, night) {
  const date = parseYmdLocal(night);
  if (!date) return {closed: true, open: "", close: "", source: "invalid"};
  const key = localYmd(date);
  const exceptions = normalizeHoursExceptions(club.hoursExceptions);
  const ex = exceptions.find(row => key >= row.startDate && key <= row.endDate);
  if (ex) {
    if (ex.closed) {
      return {closed: true, open: "", close: "", source: "exception", label: ex.label || "Closed"};
    }
    return {closed: false, open: ex.open, close: ex.close, source: "exception", label: ex.label || "Special hours"};
  }
  const structured = normalizeHoursStructured(club.hoursStructured || club.openingHours || {});
  if (!structured) {
    // No structured schedule — treat as bookable (legacy venues).
    return {closed: false, open: "", close: "", source: "unstructured", label: DAY_LABELS[date.getDay()]};
  }
  const day = structured[DAY_KEYS[date.getDay()]] || {closed: true, open: "", close: ""};
  return {
    closed: !!day.closed,
    open: day.open || "",
    close: day.close || "",
    source: "default",
    label: DAY_LABELS[date.getDay()]
  };
}

/**
 * Bookable VIP nights from club hoursStructured / hoursExceptions.
 * Returns {night, open, close, label}[]. Falls back to consecutive calendar nights
 * when the club has no structured open days.
 */
function bookableNightsFromClub(club = {}, {count = 14, horizonDays = 60, fromDate = new Date()} = {}) {
  const want = Math.max(1, Math.min(30, Math.floor(Number(count) || 14)));
  const horizon = Math.max(want, Math.min(120, Math.floor(Number(horizonDays) || 60)));
  const structured = normalizeHoursStructured(club.hoursStructured || club.openingHours || {});
  const hasExceptions = normalizeHoursExceptions(club.hoursExceptions).length > 0;
  const enforceSchedule = !!(structured || hasExceptions);
  const out = [];
  const start = new Date(fromDate);
  start.setHours(12, 0, 0, 0);
  for (let i = 0; i < horizon && out.length < want; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    const night = localYmd(d);
    const hours = hoursForNight(club, night);
    if (enforceSchedule && hours.closed) continue;
    const weekday = d.toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"});
    const window = hours.open && hours.close ? ` · ${hours.open}–${hours.close}` : "";
    out.push({
      night,
      open: hours.open || "",
      close: hours.close || "",
      source: hours.source || (enforceSchedule ? "default" : "fallback"),
      label: `${weekday}${window}`
    });
  }
  if (out.length) return out;
  // Fallback: next N calendar days (schedule missing or all closed in horizon).
  return upcomingNights(want).map(night => {
    const d = parseYmdLocal(night);
    const weekday = d
      ? d.toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"})
      : night;
    return {night, open: "", close: "", source: "fallback", label: weekday};
  });
}

function isNightBookable(club = {}, night) {
  const n = validateNight(night);
  if (!n) return false;
  const structured = normalizeHoursStructured(club.hoursStructured || club.openingHours || {});
  if (!structured && !normalizeHoursExceptions(club.hoursExceptions).length) return true;
  return !hoursForNight(club, n).closed;
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
  DAY_KEYS,
  DAY_LABELS,
  text,
  inventoryKey,
  tableNumberFromSection,
  sanitizeTableNumberKey,
  normalizeIsBooked,
  isTableBookedValue,
  demoPricesForSection,
  nightPriceOverride,
  computePartyAmounts,
  mergeExtraBookableNights,
  normalizeVipSettings,
  resolveDepositRequired,
  canMarkTableBooked,
  upcomingNights,
  localYmd,
  normalizeHoursStructured,
  normalizeHoursExceptions,
  hoursForNight,
  bookableNightsFromClub,
  isNightBookable,
  validateNight,
  betaVenue,
  hashToken,
  newQrToken,
  consentChecksComplete,
  expandConsentChecks,
  holdExpiresAtMs,
  sectionFromPlan
};
