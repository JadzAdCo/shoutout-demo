"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("./vip-ledger-core.js");

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);
const DAY = L.DAY_MS;
const CLUB = "decades-dc";
const CLUB_BOOK = `club:${CLUB}`;
const MASTER = Object.freeze({ uid: "master-1", role: "masterAdmin", sos2faSessionHash: "abc123" });
const AP_CLERK = Object.freeze({ uid: "ap-1", role: "apClerk" });
const OWNER = Object.freeze({ uid: "owner-1", role: "clubOwner" });

function ledger() {
  let clock = T0;
  return L.createLedger({ now: () => (clock += 1000) });
}
function stripeBooking(led, id, extra) {
  return led.recordStripeBooking({ reservationId: id, clubId: CLUB, depositCents: 25000, entryFeeCents: 8000, feeBps: 1000, atMs: T0, ...extra });
}
function code(fn) {
  try { fn(); } catch (err) { return err.code; }
  return "NO_ERROR";
}
function assertBooksHealthy(led) {
  led.books().forEach(book => {
    assert.equal(led.trialBalance(book).balanced, true, `${book} trial balance`);
    assert.deepEqual(led.verify(book).ok, true, `${book} chain`);
    led.entries(book).forEach(e => {
      const d = e.lines.reduce((t, l) => t + l.debitCents, 0);
      const c = e.lines.reduce((t, l) => t + l.creditCents, 0);
      assert.equal(d, c, `${e.id} balances`);
      e.lines.forEach(l => assert.ok(Number.isSafeInteger(l.debitCents) && Number.isSafeInteger(l.creditCents)));
    });
  });
}
function approveAndPay(led, commissionIds, opts) {
  const o = opts || {};
  led.approvePromoterInvoice({ invoiceId: o.invoiceId || "INV-1", commissionIds, documentType: "selfBillingStatement",
    selfBillingAgreementId: "SBA-1", dueAtMs: T0 + 30 * DAY, actor: o.approver || MASTER, reason: "October commissions approved" });
  return led.recordCheckPayout({ payoutId: o.payoutId || "PO-1", invoiceId: o.invoiceId || "INV-1", checkNumber: o.checkNumber || "10234",
    bankName: "Chase Operating", checkDateMs: o.checkDateMs || T0 + DAY, amountCents: o.amountCents, payee: "Nyx Promotions LLC",
    memo: "VIP commissions Oct 2026", actor: o.clerk || AP_CLERK });
}

test("chart of accounts: both books carry the required accounts with correct normal sides", () => {
  ["1000", "1020", "1100", "1150", "2010", "2015", "2050", "2500", "4010", "4030", "5000", "5010", "5030"]
    .forEach(c => assert.ok(L.PLATFORM_CHART[c], `platform ${c}`));
  ["1000", "1010", "1020", "1030", "2000", "2010", "2020", "2050", "4000", "4100", "4900", "5000", "5030"]
    .forEach(c => assert.ok(L.CLUB_CHART[c], `club ${c}`));
  assert.equal(L.PLATFORM_CHART["1100"].normalSide, "debit");
  assert.equal(L.PLATFORM_CHART["2010"].normalSide, "credit");
  assert.equal(L.CLUB_CHART["2000"].type, "liability");
  assert.equal(L.CLUB_CHART["4900"].normalSide, "debit");
});

test("patron service fee grosses up so the booking survives the Stripe fee", () => {
  assert.equal(L.serviceFeeCents(33000), 1016);
  assert.equal(L.stripeFeeCents(34016), 1016);
  [100, 999, 5000, 33000, 250000, 1234567].forEach(b => {
    const s = L.serviceFeeCents(b);
    assert.ok(b + s - L.stripeFeeCents(b + s) >= b, `amount ${b}`);
    let smallest = 0;
    while (b + smallest - L.stripeFeeCents(b + smallest) < b) smallest += 1;
    assert.equal(s, smallest, `serviceFee is the smallest for ${b}`);
  });
});

