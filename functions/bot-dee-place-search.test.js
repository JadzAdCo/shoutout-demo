"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const tools = require("./bot-dee-tools");
const cards = require("./botdee-smartcard-core");
const bot = require("./bot-dee-core");

const KATA = {
  id: "kata-washington-dc",
  data: {
    locationName: "KATA DC",
    brandName: "KATA",
    city: "Washington",
    country: "United States",
    fullAddress: "600 F Street NW, Washington, DC 20004, United States",
    description: "Asian fusion tapas, sushi, and experiential cocktails in a sleek Chinatown setting — fine dining early, vibrant nightlife energy later.",
    cuisine: "Asian fusion / sushi / tapas",
    categories: ["Restaurant", "Bar", "Lounge", "Nightlife", "Events", "ShoutOut"],
    amenities: ["Cocktails", "Private events", "Sushi / Asian fusion", "Bar seating"],
    activityStatus: "Active Chinatown Asian fusion restaurant / cocktail lounge",
    neighborhood: "Chinatown / Gallery Place",
    visibility: "public"
  }
};

const DECADES = {
  id: "decades-washington-dc",
  data: {
    locationName: "Decades Nightclub",
    brandName: "Decades",
    city: "Washington",
    country: "United States",
    fullAddress: "1219 Connecticut Avenue NW, Washington, DC 20036, United States",
    description: "Retro-themed nightclub with 6 floors, 8 bars, and 5 DJs.",
    categories: ["Clubs", "Retro", "Nightlife", "Events", "ShoutOut"],
    genres: ["Hip Hop", "Top 40"],
    activityStatus: "Active multi-level retro nightclub",
    visibility: "public"
  }
};

const NYC_CLUB = {
  id: "demo-nyc",
  data: {
    locationName: "Demo NYC Club",
    city: "New York",
    fullAddress: "New York, NY",
    cuisine: "sushi",
    categories: ["Restaurant"],
    visibility: "public"
  }
};

test("sushi in Washington DC is a dining place intent, not people", () => {
  const place = tools.classifyPlaceSearchIntent("Sushi restaurants in Washington DC");
  assert.equal(place.intent, "dining");
  assert.ok(place.tokens.includes("sushi"));
  assert.ok(place.placeTokens.includes("washington") || place.placeTokens.includes("dc"));
  assert.equal(cards.classifyPeopleSearchIntent("Sushi restaurants in Washington DC").intent, "none");
});

test("clubs in DC is a venue intent; who-is stays people-only", () => {
  assert.equal(tools.classifyPlaceSearchIntent("clubs in Washington DC").intent, "venue");
  assert.equal(tools.classifyPlaceSearchIntent("Who is Lorna?").intent, "none");
  assert.equal(tools.classifyPlaceSearchIntent("Who am I?").intent, "none");
  assert.equal(tools.classifyPlaceSearchIntent("what food is on my public profile").intent, "none");
  assert.equal(tools.classifyPlaceSearchIntent("hello").intent, "none");
});

test("sushi DC ranks KATA and skips Decades plus out-of-city sushi", () => {
  const classified = tools.classifyPlaceSearchIntent("Sushi restaurants in Washington DC");
  const ranked = tools.rankPublicClubs([KATA, DECADES, NYC_CLUB], classified, 5);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "kata-washington-dc");
  assert.ok(ranked[0].score >= 8);
  assert.equal(tools.scoreClubForPlace(DECADES.id, DECADES.data, classified), 0);
  assert.equal(tools.scoreClubForPlace(NYC_CLUB.id, NYC_CLUB.data, classified), 0);
});

test("clubs in DC ranks Decades; cuisine hay includes sushi", () => {
  const classified = tools.classifyPlaceSearchIntent("clubs in Washington DC");
  const ranked = tools.rankPublicClubs([KATA, DECADES], classified, 5);
  assert.ok(ranked.some(row => row.id === "decades-washington-dc"));
  assert.match(tools.clubHaystack(KATA.id, KATA.data), /sushi/i);
});

