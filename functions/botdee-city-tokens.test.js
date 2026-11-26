"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const city = require("./botdee-city-tokens");
const tools = require("./bot-dee-tools");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

test("language is required and brands stay untranslated", () => {
  assert.equal(city.autocompleteAliases("Miami", "").ok, false);
  assert.equal(city.autocompleteAliases("Miami", "").error, "language_required");
  assert.equal(city.sanitizeWrite({sourceToken: "ShoutOut", sourceLang: "en"}).error, "protected_brand");
  assert.equal(city.sanitizeWrite({sourceToken: "BOT DEE", sourceLang: "fr"}).error, "protected_brand");
});

test("add Miami in English fills native-script langs", () => {
  const auto = city.autocompleteAliases("Miami", "en");
  assert.equal(auto.ok, true);
  assert.equal(auto.placeId, "miami");
  assert.ok(auto.aliasesByLang.ar.includes("ميامي"));
  assert.ok(auto.aliasesByLang.el.includes("μαϊάμι") || auto.aliasesByLang.el.some(v => /μαϊάμι/i.test(v)));
  assert.ok(auto.aliasesByLang.ru.includes("майами"));
  city.ALLOWED_LANGS.forEach(lang => {
    assert.ok(auto.aliasesByLang[lang].length, lang);
  });
});

test("add ميامي in Arabic still maps to miami", () => {
  const auto = city.autocompleteAliases("ميامي", "ar");
  assert.equal(auto.placeId, "miami");
  assert.ok(auto.aliasesByLang.en.includes("miami"));
});

test("unknown city copies the source token into every lang", () => {
  const auto = city.autocompleteAliases("Osaka", "en");
  assert.equal(auto.packaged, false);
  city.ALLOWED_LANGS.forEach(lang => {
    assert.ok(auto.aliasesByLang[lang].includes("Osaka") || auto.aliasesByLang[lang].some(v => /osaka/i.test(v)));
  });
});

test("matchPlaces hits native-script Miami / Bali / Paris", () => {
  tools.invalidateCityCatalog();
  assert.ok(tools.matchPlaces("clubs in ميامي").tokens.includes("miami"));
  assert.ok(tools.matchPlaces("Μαϊάμι").tokens.includes("miami"));
  assert.ok(tools.matchPlaces("Майами").tokens.includes("miami"));
  assert.ok(tools.matchPlaces("نوادي في بالي").tokens.includes("bali"));
  assert.ok(tools.matchPlaces("Бали").tokens.includes("bali"));
  assert.ok(tools.matchPlaces("باريس").tokens.includes("paris"));
  assert.ok(tools.classifyPlaceSearchIntent("ميامي").placeTokens.includes("miami"));
  assert.ok(tools.classifyPlaceSearchIntent("clubs in Miami").placeTokens.includes("miami"));
});

test("Master Admin city token UI + callables + rules + classification", () => {
  const html = read("master-admin.html");
  const app = read("master-feature-services.js");
  const fns = read("functions/bot-dee-functions.js");
  const index = read("functions/index.js");
  const rules = read("firestore.rules");
  const dc = read("functions/data-classification-core.js");
  assert.match(html, /data-botdee-page="cities"/);
  assert.match(html, /id="botDeeCityLang"/);
  assert.match(html, /help-botdee-city-tokens/);
  assert.match(app, /upsertBotDeeCityToken/);
  assert.match(app, /FLOQRReasonPrompt/);
  assert.match(fns, /exports\.upsertBotDeeCityToken/);
  assert.match(fns, /exports\.listBotDeeCityTokens/);
  assert.match(fns, /exports\.previewBotDeeCityToken/);
  assert.match(index, /upsertBotDeeCityToken/);
  assert.match(rules, /match \/botDeeCityTokens\/\{placeId\}/);
  assert.match(dc, /botDeeCityTokens/);
});
