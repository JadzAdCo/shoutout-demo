/* Patron account unifier — mobile E.164 is the record key. Pure helpers (no Admin SDK).
   Same person = same normalized mobile. Merge is Master Admin + SOS2FA only; Auth is never deleted here. */
"use strict";

const E164 = /^\+[1-9]\d{7,14}$/;
const PHONE_CLAIM_FIELDS = Object.freeze(["phone", "phoneE164", "phoneNormalized"]);
const MERGE_BACKEND_FIELDS = Object.freeze([
  "mergedInto",
  "mergedFromUids",
  "accountStatus",
  "linkedEmails",
  "linkedAuthUids",
  "phoneE164",
  "phoneNormalized"
]);
const PROFILE_COPY_FIELDS = Object.freeze([
  "displayName",
  "fullName",
  "firstName",
  "lastName",
  "floqrHandle",
  "username",
  "photoURL",
  "country",
  "countryCode",
  "region",
  "regionCode",
  "city",
  "gender",
  "ageRange",
  "height",
  "heightUnit",
  "instagramHandle",
  "xHandle",
  "preferredLanguage",
  "uiLanguage",
  "publicProfileType",
  "publicProfileVisibility"
]);

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function normalizePhoneE164(raw) {
  let value = String(raw || "").trim();
  if (!value) return "";
  value = value.replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (!value.startsWith("+") && /^\d{8,15}$/.test(value)) value = `+${value.replace(/^0+/, "")}`;
  return E164.test(value) ? value : "";
}

function phoneIndexId(e164) {
  const phone = normalizePhoneE164(e164);
  return phone ? `p${phone.slice(1)}` : "";
}

function isPhoneRequired(e164) {
  return !normalizePhoneE164(e164);
}

function otherUidOwnsPhone(ownerUid, selfUid) {
  const owner = text(ownerUid, 128);
  const self = text(selfUid, 128);
  return !!(owner && self && owner !== self);
}

function phoneInUseMessage() {
  return "This mobile is already on a FLOQR account. Sign in with that account. Same phone means the same person.";
}

function mergedAccountMessage() {
  return "This sign-in was merged into another FLOQR account. Sign in with that account.";
}

function blank(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return !value.trim();
  return false;
}

function uniqueStrings(values = [], max = 40) {
  const seen = new Set();
  const out = [];
  values.flat().forEach(item => {
    const value = text(item, 200).toLowerCase();
    if (!value || seen.has(value) || out.length >= max) return;
    seen.add(value);
    out.push(text(item, 200));
  });
  return out;
}

function mergeProfileFields(survivor = {}, duplicate = {}) {
  const next = {};
  PROFILE_COPY_FIELDS.forEach(field => {
    if (blank(survivor[field]) && !blank(duplicate[field])) next[field] = duplicate[field];
  });
  const emails = uniqueStrings([
    survivor.email,
    duplicate.email,
    ...(survivor.linkedEmails || []),
    ...(duplicate.linkedEmails || [])
  ]);
  const uids = uniqueStrings([
    survivor.uid,
    duplicate.uid,
    ...(survivor.linkedAuthUids || []),
    ...(duplicate.linkedAuthUids || [])
  ]);
  const phones = uniqueStrings([
    survivor.phoneE164 || survivor.phone,
    duplicate.phoneE164 || duplicate.phone
  ].map(normalizePhoneE164).filter(Boolean));
  next.linkedEmails = emails;
  next.linkedAuthUids = uids;
  if (!normalizePhoneE164(survivor.phoneE164 || survivor.phone) && phones[0]) {
    next.phone = phones[0];
    next.phoneE164 = phones[0];
    next.phoneNormalized = phones[0];
  }
  if (survivor.profileCompleted !== true && duplicate.profileCompleted === true) {
    next.profileCompleted = true;
  }
  return next;
}

