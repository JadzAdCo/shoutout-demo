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
  assert.match(page, /id="backToWelcomeBtn"[^>]*class="floqr-back-btn"[^>]*data-i18n="nav\.backShort"/);
  assert.match(page, /class="category-brand-stack">\s*<a href="\.\/\?start=search" class="floqr-home-link"[\s\S]*?<img src="\.\/images\/floqr-color\.png\?v=s3\.\d+\.\d+" alt="FloqR" class="product-parent-logo"/);
  assert.ok(page.indexOf("category-brand-stack") < page.indexOf('id="categoryFloqAiSearch"'), "logo sits above FloqAi");
  assert.doesNotMatch(page, /search-chrome-toolbar/);
  assert.doesNotMatch(page, /data-floqr-chrome-btn=/);
  assert.match(page, /class="search-icon-row"/);
  // Spot order: 1 ShoutOut · 2 BOT DEE · 3 VIP · 4 Settings · 5 floqCast
  assert.match(page, /id="shoutoutBtnCard"[\s\S]*?id="intentSearchBtnCard"[\s\S]*?id="vipReservBtnCard"[\s\S]*?id="settingsBtnCard"[\s\S]*?id="floqcastBtnCard"/);
  assert.match(page, /id="shoutoutBtnCard"[^>]*>[\s\S]*data-floqr-chrome-icon="shoutOut"[\s\S]*shoutout-nightlife\.png/);
  assert.doesNotMatch(page, /id="shoutoutBtnCard"[\s\S]*shoutout-logo\.png/);
  assert.doesNotMatch(page, /shoutout-icon-title/);
  assert.match(page, /id="floqcastBtnCard"[^>]*class="shoutout-icon-card floqcast-icon-card[^"]*"[\s\S]*floqcast-nightlife\.jpg/);
  assert.match(page, /id="vipReservBtnCard"[^>]*>[\s\S]*vip-icon-face--mark-only[\s\S]*vip-nightlife\.jpg/);
  assert.doesNotMatch(page, /id="vipReservBtnCard"[\s\S]*vip-icon-word/);
  assert.match(page, /id="intentSearchBtnCard"[^>]*floqai-icon-card[\s\S]*botdee-nightlife\.jpg/);
  assert.match(page, /id="settingsBtnCard"[^>]*href="\.\/patron-portal\.html\?from=search&tab=appearance"/);
  assert.match(page, /data-floqr-chrome-icon="settings"/);
  assert.match(page, /settings-nightlife\.jpg/);
  assert.match(page, /data-i18n-aria="cat.floqai"[^>]*aria-label="BOT DEE"/);
  assert.doesNotMatch(page, /Welcome, type below to search for Events/);
  assert.match(page, /placeholder="Search for Clubs, Lounge, Events, etc\."/);
  assert.match(page, /id="categoryFloqAiGo"[^>]*class="category-floqai-lens"[^>]*type="submit"/);
  assert.match(page, /class="category-floqai-field"/);
  assert.doesNotMatch(page, /id="categoryFloqAiGo"[^>]*class="primary"/);
  const css = read("styles.css");
  // Tighter brand stack under centered Image-2 Back pill (was 44px before unified Back)
  assert.match(css, /\.category-brand-stack\{display:grid;justify-items:center;margin:8px 0 12px\}/);
  assert.match(css, /--floqr-back-bg:rgba\(148,142,198/);
  assert.match(css, /\.floqr-back-btn,/);
  assert.match(css, /\.search-icon-row\{/);
  assert.match(css, /html\[data-floqr-chrome="traditional"\]/);
  assert.match(css, /\.floqai-icon-face,\.floqcast-icon-face,\.shoutout-icon-face,\.vip-icon-face,\.settings-icon-face\{[^}]*background:transparent/);
  assert.match(css, /\.floqai-icon-face,\.floqcast-icon-face,\.shoutout-icon-face,\.vip-icon-face,\.settings-icon-face\{[^}]*rgba\(0,200,255/);
  assert.match(css, /--floqr-tile-cyan:#00c8ff/);
  assert.match(css, /--floqr-brand-gradient-h:linear-gradient/);
  assert.match(css, /html\[data-floqr-chrome="blackTiffany"\]\{[\s\S]*--accent:var\(--floqr-tile-cyan\)/);
  assert.match(css, /html\[data-floqr-chrome="whiteBlack"\] \.primary/);
  assert.match(css, /html\[data-floqr-chrome="purpleWhite"\]\{/);
  assert.match(css, /html\[data-floqr-chrome="blackDarkGreen"\]\{[\s\S]*--accent:#2d8a5a/);
  assert.doesNotMatch(css, /\.floqai-icon-face,\.floqcast-icon-face,\.shoutout-icon-face,\.vip-icon-face(?:,\.settings-icon-face)?\{[^}]*background:#000/);
  assert.match(css, /\.vip-icon-face\.vip-icon-face--mark-only(?:,\.shoutout-icon-face\.chrome-photo-face)?\{/);
  assert.match(css, /max-width:900px\)[\s\S]*calc\(\(100% - 20px\) \/ 3\)/);
  assert.match(css, /max-width:1180px\)[\s\S]*#categoryPage\.page\.active[\s\S]*margin-top:auto!important/, "phones/tablets pin Search icon row to viewport bottom");
  assert.match(css, /min-width:1181px\)[\s\S]*#categoryPage\.page\.active \.category-grid\.compact-category-grid:has\(\.search-icon-row\)\{[\s\S]*margin-top:28px!important/, "wide desktop keeps icons under Search");
  assert.match(css, /\.shoutout-icon-card\.feature-beta::after\{[^}]*content:attr\(data-beta-label\)/, "Beta pill on shoutout-icon-card tiles");
  const searchCss = read("floqai-search.css");
  assert.match(searchCss, /\.category-floqai-lens\{/);
  assert.match(searchCss, /background:transparent!important/);
  assert.match(
    searchCss,
    /\.category-floqai-search\{[^}]*margin:0 auto 18px/,
    "desktop Search bar centered under FloqR logo"
  );
  const chrome = read("floqr-chrome-scheme.js");
  assert.match(chrome, /FLOQRChromeScheme/);
  assert.match(chrome, /siteChrome/);
  assert.match(chrome, /isSiteChrome/);
  assert.match(chrome, /syncAccessGate/);
  assert.match(chrome, /hasThemeAccess/);
  assert.match(chrome, /shoutout-traditional-green\.png/);
  assert.match(chrome, /shoutout-nightlife\.png/);
  const portal = read("patron-portal.html");
  assert.match(portal, /data-floqr-theme-panel/);
  assert.match(portal, /data-floqr-chrome-btn="traditional"/);
  assert.match(portal, /data-floqr-chrome-btn="blackTiffany"/);
  assert.match(portal, /data-floqr-chrome-btn="whiteBlack"/);
  assert.match(portal, /data-floqr-chrome-btn="purpleWhite"/);
  assert.match(portal, /data-floqr-chrome-btn="blackDarkGreen"/);
  assert.match(chrome, /BLACK_TIFFANY/);
  assert.match(chrome, /WHITE_BLACK/);
  assert.match(chrome, /PURPLE_WHITE/);
  assert.match(chrome, /BLACK_DARK_GREEN/);
  assert.match(chrome, /purpleWhite/);
  assert.match(chrome, /brandLogoUrl/);
  assert.match(chrome, /floqr-hero-blacktiffany\.png/);
  assert.match(chrome, /blackTiffany/);
  assert.match(chrome, /whiteBlack/);
  assert.match(chrome, /vip-whiteblack\.jpg/);
  const master = read("master-admin.html");
  assert.match(master, /id="featuresReleaseControl"[\s\S]*?>Release Control<\/h2>/);
  assert.doesNotMatch(master, /id="featuresReleaseControl"[\s\S]*?>Features Mgmt<\/h2>/);
  assert.match(master, /help-feature-promote-live/);
  assert.match(master, />Test → live<\/h2>/);
  assert.doesNotMatch(master, /id="featuresReleaseControl"[\s\S]*?<h2>Promote test code to live<\/h2>/);
});

test("Throw a ShoutOut opens standardized feature landing (shoutout-search)", () => {
  const app = read("patron-app.js");
  const fn = app.slice(app.indexOf("async function showShoutoutLanding()"), app.indexOf("function normalizeTemplateQuery("));
  assert.doesNotMatch(fn, /showPage\("shoutoutLandingPage"\)/);
  assert.doesNotMatch(fn, /openCategory\("shoutout"\);/);
  assert.match(fn, /shoutout-search\.html|shoutoutHome/);
  assert.match(fn, /await selectLocationForShoutOut\(draft\.locationId\);\s*return;/);
  assert.match(app, /bind\("shoutoutBtnCard", showShoutoutLanding\)/);
  const index = read("index.html");
  assert.match(index, /id="shoutoutBtnCard"[^>]*href="\.\/shoutout-search\.html/);
  const landing = read("shoutout-search.html");
  assert.match(landing, /floqr-feature-landing\.js/);
  assert.match(landing, /data-floqr-chrome-icon="shoutOut"/);
  assert.doesNotMatch(landing, /product-parent-logo/);
  const shared = read("floqr-feature-landing.js");
  assert.match(shared, /NEARBY_TOP = 4/);
  assert.match(shared, /factsForFeature/);
  assert.match(shared, /FEATURES/);
});

test("ad splash FLOQR logo is unframed and FloqMedia contacts are not underlined", () => {
  const css = read("styles.css");
  assert.match(css, /#splashFloqrLogoWrap\{border:0;background:none;padding:0;min-height:0;border-radius:0\}/);
  assert.match(css, /\.splash-house-list a\{color:#fff;text-decoration:none\}/);
});

test("White/Black profile card is white with shiny black initials; dark chromes stay charcoal", () => {
  const css = read("styles.css");
  // Must not force charcoal onto whiteBlack (live regression).
  assert.doesNotMatch(
    css,
    /html\[data-floqr-chrome="whiteBlack"\] \.user-menu-btn,[\s\S]{0,200}background:linear-gradient\(145deg,#4a4a4a/
  );
  assert.match(css, /Never list whiteBlack here/);
  assert.match(css, /html\[data-floqr-chrome="whiteBlack"\] \.user-menu-btn/);
  assert.match(css, /background:#ffffff!important/);
  assert.match(css, /Shiny black initials/);
  assert.match(css, /html\[data-floqr-chrome="whiteBlack"\] \.user-initials/);
  assert.match(css, /-webkit-text-fill-color:#0a0a0a!important/);
  // Other chromes keep accent-tuned initials
  assert.match(css, /html\[data-floqr-chrome="blackTiffany"\] \.user-initials/);
  assert.match(css, /html\[data-floqr-chrome="traditional"\] \.user-initials/);
});

test("Profile & Settings and feature search titles match Appearance h2 size", () => {
  const root = read("styles.css");
  assert.match(root, /--floqr-page-title-size:var\(--floqr-title-size\)/);
  const admin = read("admin.css");
  assert.match(admin, /Profile & Settings title space = Appearance h2 size/);
  assert.match(admin, /\.admin-shell \.topbar h1\.floqr-page-title/);
  assert.match(admin, /white-space:nowrap/);
  assert.match(admin, /font-size:var\(--floqr-page-title-size/);
  assert.match(admin, /\.help-label-text\{[\s\S]*font-size:inherit!important/);
  const landing = read("floqr-feature-landing.css");
  assert.match(landing, /Feature search title schema/);
  assert.match(landing, /\.floqr-page-title/);
  assert.match(landing, /font-size: var\(--floqr-page-title-size/);
  const portal = read("patron-portal.html");
  assert.match(portal, /class="floqr-page-title-row"/);
  assert.match(portal, /class="floqr-page-title help-label"/);
  assert.match(portal, /data-i18n="portal\.title"/);
  assert.match(portal, /data-i18n="appearance\.pageTitle"/);
  assert.match(read("floqcast-search.html"), /class="floqr-page-title"/);
  assert.match(read("shoutout-search.html"), /class="floqr-page-title"/);
  assert.match(read("vip.html"), /class="floqr-page-title brand-mixed-case"/);
});
