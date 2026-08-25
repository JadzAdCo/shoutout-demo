/**
 * Rebuild the complete floqr-i18n.js CHROME block from JSON locale packs.
 *
 * Usage: node scripts/build-i18n-chrome.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const I18N = path.join(ROOT, "floqr-i18n.js");
const VERSION = "s3.0.28";
const LOCALES = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

function loadPack(code) {
  const file = path.join(__dirname, `_chrome-${code}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing locale pack: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function findChromeRange(source) {
  const start = source.indexOf("const CHROME = {");
  if (start < 0) throw new Error("CHROME block not found");
  let depth = 0;
  let end = -1;
  for (let index = start + "const CHROME = ".length; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}") {
      depth--;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("CHROME block is not balanced");
  return { start, end };
}

function assertParity(code, pack, en, enKeys) {
  const keys = Object.keys(pack);
  const missing = enKeys.filter((key) => !Object.prototype.hasOwnProperty.call(pack, key));
  const extra = keys.filter((key) => !Object.prototype.hasOwnProperty.call(en, key));
  if (missing.length || extra.length || keys.length !== enKeys.length) {
    throw new Error(
      `${code}: keys=${keys.length}, missing=${JSON.stringify(missing)}, extra=${JSON.stringify(extra)}`
    );
  }
}

function formatLocale(code, pack, keys) {
  const body = keys.map((key, index) => {
    const comma = index === keys.length - 1 ? "" : ",";
    return `      ${JSON.stringify(key)}: ${JSON.stringify(pack[key])}${comma}`;
  });
  return [`    ${code}: {`, ...body, "    }"].join("\r\n");
}

function readChrome(source) {
  const range = findChromeRange(source);
  const literal = source.slice(range.start + "const CHROME = ".length, range.end);
  return { range, chrome: Function(`"use strict"; return (${literal});`)() };
}

function main() {
  let source = fs.readFileSync(I18N, "utf8");
  const original = readChrome(source);
  const packs = Object.fromEntries(LOCALES.map((code) => [code, loadPack(code)]));
  const en = packs.en;
  const enKeys = Object.keys(en);

  for (const code of LOCALES) assertParity(code, packs[code], en, enKeys);

  const block =
    "const CHROME = {\r\n" +
    LOCALES.map((code) => formatLocale(code, packs[code], enKeys)).join(",\r\n") +
    "\r\n  }";
  source =
    source.slice(0, original.range.start) +
    block +
    source.slice(original.range.end);

  const versionPattern = /const VERSION\s*=\s*["'][^"']+["']/;
  if (!versionPattern.test(source)) throw new Error("VERSION constant not found");
  source = source.replace(versionPattern, `const VERSION = "${VERSION}"`);
  fs.writeFileSync(I18N, source, "utf8");

  const rebuiltSource = fs.readFileSync(I18N, "utf8");
  const rebuilt = readChrome(rebuiltSource).chrome;
  const counts = Object.fromEntries(
    LOCALES.map((code) => [code, Object.keys(rebuilt[code] || {}).length])
  );
  for (const code of LOCALES) {
    assertParity(code, rebuilt[code], rebuilt.en, Object.keys(rebuilt.en));
  }
  const version = rebuiltSource.match(/const VERSION\s*=\s*["']([^"']+)["']/)[1];
  console.log(JSON.stringify({ VERSION: version, counts }, null, 2));
}

main();
