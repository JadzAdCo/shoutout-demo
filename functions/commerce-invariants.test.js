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
  // Idle classic board shows Use ShoutOut @ Clubname (club default verbiage).
  assert.match(displayApp, /clubDefaultMainText/);
  assert.match(displayApp, /Use ShoutOut @ \$\{clubName\}/);
  assert.match(displayApp, /markDisplayReady/);
  assert.match(adminApp, /template: "blackwhite"/);
  assert.match(adminApp, /displayDurationSeconds: 600/);
  assert.match(displayApp, /renderTimedLiveContent/);
  assert.match(displayApp, /DEFAULT_LIVE_SHOUTOUT_SECONDS = 10 \* 60/);
  assert.match(backend, /exports\.expireLiveShoutouts = onSchedule/);
  assert.match(backend, /automaticTenMinuteReset/);
});

test("Soccer jersey mark accepts any 2 characters", () => {
  const jerseyCatalog = fs.readFileSync(path.join(root, "jersey-catalog.js"), "utf8");
  assert.match(sharedData, /id:'soccerJersey'/);
  assert.match(sharedData, /requiresTeamSelect:true/);
  assert.match(sharedData, /maxSubCharacters:2/);
  assert.match(sharedData, /jerseyNumberMaxChars:2/);
  // Team ids are built as soccer${slug(name)} (e.g. Morocco → soccerMorocco).
  assert.match(jerseyCatalog, /id:\s*`soccer\$\{slug\(/);
  assert.match(jerseyCatalog, /Morocco:\s*"soccer-morocco-back\.png"/);
  assert.match(jerseyCatalog, /FLOQR_SOCCER_TEAMS/);
  assert.match(displayApp, /isSoccerJerseyTemplate/);
  assert.match(displayApp, /cleanJerseyMark/);
  assert.match(displayApp, /graphemes/);
  assert.match(backend, /SOCCER_JERSEY_TEMPLATE_IDS/);
  assert.match(backend, /isSportsJerseyTemplateId/);
  assert.match(backend, /soccerJersey/);
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

test("SMS and WhatsApp checkout fulfillment persist club subscription flags", () => {
  assert.match(backend, /smsSubscribed:true/);
  assert.match(backend, /whatsappSubscribed:true/);
  assert.match(backend, /orderType === "smsNotifications"/);
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
        assert.ok(rule.mainTextSizePercent >= 14 && rule.mainTextSizePercent <= 18, `${template.id} soccer name size`);
        assert.ok(rule.subTextSizePercent >= 50 && rule.subTextSizePercent <= 70, `${template.id} soccer mark size`);
        assert.equal(rule.sub, 2, `${template.id} soccer mark must be exactly 2 characters`);
        assert.ok(rule.main <= rule.lineCount * rule.perLine, `${template.id} soccer main ceiling`);
      } else {
        assert.equal(rule.mainTextSizePercent, 20.8);
        assert.equal(rule.subTextSizePercent, 7.8);
        assert.equal(rule.main, rule.lineCount * rule.perLine);
      }
      // led-64x32 uses the Heist-era 30/10 board floor (28px); larger panels stay >= 34.
      assert.ok(rule.minimumFontPixels >= 28, `${template.id} minimumFontPixels ${rule.minimumFontPixels}`);
    });
  });
  assert.equal(sandbox.FLOQRTextLayout.resolve("birthdayMedia", "led-64x32").supported, true);
  assert.equal(sandbox.FLOQRTextLayout.resolve("birthdayMedia", "led-64x32").lineCount, 3);
  assert.equal(sandbox.FLOQRTextLayout.resolve("birthdayMedia", "led-64x48").lineCount, 3);
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

test("screen datapoints are Firebase 0|1 flags and filter templates by venue overlap", () => {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(sharedData, sandbox, {filename:"shared-data.js"});
  const dp = sandbox.FLOQRScreenDatapoints;
  const birthday = dp.applyTemplate({...sandbox.SHOUTOUT_TEMPLATES.birthdayMedia});
  assert.equal(birthday.Is96x48, 1);
  assert.equal(birthday.Is64x48, 1);
  assert.equal(birthday.Is64x32, 1);
  const only64x32 = dp.applyVenue({VenueSupports96x48: 0, VenueSupports64x48: 0, VenueSupports64x32: 1});
  const only64x48 = dp.applyVenue({VenueSupports96x48: 0, VenueSupports64x48: 1, VenueSupports64x32: 0});
  assert.equal(dp.templateFitsVenue(birthday, only64x32), true);
  assert.equal(dp.templateFitsVenue(birthday, only64x48), true);
  const playback = dp.resolvePlaybackFormat({
    venue: only64x48,
    template: birthday,
    shoutout: {screenFormatId: "led-64x48"},
    board: "primary"
  });
  assert.equal(dp.familyOf(playback), "64x48");
  const persisted = dp.venueFirestoreFields({
    ...dp.flagsFromLedIds(["led-64x48"], "venueKey"),
    primaryDisplayScreenFormatId: "led-64x48"
  });
  assert.equal(persisted.VenueSupports64x48, 1);
  assert.equal(persisted.VenueSupports96x48, 0);
  assert.equal(persisted.VenueSupports64x32, 0);
  assert.match(adminApp, /VenueSupports96x48: screenFlags.VenueSupports96x48/);
  assert.match(displayApp, /resolvePlaybackFormat/);
  assert.doesNotMatch(displayApp, /searchParams\.set\("screen"/);
  const neon = dp.classify({...sandbox.SHOUTOUT_TEMPLATES.neon});
  assert.equal(neon.templateKind, "full");
  assert.equal(neon.Is64x32, 1);
  assert.equal(dp.classify({...sandbox.SHOUTOUT_TEMPLATES.birthdayMedia}).templateKind, "splitMedia");
  assert.equal(dp.classify({...sandbox.SHOUTOUT_TEMPLATES.heistVaultNight}).templateKind, "textOverlayFrame");
  assert.equal(dp.classify({...sandbox.SHOUTOUT_TEMPLATES.soccerJersey}).templateKind, "soccerJersey");
  const catalogRows = dp.catalogRows(sandbox.SHOUTOUT_TEMPLATES);
  assert.ok(!catalogRows.some(row => row.catalogKey === "heistRedLux"));
  const html = dp.catalogReportHtml({templates: sandbox.SHOUTOUT_TEMPLATES, venue: only64x32, showVenueColumn: true});
  assert.match(html, /Is64x32 = 1/);
  assert.match(html, /Hidden/);
  assert.match(html, /birthdayMedia/);
  assert.match(adminHtml, /clubTemplateCatalogReport/);
  assert.match(adminApp, /catalogReportHtml/);
});

test("birthday split-media loops on 64x48/64x32 and AssignmentCards spell status", () => {
  assert.match(displayApp, /startSplitMediaLoop/);
  assert.match(displayApp, /SPLIT_MEDIA_LOOP_MS = 4000/);
  assert.match(displayApp, /kicker: "FLOQR"/);
  assert.match(displayCss, /split-media-loop/);
  assert.match(displayCss, /split-media-phase-media/);
  const adminScheduling = fs.readFileSync(path.join(root, "admin-scheduling.js"), "utf8");
  const assignmentCard = fs.readFileSync(path.join(root, "assignment-card.js"), "utf8");
  const ingest = fs.readFileSync(path.join(__dirname, "venue-ingest-functions.js"), "utf8");
  assert.match(assignmentCard, /assignment-card is-\$\{meta\.key\}/);
  assert.match(assignmentCard, /status-label/);
  assert.match(adminScheduling, /FLOQRAssignmentCard/);
  assert.match(adminHtml, /assignment-card\.js/);
  assert.match(adminHtml, /Draft \(purple\)/);
  assert.match(ingest, /where\("status", "in", publicWebsiteQueryStatuses\(\)\)/);
  assert.match(ingest, /publicStatusQueryDecision\(req\.query\.status\)/);
  assert.match(ingest, /exports\.publicVenueCalendar/);
  assert.doesNotMatch(ingest, /isPublishedShiftStatus/);
  assert.match(ingest, /Cache-Control", "public, max-age=15, must-revalidate"/);
});
