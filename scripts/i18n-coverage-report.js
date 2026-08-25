/**
 * Report chrome + help i18n coverage vs English / canonical 33 help ids.
 * Exit 1 if any gap.
 * Usage: node scripts/i18n-coverage-report.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CHROME_LANGS = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const HELP_LANGS = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];

function findObjectLiteral(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("Not found: " + marker);
  let i = start + marker.length;
  let depth = 0;
  let end = -1;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("Unbalanced after " + marker);
  return Function(`"use strict"; return (${source.slice(start + marker.length, end)});`)();
}

function loadChromeCounts() {
  const src = fs.readFileSync(path.join(ROOT, "floqr-i18n.js"), "utf8");
  const CHROME = findObjectLiteral(src, "const CHROME = ");
  const enKeys = Object.keys(CHROME.en || {});
  const rows = [];
  const gaps = [];
  for (const code of CHROME_LANGS) {
    const pack = CHROME[code] || {};
    const keys = Object.keys(pack);
    const missing = enKeys.filter((k) => !(k in pack));
    const extra = keys.filter((k) => !(k in CHROME.en));
    rows.push({ lang: code, keys: keys.length, missing: missing.length, extra: extra.length });
    if (code !== "en" && (missing.length || extra.length || keys.length !== enKeys.length)) {
      gaps.push({
        area: "chrome",
        lang: code,
        expected: enKeys.length,
        actual: keys.length,
        missing: missing.slice(0, 10),
        extra: extra.slice(0, 10)
      });
    }
  }
  return { enKeys: enKeys.length, rows, gaps };
}

function loadHelpCounts() {
  const canonicalPath = path.join(__dirname, "_help-en.json");
  const canonical = fs.existsSync(canonicalPath)
    ? Object.keys(JSON.parse(fs.readFileSync(canonicalPath, "utf8")))
    : null;

  const src = fs.readFileSync(path.join(ROOT, "floqr-i18n-help.js"), "utf8");
  const packs = findObjectLiteral(src, "const packs = ");
  const ids = canonical || Object.keys(packs.ru || packs.nl || {});
  const rows = [];
  const gaps = [];
  for (const code of HELP_LANGS) {
    const pack = packs[code] || {};
    const keys = Object.keys(pack);
    const missing = ids.filter((id) => !(id in pack));
    const empty = ids.filter((id) => {
      const row = pack[id];
      return !row || !String(row.title || "").trim() || !String(row.body || "").trim();
    });
    const extra = keys.filter((id) => !ids.includes(id));
    rows.push({
      lang: code,
      ids: keys.length,
      missing: missing.length,
      empty: empty.length,
      extra: extra.length
    });
    if (missing.length || empty.length || keys.length !== ids.length) {
      gaps.push({
        area: "help",
        lang: code,
        expected: ids.length,
        actual: keys.length,
        missing: missing.slice(0, 10),
        empty: empty.slice(0, 10),
        extra: extra.slice(0, 10)
      });
    }
  }
  return { canonical: ids.length, rows, gaps, packsPresent: Object.keys(packs) };
}

function printTable(title, rows, columns) {
  console.log("\n" + title);
  const header = columns.map((c) => c.label.padEnd(c.width)).join(" ");
  console.log(header);
  console.log(columns.map((c) => "-".repeat(c.width)).join(" "));
  for (const row of rows) {
    console.log(
      columns
        .map((c) => String(row[c.key] ?? "").padEnd(c.width))
        .join(" ")
    );
  }
}

function analyze() {
  const chrome = loadChromeCounts();
  const help = loadHelpCounts();
  return { chrome, help, ok: chrome.gaps.length === 0 && help.gaps.length === 0 };
}

function main() {
  const report = analyze();
  printTable("CHROME key counts (vs en)", report.chrome.rows, [
    { key: "lang", label: "lang", width: 6 },
    { key: "keys", label: "keys", width: 6 },
    { key: "missing", label: "miss", width: 6 },
    { key: "extra", label: "extra", width: 6 }
  ]);
  console.log(`en chrome keys: ${report.chrome.enKeys}`);

  printTable("HELP pack id counts (vs canonical)", report.help.rows, [
    { key: "lang", label: "lang", width: 6 },
    { key: "ids", label: "ids", width: 6 },
    { key: "missing", label: "miss", width: 6 },
    { key: "empty", label: "empty", width: 6 },
    { key: "extra", label: "extra", width: 6 }
  ]);
  console.log(`canonical help ids: ${report.help.canonical}`);
  console.log(`help packs present: ${report.help.packsPresent.join(", ")}`);

  if (!report.ok) {
    console.error("\nGAPS:");
    console.error(JSON.stringify([...report.chrome.gaps, ...report.help.gaps], null, 2));
    process.exit(1);
  }
  console.log("\nOK — full chrome + help coverage.");
}

if (require.main === module) {
  main();
}

module.exports = { analyze, CHROME_LANGS, HELP_LANGS };
