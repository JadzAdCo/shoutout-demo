/**
 * Master Admin entity enable/disable, offboard, and feature gates.
 */
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {assertSos2faSession, writeEntityManagementAudit} = require("./sos2fa-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(x => x.trim().toLowerCase())
  .filter(Boolean);

/* Master Admin = Super Admin */
const SUPER_ADMIN_EMAILS = String(process.env.FLOQR_SUPER_ADMIN_EMAILS || process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(x => x.trim().toLowerCase())
  .filter(Boolean);

const DEFAULT_PATRON_GATES = {bartr:true, rydr:true, mingl:true, floqAi:true, shoutOut:true};
const DEFAULT_VENUE_GATES = {uberAds:true, windowAds:true, bartrStores:true, shoutOut:true, supRstar:true};

const CLUB_PUBLIC_CLEAR_FIELDS = [
  "logoUrl", "logoStoragePath", "mainMediaUrl", "mainMediaType", "mainMediaStoragePath",
  "mainMediaFilter", "description", "publicBio", "bio", "tagline", "about",
  "artists", "promoters", "djs", "staffHighlights", "profileMedia", "galleryUrls",
  "socialMediaHandles", "instagram", "facebook", "tiktok", "x", "twitter",
  "officialWebsite", "website", "phone", "customerEmail", "email",
  "reservationsUrl", "ticketUrl", "heroImageUrl", "coverImageUrl",
  "publicSectionSettings", "profileLayout", "profileBackgroundUrl"
];

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function emailOf(authContext = {}) {
  return text(authContext.token?.email, 200).toLowerCase();
}

function isSuperAdminAuth(authContext = {}, profile = null) {
  const email = emailOf(authContext);
  if (SUPER_ADMIN_EMAILS.includes(email)) return true;
  if (authContext.token?.superAdmin === true) return true;
  if (profile?.superAdmin === true) return true;
  return false;
}

async function assertMasterAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Master Admin sign-in is required.");
  const email = emailOf(request.auth);
  if (request.auth.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email)) return email;
  const snap = await db.collection("users").doc(request.auth.uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  if (data.masterAdmin === true || (data.roles || []).includes("masterAdmin")) return email;
  throw new HttpsError("permission-denied", "Master Admin access is required.");
}

function normalizePatronGates(raw = {}) {
  const out = {...DEFAULT_PATRON_GATES};
  Object.keys(DEFAULT_PATRON_GATES).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(raw || {}, key)) out[key] = raw[key] !== false;
  });
  return out;
}

function normalizeVenueGates(raw = {}) {
  const out = {...DEFAULT_VENUE_GATES};
  Object.keys(DEFAULT_VENUE_GATES).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(raw || {}, key)) out[key] = raw[key] !== false;
  });
  return out;
}

async function loadUserByIdOrEmail(entityId = "", entityEmail = "") {
  const id = text(entityId, 120);
  const email = text(entityEmail, 200).toLowerCase();
  if (id) {
    const snap = await db.collection("users").doc(id).get();
    if (snap.exists) return {uid:snap.id, ...(snap.data() || {})};
  }
  if (email) {
    const q = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return {uid:doc.id, ...(doc.data() || {})};
    }
  }
  return null;
}

function protectSuperAdminEntity(row, entityType) {
  if (!row) return;
  const email = text(row.email, 200).toLowerCase();
  if (isSuperAdminAuth({token:{email}}, row) || SUPER_ADMIN_EMAILS.includes(email) || row.superAdmin === true) {
    throw new HttpsError("failed-precondition", `Super Admin cannot be ${entityType === "disable" ? "disabled" : "offboarded"} via this tool.`);
  }
}

