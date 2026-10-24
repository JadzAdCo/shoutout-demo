#!/usr/bin/env node
/* Stamp asset cache-bust tags + package markers to s3.2.59.
 * Usage: node scripts/bump-s3-2-55.js [repoRoot] */
"use strict";

const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("./strip-page-link-versions.js");

const NEXT = "s3.2.59";
const NEXT_NUM = "3.2.59";
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
    if (after !== before) {
      fs.writeFileSync(at(file), after);
      console.log("bumped", file);
    }
  };

  edit("floqr-nav.js", src => {
    if (!/const APP_V = "[^"]+";/.test(src)) throw new Error("floqr-nav.js: APP_V not found");
    return src.replace(/const APP_V = "[^"]+";/, `const APP_V = "${NEXT}";`);
  });

  edit("floqr-chrome-scheme.js", src => {
    if (!/const ICON_V = "[^"]+";/.test(src)) throw new Error("floqr-chrome-scheme.js: ICON_V not found");
    return src.replace(/const ICON_V = "[^"]+";/, `const ICON_V = "${NEXT}";`);
  });

  edit("floqr-chrome-audit.js", src => src.replace(/const VERSION = "[^"]+"/, `const VERSION = "${NEXT}"`));

  for (const file of fs.readdirSync(root).filter(name => name.endsWith(".html"))) edit(file, transformHtml);

  const servedJs = [
    ...fs.readdirSync(root).filter(name => name.endsWith(".js")),
    ...fs.readdirSync(at("functions")).filter(name => name.endsWith(".js") && !name.endsWith(".test.js")).map(name => `functions/${name}`)
  ].filter(file => !EXEMPT.includes(file));
  for (const file of servedJs) edit(file, stripPageLinkVersions);

  edit("floqr-i18n.js", src => src.replace(/const VERSION\s*=\s*"[^"]+"/, `const VERSION = "${NEXT}"`));
  edit("floqr-i18n-help.js", src => src.replace(/const VERSION\s*=\s*"[^"]+"/, `const VERSION = "${NEXT}"`));

  edit("ai-diagnostics-service.js", src => {
    return src
      .replace(/PREVIEW_LINKS_PACKAGE = "s3\.\d+\.\d+"/, `PREVIEW_LINKS_PACKAGE = "${NEXT}"`)
      .replace(/CURRENT_DIAGNOSTICS_PACKAGE_VERSION = "s3\.\d+\.\d+"/, `CURRENT_DIAGNOSTICS_PACKAGE_VERSION = "${NEXT}"`);
  });

  edit("functions/package.json", src => {
    if (!/"version": "[^"]+"/.test(src)) throw new Error("package.json version");
    return src.replace(/"version": "[^"]+"/, `"version": "${NEXT_NUM}"`);
  });

  edit("functions/i18n-coverage.test.js", src => src
    .replace(/floqr-i18n and help VERSION are s3\.\d+\.\d+/, `floqr-i18n and help VERSION are ${NEXT}`)
    .replace(/assert\.match\(i18n, \/const VERSION\\s\*=\\s\*"s3\.\d+\.\d+"\/\)/g, `assert.match(i18n, /const VERSION\\s*=\\s*"${NEXT}"/)`)
    .replace(/assert\.match\(help, \/const VERSION\\s\*=\\s\*"s3\.\d+\.\d+"\/\)/g, `assert.match(help, /const VERSION\\s*=\\s*"${NEXT}"/)`));

  edit("README.md", src => {
    const head = /# CURRENT PACKAGE: FLOQR ShoutOut s3\.\d+\.\d+[^\n]*/;
    if (!head.test(src)) throw new Error("README head");
    if (src.includes(`# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)`)) return src;
    const eol = src.includes("\r\n") ? "\r\n" : "\n";
    const note = [
      `- ${NEXT}: FloqAi chat brand (replaces BOT DEE UI copy); FloqCast CTA “Go live, start a cast”.`,
      `- s3.2.58: Black & Dark Green Search icons use Settings tings green #5ac783; Search icon order live on main.`
    ].join(eol);
    return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${note}`);
  });

  console.log(`bumped to ${NEXT} in ${root}`);
}

run(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, ".."));
