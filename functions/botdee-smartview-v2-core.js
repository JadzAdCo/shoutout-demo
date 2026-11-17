/* People SmartView v2 — public-within-FLOQR fields, owner-authored summaries,
   revisioned translation queue. No Gemini on view. No live Places/Yelp.
   Firestore collection key: usercharacter_analysis/{uid} */
"use strict";

const crypto = require("crypto");

const COLLECTION = "usercharacter_analysis";
const JOBS_COLLECTION = "smartViewTranslationJobs";
const DIAGNOSTICS_COLLECTION = "botDeeSmartViewDiagnostics";
const SCHEMA_VERSION = "floqr.peopleSmartView/2";
const SUMMARY_MAX = 1400;
const REASON_MIN = 8;
const SUPPORTED_LOCALES = Object.freeze([
  "en", "de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"
]);
const PRIMARY_TABS = Object.freeze(["Social", "Dating", "Dining", "Future Travels"]);
const SOCIAL_SUBTABS = Object.freeze(["Music", "Nightlife", "Sports", "Events"]);
const DINING_SUBTABS = Object.freeze(["Cuisines", "Experiences"]);
const TRAVEL_SUBTABS = Object.freeze(["Upcoming", "Past", "Interests"]);
const DATING_SUBTABS = Object.freeze(["Preferences", "Discovery"]);
const DEFAULT_PRIMARY = "Social";
const DEFAULT_SOCIAL = "Music";
const JOB_MAX_ATTEMPTS = 5;

const SPORTS_HINTS = Object.freeze([
  "nba", "basketball", "formula 1", "f1", "soccer", "football", "nfl", "mlb",
  "tennis", "golf", "hockey", "ufc", "boxing", "f1"
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function text(value, max = 160) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function listOf(value, max = 24) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[,;/|]+/);
  const out = [];
  const seen = new Set();
  items.forEach(item => {
    const token = text(item, 80);
    const key = token.toLowerCase();
    if (!token || seen.has(key)) return;
    seen.add(key);
    out.push(token);
  });
  return out.slice(0, max);
}

function normalizeLocale(code, fallback = "en") {
  const raw = String(code || "").trim().toLowerCase().replace(/_/g, "-");
  const base = raw.split("-")[0];
  if (SUPPORTED_LOCALES.includes(base)) return base;
  if (SUPPORTED_LOCALES.includes(raw)) return raw;
  return fallback;
}

function sanitizeHandle(value) {
  const raw = text(value, 80).replace(/^@+/, "");
  if (!raw || /[\s<>]/.test(raw)) return "";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(raw)) return "";
  return raw;
}

