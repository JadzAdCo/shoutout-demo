#!/usr/bin/env node
/* Refresh the public help catalogs and the public lasttextenhun snapshot.
   Master Admin raw text is not written here. It lives in Firestore
   helpVerbiageMasterSource/catalog. Usage: node scripts/build-help-verbiage-sources.js [--check] */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {buildManifest, serialize: serializeClasses} = require("./build-botdee-content-classes");
const {buildCatalog, serialize: serializeCatalog} = require("./build-bot-dee-search-catalog");

const ROOT = path.resolve(__dirname, "..");
const REPO = path.join(ROOT, "botdee-help-repository.js");
const PUBLIC_OUT = path.join(ROOT, "functions", "help-verbiage-public-source.json");
const MASTER_JSON = path.join(ROOT, "functions", "help-verbiage-master-source.json");
const MASTER_AUDIENCES = path.join(ROOT, "functions", "help-verbiage-master-audiences.json");
const SNAPSHOT = path.join(ROOT, "help-verbiage-snapshot.js");
const SNAPSHOT_JSON = path.join(ROOT, "functions", "help-verbiage-public-snapshot.json");
const CLASSES = path.join(ROOT, "functions", "botdee-content-classes.json");
const SEARCH = path.join(ROOT, "functions", "bot-dee-search-catalog.json");

function loadEntries(file) {
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
  vm.runInContext(fs.readFileSync(file, "utf8"), ctx, {filename: "botdee-help-repository.js"});
  return win.FLOQRHelpRepository.entries();
}

function isMasterOnly(entry) {
  const audiences = entry && Array.isArray(entry.audiences) ? entry.audiences : [];
  return audiences.length === 1 && audiences[0] === "masterAdmin";
}

function pack(entry) {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    audiences: [...(entry.audiences || [])],
    searchPhrases: [...(entry.searchPhrases || [])],
    links: (entry.links || []).map(link => ({label: link.label || "", href: link.href || ""})),
    page: entry.page || "",
    source: entry.source || ""
  };
}

function snapshotModule(records) {
  const byId = {};
  records.forEach(row => {
    byId[row.id] = row;
  });
  return `/* Public helpVerbiage snapshot. Master Admin lasttextenhun is not in this file. */\n`
    + `(function (global) {\n  "use strict";\n  global.FLOQRHelpVerbiageSnapshot = {byId: ${JSON.stringify(byId)} };\n`
    + `})(typeof window !== "undefined" ? window : globalThis);\n`;
}

function embedSnapshot(src, records) {
  const byId = {};
  records.forEach(row => {
    byId[row.id] = row;
  });
  const body = `const HELP_VERBIAGE_SNAPSHOT = ${JSON.stringify(byId, null, 2)};`;
  const start = src.indexOf("const HELP_VERBIAGE_SNAPSHOT");
  const end = src.indexOf("/* help-verbiage-snapshot:end */");
  if (start < 0 || end < 0 || end < start) throw new Error("snapshot markers missing");
  return `${src.slice(0, start)}${body}\n  ${src.slice(end)}`;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function buildSnapshotRecords() {
  const core = require("../functions/help-verbiage-core");
  const catalog = require("../functions/botdee-whats-new-catalog");
  const changelog = require("../functions/botdee-version-changelog.json");
  const publicRows = JSON.parse(fs.readFileSync(PUBLIC_OUT, "utf8"));
  const seeds = [
    ...core.versionSeedRecords(publicRows),
    ...core.whatsNewSeedRecords(changelog, catalog)
  ];
  return core.pagesSnapshot(seeds);
}

function writeSnapshot(records) {
  writeJson(SNAPSHOT_JSON, records);
  fs.writeFileSync(REPO, embedSnapshot(fs.readFileSync(REPO, "utf8"), records));
  fs.writeFileSync(SNAPSHOT, snapshotModule(records));
}

function rebuildDerived() {
  fs.writeFileSync(CLASSES, serializeClasses(buildManifest(ROOT)));
  fs.writeFileSync(SEARCH, serializeCatalog(buildCatalog(ROOT)));
}

function check() {
  if (fs.existsSync(MASTER_JSON)) {
    throw new Error("functions/help-verbiage-master-source.json must not be in git. Seed Firestore instead.");
  }
  const publicRows = JSON.parse(fs.readFileSync(PUBLIC_OUT, "utf8"));
  const masterAudiences = JSON.parse(fs.readFileSync(MASTER_AUDIENCES, "utf8"));
  const live = loadEntries(REPO).map(pack).sort((a, b) => a.id.localeCompare(b.id));
  const liveIds = new Set(live.map(row => row.id));
  masterAudiences.forEach(row => {
    if (!isMasterOnly(row)) throw new Error(`${row.id} is not master-only`);
    if (liveIds.has(row.id)) throw new Error(`${row.id} is still in the Pages script`);
  });
  if (JSON.stringify(live) !== JSON.stringify(publicRows)) {
    throw new Error("functions/help-verbiage-public-source.json is stale");
  }
  const snapshot = buildSnapshotRecords();
  if (snapshot.some(isMasterOnly)) throw new Error("snapshot contains master-only help");
  const embedded = fs.readFileSync(REPO, "utf8");
  if (!embedded.includes(JSON.stringify(snapshot[0] && snapshot[0].id))) {
    throw new Error("Pages script is missing the public snapshot");
  }
  console.log(`help verbiage sources ok (${publicRows.length} public, ${masterAudiences.length} master audiences, ${snapshot.length} snapshot)`);
}

function extract() {
  const before = loadEntries(REPO);
  const master = before.filter(isMasterOnly);
  if (master.length) {
    throw new Error(`Master-only help is in the Pages script (${master.map(row => row.id).join(", ")}). Remove it there and seed Firestore with scripts/seed-help-verbiage-master.js. This script does not write functions/help-verbiage-master-source.json.`);
  }
  if (fs.existsSync(MASTER_JSON)) {
    throw new Error("Refusing to leave functions/help-verbiage-master-source.json in the tree.");
  }
  const publicRows = before.map(pack).sort((a, b) => a.id.localeCompare(b.id));
  writeJson(PUBLIC_OUT, publicRows);
  writeSnapshot(buildSnapshotRecords());
  rebuildDerived();
  console.log(`Wrote ${publicRows.length} public help entries`);
}

if (process.argv.includes("--check")) check();
else extract();
