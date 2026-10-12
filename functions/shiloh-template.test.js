"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const AURELIA = "temp-democlub-1";
const HELP_LANGS = ["de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"];

function loadSharedData() {
  const sandbox = {location: {origin: "https://example.test", href: "https://example.test/", pathname: "/"}};
  sandbox.window = sandbox;
  vm.runInNewContext(read("floqr-temp-qa-showcase.js"), sandbox, {filename: "floqr-temp-qa-showcase.js"});
  vm.runInNewContext(read("shared-data.js"), sandbox, {filename: "shared-data.js"});
  return sandbox;
}

test("Shiloh is an Aurelia-exclusive cat photo template", () => {
  const sandbox = loadSharedData();
  const t = sandbox.SHOUTOUT_TEMPLATES.shiloh;
  assert.ok(t, "SHOUTOUT_TEMPLATES.shiloh exists");
  assert.equal(t.id, "shiloh");
  assert.equal(t.name, "Shiloh");
  assert.equal(t.scope, "Club");
  assert.deepEqual([...t.venueIds], [AURELIA]);
  assert.equal(sandbox.SHOUTOUT_STANDARD_TEMPLATE_IDS.includes("shiloh"), false, "not offered at every venue");
  assert.equal(String(t.status || "active"), "active");
  assert.equal(sandbox.SHOUTOUT_CLUB_LOCATIONS[AURELIA].brandName, "Aurelia");
});

test("Shiloh ships its cat background as a cover photo", () => {
  const t = loadSharedData().SHOUTOUT_TEMPLATES.shiloh;
  assert.equal(t.defaultBackgroundUrl, "./images/aurelia/shiloh-cat-background.jpg");
  const file = path.join(root, t.defaultBackgroundUrl);
  assert.ok(fs.existsSync(file), "background asset is in the repo");
  const bytes = fs.readFileSync(file);
  assert.equal(bytes[0], 0xff, "JPEG magic");
  assert.equal(bytes[1], 0xd8, "JPEG magic");
  assert.ok(bytes.length < 400 * 1024, "background stays small for LED players");
  assert.equal(t.backgroundEditable, false);
  assert.notEqual(t.textOverlay, true, "plain full-screen text, not the Heist framed overlay");
  assert.notEqual(t.identityRail, true, "not a classic board");
  assert.notEqual(t.className, "classic-bw", "emoji allowed (not Traditional Black and White)");
});

test("Shiloh flags every LED size and overlaps the boards Aurelia has", () => {
  const sandbox = loadSharedData();
  const sd = sandbox.FLOQRScreenDatapoints;
  const t = sandbox.SHOUTOUT_TEMPLATES.shiloh;
  assert.equal(t.Is96x48, 1);
  assert.equal(t.Is64x48, 1);
  assert.equal(t.Is64x32, 1);
  assert.deepEqual([...t.screenFormatIds].sort(), ["led-64x32", "led-64x48", "led-96x48"]);
  assert.equal(sandbox.FLOQRTextLayout.profileId(t), "full");
  const template = sd.applyTemplate({...t});
  const packaged = sd.applyVenue(JSON.parse(JSON.stringify(sandbox.SHOUTOUT_CLUB_LOCATIONS[AURELIA])));
  assert.equal(sd.templateFitsVenue(template, packaged), true);
  assert.deepEqual([...sd.overlappingFormatIds(template, packaged)].sort(), ["led-64x32", "led-96x48"]);
  const live = sd.applyVenue({displayScreenFormatIds: ["led-96x48"], VenueSupports96x48: 1, VenueSupports64x48: 0, VenueSupports64x32: 0});
  assert.deepEqual([...sd.overlappingFormatIds(template, live)], ["led-96x48"], "live Aurelia record (96x48 only)");
});

test("Shiloh board keeps the cat on the left and fits text to the dark column", () => {
  const css = read("display.css");
  const app = read("display-app.js");
  assert.match(css, /\.display-canvas\.shiloh-cat \.display-background\{background-position:22% 35%!important/);
  assert.match(css, /\.display-canvas\.shiloh-cat \.display-center\{position:absolute;left:46%/);
  assert.match(css, /\.display-canvas\.shiloh-cat\[data-screen-format-id="led-64x48"\] \.display-center\{left:50%/);
  assert.match(css, /\.display-canvas\.shiloh-cat\[data-screen-format-id="led-64x32"\] \.display-center\{left:47%/);
  assert.equal(loadSharedData().SHOUTOUT_TEMPLATES.shiloh.fitTextToColumn, true);
  assert.match(app, /Number\(options\.boxHeight\) \|\| host\.clientHeight/);
  assert.match(app, /t\.fitTextToColumn === true && center/);
  assert.match(app, /boxHeight: columnHeight\(\)/);
});

test("checkout treats Shiloh as a plain full-profile paid ShoutOut (no Heist gate)", () => {
  const backend = fs.readFileSync(path.join(__dirname, "commerce-functions.js"), "utf8");
  assert.doesNotMatch(backend, /"shiloh"/, "no special-case set lists Shiloh");
  assert.equal(loadSharedData().SHOUTOUT_TEMPLATES.shiloh.priceCents, 3000);
});

test("Shiloh has patron help in every language and a FloqAi template intent", () => {
  const repo = read("floqai-help-repository.js");
  assert.match(repo, /id: "help-shiloh",\s*title: "Shiloh",/);
  const helpPacks = read("floqr-i18n-help.js");
  const blocks = helpPacks.match(/"help-shiloh": \{\s*title: "Shiloh",\s*body: "[^"]+"/g) || [];
  assert.equal(blocks.length, HELP_LANGS.length, "help-shiloh in every non-English help pack");
  assert.ok(JSON.parse(read("scripts/_help-en.json"))["help-shiloh"], "canonical English help id");
  const intents = read("intent-search.js");
  assert.match(intents, /id: "shiloh",[\s\S]{0,400}action: "template",\s*templateId: "shiloh"/);
  assert.match(intents, /shiloh: \["patron"\]/);
  const classes = JSON.parse(read("functions/floqai-content-classes.json"));
  assert.deepEqual(classes.help["help-shiloh"], ["patron"]);
  assert.deepEqual(classes.intents.shiloh, ["patron"]);
});
