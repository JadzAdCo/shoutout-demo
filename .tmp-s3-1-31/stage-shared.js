"use strict";
// Stage HEAD + s3.1.31 edits only for files other in-progress work also touches.
const {execFileSync} = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tmp = path.join(__dirname, "head-tree");
const {applyAll, FILES} = require(path.join(root, "scripts", "apply-s3-1-31-demo-signin-edits.js"));
const git = args => execFileSync("git", args, {cwd: root});

fs.rmSync(tmp, {recursive: true, force: true});
for (const rel of FILES) {
  const out = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, git(["show", `HEAD:${rel}`]));
}
console.log("edited:", applyAll(tmp).join(", "));
for (const rel of FILES) {
  const sha = git(["hash-object", "-w", "--no-filters", path.join(tmp, rel)]).toString().trim();
  const mode = git(["ls-files", "-s", "--", rel]).toString().split(" ")[0] || "100644";
  git(["update-index", "--cacheinfo", `${mode},${sha},${rel}`]);
  console.log(rel, sha.slice(0, 10));
}
