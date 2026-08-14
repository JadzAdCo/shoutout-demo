"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeShiftStatus,
  publishedShiftStatus,
  canDeleteShiftStatus,
  isPublishedShiftStatus,
  publicShiftView,
  sanitizeShiftIds,
  workerAllowsNotifyChannel,
  clubAllowsNotifyChannel,
  shiftApproveUrl,
  buildShiftInviteBody
} = require("./scheduling-core");

test("published shifts are pending until the worker confirms", () => {
  assert.equal(publishedShiftStatus({asDraft: true, assigneeUid: "u1"}), "draft");
  assert.equal(publishedShiftStatus({asDraft: false, assigneeUid: "u1"}), "pending");
  assert.equal(publishedShiftStatus({asDraft: false, assigneeUid: ""}), "draft");
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

test("public website feed omits drafts and private worker fields", () => {
  assert.equal(isPublishedShiftStatus("draft"), false);
  assert.equal(isPublishedShiftStatus("pending"), true);
  assert.equal(isPublishedShiftStatus("confirmed"), true);
  const view = publicShiftView({
    id: "s1",
    status: "confirmed",
    roleLabel: "Host",
    assigneeName: "Priya Shah",
    assigneeEmail: "priya@example.com",
    assigneePhone: "+12025550111",
    notes: "VIP section",
    startsAtMs: 1
  });
  assert.equal(view.assigneeName, "Priya Shah");
  assert.equal(view.status, "confirmed");
  assert.equal(view.assigneeEmail, undefined);
  assert.equal(view.notes, undefined);
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
