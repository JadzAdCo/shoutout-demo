"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

function loadBusy(opts = {}) {
  const timers = [];
  let resolveAsk;
  const win = {
    document: {
      documentElement: { dataset: {} },
      readyState: "complete",
      addEventListener(type, fn) { this._click = this._click || {}; this._click[type] = fn; },
      listeners() { return this._click || {}; }
    },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {},
    setInterval(fn) { fn(); return 1; },
    clearInterval() {},
    FLOQRI18n: { t(key) { return { "app.saveBusy": "Saving…", "app.saveReceived": "Command received…" }[key] || key; } }
  };
  if (opts.withReason) {
    win.FLOQRReasonPrompt = {
      ask() { return new Promise(resolve => { resolveAsk = resolve; }); }
    };
  }
  win.window = win;
  win.globalThis = win;
  vm.runInNewContext(read("floqr-save-busy.js"), win);
  return { win, timers, resolveAsk: value => resolveAsk && resolveAsk(value) };
}

function button(overrides = {}) {
  const el = {
    nodeType: 1,
    tagName: "BUTTON",
    id: "profileSave",
    className: "primary",
    textContent: "Save",
    disabled: false,
    dataset: {},
    attrs: {},
    classList: {
      _s: new Set(),
      add(...names) { names.forEach(name => this._s.add(name)); },
      remove(...names) { names.forEach(name => this._s.delete(name)); },
      contains(name) { return this._s.has(name); }
    },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) || name in overrides; },
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    closest() { return null; },
    ...overrides
  };
  return el;
}

test("Save buttons gray immediately and switch to Command received when a callable starts", () => {
  const { win } = loadBusy();
  const api = win.FLOQRSaveBusy;
  const btn = button();
  assert.equal(api.isSaveButton(btn), true);
  assert.equal(api.isSaveButton(button({ textContent: "Search", id: "go" })), false);
  api.begin(btn);
  assert.equal(btn.classList.contains("is-busy"), true);
  assert.equal(btn.textContent, "Saving…");
  assert.equal(btn.getAttribute("aria-busy"), "true");
  api.markReceived();
  assert.equal(btn.textContent, "Command received…");
  assert.equal(btn.classList.contains("is-save-received"), true);
  api.end();
  assert.equal(btn.classList.contains("is-busy"), false);
  assert.equal(btn.textContent, "Save");
});

test("Master Admin feature Save and beta tester Save are save buttons", () => {
  const { win } = loadBusy();
  const feature = button({
    id: "",
    textContent: "Save",
    hasAttribute(name) { return name === "data-feature-save"; },
    getAttribute(name) { return name === "data-feature-save" ? "mingl" : null; }
  });
  const beta = button({
    id: "",
    textContent: "Save",
    hasAttribute(name) { return name === "data-beta-features-save"; },
    getAttribute(name) { return name === "data-beta-features-save" ? "uid1" : null; }
  });
  assert.equal(win.FLOQRSaveBusy.isSaveButton(feature), true);
  assert.equal(win.FLOQRSaveBusy.isSaveButton(beta), true);
});

test("only the first save command is counted; later writes do not release busy early", () => {
  const { win } = loadBusy();
  const api = win.FLOQRSaveBusy;
  const btn = button();
  api.begin(btn);
  assert.equal(api.noteCommand(), true);
  assert.equal(btn.textContent, "Command received…");
  assert.equal(api.noteCommand(), false);
  assert.equal(btn.classList.contains("is-busy"), true);
  api.settleCommand();
  assert.equal(btn.classList.contains("is-busy"), false);
});

test("unrelated writes during a reason prompt do not release Save", async () => {
  const { win, resolveAsk } = loadBusy({ withReason: true });
  const api = win.FLOQRSaveBusy;
  const btn = button();
  api.begin(btn);
  const prompt = win.FLOQRReasonPrompt.ask({ summary: "Mingl flags", minLength: 8 });
  assert.equal(api.noteCommand(), false);
  assert.equal(btn.textContent, "Saving…");
  api.settleCommand();
  assert.equal(btn.classList.contains("is-busy"), true);
  resolveAsk("enabled mingl for lorna testers");
  assert.equal(await prompt, "enabled mingl for lorna testers");
  assert.equal(api.noteCommand(), true);
  assert.equal(btn.textContent, "Command received…");
  api.settleCommand();
  assert.equal(btn.classList.contains("is-busy"), false);
});

test("pages that load floqr-nav also load floqr-save-busy", () => {
  const html = read("master-admin.html");
  assert.match(html, /floqr-nav\.js\?v=s3\.\d+\.\d+/);
  assert.match(html, /floqr-save-busy\.js\?v=s3\.\d+\.\d+/);
  const navAt = html.indexOf("floqr-nav.js");
  const busyAt = html.indexOf("floqr-save-busy.js");
  assert.ok(busyAt > navAt);
  assert.match(read("admin.html"), /floqr-save-busy\.js/);
  assert.match(read("patron-portal.html"), /floqr-save-busy\.js/);
  assert.match(read("styles.css"), /button\.is-busy/);
  assert.match(read("admin.css"), /button\.is-busy/);
});
