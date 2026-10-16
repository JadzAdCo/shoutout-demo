/**
 * FLOQR system mail: SendGrid send + Firestore Mail Logging.
 * Security event (ISO/IEC 27001:2022 A.8.15): 90-day — outcome, TLS, masked recipient, hashes.
 * Diagnostic evidence (headers/body): 30-day, then stripped. No PCI; PII minimized.
 * API calls to SendGrid request TLS 1.3 (minVersion). Recipient hop uses SendGrid Enforced TLS.
 */
"use strict";

const https = require("https");
const crypto = require("crypto");
const admin = require("firebase-admin");
const {redactSecrets, plainPreview} = require("./secret-redaction");

const SENDGRID_HOST = "api.sendgrid.com";
const MAIL_SEND_PATH = "/v3/mail/send";
const ENFORCED_TLS_PATH = "/v3/user/settings/enforced_tls";
const TLS_MIN = "TLSv1.3";
const COLLECTION = "systemMailLogs";
const TEXT_MAX = 12000;
const HTML_MAX = 16000;
const HEADER_VAL_MAX = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const DIAGNOSTIC_RETENTION_MS = 30 * DAY_MS;
const SECURITY_RETENTION_MS = 90 * DAY_MS;
const EMAIL_HASH_PREFIX = "floqr-mail:";
const LOG_STANDARD = "ISO/IEC 27001:2022 A.8.15";

let enforcedTlsCache = {atMs: 0, value: null};

function db() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

