/* Features & Services — pure helpers (catalog, access rule, invites, tamper-evident audit records).
   Design notes: .cursor/rules/design-notes-feature-services.mdc */
"use strict";

const crypto = require("crypto");

const FEATURE_CATALOG = Object.freeze([
  {key: "shoutOut", label: "ShoutOut", patronGate: "shoutOut", route: "./?start=shoutout", sortOrder: 10, IsFeatureEnabled: 1, IsTestFeature: 0},
  {key: "mingl", label: "Mingl", patronGate: "mingl", route: "./?start=mingl", sortOrder: 20, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "bartr", label: "Trade by BartR", patronGate: "bartr", route: "./commerce.html?from=search", sortOrder: 30, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "rydr", label: "RydR", patronGate: "rydr", route: "./rydr.html?from=search", sortOrder: 40, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "floqCast", label: "floqCast", patronGate: "", route: "./floqcast-search.html?from=search", sortOrder: 50, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "floqAi", label: "FloqAi", patronGate: "floqAi", route: "./floqai.html", sortOrder: 60, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "vipReservations", label: "VIP reserV", patronGate: "", route: "./vip.html?from=search", sortOrder: 70, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "passes", label: "Passes", patronGate: "", route: "./patron-portal.html?tab=passes", sortOrder: 75, IsFeatureEnabled: 0, IsTestFeature: 1},
  // Site chrome beta — Nightlife/Traditional theme; no Search tile. Preference datapoint: users.isSiteChrome.
  {key: "siteChrome", label: "Site chrome", patronGate: "", route: "./patron-portal.html?tab=language", sortOrder: 80, IsFeatureEnabled: 0, IsTestFeature: 1}
].map(row => Object.freeze(row)));

const FEATURE_KEYS = Object.freeze(FEATURE_CATALOG.map(row => row.key));

/** One-release aliases: legacy featureServices / betaTesters.features keys → catalog key. */
const FEATURE_KEY_ALIASES = Object.freeze({
  supRstar: "floqCast",
  traditionalTheme: "siteChrome"
});

const COLLECTIONS = Object.freeze({
  features: "featureServices",
  betaTesters: "betaTesters",
  betaInvites: "betaInvites",
  audit: "featureServiceAuditLogs",
  auditHead: "featureServiceAuditHead"
});

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REASON_MIN = 8;
const REASON_MAX = 500;
const AUDIT_RETENTION_YEARS = 7;
const GENESIS_HASH = "GENESIS";
const LOG_STANDARD = "ISO/IEC 27001:2022 A.8.15 + NIST SP 800-53 Rev. 5 AU family";
const CONTROL_SETS = Object.freeze([
  "ISO27001-A.8.15", "ISO27001-A.8.16", "ISO27001-A.8.32",
  "NIST-800-53r5-AU-2", "NIST-800-53r5-AU-3", "NIST-800-53r5-AU-8", "NIST-800-53r5-AU-9",
  "NIST-800-53r5-AU-10", "NIST-800-53r5-AU-11", "NIST-800-53r5-AU-12", "NIST-800-53r5-CM-3",
  "NIST-800-53r5-AC-6(9)"
]);

