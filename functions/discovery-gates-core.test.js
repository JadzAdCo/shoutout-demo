"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const gates = require("./discovery-gates-core");

test("default import gates do not require Promoter(s) or Email", () => {
  const defaults = gates.defaultImportGates();
  assert.equal(defaults.venue.promoters, 0);
  assert.equal(defaults.venue.email, 0);
  assert.equal(defaults.venue.artistsOrDjs, 1);
  assert.equal(defaults.venue.genres, 1);
  assert.equal(defaults.venue.instagram, 0);
  assert.equal(defaults.venue.name, 1);
  assert.equal(defaults.venue.address, 1);
  assert.equal(defaults.venue.city, 1);
  assert.equal(defaults.venue.country, 1);
  assert.equal(defaults.venue.phone, 0);
  assert.equal(defaults.event.date, 1);
  assert.equal(defaults.event.genres, 1);
  assert.equal(defaults.event.artistsOrDjs, 0);
  assert.equal(defaults.event.promoters, 0);
  assert.equal(defaults.event.email, 0);
});

test("missingDatapoints uses Master Admin ticks instead of hardcoded promoters/email", () => {
  const venue = {
    entityKind: "venue",
    proposedType: "nightclub",
    proposedTitle: "Jimmy'z",
    genres: ["Hip Hop"],
    artistsOrDjs: ["Resident DJs"],
    proposedAddress: "26 Avenue Princesse Grace",
    city: "Monte Carlo",
    country: "Monaco",
    telephone: "+377 98 06 70 00"
  };
  assert.deepEqual(gates.missingDatapoints(venue), []);
  const requireEmail = gates.normalizeImportGates({
    venue: {email: 1, promoters: 1}
  });
  const missing = gates.missingDatapoints(venue, requireEmail);
  assert.ok(missing.includes("Email"));
  assert.ok(missing.includes("Promoter(s)"));
});

test("event missing datapoints honor event gates and organizer label", () => {
  const event = {
    entityKind: "event",
    proposedType: "comedyShow",
    proposedTitle: "Friday Comedy",
    genres: ["Comedy"],
    artistsOrDjs: ["Featured comics"],
    proposedAddress: "12 Rue de la Gaite",
    city: "Paris",
    country: "France",
    proposedDate: "2026-12-04",
    proposedTime: "21:00",
    email: "comedy@example.com"
  };
  assert.deepEqual(gates.missingDatapoints(event), []);
  const missing = gates.missingDatapoints({...event, email: ""}, {event: {promoters: 1, email: 1}});
  assert.ok(missing.includes("Organizer(s) / Promoter(s)"));
  assert.ok(missing.includes("Email"));
});

test("same establishment: phone, address, or name — Monaco and Monte Carlo alias", () => {
  const jimmyzMc = {
    id: "a",
    proposedLocationName: "Jimmy'z Monte-Carlo",
    city: "Monte Carlo",
    country: "Monaco",
    proposedAddress: "26 Avenue Princesse Grace, Monte-Carlo",
    telephone: "+377 98 06 70 00"
  };
  const jimmyzMonaco = {
    id: "b",
    proposedLocationName: "Jimmyz Monaco",
    city: "Monaco",
    country: "MC",
    proposedAddress: "26 Avenue Princesse Grace, Monaco",
    telephone: "98 06 70 00"
  };
  const byName = gates.sameEstablishment(
    {id: "n1", proposedLocationName: "Jimmy'z", city: "Monaco", country: "Monaco"},
    {id: "n2", proposedLocationName: "Jimmy'z Beach Club", city: "Monte Carlo", country: "Monaco"}
  );
  assert.equal(byName.match, true);
  assert.ok(byName.reasons.includes("same-name"));
  assert.equal(byName.cityAliasApplied, "monaco-monte-carlo");

  const byPhone = gates.sameEstablishment(jimmyzMc, jimmyzMonaco);
  assert.equal(byPhone.match, true);
  assert.ok(byPhone.reasons.includes("same-phone"));
  assert.ok(byPhone.reasons.includes("same-address") || byPhone.reasons.includes("same-name"));

  const otherCountry = gates.sameEstablishment(
    {id: "x", proposedLocationName: "LIV", city: "Miami", country: "United States", telephone: "+13055550100"},
    {id: "y", proposedLocationName: "LIV", city: "Dubai", country: "United Arab Emirates", telephone: "+97145550100"}
  );
  assert.equal(otherCountry.match, false);
});

