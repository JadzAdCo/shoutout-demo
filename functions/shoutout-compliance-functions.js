/**
 * ShoutOut compliance logging (SOC 2 / ISO 27001 / NIST AU / GDPR-aligned).
 * Design notes: .cursor/rules/design-notes-master-admin-shoutouts.mdc
 *
 * - shoutoutComplianceLogs: Master Admin searchable audit metadata (7 years)
 * - Media blobs deleted after 90 days (not forever-archived)
 * - Reconstruct from shoutouts + shoutoutAudit + inboxNotifications when live docs were cleared
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
/** Default Master Admin search window — not deletion. Compliance metadata stays 7 years. */
const UI_DEFAULT_SEARCH_DAYS = 60;

const TERMINAL_STATUSES = new Set([
  "approved", "live", "playing", "displayed", "completed", "done", "finished",
  "ended", "expired", "played", "archived", "refunded", "rejected", "cancelled", "canceled", "stale"
]);

const INDEXABLE_STATUSES = new Set([
  ...TERMINAL_STATUSES,
  "pending", "pending_approval", "submitted", "paid", "queued", "processing"
]);

const AUDIT_ACTION_STATUS = {
  submitted: "pending",
  paid: "pending_approval",
  pending_approval: "pending_approval",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
  canceled: "canceled",
  completed: "completed",
  ended: "ended",
  expired: "expired",
  archived: "archived",
  refunded: "refunded",
  media_purged: "approved",
  "stale-shoutout-cleared": "stale"
};

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

function shouldIndexShoutout(data = {}) {
  const status = text(data.status, 40).toLowerCase();
  const payment = text(data.paymentStatus, 40).toLowerCase();
  if (payment === "paid") return true;
  if (INDEXABLE_STATUSES.has(status)) return true;
  if (data.referenceNumber || data.submittedAt || data.approvedAt || data.rejectedAt) return true;
  return false;
}

function lifecyclePhase(status = "", paymentStatus = "") {
  const s = text(status, 40).toLowerCase();
  const p = text(paymentStatus, 40).toLowerCase();
  if (s === "rejected") return "rejected";
  if (s === "stale") return "stale";
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  if (TERMINAL_STATUSES.has(s) && s !== "rejected") return "completed";
  if (s === "pending_approval" || p === "paid") return "submitted_paid";
  if (["pending", "submitted", "queued", "processing"].includes(s)) return "submitted";
  return s || "unknown";
}

