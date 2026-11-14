"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

function loadChrome() {
  const store = {};
  const attrs = {};
  const localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };
  const document = {
    readyState: "complete",
    documentElement: {
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k] || ""; }
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    }
  }
  const listeners = {};
  const window = {
    document,
    localStorage,
    CustomEvent,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    dispatchEvent(ev) {
      (listeners[ev && ev.type] || []).forEach((fn) => fn(ev));
      return true;
    },
    FLOQRFeatureServices: { canAccess() { return true; } }
  };
  vm.runInNewContext(read("floqr-chrome-scheme.js"), {
    window,
    globalThis: window,
    document,
    localStorage,
    CustomEvent,
    Date,
    Number,
    String,
    Object,
    Math,
    console
  });
  return { api: window.FLOQRChromeScheme, store, attrs };
}

function loadNavAt(href) {
  const url = new URL(href);
  const history = { length: 5, backs: 0, back() { this.backs += 1; } };
  const document = {
    readyState: "complete",
    getElementById() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const window = {
    location: { href, pathname: url.pathname, hash: url.hash, origin: url.origin },
    URL,
    URLSearchParams,
    history,
    document,
    addEventListener() {}
  };
  vm.runInNewContext(read("floqr-nav.js"), {
    window,
    document,
    URL,
    URLSearchParams
  });
  return { nav: window.FLOQRNav, history, document, window };
}

function makeAnchor(hrefAbs) {
  const listeners = [];
  return {
    id: "floqrGlobalBack",
    href: hrefAbs,
    dataset: {},
    classList: { add() {}, remove() {} },
    textContent: "",
    setAttribute() {},
    removeAttribute() {},
    addEventListener(_type, fn) { listeners.push(fn); },
    fire() {
      const event = { preventDefaultCount: 0, preventDefault() { this.preventDefaultCount += 1; } };
      listeners.forEach((fn) => fn(event));
      return event;
    }
  };
}

test("fresh Site chrome picker is not overwritten by a stale cached profile", () => {
  const { api, attrs } = loadChrome();
  api.setSiteChrome(1, { persistProfile: false });
  assert.equal(attrs["data-floqr-chrome"], "traditional");
  api.hydrateFromProfile({ isSiteChrome: 0 });
  assert.equal(attrs["data-floqr-chrome"], "traditional");
});

test("a newer profile timestamp still wins over localStorage (other device)", () => {
  const { api, attrs } = loadChrome();
  api.setSiteChrome(1, { persistProfile: false });
  api.hydrateFromProfile({
    isSiteChrome: 3,
    uiChromeUpdatedAt: { toMillis: () => Date.now() + 60_000 }
  });
  assert.equal(attrs["data-floqr-chrome"], "whiteBlack");
});

test("stale localStorage yields to profile when the picker write is older than 30 min", () => {
  const { api, store, attrs } = loadChrome();
  store["floqr.isSiteChrome"] = "1";
  store["floqr.uiChrome"] = "traditional";
  store["floqr.isSiteChromeAt"] = String(Date.now() - (31 * 60 * 1000));
  api.hydrateFromProfile({ isSiteChrome: 0 });
  assert.equal(attrs["data-floqr-chrome"], "nightlife");
});

test("Back from My Profile to Search follows href instead of history.back", () => {
  const { nav, history } = loadNavAt("https://x/shoutout-demo/patron-portal.html?tab=appearance");
  const anchor = makeAnchor("https://x/shoutout-demo/?start=search");
  nav.applyGlobalBack(anchor);
  const event = anchor.fire();
  assert.equal(event.preventDefaultCount, 0);
  assert.equal(history.backs, 0);
});

test("same-document Back on Search still uses history.back", () => {
  const { nav, history } = loadNavAt("https://x/shoutout-demo/index.html?start=search");
  const anchor = makeAnchor("https://x/shoutout-demo/index.html?start=search");
  nav.applyGlobalBack(anchor);
  const event = anchor.fire();
  assert.equal(event.preventDefaultCount, 1);
  assert.equal(history.backs, 1);
});

test("Search/login force-repaint chrome from localStorage; logout does not no-op-reload index", () => {
  const app = read("patron-app.js");
  assert.match(app, /id === "landingPage" \|\| id === "categoryPage"/);
  assert.match(app, /syncFromStorage\?\.\(\{force: true\}\)/);
  assert.match(app, /const onSearch = !file \|\| file === "index\.html"/);
  const chrome = read("floqr-chrome-scheme.js");
  assert.match(chrome, /STORAGE_AT_KEY/);
  assert.match(chrome, /ev\.persisted/);
  const nav = read("floqr-nav.js");
  assert.match(nav, /sameDocumentBackHref/);
  assert.match(nav, /bfcache with the previous Site chrome/);
});
