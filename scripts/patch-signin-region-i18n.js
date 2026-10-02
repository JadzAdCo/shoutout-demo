#!/usr/bin/env node
// Splits "Continue with SMS OTP (US & Canada Only)" into a main label and a
// second-line region key in every chrome pack. Idempotent.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "floqr-i18n.js");
const src = fs.readFileSync(file, "utf8");
const KEYS = ["app.whatsappOtp", "app.smsOtp"];
let changed = 0;

const out = src.replace(/^(\s*)"(app\.(?:whatsappOtp|smsOtp))": "([^"\n]*?)\s*(\([^"\n]*\))",\r?$/gm, (line, indent, key, main, region) => {
  if (!KEYS.includes(key)) return line;
  changed += 1;
  const eol = line.endsWith("\r") ? "\r" : "";
  return `${indent}"${key}": ${JSON.stringify(main.trim())},${eol}\n${indent}"${key}Region": ${JSON.stringify(region.trim())},${eol}`;
});

if (!changed) {
  console.log("patch-signin-region-i18n: nothing to change");
  process.exit(0);
}
fs.writeFileSync(file, out, "utf8");
console.log(`patch-signin-region-i18n: split ${changed} labels`);