function buildComplianceRecord(shoutoutId, data = {}) {
  const status = text(data.status || "pending", 40).toLowerCase();
  const mainText = text(data.mainText || data.main || "", 200);
  const subText = text(data.subText || data.sub || "", 80);
  const venueName = text(data.locationName || data.clubName || data.venueName || data.brandName || "", 160);
  const clubLocationId = text(data.clubLocationId || data.location || data.club || "", 120);
  const mediaUrl = text(data.mediaUrl || data.photoUrl || data.imageUrl || "", 2000);
  const hasMedia = !!(mediaUrl || data.hasMedia);
  const submittedMs = toMillis(data.submittedAt) || toMillis(data.createdAt) || Date.now();
  const paidMs = toMillis(data.paidAt);
  const approvedMs = toMillis(data.approvedAt) || toMillis(data.completedAt);
  const rejectedMs = toMillis(data.rejectedAt);
  const completedMs = toMillis(data.completedAt) || toMillis(data.endedAt) || approvedMs || rejectedMs || paidMs || submittedMs;
  const eventAtMs = Math.max(completedMs, approvedMs, rejectedMs, paidMs, submittedMs);
  const paymentStatus = text(data.paymentStatus || "", 40).toLowerCase();
  const isTerminal = TERMINAL_STATUSES.has(status) || paymentStatus === "paid";
  const mediaRetentionUntilMs = isTerminal && hasMedia
    ? addDays(completedMs || eventAtMs, MEDIA_RETENTION_DAYS)
    : 0;
  const retentionUntilMs = addYears(eventAtMs || Date.now(), AUDIT_RETENTION_YEARS);
  const actorEmail = text(data.actorEmail || data.submittedByEmail || data.submittedBy || data.ownerEmail || "", 200).toLowerCase();
  const actorPhone = text(data.actorPhone || data.submittedByPhone || data.phone || data.phoneNumber || "", 40);
  const actorIdentifier = text(data.actorIdentifier || actorEmail || actorPhone || "", 200).toLowerCase();
  const clientIp = text(data.clientIp || data.submitterIp || data.actorIp || "", 80);
  const searchBlob = `${venueName} ${mainText} ${subText} ${clubLocationId} ${text(data.referenceNumber, 80)} ${text(data.locationLabel, 160)} ${actorIdentifier} ${clientIp}`.toLowerCase();

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
    lifecyclePhase: lifecyclePhase(status, paymentStatus),
    paymentStatus,
    amountCents: Number(data.amountCents || 0) || 0,
    submittedByUid: text(data.submittedByUid || data.ownerUid || "", 128),
    approvedByUid: text(data.approvedByUid || "", 128),
    rejectedByUid: text(data.rejectedByUid || "", 128),
    actorEmail,
    actorPhone,
    actorIdentifier,
    clientIp,
    ipSource: text(data.ipSource || (clientIp ? "request" : ""), 40),
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
    source: text(data.source || "shoutouts", 40),
    complianceVersion: "s3.0.69",
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
    locationName: data.locationName || data.venueName || prev.locationName || prev.venueName || "",
    venueName: data.venueName || data.locationName || prev.venueName || prev.locationName || "",
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
    merged.actorEmail = "";
    merged.actorPhone = "";
    merged.actorIdentifier = "[redacted]";
    merged.clientIp = "";
    merged.ipSource = "";
    merged.submittedBy = "";
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

async function loadVenueMap() {
  const snap = await db.collection("clubLocations").limit(800).get();
  const map = new Map();
  snap.docs.forEach((doc) => {
    const row = doc.data() || {};
    if (text(row.status, 40).toLowerCase() === "deleted" || row.deletedAt) return;
    const name = text(row.locationName || row.clubName || row.brandName || doc.id, 160);
    map.set(doc.id, {
      clubLocationId: doc.id,
      locationName: name,
      brandName: text(row.brandName, 160),
      city: text(row.city, 80),
      locationLabel: text(row.locationLabel, 160)
    });
  });
  return map;
}

function enrichVenue(data = {}, venueMap = new Map()) {
  const clubLocationId = text(data.clubLocationId || data.location || data.club || "", 120);
  const venue = clubLocationId ? venueMap.get(clubLocationId) : null;
  if (!venue) return {...data, clubLocationId};
  return {
    ...data,
    clubLocationId,
    locationName: text(data.locationName || data.venueName || data.clubName || "", 160) || venue.locationName,
    venueName: text(data.venueName || data.locationName || data.clubName || "", 160) || venue.locationName,
    brandName: text(data.brandName, 160) || venue.brandName,
    locationLabel: text(data.locationLabel, 160) || venue.locationLabel
  };
}

function normalizeIp(raw = "") {
  let ip = String(raw || "").trim();
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip.slice(0, 80);
}

function extractClientIp(request) {
  const req = request?.rawRequest || {};
  const headers = req.headers || {};
  const xf = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
  const real = String(headers["x-real-ip"] || "").trim();
  const raw = xf || real || req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "";
  return normalizeIp(raw);
}

function profilePhone(profile = {}) {
  return text(profile.phone || profile.smsPhone || profile.phoneNumber || profile.mobile || profile.telephone || "", 40);
}

function profileEmail(profile = {}) {
  return text(profile.email || "", 200).toLowerCase();
}

function actorFieldsFromSources(data = {}, profile = {}) {
  const email = text(
    data.actorEmail || data.submittedByEmail || data.submittedBy || data.ownerEmail || data.customerEmail || profileEmail(profile),
    200
  ).toLowerCase();
  const phone = text(data.actorPhone || data.submittedByPhone || data.phone || profilePhone(profile), 40);
  const identifier = text(email || phone, 200).toLowerCase();
  const clientIp = normalizeIp(data.clientIp || data.submitterIp || data.actorIp || "");
  return {
    actorEmail: email,
    actorPhone: phone,
    actorIdentifier: identifier,
    clientIp,
    ipSource: text(data.ipSource || (clientIp ? data.ipSource || "request" : ""), 40),
    submittedBy: email || text(data.submittedBy, 200).toLowerCase()
  };
}

async function loadUserIdentityMap(uids = []) {
  const unique = Array.from(new Set(uids.map((u) => text(u, 128)).filter(Boolean))).slice(0, 400);
  const map = new Map();
  await Promise.all(unique.map(async (uid) => {
    try {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists) map.set(uid, snap.data() || {});
    } catch (_e) {}
  }));
  return map;
}

