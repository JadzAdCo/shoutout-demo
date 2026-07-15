"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(__dirname, "commerce-functions.js"), "utf8");
const commerceClient = fs.readFileSync(path.join(root, "commerce-app.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const adminApp = fs.readFileSync(path.join(root, "admin-app.js"), "utf8");
const patronHtml = fs.readFileSync(path.join(root, "patron-portal.html"), "utf8");
const patronApp = fs.readFileSync(path.join(root, "patron-app.js"), "utf8");
const sharedData = fs.readFileSync(path.join(root, "shared-data.js"), "utf8");
const displayApp = fs.readFileSync(path.join(root, "display-app.js"), "utf8");
const displayCss = fs.readFileSync(path.join(root, "display.css"), "utf8");

test("Checkout keeps dynamic payment methods and trusted Accounts v2 recipients", () => {
  assert.doesNotMatch(backend, /payment_method_types/);
  assert.match(backend, /v2\.core\.accounts\.retrieve/);
  assert.match(backend, /trustedConnectRecipient/);
  assert.match(backend, /application_fee_amount = summary\.floqrShareCents/);
  assert.match(backend, /assignment\.data\(\)\?\.status, 40\)\.toLowerCase\(\) === "active"/);
});

test("Commerce inventory is reserved before Checkout and released safely", () => {
  assert.match(backend, /createOrderWithInventoryReservation/);
  assert.match(backend, /inventoryReservationStatus:"held"/);
  assert.match(backend, /params\.expires_at/);
  assert.match(backend, /releaseCommerceInventoryReservation\(orderId, "checkout-session-expired"\)/);
  assert.match(backend, /inventoryReservationStatus:"committed"/);
});

test("refund and dispute webhook events create operational review state", () => {
  assert.match(backend, /charge\.refunded/);
  assert.match(backend, /charge\.dispute\.created/);
  assert.match(backend, /charge\.dispute\.closed/);
  assert.match(backend, /manual-transfer-reversal-review/);
});

test("browser code cannot supply connected-account IDs", () => {
  assert.doesNotMatch(commerceClient, /stripeConnectAccountId/);
  assert.doesNotMatch(adminHtml, /id="clubStripeConnectAccountId"/);
  assert.doesNotMatch(patronHtml, /id="editStripeConnectAccountId"/);
});

test("Zebbies football intro is four-photo, 20-second, and server-priced at 30 dollars", () => {
  assert.match(sharedData, /zebbiesFootballTeamIntro/);
  assert.match(sharedData, /teamMemberSlots:4/);
  assert.match(sharedData, /durationSeconds:20/);
  assert.match(sharedData, /"p125-96x48"[\s\S]*pixelWidth:768, pixelHeight:384/);
  assert.match(patronApp, /uploadFootballTeamMembers/);
  assert.match(patronApp, /footballTeamMessage/);
  assert.match(patronApp, /photoPermissionConfirmed:true/);
  assert.match(displayApp, /renderFootballTeamIntro/);
  assert.match(displayApp, /footballStadiumMessageRows/);
  assert.match(displayCss, /footballFinalLineup 20s linear infinite/);
  assert.match(backend, /const amountCents = footballTeamIntro \|\| video \? 3000 : 2000/);
  assert.match(backend, /normalizeFootballTeamMembers/);
  assert.match(backend, /members\.length !== 4/);
});

test("Traditional Black and White keeps a global fixed identity rail", () => {
  assert.match(sharedData, /blackwhite:[\s\S]*identityRail:true/);
  assert.match(sharedData, /identityAnimation:'burst-away'/);
  assert.match(sharedData, /maxSubCharacters:20/);
  assert.match(displayApp, /classicIdentityPresentation/);
  assert.match(displayApp, /FLOQR SHOUTOUT/);
  assert.match(displayApp, /classic-bw-identity/);
  assert.match(displayCss, /classicIdentityShellBurst 20s/);
  assert.match(displayCss, /classicIdentityParticle 20s/);
  assert.match(indexHtml, /placeholder="Enter ShoutOut Here"/);
  assert.match(displayApp, /template:"blackwhite"/);
  assert.match(displayApp, /USE SHOUTOUT @/);
  assert.match(adminApp, /template: "blackwhite"/);
  assert.match(adminApp, /displayDurationSeconds: 600/);
  assert.match(displayApp, /renderTimedLiveContent/);
  assert.match(displayApp, /DEFAULT_LIVE_SHOUTOUT_SECONDS = 10 \* 60/);
  assert.match(backend, /exports\.expireLiveShoutouts = onSchedule/);
  assert.match(backend, /automaticTenMinuteReset/);
});
