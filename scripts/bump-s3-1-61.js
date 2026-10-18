#!/usr/bin/env node
/* s3.1.60 → s3.1.61 bump. Beta invite email/session handoff. */
const fs = require("fs");
const path = require("path");
const {stripPageLinkVersions} = require("./strip-page-link-versions.js");

const NEXT = process.env.FLOQR_BUMP_TO || "s3.1.61";
const NEXT_NUM = NEXT.slice(1);
const NEW_TESTS = [];
const EXEMPT = ["admin-scheduling.js", "functions/ai-discovery-functions.js"];
const ASSET_REF = /((?:src|href)\s*=\s*["']\.?\/?[^"'?#\s]+\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|json|webmanifest|woff2?)\?v=)[^"'&#\s]*/gi;
const NOTE = process.env.FLOQR_BUMP_NOTE
  || `- ${NEXT}: Beta invite email/session handoff — persist invite t=, Sign in CTA with returnTo, absolute Inbox invite URL.`;

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

  for (const file of fs.readdirSync(root).filter(name => name.endsWith(".html"))) edit(file, transformHtml);

  const servedJs = [
    ...fs.readdirSync(root).filter(name => name.endsWith(".js")),
    ...fs.readdirSync(at("functions")).filter(name => name.endsWith(".js") && !name.endsWith(".test.js")).map(name => `functions/${name}`)
  ].filter(file => !EXEMPT.includes(file));
  for (const file of servedJs) edit(file, stripPageLinkVersions);

  edit("functions/package.json", src => {
    if (!/"version": "3\.1\.\d+"/.test(src)) throw new Error("package.json version");
    let out = src.replace(/"version": "3\.1\.\d+"/, `"version": "${NEXT_NUM}"`);
    for (const testFile of NEW_TESTS) {
      if (out.includes(testFile)) continue;
      out = out.replace(/("test": "node --test [^"]+)"/, `$1 ${testFile}"`);
      if (!out.includes(testFile)) throw new Error(`package.json: could not add ${testFile}`);
    }
    return out;
  });

  edit("floqr-i18n.js", src => src.replace(/const VERSION\s*=\s*"s3\.1\.\d+"/, `const VERSION = "${NEXT}"`));
  edit("floqr-i18n-help.js", src => src.replace(/const VERSION\s*=\s*"s3\.1\.\d+"/, `const VERSION = "${NEXT}"`));
  edit("functions/i18n-coverage.test.js", src => src
    .replace(/floqr-i18n and help VERSION are s3\.1\.\d+/, `floqr-i18n and help VERSION are ${NEXT}`)
    .replace(/\/const VERSION\\s\*=\\s\*"s3\.1\.\d+"\//g, `/const VERSION\\s*=\\s*"${NEXT}"/`));

  edit("ai-diagnostics-service.js", src => src.replace(
    /const PREVIEW_LINKS_PACKAGE = "s3\.1\.\d+";/,
    `const PREVIEW_LINKS_PACKAGE = "${NEXT}";`
  ));

  edit("README.md", src => {
    const head = /# CURRENT PACKAGE: FLOQR ShoutOut s3\.1\.\d+ \(stable\)/;
    if (!head.test(src)) throw new Error("README head");
    if (src.includes(`# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)`) && src.includes(`- ${NEXT}:`)) return src;
    const eol = src.includes("\r\n") ? "\r\n" : "\n";
    let out = src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)`);
    if (!out.includes(`- ${NEXT}:`)) {
      out = out.replace(
        `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)`,
        `# CURRENT PACKAGE: FLOQR ShoutOut ${NEXT} (stable)${eol}${eol}${NOTE}`
      );
    }
    return out;
  });

  console.log(`bumped to ${NEXT} in ${root}`);
}

if (require.main === module) run(path.resolve(process.argv[2] || path.join(__dirname, "..")));

module.exports = {NEXT, transformHtml};
