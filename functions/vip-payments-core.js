/* VIP reserV payment collectors + POS provider catalog (VIP-B-01 / POS design).
   Preferred path: Club POS — FLOQR books/holds/maps; POS owns deposit, tab, spend. */
"use strict";

const PAYMENT_COLLECTORS = Object.freeze({
  clubPos: {
    id: "clubPos",
    label: "Club POS",
    preferred: true,
    summary: "FLOQR books, holds, and maps the table. Your POS opens the tab, takes the deposit, and records spend — one system for money.",
    requiresPosConnection: true,
    requiresClubStripe: false,
    usesFloqrStripe: false
  },
  clubStripe: {
    id: "clubStripe",
    label: "Club Stripe",
    preferred: false,
    summary: "Patrons pay deposits on the club’s own Stripe Connect account. FLOQR still manages holds and the floor map.",
    requiresPosConnection: false,
    requiresClubStripe: true,
    usesFloqrStripe: false
  },
  floqrStripe: {
    id: "floqrStripe",
    label: "FloqMedia Stripe (FloqR)",
    preferred: false,
    summary: "Patrons pay deposits on FloqMedia’s Stripe. Club share / Model B fees settle through FLOQR billing.",
    requiresPosConnection: false,
    requiresClubStripe: false,
    usesFloqrStripe: true
  },
  manualCsv: {
    id: "manualCsv",
    label: "VIP reserV engine + CSV export",
    preferred: false,
    summary: "FLOQR runs reservations end-to-end. Export CSV nights for your POS or accounting — no live POS API.",
    requiresPosConnection: false,
    requiresClubStripe: false,
    usesFloqrStripe: false,
    isFallback: true
  }
});

/** Covered POS technologies — sandbox notes from reports/vip-pos-integrations.md */
const POS_PROVIDERS = Object.freeze({
  toast: {
    id: "toast",
    label: "Toast",
    sandbox: true,
    sandboxLabel: "Toast sandbox (partner / custom credentials)",
    connectType: "partnerGrant",
    openApi: false,
    realtimeSales: true,
    openTabOnTable: true,
    reservationApi: false,
    seatOpensTicket: true,
    preferredForClubPos: true,
    capabilityLevelMax: 2,
    docsUrl: "https://doc.toasttab.com/",
    connectHint: "Master Admin enables Toast, then the club adds FLOQR under Toast Web → Integrations and pastes the connection code."
  },
  spoton: {
    id: "spoton",
    label: "SpotOn",
    sandbox: true,
    sandboxLabel: "SpotOn partner sandbox (after intake)",
    connectType: "oauth",
    openApi: false,
    realtimeSales: true,
    openTabOnTable: true,
    reservationApi: true,
    seatOpensTicket: true,
    preferredForClubPos: true,
    capabilityLevelMax: 2,
    docsUrl: "https://developer.spoton.com/",
    connectHint: "Partner intake required. After enablement: Sign In With SpotOn, then Activate Location so seating opens a POS ticket."
  },
  square: {
    id: "square",
    label: "Square",
    sandbox: true,
    sandboxLabel: "Square sandbox (squareupsandbox.com) — self-serve",
    connectType: "oauth",
    openApi: true,
    realtimeSales: true,
    openTabOnTable: false,
    reservationApi: false,
    seatOpensTicket: false,
    preferredForClubPos: false,
    capabilityLevelMax: 1,
    docsUrl: "https://developer.squareup.com/",
    connectHint: "Club Admin connects with Square OAuth. Public API syncs paid checks (sales); it cannot open a floor-plan table tab."
  },
  clover: {
    id: "clover",
    label: "Clover",
    sandbox: true,
    sandboxLabel: "Clover sandbox (apisandbox.dev.clover.com)",
    connectType: "oauth",
    openApi: true,
    realtimeSales: true,
    openTabOnTable: false,
    reservationApi: false,
    seatOpensTicket: false,
    preferredForClubPos: false,
    capabilityLevelMax: 1,
    docsUrl: "https://docs.clover.com/",
    connectHint: "Install the FLOQR app from Clover App Market (sandbox first). Open orders work on Register, not Dining table map."
  },
  generic: {
    id: "generic",
    label: "Generic / other POS",
    sandbox: false,
    sandboxLabel: "",
    connectType: "none",
    openApi: false,
    realtimeSales: false,
    openTabOnTable: false,
    reservationApi: false,
    seatOpensTicket: false,
    preferredForClubPos: false,
    capabilityLevelMax: 0,
    docsUrl: "",
    connectHint: "Use VIP reserV engine + CSV export for reconciliation with any POS or accounting system."
  }
});

