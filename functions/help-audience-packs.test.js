"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {execFileSync} = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function entryIds(file) {
  return new Set([...read(file).matchAll(/"id":"([^"]+)"/g)].map(hit => hit[1]));
}

const PATRON_PAGES = [
  "index.html",
  "patron-portal.html",
  "pickup.html",
  "shoutout-search.html",
  "sinema.html",
  "vip.html",
  "vip-door.html",
  "vip-terms.html",
  "botdee.html",
  "features-smartview.html",
  "floqr-oidc-authorize.html",
  "beta-invite.html"
];
const VENUE_PAGES = ["admin.html", "template-tags.html", "scheduling.html"];
const SERVICE_PAGES = ["staff-worksheet.html", "role-request.html"];

test("generated audience packs match the help repository", () => {
  execFileSync(process.execPath, ["scripts/build-help-audience-packs.js", "--check"], {
    cwd: root,
    stdio: "pipe"
  });
});

test("pages load the help loader for one audience and not the full catalogs", () => {
  const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith(".html"));
  for (const name of htmlFiles) {
    const html = read(name);
    assert.doesNotMatch(html, /botdee-help-repository\.js/, name);
    assert.doesNotMatch(html, /floqr-i18n-help\.js/, name);
  }
  for (const name of PATRON_PAGES) {
    const html = read(name);
    assert.match(html, /floqr-help-loader\.js\?v=s3\.\d+\.\d+" data-floqr-help-audience="patron"/, name);
    assert.doesNotMatch(html, /floqr-help-pack-venue-admin|floqr-help-pack-service-member|floqr-help-pack-master/, name);
  }
  for (const name of VENUE_PAGES) {
    assert.match(read(name), /data-floqr-help-audience="venueAdmin"/, name);
  }
  for (const name of SERVICE_PAGES) {
    assert.match(read(name), /data-floqr-help-audience="serviceMember"/, name);
  }
  assert.match(read("master-admin.html"), /data-floqr-help-audience="masterAdmin"/);
});

test("the loader fetches help on the first ? and only the page audience", () => {
  const loader = read("floqr-help-loader.js");
  assert.match(loader, /addEventListener\("click"/);
  assert.doesNotMatch(loader, /DOMContentLoaded/);
  assert.doesNotMatch(loader, /help-verbiage-master-source/);
  assert.match(loader, /function ensure\(\)/);
  const clickAt = loader.indexOf('addEventListener("click"');
  const ensureCall = loader.indexOf("ensure()", clickAt);
  assert.ok(ensureCall > clickAt, "ensure() runs from the ? click");
  const beforeClick = loader.slice(0, clickAt).replace("function ensure()", "");
  assert.equal(beforeClick.includes("ensure()"), false);
});

test("audience packs keep the other audiences' exclusive help out", () => {
  const patron = entryIds("floqr-help-pack-patron.js");
  const service = entryIds("floqr-help-pack-service-member.js");
  const venue = entryIds("floqr-help-pack-venue-admin.js");
  const master = entryIds("floqr-help-pack-master.js");
  assert.equal(patron.has("help-welcome"), true);
  assert.equal(patron.has("help-become-dj"), false);
  assert.equal(patron.has("help-become-promoter"), false);
  assert.equal(patron.has("help-display-idle-default"), false);
  assert.equal(patron.has("help-employee-network"), false);
  assert.equal(patron.has("botdee-ask-floqr"), false);
  assert.equal(service.has("help-become-dj"), true);
  assert.equal(service.has("help-display-idle-default"), false);
  assert.equal(service.has("help-employee-network"), false);
  assert.equal(venue.has("help-display-idle-default"), true);
  assert.equal(venue.has("help-employee-network"), true);
  assert.equal(venue.has("help-become-dj"), false);
  assert.equal(master.has("help-features-services"), false);
  for (const file of [
    "floqr-help-pack-patron.js",
    "floqr-help-pack-service-member.js",
    "floqr-help-pack-venue-admin.js",
    "floqr-help-pack-master.js",
    "floqr-help-runtime.js",
    "floqr-i18n-help-runtime.js"
  ]) {
    assert.doesNotMatch(read(file), /"audiences":\["masterAdmin"\]/, file);
    assert.doesNotMatch(read(file), /help-verbiage-master-source/, file);
  }
  const masterJson = path.join(root, "functions/help-verbiage-master-source.json");
  if (fs.existsSync(masterJson)) {
    const masterIds = JSON.parse(fs.readFileSync(masterJson, "utf8")).map(row => row.id);
    const published = [
      read("floqr-help-pack-patron.js"),
      read("floqr-help-pack-service-member.js"),
      read("floqr-help-pack-venue-admin.js"),
      read("floqr-help-pack-master.js"),
      read("floqr-help-runtime.js")
    ].join("\n");
    for (const id of masterIds) {
      assert.equal(published.includes(`"id":"${id}"`), false, id);
    }
  }
});
