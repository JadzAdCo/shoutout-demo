#!/usr/bin/env node
/* One-shot: rename product surface suprstr/supRstar → floqCast.
 * Keeps Firestore collection / orderType / inbox type storage ids as legacy.
 * Usage: node scripts/rename-suprstr-to-floqcast.js [repoRoot] */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));

const SKIP_DIRS = new Set([
  ".git", "node_modules", ".tmp-s3-1-31", ".tmp-s3-1-37",
  "reports", ".cursor/agents", ".cursor/commands", ".cursor/hooks", ".cursor/.pi"
]);

const SKIP_FILES = new Set([
  "admin-scheduling.js",
  "functions/ai-discovery-functions.js",
  "scripts/rename-suprstr-to-floqcast.js"
]);

const FILE_RENAMES = [
  ["suprstr-search.html", "floqcast-search.html"],
  ["suprstr-search.js", "floqcast-search.js"],
  ["suprstr-search.css", "floqcast-search.css"],
  ["suprstar-preview.html", "floqcast-preview.html"],
  ["suprstar-preview.js", "floqcast-preview.js"],
  ["suprstr-webrtc.js", "floqcast-webrtc.js"],
  ["display-suprstr.js", "display-floqcast.js"],
  ["functions/suprstr-functions.js", "functions/floqcast-functions.js"],
  ["functions/suprstr-webrtc-reliability.test.js", "functions/floqcast-webrtc-reliability.test.js"],
  ["rules-tests/firestore-suprstr-aiindex-display.test.js", "rules-tests/firestore-floqcast-aiindex-display.test.js"],
  [".cursor/rules/suprstr.mdc", ".cursor/rules/floqcast.mdc"]
];

