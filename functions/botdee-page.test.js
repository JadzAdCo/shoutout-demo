"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("BOT DEE page is botdee.html and every entry point goes there", () => {
  const nav = read("floqr-nav.js");
  assert.match(nav, /intentSearchHome\(\) \{\s*return buildUrl\("\.\/botdee\.html"\);/);
  assert.match(nav, /start === "intent"[\s\S]{0,200}location\.replace\(buildUrl\("\.\/botdee\.html"/, "old ?start=intent links redirect");
  assert.match(read("index.html"), /id="intentSearchBtnCard"[^>]*class="[^"]*botdee-icon-card[^"]*"[^>]*href="\.\/botdee\.html\?from=search"/);
  assert.match(read("index.html"), /intentSearchBtnCard[\s\S]*?botdee-(?:nightlife|traditional|whiteblack)\.jpg/);
  assert.match(read("styles.css"), /\.botdee-icon-face,\.floqcast-icon-face,\.shoutout-icon-face,\.vip-icon-face,\.settings-icon-face\{[^}]*background:transparent/);
  assert.ok(fs.existsSync(path.join(root, "botdee.html")), "botdee.html is the canonical page");
  assert.equal(fs.existsSync(path.join(root, "floqai.html")), false, "floqai.html removed");
  assert.equal(fs.existsSync(path.join(root, "floqai-search.html")), false, "floqai-search.html removed");
  assert.match(read("floqr-feature-services.js"), /key: "botDee"[^}]*route: "\.\/botdee\.html"/);
  assert.match(read("functions/feature-services-core.js"), /key: "botDee"[^}]*route: "\.\/botdee\.html"/);
  assert.match(read("floqr-feature-services.js"), /label: "BOT DEE"/);
  assert.match(read("functions/feature-services-core.js"), /label: "BOT DEE"/);
  assert.match(read("global-profile-status.js"), /intentSearchHome/);
});

