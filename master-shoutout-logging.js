/* Master Admin → Diagnostics → ShoutOut — appLogs category shoutout (+ page_call trail). */
(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  const SHOUTOUT_CATEGORIES = new Set(["shoutout", "shoutOut", "ShoutOut"]);
  const PAGE_ACTIONS = /^(page_call|submit_|save_draft|checkout|media_|baller_|template_|preview_)/i;

  let logs = [];
  let bound = false;

  function setStatus(message) {
    const el = byId("shoutoutDiagStatus");
    if (el) el.textContent = message || "";
  }

  function ts(value) {
    if (!value) return "—";
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    if (typeof value === "number") return new Date(value).toLocaleString();
    return String(value);
  }

  function isShoutOutRow(row) {
    const cat = String(row.category || "");
    if (SHOUTOUT_CATEGORIES.has(cat) || SHOUTOUT_CATEGORIES.has(cat.toLowerCase())) return true;
    const action = String(row.action || "");
    if (PAGE_ACTIONS.test(action) && /shout/i.test(`${row.message || ""} ${JSON.stringify(row.details || {})}`)) return true;
    const src = String(row.source || "").toLowerCase();
    if (src.includes("shoutout")) return true;
    const hay = `${row.message || ""} ${JSON.stringify(row.details || {})}`.toLowerCase();
    return /shoutout|baller|jersey|template_select|editorpage|page_call/.test(hay) && /so_|shoutouttrail|correlation/.test(hay + String(row.correlationId || "").toLowerCase());
  }

  function trailIdOf(row) {
    const d = row.details || {};
    return String(d.shoutoutTrailId || d.trailId || row.correlationId || "").trim();
  }

  function filteredLogs() {
    const level = byId("shoutoutDiagLevelFilter")?.value || "";
    const actionQ = (byId("shoutoutDiagActionFilter")?.value || "").trim().toLowerCase();
    const query = (byId("shoutoutDiagSearch")?.value || "").trim().toLowerCase();
    const trailOnly = byId("shoutoutDiagTrailOnly")?.checked;
    return logs.filter((row) => {
      if (level && row.level !== level) return false;
      if (trailOnly && String(row.action || "") !== "page_call") return false;
      if (actionQ && !String(row.action || "").toLowerCase().includes(actionQ)) return false;
      if (!query) return true;
      const hay = [
        row.message, row.action, row.category, row.email, row.uid,
        row.correlationId, row.source, JSON.stringify(row.details || {})
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  function groupPageTrails(rows) {
    const map = new Map();
    rows.filter((r) => String(r.action || "") === "page_call").forEach((row) => {
      const id = trailIdOf(row) || row.id;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(row);
    });
    return Array.from(map.entries()).map(([id, items]) => {
      items.sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));
      const detailsList = items.map((row) => row.details || {});
      const lastFilled = (key) => {
        for (let i = detailsList.length - 1; i >= 0; i -= 1) {
          const value = String(detailsList[i][key] || "").trim();
          if (value) return value;
        }
        return "";
      };
      return {
        trailId: id,
        count: items.length,
        template: lastFilled("template") || "template not selected",
        locationId: lastFilled("locationId") || "venue not selected",
        startedAt: items[0]?.createdAt || items[0]?.createdAtMs,
        endedAt: items[items.length - 1]?.createdAt || items[items.length - 1]?.createdAtMs,
        pages: items.map((r) => ({
          pageId: r.details?.pageId || r.message || "—",
          at: r.createdAt || r.createdAtMs,
          pageIndex: r.details?.pageIndex
        })),
        email: items[0]?.email || items[0]?.uid || "—"
      };
    }).sort((a, b) => Number(b.endedAt?.seconds ? b.endedAt.seconds * 1000 : b.endedAt || 0)
      - Number(a.endedAt?.seconds ? a.endedAt.seconds * 1000 : a.endedAt || 0));
  }

  function render() {
    const rows = filteredLogs();
    const warnN = rows.filter((r) => r.level === "warn" || r.level === "error").length;
    const pageN = rows.filter((r) => String(r.action || "") === "page_call").length;
    if (byId("shoutoutDiagCount")) byId("shoutoutDiagCount").textContent = String(rows.length);
    if (byId("shoutoutDiagWarnCount")) byId("shoutoutDiagWarnCount").textContent = String(warnN);
    if (byId("shoutoutDiagPageCount")) byId("shoutoutDiagPageCount").textContent = String(pageN);

    const list = byId("shoutoutDiagList");
    if (list) {
      list.innerHTML = rows.length ? rows.map((row) => {
        const d = row.details || {};
        const hintParts = [];
        if (d.pageId) hintParts.push(`page ${d.pageId}`);
        if (d.template) hintParts.push(d.template);
        else if (d.templateChosen === false) hintParts.push("template not selected");
        if (d.locationId) hintParts.push(d.locationId);
        else if (d.venueChosen === false) hintParts.push("venue not selected");
        if (d.destHost) hintParts.push(d.destHost);
        if (d.shoutoutTrailId || row.correlationId) hintParts.push(`id ${d.shoutoutTrailId || row.correlationId}`);
        const details = row.details
          ? `<details class="audit-change"><summary>Details</summary><pre class="log-details">${esc(JSON.stringify(row.details, null, 2))}</pre></details>`
          : "";
        return `<article class="queue-item log-row level-${esc(row.level || "info")}">
          <div class="message-envelope-head">
            <strong>${esc((row.level || "info").toUpperCase())} · ${esc(row.category || "shoutout")}${row.action ? ` / ${esc(row.action)}` : ""}</strong>
            <span>${esc(ts(row.createdAt || row.createdAtMs))}</span>
          </div>
          <p>${esc(row.message || "")}</p>
          ${hintParts.length ? `<p class="sub small">${esc(hintParts.join(" · "))}</p>` : ""}
          <small>${esc(row.email || row.uid || "anonymous")} · corr ${esc(row.correlationId || "—")} · ${esc(row.source || "client")}</small>
          ${details}
        </article>`;
      }).join("") : `<p class="sub">No ShoutOut logs match the filters. Compose or submit a ShoutOut while signed in — page_call / submit rows write to <code>appLogs</code>.</p>`;
    }

    const trailBox = byId("shoutoutDiagTrailList");
    if (trailBox) {
      const trails = groupPageTrails(logs);
      trailBox.innerHTML = trails.length ? trails.map((trail) => `
        <article class="queue-item">
          <div class="message-envelope-head">
            <strong>Trail ${esc(trail.trailId)}</strong>
            <span>${esc(ts(trail.startedAt))} → ${esc(ts(trail.endedAt))}</span>
          </div>
          <p class="sub small">${esc(trail.template)} · ${esc(trail.locationId)} · ${esc(String(trail.count))} page call(s) · ${esc(trail.email)}</p>
          <ol class="shoutout-page-trail">
            ${trail.pages.map((p) => `<li><code>${esc(p.pageId)}</code> <span>${esc(ts(p.at))}</span></li>`).join("")}
          </ol>
        </article>`).join("") : `<p class="sub">No page_call trails yet. Open ShoutOut flow pages while signed in to populate this subsection.</p>`;
    }
  }

  async function loadLogs() {
    const db = firebase.firestore();
    setStatus("Loading ShoutOut diagnostic logs…");
    try {
      let rows = [];
      try {
        const snap = await db.collection("appLogs")
          .where("category", "in", ["shoutout", "shoutOut"])
          .orderBy("createdAt", "desc")
          .limit(250)
          .get();
        rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      } catch (_) {
        const snap = await db.collection("appLogs").orderBy("createdAt", "desc").limit(500).get();
        rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(isShoutOutRow);
      }
      logs = rows.filter(isShoutOutRow);
      render();
      setStatus(`Loaded ${logs.length} ShoutOut log row(s).`);
    } catch (error) {
      setStatus(error?.message || "Could not load ShoutOut logs.");
      window.FLOQRLog?.fromError?.(error, { category: "admin", action: "load_shoutout_logs" });
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    byId("shoutoutDiagRefreshBtn")?.addEventListener("click", () => loadLogs());
    byId("shoutoutDiagLevelFilter")?.addEventListener("change", render);
    byId("shoutoutDiagActionFilter")?.addEventListener("input", render);
    byId("shoutoutDiagSearch")?.addEventListener("input", render);
    byId("shoutoutDiagTrailOnly")?.addEventListener("change", render);
  }

  window.FLOQRShoutOutDiagnostics = {
    mount() {
      bind();
      loadLogs();
    },
    refresh: loadLogs
  };
})();
