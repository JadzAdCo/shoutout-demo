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
  assert.match(displayApp, /FLOQR ShoutOut/);
  assert.match(displayApp, /classic-bw-identity/);
  assert.match(displayCss, /classicIdentityShellBurst 20s/);
  assert.match(displayCss, /classicIdentityParticle 20s/);
  assert.match(indexHtml, /placeholder="Enter ShoutOut Here"/);
  assert.match(displayApp, /heistIdleTemplate \|\| "blackwhite"/);
  // Idle boards must not flash the legacy USE SHOUTOUT CTA.
  assert.match(displayApp, /stripLegacyUseShoutOutCta/);
  assert.match(displayApp, /markDisplayReady/);
  assert.doesNotMatch(displayApp, /return `USE ShoutOut @ \$\{clubName\}`/);
  assert.match(adminApp, /template: "blackwhite"/);
  assert.match(adminApp, /displayDurationSeconds: 600/);
  assert.match(displayApp, /renderTimedLiveContent/);
  assert.match(displayApp, /DEFAULT_LIVE_SHOUTOUT_SECONDS = 10 \* 60/);
  assert.match(backend, /exports\.expireLiveShoutouts = onSchedule/);
  assert.match(backend, /automaticTenMinuteReset/);
  assert.match(backend, /Idle boards stay blank/);
});

test("Soccer jersey mark accepts any 2 characters", () => {
  assert.match(sharedData, /soccerMorocco/);
  assert.match(sharedData, /maxSubCharacters:2/);
  assert.match(sharedData, /jerseyNumberMaxChars:2/);
  assert.match(displayApp, /isSoccerJerseyTemplate/);
  assert.match(displayApp, /glyphSlice\(String\(data\.subText/);
  assert.match(backend, /SOCCER_JERSEY_TEMPLATE_IDS/);
  assert.match(backend, /Array\.from\(String\(rawShoutout\.subText/);
});

test("Heist identity rail cycles optional handle then brand lines for 3s each", () => {
  assert.match(displayApp, /renderHeistIdentityRail/);
  assert.match(displayApp, /Caught in a HEIST/);
  assert.match(displayApp, /Powered by FloqR Social OS/);
  assert.match(displayApp, /kicker: "FROM"/);
  assert.match(displayApp, /scheduleHeistMessageThenBrandSlide/);
  assert.match(displayApp, /showHeistBrandSlide/);
  assert.match(displayApp, /HEIST_MESSAGE_SECONDS = 20/);
  assert.match(displayCss, /heistIdentityShellBurst 3s/);
  assert.match(displayCss, /heist-brand-slide/);
  assert.match(sharedData, /identityAnimationSeconds:3/);
  assert.match(sharedData, /messageDurationSeconds:20/);
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
      if (rule.profileId === "soccerJersey") {
        assert.ok(rule.mainTextSizePercent >= 6 && rule.mainTextSizePercent <= 12, `${template.id} soccer name size`);
        assert.ok(rule.subTextSizePercent >= 20 && rule.subTextSizePercent <= 36, `${template.id} soccer mark size`);
        assert.equal(rule.sub, 2, `${template.id} soccer mark must be exactly 2 characters`);
      } else {
        assert.equal(rule.mainTextSizePercent, 20.8);
        assert.equal(rule.subTextSizePercent, 7.8);
      }
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
