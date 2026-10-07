#!/usr/bin/env node
/* One-off s3.1.18 → s3.1.19 stamp bump (Club Admin featured service staff picker). */
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
    const hits = src.split("s3.1.18").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.18 stamp`);
    console.log(file, hits);
    return src.split("s3.1.18").join("s3.1.19");
  });
}

edit("ai-diagnostics-service.js", src => {
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.18";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.18\\""]}`;
  const anchor = `    {\n      version: "s3.1.18-recommendation-help",`;
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.18 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.18 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.19-featured-staff-picker\",",
    "      title: \"Club Admin → Club Public Profile: Featured service staff is a checkbox list of the club's staff; each person's photo is one of their FLOQR pictures or an upload from the computer (no photo URLs)\",",
    "      checks: [",
    "        {label:\"Featured staff picker logic\", file:\"floqr-featured-staff.js\", includes:[\"function buildRows(\", \"function toFeatured(\"]},",
    "        {label:\"Picker in Club Public Profile\", file:\"admin.html\", includes:[\"id=\\\"featuredStaffPicker\\\"\", \"floqr-featured-staff.js\"]},",
    "        {label:\"Photo upload to club media\", file:\"admin-app.js\", includes:[\"function uploadFeaturedStaffPhoto(\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.19\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.19";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.18"`)) throw new Error("package.json version");
  if (!src.includes("recommendation-help.test.js ")) throw new Error("package.json test list");
  return src
    .replace(`"version": "3.1.18"`, `"version": "3.1.19"`)
    .replace("recommendation-help.test.js ", "recommendation-help.test.js featured-staff-picker.test.js ");
});
console.log("bumped to s3.1.19");
