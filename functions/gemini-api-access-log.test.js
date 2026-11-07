"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const logMod = require("./gemini-api-access-log");

test("gemini access log exports 30-day retention + helpers", () => {
  assert.equal(logMod.COLLECTION, "geminiApiAccessLogs");
  assert.equal(logMod.RETENTION_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(typeof logMod.logGeminiApiAccess, "function");
  assert.equal(typeof logMod.notifyGeminiFailuresLastHour, "function");
});

test("aiEnhanceShoutOutMedia wires gemini access logging + hourly checker", () => {
  const ai = fs.readFileSync(path.join(root, "functions/ai-discovery-functions.js"), "utf8");
  assert.match(ai, /gemini-api-access-log/);
  assert.match(ai, /logGeminiApiAccess/);
  assert.match(ai, /checkGeminiApiAccessFailures/);
  assert.match(ai, /every 60 minutes/);
  assert.match(ai, /failureReason/);
});

test("firestore rules allow Master Admin or FloqR Admin to read geminiApiAccessLogs", () => {
  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  assert.match(rules, /match \/geminiApiAccessLogs\/\{id\}/);
  assert.match(rules, /allow read: if isMasterAdmin\(\) \|\| isFloqrAdmin\(\)/);
});

test("purgeLogRetention sweeps geminiApiAccessLogs", () => {
  const src = fs.readFileSync(path.join(root, "functions/display-security-functions.js"), "utf8");
  assert.match(src, /geminiApiAccessLogs/);
});

test("Master Admin Application Logging surfaces Gemini access card", () => {
  const html = fs.readFileSync(path.join(root, "master-admin.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "master-logging-extension.js"), "utf8");
  assert.match(html, /geminiAccessLogList/);
  assert.match(html, /category <code>gemini<\/code>/);
  assert.match(js, /geminiApiAccessLogs/);
  assert.match(js, /Failure reason/);
});

test("Baller halo uses behind-card margin glow (not clipped outer-only shadow)", () => {
  const css = fs.readFileSync(path.join(root, "display.css"), "utf8");
  assert.match(css, /baller-red-halo-behind/);
  assert.match(css, /transform:scale\(0\.935\)/);
  assert.match(css, /background:transparent!important/);
});

test("BOT DEE chat bubbles allow flex wrap", () => {
  const css = fs.readFileSync(path.join(root, "bot-dee-chat.css"), "utf8");
  assert.match(css, /\.botdee-bubble \{[\s\S]*min-width: 0/);
  assert.match(css, /overflow-wrap: anywhere/);
});
