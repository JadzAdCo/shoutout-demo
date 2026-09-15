"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const compliance = require("./shoutout-compliance-functions");

test("compliance retention constants match approved policy", () => {
  assert.equal(compliance.MEDIA_RETENTION_DAYS, 90);
  assert.equal(compliance.AUDIT_RETENTION_YEARS, 7);
  assert.equal(compliance.UI_DEFAULT_SEARCH_DAYS, 60);
});

test("buildComplianceRecord indexes venue content and media purge window", () => {
  const row = compliance.buildComplianceRecord("abc123", {
    status: "approved",
    mainText: "HAPPY BIRTHDAY NYX",
    subText: "@nyx",
    locationName: "Zebbies Miami",
    clubLocationId: "zebbies-miami",
    mediaUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/shoutouts%2Fuid%2Ffile.jpg?alt=media",
    mediaType: "image/jpeg",
    submittedAt: {toMillis: () => Date.parse("2026-01-01T00:00:00Z")},
    approvedAt: {toMillis: () => Date.parse("2026-01-02T00:00:00Z")},
    amountCents: 2000,
    paymentStatus: "paid",
    referenceNumber: "SO-1",
    submittedBy: "patron@example.com",
    clientIp: "69.243.87.16",
    ipSource: "callable"
  });
  assert.equal(row.shoutoutId, "abc123");
  assert.equal(row.venueNameLower, "zebbies miami");
  assert.match(row.searchBlob, /happy birthday nyx/);
  assert.equal(row.hasMedia, true);
  assert.equal(row.mediaPurgeStatus, "pending");
  assert.equal(row.lifecyclePhase, "completed");
  assert.ok(row.mediaRetentionUntilMs > row.eventAtMs);
  assert.ok(row.retentionUntilMs > row.eventAtMs);
  assert.equal(row.complianceVersion, "s3.0.68");
  assert.equal(row.actorEmail, "patron@example.com");
  assert.equal(row.actorIdentifier, "patron@example.com");
  assert.equal(row.clientIp, "69.243.87.16");
});

test("actorFieldsFromSources prefers email then phone", () => {
  const emailFirst = compliance.actorFieldsFromSources({
    submittedBy: "a@b.com",
    phone: "2025551212"
  });
  assert.equal(emailFirst.actorIdentifier, "a@b.com");
  const phoneOnly = compliance.actorFieldsFromSources({
    phone: "2025551212"
  }, {});
  assert.equal(phoneOnly.actorIdentifier, "2025551212");
});

test("shouldIndexShoutout covers submitted and rejected lifecycle", () => {
  assert.equal(compliance.shouldIndexShoutout({status: "pending", referenceNumber: "SO-1"}), true);
  assert.equal(compliance.shouldIndexShoutout({status: "rejected"}), true);
  assert.equal(compliance.shouldIndexShoutout({status: "approved"}), true);
  assert.equal(compliance.shouldIndexShoutout({status: "stale"}), true);
  assert.equal(compliance.lifecyclePhase("rejected"), "rejected");
  assert.equal(compliance.lifecyclePhase("pending_approval", "paid"), "submitted_paid");
});

test("master admin html nests ShoutOuts completed log and retention", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "master-admin.html"), "utf8");
  assert.match(html, /data-tab-group="shoutouts"/);
  assert.match(html, /data-panel="shoutoutCompletedLog"/);
  assert.match(html, /data-panel="shoutoutRetention"/);
  assert.match(html, /master-admin-shoutouts\.js\?v=s3\.0\.68/);
  assert.match(html, /id="soComplianceVenue"/);
  assert.match(html, /id="soComplianceVenueList"/);
  assert.match(html, /id="soComplianceStatusFilter"/);
  assert.match(html, /id="soComplianceRebuildBtn"/);
  assert.match(html, /id="soComplianceContent"/);
});

test("firestore rules harden shoutoutAudit and lock compliance logs", () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
  assert.match(rules, /match \/shoutoutComplianceLogs\/\{shoutoutId\}/);
  assert.match(rules, /allow read: if isMasterAdmin\(\);\s*\n allow create, update, delete: if false;/);
  assert.match(rules, /match \/shoutoutAudit\/\{id\}/);
  assert.match(rules, /allow update, delete: if false;/);
});

test("patron portal completed actions prefer Re-Use over Diagnose", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "patron-portal-app.js"), "utf8");
  assert.match(app, /reuse-shoutout-btn/);
  assert.match(app, /mode === "open".*diagnose-shoutout-btn/s);
  assert.match(app, /shoutoutTemplateIsModifiable/);
  assert.match(app, /FLOQR_REUSE_SHOUTOUT/);
});

test("master admin shoutouts loads venues from clubLocations", () => {
  const js = fs.readFileSync(path.join(__dirname, "..", "master-admin-shoutouts.js"), "utf8");
  assert.match(js, /clubLocations/);
  assert.match(js, /soComplianceVenueList/);
  assert.match(js, /backfillShoutoutComplianceLogs/);
  assert.match(js, /startOfDayInput\(60\)/);
});
