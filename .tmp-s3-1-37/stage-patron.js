// Stage only the s3.1.37 hunks of patron-app.js: index = strip(HEAD) + safeReturnTo drop of v.
// Leaves the working copy (someone else's uncommitted hunks) untouched.
const {execSync} = require("child_process");
const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("../scripts/strip-page-link-versions.js");

const file = "patron-app.js";
const head = execSync(`git show HEAD:${file}`, {encoding: "utf8", maxBuffer: 64 << 20});
let staged = stripPageLinkVersions(head);
const anchor = '      if (/(?:^|\\/)display\\.html$/i.test(target.pathname)) return "";\n      return target.toString();';
if (staged.split(anchor).length !== 2) throw new Error("safeReturnTo anchor not found exactly once");
staged = staged.replace(anchor, anchor.replace('return "";\n', 'return "";\n      target.searchParams.delete("v");\n'));

const work = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
if (stripPageLinkVersions(work) !== work) throw new Error("working copy still has versioned links");

const tmp = path.join(__dirname, "patron-app.staged.js");
fs.writeFileSync(tmp, staged);
const sha = execSync(`git hash-object -w --no-filters "${tmp}"`, {encoding: "utf8"}).trim();
const mode = execSync(`git ls-files -s ${file}`, {encoding: "utf8"}).split(/\s+/)[0];
execSync(`git update-index --cacheinfo ${mode},${sha},${file}`);
console.log("staged", file, sha);
