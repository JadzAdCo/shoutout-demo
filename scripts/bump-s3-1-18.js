#!/usr/bin/env node
/* One-off s3.1.17 → s3.1.18 stamp bump (single ? on ShoutOut Recommendations cards). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const edit = (file, fn) => fs.writeFileSync(at(file), fn(fs.readFileSync(at(file), "utf8")));

const versioned = [
  "club-profile.html", "floqr-nav.js", "admin.html", "display2.html", "master-admin.html", "patron-portal.html",
  "role-request.html", "template-tags.html", "index.html", "display.html", "guest-list.html"
];
for (const file of versioned) {
  edit(file, src => {
    const hits = src.split("s3.1.17").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.17 stamp`);
    console.log(file, hits);
    return src.split("s3.1.17").join("s3.1.18");
  });
}

const stamps = [
  ["patron-portal.html", "./floqai-help-repository.js?v=s3.1.0", "./floqai-help-repository.js?v=s3.1.18"],
  ["patron-portal.html", "./floqr-i18n-help.js?v=s3.1.0", "./floqr-i18n-help.js?v=s3.1.18"],
  ["master-admin.html", "./floqai-help-repository.js?v=s3.1.0", "./floqai-help-repository.js?v=s3.1.18"],
  ["master-admin.html", "./floqr-i18n-help.js?v=s3.1.0", "./floqr-i18n-help.js?v=s3.1.18"]
];
for (const [file, from, to] of stamps) {
  edit(file, src => {
    if (!src.includes(from)) throw new Error(`${file}: missing ${from}`);
    return src.replace(from, to);
  });
}

edit("ai-diagnostics-service.js", src => {
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.17";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.17\\""]}`;
  const anchor = `    {\n      version: "s3.1.17-entity-link-output",`;
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.17 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.17 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.18-recommendation-help\",",
    "      title: \"ShoutOut Recommendations: one ? per card (AI Recommendations, Trending, Generic); status messages stay visible; help localized in every language\",",
    "      checks: [",
    "        {label:\"Declarative recommendation help\", file:\"index.html\", includes:[\"data-floqr-help-id=\\\"help-ai-recommendations\\\"\", \"data-floqr-help-id=\\\"help-trending-shoutouts\\\"\"]},",
    "        {label:\"Status text stays visible\", file:\"patron-app.js\", includes:[\"data-keep-visible='true'>${esc(emptyText)}\"]},",
    "        {label:\"Recommendation help in repository\", file:\"floqai-help-repository.js\", includes:[\"id: \\\"help-ai-recommendations\\\"\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.18\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.18";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.17"`)) throw new Error("package.json version");
  if (!src.includes("entity-link-output.test.js ")) throw new Error("package.json test list");
  return src
    .replace(`"version": "3.1.17"`, `"version": "3.1.18"`)
    .replace("entity-link-output.test.js ", "entity-link-output.test.js recommendation-help.test.js ");
});
console.log("bumped to s3.1.18");
