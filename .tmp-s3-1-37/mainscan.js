// Served sources on origin/main that the codemod would change (versioned page links), excluding my changed files.
const {execSync} = require("child_process");
const {stripPageLinkVersions} = require("../scripts/strip-page-link-versions.js");
const sh = cmd => execSync(cmd, {encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "ignore"]});
const mine = new Set(sh("git diff --name-only a78e663~1 a78e663").split(/\r?\n/).filter(Boolean));
const files = sh("git ls-tree -r --name-only origin/main").split(/\r?\n/)
  .filter(f => /^(?:functions\/)?[^/]+\.(?:js|html)$/.test(f) && !/\.test\.js$/.test(f));
for (const f of files) {
  if (mine.has(f) && !/\.html$/.test(f)) continue;
  const src = sh(`git show origin/main:${f}`).replace(/\r\n/g, "\n");
  const out = stripPageLinkVersions(src);
  if (out !== src) {
    const a = src.split("\n"), b = out.split("\n");
    const lines = a.map((l, i) => l !== b[i] ? i + 1 : 0).filter(Boolean).slice(0, 5);
    console.log(f, "lines", lines.join(","), mine.has(f) ? "(mine, bump handles html)" : "");
  }
}
