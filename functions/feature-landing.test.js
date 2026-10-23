"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const FL = require(path.join(root, "floqr-feature-landing.js"));

test("FLOQRFeatureLanding nearby top is 4", () => {
  assert.equal(FL.NEARBY_TOP, 4);
});

test("factsForFeature returns ShoutOut display + patron fields", () => {
  const venue = FL.normalizeVenue("heist", {
    locationName: "Heist",
    VenueSupports96x48: 1,
    VenueSupports64x32: 1,
    templates: ["birthday", "vip"],
    activityDates: ["Friday HEIST"],
    patronCustomShoutOutsEnabled: true
  });
  const facts = FL.factsForFeature(FL.FEATURES.SHOUTOUT, venue);
  const labels = facts.map((f) => f.label);
  assert.ok(labels.includes("Displays") || labels.some((l) => /display/i.test(l)));
  assert.ok(facts.some((f) => /yes/i.test(f.value) || f.value === "Yes"));
});

test("factsForFeature VIP includes dress and age when present", () => {
  const venue = FL.normalizeVenue("vera", {
    locationName: "Vera",
    dressCode: "Upscale",
    agePolicy: "21+",
    hours: "Fri–Sat 10 PM–3 AM",
    vipSettings: {depositRequired: 1, depositCents: 5000}
  });
  const facts = FL.factsForFeature(FL.FEATURES.VIP, venue);
  const blob = facts.map((f) => `${f.label}:${f.value}`).join("|");
  assert.match(blob, /Upscale/);
  assert.match(blob, /21\+/);
  assert.match(blob, /\$50|Deposit/);
});

test("factsForFeature floqCast includes screen and sound", () => {
  const venue = FL.normalizeVenue("decades", {
    locationName: "Decades",
    VenueSupports96x48: 1,
    VenueSupports64x48: 1,
    floqCastSoundEnabled: 1,
    secondaryDisplayScreenFormatId: "led-64x48"
  });
  const facts = FL.factsForFeature(FL.FEATURES.FLOQCAST, venue);
  assert.ok(facts.some((f) => /96/.test(f.value) || /Screen|Écran|Bildschirm/i.test(f.label)));
  assert.ok(facts.some((f) => f.value === "Yes" || /yes/i.test(f.value)));
});

test("filterAndRank empty query caps at NEARBY_TOP", () => {
  const rows = Array.from({length: 10}, (_, i) => ({
    id: `v${i}`,
    name: `Venue ${i}`,
    coords: {latitude: 38.9 + i * 0.01, longitude: -77.0}
  }));
  const out = FL.filterAndRank(rows, {
    query: "",
    locationContext: {latitude: 38.9, longitude: -77.0, source: "gps"}
  });
  assert.equal(out.length, 4);
});

test("feature landing pages omit FloqR parent logo and load shared module", () => {
  for (const file of ["floqcast-search.html", "vip.html", "shoutout-search.html"]) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(html, /floqr-feature-landing\.js/);
    assert.match(html, /floqr-feature-landing\.css/);
    assert.match(html, /floqr-geo-search\.js/);
    assert.match(html, /data-feature-landing="1"|feature-landing-page/);
    assert.doesNotMatch(html, /product-brand-stack">\s*<img[^>]*product-parent-logo/);
  }
});
