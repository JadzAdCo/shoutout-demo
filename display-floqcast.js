/* Venue display / displays — receive floqCast live video for this location + board. */
(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function locationFromUrl() {
    try {
      return String(new URL(location.href).searchParams.get("location") || "").trim();
    } catch (_) {
      return "";
    }
  }

  /** floqCast answers only on display2.html (secondary). Display 1 never joins. */
  function isFloqCastBoard() {
    if (window.FLOQR_DISPLAY_BOARD === "secondary") return true;
    try {
      const file = String(location.pathname.split("/").pop() || "").toLowerCase();
      if (file === "display2.html" || file === "displays.html") return true;
      const meta = document.querySelector('meta[name="floqr-display-board"]');
      if (String(meta?.getAttribute("content") || "").toLowerCase() === "secondary") return true;
    } catch (_) {}
    return false;
  }

  function floqcastLiveDocId(locationId) {
    const id = String(locationId || "").trim();
    return id ? `${id}__secondary` : "";
  }

  function ensureOverlay() {
    let wrap = byId("floqcastLiveOverlay");
    if (wrap) return wrap;
    wrap = document.createElement("div");
    wrap.id = "floqcastLiveOverlay";
    wrap.className = "floqcast-live-overlay hidden";
    wrap.setAttribute("aria-live", "polite");
    wrap.innerHTML = `
      <video id="floqcastLiveVideo" class="floqcast-live-video" autoplay playsinline muted webkit-playsinline></video>
      <div class="floqcast-live-badge">LIVE · floqCast</div>
      <div id="floqcastLiveStatus" class="floqcast-live-status">Connecting…</div>
    `;
    const canvas = byId("displayCanvas") || document.body;
    canvas.appendChild(wrap);
    return wrap;
  }

  function setLiveStatus(msg) {
    const el = byId("floqcastLiveStatus");
    if (el) el.textContent = msg || "";
  }

  function showOverlay(show) {
    const wrap = ensureOverlay();
    wrap.classList.toggle("hidden", !show);
    document.body.classList.toggle("floqcast-live-active", !!show);
  }

  let activeJoin = null;
  let activeSessionId = "";
  let peerDead = false;
  let reattachTimer = null;
  let watchedSessionId = "";

  function peerLooksDead(pc) {
    try {
      const state = String(pc?.connectionState || "");
      const ice = String(pc?.iceConnectionState || "");
      return ["failed", "closed", "disconnected"].includes(state) || ["failed", "closed", "disconnected"].includes(ice);
    } catch (_) {
      return true;
    }
  }

  function scheduleReattach(sessionId, reason) {
    if (!sessionId || sessionId !== watchedSessionId) return;
    if (reattachTimer) clearTimeout(reattachTimer);
    setLiveStatus(reason || "Reconnecting to patron…");
    reattachTimer = setTimeout(() => {
      reattachTimer = null;
      attachSession(sessionId, {force: true});
    }, 1200);
  }

  async function attachSession(sessionId, {force = false} = {}) {
    if (!sessionId) return;
    // Same sessionId with a dead peer must re-join — do not skip.
    if (!force && sessionId === activeSessionId && activeJoin && !peerDead && !peerLooksDead(activeJoin.pc)) {
      return;
    }
    if (activeJoin) {
      activeJoin.stop();
      activeJoin = null;
    }
    activeSessionId = sessionId;
    peerDead = false;
    ensureOverlay();
    const video = byId("floqcastLiveVideo");
    showOverlay(true);
    setLiveStatus("Connecting to patron…");
    if (!window.FLOQRFloqCastRtc?.joinAsDisplay) {
      setLiveStatus("Camera helper missing — refresh display2.");
      console.warn("floqCast RTC helper missing");
      return;
    }
    window.FLOQRFloqCastRtc.forceVideoPlay?.(video);
    activeJoin = await window.FLOQRFloqCastRtc.joinAsDisplay({
      sessionId,
      videoEl: video,
      onStatus(s) {
        if (s === "ended") {
          detach();
          return;
        }
        if (s === "track" || s === "connected" || s === "ice-connected" || s === "ice-completed") {
          setLiveStatus("");
          window.FLOQRFloqCastRtc.forceVideoPlay?.(video);
          return;
        }
        if (s === "answered") {
          setLiveStatus("Linked — waiting for video…");
          return;
        }
        if (s === "rejoin-requested") {
          setLiveStatus("Asking phone to reconnect…");
          return;
        }
        if (s === "need-new-peer") {
          peerDead = true;
          scheduleReattach(sessionId, "Refreshing board link…");
          return;
        }
        if (["failed", "disconnected", "closed"].includes(String(s || ""))) {
          peerDead = true;
          scheduleReattach(sessionId, `WebRTC ${s} — retrying…`);
          return;
        }
        if (String(s || "").includes("error")) {
          setLiveStatus(String(s));
          peerDead = true;
          scheduleReattach(sessionId, "Retrying after error…");
          return;
        }
        setLiveStatus(`WebRTC: ${s}`);
      }
    });
  }

  function detach() {
    if (reattachTimer) {
      clearTimeout(reattachTimer);
      reattachTimer = null;
    }
    if (activeJoin) {
      activeJoin.stop();
      activeJoin = null;
    }
    activeSessionId = "";
    peerDead = false;
    showOverlay(false);
    setLiveStatus("");
  }

  function boot() {
    // Product rule: floqCast ↔ display2.html only. Ignore Display 1 even if the script is linked.
    if (!isFloqCastBoard()) return;
    if (!window.firebase?.firestore) return;
    const locationId = locationFromUrl();
    if (!locationId) return;
    if (!firebase.apps.length && window.firebaseConfig) {
      firebase.initializeApp(window.firebaseConfig);
    }
    const liveId = floqcastLiveDocId(locationId);
    firebase.firestore().collection("suprstrLive").doc(liveId).onSnapshot((snap) => {
      const data = snap.exists ? snap.data() || {} : {};
      const status = String(data.status || "").toLowerCase();
      const sessionId = String(data.sessionId || "").trim();
      if (status === "live" && sessionId) {
        watchedSessionId = sessionId;
        attachSession(sessionId);
      } else {
        watchedSessionId = "";
        detach();
      }
    }, (err) => {
      console.warn("suprstrLive watch", err);
      setLiveStatus(err?.message || "Live watch failed");
      showOverlay(true);
    });

    // Kiosk/WebView autoplay: unlock muted playback on first gesture if needed.
    const unlock = () => {
      const video = byId("floqcastLiveVideo");
      window.FLOQRFloqCastRtc?.forceVideoPlay?.(video);
    };
    document.addEventListener("click", unlock, {passive: true});
    document.addEventListener("touchstart", unlock, {passive: true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
