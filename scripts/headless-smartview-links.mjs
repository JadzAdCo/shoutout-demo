#!/usr/bin/env node
/** Headless: resolve SmartView mock action hrefs against a static server (default 127.0.0.1:8765). */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smart = require(path.join(root, "functions/botdee-smartview-core.js"));

const BASE = (process.env.FLOQR_TEST_BASE || "http://127.0.0.1:8765").replace(/\/$/, "");
const GITHUB_BASE = "https://jadzadco.github.io/shoutout-demo";

function collectHrefs() {
  const hrefs = new Set();
  smart.mockCatalog().forEach(row => {
    (row.actions || []).forEach(action => {
      if (action.href) hrefs.add(action.href);
    });
    (row.images || []).forEach(img => {
      if (img.url && img.url.startsWith("./")) hrefs.add(img.url);
    });
  });
  return [...hrefs];
}

async function check(base, href) {
  let url;
  if (href.startsWith("http://") || href.startsWith("https://")) {
    url = href;
  } else if (href.startsWith("./")) {
    url = `${base}/${href.slice(2)}`;
  } else {
    url = `${base}/${href}`;
  }
  const res = await fetch(url, {method: "HEAD", redirect: "follow"});
  return {url, status: res.status, ok: res.ok || res.status === 405};
}

async function main() {
  const hrefs = collectHrefs();
  const results = [];
  for (const href of hrefs) {
    if (href.startsWith("http")) continue;
    const local = await check(BASE, href);
    const live = await check(GITHUB_BASE, href);
    results.push({href, local, live});
  }
  let fail = 0;
  for (const row of results) {
    const pass = row.local.ok && row.live.ok;
    console.log(
      pass ? "PASS" : "FAIL",
      row.href,
      `local=${row.local.status}`,
      `live=${row.live.status}`
    );
    if (!pass) fail += 1;
  }
  if (fail) process.exit(1);
  console.log(`PASS: ${results.length} relative SmartView targets`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});