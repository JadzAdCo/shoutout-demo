/* FLOQR Club Admin — Staff Scheduling week grid (Manual + Round Robin). */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const locationId = String(params.get("location") || params.get("club") || "").trim();
  if (!window.firebase || !byId("panelScheduling")) return;

  let auth;
  let db;
  try {
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (_error) {
    return;
  }

  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
  const ROLE_CHIP = ["role-a", "role-b", "role-c", "role-d"];

  const state = {
    workers: [],
    shifts: [],
    weekStart: startOfWeek(new Date()),
    mode: "manual",
    applyDays: new Set([0, 1, 2, 3, 4, 5, 6]),
    rrDays: new Set([1, 2, 3, 4, 5]),
    assignContext: null,
    rrCursor: 0,
    venue: null
  };

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function setStatus(message) {
    const el = byId("schedulingStatus");
    if (el) el.textContent = message || "";
  }

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

  function sameDay(aMs, dayDate) {
    const a = new Date(aMs);
    return a.getFullYear() === dayDate.getFullYear()
      && a.getMonth() === dayDate.getMonth()
      && a.getDate() === dayDate.getDate();
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toLocalInputValue(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function combineDayAndTime(dayDate, timeValue, endNextDay = false) {
    const [hh, mm] = String(timeValue || "18:00").split(":").map(Number);
    const d = new Date(dayDate);
    d.setHours(hh || 0, mm || 0, 0, 0);
    if (endNextDay) d.setDate(d.getDate() + 1);
    return d;
  }

  function defaultEndIsNextDay(startTime, endTime) {
    const [sh, sm] = String(startTime || "18:00").split(":").map(Number);
    const [eh, em] = String(endTime || "02:00").split(":").map(Number);
    return (eh * 60 + (em || 0)) <= (sh * 60 + (sm || 0));
  }

  function weekDays() {
    return Array.from({length: 7}, (_, i) => addDays(state.weekStart, i));
  }

  function weekRangeMs() {
    const start = state.weekStart.getTime();
    return {weekStartMs: start, weekEndMs: start + 7 * 24 * 60 * 60 * 1000};
  }

  function isPaidAccess(access) {
    if (!access) return false;
    const flag = access.staffSchedulingPaid ?? access.paid;
    if (flag === 1 || flag === "1" || flag === true) return true;
    if (flag === 0 || flag === "0" || flag === false) return false;
    return access.subscribed === true;
  }

  async function readOrSeedVenuePaidFlag() {
    if (!locationId || !db) return null;
    const ref = db.collection("clubLocations").doc(locationId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const raw = snap.data()?.staffSchedulingPaid;
    if (raw === 0 || raw === "0" || raw === false) return 0;
    if (raw === 1 || raw === "1" || raw === true) return 1;
    try {
      await ref.set({
        staffSchedulingPaid: 1,
        schedulingEntitlementSource: "demo",
        schedulingPaidUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      return 1;
    } catch (_error) {
      return null;
    }
  }

  async function loadAccess() {
    if (!locationId || !auth.currentUser) return null;
    const result = await callable("getSchedulingAccess")({
      ownerType: "club",
      ownerId: locationId
    });
    return result?.data || null;
  }

  function venueApi() {
    return window.FLOQRVenueCalendar;
  }

  async function loadVenueHours() {
    if (!locationId || !db) return null;
    try {
      const snap = await db.collection("clubLocations").doc(locationId).get();
      state.venue = snap.exists ? (snap.data() || {}) : {};
    } catch (_error) {
      state.venue = {};
    }
    applyVenueDefaultsToControls();
    return state.venue;
  }

  function applyVenueDefaultsToControls() {
    const api = venueApi();
    const venue = state.venue || {};
    if (!api) return;
    const openIdx = api.openDayIndexes(venue);
    state.rrDays = new Set(openIdx);
    renderDayPills("schedRrDays", state.rrDays);

    // Pick next open day in the visible week (or first open weekday) for default times
    const days = weekDays();
    let windowInfo = null;
    for (const day of days) {
      const win = api.staffWindowForDate(venue, day);
      if (!win.closed) {
        windowInfo = win;
        break;
      }
    }
    if (!windowInfo) {
      const probe = days[openIdx[0] || 5] || days[0];
      windowInfo = api.staffWindowForDate(venue, probe);
    }
    if (windowInfo && !windowInfo.closed) {
      if (byId("schedDefaultStart") && windowInfo.start) byId("schedDefaultStart").value = windowInfo.start;
      if (byId("schedDefaultEnd") && windowInfo.end) byId("schedDefaultEnd").value = windowInfo.end;
    }
    const hint = byId("schedVenueWindowHint");
    if (hint) {
      if (windowInfo && !windowInfo.closed) {
        hint.textContent = `Staff window from venue hours: open ${windowInfo.open} (−2h → ${windowInfo.start}) through close ${windowInfo.close} (+1h → ${windowInfo.end}). Apply-to days follow club open nights.`;
      } else {
        hint.textContent = "Venue closed this week (or hours not set). Set Venue opening hours on Club Public Profile, or enter times manually.";
      }
    }
    renderHolidayLegend();
  }

  function renderHolidayLegend() {
    const host = byId("schedHolidayLegend");
    const api = venueApi();
    if (!host || !api) return;
    const days = weekDays();
    const holidays = api.holidaysInRange(state.venue?.country || "United States", days[0], days[6]);
    if (!holidays.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = `<span class="tag">Public holidays</span> ${holidays.map(h =>
      `<span class="tag sched-holiday-tag">${esc(h.date)} · ${esc(h.name)}</span>`
    ).join(" ")}`;
  }

  function staffTimesForDay(dayDate) {
    const api = venueApi();
    if (api && state.venue) {
      const win = api.staffWindowForDate(state.venue, dayDate);
      if (!win.closed && win.start && win.end) return {start: win.start, end: win.end, closed: false};
      if (win.closed) return {start: "", end: "", closed: true};
    }
    return {
      start: byId("schedDefaultStart")?.value || "18:00",
      end: byId("schedDefaultEnd")?.value || "02:00",
      closed: false
    };
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
      return `${shift.startsAtLabel || ""} → ${shift.endsAtLabel || ""}`.trim();
    }
    const opts = {hour: "numeric", minute: "2-digit"};
    return `${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`;
  }

  function initials(name = "") {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  }

  function publicProfileHref(worker) {
    const handle = String(worker.username || worker.floqrHandle || "").replace(/^@/, "").trim();
    const v = "29.09.101";
    if (handle) return `./?v=${v}&start=mingl&q=${encodeURIComponent(handle)}`;
    if (worker.uid) return `./services.html?v=${v}&q=${encodeURIComponent(worker.name || worker.email || worker.uid)}`;
    return `./services.html?v=${v}`;
  }

  function mainPhoto(user = {}) {
    const slotPhoto = Array.isArray(user.profileMediaSlots)
      && user.profileMediaSlots.find(slot => slot && slot.url && String(slot.type || "image").toLowerCase() !== "video")?.url;
    return user.photoURL
      || user.profilePhotoUrl
      || user.publicPhotoUrl
      || user.avatarUrl
      || user.photoUrl
      || slotPhoto
      || (Array.isArray(user.publicMedia) && user.publicMedia[0]?.url)
      || (Array.isArray(user.media) && user.media.find(m => m?.kind === "photo" || m?.type === "image")?.url)
      || "";
  }

  function renderDayPills(containerId, selectedSet) {
    const el = byId(containerId);
    if (!el) return;
    el.innerHTML = DAY_LABELS.map((label, idx) =>
      `<button type="button" class="sched-day-pill ${selectedSet.has(idx) ? "active" : ""}" data-day="${idx}" aria-pressed="${selectedSet.has(idx)}">${label}</button>`
    ).join("");
  }

  function bindDayPills(containerId, selectedSet) {
    byId(containerId)?.addEventListener("click", event => {
      const btn = event.target.closest("[data-day]");
      if (!btn) return;
      const day = Number(btn.dataset.day);
      if (selectedSet.has(day)) selectedSet.delete(day);
      else selectedSet.add(day);
      renderDayPills(containerId, selectedSet);
    });
  }

  function updateWeekLabel() {
    const days = weekDays();
    const label = byId("schedWeekLabel");
    if (!label || !days.length) return;
    const fmt = {month: "short", day: "numeric", year: "numeric"};
    label.textContent = `${days[0].toLocaleDateString([], fmt)} → ${days[6].toLocaleDateString([], fmt)}`;
  }

  function updateDraftCount() {
    const {weekStartMs, weekEndMs} = weekRangeMs();
    const drafts = state.shifts.filter(s =>
      String(s.status || "") === "draft"
      && Number(s.startsAtMs || 0) >= weekStartMs
      && Number(s.startsAtMs || 0) < weekEndMs
    );
    const el = byId("schedDraftCount");
    if (el) el.textContent = `${drafts.length} draft${drafts.length === 1 ? "" : "s"} this week`;
  }

  function setMode(mode) {
    state.mode = mode === "roundRobin" ? "roundRobin" : "manual";
    byId("schedModeManualBtn")?.classList.toggle("active", state.mode === "manual");
    byId("schedModeRrBtn")?.classList.toggle("active", state.mode === "roundRobin");
    byId("schedRoundRobinPanel")?.classList.toggle("hidden", state.mode !== "roundRobin");
  }

  function closeWorkerPopout() {
    const pop = byId("scheduleWorkerPopout");
    if (pop) {
      pop.classList.add("hidden");
      pop.innerHTML = "";
    }
  }

  function openWorkerPopout(worker, anchorEl) {
    const pop = byId("scheduleWorkerPopout");
    if (!pop || !worker) return;
    const phone = String(worker.phone || "").trim();
    const email = String(worker.email || "").trim();
    const handle = String(worker.username || worker.floqrHandle || "").replace(/^@/, "");
    const photo = worker.photoURL || "";
    const profileHref = publicProfileHref(worker);
    pop.innerHTML = `
      <div class="pop-head">
        ${photo
          ? `<img class="sched-avatar" src="${esc(photo)}" alt=""/>`
          : `<span class="sched-avatar initials">${esc(initials(worker.name))}</span>`}
        <div>
          <strong>${esc(worker.name || "Worker")}</strong>
          <small>${esc(worker.role || "Staff")}${handle ? ` · @${esc(handle)}` : ""}</small>
        </div>
      </div>
      <div class="report-table">
        <div><span>SMS / phone</span><strong>${phone ? esc(phone) : "—"}</strong></div>
        <div><span>Email</span><strong>${email ? esc(email) : "—"}</strong></div>
      </div>
      <div class="pop-actions">
        ${phone ? `<a class="buttonlike" href="sms:${esc(phone)}">SMS</a><a class="buttonlike" href="tel:${esc(phone)}">Call</a>` : ""}
        ${email ? `<a class="buttonlike" href="mailto:${esc(email)}">Email</a>` : ""}
        <a class="buttonlike primary" href="${esc(profileHref)}" target="_blank" rel="noopener">Public profile</a>
        <button type="button" id="schedPopoutCloseBtn" class="ghost">Close</button>
      </div>
    `;
    pop.classList.remove("hidden");
    const rect = anchorEl?.getBoundingClientRect?.() || {left: 24, bottom: 120, top: 80};
    const top = Math.min(window.innerHeight - 20, Math.max(12, rect.bottom + 8));
    const left = Math.min(window.innerWidth - 340, Math.max(12, rect.left));
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    byId("schedPopoutCloseBtn")?.addEventListener("click", closeWorkerPopout, {once: true});
  }

  function openAssignModal({worker = null, day = null, shift = null} = {}) {
    const modal = byId("scheduleAssignModal");
    if (!modal) return;
    state.assignContext = {worker, day, shift};
    const title = byId("scheduleAssignTitle");
    if (title) title.textContent = shift ? "Edit / replace shift" : "Assign shift";

    if (worker?.uid && byId("scheduleAssignee")) {
      byId("scheduleAssignee").value = worker.uid;
    }
    const role = byId("scheduleRole");
    if (role) role.value = shift?.roleLabel || byId("schedDefaultRole")?.value || worker?.role || "Shift";

    const startTime = byId("schedDefaultStart")?.value || "18:00";
    const endTime = byId("schedDefaultEnd")?.value || "02:00";
    const baseDay = day || (shift?.startsAtMs ? new Date(Number(shift.startsAtMs)) : new Date());
    const dayTimes = staffTimesForDay(baseDay);
    const useStart = (!shift && dayTimes.start) ? dayTimes.start : startTime;
    const useEnd = (!shift && dayTimes.end) ? dayTimes.end : endTime;
    const startDate = shift?.startsAt
      ? new Date(shift.startsAt)
      : combineDayAndTime(baseDay, useStart, false);
    const endDate = shift?.endsAt
      ? new Date(shift.endsAt)
      : combineDayAndTime(baseDay, useEnd, defaultEndIsNextDay(useStart, useEnd));
    if (byId("scheduleStartsAt")) byId("scheduleStartsAt").value = toLocalInputValue(startDate);
    if (byId("scheduleEndsAt")) byId("scheduleEndsAt").value = toLocalInputValue(endDate);
    if (!shift && dayTimes.start && byId("schedDefaultStart")) byId("schedDefaultStart").value = dayTimes.start;
    if (!shift && dayTimes.end && byId("schedDefaultEnd")) byId("schedDefaultEnd").value = dayTimes.end;
    if (byId("scheduleNotes")) byId("scheduleNotes").value = shift?.notes || "";
    if (byId("scheduleRequireApproval")) {
      byId("scheduleRequireApproval").checked = shift
        ? shift.requireApproval !== false
        : byId("schedRequireApproval")?.checked !== false;
    }
    if (byId("scheduleSaveAsDraft")) byId("scheduleSaveAsDraft").checked = !shift || String(shift.status) === "draft";

    const deleteBtn = byId("scheduleDeleteShiftBtn");
    if (deleteBtn) {
      const canDelete = !!(shift?.id && ["draft", "pending", "declined"].includes(String(shift.status || "")));
      deleteBtn.classList.toggle("hidden", !canDelete);
    }

    state.applyDays = new Set([baseDay.getDay()]);
    renderDayPills("schedApplyDays", state.applyDays);
    modal.classList.remove("hidden");
  }

  function closeAssignModal() {
    byId("scheduleAssignModal")?.classList.add("hidden");
    state.assignContext = null;
  }

  function renderGrid() {
    const host = byId("scheduleWeekGrid");
    if (!host) return;
    updateWeekLabel();
    updateDraftCount();
    renderHolidayLegend();
    const days = weekDays();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!state.workers.length) {
      host.innerHTML = "<p class='sub'>No elected workers yet. Elect staff under Employees, then refresh.</p>";
      return;
    }

    const head = `
      <thead><tr>
        <th class="sched-person">Team</th>
        ${days.map(day => {
          const isToday = day.getTime() === today.getTime();
          const holiday = venueApi()?.holidayOn?.(state.venue?.country || "US", day);
          const closed = staffTimesForDay(day).closed;
          const classes = [
            isToday ? "is-today" : "",
            holiday ? "is-holiday" : "",
            closed ? "is-venue-closed" : ""
          ].filter(Boolean).join(" ");
          const title = [
            holiday ? holiday.name : "",
            closed ? "Venue closed" : ""
          ].filter(Boolean).join(" · ");
          return `<th class="${classes}" title="${esc(title)}">${esc(day.toLocaleDateString([], {weekday: "short", month: "short", day: "numeric"}))}${holiday ? `<small class="sched-holiday-mark">${esc(holiday.name)}</small>` : ""}${closed && !holiday ? `<small class="sched-closed-mark">Closed</small>` : ""}</th>`;
        }).join("")}
      </tr></thead>
    `;

    const body = state.workers.map(worker => {
      const photo = worker.photoURL
        ? `<img class="sched-avatar" src="${esc(worker.photoURL)}" alt=""/>`
        : `<span class="sched-avatar initials">${esc(initials(worker.name))}</span>`;
      const cells = days.map((day, dayIdx) => {
        const dayShifts = state.shifts.filter(s =>
          String(s.assigneeUid || "") === worker.uid && sameDay(Number(s.startsAtMs || Date.parse(s.startsAt) || 0), day)
        );
        const chips = dayShifts.map(shift => `
          <button type="button" class="sched-chip ${chipClass(shift.roleLabel)} ${String(shift.status) === "draft" ? "is-draft" : ""}"
            data-shift-id="${esc(shift.id)}" data-uid="${esc(worker.uid)}" data-day="${dayIdx}">
            <strong>${esc(shift.roleLabel || "Shift")}</strong>
            <small>${esc(formatChipTime(shift))} · ${esc(shift.status || "")}</small>
          </button>
        `).join("");
        return `<td class="sched-cell" data-uid="${esc(worker.uid)}" data-day="${dayIdx}">
          ${chips}
          <button type="button" class="sched-cell-add" data-add-uid="${esc(worker.uid)}" data-day="${dayIdx}">+</button>
        </td>`;
      }).join("");
      return `<tr>
        <td class="sched-person">
          <button type="button" class="sched-person-btn" data-worker-uid="${esc(worker.uid)}">
            ${photo}
            <span class="sched-person-meta">
              <strong>${esc(worker.name || "Worker")}</strong>
              <small>${esc(worker.role || "Staff")}</small>
            </span>
          </button>
        </td>
        ${cells}
      </tr>`;
    }).join("");

    host.innerHTML = `<table class="sched-grid">${head}<tbody>${body}</tbody></table>`;
  }

  async function refreshSubscriptionUi() {
    const gate = byId("schedulingSubscribeGate");
    const workspace = byId("schedulingWorkspace");
    const badge = byId("schedulingSubBadge");
    const buyBtn = byId("buySchedulingSubBtn");
    const portalLink = byId("openSchedulingPortalLink");
    const gateTitle = byId("schedulingSubscribeTitle");
    const gateCopy = byId("schedulingSubscribeCopy");
    try {
      const venuePaid = await readOrSeedVenuePaidFlag();
      let access = null;
      try {
        access = await loadAccess();
      } catch (error) {
        setStatus(error?.message || String(error));
      }
      let paid = isPaidAccess(access);
      if (venuePaid === 1) paid = true;
      if (venuePaid === 0) paid = false;
      const monthStatus = access?.monthStatus || access?.status || (paid ? "paid this month" : "not paid this month");
      const ever = access?.everSubscribed === true || access?.cta === "resubscribe";
      const cta = paid ? "none" : (access?.cta || (ever ? "resubscribe" : "subscribe"));
      if (badge) {
        badge.textContent = paid
          ? `staffSchedulingPaid=1 · ${monthStatus}`
          : `staffSchedulingPaid=0 · ${monthStatus}`;
      }
      if (gate) gate.classList.toggle("hidden", paid);
      if (workspace) workspace.classList.toggle("hidden", !paid);
      if (buyBtn) {
        buyBtn.classList.toggle("hidden", paid);
        buyBtn.textContent = cta === "resubscribe" ? "Resubscribe $20/mo" : "Subscribe $20/mo";
      }
      if (gateTitle) {
        gateTitle.textContent = cta === "resubscribe"
          ? "Resubscribe · $20 / month"
          : "Subscribe · $20 / month";
      }
      if (gateCopy) {
        gateCopy.innerHTML = cta === "resubscribe"
          ? "This venue was subscribed before, but status is <code>not paid this month</code> (<code>staffSchedulingPaid=0</code>). Resubscribe to set <code>paid this month</code> and unlock the calendar."
          : "Unlock Staff Scheduling for this venue. Checkout sets <code>staffSchedulingPaid=1</code> and subscription status to <code>paid this month</code>.";
      }
      if (portalLink) {
        portalLink.classList.toggle("hidden", !paid);
        portalLink.textContent = "Open full calendar / Scheduling portal";
      }
      setStatus(
        paid
          ? `Calendar unlocked · ${monthStatus} (staffSchedulingPaid=1).`
          : `${cta === "resubscribe" ? "Resubscribe" : "Subscribe"} required · ${monthStatus} (staffSchedulingPaid=0).`
      );
      if (paid) await Promise.all([loadVenueHours(), loadWorkers(), loadShifts()]);
    } catch (error) {
      setStatus(error?.message || String(error));
    }
  }

  async function startSubscription() {
    setStatus("Opening $20/month Staff Scheduling checkout…");
    if (!locationId) throw new Error("Add ?location=<club-id> to the Club Admin URL.");
    if (!window.FLOQRPayments?.startCheckout) throw new Error("Stripe checkout is not loaded.");
    const clubName = byId("clubName")?.textContent || locationId;
    await window.FLOQRPayments.startCheckout({
      orderType: "staffSchedulingSubscription",
      payload: {
        ownerType: "club",
        ownerId: locationId,
        clubLocationId: locationId,
        ownerName: clubName
      },
      status: setStatus
    });
  }

  async function loadWorkers() {
    const select = byId("scheduleAssignee");
    if (!locationId) return;
    const snap = await db.collection("clubEmployeeDesignations")
      .where("clubLocationId", "==", locationId)
      .limit(200)
      .get();

    const rows = [];
    snap.docs.forEach(doc => {
      const row = doc.data() || {};
      if (String(row.status || "").toLowerCase() === "rejected") return;
      const uid = row.workerUid || "";
      if (!uid) return;
      rows.push({
        uid,
        name: row.workerName || row.workerEmail || uid,
        email: row.workerEmail || "",
        username: row.workerUsername || "",
        role: row.roleElectionType || (row.workerRoles || [])[0] || "Worker",
        phone: "",
        photoURL: ""
      });
    });

    await Promise.all(rows.map(async worker => {
      try {
        const userSnap = await db.collection("users").doc(worker.uid).get();
        if (!userSnap.exists) return;
        const user = userSnap.data() || {};
        worker.name = user.displayName || user.fullName || worker.name;
        worker.email = user.email || worker.email;
        worker.username = user.username || user.floqrHandle || worker.username;
        worker.floqrHandle = user.floqrHandle || "";
        worker.phone = user.phone || user.phoneNumber || user.mobile || "";
        worker.photoURL = mainPhoto(user);
        if (!worker.role && Array.isArray(user.approvedRoles) && user.approvedRoles[0]) {
          worker.role = user.approvedRoles[0];
        }
      } catch (_error) {}
    }));

    state.workers = rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    if (select) {
      const options = ['<option value="">Select worker</option>'];
      state.workers.forEach(worker => {
        options.push(
          `<option value="${esc(worker.uid)}" data-name="${esc(worker.name)}" data-email="${esc(worker.email)}" data-phone="${esc(worker.phone)}" data-role="${esc(worker.role)}">${esc(worker.name)} · ${esc(worker.role)}</option>`
        );
      });
      select.innerHTML = options.join("");
    }
    renderGrid();
  }

  async function loadShifts() {
    if (!locationId) return;
    const result = await callable("listScheduleShifts")({
      ownerType: "club",
      ownerId: locationId
    });
    state.shifts = result?.data?.shifts || [];
    renderGrid();
  }

  async function createShiftPayload({
    assigneeUid,
    assigneeName,
    assigneeEmail,
    assigneePhone,
    roleLabel,
    startsAt,
    endsAt,
    notes,
    asDraft,
    requireApproval,
    assignMode
  }) {
    return callable("createScheduleShift")({
      ownerType: "club",
      ownerId: locationId,
      ownerName: byId("clubName")?.textContent || locationId,
      assigneeUid,
      assigneeName,
      assigneeEmail,
      assigneePhone,
      roleLabel,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      notes,
      venueName: byId("clubName")?.textContent || "",
      asDraft: !!asDraft,
      notify: !asDraft,
      requireApproval: !!requireApproval,
      assignMode: assignMode || "manual"
    });
  }

  async function createShift() {
    const select = byId("scheduleAssignee");
    const option = select?.selectedOptions?.[0];
    const assigneeUid = select?.value || "";
    if (!assigneeUid) throw new Error("Choose a worker for this shift.");
    const startsAt = byId("scheduleStartsAt")?.value;
    const endsAt = byId("scheduleEndsAt")?.value;
    if (!startsAt || !endsAt) throw new Error("Set shift start and end.");
    const asDraft = byId("scheduleSaveAsDraft")?.checked !== false;
    const requireApproval = byId("scheduleRequireApproval")?.checked !== false;
    const roleLabel = byId("scheduleRole")?.value?.trim() || option?.dataset?.role || "Shift";
    const notes = byId("scheduleNotes")?.value?.trim() || "";
    const worker = state.workers.find(w => w.uid === assigneeUid);
    const applyDays = state.applyDays.size ? [...state.applyDays] : [new Date(startsAt).getDay()];

    const startLocal = new Date(startsAt);
    const endLocal = new Date(endsAt);
    const durationMs = endLocal.getTime() - startLocal.getTime();
    if (!(durationMs > 0)) throw new Error("Shift end must be after start.");

    setStatus(asDraft ? "Saving draft shift(s)…" : "Creating shift and notifying…");
    if (state.assignContext?.shift?.id && ["draft", "pending", "declined"].includes(String(state.assignContext.shift.status || ""))) {
      try {
        await callable("deleteScheduleShift")({shiftId: state.assignContext.shift.id});
      } catch (_error) {}
    }
    let created = 0;
    for (const dayIdx of applyDays.sort((a, b) => a - b)) {
      const day = weekDays()[dayIdx] || addDays(state.weekStart, dayIdx);
      const dayStart = new Date(day);
      dayStart.setHours(startLocal.getHours(), startLocal.getMinutes(), 0, 0);
      const dayEnd = new Date(dayStart.getTime() + durationMs);
      await createShiftPayload({
        assigneeUid,
        assigneeName: option?.dataset?.name || worker?.name || option?.textContent || "",
        assigneeEmail: option?.dataset?.email || worker?.email || "",
        assigneePhone: option?.dataset?.phone || worker?.phone || "",
        roleLabel,
        startsAt: dayStart,
        endsAt: dayEnd,
        notes,
        asDraft,
        requireApproval,
        assignMode: "manual"
      });
      created += 1;
    }
    setStatus(asDraft
      ? `Saved ${created} draft shift${created === 1 ? "" : "s"}. Publish when ready.`
      : `Saved ${created} shift${created === 1 ? "" : "s"} and queued notify where enabled.`);
    if (byId("scheduleNotes")) byId("scheduleNotes").value = "";
    closeAssignModal();
    await loadShifts();
  }

  async function publishWeek() {
    const {weekStartMs, weekEndMs} = weekRangeMs();
    const drafts = state.shifts.filter(s =>
      String(s.status || "") === "draft"
      && Number(s.startsAtMs || 0) >= weekStartMs
      && Number(s.startsAtMs || 0) < weekEndMs
    );
    if (!drafts.length) throw new Error("No draft shifts in this week to publish.");
    if (!window.confirm(`Publish ${drafts.length} draft shift${drafts.length === 1 ? "" : "s"} and notify workers?`)) return;
    setStatus("Publishing schedule…");
    const result = await callable("publishScheduleShifts")({
      ownerType: "club",
      ownerId: locationId,
      weekStartMs,
      weekEndMs
    });
    setStatus(`Published ${result?.data?.published || 0} shift(s). Workers notified when channels are enabled.`);
    await loadShifts();
  }

  function eligibleForRoundRobin(roleFilter = "") {
    const filter = String(roleFilter || "").trim().toLowerCase();
    let pool = state.workers.slice();
    if (filter) {
      pool = pool.filter(w =>
        String(w.role || "").toLowerCase().includes(filter)
        || filter.includes(String(w.role || "").toLowerCase())
      );
    }
    if (!pool.length) pool = state.workers.slice();
    const {weekStartMs, weekEndMs} = weekRangeMs();
    return pool
      .map(worker => {
        const count = state.shifts.filter(s =>
          String(s.assigneeUid || "") === worker.uid
          && Number(s.startsAtMs || 0) >= weekStartMs
          && Number(s.startsAtMs || 0) < weekEndMs
          && String(s.status || "") !== "declined"
        ).length;
        const last = state.shifts
          .filter(s => String(s.assigneeUid || "") === worker.uid)
          .reduce((max, s) => Math.max(max, Number(s.startsAtMs || 0)), 0);
        return {...worker, weekCount: count, lastAssignedMs: last};
      })
      .sort((a, b) =>
        (a.weekCount - b.weekCount)
        || (a.lastAssignedMs - b.lastAssignedMs)
        || String(a.name).localeCompare(String(b.name))
      );
  }

  async function roundRobinFill() {
    const pool = eligibleForRoundRobin(byId("schedRrRoleFilter")?.value || "");
    if (!pool.length) throw new Error("No workers available for Round Robin.");
    const days = [...state.rrDays].sort((a, b) => a - b);
    if (!days.length) throw new Error("Select at least one day to fill.");
    const roleLabel = byId("schedDefaultRole")?.value?.trim() || byId("schedRrRoleFilter")?.value?.trim() || "Shift";
    const requireApproval = byId("schedRequireApproval")?.checked !== false;

    setStatus("Round Robin filling drafts…");
    let created = 0;
    let cursor = state.rrCursor % pool.length;
    const rotating = pool.slice();
    for (const dayIdx of days) {
      const day = weekDays()[dayIdx];
      if (!day) continue;
      const dayTimes = staffTimesForDay(day);
      if (dayTimes.closed) continue;
      const startTime = dayTimes.start || byId("schedDefaultStart")?.value || "18:00";
      const endTime = dayTimes.end || byId("schedDefaultEnd")?.value || "02:00";
      const overnight = defaultEndIsNextDay(startTime, endTime);
      const already = state.shifts.some(s =>
        sameDay(Number(s.startsAtMs || 0), day)
        && String(s.roleLabel || "").toLowerCase() === roleLabel.toLowerCase()
        && String(s.status || "") !== "declined"
      );
      if (already) continue;
      const worker = rotating[cursor % rotating.length];
      cursor += 1;
      const startsAt = combineDayAndTime(day, startTime, false);
      const endsAt = combineDayAndTime(day, endTime, overnight);
      await createShiftPayload({
        assigneeUid: worker.uid,
        assigneeName: worker.name,
        assigneeEmail: worker.email,
        assigneePhone: worker.phone,
        roleLabel,
        startsAt,
        endsAt,
        notes: "Round Robin auto-fill",
        asDraft: true,
        requireApproval,
        assignMode: "roundRobin"
      });
      created += 1;
      worker.weekCount += 1;
      rotating.sort((a, b) =>
        (a.weekCount - b.weekCount)
        || (a.lastAssignedMs - b.lastAssignedMs)
        || String(a.name).localeCompare(String(b.name))
      );
      cursor = 0;
    }
    state.rrCursor = cursor;
    setStatus(created
      ? `Round Robin created ${created} draft shift${created === 1 ? "" : "s"}. Review the grid, then Publish.`
      : "No new slots filled (days may be closed or already have that role).");
    await loadShifts();
  }

  async function copyPreviousWeek() {
    const prevStart = addDays(state.weekStart, -7);
    const prevEnd = state.weekStart.getTime();
    const prevShifts = state.shifts.filter(s => {
      const ms = Number(s.startsAtMs || 0);
      return ms >= prevStart.getTime() && ms < prevEnd && String(s.status || "") !== "declined";
    });
    if (!prevShifts.length) throw new Error("No shifts found in the previous week to copy.");
    if (!window.confirm(`Copy ${prevShifts.length} shift(s) from the previous week into this week as drafts?`)) return;
    setStatus("Copying previous week into drafts…");
    let created = 0;
    for (const shift of prevShifts) {
      const start = new Date(Number(shift.startsAtMs || Date.parse(shift.startsAt)));
      const end = new Date(Number(shift.endsAtMs || Date.parse(shift.endsAt)));
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
      const nextStart = addDays(start, 7);
      const nextEnd = addDays(end, 7);
      await createShiftPayload({
        assigneeUid: shift.assigneeUid,
        assigneeName: shift.assigneeName,
        assigneeEmail: shift.assigneeEmail,
        assigneePhone: shift.assigneePhone,
        roleLabel: shift.roleLabel || "Shift",
        startsAt: nextStart,
        endsAt: nextEnd,
        notes: shift.notes ? `${shift.notes} (copied)` : "Copied from previous week",
        asDraft: true,
        requireApproval: shift.requireApproval !== false,
        assignMode: "copyPreviousWeek"
      });
      created += 1;
    }
    setStatus(`Copied ${created} draft shift${created === 1 ? "" : "s"} from previous week.`);
    await loadShifts();
  }

  async function deleteShift(shiftId) {
    if (!shiftId) return;
    if (!window.confirm("Delete this shift?")) return;
    setStatus("Deleting shift…");
    await callable("deleteScheduleShift")({shiftId});
    setStatus("Shift deleted.");
    await loadShifts();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderDayPills("schedApplyDays", state.applyDays);
    renderDayPills("schedRrDays", state.rrDays);
    bindDayPills("schedApplyDays", state.applyDays);
    bindDayPills("schedRrDays", state.rrDays);
    setMode("manual");
    updateWeekLabel();

    byId("buySchedulingSubBtn")?.addEventListener("click", () => {
      startSubscription().catch(error => setStatus(error.message));
    });
    byId("createScheduleShiftBtn")?.addEventListener("click", () => {
      createShift().catch(error => setStatus(error.message));
    });
    byId("scheduleAssignCancelBtn")?.addEventListener("click", closeAssignModal);
    byId("scheduleDeleteShiftBtn")?.addEventListener("click", () => {
      const shiftId = state.assignContext?.shift?.id;
      if (!shiftId) return;
      deleteShift(shiftId)
        .then(() => closeAssignModal())
        .catch(error => setStatus(error.message));
    });
    byId("refreshSchedulingBtn")?.addEventListener("click", () => {
      refreshSubscriptionUi().catch(error => setStatus(error.message));
    });
    byId("schedRefreshGridBtn")?.addEventListener("click", () => {
      Promise.all([loadVenueHours(), loadWorkers(), loadShifts()]).catch(error => setStatus(error.message));
    });
    byId("schedCopyPrevWeekBtn")?.addEventListener("click", () => {
      copyPreviousWeek().catch(error => setStatus(error.message));
    });
    byId("schedPublishBtn")?.addEventListener("click", () => {
      publishWeek().catch(error => setStatus(error.message));
    });
    byId("schedRrFillBtn")?.addEventListener("click", () => {
      roundRobinFill().catch(error => setStatus(error.message));
    });
    byId("schedModeManualBtn")?.addEventListener("click", () => setMode("manual"));
    byId("schedModeRrBtn")?.addEventListener("click", () => setMode("roundRobin"));
    byId("schedPrevWeekBtn")?.addEventListener("click", () => {
      state.weekStart = addDays(state.weekStart, -7);
      applyVenueDefaultsToControls();
      renderGrid();
    });
    byId("schedNextWeekBtn")?.addEventListener("click", () => {
      state.weekStart = addDays(state.weekStart, 7);
      applyVenueDefaultsToControls();
      renderGrid();
    });
    byId("schedTodayWeekBtn")?.addEventListener("click", () => {
      state.weekStart = startOfWeek(new Date());
      applyVenueDefaultsToControls();
      renderGrid();
    });

    byId("scheduleWeekGrid")?.addEventListener("click", event => {
      const personBtn = event.target.closest("[data-worker-uid]");
      if (personBtn) {
        const worker = state.workers.find(w => w.uid === personBtn.dataset.workerUid);
        openWorkerPopout(worker, personBtn);
        return;
      }
      const addBtn = event.target.closest("[data-add-uid]");
      if (addBtn) {
        const worker = state.workers.find(w => w.uid === addBtn.dataset.addUid);
        const day = weekDays()[Number(addBtn.dataset.day)] || state.weekStart;
        openAssignModal({worker, day});
        return;
      }
      const chip = event.target.closest("[data-shift-id]");
      if (chip) {
        const shift = state.shifts.find(s => s.id === chip.dataset.shiftId);
        const worker = state.workers.find(w => w.uid === chip.dataset.uid);
        const day = weekDays()[Number(chip.dataset.day)] || state.weekStart;
        openAssignModal({worker, day, shift});
      }
    });

    byId("scheduleAssignModal")?.addEventListener("click", event => {
      if (event.target === byId("scheduleAssignModal")) closeAssignModal();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeAssignModal();
        closeWorkerPopout();
      }
    });

    document.addEventListener("click", event => {
      const pop = byId("scheduleWorkerPopout");
      if (!pop || pop.classList.contains("hidden")) return;
      if (pop.contains(event.target) || event.target.closest?.("[data-worker-uid]")) return;
      closeWorkerPopout();
    });

    auth.onAuthStateChanged(user => {
      if (user) refreshSubscriptionUi().catch(error => setStatus(error.message));
    });
  });
})();
