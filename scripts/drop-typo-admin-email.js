#!/usr/bin/env node
/* s3.1.26 Phase 0: drop the unowned typo admin address (no Auth account exists for it) from every admin list.
 * Usage: node scripts/drop-typo-admin-email.js [rootDir]   (rootDir defaults to the repo; the Pages publish runs it on main) */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const TYPO = "bands.don@gmail.com";
const REAL = "bans.don@gmail.com";

const files = [
  "shared-data.js", "sos2fa.js", "feature-gates.js", "floqr-feature-services.js",
  "onboard-dc-venues.html", "seed-v29-09-14.html", "FLOQR-WORDLIST.md",
  "firestore.rules", "storage.rules", "functions/admin-trust.js"
];

let touched = 0;
for (const rel of files) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  if (!before.includes(TYPO)) continue;
  const after = before
    // list entry followed by the real address: drop the typo entry (inline or one-per-line)
    .replace(new RegExp(`"${TYPO.replace(/\./g, "\\.")}",(\\s*)"${REAL.replace(/\./g, "\\.")}"`, "g"), `"${REAL}"`)
    // any remaining occurrence (sole entry / prose) becomes the real owner address
    .split(TYPO).join(REAL);
  fs.writeFileSync(file, after);
  touched += 1;
  console.log(`${rel}: typo admin address removed`);
}
if (!touched) console.log("no typo admin address found");
