/**
 * Display load-error venue mismatch helpers + wiring (s3.1.109).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  pickVenueMismatch,
  DISPLAY_MISMATCH_LOOKBACK_MS,
  DISPLAY_LOAD_ERROR_NOTIFY_COOLDOWN_MS
} = require("./display-security-functions").__displaySecurityHelpers;

test("pickVenueMismatch returns first different allowed venue", () => {
  const hit = pickVenueMismatch("heist-washington-dc", [
    {locationId: "heist-washington-dc", allowed: true, displayBoard: "secondary"},
    {
      locationId: "temp-democlub-1",
      locationName: "Aurelia (Demo Club)",
      allowed: true,
      displayBoard: "secondary",
      pageUrl: "https://jadzadco.github.io/shoutout-demo/display2.html?location=temp-democlub-1",
      createdAtMs: 1792642894377
    }
  ]);
  assert.equal(hit.recentLocationId, "temp-democlub-1");
  assert.equal(hit.recentLocationName, "Aurelia (Demo Club)");
  assert.match(hit.recentPageUrl, /display2\.html/);
});

test("pickVenueMismatch ignores same venue, probes, and denied rows", () => {
  assert.equal(pickVenueMismatch("temp-democlub-1", [
    {locationId: "temp-democlub-1", allowed: true, displayBoard: "secondary"},
    {locationId: "heist-washington-dc", allowed: false, displayBoard: "primary"},
    {locationId: "other-club", allowed: true, displayBoard: "master-admin"}
  ]), null);
  assert.equal(pickVenueMismatch("", [{locationId: "temp-democlub-1", allowed: true}]), null);
  assert.equal(pickVenueMismatch("temp-democlub-1", []), null);
});

test("mismatch lookback and load-error cooldown constants are set", () => {
  assert.equal(DISPLAY_MISMATCH_LOOKBACK_MS, 2 * 60 * 60 * 1000);
  assert.equal(DISPLAY_LOAD_ERROR_NOTIFY_COOLDOWN_MS, 15 * 60 * 1000);
});

test("reportDisplayLoadError wires mismatch lookback + Master Admin notify", () => {
  const src = fs.readFileSync(path.join(__dirname, "display-security-functions.js"), "utf8");
  assert.match(src, /function pickVenueMismatch/);
  assert.match(src, /function notifyMasterAdminsDisplayLoadError/);
  assert.match(src, /loadRecentAllowedAccessForClient/);
  assert.match(src, /displayVenueMismatch/);
  assert.match(src, /displayLoadError/);
  assert.match(src, /displayLoadErrorAlerts/);
  assert.match(src, /action: mismatch \? "display_venue_mismatch"/);
  const ui = fs.readFileSync(path.join(__dirname, "..", "master-display-security.js"), "utf8");
  assert.match(ui, /displayVenueMismatch/);
  assert.match(ui, /displayLoadError/);
});