test("BOT DEE page is a guarded satellite with chat + intent fallback", () => {
  const html = read("botdee.html");
  assert.match(html, /<body class="botdee-standalone botdee-page" data-floqr-feature="botDee">/, "off/test feature shows the not-available card, no bounce to event search");
  assert.doesNotMatch(html, /data-floqr-public/);
  assert.match(html, /data-floqr-chrome/);
  assert.match(html, /data-floqr-chrome-icon="botDee"/);
  assert.match(html, /id="botDeeChatPage"/);
  assert.match(html, /id="botDeeTranscript"/);
  assert.match(html, /id="botDeeChatForm"/);
  assert.match(html, /id="botDeeIntentFallback"/);
  const order = [
    "firebase-config.js",
    "floqr-session-shell.js",
    "botdee-help-repository.js",
    "intent-search.js",
    "floqr-feature-services.js",
    "bot-dee-chat.js",
    "botdee-page.js"
  ].map(file => html.indexOf(`./${file}`));
  assert.ok(order.every(i => i > 0), "scripts present");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "script order");
  ["intentSearchPage", "intentSearchInput", "intentSearchResults", "botDeeSearchPanel", "botDeeAgent", "botDeeMark", "botDeeScopeNote"]
    .forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
  const page = read("botdee-page.js");
  assert.match(page, /bindIntentSearch\(/);
  assert.match(page, /FLOQRBotDeeChat\?\.bind/);
  assert.match(page, /syncHelpAudienceFromAuth/);
  assert.match(page, /getViewerAudience/);
  assert.match(read("intent-search.js"), /locallyAllowed\(audiences, intent\.sourceId, flags\)/, "results filtered by classification for the viewer");
  assert.match(read("bot-dee-chat.js"), /executeBotSession/);
  assert.match(read("bot-dee-chat.js"), /getBotDeeThread/);
  assert.match(read("bot-dee-chat.js"), /Restoring your conversation/);
  assert.match(read("bot-dee-chat.js"), /durableEnabled/);
  assert.match(read("bot-dee-chat.js"), /restoreOrWelcome/);
  assert.match(read("bot-dee-chat.js"), /function displayReply/);
  assert.match(read("bot-dee-chat.js"), /botdee\.chatEmpty/);
  assert.match(read("bot-dee-chat.js"), /No answer yet — try quick intent search/);
  assert.match(read("functions/bot-dee-functions.js"), /receivedAtMs/);
  assert.match(read("functions/bot-dee-functions.js"), /storedUserText/);
  assert.match(read("functions/bot-dee-functions.js"), /clipStoredText\(rawMessage/);
  assert.match(read("functions/bot-dee-thread.js"), /nextTranscript/);
  assert.match(read("functions/bot-dee-thread.js"), /lastMessageAtMs: receivedAtMs/);
  assert.match(read("bot-dee-chat.js"), /restoreInFlight/);
  assert.match(read("bot-dee-chat.js"), /if \(restoreInFlight/);
  assert.match(read("bot-dee-chat.js"), /setBusy\(true\)/);
  assert.match(read("bot-dee-chat.js"), /isChitchatPrompt/);
  assert.match(read("bot-dee-chat.js"), /isMoodPrompt/);
  assert.match(read("bot-dee-chat.js"), /botdee\.chatHello/);
  assert.match(read("bot-dee-chat.js"), /botdee\.chatMood/);
  assert.match(read("bot-dee-chat.js"), /Local chatbot first only when durable threads are off/);
  assert.match(read("bot-dee-chat.js"), /Shift\+Enter|shiftKey/);
  assert.match(read("bot-dee-chat.js"), /event\.key !== "Enter"/);
  assert.match(read("botdee.html"), /Enter sends/);
  assert.match(read("bot-dee-chat.js"), /botdee-msg-avatar/);
  assert.match(read("bot-dee-chat.js"), /botdee-bubble-tail/);
  assert.match(read("bot-dee-chat.js"), /botdee-chat-avatar\.png/);
  assert.doesNotMatch(read("bot-dee-chat.js"), /botdee-msg-avatar[\s\S]{0,200}data-floqr-chrome-icon/, "bubble avatar is the robot-head asset, not Site chrome");
  assert.match(read("bot-dee-chat.css"), /\.botdee-bubble-tail/);
  assert.match(read("bot-dee-chat.css"), /\.botdee-msg-avatar/);
  assert.ok(fs.existsSync(path.join(root, "images", "botdee-chat-avatar.png")), "chat avatar PNG present");
});

test("floating BOT DEE agent is not shown on template select", () => {
  const search = read("botdee-search.js");
  assert.match(search, /function syncAgentVisibility/);
  assert.match(search, /Template select already has the lens Search field/);
  assert.match(search, /const onIntent = document\.getElementById\("intentSearchPage"\)/);
  assert.doesNotMatch(
    search,
    /const onTemplates = document\.getElementById\("templateSelectPage"\)[\s\S]{0,120}const show = !!\(onIntent \|\| onTemplates\)/,
    "template select must not toggle the floating agent visible"
  );
  assert.match(search, /const show = !!onIntent;/);
});

test("BOT DEE page chrome is localized", () => {
  const html = read("botdee.html");
  ["page.botdee.title", "botdee.helpIntro", "botdee.helpComposer", "botdee.helpScope", "botdee.prompt", "botdee.hint", "botdee.intentFallback", "botdee.chatSend"]
    .forEach(key => assert.match(html, new RegExp(`data-i18n="${key.replace(/\./g, "\\.")}"`)));
  assert.match(html, /data-i18n-placeholder="botdee\.placeholder"/);
  assert.match(html, /data-i18n-placeholder="botdee\.chatPlaceholder"/);
  const search = read("intent-search.js");
  assert.match(search, /tr\("botdee\.noMatch"/);
  assert.match(search, /tr\("botdee\.wantTo"/);
  const helpRepo = read("botdee-help-repository.js");
  assert.match(helpRepo, /id: "help-botdee-page"/);
  assert.match(helpRepo, /Press Enter to send a message/);
  assert.match(helpRepo, /Shift\+Enter starts a new line/);
  assert.doesNotMatch(helpRepo, /FloqAi/);
  assert.match(helpRepo, /title: "BOT DEE"/);
  assert.match(helpRepo, /Ask FloqR with BOT DEE/);
  assert.match(read("floqr-i18n.js"), /"botdee\.chatWelcome"/);
  assert.match(read("floqr-i18n.js"), /"botdee\.helpComposer"/);
  assert.match(read("floqr-i18n.js"), /"botdee\.chatRestoring"/);
  assert.match(helpRepo, /refresh or open another phone/);
  assert.doesNotMatch(read("floqr-i18n-help.js"), /FloqAi/);
  // Patron-facing chrome + help title/body values never say FloqAi (legacy search aliases OK).
  const chromeVals = [...read("floqr-i18n.js").matchAll(/:\s*"([^"]*)"/g)].map(m => m[1]);
  assert.ok(chromeVals.every(v => !/\bFloqAi\b/.test(v)), "chrome pack values must say BOT DEE, not FloqAi");
  const helpBodies = [...read("floqr-i18n-help.js").matchAll(/\b(?:title|body):\s*"([^"]*)"/g)].map(m => m[1]);
  assert.ok(helpBodies.every(v => !/\bFloqAi\b/.test(v)), "help title/body packs must say BOT DEE, not FloqAi");
  assert.match(read("botdee-search.js"), /Hi, I am BOT DEE/);
  assert.doesNotMatch(read("botdee-search.js"), /Hi, I am FloqAi/);
  assert.doesNotMatch(read("floqr-auth-gate.js"), /floqai-search\.html/);
});
