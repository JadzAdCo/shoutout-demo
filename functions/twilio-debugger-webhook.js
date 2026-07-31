/**
 * Twilio Debugger webhook — receives account Error/Warning events.
 * Paste this URL into Twilio Console → Monitor → Debugger → Webhooks:
 *   https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/twilioDebuggerWebhook
 *
 * Security-relevant events are also written to Master Admin
 * Security System Messages (inboxNotifications messageCategory=security).
 */
"use strict";

const crypto = require("crypto");
const admin = require("firebase-admin");
const {onRequest} = require("firebase-functions/v2/https");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

/** Twilio error codes that usually indicate abuse, account takeover, or filtering/fraud controls. */
const SECURITY_ERROR_CODES = new Set([
  "20001", "20003", "20008", // authentication / permission
  "20429", // rate limited (possible pumping / credential abuse)
  "11200", "11205", "11210", "11215", // webhook HTTP failures (probe / hijack attempts)
  "12300", "12301", // invalid request signature
  "21408", "21215", "21216", "21217", // geo / permission to contact destination
  "21610", // unsubscribed / blacklisted recipient
  "21612", "21614", // can't route / invalid mobile
  "30004", "30005", "30006", "30007", "30008", // delivery blocked / filtered / unknown handset
  "14107", "30003" // message filtered / unreachable
]);

const SECURITY_KEYWORD_RE = /fraud|pump|spam|unauthorized|forbidden|authentication|signature|blacklist|blocked|filtered|abuse|credential|hijack|phishing|takeover/i;

const SECURITY_NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;

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

function parsePayload(raw) {
  const str = typeof raw === "string" ? raw : (raw == null ? "" : JSON.stringify(raw));
  if (!str) return {raw: "", parsed: null};
  try {
    return {raw: str.slice(0, 8000), parsed: JSON.parse(str)};
  } catch (_) {
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
  const to = parsed.to || parsed.To || parsed.called || "";
  const from = parsed.from || parsed.From || parsed.caller || "";
  const webhook = parsed.webhook || {};
  return {
    errorCode: text(String(errorCode), 40),
    errorMessage: text(errorMessage, 500),
    moreInfo: text(moreInfo, 400),
    resourceSid: text(resourceSid, 80),
    serviceSid: text(serviceSid, 80),
    toLast4: text(to, 40).replace(/\D/g, "").slice(-4),
    fromLast4: text(from, 40).replace(/\D/g, "").slice(-4),
    requestUrl: text(webhook.request?.url || parsed.request_url || "", 400),
    requestMethod: text(webhook.request?.method || parsed.request_method || "", 20)
  };
}

function isSecurityRelevant(level, summary) {
  const code = String(summary.errorCode || "").replace(/\D/g, "");
  if (code && SECURITY_ERROR_CODES.has(code)) return true;
  const hay = `${summary.errorMessage || ""} ${summary.moreInfo || ""}`;
  if (SECURITY_KEYWORD_RE.test(hay)) return true;
  // Auth-class Errors without a mapped code still matter.
  if (String(level).toLowerCase() === "error" && /auth|credential|permission|forbidden|unauthorized/i.test(hay)) {
    return true;
  }
  return false;
}

async function resolveMasterAdminUids() {
  const uids = new Set();
  await Promise.all(MASTER_ADMIN_EMAILS.map(async (email) => {
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user?.uid) uids.add(user.uid);
    } catch (_) {}
  }));
  try {
    const snap = await db.collection("users").where("masterAdmin", "==", true).limit(40).get();
    snap.forEach((doc) => uids.add(doc.id));
  } catch (_) {}
  return [...uids];
}

