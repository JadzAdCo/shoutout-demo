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
      <video id="floqcastLiveVideo" class="floqcast-live-video" autoplay playsinline muted></video>
      <div class="floqcast-live-badge">LIVE · floqCast</div>
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
    const video = byId("floqcastLiveVideo") || ensureOverlay() && byId("floqcastLiveVideo");
    showOverlay(true);
    if (!window.FLOQRFloqCastRtc?.joinAsDisplay) {
      console.warn("floqCast RTC helper missing");
      return;
    }
    activeJoin = await window.FLOQRFloqCastRtc.joinAsDisplay({
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
      if (status === "live" && sessionId) attachSession(sessionId);
      else detach();
    }, (err) => console.warn("suprstrLive watch", err));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
