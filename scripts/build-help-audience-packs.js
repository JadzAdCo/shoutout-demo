#!/usr/bin/env node
/* Build per-audience help packs and the runtimes pages load on the first ?.
   The full botdee-help-repository.js and floqr-i18n-help.js stay for tests
   and the i18n gate. Patron pages do not reference them.
   Usage: node scripts/build-help-audience-packs.js [--check] */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const AUDIENCES = [
  ["patron", "floqr-help-pack-patron.js"],
  ["serviceMember", "floqr-help-pack-service-member.js"],
  ["venueAdmin", "floqr-help-pack-venue-admin.js"],
  ["masterAdmin", "floqr-help-pack-master.js"]
];

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function write(name, text) {
  fs.writeFileSync(path.join(ROOT, name), text);
}

function loadEntries() {
  const win = {
    FLOQRNav: {appVersion: "build"},
    location: {href: "https://build.local/", pathname: "/"},
    localStorage: {getItem() { return null; }, setItem() {}},
    navigator: {language: "en"},
    addEventListener() {},
    document: null,
    URLSearchParams,
    URL,
    console,
    setTimeout
  };
  win.window = win;
  vm.runInContext(read("botdee-help-repository.js"), vm.createContext(win), {filename: "botdee-help-repository.js"});
  return win.FLOQRHelpRepository.entries();
}

function findObjectLiteral(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${marker}`);
  let depth = 0;
  let end = -1;
  let quote = "";
  let escape = false;
  for (let i = start + marker.length; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === quote) quote = "";
      continue;
    }
    if (c === "\"" || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`Unbalanced ${marker}`);
  return Function(`"use strict"; return (${source.slice(start + marker.length, end)});`)();
}

function helpRuntime(src) {
  const start = src.indexOf("  registerMany([");
  const boot = src.indexOf("  function boot() {");
  if (start < 0 || boot < start) throw new Error("help repository markers missing");
  return `${src.slice(0, start)}  registerMany([]);\n\n${src.slice(boot)}`;
}

function i18nRuntime(src) {
  const start = src.indexOf("  const packs = ");
  const localizeAt = src.indexOf("  function localize(entry, lang)");
  if (start < 0 || localizeAt < start) throw new Error("i18n help markers missing");
  const merge = `  const packs = {};

  function mergePacks(extra) {
    Object.keys(extra || {}).forEach(lang => {
      packs[lang] = Object.assign(packs[lang] || {}, extra[lang] || {});
    });
  }

`;
  let out = `${src.slice(0, start)}${merge}${src.slice(localizeAt)}`;
  out = out.replace(
    "localize,\n    applyHelpDom\n  };",
    "localize,\n    applyHelpDom,\n    mergePacks\n  };"
  );
  return out;
}

function packSource(audience, entries, packs) {
  return `/* ${audience} help. Loaded the first time ? opens. Not a first-paint script. */\n`
    + `(function (global) {\n  "use strict";\n  const entries = ${JSON.stringify(entries)};\n`
    + `  const packs = ${JSON.stringify(packs)};\n`
    + `  if (global.FLOQRHelpRepository && global.FLOQRHelpRepository.registerMany) {\n`
    + `    global.FLOQRHelpRepository.registerMany(entries);\n`
    + `  }\n`
    + `  if (global.FLOQRI18nHelp && global.FLOQRI18nHelp.mergePacks) {\n`
    + `    global.FLOQRI18nHelp.mergePacks(packs);\n`
    + `  }\n`
    + `  try { global.FLOQRI18nHelp && global.FLOQRI18nHelp.applyHelpDom && global.FLOQRI18nHelp.applyHelpDom(global.document); } catch (error) {}\n`
    + `})(typeof window !== "undefined" ? window : globalThis);\n`;
}

function build() {
  const entries = loadEntries();
  const masterOnly = entries.filter(entry => {
    const audiences = entry.audiences || [];
    return audiences.length === 1 && audiences[0] === "masterAdmin";
  });
  if (masterOnly.length) {
    throw new Error(`public help script has ${masterOnly.length} master-only entries`);
  }
  const allPacks = findObjectLiteral(read("floqr-i18n-help.js"), "const packs = ");
  const files = {
    "floqr-help-runtime.js": helpRuntime(read("botdee-help-repository.js")),
    "floqr-i18n-help-runtime.js": i18nRuntime(read("floqr-i18n-help.js"))
  };
  AUDIENCES.forEach(([audience, file]) => {
    const mine = entries.filter(entry => (entry.audiences || []).includes(audience));
    const ids = new Set(mine.map(entry => entry.id));
    const sliced = {};
    Object.keys(allPacks).forEach(lang => {
      sliced[lang] = {};
      Object.keys(allPacks[lang] || {}).forEach(id => {
        if (ids.has(id)) sliced[lang][id] = allPacks[lang][id];
      });
    });
    files[file] = packSource(audience, mine, sliced);
  });
  return files;
}

function main() {
  const files = build();
  const check = process.argv.includes("--check");
  if (check) {
    for (const [name, text] of Object.entries(files)) {
      const current = fs.existsSync(path.join(ROOT, name)) ? read(name) : "";
      if (current !== text) {
        console.error(`${name} is stale. Run: node scripts/build-help-audience-packs.js`);
        process.exit(1);
      }
    }
    console.log("help audience packs are up to date.");
    return;
  }
  for (const [name, text] of Object.entries(files)) write(name, text);
  console.log(`Wrote ${Object.keys(files).join(", ")}`);
}

main();
