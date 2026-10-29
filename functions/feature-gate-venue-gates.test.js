"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const helpers = require("./feature-gate-functions").__featureGateHelpers;
const {normalizeVenueGates, DEFAULT_VENUE_GATES} = helpers;

const CLIENT_SRC = fs.readFileSync(path.join(__dirname, "..", "feature-gates.js"), "utf8");

function loadClientGates() {
  const sandbox = {
    console,
    Object,
    Array,
    String,
    Map,
    Math,
    JSON,
    Date,
    Number,
    Boolean
  };
  sandbox.window = sandbox;
  sandbox.root = sandbox;
  sandbox.SHOUTOUT_SUPER_ADMIN_EMAILS = ["bans.don@gmail.com"];
  sandbox.SHOUTOUT_MASTER_ADMIN_EMAILS = ["bans.don@gmail.com"];
  vm.runInNewContext(CLIENT_SRC, sandbox);
  return sandbox.FLOQRFeatureGates;
}

assert.deepEqual(
  Object.keys(DEFAULT_VENUE_GATES).sort(),
  ["bartrStores", "floqCast", "passes", "shoutOut", "uberAds", "vipReservations", "windowAds"]
);
assert.equal(DEFAULT_VENUE_GATES.vipReservations, false);
assert.equal(DEFAULT_VENUE_GATES.passes, false);
assert.equal(DEFAULT_VENUE_GATES.shoutOut, true);

const client = loadClientGates();
assert.ok(client, "client FLOQRFeatureGates missing");
assert.deepEqual(
  Object.keys(client.DEFAULT_VENUE_GATES).sort(),
  Object.keys(DEFAULT_VENUE_GATES).sort(),
  "client/server venue gate keys must match"
);
assert.equal(client.DEFAULT_VENUE_GATES.vipReservations, false);
assert.equal(client.DEFAULT_VENUE_GATES.passes, false);

const withVip = normalizeVenueGates({
  uberAds: true,
  windowAds: false,
  bartrStores: false,
  shoutOut: true,
  floqCast: true,
  vipReservations: true,
  passes: true
});
assert.equal(withVip.vipReservations, true, "VIP tick must survive server normalize");
assert.equal(withVip.passes, true, "Passes tick must survive server normalize");
assert.equal(withVip.windowAds, false);
assert.equal(withVip.shoutOut, true);

const strippedLegacyPayload = normalizeVenueGates({
  uberAds: false,
  windowAds: false,
  bartrStores: false,
  shoutOut: true,
  floqCast: true
  // vipReservations intentionally omitted — older clients
});
assert.equal(strippedLegacyPayload.vipReservations, false, "missing VIP stays opt-in false");
assert.equal(strippedLegacyPayload.passes, false);
assert.equal(strippedLegacyPayload.shoutOut, true);

const clientNorm = client.normalizeVenueGates({
  featureGates: {
    shoutOut: true,
    floqCast: true,
    vipReservations: true,
    passes: true
  }
});
assert.equal(clientNorm.vipReservations, true);
assert.equal(clientNorm.passes, true);

console.log("feature-gate-venue-gates.test.js: ok");
