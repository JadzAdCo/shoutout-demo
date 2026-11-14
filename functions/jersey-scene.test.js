"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sceneSrc = fs.readFileSync(path.join(root, "floqr-jersey-scene.js"), "utf8");
const win = {};
vm.runInNewContext(sceneSrc, { window: win, module: { exports: {} }, exports: {}, globalThis: win });
const scene = win.FLOQRJerseyScene || require("../floqr-jersey-scene.js");

test("sceneAt: jersey then message then done (12s with message)", () => {
  assert.equal(scene.sceneAt(0, true), "jersey");
  assert.equal(scene.sceneAt(6999, true), "jersey");
  assert.equal(scene.sceneAt(7000, true), "message");
  assert.equal(scene.sceneAt(11999, true), "message");
  assert.equal(scene.sceneAt(12000, true), "done");
});

test("sceneAt: blank message is jersey-only 7s then done", () => {
  assert.equal(scene.sceneAt(0, false), "jersey");
  assert.equal(scene.sceneAt(6999, false), "jersey");
  assert.equal(scene.sceneAt(7000, false), "done");
  assert.equal(scene.sceneAt(12000, false), "done");
});

test("hasMessageText trims whitespace", () => {
  assert.equal(scene.hasMessageText("  HAPPY BIRTHDAY  "), true);
  assert.equal(scene.hasMessageText("   "), false);
  assert.equal(scene.hasMessageText(""), false);
});

test("PHILA front+back pair catalog entry is retired; Terps pair keeps 7s/5s", () => {
  const catalog = fs.readFileSync(path.join(root, "jersey-catalog.js"), "utf8");
  assert.doesNotMatch(catalog, /id:\s*"nbaPhiladelphia76ersPhila"/);
  assert.doesNotMatch(catalog, /nba-phi-phila-white-reference-v1/);
  assert.match(catalog, /nbaJerseyPair:\s*true/);
  assert.match(catalog, /jerseySceneMs:\s*7000/);
  assert.match(catalog, /messageSceneMs:\s*5000/);
  assert.match(catalog, /nbaMarylandTerpsThrowbackPair/);
});

test("Maryland Terps throwback pair v2 is registered unpublished without front plate", () => {
  const catalog = fs.readFileSync(path.join(root, "jersey-catalog.js"), "utf8");
  assert.match(catalog, /nbaMarylandTerpsThrowbackPair/);
  assert.match(catalog, /ncaa-umd-2026-27-2002-throwback-white-v2/);
  assert.match(catalog, /catalogPublished:\s*false/);
  assert.match(catalog, /productionAssetsReady:\s*false/);
  assert.match(catalog, /pairMessageTheme:\s*"maryland"/);
  assert.match(catalog, /reports\/maryland-terps-jersey-v2/);
  const integ = fs.readFileSync(path.join(root, "reports/maryland-terps-jersey-v2/INTEGRATION.md"), "utf8");
  assert.match(integ, /blank \*\*front\*\* plate|front blank plate/i);
  assert.match(integ, /catalogPublished:\s*false/);
  assert.match(integ, /productionAssetsReady:\s*false/);
});
