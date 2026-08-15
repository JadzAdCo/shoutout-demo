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

function sanitizeTwilioSecret(raw = "") {
  return String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r|\n/g, "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
}

function describeTwilioAccountSid(raw = "") {
  const sid = sanitizeTwilioSecret(raw);
  const prefix = sid.slice(0, 2).toUpperCase();
  return {
    prefix,
    length: sid.length,
    looksLikeAccountSid: /^AC[0-9a-f]{32}$/i.test(sid),
    looksLikeApiKey: /^SK[0-9a-f]{32}$/i.test(sid),
    looksLikeMessagingService: /^MG[0-9a-f]{32}$/i.test(sid),
    looksLikeAuthToken: /^[0-9a-f]{32}$/i.test(sid)
  };
}

function twilioCredentialHealth(creds = {}) {
  const sidInfo = describeTwilioAccountSid(creds.accountSid);
  const token = sanitizeTwilioSecret(creds.authToken);
  return {
    accountSidPrefix: sidInfo.prefix,
    accountSidLength: sidInfo.length,
    looksLikeAccountSid: sidInfo.looksLikeAccountSid,
    looksLikeApiKey: sidInfo.looksLikeApiKey,
    looksLikeMessagingService: sidInfo.looksLikeMessagingService,
    authTokenLength: token.length,
    fromNumberSet: !!sanitizeTwilioSecret(creds.fromNumber),
    whatsappFromSet: !!sanitizeTwilioSecret(creds.whatsappFrom)
  };
}

function explainTwilioDeliveryError(message = "", sidInfo = {}) {
  const info = sidInfo && typeof sidInfo === "object" ? sidInfo : describeTwilioAccountSid("");
  if (info.looksLikeApiKey) {
    return "TWILIO_ACCOUNT_SID is an API Key (SK…). Set it to the Account SID that starts with AC (34 characters) from console.twilio.com. Keep the Auth Token in TWILIO_AUTH_TOKEN.";
  }
  if (info.looksLikeMessagingService) {
    return "TWILIO_ACCOUNT_SID is a Messaging Service SID (MG…). Use the Account SID that starts with AC.";
  }
  if (info.length && !info.looksLikeAccountSid) {
    return "TWILIO_ACCOUNT_SID must be the Account SID starting with AC (34 characters). Do not paste the Auth Token or an API Key into that Firebase secret.";
  }
  const text = String(message || "").trim();
  if (/authentication error|invalid username|20003/i.test(text)) {
    return "Twilio rejected the Account SID (Authentication Error - invalid username). In Firebase Secret Manager, TWILIO_ACCOUNT_SID must start with AC and be 34 characters. Do not paste the Auth Token or an API Key (SK).";
  }
  return text;
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

function flagOn(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

/** Channels the club wants for an alert. Overlay (test checkboxes) wins when provided. */
function selectedClubAlertChannels(settings = {}, overlay = null) {
  const src = overlay && typeof overlay === "object" ? overlay : settings;
  const fromOverlay = overlay && typeof overlay === "object";
  return {
    inApp: flagOn(src.inApp) || flagOn(src.notifyInApp),
    push: flagOn(src.push) || flagOn(src.notifyPush),
    email: flagOn(src.email) || flagOn(src.notifyEmail) || flagOn(src.emailEnabled),
    sms: fromOverlay ? flagOn(src.sms) || flagOn(src.notifySms) : channelAlertOn(settings, "sms"),
    whatsapp: fromOverlay ? flagOn(src.whatsapp) || flagOn(src.notifyWhatsapp) : channelAlertOn(settings, "whatsapp")
  };
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
  sanitizeTwilioSecret,
  describeTwilioAccountSid,
  twilioCredentialHealth,
  explainTwilioDeliveryError,
  channelAlertOn,
  describeOutboundSkip,
  selectedClubAlertChannels,
  selectOutboundTargets
};