test("path (a) Stripe booking: patron pays service fee, FLOQR fee retained, club book mirrors", () => {
  const led = ledger();
  const { reservation, entries } = stripeBooking(led, "R1");
  assert.equal(entries.length, 4);
  assert.equal(reservation.serviceFeeCents, 1016);
  assert.equal(reservation.patronTotalCents, 34016);
  assert.equal(reservation.stripeFeeCents, 1016);
  const p = led.balances("platform");
  assert.equal(p["1000"].balanceCents, 3300);
  assert.equal(p["2500"].balanceCents, 0);
  assert.equal(p["4010"].balanceCents, 3300);
  assert.equal(p["4030"].balanceCents, 1016);
  assert.equal(p["5000"].balanceCents, 1016);
  const c = led.balances(CLUB_BOOK);
  assert.equal(c["1000"].balanceCents, 29700);
  assert.equal(c["2000"].balanceCents, 25000);
  assert.equal(c["4000"].balanceCents, 8000);
  assert.equal(c["5000"].balanceCents, 3300);
  assertBooksHealthy(led);
});

test("Model A (feeBps 0) posts no FLOQR fee lines", () => {
  const led = ledger();
  stripeBooking(led, "R1", { feeBps: 0 });
  assert.equal(led.balances("platform")["4010"], undefined);
  assert.equal(led.balances(CLUB_BOOK)["5000"], undefined);
  assertBooksHealthy(led);
});

test("path (b) POS booking: FLOQR fee becomes a receivable from the club", () => {
  const led = ledger();
  led.recordPosBooking({ reservationId: "R2", clubId: CLUB, depositCents: 25000, entryFeeCents: 8000, feeBps: 1000, atMs: T0, paymentRef: "sq_123" });
  assert.equal(led.balance("platform", "1100", CLUB), 3300);
  assert.equal(led.balance("platform", "4010"), 3300);
  assert.equal(led.balance(CLUB_BOOK, "1010"), 33000);
  assert.equal(led.balance(CLUB_BOOK, "2020"), 3300);
  assert.equal(led.balance("platform", "4030"), 0, "no service fee off-platform");
  assertBooksHealthy(led);
});

test("path (c) pay at venue: cash clearing; comps are rejected (record as uncollected)", () => {
  const led = ledger();
  led.recordVenuePayment({ reservationId: "R3", clubId: CLUB, depositCents: 10000, entryFeeCents: 0, feeBps: 1000, method: "cash", atMs: T0 });
  assert.equal(led.balance(CLUB_BOOK, "1020"), 10000);
  assert.equal(led.balance("platform", "1100", CLUB), 1000);
  assert.equal(code(() => led.recordVenuePayment({ reservationId: "R4", clubId: CLUB, depositCents: 100, method: "comp" })), "INVALID_METHOD");
  assertBooksHealthy(led);
});

test("full refund on path (a) reverses FLOQR fee, service fee and promoter commission; Stripe fee recharged to club", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "club", percentOfDepositBps: 1000 });
  const { reservation } = led.refundFull({ reservationId: "R1", reason: "Club cancelled the night", atMs: T0 + DAY });
  assert.equal(reservation.status, "refunded");
  assert.equal(led.balance("platform", "4010"), 0);
  assert.equal(led.balance("platform", "4030"), 0);
  assert.equal(led.balance("platform", "5000"), 0);
  assert.equal(led.balance("platform", "1150", CLUB), 1016);
  assert.equal(led.balance("platform", "1000"), -1016);
  assert.equal(led.balance(CLUB_BOOK, "2000"), 0);
  assert.equal(led.balance(CLUB_BOOK, "1000"), 0);
  assert.equal(led.balance(CLUB_BOOK, "5000"), 0);
  assert.equal(led.balance(CLUB_BOOK, "2015", "nyx"), 0);
  assert.equal(led.balance(CLUB_BOOK, "5030", "nyx"), 0);
  assert.equal(led.balance(CLUB_BOOK, "2020"), 1016);
  assert.equal(led.commission("R1:club:nyx").status, "reversed");
  assertBooksHealthy(led);
});

test("full refund on path (b) credits the FLOQR fee receivable", () => {
  const led = ledger();
  led.recordPosBooking({ reservationId: "R2", clubId: CLUB, depositCents: 25000, entryFeeCents: 8000, feeBps: 1000, atMs: T0 });
  led.refundFull({ reservationId: "R2", reason: "Venue policy requires refund" });
  assert.equal(led.balance("platform", "1100", CLUB), 0);
  assert.equal(led.balance("platform", "4010"), 0);
  assert.equal(led.balance(CLUB_BOOK, "1010"), 0);
  assert.equal(led.balance(CLUB_BOOK, "2020"), 0);
  assert.equal(led.balance(CLUB_BOOK, "4900"), 8000);
  assertBooksHealthy(led);
});

