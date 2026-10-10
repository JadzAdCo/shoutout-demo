"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");
const pkgVersion = `s${JSON.parse(read("functions/package.json")).version}`;

function matchOne(node, selector) {
  const m = selector.match(/^([a-z0-9]*)((?:\.[\w-]+)*)((?:\[[\w-]+\])*)$/i);
  if (!m) return false;
  if (m[1] && node.tagName !== m[1].toUpperCase()) return false;
  const classes = (m[2].match(/\.[\w-]+/g) || []).map((c) => c.slice(1));
  const attrs = (m[3].match(/\[[\w-]+\]/g) || []).map((a) => a.slice(1, -1));
  return classes.every((c) => node.classList.contains(c)) && attrs.every((a) => a in node.attrs);
}

class FakeEl {
  constructor(tag, {classes = [], attrs = {}, parent = null, headings = [], text = ""} = {}) {
    this.tagName = tag.toUpperCase();
    this.nodeType = 1;
    this.isConnected = true;
    this.id = "";
    this.dataset = {};
    this.attrs = {...attrs};
    this.parent = parent;
    this.headings = headings;
    this.children = [];
    this.textContent = text;
    this.innerHTML = text;
    this.removed = false;
    const set = new Set(classes);
    this.classList = {
      contains: (c) => set.has(c),
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      toggle: (c, on) => (on ? set.add(c) : set.delete(c))
    };
    Object.defineProperty(this, "className", {
      get: () => [...set].join(" "),
      set: (value) => { set.clear(); String(value).split(/\s+/).filter(Boolean).forEach((c) => set.add(c)); }
    });
  }
  matches(selector) { return selector.split(",").some((s) => matchOne(this, s.trim())); }
  closest(selector) {
    for (let node = this; node; node = node.parent) if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) { return /h1/.test(selector) ? this.headings : []; }
  querySelector(selector) {
    if (selector === "[data-floqr-session-portal-link]") {
      return this.children.find((c) => "data-floqr-session-portal-link" in c.attrs) || null;
    }
    return null;
  }
  contains(other) { return other === this; }
  compareDocumentPosition() { return 4; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  removeAttribute(key) { delete this.attrs[key]; }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  remove() { this.removed = true; }
}

function loadHelpModules() {
  const win = {
    Node: {ELEMENT_NODE: 1, DOCUMENT_POSITION_FOLLOWING: 4},
    location: {pathname: "/scheduling.html"},
    document: {addEventListener() {}, documentElement: {dataset: {}}},
    console
  };
  win.window = win;
  vm.runInNewContext(read("help-attach.js"), win);
  const attachCalls = [];
  const realBeside = win.FLOQRHelpAttach.attachBesideHeading;
  win.FLOQRHelpAttach = {
    attachBesideHeading(node, opts) {
      attachCalls.push(node);
      return realBeside(node, opts);
    }
  };
  vm.runInNewContext(read("helper-popouts.js"), win);
  return {win, attachCalls, realBeside};
}

function heroHeader() {
  const header = new FakeEl("header", {classes: ["topbar"]});
  const h1 = new FakeEl("h1", {parent: header, text: "FLOQR Scheduling"});
  header.headings = [h1];
  return {header, h1};
}

test("FLOQRHelpAttach.attachBesideHeading never puts a ? on a hero h1", () => {
  const {realBeside} = loadHelpModules();
  const {header, h1} = heroHeader();
  const para = new FakeEl("p", {classes: ["sub", "small"], parent: header, text: "Stories from ShoutOuts"});
  assert.equal(realBeside(para, {title: "About"}), null);
  assert.equal(h1.children.length, 0);
});

test("helper-popouts keeps hero-h1 paragraphs visible and never converts the session hint", () => {
  const {win, attachCalls} = loadHelpModules();
  const {header} = heroHeader();
  const chrome = new FakeEl("div", {parent: header, attrs: {"data-floqr-auth-chrome": ""}});
  const legacyHint = new FakeEl("p", {classes: ["sub", "small"], parent: chrome, attrs: {"data-floqr-session-portal-link": "1"}});
  const heroSub = new FakeEl("p", {classes: ["sub", "small"], parent: header});
  win.FLOQRHelperPopouts.convertAll({querySelectorAll: () => [legacyHint, heroSub]});

  assert.ok(!attachCalls.includes(legacyHint), "auth chrome hint is never offered to FLOQRHelpAttach");
  assert.equal(legacyHint.removed, false);
  assert.equal(heroSub.removed, false, "hero paragraph stays on the page");
  assert.equal(heroSub.dataset.keepVisible, "true");
});

function loadShell({lang} = {}) {
  const els = {
    "#chrome": new FakeEl("div", {attrs: {"data-floqr-auth-chrome": ""}}),
    "#status": new FakeEl("p", {classes: ["status"]})
  };
  const document = {
    readyState: "complete",
    addEventListener() {},
    querySelector: (selector) => els[selector] || null,
    createElement: (tag) => new FakeEl(tag),
    documentElement: {classList: {add() {}, remove() {}}},
    body: {classList: {add() {}}, hasAttribute: () => false}
  };
  const win = {
    document,
    location: {href: `https://x/scheduling.html?v=s3.1.26&embed=1&from=floqai`, pathname: "/scheduling.html", search: "?v=s3.1.26&embed=1&from=floqai", hash: ""},
    URL,
    URLSearchParams,
    setTimeout: () => 0,
    FLOQRNav: {appVersion: pkgVersion},
    FLOQRI18n: lang ? {t: (key) => (key.startsWith("session.") ? `[${lang}] ${key}` : key)} : undefined
  };
  win.window = win;
  win.self = win;
  win.top = win;
  vm.runInNewContext(read("floqr-session-shell.js"), win);
  return {shell: win.FLOQRSessionShell, els};
}

const signedOutAuth = {currentUser: null, authStateReady: () => Promise.resolve(), onAuthStateChanged() {}};

test("embedded signed-out hint is a plain status line with a version-free My Profile link", async () => {
  const {shell, els} = loadShell();
  await shell.bind({auth: signedOutAuth, chrome: "#chrome", statusEl: "#status"}).ready;
  const hint = els["#chrome"].children[0];
  assert.ok(hint, "hint rendered");
  assert.equal(hint.classList.contains("sub"), false, "not p.sub.small (helper-popouts would convert it)");
  assert.equal(hint.dataset.keepVisible, "true");
  const link = hint.children[0];
  assert.equal(link.textContent, "Open My Profile & Settings");
  assert.match(link.href, /patron-portal\.html\?from=session-shell$/);
  assert.doesNotMatch(link.href, /[?&]v=/);
  assert.match(els["#status"].textContent, /restoring that session here/);
});

test("session hint and status copy come from FLOQRI18n session.* keys", async () => {
  const {shell, els} = loadShell({lang: "fr"});
  await shell.bind({auth: signedOutAuth, chrome: "#chrome", statusEl: "#status"}).ready;
  assert.equal(els["#chrome"].children[0].children[0].textContent, "[fr] session.openMyProfile");
  assert.equal(els["#status"].textContent, "[fr] session.embedSignedOut");
});

test("session.* keys exist in every chrome pack", () => {
  const src = read("floqr-i18n.js");
  for (const key of ["embedSignedOut", "standaloneSignedOut", "restoring", "openMyProfile", "popupBlocked"]) {
    const hits = src.match(new RegExp(`"session\\.${key}":`, "g")) || [];
    assert.equal(hits.length, 11, `session.${key}`);
  }
});

test("no satellite ships the auth chrome hint as a hero p.sub.small", () => {
  const shell = read("floqr-session-shell.js");
  assert.doesNotMatch(shell, /className\s*=\s*["']sub small["']/);
  assert.match(read("helper-popouts.js"), /\[data-floqr-auth-chrome\], \[data-floqr-session-portal-link\]/);
});
