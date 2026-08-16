/* FLOQR read-only people × days week grid (Work Sheet + website embed). */
(function (global) {
  "use strict";

  const ROLE_CHIP = ["role-a", "role-b", "role-c", "role-d"];

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function startOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function weekDays(weekStart) {
    const start = weekStart instanceof Date ? weekStart : startOfWeek(new Date());
    return [0, 1, 2, 3, 4, 5, 6].map(n => addDays(start, n));
  }

  function sameDay(aMs, dayDate) {
    const a = new Date(aMs);
    return a.getFullYear() === dayDate.getFullYear()
      && a.getMonth() === dayDate.getMonth()
      && a.getDate() === dayDate.getDate();
  }

  function chipClass(roleLabel = "") {
    let hash = 0;
    const raw = String(roleLabel || "Shift");
    for (let i = 0; i < raw.length; i += 1) hash = (hash + raw.charCodeAt(i) * (i + 1)) % ROLE_CHIP.length;
    return ROLE_CHIP[hash];
  }

  function formatChipTime(shift) {
    const start = new Date(Number(shift.startsAtMs) || Date.parse(shift.startsAt) || 0);
    const end = new Date(Number(shift.endsAtMs) || Date.parse(shift.endsAt) || 0);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return `${shift.startsAtLabel || shift.startsAt || ""} → ${shift.endsAtLabel || shift.endsAt || ""}`.trim();
    }
    const opts = {hour: "numeric", minute: "2-digit"};
    return `${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`;
  }

  function initials(name = "") {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  }

  function shiftStatusKey(shift) {
    const status = String(shift?.status || "") === "approved" ? "confirmed" : String(shift?.status || "");
    return status || "pending";
  }

  function workerKey(worker = {}, shift = {}) {
    return String(worker.uid || worker.assigneeKey || shift.assigneeUid || shift.assigneeKey || "");
  }

  function workersFromShifts(shifts = []) {
    const map = new Map();
    (Array.isArray(shifts) ? shifts : []).forEach(shift => {
      const key = String(shift.assigneeKey || shift.assigneeUid || shift.assigneeName || "unassigned");
      if (map.has(key)) return;
      map.set(key, {
        uid: key,
        name: shift.assigneeName || "Staff",
        role: "Staff",
        photoURL: ""
      });
    });
    return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  function renderReadOnly({
    host,
    workers = [],
    shifts = [],
    weekStart,
    highlightUid = "",
    emptyMessage = "No published shifts this week."
  } = {}) {
    if (!host) return;
    const days = weekDays(weekStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = Array.isArray(workers) && workers.length ? workers : workersFromShifts(shifts);
    if (!rows.length) {
      host.innerHTML = `<p class="sub">${esc(emptyMessage)}</p>`;
      return;
    }
    const head = `
      <thead><tr>
        <th class="sched-person">Team</th>
        ${days.map(day => {
          const isToday = day.getTime() === today.getTime();
          return `<th class="sched-day-head${isToday ? " is-today" : ""}">${esc(day.toLocaleDateString([], {weekday: "short", month: "short", day: "numeric"}))}</th>`;
        }).join("")}
      </tr></thead>
    `;
    const body = rows.map(worker => {
      const isSelf = highlightUid && String(worker.uid) === String(highlightUid);
      const photo = worker.photoURL
        ? `<img class="sched-avatar" src="${esc(worker.photoURL)}" alt=""/>`
        : `<span class="sched-avatar initials">${esc(initials(worker.name))}</span>`;
      const cells = days.map(day => {
        const dayShifts = shifts.filter(shift => {
          const uid = String(shift.assigneeUid || shift.assigneeKey || "");
          return uid === String(worker.uid) && sameDay(Number(shift.startsAtMs || Date.parse(shift.startsAt) || 0), day);
        });
        const chips = dayShifts.map(shift => {
          const card = global.FLOQRAssignmentCard;
          const kind = card?.kindFromShift?.(shift) || shiftStatusKey(shift);
          if (card?.render) return card.render(shift, {kind, interactive: false});
          const statusClass = kind === "pending" ? "is-pending"
            : kind === "confirmed" ? "is-confirmed"
            : kind === "draft" ? "is-draft"
            : kind === "open" ? "is-open"
            : kind === "declined" ? "is-declined"
            : "";
          return `<div class="sched-chip ${chipClass(shift.roleLabel)} ${statusClass}">
            <strong>${esc(shift.roleLabel || "Shift")}</strong>
            <small>${esc(formatChipTime(shift))} · ${esc(kind)}</small>
          </div>`;
        }).join("");
        return `<td class="sched-cell">${chips || ""}</td>`;
      }).join("");
      return `<tr>
        <td class="sched-person${isSelf ? " is-self" : ""}">
          <div class="sched-person-btn" ${isSelf ? 'aria-current="true"' : ""}>
            ${photo}
            <span class="sched-person-meta">
              <strong>${esc(worker.name || "Worker")}${isSelf ? " · you" : ""}</strong>
              <small>${esc(worker.role || "Staff")}</small>
            </span>
          </div>
        </td>
        ${cells}
      </tr>`;
    }).join("");
    host.classList.add("is-readonly");
    host.innerHTML = `<table class="sched-grid">${head}<tbody>${body}</tbody></table>`;
  }

  global.FLOQRStaffWeekGrid = {
    esc,
    startOfWeek,
    addDays,
    weekDays,
    sameDay,
    formatChipTime,
    initials,
    workersFromShifts,
    workerKey,
    renderReadOnly
  };
})(window);
