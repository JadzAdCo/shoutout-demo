/* FLOQR feature gates — platform + per-venue + Super Admin exemption. */
(function (root) {
  "use strict";

  const SUPER_ADMIN_EMAILS = (root.SHOUTOUT_SUPER_ADMIN_EMAILS || ["bands.don@gmail.com"]).map(x => String(x).toLowerCase());
  const MASTER_ADMIN_EMAILS = (root.SHOUTOUT_MASTER_ADMIN_EMAILS || root.SHOUTOUT_ADMIN_EMAILS || []).map(x => String(x).toLowerCase());

  const DEFAULT_PATRON_GATES = Object.freeze({
    bartr: true,
    rydr: true,
    mingl: true,
    floqAi: true,
    shoutOut: true
  });

  const DEFAULT_VENUE_GATES = Object.freeze({
    uberAds: true,
    windowAds: true,
    bartrStores: true,
    shoutOut: true
  });

  const PATRON_GATE_LABELS = Object.freeze({
    bartr: "BartR",
    rydr: "RydR",
    mingl: "Mingl",
    floqAi: "FloqAi (Quick Search and Help)",
    shoutOut: "ShoutOut"
  });

  const VENUE_GATE_LABELS = Object.freeze({
    uberAds: "UberAds",
    windowAds: "WindowAds",
    bartrStores: "BartR Stores",
    shoutOut: "ShoutOut Capability"
  });

  let cachedPatronGates = { ...DEFAULT_PATRON_GATES };
  let patronGatesLoaded = false;
  let venueGateCache = new Map();

  function emailOf(userOrEmail) {
    if (!userOrEmail) return "";
    if (typeof userOrEmail === "string") return userOrEmail.toLowerCase();
    return String(userOrEmail.email || userOrEmail.token?.email || "").toLowerCase();
  }

  function isSuperAdmin(userOrEmail, profile = null) {
    const email = emailOf(userOrEmail);
    if (email && SUPER_ADMIN_EMAILS.includes(email)) return true;
    if (profile?.superAdmin === true) return true;
    if (userOrEmail?.superAdmin === true) return true;
    return false;
  }

  function isMasterAdminEmail(userOrEmail) {
    const email = emailOf(userOrEmail);
    return !!email && (MASTER_ADMIN_EMAILS.includes(email) || SUPER_ADMIN_EMAILS.includes(email));
  }

  function normalizePatronGates(raw = {}) {
    const out = { ...DEFAULT_PATRON_GATES };
    Object.keys(DEFAULT_PATRON_GATES).forEach(key => {
      if (raw && Object.prototype.hasOwnProperty.call(raw, key)) out[key] = raw[key] !== false;
    });
    return out;
  }

  function normalizeVenueGates(raw = {}) {
    const out = { ...DEFAULT_VENUE_GATES };
    const source = raw?.featureGates && typeof raw.featureGates === "object" ? raw.featureGates : raw;
    Object.keys(DEFAULT_VENUE_GATES).forEach(key => {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key] !== false;
    });
    return out;
  }

  function entityIsOffboarded(row = {}) {
    return row.offboarded === true || String(row.status || "").toLowerCase() === "offboarded";
  }

  function entityIsAppEnabled(row = {}) {
    if (entityIsOffboarded(row)) return false;
    if (row.appEnabled === false) return false;
    if (row.active === false && String(row.status || "").toLowerCase() === "disabled") return false;
    if (String(row.status || "").toLowerCase() === "disabled") return false;
    return true;
  }

  function entityIsPubliclyVisible(row = {}) {
    if (!row) return false;
    if (entityIsOffboarded(row)) return false;
    if (row.publicVisible === false || row.publicProfileEnabled === false) return false;
    if (row.active === false) return false;
    if (["deleted", "offboarded", "disabled"].includes(String(row.status || "").toLowerCase())) return false;
    return true;
  }

  function patronMayUse(featureKey, userOrEmail, profile = null) {
    if (isSuperAdmin(userOrEmail, profile)) return true;
    const gates = cachedPatronGates;
    return gates[featureKey] !== false;
  }

  function venueMayUse(featureKey, clubRow = {}) {
    if (!entityIsAppEnabled(clubRow)) return false;
    const gates = normalizeVenueGates(clubRow);
    return gates[featureKey] !== false;
  }

  async function loadPatronGates(db) {
    if (!db) return cachedPatronGates;
    try {
      const snap = await db.collection("platformSettings").doc("patronFeatureGates").get();
      if (snap.exists) cachedPatronGates = normalizePatronGates(snap.data() || {});
      else cachedPatronGates = { ...DEFAULT_PATRON_GATES };
      patronGatesLoaded = true;
    } catch (e) {
      cachedPatronGates = { ...DEFAULT_PATRON_GATES };
    }
    return cachedPatronGates;
  }

  function getPatronGates() {
    return { ...cachedPatronGates };
  }

  function setCachedPatronGates(raw) {
    cachedPatronGates = normalizePatronGates(raw);
    patronGatesLoaded = true;
    return cachedPatronGates;
  }

  async function loadVenueRecord(db, clubId) {
    const id = String(clubId || "").trim();
    if (!id || !db) return null;
    if (venueGateCache.has(id)) return venueGateCache.get(id);
    try {
      const snap = await db.collection("clubLocations").doc(id).get();
      const staticRow = (root.SHOUTOUT_CLUB_LOCATIONS || {})[id] || {};
      const row = snap.exists ? { id, ...staticRow, ...snap.data() } : { id, ...staticRow };
      venueGateCache.set(id, row);
      return row;
    } catch (e) {
      const fallback = { id, ...(root.SHOUTOUT_CLUB_LOCATIONS || {})[id] };
      venueGateCache.set(id, fallback);
      return fallback;
    }
  }

  function invalidateVenueCache(clubId) {
    if (clubId) venueGateCache.delete(String(clubId));
    else venueGateCache.clear();
  }

  function applyPatronGateUi(userOrEmail, profile = null) {
    const map = [
      ["bartr", ["bartrBtnCard", "confirmGoBartrBtn"]],
      ["rydr", ["rydrBtnCard"]],
      ["mingl", ["minglBtnCard", "confirmGoMinglBtn"]],
      ["shoutOut", ["shoutoutBtnCard", "clubShoutoutBtn"]],
      ["floqAi", ["floqAiMark", "floqAiHelpBtn", "intentSearchOpenBtn", "askFloqrOpenBtn"]]
    ];
    map.forEach(([key, ids]) => {
      const allowed = patronMayUse(key, userOrEmail, profile);
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle("hidden", !allowed);
        el.setAttribute("aria-disabled", allowed ? "false" : "true");
        if ("disabled" in el) el.disabled = !allowed;
      });
    });
    document.querySelectorAll("[data-floqai-gate]").forEach(el => {
      const allowed = patronMayUse("floqAi", userOrEmail, profile);
      el.classList.toggle("hidden", !allowed);
    });
  }

  root.FLOQRFeatureGates = {
    SUPER_ADMIN_EMAILS,
    DEFAULT_PATRON_GATES,
    DEFAULT_VENUE_GATES,
    PATRON_GATE_LABELS,
    VENUE_GATE_LABELS,
    isSuperAdmin,
    isMasterAdminEmail,
    normalizePatronGates,
    normalizeVenueGates,
    entityIsOffboarded,
    entityIsAppEnabled,
    entityIsPubliclyVisible,
    patronMayUse,
    venueMayUse,
    loadPatronGates,
    getPatronGates,
    setCachedPatronGates,
    loadVenueRecord,
    invalidateVenueCache,
    applyPatronGateUi,
    patronGatesLoaded: () => patronGatesLoaded
  };
})(window);
