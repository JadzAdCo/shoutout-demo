/* FLOQR AssignmentCard — one geometry for Draft / Pending / Confirmed / Open. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FLOQRAssignmentCard = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATUS = {
    draft: {key: "draft", label: "Draft", icon: "pencil"},
    pending: {key: "pending", label: "Pending", icon: "clock"},
    confirmed: {key: "confirmed", label: "Confirmed", icon: "check"},
    open: {key: "open", label: "Unfilled", icon: "vacancy"}
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function iconSvg(kind) {
    if (kind === "pencil") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 17.2V20h2.8l8.2-8.2-2.8-2.8L4 17.2zm14.7-8.5c.4-.4.4-1 0-1.4l-2-2c-.4-.4-1-.4-1.4 0l-1.6 1.6 2.8 2.8 1.2-1z"/></svg>';
    }
    if (kind === "clock") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 11H7V11h4V6h2v7z"/></svg>';
    }
    if (kind === "check") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.2 16.2 5 12l1.4-1.4 2.8 2.8 8-8L18.6 7z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zM8 11c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1 .7 1.7 1.6 1.7 2.9V19h6v-2.5c0-2.3-4.7-3.5-6.7-3.5z"/></svg>';
  }

  function formatTimeRange(shift = {}) {
    if (shift.timeLabel) return String(shift.timeLabel);
    const start = new Date(Number(shift.startsAtMs) || Date.parse(shift.startsAt) || 0);
    const end = new Date(Number(shift.endsAtMs) || Date.parse(shift.endsAt) || 0);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return `${shift.startTime || shift.startsAtLabel || ""} – ${shift.endTime || shift.endsAtLabel || ""}`.trim();
    }
    const opts = {hour: "numeric", minute: "2-digit"};
    return `${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`;
  }

  function resolveStatus(shift = {}, kind = "") {
    const key = String(kind || shift.kind || shift.status || "").toLowerCase();
    if (key === "confirmed" || key === "approved") return STATUS.confirmed;
    if (key === "pending") return STATUS.pending;
    if (key === "open" || key === "unfilled") return STATUS.open;
    return STATUS.draft;
  }

  function render(shift = {}, options = {}) {
    const kind = options.kind || "";
    const meta = resolveStatus(shift, kind);
    const name = meta.key === "open"
      ? (options.openLabel || "Open shift")
      : (shift.displayName || shift.assigneeName || "Staff");
    const selected = options.selected ? " is-selected" : "";
    const interactive = options.interactive !== false;
    const tag = interactive ? "button" : "article";
    const typeAttr = interactive ? ' type="button"' : "";
    const idAttr = shift.id ? ` data-shift-id="${esc(shift.id)}"` : "";
    return `<${tag}${typeAttr} class="assignment-card is-${meta.key}${selected}" data-status="${esc(meta.key)}"${idAttr} aria-label="${esc(`${name} ${formatTimeRange(shift)} ${meta.label}`)}">
      <div class="assignment-card-head">
        <span class="assignment-card-icon" aria-hidden="true">${iconSvg(meta.key === "open" ? "vacancy" : meta.icon)}</span>
        <strong class="assignment-card-name">${esc(name)}</strong>
      </div>
      <p class="assignment-card-time">${esc(formatTimeRange(shift))}</p>
      <p class="assignment-card-status"><span class="assignment-card-status-icon" aria-hidden="true">${iconSvg(meta.icon)}</span><span class="assignment-card-status-label">${esc(meta.label)}</span></p>
    </${tag}>`;
  }

  function viewMoreLink(hiddenCount = 0) {
    const n = Math.max(0, Number(hiddenCount) || 0);
    if (!n) return "";
    return `<button type="button" class="assignment-view-more" data-view-more="${n}">View more (${n})</button>`;
  }

  function kindFromShift(shift = {}) {
    const status = String(shift.status || "").toLowerCase() === "approved" ? "confirmed" : String(shift.status || "").toLowerCase();
    if (status === "cancelled" || status === "canceled" || status === "rejected" || status === "declined") {
      return status === "canceled" ? "cancelled" : status;
    }
    if (status === "open" || !String(shift.assigneeUid || shift.assigneeKey || "").trim()) return "open";
    if (status === "draft") return "draft";
    if (status === "pending") return "pending";
    if (status === "confirmed") return "confirmed";
    return status || "draft";
  }

  function pickVisible(assignments = [], {website = false} = {}) {
    const rows = Array.isArray(assignments) ? assignments.slice() : [];
    const pool = website
      ? rows.filter(row => kindFromShift(row) === "confirmed")
      : rows.filter(row => ["open", "draft", "pending", "confirmed"].includes(kindFromShift(row)));
    pool.sort((a, b) => {
      if (!website) {
        const order = {open: 0, draft: 1, pending: 2, confirmed: 3};
        const kind = (order[kindFromShift(a)] ?? 9) - (order[kindFromShift(b)] ?? 9);
        if (kind) return kind;
      }
      const time = Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0);
      if (time) return time;
      return String(a.assigneeName || a.displayName || "").localeCompare(String(b.assigneeName || b.displayName || ""));
    });
    return {visible: pool[0] || null, hiddenCount: Math.max(0, pool.length - (pool[0] ? 1 : 0)), pool};
  }

  return {
    STATUS,
    render,
    viewMoreLink,
    formatTimeRange,
    resolveStatus,
    kindFromShift,
    pickVisible
  };
});
