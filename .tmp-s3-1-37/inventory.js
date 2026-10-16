"use strict";
// Inventory every place a page link may carry v=. Usage: node .tmp-s3-1-37/inventory.js [js|html|fn]
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const mode = process.argv[2] || "js";
const ASSET = /\.(?:js|css|png|jpe?g|gif|svg|webp|mp4|webm|json|ico|woff2?)\?v=/i;

function list(dir, ext) {
  return fs.readdirSync(path.join(root, dir)).filter((n) => n.endsWith(ext)).map((n) => path.join(dir, n));
}

if (mode === "html") {
  for (const f of list(".", ".html")) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    const hits = [...src.matchAll(/[^\s"'`(]*\.html\?[^"'`\s<>)]*\bv=[^"'`\s<>)&]*/g)].map((m) => m[0]);
    const other = [...src.matchAll(/(?:searchParams\.set\(\s*["']v["']|[?&]v=["'`]?\s*\+|\bv:\s*["'])/g)].map((m) => m[0]);
    if (hits.length || other.length) console.log(f, hits.length, other.length, [...new Set(hits)].slice(0, 4).join(" | "), other.slice(0, 3).join(" | "));
  }
} else {
  const files = mode === "fn" ? list("functions", ".js").filter((f) => !/\.test\.js$/.test(f)) : list(".", ".js");
  for (const f of files) {
    const lines = fs.readFileSync(path.join(root, f), "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.length > 4000) {
        const m = line.match(/.{0,60}(?:[?&]v=|searchParams\.set\(\s*["']v["']|\{\s*v\s*[:,}]|\bv:\s*APP_V|appVersion).{0,60}/g);
        if (m) m.filter((s) => !ASSET.test(s)).forEach((s) => console.log(`${f}:${i + 1}: [long] ${s}`));
        return;
      }
      if (/[?&]v=|searchParams\.set\(\s*["']v["']|[{,]\s*v\s*[:,}]|\bv:\s*(?:APP_V|CURRENT|window|global|appV|v\b)|appVersion|currentVersion\(\)|stampCurrentVersion/.test(line) && !ASSET.test(line)) {
        console.log(`${f}:${i + 1}: ${line.trim().slice(0, 200)}`);
      }
    });
  }
}