function text(value, max = 120) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function normalizePaymentSettings(raw = {}) {
  const row = raw && typeof raw === "object" ? raw : {};
  const collectorId = text(row.paymentCollector || row.collector, 40);
  const collector = PAYMENT_COLLECTORS[collectorId] ? collectorId : "floqrStripe";
  const providerId = text(row.posProvider || row.provider, 40);
  const posProvider = POS_PROVIDERS[providerId] ? providerId : "";
  const mode = text(row.posMode || row.mode, 20);
  const posMode = mode === "live" ? "live" : "sandbox";
  const depositRequired = row.depositRequired === 0 || row.depositRequired === false || row.depositRequired === "0"
    ? 0
    : 1;
  return {
    paymentCollector: collector,
    posProvider: collector === "clubPos" ? (posProvider || "toast") : (posProvider || ""),
    posMode: collector === "clubPos" ? posMode : "",
    posConnectionState: text(row.posConnectionState || row.connectionState, 40) || "disconnected",
    depositRequired,
    stripeAccountMode: collector === "clubStripe" ? "club" : (collector === "floqrStripe" ? "floqr" : text(row.stripeAccountMode, 20)),
    updatedAtMs: Number(row.updatedAtMs || 0) || 0
  };
}

function listCollectorsPublic() {
  return Object.values(PAYMENT_COLLECTORS).map(c => ({
    id: c.id,
    label: c.label,
    preferred: !!c.preferred,
    summary: c.summary,
    requiresPosConnection: !!c.requiresPosConnection,
    requiresClubStripe: !!c.requiresClubStripe,
    usesFloqrStripe: !!c.usesFloqrStripe,
    isFallback: !!c.isFallback
  }));
}

function listProvidersPublic(enabledMap = {}) {
  return Object.values(POS_PROVIDERS).map(p => ({
    id: p.id,
    label: p.label,
    sandbox: !!p.sandbox,
    sandboxLabel: p.sandboxLabel || "",
    connectType: p.connectType,
    openApi: !!p.openApi,
    realtimeSales: !!p.realtimeSales,
    openTabOnTable: !!p.openTabOnTable,
    reservationApi: !!p.reservationApi,
    seatOpensTicket: !!p.seatOpensTicket,
    preferredForClubPos: !!p.preferredForClubPos,
    capabilityLevelMax: p.capabilityLevelMax,
    docsUrl: p.docsUrl || "",
    connectHint: p.connectHint || "",
    IsProviderEnabled: enabledMap[p.id] === 0 ? 0 : 1
  }));
}

