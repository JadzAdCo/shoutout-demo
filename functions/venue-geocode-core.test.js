/**
 * Venue geocoding: which clubLocations need Google coordinates, parsing, and loop safety.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const core = require("./venue-geocode-core");

test("geocode query prefers street address and appends missing city / country", () => {
  assert.equal(
    core.geocodeQuery({address: "1234 U St NW", city: "Washington", region: "District of Columbia", country: "United States"}),
    "1234 U St NW, Washington, District of Columbia, United States"
  );
  assert.equal(core.geocodeQuery({address: "Av. Princesse Grace, Monaco", city: "Monaco", country: "Monaco"}), "Av. Princesse Grace, Monaco");
  assert.equal(core.geocodeQuery({locationName: "Jimmyz", city: "Monaco", country: "Monaco"}), "Jimmyz, Monaco, Monaco");
  assert.equal(core.geocodeQuery({locationName: "No place"}), "");
});

test("new venues without coordinates need geocoding; geocoded ones do not", () => {
  const venue = {locationName: "Club X", city: "Accra", country: "Ghana"};
  assert.equal(core.needsGeocode(venue), true);
  const hit = {latitude: 5.6, longitude: -0.18, formattedAddress: "Accra", placeId: "abc"};
  const patched = {...venue, ...core.geoPatch(hit, core.geocodeSignature(venue), "google-places", "2026-09-30T00:00:00Z")};
  assert.equal(core.needsGeocode(patched), false, "our own write must not retrigger");
});

test("moving a venue re-geocodes; manual coordinates are respected", () => {
  const venue = {locationName: "Club X", city: "Accra", country: "Ghana"};
  const patched = {...venue, ...core.geoPatch({latitude: 5.6, longitude: -0.18}, core.geocodeSignature(venue), "google-places", "t")};
  assert.equal(core.needsGeocode({...patched, city: "Lagos", country: "Nigeria"}), true);
  assert.equal(core.needsGeocode({...venue, latitude: 1, longitude: 2, geoManual: true}), false);
  assert.equal(core.needsGeocode({...venue, latitude: 1, longitude: 2}), false, "coordinates without a signature are kept");
});

test("a Google miss is recorded once and not retried until the address changes", () => {
  const venue = {locationName: "Ghost Club", city: "Atlantis", country: "Sea"};
  const missed = {...venue, ...core.missPatch(core.geocodeSignature(venue), "t")};
  assert.equal(core.needsGeocode(missed), false);
  assert.equal(core.needsGeocode({...missed, city: "Atlanta", country: "United States"}), true);
});

test("parses Places (New) and Geocoding API responses; rejects junk", () => {
  assert.deepEqual(
    core.parsePlacesLocation({places: [{id: "p1", formattedAddress: "Monaco", location: {latitude: 43.74, longitude: 7.42}}]}),
    {latitude: 43.74, longitude: 7.42, formattedAddress: "Monaco", placeId: "p1"}
  );
  assert.equal(core.parsePlacesLocation({places: []}), null);
  assert.deepEqual(
    core.parseGeocodeApi({status: "OK", results: [{formatted_address: "Accra", place_id: "g1", geometry: {location: {lat: 5.6, lng: -0.19}}}]}),
    {latitude: 5.6, longitude: -0.19, formattedAddress: "Accra", placeId: "g1"}
  );
  assert.equal(core.parseGeocodeApi({status: "ZERO_RESULTS", results: []}), null);
  assert.equal(core.parsePlacesLocation({places: [{location: {latitude: 0, longitude: 0}}]}), null);
});

test("functions wire the trigger + backfill on the existing Places secret, no key in source", () => {
  const src = fs.readFileSync(path.join(__dirname, "venue-geocode-functions.js"), "utf8");
  assert.match(src, /onDocumentWritten\(\{\s*document: "clubLocations\/\{locationId\}"/);
  assert.match(src, /scheduledVenueGeocodeBackfill/);
  assert.match(src, /defineSecret\("GOOGLE_PLACES_API_KEY"\)/);
  assert.doesNotMatch(src, /AIza[0-9A-Za-z_-]{20,}/);
  const index = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert.match(index, /require\("\.\/venue-geocode-functions"\)/);
});
