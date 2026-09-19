/**
 * Merge patron portal + listing + inbox chrome keys into scripts/_chrome-*.json
 * Run: node scripts/merge-patron-portal-chrome.js && node scripts/build-i18n-chrome.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const LANGS = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const mergePath = path.join(__dirname, "_chrome-merge-patron.json");
const additions = JSON.parse(fs.readFileSync(mergePath, "utf8"));

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

for (const lang of LANGS) {
  const packPath = path.join(__dirname, `_chrome-${lang}.json`);
  const base = JSON.parse(fs.readFileSync(packPath, "utf8"));
  const patch = additions[lang];
  if (!patch) throw new Error(`Missing merge block for ${lang}`);
  const merged = sortKeys({ ...base, ...patch });
  fs.writeFileSync(packPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(`${lang}: ${Object.keys(merged).length} keys (+${Object.keys(patch).length} merged)`);
}
