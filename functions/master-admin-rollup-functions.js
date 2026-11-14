/**
 * Master Admin rollups — precompute summary datapoints every 5 minutes.
 * Panels read masterAdminRollups/current instead of 27×750 live pulls for the strip.
 */
"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {getFirestore, FieldValue, AggregateField} = require("firebase-admin/firestore");
const {isServerAdminAuth} = require("./admin-trust");

let _db;
function db() {
  if (!_db) _db = getFirestore();
  return _db;
}
const ROLLUP_DOC = "masterAdminRollups/current";
const SCHEMA = 1;

const DIAG_COLLECTIONS = [
  "users", "shoutouts", "liveContent", "guestListRequests", "messages", "inboxNotifications",
  "clubLocations", "clubLocationAliases", "events", "templates", "minglConnections", "minglAudit",
  "chatRooms", "chatMessages", "roleRequests", "clubEmployeeDesignations", "patronTemplateVariants",
  "aiIndex", "aiUserNotificationPreferences", "aiSearchLogs", "aiRecommendations",
  "aiDiscoverySources", "aiDiscoveryQueue", "aiDiscoveryRatingCriteria", "aiCrawlRuns",
  "aiCrawlerSchedules", "aiDiagnosticsReports"
];

async function assertMasterAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Master Admin sign-in is required.");
  if (isServerAdminAuth(request.auth)) return;
  throw new HttpsError("permission-denied", "Master Admin access is required.");
}

async function countCollection(name) {
  try {
    const snap = await db().collection(name).count().get();
    return Number(snap.data().count || 0);
  } catch (err) {
    console.warn("rollup count failed", name, err?.message || err);
    return null;
  }
}

async function countWhere(name, field, value) {
  try {
    const snap = await db().collection(name).where(field, "==", value).count().get();
    return Number(snap.data().count || 0);
  } catch (err) {
    console.warn("rollup countWhere failed", name, field, value, err?.message || err);
    return null;
  }
}

