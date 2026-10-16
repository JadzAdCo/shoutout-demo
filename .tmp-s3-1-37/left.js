const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const PAT = /([?&]|&amp;)v=|["']v["']\s*[,:)]|\bv\s*:\s*(APP_V|PACKAGE|window\.FLOQRNav|"\d|"s\d)|\{\s*v\s*[,}]/;
const ASSET = /\.(js|css|png|jpe?g|svg|webp|gif|ico|json|mp4)\?v=/g;
for (const dir of [root, path.join(root, "functions")]) {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(js|html)$/.test(f) || /\.test\.js$/.test(f)) continue;
    const p = path.join(dir, f);
    const rel = path.relative(root, p).replace(/\\/g, "/");
    fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      const stripped = line.replace(ASSET, "");
      if (PAT.test(stripped)) {
        const m = stripped.match(PAT);
        const at = Math.max(0, m.index - 90);
        console.log(`${rel}:${i + 1}: ${stripped.slice(at, m.index + 90).trim()}`);
      }
    });
  }
}
