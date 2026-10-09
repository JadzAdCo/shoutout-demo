#!/usr/bin/env node
/* One-off s3.1.24 → s3.1.25 stamp bump (LED board fit: Firestore board size, live gate, safe-margin text fit, native-size previews).
 * master-admin.html is left on s3.1.24 on purpose (another change owns it; none of its scripts changed here). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const edit = (file, fn) => fs.writeFileSync(at(file), fn(fs.readFileSync(at(file), "utf8")));

const versioned = [
  "admin.html", "club-embed.html", "club-profile.html", "display.html", "display2.html", "floqai.html", "floqai-search.html",
  "floqr-nav.js", "guest-list.html", "index.html", "mingl-chat.html", "mingl-gist.html", "patron-portal.html",
  "promoter-admin.html", "role-request.html", "services.html", "template-tags.html"
];
for (const file of versioned) {
  edit(file, src => {
    const hits = src.split("s3.1.24").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.24 stamp`);
    console.log(file, hits);
    return src.split("s3.1.24").join("s3.1.25");
  });
}

edit("ai-diagnostics-service.js", src => {
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.24";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.24\\""]}`;
  const anchor = `    {\n      version: "s3.1.24-rules-stages-2-3",`;
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.24 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.24 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.25-board-fit\",",
    "      title: \"LED boards: the board size set in Club Admin wins, only approved ShoutOuts play (then return to the idle board), every word stays whole and shrinks only when it would not fit, and previews render at the board's real pixel size\",",
    "      checks: [",
    "        {label:\"Board fit module\", file:\"floqr-board-fit.js\", includes:[\"window.FLOQRBoardFit\", \"function mergeVenueForDisplay(\", \"function liveContentDecision(\"]},",
    "        {label:\"Native-size preview frame\", file:\"floqr-board-frame.js\", includes:[\"window.FLOQRBoardFrame\", \"function mount(\"]},",
    "        {label:\"Display uses Firestore-first venue merge\", file:\"display-app.js\", includes:[\"function mergeLiveVenue(\", \"function isRenderableLiveContent(\", \"hydrateUrlPreviewFromFirestore()\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.25\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.25";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.24"`)) throw new Error("package.json version");
  return src.replace(`"version": "3.1.24"`, `"version": "3.1.25"`);
});

edit("README.md", src => {
  const head = "# CURRENT PACKAGE: FLOQR ShoutOut s3.1.24 (stable)";
  if (!src.includes(head)) throw new Error("README head");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const note = "- s3.1.25: LED boards. The board size a club sets in Club Admin now wins over the packaged default; only approved ShoutOuts play on the board and anything else shows the club's idle board; an approved ShoutOut without an end time returns to the idle board after 10 minutes (even if the player reloads). Board text keeps its designed size and only shrinks when a line would not fit inside a small safe margin, words are never split or dropped, and the @handle pill shrinks instead of being cut off. ShoutOut and template previews render at the board's real pixel size so they look the same as the board.";
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut s3.1.25 (stable)${eol}${eol}${note}`);
});

console.log("bumped to s3.1.25");
