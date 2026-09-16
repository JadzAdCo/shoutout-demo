/**
 * FLOQR Twilio outbound + compliance logging.
 * Mirrors system mail logging governance (ISO/IEC 27001:2022 A.8.15):
 * - Operational/diagnostic evidence: 30-day (body clip, request headers)
 * - Security/compliance metadata: 90-day (outcome, masked destination, hashes, actor)
 * Separate collections per channel/feature for troubleshooting.
 * No Auth Token / Account SID full values in logs. PCI excluded. PII minimized.
 */
"use strict";

const crypto = require("crypto");
const https = require("https");
const admin = require("firebase-admin");

const TWILIO_HOST = "api.twilio.com";
const TLS_MIN = "TLSv1.3";
const LOG_STANDARD = "ISO/IEC 27001:2022 A.8.15";
const DAY_MS = 24 * 60 * 60 * 1000;
const DIAGNOSTIC_RETENTION_MS = 30 * DAY_MS;
const SECURITY_RETENTION_MS = 90 * DAY_MS;
const AUDIT_RETENTION_MS = 7 * 365 * DAY_MS;
const PHONE_HASH_PREFIX = "floqr-twilio:";
const BODY_MAX = 1600;

const COLLECTION_BY_FEATURE = {
  sms: "twilioSmsLogs",
  whatsapp: "twilioWhatsAppLogs",
  debugger: "twilioFeatureLogs",
  verify: "twilioFeatureLogs",
  voice: "twilioFeatureLogs",
  lookup: "twilioFeatureLogs",
  other: "twilioFeatureLogs"
};

const COMPLIANCE_COLLECTION = "twilioComplianceLogs";

/** Error / status tokens that require a compliance (GRC) row. */
const SECURITY_STATUS_RE = /invalid-sid|failed|blocked|filtered|unauthorized|forbidden|authentication|dry-run|invalid-to|rate.?limit|unsubscribed|blacklist/i;
const SECURITY_ERROR_CODES = new Set([
  "20001", "20003", "20008", "20429",
  "21408", "21215", "21216", "21217",
  "21610", "21612", "21614",
  "30003", "30004", "30005", "30006", "30007", "30008",
  "14107"
]);

function db() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

