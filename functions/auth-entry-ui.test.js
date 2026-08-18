"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readReleaseFile = relativePath => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("email sign-in matches the Facebook color and exposes a selected confirmation", () => {
  const html = readReleaseFile("index.html");
  const css = readReleaseFile("styles.css");
  const app = readReleaseFile("patron-app.js");

  assert.match(html, /id="showEmailOtpBtn"[^>]+aria-controls="emailOtpPanel"[^>]+aria-expanded="false"[^>]+aria-pressed="false"/);
  assert.match(css, /\.signin\.email\{background:#1877f2;color:#fff;border-color:#62eaff\}/);
  assert.match(css, /\.signin\.email\.email-selected/);
  assert.match(css, /\.signin\.email\.email-selected::before\{content:"✓"/);
  assert.match(app, /button\.classList\.toggle\("email-selected", willOpen\)/);
  assert.match(app, /button\.textContent = willOpen \? "Email sign-in selected" : "Continue with your own Email"/);
});

test("email verification explicitly prompts for the eight-character code", () => {
  const html = readReleaseFile("index.html");
  assert.match(html, /<label>Enter 8-character code\s*<input id="emailOtpCode" maxlength="8"/);
  assert.match(html, /id="emailOtpStatus"[^>]+aria-live="polite"/);
});

test("satellite pages inherit FLOQR session via FLOQRSessionShell", () => {
  const pages = [
    "staff-worksheet.html",
    "scheduling.html",
    "role-request.html",
    "commerce.html",
    "guest-list.html",
    "mingl-chat.html",
    "mingl-gist.html",
    "services.html",
    "promoter-admin.html",
    "pickup.html",
    "payment-return.html",
    "suprstr-search.html",
    "suprstar-preview.html"
  ];
  for (const file of pages) {
    const html = readReleaseFile(file);
    assert.match(html, /floqr-session-shell\.js/, `${file} must load floqr-session-shell.js`);
    assert.match(html, /data-floqr-auth-chrome/, `${file} must mark auth chrome`);
  }
  const apps = [
    "staff-worksheet.js",
    "scheduling-portal.js",
    "role-request-app.js",
    "commerce-app.js",
    "guest-list-app.js",
    "mingl-chat-app.js",
    "mingl-gist-app.js",
    "services-app.js",
    "promoter-admin-app.js",
    "pickup-app.js",
    "payment-return-app.js",
    "suprstr-search.js",
    "suprstar-preview.js"
  ];
  for (const file of apps) {
    const js = readReleaseFile(file);
    assert.match(js, /FLOQRSessionShell/, `${file} must bind FLOQRSessionShell`);
    assert.match(js, /popupBlocked/, `${file} must block iframe Google popups`);
  }
  const payment = readReleaseFile("payment-return-app.js");
  assert.doesNotMatch(payment, /if \(!user\)[\s\S]{0,240}signInWithPopup/);
  const preview = readReleaseFile("suprstar-preview.js");
  assert.doesNotMatch(preview, /if \(!user\)[\s\S]{0,280}signInWithPopup/);
});

test("main message typing preserves spaces instead of live-fitting on every keystroke", () => {
  const app = readReleaseFile("patron-app.js");
  const html = readReleaseFile("index.html");

  assert.match(app, /function clampMainTextWhileTyping/);
  assert.match(app, /Live typing must NOT run fitTemplateText/);
  assert.match(app, /clampMainTextWhileTyping\(event\.currentTarget\.value\)/);
  assert.match(app, /addEventListener\("blur"/);
  assert.doesNotMatch(
    app,
    /byId\("mainText"\)\?\.addEventListener\("input", event => \{ const fitted = fitTemplateText\(event\.currentTarget\.value, "main"\)/
  );
  assert.match(html, /patron-app\.js\?v=\d+\.\d+\.\d+/);
});

test("venue admin portal URLs stamp FLOQRNav current package, not a hardcoded 29.09 or page ?v=", () => {
  const vm = require("node:vm");
  const navSource = readReleaseFile("floqr-nav.js");
  assert.match(navSource, /const APP_V = "s3\.\d+\.\d+"/);
  assert.match(navSource, /adminPortalUrl/);
  assert.match(navSource, /Never copy the page's \?v=/);

  const entity = readReleaseFile("entity-management.js");
  assert.match(entity, /adminPortalUrl/);
  assert.doesNotMatch(entity, /masterAdminUrl[\s\S]{0,420}v=29\.09\./);

  const master = readReleaseFile("master-admin-app.js");
  assert.match(master, /FLOQRNav\?\.adminPortalUrl/);
  assert.doesNotMatch(master, /CURRENT_VERSION = "29\.09\./);

  const html = readReleaseFile("master-admin.html");
  assert.match(html, /floqr-nav\.js\?v=s3\.\d+\.\d+/);
  assert.match(html, /help-venue-links/);

  const sandbox = {
    window: {},
    location: { href: "https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.22" },
    URL,
    URLSearchParams
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(navSource, sandbox);
  const href = sandbox.FLOQRNav.adminPortalUrl("zebbies-garden-washington-dc");
  assert.match(href, /admin\.html/);
  assert.match(href, /location=zebbies-garden-washington-dc/);
  assert.match(href, /v=s3\.\d+\.\d+/);
  assert.doesNotMatch(href, /v=29\.09\.22/);
  assert.match(href, /from=master/);
});

test("SOS2FA request UI is channel-neutral and puts status below the request button", () => {
  const html = readReleaseFile("master-admin.html");
  const sendIdx = html.indexOf("id=\"sos2faSendBtn\"");
  const statusIdx = html.indexOf("id=\"sos2faStatus\"");
  const codeIdx = html.indexOf("id=\"sos2faCode\"");
  assert.ok(sendIdx > 0 && statusIdx > sendIdx, "status must sit below Request SOS2FA Code");
  assert.ok(codeIdx > statusIdx, "code field must sit below status");
  assert.match(html, />Request SOS2FA Code</);
  assert.doesNotMatch(html, /Request SOS2FA Code via SMS/);
  assert.match(html, />Enter SOS2FA Code:</);
  assert.doesNotMatch(html, /SOS2FA SMS code/);
  assert.match(html, /sos2fa-code-row/);
  assert.match(html, /help-sos2fa-entity-mgmt/);
  const css = readReleaseFile("admin.css");
  assert.match(css, /\.sos2fa-code-row\{display:flex/);
  const js = readReleaseFile("sos2fa.js");
  assert.match(js, /data\.notes \|\| data\.delivery/);
  assert.doesNotMatch(js, /Request SOS2FA Code via SMS/);
});

test("App language chrome keys cover portal tabs and language settings radios", () => {
  const i18n = readReleaseFile("floqr-i18n.js");
  ["lang.suggestionsOnly", "lang.approvalRequired", "lang.autoFixMinor", "nav.overview", "nav.myProfile", "lang.webappLanguage", "lang.languageSaved"].forEach(key => {
    assert.match(i18n, new RegExp(`"${key}"`));
  });
  const portal = readReleaseFile("patron-portal.html");
  assert.match(portal, /data-i18n="lang.suggestionsOnly"/);
  assert.match(portal, /data-i18n="nav.overview"/);
  assert.match(portal, /data-i18n="lang.webappLanguage"/);
  const index = readReleaseFile("index.html");
  assert.match(index, /data-i18n="cat.events"/);
  const admin = readReleaseFile("admin.html");
  assert.match(admin, /floqr-i18n\.js\?v=s3\./);
  assert.match(admin, /data-i18n="admin.dashboard"/);
});
