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
  const clearAt = body.indexOf('setStatus("")');
  const awaitAt = body.indexOf("await loadSubscribedVenues");
  assert.ok(clearAt > 0 && awaitAt > clearAt, "status clear must precede loadSubscribedVenues");
  assert.doesNotMatch(body, /page\.vip\.signedIn/);
  assert.match(body, /appEl\.classList\.remove\("hidden"\)/);
});

test("VIP hero puts help ? beside intro subcopy — no green Signed-in chrome", () => {
  const html = fs.readFileSync(path.join(root, "vip.html"), "utf8");
  assert.match(html, /vip-sub-row/);
  assert.match(html, /data-i18n="page\.vip\.sub"/);
  assert.match(html, /help-vip-book-table/);
  assert.doesNotMatch(html, /data-i18n="page\.vip\.restoring"/);
  assert.doesNotMatch(html, /data-i18n="page\.vip\.signedIn"/);
  const css = fs.readFileSync(path.join(root, "vip.css"), "utf8");
  assert.match(css, /\.vip-sub-row/);
  assert.match(css, /\.vip-page \.status:empty/);
});
