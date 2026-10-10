#!/usr/bin/env node
/* s3.1.33 → s3.1.34 stamp bump: Staff Scheduling page signs in again (page app starts Firebase itself) and
 * "Owner id" becomes a Schedule for picker. Usage: node scripts/bump-s3-1-34.js [repoRoot]  (idempotent; runs on
 * main's own copies from the publish script). Only floqr-nav.js (APP_V) and its ?v= move here; scheduling.html
 * carries its own asset ?v=. Xibo URLs (display.html?location=) never carry ?v=. */
"use strict";

const fs = require("fs");
const path = require("path");

const NEXT = "s3.1.34";
const NEXT_NUM = NEXT.slice(1);
const NEW_TESTS = ["scheduling-owner-picker.test.js"];
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const at = file => path.join(root, file);
const edit = (file, fn) => {
  const before = fs.readFileSync(at(file), "utf8");
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(at(file), after);
    console.log("bumped", file);
  }
};

edit("floqr-nav.js", src => {
  if (!/const APP_V = "[^"]+";/.test(src)) throw new Error("floqr-nav.js: APP_V not found");
  return src.replace(/const APP_V = "[^"]+";/, `const APP_V = "${NEXT}";`);
});

for (const file of fs.readdirSync(root).filter(name => name.endsWith(".html"))) {
  edit(file, src => src.replace(/floqr-nav\.js\?v=[^"'&\s]+/g, `floqr-nav.js?v=${NEXT}`));
}

edit("functions/package.json", src => {
  if (!/"version": "3\.1\.\d+"/.test(src)) throw new Error("package.json version");
  let out = src.replace(/"version": "3\.1\.\d+"/, `"version": "${NEXT_NUM}"`);
  for (const testFile of NEW_TESTS) {
    if (out.includes(testFile)) continue;
    out = out.replace(/("test": "node --test [^"]+)"/, `$1 ${testFile}"`);
    if (!out.includes(testFile)) throw new Error(`package.json: could not add ${testFile}`);
  }
  return out;
});

edit("README.md", src => {
  const head = /# CURRENT PACKAGE: FLOQR ShoutOut s3\.1\.\d+ \(stable\)/;
  if (!head.test(src)) throw new Error("README head");
  if (src.includes(`# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)`)) return src;
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const note = `- ${NEXT}: Staff Scheduling (scheduling.html) finishes signing in again: the page app now starts Firebase itself, so a signed-in patron, Club Admin or Master Admin no longer sees "Restoring your FLOQR session…" forever. The free-text "Owner id" box is replaced by a Schedule for picker (My DJ schedule / Club / Promoting company) that lists only the clubs and companies you may manage (Master Admins get every club with search). Stored owner ids are unchanged. The Subscription card stays visible after sign-in, and choosing a club no longer writes to the club record.`;
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
});

console.log(`bumped to ${NEXT} in ${root}`);
