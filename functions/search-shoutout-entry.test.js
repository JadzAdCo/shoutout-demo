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
  assert.match(page, /class="search-icon-row"/);
  assert.match(page, /<button id="shoutoutBtnCard" class="shoutout-icon-card"[^>]*>\s*<img src="\.\/shoutout-logo\.png[^"]*" alt="" class="shoutout-icon-img"[^>]*>\s*<\/button>/);
  assert.doesNotMatch(page, /shoutout-icon-title/);
  assert.match(page, /id="floqcastBtnCard"[^>]*class="shoutout-icon-card floqcast-icon-card[^"]*"[^>]*>[\s\S]*floqcast-icon-face[\s\S]*floqcast-icon\.svg[\s\S]*floqcast-icon-word/);
  assert.match(page, /id="vipReservBtnCard"[^>]*>[\s\S]*vip-icon-face[\s\S]*vip-reserv-mark\.svg[\s\S]*vip-icon-word[^>]*>VIP reserV/);
  assert.match(page, /id="intentSearchBtnCard"[^>]*floqai-icon-card[\s\S]*floqai-icon-face[\s\S]*floqai-icon-word/);
  const css = read("styles.css");
  assert.match(css, /\.category-brand-stack\{display:grid;justify-items:center;margin:44px 0 12px\}/);
  assert.match(css, /\.search-icon-row\{/);
  assert.match(css, /\.floqai-icon-face,\.floqcast-icon-face,\.vip-icon-face\{[^}]*flex-direction:column/);
  assert.match(css, /\.floqai-icon-face \.floqai-tile-mark,\.floqcast-icon-face \.floqcast-tile-mark,\.vip-icon-face \.vip-tile-mark\{[^}]*width:80%/);
  assert.match(css, /\.vip-icon-word\{/);
  assert.match(css, /max-width:900px\)[\s\S]*calc\(\(100% - 20px\) \/ 3\)/);
  assert.match(css, /\.shoutout-icon-card\.feature-beta::after\{[^}]*content:attr\(data-beta-label\)/, "Beta pill on shoutout-icon-card tiles");
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
