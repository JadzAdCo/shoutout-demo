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

  function masterAdminUrl(locationId = "") {
    const id = String(locationId || "").trim();
    if (window.FLOQRNav?.adminPortalUrl) return window.FLOQRNav.adminPortalUrl(id);
    if (window.FLOQRNav?.adminHome) return window.FLOQRNav.adminHome({location: id, from: "master"});
    return `./admin.html?location=${encodeURIComponent(id)}&from=master`;
  }

  function absoluteUrl(href = "") {
    try { return new URL(href, window.location.href).toString(); }
    catch (_) { return String(href || ""); }
  }

  /** Xibo fallback page per board; display-error.html never carries ?v=. */
  function xiboDiagUrl(locationId, board) {
    const url = new URL("./display-error.html", window.location.href);
    url.searchParams.set("location", String(locationId || "").trim().toLowerCase());
    url.searchParams.set("board", String(board));
    url.searchParams.set("reason", "xibo_page_load_error");
    return url.toString();
  }

  function clubLinkOutputs(id) {
    const displayUrl = window.FLOQRNav?.stableDisplayUrl?.(id) || `./display.html?location=${encodeURIComponent(id)}`;
    const display2Url = window.FLOQRNav?.stableSecondaryDisplayUrl?.(id) || `./display2.html?location=${encodeURIComponent(id)}`;
    const profileUrl = window.FLOQRNav?.stampCurrentVersion?.(`./club-profile.html`, {location: id})
      || `./club-profile.html?location=${encodeURIComponent(id)}`;
    return {
      admin: {label: "Open Club Admin", hint: "Club Admin console for this venue (opens as Master Admin).", links: [{name: "Club Admin", url: absoluteUrl(masterAdminUrl(id))}]},
      display1: {label: "Display 1", hint: "Primary LED board. Paste into the Xibo Webpage widget exactly as shown.", links: [{name: "Display 1", url: absoluteUrl(displayUrl)}]},
      display2: {label: "Display 2", hint: "Secondary LED board (supRstar). Paste into the Xibo Webpage widget exactly as shown.", links: [{name: "Display 2", url: absoluteUrl(display2Url)}]},
      profile: {label: "Public profile", hint: "Patron-facing Club Public Profile.", links: [{name: "Public profile", url: absoluteUrl(profileUrl)}]},
      xibo: {label: "Xibo Diag", hint: "Paste into the Xibo Webpage widget on each board's error / fallback layout. Load failures appear under Diagnostics → Display / Xibo Load Errors.", links: [
        {name: "Display 1 fallback", url: xiboDiagUrl(id, 1)},
        {name: "Display 2 fallback", url: xiboDiagUrl(id, 2)}
      ]}
    };
  }

  function renderLinkOutput(kind) {
    const host = byId("entityLinkOutput");
    if (!host || !selected || selected.type !== "club") return;
    const entry = clubLinkOutputs(selected.id)[kind];
    if (!entry) return;
    markActiveLinkButton(kind);
    host.hidden = false;
    host.innerHTML = `
      <div class="entity-link-output-head">
        <h4 id="entityLinkOutputTitle">${esc(entry.label)}</h4>
        <button type="button" class="entity-link-close" data-entity-link-close aria-label="Close link output">Close</button>
      </div>
      <p class="sub small">${esc(entry.hint)}</p>
      ${entry.links.map((link, idx) => `
        <div class="entity-link-row">
          <label for="entityLinkUrl${idx}">${esc(link.name)}</label>
          <textarea id="entityLinkUrl${idx}" class="entity-link-url" rows="2" readonly spellcheck="false">${esc(link.url)}</textarea>
          <div class="entity-link-row-actions">
            <button type="button" class="primary" data-entity-link-copy="${idx}">Copy</button>
            <a class="buttonlike" href="${esc(link.url)}" target="_blank" rel="noopener">Open in new tab</a>
          </div>
        </div>`).join("")}
      <p class="sub small entity-link-copied" role="status" aria-live="polite"></p>
    `;
    fitLinkFields(host);
    host.querySelectorAll("[data-entity-link-copy]").forEach(btn => {
      btn.addEventListener("click", () => copyLinkOutput(host, btn));
    });
    host.querySelector("[data-entity-link-close]")?.addEventListener("click", () => {
      host.hidden = true;
      host.innerHTML = "";
      markActiveLinkButton("");
    });
    host.scrollIntoView?.({block: "nearest", behavior: "smooth"});
  }

  function fitLinkFields(host = byId("entityLinkOutput")) {
    host?.querySelectorAll(".entity-link-url").forEach(field => {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight + 2}px`;
    });
  }
  window.addEventListener("resize", () => fitLinkFields());

  function markActiveLinkButton(kind) {
    document.querySelectorAll("[data-entity-link]").forEach(btn => {
      const on = btn.dataset.entityLink === kind;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  async function copyLinkOutput(host, btn) {
    const field = host.querySelector(`#entityLinkUrl${btn.dataset.entityLinkCopy}`);
    const note = host.querySelector(".entity-link-copied");
    const value = field?.value || "";
    try {
      await navigator.clipboard.writeText(value);
      if (note) note.textContent = "Copied to clipboard.";
    } catch (_) {
      field?.focus();
      field?.select();
      if (note) note.textContent = "Copy blocked by the browser — the link is selected; press Ctrl+C / long-press Copy.";
    }
  }

  function mergeClubRows(locationRows = [], clubRows = []) {
    const merged = new Map();
    locationRows.forEach((row = {}) => {
      const id = String(row.id || row.clubId || "").trim();
      if (!id) return;
      merged.set(id, {...row, id});
    });
    clubRows.forEach((row = {}) => {
      const id = String(row.id || row.clubId || row.primaryLocationId || "").trim();
      if (!id) return;
      const prev = merged.get(id) || {id};
      merged.set(id, {
        ...row,
        ...prev,
        id,
        displayScreenFormatIds: prev.displayScreenFormatIds || row.displayScreenFormatIds,
        primaryDisplayScreenFormatId: prev.primaryDisplayScreenFormatId || row.primaryDisplayScreenFormatId,
        displayFooterBrand: prev.displayFooterBrand || row.displayFooterBrand,
        city: prev.city || row.city,
        region: prev.region || row.region,
        country: prev.country || row.country
      });
    });
    return Array.from(merged.values());
  }

  function callableFn(name) {
    if (!functions) functions = firebase.app().functions("us-central1");
    return functions.httpsCallable(name);
  }

  async function invokeCallable(name, data = {}) {
    const sessionId = window.FLOQRSOS2FA?.getSessionId?.("entityManagement") || "";
    return callableFn(name)({...data, sos2faSessionId: sessionId});
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
    let locationRows = existingLocations && existingLocations.length
      ? existingLocations.map(row => ({...row, id:row.id}))
      : [];
    if (!locationRows.length) {
      try {
        const snap = await db.collection("clubLocations").limit(500).get();
        snap.forEach(doc => locationRows.push({id:doc.id, ...doc.data()}));
      } catch (e) {}
      Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || {}).forEach(([id, data]) => {
        if (!locationRows.some(c => c.id === id)) locationRows.push({id, ...data});
      });
    }
    const clubDocs = [];
    try {
      const snap = await db.collection("clubs").limit(500).get();
      snap.forEach(doc => clubDocs.push({id:doc.id, ...doc.data()}));
    } catch (e) {}
    const clubs = mergeClubRows(locationRows, clubDocs);

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
    const linkKinds = type === "club" ? Object.entries(clubLinkOutputs(id)) : [];

    wrap.innerHTML = `
      <div class="entity-manage-head">
        <div class="entity-manage-title">
          <p class="eyebrow">${esc(type)}</p>
          <h3>${esc(entityTitle(row, type))}</h3>
          <p class="sub small">${esc(entityMeta(row, type))}</p>
          ${statusBadge(row)}
        </div>
        ${type === "club" ? `<div class="entity-link-buttons" role="group" aria-label="Venue links">
          ${linkKinds.map(([kind, entry]) => `<button type="button" class="buttonlike" data-entity-link="${esc(kind)}" aria-controls="entityLinkOutput" aria-expanded="false">${esc(entry.label)}</button>`).join("")}
        </div>` : ""}
      </div>
      ${type === "club" ? `<section id="entityLinkOutput" class="entity-link-output" aria-labelledby="entityLinkOutputTitle" hidden></section>` : ""}
      <div class="entity-manage-controls">
        <label class="entity-gate-toggle entity-enable-switch">
          <input id="entityAppEnabledToggle" type="checkbox" ${enabled ? "checked" : ""} ${offboarded || isSuper ? "disabled" : ""}/>
          <span>Allow application access</span>
        </label>
        <p class="sub small entity-enable-help">${type === "club"
          ? "Master switch for this venue. Unticked: Club Admin is locked, the venue is hidden from Search, and the server refuses its ShoutOut, supRstar, BartR and ad features. Reversible — the profile and data stay. Use Offboard to remove the venue permanently."
          : type === "event"
            ? "Unticked: the event is hidden and inactive. Reversible."
            : "Unticked: this account is blocked from FLOQR features. Reversible."}</p>
        ${isSuper ? `<p class="sub small">Super Admin is exempt from disable/offboard in this tool.</p>` : ""}
        ${offboarded ? `<p class="sub small">This entity is offboarded. Public profile datapoints were removed.</p>` : ""}
      </div>
      ${type === "club" && !offboarded ? `
        <div class="card entity-gate-card">
          <h4>Per-venue feature gates</h4>
          <p class="sub small">Disable venue ability to use UberAds, WindowAds, BartR Stores, ShoutOut, or supRstar.</p>
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

    wrap.querySelectorAll("[data-entity-link]").forEach(btn => {
      btn.addEventListener("click", () => renderLinkOutput(btn.dataset.entityLink));
    });

    byId("entityAppEnabledToggle")?.addEventListener("change", async (event) => {
      const next = !!event.target.checked;
      try {
        setStatus(next ? "Enabling entity..." : "Disabling entity...");
        await invokeCallable("setEntityAppEnabled", {entityType:type, entityId:id, enabled:next, email:row.email || ""});
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
        await invokeCallable("setVenueFeatureGates", {clubId:id, gates:nextGates});
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
        await invokeCallable("offboardEntity", {entityType:type, entityId:id, confirmName, email:row.email || ""});
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
      await invokeCallable("setPatronFeatureGates", {gates:next});
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
      const admin = masterAdminUrl(row.id);
      const where = [row.city, row.region || row.state || row.province, row.country].filter(Boolean).join(", ");
      const g = gates();
      const enabled = g?.entityIsAppEnabled(row);
      return `<div class="queue-item ${enabled ? "" : "entity-row-disabled"}">
        <div class="message-envelope-head">
          <strong>${esc(entityTitle(row, "club"))}</strong>
          <span>${esc(row.id)}</span>
        </div>
        ${statusBadge(row)}
        <p>${esc(where || row.locationLabel || "Location details not added yet")}</p>
        <p><strong>Venue Admin Portal URL:</strong> <a class="message-inline-link" href="${esc(admin)}" target="_blank" rel="noopener">${esc(admin)}</a></p>
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
