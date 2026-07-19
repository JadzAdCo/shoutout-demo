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
