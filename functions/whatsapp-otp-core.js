/* FLOQR WhatsApp OTP sign-in — pure helpers (no Firebase).
   Design notes: .cursor/rules/design-notes-whatsapp-otp.mdc */
"use strict";

const crypto = require("crypto");

const CODE_LENGTH = 6;
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const PHONE_WINDOW_MS = 60 * 60 * 1000;
const PHONE_WINDOW_MAX = 5;
const IP_WINDOW_MAX = 12;
const MAX_ATTEMPTS = 5;
const TERMINAL_STATUSES = Object.freeze(["delivered", "read", "failed", "undelivered"]);
const FAILED_STATUSES = Object.freeze(["failed", "undelivered"]);

function normalizeWhatsAppPhone(raw = "") {
  const value = String(raw || "").replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
  if (!value.startsWith("+")) return "";
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : "";
}

function challengeIdFor(phone = "") {
  return crypto.createHash("sha256").update(`floqr-wa-otp:${phone}`).digest("hex");
}

function rateKeyFor(ip = "") {
  return crypto.createHash("sha256").update(`floqr-otp-ip:${String(ip || "unknown")}`).digest("hex");
}

function createNumericCode(length = CODE_LENGTH, randomInt = crypto.randomInt) {
  return String(randomInt(0, 10 ** length)).padStart(length, "0");
}

function hashCode(phone, code, pepper) {
  if (!pepper) throw new Error("OTP pepper missing");
  return crypto.createHmac("sha256", pepper).update(`${phone}:${String(code || "").trim()}`).digest("hex");
}

function codesMatch(expectedHex = "", actualHex = "") {
  if (!expectedHex || !actualHex || expectedHex.length !== actualHex.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(actualHex, "hex"));
}

function isValidCode(code = "") {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(String(code || "").trim());
}

/** Sliding one-hour window + resend cooldown. Returns {allowed, reason, next} with a new window object. */
function evaluateRateWindow(previous = {}, nowMs = Date.now(), {max = PHONE_WINDOW_MAX, cooldownMs = RESEND_COOLDOWN_MS} = {}) {
  const lastMs = Number(previous.lastRequestedMs || 0);
  const windowStart = Number(previous.windowStartMs || 0);
  const inWindow = windowStart && nowMs - windowStart < PHONE_WINDOW_MS;
  const count = inWindow ? Number(previous.windowCount || 0) : 0;
  if (cooldownMs && lastMs && nowMs - lastMs < cooldownMs) {
    return {allowed: false, reason: "cooldown", retryAfterMs: cooldownMs - (nowMs - lastMs), next: previous};
  }
  if (count >= max) {
    return {allowed: false, reason: "hourly-cap", retryAfterMs: PHONE_WINDOW_MS - (nowMs - windowStart), next: previous};
  }
  return {
    allowed: true,
    reason: "",
    retryAfterMs: 0,
    next: {
      lastRequestedMs: nowMs,
      windowStartMs: inWindow ? windowStart : nowMs,
      windowCount: count + 1
    }
  };
}

function buildOtpBody(code) {
  return `Your FLOQR sign-in code is ${code}. It expires in 5 minutes. Do not share this code with anyone.`;
}

/** Twilio Messages API form fields. An approved WhatsApp Authentication template (Content SID HX…) wins over a free-form body. */
function buildTwilioParams({to, from, code, contentSid = ""}) {
  const params = {To: to, From: from};
  const sid = String(contentSid || "").trim();
  if (/^HX[0-9a-f]{32}$/i.test(sid)) {
    params.ContentSid = sid;
    params.ContentVariables = JSON.stringify({1: String(code)});
  } else {
    params.Body = buildOtpBody(code);
  }
  return params;
}

function isTerminalStatus(status = "") {
  return TERMINAL_STATUSES.includes(String(status || "").toLowerCase());
}

function isFailedStatus(status = "") {
  return FAILED_STATUSES.includes(String(status || "").toLowerCase());
}

const WHATSAPP_ERROR_HINTS = {
  "63003": "This number cannot receive WhatsApp messages. Check the number or use another sign-in option.",
  "63007": "FLOQR's WhatsApp sender is not active yet. Use Email or SMS sign-in for now.",
  "63015": "WhatsApp test mode: send the sandbox join word to FLOQR's WhatsApp number first, then request a new code.",
  "63016": "WhatsApp needs an approved sign-in template before FLOQR can send codes. Use Email or SMS sign-in for now.",
  "63024": "WhatsApp rejected this number. Check the country code and number.",
  "63049": "WhatsApp did not deliver this code. Request a new code in a minute.",
  "21211": "That phone number is not valid. Check the country code and number.",
  "21408": "WhatsApp codes are not enabled for this country yet.",
  "21610": "This number opted out of FLOQR messages."
};

function explainWhatsAppError(code = "", fallback = "") {
  const key = String(code || "").replace(/\D/g, "");
  return WHATSAPP_ERROR_HINTS[key] || fallback || "WhatsApp could not deliver the code. Try again or use another sign-in option.";
}

module.exports = {
  CODE_LENGTH,
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  PHONE_WINDOW_MS,
  PHONE_WINDOW_MAX,
  IP_WINDOW_MAX,
  MAX_ATTEMPTS,
  normalizeWhatsAppPhone,
  challengeIdFor,
  rateKeyFor,
  createNumericCode,
  hashCode,
  codesMatch,
  isValidCode,
  evaluateRateWindow,
  buildOtpBody,
  buildTwilioParams,
  isTerminalStatus,
  isFailedStatus,
  explainWhatsAppError
};