async function enrichActorIdentity(data = {}, userMap = null) {
  const uid = text(data.submittedByUid || data.ownerUid || data.actorUid || "", 128);
  let profile = {};
  if (uid) {
    if (userMap?.has(uid)) profile = userMap.get(uid) || {};
    else {
      try {
        const snap = await db.collection("users").doc(uid).get();
        profile = snap.exists ? snap.data() || {} : {};
      } catch (_e) {}
    }
  }
  return {...data, ...actorFieldsFromSources(data, profile)};
}

async function resolveIpFromAppLogs(uid = "", shoutoutId = "", referenceNumber = "") {
  const ownerUid = text(uid, 128);
  if (!ownerUid) return {clientIp: "", ipSource: ""};
  try {
    const snap = await db.collection("appLogs")
      .where("uid", "==", ownerUid)
      .orderBy("createdAt", "desc")
      .limit(40)
      .get();
    for (const doc of snap.docs) {
      const row = doc.data() || {};
      const details = row.details && typeof row.details === "object" ? row.details : {};
      const ip = normalizeIp(row.clientIp || details.clientIp || "");
      if (!ip) continue;
      const blob = `${details.shoutoutId || ""} ${details.orderId || ""} ${details.referenceNumber || ""} ${row.correlationId || ""}`.toLowerCase();
      const needle = text(shoutoutId || referenceNumber, 120).toLowerCase();
      if (!needle || blob.includes(needle) || ["checkout", "shoutout"].includes(text(row.category, 40).toLowerCase())) {
        return {clientIp: ip, ipSource: "appLogs"};
      }
    }
  } catch (_e) {}
  return {clientIp: "", ipSource: ""};
}

function parseInboxBodyFields(body = "") {
  const textBody = String(body || "");
  const pick = (label) => {
    const match = textBody.match(new RegExp(`${label}:\\s*(.+)`, "i"));
    return match ? text(match[1], 200) : "";
  };
  return {
    referenceNumber: pick("Reference"),
    locationName: pick("Location"),
    templateName: pick("Template"),
    statusHint: pick("Status")
  };
}

function mergeByShoutoutId(target, shoutoutId, patch = {}) {
  const id = text(shoutoutId, 120);
  if (!id) return;
  const prev = target.get(id) || {};
  target.set(id, {
    ...prev,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null && v !== "")),
    clubLocationId: text(patch.clubLocationId || prev.clubLocationId, 120),
    referenceNumber: text(patch.referenceNumber || prev.referenceNumber, 80),
    locationName: text(patch.locationName || prev.locationName || prev.venueName, 160),
    mainText: text(patch.mainText || prev.mainText, 200),
    subText: text(patch.subText || prev.subText, 80),
    status: text(patch.status || prev.status || "pending", 40).toLowerCase()
  });
}

