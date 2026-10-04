/* Venue template tags + template roles (Administer / Manage Templates).
   Design notes: .cursor/rules/design-notes-template-discovery-idle.mdc */
(function (global) {
  "use strict";

  const MAX_TAGS = 30;
  const MAX_TAG_LENGTH = 32;
  const ROLES = Object.freeze({
    administrator: Object.freeze({key: "administrator", permission: "administerTemplates", canRead: true, canWrite: true, canDelete: true}),
    manager: Object.freeze({key: "manager", permission: "manageTemplates", canRead: true, canWrite: true, canDelete: false})
  });
  const NO_ROLE = Object.freeze({key: "", permission: "", canRead: false, canWrite: false, canDelete: false});

  function tagDocId(locationId, templateId) {
    return `${locationId}__${templateId}`;
  }

  function roleDocId(locationId, uid) {
    return `${locationId}_${uid}`;
  }

  function normalizeTag(value) {
    return Array.from(String(value || "").replace(/[<>"`]/g, "").replace(/\s+/g, " ").trim()).slice(0, MAX_TAG_LENGTH).join("");
  }

  function sameTag(a, b) {
    return normalizeTag(a).toLocaleLowerCase() === normalizeTag(b).toLocaleLowerCase();
  }

  /** Club Admin always administers; otherwise the stored role decides. */
  function roleFor({isClubAdmin = false, roleDoc = null} = {}) {
    if (isClubAdmin) return ROLES.administrator;
    if (!roleDoc || roleDoc.status !== "active") return NO_ROLE;
    return ROLES[roleDoc.role] || NO_ROLE;
  }

  /** REP duty checkboxes → stored role (Administer wins over Manage). */
  function roleFromPermissions(permissions = []) {
    const set = new Set(permissions || []);
    if (set.has(ROLES.administrator.permission)) return ROLES.administrator.key;
    if (set.has(ROLES.manager.permission)) return ROLES.manager.key;
    return "";
  }

  function addTag(tags = [], value, role = NO_ROLE) {
    if (!role.canWrite) throw new Error("not-allowed");
    const tag = normalizeTag(value);
    if (!tag) return [...tags];
    if (tags.some(existing => sameTag(existing, tag))) return [...tags];
    if (tags.length >= MAX_TAGS) throw new Error("too-many-tags");
    return [...tags, tag];
  }

  function removeTag(tags = [], value, role = NO_ROLE) {
    if (!role.canDelete) throw new Error("not-allowed");
    return tags.filter(existing => !sameTag(existing, value));
  }

  /** Templates patrons can pick at this venue (same set as the patron template picker). */
  function templatesForVenue(locationId, location = {}, templates = global.SHOUTOUT_TEMPLATES || {}, standardIds = global.SHOUTOUT_STANDARD_TEMPLATE_IDS || []) {
    const venueSpecific = Object.values(templates).filter(t => (t.venueIds || []).includes(locationId)).map(t => t.id);
    const standard = location.restrictTemplatesToLocationSet ? standardIds.filter(id => String(id).startsWith("soccer")) : standardIds;
    const always = location.restrictTemplatesToLocationSet ? [] : ["blackwhite"];
    const ids = Array.from(new Set([...always, ...(location.templates || []), ...venueSpecific, ...standard]
      .map(id => (/^soccer/i.test(id) && id !== "soccerJersey" ? "soccerJersey" : id))));
    const seen = new Set();
    return ids.map(id => templates[id]).filter(t => {
      if (!t || seen.has(t.id)) return false;
      seen.add(t.id);
      return String(t.status || "active") === "active" && global.FLOQRScreenDatapoints?.templateFitsVenue?.(t, location) !== false;
    });
  }

  async function loadVenueTags(db, locationId) {
    if (!db || !locationId) return {};
    const snap = await db.collection("venueTemplateTags").where("clubLocationId", "==", locationId).limit(400).get();
    const map = {};
    snap.docs.forEach(doc => {
      const row = doc.data() || {};
      if (row.templateId && Array.isArray(row.tags)) map[row.templateId] = row.tags.map(normalizeTag).filter(Boolean);
    });
    return map;
  }

  async function saveVenueTags(db, {locationId, templateId, tags, user, revision = 0}) {
    const ref = db.collection("venueTemplateTags").doc(tagDocId(locationId, templateId));
    const FieldValue = global.firebase?.firestore?.FieldValue;
    if (!tags.length) {
      await ref.delete();
      return;
    }
    await ref.set({
      clubLocationId: locationId,
      templateId,
      tags: tags.map(normalizeTag).filter(Boolean).slice(0, MAX_TAGS),
      updatedByUid: user?.uid || "",
      updatedByEmail: String(user?.email || "").toLowerCase(),
      updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
      revision: Number(revision || 0) + 1
    });
  }

  async function loadRoleDoc(db, locationId, uid) {
    if (!db || !locationId || !uid) return null;
    try {
      const snap = await db.collection("venueTemplateRoles").doc(roleDocId(locationId, uid)).get();
      return snap.exists ? snap.data() || null : null;
    } catch (error) {
      return null;
    }
  }

  global.FLOQRTemplateTags = {
    MAX_TAGS, MAX_TAG_LENGTH, ROLES, NO_ROLE,
    tagDocId, roleDocId, normalizeTag, sameTag, roleFor, roleFromPermissions, addTag, removeTag,
    templatesForVenue, loadVenueTags, saveVenueTags, loadRoleDoc
  };
})(typeof window !== "undefined" ? window : globalThis);
