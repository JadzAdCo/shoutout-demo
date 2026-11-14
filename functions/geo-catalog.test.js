"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const Catalog = require(path.join(root, "floqr-geo-catalog.js"));

test("country list is United States, Canada, separator, featured A-Z, separator, rest A-Z", () => {
  const opts = Catalog.countryOptions();
  const names = opts.map(row => row.separator ? "----" : row.name);
  assert.equal(names[0], "United States");
  assert.equal(names[1], "Canada");
  assert.equal(names[2], "----");
  const mid = names.slice(3, names.indexOf("----", 3));
  assert.deepEqual(mid, [
    "France",
    "Germany",
    "Italy",
    "Russia",
    "Spain",
    "Turkey",
    "United Arab Emirates",
    "United Kingdom"
  ]);
  const rest = names.slice(names.indexOf("----", 3) + 1);
  assert.ok(rest.includes("Japan"));
  assert.ok(!rest.includes("United States"));
  assert.ok(!rest.includes("France"));
  const restNames = rest.slice();
  assert.deepEqual(restNames, restNames.slice().sort((a, b) => a.localeCompare(b)));
});

test("featured countries ship subdivision lists and calling codes", () => {
  assert.equal(Catalog.dialOf("US"), "1");
  assert.equal(Catalog.dialOf("United States"), "1");
  assert.equal(Catalog.subdivisionsOf("US").length, 51);
  assert.ok(Catalog.regionOf("US", "DC"));
  assert.equal(Catalog.regionOf("US", "District of Columbia")[0], "DC");
  assert.equal(Catalog.subdivisionsOf("CA").length, 13);
  assert.ok(Catalog.subdivisionsOf("FR").length >= 13);
  assert.equal(Catalog.subdivisionsOf("GB").length, 4);
  assert.equal(Catalog.subdivisionsOf("DE").length, 16);
  assert.ok(Catalog.subdivisionsOf("ES").length >= 17);
  assert.ok(Catalog.subdivisionsOf("IT").length >= 20);
  assert.equal(Catalog.subdivisionsOf("AE").length, 7);
  assert.equal(Catalog.subdivisionsOf("TR").length, 81);
  assert.ok(Catalog.subdivisionsOf("RU").length >= 80);
  assert.equal(Catalog.subdivisionsOf("JP").length, 0);
});

test("US mobile (+1) validates NANP; empty is allowed; short is not", () => {
  assert.equal(Catalog.toE164("US", "2027330274"), "+12027330274");
  assert.equal(Catalog.toE164("US", "(202) 733-0274"), "+12027330274");
  assert.equal(Catalog.toE164("US", "12027330274"), "+12027330274");
  assert.equal(Catalog.toE164("US", "123"), "");
  assert.equal(Catalog.validateMobile("US", "").ok, true);
  assert.equal(Catalog.validateMobile("US", "").empty, true);
  assert.equal(Catalog.validateMobile("US", "202733").ok, false);
  assert.equal(Catalog.validateMobile("FR", "612345678").e164, "+33612345678");
  assert.equal(Catalog.formatNational("US", "2027330274"), "(202) 733-0274");
});

test("Search, Profile, and RydR load the static catalog instead of a database", () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const portal = fs.readFileSync(path.join(root, "patron-portal.html"), "utf8");
  const pickup = fs.readFileSync(path.join(root, "pickup.html"), "utf8");
  assert.match(index, /floqr-geo-catalog\.js/);
  assert.match(portal, /floqr-geo-catalog\.js/);
  assert.match(pickup, /floqr-geo-catalog\.js/);
  assert.match(portal, /<select id="editCountry"/);
  assert.match(portal, /id="editPhoneNational"/);
  assert.match(portal, /id="editTaxiRegion"/);
  assert.match(portal, /id="editPhoneDial"/);
  assert.doesNotMatch(portal, /id="editCity"/);
  assert.ok(portal.indexOf('id="editCountry"') < portal.indexOf("editTaxiStreetNumber"));
  assert.match(index, /<select id="profileCountry"/);
  assert.doesNotMatch(index, /id="profileCity"/);
  assert.match(pickup, /id="pickupRegion"/);
});
