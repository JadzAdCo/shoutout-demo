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

test("Search page shows the FLOQR logo and a ShoutOut icon link with its title underneath", () => {
  const page = section(read("index.html"), "categoryPage");
  assert.match(page, /class="category-brand-stack">\s*<img src="\.\/images\/floqr-color\.png" alt="FLOQR" class="product-parent-logo"/);
  assert.ok(page.indexOf("category-brand-stack") < page.indexOf('id="categoryFloqAiSearch"'), "logo sits above FloqAi");
  assert.match(page, /<button id="shoutoutBtnCard" class="shoutout-icon-card"[^>]*>\s*<img src="\.\/shoutout-logo\.png[^"]*" alt="" class="shoutout-icon-img"[^>]*>\s*<span class="shoutout-icon-title" data-i18n="cat\.shoutout">Throw a ShoutOut<\/span>/);
  const css = read("styles.css");
  assert.match(css, /\.category-brand-stack\{display:grid;justify-items:center;margin:44px 0 12px\}/);
  assert.match(css, /\.shoutout-icon-title\{[^}]*white-space:nowrap/);
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
