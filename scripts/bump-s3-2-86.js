#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("./strip-page-link-versions.js");
const NEXT = "s3.2.86";
const NEXT_NUM = "3.2.86";
const EXEMPT = ["admin-scheduling.js", "functions/ai-discovery-functions.js"];
const ASSET_REF = /((?:src|href)\s*=\s*["']\.?\/?[^"'?#\s]+\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|json|webmanifest|woff2?)\?v=)[^"'&#\s]*/gi;
function transformHtml(src) {
  return stripPageLinkVersions(src).replace(ASSET_REF, `$1${NEXT}`);
}
function run(root) {
  const at = file => path.join(root, file);
  const edit = (file, fn) => {
    const before = fs.readFileSync(at(file), "utf8");
    const after = fn(before);
    if (after !== before) { fs.writeFileSync(at(file), after); console.log("bumped", file); }
  };
  edit("floqr-nav.js", src => src.replace(/const APP_V = "[^"]+";/, `const APP_V = "${NEXT}";`));
  edit("floqr-chrome-scheme.js", src => {
    if (!/const ICON_V = "[^"]+";/.test(src)) return src;
    return src.replace(/const ICON_V = "[^"]+";/, `const ICON_V = "${NEXT}";`);
  });
  for (const file of fs.readdirSync(root).filter(name => name.endsWith(".html"))) edit(file, transformHtml);
  const servedJs = [
    ...fs.readdirSync(root).filter(name => name.endsWith(".js")),
    ...fs.readdirSync(at("functions")).filter(name => name.endsWith(".js") && !name.endsWith(".test.js")).map(name => `functions/${name}`)
  ].filter(file => !EXEMPT.includes(file));
  for (const file of servedJs) edit(file, stripPageLinkVersions);
  edit("floqr-i18n.js", src => src.replace(/const VERSION\s*=\s*"[^"]+"/, `const VERSION = "${NEXT}"`));
  edit("floqr-i18n-help.js", src => src.replace(/const VERSION\s*=\s*"[^"]+"/, `const VERSION = "${NEXT}"`));
  edit("ai-diagnostics-service.js", src => src
    .replace(/PREVIEW_LINKS_PACKAGE = "s3\.\d+\.\d+"/, `PREVIEW_LINKS_PACKAGE = "${NEXT}"`)
    .replace(/CURRENT_DIAGNOSTICS_PACKAGE_VERSION = "s3\.\d+\.\d+"/, `CURRENT_DIAGNOSTICS_PACKAGE_VERSION = "${NEXT}"`));
  edit("functions/package.json", src => src.replace(/"version": "[^"]+"/, `"version": "${NEXT_NUM}"`));
  edit("functions/i18n-coverage.test.js", src => src
    .replace(/floqr-i18n and help VERSION are s3\.\d+\.\d+/, `floqr-i18n and help VERSION are ${NEXT}`)
    .replace(/assert\.match\(i18n, \/const VERSION\\s\*=\\s\*"s3\.\d+\.\d+"\/\)/g, `assert.match(i18n, /const VERSION\\s*=\\s*"${NEXT}"/)`)
    .replace(/assert\.match\(help, \/const VERSION\\s\*=\\s\*"s3\.\d+\.\d+"\/\)/g, `assert.match(help, /const VERSION\\s*=\\s*"${NEXT}"/)`));
  console.log(`bumped to ${NEXT}`);
}
run(path.resolve(__dirname, ".."));
