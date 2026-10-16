const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("../scripts/strip-page-link-versions.js");
const root = path.join(__dirname, "..");
const EXCLUDE = new Set([
  "admin-scheduling.js",
  "functions/ai-discovery-functions.js",
  "functions/mail-log.js",
  "functions/display-security-functions.js",
  "functions/suprstr-functions.js",
  "display-suprstr.js", "suprstr-webrtc.js", "firebase-config.js", "floqr-logger.js", "temp-qa-images-preview.html"
]);
const changed = [];
for (const dir of [root, path.join(root, "functions")]) {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(js|html)$/.test(f) || /\.test\.js$/.test(f)) continue;
    const p = path.join(dir, f);
    const rel = path.relative(root, p).replace(/\\/g, "/");
    if (EXCLUDE.has(rel)) continue;
    const src = fs.readFileSync(p, "utf8");
    const out = stripPageLinkVersions(src);
    if (out !== src) { fs.writeFileSync(p, out); changed.push(rel); }
  }
}
console.log(changed.join("\n"));
