"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const HELP_LANGS = ["de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"];
const SIZES = ["led-64x32", "led-64x48", "led-96x48"];

function loadSharedData() {
  const sandbox = {location: {origin: "https://example.test", href: "https://example.test/", pathname: "/"}};
  sandbox.window = sandbox;
  vm.runInNewContext(read("floqr-temp-qa-showcase.js"), sandbox, {filename: "floqr-temp-qa-showcase.js"});
  vm.runInNewContext(read("shared-data.js"), sandbox, {filename: "shared-data.js"});
  return sandbox;
}

function sliceBetween(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `marker ${start}`);
  const to = source.indexOf(end, from);
  assert.ok(to > from, `marker ${end}`);
  return source.slice(from, to);
}

function loadAdminFitter() {
  const source = sliceBetween(read("admin-app.js"), "function adminGraphemes", "// Patron-supplied render fields");
  const sandbox = {Intl};
  vm.runInNewContext(`${source}\nthis.fit = fitAdminShoutoutText;`, sandbox);
  return sandbox.fit;
}

test("Classic Halloween is a shared classic board at every size", () => {
  const sandbox = loadSharedData();
  const t = sandbox.SHOUTOUT_TEMPLATES.classicHalloween;
  assert.ok(t, "SHOUTOUT_TEMPLATES.classicHalloween exists");
  assert.equal(t.id, "classicHalloween");
  assert.equal(t.name, "Classic Halloween");
  assert.equal(t.scope, "Shared");
  assert.equal(t.seasonal, true);
  assert.ok(!t.venueIds || t.venueIds.length === 0, "not venue-exclusive");
  assert.ok(sandbox.SHOUTOUT_STANDARD_TEMPLATE_IDS.includes("classicHalloween"), "standard template at every venue");
  assert.equal(t.Is96x48, 1);
  assert.equal(t.Is64x48, 1);
  assert.equal(t.Is64x32, 1);
  assert.deepEqual([...t.screenFormatIds].sort(), SIZES);
  assert.equal(sandbox.FLOQRTextLayout.profileId(t), "classicBoard");
  assert.equal(t.lineCount, 3);
  assert.equal(t.identityRail, true, "FloqR identity card kept");
  assert.equal(t.identityAnimation, "identity-loop");
  assert.equal(t.priceCents, 1500);
});

test("Classic Halloween fits every packaged venue that has a board", () => {
  const sandbox = loadSharedData();
  const sd = sandbox.FLOQRScreenDatapoints;
  const template = sd.applyTemplate({...sandbox.SHOUTOUT_TEMPLATES.classicHalloween});
  let checked = 0;
  Object.entries(sandbox.SHOUTOUT_CLUB_LOCATIONS).forEach(([id, raw]) => {
    const venue = sd.applyVenue(JSON.parse(JSON.stringify(raw)));
    const hasBoard = venue.VenueSupports96x48 === 1 || venue.VenueSupports64x48 === 1 || venue.VenueSupports64x32 === 1;
    if (!hasBoard) return;
    checked++;
    assert.equal(sd.templateFitsVenue(template, venue), true, `fits ${id}`);
  });
  assert.ok(checked > 0, "at least one packaged venue checked");
  const patron = read("patron-app.js");
  assert.match(patron, /filter\(id => String\(id\)\.startsWith\("soccer"\) \|\| getTemplate\(id\)\?\.seasonal === true\)/, "restricted venues still list seasonal templates");
});

test("blackwhite stays the untouched Traditional board", () => {
  const t = loadSharedData().SHOUTOUT_TEMPLATES.blackwhite;
  assert.notEqual(t.allowEmoji, true);
  assert.notEqual(t.halloweenFinale, true);
  assert.notEqual(t.seasonal, true);
  assert.doesNotMatch(String(t.className || ""), /halloween/);
});