test("venue cards open the club public page without cache-bust v=", () => {
  const card = tools.publicClubCard(KATA.id, KATA.data, 20);
  assert.equal(card.profileHref, "./club-profile.html?location=kata-washington-dc");
  assert.doesNotMatch(card.profileHref, /[?&]v=/);
  assert.match(card.cuisine, /sushi/i);
  const view = tools.clubSmartView(card);
  assert.equal(view.kind, "venue");
  assert.equal(view.actions[0].href, card.profileHref);
  assert.equal((view.images || []).length, 0);
  assert.ok(view.floqrPublicData.smartBackgroundId);
  assert.ok(view.floqrPublicData.smartStencilId);
  const tagged = tools.applyPlaceVisualOverride(view, {
    backgroundId: "bg-paris",
    stencilId: "st-flight",
    tags: ["nightlife", "dc"],
    generic: true
  });
  assert.equal(tagged.floqrPublicData.smartBackgroundId, view.floqrPublicData.smartBackgroundId);
  assert.ok(tagged.floqrPublicData.smartTags.includes("destination:washington-dc") || tagged.floqrPublicData.smartBackgroundId);
  const miamiDest = tools.destinationSmartView(tools.classifyPlaceSearchIntent("clubs in Miami"));
  const mixed = tools.applyPlaceVisualOverride(miamiDest, {
    backgroundId: "bg-bali",
    stencilId: "st-flight",
    tags: ["milan", "fashion", "travel", "bali", "tropical"],
    generic: true
  });
  assert.equal(mixed.floqrPublicData.smartBackgroundId, "bg-miami");
  assert.ok(mixed.floqrPublicData.smartTags.includes("miami"));
  assert.ok(!mixed.floqrPublicData.smartTags.includes("milan"));
  assert.ok(!mixed.floqrPublicData.smartTags.includes("bali"));
  const samePlace = tools.applyPlaceVisualOverride(miamiDest, {
    backgroundId: "bg-miami",
    stencilId: "st-beach",
    tags: ["miami", "beach"],
    generic: false
  });
  assert.equal(samePlace.floqrPublicData.smartBackgroundId, "bg-miami");
  const result = tools.clubToResult(card);
  assert.equal(result.href, card.profileHref);
  assert.doesNotMatch(result.href, /[?&]v=/);
});

test("unknown city or cuisine does not fall back to DC restaurants", () => {
  const miami = tools.classifyPlaceSearchIntent("Sushi restaurants in Miami");
  assert.equal(miami.intent, "dining");
  assert.ok(miami.placeTokens.includes("miami"));
  assert.ok(!miami.leftoverTokens.includes("miami"));
  assert.equal(tools.scoreClubForPlace(KATA.id, KATA.data, miami), 0);
  assert.equal(tools.rankPublicClubs([KATA, DECADES, NYC_CLUB], miami, 5).length, 0);

  const ethiopian = tools.classifyPlaceSearchIntent("Ethiopian restaurants in Washington DC");
  assert.equal(ethiopian.intent, "dining");
  assert.ok(ethiopian.leftoverTokens.includes("ethiopian"));
  assert.equal(tools.scoreClubForPlace(KATA.id, KATA.data, ethiopian), 0);

  const vegan = tools.classifyPlaceSearchIntent("vegan restaurants in DC");
  assert.equal(vegan.intent, "dining");
  assert.ok(vegan.leftoverTokens.includes("vegan"));
  assert.equal(tools.scoreClubForPlace(KATA.id, KATA.data, vegan), 0);

  const anyDining = tools.classifyPlaceSearchIntent("restaurants in Washington DC");
  assert.equal(anyDining.intent, "dining");
  assert.equal(anyDining.leftoverTokens.length, 0);
  assert.ok(tools.scoreClubForPlace(KATA.id, KATA.data, anyDining) >= 8);

  const district = tools.classifyPlaceSearchIntent("Sushi restaurants in the District of Columbia");
  assert.equal(district.intent, "dining");
  assert.deepEqual(district.leftoverTokens, []);
  assert.ok(district.placeTokens.includes("washington") || district.placeTokens.includes("dc"));
  assert.equal(tools.rankPublicClubs([KATA, DECADES, NYC_CLUB], district, 5)[0]?.id, "kata-washington-dc");

  const nycCity = tools.classifyPlaceSearchIntent("Sushi restaurants in New York City");
  assert.equal(nycCity.intent, "dining");
  assert.deepEqual(nycCity.leftoverTokens, []);
  const nycRanked = tools.rankPublicClubs([KATA, DECADES, NYC_CLUB], nycCity, 5);
  assert.equal(nycRanked.length, 1);
  assert.equal(nycRanked[0].id, "demo-nyc");
});

