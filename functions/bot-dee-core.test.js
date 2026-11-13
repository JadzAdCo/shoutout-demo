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

test("BOT DEE result locales are fresh from help + chrome", () => {
  const {buildLocales, serialize: ser} = require("../scripts/build-bot-dee-result-locales");
  const current = fs.readFileSync(path.join(__dirname, "bot-dee-result-locales.json"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(current, ser(buildLocales(root)), "run node scripts/build-bot-dee-result-locales.js");
  assert.equal(bot.RESULT_LOCALES.byLang.de.results["intent:shoutout"].label, "Einen ShoutOut senden");
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
  assert.equal(bot.isMoodPrompt("How are you?"), true);
  assert.equal(bot.isMoodPrompt("hello how are you"), true);
  assert.equal(bot.isMoodPrompt("how's it going"), true);
  assert.equal(bot.isMoodPrompt("Hey"), false);
  assert.equal(bot.isChitchatPrompt("thanks"), true);
  assert.equal(bot.isChitchatPrompt("throw a shoutout"), false);
  assert.equal(bot.isChitchatPrompt("mail logging"), false);

  const heyHits = bot.contextualSearch("Hey", "master");
  assert.equal(heyHits.results.length, 0, "hey must not substring-match they/…");
  assert.equal(bot.contextualSearch("Hello", "master").results.length, 0);

  const reply = bot.chitchatReply("master");
  assert.match(reply, /BOT DEE here/i);
  assert.doesNotMatch(reply, /Here is what I found/i);
  assert.doesNotMatch(bot.formatSearchFallback(heyHits), /Here is what I found/i);
  assert.match(bot.moodReply(), /thanks for asking|doing great/i);
  assert.doesNotMatch(bot.moodReply(), /Here is what I found/i);

  const fns = require("./bot-dee-functions");
  for (const prompt of ["Hey", "Hello"]) {
    const local = fns.__botDeeHelpers.localSession("master", prompt);
    assert.equal(local.provider, "local-chitchat", prompt);
    assert.equal(local.results.length, 0, prompt);
    assert.match(local.reply, /What do you want to do/i);
  }
  for (const prompt of ["How are you?", "hello how are you", "how's it going"]) {
    const local = fns.__botDeeHelpers.localSession("master", prompt);
    assert.equal(local.provider, "local-chitchat", prompt);
    assert.equal(local.model, "mood", prompt);
    assert.equal(local.results.length, 0, prompt);
    assert.match(local.reply, /thanks for asking|doing great|help you/i, prompt);
    assert.doesNotMatch(local.reply, /Here is what I found/i, prompt);
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
  assert.match(bot.systemInstruction("patron"), /Mood \/ how-are-you|helpful friend/i);
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
  assert.match(src, /assertFeatureAccess\(request\.auth, "botDee"/);
  assert.match(src, /@google\/genai/);
  assert.match(src, /contextualSearch/);
  assert.match(src, /uiLanguage/);
  assert.doesNotMatch(src, /purchaseVIPReservation/);
  assert.match(read("functions/bot-dee-tools.js"), /startShoutOutCheckout/);
  assert.match(read("functions/bot-dee-tools.js"), /createVipHold/);
  assert.match(read("functions/bot-dee-tools.js"), /createFloqCastCheckout/);
  assert.match(read("functions/bot-dee-tools.js"), /lookupPublicProfiles/);
  assert.match(read("functions/index.js"), /executeBotSession:\s*require\("\.\/bot-dee-functions"\)\.executeBotSession/);
  const names = bot.toolDeclarations().map(t => t.name);
  assert.ok(names.includes("contextualSearch"));
  assert.ok(names.includes("lookupPublicProfiles"));
  assert.ok(names.includes("startShoutOutCheckout"));
  assert.ok(names.includes("createVipCheckout"));
  assert.ok(names.includes("createFloqCastRequest"));
});

test("result cards localize to app language (no English ShoutOut label in German)", () => {
  const search = bot.contextualSearch("throw a shoutout", "patron", ["shoutOut", "botDee"]);
  assert.ok(search.results.some(row => row.id === "shoutout" || /shout/i.test(row.label)));
  const de = bot.localizeSearchPayload(search, "de", ["shoutOut", "botDee"]);
  const shout = de.results.find(row => row.sourceId === "intent:shoutout" || row.id === "shoutout");
  assert.ok(shout, "shoutout intent in results");
  assert.equal(shout.label, "Einen ShoutOut senden");
  assert.match(shout.blurb, /Live-Nachricht|FloqR-Display/i);
  assert.doesNotMatch(shout.label, /^Throw a ShoutOut$/);

  const fallback = bot.formatSearchFallback(de, "de", ["shoutOut", "botDee"]);
  assert.match(fallback, /Das habe ich für dein Konto gefunden/);
  assert.doesNotMatch(fallback, /Here is what I found/);

  const links = bot.linksFromToolResult({checkoutUrl: "https://pay.example/x"}, "de");
  assert.equal(links[0].label, "Sicher bezahlen");

  assert.match(bot.systemInstruction("patron", "de", ["shoutOut", "botDee"]), /App language is "de"/);
  assert.match(read("bot-dee-chat.js"), /uiLanguage:\s*currentUiLanguage/);
  assert.match(read("bot-dee-chat.js"), /localizeResults/);
});

test("BOT DEE hides gated beta features the viewer cannot access", () => {
  const allowed = ["shoutOut", "botDee", "passes"];
  const search = bot.contextualSearch("mingl chat friends", "patron", allowed);
  assert.ok(!search.results.some(row => /mingl/i.test(row.sourceId + row.id + row.label)));

  const floq = bot.contextualSearch("make me a superstar floqcast", "patron", allowed);
  assert.ok(!floq.results.some(row => /floqcast|suprstr/i.test(row.sourceId + row.id)));

  const shout = bot.contextualSearch("throw a shoutout", "patron", allowed);
  assert.ok(shout.results.some(row => row.sourceId === "intent:shoutout" || row.id === "shoutout"));

  const scrubbed = bot.sanitizeFeatureMentions(
    "Products: Mingl, RydR, BartR, ShoutOut, floqCast (superstar), VIP-Tisch, table VIP, VIP entry, clubs.",
    allowed
  );
  assert.match(scrubbed, /ShoutOut/);
  assert.doesNotMatch(scrubbed, /\bMingl\b/);
  assert.doesNotMatch(scrubbed, /\bRydR\b/);
  assert.doesNotMatch(scrubbed, /\bBartR\b/);
  assert.doesNotMatch(scrubbed, /\bfloqCast\b/i);
  assert.doesNotMatch(scrubbed, /VIP-Tisch|table VIP|VIP entry/i);

  const nonLatin = bot.sanitizeFeatureMentions(
    "ShoutOut, VIP-стол, VIP τραπέζι, طاولة VIP, floqCast, scheduling",
    allowed
  );
  assert.match(nonLatin, /ShoutOut/);
  assert.match(nonLatin, /scheduling/);
  assert.doesNotMatch(nonLatin, /VIP-стол|VIP τραπέζι|طاولة VIP|floqCast/i);
  assert.doesNotMatch(nonLatin, /,\s*,/);

  const commas = bot.sanitizeFeatureMentions(
    "ShoutOut, VIP table, floqCast, scheduling",
    allowed
  );
  assert.equal(commas, "ShoutOut, scheduling");

  const tools = bot.toolDeclarations(allowed).map(t => t.name);
  assert.ok(tools.includes("contextualSearch"));
  assert.ok(tools.includes("listShoutOutTemplates"));
  assert.ok(!tools.includes("createVipHold"));
  assert.ok(!tools.includes("createFloqCastRequest"));

  const pitch = bot.chitchatReply("patron", allowed);
  assert.match(pitch, /ShoutOut/);
  assert.doesNotMatch(pitch, /floqCast|VIP reserV|VIP table|Mingl/i);

  const deniedNames = bot.deniedBrandNames(allowed);
  assert.ok(deniedNames.includes("floqCast"));
  assert.ok(deniedNames.includes("VIP reserV"));
  assert.ok(deniedNames.includes("Mingl"));
  assert.match(bot.systemInstruction("patron", "en", allowed), /least privilege/i);
  assert.match(read("functions/bot-dee-functions.js"), /loadAllowedFeatures/);
  assert.match(read("bot-dee-chat.js"), /scrubGatedBrands|accessibleProductPitch/);
  // Local greetings must scrub by access — not discard locale when floqCast/VIP appear in chrome packs.
  assert.match(read("bot-dee-chat.js"), /return scrubGatedBrands\(localized\)/);
  assert.doesNotMatch(
    read("bot-dee-chat.js"),
    /localized !== "botdee\.chatHello" && !\\bMingl\\b/
  );
});

test("BOT DEE keeps granted beta features in help/search (least privilege)", () => {
  const granted = ["shoutOut", "botDee", "passes", "floqCast", "vipReservations"];
  const floq = bot.contextualSearch("make me a superstar floqcast", "patron", granted);
  assert.ok(floq.results.some(row => /floqcast|suprstr/i.test(row.sourceId + row.id)));

  const vip = bot.contextualSearch("book vip table", "patron", granted);
  assert.ok(vip.results.some(row => /vip/i.test(row.sourceId + row.id + row.label)));

  const helpBlurb = bot.sanitizeFeatureMentions(
    "Chat with BOT DEE: ShoutOut, Mingl, RydR, BartR, floqCast, VIP table, clubs.",
    granted
  );
  assert.match(helpBlurb, /ShoutOut/);
  assert.match(helpBlurb, /floqCast/i);
  assert.match(helpBlurb, /VIP table/i);
  assert.doesNotMatch(helpBlurb, /\bMingl\b|\bRydR\b|\bBartR\b/);

  const tools = bot.toolDeclarations(granted).map(t => t.name);
  assert.ok(tools.includes("createFloqCastRequest"));
  assert.ok(tools.includes("createVipHold"));

  // Bugbot: NEVER list must omit granted brands (only siblings this viewer lacks).
  const deniedNames = bot.deniedBrandNames(granted);
  assert.deepEqual(deniedNames, ["Mingl", "RydR", "BartR"]);
  const instr = bot.systemInstruction("patron", "en", granted);
  assert.match(instr, /THIS viewer: ShoutOut, VIP reserV, floqCast/);
  assert.match(instr, /this viewer lacks: Mingl, RydR, BartR\./);
});

test("intent:help-* result cards localize via help pack alias", () => {
  const row = {
    sourceId: "intent:help-botdee-page",
    id: "help-botdee-page",
    kind: "product",
    label: "BOT DEE",
    blurb: "Chat with BOT DEE on the BOT DEE page in plain words: events and clubs, ShoutOut, Mingl, RydR, BartR, floqCast"
  };
  const de = bot.localizeResultRow(row, "de");
  assert.equal(de.label, "BOT DEE");
  assert.match(de.blurb, /Chatte mit BOT DEE|BOT DEE-Seite/i);
  assert.doesNotMatch(de.blurb, /Chat with BOT DEE on the BOT DEE page in plain words/);
  assert.ok(bot.RESULT_LOCALES.byLang.de.results["intent:help-botdee-page"]);
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
