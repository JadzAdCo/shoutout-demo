#!/usr/bin/env node
/* s3.1.32 → s3.1.33 stamp bump (security patch): SMS / WhatsApp logs never store the club daily code or any
 * other one-time code. Usage: node scripts/bump-s3-1-33.js [repoRoot]  (idempotent; runs on main's own copies
 * from the publish script). No client asset changed, so only floqr-nav.js (APP_V) and its ?v= move.
 * Xibo URLs (display.html?location=) never carry ?v=. */
"use strict";

const fs = require("fs");
const path = require("path");

const NEXT = "s3.1.33";
const NEXT_NUM = NEXT.slice(1);
const NEW_TESTS = ["twilio-log-redaction.test.js"];
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
  const note = `- ${NEXT}: Security patch. SMS and WhatsApp logs (Twilio SMS / WhatsApp / feature / compliance logs, club message deliveries and inbound replies, Twilio debugger events) never store the club daily code, sign-in codes, passcodes or recovery codes; they are masked before the row is written. Stored Twilio request paths no longer show the full Account SID.`;
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
});

console.log(`bumped to ${NEXT} in ${root}`);
