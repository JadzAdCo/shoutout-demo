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

test("baller SVG assets are safe and branded correctly", () => {
  const files = [
    ["images/baller/black-card-2x1.svg", "BALLER'S EXPRESS", false],
    ["images/baller/black-card-4x3.svg", "BALLER'S EXPRESS", false],
    ["images/baller/ballers-alert-2x1.svg", "BALLER'S EXPRESS", true],
    ["images/baller/ballers-alert-4x3.svg", "BALLER'S EXPRESS", true],
    ["images/baller/black-card-amex-2x1.svg", "AMERICAN EXPRESS", false],
    ["images/baller/ballers-alert-amex-2x1.svg", "AMERICAN EXPRESS", true]
  ];
  files.forEach(([file, brand, isAlert]) => {
    assert.ok(fs.existsSync(path.join(root, file)), file);
    const svg = read(file);
    assert.match(svg.trimStart(), /^(<\?xml[^>]*>\s*)?<svg\b/);
    assert.match(svg, new RegExp(brand.replace(/'/g, "['’]?")), brand);
    assert.doesNotMatch(svg, /<script|<foreignObject|\son[a-z]+=|xlink:href="http|href="http/i);
    assert.match(svg, /id="gold"/);
    assert.match(svg, /id="filigree"|filigree/);
    assert.ok(Buffer.byteLength(svg) < 200 * 1024);
    if (isAlert) {
      assert.match(svg, /02\/50/);
      assert.match(svg, /baller-face-hole|FACE/);
    }
  });
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
  const css = read("display.css");
  assert.match(css, /\.display-canvas\.baller-card/);
  assert.match(css, /\.display-canvas\.baller-alert \.media-slot/);
  const patron = read("patron-app.js");
  assert.match(patron, /isBallerCardTemplate/);
  assert.match(patron, /syncBallerCardFields/);
  assert.match(patron, /masterAdminOnly/);
  assert.match(patron, /baller-face-medallion/);
  assert.match(patron, /We're Outside LLC/);
  assert.match(patron, /BaddB\$ches Only Corp/);
  const html = read("index.html");
  assert.match(html, /id="ballerCardFields"/);
  assert.match(html, /id="ballerNameSource"/);
  assert.match(html, /id="ballerCompanyPreset"/);
  const ai = read("functions/ai-discovery-functions.js");
  assert.match(ai, /baller-face-medallion/);
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
