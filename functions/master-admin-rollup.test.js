/**
 * Master Admin 5-min rollup — exports, helpers, rules, client wiring.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("rollup helpers expose schema, collections, and normalizeClubKey", () => {
  const mod = require("./master-admin-rollup-functions");
  const h = mod.__masterAdminRollupHelpers;
  assert.equal(h.SCHEMA, 1);
  assert.equal(h.ROLLUP_DOC, "masterAdminRollups/current");
  assert.ok(h.DIAG_COLLECTIONS.includes("clubLocations"));
  assert.ok(h.DIAG_COLLECTIONS.includes("aiDiscoveryQueue"));
  assert.equal(h.DIAG_COLLECTIONS.length, 27);
  assert.equal(
    h.normalizeClubKey({locationName: "Aurelia!", city: "Washington", country: "US"}),
    "aurelia|washington|us"
  );
  assert.equal(h.normalizeClubKey({name: ""}), "");
});

test("index.js exports scheduledMasterAdminRollup and refreshMasterAdminRollup", () => {
  const indexSrc = read("functions/index.js");
  assert.match(indexSrc, /master-admin-rollup-functions/);
  const mod = require("./master-admin-rollup-functions");
  assert.equal(typeof mod.scheduledMasterAdminRollup, "function");
  assert.equal(typeof mod.refreshMasterAdminRollup, "function");
});

test("firestore.rules lock masterAdminRollups to Master Admin read / Functions write", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/masterAdminRollups\/\{id\}/);
  const block = rules.slice(rules.indexOf("match /masterAdminRollups/{id}"));
  const snippet = block.slice(0, block.indexOf("match /", 10));
  assert.match(snippet, /allow read:\s*if isMasterAdmin\(\)/);
  assert.match(snippet, /allow write:\s*if false/);
});

test("client rollup module paints strips and calls refreshMasterAdminRollup", () => {
  const src = read("master-admin-rollup.js");
  assert.match(src, /masterAdminRollups\/current/);
  assert.match(src, /refreshMasterAdminRollup/);
  assert.match(src, /paintForPanel/);
  assert.match(src, /FLOQRMasterAdminRollup/);

  const doc = {
    readyState: "complete",
    getElementById() { return null; },
    addEventListener() {}
  };
  const sandbox = {window: {}, document: doc, console};
  sandbox.window.document = doc;
  vm.runInNewContext(src, sandbox);
  const api = sandbox.window.FLOQRMasterAdminRollup;
  assert.equal(typeof api.bind, "function");
  assert.equal(typeof api.load, "function");
  assert.equal(typeof api.paintForPanel, "function");
  assert.equal(typeof api.getCached, "function");
  assert.equal(api.DOC_PATH, "masterAdminRollups/current");
});

test("Master Admin app binds rollup on sign-in and paints on panel activate", () => {
  const app = read("master-admin-app.js");
  assert.match(app, /FLOQRMasterAdminRollup\?\.bind/);
  assert.match(app, /FLOQRMasterAdminRollup\?\.load/);
  assert.match(app, /FLOQRMasterAdminRollup\?\.paintForPanel/);
  const html = read("master-admin.html");
  assert.match(html, /master-admin-rollup\.js/);
  assert.match(html, /id="refreshMasterAdminRollupBtn"/);
  assert.match(html, /id="servicesCommerceRollup"/);
  assert.match(html, /id="templateManagementRollup"/);
  assert.match(html, /id="aiCrawlingSummary"/);
});

test("Diagnostics mount no longer auto-runs full refresh; duplicates wait for Refresh", () => {
  const diag = read("ai-diagnostics-service.js");
  assert.match(diag, /Rollup summary loaded/);
  assert.doesNotMatch(
    diag.slice(diag.indexOf("async function mount(options")),
    /await refreshDiagnostics\(\);\s*\n\s*state\.diagnosticsReady/
  );
  const dup = read("duplicate-record-service.js");
  assert.match(dup, /full 1200-club scan only on Refresh/);
  assert.match(dup, /FLOQRMasterAdminRollup\?\.getCached/);
});
