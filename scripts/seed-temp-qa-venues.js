/* Seed Firestore clubLocations for temp-democlub-1..10 (QA only). */
"use strict";

const path = require("path");
const admin = require("../functions/node_modules/firebase-admin");
const fauth = require(path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib/auth"));

const showcase = require("../floqr-temp-qa-showcase.js");

function clubPayload(n) {
  const {people, ...row} = showcase.clubRecord(n, true);
  return {
    ...row,
    displayScreenFormatIds: ["led-96x48", "led-64x32"],
    primaryDisplayScreenFormatId: "led-96x48",
    secondaryDisplayScreenFormatId: "led-96x48",
    VenueSupports96x48: 1,
    VenueSupports64x48: 0,
    VenueSupports64x32: 1,
    publicProfileSections: {
      about: true, contact: true, upcomingEvents: true, pastEvents: true,
      featuredDjs: true, featuredStaff: true, promotionGroups: true, gallery: true
    },
    updatedBy: "seed-temp-qa-venues"
  };
}

(async () => {
  const fs = require("fs");
  const os = require("os");
  const scopes = require(path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib/scopes"));
  const api = require(path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib/api"));
  const account = fauth.getGlobalDefaultAccount();
  const refreshToken = account && account.tokens && account.tokens.refresh_token;
  if (!refreshToken) throw new Error("Firebase CLI has no refresh token. Run: firebase login");

  // Prove token refresh works, then build a temporary ADC file for Admin SDK.
  const tokenInfo = await fauth.getAccessToken(refreshToken, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
  if (!tokenInfo || !tokenInfo.access_token) throw new Error("Unable to refresh Firebase CLI access token");

  const adcPath = path.join(os.tmpdir(), `floqr-temp-qa-adc-${process.pid}.json`);
  const adc = {
    type: "authorized_user",
    client_id: api.clientId(),
    client_secret: api.clientSecret(),
    refresh_token: refreshToken
  };
  fs.writeFileSync(adcPath, JSON.stringify(adc), {encoding: "utf8", mode: 0o600});
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
  process.env.GCLOUD_PROJECT = "shoutoutdemo-5b402";
  process.env.GOOGLE_CLOUD_PROJECT = "shoutoutdemo-5b402";

  try {
    admin.initializeApp({
      projectId: "shoutoutdemo-5b402",
      credential: admin.credential.applicationDefault()
    });

    const db = admin.firestore();
    const preserveKeys = [
      "adminEmails", "adminUids", "clubAdminEmails", "clubAdminUids",
      "createdAt", "createdBy", "ownerUid", "ownerEmail"
    ];

    let clubsUpdated = 0;
    for (let n = 1; n <= 10; n += 1) {
      const id = `temp-democlub-${n}`;
      const ref = db.collection("clubLocations").doc(id);
      const existing = await ref.get();
      const keep = {};
      if (existing.exists) {
        const data = existing.data() || {};
        preserveKeys.forEach(key => {
          if (data[key] !== undefined) keep[key] = data[key];
        });
      }
      const payload = {
        ...clubPayload(n),
        ...keep,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      // Force document to match QA payload (preserve only admin/owner wiring).
      await ref.set(payload, {merge: false});
      clubsUpdated += 1;
    }

    let usersUpdated = 0;
    let lastDoc = null;
    for (;;) {
      let query = db.collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
      if (lastDoc) query = query.startAfter(lastDoc);
      const usersSnap = await query.get();
      if (!usersSnap.docs.length) break;
      for (const doc of usersSnap.docs) {
        const data = doc.data() || {};
        const email = String(data.email || "").toLowerCase();
        const match = email.match(/^temp_(clubadmin|dj|waitress|waiter|busboy|bottle|promoter|bartender)_(\d+)@floqr-demo\.com$/);
        if (!match) continue;
        const role = match[1];
        const n = Number(match[2]);
        const patch = showcase.userProfilePatch(role, n, doc.id);
        const mergePatch = {
          ...patch,
          email: data.email || patch.email,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (showcase.roleSkipsAutoClubAffiliation(role)) {
          mergePatch.affiliatedClubId = admin.firestore.FieldValue.delete();
          mergePatch.affiliatedClubName = admin.firestore.FieldValue.delete();
          mergePatch.affiliatedClubLocationId = admin.firestore.FieldValue.delete();
          mergePatch.affiliatedClubLocationIds = admin.firestore.FieldValue.delete();
          mergePatch.approvedRoles = admin.firestore.FieldValue.delete();
          mergePatch.requestedClubLocationIds = admin.firestore.FieldValue.delete();
          mergePatch.requestedRoles = admin.firestore.FieldValue.delete();
        }
        await doc.ref.set(mergePatch, {merge: true});
        usersUpdated += 1;
      }
      lastDoc = usersSnap.docs[usersSnap.docs.length - 1];
      if (usersSnap.docs.length < 300) break;
    }

    console.log(JSON.stringify({ok: true, clubsUpdated, usersUpdated}, null, 2));
  } finally {
    try { fs.unlinkSync(adcPath); } catch (_e) {}
  }
  process.exit(0);
})().catch(err => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
