#!/usr/bin/env node
/* s3.1.26: main's demo-seed-functions.js (not in the workspace) trusted an unverified token email and users-doc
 * masterAdmin/roles fields. Route its Master Admin check through admin-trust, in place (idempotent). */
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "functions", "demo-seed-functions.js");
if (!fs.existsSync(file)) {
  console.log("demo-seed-functions.js not present");
  process.exit(0);
}
const original = fs.readFileSync(file, "utf8");
let src = original;

const oldFn = /async function assertMasterAdmin\(auth\) \{\r?\n[\s\S]*?\r?\n\}\r?\n/;
const newFn = [
  "async function assertMasterAdmin(auth) {",
  "  if (!auth?.uid) throw new HttpsError(\"unauthenticated\", \"Sign in required.\");",
  "  if (isServerAdminAuth(auth)) return;",
  "  throw new HttpsError(\"permission-denied\", \"Master Admin only.\");",
  "}",
  ""
].join("\n");
if (!src.includes("if (isServerAdminAuth(auth)) return;")) {
  if (!oldFn.test(src)) throw new Error("demo-seed-functions.js: assertMasterAdmin not found");
  src = src.replace(oldFn, newFn);
}
if (!src.includes('require("./admin-trust")')) {
  const anchor = 'const crypto = require("crypto");';
  if (!src.includes(anchor)) throw new Error("demo-seed-functions.js: require anchor not found");
  src = src.replace(anchor, `${anchor}\nconst {isServerAdminAuth} = require("./admin-trust");`);
}
if (/MASTER_ADMIN_EMAILS\.includes\(|data\.masterAdmin === true/.test(src)) throw new Error("demo-seed-functions.js: inline admin trust remains");

fs.writeFileSync(file, src);
console.log(src === original ? "demo-seed already patched" : "patched demo-seed-functions.js (admin-trust)");
