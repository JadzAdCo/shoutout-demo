"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./vip-core");
const catalog = require("./vip-beta-catalog");

test("inventoryKey and night validation", () => {
  assert.equal(core.inventoryKey("decades-washington-dc", "2026-10-17", "decades-c1"), "decades-washington-dc_2026-10-17_decades-c1");
  assert.equal(core.validateNight("2026-10-17"), "2026-10-17");
  assert.equal(core.validateNight("bad"), "");
});

test("computePartyAmounts uses beta demo pricing and never trusts client fees", () => {
  const section = catalog["decades-washington-dc"].sections[0];
  const amounts = core.computePartyAmounts(section, 8);
  assert.equal(amounts.partySize, 8);
  assert.ok(amounts.extraGuests >= 0);
  assert.ok(amounts.chargedCents >= amounts.depositCents);
  assert.equal(amounts.currency, "USD");
});

test("consentChecksComplete requires all mandatory boxes", () => {
  assert.equal(core.consentChecksComplete({}), false);
  assert.equal(core.consentChecksComplete({
    terms: true, refund: true, noShow: true, age21: true, minimumSpend: true
  }), true);
});

test("beta catalog covers Decades, Lima Twist, and Aurelia bookable sections", () => {
  assert.ok(catalog["decades-washington-dc"].sections.length >= 10);
  assert.ok(catalog["lima-twist-washington-dc"].sections.length >= 20);
  assert.ok(catalog["temp-democlub-1"].sections.length >= 20);
  assert.equal(catalog["temp-democlub-1"].planFile, "aurelia.json");
  assert.equal(core.BETA_VENUES.find(v => v.id === "temp-democlub-1")?.pending, false);
});

test("hold expiry is 30 minutes", () => {
  const now = 1_000_000;
  assert.equal(core.holdExpiresAtMs(now) - now, core.HOLD_MS);
  assert.equal(core.HOLD_MS, 30 * 60 * 1000);
});
