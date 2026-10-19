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

test("refund policy: club cancel full by default; hours windows for policy mode", () => {
  assert.equal(core.collectorSupportsStripeRefund("floqrStripe"), true);
  assert.equal(core.collectorSupportsStripeRefund("clubStripe"), true);
  assert.equal(core.collectorSupportsStripeRefund("clubPos"), false);
  const full = core.computeVipRefundCents({
    chargedCents: 10000,
    night: "2099-01-01",
    actor: "club",
    policy: {clubCancelRefundMode: "full"}
  });
  assert.equal(full.refundCents, 10000);
  assert.equal(full.reason, "full_refund");
  const none = core.computeVipRefundCents({
    chargedCents: 10000,
    night: "2099-01-01",
    actor: "club",
    forceMode: "none"
  });
  assert.equal(none.refundCents, 0);
  const far = core.computeVipRefundCents({
    chargedCents: 10000,
    night: "2099-06-01",
    actor: "patron",
    policy: {
      clubCancelRefundMode: "policy",
      fullRefundHoursBeforeNight: 24,
      partialRefundHoursBeforeNight: 4,
      partialRefundPercent: 50
    },
    nowMs: Date.parse("2099-05-01T00:00:00.000Z")
  });
  assert.equal(far.refundCents, 10000);
  assert.equal(far.reason, "full_window");
  // 20h before night: below full (48h) but above partial (12h) → 40%
  const partial = core.computeVipRefundCents({
    chargedCents: 10000,
    night: "2099-06-01",
    actor: "patron",
    forceMode: "policy",
    policy: {
      fullRefundHoursBeforeNight: 48,
      partialRefundHoursBeforeNight: 12,
      partialRefundPercent: 40
    },
    nowMs: Date.parse("2099-05-31T04:00:00.000Z")
  });
  assert.equal(partial.refundCents, 4000);
  assert.equal(partial.reason, "partial_window");
});

test("cancelVipReservation clears isBooked and can Stripe-refund FloqMedia deposits", () => {
  const read = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
  const fn = read("functions/vip-functions.js");
  assert.match(fn, /exports\.cancelVipReservation/);
  assert.match(fn, /applyTableAvailable/);
  assert.match(fn, /computeVipRefundCents/);
  assert.match(fn, /stripe\.refunds\.create/);
  assert.match(fn, /IsRefunded/);
  assert.match(fn, /CALL_OPTS_STRIPE/);
  const admin = read("admin.html");
  assert.match(admin, /vipAdminRefundOnCancel/);
  assert.match(admin, /vipAdminCancelRefundMode/);
  const app = read("admin-app.js");
  assert.match(app, /processRefund/);
  assert.match(app, /refundPolicy/);
});
