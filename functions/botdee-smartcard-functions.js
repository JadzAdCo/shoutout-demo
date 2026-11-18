/* People SMARTcard v6 search — deterministic eligibility, then projections
   of the same usercharacter_analysis record used by People SmartView.
   Gemini may classify intent; it never decides account existence. */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const v2 = require("./botdee-smartview-v2-core");
const smart = require("./botdee-smartview-core");
const tools = require("./bot-dee-tools");
const people = require("./people-directory-core");
const cards = require("./botdee-smartcard-core");
const guard = require("./botdee-privilege-guard");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;

const CALL_OPTS = {
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "256MiB",
  invoker: "public"
};

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  console.error("people SMARTcard callable failed", error?.message || error);
  return new HttpsError("internal", "People search could not complete that request. Try again.");
}

async function requireBotDee(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to use SmartView.");
  await audit.assertFeatureAccess(request.auth, "botDee", request);
  return request.auth.uid;
}

async function isBlocked(a, b) {
  if (!a || !b || a === b) return false;
  const ids = [`${a}_${b}`, `${b}_${a}`];
  try {
    const snaps = await db.getAll(...ids.map(id => db.collection("userBlocks").doc(id)));
    return snaps.some(snap => {
      const data = snap.data() || {};
      return snap.exists && data.active !== false;
    });
  } catch (error) {
    console.warn("SMARTcard block lookup failed", error?.message || error);
    return false;
  }
}

async function writeDiagnostic(event) {
  try {
    await db.collection(v2.DIAGNOSTICS_COLLECTION).add({
      ...event,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
      summaryTextLogged: false
    });
  } catch (error) {
    console.warn("SMARTcard diagnostic write failed", error?.message || error);
  }
}

function sanitizePeopleViews(views) {
  return (Array.isArray(views) ? views : [])
    .map(view => guard.stripPrivilegeFromToolResult(view))
    .filter(view => view && !cards.peopleCardHasPrivilegeField(view));
}

function viewerLocaleOf(request, viewerData) {
  return v2.normalizeLocale(
    request?.data?.uiLanguage
    || viewerData?.uiLanguage
    || viewerData?.preferredLanguage
    || "en"
  );
}

async function loadAuthorizedPeopleView({viewerUid, subjectUid, uiLanguage, allowPrivateSelf}) {
  if (!subjectUid) return null;
  const blocked = await isBlocked(viewerUid, subjectUid);
  if (blocked) return {blocked: true, view: null};
  const snapUser = await db.collection("users").doc(subjectUid).get();
  if (!snapUser.exists) return {missing: true, view: null};
  const data = snapUser.data() || {};
  const isOwner = viewerUid === subjectUid;
  const published = people.isPublic(data);
  if (!isOwner && !published) return {hidden: true, view: null};
  if (!isOwner && !allowPrivateSelf && !published) return {hidden: true, view: null};
  const volunteered = v2.applyPublicPageMedia(tools.volunteeredPublicDatapoints(data), data);
  volunteered.uid = subjectUid;
  volunteered.viewerUid = viewerUid;
  volunteered.viewerLocale = v2.normalizeLocale(uiLanguage || "en");
  volunteered.handle = String(data.floqrHandle || data.username || "").replace(/^@+/, "");
  volunteered.instagram = data.instagramHandle || data.instagram;
  volunteered.xHandle = data.xHandle || data.twitter;
  volunteered.verified = data.identityVerified === 1 || data.floqrVerified === 1;
  volunteered.sourceLocale = v2.normalizeLocale(data.uiLanguage || data.preferredLanguage || "en");
  volunteered.bio = data.publicBio || data.bio || volunteered.bio;
  volunteered.minglHref = volunteered.handle
    ? `./?start=search&q=${encodeURIComponent("@" + volunteered.handle)}`
    : "./?start=search";
  const analysisSnap = await db.collection(v2.COLLECTION).doc(subjectUid).get();
  if (analysisSnap.exists) volunteered.analysis = analysisSnap.data();
  const view = smart.patronSmartView({
    displayName: data.displayName || data.publicName,
    volunteered,
    profileHref: isOwner ? "./patron-portal.html?tab=profile" : volunteered.minglHref,
    viewerMaySee: true
  });
  return {view, published, isOwner};
}

