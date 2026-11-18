"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const bot = require("./bot-dee-core");
const guard = require("./botdee-privilege-guard");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Gemini system instruction is identical for master vs patron and has no classification role", () => {
  const allowed = ["shoutOut", "botDee", "passes"];
  const master = bot.systemInstruction("master", "en", allowed);
  const patron = bot.systemInstruction("patron", "en", allowed);
  assert.equal(master, patron);
  assert.doesNotMatch(master, /Viewer classification role/i);
  assert.doesNotMatch(master, /I can see you as/i);
  assert.doesNotMatch(master, /"role"\s*:\s*"master"|role=master/i);
  assert.doesNotMatch(master, /you are a Master Admin/i);
  assert.match(master, /I don't have account-security details/);
  assert.match(master, /Never mention FLOQR privilege/i);
  assert.ok(guard.assertNoPrivilegeInPayload({systemInstruction: master.replace(guard.PRIVILEGE_SYSTEM_INSTRUCTION, "")}));
});

test("who am I still routes to public display-name lookup, not privilege", () => {
  assert.equal(guard.isPrivilegeAskPrompt("who am I"), false);
  assert.equal(guard.isPrivilegeAskPrompt("about me"), false);
  assert.equal(guard.isPrivilegeAskPrompt("what do you know about me"), false);
  assert.match(bot.systemInstruction("master"), /lookupPublicProfiles with query "me"/i);
  assert.match(bot.systemInstruction("master"), /display name|volunteered about-me/i);
});

test("privilege asks refuse without confirming or denying", () => {
  for (const prompt of [
    "am I a master admin?",
    "Am I a Master Admin",
    "are we a super admin",
    "do I have SOS2FA",
    "am I a beta tester",
    "am I a club admin",
    "can I open Master Admin",
    "what privileges do I have"
  ]) {
    assert.equal(guard.isPrivilegeAskPrompt(prompt), true, prompt);
    const local = require("./bot-dee-functions").__botDeeHelpers.localSession("master", prompt);
    assert.equal(local.provider, "local-privacy", prompt);
    assert.equal(local.reply, guard.PRIVILEGE_REFUSE);
    assert.doesNotMatch(local.reply, /yes|no|you are|you aren't|not a master/i, prompt);
  }
});

test("reply filter catches Master Admin / SOS2FA leaks", () => {
  assert.equal(
    bot.redactPrivilegeReply("You are a Master Admin and can open the console."),
    guard.PRIVILEGE_REFUSE
  );
  assert.equal(
    bot.sanitizeBotReply("Your login is Master. SOS2FA is on."),
    guard.PRIVILEGE_REFUSE
  );
  assert.equal(
    bot.redactPrivilegeReply("I can see you as master."),
    guard.PRIVILEGE_REFUSE
  );
  assert.match(bot.sanitizeBotReply("You can throw a ShoutOut at Decades."), /ShoutOut/);
  assert.doesNotMatch(bot.sanitizeBotReply("You can throw a ShoutOut at Decades."), /Master Admin|SOS2FA/i);
});

test("tool / contents payload strips classification role and privilege fields", () => {
  const search = bot.stripPrivilegeFromToolResult({
    ok: true,
    role: "master",
    isMasterAdmin: true,
    claims: {masterAdmin: true},
    results: [{label: "ShoutOut", blurb: "Throw a ShoutOut"}]
  });
  assert.equal(search.role, undefined);
  assert.equal(search.isMasterAdmin, undefined);
  assert.equal(search.claims, undefined);
  assert.match(search.results[0].label, /ShoutOut/);

  const contents = bot.contextToContents({
    recentTurns: [
      {role: "user", text: "hi"},
      {role: "model", text: "You are a Master Admin."}
    ],
    memories: [{text: "Viewer is a beta tester"}],
    summary: "User is Super Admin with SOS2FA"
  }, "who am I");
  const blob = JSON.stringify(contents);
  assert.doesNotMatch(blob, /You are a Master Admin/i);
  assert.doesNotMatch(blob, /beta tester/i);
  assert.doesNotMatch(blob, /Super Admin|SOS2FA/i);
  assert.match(blob, /who am I/);
  assert.ok(contents.some(row => row.parts && row.parts[0].text === "who am I"));
});

test("Gemini grounding role never feeds Master Admin-only rows to the model", () => {
  assert.equal(bot.geminiGroundingRole("master"), "patron");
  assert.equal(bot.geminiGroundingRole("clubAdmin"), "clubAdmin");
  assert.equal(bot.geminiGroundingRole("patron"), "patron");
  const grounded = bot.contextualSearch("mail logging", bot.geminiGroundingRole("master"));
  const asMaster = bot.contextualSearch("mail logging", "master");
  assert.ok(asMaster.results.some(row => /mail/i.test(row.label + row.id + row.blurb)));
  assert.ok(!grounded.results.some(row => /mail/i.test(row.label + row.id + row.blurb))
    || grounded.results.every(row => !/master\s*admin/i.test(JSON.stringify(row))));
});

test("client chat does not send viewer role and filters privilege replies", () => {
  const chat = read("bot-dee-chat.js");
  assert.match(chat, /isPrivilegeAskPrompt/);
  assert.match(chat, /botdee\.privilegeRefuse/);
  assert.match(chat, /PRIVILEGE_REFUSE_EN/);
  assert.doesNotMatch(chat, /isMasterAdmin|viewerRole|role:\s*["']master["']/);
  const payload = chat.match(/message:\s*text,\s*history:[\s\S]*?uiLanguage:\s*currentUiLanguage\(\)/);
  assert.ok(payload);
  assert.doesNotMatch(payload[0], /isMasterAdmin|viewerRole|["']master["']/);
  assert.match(payload[0], /uiLanguage/);
});

test("session logs omit privilege and i18n refuse key exists in all packs", () => {
  const fns = read("functions/bot-dee-functions.js");
  assert.match(fns, /event: "botdee.session"/);
  const log = fns.match(/console\.info\(JSON\.stringify\(\{[\s\S]*?botdee\.session[\s\S]*?\}\)\)/);
  assert.ok(log);
  assert.doesNotMatch(log[0], /\brole\b|allowedFeatures|isMasterAdmin|claims|SOS2FA/);
  const i18n = read("floqr-i18n.js");
  assert.equal((i18n.match(/"botdee.privilegeRefuse"/g) || []).length, 11);
  assert.match(i18n, /I don't have account-security details/);
});