test("partial refunds are forbidden on every path", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.recordPosBooking({ reservationId: "R2", clubId: CLUB, depositCents: 5000, atMs: T0 });
  assert.equal(code(() => led.refundFull({ reservationId: "R1", amountCents: 25000, reason: "Partial please" })), "PARTIAL_REFUND_FORBIDDEN");
  assert.equal(code(() => led.refundFull({ reservationId: "R2", amountCents: 1, reason: "Partial please" })), "PARTIAL_REFUND_FORBIDDEN");
  const ok = led.refundFull({ reservationId: "R1", amountCents: led.reservation("R1").patronTotalCents, reason: "Exact full amount" });
  assert.equal(ok.reservation.status, "refunded");
  assert.equal(code(() => led.refundFull({ reservationId: "R2", reason: "short" })), "REASON_REQUIRED");
});

test("refund is idempotent; refund of an uncollected reservation throws", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.refundFull({ reservationId: "R1", reason: "Club cancelled the night" });
  const count = led.entries("platform").length;
  const again = led.refundFull({ reservationId: "R1", reason: "Club cancelled the night" });
  assert.equal(again.entries.length, 0);
  assert.equal(led.entries("platform").length, count);
  led.recordUncollected({ reservationId: "R9", clubId: CLUB, path: "venue", reason: "Patron never paid" });
  assert.equal(code(() => led.refundFull({ reservationId: "R9", reason: "Should not refund" })), "NOTHING_COLLECTED");
});

test("no-show, no-refund policy: deposit forfeited, commissions and fees calculated normally", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  const ns = led.recordNoShow({ reservationId: "R1", policy: "noRefund" });
  assert.equal(ns.reservation.status, "forfeited");
  assert.equal(led.balance(CLUB_BOOK, "4100"), 25000);
  assert.equal(led.balance(CLUB_BOOK, "2000"), 0);
  assert.equal(led.balance("platform", "4010"), 3300);
  assert.equal(led.balance("platform", "4030"), 1016);
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "club", percentOfDepositBps: 1000 });
  assert.equal(led.balance(CLUB_BOOK, "2015", "nyx"), 2500);
  assert.equal(code(() => led.refundFull({ reservationId: "R1", reason: "Changed policy later" })), "ALREADY_FORFEITED");
  assertBooksHealthy(led);
});

test("no-show, full-refund policy: same as a full refund", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  const ns = led.recordNoShow({ reservationId: "R1", policy: "fullRefund", reason: "Club policy: no-shows refunded" });
  assert.equal(ns.reservation.status, "refunded");
  assert.equal(ns.reservation.refundReason, "Club policy: no-shows refunded");
  assert.equal(led.balance("platform", "4010"), 0);
  assert.equal(code(() => led.recordNoShow({ reservationId: "R1", policy: "half" })), "INVALID_POLICY");
  assertBooksHealthy(led);
});

test("uncollected payment: no entries, no FLOQR fee, no commission", () => {
  const led = ledger();
  const res = led.recordUncollected({ reservationId: "R5", clubId: CLUB, path: "stripe", reason: "Card declined" });
  assert.equal(res.entries.length, 0);
  assert.deepEqual(led.books(), []);
  assert.equal(code(() => led.accrueCommission({ reservationId: "R5", promoterUid: "nyx", payer: "club", amountCents: 500 })), "NOT_COLLECTED");
  assert.equal(code(() => led.recordStripeBooking({ reservationId: "R5", clubId: CLUB, depositCents: 100 })), "RESERVATION_UNCOLLECTED");
});

test("commission accrual lands in the payer's book (club vs FloqMedia) and refunded bookings earn none", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "club", amountCents: 2500 });
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "floqmedia", amountCents: 500 });
  assert.equal(led.balance(CLUB_BOOK, "2015", "nyx"), 2500);
  assert.equal(led.balance("platform", "2015", "nyx"), 500);
  assert.equal(led.balance("platform", "5030", "nyx"), 500);
  stripeBooking(led, "R6");
  led.refundFull({ reservationId: "R6", reason: "Club cancelled the night" });
  assert.equal(code(() => led.accrueCommission({ reservationId: "R6", promoterUid: "nyx", payer: "club", amountCents: 1 })), "REFUNDED");
  assertBooksHealthy(led);
});

