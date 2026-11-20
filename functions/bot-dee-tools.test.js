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
  assert.ok(card.sharedDatapoints.includes("food"));
  assert.deepEqual(card.datapoints.food, ["Jollof", "oysters"]);
  assert.equal(card.facts.city, undefined);
  assert.equal(card.facts.email, undefined);
});

test("publicUserCard passes every volunteered list value and treats empty opt-in as none", () => {
  const manyFoods = Array.from({length: 20}, (_, i) => `Dish ${i + 1}`);
  const full = tools.publicUserCard("uid1", {...SAMPLE_PUBLIC, foodChoices: manyFoods}, 10);
  assert.equal(full.datapoints.food.length, 20);
  assert.equal(full.food.length, 20);
  const none = tools.publicUserCard("uid1", {...SAMPLE_PUBLIC, publicMinglDatapoints: []}, 10);
  assert.deepEqual(none.sharedDatapoints, []);
  assert.equal(none.food, undefined);
  assert.equal(none.datapoints.food, undefined);
  assert.equal(none.city, undefined);
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

test("userHaystack still lists Mingl interests but people search does not use it", () => {
  const hay = tools.userHaystack(SAMPLE_PUBLIC).toLowerCase();
  assert.match(hay, /afro house/);
  assert.match(hay, /jollof/);
  assert.match(hay, /lisbon/);
  const optedOut = tools.userHaystack({...SAMPLE_PUBLIC, publicMinglDatapoints: ["location"]});
  assert.doesNotMatch(optedOut.toLowerCase(), /jollof/);
  assert.match(optedOut, /Washington/);
  const src = require("fs").readFileSync(require("path").join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(src, /People lookup: identity fields only/);
  assert.doesNotMatch(src, /scoreHay\(userHaystack\(data\)/);
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

const DON_ALIASES = {
  ...SAMPLE_PUBLIC,
  firstName: "Don",
  lastName: "Banyong",
  fullName: "Don Banyong",
  displayName: "Don Papi",
  floqrHandle: "DonBans"
};

test("people lookup matches first+last, display name, squeezed alias, and handle", () => {
  const aliases = tools.identityAliases(DON_ALIASES);
  assert.ok(aliases.includes("don banyong"));
  assert.ok(aliases.includes("don papi"));
  assert.ok(aliases.includes("donpapi"));
  assert.ok(aliases.includes("donbans"));
  assert.ok(aliases.includes("don"), "firstName is an identity alias");
  ["don banyong", "Don Papi", "DonPapi", "@DonBans", "DonBans"].forEach(needle => {
    assert.ok(tools.scoreIdentity(DON_ALIASES, needle, needle.toLowerCase().replace(/^@/, "").split(/\s+/)) >= 8, needle);
    assert.equal(tools.isSelfQuery(needle, DON_ALIASES), true, needle);
    assert.ok(tools.scorePerson(DON_ALIASES, tools.normalizeNeedle(needle), tools.normalizeNeedle(needle).split(/\s+/).filter(Boolean)) >= 8, needle);
  });
  assert.ok(tools.scoreIdentity(DON_ALIASES, "aurelia", ["aurelia"]) < 8);
  assert.equal(tools.isSelfQuery("don banyong", SAMPLE_PUBLIC), false, "display-only profile does not match legal name");
});

test("identity fold matches accented names and curly apostrophes", () => {
  const row = {
    firstName: "José",
    lastName: "O’Brien",
    displayName: "José O’Brien",
    fullName: "José O’Brien",
    floqrHandle: "joseob"
  };
  assert.ok(tools.scoreIdentity(row, "Jose O'Brien", ["jose", "obrien"]) >= 8);
  assert.ok(tools.scoreIdentity(row, "José", ["jose"]) >= 8);
  assert.equal(tools.normalizeNeedle("O’Brien"), "obrien");
  assert.equal(tools.normalizeNeedle("José"), "jose");
});

test("Who is Don / query Don matches identity keys only — not bio Don Julio", () => {
  const anna = {
    firstName: "Anna",
    lastName: "Feline",
    displayName: "Anna Feline",
    floqrHandle: "annafeline_",
    instagramHandle: "annafeline_",
    publicBio: "likes Don Julio",
    bio: "Anna Feline disfruta Afrobeat. likes Don Julio.",
    tagline: "Don Julio nights",
    favoriteBeverages: ["Don Julio"],
    musicInterests: ["Afrobeat"],
    headline: "I like Don"
  };
  const donQuery = tools.normalizeNeedle("Don");
  const donTokens = ["don"];
  assert.ok(tools.scorePerson(anna, donQuery, donTokens) < 8, "bio Don Julio must not match Don");
  assert.ok(tools.scoreIdentity(anna, "Who is Don", ["don"]) < 8);
  assert.ok(tools.scorePerson(anna, tools.normalizeNeedle("Who is Don"), ["who", "is", "don"]) < 8);

  const byFirst = {firstName: "Don", lastName: "Smith", displayName: "D Smith", publicBio: "hello"};
  assert.ok(tools.scorePerson(byFirst, donQuery, donTokens) >= 8, "firstName Don matches");

  const byHandle = {displayName: "Alex", floqrHandle: "don", publicBio: "nope"};
  assert.ok(tools.scorePerson(byHandle, donQuery, donTokens) >= 8, "handle @don matches");
  assert.ok(tools.scorePerson(byHandle, tools.normalizeNeedle("@don"), ["don"]) >= 8);

  const byDisplay = {firstName: "Alex", displayName: "Don", publicBio: "likes tequila"};
  assert.ok(tools.scorePerson(byDisplay, donQuery, donTokens) >= 8, "displayName Don matches");

  const byInstagram = {displayName: "Alex", instagram: "don", publicBio: "Don Julio fan"};
  assert.ok(tools.scorePerson(byInstagram, donQuery, donTokens) >= 8, "Instagram handle don matches");

  const underscoredDon = {displayName: "Alex", instagramHandle: "the_don_4ld", publicBio: "x"};
  assert.ok(tools.scorePerson(underscoredDon, donQuery, donTokens) < 8, "the_don_4ld is not identity Don");
});

test("signed-in Don searching Who is Don still lists other public Dons, not only self", () => {
  assert.equal(tools.isExclusiveSelfQuery("Who is Don"), false);
  assert.equal(tools.isExclusiveSelfQuery("Don"), false);
  assert.equal(tools.isExclusiveSelfQuery("who am I"), true);
  assert.equal(tools.isExclusiveSelfQuery("my public profile"), true);
  assert.equal(tools.isSelfQuery("Don", DON_ALIASES), true, "firstName Don is an identity self-hit");
  assert.equal(tools.isSelfQuery("Who is Don", DON_ALIASES), false);

  const otherDon = {
    publicProfileVisibility: "public",
    firstName: "Don",
    lastName: "Smith",
    displayName: "Don Smith",
    floqrHandle: "donsmith"
  };
  const anna = {
    publicProfileVisibility: "public",
    firstName: "Anna",
    lastName: "Feline",
    displayName: "Anna Feline",
    floqrHandle: "annafeline_",
    publicBio: "likes Don Julio"
  };
  const directory = [
    {id: "other-don", data: otherDon},
    {id: "anna-feline", data: anna}
  ];
  ["Who is Don", "Don"].forEach(query => {
    const hits = tools.rankPeopleIdentityHits({
      query,
      viewerUid: "viewer-don",
      viewerData: DON_ALIASES,
      directory
    });
    assert.equal(hits.exclusiveSelf, false, query);
    assert.ok(hits.ids.includes("viewer-don"), `${query} includes signed-in Don`);
    assert.ok(hits.ids.includes("other-don"), `${query} includes other public Don`);
    assert.ok(!hits.ids.includes("anna-feline"), `${query} still ignores bio Don Julio`);
  });

  const meOnly = tools.rankPeopleIdentityHits({
    query: "Who am I",
    viewerUid: "viewer-don",
    viewerData: DON_ALIASES,
    directory
  });
  assert.equal(meOnly.exclusiveSelf, true);
  assert.deepEqual(meOnly.ids, ["viewer-don"]);

  const src = require("fs").readFileSync(require("path").join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(src, /!exclusiveSelf && !friendContext && matchNeedle/);
  assert.match(src, /Shared first\/last names include the viewer AND the public directory/);
});

test("my friend Don does not inject the signed-in viewer named Don", () => {
  const otherDon = {
    publicProfileVisibility: "public",
    firstName: "Don",
    lastName: "Smith",
    displayName: "Don Smith",
    floqrHandle: "donsmith"
  };
  const hits = tools.rankPeopleIdentityHits({
    query: "my friend Don",
    viewerUid: "viewer-don",
    viewerData: DON_ALIASES,
    directory: [{id: "other-don", data: otherDon, relation: "connection"}]
  });
  assert.equal(hits.friendContext, true);
  assert.equal(hits.exclusiveSelf, false);
  assert.ok(!hits.ids.includes("viewer-don"), "friend search does not inject signed-in Don");
  assert.ok(hits.ids.includes("other-don"), "friend search keeps the connected Don");
  const src = require("fs").readFileSync(require("path").join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(src, /!friendContext && matchNeedle/);
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
