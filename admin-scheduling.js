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

  let ingestReveal = null;

  const SCHEDULER_HELP_HTML = `
    <p>People × days week grid. Default shift window = club open − 2 hours through club close + 1 hour. Round Robin fills selected open days fairly.</p>
    <p><strong>Create and publish</strong></p>
    <ol>
      <li>Tap <strong>+</strong> on a person/day cell, set role and times, leave Save as draft checked, then Save shift. Save closes the editor and shows <strong>Schedule card successfully saved</strong>. Optional: Round Robin fill or Copy previous week.</li>
      <li>Review dashed draft chips, then tap <strong>Publish schedule</strong>. Workers get Inbox / Email / SMS / WhatsApp with a confirm link.</li>
      <li>Published chips stay <strong>pending</strong> until the worker confirms. Confirmed has a green outline.</li>
    </ol>
    <p><strong>Delete multiple shifts</strong></p>
    <ol>
      <li>Tap <strong>Select shifts</strong>.</li>
      <li>Filter Drafts and tap a day header (e.g. Wednesday), then tap other chips (e.g. a Thursday confirmed shift).</li>
      <li>Tap <strong>Delete selected</strong> and confirm. Escape or Done exits select mode.</li>
    </ol>
    <p>Put published shifts (never drafts) on your club website with <strong>Website ingest</strong> below — JSON API, RSS, or iframe, using a one-time secret.</p>
  `;

  const INGEST_HELP_HTML = `
    <p>Clubs can pull published scheduling (and hours / profile) onto their official website.</p>
    <ol>
      <li>Tap Generate / rotate secret. Copy the yellow URLs immediately — the full secret is not stored in FLOQR, only a hash.</li>
      <li>JSON: <code>venuePublicFeed?location=&amp;secret=&amp;format=json&amp;dataset=schedule|hours|profile|all</code></li>
      <li>RSS: same URL with <code>format=rss</code> for a staff-schedule feed.</li>
      <li>Iframe: paste the snippet into your site. It loads schedule-embed.html with the secret.</li>
    </ol>
    <p>Treat the secret like an API key. Rotate it if it leaks. Payload never includes drafts, worker email, or phone.</p>
  `;

  function attachSchedulingHelp() {
    const attach = window.FLOQRHelpAttach?.attach;
    if (!attach) return;
    const schedTarget = byId("schedGridHeading");
    if (schedTarget) {
      attach({
        target: schedTarget,
        id: "help-staff-schedule-grid",
        title: "Scheduler",
        bodyHtml: SCHEDULER_HELP_HTML,
        body: "People × days week grid. Save shift closes the editor and shows Schedule card successfully saved. Create drafts, Publish schedule so workers confirm pending→confirmed. Select shifts to multi-delete (day header + chips). Website ingest publishes JSON, RSS, or iframe with a one-time secret. Drafts never appear on the club site.",
        searchPhrases: [
          "scheduler", "schedule grid", "user guide", "create a schedule", "publish schedule",
          "how to schedule staff", "select shifts", "multi delete", "round robin",
          "website ingest", "staff calendar", "schedule card successfully saved", "save shift"
        ],
        links: [
          {label: "Club Admin Scheduling", href: "./admin.html?from=floqai&tab=scheduling"},
          {label: "Work Sheet", href: "./staff-worksheet.html?from=floqai"}
        ]
      });
    }
    const ingestTarget = byId("schedIngestHelpHost");
    if (ingestTarget) {
      attach({
        target: ingestTarget,
        id: "help-venue-website-ingest",
        title: "Website ingest",
        bodyHtml: INGEST_HELP_HTML,
        body: "Generate a venue ingest secret to pull published staff shifts onto your official website via JSON API, RSS, or iframe. Hash only is stored; full secret is revealed once per rotate. Drafts, email, and phone are omitted.",
        searchPhrases: [
          "website ingest", "club website schedule", "rss feed", "iframe schedule",
          "schedule api", "ingest secret", "embed staff schedule", "official website"
        ],
        links: [
          {label: "Website ingest", href: "./admin.html?from=floqai&tab=scheduling#schedWebsiteIngest"}
        ]
      });
    }
    const calTarget = byId("schedCalendarHeading");
    if (calTarget) {
      attach({
        target: calTarget,
        id: "help-staff-calendar-week",
        title: "Calendar",
        body: "Week view of confirmed service-member shifts, using the same week as Scheduler. Tap a day header for that day's confirmed roster. Drafts and pending stay on Scheduler until workers confirm.",
        searchPhrases: [
          "staff calendar", "confirmed week", "calendar subtab", "who is working"
        ],
        links: [
          {label: "Calendar & Scheduler", href: "./admin.html?from=floqai&tab=scheduling"}
        ]
      });
    }
    const auditTarget = byId("schedAuditHeading");
    if (auditTarget) {
      attach({
        target: auditTarget,
        id: "help-schedule-shift-audit",
        title: "Schedule log",
        body: "Each create, publish, notify, and worker confirm/decline is written to scheduleShiftAudit. Use this log when testing Publish schedule and notification channels: who created, who published, which staff confirmed after the Inbox / Email / SMS / WhatsApp message.",
        searchPhrases: [
          "schedule log", "who published", "who confirmed", "schedule audit", "publish schedule messages"
        ],
        links: [
          {label: "Calendar & Scheduler", href: "./admin.html?from=floqai&tab=scheduling"}
        ]
      });
    }
  }

  function setIngestStatus(message) {
    const el = byId("schedIngestStatus");
    if (el) el.textContent = message || "";
  }

  async function copyText(value, okMsg) {
    const text = String(value || "");
    if (!text) {
      setIngestStatus("Generate / rotate a secret first so the URLs include the key.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setIngestStatus(okMsg);
    } catch (_error) {
      setIngestStatus("Copy failed — select the yellow text and copy it manually.");
    }
  }

  function ingestUrls() {
    return ingestReveal?.urls || {};
  }

  function renderIngestReveal() {
    const host = byId("schedIngestReveal");
    if (!host) return;
    if (!ingestReveal?.secret) {
      host.classList.add("hidden");
      host.innerHTML = "";
      return;
    }
    host.classList.remove("hidden");
    host.innerHTML = `
      <p><strong>ONE-TIME secret and URLs</strong></p>
      <p class="sub small">Paste these onto your website now. The full secret will not be shown again until you rotate.</p>
      <p>Secret</p><code>${esc(ingestReveal.secret)}</code>
      <p>JSON</p><code>${esc(ingestReveal.urls?.json || "")}</code>
      <p>RSS</p><code>${esc(ingestReveal.urls?.rss || "")}</code>
      <p>Iframe</p><code>${esc(ingestReveal.iframeSnippet || "")}</code>
    `;
  }

  async function loadIngestEndpoints() {
    if (!locationId) {
      setIngestStatus("Choose a venue to generate website ingest URLs.");
      return;
    }
    try {
      const result = await callable("getVenueIngestEndpoints")({locationId});
      const data = result?.data || {};
      const prefix = byId("schedIngestPrefix");
      if (prefix) {
        prefix.textContent = data.configured
          ? `Secret: ${data.secretPrefix || "configured (obfuscated)"}`
          : "Secret: not generated yet.";
      }
      setIngestStatus(data.hint || "");
    } catch (error) {
      setIngestStatus(error?.message || String(error));
    }
  }

  async function rotateIngestSecret() {
    if (!locationId) {
      setIngestStatus("Choose a venue first.");
      return;
    }
    if (!window.confirm("Rotate the website ingest secret? Existing JSON, RSS, and iframe URLs stop working immediately.")) return;
    setIngestStatus("Generating secret…");
    const result = await callable("rotateVenueIngestSecret")({locationId});
    ingestReveal = result?.data || null;
    const prefix = byId("schedIngestPrefix");
    if (prefix) prefix.textContent = `Secret: ${ingestReveal?.secretPrefix || "rotated"}`;
    renderIngestReveal();
    setIngestStatus(ingestReveal?.warning || "Copy the yellow URLs now.");
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function setStatus(message) {
    const el = byId("schedulingStatus");
    if (!el) return;
    el.textContent = message || "";
    const show = !!String(message || "").trim();
    el.classList.toggle("hidden", !show);
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

  const state = {
    workers: [],
    shifts: [],
    weekStart: startOfWeek(new Date()),
    mode: "manual",
    applyDays: new Set([0, 1, 2, 3, 4, 5, 6]),
    rrDays: new Set([1, 2, 3, 4, 5]),
    assignContext: null,
    savingShift: false,
    schedPane: "calendar",
    calendarDayIdx: new Date().getDay(),
    rrCursor: 0,
    venue: null,
    selecting: false,
    selectFilter: "all",
    selectedShiftIds: new Set()
  };

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
    if (!days.length) return;
    const fmt = {month: "short", day: "numeric", year: "numeric"};
    const text = `${days[0].toLocaleDateString([], fmt)} → ${days[6].toLocaleDateString([], fmt)}`;
    const label = byId("schedWeekLabel");
    const calLabel = byId("schedCalWeekLabel");
    if (label) label.textContent = text;
    if (calLabel) calLabel.textContent = text;
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

  function shiftStatusKey(shift) {
    const status = String(shift?.status || "") === "approved" ? "confirmed" : String(shift?.status || "");
    return status || "draft";
  }

  function matchesSelectFilter(shift) {
    const filter = state.selectFilter || "all";
    if (filter === "all") return true;
    return shiftStatusKey(shift) === filter;
  }

  function updateSelectUi() {
    const bar = byId("schedSelectBar");
    const wrap = byId("scheduleWeekGrid");
    const btn = byId("schedSelectBtn");
    const countBtn = byId("schedDeleteSelectedBtn");
    bar?.classList.toggle("hidden", !state.selecting);
    wrap?.classList.toggle("is-selecting", state.selecting);
    btn?.classList.toggle("active", state.selecting);
    if (btn) btn.textContent = state.selecting ? "Selecting…" : "Select shifts";
    document.querySelectorAll("[data-sched-filter]").forEach(el => {
      el.classList.toggle("active", el.dataset.schedFilter === state.selectFilter);
    });
    const n = state.selectedShiftIds.size;
    if (countBtn) {
      countBtn.textContent = n ? `Delete selected (${n})` : "Delete selected";
      countBtn.disabled = n === 0;
    }
  }

  function setSelectMode(on) {
    state.selecting = !!on;
    if (!state.selecting) state.selectedShiftIds.clear();
    renderGrid();
    updateSelectUi();
  }

  function toggleShiftSelected(shiftId) {
    if (!shiftId) return;
    if (state.selectedShiftIds.has(shiftId)) state.selectedShiftIds.delete(shiftId);
    else state.selectedShiftIds.add(shiftId);
    renderGrid();
    updateSelectUi();
  }

  function toggleDaySelection(dayIdx) {
    const day = weekDays()[dayIdx];
    if (!day) return;
    const ids = state.shifts
      .filter(shift => matchesSelectFilter(shift) && sameDay(Number(shift.startsAtMs || Date.parse(shift.startsAt) || 0), day))
      .map(shift => shift.id)
      .filter(Boolean);
    if (!ids.length) return;
    const allOn = ids.every(id => state.selectedShiftIds.has(id));
    ids.forEach(id => {
      if (allOn) state.selectedShiftIds.delete(id);
      else state.selectedShiftIds.add(id);
    });
    renderGrid();
    updateSelectUi();
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
    if (byId("scheduleSaveAsDraft")) byId("scheduleSaveAsDraft").checked = !shift || String(shift.status) === "draft";

    const deleteBtn = byId("scheduleDeleteShiftBtn");
    if (deleteBtn) {
      const status = String(shift?.status || "").toLowerCase();
      const canDelete = !!(shift?.id && ["draft", "pending", "confirmed", "approved", "declined"].includes(status));
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
        ${days.map((day, dayIdx) => {
          const isToday = day.getTime() === today.getTime();
          const holiday = venueApi()?.holidayOn?.(state.venue?.country || "US", day);
          const closed = staffTimesForDay(day).closed;
          const classes = [
            "sched-day-head",
            isToday ? "is-today" : "",
            holiday ? "is-holiday" : "",
            closed ? "is-venue-closed" : ""
          ].filter(Boolean).join(" ");
          const title = [
            holiday ? holiday.name : "",
            closed ? "Venue closed" : "",
            state.selecting ? "Tap to select this day's shifts (uses Drafts / Pending / Confirmed filter)" : ""
          ].filter(Boolean).join(" · ");
          const filterHint = state.selecting
            ? `<small class="sched-select-day-hint">Select ${state.selectFilter === "all" ? "all" : state.selectFilter}</small>`
            : "";
          return `<th class="${classes}" data-day-idx="${dayIdx}" title="${esc(title)}">${esc(day.toLocaleDateString([], {weekday: "short", month: "short", day: "numeric"}))}${holiday ? `<small class="sched-holiday-mark">${esc(holiday.name)}</small>` : ""}${closed && !holiday ? `<small class="sched-closed-mark">Closed</small>` : ""}${filterHint}</th>`;
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
        const chips = dayShifts.map(shift => {
          const status = shiftStatusKey(shift);
          const statusClass = status === "draft" ? "is-draft"
            : status === "pending" ? "is-pending"
            : status === "confirmed" ? "is-confirmed"
            : status === "declined" ? "is-declined"
            : "";
          const selected = state.selecting && state.selectedShiftIds.has(shift.id);
          return `
          <button type="button" class="sched-chip ${chipClass(shift.roleLabel)} ${statusClass}${selected ? " is-selected" : ""}"
            data-shift-id="${esc(shift.id)}" data-uid="${esc(worker.uid)}" data-day="${dayIdx}" data-status="${esc(status)}"
            aria-pressed="${selected ? "true" : "false"}">
            <strong>${esc(shift.roleLabel || "Shift")}</strong>
            <small>${esc(formatChipTime(shift))} · ${esc(status)}</small>
          </button>`;
        }).join("");
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
    updateSelectUi();
    renderCalendarView();
  }

  function viewerIsAdmin() {
    const user = auth.currentUser;
    if (!user) return false;
    const email = String(user.email || "").toLowerCase();
    if (/clubadmin|masteradmin|jadzadco/.test(email)) return true;
    const roles = [].concat(window.FLOQRIdentity?.roles || [], window.FLOQRIdentity?.profile?.roles || []);
    return roles.some(role => /clubadmin|masteradmin|club admin/i.test(String(role)));
  }

  function setSchedPane(pane) {
    state.schedPane = pane === "scheduler" ? "scheduler" : "calendar";
    document.querySelectorAll("[data-sched-pane]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.schedPane === state.schedPane);
    });
    byId("schedCalendarPane")?.classList.toggle("hidden", state.schedPane !== "calendar");
    byId("schedSchedulerPane")?.classList.toggle("hidden", state.schedPane !== "scheduler");
  }

  function confirmedWeekShifts() {
    const {weekStartMs, weekEndMs} = weekRangeMs();
    return (state.shifts || []).filter(s => {
      const status = String(s.status || "");
      if (status !== "confirmed" && status !== "approved") return false;
      const start = Number(s.startsAtMs || 0);
      return start >= weekStartMs && start < weekEndMs;
    });
  }

  function renderCalendarView() {
    const host = byId("scheduleCalendarGrid");
    if (!host) return;
    updateWeekLabel();
    const days = weekDays();
    const confirmed = confirmedWeekShifts();
    const workers = state.workers.length
      ? state.workers
      : [...new Map(confirmed.map(s => [s.assigneeUid, {uid: s.assigneeUid, name: s.assigneeName, role: s.roleLabel}])).values()];
    const fmtDay = {weekday: "short", month: "short", day: "numeric"};
    const head = `<thead><tr><th class="sched-person">Team</th>${days.map((day, dayIdx) => {
      const selected = Number(state.calendarDayIdx) === dayIdx ? " is-cal-selected" : "";
      return `<th class="sched-day-head${selected}" data-cal-day-idx="${dayIdx}">${esc(day.toLocaleDateString([], fmtDay))}<div class="sched-day-sub">Confirmed</div></th>`;
    }).join("")}</tr></thead>`;
    const body = workers.map(worker => {
      const cells = days.map((day, dayIdx) => {
        const chips = confirmed.filter(s => String(s.assigneeUid || "") === worker.uid && sameDay(Number(s.startsAtMs || 0), day));
        if (!chips.length) return `<td class="sched-cell" data-cal-day-idx="${dayIdx}"><span class="sched-empty">—</span></td>`;
        return `<td class="sched-cell" data-cal-day-idx="${dayIdx}">${chips.map(s =>
          `<button type="button" class="sched-chip is-confirmed" data-shift-id="${esc(s.id)}">${esc(s.roleLabel || "Shift")}<small>${esc(formatChipTime(s))}</small></button>`
        ).join("")}</td>`;
      }).join("");
      return `<tr><th class="sched-person">${esc(worker.name || "Staff")}<small>${esc(worker.role || "")}</small></th>${cells}</tr>`;
    }).join("");
    host.innerHTML = workers.length
      ? `<table class="sched-grid">${head}<tbody>${body}</tbody></table>`
      : "<p class='sub'>No confirmed shifts this week yet. Publish on Scheduler, then workers confirm.</p>";
    renderCalendarDayDetail();
  }

  function renderCalendarDayDetail() {
    const host = byId("scheduleCalendarDayDetail");
    if (!host) return;
    const days = weekDays();
    const idx = Number.isFinite(Number(state.calendarDayIdx)) ? Number(state.calendarDayIdx) : new Date().getDay();
    const day = days[idx] || days[0];
    const rows = confirmedWeekShifts().filter(s => sameDay(Number(s.startsAtMs || 0), day));
    const title = day ? day.toLocaleDateString([], {weekday: "long", month: "long", day: "numeric"}) : "";
    if (!rows.length) {
      host.innerHTML = `<p class="sub">${esc(title)} — no confirmed service members yet.</p>`;
      return;
    }
    host.innerHTML = `<p class="sub"><strong>${esc(title)}</strong> · confirmed roster</p>` + rows.map(s =>
      `<div class="queue-item"><strong>${esc(s.assigneeName || "Staff")}</strong> · ${esc(s.roleLabel || "Shift")}<p>${esc(formatChipTime(s))}</p></div>`
    ).join("");
  }

  async function loadScheduleAudit() {
    const host = byId("scheduleShiftAuditLog");
    if (!host || !locationId) return;
    try {
      const result = await callable("listScheduleShiftAudit")({
        ownerType: "club",
        ownerId: locationId
      });
      const rows = result?.data?.events || result?.data?.rows || [];
      if (!rows.length) {
        host.innerHTML = "<p class='sub'>No schedule log rows yet. Publish a week and have a worker confirm to fill this list.</p>";
        return;
      }
      host.innerHTML = rows.slice(0, 40).map(row => {
        const when = row.createdAtMs ? new Date(Number(row.createdAtMs)).toLocaleString() : "";
        return `<div class="queue-item"><strong>${esc(row.action || "")}</strong> · ${esc(row.assigneeName || row.actorEmail || "")}<p>${esc(row.message || "")}</p><small>${esc(when)} · actor ${esc(row.actorEmail || row.actorUid || "")}</small></div>`;
      }).join("");
    } catch (error) {
      host.innerHTML = `<p class="sub">${esc(error?.message || "Schedule log unavailable until the audit function is deployed.")}</p>`;
    }
  }

  async function refreshSubscriptionUi() {
    const gate = byId("schedulingSubscribeGate");
    const workspace = byId("schedulingWorkspace");
    const subtabs = byId("schedSubtabs");
    const paidBtn = byId("schedPaidGreenBtn");
    const buyBtn = byId("buySchedulingSubBtn");
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
      const ever = access?.everSubscribed === true || access?.cta === "resubscribe";
      const cta = paid ? "none" : (access?.cta || (ever ? "resubscribe" : "subscribe"));
      if (gate) gate.classList.toggle("hidden", paid);
      if (workspace) workspace.classList.toggle("hidden", !paid);
      if (subtabs) subtabs.classList.toggle("hidden", !paid);
      if (paidBtn) {
        const showPaid = paid && viewerIsAdmin();
        paidBtn.classList.toggle("hidden", !showPaid);
      }
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
          ? "This venue was subscribed before. Resubscribe to unlock Calendar &amp; Scheduler."
          : "Unlock Calendar &amp; Scheduler for this venue.";
      }
      if (!paid) {
        setStatus(`${cta === "resubscribe" ? "Resubscribe" : "Subscribe"} required.`);
      } else {
        setStatus("");
      }
      if (paid) {
        setSchedPane(state.schedPane || "calendar");
        await Promise.all([loadVenueHours(), loadWorkers(), loadShifts(), loadIngestEndpoints(), loadScheduleAudit()]);
      }
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
    loadScheduleAudit().catch(() => {});
  }

  function shiftPayloadFields({
    assigneeUid,
    assigneeName,
    assigneeEmail,
    assigneePhone,
    roleLabel,
    startsAt,
    endsAt,
    notes,
    asDraft,
    assignMode
  }) {
    return {
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
      assignMode: assignMode || "manual"
    };
  }

  async function createShiftPayload(fields) {
    return callable("createScheduleShift")(shiftPayloadFields(fields));
  }

  function isMissingCallable(error) {
    const code = String(error?.code || "").toLowerCase();
    const msg = String(error?.message || "").toLowerCase();
    if (msg.includes("shift not found")) return false;
    return code === "functions/not-found"
      || code === "not-found"
      || msg.includes("does not exist")
      || (msg.includes("not found") && !msg.includes("shift"));
  }

  async function updateOrReplaceShift(shiftId, fields) {
    try {
      return await callable("updateScheduleShift")({shiftId, ...shiftPayloadFields(fields)});
    } catch (error) {
      if (!isMissingCallable(error)) throw error;
      await callable("deleteScheduleShift")({shiftId});
      return createShiftPayload(fields);
    }
  }

  function setSaveBusy(busy) {
    state.savingShift = !!busy;
    const btn = byId("createScheduleShiftBtn");
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? "Saving…" : "Save shift";
  }

  function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function announceShiftSaved(count) {
    closeAssignModal();
    closeWorkerPopout();
    const n = Number(count) || 1;
    const title = "Schedule card successfully saved";
    const body = n === 1
      ? "The week grid refreshes when this message closes."
      : `${n} schedule cards saved. The week grid refreshes when this message closes.`;
    const feedback = window.FLOQRActionFeedback;
    if (feedback?.show) {
      feedback.show(title, body, {status: "success"});
      const hideMs = 1800;
      feedback.hide(hideMs);
      await waitMs(hideMs + 80);
    } else {
      setStatus(title);
      await waitMs(1200);
    }
  }

  async function pruneIdenticalDuplicates(saved) {
    const rows = Array.isArray(saved) ? saved : [saved];
    let removed = 0;
    for (const keep of rows) {
      if (!keep) continue;
      const extras = (state.shifts || []).filter(shift =>
        shift.id
        && shift.id !== keep.id
        && String(shift.assigneeUid || "") === String(keep.assigneeUid || "")
        && Number(shift.startsAtMs || 0) === Number(keep.startsAtMs || 0)
        && Number(shift.endsAtMs || 0) === Number(keep.endsAtMs || 0)
      );
      for (const extra of extras) {
        try {
          await callable("deleteScheduleShift")({shiftId: extra.id});
          removed += 1;
        } catch (_error) {}
      }
    }
    return removed;
  }

  function boundsForDay(dayIdx, startLocal, durationMs) {
    const day = weekDays()[dayIdx] || addDays(state.weekStart, dayIdx);
    const dayStart = new Date(day);
    dayStart.setHours(startLocal.getHours(), startLocal.getMinutes(), 0, 0);
    return {startsAt: dayStart, endsAt: new Date(dayStart.getTime() + durationMs)};
  }

  async function createShift() {
    if (state.savingShift) return;
    setSaveBusy(true);
    try {
    const select = byId("scheduleAssignee");
    const option = select?.selectedOptions?.[0];
    const assigneeUid = select?.value || "";
    if (!assigneeUid) throw new Error("Choose a worker for this shift.");
    const startsAt = byId("scheduleStartsAt")?.value;
    const endsAt = byId("scheduleEndsAt")?.value;
    if (!startsAt || !endsAt) throw new Error("Set shift start and end.");
    const asDraft = byId("scheduleSaveAsDraft")?.checked === true;
    const roleLabel = byId("scheduleRole")?.value?.trim() || option?.dataset?.role || "Shift";
    const notes = byId("scheduleNotes")?.value?.trim() || "";
    const worker = state.workers.find(w => w.uid === assigneeUid);
    const applyDays = (state.applyDays.size ? [...state.applyDays] : [new Date(startsAt).getDay()])
      .sort((a, b) => a - b);
    const startLocal = new Date(startsAt);
    const endLocal = new Date(endsAt);
    const durationMs = endLocal.getTime() - startLocal.getTime();
    if (!(durationMs > 0)) throw new Error("Shift end must be after start.");

    const existing = state.assignContext?.shift || null;
    const existingId = existing?.id || "";
    const existingDayIdx = existingId
      ? new Date(existing.startsAtMs || existing.startsAt || startLocal).getDay()
      : -1;
    const baseFields = {
      assigneeUid,
      assigneeName: option?.dataset?.name || worker?.name || option?.textContent || "",
      assigneeEmail: option?.dataset?.email || worker?.email || "",
      assigneePhone: option?.dataset?.phone || worker?.phone || "",
      roleLabel,
      notes,
      asDraft,
      assignMode: "manual"
    };

    setStatus(asDraft ? "Saving draft shift(s)…" : "Saving shift and notifying the worker…");
    const saved = [];
      const updateDay = existingId
        ? (applyDays.includes(existingDayIdx) ? existingDayIdx : applyDays[0])
        : null;
      for (const dayIdx of applyDays) {
        const bounds = boundsForDay(dayIdx, startLocal, durationMs);
        const fields = {...baseFields, ...bounds};
        if (existingId && dayIdx === updateDay) {
          const result = await updateOrReplaceShift(existingId, fields);
          saved.push({
            id: result?.data?.shiftId || existingId,
            assigneeUid,
            startsAtMs: bounds.startsAt.getTime(),
            endsAtMs: bounds.endsAt.getTime()
          });
        } else {
          const result = await createShiftPayload(fields);
          saved.push({
            id: result?.data?.shiftId || "",
            assigneeUid,
            startsAtMs: bounds.startsAt.getTime(),
            endsAtMs: bounds.endsAt.getTime()
          });
        }
      }
      if (byId("scheduleNotes")) byId("scheduleNotes").value = "";
      await announceShiftSaved(saved.length);
      await loadShifts();
      const pruned = await pruneIdenticalDuplicates(saved);
      if (pruned) await loadShifts();
      setStatus("");
    } catch (error) {
      const feedback = window.FLOQRActionFeedback;
      if (feedback?.show) {
        feedback.show("Could not save schedule card", error?.message || String(error), {status: "failed"});
        feedback.hide(4500);
      }
      setStatus(error?.message || String(error));
      throw error;
    } finally {
      setSaveBusy(false);
    }
  }

  async function publishWeek() {
    const {weekStartMs, weekEndMs} = weekRangeMs();
    const drafts = state.shifts.filter(s =>
      String(s.status || "") === "draft"
      && Number(s.startsAtMs || 0) >= weekStartMs
      && Number(s.startsAtMs || 0) < weekEndMs
    );
    if (!drafts.length) throw new Error("No draft shifts in this week to publish.");
    if (!window.confirm(`Publish ${drafts.length} draft shift${drafts.length === 1 ? "" : "s"}? Workers must confirm before a shift becomes confirmed.`)) return;
    setStatus("Publishing schedule…");
    const result = await callable("publishScheduleShifts")({
      ownerType: "club",
      ownerId: locationId,
      weekStartMs,
      weekEndMs
    });
    setStatus(`Published ${result?.data?.published || 0} pending shift(s). Workers confirm via Inbox / Email / SMS / WhatsApp.`);
    await loadShifts();
    await loadScheduleAudit();
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
        assignMode: "copyPreviousWeek"
      });
      created += 1;
    }
    setStatus(`Copied ${created} draft shift${created === 1 ? "" : "s"} from previous week.`);
    await loadShifts();
  }

  async function deleteShift(shiftId) {
    if (!shiftId) return;
    if (!window.confirm("Delete this shift? Pending and confirmed shifts can both be removed. The worker is notified if it was already sent.")) return;
    setStatus("Deleting shift…");
    await callable("deleteScheduleShift")({shiftId});
    setStatus("Shift deleted.");
    await loadShifts();
  }

  async function deleteSelectedShifts() {
    const ids = [...state.selectedShiftIds];
    if (!ids.length) throw new Error("Select at least one shift to delete.");
    if (!window.confirm(`Delete ${ids.length} selected shift${ids.length === 1 ? "" : "s"}? Drafts disappear quietly. Pending and confirmed workers get a cancelled notice if they were already notified.`)) return;
    setStatus(`Deleting ${ids.length} shift${ids.length === 1 ? "" : "s"}…`);
    const result = await callable("deleteScheduleShifts")({shiftIds: ids});
    const deleted = Number(result?.data?.deleted || 0);
    const failed = Number(result?.data?.failed || 0);
    state.selectedShiftIds.clear();
    setSelectMode(false);
    setStatus(failed
      ? `Deleted ${deleted} shift${deleted === 1 ? "" : "s"}; ${failed} could not be removed.`
      : `Deleted ${deleted} shift${deleted === 1 ? "" : "s"}.`);
    await loadShifts();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderDayPills("schedApplyDays", state.applyDays);
    renderDayPills("schedRrDays", state.rrDays);
    bindDayPills("schedApplyDays", state.applyDays);
    bindDayPills("schedRrDays", state.rrDays);
    setMode("manual");
    updateWeekLabel();

    attachSchedulingHelp();
    const wantedPane = String(new URL(location.href).searchParams.get("pane") || new URL(location.href).searchParams.get("tab") || "").toLowerCase();
    if (wantedPane === "scheduler" || wantedPane === "schedgridheading") setSchedPane("scheduler");
    else setSchedPane("calendar");
    byId("schedSubtabs")?.addEventListener("click", event => {
      const btn = event.target.closest("[data-sched-pane]");
      if (!btn) return;
      setSchedPane(btn.dataset.schedPane);
    });
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
    byId("schedSelectBtn")?.addEventListener("click", () => {
      setSelectMode(!state.selecting);
    });
    byId("schedSelectCancelBtn")?.addEventListener("click", () => setSelectMode(false));
    byId("schedDeleteSelectedBtn")?.addEventListener("click", () => {
      deleteSelectedShifts().catch(error => setStatus(error.message));
    });
    byId("schedSelectFilters")?.addEventListener("click", event => {
      const btn = event.target.closest("[data-sched-filter]");
      if (!btn) return;
      state.selectFilter = btn.dataset.schedFilter || "all";
      updateSelectUi();
      if (state.selecting) renderGrid();
    });
    byId("schedRrFillBtn")?.addEventListener("click", () => {
      roundRobinFill().catch(error => setStatus(error.message));
    });
    byId("schedModeManualBtn")?.addEventListener("click", () => setMode("manual"));
    byId("schedModeRrBtn")?.addEventListener("click", () => setMode("roundRobin"));
    function shiftWeek(deltaDays, resetToday) {
      state.weekStart = resetToday ? startOfWeek(new Date()) : addDays(state.weekStart, deltaDays);
      applyVenueDefaultsToControls();
      renderGrid();
    }
    byId("schedPrevWeekBtn")?.addEventListener("click", () => shiftWeek(-7));
    byId("schedNextWeekBtn")?.addEventListener("click", () => shiftWeek(7));
    byId("schedTodayWeekBtn")?.addEventListener("click", () => shiftWeek(0, true));
    byId("schedCalPrevWeekBtn")?.addEventListener("click", () => shiftWeek(-7));
    byId("schedCalNextWeekBtn")?.addEventListener("click", () => shiftWeek(7));
    byId("schedCalTodayWeekBtn")?.addEventListener("click", () => shiftWeek(0, true));
    byId("scheduleCalendarGrid")?.addEventListener("click", event => {
      const head = event.target.closest("[data-cal-day-idx]");
      if (!head) return;
      state.calendarDayIdx = Number(head.dataset.calDayIdx);
      renderCalendarView();
    });
    byId("schedIngestRotateBtn")?.addEventListener("click", () => {
      rotateIngestSecret().catch(error => setIngestStatus(error.message));
    });
    byId("schedIngestCopyJsonBtn")?.addEventListener("click", () => {
      copyText(ingestUrls().json, "JSON URL copied.");
    });
    byId("schedIngestCopyRssBtn")?.addEventListener("click", () => {
      copyText(ingestUrls().rss, "RSS URL copied.");
    });
    byId("schedIngestCopyIframeBtn")?.addEventListener("click", () => {
      copyText(ingestReveal?.iframeSnippet || "", "Iframe snippet copied.");
    });
    byId("schedIngestCopyAllBtn")?.addEventListener("click", () => {
      copyText(ingestUrls().all, "All-data JSON URL copied.");
    });

    byId("scheduleWeekGrid")?.addEventListener("click", event => {
      if (state.selecting) {
        const dayHead = event.target.closest("[data-day-idx]");
        if (dayHead) {
          toggleDaySelection(Number(dayHead.dataset.dayIdx));
          return;
        }
        const chip = event.target.closest("[data-shift-id]");
        if (chip) {
          toggleShiftSelected(chip.dataset.shiftId);
          return;
        }
        return;
      }
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
        if (state.selecting) setSelectMode(false);
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
