#!/usr/bin/env node
/* Builds functions/floqai-content-classes.json — the classification of every FloqAi source
   (help repository entries + curated intents) that getFloqAiAccess enforces server-side.
   Usage: node scripts/build-floqai-content-classes.js [--check]
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "functions", "floqai-content-classes.json");

function loadBrowserModules(root = ROOT) {
  const win = {
    FLOQRNav: {appVersion: "build"},
    location: {href: "https://build.local/", pathname: "/"},
    localStorage: {getItem() { return null; }, setItem() {}},
    navigator: {language: "en"},
    addEventListener() {},
    document: null,
    URLSearchParams,
    URL,
    console,
    setTimeout
  };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(root, "floqai-help-repository.js"), "utf8"), ctx, {filename: "floqai-help-repository.js"});
  vm.runInContext(fs.readFileSync(path.join(root, "intent-search.js"), "utf8"), ctx, {filename: "intent-search.js"});
  return {repo: win.FLOQRHelpRepository, intents: win.FLOQRIntentSearch};
}

function sortedObject(entries) {
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function buildManifest(root = ROOT) {
  const {repo, intents} = loadBrowserModules(root);
  const help = sortedObject(repo.entries().map(entry => [entry.id, [...(entry.audiences || [])].sort()]));
  const intentIds = new Set([...intents.INTENTS.map(intent => intent.id), "venue-search"]);
  const map = intents.INTENT_AUDIENCES || {};
  const intentRows = sortedObject([...intentIds].map(id => [id, [...(map[id] || [])].sort()]));
  return {help, intents: intentRows};
}

function serialize(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

if (require.main === module) {
  const next = serialize(buildManifest());
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
    if (current !== next) {
      console.error("functions/floqai-content-classes.json is stale. Run: node scripts/build-floqai-content-classes.js");
      process.exit(1);
    }
    console.log("FloqAi content classes are up to date.");
  } else {
    fs.writeFileSync(OUT, next);
    const parsed = JSON.parse(next);
    console.log(`Wrote ${path.relative(ROOT, OUT)}: ${Object.keys(parsed.help).length} help entries, ${Object.keys(parsed.intents).length} intents.`);
  }
}

module.exports = {buildManifest, serialize, OUT};
