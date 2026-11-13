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

test("isClubPublic rejects offboarded / unpublished clubs", () => {
  assert.equal(tools.isClubPublic({visibility: "public"}), true);
  assert.equal(tools.isClubPublic({visibility: "public", publicProfilePublished: true, publicVisible: true}), true);
  assert.equal(tools.isClubPublic({visibility: "public", offboarded: true}), false);
  assert.equal(tools.isClubPublic({visibility: "public", status: "offboarded"}), false);
  assert.equal(tools.isClubPublic({visibility: "public", publicProfilePublished: false}), false);
  assert.equal(tools.isClubPublic({visibility: "public", publicVisible: false}), false);
  assert.equal(tools.isClubPublic({visibility: "public", publicProfileEnabled: false}), false);
  assert.equal(tools.isClubPublic({visibility: "public", active: false}), false);
  assert.equal(tools.isClubPublic({visibility: "private"}), false);
});

test("self / friend profile query helpers", () => {
  assert.equal(tools.isSelfProfileQuery("me"), true);
  assert.equal(tools.isSelfProfileQuery("what do you know about me?"), true);
  assert.equal(tools.isSelfProfileQuery("tell me about myself"), true);
  assert.equal(tools.isSelfProfileQuery("James"), false);
  assert.equal(tools.isFriendContextQuery("what do you know about my friend James"), true);
  assert.equal(tools.isFriendContextQuery("my buddy Erny"), true);
  assert.equal(tools.isFriendContextQuery("Decades club"), false);
});

test("publicUserCard exposes public facts and relation without private keys", () => {
  const card = tools.publicUserCard("u1", {
    displayName: "Priya",
    floqrHandle: "priya",
    publicBio: "DJ nights",
    city: "DC",
    instagram: "@priya",
    email: "secret@example.com",
    phone: "+12025550100",
    approvedRoles: ["DJ"]
  }, 40, {relation: "self"});
  assert.equal(card.relation, "self");
  assert.equal(card.displayName, "Priya");
  assert.equal(card.handle, "@priya");
  assert.equal(card.instagram, "@priya");
  assert.equal(card.facts.displayName, "Priya");
  assert.equal(card.facts.instagram, "@priya");
  assert.equal(card.email, undefined);
  assert.equal(card.phone, undefined);
  assert.equal(card.facts.email, undefined);
});