test("promoter invoice approval: RBAC, SOS2FA, reason and document checks", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "floqmedia", amountCents: 500 });
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "club", amountCents: 2500 });
  const base = { invoiceId: "INV-9", commissionIds: ["R1:floqmedia:nyx"], documentType: "promoterInvoice", promoterInvoiceNumber: "NYX-0042", reason: "October commissions approved" };
  assert.equal(code(() => led.approvePromoterInvoice({ ...base, actor: { uid: "vm", role: "vipManager" } })), "FORBIDDEN");
  assert.equal(code(() => led.approvePromoterInvoice({ ...base, actor: { uid: "m", role: "masterAdmin" } })), "SOS2FA_REQUIRED");
  assert.equal(code(() => led.approvePromoterInvoice({ ...base, actor: MASTER, reason: "ok" })), "REASON_REQUIRED");
  assert.equal(code(() => led.approvePromoterInvoice({ ...base, actor: MASTER, promoterInvoiceNumber: "" })), "MISSING_FIELD");
  assert.equal(code(() => led.approvePromoterInvoice({ ...base, actor: MASTER, commissionIds: ["R1:floqmedia:nyx", "R1:club:nyx"] })), "MIXED_INVOICE");
  assert.equal(code(() => led.approvePromoterInvoice({ ...base, invoiceId: "C-1", commissionIds: ["R1:club:nyx"], actor: MASTER })), "FORBIDDEN");
  const { invoice } = led.approvePromoterInvoice({ ...base, actor: MASTER });
  assert.equal(invoice.amountCents, 500);
  assert.equal(led.balance("platform", "2015", "nyx"), 0);
  assert.equal(led.balance("platform", "2010", "nyx"), 500);
  led.approvePromoterInvoice({ ...base, invoiceId: "C-2", commissionIds: ["R1:club:nyx"], actor: OWNER });
  assert.equal(led.balance(CLUB_BOOK, "2010", "nyx"), 2500);
  assertBooksHealthy(led);
});

test("corporate check payout records the reference and clears the payable; SoD, amount and duplicate guards", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  stripeBooking(led, "R7");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "floqmedia", amountCents: 500 });
  led.accrueCommission({ reservationId: "R7", promoterUid: "nyx", payer: "floqmedia", amountCents: 700 });
  led.approvePromoterInvoice({ invoiceId: "INV-1", commissionIds: ["R1:floqmedia:nyx", "R7:floqmedia:nyx"], documentType: "selfBillingStatement",
    selfBillingAgreementId: "SBA-1", actor: MASTER, reason: "October commissions approved" });
  const check = { payoutId: "PO-1", invoiceId: "INV-1", checkNumber: "10234", bankName: "Chase Operating", checkDateMs: T0 + DAY,
    amountCents: 1200, payee: "Nyx Promotions LLC", memo: "VIP commissions Oct 2026", stubSha256: "a".repeat(64), actor: AP_CLERK };
  assert.equal(code(() => led.recordCheckPayout({ ...check, actor: MASTER })), "SEGREGATION_OF_DUTIES");
  assert.equal(code(() => led.recordCheckPayout({ ...check, amountCents: 1000 })), "AMOUNT_MISMATCH");
  assert.equal(code(() => led.recordCheckPayout({ ...check, actor: { uid: "vm", role: "vipManager" } })), "FORBIDDEN");
  assert.equal(code(() => led.recordCheckPayout({ ...check, checkNumber: "12a" })), "INVALID_CHECK");
  const { payout } = led.recordCheckPayout(check);
  assert.equal(payout.method, "check");
  assert.equal(payout.checkNumber, "10234");
  assert.equal(payout.stubSha256, "a".repeat(64));
  assert.equal(led.invoice("INV-1").status, "paid");
  assert.equal(led.balance("platform", "2010", "nyx"), 0);
  assert.equal(led.balance("platform", "2050", "nyx"), 1200);
  assert.equal(led.recordCheckPayout(check).entries.length, 0, "repost is a no-op");
  assert.equal(code(() => led.recordCheckPayout({ ...check, payoutId: "PO-2" })), "INVOICE_NOT_OPEN");
  assertBooksHealthy(led);
});

