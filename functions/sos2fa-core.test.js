"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  maskPhoneLast5,
  maskEmail,
  resolveSos2faChannels,
  formatDeliveryNotes,
  recoveryWindowOpen,
  recoveryCodeMatches,
  nextRecoveryAttempt
} = require("./sos2fa-core");
const fs = require("node:fs");
const path = require("node:path");

test("SOS2FA recovery code only inside the dated window", () => {
  const until = "2026-10-16T04:00:00Z";
  assert.equal(recoveryWindowOpen(until, Date.parse("2026-10-02T12:00:00Z")), true);
  assert.equal(recoveryWindowOpen(until, Date.parse("2026-10-16T04:00:00Z")), false);
  assert.equal(recoveryWindowOpen("", Date.now()), false);
  assert.equal(recoveryWindowOpen("not-a-date", Date.now()), false);
});

test("SOS2FA recovery code compares exactly and refuses short secrets", () => {
  assert.equal(recoveryCodeMatches("correct-horse-battery", "correct-horse-battery"), true);
  assert.equal(recoveryCodeMatches("correct-horse-battery", " correct-horse-battery "), true);
  assert.equal(recoveryCodeMatches("correct-horse-battery", "correct-horse-batterY"), false);
  assert.equal(recoveryCodeMatches("correct-horse-battery", ""), false);
  assert.equal(recoveryCodeMatches("short-code", "short-code"), false, "secrets under 12 characters never match");
  assert.equal(recoveryCodeMatches("", ""), false);
});

test("SOS2FA recovery attempts: 5 per hour, then locked until the window resets", () => {
  const t0 = Date.parse("2026-10-02T12:00:00Z");
  let row = {};
  for (let i = 1; i <= 5; i += 1) {
    row = nextRecoveryAttempt(row, t0 + i * 1000);
    assert.equal(row.count, i);
  }
  assert.equal(nextRecoveryAttempt(row, t0 + 10 * 60 * 1000), null);
  assert.deepEqual(nextRecoveryAttempt(row, t0 + 61 * 60 * 1000), {windowStartMs: t0 + 61 * 60 * 1000, count: 1});
});

test("SOS2FA recovery callable: Super Admin email list, verified email, secret, audit, entityManagement session", () => {
  const src = fs.readFileSync(path.join(__dirname, "sos2fa-functions.js"), "utf8");
  assert.match(src, /defineSecret\("SOS2FA_RECOVERY_CODE"\)/);
  assert.match(src, /exports\.verifySos2faRecoveryCode = onCall\(\{[^}]*secrets: \[SOS2FA_RECOVERY_CODE\]/);
  assert.match(src, /SUPER_ADMIN_EMAILS\.includes\(email\)/);
  assert.match(src, /email_verified !== true/);
  assert.match(src, /recoveryWindowOpen\(RECOVERY_UNTIL_ISO\)/);
  assert.match(src, /action: "sos2fa_recovery_verified"/);
  assert.match(src, /action: "sos2fa_recovery_failed"/);
  assert.match(src, /via: "recovery-code"/);
  assert.match(fs.readFileSync(path.join(__dirname, "index.js"), "utf8"), /verifySos2faRecoveryCode: sos2faFns\.verifySos2faRecoveryCode/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8"), /match \/sos2faRecoveryAttempts\/\{uid\} \{\s*allow read, write: if false;/);
  const client = fs.readFileSync(path.join(__dirname, "..", "sos2fa.js"), "utf8");
  assert.match(client, /callable\("verifySos2faRecoveryCode"\)/);
  const html = fs.readFileSync(path.join(__dirname, "..", "master-admin.html"), "utf8");
  assert.match(html, /id="sos2faRecoveryCode" type="password"/);
  assert.match(html, /id="sos2faRecoveryBtn"/);
});

test("SOS2FA masks phone last 5 and email local-part", () => {
  assert.equal(maskPhoneLast5("+12025530274"), "SMS ****3-0274");
  assert.equal(maskEmail("bans.don@gmail.com"), "email B***@gmail.com");
});

test("SOS2FA channels follow universal notifyEmail / notifySms flags", () => {
  const both = resolveSos2faChannels({}, "bans.don@gmail.com", "+12025530274");
  assert.equal(both.sms, true);
  assert.equal(both.email, true);

  const emailOnly = resolveSos2faChannels({notifySms: false}, "bans.don@gmail.com", "+12025530274");
  assert.equal(emailOnly.sms, false);
  assert.equal(emailOnly.email, true);

  const smsOnly = resolveSos2faChannels({notifyEmail: false}, "bans.don@gmail.com", "+12025530274");
  assert.equal(smsOnly.sms, true);
  assert.equal(smsOnly.email, false);

  const lockedOut = resolveSos2faChannels({notifyEmail: false, notifySms: false}, "bans.don@gmail.com", "+12025530274");
  assert.equal(lockedOut.sms, true);
  assert.equal(lockedOut.email, true);
});

test("SOS2FA delivery notes list email and/or SMS after Delivered / notes:", () => {
  const notes = formatDeliveryNotes({
    phone: "+12025530274",
    email: "bans.don@gmail.com",
    sms: true,
    mail: true
  });
  assert.equal(notes, "Delivered / notes: email B***@gmail.com / SMS ****3-0274");
});

test("SOS2FA delivery notes omit failed email and append email not sent", () => {
  const notes = formatDeliveryNotes({
    phone: "+12025530274",
    email: "bans.don@gmail.com",
    sms: true,
    mail: false,
    mailError: "sendgrid-error"
  });
  assert.equal(
    notes,
    "Delivered / notes: SMS ****3-0274 — email not sent (sendgrid-error)"
  );
});
