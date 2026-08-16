"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const card = require("../assignment-card.js");

test("AssignmentCard uses one geometry and written status for every state", () => {
  const draft = card.render({id: "d1", assigneeName: "Taylor Reed", startsAtMs: Date.parse("2026-08-13T18:35:00"), endsAtMs: Date.parse("2026-08-13T22:00:00")}, {kind: "draft"});
  const pending = card.render({id: "p1", assigneeName: "Jordan Vee", startsAtMs: Date.parse("2026-08-14T18:35:00"), endsAtMs: Date.parse("2026-08-14T22:00:00")}, {kind: "pending"});
  const confirmed = card.render({id: "c1", assigneeName: "Priya Shah", startsAtMs: Date.parse("2026-08-15T18:35:00"), endsAtMs: Date.parse("2026-08-15T22:00:00")}, {kind: "confirmed"});
  const open = card.render({id: "o1", startsAtMs: Date.parse("2026-08-15T18:35:00"), endsAtMs: Date.parse("2026-08-15T22:00:00")}, {kind: "open"});

  assert.match(draft, /assignment-card is-draft/);
  assert.match(draft, /<span class="assignment-card-status-label">Draft<\/span>/);
  assert.match(pending, /assignment-card is-pending/);
  assert.match(pending, />Pending</);
  assert.match(confirmed, /assignment-card is-confirmed/);
  assert.match(confirmed, />Confirmed</);
  assert.match(open, /assignment-card is-open/);
  assert.match(open, />Unfilled</);
  assert.match(open, /Open shift/);

  [draft, pending, confirmed, open].forEach(html => {
    assert.match(html, /assignment-card-head/);
    assert.match(html, /assignment-card-time/);
    assert.match(html, /assignment-card-status/);
    assert.match(html, /assignment-card-status-label/);
  });
  assert.equal(card.viewMoreLink(0), "");
  assert.match(card.viewMoreLink(1), /View more \(1\)/);
});
