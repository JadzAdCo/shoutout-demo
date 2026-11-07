/**
 * Gemini API access audit — success + failure with reason.
 * Collection: geminiApiAccessLogs (Functions-write; Master Admin / FloqR Admin read).
 * Mirrored into appLogs category "gemini" for Application Logging.
 * Retention: 30 days (expireAtMs + purgeLogRetention / expireAtMs sweeper).
 */
"use strict";

const admin = require("firebase-admin");

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const COLLECTION = "geminiApiAccessLogs";

function text(value, max = 400) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} entry
 */
async function logGeminiApiAccess(db, entry = {}) {
  const now = Date.now();
  const outcome = entry.ok === true || entry.outcome === "success" ? "success" : "failure";
  const level = outcome === "success" ? "info" : "error";
  const operation = text(entry.operation || entry.enhancementType || "gemini", 80) || "gemini";
  const failureReason = outcome === "failure"
    ? text(entry.failureReason || entry.reason || entry.errorMessage || entry.message || "Unknown Gemini API failure", 1000)
    : "";
  const message = outcome === "success"
    ? text(entry.message || `Gemini ${operation} succeeded`, 2000)
    : text(entry.message || `Gemini ${operation} failed: ${failureReason}`, 2000);

  const record = {
    outcome,
    ok: outcome === "success",
    level,
    // Failures are critical logs — Master Admin Application Logging tab must flash.
    severity: outcome === "failure" ? "critical" : "info",
    critical: outcome === "failure",
    category: "gemini",
    operation,
    enhancementType: text(entry.enhancementType || "", 80),
    provider: text(entry.provider || "gemini", 40) || "gemini",
    model: text(entry.model || "", 80),
    message,
    failureReason: failureReason || null,
    errorCode: text(entry.errorCode || "", 80) || null,
    uid: text(entry.uid || "system", 128) || "system",
    email: text(entry.email || "", 200),
    mediaStoragePath: text(entry.mediaStoragePath || "", 500) || null,
    referenceNumber: text(entry.referenceNumber || "", 120) || null,
    details: entry.details && typeof entry.details === "object" ? entry.details : null,
    source: text(entry.source || "functions", 40) || "functions",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: now,
    createdAtIso: new Date(now).toISOString(),
    expireAtMs: now + RETENTION_MS,
    retentionDays: 30
  };

  let accessLogId = "";
  try {
    const ref = await db.collection(COLLECTION).add(record);
    accessLogId = ref.id;
  } catch (error) {
    console.error("geminiApiAccessLogs write failed", error?.message || error);
  }

  try {
    await db.collection("appLogs").add({
      level,
      severity: record.severity,
      critical: record.critical,
      category: "gemini",
      action: operation,
      message,
      details: {
        outcome,
        failureReason: failureReason || undefined,
        errorCode: record.errorCode || undefined,
        model: record.model || undefined,
        enhancementType: record.enhancementType || undefined,
        mediaStoragePath: record.mediaStoragePath || undefined,
        geminiApiAccessLogId: accessLogId || undefined,
        severity: record.severity,
        ...(record.details || {})
      },
      uid: record.uid,
      email: record.email,
      source: "functions",
      userAgent: "firebase-functions",
      appVersion: text(entry.appVersion || "s3.2.90", 40),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: now,
      expireAtMs: now + RETENTION_MS
    });
  } catch (error) {
    console.error("appLogs gemini mirror failed", error?.message || error);
  }

  return {id: accessLogId, outcome, failureReason};
}

/**
 * Hourly: if any Gemini failures in the last ~70 minutes, inbox Master Admins
 * (and FloqR Admins when present) with failure reasons.
 */
async function notifyGeminiFailuresLastHour(db, {
  masterAdminEmails = [],
  lookbackMs = 70 * 60 * 1000
} = {}) {
  const sinceMs = Date.now() - lookbackMs;
  const snap = await db.collection(COLLECTION)
    .where("outcome", "==", "failure")
    .where("createdAtMs", ">=", sinceMs)
    .orderBy("createdAtMs", "desc")
    .limit(40)
    .get();
  if (snap.empty) {
    return {notified: false, failureCount: 0, reason: "none"};
  }

  const rows = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
  const reasons = [...new Set(rows.map(r => String(r.failureReason || r.message || "unknown").slice(0, 180)))].slice(0, 8);
  const title = `Gemini API failures (${rows.length}) in the last hour`;
  const body = [
    `${rows.length} Gemini API call(s) failed in the last ~70 minutes.`,
    "Open Master Admin → Diagnostics → Application Logging (category gemini) or Gemini API Access.",
    "Failure reasons:",
    ...reasons.map((r, i) => `${i + 1}. ${r}`)
  ].join("\n");
  const link = "./master-admin.html#appLogging";

  const recipientUids = new Set();
  const emailList = (masterAdminEmails || []).map(e => String(e || "").trim().toLowerCase()).filter(Boolean);
  for (const email of emailList) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user?.uid) recipientUids.add(user.uid);
    } catch (_) { /* skip missing */ }
  }
  try {
    const admins = await db.collection("floqrAdmins").where("status", "==", "active").limit(40).get();
    admins.docs.forEach(doc => recipientUids.add(doc.id));
  } catch (_) { /* optional RBAC roster */ }

  let notified = 0;
  await Promise.all([...recipientUids].map(async uid => {
    try {
      await db.collection("inboxNotifications").add({
        recipientUid: uid,
        type: "geminiApiFailure",
        title: title.slice(0, 120),
        body: body.slice(0, 1800),
        link,
        failureCount: rows.length,
        failureReasons: reasons,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAtMs: Date.now()
      });
      notified += 1;
    } catch (error) {
      console.warn("gemini failure inbox notify failed", error?.message || error);
    }
  }));

  return {notified: notified > 0, failureCount: rows.length, inboxRecipients: notified, reasons};
}

module.exports = {
  COLLECTION,
  RETENTION_MS,
  logGeminiApiAccess,
  notifyGeminiFailuresLastHour
};
