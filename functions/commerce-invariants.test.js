"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(__dirname, "commerce-functions.js"), "utf8");
const commerceClient = fs.readFileSync(path.join(root, "commerce-app.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const adminApp = fs.readFileSync(path.join(root, "admin-app.js"), "utf8");
const patronHtml = fs.readFileSync(path.join(root, "patron-portal.html"), "utf8");
const patronApp = fs.readFileSync(path.join(root, "patron-app.js"), "utf8");
const patronPortalApp = fs.readFileSync(path.join(root, "patron-portal-app.js"), "utf8");
const sharedData = fs.readFileSync(path.join(root, "shared-data.js"), "utf8");
const displayApp = fs.readFileSync(path.join(root, "display-app.js"), "utf8");
const displayCss = fs.readFileSync(path.join(root, "display.css"), "utf8");
const floqrIdentity = fs.readFileSync(path.join(root, "floqr-identity.js"), "utf8");

test("Checkout keeps dynamic payment methods and trusted Accounts v2 recipients", () => {
  assert.doesNotMatch(backend, /payment_method_types/);
  assert.match(backend, /v2\.core\.accounts\.retrieve/);
  assert.match(backend, /trustedConnectRecipient/);
  assert.match(backend, /paymentModel:"floqr-platform"/);
  assert.match(backend, /SHOUTOUT_CLUB_SHARE_PERCENT = 20/);
  assert.match(backend, /This ShoutOut template does not require checkout/);
  assert.match(backend, /type !== "shoutout"/);
  assert.match(backend, /assignment\.data\(\)\?\.status, 40\)\.toLowerCase\(\) === "active"/);
  assert.match(backend, /function testPaymentFields/);
  assert.match(backend, /exports\.purgeFloqrTestPayments/);
  assert.match(backend, /isTestPayment/);
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
  assert.match(sharedData, /name:'Football Intro'/);
  assert.match(sharedData, /teamMemberSlots:4/);
  assert.match(sharedData, /durationSeconds:20/);
  assert.match(sharedData, /"p125-96x48"[\s\S]*pixelWidth:768, pixelHeight:384/);
  assert.match(sharedData, /"p125-64x32"[\s\S]*supported:true[\s\S]*skipFinaleLineup:true/);
  assert.match(patronApp, /uploadFootballTeamMembers/);
  assert.match(patronApp, /footballTeamMessage/);
  assert.match(patronApp, /football-portrait-motion/);
  assert.match(patronApp, /5000/);
  assert.match(patronApp, /photoPermissionConfirmed:true/);
  assert.match(patronApp, /serviceRole/);
  assert.match(patronApp, /profileMatchScore/);
  assert.match(displayApp, /renderFootballTeamIntro/);
  assert.match(displayApp, /footballStadiumMessageRows/);
  assert.match(displayApp, /football-skip-finale/);
  assert.match(displayCss, /football-skip-finale/);
  assert.match(displayCss, /footballStadiumMessageCompact/);
  assert.match(floqrIdentity, /resolvePlayerIdentityLabel/);
  assert.match(backend, /const pricedAmountCents = footballTeamIntro/);
  assert.match(backend, /normalizeFootballTeamMembers/);
  assert.match(backend, /Football Intro ShoutOut/);
  assert.match(backend, /members\.length !== 4/);
  assert.match(patronApp, /priceCents > 0/);
  assert.match(patronApp, /Continue to \$30 FloqR Checkout/);
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

test("all published templates have display-aware text contracts", () => {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(sharedData, sandbox, {filename:"shared-data.js"});
  const templates = Object.values(sandbox.SHOUTOUT_TEMPLATES || {});
  const formats = Object.keys(sandbox.FLOQR_DISPLAY_FORMATS || {});
  assert.ok(templates.length >= 30, `expected >= 30 templates, got ${templates.length}`);
  assert.equal(formats.length, 6);
  templates.forEach(template => {
    const rules = formats.map(formatId => sandbox.FLOQRTextLayout.resolve(template, formatId));
    assert.ok(rules.some(rule => rule.supported), `${template.id} must support at least one display`);
    rules.filter(rule => rule.supported).forEach(rule => {
      assert.equal(rule.mainTextSizePercent, 20.8);
      assert.equal(rule.subTextSizePercent, 7.8);
      assert.equal(rule.main, rule.lineCount * rule.perLine);
      // led-64x32 uses the Heist-era 30/10 board floor (28px); larger panels stay >= 34.
      assert.ok(rule.minimumFontPixels >= 28, `${template.id} minimumFontPixels ${rule.minimumFontPixels}`);
    });
  });
  assert.equal(sandbox.FLOQRTextLayout.resolve("birthdayMedia", "led-64x32").supported, false);
  assert.equal(sandbox.FLOQRTextLayout.resolve("zebbiesFootballTeamIntro", "p125-64x32").supported, true);
  assert.equal(sandbox.FLOQRTextLayout.resolve("zebbiesFootballTeamIntro", "p125-64x32").skipFinaleLineup, true);
  assert.equal(sandbox.FLOQRTextLayout.resolve("blackwhite", "p125-96x48").main, 45);
  assert.equal(sandbox.FLOQRTextLayout.resolve("blackwhite", "led-64x32").main, 30);
  assert.match(patronApp, /recommendations use the same limits/);
  assert.match(patronPortalApp, /portalShoutoutTextCaps/);
  assert.match(adminApp, /adminShoutoutTextCaps/);
  assert.match(displayApp, /FLOQRTextLayout/);
  assert.match(backend, /checkoutTextCaps/);
  assert.match(backend, /fitCheckoutDisplayText/);
});
