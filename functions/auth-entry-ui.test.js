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
