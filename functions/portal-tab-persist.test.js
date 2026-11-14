"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const Tabs = require(path.join(root, "floqr-portal-tabs.js"));

test("My Profile click writes tab=profile so a hard refresh restores it", () => {
  const next = Tabs.persistHref("https://x/shoutout-demo/patron-portal.html", "portalProfile");
  assert.equal(next, "/shoutout-demo/patron-portal.html?tab=profile#portalProfile");
  const found = Tabs.resolve({ href: "https://x" + next, stored: "" });
  assert.equal(found.panelId, "portalProfile");
  assert.equal(found.source, "query");
});

test("Overview persist drops tab= so refresh does not keep a stale My Profile query", () => {
  const next = Tabs.persistHref(
    "https://x/patron-portal.html?tab=profile#portalProfile",
    "portalOverview"
  );
  assert.equal(next, "/patron-portal.html#portalOverview");
  const found = Tabs.resolve({ href: "https://x" + next });
  assert.equal(found.panelId, "portalOverview");
  assert.equal(found.source, "hash");
});

test("existing inbox deep links still map without a hash", () => {
  const found = Tabs.resolve({ href: "https://x/patron-portal.html?tab=profile" });
  assert.equal(found.panelId, "portalProfile");
  assert.equal(found.tab, "profile");
});

test("query wins over a stale hash", () => {
  const found = Tabs.resolve({
    href: "https://x/patron-portal.html?tab=profile#portalOverview"
  });
  assert.equal(found.panelId, "portalProfile");
  assert.equal(found.source, "query");
});

test("sessionStorage restores My Profile only on reload, not a fresh Search→Portal navigate", () => {
  const reload = Tabs.resolve({
    href: "https://x/patron-portal.html",
    stored: "portalProfile",
    navType: "reload"
  });
  assert.equal(reload.panelId, "portalProfile");
  assert.equal(reload.source, "session");
  const navigate = Tabs.resolve({
    href: "https://x/patron-portal.html",
    stored: "portalProfile",
    navType: "navigate"
  });
  assert.equal(navigate.panelId, "");
  assert.equal(navigate.source, "");
});

test("Mingl chat aliases still redirect instead of opening a portal panel", () => {
  const found = Tabs.resolve({ href: "https://x/patron-portal.html?tab=mingl-chat" });
  assert.equal(found.redirectMingl, true);
  assert.equal(found.panelId, "");
});

test("Feature & Orders persist keeps shoutouts sub", () => {
  const next = Tabs.persistHref("https://x/patron-portal.html", "portalFeatureOrders", {
    sub: Tabs.subForFoPane("foShoutoutsPane")
  });
  assert.equal(next, "/patron-portal.html?tab=feature-orders&sub=shoutouts#portalFeatureOrders");
});

test("portal app wires persist into showPortalPanel and restores on setupTabs", () => {
  const src = fs.readFileSync(path.join(root, "patron-portal-app.js"), "utf8");
  assert.match(src, /function persistPortalTab\(/);
  assert.match(src, /FLOQRPortalTabs/);
  assert.match(src, /function persistPortalTab[\s\S]*function showPortalPanel[\s\S]*persistPortalTab\(resolved/);
  assert.match(src, /restorePortalTabFromUrl/);
});
