"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadSharedData() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(read("shared-data.js"), sandbox, { filename: "shared-data.js" });
  return sandbox;
}

function loadExclusiveMatcher() {
  const app = read("patron-app.js");
  const start = app.indexOf("function normalizeTemplateQuery(");
  const end = app.indexOf("async function startTemplateShoutout(");
  assert.ok(start > 0 && end > start, "template query helpers exist");
  const sandbox = loadSharedData();
  vm.runInNewContext(`${app.slice(start, end)}\nwindow.match = exclusiveTemplateForQuery;`, sandbox);
  return sandbox.match;
}

test("venue-only templates are searchable by name and alias", () => {
  const { SHOUTOUT_TEMPLATES: t } = loadSharedData();
  assert.equal(t.zebbiesFootballTeamIntro.name, "Zebbies All-Stars Football Intro");
  assert.ok(t.zebbiesFootballTeamIntro.searchAliases.includes("football intro"));
  assert.ok(t.zebbiesFootballTeamIntro.searchAliases.includes("zebbies all star"));
  assert.ok(t.heistVaultDollars.searchAliases.includes("tengo mucho dolares"));
  const match = loadExclusiveMatcher();
  assert.equal(match("Zebbies All Star")?.id, "zebbiesFootballTeamIntro");
  assert.equal(match("football intro please")?.id, "zebbiesFootballTeamIntro");
  assert.equal(match("Tengo mucho dólares")?.id, "heistVaultDollars");
  assert.equal(match("clubs in Monaco"), null);
});

test("picker shows an Exclusive at {venue} section and Search routes template names", () => {
  const app = read("patron-app.js");
  assert.match(app, /template-section-exclusive/);
  assert.match(app, /tt\("template\.venueExclusive"/);
  assert.match(app, /window\.startTemplateShoutout = startTemplateShoutout/);
  assert.match(app, /exclusiveTemplateForQuery\(q\)/);
  const intents = read("intent-search.js");
  assert.match(intents, /id: "football-intro"[\s\S]*?templateId: "zebbiesFootballTeamIntro"/);
  assert.match(intents, /id: "tengo-muchos-dolares"[\s\S]*?templateId: "heistVaultDollars"/);
});

test("Tengo muchos dólares: calm start, vault blast at 40s, full flood, then smaller splash under the text", () => {
  const { SHOUTOUT_TEMPLATES: t } = loadSharedData();
  assert.equal(t.heistVaultDollars.moneyRain, true);
  assert.equal(t.heistVaultDollars.moneyRainDelaySeconds, 40);
  const display = read("display-app.js");
  assert.match(display, /const MONEY_RAIN_DELAY_SECONDS = 40;/);
  assert.match(display, /layer\.classList\.add\("is-blast", "is-flood"\)/);
  assert.match(display, /layer\.classList\.add\("is-stream"\)/);
  assert.match(display, /const MONEY_FLOOD_COLS = 8;/);
  assert.match(display, /const MONEY_FLOOD_ROWS = 6;/);
  assert.match(display, /const key = livePlaybackKey\(data\);/);
  assert.match(display, /function purgeDisplaySurface\(\) \{[\s\S]*?stopMoneyRain\(\);/);
  const css = read("display.css");
  assert.match(css, /\.money-rain\{position:absolute;inset:0;z-index:1;/);
  assert.match(css, /\.display-canvas\.money-rain-active \.display-text-overlay\{z-index:5\}/);
  assert.match(css, /\.money-rain\.is-blast \.money-blast,\.money-rain\.is-flood \.money-flood,\.money-rain\.is-stream \.money-stream\{display:block\}/);
  assert.match(css, /\.money-bill-flood\{--bw:25vw;/);
  assert.match(css, /@keyframes moneyDoorBlow/);
});

test("every club idles on Use ShoutOut @ {club} after a ShoutOut ends", () => {
  const display = read("display-app.js");
  assert.match(display, /return `Use ShoutOut @ \$\{clubName\}`;/);
  assert.match(display, /const isIdleDoc = !doc\.exists \|\| status === "default" \|\| payload\.idleCta/);
  const backend = read("functions/commerce-functions.js");
  assert.match(backend, /function idleLiveContentAfterExpiry\(/);
  assert.doesNotMatch(backend, /exports\.idleLiveContentAfterExpiry/);
  assert.doesNotMatch(backend, /keepHeist/);
  assert.match(backend, /template: "blackwhite",/);
  assert.match(backend, /mainText: `Use ShoutOut @ \$\{clubName\}`,/);
  assert.match(backend, /batch\.set\(doc\.ref, idleLiveContentAfterExpiry\(/);
  const admin = read("admin-app.js");
  assert.match(admin, /const defaultMain = `Use ShoutOut @ \$\{loc\.locationName \|\| locationId\}`;/);
  assert.match(admin, /const main = `Use ShoutOut @ \$\{loc\.locationName \|\| locationId\}`;/);
});
