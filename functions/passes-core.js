"use strict";

const crypto = require("crypto");

const PASS_KINDS = Object.freeze(["vipReservation", "guestEntry", "promoterClient"]);
const PASS_STATUSES = Object.freeze(["active", "checkedIn", "void", "expired"]);
const SHARE_CHANNELS = Object.freeze(["inbox", "email", "sms", "whatsapp"]);

function text(v, max = 200) {
  return String(v == null ? "" : v).trim().slice(0, max);
}

function newPassId() {
  return "pass_" + crypto.randomBytes(10).toString("hex");
}

function newQrToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function passPublicUrl(token, origin = "https://jadzadco.github.io/shoutout-demo") {
  const t = text(token, 200);
  if (!t) return "";
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/pass.html?t=${encodeURIComponent(t)}`;
}

function publicPass(id, row, extras = {}) {
  const out = {
    passId: id,
    kind: text(row.kind, 40),
    status: text(row.status, 40),
    clubLocationId: text(row.clubLocationId, 120),
    venueName: text(row.venueName, 160),
    night: text(row.night, 40),
    label: text(row.label, 160),
    guestName: text(row.guestName, 120),
    guestPhone: text(row.guestPhone, 40),
    guestEmail: text(row.guestEmail, 160),
    patronUid: text(row.patronUid, 120),
    issuedByUid: text(row.issuedByUid, 120),
    issuedByRole: text(row.issuedByRole, 40),
    promoterId: text(row.promoterId, 120),
    sourceReservationId: text(row.sourceReservationId, 120),
    createdAtMs: Number(row.createdAtMs || 0) || 0,
    checkedInAtMs: Number(row.checkedInAtMs || 0) || 0,
    beta: true
  };
  if (extras.includePassToken && extras.passToken) {
    out.passToken = String(extras.passToken);
    out.passUrl = extras.passUrl || passPublicUrl(extras.passToken, extras.origin);
  }
  return out;
}

function normalizeChannel(ch) {
  const c = text(ch, 40).toLowerCase();
  return SHARE_CHANNELS.includes(c) ? c : "";
}

function normalizeKind(kind) {
  const k = text(kind, 40);
  return PASS_KINDS.includes(k) ? k : "";
}

module.exports = {
  PASS_KINDS,
  PASS_STATUSES,
  SHARE_CHANNELS,
  text,
  newPassId,
  newQrToken,
  hashToken,
  passPublicUrl,
  publicPass,
  normalizeChannel,
  normalizeKind
};
