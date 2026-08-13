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
  let confirmInFlight = false;
  let confirmAttempts = 0;
  let closeArmed = false;
  let subscriptionPersisted = false;

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

  function notifyOpenerMessagingSubscribed(order = {}) {
    const type = String(order.orderType || "");
    const channel = type.startsWith("whatsapp") ? "whatsapp" : type.startsWith("sms") ? "sms" : "";
    if (!channel) return;
    const clubLocationId = order.clubLocationId || order.payload?.clubLocationId || "";
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: "floqr-notification-subscribed",
          orderId,
          clubLocationId,
          channel
        }, "*");
      }
    } catch (_) {}
  }

  async function persistMessagingSubscription(order = {}) {
    if (order.paymentStatus !== "paid") return;
    const type = String(order.orderType || "");
    const clubId = String(order.clubLocationId || order.payload?.clubLocationId || "").trim();
    if (!clubId) return;
    const patch = {updatedAt: firebase.firestore.FieldValue.serverTimestamp()};
    if (type === "smsNotifications" || type === "smsMessageBundle") {
      patch.smsSubscribed = true;
      patch.smsEnabled = true;
      patch.smsRequested = true;
      patch.smsServiceOrderId = orderId;
      if (order.paidAt) patch.smsPaidAt = order.paidAt;
      else patch.smsPaidAt = firebase.firestore.FieldValue.serverTimestamp();
    } else if (type === "whatsappNotifications" || type === "whatsappMessageBundle") {
      patch.whatsappSubscribed = true;
      patch.whatsappEnabled = true;
      patch.whatsappRequested = true;
      patch.whatsappServiceOrderId = orderId;
      if (order.paidAt) patch.whatsappPaidAt = order.paidAt;
      else patch.whatsappPaidAt = firebase.firestore.FieldValue.serverTimestamp();
    } else return;
    await db.collection("clubNotificationSettings").doc(clubId).set(patch, {merge: true});
    notifyOpenerMessagingSubscribed(order);
  }

  function notifyOpenerPaid(order = {}) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: "floqr-suprstar-paid",
          orderId,
          requestId: order.payload?.requestId || order.requestId || "",
          paymentStatus: order.paymentStatus || "",
          requestStatus: order.requestStatus || ""
        }, "*");
      }
    } catch (_) {}
  }

  function armPopupClose() {
    if (!isPopup || closeArmed) return;
    closeArmed = true;
    setTimeout(() => { try { window.close(); } catch (_) {} }, 2500);
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
          ? "Payment received and sent to Club Admin for approval. Return to your private preview tab."
          : isSuprstar
            ? "Your live-stream slot(s) are credited."
            : "Your order is recorded and the next service step is underway.")
      : cancelled || order.status === "checkout-cancelled"
        ? "Nothing was submitted. The unpaid checkout was cleared so you can try again."
        : "Confirming payment with Stripe… this can take a few seconds.";

    if (paid && order.orderType === "suprstarRequest") {
      notifyOpenerPaid(order);
      let storedToken = "";
      try { storedToken = sessionStorage.getItem("floqr_suprstar_token") || ""; } catch (_) {}
      const requestId = order.payload?.requestId || order.requestId || "";
      const previewToken = storedToken || requestId;
      const previewUrl = previewToken ? `./suprstar-preview.html?t=${encodeURIComponent(previewToken)}&v=29.09.72` : "";
      const backLink = isPopup
        ? `<p class="sub small">This window will close. Keep your preview tab open for Club Admin approval.</p>`
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
      armPopupClose();
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
    if (cancelled || !orderId || confirmInFlight) return order;
    const needsConfirm = !(order.paymentStatus === "paid" && order.stripeFulfillmentComplete === true)
      || order.orderType === "suprstarRequest";
    if (!needsConfirm) return order;
    const stripeSessionId = sessionId || order.stripeCheckoutSessionId || "";
    if (!stripeSessionId && order.paymentStatus !== "paid") return order;
    if (confirmAttempts >= 5) return order;
    confirmInFlight = true;
    confirmAttempts += 1;
    try {
      const confirm = window.FLOQRPayments?.confirmCheckoutSession
        ? (args) => window.FLOQRPayments.confirmCheckoutSession(args)
        : async (args) => {
            const fn = firebase.app().functions("us-central1").httpsCallable("confirmFloqrCheckoutSession");
            const res = await fn(args);
            return res?.data || {};
          };
      const result = await confirm({
        orderId,
        sessionId: stripeSessionId,
        status: msg => { byId("paymentReturnStatus").textContent = msg; }
      });
      if (result?.ok) {
        const snap = await db.collection("serviceOrders").doc(orderId).get();
        const next = snap.exists ? snap.data() : order;
        next.requestStatus = result.requestStatus || "";
        return next;
      }
    } catch (error) {
      if (window.FLOQRLog?.write) {
        window.FLOQRLog.write({
          level: "warn",
          category: "checkout",
          action: "confirm_checkout_failed",
          message: error?.message || "Payment confirm failed.",
          details: {orderId, sessionId: stripeSessionId, attempt: confirmAttempts},
          source: "payment-return"
        });
      }
    } finally {
      confirmInFlight = false;
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
        if (order.paymentStatus === "paid" && !subscriptionPersisted) {
          subscriptionPersisted = true;
          persistMessagingSubscription(order).catch(() => { subscriptionPersisted = false; });
        }
        render(order);
      },
      error => { byId("paymentReturnStatus").textContent = error.message; }
    );
  });
})();
