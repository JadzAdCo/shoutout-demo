#!/usr/bin/env node
/* s3.1.35 → s3.1.36 stamp bump: generated links never carry an empty / hardcoded v (Display boards none at all),
 * the embedded sign-in hint is a translated status line instead of a `?` on the hero h1, and helper-popouts never
 * attaches help to a hero h1.
 * Usage: node scripts/bump-s3-1-36.js [repoRoot]  (idempotent; runs on main's own copies from the publish script).
 * Xibo URLs (display.html?location=) never carry ?v=. */
"use strict";

const fs = require("fs");
const path = require("path");

const NEXT = "s3.1.36";
const NEXT_NUM = NEXT.slice(1);
const NEW_TESTS = ["session-hint-hero-help.test.js"];
const CHANGED_ASSETS = [
  "floqr-i18n.js",
  "floqai-help-repository.js",
  "intent-search.js",
  "floqai-page.js",
  "floqr-session-shell.js",
  "help-attach.js",
  "helper-popouts.js",
  "patron-portal-app.js",
  "admin-app.js"
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
    for (const asset of CHANGED_ASSETS) {
      out = out.replace(new RegExp(`(["'/])${esc(asset)}\\?v=[^"'&\\s]+`, "g"), `$1${asset}?v=${NEXT}`);
    }
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
  const note = `- ${NEXT}: FloqAi links always open as ?v=<current package>&from=floqai — never an empty v, never "?&", and Display board links never get a v. My Profile / Club Admin / sign-in links stop falling back to old package numbers. Embedded pages (My Profile Work Calendar, Scheduling) show the "signed in on My Profile" hint as a small translated status line instead of a ? beside the big page title; help is never attached to a page's hero title.`;
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
});

console.log(`bumped to ${NEXT} in ${root}`);
