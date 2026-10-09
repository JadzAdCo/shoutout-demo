#!/usr/bin/env node
/* One-off s3.1.23 → s3.1.24 stamp bump (rules Stages 2–3: club-scoped loaders, access notice, Mingl Gist stories callable). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const edit = (file, fn) => fs.writeFileSync(at(file), fn(fs.readFileSync(at(file), "utf8")));

const versioned = [
  "admin.html", "club-embed.html", "club-profile.html", "display.html", "display2.html", "floqai.html", "floqai-search.html",
  "floqr-nav.js", "guest-list.html", "index.html", "master-admin.html", "mingl-chat.html", "patron-portal.html",
  "promoter-admin.html", "role-request.html", "services.html", "template-tags.html"
];
for (const file of versioned) {
  edit(file, src => {
    const hits = src.split("s3.1.23").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.23 stamp`);
    console.log(file, hits);
    return src.split("s3.1.23").join("s3.1.24");
  });
}

edit("mingl-gist.html", src => {
  const from = "floqr-blocks.js?v=s3.1.23";
  if (!src.includes(from)) throw new Error("mingl-gist floqr-blocks stamp");
  return src.split(from).join("floqr-blocks.js?v=s3.1.24");
});

edit("ai-diagnostics-service.js", src => {
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.23";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.23\\""]}`;
  const anchor = `    {\n      version: "s3.1.23-rules-stage-1",`;
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.23 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.23 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.24-rules-stages-2-3\",",
    "      title: \"Security rules Stages 2-3: ShoutOuts, guest lists, staff, follows, rides and club settings are limited to their owner and that club's team; pages show a notice when something is hidden instead of an empty list\",",
    "      checks: [",
    "        {label:\"Access notice\", file:\"floqr-access-notice.js\", includes:[\"FLOQRAccessNotice\"]},",
    "        {label:\"Mingl Gist stories callable\", file:\"mingl-gist-app.js\", includes:[\"getShoutoutStories\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.24\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.24";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.23"`)) throw new Error("package.json version");
  return src.replace(`"version": "3.1.23"`, `"version": "3.1.24"`);
});

edit("README.md", src => {
  const head = "# CURRENT PACKAGE: FLOQR ShoutOut s3.1.23 (stable)";
  if (!src.includes(head)) throw new Error("README head");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const note = "- s3.1.24: Security rules Stages 2-3. ShoutOuts and guest list requests are visible to the patron who sent them and to that club's team; staff rosters, role requests, club settings, messaging credits and marketing campaigns are limited to the club's admins (customer service staff stay reachable); follows and RydR rides are private to their owner; club listings, events, media, live boards and DJ / promoter profiles can only be changed by their owner, the club's admins or Master Admins. Mingl Gist loads ShoutOut stories without the sender's contact details, and pages show a notice when something is hidden or could not load instead of an empty list.";
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut s3.1.24 (stable)${eol}${eol}${note}`);
});

console.log("bumped to s3.1.24");
