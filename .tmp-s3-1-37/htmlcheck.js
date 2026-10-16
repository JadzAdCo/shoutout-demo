// Lists modified top-level HTML files whose working copy differs from bump(HEAD blob).
const {execSync} = require("child_process");
const fs = require("fs");
const {transformHtml} = require("../scripts/bump-s3-1-37.js");
const files = execSync("git diff --name-only", {encoding: "utf8"}).split(/\r?\n/).filter(f => /^[^/]+\.html$/.test(f));
const tracked = execSync("git ls-files *.html", {encoding: "utf8"}).split(/\r?\n/).filter(Boolean);
for (const f of new Set([...files, ...tracked])) {
  const head = execSync(`git show HEAD:${f}`, {encoding: "utf8", maxBuffer: 64 << 20});
  const work = fs.readFileSync(f, "utf8");
  const norm = s => s.replace(/\r\n/g, "\n");
  if (norm(transformHtml(head)) !== norm(work)) console.log("DIFF", f);
}
