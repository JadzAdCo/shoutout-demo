"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = rel => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

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

test("tIn translates in a chosen language without switching the page", () => {
  const i18n = loadI18n();
  assert.equal(i18n.getLanguage(), "en");
  assert.equal(i18n.tIn("it", "app.save"), "Salva");
  assert.equal(i18n.tIn("en", "app.save"), "Save");
  assert.equal(i18n.tIn("ar", "app.save"), "حفظ");
  assert.equal(i18n.tIn("it", "lang.switchHint", {native: "Italiano"}), "Tocca Salva per impostare FloqR su Italiano.");
  assert.equal(i18n.tIn("en", "lang.switchHint", {native: "Italian"}), "Tap Save to switch FloqR to Italian.");
  assert.equal(i18n.tIn("xx", "app.save"), "Save");
  assert.equal(i18n.getLanguage(), "en");
});

test("every supported language has its own Save word and switch hint", () => {
  const i18n = loadI18n();
  i18n.SUPPORTED.forEach(({code}) => {
    assert.ok(i18n.STRINGS[code]["app.save"], `app.save missing for ${code}`);
    const hint = i18n.STRINGS[code]["lang.switchHint"];
    assert.ok(hint && hint.includes("{native}"), `lang.switchHint missing for ${code}`);
    if (code !== "en") assert.notEqual(hint, i18n.STRINGS.en["lang.switchHint"], `lang.switchHint untranslated for ${code}`);
  });
});

test("App language Save button shows the picked word with English in parentheses", () => {
  const html = read("patron-portal.html");
  const app = read("patron-portal-app.js");
  assert.match(html, /<button id="saveUiAppLanguageBtn" class="primary" type="button">Save<\/button>/);
  assert.match(html, /id="uiAppLanguagePreview" class="ui-lang-preview hidden" aria-live="polite"/);
  assert.match(html, /patron-portal-app\.js\?v=s3\.\d+\.\d+/);
  assert.match(app, /function renderUiLanguagePreview\(\)/);
  assert.match(app, /const bilingual = picked !== current && picked !== "en";/);
  assert.match(app, /btn\.append\(" \(", langSpan\(i18n, "en", englishSave\), "\)"\)/);
  assert.match(app, /byId\("uiAppLanguage"\)\?\.addEventListener\("change", renderUiLanguagePreview\)/);
  assert.match(read("styles.css"), /\.ui-lang-preview\{/);
});