async function runPeopleSearch({query, page, uiLanguage, viewerUid, request}) {
  const started = Date.now();
  const classified = cards.classifyPeopleSearchIntent(query);
  if (classified.intent === "none") {
    return {handled: false, classified};
  }
  if (classified.intent === "empty") {
    const routed = cards.routePeopleSearch({matches: [], page});
    const meta = cards.peopleSearchMeta(routed, classified, query);
    await writeDiagnostic(v2.diagnosticEvent({
      kind: "people_smartcard_search",
      uid: viewerUid,
      latencyMs: Date.now() - started,
      jobStatus: "none",
      error: null
    }));
    return {
      handled: true,
      classified,
      routed,
      peopleSearch: {...meta, latencyMs: Date.now() - started},
      smartViews: sanitizePeopleViews(routed.views),
      reply: cards.fallbackReply(routed.mode)
    };
  }
  let lookupError = false;
  let selfView = null;
  let matches = [];
  try {
    if (classified.intent === "self") {
      const loaded = await loadAuthorizedPeopleView({
        viewerUid,
        subjectUid: viewerUid,
        uiLanguage,
        allowPrivateSelf: true
      });
      selfView = loaded && loaded.view ? loaded.view : null;
      if (!selfView) lookupError = true;
    } else {
      const looked = await tools.lookupPublicProfiles({
        query: classified.needle,
        kind: "user",
        limit: 12
      }, request);
      if (!looked || looked.ok === false) {
        lookupError = true;
      } else {
        const profiles = Array.isArray(looked.profiles) ? looked.profiles : [];
        for (const row of profiles) {
          if (!row || row.kind !== "user" || !row.id) continue;
          if (row.id === viewerUid) continue;
          const loaded = await loadAuthorizedPeopleView({
            viewerUid,
            subjectUid: row.id,
            uiLanguage,
            allowPrivateSelf: false
          });
          if (loaded && loaded.blocked) continue;
          if (loaded && loaded.hidden) continue;
          if (loaded && loaded.view) matches.push(loaded.view);
        }
      }
    }
  } catch (error) {
    console.warn("people SMARTcard search failed", error?.message || error);
    lookupError = true;
  }
  const routed = cards.routePeopleSearch({
    self: selfView,
    matches,
    error: lookupError,
    page
  });
  const meta = cards.peopleSearchMeta(routed, classified, query);
  await writeDiagnostic(v2.diagnosticEvent({
    kind: "people_smartcard_search",
    uid: viewerUid,
    latencyMs: Date.now() - started,
    jobStatus: lookupError ? "failed" : routed.mode,
    error: lookupError ? "lookup_failed" : null
  }));
  return {
    handled: true,
    classified,
    routed,
    peopleSearch: {
      ...meta,
      latencyMs: Date.now() - started
    },
    smartViews: sanitizePeopleViews(routed.views),
    reply: cards.fallbackReply(routed.mode)
  };
}

async function attachPeopleSearch({query, viewerUid, uiLanguage, request, page}) {
  const result = await runPeopleSearch({
    query,
    page,
    uiLanguage,
    viewerUid,
    request
  });
  if (!result.handled) return result;
  return {
    handled: true,
    smartViews: result.smartViews,
    peopleSearch: result.peopleSearch,
    reply: result.reply
  };
}

exports.attachPeopleSearch = attachPeopleSearch;
exports.loadAuthorizedPeopleView = loadAuthorizedPeopleView;
exports.runPeopleSearch = runPeopleSearch;
exports.classifyPeopleSearchIntent = cards.classifyPeopleSearchIntent;
exports.canonicalPeopleLookupQuery = cards.canonicalPeopleLookupQuery;

exports.searchPeopleSmartCards = onCall(CALL_OPTS, async request => {
  try {
    const viewerUid = await requireBotDee(request);
    const query = String(request.data?.query || "").trim();
    if (!query) throw new HttpsError("invalid-argument", "query required.");
    const viewerSnap = await db.collection("users").doc(viewerUid).get();
    const viewerData = viewerSnap.exists ? viewerSnap.data() : {};
    const uiLanguage = viewerLocaleOf(request, viewerData);
    const result = await runPeopleSearch({
      query,
      page: request.data?.page,
      uiLanguage,
      viewerUid,
      request
    });
    if (!result.handled) {
      return {
        ok: true,
        handled: false,
        views: [],
        peopleSearch: {mode: "none", intent: "none", geminiOnView: false},
        geminiOnView: false
      };
    }
    return {
      ok: true,
      handled: true,
      views: result.smartViews,
      peopleSearch: result.peopleSearch,
      reply: result.reply,
      geminiOnView: false
    };
  } catch (error) {
    throw asHttps(error);
  }
});
