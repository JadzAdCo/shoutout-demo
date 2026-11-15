"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const p = require("./botdee-personalization");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("first name, demeanor, last-used, and greeting stay short", () => {
  assert.equal(p.firstNameFromDisplayName("Don Papi"), "Don");
  assert.equal(p.firstNameFromDisplayName(""), "");
  assert.equal(p.normalizeDemeanor("Socially Cool"), "sociallyCool");
  assert.equal(p.normalizeDemeanor("pro"), "professional");
  assert.equal(p.nextLastUsed(100, 200), 200);
  assert.equal(p.nextLastUsed(300, 200), 300);
  assert.equal(p.timeOfDay(0, 9), "morning");
  assert.equal(p.timeOfDay(0, 15), "afternoon");
  assert.equal(p.timeOfDay(0, 20), "evening");
  const cool = p.greetingFor({preferredAddressName: "Boss", demeanor: "sociallyCool"}, {hour: 15});
  assert.match(cool, /Wassup, Boss/);
  assert.doesNotMatch(cool, /ShoutOut|VIP|floqCast/i);
  const pro = p.greetingFor({preferredAddressName: "Don", demeanor: "professional"}, {hour: 14});
  assert.match(pro, /Good afternoon, Don/);
  assert.doesNotMatch(pro, /ShoutOut|VIP|floqCast/i);
  assert.equal(p.needsOnboarding({botDeePersonalizationVersion: 0}), true);
  assert.equal(p.needsOnboarding({botDeePersonalizationVersion: 1}), false);
  assert.equal(p.LAST_USED_FIELD, "userbotdeelastUsedtime");
});

test("recap uses last two meaningful turns; action history is one line", () => {
  const recap = p.recapFromTurns([
    {role: "user", text: "Hello sir"},
    {role: "model", text: "Good afternoon."},
    {role: "user", text: "Hold table C10"},
    {role: "model", text: "VIP hold is ready."}
  ]);
  assert.match(recap, /Hold table C10/);
  assert.match(recap, /VIP hold is ready/);
  assert.doesNotMatch(recap, /Hello sir/);
  assert.equal(
    p.formatActionLine({kind: "shoutout", status: "Pending"}),
    "ShoutOut requested · Pending · View"
  );
  const withHistory = p.appendActionHistory("Done.", [{kind: "checkout", status: "Open"}]);
  assert.match(withHistory, /Payment needed · Open · View/);
});

test("saveBotDeePersonalization is wired and last-used is persisted on send", () => {
  assert.match(read("functions/bot-dee-functions.js"), /exports\.saveBotDeePersonalization/);
  assert.match(read("functions/index.js"), /saveBotDeePersonalization/);
  assert.match(read("functions/bot-dee-thread.js"), /LAST_USED_FIELD/);
  assert.match(read("functions/botdee-personalization.js"), /userbotdeelastUsedtime/);
  assert.match(read("functions/bot-dee-core.js"), /Hello sir|sir\|ma/);
  assert.match(read("bot-dee-chat.js"), /sir\|ma/);
  assert.doesNotMatch(read("botdee.html"), /placeholder="Ask BOT DEE… Enter sends/);
  assert.match(read("botdee.html"), /placeholder="Ask BOT DEE…"/);
  assert.match(read("botdee.html"), /botdee-personalization-ui\.js/);
  assert.match(read("botdee-help-repository.js"), /id: "help-botdee-privacy-session"/);
  assert.match(read("functions/data-classification-core.js"), /userbotdeelastUsedtime/);
  assert.match(read("functions/data-classification-core.js"), /botDeePersonalizationVersion/);
});
