#!/usr/bin/env node
/* s3.1.34 → s3.1.35 stamp bump: FloqAi links always carry the current package (no stale fallback), static hub
 * links follow the package, Staff Scheduling gets an "Assign to" name picker and full localization.
 * Usage: node scripts/bump-s3-1-35.js [repoRoot]  (idempotent; runs on main's own copies from the publish script).
 * Xibo URLs (display.html?location=) never carry ?v=. */
"use strict";

const fs = require("fs");
const path = require("path");

const NEXT = "s3.1.35";
const NEXT_NUM = NEXT.slice(1);
const NEW_TESTS = ["scheduling-assignee-picker.test.js"];
const CHANGED_ASSETS = [
  "floqai-help-repository.js",
  "intent-search.js",
  "assignment-card.js",
  "worker-confirm.js",
  "scheduling-portal.js",
  "scheduling-assignee-picker.js"
];
const HUB_LINK = /(\.\/(?:floqai|scheduling|patron-portal|admin|master-admin)\.html\?(?:[^"'\s#<>]*?(?:&amp;|&))?v=)[^"'&\s#<>]+/g;
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const at = file => path.join(root, file);
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  edit(file, src => {
    let out = src.replace(/floqr-nav\.js\?v=[^"'&\s]+/g, `floqr-nav.js?v=${NEXT}`);
    out = out.replace(HUB_LINK, `$1${NEXT}`);
    const loadsChanged = CHANGED_ASSETS.some(asset => out.includes(`${asset}?v=`));
    for (const asset of CHANGED_ASSETS) {
      out = out.replace(new RegExp(`${esc(asset)}\\?v=[^"'&\\s]+`, "g"), `${asset}?v=${NEXT}`);
    }
    if (loadsChanged) out = out.replace(/floqr-i18n\.js\?v=[^"'&\s]+/g, `floqr-i18n.js?v=${NEXT}`);
    return out;
  });
}

edit("scheduling.html", src => {
  if (!/searchParams\.set\("v", "[^"]+"\)/.test(src)) throw new Error("scheduling.html: notify redirect v not found");
  return src.replace(/searchParams\.set\("v", "[^"]+"\)/, `searchParams.set("v", "${NEXT}")`);
});

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
  const note = `- ${NEXT}: FloqAi and help links always carry the current package — no old "29.09" fallback when a page loads them before floqr-nav.js, and static hub links (FloqAi, Scheduling, My Profile, Club Admin, Master Admin) follow each release. Staff Scheduling: "Assignee uid" becomes an "Assign to" picker that lists people by name and role (club team, promoting-company team, service members; Master Admins see the FLOQR directory) and fills their email / phone for notify. Every label and status on the page, plus the shift confirm list and assignment cards, is translated in all 11 languages.`;
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
});

console.log(`bumped to ${NEXT} in ${root}`);
