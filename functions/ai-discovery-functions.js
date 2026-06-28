/* FLOQR AI backend scaffold.
   Deploy later from a Firebase Functions or Cloud Run Functions project.
   This file is intentionally not loaded by the static GitHub Pages app. */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const DEFAULT_ALLOWED_CATEGORIES = [
  "nightclub",
  "beachClub",
  "lounge",
  "brunchParty",
  "poolParty",
  "summerParty",
  "event",
  "djEvent",
  "promoterEvent",
  "comedyShow",
  "ticketResaleEvent"
];

async function crawlPublicEventSources() {
  const sources = await db.collection("aiDiscoverySources").where("enabled", "==", true).get();
  const discovered = [];
  sources.forEach(doc => {
    const source = {id:doc.id, ...doc.data()};
    discovered.push({
      sourceName:source.sourceName,
      sourceUrl:source.sourceUrl,
      proposedType:"event",
      proposedTitle:"Placeholder public discovery record",
      proposedDescription:"Connect Ticketmaster, Eventbrite, official venue feeds, and approved resale partner APIs here.",
      categories:source.allowedCategories || DEFAULT_ALLOWED_CATEGORIES,
      status:"pendingReview"
    });
  });
  return discovered;
}

async function classifyDiscoveryRecord(record) {
  return {
    ...record,
    aiSummary:record.proposedDescription || "",
    aiConfidenceScore:0.5,
    aiStarRating:3,
    aiRatingReasons:["Scaffolded classification. Replace with Gemini structured JSON classification."],
    updatedAt:admin.firestore.FieldValue.serverTimestamp()
  };
}

async function writeDiscoveryQueueItem(record) {
  const ref = db.collection("aiDiscoveryQueue").doc();
  await ref.set({
    ...record,
    status:"pendingReview",
    createdAt:admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:admin.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

exports.scheduledAiDiscoveryCrawl = functions.pubsub
  .schedule("every 4 hours")
  .onRun(async () => {
    const records = await crawlPublicEventSources();
    for (const record of records) {
      const classified = await classifyDiscoveryRecord(record);
      await writeDiscoveryQueueItem(classified);
    }
    return null;
  });

exports.aiSearch = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  return {answer:"AI search backend is scaffolded. Static local search remains active.", results:[], suggestedActions:[]};
});

exports.aiSuggestShoutOut = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  return {mainText:String(data?.mainText || "BIG ShoutOut").slice(0, 36), subText:"Curated fallback until Gemini is configured.", safetyStatus:"passed"};
});

exports.aiGenerateTemplateBackground = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  return {status:"notConfigured", message:"Configure Firebase AI Logic, Gemini, Imagen, or an approved image provider server-side."};
});

exports.aiModifyTemplateBackground = exports.aiGenerateTemplateBackground;
exports.aiSummarizeAdminQueue = exports.aiSearch;
exports.aiGenerateRecommendation = exports.aiSearch;
exports.aiProcessNotificationPreferences = exports.aiSearch;