/** Canonical FloqR Beta Test & Prerelease Agreement (plain text for hash / audit). */
const BETA_AGREEMENT_CANONICAL = [
  "FLOQR BETA TEST & PRERELEASE AGREEMENT",
  "",
  "Last Updated: October 18, 2026",
  "",
  "This Beta Test Agreement (the \"Agreement\") is a legally binding contract between you (the \"Beta Tester\" or \"Patron\") and FloqMedia, the owner and operator of FloqR (collectively, the \"Company\", \"we\", \"us\", or \"our\").",
  "",
  "By clicking \"I Agree,\" checking an acceptance box, or accessing and using the prerelease version of the FloqR web application (the \"Beta Product\"), you agree to be bound by the terms of this Agreement. If you do not agree, you are not authorized to participate in the Beta Program.",
  "",
  "1. Purpose & \"As-Is\" Nature of Beta Product",
  "Pre-Release Software: You acknowledge that FloqR is currently a startup social operating system built for searching and booking global nightlife events (including clubs, lounges, rooftops, concerts, and DJ events).",
  "Testing Status: The Beta Product contains features under active development. It has not completed User Acceptance Testing (UAT) and is currently undergoing Quality Assurance (QA) testing.",
  "Disclaimer of Warranties: Because the software is incomplete, it may contain technical bugs, errors, glitches, or data inaccuracies. The Beta Product is provided strictly on an \"AS IS\" and \"AS AVAILABLE\" basis, without warranties of any kind.",
  "",
  "2. Eligibility & Access License",
  "Age Requirement: Because FloqR serves the nightlife and entertainment industry, you must be at least 18 years of age (or the legal age of majority in your jurisdiction, e.g., 21 where required by local law) to participate.",
  "Limited License: The Company grants you a personal, non-exclusive, non-transferable, revocable, and limited license to access and test the Beta Product solely for evaluation purposes.",
  "",
  "3. Absolute Confidentiality",
  "Confidential Information: The Beta Product, its underlying features, design interface (including sub-features like Mingl, RydR, BartR, ShoutOut, floqCast, and FloqAi), performance metrics, screenshots, videos of usage, and any documented bugs are the strictest proprietary secrets of FloqMedia.",
  "Non-Disclosure: You agree not to disclose, share, publish, tweet, or blog about your experiences or any aspect of the Beta Product to any third party, public forum, or competitor.",
  "Media & Streaming: You are strictly prohibited from sharing screenshots or live-streaming the Beta Product unless explicitly authorized in writing by FloqMedia.",
  "",
  "4. Feedback & Intellectual Property Assignment",
  "Feedback Obligation: As a condition of your invite, you agree to report system bugs, crashes, or user-experience gaps back to the Company.",
  "Ownership of Feedback: You agree that all comments, suggestions, ideas, or feedback you provide become the sole and exclusive property of FloqMedia. You assign all rights, titles, and interests in such feedback to the Company without any expectation of compensation or royalties.",
  "",
  "5. Data Collection, AI, & Transaction Terms",
  "Analytics Usage: You agree that FloqMedia may monitor and collect data regarding your activity within the Beta Product. This data will be used in aggregate analytics to optimize venue insights, AI processing via FloqAi, and advertising performance.",
  "Media Uploads: If you test customized marketing display features (such as \"ShoutOut\" media or promotional cards), you represent that you possess all legal permissions and intellectual property rights for any photos, names, or @handles you upload to the application.",
  "Prerelease Transactions & Booking Disclaimer: The Beta Product features live integration modules allowing users to reserve tables, join guest lists, and pay for VIP, Event, or Standard venue entries. You acknowledge that because the application is in a QA testing phase, technical glitches may cause transaction failures, double-bookings, incorrect pricing, or communication failures with local venues. FloqMedia is not responsible or liable for any financial discrepancies, canceled bookings, or denied entries at participating nightlife venues.",
  "Refund Policy: As a beta tester, you accept that reversing payments is difficult during a beta testing phase. Ticket sales, table reservations, VIP entry, and other payments performed on beta features are final and non-refundable by FloqMedia. Any disputes regarding venue bookings, entry denial, or payment errors must be resolved directly with the physical venue or the third-party merchant processor (e.g., Stripe, Papi, or Social OS).",
  "Mock vs. Real Processing: FloqMedia will clearly notify you whether a specific testing phase utilizes \"Test/Sandbox\" payment credentials or real financial transactions. If real payment methods are required, you are fully responsible for the charges incurred.",
  "",
  "6. Limitation of Liability",
  "No Damages: To the maximum extent permitted by applicable law, FloqMedia shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from your participation in the Beta Program. This includes, but is not limited to, system crashes, loss of booking data, phone/device damage, or data loss.",
  "",
  "7. Termination & Modification",
  "Program Changes: FloqMedia reserves the right to modify, suspend, or completely terminate the Beta Program, or your specific access to it, at any time with or without prior notice.",
  "Survival: Your obligations regarding Confidentiality (Section 3) and Intellectual Property (Section 4) will survive the termination of this Agreement or the release of the final Minimum Viable Product (MVP)."
].join("\n");

const BETA_AGREEMENT = Object.freeze({
  agreementDocId: "floqr-beta-test-agreement-v1",
  agreementVersion: "2",
  agreementSha256: crypto.createHash("sha256").update(BETA_AGREEMENT_CANONICAL).digest("hex"),
  title: "FloqR Beta Test & Prerelease Agreement",
  lastUpdated: "2026-10-18"
});

