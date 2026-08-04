/* Private supRstar preview — camera local until paid + Club Admin approved; auto-live with countdown. */
(function (global) {
  "use strict";

  const APP_V = "29.09.121";
  const ALLOWED_DURATIONS = [15, 30, 45, 60, 90];
  const DEFAULT_LIVE_SECONDS = 90;
  const COUNTDOWN_SECONDS = 10;
  const CONNECT_ARM_DEBOUNCE_MS = 2500;
  const CONNECT_WAIT_DIAG_MS = 30000;
  const LIVE_HEARTBEAT_MS = 10000;

  let requestDoc = null;
  let requestUnsub = null;
  let localStream = null;
  let broadcastHandle = null;
  let checkoutPopup = null;
  let livePopout = null;
  let accessToken = "";
  let facingMode = "user";
  let autoLiveArmed = false;
  let liveStartInFlight = false;
  let liveTimerArmed = false;
  let liveTimerArmInFlight = false;
  let countdownTimer = null;
  let liveExpireTimer = null;
  let liveEndsAtMs = 0;
  let venueLiveSeconds = DEFAULT_LIVE_SECONDS;
  let activeSessionId = "";
  let connectArmTimer = null;
  let connectWaitDiagTimer = null;
  let liveHeartbeatTimer = null;
  let lastWebrtcStatus = "";
  let lastWebrtcMeta = {};
  let liveDiagCorrelationId = "";
  let liveConnectedAtMs = 0;
  let liveArmedAtMs = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  function qs(name) {
    try {
      return new URL(location.href).searchParams.get(name) || "";
    } catch (_) {
      return "";
    }
  }

  function liveDiag(action, message, details = {}, level = "info") {
    const payload = {
      level,
      category: "suprstar",
      action: String(action || "live_diag"),
      message: String(message || action || "supRstar live diagnostic"),
      appVersion: APP_V,
      details: {
        requestId: requestDoc?.requestId || "",
        sessionId: activeSessionId || requestDoc?.sessionId || "",
        locationId: requestDoc?.locationId || "",
        status: requestDoc?.status || "",
        webrtc: lastWebrtcStatus || "",
        webrtcMeta: lastWebrtcMeta || {},
        liveTimerArmed,
        liveEndsAtMs,
        liveConnectedAtMs,
        liveArmedAtMs,
        venueLiveSeconds,
        remainMs: liveEndsAtMs ? Math.max(0, liveEndsAtMs - Date.now()) : null,
        correlationId: liveDiagCorrelationId || "",
        ...details
      },
      correlationId: liveDiagCorrelationId || "",
      source: "suprstar-preview"
    };
    try {
      if (global.FLOQRLog?.write) global.FLOQRLog.write(payload);
    } catch (_) {}
    try {
      console.info("[supRstar-live]", action, message, payload.details);
    } catch (_) {}
  }

  function clearLiveHeartbeat() {
    if (liveHeartbeatTimer) {
      clearInterval(liveHeartbeatTimer);
      liveHeartbeatTimer = null;
    }
  }

  function startLiveHeartbeat(sessionId) {
    clearLiveHeartbeat();
    liveHeartbeatTimer = setInterval(() => {
      if (!broadcastHandle) {
        clearLiveHeartbeat();
        return;
      }
      liveDiag("live_heartbeat", "Live session still open", {
        sessionId: sessionId || activeSessionId || "",
        elapsedSinceConnectMs: liveConnectedAtMs ? Date.now() - liveConnectedAtMs : null,
        elapsedSinceArmMs: liveArmedAtMs ? Date.now() - liveArmedAtMs : null,
        pcState: (() => {
          try {
            const pc = broadcastHandle?.pc;
            return {
              connectionState: pc?.connectionState || "",
              iceConnectionState: pc?.iceConnectionState || "",
              signalingState: pc?.signalingState || ""
            };
          } catch (_) {
            return {};
          }
        })()
      });
    }, LIVE_HEARTBEAT_MS);
  }

  function clearConnectArmTimers() {
    if (connectArmTimer) {
      clearTimeout(connectArmTimer);
      connectArmTimer = null;
    }
    if (connectWaitDiagTimer) {
      clearTimeout(connectWaitDiagTimer);
      connectWaitDiagTimer = null;
    }
  }

  function setGate(msg) {
    const el = byId("suprstarPreviewGate");
    if (el) el.textContent = msg;
  }

  function setStatus(msg) {
    const el = byId("suprstarStepStatus");
    if (el) el.textContent = msg || "";
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function cameraReady() {
    try {
      return !!(localStream && localStream.getVideoTracks().some((t) => t.readyState === "live"));
    } catch (_) {
      return !!localStream;
    }
  }

  function isLive() {
    return !!broadcastHandle || String(requestDoc?.status || "") === "live";
  }

  function syncPreviewChrome() {
    const video = byId("suprstarPreviewVideo");
    const label = byId("suprstarPreviewLabel");
    const flip = byId("suprstarFlipCamBtn");
    const mobile = !!global.FLOQRSuprstrRtc?.isMobileLike?.();
    if (flip) flip.classList.toggle("hidden", !mobile || !cameraReady());
    if (label) {
      label.textContent = isLive() ? "LIVE" : "Preview";
      label.classList.toggle("is-live", isLive());
    }
    if (video) {
      video.classList.toggle("is-on", cameraReady());
      video.classList.toggle("is-live", isLive());
    }
    // Expose stream to same-origin live popout.
    global.__floqrSuprstarStream = localStream || null;
    global.__floqrSuprstarLiveMeta = {
      isLive: isLive(),
      endsAtMs: liveEndsAtMs,
      durationSeconds: venueLiveSeconds,
      requestId: requestDoc?.requestId || "",
      venue: requestDoc?.locationName || requestDoc?.locationId || ""
    };
    try {
      livePopout?.postMessage?.({type: "floqr-suprstar-live-meta", meta: global.__floqrSuprstarLiveMeta}, location.origin);
    } catch (_) {}
  }

  function stopCamera() {
    try {
      global.FLOQRSuprstrRtc?.stopStream?.(localStream);
    } catch (_) {}
    localStream = null;
    const video = byId("suprstarPreviewVideo");
    if (video) {
      video.srcObject = null;
      video.classList.remove("is-on", "is-live");
    }
    syncPreviewChrome();
  }

  function clearCountdownUi() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    byId("suprstarCountdownOverlay")?.classList.add("hidden");
    const n = byId("suprstarCountdownNumber");
    if (n) n.textContent = "";
  }

  function clearLiveExpireTimer() {
    if (liveExpireTimer) {
      clearTimeout(liveExpireTimer);
      liveExpireTimer = null;
    }
    liveEndsAtMs = 0;
    liveTimerArmed = false;
    liveArmedAtMs = 0;
    clearConnectArmTimers();
    clearLiveHeartbeat();
  }

  function scheduleLiveExpire(endsAtMs) {
    if (liveExpireTimer) {
      clearTimeout(liveExpireTimer);
      liveExpireTimer = null;
    }
    liveEndsAtMs = Number(endsAtMs) || 0;
    if (!liveEndsAtMs) return;
    liveTimerArmed = true;
    liveArmedAtMs = Date.now();
    const remainMs = Math.max(1000, liveEndsAtMs - Date.now());
    liveDiag("live_timer_scheduled", "Duration clock armed", {
      endsAtMs: liveEndsAtMs,
      remainMs,
      durationSeconds: venueLiveSeconds,
      armedAtMs: liveArmedAtMs,
      connectedAtMs: liveConnectedAtMs
    });
    liveExpireTimer = setTimeout(() => {
      liveDiag("live_timer_fire", "Duration elapsed — ending live", {
        endsAtMs: liveEndsAtMs,
        durationSeconds: venueLiveSeconds,
        armedAtMs: liveArmedAtMs,
        connectedAtMs: liveConnectedAtMs,
        livedMs: liveConnectedAtMs ? Date.now() - liveConnectedAtMs : null
      }, "warn");
      endLive({silent: false, reason: "duration"});
    }, remainMs);
    syncPreviewChrome();
  }

  async function armLiveDurationClock(sessionId, {source = "connected"} = {}) {
    if (liveTimerArmed && liveEndsAtMs > Date.now()) {
      liveDiag("live_timer_skip_already_armed", "Clock already running", {source, endsAtMs: liveEndsAtMs});
      return liveEndsAtMs;
    }
    if (liveTimerArmInFlight) return liveEndsAtMs;
    liveTimerArmInFlight = true;
    const durationSeconds = ALLOWED_DURATIONS.includes(venueLiveSeconds) ? venueLiveSeconds : DEFAULT_LIVE_SECONDS;
    try {
      liveDiag("live_timer_arm_request", "Requesting server arm", {source, durationSeconds, sessionId: sessionId || ""});
      const armed = await callable("armSuprstrLiveDuration")({
        requestId: requestDoc?.requestId || "",
        sessionId: sessionId || activeSessionId || requestDoc?.sessionId || "",
        armSource: source,
        webrtc: lastWebrtcStatus,
        webrtcMeta: lastWebrtcMeta
      });
      const ends = Number(armed?.data?.liveEndsAtMs) || (Date.now() + durationSeconds * 1000);
      venueLiveSeconds = ALLOWED_DURATIONS.includes(Number(armed?.data?.liveDurationSeconds))
        ? Number(armed.data.liveDurationSeconds)
        : durationSeconds;
      scheduleLiveExpire(ends);
      setStatus(`LIVE on the venue SupRStar board for ${venueLiveSeconds}s. Keep the live pop-out open.`);
      liveDiag("live_timer_arm_ok", "Server armed live duration", {
        source,
        alreadyArmed: !!armed?.data?.alreadyArmed,
        endsAtMs: ends,
        durationSeconds: venueLiveSeconds,
        serverArmedAtMs: Number(armed?.data?.armedAtMs) || 0
      });
      return ends;
    } catch (err) {
      // Local fallback — still start the clock only after connect, never at approval.
      scheduleLiveExpire(Date.now() + durationSeconds * 1000);
      setStatus(`LIVE on the venue SupRStar board for ${durationSeconds}s. Keep the live pop-out open.`);
      liveDiag("live_timer_arm_fallback", err?.message || "armSuprstrLiveDuration failed; local fallback", {
        source,
        durationSeconds,
        error: err?.message || String(err || "")
      }, "warn");
      return liveEndsAtMs;
    } finally {
      liveTimerArmInFlight = false;
    }
  }

  function peerLooksConnected(meta = {}) {
    const connectionState = String(meta.connectionState || lastWebrtcMeta.connectionState || lastWebrtcStatus || "");
    const ice = String(meta.iceConnectionState || lastWebrtcMeta.iceConnectionState || "");
    if (connectionState === "connected") return true;
    if (ice === "connected" || ice === "completed") return true;
    return false;
  }

  function queueArmAfterStableConnect(sessionId, meta = {}) {
    if (liveTimerArmed && liveEndsAtMs > Date.now()) return;
    if (!peerLooksConnected(meta)) {
      liveDiag("live_timer_arm_ignored", "Ignored non-stable WebRTC status for timer arm", {
        webrtc: lastWebrtcStatus,
        meta
      }, "warn");
      return;
    }
    if (!liveConnectedAtMs) liveConnectedAtMs = Date.now();
    if (connectArmTimer) clearTimeout(connectArmTimer);
    // Debounce brief ICE "connected" blips during renegotiation.
    connectArmTimer = setTimeout(() => {
      connectArmTimer = null;
      if (!peerLooksConnected(lastWebrtcMeta) && lastWebrtcStatus !== "connected") {
        liveDiag("live_timer_arm_deferred", "Skipped arm — WebRTC no longer connected", {
          webrtc: lastWebrtcStatus,
          meta: lastWebrtcMeta
        }, "warn");
        return;
      }
      armLiveDurationClock(sessionId, {source: "stable-ice-connected"});
    }, CONNECT_ARM_DEBOUNCE_MS);
  }

  function attachStreamToVideo(stream) {
    const video = byId("suprstarPreviewVideo");
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.classList.add("is-on");
    global.FLOQRSuprstrRtc?.forceVideoPlay?.(video);
  }

  async function loadVenueDuration(locationId) {
    venueLiveSeconds = DEFAULT_LIVE_SECONDS;
    if (!locationId) return venueLiveSeconds;
    try {
      const snap = await firebase.firestore().collection("clubLocations").doc(locationId).get();
      const raw = Number(snap.exists ? snap.data()?.suprstarLiveDurationSeconds : DEFAULT_LIVE_SECONDS);
      venueLiveSeconds = ALLOWED_DURATIONS.includes(raw) ? raw : DEFAULT_LIVE_SECONDS;
    } catch (_) {}
    return venueLiveSeconds;
  }

  function openLivePopout() {
    try {
      if (livePopout && !livePopout.closed) {
        livePopout.focus();
        return livePopout;
      }
    } catch (_) {}
    const url = `./suprstar-live-popout.html?v=${APP_V}&t=${encodeURIComponent(accessToken)}`;
    livePopout = window.open(url, "floqr_suprstar_live", "width=420,height=720,noopener=no");
    return livePopout;
  }

  function showHollywoodCountdown(seconds = COUNTDOWN_SECONDS) {
    return new Promise((resolve) => {
      clearCountdownUi();
      const overlay = byId("suprstarCountdownOverlay");
      const numberEl = byId("suprstarCountdownNumber");
      if (!overlay || !numberEl) {
        resolve(true);
        return;
      }
      overlay.classList.remove("hidden");
      let left = Math.max(1, Number(seconds) || COUNTDOWN_SECONDS);
      numberEl.textContent = String(left);
      numberEl.classList.remove("flash");
      void numberEl.offsetWidth;
      numberEl.classList.add("flash");
      try {
        livePopout?.postMessage?.({type: "floqr-suprstar-countdown", seconds: left}, location.origin);
      } catch (_) {}
      countdownTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearCountdownUi();
          resolve(true);
          return;
        }
        numberEl.textContent = String(left);
        numberEl.classList.remove("flash");
        void numberEl.offsetWidth;
        numberEl.classList.add("flash");
        try {
          livePopout?.postMessage?.({type: "floqr-suprstar-countdown", seconds: left}, location.origin);
        } catch (_) {}
      }, 1000);
    });
  }

  /** One CTA that advances: camera → pay → wait → go live → end. */
  function updateButtons() {
    const btn = byId("suprstarStageBtn");
    if (!btn) return;
    const row = requestDoc || {};
    const status = String(row.status || "");
    const paid = row.paymentStatus === "paid";
    const live = isLive();

    btn.classList.remove("ghost");
    btn.classList.add("primary");
    btn.removeAttribute("aria-busy");

    if (!requestDoc) {
      btn.disabled = true;
      btn.textContent = "Unavailable";
      btn.dataset.stage = "done";
      syncPreviewChrome();
      return;
    }

    if (status === "rejected") {
      btn.disabled = true;
      btn.textContent = "Not approved — start a new supRstar";
      btn.dataset.stage = "done";
      syncPreviewChrome();
      return;
    }

    if (status === "ended" && !live) {
      btn.disabled = true;
      btn.textContent = "Session ended — start a new supRstar";
      btn.dataset.stage = "done";
      syncPreviewChrome();
      return;
    }

    if (live) {
      btn.disabled = false;
      btn.classList.remove("primary");
      btn.classList.add("ghost");
      btn.textContent = "End live stream";
      btn.dataset.stage = "end";
      syncPreviewChrome();
      return;
    }

    if (paid && status === "approved") {
      btn.disabled = liveStartInFlight || autoLiveArmed;
      btn.textContent = (liveStartInFlight || autoLiveArmed) ? "Starting live…" : "Go live now (or wait for auto-start)";
      btn.dataset.stage = "live";
      syncPreviewChrome();
      return;
    }

    if (paid || status === "pending_approval") {
      btn.disabled = true;
      btn.textContent = "Paid — waiting for venue approval";
      btn.dataset.stage = "wait";
      syncPreviewChrome();
      return;
    }

    if (["preview", "awaiting_payment"].includes(status)) {
      if (!cameraReady()) {
        btn.disabled = false;
        btn.textContent = "Start camera preview";
        btn.dataset.stage = "camera";
        syncPreviewChrome();
        return;
      }
      btn.disabled = false;
      btn.textContent = "Go pay $20 — become a supRstar";
      btn.dataset.stage = "pay";
      syncPreviewChrome();
      return;
    }

    btn.disabled = true;
    btn.textContent = "Preparing…";
    btn.dataset.stage = "idle";
    syncPreviewChrome();
  }

  function onStageClick() {
    const stage = String(byId("suprstarStageBtn")?.dataset?.stage || "");
    if (stage === "camera") return startCamera();
    if (stage === "pay") return startPayment();
    if (stage === "live") return beginLiveWithCountdown({manual: true});
    if (stage === "end") return endLive();
  }

  function applyPreviewFilter(value = "none") {
    const video = byId("suprstarPreviewVideo");
    if (!video) return;
    video.classList.remove("filter-bright", "filter-warm", "filter-cool", "filter-mono");
    const key = String(value || "none").toLowerCase();
    if (key && key !== "none") video.classList.add(`filter-${key}`);
  }

  function showApprovedToast() {
    return new Promise((resolve) => {
      const existing = byId("suprstarApprovedToast");
      if (existing) existing.remove();
      const mins = Math.floor(venueLiveSeconds / 60);
      const secs = venueLiveSeconds % 60;
      const durLabel = mins && secs ? `${mins} min ${secs} sec` : (mins ? `${mins} min` : `${venueLiveSeconds} sec`);
      const toast = document.createElement("div");
      toast.id = "suprstarApprovedToast";
      toast.className = "suprstr-approved-toast";
      toast.setAttribute("role", "dialog");
      toast.setAttribute("aria-live", "assertive");
      toast.innerHTML = `
        <div class="suprstr-approved-toast-card">
          <p class="suprstr-approved-toast-title">Live feed approved</p>
          <p class="suprstr-approved-toast-body">${COUNTDOWN_SECONDS}-second countdown starts now. Live runs for ${durLabel}.</p>
        </div>`;
      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("is-visible"));
      window.setTimeout(() => {
        toast.classList.remove("is-visible");
        window.setTimeout(() => {
          toast.remove();
          resolve(true);
        }, 280);
      }, 1600);
    });
  }

  async function maybeAutoStartOnApproval(prevStatus, nextStatus) {
    if (nextStatus !== "approved") return;
    if (prevStatus === "approved" || prevStatus === "live") return;
    if (isLive() || autoLiveArmed) return;
    if (requestDoc?.paymentStatus !== "paid") return;
    autoLiveArmed = true;
    setGate(`Live feed approved — ${COUNTDOWN_SECONDS}-second countdown, then live.`);
    setStatus("Live feed approved…");
    await showApprovedToast();
    openLivePopout();
    setStatus("Cinema countdown… then you go live.");
    await beginLiveWithCountdown({manual: false});
  }

  function applyRequest(data, {prevStatus = ""} = {}) {
    requestDoc = data || null;
    if (!requestDoc) {
      setGate("Private preview not found or expired.");
      updateButtons();
      return;
    }
    const venue = requestDoc.locationName || requestDoc.locationId || "venue";
    byId("suprstarVenueLabel").textContent = `Venue: ${venue} · Ref ${requestDoc.referenceNumber || requestDoc.requestId || ""}`;
    const status = String(requestDoc.status || "");
    if (status === "preview") {
      setGate(cameraReady()
        ? "Preview on. Tap Go pay $20 when ready."
        : "Private preview ready. Start your camera, then pay $20.");
      if (!cameraReady()) setStatus("");
    } else if (status === "awaiting_payment") {
      setGate("Finish payment in Stripe, or wait a moment while we confirm your payment.");
      setStatus("If you already paid, this page will update automatically.");
      maybeConfirmAwaitingPayment();
    } else if (status === "pending_approval") {
      setGate("Payment received. Waiting for Club Admin approval in the supRstar Queue.");
      setStatus("Keep this tab open. Live starts automatically when the venue approves.");
    } else if (status === "approved") {
      setGate(`Live feed approved — ${COUNTDOWN_SECONDS}-second countdown, then live.`);
      setStatus("Club Admin approved — preparing live session…");
      maybeAutoStartOnApproval(prevStatus, status);
    } else if (status === "live") {
      setGate("You are LIVE on the venue SupRStar board.");
      setStatus(broadcastHandle
        ? "Keep the live pop-out open while streaming."
        : "Reconnecting live broadcast…");
      openLivePopout();
      if (!broadcastHandle && !liveStartInFlight && requestDoc.paymentStatus === "paid") {
        beginLiveWithCountdown({manual: false});
      }
    } else if (status === "rejected") {
      setGate("This request was not approved by the venue.");
      setStatus(requestDoc.rejectionReason || "Rejected.");
      stopCamera();
    } else if (status === "ended") {
      setGate("Live session ended.");
      stopCamera();
    }
    updateButtons();
  }

  async function maybeConfirmAwaitingPayment() {
    if (!requestDoc) return;
    const status = String(requestDoc.status || "");
    if (!["awaiting_payment", "preview"].includes(status) && requestDoc.paymentStatus === "paid") return;
    if (requestDoc.paymentStatus === "paid" && status === "pending_approval") return;
    let orderId = "";
    try { orderId = sessionStorage.getItem("floqr_suprstar_order") || ""; } catch (_) {}
    if (!orderId) return;
    try {
      if (global.FLOQRPayments?.confirmCheckoutSession) {
        const result = await global.FLOQRPayments.confirmCheckoutSession({orderId, status: setStatus});
        if (result?.ok) setStatus("Payment confirmed. Waiting for Club Admin approval…");
      }
    } catch (_) {}
  }

  async function startCamera() {
    try {
      if (!global.FLOQRSuprstrRtc) throw new Error("Camera helper failed to load.");
      localStream = await global.FLOQRSuprstrRtc.getCameraStream({audio: true, facingMode});
      attachStreamToVideo(localStream);
      setGate("Preview on. Tap Go pay $20 when ready.");
      setStatus("Local preview only — not on the club board yet.");
      updateButtons();
    } catch (err) {
      setStatus(err?.message || "Camera failed.");
      updateButtons();
    }
  }

  async function flipCamera() {
    if (!global.FLOQRSuprstrRtc?.isMobileLike?.()) {
      setStatus("Camera flip is only available on phones and tablets.");
      return;
    }
    if (!cameraReady()) {
      setStatus("Start camera first.");
      return;
    }
    try {
      facingMode = facingMode === "user" ? "environment" : "user";
      const next = await global.FLOQRSuprstrRtc.switchCameraFacing(localStream, {facingMode, audio: true});
      localStream = next;
      attachStreamToVideo(localStream);
      if (broadcastHandle?.replaceStream) await broadcastHandle.replaceStream(localStream);
      syncPreviewChrome();
      setStatus(facingMode === "user" ? "Front camera" : "Rear camera");
    } catch (err) {
      facingMode = facingMode === "user" ? "environment" : "user";
      setStatus(err?.message || "Could not switch camera.");
    }
  }

  async function logPopup(action, message, details = {}) {
    try {
      if (global.FLOQRPayments?.logPopupEvent) {
        await global.FLOQRPayments.logPopupEvent(action, message, {
          flow: "suprstar_preview",
          requestId: requestDoc?.requestId || "",
          accessToken: accessToken ? `${accessToken.slice(0, 6)}…` : "",
          ...details
        });
      } else if (global.FLOQRLog?.write) {
        await global.FLOQRLog.write({
          level: action === "popup_blocked" ? "warn" : "info",
          category: "checkout",
          action,
          message,
          details: {flow: "suprstar_preview", ...details},
          source: "suprstar-preview"
        });
      }
    } catch (_) {}
  }

  async function startPayment() {
    if (!requestDoc?.requestId) return;
    if (!cameraReady()) {
      setStatus("Start camera preview before paying.");
      updateButtons();
      return;
    }
    if (!global.FLOQRPayments?.startCheckout) {
      setStatus("Payment service failed to load.");
      return;
    }
    checkoutPopup = global.FLOQRPayments.openUserGesturePopup
      ? global.FLOQRPayments.openUserGesturePopup("floqr_suprstar_pay")
      : window.open("about:blank", "floqr_suprstar_pay", "width=540,height=780");
    const popupBlocked = !checkoutPopup;
    if (!popupBlocked) {
      try { checkoutPopup.opener = null; } catch (_) {}
    }
    try {
      try { sessionStorage.setItem("floqr_suprstar_token", accessToken); } catch (_) {}
      setStatus(popupBlocked ? "Preparing Stripe checkout…" : "Opening Stripe checkout in a pop-out… keep this preview open.");
      const result = await global.FLOQRPayments.startCheckout({
        orderType: "suprstarRequest",
        payload: {
          requestId: requestDoc.requestId,
          clubLocationId: requestDoc.locationId
        },
        status: setStatus,
        redirect: false
      });
      const url = result?.checkoutUrl;
      if (!url) throw new Error("No checkout URL.");
      try {
        if (result?.orderId) sessionStorage.setItem("floqr_suprstar_order", result.orderId);
      } catch (_) {}
      if (!popupBlocked && checkoutPopup && !checkoutPopup.closed) {
        checkoutPopup.location.href = url;
        await logPopup("popup_opened", "supRstar Stripe checkout opened in pop-out", {
          orderId: result?.orderId || "",
          popupName: "floqr_suprstar_pay"
        });
        setStatus("Complete payment in the Stripe pop-out. This preview tab stays open — do not close it.");
        return;
      }
      await logPopup("popup_blocked", "supRstar checkout pop-out unavailable; using same-tab fallback", {
        orderId: result?.orderId || "",
        popupBlocked,
        popupClosed: popupBlocked ? true : !!checkoutPopup?.closed
      });
      try { checkoutPopup?.close(); } catch (_) {}
      setStatus("Pop-up unavailable — opening Stripe in this tab. Use Return to preview after payment.");
      window.location.assign(url);
    } catch (err) {
      try { checkoutPopup?.close(); } catch (_) {}
      setStatus(err?.message || "Checkout failed.");
      await logPopup("checkout_failed", err?.message || "Checkout failed.", {requestId: requestDoc?.requestId || ""});
    }
  }

  async function beginLiveWithCountdown({manual = false} = {}) {
    if (!requestDoc?.requestId) return;
    const statusNow = String(requestDoc.status || "");
    if (requestDoc.paymentStatus !== "paid") {
      setStatus("Payment and Club Admin approval are required first.");
      return;
    }
    if (!["approved", "live"].includes(statusNow)) {
      setStatus("Payment and Club Admin approval are required first.");
      return;
    }
    if (broadcastHandle || liveStartInFlight) return;
    liveStartInFlight = true;
    autoLiveArmed = true;
    updateButtons();
    try {
      if (!localStream) await startCamera();
      openLivePopout();
      if (statusNow === "approved") {
        setStatus("Cinema countdown… then you go live. Duration starts after the board connects.");
        await showHollywoodCountdown(COUNTDOWN_SECONDS);
      }
      if (broadcastHandle) return;
      await goLive();
    } catch (err) {
      autoLiveArmed = false;
      setStatus(err?.message || "Could not start live.");
      if (!manual) updateButtons();
    } finally {
      liveStartInFlight = false;
      updateButtons();
    }
  }

  async function goLive() {
    if (!requestDoc?.requestId) return;
    if (broadcastHandle) return;
    const status = String(requestDoc.status || "");
    if (requestDoc.paymentStatus !== "paid") {
      setStatus("Payment and Club Admin approval are required first.");
      return;
    }
    if (!["approved", "live"].includes(status)) {
      setStatus("Payment and Club Admin approval are required first.");
      return;
    }
    let startedSessionId = "";
    try {
      if (!localStream) await startCamera();
      await loadVenueDuration(requestDoc.locationId);
      setStatus("Starting live session…");
      const start = await callable("startSuprstrLive")({
        requestId: requestDoc.requestId,
        liveDurationSeconds: venueLiveSeconds
      });
      const sessionId = start?.data?.sessionId;
      if (!sessionId) throw new Error("No sessionId returned.");
      startedSessionId = sessionId;
      activeSessionId = sessionId;
      if (requestDoc) requestDoc.sessionId = sessionId;
      const durationSeconds = ALLOWED_DURATIONS.includes(Number(start?.data?.liveDurationSeconds))
        ? Number(start.data.liveDurationSeconds)
        : venueLiveSeconds;
      venueLiveSeconds = durationSeconds;
      // Do not arm the duration clock yet — wait until WebRTC ICE is stably connected.
      liveEndsAtMs = 0;
      liveTimerArmed = false;
      liveConnectedAtMs = 0;
      liveArmedAtMs = 0;
      liveDiagCorrelationId = global.FLOQRLog?.correlationId?.("srlive") || `srlive_${Date.now().toString(36)}`;
      liveDiag("live_start_ok", "startSuprstrLive returned", {
        sessionId,
        durationSeconds,
        serverEndsAtMs: Number(start?.data?.liveEndsAtMs) || 0,
        resumed: !!start?.data?.resumed
      });

      broadcastHandle = await global.FLOQRSuprstrRtc.startBroadcast({
        sessionId,
        stream: localStream,
        onStatus(s, meta = {}) {
          lastWebrtcStatus = String(s || "");
          lastWebrtcMeta = meta && typeof meta === "object" ? meta : {};
          setStatus(`LIVE · WebRTC: ${s}`);
          liveDiag("webrtc_status", `WebRTC status → ${s}`, {
            sessionId,
            meta: lastWebrtcMeta
          });
          if (s === "connected" || s === "ice-connected" || s === "ice-completed") {
            queueArmAfterStableConnect(sessionId, lastWebrtcMeta);
            if (!liveHeartbeatTimer) startLiveHeartbeat(sessionId);
          } else if (s === "answered" || s === "offering") {
            // Signaling only — timer must not start yet.
          } else if (s === "failed" || s === "disconnected" || s === "closed") {
            liveDiag("webrtc_unstable", `WebRTC ${s} while live`, {
              sessionId,
              meta: lastWebrtcMeta,
              liveTimerArmed,
              remainMs: liveEndsAtMs ? Math.max(0, liveEndsAtMs - Date.now()) : null
            }, "warn");
          }
        }
      });
      setStatus("LIVE — waiting for the venue board to connect (timer starts then)…");
      openLivePopout();
      syncPreviewChrome();
      updateButtons();
      // Diagnostics only — never arm the paid duration clock without a real connection.
      if (connectWaitDiagTimer) clearTimeout(connectWaitDiagTimer);
      connectWaitDiagTimer = setTimeout(() => {
        connectWaitDiagTimer = null;
        if (broadcastHandle && !liveTimerArmed) {
          liveDiag("webrtc_connect_wait_timeout", "Board has not ICE-connected yet; duration clock still waiting", {
            sessionId,
            waitMs: CONNECT_WAIT_DIAG_MS,
            webrtc: lastWebrtcStatus,
            meta: lastWebrtcMeta
          }, "warn");
          setStatus("LIVE — still waiting for the venue board link. Timer has not started yet.");
        }
      }, CONNECT_WAIT_DIAG_MS);
    } catch (err) {
      // Never tear down a session that already started — overlapping go-live used to endLive() here.
      if (broadcastHandle || (startedSessionId && String(requestDoc?.status || "") === "live")) {
        setStatus(err?.message || "Live already starting — keep this tab open.");
        return;
      }
      setStatus(err?.message || "Go live failed.");
    }
  }

  async function endLive({silent = false, reason = ""} = {}) {
    clearCountdownUi();
    clearConnectArmTimers();
    clearLiveHeartbeat();
    liveDiag("live_end", `Ending live (${reason || "manual"})`, {
      reason: reason || "manual",
      remainMs: liveEndsAtMs ? Math.max(0, liveEndsAtMs - Date.now()) : null,
      livedMs: liveConnectedAtMs ? Date.now() - liveConnectedAtMs : null,
      armedMs: liveArmedAtMs ? Date.now() - liveArmedAtMs : null,
      webrtc: lastWebrtcStatus,
      meta: lastWebrtcMeta
    }, reason === "duration" ? "info" : "warn");
    clearLiveExpireTimer();
    autoLiveArmed = false;
    liveStartInFlight = false;
    liveConnectedAtMs = 0;
    const endingSessionId = activeSessionId || requestDoc?.sessionId || "";
    try {
      if (broadcastHandle) {
        broadcastHandle.stop({stopTracks: false});
        broadcastHandle = null;
      }
      if (requestDoc?.requestId) {
        await callable("endSuprstrLive")({
          requestId: requestDoc.requestId,
          sessionId: endingSessionId,
          locationId: requestDoc.locationId,
          displayBoard: requestDoc.displayBoard
        });
      }
    } catch (err) {
      if (!silent) setStatus(err?.message || "End live failed.");
      liveDiag("live_end_error", err?.message || "endSuprstrLive failed", {
        reason: reason || "manual",
        error: err?.message || String(err || "")
      }, "error");
    }
    activeSessionId = "";
    stopCamera();
    updateButtons();
    if (!silent) {
      setStatus(reason === "duration" ? "Live ended — time limit reached." : "Live ended. Camera stopped.");
    }
    try {
      livePopout?.postMessage?.({type: "floqr-suprstar-ended"}, location.origin);
    } catch (_) {}
  }

  function watchRequest(uid) {
    if (requestUnsub) {
      requestUnsub();
      requestUnsub = null;
    }
    if (!accessToken || !uid) return;
    let prevStatus = "";
    requestUnsub = firebase.firestore().collection("suprstarRequests").doc(accessToken)
      .onSnapshot(snap => {
        if (!snap.exists) {
          applyRequest(null);
          return;
        }
        const data = {id: snap.id, ...snap.data()};
        if (data.broadcasterUid && data.broadcasterUid !== uid) {
          setGate("This private preview belongs to another account. Sign in with the account that started it.");
          applyRequest(null);
          return;
        }
        const nextStatus = String(data.status || "");
        applyRequest(data, {prevStatus});
        prevStatus = nextStatus;
      }, err => setGate(err.message || "Could not load private preview."));
  }

  function bindUi() {
    byId("suprstarStageBtn")?.addEventListener("click", () => onStageClick());
    byId("suprstarFlipCamBtn")?.addEventListener("click", () => flipCamera());
    byId("suprstarPreviewFilter")?.addEventListener("change", (event) => {
      applyPreviewFilter(event.target?.value || "none");
    });
    window.addEventListener("message", (ev) => {
      if (ev?.data?.type === "floqr-suprstar-paid") {
        setStatus("Payment confirmed. Waiting for Club Admin approval…");
        try { checkoutPopup?.close(); } catch (_) {}
        maybeConfirmAwaitingPayment();
      }
      if (ev?.data?.type === "floqr-suprstar-popout-ready") {
        syncPreviewChrome();
      }
      if (ev?.data?.type === "floqr-suprstar-end-from-popout") {
        endLive();
      }
    });
    window.addEventListener("beforeunload", () => {
      try {
        global.FLOQRSuprstrRtc?.stopStream?.(localStream);
      } catch (_) {}
    });
  }

  function recoverAccessToken() {
    let token = qs("t");
    if (token && token.length >= 24) return token;
    try {
      token = sessionStorage.getItem("floqr_suprstar_token") || "";
    } catch (_) {}
    if (token && token.length >= 24) {
      try {
        const url = new URL(location.href);
        url.searchParams.set("t", token);
        if (!url.searchParams.get("v")) url.searchParams.set("v", APP_V);
        history.replaceState(null, "", url.toString());
      } catch (_) {}
      return token;
    }
    return "";
  }

  function boot() {
    global.FLOQRNav?.applyGlobalBack("floqrGlobalBack");
    if (!global.firebase?.apps?.length && global.firebaseConfig) firebase.initializeApp(global.firebaseConfig);
    bindUi();
    syncPreviewChrome();
    accessToken = recoverAccessToken();
    if (!accessToken || accessToken.length < 24) {
      setGate("Missing private preview token. Start again from Search → supRstar, or open the preview link from your payment receipt.");
      byId("suprstarRecoverActions")?.classList.remove("hidden");
      updateButtons();
      return;
    }
    try { sessionStorage.setItem("floqr_suprstar_token", accessToken); } catch (_) {}
    firebase.auth().onAuthStateChanged(user => {
      if (!user) {
        setGate("Sign in to open your private preview.");
        firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => setGate(e.message));
        return;
      }
      watchRequest(user.uid);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
