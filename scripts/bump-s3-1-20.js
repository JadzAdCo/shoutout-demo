#!/usr/bin/env node
/* One-off s3.1.19 → s3.1.20 stamp bump (club website feed, staff photo consent, FloqAi page). */
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
    const hits = src.split("s3.1.19").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.19 stamp`);
    console.log(file, hits);
    return src.split("s3.1.19").join("s3.1.20");
  });
}

const featureServicePages = [
  "index.html", "master-admin.html", "pickup.html", "mingl-gist.html", "beta-invite.html", "rydr.html",
  "suprstr-search.html", "suprstar-preview.html", "mingl-chat.html", "commerce.html"
];
for (const file of featureServicePages) {
  edit(file, src => {
    const from = "floqr-feature-services.js?v=s3.0.110";
    if (!src.includes(from)) throw new Error(`${file}: feature-services stamp`);
    return src.split(from).join("floqr-feature-services.js?v=s3.1.20");
  });
}

edit("ai-diagnostics-service.js", src => {
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.19";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.19\\""]}`;
  const anchor = `    {\n      version: "s3.1.19-featured-staff-picker",`;
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.19 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.19 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.20-club-feed-floqai\",",
    "      title: \"Club Admin website feed (iframe / JSON / RSS of events, DJs, featured staff, gallery), staff photo consent before publishing pictures, and FloqAi on its own page\",",
    "      checks: [",
    "        {label:\"Club feed datasets\", file:\"functions/club-public-feed-core.js\", includes:[\"function staffView(\", \"function buildEventsRss(\"]},",
    "        {label:\"Website feed card\", file:\"admin.html\", includes:[\"id=\\\"websiteFeedGenerateBtn\\\"\"]},",
    "        {label:\"Club website iframe\", file:\"club-embed.js\", includes:[\"dataset\"]},",
    "        {label:\"FloqAi page\", file:\"floqai.html\", includes:[\"data-floqr-feature=\\\"floqAi\\\"\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.20\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.20";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.19"`)) throw new Error("package.json version");
  return src.replace(`"version": "3.1.19"`, `"version": "3.1.20"`);
});

edit("README.md", src => {
  const head = "# CURRENT PACKAGE: FLOQR ShoutOut s3.1.19 (stable)";
  if (!src.includes(head)) throw new Error("README head");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const note = "- s3.1.20: Club Admin → Club Public Profile → **Website feed** generates a private link for the club's official website: an iframe, a JSON feed, and an events RSS feed with upcoming events, featured DJs, featured staff, and gallery photos (only sections shown on the public profile). Featured staff photos now need a consent confirmation before they publish. FloqAi opens on its own page (`floqai.html`) instead of bouncing to event search.";
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut s3.1.20 (stable)${eol}${eol}${note}`);
});

console.log("bumped to s3.1.20");
