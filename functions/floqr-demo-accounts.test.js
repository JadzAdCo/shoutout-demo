"use strict";

const {describe, it} = require("node:test");
const assert = require("node:assert/strict");
const {
  isFloqrDemoEmail,
  looksLikeBrokenDemoEmail,
  brokenDemoEmailMessage,
  demoEmailOtpDelivery,
  DEMO_OTP_REDIRECT_EMAIL
} = require("./floqr-demo-accounts");

describe("floqr-demo-accounts", () => {
  it("accepts seeded temp QA emails", () => {
    assert.equal(isFloqrDemoEmail("temp_waitress_1@floqr-demo.com"), true);
    assert.equal(isFloqrDemoEmail("temp_bottle_10@floqr-demo.com"), true);
    assert.equal(isFloqrDemoEmail("temp_clubadmin_3@floqr-demo.com"), true);
  });

  it("rejects literal N and other broken demo shapes", () => {
    assert.equal(isFloqrDemoEmail("temp_waitress_N@floqr-demo.com"), false);
    assert.equal(looksLikeBrokenDemoEmail("temp_waitress_N@floqr-demo.com"), true);
    assert.match(
      brokenDemoEmailMessage("temp_waitress_N@floqr-demo.com"),
      /number 1–10, not the letter N/i
    );
  });

  it("redirects demo OTP delivery to the operator inbox", () => {
    const delivery = demoEmailOtpDelivery("temp_waitress_1@floqr-demo.com");
    assert.equal(delivery.redirected, true);
    assert.equal(delivery.deliveredTo, DEMO_OTP_REDIRECT_EMAIL);
    assert.match(delivery.subject, /temp_waitress_1@floqr-demo\.com/);
    assert.match(delivery.bodyPrefix, /temp_waitress_1@floqr-demo\.com/);
  });

  it("does not redirect normal patron emails", () => {
    const delivery = demoEmailOtpDelivery("patron@example.com");
    assert.equal(delivery.redirected, false);
    assert.equal(delivery.deliveredTo, "patron@example.com");
  });
});
