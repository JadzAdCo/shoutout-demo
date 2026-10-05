"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
const TYPED_LINE = "Tengo muchos dólares... I just did a heist!";

function load(file) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(read(file), sandbox, { filename: file });
  return sandbox;
}

const identity = {
  floqrHandleFromProfile: profile => profile.floqrHandle ? `@${String(profile.floqrHandle).replace(/^@/, "")}` : "",
  normalizeInstagramHandle: value => value ? `@${String(value).replace(/^@/, "")}` : ""
};

test("Tengo muchos dólares takes only a name and types the heist line", () => {
  const { SHOUTOUT_TEMPLATES: t } = load("shared-data.js");
  ["heistVaultDollars", "heistRedLux"].forEach(id => {
    assert.equal(t[id].nameOnly, true, `${id} is name-only`);
    assert.equal(t[id].maxNameCharacters, 14);
    assert.equal(t[id].typedLine, TYPED_LINE);
  });
  assert.equal(t.heistVaultNight.nameOnly, undefined, "other Heist templates keep free text");
});

test("name suggestions put the patron's own handles first and fold accents and @", () => {
  const { FLOQRNameShoutout: n } = load("floqr-name-shoutout.js");
  const profile = { displayName: "Don Papi", floqrHandle: "the_don_4ld", instagramHandle: "donpapi" };
  const pool = [
    { displayName: "Alé Martínez", floqrHandle: "ale", instagramHandle: "ale.mtz" },
    { displayName: "Dani", floqrHandle: "the_don_4ld" },
    ...Array.from({ length: 12 }, (_, i) => ({ displayName: `Guest ${i}`, instagramHandle: `guest${i}` }))
  ];
  const all = n.suggestions("", { profile, pool, identity });
  assert.deepEqual(plain(all.slice(0, 3).map(row => row.kind)), ["ownMingl", "ownInstagram", "ownName"]);
  assert.equal(all.length, 8, "capped at 8");
  assert.equal(all.filter(row => row.value === "@the_don_4ld").length, 1, "duplicates removed");
  assert.deepEqual(plain(n.suggestions("@ale", { profile, pool, identity }).map(row => row.value)), ["@ale", "@ale.mtz"]);
  assert.deepEqual(plain(n.suggestions("martinez", { profile, pool, identity }).map(row => row.value)), ["@ale", "@ale.mtz"]);
  assert.equal(n.suggestions("guest1", { profile, pool, identity })[0].value, "@guest1", "starts-with ranks first");
  assert.equal(n.capName("Alexandria-Rose Smith", 14), "Alexandria-Ros");
  assert.equal(n.isNameOnly({ nameOnly: true }), true);
  assert.equal(n.maxName({}), 14);
});

test("composer shows one name field with autocomplete for name-only templates", () => {
  const html = read("index.html");
  assert.match(html, /id="nameShoutoutInput"[^>]*role="combobox"/);
  assert.match(html, /id="nameShoutoutSuggestions" class="name-shoutout-suggestions hidden" role="listbox"/);
  assert.ok(html.indexOf("floqr-name-shoutout.js") < html.indexOf("patron-app.js"), "module loads before patron-app");
  const app = read("patron-app.js");
  assert.match(app, /if \(syncNameShoutoutFields\(\)\) return;/);
  assert.match(app, /profile\.publicProfileVisibility === "public"/);
  assert.match(app, /isNameOnlyTemplate\(\) && !String\(byId\("mainText"\)\?\.value \|\| ""\)\.trim\(\)/);
});

