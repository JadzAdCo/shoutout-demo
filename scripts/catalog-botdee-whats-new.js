#!/usr/bin/env node
/* Catalogue README / bundled changelog for BOT DEE What's New.
   Default: dry-run rules. --apply writes audiences + whatsNewText onto
   functions/botdee-version-changelog.json. --gemini is optional review.
   --patron rewrites kept lines into patron language with the same
   gemini-3.6-flash path (GEMINI_API_KEY from env only — never argv).
   Runtime Version SMARTview still uses the checked-in lines, not this HTTP. */
"use strict";

const fs = require("fs");
const path = require("path");
const catalog = require("../functions/botdee-whats-new-catalog");
const patron = require("../functions/botdee-patron-language");

const ROOT = path.resolve(__dirname, "..");
const CHANGELOG = path.join(ROOT, "functions", "botdee-version-changelog.json");
const MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    gemini: argv.includes("--gemini"),
    patron: argv.includes("--patron")
  };
}

function loadRows() {
  return JSON.parse(fs.readFileSync(CHANGELOG, "utf8"));
}

async function postGemini(prompt) {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return {skipped: true};
  const request = patron.geminiGenerateRequest(prompt, apiKey);
  if (request.model !== MODEL) {
    throw new Error(`Gemini model ${request.model} does not match ${MODEL}`);
  }
  const response = await fetch(request.url, request.init);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini request failed HTTP ${response.status}`);
  }
  let payload = {};
  try { payload = JSON.parse(bodyText); } catch (_) {}
  const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n") || bodyText;
  return patron.parseGeminiJson(text);
}

async function reviewWithGemini(rows) {
  const proposal = await postGemini(catalog.geminiCatalogPrompt(rows));
  if (proposal && proposal.skipped) {
    console.log("Gemini review skipped (GEMINI_API_KEY not set). Rules still applied.");
    return null;
  }
  return proposal;
}

async function patronRewrite(rows) {
  const kept = rows.filter(row => catalog.classifyItem({...row, whatsNewText: ""}).keep);
  const proposal = await postGemini(patron.geminiPatronPrompt(kept));
  if (proposal && proposal.skipped) {
    console.log("Gemini patron rewrite skipped (GEMINI_API_KEY not set). Checked-in lines stay.");
    return null;
  }
  return proposal;
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
  let rows = loadRows();
  if (flags.patron) {
    const proposal = await patronRewrite(rows);
    if (proposal) rows = catalog.applyPatronProposal(rows, proposal);
  }
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
