"use strict";
// Lists ad i18n keys referenced by the ad UI with their English fallback, and whether floqr-i18n.js has them.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const files = ["floqr-ad-composer.js", "patron-ad-campaigns.js", "admin-spot-ads.js", "patron-app.js", "index.html", "patron-portal.html", "admin.html", "master-admin.html", "ad-submit.html", "ad-submit-app.js", "ad-invoice.html", "ad-invoice-app.js"];
const i18n = fs.readFileSync(path.join(root, "floqr-i18n.js"), "utf8");
const found = new Map();
for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, "utf8");
  for (const m of src.matchAll(/\bT\(\s*"((?:ads?|adsubmit|adinvoice)\.[\w.]+)"\s*,\s*"((?:[^"\\]|\\.)*)"/g)) found.set(m[1], m[2]);
  for (const m of src.matchAll(/\bt\(\s*"((?:ads?|adsubmit|adinvoice)\.[\w.]+)"\s*,\s*"((?:[^"\\]|\\.)*)"/g)) found.set(m[1], m[2]);
  for (const m of src.matchAll(/data-i18n="((?:ads?|adsubmit|adinvoice|master\.ad)[\w.]*)"[^>]*>([^<]*)</g)) if (!found.has(m[1])) found.set(m[1], m[2]);
}
const rows = [...found.entries()].sort().map(([k, v]) => ({key: k, en: v, inPack: i18n.includes(`"${k}":`)}));
const missing = rows.filter(r => !r.inPack);
console.log(`${rows.length} keys referenced, ${missing.length} missing from floqr-i18n.js`);
console.log(JSON.stringify(Object.fromEntries(missing.map(r => [r.key, r.en])), null, 1));
