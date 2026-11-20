"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

test("Features SMARTview catalog has eight products and no invented release dates", () => {
  const catalog = JSON.parse(read("features-smartview/catalog.json"));
  assert.equal(catalog.products.length, 8);
  const names = catalog.products.map(row => row.displayName);
  assert.deepEqual(names, ["FloqR", "BOT DEE", "Mingl", "ShoutOut", "VIP reserV", "floqCast", "Si-nema", "Si-tube"]);
  catalog.products.forEach(row => {
    assert.equal(row.statusVerified, false);
    assert.equal(row.lifecycle, "unverified");
  });
  const tube = catalog.products.find(row => row.id === "si-tube");
  assert.equal(tube.presentInRepo, false);
  const js = read("floqr-features-smartview.js");
  assert.match(js, /Status not verified/);
  assert.doesNotMatch(js, /Beta since/);
  assert.match(read("master-admin.html"), /botDeeMasterLoadFeaturesSmartView/);
  assert.match(read("master-feature-services.js"), /FLOQRFeaturesSmartView/);
});
