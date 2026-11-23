/* BOT DEE SmartView registry — typed payloads, mock catalog, cuisine taxonomy.
   Venue/club cards deep-link to club-profile.html (canonical FLOQR Public Page).
   Patron web research is disabled until Part 4 legal + identity gates.
   No executable HTML. Schema additionalProperties: false. */
"use strict";

const fs = require("fs");
const path = require("path");
const v2 = require("./botdee-smartview-v2-core");

const SCHEMA_VERSION = "floqr.smartView/1";
const KINDS = Object.freeze([
  "patron",
  "restaurant",
  "vehicle",
  "hotel",
  "short_term_rental",
  "event",
  "venue",
  "real_estate",
  "product",
  "travel"
]);

const MAJOR_CUISINES = Object.freeze([
  "Cameroonian", "Nigerian", "Ghanaian", "Ethiopian", "Moroccan",
  "Japanese", "Chinese", "Korean", "Thai", "Vietnamese", "Indian",
  "Italian", "French", "Spanish", "Greek", "Turkish",
  "Mexican", "Brazilian", "Peruvian", "American", "Caribbean",
  "Lebanese", "Other"
]);

const CUISINE_HINTS = Object.freeze({
  cameroon: "Cameroonian", cameroonian: "Cameroonian", ndole: "Cameroonian",
  nigeria: "Nigerian", nigerian: "Nigerian", jollof: "Nigerian",
  ghana: "Ghanaian", ghanaian: "Ghanaian",
  ethiopia: "Ethiopian", ethiopian: "Ethiopian", injera: "Ethiopian",
  morocco: "Moroccan", moroccan: "Moroccan",
  japan: "Japanese", japanese: "Japanese", sushi: "Japanese", ramen: "Japanese",
  china: "Chinese", chinese: "Chinese",
  korea: "Korean", korean: "Korean",
  thai: "Thai", thailand: "Thai",
  vietnam: "Vietnamese", vietnamese: "Vietnamese",
  india: "Indian", indian: "Indian",
  italy: "Italian", italian: "Italian", pasta: "Italian", pizza: "Italian",
  france: "French", french: "French",
  spain: "Spanish", spanish: "Spanish", tapas: "Spanish",
  greece: "Greek", greek: "Greek",
  turkey: "Turkish", turkish: "Turkish",
  mexico: "Mexican", mexican: "Mexican", tacos: "Mexican",
  brazil: "Brazilian", brazilian: "Brazilian",
  peru: "Peruvian", peruvian: "Peruvian",
  caribbean: "Caribbean", jamaica: "Caribbean",
  lebanon: "Lebanese", lebanese: "Lebanese",
  american: "American", burger: "American", bbq: "American"
});

function retrievedAt(iso) {
  return iso || "2026-11-14T00:00:00.000Z";
}

function loadSchema() {
  const file = path.join(__dirname, "..", "schemas", "botdee-smartview.schema.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function basePayload(partial) {
  const kind = KINDS.includes(partial.kind) ? partial.kind : "venue";
  const images = Array.isArray(partial.images) ? partial.images.slice(0, 2).map(img => ({
    url: String(img.url || ""),
    licenseStatus: ["approved", "blocked", "unknown"].includes(img.licenseStatus) ? img.licenseStatus : "unknown",
    attribution: String(img.attribution || "")
  })).filter(img => img.url) : [];
  const ratings = Array.isArray(partial.ratings) ? partial.ratings.map(row => ({
    provider: String(row.provider || ""),
    value: Number(row.value),
    retrievedAt: retrievedAt(row.retrievedAt)
  })).filter(row => row.provider && Number.isFinite(row.value)) : [];
  const sources = Array.isArray(partial.sources) && partial.sources.length
    ? partial.sources.map(row => ({
      provider: String(row.provider || "FLOQR"),
      url: String(row.url || "./"),
      retrievedAt: retrievedAt(row.retrievedAt),
      reuseRights: ["approved", "restricted", "unknown"].includes(row.reuseRights) ? row.reuseRights : "unknown"
    }))
    : [{provider: "FLOQR", url: "./", retrievedAt: retrievedAt(), reuseRights: "restricted"}];
  return {
    schemaVersion: SCHEMA_VERSION,
    kind,
    title: String(partial.title || "Untitled").slice(0, 160),
    visibility: ["private", "public", "restricted"].includes(partial.visibility) ? partial.visibility : "restricted",
    canonicalFloqrPageId: partial.canonicalFloqrPageId == null ? null : String(partial.canonicalFloqrPageId),
    summary: String(partial.summary || "").slice(0, 600),
    images,
    ratings,
    sources,
    publicWebResearch: partial.publicWebResearch && typeof partial.publicWebResearch === "object"
      ? partial.publicWebResearch
      : {enabled: false, reason: "legal_gate_blocked"},
    floqrPublicData: partial.floqrPublicData && typeof partial.floqrPublicData === "object"
      ? partial.floqrPublicData
      : {},
    recommendationExplanation: partial.recommendationExplanation && typeof partial.recommendationExplanation === "object"
      ? partial.recommendationExplanation
      : {},
    actions: Array.isArray(partial.actions) ? partial.actions.slice(0, 8) : []
  };
}

function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") return ["missing payload"];
  if (payload.schemaVersion !== SCHEMA_VERSION) errors.push("schemaVersion");
  if (!KINDS.includes(payload.kind)) errors.push("kind");
  if (!payload.title) errors.push("title");
  if (!["private", "public", "restricted"].includes(payload.visibility)) errors.push("visibility");
  if (!Array.isArray(payload.sources) || !payload.sources.length) errors.push("sources");
  const extra = Object.keys(payload).filter(key => ![
    "schemaVersion", "kind", "title", "visibility", "canonicalFloqrPageId",
    "summary", "images", "ratings", "sources", "publicWebResearch",
    "floqrPublicData", "recommendationExplanation", "actions"
  ].includes(key));
  if (extra.length) errors.push(`additionalProperties:${extra.join(",")}`);
  if (payload.kind === "venue" && !payload.canonicalFloqrPageId) errors.push("venue_needs_canonical_page");
  return errors;
}

