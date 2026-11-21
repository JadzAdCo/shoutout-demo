"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const patron = require("./botdee-patron-language");
const catalog = require("./botdee-whats-new-catalog");
const {audit} = require("../scripts/check-botdee-patron-language");

const root = path.join(__dirname, "..");

test("shown What's New and version help stay free of internal tokens in every language", () => {
  assert.deepEqual(audit(root), []);
});

test("authoring sample: Gemini JSON for the VIP note becomes the checked-in patron line", () => {
  const source = "s3.3.055: Headless VIP reserV: book/hold a table phrasing, night rail, 2D map, cancel unmounts dock";
  const patronText = "s3.3.055: VIP reserV — book or hold a table interactively with BOT DEE, including the night you want, the 2D floor map, and cancel, which removes the booking panel.";
  const parsed = patron.parseGeminiJson(JSON.stringify({
    items: [{id: "s3.3.055", patronText}]
  }));
  const next = catalog.applyPatronProposal([{id: "s3.3.055", text: source}], parsed);
  assert.equal(next[0].whatsNewText, patronText);
  assert.deepEqual(patron.internalTokenHits(next[0].whatsNewText), []);
  const shown = catalog.classifyItem(next[0]);
  assert.equal(shown.keep, true);
  assert.equal(shown.reason, "patron-language");
  assert.equal(shown.text, patronText);

  const rejected = catalog.applyPatronProposal([{id: "s3.3.055", text: source}], {
    items: [{id: "s3.3.055", patronText: "s3.3.055: Headless night rail unmounts the dock"}]
  });
  assert.equal(rejected[0].whatsNewText, undefined);
  assert.match(catalog.classifyItem(rejected[0]).text, /Headless VIP reserV/);
});

test("patron rewrite cannot promote a hard-excluded Master Admin bullet", () => {
  const gray = {
    id: "s3.3.047",
    text: "s3.3.047: Gray Save after command received; Features SMARTview first slice on Master Admin BOT DEE SMARTviews"
  };
  const next = catalog.applyPatronProposal([gray], {
    items: [{id: "s3.3.047", patronText: "s3.3.047: BOT DEE remembers your chat"}]
  });
  assert.equal(next[0].whatsNewText, undefined);
  assert.equal(catalog.classifyItem(next[0]).keep, false);
});

test("patron prompt uses gemini-3.6-flash and keeps protected brands", () => {
  const prompt = patron.geminiPatronPrompt([{
    id: "s3.3.055",
    text: "Headless VIP reserV: night rail, cancel unmounts dock"
  }]);
  assert.match(prompt, /gemini-3\.6-flash/);
  assert.match(prompt, /VIP reserV/);
  assert.match(prompt, /Room SMARTview/);
  assert.match(prompt, /2D floor map/);
  patron.BRANDS.forEach(brand => assert.match(prompt, new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
  assert.doesNotMatch(prompt, /openai|anthropic/i);
  const request = patron.geminiGenerateRequest(prompt, "test-key");
  assert.equal(request.model, "gemini-3.6-flash");
  assert.match(request.url, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent/);
  assert.equal(request.init.headers["x-goog-api-key"], "test-key");
});

test("version card runtime does not call Gemini to invent What's New", () => {
  const smartview = fs.readFileSync(path.join(__dirname, "botdee-version-smartview.js"), "utf8");
  const catalogSrc = fs.readFileSync(path.join(__dirname, "botdee-whats-new-catalog.js"), "utf8");
  assert.doesNotMatch(smartview, /generativelanguage|GEMINI_API_KEY|fetch\(/);
  assert.doesNotMatch(catalogSrc, /generativelanguage|GEMINI_API_KEY/);
  assert.match(catalogSrc, /patron-language/);
});
