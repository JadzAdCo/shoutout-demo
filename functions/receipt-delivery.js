/* FLOQR service receipts: shared contract for ShoutOut, VIP reserV, and future paid services.
   See .cursor/rules/floqr-service-receipts.mdc — descriptive titles, card last4, venue/when,
   completed → FloqR Inbox (+ email when SendGrid healthy); pending/saved → Feature & Orders only. */
"use strict";

const admin = require("firebase-admin");
const {sendSystemMail} = require("./mail-log");

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

function screenFormatLabelFromId(formatId = "") {
  const id = text(formatId, 40);
  const match = id.match(/(\d+)x(\d+)/i);
  return match ? `${match[1]} x ${match[2]} cm` : "";
}

function locationAddressFromShoutout(shoutout = {}) {
  const full = text(shoutout.fullAddress || shoutout.locationAddress, 400);
  if (full) return full;
  return [
    text(shoutout.streetAddress, 160),
    text(shoutout.city, 80),
    text(shoutout.region, 80),
    text(shoutout.postalCode, 20),
    text(shoutout.country, 80)
  ].filter(Boolean).join(", ");
}

/** Descriptive ShoutOut title (VIP reserV style) — never a bare brand stub. */
function shoutoutReceiptTitle(shoutout = {}) {
  const template = text(shoutout.templateName || shoutout.template, 80) || "ShoutOut";
  const venue = text(shoutout.locationName || shoutout.clubName || shoutout.brandName, 80);
  const when = text(shoutout.serviceDate || shoutout.eventDate || shoutout.night, 40)
    || (shoutout.paidAtIso ? text(String(shoutout.paidAtIso).slice(0, 10), 20) : "");
  const screen = text(shoutout.screenFormatLabel, 40);
  const bits = [template];
  if (venue) bits.push(`@ ${venue}`);
  if (when) bits.push(`— ${when}`);
  else if (screen) bits.push(`— ${screen}`);
  return text(bits.join(" "), 160);
}

