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
  let geminiLogs = [];
  let geminiFailuresOnly = false;
  let geminiCriticalUnsub = null;
  let bound = false;

  const GEMINI_CRITICAL_SOURCE = "geminiApiAccess";

  function setStatus(message) {
    if (byId("appLoggingStatus")) byId("appLoggingStatus").textContent = message;
  }

  function publishGeminiCriticalBlink(failureRows = []) {
    const blink = window.FLOQRCriticalLogBlink;
    if (!blink) return;
    const summary = blink.summarizeCriticalRows(failureRows, {treatFailureAsCritical: true});
    if (summary.count > 0) {
      blink.set(blink.SOURCE_IDS.geminiApiAccess || GEMINI_CRITICAL_SOURCE, {
        tabId: "appLoggingTab",
        tabSelector: '[data-panel="appLogging"]',
        parentGroup: "diagnostics",
        label: "Application Logging",
        count: summary.count,
        newestMs: summary.newestMs
      });
    } else {
      blink.clear(blink.SOURCE_IDS.geminiApiAccess || GEMINI_CRITICAL_SOURCE);
    }
  }

  function acknowledgeGeminiCriticalFailures() {
    const blink = window.FLOQRCriticalLogBlink;
    if (!blink) return;
    const fails = geminiLogs.filter(row =>
      row.severity === "critical" || row.critical === true
      || row.outcome === "failure" || row.ok === false || row.level === "error"
    );
    const newest = fails.reduce((max, row) => Math.max(max, Number(row.createdAtMs || 0)), Date.now());
    blink.ack(blink.SOURCE_IDS.geminiApiAccess || GEMINI_CRITICAL_SOURCE, newest);
    setGeminiStatus(`Acknowledged ${fails.length || "0"} critical Gemini failure(s) — tab flash cleared until a newer failure.`);
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

  function setGeminiStatus(message) {
    if (byId("geminiAccessLogStatus")) byId("geminiAccessLogStatus").textContent = message || "";
  }

  function renderGeminiLogs() {
    const list = byId("geminiAccessLogList");
    if (!list) return;
    const rows = geminiFailuresOnly
      ? geminiLogs.filter(row => row.outcome === "failure" || row.ok === false || row.level === "error")
      : geminiLogs;
    list.innerHTML = rows.length ? rows.map(row => {
      const outcome = row.outcome || (row.ok === false ? "failure" : "success");
      const reason = row.failureReason
        ? `<p><strong>Failure reason:</strong> ${esc(row.failureReason)}</p>`
        : "";
      const details = row.details ? `<pre class="log-details">${esc(JSON.stringify(row.details, null, 2))}</pre>` : "";
      return `<article class="queue-item log-row level-${esc(row.level || (outcome === "failure" ? "error" : "info"))}">
        <div class="message-envelope-head"><strong>${esc(String(outcome).toUpperCase())} · ${esc(row.operation || row.enhancementType || "gemini")}${row.model ? ` · ${esc(row.model)}` : ""}</strong><span>${esc(ts(row.createdAt || row.createdAtIso))}</span></div>
        <p>${esc(row.message || "")}</p>
        ${reason}
        <small>${esc(row.email || row.uid || "system")} · path ${esc(row.mediaStoragePath || "-")}</small>
        ${details}
      </article>`;
    }).join("") : `<p class="sub">No Gemini API access rows${geminiFailuresOnly ? " (failures only)" : ""}. Upload a Baller's Alert face photo to create the first success/failure entry.</p>`;
  }

  async function loadGeminiAccessLogs() {
    setGeminiStatus("Loading Gemini API access logs…");
    try {
      const snap = await db.collection("geminiApiAccessLogs").orderBy("createdAtMs", "desc").limit(150).get();
      geminiLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderGeminiLogs();
      const failRows = geminiLogs.filter(row =>
        row.severity === "critical" || row.critical === true
        || row.outcome === "failure" || row.ok === false
      );
      publishGeminiCriticalBlink(failRows);
      const unacked = window.FLOQRCriticalLogBlink?.unackedCount?.(GEMINI_CRITICAL_SOURCE) || 0;
      setGeminiStatus(`Loaded ${geminiLogs.length} Gemini access row(s); ${failRows.length} critical failure(s)${unacked ? ` · ${unacked} flashing` : ""}. Retention 30 days.`);
    } catch (error) {
      setGeminiStatus(error.message || "Could not load Gemini access logs.");
      if (window.FLOQRLog) window.FLOQRLog.fromError(error, { category: "admin", action: "load_gemini_access_logs" });
    }
  }

  /** Live watch so Diagnostics → Application Logging flashes before the panel is opened. */
  function startGeminiCriticalWatch() {
    if (geminiCriticalUnsub) {
      try { geminiCriticalUnsub(); } catch (_) {}
      geminiCriticalUnsub = null;
    }
    const user = auth.currentUser;
    if (!user) {
      publishGeminiCriticalBlink([]);
      return;
    }
    try {
      geminiCriticalUnsub = db.collection("geminiApiAccessLogs")
        .where("outcome", "==", "failure")
        .orderBy("createdAtMs", "desc")
        .limit(40)
        .onSnapshot((snap) => {
          const rows = snap.docs.map(doc => ({id: doc.id, ...doc.data(), severity: "critical", critical: true}));
          // Keep the full list in sync when the card is mounted; always drive the tab blink.
          if (byId("appLogging")?.classList.contains("active")) {
            // Merge failure rows into geminiLogs without dropping successes from a prior full load.
            const byIdMap = new Map(geminiLogs.map(row => [row.id, row]));
            rows.forEach(row => byIdMap.set(row.id, row));
            geminiLogs = [...byIdMap.values()].sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
            renderGeminiLogs();
          }
          publishGeminiCriticalBlink(rows);
        }, (err) => {
          console.warn("gemini critical watch failed", err?.message || err);
        });
    } catch (err) {
      console.warn("gemini critical watch start failed", err?.message || err);
    }
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
    if (bound) return;
    bound = true;
    byId("appLogRefreshBtn")?.addEventListener("click", () => { loadLogs(); loadUnpaid(); loadGeminiAccessLogs(); });
    byId("appLogLevelFilter")?.addEventListener("change", renderLogs);
    byId("appLogCategoryFilter")?.addEventListener("input", renderLogs);
    byId("appLogSearch")?.addEventListener("input", renderLogs);
    byId("geminiAccessLogRefreshBtn")?.addEventListener("click", loadGeminiAccessLogs);
    byId("geminiAccessLogFailuresOnlyBtn")?.addEventListener("click", () => {
      geminiFailuresOnly = !geminiFailuresOnly;
      const btn = byId("geminiAccessLogFailuresOnlyBtn");
      if (btn) btn.textContent = geminiFailuresOnly ? "Show all" : "Failures only";
      renderGeminiLogs();
    });
    byId("geminiAccessLogAckBtn")?.addEventListener("click", acknowledgeGeminiCriticalFailures);
    byId("clearUnpaidCheckoutsBtn")?.addEventListener("click", clearAllUnpaid);
    byId("purgeTestPaymentsLoggingBtn")?.addEventListener("click", purgeTestPayments);
    byId("checkZebbiesConnectBtn")?.addEventListener("click", checkZebbiesConnect);
  }

  window.FLOQRAppLogging = {
    mount() {
      bind();
      loadLogs();
      loadGeminiAccessLogs();
      loadUnpaid();
      checkZebbiesConnect();
      startGeminiCriticalWatch();
    },
    startCriticalWatch: startGeminiCriticalWatch,
    acknowledgeGeminiCriticalFailures
  };

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    auth.onAuthStateChanged(user => {
      if (user) {
        startGeminiCriticalWatch();
        if (byId("appLogging")?.classList.contains("active")) window.FLOQRAppLogging.mount();
      } else {
        if (geminiCriticalUnsub) {
          try { geminiCriticalUnsub(); } catch (_) {}
          geminiCriticalUnsub = null;
        }
        publishGeminiCriticalBlink([]);
      }
    });
  });
})();
