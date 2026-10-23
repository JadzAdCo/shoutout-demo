"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const exists = (f) => fs.existsSync(path.join(root, f));

test("chrome schemes include Purple & White + Black & Dark Green with brand logos", () => {
  const chrome = read("floqr-chrome-scheme.js");
  assert.match(chrome, /PURPLE_WHITE:\s*4/);
  assert.match(chrome, /BLACK_DARK_GREEN:\s*5/);
  assert.match(chrome, /purpleWhite/);
  assert.match(chrome, /BRAND_LOGOS/);
  assert.match(chrome, /floqr-hero-blacktiffany\.png/);
  assert.match(chrome, /floqr-hero-traditional\.png/);
  assert.match(chrome, /floqr-hero-purplewhite\.png/);
  assert.match(chrome, /floqr-hero-blackdarkgreen\.png/);
  assert.match(chrome, /floqr-hero-whiteblack\.png/);
  assert.match(chrome, /migrateLegacyChromeStorage/);
  assert.ok(exists("images/chrome/floqr-script/floqr-hero-blacktiffany.png"));
  assert.ok(exists("images/chrome/floqr-script/floqr-hero-traditional.png"));
  assert.ok(exists("images/chrome/floqr-script/floqr-hero-purplewhite.png"));
  assert.ok(exists("images/chrome/floqr-script/floqr-hero-blackdarkgreen.png"));
  const tiffany = fs.readFileSync(path.join(root, "images/chrome/floqr-script/floqr-hero-blacktiffany.png"));
  assert.ok(tiffany.length > 500);
  const css = read("styles.css");
  assert.match(css, /Purple & White \(isSiteChrome=4\)/);
  assert.match(css, /Black & Dark Green \(isSiteChrome=5\)/);
  assert.match(css, /html\[data-floqr-chrome="purpleWhite"\]\{/);
  assert.match(css, /html\[data-floqr-chrome="blackDarkGreen"\]\{[\s\S]*--accent:#2d8a5a/);
  const portal = read("patron-portal.html");
  assert.match(portal, /data-floqr-chrome-btn="purpleWhite"/);
  assert.match(portal, /Purple &amp; White|Purple & White/);
  const pass = read("pass.html");
  assert.match(pass, /floqr-chrome-scheme\.js/);
  assert.match(pass, /data-floqr-brand-logo/);
  const i18n = read("floqr-i18n.js");
  assert.equal((i18n.match(/"chrome\.purpleWhite": "Purple & White"/g) || []).length, 11);
  assert.equal((i18n.match(/"chrome\.purpleWhiteFull"/g) || []).length, 11);
});
