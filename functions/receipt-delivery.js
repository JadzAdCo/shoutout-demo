/* FLOQR paid-order receipt helpers: temp→final promotion, FloqR Inbox, SendGrid PDF, optional SMS. */
"use strict";

const admin = require("firebase-admin");

function text(value = "", max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function money(cents = 0) {
  return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
}

function pdfEscape(value = "") {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Minimal single-page Helvetica PDF (no external deps). */
function buildInvoicePdfBase64(lines = []) {
  const contentLines = ["BT", "/F1 12 Tf", "50 760 Td", "14 TL"];
  (lines.length ? lines : ["FLOQR receipt"]).forEach((line, index) => {
    if (index === 0) contentLines.push(`(${pdfEscape(line)}) Tj`);
    else contentLines.push("T*", `(${pdfEscape(line)}) Tj`);
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach(obj => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  });
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8").toString("base64");
}

function formatPaidAt(value) {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return String(value);
}

function buildTempShoutoutReceipt({shoutout = {}, orderId = "", invoiceNumber = "", amountCents = 0} = {}) {
  return {
    status: "temp",
    kind: "shoutout",
    referenceNumber: text(shoutout.referenceNumber, 80),
    locationName: text(shoutout.locationName || shoutout.clubName, 160),
    templateName: text(shoutout.templateName || shoutout.template, 160),
    statusLabel: "Pending Location Approval",
    mainText: text(shoutout.mainText, 400),
    subText: text(shoutout.subText, 80),
    orderId: text(orderId, 160),
    invoiceNumber: text(invoiceNumber, 80),
    amountCents: Math.max(0, Math.round(Number(amountCents) || 0)),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function promoteShoutoutReceipt(tempReceipt = {}, payment = {}) {
  const paidAtIso = formatPaidAt(payment.paidAtIso || payment.paidAt || new Date());
  return {
    ...tempReceipt,
    status: "final",
    statusLabel: "Pending Location Approval",
    paidAt: payment.paidAt || admin.firestore.FieldValue.serverTimestamp(),
    paidAtIso,
    stripeCheckoutSessionId: text(payment.stripeCheckoutSessionId, 200),
    stripePaymentIntentId: text(payment.stripePaymentIntentId, 200),
    invoiceNumber: text(payment.invoiceNumber || tempReceipt.invoiceNumber, 80),
    amountCents: Math.max(0, Math.round(Number(payment.amountCents ?? tempReceipt.amountCents) || 0)),
    currency: text(payment.currency || "usd", 8) || "usd",
    shoutoutId: text(payment.shoutoutId, 160),
    promotedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function receiptBodyLines(receipt = {}) {
  return [
    `Reference: ${receipt.referenceNumber || "—"}`,
    `Location: ${receipt.locationName || "—"}`,
    `Template: ${receipt.templateName || "—"}`,
    `Status: ${receipt.statusLabel || "Pending Location Approval"}`,
    `Paid at: ${receipt.paidAtIso || "—"}`,
    `Invoice: ${receipt.invoiceNumber || "—"}`,
    `Total: ${money(receipt.amountCents)}`,
    receipt.stripePaymentIntentId ? `Stripe payment: ${receipt.stripePaymentIntentId}` : ""
  ].filter(Boolean);
}

async function writeFloqrInboxReceipt({recipientUid, recipientEmail = "", receipt = {}, link = ""} = {}) {
  if (!recipientUid) return null;
  const body = [
    "Your paid ShoutOut is submitted for location approval.",
    "",
    ...receiptBodyLines(receipt),
    link ? `\nView ShoutOuts: ${link}` : ""
  ].join("\n").trim();
  const ref = await admin.firestore().collection("inboxNotifications").add({
    recipientUid,
    recipientEmail: text(recipientEmail, 200),
    type: "paidShoutoutReceipt",
    title: "Paid ShoutOut receipt",
    body,
    referenceNumber: text(receipt.referenceNumber, 80),
    shoutoutId: text(receipt.shoutoutId, 160),
    orderId: text(receipt.orderId, 160),
    invoiceNumber: text(receipt.invoiceNumber, 80),
    paidAtIso: text(receipt.paidAtIso, 80),
    link: text(link, 500),
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

async function sendgridMailWithAttachment({
  apiKey,
  to,
  from,
  subject,
  textBody,
  htmlBody,
  filename,
  pdfBase64
}) {
  if (!apiKey) {
    const err = new Error("SENDGRID_API_KEY missing");
    err.code = "missing-key";
    throw err;
  }
  const payload = {
    personalizations: [{to: [{email: to}]}],
    from: {email: from, name: "FLOQR"},
    reply_to: {email: from},
    subject,
    content: [
      {type: "text/plain", value: textBody},
      {type: "text/html", value: htmlBody}
    ]
  };
  if (pdfBase64 && filename) {
    payload.attachments = [{
      content: pdfBase64,
      filename,
      type: "application/pdf",
      disposition: "attachment"
    }];
  }
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {authorization: `Bearer ${apiKey}`, "content-type": "application/json"},
    body: JSON.stringify(payload)
  });
  if (!(response.ok || response.status === 202)) {
    const errText = await response.text().catch(() => "");
    const err = new Error(errText.slice(0, 500) || `SendGrid ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.status;
}

async function sendTwilioSms({accountSid, authToken, fromNumber, to, body}) {
  const toPhone = text(to, 40);
  const from = text(fromNumber, 40);
  if (!accountSid || !authToken || !from || !toPhone) {
    return {ok: false, dryRun: true, status: "missing-config"};
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      To: toPhone,
      From: from,
      Body: String(body || "").slice(0, 1500)
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    return {ok: false, status: "twilio-error", error: errText.slice(0, 300)};
  }
  return {ok: true, status: "sent"};
}

async function deliverFinalPaidShoutoutReceipt({
  order = {},
  receipt = {},
  shoutoutId = "",
  sendgridApiKey = "",
  fromEmail = "login@floqr.com",
  twilio = {}
} = {}) {
  const ownerUid = text(order.ownerUid, 160);
  const ownerEmail = text(order.customerEmail || order.ownerEmail, 200);
  const link = `./patron-portal.html?tab=shoutouts&ref=${encodeURIComponent(receipt.referenceNumber || "")}&id=${encodeURIComponent(shoutoutId || "")}&v=29.09.56`;
  const inboxId = await writeFloqrInboxReceipt({
    recipientUid: ownerUid,
    recipientEmail: ownerEmail,
    receipt: {...receipt, shoutoutId},
    link
  });

  const pdfLines = [
    "FLOQR Paid ShoutOut Invoice",
    "",
    ...receiptBodyLines({...receipt, shoutoutId}),
    "",
    "Thank you for your FloqR purchase."
  ];
  const pdfBase64 = buildInvoicePdfBase64(pdfLines);
  const filename = `${text(receipt.invoiceNumber || "FLOQR-receipt", 80)}.pdf`;
  const textBody = ["Your paid ShoutOut receipt is attached.", "", ...receiptBodyLines(receipt)].join("\n");
  const htmlBody = `<p>Your paid ShoutOut receipt is attached.</p><pre>${receiptBodyLines(receipt).map(l => String(l).replace(/</g, "&lt;")).join("\n")}</pre>`;

  let emailStatus = null;
  let emailError = "";
  if (ownerEmail && sendgridApiKey) {
    try {
      emailStatus = await sendgridMailWithAttachment({
        apiKey: sendgridApiKey,
        to: ownerEmail,
        from: fromEmail,
        subject: `FLOQR receipt ${receipt.invoiceNumber || receipt.referenceNumber || ""}`.trim(),
        textBody,
        htmlBody,
        filename,
        pdfBase64
      });
    } catch (error) {
      emailError = text(error?.message || error, 300);
    }
  }

  let smsStatus = null;
  const phone = text(twilio.toPhone, 40);
  if (phone && twilio.accountSid && twilio.authToken && twilio.fromNumber) {
    smsStatus = await sendTwilioSms({
      accountSid: twilio.accountSid,
      authToken: twilio.authToken,
      fromNumber: twilio.fromNumber,
      to: phone,
      body: `FloqR: Paid ShoutOut receipt ${receipt.referenceNumber || ""}. ${money(receipt.amountCents)} at ${receipt.paidAtIso || "now"}. Invoice ${receipt.invoiceNumber || ""}. Status: Pending Location Approval.`
    });
  }

  return {inboxId, emailStatus, emailError, smsStatus, filename};
}

module.exports = {
  buildInvoicePdfBase64,
  buildTempShoutoutReceipt,
  promoteShoutoutReceipt,
  deliverFinalPaidShoutoutReceipt,
  writeFloqrInboxReceipt,
  receiptBodyLines,
  formatPaidAt,
  money
};
