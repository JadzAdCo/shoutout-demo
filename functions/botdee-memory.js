/* BOT DEE opt-in archive, memories, consent, export/delete.
   Idle timeout ends the active session; it does not delete opted-in archive.
   Default consent is off. Mingl is never imported. No stored IP. */
"use strict";

const crypto = require("crypto");

const CONSENT_DEFAULTS = Object.freeze({
  archive: 0,
  memory: 0,
  personalization: 0,
  publicProfileEnrichment: 0
});

const MEMORY_SCOPES = Object.freeze(["private", "self"]);
const RETENTION_DAYS_DEFAULT = 365;

function flag01(value, fallback) {
  if (value === 0 || value === "0" || value === false) return 0;
  if (value === 1 || value === "1" || value === true) return 1;
  return fallback === 0 || fallback === 1 ? fallback : 0;
}

function normalizeConsent(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return {
    archive: flag01(row.archive, CONSENT_DEFAULTS.archive),
    memory: flag01(row.memory, CONSENT_DEFAULTS.memory),
    personalization: flag01(row.personalization, CONSENT_DEFAULTS.personalization),
    publicProfileEnrichment: 0,
    updatedAtMs: Math.max(0, Math.floor(Number(row.updatedAtMs) || 0))
  };
}

function consentAllows(consent, scope) {
  const row = normalizeConsent(consent);
  if (scope === "archive") return row.archive === 1;
  if (scope === "memory") return row.memory === 1;
  if (scope === "personalization") return row.personalization === 1;
  return false;
}

function archiveMessage({seq, epoch, role, text, atMs, sourceRefs, idempotencyKey, visibilityScope}) {
  const body = String(text || "").trim().slice(0, 8000);
  const id = idempotencyKey || `m${String(seq || "").padStart(8, "0")}`;
  return {
    messageId: id,
    seq: Math.max(0, Math.floor(Number(seq) || 0)),
    epoch: Math.max(1, Math.floor(Number(epoch) || 1)),
    role: role === "model" || role === "assistant" ? "model" : "user",
    sanitizedContent: body,
    createdAtMs: Number(atMs) || Date.now(),
    sourceRefs: Array.isArray(sourceRefs) ? sourceRefs.slice(0, 12) : [],
    tokenEstimate: Math.ceil(body.length / 4),
    idempotencyKey: id,
    visibilityScope: visibilityScope === "restricted" ? "restricted" : "private"
  };
}

function memoryRecord({
  memoryId,
  value,
  sourceMessageIds,
  explicitOrInferred,
  approved,
  confidence,
  purpose,
  scope,
  nowMs,
  expiresAtMs
}) {
  const now = Number(nowMs) || Date.now();
  const id = String(memoryId || "").trim() || `mem_${crypto.randomBytes(8).toString("hex")}`;
  const vis = MEMORY_SCOPES.includes(scope) ? scope : "private";
  return {
    memoryId: id,
    value: String(value || "").trim().slice(0, 500),
    sourceMessageIds: Array.isArray(sourceMessageIds) ? sourceMessageIds.slice(0, 24) : [],
    explicitOrInferred: explicitOrInferred === "explicit" ? "explicit" : "inferred",
    approved: flag01(approved, explicitOrInferred === "explicit" ? 1 : 0),
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
    purpose: String(purpose || "preference").trim().slice(0, 40),
    scope: vis,
    createdAtMs: now,
    updatedAtMs: now,
    expiresAtMs: Number(expiresAtMs) || now + RETENTION_DAYS_DEFAULT * 86400000
  };
}

function authorizedMemories(rows, consent, nowMs) {
  if (!consentAllows(consent, "memory")) return [];
  const now = Number(nowMs) || Date.now();
  return (Array.isArray(rows) ? rows : []).filter(row => {
    if (!row || row.approved !== 1) return false;
    if (row.scope && row.scope !== "private" && row.scope !== "self") return false;
    const exp = Number(row.expiresAtMs) || 0;
    if (exp && exp <= now) return false;
    return true;
  });
}

function exportPayload({uid, consent, archive, memories, research}) {
  return {
    schemaVersion: "floqr.botDeeExport/1",
    ownerUid: String(uid || "").trim(),
    exportedAtIso: new Date().toISOString(),
    consent: normalizeConsent(consent),
    archive: Array.isArray(archive) ? archive : [],
    memories: Array.isArray(memories) ? memories : [],
    research: Array.isArray(research) ? research : [],
    minglIncluded: false,
    ipIncluded: false,
    note: "Private BOT DEE archive. Not a web publication. Gemini is not trained by this export."
  };
}

function deletionPlan(consentAfterRevoke) {
  const next = normalizeConsent(consentAfterRevoke);
  return {
    stopRetrieval: true,
    deleteArchive: next.archive === 0,
    deleteMemories: next.memory === 0,
    invalidateSummaries: true,
    invalidateSmartViewMaterializations: true,
    backupWindowNote: "Backups may retain copies for the platform backup window; live retrieval stops immediately."
  };
}

function idleEndsActiveNotArchive({idleEnded, consent}) {
  return {
    activeSessionEnded: !!idleEnded,
    archiveRetained: consentAllows(consent, "archive"),
    memoriesRetained: consentAllows(consent, "memory")
  };
}

module.exports = {
  CONSENT_DEFAULTS,
  MEMORY_SCOPES,
  RETENTION_DAYS_DEFAULT,
  flag01,
  normalizeConsent,
  consentAllows,
  archiveMessage,
  memoryRecord,
  authorizedMemories,
  exportPayload,
  deletionPlan,
  idleEndsActiveNotArchive
};
