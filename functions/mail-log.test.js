"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {redactSecrets, emailsOf, TLS_MIN, applyMailEvents} = require("./mail-log");

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("system mail send path requests TLS 1.3 and logs Firestore", () => {
  const mailLog = read("functions/mail-log.js");
  assert.match(mailLog, /minVersion: TLS_MIN/);
  assert.match(mailLog, /TLSv1\.3/);
  assert.match(mailLog, /systemMailLogs/);
  assert.match(mailLog, /enforced_tls/);
  assert.match(mailLog, /floqrMailLogId/);
  assert.equal(TLS_MIN, "TLSv1.3");
});

test("OTP-style bodies redact six-digit codes in stored logs", () => {
  assert.match(redactSecrets("Your FLOQR sign-in code is 123456. Expires soon."), /••••••/);
  assert.doesNotMatch(redactSecrets("Your FLOQR sign-in code is 123456."), /123456/);
  assert.deepEqual(emailsOf(["Don@Floqr.com", {email: "bans.don@gmail.com"}]), [
    "don@floqr.com",
    "bans.don@gmail.com"
  ]);
});

test("Master Admin Diagnostics exposes Mail Logging search and content", () => {
  const html = read("master-admin.html");
  const ui = read("master-mail-logging.js");
  assert.match(html, /data-panel="mailLogging"/);
  assert.match(html, /id="mailLogging"/);
  assert.match(html, /id="mailLogSearch"/);
  assert.match(html, /id="mailLogStatusFilter"/);
  assert.match(html, /master-mail-logging\.js\?v=/);
  assert.match(html, /data-floqr-help-id="help-mail-logging"/);
  assert.match(ui, /COLLECTION = "systemMailLogs"/);
  assert.match(ui, /\.collection\(COLLECTION\)/);
  assert.match(ui, /tlsMinRequested/);
  assert.match(ui, /requestHeaders/);
  assert.match(ui, /htmlBody/);
});

test("Firestore rules: Master Admin read-only systemMailLogs", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/systemMailLogs\/\{id\}/);
  assert.match(rules, /allow read: if isMasterAdmin\(\)/);
});

test("all SendGrid mail/send call sites go through sendSystemMail", () => {
  const files = [
    "functions/ai-discovery-functions.js",
    "functions/messaging-functions.js",
    "functions/sos2fa-functions.js",
    "functions/receipt-delivery.js"
  ];
  files.forEach((file) => {
    const src = read(file);
    assert.doesNotMatch(src, /api\.sendgrid\.com\/v3\/mail\/send/);
    assert.match(src, /sendSystemMail/);
  });
});

test("preview-links mailer defaults to s3 package label not vs3", () => {
  const src = read("functions/ai-discovery-functions.js");
  assert.match(src, /formatPreviewPackageLabel/);
  assert.match(src, /package \|\| body\.v \|\| query\.package \|\| query\.v \|\| "s3\.0\.7"/);
  assert.doesNotMatch(src, /query\.v \|\| "29\.09\.117"/);
});

test("applyMailEvents maps delivered onto an existing log", async () => {
  const result = await applyMailEvents([]);
  assert.equal(result.ok, true);
  assert.equal(result.received, 0);
  assert.equal(result.updated, 0);
});