function normalizeClubKey(row = {}) {
  const name = String(row.locationName || row.brandName || row.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const city = String(row.city || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const country = String(row.country || row.countryCode || "").toLowerCase().trim();
  if (!name) return "";
  return `${name}|${city}|${country}`;
}

async function buildDuplicateSummary() {
  const snap = await db().collection("clubLocations")
    .select("locationName", "brandName", "name", "city", "country", "countryCode")
    .limit(1200)
    .get();
  const groups = new Map();
  snap.docs.forEach((doc) => {
    const key = normalizeClubKey(doc.data() || {});
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc.id);
  });
  const clusters = [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({key, count: ids.length, ids: ids.slice(0, 6)}))
    .sort((a, b) => b.count - a.count);
  return {
    clubsScanned: snap.size,
    clusterCount: clusters.length,
    topClusters: clusters.slice(0, 8)
  };
}

async function buildCommerceSummary() {
  const [ordersTotal, campaignsTotal, pickupsTotal] = await Promise.all([
    countCollection("serviceOrders"),
    countCollection("audienceCampaigns"),
    countCollection("pickupRequests")
  ]);
  let ordersPaid = null;
  let grossRevenueCents = null;
  let floqrShareCents = null;
  try {
    const paidAgg = await db().collection("serviceOrders")
      .where("paymentStatus", "==", "paid")
      .aggregate({
        count: AggregateField.count(),
        gross: AggregateField.sum("amountCents"),
        floqr: AggregateField.sum("floqrShareCents")
      })
      .get();
    const data = paidAgg.data() || {};
    ordersPaid = Number(data.count || 0);
    grossRevenueCents = Number(data.gross || 0);
    floqrShareCents = Number(data.floqr || 0);
  } catch (err) {
    console.warn("rollup commerce aggregate failed", err?.message || err);
    // Fallback: sample recent paid rows.
    try {
      const paidSnap = await db().collection("serviceOrders")
        .where("paymentStatus", "==", "paid")
        .limit(300)
        .get();
      ordersPaid = paidSnap.size;
      let gross = 0;
      let floqr = 0;
      paidSnap.docs.forEach((doc) => {
        const row = doc.data() || {};
        const amt = Number(row.amountCents || 0);
        gross += amt;
        floqr += Number(row.floqrShareCents != null ? row.floqrShareCents : amt);
      });
      grossRevenueCents = gross;
      floqrShareCents = floqr;
    } catch (err2) {
      console.warn("rollup commerce sample failed", err2?.message || err2);
    }
  }
  return {
    ordersTotal,
    ordersPaid,
    grossRevenueCents,
    floqrShareCents,
    campaignsTotal,
    pickupsTotal
  };
}

async function buildAiCrawlSummary() {
  const [
    queueTotal,
    pendingReview,
    needsResearch,
    approved,
    rejected,
    scheduleSnap,
    lastRuns
  ] = await Promise.all([
    countCollection("aiDiscoveryQueue"),
    countWhere("aiDiscoveryQueue", "status", "pendingReview"),
    countWhere("aiDiscoveryQueue", "status", "needsResearch"),
    countWhere("aiDiscoveryQueue", "status", "approved"),
    countWhere("aiDiscoveryQueue", "status", "rejected"),
    db().collection("aiCrawlerSchedules").doc("default").get(),
    db().collection("aiCrawlRuns").orderBy("startedAt", "desc").limit(1).get()
  ]);
  const schedule = scheduleSnap.exists ? (scheduleSnap.data() || {}) : {};
  const last = lastRuns.docs[0];
  const lastData = last ? (last.data() || {}) : {};
  const startedAt = lastData.startedAt;
  const startedMs = startedAt && typeof startedAt.toMillis === "function"
    ? startedAt.toMillis()
    : Number(lastData.startedAtMs || 0) || null;
  return {
    queueTotal,
    pendingReview,
    needsResearch,
    approved,
    rejected,
    scheduleEnabled: schedule.enabled === true,
    lastRunId: last ? last.id : null,
    lastRunStatus: lastData.status || lastData.outcome || null,
    lastRunAtMs: startedMs
  };
}

async function buildDiagnosticsCounts() {
  const entries = await Promise.all(DIAG_COLLECTIONS.map(async (name) => [name, await countCollection(name)]));
  const collectionCounts = Object.fromEntries(entries);
  const known = Object.values(collectionCounts).filter((n) => n != null);
  return {
    collectionCounts,
    collectionsTracked: DIAG_COLLECTIONS.length,
    docsCounted: known.reduce((sum, n) => sum + n, 0)
  };
}

async function buildMasterAdminRollup({source = "schedule", actorUid = "", actorEmail = ""} = {}) {
  const now = Date.now();
  const [diagnostics, aiCrawl, duplicates, commerce, templatesTotal, templatesActive, recsPending, recsApproved] = await Promise.all([
    buildDiagnosticsCounts(),
    buildAiCrawlSummary(),
    buildDuplicateSummary(),
    buildCommerceSummary(),
    countCollection("templates"),
    countWhere("templates", "active", true).then(async (n) => {
      if (n != null) return n;
      return countWhere("templates", "status", "active");
    }),
    countWhere("shoutoutRecommendations", "approved", false).then(async (n) => {
      if (n != null) return n;
      return countWhere("shoutoutRecommendations", "status", "pending");
    }),
    countWhere("shoutoutRecommendations", "approved", true).then(async (n) => {
      if (n != null) return n;
      return countWhere("shoutoutRecommendations", "status", "approved");
    })
  ]);

  const payload = {
    schemaVersion: SCHEMA,
    updatedAtMs: now,
    updatedAtIso: new Date(now).toISOString(),
    source,
    actorUid: actorUid || null,
    actorEmail: actorEmail || null,
    diagnostics,
    aiCrawl,
    duplicates,
    commerce,
    templates: {
      total: templatesTotal,
      active: templatesActive
    },
    recommendations: {
      pending: recsPending,
      approved: recsApproved
    },
    serverUpdatedAt: FieldValue.serverTimestamp()
  };

  await db().doc(ROLLUP_DOC).set(payload, {merge: true});
  return payload;
}

exports.scheduledMasterAdminRollup = onSchedule({
  region: "us-central1",
  schedule: "every 5 minutes",
  timeZone: "UTC",
  timeoutSeconds: 240,
  memory: "512MiB"
}, async () => {
  const result = await buildMasterAdminRollup({source: "schedule"});
  console.log("scheduledMasterAdminRollup", {
    updatedAtMs: result.updatedAtMs,
    queuePending: result.aiCrawl?.pendingReview,
    duplicateClusters: result.duplicates?.clusterCount,
    ordersPaid: result.commerce?.ordersPaid
  });
  return null;
});

exports.refreshMasterAdminRollup = onCall({region: "us-central1", timeoutSeconds: 240, memory: "512MiB"}, async (request) => {
  await assertMasterAdmin(request);
  const email = String(request.auth?.token?.email || "").trim().toLowerCase();
  const payload = await buildMasterAdminRollup({
    source: "callable",
    actorUid: request.auth.uid,
    actorEmail: email
  });
  // Strip serverTimestamp FieldValue for client JSON.
  const {serverUpdatedAt, ...safe} = payload;
  return {ok: true, rollup: safe};
});

exports.__masterAdminRollupHelpers = {
  buildMasterAdminRollup,
  normalizeClubKey,
  DIAG_COLLECTIONS,
  ROLLUP_DOC,
  SCHEMA
};
