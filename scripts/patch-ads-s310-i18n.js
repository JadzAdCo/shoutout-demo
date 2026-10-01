"use strict";
// Adds the s3.1.0 ad chrome keys to every language pack in floqr-i18n.js (idempotent).
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "floqr-i18n.js");
const packs = {...require("./ads-s310-i18n-a"), ...require("./ads-s310-i18n-b"), ...require("./ads-s310-i18n-c")};
// Order of the language blocks in floqr-i18n.js (each block has one "ad.splash.body" line).
const BLOCK_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const ANCHOR = /^(\s*)"ad\.splash\.body":.*$/;

const enKeys = Object.keys(packs.en);
for (const lang of BLOCK_ORDER) {
  const keys = Object.keys(packs[lang] || {});
  const missing = enKeys.filter(k => !keys.includes(k));
  const extra = keys.filter(k => !enKeys.includes(k));
  const empty = keys.filter(k => !String(packs[lang][k]).trim());
  if (missing.length || extra.length || empty.length) {
    console.error(lang, {missing, extra, empty});
    process.exit(1);
  }
}

let src = fs.readFileSync(file, "utf8");
const present = enKeys.filter(k => src.includes(`"${k}":`));
if (present.length === enKeys.length) {
  console.log("already patched");
  process.exit(0);
}
if (present.length) {
  console.error("partially patched; keys already present:", present);
  process.exit(1);
}

const eol = src.includes("\r\n") ? "\r\n" : "\n";
const lines = src.split(/\r?\n/);
let block = 0;
const out = [];
for (const line of lines) {
  const match = line.match(ANCHOR);
  if (!match) {
    out.push(line);
    continue;
  }
  const lang = BLOCK_ORDER[block];
  if (!lang) {
    console.error("more anchor lines than languages");
    process.exit(1);
  }
  block += 1;
  const indent = match[1];
  const hasComma = /,\s*$/.test(line);
  out.push(hasComma ? line : `${line},`);
  const entries = enKeys.map(k => `${indent}${JSON.stringify(k)}: ${JSON.stringify(packs[lang][k])}`);
  entries.forEach((entry, i) => out.push(i < entries.length - 1 || hasComma ? `${entry},` : entry));
}
if (block !== BLOCK_ORDER.length) {
  console.error(`expected ${BLOCK_ORDER.length} anchor lines, found ${block}`);
  process.exit(1);
}
fs.writeFileSync(file, out.join(eol));
console.log(`added ${enKeys.length} keys to ${block} language packs`);
