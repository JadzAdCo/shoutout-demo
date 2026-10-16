/* floqCast entry — venue pick → private preview (pay → approve → go live). */
(function (global) {
  "use strict";

  let venueRows = [];

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    const el = byId("floqcastGateStatus");
    if (el) el.textContent = msg;
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
    byId("floqcastGate")?.classList.toggle("active", show);
    byId("floqcastSearchPage")?.classList.toggle("hidden", show);
    byId("floqcastSearchPage")?.classList.toggle("active", !show);
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
      const enabled = g ? g.venueMayUse("floqCast", club) : true;
      if (!enabled) continue;
      rows.push({
        id,
        name: club.locationName || club.brandName || row.locationName || row.brandName || id
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    venueRows = rows;
    const sel = byId("floqcastVenueSelect");
    if (!sel) return;
    if (!rows.length) {
      sel.innerHTML = `<option value="">No venues with floqCast enabled</option>`;
      setVenueStatus("No venues currently allow floqCast.");
      byId("floqcastGoLiveBtn") && (byId("floqcastGoLiveBtn").disabled = true);
      return;
    }
    sel.innerHTML = rows.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
    const preferred = rows.find(r => r.id === "heist-washington-dc") || rows[0];
    if (preferred) sel.value = preferred.id;
    setVenueStatus(`${rows.length} venue${rows.length === 1 ? "" : "s"} with floqCast enabled.`);
    byId("floqcastGoLiveBtn") && (byId("floqcastGoLiveBtn").disabled = false);
  }

  function selectedVenue() {
    const id = byId("floqcastVenueSelect")?.value || "";
    const row = venueRows.find(r => r.id === id) || {};
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

  async function beginFloqCast() {
    const venue = selectedVenue();
    if (!venue.id) {
      setLiveStatus("Choose a venue first.");
      return;
    }
    const btn = byId("floqcastGoLiveBtn");
    if (btn) btn.disabled = true;
    // Open placeholder tab synchronously on click — before any await.
    let previewTab = window.open("about:blank", "floqr_floqcast_preview");
    const tabBlocked = !previewTab;
    if (!tabBlocked) {
      try {
        previewTab.document.title = "floqCast Preview";
        previewTab.document.body.innerHTML = "<p style=\"font-family:sans-serif;padding:24px\">Opening your private floqCast preview…</p>";
        previewTab.opener = null;
      } catch (_) {}
    }
    try {
      setLiveStatus(`Opening private preview for ${venue.name}…`);
      const res = await callable("createFloqCastRequest")({
        locationId: venue.id,
        locationName: venue.name,
        displayBoard: "secondary"
      });
      const path = res?.data?.previewPath || `./floqcast-preview.html?t=${encodeURIComponent(res?.data?.accessToken || "")}`;
      const fullUrl = path.includes("?") ? `${path}&from=search` : `${path}?from=search`;
      try { sessionStorage.setItem("floqr_floqcast_token", res?.data?.accessToken || ""); } catch (_) {}
      if (!tabBlocked && previewTab && !previewTab.closed) {
        previewTab.location.href = fullUrl;
        await logPopup("popup_opened", "floqCast preview opened in new tab", {
          locationId: venue.id,
          popupName: "floqr_floqcast_preview"
        });
        setLiveStatus("Private preview opened in a new tab. Follow the steps there.");
      } else {
        await logPopup("popup_blocked", "floqCast preview tab blocked; using same-tab fallback", {
          locationId: venue.id,
          tabBlocked
        });
        try { previewTab?.close(); } catch (_) {}
        location.href = fullUrl;
      }
    } catch (err) {
      try { previewTab?.close(); } catch (_) {}
      setLiveStatus(err?.message || "Could not start floqCast.");
      if (btn) btn.disabled = false;
      await logPopup("checkout_failed", err?.message || "Could not start floqCast.", {locationId: venue.id});
    }
  }

  function bindHelp() {
    const btn = byId("floqcastHelpBtn");
    const pop = byId("floqcastHelpPopout");
    const close = byId("floqcastHelpClose");
    function setOpen(open) {
      pop?.classList.toggle("hidden", !open);
      pop?.setAttribute("aria-hidden", open ? "false" : "true");
      btn?.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn?.addEventListener("click", () => setOpen(pop?.classList.contains("hidden")));
    close?.addEventListener("click", () => setOpen(false));
  }

  function bindUi() {
    byId("floqcastGoLiveBtn")?.addEventListener("click", () => beginFloqCast());
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

    auth.onAuthStateChanged(async user => {
      const check = accessCheck(user);
      if (!check.ok) {
        showGate(true);
        setStatus(user ? `Access issue: ${check.reason}` : "Sign in to open floqCast.");
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
