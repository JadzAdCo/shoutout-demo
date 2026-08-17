/* FLOQR staff-scheduling helpers — status + notify (no Firebase). */
"use strict";

const DEFAULT_ORIGIN = "https://jadzadco.github.io/shoutout-demo";

function text(value = "", max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function normalizeShiftStatus(raw = "") {
  const status = text(raw, 40).toLowerCase();
  if (status === "approved") return "confirmed";
  return status || "";
}

function publishedShiftStatus({asDraft = false, assigneeUid = ""} = {}) {
  if (asDraft) return "draft";
  return text(assigneeUid, 160) ? "pending" : "open";
}

function parseShiftBounds(startsAt, endsAt) {
  const start = text(startsAt, 40);
  const end = text(endsAt, 40);
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!start || !end || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  return {startsAt: start, endsAt: end, startMs, endMs};
}

function nextStatusForShiftUpdate({
  asDraft = false,
  assigneeUid = "",
  previousStatus = "",
  startMs = 0,
  endMs = 0,
  previousStartMs = 0,
  previousEndMs = 0,
  previousAssigneeUid = ""
} = {}) {
  if (asDraft) return "draft";
  if (!text(assigneeUid, 160)) return "open";
  const prev = normalizeShiftStatus(previousStatus);
  const timesChanged = Number(startMs) !== Number(previousStartMs) || Number(endMs) !== Number(previousEndMs);
  const assigneeChanged = text(assigneeUid, 160) !== text(previousAssigneeUid, 160);
  if (prev === "confirmed" && !timesChanged && !assigneeChanged) return "confirmed";
  return "pending";
}

function canDeleteShiftStatus(raw = "") {
  return ["draft", "pending", "confirmed", "approved", "declined", "open"].includes(normalizeShiftStatus(raw) || text(raw, 40).toLowerCase());
}

function isPublishedShiftStatus(raw = "") {
  const status = normalizeShiftStatus(raw) || text(raw, 40).toLowerCase();
  return status === "pending" || status === "confirmed" || status === "declined" || status === "open";
}

/** Website / public calendar: Confirmed only. Pending is internal (worker has not accepted). */
function isPublicWebsiteShiftStatus(raw = "") {
  return normalizeShiftStatus(raw) === "confirmed";
}

function publicWebsiteQueryStatuses() {
  return ["confirmed", "approved"];
}

function publicStatusQueryDecision(rawStatusParam = "") {
  const requested = text(rawStatusParam, 40).toLowerCase();
  return {
    requested,
    ignored: !!requested,
    enforcedStatus: "confirmed",
    queryStatuses: publicWebsiteQueryStatuses()
  };
}

function assignmentKind(shift = {}) {
  const status = normalizeShiftStatus(shift.status) || text(shift.status, 40).toLowerCase();
  if (status === "cancelled" || status === "canceled" || status === "rejected" || status === "declined") return status === "canceled" ? "cancelled" : status;
  const assignee = text(shift.assigneeUid || shift.assigneeKey, 160);
  if (status === "open" || !assignee) return "open";
  if (status === "draft") return "draft";
  if (status === "pending") return "pending";
  if (status === "confirmed") return "confirmed";
  return status || "draft";
}

function publicDisplayName(shift = {}) {
  const stage = text(shift.publicDisplayName || shift.stageName || shift.publicName, 80);
  if (stage) return stage;
  const full = text(shift.assigneeName || shift.displayName, 120);
  if (!full) return "";
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${String(last[0] || "").toUpperCase()}.`;
}

function clockHm(ms = 0, iso = "") {
  const date = Number(ms) ? new Date(Number(ms)) : (iso ? new Date(iso) : null);
  if (!date || !Number.isFinite(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localIsoDate(ms = 0) {
  const date = new Date(Number(ms) || 0);
  if (!Number.isFinite(date.getTime()) || !ms) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function jobTypeId(shift = {}) {
  const raw = text(shift.roleId || shift.roleLabel || shift.role || "shift", 80).toLowerCase();
  return raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shift";
}

function publicWebsiteAssignmentDto(shift = {}, venue = {}) {
  if (!isPublicWebsiteShiftStatus(shift.status)) return null;
  const startMs = Number(shift.startsAtMs || 0) || 0;
  return {
    id: text(shift.id, 120),
    jobType: {
      id: jobTypeId(shift),
      name: text(shift.roleLabel || shift.role, 80) || "Shift"
    },
    date: localIsoDate(startMs) || text(shift.date, 10),
    startTime: clockHm(startMs, shift.startsAt),
    endTime: clockHm(shift.endsAtMs, shift.endsAt),
    displayName: publicDisplayName(shift),
    status: "CONFIRMED",
    venue: {
      id: text(venue.id || shift.clubLocationId || shift.ownerId, 160),
      name: text(venue.name || shift.venueName || shift.ownerName, 160)
    }
  };
}

const PRIVATE_PUBLIC_DTO_KEYS = [
  "assigneeEmail", "assigneePhone", "assigneeUid", "notes", "internalNotes",
  "createdByUid", "createdByEmail", "payrollId", "permission", "email", "phone"
];

function publicDtoLeaksPrivateFields(dto = {}) {
  if (!dto || typeof dto !== "object") return true;
  const keys = Object.keys(dto);
  if (keys.some(key => PRIVATE_PUBLIC_DTO_KEYS.includes(key))) return true;
  const blob = JSON.stringify(dto);
  return /assigneeEmail|assigneePhone|assigneeUid|"notes"|payrollId/.test(blob);
}

function publicAssignmentSort(a = {}, b = {}) {
  const time = String(a.startTime || "").localeCompare(String(b.startTime || ""));
  if (time) return time;
  const job = String(a.jobType?.name || "").localeCompare(String(b.jobType?.name || ""));
  if (job) return job;
  return String(a.displayName || "").localeCompare(String(b.displayName || ""));
}

function mapConfirmedPublicAssignments(rows = [], venue = {}) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => publicWebsiteAssignmentDto(row, venue))
    .filter(Boolean)
    .sort(publicAssignmentSort);
}

function internalCardPriority(kind = "") {
  return {open: 0, draft: 1, pending: 2, confirmed: 3}[kind] ?? 9;
}

function pickInternalVisibleAssignment(assignments = []) {
  return [...(Array.isArray(assignments) ? assignments : [])].sort((a, b) => {
    const kind = internalCardPriority(assignmentKind(a)) - internalCardPriority(assignmentKind(b));
    if (kind) return kind;
    const time = Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0);
    if (time) return time;
    return String(a.assigneeName || a.displayName || "").localeCompare(String(b.assigneeName || b.displayName || ""));
  })[0] || null;
}

function viewMoreHiddenCount(assignments = [], {website = false} = {}) {
  const rows = Array.isArray(assignments) ? assignments : [];
  const pool = website
    ? rows.filter(row => row.status === "CONFIRMED" || isPublicWebsiteShiftStatus(row.status))
    : rows.filter(row => ["open", "draft", "pending", "confirmed"].includes(assignmentKind(row)));
  return Math.max(0, pool.length - (pool.length ? 1 : 0));
}

function shiftOnLocalDay(shift = {}, dayDate) {
  const ms = Number(shift.startsAtMs || Date.parse(shift.startsAt) || 0);
  if (!ms || !dayDate) return false;
  const a = new Date(ms);
  return a.getFullYear() === dayDate.getFullYear()
    && a.getMonth() === dayDate.getMonth()
    && a.getDate() === dayDate.getDate();
}

function dateHasInternalActivity({shifts = [], requirements = [], dayDate} = {}) {
  if ((Array.isArray(shifts) ? shifts : []).some(row => shiftOnLocalDay(row, dayDate) && ["open", "draft", "pending", "confirmed"].includes(assignmentKind(row)))) {
    return true;
  }
  const weekday = dayDate instanceof Date ? dayDate.getDay() : -1;
  return (Array.isArray(requirements) ? requirements : []).some(row => Number(row.weekday ?? row.dayOfWeek) === weekday && Number(row.neededCount || row.needed || 0) > 0);
}

function dateHasPublicActivity({assignments = [], dayDate} = {}) {
  return (Array.isArray(assignments) ? assignments : []).some(row => {
    if (row.date && dayDate instanceof Date) {
      const iso = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
      return row.date === iso && (row.status === "CONFIRMED" || isPublicWebsiteShiftStatus(row.status));
    }
    return isPublicWebsiteShiftStatus(row.status) && shiftOnLocalDay(row, dayDate);
  });
}

function groupCollapsedDayColumns(days = [], isActiveFn) {
  const columns = [];
  (Array.isArray(days) ? days : []).forEach((day, idx) => {
    const active = typeof isActiveFn === "function" ? !!isActiveFn(day, idx) : true;
    const prev = columns[columns.length - 1];
    if (!active && prev && prev.inactive) {
      prev.endIdx = idx;
      prev.days.push(day);
      return;
    }
    columns.push({
      startIdx: idx,
      endIdx: idx,
      days: [day],
      inactive: !active
    });
  });
  return columns;
}

function publicShiftView(shift = {}, {includeNotes = false} = {}) {
  const status = normalizeShiftStatus(shift.status) || text(shift.status, 40) || "pending";
  const row = {
    id: text(shift.id, 120),
    roleLabel: text(shift.roleLabel || shift.role, 80) || "Shift",
    assigneeName: text(shift.assigneeName, 120),
    startsAtMs: Number(shift.startsAtMs || 0) || 0,
    endsAtMs: Number(shift.endsAtMs || 0) || 0,
    startsAt: text(shift.startsAt, 80),
    endsAt: text(shift.endsAt, 80),
    status
  };
  if (includeNotes) row.notes = text(shift.notes, 240);
  return row;
}

function touchesPublicScheduleCache(previousStatus = "", nextStatus = "") {
  return isPublicWebsiteShiftStatus(previousStatus) || isPublicWebsiteShiftStatus(nextStatus);
}

function sanitizeShiftIds(raw = [], max = 80) {
  const seen = new Set();
  const ids = [];
  (Array.isArray(raw) ? raw : []).forEach(value => {
    const id = text(value, 120);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  const cap = Number.isFinite(Number(max)) ? Math.max(1, Math.min(80, Number(max))) : 80;
  return ids.slice(0, cap);
}

function workerAllowsNotifyChannel(user = {}, channel = "") {
  const row = user && typeof user === "object" ? user : {};
  const privacy = row.privacy && typeof row.privacy === "object" ? row.privacy : {};
  const key = text(channel, 20).toLowerCase();
  const explicit = {
    inapp: row.notifyInApp ?? privacy.notifyInApp,
    email: row.notifyEmail ?? row.emailNotifications ?? privacy.notifyEmail,
    sms: row.notifySms ?? row.smsNotifications ?? privacy.notifySms,
    whatsapp: row.notifyWhatsapp ?? row.whatsappNotifications ?? privacy.notifyWhatsapp,
    push: row.notifyPush ?? privacy.notifyPush
  }[key === "in-app" ? "inapp" : key];
  if (explicit === false || explicit === 0 || explicit === "0") return false;
  return true;
}

function clubAllowsNotifyChannel(settings = {}, channel = "") {
  const key = text(channel, 20).toLowerCase();
  if (key === "sms") return settings.smsEnabled !== false && (settings.smsSubscribed || settings.smsPaidAt || settings.smsEnabled === true || settings.notifySms === true);
  if (key === "whatsapp") return settings.whatsappEnabled === true || settings.notifyWhatsapp === true;
  if (key === "email") return settings.emailEnabled !== false && settings.notifyEmail !== false;
  if (key === "inapp" || key === "in-app") return settings.notifyInApp !== false;
  return true;
}

const SCHEDULE_MESSAGE_TEMPLATE_IDS = ["schedule-invite", "schedule-update", "shift-confirmed", "shift-declined"];

const DEFAULT_SCHEDULE_MESSAGE_TEMPLATES = {
  "schedule-invite": {
    title: "New shift needs your confirmation",
    body: "{club} schedule: {role} {when}. Confirm or decline this shift: {link}"
  },
  "schedule-update": {
    title: "Schedule update",
    body: "{club} updated your {role} {when}. Review it here: {link}"
  },
  "shift-confirmed": {
    title: "Shift confirmed",
    body: "{worker} confirmed the {role} on {when}."
  },
  "shift-declined": {
    title: "Shift declined",
    body: "{worker} declined the {role} on {when}."
  }
};

function shiftApproveUrl(shift = {}, origin = DEFAULT_ORIGIN) {
  const base = String(origin || DEFAULT_ORIGIN).replace(/\/$/, "");
  const url = new URL(`${base}/patron-portal.html`);
  url.searchParams.set("tab", "work-calendar");
  if (shift.id) url.searchParams.set("shift", String(shift.id));
  if (shift.ownerKey) url.searchParams.set("owner", String(shift.ownerKey));
  url.searchParams.set("from", "schedule-notify");
  url.searchParams.set("v", "s3.0.3");
  return url.toString();
}

function shiftApprovePath(shift = {}) {
  const url = new URL(shiftApproveUrl(shift, DEFAULT_ORIGIN));
  return `.${url.pathname}${url.search}`;
}

function resolveScheduleMessageTemplate(kind = "", clubTemplates = {}) {
  const id = SCHEDULE_MESSAGE_TEMPLATE_IDS.includes(text(kind, 40)) ? text(kind, 40) : "schedule-invite";
  const fallback = DEFAULT_SCHEDULE_MESSAGE_TEMPLATES[id];
  const override = clubTemplates && typeof clubTemplates === "object" ? clubTemplates[id] : null;
  return {
    id,
    title: text(override?.title, 160) || fallback.title,
    body: text(override?.body, 1500) || fallback.body
  };
}

function fillScheduleMessageTemplate(template = {}, vars = {}) {
  const replace = value => String(value || "").replace(/\{(club|role|when|link|worker)\}/g, (_, key) => String(vars[key] ?? ""));
  return {
    title: text(replace(template.title), 160),
    body: text(replace(template.body), 1500)
  };
}

function scheduleMessageVars(shift = {}, origin = DEFAULT_ORIGIN) {
  const when = [shift.startsAtLabel, shift.endsAtLabel].filter(Boolean).join(" – ")
    || [shift.startsAt, shift.endsAt].filter(Boolean).join(" – ");
  return {
    club: shift.ownerName || shift.venueName || "FLOQR",
    role: shift.roleLabel || shift.role || "Shift",
    when,
    link: shiftApproveUrl(shift, origin),
    worker: shift.assigneeName || "Worker"
  };
}

function buildShiftInviteMessage(shift = {}, origin = DEFAULT_ORIGIN, clubTemplates = {}) {
  const pending = normalizeShiftStatus(shift.status) === "pending" || !normalizeShiftStatus(shift.status);
  const kind = pending ? "schedule-invite" : "schedule-update";
  return fillScheduleMessageTemplate(
    resolveScheduleMessageTemplate(kind, clubTemplates),
    scheduleMessageVars(shift, origin)
  );
}

function buildShiftInviteBody(shift = {}, origin = DEFAULT_ORIGIN, clubTemplates = {}) {
  return buildShiftInviteMessage(shift, origin, clubTemplates).body;
}

module.exports = {
  DEFAULT_ORIGIN,
  normalizeShiftStatus,
  publishedShiftStatus,
  parseShiftBounds,
  nextStatusForShiftUpdate,
  canDeleteShiftStatus,
  isPublishedShiftStatus,
  isPublicWebsiteShiftStatus,
  publicWebsiteQueryStatuses,
  publicStatusQueryDecision,
  assignmentKind,
  publicDisplayName,
  publicWebsiteAssignmentDto,
  publicDtoLeaksPrivateFields,
  mapConfirmedPublicAssignments,
  pickInternalVisibleAssignment,
  viewMoreHiddenCount,
  dateHasInternalActivity,
  dateHasPublicActivity,
  groupCollapsedDayColumns,
  touchesPublicScheduleCache,
  publicShiftView,
  sanitizeShiftIds,
  workerAllowsNotifyChannel,
  clubAllowsNotifyChannel,
  SCHEDULE_MESSAGE_TEMPLATE_IDS,
  DEFAULT_SCHEDULE_MESSAGE_TEMPLATES,
  shiftApproveUrl,
  shiftApprovePath,
  resolveScheduleMessageTemplate,
  fillScheduleMessageTemplate,
  scheduleMessageVars,
  buildShiftInviteMessage,
  buildShiftInviteBody
};
