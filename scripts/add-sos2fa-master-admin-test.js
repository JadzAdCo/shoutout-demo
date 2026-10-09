#!/usr/bin/env node
/* s3.1.28: register the SOS2FA Master Admin test and bump functions/package.json to 3.1.28 (idempotent). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const file = path.join(root, "functions", "package.json");
const src = fs.readFileSync(file, "utf8");
const match = src.match(/"test": "node --test ([^"]*)"/);
if (!match) throw new Error("functions/package.json has no node --test script");
const list = match[1].split(" ").filter(Boolean);
for (const name of ["master-admin-claim-ui.test.js", "sos2fa-master-admin.test.js"]) {
  if (!list.includes(name)) list.push(name);
}
const out = src
  .replace(match[0], `"test": "node --test ${list.join(" ")}"`)
  .replace(/"version": "3\.1\.2[678]"/, '"version": "3.1.28"');
if (!/"version": "3\.1\.28"/.test(out)) throw new Error("Unexpected functions/package.json version");
JSON.parse(out);
fs.writeFileSync(file, out);
console.log(list.slice(-2).join(" "));
