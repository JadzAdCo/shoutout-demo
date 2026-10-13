"use strict";

// Idle CTA board fit (s3.1.40): "Use ShoutOut @ {club}" is never truncated and every row uses one size.
// Design notes: .cursor/rules/design-notes-board-fit.mdc (F — idle CTA fit)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const fit = require("../floqr-board-fit.js");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

// Idle host (safe area) measured in headless Chrome on display.html at each board's native pixels.
const BOXES = {
  "led-64x32": [298, 100],
  "led-64x48": [313, 155],
  "led-96x48": [460, 155],
  xibo1080: [931, 444]
};
const VENUES = [
  "Club",
  "Zebbies Garden DC",
  "Heist Washington DC",
  "Aurelia (Demo Club)",
  "Zebbies Garden Washington DC Rooftop Lounge and Supper Club"
];
const CHAR_EM = 0.5;
const idleText = venue => `USE SHOUTOUT @ ${venue.toUpperCase()}`;
const words = text => text.split(/\s+/).filter(Boolean);

test("idle tokens keep '@' with SHOUTOUT and mark where the club name starts", () => {
  assert.deepEqual(fit.idleTokens("USE SHOUTOUT @ HEIST WASHINGTON DC"), {tokens: ["USE", "SHOUTOUT @", "HEIST", "WASHINGTON", "DC"], clubStart: 2});
  assert.deepEqual(fit.idleTokens("  USE   SHOUTOUT  "), {tokens: ["USE", "SHOUTOUT"], clubStart: -1});
  assert.deepEqual(fit.idleTokens(""), {tokens: [], clubStart: -1});
});

test("idle rows never drop or split a word for any venue at any board size", () => {
  for (const venue of VENUES) {
    for (const [size, [w, h]] of Object.entries(BOXES)) {
      const text = idleText(venue);
      const rows = fit.pickIdleRows(text, w, h);
      const label = `${venue} @ ${size} → ${JSON.stringify(rows)}`;
      assert.deepEqual(words(rows.join(" ")), words(text), `${label}: every word, in order`);
      assert.ok(rows.length >= 1 && rows.length <= fit.IDLE_MAX_ROWS, `${label}: row count`);
      assert.ok(rows.every(Boolean), `${label}: no empty rows`);
      assert.ok(rows.some(row => /(^| )SHOUTOUT @$/.test(row)), `${label}: '@' stays on the SHOUTOUT row and ends it`);
    }
  }
});

test("long venue names are shown in full on 64x32 (the old 30-character cap dropped them)", () => {
  const [w, h] = BOXES["led-64x32"];
  const heist = fit.pickIdleRows(idleText("Heist Washington DC"), w, h).join(" ");
  assert.match(heist, /HEIST WASHINGTON DC$/);
  assert.match(fit.pickIdleRows(idleText("Zebbies Garden DC"), w, h).join(" "), /ZEBBIES GARDEN DC$/);
  assert.match(fit.pickIdleRows(idleText("Aurelia (Demo Club)"), w, h).join(" "), /AURELIA \(DEMO CLUB\)$/);
});

test("on wide boards the club name on one row is on the shortlist the DOM fitter measures", () => {
  for (const [w, h] of [BOXES["led-64x32"], BOXES["led-96x48"]]) {
    const shortlist = fit.rankIdleRows(idleText("Zebbies Garden DC"), w, h, {limit: 4}).map(c => c.rows.join(" / "));
    assert.ok(shortlist.includes("USE SHOUTOUT @ / ZEBBIES GARDEN DC"), `${w}x${h}: ${JSON.stringify(shortlist)}`);
  }
  for (const [w, h] of Object.values(BOXES)) {
    const best = fit.pickIdleRows(idleText("Heist Washington DC"), w, h);
    assert.equal(best[0], "USE SHOUTOUT @", `club name starts a new row (${w}x${h}): ${JSON.stringify(best)}`);
  }
});

test("uniformFitPx: one size, every row fits the safe area, and one px more would not", () => {
  for (const venue of VENUES) {
    for (const [size, [w, h]] of Object.entries(BOXES)) {
      const rows = fit.pickIdleRows(idleText(venue), w, h);
      const ref = 100;
      const widths = rows.map(row => [...row].length * CHAR_EM * ref);
      const opts = {lineHeightEm: fit.IDLE_LINE_EM, safeX: 0, safeY: 0};
      const px = fit.uniformFitPx(widths, ref, w, h, opts);
      const fitsAt = size_ => widths.every(width => (width * size_) / ref <= w) && rows.length * fit.IDLE_LINE_EM * size_ <= h;
      assert.ok(fitsAt(px), `${venue} @ ${size}: ${px}px fits`);
      assert.ok(!fitsAt(px + 1), `${venue} @ ${size}: ${px}px is the largest size`);
    }
  }
  assert.equal(fit.uniformFitPx([920], 100, 1000, 1000), 100, "92% usable width with default safe margins");
  assert.equal(fit.uniformFitPx([], 100, 1000, 0, {minPx: 8}), 8, "degenerate box clamps to minPx");
});