/** Ordered replacements. Do NOT touch Firestore collection string literals that must stay. */
function transform(src, rel) {
  let out = src;

  // File / module path refs (before brand replacements)
  const pathPairs = [
    ["suprstr-search.html", "floqcast-search.html"],
    ["suprstar-preview.html", "floqcast-preview.html"],
    ["suprstr-search.js", "floqcast-search.js"],
    ["suprstar-preview.js", "floqcast-preview.js"],
    ["suprstr-webrtc.js", "floqcast-webrtc.js"],
    ["display-suprstr.js", "display-floqcast.js"],
    ["suprstr-search.css", "floqcast-search.css"],
    ["functions/suprstr-functions", "functions/floqcast-functions"],
    ["./suprstr-functions", "./floqcast-functions"],
    ["suprstr-webrtc-reliability.test.js", "floqcast-webrtc-reliability.test.js"],
    ["firestore-suprstr-aiindex-display.test.js", "firestore-floqcast-aiindex-display.test.js"],
    ["design-notes: .cursor/rules/suprstr.mdc", "design-notes: .cursor/rules/floqcast.mdc"],
    [".cursor/rules/suprstr.mdc", ".cursor/rules/floqcast.mdc"]
  ];
  for (const [a, b] of pathPairs) out = out.split(a).join(b);

  // DOM / CSS / panel ids (UI surface)
  const idPairs = [
    ["suprstrBtnCard", "floqcastBtnCard"],
    ["suprstarStageBtn", "floqcastStageBtn"],
    ["suprstrLiveStatus", "floqcastLiveStatus"],
    ["suprstar-stage-actions", "floqcast-stage-actions"],
    ["suprstr-card", "floqcast-card"],
    ["panel=suprstar", "panel=floqcast"],
    ["panel: \"suprstar\"", "panel: \"floqcast\""],
    ["panel: 'suprstar'", "panel: 'floqcast'"],
    ["panel:\"suprstar\"", "panel:\"floqcast\""],
    ["data-feature-key=\"supRstar\"", "data-feature-key=\"floqCast\""],
    ["data-floqr-feature=\"supRstar\"", "data-floqr-feature=\"floqCast\""],
    ["suprstrHome", "floqcastHome"],
    ["help-suprstar", "help-floqcast"],
    ["help-suprstr", "help-floqcast"],
    ["cat.suprstar", "cat.floqcast"],
    ["page.suprstarPreview", "page.floqcastPreview"],
    ["page.suprstr.", "page.floqcast."],
    ["admin.suprstarQueue", "admin.floqcastQueue"],
    ["dataClass.rec.suprstrSessions", "dataClass.rec.floqcastSessions"],
    ["dataClass.rec.suprstrLive", "dataClass.rec.floqcastLive"]
  ];
  for (const [a, b] of idPairs) out = out.split(a).join(b);

  // Revert accidental orderType / collection / inbox-type damage from "suprstar" → "floqcast"
  // Restore storage ids that must stay.
  const restore = [
    [/collection\("floqcastRequests"\)/g, 'collection("suprstarRequests")'],
    [/collection\('floqcastRequests'\)/g, "collection('suprstarRequests')"],
    [/\/floqcastRequests\//g, "/suprstarRequests/"],
    [/orderType", "==", "floqcastRequest"/g, 'orderType", "==", "suprstarRequest"'],
    [/===\s*"floqcastRequest"/g, '=== "suprstarRequest"'],
    [/===\s*'floqcastRequest'/g, "=== 'suprstarRequest'"],
    [/type === "floqcastRequest"/g, 'type === "suprstarRequest"'],
    [/type === 'floqcastRequest'/g, "type === 'suprstarRequest'"],
    [/product:"floqcastRequest"/g, 'product:"suprstarRequest"'],
    [/product: "floqcastRequest"/g, 'product: "suprstarRequest"'],
    [/orderType:\s*"floqcastRequest"/g, 'orderType: "suprstarRequest"'],
    [/floqcast-pending-approval/g, "suprstar-pending-approval"],
    [/type:\s*"floqcastPending"/g, 'type: "suprstarPending"'],
    [/type:\s*"floqcastApproved"/g, 'type: "suprstarApproved"'],
    [/type:\s*"floqcastRejected"/g, 'type: "suprstarRejected"'],
    [/"floqcastPending"/g, '"suprstarPending"'],
    [/"floqcastApproved"/g, '"suprstarApproved"'],
    [/"floqcastRejected"/g, '"suprstarRejected"'],
    [/floqcastLiveDurationSeconds/g, "suprstarLiveDurationSeconds"]
  ];
  for (const [re, rep] of restore) out = out.replace(re, rep);

  // Feature catalog key (string literals) — leave collection/commerce storage alone
  // Replace feature-key usages of "supRstar" with "floqCast" except venue gate dual-read handled in core patch.
  out = out.replace(/key:\s*"supRstar"/g, 'key: "floqCast"');
  out = out.replace(/featureKey:\s*"supRstar"/g, 'featureKey: "floqCast"');
  out = out.replace(/assertClubFeature\(([^,]+),\s*"supRstar"\)/g, 'assertClubFeature($1, "floqCast")');
  out = out.replace(/assertFeatureAccess\(([^,]+),\s*"supRstar"/g, 'assertFeatureAccess($1, "floqCast"');
  out = out.replace(/CHECKOUT_FEATURE_KEYS[\s\S]*?suprstarRequest:\s*"supRstar"/, (m) => m.replace(/"supRstar"/g, '"floqCast"'));
  out = out.replace(/suprstarRequest:\s*"supRstar"/g, 'suprstarRequest: "floqCast"');
  out = out.replace(/suprstrSlot:\s*"supRstar"/g, 'suprstrSlot: "floqCast"');

  // Brand / UI display names (longest first)
  const brandPairs = [
    ["SupRstR", "floqCast"],
    ["SupRStar", "floqCast"],
    ["SUPRSTR", "FLOQCAST"],
    ["supRstar", "floqCast"],
    ["Suprstr", "FloqCast"],
    ["Suprstar", "FloqCast"]
  ];
  for (const [a, b] of brandPairs) out = out.split(a).join(b);

  // After brand replace, restore storage collection names that got mangled if any
  // (supRstar in comments about collections may have become floqCast — OK)
  // Restore accidental collection renames from brand pass — brand pass shouldn't touch
  // suprstrLive / suprstrSessions / suprstarRequests (different casing).

  // Callable rename in source (exports + requires) — add aliases in a post-pass for functions file
  const callablePairs = [
    ["createSuprstarRequest", "createFloqCastRequest"],
    ["approveSuprstarRequest", "approveFloqCastRequest"],
    ["rejectSuprstarRequest", "rejectFloqCastRequest"],
    ["startSuprstrLive", "startFloqCastLive"],
    ["endSuprstrLive", "endFloqCastLive"],
    ["markSuprstarRequestPaid", "markFloqCastRequestPaid"],
    ["getSuprstrIceServers", "getFloqCastIceServers"],
    ["getSuprstrDisplaySession", "getFloqCastDisplaySession"]
  ];
  for (const [a, b] of callablePairs) out = out.split(a).join(b);

  // Intent ids
  out = out.replace(/id:\s*"suprstr"/g, 'id: "floqcast"');
  out = out.replace(/id:\s*"help-floqcast"/g, 'id: "help-floqcast"'); // already renamed via help-suprstr
  out = out.replace(/\bsuprstr:\s*\["patron"\]/g, 'floqcast: ["patron"]');

  // Protected brands list
  out = out.replace(
    /ShoutOut, Mingl, BartR, RydR, FloqAi, FloqR, floqCast, floqCast, DonPapi/,
    "ShoutOut, Mingl, BartR, RydR, FloqAi, FloqR, floqCast, DonPapi"
  );
  out = out.replace(
    /ShoutOut, Mingl, BartR, RydR, FloqAi, FloqR, floqCast, DonPapi/,
    "ShoutOut, Mingl, BartR, RydR, FloqAi, FloqR, floqCast, DonPapi"
  );

  // Resume tags in design notes
  out = out.replace(/@supRstr\$/g, "@floqCast$").replace(/@floqCast\$/g, "@floqCast$");
  out = out.replace(/\$supRstr\$/g, "$floqcast$");
  out = out.replace(/@supRstar\$/g, "@floqCast$");

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
    const full = path.join(ROOT, rel);
    const before = fs.readFileSync(full, "utf8");
    const after = transform(before, rel);
    if (after !== before) {
      fs.writeFileSync(full, after);
      changed++;
      console.log("updated", rel);
    }
  }
  console.log(`done: ${changed} files content-updated`);
}

main();
