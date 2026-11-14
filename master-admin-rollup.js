/**
 * Master Admin rollup client — paint summary strips from masterAdminRollups/current.
 * Heavy panel mounts stay for detail; strips avoid 27×750 reads on every open.
 */
(function (global) {
  "use strict";

  const DOC_PATH = "masterAdminRollups/current";
  let db = null;
  let auth = null;
  let cached = null;
  let loading = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtNum(value) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return Number(value).toLocaleString();
  }

  function money(cents) {
    if (cents == null || Number.isNaN(Number(cents))) return "—";
    return `$${(Number(cents) / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  }

  function fmtWhen(ms) {
    if (!ms) return "—";
    try {
      return new Date(Number(ms)).toLocaleString();
    } catch (_) {
      return "—";
    }
  }

  function metricGrid(rows) {
    return `<div class="metric-grid floqr-rollup-strip">${rows.map(([label, value]) =>
      `<div class="metric-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`
    ).join("")}</div>
    <p class="sub small floqr-rollup-meta">Rollup ${esc(fmtWhen(cached?.updatedAtMs))} · source ${esc(cached?.source || "—")} · Refresh for live detail.</p>`;
  }

  function paintDiagnostics() {
    const el = byId("diagnosticsSummary");
    if (!el || !cached) return;
    const d = cached.diagnostics || {};
    const counts = d.collectionCounts || {};
    el.innerHTML = metricGrid([
      ["Collections tracked", fmtNum(d.collectionsTracked)],
      ["Docs counted", fmtNum(d.docsCounted)],
      ["clubLocations", fmtNum(counts.clubLocations)],
      ["aiDiscoveryQueue", fmtNum(counts.aiDiscoveryQueue)],
      ["templates", fmtNum(counts.templates)],
      ["users", fmtNum(counts.users)]
    ]);
  }

  function paintAiCrawl() {
    const a = cached?.aiCrawl || {};
    const html = metricGrid([
      ["Queue total", fmtNum(a.queueTotal)],
      ["Pending review", fmtNum(a.pendingReview)],
      ["Needs research", fmtNum(a.needsResearch)],
      ["Approved", fmtNum(a.approved)],
      ["Schedule on", a.scheduleEnabled === true ? "Yes" : a.scheduleEnabled === false ? "No" : "—"],
      ["Last crawl", a.lastRunId ? `${a.lastRunStatus || "run"} · ${fmtWhen(a.lastRunAtMs)}` : "—"]
    ]);
    /* Prefer #aiCrawlingSummary so #aiDiscoverySummary can keep the how-to copy. */
    const primary = byId("aiCrawlingSummary") || byId("aiDiscoverySummary");
    if (primary) primary.innerHTML = html;
  }

  function paintDuplicates() {
    const el = byId("duplicateRecordSummary");
    if (!el || !cached) return;
    const d = cached.duplicates || {};
    const top = Array.isArray(d.topClusters) ? d.topClusters.slice(0, 3) : [];
    const topLine = top.length
      ? `<ul class="small">${top.map((c) => `<li>${esc(c.key)} · ${esc(fmtNum(c.count))} clubs</li>`).join("")}</ul>`
      : "";
    el.innerHTML = metricGrid([
      ["Clubs scanned", fmtNum(d.clubsScanned)],
      ["Duplicate groups", fmtNum(d.clusterCount)]
    ]) + topLine;
  }

  function paintCommerce() {
    if (!cached) return;
    const c = cached.commerce || {};
    const set = (id, text) => {
      const el = byId(id);
      if (el) el.textContent = text;
    };
    set("serviceOrderCount", fmtNum(c.ordersPaid != null ? c.ordersPaid : c.ordersTotal));
    set("serviceGrossRevenue", money(c.grossRevenueCents));
    set("serviceFloqrShare", money(c.floqrShareCents));
    const strip = byId("servicesCommerceRollup");
    if (strip) {
      strip.innerHTML = metricGrid([
        ["Orders (all)", fmtNum(c.ordersTotal)],
        ["Paid orders", fmtNum(c.ordersPaid)],
        ["Campaigns", fmtNum(c.campaignsTotal)],
        ["Pickups", fmtNum(c.pickupsTotal)]
      ]);
    }
  }

  function paintTemplates() {
    const el = byId("templateManagementRollup");
    if (!el || !cached) return;
    const t = cached.templates || {};
    el.innerHTML = metricGrid([
      ["Templates", fmtNum(t.total)],
      ["Active", fmtNum(t.active)]
    ]);
  }

  function paintRecommendations() {
    if (!cached) return;
    const r = cached.recommendations || {};
    const set = (id, text) => {
      const el = byId(id);
      if (el) el.textContent = text;
    };
    set("recommendationPendingCount", fmtNum(r.pending));
    set("recommendationApprovedCount", fmtNum(r.approved));
  }

  function paintAll() {
    if (!cached) return;
    paintDiagnostics();
    paintAiCrawl();
    paintDuplicates();
    paintCommerce();
    paintTemplates();
    paintRecommendations();
  }

  async function load(options = {}) {
    if (!db) return null;
    if (loading) return loading;
    loading = (async () => {
      try {
        const snap = await db.doc(DOC_PATH).get();
        cached = snap.exists ? (snap.data() || null) : null;
        if (cached) paintAll();
        else if (options.showEmpty) {
          const msg = `<p class="status">No rollup yet — scheduled every 5 minutes, or press Refresh rollup.</p>`;
          ["diagnosticsSummary", "aiCrawlingSummary", "duplicateRecordSummary", "servicesCommerceRollup", "templateManagementRollup"]
            .forEach((id) => {
              const el = byId(id);
              if (el && !el.innerHTML.trim()) el.innerHTML = msg;
            });
        }
        return cached;
      } catch (err) {
        console.warn("masterAdminRollup load", err);
        return null;
      } finally {
        loading = null;
      }
    })();
    return loading;
  }

  async function refreshViaCallable() {
    const user = auth?.currentUser;
    if (!user) throw new Error("Sign in required");
    const callable = firebase.app().functions("us-central1").httpsCallable("refreshMasterAdminRollup");
    const result = await callable({});
    cached = result?.data?.rollup || null;
    if (cached) paintAll();
    return cached;
  }

  let bound = false;
  function bind(options = {}) {
    db = options.db || db;
    auth = options.auth || auth;
    if (bound) return;
    bound = true;
    byId("refreshMasterAdminRollupBtn")?.addEventListener("click", async () => {
      const status = byId("diagnosticsStatus") || byId("aiDiscoveryStatus");
      if (status) status.textContent = "Refreshing Master Admin rollup…";
      try {
        await refreshViaCallable();
        if (status) status.textContent = `Rollup refreshed · ${fmtWhen(cached?.updatedAtMs)}`;
      } catch (err) {
        if (status) status.textContent = `Rollup refresh failed: ${err?.message || err}`;
      }
    });
  }

  function getCached() {
    return cached;
  }

  global.FLOQRMasterAdminRollup = {
    bind,
    load,
    refreshViaCallable,
    paintAll,
    paintForPanel(panelId) {
      if (!cached) return load({showEmpty: true}).then(() => {
        if (panelId === "diagnostics" || panelId === "diagnosticsManualTests") paintDiagnostics();
        if (panelId === "aiCrawling") paintAiCrawl();
        if (panelId === "duplicateRecords") paintDuplicates();
        if (panelId === "servicesCommerce") paintCommerce();
        if (panelId === "templateManagement") paintTemplates();
        if (panelId === "recommendationModeration") paintRecommendations();
      });
      if (panelId === "diagnostics" || panelId === "diagnosticsManualTests") paintDiagnostics();
      if (panelId === "aiCrawling") paintAiCrawl();
      if (panelId === "duplicateRecords") paintDuplicates();
      if (panelId === "servicesCommerce") paintCommerce();
      if (panelId === "templateManagement") paintTemplates();
      if (panelId === "recommendationModeration") paintRecommendations();
      return Promise.resolve(cached);
    },
    getCached,
    DOC_PATH
  };
})(window);
