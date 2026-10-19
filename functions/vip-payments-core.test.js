"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./vip-payments-core");
const fs = require("node:fs");
const path = require("node:path");

test("Club POS is the preferred collector and Toast/SpotOn open tabs", () => {
  assert.equal(core.PAYMENT_COLLECTORS.clubPos.preferred, true);
  assert.equal(core.POS_PROVIDERS.toast.openTabOnTable, true);
  assert.equal(core.POS_PROVIDERS.spoton.openTabOnTable, true);
  assert.equal(core.POS_PROVIDERS.spoton.reservationApi, true);
  assert.equal(core.POS_PROVIDERS.square.openTabOnTable, false);
  assert.equal(core.POS_PROVIDERS.toast.sandbox, true);
  assert.equal(core.POS_PROVIDERS.square.sandbox, true);
  assert.equal(core.POS_PROVIDERS.clover.sandbox, true);
  assert.equal(core.POS_PROVIDERS.spoton.sandbox, true);
});

test("normalizePaymentSettings defaults and Club POS provider", () => {
  const a = core.normalizePaymentSettings({});
  assert.equal(a.paymentCollector, "floqrStripe");
  const b = core.normalizePaymentSettings({paymentCollector: "clubPos", posProvider: "toast", posMode: "sandbox"});
  assert.equal(b.paymentCollector, "clubPos");
  assert.equal(b.posProvider, "toast");
  assert.equal(b.posMode, "sandbox");
});

test("CSV export includes reservation columns", () => {
  const csv = core.buildVipReservationsCsv([{
    reservationId: "r1", night: "2026-10-20", sectionId: "t1", sectionLabel: "T1",
    venueName: "Demo", partySize: 4, status: "confirmed", paymentConfirmed: 0,
    amounts: {chargedCents: 5000, currency: "USD"}
  }]);
  assert.match(csv, /reservationId,night/);
  assert.match(csv, /r1,2026-10-20/);
});

test("VIP POS functions and Club Admin surfaces exist", () => {
  const read = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
  const fn = read("functions/vip-pos-functions.js");
  assert.match(fn, /exports\.beginVipPosConnect/);
  assert.match(fn, /exports\.confirmVipReservationForClubPos/);
  assert.match(fn, /exports\.exportVipReservationsCsv/);
  assert.match(fn, /exports\.listVipBillingStatements/);
  assert.match(fn, /FLOQR books, holds, and maps/);
  const admin = read("admin.html");
  assert.match(admin, /vipAdminCollector/);
  assert.match(admin, /vipAdminPosConnect/);
  assert.match(admin, /vipAdminBillingList/);
  const master = read("master-admin.html");
  assert.match(master, /featuresVipPayments/);
  assert.match(master, /vipMasterSeedProviders/);
});
