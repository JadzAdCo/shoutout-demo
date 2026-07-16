(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const qs = name => new URL(location.href).searchParams.get(name) || "";
  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const orderId = qs("order");
  const cancelled = qs("cancelled") === "1";
  let cancelAttempted = false;

  function render(order = {}) {
    const paid = order.paymentStatus === "paid";
    byId("paymentReturnTitle").textContent = paid ? "Payment confirmed" : cancelled || order.status === "checkout-cancelled" ? "Payment cancelled" : "Payment processing";
    byId("paymentReturnStatus").textContent = paid
      ? "Your order is recorded and the next service step is underway."
      : cancelled || order.status === "checkout-cancelled"
        ? "Nothing was submitted. The unpaid checkout was cleared so you can try again."
        : "Stripe confirmation can take a few seconds. This page updates automatically.";
    byId("paymentReturnDetails").innerHTML = `<div class="report-table"><div><span>Invoice</span><strong>${esc(order.invoiceNumber || "Pending")}</strong></div><div><span>Order</span><strong>${esc(orderId || "-")}</strong></div><div><span>Service</span><strong>${esc(order.orderType || "-")}</strong></div><div><span>Total</span><strong>$${(Number(order.amountCents || 0) / 100).toFixed(2)}</strong></div><div><span>Status</span><strong>${esc(order.paymentStatus || order.status || "pending")}</strong></div><div><span>Fulfillment</span><strong>${esc(order.fulfillmentStatus || order.shippingStatus || "pending")}</strong></div></div>`;
  }

  async function clearCancelledCheckout() {
    if (!cancelled || !orderId || cancelAttempted) return;
    cancelAttempted = true;
    try {
      if (window.FLOQRPayments?.cancelCheckoutOrder) {
        await window.FLOQRPayments.cancelCheckoutOrder({ orderId, reason: "stripe-cancel-return" });
      }
      if (window.FLOQRLog) {
        window.FLOQRLog.write({
          level: "info",
          category: "checkout",
          action: "payment_return_cancelled",
          message: `Patron returned from cancelled Stripe checkout ${orderId}`,
          details: { orderId }
        });
      }
    } catch (error) {
      if (window.FLOQRLog) window.FLOQRLog.fromError(error, { category: "checkout", action: "payment_return_cancel_failed", details: { orderId } });
    }
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
      snap => render(snap.exists ? snap.data() : { status: "not found" }),
      error => { byId("paymentReturnStatus").textContent = error.message; }
    );
  });
})();