/** Two mandatory checkboxes on beta-invite.html before Accept. */
const REQUIRED_BETA_CONSENT_CHECKS = Object.freeze(["betaAgreement", "bookingDisclaimer"]);

function betaConsentChecksComplete(checks = {}) {
  return REQUIRED_BETA_CONSENT_CHECKS.every(key => checks[key] === true);
}

function expandBetaConsentChecks(checks = {}) {
  const out = {};
  REQUIRED_BETA_CONSENT_CHECKS.forEach(key => {
    out[key] = checks[key] === true;
  });
  return out;
}

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function flag(value) {
  return value === 1 || value === true || value === "1" || String(value).toLowerCase() === "true" ? 1 : 0;
}

function canonicalizeFeatureKey(key) {
  const k = text(key, 60);
  return FEATURE_KEY_ALIASES[k] || k;
}

function catalogEntry(key) {
  return FEATURE_CATALOG.find(row => row.key === canonicalizeFeatureKey(key)) || null;
}

/** Derived link datapoints — written only by the server, in the same write as the flags they come from. */
function featureLinkFields(feature) {
  const enabled = flag(feature?.IsFeatureEnabled);
  return {
    enableFeatureLink: enabled,
    enableBetaFeatureLink: enabled === 1 && flag(feature?.IsTestFeature) === 1 ? 1 : 0
  };
}

/** True when a stored doc is missing the derived link fields or they disagree with its flags. */
function linkFieldsDrifted(raw) {
  if (!raw || typeof raw !== "object") return false;
  const want = featureLinkFields(raw);
  return !Object.prototype.hasOwnProperty.call(raw, "enableFeatureLink")
    || !Object.prototype.hasOwnProperty.call(raw, "enableBetaFeatureLink")
    || flag(raw.enableFeatureLink) !== want.enableFeatureLink
    || flag(raw.enableBetaFeatureLink) !== want.enableBetaFeatureLink;
}

function normalizeFeature(key, raw = null) {
  const base = catalogEntry(key);
  if (!base) return null;
  const data = raw && typeof raw === "object" ? raw : {};
  const has = field => Object.prototype.hasOwnProperty.call(data, field);
  const flags = {
    IsFeatureEnabled: has("IsFeatureEnabled") ? flag(data.IsFeatureEnabled) : base.IsFeatureEnabled,
    IsTestFeature: has("IsTestFeature") ? flag(data.IsTestFeature) : base.IsTestFeature
  };
  return {
    ...base,
    ...flags,
    ...featureLinkFields(flags),
    revision: Number.isFinite(Number(data.revision)) ? Number(data.revision) : 0,
    persisted: !!raw
  };
}

const BETA_ELIGIBLE_KEYS = Object.freeze(FEATURE_KEYS.filter(key => key !== "shoutOut"));

/** off = nobody (kill switch) · test = Master Admin (Features & Services) + granted beta testers · live = everyone. */
function featureState(feature) {
  if (!feature || flag(feature.IsFeatureEnabled) !== 1) return "off";
  return flag(feature.IsTestFeature) === 1 ? "test" : "live";
}

/** Beta testers are never Master Admins; access is per feature, not a blanket role. */
function hasBetaGrant(viewer = {}, featureKey = "") {
  if (viewer.isMasterAdmin === true || viewer.isBetaTester !== true) return false;
  const grants = viewer.betaFeatures && typeof viewer.betaFeatures === "object" ? viewer.betaFeatures : {};
  return flag(grants[featureKey]) === 1;
}

/** Page + server access. */
function canAccessFeature(feature, viewer = {}) {
  const state = featureState(feature);
  if (state === "off") return false;
  if (state === "live") return true;
  return viewer.isMasterAdmin === true || hasBetaGrant(viewer, feature.key);
}

/**
 * Search tile visibility.
 * Live → everyone. Test → Master Admin (QA / Beta pill) OR granted beta tester.
 * Master Admins must see enabled test tiles on Search so floqCast / VIP / FloqAi marks are QA-able.
 */
function searchTileVisible(feature, viewer = {}) {
  const state = featureState(feature);
  if (state === "off") return false;
  if (state === "live") return true;
  return viewer.isMasterAdmin === true || hasBetaGrant(viewer, feature.key);
}

