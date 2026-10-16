const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const files = {
  "intent-search.js": '"29.09.48"',
  "floqai-help-repository.js": '"29.09.49"'
};

for (const [file, fallback] of Object.entries(files)) {
  const full = path.join(root, file);
  let src = fs.readFileSync(full, "utf8");
  const before = src;
  src = src.replace(
    `const APP_V = (global.FLOQRNav && global.FLOQRNav.appVersion) || ${fallback};`,
    "function appV() {\n    return (global.FLOQRNav && global.FLOQRNav.appVersion) || \"\";\n  }"
  );
  const nl = src.includes("\r\n") ? "\r\n" : "\n";
  src = src.replace(
    /const qs = new URLSearchParams\(\{v: APP_V, \.\.\.params\}\);\r?\n    return `\$\{path\}\?\$\{qs\.toString\(\)\}`;/,
    () => `const v = appV();${nl}    const qs = new URLSearchParams(v ? {v, ...params} : {...params}).toString();${nl}    return qs ? \`\${path}?\${qs}\` : path;`
  );
  src = src.replace("function appV() {\n    return", `function appV() {${nl}    return`).replace("|| \"\";\n  }", `|| "";${nl}  }`);
  src = src.replace(/`\.\/\?v=\$\{APP_V\}&start=(\w+)`/g, 'vUrl("./", {start: "$1"})');
  src = src.replace(/`\.\/floqai\.html\?v=\$\{APP_V\}`/g, 'vUrl("./floqai.html")');
  src = src.replace(/`\.\/master-admin\.html\?v=\$\{APP_V\}#(\w+)`/g, '`${vUrl("./master-admin.html")}#$1`');
  src = src.replace(/href="\.\/\?v=\$\{APP_V\}&start=search"/g, 'href="${esc(vUrl("./", {start: "search"}))}"');
  if (/APP_V/.test(src)) throw new Error(`${file}: APP_V still referenced`);
  if (src === before) throw new Error(`${file}: no change`);
  fs.writeFileSync(full, src);
  console.log("updated", file);
}
