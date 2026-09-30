/* Features & Services — pure helpers (catalog, access rule, invites, tamper-evident audit records).
   Design notes: .cursor/rules/design-notes-feature-services.mdc */
"use strict";

const crypto = require("crypto");

const FEATURE_CATALOG = Object.freeze([
  {key: "shoutOut", label: "ShoutOut", patronGate: "shoutOut", route: "./?start=shoutout", sortOrder: 10, IsFeatureEnabled: 1, IsTestFeature: 0},
  {key: "mingl", label: "Mingl", patronGate: "mingl", route: "./?start=mingl", sortOrder: 20, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "bartr", label: "Trade by BartR", patronGate: "bartr", route: "./commerce.html?from=search", sortOrder: 30, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "rydr", label: "RydR", patronGate: "rydr", route: "./rydr.html?from=search", sortOrder: 40, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "supRstar", label: "supRstar", patronGate: "", route: "./suprstr-search.html?from=search", sortOrder: 50, IsFeatureEnabled: 0, IsTestFeature: 1},
  {key: "floqAi", label: "FloqAi", patronGate: "floqAi", route: "./?start=intent", sortOrder: 60, IsFeatureEnabled: 0, IsTestFeature: 1}
].map(row => Object.freeze(row)));

const FEATURE_KEYS = Object.freeze(FEATURE_CATALOG.map(row => row.key));

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

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function flag(value) {
  return value === 1 || value === true || value === "1" || String(value).toLowerCase() === "true" ? 1 : 0;
}

function catalogEntry(key) {
  return FEATURE_CATALOG.find(row => row.key === key) || null;
}

function normalizeFeature(key, raw = null) {
  const base = catalogEntry(key);
  if (!base) return null;
  const data = raw && typeof raw === "object" ? raw : {};
  const has = field => Object.prototype.hasOwnProperty.call(data, field);
  return {
    ...base,
    IsFeatureEnabled: has("IsFeatureEnabled") ? flag(data.IsFeatureEnabled) : base.IsFeatureEnabled,
    IsTestFeature: has("IsTestFeature") ? flag(data.IsTestFeature) : base.IsTestFeature,
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

/** Page + server access. Search tile visibility is searchTileVisible (Master Admins use Features & Services). */
function canAccessFeature(feature, viewer = {}) {
  const state = featureState(feature);
  if (state === "off") return false;
  if (state === "live") return true;
  return viewer.isMasterAdmin === true || hasBetaGrant(viewer, feature.key);
}

function searchTileVisible(feature, viewer = {}) {
  const state = featureState(feature);
  if (state === "off") return false;
  if (state === "live") return true;
  return hasBetaGrant(viewer, feature.key);
}

function isActiveBetaTester(row) {
  return !!row && flag(row.IsBetaTester) === 1 && row.status === "active";
}

function betaGrantsFrom(row) {
  if (!isActiveBetaTester(row)) return {};
  const raw = row.features && typeof row.features === "object" ? row.features : {};
  return Object.fromEntries(BETA_ELIGIBLE_KEYS.filter(key => flag(raw[key]) === 1).map(key => [key, 1]));
}

/** Accepts ["mingl"] or {mingl: 1}; returns a full 0|1 map over beta-eligible keys. */
function validateBetaFeatures(input, {requireOne = true} = {}) {
  const picked = Array.isArray(input)
    ? input.map(key => text(key, 60))
    : Object.entries(input && typeof input === "object" ? input : {}).filter(([, value]) => flag(value) === 1).map(([key]) => text(key, 60));
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
  const featureKey = text(input.featureKey, 60);
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
  if (invite.status === "accepted") return {ok: false, reason: "used"};
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
  COLLECTIONS,
  INVITE_TTL_MS,
  REASON_MIN,
  GENESIS_HASH,
  CONTROL_SETS,
  flag,
  catalogEntry,
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
