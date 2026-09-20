"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Place = require(path.join(__dirname, "..", "floqr-place-i18n.js"));

test("FR localizes United States and District of Columbia", () => {
  assert.equal(Place.country("United States", "fr"), "États-Unis");
  assert.equal(Place.region("District of Columbia", "fr"), "district de Columbia");
});

test("AR localizes United States", () => {
  assert.equal(Place.country("United States", "ar"), "الولايات المتحدة");
});

test("FR localizes genres and offerings; brand tokens preserved", () => {
  assert.equal(Place.genre("Hip Hop", "fr"), "Hip-hop");
  const late = Place.offering("Thursday late night", "fr");
  assert.match(late, /Jeudi/i);
  assert.match(late, /soir tard/i);
  const heist = Place.offering("Friday HEIST", "fr");
  assert.match(heist, /HEIST/);
  assert.match(heist, /Vendredi/i);
});

test("AR offering keeps HEIST on branded night", () => {
  const heist = Place.offering("Friday HEIST", "ar");
  assert.match(heist, /HEIST/);
  assert.match(heist, /الجمعة/);
});

test("placeLine localizes city and region; no locationName API", () => {
  assert.equal(
    Place.placeLine({ city: "Washington", region: "District of Columbia" }, "fr"),
    "Washington, district de Columbia"
  );
  assert.equal(typeof Place.locationName, "undefined");
});

test("index loads floqr-place-i18n before patron-app", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /floqr-place-i18n\.js\?v=s3\.0\.87/);
  assert.match(html, /patron-app\.js\?v=s3\.0\.87/);
  const patron = fs.readFileSync(path.join(__dirname, "..", "patron-app.js"), "utf8");
  assert.match(patron, /FLOQRPlaceI18n/);
  assert.match(patron, /placeLine/);
  assert.match(patron, /optionLabel/);
});
