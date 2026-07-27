(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const qs = name => new URL(location.href).searchParams.get(name) || "";
  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const orderId = qs("order");
  const sessionId = qs("session_id");
  const cancelled = qs("cancelled") === "1";
  const isPopup = qs("popup") === "1";
  let cancelAttempted = false;
  let confirmAttempted = false;

  function money(cents) {
    return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
  }

  function paidAtLabel(order = {}) {
    if (order.paidAtIso) return order.paidAtIso;
    if (order.receipt?.paidAtIso) return order.receipt.paidAtIso;
    const ts = order.paidAt;
    if (ts?.toDate) return ts.toDate().toISOString();
    return "";
  }

  function notifyOpenerPaid(order = {}) {
    if (!isPopup) return;
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: "floqr-suprstar-paid",
          orderId,
          requestId: order.payload?.requestId || order.requestId || "",
          paymentStatus: order.paymentStatus || ""
        }, "*");
      }
    } catch (_) {}
  }

  function render(order = {}) {
    const paid = order.paymentStatus === "paid";
    const isShoutout = order.orderType === "shoutout";
    const isSuprstar = order.orderType === "suprstarRequest" || order.orderType === "suprstrSlot";
    const receipt = order.receipt || {};
    byId("paymentReturnTitle").textContent = paid
      ? (isShoutout ? "ShoutOut submitted" : isSuprstar ? "supRstar paid" : "Payment confirmed")
      : cancelled || order.status === "checkout-cancelled"
        ? "Payment cancelled"
        : "Payment processing";
    byId("paymentReturnStatus").textContent = paid
      ? (isShoutout
        ? "Your message has been sent to the location approval queue. A final receipt was also sent to FloqR Inbox and your email/SMS when available."
        : order.orderType === "suprstarRequest"
          ? "Payment received. Return to your private preview tab — Club Admin must approve before you can go live."
          : isSuprstar
            ? "Your live-stream slot(s) are credited."
            : "Your order is recorded and the next service step is underway.")
      : cancelled || order.status === "checkout-cancelled"
        ? "Nothing was submitted. The unpaid checkout was cleared so you can try again."
        : "Stripe confirmation can take a few seconds. This page updates automatically.";

    if (paid && order.orderType === "suprstarRequest") {
      notifyOpenerPaid(order);
      // Try to get the preview token from sessionStorage (set by suprstar-preview.js before checkout).
      let storedToken = "";
      try { storedToken = sessionStorage.getItem("floqr_suprstar_token") || ""; } catch (_) {}
      const requestId = order.payload?.requestId || order.requestId || "";
      // Token stored in sessionStorage is the accessToken (== Firestore doc id == requestId for suprstarRequests).
      const previewToken = storedToken || requestId;
      const previewUrl = previewToken ? `./suprstar-preview.html?t=${encodeURIComponent(previewToken)}&v=29.09.71` : "";
      const backLink = isPopup
        ? `<p class="sub small">You can close this window and return to your preview tab.</p>`
        : previewUrl
          ? `<p><a class="buttonlike" href="${esc(previewUrl)}">Return to your private preview →</a></p>`
          : `<p class="sub small">Return to your private preview tab and wait for Club Admin approval.</p>`;
      byId("paymentReturnDetails").innerHTML = `<div class="receipt payment-shoutout-receipt">
        <p><strong>Service:</strong> supRstar live appearance</p>
        <p><strong>Ref:</strong> ${esc(order.referenceNumber || requestId || "—")}</p>
        <p><strong>Status:</strong> Pending Club Admin approval</p>
        <p><strong>Total:</strong> ${esc(money(order.amountCents))}</p>
        ${backLink}
      </div>`;
      if (isPopup) {
        setTimeout(() => { try { window.close(); } catch (_) {} }, 1800);
      }
      return;
    }

    if (paid && isShoutout) {
      const paidAt = paidAtLabel(order) || "—";
      byId("paymentReturnDetails").innerHTML = `<div class="receipt payment-shoutout-receipt">
        <p><strong>Reference:</strong> ${esc(receipt.referenceNumber || order.payload?.shoutout?.referenceNumber || "—")}</p>
        <p><strong>Location:</strong> ${esc(receipt.locationName || order.payload?.shoutout?.locationName || "—")}</p>
        <p><strong>Template:</strong> ${esc(receipt.templateName || order.payload?.shoutout?.templateName || order.itemName || "—")}</p>
        <p><strong>Status:</strong> ${esc(receipt.statusLabel || "Pending Location Approval")}</p>
        <p><strong>Paid at:</strong> ${esc(paidAt)}</p>
        <p><strong>Invoice:</strong> ${esc(receipt.invoiceNumber || order.invoiceNumber || "—")}</p>
        <p><strong>Total:</strong> ${esc(money(receipt.amountCents ?? order.amountCents))}</p>
      </div>`;
      return;
    }

    byId("paymentReturnDetails").innerHTML = `<div class="report-table"><div><span>Invoice</span><strong>${esc(order.invoiceNumber || "Pending")}</strong></div><div><span>Order</span><strong>${esc(orderId || "-")}</strong></div><div><span>Service</span><strong>${esc(order.orderType || "-")}</strong></div><div><span>Total</span><strong>${esc(money(order.amountCents))}</strong></div><div><span>Status</span><strong>${esc(order.paymentStatus || order.status || "pending")}</strong></div><div><span>Fulfillment</span><strong>${esc(order.fulfillmentStatus || order.shippingStatus || "pending")}</strong></div></div>`;
  }

  async function confirmPaymentIfNeeded(order = {}) {
    if (cancelled || !orderId || confirmAttempted) return order;
    if (order.paymentStatus === "paid" && order.stripeFulfillmentComplete === true) return order;
    const stripeSessionId = sessionId || order.stripeCheckoutSessionId || "";
    if (!stripeSessionId) return order;
    confirmAttempted = true;
    try {
      if (window.FLOQRPayments?.confirmCheckoutSession) {
        const result = await window.FLOQRPayments.confirmCheckoutSession({
          orderId,
          sessionId: stripeSessionId,
          status: msg => { byId("paymentReturnStatus").textContent = msg; }
        });
        if (result?.ok) {
          const snap = await db.collection("serviceOrders").doc(orderId).get();
          return snap.exists ? snap.data() : order;
        }
      } else {
        const fn = firebase.app().functions("us-central1").httpsCallable("confirmFloqrCheckoutSession");
        const res = await fn({orderId, sessionId: stripeSessionId});
        if (res?.data?.ok) {
          const snap = await db.collection("serviceOrders").doc(orderId).get();
          return snap.exists ? snap.data() : order;
        }
      }
    } catch (error) {
      if (window.FLOQRLog?.write) {
        window.FLOQRLog.write({
          level: "warn",
          category: "checkout",
          action: "confirm_checkout_failed",
          message: error?.message || "Payment confirm failed.",
          details: {orderId, sessionId: stripeSessionId},
          source: "payment-return"
        });
      }
    }
    return order;
  }

  async function clearCancelledCheckout() {
    if (!cancelled || !orderId || cancelAttempted) return;
    cancelAttempted = true;
    try {
      if (window.FLOQRPayments?.cancelCheckoutOrder) {
        await window.FLOQRPayments.cancelCheckoutOrder({ orderId, reason: "stripe-cancel-return" });
      }
    } catch (_) {}
  }

  auth.onAuthStateChanged(user => {
    if (!user) {
      byId("paymentReturnTitle").textContent = "Sign in to view payment";
      auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(() => {});
      return;
    }
    if (!orderId) return render({ status: "missing order" });
    clearCancelledCheckout();
    db.collection("serviceOrders").doc(orderId).onSnapshot(
      async snap => {
        let order = snap.exists ? snap.data() : {status: "not found"};
        order = await confirmPaymentIfNeeded(order);
        render(order);
      },
      error => { byId("paymentReturnStatus").textContent = error.message; }
    );
  });
})();
