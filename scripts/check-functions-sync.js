#!/usr/bin/env node
/* Fails unless the workspace commit carries exactly main's Functions source (functions/, firestore.rules,
 * storage.rules). Functions deploy from a clean archive of origin/main; a workspace that lags main and deploys
 * would roll production back. Design notes: .cursor/rules/post-deploy-qc.mdc
 *
 *   node scripts/check-functions-sync.js [--workspace <ref>] [--main <ref>] [--no-fetch] [--repo <dir>]
 */
"use strict";
const {execFileSync} = require("child_process");
const path = require("path");

const PATHS = ["functions/", "firestore.rules", "storage.rules"];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const repo = path.resolve(arg("--repo", path.join(__dirname, "..")));
const workspaceRef = arg("--workspace", "HEAD");
const mainRef = arg("--main", "origin/main");
const git = args => execFileSync("git", ["-C", repo, ...args], {encoding: "utf8"}).trim();

if (!process.argv.includes("--no-fetch")) {
  git(["fetch", "-q", "origin", "main"]);
}
const differing = git(["diff", "--name-status", mainRef, workspaceRef, "--", ...PATHS]).split(/\r?\n/).filter(Boolean);
if (differing.length) {
  console.error(`Functions source differs between ${workspaceRef} and ${mainRef} (${differing.length} files):`);
  differing.forEach(line => console.error(`  ${line}`));
  console.error(`Sync first: git checkout ${mainRef} -- <files>, commit, push. Deploy only from a clean archive of ${mainRef}.`);
  process.exit(1);
}
console.log(`Functions source in sync: ${workspaceRef} == ${mainRef} (${git(["rev-parse", "--short", mainRef])}) for ${PATHS.join(", ")}`);