test("check cleared moves outstanding checks to the bank", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "club", amountCents: 2500 });
  approveAndPay(led, ["R1:club:nyx"], { approver: OWNER, clerk: OWNER, amountCents: 2500 });
  const { payout } = led.recordCheckCleared({ payoutId: "PO-1", clearedAtMs: T0 + 5 * DAY, bankReference: "STMT-2026-10" });
  assert.equal(payout.status, "cleared");
  assert.equal(led.balance(CLUB_BOOK, "2050", "nyx"), 0);
  assert.equal(led.balance(CLUB_BOOK, "1030"), -2500);
  assert.equal(code(() => led.voidCheck({ payoutId: "PO-1", actor: OWNER, reason: "Too late to void" })), "CHECK_NOT_OUTSTANDING");
  assertBooksHealthy(led);
});

test("check voided reopens the payable; reissue needs a new number and clears it again", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "floqmedia", amountCents: 500 });
  approveAndPay(led, ["R1:floqmedia:nyx"], { amountCents: 500 });
  assert.equal(code(() => led.reissueCheck({ originalPayoutId: "PO-1", payoutId: "PO-2" })), "NOT_VOIDED");
  assert.equal(code(() => led.voidCheck({ payoutId: "PO-1", actor: AP_CLERK, reason: "Lost in the mail" })), "FORBIDDEN");
  led.voidCheck({ payoutId: "PO-1", actor: MASTER, reason: "Lost in the mail" });
  assert.equal(led.balance("platform", "2010", "nyx"), 500);
  assert.equal(led.balance("platform", "2050", "nyx"), 0);
  assert.equal(led.invoice("INV-1").status, "approved");
  const reissue = { originalPayoutId: "PO-1", payoutId: "PO-2", checkNumber: "10234", bankName: "Chase Operating",
    checkDateMs: T0 + 10 * DAY, amountCents: 500, payee: "Nyx Promotions LLC", actor: AP_CLERK };
  assert.equal(code(() => led.reissueCheck(reissue)), "DUPLICATE_CHECK");
  const { payout } = led.reissueCheck({ ...reissue, checkNumber: "10301" });
  assert.equal(payout.reissueOf, "PO-1");
  assert.equal(led.balance("platform", "2010", "nyx"), 0);
  assert.equal(led.balance("platform", "2050", "nyx"), 500);
  assertBooksHealthy(led);
});

test("stale-dated checks (180 days) are found and voided", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "floqmedia", amountCents: 500 });
  approveAndPay(led, ["R1:floqmedia:nyx"], { amountCents: 500, checkDateMs: T0 });
  assert.equal(led.staleChecks(T0 + 179 * DAY).length, 0);
  const stale = led.staleChecks(T0 + 180 * DAY);
  assert.deepEqual(stale.map(p => p.payoutId), ["PO-1"]);
  const { payout } = led.voidCheck({ payoutId: "PO-1", actor: MASTER, reason: "Stale-dated after 180 days", staleDated: true });
  assert.equal(payout.staleDated, true);
  assert.equal(led.staleChecks(T0 + 400 * DAY).length, 0);
  assertBooksHealthy(led);
});

test("AR aging buckets club fee receivables by days past due", () => {
  const led = ledger();
  [["A", 0], ["B", 45], ["C", 75], ["D", 120]].forEach(([id, ageDays]) => led.recordPosBooking({
    reservationId: id, clubId: CLUB, depositCents: 10000, feeBps: 1000, atMs: T0, feeDueAtMs: T0 - ageDays * DAY
  }));
  led.recordPosBooking({ reservationId: "E", clubId: CLUB, depositCents: 10000, feeBps: 1000, atMs: T0, feeDueAtMs: T0 + 10 * DAY });
  const row = led.aging("platform", "AR", T0).rows.find(r => r.account === "1100");
  assert.deepEqual([row.current, row.d0_30, row.d31_60, row.d61_90, row.d90p, row.totalCents], [1000, 1000, 1000, 1000, 1000, 5000]);
  led.refundFull({ reservationId: "D", reason: "Venue policy requires refund" });
  const after = led.aging("platform", "AR", T0).rows.find(r => r.account === "1100");
  assert.equal(after.d0_30, 0, "credit settles the oldest open item first (A)");
  assert.equal(after.d90p, 1000, "D remains open; the credit did not target it");
  assert.equal(after.totalCents, 4000);
  assert.equal(L.agingBucket(T0 - 30 * DAY, T0), "d0_30");
  assert.equal(L.agingBucket(T0 - 31 * DAY, T0), "d31_60");
  assert.equal(L.agingBucket(T0 - 91 * DAY, T0), "d90p");
});

