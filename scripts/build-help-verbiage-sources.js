#!/usr/bin/env node
/* Split Master Admin–only help out of the public Pages script and refresh
   the Functions source catalogs plus the public lasttextenhun snapshot.
   Usage: node scripts/build-help-verbiage-sources.js [--check] */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {buildManifest, serialize: serializeClasses} = require("./build-botdee-content-classes");
const {buildCatalog, serialize: serializeCatalog} = require("./build-bot-dee-search-catalog");

const ROOT = path.resolve(__dirname, "..");
const REPO = path.join(ROOT, "botdee-help-repository.js");
const PUBLIC_OUT = path.join(ROOT, "functions", "help-verbiage-public-source.json");
const MASTER_OUT = path.join(ROOT, "functions", "help-verbiage-master-source.json");
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

function endOfObject(src, start) {
  let depth = 0;
  let quote = "";
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error("Unclosed help object");
}

function stripMasterEntries(src, ids) {
  let out = src;
  ids.forEach(id => {
    const needle = `id: "${id}"`;
    const at = out.indexOf(needle);
    if (at < 0) return;
    const start = out.lastIndexOf("{", at);
    const end = endOfObject(out, start);
    let cut = end + 1;
    while (out[cut] === " " || out[cut] === "\t" || out[cut] === "\r") cut += 1;
    if (out[cut] === ",") cut += 1;
    if (out[cut] === "\r") cut += 1;
    if (out[cut] === "\n") cut += 1;
    out = out.slice(0, start) + out.slice(cut);
  });
  return out;
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
  const publicRows = JSON.parse(fs.readFileSync(PUBLIC_OUT, "utf8"));
  const masterRows = JSON.parse(fs.readFileSync(MASTER_OUT, "utf8"));
  const live = loadEntries(REPO).map(pack).sort((a, b) => a.id.localeCompare(b.id));
  const liveIds = new Set(live.map(row => row.id));
  masterRows.forEach(row => {
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
  console.log(`help verbiage sources ok (${publicRows.length} public, ${masterRows.length} master, ${snapshot.length} snapshot)`);
}

function extract() {
  const before = loadEntries(REPO);
  const master = before.filter(isMasterOnly).map(pack).sort((a, b) => a.id.localeCompare(b.id));
  if (!master.length && fs.existsSync(MASTER_OUT)) {
    const publicRows = before.filter(entry => !isMasterOnly(entry)).map(pack).sort((a, b) => a.id.localeCompare(b.id));
    writeJson(PUBLIC_OUT, publicRows);
    writeSnapshot(buildSnapshotRecords());
    rebuildDerived();
    return;
  }
  writeJson(MASTER_OUT, master);
  const stripped = stripMasterEntries(fs.readFileSync(REPO, "utf8"), master.map(row => row.id));
  fs.writeFileSync(REPO, stripped);
  const after = loadEntries(REPO);
  const leaked = after.filter(isMasterOnly);
  if (leaked.length) throw new Error(`still public: ${leaked.map(row => row.id).join(", ")}`);
  const publicRows = after.map(pack).sort((a, b) => a.id.localeCompare(b.id));
  writeJson(PUBLIC_OUT, publicRows);
  writeSnapshot(buildSnapshotRecords());
  rebuildDerived();
  console.log(`Wrote ${publicRows.length} public, ${master.length} master`);
}

if (process.argv.includes("--check")) check();
else extract();
