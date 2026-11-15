"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
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
  const fr = p.greetingFor({demeanor: "balanced"}, {
    hour: 15,
    lead: "Bon après-midi",
    templates: {
      balanced: {
        unnamed: "Salut, {leadLower}. Sur quoi travaille-t-on ?",
        named: "Salut, {leadLower}, {name}. Sur quoi travaille-t-on ?"
      }
    }
  });
  assert.match(fr, /Salut, bon après-midi\. Sur quoi travaille-t-on \?/);
  assert.doesNotMatch(fr, /What are we working on/);
  assert.equal(p.looksLikeReservedComposerText("Hello sir"), true);
  assert.equal(p.looksLikeReservedComposerText("what's up"), true);
  assert.equal(p.looksLikeReservedComposerText("What’s up"), true);
  assert.equal(p.looksLikeReservedComposerText("hello ma'am"), true);
  assert.equal(p.looksLikeReservedComposerText("help"), true);
  assert.equal(p.looksLikeReservedComposerText("privacy"), true);
  assert.equal(p.looksLikeReservedComposerText("Don"), false);
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

function loadUi() {
  const memory = {local: {}, session: {}};
  const storage = bag => ({
    getItem: key => (Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null),
    setItem: (key, value) => { bag[key] = String(value); },
    removeItem: key => { delete bag[key]; }
  });
  const context = {
    localStorage: storage(memory.local),
    sessionStorage: storage(memory.session),
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener() {}
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(read("botdee-personalization-ui.js"), context);
  return {api: context.FLOQRBotDeePersonalization, memory};
}

test("composer name capture skips greetings and cancel clears intercept", () => {
  const {api, memory} = loadUi();
  api.maybeStartSetup();
  assert.equal(api.interceptSend("Hello sir"), false);
  assert.equal(memory.session["floqr.botDeeSetupDeferred"], "1");

  const again = loadUi();
  again.api.maybeStartSetup();
  assert.equal(again.api.interceptSend("help"), false);
  const named = loadUi();
  named.api.maybeStartSetup();
  assert.equal(named.api.interceptSend("privacy"), false);
  const whatsUp = loadUi();
  whatsUp.api.maybeStartSetup();
  assert.equal(whatsUp.api.interceptSend("what's up"), false);
  const keep = loadUi();
  keep.api.maybeStartSetup();
  assert.equal(keep.api.interceptSend("Don"), true);

  const cancelled = loadUi();
  cancelled.api.maybeStartSetup();
  cancelled.api.closeDialog();
  assert.equal(cancelled.api.interceptSend("Don"), false);

  const guest = loadUi();
  guest.memory.local["floqr.botDeePersonalization.guest"] = JSON.stringify({
    preferredAddressName: "Boss",
    demeanor: "sociallyCool",
    remindWhereLeftOff: 1,
    botDeePersonalizationVersion: 1
  });
  guest.api.applyFromThread({}, false);
  assert.equal(guest.api.get().preferredAddressName, "Boss");
  assert.equal(guest.api.get().demeanor, "sociallyCool");
  assert.equal(guest.api.needsOnboarding(), false);
  assert.match(guest.api.greetingFor(15), /Wassup, Boss/);
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
  assert.match(read("botdee-personalization-ui.js"), /looksLikeReservedComposerText\(raw\)/);
  assert.match(read("botdee-personalization-ui.js"), /loadGuestPrefs/);
  assert.match(read("botdee-personalization-ui.js"), /state\.setupStep = ""/);
  assert.match(read("bot-dee-chat.js"), /applyFromThread\?\.\(\{\}, false\)/);
  assert.match(read("bot-dee-chat.js"), /botdee\.chatWelcome/);
  assert.doesNotMatch(
    read("bot-dee-chat.js"),
    /function welcome\(\)[\s\S]{0,400}greetingFor/
  );
  assert.match(read("floqr-i18n.js"), /"botdee\.greetingCoolNamed"/);
  assert.match(read("botdee-help-repository.js"), /id: "help-botdee-privacy-session"/);
  assert.match(read("functions/data-classification-core.js"), /userbotdeelastUsedtime/);
  assert.match(read("functions/data-classification-core.js"), /botDeePersonalizationVersion/);
});
