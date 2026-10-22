"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./passes-core");

test("passes-core tokens and public shape", () => {
  const token = core.newQrToken();
  assert.ok(token.length >= 20);
  const hash = core.hashToken(token);
  assert.equal(hash.length, 64);
  assert.equal(core.hashToken(token), hash);
  assert.equal(core.normalizeKind("guestEntry"), "guestEntry");
  assert.equal(core.normalizeKind("nope"), "");
  assert.equal(core.normalizeChannel("whatsapp"), "whatsapp");
  const url = core.passPublicUrl(token, "https://jadzadco.github.io/shoutout-demo");
  assert.match(url, /pass\.html\?t=/);
  const pub = core.publicPass("pass_1", {
    kind: "vipReservation",
    status: "active",
    clubLocationId: "decades-washington-dc",
    venueName: "Decades",
    night: "2026-10-22",
    label: "C3",
    guestName: "Pat",
    createdAtMs: 1
  }, {includePassToken: true, passToken: token, origin: "https://jadzadco.github.io/shoutout-demo"});
  assert.equal(pub.passId, "pass_1");
  assert.equal(pub.passToken, token);
  assert.match(pub.passUrl, /pass\.html/);
});
