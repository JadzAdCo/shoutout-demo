#!/usr/bin/env node
"use strict";
/* Manual GitHub PR ingest for Features SMARTview. Never auto-publishes.
   Usage: GH_TOKEN or gh auth  →  node scripts/ingest-features-smartview.js
   Writes features-smartview/ingest-cache.json (gitignored). */

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");
const core = require("../features-smartview-core");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "features-smartview", "ingest-cache.json");
const OWNER = "JadzAdCo";
const REPO = "shoutout-demo";

function ghApi(url) {
  const envToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const r = spawnSync("gh", ["api", url], {encoding: "utf8", maxBuffer: 20 * 1024 * 1024});
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "gh api failed");
  }
  return JSON.parse(r.stdout);
}

function paginate() {
  const seen = {};
  let page = 1;
  let total = 0;
  for (;;) {
    const batch = ghApi(`repos/${OWNER}/${REPO}/pulls?state=all&per_page=100&page=${page}&sort=created&direction=asc`);
    if (!Array.isArray(batch) || !batch.length) break;
    const result = core.ingestPrPage(batch, seen);
    total += result.added.length;
    if (batch.length < 100) break;
    page += 1;
    if (page > 50) throw new Error("pagination safety stop");
  }
  return {seen, pages: page, added: total};
}

function main() {
  const {seen, pages, added} = paginate();
  const rows = Object.values(seen);
  const drafts = rows.map(core.mapIngestToDraft).filter(Boolean);
  const payload = {
    warning: "UNVERIFIED ingest cache. Not patron-facing. Do not copy into catalog.json without editorial review.",
    ingestedAt: new Date().toISOString(),
    repository: `${OWNER}/${REPO}`,
    pages,
    pullRequestCount: rows.length,
    added,
    drafts: drafts.length,
    items: rows
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    pullRequestCount: rows.length,
    pages,
    drafts: drafts.length,
    out: path.relative(ROOT, OUT),
    publishable: 0
  }));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = {paginate, main};
