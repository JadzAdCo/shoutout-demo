"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = relativePath => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("client logger persists structured appLogs events", () => {
  const logger = read("floqr-logger.js");
  assert.match(logger, /window\.FLOQRLog/);
  assert.match(logger, /collection\("appLogs"\)/);
  assert.match(logger, /correlationId/);
  assert.match(logger, /fromError/);
});

test("master admin logging tab can inspect logs and clear unpaid checkouts", () => {
  const html = read("master-admin.html");
  const extension = read("master-logging-extension.js");
  assert.match(html, /data-panel="appLogging"/);
  assert.match(html, /id="appLogging"/);
  assert.match(html, /master-logging-extension\.js\?v=\d+\.\d+\.\d+/);
  assert.match(html, /floqr-logger\.js\?v=\d+\.\d+\.\d+/);
  assert.match(extension, /do not require club Stripe Connect/);
  assert.match(extension, /getClubCheckoutReadiness/);
  assert.match(extension, /zebbies-garden-washington-dc/);
  assert.match(extension, /clearUnpaidCheckouts/);
  assert.match(extension, /purgeTestPayments/);
  assert.match(html, /id="purgeTestPaymentsLoggingBtn"/);
  assert.match(html, /id="purgeTestPaymentsReconBtn"/);
  assert.match(html, /isTestPayment/);
});

test("paid shoutout submit checks club checkout readiness before media upload", () => {
  const app = read("patron-app.js");
  assert.doesNotMatch(app, /getClubCheckoutReadiness/);
  assert.match(app, /submit_failed/);
  assert.match(app, /priceCents > 0/);
  assert.match(app, /floqr-platform/);
});

test("commerce functions expose readiness and unpaid checkout cleanup", () => {
  const commerce = read("functions/commerce-functions.js");
  assert.match(commerce, /exports\.getFloqrClubCheckoutReadiness/);
  assert.match(commerce, /exports\.cancelFloqrCheckoutOrder/);
  assert.match(commerce, /exports\.clearUnpaidFloqrCheckouts/);
  assert.match(commerce, /exports\.purgeFloqrTestPayments/);
  assert.match(commerce, /function testPaymentFields/);
  assert.match(commerce, /isTestPayment/);
  assert.match(commerce, /testPaymentMarker:isTestPayment \? "stripe-test"/);
  assert.match(commerce, /writeAppLog/);
  assert.match(commerce, /SHOUTOUT_CHECKOUT_EXPIRY_SECONDS/);
  assert.match(commerce, /status:"checkout-cancelled"/);
});

test("firestore rules allow signed-in create and master read of appLogs", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/appLogs\/\{id\}/);
  assert.match(rules, /allow read: if isMasterAdmin\(\)/);
  assert.match(rules, /request\.resource\.data\.uid == request\.auth\.uid/);
  assert.match(rules, /match \/paymentLedger\/\{id\}/);
  assert.match(rules, /validFreePatronShoutoutCreate/);
  assert.match(rules, /template != 'zebbiesFootballTeamIntro'/);
});
