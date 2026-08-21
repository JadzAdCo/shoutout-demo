/**
 * SOS2FA delivery helpers — channel selection follows the same user notify
 * flags as schedule / club ops (notifyEmail / notifySms). UI never hardcodes SMS.
 */
"use strict";

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

function formatDeliveryNotes({phone = "", email = "", sms = false, mail = false} = {}) {
  const parts = [];
  if (mail) {
    const masked = maskEmail(email);
    if (masked) parts.push(masked);
  }
  if (sms) {
    const masked = maskPhoneLast5(phone);
    if (masked) parts.push(masked);
  }
  if (!parts.length) return "";
  return `Delivered / notes: ${parts.join(" / ")}`;
}

module.exports = {
  maskPhoneLast5,
  maskEmail,
  resolveSos2faChannels,
  formatDeliveryNotes
};