exports.setPatronFeatureGates = onCall({region:"us-central1", timeoutSeconds:30, memory:"256MiB"}, async request => {
  const {email: actorEmail, sessionId} = await assertSos2faSession(request);
  const gates = normalizePatronGates(request.data?.gates || request.data || {});
  const payload = {
    ...gates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedByUid: request.auth.uid,
    updatedByEmail: actorEmail
  };
  await db.collection("platformSettings").doc("patronFeatureGates").set(payload, {merge:true});
  await writeEntityManagementAudit({
    uid: request.auth.uid,
    email: actorEmail,
    action: "set_patron_feature_gates",
    detail: {gates},
    sessionId
  });
  return {ok:true, gates};
});

exports.setEntityAppEnabled = onCall({region:"us-central1", timeoutSeconds:30, memory:"256MiB"}, async request => {
  const {email: actorEmail, sessionId} = await assertSos2faSession(request);
  const entityType = text(request.data?.entityType || "club", 40).toLowerCase();
  const entityId = text(request.data?.entityId, 120);
  const enabled = request.data?.enabled !== false;
  if (!entityId) throw new HttpsError("invalid-argument", "entityId is required.");

  if (entityType === "club" || entityType === "venue" || entityType === "location") {
    const ref = db.collection("clubLocations").doc(entityId);
    const snap = await ref.get();
    const row = snap.exists ? snap.data() || {} : {};
    if (row.offboarded === true || String(row.status || "").toLowerCase() === "offboarded") {
      throw new HttpsError("failed-precondition", "Offboarded clubs cannot be re-enabled from this switch. Recreate or restore manually.");
    }
    await ref.set({
      appEnabled: enabled,
      active: enabled ? (row.active !== false) : false,
      status: enabled ? "active" : "disabled",
      disabledAt: enabled ? null : admin.firestore.FieldValue.serverTimestamp(),
      disabledByUid: enabled ? null : request.auth.uid,
      disabledByEmail: enabled ? null : actorEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    await writeEntityManagementAudit({
      uid: request.auth.uid,
      email: actorEmail,
      action: enabled ? "entity_enabled" : "entity_disabled",
      detail: {entityType: "club", entityId, appEnabled: enabled},
      sessionId
    });
    return {ok:true, entityType:"club", entityId, appEnabled:enabled};
  }

  if (entityType === "event") {
    const ref = db.collection("events").doc(entityId);
    await ref.set({
      appEnabled: enabled,
      active: enabled,
      status: enabled ? "active" : "disabled",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      disabledByEmail: enabled ? null : actorEmail
    }, {merge:true});
    await writeEntityManagementAudit({
      uid: request.auth.uid,
      email: actorEmail,
      action: enabled ? "entity_enabled" : "entity_disabled",
      detail: {entityType: "event", entityId, appEnabled: enabled},
      sessionId
    });
    return {ok:true, entityType:"event", entityId, appEnabled:enabled};
  }

  if (entityType === "user" || entityType === "patron" || entityType === "entity") {
    const user = await loadUserByIdOrEmail(entityId, request.data?.email);
    if (!user?.uid) throw new HttpsError("not-found", "Patron/entity not found.");
    protectSuperAdminEntity(user, enabled ? "enable" : "disable");
    await db.collection("users").doc(user.uid).set({
      appEnabled: enabled,
      status: enabled ? (user.status === "offboarded" ? "offboarded" : "active") : "disabled",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      disabledByUid: enabled ? null : request.auth.uid,
      disabledByEmail: enabled ? null : actorEmail
    }, {merge:true});
    await writeEntityManagementAudit({
      uid: request.auth.uid,
      email: actorEmail,
      action: enabled ? "entity_enabled" : "entity_disabled",
      detail: {entityType: "user", entityId: user.uid, appEnabled: enabled},
      sessionId
    });
    return {ok:true, entityType:"user", entityId:user.uid, appEnabled:enabled};
  }

  throw new HttpsError("invalid-argument", `Unsupported entityType: ${entityType}`);
});

exports.setVenueFeatureGates = onCall({region:"us-central1", timeoutSeconds:30, memory:"256MiB"}, async request => {
  const {email: actorEmail, sessionId} = await assertSos2faSession(request);
  const clubId = text(request.data?.clubId || request.data?.entityId, 120);
  if (!clubId) throw new HttpsError("invalid-argument", "clubId is required.");
  const gates = normalizeVenueGates(request.data?.gates || request.data?.featureGates || {});
  await db.collection("clubLocations").doc(clubId).set({
    featureGates: gates,
    featureGatesUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    featureGatesUpdatedByUid: request.auth.uid,
    featureGatesUpdatedByEmail: actorEmail,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  await writeEntityManagementAudit({
    uid: request.auth.uid,
    email: actorEmail,
    action: "set_venue_feature_gates",
    detail: {clubId, featureGates: gates},
    sessionId
  });
  return {ok:true, clubId, featureGates:gates};
});

exports.offboardEntity = onCall({region:"us-central1", timeoutSeconds:60, memory:"512MiB"}, async request => {
  const {email: actorEmail, sessionId} = await assertSos2faSession(request);
  const entityType = text(request.data?.entityType || "club", 40).toLowerCase();
  const entityId = text(request.data?.entityId, 120);
  const confirmName = text(request.data?.confirmName, 200);
  if (!entityId) throw new HttpsError("invalid-argument", "entityId is required.");
  if (!confirmName) throw new HttpsError("invalid-argument", "Type the entity name to confirm offboarding.");

  if (entityType === "club" || entityType === "venue" || entityType === "location") {
    const ref = db.collection("clubLocations").doc(entityId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Club not found.");
    const row = snap.data() || {};
    const expected = text(row.locationName || row.brandName || entityId, 200);
    if (confirmName.toLowerCase() !== expected.toLowerCase() && confirmName.toLowerCase() !== entityId.toLowerCase()) {
      throw new HttpsError("failed-precondition", `Confirmation name must match "${expected}" or the club id.`);
    }
    const clearPayload = {};
    CLUB_PUBLIC_CLEAR_FIELDS.forEach(field => { clearPayload[field] = admin.firestore.FieldValue.delete(); });
    await ref.set({
      ...clearPayload,
      appEnabled: false,
      active: false,
      offboarded: true,
      publicVisible: false,
      publicProfileEnabled: false,
      status: "offboarded",
      offboardedAt: admin.firestore.FieldValue.serverTimestamp(),
      offboardedByUid: request.auth.uid,
      offboardedByEmail: actorEmail,
      offboardNote: text(request.data?.note || "Offboarded by Master Admin — public profile and datapoints removed from WebApp.", 400),
      locationName: expected,
      brandName: text(row.brandName || expected, 200),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge:true});

    try {
      const mediaSnap = await db.collection("clubMedia").where("clubLocationId", "==", entityId).limit(200).get();
      const batch = db.batch();
      mediaSnap.docs.forEach(doc => batch.set(doc.ref, {active:false, status:"offboarded", updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true}));
      if (!mediaSnap.empty) await batch.commit();
    } catch (e) {}

    try {
      await db.collection("aiIndex").doc(`clubLocation_${entityId}`).set({
        active: false,
        publicVisible: false,
        status: "offboarded",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    } catch (e) {}

    await writeEntityManagementAudit({
      uid: request.auth.uid,
      email: actorEmail,
      action: "entity_offboarded",
      detail: {entityType: "club", entityId},
      sessionId
    });
    return {ok:true, entityType:"club", entityId, offboarded:true};
  }

  if (entityType === "user" || entityType === "patron" || entityType === "entity") {
    const user = await loadUserByIdOrEmail(entityId, request.data?.email);
    if (!user?.uid) throw new HttpsError("not-found", "Patron/entity not found.");
    protectSuperAdminEntity(user, "offboard");
    const expected = text(user.displayName || user.fullName || user.floqrHandle || user.email || user.uid, 200);
    if (confirmName.toLowerCase() !== expected.toLowerCase() && confirmName.toLowerCase() !== text(user.email, 200).toLowerCase() && confirmName.toLowerCase() !== user.uid.toLowerCase()) {
      throw new HttpsError("failed-precondition", `Confirmation name must match "${expected}", email, or uid.`);
    }
    await db.collection("users").doc(user.uid).set({
      appEnabled: false,
      offboarded: true,
      status: "offboarded",
      publicVisible: false,
      profileCompleted: false,
      displayName: expected,
      publicBio: admin.firestore.FieldValue.delete(),
      bio: admin.firestore.FieldValue.delete(),
      photoURL: admin.firestore.FieldValue.delete(),
      profileMedia: admin.firestore.FieldValue.delete(),
      galleryUrls: admin.firestore.FieldValue.delete(),
      instagram: admin.firestore.FieldValue.delete(),
      socialMediaHandles: admin.firestore.FieldValue.delete(),
      offboardedAt: admin.firestore.FieldValue.serverTimestamp(),
      offboardedByUid: request.auth.uid,
      offboardedByEmail: actorEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    await writeEntityManagementAudit({
      uid: request.auth.uid,
      email: actorEmail,
      action: "entity_offboarded",
      detail: {entityType: "user", entityId: user.uid},
      sessionId
    });
    return {ok:true, entityType:"user", entityId:user.uid, offboarded:true};
  }

  if (entityType === "event") {
    const ref = db.collection("events").doc(entityId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Event not found.");
    const row = snap.data() || {};
    const expected = text(row.title || row.name || entityId, 200);
    if (confirmName.toLowerCase() !== expected.toLowerCase() && confirmName.toLowerCase() !== entityId.toLowerCase()) {
      throw new HttpsError("failed-precondition", `Confirmation name must match "${expected}" or the event id.`);
    }
    await ref.set({
      appEnabled: false,
      active: false,
      offboarded: true,
      publicVisible: false,
      status: "offboarded",
      description: admin.firestore.FieldValue.delete(),
      imageUrl: admin.firestore.FieldValue.delete(),
      ticketUrl: admin.firestore.FieldValue.delete(),
      offboardedAt: admin.firestore.FieldValue.serverTimestamp(),
      offboardedByEmail: actorEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      title: expected
    }, {merge:true});
    await writeEntityManagementAudit({
      uid: request.auth.uid,
      email: actorEmail,
      action: "entity_offboarded",
      detail: {entityType: "event", entityId},
      sessionId
    });
    return {ok:true, entityType:"event", entityId, offboarded:true};
  }

  throw new HttpsError("invalid-argument", `Unsupported entityType: ${entityType}`);
});

/** Shared helpers for other callables. */
exports.__featureGateHelpers = {
  SUPER_ADMIN_EMAILS,
  MASTER_ADMIN_EMAILS,
  DEFAULT_PATRON_GATES,
  DEFAULT_VENUE_GATES,
  isSuperAdminAuth,
  normalizePatronGates,
  normalizeVenueGates,
  async assertClubFeature(clubId, featureKey) {
    const snap = await db.collection("clubLocations").doc(String(clubId || "")).get();
    if (!snap.exists) return true;
    const row = snap.data() || {};
    if (row.offboarded === true || row.appEnabled === false || String(row.status || "").toLowerCase() === "offboarded") {
      throw new HttpsError("failed-precondition", "This venue is disabled or offboarded and cannot use FLOQR features.");
    }
    const gates = normalizeVenueGates(row.featureGates || {});
    if (gates[featureKey] === false) {
      throw new HttpsError("failed-precondition", `This venue does not have ${featureKey} enabled.`);
    }
    return true;
  },
  async assertPatronFeature(authContext, featureKey) {
    if (isSuperAdminAuth(authContext)) return true;
    const snap = await db.collection("platformSettings").doc("patronFeatureGates").get();
    const gates = normalizePatronGates(snap.exists ? snap.data() : {});
    if (gates[featureKey] === false) {
      throw new HttpsError("failed-precondition", `${featureKey} is currently disabled for patrons.`);
    }
    return true;
  }
};
