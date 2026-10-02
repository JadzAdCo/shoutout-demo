/**
 * SOS2FA delivery helpers — channel selection follows the same user notify
 * flags as schedule / club ops (notifyEmail / notifySms). UI never hardcodes SMS.
 */
"use strict";

const crypto = require("crypto");
const {workerAllowsNotifyChannel} = require("./scheduling-core");

function maskPhoneLast5(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 5) return "";
  const last5 = digits.slice(-5);
  return `SMS ****${last5.slice(0, 1)}-${last5.slice(1)}`;
}

function maskEmail(email = "") {
  const raw = String(email || "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at < 1) return "";
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const lead = local.slice(0, 1).toUpperCase();
  return `email ${lead}***@${domain}`;
}

function resolveSos2faChannels(profile = {}, email = "", phone = "") {
  const hasPhone = !!String(phone || "").trim();
  const hasEmail = !!String(email || "").trim() && String(email).includes("@");
  let sms = hasPhone && workerAllowsNotifyChannel(profile, "sms");
  let mail = hasEmail && workerAllowsNotifyChannel(profile, "email");
  if (!sms && !mail) {
    sms = hasPhone;
    mail = hasEmail;
  }
  return {sms, email: mail};
}

/**
 * Build status notes from channels that actually sent.
 * Optional mailError / smsError append when a selected channel failed.
 */
function formatDeliveryNotes({
  phone = "",
  email = "",
  sms = false,
  mail = false,
  mailError = "",
  smsError = ""
} = {}) {
  const parts = [];
  if (mail) {
    const masked = maskEmail(email);
    if (masked) parts.push(masked);
  }
  if (sms) {
    const masked = maskPhoneLast5(phone);
    if (masked) parts.push(masked);
  }
  const failures = [];
  if (mailError) failures.push(`email not sent (${String(mailError).slice(0, 80)})`);
  if (smsError) failures.push(`SMS not sent (${String(smsError).slice(0, 80)})`);
  if (!parts.length && !failures.length) return "";
  if (!parts.length) return failures.join("; ");
  const delivered = `Delivered / notes: ${parts.join(" / ")}`;
  return failures.length ? `${delivered} — ${failures.join("; ")}` : delivered;
}

const RECOVERY_MIN_LENGTH = 12;
const RECOVERY_MAX_ATTEMPTS = 5;
const RECOVERY_WINDOW_MS = 60 * 60 * 1000;

function recoveryWindowOpen(untilIso = "", nowMs = Date.now()) {
  const untilMs = Date.parse(String(untilIso || ""));
  return Number.isFinite(untilMs) && nowMs < untilMs;
}

function recoveryCodeMatches(secret = "", entered = "") {
  const expected = String(secret || "").trim();
  const actual = String(entered || "").trim();
  if (expected.length < RECOVERY_MIN_LENGTH || !actual) return false;
  const digest = value => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(expected), digest(actual));
}

/** Returns the next throttle row, or null when the uid is locked out for this window. */
function nextRecoveryAttempt(row = {}, nowMs = Date.now()) {
  const start = Number(row.windowStartMs || 0);
  const fresh = !start || nowMs - start >= RECOVERY_WINDOW_MS;
  const count = fresh ? 0 : Number(row.count || 0);
  if (count >= RECOVERY_MAX_ATTEMPTS) return null;
  return {windowStartMs: fresh ? nowMs : start, count: count + 1};
}

module.exports = {
  maskPhoneLast5,
  maskEmail,
  resolveSos2faChannels,
  formatDeliveryNotes,
  RECOVERY_MIN_LENGTH,
  RECOVERY_MAX_ATTEMPTS,
  recoveryWindowOpen,
  recoveryCodeMatches,
  nextRecoveryAttempt
};
