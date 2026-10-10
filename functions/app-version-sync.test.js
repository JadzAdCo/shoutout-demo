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

test("every page that loads floqr-nav.js cache-busts it with the current package", () => {
  const root = path.resolve(__dirname, "..");
  const stale = fs.readdirSync(root)
    .filter((name) => name.endsWith(".html"))
    .flatMap((name) => [...fs.readFileSync(path.join(root, name), "utf8").matchAll(/floqr-nav\.js\?v=([^"'&\s]+)/g)]
      .filter((hit) => hit[1] !== pkgVersion)
      .map((hit) => `${name} -> ${hit[1]}`));
  assert.deepEqual(stale, []);
});
