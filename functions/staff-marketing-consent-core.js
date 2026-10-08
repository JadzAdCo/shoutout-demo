/* Staff marketing media consent — server contract (mirrors floqr-staff-marketing-consent.js).
   Design notes: .cursor/rules/design-notes-staff-marketing-consent.mdc */
"use strict";

const crypto = require("crypto");

const VERSION = "mmc-2026-10";
const SOURCES = ["portal-elect", "portal-request", "role-request", "portal-manage"];
const ACTIONS = ["accept", "withdraw"];
const MAX_CLUBS = 50;
const THROTTLE_WINDOW_MS = 10 * 60 * 1000;
const THROTTLE_MAX = 20;
const COLLECTIONS = {logs: "staffMarketingConsentLogs", throttle: "staffMarketingConsentThrottle"};

const PARAGRAPHS = [
  "When you join a club, lounge, venue, or event team on FLOQR, you give each venue or event organizer you join, and its admins and managers, permission to use your FLOQR profile name, your role, and the photos and videos you have published or selected on FLOQR to promote that venue and its events.",
  "This covers their websites, flyers and posters, and social media campaigns on Instagram, Facebook, TikTok, YouTube, and similar platforms. While this consent is active, they do not need to ask you again for each new use. The permission is non-exclusive and royalty-free: you keep the rights to your own photos and videos, and no fee is owed to you.",
  "They may not publish your private contact details, such as your phone number or email address.",
  "You can withdraw this consent at any time in My Profile. Withdrawal stops new marketing use. Materials already printed or posted before you withdrew do not have to be recalled."
];
const ENGLISH_TEXT = PARAGRAPHS.join("\n\n");
const TEXT_HASH = crypto.createHash("sha256").update(ENGLISH_TEXT, "utf8").digest("hex");

function text(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

/** Validates callable input. Accept must carry the current version + text hash, so stale copy is refused. */
function normalizeInput(data = {}) {
  const action = text(data.action, 20);
  if (!ACTIONS.includes(action)) return {ok: false, error: "Unknown consent action."};
  if (action === "withdraw") return {ok: true, value: {action}};
  if (text(data.version, 40) !== VERSION) return {ok: false, error: "This consent text is out of date. Reload the page and try again."};
  if (text(data.textHash, 80) !== TEXT_HASH) return {ok: false, error: "This consent text is out of date. Reload the page and try again."};
  const source = text(data.source, 40);
  if (!SOURCES.includes(source)) return {ok: false, error: "Unknown consent source."};
  const lang = text(data.lang, 8).replace(/[^A-Za-z-]/g, "") || "en";
  const raw = Array.isArray(data.clubLocationIds) ? data.clubLocationIds : [];
  if (raw.length > MAX_CLUBS) return {ok: false, error: "Too many venues in one request."};
  const clubLocationIds = [...new Set(raw.map(id => text(id, 128)).filter(id => /^[A-Za-z0-9_-]+$/.test(id)))];
  return {ok: true, value: {action, source, lang, clubLocationIds}};
}

function userConsentPatch(value, nowMs, logId) {
  const iso = new Date(nowMs).toISOString();
  if (value.action === "withdraw") {
    return {accepted: 0, withdrawnAtMs: nowMs, withdrawnAtIso: iso, serverRecordedAtMs: nowMs, lastLogId: logId};
  }
  return {
    accepted: 1,
    version: VERSION,
    textHash: TEXT_HASH,
    acceptedAtMs: nowMs,
    acceptedAtIso: iso,
    source: value.source,
    lang: value.lang,
    withdrawnAtMs: 0,
    withdrawnAtIso: "",
    serverRecordedAtMs: nowMs,
    lastLogId: logId
  };
}

function hashIp(ip) {
  return ip ? crypto.createHash("sha256").update(`floqr-mmc:${ip}`).digest("hex").slice(0, 32) : "";
}

function logRecord({uid, email, value, nowMs, ip, userAgent}) {
  return {
    uid,
    email: text(email, 200),
    action: value.action,
    version: VERSION,
    textHash: value.action === "accept" ? TEXT_HASH : "",
    englishText: value.action === "accept" ? ENGLISH_TEXT : "",
    source: value.source || "",
    lang: value.lang || "",
    clubLocationIds: value.clubLocationIds || [],
    sourceIpHash: hashIp(ip),
    userAgent: text(userAgent, 300),
    createdAtMs: nowMs,
    createdAtIso: new Date(nowMs).toISOString()
  };
}

/** Opt-in docs (roleRequests / workerAssociationRequests) must carry an accepted stamp. */
function requestHasConsent(doc = {}) {
  return Number(doc.marketingMediaConsentAccepted) === 1 && String(doc.marketingMediaConsentVersion || "").length > 0;
}

function throttleStep(row = {}, nowMs) {
  const fresh = nowMs - Number(row.windowStartMs || 0) > THROTTLE_WINDOW_MS;
  const count = fresh ? 0 : Number(row.count || 0);
  if (count >= THROTTLE_MAX) return {allowed: false, next: row};
  return {allowed: true, next: {windowStartMs: fresh ? nowMs : Number(row.windowStartMs), count: count + 1, updatedAtMs: nowMs}};
}

module.exports = {
  VERSION, SOURCES, ACTIONS, MAX_CLUBS, THROTTLE_MAX, THROTTLE_WINDOW_MS, COLLECTIONS,
  PARAGRAPHS, ENGLISH_TEXT, TEXT_HASH,
  normalizeInput, userConsentPatch, logRecord, requestHasConsent, throttleStep, hashIp
};
