/* FLOQR venue website ingest — secret JSON / RSS feed for club sites. */
"use strict";

const {onRequest, onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  isPublishedShiftStatus,
  publicShiftView,
  normalizeShiftStatus
} = require("./scheduling-core");
const {
  hashIngestSecret,
  newIngestSecret,
  secretsMatch,
  obfuscateSecret,
  opaqueAssigneeKey,
  feedUrls,
  iframeSnippet,
  buildScheduleRss,
  DEFAULT_ORIGIN,
  DEFAULT_API
} = require("./venue-ingest-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function text(value = "", max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

async function isMasterAdminAuth(authContext = {}) {
  const email = String(authContext.token?.email || "").toLowerCase();
  if (!email) return false;
  const snap = await db.collection("platformSettings").doc("masterAdmins").get();
  const emails = snap.exists && Array.isArray(snap.data()?.emails) ? snap.data().emails.map(v => String(v).toLowerCase()) : [];
  return emails.includes(email);
}

async function canManageClub(locationId, authContext = {}) {
  const uid = authContext.uid || "";
  if (!uid || !locationId) return false;
  if (await isMasterAdminAuth(authContext)) return true;
  const email = String(authContext.token?.email || "").toLowerCase();
  const clubSnap = await db.collection("clubLocations").doc(locationId).get();
  if (clubSnap.exists) {
    const club = clubSnap.data() || {};
    if ([...(club.adminUids || []), ...(club.masterAdminUids || [])].includes(uid)) return true;
    if ((club.adminEmails || []).map(v => String(v).toLowerCase()).includes(email)) return true;
  }
  const safeId = `${locationId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const [assignment, designation] = await Promise.all([
    db.collection("clubAdminAssignments").doc(safeId).get(),
    db.collection("clubEmployeeDesignations").doc(safeId).get()
  ]);
  if (assignment.exists && text(assignment.data()?.status, 40).toLowerCase() === "active") return true;
  if (!designation.exists || designation.data()?.status === "rejected") return false;
  const worker = designation.data() || {};
  if (/club admin/i.test(worker.roleElectionType || "")) return true;
  return (worker.rolePermissions || []).some(permission => permission === "manageSchedules");
}

function ownerKey(locationId) {
  return `club:${text(locationId, 160)}`;
}

function publicProfileView(club = {}, locationId = "") {
  return {
    locationId,
    name: text(club.locationName || club.brandName || club.name, 160),
    tagline: text(club.tagline, 200),
    address: text(club.address || club.formattedAddress, 220),
    city: text(club.city, 80),
    phone: text(club.publicPhone || club.phone, 40),
    website: text(club.website, 200),
    timeZone: text(club.timeZone, 80)
  };
}

function publicHoursView(club = {}) {
  return {
    hoursStructured: club.hoursStructured || null,
    timeZone: text(club.timeZone, 80),
    hoursExceptions: Array.isArray(club.hoursExceptions) ? club.hoursExceptions.slice(0, 20) : []
  };
}

async function loadPublishedShifts(locationId) {
  const snap = await db.collection("scheduleShifts")
    .where("ownerKey", "==", ownerKey(locationId))
    .limit(120)
    .get();
  return snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
    .filter(row => isPublishedShiftStatus(normalizeShiftStatus(row.status) || row.status))
    .map(row => ({
      ...publicShiftView(row),
      assigneeKey: opaqueAssigneeKey(text(row.assigneeUid, 160) || row.id)
    }))
    .sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0));
}

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Floqr-Ingest-Secret");
  res.set("Cache-Control", "public, max-age=60");
}

exports.rotateVenueIngestSecret = onCall({region: "us-central1", timeoutSeconds: 20, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const locationId = text(request.data?.locationId, 160);
  if (!locationId) throw new HttpsError("invalid-argument", "locationId is required.");
  if (!await canManageClub(locationId, request.auth)) {
    throw new HttpsError("permission-denied", "You cannot manage website ingest for this venue.");
  }
  const secret = newIngestSecret();
  await db.collection("venueIngestSecrets").doc(locationId).set({
    locationId,
    secretHash: hashIngestSecret(secret),
    secretPrefix: obfuscateSecret(secret),
    rotatedAt: admin.firestore.FieldValue.serverTimestamp(),
    rotatedByUid: request.auth.uid
  }, {merge: true});
  const urls = feedUrls({locationId, secret});
  return {
    locationId,
    secret,
    secretPrefix: obfuscateSecret(secret),
    urls,
    iframeSnippet: iframeSnippet(urls.iframe),
    warning: "ONE-TIME REVEAL: copy the secret and URLs now. The full secret is not shown again until you rotate."
  };
});

exports.getVenueIngestEndpoints = onCall({region: "us-central1", timeoutSeconds: 20, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const locationId = text(request.data?.locationId, 160);
  if (!locationId) throw new HttpsError("invalid-argument", "locationId is required.");
  if (!await canManageClub(locationId, request.auth)) {
    throw new HttpsError("permission-denied", "You cannot view website ingest for this venue.");
  }
  const snap = await db.collection("venueIngestSecrets").doc(locationId).get();
  const row = snap.exists ? snap.data() || {} : {};
  const configured = Boolean(row.secretHash);
  const urls = feedUrls({locationId, secret: ""});
  return {
    locationId,
    configured,
    secretPrefix: text(row.secretPrefix, 40),
    urlTemplates: {
      json: `${urls.json}`,
      rss: `${urls.rss}`,
      iframe: `${urls.iframe}`,
      apiBase: DEFAULT_API
    },
    hint: configured
      ? "Rotate to reveal a new secret. JSON, RSS, and iframe all require that secret."
      : "Generate a secret to publish JSON, RSS, and iframe URLs for your website."
  };
});

/** Public GET: ?location=&secret=&format=json|rss&dataset=schedule|hours|profile|all */
exports.venuePublicFeed = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ok: false, error: "GET only"});
    return;
  }
  const locationId = text(req.query.location || req.query.locationId, 160);
  const secret = text(req.query.secret || req.query.k || req.get("x-floqr-ingest-secret"), 80);
  const format = text(req.query.format, 20).toLowerCase() || "json";
  const dataset = text(req.query.dataset, 20).toLowerCase() || "schedule";
  if (!locationId || !secret) {
    res.status(400).json({ok: false, error: "location and secret are required."});
    return;
  }
  const secretSnap = await db.collection("venueIngestSecrets").doc(locationId).get();
  const stored = secretSnap.exists ? secretSnap.data() || {} : {};
  if (!secretsMatch(secret, stored.secretHash)) {
    res.status(401).json({ok: false, error: "Invalid ingest secret."});
    return;
  }
  const clubSnap = await db.collection("clubLocations").doc(locationId).get();
  const club = clubSnap.exists ? clubSnap.data() || {} : {};
  const venueName = text(club.locationName || club.brandName || locationId, 160);
  const wantSchedule = dataset === "schedule" || dataset === "all";
  const wantHours = dataset === "hours" || dataset === "all";
  const wantProfile = dataset === "profile" || dataset === "all";
  const shifts = wantSchedule ? await loadPublishedShifts(locationId) : [];
  const urls = feedUrls({locationId, secret, origin: DEFAULT_ORIGIN, apiBase: DEFAULT_API});
  if (format === "rss") {
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.status(200).send(buildScheduleRss({venueName, feedUrl: urls.rss, shifts}));
    return;
  }
  res.status(200).json({
    ok: true,
    locationId,
    venueName,
    dataset,
    generatedAt: new Date().toISOString(),
    shifts: wantSchedule ? shifts : undefined,
    hours: wantHours ? publicHoursView(club) : undefined,
    profile: wantProfile ? publicProfileView(club, locationId) : undefined,
    embeds: {
      iframe: urls.iframe,
      rss: urls.rss,
      json: urls.json
    }
  });
});