function clubProfileHref(locationId) {
  const id = String(locationId || "").trim();
  if (!id) return "./club-profile.html";
  return `./club-profile.html?location=${encodeURIComponent(id)}`;
}

function classifyCuisineLabels(foodItems, {max = 5} = {}) {
  const labels = new Set();
  const items = Array.isArray(foodItems) ? foodItems : String(foodItems || "").split(/[,;/]+/);
  items.forEach(item => {
    const token = String(item || "").toLowerCase().trim();
    if (!token) return;
    Object.keys(CUISINE_HINTS).forEach(hint => {
      if (token.includes(hint)) labels.add(CUISINE_HINTS[hint]);
    });
  });
  const out = [...labels].filter(name => name !== "Other").slice(0, max);
  if (!out.length && items.some(Boolean)) out.push("Other");
  return out;
}

function cuisinePipelineMeta() {
  return {
    trigger: "scheduled_batch_plus_event_invalidation",
    perViewInference: false,
    taxonomy: MAJOR_CUISINES.slice(),
    lastScheduledRunAt: null,
    status: "stub_local_map_only",
    note: "Gemini classification is scheduled / event-driven, never at SmartView render time."
  };
}

function attachPeopleV2(publicFields, {displayName, volunteered, profileHref, viewerMaySee}) {
  if (viewerMaySee === false || !publicFields || !Object.keys(publicFields).length) return publicFields;
  const snap = v2.publicFieldsSnapshot({
    displayName,
    floqrHandle: volunteered?.handle,
    instagramHandle: volunteered?.instagram || volunteered?.instagramHandle,
    xHandle: volunteered?.xHandle,
    photoURL: volunteered?.photoURL || volunteered?.photoUrl,
    publicPhotoUrl: volunteered?.publicPhotoUrl,
    profilePhotoUrl: volunteered?.profilePhotoUrl,
    avatarUrl: volunteered?.avatarUrl,
    mainPhotoUrl: volunteered?.mainPhotoUrl,
    profileMediaSlots: volunteered?.profileMediaSlots,
    publicPhotos: volunteered?.publicPhotos,
    galleryUrls: volunteered?.galleryUrls,
    publicGallery: volunteered?.publicGallery,
    preferredLanguage: volunteered?.sourceLocale,
    identityVerified: volunteered?.verified ? 1 : 0,
    floqrVerified: volunteered?.verified ? 1 : 0
  }, volunteered);
  if (Array.isArray(publicFields.cuisines) && publicFields.cuisines.length) {
    snap.cuisines = publicFields.cuisines.slice();
  }
  const analysis = volunteered?.analysis || v2.emptyAnalysis(volunteered?.uid || "patron", snap);
  const peopleV2 = v2.peopleV2Payload({
    subjectUid: volunteered?.uid || "",
    snap,
    analysis,
    viewerUid: volunteered?.viewerUid,
    viewerLocale: volunteered?.viewerLocale || "en",
    viewerMaySee: true,
    profileHref,
    minglHref: volunteered?.minglHref || "./?start=search"
  });
  if (!peopleV2) return publicFields;
  return {...publicFields, peopleV2};
}

