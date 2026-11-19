/* App Check outcomes for Master Admin.
   Diagnostics → Application Logging: appLogs category "app-check".
   Security → Security Logs: appLogs category "security" for a rejected pass.
   Both writes stay in appLogs so Firestore rules do not change.
   Never store the App Check token, dataBase64, the SVG, or the image.
   A missing pass in monitor mode is a warning only — no Security System Message.
   Enforcement on + missing, invalid, or reused uses the same inbox path as a
   display deny (inboxNotifications messageCategory "security"). */
"use strict";

const admin = require("firebase-admin");
const {SERVER_ADMIN_EMAILS} = require("./admin-trust");

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;
const DIAGNOSTIC_CATEGORY = "app-check";
const SECURITY_CATEGORY = "security";
const SECURITY_ACTION = "app-check";
const DIAGNOSTIC_ACTION = "spatial-plan-trace";

function text(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function enforceOn(value) {
  return value === true || value === 1 || value === "1" || value === "on";
}

function safeReason(value) {
  const raw = text(value, 80);
  if (!raw) return "";
  if (raw.split(".").length >= 3 && raw.length > 40) return "invalid";
  return raw;
}

function tokenFields(tokens) {
  if (!tokens || typeof tokens !== "object") return null;
  return {
    promptTokens: Number(tokens.promptTokens) || 0,
    candidateTokens: Number(tokens.candidateTokens) || 0,
    totalTokens: Number(tokens.totalTokens) || 0
  };
}

function isRejected(outcome, enforce) {
  if (outcome === "verified") return false;
  if (enforce) return true;
  return outcome === "app_check_invalid" || outcome === "app_check_reused";
}

function diagnosticLevel(outcome, enforce) {
  if (outcome === "verified") return {level: "info", severity: "info", critical: false};
  if (outcome === "app_check_missing" && !enforce) return {level: "warn", severity: "warn", critical: false};
  return {level: "error", severity: "error", critical: false};
}

function outcomeMessage(outcome, enforce) {
  if (outcome === "verified") return "App Check verified for spatial-plan-trace.";
  if (outcome === "app_check_missing" && !enforce) {
    return "App Check pass missing for spatial-plan-trace. Enforcement is off.";
  }
  if (outcome === "app_check_missing") return "App Check pass missing for spatial-plan-trace. Enforcement is on.";
  if (outcome === "app_check_reused") return "App Check pass reused for spatial-plan-trace.";
  return "App Check pass invalid for spatial-plan-trace.";
}

async function defaultRecipients() {
  const uids = new Set();
  await Promise.all(SERVER_ADMIN_EMAILS.map(async (email) => {
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user?.uid) uids.add(user.uid);
    } catch (_) { /* skip missing admin */ }
  }));
  return [...uids];
}

async function recentlyNotified(db, outcome) {
  const snap = await db.collection("appLogs")
    .where("category", "==", SECURITY_CATEGORY)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  const now = Date.now();
  return snap.docs.some((doc) => {
    const row = doc.data() || {};
    if (row.action !== SECURITY_ACTION) return false;
    const details = row.details || {};
    if (details.outcome !== outcome || details.notified !== true) return false;
    const at = Number(row.createdAtMs || 0);
    return at > 0 && now - at < NOTIFY_COOLDOWN_MS;
  });
}

/**
 * Write the diagnostic row and, when the pass is rejected, the security row.
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} entry operation, outcome, failureReason, appId, enforce, tokens
 */
async function logAppCheckResult(db, entry = {}, deps = {}) {
  const now = Date.now();
  const outcome = text(entry.outcome, 40) || "app_check_invalid";
  const enforce = enforceOn(entry.enforce);
  const failureReason = safeReason(entry.failureReason);
  const appId = text(entry.appId, 120);
  const operation = text(entry.operation, 80) || DIAGNOSTIC_ACTION;
  const counts = tokenFields(entry.tokens);
  const tone = diagnosticLevel(outcome, enforce);
  const message = outcomeMessage(outcome, enforce);
  const details = {
    operation,
    outcome,
    failureReason: failureReason || null,
    appId: appId || null,
    enforce: enforce ? "on" : "off"
  };
  if (counts) {
    details.promptTokens = counts.promptTokens;
    details.candidateTokens = counts.candidateTokens;
    details.totalTokens = counts.totalTokens;
  }

  const base = {
    message,
    uid: "guest",
    email: "",
    source: "functions",
    userAgent: "firebase-functions",
    appVersion: text(entry.appVersion, 40) || "app-check",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: now,
    expireAtMs: now + RETENTION_MS
  };

  let diagnosticId = "";
  try {
    const ref = await db.collection("appLogs").add({
      ...base,
      level: tone.level,
      severity: tone.severity,
      critical: false,
      category: DIAGNOSTIC_CATEGORY,
      action: DIAGNOSTIC_ACTION,
      details
    });
    diagnosticId = ref.id;
  } catch (error) {
    console.error("appLogs app-check write failed", error?.code || "write_failed");
  }

  let securityId = "";
  let notified = false;
  if (!isRejected(outcome, enforce)) {
    return {diagnosticId, securityId, notified, outcome, enforce};
  }

  let sendMessage = enforce && outcome !== "verified";
  if (sendMessage) {
    try {
      const cooled = await recentlyNotified(db, outcome);
      if (cooled) sendMessage = false;
    } catch (error) {
      console.warn("app-check notify lookup failed", error?.code || "lookup_failed");
    }
  }

  try {
    const ref = await db.collection("appLogs").add({
      ...base,
      level: "error",
      severity: "error",
      critical: false,
      category: SECURITY_CATEGORY,
      action: SECURITY_ACTION,
      details: {...details, notified: sendMessage}
    });
    securityId = ref.id;
  } catch (error) {
    console.error("appLogs security app-check write failed", error?.code || "write_failed");
  }

  if (!sendMessage) return {diagnosticId, securityId, notified, outcome, enforce};

  try {
    const resolve = typeof deps.resolveRecipients === "function" ? deps.resolveRecipients : defaultRecipients;
    const recipientUids = await resolve();
    const title = "App Check rejected";
    const body = [
      "Spatial Studio plan trace rejected an App Check pass.",
      `Outcome: ${outcome}.`,
      failureReason ? `Reason: ${failureReason}.` : "",
      "Enforcement is on.",
      "Open Master Admin → Security → Security Logs."
    ].filter(Boolean).join(" ");
    const note = {
      type: "appCheckRejected",
      messageCategory: "security",
      title,
      subject: title,
      body,
      denialReason: outcome,
      failureReason: failureReason || "",
      appId: appId || "",
      operation,
      accessLogId: securityId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: now,
      link: "./master-admin.html#securityLogs"
    };
    const uids = [...new Set((recipientUids || []).map((uid) => text(uid, 128)).filter(Boolean))];
    await Promise.all(uids.map((uid) => db.collection("inboxNotifications").add({...note, recipientUid: uid})));
    notified = uids.length > 0;
  } catch (error) {
    console.error("app-check security message failed", error?.code || "notify_failed");
  }

  return {diagnosticId, securityId, notified, outcome, enforce};
}

module.exports = {
  DIAGNOSTIC_CATEGORY,
  SECURITY_CATEGORY,
  SECURITY_ACTION,
  DIAGNOSTIC_ACTION,
  logAppCheckResult,
  isRejected,
  diagnosticLevel
};
