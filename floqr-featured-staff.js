// Design notes: .cursor/rules/design-notes-featured-staff-picker.mdc
(function (root) {
  "use strict";

  const PROFILE_PHOTO_FIELDS = ["photoURL", "profilePhotoUrl", "publicPhotoUrl", "avatarUrl"];

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function uidOf(profile = {}) {
    return profile.uid || profile.id || "";
  }

  function nameOf(profile = {}) {
    return profile.displayName || profile.fullName || profile.username || profile.name || "";
  }

  function isImageUrl(url) {
    return /^https:\/\//i.test(String(url || ""));
  }

  function unique(urls) {
    const seen = new Set();
    return urls.filter(url => {
      if (!isImageUrl(url) || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }

  function photoOptions(profile = {}, extra = []) {
    const slots = Array.isArray(profile.profileMediaSlots) ? profile.profileMediaSlots : [];
    const slotImages = slots.filter(slot => slot && slot.type !== "video").map(slot => slot.url);
    return unique([...PROFILE_PHOTO_FIELDS.map(field => profile[field]), ...slotImages, ...extra]);
  }

  function entryPhoto(entry = {}) {
    return entry.photoUrl || entry.photoURL || entry.imageUrl || "";
  }

  function keyFor(entry = {}) {
    const uid = entry.uid || entry.workerUid || "";
    return uid ? `uid:${uid}` : `name:${normalize(entry.name || entry.displayName)}`;
  }

  function primaryRole(roles = []) {
    const list = roles.filter(Boolean);
    return list.find(role => !/club admin/i.test(role)) || list[0] || "Service Team";
  }

  function instagramOf(profile = {}) {
    const handles = profile.socialMediaHandles || profile.socialHandles || {};
    return profile.instagram || profile.instagramHandle || handles.instagram || "";
  }

  function rosterMatch(entry, roster) {
    const uid = entry.uid || entry.workerUid;
    if (uid) return roster.find(profile => uidOf(profile) === uid) || null;
    const name = normalize(entry.name || entry.displayName);
    return name ? roster.find(profile => normalize(nameOf(profile)) === name) || null : null;
  }

  function buildRows({roster = [], featured = [], rolesOf = () => []} = {}) {
    const rows = [];
    const used = new Set();
    for (const entry of Array.isArray(featured) ? featured : []) {
      if (!entry || typeof entry !== "object" || !(entry.name || entry.displayName)) continue;
      const profile = rosterMatch(entry, roster);
      if (profile) used.add(uidOf(profile));
      const photoUrl = entryPhoto(entry);
      rows.push({
        key: profile ? `uid:${uidOf(profile)}` : keyFor(entry),
        uid: profile ? uidOf(profile) : (entry.uid || ""),
        name: entry.name || entry.displayName,
        roles: profile ? rolesOf(profile) : [],
        role: entry.role || entry.title || "Service Team",
        photoUrl,
        photos: unique([photoUrl, ...(profile ? photoOptions(profile) : [])]),
        checked: true,
        original: entry
      });
    }
    for (const profile of roster) {
      const uid = uidOf(profile);
      if (!uid || used.has(uid)) continue;
      const roles = rolesOf(profile);
      const photos = photoOptions(profile);
      rows.push({
        key: `uid:${uid}`,
        uid,
        name: nameOf(profile) || "FLOQR Member",
        roles,
        role: primaryRole(roles),
        photoUrl: photos[0] || "",
        photos,
        checked: false,
        original: {instagram: instagramOf(profile)}
      });
    }
    return rows;
  }

  function applyDraft(rows = [], draft = new Map()) {
    return rows.map(row => {
      const change = draft.get(row.key);
      if (!change) return row;
      return {
        ...row,
        ...change,
        photos: unique([...row.photos, ...(change.uploaded || []), change.photoUrl])
      };
    });
  }

  function toFeatured(rows = []) {
    return rows.filter(row => row.checked && row.name).map(row => {
      const entry = {
        ...row.original,
        name: row.name,
        role: String(row.role || "").trim() || "Service Team",
        photoUrl: row.photoUrl || ""
      };
      if (row.uid) entry.uid = row.uid;
      if (row.photoStoragePath) entry.photoStoragePath = row.photoStoragePath;
      delete entry.photoURL;
      delete entry.imageUrl;
      Object.keys(entry).forEach(key => {
        if (entry[key] === undefined || entry[key] === null || entry[key] === "") delete entry[key];
      });
      return entry;
    });
  }

  function photoSignature(featured = []) {
    return (Array.isArray(featured) ? featured : [])
      .filter(entry => entry && entryPhoto(entry))
      .map(entry => `${keyFor(entry)}|${entryPhoto(entry)}`)
      .sort()
      .join("\n");
  }

  function needsPhotoConsent(featured = [], consent = null) {
    const signature = photoSignature(featured);
    return !!signature && (!consent || consent.photoSignature !== signature);
  }

  const api = {normalize, photoOptions, keyFor, primaryRole, buildRows, applyDraft, toFeatured, photoSignature, needsPhotoConsent};

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FLOQRFeaturedStaff = api;
})(typeof window !== "undefined" ? window : globalThis);
