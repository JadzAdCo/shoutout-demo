#!/usr/bin/env node
/* s3.1.39 → s3.1.40 bump (idle board text: never truncated, one size for every row).
 * Every HTML page: strip v= from page links, re-stamp every asset tag ?v= (script / link / image) to NEXT.
 * Every served script (top level + functions/, not tests): strip v= from page links. admin-scheduling.js (owner: never
 * edit) and functions/ai-discovery-functions.js (deferred open-relay mailers) are left alone.
 * Usage: node scripts/bump-s3-1-40.js [repoRoot]  (idempotent; runs on main's own copies from the publish script).
 * Library: require(...).transformHtml(src) for staging a clean copy of a file that has someone else's edits. */
"use strict";

const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("./strip-page-link-versions.js");

const NEXT = "s3.1.40";
const NEXT_NUM = NEXT.slice(1);
const NEW_TESTS = ["idle-board-fit.test.js"];
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
    const note = `- ${NEXT}: Idle board text. "Use ShoutOut @ {club}" now always shows the whole club name on every board size (64×32 used to drop words, e.g. Heist lost "Washington DC"). The words wrap onto as many rows as needed, "@" stays with ShoutOut, and every row uses the same letter size - the largest that fits inside the board's safe margins. Display 2's idle screen (Be a SupRstar @ {club}) also fits on 64×32 boards now. Patron ShoutOuts, their 48-character limit and their sizing are unchanged.`;
    return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
  });

  console.log(`bumped to ${NEXT} in ${root}`);
}

if (require.main === module) run(path.resolve(process.argv[2] || path.join(__dirname, "..")));

module.exports = {NEXT, transformHtml};
