/* FLOQR in-app ads — pure helpers (pricing, validation, media sniffing, intake parsing, invoices).
   Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc */
"use strict";

const crypto = require("crypto");

const PLACEMENTS = Object.freeze(["inline", "minglGist"]);
const RUN_DAY_OPTIONS = Object.freeze([7, 14, 21, 31]);
const PRICE_TABLE_CENTS = Object.freeze({
  inline: Object.freeze({7: 4500, 14: 8500, 21: 12000, 31: 17000}),
  minglGist: Object.freeze({7: 2500, 14: 4500, 21: 6500, 31: 9000})
});
const PAYMENT_MODES = Object.freeze(["payg", "subscription", "invoice"]);
const POSTER_TYPES = Object.freeze([
  "club", "promoter", "promotionGroup", "dj", "mediaCreator", "serviceMember", "business", "floqq", "thirdParty"
]);
const STATUSES = Object.freeze([
  "awaiting_payment", "pending_approval", "active", "paused", "rejected", "expired", "cancelled"
]);
const SERVABLE_STATUSES = Object.freeze(["active", "live"]);
const PAID_STATUSES = Object.freeze(["paid", "invoiced", "waived"]);
const GENDERS = Object.freeze(["any", "female", "male", "nonbinary"]);

const MAX_VIDEO_SECONDS = 30;
const VIDEO_SECONDS_TOLERANCE = 0.5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const IMAGE_TYPES = Object.freeze(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_TYPES = Object.freeze(["video/mp4", "video/quicktime", "video/3gpp"]);
const INTAKE_TTL_MS = 72 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function isPlacement(value) {
  return PLACEMENTS.includes(value);
}

function priceFor(placementType, runDays) {
  const table = PRICE_TABLE_CENTS[placementType];
  const days = Number(runDays);
  if (!table || !table[days]) return 0;
  return table[days];
}

function cleanList(value, maxItems, maxLen) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[,\n]/);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const v = text(item, maxLen);
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= maxItems) break;
  }
  return out;
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeDemographics(input = {}) {
  const src = input && typeof input === "object" ? input : {};
  let ageMin = clampInt(src.ageMin, 18, 99, 18);
  let ageMax = clampInt(src.ageMax, 18, 99, 99);
  if (ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  const genders = cleanList(src.genders, 4, 20).map(g => g.toLowerCase()).filter(g => GENDERS.includes(g));
  return {
    ageMin,
    ageMax,
    genders: genders.length && !genders.includes("any") ? genders : ["any"],
    cities: cleanList(src.cities, 10, 80),
    countries: cleanList(src.countries, 10, 80),
    interests: cleanList(src.interests, 20, 60),
    musicGenres: cleanList(src.musicGenres, 20, 60),
    notes: text(src.notes, 400)
  };
}

/** Turn demographics into the scorer's match tags (ad-campaigns.js reads `datapoints`). */
function demographicsToDatapoints(demo = {}) {
  const d = normalizeDemographics(demo);
  return [...d.cities, ...d.countries, ...d.interests, ...d.musicGenres]
    .map(v => v.toLowerCase())
    .slice(0, 40);
}

function isHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validateCampaignInput(input = {}, {requireMedia = true} = {}) {
  const src = input && typeof input === "object" ? input : {};
  const errors = [];
  const title = text(src.title, 80);
  if (!title) errors.push("Add a headline.");
  const placementType = text(src.placementType, 20) || "inline";
  if (!isPlacement(placementType)) errors.push("Pick Inline or Mingl Gist.");
  const runDays = Number(src.runDays || 7);
  if (!RUN_DAY_OPTIONS.includes(runDays)) errors.push("Run length must be 7, 14, 21 or 31 days.");
  const paymentMode = text(src.paymentMode, 20) || "payg";
  if (!PAYMENT_MODES.includes(paymentMode)) errors.push("Pick a payment mode.");
  const creativeType = text(src.creativeType, 10) || "image";
  if (!["image", "video"].includes(creativeType)) errors.push("The ad must be an image or a video.");
  const mediaUrl = text(src.mediaUrl, 1200);
  if (requireMedia && !isHttpsUrl(mediaUrl)) errors.push("Upload a flyer image or a video.");
  const ctaUrl = text(src.ctaUrl, 600);
  if (ctaUrl && !isHttpsUrl(ctaUrl)) errors.push("The link must start with https://");
  const startDate = text(src.startDate, 10);
  if (startDate && !isDateKey(startDate)) errors.push("Start date must be YYYY-MM-DD.");
  const eventDate = text(src.eventDate, 10);
  if (eventDate && !isDateKey(eventDate)) errors.push("Event date must be YYYY-MM-DD.");
  const value = {
    title,
    body: text(src.body, 240),
    advertiser: text(src.advertiser, 80),
    ctaLabel: text(src.ctaLabel, 40) || (ctaUrl ? "Learn more" : ""),
    ctaUrl,
    creativeType,
    mediaUrl,
    mediaStoragePath: text(src.mediaStoragePath, 300),
    placementType,
    runDays,
    paymentMode,
    startDate,
    eventName: text(src.eventName, 120),
    eventDate,
    venueName: text(src.venueName, 120),
    ticketUrl: isHttpsUrl(src.ticketUrl) ? text(src.ticketUrl, 600) : "",
    demographics: normalizeDemographics(src.demographics)
  };
  return {ok: errors.length === 0, errors, value};
}

function todayKey(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function computeFlight(startDate, runDays, nowMs = Date.now()) {
  const today = todayKey(nowMs);
  const start = isDateKey(startDate) && startDate > today ? startDate : today;
  const startsAtMs = Date.parse(`${start}T00:00:00Z`);
  const days = RUN_DAY_OPTIONS.includes(Number(runDays)) ? Number(runDays) : 7;
  const endsAtMs = startsAtMs + days * DAY_MS;
  return {startDate: start, endDate: todayKey(endsAtMs - 1), startsAtMs, endsAtMs, runDays: days};
}

function canApprove(campaign = {}, {waive = false} = {}) {
  if (text(campaign.status, 40) !== "pending_approval" && text(campaign.status, 40) !== "awaiting_payment") {
    return {ok: false, reason: "Only pending ads can be approved."};
  }
  if (PAID_STATUSES.includes(text(campaign.paymentStatus, 20))) return {ok: true};
  if (waive) return {ok: true, waived: true};
  return {ok: false, reason: "This ad is not paid yet. Mark the invoice paid, or waive payment with a reason."};
}

function statsDayKey(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}

function posterKey(posterType, posterId) {
  return `${text(posterType, 30)}:${text(posterId, 160)}`.replace(/[\/]/g, "_");
}

function roleList(profile = {}) {
  const raw = [
    ...(Array.isArray(profile.approvedRoles) ? profile.approvedRoles : []),
    ...(Array.isArray(profile.roles) ? profile.roles : [])
  ];
  return raw.map(r => String(r || "").toLowerCase());
}

function truthy(value) {
  return value === true || value === 1 || ["1", "yes", "true"].includes(String(value || "").toLowerCase());
}

/**
 * Who may this signed-in person post ads as?
 * ctx: {uid, profile, managedClubs:[{id,name}], delegatedClubs:[{id,name}], groups:[{id,name}], isMasterAdmin}
 */
function resolvePosterIdentities(ctx = {}) {
  const uid = text(ctx.uid, 128);
  const profile = ctx.profile || {};
  const name = text(profile.displayName || profile.username || profile.email, 80) || "Me";
  const roles = roleList(profile);
  const has = re => roles.some(r => re.test(r));
  const out = [];
  const add = (posterType, posterId, label, via = "") => {
    if (!posterId || out.some(o => o.posterType === posterType && o.posterId === posterId)) return;
    out.push({posterType, posterId, label, via, key: posterKey(posterType, posterId)});
  };
  (ctx.managedClubs || []).forEach(c => add("club", c.id, text(c.name, 80) || c.id, "clubAdmin"));
  (ctx.delegatedClubs || []).forEach(c => add("club", c.id, text(c.name, 80) || c.id, "adPoster"));
  (ctx.groups || []).forEach(g => add("promotionGroup", g.id, text(g.name, 80) || g.id, g.via || "member"));
  if (!uid) return out;
  if (has(/promoter|promotion/)) add("promoter", uid, `${name} (Promoter)`);
  if (has(/\bdj\b|resident dj|visiting dj/)) add("dj", uid, `${name} (DJ)`);
  if (has(/photograph|videograph|camera|mediacreator/)) add("mediaCreator", uid, `${name} (Photo / Video)`);
  if (ctx.isMasterAdmin || has(/floqq|ticketing/)) add("floqq", "floqq", "FloqQ (ticketed events)");
  if (truthy(profile.IsServiceMember) || truthy(profile.IsserviceMember) || truthy(profile.serviceMember)) {
    add("serviceMember", uid, `${name} (Service member)`);
  }
  if (String(profile.accountType || "").toLowerCase() === "business") add("business", uid, `${name} (Business)`);
  return out;
}

/* ---------- media ---------- */

function sniffMedia(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return {kind: "image", mime: "image/jpeg", ext: "jpg"};
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return {kind: "image", mime: "image/png", ext: "png"};
  if (buffer.slice(0, 4).toString("latin1") === "GIF8") return {kind: "image", mime: "image/gif", ext: "gif"};
  if (buffer.slice(0, 4).toString("latin1") === "RIFF" && buffer.slice(8, 12).toString("latin1") === "WEBP") {
    return {kind: "image", mime: "image/webp", ext: "webp"};
  }
  const box = buffer.slice(4, 8).toString("latin1");
  if (box === "ftyp") {
    const brand = buffer.slice(8, 12).toString("latin1");
    if (brand === "qt  ") return {kind: "video", mime: "video/quicktime", ext: "mov"};
    if (/^3g/.test(brand)) return {kind: "video", mime: "video/3gpp", ext: "3gp"};
    return {kind: "video", mime: "video/mp4", ext: "mp4"};
  }
  if (["moov", "mdat", "wide", "free", "skip"].includes(box)) return {kind: "video", mime: "video/quicktime", ext: "mov"};
  return null;
}

function readBoxes(buffer, start, end) {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString("latin1");
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      const big = buffer.readBigUInt64BE(offset + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) {
      boxes.push({type, start: offset, header, end, truncated: true});
      break;
    }
    boxes.push({type, start: offset, header, end: offset + size});
    offset += size;
  }
  return boxes;
}

/** Duration in seconds from an ISO BMFF (mp4 / mov / 3gp) `moov/mvhd` box, or null if unreadable. */
function parseMp4DurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  const moov = readBoxes(buffer, 0, buffer.length).find(b => b.type === "moov" && !b.truncated);
  if (!moov) return null;
  const mvhd = readBoxes(buffer, moov.start + moov.header, moov.end).find(b => b.type === "mvhd" && !b.truncated);
  if (!mvhd) return null;
  const p = mvhd.start + mvhd.header;
  const version = buffer[p];
  let timescale;
  let duration;
  if (version === 1) {
    if (p + 32 > mvhd.end) return null;
    timescale = buffer.readUInt32BE(p + 20);
    duration = Number(buffer.readBigUInt64BE(p + 24));
  } else {
    if (p + 20 > mvhd.end) return null;
    timescale = buffer.readUInt32BE(p + 12);
    duration = buffer.readUInt32BE(p + 16);
  }
  if (!timescale) return null;
  return Math.round((duration / timescale) * 100) / 100;
}