function scoreAccount(row = {}) {
  let score = 0;
  if (row.profileCompleted === true) score += 100;
  if (row.minglGrant === true || row.minglGrant === 1) score += 80;
  score += Math.min(40, Number(row.minglCount || 0) * 5);
  score += Math.min(20, Number(row.inboxCount || 0));
  if (row.botDeeUsed === true || row.hasUsedBotDee === 1) score += 15;
  if (normalizePhoneE164(row.phoneE164 || row.phone)) score += 10;
  const created = Number(row.createdAtMs || 0);
  if (created > 0) score += created < Date.now() - 86400000 ? 5 : 0;
  return score;
}

function recommendSurvivor(left = {}, right = {}) {
  const a = scoreAccount(left);
  const b = scoreAccount(right);
  if (b > a) return {survivorUid: text(right.uid, 128), duplicateUid: text(left.uid, 128), scores: {left: a, right: b}};
  return {survivorUid: text(left.uid, 128), duplicateUid: text(right.uid, 128), scores: {left: a, right: b}};
}

function pairId(a, b) {
  return [text(a, 80), text(b, 80)].filter(Boolean).sort().join("_");
}

function rewriteParticipants(participants = [], fromUid, toUid) {
  const from = text(fromUid, 128);
  const to = text(toUid, 128);
  return (Array.isArray(participants) ? participants : []).map(uid => (text(uid, 128) === from ? to : text(uid, 128)));
}

function connectionMergePlan(row = {}, fromUid, toUid) {
  const from = text(fromUid, 128);
  const to = text(toUid, 128);
  const nextParticipants = rewriteParticipants(row.participants, from, to);
  const unique = uniqueStrings(nextParticipants, 4).sort();
  if (unique.length < 2 || unique[0] === unique[1]) {
    return {action: "close-self", connectionId: text(row.id || row.connectionId, 160)};
  }
  const nextId = pairId(unique[0], unique[1]);
  const requestedBy = text(row.requestedBy, 128) === from ? to : text(row.requestedBy, 128);
  const requestedTo = text(row.requestedTo, 128) === from ? to : text(row.requestedTo, 128);
  return {
    action: nextId === text(row.id || row.connectionId, 160) ? "rewrite" : "rekey",
    fromId: text(row.id || row.connectionId, 160),
    toId: nextId,
    participants: unique.slice(0, 2),
    requestedBy,
    requestedTo
  };
}

function unionBetaFeatures(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out = {};
  keys.forEach(key => {
    out[key] = Number(a[key]) === 1 || Number(b[key]) === 1 ? 1 : 0;
  });
  return out;
}

function publicPatronCard(uid, data = {}, extra = {}) {
  return {
    uid: text(uid, 128),
    email: text(data.email || extra.authEmail, 200),
    displayName: text(data.displayName || data.fullName, 120),
    floqrHandle: text(data.floqrHandle || data.username, 80),
    phoneE164: normalizePhoneE164(data.phoneE164 || data.phone || extra.authPhone),
    profileCompleted: data.profileCompleted === true,
    accountStatus: text(data.accountStatus || "active", 20) || "active",
    mergedInto: text(data.mergedInto, 128),
    ...extra
  };
}

function assertDistinctUids(survivorUid, duplicateUid) {
  const survivor = text(survivorUid, 128);
  const duplicate = text(duplicateUid, 128);
  if (!survivor || !duplicate) {
    const error = new Error("Choose two patron accounts.");
    error.code = "invalid-argument";
    throw error;
  }
  if (survivor === duplicate) {
    const error = new Error("Survivor and duplicate must be different accounts.");
    error.code = "invalid-argument";
    throw error;
  }
  return {survivor, duplicate};
}

module.exports = {
  E164,
  PHONE_CLAIM_FIELDS,
  MERGE_BACKEND_FIELDS,
  PROFILE_COPY_FIELDS,
  text,
  normalizePhoneE164,
  phoneIndexId,
  isPhoneRequired,
  otherUidOwnsPhone,
  phoneInUseMessage,
  mergedAccountMessage,
  mergeProfileFields,
  scoreAccount,
  recommendSurvivor,
  pairId,
  rewriteParticipants,
  connectionMergePlan,
  unionBetaFeatures,
  publicPatronCard,
  assertDistinctUids,
  uniqueStrings
};
