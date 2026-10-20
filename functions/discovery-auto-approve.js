/**
 * Auto-approve gate for discovery crawl → live clubLocations / events.
 *
 * Strict programmatic conditions (ALL must pass for AUTO_PUBLISH):
 * 1) Unique identity anchors
 * 2) Critical schema boundaries
 * 3) Text integrity / scrape anomaly cleaning
 * 4) Confidence score >= 0.92 after source multiplier
 *
 * Venues vs events use slightly different required fields (venues do not
 * require a future start ISO; events do).
 */

"use strict";

const crypto = require("crypto");
const {
  isTimedEventRecord,
  resolveQueueDocId,
  normalizedKey,
  toIsoStart
} = require("./discovery-crawl-core");

const AUTO_APPROVE_THRESHOLD = 0.92;

const FIELD_WEIGHTS_EVENT = {
  title: 0.18,
  startIso: 0.17,
  ticketOrImage: 0.17,
  latLng: 0.15,
  email: 0.14,
  phone: 0.14,
  instagram: 0.05
};

// Venues redistribute the startIso weight into title/location/contact.
const FIELD_WEIGHTS_VENUE = {
  title: 0.22,
  startIso: 0, // N/A — evergreen venue
  ticketOrImage: 0.15,
  latLng: 0.18,
  email: 0.16,
  phone: 0.16,
  instagram: 0.13
};

const TITLE_REJECT_RE = /page not found|click here|error\b|404|captcha|access denied|just a moment|cloudflare|enable javascript|sign in to continue/i;
const HTML_ARTIFACT_RE = /<\/?[a-z][^>]*>|\{[\s\S]*\}|@keyframes|<\/?script/i;
const PLACEHOLDER_EMAIL_RE = /^(?:info|test|admin|hello|contact)@(?:example|test|email|domain|localhost)\./i;
const E164_RE = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const IG_USER_RE = /^(?!.*\.\.)(?!\.)[A-Za-z0-9._]{1,30}(?<!\.)$/;

const TRUSTED_HOST_RE = /(?:ticketmaster\.|eventbrite\.|ra\.co$|residentadvisor\.|dice\.fm$|posh\.vip$|shotgun\.live$)/i;
const AGGREGATOR_HOST_RE = /(?:privateaser|opentable|thefork|tripadvisor|yelp|linktr\.ee|facebook\.com|instagram\.com)/i;

/** Lightweight schema contract (JSDoc + runtime validators; no Zod dependency). */
/**
 * @typedef {Object} AutoApproveDecision
 * @property {"AUTO_PUBLISH"|"ADMIN_QUEUE"} route
 * @property {number} confidence
 * @property {number} completenessSum
 * @property {number} sourceMultiplier
 * @property {string[]} failures
 * @property {Object} fieldScores
 * @property {Object} sanitized
 */

