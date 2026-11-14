"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function loadI18n() {
  const sandbox = {
    console,
    navigator: { languages: ["en"], language: "en" },
    localStorage: {
      getItem() { return "en"; },
      setItem() {},
      removeItem() {}
    },
    document: {
      readyState: "loading",
      documentElement: {
        lang: "en",
        dir: "ltr",
        setAttribute() {},
        getAttribute() { return null; }
      },
      body: { setAttribute() {} },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      addEventListener() {},
      getElementById() { return null; }
    },
    addEventListener() {},
    dispatchEvent() {},
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(root, "floqr-i18n.js"), "utf8"),
    sandbox,
    { filename: "floqr-i18n.js" }
  );
  return sandbox.FLOQRI18n;
}

test("t and tIn accept null or undefined vars without throwing (Save Profile policy reload)", () => {
  const i18n = loadI18n();
  assert.ok(i18n, "FLOQRI18n loaded");
  assert.doesNotThrow(() => i18n.t("inbox.policySystem", null));
  assert.doesNotThrow(() => i18n.t("inbox.policySystem", undefined));
  assert.doesNotThrow(() => i18n.tIn("en", "inbox.policyRoles", null));
  const text = i18n.t("inbox.policySystem", null);
  assert.equal(typeof text, "string");
  assert.ok(text.length > 0);
  assert.notEqual(text, "Cannot convert undefined or null to object");
});

test("t still interpolates object vars", () => {
  const i18n = loadI18n();
  const out = i18n.t("prompt.body", { lang: "Spanish", native: "Español" });
  assert.match(out, /Spanish/);
  assert.match(out, /Español/);
});

test("portal Save Profile reload uses null-safe i18n vars", () => {
  const portal = fs.readFileSync(path.join(root, "patron-portal-app.js"), "utf8");
  assert.match(portal, /FLOQRI18n\?\.t\?\.\(key,\s*vars \|\| \{\}\)/);
  assert.match(portal, /Profile saved; portal reload failed/);
  const i18n = fs.readFileSync(path.join(root, "floqr-i18n.js"), "utf8");
  assert.match(i18n, /function interpolationVars\(vars\)/);
});
