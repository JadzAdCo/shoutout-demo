"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vip = require("./headless-vip-core");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Mezzanine at Aurelia lists V1–V4 and AURELIA SUITE, not a miss", () => {
  const club = vip.resolveClubQuery("Aurelia");
  assert.equal(club, "temp-democlub-1");
  const match = vip.resolveSectionQuery(club, "Mezzanine");
  assert.equal(match.ok, false);
  assert.equal(match.reason, "area");
  const ids = match.matches.map(row => row.id);
  assert.deepEqual(ids.sort(), [
    "aurelia-aurelia-suite",
    "aurelia-v1",
    "aurelia-v2",
    "aurelia-v3",
    "aurelia-v4"
  ]);
  const v1 = vip.resolveSectionQuery(club, "V1");
  assert.equal(v1.ok, true);
  assert.equal(v1.matches[0].id, "aurelia-v1");
});

test("VIP execute prompts vs how-to", () => {
  assert.equal(vip.isVipExecutePrompt("VIP reserV"), true);
  assert.equal(vip.isVipExecutePrompt("hold a VIP table at Aurelia"), true);
  assert.equal(vip.isVipExecutePrompt("book a table at Decades for 4"), true);
  assert.equal(vip.isVipExecutePrompt("how do I book a VIP table"), false);
  assert.equal(vip.isVipExecutePrompt("throw a shoutout at Aurelia"), false);
});

test("Mezzanine follow-up after a VIP draft", () => {
  const parsed = vip.parseVipExecute("VIP reserV at Aurelia");
  assert.equal(parsed.clubQuery, "temp-democlub-1");
  const draft = vip.mergeInteractiveDraft(null, parsed);
  assert.equal(vip.isInteractiveFollowUp("Mezzanine", draft), true);
  const applied = vip.applySectionMatch(draft, "Mezzanine");
  assert.equal(applied.draft.sectionId, "");
  assert.ok(applied.draft.matches.length >= 5);
  const ask = vip.missingAsk(["section"], applied.draft);
  assert.match(ask, /V1/);
});

test("session intercepts headless VIP and fuzzy createVipHold", () => {
  const session = read("functions/bot-dee-functions.js");
  assert.match(session, /tryHeadlessVip/);
  assert.match(session, /isVipExecutePrompt/);
  assert.match(session, /headlessVipDraft/);
  const tools = read("functions/bot-dee-tools.js");
  assert.match(tools, /resolveSectionQuery/);
  assert.match(tools, /getVipAvailability/);
  const core = read("functions/bot-dee-core.js");
  assert.match(core, /getVipAvailability/);
  assert.match(core, /isVipExecutePrompt/);
});
