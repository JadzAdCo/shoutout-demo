/* Master Admin → Diagnostics → AI Crawling — categorized appLogs (category aiCrawl). */
(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  const FAMILIES = {
    run: "Runs",
    discover: "Discoveries",
    duplicate: "Duplicates",
    autoPublish: "Auto-publish",
    csv: "CSV",
    pastEvent: "Past events",
    publish: "Publish"
  };

  let logs = [];
  let bound = false;

  function setStatus(message) {
    const el = byId("aiCrawlDiagStatus");
    if (el) el.textContent = message || "";
  }

  function ts(value) {
    if (!value) return "—";
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    if (typeof value === "number") return new Date(value).toLocaleString();
    return String(value);
  }

  function familyOf(row) {
    if (row.family && FAMILIES[row.family]) return row.family;
    const action = String(row.action || "");
    if (/^run_/.test(action)) return "run";
    if (/duplicate/.test(action)) return "duplicate";
    if (/auto_publish/.test(action)) return "autoPublish";
    if (/^csv_/.test(action)) return "csv";
    if (/past_event/.test(action)) return "pastEvent";
    if (/^publish/.test(action)) return "publish";
    if (/discover|queue_write/.test(action)) return "discover";
    return "run";
  }

  function isAiCrawlRow(row) {
    const cat = String(row.category || "");
    if (cat === "aiCrawl" || cat === "ai-crawl" || cat === "discovery") return true;
    const action = String(row.action || "");
    return /^(run_|auto_publish|csv_|past_event|duplicate_flag|publish)/.test(action);
  }

  function filteredLogs() {
    const family = byId("aiCrawlDiagFamilyFilter")?.value || "";
    const level = byId("aiCrawlDiagLevelFilter")?.value || "";
    const query = (byId("aiCrawlDiagSearch")?.value || "").trim().toLowerCase();
    return logs.filter((row) => {
      if (family && familyOf(row) !== family) return false;
      if (level && row.level !== level) return false;
      if (!query) return true;
      const hay = [
        row.message, row.action, row.family, row.email, row.runId, row.correlationId,
        JSON.stringify(row.details || {})
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  function render() {
    const rows = filteredLogs();
    const warnN = rows.filter((r) => r.level === "warn" || r.level === "error").length;
    const published = rows.filter((r) => r.action === "auto_publish" || r.action === "publish").length;
    if (byId("aiCrawlDiagCount")) byId("aiCrawlDiagCount").textContent = String(rows.length);
    if (byId("aiCrawlDiagWarnCount")) byId("aiCrawlDiagWarnCount").textContent = String(warnN);
    if (byId("aiCrawlDiagPublishCount")) byId("aiCrawlDiagPublishCount").textContent = String(published);
    const list = byId("aiCrawlDiagList");
    if (!list) return;
    list.innerHTML = rows.length ? rows.map((row) => {
      const details = row.details
        ? `<details class="audit-change"><summary>Details</summary><pre class="log-details">${esc(JSON.stringify(row.details, null, 2))}</pre></details>`
        : "";
      const family = FAMILIES[familyOf(row)] || familyOf(row);
      return `<article class="queue-item log-row level-${esc(row.level || "info")}">
        <div class="message-envelope-head">
          <strong>${esc((row.level || "info").toUpperCase())} · ${esc(family)} / ${esc(row.action || "")}</strong>
          <span>${esc(ts(row.createdAt || row.createdAtMs))}</span>
        </div>
        <p>${esc(row.message || "")}</p>
        <small>${esc(row.email || row.uid || "system")} · corr ${esc(row.correlationId || row.runId || "—")} · ${esc(row.source || "functions")}</small>
        ${details}
      </article>`;
    }).join("") : `<p class="sub">No AI Crawling logs match the filters. Run Instant Crawl Now, import a CSV, or approve a card — rows land here by family (Runs, Duplicates, Auto-publish, CSV, Past events, Publish).</p>`;
  }

  async function loadLogs() {
    const db = firebase.firestore();
    setStatus("Loading AI Crawling diagnostic logs…");
    try {
      let rows = [];
      try {
        const snap = await db.collection("appLogs")
          .where("category", "==", "aiCrawl")
          .orderBy("createdAt", "desc")
          .limit(250)
          .get();
        rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      } catch (_) {
        const snap = await db.collection("appLogs").orderBy("createdAt", "desc").limit(400).get();
        rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(isAiCrawlRow);
      }
      logs = rows.filter(isAiCrawlRow);
      render();
      setStatus(`Loaded ${logs.length} AI Crawling log row(s).`);
    } catch (error) {
      setStatus(error?.message || "Could not load AI Crawling logs.");
      window.FLOQRLog?.fromError?.(error, { category: "admin", action: "load_aicrawl_logs" });
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    byId("aiCrawlDiagRefreshBtn")?.addEventListener("click", () => loadLogs());
    byId("aiCrawlDiagFamilyFilter")?.addEventListener("change", render);
    byId("aiCrawlDiagLevelFilter")?.addEventListener("change", render);
    byId("aiCrawlDiagSearch")?.addEventListener("input", render);
  }

  window.FLOQRAiCrawlDiagnostics = {
    mount() {
      bind();
      loadLogs();
    },
    refresh: loadLogs
  };
})();
