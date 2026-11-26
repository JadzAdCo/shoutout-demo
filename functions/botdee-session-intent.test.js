"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const intent = require("./botdee-session-intent");

test("reserve a table at a club in Milan during Fashion Week extracts intents and datapoints", () => {
  const row = intent.classifySessionWorkflow(
    "reserve a table at a club in Milan during Milan Fashion Week"
  );
  assert.ok(row.intents.includes("reserve"));
  assert.ok(row.venueKinds.includes("club"));
  assert.ok(row.places.includes("milan"));
  assert.ok(row.topics.includes("fashion-week"));
  assert.equal(row.productClear, true);
  assert.equal(row.placeWithoutProduct, false);
  assert.equal(row.backgroundHint, "bg-milan-fashion-week");
  assert.match(row.verbiage, /reserve/i);
  assert.match(row.verbiage, /milan/i);
});

test("I like fashion week in Milan has no product intent and uses NEUTRAL stencil", () => {
  const row = intent.classifySessionWorkflow("I like fashion week in Milan");
  assert.deepEqual(row.intents, []);
  assert.ok(row.places.includes("milan"));
  assert.ok(row.topics.includes("fashion-week"));
  assert.equal(row.placeWithoutProduct, true);
  assert.equal(row.stencilHint, intent.NEUTRAL_STENCIL_ID);
  assert.equal(row.backgroundHint, "bg-milan-fashion-week");
  const card = intent.stampPlacePayload({kind: "venue", title: "Milan", floqrPublicData: {}}, row);
  assert.equal(card.floqrPublicData.smartStencilId, "st-people");
  assert.equal(card.floqrPublicData.smartBackgroundId, "bg-milan-fashion-week");
  assert.ok(card.floqrPublicData.smartTags.includes("milan"));
  assert.ok(card.floqrPublicData.smartTags.includes("fashion-week"));
  assert.match(intent.askIntentReply(row), /VIP reserV/);
});

test("talk-only uses the Don Papi joke and native-script talk aliases", () => {
  assert.equal(intent.classifySessionWorkflow("I just want to talk").talkOnly, true);
  assert.equal(intent.classifySessionWorkflow("أريد أن أتحدث").talkOnly, true);
  assert.equal(intent.classifySessionWorkflow("просто поговорить").talkOnly, true);
  assert.equal(intent.classifySessionWorkflow("απλά να μιλήσω").talkOnly, true);
  assert.equal(intent.talkJoke(), "Don Papi the founder said humans like talking to bots.");
});

test("native-script Milan + Fashion Week still classify", () => {
  const ar = intent.classifySessionWorkflow("أحب أسبوع الموضة في ميلانو");
  assert.ok(ar.places.includes("milan"));
  assert.ok(ar.topics.includes("fashion-week"));
  const ru = intent.classifySessionWorkflow("мне нравится неделя моды в милане");
  assert.ok(ru.places.includes("milan"));
  assert.ok(ru.topics.includes("fashion-week"));
  const el = intent.classifySessionWorkflow("μου αρέσει η εβδομάδα μόδας στο μιλάνο");
  assert.ok(el.places.includes("milan"));
});

test("session merge remembers reserve across a later place-only turn", () => {
  const first = intent.classifySessionWorkflow("reserve a table at a club in Milan");
  const second = intent.classifySessionWorkflow("I like fashion week in Milan");
  const merged = intent.mergeWorkflow(first, second);
  assert.ok(merged.intents.includes("reserve"));
  assert.ok(merged.topics.includes("fashion-week"));
  assert.equal(merged.productClear, true);
});

test("approve publish injects unmatched photos into the assignment list", () => {
  const fns = fs.readFileSync(path.join(__dirname, "smartvisuals-functions.js"), "utf8");
  assert.match(fns, /bg-published-\$\{draftId\}/);
  const studio = fs.readFileSync(path.join(__dirname, "..", "smartvisuals-studio.js"), "utf8");
  assert.match(studio, /publishedPhoto: true/);
  assert.match(studio, /function applyDraftToCatalog/);
});

test("executeBotSession persists sessionWorkflow and talk/place branches", () => {
  const src = fs.readFileSync(path.join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(src, /persistSessionWorkflow/);
  assert.match(src, /session-talk/);
  assert.match(src, /session-place-intent/);
  assert.match(src, /intents \|\| \[\]\)\.includes\("reserve"\)/);
});
