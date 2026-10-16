const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
for (const name of fs.readdirSync(root).filter(n => n.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(root, name), "utf8");
  const nav = html.search(/src="\.\/floqr-nav\.js/);
  for (const dep of ["floqai-help-repository.js", "intent-search.js"]) {
    const at = html.search(new RegExp(`src="\\./${dep.replace(/\./g, "\\.")}`));
    if (at >= 0 && (nav < 0 || nav > at)) console.log(`${name}: ${dep} before floqr-nav (nav=${nav})`);
  }
}
