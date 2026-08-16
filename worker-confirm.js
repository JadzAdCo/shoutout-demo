/* FLOQR worker shift confirm — checkboxes, select all, then Approve / Decline. */
(function (root) {
  "use strict";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pendingShifts(shifts = []) {
    return (Array.isArray(shifts) ? shifts : []).filter(row => {
      const status = String(row.status || "") === "approved" ? "confirmed" : String(row.status || "");
      return status === "pending";
    });
  }

  function render(host, {shifts = [], focusId = "", emptyMessage = "No shifts are waiting for your confirmation."} = {}) {
    if (!host) return [];
    const rows = pendingShifts(shifts);
    if (!rows.length) {
      host.innerHTML = `<p class="sub">${esc(emptyMessage)}</p>`;
      return [];
    }
    const card = root.FLOQRAssignmentCard;
    host.innerHTML = `
      <label class="worker-confirm-selectall"><input type="checkbox" data-worker-select-all/> Select all (${rows.length})</label>
      <div class="worker-confirm-list">
        ${rows.map(shift => {
          const checked = focusId && shift.id === focusId ? " checked" : "";
          const html = card?.render
            ? card.render(shift, {kind: "pending", interactive: false})
            : `<article class="assignment-card is-pending"><strong>${esc(shift.assigneeName || "You")}</strong><p>${esc(shift.startsAtLabel || "")} – ${esc(shift.endsAtLabel || "")}</p><p>Pending</p></article>`;
          return `<label class="worker-confirm-row${focusId === shift.id ? " is-focused" : ""}">
            <input type="checkbox" data-worker-shift="${esc(shift.id)}"${checked}/>
            ${html}
          </label>`;
        }).join("")}
      </div>
      <div class="queue-actions worker-confirm-actions">
        <button type="button" class="primary" data-worker-approve>Approve selected</button>
        <button type="button" data-worker-decline>Decline selected</button>
      </div>`;
    const selectAll = host.querySelector("[data-worker-select-all]");
    const boxes = () => Array.from(host.querySelectorAll("[data-worker-shift]"));
    selectAll?.addEventListener("change", () => {
      boxes().forEach(box => { box.checked = !!selectAll.checked; });
    });
    boxes().forEach(box => {
      box.addEventListener("change", () => {
        if (selectAll) selectAll.checked = boxes().every(item => item.checked);
      });
    });
    if (selectAll) selectAll.checked = boxes().length > 0 && boxes().every(item => item.checked);
    return rows;
  }

  function selectedIds(host) {
    if (!host) return [];
    return Array.from(host.querySelectorAll("[data-worker-shift]:checked"))
      .map(input => String(input.getAttribute("data-worker-shift") || "").trim())
      .filter(Boolean);
  }

  function bind(host, {onApprove, onDecline} = {}) {
    if (!host) return;
    host.querySelector("[data-worker-approve]")?.addEventListener("click", () => onApprove?.(selectedIds(host)));
    host.querySelector("[data-worker-decline]")?.addEventListener("click", () => onDecline?.(selectedIds(host)));
  }

  root.FLOQRWorkerConfirm = {pendingShifts, render, selectedIds, bind};
})(typeof window !== "undefined" ? window : globalThis);
