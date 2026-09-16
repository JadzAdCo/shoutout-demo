"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  TLS_MIN,
  LOG_STANDARD,
  maskPhone,
  hashPhone,
  redactSecrets,
  isSecurityRelevant,
  collectionFor,
  COMPLIANCE_COLLECTION
} = require("./twilio-log");

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("Twilio logs request TLS 1.3 and use separate SMS/WhatsApp/feature collections", () => {
  const src = read("functions/twilio-log.js");
  assert.equal(TLS_MIN, "TLSv1.3");
  assert.match(LOG_STANDARD, /ISO\/IEC 27001:2022 A\.8\.15/);
  assert.match(src, /twilioSmsLogs/);
  assert.match(src, /twilioWhatsAppLogs/);
  assert.match(src, /twilioFeatureLogs/);
  assert.match(src, /twilioComplianceLogs/);
  assert.match(src, /minVersion: TLS_MIN/);
  assert.equal(collectionFor("sms"), "twilioSmsLogs");
  assert.equal(collectionFor("whatsapp"), "twilioWhatsAppLogs");
  assert.equal(collectionFor("debugger"), "twilioFeatureLogs");
  assert.equal(COMPLIANCE_COLLECTION, "twilioComplianceLogs");
});

test("Twilio phone masking and hashing minimize PII", () => {
  assert.equal(maskPhone("+12025551234"), "+***1234");
  assert.equal(maskPhone("whatsapp:+12025551234"), "whatsapp:***1234");
  assert.match(hashPhone("+12025551234"), /^[a-f0-9]{64}$/);
  assert.equal(hashPhone("+12025551234"), hashPhone("12025551234"));
  assert.match(redactSecrets("AC" + "0".repeat(32) + " token"), /AC\[redacted\]/);
  assert.match(redactSecrets("SK" + "f".repeat(32)), /SK\[redacted\]/);
});

test("dry-run and auth failures are security-relevant for GRC compliance rows", () => {
  assert.equal(isSecurityRelevant({status: "dry-run", dryRun: true}), true);
  assert.equal(isSecurityRelevant({status: "invalid-sid", errorCode: "20003"}), true);
  assert.equal(isSecurityRelevant({status: "sent", sendOk: true}), false);
});

test("marketing send allows retest and does not treat dry-run as delivered", () => {
  const src = read("functions/marketing-campaign-functions.js");
  assert.match(src, /allowRetest/);
  assert.match(src, /broadcast/);
  assert.match(src, /sendTwilioMessagesApi/);
  assert.match(src, /Debit only for real Twilio accepts/);
  assert.match(src, /"tested"/);
  assert.match(src, /fillPlaceholders/);
  assert.match(src, /Campaign already sent\. Save a new draft/);
});

test("Master Admin exposes Twilio tab with log-type subtabs including compliance and SendGrid mail", () => {
  const html = read("master-admin.html");
  const ui = read("master-twilio-logging.js");
  assert.match(html, /data-tab-group="twilio"/);
  assert.match(html, /data-panel="twilioSmsLogs"/);
  assert.match(html, /data-panel="twilioWhatsAppLogs"/);
  assert.match(html, /data-panel="twilioFeatureLogs"/);
  assert.match(html, /data-panel="twilioComplianceLogs"/);
  assert.match(html, /data-panel="twilio_sendgridMailLogs"/);
  assert.match(html, /master-twilio-logging\.js\?v=/);
  assert.doesNotMatch(html, /data-panel="twilioLogging"/);
  assert.doesNotMatch(html, /data-panel="mailLogging"/);
  assert.match(ui, /twilioSmsLogs/);
  assert.match(ui, /mountClub/);
  assert.match(ui, /twilioComplianceLogs/);
});

test("Club Admin Advertising exposes club-scoped SMS and WhatsApp logs", () => {
  const html = read("admin.html");
  assert.match(html, /id="clubMessagingLogsCard"/);
  assert.match(html, /id="clubTwilioSmsLogsList"/);
  assert.match(html, /id="clubTwilioWhatsAppLogsList"/);
  assert.match(html, /master-twilio-logging\.js\?v=/);
});

test("Firestore rules allow club managers to read their SMS/WhatsApp Twilio logs", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/twilioSmsLogs\/\{id\}/);
  assert.match(rules, /match \/twilioWhatsAppLogs\/\{id\}/);
  assert.match(rules, /match \/twilioFeatureLogs\/\{id\}/);
  assert.match(rules, /match \/twilioComplianceLogs\/\{id\}/);
  assert.match(rules, /isClubManager\(resource\.data\.clubLocationId\)/);
});

test("messaging and marketing send paths share twilio-log", () => {
  const messaging = read("functions/messaging-functions.js");
  const marketing = read("functions/marketing-campaign-functions.js");
  assert.match(messaging, /require\("\.\/twilio-log"\)/);
  assert.match(messaging, /sendTwilioMessagesApi/);
  assert.match(marketing, /require\("\.\/twilio-log"\)/);
});
