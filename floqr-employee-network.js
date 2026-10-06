// Design notes: .cursor/rules/design-notes-employee-network.mdc
(function (root) {
  "use strict";

  const INACTIVE_DESIGNATION = new Set(["rejected", "removed", "revoked", "declined"]);

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9@._+-]+/g, " ")
      .trim();
  }

  function matches(query, value) {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    const haystack = normalize(value);
    return !tokens.length || tokens.every(token => haystack.includes(token));
  }

  function uidOf(profile = {}) {
    return profile.uid || profile.id || "";
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function isActiveDesignation(designation = {}) {
    return !INACTIVE_DESIGNATION.has(String(designation.status || "").toLowerCase());
  }

  function isCsrDesignation(designation = {}) {
    if (!isActiveDesignation(designation)) return false;
    if (designation.isCSR === true) return true;
    if (designation.isCSR === false) return false;
    return designation.designationType === "customer_service_representative";
  }

  function designationFor(uid, designations = []) {
    if (!uid) return null;
    return designations.find(item => (item.workerUid || item.uid) === uid && isActiveDesignation(item)) || null;
  }

  function isLinkedToClub(profile = {}, ctx = {}) {
    const locationId = ctx.locationId;
    if (!locationId) return false;
    const uid = uidOf(profile);
    if (designationFor(uid, ctx.designations || [])) return true;
    const club = ctx.club || {};
    if (uid && list(club.adminUids).includes(uid)) return true;
    const email = String(profile.email || "").toLowerCase();
    if (email && list(club.adminEmails).map(x => String(x).toLowerCase()).includes(email)) return true;
    if (profile.affiliatedClubId === locationId) return true;
    if (profile.affiliatedClubLocationId === locationId) return true;
    if (profile.clubLocationId === locationId) return true;
    return [
      profile.approvedLocations,
      profile.affiliatedClubLocationIds,
      profile.clubLocationIds,
      profile.designatedCSRLocations
    ].some(values => list(values).includes(locationId));
  }

  function displayName(profile = {}) {
    return profile.displayName || profile.fullName || profile.username || profile.email || "";
  }

  function electionCandidates(users = [], query = "", opts = {}) {
    const minChars = opts.minChars == null ? 2 : opts.minChars;
    const limit = opts.limit || 8;
    if (normalize(query).replace(/\s+/g, "").length < minChars) return [];
    return users
      .filter(profile => uidOf(profile))
      .filter(profile => matches(query, [profile.displayName, profile.fullName, profile.username, profile.email].join(" ")))
      .slice(0, limit)
      .map(profile => ({
        uid: uidOf(profile),
        name: displayName(profile) || "Patron",
        handle: profile.username ? `@${profile.username}` : (profile.email || ""),
        linked: isLinkedToClub(profile, opts)
      }));
  }

  function isPendingRequest(request = {}) {
    return String(request.status || "pending").toLowerCase() === "pending";
  }

  function groupPendingRequests(requests = [], roleOf = request => request.serviceSubtype || request.roleLabel || "") {
    const groups = new Map();
    requests.filter(isPendingRequest).forEach(request => {
      const uid = request.uid || request.workerUid || "";
      const role = roleOf(request) || "";
      const key = uid ? `${uid}|${String(role).toLowerCase()}` : `id|${request.id}`;
      const existing = groups.get(key);
      groups.set(key, existing
        ? {...existing, ids: [...existing.ids, request.id]}
        : {key, uid, role, request, ids: [request.id]});
    });
    return Array.from(groups.values());
  }

  const api = {
    normalize,
    matches,
    isActiveDesignation,
    isCsrDesignation,
    designationFor,
    isLinkedToClub,
    electionCandidates,
    isPendingRequest,
    groupPendingRequests
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FLOQREmployeeNetwork = api;
})(typeof window !== "undefined" ? window : globalThis);
