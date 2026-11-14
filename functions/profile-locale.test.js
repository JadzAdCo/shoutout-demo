"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const Locale = require(path.join(root, "floqr-profile-locale.js"));
const Geo = require(path.join(root, "floqr-geo-search.js"));

test("United States defaults to ft; every other country and non-US IP default to m", () => {
  assert.equal(Locale.preferredHeightUnit({country: "United States"}), "ft");
  assert.equal(Locale.preferredHeightUnit({country: "U.S"}), "ft");
  assert.equal(Locale.preferredHeightUnit({country: "U.S."}), "ft");
  assert.equal(Locale.preferredHeightUnit({country: "USA"}), "ft");
  assert.equal(Locale.preferredHeightUnit({country: "Canada"}), "m");
  assert.equal(Locale.preferredHeightUnit({country: "France"}), "m");
  assert.equal(Locale.preferredHeightUnit({ipCountryCode: "US"}), "ft");
  assert.equal(Locale.preferredHeightUnit({ipCountryCode: "CA"}), "m");
  assert.equal(Locale.preferredHeightUnit({ipCountryCode: "FR"}), "m");
  assert.equal(Locale.preferredHeightUnit({country: "France", ipCountryCode: "US"}), "m");
  assert.equal(Locale.preferredHeightUnit({country: "United Kingdom"}), "m");
});

test("ZIP is for US residents; Canada and other IP use postal code", () => {
  assert.equal(Locale.usesZip({country: "United States"}), true);
  assert.equal(Locale.usesZip({country: "Canada"}), false);
  assert.equal(Locale.usesZip({ipCountryCode: "US"}), true);
  assert.equal(Locale.usesZip({ipCountryCode: "CA"}), false);
  assert.equal(Locale.usesZip({country: "United States", ipCountryCode: "FR"}), true);
  assert.equal(Locale.usesZip({country: "France", ipCountryCode: "US"}), false);
});

test("ft rejects metric 1.78; m rejects 6'0", () => {
  const metricOnFt = Locale.validateHeight("1.78", "ft");
  assert.equal(metricOnFt.ok, false);
  const feetOnM = Locale.validateHeight("6'0", "m");
  assert.equal(feetOnM.ok, false);
  const feet = Locale.validateHeight("6'0", "ft");
  assert.equal(feet.ok, true);
  assert.equal(feet.normalized, "6'0\"");
  const meters = Locale.validateHeight("1.78", "m");
  assert.equal(meters.ok, true);
  assert.equal(meters.normalized, "1.78");
  assert.equal(Locale.validateHeight("6'0\"", "ft").ok, true);
  assert.equal(Locale.validateHeight("", "ft").ok, true);
  assert.equal(Locale.validateHeight("9'0", "ft").ok, false);
  assert.equal(Locale.validateHeight("0.90", "m").ok, false);
});

test("switching units converts a valid height instead of mixing formats", () => {
  const toMeters = Locale.convertHeight("6'0\"", "ft", "m");
  assert.equal(toMeters.unit, "m");
  assert.equal(toMeters.normalized, "1.83");
  const toFeet = Locale.convertHeight("1.78", "m", "ft");
  assert.equal(toFeet.unit, "ft");
  assert.match(toFeet.normalized, /5'\d+"/);
});

test("pickup ZIP vs postal validation and compose", () => {
  const us = Locale.validatePickupParts(
    {streetNumber: "1411", streetName: "K Street NW", city: "Washington", postalCode: "20005"},
    {country: "United States"}
  );
  assert.equal(us.ok, true);
  assert.equal(us.composed, "1411 K Street NW, Washington, 20005");
  const badZip = Locale.validatePickupParts(
    {streetNumber: "1411", streetName: "K Street NW", city: "Washington", postalCode: "ABC"},
    {country: "US"}
  );
  assert.equal(badZip.ok, false);
  const ca = Locale.validatePickupParts(
    {streetNumber: "12", streetName: "York Street", city: "Ottawa", postalCode: "K1A0B1"},
    {country: "Canada"}
  );
  assert.equal(ca.ok, true);
  assert.equal(ca.parts.postalCode, "K1A 0B1");
  const paris = Locale.validatePickupParts(
    {streetNumber: "10", streetName: "Rue de Rivoli", city: "Paris", postalCode: "75001"},
    {ipCountryCode: "FR"}
  );
  assert.equal(paris.ok, true);
});

test("splitPickupAddress recovers structured fields from a saved one-liner", () => {
  const parts = Locale.splitPickupAddress("1411 K Street NW, Washington, 20005");
  assert.equal(parts.streetNumber, "1411");
  assert.equal(parts.streetName, "K Street NW");
  assert.match(parts.city, /Washington/i);
  assert.equal(parts.postalCode, "20005");
});

test("IP geo payload keeps country code and never stores the IP", () => {
  const parsed = Geo.parseIpPayload({
    ip: "203.0.113.9",
    latitude: "38.9072",
    longitude: "-77.0369",
    city: "Washington",
    country: "United States",
    country_code: "US"
  });
  assert.equal(parsed.countryCode, "US");
  assert.equal(parsed.country, "United States");
  assert.ok(!JSON.stringify(parsed).includes("203.0.113.9"));
});

test("typing United States sets ft even after a saved m unit", () => {
  const unitEl = {
    value: "m",
    dataset: {userSelected: "true", prevUnit: "m"},
    addEventListener() {},
    placeholder: "",
    disabled: false
  };
  const heightEl = {
    value: "1.78",
    addEventListener() {},
    placeholder: "",
    disabled: false
  };
  const ctl = Locale.bindHeightFields({
    unit: unitEl,
    height: heightEl,
    locale: () => ({country: "France"})
  });
  assert.equal(unitEl.value, "m");
  ctl.setLocale({country: "United States"}, {fromCountry: true});
  assert.equal(unitEl.value, "ft");
  ctl.setLocale({country: "Canada"}, {fromCountry: true});
  assert.equal(unitEl.value, "m");
});

test("Search, Profile, and RydR load the locale helper and structured pickup fields", () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const portal = fs.readFileSync(path.join(root, "patron-portal.html"), "utf8");
  const pickup = fs.readFileSync(path.join(root, "pickup.html"), "utf8");
  const pickupApp = fs.readFileSync(path.join(root, "pickup-app.js"), "utf8");
  const patron = fs.readFileSync(path.join(root, "patron-app.js"), "utf8");
  const portalApp = fs.readFileSync(path.join(root, "patron-portal-app.js"), "utf8");
  assert.match(index, /floqr-profile-locale\.js/);
  assert.match(portal, /floqr-profile-locale\.js/);
  assert.match(pickup, /floqr-profile-locale\.js/);
  assert.match(index, /id="profileHeightUnit"/);
  assert.ok(index.indexOf("profileHeightUnit") < index.indexOf("id=\"profileHeight\""));
  assert.match(index, /<option value="" data-i18n="portal.field.heightUnit">Unit<\/option>/);
  assert.ok(index.indexOf('option value=""') < index.indexOf('option value="ft"'));
  assert.match(index, /id="profileTaxiStreetNumber"/);
  assert.match(portal, /id="editTaxiStreetNumber"/);
  assert.match(pickup, /id="pickupStreetNumber"/);
  assert.match(patron, /FLOQRProfileLocale/);
  assert.match(portalApp, /FLOQRProfileLocale/);
  assert.match(pickupApp, /FLOQRProfileLocale/);
  assert.match(pickupApp, /bindPickupFields/);
});
