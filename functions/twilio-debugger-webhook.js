/**
 * Twilio Debugger webhook — receives account Error/Warning events.
 * Paste this URL into Twilio Console → Monitor → Debugger → Webhooks:
 *   https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/twilioDebuggerWebhook
 *
 * Payload fields (form-encoded): AccountSid, Sid, ParentAccountSid, Timestamp,
 * Level, PayloadType, Payload (JSON string).
 */
"use strict";

const admin = require("firebase-admin");
const {onRequest} = require("firebase-functions/v2/https");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function text(value, max = 400) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function asForm(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) && Object.keys(req.body).length) {
    return req.body;
  }
  const raw = typeof req.rawBody === "string"
    ? req.rawBody
    : Buffer.isBuffer(req.rawBody)
      ? req.rawBody.toString("utf8")
      : "";
  if (!raw) return {};
  try {
    return Object.fromEntries(new URLSearchParams(raw));
  } catch (_) {
    return {};
  }
}

function parsePayload(raw, payloadType = "") {
  const str = typeof raw === "string" ? raw : (raw == null ? "" : JSON.stringify(raw));
  if (!str) return {raw: "", parsed: null};
  try {
    return {raw: str.slice(0, 8000), parsed: JSON.parse(str)};
  } catch (_) {
    // Sometimes Payload arrives already as object via JSON body.
    if (raw && typeof raw === "object") {
      return {raw: JSON.stringify(raw).slice(0, 8000), parsed: raw};
    }
    return {raw: str.slice(0, 8000), parsed: null};
  }
}

function summarizePayload(parsed) {
  if (!parsed || typeof parsed !== "object") return {};
  const errorCode = parsed.error_code || parsed.errorCode || parsed.code || parsed.ErrorCode || "";
  const errorMessage = parsed.error_message || parsed.errorMessage || parsed.message || parsed.Msg || "";
  const moreInfo = parsed.more_info || parsed.moreInfo || parsed.MoreInfo || "";
  const resourceSid = parsed.resource_sid || parsed.resourceSid || parsed.Sid || "";
  const serviceSid = parsed.service_sid || parsed.serviceSid || "";
  const webhook = parsed.webhook || {};
  return {
    errorCode: text(errorCode, 40),
    errorMessage: text(errorMessage, 500),
    moreInfo: text(moreInfo, 400),
    resourceSid: text(resourceSid, 80),
    serviceSid: text(serviceSid, 80),
    requestUrl: text(webhook.request?.url || parsed.request_url || "", 400),
    requestMethod: text(webhook.request?.method || parsed.request_method || "", 20)
  };
}

exports.twilioDebuggerWebhook = onRequest({
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB",
  cors: false,
  invoker: "public"
}, async (req, res) => {
  if (req.method === "GET" || req.method === "HEAD") {
    res.status(200).type("text/plain").send("FLOQR Twilio Debugger webhook OK");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const form = asForm(req);
  const level = text(form.Level || form.level, 20) || "Error";
  const eventSid = text(form.Sid || form.sid, 80);
  const accountSid = text(form.AccountSid || form.accountSid, 80);
  const parentAccountSid = text(form.ParentAccountSid || form.parentAccountSid, 80);
  const timestamp = text(form.Timestamp || form.timestamp, 80);
  const payloadType = text(form.PayloadType || form.payloadType, 80) || "application/json";
  const {raw: payloadRaw, parsed} = parsePayload(form.Payload ?? form.payload, payloadType);
  const summary = summarizePayload(parsed);

  const doc = {
    provider: "twilio",
    source: "debugger-webhook",
    level,
    eventSid,
    accountSid,
    parentAccountSid: parentAccountSid || null,
    eventTimestamp: timestamp || null,
    payloadType,
    payloadRaw,
    payload: parsed && typeof parsed === "object" ? parsed : null,
    ...summary,
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    receivedAtMs: Date.now()
  };

  try {
    await db.collection("twilioDebuggerEvents").add(doc);
  } catch (error) {
    console.error("twilioDebuggerEvents write failed", error?.message || error);
  }

  try {
    await db.collection("appLogs").add({
      level: String(level).toLowerCase() === "warning" ? "warn" : "error",
      category: "twilio",
      action: "debugger_webhook",
      message: text(`${summary.errorCode || "Twilio"} ${summary.errorMessage || level}`, 500),
      detail: {
        eventSid,
        accountSidLast4: accountSid ? accountSid.slice(-4) : "",
        errorCode: summary.errorCode,
        moreInfo: summary.moreInfo,
        resourceSid: summary.resourceSid
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    });
  } catch (error) {
    console.error("appLogs twilio debugger write failed", error?.message || error);
  }

  console.warn("twilioDebuggerWebhook", {
    level,
    eventSid,
    errorCode: summary.errorCode,
    errorMessage: summary.errorMessage,
    resourceSid: summary.resourceSid
  });

  // Twilio expects a quick 2xx; empty body is fine for Debugger webhooks.
  res.status(204).send("");
});