async function collectReconstructCandidates(limit = 300) {
  const byId = new Map();
  const venueMap = await loadVenueMap();

  const shoutSnap = await db.collection("shoutouts").orderBy("submittedAt", "desc").limit(limit).get().catch(async () => {
    return db.collection("shoutouts").limit(limit).get();
  });
  shoutSnap.docs.forEach((doc) => {
    const data = enrichVenue(doc.data() || {}, venueMap);
    if (!shouldIndexShoutout(data)) return;
    mergeByShoutoutId(byId, doc.id, {
      ...data,
      actorEmail: text(data.submittedBy || data.actorEmail, 200).toLowerCase(),
      clientIp: normalizeIp(data.clientIp || data.submitterIp || ""),
      ipSource: text(data.ipSource || (data.clientIp ? "shoutouts" : ""), 40),
      source: "shoutouts"
    });
  });

  const auditSnap = await db.collection("shoutoutAudit").orderBy("createdAt", "desc").limit(Math.min(1500, limit * 4)).get().catch(async () => {
    return db.collection("shoutoutAudit").limit(Math.min(1500, limit * 4)).get();
  });
  const auditById = new Map();
  auditSnap.docs.forEach((doc) => {
    const row = doc.data() || {};
    const shoutoutId = text(row.shoutoutId, 120);
    if (!shoutoutId) return;
    const list = auditById.get(shoutoutId) || [];
    list.push(row);
    auditById.set(shoutoutId, list);
  });
  for (const [shoutoutId, events] of auditById.entries()) {
    events.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    const latest = events[events.length - 1] || {};
    const submitted = events.find((e) => text(e.action, 40).toLowerCase() === "submitted");
    const approved = [...events].reverse().find((e) => text(e.action, 40).toLowerCase() === "approved");
    const rejected = [...events].reverse().find((e) => text(e.action, 40).toLowerCase() === "rejected");
    const action = text(latest.action, 60).toLowerCase();
    const mappedStatus = AUDIT_ACTION_STATUS[action] || text(latest.status, 40).toLowerCase() || "pending";
    const clubLocationId = text(
      rejected?.clubLocationId || approved?.clubLocationId || latest.clubLocationId || submitted?.clubLocationId,
      120
    );
    const patch = enrichVenue({
      status: mappedStatus,
      referenceNumber: text(latest.referenceNumber || approved?.referenceNumber || rejected?.referenceNumber || submitted?.referenceNumber, 80),
      clubLocationId,
      submittedByUid: text(submitted?.actorUid || latest.ownerUid || "", 128),
      approvedByUid: text(approved?.actorUid || "", 128),
      rejectedByUid: text(rejected?.actorUid || "", 128),
      actorEmail: text(submitted?.actorEmail || latest.actorEmail || approved?.actorEmail || "", 200).toLowerCase(),
      clientIp: normalizeIp(submitted?.clientIp || latest.clientIp || ""),
      ipSource: text(submitted?.clientIp || latest.clientIp ? "shoutoutAudit" : "", 40),
      submittedAt: submitted?.createdAt || null,
      approvedAt: approved?.createdAt || null,
      rejectedAt: rejected?.createdAt || null,
      mainText: text(latest.mainText || "", 200),
      source: "shoutoutAudit"
    }, venueMap);
    mergeByShoutoutId(byId, shoutoutId, patch);
  }

  const inboxSnap = await db.collection("inboxNotifications")
    .where("type", "in", ["paidShoutoutReceipt", "shoutoutStatus"])
    .limit(Math.min(400, limit * 2))
    .get()
    .catch(async () => {
      const all = await db.collection("inboxNotifications").limit(400).get();
      return {
        docs: all.docs.filter((d) => ["paidShoutoutReceipt", "shoutoutStatus"].includes(text(d.data()?.type, 60)))
      };
    });
  inboxSnap.docs.forEach((doc) => {
    const row = doc.data() || {};
    const parsed = parseInboxBodyFields(row.body);
    const shoutoutId = text(row.shoutoutId || "", 120);
    if (!shoutoutId) return;
    const statusRaw = text(row.status || parsed.statusHint, 80).toLowerCase();
    let status = "pending_approval";
    if (statusRaw.includes("reject")) status = "rejected";
    else if (statusRaw.includes("approv")) status = "approved";
    else if (statusRaw.includes("pending")) status = "pending_approval";
    const patch = enrichVenue({
      status,
      paymentStatus: text(row.type, 40) === "paidShoutoutReceipt" ? "paid" : "",
      referenceNumber: text(row.referenceNumber || parsed.referenceNumber, 80),
      clubLocationId: text(row.clubLocationId, 120),
      locationName: text(row.locationName || parsed.locationName, 160),
      templateName: text(row.templateName || parsed.templateName, 120),
      actorEmail: text(row.recipientEmail || "", 200).toLowerCase(),
      submittedByUid: text(row.recipientUid || "", 128),
      paidAt: row.paidAtIso ? new Date(row.paidAtIso) : row.createdAt || null,
      submittedAt: row.createdAt || null,
      source: "inboxNotifications"
    }, venueMap);
    mergeByShoutoutId(byId, shoutoutId, patch);
  });

  const userMap = await loadUserIdentityMap(
    Array.from(byId.values()).map((row) => row.submittedByUid || row.ownerUid || "")
  );
  for (const [shoutoutId, data] of byId.entries()) {
    let enriched = await enrichActorIdentity(data, userMap);
    if (!enriched.clientIp) {
      const fromLogs = await resolveIpFromAppLogs(enriched.submittedByUid, shoutoutId, enriched.referenceNumber);
      if (fromLogs.clientIp) enriched = {...enriched, ...fromLogs};
    }
    byId.set(shoutoutId, enriched);
  }

  return {byId, venueMap, scanned: {
    shoutouts: shoutSnap.size,
    audit: auditSnap.size,
    inbox: inboxSnap.docs.length
  }};
}

