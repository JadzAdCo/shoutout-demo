#!/usr/bin/env node
/* One-off s3.1.22 → s3.1.23 stamp bump (rules Stage 1: users, messages, Inbox, door codes, SupRstR candidates + people directory). */
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
    const hits = src.split("s3.1.22").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.22 stamp`);
    console.log(file, hits);
    return src.split("s3.1.22").join("s3.1.23");
  });
}

const tags = {
  "services.html": [["services-app.js?v=s3.0.3", "services-app.js?v=s3.1.23"], ["floqr-blocks.js?v=29.09.57", "floqr-blocks.js?v=s3.1.23"]],
  "mingl-chat.html": [["mingl-chat-app.js?v=s3.0.3", "mingl-chat-app.js?v=s3.1.23"], ["floqr-blocks.js?v=29.09.57", "floqr-blocks.js?v=s3.1.23"]],
  "promoter-admin.html": [["promoter-admin-app.js?v=s3.0.3", "promoter-admin-app.js?v=s3.1.23"]],
  "index.html": [["floqr-blocks.js?v=29.09.57", "floqr-blocks.js?v=s3.1.23"]],
  "patron-portal.html": [["floqr-blocks.js?v=29.09.57", "floqr-blocks.js?v=s3.1.23"]],
  "mingl-gist.html": [["floqr-blocks.js?v=29.09.57", "floqr-blocks.js?v=s3.1.23"]]
};
for (const [file, pairs] of Object.entries(tags)) {
  edit(file, src => pairs.reduce((out, [from, to]) => {
    if (!out.includes(from)) throw new Error(`${file}: ${from}`);
    return out.split(from).join(to);
  }, src));
}

edit("ai-diagnostics-service.js", src => {
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.22";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.22\\""]}`;
  const anchor = `    {\n      version: "s3.1.22-data-classification-review",`;
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.22 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.22 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.23-rules-stage-1\",",
    "      title: \"Security rules Stage 1: profiles, messages, Inbox, door codes and SupRstR board signaling are limited to the people involved; other members' profiles load through the people directory\",",
    "      checks: [",
    "        {label:\"People directory helper\", file:\"floqr-people-directory.js\", includes:[\"getPeopleDirectory\"]},",
    "        {label:\"Mingl uses directory\", file:\"patron-app.js\", includes:[\"FLOQRPeople\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.23\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.23";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.22"`)) throw new Error("package.json version");
  return src.replace(`"version": "3.1.22"`, `"version": "3.1.23"`);
});

edit("README.md", src => {
  const head = "# CURRENT PACKAGE: FLOQR ShoutOut s3.1.22 (stable)";
  if (!src.includes(head)) throw new Error("README head");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const note = "- s3.1.23: Security rules Stage 1. Patron profiles are readable only by their owner and Master Admins; Search, Mingl, Services, My Profile, Club Admin and promoter reports load other members through the people directory, which leaves out contact details, consents, payment and security fields (Club Admins still see contacts for their own staff). Messages and Inbox are limited to the people in them, door codes and club message logs are server-written, and the SupRstR board can only add connection data to a live session.";
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut s3.1.23 (stable)${eol}${eol}${note}`);
});

console.log("bumped to s3.1.23");