test("board shows the name, then types the heist line one letter at a time over novelty bills", () => {
  const display = read("display-app.js");
  assert.match(display, /function typedLineBoardHtml\(name, line\)/);
  assert.match(display, /if \(t\.nameOnly === true && t\.typedLine && !isIdleCta\)/);
  const startMs = Number(display.match(/const TYPED_LINE_START_MS = (\d+);/)[1]);
  const charMs = Number(display.match(/const TYPED_LINE_CHAR_MS = (\d+);/)[1]);
  const lineGlyphs = Array.from(TYPED_LINE).length;
  assert.ok(startMs + (lineGlyphs - 1) * charMs <= 5000, "line finishes typing inside the 5s words window");
  const start = display.slice(display.indexOf("function startTypedLine"), display.indexOf("function typedLineBoardHtml"));
  assert.match(start, /setInterval|setTimeout/);
  const css = read("display.css");
  assert.match(css, /\.typed-line-name\{[^}]*font-size:min\(19\.55vh,calc\(138vw \/ var\(--name-glyphs,8\)\)\)/, "name +15%");
  assert.match(css, /\.typed-line\{[^}]*font-size:min\(12\.08vh,6\.44vw\)/, "typed line +15%");
  assert.match(css, /\.typed-line-board\{[^}]*transform:translateY\(-6vh\)/, "name and line sit higher");
  assert.match(css, /images\/heist\/heist-novelty-100-trump\.jpg/);
  assert.match(css, /\.typed-line-caret/);
  assert.ok(fs.statSync(path.join(root, "images/heist/heist-novelty-100-trump.jpg")).size < 300000, "bill art stays small");
});

test("Heist closing slide: HEIST logo over WASHINGTON DC, both centered, no HEIST DC wording", () => {
  for (const page of ["display.html", "display2.html"]) {
    const html = read(page);
    assert.match(html, /<strong id="heistBrandName" class="heist-brand-name">WASHINGTON DC<\/strong>/, page);
    assert.doesNotMatch(html, />HEIST DC</, `${page} no HEIST DC word next to the logo`);
  }
  const display = read("display-app.js");
  assert.match(display, /const HEIST_BRAND_SLIDE_LABEL = "WASHINGTON DC";/);
  assert.match(display, /label\.textContent = heistBrandSlideLabel\(\)/);
  const phase = display.slice(display.indexOf("function scheduleHeistMessageThenBrandSlide"), display.indexOf("function renderHeistIdentityRail"));
  assert.match(phase, /primeHeistBrandSlide\(\);/, "logo loads during the message, before the slide opens");
  const { SHOUTOUT_CLUB_LOCATIONS: locs } = load("shared-data.js");
  assert.equal(locs["heist-washington-dc"].brandSlideLabel, "Washington DC");
  const css = read("display.css");
  assert.match(css, /\.heist-brand-slide\{[^}]*place-items:center/);
  assert.match(css, /\.heist-brand-slide-inner\{[^}]*flex-direction:column;[^}]*align-items:center;[^}]*justify-content:center/);
  assert.match(css, /\.heist-brand-name\{[^}]*text-transform:uppercase/);
});

test("Search box: two leading words find a template; plain queries list events and clubs", () => {
  const { FLOQRTemplateMatch: m } = load("shared-data.js");
  assert.equal(m.phraseMatches("Tendo Mucho", "tengo muchos dolares"), true);
  assert.equal(m.phraseMatches("tengo", "tengo muchos dolares"), false, "one word is not enough");
  assert.equal(m.phraseMatches("police car", "police car arrest"), false, "short second word needs the full name");
  assert.equal(m.phraseMatches("clubs in dc tonight", "tengo muchos dolares"), false);
  const app = read("patron-app.js");
  assert.match(app, /const type = parsed\?\.typeSource === "query" \? parsed\.type : "all";/);
  assert.match(app, /if \(type === "all"\) return renderAllGrid\(\);/);
  assert.match(app, /renderEventGrid\(grid\.querySelector\('\[data-listing-part="events"\]'\)\)/);
  assert.match(app, /renderLocationGrid\(grid\.querySelector\('\[data-listing-part="venues"\]'\)\)/);
  const intents = read("intent-search.js");
  assert.match(intents, /\/\\bte\[nd\]\[gd\]o\\s\+muchos\?\\b\//);
});
