"use strict";
const {execFileSync} = require("child_process");
const path = require("path");
const root = path.resolve(__dirname, "..");
const {transformHtml} = require(path.join(root, "scripts", "bump-s3-1-38.js"));
const git = (args, input) => execFileSync("git", args, {cwd: root, input, encoding: "utf8"}).trim();

for (const file of process.argv.slice(2)) {
  const head = git(["show", `HEAD:${file}`]);
  const raw = execFileSync("git", ["show", `HEAD:${file}`], {cwd: root}).toString("utf8");
  const bumped = transformHtml(raw);
  if (bumped === raw) { console.log("unchanged", file); continue; }
  const mode = git(["ls-files", "-s", "--", file]).split(/\s+/)[0];
  const sha = git(["hash-object", "-w", "--stdin"], bumped);
  git(["update-index", "--cacheinfo", `${mode},${sha},${file}`]);
  console.log("staged clean bump", file, head.length !== raw.trim().length ? "" : "");
}
