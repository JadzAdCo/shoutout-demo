#!/usr/bin/env node
/* One-off s3.1.16 → s3.1.17 stamp bump (Entity Mgmt link output, tel/mailto, Papi's ClubTech photos). */
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
    const hits = src.split("s3.1.16").length - 1;
    if (!hits) throw new Error(`${file}: no s3.1.16 stamp`);
    console.log(file, hits);
    return src.split("s3.1.16").join("s3.1.17");
  });
}

const stamps = [
  ["master-admin.html", "./styles.css?v=s3.1.0", "./styles.css?v=s3.1.17"],
  ["master-admin.html", "./admin.css?v=s3.0.102", "./admin.css?v=s3.1.17"],
  ["master-admin.html", "./entity-management.js?v=s3.0.3", "./entity-management.js?v=s3.1.17"],
  ["club-profile.html", "./styles.css?v=29.09.105", "./styles.css?v=s3.1.17"],
  ["club-profile.html", "./club-profile-app.js?v=s3.0.87", "./club-profile-app.js?v=s3.1.17"],
  ["patron-portal.html", "./styles.css?v=s3.1.1", "./styles.css?v=s3.1.17"],
  ["patron-portal.html", "./admin.css?v=s3.0.66", "./admin.css?v=s3.1.17"],
  ["admin.html", "./admin.css?v=s3.0.2", "./admin.css?v=s3.1.17"]
];
for (const [file, from, to] of stamps) {
  edit(file, src => {
    if (!src.includes(from)) throw new Error(`${file}: missing ${from}`);
    return src.replace(from, to);
  });
}

edit("functions/package.json", src => {
  if (!src.includes(`"version": "3.1.16"`)) throw new Error("package.json version");
  if (!src.includes("temp-qa-showcase.test.js ")) throw new Error("package.json test list");
  return src
    .replace(`"version": "3.1.16"`, `"version": "3.1.17"`)
    .replace("temp-qa-showcase.test.js ", "temp-qa-showcase.test.js entity-link-output.test.js ");
});
console.log("bumped to s3.1.17");
