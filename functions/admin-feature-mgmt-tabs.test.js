"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");

test("Club Admin Feature Mgmt nests ShoutOut / floqCast / VIP reserV", () => {
  const html = read("admin.html");
  assert.match(html, /data-tab-group="featureMgmt"/);
  assert.match(html, /data-i18n="admin\.featureMgmt"/);
  assert.match(html, /data-tab-group="featureShoutOut"/);
  assert.match(html, /data-i18n="admin\.shoutOut"/);
  assert.match(html, /data-i18n="admin\.queueMgmt"/);
  assert.match(html, /data-i18n="admin\.displayMgmt"/);
  assert.match(html, /data-i18n="admin\.templateMgmt"/);
  assert.match(html, /data-panel="panelQueue"/);
  assert.match(html, /data-panel="panelDisplaySecurity"/);
  assert.match(html, /data-panel="panelTemplateBackgrounds"/);
  assert.match(html, /data-panel="panelFloqCast"/);
  assert.match(html, /data-panel="panelVipReserv"/);
  // Top-level standalone tabs removed for moved panels
  assert.doesNotMatch(html, /<button class="admin-tab"[^>]*data-panel="panelQueue"/);
  assert.doesNotMatch(html, /<button class="admin-tab"[^>]*data-panel="panelFloqCast"/);
  assert.doesNotMatch(html, /<button class="admin-tab"[^>]*data-panel="panelVipReserv"/);
  assert.doesNotMatch(html, /<button class="admin-tab"[^>]*data-panel="panelDisplaySecurity"/);
  assert.doesNotMatch(html, /<button class="admin-tab"[^>]*data-panel="panelTemplateBackgrounds"/);
});

test("admin-app activates nested Feature Mgmt / ShoutOut parents", () => {
  const app = read("admin-app.js");
  assert.match(app, /admin-subtab-parent/);
  assert.match(app, /revealAncestorsFor/);
  assert.match(app, /featureMgmt/);
  assert.match(app, /featureShoutOut/);
  assert.match(app, /FEATURE_ALIASES/);
});