function text(value, max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function emailsOf(to) {
  const list = Array.isArray(to) ? to : [to];
  return [...new Set(list.map((row) => {
    if (row && typeof row === "object") return text(row.email || row.to, 200).toLowerCase();
    return text(row, 200).toLowerCase();
  }).filter((v) => v.includes("@")))];
}

function stripPci(value) {
  return String(value == null ? "" : value)
    .replace(/\b(?:\d[ \-]*?){13,19}\b/g, "[card redacted]")
    .replace(/\b(cvv|cvc|cid)\s*[:#]?\s*\d{3,4}\b/gi, "$1 [redacted]");
}

function maskEmail(email) {
  const raw = text(email, 200).toLowerCase();
  const at = raw.indexOf("@");
  if (at < 1) return "***";
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const localMask = `${local.slice(0, 1)}***`;
  const parts = domain.split(".");
  const host = parts[0] || "";
  const rest = parts.slice(1).join(".");
  return rest ? `${localMask}@${host.slice(0, 1)}***.${rest}` : `${localMask}@${host.slice(0, 1)}***`;
}

function hashEmail(email) {
  return crypto.createHash("sha256")
    .update(`${EMAIL_HASH_PREFIX}${text(email, 200).toLowerCase()}`)
    .digest("hex");
}

function emailDomain(email) {
  const raw = text(email, 200).toLowerCase();
  const at = raw.indexOf("@");
  return at > 0 ? raw.slice(at + 1) : "";
}

function sanitizeBody(value, redactBody) {
  return redactBody ? "" : redactSecrets(stripPci(value));
}

function clip(value, max) {
  const raw = String(value == null ? "" : value);
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}\n…[truncated ${raw.length - max} chars]`;
}

function headerMap(headers = {}) {
  const out = {};
  Object.entries(headers || {}).forEach(([key, val]) => {
    const name = String(key || "");
    if (!name) return;
    if (/^authorization$/i.test(name)) {
      out[name] = "Bearer [redacted]";
      return;
    }
    const joined = Array.isArray(val) ? val.join(", ") : String(val == null ? "" : val);
    out[name] = text(joined, HEADER_VAL_MAX);
  });
  return out;
}

function httpsJson({path, method = "GET", apiKey, payload, timeoutMs = 20000}) {
  return new Promise((resolve, reject) => {
    const data = payload === undefined ? null : Buffer.from(JSON.stringify(payload), "utf8");
    const req = https.request({
      hostname: SENDGRID_HOST,
      path,
      method,
      minVersion: TLS_MIN,
      servername: SENDGRID_HOST,
      timeout: timeoutMs,
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        ...(data ? {"content-type": "application/json", "content-length": String(data.length)} : {})
      }
    }, (res) => {
      const tlsProtocol = (res.socket && typeof res.socket.getProtocol === "function")
        ? String(res.socket.getProtocol() || "")
        : "";
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: Number(res.statusCode || 0),
          headers: res.headers || {},
          body: Buffer.concat(chunks).toString("utf8"),
          tlsProtocol
        });
      });
    });
    req.on("timeout", () => req.destroy(new Error("SendGrid TLS/HTTPS timeout")));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function readEnforcedTls(apiKey) {
  const now = Date.now();
  if (enforcedTlsCache.value && (now - enforcedTlsCache.atMs) < 30 * 60 * 1000) {
    return enforcedTlsCache.value;
  }
  try {
    const res = await httpsJson({path: ENFORCED_TLS_PATH, method: "GET", apiKey});
    let parsed = {};
    try { parsed = JSON.parse(res.body || "{}"); } catch (_) { parsed = {}; }
    const value = {
      ok: res.status >= 200 && res.status < 300,
      httpStatus: res.status,
      requireTls: parsed.require_tls === true,
      requireValidCert: parsed.require_valid_cert === true,
      version: parsed.version != null ? String(parsed.version) : "",
      tlsProtocol: res.tlsProtocol || "",
      error: res.status >= 300 ? text(res.body, 300) : ""
    };
    enforcedTlsCache = {atMs: now, value};
    return value;
  } catch (err) {
    return {ok: false, error: text(err?.message || err, 300), requireTls: false};
  }
}

async function ensureEnforcedTls(apiKey) {
  const current = await readEnforcedTls(apiKey);
  if (current.ok && current.requireTls && current.requireValidCert) return current;
  try {
    const res = await httpsJson({
      path: ENFORCED_TLS_PATH,
      method: "PATCH",
      apiKey,
      payload: {require_tls: true, require_valid_cert: true}
    });
    enforcedTlsCache = {atMs: 0, value: null};
    const next = await readEnforcedTls(apiKey);
    next.patchStatus = res.status;
    next.patchBody = text(res.body, 300);
    return next;
  } catch (err) {
    return {...current, patchError: text(err?.message || err, 300)};
  }
}

async function writeLog(id, payload, merge = true) {
  await db().collection(COLLECTION).doc(id).set(payload, {merge});
}

function newMailLogId() {
  return `mail_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}

function deliveryRank(status) {
  const order = {
    sending: 0,
    queued: 1,
    accepted: 2,
    processed: 3,
    delivered: 4,
    deferred: 5,
    dropped: 6,
    bounced: 7,
    blocked: 8,
    failed: 9,
    complained: 6
  };
  return order[String(status || "")] ?? 1;
}

function mergeDeliveryStatus(current, incoming) {
  if (deliveryRank(incoming) >= deliveryRank(current)) return incoming;
  return current;
}

/**
 * Send a system email via SendGrid over TLS 1.3 and persist a Mail Logging row.
 * Codes are masked in every stored subject/body. With redactBody (OTP / SOS2FA) the body
 * is not stored at all: only bodyTemplateId + a masked bodyPreview. PAN-like digit runs are stripped.
 */
async function sendSystemMail({
  apiKey,
  kind = "system",
  source = "sendSystemMail",
  trigger = "function",
  to,
  from,
  fromName = "FLOQR",
  replyTo,
  subject,
  textBody = "",
  htmlBody = "",
  packageVersion = "",
  extra = {},
  redactBody = false,
  templateId = "",
  attachments = []
} = {}) {
  const mailLogId = newMailLogId();
  const recipients = emailsOf(to);
  const fromEmail = text(from, 200).toLowerCase();
  const now = Date.now();
  const storeText = sanitizeBody(textBody, redactBody);
  const storeHtml = sanitizeBody(htmlBody, redactBody);
  const bodyPreview = redactBody ? plainPreview(stripPci(textBody || htmlBody)) : "";
  const attachmentNames = (attachments || []).map((row) => text(row.filename || row.name, 120)).filter(Boolean);
  const extraIn = extra && typeof extra === "object" ? extra : {};
  const sourceIp = text(extraIn.ip || extraIn.sourceIp, 80);
  const userAgent = text(extraIn.userAgent || extraIn.ua, 300);
  const requestHeaders = {
    host: SENDGRID_HOST,
    path: MAIL_SEND_PATH,
    "content-type": "application/json",
    "tls-min": TLS_MIN,
    "x-floqr-mail-log-id": mailLogId
  };

  const baseLog = {
    logClass: "security",
    logStandard: LOG_STANDARD,
    piiMinimized: true,
    pciExcluded: true,
    kind: text(kind, 80),
    source: text(source, 120),
    trigger: text(trigger, 40),
    toMasked: recipients.map(maskEmail),
    toHashes: recipients.map(hashEmail),
    toDomains: [...new Set(recipients.map(emailDomain).filter(Boolean))],
    fromMasked: maskEmail(fromEmail),
    fromHash: fromEmail ? hashEmail(fromEmail) : "",
    subject: text(redactSecrets(stripPci(subject)), 300),
    bodyRedacted: !!redactBody,
    bodyStored: !redactBody,
    bodyTemplateId: text(templateId || kind, 80),
    bodyPreview,
    attachmentNames,
    packageVersion: text(packageVersion, 40),
    status: "sending",
    sendOk: false,
    httpStatus: 0,
    sendgridMessageId: "",
    tlsMinRequested: TLS_MIN,
    tlsProtocol: "",
    tlsApiOk: false,
    enforcedTls: {},
    sourceIp,
    userAgent,
    diagnosticExpireAtMs: now + DIAGNOSTIC_RETENTION_MS,
    securityExpireAtMs: now + SECURITY_RETENTION_MS,
    diagnosticPurged: false,
    diagnostic: {
      to: recipients,
      from: fromEmail,
      textBody: clip(storeText, TEXT_MAX),
      htmlBody: clip(storeHtml, HTML_MAX),
      requestHeaders,
      responseHeaders: {},
      extra: {ip: sourceIp, userAgent}
    },
    events: [],
    error: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: now,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAtMs: now
  };

  try {
    await writeLog(mailLogId, baseLog, false);
  } catch (err) {
    console.error("systemMailLogs create failed", err?.message || err);
  }

  if (!apiKey) {
    const error = "SENDGRID_API_KEY missing";
    await writeLog(mailLogId, {
      status: "failed",
      sendOk: false,
      error,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(() => {});
    const err = new Error(error);
    err.code = "missing-key";
    err.mailLogId = mailLogId;
    throw err;
  }

  if (!recipients.length || !fromEmail || !subject) {
    const error = "Mail missing to, from, or subject";
    await writeLog(mailLogId, {
      status: "failed",
      sendOk: false,
      error,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(() => {});
    const err = new Error(error);
    err.mailLogId = mailLogId;
    throw err;
  }

  let enforcedTls = {};
  try {
    enforcedTls = await ensureEnforcedTls(apiKey);
  } catch (err) {
    enforcedTls = {ok: false, error: text(err?.message || err, 300)};
  }

  const payload = {
    personalizations: [{
      to: recipients.map((email) => ({email})),
      custom_args: {
        floqrMailLogId: mailLogId,
        floqrKind: text(kind, 80)
      }
    }],
    from: {email: fromEmail, name: text(fromName, 80) || "FLOQR"},
    reply_to: {email: text(replyTo || fromEmail, 200)},
    subject: String(subject || ""),
    categories: ["floqr-system", text(kind, 40) || "system"].slice(0, 10),
    content: [
      {type: "text/plain", value: String(textBody || subject || " ")},
      ...(htmlBody ? [{type: "text/html", value: String(htmlBody)}] : [])
    ]
  };
  if (attachmentNames.length) {
    payload.attachments = attachments.map((row) => ({
      content: row.content,
      filename: row.filename,
      type: row.type || "application/octet-stream",
      disposition: row.disposition || "attachment"
    })).filter((row) => row.content && row.filename);
  }

  try {
    const res = await httpsJson({
      path: MAIL_SEND_PATH,
      method: "POST",
      apiKey,
      payload
    });
    const ok = res.status === 202 || (res.status >= 200 && res.status < 300);
    const sendgridMessageId = text(res.headers["x-message-id"] || res.headers["X-Message-Id"], 200);
    const tlsApiOk = String(res.tlsProtocol || "").toUpperCase().includes("TLSV1.3")
      || String(res.tlsProtocol || "").includes("1.3");
    const error = ok ? "" : text(res.body, 500);
    await writeLog(mailLogId, {
      status: ok ? "accepted" : "failed",
      sendOk: ok,
      httpStatus: res.status,
      sendgridMessageId,
      tlsProtocol: res.tlsProtocol || "",
      tlsApiOk,
      enforcedTls,
      "diagnostic.responseHeaders": headerMap(res.headers),
      error,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtMs: Date.now()
    });
    if (!ok) {
      const err = new Error(error || `SendGrid ${res.status}`);
      err.status = res.status;
      err.mailLogId = mailLogId;
      throw err;
    }
    return {
      ok: true,
      status: res.status,
      mailLogId,
      sendgridMessageId,
      tlsProtocol: res.tlsProtocol || "",
      tlsMinRequested: TLS_MIN,
      tlsApiOk,
      enforcedTls
    };
  } catch (err) {
    if (err && err.mailLogId) throw err;
    const error = text(err?.message || err, 500);
    await writeLog(mailLogId, {
      status: "failed",
      sendOk: false,
      error,
      enforcedTls,
      tlsProtocol: "",
      tlsApiOk: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtMs: Date.now()
    }).catch(() => {});
    const wrapped = new Error(error);
    wrapped.mailLogId = mailLogId;
    wrapped.code = err?.code;
    throw wrapped;
  }
}

async function applyMailEvents(events = []) {
  const list = Array.isArray(events) ? events : [];
  let updated = 0;
  for (const raw of list.slice(0, 200)) {
    const eventName = text(raw.event || raw.status, 40).toLowerCase();
    const mailLogId = text(
      raw.floqrMailLogId
      || raw.custom_args?.floqrMailLogId
      || raw.unique_args?.floqrMailLogId,
      80
    );
    const sgId = text(raw.sg_message_id, 200);
    let ref = null;
    if (mailLogId) ref = db().collection(COLLECTION).doc(mailLogId);
    else if (sgId) {
      const snap = await db().collection(COLLECTION)
        .where("sendgridMessageId", "==", sgId.split(".")[0] || sgId)
        .limit(1)
        .get();
      if (!snap.empty) ref = snap.docs[0].ref;
    }
    if (!ref) continue;
    const mapped = (
      eventName === "delivered" ? "delivered"
        : eventName === "processed" ? "processed"
          : eventName === "bounce" ? "bounced"
            : eventName === "dropped" ? "dropped"
              : eventName === "deferred" ? "deferred"
                : eventName === "blocked" ? "blocked"
                  : eventName === "failed" ? "failed"
                    : (eventName === "spamreport" || eventName === "unsubscribe" || eventName === "group_unsubscribe") ? "complained"
                      : ""
    );
    const eventEmail = text(raw.email, 200).toLowerCase();
    const eventRow = {
      event: eventName,
      emailMasked: eventEmail ? maskEmail(eventEmail) : "",
      emailHash: eventEmail ? hashEmail(eventEmail) : "",
      timestamp: Number(raw.timestamp || 0) || Date.now(),
      reason: text(stripPci(raw.reason || raw.response || raw.status), 400),
      sgMessageId: sgId,
      tls: text(raw.tls, 40),
      ip: text(raw.ip, 80)
    };
    const snap = await ref.get();
    const current = snap.exists ? snap.data() || {} : {};
    const eventsOut = Array.isArray(current.events) ? current.events.slice(-39) : [];
    eventsOut.push(eventRow);
    const nextStatus = mapped ? mergeDeliveryStatus(current.status || "accepted", mapped) : (current.status || "accepted");
    await ref.set({
      status: nextStatus,
      lastEvent: eventName,
      lastEventAtMs: eventRow.timestamp,
      events: eventsOut,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtMs: Date.now()
    }, {merge: true});
    updated += 1;
  }
  return {ok: true, received: list.length, updated};
}

function maskStoredEvents(events) {
  return (Array.isArray(events) ? events : []).map((ev) => {
    const email = text(ev.email, 200).toLowerCase();
    return {
      event: text(ev.event, 40),
      emailMasked: ev.emailMasked || (email ? maskEmail(email) : ""),
      emailHash: ev.emailHash || (email ? hashEmail(email) : ""),
      timestamp: Number(ev.timestamp || 0),
      reason: text(stripPci(ev.reason), 400),
      sgMessageId: text(ev.sgMessageId, 200),
      tls: text(ev.tls, 40),
      ip: text(ev.ip, 80)
    };
  });
}

/**
 * After 30 days, drop diagnostic evidence (bodies, headers, plaintext addresses).
 * Keep the ISO 27001 security event until 90-day deletion.
 */
async function stripExpiredMailDiagnostics(now = Date.now(), batchLimit = 400) {
  const cutoff = now - DIAGNOSTIC_RETENTION_MS;
  const snap = await db().collection(COLLECTION)
    .where("createdAtMs", "<", cutoff)
    .orderBy("createdAtMs", "asc")
    .limit(batchLimit)
    .get();
  if (snap.empty) return 0;
  const batch = db().batch();
  let count = 0;
  snap.docs.forEach((doc) => {
    const row = doc.data() || {};
    const already = row.diagnosticPurged === true
      && !row.diagnostic
      && row.textBody == null
      && row.htmlBody == null
      && row.to == null;
    if (already) return;
    batch.set(doc.ref, {
      diagnosticPurged: true,
      diagnosticPurgedAtMs: now,
      diagnostic: admin.firestore.FieldValue.delete(),
      textBody: admin.firestore.FieldValue.delete(),
      htmlBody: admin.firestore.FieldValue.delete(),
      requestHeaders: admin.firestore.FieldValue.delete(),
      responseHeaders: admin.firestore.FieldValue.delete(),
      extra: admin.firestore.FieldValue.delete(),
      to: admin.firestore.FieldValue.delete(),
      toLower: admin.firestore.FieldValue.delete(),
      from: admin.firestore.FieldValue.delete(),
      events: maskStoredEvents(row.events),
      toMasked: Array.isArray(row.toMasked) && row.toMasked.length
        ? row.toMasked
        : emailsOf(row.to || row.toLower).map(maskEmail),
      toHashes: Array.isArray(row.toHashes) && row.toHashes.length
        ? row.toHashes
        : emailsOf(row.to || row.toLower).map(hashEmail),
      fromMasked: row.fromMasked || (row.from ? maskEmail(row.from) : ""),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtMs: now
    }, {merge: true});
    count += 1;
  });
  if (count) await batch.commit();
  return count;
}

module.exports = {
  COLLECTION,
  TLS_MIN,
  DIAGNOSTIC_RETENTION_MS,
  SECURITY_RETENTION_MS,
  EMAIL_HASH_PREFIX,
  LOG_STANDARD,
  sendSystemMail,
  applyMailEvents,
  stripExpiredMailDiagnostics,
  redactSecrets,
  stripPci,
  maskEmail,
  hashEmail,
  emailsOf,
  httpsJson
};
