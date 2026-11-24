#!/usr/bin/env node
/* Copy the site for GitHub Pages.
   functions/help-verbiage-master-source.json is not in git. If it reappears,
   this stage still leaves it out of the published tree. */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OMITTED_FILES = Object.freeze([
  "functions/help-verbiage-master-source.json"
]);
const SKIP_DIRS = new Set([".git", "_site", "node_modules"]);

function toPosix(rel) {
  return rel.split(path.sep).join("/");
}

function stagePagesSite(root, dest, omitted = OMITTED_FILES) {
  const skip = new Set(omitted);
  fs.rmSync(dest, {recursive: true, force: true});
  fs.mkdirSync(dest, {recursive: true});

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory() && SKIP_DIRS.has(ent.name)) continue;
      const abs = path.join(dir, ent.name);
      const rel = toPosix(path.relative(root, abs));
      if (skip.has(rel)) continue;
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      const out = path.join(dest, rel);
      fs.mkdirSync(path.dirname(out), {recursive: true});
      fs.copyFileSync(abs, out);
    }
  }

  walk(root);
  for (const rel of skip) {
    if (fs.existsSync(path.join(dest, rel))) {
      throw new Error(`Pages stage copied omitted file ${rel}`);
    }
  }
  return {omitted: [...skip]};
}

if (require.main === module) {
  const dest = path.resolve(process.argv[2] || path.join(ROOT, "_site"));
  stagePagesSite(ROOT, dest);
  console.log(`Staged Pages site without master help source at ${dest}`);
}

module.exports = {stagePagesSite, OMITTED_FILES};
