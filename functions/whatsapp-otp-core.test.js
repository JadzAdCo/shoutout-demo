"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("./whatsapp-otp-core");

const read = relativePath => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("WhatsApp phone must be E.164 with a country code", () => {
  assert.equal(core.normalizeWhatsAppPhone("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(core.normalizeWhatsAppPhone("whatsapp:+2348012345678"), "+2348012345678");
  assert.equal(core.normalizeWhatsAppPhone("2025550123"), "");
  assert.equal(core.normalizeWhatsAppPhone("+0123"), "");
});

test("codes are 6 digits, hashed with a pepper, and compared in constant time", () => {
  assert.equal(core.createNumericCode(6, () => 42), "000042");
  assert.match(core.createNumericCode(), /^\d{6}$/);
  assert.equal(core.isValidCode("123456"), true);
  assert.equal(core.isValidCode("12345a"), false);
  const hash = core.hashCode("+33612345678", "123456", "pepper");
  assert.equal(core.codesMatch(hash, core.hashCode("+33612345678", "123456", "pepper")), true);
  assert.equal(core.codesMatch(hash, core.hashCode("+33612345678", "654321", "pepper")), false);
  assert.throws(() => core.hashCode("+1", "1", ""), /pepper/);
  assert.notEqual(core.challengeIdFor("+33612345678"), core.challengeIdFor("+33612345679"));
});

test("rate window enforces a resend cooldown and an hourly cap without mutating input", () => {
  const now = 10_000_000;
  const first = core.evaluateRateWindow({}, now);
  assert.equal(first.allowed, true);
  assert.deepEqual(first.next, {lastRequestedMs: now, windowStartMs: now, windowCount: 1});
  assert.equal(core.evaluateRateWindow(first.next, now + 30_000).reason, "cooldown");
  const capped = {lastRequestedMs: now, windowStartMs: now, windowCount: core.PHONE_WINDOW_MAX};
  const frozen = Object.freeze({...capped});
  assert.equal(core.evaluateRateWindow(frozen, now + 120_000).reason, "hourly-cap");
  assert.equal(core.evaluateRateWindow(frozen, now + core.PHONE_WINDOW_MS + 1).allowed, true);
  assert.equal(core.evaluateRateWindow({lastRequestedMs: now}, now + 1, {cooldownMs: 0}).allowed, true);
});

test("approved WhatsApp Authentication template wins over a free-form body", () => {
  const sid = `HX${"a".repeat(32)}`;
  const templated = core.buildTwilioParams({to: "whatsapp:+33612345678", from: "whatsapp:+14155550100", code: "123456", contentSid: sid});
  assert.equal(templated.ContentSid, sid);
  assert.deepEqual(JSON.parse(templated.ContentVariables), {1: "123456"});
  assert.equal(templated.Body, undefined);
  const freeform = core.buildTwilioParams({to: "whatsapp:+33612345678", from: "whatsapp:+14155550100", code: "123456", contentSid: "not-a-sid"});
  assert.match(freeform.Body, /FLOQR sign-in code is 123456/);
  assert.equal(freeform.ContentSid, undefined);
});

test("Twilio delivery statuses and WhatsApp error codes map to patron-facing hints", () => {
  assert.equal(core.isFailedStatus("undelivered"), true);
  assert.equal(core.isFailedStatus("sent"), false);
  assert.equal(core.isTerminalStatus("delivered"), true);
  assert.match(core.explainWhatsAppError("63016"), /approved sign-in template/);
  assert.match(core.explainWhatsAppError("63015"), /sandbox/);
  assert.match(core.explainWhatsAppError("99999"), /could not deliver/);
});

test("WhatsApp OTP callables log every auth event with a forced compliance row", () => {
  const src = read("functions/whatsapp-otp-functions.js");
  assert.match(src, /exports\.requestWhatsAppOtp = onCall/);
  assert.match(src, /exports\.verifyWhatsAppOtp = onCall/);
  assert.match(src, /forceSecurity: true/);
  assert.match(src, /purpose: "auth-otp"/);
  assert.match(src, /"auth-otp-verify"/);
  assert.match(src, /"auth-otp-status"/);
  assert.match(src, /fetchTwilioMessage/);
  assert.match(src, /enforceIpLimit/);
  assert.match(src, /createCustomToken\(user\.uid, \{whatsappOtp: true\}\)/);
  assert.match(read("functions/index.js"), /require\("\.\/whatsapp-otp-functions"\)/);
  const log = read("functions/twilio-log.js");
  assert.match(log, /forceSecurity === true \|\| isSecurityRelevant/);
  assert.match(log, /ContentSid: template/);
});

test("Welcome sign-in: WhatsApp worldwide and last, SMS US & Canada, no OTP divider, privacy links last in white", () => {
  const html = read("index.html");
  const card = html.slice(html.indexOf('id="landingPage"'), html.indexOf('id="signupProfilePage"'));
  assert.doesNotMatch(card, /Or use One Time Password/);
  assert.doesNotMatch(card, /class="divider"/);
  assert.match(card, /id="showWhatsAppOtpBtn"[^>]*data-i18n="app\.whatsappOtp"/);
  assert.match(card, /Continue with WhatsApp OTP \(Worldwide\)/);
  assert.match(card, /id="showSmsOtpBtn"[^>]*data-i18n="app\.smsOtp"/);
  assert.match(card, /Continue with SMS OTP \(US &amp; Canada Only\)/);
  const smsSelect = card.slice(card.indexOf('id="phoneCountryCode"'), card.indexOf("</select>", card.indexOf('id="phoneCountryCode"')));
  assert.equal((smsSelect.match(/<option/g) || []).length, 1, "SMS OTP is +1 (US & Canada) only");
  assert.match(smsSelect, /United States \/ Canada \(\+1\)/);
  const order = ["googleLoginBtn", "microsoftLoginBtn", "facebookLoginBtn", "showEmailOtpBtn", "showSmsOtpBtn", "showWhatsAppOtpBtn"]
    .map(id => card.indexOf(`id="${id}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "Google, Microsoft, Facebook, Email, SMS, then WhatsApp last");
  assert.match(card, /id="showEmailOtpBtn"[^>]*><span class="icon mail-icon">/);
  assert.match(card, /id="showSmsOtpBtn"[^>]*><span class="icon sms-icon">/);
  assert.match(card, /id="showWhatsAppOtpBtn"[^>]*><span class="icon wa-icon">/);
  const css = read("styles.css");
  assert.match(css, /#loginActions \.signin\{background:linear-gradient\(90deg,#1f8fff 0%,#5b5cff 52%,#a64dff 100%\);color:#fff/);
  assert.match(css, /#loginActions \.icon\{width:28px;height:28px/);
  assert.match(card, /id="whatsappCountryCode"/);
  const legal = card.indexOf('class="login-legal"');
  assert.ok(legal > card.indexOf('id="authStatus"'), "privacy links sit below every sign-in button");
  assert.ok(legal > card.indexOf('id="whatsappOtpPanel"'));
  assert.match(card, /data-i18n="app\.privacyPolicy"/);
  assert.match(card, /data-i18n="app\.doNotSell"/);
  assert.match(read("styles.css"), /\.login-legal a\{color:#fff/);
  const app = read("patron-app.js");
  assert.match(app, /httpsCallable\("requestWhatsAppOtp"\)/);
  assert.match(app, /httpsCallable\("verifyWhatsAppOtp"\)/);
  assert.match(app, /bind\("showWhatsAppOtpBtn", showWhatsAppOtpPanel\)/);
  assert.doesNotMatch(app, /FLOQRPhoneCountries\.populateSelect\(byId\("phoneCountryCode"\)\)/);
  assert.doesNotMatch(app, /populatePhoneCountrySelect\(/, "removed helper must not be called from DOMContentLoaded");
});

test("Welcome ? explains OTP in every supported language", () => {
  const html = read("index.html");
  assert.match(html, /data-floqr-help-body="[^"]*One Time Password \(OTP\)/);
  const repo = read("floqai-help-repository.js");
  assert.match(repo, /id: "help-welcome"[\s\S]{0,900}One Time Password \(OTP\)/);
  assert.match(repo, /"whatsapp otp"/);
  const help = read("floqr-i18n-help.js");
  const entries = help.match(/"help-welcome": \{[\s\S]*?\n {6}\}/g) || [];
  assert.equal(entries.length, 10);
  entries.forEach(entry => {
    assert.match(entry, /OTP/);
    assert.match(entry, /WhatsApp/);
    assert.match(entry, /SMS/);
  });
});