test("emoji are whole glyphs on Classic Halloween; blackwhite keeps its UTF-16 cap", () => {
  const fit = loadAdminFitter();
  const caps = {main: 16, sub: 20, perLine: 16, lineCount: 1};
  const halloween = fit("HAPPY HALLOWEEN🎃👻", caps, "main", {allowEmoji: true});
  assert.equal(halloween, "HAPPY HALLOWEEN🎃", "emoji counts as one glyph and is never split");
  const blackwhite = fit("HAPPY HALLOWEEN🎃👻", caps, "main", {});
  assert.equal(blackwhite.length, 16, "blackwhite path unchanged (code-unit slice)");
  const three = fit("happy halloween 🎃👻 nyx", {main: 48, sub: 20, perLine: 16, lineCount: 3}, "main", {allowEmoji: true});
  assert.equal(three, "happy halloween\n🎃👻 nyx");

  const display = read("display-app.js");
  assert.match(display, /isClassicBoard && t\.allowEmoji === true\s*\? glyphSlice\(cleanDisplayText\(mainSource\)/, "display keeps emoji on emoji classic boards");
  assert.match(display, /: isClassicBoard\s*\? mainSource\.slice\(0, mainLimit/, "blackwhite display branch unchanged");
  const patron = read("patron-app.js");
  assert.match(patron, /template\?\.allowEmoji === true && window\.FLOQRTextLayout\?\.profileId\?\.\(template\) === "classicBoard"/);
  assert.match(patron, /if \(isEmojiClassicBoardTemplate\(t\)\) mainInput\.removeAttribute\("maxlength"\)/);
});

test("finale runs on FLOQRFrameLoop with no template timer", () => {
  const display = read("display-app.js");
  const block = sliceBetween(display, "const HALLOWEEN_FINALE_CYCLE", "function resetBackgroundLayer");
  assert.doesNotMatch(block, /setInterval|setTimeout|requestAnimationFrame/, "no per-template timers");
  assert.match(block, /loop\.cycle\(HALLOWEEN_FINALE_CYCLE, \{/);
  assert.match(block, /count: HALLOWEEN_BOARD_PHASES \+ 1/);
  assert.match(block, /stopCycle\?\.\(HALLOWEEN_FINALE_CYCLE\)/);
  assert.match(block, /class="hw-ghost"/);
  assert.match(block, /class="hw-reaper"/);
  assert.match(block, /class="hw-bat"/);
  assert.equal((block.match(/\{gx:/g) || []).length >= 4, true, "several ghosts");
  assert.match(display, /syncHalloweenFinale\(canvas, !isIdleCta && isClassicBoard && t\.halloweenFinale === true, data\)/);
  assert.match(display, /stopSplitMediaLoop\(\);\s*stopHalloweenFinale\(\);/, "floqCast idle clears the finale");
  assert.equal(loadSharedData().SHOUTOUT_TEMPLATES.classicHalloween.halloweenFinale, true);
});

test("finale CSS has a reduced-motion fallback and stays inside the canvas", () => {
  const css = read("display.css");
  assert.match(css, /\.halloween-finale\{position:absolute;inset:0;[^}]*pointer-events:none;overflow:hidden/);
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce){"));
  assert.match(reduced, /\.halloween-finale\.is-playing \*\{animation:none!important\}/);
  assert.match(reduced, /\.hw-bat\{display:none\}/);
  assert.match(css, /\.display-canvas\.classic-halloween\[data-screen-format-id="led-64x48"\] \.display-background\{background-image:url\("images\/halloween\/classic-halloween-4x3\.svg"\)/);
});

test("Halloween backgrounds are safe, small SVGs", () => {
  const t = loadSharedData().SHOUTOUT_TEMPLATES.classicHalloween;
  assert.equal(t.defaultBackgroundUrl, "./images/halloween/classic-halloween-2x1.svg");
  ["images/halloween/classic-halloween-2x1.svg", "images/halloween/classic-halloween-4x3.svg"].forEach(file => {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} in the repo`);
    const svg = read(file);
    assert.match(svg.trimStart(), /^(<\?xml[^>]*>\s*)?<svg\b/);
    assert.doesNotMatch(svg, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/, "no XML-invalid control characters (the board would show no background)");
    assert.doesNotMatch(svg, /<script|<foreignObject|\son[a-z]+=|xlink:href="http|href="http/i, "no script / handlers / external refs");
    assert.ok(Buffer.byteLength(svg) < 200 * 1024, "small for LED players");
  });
});

test("server price is 1500 cents whatever the client sends", () => {
  const {normalizeCheckoutPayload} = require("./commerce-functions.js").__checkoutHelpers;
  SIZES.forEach(screenFormatId => {
    const out = normalizeCheckoutPayload("shoutout", {shoutout: {template: "classicHalloween", screenFormatId, mainText: "happy halloween 🎃👻 nyx", priceCents: 1}});
    assert.equal(out.shoutout.priceCents, 1500, screenFormatId);
    assert.equal(out.shoutout.priceLabel, "$15");
    assert.equal(out.shoutout.textProfileId, "classicBoard");
    assert.match(out.shoutout.mainText, /🎃👻/, "emoji survive checkout");
  });
  const backend = read("functions/commerce-functions.js");
  assert.match(backend, /: classicHalloween\s*\? CLASSIC_HALLOWEEN_PRICE_CENTS/, "describeOrder charges the server price");
  assert.match(backend, /const CLASSIC_HALLOWEEN_PRICE_CENTS = 1500;/);
  const rules = read("firestore.rules");
  assert.match(rules, /request\.resource\.data\.template != 'classicHalloween'/, "no free direct create of the paid template");
});

test("Classic Halloween has patron help in every language and a FloqAi intent", () => {
  const repo = read("floqai-help-repository.js");
  assert.match(repo, /id: "help-classic-halloween",\s*title: "Classic Halloween",/);
  const helpPacks = read("floqr-i18n-help.js");
  const blocks = helpPacks.match(/"help-classic-halloween": \{\s*title: "Classic Halloween",\s*body: "[^"]+"/g) || [];
  assert.equal(blocks.length, HELP_LANGS.length, "help-classic-halloween in every non-English help pack");
  assert.ok(JSON.parse(read("scripts/_help-en.json"))["help-classic-halloween"], "canonical English help id");
  const intents = read("intent-search.js");
  assert.match(intents, /id: "classic-halloween",[\s\S]{0,400}action: "template",\s*templateId: "classicHalloween"/);
  assert.match(intents, /"classic-halloween": \["patron"\]/);
  const classes = JSON.parse(read("functions/floqai-content-classes.json"));
  assert.deepEqual(classes.help["help-classic-halloween"], ["patron"]);
  assert.deepEqual(classes.intents["classic-halloween"], ["patron"]);
  const chrome = read("floqr-i18n.js");
  assert.equal((chrome.match(/"template\.seasonalSection":/g) || []).length, 11, "Seasonal heading in all 11 chrome packs");
});
