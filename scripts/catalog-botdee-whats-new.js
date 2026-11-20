#!/usr/bin/env node
/* Catalogue README / bundled changelog for BOT DEE What's New.
   Default: dry-run rules. --apply writes audiences + whatsNewText onto
   functions/botdee-version-changelog.json. --gemini is optional review
   (GEMINI_API_KEY from env only — never argv). Runtime Version SMARTview
   still uses functions/botdee-whats-new-catalog.js rules, not this HTTP. */
"use strict";

const fs = require("fs");
const path = require("path");
const catalog = require("../functions/botdee-whats-new-catalog");

const ROOT = path.resolve(__dirname, "..");
const CHANGELOG = path.join(ROOT, "functions", "botdee-version-changelog.json");
const MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    gemini: argv.includes("--gemini")
  };
}

function loadRows() {
  return JSON.parse(fs.readFileSync(CHANGELOG, "utf8"));
}

async function reviewWithGemini(rows) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    console.log("Gemini review skipped (GEMINI_API_KEY not set). Rules still applied.");
    return null;
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{role: "user", parts: [{text: catalog.geminiCatalogPrompt(rows)}]}],
      generationConfig: {responseMimeType: "application/json", temperature: 0}
    })
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini review failed HTTP ${response.status}`);
  }
  let payload = {};
  try { payload = JSON.parse(bodyText); } catch (_) {}
  const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n") || bodyText;
  const clean = String(text || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean);
  } catch (_) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

function annotate(rows, classified) {
  const byId = new Map(classified.map(row => [row.id, row]));
  return rows.map(row => {
    const hit = byId.get(row.id);
    if (!hit) return row;
    const next = {
      id: row.id,
      text: row.text,
      audiences: hit.keep ? [hit.audience] : [hit.audience || catalog.AUDIENCE.other],
      whatsNewText: hit.keep ? hit.text : undefined
    };
    if (!next.whatsNewText) delete next.whatsNewText;
    return next;
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const rows = loadRows();
  let classified = rows.map(row => catalog.classifyItem(row));
  if (flags.gemini) {
    const proposal = await reviewWithGemini(rows);
    if (proposal) classified = catalog.mergeGeminiProposal(rows, proposal);
  }
  const stay = classified.filter(row => row.keep);
  const drop = classified.filter(row => !row.keep);
  console.log(`BOT DEE What's New stay (${stay.length}):`);
  stay.forEach(row => console.log(`  KEEP ${row.text}`));
  console.log(`Drop from Version SMARTview (${drop.length}):`);
  drop.forEach(row => console.log(`  DROP ${row.id}: ${catalog.stripId(row.text)} (${row.reason})`));
  if (!flags.apply) {
    console.log("Dry run. Pass --apply to write audiences onto functions/botdee-version-changelog.json.");
    return;
  }
  const next = annotate(rows, classified);
  fs.writeFileSync(CHANGELOG, `${JSON.stringify(next, null, 2)}\n`);
  console.log("Wrote", CHANGELOG);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
