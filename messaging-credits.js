/* FLOQR messaging credit packs — client mirror of functions/messaging-credits.js */
(function (global) {
  "use strict";
  const BUNDLE_PRICE_CENTS = 1000;
  const FLOQR_PROFIT_CENTS = 300;
  const TWILIO_BUDGET_CENTS = 700;
  const SMS_UNIT_COST_USD = 0.015;
  const WHATSAPP_UNIT_COST_USD = 0.03;
  const SMS_MESSAGES_PER_PACK = Math.floor(TWILIO_BUDGET_CENTS / 100 / SMS_UNIT_COST_USD);
  const WHATSAPP_MESSAGES_PER_PACK = Math.floor(TWILIO_BUDGET_CENTS / 100 / WHATSAPP_UNIT_COST_USD);

  global.FLOQRMessagingCredits = {
    BUNDLE_PRICE_CENTS,
    FLOQR_PROFIT_CENTS,
    TWILIO_BUDGET_CENTS,
    SMS_UNIT_COST_USD,
    WHATSAPP_UNIT_COST_USD,
    SMS_MESSAGES_PER_PACK,
    WHATSAPP_MESSAGES_PER_PACK,
    useCondition: [
      `Each $10 pack funds $${(TWILIO_BUDGET_CENTS / 100).toFixed(2)} of Twilio delivery capacity; FloqR keeps $${(FLOQR_PROFIT_CENTS / 100).toFixed(2)} as platform profit on the pack.`,
      `SMS pack → ${SMS_MESSAGES_PER_PACK} messages (≈ $${SMS_UNIT_COST_USD.toFixed(3)} all-in US SMS).`,
      `WhatsApp pack → ${WHATSAPP_MESSAGES_PER_PACK} messages (≈ $${WHATSAPP_UNIT_COST_USD.toFixed(3)} Twilio + Meta marketing).`,
      "When balance reaches 0, buy another $10 messaging bundle before sending more campaign messages.",
      "Ops SMS unlock ($10) also grants one SMS pack. WhatsApp service ($10) grants one WhatsApp pack."
    ].join(" ")
  };
})(typeof window !== "undefined" ? window : globalThis);
