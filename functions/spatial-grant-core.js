/* FloqR stores Spatial Studio grant *references* only.
   Files, photos, poses, meshes, and semantic geometry stay on FloqMedia.
   editableUntil stays null on the grant — FloqR scene save owns the 48h clock.
   Tokens never go in the grant or the spatial project file. */
"use strict";

const crypto = require("crypto");

const PERMISSIONS = Object.freeze(["read", "edit", "use_in_sinema"]);
const DESTINATION_TYPES = Object.freeze(["venue", "sinema"]);
const STATUSES = Object.freeze(["active", "revoked"]);
const CLOCK_OWNER = "floqr-scene-save";
const GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SECRET_KEYS = Object.freeze([
  "access_token", "id_token", "refresh_token", "token", "authorization",
  "code_verifier", "code_challenge"
]);

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function iso(ms) {
  return new Date(Number(ms) || Date.now()).toISOString();
}

function newGrantId() {
  return `grt_${crypto.randomBytes(12).toString("hex")}`;
}

function newAuditId() {
  return `aud_${crypto.randomBytes(10).toString("hex")}`;
}

function normalizePermissions(list) {
  const set = new Set();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const key = text(item, 40);
    if (PERMISSIONS.includes(key)) set.add(key);
  });
  if (!set.has("read")) set.add("read");
  return [...set];
}

function containsSecrets(row) {
  const blob = JSON.stringify(row || {});
  return SECRET_KEYS.some((key) => new RegExp(`"${key}"\\s*:`, "i").test(blob));
}

function buildGrantRef(input = {}, { nowMs } = {}) {
  const now = Number(nowMs) || Date.now();
  const destinationType = text(input.destinationType, 20);
  const permissions = normalizePermissions(input.permissions);
  if (!text(input.projectId, 120)) return { ok: false, reason: "project_id_required" };
  if (!text(input.ownerFloqrSubject, 128) && input.allowGuest !== true) {
    return { ok: false, reason: "owner_required" };
  }
  if (!text(input.destinationTenantId, 120)) return { ok: false, reason: "destination_tenant_required" };
  if (!DESTINATION_TYPES.includes(destinationType)) return { ok: false, reason: "destination_type_invalid" };
  if (destinationType === "sinema" && !permissions.includes("use_in_sinema")) {
    return { ok: false, reason: "sinema_requires_use_in_sinema" };
  }
  const pinRevisionId = text(input.pinRevisionId || input.revisionPolicy?.pinRevisionId, 120);
  if (!pinRevisionId) return { ok: false, reason: "pin_revision_required" };

  const grant = {
    grantId: text(input.grantId, 80) || newGrantId(),
    projectId: text(input.projectId, 120),
    ownerFloqrSubject: text(input.ownerFloqrSubject, 128),
    destinationTenantId: text(input.destinationTenantId, 120),
    destinationType,
    permissions,
    revisionPolicy: {
      pinRevisionId,
      clockOwner: CLOCK_OWNER,
      editableUntil: null
    },
    status: "active",
    issuedAt: input.issuedAt || iso(now),
    expiresAt: input.expiresAt || iso(now + GRANT_TTL_MS),
    revokedAt: null,
    auditId: text(input.auditId, 80) || newAuditId(),
    guestAttachedConfirmed: false,
    source: "floqmedia-spatial-studio",
    schemaVersion: 1
  };
  if (containsSecrets(grant) || containsSecrets(input)) {
    return { ok: false, reason: "tokens_forbidden" };
  }
  return { ok: true, grant };
}

function grantIsUsable(grant, { nowMs, destinationTenantId, needPermission } = {}) {
  if (!grant) return { ok: false, reason: "missing" };
  if (grant.status !== "active") return { ok: false, reason: "not_active" };
  if (grant.revokedAt) return { ok: false, reason: "revoked" };
  const now = Number(nowMs) || Date.now();
  const exp = Date.parse(grant.expiresAt || "");
  if (Number.isFinite(exp) && now >= exp) return { ok: false, reason: "expired" };
  if (destinationTenantId && grant.destinationTenantId !== destinationTenantId) {
    return { ok: false, reason: "tenant_mismatch" };
  }
  if (needPermission && !(grant.permissions || []).includes(needPermission)) {
    return { ok: false, reason: "missing_permission" };
  }
  if (grant.destinationType === "sinema" && !(grant.permissions || []).includes("use_in_sinema")) {
    return { ok: false, reason: "sinema_requires_use_in_sinema" };
  }
  if (grant.revisionPolicy?.editableUntil != null) {
    return { ok: false, reason: "editable_until_must_be_null_on_grant" };
  }
  return { ok: true };
}

function revokeGrant(grant, { nowMs, auditId } = {}) {
  const now = Number(nowMs) || Date.now();
  return {
    ...grant,
    status: "revoked",
    revokedAt: iso(now),
    auditId: text(auditId, 80) || grant.auditId || newAuditId(),
    cacheInvalidatedAt: iso(now)
  };
}

function attachGuestDraft(grant, { ownerFloqrSubject, confirmed, nowMs } = {}) {
  if (confirmed !== true) return { ok: false, reason: "confirm_required" };
  const subject = text(ownerFloqrSubject, 128);
  if (!subject) return { ok: false, reason: "owner_required" };
  if (grant.ownerFloqrSubject && grant.ownerFloqrSubject !== subject) {
    return { ok: false, reason: "already_owned" };
  }
  return {
    ok: true,
    grant: {
      ...grant,
      ownerFloqrSubject: subject,
      guestAttachedConfirmed: true,
      guestAttachedAt: iso(Number(nowMs) || Date.now())
    }
  };
}

function pinFromGrant(grant) {
  return {
    projectId: grant.projectId,
    pinRevisionId: grant.revisionPolicy?.pinRevisionId || "",
    source: "floqmedia",
    copied: false
  };
}

module.exports = {
  PERMISSIONS,
  DESTINATION_TYPES,
  STATUSES,
  CLOCK_OWNER,
  GRANT_TTL_MS,
  text,
  iso,
  newGrantId,
  newAuditId,
  normalizePermissions,
  containsSecrets,
  buildGrantRef,
  grantIsUsable,
  revokeGrant,
  attachGuestDraft,
  pinFromGrant
};