const onShoutoutComplianceWrite = onDocumentWritten("shoutouts/{shoutoutId}", async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const shoutoutId = event.params.shoutoutId;
  const data = after.data() || {};
  if (!shouldIndexShoutout(data)) return;
  const venueMap = await loadVenueMap();
  let enriched = await enrichActorIdentity(enrichVenue({...data, source: "shoutouts"}, venueMap));
  if (!enriched.clientIp) {
    const fromLogs = await resolveIpFromAppLogs(enriched.submittedByUid, shoutoutId, enriched.referenceNumber);
    if (fromLogs.clientIp) enriched = {...enriched, ...fromLogs};
  }
  await upsertComplianceLog(shoutoutId, enriched);
});

const stampShoutoutActorContext = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const shoutoutId = text(request.data?.shoutoutId, 120);
  if (!shoutoutId) throw new HttpsError("invalid-argument", "shoutoutId is required.");
  const snap = await db.collection("shoutouts").doc(shoutoutId).get();
  if (!snap.exists) throw new HttpsError("not-found", "ShoutOut not found.");
  const data = snap.data() || {};
  const ownerUid = text(data.submittedByUid || data.ownerUid, 128);
  const email = emailOf(request.auth);
  const isOwner = ownerUid && ownerUid === request.auth.uid;
  const isMaster = request.auth.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email);
  if (!isOwner && !isMaster) throw new HttpsError("permission-denied", "Only the submitter or Master Admin can stamp actor context.");
  const clientIp = extractClientIp(request);
  const actor = await enrichActorIdentity({
    ...data,
    submittedByUid: ownerUid || request.auth.uid,
    actorEmail: text(data.submittedBy || request.auth.token?.email || email, 200).toLowerCase(),
    clientIp,
    ipSource: clientIp ? "callable" : "",
    source: "stampShoutoutActorContext"
  });
  const patch = {
    clientIp: actor.clientIp,
    ipSource: actor.ipSource,
    actorEmail: actor.actorEmail,
    actorPhone: actor.actorPhone,
    actorIdentifier: actor.actorIdentifier,
    submittedBy: actor.submittedBy || actor.actorEmail,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await db.collection("shoutouts").doc(shoutoutId).set(patch, {merge: true});
  await upsertComplianceLog(shoutoutId, {...data, ...actor, ...patch});
  try {
    await db.collection("appLogs").add({
      level: "info",
      category: "shoutout",
      action: "actor_context_stamped",
      message: "ShoutOut actor IP/identity stamped for compliance",
      details: {shoutoutId, referenceNumber: text(data.referenceNumber, 80), clientIp: actor.clientIp},
      uid: request.auth.uid,
      email: actor.actorEmail,
      clientIp: actor.clientIp,
      source: "functions",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (_e) {}
  return {ok: true, shoutoutId, clientIp: actor.clientIp, actorIdentifier: actor.actorIdentifier};
});

/** Signed-in session probe: return the caller's public IP for ShoutOut compliance attachment. */
const getFloqrClientIp = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const clientIp = extractClientIp(request);
  try {
    await db.collection("appLogs").add({
      level: "info",
      category: "shoutout",
      action: "client_ip_probe",
      message: "Captured public IP for ShoutOut session",
      details: {clientIp},
      uid: request.auth.uid,
      email: emailOf(request.auth),
      clientIp,
      source: "functions",
      logCategory: "diagnostic",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
      expireAtMs: Date.now() + (30 * 24 * 60 * 60 * 1000)
    });
  } catch (_e) {}
  return {ok: true, clientIp, ipSource: clientIp ? "session-callable" : ""};
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
    uiDefaultSearchDays: UI_DEFAULT_SEARCH_DAYS,
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

const backfillShoutoutComplianceLogs = onCall({
  region: "us-central1",
  timeoutSeconds: 300,
  memory: "1GiB"
}, async (request) => {
  assertMasterAdmin(request);
  const limit = Math.min(500, Math.max(1, Number(request.data?.limit || 300)));
  const {byId, scanned} = await collectReconstructCandidates(limit);
  let written = 0;
  for (const [shoutoutId, data] of byId.entries()) {
    if (!shouldIndexShoutout(data)) continue;
    await upsertComplianceLog(shoutoutId, data);
    written += 1;
  }
  await db.collection("shoutoutComplianceMeta").doc("retention").set({
    lastBackfillAt: admin.firestore.FieldValue.serverTimestamp(),
    lastBackfillWritten: written,
    lastBackfillScanned: scanned,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  return {
    ok: true,
    scanned,
    candidates: byId.size,
    written,
    mediaRetentionDays: MEDIA_RETENTION_DAYS,
    auditRetentionYears: AUDIT_RETENTION_YEARS,
    uiDefaultSearchDays: UI_DEFAULT_SEARCH_DAYS
  };
});

const getShoutoutComplianceRetention = onCall({region: "us-central1"}, async (request) => {
  assertMasterAdmin(request);
  const meta = await db.collection("shoutoutComplianceMeta").doc("retention").get();
  return {
    ok: true,
    mediaRetentionDays: MEDIA_RETENTION_DAYS,
    auditRetentionYears: AUDIT_RETENTION_YEARS,
    uiDefaultSearchDays: UI_DEFAULT_SEARCH_DAYS,
    policy: {
      media: `ShoutOut media is deleted ${MEDIA_RETENTION_DAYS} days after completion/approval.`,
      audit: `Audit metadata is retained ${AUDIT_RETENTION_YEARS} years, then anonymized (SOC 2 / NIST AU-11).`,
      uiWindow: `Master Admin default search window is ${UI_DEFAULT_SEARCH_DAYS} days; expand the date range to search older retained metadata.`,
      foreverMedia: false,
      note: "Do not delete compliance metadata at 60 days — that would break audit retention requirements."
    },
    meta: meta.exists ? meta.data() : {}
  };
});

module.exports = {
  AUDIT_RETENTION_YEARS,
  MEDIA_RETENTION_DAYS,
  UI_DEFAULT_SEARCH_DAYS,
  INDEXABLE_STATUSES,
  TERMINAL_STATUSES,
  shouldIndexShoutout,
  lifecyclePhase,
  actorFieldsFromSources,
  buildComplianceRecord,
  upsertComplianceLog,
  onShoutoutComplianceWrite,
  stampShoutoutActorContext,
  getFloqrClientIp,
  purgeExpiredShoutoutMedia,
  anonymizeExpiredComplianceLogs,
  backfillShoutoutComplianceLogs,
  getShoutoutComplianceRetention
};
