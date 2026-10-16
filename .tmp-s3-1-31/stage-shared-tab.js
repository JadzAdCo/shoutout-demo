"use strict";
// Stage HEAD + Demo Svc / Emp Mgmt tab edits only, for files other in-progress work also touches.
const {execFileSync} = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const tmp = path.join(__dirname, "head-tree-tab");
const {applyAll, FILES} = require(path.join(root, "scripts", "apply-s3-1-31-demo-employees-tab.js"));
const git = args => execFileSync("git", args, {cwd: root});

fs.rmSync(tmp, {recursive: true, force: true});
for (const rel of FILES) {
  const out = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, git(["show", `HEAD:${rel}`]));
}
console.log("edited:", applyAll(tmp).join(", "));
for (const rel of FILES) {
  const staged = path.join(tmp, rel);
  const work = fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
  console.log(rel, work === fs.readFileSync(staged, "utf8").replace(/\r\n/g, "\n") ? "same as working copy" : "DIFFERS from working copy (other work present)");
  const sha = git(["hash-object", "-w", "--no-filters", staged]).toString().trim();
  const mode = git(["ls-files", "-s", "--", rel]).toString().split(" ")[0] || "100644";
  git(["update-index", "--cacheinfo", `${mode},${sha},${rel}`]);
}
