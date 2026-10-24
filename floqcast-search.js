/* floqCast entry — standardized feature landing (FLOQRFeatureLanding) → private preview. */
(function (global) {
  "use strict";

  const FL = () => global.FLOQRFeatureLanding;
  const FEATURE = () => FL()?.FEATURES?.FLOQCAST || "floqCast";

  let venueRows = [];
  let selectedVenueId = "";
  let locationContext = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function t(key, fallback, vars) {
    return FL()?.t?.(key, fallback, vars) || (fallback || key);
  }

  function esc(s) {
    return FL()?.esc?.(s) || String(s || "");
  }

  function setStatus(msg) {
    const el = byId("floqcastGateStatus");
    if (el) el.textContent = msg || "";
  }

  function setLiveStatus(msg) {
    const el = byId("floqcastLiveStatus");
    if (el) el.textContent = msg || "";
  }

  function setVenueStatus(msg) {
    const el = byId("floqcastEntitlementStatus");
    if (el) el.textContent = msg;
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function accessCheck(user) {
    if (!user) return {ok: false, reason: "Sign in to use floqCast."};
    const email = String(user.email || "").toLowerCase();
    if (!email || !email.includes("@")) return {ok: false, reason: "Sign in with Google or Microsoft (email required)."};
    return {ok: true, email};
  }

  function showGate(show) {
    byId("floqcastGate")?.classList.toggle("hidden", !show);
    byId("floqcastApp")?.classList.toggle("hidden", show);
  }

  function eventNamesByLocation() {
    const map = Object.create(null);
    const events = global.SHOUTOUT_EVENTS || {};
    for (const ev of Object.values(events)) {
      const locId = String(ev?.locationId || ev?.clubLocationId || "").trim();
      const name = String(ev?.eventName || "").trim();
      if (!locId || !name) continue;
      if (!map[locId]) map[locId] = [];
      if (!map[locId].includes(name)) map[locId].push(name);
    }
    return map;
  }

  function sortVenuesNearest(rows) {
    return FL()?.sortNearest?.(rows, locationContext) || rows.slice();
  }

  function filteredVenues() {
    const q = String(byId("floqcastVenueSearch")?.value || "").trim();
    if (FL()?.filterAndRank) {
      return FL().filterAndRank(venueRows, {query: q, locationContext});
    }
    return venueRows.slice(0, 4);
  }

  function updateVenueStatusLine(visibleCount) {
    const q = String(byId("floqcastVenueSearch")?.value || "").trim();
    const total = venueRows.length;
    if (!total) {
      setVenueStatus(t("page.floqcast.noVenues", "No venues currently allow floqCast."));
      return;
    }
    setVenueStatus(FL()?.statusLine?.({
      total,
      shown: visibleCount,
      query: q,
      locationContext,
      featureLabel: "floqCast venues"
    }) || `${visibleCount} venue(s)`);
  }

  function syncSelect() {
    const sel = byId("floqcastVenueSelect");
    if (!sel) return;
    sel.innerHTML = venueRows.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
    if (selectedVenueId && venueRows.some((r) => r.id === selectedVenueId)) sel.value = selectedVenueId;
    else if (venueRows[0]) {
      selectedVenueId = venueRows[0].id;
      sel.value = selectedVenueId;
    }
  }

  function renderVenueGrid() {
    const grid = byId("floqcastVenueGrid");
    if (!grid) return;
    const rows = filteredVenues();
    updateVenueStatusLine(rows.length);
    if (!rows.length) {
      grid.innerHTML = `<p class="sub small">${esc(t("page.floqcast.noMatch", "No floqCast venues match that search."))}</p>`;
      return;
    }
    grid.innerHTML = rows.map((r) => {
      const selected = r.id === selectedVenueId;
      const ctaLabel = selected
        ? t("page.floqcast.goLiveCta", "Go live, start a cast")
        : t("page.floqcast.selectVenue", "Select venue");
      const ctaAttr = selected
        ? `data-go-live-venue="${esc(r.id)}"`
        : `data-select-venue="${esc(r.id)}"`;
      if (FL()?.renderVenueCardHtml) {
        return FL().renderVenueCardHtml(r, {
          feature: FEATURE(),
          selected,
          ctaLabel,
          ctaAttr,
          productBadge: "floqCast"
        }).replace("feature-landing-card", "feature-landing-card floqcast-venue-item");
      }
      return `<article class="card club-card floqcast-venue-item${selected ? " is-selected" : ""}" data-venue-id="${esc(r.id)}">
        <strong>${esc(r.name)}</strong>
        <button type="button" class="buttonlike ${selected ? "primary" : ""}" ${ctaAttr}>${esc(ctaLabel)}</button>
      </article>`;
    }).join("");
    syncGoLiveChrome();
  }

  function syncGoLiveChrome() {
    const sticky = byId("floqcastGoLiveBtn");
    if (!sticky) return;
    const venue = venueRows.find((r) => r.id === selectedVenueId);
    if (!venue) {
      sticky.disabled = true;
      sticky.textContent = t("page.floqcast.selectFirstCta", "Select a venue to go live");
      sticky.classList.add("is-waiting");
      return;
    }
    sticky.disabled = false;
    sticky.classList.remove("is-waiting");
    sticky.textContent = t("page.floqcast.goLiveAt", "Go live at {venue}", {venue: venue.name});
  }

  function selectVenue(id) {
    if (!venueRows.some((r) => r.id === id)) return;
    selectedVenueId = id;
    const sel = byId("floqcastVenueSelect");
    if (sel) sel.value = id;
    renderVenueGrid();
    setLiveStatus(t("page.floqcast.readyGoLive", "Venue selected — tap Go live, start a cast to open private preview."));
  }

  function requestedLocationId() {
    try {
      return String(new URLSearchParams(location.search).get("location") || "").trim();
    } catch (_) {
      return "";
    }
  }

  async function resolvePatronLocation() {
    if (!FL()?.resolvePatronLocation) {
      locationContext = null;
      return;
    }
    locationContext = await FL().resolvePatronLocation({
      auth: firebase.auth(),
      onLateGps: (coords) => {
        if (!coords || coords.latitude == null || coords.longitude == null) return;
        locationContext = Object.assign({}, locationContext || {}, {
          source: "gps",
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy
        });
        venueRows = sortVenuesNearest(venueRows);
        if (venueRows[0] && !String(byId("floqcastVenueSearch")?.value || "").trim()) {
          selectedVenueId = venueRows[0].id;
          syncSelect();
        }
        renderVenueGrid();
      }
    });
  }

  async function loadVenues() {
    const map = global.SHOUTOUT_CLUB_LOCATIONS || {};
    const g = global.FLOQRFeatureGates;
    const db = firebase.firestore();
    const eventsByLoc = eventNamesByLocation();
    const rows = [];
    for (const [id, row] of Object.entries(map)) {
      let club = {id, ...row};
      try {
        if (g?.loadVenueRecord) club = await g.loadVenueRecord(db, id) || club;
      } catch (_) {}
      const enabled = g ? g.venueMayUse("floqCast", club) : true;
      if (!enabled) continue;
      const norm = FL()?.normalizeVenue?.(id, Object.assign({}, club, {eventNames: eventsByLoc[id] || []}))
        || {id, name: club.locationName || id, eventNames: eventsByLoc[id] || []};
      rows.push(norm);
    }

    setVenueStatus(t("page.floqcast.locating", "Finding venues near you…"));
    await resolvePatronLocation();

    venueRows = sortVenuesNearest(rows);
    if (!rows.length) {
      selectedVenueId = "";
      syncSelect();
      renderVenueGrid();
      setVenueStatus(t("page.floqcast.noVenues", "No venues currently allow floqCast."));
      byId("floqcastGoLiveBtn") && (byId("floqcastGoLiveBtn").disabled = true);
      return;
    }
    const deepLink = requestedLocationId();
    const preferred = venueRows.find((r) => r.id === deepLink)
      || venueRows.find((r) => r.id === selectedVenueId)
      || venueRows[0];
    selectedVenueId = preferred.id;
    if (deepLink && preferred.id === deepLink) {
      const search = byId("floqcastVenueSearch");
      if (search && !String(search.value || "").trim()) search.value = preferred.name || deepLink;
    }
    syncSelect();
    renderVenueGrid();
    byId("floqcastGoLiveBtn") && (byId("floqcastGoLiveBtn").disabled = false);
  }

  function selectedVenue() {
    const id = selectedVenueId || byId("floqcastVenueSelect")?.value || "";
    const row = venueRows.find((r) => r.id === id) || {};
    return {id, name: row.name || id};
  }

  async function logPopup(action, message, details = {}) {
    try {
      if (global.FLOQRPayments?.logPopupEvent) {
        await global.FLOQRPayments.logPopupEvent(action, message, {flow: "floqcast_search", ...details});
      } else if (global.FLOQRLog?.write) {
        await global.FLOQRLog.write({
          level: action === "popup_blocked" ? "warn" : "info",
          category: "checkout",
          action,
          message,
          details: {flow: "floqcast_search", ...details},
          source: "floqcast-search"
        });
      }
    } catch (_) {}
  }

  /** Relative paths on about:blank resolve to nowhere → blank screen after Select venue. */
  function absoluteAppUrl(path) {
    try {
      return new URL(String(path || "").replace(/^\.\//, ""), location.href).href;
    } catch (_) {
      return String(path || "");
    }
  }

  function preferSameTabPreview() {
    try {
      const ua = String(navigator.userAgent || "");
      // iPhone/iPad Safari + in-app browsers often leave about:blank tabs blank after
      // relative navigations; same-tab is the reliable floqCast path on mobile.
      return /iPhone|iPad|iPod|Android/i.test(ua) || window.matchMedia?.("(max-width: 900px)")?.matches;
    } catch (_) {
      return true;
    }
  }

  async function beginFloqCast() {
    const venue = selectedVenue();
    if (!venue.id) {
      setLiveStatus(t("page.floqcast.chooseFirst", "Choose a venue first."));
      return;
    }
    const btn = byId("floqcastGoLiveBtn");
    if (btn) btn.disabled = true;
    const sameTab = preferSameTabPreview();
    let previewTab = null;
    if (!sameTab) {
      previewTab = window.open("about:blank", "floqr_floqcast_preview");
      if (previewTab) {
        try {
          previewTab.document.title = "floqCast Preview";
          previewTab.document.body.innerHTML = "<p style=\"font-family:sans-serif;padding:24px\">Opening your private floqCast preview…</p>";
          previewTab.opener = null;
        } catch (_) {}
      }
    }
    try {
      setLiveStatus(`Opening private preview for ${venue.name}…`);
      const res = await callable("createFloqCastRequest")({
        locationId: venue.id,
        locationName: venue.name,
        displayBoard: "secondary" // floqCast → display2.html only (never Display 1)
      });
      const path = res?.data?.previewPath || `./floqcast-preview.html?t=${encodeURIComponent(res?.data?.accessToken || "")}`;
      const withFrom = path.includes("?") ? `${path}&from=search` : `${path}?from=search`;
      // Must be absolute — about:blank + "./floqcast-preview.html" = blank page.
      const absUrl = absoluteAppUrl(withFrom);
      try { sessionStorage.setItem("floqr_floqcast_token", res?.data?.accessToken || ""); } catch (_) {}
      if (previewTab && !previewTab.closed) {
        previewTab.location.href = absUrl;
        await logPopup("popup_opened", "floqCast preview opened in new tab", {
          locationId: venue.id,
          popupName: "floqr_floqcast_preview",
          absUrl: true
        });
        setLiveStatus("Private preview opened in a new tab. Follow the steps there.");
      } else {
        await logPopup(sameTab ? "same_tab_preview" : "popup_blocked", "floqCast preview continuing in this tab", {
          locationId: venue.id,
          sameTab,
          tabBlocked: !previewTab
        });
        try { previewTab?.close(); } catch (_) {}
        location.assign(absUrl);
      }
    } catch (err) {
      try { previewTab?.close(); } catch (_) {}
      setLiveStatus(err?.message || "Could not start floqCast.");
      if (btn) btn.disabled = false;
      await logPopup("checkout_failed", err?.message || "Could not start floqCast.", {locationId: venue.id});
    }
  }

  function bindUi() {
    byId("floqcastGoLiveBtn")?.addEventListener("click", () => beginFloqCast());
    byId("floqcastVenueSearch")?.addEventListener("input", () => renderVenueGrid());
    byId("floqcastVenueGrid")?.addEventListener("click", (ev) => {
      const go = ev.target?.closest?.("[data-go-live-venue]");
      if (go) {
        selectVenue(go.getAttribute("data-go-live-venue"));
        beginFloqCast();
        return;
      }
      const btn = ev.target?.closest?.("[data-select-venue]");
      if (!btn) return;
      selectVenue(btn.getAttribute("data-select-venue"));
    });
    syncGoLiveChrome();
  }

  function bindAuth(auth) {
    window.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#floqcastGateStatus"
    });
    byId("floqcastGoogleLoginBtn")?.addEventListener("click", async () => {
      if (window.FLOQRSessionShell?.popupBlocked?.("#floqcastGateStatus")) return;
      try {
        setStatus("Opening Google…");
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch (err) {
        setStatus(err?.message || "Google sign-in failed.");
      }
    });
    byId("floqcastMicrosoftLoginBtn")?.addEventListener("click", async () => {
      if (window.FLOQRSessionShell?.popupBlocked?.("#floqcastGateStatus")) return;
      try {
        setStatus("Opening Microsoft…");
        await auth.signInWithPopup(new firebase.auth.OAuthProvider("microsoft.com"));
      } catch (err) {
        setStatus(err?.message || "Microsoft sign-in failed.");
      }
    });
    byId("floqcastLogoutBtn")?.addEventListener("click", () => auth.signOut());

    auth.onAuthStateChanged(async (user) => {
      try {
        const cs = global.FLOQRChromeScheme;
        if (cs && user && global.firebase?.firestore) {
          const snap = await firebase.firestore().collection("users").doc(user.uid).get();
          if (snap.exists) cs.hydrateFromProfile?.(snap.data() || {});
          else cs.applyDocument?.(cs.effectiveChrome?.());
        } else {
          cs?.applyDocument?.(cs?.effectiveChrome?.());
        }
      } catch (_) { /* ignore chrome hydrate */ }
      const check = accessCheck(user);
      if (!check.ok) {
        showGate(true);
        setStatus(user ? `Access issue: ${check.reason}` : "Sign in to open floqCast.");
        return;
      }
      setStatus("");
      showGate(false);
      await loadVenues();
    });
  }

  function boot() {
    global.FLOQRNav?.applyGlobalBack("floqrGlobalBack");
    FL()?.stripParentLogos?.(document);
    try { global.FLOQRChromeScheme?.syncAccessGate?.(); } catch (_) {}
    if (!global.firebase?.apps?.length && global.firebaseConfig) firebase.initializeApp(global.firebaseConfig);
    if (!global.firebase?.auth) {
      setStatus("Firebase Auth failed to load.");
      return;
    }
    bindUi();
    bindAuth(firebase.auth());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
