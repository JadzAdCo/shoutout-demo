/**
 * Master Admin → ShoutOuts (Compliance Logs + Retention).
 * Design notes: .cursor/rules/design-notes-master-admin-shoutouts.mdc
 * Firestore search v1: date-range query + client filter for venue/content/status.
 * Venues come from clubLocations datapoints (contextual typeahead).
 */
(function (global) {
  "use strict";

  let venueCache = [];
  let lastComplianceRows = [];

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

  function csvEscape(value) {
    const text = String(value == null ? "" : value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function db() {
    return firebase.firestore();
  }

  function functions() {
    return firebase.app().functions("us-central1");
  }

  function venueLabel(row) {
    const name = row.locationName || row.clubName || row.brandName || row.id;
    const city = row.city || "";
    return city ? `${name} — ${city}` : name;
  }

  async function loadVenues() {
    if (venueCache.length) return venueCache;
    try {
      const snap = await db().collection("clubLocations").limit(800).get();
      venueCache = snap.docs.map((doc) => {
        const row = doc.data() || {};
        return {
          id: doc.id,
          locationName: String(row.locationName || row.clubName || row.brandName || doc.id),
          brandName: String(row.brandName || ""),
          city: String(row.city || ""),
          locationLabel: String(row.locationLabel || ""),
          active: row.active !== false && String(row.status || "").toLowerCase() !== "deleted" && !row.deletedAt
        };
      }).filter((row) => row.active)
        .sort((a, b) => a.locationName.localeCompare(b.locationName));
    } catch (err) {
      console.warn("clubLocations venue load failed", err?.message || err);
      venueCache = [];
    }
    const list = byId("soComplianceVenueList");
    if (list) {
      list.innerHTML = venueCache.map((row) =>
        `<option value="${esc(row.locationName)}" label="${esc(venueLabel(row))}"></option>`
      ).join("") + venueCache.map((row) =>
        `<option value="${esc(row.id)}" label="${esc(venueLabel(row))}"></option>`
      ).join("");
    }
    return venueCache;
  }

  function selectedVenueIds(venueQuery) {
    const q = String(venueQuery || "").trim().toLowerCase();
    if (!q) return [];
    return venueCache
      .filter((row) =>
        row.id.toLowerCase().includes(q)
        || row.locationName.toLowerCase().includes(q)
        || row.brandName.toLowerCase().includes(q)
        || row.city.toLowerCase().includes(q)
        || row.locationLabel.toLowerCase().includes(q)
      )
      .map((row) => row.id);
  }

  async function searchComplianceLogs() {
    await loadVenues();
    const venue = String(byId("soComplianceVenue")?.value || "").trim().toLowerCase();
    const content = String(byId("soComplianceContent")?.value || "").trim().toLowerCase();
    const statusFilter = String(byId("soComplianceStatusFilter")?.value || "all").trim().toLowerCase();
    const fromStr = String(byId("soComplianceFrom")?.value || "").trim();
    const toStr = String(byId("soComplianceTo")?.value || "").trim();
    const host = byId("soComplianceResults");
    if (!host) return;
    lastComplianceRows = [];
    setText("soComplianceStatus", "Searching compliance log…");
    const fromMs = fromStr ? Date.parse(`${fromStr}T00:00:00`) : Date.now() - 60 * 24 * 60 * 60 * 1000;
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
        lastComplianceRows = [];
        setText("soComplianceStatus", err2.message || "Could not read shoutoutComplianceLogs.");
        host.innerHTML = `<p class="sub">${esc(err2.message || "Read failed")}</p>`;
        return;
      }
    }
    if (venue) {
      const venueIds = new Set(selectedVenueIds(venue));
      rows = rows.filter((row) =>
        String(row.venueNameLower || row.venueName || "").toLowerCase().includes(venue)
        || String(row.clubLocationId || "").toLowerCase().includes(venue)
        || String(row.locationLabel || "").toLowerCase().includes(venue)
        || venueIds.has(String(row.clubLocationId || ""))
      );
    }
    if (content) {
      rows = rows.filter((row) => String(row.searchBlob || `${row.mainText || ""} ${row.subText || ""} ${row.referenceNumber || ""}`).toLowerCase().includes(content));
    }
    if (statusFilter && statusFilter !== "all") {
      rows = rows.filter((row) => {
        const phase = String(row.lifecyclePhase || row.status || "").toLowerCase();
        const status = String(row.status || "").toLowerCase();
        if (statusFilter === "submitted") {
          return ["submitted", "submitted_paid", "pending", "pending_approval"].includes(phase)
            || ["pending", "pending_approval", "submitted"].includes(status);
        }
        if (statusFilter === "rejected") return phase === "rejected" || status === "rejected";
        if (statusFilter === "completed") {
          return ["completed", "approved"].includes(phase)
            || ["approved", "completed", "ended", "played", "archived", "live"].includes(status);
        }
        return phase === statusFilter || status === statusFilter;
      });
    }
    lastComplianceRows = rows.slice();
    setText(
      "soComplianceStatus",
      `${rows.length} record(s). Default window 60 days (searchable). Media max 90 days; audit metadata 7 years.`
    );
    if (!rows.length) {
      host.innerHTML = `<p class="sub">No compliance records match this search. Use <strong>Rebuild compliance log</strong> to reconstruct from ShoutOuts, shoutoutAudit, and System Messages / Inbox.</p>`;
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
        <strong>${esc(row.mainText || row.referenceNumber || "ShoutOut")}</strong>
        <p>${esc(row.venueName || row.clubLocationId || "Venue")} — ${esc(row.lifecyclePhase || row.status || "")} — ${esc(row.status || "")} — ${esc(row.paymentStatus || "")} — $${((Number(row.amountCents || 0) || 0) / 100).toFixed(2)}</p>
        <p class="sub small">Actor ${esc(row.actorIdentifier || row.actorEmail || row.actorPhone || row.submittedByUid || "—")}${row.clientIp ? ` · IP ${esc(row.clientIp)}` : " · IP —"}${row.ipSource ? ` (${esc(row.ipSource)})` : ""}</p>
        <small>Ref ${esc(row.referenceNumber || row.shoutoutId || row.id)} · Event ${esc(fmtDate(row.eventAt || row.eventAtMs))} · ${mediaNote}${row.legalHold ? " · LEGAL HOLD" : ""}${row.anonymized ? " · anonymized" : ""}${row.source ? ` · source ${esc(row.source)}` : ""}</small>
        ${row.subText ? `<p class="sub small">${esc(row.subText)}</p>` : ""}
        ${mediaLink}
      </div>`;
    }).join("");
  }

  function exportComplianceLogsCsv() {
    const rows = Array.isArray(lastComplianceRows) ? lastComplianceRows : [];
    if (!rows.length) {
      setText("soComplianceStatus", "No compliance records to export. Search first, then Export to CSV.");
      return;
    }
    const header = [
      "eventAt",
      "referenceNumber",
      "shoutoutId",
      "venueName",
      "clubLocationId",
      "lifecyclePhase",
      "status",
      "paymentStatus",
      "amountCents",
      "mainText",
      "subText",
      "actorIdentifier",
      "actorEmail",
      "actorPhone",
      "submittedByUid",
      "clientIp",
      "ipSource",
      "mediaUrl",
      "mediaPurgeStatus",
      "mediaRetentionUntil",
      "legalHold",
      "anonymized",
      "source"
    ];
    const lines = [header.join(",")];
    rows.forEach((row) => {
      lines.push([
        fmtDate(row.eventAt || row.eventAtMs),
        row.referenceNumber || "",
        row.shoutoutId || row.id || "",
        row.venueName || "",
        row.clubLocationId || "",
        row.lifecyclePhase || "",
        row.status || "",
        row.paymentStatus || "",
        row.amountCents ?? "",
        row.mainText || "",
        row.subText || "",
        row.actorIdentifier || "",
        row.actorEmail || "",
        row.actorPhone || "",
        row.submittedByUid || "",
        row.clientIp || "",
        row.ipSource || "",
        row.mediaUrl || "",
        row.mediaPurgeStatus || "",
        fmtDate(row.mediaRetentionUntil),
        row.legalHold ? "yes" : "",
        row.anonymized ? "yes" : "",
        row.source || ""
      ].map(csvEscape).join(","));
    });
    const blob = new Blob([lines.join("\n")], {type: "text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floqr-compliance-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setText("soComplianceStatus", `Exported ${rows.length} compliance log row(s) to CSV.`);
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
          <div><span>Default search window</span><strong>${esc(data.uiDefaultSearchDays || 60)} days</strong></div>
          <div><span>Forever media archive</span><strong>No</strong></div>
          <div><span>Last media purge</span><strong>${esc(fmtDate(meta.lastMediaPurgeAt))} (${esc(meta.lastMediaPurgeCount ?? "—")})</strong></div>
          <div><span>Last anonymize run</span><strong>${esc(fmtDate(meta.lastAnonymizeAt))} (${esc(meta.lastAnonymizeCount ?? "—")})</strong></div>
          <div><span>Last backfill</span><strong>${esc(fmtDate(meta.lastBackfillAt))} (wrote ${esc(meta.lastBackfillWritten ?? "—")})</strong></div>
        </div>
        <p class="sub small">${esc(data.policy?.audit || "")}</p>
        <p class="sub small">${esc(data.policy?.media || "")}</p>
        <p class="sub small">${esc(data.policy?.uiWindow || "")}</p>
        <p class="sub small">${esc(data.policy?.note || "")}</p>`);
      setText("soRetentionStatus", "Retention policy loaded.");
    } catch (err) {
      byId("soRetentionPolicy") && (byId("soRetentionPolicy").innerHTML = `
        <div class="report-table">
          <div><span>Audit metadata retention</span><strong>7 years</strong></div>
          <div><span>Media deletion</span><strong>90 days after completion</strong></div>
          <div><span>Default search window</span><strong>60 days</strong></div>
          <div><span>Forever media archive</span><strong>No</strong></div>
        </div>
        <p class="sub small">Callable unavailable until Functions deploy. Local policy defaults shown.</p>`);
      setText("soRetentionStatus", err.message || "Using local retention defaults.");
    }
  }

  async function runBackfill() {
    const statusIds = ["soRetentionStatus", "soComplianceStatus"];
    statusIds.forEach((id) => setText(id, "Rebuilding compliance log from ShoutOuts, shoutoutAudit, and Inbox…"));
    try {
      const result = await functions().httpsCallable("backfillShoutoutComplianceLogs")({limit: 400});
      const data = result?.data || {};
      const scanned = data.scanned || {};
      const msg = `Rebuild done: wrote ${data.written || 0} from ${data.candidates || 0} candidates (shoutouts ${scanned.shoutouts || 0}, audit ${scanned.audit || 0}, inbox ${scanned.inbox || 0}).`;
      statusIds.forEach((id) => setText(id, msg));
      await searchComplianceLogs();
    } catch (err) {
      statusIds.forEach((id) => setText(id, err.message || "Rebuild failed."));
    }
  }

  function mount() {
    if (!byId("soComplianceResults")) return;
    if (!byId("soComplianceFrom")?.value) byId("soComplianceFrom").value = startOfDayInput(60);
    if (!byId("soComplianceTo")?.value) byId("soComplianceTo").value = endOfDayInput();
    byId("soComplianceSearchBtn")?.addEventListener("click", () => searchComplianceLogs().catch(console.warn));
    byId("soComplianceRefreshBtn")?.addEventListener("click", () => searchComplianceLogs().catch(console.warn));
    byId("soComplianceExportCsvBtn")?.addEventListener("click", () => exportComplianceLogsCsv());
    byId("soRetentionRefreshBtn")?.addEventListener("click", () => loadRetentionPolicy().catch(console.warn));
    byId("soComplianceBackfillBtn")?.addEventListener("click", () => runBackfill().catch(console.warn));
    byId("soComplianceRebuildBtn")?.addEventListener("click", () => runBackfill().catch(console.warn));
    loadVenues().catch(console.warn);
  }

  function onPanel(panelId) {
    if (panelId === "shoutoutCompletedLog") {
      loadVenues().then(() => searchComplianceLogs()).catch(console.warn);
    }
    if (panelId === "shoutoutRetention") loadRetentionPolicy().catch(console.warn);
  }

  global.FLOQRMasterShoutouts = {mount, onPanel, searchComplianceLogs, exportComplianceLogsCsv, loadRetentionPolicy, loadVenues};
})(window);
