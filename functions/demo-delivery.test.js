"use strict";

const {describe, it} = require("node:test");
const assert = require("node:assert/strict");
const {redirectDemoEmail, DEMO_EMAIL_SINK} = require("./demo-delivery");

describe("demo email OTP sink", () => {
  it("redirects temp_*@floqr-demo.com OTP mail to bans.don sink", () => {
    const route = redirectDemoEmail("temp_waitress_1@floqr-demo.com", "Your FLOQR sign-in code");
    assert.equal(route.redirected, true);
    assert.equal(route.to, DEMO_EMAIL_SINK);
    assert.equal(route.intended, "temp_waitress_1@floqr-demo.com");
    assert.match(route.subject, /\[FLOQR demo → temp_waitress_1@floqr-demo.com\]/);
    assert.match(route.subject, /sign-in code/i);
  });

  it("leaves real addresses unchanged", () => {
    const route = redirectDemoEmail("bans.don@gmail.com", "Your FLOQR sign-in code");
    assert.equal(route.redirected, false);
    assert.equal(route.to, "bans.don@gmail.com");
    assert.equal(route.subject, "Your FLOQR sign-in code");
  });
});
