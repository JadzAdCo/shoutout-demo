"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
const pkgVersion = `s${JSON.parse(read("functions/package.json")).version}`;

function loadNav() {
  const win = {location: {href: "https://x/admin.html?location=zebbies", pathname: "/admin.html", hash: ""}, URL, URLSearchParams};
  vm.runInNewContext(read("floqr-nav.js"), {window: win, URL, URLSearchParams});
  return win.FLOQRNav;
}

test("FLOQRNav.appVersion equals the package version (bump floqr-nav.js with functions/package.json)", () => {
  assert.equal(loadNav().appVersion, pkgVersion);
});

test("README CURRENT PACKAGE matches functions/package.json", () => {
  const head = read("README.md").match(/# CURRENT PACKAGE: FLOQR ShoutOut (s\d+\.\d+\.\d+)/);
  assert.ok(head, "README CURRENT PACKAGE line");
  assert.equal(head[1], pkgVersion);
});

test("generated links stamp the current package; Display boards stay location-only", () => {
  const nav = loadNav();
  assert.match(nav.adminPortalUrl("zebbies"), new RegExp(`[?&]v=${pkgVersion.replace(/\./g, "\\.")}(&|$)`));
  assert.match(nav.stampCurrentVersion("./floqai.html"), new RegExp(`v=${pkgVersion.replace(/\./g, "\\.")}`));
  assert.equal(nav.stableDisplayUrl("zebbies"), "./display.html?location=zebbies");
  assert.equal(nav.stampCurrentVersion("./display2.html?location=zebbies&v=s3.0.1"), "./display2.html?location=zebbies");
});

const LINK_BUILDERS = [
  "floqai-help-repository.js",
  "intent-search.js",
  "floqai-page.js",
  "floqai-access.js",
  "scheduling-portal.js",
  "scheduling-owner-picker.js",
  "scheduling-assignee-picker.js"
];
const HUB_LINK = /\.\/(?:floqai|scheduling|patron-portal|admin|master-admin)\.html\?(?:[^"'\s#<>]*?(?:&amp;|&))?v=([^"'&\s#<>]+)/g;
const rootDir = path.resolve(__dirname, "..");
const htmlPages = () => fs.readdirSync(rootDir).filter((name) => name.endsWith(".html"));

test("link builders never hardcode a package: no ?v=<version> literal and no stale version fallback", () => {
  const hits = LINK_BUILDERS.flatMap((file) => {
    const src = read(file);
    return [
      ...src.matchAll(/\?v=(?:s\d+\.\d+\.\d+|\d+\.\d+\.\d+)/g),
      ...src.matchAll(/\|\|\s*["'](?:s\d+\.\d+\.\d+|\d+\.\d+\.\d+)["']/g),
      ...src.matchAll(/\?v=\$\{APP_V\}/g)
    ].map((hit) => `${file}: ${hit[0]}`);
  });
  assert.deepEqual(hits, []);
});

test("FloqAi help links stamp FLOQRNav.appVersion, and carry no version at all when nav is missing", () => {
  const load = (nav) => {
    const win = {URLSearchParams, console, FLOQRNav: nav};
    win.window = win;
    vm.runInNewContext(read("floqai-help-repository.js"), win);
    const everyone = {IsPatron: 1, IsServiceMember: 1, IsVenueAdmin: 1, IsMasterAdmin: 1};
    return JSON.stringify(win.FLOQRHelpRepository.toSearchIntents(everyone));
  };
  const withNav = load({appVersion: pkgVersion});
  const versions = [...withNav.matchAll(/[?&]v=([A-Za-z0-9][A-Za-z0-9.]*)/g)].map((hit) => hit[1]);
  assert.ok(versions.length > 20, `found ${versions.length} stamped links`);
  assert.deepEqual([...new Set(versions)], [pkgVersion]);
  assert.doesNotMatch(load(undefined), /[?&]v=[A-Za-z0-9]/);
});

test("pages load floqr-nav.js before the FloqAi link builders", () => {
  const bad = htmlPages().flatMap((name) => {
    const html = fs.readFileSync(path.join(rootDir, name), "utf8");
    const nav = html.search(/src="\.\/floqr-nav\.js/);
    return ["floqai-help-repository.js", "intent-search.js"]
      .filter((dep) => {
        const at = html.indexOf(`src="./${dep}`);
        return at >= 0 && (nav < 0 || nav > at);
      })
      .map((dep) => `${name}: ${dep}`);
  });
  assert.deepEqual(bad, []);
});

test("static hub links in HTML (FloqAi, Scheduling, My Profile, Club Admin, Master Admin) use the current package", () => {
  const stale = htmlPages().flatMap((name) =>
    [...fs.readFileSync(path.join(rootDir, name), "utf8").matchAll(HUB_LINK)]
      .filter((hit) => hit[1] !== pkgVersion)
      .map((hit) => `${name}: ${hit[0]}`));
  assert.deepEqual(stale, []);
});

test("every page that loads floqr-nav.js cache-busts it with the current package", () => {
  const root = path.resolve(__dirname, "..");
  const stale = fs.readdirSync(root)
    .filter((name) => name.endsWith(".html"))
    .flatMap((name) => [...fs.readFileSync(path.join(root, name), "utf8").matchAll(/floqr-nav\.js\?v=([^"'&\s]+)/g)]
      .filter((hit) => hit[1] !== pkgVersion)
      .map((hit) => `${name} -> ${hit[1]}`));
  assert.deepEqual(stale, []);
});
