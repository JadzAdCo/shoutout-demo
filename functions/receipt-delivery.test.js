const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildTempShoutoutReceipt,
  promoteShoutoutReceipt,
  buildInvoicePdfBase64,
  receiptBodyLines
} = require("./receipt-delivery");

test("temp shoutout receipt mirrors unpaid confirmation fields", () => {
  const temp = buildTempShoutoutReceipt({
    shoutout: {
      referenceNumber: "SO-1234567",
      locationName: "Zebbies Garden DC",
      brandName: "Zebbies Garden",
      streetAddress: "1223 Connecticut Avenue NW",
      city: "Washington",
      region: "District of Columbia",
      postalCode: "20036",
      country: "United States",
      screenFormatId: "led-96x48",
      templateName: "Soccer Jersey",
      mainText: "NYX",
      subText: "99"
    },
    orderId: "ord1",
    invoiceNumber: "FLOQR-20260723-ABCD1234",
    amountCents: 3000
  });
  assert.equal(temp.status, "temp");
  assert.equal(temp.statusLabel, "Pending Location Approval");
  assert.equal(temp.referenceNumber, "SO-1234567");
  assert.equal(temp.locationName, "Zebbies Garden DC");
  assert.equal(temp.templateName, "Soccer Jersey");
  assert.equal(temp.screenFormatId, "led-96x48");
  assert.equal(temp.screenFormatLabel, "96 x 48 cm");
  assert.match(temp.locationAddress, /1223 Connecticut Avenue NW/);
  assert.match(temp.locationAddress, /Washington/);
});

test("promote adds paid time and Stripe ids while keeping approval status", () => {
  const temp = buildTempShoutoutReceipt({
    shoutout: {
      referenceNumber: "SO-1",
      locationName: "Heist",
      templateName: "Vault",
      screenFormatId: "led-64x32",
      fullAddress: "1802 Jefferson Pl. NW, Washington, DC 20036"
    },
    orderId: "o1",
    invoiceNumber: "INV-1",
    amountCents: 3000
  });
  const final = promoteShoutoutReceipt(temp, {
    paidAtIso: "2026-07-23T15:00:00.000Z",
    stripeCheckoutSessionId: "cs_test",
    stripePaymentIntentId: "pi_test",
    invoiceNumber: "INV-1",
    amountCents: 3000,
    shoutoutId: "stripe_o1"
  });
  assert.equal(final.status, "final");
  assert.equal(final.statusLabel, "Pending Location Approval");
  assert.equal(final.paidAtIso, "2026-07-23T15:00:00.000Z");
  assert.equal(final.stripePaymentIntentId, "pi_test");
  const lines = receiptBodyLines(final);
  assert.ok(lines.some(line => /Paid at:/.test(line)));
  assert.ok(lines.some(line => /Screen size: 64 x 32 cm/.test(line)));
  assert.ok(lines.some(line => /Address: 1802 Jefferson Pl/.test(line)));
  assert.ok(lines.some(line => /Venue: Heist/.test(line)));
});

test("invoice PDF is a valid base64 PDF header", () => {
  const b64 = buildInvoicePdfBase64(["FLOQR Paid ShoutOut Invoice", "Reference: SO-1"]);
  const raw = Buffer.from(b64, "base64").toString("utf8");
  assert.ok(raw.startsWith("%PDF-1.4"));
  assert.ok(raw.includes("%%EOF"));
});
