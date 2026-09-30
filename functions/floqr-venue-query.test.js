/**
 * FloqAi venue / activity search: word list, entry context, genre + place filters.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const VQ = require(path.join(root, "floqr-venue-query.js"));

test("Hip Hop Clubs in DC parses type, genre, and place", () => {
  const p = VQ.parse("Hip Hop Clubs in DC", {entry: "category"});
  assert.equal(p.type, "clubs");
  assert.equal(p.typeSource, "query");
  assert.deepEqual(p.genres, ["Hip Hop"]);
  assert.equal(p.place.id, "washington-dc");
  assert.equal(p.residual, "");
});

test("EDM Events in New York parses events + EDM + New York", () => {
  const p = VQ.parse("EDM Events in New York");
  assert.equal(p.type, "events");
  assert.deepEqual(p.genres, ["EDM"]);
  assert.equal(p.place.label, "New York");
});

test("beach club spellings all resolve to beach-clubs", () => {
  ["Beachclub", "Beach club", "Beach-club", "Beach clubs", "beachclubs", "BEACH CLUBS in Miami"].forEach(q => {
    assert.equal(VQ.parse(q).type, "beach-clubs", q);
  });
});

test("lounge-club spellings beat plain lounge / club", () => {
  ["Lounge-Club", "lounge club", "loungeclubs", "Lounge Clubs", "club lounge", "lounge & club"].forEach(q => {
    assert.equal(VQ.parse(q).type, "lounge-club", q);
  });
});

test("lounge and club alternates", () => {
  ["lounges", "Lounge", "hookah lounge", "cocktail lounges", "rooftop lounge"].forEach(q => {
    assert.equal(VQ.parse(q).type, "lounges", q);
  });
  ["nightclubs", "night club", "Night-Club", "disco", "discoteca", "boîte de nuit", "Nachtclub", "клуб"].forEach(q => {
    assert.equal(VQ.parse(q).type, "clubs", q);
  });
});

test("event alternates and events win over a venue word", () => {
  ["parties", "concerts", "Festival", "eventos", "événements"].forEach(q => {
    assert.equal(VQ.parse(q).type, "events", q);
  });
  const p = VQ.parse("club events in Paris");
  assert.equal(p.type, "events");
  assert.equal(p.venueHint, "clubs");
  assert.equal(p.place.id, "paris");
});

test("where the search is typed decides the type when the query has none", () => {
  assert.equal(VQ.parse("afrobeats in DC", {entry: "lounges"}).type, "lounges");
  assert.equal(VQ.parse("afrobeats in DC", {entry: "lounges"}).typeSource, "entry");
  assert.equal(VQ.parse("afrobeats in DC", {entry: "category"}).type, "events");
  assert.equal(VQ.parse("afrobeats in DC", {entry: "category"}).typeSource, "default");
  assert.equal(VQ.parse("beach clubs", {entry: "lounges"}).type, "beach-clubs");
});

test("Miami Beach is a place, not a beach club", () => {
  const p = VQ.parse("hip hop clubs in Miami Beach");
  assert.equal(p.type, "clubs");
  assert.equal(p.place.id, "miami-beach");
});

test("unknown city after 'in' becomes a free-text place", () => {
  const p = VQ.parse("amapiano lounges in Accra");
  assert.equal(p.type, "lounges");
  assert.deepEqual(p.genres, ["Amapiano"]);
  assert.equal(p.place.label, "Accra");
  assert.deepEqual(p.place.match, ["accra"]);
  assert.equal(VQ.parse("events in Accra this weekend").place.label, "Accra");
});

test("R&B and hip-hop genre spellings", () => {
  assert.deepEqual(VQ.parse("R&B clubs").genres, ["R&B"]);
  assert.deepEqual(VQ.parse("rnb lounges").genres, ["R&B"]);
  assert.deepEqual(VQ.parse("hip-hop events").genres, ["Hip Hop"]);
  assert.deepEqual(VQ.parse("hiphop").genres, ["Hip Hop"]);
});

test("compound genre+type words and localized placeholders parse", () => {
  const nl = VQ.parse("Hiphopclubs in DC");
  assert.equal(nl.type, "clubs");
  assert.deepEqual(nl.genres, ["Hip Hop"]);
  assert.equal(nl.place.id, "washington-dc");
  assert.equal(VQ.parse("Hip-Hop-Clubs in DC").type, "clubs");
  assert.equal(VQ.parse("EDM-Events in New York").type, "events");
  const es = VQ.parse("Clubs de Hip Hop en DC");
  assert.equal(es.type, "clubs");
  assert.equal(es.place.id, "washington-dc");
  assert.equal(VQ.parse("Eventos EDM em Nova York").place.id, "new-york");
  assert.equal(VQ.parse("Clubs de plage à Paris").type, "beach-clubs");
  assert.deepEqual(VQ.parse("Хип-хоп клубы в DC").genres, ["Hip Hop"]);
  assert.equal(VQ.parse("Хип-хоп клубы в DC").type, "clubs");
  assert.equal(VQ.parse("نوادي هيب هوب في DC").type, "clubs");
  assert.equal(VQ.parse("Salotti a Milano").type, "lounges");
});

test("residual keeps venue names; day words go to when", () => {
  const p = VQ.parse("Friday events at Zebbies");
  assert.equal(p.type, "events");
  assert.equal(p.residual, "zebbies");
  assert.deepEqual(p.when, ["friday"]);
  const t = VQ.parse("hip hop clubs in DC tonight");
  assert.equal(t.place.id, "washington-dc");
  assert.equal(t.residual, "");
  assert.deepEqual(t.when, ["tonight"]);
});

test("matchesFilters checks genres and place on records", () => {
  const dcHipHop = {city: "Washington", region: "DC", genres: ["Hip-Hop", "Afrobeats"]};
  const nyEdm = {city: "New York", country: "United States", genres: ["EDM", "House"]};
  const hipHopDc = VQ.parse("Hip Hop Clubs in DC");
  assert.equal(VQ.matchesFilters(hipHopDc, dcHipHop), true);
  assert.equal(VQ.matchesFilters(hipHopDc, nyEdm), false);
  const edmNy = VQ.parse("EDM Events in New York");
  assert.equal(VQ.matchesFilters(edmNy, nyEdm), true);
  assert.equal(VQ.matchesFilters(edmNy, dcHipHop), false);
  assert.equal(VQ.matchesFilters(VQ.parse("clubs"), nyEdm), true);
  assert.equal(VQ.matchesPlace(VQ.parse("events in Brooklyn"), {city: "Brooklyn"}), true);
});

test("isVenueQuery separates venue searches from help questions", () => {
  assert.equal(VQ.isVenueQuery(VQ.parse("Hip Hop Clubs in DC")), true);
  assert.equal(VQ.isVenueQuery(VQ.parse("EDM in NYC")), true);
  assert.equal(VQ.isVenueQuery(VQ.parse("create a schedule")), false);
  assert.equal(VQ.isVenueQuery(VQ.parse("I want to be a Club Admin")), true);
});

test("typeLabel uses translations when present", () => {
  assert.equal(VQ.typeLabel("beach-clubs"), "Beach Clubs");
  assert.equal(VQ.typeLabel("events", key => (key === "cat.events" ? "Veranstaltungen" : key)), "Veranstaltungen");
});

test("word list covers every Search-for category", () => {
  const ids = VQ.wordList().types.map(t => t.id).sort();
  assert.deepEqual(ids, ["beach-clubs", "clubs", "events", "lounge-club", "lounges"]);
  VQ.wordList().types.forEach(t => assert.ok(t.words.length >= 6, t.id));
});

test("index.html wires the stationary FloqAi category search", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /id="categoryFloqAiSearch"/);
  assert.match(html, /id="categoryFloqAiSpeech"/);
  assert.match(html, /id="categoryFloqAiInput"/);
  assert.match(html, /data-i18n="cat\.floqaiWelcome"/);
  assert.match(html, /floqr-venue-query\.js\?v=s3\.0\.106/);
  assert.ok(html.indexOf("categoryFloqAiSpeech") < html.indexOf("categoryFloqAiInput"), "FloqAi sits above the input");
  assert.doesNotMatch(html, /id="continueBtn"/);
  assert.doesNotMatch(html, /class="login-copy"/);
  assert.match(html, /data-floqr-help-id="help-welcome"/);
});

test("category page has no Search for heading and no venue-type tiles", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const page = html.slice(html.indexOf('id="categoryPage"'), html.indexOf('id="intentSearchPage"'));
  assert.doesNotMatch(page, /data-i18n="nav\.searchFor"/);
  ["eventsBtnCard", "clubsBtnCard", "beachClubsBtnCard", "loungesBtnCard", "loungeClubBtnCard"].forEach(id =>
    assert.doesNotMatch(page, new RegExp(`id="${id}"`), id));
  assert.match(page, /id="shoutoutBtnCard"/);
  assert.match(page, /class="category-floqai-mark-halo"/);
});

test("near me in every language means the user's location, not a place", () => {
  ["EDM clubs near me", "clubs nearby", "closest lounges", "clubs cerca de mí", "clubs près de moi",
    "Clubs in der Nähe", "club vicino a me", "clubes perto de mim", "клубы рядом", "κλαμπ κοντά μου",
    "kluby w pobliżu", "clubs in de buurt", "نوادي بالقرب مني"].forEach(q => {
    const p = VQ.parse(q);
    assert.equal(p.nearMe, true, q);
    assert.equal(p.place, null, q);
  });
  const edm = VQ.parse("EDM clubs near me");
  assert.equal(edm.type, "clubs");
  assert.deepEqual(edm.genres, ["EDM"]);
  assert.equal(edm.residual, "");
});

test("an explicit place wins over near me; Monaco is a known place", () => {
  const p = VQ.parse("Clubs in Monaco");
  assert.equal(p.place.id, "monaco");
  assert.equal(p.nearMe, false);
  assert.equal(VQ.parse("clubs near me in Miami").place.id, "miami");
  assert.equal(VQ.parse("clubs near me in Miami").nearMe, false);
  assert.equal(VQ.parse("Monte Carlo lounges").place.id, "monaco");
});

test("chrome pack carries the FloqAi category dialog copy", () => {
  const src = fs.readFileSync(path.join(root, "floqr-i18n.js"), "utf8");
  assert.match(src, /"cat\.floqaiWelcome": "Welcome, type below to search for Events"/);
  assert.match(src, /"cat\.floqaiAlso": "You may also search for: Clubs or Lounges"/);
});
