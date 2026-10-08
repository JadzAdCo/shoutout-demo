#!/usr/bin/env node
/* One-off s3.1.20 → s3.1.21 stamp bump (data classification, System tier, FloqAi enforcement, staff marketing consent). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const edit = (file, fn) => fs.writeFileSync(at(file), fn(fs.readFileSync(at(file), "utf8")));
const FEATURE_STAMP = "floqr-feature-services.js?v=s3.1.20";

const versioned = [
  "club-embed.html", "club-profile.html", "display.html", "admin.html", "display2.html", "floqai.html", "floqai-search.html",
  "floqr-nav.js", "guest-list.html", "index.html", "master-admin.html", "patron-portal.html", "role-request.html", "template-tags.html"
];
for (const file of versioned) {
  edit(file, src => {
    const keep = src.split(FEATURE_STAMP).length - 1;
    const hits = src.split("s3.1.20").length - 1 - keep;
    if (!hits) throw new Error(`${file}: no s3.1.20 stamp`);
    console.log(file, hits);
    return src.split(FEATURE_STAMP).join("\u0000FS\u0000").split("s3.1.20").join("s3.1.21").split("\u0000FS\u0000").join(FEATURE_STAMP);
  });
}

edit("ai-diagnostics-service.js", src => {
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.20";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.20\\""]}`;
  const anchor = `    {\n      version: "s3.1.20-club-feed-floqai",`;
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.20 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.20 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.21-data-classification\",",
    "      title: \"Data classification register with a Master Admin Security tab, server-only System tier, FloqAi results filtered by classification on the server, and staff marketing media consent\",",
    "      checks: [",
    "        {label:\"Classification core\", file:\"floqr-data-classification.js\", includes:[\"function filterContent(\", \"SYSTEM_JOBS\"]},",
    "        {label:\"Security tab\", file:\"master-admin.html\", includes:[\"id=\\\"dataClassification\\\"\"]},",
    "        {label:\"FloqAi access gate\", file:\"floqai-access.js\", includes:[\"getFloqAiAccess\"]},",
    "        {label:\"FloqAi classified intents\", file:\"intent-search.js\", includes:[\"INTENT_AUDIENCES\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.21\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.21";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.20"`)) throw new Error("package.json version");
  return src.replace(`"version": "3.1.20"`, `"version": "3.1.21"`);
});

edit("functions/floqai-page.test.js", src => src.split("floqai\\.html\\?v=s3\\.1\\.20").join("floqai\\.html\\?v=s3\\.1\\.\\d+"));

edit("README.md", src => {
  const head = "# CURRENT PACKAGE: FLOQR ShoutOut s3.1.20 (stable)";
  if (!src.includes(head)) throw new Error("README head");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const note = "- s3.1.21: Master Admin → Security → **Data classification** lists every Firestore collection with who may read it (Public, Patron, Regular employee, Privileged employee, Club Admin, Master Admin, own record), personal data, retention, a read-only System column, a role simulator, and an exposure report against the live security rules. FloqAi now shows only answers that your account's classification allows, checked on the server. Staff marketing media consent is recorded when a patron joins a venue or event team.";
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut s3.1.21 (stable)${eol}${eol}${note}`);
});

console.log("bumped to s3.1.21");