test("AP aging shows approved promoter payables and drops them once paid", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "floqmedia", amountCents: 500 });
  led.approvePromoterInvoice({ invoiceId: "INV-1", commissionIds: ["R1:floqmedia:nyx"], documentType: "selfBillingStatement",
    selfBillingAgreementId: "SBA-1", dueAtMs: T0, actor: MASTER, reason: "October commissions approved" });
  const row = led.aging("platform", "AP", T0 + 40 * DAY).rows[0];
  assert.equal(row.partyId, "nyx");
  assert.equal(row.d31_60, 500);
  led.recordCheckPayout({ payoutId: "PO-1", invoiceId: "INV-1", checkNumber: "1", bankName: "Chase", checkDateMs: T0,
    amountCents: 500, payee: "Nyx Promotions LLC", actor: AP_CLERK });
  assert.equal(led.aging("platform", "AP", T0 + 40 * DAY).rows.length, 0);
  assert.equal(code(() => led.aging("platform", "XX", T0)), "INVALID_KIND");
});

test("party statement: opening, activity, running and closing balance", () => {
  const led = ledger();
  led.recordPosBooking({ reservationId: "S1", clubId: CLUB, depositCents: 10000, feeBps: 1000, atMs: T0 - 40 * DAY });
  led.recordPosBooking({ reservationId: "S2", clubId: CLUB, depositCents: 20000, feeBps: 1000, atMs: T0 - 5 * DAY });
  led.refundFull({ reservationId: "S2", reason: "Venue policy requires refund", atMs: T0 - 2 * DAY });
  const st = led.statement("platform", "club", CLUB, { fromMs: T0 - 30 * DAY, toMs: T0 });
  assert.equal(st.openingCents, 0, "fee revenue credit and AR debit net to zero per club party");
  const ar = st.lines.filter(l => l.account === "1100");
  assert.deepEqual(ar.map(l => l.debitCents - l.creditCents), [2000, -2000]);
  assert.equal(st.closingCents, st.lines.length ? st.lines[st.lines.length - 1].runningCents : st.openingCents);
  assert.equal(led.balance("platform", "1100", CLUB), 1000);
});

test("invariants across a full month: every journal balances, trial balance zero, chains verify", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  stripeBooking(led, "R2", { feeBps: 0 });
  led.recordPosBooking({ reservationId: "R3", clubId: CLUB, depositCents: 40000, entryFeeCents: 6000, feeBps: 800, atMs: T0 });
  led.recordVenuePayment({ reservationId: "R4", clubId: "lima-twist", depositCents: 15000, feeBps: 1000, method: "card-terminal", atMs: T0 });
  led.recordUncollected({ reservationId: "R5", clubId: CLUB, path: "venue" });
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "club", percentOfDepositBps: 1000 });
  led.accrueCommission({ reservationId: "R3", promoterUid: "nyx", payer: "floqmedia", amountCents: 900 });
  led.recordNoShow({ reservationId: "R2", policy: "noRefund" });
  led.refundFull({ reservationId: "R4", reason: "Venue policy requires refund" });
  approveAndPay(led, ["R3:floqmedia:nyx"], { amountCents: 900 });
  led.recordCheckCleared({ payoutId: "PO-1", clearedAtMs: T0 + 7 * DAY });
  led.recordChargeback({ reservationId: "R1", disputeId: "dp_1", amountCents: 34020, disputeFeeCents: 1500 });
  led.recordChargebackRecovered({ reservationId: "R1", disputeId: "dp_1", amountCents: 34020 });
  assert.deepEqual(led.books().sort(), ["club:decades-dc", "club:lima-twist", "platform"]);
  assertBooksHealthy(led);
  assert.equal(led.balance("platform", "1150", CLUB), 0);
  assert.equal(led.balance("platform", "5010", CLUB), 1500);
});

test("tampering is detected by the hash chain", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.recordPosBooking({ reservationId: "R2", clubId: CLUB, depositCents: 5000, feeBps: 1000, atMs: T0 });
  const exported = led.exportBook("platform");
  assert.equal(L.verifyChain(exported).ok, true);
  const amount = JSON.parse(JSON.stringify(exported));
  amount[1].lines[1].creditCents += 1;
  amount[1].lines[0].debitCents += 1;
  assert.deepEqual(L.verifyChain(amount), { ok: false, brokenAtSeq: 2, reason: "hash-mismatch" });
  const reordered = JSON.parse(JSON.stringify(exported));
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.equal(L.verifyChain(reordered).ok, false);
  const dropped = JSON.parse(JSON.stringify(exported)).slice(1);
  assert.equal(L.verifyChain(dropped).reason, "seq-gap");
  const relinked = JSON.parse(JSON.stringify(exported));
  relinked[2].prevHash = "f".repeat(64);
  assert.equal(L.verifyChain(relinked).reason, "prev-hash-mismatch");
});

