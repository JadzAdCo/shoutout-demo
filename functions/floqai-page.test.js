"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("FloqAi has its own page and every entry point goes there", () => {
  const nav = read("floqr-nav.js");
  assert.match(nav, /intentSearchHome\(\) \{\s*return buildUrl\("\.\/floqai\.html", \{ v: APP_V \}\);/);
  assert.match(nav, /start === "intent"[\s\S]{0,200}location\.replace\(buildUrl\("\.\/floqai\.html"/, "old ?start=intent links redirect");
  assert.match(read("index.html"), /id="intentSearchBtnCard"[^>]*href="\.\/floqai\.html\?v=s3\.1\.20&from=search"/);
  assert.match(read("floqai-search.html"), /location\.replace\("\.\/floqai\.html/);
  assert.match(read("floqr-feature-services.js"), /key: "floqAi"[^}]*route: "\.\/floqai\.html"/);
  assert.match(read("functions/feature-services-core.js"), /key: "floqAi"[^}]*route: "\.\/floqai\.html"/);
  assert.match(read("global-profile-status.js"), /intentSearchHome/);
});

test("FloqAi page is a guarded satellite with audience-filtered search", () => {
  const html = read("floqai.html");
  assert.match(html, /<body class="floqai-standalone" data-floqr-feature="floqAi">/, "off/test feature shows the not-available card, no bounce to event search");
  assert.doesNotMatch(html, /data-floqr-public/);
  const order = ["firebase-config.js", "floqr-session-shell.js", "floqai-help-repository.js", "intent-search.js", "floqr-feature-services.js", "floqai-page.js"]
    .map(file => html.indexOf(`./${file}`));
  assert.ok(order.every(i => i > 0), "scripts present");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "script order");
  ["intentSearchPage", "intentSearchInput", "intentSearchResults", "floqAiSearchPanel", "floqAiAgent", "floqAiMark", "floqAiScopeNote"]
    .forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
  const page = read("floqai-page.js");
  assert.match(page, /bindIntentSearch\(/);
  assert.match(page, /syncHelpAudienceFromAuth/);
  assert.match(page, /getViewerAudience/);
  assert.match(read("intent-search.js"), /canAccessHelpEntry\(\{audiences\}, flags\)/, "results filtered by viewer access flags");
});

test("FloqAi page chrome is localized", () => {
  const html = read("floqai.html");
  ["page.floqai.title", "floqai.helpIntro", "floqai.helpScope", "floqai.prompt", "floqai.hint"]
    .forEach(key => assert.match(html, new RegExp(`data-i18n="${key.replace(/\./g, "\\.")}"`)));
  assert.match(html, /data-i18n-placeholder="floqai\.placeholder"/);
  const search = read("intent-search.js");
  assert.match(search, /tr\("floqai\.noMatch"/);
  assert.match(search, /tr\("floqai\.wantTo"/);
  assert.match(read("floqai-help-repository.js"), /id: "help-floqai-page"/);
});