function csvEscape(value) {
  const s = String(value == null ? "" : value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Night export for Generic / manual reconciliation (L0). */
function buildVipReservationsCsv(rows = []) {
  const header = [
    "reservationId", "night", "sectionId", "sectionLabel", "venueName",
    "partySize", "status", "leadGuestName", "paymentConfirmed", "depositRequired",
    "chargedCents", "currency", "confirmedAtMs", "bookedByType"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const amounts = r.amounts || {};
    lines.push([
      r.reservationId || r.id || "",
      r.night || "",
      r.sectionId || "",
      r.sectionLabel || "",
      r.venueName || "",
      r.partySize || "",
      r.status || "",
      r.leadGuestName || "",
      Number(r.paymentConfirmed) === 1 ? 1 : 0,
      Number(r.depositRequired) === 0 ? 0 : 1,
      amounts.chargedCents || 0,
      amounts.currency || "USD",
      r.confirmedAtMs || "",
      r.bookedByType || ""
    ].map(csvEscape).join(","));
  }
  return lines.join("\n") + "\n";
}

function publicBillingStatement(id, row = {}) {
  return {
    statementId: id,
    clubLocationId: row.clubLocationId || "",
    period: row.period || "",
    state: row.state || "draft",
    collector: row.collector || "",
    currency: row.currency || "USD",
    feeBasisCents: Number(row.feeBasisCents || 0) || 0,
    feeCents: Number(row.feeCents || 0) || 0,
    depositTotalCents: Number(row.depositTotalCents || 0) || 0,
    inVenueSpendCents: Number(row.inVenueSpendCents || 0) || 0,
    stripeInvoiceId: row.stripeInvoiceId || "",
    issuedAtMs: Number(row.issuedAtMs || 0) || 0,
    lineCount: Array.isArray(row.lines) ? row.lines.length : Number(row.lineCount || 0) || 0
  };
}

/** Collectors where FLOQR can reverse a card deposit via Stripe.refunds.create. */
const STRIPE_REFUND_COLLECTORS = Object.freeze(new Set(["floqrStripe", "clubStripe"]));

/**
 * Club VIP cancel / refund policy (hours before night UTC midnight).
 * Club Admin cancel defaults to full refund for Stripe collectors (product lock).
 * Patron / policy mode uses the hours windows.
 */
function normalizeRefundPolicy(raw = {}) {
  const row = raw && typeof raw === "object" ? raw : {};
  const mode = text(row.clubCancelRefundMode || row.cancelRefundMode, 20);
  const clubCancelRefundMode = ["full", "policy", "none"].includes(mode) ? mode : "full";
  const fullH = Number(row.fullRefundHoursBeforeNight ?? row.fullRefundHoursBefore);
  const partialH = Number(row.partialRefundHoursBeforeNight ?? row.partialRefundHoursBefore);
  const partialPct = Number(row.partialRefundPercent);
  return {
    allowStripeRefund: row.allowStripeRefund === 0 || row.allowStripeRefund === false || row.allowStripeRefund === "0"
      ? 0
      : 1,
    clubCancelRefundMode,
    fullRefundHoursBeforeNight: Number.isFinite(fullH) ? Math.max(0, Math.round(fullH)) : 24,
    partialRefundHoursBeforeNight: Number.isFinite(partialH) ? Math.max(0, Math.round(partialH)) : 4,
    partialRefundPercent: Number.isFinite(partialPct)
      ? Math.max(0, Math.min(100, Math.round(partialPct)))
      : 50
  };
}

function collectorSupportsStripeRefund(collectorId) {
  return STRIPE_REFUND_COLLECTORS.has(text(collectorId, 40));
}

/**
 * Compute refund cents for a VIP cancel.
 * @param {object} opts
 * @param {number} opts.chargedCents
 * @param {string} opts.night YYYY-MM-DD
 * @param {object} [opts.policy]
 * @param {"club"|"patron"} [opts.actor]
 * @param {"full"|"policy"|"none"} [opts.forceMode] request override
 * @param {number} [opts.nowMs]
 */
function computeVipRefundCents({
  chargedCents = 0,
  night = "",
  policy = {},
  actor = "club",
  forceMode = "",
  nowMs = Date.now()
} = {}) {
  const charged = Math.max(0, Math.round(Number(chargedCents) || 0));
  const pol = normalizeRefundPolicy(policy);
  if (!charged) {
    return {refundCents: 0, percent: 0, reason: "no_charge", policy: pol};
  }
  if (!pol.allowStripeRefund) {
    return {refundCents: 0, percent: 0, reason: "refunds_disabled", policy: pol};
  }
  const modeRaw = text(forceMode, 20);
  const mode = ["full", "policy", "none"].includes(modeRaw)
    ? modeRaw
    : (actor === "club" ? pol.clubCancelRefundMode : "policy");
  if (mode === "none") {
    return {refundCents: 0, percent: 0, reason: "mode_none", policy: pol};
  }
  if (mode === "full") {
    return {refundCents: charged, percent: 100, reason: "full_refund", policy: pol};
  }
  const nightKey = text(night, 20);
  const nightStart = /^\d{4}-\d{2}-\d{2}$/.test(nightKey)
    ? Date.parse(`${nightKey}T00:00:00.000Z`)
    : NaN;
  const hoursBefore = Number.isFinite(nightStart) ? (nightStart - nowMs) / 3600000 : 0;
  if (hoursBefore >= pol.fullRefundHoursBeforeNight) {
    return {refundCents: charged, percent: 100, reason: "full_window", policy: pol, hoursBefore};
  }
  if (hoursBefore >= pol.partialRefundHoursBeforeNight) {
    const pct = pol.partialRefundPercent;
    return {
      refundCents: Math.round(charged * pct / 100),
      percent: pct,
      reason: "partial_window",
      policy: pol,
      hoursBefore
    };
  }
  return {refundCents: 0, percent: 0, reason: "inside_cutoff", policy: pol, hoursBefore};
}

module.exports = {
  PAYMENT_COLLECTORS,
  POS_PROVIDERS,
  STRIPE_REFUND_COLLECTORS,
  text,
  normalizePaymentSettings,
  normalizeRefundPolicy,
  collectorSupportsStripeRefund,
  computeVipRefundCents,
  listCollectorsPublic,
  listProvidersPublic,
  buildVipReservationsCsv,
  publicBillingStatement
};
