"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (rel) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

test("display packs all words and exposes fitDisplayMessageLines", () => {
  const src = read("display-app.js");
  assert.match(src, /function packAllWordsIntoRows/);
  assert.match(src, /function fitDisplayMessageLines/);
  assert.match(src, /Dynamic max fit/);
  assert.match(src, /preserveAll:\s*true/);
  assert.match(src, /fitDisplayMessageLines\(byId\("displayMain"/);
});

test("canonical display catalog is three P1.56 sizes", () => {
  const shared = read("shared-data.js");
  assert.match(shared, /FLOQR_DEFAULT_DISPLAY_FORMAT_IDS = \["led-96x48", "led-64x48", "led-64x32"\]/);
  assert.match(shared, /pixelPitchMm:1\.56/);
  assert.match(shared, /label:"P1\.56 — 96 × 48 cm"/);
});

test("Master Admin onboarding no longer lists six pitch choices", () => {
  const html = read("master-admin.html");
  assert.doesNotMatch(html, /data-onboard-screen-format="p125-/);
  assert.doesNotMatch(html, /data-club-settings-screen-format="p125-/);
  assert.match(html, /P1\.56 — VenueSupports96x48/);
  assert.match(html, /id="twilio_sendgridMailLogs"/);
  assert.doesNotMatch(html, /<p class="eyebrow">Twilio · twilio_sendgridMailLogs<\/p>/);
});

test("Christine soft caps remain 3×16 / 48 on 64×48", () => {
  const shared = read("shared-data.js");
  assert.match(shared, /christine:[\s\S]*?lineCount:3/);
  assert.match(shared, /christine:[\s\S]*?maxCharactersPerLine:16/);
  assert.match(shared, /christine:[\s\S]*?maxMainCharacters:48/);
});
