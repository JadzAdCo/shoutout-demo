"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = rel => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");
const LANGS = ["en", "de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"];

function loadI18n() {
  const store = new Map();
  const doc = {
    readyState: "complete",
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    documentElement: {getAttribute: () => null, setAttribute() {}},
    head: {appendChild() {}},
    body: null
  };
  const sandbox = {
    document: doc,
    navigator: {languages: ["en-US"], language: "en-US"},
    localStorage: {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v))},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent() {},
    console
  };
  sandbox.window = sandbox;
  vm.runInNewContext(read("floqr-i18n.js"), sandbox, {filename: "floqr-i18n.js"});
  return sandbox.FLOQRI18n;
}

function loadGradient() {
  const sandbox = {
    document: {readyState: "complete", getElementById: () => null, addEventListener() {}},
    addEventListener() {},
    getComputedStyle: () => ({marginTop: "10px", marginBottom: "10px"})
  };
  sandbox.window = sandbox;
  vm.runInNewContext(read("welcome-button-gradient.js"), sandbox, {filename: "welcome-button-gradient.js"});
  return sandbox.FLOQRWelcomeGradient;
}

test("SMS and WhatsApp region sits on its own second line in every language", () => {
  const i18n = loadI18n();
  for (const lang of LANGS) {
    for (const key of ["app.smsOtp", "app.whatsappOtp"]) {
      const main = i18n.tIn(lang, key);
      const region = i18n.tIn(lang, `${key}Region`);
      assert.doesNotMatch(main, /\(/, `${lang} ${key} main line has no region`);
      assert.match(region, /^\(.+\)$/, `${lang} ${key}Region is the parenthesised second line`);
    }
  }
  assert.equal(i18n.tIn("en", "app.smsOtpRegion"), "(US & Canada)");
  assert.equal(i18n.tIn("en", "app.whatsappOtpRegion"), "(Worldwide)");
  const css = read("styles.css");
  assert.match(css, /#loginActions > \.signin\.has-sub\{display:grid/);
  assert.match(css, /#loginActions > \.signin\.has-sub \.signin-label,#loginActions > \.signin\.has-sub \.signin-sub\{grid-column:2;display:block;white-space:nowrap/);
  const html = read("index.html");
  assert.match(html, /id="showSmsOtpBtn" class="signin sms has-sub"/);
  assert.match(html, /id="showWhatsAppOtpBtn" class="signin whatsapp has-sub"/);
});

test("Welcome buttons share one vertical gradient sliced per button", () => {
  const css = read("styles.css");
  assert.match(css, /#loginActions > \.signin,#loginActions > \.signin\.email\.email-selected\{background:linear-gradient\(180deg,var\(--floqr-tile-cyan\) 0%,var\(--floqr-tile-violet\) 52%,var\(--floqr-tile-magenta\) 100%\) 0 calc\(-1 \* var\(--stack-y,0px\)\) \/ 100% var\(--stack-h,100%\) no-repeat;background-origin:border-box\}/);
  const html = read("index.html");
  assert.match(html, /<script src="\.\/welcome-button-gradient\.js\?v=s3\.\d+\.\d+"><\/script>/);
  const api = loadGradient();
  assert.equal(typeof api.layout, "function");
  assert.equal(typeof api.schedule, "function");
});
