#!/usr/bin/env node
/* Fail when patron-facing BOT DEE What's New or version help still uses
   internal tokens (unmount, headless, six-phase, night rail, …).
   Brands in functions/botdee-patron-language.js are not tokens.
   Usage: node scripts/check-botdee-patron-language.js */
"use strict";

const fs = require("fs");
const path = require("path");
const patron = require("../functions/botdee-patron-language");
const vs = require("../functions/botdee-version-smartview");

const CHROME_LANGS = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const HELP_LANGS = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
const NOTE_IDS = ["s3.3.055", "s3.3.054", "s3.3.051", "s3.3.046", "s3.3.044", "s3.3.043"];

function findObjectLiteral(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("Not found: " + marker);
  let i = start + marker.length;
  let depth = 0;
  let end = -1;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("Unbalanced after " + marker);
  return Function(`"use strict"; return (${source.slice(start + marker.length, end)});`)();
}

function jsString(raw) {
  return JSON.parse(`"${raw}"`);
}

function repositoryVersionHelp(root) {
  const src = fs.readFileSync(path.join(root, "botdee-help-repository.js"), "utf8");
  const at = src.indexOf('id: "help-botdee-version-smartview"');
  if (at < 0) throw new Error("missing help-botdee-version-smartview");
  const slice = src.slice(at, at + 800);
  const match = slice.match(/body: "((?:[^"\\]|\\.)*)"/);
  if (!match) throw new Error("missing version help body");
  return jsString(match[1]);
}

function audit(rootDir) {
  const root = rootDir || path.resolve(__dirname, "..");
  const problems = [];
  const hit = (label, text) => {
    const hits = patron.internalTokenHits(text);
    if (hits.length) problems.push(`${label}: ${hits.join(", ")}`);
  };

  vs.changelogItems(root).forEach(row => hit(`What's New ${row.id}`, row.text));

  const chrome = findObjectLiteral(fs.readFileSync(path.join(root, "floqr-i18n.js"), "utf8"), "const CHROME = ");
  const en = chrome.en || {};
  CHROME_LANGS.forEach(lang => {
    const pack = chrome[lang] || {};
    hit(`${lang} botdee.vs.helpBody`, pack["botdee.vs.helpBody"]);
    NOTE_IDS.forEach(id => {
      const key = `botdee.vs.note.${id}`;
      if (!(key in pack)) problems.push(`${lang} missing ${key}`);
      else hit(`${lang} ${key}`, pack[key]);
    });
    if (lang !== "en" && pack["botdee.vs.helpBody"] === en["botdee.vs.helpBody"]) {
      problems.push(`${lang} version help is still English`);
    }
  });

  const repoBody = repositoryVersionHelp(root);
  hit("repository help-botdee-version-smartview", repoBody);
  if (repoBody !== en["botdee.vs.helpBody"]) {
    problems.push("repository version help does not match English botdee.vs.helpBody");
  }

  const packs = findObjectLiteral(fs.readFileSync(path.join(root, "floqr-i18n-help.js"), "utf8"), "const packs = ");
  HELP_LANGS.forEach(lang => {
    const body = packs[lang] && packs[lang]["help-botdee-version-smartview"] && packs[lang]["help-botdee-version-smartview"].body;
    if (!body) problems.push(`${lang} help pack missing version help`);
    else {
      hit(`${lang} help-botdee-version-smartview`, body);
      if (body !== chrome[lang]["botdee.vs.helpBody"]) {
        problems.push(`${lang} help pack version help does not match chrome helpBody`);
      }
    }
  });

  NOTE_IDS.forEach(id => {
    const shown = vs.changelogItems(root).find(row => row.id === id);
    const key = `botdee.vs.note.${id}`;
    if (shown && en[key] !== shown.text) problems.push(`en ${key} does not match What's New`);
  });

  CHROME_LANGS.forEach(lang => {
    const help = chrome[lang]["botdee.vs.helpBody"] || "";
    if (!help.includes("BOT DEE")) problems.push(`${lang} version help dropped BOT DEE`);
    const vip = chrome[lang]["botdee.vs.note.s3.3.055"] || "";
    if (!vip.includes("VIP reserV") || !vip.includes("BOT DEE")) problems.push(`${lang} VIP note dropped a brand`);
    const room = chrome[lang]["botdee.vs.note.s3.3.051"] || "";
    if (!room.includes("Room SMARTview")) problems.push(`${lang} Room note dropped Room SMARTview`);
    ["s3.3.044", "s3.3.043"].forEach(id => {
      const line = chrome[lang][`botdee.vs.note.${id}`] || "";
      if (!line.includes("ShoutOut")) problems.push(`${lang} ${id} dropped ShoutOut`);
    });
  });

  return problems;
}

function main() {
  const problems = audit(path.resolve(__dirname, ".."));
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("OK — BOT DEE What's New and version help are patron language.");
}

if (require.main === module) main();

module.exports = {audit, NOTE_IDS};
