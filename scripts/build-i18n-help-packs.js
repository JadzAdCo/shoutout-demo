/**
 * Rebuild floqr-i18n-help.js packs from scripts/_help-{lang}.json.
 * Usage: node scripts/build-i18n-help-packs.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HELP_JS = path.join(ROOT, "floqr-i18n-help.js");
const VERSION = "s3.0.28";
const LANGS = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
const CANONICAL = Object.keys(
  JSON.parse(fs.readFileSync(path.join(__dirname, "_help-en.json"), "utf8"))
);

function loadPack(code) {
  const p = path.join(__dirname, `_help-${code}.json`);
  if (!fs.existsSync(p)) throw new Error("Missing " + p);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function formatEntry(id, row) {
  return (
    `      ${JSON.stringify(id)}: {\n` +
    `        title: ${JSON.stringify(row.title)},\n` +
    `        body: ${JSON.stringify(row.body)}\n` +
    `      }`
  );
}

function formatLocale(code, pack) {
  const lines = [`    ${code}: {`];
  for (let i = 0; i < CANONICAL.length; i++) {
    const id = CANONICAL[i];
    if (!(id in pack)) throw new Error(`${code} missing id ${id}`);
    const comma = i < CANONICAL.length - 1 ? "," : "";
    lines.push(formatEntry(id, pack[id]) + comma);
  }
  lines.push("    }");
  return lines.join("\n");
}

function main() {
  const packs = {};
  for (const code of LANGS) {
    const pack = loadPack(code);
    const missing = CANONICAL.filter((id) => !(id in pack));
    const extra = Object.keys(pack).filter((id) => !CANONICAL.includes(id));
    if (missing.length || extra.length) {
      throw new Error(
        `${code}: missing=${missing.length} extra=${extra.length} ` +
          JSON.stringify({ missing: missing.slice(0, 5), extra: extra.slice(0, 5) })
      );
    }
    packs[code] = pack;
  }

  let src = fs.readFileSync(HELP_JS, "utf8");
  const start = src.indexOf("  const packs = {");
  if (start < 0) throw new Error("packs not found");
  let i = start + "  const packs = ".length;
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
  if (end < 0) throw new Error("packs end not found");

  const blocks = LANGS.map((code) => formatLocale(code, packs[code]));
  const newPacks = "  const packs = {\n" + blocks.join(",\n") + "\n  }";
  src = src.slice(0, start) + newPacks + src.slice(end);
  src = src.replace(/VERSION\s*=\s*["'][^"']+["']/, `VERSION = "${VERSION}"`);
  src = src.replace(
    /\/\* FLOQR help title\/body locales[^*]*\*\//,
    "/* FLOQR help title/body locales (ru, nl, fr, de, es, it, pt, el, pl, ar) for patron / venueAdmin / serviceMember. */"
  );

  fs.writeFileSync(HELP_JS, src, "utf8");

  const counts = Object.fromEntries(
    LANGS.map((code) => [code, Object.keys(packs[code]).length])
  );
  console.log(JSON.stringify({ VERSION, counts, canonical: CANONICAL.length }, null, 2));
}

main();
