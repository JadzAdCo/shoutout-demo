#!/usr/bin/env node
/* One-shot: rename technical floqAi / floqai-* → botDee / botdee-*.
 * Page URL already botdee.html (floqai.html deleted s3.2.75).
 * Dual-read floqAi→botDee is patched after this script (feature-services + seed).
 * Usage: node scripts/rename-floqai-to-botdee.js [repoRoot] */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));

const SKIP_DIRS = new Set([
  ".git", "node_modules", ".tmp-s3-1-31", ".tmp-s3-1-37",
  "reports", ".cursor/agents", ".cursor/commands", ".cursor/hooks", ".cursor/.pi"
]);

const SKIP_FILES = new Set([
  "scripts/rename-floqai-to-botdee.js",
  "scripts/rename-suprstr-to-floqcast.js",
  ".cursor/rules/design-notes-botdee-rename.mdc"
]);

const FILE_RENAMES = [
  ["floqai-access.js", "botdee-access.js"],
  ["floqai-help-repository.js", "botdee-help-repository.js"],
  ["floqai-page.js", "botdee-page.js"],
  ["floqai-search.js", "botdee-search.js"],
  ["floqai-search.css", "botdee-search.css"],
  ["functions/floqai-content-classes.json", "functions/botdee-content-classes.json"],
  ["functions/floqai-page.test.js", "functions/botdee-page.test.js"],
  ["functions/floqai-help-access.test.js", "functions/botdee-help-access.test.js"],
  ["scripts/build-floqai-content-classes.js", "scripts/build-botdee-content-classes.js"],
  [".cursor/rules/design-notes-floqai-page.mdc", ".cursor/rules/design-notes-botdee-page.mdc"]
];

