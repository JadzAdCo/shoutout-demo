/**
 * Patron DSAR — export + delete fulfillment (GDPR Art. 15/17 / CCPA).
 * Design notes: .cursor/rules/design-notes-privacy-compliance-safe-rollout.mdc
 */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

const EXPORT_COLLECTIONS = [
  {name: "shoutouts", field: "uid"},
  {name: "shoutouts", field: "ownerUid"},
  {name: "spotAdCampaigns", field: "publishedByUid"},
  {name: "privacyConsents", field: "uid"},
  {name: "inboxNotifications", field: "uid"},
  {name: "scheduleShifts", field: "assigneeUid"},
  {name: "minglGists", field: "authorUid"}
];

function text(value, max = 240) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function isMasterAdmin(authContext = {}) {
  const email = text(authContext.token?.email, 200).toLowerCase();
  return authContext.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email);
}

async function queryByUid(collection, field, uid, limit = 80) {
  try {
    const snap = await db.collection(collection).where(field, "==", uid).limit(limit).get();
    return snap.docs.map((doc) => ({id: doc.id, ...doc.data()}));
  } catch (err) {
    return [{_queryError: text(err?.message, 200), collection, field}];
  }
}

function stripSensitive(profile = {}) {
  const copy = {...profile};
  delete copy.masterAdmin;
  delete copy.stripeCustomerId;
  return copy;
}

exports.exportPatronData = onCall({
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "512MiB"
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  const profile = userSnap.exists ? stripSensitive(userSnap.data() || {}) : {};

  const bundles = {};
  for (const row of EXPORT_COLLECTIONS) {
    const key = `${row.name}:${row.field}`;
    const rows = await queryByUid(row.name, row.field, uid);
    bundles[key] = (bundles[key] || []).concat(rows);
  }

  await db.collection("privacyConsents").add({
    uid,
    email: text(request.auth.token?.email, 200),
    type: "exportRequest",
    status: "completed",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    exportedAt: new Date().toISOString(),
    uid,
    profile,
    bundles,
    notice: "Export includes profile plus related collections available to the server. Some indexes may omit rows if a composite index is missing."
  };
});

exports.requestPatronDelete = onCall({
  region: "us-central1",
  timeoutSeconds: 120,
  memory: "512MiB"
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const email = text(request.auth.token?.email, 200).toLowerCase();
  const confirm = text(request.data?.confirm, 40).toLowerCase();
  if (confirm !== "delete") {
    throw new HttpsError("invalid-argument", "Pass confirm:\"delete\" to erase this account.");
  }

  const ticketRef = await db.collection("privacyConsents").add({
    uid,
    email,
    type: "deleteRequest",
    status: "processing",
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const anon = {
    displayName: "Deleted user",
    fullName: "Deleted user",
    email: "",
    phoneNumber: "",
    phone: "",
    photoURL: "",
    profilePhotoUrl: "",
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    deletionTicketId: ticketRef.id,
    marketingConsent: false,
    analyticsConsent: false,
    dataSharingConsent: false,
    doNotSellOrShare: true,
    notifyEmail: false,
    notifySms: false,
    publicMinglDatapoints: [],
    profileCompleted: false
  };
  await db.collection("users").doc(uid).set(anon, {merge: true});

  // Soft-clear own spot ads and pending consents list kept for audit.
  try {
    const ads = await db.collection("spotAdCampaigns").where("publishedByUid", "==", uid).limit(40).get();
    const batch = db.batch();
    ads.docs.forEach((doc) => {
      batch.set(doc.ref, {
        status: "deleted",
        title: "Deleted",
        body: "",
        htmlBody: "",
        image: "",
        imageUrl: "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
    });
    await batch.commit();
  } catch (err) {
    console.warn("spotAdCampaigns clear", err?.message || err);
  }

  try {
    await auth.updateUser(uid, {
      displayName: "Deleted user",
      photoURL: null,
      disabled: true
    });
    try {
      await auth.deleteUser(uid);
    } catch (err) {
      console.warn("auth.deleteUser", err?.message || err);
    }
  } catch (err) {
    console.warn("auth update/disable", err?.message || err);
  }

  await ticketRef.set({
    status: "completed",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    fulfilledBy: "requestPatronDelete"
  }, {merge: true});

  return {
    ok: true,
    ticketId: ticketRef.id,
    message: "Account data anonymized and Auth user disabled/deleted where permitted."
  };
});

/** Master Admin can re-run fulfillment for stuck pending tickets. */
exports.fulfillPatronDelete = onCall({
  region: "us-central1",
  timeoutSeconds: 120,
  memory: "512MiB"
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (!isMasterAdmin(request.auth)) {
    throw new HttpsError("permission-denied", "Master Admin required.");
  }
  const ticketId = text(request.data?.ticketId, 120);
  const uid = text(request.data?.uid, 160);
  if (!ticketId && !uid) throw new HttpsError("invalid-argument", "ticketId or uid required.");

  let ticketRef = ticketId ? db.collection("privacyConsents").doc(ticketId) : null;
  let targetUid = uid;
  if (ticketRef) {
    const snap = await ticketRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Ticket not found.");
    targetUid = text(snap.data()?.uid, 160) || targetUid;
  }
  if (!targetUid) throw new HttpsError("invalid-argument", "uid missing.");

  await db.collection("users").doc(targetUid).set({
    displayName: "Deleted user",
    fullName: "Deleted user",
    email: "",
    phoneNumber: "",
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    marketingConsent: false,
    analyticsConsent: false,
    dataSharingConsent: false,
    doNotSellOrShare: true,
    publicMinglDatapoints: []
  }, {merge: true});

  try {
    await auth.deleteUser(targetUid);
  } catch (err) {
    try {
      await auth.updateUser(targetUid, {disabled: true, displayName: "Deleted user"});
    } catch (err2) {
      console.warn("fulfillPatronDelete auth", err2?.message || err2);
    }
  }

  if (ticketRef) {
    await ticketRef.set({
      status: "completed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      fulfilledBy: text(request.auth.uid, 160)
    }, {merge: true});
  }

  return {ok: true, uid: targetUid, ticketId: ticketId || null};
});
