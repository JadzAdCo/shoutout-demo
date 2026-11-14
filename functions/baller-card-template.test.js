"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const HELP_LANGS = ["de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"];
const SIZES = ["led-64x32", "led-64x48", "led-96x48"];
const AURELIA = "temp-democlub-1";
const PUBLIC_IDS = ["ballersAlert"];
const AMEX_IDS = ["ballersAlertAmex"];
const ALL_IDS = [...PUBLIC_IDS, ...AMEX_IDS];
const RETIRED_IDS = ["blackCard", "blackCardAmex"];

function loadSharedData() {
  const sandbox = {location: {origin: "https://example.test", href: "https://example.test/", pathname: "/"}};
  sandbox.window = sandbox;
  vm.runInNewContext(read("floqr-temp-qa-showcase.js"), sandbox, {filename: "floqr-temp-qa-showcase.js"});
  vm.runInNewContext(read("shared-data.js"), sandbox, {filename: "shared-data.js"});
  return sandbox;
}

test("Baller's Alert is STANDARD at every size; Black Card templates removed", () => {
  const sandbox = loadSharedData();
  const alert = sandbox.SHOUTOUT_TEMPLATES.ballersAlert;
  assert.ok(alert, "ballersAlert exists");
  assert.equal(alert.name, "Baller's Alert");
  assert.equal(alert.priceCents, 10000);
  assert.equal(alert.ballerBrand, "ballers");
  assert.equal(alert.requiresFacePhoto, true);
  assert.equal(alert.ballerAlert, true);
  assert.equal(alert.maxSubCharacters, 18);
  assert.ok(!alert.masterAdminOnly);
  RETIRED_IDS.forEach(id => {
    assert.equal(sandbox.SHOUTOUT_TEMPLATES[id], undefined, `${id} removed from catalog`);
    assert.equal(sandbox.SHOUTOUT_STANDARD_TEMPLATE_IDS.includes(id), false);
  });
  PUBLIC_IDS.forEach(id => {
    assert.ok(sandbox.SHOUTOUT_STANDARD_TEMPLATE_IDS.includes(id), `${id} in STANDARD`);
    const t = sandbox.SHOUTOUT_TEMPLATES[id];
    assert.equal(t.Is96x48, 1);
    assert.equal(t.Is64x48, 1);
    assert.equal(t.Is64x32, 1);
    assert.deepEqual([...t.screenFormatIds].sort(), SIZES);
    assert.equal(sandbox.FLOQRTextLayout.profileId(t), "ballerCard");
  });
});

test("Baller's Alert Amex is Master Admin + Aurelia only (not STANDARD)", () => {
  const sandbox = loadSharedData();
  AMEX_IDS.forEach(id => {
    const t = sandbox.SHOUTOUT_TEMPLATES[id];
    assert.ok(t, id);
    assert.equal(t.masterAdminOnly, true);
    assert.deepEqual([...t.venueIds], [AURELIA]);
    assert.equal(t.ballerBrand, "amex");
    assert.equal(sandbox.SHOUTOUT_STANDARD_TEMPLATE_IDS.includes(id), false);
    assert.match(String(t.defaultBackgroundUrl), /-amex-/);
  });
  assert.equal(sandbox.SHOUTOUT_CLUB_LOCATIONS[AURELIA].brandName, "Aurelia");
});

