"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const auto = require("./discovery-auto-approve");
const crawl = require("./discovery-crawl-core");
const past = require("./discovery-past-events");

test("processCrawledItem routes incomplete venue to ADMIN_QUEUE", () => {
  const decision = auto.processCrawledItem({
    proposedType: "nightclub",
    proposedTitle: "Short",
    city: "Paris",
    country: "France"
  });
  assert.equal(decision.route, "ADMIN_QUEUE");
  assert.ok(decision.failures.length);
});

test("processCrawledItem AUTO_PUBLISH when schema + score clear threshold", () => {
  const future = new Date(Date.now() + 7 * 86400000).toISOString();
  const decision = auto.processCrawledItem({
    proposedType: "event",
    entityKind: "event",
    placesId: "ChIJ_test_place_123",
    parentPlacesId: "ChIJ_test_place_123",
    proposedTitle: "Saturday Hip Hop Night at Gate Club",
    proposedDescription: "A full night of hip hop with resident DJs and guest performers on the main floor and rooftop. Doors at ten. Tickets available online.",
    eventStartIso: future,
    proposedDate: future.slice(0, 10),
    proposedTime: "22:00",
    latitude: 48.8566,
    longitude: 2.3522,
    email: "bookings@gateclubparis.com",
    telephone: "+33123456789",
    phone: "+33123456789",
    instagramHandle: "gateclubparis",
    socialMediaHandles: {instagram: "gateclubparis"},
    ticketUrl: "https://www.ticketmaster.com/event/example",
    extractedImages: ["https://cdn.example.com/flyer.jpg"],
    agePolicy: "21+",
    officialWebsite: "https://www.gateclubparis.com",
    sourceConfirmations: {googlePlaces: true, jsonLdEvent: true},
    sourceName: "Google Places API",
    city: "Paris",
    country: "France"
  });
  assert.equal(decision.route, "AUTO_PUBLISH", decision.reason + " :: " + decision.failures.join(","));
  assert.ok(decision.confidence >= 0.92);
  assert.equal(decision.sanitized.instagramHandle, "gateclubparis");
  assert.ok(decision.sanitized.eventIdentityHash);
});

test("reject past event start ISO for auto-publish", () => {
  const decision = auto.processCrawledItem({
    proposedType: "comedyShow",
    placesId: "ChIJ_x",
    proposedTitle: "Comedy Night Downtown Paris Show",
    proposedDescription: "Stand-up comedy with three featured comics in an intimate lounge setting for an evening of laughs.",
    eventStartIso: "2020-01-01T20:00:00.000Z",
    latitude: 48.85,
    longitude: 2.35,
    email: "comedy@venueparis.com",
    telephone: "+33111222333",
    instagramHandle: "venueparis",
    ticketUrl: "https://www.eventbrite.com/e/example",
    agePolicy: "18+",
    officialWebsite: "https://venueparis.com",
    sourceConfirmations: {googlePlaces: true}
  });
  assert.equal(decision.route, "ADMIN_QUEUE");
  assert.ok(decision.failures.includes("start_iso_not_future"));
});

test("placesId and event hashes are deterministic", () => {
  const a = crawl.placesDocId("places/ChIJ123");
  const b = crawl.placesDocId("ChIJ123");
  assert.equal(a, b);
  const e1 = crawl.eventDocId({placesId: "ChIJ123", startIso: "2026-11-01T20:00:00.000Z", title: "Fall Festival"});
  const e2 = crawl.eventDocId({placesId: "ChIJ123", startIso: "2026-11-01T20:00:00.000Z", title: "Fall Festival"});
  const e3 = crawl.eventDocId({placesId: "ChIJ123", startIso: "2026-11-02T20:00:00.000Z", title: "Fall Festival"});
  assert.equal(e1, e2);
  assert.notEqual(e1, e3);
});

test("JSON-LD Event extraction maps ticket and performers", () => {
  const html = `
    <script type="application/ld+json">
    {
      "@context":"https://schema.org",
      "@type":"MusicEvent",
      "name":"Flea and Fall Festival Night",
      "startDate":"2030-10-12T14:00:00-04:00",
      "description":"Daytime flea market and fall festival with live DJs and makers across the lawn.",
      "performer":[{"@type":"Person","name":"DJ Nova"}],
      "organizer":{"@type":"Organization","name":"The Parks DC"},
      "offers":{"@type":"Offer","url":"https://posh.vip/e/flea-fall"}
    }
    </script>`;
  const events = crawl.extractJsonLdEventsFromHtml(html);
  assert.equal(events.length, 1);
  assert.equal(events[0].proposedTitle, "Flea and Fall Festival Night");
  assert.equal(events[0].ticketUrl, "https://posh.vip/e/flea-fall");
  assert.deepEqual(events[0].artistsOrDjs, ["DJ Nova"]);
  assert.ok(events[0].eventStartIso);
  assert.equal(events[0].crawlerDateSource, "schema.org JSON-LD Event.startDate");
});

test("past event lifecycle classification", () => {
  assert.equal(past.classifyLifecycle({eventStartIso: "2020-01-01T00:00:00.000Z"}), "past");
  assert.equal(past.classifyLifecycle({eventStartIso: "2099-01-01T00:00:00.000Z"}), "upcoming");
  assert.equal(past.classifyLifecycle({lifecycleStatus: "retired", eventStartIso: "2020-01-01T00:00:00.000Z"}), "retired");
});

test("mapPool runs with bounded concurrency", async () => {
  let active = 0;
  let maxActive = 0;
  const items = [1, 2, 3, 4, 5, 6];
  const out = await crawl.mapPool(items, 2, async n => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await crawl.sleep(20);
    active -= 1;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12]);
  assert.ok(maxActive <= 2);
});