test("same phone is enough even when names differ", () => {
  const result = gates.sameEstablishment(
    {id: "1", proposedLocationName: "Club A", city: "Paris", country: "France", telephone: "+33144556677"},
    {id: "2", proposedLocationName: "Club A Rooftop", city: "Paris 8", country: "France", telephone: "01 44 55 66 77"}
  );
  assert.equal(result.match, true);
  assert.ok(result.reasons.includes("same-phone"));
});

test("classifyEntity separates clubs, beach clubs, and events", () => {
  const club = gates.classifyEntity({
    proposedType: "nightclub",
    proposedTitle: "Gate Club Paris",
    categories: ["night_club"]
  });
  assert.equal(club.entityKind, "venue");
  assert.equal(club.venueCategory, "nightclub");
  assert.equal(club.kindLabel, "Nightclub");

  const beach = gates.classifyEntity({
    proposedTitle: "Nikki Beach Monte-Carlo",
    proposedType: "beachClub",
    categories: ["beach club"]
  });
  assert.equal(beach.entityKind, "venue");
  assert.equal(beach.venueCategory, "beachClub");
  assert.equal(beach.kindLabel, "Beach Club");

  const comedy = gates.classifyEntity({
    proposedType: "comedyShow",
    proposedTitle: "Comedy Night",
    eventStartIso: "2026-12-01T21:00:00Z"
  });
  assert.equal(comedy.entityKind, "event");
  assert.equal(comedy.eventCategory, "comedyShow");
  assert.equal(comedy.kindLabel, "Comedy Show");
});

test("findDuplicates skips the same queue row and event-vs-venue pairs", () => {
  const jimmyz = {
    id: "place_1",
    placesId: "ChIJjimmyz",
    proposedLocationName: "Jimmy'z",
    city: "Monaco",
    country: "Monaco",
    telephone: "+37798067000",
    entityKind: "venue"
  };
  const self = gates.findDuplicates(jimmyz, [{...jimmyz, collection: "aiDiscoveryQueue"}]);
  assert.equal(self.length, 0);
  const live = gates.findDuplicates(jimmyz, [{
    id: "jimmyz-monaco",
    collection: "clubLocations",
    placesId: "ChIJjimmyz",
    locationName: "Jimmy'z Monte-Carlo",
    city: "Monte Carlo",
    country: "MC"
  }]);
  assert.equal(live.length, 1);
  assert.ok(live[0].reasons.includes("same-places-id"));
  const eventVsClub = gates.findDuplicates(
    {...jimmyz, entityKind: "event", proposedType: "comedyShow", eventStartIso: "2026-12-01T21:00:00Z"},
    [{...jimmyz, id: "club-live", collection: "clubLocations", entityKind: "venue"}]
  );
  assert.equal(eventVsClub.length, 0);
});

test("applyDuplicateStamp flags queue rows and updates-only for live clubs", () => {
  const stamped = gates.applyDuplicateStamp(
    {proposedTitle: "Jimmy'z", entityKind: "venue"},
    [{id: "jimmyz-monaco", collection: "clubLocations", name: "Jimmy'z", reasons: ["same-name"]}]
  );
  assert.equal(stamped.duplicateFlag, true);
  assert.equal(stamped.crawlScope, "updates-only");
  assert.equal(stamped.onboardedListingId, "jimmyz-monaco");
  assert.deepEqual(stamped.duplicateCandidateIds, ["jimmyz-monaco"]);
});

test("same physical address matches when city is Monaco vs Monte Carlo", () => {
  const result = gates.sameEstablishment(
    {
      id: "addr-1",
      proposedLocationName: "Jimmy'z",
      city: "Monaco",
      country: "Monaco",
      proposedAddress: "26 Avenue Princesse Grace"
    },
    {
      id: "addr-2",
      proposedLocationName: "Jimmyz Club",
      city: "Monte Carlo",
      country: "MC",
      proposedAddress: "26 Avenue Princesse Grace"
    }
  );
  assert.equal(result.match, true);
  assert.ok(result.reasons.includes("same-address") || result.reasons.includes("same-name"));
});

