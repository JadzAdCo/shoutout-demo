/**
 * ShoutOut compliance logging (SOC 2 / ISO 27001 / NIST AU / GDPR-aligned).
 * Design notes: .cursor/rules/design-notes-master-admin-shoutouts.mdc
 *
 * - shoutoutComplianceLogs: Master Admin searchable audit metadata (7 years)
 * - Media blobs deleted after 90 days (not forever-archived)
 * - shoutoutAudit remains append-only event stream
 */
const crypto = require("crypto");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

const AUDIT_RETENTION_YEARS = 7;
const MEDIA_RETENTION_DAYS = 90;
const COMPLETED_STATUSES = new Set([
  "approved", "live", "playing", "displayed", "completed", "done", "finished",
  "ended", "expired", "played", "archived", "refunded", "rejected", "cancelled", "canceled"
]);

function text(value, max = 240) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function emailOf(authContext = {}) {
  return text(authContext.token?.email, 200).toLowerCase();
}

function assertMasterAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const email = emailOf(request.auth);
  if (request.auth.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email)) return email;
  throw new HttpsError("permission-denied", "Master Admin access is required.");
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(ms, days) {
  return ms + days * 24 * 60 * 60 * 1000;
}

function addYears(ms, years) {
  const d = new Date(ms);
  d.setFullYear(d.getFullYear() + years);
  return d.getTime();
}

function contentHash(mainText, subText, shoutoutId) {
  return crypto
    .createHash("sha256")
    .update(`${shoutoutId}|${mainText}|${subText}`)
    .digest("hex")
    .slice(0, 32);
}

function storagePathFromUrl(url) {
  const raw = text(url, 2000);
  if (!raw) return "";
  try {
    const decoded = decodeURIComponent(raw);
    const marker = "/o/";
    const idx = decoded.indexOf(marker);
    if (idx < 0) return "";
    return decoded.slice(idx + marker.length).split("?")[0] || "";
  } catch (_e) {
    return "";
  }
}

