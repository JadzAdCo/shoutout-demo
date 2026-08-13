/* FLOQR Club Admin — venue hours editor + guest-list open-night wiring. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const cal = () => window.FLOQRVenueCalendar;
  if (!byId("clubVenueHoursCard")) return;

  let exceptions = [];

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderWeeklyEditor(structured) {
    const host = byId("clubHoursWeeklyEditor");
    const api = cal();
    if (!host || !api) return;
    const hours = api.normalizeHoursStructured(structured);
    host.innerHTML = api.DAY_KEYS.map((key, idx) => {
      const day = hours[key];
      return `<div class="venue-hours-row" data-day="${key}">
        <strong>${api.DAY_LABELS[idx]}</strong>
        <label class="venue-hours-open"><input type="checkbox" data-hours-open ${day.closed ? "" : "checked"}/> Open</label>
        <input type="time" data-hours-start value="${esc(day.open || "22:00")}" ${day.closed ? "disabled" : ""}/>
        <span>to</span>
        <input type="time" data-hours-end value="${esc(day.close || "03:00")}" ${day.closed ? "disabled" : ""}/>
      </div>`;
    }).join("");
    host.querySelectorAll("[data-hours-open]").forEach(input => {
      input.addEventListener("change", () => {
        const row = input.closest(".venue-hours-row");
        row?.querySelectorAll("input[type='time']").forEach(el => {
          el.disabled = !input.checked;
        });
        syncSummary();
      });
    });
    host.querySelectorAll("input[type='time']").forEach(input => {
      input.addEventListener("change", syncSummary);
    });
  }

  function collectStructured() {
    const api = cal();
    const out = api ? api.defaultHoursStructured() : {};
    document.querySelectorAll("#clubHoursWeeklyEditor .venue-hours-row").forEach(row => {
      const key = row.dataset.day;
      const open = row.querySelector("[data-hours-open]")?.checked;
      const start = row.querySelector("[data-hours-start]")?.value || "";
      const end = row.querySelector("[data-hours-end]")?.value || "";
      out[key] = open ? {closed: false, open: start, close: end} : {closed: true, open: "", close: ""};
    });
    return out;
  }

  function renderExceptions() {
    const list = byId("clubHoursExceptionsList");
    if (!list) return;
    if (!exceptions.length) {
      list.innerHTML = "<p class='sub'>No period overrides yet.</p>";
      return;
    }
    list.innerHTML = exceptions.map((ex, idx) => {
      const span = ex.startDate === ex.endDate ? ex.startDate : `${ex.startDate} → ${ex.endDate}`;
      const value = ex.closed ? "Closed" : `${ex.open} – ${ex.close}`;
      return `<div class="report-row">
        <strong>${esc(span)}${ex.label ? ` · ${esc(ex.label)}` : ""}</strong>
        <span>${esc(value)}</span>
        <button type="button" class="ghost" data-ex-remove="${idx}">Remove</button>
      </div>`;
    }).join("");
  }

  function renderHolidayPreview(country) {
    const host = byId("clubHoursHolidayPreview");
    const api = cal();
    if (!host || !api) return;
    const start = new Date();
    const end = api.addDays(start, 120);
    const holidays = api.holidaysInRange(country || "United States", start, end).slice(0, 12);
    const code = api.normalizeCountry(country || "United States");
    host.innerHTML = `<p class="sub"><strong>Public holidays (${esc(code)})</strong> — highlighted on Staff Scheduling and Guest List calendars:</p>
      <div class="report-list">${holidays.map(h => `<span class="tag sched-holiday-tag">${esc(h.date)} · ${esc(h.name)}</span>`).join("") || "<span class='sub'>None in the next 4 months.</span>"}</div>`;
  }

  function syncSummary() {
    const api = cal();
    if (!api) return;
    const structured = collectStructured();
    const blurb = api.hoursBlurb(structured);
    if (byId("clubProfileHours")) byId("clubProfileHours").value = blurb;
  }

  function addException() {
    const startDate = byId("clubHoursExStart")?.value || "";
    const endDate = byId("clubHoursExEnd")?.value || startDate;
    if (!startDate) throw new Error("Choose a start date for the period override.");
    const closed = !!byId("clubHoursExClosed")?.checked;
    exceptions.push({
      id: `${startDate}_${endDate}_${Date.now()}`,
      startDate,
      endDate,
      closed,
      open: closed ? "" : (byId("clubHoursExOpen")?.value || "22:00"),
      close: closed ? "" : (byId("clubHoursExClose")?.value || "03:00"),
      label: byId("clubHoursExLabel")?.value?.trim() || ""
    });
    renderExceptions();
    if (byId("clubHoursExLabel")) byId("clubHoursExLabel").value = "";
  }

  function fillFromClub(club = {}) {
    const api = cal();
    const structured = api?.normalizeHoursStructured(club.hoursStructured || club.hoursOfficialSite || {}) || {};
    // If structured empty/all closed but free-text hours exist, keep defaults from module
    exceptions = api?.normalizeExceptions(club.hoursExceptions) || [];
    renderWeeklyEditor(structured);
    renderExceptions();
    const country = club.country || byId("clubProfileCountry")?.value || "United States";
    const tz = club.timeZone || api?.guessTimeZone(country) || "America/New_York";
    if (byId("clubProfileTimeZone")) {
      const sel = byId("clubProfileTimeZone");
      if (![...sel.options].some(o => o.value === tz)) {
        const opt = document.createElement("option");
        opt.value = tz;
        opt.textContent = tz;
        sel.appendChild(opt);
      }
      sel.value = tz;
    }
    if (byId("clubProfileHours") && !byId("clubProfileHours").value) {
      byId("clubProfileHours").value = club.hours || club.operatingHours || api?.hoursBlurb(structured) || "";
    } else {
      syncSummary();
    }
    renderHolidayPreview(country);
    refreshGuestOpenNights(club);
  }

  function collectPayload() {
    const api = cal();
    const hoursStructured = collectStructured();
    const hours = byId("clubProfileHours")?.value.trim() || api?.hoursBlurb(hoursStructured) || "";
    return {
      hours,
      hoursStructured,
      hoursExceptions: exceptions.slice(),
      timeZone: byId("clubProfileTimeZone")?.value || api?.guessTimeZone(byId("clubProfileCountry")?.value) || "America/New_York"
    };
  }

  function nextOpenDates(club, count = 10) {
    const api = cal();
    if (!api) return [];
    const out = [];
    let cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    for (let i = 0; i < 60 && out.length < count; i += 1) {
      const hours = api.hoursForDate(club, cursor);
      if (!hours.closed) {
        out.push({
          date: api.ymd(cursor),
          label: `${cursor.toLocaleDateString([], {weekday: "short", month: "short", day: "numeric"})} · ${hours.open}–${hours.close}`,
          holiday: api.holidayOn(club.country || byId("clubProfileCountry")?.value || "US", cursor)
        });
      }
      cursor = api.addDays(cursor, 1);
    }
    return out;
  }

  function refreshGuestOpenNights(club = {}) {
    const select = byId("guestCampaignOpenNightSuggest");
    if (!select) return;
    const venue = {
      ...club,
      hoursStructured: club.hoursStructured || collectStructured(),
      hoursExceptions: club.hoursExceptions || exceptions,
      country: club.country || byId("clubProfileCountry")?.value || "United States"
    };
    const nights = nextOpenDates(venue, 12);
    select.innerHTML = `<option value="">Pick from club open nights…</option>` + nights.map(n =>
      `<option value="${esc(n.date)}">${esc(n.label)}${n.holiday ? ` · ${esc(n.holiday.name)}` : ""}</option>`
    ).join("");
  }

  function updateGuestHolidayHint() {
    const api = cal();
    const date = byId("guestCampaignDate")?.value;
    const hint = byId("guestCampaignHolidayHint");
    if (!hint || !api) return;
    if (!date) {
      hint.textContent = "";
      return;
    }
    const country = byId("clubProfileCountry")?.value || "United States";
    const holiday = api.holidayOn(country, date);
    const hours = api.hoursForDate({
      hoursStructured: collectStructured(),
      hoursExceptions: exceptions
    }, date);
    const bits = [];
    if (holiday) bits.push(`Public holiday: ${holiday.name}`);
    if (hours.closed) bits.push("Venue is closed on this date (per opening hours / override).");
    else bits.push(`Venue hours: ${hours.open}–${hours.close}${hours.source === "exception" ? " (period override)" : ""}`);
    hint.textContent = bits.join(" · ");
    hint.classList.toggle("sched-holiday-hint", !!holiday);
  }

  function bind() {
    byId("clubHoursSyncSummaryBtn")?.addEventListener("click", () => syncSummary());
    byId("clubHoursExAddBtn")?.addEventListener("click", () => {
      try { addException(); } catch (error) { alert(error.message); }
    });
    byId("clubHoursExceptionsList")?.addEventListener("click", event => {
      const btn = event.target.closest("[data-ex-remove]");
      if (!btn) return;
      exceptions.splice(Number(btn.dataset.exRemove), 1);
      renderExceptions();
    });
    byId("clubProfileCountry")?.addEventListener("change", () => {
      const country = byId("clubProfileCountry").value;
      renderHolidayPreview(country);
      const api = cal();
      if (api && byId("clubProfileTimeZone") && !byId("clubProfileTimeZone").dataset.userSet) {
        byId("clubProfileTimeZone").value = api.guessTimeZone(country);
      }
      refreshGuestOpenNights({});
      updateGuestHolidayHint();
    });
    byId("clubProfileTimeZone")?.addEventListener("change", () => {
      byId("clubProfileTimeZone").dataset.userSet = "1";
    });
    byId("guestCampaignOpenNightSuggest")?.addEventListener("change", () => {
      const value = byId("guestCampaignOpenNightSuggest")?.value;
      if (value && byId("guestCampaignDate")) byId("guestCampaignDate").value = value;
      updateGuestHolidayHint();
    });
    byId("guestCampaignDate")?.addEventListener("change", updateGuestHolidayHint);
  }

  window.FLOQRAdminVenueHours = {
    fillFromClub,
    collectPayload,
    refreshGuestOpenNights,
    updateGuestHolidayHint,
    bind,
    getExceptions: () => exceptions.slice()
  };

  document.addEventListener("DOMContentLoaded", bind);
})();
