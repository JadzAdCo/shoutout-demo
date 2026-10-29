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

test("consentChecksComplete requires the single Terms acceptance", () => {
  assert.equal(core.consentChecksComplete({}), false);
  assert.equal(core.consentChecksComplete({terms: true}), true);
  const expanded = core.expandConsentChecks({terms: true, marketing: true});
  assert.equal(expanded.terms, true);
  assert.equal(expanded.refund, true);
  assert.equal(expanded.noShow, true);
  assert.equal(expanded.age21, true);
  assert.equal(expanded.minimumSpend, true);
  assert.equal(expanded.marketing, true);
});

test("beta catalog covers Decades, Lima Twist, Aurelia, and Shôko bookable sections", () => {
  assert.ok(catalog["decades-washington-dc"].sections.length >= 10);
  assert.ok(catalog["lima-twist-washington-dc"].sections.length >= 20);
  assert.ok(catalog["temp-democlub-1"].sections.length >= 20);
  assert.equal(catalog["temp-democlub-1"].planFile, "aurelia.json");
  assert.equal(core.BETA_VENUES.find(v => v.id === "temp-democlub-1")?.pending, false);
  assert.ok(catalog["shoko-barcelona-spain"].sections.length >= 50);
  assert.equal(catalog["shoko-barcelona-spain"].planFile, "shoko-barcelona.json");
  assert.equal(catalog["shoko-barcelona-spain"].currency, "EUR");
  assert.ok(catalog["shoko-barcelona-spain"].nightPricing["2026-12-31"]);
  assert.equal(core.BETA_VENUES.find(v => v.id === "shoko-barcelona-spain")?.pending, false);
});

test("Shôko NYE night pricing overrides regular demo amounts (EUR)", () => {
  const section = catalog["shoko-barcelona-spain"].sections.find(s => s.id === "shoko-sv1");
  assert.ok(section, "SUPER VIP 1 section");
  const override = core.nightPriceOverride(
    catalog["shoko-barcelona-spain"].nightPricing,
    "2026-12-31",
    section.id
  );
  assert.equal(override.listPriceEur, 20000);
  const nye = core.computePartyAmounts(section, 15, {nightOverride: override});
  assert.equal(nye.currency, "EUR");
  assert.equal(nye.minimumAmountCents, 2000000);
  assert.equal(nye.depositCents, 2000000);
  assert.equal(nye.chargedCents, 2000000);
  const regular = core.computePartyAmounts(section, 15);
  assert.notEqual(regular.minimumAmountCents, nye.minimumAmountCents);
});

test("mergeExtraBookableNights keeps NYE beyond rolling horizon", () => {
  const from = new Date(2026, 9, 28, 12, 0, 0); // Oct 28 2026
  const base = core.bookableNightsFromClub({}, {count: 14, horizonDays: 60, fromDate: from});
  const merged = core.mergeExtraBookableNights(base, ["2026-12-31"], from);
  assert.ok(merged.some(n => n.night === "2026-12-31"));
  assert.ok(merged.find(n => n.night === "2026-12-31").source === "event");
});

test("hold expiry is 30 minutes", () => {
  const now = 1_000_000;
  assert.equal(core.holdExpiresAtMs(now) - now, core.HOLD_MS);
  assert.equal(core.HOLD_MS, 30 * 60 * 1000);
});

test("bookableNightsFromClub respects hoursStructured open days", () => {
  const club = {
    hoursStructured: {
      sun: {closed: true, open: "", close: ""},
      mon: {closed: true, open: "", close: ""},
      tue: {closed: true, open: "", close: ""},
      wed: {closed: true, open: "", close: ""},
      thu: {closed: false, open: "22:00", close: "02:00"},
      fri: {closed: false, open: "22:00", close: "03:00"},
      sat: {closed: false, open: "22:00", close: "03:00"}
    }
  };
  // Anchor on a known Wednesday so Thu/Fri/Sat are next open nights.
  const from = new Date(2026, 9, 21, 12, 0, 0); // Wed Oct 21, 2026 local
  const nights = core.bookableNightsFromClub(club, {count: 3, horizonDays: 14, fromDate: from});
  assert.equal(nights.length, 3);
  assert.deepEqual(nights.map(n => n.night), ["2026-10-22", "2026-10-23", "2026-10-24"]);
  assert.equal(core.isNightBookable(club, "2026-10-21"), false);
  assert.equal(core.isNightBookable(club, "2026-10-22"), true);
});

test("bookableNightsFromClub falls back when no structured hours", () => {
  const nights = core.bookableNightsFromClub({}, {count: 5, horizonDays: 10});
  assert.equal(nights.length, 5);
  assert.ok(nights.every(n => /^\d{4}-\d{2}-\d{2}$/.test(n.night)));
});

test("paid-before-booked: deposit policy gates isReserved", () => {
  assert.equal(core.resolveDepositRequired({depositRequired: 1}, {depositCents: 0}), true);
  assert.equal(core.resolveDepositRequired({depositRequired: 0}, {depositCents: 5000}), false);
  assert.equal(core.resolveDepositRequired({}, {depositCents: 5000}), true);
  assert.equal(core.resolveDepositRequired({}, {depositCents: 0, chargedCents: 0}), false);
  assert.equal(core.canMarkTableBooked({depositRequired: true, paymentConfirmed: 0}), false);
  assert.equal(core.canMarkTableBooked({depositRequired: true, paymentConfirmed: 1}), true);
  assert.equal(core.canMarkTableBooked({depositRequired: false, paymentConfirmed: 0}), true);
});