/** Fake DOM where a run's width = glyphs × CHAR_EM × font px, height = .84 × font px (board CSS line-height). */
function fakeIdleHost(text, width, height) {
  const doc = {
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(), className: "", children: [], parentElement: null, _text: "",
        style: {props: {}, setProperty(name, value) { this.props[name] = String(value); }, removeProperty(name) { delete this.props[name]; }},
        get textContent() { return this.children.length ? this.children.map(c => c.textContent).join("") : this._text; },
        set textContent(value) { this._text = String(value); this.children = []; },
        appendChild(child) { child.parentElement = this; this.children.push(child); return child; },
        get firstChild() { return this.children[0] || null; },
        removeChild(child) { this.children = this.children.filter(c => c !== child); return child; },
        querySelector(selector) {
          return selector === ":scope > .board-fit-run" ? this.children.find(c => c.className === "board-fit-run") || null : null;
        }
      };
      Object.defineProperty(el, "offsetWidth", {get() { return Math.round([...el.textContent].length * CHAR_EM * fontPx(el)); }});
      Object.defineProperty(el, "offsetHeight", {get() { return Math.round(0.84 * fontPx(el)); }});
      return el;
    }
  };
  const fontPx = run => parseFloat(run.parentElement?.style.props["font-size"] || "40");
  const main = doc.createElement("div");
  const host = doc.createElement("span");
  host.ownerDocument = doc;
  host.clientWidth = width;
  host.clientHeight = height;
  const attrs = {"data-idle-text": text, "data-idle-fit": "1"};
  host.getAttribute = name => (name in attrs ? attrs[name] : null);
  host.setAttribute = (name, value) => { attrs[name] = String(value); };
  host.className = "classic-board-lines classic-board-lines-3";
  main.appendChild(host);
  ["USE", "SHOUTOUT @", "HEIST"].forEach(textRow => {
    const row = doc.createElement("b");
    const run = doc.createElement("span");
    run.className = "board-fit-run";
    run.textContent = textRow;
    row.appendChild(run);
    host.appendChild(row);
  });
  return {host, main, attrs};
}

test("fitIdleHost (DOM): rebuilds truncated rows, one font size on every row, all rows inside the safe area", () => {
  for (const venue of VENUES) {
    for (const [size, [w, h]] of Object.entries(BOXES)) {
      const text = idleText(venue);
      const {host, main, attrs} = fakeIdleHost(text, w, h);
      const px = fit.fitIdleHost(host);
      const label = `${venue} @ ${size}`;
      assert.ok(px > 0, `${label}: fitted`);
      const rows = host.children;
      assert.deepEqual(words(rows.map(r => r.textContent).join(" ")), words(text), `${label}: full text restored`);
      const sizes = new Set(rows.map(r => r.style.props["font-size"]));
      assert.deepEqual([...sizes], [`${px}px`], `${label}: equal font size across rows`);
      const cellH = h / rows.length;
      rows.forEach(row => {
        const run = row.children[0];
        assert.ok(run.offsetWidth <= w + 0.5, `${label}: "${row.textContent}" width ${run.offsetWidth} ≤ ${w}`);
        assert.ok(Math.max(run.offsetHeight, px * fit.IDLE_LINE_EM) <= cellH + 0.5, `${label}: "${row.textContent}" fits its row`);
      });
      assert.equal(attrs["data-idle-fit-px"], String(px));
      assert.equal(host.style.props["--board-lines"], String(rows.length));
      assert.equal(main.style.props["--board-lines"], String(rows.length), `${label}: ruled backdrop follows the row count`);
    }
  }
});

