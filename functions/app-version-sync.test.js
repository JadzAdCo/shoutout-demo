"use strict";

// Owner decision Oct 10 2026: page / navigation links never carry ?v=. Only asset tags
// (<script src>, <link href>, images) are cache-busted, and only by the bump script.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {stripPageLinkVersions} = require("../scripts/strip-page-link-versions.js");

const rootDir = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");
const pkgVersion = `s${JSON.parse(read("functions/package.json")).version}`;
const htmlPages = () => fs.readdirSync(rootDir).filter((name) => name.endsWith(".html"));

/* Files that may still mint versioned links, and why. Keep this list short. */
const EXEMPT = new Map([
  ["admin-scheduling.js", "owner constraint: never edit"],
  ["functions/ai-discovery-functions.js", "deferred open-relay mailers must not change until the security review"]
]);

function servedSources() {
  const pick = (dir, prefix) => fs.readdirSync(dir)
    .filter((name) => /\.(?:js|html)$/.test(name) && !name.endsWith(".test.js"))
    .map((name) => `${prefix}${name}`);
  return [...pick(rootDir, ""), ...pick(path.join(rootDir, "functions"), "functions/")]
    .filter((file) => !EXEMPT.has(file));
}

function loadNav(href = "https://x/admin.html?location=zebbies&v=s3.0.1") {
  const url = new URL(href);
  const win = {location: {href, pathname: url.pathname, hash: url.hash}, URL, URLSearchParams};
  vm.runInNewContext(read("floqr-nav.js"), {window: win, URL, URLSearchParams});
  return win.FLOQRNav;
}

test("FLOQRNav.appVersion equals the package version (asset cache-bust id)", () => {
  assert.equal(loadNav().appVersion, pkgVersion);
});

test("README CURRENT PACKAGE matches functions/package.json", () => {
  const head = read("README.md").match(/# CURRENT PACKAGE: FLOQR ShoutOut (s\d+\.\d+\.\d+)/);
  assert.ok(head, "README CURRENT PACKAGE line");
  assert.equal(head[1], pkgVersion);
});

test("FLOQRNav never puts v= on a link and drops an incoming v from old bookmarks", () => {
  const nav = loadNav();
  const hrefs = [
    nav.adminPortalUrl("zebbies"),
    nav.adminHome({from: "master"}),
    nav.portalHome({tab: "inbox"}),
    nav.searchHome(),
    nav.masterHome({hash: "networkDashboard"}),
    nav.suprstrHome(),
    nav.portalLink("./mingl-chat.html?v=29.09.8", {room: "r1"}),
    nav.adminLink("./club-profile.html"),
    nav.masterLink("./suprstr-search.html"),
    nav.stampCurrentVersion("./floqai.html?v=s3.1.20&q=hi"),
    nav.intentSearchHome(),
    nav.resolveBack("mingl").href,
    nav.resolveBack("bartr").href,
    nav.resolveBack("portal").href
  ];
  assert.deepEqual(hrefs.filter((href) => /[?&]v=/.test(href)), []);
  assert.equal(nav.stampCurrentVersion("./floqai.html?v=s3.1.20&q=hi"), "./floqai.html?q=hi");
  assert.equal(nav.adminPortalUrl("zebbies"), "./admin.html?location=zebbies&from=master");
  assert.equal(nav.intentSearchHome(), "./floqai.html");
  assert.equal(nav.stableDisplayUrl("zebbies"), "./display.html?location=zebbies");
  assert.equal(nav.stampCurrentVersion("./display2.html?location=zebbies&v=s3.0.1&screen=led-64x32"), "./display2.html?location=zebbies");
});

function generatedHrefs(appVersion) {
  const win = {URLSearchParams, URL, console, FLOQRNav: appVersion == null ? undefined : {appVersion}};
  win.window = win;
  vm.runInNewContext(read("floqai-help-repository.js"), win);
  vm.runInNewContext(read("intent-search.js"), win);
  const everyone = {IsPatron: 1, IsServiceMember: 1, IsVenueAdmin: 1, IsMasterAdmin: 1};
  const {PRODUCT_INTENTS, HELP_INTENTS} = win.FLOQRIntentSearch;
  const json = JSON.stringify([win.FLOQRHelpRepository.toSearchIntents(everyone), PRODUCT_INTENTS, HELP_INTENTS]);
  return [...json.matchAll(/"href":"([^"]*)"/g)].map((hit) => hit[1]).filter((href) => href.startsWith("./"));
}

test("FloqAi links carry no version and no dangling ? / ?& whatever FLOQRNav says", () => {
  for (const version of [pkgVersion, "", undefined]) {
    const hrefs = generatedHrefs(version);
    assert.ok(hrefs.length > 50, `found ${hrefs.length} links`);
    const bad = hrefs.filter((href) => /[?&]v=|\?&|\?(?:#|$)/.test(href));
    assert.deepEqual(bad, [], `appVersion=${JSON.stringify(version)}`);
    assert.ok(hrefs.includes("./scheduling.html?from=floqai"));
  }
});

test("no served page, script or Functions URL builder mints a versioned page link", () => {
  const hits = servedSources().filter((file) => {
    const src = read(file);
    return stripPageLinkVersions(src) !== src;
  });
  assert.deepEqual(hits, []);
});

test("no code sets a v query parameter on a link (searchParams / URLSearchParams / {v: ...})", () => {
  const PATTERNS = [
    /\.set\(\s*["']v["']\s*,/,
    /URLSearchParams\(\{\s*v\s*[:,}]/,
    /\{\s*v\s*:\s*(?:APP_V|PACKAGE_VERSION|CURRENT_VERSION|window\.FLOQRNav)/
  ];
  const hits = servedSources().flatMap((file) => read(file).split("\n")
    .map((line, index) => ({line, index}))
    .filter(({line}) => PATTERNS.some((re) => re.test(line)))
    .map(({line, index}) => `${file}:${index + 1}: ${line.trim().slice(0, 120)}`));
  assert.deepEqual(hits, []);
});

test("Functions notification links are version-free", () => {
  const core = require("./scheduling-core");
  const url = core.shiftApproveUrl({id: "s1", ownerKey: "club:c1"}, "https://www.floqr.com");
  assert.doesNotMatch(url, /[?&]v=/);
  assert.match(url, /patron-portal\.html\?tab=work-calendar&shift=s1&owner=club%3Ac1&from=schedule-notify$/);
});

const ASSET_REF = /(?:src|href)\s*=\s*["'](\.?\/?[^"'?#\s]+\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|json|webmanifest|woff2?))\?v=([^"'&#\s]*)/gi;

test("every asset tag that cache-busts uses the current package (bump script re-stamps them)", () => {
  const stale = htmlPages().flatMap((name) => [...read(name).matchAll(ASSET_REF)]
    .filter((hit) => hit[2] !== pkgVersion)
    .map((hit) => `${name}: ${hit[1]}?v=${hit[2]}`));
  assert.deepEqual(stale, []);
});

test("Display / Xibo pages are never linked with v=", () => {
  const hits = servedSources().flatMap((file) => [...read(file).matchAll(/display2?\.html\?[^"'`\s<>]*\bv=/g)]
    .map((hit) => `${file}: ${hit[0]}`));
  assert.deepEqual(hits, []);
});

test("pages load floqr-nav.js before the FloqAi link builders", () => {
  const bad = htmlPages().flatMap((name) => {
    const html = read(name);
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