function buildComplianceRecord(shoutoutId, data = {}) {
  const status = text(data.status || "pending", 40).toLowerCase();
  const mainText = text(data.mainText || data.main || "", 200);
  const subText = text(data.subText || data.sub || "", 80);
  const venueName = text(data.locationName || data.clubName || data.venueName || "", 160);
  const clubLocationId = text(data.clubLocationId || data.location || "", 120);
  const mediaUrl = text(data.mediaUrl || data.photoUrl || data.imageUrl || "", 2000);
  const hasMedia = !!(mediaUrl || data.hasMedia);
  const submittedMs = toMillis(data.submittedAt) || toMillis(data.createdAt) || Date.now();
  const paidMs = toMillis(data.paidAt);
  const approvedMs = toMillis(data.approvedAt) || toMillis(data.completedAt);
  const completedMs = toMillis(data.completedAt) || toMillis(data.endedAt) || approvedMs || paidMs || submittedMs;
  const eventAtMs = Math.max(completedMs, approvedMs, paidMs, submittedMs);
  const isTerminal = COMPLETED_STATUSES.has(status) || text(data.paymentStatus, 40).toLowerCase() === "paid";
  const mediaRetentionUntilMs = isTerminal && hasMedia
    ? addDays(completedMs || eventAtMs, MEDIA_RETENTION_DAYS)
    : 0;
  const retentionUntilMs = addYears(eventAtMs || Date.now(), AUDIT_RETENTION_YEARS);
  const searchBlob = `${venueName} ${mainText} ${subText} ${clubLocationId} ${text(data.referenceNumber, 80)}`.toLowerCase();

  return {
    shoutoutId: text(shoutoutId, 120),
    referenceNumber: text(data.referenceNumber, 80),
    serviceOrderId: text(data.serviceOrderId, 120),
    venueName,
    venueNameLower: venueName.toLowerCase(),
    clubLocationId,
    locationLabel: text(data.locationLabel || "", 160),
    mainText,
    mainTextLower: mainText.toLowerCase(),
    subText,
    searchBlob,
    template: text(data.template || data.templateId || "", 80),
    templateName: text(data.templateName || "", 120),
    status,
    paymentStatus: text(data.paymentStatus || "", 40).toLowerCase(),
    amountCents: Number(data.amountCents || 0) || 0,
    submittedByUid: text(data.submittedByUid || data.ownerUid || "", 128),
    approvedByUid: text(data.approvedByUid || "", 128),
    rejectedByUid: text(data.rejectedByUid || "", 128),
    submittedAt: data.submittedAt || null,
    paidAt: data.paidAt || null,
    approvedAt: data.approvedAt || null,
    completedAt: data.completedAt || data.endedAt || null,
    rejectedAt: data.rejectedAt || null,
    eventAt: admin.firestore.Timestamp.fromMillis(eventAtMs || Date.now()),
    eventAtMs: eventAtMs || Date.now(),
    hasMedia,
    mediaUrl: hasMedia ? mediaUrl : "",
    mediaType: text(data.mediaType || "", 40),
    mediaStoragePath: text(data.mediaStoragePath || storagePathFromUrl(mediaUrl), 500),
    mediaRetentionUntil: mediaRetentionUntilMs
      ? admin.firestore.Timestamp.fromMillis(mediaRetentionUntilMs)
      : null,
    mediaRetentionUntilMs: mediaRetentionUntilMs || 0,
    mediaPurgedAt: data.mediaPurgedAt || null,
    mediaPurgeStatus: text(data.mediaPurgeStatus || (hasMedia ? "pending" : "none"), 40),
    retentionUntil: admin.firestore.Timestamp.fromMillis(retentionUntilMs),
    retentionUntilMs,
    legalHold: !!data.legalHold,
    contentHash: contentHash(mainText, subText, shoutoutId),
    anonymized: !!data.anonymized,
    complianceVersion: "s3.0.66",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

async function upsertComplianceLog(shoutoutId, data = {}, options = {}) {
  const id = text(shoutoutId, 120);
  if (!id) return null;
  const ref = db.collection("shoutoutComplianceLogs").doc(id);
  const existing = await ref.get();
  const prev = existing.exists ? existing.data() || {} : {};
  if (prev.legalHold && options.force !== true && options.purgeMedia) {
    return {id, skipped: "legal-hold"};
  }
  const merged = {
    ...prev,
    ...data,
    legalHold: options.legalHold != null ? !!options.legalHold : !!prev.legalHold,
    mediaPurgedAt: options.clearMedia ? admin.firestore.FieldValue.serverTimestamp() : (data.mediaPurgedAt || prev.mediaPurgedAt || null),
    mediaPurgeStatus: options.clearMedia ? "purged" : (data.mediaPurgeStatus || prev.mediaPurgeStatus || ""),
    mediaUrl: options.clearMedia ? "" : (data.mediaUrl || prev.mediaUrl || ""),
    anonymized: options.anonymize ? true : !!prev.anonymized
  };
  if (options.anonymize) {
    merged.mainText = "[redacted]";
    merged.subText = "";
    merged.mainTextLower = "[redacted]";
    merged.submittedByUid = "";
    merged.approvedByUid = merged.approvedByUid ? "[redacted]" : "";
    merged.rejectedByUid = merged.rejectedByUid ? "[redacted]" : "";
    merged.searchBlob = `${merged.venueName || ""} ${merged.clubLocationId || ""} ${merged.referenceNumber || ""}`.toLowerCase();
    merged.mediaUrl = "";
    merged.hasMedia = false;
  }
  const record = buildComplianceRecord(id, merged);
  if (!existing.exists) {
    record.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  if (options.clearMedia) {
    record.mediaUrl = "";
    record.hasMedia = false;
    record.mediaPurgeStatus = "purged";
    record.mediaPurgedAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await ref.set(record, {merge: true});
  return {id, record};
}

async function appendAudit(shoutoutId, action, extra = {}) {
  await db.collection("shoutoutAudit").add({
    shoutoutId: text(shoutoutId, 120),
    action: text(action, 60),
    referenceNumber: text(extra.referenceNumber, 80),
    clubLocationId: text(extra.clubLocationId, 120),
    ownerUid: text(extra.ownerUid || extra.submittedByUid, 128),
    actorUid: text(extra.actorUid, 128),
    actorEmail: text(extra.actorEmail, 200).toLowerCase(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function deleteMediaPath(path) {
  const objectPath = text(path, 500);
  if (!objectPath) return false;
  if (!objectPath.startsWith("shoutouts/")) return false;
  try {
    await storage.bucket().file(objectPath).delete({ignoreNotFound: true});
    return true;
  } catch (err) {
    console.warn("media purge failed", objectPath, err?.message || err);
    return false;
  }
}

const onShoutoutComplianceWrite = onDocumentWritten("shoutouts/{shoutoutId}", async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const shoutoutId = event.params.shoutoutId;
  const data = after.data() || {};
  const status = text(data.status, 40).toLowerCase();
  const payment = text(data.paymentStatus, 40).toLowerCase();
  // Index paid / completed / approved / rejected (compliance evidence). Skip pure drafts.
  if (!COMPLETED_STATUSES.has(status) && payment !== "paid" && status !== "pending_approval") return;
  await upsertComplianceLog(shoutoutId, data);
});

const purgeExpiredShoutoutMedia = onSchedule({
  schedule: "every 24 hours",
  timeZone: "America/New_York"
}, async () => {
  const now = Date.now();
  const snap = await db.collection("shoutoutComplianceLogs")
    .where("mediaPurgeStatus", "==", "pending")
    .where("mediaRetentionUntilMs", ">", 0)
    .where("mediaRetentionUntilMs", "<=", now)
    .limit(200)
    .get();
  let purged = 0;
  for (const doc of snap.docs) {
    const row = doc.data() || {};
    if (row.legalHold) continue;
    await deleteMediaPath(row.mediaStoragePath || storagePathFromUrl(row.mediaUrl));
    await upsertComplianceLog(doc.id, row, {clearMedia: true});
    await appendAudit(doc.id, "media_purged", {
      referenceNumber: row.referenceNumber,
      clubLocationId: row.clubLocationId,
      ownerUid: row.submittedByUid,
      actorUid: "system",
      actorEmail: "system@floqr"
    });
    purged += 1;
  }
  await db.collection("shoutoutComplianceMeta").doc("retention").set({
    lastMediaPurgeAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMediaPurgeCount: purged,
    mediaRetentionDays: MEDIA_RETENTION_DAYS,
    auditRetentionYears: AUDIT_RETENTION_YEARS,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  return {purged};
});

const anonymizeExpiredComplianceLogs = onSchedule({
  schedule: "every 168 hours",
  timeZone: "America/New_York"
}, async () => {
  const now = Date.now();
  const snap = await db.collection("shoutoutComplianceLogs")
    .where("anonymized", "==", false)
    .where("retentionUntilMs", "<=", now)
    .limit(100)
    .get();
  let count = 0;
  for (const doc of snap.docs) {
    const row = doc.data() || {};
    if (row.legalHold) continue;
    await upsertComplianceLog(doc.id, row, {anonymize: true, clearMedia: true});
    await appendAudit(doc.id, "anonymized", {
      referenceNumber: row.referenceNumber,
      clubLocationId: row.clubLocationId,
      actorUid: "system",
      actorEmail: "system@floqr"
    });
    count += 1;
  }
  await db.collection("shoutoutComplianceMeta").doc("retention").set({
    lastAnonymizeAt: admin.firestore.FieldValue.serverTimestamp(),
    lastAnonymizeCount: count,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  return {count};
});

const backfillShoutoutComplianceLogs = onCall({region: "us-central1"}, async (request) => {
  assertMasterAdmin(request);
  const limit = Math.min(500, Math.max(1, Number(request.data?.limit || 200)));
  const snap = await db.collection("shoutouts").orderBy("submittedAt", "desc").limit(limit).get().catch(async () => {
    return db.collection("shoutouts").limit(limit).get();
  });
  let written = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const status = text(data.status, 40).toLowerCase();
    const payment = text(data.paymentStatus, 40).toLowerCase();
    if (!COMPLETED_STATUSES.has(status) && payment !== "paid") continue;
    await upsertComplianceLog(doc.id, data);
    written += 1;
  }
  return {ok: true, scanned: snap.size, written, mediaRetentionDays: MEDIA_RETENTION_DAYS, auditRetentionYears: AUDIT_RETENTION_YEARS};
});

const getShoutoutComplianceRetention = onCall({region: "us-central1"}, async (request) => {
  assertMasterAdmin(request);
  const meta = await db.collection("shoutoutComplianceMeta").doc("retention").get();
  return {
    ok: true,
    mediaRetentionDays: MEDIA_RETENTION_DAYS,
    auditRetentionYears: AUDIT_RETENTION_YEARS,
    policy: {
      media: `ShoutOut media is deleted ${MEDIA_RETENTION_DAYS} days after completion/approval.`,
      audit: `Audit metadata is retained ${AUDIT_RETENTION_YEARS} years, then anonymized.`,
      foreverMedia: false
    },
    meta: meta.exists ? meta.data() : {}
  };
});

module.exports = {
  AUDIT_RETENTION_YEARS,
  MEDIA_RETENTION_DAYS,
  buildComplianceRecord,
  upsertComplianceLog,
  onShoutoutComplianceWrite,
  purgeExpiredShoutoutMedia,
  anonymizeExpiredComplianceLogs,
  backfillShoutoutComplianceLogs,
  getShoutoutComplianceRetention
};
