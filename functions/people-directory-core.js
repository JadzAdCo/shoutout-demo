/* People directory — which parts of another patron's profile a caller may see.
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
"use strict";

const MODES = ["public", "services", "contacts", "club", "uids", "referrals"];
const MAX_ROWS = 500;
const MAX_UIDS = 100;
const SCAN_LIMIT = 1500;

const PRIVATE_KEY = /(email|phone|stripe|token|secret|password|passcode|address|birth|dob|ssn|consent|notification|sos2fa|recovery|payment|billing|card|iban|bank|fcm|session|device|privacy|dsar|^lat$|^lng$|latitude|longitude|coords|^geo|^ip$|ipaddress|clientip|lastip)/i;
const BACKEND_KEYS = new Set(["masterAdmin", "superAdmin", "IsBetaTester", "betaTester", "adminNotes", "roles", "customClaims", "languageSettings"]);

function truthy(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "yes" || text === "true";
}

function isPrivateKey(key) {
  return BACKEND_KEYS.has(key) || PRIVATE_KEY.test(key);
}

function plain(value, depth = 0) {
  if (value == null || typeof value !== "object") return value;
  if (typeof value.toMillis === "function") return {__ms: value.toMillis()};
  if (Array.isArray(value)) return depth > 3 ? [] : value.map(item => plain(item, depth + 1));
  if (depth > 3) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isPrivateKey(key))
    .map(([key, inner]) => [key, plain(inner, depth + 1)]));
}

function photoOf(data = {}) {
  const slot = Array.isArray(data.profileMediaSlots) ? data.profileMediaSlots.find(x => x?.url && x.type !== "video") : null;
  return data.photoURL || data.profilePhotoUrl || data.mainPhotoUrl || data.avatarUrl || slot?.url || "";
}

/** Name + photo only: what anyone in a shared chat or roster may see. */
function minimalCard(uid, data = {}) {
  return {
    id: uid,
    uid,
    displayName: String(data.displayName || data.publicName || data.username || "Member"),
    username: String(data.username || ""),
    photoURL: photoOf(data)
  };
}

/** Everything except private fields (contact details, consents, payment, security, location coordinates). */
function publicProfile(uid, data = {}) {
  return {...plain(data), id: uid, uid};
}

function isPublic(data = {}) {
  return String(data.publicProfileVisibility || "").trim().toLowerCase() === "public";
}

function hasServiceRole(data = {}) {
  const roles = Array.isArray(data.approvedRoles) ? data.approvedRoles.filter(Boolean) : [];
  return roles.length > 0 || !!data.approvedRole || truthy(data.IsServiceMember) || truthy(data.IsserviceMember) || truthy(data.serviceMember);
}

/** Club managers also see contact details of people tied to their club and of service members. */
function clubRow(uid, data = {}, affiliated = false) {
  if (!affiliated && !isPublic(data) && !hasServiceRole(data)) return minimalCard(uid, data);
  const row = publicProfile(uid, data);
  if (affiliated || hasServiceRole(data)) {
    row.email = String(data.email || "");
    if (affiliated) row.phone = String(data.phone || data.phoneNumber || "");
  }
  return row;
}

function referralRow(data = {}) {
  return {
    referredByPromoterId: String(data.referredByPromoterId || ""),
    createdAt: plain(data.createdAt),
    updatedAt: plain(data.updatedAt)
  };
}

function invalid(message) {
  const error = new Error(message);
  error.code = "invalid-argument";
  return error;
}

function validateRequest(data = {}) {
  const mode = String(data.mode || "");
  if (!MODES.includes(mode)) throw invalid("Unknown directory mode.");
  const out = {mode, limit: Math.min(MAX_ROWS, Math.max(1, Number(data.limit) || MAX_ROWS))};
  if (mode === "uids") {
    const uids = Array.isArray(data.uids) ? [...new Set(data.uids.map(x => String(x || "").trim()).filter(Boolean))] : [];
    if (!uids.length || uids.length > MAX_UIDS || uids.some(uid => uid.length > 128 || uid.includes("/"))) throw invalid(`Send 1 to ${MAX_UIDS} member ids.`);
    out.uids = uids;
  }
  if (mode === "club") {
    const clubLocationId = String(data.clubLocationId || "").trim();
    if (!clubLocationId || clubLocationId.length > 160 || clubLocationId.includes("/")) throw invalid("Club is required.");
    out.clubLocationId = clubLocationId;
  }
  return out;
}

/**
 * rows: [{id, data}]; facts: {uid, isMasterAdmin, connectedUids:Set, affiliatedUids:Set}.
 * Never returns the caller's own row (they read their own doc directly).
 */
function project(mode, rows, facts = {}) {
  const connected = facts.connectedUids || new Set();
  const affiliated = facts.affiliatedUids || new Set();
  const others = rows.filter(row => row && row.id && row.id !== facts.uid);
  if (mode === "referrals") return others.filter(row => row.data?.referredByPromoterId).map(row => referralRow(row.data));
  if (mode === "public") return others.filter(row => isPublic(row.data)).map(row => publicProfile(row.id, row.data));
  if (mode === "services") return others.filter(row => hasServiceRole(row.data)).map(row => publicProfile(row.id, row.data));
  if (mode === "club") return others.map(row => clubRow(row.id, row.data, affiliated.has(row.id)));
  return others
    .filter(row => mode === "uids" || isPublic(row.data) || hasServiceRole(row.data) || connected.has(row.id))
    .map(row => (isPublic(row.data) || hasServiceRole(row.data) ? publicProfile(row.id, row.data) : minimalCard(row.id, row.data)));
}

module.exports = {
  MODES,
  MAX_ROWS,
  MAX_UIDS,
  SCAN_LIMIT,
  isPrivateKey,
  plain,
  minimalCard,
  publicProfile,
  isPublic,
  hasServiceRole,
  clubRow,
  validateRequest,
  project
};
