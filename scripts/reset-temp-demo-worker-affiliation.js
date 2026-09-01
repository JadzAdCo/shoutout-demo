/* Clear club affiliation for a temp QA worker so association walkthrough starts fresh. */
"use strict";

const path = require("path");
const admin = require("../functions/node_modules/firebase-admin");
const fauth = require(path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib/auth"));
const showcase = require("../floqr-temp-qa-showcase.js");

const TARGET_EMAIL = String(process.argv[2] || "temp_waitress_1@floqr-demo.com").trim().toLowerCase();

function matchDemoWorker(email = "") {
  return String(email).toLowerCase().match(/^temp_(clubadmin|dj|waitress|waiter|busboy|bottle|promoter|bartender)_(\d+)@floqr-demo\.com$/);
}

(async () => {
  const fs = require("fs");
  const os = require("os");
  const scopes = require(path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib/scopes"));
  const api = require(path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib/api"));
  const account = fauth.getGlobalDefaultAccount();
  const refreshToken = account && account.tokens && account.tokens.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI has no refresh token. Run: firebase login");

  const tokenInfo = await fauth.getAccessToken(refreshToken, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  if (!tokenInfo || !tokenInfo.access_token) throw new Error("Unable to refresh Firebase CLI access token");

  const adcPath = path.join(os.tmpdir(), `floqr-reset-demo-adc-${process.pid}.json`);
  fs.writeFileSync(adcPath, JSON.stringify({
    type: "authorized_user",
    client_id: api.clientId(),
    client_secret: api.clientSecret(),
    refresh_token: refreshToken
  }), {encoding: "utf8", mode: 0o600});
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
  process.env.GCLOUD_PROJECT = "shoutoutdemo-5b402";
  process.env.GOOGLE_CLOUD_PROJECT = "shoutoutdemo-5b402";

  try {
    admin.initializeApp({
      projectId: "shoutoutdemo-5b402",
      credential: admin.credential.applicationDefault()
    });
    const db = admin.firestore();
    const auth = admin.auth();
    const match = matchDemoWorker(TARGET_EMAIL);
    if (!match) throw new Error(`Not a temp demo worker email: ${TARGET_EMAIL}`);
    const role = match[1];
    if (!showcase.roleSkipsAutoClubAffiliation(role)) {
      throw new Error(`${TARGET_EMAIL} is a club admin demo account and stays affiliated. Use a worker email such as temp_waitress_1@floqr-demo.com`);
    }

    let uid = "";
    try {
      uid = (await auth.getUserByEmail(TARGET_EMAIL)).uid;
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    let userDocId = uid;
    if (!userDocId) {
      const byEmail = await db.collection("users").where("email", "==", TARGET_EMAIL).limit(1).get();
      if (!byEmail.empty) userDocId = byEmail.docs[0].id;
    }

    const deleteFields = {
      affiliatedClubId: admin.firestore.FieldValue.delete(),
      affiliatedClubName: admin.firestore.FieldValue.delete(),
      affiliatedClubLocationId: admin.firestore.FieldValue.delete(),
      affiliatedClubLocationIds: admin.firestore.FieldValue.delete(),
      approvedRoles: admin.firestore.FieldValue.delete(),
      requestedClubLocationIds: admin.firestore.FieldValue.delete(),
      requestedRoles: admin.firestore.FieldValue.delete(),
      pendingClubLocationId: admin.firestore.FieldValue.delete(),
      clubLocationId: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      qaTemp: true
    };

    if (userDocId) {
      const n = Number(match[2]);
      const profilePatch = showcase.userProfilePatch(role, n, userDocId);
      await db.collection("users").doc(userDocId).set({...profilePatch, ...deleteFields}, {merge: true});
    }

    let designationsDeleted = 0;
    if (userDocId) {
      const designations = await db.collection("clubEmployeeDesignations").where("workerUid", "==", userDocId).limit(200).get();
      const batch = db.batch();
      designations.docs.forEach(doc => {
        batch.delete(doc.ref);
        designationsDeleted += 1;
      });
      if (designationsDeleted) await batch.commit();
    }

    let associationRequestsDeleted = 0;
    if (userDocId) {
      const requests = await db.collection("workerAssociationRequests").where("workerUid", "==", userDocId).limit(200).get();
      const batch = db.batch();
      requests.docs.forEach(doc => {
        batch.delete(doc.ref);
        associationRequestsDeleted += 1;
      });
      if (associationRequestsDeleted) await batch.commit();
    }

    console.log(JSON.stringify({
      ok: true,
      email: TARGET_EMAIL,
      uid: userDocId || null,
      authUserExists: !!uid,
      designationsDeleted,
      associationRequestsDeleted,
      note: uid ? "User profile cleared of club affiliation." : "No Auth/Firestore user yet — first OTP sign-in will create a clean profile if seed rules are deployed."
    }, null, 2));
  } finally {
    try { fs.unlinkSync(adcPath); } catch (_e) {}
  }
  process.exit(0);
})().catch(err => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
