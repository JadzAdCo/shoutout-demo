"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const tools = require("./bot-dee-tools");

test("club name aliases map Aurelia → temp-democlub-1", () => {
  assert.equal(tools.CLUB_NAME_ALIASES.aurelia, "temp-democlub-1");
  assert.equal(tools.CLUB_NAME_ALIASES["aurelia demo club"], "temp-democlub-1");
  assert.equal(tools.CLUB_NAME_ALIASES.decades, "decades-washington-dc");
  assert.equal(tools.CLUB_NAME_ALIASES["lima twist"], "lima-twist-washington-dc");
});

test("normalizeClubNeedle strips punctuation for Aurelia", () => {
  assert.equal(tools.normalizeClubNeedle("Aurelia"), "aurelia");
  assert.equal(tools.normalizeClubNeedle("Aurelia (Demo Club)"), "aurelia demo club");
  assert.equal(tools.normalizeClubNeedle("LIMA Twist!!!"), "lima twist");
});

test("listShoutOutTemplates source resolves clubLocationId via requireClubLocationId", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(src, /async function resolveClubLocationId/);
  assert.match(src, /requireClubLocationId\(rawClub\)/);
  assert.match(src, /CLUB_NAME_ALIASES/);
  assert.match(src, /aurelia:\s*"temp-democlub-1"/);
});
