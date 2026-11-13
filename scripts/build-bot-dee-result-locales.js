#!/usr/bin/env node
/* Builds functions/bot-dee-result-locales.json — localized labels/blurbs for BOT DEE
   contextualSearch result cards (help packs + product chrome keys).
   Usage: node scripts/build-bot-dee-result-locales.js [--check] */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "functions", "bot-dee-result-locales.json");
const LANGS = ["de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"];

/** Product intent id → chrome label key (blurb always botdee.intentBlurb.<id>). */
const INTENT_LABEL_KEYS = {
  shoutout: "cat.shoutout",
  floqcast: "cat.floqcast",
  "vip-reserv": "cat.vipreserv",
  mingl: "cat.mingl",
  rydr: "cat.rydr",
  bartr: "cat.bartr",
  clubs: "cat.clubs",
  "venue-search": "botdee.intentLabel.venueSearch",
  "ad-campaigns": "botdee.intentLabel.adCampaigns",
  "ballers-alert": "botdee.intentLabel.ballersAlert",
  "classic-halloween": "botdee.intentLabel.classicHalloween",
  "football-intro": "botdee.intentLabel.footballIntro",
  shiloh: "botdee.intentLabel.shiloh",
  "tengo-muchos-dolares": "botdee.intentLabel.tengoMuchosDolares"
};

function loadI18n(root = ROOT) {
  const el = {
    lang: "en",
    getAttribute() { return null; },
    setAttribute() {}
  };
  const doc = {
    readyState: "complete",
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    documentElement: el,
    body: el,
    title: ""
  };
  const sandbox = {
    window: {},
    localStorage: {getItem() { return null; }, setItem() {}, removeItem() {}},
    document: doc,
    navigator: {language: "en"},
    console,
    setTimeout() { return 0; },
    clearTimeout() {},
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = init?.detail; }
    },
    URL,
    URLSearchParams
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.dispatchEvent = () => true;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "floqr-i18n.js"), "utf8"), sandbox, {filename: "floqr-i18n.js"});
  vm.runInContext(fs.readFileSync(path.join(root, "floqr-i18n-help.js"), "utf8"), sandbox, {filename: "floqr-i18n-help.js"});
  return {
    tIn: sandbox.FLOQRI18n.tIn.bind(sandbox.FLOQRI18n),
    helpPacks: sandbox.FLOQRI18nHelp.packs
  };
}

function sliceBlurb(body) {
  return String(body || "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function buildLocales(root = ROOT) {
  const {tIn, helpPacks} = loadI18n(root);
  const byLang = {};

  LANGS.forEach(lang => {
    const rows = {};
    const pack = helpPacks[lang] || {};
    Object.keys(pack).forEach(id => {
      const row = pack[id] || {};
      if (!row.title && !row.body) return;
      rows[`help:${id}`] = {
        label: String(row.title || id).slice(0, 120),
        blurb: sliceBlurb(row.body)
      };
    });

    Object.entries(INTENT_LABEL_KEYS).forEach(([id, labelKey]) => {
      const label = tIn(lang, labelKey);
      const blurbKey = `botdee.intentBlurb.${id}`;
      let blurb = tIn(lang, blurbKey);
      if (blurb === blurbKey) blurb = tIn("en", blurbKey);
      if (blurb === blurbKey) blurb = "";
      const finalLabel = label === labelKey ? tIn("en", labelKey) : label;
      rows[`intent:${id}`] = {
        label: String(finalLabel === labelKey ? id : finalLabel).slice(0, 120),
        blurb: sliceBlurb(blurb)
      };
    });

    const action = {
      paySecurely: tIn(lang, "botdee.link.paySecurely"),
      floqcastPreview: tIn(lang, "botdee.link.floqcastPreview"),
      shoutoutCompose: tIn(lang, "botdee.link.shoutoutCompose"),
      vipTerms: tIn(lang, "botdee.link.vipTerms")
    };
    const fallback = {
      noMatch: tIn(lang, "botdee.fallback.noMatch"),
      foundHeader: tIn(lang, "botdee.fallback.foundHeader")
    };
    byLang[lang] = {results: rows, action, fallback};
  });

  return {version: 1, langs: LANGS, intentLabelKeys: INTENT_LABEL_KEYS, byLang};
}

function serialize(locales) {
  return `${JSON.stringify(locales, null, 2)}\n`;
}

if (require.main === module) {
  const next = serialize(buildLocales());
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
    if (current !== next) {
      console.error("functions/bot-dee-result-locales.json is stale. Run: node scripts/build-bot-dee-result-locales.js");
      process.exit(1);
    }
    console.log("BOT DEE result locales are up to date.");
  } else {
    fs.writeFileSync(OUT, next);
    const parsed = JSON.parse(next);
    const deHelp = Object.keys(parsed.byLang.de?.results || {}).filter(k => k.startsWith("help:")).length;
    const deIntent = Object.keys(parsed.byLang.de?.results || {}).filter(k => k.startsWith("intent:")).length;
    console.log(`Wrote ${path.relative(ROOT, OUT)}: de help=${deHelp} intents=${deIntent}`);
  }
}

module.exports = {buildLocales, serialize, OUT, INTENT_LABEL_KEYS, LANGS};
