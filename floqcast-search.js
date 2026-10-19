/* floqCast entry — venue pick → private preview (pay → approve → go live). */
(function (global) {
  "use strict";

  let venueRows = [];
  let selectedVenueId = "";

  function byId(id) {
    return document.getElementById(id);
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

  function filteredVenues() {
    const q = String(byId("floqcastVenueSearch")?.value || "").trim().toLowerCase();
    if (!q) return venueRows.slice();
    return venueRows.filter((r) => `${r.name} ${r.id}`.toLowerCase().includes(q));
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
    if (!rows.length) {
      grid.innerHTML = `<p class="sub small">No floqCast venues match that search.</p>`;
      return;
    }
    grid.innerHTML = rows.map((r) => {
      const selected = r.id === selectedVenueId;
      return `<article class="card club-card floqcast-venue-item${selected ? " is-selected" : ""}" role="listitem" data-venue-id="${esc(r.id)}">
        <strong>${esc(r.name)}</strong>
        <p class="sub small" style="color:var(--lime,#dfff5a);margin:4px 0 10px">floqCast</p>
        <button type="button" class="buttonlike ${selected ? "primary" : ""}" data-select-venue="${esc(r.id)}">${selected ? "Selected" : "Select venue"}</button>
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
    if (!rows.length) {
      selectedVenueId = "";
      syncSelect();
      renderVenueGrid();
      setVenueStatus("No venues currently allow floqCast.");
      byId("floqcastGoLiveBtn") && (byId("floqcastGoLiveBtn").disabled = true);
      return;
    }
    const preferred = rows.find((r) => r.id === selectedVenueId)
      || rows.find((r) => r.id === "heist-washington-dc")
      || rows[0];
    selectedVenueId = preferred.id;
    syncSelect();
    renderVenueGrid();
    setVenueStatus(`${rows.length} floqCast venue${rows.length === 1 ? "" : "s"}`);
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

  async function beginFloqCast() {
    const venue = selectedVenue();
    if (!venue.id) {
      setLiveStatus("Choose a venue first.");
      return;
    }
    const btn = byId("floqcastGoLiveBtn");
    if (btn) btn.disabled = true;
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
        displayBoard: "secondary" // floqCast → display2.html only (never Display 1)
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
