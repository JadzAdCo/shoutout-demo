/**
 * Master Admin must not eagerly load Diagnostics / AI crawl / duplicates / commerce
 * on every sign-in (that made the portal take forever). Those mount when their panel opens.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("master-admin-app sign-in path does not eagerly mount heavy Diagnostics / crawl / duplicates", () => {
  const src = read("master-admin-app.js");
  const authIdx = src.indexOf("auth.onAuthStateChanged(async user =>");
  assert.ok(authIdx > 0, "onAuthStateChanged handler present");
  const authBlock = src.slice(authIdx, authIdx + 4500);
  assert.doesNotMatch(authBlock, /FLOQRDiagnostics\.mount/);
  assert.doesNotMatch(authBlock, /FLOQRAIDiscovery\.mountMasterAdminPanel/);
  assert.doesNotMatch(authBlock, /FLOQRDuplicateRecords\.mount/);
  assert.doesNotMatch(authBlock, /loadManagedTemplates\(\)/);
  assert.doesNotMatch(authBlock, /loadRecommendationModeration\(\)/);
  assert.match(authBlock, /loadLightLocations/);
});

test("master-admin-app activatePanel mounts heavy panels on demand", () => {
  const src = read("master-admin-app.js");
  const actIdx = src.indexOf("const activatePanel = (panelId, opts = {}) =>");
  assert.ok(actIdx > 0);
  const actBlock = src.slice(actIdx, actIdx + 5500);
  assert.match(actBlock, /FLOQRDiagnostics\?\.mount/);
  assert.match(actBlock, /panelId === "aiCrawling"/);
  assert.match(actBlock, /FLOQRDuplicateRecords\?\.mount/);
  assert.match(actBlock, /FLOQRMasterServices\?\.mount/);
  assert.match(actBlock, /panelId === "templateManagement"/);
  assert.match(actBlock, /panelId === "recommendationModeration"/);
});

test("services commerce does not auto-fetch on auth", () => {
  const src = read("master-services-extension.js");
  assert.match(src, /FLOQRMasterServices/);
  assert.doesNotMatch(src, /onAuthStateChanged\(user => \{ if \(user\) load\(\)/);
  assert.match(src, /async function mount\(/);
});

test("diagnostics mount is idempotent and documents lazy refresh", () => {
  const src = read("ai-diagnostics-service.js");
  assert.match(src, /state\.diagnosticsReady/);
  assert.match(src, /never on Master Admin sign-in/);
});
