/* Master Admin entity search + enable/disable + offboard + feature gates. */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const gates = () => window.FLOQRFeatureGates;

  let db = null;
  let auth = null;
  let functions = null;
  let catalog = {clubs:[], events:[], users:[]};
  let selected = null;
  let clubUrlFilter = "";
  let pendingManage = null;

  function setStatus(msg) {
    const el = byId("entityManageStatus");
    if (el) el.textContent = msg || "";
  }

  function callable(name) {
    if (!functions) functions = firebase.app().functions("us-central1");
    return functions.httpsCallable(name);
  }

  function entityTitle(row, type) {
    if (type === "club") return row.locationName || row.brandName || row.id;
    if (type === "event") return row.title || row.name || row.id;
    return row.displayName || row.fullName || row.floqrHandle || row.email || row.uid || row.id;
  }

  function entityMeta(row, type) {
    if (type === "club") return [row.city, row.region || row.state, row.country, row.id].filter(Boolean).join(" · ");
    if (type === "event") return [row.city, row.clubLocationId || row.locationId, row.id].filter(Boolean).join(" · ");
    return [row.email, row.city, row.uid || row.id].filter(Boolean).join(" · ");
  }

  function matchesQuery(row, type, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return false;
    const blob = [
      entityTitle(row, type),
      entityMeta(row, type),
      row.id, row.uid, row.email, row.floqrHandle, row.username,
      row.streetAddress, row.address, row.brandName, row.locationLabel,
      ...(row.genres || [])
    ].join(" ").toLowerCase();
    return q.split(/\s+/).every(token => blob.includes(token));
  }

  function statusBadge(row) {
    const g = gates();
    if (g?.entityIsOffboarded(row)) return `<span class="entity-badge entity-badge-off">Offboarded</span>`;
    if (!g?.entityIsAppEnabled(row)) return `<span class="entity-badge entity-badge-off">Disabled</span>`;
    if (g?.isSuperAdmin(row.email, row) || row.superAdmin) return `<span class="entity-badge entity-badge-super">Super Admin</span>`;
    return `<span class="entity-badge entity-badge-on">Enabled</span>`;
  }

  async function refreshCatalog(existingLocations = null) {
    const clubs = existingLocations && existingLocations.length
      ? existingLocations.map(row => ({...row, id:row.id}))
      : [];
    if (!clubs.length) {
      try {
        const snap = await db.collection("clubLocations").limit(500).get();
        snap.forEach(doc => clubs.push({id:doc.id, ...doc.data()}));
      } catch (e) {}
      Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || {}).forEach(([id, data]) => {
        if (!clubs.some(c => c.id === id)) clubs.push({id, ...data});
      });
    }

    const events = [];
    try {
      const snap = await db.collection("events").limit(300).get();
      snap.forEach(doc => events.push({id:doc.id, ...doc.data()}));
    } catch (e) {}
    Object.entries(window.SHOUTOUT_EVENTS || {}).forEach(([id, data]) => {
      if (!events.some(ev => ev.id === id)) events.push({id, ...data});
    });

    const users = [];
    try {
      const snap = await db.collection("users").limit(400).get();
      snap.forEach(doc => users.push({uid:doc.id, id:doc.id, ...doc.data()}));
    } catch (e) {}

    catalog = {clubs, events, users};
    return catalog;
  }

  function searchResults(query) {
    const q = String(query || "").trim().toLowerCase();
    const typeFilter = byId("entityManageTypeFilter")?.value || "all";
    const rows = [];
    if (typeFilter === "all" || typeFilter === "club") {
      catalog.clubs.filter(row => matchesQuery(row, "club", q)).slice(0, 40).forEach(row => rows.push({type:"club", row}));
    }
    if (typeFilter === "all" || typeFilter === "event") {
      catalog.events.filter(row => matchesQuery(row, "event", q)).slice(0, 20).forEach(row => rows.push({type:"event", row}));
    }
    if (typeFilter === "all" || typeFilter === "user") {
      catalog.users.filter(row => matchesQuery(row, "user", q)).slice(0, 30).forEach(row => rows.push({type:"user", row}));
    }
    return rows;
  }

  function renderSearchResults() {
    const wrap = byId("entityManageResults");
    if (!wrap) return;
    const query = String(byId("entityManageSearch")?.value || "").trim();
    if (!query) {
      wrap.innerHTML = `<p class="sub">Type a search to find a venue, event, or patron. No entities are listed until you search.</p>`;
      return;
    }
    const rows = searchResults(query);
    if (!rows.length) {
      wrap.innerHTML = `<p class="sub">No matching venues, events, or patrons. Try another search.</p>`;
      return;
    }
    wrap.innerHTML = rows.map(({type, row}) => {
      const id = row.id || row.uid;
      const selectedClass = selected && selected.type === type && selected.id === id ? "selected" : "";
      return `<button class="entity-result-card ${selectedClass}" type="button" data-entity-type="${esc(type)}" data-entity-id="${esc(id)}">
        <strong>${esc(entityTitle(row, type))}</strong>
        <span class="entity-type-pill">${esc(type)}</span>
        ${statusBadge(row)}
        <small>${esc(entityMeta(row, type))}</small>
      </button>`;
    }).join("");
    wrap.querySelectorAll("[data-entity-id]").forEach(btn => {
      btn.addEventListener("click", () => selectEntity(btn.dataset.entityType, btn.dataset.entityId));
    });
  }

  function findEntity(type, id) {
    const list = type === "club" ? catalog.clubs : type === "event" ? catalog.events : catalog.users;
    return list.find(row => String(row.id || row.uid) === String(id)) || null;
  }

  function selectEntity(type, id) {
    const row = findEntity(type, id);
    if (!row) {
      setStatus("Entity not found in catalog.");
      return;
    }
    selected = {type, id, row};
    renderSearchResults();
    renderManagePanel();
  }

  function venueGateChecks(row) {
    const g = gates()?.normalizeVenueGates(row) || {};
    return Object.entries(gates()?.VENUE_GATE_LABELS || {}).map(([key, label]) => `
      <label class="entity-gate-toggle"><input type="checkbox" data-venue-gate="${esc(key)}" ${g[key] !== false ? "checked" : ""}/> ${esc(label)}</label>
    `).join("");
  }

  function renderManagePanel() {
    const wrap = byId("entityManageDetail");
    if (!wrap) return;
    if (!selected) {
      wrap.innerHTML = `<p class="sub">Search and select an entity to manage enable/disable, feature gates, or offboarding.</p>`;
      return;
    }
    const {type, row, id} = selected;
    const g = gates();
    const enabled = g?.entityIsAppEnabled(row);
    const offboarded = g?.entityIsOffboarded(row);
    const isSuper = type === "user" && (g?.isSuperAdmin(row.email, row) || row.superAdmin);
    const adminUrl = type === "club" ? `./admin.html?location=${encodeURIComponent(id)}&v=29.09.22&from=master` : "";
    const displayUrl = type === "club" ? (window.FLOQRNav?.stableDisplayUrl?.(id) || `./display.html?location=${encodeURIComponent(id)}`) : "";
    const profileUrl = type === "club" ? `./club-profile.html?location=${encodeURIComponent(id)}&v=29.09.22` : "";

    wrap.innerHTML = `
      <div class="entity-manage-head">
        <div>
          <p class="eyebrow">${esc(type)}</p>
          <h3>${esc(entityTitle(row, type))}</h3>
          <p class="sub small">${esc(entityMeta(row, type))}</p>
          ${statusBadge(row)}
        </div>
        ${type === "club" ? `<div class="queue-actions">
          <a class="buttonlike" href="${esc(adminUrl)}">Open Club Admin</a>
          <a class="buttonlike" href="${esc(displayUrl)}" target="_blank" rel="noopener">Display</a>
          <a class="buttonlike" href="${esc(profileUrl)}" target="_blank" rel="noopener">Public profile</a>
        </div>` : ""}
      </div>
      <div class="entity-manage-controls">
        <label class="entity-gate-toggle entity-enable-switch">
          <input id="entityAppEnabledToggle" type="checkbox" ${enabled ? "checked" : ""} ${offboarded || isSuper ? "disabled" : ""}/>
          Application access enabled
        </label>
        ${isSuper ? `<p class="sub small">Super Admin is exempt from disable/offboard in this tool.</p>` : ""}
        ${offboarded ? `<p class="sub small">This entity is offboarded. Public profile datapoints were removed.</p>` : ""}
      </div>
      ${type === "club" && !offboarded ? `
        <div class="card entity-gate-card">
          <h4>Per-venue feature gates</h4>
          <p class="sub small">Disable venue ability to use UberAds, WindowAds, BartR Stores, or ShoutOut.</p>
          <div class="privacy-datapoint-grid">${venueGateChecks(row)}</div>
          <button id="saveVenueGatesBtn" class="primary" type="button">Save Venue Feature Gates</button>
        </div>` : ""}
      ${!isSuper && !offboarded ? `
        <div class="card entity-offboard-card">
          <h4>Offboard</h4>
          <p class="sub small">Removes the public profile and datapoints from the WebApp. Requires typing the entity name to confirm. This is intended for venues/entities that cease to exist publicly.</p>
          <label>Type <strong>${esc(entityTitle(row, type))}</strong> to confirm
            <input id="entityOffboardConfirm" autocomplete="off" placeholder="${esc(entityTitle(row, type))}"/>
          </label>
          <button id="entityOffboardBtn" class="danger" type="button">Offboard Entity</button>
        </div>` : ""}
    `;

    byId("entityAppEnabledToggle")?.addEventListener("change", async (event) => {
      const next = !!event.target.checked;
      try {
        setStatus(next ? "Enabling entity..." : "Disabling entity...");
        await callable("setEntityAppEnabled")({entityType:type, entityId:id, enabled:next, email:row.email || ""});
        row.appEnabled = next;
        row.active = next;
        row.status = next ? "active" : "disabled";
        gates()?.invalidateVenueCache?.(id);
        setStatus(next ? "Entity enabled." : "Entity disabled — FLOQR application access revoked.");
        renderManagePanel();
        renderSearchResults();
        renderClubAdminUrlFilter();
      } catch (e) {
        event.target.checked = !next;
        setStatus(e.message || String(e));
      }
    });

    byId("saveVenueGatesBtn")?.addEventListener("click", async () => {
      const nextGates = {};
      wrap.querySelectorAll("[data-venue-gate]").forEach(input => {
        nextGates[input.dataset.venueGate] = !!input.checked;
      });
      try {
        setStatus("Saving venue feature gates...");
        await callable("setVenueFeatureGates")({clubId:id, gates:nextGates});
        row.featureGates = nextGates;
        gates()?.invalidateVenueCache?.(id);
        setStatus("Venue feature gates saved.");
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });

    byId("entityOffboardBtn")?.addEventListener("click", async () => {
      const confirmName = byId("entityOffboardConfirm")?.value || "";
      if (!confirmName) {
        setStatus("Type the entity name to confirm offboarding.");
        return;
      }
      if (!window.confirm(`Offboard "${entityTitle(row, type)}"? Public profile fields will be cleared. This cannot be undone from this tool.`)) return;
      try {
        setStatus("Offboarding entity...");
        await callable("offboardEntity")({entityType:type, entityId:id, confirmName, email:row.email || ""});
        row.offboarded = true;
        row.appEnabled = false;
        row.active = false;
        row.status = "offboarded";
        gates()?.invalidateVenueCache?.(id);
        setStatus("Entity offboarded. Public profile datapoints removed from the WebApp.");
        renderManagePanel();
        renderSearchResults();
        renderClubAdminUrlFilter();
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
  }

  function renderGlobalPatronGates() {
    const wrap = byId("globalPatronGatesForm");
    if (!wrap) return;
    const current = gates()?.getPatronGates?.() || gates()?.DEFAULT_PATRON_GATES || {};
    wrap.innerHTML = Object.entries(gates()?.PATRON_GATE_LABELS || {}).map(([key, label]) => `
      <label class="entity-gate-toggle"><input type="checkbox" data-patron-gate="${esc(key)}" ${current[key] !== false ? "checked" : ""}/> ${esc(label)}</label>
    `).join("") + `<p class="sub small">Super Admin remains exempt from these global disables.</p>`;
  }

  async function saveGlobalPatronGates() {
    const next = {};
    document.querySelectorAll("[data-patron-gate]").forEach(input => {
      next[input.dataset.patronGate] = !!input.checked;
    });
    try {
      setStatus("Saving global patron feature gates...");
      await callable("setPatronFeatureGates")({gates:next});
      gates()?.setCachedPatronGates?.(next);
      setStatus("Global patron feature gates saved. Super Admin remains exempt.");
      renderGlobalPatronGates();
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  function renderClubAdminUrlFilter() {
    const wrap = byId("clubAdminUrlList");
    const search = byId("clubAdminUrlSearch");
    if (!wrap) return;
    const q = String(search?.value || clubUrlFilter || "").trim().toLowerCase();
    clubUrlFilter = q;
    const rows = catalog.clubs
      .filter(row => row && row.id)
      .filter(row => !q || matchesQuery(row, "club", q))
      .sort((a, b) => entityTitle(a, "club").localeCompare(entityTitle(b, "club")));
    wrap.innerHTML = rows.length ? rows.map(row => {
      const admin = `./admin.html?location=${encodeURIComponent(row.id)}&v=29.09.22&from=master`;
      const display = window.FLOQRNav?.stableDisplayUrl?.(row.id) || `./display.html?location=${encodeURIComponent(row.id)}`;
      const where = [row.city, row.region || row.state || row.province, row.country].filter(Boolean).join(", ");
      const primary = row.primaryDisplayScreenFormatId || row.displayType || row.screenFormatId || "—";
      const g = gates();
      const enabled = g?.entityIsAppEnabled(row);
      return `<div class="queue-item ${enabled ? "" : "entity-row-disabled"}">
        <div class="message-envelope-head">
          <strong>${esc(entityTitle(row, "club"))}</strong>
          <span>${esc(row.id)}</span>
        </div>
        ${statusBadge(row)}
        <p>${esc(where || row.locationLabel || "Location details not added yet")}</p>
        <p><strong>Primary display:</strong> ${esc(primary)}</p>
        <p><strong>Admin Portal:</strong> <a class="message-inline-link" href="${esc(admin)}">${esc(admin)}</a></p>
        <p><strong>Display URL:</strong> <a class="message-inline-link" href="${esc(display)}">${esc(display)}</a></p>
        <div class="queue-actions">
          <button type="button" data-manage-club="${esc(row.id)}">Manage entity</button>
        </div>
      </div>`;
    }).join("") : "<p class='sub'>No club locations match this search.</p>";
    wrap.querySelectorAll("[data-manage-club]").forEach(btn => {
      btn.addEventListener("click", () => {
        pendingManage = {type:"club", id:btn.dataset.manageClub, query:btn.dataset.manageClub};
        document.querySelector('[data-panel="entityManagement"]')?.click();
      });
    });
  }

  function applyPendingManage() {
    if (!pendingManage) return;
    if (!window.FLOQRSOS2FA?.isUnlocked?.("entityManagement")) return;
    const {type, id, query} = pendingManage;
    pendingManage = null;
    if (byId("entityManageSearch")) byId("entityManageSearch").value = query || id || "";
    if (byId("entityManageTypeFilter")) byId("entityManageTypeFilter").value = type === "club" ? "club" : "all";
    if (id) selectEntity(type || "club", id);
    else renderSearchResults();
  }

  function onSos2faUnlocked() {
    applyPendingManage();
    renderSearchResults();
    renderManagePanel();
    renderGlobalPatronGates();
  }

  async function mount(options = {}) {
    db = options.db || firebase.firestore();
    auth = options.auth || firebase.auth();
    if (options.locations) await refreshCatalog(options.locations);
    else await refreshCatalog();
    try { await gates()?.loadPatronGates?.(db); } catch (e) {}
    renderGlobalPatronGates();
    renderSearchResults();
    renderManagePanel();
    renderClubAdminUrlFilter();

    byId("entityManageSearch")?.addEventListener("input", renderSearchResults);
    byId("entityManageTypeFilter")?.addEventListener("change", renderSearchResults);
    byId("entityManageRefreshBtn")?.addEventListener("click", async () => {
      setStatus("Refreshing entity catalog...");
      await refreshCatalog(options.locations || null);
      renderSearchResults();
      renderClubAdminUrlFilter();
      setStatus("Entity catalog refreshed.");
    });
    byId("saveGlobalPatronGatesBtn")?.addEventListener("click", saveGlobalPatronGates);
    byId("clubAdminUrlSearch")?.addEventListener("input", renderClubAdminUrlFilter);
    byId("clubAdminUrlManageSearchBtn")?.addEventListener("click", () => {
      const q = byId("clubAdminUrlSearch")?.value || "";
      pendingManage = {type:"club", query:q};
      document.querySelector('[data-panel="entityManagement"]')?.click();
    });
    byId("sos2faRelockBtn")?.addEventListener("click", () => {
      window.FLOQRSOS2FA?.lock?.("entityManagement");
      window.FLOQRSOS2FA?.syncGateUi?.("entityManagement", false);
      window.FLOQRSOS2FA?.requireUnlock?.("entityManagement");
    });
    if (window.FLOQRSOS2FA?.isUnlocked?.("entityManagement")) {
      window.FLOQRSOS2FA.syncGateUi("entityManagement", true);
      onSos2faUnlocked();
    } else {
      window.FLOQRSOS2FA?.syncGateUi?.("entityManagement", false);
    }
  }

  function updateLocations(locations = []) {
    catalog.clubs = locations.map(row => ({...row, id:row.id}));
    renderClubAdminUrlFilter();
    if (selected?.type === "club") {
      const fresh = findEntity("club", selected.id);
      if (fresh) selected.row = fresh;
      renderManagePanel();
    }
    renderSearchResults();
  }

  window.FLOQREntityManagement = {mount, updateLocations, refreshCatalog, selectEntity, renderClubAdminUrlFilter, onSos2faUnlocked};
})();
