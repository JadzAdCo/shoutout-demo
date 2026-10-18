"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const vipApp = fs.readFileSync(path.join(root, "vip-app.js"), "utf8");

test("VIP catalog only loads candidate venues — not every SHOUTOUT_CLUB_LOCATIONS id", () => {
  assert.match(vipApp, /function vipCandidateIds\(/);
  assert.match(vipApp, /gates\.vipReservations === true/);
  assert.match(vipApp, /Object\.keys\(PLAN_BY_ID\)/);
  assert.doesNotMatch(
    vipApp,
    /new Set\(\[\.\.\.Object\.keys\(map\),\s*\.\.\.Object\.keys\(betaMeta\)\]\)/,
    "must not iterate every club location (hangs Restoring… on ~590 Firestore gets)"
  );
});

test("VIP showApp clears Restoring status before awaiting venue catalog", () => {
  const show = vipApp.match(/async function showApp\(user\) \{[\s\S]*?\n  \}/);
  assert.ok(show, "showApp present");
  const body = show[0];
  const signedInAt = body.indexOf('page.vip.signedIn');
  const awaitAt = body.indexOf("await loadSubscribedVenues");
  assert.ok(signedInAt > 0 && awaitAt > signedInAt, "signed-in status must precede loadSubscribedVenues");
  assert.match(body, /appEl\.classList\.remove\("hidden"\)/);
});
