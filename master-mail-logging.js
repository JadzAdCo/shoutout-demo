/* FLOQR Master Admin Diagnostics — Mail Logging (system-generated SendGrid mail). */
(function (global) {
  "use strict";

  const COLLECTION = "systemMailLogs";
  let rows = [];
  let selectedId = "";
  let unsub = null;
  let bound = false;

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

  function recipients(row) {
    if (Array.isArray(row.to) && row.to.length) return row.to.join(", ");
    return row.toLower || row.to || "";
  }

  function tlsLabel(row) {
    const proto = String(row.tlsProtocol || "");
    const min = String(row.tlsMinRequested || "TLSv1.3");
    const apiOk = row.tlsApiOk === true;
    const enforced = row.enforcedTls && row.enforcedTls.requireTls === true;
    return `${min} requested · API ${proto || "unknown"}${apiOk ? " (1.3)" : ""}${enforced ? " · recipient TLS enforced" : " · recipient TLS unknown"}`;
  }

  function filtered() {
    const status = String(byId("mailLogStatusFilter")?.value || "").trim().toLowerCase();
    const kind = String(byId("mailLogKindFilter")?.value || "").trim().toLowerCase();
    const query = String(byId("mailLogSearch")?.value || "").trim().toLowerCase();
    return rows.filter((row) => {
      if (status && String(row.status || "").toLowerCase() !== status) return false;
      if (kind && String(row.kind || "").toLowerCase() !== kind) return false;
      if (!query) return true;
      const hay = [
        row.id, row.subject, recipients(row), row.from, row.kind, row.source, row.trigger,
        row.sendgridMessageId, row.packageVersion, row.status, row.error, row.textBody
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  function uniqueKinds() {
    return Array.from(new Set(rows.map((row) => String(row.kind || "").trim()).filter(Boolean))).sort();
  }

  function fillKindFilter() {
    const sel = byId("mailLogKindFilter");
    if (!sel) return;
    const current = sel.value;
    const opts = ['<option value="">All kinds</option>']
      .concat(uniqueKinds().map((kind) => `<option value="${esc(kind)}">${esc(kind)}</option>`));
    sel.innerHTML = opts.join("");
    if (current && uniqueKinds().includes(current)) sel.value = current;
  }

  function renderList() {
    const host = byId("mailLogList");
    if (!host) return;
    const list = filtered();
    setText("mailLogCount", String(list.length));
    const failed = list.filter((row) => String(row.status || "") === "failed" || String(row.sendOk) === "false").length;
    setText("mailLogFailCount", String(failed));
    if (!list.length) {
      host.innerHTML = "<p class=\"sub small\">No system mails match this search.</p>";
      return;
    }
    host.innerHTML = list.map((row) => {
      const active = row.id === selectedId ? " active" : "";
      return `<button type="button" class="queue-item mail-log-row${active}" data-mail-log-id="${esc(row.id)}">
        <strong>${esc(row.status || "unknown")}</strong>
        · ${esc(ts(row))}
        <div>${esc(row.subject || "(no subject)")}</div>
        <div class="sub small">${esc(recipients(row))} · ${esc(row.kind || "system")} · ${esc(row.trigger || "")}</div>
      </button>`;
    }).join("");
    host.querySelectorAll("[data-mail-log-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedId = btn.getAttribute("data-mail-log-id") || "";
        renderList();
        renderDetail();
      });
    });
  }

  function headerBlock(headers) {
    const entries = headers && typeof headers === "object" ? Object.entries(headers) : [];
    if (!entries.length) return "(none)";
    return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
  }

  function renderDetail() {
    const host = byId("mailLogDetail");
    if (!host) return;
    const row = rows.find((item) => item.id === selectedId);
    if (!row) {
      host.innerHTML = "<p class=\"sub small\">Select a mail to view headers, body, TLS, and delivery events.</p>";
      return;
    }
    const events = Array.isArray(row.events) ? row.events : [];
    const eventHtml = events.length
      ? `<ul>${events.map((ev) => `<li><code>${esc(ev.event)}</code> ${esc(ev.email || "")} ${ev.timestamp ? esc(new Date(Number(ev.timestamp) * (Number(ev.timestamp) < 1e12 ? 1000 : 1)).toLocaleString()) : ""} ${esc(ev.reason || "")}${ev.tls ? ` · TLS ${esc(ev.tls)}` : ""}</li>`).join("")}</ul>`
      : "<p class=\"sub small\">No provider delivery events yet. Accepted means SendGrid took the message; Delivered appears after the event webhook.</p>";
    host.innerHTML = `
      <p><strong>${esc(row.subject || "")}</strong></p>
      <p class="sub small">${esc(row.status)} · send ${row.sendOk ? "ok" : "failed"} · HTTP ${esc(row.httpStatus || "—")} · log ${esc(row.id)}</p>
      <p>To: ${esc(recipients(row))}<br/>From: ${esc(row.from)}<br/>Kind: ${esc(row.kind)} · Source: ${esc(row.source)} · Trigger: ${esc(row.trigger)}</p>
      <p>TLS: ${esc(tlsLabel(row))}</p>
      <p>SendGrid message id: ${esc(row.sendgridMessageId || "—")}</p>
      ${row.error ? `<p>Error: ${esc(row.error)}</p>` : ""}
      ${row.bodyRedacted ? "<p class=\"sub small\">OTP / secret digits are redacted in stored content.</p>" : ""}
      <h3>Request headers</h3>
      <pre class="report-block">${esc(headerBlock(row.requestHeaders))}</pre>
      <h3>Response headers</h3>
      <pre class="report-block">${esc(headerBlock(row.responseHeaders))}</pre>
      <h3>Text body</h3>
      <pre class="report-block">${esc(row.textBody || "")}</pre>
      <h3>HTML body</h3>
      <pre class="report-block">${esc(row.htmlBody || "")}</pre>
      ${row.attachmentNames && row.attachmentNames.length ? `<p>Attachments: ${esc(row.attachmentNames.join(", "))}</p>` : ""}
      <h3>Delivery events</h3>
      ${eventHtml}
    `;
  }

  function startFeed() {
    const host = byId("mailLogList");
    if (!host || !global.firebase) return;
    if (unsub) {
      try { unsub(); } catch (_) {}
      unsub = null;
    }
    setText("mailLoggingStatus", "Loading system mail logs…");
    try {
      unsub = firebase.firestore()
        .collection(COLLECTION)
        .orderBy("createdAtMs", "desc")
        .limit(300)
        .onSnapshot((snap) => {
          rows = snap.docs.map((doc) => ({id: doc.id, ...(doc.data() || {})}));
          fillKindFilter();
          if (selectedId && !rows.some((row) => row.id === selectedId)) selectedId = rows[0]?.id || "";
          else if (!selectedId && rows[0]) selectedId = rows[0].id;
          renderList();
          renderDetail();
          setText("mailLoggingStatus", `${rows.length} recent system mails (90-day retention).`);
        }, (err) => {
          setText("mailLoggingStatus", err?.message || "Could not listen for mail logs.");
          host.textContent = "Failed to load mail logs. Sign in as Master Admin.";
        });
    } catch (err) {
      setText("mailLoggingStatus", err?.message || "Could not start mail log feed.");
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    ["mailLogStatusFilter", "mailLogKindFilter", "mailLogSearch"].forEach((id) => {
      byId(id)?.addEventListener("input", () => { renderList(); });
      byId(id)?.addEventListener("change", () => { renderList(); });
    });
    byId("mailLogRefreshBtn")?.addEventListener("click", () => {
      startFeed();
      setText("mailLoggingStatus", "Refreshing mail logs…");
    });
    firebase.auth().onAuthStateChanged((user) => {
      if (user) startFeed();
      else if (unsub) {
        try { unsub(); } catch (_) {}
        unsub = null;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  global.FLOQRMailLogging = {
    mount: startFeed,
    startFeed
  };
})(window);