test("venue search returns SMARTviews only, not duplicate result links", () => {
  const session = fs.readFileSync(path.join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(session, /else if \(venueAttached && venueAttached\.handled\)[\s\S]*?results: \[\]/);
  const attach = fs.readFileSync(path.join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(attach, /applyPlaceVisualOverride\(clubSmartView\(card\), overrideVisual\)/);
  assert.match(attach, /catalogPlaceIdFromTokens\(classified\.placeTokens\)/);
  assert.match(attach, /attachPublishedBackgroundUrl/);
  assert.match(session, /attachPlaceWithRoom/);
  assert.match(session, /placeViews/);
  assert.match(session, /!vipExecute \|\| attachPlaceWithRoom/);
  assert.match(session, /classifyPlaceSearchFromConversation/);
  assert.match(session, /mergePlaceSmartViews/);
  assert.doesNotMatch(session, /!outcome && !shoutExecute && !vipExecute && \(!roomAttached\.handled \|\| attachPlaceWithRoom\)/);
});

test("room smart card for reservations in Miami keeps Miami place tokens and Place SMARTview", () => {
  const q = "Open a room smart card for reservations in Miami";
  const classified = tools.classifyPlaceSearchIntent(q);
  assert.equal(classified.intent, "venue");
  assert.ok(classified.placeTokens.includes("miami"));
  assert.ok(!classified.leftoverTokens.includes("miami"));
  assert.ok(!classified.leftoverTokens.includes("smart"));
  assert.ok(!classified.leftoverTokens.includes("card"));
  assert.ok(!classified.leftoverTokens.includes("room"));
  assert.equal(tools.placeSearchAlongsideRoom(classified), true);
  assert.equal(tools.scoreClubForPlace(KATA.id, KATA.data, classified), 0);

  const liv = {
    id: "liv-miami-fl",
    data: {
      locationName: "LIV Miami",
      city: "Miami",
      fullAddress: "Miami, Florida",
      categories: ["Clubs", "Nightlife"],
      type: "club",
      visibility: "public",
      active: true
    }
  };
  const ranked = tools.rankPublicClubs([KATA, DECADES, NYC_CLUB, liv], classified, 5);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "liv-miami-fl");

  const dest = tools.destinationSmartView(classified);
  assert.equal(dest.kind, "venue");
  assert.match(dest.title, /Miami/i);
  assert.equal(dest.floqrPublicData.smartBackgroundId, "bg-miami");
  assert.ok(dest.floqrPublicData.smartTags.includes("miami"));
  assert.equal(tools.catalogPlaceIdFromTokens(["miami"]), "miami");

  const local = require("./bot-dee-functions").__botDeeHelpers.localSession("patron", q);
  assert.equal(local.provider, "local-room-smartview");
  assert.ok(local.smartViews.some(row => row && row.kind === "botDeeRoom"));
  assert.ok(local.smartViews.some(row => row && row.kind === "venue" && /miami/i.test(row.title || "")));
  assert.ok(local.smartViews.some(row => row && Array.isArray(row.floqrPublicData?.smartTags) && row.floqrPublicData.smartTags.includes("miami")));
});

test("VIP reservations in Miami still attach Place SMARTview", () => {
  const vip = require("./headless-vip-core");
  const q = "VIP reservations in Miami";
  assert.equal(vip.isVipExecutePrompt(q), true);
  const classified = tools.classifyPlaceSearchIntent(q);
  assert.equal(classified.intent, "venue");
  assert.ok(classified.placeTokens.includes("miami"));
  assert.equal(tools.placeSearchAlongsideRoom(classified), true);
  const dest = tools.destinationSmartView(classified);
  assert.equal(dest.floqrPublicData.smartBackgroundId, "bg-miami");
  assert.ok(dest.floqrPublicData.smartTags.includes("miami"));

  const local = require("./bot-dee-functions").__botDeeHelpers.localSession("patron", q);
  assert.equal(local.provider, "local-vip");
  assert.ok(local.smartViews.some(row => row && row.kind === "venue" && /miami/i.test(row.title || "")));
  assert.ok(local.smartViews.some(row => row && row.floqrPublicData?.smartBackgroundId === "bg-miami"));
});

test("VIP follow-up keeps Miami Place SMARTview from earlier turns", () => {
  const history = [
    {role: "user", text: "VIP reservations in Miami"},
    {role: "model", text: "Which club?"},
    {role: "user", text: "at Aurelia"}
  ];
  const follow = tools.classifyPlaceSearchFromConversation("at Aurelia", history);
  assert.equal(tools.placeSearchAlongsideRoom(follow), true);
  assert.ok(follow.placeTokens.includes("miami"));
  assert.match(tools.placeAttachQuery(follow, "at Aurelia"), /miami/i);

  const dateFollow = tools.classifyPlaceSearchFromConversation("2026-11-26", history.concat([
    {role: "model", text: "Pick a night"}
  ]));
  assert.ok(dateFollow.placeTokens.includes("miami"));

  const local = require("./bot-dee-functions").__botDeeHelpers.localSession("patron", "at Aurelia", {history});
  assert.ok(local.smartViews.some(row => row && row.kind === "venue" && /miami/i.test(row.title || "")));

  const helpers = require("./bot-dee-functions").__botDeeHelpers;
  const vipOnly = {
    reply: "Tap a night.",
    smartViews: [{kind: "botDeeVip", venueName: "Aurelia"}]
  };
  const merged = helpers.mergePlaceSmartViews(vipOnly, {
    handled: true,
    smartViews: [tools.destinationSmartView(follow)],
    venueSearch: {intent: "venue", count: 1}
  });
  assert.equal(merged.smartViews[0].kind, "botDeeVip");
  assert.equal(merged.smartViews[1].kind, "venue");
  assert.equal(merged.smartViews[1].floqrPublicData.smartBackgroundId, "bg-miami");
  const again = helpers.mergePlaceSmartViews(merged, {
    handled: true,
    smartViews: [tools.destinationSmartView(follow)]
  });
  assert.equal(again.smartViews.filter(row => row.kind === "venue").length, 1);
});

test("Milan Fashion Week tags pick published bg-milan-fashion-week, not leftover night SVG", () => {
  const tags = ["milan", "fashion", "event", "runway", "fashion-week"];
  assert.equal(tools.catalogBackgroundIdForTags(tags), "bg-milan-fashion-week");
  const jpeg = "a".repeat(500001);
  assert.match(tools.publishedBackgroundDataUrl({
    approvalStatus: "published",
    contentType: "image/jpeg",
    imageBase64: jpeg
  }), /^data:image\/jpeg;base64,/);
  assert.equal(tools.publishedBackgroundDataUrl({
    approvalStatus: "published",
    contentType: "image/jpeg",
    imageBase64: jpeg.slice(0, 10)
  }).startsWith("data:image/jpeg"), true);

  const q = "Let's plan a trip to Milan";
  const classified = tools.classifyPlaceSearchIntent(q);
  assert.equal(classified.intent, "venue");
  assert.ok(classified.placeTokens.includes("milan"));
  const dest = tools.destinationSmartView(classified);
  assert.match(dest.title, /Milan/i);
  const fashion = tools.applyTaggedCatalogBackground({
    kind: "venue",
    title: "milan Fashion Week",
    floqrPublicData: {
      smartBackgroundId: "bg-bali",
      smartTags: tags
    }
  });
  assert.equal(fashion.floqrPublicData.smartBackgroundId, "bg-milan-fashion-week");

  const workflow = require("./botdee-session-intent").classifySessionWorkflow("I like fashion week in Milan");
  const stamped = tools.destinationSmartView(classified, workflow);
  assert.equal(stamped.floqrPublicData.smartBackgroundId, "bg-milan-fashion-week");
  assert.equal(stamped.floqrPublicData.smartStencilId, "st-people");
  assert.ok(stamped.floqrPublicData.smartTags.includes("fashion-week"));
  assert.ok(stamped.floqrPublicData.smartTags.includes("milan"));

  const local = require("./bot-dee-functions").__botDeeHelpers.localSession("patron", q);
  assert.ok(!Array.isArray(local.smartViews) || !local.smartViews.some(row => row && row.kind === "botDeeVip"));
  const attach = fs.readFileSync(path.join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(attach, /stampPublishedPlaceViews/);
  assert.match(attach, /catalogBackgroundIdForTags/);
  assert.match(attach, /PUBLISHED_DATA_URL_MAX = 900000/);
  const session = fs.readFileSync(path.join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(session, /stampPublishedPlaceViews/);
  assert.doesNotMatch(session, /venueAttached\.smartViews = venueAttached\.smartViews\.map\(view => intentCore\.stampPlacePayload/);
});

test("Let's plan for Bali is a Bali Place SMARTview, not leftover Miami", () => {
  const q = "Let's plan for Bali";
  const classified = tools.classifyPlaceSearchIntent(q);
  assert.equal(classified.intent, "venue");
  assert.ok(classified.placeTokens.includes("bali"));
  assert.ok(!classified.placeTokens.includes("miami"));
  assert.equal(tools.placeSearchAlongsideRoom(classified), true);
  assert.equal(tools.catalogPlaceIdFromTokens(classified.placeTokens), "bali");

  const dest = tools.destinationSmartView(classified);
  assert.match(dest.title, /Bali/i);
  assert.equal(dest.floqrPublicData.smartBackgroundId, "bg-bali");
  assert.ok(dest.floqrPublicData.smartTags.includes("bali"));
  assert.ok(!dest.floqrPublicData.smartTags.includes("miami"));

  const leftoverMiami = tools.applyPlaceVisualOverride(dest, {
    backgroundId: "bg-miami",
    stencilId: "st-beach",
    tags: ["miami", "beach", "city"],
    generic: true
  });
  assert.equal(leftoverMiami.floqrPublicData.smartBackgroundId, "bg-bali");
  assert.ok(leftoverMiami.floqrPublicData.smartTags.includes("bali"));
  assert.ok(!leftoverMiami.floqrPublicData.smartTags.includes("miami"));

  const history = [
    {role: "user", text: "Miami"},
    {role: "model", text: "FLOQR doesn't list that kind of spot there yet."}
  ];
  const follow = tools.classifyPlaceSearchFromConversation(q, history);
  assert.ok(follow.placeTokens.includes("bali"));
  assert.ok(!follow.placeTokens.includes("miami"));
  assert.match(tools.placeAttachQuery(follow, q), /bali/i);

  const local = require("./bot-dee-functions").__botDeeHelpers.localSession("patron", q, {history});
  assert.ok(local.smartViews.some(row => row && row.kind === "venue" && /bali/i.test(row.title || "")));
  assert.ok(!local.smartViews.some(row => row && row.kind === "venue" && /miami/i.test(row.title || "")));
  assert.ok(local.smartViews.some(row => row && row.floqrPublicData?.smartBackgroundId === "bg-bali"));
});

test("Hey is not a venue search even after Miami in history", () => {
  assert.equal(tools.skipPlaceSearchPrompt("Hey"), true);
  assert.equal(tools.skipPlaceSearchPrompt("hey!"), true);
  assert.equal(tools.classifyPlaceSearchIntent("Hey").intent, "none");
  const history = [
    {role: "user", text: "Miami"},
    {role: "model", text: "FLOQR doesn't list that kind of spot there yet."},
    {role: "user", text: "Let's talk Miami"}
  ];
  const hey = tools.classifyPlaceSearchFromConversation("Hey", history);
  assert.equal(hey.intent, "none");
  assert.deepEqual(hey.placeTokens, []);
  const local = require("./bot-dee-functions").__botDeeHelpers.localSession("patron", "Hey", {history});
  assert.equal(local.provider, "local-chitchat");
  assert.ok(!Array.isArray(local.smartViews) || !local.smartViews.length);
  const session = fs.readFileSync(path.join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(session, /skipPlaceSearchPrompt\(userPrompt\)/);
  assert.match(session, /!skipPlaceSearch && !outcome && !shoutExecute/);
});

test("Miami and let's talk Miami attach Place SMARTview", () => {
  for (const q of ["Miami", "Let's talk Miami", "lets talk Miami"]) {
    const classified = tools.classifyPlaceSearchIntent(q);
    assert.equal(classified.intent, "venue", q);
    assert.ok(classified.placeTokens.includes("miami"), q);
    assert.ok(!classified.leftoverTokens.includes("talk"), q);
    assert.ok(!classified.leftoverTokens.includes("lets"), q);
    assert.equal(tools.placeSearchAlongsideRoom(classified), true, q);
    const dest = tools.destinationSmartView(classified);
    assert.match(dest.title, /Miami/i);
    assert.equal(dest.floqrPublicData.smartBackgroundId, "bg-miami");
    assert.match(dest.summary, /Place SMARTview/);
    const local = require("./bot-dee-functions").__botDeeHelpers.localSession("patron", q);
    assert.ok(local.smartViews.some(row => row && row.kind === "venue" && /miami/i.test(row.title || "")), q);
    assert.ok(local.smartViews.some(row => row && row.floqrPublicData?.smartBackgroundId === "bg-miami"), q);
  }
  const attach = fs.readFileSync(path.join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(attach, /if \(placeSearchAlongsideRoom\(classified\)\) \{[\s\S]*destinationSmartView/);
  assert.match(attach, /const destCity = titleCasePlace/);
  assert.match(attach, /Place SMARTview\. I can look at onboarded FLOQR clubs there/);
});

test("Gemini dining path is kind=club and does not pitch products", () => {
  const instruction = bot.systemInstruction("patron");
  assert.match(instruction, /kind=club/);
  assert.match(instruction, /onboarded FLOQR venues only/);
  assert.match(instruction, /Never look up patrons for food or restaurant queries/);
  const decl = bot.toolDeclarations().find(tool => tool.name === "lookupPublicProfiles");
  assert.match(String(decl.description), /kind=club/);
  const session = fs.readFileSync(path.join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(session, /attachVenueSearch/);
  assert.match(session, /venueAttached && venueAttached\.handled/);
  assert.match(session, /peopleAttached = await peopleCards\.attachPeopleSearch/);
});