function patronSmartView({displayName, volunteered, profileHref, viewerMaySee}) {
  const food = viewerMaySee === false ? [] : (volunteered?.datapoints?.food || []);
  const cuisines = classifyCuisineLabels(food);
  const publicFields = viewerMaySee === false ? {} : attachPeopleV2({
    displayName: String(displayName || "").slice(0, 120),
    handle: volunteered?.handle || "",
    bio: volunteered?.datapoints ? String(volunteered.bio || volunteered.datapoints.bio || "").slice(0, 400) : "",
    sharedDatapoints: Array.isArray(volunteered?.sharedDatapoints) ? volunteered.sharedDatapoints : [],
    datapoints: volunteered?.datapoints && typeof volunteered.datapoints === "object" ? volunteered.datapoints : {},
    cuisines
  }, {displayName, volunteered, profileHref, viewerMaySee});
  return basePayload({
    kind: "patron",
    title: publicFields.displayName || "FLOQR patron",
    visibility: "restricted",
    canonicalFloqrPageId: null,
    summary: "FLOQR public-within-app profile fields only. Not indexed for the open web.",
    sources: [{
      provider: "FLOQR",
      url: profileHref || "./patron-portal.html?tab=profile",
      retrievedAt: retrievedAt(),
      reuseRights: "restricted"
    }],
    publicWebResearch: {
      enabled: false,
      placeholder: true,
      reason: "legal_gate_and_identity_unapproved",
      label: "Public Web Research"
    },
    floqrPublicData: publicFields,
    recommendationExplanation: {
      personalized: false,
      preferencesUsed: [],
      sources: ["FLOQR public-within-app profile"],
      sponsorship: false
    },
    actions: [{
      id: "open-profile-privacy",
      label: "Profile visibility (existing FLOQR controls)",
      href: "./patron-portal.html?tab=profile"
    }]
  });
}

