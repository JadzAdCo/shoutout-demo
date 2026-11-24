"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadShowcase() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, "floqr-temp-qa-showcase.js"), "utf8"), sandbox, { filename: "floqr-temp-qa-showcase.js" });
  return sandbox.FLOQRTempQaShowcase;
}

test("Aurelia is the New York demo club", () => {
  const club = loadShowcase().clubRecord(1, true);
  assert.equal(club.id, "temp-democlub-1");
  assert.equal(club.locationName, "Aurelia (Demo Club)");
  assert.equal(club.city, "New York");
  assert.equal(club.region, "New York");
  assert.equal(club.regionType, "State");
  assert.equal(club.locationLabel, "New York, New York");
  assert.equal(club.fullAddress, "1001 6th Ave, New York, New York 10018, United States");
  assert.match(club.description, / in New York built/);
});

test("Aurelia public gallery starts at Happy Birthday Maya and omits the four DonPapi/VIP shoutout tiles", () => {
  const showcase = loadShowcase();
  const club = showcase.clubRecord(1, true);
  const titles = club.publicGallery.map(item => item.title);
  assert.equal(club.publicGallery.length, 12);
  assert.equal(club.publicGallery[0].galleryOrder, 1);
  assert.equal(titles[0], "Portrait LED wall 960×1900 — Happy Birthday");
  assert.ok(titles.includes("VIP table — Maya's birthday crew + portrait LED wall"));
  assert.ok(titles.includes("Go Maya — BusBoy with the Papi's ClubTech 64x48 photo ShoutOut"));
  for (const gone of showcase.RETIRED_PUBLIC_GALLERY_TITLES) {
    assert.ok(!titles.includes(gone), gone);
  }
  for (const file of showcase.RETIRED_PUBLIC_GALLERY_FILES) {
    assert.ok(!club.publicGallery.some(item => String(item.mediaUrl).includes(file)), file);
    assert.ok(showcase.isRetiredPublicGalleryItem({mediaUrl: `./images/temp-qa/${file}`}));
  }
});

test("other temp demo clubs stay in Washington DC", () => {
  const club = loadShowcase().clubRecord(2, true);
  assert.equal(club.locationName, "Volt Room (Temp Demo 2)");
  assert.equal(club.city, "Washington");
  assert.equal(club.locationLabel, "Washington, District of Columbia");
  assert.match(club.fullAddress, /Washington, District of Columbia 20001/);
});
