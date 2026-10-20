/**
 * Discovery crawl core upgrades (s3.1.101+):
 * - Bounded Places job concurrency (pool of 3)
 * - Per-host HTML crawl delay with jitter
 * - Deterministic queue doc ids (placesId / event hash)
 * - JSON-LD Event extraction → child dated event records
 * - Provenance / legalCompliance metadata
 *
 * Architecture: venues stay identity-stable on placesId; dated events are
 * separate queue docs keyed by sha1(placesId|startIso|title).
 */

"use strict";

const crypto = require("crypto");

const CRAWL_USER_AGENT = "FLOQR public discovery bot/1.0 (+https://floqr.com)";
const PLACES_JOB_CONCURRENCY = 3;
const HOST_MIN_DELAY_MS = 350;
const HOST_JITTER_MS = 250;
const SECONDARY_FOLLOW_LIMIT = 4;

const hostLastFetchAt = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Lightweight p-limit style pool without an extra dependency. */
async function mapPool(items, limit, mapper) {
  const list = Array.isArray(items) ? items : [];
  const concurrency = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
  const results = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const index = cursor++;
      results[index] = await mapper(list[index], index);
    }
  }
  await Promise.all(Array.from({length: concurrency}, () => worker()));
  return results;
}

async function waitForHostBudget(url) {
  let host = "";
  try {
    host = new URL(String(url || "")).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (_e) {
    host = "unknown";
  }
  const now = Date.now();
  const last = hostLastFetchAt.get(host) || 0;
  const wait = Math.max(0, HOST_MIN_DELAY_MS + Math.floor(Math.random() * HOST_JITTER_MS) - (now - last));
  if (wait > 0) await sleep(wait);
  hostLastFetchAt.set(host, Date.now());
  return host;
}

function normalizedKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sha1Hex(value = "") {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex");
}

function placesDocId(placesId = "") {
  const id = String(placesId || "").replace(/^places\//i, "").trim();
  if (!id) return "";
  // Firestore doc ids cannot contain "/"
  return `place_${id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 700)}`;
}

function eventDocId({placesId = "", venueId = "", startIso = "", title = ""} = {}) {
  const venue = String(placesId || venueId || "unknown").replace(/^places\//i, "");
  const start = String(startIso || "").trim() || "undated";
  const headline = normalizedKey(title).slice(0, 120) || "untitled";
  return `evt_${sha1Hex(`${venue}|${start}|${headline}`)}`;
}

function websiteDocId(website = "", city = "") {
  let host = "";
  try {
    host = new URL(String(website || "")).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (_e) {
    host = normalizedKey(website).slice(0, 80);
  }
  if (!host) return "";
  return `web_${sha1Hex(`${host}|${normalizedKey(city)}`)}`;
}

function resolveQueueDocId(record = {}) {
  if (record.queueDocId) return String(record.queueDocId);
  const isEvent = isTimedEventRecord(record);
  if (isEvent) {
    return eventDocId({
      placesId: record.placesId || record.parentPlacesId || "",
      venueId: record.venueId || record.onboardedListingId || "",
      startIso: record.eventStartIso || record.proposedDate || "",
      title: record.proposedTitle || record.eventName || ""
    });
  }
  const placeKey = placesDocId(record.placesId || "");
  if (placeKey) return placeKey;
  const webKey = websiteDocId(record.officialWebsite || record.website || record.sourceUrl || "", record.city || "");
  if (webKey) return webKey;
  return `tmp_${sha1Hex([
    record.proposedTitle || record.proposedLocationName || "",
    record.city || "",
    record.country || "",
    record.proposedDate || ""
  ].join("|"))}`;
}

function isTimedEventRecord(record = {}) {
  const type = String(record.proposedType || "");
  if (/daytimeEvent|comedyShow|^event$/i.test(type)) return true;
  if (record.eventStartIso || (record.proposedDate && /event|festival|party|market|show/i.test(type))) return true;
  return false;
}

function isEuUkCountry(country = "") {
  const key = normalizedKey(country);
  const euUk = new Set([
    "austria", "belgium", "bulgaria", "croatia", "cyprus", "czech republic", "czechia",
    "denmark", "estonia", "finland", "france", "germany", "greece", "hungary", "ireland",
    "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands", "poland",
    "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
    "united kingdom", "uk", "england", "scotland", "wales", "northern ireland",
    "iceland", "norway", "switzerland" // EEA-adjacent; flagged for downstream review
  ]);
  return euUk.has(key);
}

function buildLegalCompliance(record = {}, provenance = "") {
  return {
    userAgentUsed: CRAWL_USER_AGENT,
    dataProvenance: provenance || record.legalCompliance?.dataProvenance || "unknown",
    jurisdictionHints: {
      euUkLikely: isEuUkCountry(record.country || "")
    },
    // Explicitly NOT a GDPR compliance attestation — hint only for downstream policy.
    gdprTracked: isEuUkCountry(record.country || ""),
    fetchedAtIso: new Date().toISOString()
  };
}

function extractJsonLdNodes(html = "") {
  const blocks = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(String(html || "")))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      list.forEach(item => {
        if (!item || typeof item !== "object") return;
        if (Array.isArray(item["@graph"])) blocks.push(...item["@graph"]);
        blocks.push(item);
      });
    } catch (_e) {
      /* ignore malformed */
    }
  }
  return blocks;
}

function jsonLdTypeText(node = {}) {
  const type = node["@type"];
  return Array.isArray(type) ? type.join(" ") : String(type || "");
}

function isJsonLdEventType(typeText = "") {
  return /(?:^|\s)(Event|MusicEvent|ComedyEvent|Festival|SocialEvent|DanceEvent|FoodEvent)(?:\s|$)/i.test(typeText);
}

function performerNames(node = {}) {
  const performers = node.performer || node.performers || [];
  const list = Array.isArray(performers) ? performers : [performers];
  return list
    .map(item => (typeof item === "string" ? item : item?.name || ""))
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function organizerNames(node = {}) {
  const organizers = node.organizer || node.organizers || [];
  const list = Array.isArray(organizers) ? organizers : [organizers];
  return list
    .map(item => (typeof item === "string" ? item : item?.name || ""))
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function offerUrl(node = {}) {
  const offers = node.offers;
  if (!offers) return "";
  if (typeof offers === "string") return offers;
  if (Array.isArray(offers)) return offers.find(o => o?.url)?.url || offers[0]?.url || "";
  return offers.url || "";
}

function toIsoStart(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    // date-only YYYY-MM-DD → treat as local noon UTC for ordering
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T12:00:00.000Z`;
    return "";
  }
  return d.toISOString();
}

function splitDateTime(iso = "") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return {proposedDate: "", proposedTime: ""};
  const proposedDate = d.toISOString().slice(0, 10);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return {proposedDate, proposedTime: `${hh}:${mm} UTC`};
}

/**
 * Pull Schema.org Event nodes from HTML. Returns normalized event stubs
 * (not full queue records) for the caller to attach parent venue identity.
 */
function extractJsonLdEventsFromHtml(html = "") {
  const nodes = extractJsonLdNodes(html);
  const out = [];
  const seen = new Set();
  nodes.forEach(node => {
    if (!node || typeof node !== "object") return;
    if (!isJsonLdEventType(jsonLdTypeText(node))) return;
    const title = String(node.name || "").trim();
    const startIso = toIsoStart(node.startDate || node.doorTime || "");
    if (!title || !startIso) return;
    const key = `${normalizedKey(title)}|${startIso}`;
    if (seen.has(key)) return;
    seen.add(key);
    const {proposedDate, proposedTime} = splitDateTime(startIso);
    const endIso = toIsoStart(node.endDate || "");
    const typeText = jsonLdTypeText(node);
    let proposedType = "event";
    if (/comedy/i.test(typeText) || /comedy/i.test(title)) proposedType = "comedyShow";
    else if (/festival|market|fair|flea/i.test(`${typeText} ${title}`)) proposedType = "daytimeEvent";
    out.push({
      proposedType,
      proposedTitle: title.slice(0, 180),
      proposedDescription: String(node.description || "").slice(0, 2000),
      eventStartIso: startIso,
      eventEndIso: endIso || "",
      proposedDate,
      proposedTime,
      ticketUrl: offerUrl(node) || "",
      artistsOrDjs: performerNames(node),
      promoters: organizerNames(node),
      extractedImages: Array.isArray(node.image) ? node.image.slice(0, 8) : (node.image ? [node.image] : []),
      crawlerDateSource: "schema.org JSON-LD Event.startDate",
      extractionMethod: "html-jsonld-event",
      lifecycleStatus: new Date(startIso).getTime() < Date.now() ? "past" : "upcoming"
    });
  });
  return out.slice(0, 12);
}

function attachEventsFromHtml(venueRecord = {}, html = "") {
  const events = extractJsonLdEventsFromHtml(html);
  if (!events.length) {
    return {
      venue: {
        ...venueRecord,
        relatedEvents: venueRecord.relatedEvents || [],
        legalCompliance: buildLegalCompliance(venueRecord, venueRecord.legalCompliance?.dataProvenance || "google_places+html")
      },
      childEvents: []
    };
  }
  const parentPlacesId = String(venueRecord.placesId || "").replace(/^places\//i, "");
  const childEvents = events.map(evt => {
    const merged = {
      ...evt,
      parentPlacesId,
      placesId: parentPlacesId,
      proposedLocationName: venueRecord.proposedLocationName || venueRecord.proposedTitle || "",
      proposedAddress: venueRecord.proposedAddress || "",
      city: venueRecord.city || "",
      stateRegion: venueRecord.stateRegion || "",
      country: venueRecord.country || "",
      latitude: venueRecord.latitude ?? null,
      longitude: venueRecord.longitude ?? null,
      telephone: venueRecord.telephone || venueRecord.phone || "",
      phone: venueRecord.phone || venueRecord.telephone || "",
      email: venueRecord.email || "",
      officialWebsite: venueRecord.officialWebsite || venueRecord.website || "",
      website: venueRecord.website || venueRecord.officialWebsite || "",
      socialMediaHandles: venueRecord.socialMediaHandles || {},
      instagramHandle: venueRecord.instagramHandle || venueRecord.socialMediaHandles?.instagram || "",
      genres: venueRecord.genres || [],
      categories: [evt.proposedType, "jsonld-event", ...(venueRecord.categories || []).slice(0, 4)],
      sourceUrl: venueRecord.officialWebsite || venueRecord.sourceUrl || "",
      sourceName: venueRecord.sourceName || "Google Places API",
      sourceConfirmations: {
        ...(venueRecord.sourceConfirmations || {}),
        publicPage: true,
        jsonLdEvent: true
      },
      discoveryMode: venueRecord.discoveryMode || "master-admin-refined-discovery-crawl",
      status: "pendingReview",
      entityKind: "event",
      legalCompliance: buildLegalCompliance(
        {...venueRecord, ...evt},
        "google_places+html+jsonld_event"
      )
    };
    merged.queueDocId = eventDocId({
      placesId: parentPlacesId,
      startIso: evt.eventStartIso,
      title: evt.proposedTitle
    });
    return merged;
  });
  return {
    venue: {
      ...venueRecord,
      relatedEvents: childEvents.map(e => ({
        queueDocId: e.queueDocId,
        proposedTitle: e.proposedTitle,
        eventStartIso: e.eventStartIso,
        ticketUrl: e.ticketUrl || "",
        lifecycleStatus: e.lifecycleStatus
      })),
      legalCompliance: buildLegalCompliance(
        venueRecord,
        "google_places+html+jsonld_event"
      )
    },
    childEvents
  };
}

function mergeQueuePolicy(existing = {}, incoming = {}) {
  const status = String(existing.status || "");
  const protectedStatuses = new Set(["approved", "rejected", "deleted"]);
  const preserveHuman = protectedStatuses.has(status) || existing.crawlScope === "updates-only" || incoming.crawlScope === "updates-only";
  const dynamicKeys = [
    "artistsOrDjs", "promoters", "ticketUrl", "proposedDate", "proposedTime",
    "eventStartIso", "eventEndIso", "missingDatapoints", "aiSummary", "aiConfidenceScore",
    "aiStarRating", "aiRatingReasons", "relatedEvents", "legalCompliance", "lifecycleStatus",
    "crawlerDateSource", "extractedImages", "categories", "genres", "searchQuery",
    "placesRating", "placesUserRatingCount", "businessStatus", "socialPagesFetched",
    "autoApproveDecision", "publishConfidence"
  ];
  const out = {...existing, ...incoming};
  if (preserveHuman) {
    // Protect contact / identity fields humans or prior approve already set.
    ["email", "telephone", "phone", "officialWebsite", "website", "proposedAddress",
      "streetAddress", "socialMediaHandles", "instagramHandle", "agePolicy"].forEach(key => {
      if (existing[key]) out[key] = existing[key];
    });
    if (existing.socialMediaHandles) {
      out.socialMediaHandles = {
        ...(incoming.socialMediaHandles || {}),
        ...existing.socialMediaHandles
      };
    }
    out.status = existing.status;
    out.approvedCollection = existing.approvedCollection || incoming.approvedCollection || "";
    out.approvedRecordId = existing.approvedRecordId || incoming.approvedRecordId || "";
    out.crawlScope = existing.crawlScope || incoming.crawlScope || "updates-only";
  }
  dynamicKeys.forEach(key => {
    if (incoming[key] !== undefined) out[key] = incoming[key];
  });
  out.updatedAt = incoming.updatedAt;
  out.lastCrawledAtIso = new Date().toISOString();
  return out;
}

module.exports = {
  CRAWL_USER_AGENT,
  PLACES_JOB_CONCURRENCY,
  HOST_MIN_DELAY_MS,
  SECONDARY_FOLLOW_LIMIT,
  mapPool,
  waitForHostBudget,
  sleep,
  normalizedKey,
  sha1Hex,
  placesDocId,
  eventDocId,
  websiteDocId,
  resolveQueueDocId,
  isTimedEventRecord,
  isEuUkCountry,
  buildLegalCompliance,
  extractJsonLdNodes,
  extractJsonLdEventsFromHtml,
  attachEventsFromHtml,
  mergeQueuePolicy,
  toIsoStart
};