/** {ok, kind, mime, ext, durationSeconds, error} for an uploaded / MMS media buffer. */
function inspectAdMedia(buffer, declaredType = "") {
  const sniff = sniffMedia(buffer);
  if (!sniff) return {ok: false, error: "Send a JPG, PNG, GIF or WebP flyer, or an MP4 / MOV video."};
  const declared = text(declaredType, 60).toLowerCase();
  if (declared && sniff.kind === "image" && declared.startsWith("video/")) {
    return {ok: false, error: "The file type does not match its contents."};
  }
  if (sniff.kind === "image") {
    if (buffer.length > MAX_IMAGE_BYTES) return {ok: false, error: "Images must be under 8 MB."};
    return {ok: true, ...sniff, durationSeconds: 0, bytes: buffer.length};
  }
  if (buffer.length > MAX_VIDEO_BYTES) return {ok: false, error: "Videos must be under 60 MB."};
  const durationSeconds = parseMp4DurationSeconds(buffer);
  if (durationSeconds == null) return {ok: false, error: "We could not read the video length. Send an MP4 or MOV up to 30 seconds."};
  if (durationSeconds > MAX_VIDEO_SECONDS + VIDEO_SECONDS_TOLERANCE) {
    return {ok: false, error: `Videos must be 30 seconds or shorter (this one is ${Math.round(durationSeconds)} s).`, durationSeconds};
  }
  return {ok: true, ...sniff, durationSeconds, bytes: buffer.length};
}