function text(value, max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function clip(value, max) {
  const raw = String(value == null ? "" : value);
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}\n…[truncated ${raw.length - max} chars]`;
}

function stripPci(value) {
  return String(value == null ? "" : value)
    .replace(/\b(?:\d[ \-]*?){13,19}\b/g, "[card redacted]")
    .replace(/\b(cvv|cvc|cid)\s*[:#]?\s*\d{3,4}\b/gi, "$1 [redacted]");
}

function redactSecrets(value) {
  return String(value == null ? "" : value)
    .replace(/\bAC[a-f0-9]{32}\b/gi, "AC[redacted]")
    .replace(/\bSK[a-f0-9]{32}\b/gi, "SK[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b\d{6}\b/g, "••••••");
}

function digitsOnly(value) {
  return String(value == null ? "" : value).replace(/\D/g, "");
}

function maskPhone(value) {
  const raw = text(value, 40);
  const digits = digitsOnly(raw.replace(/^whatsapp:/i, ""));
  if (digits.length < 4) return "***";
  const last4 = digits.slice(-4);
  const prefix = raw.toLowerCase().startsWith("whatsapp:") ? "whatsapp:" : (raw.startsWith("+") ? "+" : "");
  return `${prefix}***${last4}`;
}

function hashPhone(value) {
  const digits = digitsOnly(String(value == null ? "" : value).replace(/^whatsapp:/i, ""));
  if (!digits) return "";
  return crypto.createHash("sha256")
    .update(`${PHONE_HASH_PREFIX}${digits}`)
    .digest("hex");
}

function featureOf(channel, feature) {
  const f = text(feature || channel, 40).toLowerCase();
  if (f === "sms" || f === "whatsapp") return f;
  if (COLLECTION_BY_FEATURE[f]) return f;
  return "other";
}

function collectionFor(feature) {
  return COLLECTION_BY_FEATURE[feature] || COLLECTION_BY_FEATURE.other;
}

function newLogId(prefix = "tw") {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function isSecurityRelevant({status, error, errorCode, dryRun}) {
  const code = String(errorCode || "").replace(/\D/g, "");
  if (code && SECURITY_ERROR_CODES.has(code)) return true;
  if (dryRun === true) return true;
  const hay = `${status || ""} ${error || ""}`;
  return SECURITY_STATUS_RE.test(hay);
}

/**
 * Persist a Twilio outbound (or feature) log row + optional GRC compliance row.
 * Returns {logId, collection, complianceId}.
 */
async function writeTwilioLog({
  channel = "sms",
  feature = "",
  purpose = "",
  source = "sendTwilioMessage",
  trigger = "function",
  clubLocationId = "",
  campaignId = "",
  shoutoutId = "",
  shiftId = "",
  actorUid = "",
  actorEmail = "",
  to = "",
  from = "",
  body = "",
  status = "unknown",
  sendOk = false,
  dryRun = false,
  httpStatus = 0,
  providerSid = "",
  error = "",
  errorCode = "",
  accountSidLast4 = "",
  tlsProtocol = "",
  requestHeaders = {},
  responseHeaders = {},
  extra = {}
} = {}) {
  const feat = featureOf(channel, feature);
  const collection = collectionFor(feat);
  const logId = newLogId(feat === "sms" ? "sms" : feat === "whatsapp" ? "wa" : "tw");
  const now = Date.now();
  const toMasked = maskPhone(to);
  const fromMasked = maskPhone(from);
  const toHash = hashPhone(to);
  const fromHash = hashPhone(from);
  const safeBody = redactSecrets(stripPci(body));
  const securityRelevant = isSecurityRelevant({status, error, errorCode, dryRun});

  const row = {
    logClass: securityRelevant ? "security" : "operational",
    logStandard: LOG_STANDARD,
    piiMinimized: true,
    pciExcluded: true,
    provider: "twilio",
    feature: feat,
    channel: text(channel, 40) || feat,
    purpose: text(purpose, 80),
    source: text(source, 120),
    trigger: text(trigger, 40),
    clubLocationId: text(clubLocationId, 160),
    campaignId: text(campaignId, 120),
    shoutoutId: text(shoutoutId, 160),
    shiftId: text(shiftId, 120),
    actorUid: text(actorUid, 160),
    actorEmailMasked: actorEmail ? maskPhone(actorEmail.includes("@") ? actorEmail : "") || text(actorEmail, 40).replace(/(.{1}).+(@.+)/, "$1***$2") : "",
    toMasked,
    toHash,
    toLast4: digitsOnly(to).slice(-4),
    fromMasked,
    fromHash,
    status: text(status, 40),
    sendOk: sendOk === true,
    dryRun: dryRun === true,
    httpStatus: Number(httpStatus) || 0,
    providerSid: text(providerSid, 80),
    error: text(redactSecrets(error), 500),
    errorCode: text(String(errorCode || ""), 40),
    accountSidLast4: text(accountSidLast4, 8),
    tlsMinRequested: TLS_MIN,
    tlsProtocol: text(tlsProtocol, 40),
    securityRelevant,
    diagnosticExpireAtMs: now + DIAGNOSTIC_RETENTION_MS,
    securityExpireAtMs: now + SECURITY_RETENTION_MS,
    diagnosticPurged: false,
    diagnostic: {
      body: clip(safeBody, BODY_MAX),
      requestHeaders: requestHeaders && typeof requestHeaders === "object" ? requestHeaders : {},
      responseHeaders: responseHeaders && typeof responseHeaders === "object" ? responseHeaders : {},
      extra: extra && typeof extra === "object" ? extra : {}
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: now
  };

  // Drop empty actorEmailMasked noise when not an email.
  if (!actorEmail || !String(actorEmail).includes("@")) {
    row.actorEmailMasked = text(actorEmail, 80) ? `${text(actorEmail, 1)}***` : "";
  } else {
    const raw = text(actorEmail, 200).toLowerCase();
    const at = raw.indexOf("@");
    row.actorEmailMasked = at > 0 ? `${raw.slice(0, 1)}***@${raw.slice(at + 1, at + 2)}***.${raw.split(".").pop()}` : "***";
  }

  try {
    await db().collection(collection).doc(logId).set(row);
  } catch (err) {
    console.error("twilio log write failed", collection, err?.message || err);
  }

  let complianceId = "";
  if (securityRelevant) {
    complianceId = `cmp_${logId}`;
    try {
      await db().collection(COMPLIANCE_COLLECTION).doc(complianceId).set({
        logStandard: LOG_STANDARD,
        controlSets: ["SOC2-CC6/CC7", "ISO27001-A.8.15", "NIST-800-53-AU"],
        provider: "twilio",
        feature: feat,
        channel: row.channel,
        purpose: row.purpose,
        clubLocationId: row.clubLocationId,
        campaignId: row.campaignId,
        actorUid: row.actorUid,
        toMasked: row.toMasked,
        toHash: row.toHash,
        fromMasked: row.fromMasked,
        status: row.status,
        sendOk: row.sendOk,
        dryRun: row.dryRun,
        error: row.error,
        errorCode: row.errorCode,
        providerSid: row.providerSid,
        accountSidLast4: row.accountSidLast4,
        relatedLogId: logId,
        relatedCollection: collection,
        securityRelevant: true,
        retentionYears: 7,
        expireAtMs: now + AUDIT_RETENTION_MS,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAtMs: now
      });
    } catch (err) {
      console.error("twilio compliance log write failed", err?.message || err);
      complianceId = "";
    }
  }

  return {logId, collection, complianceId, securityRelevant};
}

/**
 * POST Messages.json with TLS 1.3 preference and structured logs.
 */
async function sendTwilioMessagesApi({
  accountSid,
  authToken,
  to,
  from,
  body,
  channel = "sms",
  purpose = "alert",
  source = "sendTwilioMessagesApi",
  clubLocationId = "",
  campaignId = "",
  shoutoutId = "",
  shiftId = "",
  actorUid = "",
  actorEmail = "",
  describeInvalidSid = null,
  explainError = null
} = {}) {
  const sid = text(accountSid, 80);
  const token = text(authToken, 200);
  const destination = text(to, 40);
  const fromAddr = text(from, 40);
  const accountSidLast4 = sid ? sid.slice(-4) : "";

  if (!sid || !token || !destination || !fromAddr) {
    const log = await writeTwilioLog({
      channel,
      feature: channel,
      purpose,
      source,
      clubLocationId,
      campaignId,
      shoutoutId,
      shiftId,
      actorUid,
      actorEmail,
      to: destination,
      from: fromAddr,
      body,
      status: "dry-run",
      sendOk: false,
      dryRun: true,
      accountSidLast4,
      error: "Twilio credentials or From/To missing — dry-run (no message sent)."
    });
    return {ok: false, dryRun: true, status: "dry-run", error: "Twilio credentials or From/To missing.", ...log};
  }

  if (describeInvalidSid && !describeInvalidSid(sid).looksLikeAccountSid) {
    const error = explainError
      ? explainError("Authentication Error - invalid username", describeInvalidSid(sid))
      : "Authentication Error - invalid username";
    const log = await writeTwilioLog({
      channel,
      feature: channel,
      purpose,
      source,
      clubLocationId,
      campaignId,
      shoutoutId,
      shiftId,
      actorUid,
      actorEmail,
      to: destination,
      from: fromAddr,
      body,
      status: "invalid-sid",
      sendOk: false,
      dryRun: false,
      accountSidLast4,
      error,
      errorCode: "20003"
    });
    return {ok: false, dryRun: false, status: "invalid-sid", error, ...log};
  }

  const path = `/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const params = new URLSearchParams({
    To: destination,
    From: fromAddr,
    Body: String(body || "").slice(0, 1500)
  });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    const {response, payload, tlsProtocol} = await twilioHttpsForm({
      path,
      authHeader: `Basic ${auth}`,
      body: params.toString()
    });
    if (!response.ok) {
      const rawError = text(payload.message || payload.error_message || `HTTP ${response.status}`, 500);
      const error = explainError && describeInvalidSid
        ? explainError(rawError, describeInvalidSid(sid))
        : rawError;
      const log = await writeTwilioLog({
        channel,
        feature: channel,
        purpose,
        source,
        clubLocationId,
        campaignId,
        shoutoutId,
        shiftId,
        actorUid,
        actorEmail,
        to: destination,
        from: fromAddr,
        body,
        status: "failed",
        sendOk: false,
        dryRun: false,
        httpStatus: response.status,
        accountSidLast4,
        error,
        errorCode: text(String(payload.code || payload.error_code || ""), 40),
        tlsProtocol,
        requestHeaders: {host: TWILIO_HOST, path, "content-type": "application/x-www-form-urlencoded", "tls-min": TLS_MIN},
        responseHeaders: {status: String(response.status)}
      });
      return {ok: false, dryRun: false, status: "failed", error, httpStatus: response.status, ...log};
    }

    const providerSid = text(payload.sid, 80);
    const log = await writeTwilioLog({
      channel,
      feature: channel,
      purpose,
      source,
      clubLocationId,
      campaignId,
      shoutoutId,
      shiftId,
      actorUid,
      actorEmail,
      to: destination,
      from: fromAddr,
      body,
      status: "sent",
      sendOk: true,
      dryRun: false,
      httpStatus: response.status,
      providerSid,
      accountSidLast4,
      tlsProtocol,
      requestHeaders: {host: TWILIO_HOST, path, "content-type": "application/x-www-form-urlencoded", "tls-min": TLS_MIN},
      responseHeaders: {status: String(response.status)}
    });
    return {ok: true, dryRun: false, status: "sent", sid: providerSid, ...log};
  } catch (err) {
    const message = text(err?.message || err, 500);
    const log = await writeTwilioLog({
      channel,
      feature: channel,
      purpose,
      source,
      clubLocationId,
      campaignId,
      shoutoutId,
      shiftId,
      actorUid,
      actorEmail,
      to: destination,
      from: fromAddr,
      body,
      status: "failed",
      sendOk: false,
      dryRun: false,
      accountSidLast4,
      error: message
    });
    return {ok: false, dryRun: false, status: "failed", error: message, ...log};
  }
}

function twilioHttpsForm({path, authHeader, body, timeoutMs = 20000}) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(body || "", "utf8");
    const req = https.request({
      hostname: TWILIO_HOST,
      path,
      method: "POST",
      minVersion: TLS_MIN,
      servername: TWILIO_HOST,
      timeout: timeoutMs,
      headers: {
        authorization: authHeader,
        "content-type": "application/x-www-form-urlencoded",
        "content-length": data.length
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let payload = {};
        try { payload = JSON.parse(raw); } catch (_) { payload = {raw: raw.slice(0, 500)}; }
        resolve({
          response: {ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode},
          payload,
          tlsProtocol: res.socket?.getProtocol?.() || ""
        });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Twilio request timed out"));
    });
    req.write(data);
    req.end();
  });
}

module.exports = {
  TLS_MIN,
  LOG_STANDARD,
  COLLECTION_BY_FEATURE,
  COMPLIANCE_COLLECTION,
  maskPhone,
  hashPhone,
  redactSecrets,
  isSecurityRelevant,
  writeTwilioLog,
  sendTwilioMessagesApi,
  featureOf,
  collectionFor
};
