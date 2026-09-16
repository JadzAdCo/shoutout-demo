/* FLOQR Twilio Logging — Master Admin (per-collection panels) + Club Admin (club-scoped). */
(function (global) {
  "use strict";

  const COLLECTIONS = {
    sms: "twilioSmsLogs",
    whatsapp: "twilioWhatsAppLogs",
    feature: "twilioFeatureLogs",
    compliance: "twilioComplianceLogs",
    deliveries: "clubMessageDeliveries"
  };

  const PANEL_COLLECTION = {
    twilioSmsLogs: COLLECTIONS.sms,
    twilioWhatsAppLogs: COLLECTIONS.whatsapp,
    twilioFeatureLogs: COLLECTIONS.feature,
    twilioComplianceLogs: COLLECTIONS.compliance,
    // legacy single panel id
    twilioLogging: COLLECTIONS.sms
  };

  const listeners = new Map();

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

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value == null ? "" : String(value);
  }

  function ts(row) {
    const ms = Number(row.createdAtMs || row.createdAt?.toMillis?.() || 0);
    if (!ms) return "—";
    return new Date(ms).toLocaleString();
  }

  function stopPanel(panelId) {
    const entry = listeners.get(panelId);
    if (!entry) return;
    try { entry.unsub?.(); } catch (_) {}
    listeners.delete(panelId);
  }

  function idsFor(panelId) {
    const suffix = panelId === "twilioComplianceLogs" ? "Compliance" : (
      panelId === "twilioSmsLogs" ? "Sms" :
      panelId === "twilioWhatsAppLogs" ? "Whatsapp" :
      panelId === "twilioFeatureLogs" ? "Feature" :
      panelId === "clubTwilioSmsLogs" ? "ClubSms" :
      panelId === "clubTwilioWhatsAppLogs" ? "ClubWhatsapp" :
      "Twilio"
    );
    return {
      status: `${panelId}Status`,
      count: `${panelId}Count`,
      fail: `${panelId}FailCount`,
      search: `${panelId}Search`,
      statusFilter: `${panelId}StatusFilter`,
      list: `${panelId}List`,
      detail: `${panelId}Detail`,
      refresh: `${panelId}RefreshBtn`
    };
  }

  function filterRows(rows, panelId) {
    const ids = idsFor(panelId);
    const status = String(byId(ids.statusFilter)?.value || "").trim().toLowerCase();
    const query = String(byId(ids.search)?.value || "").trim().toLowerCase();
    return rows.filter(row => {
      if (status && String(row.status || "").toLowerCase() !== status) return false;
      if (!query) return true;
      const blob = [
        row.toMasked, row.to, row.fromMasked, row.status, row.error, row.errorCode,
        row.purpose, row.providerSid, row.clubLocationId, row.feature, row.channel,
        row.id, row.relatedLogId, row.campaignId
      ].join(" ").toLowerCase();
      return blob.includes(query);
    });
  }

  function render(panelId) {
    const entry = listeners.get(panelId);
    if (!entry) return;
    const ids = idsFor(panelId);
    const view = filterRows(entry.rows, panelId);
    setText(ids.count, String(view.length));
    if (byId(ids.fail)) {
      setText(ids.fail, String(view.filter(r => r.sendOk === false || /fail|invalid|dry-run|blocked/i.test(r.status || "")).length));
    }
    const list = byId(ids.list);
    if (!list) return;
    if (!view.length) {
      list.innerHTML = "<p class='sub small'>No rows match.</p>";
      return;
    }
    list.innerHTML = view.slice(0, 250).map(row => {
      const active = row.id === entry.selectedId ? " active" : "";
      const club = row.clubLocationId ? ` · ${esc(row.clubLocationId)}` : "";
      return `<button type="button" class="report-row${active}" data-twilio-row="${esc(row.id)}">
        <strong>${esc(row.status || "—")}</strong> · ${esc(row.toMasked || row.to || "***")}${club}
        <span class="sub small">${esc(ts(row))} · ${esc(row.purpose || row.source || row.channel || "")}</span>
      </button>`;
    }).join("");
    list.querySelectorAll("[data-twilio-row]").forEach(btn => {
      btn.addEventListener("click", () => {
        entry.selectedId = btn.getAttribute("data-twilio-row") || "";
        renderDetail(panelId);
        render(panelId);
      });
    });
  }

  function renderDetail(panelId) {
    const entry = listeners.get(panelId);
    const ids = idsFor(panelId);
    const detail = byId(ids.detail);
    if (!entry || !detail) return;
    const row = entry.rows.find(r => r.id === entry.selectedId);
    if (!row) {
      detail.innerHTML = "<p class='sub small'>Select a row.</p>";
      return;
    }
    const diag = row.diagnostic || {};
    detail.innerHTML = `
      <p class="eyebrow">${esc(entry.collection)}</p>
      <h3>${esc(row.feature || row.channel || "twilio")} · ${esc(row.status || "")}</h3>
      <p class="sub small">${esc(ts(row))} · ${esc(row.purpose || "—")} · club ${esc(row.clubLocationId || "—")}</p>
      <dl class="report-block">
        <div><dt>To</dt><dd>${esc(row.toMasked || row.to || "—")}</dd></div>
        <div><dt>From</dt><dd>${esc(row.fromMasked || row.from || "—")}</dd></div>
        <div><dt>Provider SID</dt><dd>${esc(row.providerSid || "—")}</dd></div>
        <div><dt>Campaign</dt><dd>${esc(row.campaignId || row.shoutoutId || "—")}</dd></div>
        <div><dt>HTTP / TLS</dt><dd>${esc(row.httpStatus || 0)} · ${esc(row.tlsProtocol || row.tlsMinRequested || "—")}</dd></div>
        <div><dt>Error</dt><dd>${esc(row.error || row.errorCode || "—")}</dd></div>
        <div><dt>Dry-run</dt><dd>${row.dryRun === true ? "yes (not delivered)" : "no"}</dd></div>
        <div><dt>GRC</dt><dd>${row.securityRelevant === true || entry.collection === COLLECTIONS.compliance ? "yes" : "no"}</dd></div>
      </dl>
      <h4>Diagnostic body</h4>
      <pre class="report-block">${esc(diag.body || row.body || "(empty)")}</pre>
    `;
  }

  function bindFilters(panelId) {
    const ids = idsFor(panelId);
    const entry = listeners.get(panelId);
    if (!entry || entry.bound) return;
    entry.bound = true;
    byId(ids.refresh)?.addEventListener("click", () => mountPanel(panelId, entry.opts));
    [ids.search, ids.statusFilter].forEach(id => {
      byId(id)?.addEventListener("input", () => render(panelId));
      byId(id)?.addEventListener("change", () => render(panelId));
    });
  }

  function mountPanel(panelId, opts = {}) {
    const db = firebase.firestore();
    const collection = opts.collection || PANEL_COLLECTION[panelId] || COLLECTIONS.sms;
    const clubLocationId = String(opts.clubLocationId || "").trim();
    const ids = idsFor(panelId);
    stopPanel(panelId);
    setText(ids.status, clubLocationId
      ? `Loading ${collection} for ${clubLocationId}…`
      : `Loading ${collection}…`);

    let query = db.collection(collection);
    if (clubLocationId) {
      query = query.where("clubLocationId", "==", clubLocationId);
    }
    // Prefer createdAtMs when present; clubMessageDeliveries may only have createdAt.
    const orderField = collection === COLLECTIONS.deliveries ? "createdAt" : "createdAtMs";
    query = query.orderBy(orderField, "desc").limit(200);

    const unsub = query.onSnapshot(snap => {
      const rows = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
      listeners.set(panelId, {
        ...(listeners.get(panelId) || {}),
        unsub,
        rows,
        selectedId: listeners.get(panelId)?.selectedId || "",
        collection,
        opts,
        bound: listeners.get(panelId)?.bound || false
      });
      bindFilters(panelId);
      render(panelId);
      if (listeners.get(panelId)?.selectedId) renderDetail(panelId);
      setText(ids.status, `${rows.length} recent ${collection} row(s)${clubLocationId ? ` · club ${clubLocationId}` : ""}.`);
    }, err => {
      setText(ids.status, err?.message || `Could not load ${collection}.`);
    });

    listeners.set(panelId, {
      unsub,
      rows: [],
      selectedId: "",
      collection,
      opts,
      bound: false
    });
    bindFilters(panelId);
  }

  /** Master Admin: mount the active Twilio / compliance panel. */
  function mount(panelId) {
    const id = String(panelId || "twilioSmsLogs").trim();
    if (!byId(id) && id !== "twilioLogging") return;
    const target = id === "twilioLogging" ? "twilioSmsLogs" : id;
    if (!byId(target)) return;
    mountPanel(target, {collection: PANEL_COLLECTION[target] || COLLECTIONS.sms});
  }

  /** Club Admin: SMS + WhatsApp for one venue. */
  function mountClub({clubLocationId} = {}) {
    const club = String(clubLocationId || "").trim();
    if (!club) {
      setText("clubTwilioSmsLogsStatus", "Add ?location=<club-id> to load messaging logs.");
      setText("clubTwilioWhatsAppLogsStatus", "Add ?location=<club-id> to load messaging logs.");
      return;
    }
    if (byId("clubTwilioSmsLogs")) {
      mountPanel("clubTwilioSmsLogs", {collection: COLLECTIONS.sms, clubLocationId: club});
    }
    if (byId("clubTwilioWhatsAppLogs")) {
      mountPanel("clubTwilioWhatsAppLogs", {collection: COLLECTIONS.whatsapp, clubLocationId: club});
    }
  }

  function stop() {
    [...listeners.keys()].forEach(stopPanel);
  }

  global.FLOQRTwilioLogging = {
    mount,
    mountClub,
    stop,
    COLLECTIONS
  };
})(window);
