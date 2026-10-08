#!/usr/bin/env node
/* One-off s3.1.21 → s3.1.22 stamp bump (Data classification: Save all, review guidance, what needs fixing). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const edit = (file, fn) => fs.writeFileSync(at(file), fn(fs.readFileSync(at(file), "utf8")));

const versioned = [
  "club-embed.html", "club-profile.html", "display.html", "admin.html", "display2.html", "floqai.html", "floqai-search.html",
  "floqr-nav.js", "guest-list.html", "index.html", "master-admin.html", "patron-portal.html", "role-request.html", "template-tags.html"
];
for (const file of versioned) {
  edit(file, src => {
    const hits = src.split("s3.1.21").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.21 stamp`);
    console.log(file, hits);
    return src.split("s3.1.21").join("s3.1.22");
  });
}

edit("ai-diagnostics-service.js", src => {
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.21";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.21\\""]}`;
  const anchor = `    {\n      version: "s3.1.21-data-classification",`;
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.21 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.21 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.22-data-classification-review\",",
    "      title: \"Data classification: one Save all classifications button, per-row status and recommendations, Needs review filter, and a What needs fixing list\",",
    "      checks: [",
    "        {label:\"Save all button\", file:\"master-admin.html\", includes:[\"id=\\\"dataClassSaveAllBtn\\\"\"]},",
    "        {label:\"Review guidance\", file:\"floqr-data-classification.js\", includes:[\"function reviewNotes(\", \"function fixList(\"]},",
    "        {label:\"Save all call\", file:\"master-data-classification.js\", includes:[\"saveAllDataClassifications\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.22\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.22";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.21"`)) throw new Error("package.json version");
  return src.replace(`"version": "3.1.21"`, `"version": "3.1.22"`);
});

edit("README.md", src => {
  const head = "# CURRENT PACKAGE: FLOQR ShoutOut s3.1.21 (stable)";
  if (!src.includes(head)) throw new Error("README head");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const note = "- s3.1.22: Data classification explains what to do at the top, saves every row with one **Save all classifications** button (SOS2FA + reason, one audit record), shows each row as Saved / Default / Edited / Needs review with a recommendation, filters to rows that need review, and lists what needs fixing in the live security rules. The retention column is now **Delete after (days)**.";
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut s3.1.22 (stable)${eol}${eol}${note}`);
});

console.log("bumped to s3.1.22");