function mockCatalog() {
  const when = retrievedAt();
  const venueId = "temp-democlub-1";
  const venueHref = clubProfileHref(venueId);
  return [
    basePayload({
      kind: "venue",
      title: "Aurelia",
      visibility: "public",
      canonicalFloqrPageId: venueId,
      summary: "FLOQR demo club. SmartView is a compact wrapper — the club public page is canonical.",
      ratings: [{provider: "FLOQR", value: 4.8, retrievedAt: when}],
      sources: [{provider: "FLOQR", url: venueHref, retrievedAt: when, reuseRights: "approved"}],
      floqrPublicData: {
        locationId: venueId,
        city: "Washington, DC",
        genres: ["House", "Afrobeats"],
        smartBackgroundId: "bg-washington-dc"
      },
      actions: [{id: "open-public-page", label: "Open FLOQR Public Page", href: venueHref}]
    }),
    basePayload({
      kind: "restaurant",
      title: "Mock · District Kitchen",
      visibility: "public",
      summary: "Mock restaurant card. Google/Yelp values are placeholders and not live API data.",
      ratings: [
        {provider: "Google", value: 4.4, retrievedAt: when},
        {provider: "Yelp", value: 4.0, retrievedAt: when},
        {provider: "FLOQR", value: 4.6, retrievedAt: when}
      ],
      sources: [{
        provider: "mock",
        url: "https://www.floqr.app/",
        retrievedAt: when,
        reuseRights: "unknown"
      }],
      floqrPublicData: {
        address: "Mock address — not copied from Google Places",
        menuIframeAllowed: false,
        menuHref: "https://www.floqr.app/",
        cuisine: ["American", "Caribbean"],
        smartBackgroundId: "bg-dining"
      },
      actions: [{id: "menu-external", label: "Menu (external)", href: "https://www.floqr.app/", iframe: false}]
    }),
    basePayload({
      kind: "vehicle",
      title: "Mock · 2024 family sedan",
      visibility: "public",
      summary: "Safety ratings shown only when year/trim/test match. This mock has no verified NHTSA row.",
      sources: [{provider: "mock", url: "https://www.nhtsa.gov/", retrievedAt: when, reuseRights: "unknown"}],
      floqrPublicData: {
        year: 2024,
        trim: "unspecified",
        nhtsa: {status: "missing", note: "No exact year/trim/test match — ratings withheld."},
        iihs: {status: "missing"}
      }
    }),
    basePayload({
      kind: "hotel",
      title: "Mock · Capitol Row Hotel",
      visibility: "public",
      summary: "Mock hotel. Dates and rates are not live inventory.",
      sources: [{provider: "mock", url: "https://www.floqr.app/", retrievedAt: when, reuseRights: "unknown"}],
      floqrPublicData: {amenities: ["wifi", "late checkout"], availability: "stale_mock", refreshRequired: true}
    }),
    basePayload({
      kind: "short_term_rental",
      title: "Mock · Shaw loft (unlicensed listing withheld)",
      visibility: "restricted",
      summary: "Airbnb-style cards stay mock-only until partner terms exist. No scraped listing photos.",
      sources: [{provider: "mock", url: "https://www.floqr.app/", retrievedAt: when, reuseRights: "restricted"}],
      floqrPublicData: {platform: "mock", feesUnknown: true}
    }),
    basePayload({
      kind: "event",
      title: "Mock · Friday night at Aurelia",
      visibility: "public",
      canonicalFloqrPageId: venueId,
      summary: "Event SmartView points at the venue public page and published FLOQR event fields.",
      sources: [{provider: "FLOQR", url: venueHref, retrievedAt: when, reuseRights: "approved"}],
      floqrPublicData: {venueLocationId: venueId, ticketUrl: null, agePolicy: "21+"},
      actions: [{id: "open-public-page", label: "Open FLOQR Public Page", href: venueHref}]
    }),
    basePayload({
      kind: "real_estate",
      title: "Mock · listing withheld",
      visibility: "restricted",
      summary: "MLS/IDX photos and addresses are not shown without a broker agreement. Fair housing controls on.",
      sources: [{provider: "mock", url: "https://www.floqr.app/", retrievedAt: when, reuseRights: "restricted"}],
      floqrPublicData: {fairHousing: true, listingStatus: "blocked_no_mls_agreement"}
    }),
    basePayload({
      kind: "product",
      title: "Mock · FLOQR merch tee",
      visibility: "public",
      summary: "Merchant-authorized mock. Not a live catalog offer.",
      sources: [{provider: "FLOQR", url: "./commerce.html", retrievedAt: when, reuseRights: "approved"}],
      floqrPublicData: {sku: "mock-tee", price: null}
    }),
    basePayload({
      kind: "travel",
      title: "Mock · DC weekend itinerary",
      visibility: "private",
      summary: "Saved itinerary mock. Flight fares are not live GDS data.",
      sources: [{provider: "mock", url: "https://www.floqr.app/", retrievedAt: when, reuseRights: "unknown"}],
      floqrPublicData: {legs: ["IAD → DCA mock"], advisories: []}
    }),
    patronSmartView({
      displayName: v2.amaraMockSnapshot().displayName,
      volunteered: {
        uid: "mock-amara",
        handle: "amaraj",
        instagram: "amaraj",
        xHandle: "amarajdc",
        photoUrl: "./images/smartview/amara-mock.png",
        verified: true,
        sourceLocale: "en",
        sharedDatapoints: ["food", "music", "events", "travel", "hobbies", "location", "media"],
        datapoints: {
          food: ["Nigerian jollof", "sushi", "Mediterranean"],
          music: v2.amaraMockSnapshot().music,
          events: v2.amaraMockSnapshot().events,
          nightlifeStyle: "Rooftop lounges",
          travel: v2.amaraMockSnapshot().pastTravel,
          futureTravel: v2.amaraMockSnapshot().futureTravel,
          hobbies: v2.amaraMockSnapshot().hobbies,
          location: {city: "Washington, DC"},
          photoCount: 1
        },
        bio: "Public-within-FLOQR bio",
        analysis: v2.amaraMockAnalysis(),
        minglHref: "./?start=search&q=%40amaraj"
      },
      profileHref: "./patron-portal.html?tab=profile",
      viewerMaySee: true
    })
  ];
}

function explainRecommendation({personalized, preferencesUsed, sources, sponsorship, dateIso, uncertainty}) {
  return {
    evidence: Array.isArray(sources) ? sources : [],
    preferencesUsed: personalized === false ? [] : (preferencesUsed || []),
    personalized: personalized !== false,
    retrievedAt: retrievedAt(dateIso),
    sponsorship: !!sponsorship,
    sponsorshipLabeled: true,
    uncertainty: String(uncertainty || "Mock ranking on first-party + placeholder data."),
    nonpersonalizedAvailable: true
  };
}

function researchLibraryItem({collection, title, kind, sourceId, placeIdOnly}) {
  return {
    collection: String(collection || "saved_places"),
    title: String(title || "").slice(0, 160),
    kind: KINDS.includes(kind) ? kind : "venue",
    sourceId: String(sourceId || ""),
    googlePlaceId: placeIdOnly ? String(placeIdOnly) : "",
    storedPlacesCopy: false,
    refreshable: true,
    licensedCache: false
  };
}

module.exports = {
  SCHEMA_VERSION,
  KINDS,
  MAJOR_CUISINES,
  loadSchema,
  basePayload,
  validatePayload,
  clubProfileHref,
  classifyCuisineLabels,
  cuisinePipelineMeta,
  patronSmartView,
  attachPeopleV2,
  mockCatalog,
  explainRecommendation,
  researchLibraryItem
};
