#!/usr/bin/env node
/* s3.1.30/31 → s3.1.32 stamp bump: FLOQRNav.appVersion catches up with the package, and system mail logs
 * never store sign-in / SOS2FA codes. Usage: node scripts/bump-s3-1-32.js [repoRoot]  (idempotent; runs on
 * main's own copies from the publish script). Only floqr-nav.js and master-mail-logging.js changed on the
 * client, so only their ?v= move. Xibo URLs (display.html?location=) never carry ?v=. */
"use strict";

const fs = require("fs");
const path = require("path");

const NEXT = "s3.1.32";
const NEXT_NUM = NEXT.slice(1);
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

edit("master-admin.html", src => {
  if (!/master-mail-logging\.js\?v=[^"]+/.test(src)) throw new Error("master-admin.html: master-mail-logging.js not loaded");
  return src.replace(/master-mail-logging\.js\?v=[^"]+/, `master-mail-logging.js?v=${NEXT}`);
});

edit("functions/package.json", src => {
  if (!/"version": "3\.1\.\d+"/.test(src)) throw new Error("package.json version");
  let out = src.replace(/"version": "3\.1\.\d+"/, `"version": "${NEXT_NUM}"`);
  for (const testFile of ["mail-log-redaction.test.js", "app-version-sync.test.js"]) {
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
  const note = `- ${NEXT}: In-app links (Venue Links, FloqAi, Inbox, Back) now carry the current package instead of s3.1.26. System mail logs never store sign-in or SOS2FA codes: the body of a code email is not kept (only its template and a masked preview), and any code in other mail subjects or bodies is masked.`;
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
});

console.log(`bumped to ${NEXT} in ${root}`);
