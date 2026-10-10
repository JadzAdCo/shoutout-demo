"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
const people = require("../scheduling-assignee-picker.js");

const LANGS = 11;

test("roster: club / company designations, rejected and other teams skipped", () => {
  const rows = [
    {workerUid: "u1", workerName: "Ana", roleElectionType: "Bartender", clubLocationId: "zebbies", status: "active"},
    {workerUid: "u2", workerName: "Ben", workerRoles: ["Door"], clubLocationId: "zebbies", status: "rejected"},
    {workerUid: "u3", workerName: "Cy", clubLocationId: "heist", promoterCompany: "Night Co"},
    {workerName: "No uid", clubLocationId: "zebbies"}
  ];
  assert.deepEqual(people.rosterFromDesignations(rows, {ownerType: "club", ownerId: "zebbies"}).map(p => [p.uid, p.role]), [["u1", "Bartender"]]);
  assert.deepEqual(people.rosterFromDesignations(rows, {ownerType: "promoterCompany", ownerId: "night co"}).map(p => p.uid), ["u3"]);
});

test("directory rows: team flag from the club-only phone field; placeholder name dropped", () => {
  assert.equal(people.directoryPerson({uid: "a", displayName: "Dee", phone: "+1"}).team, true);
  const minimal = people.directoryPerson({uid: "b", displayName: "Member"});
  assert.equal(minimal.team, false);
  assert.equal(minimal.name, "");
  assert.equal(people.directoryPerson({uid: "c", approvedRoles: ["DJ"]}).role, "DJ");
});

test("options: you first, then team, then everyone else; name + role; uid never in a label", () => {
  const options = people.assigneeOptions({
    self: {uid: "me", name: "Don", email: "d@x.com"},
    roster: [{uid: "u1", name: "Zoe", role: "Door", email: "", phone: "", team: true}],
    directory: [
      {uid: "u1", displayName: "Zoe", email: "zoe@x.com", phone: "+12025550100"},
      {uid: "u9", displayName: "Member"},
      {uid: "u5", displayName: "Abe", approvedRoles: ["DJ"]}
    ],
    labels: {you: "vous", member: "Membre", team: "Équipe"}
  });
  assert.deepEqual(options.map(o => o.value), ["me", "u1", "u5", "u9"]);
  assert.equal(options[0].label, "Don (vous) · Membre");
  assert.equal(options[1].label, "Zoe · Door");
  assert.equal(options[1].email, "zoe@x.com", "directory fills contact details the roster lacked");
  assert.equal(options[1].phone, "+12025550100");
  assert.equal(options[2].label, "Abe · DJ");
  assert.equal(options[3].label, "Membre");
  options.forEach(option => assert.ok(!option.label.includes(option.value), `${option.value} leaked into label`));
});

test("search matches name, role or email — never the uid", () => {
  const options = people.assigneeOptions({
    roster: [{uid: "secret-uid-1", name: "Zoe", role: "Door", email: "zoe@x.com", phone: "", team: true}],
    directory: [{uid: "secret-uid-2", displayName: "Abe", approvedRoles: ["DJ"]}]
  });
  assert.deepEqual(people.filterPeople(options, "dj").map(o => o.value), ["secret-uid-2"]);
  assert.deepEqual(people.filterPeople(options, "zoe@").map(o => o.value), ["secret-uid-1"]);
  assert.deepEqual(people.filterPeople(options, "secret-uid"), []);
  assert.equal(people.filterPeople(options, "").length, 2);
});

test("scheduling.html: Assign to picker replaces the Assignee uid box; scripts load in order", () => {
  const html = read("scheduling.html");
  assert.doesNotMatch(html, /portalAssigneeUid|Assignee uid|portalAssigneeName/);
  assert.match(html, /<select id="portalAssignee"><\/select>/);
  const order = ["floqr-i18n.js", "floqr-nav.js", "floqai-help-repository.js", "scheduling-owner-picker.js", "scheduling-assignee-picker.js", "scheduling-portal.js"]
    .map(file => html.indexOf(`./${file}?v=`));
  order.forEach(index => assert.ok(index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "script order");
  assert.doesNotMatch(html, /staffSchedulingPaid/, "no internal field names on the page");
});

test("scheduling-portal.js: stores the picked uid, uses the people directory, no raw-uid prompt", () => {
  const js = read("scheduling-portal.js");
  assert.match(js, /assigneeUid: person\.value/);
  assert.match(js, /callable\("getPeopleDirectory"\)/);
  assert.match(js, /mode: "club", clubLocationId: id/);
  assert.doesNotMatch(js, /portalAssigneeUid|staffSchedulingPaid=/);
  assert.doesNotMatch(js, /setStatus\(\s*["'`]/, "every status line goes through t()");
});

test("every sched.* key used on the Scheduling page exists in all 11 chrome packs", () => {
  const chrome = read("floqr-i18n.js");
  const html = read("scheduling.html");
  const keys = new Set();
  for (const file of ["scheduling-portal.js", "worker-confirm.js", "assignment-card.js"]) {
    for (const hit of read(file).matchAll(/["'](sched\.[A-Za-z]+)["']/g)) keys.add(hit[1]);
  }
  for (const hit of html.matchAll(/data-i18n(?:-placeholder)?="(sched\.[A-Za-z]+)"/g)) keys.add(hit[1]);
  assert.ok(keys.size > 60, `found ${keys.size} keys`);
  const missing = [...keys].filter(key => (chrome.match(new RegExp(`"${key.replace(".", "\\.")}":`, "g")) || []).length !== LANGS);
  assert.deepEqual(missing, []);
});

test("shared confirm list and cards fall back to English when FLOQRI18n is absent", () => {
  const card = require("../assignment-card.js");
  const html = card.render({assigneeName: "Zoe", status: "pending", startsAt: "2026-10-10T20:00:00Z", endsAt: "2026-10-11T02:00:00Z"});
  assert.match(html, /assignment-card-status-label">Pending</);
  const confirm = read("worker-confirm.js");
  assert.match(confirm, /tr\("sched\.approveSelected", "Approve selected"\)/);
  assert.match(confirm, /tr\("sched\.selectAll", "Select all \(\{count\}\)", \{count: rows\.length\}\)/);
});
