/* BOT DEE research-to-action adapters.
   Existing FLOQR tools (VIP / ShoutOut / floqCast) stay the product path.
   New partner bookings are mock-only until contracts exist.
   PCI: never collect PAN/CVV; hosted checkout only. */
"use strict";

const {isConsequentialTool, stableIdempotencyKey} = require("./botdee-execution");
const {mayCallProvider} = require("./botdee-research");

const ACTION_KINDS = Object.freeze([
  "vip_hold",
  "shoutout_checkout",
  "floqcast_request",
  "restaurant_reservation",
  "ticket_redirect",
  "hotel_referral",
  "rental_referral",
  "save_itinerary"
]);

const EXISTING_FLOQR = Object.freeze({
  vip_hold: {tool: "createVipHold", live: true},
  shoutout_checkout: {tool: "startShoutOutCheckout", live: true},
  floqcast_request: {tool: "createFloqCastRequest", live: true}
});

function actionPlan({kind, providerId, gates, userApproved, quotedTotal, quotedAtMs, nowMs}) {
  const type = ACTION_KINDS.includes(kind) ? kind : "";
  if (!type) return {ok: false, error: "unknown_action"};
  const existing = EXISTING_FLOQR[type];
  const staleMs = 15 * 60 * 1000;
  const now = Number(nowMs) || Date.now();
  const quoted = Number(quotedAtMs) || 0;
  const fresh = !quoted || now - quoted < staleMs;
  if (existing) {
    return {
      ok: true,
      kind: type,
      path: "existing_floqr_tool",
      tool: existing.tool,
      userApprovedRequired: true,
      userApproved: !!userApproved,
      pciCardInFloqr: false,
      hostedCheckoutOnly: true,
      ready: !!userApproved
    };
  }
  const allowed = mayCallProvider(gates, providerId);
  return {
    ok: true,
    kind: type,
    path: allowed ? "partner_adapter" : "mock_only",
    providerId: providerId || "",
    userApprovedRequired: true,
    userApproved: !!userApproved,
    quotedTotal: quotedTotal == null ? null : quotedTotal,
    priceFresh: fresh,
    pciCardInFloqr: false,
    hostedCheckoutOnly: true,
    bookingGuarantee: false,
    ready: false,
    note: allowed
      ? "Partner live path still requires Functions deploy + owner go-ahead."
      : "Partner action is mock-only until legal/provider approval."
  };
}

function confirmPayload({uid, kind, idempotencyParts, userApproved}) {
  if (!userApproved) return {ok: false, error: "approval_required"};
  return {
    ok: true,
    uid: String(uid || "").trim(),
    kind,
    idempotencyKey: stableIdempotencyKey({uid, kind, ...(idempotencyParts || {})}),
    consequential: isConsequentialTool(EXISTING_FLOQR[kind]?.tool) || !EXISTING_FLOQR[kind],
    recordedAtMs: Date.now()
  };
}

module.exports = {
  ACTION_KINDS,
  EXISTING_FLOQR,
  actionPlan,
  confirmPayload
};