function sanitizeHref(href) {
  const raw = String(href || "").trim();
  if (!raw || /javascript:/i.test(raw) || /data:/i.test(raw)) return "";
  if (raw.startsWith("./") || raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch (_) {
    return "";
  }
}

function defaultSubtab(primary) {
  if (primary === "Social") return DEFAULT_SOCIAL;
  if (primary === "Dating") return DATING_SUBTABS[0];
  if (primary === "Dining") return DINING_SUBTABS[0];
  if (primary === "Future Travels") return TRAVEL_SUBTABS[0];
  return DEFAULT_SOCIAL;
}

function selectTabs(primary, secondary) {
  const top = PRIMARY_TABS.includes(primary) ? primary : DEFAULT_PRIMARY;
  const allowed = top === "Social" ? SOCIAL_SUBTABS
    : top === "Dating" ? DATING_SUBTABS
    : top === "Dining" ? DINING_SUBTABS
    : TRAVEL_SUBTABS;
  const sub = allowed.includes(secondary) ? secondary : allowed[0];
  return {primary: top, secondary: sub, subtabs: allowed};
}

function emptyCategories() {
  return {
    Social: {Music: [], Nightlife: [], Sports: [], Events: []},
    Dating: {Preferences: [], Discovery: []},
    Dining: {Cuisines: [], Experiences: []},
    "Future Travels": {Upcoming: [], Past: [], Interests: []}
  };
}

function publicFieldsSnapshot(profile = {}, volunteered = null) {
  const v = volunteered && typeof volunteered === "object" ? volunteered : {datapoints: {}, sharedDatapoints: []};
  const dp = v.datapoints && typeof v.datapoints === "object" ? v.datapoints : {};
  const shared = Array.isArray(v.sharedDatapoints) ? v.sharedDatapoints : [];
  const mediaAllowed = shared.includes("media");
  const instagram = sanitizeHandle(profile.instagramHandle || profile.instagram);
  const xHandle = sanitizeHandle(profile.xHandle || profile.twitter || profile.x);
  const city = dp.location && dp.location.city ? text(dp.location.city, 80) : "";
  const photos = mediaAllowed && Array.isArray(profile.publicPhotos) ? profile.publicPhotos : [];
  return {
    displayName: text(profile.displayName || profile.publicName || "", 120),
    handle: text((profile.floqrHandle || profile.username || "").replace(/^@+/, ""), 80),
    city,
    instagram,
    xHandle,
    music: listOf(dp.music),
    nightlife: listOf([dp.nightlifeStyle, ...(Array.isArray(dp.events) ? dp.events : [])].filter(Boolean)),
    sports: listOf((dp.hobbies || []).filter(item => {
      const n = String(item || "").toLowerCase();
      return SPORTS_HINTS.some(hint => n.includes(hint));
    })),
    events: listOf(dp.events),
    hobbies: listOf(dp.hobbies),
    cuisines: listOf(dp.cuisines || dp.food),
    food: listOf(dp.food),
    beverages: listOf(dp.beverages),
    pastTravel: listOf(dp.travel),
    futureTravel: listOf(dp.futureTravel),
    lookingToMeet: shared.includes("meet") ? text(dp.lookingToMeet, 200) : "",
    datingOptIn: !!(shared.includes("meet") && dp.lookingToMeet),
    bio: text(v.bio || dp.bio || "", 400),
    photoCount: mediaAllowed ? Number(dp.photoCount || photos.length || 0) : 0,
    photoUrl: mediaAllowed ? text(profile.photoURL || profile.publicPhotoUrl || "", 500) : "",
    verified: profile.identityVerified === 1 || profile.floqrVerified === 1,
    sourceLocale: normalizeLocale(profile.preferredLanguage || profile.uiLanguage || "en")
  };
}

function publicFieldsHash(snapshot) {
  const copy = {...snapshot};
  delete copy.photoUrl;
  return sha256(JSON.stringify(copy));
}

function categoriesFromSnapshot(snap) {
  const cats = emptyCategories();
  cats.Social.Music = listOf(snap.music);
  cats.Social.Nightlife = listOf(snap.nightlife);
  cats.Social.Sports = listOf(snap.sports);
  cats.Social.Events = listOf(snap.events);
  cats.Dining.Cuisines = listOf(snap.cuisines);
  cats.Dining.Experiences = [];
  cats["Future Travels"].Upcoming = listOf(snap.futureTravel);
  cats["Future Travels"].Past = listOf(snap.pastTravel);
  if (snap.datingOptIn && snap.lookingToMeet) {
    cats.Dating.Preferences = [snap.lookingToMeet];
  }
  return cats;
}

function draftSummaryFromPublicFields(snap) {
  const name = snap.displayName || "This patron";
  const bits = [];
  if (snap.music.length) bits.push(`enjoys ${snap.music.slice(0, 6).join(", ")}`);
  if (snap.nightlife.length) bits.push(`goes out for ${snap.nightlife.slice(0, 4).join(", ")}`);
  if (snap.sports.length) bits.push(`follows ${snap.sports.slice(0, 4).join(", ")}`);
  if (snap.cuisines.length) bits.push(`likes ${snap.cuisines.slice(0, 4).join(", ")} food`);
  if (snap.pastTravel.length) bits.push(`has shared past travel in ${snap.pastTravel.slice(0, 4).join(", ")}`);
  if (snap.futureTravel.length) bits.push(`has an upcoming trip to ${snap.futureTravel.slice(0, 3).join(", ")}`);
  if (!bits.length) {
    const bio = text(snap.bio, 280);
    if (bio) return text(`${name} ${bio.charAt(0).toLowerCase() === bio.charAt(0) ? bio : bio}`, SUMMARY_MAX);
    return text(`${name} has a FLOQR public-within-app profile.`, SUMMARY_MAX);
  }
  const body = bits.join("; ");
  return text(`${name} ${body}.`, SUMMARY_MAX);
}

function validateOwnerEdit({text: raw, locale, previous}) {
  const errors = [];
  const summary = text(raw, SUMMARY_MAX + 1);
  if (!summary) errors.push("empty");
  if (summary.length > SUMMARY_MAX) errors.push("too_long");
  if (/<\s*script/i.test(summary) || /<\/\s*script/i.test(summary)) errors.push("html");
  const sourceLocale = normalizeLocale(locale, previous?.sourceLocale || "en");
  if (!SUPPORTED_LOCALES.includes(sourceLocale)) errors.push("locale");
  return {ok: errors.length === 0, errors, summary: summary.slice(0, SUMMARY_MAX), sourceLocale};
}

function emptyAnalysis(uid, snap, now = Date.now()) {
  const summary = draftSummaryFromPublicFields(snap);
  const sourceHash = sha256(summary);
  return {
    schemaVersion: SCHEMA_VERSION,
    uid: String(uid || ""),
    revision: 1,
    sourceLocale: snap.sourceLocale || "en",
    sourceAuthoredBy: "gemini",
    sourceText: summary,
    sourceHash,
    categories: categoriesFromSnapshot(snap),
    translations: {},
    publicFieldsHash: publicFieldsHash(snap),
    conflictFlag: false,
    previousRevision: null,
    editorUid: null,
    editedAtMs: null,
    generatedAtMs: now,
    updatedAtMs: now,
    geminiUsage: {promptTokens: null, candidatesTokens: null, totalTokens: null, costUnknown: true},
    provenance: {
      filteredPrivate: true,
      datingOptIn: !!snap.datingOptIn,
      engine: "deterministic_public_fields"
    }
  };
}

function applyOwnerSave(doc, {summary, sourceLocale, editorUid, now = Date.now()}) {
  const prev = doc && typeof doc === "object" ? doc : emptyAnalysis(editorUid, {}, now);
  const nextRevision = Number(prev.revision || 0) + 1;
  const sourceHash = sha256(summary);
  return {
    ...prev,
    revision: nextRevision,
    sourceLocale,
    sourceAuthoredBy: "owner",
    sourceText: summary,
    sourceHash,
    translations: {},
    conflictFlag: false,
    previousRevision: {
      revision: prev.revision || 0,
      sourceText: prev.sourceText || "",
      sourceLocale: prev.sourceLocale || "en",
      sourceAuthoredBy: prev.sourceAuthoredBy || "gemini",
      sourceHash: prev.sourceHash || "",
      savedAtMs: prev.updatedAtMs || now
    },
    editorUid: String(editorUid || ""),
    editedAtMs: now,
    updatedAtMs: now,
    provenance: {
      ...(prev.provenance || {}),
      filteredPrivate: true,
      ownerEdited: true
    }
  };
}

function shouldRegenerate(doc, snap) {
  if (!doc) return true;
  const hash = publicFieldsHash(snap);
  if (doc.publicFieldsHash !== hash) {
    if (doc.sourceAuthoredBy === "owner") return false;
    return true;
  }
  return false;
}

function shouldFlagConflict(doc, snap) {
  if (!doc || doc.sourceAuthoredBy !== "owner") return false;
  return doc.publicFieldsHash !== publicFieldsHash(snap);
}

function translationJobId(uid, revision, locale) {
  return `${String(uid || "").slice(0, 64)}_${Number(revision) || 0}_${normalizeLocale(locale)}`;
}

function enqueueTranslationJobs({uid, revision, sourceHash, sourceLocale, now = Date.now()}) {
  const jobs = [];
  SUPPORTED_LOCALES.forEach(locale => {
    if (locale === sourceLocale) return;
    jobs.push({
      id: translationJobId(uid, revision, locale),
      uid: String(uid || ""),
      revision: Number(revision) || 0,
      sourceHash: String(sourceHash || ""),
      sourceLocale,
      locale,
      status: "queued",
      attempts: 0,
      createdAtMs: now,
      updatedAtMs: now,
      engine: null,
      error: null
    });
  });
  return jobs;
}

function applyTranslationResult(doc, job, {text: translated, engine, model, usage, now = Date.now(), error, status}) {
  if (!doc || Number(job.revision) !== Number(doc.revision) || String(job.sourceHash) !== String(doc.sourceHash)) {
    return {doc, applied: false, reason: "stale_revision"};
  }
  const locale = normalizeLocale(job.locale);
  const translations = {...(doc.translations || {})};
  if (status === "failed") {
    translations[locale] = {
      text: "",
      revision: doc.revision,
      sourceHash: doc.sourceHash,
      status: "failed",
      engine: engine || job.engine || "unknown",
      model: model || "",
      generatedAtMs: now,
      error: text(error, 180)
    };
    return {doc: {...doc, translations, updatedAtMs: now}, applied: true, reason: "failed"};
  }
  translations[locale] = {
    text: text(translated, SUMMARY_MAX),
    revision: doc.revision,
    sourceHash: doc.sourceHash,
    status: "ready",
    engine: engine || "gemini",
    model: model || "",
    generatedAtMs: now,
    error: null,
    usage: usage && typeof usage === "object" ? usage : {costUnknown: true}
  };
  return {doc: {...doc, translations, updatedAtMs: now}, applied: true, reason: "ready"};
}

function retryOrDeadLetter(job, error, now = Date.now()) {
  const attempts = Number(job.attempts || 0) + 1;
  if (attempts >= JOB_MAX_ATTEMPTS) {
    return {
      ...job,
      status: "dead_letter",
      attempts,
      error: text(error, 180),
      updatedAtMs: now
    };
  }
  return {
    ...job,
    status: "queued",
    attempts,
    error: text(error, 180),
    updatedAtMs: now
  };
}

/** Dotted-field patch so parallel locale jobs cannot replace sibling translations. */
function translationLocalePatch(doc, job, payload) {
  const applied = applyTranslationResult(doc, job, payload);
  if (!applied.applied) return applied;
  const locale = normalizeLocale(job.locale);
  const row = applied.doc.translations[locale];
  return {
    applied: true,
    reason: applied.reason,
    locale,
    row,
    update: {
      [`translations.${locale}`]: row,
      updatedAtMs: applied.doc.updatedAtMs
    }
  };
}

function applyLocalePatches(doc, patches) {
  const translations = {...(doc.translations || {})};
  (patches || []).forEach(patch => {
    if (!patch || !patch.applied || !patch.locale || !patch.row) return;
    translations[patch.locale] = patch.row;
  });
  return {...doc, translations};
}

/** Run on create (no before) or when a job is re-queued with a higher attempt count. */
function shouldProcessTranslationWrite(beforeData, afterData) {
  if (!afterData || afterData.status !== "queued") return false;
  if (!beforeData) return true;
  if (beforeData.status !== "queued") return true;
  return Number(afterData.attempts || 0) > Number(beforeData.attempts || 0);
}

function localeSummary(doc, viewerLocale) {
  const locale = normalizeLocale(viewerLocale, doc?.sourceLocale || "en");
  const source = {
    text: doc?.sourceText || "",
    locale: doc?.sourceLocale || "en",
    status: "source",
    revision: doc?.revision || 0
  };
  if (!doc) return source;
  if (locale === doc.sourceLocale) return source;
  const row = doc.translations && doc.translations[locale];
  if (row && row.status === "ready" && row.revision === doc.revision && row.sourceHash === doc.sourceHash) {
    return {text: row.text, locale, status: "translated", revision: doc.revision};
  }
  if (row && row.status === "failed") {
    return {...source, status: "fallback", pendingLocale: locale, failed: true};
  }
  return {...source, status: "fallback", pendingLocale: locale, pending: true};
}

function diagnosticEvent({kind, uid, revision, locale, usage, latencyMs, error, jobStatus}) {
  const tokens = usage && typeof usage === "object" ? usage : {};
  const unknown = tokens.totalTokens == null && tokens.promptTokens == null;
  return {
    kind: text(kind, 40) || "smartview_job",
    uid: text(uid, 128),
    revision: Number(revision) || 0,
    locale: locale ? normalizeLocale(locale) : null,
    jobStatus: text(jobStatus, 32) || null,
    promptTokens: Number.isFinite(Number(tokens.promptTokens)) ? Number(tokens.promptTokens) : null,
    candidatesTokens: Number.isFinite(Number(tokens.candidatesTokens)) ? Number(tokens.candidatesTokens) : null,
    totalTokens: Number.isFinite(Number(tokens.totalTokens)) ? Number(tokens.totalTokens) : null,
    costUnknown: unknown || tokens.costUnknown === true,
    latencyMs: Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : null,
    error: error ? text(error, 180) : null,
    summaryTextLogged: false
  };
}

function usageFromGemini(response) {
  const meta = response && (response.usageMetadata || response.usage || {});
  const prompt = Number(meta.promptTokenCount ?? meta.promptTokens);
  const candidates = Number(meta.candidatesTokenCount ?? meta.candidatesTokens);
  const total = Number(meta.totalTokenCount ?? meta.totalTokens);
  const has = [prompt, candidates, total].some(n => Number.isFinite(n));
  return {
    promptTokens: Number.isFinite(prompt) ? prompt : null,
    candidatesTokens: Number.isFinite(candidates) ? candidates : null,
    totalTokens: Number.isFinite(total) ? total : null,
    costUnknown: !has
  };
}

function peopleV2Payload({
  subjectUid,
  snap,
  analysis,
  viewerUid,
  viewerLocale,
  viewerBlocked,
  viewerMaySee,
  profileHref,
  minglHref
}) {
  if (viewerBlocked || viewerMaySee === false) {
    return null;
  }
  const localeRow = localeSummary(analysis, viewerLocale);
  const ownerMayEdit = String(viewerUid || "") === String(subjectUid || "");
  const datingVisible = !!snap.datingOptIn;
  const cats = categoriesFromSnapshot(snap);
  if (!datingVisible) {
    cats.Dating = {Preferences: [], Discovery: []};
  }
  const handles = [];
  if (snap.instagram) {
    handles.push({
      network: "instagram",
      handle: `@${snap.instagram}`,
      href: `https://instagram.com/${encodeURIComponent(snap.instagram)}`
    });
  }
  if (snap.xHandle) {
    handles.push({
      network: "x",
      handle: `@${snap.xHandle}`,
      href: `https://x.com/${encodeURIComponent(snap.xHandle)}`
    });
  }
  return {
    presentation: "peopleV2",
    subjectUid: String(subjectUid || ""),
    displayName: snap.displayName || "FLOQR patron",
    handle: snap.handle ? `@${snap.handle}` : "",
    verified: snap.verified === true,
    city: snap.city || "",
    handles,
    photo: snap.photoUrl ? {url: snap.photoUrl, count: Math.max(1, snap.photoCount || 1)} : (snap.photoCount ? {url: "", count: snap.photoCount} : null),
    media: {
      photos: snap.photoUrl ? [{url: snap.photoUrl, alt: snap.displayName}] : [],
      videos: []
    },
    summary: {
      text: localeRow.text,
      locale: localeRow.locale,
      status: localeRow.status,
      sourceLocale: analysis?.sourceLocale || snap.sourceLocale || "en",
      revision: localeRow.revision,
      pending: !!localeRow.pending,
      failed: !!localeRow.failed,
      pendingLocale: localeRow.pendingLocale || null,
      ownerAuthored: analysis?.sourceAuthoredBy === "owner"
    },
    ownerMayEdit,
    conflictFlag: !!(ownerMayEdit && analysis?.conflictFlag),
    categories: cats,
    datingVisible,
    profileHref: sanitizeHref(profileHref) || "./patron-portal.html?tab=profile",
    minglHref: sanitizeHref(minglHref) || "./",
    defaultPrimary: DEFAULT_PRIMARY,
    defaultSecondary: DEFAULT_SOCIAL
  };
}

function tagsFor(categories, primary, secondary) {
  const tabs = selectTabs(primary, secondary);
  const group = categories && categories[tabs.primary];
  if (!group || typeof group !== "object") return [];
  const rows = group[tabs.secondary];
  return Array.isArray(rows) ? rows.slice() : [];
}

function noteFor({categories, primary, datingVisible}) {
  if (primary === "Dating" && !datingVisible) {
    return "Dating details are visible only with the patron’s explicit opt-in. No dating preferences are inferred.";
  }
  const tabs = selectTabs(primary, defaultSubtab(primary));
  const tags = tagsFor(categories, tabs.primary, tabs.secondary);
  if (!tags.length && primary !== "Dating") return "No information has been shared for this category.";
  if (primary === "Future Travels") {
    return "Upcoming destinations appear only when the patron explicitly shared them. They are not predictions.";
  }
  return "";
}

function amaraMockSnapshot() {
  return {
    displayName: "Amara J.",
    handle: "amaraj",
    city: "Washington, DC",
    instagram: "amaraj",
    xHandle: "amarajdc",
    music: ["Afrobeats", "Amapiano", "Tech House", "EDM", "Hip-Hop", "R&B"],
    nightlife: ["Rooftop lounges", "VIP clubs", "Beach clubs"],
    sports: ["NBA", "Formula 1", "Soccer"],
    events: ["Concerts", "Game nights", "Festivals"],
    hobbies: ["NBA", "Formula 1", "Soccer", "fashion"],
    cuisines: ["African", "Japanese", "Mediterranean"],
    food: ["African", "Japanese", "Mediterranean"],
    beverages: [],
    pastTravel: ["Miami", "Paris", "Dubai"],
    futureTravel: ["Mykonos"],
    lookingToMeet: "",
    datingOptIn: false,
    bio: "Creative nightlife and travel enthusiast.",
    photoCount: 1,
    photoUrl: "./images/smartview/amara-mock.png",
    verified: true,
    sourceLocale: "en",
    identityVerified: 1
  };
}

function amaraMockAnalysis(now = Date.now()) {
  const snap = amaraMockSnapshot();
  const summary = "Amara is a creative nightlife and travel enthusiast who enjoys Afrobeats, Amapiano, Tech House, rooftop lounges, live EDM DJs, NBA basketball, Formula 1, fashion, and discovering new restaurants. She's also an active event-goer and frequent traveler, with past trips to Miami, Paris, and Dubai, and an upcoming trip to Mykonos.";
  return {
    schemaVersion: SCHEMA_VERSION,
    uid: "mock-amara",
    revision: 1,
    sourceLocale: "en",
    sourceAuthoredBy: "gemini",
    sourceText: summary,
    sourceHash: sha256(summary),
    categories: categoriesFromSnapshot(snap),
    translations: {},
    publicFieldsHash: publicFieldsHash(snap),
    conflictFlag: false,
    previousRevision: null,
    editorUid: null,
    editedAtMs: null,
    generatedAtMs: now,
    updatedAtMs: now,
    geminiUsage: {promptTokens: null, candidatesTokens: null, totalTokens: null, costUnknown: true},
    provenance: {filteredPrivate: true, datingOptIn: false, engine: "mock", mock: true}
  };
}

function translateStub(sourceText, sourceLocale, targetLocale) {
  return {
    text: sourceText,
    engine: "unconfigured",
    model: "",
    labeledFallback: true,
    sourceLocale,
    targetLocale
  };
}

function geminiAnalysisPrompt(snap) {
  return [
    "Write a concise third-person FLOQR Smart Summary from ONLY these public-within-FLOQR fields.",
    "Do not invent ratings, relationships, trips, media, or sensitive attributes.",
    "Do not mention private location or accommodations.",
    "Preserve names, music genres, sports teams, handles, and place names.",
    `Fields: ${JSON.stringify(snap)}`
  ].join(" ");
}

function geminiTranslatePrompt(sourceText, sourceLocale, targetLocale) {
  return [
    `Translate this FLOQR Smart Summary from ${sourceLocale} to ${targetLocale}.`,
    "Preserve proper names, music genres, sports teams, @handles, place names, and dates.",
    "Do not translate @handles. Do not add facts.",
    sourceText
  ].join("\n");
}

module.exports = {
  COLLECTION,
  JOBS_COLLECTION,
  DIAGNOSTICS_COLLECTION,
  SCHEMA_VERSION,
  SUMMARY_MAX,
  REASON_MIN,
  SUPPORTED_LOCALES,
  PRIMARY_TABS,
  SOCIAL_SUBTABS,
  DEFAULT_PRIMARY,
  DEFAULT_SOCIAL,
  JOB_MAX_ATTEMPTS,
  sha256,
  text,
  normalizeLocale,
  sanitizeHandle,
  sanitizeHref,
  defaultSubtab,
  selectTabs,
  emptyCategories,
  publicFieldsSnapshot,
  publicFieldsHash,
  categoriesFromSnapshot,
  draftSummaryFromPublicFields,
  validateOwnerEdit,
  emptyAnalysis,
  applyOwnerSave,
  shouldRegenerate,
  shouldFlagConflict,
  translationJobId,
  enqueueTranslationJobs,
  applyTranslationResult,
  retryOrDeadLetter,
  translationLocalePatch,
  applyLocalePatches,
  shouldProcessTranslationWrite,
  localeSummary,
  diagnosticEvent,
  usageFromGemini,
  peopleV2Payload,
  tagsFor,
  noteFor,
  amaraMockSnapshot,
  amaraMockAnalysis,
  translateStub,
  geminiAnalysisPrompt,
  geminiTranslatePrompt
};