test("baller photoreal PNG assets remain for Alert (+ legacy Black Card art files)", () => {
  const files = [
    "images/baller/ballers-alert-2x1.png",
    "images/baller/ballers-alert-4x3.png",
    "images/baller/ballers-alert-amex-2x1.png",
    "images/baller/ballers-alert-amex-4x3.png",
    "images/baller/black-card-2x1.png",
    "images/baller/black-card-4x3.png"
  ];
  files.forEach(file => {
    const abs = path.join(root, file);
    assert.ok(fs.existsSync(abs), file);
    const buf = fs.readFileSync(abs);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
    assert.equal(buf[2], 0x4e);
    assert.equal(buf[3], 0x47);
    assert.ok(buf.length > 80 * 1024, `${file} too small for photoreal card`);
    assert.ok(buf.length < 4 * 1024 * 1024, `${file} unexpectedly large`);
  });
  const shared = read("shared-data.js");
  assert.match(shared, /ballers-alert-2x1\.png/);
  assert.doesNotMatch(shared, /blackCard:\s*\{/);
  assert.doesNotMatch(shared, /blackCardAmex:\s*\{/);
  assert.doesNotMatch(shared, /black-card-2x1\.svg/);
});

test("server prices and Amex gate; Black Card checkout refused", () => {
  const {normalizeCheckoutPayload} = require("./commerce-functions.js").__checkoutHelpers;
  const masterAuth = {uid: "master-1", token: {email: "bans.don@gmail.com", email_verified: true, masterAdmin: true}};
  const patronAuth = {uid: "patron-1", token: {email: "patron@example.com", email_verified: true}};

  SIZES.forEach(screenFormatId => {
    const alert = normalizeCheckoutPayload("shoutout", {
      clubLocationId: AURELIA,
      shoutout: {template: "ballersAlert", screenFormatId, mainText: "NYX FLOQR", subText: "WE'RE OUTSIDE LLC", priceCents: 1, clubLocationId: AURELIA}
    }, patronAuth);
    assert.equal(alert.shoutout.priceCents, 10000);
    assert.equal(alert.shoutout.priceLabel, "$100");
  });

  assert.throws(
    () => normalizeCheckoutPayload("shoutout", {
      clubLocationId: AURELIA,
      shoutout: {template: "blackCard", screenFormatId: "led-96x48", mainText: "TEST", subText: "Co", clubLocationId: AURELIA}
    }, patronAuth),
    /Baller's Alert|removed/i
  );

  assert.throws(
    () => normalizeCheckoutPayload("shoutout", {
      clubLocationId: AURELIA,
      shoutout: {template: "ballersAlertAmex", screenFormatId: "led-96x48", mainText: "TEST", subText: "Co", clubLocationId: AURELIA}
    }, patronAuth),
    /Master Admin|permission/i
  );

  assert.throws(
    () => normalizeCheckoutPayload("shoutout", {
      clubLocationId: "heist-washington-dc",
      shoutout: {template: "ballersAlertAmex", screenFormatId: "led-96x48", mainText: "TEST", subText: "Co", clubLocationId: "heist-washington-dc"}
    }, masterAuth),
    /Aurelia/i
  );

  const amex = normalizeCheckoutPayload("shoutout", {
    clubLocationId: AURELIA,
    shoutout: {template: "ballersAlertAmex", screenFormatId: "led-96x48", mainText: "TEST", subText: "Co", clubLocationId: AURELIA}
  }, masterAuth);
  assert.equal(amex.shoutout.priceCents, 10000);
  assert.equal(amex.shoutout.ballerBrand, "amex");

  const backend = read("functions/commerce-functions.js");
  assert.match(backend, /BALLER_CARD_PRICE_CENTS/);
  assert.match(backend, /BALLER_AMEX_TEMPLATE_IDS/);
  const rules = read("firestore.rules");
  [...ALL_IDS, ...RETIRED_IDS].forEach(id => {
    assert.match(rules, new RegExp(`template != '${id}'`), `rules refuse free ${id}`);
  });
});

test("display + composer wire Baller's Alert (Upload chooser, company max 18)", () => {
  const display = read("display-app.js");
  assert.match(display, /isBallerCard/);
  assert.match(display, /baller-face-medallion-slot/);
  assert.match(display, /placeBallerFaceSlot/);
  assert.match(display, /resolveBallerBackgroundUrl/);
  const css = read("display.css");
  assert.match(css, /\.display-canvas\.baller-card/);
  assert.match(css, /\.display-canvas\.baller-alert/);
  const patron = read("patron-app.js");
  assert.match(patron, /isBallerCardTemplate/);
  assert.match(patron, /syncBallerCardFields/);
  assert.match(patron, /baller-portrait-mask|baller-face-medallion/);
  assert.match(patron, /compositeBallerPortraitCutout|destination-in/);
  assert.match(patron, /ballerUploadPhotoBtn/);
  assert.match(patron, /ballerUploadChooser/);
  assert.match(patron, /openBallerFaceCameraCapture/);
  assert.doesNotMatch(patron, /id=\"ballerTakePhotoBtn\"/);
  assert.match(patron, /processBallerFaceSelection/);
  assert.match(patron, /BALLER_COMPANY_MAX = 18/);
  assert.match(patron, /ballerCompanyNormalize/);
  assert.match(patron, /logShoutoutPageCall/);
  const html = read("index.html");
  assert.match(html, /id="ballerCardFields"/);
  assert.match(html, /maxlength="18"/);
  assert.match(html, /id="ballerFaceScale"/);
  const styles = read("styles.css");
  assert.match(styles, /baller-face-camera-modal/);
  assert.match(styles, /baller-upload-chooser/);
  const shared = loadSharedData();
  ALL_IDS.forEach(id => {
    assert.equal(shared.SHOUTOUT_TEMPLATES[id].maxSubCharacters, 18, `${id} company max 18`);
  });
});

test("Baller help + BOT DEE intents (Black Card retired → Alert)", () => {
  const repo = read("botdee-help-repository.js");
  assert.match(repo, /id: "help-black-card"/);
  assert.match(repo, /Black Card \(retired\)|removed from the ShoutOut catalog/);
  assert.match(repo, /id: "help-ballers-alert"/);
  const helpPacks = read("floqr-i18n-help.js");
  assert.equal((helpPacks.match(/"help-black-card":/g) || []).length, HELP_LANGS.length);
  assert.equal((helpPacks.match(/"help-ballers-alert":/g) || []).length, HELP_LANGS.length);
  assert.ok(JSON.parse(read("scripts/_help-en.json"))["help-black-card"]);
  assert.ok(JSON.parse(read("scripts/_help-en.json"))["help-ballers-alert"]);
  const intents = read("intent-search.js");
  assert.doesNotMatch(intents, /templateId: "blackCard"/);
  assert.match(intents, /id: "ballers-alert",[\s\S]{0,500}templateId: "ballersAlert"/);
  const classes = JSON.parse(read("functions/botdee-content-classes.json"));
  assert.deepEqual(classes.help["help-black-card"], ["patron"]);
  assert.deepEqual(classes.help["help-ballers-alert"], ["patron"]);
  assert.equal(classes.intents["black-card"], undefined);
  assert.deepEqual(classes.intents["ballers-alert"], ["patron"]);
});
