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
  assert.equal(tools.isFriendContextQuery("James on Mingl"), false, "bare Mingl is not friend context");
  assert.equal(tools.friendNameFromQuery("what do you know about my friend James"), "james");
  assert.equal(tools.friendNameFromQuery("my buddy Erny"), "erny");
  assert.equal(tools.friendNameFromQuery("my friend, James"), "james");
  assert.equal(tools.friendNameFromQuery("my friends"), "");
  assert.equal(tools.friendNameFromQuery("my friend from the club"), "");
});

test("friend lookup requires a name match — no social-graph dump", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(src, /friendNameFromQuery/);
  assert.match(src, /Require a real name\/handle match/);
  assert.doesNotMatch(src, /points >= 6 \|\| friendContext/);
  assert.match(src, /base < 8\) return/);
  assert.match(src, /never fall back to leftover verbs/);
  assert.doesNotMatch(src, /cleanedNeedle/);
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

const SAMPLE_PUBLIC = {
  publicProfileVisibility: "public",
  displayName: "Don Papi",
  floqrHandle: "DonBans",
  instagramHandle: "the_don_4ld",
  publicBio: "Just a Don",
  city: "Washington",
  country: "United States",
  musicInterests: ["Afro House", "Amapiano"],
  travelInterests: ["Lisbon", "Lagos"],
  foodChoices: ["Jollof", "oysters"],
  hobbies: ["cars"],
  favoriteBeverages: ["champagne"],
  nightlifeStyle: "VIP nights",
  lookingToMeet: "music lovers",
  photoURL: "https://example.com/don.jpg",
  email: "secret@example.com",
  phone: "+12025550123"
};

test("publicUserCard includes opted-in Mingl datapoints and never email/phone", () => {
  const card = tools.publicUserCard("uid1", SAMPLE_PUBLIC, 20);
  assert.equal(card.displayName, "Don Papi");
  assert.equal(card.handle, "@DonBans");
  assert.equal(card.instagramHandle, "@the_don_4ld");
  assert.deepEqual(card.music, ["Afro House", "Amapiano"]);
  assert.deepEqual(card.travel, ["Lisbon", "Lagos"]);
  assert.deepEqual(card.food, ["Jollof", "oysters"]);
  assert.deepEqual(card.hobbies, ["cars"]);
  assert.deepEqual(card.beverages, ["champagne"]);
  assert.equal(card.lookingToMeet, "music lovers");
  assert.equal(card.city, "Washington");
  assert.ok(card.imageUrls.includes("https://example.com/don.jpg"));
  assert.equal(card.email, undefined);
  assert.equal(card.phone, undefined);
});

test("publicUserCard omits datapoints the patron opted out of", () => {
  const card = tools.publicUserCard("uid1", {
    ...SAMPLE_PUBLIC,
    publicMinglDatapoints: ["location", "media"]
  }, 10);
  assert.equal(card.city, "Washington");
  assert.equal(card.music, undefined);
  assert.equal(card.food, undefined);
  assert.equal(card.travel, undefined);
  assert.ok(card.imageUrls.length);
});

test("userHaystack matches Mingl public interests so BOT DEE can find by food/music/travel", () => {
  const hay = tools.userHaystack(SAMPLE_PUBLIC).toLowerCase();
  assert.match(hay, /afro house/);
  assert.match(hay, /jollof/);
  assert.match(hay, /lisbon/);
  const optedOut = tools.userHaystack({...SAMPLE_PUBLIC, publicMinglDatapoints: ["location"]});
  assert.doesNotMatch(optedOut.toLowerCase(), /jollof/);
  assert.match(optedOut, /Washington/);
});

test("isSelfQuery recognizes my public profile and the viewer's handle/name", () => {
  assert.equal(tools.isSelfQuery("my floqr public profile music food travel", SAMPLE_PUBLIC), true);
  assert.equal(tools.isSelfQuery("what can people see on my public profile", SAMPLE_PUBLIC), true);
  assert.equal(tools.isSelfQuery("what are my food preferences", SAMPLE_PUBLIC), true);
  assert.equal(tools.isSelfQuery("donbans", SAMPLE_PUBLIC), true);
  assert.equal(tools.isSelfQuery("@DonBans", SAMPLE_PUBLIC), true);
  assert.equal(tools.isSelfQuery("don papi", SAMPLE_PUBLIC), true);
  assert.equal(tools.isSelfQuery("aurelia shoutout", SAMPLE_PUBLIC), false);
  assert.equal(tools.isSelfQuery("my music at aurelia", SAMPLE_PUBLIC), false);
  assert.equal(tools.isSelfQuery("food and travel at decades", SAMPLE_PUBLIC), false);
  assert.equal(tools.isSelfQuery("notdonbans", SAMPLE_PUBLIC), false);
});

test("injectSelfProfile does not send Mingl datapoints from a non-public self profile", () => {
  const privateSelf = {
    ...SAMPLE_PUBLIC,
    publicProfileVisibility: "followers"
  };
  const unpublished = tools.selfProfileCard("uid1", privateSelf, 48);
  assert.equal(unpublished.published, false);
  assert.equal(unpublished.food, undefined);
  assert.equal(unpublished.music, undefined);
  assert.equal(unpublished.travel, undefined);
  assert.equal(unpublished.city, undefined);
  assert.match(unpublished.note, /not public/i);

  const publicCard = tools.selfProfileCard("uid1", SAMPLE_PUBLIC, 48);
  assert.equal(publicCard.published, true);
  assert.deepEqual(publicCard.food, ["Jollof", "oysters"]);

  const scored = tools.injectSelfProfile([], "uid1", privateSelf, true);
  assert.equal(scored.length, 1);
  assert.equal(scored[0].food, undefined);
  assert.equal(tools.injectSelfProfile([{id: "uid1"}], "uid1", SAMPLE_PUBLIC, true).length, 1);
  assert.equal(tools.injectSelfProfile([], "uid1", SAMPLE_PUBLIC, false).length, 0);
});
