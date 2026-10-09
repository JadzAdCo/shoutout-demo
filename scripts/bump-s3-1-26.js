#!/usr/bin/env node
/* One-off s3.1.25 → s3.1.26 stamp bump (Security Phase 0 + 1: privilege trust, OTP lockout, Mingl / supRstar / aiIndex rules).
 * display.html / display2.html keep s3.1.25 on purpose (nothing they load changed). Xibo URLs never carry ?v=. */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const edit = (file, fn) => fs.writeFileSync(at(file), fn(fs.readFileSync(at(file), "utf8")));

const versioned = [
  "admin.html", "club-embed.html", "club-profile.html", "floqai.html", "floqai-search.html",
  "floqr-nav.js", "guest-list.html", "index.html", "mingl-chat.html", "mingl-gist.html", "patron-portal.html",
  "promoter-admin.html", "role-request.html", "services.html", "template-tags.html"
];
for (const file of versioned) {
  edit(file, src => {
    const hits = src.split("s3.1.25").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.25 stamp`);
    console.log(file, hits);
    return src.split("s3.1.25").join("s3.1.26");
  });
}

// Changed scripts that some pages still load with an older stamp.
const restamp = [
  ["admin.html", /ai-index-service\.js\?v=[^"]+/],
  ["index.html", /ai-index-service\.js\?v=[^"]+/],
  ["master-admin.html", /ai-index-service\.js\?v=[^"]+/],
  ["patron-portal.html", /ai-index-service\.js\?v=[^"]+/],
  ["commerce.html", /floqr-blocks\.js\?v=[^"]+/]
];
for (const [file, pattern] of restamp) {
  edit(file, src => {
    const hit = src.match(pattern);
    if (!hit) throw new Error(`${file}: ${pattern} not found`);
    const script = hit[0].split("?")[0];
    console.log(file, script);
    return src.replace(pattern, `${script}?v=s3.1.26`);
  });
}

edit("ai-diagnostics-service.js", src => {
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.split("\n").join(eol);
  const pkg = `const PREVIEW_LINKS_PACKAGE = "s3.1.25";`;
  const oldCheck = `,\n        {label:"Preview links package", file:"ai-diagnostics-service.js", includes:["PREVIEW_LINKS_PACKAGE = \\"s3.1.25\\""]}`;
  const anchor = `    {\n      version: "s3.1.25-board-fit",`;
  if (!src.includes(pkg)) throw new Error("PREVIEW_LINKS_PACKAGE");
  if (!src.includes(norm(oldCheck))) throw new Error("s3.1.25 package check");
  if (!src.includes(norm(anchor))) throw new Error("s3.1.25 entry anchor");
  const entry = [
    "    {",
    "      version: \"s3.1.26-security-phase-1\",",
    "      title: \"Security: admin rights come only from the server, wrong codes now count toward the lockout, and Mingl chats, blocks, inbox messages and supRstar streams can only be changed by the people they belong to\",",
    "      checks: [",
    "        {label:\"Rules version\", file:\"firestore.rules\", includes:[\"s3.1.26-security-phase-1\", \"function isValidNewMinglRoom(\", \"function minglStatusTransitionOk(\"]},",
    "        {label:\"Mingl request sender\", file:\"patron-app.js\", includes:[\"messageType:\\\"mingl_request\\\", senderUid:currentUser.uid\"]},",
    "        {label:\"Search index write tolerates denial\", file:\"ai-index-service.js\", includes:[\"permission-denied\"]},",
    "        {label:\"Preview links package\", file:\"ai-diagnostics-service.js\", includes:[\"PREVIEW_LINKS_PACKAGE = \\\"s3.1.26\\\"\"]}",
    "      ]",
    "    },",
    ""
  ].join(eol);
  return src
    .replace(pkg, `const PREVIEW_LINKS_PACKAGE = "s3.1.26";`)
    .replace(norm(oldCheck), "")
    .replace(norm(anchor), entry + norm(anchor));
});

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.25"`)) throw new Error("package.json version");
  return src.replace(`"version": "3.1.25"`, `"version": "3.1.26"`);
});

edit("README.md", src => {
  const head = "# CURRENT PACKAGE: FLOQR ShoutOut s3.1.25 (stable)";
  if (!src.includes(head)) throw new Error("README head");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const note = "- s3.1.26: Security. Admin rights are decided only by the server (never by fields a patron can edit on their own profile), wrong SOS2FA / email codes now count toward the lockout, and assigning venue employees needs an SOS2FA session. Mingl chats, Mingl requests, blocks, inbox messages, Mingl photos and supRstar streams can only be read or changed by the people they belong to; the search index is written by Master Admins only.";
  return src.replace(head, `# CURRENT PACKAGE: FLOQR ShoutOut s3.1.26 (stable)${eol}${eol}${note}`);
});

console.log("bumped to s3.1.26");
