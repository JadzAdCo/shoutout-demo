#!/usr/bin/env node
/* s3.1.26: drop broadcasterEmail from the public suprstrSessions doc in main's own suprstr-functions.js (idempotent).
 * main carries supRstar code the workspace does not, so the file is patched in place instead of overwritten. */
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "functions", "suprstr-functions.js");
const src = fs.readFileSync(file, "utf8");
const start = src.indexOf("tx.set(sessionRef, {");
if (start < 0) throw new Error("suprstr-functions.js: tx.set(sessionRef, { not found");
const end = src.indexOf("});", start);
const block = src.slice(start, end);
const out = src.slice(0, start) + block.replace(/\r?\n[ \t]*broadcasterEmail:[^\n]*/g, "") + src.slice(end);
if (/broadcasterEmail/.test(out.slice(start, out.indexOf("});", start)))) throw new Error("broadcasterEmail still on the session doc");
fs.writeFileSync(file, out);
console.log(out === src ? "already patched" : "removed broadcasterEmail from suprstrSessions");
