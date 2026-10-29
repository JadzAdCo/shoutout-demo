"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const bot = require("./bot-dee-core");
const {buildCatalog, serialize} = require("../scripts/build-bot-dee-search-catalog");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("BOT DEE search catalog is fresh from help + intents", () => {
  const current = fs.readFileSync(path.join(__dirname, "bot-dee-search-catalog.json"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(current, serialize(buildCatalog(root)), "run node scripts/build-bot-dee-search-catalog.js");
  assert.ok(bot.SEARCH_CATALOG.entries.length > 50);
});

test("contextualSearch filters by classification role", () => {
  const patron = bot.contextualSearch("throw a shoutout", "patron");
  assert.ok(patron.results.some(row => /shout/i.test(row.label) || row.id === "shoutout"));
  assert.ok(patron.results.every(row => row.sourceId && row.href));

  const anon = bot.contextualSearch("mail logging", "anonymous");
  assert.ok(!anon.results.some(row => /mail.?log/i.test(row.label + row.id)));

  const master = bot.contextualSearch("mail logging", "master");
  assert.ok(master.results.some(row => /mail/i.test(row.label + row.id + row.blurb)));
});

test("Hey / greetings are chitchat — not a dump of search hits", () => {
  assert.equal(bot.isChitchatPrompt("Hey"), true);
  assert.equal(bot.isChitchatPrompt("hey!"), true);
  assert.equal(bot.isChitchatPrompt("Hello"), true);
  assert.equal(bot.isChitchatPrompt("hello!"), true);
  assert.equal(bot.isChitchatPrompt("Hi BOT DEE"), true);
  assert.equal(bot.isChitchatPrompt("hello how are you"), true);
  assert.equal(bot.isChitchatPrompt("thanks"), true);
  assert.equal(bot.isChitchatPrompt("throw a shoutout"), false);
  assert.equal(bot.isChitchatPrompt("mail logging"), false);

  const heyHits = bot.contextualSearch("Hey", "master");
  assert.equal(heyHits.results.length, 0, "hey must not substring-match they/…");
  assert.equal(bot.contextualSearch("Hello", "master").results.length, 0);

  const reply = bot.chitchatReply("master");
  assert.match(reply, /BOT DEE here/i);
  assert.doesNotMatch(reply, /FloqAi here/i);
  assert.doesNotMatch(reply, /Here is what I found/i);
  assert.doesNotMatch(bot.formatSearchFallback(heyHits), /Here is what I found/i);

  const fns = require("./bot-dee-functions");
  for (const prompt of ["Hey", "Hello", "hello how are you"]) {
    const local = fns.__botDeeHelpers.localSession("master", prompt);
    assert.equal(local.provider, "local-chitchat", prompt);
    assert.equal(local.results.length, 0, prompt);
    assert.match(local.reply, /What do you want to do/i);
  }
});

test("cool / ok acknowledgments stay conversational — not a greeting restart or search", () => {
  for (const prompt of ["cool", "Cool!", "ok", "okay", "thanks", "got it", "sounds good", "that's cool", "awesome"]) {
    assert.equal(bot.isAckPrompt(prompt), true, prompt);
    assert.equal(bot.isChitchatPrompt(prompt), true, prompt);
  }
  assert.equal(bot.isAckPrompt("hey"), false);
  assert.equal(bot.isAckPrompt("throw a shoutout"), false);

  const ack = bot.ackReply("patron", "cool");
  assert.match(ack, /Cool/i);
  assert.doesNotMatch(ack, /keep going|Want to|ShoutOut|VIP|floqCast/i);
  assert.doesNotMatch(ack, /BOT DEE here/i);
  assert.doesNotMatch(ack, /Here is what I found/i);
  assert.match(bot.ackReply("patron", "thanks"), /welcome/i);
  assert.match(bot.ackReply("patron", "bye"), /hi when you want|Take care/i);
  assert.equal(bot.isFarewellPrompt("bye"), true);
  assert.equal(bot.isFarewellPrompt("cool"), false);

  const fns = require("./bot-dee-functions");
  const local = fns.__botDeeHelpers.localSession("patron", "cool");
  assert.equal(local.provider, "local-chitchat");
  assert.equal(local.model, "ack");
  assert.equal(local.results.length, 0);
  assert.match(local.reply, /Cool/i);
  assert.doesNotMatch(local.reply, /BOT DEE here/i);
  assert.doesNotMatch(local.reply, /Want to keep going/i);
});

test("idle settings clamp + soft mid-chat copy helpers", () => {
  assert.equal(bot.DEFAULT_IDLE_SECONDS, 60);
  assert.equal(bot.clampIdleSeconds(60), 60);
  assert.equal(bot.clampIdleSeconds(5), bot.MIN_IDLE_SECONDS);
  assert.equal(bot.clampIdleSeconds(9999), bot.MAX_IDLE_SECONDS);
  assert.equal(bot.normalizeBotDeeSettings(null).conversationIdleSeconds, 60);
  assert.equal(bot.normalizeBotDeeSettings({conversationIdleSeconds: 90}).conversationIdleSeconds, 90);
  assert.match(bot.stillHereReply(), /still here/i);
  assert.match(bot.idleEndedReply(), /pause|Say hi/i);
  assert.match(bot.resumeReply("patron"), /What do you want to do/i);
  assert.doesNotMatch(bot.identityReply(), /What do you want to do/i);
  assert.match(bot.systemInstruction("patron"), /ONLY on the first turn/i);
});

test("setBotDeeSettings callable is exported", () => {
  assert.match(read("functions/bot-dee-functions.js"), /exports\.setBotDeeSettings/);
  assert.match(read("functions/index.js"), /setBotDeeSettings:\s*require\("\.\/bot-dee-functions"\)\.setBotDeeSettings/);
  assert.match(read("bot-dee-chat.js"), /botDeeSettings\/default/);
  assert.match(read("bot-dee-chat.js"), /endConversation|chatIdleEnded|chatResume|chatStillHere/);
  assert.match(read("master-admin.html"), /id="featuresBotDee"/);
  assert.match(read("master-feature-services.js"), /setBotDeeSettings/);
  assert.match(read("firestore.rules"), /match \/botDeeSettings\/\{docId\}/);
});

test("Name / pronunciation is identity — not a search dump", () => {
  assert.equal(bot.isIdentityPrompt("how is your name pronounced?"), true);
  assert.equal(bot.isIdentityPrompt("How do you pronounce BOT DEE"), true);
  assert.equal(bot.isIdentityPrompt("who are you"), true);
  assert.equal(bot.isIdentityPrompt("what's your name"), true);
  assert.equal(bot.isIdentityPrompt("throw a shoutout"), false);

  const reply = bot.identityReply();
  assert.match(reply, /BOT DEE/i);
  assert.match(reply, /dee/i);
  assert.doesNotMatch(reply, /Here is what I found/i);
  assert.doesNotMatch(reply, /What do you want to do/i);

  const fns = require("./bot-dee-functions");
  const local = fns.__botDeeHelpers.localSession("master", "how is your name pronounced?");
  assert.equal(local.provider, "local-identity");
  assert.equal(local.results.length, 0);
  assert.match(local.reply, /bot/i);
});

test("Gemini toolConfig uses AUTO without allowedFunctionNames", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(src, /FunctionCallingConfigMode\.AUTO/);
  assert.doesNotMatch(
    src,
    /functionCallingConfig:\s*\{[^}]*allowedFunctionNames/,
    "allowedFunctionNames with AUTO 400s on Gemini and forces search fallback"
  );
});

test("sanitizeHistory keeps bounded user/model turns", () => {
  const history = bot.sanitizeHistory([
    {role: "system", text: "ignore"},
    {role: "user", text: "hello"},
    {role: "assistant", text: "hi"},
    {role: "user", text: "x".repeat(5000)}
  ]);
  assert.equal(history.length, 3);
  assert.equal(history[0].role, "user");
  assert.equal(history[1].role, "model");
  assert.ok(history[2].text.length <= bot.MAX_MESSAGE_CHARS);
});

test("executeBotSession wiring exports tools including VIP/ShoutOut/FloqCAST checkout", () => {
  const src = read("functions/bot-dee-functions.js");
  assert.match(src, /exports\.executeBotSession/);
  assert.match(src, /assertFeatureAccess\(request\.auth, "floqAi"/);
  assert.match(src, /@google\/genai/);
  assert.match(src, /contextualSearch/);
  assert.doesNotMatch(src, /purchaseVIPReservation/);
  assert.match(read("functions/bot-dee-tools.js"), /startShoutOutCheckout/);
  assert.match(read("functions/bot-dee-tools.js"), /createVipHold/);
  assert.match(read("functions/bot-dee-tools.js"), /createFloqCastCheckout/);
  assert.match(read("functions/index.js"), /executeBotSession:\s*require\("\.\/bot-dee-functions"\)\.executeBotSession/);
  const names = bot.toolDeclarations().map(t => t.name);
  assert.ok(names.includes("contextualSearch"));
  assert.ok(names.includes("startShoutOutCheckout"));
  assert.ok(names.includes("createVipCheckout"));
  assert.ok(names.includes("createFloqCastRequest"));
});

test("package depends on @google/genai", () => {
  const pkg = JSON.parse(read("functions/package.json"));
  assert.ok(pkg.dependencies["@google/genai"]);
});

test("createVipCheckout branches on venue paymentCollector (not Stripe-only)", () => {
  const tools = read("functions/bot-dee-tools.js");
  assert.match(tools, /loadClubPaymentSettings/);
  assert.match(tools, /runConfirmVipReservationForClubPos/);
  assert.match(tools, /runConfirmVipReservationWithoutDeposit/);
  assert.match(tools, /checkoutMode:\s*"clubPos"/);
  assert.match(tools, /checkoutMode:\s*"noDeposit"/);
  assert.match(tools, /orderType:\s*"vipReservation"/);
  const core = read("functions/bot-dee-core.js");
  assert.match(core, /venue collector/);
  assert.match(core, /clubPos/);
  assert.match(read("functions/vip-pos-functions.js"), /async function runConfirmVipReservationForClubPos/);
  assert.match(read("functions/vip-functions.js"), /async function runConfirmVipReservationWithoutDeposit/);
});
