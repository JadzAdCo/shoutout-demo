const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("../scripts/strip-page-link-versions.js");
const root = path.join(__dirname, "..");
const mode = process.argv[2] || "summary";
const dirs = [root, path.join(root, "functions")];
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(js|html)$/.test(f) || /\.test\.js$/.test(f)) continue;
    const p = path.join(dir, f);
    const src = fs.readFileSync(p, "utf8");
    const out = stripPageLinkVersions(src);
    const rel = path.relative(root, p);
    if (mode === "summary" && out !== src) {
      const a = src.split("\n"), b = out.split("\n");
      let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
      console.log(rel, n);
    }
    if (mode === "diff" && out !== src && (!process.argv[3] || rel === process.argv[3])) {
      const a = src.split("\n"), b = out.split("\n");
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) console.log(`${rel}:${i + 1}\n- ${a[i].trim().slice(0, 220)}\n+ ${b[i].trim().slice(0, 220)}`);
    }
    if (mode === "left") {
      out.split("\n").forEach((line, i) => {
        if (/[?&]v=|searchParams\.set\(\s*["']v["']|\bv\s*:\s*(APP_V|"\d|"s\d|window\.FLOQRNav)/.test(line) && !/\.(js|css|png|jpe?g|svg|webp)\?v=/.test(line.replace(/[^]*/, m => m)) ) {
          console.log(`${rel}:${i + 1}: ${line.trim().slice(0, 200)}`);
        }
      });
    }
  }
}