function isActiveBetaTester(row) {
  return !!row && flag(row.IsBetaTester) === 1 && row.status === "active";
}

function betaGrantsFrom(row) {
  if (!isActiveBetaTester(row)) return {};
  const raw = row.features && typeof row.features === "object" ? row.features : {};
  const merged = {...raw};
  // Legacy betaTesters.features.supRstar → floqCast for one release.
  if (flag(raw.supRstar) === 1 && flag(merged.floqCast) !== 1) merged.floqCast = 1;
  if (flag(raw.traditionalTheme) === 1 && flag(merged.siteChrome) !== 1) merged.siteChrome = 1;
  return Object.fromEntries(BETA_ELIGIBLE_KEYS.filter(key => flag(merged[key]) === 1).map(key => [key, 1]));
}

/** Accepts ["mingl"] or {mingl: 1}; returns a full 0|1 map over beta-eligible keys. */
function validateBetaFeatures(input, {requireOne = true} = {}) {
  const picked = Array.isArray(input)
    ? input.map(key => canonicalizeFeatureKey(key))
    : Object.entries(input && typeof input === "object" ? input : {}).filter(([, value]) => flag(value) === 1).map(([key]) => canonicalizeFeatureKey(key));
  const unknown = picked.filter(key => !BETA_ELIGIBLE_KEYS.includes(key));
  if (unknown.length) throw validationError("invalid-argument", `Not a beta feature: ${unknown.join(", ")}.`);
  const map = Object.fromEntries(BETA_ELIGIBLE_KEYS.map(key => [key, picked.includes(key) ? 1 : 0]));
  if (requireOne && !Object.values(map).some(value => value === 1)) {
    throw validationError("invalid-argument", "Choose at least one feature this beta tester may use.");
  }
  return map;
}

function validationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateReason(reason) {
  const value = text(reason, REASON_MAX);
  if (value.length < REASON_MIN) {
    throw validationError("invalid-argument", `Enter a reason of at least ${REASON_MIN} characters. It is saved in the audit trail.`);
  }
  return value;
}

function validateFlagChange(input = {}) {
  const featureKey = canonicalizeFeatureKey(input.featureKey);
  if (!catalogEntry(featureKey)) throw validationError("invalid-argument", "Unknown feature.");
  const next = {};
  ["IsFeatureEnabled", "IsTestFeature"].forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return;
    const raw = input[field];
    if (![0, 1, true, false, "0", "1"].includes(raw)) throw validationError("invalid-argument", `${field} must be 0 or 1.`);
    next[field] = flag(raw);
  });
  if (!Object.keys(next).length) throw validationError("invalid-argument", "Send IsFeatureEnabled and/or IsTestFeature.");
  return {featureKey, next, reason: validateReason(input.reason)};
}

function flagEventType(before, after) {
  const changes = [];
  if (before.IsFeatureEnabled !== after.IsFeatureEnabled) changes.push(after.IsFeatureEnabled ? "feature.enabled" : "feature.disabled");
  if (before.IsTestFeature !== after.IsTestFeature) changes.push(after.IsTestFeature ? "feature.test_on" : "feature.test_off");
  if (!changes.length) return "";
  return changes.length === 1 ? changes[0] : "feature.flags_changed";
}

function newInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function isValidInviteToken(token) {
  return /^[A-Za-z0-9_-]{43}$/.test(String(token || ""));
}

function inviteIdFor(token) {
  return crypto.createHash("sha256").update(`floqr-beta-invite:${token}`).digest("hex");
}

/** Invites are bound to one account (targetUid): a forwarded link is useless to anyone else. */
function evaluateInvite(invite, {uid = "", nowMs = Date.now()} = {}) {
  if (!invite) return {ok: false, reason: "not-found"};
  // isBetaLinkused=1 means the invite was successfully accepted (terms + subscribe completed).
  if (Number(invite.isBetaLinkused) === 1 || invite.status === "accepted") {
    return {ok: false, reason: "used"};
  }
  if (invite.status === "declined") return {ok: false, reason: "declined"};
  if (invite.status === "revoked") return {ok: false, reason: "revoked"};
  if (invite.status !== "pending") return {ok: false, reason: "not-pending"};
  if (Number(invite.expiresAtMs || 0) <= nowMs) return {ok: false, reason: "expired"};
  if (!uid || invite.targetUid !== uid) return {ok: false, reason: "wrong-account"};
  return {ok: true, reason: ""};
}

