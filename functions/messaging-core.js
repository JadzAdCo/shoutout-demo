/* FLOQR SMS / WhatsApp messaging core — pure helpers (no Firebase). */
"use strict";

const CHANNELS = Object.freeze(["sms", "whatsapp"]);

function normalizeE164(raw = "") {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : "";
  const only = digits.replace(/\D/g, "");
  if (only.length === 10) return `+1${only}`;
  if (only.length === 11 && only.startsWith("1")) return `+${only}`;
  return only.length >= 8 && only.length <= 15 ? `+${only}` : "";
}

function normalizeChannelPreference(raw = "sms") {
  const value = String(raw || "sms").trim().toLowerCase();
  if (value === "whatsapp" || value === "wa") return "whatsapp";
  if (value === "both" || value === "all") return "both";
  return "sms";
}

function channelsForPreference(preference = "sms") {
  const pref = normalizeChannelPreference(preference);
  if (pref === "both") return ["sms", "whatsapp"];
  if (pref === "whatsapp") return ["whatsapp"];
  return ["sms"];
}

function clubDayKey(date = new Date(), timeZone = "America/New_York") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  } catch (error) {
    return date.toISOString().slice(0, 10);
  }
}

function generateDailyAuthCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const size = Math.max(4, Math.min(10, Number(length) || 6));
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function hashDailyAuthCode(code, pepper = "") {
  const crypto = require("crypto");
  return crypto.createHash("sha256")
    .update(`${String(pepper || "")}:${String(code || "").trim().toUpperCase()}`)
    .digest("hex");
}

function parseOpsReply(body = "") {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  const upper = text.toUpperCase();
  const match = upper.match(/\b(APPROVE|REJECT|YES|NO)\b(?:\s*[:=\-]?\s*)([A-Z0-9]{4,10})?\b/);
  if (!match) {
    const codeOnly = upper.match(/\b([A-Z0-9]{4,10})\b/);
    return {
      action: null,
      code: codeOnly ? codeOnly[1] : "",
      raw: text
    };
  }
  const token = match[1];
  const action = (token === "APPROVE" || token === "YES") ? "approve"
    : (token === "REJECT" || token === "NO") ? "reject"
      : null;
  return {
    action,
    code: String(match[2] || "").toUpperCase(),
    raw: text
  };
}

function buildPendingShoutoutMessage({
  clubName = "your club",
  mainText = "",
  referenceNumber = "",
  shoutoutId = "",
  previewUrl = ""
} = {}) {
  const snippet = String(mainText || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const ref = referenceNumber || shoutoutId || "pending";
  const lines = [
    `FloqR: ShoutOut pending at ${clubName}.`,
    snippet ? `"${snippet}"` : null,
    `Ref ${ref}.`,
    "Reply APPROVE {today's club code} or REJECT {code}.",
    previewUrl ? `Preview: ${previewUrl}` : null
  ].filter(Boolean);
  return lines.join(" ");
}

function twilioWhatsAppAddress(e164 = "") {
  const phone = normalizeE164(e164);
  return phone ? `whatsapp:${phone}` : "";
}

function channelAlertOn(settings = {}, channel = "sms") {
  const enabledKey = channel === "whatsapp" ? "whatsappEnabled" : "smsEnabled";
  const notifyKey = channel === "whatsapp" ? "notifyWhatsapp" : "notifySms";
  const requestedKey = channel === "whatsapp" ? "whatsappRequested" : "smsRequested";
  const subscribedKey = channel === "whatsapp" ? "whatsappSubscribed" : "smsSubscribed";
  const paidKey = channel === "whatsapp" ? "whatsappPaidAt" : "smsPaidAt";
  if (settings[enabledKey] === true || settings[notifyKey] === true) return true;
  if (settings[enabledKey] === false) return false;
  return settings[requestedKey] !== false && !!(settings[subscribedKey] || settings[paidKey]);
}

function describeOutboundSkip(settings = {}) {
  const phone = normalizeE164(settings.alertPhone || settings.smsPhone || settings.phone || "");
  if (!phone) return "missing-phone";
  const smsOn = channelAlertOn(settings, "sms");
  const waOn = channelAlertOn(settings, "whatsapp");
  if (!smsOn && !waOn) return "channels-paused";
  return "";
}

/** Resolve SMS/WhatsApp targets from clubNotificationSettings. Paid subscription is stored separately; alerts follow smsEnabled / whatsappEnabled, with a legacy fallback when those flags were never written after payment. */
function selectOutboundTargets(settings = {}) {
  const phone = normalizeE164(settings.alertPhone || settings.smsPhone || settings.phone || "");
  if (!phone) return [];
  const smsOn = channelAlertOn(settings, "sms");
  const waOn = channelAlertOn(settings, "whatsapp");
  if (!smsOn && !waOn) return [];
  let pref = normalizeChannelPreference(settings.channelPreference || "");
  if (!settings.channelPreference) {
    if (smsOn && waOn) pref = "both";
    else if (waOn) pref = "whatsapp";
    else pref = "sms";
  }
  return channelsForPreference(pref)
    .filter(channel => (channel === "sms" && smsOn) || (channel === "whatsapp" && waOn))
    .map(channel => ({channel, to: phone}));
}

module.exports = {
  CHANNELS,
  normalizeE164,
  normalizeChannelPreference,
  channelsForPreference,
  clubDayKey,
  generateDailyAuthCode,
  hashDailyAuthCode,
  parseOpsReply,
  buildPendingShoutoutMessage,
  twilioWhatsAppAddress,
  channelAlertOn,
  describeOutboundSkip,
  selectOutboundTargets
};
