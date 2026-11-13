"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const commerce = read("functions/commerce-functions.js");
const vipPos = read("functions/vip-pos-functions.js");
const paymentService = read("payment-service.js");
const rules = read("firestore.rules");
const adminHtml = read("admin.html");
const logging = read("master-logging-extension.js");

test("VIP Club Stripe reads stripeConnectAccounts, not a typed clubLocations acct id first", () => {
  assert.match(vipPos, /connectBindingId\("club", clubId\)/);
  assert.match(vipPos, /collection\("stripeConnectAccounts"\)/);
  assert.match(vipPos, /binding\.accountId/);
});

test("Checkout destination-charges when Connect is ready and still allows ShoutOut without Connect", () => {
  assert.match(commerce, /async function optionalReadyRecipient/);
  assert.match(commerce, /function applyDestinationCharge/);
  assert.match(commerce, /if \(!isSubscription\) applyDestinationCharge\(params, summary\)/);
  assert.match(commerce, /paymentModel: recipient \? "destination-connect" : "floqr-platform"/);
  assert.doesNotMatch(commerce, /type !== "commerce" && type !== "shoutout"/);
  assert.match(commerce, /SHOUTOUT_CLUB_SHARE_PERCENT = 20/);
});

test("Connect webhook events refresh bindings on the existing platform endpoint", () => {
  assert.match(commerce, /account\.updated/);
  assert.match(commerce, /capability\.updated/);
  assert.match(commerce, /account\.application\.deauthorized/);
  assert.match(commerce, /async function handleConnectAccountWebhook/);
  assert.match(commerce, /connectAccountIdFromWebhookEvent\(event\)/);
  assert.doesNotMatch(commerce, /event\.account \|\| object\.id \|\| object\.account/);
  assert.match(commerce, /stripeTransfersActive/);
  assert.doesNotMatch(commerce, /STRIPE_CONNECT_WEBHOOK_SECRET/);
});

test("sandbox refund callable is test-mode only with reverse_transfer", () => {
  assert.match(commerce, /exports\.refundFloqrCheckoutOrder/);
  assert.match(commerce, /Sandbox refunds are only available while Stripe is in test mode/);
  assert.match(commerce, /refundParams\.reverse_transfer = true/);
  assert.match(commerce, /refund_application_fee: true/);
  assert.match(commerce, /payoutRecoveryAfterRefund\(current, \{reverseTransfer: !!refundParams\.reverse_transfer\}\)/);
  assert.match(commerce, /payoutRecoveryAfterRefund\(order, \{charge, refunds\}\)/);
  assert.match(commerce, /lockPayoutRecoveryStatus/);
  assert.match(commerce, /async function loadChargeRefunds/);
  assert.match(commerce, /db\.runTransaction\(async tx => \{/);
  assert.match(paymentService, /refundFloqrCheckoutOrder/);
  assert.match(paymentService, /refundCheckoutOrder/);
  assert.doesNotMatch(logging, /sandboxRefundOrderBtn/);
  assert.doesNotMatch(read("master-admin.html"), /Refund sandbox order/);
  assert.match(logging, /do not require club Stripe Connect/);
});

test("clubLocations Connect flags are Functions-written and client-locked", () => {
  assert.match(rules, /stripeTransfersActive/);
  assert.match(rules, /stripeCapabilityTransfers/);
  assert.match(adminHtml, /Do not paste an <code>acct_<\/code> id/);
  assert.doesNotMatch(adminHtml, /id="clubStripeConnectAccountId"/);
});
