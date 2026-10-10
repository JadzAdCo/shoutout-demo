/* FLOQR Scheduling "Schedule for" picker — which owners (DJ / club / promoting company) the
   signed-in person may manage. Pure helpers; the page wires Firestore + DOM in scheduling-portal.js.
   Stored ownerId format is unchanged: dj = uid, club = clubLocations id, promoterCompany = company name.
   The server (canManageOwner in functions/scheduling-functions.js) stays the access control. */
(function (root) {
  "use strict";

  const OWNER_TYPES = ["dj", "club", "promoterCompany"];
  const LISTED_MASTER_ADMIN_EMAILS = ["bans.don@gmail.com", "don.b@jadzholdings.com"];
  const COMPANY_STATUSES = new Set(["active", "approved", "elected"]);

  function text(value, max = 160) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function isOwnerType(value) {
    return OWNER_TYPES.includes(value);
  }

  /** `?owner=club:abc` (Inbox / Club Admin deep links) → {ownerType, ownerId} or null. */
  function parseOwnerParam(raw) {
    const value = text(raw, 220);
    const idx = value.indexOf(":");
    if (idx < 1) return null;
    const ownerType = value.slice(0, idx);
    const ownerId = value.slice(idx + 1).trim();
    if (!isOwnerType(ownerType) || !ownerId) return null;
    return {ownerType, ownerId};
  }

  /** UI hint only — mirrors admin-trust: claim, or a verified email on the Master Admin list. */
  function isMasterAdminViewer({email, emailVerified, claims} = {}, listed = LISTED_MASTER_ADMIN_EMAILS) {
    if (claims && (claims.masterAdmin === true || claims.superAdmin === true)) return true;
    if (emailVerified !== true) return false;
    const normalized = text(email, 320).toLowerCase();
    return !!normalized && (listed || []).map(v => String(v).toLowerCase()).includes(normalized);
  }

  function unique(values) {
    return Array.from(new Set(values.map(v => text(v)).filter(Boolean)));
  }

  /** Same club-manager tests as the server's canManageOwner("club", …). */
  function designationManagesClub(row = {}) {
    if (!text(row.clubLocationId)) return false;
    if (text(row.status, 40).toLowerCase() === "rejected") return false;
    if (/club admin/i.test(String(row.roleElectionType || ""))) return true;
    return (Array.isArray(row.rolePermissions) ? row.rolePermissions : []).includes("manageSchedules");
  }

  function managedClubIds({profile = {}, assignments = [], clubsByUid = [], clubsByEmail = [], designations = []} = {}) {
    const ids = [];
    (Array.isArray(profile.clubAdminLocationIds) ? profile.clubAdminLocationIds : []).forEach(id => ids.push(id));
    assignments.forEach(row => {
      if (text(row.status, 40).toLowerCase() !== "active") return;
      ids.push(row.clubId || row.clubLocationId || row.locationId);
    });
    clubsByUid.forEach(id => ids.push(id));
    clubsByEmail.forEach(id => ids.push(id));
    designations.filter(designationManagesClub).forEach(row => ids.push(row.clubLocationId));
    return unique(ids);
  }

  /** Same promoter test as the server's canManageOwner("promoterCompany", …). */
  function designationCompany(row = {}) {
    if (!COMPANY_STATUSES.has(text(row.status, 40).toLowerCase())) return "";
    const roles = [row.roleElectionType, ...(Array.isArray(row.workerRoles) ? row.workerRoles : [])];
    if (!roles.some(role => /promot/i.test(String(role || "")))) return "";
    return text(row.promoterCompany);
  }

  function companyOptions(designations = [], {anyStatus = false} = {}) {
    const byKey = new Map();
    designations.forEach(row => {
      const name = anyStatus ? text(row.promoterCompany) : designationCompany(row);
      if (!name) return;
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, {value: name, label: name});
    });
    return sortOptions([...byKey.values()]);
  }

  function clubLabel(id, data = {}) {
    const name = text(data.locationName || data.clubName || data.name || data.brand) || text(id);
    const city = text(data.city || data.locationCity);
    return city && !name.toLowerCase().includes(city.toLowerCase()) ? `${name} · ${city}` : name;
  }

  function clubOptions(rows = []) {
    const byId = new Map();
    rows.forEach(({id, data}) => {
      const value = text(id);
      if (value && !byId.has(value)) byId.set(value, {value, label: clubLabel(value, data || {})});
    });
    return sortOptions([...byId.values()]);
  }

  function sortOptions(options) {
    return options.slice().sort((a, b) => a.label.localeCompare(b.label, undefined, {sensitivity: "base"}));
  }

  /** Keeps an owner from a deep link selectable even if the lists did not include it. */
  function withRequested(options, requestedId) {
    const id = text(requestedId);
    if (!id || options.some(option => option.value.toLowerCase() === id.toLowerCase())) return options;
    return [...options, {value: id, label: id, requested: true}];
  }

  function filterOptions(options, query) {
    const q = text(query, 80).toLowerCase();
    if (!q) return options;
    return options.filter(option => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q));
  }

  /** Deep link wins; otherwise clubs (Club Admins), then a company (promoters), then the DJ calendar. */
  function defaultOwnerType({requested, clubCount = 0, companyCount = 0} = {}) {
    if (requested && isOwnerType(requested)) return requested;
    if (clubCount > 0) return "club";
    if (companyCount > 0) return "promoterCompany";
    return "dj";
  }

  /** The value stored with shifts and subscriptions. DJ is always the signed-in uid. */
  function resolveOwnerId(ownerType, selectedId, uid) {
    if (ownerType === "dj") return text(uid);
    return isOwnerType(ownerType) ? text(selectedId) : "";
  }

  const api = {
    OWNER_TYPES,
    LISTED_MASTER_ADMIN_EMAILS,
    parseOwnerParam,
    isMasterAdminViewer,
    designationManagesClub,
    managedClubIds,
    designationCompany,
    companyOptions,
    clubLabel,
    clubOptions,
    withRequested,
    filterOptions,
    defaultOwnerType,
    resolveOwnerId
  };
  root.FLOQRScheduleOwners = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
