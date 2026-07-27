/* Private supRstar preview — camera local until paid + Club Admin approved. */
(function (global) {
  "use strict";

  const APP_V = "29.09.69";
  let requestDoc = null;
  let requestUnsub = null;
  let localStream = null;
  let broadcastHandle = null;
  let checkoutPopup = null;
  let accessToken = "";

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

  function updateButtons() {
    const row = requestDoc || {};
    const status = String(row.status || "");
    const paid = row.paymentStatus === "paid";
    const live = !!broadcastHandle || status === "live";
    const payBtn = byId("suprstarPayBtn");
    const goBtn = byId("suprstarGoLiveBtn");
    const endBtn = byId("suprstarEndLiveBtn");
    if (payBtn) {
      payBtn.disabled = paid || live || !["preview", "awaiting_payment"].includes(status);
      payBtn.textContent = paid ? "Paid — waiting for venue approval" : "Pay $20 — become a supRstar";
    }
    if (goBtn) {
      goBtn.disabled = !paid || status !== "approved" || live;
      goBtn.textContent = live ? "Live…" : "Go live, be a supRstar";
    }
    endBtn?.classList.toggle("hidden", !live);
  }

  function applyRequest(data) {
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
      setGate("Private preview ready. Start your camera, then pay $20.");
      setStatus("");
    } else if (status === "awaiting_payment") {
      setGate("Finish payment in Stripe, or wait a moment while we confirm your payment.");
      setStatus("If you already paid, this page will update automatically.");
      maybeConfirmAwaitingPayment();
    } else if (status === "pending_approval") {
      setGate("Payment received. Waiting for Club Admin approval in the supRstar Queue.");
      setStatus("Do not close this tab. You will unlock Go live when approved.");
    } else if (status === "approved") {
      setGate("Approved! You can Go live — your stream will reach the venue SupRStar board.");
      setStatus("Club Admin approved. Tap Go live when ready.");
    } else if (status === "live") {
      setGate("You are live on the venue SupRStar board.");
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
    if (!requestDoc || String(requestDoc.status) !== "awaiting_payment") return;
    let orderId = "";
    try { orderId = sessionStorage.getItem("floqr_suprstar_order") || ""; } catch (_) {}
    if (!orderId) return;
    try {
      if (global.FLOQRPayments?.confirmCheckoutSession) {
        await global.FLOQRPayments.confirmCheckoutSession({orderId, status: setStatus});
      }
    } catch (_) {}
  }

  async function startCamera() {
    try {
      if (!global.FLOQRSuprstrRtc) throw new Error("Camera helper failed to load.");
      localStream = await global.FLOQRSuprstrRtc.getCameraStream({audio: true});
      const video = byId("suprstarPreviewVideo");
      if (video) {
        video.srcObject = localStream;
        video.classList.add("is-on");
        video.muted = true;
      }
      setStatus("Local preview only — not on the club board yet.");
      updateButtons();
    } catch (err) {
      setStatus(err?.message || "Camera failed.");
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

  async function goLive() {
    if (!requestDoc?.requestId) return;
    if (String(requestDoc.status) !== "approved" || requestDoc.paymentStatus !== "paid") {
      setStatus("Payment and Club Admin approval are required first.");
      return;
    }
    try {
      if (!localStream) await startCamera();
      setStatus("Starting live session…");
      const start = await callable("startSuprstrLive")({requestId: requestDoc.requestId});
      const sessionId = start?.data?.sessionId;
      if (!sessionId) throw new Error("No sessionId returned.");
      broadcastHandle = await global.FLOQRSuprstrRtc.startBroadcast({
        sessionId,
        stream: localStream,
        onStatus(s) {
          setStatus(`WebRTC: ${s}`);
        }
      });
      setStatus("Live on the venue SupRStar board. Keep this tab open.");
      updateButtons();
    } catch (err) {
      setStatus(err?.message || "Go live failed.");
      await endLive({silent: true});
    }
  }

  async function endLive({silent = false} = {}) {
    try {
      if (broadcastHandle) {
        broadcastHandle.stop();
        broadcastHandle = null;
      }
      if (requestDoc?.requestId) {
        await callable("endSuprstrLive")({
          requestId: requestDoc.requestId,
          sessionId: requestDoc.sessionId || "",
          locationId: requestDoc.locationId,
          displayBoard: requestDoc.displayBoard
        });
      }
    } catch (err) {
      if (!silent) setStatus(err?.message || "End live failed.");
    }
    updateButtons();
    if (!silent) setStatus("Live ended.");
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
    byId("suprstarStartCamBtn")?.addEventListener("click", () => startCamera());
    byId("suprstarPayBtn")?.addEventListener("click", () => startPayment());
    byId("suprstarGoLiveBtn")?.addEventListener("click", () => goLive());
    byId("suprstarEndLiveBtn")?.addEventListener("click", () => endLive());
    window.addEventListener("message", (ev) => {
      if (ev?.data?.type === "floqr-suprstar-paid") {
        setStatus("Payment confirmed. Waiting for Club Admin approval…");
        try { checkoutPopup?.close(); } catch (_) {}
        maybeConfirmAwaitingPayment();
      }
    });
  }

  function boot() {
    global.FLOQRNav?.applyGlobalBack("floqrGlobalBack");
    accessToken = qs("t");
    if (!accessToken || accessToken.length < 24) {
      setGate("Missing private preview token. Start again from Search → supRstar.");
      return;
    }
    if (!global.firebase?.apps?.length && global.firebaseConfig) firebase.initializeApp(global.firebaseConfig);
    bindUi();
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
