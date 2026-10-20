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
  let reattachAttempts = 0;
  let waitingForPhoneRebuild = false;

  const MAX_REATTACH = 8;

  function peerLooksDead(pc) {
    try {
      const state = String(pc?.connectionState || "");
      const ice = String(pc?.iceConnectionState || "");
      return ["failed", "closed", "disconnected"].includes(state) || ["failed", "closed", "disconnected"].includes(ice);
    } catch (_) {
      return true;
    }
  }

  function reattachDelayMs() {
    // 1.5s → 3s → 5s → 8s (cap). Avoid fighting phone renegotiate.
    const steps = [1500, 3000, 5000, 8000];
    return steps[Math.min(reattachAttempts, steps.length - 1)];
  }

  function scheduleReattach(sessionId, reason) {
    if (!sessionId || sessionId !== watchedSessionId) return;
    if (reattachAttempts >= MAX_REATTACH) {
      setLiveStatus("Board link failed — refresh display2, or End live on the phone and Go live again.");
      return;
    }
    if (reattachTimer) clearTimeout(reattachTimer);
    const delay = reattachDelayMs();
    reattachAttempts += 1;
    setLiveStatus(`${reason || "Reconnecting…"} (${reattachAttempts}/${MAX_REATTACH})`);
    reattachTimer = setTimeout(() => {
      reattachTimer = null;
      attachSession(sessionId, {force: true});
    }, delay);
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
    waitingForPhoneRebuild = false;
    ensureOverlay();
    const video = byId("floqcastLiveVideo");
    showOverlay(true);
    setLiveStatus(reattachAttempts ? `Connecting to patron… (try ${reattachAttempts + 1})` : "Connecting to patron…");
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
        const status = String(s || "");
        if (status === "ended") {
          detach();
          return;
        }
        if (status === "track" || status === "connected" || status === "ice-connected" || status === "ice-completed") {
          reattachAttempts = 0;
          waitingForPhoneRebuild = false;
          setLiveStatus("");
          window.FLOQRFloqCastRtc.forceVideoPlay?.(video);
          return;
        }
        if (status === "answered") {
          setLiveStatus("Linked — waiting for video…");
          return;
        }
        if (status === "rejoin-requested") {
          // Phone was asked to clear answer + republish. Do NOT kill this peer yet —
          // need-new-peer / new offer will refresh. Hard reattach here caused the
          // "Retrying after error…" storm.
          waitingForPhoneRebuild = true;
          setLiveStatus("Asking phone to reconnect… keep phone preview open.");
          return;
        }
        if (status === "need-new-peer") {
          peerDead = true;
          scheduleReattach(sessionId, "Refreshing board link…");
          return;
        }
        if (status === "connecting" || status === "checking" || status === "new" || status === "offering") {
          setLiveStatus(`WebRTC: ${status}`);
          return;
        }
        if (["failed", "disconnected", "closed"].includes(status)) {
          peerDead = true;
          scheduleReattach(sessionId, `WebRTC ${status} — retrying…`);
          return;
        }
        // offer-error / rejoin-error / answer-error: show text; only reattach if
        // we are not already waiting on a phone rebuild (displayJoins).
        if (status.includes("error")) {
          console.warn("[floqCast display]", status);
          setLiveStatus(status.slice(0, 120));
          peerDead = true;
          if (waitingForPhoneRebuild || /offer-error|rejoin-error|answer-blocked/i.test(status)) {
            // Wait for phone republish / need-new-peer instead of thrashing.
            setLiveStatus(`${status.slice(0, 80)} — waiting for phone…`);
            return;
          }
          scheduleReattach(sessionId, "Retrying after error…");
          return;
        }
        setLiveStatus(`WebRTC: ${status}`);
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
    waitingForPhoneRebuild = false;
    reattachAttempts = 0;
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
        if (sessionId !== watchedSessionId) reattachAttempts = 0;
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
