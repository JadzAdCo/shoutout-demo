"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("ShoutOut trail logs button → choose venue → throw here → splash, not Search defaults", () => {
  const logger = read("floqr-logger.js");
  const patron = read("patron-app.js");
  const nav = read("floqr-nav.js");
  const searchJs = read("shoutout-search.js");
  const searchHtml = read("shoutout-search.html");
  const index = read("index.html");
  const payReturn = read("payment-return-app.js");

  assert.match(logger, /function startShoutoutTrail/);
  assert.match(logger, /function shoutoutPageCall/);
  assert.match(logger, /venueChosen/);
  assert.match(patron, /function isShoutoutDeepLink/);
  assert.match(patron, /beginNewShoutoutTrail/);
  assert.match(patron, /shoutoutButton/);
  assert.match(patron, /checkoutRedirect/);
  assert.match(patron, /shoutoutTemplateChosen/);
  assert.match(patron, /chosenShoutoutLocationId/);
  assert.doesNotMatch(patron, /SHOUTOUT_TRAIL_PAGES = new Set\(\[\s*"shoutoutLandingPage", "categoryPage"/);
  assert.match(patron, /if \(isShoutoutDeepLink\(\)\)/);
  assert.match(nav, /start === "shoutout"/);
  assert.match(nav, /shoutoutTrailId/);
  assert.match(searchJs, /shoutoutSearchPage/);
  assert.match(searchJs, /throwShoutoutHere/);
  assert.match(searchHtml, /floqr-logger\.js/);
  assert.doesNotMatch(index, /id="shoutoutLandingPage"/);
  assert.doesNotMatch(index, /id="startShoutoutFlowBtn"/);
  assert.match(payReturn, /paymentReturn/);
});

test("Throw a ShoutOut still opens shoutout-search, not leftover landing page", () => {
  const app = read("patron-app.js");
  const fn = app.slice(app.indexOf("async function showShoutoutLanding()"), app.indexOf("function normalizeTemplateQuery("));
  assert.doesNotMatch(fn, /showPage\("shoutoutLandingPage"\)/);
  assert.doesNotMatch(fn, /openCategory\("shoutout"\);/);
  assert.match(fn, /shoutout-search\.html|shoutoutHome/);
  assert.match(fn, /shoutoutButton/);
});
