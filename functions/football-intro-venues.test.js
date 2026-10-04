"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const VENUES = ["zebbies-garden-washington-dc", "heist-washington-dc", "temp-democlub-1"];

function loadSharedData() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(read("shared-data.js"), sandbox, { filename: "shared-data.js" });
  return sandbox;
}

test("Football Intro is offered at Zebbies, Heist Washington DC and Aurelia only", () => {
  const sandbox = loadSharedData();
  const template = sandbox.SHOUTOUT_TEMPLATES.zebbiesFootballTeamIntro;
  assert.equal(template.name, "Football Intro");
  assert.deepEqual([...template.venueIds].sort(), [...VENUES].sort());
  assert.doesNotMatch(template.description, /Zebbies-only|All-Stars/);
  const heist = sandbox.SHOUTOUT_CLUB_LOCATIONS["heist-washington-dc"];
  assert.ok(heist.templates.includes("zebbiesFootballTeamIntro"), "Heist template list includes Football Intro");
  const fits = sandbox.FLOQRScreenDatapoints.templateFitsVenue(
    sandbox.FLOQRScreenDatapoints.applyTemplate({ ...template }),
    sandbox.FLOQRScreenDatapoints.applyVenue(JSON.parse(JSON.stringify(heist)))
  );
  assert.equal(fits, true, "Football Intro fits Heist boards");
});

test("Football Intro and Tengo muchos dólares play on 96x48 displays only", () => {
  const sandbox = loadSharedData();
  const sd = sandbox.FLOQRScreenDatapoints;
  for (const id of ["zebbiesFootballTeamIntro", "heistVaultDollars", "heistRedLux"]) {
    const t = sandbox.SHOUTOUT_TEMPLATES[id];
    assert.equal(t.Is96x48, 1, `${id} Is96x48`);
    assert.equal(t.Is64x48, 0, `${id} Is64x48`);
    assert.equal(t.Is64x32, 0, `${id} Is64x32`);
    assert.deepEqual([...t.screenFormatIds], ["led-96x48"], `${id} screenFormatIds`);
  }
  for (const venueId of VENUES) {
    const venue = sd.applyVenue(JSON.parse(JSON.stringify(sandbox.SHOUTOUT_CLUB_LOCATIONS[venueId])));
    const overlap = [...sd.overlappingFormatIds(sd.applyTemplate({ ...sandbox.SHOUTOUT_TEMPLATES.zebbiesFootballTeamIntro }), venue)];
    assert.deepEqual(overlap, ["led-96x48"], `${venueId} offers Football Intro on 96x48 only`);
  }
  const backend = fs.readFileSync(path.join(__dirname, "commerce-functions.js"), "utf8");
  assert.match(backend, /LED_96X48_ONLY_TEMPLATE_IDS = new Set\(\["heistVaultDollars", "heistRedLux", FOOTBALL_TEAM_INTRO_TEMPLATE_ID\]\)/);
  assert.match(backend, /LED_96X48_ONLY_TEMPLATE_IDS\.has\(templateId\) \? "led-96x48"/);
});

test("checkout accepts the three venues and keeps the requested club on the order", () => {
  const backend = fs.readFileSync(path.join(__dirname, "commerce-functions.js"), "utf8");
  assert.match(backend, /FOOTBALL_TEAM_INTRO_LOCATION_IDS = new Set\(\[ZEBBIES_GARDEN_DC_LOCATION_ID, HEIST_DC_LOCATION_ID, AURELIA_LOCATION_ID\]\)/);
  assert.match(backend, /AURELIA_LOCATION_ID = "temp-democlub-1"/);
  assert.match(backend, /!FOOTBALL_TEAM_INTRO_LOCATION_IDS\.has\(requestedClubId\)/);
  assert.match(backend, /!FOOTBALL_TEAM_INTRO_LOCATION_IDS\.has\(clubId\)/);
  assert.match(backend, /clubLocationId:requestedClubId,\s*location:requestedClubId/);
  assert.doesNotMatch(backend, /clubLocationId:ZEBBIES_GARDEN_DC_LOCATION_ID/);
});

test("composer and board brand the Football Intro headline with the venue", () => {
  const app = read("patron-app.js");
  const display = read("display-app.js");
  assert.match(app, /function footballIntroAllowedHere\(\)/);
  assert.match(app, /function footballIntroDefaultMain\(\)/);
  assert.match(app, /return `\$\{brand\} FOOTBALL INTRO`;/);
  assert.doesNotMatch(app, /locationId\(\) !== "zebbies-garden-washington-dc"\) throw/);
  assert.match(display, /const allStarsLabel = `\$\{String\(data\.brandName \|\| "Zebbies"\)\.trim\(\)\.toUpperCase\(\)\} FOOTBALL INTRO`/);
  assert.match(display, /<header><span>\$\{esc\(allStarsLabel\)\}<\/span>/);
});