test("browser FLOQRDiscoveryGates mirror loads the same defaults", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "..", "floqr-discovery-gates.js"), "utf8");
  const sandbox = {window: {}, globalThis: {}};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  const browser = sandbox.FLOQRDiscoveryGates;
  assert.ok(browser);
  assert.equal(
    JSON.stringify(browser.defaultImportGates()),
    JSON.stringify(gates.defaultImportGates())
  );
  assert.equal(
    browser.cityCanonical("Monte-Carlo"),
    gates.cityCanonical("Monaco")
  );
  assert.equal(browser.csvHeaderRow(), gates.csvHeaderRow());
});

test("publishing rules differ by crawl type and require phone or email", () => {
  const club = {
    entityKind: "venue",
    proposedType: "nightclub",
    proposedTitle: "Gate Club Paris",
    genres: ["Hip Hop"],
    artistsOrDjs: ["Resident DJs"],
    proposedAddress: "1 Rue Example",
    city: "Paris",
    country: "France"
  };
  assert.ok(gates.missingDatapoints(club).includes("Phone or Email"));
  assert.deepEqual(gates.missingDatapoints({...club, email: "vip@gateclubparis.com"}), []);
  assert.ok(gates.missingDatapoints({...club, telephone: "+33144556677"}).length === 0);

  const daytime = {
    entityKind: "event",
    proposedType: "fleaMarket",
    proposedTitle: "Eastern Market Flea",
    genres: ["Market"],
    proposedAddress: "225 7th St SE",
    city: "Washington",
    country: "United States",
    proposedDate: "2026-12-20",
    proposedTime: "09:00",
    telephone: "+12025550100"
  };
  assert.deepEqual(gates.missingDatapoints(daytime), []);
  assert.ok(!gates.missingDatapoints(daytime).includes("DJ(s)/Artist(s)"));

  const beach = {
    entityKind: "venue",
    proposedType: "beachClub",
    proposedTitle: "Nikki Beach",
    genres: ["House"],
    proposedAddress: "Larvotto",
    city: "Monaco",
    country: "Monaco",
    email: "hello@nikkibeach.com"
  };
  assert.ok(gates.missingDatapoints(beach).includes("DJ(s)/Artist(s)"));
});

test("import and export CSV share one template", () => {
  const csv = gates.sampleDiscoveryCsv();
  const parsed = gates.parseDiscoveryCsv(csv);
  assert.equal(parsed.templateMatch, true);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].entityKind, "venue");
  assert.equal(parsed.records[1].entityKind, "event");
  const roundTrip = gates.parseDiscoveryCsv(gates.serializeDiscoveryCsv(parsed.records));
  assert.equal(roundTrip.records[0].proposedTitle, parsed.records[0].proposedTitle);
  assert.equal(roundTrip.headers.join(","), gates.csvHeaderRow());
});

test("publishBlockers flags duplicates and past events", () => {
  const dup = gates.publishBlockers({
    entityKind: "venue",
    proposedType: "nightclub",
    proposedTitle: "Jimmy'z",
    genres: ["Hip Hop"],
    artistsOrDjs: ["Resident DJs"],
    proposedAddress: "26 Avenue Princesse Grace",
    city: "Monte Carlo",
    country: "Monaco",
    telephone: "+37798067000",
    duplicateFlag: true,
    crawlScope: "full-new-listing",
    duplicateMatch: {matchName: "Jimmy'z Monte-Carlo"}
  });
  assert.equal(dup.ok, false);
  assert.equal(dup.duplicateBlocks, true);
  const past = gates.publishBlockers({
    entityKind: "event",
    proposedType: "comedyShow",
    proposedTitle: "Old Comedy Night",
    genres: ["Comedy"],
    artistsOrDjs: ["Comics"],
    proposedAddress: "1 Rue",
    city: "Paris",
    country: "France",
    proposedDate: "2020-01-01",
    proposedTime: "21:00",
    email: "a@b.com",
    lifecycleStatus: "past"
  });
  assert.equal(past.ok, false);
  assert.equal(past.pastEvent, true);
});
