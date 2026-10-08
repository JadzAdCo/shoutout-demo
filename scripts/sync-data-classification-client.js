#!/usr/bin/env node
/* Copies functions/data-classification-core.js to the served floqr-data-classification.js (byte-identical).
   Usage: node scripts/sync-data-classification-client.js [--check] */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "functions", "data-classification-core.js");
const DEST = path.join(ROOT, "floqr-data-classification.js");

const source = fs.readFileSync(SRC);
if (process.argv.includes("--check")) {
  const current = fs.existsSync(DEST) ? fs.readFileSync(DEST) : Buffer.alloc(0);
  if (!current.equals(source)) {
    console.error("floqr-data-classification.js differs from functions/data-classification-core.js. Run: node scripts/sync-data-classification-client.js");
    process.exit(1);
  }
  console.log("Client classification module is in sync.");
} else {
  fs.writeFileSync(DEST, source);
  console.log(`Copied ${path.relative(ROOT, SRC)} -> ${path.relative(ROOT, DEST)}`);
}