function buildTempShoutoutReceipt({shoutout = {}, orderId = "", invoiceNumber = "", amountCents = 0, cardLast4 = "", cardBrand = "", clientIp = "", clientGeo = ""} = {}) {
  const screenFormatId = text(shoutout.screenFormatId, 40);
  const screenFormatLabel = text(shoutout.screenFormatLabel, 80) || screenFormatLabelFromId(screenFormatId);
  const title = shoutoutReceiptTitle({...shoutout, screenFormatLabel});
  return {
    status: "temp",
    kind: "shoutout",
    title,
    itemName: title,
    servicesRendered: [title],
    referenceNumber: text(shoutout.referenceNumber, 80),
    locationName: text(shoutout.locationName || shoutout.clubName, 160),
    venueName: text(shoutout.locationName || shoutout.clubName, 160),
    brandName: text(shoutout.brandName, 160),
    locationAddress: locationAddressFromShoutout(shoutout),
    templateName: text(shoutout.templateName || shoutout.template, 160),
    screenFormatId,
    screenFormatLabel,
    serviceDate: text(shoutout.serviceDate || shoutout.eventDate || "", 40),
    serviceTime: text(shoutout.serviceTime || shoutout.eventTime || "", 40),
    statusLabel: "Pending Location Approval",
    mainText: text(shoutout.mainText, 400),
    subText: text(shoutout.subText, 80),
    orderId: text(orderId, 160),
    invoiceNumber: text(invoiceNumber, 80),
    amountCents: Math.max(0, Math.round(Number(amountCents) || 0)),
    cardLast4: text(cardLast4, 4),
    cardBrand: text(cardBrand, 40),
    clientIp: text(clientIp, 80),
    clientGeo: text(clientGeo, 120),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function promoteShoutoutReceipt(tempReceipt = {}, payment = {}) {
  const paidAtIso = formatPaidAt(payment.paidAtIso || payment.paidAt || new Date());
  const shoutoutBits = {
    templateName: tempReceipt.templateName,
    locationName: tempReceipt.locationName,
    brandName: tempReceipt.brandName,
    screenFormatLabel: tempReceipt.screenFormatLabel,
    serviceDate: tempReceipt.serviceDate,
    paidAtIso
  };
  const title = text(payment.itemName || tempReceipt.title || shoutoutReceiptTitle(shoutoutBits), 160);
  return {
    ...tempReceipt,
    status: "final",
    title,
    itemName: title,
    statusLabel: text(payment.statusLabel || tempReceipt.statusLabel || "Pending Location Approval", 80),
    paidAt: payment.paidAt || admin.firestore.FieldValue.serverTimestamp(),
    paidAtIso,
    stripeCheckoutSessionId: text(payment.stripeCheckoutSessionId, 200),
    stripePaymentIntentId: text(payment.stripePaymentIntentId, 200),
    invoiceNumber: text(payment.invoiceNumber || tempReceipt.invoiceNumber, 80),
    amountCents: Math.max(0, Math.round(Number(payment.amountCents ?? tempReceipt.amountCents) || 0)),
    currency: text(payment.currency || "usd", 8) || "usd",
    shoutoutId: text(payment.shoutoutId, 160),
    cardLast4: text(payment.cardLast4 || tempReceipt.cardLast4, 4),
    cardBrand: text(payment.cardBrand || tempReceipt.cardBrand, 40),
    clientIp: text(payment.clientIp || tempReceipt.clientIp, 80),
    clientGeo: text(payment.clientGeo || tempReceipt.clientGeo, 120),
    promotedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

/** VIP reserV paid deposit receipt (completed commerce). */
function buildVipReservationReceipt({order = {}, reservationId = "", payment = {}} = {}) {
  const night = text(order.night || order.payload?.night, 20);
  const label = text(order.sectionLabel || order.payload?.sectionId || order.sectionId, 40);
  const club = text(order.venueName || order.clubLocationName || order.clubLocationId, 80);
  const title = text(order.itemName || `Table ${label || "—"} deposit — ${club || "venue"}, ${night || "night"}`, 160);
  const paidAtIso = formatPaidAt(payment.paidAtIso || payment.paidAt || new Date());
  return {
    status: "final",
    kind: "vipReservation",
    title,
    itemName: title,
    servicesRendered: [
      title,
      text(order.description, 200)
    ].filter(Boolean),
    referenceNumber: text(order.invoiceNumber || order.referenceNumber, 80),
    venueName: club,
    locationName: club,
    clubLocationId: text(order.clubLocationId, 120),
    serviceDate: night,
    night,
    sectionId: text(order.sectionId || order.payload?.sectionId, 80),
    sectionLabel: label,
    statusLabel: "VIP reserV confirmed",
    orderId: text(order.id || order.orderId, 160),
    reservationId: text(reservationId, 160),
    invoiceNumber: text(order.invoiceNumber, 80),
    amountCents: Math.max(0, Math.round(Number(order.amountCents || 0))),
    currency: text(order.currency || "usd", 8) || "usd",
    cardLast4: text(payment.cardLast4 || order.cardLast4, 4),
    cardBrand: text(payment.cardBrand || order.cardBrand, 40),
    clientIp: text(order.clientIp || payment.clientIp, 80),
    clientGeo: text(order.clientGeo || payment.clientGeo, 120),
    stripeCheckoutSessionId: text(payment.stripeCheckoutSessionId || order.stripeCheckoutSessionId, 200),
    stripePaymentIntentId: text(payment.stripePaymentIntentId || order.stripePaymentIntentId, 200),
    paidAt: payment.paidAt || admin.firestore.FieldValue.serverTimestamp(),
    paidAtIso,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function receiptBodyLines(receipt = {}) {
  const title = text(receipt.title || receipt.itemName, 160);
  return [
    title ? `Service: ${title}` : "",
    `Reference: ${receipt.referenceNumber || receipt.invoiceNumber || "—"}`,
    `Venue: ${receipt.venueName || receipt.locationName || "—"}`,
    receipt.locationAddress ? `Address: ${receipt.locationAddress}` : "",
    receipt.serviceDate || receipt.night ? `Date: ${receipt.serviceDate || receipt.night}` : "",
    receipt.serviceTime ? `Time: ${receipt.serviceTime}` : "",
    receipt.templateName ? `Template: ${receipt.templateName}` : "",
    receipt.sectionLabel ? `Table / section: ${receipt.sectionLabel}` : "",
    receipt.screenFormatLabel ? `Screen size: ${receipt.screenFormatLabel}` : "",
    `Status: ${receipt.statusLabel || "—"}`,
    `Paid at: ${receipt.paidAtIso || "—"}`,
    `Invoice: ${receipt.invoiceNumber || "—"}`,
    `Total: ${money(receipt.amountCents)}`,
    receipt.cardLast4 ? `Card: ${receipt.cardBrand || "Card"} •••• ${receipt.cardLast4}` : "",
    receipt.clientIp ? `Checkout IP: ${receipt.clientIp}` : "",
    receipt.clientGeo ? `Approx. location: ${receipt.clientGeo}` : "",
    receipt.stripePaymentIntentId ? `Stripe payment: ${receipt.stripePaymentIntentId}` : ""
  ].filter(Boolean);
}

/**
 * @param {{routeToInbox?: boolean}} opts — pending ShoutOuts set routeToInbox false;
 *   completed / VIP reserV confirmed set true (default true for completed kinds).
 */
async function writeFloqrInboxReceipt({
  recipientUid,
  recipientEmail = "",
  receipt = {},
  link = "",
  type = "",
  title = "",
  intro = ""
} = {}) {
  if (!recipientUid) return null;
  const kind = text(receipt.kind, 40);
  const inboxType = text(type, 60)
    || (kind === "vipReservation" ? "paidVipReservReceipt" : "paidShoutoutReceipt");
  const inboxTitle = text(title, 160)
    || text(receipt.title || receipt.itemName, 160)
    || (kind === "vipReservation" ? "VIP reserV receipt" : "Paid ShoutOut receipt");
  const lead = text(intro, 300)
    || (kind === "vipReservation"
      ? "Your VIP reserV deposit is confirmed."
      : "Your paid ShoutOut receipt is ready.");
  const body = [
    lead,
    "",
    ...receiptBodyLines(receipt),
    link ? `\nOpen: ${link}` : ""
  ].join("\n").trim();
  const ref = await admin.firestore().collection("inboxNotifications").add({
    recipientUid,
    recipientEmail: text(recipientEmail, 200),
    type: inboxType,
    title: inboxTitle,
    body,
    referenceNumber: text(receipt.referenceNumber || receipt.invoiceNumber, 80),
    shoutoutId: text(receipt.shoutoutId, 160),
    reservationId: text(receipt.reservationId, 160),
    orderId: text(receipt.orderId, 160),
    invoiceNumber: text(receipt.invoiceNumber, 80),
    paidAtIso: text(receipt.paidAtIso, 80),
    kind,
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
  const result = await sendSystemMail({
    apiKey,
    kind: "receipt",
    source: "deliverServiceReceipt",
    trigger: "function",
    to,
    from,
    subject,
    textBody,
    htmlBody,
    attachments: (pdfBase64 && filename) ? [{
      content: pdfBase64,
      filename,
      type: "application/pdf",
      disposition: "attachment"
    }] : []
  });
  return result.status;
}

/** VIP-B-24: always use the logged Twilio path (never raw fetch). */
async function sendTwilioSms({
  accountSid,
  authToken,
  fromNumber,
  to,
  body,
  clubLocationId = "",
  shoutoutId = "",
  actorUid = "",
  actorEmail = ""
} = {}) {
  const {sanitizeTwilioSecret, describeTwilioAccountSid, explainTwilioDeliveryError} = require("./messaging-core");
  const {sendTwilioMessagesApi} = require("./twilio-log");
  return sendTwilioMessagesApi({
    accountSid: sanitizeTwilioSecret(accountSid),
    authToken: sanitizeTwilioSecret(authToken),
    from: text(fromNumber, 40),
    to: text(to, 40),
    body: String(body || "").slice(0, 1500),
    channel: "sms",
    purpose: "receipt",
    source: "deliverServiceReceipt",
    clubLocationId: text(clubLocationId, 120),
    shoutoutId: text(shoutoutId, 120),
    actorUid: text(actorUid, 120),
    actorEmail: text(actorEmail, 200),
    describeInvalidSid: describeTwilioAccountSid,
    explainError: explainTwilioDeliveryError
  });
}

/**
 * Deliver a finalized service receipt.
 * @param {object} opts
 * @param {boolean} [opts.routeToInbox=true] — false for pending ShoutOuts (Feature & Orders only)
 * @param {boolean} [opts.sendEmail=true]
 */
async function deliverServiceReceipt({
  order = {},
  receipt = {},
  shoutoutId = "",
  reservationId = "",
  sendgridApiKey = "",
  fromEmail = "login@floqr.com",
  twilio = {},
  routeToInbox = true,
  sendEmail = true,
  portalLink = ""
} = {}) {
  const ownerUid = text(order.ownerUid, 160);
  const ownerEmail = text(order.customerEmail || order.ownerEmail, 200);
  const kind = text(receipt.kind, 40);
  const link = text(portalLink, 500)
    || (kind === "vipReservation"
      ? `./patron-portal.html?tab=guest-list-reserv&id=${encodeURIComponent(reservationId || "")}`
      : `./patron-portal.html?tab=shoutouts&ref=${encodeURIComponent(receipt.referenceNumber || "")}&id=${encodeURIComponent(shoutoutId || "")}`);

  let inboxId = null;
  if (routeToInbox) {
    inboxId = await writeFloqrInboxReceipt({
      recipientUid: ownerUid,
      recipientEmail: ownerEmail,
      receipt: {...receipt, shoutoutId, reservationId},
      link
    });
  }

  const pdfHeader = kind === "vipReservation" ? "FLOQR VIP reserV Invoice" : "FLOQR Paid ShoutOut Invoice";
  const pdfLines = [
    pdfHeader,
    "",
    ...receiptBodyLines({...receipt, shoutoutId, reservationId}),
    "",
    "Thank you for your FloqR purchase."
  ];
  const pdfBase64 = buildInvoicePdfBase64(pdfLines);
  const filename = `${text(receipt.invoiceNumber || "FLOQR-receipt", 80)}.pdf`;
  const textBody = ["Your FLOQR receipt is attached.", "", ...receiptBodyLines(receipt)].join("\n");
  const htmlBody = `<p>Your FLOQR receipt is attached.</p><pre>${receiptBodyLines(receipt).map(l => String(l).replace(/</g, "&lt;")).join("\n")}</pre>`;

  let emailStatus = null;
  let emailError = "";
  if (sendEmail && ownerEmail && sendgridApiKey) {
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
      body: `FloqR: ${receipt.title || "Receipt"} ${receipt.referenceNumber || ""}. ${money(receipt.amountCents)} at ${receipt.paidAtIso || "now"}. Invoice ${receipt.invoiceNumber || ""}.`
    });
  }

  return {inboxId, emailStatus, emailError, smsStatus, filename, routedToInbox: !!routeToInbox};
}

/** @deprecated Prefer deliverServiceReceipt — kept for call sites. Pending path: routeToInbox false. */
async function deliverFinalPaidShoutoutReceipt(opts = {}) {
  return deliverServiceReceipt({
    ...opts,
    routeToInbox: opts.routeToInbox !== false,
    sendEmail: opts.sendEmail !== false
  });
}

module.exports = {
  buildInvoicePdfBase64,
  buildTempShoutoutReceipt,
  buildVipReservationReceipt,
  promoteShoutoutReceipt,
  shoutoutReceiptTitle,
  deliverServiceReceipt,
  deliverFinalPaidShoutoutReceipt,
  writeFloqrInboxReceipt,
  receiptBodyLines,
  formatPaidAt,
  money,
  sendTwilioSms
};
// deploy marker 20261016T180244Z
