#!/usr/bin/env node
/* s3.1.25: register board-fit + display-text-fit tests in functions/package.json (idempotent). */
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "functions", "package.json");
const src = fs.readFileSync(file, "utf8");
const match = src.match(/"test": "node --test ([^"]*)"/);
if (!match) throw new Error("functions/package.json has no node --test script");
const list = match[1].split(" ").filter(Boolean);
for (const test of ["display-text-fit.test.js", "board-fit.test.js"]) {
  if (!list.includes(test)) list.push(test);
}
const out = src.replace(match[0], `"test": "node --test ${list.join(" ")}"`);
JSON.parse(out);
fs.writeFileSync(file, out);
console.log(list.slice(-3).join(" "));
