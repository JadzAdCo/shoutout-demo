/**
 * Mask one-time codes and bearer tokens before anything reaches a stored log row.
 * Covers SOS2FA / WhatsApp / SMS six-digit codes, 8-character email OTP codes
 * (alphabet from createOtpCode in ai-discovery-functions.js), and any token that
 * follows a "code" / "OTP" / "passcode" / "recovery code" label.
 */
"use strict";

const MASK = "••••••";
const OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SIX_DIGITS = /\b\d{6}\b/g;
const EMAIL_OTP_TOKEN = /\b[A-HJ-NP-Z2-9]{8}\b/g;
const BEARER = /\bBearer\s+\S+/gi;
const LABELLED_CODE = /\b(code|passcode|otp|pin)\b((?:\s*(?:is|:|=|#|-))*\s*(?:<[^>]{0,80}>\s*)*)([A-Za-z0-9][A-Za-z0-9_-]{3,63})/gi;

function looksLikeCode(token) {
  return /\d/.test(token) || /^[A-Z0-9_-]{4,}$/.test(token);
}

function redactSecrets(value) {
  return String(value == null ? "" : value)
    .replace(BEARER, "Bearer [redacted]")
    .replace(LABELLED_CODE, (match, label, sep, token) => (looksLikeCode(token) ? `${label}${sep}${MASK}` : match))
    .replace(EMAIL_OTP_TOKEN, MASK)
    .replace(SIX_DIGITS, MASK);
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
  plainPreview
};
