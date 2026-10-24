/* ShoutOut feature landing — GPS nearest 4 → Select venue → Search shoutout deep link. */
(function (global) {
  "use strict";

  const FL = () => global.FLOQRFeatureLanding;
  const FEATURE = () => FL()?.FEATURES?.SHOUTOUT || "shoutOut";

  let venueRows = [];
  let locationContext = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function t(key, fallback, vars) {
    return FL()?.t?.(key, fallback, vars) || fallback || key;
  }

  function esc(s) {
    return FL()?.esc?.(s) || String(s || "");
  }

  function setStatus(msg) {
    const el = byId("shoutoutGateStatus");
    if (el) el.textContent = msg || "";
  }

  function setVenueStatus(msg) {
    const el = byId("shoutoutVenueStatus");
    if (el) el.textContent = msg || "";
  }

  function showGate(show) {
    byId("shoutoutGate")?.classList.toggle("hidden", !show);
    byId("shoutoutApp")?.classList.toggle("hidden", show);
  }

  function eventNamesByLocation() {
    const map = Object.create(null);
    for (const ev of Object.values(global.SHOUTOUT_EVENTS || {})) {
      const locId = String(ev?.locationId || ev?.clubLocationId || "").trim();
      const name = String(ev?.eventName || "").trim();
      if (!locId || !name) continue;
      if (!map[locId]) map[locId] = [];
      if (!map[locId].includes(name)) map[locId].push(name);
    }
    return map;
  }

  function filteredVenues() {
    const q = String(byId("shoutoutVenueSearch")?.value || "").trim();
    return FL()?.filterAndRank?.(venueRows, {query: q, locationContext}) || venueRows.slice(0, 4);
  }

  function renderVenueGrid() {
    const grid = byId("shoutoutVenueGrid");
    if (!grid) return;
    const rows = filteredVenues();
    const q = String(byId("shoutoutVenueSearch")?.value || "").trim();
    if (!venueRows.length) {
      setVenueStatus(t("featureLanding.noShoutoutVenues", "No venues currently allow ShoutOut."));
      grid.innerHTML = `<p class="sub small">${esc(t("featureLanding.noShoutoutVenues", "No venues currently allow ShoutOut."))}</p>`;
      return;
    }
    setVenueStatus(FL()?.statusLine?.({
      total: venueRows.length,
      shown: rows.length,
      query: q,
      locationContext,
      featureLabel: "ShoutOut venues"
    }) || `${rows.length} venue(s)`);
    if (!rows.length) {
      grid.innerHTML = `<p class="sub small">${esc(t("featureLanding.noMatch", "No venues match that search."))}</p>`;
      return;
    }
    grid.innerHTML = rows.map((r) => {
      const profileHref = `./club-profile.html?location=${encodeURIComponent(r.id)}`;
      const actions = `<a class="buttonlike" href="${esc(profileHref)}">${esc(t("listing.viewClub", "View Club"))}</a>`
        + `<button type="button" class="primary" data-select-venue="${esc(r.id)}">${esc(t("listing.throwShoutoutHere", "Throw ShoutOut Here"))}</button>`;
      return FL().renderVenueCardHtml(r, {
        feature: FEATURE(),
        productBadge: "ShoutOut",
        actionsHtml: actions
      });
    }).join("");
  }

  function beginShoutOut(locationId) {
    if (!locationId) return;
    const href = global.FLOQRNav?.shoutoutLink
      ? global.FLOQRNav.shoutoutLink({locationId})
      : `./?start=shoutout&location=${encodeURIComponent(locationId)}`;
    const withFrom = href.includes("?") ? `${href}&from=search` : `${href}?from=search`;
    location.assign(withFrom);
  }

  async function loadVenues() {
    const map = global.SHOUTOUT_CLUB_LOCATIONS || {};
    const g = global.FLOQRFeatureGates;
    const db = firebase.firestore();
    const eventsByLoc = eventNamesByLocation();
    const rows = [];
    setVenueStatus(t("page.floqcast.locating", "Finding venues near you…"));
    for (const [id, row] of Object.entries(map)) {
      let club = {id, ...row};
      try {
        if (g?.loadVenueRecord) club = (await g.loadVenueRecord(db, id)) || club;
      } catch (_) {}
      const enabled = g ? g.venueMayUse("shoutOut", club) : true;
      if (!enabled) continue;
      if (club.active === false) continue;
      rows.push(FL().normalizeVenue(id, Object.assign({}, club, {eventNames: eventsByLoc[id] || []})));
    }
    locationContext = await FL().resolvePatronLocation({
      auth: firebase.auth(),
      onLateGps: (coords) => {
        if (!coords || coords.latitude == null) return;
        locationContext = Object.assign({}, locationContext || {}, {
          source: "gps",
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy
        });
        venueRows = FL().sortNearest(venueRows, locationContext);
        renderVenueGrid();
      }
    });
    venueRows = FL().sortNearest(rows, locationContext);
    renderVenueGrid();
  }

  function bindUi() {
    byId("shoutoutVenueSearch")?.addEventListener("input", () => renderVenueGrid());
    byId("shoutoutVenueGrid")?.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-select-venue]");
      if (!btn) return;
      beginShoutOut(btn.getAttribute("data-select-venue"));
    });
  }

  function bindAuth(auth) {
    global.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#shoutoutGateStatus"
    });
    byId("shoutoutGoogleLoginBtn")?.addEventListener("click", async () => {
      if (global.FLOQRSessionShell?.popupBlocked?.("#shoutoutGateStatus")) return;
      try {
        setStatus("Opening Google…");
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch (err) {
        setStatus(err?.message || "Google sign-in failed.");
      }
    });
    byId("shoutoutMicrosoftLoginBtn")?.addEventListener("click", async () => {
      if (global.FLOQRSessionShell?.popupBlocked?.("#shoutoutGateStatus")) return;
      try {
        setStatus("Opening Microsoft…");
        await auth.signInWithPopup(new firebase.auth.OAuthProvider("microsoft.com"));
      } catch (err) {
        setStatus(err?.message || "Microsoft sign-in failed.");
      }
    });

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
      if (!user) {
        showGate(true);
        setStatus(t("app.signInToContinue", "Sign in to continue"));
        return;
      }
      const g = global.FLOQRFeatureGates;
      if (g && !g.patronMayUse("shoutOut", user, null)) {
        showGate(true);
        setStatus("ShoutOut is currently disabled for patrons.");
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
