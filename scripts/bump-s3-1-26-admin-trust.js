#!/usr/bin/env node
/* s3.1.26 Phase 0 follow-up: re-stamp the admin-list scripts (typo admin address removed) on the pages that ship in s3.1.26.
 * display.html / display2.html are never touched (Xibo URLs stay location-only). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const pages = [
  "admin.html", "index.html", "master-admin.html", "patron-portal.html", "commerce.html", "mingl-chat.html",
  "mingl-gist.html", "floqai.html", "club-profile.html", "role-request.html", "promoter-admin.html",
  "template-tags.html", "guest-list.html", "seed-v29-09-14.html", "onboard-dc-venues.html",
  "beta-invite.html", "pickup.html", "rydr.html", "suprstar-preview.html", "suprstr-search.html"
];
const scripts = /\.\/(shared-data|feature-gates|sos2fa|floqr-feature-services|ai-diagnostics-service)\.js\?v=[^"']+/g;

for (const page of pages) {
  const file = path.join(root, page);
  const before = fs.readFileSync(file, "utf8");
  const after = before.replace(scripts, (_, name) => `./${name}.js?v=s3.1.26`);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log(page, (before.match(scripts) || []).length);
  }
}
