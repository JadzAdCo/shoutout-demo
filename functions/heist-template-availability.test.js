"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const HEIST = "heist-washington-dc";
const HEIST_TEMPLATES = ["heistVaultNight", "heistPoliceCar", "heistInterrogation", "heistVaultDollars", "zebbiesFootballTeamIntro"];

function loadSharedData() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(read("shared-data.js"), sandbox, { filename: "shared-data.js" });
  return sandbox;
}

test("every Heist template is assigned to Heist and fits its boards", () => {
  const sandbox = loadSharedData();
  const heist = sandbox.SHOUTOUT_CLUB_LOCATIONS[HEIST];
  const venue = sandbox.FLOQRScreenDatapoints.applyVenue(JSON.parse(JSON.stringify(heist)));
  HEIST_TEMPLATES.forEach(id => {
    const template = sandbox.SHOUTOUT_TEMPLATES[id];
    assert.ok(heist.templates.includes(id), `${id} assigned to Heist`);
    assert.ok(template.venueIds.includes(HEIST), `${id} lists Heist in venueIds`);
    assert.equal(String(template.status || "active"), "active");
    assert.equal(sandbox.FLOQRScreenDatapoints.templateFitsVenue(sandbox.FLOQRScreenDatapoints.applyTemplate({ ...template }), venue), true, `${id} fits Heist`);
  });
  const seed = read("functions/scripts/onboard-dc-venues.js");
  assert.match(seed, /templates: \["heistVaultNight", "heistPoliceCar", "heistInterrogation", "heistVaultDollars", "zebbiesFootballTeamIntro"\]/);
});

test("template names match despite accents, a missing plural s, or one typo", () => {
  const { FLOQRTemplateMatch: m, SHOUTOUT_TEMPLATES: t } = loadSharedData();
  assert.equal(m.phraseMatches("Tendo mucho dolares", "tengo muchos dolares"), true);
  assert.equal(m.phraseMatches("TENGO MUCHOS DÓLARES", "tengo muchos dolares"), true);
  assert.equal(m.phraseMatches("looked up clubs", "locked up"), false, "single-word names need an exact word");
  assert.equal(m.phraseMatches("clubs in monaco", "tengo muchos dolares"), false);
  assert.equal(m.textMatches("tendo mucho dolares", m.templateText(t.heistVaultDollars)), true);
  assert.equal(m.textMatches("tengo mucho dolares", m.templateText(t.heistVaultNight)), false);
});

test("Club Admin repository lists one card per template, Heist exclusives first, with forgiving search", () => {
  const admin = read("admin-app.js");
  assert.match(admin, /function templateMatchesQuery\(template, query\)/);
  assert.match(admin, /window\.FLOQRTemplateMatch\.textMatches\(query, text\)/);
  assert.match(admin, /const byTemplateId = new Map\(\);/);
  assert.match(admin, /const rank = template => isExclusive\(template\) \? 0 : assignedIds\.has\(template\.id\) \? 1 : 2;/);
  assert.match(admin, /template-exclusive-tag/);
  assert.match(admin, /FLOQRI18n\.t\("template\.venueExclusive", \{venue\}\)/);
  assert.match(read("admin.html"), /data-floqr-help-id="help-club-template-repository"/);
});

test("patron Search and FloqAi route a misspelled Tengo muchos dólares to the Heist template", () => {
  const app = read("patron-app.js");
  assert.match(app, /matcher \? matcher\.phraseMatches\(q, phrase\) : q\.includes\(phrase\)/);
  assert.match(app, /\(t\.searchAliases \|\| \[\]\)\.join\(" "\)/);
  const intents = read("intent-search.js");
  const block = intents.slice(intents.indexOf('id: "tengo-muchos-dolares"'), intents.indexOf('id: "suprstr"'));
  const patternLine = block.slice(block.indexOf("patterns: ["));
  const patterns = Array.from(patternLine.slice(0, patternLine.indexOf("\n")).matchAll(/\/((?:[^/\\]|\\.)+)\//g)).map(m => new RegExp(m[1]));
  assert.ok(patterns.some(re => re.test("tendo mucho dolares")), "FloqAi intent tolerates 'tendo mucho dolares'");
});
