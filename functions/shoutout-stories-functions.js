/* getShoutoutStories — approved ShoutOuts for Mingl Gist without contact details (shoutouts are owner + club in rules).
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const core = require("./shoutout-stories-core");
const dc = require("./data-classification-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const JOB = "shoutoutStories";
const CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};

function systemCollection(collection) {
  dc.systemJob(JOB, collection);
  return db.collection(collection);
}

exports.getShoutoutStories = onCall(CALL_OPTS, async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to see Mingl Gist.");
  try {
    const snap = await systemCollection("shoutouts").orderBy("submittedAt", "desc").limit(core.SCAN_LIMIT).get();
    return {ok: true, stories: core.project(snap.docs.map(doc => ({id: doc.id, data: doc.data() || {}})))};
  } catch (error) {
    console.error("shoutout stories failed", error?.message || error);
    throw new HttpsError("internal", "Could not load ShoutOut stories. Try again.");
  }
});
