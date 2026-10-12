#!/usr/bin/env node
/* s3.1.37 → s3.1.38 bump (Shiloh, Aurelia-exclusive cat template).
 * Every HTML page: strip v= from page links, re-stamp every asset tag ?v= (script / link / image) to NEXT.
 * Every served script (top level + functions/, not tests): strip v= from page links. admin-scheduling.js (owner: never
 * edit) and functions/ai-discovery-functions.js (deferred open-relay mailers) are left alone.
 * Usage: node scripts/bump-s3-1-38.js [repoRoot]  (idempotent; runs on main's own copies from the publish script).
 * Library: require(...).transformHtml(src) for staging a clean copy of a file that has someone else's edits. */
"use strict";

const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("./strip-page-link-versions.js");

const NEXT = "s3.1.38";
const NEXT_NUM = NEXT.slice(1);
const NEW_TESTS = ["shiloh-template.test.js"];
const EXEMPT = ["admin-scheduling.js", "functions/ai-discovery-functions.js"];
const ASSET_REF = /((?:src|href)\s*=\s*["']\.?\/?[^"'?#\s]+\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|json|webmanifest|woff2?)\?v=)[^"'&#\s]*/gi;

function transformHtml(src) {
  return stripPageLinkVersions(src).replace(ASSET_REF, `$1${NEXT}`);
}

function run(root) {
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

  for (const file of fs.readdirSync(root).filter(name => name.endsWith(".html"))) edit(file, transformHtml);

  const servedJs = [
    ...fs.readdirSync(root).filter(name => name.endsWith(".js")),
    ...fs.readdirSync(at("functions")).filter(name => name.endsWith(".js") && !name.endsWith(".test.js")).map(name => `functions/${name}`)
  ].filter(file => !EXEMPT.includes(file));
  for (const file of servedJs) edit(file, stripPageLinkVersions);

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
    const note = `- ${NEXT}: New Aurelia-exclusive ShoutOut template Shiloh ($30). Shiloh the cat sits on the left of the board and the patron's message glows in white on the dark side beside her; emoji are welcome. Offered only at Aurelia, flagged for every LED size (96×48, 64×48, 64×32) so it plays on whichever boards Aurelia has. Patron help and FloqAi search ("Shiloh", "cat template") in all 11 languages.`;
    return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
  });

  console.log(`bumped to ${NEXT} in ${root}`);
}

if (require.main === module) run(path.resolve(process.argv[2] || path.join(__dirname, "..")));

module.exports = {NEXT, transformHtml};
