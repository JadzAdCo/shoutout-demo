"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeShiftStatus,
  publishedShiftStatus,
  parseShiftBounds,
  nextStatusForShiftUpdate,
  canDeleteShiftStatus,
  isPublishedShiftStatus,
  publicShiftView,
  sanitizeShiftIds,
  workerAllowsNotifyChannel,
  clubAllowsNotifyChannel,
  shiftApproveUrl,
  buildShiftInviteBody
} = require("./scheduling-core");

test("published unassigned slots are open; assigned unpublished are pending", () => {
  assert.equal(publishedShiftStatus({asDraft: true, assigneeUid: "u1"}), "draft");
  assert.equal(publishedShiftStatus({asDraft: false, assigneeUid: "u1"}), "pending");
  assert.equal(publishedShiftStatus({asDraft: false, assigneeUid: ""}), "open");
});

test("editing a confirmed card to draft keeps one card; same-slot confirmed stays confirmed", () => {
  assert.equal(parseShiftBounds("2026-08-13T22:35:00.000Z", "2026-08-14T02:00:00.000Z")?.startMs > 0, true);
  assert.equal(parseShiftBounds("bad", "also-bad"), null);
  assert.equal(nextStatusForShiftUpdate({
    asDraft: true,
    assigneeUid: "u1",
    previousStatus: "confirmed",
    startMs: 1,
    endMs: 2,
    previousStartMs: 1,
    previousEndMs: 2,
    previousAssigneeUid: "u1"
  }), "draft");
  assert.equal(nextStatusForShiftUpdate({
    asDraft: false,
    assigneeUid: "u1",
    previousStatus: "confirmed",
    startMs: 1,
    endMs: 2,
    previousStartMs: 1,
    previousEndMs: 2,
    previousAssigneeUid: "u1"
  }), "confirmed");
  assert.equal(nextStatusForShiftUpdate({
    asDraft: false,
    assigneeUid: "u1",
    previousStatus: "confirmed",
    startMs: 10,
    endMs: 20,
    previousStartMs: 1,
    previousEndMs: 2,
    previousAssigneeUid: "u1"
  }), "pending");
});

test("approved is an alias of confirmed; pending and confirmed can be deleted", () => {
  assert.equal(normalizeShiftStatus("approved"), "confirmed");
  assert.equal(canDeleteShiftStatus("pending"), true);
  assert.equal(canDeleteShiftStatus("confirmed"), true);
  assert.equal(canDeleteShiftStatus("approved"), true);
  assert.equal(canDeleteShiftStatus("draft"), true);
});

test("worker and club channel gates default on unless explicitly off", () => {
  assert.equal(workerAllowsNotifyChannel({}, "sms"), true);
  assert.equal(workerAllowsNotifyChannel({notifySms: false}, "sms"), false);
  assert.equal(clubAllowsNotifyChannel({smsEnabled: true}, "sms"), true);
  assert.equal(clubAllowsNotifyChannel({whatsappEnabled: false}, "whatsapp"), false);
});

