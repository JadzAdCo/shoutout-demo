"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const catalog = require("./botdee-whats-new-catalog");
const vs = require("./botdee-version-smartview");

const bundled = vs.changelogFromBundle();
const whatsNew = vs.changelogItems();

function byId(id) {
  return bundled.find(row => row.id === id);
}

test("screenshot mixed bullets: BOT DEE/Gemini stay, Master Admin / Save / Features SMARTview drop", () => {
  const stay = {
    "s3.3.079": true,
    "s3.3.078": true,
    "s3.3.077": true,
    "s3.3.076": true,
    "s3.3.075": true,
    "s3.3.072": true,
    "s3.3.071": true,
    "s3.3.070": true,
    "s3.3.051": true,
    "s3.3.050": true,
    "s3.3.046": true,
    "s3.3.045": true,
    "s3.3.044": true
  };
  const drop = {
    "s3.3.049": true,
    "s3.3.048": true,
    "s3.3.047": true
  };
  Object.keys(stay).forEach(id => {
    const row = byId(id);
    assert.ok(row, id);
    assert.equal(catalog.classifyItem(row).keep, true, id);
  });
  Object.keys(drop).forEach(id => {
    const row = byId(id);
    assert.ok(row, id);
    assert.equal(catalog.classifyItem(row).keep, false, id);
  });
  const shown = new Set(whatsNew.map(row => row.id));
  ["s3.3.079", "s3.3.078", "s3.3.077", "s3.3.076", "s3.3.075", "s3.3.072", "s3.3.071", "s3.3.070"].forEach(id => {
    assert.equal(shown.has(id), true, `shown ${id}`);
  });
  Object.keys(drop).forEach(id => assert.equal(shown.has(id), false, `hidden ${id}`));
  const blob = JSON.stringify(whatsNew);
  assert.doesNotMatch(blob, /Find patron/i);
  assert.doesNotMatch(blob, /Gray Save/i);
  assert.doesNotMatch(blob, /Save busy/i);
  assert.doesNotMatch(blob, /Features SMARTview/i);
  assert.doesNotMatch(blob, /App Check/i);
});

test("mixed s3.3.046 keeps People/Room VIP and drops App Check", () => {
  const row = catalog.classifyItem(byId("s3.3.046"));
  assert.equal(row.keep, true);
  assert.match(row.text, /People SMARTview/i);
  assert.match(row.text, /Room SMARTview/i);
  assert.doesNotMatch(row.text, /App Check/i);
  assert.doesNotMatch(row.text, /headless/i);
});

test("semicolons inside parentheses do not split Room SMARTview notes", () => {
  const row = catalog.classifyItem({
    id: "s3.3.033",
    text: "s3.3.033: BOT DEE Room SMARTview intent routing (confirmation card; group rooms not live)"
  });
  assert.equal(row.keep, true);
  assert.match(row.text, /group rooms not live/);
});

test("Mingl Search chrome and Appearance/native select fail closed", () => {
  assert.equal(catalog.classifyItem(byId("s3.3.042")).keep, false);
  assert.equal(catalog.classifyItem(byId("s3.3.035")).keep, false);
});

test("Gemini cannot force a hard-excluded Master Admin Save bullet onto What's New", () => {
  const gray = byId("s3.3.047");
  const merged = catalog.mergeGeminiProposal([gray], {
    items: [{id: "s3.3.047", keep: true, audience: "botDee", whatsNewText: "s3.3.047: Gray Save after command received"}]
  });
  assert.equal(merged[0].keep, false);
  const invented = catalog.mergeGeminiProposal([gray], {
    items: [{id: "s3.3.047", keep: true, audience: "botDee", whatsNewText: "s3.3.047: BOT DEE memory"}]
  });
  assert.equal(invented[0].keep, false);
});

test("override cannot launder INCLUDE tokens out of a hard-excluded bullet", () => {
  const raw = {
    id: "s3.3.047",
    text: "s3.3.047: Gray Save after command received; Features SMARTview first slice on Master Admin BOT DEE SMARTviews"
  };
  const sliced = catalog.classifyItem({
    ...raw,
    whatsNewText: "s3.3.047: BOT DEE SMARTviews"
  });
  assert.equal(sliced.keep, false);
  const gemini = catalog.mergeGeminiProposal([raw], {
    items: [{id: "s3.3.047", keep: true, audience: "botDee", whatsNewText: "s3.3.047: BOT DEE SMARTviews"}]
  });
  assert.equal(gemini[0].keep, false);
  const mixed = catalog.classifyItem({
    id: "s3.3.046",
    text: "s3.3.046: People SMARTview chip gaps + headless VIP reserV + Room SMARTview join; App Check plan-trace logs to Master Admin (enforcement off)",
    whatsNewText: "s3.3.046: People SMARTview chip gaps + headless VIP reserV + Room SMARTview join"
  });
  assert.equal(mixed.keep, true);
  assert.doesNotMatch(mixed.text, /App Check/);
});

test("Version SMARTview payload uses catalogued What's New only", () => {
  const payload = vs.buildVersionSmartView({role: "patron", functionsReachable: true, geminiConfigured: true});
  assert.equal(payload.changelog.length, catalog.WHATS_NEW_LIMIT);
  assert.ok(payload.changelog.length <= catalog.WHATS_NEW_LIMIT);
  payload.changelog.forEach(row => {
    assert.equal(catalog.classifyItem(row).keep, true, row.id);
  });
  assert.equal(payload.changelog[0].id, whatsNew[0].id);
  assert.match(
    fs.readFileSync(path.join(__dirname, "botdee-version-smartview.js"), "utf8"),
    /forVersionWhatsNew/
  );
});

test("runtime catalog never calls Gemini", () => {
  const src = fs.readFileSync(path.join(__dirname, "botdee-whats-new-catalog.js"), "utf8");
  assert.doesNotMatch(src, /generativelanguage\.googleapis\.com/);
  assert.doesNotMatch(src, /GEMINI_API_KEY/);
  assert.match(src, /geminiCatalogPrompt/);
  const prompt = catalog.geminiCatalogPrompt([{id: "s3.3.049", text: "s3.3.049: Beta Find patron by email"}]);
  assert.match(prompt, /DROP Master Admin/);
  assert.match(prompt, /Find patron/);
});
