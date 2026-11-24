#!/usr/bin/env node
/* Builds functions/bot-dee-search-catalog.json — searchable BOT DEE help + intent rows
   for executeBotSession contextualSearch (filtered server-side by classification).
   Usage: node scripts/build-bot-dee-search-catalog.js [--check] */
"use strict";

const fs = require("fs");
const path = require("path");
const {loadBrowserModules} = require("./build-botdee-content-classes");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "functions", "bot-dee-search-catalog.json");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9@\s._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniquePhrases(list) {
  const out = [];
  (list || []).forEach(value => {
    const phrase = normalize(value).slice(0, 160);
    if (phrase && !out.includes(phrase) && out.length < 24) out.push(phrase);
  });
  return out;
}

function publishedHelp(root = ROOT) {
  const file = path.join(root, "functions", "help-verbiage-public-snapshot.json");
  if (!fs.existsSync(file)) return {};
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const audiences = Array.isArray(row && row.audiences) ? row.audiences : [];
    if (audiences.length === 1 && audiences[0] === "masterAdmin") return;
    const title = row && row.lasttextenhun && row.lasttextenhun.title;
    const body = row && row.lasttextenhun && row.lasttextenhun.body;
    if (row && row.id && title && body) map[row.id] = {title, body};
  });
  return map;
}

function buildCatalog(root = ROOT) {
  const {repo, intents} = loadBrowserModules(root);
  const published = publishedHelp(root);
  const rows = [];

  (intents.INTENTS || []).forEach(intent => {
    const id = String(intent.id || "").trim();
    if (!id) return;
    rows.push({
      sourceId: `intent:${id}`,
      id,
      kind: intent.kind || "product",
      label: String(intent.label || id).slice(0, 120),
      blurb: String(intent.blurb || "").slice(0, 280),
      href: String(intent.href || "./botdee.html").slice(0, 240),
      phrases: uniquePhrases([intent.label, intent.blurb, ...(intent.searchPhrases || []), id])
    });
  });

  rows.push({
    sourceId: "intent:venue-search",
    id: "venue-search",
    kind: "product",
    label: "Find clubs and events",
    blurb: "Search FLOQR clubs, lounges, and events near you.",
    href: "./?start=search",
    phrases: uniquePhrases(["clubs near me", "events near me", "find a club", "venue search", "nightlife"])
  });

  (repo.entries() || []).forEach(entry => {
    const id = String(entry.id || "").trim();
    if (!id) return;
    const link = (entry.links && entry.links[0] && entry.links[0].href) || "./botdee.html";
    const copy = published[id];
    rows.push({
      sourceId: `help:${id}`,
      id,
      kind: "help",
      label: String((copy && copy.title) || entry.title || id).slice(0, 120),
      blurb: String((copy && copy.body) || entry.body || "").slice(0, 280),
      href: String(link).slice(0, 240),
      phrases: uniquePhrases([entry.title, entry.body, ...(entry.searchPhrases || []), id])
    });
  });

  rows.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  return {version: 1, entries: rows};
}

function serialize(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

if (require.main === module) {
  const next = serialize(buildCatalog());
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
    if (current !== next) {
      console.error("functions/bot-dee-search-catalog.json is stale. Run: node scripts/build-bot-dee-search-catalog.js");
      process.exit(1);
    }
    console.log("BOT DEE search catalog is up to date.");
  } else {
    fs.writeFileSync(OUT, next);
    const parsed = JSON.parse(next);
    console.log(`Wrote ${path.relative(ROOT, OUT)}: ${parsed.entries.length} entries.`);
  }
}

module.exports = {buildCatalog, serialize, OUT};
