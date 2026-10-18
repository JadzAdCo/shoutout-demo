#!/usr/bin/env node
/* s3.1.71 → s3.1.72 bump. Page links never carry ?v=; re-stamp asset tags.
 * Usage: node scripts/bump-s3-1-72.js [repoRoot] */
"use strict";

const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("./strip-page-link-versions.js");

const NEXT = "s3.1.72";
const NEXT_NUM = NEXT.slice(1);
const NEW_TESTS = [];
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

  edit("ai-diagnostics-service.js", src => {
    let out = src.replace(/PREVIEW_LINKS_PACKAGE = "s3\.1\.\d+"/, `PREVIEW_LINKS_PACKAGE = "${NEXT}"`);
    if (!out.includes(`version: "${NEXT}"`)) {
      out = out.replace(
        /const PACKAGE_INSTALL_CHECKS = \[/,
        `const PACKAGE_INSTALL_CHECKS = [\n    {\n      version: "${NEXT}",\n      label: "VIP map/list state sync",\n      checks: [\n        {label:"VIP app available states", file:"vip-app.js", includes:["states[id] = \\"available\\""]},\n        {label:"Aurelia neutral SVG", file:"vip-plans/aurelia-floor-map.svg", includes:["data-state=\\"neutral\\""], notIncludes:[">Booked<"]},\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"${NEXT}\\""]}\n      ]\n    },`
      );
    }
    return out;
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
    const note = `- ${NEXT}: VIP map/list booked vs available sync — Aurelia floor SVG status-neutral; setStates includes available; overlay owns live status.`;
    return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
  });

  console.log(`bumped to ${NEXT} in ${root}`);
}

if (require.main === module) run(path.resolve(process.argv[2] || path.join(__dirname, "..")));

module.exports = {NEXT, transformHtml};
