/* Master Admin → Diagnostics → FloqCast — connectivity / WebRTC appLogs (category suprstar|floqCast). */
(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  const FLOQCAST_CATEGORIES = new Set(["suprstar", "floqcast", "floqCast", "suprstr"]);
  const CONNECTIVITY_ACTIONS = /^(webrtc_|live_|ice_|startFloq|endFloq|go_live|broadcast|display_|join|renegot|turn|stun)/i;

  let logs = [];
  let bound = false;

  function setStatus(message) {
    const el = byId("floqcastDiagStatus");
    if (el) el.textContent = message || "";
  }

  function ts(value) {
    if (!value) return "—";
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    if (typeof value === "number") return new Date(value).toLocaleString();
    return String(value);
  }

  function isFloqCastRow(row) {
    const cat = String(row.category || "").toLowerCase();
    if (FLOQCAST_CATEGORIES.has(row.category) || FLOQCAST_CATEGORIES.has(cat)) return true;
    const action = String(row.action || "");
    if (CONNECTIVITY_ACTIONS.test(action)) return true;
    const src = String(row.source || "").toLowerCase();
    if (src.includes("floqcast") || src.includes("suprstar") || src.includes("suprstr")) return true;
    const hay = `${row.message || ""} ${JSON.stringify(row.details || {})}`.toLowerCase();
    return /floqcast|suprstar|webrtc|ice-|turn|stun|display2|__secondary/.test(hay);
  }

  function filteredLogs() {
    const level = byId("floqcastDiagLevelFilter")?.value || "";
    const actionQ = (byId("floqcastDiagActionFilter")?.value || "").trim().toLowerCase();
    const query = (byId("floqcastDiagSearch")?.value || "").trim().toLowerCase();
    return logs.filter((row) => {
      if (level && row.level !== level) return false;
      if (actionQ && !String(row.action || "").toLowerCase().includes(actionQ)) return false;
      if (!query) return true;
      const hay = [
        row.message, row.action, row.category, row.email, row.uid,
        row.correlationId, row.source, JSON.stringify(row.details || {})
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  function iceHint(row) {
    const d = row.details || {};
    const meta = d.webrtcMeta || d.meta || {};
    const parts = [];
    const iceSrc = d.iceSource || meta.iceSource || d.source;
    if (iceSrc) parts.push(`ICE ${iceSrc}`);
    const conn = meta.connectionState || d.connectionState;
    const ice = meta.iceConnectionState || d.iceConnectionState;
    if (conn) parts.push(`conn=${conn}`);
    if (ice) parts.push(`ice=${ice}`);
    const loc = d.locationId || meta.locationId;
    if (loc) parts.push(loc);
    return parts.join(" · ");
  }

  function render() {
    const rows = filteredLogs();
    const warnN = rows.filter((r) => r.level === "warn" || r.level === "error").length;
    const iceOnly = rows.filter((r) => /ice|turn|stun|webrtc/i.test(`${r.action} ${r.message}`)).length;
    if (byId("floqcastDiagCount")) byId("floqcastDiagCount").textContent = String(rows.length);
    if (byId("floqcastDiagWarnCount")) byId("floqcastDiagWarnCount").textContent = String(warnN);
    if (byId("floqcastDiagIceCount")) byId("floqcastDiagIceCount").textContent = String(iceOnly);
    const list = byId("floqcastDiagList");
    if (!list) return;
    list.innerHTML = rows.length ? rows.map((row) => {
      const hint = iceHint(row);
      const details = row.details
        ? `<details class="audit-change"><summary>Details</summary><pre class="log-details">${esc(JSON.stringify(row.details, null, 2))}</pre></details>`
        : "";
      return `<article class="queue-item log-row level-${esc(row.level || "info")}">
        <div class="message-envelope-head">
          <strong>${esc((row.level || "info").toUpperCase())} · ${esc(row.category || "floqCast")}${row.action ? ` / ${esc(row.action)}` : ""}</strong>
          <span>${esc(ts(row.createdAt || row.createdAtMs))}</span>
        </div>
        <p>${esc(row.message || "")}</p>
        ${hint ? `<p class="sub small">${esc(hint)}</p>` : ""}
        <small>${esc(row.email || row.uid || "anonymous")} · corr ${esc(row.correlationId || "—")} · ${esc(row.source || "client")}</small>
        ${details}
      </article>`;
    }).join("") : `<p class="sub">No floqCast connectivity logs match the filters. Go live once while signed in — phone writes <code>webrtc_status</code> / ICE source into <code>appLogs</code>.</p>`;
  }

  async function loadLogs() {
    const db = firebase.firestore();
    setStatus("Loading floqCast diagnostic logs…");
    try {
      // Prefer category query when indexed; fall back to recent scan + client filter.
      let rows = [];
      try {
        const snap = await db.collection("appLogs")
          .where("category", "in", ["suprstar", "floqCast", "floqcast"])
          .orderBy("createdAt", "desc")
          .limit(200)
          .get();
        rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      } catch (_) {
        const snap = await db.collection("appLogs").orderBy("createdAt", "desc").limit(400).get();
        rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(isFloqCastRow);
      }
      logs = rows.filter(isFloqCastRow);
      render();
      setStatus(`Loaded ${logs.length} floqCast log row(s).`);
    } catch (error) {
      setStatus(error?.message || "Could not load floqCast logs.");
      window.FLOQRLog?.fromError?.(error, { category: "admin", action: "load_floqcast_logs" });
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    byId("floqcastDiagRefreshBtn")?.addEventListener("click", () => loadLogs());
    byId("floqcastDiagLevelFilter")?.addEventListener("change", render);
    byId("floqcastDiagActionFilter")?.addEventListener("input", render);
    byId("floqcastDiagSearch")?.addEventListener("input", render);
  }

  window.FLOQRFloqCastDiagnostics = {
    mount() {
      bind();
      loadLogs();
    },
    refresh: loadLogs
  };
})();
