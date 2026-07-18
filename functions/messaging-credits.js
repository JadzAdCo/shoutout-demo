/* FLOQR messaging credit packs — $10 purchase, $7 Twilio budget, $3 FloqR profit. */
"use strict";

/** Bundle economics (stated use condition for service patrons). */
const BUNDLE_PRICE_CENTS = 1000; // $10.00
const FLOQR_PROFIT_CENTS = 300; // $3.00 platform margin per pack
const TWILIO_BUDGET_CENTS = 700; // $7.00 outbound capacity

/**
 * Unit costs used for allotment (conservative US outbound estimates).
 * SMS: Twilio ~$0.0083/segment + carrier fees ≈ $0.015 all-in short text.
 * WhatsApp marketing: Twilio ~$0.005 + Meta US marketing template ≈ $0.030.
 */
const SMS_UNIT_COST_USD = 0.015;
const WHATSAPP_UNIT_COST_USD = 0.03;

const SMS_MESSAGES_PER_PACK = Math.floor(TWILIO_BUDGET_CENTS / 100 / SMS_UNIT_COST_USD); // 466
const WHATSAPP_MESSAGES_PER_PACK = Math.floor(TWILIO_BUDGET_CENTS / 100 / WHATSAPP_UNIT_COST_USD); // 233

const PACKS = {
  sms: {
    channel: "sms",
    orderTypes: ["smsNotifications", "smsMessageBundle"],
    priceCents: BUNDLE_PRICE_CENTS,
    floqrProfitCents: FLOQR_PROFIT_CENTS,
    twilioBudgetCents: TWILIO_BUDGET_CENTS,
    unitCostUsd: SMS_UNIT_COST_USD,
    messagesPerPack: SMS_MESSAGES_PER_PACK,
    itemName: "SMS messaging pack ($10)",
    description: `Adds ${SMS_MESSAGES_PER_PACK} SMS credits (~$${SMS_UNIT_COST_USD.toFixed(3)} Twilio all-in). FloqR keeps $${(FLOQR_PROFIT_CENTS / 100).toFixed(2)}; $${(TWILIO_BUDGET_CENTS / 100).toFixed(2)} funds delivery.`
  },
  whatsapp: {
    channel: "whatsapp",
    orderTypes: ["whatsappNotifications", "whatsappMessageBundle"],
    priceCents: BUNDLE_PRICE_CENTS,
    floqrProfitCents: FLOQR_PROFIT_CENTS,
    twilioBudgetCents: TWILIO_BUDGET_CENTS,
    unitCostUsd: WHATSAPP_UNIT_COST_USD,
    messagesPerPack: WHATSAPP_MESSAGES_PER_PACK,
    itemName: "WhatsApp messaging pack ($10)",
    description: `Adds ${WHATSAPP_MESSAGES_PER_PACK} WhatsApp credits (~$${WHATSAPP_UNIT_COST_USD.toFixed(3)} Twilio+Meta marketing). FloqR keeps $${(FLOQR_PROFIT_CENTS / 100).toFixed(2)}; $${(TWILIO_BUDGET_CENTS / 100).toFixed(2)} funds delivery.`
  }
};

function packForOrderType(orderType) {
  const type = String(orderType || "").trim();
  if (PACKS.sms.orderTypes.includes(type)) return PACKS.sms;
  if (PACKS.whatsapp.orderTypes.includes(type)) return PACKS.whatsapp;
  return null;
}

function creditField(channel) {
  return channel === "whatsapp" ? "whatsappBalance" : "smsBalance";
}

function purchasedField(channel) {
  return channel === "whatsapp" ? "whatsappPurchasedTotal" : "smsPurchasedTotal";
}

module.exports = {
  BUNDLE_PRICE_CENTS,
  FLOQR_PROFIT_CENTS,
  TWILIO_BUDGET_CENTS,
  SMS_UNIT_COST_USD,
  WHATSAPP_UNIT_COST_USD,
  SMS_MESSAGES_PER_PACK,
  WHATSAPP_MESSAGES_PER_PACK,
  PACKS,
  packForOrderType,
  creditField,
  purchasedField
};