function maskEmail(email) {
  const value = text(email, 200).toLowerCase();
  const at = value.indexOf("@");
  if (at < 1) return value ? "***" : "";
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function truncateIp(ip) {
  const value = text(ip, 80);
  if (!value) return "";
  if (value.includes(":")) return `${value.split(":").slice(0, 3).join(":")}::/48`;
  const parts = value.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.0/24` : "";
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function chainHash(prevHash, record) {
  return sha256(`${prevHash}\n${canonicalJson(record)}`);
}

/** AU-3 content: what, when (UTC), where, source, outcome, identity, plus before/after for CM-3. */
function buildAuditRecord({
  eventType, outcome = "success", actor = {}, target = {}, before = null, after = null,
  reason = "", sessionId = "", ip = "", userAgent = "", detail = null, nowMs = Date.now()
} = {}) {
  return {
    eventType: text(eventType, 80),
    outcome: ["success", "failure", "denied"].includes(outcome) ? outcome : "failure",
    actorUid: text(actor.uid, 128),
    actorEmail: text(actor.email, 200).toLowerCase(),
    actorRole: text(actor.role, 40),
    targetType: text(target.type, 40),
    targetId: text(target.id, 160),
    before: before && typeof before === "object" ? before : null,
    after: after && typeof after === "object" ? after : null,
    reason: text(reason, REASON_MAX),
    detail: detail && typeof detail === "object" ? detail : null,
    sos2faSessionHash: sessionId ? sha256(sessionId).slice(0, 16) : "",
    sourceIpTruncated: truncateIp(ip),
    sourceIpHash: ip ? sha256(ip).slice(0, 24) : "",
    userAgent: text(userAgent, 240),
    source: "feature-services-functions",
    createdAtMs: nowMs,
    createdAtIso: new Date(nowMs).toISOString(),
    logStandard: LOG_STANDARD,
    controlSets: [...CONTROL_SETS],
    retentionYears: AUDIT_RETENTION_YEARS,
    expireAtMs: nowMs + AUDIT_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000
  };
}

/** AU-9: recompute the chain oldest → newest; any edit, delete, or reorder breaks it. */
function verifyChain(rowsAscending = []) {
  let prev = null;
  for (const row of rowsAscending) {
    const {hash, createdAt, chained, ...body} = row;
    if (prev !== null && body.prevHash !== prev.hash) return {ok: false, checked: rowsAscending.length, brokenAt: body.eventId || "", issue: "link"};
    if (prev !== null && Number(body.seq) !== Number(prev.seq) + 1) return {ok: false, checked: rowsAscending.length, brokenAt: body.eventId || "", issue: "sequence-gap"};
    if (chainHash(body.prevHash, body) !== hash) return {ok: false, checked: rowsAscending.length, brokenAt: body.eventId || "", issue: "hash"};
    prev = row;
  }
  return {ok: true, checked: rowsAscending.length, brokenAt: "", issue: ""};
}

module.exports = {
  FEATURE_CATALOG,
  FEATURE_KEYS,
  FEATURE_KEY_ALIASES,
  COLLECTIONS,
  INVITE_TTL_MS,
  REASON_MIN,
  GENESIS_HASH,
  CONTROL_SETS,
  BETA_AGREEMENT_CANONICAL,
  BETA_AGREEMENT,
  REQUIRED_BETA_CONSENT_CHECKS,
  betaConsentChecksComplete,
  expandBetaConsentChecks,
  flag,
  canonicalizeFeatureKey,
  catalogEntry,
  featureLinkFields,
  linkFieldsDrifted,
  normalizeFeature,
  BETA_ELIGIBLE_KEYS,
  featureState,
  hasBetaGrant,
  canAccessFeature,
  searchTileVisible,
  isActiveBetaTester,
  betaGrantsFrom,
  validateBetaFeatures,
  validateReason,
  validateFlagChange,
  flagEventType,
  newInviteToken,
  isValidInviteToken,
  inviteIdFor,
  evaluateInvite,
  maskEmail,
  truncateIp,
  canonicalJson,
  chainHash,
  buildAuditRecord,
  verifyChain
};