function stripHtmlAndScripts(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasRepetitiveNavBleed(text = "") {
  const words = String(text || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 40) return false;
  const counts = {};
  words.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
  const top = Object.values(counts).sort((a, b) => b - a)[0] || 0;
  return top / words.length > 0.18;
}

function cleanTitle(value = "") {
  return stripHtmlAndScripts(value).slice(0, 120);
}

function normalizeInstagram(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const handle = (fromUrl ? fromUrl[1] : raw).replace(/^@/, "");
  if (!IG_USER_RE.test(handle)) return "";
  if (/^(reel|p|stories|explore|share|accounts)$/i.test(handle)) return "";
  return handle;
}

function normalizePhoneE164(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (E164_RE.test(raw)) return raw;
  const digits = raw.replace(/[^\d+]/g, "");
  if (E164_RE.test(digits)) return digits;
  // US/CA 10-digit fallback
  const only = raw.replace(/\D/g, "");
  if (only.length === 10) return `+1${only}`;
  if (only.length === 11 && only.startsWith("1")) return `+${only}`;
  return "";
}

function normalizeEmail(value = "") {
  const email = String(value || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return "";
  if (PLACEHOLDER_EMAIL_RE.test(email)) return "";
  return email;
}

function normalizeAgePolicy(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/everyone|all\s*ages|family/i.test(raw)) return "Everyone";
  if (/\b21\b|21\+|twenty[- ]?one/i.test(raw)) return 21;
  if (/\b18\b|18\+|eighteen/i.test(raw)) return 18;
  return "";
}

function validLatLng(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

function sourceMultiplierFor(record = {}) {
  const hostBlob = [
    record.officialWebsite || "",
    record.website || "",
    record.sourceUrl || "",
    record.ticketUrl || ""
  ].join(" ");
  let host = "";
  try {
    host = new URL(record.officialWebsite || record.website || record.sourceUrl || "https://invalid.local").hostname;
  } catch (_e) {
    host = "";
  }
  if (record.sourceConfirmations?.googlePlaces && record.placesId && !AGGREGATOR_HOST_RE.test(hostBlob)) {
    return 1.0;
  }
  if (TRUSTED_HOST_RE.test(hostBlob) || TRUSTED_HOST_RE.test(host)) return 1.0;
  if (record.sourceConfirmations?.jsonLdEvent && record.officialWebsite) return 1.0;
  if (AGGREGATOR_HOST_RE.test(hostBlob)) return 0.75;
  if (record.sourceName === "Google Places API") return 0.95;
  return 0.75;
}

function hasIdentityAnchor(record = {}, kind = "venue") {
  if (kind === "event") {
    const venueId = record.parentPlacesId || record.placesId || record.venueId || "";
    const start = record.eventStartIso || "";
    const title = record.proposedTitle || "";
    return !!(venueId && start && title && resolveQueueDocId(record));
  }
  const placesId = String(record.placesId || "").trim();
  const ig = normalizeInstagram(record.instagramHandle || record.socialMediaHandles?.instagram || "");
  let rootDomain = "";
  try {
    rootDomain = new URL(record.officialWebsite || record.website || "").hostname;
  } catch (_e) {
    rootDomain = "";
  }
  const officialSite = rootDomain && !/google\.(com|maps)|maps\.app\.goo\.gl|facebook\.com|instagram\.com/i.test(rootDomain);
  return !!(placesId || ig || officialSite);
}

function eventIdentityHash(record = {}) {
  const venue = String(record.parentPlacesId || record.placesId || record.venueId || "");
  const start = String(record.eventStartIso || "");
  const title = normalizedKey(record.proposedTitle || "");
  return crypto.createHash("md5").update(`${venue}+${start}+${title}`).digest("hex");
}

function validateTitle(title = "") {
  const cleaned = cleanTitle(title);
  const failures = [];
  if (cleaned.length < 10 || cleaned.length > 100) failures.push("title_length");
  if (TITLE_REJECT_RE.test(cleaned) || HTML_ARTIFACT_RE.test(String(title || ""))) failures.push("title_artifact");
  return {ok: !failures.length, value: cleaned, failures};
}

function validateDescription(description = "") {
  const cleaned = stripHtmlAndScripts(description);
  const failures = [];
  if (cleaned.length < 50 || cleaned.length > 2000) failures.push("description_length");
  if (hasRepetitiveNavBleed(cleaned)) failures.push("description_nav_bleed");
  return {ok: !failures.length, value: cleaned, failures};
}

function fieldCompletion(record = {}, kind = "venue") {
  const weights = kind === "event" ? FIELD_WEIGHTS_EVENT : FIELD_WEIGHTS_VENUE;
  const titleOk = validateTitle(record.proposedTitle || record.proposedLocationName || "").ok;
  const startIso = toIsoStart(record.eventStartIso || `${record.proposedDate || ""} ${record.proposedTime || ""}`);
  const startOk = kind === "event"
    ? !!(startIso && new Date(startIso).getTime() > Date.now())
    : true;
  const ticketOrImage = !!(record.ticketUrl || (record.extractedImages || [])[0] || record.flyerUrl || record.imageUrl);
  const latLngOk = validLatLng(record.latitude, record.longitude);
  const emailOk = !!normalizeEmail(record.email || "");
  const phoneOk = !!normalizePhoneE164(record.telephone || record.phone || "");
  const igOk = !!normalizeInstagram(record.instagramHandle || record.socialMediaHandles?.instagram || "");

  const flags = {
    title: titleOk,
    startIso: startOk,
    ticketOrImage,
    latLng: latLngOk,
    email: emailOk,
    phone: phoneOk,
    instagram: igOk
  };
  let sum = 0;
  Object.keys(weights).forEach(key => {
    if (flags[key]) sum += weights[key];
  });
  return {sum, flags, weights, startIso};
}

/**
 * processCrawledItem — schema validation + confidence → AUTO_PUBLISH | ADMIN_QUEUE
 * @returns {AutoApproveDecision}
 */
function processCrawledItem(raw = {}) {
  const kind = isTimedEventRecord(raw) ? "event" : "venue";
  const failures = [];
  const titleCheck = validateTitle(raw.proposedTitle || raw.proposedLocationName || "");
  failures.push(...titleCheck.failures.map(f => `${kind}_${f}`));

  const descSource = raw.proposedDescription || raw.aiSummary || "";
  const descCheck = descSource ? validateDescription(descSource) : {ok: kind === "venue", value: "", failures: kind === "event" ? ["description_missing"] : []};
  if (!descCheck.ok) failures.push(...descCheck.failures.map(f => `${kind}_${f}`));

  const email = normalizeEmail(raw.email || "");
  const phone = normalizePhoneE164(raw.telephone || raw.phone || "");
  const instagram = normalizeInstagram(raw.instagramHandle || raw.socialMediaHandles?.instagram || "");
  const agePolicy = normalizeAgePolicy(raw.agePolicy || "");

  if (!hasIdentityAnchor(raw, kind)) failures.push("identity_anchor_missing");
  if (!email) failures.push("email_invalid");
  if (!phone) failures.push("phone_not_e164");
  if (!instagram) failures.push("instagram_invalid");
  if (!validLatLng(raw.latitude, raw.longitude)) failures.push("lat_lng_invalid");

  let eventStartIso = "";
  if (kind === "event") {
    eventStartIso = toIsoStart(raw.eventStartIso || `${raw.proposedDate || ""}T${raw.proposedTime || "12:00:00"}`);
    if (!eventStartIso) failures.push("start_iso_invalid");
    else if (new Date(eventStartIso).getTime() <= Date.now()) failures.push("start_iso_not_future");
    if (!agePolicy && /club|party|night|lounge|beach|comedy/i.test(String(raw.proposedType || ""))) {
      // Age policy required for nightlife-style events; daytime markets may be Everyone.
      if (!/daytime|market|festival|fair/i.test(String(raw.proposedType || ""))) failures.push("age_policy_missing");
    }
  }

  const completion = fieldCompletion({
    ...raw,
    proposedTitle: titleCheck.value,
    email,
    telephone: phone,
    phone,
    instagramHandle: instagram,
    eventStartIso: eventStartIso || raw.eventStartIso
  }, kind);

  const multiplier = sourceMultiplierFor(raw);
  const confidence = Math.round(multiplier * completion.sum * 1000) / 1000;
  const schemaOk = failures.length === 0;
  const scoreOk = confidence >= AUTO_APPROVE_THRESHOLD;
  const route = schemaOk && scoreOk ? "AUTO_PUBLISH" : "ADMIN_QUEUE";

  const sanitized = {
    ...raw,
    entityKind: kind,
    proposedTitle: titleCheck.value || raw.proposedTitle,
    proposedDescription: descCheck.value || stripHtmlAndScripts(raw.proposedDescription || ""),
    email,
    telephone: phone,
    phone,
    instagramHandle: instagram,
    socialMediaHandles: {
      ...(raw.socialMediaHandles || {}),
      instagram: instagram || raw.socialMediaHandles?.instagram || ""
    },
    agePolicy: agePolicy || raw.agePolicy || "",
    eventStartIso: eventStartIso || raw.eventStartIso || "",
    eventIdentityHash: kind === "event" ? eventIdentityHash({...raw, eventStartIso, proposedTitle: titleCheck.value}) : "",
    queueDocId: resolveQueueDocId({...raw, eventStartIso, proposedTitle: titleCheck.value}),
    lifecycleStatus: kind === "event"
      ? ((eventStartIso && new Date(eventStartIso).getTime() < Date.now()) ? "past" : "upcoming")
      : (raw.lifecycleStatus || "active"),
    publishConfidence: confidence,
    aiConfidenceScore: confidence
  };

  return {
    route,
    confidence,
    completenessSum: completion.sum,
    sourceMultiplier: multiplier,
    failures,
    fieldScores: completion.flags,
    weights: completion.weights,
    threshold: AUTO_APPROVE_THRESHOLD,
    sanitized,
    reason: route === "AUTO_PUBLISH"
      ? `Auto-publish: confidence ${confidence} >= ${AUTO_APPROVE_THRESHOLD} and schema gates passed`
      : `Admin queue: ${failures.slice(0, 6).join(", ") || `confidence ${confidence} < ${AUTO_APPROVE_THRESHOLD}`}`
  };
}

function slugify(...parts) {
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `listing-${Date.now()}`;
}

function livePayloadFromDecision(decision) {
  const item = decision.sanitized || {};
  const kind = item.entityKind || (isTimedEventRecord(item) ? "event" : "venue");
  if (kind === "event") {
    const id = slugify(item.proposedTitle, item.city, (item.eventStartIso || "").slice(0, 10));
    return {
      collection: "events",
      id,
      payload: {
        eventName: item.proposedTitle,
        eventDate: item.proposedDate || (item.eventStartIso || "").slice(0, 10),
        eventTime: item.proposedTime || "",
        eventStartIso: item.eventStartIso || "",
        eventEndIso: item.eventEndIso || "",
        description: item.proposedDescription || "",
        locationName: item.proposedLocationName || "",
        address: item.proposedAddress || "",
        city: item.city || "",
        stateRegion: item.stateRegion || "",
        country: item.country || "",
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        email: item.email || "",
        telephone: item.telephone || item.phone || "",
        phone: item.phone || item.telephone || "",
        officialWebsite: item.officialWebsite || item.website || "",
        website: item.website || item.officialWebsite || "",
        socialMediaHandles: item.socialMediaHandles || {},
        instagramHandle: item.instagramHandle || "",
        genres: item.genres || [],
        categories: item.categories || [],
        artistsOrDjs: item.artistsOrDjs || [],
        promoters: item.promoters || [],
        agePolicy: item.agePolicy || "",
        ticketUrl: item.ticketUrl || "",
        ticketProvider: item.ticketProvider || "",
        sourceUrl: item.sourceUrl || "",
        placesId: item.placesId || item.parentPlacesId || "",
        crawlerDateSource: item.crawlerDateSource || "",
        lifecycleStatus: item.lifecycleStatus || "upcoming",
        autoApproved: true,
        publishConfidence: decision.confidence,
        active: true,
        status: "active",
        visibility: "public",
        approvedFromDiscoveryQueueId: item.queueDocId || "",
        publicProfileSections: {upcomingEvents: true, pastEvents: true}
      }
    };
  }
  const id = slugify(item.proposedTitle || item.proposedLocationName, item.city, item.country);
  return {
    collection: "clubLocations",
    id,
    payload: {
      locationId: id,
      locationName: item.proposedTitle || item.proposedLocationName,
      brandName: item.proposedTitle || item.proposedLocationName,
      fullAddress: item.proposedAddress || "",
      streetAddress: item.streetAddress || item.proposedAddress || "",
      city: item.city || "",
      stateRegion: item.stateRegion || "",
      country: item.country || "",
      postalCode: item.postalCode || "",
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      email: item.email || "",
      telephone: item.telephone || item.phone || "",
      phone: item.phone || item.telephone || "",
      officialWebsite: item.officialWebsite || item.website || "",
      website: item.website || item.officialWebsite || "",
      socialMediaHandles: item.socialMediaHandles || {},
      instagramHandle: item.instagramHandle || "",
      genres: item.genres || [],
      categories: item.categories || [],
      agePolicy: item.agePolicy || "",
      placesId: item.placesId || "",
      hours: item.hours || "",
      hoursStructured: item.hoursStructured || null,
      description: item.proposedDescription || item.aiSummary || "",
      autoApproved: true,
      publishConfidence: decision.confidence,
      active: true,
      status: "active",
      visibility: "public",
      publicProfileType: "club",
      publicProfilePublished: true,
      clubOwnershipStatus: "unclaimed",
      approvedFromDiscoveryQueueId: item.queueDocId || "",
      publicProfileSections: {
        about: true,
        contact: true,
        upcomingEvents: true,
        pastEvents: true,
        featuredDjs: true,
        gallery: true
      }
    }
  };
}

module.exports = {
  AUTO_APPROVE_THRESHOLD,
  FIELD_WEIGHTS_EVENT,
  FIELD_WEIGHTS_VENUE,
  processCrawledItem,
  livePayloadFromDecision,
  stripHtmlAndScripts,
  normalizeEmail,
  normalizePhoneE164,
  normalizeInstagram,
  normalizeAgePolicy,
  validLatLng,
  sourceMultiplierFor,
  eventIdentityHash,
  cleanTitle
};
