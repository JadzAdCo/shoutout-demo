/* supRstar entry — venue pick → private preview (pay → approve → go live). */
(function (global) {
  "use strict";

  const APP_V = "29.09.112";
  let venueRows = [];
  let venuesLoading = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    const el = byId("suprstrGateStatus");
    if (el) el.textContent = msg;
  }

  function setLiveStatus(msg) {
    const el = byId("suprstrLiveStatus");
    if (el) el.textContent = msg || "";
  }

  function setVenueStatus(msg) {
    const el = byId("suprstrEntitlementStatus");
    if (el) el.textContent = msg;
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function accessCheck(user) {
    if (!user) return {ok: false, reason: "Sign in to use supRstar."};
    const email = String(user.email || "").toLowerCase();
    if (!email || !email.includes("@")) return {ok: false, reason: "Sign in with Google or Microsoft (email required)."};
    return {ok: true, email};
  }

  function showGate(show) {
    byId("suprstrGate")?.classList.toggle("hidden", !show);
    byId("suprstrGate")?.classList.toggle("active", show);
    byId("suprstrSearchPage")?.classList.toggle("hidden", show);
    byId("suprstrSearchPage")?.classList.toggle("active", !show);
  }

  function isUsableVenueRow(club = {}) {
    if (!club || !club.id) return false;
    if (club.canonicalLocationId || club.aliasOf || club.mergedInto) return false;
    const obsolete = new Set((global.FLOQR_OBSOLETE_LOCATION_IDS || []).map((v) => String(v || "").toLowerCase()));
    if (obsolete.has(String(club.id).toLowerCase())) return false;
    const status = String(club.status || "active").toLowerCase();
    if (["deleted", "offboarded", "disabled"].includes(status)) return false;
    if (club.active === false && status === "disabled") return false;
    if (club.offboarded === true) return false;
    return true;
  }

  function venueDisplayName(club = {}, fallbackId = "") {
    return club.locationName || club.brandName || club.name || fallbackId;
  }

  function applyVenueOptions(rows, {statusMsg = ""} = {}) {
    venueRows = rows;
    const sel = byId("suprstrVenueSelect");
    if (!sel) return;
    const btn = byId("suprstrGoLiveBtn");
    if (!rows.length) {
      sel.innerHTML = `<option value="">No venues with supRstar enabled</option>`;
      setVenueStatus(statusMsg || "No venues currently allow supRstar.");
      if (btn) btn.disabled = true;
      return;
    }
    const previous = sel.value;
    sel.innerHTML = rows.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");
    const preferred = rows.find((r) => r.id === previous)
      || rows.find((r) => r.id === "heist-washington-dc")
      || rows[0];
    if (preferred) sel.value = preferred.id;
    setVenueStatus(statusMsg || `${rows.length} venue${rows.length === 1 ? "" : "s"} with supRstar enabled.`);
    if (btn) btn.disabled = false;
  }

  function buildVenueRows(sourceMap = {}) {
    const g = global.FLOQRFeatureGates;
    const rows = [];
    Object.values(sourceMap).forEach((club) => {
      if (!isUsableVenueRow(club)) return;
      const enabled = g ? g.venueMayUse("supRstar", club) : true;
      if (!enabled) return;
      rows.push({
        id: club.id,
        name: venueDisplayName(club, club.id)
      });
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }

  async function fetchClubLocationMap() {
    const staticMap = global.SHOUTOUT_CLUB_LOCATIONS || {};
    const merged = {};
    Object.entries(staticMap).forEach(([id, row]) => {
      merged[id] = {id, ...row};
    });
    try {
      const db = firebase.firestore();
      // One list read instead of N sequential doc gets (was making venue load feel broken).
      const snap = await Promise.race([
        db.collection("clubLocations").limit(400).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("venue-timeout")), 8000))
      ]);
      snap.forEach((doc) => {
        const prev = merged[doc.id] || {};
        merged[doc.id] = {id: doc.id, ...prev, ...doc.data()};
      });
    } catch (_) {
      // Keep static catalog — still usable offline / on slow networks.
    }
    return merged;
  }

  async function loadVenues() {
    if (venuesLoading) return;
    venuesLoading = true;
    setVenueStatus("Loading venues…");
    const btn = byId("suprstrGoLiveBtn");
    if (btn) btn.disabled = true;

    // Fast path: paint from seeded catalog immediately so the select is never empty.
    const staticRows = buildVenueRows(
      Object.fromEntries(
        Object.entries(global.SHOUTOUT_CLUB_LOCATIONS || {}).map(([id, row]) => [id, {id, ...row}])
      )
    );
    if (staticRows.length) {
      applyVenueOptions(staticRows, {statusMsg: `Loading live venue settings… (${staticRows.length} available)`});
    }

    try {
      const merged = await fetchClubLocationMap();
      const rows = buildVenueRows(merged);
      applyVenueOptions(rows, {
        statusMsg: rows.length
          ? `${rows.length} venue${rows.length === 1 ? "" : "s"} with supRstar enabled.`
          : "No venues currently allow supRstar."
      });
    } catch (err) {
      if (staticRows.length) {
        applyVenueOptions(staticRows, {statusMsg: `${staticRows.length} venues loaded (catalog). Live settings unavailable.`});
      } else {
        applyVenueOptions([], {statusMsg: err?.message || "Could not load venues."});
      }
    } finally {
      venuesLoading = false;
    }
  }

  function selectedVenue() {
    const id = byId("suprstrVenueSelect")?.value || "";
    const row = venueRows.find((r) => r.id === id) || {};
    return {id, name: row.name || id};
  }

  async function logPopup(action, message, details = {}) {
    try {
      if (global.FLOQRPayments?.logPopupEvent) {
        await global.FLOQRPayments.logPopupEvent(action, message, {flow: "suprstar_search", ...details});
      } else if (global.FLOQRLog?.write) {
        await global.FLOQRLog.write({
          level: action === "popup_blocked" ? "warn" : "info",
          category: "checkout",
          action,
          message,
          details: {flow: "suprstar_search", ...details},
          source: "suprstr-search"
        });
      }
    } catch (_) {}
  }

  async function beginSuprstar() {
    const venue = selectedVenue();
    if (!venue.id) {
      setLiveStatus("Choose a venue first.");
      return;
    }
    const btn = byId("suprstrGoLiveBtn");
    if (btn) btn.disabled = true;
    // Open placeholder tab synchronously on click — before any await.
    let previewTab = window.open("about:blank", "floqr_suprstar_preview");
    const tabBlocked = !previewTab;
    if (!tabBlocked) {
      try {
        previewTab.document.title = "supRstar Preview";
        previewTab.document.body.innerHTML = "<p style=\"font-family:sans-serif;padding:24px\">Opening your private supRstar preview…</p>";
        previewTab.opener = null;
      } catch (_) {}
    }
    try {
      setLiveStatus(`Opening private preview for ${venue.name}…`);
      const res = await callable("createSuprstarRequest")({
        locationId: venue.id,
        locationName: venue.name,
        displayBoard: "secondary"
      });
      const path = res?.data?.previewPath || `./suprstar-preview.html?t=${encodeURIComponent(res?.data?.accessToken || "")}`;
      const fullUrl = path.includes("?") ? `${path}&v=${APP_V}&from=search` : `${path}?v=${APP_V}&from=search`;
      try { sessionStorage.setItem("floqr_suprstar_token", res?.data?.accessToken || ""); } catch (_) {}
      if (!tabBlocked && previewTab && !previewTab.closed) {
        previewTab.location.href = fullUrl;
        await logPopup("popup_opened", "supRstar preview opened in new tab", {
          locationId: venue.id,
          popupName: "floqr_suprstar_preview"
        });
        setLiveStatus("Private preview opened in a new tab. Follow the steps there.");
      } else {
        await logPopup("popup_blocked", "supRstar preview tab blocked; using same-tab fallback", {
          locationId: venue.id,
          tabBlocked
        });
        try { previewTab?.close(); } catch (_) {}
        location.href = fullUrl;
      }
    } catch (err) {
      try { previewTab?.close(); } catch (_) {}
      setLiveStatus(err?.message || "Could not start supRstar.");
      if (btn) btn.disabled = false;
      await logPopup("checkout_failed", err?.message || "Could not start supRstar.", {locationId: venue.id});
    }
  }

  function bindHelp() {
    const btn = byId("suprstrHelpBtn");
    const pop = byId("suprstrHelpPopout");
    const close = byId("suprstrHelpClose");
    function setOpen(open) {
      pop?.classList.toggle("hidden", !open);
      pop?.setAttribute("aria-hidden", open ? "false" : "true");
      btn?.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn?.addEventListener("click", () => setOpen(pop?.classList.contains("hidden")));
    close?.addEventListener("click", () => setOpen(false));
  }

  function bindUi() {
    byId("suprstrGoLiveBtn")?.addEventListener("click", () => beginSuprstar());
  }

  function bindAuth(auth) {
    byId("suprstrGoogleLoginBtn")?.addEventListener("click", async () => {
      try {
        setStatus("Opening Google…");
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch (err) {
        setStatus(err?.message || "Google sign-in failed.");
      }
    });
    byId("suprstrMicrosoftLoginBtn")?.addEventListener("click", async () => {
      try {
        setStatus("Opening Microsoft…");
        await auth.signInWithPopup(new firebase.auth.OAuthProvider("microsoft.com"));
      } catch (err) {
        setStatus(err?.message || "Microsoft sign-in failed.");
      }
    });
    byId("suprstrLogoutBtn")?.addEventListener("click", () => auth.signOut());

    auth.onAuthStateChanged(async (user) => {
      const check = accessCheck(user);
      if (!check.ok) {
        showGate(true);
        setStatus(user ? `Access issue: ${check.reason}` : "Sign in to open supRstar.");
        return;
      }
      setStatus(`Signed in as ${check.email}`);
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
    bindHelp();
    bindUi();
    bindAuth(firebase.auth());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
