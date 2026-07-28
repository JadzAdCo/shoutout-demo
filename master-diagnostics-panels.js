/**
 * Master Admin — Diagnostics nested panels (Display / Xibo Load Errors + blink).
 * Parent tab group mirrors Security; load-error events are diagnostic (not security denies).
 */
(function (global) {
  "use strict";

  const PUBLIC_BASE = "https://jadzadco.github.io/shoutout-demo";
  const SEEN_KEY = "floqrDiagnosticsDisplayErrorsSeenMs";
  let loadErrorsUnsub = null;
  let lastLoadErrorRows = [];
  let bound = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value == null ? "" : String(value);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getSeenMs() {
    try {
      return Number(sessionStorage.getItem(SEEN_KEY) || 0) || 0;
    } catch (_) {
      return 0;
    }
  }

  function setSeenMs(ms) {
    try {
      sessionStorage.setItem(SEEN_KEY, String(Math.max(0, Number(ms) || 0)));
    } catch (_) {}
  }

  function boardLabel(board) {
    const b = String(board || "").toLowerCase();
    if (b === "2" || b === "secondary" || b === "display2" || b === "suprstar") return "Display 2";
    if (b === "1" || b === "primary" || b === "display" || b === "shoutout") return "Display 1";
    return board ? `Board ${board}` : "Unknown board";
  }

  function buildFallbackUrl() {
    const venue = String(byId("displayErrorVenueId")?.value || "").trim().toLowerCase();
    const board = String(byId("displayErrorBoard")?.value || "2").trim() || "2";
    const url = new URL(`${PUBLIC_BASE}/display-error.html`);
    if (venue) url.searchParams.set("location", venue);
    url.searchParams.set("board", board);
    url.searchParams.set("reason", "xibo_page_load_error");
    return url.toString();
  }

  function refreshFallbackUrlField() {
    const input = byId("displayErrorFallbackUrl");
    if (input) input.value = buildFallbackUrl();
  }

  async function copyFallbackUrl() {
    refreshFallbackUrlField();
    const value = byId("displayErrorFallbackUrl")?.value || buildFallbackUrl();
    try {
      await navigator.clipboard.writeText(value);
      setText("displayLoadErrorsStatus", "Fallback URL copied — paste into the Xibo Webpage widget on the error layout.");
    } catch (_) {
      byId("displayErrorFallbackUrl")?.select?.();
      setText("displayLoadErrorsStatus", "Copy failed — select the URL field and copy manually.");
    }
  }

  function setDisplayErrorsBlink(hasNew) {
    const tab = byId("diagnosticsDisplayErrorsTab");
    if (tab) {
      tab.classList.toggle("is-blink", !!hasNew);
      tab.setAttribute("aria-label", hasNew
        ? "Display / Xibo Load Errors — new fallback hits"
        : "Display / Xibo Load Errors");
    }
    const parent = document.querySelector('.admin-tab-parent[data-group="diagnostics"]');
    if (parent) parent.classList.toggle("is-blink", !!hasNew);
  }

  function formatDatePart(ms) {
    const n = Number(ms || 0);
    if (!n) return "—";
    try {
      return new Date(n).toLocaleDateString(undefined, {year: "numeric", month: "short", day: "numeric"});
    } catch (_) {
      return "—";
    }
  }

  function formatTimePart(ms) {
    const n = Number(ms || 0);
    if (!n) return "—";
    try {
      return new Date(n).toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit", second: "2-digit"});
    } catch (_) {
      return "—";
    }
  }

  function hostIpFromRow(row = {}) {
    const d = row.details || {};
    return String(d.clientIp || d.hostIp || d.ip || row.clientIp || "").trim() || "—";
  }

  function errorDetailsFromRow(row = {}) {
    return String(row.message || "Display load-error fallback").trim();
  }

  function renderLoadErrors(rows = []) {
    const host = byId("displayLoadErrorsReport");
    if (!host) return;
    lastLoadErrorRows = rows;
    const seenMs = getSeenMs();
    const newestMs = rows.reduce((max, row) => Math.max(max, Number(row.createdAtMs || 0)), 0);
    const newCount = rows.filter((row) => Number(row.createdAtMs || 0) > seenMs).length;
    const viewing = byId("diagnosticsDisplayErrors")?.classList.contains("active");
    if (viewing && newestMs) {
      setSeenMs(newestMs);
      setDisplayErrorsBlink(false);
    } else {
      setDisplayErrorsBlink(newCount > 0);
    }

    setText("displayLoadErrorsStatus", rows.length
      ? `${rows.length} load-error event(s)${newCount && !viewing ? ` · ${newCount} new` : ""} · 30-day retention`
      : "No display/Xibo load-error events yet.");

    if (!rows.length) {
      host.textContent = "No fallback hits logged yet. Open display-error.html from a player or paste the fallback URL into Xibo to test.";
      return;
    }

    const bodyRows = rows.map((row) => {
      const d = row.details || {};
      const locationId = d.locationId || "";
      const board = d.displayBoard || "";
      const isNew = Number(row.createdAtMs || 0) > seenMs && !viewing;
      return `<tr class="${isNew ? "is-unread" : ""}">
        <td>${esc(formatDatePart(row.createdAtMs))}</td>
        <td>${esc(formatTimePart(row.createdAtMs))}</td>
        <td>${esc(hostIpFromRow(row))}</td>
        <td>
          <div class="display-load-error-detail">${esc(errorDetailsFromRow(row))}</div>
          <div class="display-load-error-meta">${esc(boardLabel(board))}${locationId ? ` · ${esc(locationId)}` : ""}${isNew ? " · NEW" : ""}</div>
        </td>
      </tr>`;
    }).join("");

    host.innerHTML = `<div class="display-load-errors-table-wrap" data-keep-visible="true">
      <table class="display-load-errors-table" data-keep-visible="true">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Time</th>
            <th scope="col">Host IP</th>
            <th scope="col">Error Details</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
  }

  function startDisplayLoadErrorFeed() {
    if (loadErrorsUnsub) {
      try { loadErrorsUnsub(); } catch (_) {}
      loadErrorsUnsub = null;
    }
    const user = firebase.auth().currentUser;
    const host = byId("displayLoadErrorsReport");
    if (!user || !host) return;
    host.textContent = "Listening for display/Xibo load-error events…";
    try {
      loadErrorsUnsub = firebase.firestore()
        .collection("appLogs")
        .orderBy("createdAt", "desc")
        .limit(200)
        .onSnapshot((snap) => {
          const rows = snap.docs
            .map((doc) => {
              const data = doc.data() || {};
              return {
                id: doc.id,
                ...data,
                createdAtMs: Number(data.createdAtMs || data.createdAt?.toMillis?.() || 0)
              };
            })
            .filter((row) => {
              const cat = String(row.category || "").toLowerCase();
              const action = String(row.action || "").toLowerCase();
              return cat === "displayfallback" || action === "xibo_page_load_error";
            })
            .slice(0, 50);
          renderLoadErrors(rows);
        }, (err) => {
          setText("displayLoadErrorsStatus", err?.message || "Could not listen for load-error logs.");
          host.textContent = "Failed to load display/Xibo error log.";
        });
    } catch (err) {
      setText("displayLoadErrorsStatus", err?.message || "Could not start load-error feed.");
    }
  }

  function focusDisplayLoadErrors() {
    refreshFallbackUrlField();
    const newest = lastLoadErrorRows.reduce((max, row) => Math.max(max, Number(row.createdAtMs || 0)), 0);
    if (newest) setSeenMs(newest);
    setDisplayErrorsBlink(false);
    if (!loadErrorsUnsub) startDisplayLoadErrorFeed();
    else renderLoadErrors(lastLoadErrorRows);
  }

  function ensureMounted() {
    // Placeholder for future lazy mounts; diagnostics core still boots from master-admin-app.
  }

  function bind() {
    if (bound) return;
    bound = true;
    byId("displayErrorVenueId")?.addEventListener("input", refreshFallbackUrlField);
    byId("displayErrorBoard")?.addEventListener("change", refreshFallbackUrlField);
    byId("copyDisplayErrorFallbackUrlBtn")?.addEventListener("click", copyFallbackUrl);
    byId("openDisplayErrorFallbackBtn")?.addEventListener("click", () => {
      refreshFallbackUrlField();
      window.open(buildFallbackUrl(), "_blank", "noopener");
    });
    byId("refreshDisplayLoadErrorsBtn")?.addEventListener("click", () => {
      startDisplayLoadErrorFeed();
      setText("displayLoadErrorsStatus", "Refreshing load-error log…");
    });
    refreshFallbackUrlField();

    firebase.auth().onAuthStateChanged((user) => {
      if (user) startDisplayLoadErrorFeed();
      else {
        setDisplayErrorsBlink(false);
        if (loadErrorsUnsub) {
          try { loadErrorsUnsub(); } catch (_) {}
          loadErrorsUnsub = null;
        }
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  global.FLOQRDiagnosticsPanels = {
    focusDisplayLoadErrors,
    ensureMounted,
    startDisplayLoadErrorFeed,
    refreshFallbackUrlField
  };
})(window);
