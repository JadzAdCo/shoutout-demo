"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

test("payment-return wires Site chrome early paint + scheme + hydrate", () => {
  const html = read("payment-return.html");
  assert.match(html, /floqr\.isSiteChrome/);
  assert.match(html, /data-floqr-chrome/);
  assert.match(html, /floqr-chrome-scheme\.js/);
  assert.match(html, /floqr-chrome-audit\.js/);
  const app = read("payment-return-app.js");
  assert.match(app, /hydrateFromProfile/);
  assert.match(app, /hydrateSiteChrome/);
});

test("ad-invoice and pass load chrome scheme + audit", () => {
  for (const file of ["ad-invoice.html", "pass.html"]) {
    const html = read(file);
    assert.match(html, /floqr-chrome-scheme\.js/, file);
    assert.match(html, /floqr-chrome-audit\.js/, file);
    assert.match(html, /floqr\.isSiteChrome/, file);
  }
});

test("chrome audit module + Master Admin diagnostics controls exist", () => {
  const audit = read("floqr-chrome-audit.js");
  assert.match(audit, /FLOQRChromeAudit/);
  assert.match(audit, /buildFixPrompt/);
  assert.match(audit, /probePage/);
  assert.match(audit, /floqr-chrome-change/);
  const master = read("master-admin.html");
  assert.match(master, /readChromeAuditBtn/);
  assert.match(master, /copyChromeAuditPromptBtn/);
  assert.match(master, /chromeAuditPrompt/);
  assert.match(master, /floqr-chrome-audit\.js/);
  const diag = read("ai-diagnostics-service.js");
  assert.match(diag, /renderChromeAuditDiagnostics/);
  assert.match(diag, /s3-2-32-receipt-chrome-audit/);
});