async function notifySecuritySystemMessages({level, eventSid, accountSid, summary, timestamp}) {
  const coolKey = crypto
    .createHash("sha1")
    .update(`${summary.errorCode || "none"}|${summary.resourceSid || eventSid || "evt"}|${summary.toLast4 || ""}`)
    .digest("hex")
    .slice(0, 40);
  const coolRef = db.collection("twilioSecurityAlerts").doc(coolKey);
  const nowMs = Date.now();
  const coolSnap = await coolRef.get();
  const lastMs = Number(coolSnap.exists ? coolSnap.data()?.lastNotifiedAtMs || 0 : 0);
  if (lastMs && nowMs - lastMs < SECURITY_NOTIFY_COOLDOWN_MS) {
    return {notified: false, reason: "cooldown"};
  }

  const recipientUids = await resolveMasterAdminUids();
  if (!recipientUids.length) return {notified: false, reason: "no_recipients"};

  const title = summary.errorCode
    ? `Twilio security alert (${summary.errorCode})`
    : "Twilio security alert";
  const body = [
    `Twilio ${level || "Error"} on FLOQR messaging account.`,
    summary.errorMessage || "See Debugger payload.",
    summary.moreInfo ? `Info: ${summary.moreInfo}` : "",
    summary.toLast4 ? `Destination ending ${summary.toLast4}.` : "",
    summary.fromLast4 ? `From ending ${summary.fromLast4}.` : "",
    eventSid ? `Debugger event ${eventSid}.` : "",
    "Review Twilio Console Monitor logs and FLOQR SMS consent / SOS2FA activity."
  ].filter(Boolean).join(" ");

  const note = {
    type: "twilioSecurityAlert",
    messageCategory: "security",
    provider: "twilio",
    title,
    subject: title,
    body,
    locationName: "Twilio",
    clubLocationId: "twilio",
    denialReason: text(`${summary.errorCode || "twilio"}: ${summary.errorMessage || level}`, 240),
    errorCode: summary.errorCode || "",
    moreInfo: summary.moreInfo || "",
    resourceSid: summary.resourceSid || "",
    eventSid: eventSid || "",
    accountSidLast4: accountSid ? accountSid.slice(-4) : "",
    eventTimestamp: timestamp || null,
    clientIp: "",
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: nowMs,
    link: "./master-admin.html#securitySystemMessages"
  };

  await Promise.all(recipientUids.map((uid) => db.collection("inboxNotifications").add({...note, recipientUid: uid})));
  await coolRef.set({
    errorCode: summary.errorCode || "",
    resourceSid: summary.resourceSid || "",
    eventSid: eventSid || "",
    lastNotifiedAtMs: nowMs,
    recipientCount: recipientUids.length
  }, {merge: true});
  return {notified: true, recipientCount: recipientUids.length};
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
  const {raw: payloadRaw, parsed} = parsePayload(form.Payload ?? form.payload);
  const summary = summarizePayload(parsed);
  const securityRelevant = isSecurityRelevant(level, summary);

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
    securityRelevant,
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
      category: securityRelevant ? "twilio-security" : "twilio",
      action: "debugger_webhook",
      message: text(`${summary.errorCode || "Twilio"} ${summary.errorMessage || level}`, 500),
      detail: {
        eventSid,
        accountSidLast4: accountSid ? accountSid.slice(-4) : "",
        errorCode: summary.errorCode,
        moreInfo: summary.moreInfo,
        resourceSid: summary.resourceSid,
        securityRelevant
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    });
  } catch (error) {
    console.error("appLogs twilio debugger write failed", error?.message || error);
  }

  let securityNotify = {notified: false};
  if (securityRelevant) {
    try {
      securityNotify = await notifySecuritySystemMessages({
        level,
        eventSid,
        accountSid,
        summary,
        timestamp
      });
    } catch (error) {
      console.error("twilio security system message failed", error?.message || error);
    }
  }

  console.warn("twilioDebuggerWebhook", {
    level,
    eventSid,
    errorCode: summary.errorCode,
    errorMessage: summary.errorMessage,
    resourceSid: summary.resourceSid,
    securityRelevant,
    securityNotified: !!securityNotify.notified
  });

  res.status(204).send("");
});
