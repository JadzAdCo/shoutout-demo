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

test("VIP hero nests intro/venue hints in ? next to headings — no green Signed-in chrome", () => {
  const html = fs.readFileSync(path.join(root, "vip.html"), "utf8");
  assert.match(html, /vip-title-row/);
  assert.match(html, /vip-section-head/);
  assert.match(html, /help-vip-book-table/);
  assert.match(html, /help-vip-choose-venue/);
  assert.match(html, /data-i18n="page\.vip\.sub"/);
  assert.match(html, /data-i18n="page\.vip\.searchHint"/);
  assert.doesNotMatch(html, /vip-sub-row/);
  assert.doesNotMatch(html, /data-i18n="page\.vip\.restoring"/);
  assert.doesNotMatch(html, /data-i18n="page\.vip\.signedIn"/);
  // Intro and search hint live inside help popouts, not as visible paragraph chrome under the titles.
  assert.doesNotMatch(html, /<h1[^>]*>[\s\S]*?<p class="sub" data-i18n="page\.vip\.sub">/);
  assert.doesNotMatch(html, /<h2[^>]*data-i18n="page\.vip\.chooseVenue"[^>]*>[\s\S]*?<p class="sub small" data-i18n="page\.vip\.searchHint">/);
  const css = fs.readFileSync(path.join(root, "vip.css"), "utf8");
  assert.match(css, /\.vip-title-row/);
  assert.match(css, /\.vip-section-head/);
  assert.match(css, /\.vip-page \.status:empty/);
});

test("VIP landing hero uses chrome pack (nightlife default + traditional swap)", () => {
  const html = fs.readFileSync(path.join(root, "vip.html"), "utf8");
  assert.match(html, /data-floqr-chrome-icon="vipReserv"/);
  assert.match(html, /images\/chrome\/vip-nightlife\.jpg/);
  assert.doesNotMatch(html, /vip-reserv-icon\.svg/);
  assert.match(html, /floqr-chrome-scheme\.js\?v=s3\.\d+\.\d+/);
  const terms = fs.readFileSync(path.join(root, "vip-terms.html"), "utf8");
  assert.match(terms, /data-floqr-chrome-icon="vipReserv"/);
  assert.match(terms, /floqr-chrome-scheme\.js\?v=s3\.\d+\.\d+/);
  const chrome = fs.readFileSync(path.join(root, "floqr-chrome-scheme.js"), "utf8");
  assert.match(chrome, /vipReserv: "\.\/images\/chrome\/vip-nightlife\.jpg/);
  assert.match(chrome, /vipReserv: "\.\/images\/chrome\/vip-traditional\.jpg/);
  assert.match(vipApp, /hydrateSiteChrome/);
  assert.match(vipApp, /FLOQRChromeScheme/);
});

test("VIP table details open as centered pop-out — not a bottom sheet", () => {
  const html = fs.readFileSync(path.join(root, "vip.html"), "utf8");
  assert.match(html, /id="vipTablePopoutBackdrop"/);
  assert.match(html, /aside class="info vip-table-popout"/);
  const css = fs.readFileSync(path.join(root, "vip-floor-viewer.css"), "utf8");
  assert.match(css, /\.vip-table-popout-backdrop/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /transform:\s*translate\(-50%,\s*-50%\)/);
  assert.doesNotMatch(css, /selected table details sit below the map/);
  const viewer = fs.readFileSync(path.join(root, "vip-floor-viewer.js"), "utf8");
  assert.match(viewer, /setTablePopoutOpen/);
  assert.match(viewer, /vipTablePopoutBackdrop/);
  assert.doesNotMatch(viewer, /bottom sheet covers the lower half/);
});

test("VIP inventory uses isReserved 0|1 datapoint", () => {
  assert.match(vipApp, /Number\(s\.isReserved\) === 1/);
  const fns = fs.readFileSync(path.join(root, "functions/vip-functions.js"), "utf8");
  assert.match(fns, /isReserved/);
  assert.match(fns, /isReserved:\s*1/);
  assert.match(fns, /isReserved:\s*0/);
  assert.match(fns, /Number\(inv\.isReserved\) === 1/);
});

test("VIP setStates includes available — single source of truth with list/map", () => {
  assert.match(vipApp, /states\[id\] = "available"/);
  assert.match(vipApp, /states\[id\] = "booked"/);
  assert.match(vipApp, /states\[id\] = "held"/);
  const viewer = fs.readFileSync(path.join(root, "vip-floor-viewer.js"), "utf8");
  assert.match(viewer, /data-live-state/);
  assert.match(viewer, /seat-status/);
  assert.match(viewer, /Opaque underlay/);
  const svg = fs.readFileSync(path.join(root, "vip-plans/aurelia-floor-map.svg"), "utf8");
  assert.match(svg, /data-state="neutral"/);
  assert.equal((svg.match(/data-state="booked"/g) || []).length, 0);
  assert.equal((svg.match(/>Booked</g) || []).length, 0);
  assert.equal((svg.match(/>Available</g) || []).length, 0);
});
