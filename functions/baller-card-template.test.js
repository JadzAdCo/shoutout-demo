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
const PUBLIC_IDS = ["blackCard", "ballersAlert"];
const AMEX_IDS = ["blackCardAmex", "ballersAlertAmex"];
const ALL_IDS = [...PUBLIC_IDS, ...AMEX_IDS];

function loadSharedData() {
  const sandbox = {location: {origin: "https://example.test", href: "https://example.test/", pathname: "/"}};
  sandbox.window = sandbox;
  vm.runInNewContext(read("floqr-temp-qa-showcase.js"), sandbox, {filename: "floqr-temp-qa-showcase.js"});
  vm.runInNewContext(read("shared-data.js"), sandbox, {filename: "shared-data.js"});
  return sandbox;
}

test("public Baller's Express Black Card + Baller's Alert are STANDARD at every size", () => {
  const sandbox = loadSharedData();
  const black = sandbox.SHOUTOUT_TEMPLATES.blackCard;
  const alert = sandbox.SHOUTOUT_TEMPLATES.ballersAlert;
  assert.ok(black, "blackCard exists");
  assert.ok(alert, "ballersAlert exists");
  assert.equal(black.name, "Black Card");
  assert.equal(alert.name, "Baller's Alert");
  assert.equal(black.priceCents, 7500);
  assert.equal(alert.priceCents, 10000);
  assert.equal(black.ballerBrand, "ballers");
  assert.equal(alert.ballerBrand, "ballers");
  assert.equal(alert.requiresFacePhoto, true);
  assert.equal(alert.ballerAlert, true);
  assert.ok(!black.masterAdminOnly);
  assert.ok(!alert.venueIds || alert.venueIds.length === 0);
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

test("Amex twins are Master Admin + Aurelia only (not STANDARD)", () => {
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

test("baller photoreal PNG assets are exact Centurion-frame replicas", () => {
  const files = [
    "images/baller/black-card-2x1.png",
    "images/baller/black-card-4x3.png",
    "images/baller/ballers-alert-2x1.png",
    "images/baller/ballers-alert-4x3.png",
    "images/baller/black-card-amex-2x1.png",
    "images/baller/black-card-amex-4x3.png",
    "images/baller/ballers-alert-amex-2x1.png",
    "images/baller/ballers-alert-amex-4x3.png"
  ];
  files.forEach(file => {
    const abs = path.join(root, file);
    assert.ok(fs.existsSync(abs), file);
    const buf = fs.readFileSync(abs);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50); // P
    assert.equal(buf[2], 0x4e); // N
    assert.equal(buf[3], 0x47); // G
    assert.ok(buf.length > 80 * 1024, `${file} too small for photoreal card`);
    assert.ok(buf.length < 4 * 1024 * 1024, `${file} unexpectedly large`);
  });
  const shared = read("shared-data.js");
  assert.match(shared, /black-card-2x1\.png/);
  assert.match(shared, /black-card-amex-2x1\.png/);
  assert.match(shared, /ballers-alert-2x1\.png/);
  assert.doesNotMatch(shared, /black-card-2x1\.svg/);
});

test("server prices and Amex gate are enforced", () => {
  const {normalizeCheckoutPayload} = require("./commerce-functions.js").__checkoutHelpers;
  const masterAuth = {uid: "master-1", token: {email: "bans.don@gmail.com", email_verified: true, masterAdmin: true}};
  const patronAuth = {uid: "patron-1", token: {email: "patron@example.com", email_verified: true}};

  SIZES.forEach(screenFormatId => {
    const black = normalizeCheckoutPayload("shoutout", {
      clubLocationId: AURELIA,
      shoutout: {template: "blackCard", screenFormatId, mainText: "NYX FLOQR", subText: "Bad Boy Inc.", priceCents: 1, clubLocationId: AURELIA}
    }, patronAuth);
    assert.equal(black.shoutout.priceCents, 7500);
    assert.equal(black.shoutout.priceLabel, "$75");
    assert.equal(black.shoutout.textProfileId, "ballerCard");

    const alert = normalizeCheckoutPayload("shoutout", {
      clubLocationId: AURELIA,
      shoutout: {template: "ballersAlert", screenFormatId, mainText: "NYX FLOQR", subText: "We're Outside LLC", priceCents: 1, clubLocationId: AURELIA}
    }, patronAuth);
    assert.equal(alert.shoutout.priceCents, 10000);
    assert.equal(alert.shoutout.priceLabel, "$100");
  });

  assert.throws(
    () => normalizeCheckoutPayload("shoutout", {
      clubLocationId: AURELIA,
      shoutout: {template: "blackCardAmex", screenFormatId: "led-96x48", mainText: "TEST", subText: "Co", clubLocationId: AURELIA}
    }, patronAuth),
    /Master Admin|permission/i
  );

  assert.throws(
    () => normalizeCheckoutPayload("shoutout", {
      clubLocationId: "heist-washington-dc",
      shoutout: {template: "blackCardAmex", screenFormatId: "led-96x48", mainText: "TEST", subText: "Co", clubLocationId: "heist-washington-dc"}
    }, masterAuth),
    /Aurelia/i
  );

  const amex = normalizeCheckoutPayload("shoutout", {
    clubLocationId: AURELIA,
    shoutout: {template: "blackCardAmex", screenFormatId: "led-96x48", mainText: "TEST", subText: "Co", clubLocationId: AURELIA}
  }, masterAuth);
  assert.equal(amex.shoutout.priceCents, 7500);
  assert.equal(amex.shoutout.ballerBrand, "amex");

  const backend = read("functions/commerce-functions.js");
  assert.match(backend, /BALLER_CARD_PRICE_CENTS/);
  assert.match(backend, /BALLER_AMEX_TEMPLATE_IDS/);
  const rules = read("firestore.rules");
  ALL_IDS.forEach(id => {
    assert.match(rules, new RegExp(`template != '${id}'`), `rules refuse free ${id}`);
  });
});

test("display + composer wire baller cards", () => {
  const display = read("display-app.js");
  assert.match(display, /isBallerCard/);
  assert.match(display, /baller-face-medallion-slot/);
  assert.match(display, /backgroundUrlByFormat/);
  assert.match(display, /placeBallerFaceSlot/);
  assert.match(display, /resolveBallerBackgroundUrl/);
  assert.doesNotMatch(display, /ballerName[\s\S]{0,80}\.toUpperCase\(\)/);
  const css = read("display.css");
  assert.match(css, /\.display-canvas\.baller-card/);
  assert.match(css, /\.display-canvas\.baller-alert/);
  assert.match(css, /text-transform:none/);
  assert.match(css, /left:16\.782%/);
  assert.match(css, /top:8\.442%/);
  assert.match(css, /width:14\.873%/);
  assert.match(css, /height:33\.769%/);
  assert.match(css, /left:8\.223%/);
  assert.match(css, /top:15\.082%/);
  assert.match(css, /baller-chip-overlay/);
  assert.match(css, /left:21\.153%/);
  assert.match(display, /ballerTypeVh/);
  assert.match(display, /0\.92 \* 1\.5/);
  assert.match(display, /placeBallerChipOverlay/);
  assert.match(display, /baller-emv-chip\.png/);
  const build = read("scripts/build-baller-card-photos.py");
  assert.match(build, /fit_led|express-package/);
  assert.match(build, /ballers-express-business\.png/);
  assert.doesNotMatch(build, /face_hole\(/);
  const black = fs.readFileSync(path.join(root, "images/baller/black-card-2x1.png"));
  const alert = fs.readFileSync(path.join(root, "images/baller/ballers-alert-2x1.png"));
  assert.equal(Buffer.compare(black, alert), 0, "Alert keeps warrior art (same PNG as Black Card)");
  const pkg = path.join(root, "reports/baller-cards/express-package/ballers-express-business.png");
  assert.ok(fs.existsSync(pkg), "express package master PNG present");
  const patron = read("patron-app.js");
  assert.match(patron, /isBallerCardTemplate/);
  assert.match(patron, /syncBallerCardFields/);
  assert.match(patron, /masterAdminOnly/);
  assert.match(patron, /baller-portrait-mask|baller-face-medallion/);
  assert.match(patron, /compositeBallerPortraitCutout|destination-in/);
  assert.match(patron, /ballerUploadPhotoBtn/);
  assert.match(patron, /ballerTakePhotoBtn/);
  assert.match(patron, /BALLER_COMPANY_MAX/);
  assert.match(patron, /WE'RE OUTSIDE LLC/);
  assert.match(patron, /ballerWithAt/);
  assert.match(patron, /"none": ""/);
  assert.match(patron, /BaddB\$ches Only Corp/);
  const html = read("index.html");
  assert.match(html, /id="ballerCardFields"/);
  assert.match(html, /id="ballerNameSource"/);
  assert.match(html, /id="ballerCompanyPreset"/);
  assert.match(html, /WE'RE OUTSIDE LLC/);
  assert.match(html, /maxlength="25"/);
  assert.match(html, /id="ballerFaceScale"/);
  assert.match(html, /id="ballerFacePosY"/);
  assert.match(html, /value="none"/);
  assert.match(html, /Name or social @handle|Name or @handle/);
  assert.match(css, /baller-red-halo/);
  assert.match(display, /ballerFaceScale/);
  assert.match(display, /ballerFaceObjectPositionY/);
  const ai = read("functions/ai-discovery-functions.js");
  assert.match(ai, /baller-portrait-mask/);
  assert.match(ai, /runBallerPortraitMask/);
  const portrait = read("functions/gemini-portrait-mask.js");
  assert.match(portrait, /gemini-2\.5-flash/);
  assert.match(portrait, /@google\/genai|GoogleGenAI/);
  const shared = loadSharedData();
  ALL_IDS.forEach(id => {
    assert.equal(shared.SHOUTOUT_TEMPLATES[id].maxSubCharacters, 25, `${id} company max 25`);
  });
});

test("Baller help + BOT DEE intents", () => {
  const repo = read("botdee-help-repository.js");
  assert.match(repo, /id: "help-black-card"/);
  assert.match(repo, /id: "help-ballers-alert"/);
  const helpPacks = read("floqr-i18n-help.js");
  assert.equal((helpPacks.match(/"help-black-card":/g) || []).length, HELP_LANGS.length);
  assert.equal((helpPacks.match(/"help-ballers-alert":/g) || []).length, HELP_LANGS.length);
  assert.ok(JSON.parse(read("scripts/_help-en.json"))["help-black-card"]);
  assert.ok(JSON.parse(read("scripts/_help-en.json"))["help-ballers-alert"]);
  const intents = read("intent-search.js");
  assert.match(intents, /id: "black-card",[\s\S]{0,400}templateId: "blackCard"/);
  assert.match(intents, /id: "ballers-alert",[\s\S]{0,400}templateId: "ballersAlert"/);
  const classes = JSON.parse(read("functions/botdee-content-classes.json"));
  assert.deepEqual(classes.help["help-black-card"], ["patron"]);
  assert.deepEqual(classes.help["help-ballers-alert"], ["patron"]);
  assert.deepEqual(classes.intents["black-card"], ["patron"]);
  assert.deepEqual(classes.intents["ballers-alert"], ["patron"]);
});
