const fs = require("fs");
for (const f of fs.readdirSync(".").filter((n) => n.endsWith(".html"))) {
  const h = fs.readFileSync(f, "utf8");
  for (const m of h.matchAll(/<header[^>]*>([\s\S]*?)<\/header>/g)) {
    const b = m[1];
    if (!/<h1/.test(b)) continue;
    const ps = [...b.matchAll(/<p[^>]*class="[^"]*\bsub\b[^"]*\bsmall\b[^"]*"[^>]*>|<[^>]*class="[^"]*helper-text[^"]*"[^>]*>/g)]
      .map((x) => x[0])
      .filter((t) => !/\bid=|data-keep-visible|class="[^"]*status/.test(t));
    const chrome = /data-floqr-auth-chrome/.test(b);
    if (ps.length || chrome) console.log(f, "convertible:", ps.length, "authChromeInHeroHeader:", chrome, ps[0] ? ps[0].slice(0, 80) : "");
  }
}
