"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

test("floqr-critical-log-blink.js ships shared standard API", () => {
  const src = fs.readFileSync(path.join(root, "floqr-critical-log-blink.js"), "utf8");
  assert.match(src, /FLOQRCriticalLogBlink/);
  assert.match(src, /geminiApiAccess/);
  assert.match(src, /securitySystemMessages/);
  assert.match(src, /displayLoadErrors/);
  assert.match(src, /summarizeCriticalRows/);
  assert.match(src, /floqr\.criticalLogAck/);
});

test("critical blink module summarizeCriticalRows treats Gemini failures as critical", () => {
  const src = fs.readFileSync(path.join(root, "floqr-critical-log-blink.js"), "utf8");
  const sandbox = {window: {}, module: {exports: {}}, console};
  vm.runInNewContext(src, sandbox, {filename: "floqr-critical-log-blink.js"});
  const api = sandbox.module.exports || sandbox.window.FLOQRCriticalLogBlink;
  const summary = api.summarizeCriticalRows([
    {outcome: "success", severity: "info", createdAtMs: 10},
    {outcome: "failure", severity: "critical", createdAtMs: 50},
    {outcome: "failure", ok: false, createdAtMs: 40}
  ]);
  assert.equal(summary.count, 2);
  assert.equal(summary.newestMs, 50);
});

test("Master Admin wires critical blink + Gemini ack", () => {
  const html = fs.readFileSync(path.join(root, "master-admin.html"), "utf8");
  const logging = fs.readFileSync(path.join(root, "master-logging-extension.js"), "utf8");
  const security = fs.readFileSync(path.join(root, "master-display-security.js"), "utf8");
  const diagnostics = fs.readFileSync(path.join(root, "master-diagnostics-panels.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "admin.css"), "utf8");
  assert.match(html, /floqr-critical-log-blink\.js/);
  assert.match(html, /id="appLoggingTab"/);
  assert.match(html, /geminiAccessLogAckBtn/);
  assert.match(html, /data-critical-log="geminiApiAccess"/);
  assert.match(logging, /publishGeminiCriticalBlink/);
  assert.match(logging, /Acknowledge critical failures|acknowledgeGeminiCriticalFailures/);
  assert.match(logging, /startGeminiCriticalWatch/);
  assert.match(security, /FLOQRCriticalLogBlink/);
  assert.match(diagnostics, /FLOQRCriticalLogBlink/);
  assert.match(css, /criticalLogTabBlink/);
});

test("Gemini access log stamps severity critical on failures", () => {
  const src = fs.readFileSync(path.join(root, "functions/gemini-api-access-log.js"), "utf8");
  assert.match(src, /severity: outcome === "failure" \? "critical" : "info"/);
  assert.match(src, /critical: outcome === "failure"/);
});
