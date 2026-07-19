/* FLOQR Master Admin Logging + unpaid / test Stripe payment cleanup v29.09.5 */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);

  if (!window.firebase || !byId("appLogging")) return;

  const auth = firebase.auth();
  const db = firebase.firestore();
  let logs = [];
  let unpaidOrders = [];

  function setStatus(message) {
    if (byId("appLoggingStatus")) byId("appLoggingStatus").textContent = message;
  }

  function ts(value) {
    if (!value) return "-";
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    return String(value);
  }

  function filteredLogs() {
    const level = byId("appLogLevelFilter")?.value || "";
    const category = (byId("appLogCategoryFilter")?.value || "").trim().toLowerCase();
    const query = (byId("appLogSearch")?.value || "").trim().toLowerCase();
    return logs.filter(row => {
      if (level && row.level !== level) return false;
      if (category && !String(row.category || "").toLowerCase().includes(category)) return false;
      if (!query) return true;
      const hay = [row.message, row.action, row.category, row.email, row.uid, row.correlationId, JSON.stringify(row.details || {})].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  function renderLogs() {
    const rows = filteredLogs();
    byId("appLogCount").textContent = String(rows.length);
    byId("appLogErrorCount").textContent = String(rows.filter(row => row.level === "error").length);
    const list = byId("appLogList");
    if (!list) return;
    list.innerHTML = rows.length ? rows.map(row => {
      const details = row.details ? `<pre class="log-details">${esc(JSON.stringify(row.details, null, 2))}</pre>` : "";
      return `<article class="queue-item log-row level-${esc(row.level || "info")}">
        <div class="message-envelope-head"><strong>${esc((row.level || "info").toUpperCase())} · ${esc(row.category || "general")}${row.action ? ` / ${esc(row.action)}` : ""}</strong><span>${esc(ts(row.createdAt))}</span></div>
        <p>${esc(row.message || "")}</p>
        <small>${esc(row.email || row.uid || "anonymous")} · corr ${esc(row.correlationId || "-")} · ${esc(row.source || "client")}</small>
        ${details}
      </article>`;
    }).join("") : `<p class="sub">No log entries match the current filters.</p>`;
  }

  function renderUnpaid() {
    const box = byId("unpaidCheckoutList");
    if (!box) return;
    byId("unpaidCheckoutCount").textContent = String(unpaidOrders.length);
    box.innerHTML = unpaidOrders.length ? unpaidOrders.map(order => {
      const testBadge = order.isTestPayment || order.environment === "test" || order.testPaymentMarker
        ? ` · <strong>TEST</strong>`
        : "";
      return `<article class="queue-item">
      <div class="message-envelope-head"><strong>${esc(order.itemName || order.orderType || "Order")}</strong><span>${esc(order.status || order.paymentStatus || "unpaid")}${testBadge}</span></div>
      <p>${esc(order.invoiceNumber || order.id)} · ${money(order.amountCents)}</p>
      <small>${esc(order.ownerEmail || order.ownerUid || "-")} · club ${esc(order.clubLocationId || "-")} · created ${esc(ts(order.createdAt))}</small>
      <button type="button" class="ghost" data-cancel-order="${esc(order.id)}">Cancel / clear this checkout</button>
    </article>`;
    }).join("") : `<p class="sub">No unpaid checkout sessions found.</p>`;
    box.querySelectorAll("[data-cancel-order]").forEach(button => {
      button.addEventListener("click", () => cancelOne(button.dataset.cancelOrder));
    });
  }

  async function loadLogs() {
    setStatus("Loading application logs…");
    try {
      const snap = await db.collection("appLogs").orderBy("createdAt", "desc").limit(250).get();
      logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderLogs();
      setStatus(`Loaded ${logs.length} log entries.`);
    } catch (error) {
      setStatus(error.message || "Could not load logs.");
      if (window.FLOQRLog) window.FLOQRLog.fromError(error, { category: "admin", action: "load_logs" });
    }
  }

  async function loadUnpaid() {
    try {
      const snap = await db.collection("serviceOrders").where("paymentStatus", "==", "unpaid").limit(200).get();
      unpaidOrders = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(order => ["checkout-created", "checkout-failed", "checkout-expired", "payment-failed"].includes(String(order.status || "")));
      unpaidOrders.sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));
      renderUnpaid();
    } catch (error) {
      if (byId("unpaidCheckoutList")) byId("unpaidCheckoutList").innerHTML = `<p class="sub">${esc(error.message)}</p>`;
    }
  }

  async function cancelOne(orderId) {
    if (!orderId || !window.FLOQRPayments?.cancelCheckoutOrder) return;
    setStatus(`Clearing checkout ${orderId}…`);
    try {
      await window.FLOQRPayments.cancelCheckoutOrder({ orderId });
      setStatus(`Cleared checkout ${orderId}.`);
      await loadUnpaid();
      await loadLogs();
    } catch (error) {
      setStatus(error.message || "Clear failed.");
    }
  }

  async function clearAllUnpaid() {
    if (!window.FLOQRPayments?.clearUnpaidCheckouts) return;
    if (!confirm("Cancel all unpaid FLOQR checkout sessions that are still open or failed?")) return;
    setStatus("Clearing unpaid checkout sessions…");
    try {
      const result = await window.FLOQRPayments.clearUnpaidCheckouts({});
      setStatus(`Cleared ${result.cleared || 0} unpaid checkout(s). Skipped ${result.skipped || 0}.`);
      await loadUnpaid();
      await loadLogs();
    } catch (error) {
      setStatus(error.message || "Bulk clear failed.");
    }
  }

  async function purgeTestPayments() {
    if (!window.FLOQRPayments?.purgeTestPayments) return;
    if (!confirm("Permanently delete all Stripe TEST-marked payment ledger rows, related paid shoutouts, and test service orders? This cannot be undone.")) return;
    setStatus("Deleting Stripe test payments…");
    try {
      const result = await window.FLOQRPayments.purgeTestPayments({});
      const deleted = result.deleted || {};
      setStatus(`Deleted test payments — ledger ${deleted.paymentLedger || 0}, orders ${deleted.serviceOrders || 0}, shoutouts ${deleted.shoutouts || 0}.`);
      await loadUnpaid();
      await loadLogs();
    } catch (error) {
      setStatus(error.message || "Test payment purge failed.");
    }
  }

  async function checkZebbiesConnect() {
    const box = byId("zebbiesConnectReadiness");
    if (box) {
      box.innerHTML = `<p class="sub"><strong>Paid ShoutOuts do not require club Stripe Connect.</strong> Patron football / priced ShoutOuts are charged to FloqR’s Stripe account. This club earns a tracked 20% share under Account Reconciliation. Club Stripe onboarding is only for club subscription or club-billed Commerce products.</p>`;
    }
    if (!window.FLOQRPayments?.getClubCheckoutReadiness) {
      setStatus("Optional club-billed Connect check unavailable.");
      return;
    }
    setStatus("Checking optional Zebbies club-billed Stripe status…");
    try {
      const result = await window.FLOQRPayments.getClubCheckoutReadiness({ clubLocationId: "zebbies-garden-washington-dc" });
      if (box) {
        box.innerHTML += result.ready
          ? `<p class="sub">Optional club Stripe Connect for Zebbies is ready (${esc(result.capabilityStatus || "active")}) for club-billed products only.</p>`
          : `<p class="sub">Optional club Stripe Connect for Zebbies is not configured. That does <strong>not</strong> block FloqR-priced ShoutOuts such as the $30 football intro.</p>`;
      }
      setStatus(result.ready ? "Optional club Connect ready (not required for ShoutOuts)." : "Club Connect not configured — ShoutOuts still use FloqR Stripe.");
      if (window.FLOQRLog) {
        window.FLOQRLog.write({
          level: "info",
          category: "stripe",
          action: "zebbies_connect_check",
          message: "Club Connect is optional for ShoutOuts; FloqR platform charges apply",
          details: { ...result, shoutoutPaymentModel: "floqr-platform" }
        });
      }
    } catch (error) {
      setStatus(error.message || "Optional Connect check failed.");
    }
  }

  function bind() {
    byId("appLogRefreshBtn")?.addEventListener("click", () => { loadLogs(); loadUnpaid(); });
    byId("appLogLevelFilter")?.addEventListener("change", renderLogs);
    byId("appLogCategoryFilter")?.addEventListener("input", renderLogs);
    byId("appLogSearch")?.addEventListener("input", renderLogs);
    byId("clearUnpaidCheckoutsBtn")?.addEventListener("click", clearAllUnpaid);
    byId("purgeTestPaymentsLoggingBtn")?.addEventListener("click", purgeTestPayments);
    byId("checkZebbiesConnectBtn")?.addEventListener("click", checkZebbiesConnect);
  }

  window.FLOQRAppLogging = {
    mount() {
      bind();
      loadLogs();
      loadUnpaid();
      checkZebbiesConnect();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(user => {
      if (user && byId("appLogging")?.classList.contains("active")) window.FLOQRAppLogging.mount();
    });
  });
})();