/* ---------- SMS / WhatsApp intake ---------- */

function parseIntakeCommand(body = "") {
  const word = String(body || "").trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, "");
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(word)) return "stop";
  if (["START", "UNSTOP"].includes(word)) return "start";
  if (["HELP", "INFO"].includes(word)) return "help";
  if (["AD", "ADS", "ADVERT", "ADVERTISE", "PROMO", "FLYER"].includes(word)) return "ad";
  return "";
}

function isAdIntakeMessage(form = {}) {
  const numMedia = Number(form.NumMedia || 0);
  if (numMedia > 0) return true;
  return parseIntakeCommand(form.Body) === "ad";
}

function twilioSignature(authToken, url, params = {}) {
  const data = Object.keys(params).sort().reduce((acc, key) => acc + key + String(params[key] ?? ""), String(url || ""));
  return crypto.createHmac("sha1", String(authToken || "")).update(Buffer.from(data, "utf8")).digest("base64");
}

function validateTwilioSignature(authToken, signature, urls = [], params = {}) {
  const given = Buffer.from(String(signature || ""), "utf8");
  if (!authToken || !given.length) return false;
  return urls.filter(Boolean).some(url => {
    const expected = Buffer.from(twilioSignature(authToken, url, params), "utf8");
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(`floqr-ad-intake:${String(token || "")}`).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/* ---------- invoices ---------- */

function money(cents = 0) {
  return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
}

function invoiceNumberFor(id, nowMs = Date.now()) {
  return `FLOQR-AD-${statsDayKey(nowMs)}-${text(id, 40).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;
}

function buildInvoiceLines(inv = {}) {
  const placementLabel = inv.placementType === "minglGist" ? "Mingl Gist" : "Inline (Search, Mingl, RydR)";
  return [
    "FLOQR — Ad invoice",
    `Invoice: ${text(inv.invoiceNumber, 60) || "—"}`,
    `Date: ${text(inv.issuedAtIso, 40) || new Date().toISOString()}`,
    `Bill to: ${text(inv.billToName, 120) || "—"}`,
    inv.billToEmail ? `Email: ${text(inv.billToEmail, 200)}` : null,
    inv.billToPhoneMasked ? `Phone: ${text(inv.billToPhoneMasked, 40)}` : null,
    "",
    `Ad: ${text(inv.title, 80) || "—"}`,
    `Placement: ${placementLabel}`,
    `Run: ${Number(inv.runDays) || 7} days from ${text(inv.startDate, 10) || "approval"}`,
    `Payment: ${inv.paymentMode === "subscription" ? "Monthly subscription" : inv.paymentMode === "invoice" ? "Invoice (net terms)" : "Paid by card"}`,
    `Status: ${text(inv.statusLabel, 60) || "Paid — awaiting FLOQR approval"}`,
    "",
    `Total: ${money(inv.amountCents)} ${String(inv.currency || "usd").toUpperCase()}`,
    inv.stripePaymentIntentId ? `Stripe payment: ${text(inv.stripePaymentIntentId, 80)}` : null,
    "",
    "FLOQR reviews every ad before it runs. If it is rejected you are refunded."
  ].filter(line => line !== null);
}

module.exports = {
  PLACEMENTS,
  RUN_DAY_OPTIONS,
  PRICE_TABLE_CENTS,
  PAYMENT_MODES,
  POSTER_TYPES,
  STATUSES,
  SERVABLE_STATUSES,
  PAID_STATUSES,
  GENDERS,
  MAX_VIDEO_SECONDS,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  IMAGE_TYPES,
  VIDEO_TYPES,
  INTAKE_TTL_MS,
  text,
  isPlacement,
  priceFor,
  normalizeDemographics,
  demographicsToDatapoints,
  isHttpsUrl,
  validateCampaignInput,
  computeFlight,
  canApprove,
  statsDayKey,
  posterKey,
  resolvePosterIdentities,
  sniffMedia,
  parseMp4DurationSeconds,
  inspectAdMedia,
  parseIntakeCommand,
  isAdIntakeMessage,
  twilioSignature,
  validateTwilioSignature,
  hashToken,
  newToken,
  money,
  invoiceNumberFor,
  buildInvoiceLines
};
