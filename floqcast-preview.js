/* Private floqCast preview — camera local until paid + Club Admin approved. */
(function (global) {
  "use strict";

  const ALLOWED_DURATIONS = [15, 30, 45, 60, 90];
  const DEFAULT_LIVE_SECONDS = 90;
  const CONNECT_ARM_DEBOUNCE_MS = 2500;
  const CONNECT_WAIT_DIAG_MS = 30000;
  const LIVE_HEARTBEAT_MS = 10000;

  let requestDoc = null;
  let requestUnsub = null;
  let localStream = null;
  let broadcastHandle = null;
  let checkoutPopup = null;
  let accessToken = "";
  let liveTimerArmed = false;
  let liveTimerArmInFlight = false;
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

  function setGate(msg) {
    const el = byId("floqcastPreviewGate");
    if (el) el.textContent = msg;
  }

  function setStatus(msg) {
    const el = byId("floqcastStepStatus");
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

  function liveDiag(action, message, details = {}, level = "info") {
    const payload = {
      level,
      category: "suprstar",
      action: String(action || "live_diag"),
      message: String(message || action || "floqCast live diagnostic"),
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
      source: "floqcast-preview"
    };
    try {
      if (global.FLOQRLog?.write) global.FLOQRLog.write(payload);
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
      durationSeconds: venueLiveSeconds
    });
    liveExpireTimer = setTimeout(() => {
      liveDiag("live_timer_fire", "Duration elapsed — ending live", {
        endsAtMs: liveEndsAtMs,
        durationSeconds: venueLiveSeconds
      }, "warn");
      endLive({silent: false, reason: "duration"});
    }, remainMs);
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
      const armed = await callable("armFloqCastLiveDuration")({
        requestId: requestDoc?.requestId || "",
        sessionId: sessionId || activeSessionId || requestDoc?.sessionId || "",
        armSource: source
      });
      const ends = Number(armed?.data?.liveEndsAtMs) || (Date.now() + durationSeconds * 1000);
      venueLiveSeconds = ALLOWED_DURATIONS.includes(Number(armed?.data?.liveDurationSeconds))
        ? Number(armed.data.liveDurationSeconds)
        : durationSeconds;
      scheduleLiveExpire(ends);
      setStatus(`LIVE on the venue floqCast board for ${venueLiveSeconds}s. Keep this tab open.`);
      liveDiag("live_timer_arm_ok", "Server armed live duration", {
        source,
        alreadyArmed: !!armed?.data?.alreadyArmed,
        endsAtMs: ends,
        durationSeconds: venueLiveSeconds
      });
      return ends;
    } catch (err) {
      scheduleLiveExpire(Date.now() + durationSeconds * 1000);
      setStatus(`LIVE on the venue floqCast board for ${durationSeconds}s. Keep this tab open.`);
      liveDiag("live_timer_arm_fallback", err?.message || "armFloqCastLiveDuration failed; local fallback", {
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

  /** One CTA that advances: camera → pay → wait → go live → end. */
  function updateButtons() {
    const btn = byId("floqcastStageBtn");
    if (!btn) return;
    const row = requestDoc || {};
    const status = String(row.status || "");
    const paid = row.paymentStatus === "paid";
    const live = !!broadcastHandle || status === "live";

    btn.classList.remove("ghost");
    btn.classList.add("primary");
    btn.removeAttribute("aria-busy");

    if (!requestDoc) {
      btn.disabled = true;
      btn.textContent = "Unavailable";
      btn.dataset.stage = "done";
      return;
    }

    if (status === "rejected") {
      btn.disabled = true;
      btn.textContent = "Not approved — start a new floqCast";
      btn.dataset.stage = "done";
      return;
    }

    if (status === "ended" && !live) {
      btn.disabled = true;
      btn.textContent = "Session ended — start a new floqCast";
      btn.dataset.stage = "done";
      return;
    }

    if (live) {
      btn.disabled = false;
      btn.classList.remove("primary");
      btn.classList.add("ghost");
      btn.textContent = "End live stream";
      btn.dataset.stage = "end";
      return;
    }

    if (paid && status === "approved") {
      btn.disabled = false;
      btn.textContent = "Go live, be a floqCast";
      btn.dataset.stage = "live";
      return;
    }

    if (paid || status === "pending_approval") {
      btn.disabled = true;
      btn.textContent = "Paid — waiting for venue approval";
      btn.dataset.stage = "wait";
      return;
    }

    if (["preview", "awaiting_payment"].includes(status)) {
      if (!cameraReady()) {
        btn.disabled = false;
        btn.textContent = "Start camera preview";
        btn.dataset.stage = "camera";
        return;
      }
      btn.disabled = false;
      btn.textContent = "Go pay $20 — become a floqCast";
      btn.dataset.stage = "pay";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Preparing…";
    btn.dataset.stage = "idle";
  }

  function onStageClick() {
    const stage = String(byId("floqcastStageBtn")?.dataset?.stage || "");
    if (stage === "camera") return startCamera();
    if (stage === "pay") return startPayment();
    if (stage === "live") return goLive();
    if (stage === "end") return endLive();
  }

  function applyRequest(data) {
    requestDoc = data || null;
    if (!requestDoc) {
      setGate("Private preview not found or expired.");
      updateButtons();
      return;
    }
    const venue = requestDoc.locationName || requestDoc.locationId || "venue";
    byId("floqcastVenueLabel").textContent = `Venue: ${venue} · Ref ${requestDoc.referenceNumber || requestDoc.requestId || ""}`;
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
      setGate("Payment received. Waiting for Club Admin approval in the floqCast Queue.");
      setStatus("Do not close this tab. Go live unlocks when the venue approves.");
    } else if (status === "approved") {
      setGate("Approved! Tap Go live — your stream will reach the venue floqCast board.");
      setStatus("Club Admin approved. Tap Go live when ready.");
    } else if (status === "live") {
      setGate("You are live on the venue floqCast board.");
      setStatus("Keep this tab open while streaming.");
    } else if (status === "rejected") {
      setGate("This request was not approved by the venue.");
      setStatus(requestDoc.rejectionReason || "Rejected.");
    } else if (status === "ended") {
      setGate("Live session ended.");
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

  function setCameraLabel(text) {
    const el = byId("floqcastCameraLabel");
    if (el) el.textContent = text || "";
  }

  async function refreshSwitchCameraBtn() {
    const btn = byId("floqcastSwitchCameraBtn");
    if (!btn) return;
    try {
      const list = await global.FLOQRFloqCastRtc?.listVideoDevices?.() || [];
      const pool = global.FLOQRFloqCastRtc?.switchCameraPool?.(list) || list.filter((d) => d.score > -50);
      // Always show once camera is on — facingMode toggle can still flip Front↔Back on iPhone.
      const show = cameraReady() && (pool.length > 1 || list.length >= 1);
      btn.classList.toggle("hidden", !show);
      btn.disabled = !show;
    } catch (_) {
      btn.classList.add("hidden");
    }
  }

  function attachLocalPreview(stream) {
    const video = byId("floqcastPreviewVideo");
    if (video) {
      video.srcObject = stream;
      video.classList.add("is-on");
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.play?.().catch(() => {});
    }
    const label = stream?.getVideoTracks?.()[0]?.label || "Camera";
    setCameraLabel(`Using: ${label}`);
  }

  async function startCamera() {
    try {
      if (!global.FLOQRFloqCastRtc) throw new Error("Camera helper failed to load.");
      localStream = await global.FLOQRFloqCastRtc.getCameraStream({audio: true});
      attachLocalPreview(localStream);
      setGate("Preview on. Tap Go pay $20 when ready. Use Switch camera if the framing looks wrong.");
      setStatus("Local preview only — not on the club board yet. Prefer Front / FaceTime on iPhone.");
      updateButtons();
      await refreshSwitchCameraBtn();
    } catch (err) {
      setStatus(err?.message || "Camera failed.");
      updateButtons();
    }
  }

  async function switchCamera() {
    if (!localStream || !global.FLOQRFloqCastRtc?.switchCameraStream) return;
    const btn = byId("floqcastSwitchCameraBtn");
    if (btn) btn.disabled = true;
    try {
      const result = await global.FLOQRFloqCastRtc.switchCameraStream(localStream, {audio: true});
      if (!result?.stream) throw new Error("Could not switch camera.");
      localStream = result.stream;
      attachLocalPreview(localStream);
      if (!result.switched) {
        setStatus(result.reason
          ? `Could not switch camera (${result.reason}). Still using ${result.label || "Camera"}.`
          : `Only one usable camera on this phone (${result.label || "Camera"}).`);
        return;
      }
      if (broadcastHandle?.replaceStream) {
        await broadcastHandle.replaceStream(localStream);
        setStatus(`Switched camera while live → ${result.label || "Camera"}`);
      } else {
        setStatus(`Using ${result.label || "Camera"}. Framing matches the venue board (contain, not crop).`);
      }
    } catch (err) {
      setStatus(err?.message || "Could not switch camera.");
    } finally {
      await refreshSwitchCameraBtn();
    }
  }

  async function logPopup(action, message, details = {}) {
    try {
      if (global.FLOQRPayments?.logPopupEvent) {
        await global.FLOQRPayments.logPopupEvent(action, message, {
          flow: "floqcast_preview",
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
          details: {flow: "floqcast_preview", ...details},
          source: "floqcast-preview"
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
    // Open popup synchronously on click — before any await — or browsers block it.
    checkoutPopup = global.FLOQRPayments.openUserGesturePopup
      ? global.FLOQRPayments.openUserGesturePopup("floqr_suprstar_pay")
      : window.open("about:blank", "floqr_suprstar_pay", "width=540,height=780");
    const popupBlocked = !checkoutPopup;
    if (!popupBlocked) {
      try { checkoutPopup.opener = null; } catch (_) {}
    }
    try {
      try { sessionStorage.setItem("floqr_floqcast_token", accessToken); } catch (_) {}
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
        await logPopup("popup_opened", "floqCast Stripe checkout opened in pop-out", {
          orderId: result?.orderId || "",
          popupName: "floqr_suprstar_pay"
        });
        setStatus("Complete payment in the Stripe pop-out. This preview tab stays open — do not close it.");
        return;
      }
      await logPopup("popup_blocked", "floqCast checkout pop-out unavailable; using same-tab fallback", {
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
      const start = await callable("startFloqCastLive")({
        requestId: requestDoc.requestId,
        liveDurationSeconds: venueLiveSeconds
      });
      const sessionId = start?.data?.sessionId;
      if (!sessionId) throw new Error("No sessionId returned.");
      startedSessionId = sessionId;
      activeSessionId = sessionId;
      if (requestDoc) requestDoc.sessionId = sessionId;
      venueLiveSeconds = ALLOWED_DURATIONS.includes(Number(start?.data?.liveDurationSeconds))
        ? Number(start.data.liveDurationSeconds)
        : venueLiveSeconds;
      // Do not arm the duration clock yet — wait until WebRTC ICE is stably connected.
      liveEndsAtMs = 0;
      liveTimerArmed = false;
      liveConnectedAtMs = 0;
      liveArmedAtMs = 0;
      liveDiagCorrelationId = global.FLOQRLog?.correlationId?.("fclive") || `fclive_${Date.now().toString(36)}`;
      liveDiag("live_start_ok", "startFloqCastLive returned", {
        sessionId,
        durationSeconds: venueLiveSeconds,
        serverEndsAtMs: Number(start?.data?.liveEndsAtMs) || 0,
        resumed: !!start?.data?.resumed
      });

      broadcastHandle = await global.FLOQRFloqCastRtc.startBroadcast({
        sessionId,
        stream: localStream,
        // Paint WebRTC from the visible preview so iOS orientation matches what you see.
        videoEl: byId("floqcastPreviewVideo"),
        onStatus(s, meta = {}) {
          lastWebrtcStatus = String(s || "");
          lastWebrtcMeta = meta && typeof meta === "object" ? meta : {};
          if (s === "upright-canvas") {
            /* quiet */
          } else if (s === "renegotiating") {
            setStatus("LIVE — restoring venue link after a drop (keep this tab open)…");
          } else if (s === "disconnected") {
            setStatus("LIVE — link blip (Wi‑Fi/NAT). Holding… keep this tab open; do not spam End live.");
          } else if (s === "failed") {
            setStatus("LIVE — link failed; auto-rebuilding offer for the board…");
          } else if (String(s).startsWith("renegotiate-error")) {
            setStatus(`LIVE — reconnect hiccup (${String(s).slice(0, 80)}). Keep tab open.`);
          } else {
            setStatus(`LIVE · WebRTC: ${s}`);
          }
          liveDiag("webrtc_status", `WebRTC status → ${s}`, {sessionId, meta: lastWebrtcMeta});
          if (s === "connected" || s === "ice-connected" || s === "ice-completed") {
            queueArmAfterStableConnect(sessionId, lastWebrtcMeta);
            if (!liveHeartbeatTimer) startLiveHeartbeat(sessionId);
            // Unstick local preview if iOS paused the element during a blip.
            try { global.FLOQRFloqCastRtc?.forceVideoPlay?.(byId("floqcastPreviewVideo")); } catch (_) {}
          } else if (s === "failed" || s === "disconnected" || s === "closed") {
            liveDiag("webrtc_unstable", `WebRTC ${s} while live`, {
              sessionId,
              meta: lastWebrtcMeta,
              liveTimerArmed,
              remainMs: liveEndsAtMs ? Math.max(0, liveEndsAtMs - Date.now()) : null
            }, "warn");
            try { global.FLOQRFloqCastRtc?.forceVideoPlay?.(byId("floqcastPreviewVideo")); } catch (_) {}
          }
        }
      });
      setStatus("LIVE — waiting for the venue floqCast board to connect (timer starts then)…");
      updateButtons();
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
          setStatus("LIVE — still waiting for the venue board link. Timer has not started yet. Confirm display2.html?location= is open on the floqCast LED.");
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
    clearConnectArmTimers();
    clearLiveHeartbeat();
    liveDiag("live_end", `Ending live (${reason || "manual"})`, {
      reason: reason || "manual",
      remainMs: liveEndsAtMs ? Math.max(0, liveEndsAtMs - Date.now()) : null,
      livedMs: liveConnectedAtMs ? Date.now() - liveConnectedAtMs : null
    }, reason === "duration" ? "info" : "warn");
    clearLiveExpireTimer();
    liveConnectedAtMs = 0;
    const endingSessionId = activeSessionId || requestDoc?.sessionId || "";
    try {
      if (broadcastHandle) {
        broadcastHandle.stop({stopTracks: false});
        broadcastHandle = null;
      }
      if (requestDoc?.requestId) {
        await callable("endFloqCastLive")({
          requestId: requestDoc.requestId,
          sessionId: endingSessionId,
          locationId: requestDoc.locationId,
          displayBoard: "secondary"
        });
      }
    } catch (err) {
      if (!silent) setStatus(err?.message || "End live failed.");
      liveDiag("live_end_error", err?.message || "endFloqCastLive failed", {
        reason: reason || "manual",
        error: err?.message || String(err || "")
      }, "error");
    }
    activeSessionId = "";
    updateButtons();
    if (!silent) {
      setStatus(reason === "duration" ? "Live ended — time limit reached." : "Live ended.");
    }
  }

  function watchRequest(uid) {
    if (requestUnsub) {
      requestUnsub();
      requestUnsub = null;
    }
    if (!accessToken || !uid) return;
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
        applyRequest(data);
      }, err => setGate(err.message || "Could not load private preview."));
  }

  function bindUi() {
    byId("floqcastStageBtn")?.addEventListener("click", () => onStageClick());
    byId("floqcastSwitchCameraBtn")?.addEventListener("click", () => switchCamera());
    byId("floqcastPreviewGoogleLoginBtn")?.addEventListener("click", () => {
      if (window.FLOQRSessionShell?.popupBlocked?.("#floqcastPreviewGate")) return;
      firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => setGate(e.message));
    });
    byId("floqcastPreviewMicrosoftLoginBtn")?.addEventListener("click", () => {
      if (window.FLOQRSessionShell?.popupBlocked?.("#floqcastPreviewGate")) return;
      firebase.auth().signInWithPopup(new firebase.auth.OAuthProvider("microsoft.com")).catch(e => setGate(e.message));
    });
    window.addEventListener("message", (ev) => {
      if (ev?.data?.type === "floqr-suprstar-paid") {
        setStatus("Payment confirmed. Waiting for Club Admin approval…");
        try { checkoutPopup?.close(); } catch (_) {}
        maybeConfirmAwaitingPayment();
      }
    });
    // iPhone Safari suspends the camera when this tab is backgrounded — board goes black
    // while Firestore still shows LIVE. Keep the preview tab foreground while casting.
    document.addEventListener("visibilitychange", () => {
      if (!broadcastHandle) return;
      if (document.visibilityState === "hidden") {
        setStatus("LIVE — keep this phone tab open in the foreground or the venue board goes black.");
        liveDiag("preview_hidden_while_live", "Preview tab hidden while broadcasting", {
          sessionId: activeSessionId || requestDoc?.sessionId || "",
          liveTimerArmed
        }, "warn");
        return;
      }
      liveDiag("preview_visible_while_live", "Preview tab visible again — requesting renegotiate if needed", {
        sessionId: activeSessionId || requestDoc?.sessionId || "",
        webrtc: lastWebrtcStatus
      });
      if (["failed", "disconnected", "closed"].includes(lastWebrtcStatus) || !peerLooksConnected(lastWebrtcMeta)) {
        broadcastHandle.renegotiate?.("preview-visible").catch(() => {});
        setStatus("LIVE — reconnecting to the venue board…");
      }
    });
  }

  function recoverAccessToken() {
    let token = qs("t");
    if (token && token.length >= 24) return token;
    try {
      token = sessionStorage.getItem("floqr_floqcast_token") || "";
    } catch (_) {}
    if (token && token.length >= 24) {
      try {
        const url = new URL(location.href);
        url.searchParams.set("t", token);
        url.searchParams.delete("v");
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
    accessToken = recoverAccessToken();
    if (!accessToken || accessToken.length < 24) {
      setGate("Missing private preview token. Start again from Search → floqCast, or open the preview link from your payment receipt.");
      byId("floqcastRecoverActions")?.classList.remove("hidden");
      updateButtons();
      return;
    }
    try { sessionStorage.setItem("floqr_floqcast_token", accessToken); } catch (_) {}
    const auth = firebase.auth();
    window.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#floqcastPreviewGate"
    });
    auth.onAuthStateChanged(user => {
      if (!user) {
        setGate("Sign in with the same FLOQR account you use on Search / My Profile.");
        return;
      }
      watchRequest(user.uid);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
