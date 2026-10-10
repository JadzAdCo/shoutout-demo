/* FLOQR structured clock datapoints — never bundle wall-clock into one opaque string for scheduling / hail / crawl. */
(function (root) {
  "use strict";

  const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const DAY_LABELS = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday"
  };

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function normalizeMeridiem(value = "") {
    const raw = String(value || "").trim().toUpperCase();
    if (raw === "A" || raw === "AM" || raw === "A.M.") return "AM";
    if (raw === "P" || raw === "PM" || raw === "P.M.") return "PM";
    return "";
  }

  /** Atomic wall-clock: hour 1–12, minute 0–59, meridiem AM|PM. */
  function makeClock({hour = 10, minute = 0, meridiem = "PM"} = {}) {
    const mer = normalizeMeridiem(meridiem) || "PM";
    const h = clampInt(hour, 1, 12, 10);
    const m = clampInt(minute, 0, 59, 0);
    return {
      hour: h,
      minute: m,
      meridiem: mer,
      hour24: toHour24(h, mer),
      minutePadded: String(m).padStart(2, "0"),
      display: `${h}:${String(m).padStart(2, "0")} ${mer}`
    };
  }

  function toHour24(hour12, meridiem) {
    const h = clampInt(hour12, 1, 12, 12);
    const mer = normalizeMeridiem(meridiem) || "AM";
    if (mer === "AM") return h === 12 ? 0 : h;
    return h === 12 ? 12 : h + 12;
  }

  function fromHour24(hour24 = 0, minute = 0) {
    const h24 = clampInt(hour24, 0, 23, 0);
    const m = clampInt(minute, 0, 59, 0);
    const meridiem = h24 >= 12 ? "PM" : "AM";
    let hour = h24 % 12;
    if (hour === 0) hour = 12;
    return makeClock({hour, minute: m, meridiem});
  }

  function parseLooseClock(value = "") {
    const raw = String(value || "").trim();
    if (!raw || /^closed$/i.test(raw)) return null;
    const m12 = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/i);
    if (m12) {
      return makeClock({hour: Number(m12[1]), minute: Number(m12[2] || 0), meridiem: m12[3]});
    }
    const m24 = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return fromHour24(Number(m24[1]), Number(m24[2]));
    return null;
  }

  /**
   * Weekly hours: each day has closed flag + open/close clocks as separate datapoints.
   * Legacy string forms (fri:"19:00-03:00") are accepted and expanded.
   */
  function normalizeWeekHours(input = {}) {
    const src = input && typeof input === "object" ? input : {};
    const out = {timezone: String(src.timezone || src.tz || "America/New_York"), days: {}};
    DAYS.forEach((day) => {
      const short = day.slice(0, 3);
      const row = src.days?.[day] || src[day] || src[short] || src[DAY_LABELS[day]] || {};
      if (typeof row === "string") {
        if (/closed/i.test(row)) {
          out.days[day] = {day, dayLabel: DAY_LABELS[day], closed: true, open: null, close: null};
          return;
        }
        const parts = row.split(/\s*-\s*|–|—/);
        const open = parseLooseClock(parts[0]);
        const close = parseLooseClock(parts[1] || "");
        out.days[day] = {day, dayLabel: DAY_LABELS[day], closed: !open, open, close};
        return;
      }
      const closed = row.closed === true || String(row.status || "").toLowerCase() === "closed";
      const open = closed ? null : (row.open?.hour != null
        ? makeClock(row.open)
        : parseLooseClock(row.openDisplay || row.open || row.openTime || ""));
      const close = closed ? null : (row.close?.hour != null
        ? makeClock(row.close)
        : parseLooseClock(row.closeDisplay || row.close || row.closeTime || ""));
      out.days[day] = {
        day,
        dayLabel: DAY_LABELS[day],
        closed: closed || !open,
        open: closed ? null : open,
        close: closed ? null : close
      };
    });
    return out;
  }

  function formatWeekHoursLines(week = {}) {
    const normalized = normalizeWeekHours(week);
    return DAYS.map((day) => {
      const row = normalized.days[day];
      if (!row || row.closed || !row.open) return `${DAY_LABELS[day]}: Closed`;
      const close = row.close?.display || "—";
      return `${DAY_LABELS[day]}: ${row.open.display} – ${close}`;
    });
  }

  /** Crawl / discovery: expand free-text hours into atomic datapoints before UI/AI input. */
  function normalizeCrawledHoursText(text = "", timezone = "America/New_York") {
    const raw = String(text || "");
    const draft = {timezone, days: {}};
    DAYS.forEach((d) => { draft.days[d] = {closed: true}; });
    const dayMap = {
      mon: "monday", monday: "monday",
      tue: "tuesday", tues: "tuesday", tuesday: "tuesday",
      wed: "wednesday", wednesday: "wednesday",
      thu: "thursday", thur: "thursday", thursday: "thursday",
      fri: "friday", friday: "friday",
      sat: "saturday", saturday: "saturday",
      sun: "sunday", sunday: "sunday"
    };
    raw.split(/;|\n/).map((s) => s.trim()).filter(Boolean).forEach((chunk) => {
      const closed = /closed/i.test(chunk);
      const range = chunk.match(/([A-Za-z]+)\s*[–-]\s*([A-Za-z]+)/);
      const single = chunk.match(/^([A-Za-z]+)\b/);
      const timeRange = chunk.match(/(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|\d{2}:\d{2})?)\s*[–-]\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i)
        || chunk.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      let days = [];
      if (range) {
        const a = dayMap[range[1].toLowerCase()];
        const b = dayMap[range[2].toLowerCase()];
        if (a && b) {
          const i0 = DAYS.indexOf(a);
          const i1 = DAYS.indexOf(b);
          if (i0 >= 0 && i1 >= 0) {
            for (let i = i0; ; i = (i + 1) % 7) {
              days.push(DAYS[i]);
              if (i === i1) break;
              if (days.length > 7) break;
            }
          }
        }
      } else if (single) {
        const d = dayMap[single[1].toLowerCase()];
        if (d) days = [d];
      }
      days.forEach((day) => {
        if (closed) {
          draft.days[day] = {closed: true};
          return;
        }
        if (timeRange) {
          draft.days[day] = {
            closed: false,
            open: parseLooseClock(timeRange[1]) || makeClock({hour: 10, minute: 0, meridiem: "PM"}),
            close: parseLooseClock(timeRange[2]) || makeClock({hour: 2, minute: 0, meridiem: "AM"})
          };
        }
      });
    });
    return normalizeWeekHours(draft);
  }

  const api = {
    DAYS,
    DAY_LABELS,
    makeClock,
    fromHour24,
    parseLooseClock,
    normalizeWeekHours,
    formatWeekHoursLines,
    normalizeCrawledHoursText,
    toHour24
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FLOQRStructuredTime = api;
})(typeof window !== "undefined" ? window : globalThis);
