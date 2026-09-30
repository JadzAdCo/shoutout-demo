/**
 * Location-aware search order: GPS → IP → profile city; nearest first, then name.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const Geo = require(path.join(root, "floqr-geo-search.js"));

const DC = {latitude: 38.9072, longitude: -77.0369};
const venues = [
  {name: "Zeta Lounge", city: "Washington"},
  {name: "Alpha Club", city: "Washington"},
  {name: "Brooklyn Mirage", city: "Brooklyn"},
  {name: "Sky Monaco", city: "Monaco"},
  {name: "Geocoded Club", city: "Somewhere New", latitude: 38.95, longitude: -77.1},
  {name: "No City Club"}
];

function memoryStorage() {
  const map = new Map();
  return {getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k)};
}

test("nearest first, same city ties go A→Z, unknown coordinates last", () => {
  const order = Geo.sortNearest(venues, DC, {nameOf: v => v.name}).map(e => e.item.name);
  assert.deepEqual(order.slice(0, 3), ["Alpha Club", "Zeta Lounge", "Geocoded Club"]);
  assert.equal(order[3], "Brooklyn Mirage");
  assert.equal(order[4], "Sky Monaco");
  assert.equal(order[5], "No City Club");
});

test("stored Google coordinates beat the city table, so new cities need no code", () => {
  const coords = Geo.recordCoordinates({city: "Somewhere New", latitude: "38.95", longitude: "-77.1"});
  assert.deepEqual(coords, {latitude: 38.95, longitude: -77.1});
  assert.deepEqual(Geo.recordCoordinates({geo: {latitude: 1.5, longitude: 2.5}}), {latitude: 1.5, longitude: 2.5});
  assert.equal(Geo.recordCoordinates({city: "Nowhere Town"}), null);
});

test("without a user location the list is alphabetical", () => {
  const order = Geo.sortNearest(venues, null, {nameOf: v => v.name}).map(e => e.item.name);
  assert.deepEqual(order, ["Alpha Club", "Brooklyn Mirage", "Geocoded Club", "No City Club", "Sky Monaco", "Zeta Lounge"]);
});

test("Clubs in Monaco: filtered list still orders closest to the user, then by name", () => {
  const monaco = [{name: "Twiga", city: "Monaco"}, {name: "Jimmyz", city: "Monaco"}, {name: "Nice Beach", city: "Nice"}];
  const fromParis = {latitude: 48.8566, longitude: 2.3522};
  assert.deepEqual(Geo.sortNearest(monaco, fromParis, {nameOf: v => v.name}).map(e => e.item.name), ["Nice Beach", "Jimmyz", "Twiga"]);
});

test("sortNearest does not mutate the input", () => {
  const copy = venues.slice();
  Geo.sortNearest(venues, DC, {nameOf: v => v.name});
  assert.deepEqual(venues, copy);
});

test("GPS wins when allowed", async () => {
  Geo.resetCache();
  const geolocation = {getCurrentPosition: ok => ok({coords: {latitude: 38.9, longitude: -77.03, accuracy: 20}})};
  const loc = await Geo.resolveUserLocation({geolocation, fetch: () => { throw new Error("IP must not be called"); }, storage: memoryStorage()});
  assert.equal(loc.source, "gps");
  assert.equal(loc.city, "Washington");
});

test("denied GPS falls back to IP estimate without storing the IP address", async () => {
  Geo.resetCache();
  const storage = memoryStorage();
  const geolocation = {getCurrentPosition: (ok, fail) => fail({code: 1})};
  let calls = 0;
  const fetch = async url => {
    calls += 1;
    assert.equal(url, Geo.DEFAULT_IP_PROVIDER);
    return {ok: true, json: async () => ({ip: "203.0.113.9", latitude: "43.7384", longitude: "7.4246", city: "Monaco", country: "Monaco"})};
  };
  const loc = await Geo.resolveUserLocation({geolocation, fetch, storage});
  assert.equal(loc.source, "ip");
  assert.equal(loc.city, "Monaco");
  assert.ok(!storage.getItem("floqr.ipLocation.v1").includes("203.0.113.9"));
  await Geo.resolveUserLocation({geolocation, fetch, storage});
  assert.equal(calls, 1, "IP estimate is cached for the session");
});

test("no GPS and no IP falls back to the profile city, then unknown", async () => {
  Geo.resetCache();
  const opts = {geolocation: null, fetch: async () => ({ok: false}), storage: memoryStorage()};
  assert.equal((await Geo.resolveUserLocation({...opts, profile: {city: "Barcelona"}})).source, "profile");
  assert.equal((await Geo.resolveUserLocation(opts)).source, "unknown");
});

test("slow GPS permission resolves to IP now and reports the late fix", async () => {
  Geo.resetCache();
  let grant;
  const geolocation = {getCurrentPosition: ok => { grant = ok; }};
  const fetch = async () => ({ok: true, json: async () => ({latitude: 25.76, longitude: -80.19, city: "Miami"})});
  let late = null;
  const loc = await Geo.resolveUserLocation({geolocation, fetch, storage: memoryStorage(), gpsWaitMs: 10, onLateGps: c => { late = c; }});
  assert.equal(loc.source, "ip");
  grant({coords: {latitude: 38.9, longitude: -77.03}});
  assert.equal(late.latitude, 38.9);
  Geo.resetCache();
});

test("IP provider can be disabled", async () => {
  Geo.resetCache();
  const loc = await Geo.resolveUserLocation({geolocation: null, ipProviderUrl: false, fetch: () => { throw new Error("no"); }, storage: memoryStorage()});
  assert.equal(loc.source, "unknown");
});

test("index loads floqr-geo-search before ai-location-service and patron-app", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /floqr-geo-search\.js\?v=s3\.0\.106/);
  assert.ok(html.indexOf("floqr-geo-search.js") < html.indexOf("ai-location-service.js"));
  assert.ok(html.indexOf("floqr-geo-search.js") < html.indexOf("patron-app.js"));
  assert.match(html, /data-floqr-help-id="help-location-search"/);
});

test("patron listings sort nearest first and re-sort when GPS arrives late", () => {
  const src = fs.readFileSync(path.join(root, "patron-app.js"), "utf8");
  assert.match(src, /function sortListingNearest/);
  assert.match(src, /floqr:location-updated/);
  assert.match(src, /cat\.floqaiNearYou/);
});
