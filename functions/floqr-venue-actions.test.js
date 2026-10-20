/**
 * Search listing Select must follow product intent (floqCast / VIP / ShoutOut), not always ShoutOut.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "floqr-venue-actions.js"), "utf8");

function load(extra = {}) {
  const sandbox = {console, module: {exports: {}}, exports: {}, window: null, ...extra};
  sandbox.window = sandbox;
  sandbox.root = sandbox;
  vm.runInNewContext(src, sandbox, {filename: "floqr-venue-actions.js"});
  return sandbox.FLOQRVenueActions || sandbox.module.exports;
}

test("floqCast query resolves to navigate CTA, not default Select/ShoutOut", () => {
  const VA = load();
  const hit = VA.resolve({query: "Floqcast to Aurelia", listingType: "all"});
  assert.equal(hit.id, "floqCast");
  assert.equal(hit.mode, "navigate");
  assert.match(hit.ctaFallback, /floqCast/i);
  const href = hit.buildUrl("temp-democlub-1");
  assert.match(href, /floqcast-search\.html/);
  assert.match(href, /location=temp-democlub-1/);
});

test("VIP table query resolves to vip.html with location", () => {
  const VA = load();
  const hit = VA.resolve({query: "book a VIP table at Decades", listingType: "clubs"});
  assert.equal(hit.id, "vipReservations");
  assert.equal(hit.mode, "navigate");
  assert.match(hit.buildUrl("decades-washington-dc"), /vip\.html/);
  assert.match(hit.buildUrl("decades-washington-dc"), /location=decades-washington-dc/);
});

test("plain club browse defaults to ShoutOut Select (backward compatible)", () => {
  const VA = load();
  const hit = VA.resolve({query: "Aurelia", listingType: "clubs"});
  assert.equal(hit.id, "shoutout");
  assert.equal(hit.mode, "shoutout");
  assert.equal(hit.defaulted, true);
});

test("listingType shoutout forces Throw ShoutOut Here", () => {
  const VA = load();
  const hit = VA.resolve({query: "floqcast", listingType: "shoutout"});
  assert.equal(hit.id, "shoutout");
  assert.equal(hit.mode, "shoutout");
  assert.equal(hit.ctaKey, "listing.throwShoutoutHere");
});

test("stripFeatureTokens leaves the venue name", () => {
  const VA = load();
  const stripped = VA.stripFeatureTokens("Floqcast to Aurelia");
  assert.match(stripped, /aurelia/);
  assert.doesNotMatch(stripped, /floqcast/);
});

test("feature gate deny falls back to Select/ShoutOut", () => {
  const VA = load({
    FLOQRFeatureServices: {
      searchVisible: (key) => key !== "floqCast"
    }
  });
  const hit = VA.resolve({query: "floqcast Aurelia", listingType: "all"});
  assert.equal(hit.id, "shoutout");
  assert.equal(hit.gated, "floqCast");
});

test("index.html loads floqr-venue-actions before patron-app", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /floqr-venue-actions\.js\?v=s3\.\d+\.\d+/);
  assert.ok(html.indexOf("floqr-venue-actions.js") < html.indexOf("patron-app.js"));
  assert.ok(html.indexOf("floqr-venue-query.js") < html.indexOf("floqr-venue-actions.js"));
});

test("patron-app uses FLOQRVenueActions for listing Select", () => {
  const js = fs.readFileSync(path.join(root, "patron-app.js"), "utf8");
  assert.match(js, /FLOQRVenueActions/);
  assert.match(js, /activateListingVenue/);
  assert.match(js, /listingVenueAction/);
  assert.doesNotMatch(
    js.slice(js.indexOf("async function renderLocationGrid"), js.indexOf("async function loadEventById")),
    /addEventListener\("click", \(\) => selectLocationForShoutOut\(id\)\)/
  );
});