function loadDisplay() {
  const htmlWrites = [];
  const makeEl = key => {
    let html = "";
    const attrs = {};
    return {
      key, id: key, className: "", textContent: "", dataset: {},
      style: {setProperty() {}, removeProperty() {}, getPropertyValue() { return ""; }},
      classList: {add() {}, remove() {}, toggle() {}, contains() { return false; }},
      get innerHTML() { return html; },
      set innerHTML(value) { html = String(value); htmlWrites.push({key, html}); },
      setAttribute(name, value) { attrs[name] = String(value); }, getAttribute: name => attrs[name] ?? null, removeAttribute(name) { delete attrs[name]; },
      querySelector: () => makeEl(`${key}>q`), querySelectorAll: () => [],
      appendChild: child => child, insertBefore: child => child, remove() {}, replaceWith() {},
      addEventListener() {}, removeEventListener() {}, closest: () => null, focus() {},
      clientWidth: 0, clientHeight: 0, offsetHeight: 0, offsetWidth: 0, scrollWidth: 0, scrollHeight: 0, parentElement: null, firstChild: null, children: []
    };
  };
  const els = new Map();
  const get = key => { if (!els.has(key)) els.set(key, makeEl(key)); return els.get(key); };
  const noop = () => 0;
  const db = {
    enablePersistence: () => Promise.resolve(),
    collection: () => ({doc: () => ({get: async () => ({exists: false}), onSnapshot: noop}), get: async () => ({forEach() {}})})
  };
  const sandbox = {
    URL, URLSearchParams, console, Promise,
    location: {origin: "https://example.test", href: "https://example.test/display.html?location=zebbies-garden-washington-dc", pathname: "/display.html", hostname: "example.test", search: "?location=zebbies-garden-washington-dc"},
    navigator: {userAgent: "test", language: "en"},
    document: {getElementById: get, querySelector: get, querySelectorAll: () => [], createElement: tag => makeEl(`new-${tag}`), addEventListener() {}, body: get("body"), documentElement: get("html"), title: ""},
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop,
    firebaseConfig: {},
    firebase: {initializeApp() {}, firestore: () => db, app: () => ({functions: () => ({httpsCallable: () => async () => ({data: {}})})}), functions: {}}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ["floqr-temp-qa-showcase.js", "shared-data.js", "floqr-safe-render.js", "floqr-board-fit.js", "display-app.js"]
    .forEach(file => vm.runInContext(read(file), sandbox, {filename: file}));
  const mainHtml = () => [...htmlWrites].reverse().find(write => write.key === "displayMain")?.html || "";
  return {render: payload => sandbox.renderShoutOutDisplay(payload), mainHtml};
}

const rowTexts = html => [...html.matchAll(/<span class="board-fit-run">([^<]*)<\/span>/g)].map(m => m[1].replace(/&amp;/g, "&"));
const rowStyles = html => [...html.matchAll(/<b style="([^"]*)">/g)].map(m => m[1]);

test("display-app idle render bypasses the patron cap on every board size and styles every row alike", () => {
  for (const venue of VENUES) {
    for (const screenFormatId of ["led-64x32", "led-64x48", "led-96x48"]) {
      const {render, mainHtml} = loadDisplay();
      render({locationName: venue, mainText: `Use ShoutOut @ ${venue}`, subText: "", template: "blackwhite", status: "default", idleCta: true, screenFormatId});
      const html = mainHtml();
      const label = `${venue} ${screenFormatId}`;
      assert.match(html, /data-idle-fit="1"/, `${label}: idle host marked for uniform fit`);
      assert.deepEqual(words(rowTexts(html).join(" ")), words(idleText(venue)), `${label}: no word dropped`);
      assert.equal(new Set(rowStyles(html)).size, 1, `${label}: one style for all rows`);
      assert.match(html, new RegExp(`data-idle-text="${idleText(venue).replace(/[()]/g, "\\$&")}"`), `${label}: full text kept for refits`);
    }
  }
});

test("live patron ShoutOuts keep the 48-character classic cap and per-row sizing", () => {
  const {render, mainHtml} = loadDisplay();
  const long = "HAPPY BIRTHDAY TO MY GORGEOUS WIFE D FROM THE WHOLE CREW AT HEIST TONIGHT";
  render({mainText: long, template: "blackwhite", status: "approved", screenFormatId: "led-64x48", idleCta: false});
  const html = mainHtml();
  assert.doesNotMatch(html, /data-idle-fit/);
  const shown = rowTexts(html).join(" ");
  assert.ok([...shown].length <= 48, `capped: ${shown}`);
  assert.ok(long.startsWith(shown), "whole words from the start");
  assert.ok(/: isClassicBoard\r?\n\s+\? mainSource\.slice\(0, mainLimit \+ Math\.max\(0, Number\(textCaps\.lineCount \|\| 1\) - 1\)\)/.test(read("display-app.js")),
    "live classic boards still slice to the template cap");
});

test("display.css keeps idle rows inside the safe area and the ruled backdrop follows the row count", () => {
  const css = read("display.css");
  assert.ok(/\.classic-bw\.classic-bw-idle \.classic-board-lines\[data-idle-fit\]\{\s*width:92%!important;\s*height:88%!important;/.test(css), "idle host inset");
  assert.ok(css.includes("calc(100% / var(--board-lines,3) - 2px)"), "ruled backdrop uses --board-lines");
  assert.ok(read("floqr-board-fit.js").includes(".classic-board-lines:not([data-idle-fit]) > b"), "per-row fit skips idle hosts");
});
