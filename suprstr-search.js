/* SupRstR — purchase slots + go live to selected venue display.html */
(function (global) {
  "use strict";

  const APP_V = "29.09.64";
  const SLOT_PRICE_LABEL = "$20";

  const INTENTS = [
    {id: "live", title: "Go live to venue display", blurb: "Stream your camera to the selected venue’s display.html or display2.html.", keywords: ["live", "stream", "go live", "camera", "display", "broadcast", "superstar"], action: "live"},
    {id: "purchase", title: `Purchase a SupRstR slot (${SLOT_PRICE_LABEL})`, blurb: "Buy one live-stream entitlement before going on air.", keywords: ["buy", "purchase", "pay", "slot", "20"], action: "buy"},
    {id: "venue", title: "Pick a venue", blurb: "Same club location list as ShoutOut — video lands on that display.", keywords: ["venue", "club", "location", "heist", "display"], action: "focusVenue"},
    {id: "search", title: "Back to Search", blurb: "Return to FLOQR main categories.", keywords: ["search", "home", "back", "categories"], href: `./?v=${APP_V}&start=search`}
  ];

  let entitlementUnsub = null;
  let slotsRemaining = 0;
  let localStream = null;
  let broadcastHandle = null;
  let activeSessionId = "";
  let activeLocationId = "";
  let activeDisplayBoard = "primary";

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    const el = byId("suprstrGateStatus");
    if (el) el.textContent = msg;
  }

  function setEntitlementStatus(msg) {
    const el = byId("suprstrEntitlementStatus");
    if (el) el.textContent = msg;
  }

  function setLiveStatus(msg) {
    const el = byId("suprstrLiveStatus");
    if (el) el.textContent = msg || "";
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function providerIds(user) {
    return (user?.providerData || []).map(p => String(p.providerId || "").toLowerCase()).filter(Boolean);
  }

  function accessCheck(user) {
    if (!user) return {ok: false, reason: "Sign in to use SupRstR."};
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

  function venueOptions() {
    const map = global.SHOUTOUT_CLUB_LOCATIONS || {};
    return Object.entries(map)
      .map(([id, row]) => ({
        id,
        name: row.locationName || row.brandName || id
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function fillVenues() {
    const sel = byId("suprstrVenueSelect");
    if (!sel) return;
    const rows = venueOptions();
    sel.innerHTML = rows.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
    const preferred = rows.find(r => r.id === "heist-washington-dc") || rows[0];
    if (preferred) sel.value = preferred.id;
    syncDisplayLink();
  }

  function selectedVenue() {
    const id = byId("suprstrVenueSelect")?.value || "";
    const row = (global.SHOUTOUT_CLUB_LOCATIONS || {})[id] || {};
    return {id, name: row.locationName || row.brandName || id};
  }

  function selectedBoard() {
    const v = byId("suprstrBoardSelect")?.value || "primary";
    return v === "secondary" ? "secondary" : "primary";
  }

  function syncDisplayLink() {
    const {id, name} = selectedVenue();
    const board = selectedBoard();
    const a = byId("suprstrDisplayLink");
    if (!a || !id) return;
    const page = board === "secondary" ? "display2.html" : "display.html";
    const url = `./${page}?location=${encodeURIComponent(id)}&v=${APP_V}`;
    a.href = url;
    a.textContent = `${name} · ${board === "secondary" ? "Display 2" : "Display 1"}`;
    updateGoLiveEnabled();
  }

  function updateGoLiveEnabled() {
    const btn = byId("suprstrGoLiveBtn");
    if (!btn) return;
    const live = !!broadcastHandle;
    btn.disabled = live || slotsRemaining < 1 || !selectedVenue().id;
    btn.textContent = live ? "Live…" : "Go live to venue display";
    byId("suprstrEndLiveBtn")?.classList.toggle("hidden", !live);
    byId("suprstrBuyBtn") && (byId("suprstrBuyBtn").disabled = live);
  }

  function matchIntents(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return INTENTS;
    return INTENTS.filter(row => {
      const hay = `${row.title} ${row.blurb} ${(row.keywords || []).join(" ")}`.toLowerCase();
      return q.split(/\s+/).every(part => !part || hay.includes(part));
    });
  }

  function renderResults(query) {
    const root = byId("suprstrSearchResults");
    if (!root) return;
    const rows = matchIntents(query);
    root.innerHTML = rows.map(row => `<button type="button" class="intent-result" data-intent="${row.id}">
      <strong>${row.title}</strong>
      <p class="sub small">${row.blurb}</p>
    </button>`).join("") || `<p class="sub small">No matches.</p>`;
  }

  async function startPurchase() {
    if (!global.FLOQRPayments?.startCheckout) {
      setEntitlementStatus("Payment service failed to load.");
      return;
    }
    try {
      setEntitlementStatus("Opening Stripe for one SupRstR slot ($20)…");
      await global.FLOQRPayments.startCheckout({
        orderType: "suprstrSlot",
        payload: {slots: 1},
        status: setEntitlementStatus,
        redirect: true
      });
    } catch (err) {
      setEntitlementStatus(err?.message || "Checkout failed.");
    }
  }

  async function goLive() {
    const venue = selectedVenue();
    if (!venue.id) {
      setLiveStatus("Choose a venue first.");
      return;
    }
    if (slotsRemaining < 1) {
      setLiveStatus("Purchase a $20 SupRstR slot first.");
      return;
    }
    if (!global.FLOQRSuprstrRtc) {
      setLiveStatus("WebRTC helper failed to load.");
      return;
    }
    const goBtn = byId("suprstrGoLiveBtn");
    if (goBtn) goBtn.disabled = true;
    try {
      setLiveStatus("Starting session for " + venue.name + "…");
      const start = await callable("startSuprstrLive")({
        locationId: venue.id,
        locationName: venue.name,
        displayBoard: selectedBoard()
      });
      const sessionId = start?.data?.sessionId;
      if (!sessionId) throw new Error("No sessionId returned.");
      activeSessionId = sessionId;
      activeLocationId = venue.id;
      activeDisplayBoard = selectedBoard();

      setLiveStatus("Requesting camera…");
      localStream = await global.FLOQRSuprstrRtc.getCameraStream({audio: true});
      const preview = byId("suprstrPreview");
      if (preview) {
        preview.srcObject = localStream;
        preview.classList.add("is-on");
      }

      const boardLabel = activeDisplayBoard === "secondary" ? "display2.html (Display 2)" : "display.html (Display 1)";
      setLiveStatus(`Connecting to ${venue.name} ${boardLabel}… Open that board if it is not already open.`);
      broadcastHandle = await global.FLOQRSuprstrRtc.startBroadcast({
        sessionId,
        stream: localStream,
        onStatus(s) {
          setLiveStatus(`WebRTC: ${s} → ${venue.name} ${boardLabel}`);
        }
      });
      updateGoLiveEnabled();
      setLiveStatus(`Live to ${venue.name} on ${boardLabel}. Keep this tab open.`);
    } catch (err) {
      setLiveStatus(err?.message || "Go live failed.");
      await endLive({silent: true});
      updateGoLiveEnabled();
    }
  }

  async function endLive({silent = false} = {}) {
    try {
      if (broadcastHandle) {
        broadcastHandle.stop();
        broadcastHandle = null;
      }
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      const preview = byId("suprstrPreview");
      if (preview) {
        preview.srcObject = null;
        preview.classList.remove("is-on");
      }
      if (activeSessionId || activeLocationId) {
        await callable("endSuprstrLive")({
          sessionId: activeSessionId,
          locationId: activeLocationId,
          displayBoard: activeDisplayBoard
        });
      }
    } catch (err) {
      if (!silent) setLiveStatus(err?.message || "End live failed.");
    }
    activeSessionId = "";
    activeLocationId = "";
    activeDisplayBoard = "primary";
    updateGoLiveEnabled();
    if (!silent) setLiveStatus("Live ended.");
  }

  function watchEntitlement(uid) {
    if (entitlementUnsub) {
      entitlementUnsub();
      entitlementUnsub = null;
    }
    if (!uid) {
      setEntitlementStatus("Sign in to see slot balance.");
      slotsRemaining = 0;
      updateGoLiveEnabled();
      return;
    }
    entitlementUnsub = firebase.firestore().collection("suprstrEntitlements").doc(uid).onSnapshot(snap => {
      const data = snap.exists ? snap.data() || {} : {};
      slotsRemaining = Math.max(0, Math.floor(Number(data.slotsRemaining || 0)));
      const purchased = Math.max(0, Math.floor(Number(data.slotsPurchased || 0)));
      setEntitlementStatus(
        snap.exists
          ? `${slotsRemaining} slot${slotsRemaining === 1 ? "" : "s"} remaining (${purchased} purchased).`
          : `No slots yet — purchase a SupRstR slot (${SLOT_PRICE_LABEL}).`
      );
      updateGoLiveEnabled();
    }, err => setEntitlementStatus(err?.message || "Could not load entitlement."));
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
    fillVenues();
    byId("suprstrVenueSelect")?.addEventListener("change", syncDisplayLink);
    byId("suprstrBoardSelect")?.addEventListener("change", syncDisplayLink);
    byId("suprstrSearchInput")?.addEventListener("input", e => renderResults(e.target.value));
    byId("suprstrSearchResults")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-intent]");
      if (!btn) return;
      const row = INTENTS.find(x => x.id === btn.getAttribute("data-intent"));
      if (!row) return;
      if (row.action === "buy") return startPurchase();
      if (row.action === "live") return goLive();
      if (row.action === "focusVenue") return byId("suprstrVenueSelect")?.focus();
      if (row.href) location.href = row.href;
    });
    byId("suprstrBuyBtn")?.addEventListener("click", () => startPurchase());
    byId("suprstrGoLiveBtn")?.addEventListener("click", () => goLive());
    byId("suprstrEndLiveBtn")?.addEventListener("click", () => endLive());
    renderResults("");
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

    auth.onAuthStateChanged(user => {
      const check = accessCheck(user);
      if (!check.ok) {
        showGate(true);
        setStatus(user ? `Access issue: ${check.reason}` : "Sign in to open SupRstR and go live.");
        watchEntitlement(null);
        return;
      }
      setStatus(`Signed in as ${check.email}`);
      showGate(false);
      watchEntitlement(user.uid);
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
