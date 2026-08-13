/* FLOQR venue calendar — weekly hours, period overrides, staff windows, country holidays. */
(function (global) {
  "use strict";

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function text(value, max = 200) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function ymd(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseYmd(value) {
    const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function nthWeekday(year, monthIndex, weekday, n) {
    let count = 0;
    for (let day = 1; day <= 31; day += 1) {
      const d = new Date(year, monthIndex, day);
      if (d.getMonth() !== monthIndex) break;
      if (d.getDay() !== weekday) continue;
      count += 1;
      if (count === n) return d;
    }
    return null;
  }

  function lastWeekday(year, monthIndex, weekday) {
    for (let day = 31; day >= 1; day -= 1) {
      const d = new Date(year, monthIndex, day);
      if (d.getMonth() !== monthIndex) continue;
      if (d.getDay() === weekday) return d;
    }
    return null;
  }

  /** Anonymous Gregorian Easter Sunday */
  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function holidayEntry(date, name) {
    if (!date || !Number.isFinite(date.getTime())) return null;
    return {date: ymd(date), name, ms: date.getTime()};
  }

  function usHolidays(year) {
    const list = [
      holidayEntry(new Date(year, 0, 1), "New Year's Day"),
      holidayEntry(nthWeekday(year, 0, 1, 3), "Martin Luther King Jr. Day"),
      holidayEntry(nthWeekday(year, 1, 1, 3), "Presidents' Day"),
      holidayEntry(lastWeekday(year, 4, 1), "Memorial Day"),
      holidayEntry(new Date(year, 5, 19), "Juneteenth"),
      holidayEntry(new Date(year, 6, 4), "Independence Day"),
      holidayEntry(nthWeekday(year, 8, 1, 1), "Labor Day"),
      holidayEntry(nthWeekday(year, 9, 1, 2), "Indigenous Peoples' Day"),
      holidayEntry(new Date(year, 10, 11), "Veterans Day"),
      holidayEntry(nthWeekday(year, 10, 4, 4), "Thanksgiving"),
      holidayEntry(new Date(year, 11, 25), "Christmas Day")
    ];
    return list.filter(Boolean);
  }

  function frHolidays(year) {
    const easter = easterSunday(year);
    return [
      holidayEntry(new Date(year, 0, 1), "Jour de l'an"),
      holidayEntry(addDays(easter, 1), "Lundi de Pâques"),
      holidayEntry(new Date(year, 4, 1), "Fête du Travail"),
      holidayEntry(new Date(year, 4, 8), "Victoire 1945"),
      holidayEntry(addDays(easter, 39), "Ascension"),
      holidayEntry(addDays(easter, 50), "Lundi de Pentecôte"),
      holidayEntry(new Date(year, 6, 14), "Fête nationale"),
      holidayEntry(new Date(year, 7, 15), "Assomption"),
      holidayEntry(new Date(year, 10, 1), "Toussaint"),
      holidayEntry(new Date(year, 10, 11), "Armistice"),
      holidayEntry(new Date(year, 11, 25), "Noël")
    ].filter(Boolean);
  }

  function deHolidays(year) {
    const easter = easterSunday(year);
    return [
      holidayEntry(new Date(year, 0, 1), "Neujahr"),
      holidayEntry(addDays(easter, -2), "Karfreitag"),
      holidayEntry(addDays(easter, 1), "Ostermontag"),
      holidayEntry(new Date(year, 4, 1), "Tag der Arbeit"),
      holidayEntry(addDays(easter, 39), "Christi Himmelfahrt"),
      holidayEntry(addDays(easter, 50), "Pfingstmontag"),
      holidayEntry(new Date(year, 9, 3), "Tag der Deutschen Einheit"),
      holidayEntry(new Date(year, 11, 25), "1. Weihnachtstag"),
      holidayEntry(new Date(year, 11, 26), "2. Weihnachtstag")
    ].filter(Boolean);
  }

  function nlHolidays(year) {
    const easter = easterSunday(year);
    return [
      holidayEntry(new Date(year, 0, 1), "Nieuwjaarsdag"),
      holidayEntry(addDays(easter, -2), "Goede Vrijdag"),
      holidayEntry(easter, "Eerste Paasdag"),
      holidayEntry(addDays(easter, 1), "Tweede Paasdag"),
      holidayEntry(new Date(year, 3, 27), "Koningsdag"),
      holidayEntry(new Date(year, 4, 5), "Bevrijdingsdag"),
      holidayEntry(addDays(easter, 39), "Hemelvaartsdag"),
      holidayEntry(addDays(easter, 50), "Tweede Pinksterdag"),
      holidayEntry(new Date(year, 11, 25), "Eerste Kerstdag"),
      holidayEntry(new Date(year, 11, 26), "Tweede Kerstdag")
    ].filter(Boolean);
  }

  function esHolidays(year) {
    const easter = easterSunday(year);
    return [
      holidayEntry(new Date(year, 0, 1), "Año Nuevo"),
      holidayEntry(new Date(year, 0, 6), "Reyes"),
      holidayEntry(addDays(easter, -2), "Viernes Santo"),
      holidayEntry(new Date(year, 4, 1), "Día del Trabajo"),
      holidayEntry(new Date(year, 7, 15), "Asunción"),
      holidayEntry(new Date(year, 9, 12), "Fiesta Nacional"),
      holidayEntry(new Date(year, 10, 1), "Todos los Santos"),
      holidayEntry(new Date(year, 11, 6), "Día de la Constitución"),
      holidayEntry(new Date(year, 11, 8), "Inmaculada Concepción"),
      holidayEntry(new Date(year, 11, 25), "Navidad")
    ].filter(Boolean);
  }

  function itHolidays(year) {
    const easter = easterSunday(year);
    return [
      holidayEntry(new Date(year, 0, 1), "Capodanno"),
      holidayEntry(new Date(year, 0, 6), "Epifania"),
      holidayEntry(addDays(easter, 1), "Lunedì dell'Angelo"),
      holidayEntry(new Date(year, 3, 25), "Liberazione"),
      holidayEntry(new Date(year, 4, 1), "Festa del Lavoro"),
      holidayEntry(new Date(year, 5, 2), "Festa della Repubblica"),
      holidayEntry(new Date(year, 7, 15), "Ferragosto"),
      holidayEntry(new Date(year, 10, 1), "Ognissanti"),
      holidayEntry(new Date(year, 11, 8), "Immacolata"),
      holidayEntry(new Date(year, 11, 25), "Natale"),
      holidayEntry(new Date(year, 11, 26), "Santo Stefano")
    ].filter(Boolean);
  }

  function ptHolidays(year) {
    const easter = easterSunday(year);
    return [
      holidayEntry(new Date(year, 0, 1), "Ano Novo"),
      holidayEntry(addDays(easter, -2), "Sexta-feira Santa"),
      holidayEntry(easter, "Páscoa"),
      holidayEntry(new Date(year, 3, 25), "Liberdade"),
      holidayEntry(new Date(year, 4, 1), "Dia do Trabalhador"),
      holidayEntry(new Date(year, 5, 10), "Dia de Portugal"),
      holidayEntry(new Date(year, 7, 15), "Assunção"),
      holidayEntry(new Date(year, 9, 5), "Implantação da República"),
      holidayEntry(new Date(year, 10, 1), "Todos os Santos"),
      holidayEntry(new Date(year, 11, 1), "Restauração da Independência"),
      holidayEntry(new Date(year, 11, 8), "Imaculada Conceição"),
      holidayEntry(new Date(year, 11, 25), "Natal")
    ].filter(Boolean);
  }

  function beHolidays(year) {
    const easter = easterSunday(year);
    return [
      holidayEntry(new Date(year, 0, 1), "Nieuwjaar / Nouvel An"),
      holidayEntry(addDays(easter, 1), "Paasmaandag / Lundi de Pâques"),
      holidayEntry(new Date(year, 4, 1), "Dag van de Arbeid"),
      holidayEntry(addDays(easter, 39), "O.L.H. Hemelvaart"),
      holidayEntry(addDays(easter, 50), "Pinkstermaandag"),
      holidayEntry(new Date(year, 6, 21), "Nationale feestdag"),
      holidayEntry(new Date(year, 7, 15), "Maria-Tenhemelopneming"),
      holidayEntry(new Date(year, 10, 1), "Allerheiligen"),
      holidayEntry(new Date(year, 10, 11), "Wapenstilstand"),
      holidayEntry(new Date(year, 11, 25), "Kerstmis")
    ].filter(Boolean);
  }

  function gbHolidays(year) {
    const easter = easterSunday(year);
    return [
      holidayEntry(new Date(year, 0, 1), "New Year's Day"),
      holidayEntry(addDays(easter, -2), "Good Friday"),
      holidayEntry(addDays(easter, 1), "Easter Monday"),
      holidayEntry(nthWeekday(year, 4, 1, 1), "Early May bank holiday"),
      holidayEntry(lastWeekday(year, 4, 1), "Spring bank holiday"),
      holidayEntry(lastWeekday(year, 7, 1), "Summer bank holiday"),
      holidayEntry(new Date(year, 11, 25), "Christmas Day"),
      holidayEntry(new Date(year, 11, 26), "Boxing Day")
    ].filter(Boolean);
  }

  function caHolidays(year) {
    return [
      holidayEntry(new Date(year, 0, 1), "New Year's Day"),
      holidayEntry(nthWeekday(year, 1, 1, 3), "Family Day"),
      holidayEntry(addDays(easterSunday(year), -2), "Good Friday"),
      holidayEntry(new Date(year, 6, 1), "Canada Day"),
      holidayEntry(nthWeekday(year, 8, 1, 1), "Labour Day"),
      holidayEntry(nthWeekday(year, 9, 1, 2), "Thanksgiving"),
      holidayEntry(new Date(year, 11, 25), "Christmas Day"),
      holidayEntry(new Date(year, 11, 26), "Boxing Day")
    ].filter(Boolean);
  }

  const HOLIDAY_FN = {
    US: usHolidays, USA: usHolidays, "UNITED STATES": usHolidays, "UNITED STATES OF AMERICA": usHolidays,
    FR: frHolidays, FRA: frHolidays, FRANCE: frHolidays,
    DE: deHolidays, DEU: deHolidays, GERMANY: deHolidays, DEUTSCHLAND: deHolidays,
    NL: nlHolidays, NLD: nlHolidays, NETHERLANDS: nlHolidays, HOLLAND: nlHolidays,
    ES: esHolidays, ESP: esHolidays, SPAIN: esHolidays, ESPANA: esHolidays, "ESPAÑA": esHolidays,
    IT: itHolidays, ITA: itHolidays, ITALY: itHolidays, ITALIA: itHolidays,
    PT: ptHolidays, PRT: ptHolidays, PORTUGAL: ptHolidays,
    BE: beHolidays, BEL: beHolidays, BELGIUM: beHolidays, BELGIQUE: beHolidays, BELGIE: beHolidays,
    GB: gbHolidays, UK: gbHolidays, "UNITED KINGDOM": gbHolidays, ENGLAND: gbHolidays,
    CA: caHolidays, CAN: caHolidays, CANADA: caHolidays
  };

  function normalizeCountry(country) {
    const raw = text(country, 80).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!raw) return "US";
    if (HOLIDAY_FN[raw]) return raw.length <= 3 ? raw : Object.keys(HOLIDAY_FN).find(k => HOLIDAY_FN[k] === HOLIDAY_FN[raw] && k.length <= 3) || raw;
    if (/UNITED\s*STATES|AMERICA|\bUSA\b|\bUS\b/.test(raw)) return "US";
    if (/FRANCE|FRANCAIS/.test(raw)) return "FR";
    if (/GERMANY|DEUTSCH/.test(raw)) return "DE";
    if (/NETHERLAND|HOLLAND|NEDERLAND/.test(raw)) return "NL";
    if (/SPAIN|ESPANA/.test(raw)) return "ES";
    if (/ITALY|ITALIA/.test(raw)) return "IT";
    if (/PORTUGAL/.test(raw)) return "PT";
    if (/BELGIUM|BELGIQUE|BELGIE/.test(raw)) return "BE";
    if (/UNITED\s*KINGDOM|\bUK\b|ENGLAND|BRITAIN/.test(raw)) return "GB";
    if (/CANADA/.test(raw)) return "CA";
    return raw.slice(0, 2);
  }

  function holidaysForYear(country, year) {
    const code = normalizeCountry(country);
    const fn = HOLIDAY_FN[code] || HOLIDAY_FN[Object.keys(HOLIDAY_FN).find(k => HOLIDAY_FN[k] === HOLIDAY_FN[code])] || usHolidays;
    return (typeof fn === "function" ? fn(year) : usHolidays(year));
  }

  function holidaysInRange(country, startDate, endDate) {
    const start = startDate instanceof Date ? startDate : parseYmd(startDate) || new Date();
    const end = endDate instanceof Date ? endDate : parseYmd(endDate) || addDays(start, 7);
    const years = new Set([start.getFullYear(), end.getFullYear()]);
    const out = [];
    years.forEach(year => {
      holidaysForYear(country, year).forEach(h => {
        const d = parseYmd(h.date);
        if (d && d >= start && d <= end) out.push(h);
      });
    });
    return out.sort((a, b) => a.ms - b.ms);
  }

  function holidayOn(country, date) {
    const key = ymd(date);
    if (!key) return null;
    const year = (date instanceof Date ? date : parseYmd(date)).getFullYear();
    return holidaysForYear(country, year).find(h => h.date === key) || null;
  }

  function parseClock(value) {
    const raw = text(value, 40).toLowerCase().replace(/\./g, "");
    if (!raw || /closed|ferme|geschlossen|cerrado|fechado/.test(raw)) return null;
    const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) return null;
    let hour = Number(m[1]);
    const minute = Number(m[2] || 0);
    const ap = (m[3] || "").toLowerCase();
    if (ap === "pm" && hour < 12) hour += 12;
    if (ap === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return {hour, minute, label: `${pad(hour)}:${pad(minute)}`};
  }

  function parseDayHours(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (value.closed === true || value.open === false) return {closed: true, open: "", close: ""};
      const open = text(value.open || value.start || "", 8);
      const close = text(value.close || value.end || "", 8);
      if (!open || !close) return {closed: true, open: "", close: ""};
      return {closed: false, open, close};
    }
    const raw = text(value, 80);
    if (!raw || /closed/i.test(raw)) return {closed: true, open: "", close: ""};
    const parts = raw.split(/\s*[–—\-to]+\s*/i);
    if (parts.length < 2) return {closed: true, open: "", close: ""};
    const open = parseClock(parts[0]);
    const close = parseClock(parts[1]);
    if (!open || !close) return {closed: true, open: "", close: ""};
    return {closed: false, open: open.label, close: close.label};
  }

  function defaultHoursStructured() {
    const blank = {closed: true, open: "", close: ""};
    const openNight = {closed: false, open: "22:00", close: "03:00"};
    return {
      sun: {...blank},
      mon: {...blank},
      tue: {...blank},
      wed: {...blank},
      thu: {...openNight},
      fri: {...openNight},
      sat: {...openNight}
    };
  }

  function normalizeHoursStructured(input) {
    const base = defaultHoursStructured();
    const src = input && typeof input === "object" ? input : {};
    DAY_KEYS.forEach(key => {
      base[key] = parseDayHours(src[key] != null ? src[key] : base[key]);
    });
    return base;
  }

  function normalizeExceptions(list) {
    if (!Array.isArray(list)) return [];
    return list.map(row => ({
      id: text(row.id || `${row.startDate || ""}-${row.endDate || ""}-${row.label || ""}`, 120),
      startDate: text(row.startDate, 12),
      endDate: text(row.endDate || row.startDate, 12),
      closed: row.closed === true,
      open: text(row.open, 8),
      close: text(row.close, 8),
      label: text(row.label, 120)
    })).filter(row => row.startDate && row.endDate);
  }

  function hoursBlurb(structured) {
    const hours = normalizeHoursStructured(structured);
    const bits = [];
    DAY_KEYS.forEach((key, idx) => {
      const day = hours[key];
      if (day.closed) return;
      bits.push(`${DAY_LABELS[idx].slice(0, 3)} ${day.open}–${day.close}`);
    });
    return bits.join(", ") || "Hours by appointment / see events";
  }

  function exceptionForDate(exceptions, date) {
    const key = ymd(date);
    if (!key) return null;
    const rows = normalizeExceptions(exceptions);
    return rows.find(row => key >= row.startDate && key <= row.endDate) || null;
  }

  function hoursForDate(clubOrHours, date, exceptions) {
    const structured = clubOrHours?.hoursStructured
      ? normalizeHoursStructured(clubOrHours.hoursStructured)
      : normalizeHoursStructured(clubOrHours);
    const exList = exceptions || clubOrHours?.hoursExceptions || [];
    const ex = exceptionForDate(exList, date);
    if (ex) {
      if (ex.closed) return {closed: true, open: "", close: "", source: "exception", label: ex.label || "Closed (special schedule)"};
      return {closed: false, open: ex.open, close: ex.close, source: "exception", label: ex.label || "Special hours"};
    }
    const key = DAY_KEYS[(date instanceof Date ? date : parseYmd(date) || new Date()).getDay()];
    const day = structured[key] || {closed: true, open: "", close: ""};
    return {...day, source: "default", label: DAY_LABELS[DAY_KEYS.indexOf(key)]};
  }

  function shiftMinutes(hhmm, deltaMinutes) {
    const clock = parseClock(hhmm);
    if (!clock) return "";
    let total = clock.hour * 60 + clock.minute + deltaMinutes;
    total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  }

  /**
   * Staff scheduling window: club open − 2h through club close + 1h.
   */
  function staffWindowForDate(club, date) {
    const hours = hoursForDate(club, date, club?.hoursExceptions);
    if (hours.closed || !hours.open || !hours.close) {
      return {closed: true, start: "", end: "", open: "", close: "", label: hours.label || "Closed"};
    }
    return {
      closed: false,
      open: hours.open,
      close: hours.close,
      start: shiftMinutes(hours.open, -120),
      end: shiftMinutes(hours.close, 60),
      source: hours.source,
      label: hours.label
    };
  }

  function openDayIndexes(club) {
    const structured = normalizeHoursStructured(club?.hoursStructured || club);
    const indexes = [];
    DAY_KEYS.forEach((key, idx) => {
      if (!structured[key].closed) indexes.push(idx);
    });
    return indexes.length ? indexes : [4, 5, 6];
  }

  function guessTimeZone(country) {
    const code = normalizeCountry(country);
    const map = {
      US: "America/New_York", CA: "America/Toronto", GB: "Europe/London",
      FR: "Europe/Paris", DE: "Europe/Berlin", NL: "Europe/Amsterdam",
      ES: "Europe/Madrid", IT: "Europe/Rome", PT: "Europe/Lisbon", BE: "Europe/Brussels"
    };
    return map[code] || "America/New_York";
  }

  /** Sunday-start week containing `anchor` (local date). */
  function startOfWeekSunday(anchor = new Date()) {
    const d = anchor instanceof Date ? new Date(anchor) : (parseYmd(anchor) || new Date());
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function formatWeekDayLabel(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${DAY_LABELS[date.getDay()].slice(0, 3)} ${date.getDate()} ${months[date.getMonth()]}`;
  }

  /**
   * Weekly range caption, always Sun → Sat (e.g. "Sun 9 – Sat 15, Aug 2026").
   * Cross-month: "Sun 30 Aug – Sat 5 Sep 2026".
   */
  function weekRangeLabel(sundayDate = startOfWeekSunday()) {
    const sun = startOfWeekSunday(sundayDate);
    const sat = addDays(sun, 6);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sameMonth = sun.getMonth() === sat.getMonth() && sun.getFullYear() === sat.getFullYear();
    if (sameMonth) {
      return `Sun ${sun.getDate()} – Sat ${sat.getDate()}, ${months[sun.getMonth()]} ${sun.getFullYear()}`;
    }
    return `Sun ${sun.getDate()} ${months[sun.getMonth()]} – Sat ${sat.getDate()} ${months[sat.getMonth()]} ${sat.getFullYear()}`;
  }

  function hoursCellLabel(hours) {
    if (!hours || hours.closed) return "Closed";
    return `${hours.open} – ${hours.close}`;
  }

  function defaultHoursForWeekday(club, weekdayIndex) {
    const structured = normalizeHoursStructured(club?.hoursStructured);
    const key = DAY_KEYS[weekdayIndex];
    return structured[key] || {closed: true, open: "", close: ""};
  }

  /**
   * Public profile: 7-column × 2-row week grid (Sun→Sat) with calendar coloring.
   * Shows the week containing `anchor` (defaults to today).
   */
  function renderHoursHtml(club, opts = {}) {
    const sunday = startOfWeekSunday(opts.anchor || new Date());
    const todayKey = ymd(new Date());
    const country = club?.country || "US";
    const headerCells = [];
    const hourCells = [];
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(sunday, i);
      const key = ymd(day);
      const holiday = holidayOn(country, day);
      const hours = hoursForDate(club, day, club?.hoursExceptions);
      const classes = [
        "venue-week-cell",
        hours.closed ? "is-closed" : "is-open",
        key === todayKey ? "is-today" : "",
        holiday ? "is-holiday" : ""
      ].filter(Boolean).join(" ");
      const dayAbbr = DAY_LABELS[i].slice(0, 3).toUpperCase();
      headerCells.push(
        `<div class="venue-week-head ${classes}" title="${holiday ? holiday.name : ""}">` +
        `<span class="venue-week-dow">${dayAbbr}</span>` +
        `<span class="venue-week-date">${day.getDate()}</span>` +
        `${holiday ? `<small class="venue-week-holiday">${holiday.name}</small>` : ""}` +
        `</div>`
      );
      hourCells.push(
        `<div class="venue-week-hours ${classes}">` +
        `<strong>${hoursCellLabel(hours)}</strong>` +
        `${hours.source === "exception" ? `<small class="venue-week-special">${hours.label || "Special"}</small>` : ""}` +
        `</div>`
      );
    }
    const exceptions = normalizeExceptions(club?.hoursExceptions).slice(0, 8).map(ex => {
      const span = ex.startDate === ex.endDate ? ex.startDate : `${ex.startDate} → ${ex.endDate}`;
      const value = ex.closed ? "Closed" : `${ex.open} – ${ex.close}`;
      return `<div class="venue-hours-exception"><span>${span}${ex.label ? ` · ${ex.label}` : ""}</span><strong>${value}</strong></div>`;
    }).join("");
    return (
      `<div class="venue-week-block">` +
      `<p class="venue-week-range">Week of ${weekRangeLabel(sunday)}</p>` +
      `<div class="venue-week-grid" role="table" aria-label="Opening hours ${weekRangeLabel(sunday)}">` +
      `<div class="venue-week-row venue-week-row-head" role="row">${headerCells.join("")}</div>` +
      `<div class="venue-week-row venue-week-row-hours" role="row">${hourCells.join("")}</div>` +
      `</div>` +
      `${exceptions ? `<div class="venue-hours-exceptions">${exceptions}</div>` : ""}` +
      `</div>`
    );
  }

  /**
   * Upcoming holidays with effective open/close vs the usual weekday schedule.
   */
  function renderUpcomingHolidaysHtml(club, opts = {}) {
    const start = opts.start instanceof Date ? opts.start : new Date();
    const end = opts.end instanceof Date ? opts.end : addDays(start, opts.daysAhead || 45);
    const limit = opts.limit || 4;
    const upcoming = holidaysInRange(club?.country || "United States", start, end).slice(0, limit);
    if (!upcoming.length) return "";
    const rows = upcoming.map(h => {
      const date = parseYmd(h.date);
      const effective = hoursForDate(club, date || h.date, club?.hoursExceptions);
      const weekday = date ? date.getDay() : 0;
      const usual = defaultHoursForWeekday(club, weekday);
      const effectiveLabel = hoursCellLabel(effective);
      const usualLabel = hoursCellLabel(usual);
      const differs = effective.closed !== usual.closed
        || (!effective.closed && !usual.closed && (effective.open !== usual.open || effective.close !== usual.close))
        || effective.source === "exception";
      let note = `Hours: ${effectiveLabel}`;
      if (differs) {
        note += effective.source === "exception"
          ? ` (special schedule; usual ${DAY_LABELS[weekday].slice(0, 3)}: ${usualLabel})`
          : ` (usual ${DAY_LABELS[weekday].slice(0, 3)}: ${usualLabel})`;
      } else {
        note += ` (same as usual ${DAY_LABELS[weekday].slice(0, 3)})`;
      }
      return `<div class="venue-holiday-row${differs ? " is-differ" : ""}"><span>${h.date} · ${h.name}</span><strong>${note}</strong></div>`;
    }).join("");
    return `<div class="venue-holiday-hours">${rows}</div>`;
  }

  global.FLOQRVenueCalendar = {
    DAY_KEYS,
    DAY_LABELS,
    ymd,
    parseYmd,
    addDays,
    startOfWeekSunday,
    weekRangeLabel,
    normalizeCountry,
    holidaysForYear,
    holidaysInRange,
    holidayOn,
    parseDayHours,
    defaultHoursStructured,
    normalizeHoursStructured,
    normalizeExceptions,
    hoursBlurb,
    hoursForDate,
    staffWindowForDate,
    openDayIndexes,
    guessTimeZone,
    renderHoursHtml,
    renderUpcomingHolidaysHtml,
    shiftMinutes
  };
})(typeof window !== "undefined" ? window : globalThis);
