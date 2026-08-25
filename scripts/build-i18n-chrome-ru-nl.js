/**
 * Rebuild CHROME.de/es/nl to full en parity, add CHROME.ru, bump VERSION.
 * Usage: node scripts/build-i18n-chrome-ru-nl.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const I18N = path.join(ROOT, "floqr-i18n.js");
const PACK_DIR = __dirname;

function loadPack(name) {
  const p = path.join(PACK_DIR, `_chrome-${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function findChromeRange(src) {
  const start = src.indexOf("const CHROME = {");
  if (start < 0) throw new Error("CHROME not found");
  let i = start + "const CHROME = ".length;
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("CHROME end not found");
  return { start, end };
}

function formatLocale(code, pack, enKeys) {
  const lines = [`    ${code}: {`];
  for (let i = 0; i < enKeys.length; i++) {
    const key = enKeys[i];
    if (!(key in pack)) throw new Error(`${code} missing key ${key}`);
    const val = JSON.stringify(pack[key]);
    const comma = i < enKeys.length - 1 ? "," : "";
    lines.push(`      ${JSON.stringify(key)}: ${val}${comma}`);
  }
  lines.push("    }");
  return lines.join("\r\n");
}

function main() {
  let src = fs.readFileSync(I18N, "utf8");
  const { start, end } = findChromeRange(src);
  const chromeSrc = src.slice(start + "const CHROME = ".length, end);
  const CHROME = eval("(" + chromeSrc + ")");
  const en = CHROME.en;
  const fr = CHROME.fr;
  const enKeys = Object.keys(en);

  const de = loadPack("de");
  const es = loadPack("es");
  const nl = loadPack("nl");
  const ru = loadPack("ru");

  for (const [code, pack] of [
    ["de", de],
    ["es", es],
    ["nl", nl],
    ["ru", ru],
  ]) {
    const missing = enKeys.filter((k) => !(k in pack));
    const extra = Object.keys(pack).filter((k) => !(k in en));
    if (missing.length || extra.length) {
      throw new Error(
        `${code}: missing=${missing.length} extra=${extra.length} ` +
          JSON.stringify({ missing: missing.slice(0, 5), extra: extra.slice(0, 5) })
      );
    }
  }

  const blocks = [
    formatLocale("en", en, enKeys),
    formatLocale("fr", fr, enKeys),
    formatLocale("de", de, enKeys),
    formatLocale("es", es, enKeys),
    formatLocale("nl", nl, enKeys),
    formatLocale("ru", ru, enKeys),
  ];

  const newChrome =
    "const CHROME = {\r\n" + blocks.join(",\r\n") + "\r\n  }";

  src = src.slice(0, start) + newChrome + src.slice(end);

  if (!src.includes("VERSION = \"s3.0.11\"") && !src.includes("VERSION = 's3.0.11'")) {
    // try flexible bump
    const bumped = src.replace(
      /VERSION\s*=\s*["']s3\.0\.11["']/,
      'VERSION = "s3.0.27"'
    );
    if (bumped === src) {
      const m = src.match(/VERSION\s*=\s*["']([^"']+)["']/);
      throw new Error("VERSION s3.0.11 not found; current=" + (m && m[1]));
    }
    src = bumped;
  } else {
    src = src.replace(/VERSION\s*=\s*["']s3\.0\.11["']/, 'VERSION = "s3.0.27"');
  }

  fs.writeFileSync(I18N, src, "utf8");

  // Sanity re-parse
  const src2 = fs.readFileSync(I18N, "utf8");
  const r2 = findChromeRange(src2);
  const CHROME2 = eval(
    "(" + src2.slice(r2.start + "const CHROME = ".length, r2.end) + ")"
  );
  const ver = src2.match(/VERSION\s*=\s*["']([^"']+)["']/);
  const counts = Object.fromEntries(
    Object.keys(CHROME2).map((k) => [k, Object.keys(CHROME2[k]).length])
  );
  console.log(JSON.stringify({ VERSION: ver && ver[1], counts }, null, 2));
  for (const loc of ["ru", "nl", "de", "es", "fr"]) {
    if (counts[loc] !== counts.en) {
      throw new Error(`parity fail ${loc}=${counts[loc]} en=${counts.en}`);
    }
  }
}

main();