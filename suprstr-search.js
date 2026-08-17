/* supRstar entry — venue pick → private preview (pay → approve → go live). */
(function (global) {
  "use strict";

  const APP_V = "29.09.68";
  let venueRows = [];

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

  async function loadVenues() {
    const map = global.SHOUTOUT_CLUB_LOCATIONS || {};
    const g = global.FLOQRFeatureGates;
    const db = firebase.firestore();
    const rows = [];
    for (const [id, row] of Object.entries(map)) {
      let club = {id, ...row};
      try {
        if (g?.loadVenueRecord) club = await g.loadVenueRecord(db, id) || club;
      } catch (_) {}
      const enabled = g ? g.venueMayUse("supRstar", club) : true;
      if (!enabled) continue;
      rows.push({
        id,
        name: club.locationName || club.brandName || row.locationName || row.brandName || id
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    venueRows = rows;
    const sel = byId("suprstrVenueSelect");
    if (!sel) return;
    if (!rows.length) {
      sel.innerHTML = `<option value="">No venues with supRstar enabled</option>`;
      setVenueStatus("No venues currently allow supRstar.");
      byId("suprstrGoLiveBtn") && (byId("suprstrGoLiveBtn").disabled = true);
      return;
    }
    sel.innerHTML = rows.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
    const preferred = rows.find(r => r.id === "heist-washington-dc") || rows[0];
    if (preferred) sel.value = preferred.id;
    setVenueStatus(`${rows.length} venue${rows.length === 1 ? "" : "s"} with supRstar enabled.`);
    byId("suprstrGoLiveBtn") && (byId("suprstrGoLiveBtn").disabled = false);
  }

  function selectedVenue() {
    const id = byId("suprstrVenueSelect")?.value || "";
    const row = venueRows.find(r => r.id === id) || {};
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
    window.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#suprstrGateStatus"
    });
    byId("suprstrGoogleLoginBtn")?.addEventListener("click", async () => {
      if (window.FLOQRSessionShell?.popupBlocked?.("#suprstrGateStatus")) return;
      try {
        setStatus("Opening Google…");
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch (err) {
        setStatus(err?.message || "Google sign-in failed.");
      }
    });
    byId("suprstrMicrosoftLoginBtn")?.addEventListener("click", async () => {
      if (window.FLOQRSessionShell?.popupBlocked?.("#suprstrGateStatus")) return;
      try {
        setStatus("Opening Microsoft…");
        await auth.signInWithPopup(new firebase.auth.OAuthProvider("microsoft.com"));
      } catch (err) {
        setStatus(err?.message || "Microsoft sign-in failed.");
      }
    });
    byId("suprstrLogoutBtn")?.addEventListener("click", () => auth.signOut());

    auth.onAuthStateChanged(async user => {
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
