/* Venue display2 — receive supRstar live video for this location + board. */
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

  function displayBoard() {
    if (window.FLOQR_DISPLAY_BOARD === "secondary" || window.FLOQR_DISPLAY_BOARD === "primary") {
      return window.FLOQR_DISPLAY_BOARD;
    }
    try {
      const file = String(location.pathname.split("/").pop() || "").toLowerCase();
      if (file === "display2.html" || file === "displays.html") return "secondary";
    } catch (_) {}
    const meta = document.querySelector('meta[name="floqr-display-board"]');
    if (meta && String(meta.content || "").toLowerCase() === "secondary") return "secondary";
    return "primary";
  }

  function suprstrLiveDocId(locationId) {
    const id = String(locationId || "").trim();
    return displayBoard() === "secondary" ? `${id}__secondary` : id;
  }

  function ensureOverlay() {
    let wrap = byId("suprstrLiveOverlay");
    if (wrap) return wrap;
    wrap = document.createElement("div");
    wrap.id = "suprstrLiveOverlay";
    wrap.className = "suprstr-live-overlay hidden";
    wrap.setAttribute("aria-live", "polite");
    wrap.innerHTML = `
      <video id="suprstrLiveVideo" class="suprstr-live-video" autoplay playsinline muted webkit-playsinline></video>
      <div class="suprstr-live-badge">LIVE · supRstar</div>
      <div id="suprstrLiveStatus" class="suprstr-live-status">Connecting…</div>
    `;
    const canvas = byId("displayCanvas") || document.body;
    canvas.appendChild(wrap);
    return wrap;
  }

  function setLiveStatus(msg) {
    const el = byId("suprstrLiveStatus");
    if (el) el.textContent = msg || "";
  }

  function showOverlay(show) {
    const wrap = ensureOverlay();
    wrap.classList.toggle("hidden", !show);
    document.body.classList.toggle("suprstr-live-active", !!show);
  }

  let activeJoin = null;
  let activeSessionId = "";

  async function attachSession(sessionId) {
    if (!sessionId) return;
    if (sessionId === activeSessionId && activeJoin) return;
    if (activeJoin) {
      activeJoin.stop();
      activeJoin = null;
    }
    activeSessionId = sessionId;
    ensureOverlay();
    const video = byId("suprstrLiveVideo");
    showOverlay(true);
    setLiveStatus("Connecting to patron…");
    if (!window.FLOQRSuprstrRtc?.joinAsDisplay) {
      setLiveStatus("Camera helper missing — refresh display2.");
      console.warn("supRstar RTC helper missing");
      return;
    }
    window.FLOQRSuprstrRtc.forceVideoPlay?.(video);
    activeJoin = await window.FLOQRSuprstrRtc.joinAsDisplay({
      sessionId,
      videoEl: video,
      onStatus(s) {
        if (s === "ended") {
          detach();
          return;
        }
        if (s === "track" || s === "connected") setLiveStatus("");
        else if (s === "answered") setLiveStatus("Linked — waiting for video…");
        else if (String(s || "").includes("error")) setLiveStatus(String(s));
        else setLiveStatus(`WebRTC: ${s}`);
      }
    });
  }

  function detach() {
    if (activeJoin) {
      activeJoin.stop();
      activeJoin = null;
    }
    activeSessionId = "";
    showOverlay(false);
    setLiveStatus("");
  }

  function boot() {
    if (!window.firebase?.firestore) return;
    const locationId = locationFromUrl();
    if (!locationId) return;
    if (!firebase.apps.length && window.firebaseConfig) {
      firebase.initializeApp(window.firebaseConfig);
    }
    const liveId = suprstrLiveDocId(locationId);
    console.info("[supRstar display] watching", liveId, "board=", displayBoard());
    firebase.firestore().collection("suprstrLive").doc(liveId).onSnapshot((snap) => {
      const data = snap.exists ? snap.data() || {} : {};
      const status = String(data.status || "").toLowerCase();
      const sessionId = String(data.sessionId || "").trim();
      if (status === "live" && sessionId) attachSession(sessionId);
      else detach();
    }, (err) => {
      console.warn("suprstrLive watch", err);
      setLiveStatus(err?.message || "Live watch failed");
      showOverlay(true);
    });

    // Kiosk/WebView autoplay: unlock muted playback on first gesture if needed.
    const unlock = () => {
      const video = byId("suprstrLiveVideo");
      window.FLOQRSuprstrRtc?.forceVideoPlay?.(video);
    };
    document.addEventListener("click", unlock, {passive: true});
    document.addEventListener("touchstart", unlock, {passive: true});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