function transform(src, rel) {
  let out = src;

  // File / module path refs (before identifier renames)
  const pathPairs = [
    ["floqai-help-repository.js", "botdee-help-repository.js"],
    ["floqai-access.js", "botdee-access.js"],
    ["floqai-page.js", "botdee-page.js"],
    ["floqai-search.js", "botdee-search.js"],
    ["floqai-search.css", "botdee-search.css"],
    ["functions/floqai-content-classes.json", "functions/botdee-content-classes.json"],
    ["floqai-content-classes.json", "botdee-content-classes.json"],
    ["functions/floqai-page.test.js", "functions/botdee-page.test.js"],
    ["floqai-page.test.js", "botdee-page.test.js"],
    ["functions/floqai-help-access.test.js", "functions/botdee-help-access.test.js"],
    ["floqai-help-access.test.js", "botdee-help-access.test.js"],
    ["scripts/build-floqai-content-classes.js", "scripts/build-botdee-content-classes.js"],
    ["build-floqai-content-classes.js", "build-botdee-content-classes.js"],
    ["design-notes-floqai-page.mdc", "design-notes-botdee-page.mdc"],
    ["@floqai-page$", "@botdee$"],
    ["$floqai-page$", "$botdee$"]
  ];
  for (const [a, b] of pathPairs) out = out.split(a).join(b);

  // Longest identifiers first
  const idPairs = [
    ["FLOQRFloqAiAccess", "FLOQRBotDeeAccess"],
    ["__floqAiHelpers", "__botDeeHelpers"],
    ["getFloqAiAccess", "getBotDeeAccess"],
    ["bindFloqAi", "bindBotDee"],
    ["FLOQRFloqAi", "FLOQRBotDee"],
    ["floqAiAccessThrottle", "botDeeAccessThrottle"],
    ["floqAiAccess", "botDeeAccess"],
    ["floqAiContent", "botDeeContent"],
    ["categoryFloqAiSearch", "categoryBotDeeSearch"],
    ["categoryFloqAiForm", "categoryBotDeeForm"],
    ["categoryFloqAiInput", "categoryBotDeeInput"],
    ["categoryFloqAiGo", "categoryBotDeeGo"],
    ["floqAiSearchPanel", "botDeeSearchPanel"],
    ["floqAiHelpPopout", "botDeeHelpPopout"],
    ["floqAiHelpClose", "botDeeHelpClose"],
    ["floqAiHelpText", "botDeeHelpText"],
    ["floqAiHelpBtn", "botDeeHelpBtn"],
    ["floqAiScopeNote", "botDeeScopeNote"],
    ["floqAiSpeechText", "botDeeSpeechText"],
    ["floqAiSpeech", "botDeeSpeech"],
    ["floqAiAgent", "botDeeAgent"],
    ["floqAiMark", "botDeeMark"],
    ["help-floqai-audience-sections", "help-botdee-audience-sections"],
    ["help-floqai-template-search", "help-botdee-template-search"],
    ["help-floqai-page", "help-botdee-page"],
    ["floqai-ask-floqr", "botdee-ask-floqr"],
    ["data-floqai-search-catalog", "data-botdee-search-catalog"],
    ["data-floqr-chrome-icon=\"floqAi\"", "data-floqr-chrome-icon=\"botDee\""],
    ["data-floqr-feature=\"floqAi\"", "data-floqr-feature=\"botDee\""],
    ["data-feature-key=\"floqAi\"", "data-feature-key=\"botDee\""],
    ["data-floqr-feature='floqAi'", "data-floqr-feature='botDee'"],
    ["data-feature-key='floqAi'", "data-feature-key='botDee'"],
    ['featureServiceAllows("floqAi")', 'featureServiceAllows("botDee")'],
    ["featureServiceAllows('floqAi')", "featureServiceAllows('botDee')"],
    ['assertFeatureAccess(request.auth || null, "floqAi"', 'assertFeatureAccess(request.auth || null, "botDee"'],
    ['assertFeatureAccess(request.auth, "floqAi"', 'assertFeatureAccess(request.auth, "botDee"'],
    ['assertFeatureAccess(request.auth || null, \'floqAi\'', "assertFeatureAccess(request.auth || null, 'botDee'"],
    ['key: "floqAi"', 'key: "botDee"'],
    ["key: 'floqAi'", "key: 'botDee'"],
    ['patronGate: "floqAi"', 'patronGate: "botDee"'],
    ["patronGate: 'floqAi'", "patronGate: 'botDee'"],
    ['featureKey: "floqAi"', 'featureKey: "botDee"'],
    ['"floqAi"', '"botDee"'],
    ["'floqAi'", "'botDee'"],
    // Bare object keys / identifiers (after quoted forms)
    ["floqAi:", "botDee:"],
    ["floqAi,", "botDee,"],
    ["floqAi }", "botDee }"],
    ["floqAi]", "botDee]"],
    ["floqAi)", "botDee)"],
    // CSS / class prefixes (after DOM ids that contained FloqAi)
    ["category-floqai-", "category-botdee-"],
    ["floqai-standalone", "botdee-standalone"],
    ["floqai-intent-page", "botdee-intent-page"],
    ["floqai-top-stack", "botdee-top-stack"],
    ["floqai-search-main", "botdee-search-main"],
    ["floqai-search-panel", "botdee-search-panel"],
    ["floqai-brand-row", "botdee-brand-row"],
    ["floqai-hero-logo", "botdee-hero-logo"],
    ["floqai-help-popout", "botdee-help-popout"],
    ["floqai-help-close", "botdee-help-close"],
    ["floqai-help-links", "botdee-help-links"],
    ["floqai-help-btn", "botdee-help-btn"],
    ["floqai-catalog-heading", "botdee-catalog-heading"],
    ["floqai-icon-card", "botdee-icon-card"],
    ["floqai-icon-face", "botdee-icon-face"],
    ["floqai-tile-mark", "botdee-tile-mark"],
    ["floqai-mark-img", "botdee-mark-img"],
    ["floqai-speech", "botdee-speech"],
    ["floqai-agent", "botdee-agent"],
    ["floqai-mark", "botdee-mark"],
    ["floqai-", "botdee-"],
    // i18n key namespaces
    ["page.floqai.", "page.botdee."],
    ["page.floqai", "page.botdee"],
    ["cat.floqai", "cat.botdee"],
    ["template.floqai", "template.botdee"],
    ["\"floqai.", "\"botdee."],
    ["'floqai.", "'botdee."],
    ["floqai.helpComposer", "botdee.helpComposer"],
    ["floqai.scope", "botdee.scope"],
    ["floqai.", "botdee."]
  ];
  for (const [a, b] of idPairs) out = out.split(a).join(b);

  // Remaining camel / comment FloqAi → BotDee for technical names (not brand BOT DEE)
  // Avoid clobbering already-correct BOT DEE strings.
  out = out.replace(/\bFloqAi\b/g, "BOT DEE");
  // Undo if we accidentally doubled brand in known phrases
  out = out.split("BOT DEE BOT DEE").join("BOT DEE");

  // ICON pack object keys that used floqAi: — already handled via "floqAi" string replace
  // systemJob / FLOQAI_JOB constants
  out = out.split("FLOQAI_JOB").join("BOTDEE_JOB");
  out = out.split("FLOQAI_OPTS").join("BOTDEE_OPTS");
  out = out.split("FLOQAI_CONTENT").join("BOTDEE_CONTENT");

  void rel;
  return out;
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const rel = path.relative(ROOT, path.join(dir, ent.name)).replace(/\\/g, "/");
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name) || SKIP_DIRS.has(rel)) continue;
      if (rel.startsWith("reports/") || rel.startsWith(".tmp")) continue;
      walk(path.join(dir, ent.name), acc);
    } else {
      if (SKIP_FILES.has(rel) || SKIP_FILES.has(ent.name)) continue;
      if (!/\.(js|html|css|md|mdc|json|txt|ps1)$/i.test(ent.name)) continue;
      acc.push(rel);
    }
  }
  return acc;
}

function renameFiles() {
  for (const [from, to] of FILE_RENAMES) {
    const a = path.join(ROOT, from);
    const b = path.join(ROOT, to);
    if (!fs.existsSync(a)) {
      console.warn("skip missing", from);
      continue;
    }
    if (fs.existsSync(b)) {
      console.warn("target exists, skip rename", to);
      continue;
    }
    fs.mkdirSync(path.dirname(b), {recursive: true});
    fs.renameSync(a, b);
    console.log("renamed", from, "→", to);
  }
}

function main() {
  renameFiles();
  const files = walk(ROOT);
  let changed = 0;
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    const before = fs.readFileSync(abs, "utf8");
    const after = transform(before, rel);
    if (after !== before) {
      fs.writeFileSync(abs, after);
      changed += 1;
      console.log("updated", rel);
    }
  }
  console.log("done; files content-updated:", changed);
}

main();
