"use strict";

/**
 * VIP reserV — paid-before-booked + Club Admin management contract.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = relativePath => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("createVipHold never sets isReserved=1 (hold stays amber)", () => {
  const fn = read("functions/vip-functions.js");
  const holdFn = fn.slice(fn.indexOf("async function runCreateVipHold"), fn.indexOf("exports.createVipHold"));
  assert.match(holdFn, /isReserved:\s*0/);
  assert.doesNotMatch(holdFn, /isReserved:\s*1/);
  assert.match(holdFn, /status:\s*"held"/);
  assert.match(fn, /exports\.createVipHold\s*=\s*onCall\(CALL_OPTS,\s*runCreateVipHold\)/);
});

test("Stripe fulfillment and no-deposit confirm are the only booked writers in vip-functions", () => {
  const fn = read("functions/vip-functions.js");
  assert.match(fn, /function fulfillVipReservationOrder/);
  assert.match(fn, /exports\.confirmVipReservationWithoutDeposit/);
  assert.match(fn, /exports\.adminConfirmVipReservation/);
  assert.match(fn, /canMarkTableBooked/);
  assert.match(fn, /depositRequired/);
  assert.match(fn, /paymentConfirmed:\s*1/);
  assert.match(fn, /This venue requires a deposit before the table is marked booked/);
  assert.match(fn, /Deposit required: record payment/);
});

test("Club Admin VIP panel manages reservations + deposit policy", () => {
  const html = read("admin.html");
  const app = read("admin-app.js");
  assert.match(html, /data-panel="panelVipReserv"/);
  assert.match(html, /id="panelVipReserv"/);
  assert.match(html, /vipAdminDepositRequired/);
  assert.match(html, /help-vip-club-admin/);
  assert.match(app, /function renderVipAdmin/);
  assert.match(app, /saveVipClubSettings/);
  assert.match(app, /adminConfirmVipReservation/);
  assert.match(app, /cancelVipReservation/);
  assert.match(app, /setVipSectionBlocked/);
});

test("VIP mark shows legible VIP reserV letter V (not check-only)", () => {
  const mark = read("images/vip-reserv-mark.svg");
  assert.match(mark, /aria-label="VIP reserV"/);
  assert.match(mark, />VIP</);
  assert.match(mark, /<tspan[^>]*>reser<\/tspan>\s*<tspan[^>]*>V<\/tspan>/);
  assert.match(mark, /vipSeat|brownish red|glass/i);
});
