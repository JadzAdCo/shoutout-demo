/**
 * FLOQR Master Admin — critical log tab blink (standard).
 *
 * Same visual language as Security System Messages: `.admin-subtab.is-blink` +
 * parent `.admin-tab-parent.is-blink` while unreacknowledged critical failures exist.
 *
 * Register every critical log surface here (Gemini API access, security messages,
 * display/Xibo load errors, …). Do not invent one-off blink CSS per panel.
 *
 * Resume: `@critical-log-blink$`
 */
(function (global) {
  "use strict";

  const ACK_PREFIX = "floqr.criticalLogAck.";
  /** @type {Map<string, {tabId?:string, tabSelector?:string, parentGroup?:string, label?:string, count:number, newestMs:number}>} */
  const sources = new Map();

  function byId(id) {
    return document.getElementById(id);
  }

  function readAckMs(id) {
    try {
      const raw = sessionStorage.getItem(ACK_PREFIX + id);
      const n = Number(raw || 0);
      return Number.isFinite(n) ? n : 0;
    } catch (_) {
      return 0;
    }
  }

  function writeAckMs(id, ms) {
    try {
      sessionStorage.setItem(ACK_PREFIX + id, String(Math.max(0, Number(ms) || 0)));
    } catch (_) { /* private mode */ }
  }

  function resolveTab(entry) {
    if (entry.tabId) return byId(entry.tabId);
    if (entry.tabSelector) return document.querySelector(entry.tabSelector);
    return null;
  }

  function parentForGroup(group) {
    if (!group) return null;
    return document.querySelector(`.admin-tab-parent[data-group="${group}"]`);
  }

  function activeCount(entry) {
    const count = Math.max(0, Number(entry.count) || 0);
    if (!count) return 0;
    const newest = Number(entry.newestMs) || 0;
    const ack = readAckMs(entry.id);
    // Blink while there is at least one critical event newer than the last acknowledge.
    if (newest && ack && newest <= ack) return 0;
    return count;
  }

  function apply() {
    const parentActive = new Map(); // group -> boolean
    const tabsTouched = new Set();

    sources.forEach((entry) => {
      const tab = resolveTab(entry);
      const n = activeCount(entry);
      const on = n > 0;
      if (tab) {
        tabsTouched.add(tab);
        tab.classList.toggle("is-blink", on);
        tab.classList.toggle("is-critical-log", true);
        const base = entry.label || tab.textContent?.trim() || entry.id;
        tab.setAttribute("aria-label", on
          ? `${base} — ${n} critical failure${n === 1 ? "" : "s"}`
          : base);
        if (on) tab.dataset.criticalFailCount = String(n);
        else delete tab.dataset.criticalFailCount;
      }
      if (entry.parentGroup) {
        parentActive.set(entry.parentGroup, !!(parentActive.get(entry.parentGroup) || on));
      }
    });

    // Parent groups: blink if any registered critical source under that group is active.
    document.querySelectorAll(".admin-tab-parent[data-group]").forEach((parent) => {
      const group = parent.getAttribute("data-group");
      if (!sources.size) return;
      let known = false;
      sources.forEach((entry) => {
        if (entry.parentGroup === group) known = true;
      });
      if (!known) return;
      parent.classList.toggle("is-blink", !!parentActive.get(group));
    });
  }

  /**
   * @param {string} id stable source id (e.g. geminiApiAccess, securitySystemMessages)
   * @param {object} opts
   */
  function set(id, opts = {}) {
    const key = String(id || "").trim();
    if (!key) return;
    const prev = sources.get(key) || {};
    sources.set(key, {
      id: key,
      tabId: opts.tabId || prev.tabId || "",
      tabSelector: opts.tabSelector || prev.tabSelector || "",
      parentGroup: opts.parentGroup || prev.parentGroup || "",
      label: opts.label || prev.label || key,
      count: Math.max(0, Number(opts.count != null ? opts.count : prev.count) || 0),
      newestMs: Math.max(0, Number(opts.newestMs != null ? opts.newestMs : prev.newestMs) || 0)
    });
    apply();
  }

  function clear(id) {
    const key = String(id || "").trim();
    if (!key || !sources.has(key)) return;
    const entry = sources.get(key);
    sources.set(key, {...entry, count: 0, newestMs: 0});
    apply();
  }

  /** Acknowledge critical failures for this source through `untilMs` (default: now). */
  function ack(id, untilMs = Date.now()) {
    const key = String(id || "").trim();
    if (!key) return;
    writeAckMs(key, untilMs);
    apply();
  }

  function unackedCount(id) {
    const entry = sources.get(String(id || "").trim());
    if (!entry) return 0;
    return activeCount(entry);
  }

  /**
   * Helper: from a list of log rows, count critical failures and newest timestamp.
   * Critical = severity/criticality === "critical" OR outcome failure / level error when opts.treatFailureAsCritical.
   */
  function summarizeCriticalRows(rows = [], opts = {}) {
    const treatFailure = opts.treatFailureAsCritical !== false;
    let count = 0;
    let newestMs = 0;
    (rows || []).forEach((row) => {
      const severity = String(row?.severity || row?.criticality || "").toLowerCase();
      const isFailure = row?.outcome === "failure" || row?.ok === false || row?.level === "error" || row?.allowed === false;
      const critical = severity === "critical" || row?.critical === true || (treatFailure && isFailure);
      if (!critical) return;
      count += 1;
      const ms = Number(row.createdAtMs || row.createdAt?.toMillis?.() || row.createdAt?.seconds * 1000 || 0);
      if (ms > newestMs) newestMs = ms;
    });
    return {count, newestMs};
  }

  const api = {
    set,
    clear,
    ack,
    apply,
    unackedCount,
    summarizeCriticalRows,
    readAckMs,
    /** Known critical log source ids (documentation / registry). */
    SOURCE_IDS: {
      securitySystemMessages: "securitySystemMessages",
      displayLoadErrors: "displayLoadErrors",
      geminiApiAccess: "geminiApiAccess"
    }
  };

  global.FLOQRCriticalLogBlink = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
