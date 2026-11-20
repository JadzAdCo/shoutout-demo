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
  assert.equal(vip.isVipExecutePrompt("Do a visit reservation at Aurelia"), true);
  assert.equal(vip.isVipExecutePrompt("I want a reservation at Aurelia"), true);
  assert.equal(vip.isVipExecutePrompt("VIP reserv at Aurelia"), true);
  assert.equal(vip.isVipExecutePrompt("how do I book a VIP table"), false);
  assert.equal(vip.isVipExecutePrompt("throw a shoutout at Aurelia"), false);
});

test("Aurelia display name hides demo slug", () => {
  assert.equal(vip.clubDisplayName("temp-democlub-1"), "Aurelia");
  assert.equal(vip.parseNight("tonight (Nov 19)"), vip.tonightIso());
  const parsed = vip.parseVipExecute("v2, 4 people");
  assert.equal(parsed.sectionQuery.toLowerCase(), "v2");
  assert.equal(parsed.partySize, 4);
});

test("repeating the selected table is a hold, not a no-op", () => {
  const parsed = vip.parseVipExecute("VIP reserV at Aurelia");
  let draft = vip.mergeInteractiveDraft(null, parsed);
  draft = vip.applySectionMatch(draft, "V1").draft;
  assert.equal(draft.sectionId, "aurelia-v1");
  assert.equal(vip.isRepeatSelectedSection("V1", draft), true);
  assert.equal(vip.isRepeatSelectedSection("v1", draft), true);
  assert.equal(vip.isRepeatSelectedSection("Mezzanine", draft), false);
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
  assert.match(session, /if \(!merged\.holdId\)/);
  assert.match(session, /wantsTerms/);
  assert.match(session, /isRepeatSelectedSection/);
  assert.match(session, /clubDisplayName/);
  assert.match(session, /Tap Hold it/);
  assert.match(session, /VIP reserV could not place that hold/);
  const shoutIdx = session.indexOf("} else if (shoutExecute) {");
  const vipIdx = session.indexOf("} else if (vipExecute) {");
  const roomIdx = session.indexOf("} else if (roomAttached.handled) {");
  assert.ok(shoutIdx > 0 && vipIdx > shoutIdx && roomIdx > vipIdx);
  const tools = read("functions/bot-dee-tools.js");
  assert.match(tools, /resolveSectionQuery/);
  assert.match(tools, /getVipAvailability/);
  assert.match(tools, /parseNight/);
  assert.match(tools, /That table could not be held/);
  const core = read("functions/bot-dee-core.js");
  assert.match(core, /getVipAvailability/);
  assert.match(core, /isVipExecutePrompt/);
});

test("VIP follow-up does not swallow people lookup or hello", () => {
  const parsed = vip.parseVipExecute("VIP reserV at Aurelia");
  const draft = vip.mergeInteractiveDraft(null, parsed);
  assert.equal(vip.isInteractiveFollowUp("hello", draft), false);
  assert.equal(vip.isInteractiveFollowUp("Who is Don Banyong", draft), false);
  assert.equal(vip.extractSectionNeedle("Who is Don Banyong"), "");
  assert.equal(vip.extractSectionNeedle("hello"), "");
  assert.equal(vip.isInteractiveFollowUp("V1", draft), true);
  assert.equal(vip.isInteractiveFollowUp("I agree", draft), true);
  assert.equal(vip.isInteractiveFollowUp("hold it", draft), true);
  assert.equal(vip.isInteractiveFollowUp("confirm room smartview", draft), false);
  assert.equal(vip.isConfirmHoldPrompt("confirm"), true);
});

test("VIP dock has a Hold it CTA and strips the demo slug", () => {
  const smart = read("botdee-smartview.js");
  assert.match(smart, /botdee\.vip\.holdIt/);
  assert.match(smart, /data-vip-prompt="hold it"/);
  assert.match(smart, /data-vip-prompt="I agree"/);
  assert.match(smart, /temp-democlub-1/i);
  const css = read("botdee-smartview.css");
  assert.match(css, /\.botdee-sv-vip \.botdee-sv-action-main/);
  const chat = read("bot-dee-chat.js");
  assert.match(chat, /documentElement\.clientHeight/);
});