test("entries and records are immutable", () => {
  const led = ledger();
  const { entries, reservation } = stripeBooking(led, "R1");
  assert.ok(Object.isFrozen(entries[0]) && Object.isFrozen(entries[0].lines[0]));
  assert.throws(() => { entries[0].lines[0].debitCents = 1; }, TypeError);
  assert.throws(() => { reservation.status = "refunded"; }, TypeError);
  assert.throws(() => { led.entries("platform").push({}); }, TypeError);
});

test("idempotent repost is a no-op; a reused key with different lines conflicts", () => {
  const led = ledger();
  const first = stripeBooking(led, "R1");
  const before = led.entries("platform").length;
  const again = stripeBooking(led, "R1");
  assert.equal(again.entries.length, 0);
  assert.equal(led.entries("platform").length, before);
  assert.equal(again.reservation, first.reservation);
  const journal = { book: "platform", idempotencyKey: "manual-1", memo: "adj", lines: [{ account: "5000", debit: 10 }, { account: "1000", credit: 10 }] };
  const e1 = led.post(journal);
  assert.equal(led.post(journal), e1);
  assert.equal(code(() => led.post({ ...journal, lines: [{ account: "5000", debit: 11 }, { account: "1000", credit: 11 }] })), "IDEMPOTENCY_CONFLICT");
});

test("malformed journals are rejected", () => {
  const led = ledger();
  const base = { book: "platform", memo: "x" };
  const cases = [
    [{ idempotencyKey: "a", lines: [{ account: "5000", debit: 10 }, { account: "1000", credit: 9 }] }, "UNBALANCED"],
    [{ idempotencyKey: "b", lines: [{ account: "5000", debit: 10.5 }, { account: "1000", credit: 10.5 }] }, "INVALID_LINE"],
    [{ idempotencyKey: "c", lines: [{ account: "5000", debit: -10 }, { account: "1000", credit: -10 }] }, "INVALID_LINE"],
    [{ idempotencyKey: "d", lines: [{ account: "5000", debit: 10, credit: 10 }, { account: "1000", credit: 10 }] }, "INVALID_LINE"],
    [{ idempotencyKey: "e", lines: [{ account: "9999", debit: 10 }, { account: "1000", credit: 10 }] }, "UNKNOWN_ACCOUNT"],
    [{ idempotencyKey: "f", lines: [{ account: "1100", debit: 10 }, { account: "1000", credit: 10 }] }, "PARTY_REQUIRED"],
    [{ idempotencyKey: "g", lines: [{ account: "1000", debit: 10 }] }, "UNBALANCED"],
    [{ idempotencyKey: "", lines: [] }, "MISSING_FIELD"]
  ];
  cases.forEach(([input, expected]) => assert.equal(code(() => led.post({ ...base, ...input })), expected, input.idempotencyKey));
  assert.equal(code(() => led.post({ ...base, book: "other", idempotencyKey: "h", lines: [] })), "INVALID_BOOK");
  assert.equal(code(() => led.recordStripeBooking({ reservationId: "R1", clubId: CLUB, depositCents: 0, entryFeeCents: 0 })), "INVALID_AMOUNT");
  assert.equal(code(() => led.recordStripeBooking({ reservationId: "R1", clubId: CLUB, depositCents: 100, feeBps: 9000 })), "INVALID_FEE");
  assert.deepEqual(led.books(), []);
});

test("refund after a commission was invoiced claws it back from the promoter payable", () => {
  const led = ledger();
  stripeBooking(led, "R1");
  led.accrueCommission({ reservationId: "R1", promoterUid: "nyx", payer: "club", amountCents: 2500 });
  approveAndPay(led, ["R1:club:nyx"], { approver: OWNER, clerk: OWNER, amountCents: 2500 });
  led.refundFull({ reservationId: "R1", reason: "Event cancelled by venue" });
  assert.equal(led.balance(CLUB_BOOK, "2010", "nyx"), -2500, "promoter owes the club; netted on the next payout");
  assert.equal(led.balance(CLUB_BOOK, "5030", "nyx"), 0);
  assertBooksHealthy(led);
});
