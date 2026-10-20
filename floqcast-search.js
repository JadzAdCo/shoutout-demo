/* floqCast entry — venue pick → private preview (pay → approve → go live).
 * Empty list shows the 4 nearest floqCast venues (GPS → IP → profile), like ShoutOut.
 * Typing matches club / brand / city / event name. */
(function (global) {
  "use strict";

  const NEARBY_TOP = 4;

  let venueRows = [];
  let selectedVenueId = "";
  let locationContext = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function t(key, fallback, vars) {
    try {
      const out = global.FLOQRI18n?.t?.(key, vars);
      if (out && out !== key) return out;
    } catch (_) {}
    if (!vars) return fallback || key;
    return String(fallback || key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
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

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function locationSourceLabel(source) {
    if (source === "gps") return t("listing.sourceGps", "GPS");
    if (source === "ip") return t("listing.sourceIp", "IP estimate");
    if (source === "profile") return t("listing.sourceProfile", "profile city");
    return "";
  }

  function venueHaystack(r) {
    return [
      r.name, r.brandName, r.id, r.city, r.region, r.country, r.locationLabel,
      ...(r.eventNames || [])
    ].join(" ").toLowerCase();
  }

  function sortVenuesNearest(rows) {
    const Geo = global.FLOQRGeoSearch;
    const origin = locationContext && locationContext.latitude != null && locationContext.longitude != null
      ? locationContext
      : null;
    if (!Geo || !origin) {
      return rows.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: "base", numeric: true}));
    }
    return Geo.sortNearest(rows, origin, {
      coordsOf: (r) => r.coords || Geo.recordCoordinates(r) || null,
      nameOf: (r) => r.name
    }).map((entry) => entry.item);
  }

  function filteredVenues() {
    const q = String(byId("floqcastVenueSearch")?.value || "").trim().toLowerCase();
    let rows = venueRows;
    if (q) rows = rows.filter((r) => venueHaystack(r).includes(q));
    rows = sortVenuesNearest(rows);
    if (!q) return rows.slice(0, NEARBY_TOP);
    return rows;
  }

  function updateVenueStatusLine(visibleCount) {
    const q = String(byId("floqcastVenueSearch")?.value || "").trim();
    const total = venueRows.length;
    if (!total) {
      setVenueStatus(t("page.floqcast.noVenues", "No venues currently allow floqCast."));
      return;
    }
    if (q) {
      setVenueStatus(t("page.floqcast.venueCountSearch", "{n} match(es)", {n: visibleCount}));
      return;
    }
    const origin = locationContext && locationContext.latitude != null && locationContext.longitude != null
      ? locationContext
      : null;
    if (origin) {
      const place = locationContext.city
        || t("listing.yourLocation", "your location");
      const source = locationSourceLabel(locationContext.source) || "GPS";
      setVenueStatus(t(
        "page.floqcast.venueCountNear",
        "{shown} nearest of {n} · {place} ({source})",
        {shown: visibleCount, n: total, place, source}
      ));
      return;
    }
    setVenueStatus(t(
      "page.floqcast.venueCountName",
      "{n} floqCast venue(s) · allow location for nearest first",
      {n: total}
    ));
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
      const place = r.locationLabel || [r.city, r.region, r.country].filter(Boolean).join(", ");
      const selectLabel = selected
        ? t("page.floqcast.selected", "Selected")
        : t("page.floqcast.selectVenue", "Select venue");
      return `<article class="card club-card floqcast-venue-item${selected ? " is-selected" : ""}" role="listitem" data-venue-id="${esc(r.id)}">
        <strong>${esc(r.name)}</strong>
        ${place ? `<p class="sub small" style="margin:4px 0 0">${esc(place)}</p>` : ""}
        <p class="sub small" style="color:var(--lime,#dfff5a);margin:4px 0 10px">floqCast</p>
        <button type="button" class="buttonlike ${selected ? "primary" : ""}" data-select-venue="${esc(r.id)}">${esc(selectLabel)}</button>
      </article>`;
    }).join("");
  }

  function selectVenue(id) {
    if (!venueRows.some((r) => r.id === id)) return;
    selectedVenueId = id;
    const sel = byId("floqcastVenueSelect");
    if (sel) sel.value = id;
    renderVenueGrid();
    setLiveStatus("");
  }

  function requestedLocationId() {
    try {
      return String(new URLSearchParams(location.search).get("location") || "").trim();
    } catch (_) {
      return "";
    }
  }

  async function resolvePatronLocation() {
    const Geo = global.FLOQRGeoSearch;
    if (!Geo?.resolveUserLocation) {
      locationContext = null;
      return;
    }
    let profile = null;
    try {
      const user = firebase.auth()?.currentUser;
      if (user) {
        const snap = await firebase.firestore().collection("users").doc(user.uid).get();
        profile = snap.exists ? snap.data() : null;
      }
    } catch (_) {}
    locationContext = await Geo.resolveUserLocation({
      profile,
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
    const Geo = global.FLOQRGeoSearch;
    const rows = [];
    for (const [id, row] of Object.entries(map)) {
      let club = {id, ...row};
      try {
        if (g?.loadVenueRecord) club = await g.loadVenueRecord(db, id) || club;
      } catch (_) {}
      const enabled = g ? g.venueMayUse("floqCast", club) : true;
      if (!enabled) continue;
      const name = club.locationName || club.brandName || row.locationName || row.brandName || id;
      rows.push({
        id,
        name,
        brandName: club.brandName || row.brandName || "",
        city: club.city || row.city || "",
        region: club.region || row.region || "",
        country: club.country || row.country || "",
        locationLabel: club.locationLabel || row.locationLabel || "",
        latitude: club.latitude ?? club.lat ?? row.latitude ?? row.lat,
        longitude: club.longitude ?? club.lng ?? row.longitude ?? row.lng,
        eventNames: eventsByLoc[id] || [],
        coords: Geo?.recordCoordinates?.(club) || Geo?.recordCoordinates?.(row) || null
      });
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
      const btn = ev.target?.closest?.("[data-select-venue]");
      if (!btn) return;
      selectVenue(btn.getAttribute("data-select-venue"));
    });
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
