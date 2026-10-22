"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function section(html, id) {
  const start = html.indexOf(`<section id="${id}"`);
  return html.slice(start, html.indexOf("</section>", start));
}

test("Search page shows the FLOQR logo and standardized ShoutOut / floqCast / VIP / FloqAi icon tiles", () => {
  const page = section(read("index.html"), "categoryPage");
  assert.match(page, /class="category-brand-stack">\s*<img src="\.\/images\/floqr-color\.png" alt="FLOQR" class="product-parent-logo"/);
  assert.ok(page.indexOf("category-brand-stack") < page.indexOf('id="categoryFloqAiSearch"'), "logo sits above FloqAi");
  assert.doesNotMatch(page, /search-chrome-toolbar/);
  assert.doesNotMatch(page, /data-floqr-chrome-btn=/);
  assert.match(page, /class="search-icon-row"/);
  // Spot order: floqCast (1) → ShoutOut (2)
  assert.match(page, /id="floqcastBtnCard"[\s\S]*?id="shoutoutBtnCard"/);
  assert.match(page, /id="shoutoutBtnCard"[^>]*>[\s\S]*shoutout-logo\.png/);
  assert.doesNotMatch(page, /shoutout-icon-title/);
  assert.match(page, /id="floqcastBtnCard"[^>]*class="shoutout-icon-card floqcast-icon-card[^"]*"[\s\S]*floqcast-nightlife\.jpg/);
  assert.match(page, /id="vipReservBtnCard"[^>]*>[\s\S]*vip-icon-face--mark-only[\s\S]*vip-reserv-mark\.svg/);
  assert.doesNotMatch(page, /id="vipReservBtnCard"[\s\S]*vip-icon-word/);
  assert.match(page, /id="intentSearchBtnCard"[^>]*floqai-icon-card[\s\S]*floqr-tiles-transparent\.png/);
  assert.match(page, /data-i18n="cat.floqai">dj BOT</);
  const css = read("styles.css");
  assert.match(css, /\.category-brand-stack\{display:grid;justify-items:center;margin:44px 0 12px\}/);
  assert.match(css, /\.search-icon-row\{/);
  assert.match(css, /html\[data-floqr-chrome="traditional"\]/);
  assert.match(css, /\.floqai-icon-face,\.floqcast-icon-face,\.vip-icon-face\{[^}]*flex-direction:column/);
  assert.match(css, /\.vip-icon-face\.vip-icon-face--mark-only\{/);
  assert.match(css, /max-width:900px\)[\s\S]*calc\(\(100% - 20px\) \/ 3\)/);
  assert.match(css, /\.shoutout-icon-card\.feature-beta::after\{[^}]*content:attr\(data-beta-label\)/, "Beta pill on shoutout-icon-card tiles");
  const chrome = read("floqr-chrome-scheme.js");
  assert.match(chrome, /FLOQRChromeScheme/);
  assert.match(chrome, /siteChrome/);
  assert.match(chrome, /isSiteChrome/);
  assert.match(chrome, /syncAccessGate/);
  assert.match(chrome, /hasThemeAccess/);
  const portal = read("patron-portal.html");
  assert.match(portal, /data-floqr-theme-panel/);
  assert.match(portal, /data-floqr-chrome-btn="traditional"/);
  const master = read("master-admin.html");
  assert.match(master, /id="featuresReleaseControl"[\s\S]*?>Release Control<\/h2>/);
  assert.doesNotMatch(master, /id="featuresReleaseControl"[\s\S]*?>Features Mgmt<\/h2>/);
  assert.match(master, /help-feature-promote-live/);
  assert.match(master, />Test → live<\/h2>/);
  assert.doesNotMatch(master, /id="featuresReleaseControl"[\s\S]*?<h2>Promote test code to live<\/h2>/);
});

test("Throw a ShoutOut skips the ShoutOut landing page", () => {
  const app = read("patron-app.js");
  const fn = app.slice(app.indexOf("async function showShoutoutLanding()"), app.indexOf("function readReuseShoutoutDraft()"));
  assert.doesNotMatch(fn, /showPage\("shoutoutLandingPage"\)/);
  assert.match(fn, /openCategory\("shoutout"\);/);
  assert.match(fn, /await selectLocationForShoutOut\(draft\.locationId\);\s*return;/);
  assert.match(app, /bind\("shoutoutBtnCard", showShoutoutLanding\)/);
});

test("ad splash FLOQR logo is unframed and FloqMedia contacts are not underlined", () => {
  const css = read("styles.css");
  assert.match(css, /#splashFloqrLogoWrap\{border:0;background:none;padding:0;min-height:0;border-radius:0\}/);
  assert.match(css, /\.splash-house-list a\{color:#fff;text-decoration:none\}/);
});
