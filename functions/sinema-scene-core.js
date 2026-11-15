/* Si-nema loads granted FloqMedia geometry as a virtual set.
   Pin projectId + pinRevisionId. Never silently pick up a newer FloqMedia revision.
   48-hour edit window starts at the original FloqR scene save timestamp and is
   not reset by later edits. Do not claim a video model preserves geometry exactly. */
"use strict";

const { grantIsUsable, pinFromGrant, text } = require("./spatial-grant-core");

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;
const WORLD_AXES = Object.freeze({
  x: "east",
  y: "up",
  z: "north",
  planY: "north"
});
const GEOMETRY_PRESERVATION = "not_exact";
const RECONSTRUCTION = "honest-prototype";

function newSceneId() {
  return `snm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function virtualSetFromGrant(grant, { nowMs, destinationTenantId } = {}) {
  const usable = grantIsUsable(grant, {
    nowMs,
    destinationTenantId: destinationTenantId || grant.destinationTenantId,
    needPermission: "use_in_sinema"
  });
  if (!usable.ok) return usable;
  if (grant.destinationType !== "sinema") return { ok: false, reason: "destination_not_sinema" };
  const pin = pinFromGrant(grant);
  if (!pin.pinRevisionId) return { ok: false, reason: "pin_revision_required" };
  return {
    ok: true,
    virtualSet: {
      kind: "floqmedia-spatial-virtual-set",
      projectId: pin.projectId,
      pinRevisionId: pin.pinRevisionId,
      worldAxes: { ...WORLD_AXES },
      geometrySource: "floqmedia",
      geometryCopied: false,
      geometryPreservation: GEOMETRY_PRESERVATION,
      reconstruction: RECONSTRUCTION,
      grantId: grant.grantId,
      ownerFloqrSubject: grant.ownerFloqrSubject
    }
  };
}

function resolvePinnedRevision(grant, availableRevisionIds = []) {
  const pin = grant?.revisionPolicy?.pinRevisionId || "";
  const available = Array.isArray(availableRevisionIds) ? availableRevisionIds.map(String) : [];
  const newer = available.filter((id) => id !== pin);
  return {
    pinRevisionId: pin,
    ignoredNewerRevisionIds: newer,
    usedLatest: false
  };
}

function createScene(grant, input = {}, { nowMs, destinationTenantId } = {}) {
  const loaded = virtualSetFromGrant(grant, { nowMs, destinationTenantId });
  if (!loaded.ok) return loaded;
  const now = Number(nowMs) || Date.now();
  return {
    ok: true,
    scene: {
      sceneId: text(input.sceneId, 80) || newSceneId(),
      ownerFloqrSubject: grant.ownerFloqrSubject,
      destinationTenantId: grant.destinationTenantId,
      grantId: grant.grantId,
      projectId: loaded.virtualSet.projectId,
      pinRevisionId: loaded.virtualSet.pinRevisionId,
      virtualSet: loaded.virtualSet,
      originalSavedAtMs: 0,
      editableUntilMs: 0,
      savedAtMs: 0,
      createdAtMs: now,
      notes: text(input.notes, 400),
      geometryPreservation: GEOMETRY_PRESERVATION
    }
  };
}

function canEditScene(scene, { nowMs, exceptional } = {}) {
  if (!scene) return { ok: false, reason: "missing_scene" };
  if (!scene.originalSavedAtMs) return { ok: true, firstSave: true };
  const now = Number(nowMs) || Date.now();
  const deadline = Number(scene.editableUntilMs || 0);
  if (now <= deadline) return { ok: true, firstSave: false };
  if (exceptional?.authorized === true
      && text(exceptional.reason, 200).length >= 8
      && text(exceptional.authorizedByUid, 128)) {
    return { ok: true, exceptional: true };
  }
  return { ok: false, reason: "edit_window_closed" };
}

function saveScene(scene, patch = {}, { nowMs, exceptional } = {}) {
  const gate = canEditScene(scene, { nowMs, exceptional });
  if (!gate.ok) return gate;
  const now = Number(nowMs) || Date.now();
  const next = {
    ...scene,
    notes: patch.notes != null ? text(patch.notes, 400) : scene.notes,
    savedAtMs: now,
    geometryPreservation: GEOMETRY_PRESERVATION
  };
  if (gate.firstSave) {
    next.originalSavedAtMs = now;
    next.editableUntilMs = now + EDIT_WINDOW_MS;
  } else {
    next.originalSavedAtMs = scene.originalSavedAtMs;
    next.editableUntilMs = scene.editableUntilMs;
  }
  if (patch.pinRevisionId && patch.pinRevisionId !== scene.pinRevisionId) {
    return { ok: false, reason: "pin_revision_locked" };
  }
  if (patch.projectId && patch.projectId !== scene.projectId) {
    return { ok: false, reason: "project_id_locked" };
  }
  return { ok: true, scene: next, firstSave: !!gate.firstSave, exceptional: !!gate.exceptional };
}

module.exports = {
  EDIT_WINDOW_MS,
  WORLD_AXES,
  GEOMETRY_PRESERVATION,
  RECONSTRUCTION,
  virtualSetFromGrant,
  resolvePinnedRevision,
  createScene,
  canEditScene,
  saveScene
};
