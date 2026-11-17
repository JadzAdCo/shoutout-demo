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
  const result = tools.clubToResult(card);
  assert.equal(result.href, card.profileHref);
  assert.doesNotMatch(result.href, /[?&]v=/);
});

test("unknown city or cuisine does not fall back to DC restaurants", () => {
  const miami = tools.classifyPlaceSearchIntent("Sushi restaurants in Miami");
  assert.equal(miami.intent, "dining");
  assert.ok(miami.leftoverTokens.includes("miami"));
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
});

test("venue search returns SMARTviews only, not duplicate result links", () => {
  const session = fs.readFileSync(path.join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(session, /else if \(venueAttached && venueAttached\.handled\)[\s\S]*?results: \[\]/);
  const attach = fs.readFileSync(path.join(__dirname, "bot-dee-tools.js"), "utf8");
  assert.match(attach, /handled: true[\s\S]*?results: \[\][\s\S]*?smartViews: cards\.map\(clubSmartView\)/);
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
