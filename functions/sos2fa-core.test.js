"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  maskPhoneLast5,
  maskEmail,
  resolveSos2faChannels,
  formatDeliveryNotes
} = require("./sos2fa-core");

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
