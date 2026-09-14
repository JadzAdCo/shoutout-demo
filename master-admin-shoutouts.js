/**
 * Master Admin → ShoutOuts (Completed log + Retention).
 * Design notes: .cursor/rules/design-notes-master-admin-shoutouts.mdc
 * Firestore search v1: date-range query + client filter for venue/content.
 */
(function (global) {
  "use strict";

  function byId(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value == null ? "" : String(value);
  }
  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const ms = Number(value);
    if (Number.isFinite(ms) && ms > 0) return new Date(ms < 1e12 ? ms * 1000 : ms);
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }
  function fmtDate(value) {
    const d = toDate(value);
    return d ? d.toLocaleString() : "—";
  }
  function startOfDayInput(daysAgo) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }
  function endOfDayInput() {
    return new Date().toISOString().slice(0, 10);
  }

  function db() {
    return firebase.firestore();
  }

  function functions() {
    return firebase.app().functions("us-central1");
  }

  async function searchComplianceLogs() {
    const venue = String(byId("soComplianceVenue")?.value || "").trim().toLowerCase();
    const content = String(byId("soComplianceContent")?.value || "").trim().toLowerCase();
    const fromStr = String(byId("soComplianceFrom")?.value || "").trim();
    const toStr = String(byId("soComplianceTo")?.value || "").trim();
    const host = byId("soComplianceResults");
    if (!host) return;
    setText("soComplianceStatus", "Searching compliance log…");
    const fromMs = fromStr ? Date.parse(`${fromStr}T00:00:00`) : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const toMs = toStr ? Date.parse(`${toStr}T23:59:59`) : Date.now();
    let rows = [];
    try {
      const snap = await db().collection("shoutoutComplianceLogs")
        .where("eventAtMs", ">=", fromMs)
        .where("eventAtMs", "<=", toMs)
        .orderBy("eventAtMs", "desc")
        .limit(400)
        .get();
      rows = snap.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    } catch (err) {
      console.warn("compliance date query failed; falling back", err?.message || err);
      try {
        const snap = await db().collection("shoutoutComplianceLogs").orderBy("eventAtMs", "desc").limit(400).get();
        rows = snap.docs.map((doc) => ({id: doc.id, ...doc.data()}))
          .filter((row) => {
            const ms = Number(row.eventAtMs || 0);
            return ms >= fromMs && ms <= toMs;
          });
      } catch (err2) {
        setText("soComplianceStatus", err2.message || "Could not read shoutoutComplianceLogs.");
        host.innerHTML = `<p class="sub">${esc(err2.message || "Read failed")}</p>`;
        return;
      }
    }
    if (venue) {
      rows = rows.filter((row) => String(row.venueNameLower || row.venueName || "").toLowerCase().includes(venue)
        || String(row.clubLocationId || "").toLowerCase().includes(venue));
    }
    if (content) {
      rows = rows.filter((row) => String(row.searchBlob || `${row.mainText || ""} ${row.subText || ""}`).toLowerCase().includes(content));
    }
    setText("soComplianceStatus", `${rows.length} record(s). Media kept max 90 days; audit metadata 7 years.`);
    if (!rows.length) {
      host.innerHTML = `<p class="sub">No compliance records match this search.</p>`;
      return;
    }
    host.innerHTML = rows.map((row) => {
      const mediaNote = row.mediaPurgeStatus === "purged"
        ? `Media purged ${esc(fmtDate(row.mediaPurgedAt))}`
        : row.hasMedia
          ? `Media until ${esc(fmtDate(row.mediaRetentionUntil))}`
          : "No media";
      const mediaLink = row.mediaUrl && row.mediaPurgeStatus !== "purged"
        ? `<p><a href="${esc(row.mediaUrl)}" target="_blank" rel="noopener">Open media</a></p>`
        : "";
      return `<div class="queue-item">
        <strong>${esc(row.mainText || "ShoutOut")}</strong>
        <p>${esc(row.venueName || row.clubLocationId || "Venue")} — ${esc(row.status || "")} — ${esc(row.paymentStatus || "")} — $${((Number(row.amountCents || 0) || 0) / 100).toFixed(2)}</p>
        <small>Ref ${esc(row.referenceNumber || row.shoutoutId || row.id)} · Event ${esc(fmtDate(row.eventAt || row.eventAtMs))} · ${mediaNote}${row.legalHold ? " · LEGAL HOLD" : ""}${row.anonymized ? " · anonymized" : ""}</small>
        ${row.subText ? `<p class="sub small">${esc(row.subText)}</p>` : ""}
        ${mediaLink}
      </div>`;
    }).join("");
  }

  async function loadRetentionPolicy() {
    setText("soRetentionStatus", "Loading retention policy…");
    try {
      const result = await functions().httpsCallable("getShoutoutComplianceRetention")({});
      const data = result?.data || {};
      const meta = data.meta || {};
      byId("soRetentionPolicy") && (byId("soRetentionPolicy").innerHTML = `
        <div class="report-table">
          <div><span>Audit metadata retention</span><strong>${esc(data.auditRetentionYears || 7)} years</strong></div>
          <div><span>Media deletion</span><strong>${esc(data.mediaRetentionDays || 90)} days after completion</strong></div>
          <div><span>Forever media archive</span><strong>No</strong></div>
          <div><span>Last media purge</span><strong>${esc(fmtDate(meta.lastMediaPurgeAt))} (${esc(meta.lastMediaPurgeCount ?? "—")})</strong></div>
          <div><span>Last anonymize run</span><strong>${esc(fmtDate(meta.lastAnonymizeAt))} (${esc(meta.lastAnonymizeCount ?? "—")})</strong></div>
        </div>
        <p class="sub small">${esc(data.policy?.audit || "")}</p>
        <p class="sub small">${esc(data.policy?.media || "")}</p>`);
      setText("soRetentionStatus", "Retention policy loaded.");
    } catch (err) {
      byId("soRetentionPolicy") && (byId("soRetentionPolicy").innerHTML = `
        <div class="report-table">
          <div><span>Audit metadata retention</span><strong>7 years</strong></div>
          <div><span>Media deletion</span><strong>90 days after completion</strong></div>
          <div><span>Forever media archive</span><strong>No</strong></div>
        </div>
        <p class="sub small">Callable unavailable until Functions deploy. Local policy defaults shown.</p>`);
      setText("soRetentionStatus", err.message || "Using local retention defaults.");
    }
  }

  async function runBackfill() {
    setText("soRetentionStatus", "Backfilling compliance logs…");
    try {
      const result = await functions().httpsCallable("backfillShoutoutComplianceLogs")({limit: 200});
      const data = result?.data || {};
      setText("soRetentionStatus", `Backfill done: scanned ${data.scanned || 0}, wrote ${data.written || 0}.`);
      await searchComplianceLogs();
    } catch (err) {
      setText("soRetentionStatus", err.message || "Backfill failed.");
    }
  }

  function mount() {
    if (!byId("soComplianceResults")) return;
    if (!byId("soComplianceFrom")?.value) byId("soComplianceFrom").value = startOfDayInput(30);
    if (!byId("soComplianceTo")?.value) byId("soComplianceTo").value = endOfDayInput();
    byId("soComplianceSearchBtn")?.addEventListener("click", () => searchComplianceLogs().catch(console.warn));
    byId("soComplianceRefreshBtn")?.addEventListener("click", () => searchComplianceLogs().catch(console.warn));
    byId("soRetentionRefreshBtn")?.addEventListener("click", () => loadRetentionPolicy().catch(console.warn));
    byId("soComplianceBackfillBtn")?.addEventListener("click", () => runBackfill().catch(console.warn));
  }

  function onPanel(panelId) {
    if (panelId === "shoutoutCompletedLog") searchComplianceLogs().catch(console.warn);
    if (panelId === "shoutoutRetention") loadRetentionPolicy().catch(console.warn);
  }

  global.FLOQRMasterShoutouts = {mount, onPanel, searchComplianceLogs, loadRetentionPolicy};
})(window);
