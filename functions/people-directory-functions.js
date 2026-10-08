/* getPeopleDirectory — other patrons' profiles without private fields (users is self + Master Admin in rules).
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const core = require("./people-directory-core");
const dc = require("./data-classification-core");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const JOB = "peopleDirectory";
const CALL_OPTS = {region: "us-central1", timeoutSeconds: 60, memory: "512MiB"};

function systemCollection(collection) {
  dc.systemJob(JOB, collection);
  return db.collection(collection);
}

async function isClubManager(auth, clubLocationId) {
  const snap = await systemCollection("clubLocations").doc(clubLocationId).get();
  if (!snap.exists) return false;
  const club = snap.data() || {};
  const email = String(auth.token?.email || "").trim().toLowerCase();
  const inList = (list, value) => Array.isArray(list) && !!value && list.map(x => String(x || "").toLowerCase()).includes(String(value).toLowerCase());
  if (inList(club.adminUids, auth.uid) || inList(club.masterAdminUids, auth.uid) || inList(club.adminEmails, email)) return true;
  const assignment = await systemCollection("clubAdminAssignments").doc(`${clubLocationId}_${auth.uid}`).get();
  return assignment.exists && String(assignment.data()?.status || "").toLowerCase() === "active";
}

async function affiliatedUids(clubLocationId) {
  const [designations, requests] = await Promise.all([
    systemCollection("clubEmployeeDesignations").where("clubLocationId", "==", clubLocationId).limit(500).get(),
    systemCollection("workerAssociationRequests").where("clubLocationId", "==", clubLocationId).limit(500).get()
  ]);
  const ids = new Set();
  designations.docs.forEach(doc => { const uid = doc.data()?.workerUid || doc.data()?.uid; if (uid) ids.add(String(uid)); });
  requests.docs.forEach(doc => { const uid = doc.data()?.uid || doc.data()?.requesterUid || doc.data()?.workerUid; if (uid) ids.add(String(uid)); });
  return ids;
}

async function connectedUids(uid) {
  const [connections, rooms] = await Promise.all([
    systemCollection("minglConnections").where("participants", "array-contains", uid).limit(500).get(),
    systemCollection("chatRooms").where("participants", "array-contains", uid).limit(500).get()
  ]);
  const ids = new Set();
  [...connections.docs, ...rooms.docs].forEach(doc => (doc.data()?.participants || []).forEach(other => { if (other && other !== uid) ids.add(String(other)); }));
  return ids;
}

async function loadRows(request) {
  if (request.mode === "uids") {
    const snaps = await db.getAll(...request.uids.map(uid => systemCollection("users").doc(uid)));
    return snaps.filter(snap => snap.exists).map(snap => ({id: snap.id, data: snap.data() || {}}));
  }
  const snap = await systemCollection("users").limit(core.SCAN_LIMIT).get();
  return snap.docs.map(doc => ({id: doc.id, data: doc.data() || {}}));
}

exports.getPeopleDirectory = onCall(CALL_OPTS, async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to see FLOQR members.");
  let request;
  try {
    request = core.validateRequest(req.data || {});
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  try {
    const viewer = await audit.viewerFor(req.auth);
    const facts = {uid: req.auth.uid, isMasterAdmin: !!viewer.isMasterAdmin};
    if (request.mode === "club") {
      if (!facts.isMasterAdmin && !(await isClubManager(req.auth, request.clubLocationId))) {
        throw new HttpsError("permission-denied", "Only this club's admins can see its people.");
      }
      facts.affiliatedUids = await affiliatedUids(request.clubLocationId);
    }
    if (request.mode === "contacts" || request.mode === "uids") facts.connectedUids = await connectedUids(req.auth.uid);
    const people = core.project(request.mode, await loadRows(request), facts).slice(0, request.limit);
    return {ok: true, mode: request.mode, people};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("people directory failed", error?.message || error);
    throw new HttpsError("internal", "Could not load FLOQR members. Try again.");
  }
});

exports.__peopleDirectoryHelpers = {isClubManager, affiliatedUids, connectedUids};
