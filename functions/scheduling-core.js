/* FLOQR staff-scheduling helpers — status + notify (no Firebase). */
"use strict";

const DEFAULT_ORIGIN = "https://jadzadco.github.io/shoutout-demo";

function text(value = "", max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function normalizeShiftStatus(raw = "") {
  const status = text(raw, 40).toLowerCase();
  if (status === "approved") return "confirmed";
  return status || "";
}

function publishedShiftStatus({asDraft = false, assigneeUid = ""} = {}) {
  if (asDraft) return "draft";
  return text(assigneeUid, 160) ? "pending" : "draft";
}

function canDeleteShiftStatus(raw = "") {
  return ["draft", "pending", "confirmed", "approved", "declined"].includes(normalizeShiftStatus(raw) || text(raw, 40).toLowerCase());
}

function sanitizeShiftIds(raw = [], max = 80) {
  const seen = new Set();
  const ids = [];
  (Array.isArray(raw) ? raw : []).forEach(value => {
    const id = text(value, 120);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  const cap = Number.isFinite(Number(max)) ? Math.max(1, Math.min(80, Number(max))) : 80;
  return ids.slice(0, cap);
}

function workerAllowsNotifyChannel(user = {}, channel = "") {
  const row = user && typeof user === "object" ? user : {};
  const privacy = row.privacy && typeof row.privacy === "object" ? row.privacy : {};
  const key = text(channel, 20).toLowerCase();
  const explicit = {
    inapp: row.notifyInApp ?? privacy.notifyInApp,
    email: row.notifyEmail ?? row.emailNotifications ?? privacy.notifyEmail,
    sms: row.notifySms ?? row.smsNotifications ?? privacy.notifySms,
    whatsapp: row.notifyWhatsapp ?? row.whatsappNotifications ?? privacy.notifyWhatsapp,
    push: row.notifyPush ?? privacy.notifyPush
  }[key === "in-app" ? "inapp" : key];
  if (explicit === false || explicit === 0 || explicit === "0") return false;
  return true;
}

function clubAllowsNotifyChannel(settings = {}, channel = "") {
  const key = text(channel, 20).toLowerCase();
  if (key === "sms") return settings.smsEnabled !== false && (settings.smsSubscribed || settings.smsPaidAt || settings.smsEnabled === true || settings.notifySms === true);
  if (key === "whatsapp") return settings.whatsappEnabled === true || settings.notifyWhatsapp === true;
  if (key === "email") return settings.emailEnabled !== false && settings.notifyEmail !== false;
  if (key === "inapp" || key === "in-app") return settings.notifyInApp !== false;
  return true;
}

function shiftApproveUrl(shift = {}, origin = DEFAULT_ORIGIN) {
  const base = String(origin || DEFAULT_ORIGIN).replace(/\/$/, "");
  const url = new URL(`${base}/scheduling.html`);
  if (shift.id) url.searchParams.set("shift", String(shift.id));
  if (shift.ownerKey) url.searchParams.set("owner", String(shift.ownerKey));
  url.searchParams.set("from", "schedule-notify");
  url.searchParams.set("v", "29.09.114");
  return url.toString();
}

function buildShiftInviteBody(shift = {}, origin = DEFAULT_ORIGIN) {
  const when = [shift.startsAtLabel, shift.endsAtLabel].filter(Boolean).join(" – ");
  const role = shift.roleLabel || shift.role || "Shift";
  const club = shift.ownerName || shift.venueName || "FLOQR";
  const link = shiftApproveUrl(shift, origin);
  return text(
    `${club} schedule: ${role}${when ? ` ${when}` : ""}. Confirm or decline this shift: ${link}`,
    900
  );
}

module.exports = {
  DEFAULT_ORIGIN,
  normalizeShiftStatus,
  publishedShiftStatus,
  canDeleteShiftStatus,
  sanitizeShiftIds,
  workerAllowsNotifyChannel,
  clubAllowsNotifyChannel,
  shiftApproveUrl,
  buildShiftInviteBody
};