test("website DTO is Confirmed-only and strips private employee fields", () => {
  const {
    isPublicWebsiteShiftStatus,
    publicStatusQueryDecision,
    publicWebsiteAssignmentDto,
    publicDtoLeaksPrivateFields,
    mapConfirmedPublicAssignments,
    pickInternalVisibleAssignment,
    viewMoreHiddenCount,
    dateHasInternalActivity,
    dateHasPublicActivity,
    groupCollapsedDayColumns,
    touchesPublicScheduleCache,
    assignmentKind
  } = require("./scheduling-core");

  assert.equal(isPublicWebsiteShiftStatus("draft"), false);
  assert.equal(isPublicWebsiteShiftStatus("pending"), false);
  assert.equal(isPublicWebsiteShiftStatus("cancelled"), false);
  assert.equal(isPublicWebsiteShiftStatus("open"), false);
  assert.equal(isPublicWebsiteShiftStatus("confirmed"), true);
  assert.equal(isPublicWebsiteShiftStatus("approved"), true);

  const ignored = publicStatusQueryDecision("draft");
  assert.equal(ignored.ignored, true);
  assert.equal(ignored.enforcedStatus, "confirmed");

  const draftDto = publicWebsiteAssignmentDto({
    id: "d1", status: "draft", roleLabel: "Busboy", assigneeName: "Hidden Person",
    assigneeEmail: "hidden@example.com", notes: "secret", startsAtMs: Date.parse("2026-08-14T18:35:00")
  });
  assert.equal(draftDto, null);

  const pendingDto = publicWebsiteAssignmentDto({id: "p1", status: "pending", roleLabel: "DJ", assigneeName: "Jordan Vee"});
  assert.equal(pendingDto, null);

  const openDto = publicWebsiteAssignmentDto({id: "o1", status: "open", roleLabel: "Barman"});
  assert.equal(openDto, null);

  const ok = publicWebsiteAssignmentDto({
    id: "s1",
    status: "confirmed",
    roleLabel: "Busboy",
    assigneeName: "Andre Wells",
    assigneeEmail: "andre@example.com",
    assigneePhone: "+12025550111",
    assigneeUid: "uid-private",
    notes: "VIP section — internal",
    startsAtMs: Date.parse("2026-08-14T18:35:00"),
    endsAtMs: Date.parse("2026-08-14T22:00:00"),
    clubLocationId: "temp-democlub-1",
    venueName: "Aurelia"
  }, {id: "temp-democlub-1", name: "Aurelia"});
  assert.equal(ok.status, "CONFIRMED");
  assert.equal(ok.displayName, "Andre W.");
  assert.equal(ok.jobType.name, "Busboy");
  assert.equal(ok.startTime, "18:35");
  assert.equal(ok.endTime, "22:00");
  assert.equal(ok.venue.id, "temp-democlub-1");
  assert.equal(publicDtoLeaksPrivateFields(ok), false);
  assert.equal(ok.assigneeEmail, undefined);
  assert.equal(ok.notes, undefined);
  assert.equal(ok.assigneeUid, undefined);

  const mapped = mapConfirmedPublicAssignments([
    {id: "d1", status: "draft", roleLabel: "Busboy", assigneeName: "X", startsAtMs: Date.parse("2026-08-14T18:00:00")},
    {id: "p1", status: "pending", roleLabel: "DJ", assigneeName: "Y", startsAtMs: Date.parse("2026-08-14T19:00:00")},
    {id: "c1", status: "confirmed", roleLabel: "Waitress", assigneeName: "Priya Shah", startsAtMs: Date.parse("2026-08-14T18:35:00"), endsAtMs: Date.parse("2026-08-14T22:00:00")},
    {id: "c2", status: "confirmed", roleLabel: "Waitress", assigneeName: "Sofia Lane", startsAtMs: Date.parse("2026-08-14T18:40:00"), endsAtMs: Date.parse("2026-08-14T22:00:00")},
    {id: "x1", status: "cancelled", roleLabel: "DJ", assigneeName: "Nope", startsAtMs: Date.parse("2026-08-14T20:00:00")},
    {id: "r1", status: "rejected", roleLabel: "DJ", assigneeName: "Nope", startsAtMs: Date.parse("2026-08-14T20:00:00")},
    {id: "o1", status: "open", roleLabel: "Barman", startsAtMs: Date.parse("2026-08-15T18:00:00")}
  ], {id: "temp-democlub-1", name: "Aurelia"});
  assert.equal(mapped.length, 2);
  assert.ok(mapped.every(row => row.status === "CONFIRMED"));
  assert.equal(viewMoreHiddenCount(mapped, {website: true}), 1);

  const mixed = [
    {id: "c", status: "confirmed", assigneeName: "Ann", startsAtMs: 30, assigneeUid: "a"},
    {id: "p", status: "pending", assigneeName: "Ben", startsAtMs: 20, assigneeUid: "b"},
    {id: "d", status: "draft", assigneeName: "Cara", startsAtMs: 10, assigneeUid: "c"},
    {id: "o", status: "open", startsAtMs: 5}
  ];
  assert.equal(pickInternalVisibleAssignment(mixed).id, "o");
  assert.equal(assignmentKind(mixed[3]), "open");
  assert.equal(viewMoreHiddenCount(mixed, {website: false}), 3);
  assert.equal(viewMoreHiddenCount(mixed, {website: true}), 0);

  const friday = new Date(2026, 7, 14);
  const sunday = new Date(2026, 7, 9);
  assert.equal(dateHasInternalActivity({
    shifts: [{status: "draft", startsAtMs: Date.parse("2026-08-14T18:00:00"), assigneeUid: "u"}],
    dayDate: friday
  }), true);
  assert.equal(dateHasPublicActivity({
    assignments: mapped,
    dayDate: friday
  }), true);
  assert.equal(dateHasPublicActivity({
    assignments: mapped,
    dayDate: sunday
  }), false);

  const week = [0, 1, 2, 3, 4, 5, 6].map(n => new Date(2026, 7, 9 + n));
  const cols = groupCollapsedDayColumns(week, day => dateHasPublicActivity({assignments: mapped, dayDate: day}));
  assert.equal(cols[0].inactive, true);
  assert.equal(cols[0].days.length >= 4, true);
  assert.equal(touchesPublicScheduleCache("confirmed", "draft"), true);
  assert.equal(touchesPublicScheduleCache("pending", "draft"), false);
  assert.equal(touchesPublicScheduleCache("pending", "confirmed"), true);
});

test("sanitizeShiftIds de-dupes and caps at 80", () => {
  assert.deepEqual(sanitizeShiftIds(["a", " a ", "", "a", "b"]), ["a", "b"]);
  assert.equal(sanitizeShiftIds(Array.from({length: 100}, (_, i) => `s${i}`)).length, 80);
  assert.deepEqual(sanitizeShiftIds("not-an-array"), []);
});

test("invite body includes a confirm link", () => {
  const url = shiftApproveUrl({id: "s1", ownerKey: "club:temp-democlub-1"});
  assert.match(url, /scheduling\.html/);
  assert.match(url, /shift=s1/);
  const body = buildShiftInviteBody({
    id: "s1",
    ownerName: "Aurelia",
    roleLabel: "Busboy",
    startsAtLabel: "4:00 PM",
    endsAtLabel: "10:00 PM"
  });
  assert.match(body, /Confirm or decline/);
  assert.match(body, /scheduling\.html/);
});
