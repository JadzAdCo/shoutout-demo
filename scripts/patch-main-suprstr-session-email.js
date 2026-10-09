#!/usr/bin/env node
/* s3.1.26: patch main's own suprstr-functions.js in place (idempotent):
 * - drop broadcasterEmail from the public suprstrSessions doc
 * - Master Admin check goes through admin-trust (claim or verified server-list email)
 * main carries supRstar code the workspace does not, so the file is patched in place instead of overwritten. */
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "functions", "suprstr-functions.js");
let src = fs.readFileSync(file, "utf8");
const original = src;

const start = src.indexOf("tx.set(sessionRef, {");
if (start < 0) throw new Error("suprstr-functions.js: tx.set(sessionRef, { not found");
const end = src.indexOf("});", start);
src = src.slice(0, start) + src.slice(start, end).replace(/\r?\n[ \t]*broadcasterEmail:[^\n]*/g, "") + src.slice(end);
if (/broadcasterEmail/.test(src.slice(start, src.indexOf("});", start)))) throw new Error("broadcasterEmail still on the session doc");

const oldCheck = /function isMasterAdminAuth\(authContext = \{\}\) \{\r?\n[\s\S]*?MASTER_ADMIN_EMAILS\.includes\(email\);\r?\n\}/;
if (oldCheck.test(src)) {
  src = src.replace(oldCheck, [
    "function isMasterAdminAuth(authContext = {}) {",
    "  if (!authContext.uid) return false;",
    "  return isServerAdminAuth(authContext);",
    "}"
  ].join("\n"));
}
if (!src.includes('require("./admin-trust")')) {
  const anchor = "const MASTER_ADMIN_EMAILS = ";
  if (!src.includes(anchor)) throw new Error("suprstr-functions.js: MASTER_ADMIN_EMAILS anchor not found");
  src = src.replace(anchor, `const {isServerAdminAuth} = require("./admin-trust");\n${anchor}`);
}
if (/MASTER_ADMIN_EMAILS\.includes\(/.test(src)) throw new Error("inline Master Admin email check still present");

fs.writeFileSync(file, src);
console.log(src === original ? "already patched" : "patched suprstr-functions.js (session email + admin-trust)");
