/**
 * Mask one-time codes and bearer tokens before anything reaches a stored log row.
 * Covers SOS2FA / WhatsApp / SMS six-digit codes, 8-character email OTP codes
 * (alphabet from createOtpCode in ai-discovery-functions.js), the 6-character club
 * daily code (generateDailyAuthCode in messaging-core.js, same alphabet), any token
 * after an APPROVE / REJECT ops reply, and any token that follows a "code" / "OTP" /
 * "passcode" / "recovery code" label. Used by mail-log.js and twilio-log.js.
 */
"use strict";

const MASK = "••••••";
const OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TOKEN = /^[A-HJ-NP-Z2-9]{4,10}$/i;
const SIX_DIGITS = /\b\d{6}\b/g;
const EMAIL_OTP_TOKEN = /\b[A-HJ-NP-Z2-9]{8}\b/g;
// Unlabelled club daily code: exactly 6 alphabet chars with at least one letter and one digit,
// so all-caps words (REJECT, STATUS) and plain numbers stay readable.
const CLUB_CODE_TOKEN = /\b(?=[A-HJ-NP-Z]*[2-9])(?=[2-9]*[A-HJ-NP-Z])[A-HJ-NP-Z2-9]{6}\b/g;
const BEARER = /\bBearer\s+\S+/gi;
const LABELLED_CODE = /\b(code|passcode|otp|pin)\b((?:\s*(?:is|:|=|#|-|\([^)\n]{0,24}\)))*\s*(?:<[^>]{0,80}>\s*)*)([A-Za-z0-9][A-Za-z0-9_-]{3,63})/gi;
const OPS_REPLY = /\b(approve|reject)\b(\s*[:=#-]?\s*)([A-Za-z0-9]{4,10})\b/gi;
const OPS_REPLY_YES_NO = /^(\s*(?:yes|no)\b\s*[:=#-]?\s*)([A-Za-z0-9]{4,10})\b/i;
const DEEP_MAX_DEPTH = 8;

function looksLikeCode(token) {
  return /\d/.test(token) || /^[A-Z0-9_-]{4,}$/.test(token);
}

function looksLikeOpsCode(token) {
  return CODE_TOKEN.test(token) && (/\d/.test(token) || token === token.toUpperCase());
}

function redactSecrets(value) {
  return String(value == null ? "" : value)
    .replace(BEARER, "Bearer [redacted]")
    .replace(LABELLED_CODE, (match, label, sep, token) => (looksLikeCode(token) ? `${label}${sep}${MASK}` : match))
    .replace(OPS_REPLY, (match, verb, sep, token) => (looksLikeOpsCode(token) ? `${verb}${sep}${MASK}` : match))
    .replace(OPS_REPLY_YES_NO, (match, lead, token) => (looksLikeOpsCode(token) ? `${lead}${MASK}` : match))
    .replace(EMAIL_OTP_TOKEN, MASK)
    .replace(CLUB_CODE_TOKEN, MASK)
    .replace(SIX_DIGITS, MASK);
}

/** Redact every string leaf of a plain object / array (keys untouched). */
function redactDeep(value, redact = redactSecrets, depth = 0) {
  if (typeof value === "string") return redact(value);
  if (value == null || typeof value !== "object" || depth >= DEEP_MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, redact, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactDeep(item, redact, depth + 1)]));
}

function plainPreview(value, max = 200) {
  const flat = String(value == null ? "" : value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return redactSecrets(flat).slice(0, max);
}

module.exports = {
  MASK,
  OTP_ALPHABET,
  redactSecrets,
  redactDeep,
  plainPreview
};
