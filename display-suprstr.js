/* Venue display / displays — receive SupRstR live video for this location + board. */
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
      <video id="suprstrLiveVideo" class="suprstr-live-video" autoplay playsinline muted></video>
      <div class="suprstr-live-badge">LIVE · SupRstR</div>
    `;
    const canvas = byId("displayCanvas") || document.body;
    canvas.appendChild(wrap);
    return wrap;
  }

  function showOverlay(show) {
    const wrap = ensureOverlay();
    wrap.classList.toggle("hidden", !show);
  }

  let activeJoin = null;
  let activeSessionId = "";

  async function attachSession(sessionId) {
    if (!sessionId || sessionId === activeSessionId) return;
    if (activeJoin) {
      activeJoin.stop();
      activeJoin = null;
    }
    activeSessionId = sessionId;
    const video = byId("suprstrLiveVideo") || ensureOverlay() && byId("suprstrLiveVideo");
    showOverlay(true);
    if (!window.FLOQRSuprstrRtc?.joinAsDisplay) {
      console.warn("SupRstR RTC helper missing");
      return;
    }
    activeJoin = await window.FLOQRSuprstrRtc.joinAsDisplay({
      sessionId,
      videoEl: video,
      onStatus(s) {
        if (s === "ended") detach();
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
  }

  function boot() {
    if (!window.firebase?.firestore) return;
    const locationId = locationFromUrl();
    if (!locationId) return;
    if (!firebase.apps.length && window.firebaseConfig) {
      firebase.initializeApp(window.firebaseConfig);
    }
    const liveId = suprstrLiveDocId(locationId);
    firebase.firestore().collection("suprstrLive").doc(liveId).onSnapshot((snap) => {
      const data = snap.exists ? snap.data() || {} : {};
      const status = String(data.status || "").toLowerCase();
      const sessionId = String(data.sessionId || "").trim();
      if (status === "live" && sessionId) attachSession(sessionId);
      else detach();
    }, (err) => console.warn("suprstrLive watch", err));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
