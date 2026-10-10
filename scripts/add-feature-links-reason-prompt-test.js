#!/usr/bin/env node
/* Registers feature-links-reason-prompt.test.js and sets version 3.1.30 in a functions/package.json (main keeps its own list). */
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const file = path.join(root, "functions", "package.json");
const TEST = "feature-links-reason-prompt.test.js";
const VERSION = "3.1.30";

const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
const script = String(pkg.scripts?.test || "");
if (!script.startsWith("node --test ")) throw new Error(`Unexpected test script in ${file}`);
const list = script.slice("node --test ".length).trim().split(/\s+/).filter(Boolean);
if (!list.includes(TEST)) list.push(TEST);
pkg.scripts.test = `node --test ${list.join(" ")}`;
pkg.version = VERSION;
fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`functions/package.json: version ${VERSION}, ${list.length} test files`);
