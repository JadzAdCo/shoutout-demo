/* Browser mirror of functions/discovery-gates-core.js — do not edit by hand; keep in lockstep. */
(function (global) {
"use strict";
const api = (function () {
/**
 * AI crawl import gates, establishment-duplicate matching, and club vs event kind.
 * Master Admin ticks which datapoints must be present before Approve / mass onboard.
 * Duplicates: same phone OR same physical address OR same club name (city aliases apply).
 */

const IMPORT_GATE_FIELDS = [
  {key: "name", label: "Name", group: "identity", appliesTo: "both", defaultVenue: 1, defaultEvent: 1},
  {key: "genres", label: "Genre", group: "nightlife", appliesTo: "both", defaultVenue: 0, defaultEvent: 0},
  {key: "artistsOrDjs", label: "DJ(s)/Artist(s)", group: "nightlife", appliesTo: "venue", defaultVenue: 0, defaultEvent: 0},
  {key: "promoters", label: "Promoter(s)", group: "nightlife", appliesTo: "both", defaultVenue: 0, defaultEvent: 0},
  {key: "address", label: "Address", group: "location", appliesTo: "both", defaultVenue: 1, defaultEvent: 0},
  {key: "city", label: "City", group: "location", appliesTo: "both", defaultVenue: 1, defaultEvent: 1},
  {key: "country", label: "Country", group: "location", appliesTo: "both", defaultVenue: 1, defaultEvent: 1},
  {key: "phone", label: "Phone", group: "contact", appliesTo: "both", defaultVenue: 1, defaultEvent: 0},
  {key: "email", label: "Email", group: "contact", appliesTo: "both", defaultVenue: 0, defaultEvent: 0},
  {key: "instagram", label: "Instagram", group: "social", appliesTo: "both", defaultVenue: 0, defaultEvent: 0},
  {key: "date", label: "Date", group: "schedule", appliesTo: "event", defaultVenue: 0, defaultEvent: 1},
  {key: "time", label: "Time", group: "schedule", appliesTo: "event", defaultVenue: 0, defaultEvent: 1}
];

/** Cities people use interchangeably (Monaco / Monte Carlo is the owner example). */
const CITY_ALIAS_GROUPS = [
  {
    id: "monaco-monte-carlo",
    members: [
      "monaco", "monte carlo", "monte-carlo", "montecarlo",
      "monaco ville", "monaco-ville", "monacoville",
      "mc-monte-carlo", "monte carlo monaco"
    ]
  },
  {
    id: "washington-dc",
    members: [
      "washington", "washington dc", "washington d c", "wash dc",
      "district of columbia", "dc"
    ]
  }
];

const COUNTRY_ALIAS_GROUPS = [
  {id: "monaco", members: ["monaco", "mc", "principality of monaco", "monaco monte carlo"]},
  {id: "united states", members: ["united states", "usa", "us", "united states of america", "america"]},
  {id: "united kingdom", members: ["united kingdom", "uk", "great britain", "britain", "england"]}
];

const VENUE_TYPE_LABELS = {
  nightclub: "Nightclub",
  beachClub: "Beach Club",
  lounge: "Lounge",
  rooftopLounge: "Rooftop Lounge",
  rooftopBar: "Rooftop Bar",
  dayClub: "Day Club",
  bar: "Bar",
  club: "Club"
};

const EVENT_TYPE_LABELS = {
  comedyShow: "Comedy Show",
  daytimeEvent: "Daytime Event",
  fleaMarket: "Flea Market",
  farmersMarket: "Farmers Market",
  communityMarket: "Community Market",
  festival: "Festival",
  concert: "Concert",
  promoterEvent: "Promoter Event",
  ticketedShow: "Ticketed Show",
  event: "Event"
};

function as01(value, fallback = 0) {
  if (value === 1 || value === "1" || value === true) return 1;
  if (value === 0 || value === "0" || value === false) return 0;
  return fallback;
}

function defaultImportGates() {
  const venue = {};
  const event = {};
  IMPORT_GATE_FIELDS.forEach(field => {
    venue[field.key] = field.defaultVenue;
    event[field.key] = field.defaultEvent;
  });
  return {venue, event};
}

function normalizeImportGates(raw = {}) {
  const defaults = defaultImportGates();
  const source = raw && typeof raw === "object" ? raw : {};
  const venueSrc = source.venue && typeof source.venue === "object" ? source.venue : source;
  const eventSrc = source.event && typeof source.event === "object" ? source.event : source;
  const venue = {};
  const event = {};
  IMPORT_GATE_FIELDS.forEach(field => {
    venue[field.key] = as01(venueSrc[field.key], defaults.venue[field.key]);
    event[field.key] = as01(eventSrc[field.key], defaults.event[field.key]);
  });
  return {venue, event};
}

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function hasAny(value) {
  if (Array.isArray(value)) return value.some(item => clean(item));
  return clean(value).length > 0;
}

function normalizedKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasIdFrom(value, groups) {
  const key = normalizedKey(value);
  if (!key) return "";
  for (const group of groups) {
    if (group.members.some(member => normalizedKey(member) === key)) return group.id;
  }
  return key;
}

function cityCanonical(value = "") {
  return aliasIdFrom(value, CITY_ALIAS_GROUPS);
}

function countryCanonical(value = "") {
  return aliasIdFrom(value, COUNTRY_ALIAS_GROUPS);
}

function citiesShareAlias(a = "", b = "") {
  const left = cityCanonical(a);
  const right = cityCanonical(b);
  if (!left || !right) return false;
  return left === right;
}

function datapointPresent(record = {}, key = "") {
  switch (key) {
    case "name":
      return hasAny(record.proposedTitle || record.proposedLocationName || record.locationName || record.brandName);
    case "genres":
      return hasAny(record.genres);
    case "artistsOrDjs":
      return hasAny(record.artistsOrDjs || record.artists || record.djs);
    case "promoters":
      return hasAny(record.promoters || record.promotionGroup || record.organizers);
    case "address":
      return hasAny(record.proposedAddress || record.address || record.streetAddress || record.fullAddress);
    case "city":
      return hasAny(record.city);
    case "country":
      return hasAny(record.country);
    case "phone":
      return hasAny(record.telephone || record.phone);
    case "email":
      return hasAny(record.email);
    case "instagram":
      return hasAny(record.socialMediaHandles?.instagram || record.instagramHandle);
    case "date":
      return hasAny(record.proposedDate || record.eventStartIso);
    case "time":
      return hasAny(record.proposedTime || (record.eventStartIso && String(record.eventStartIso).length > 10));
    default:
      return hasAny(record[key]);
  }
}

function isEventRecord(record = {}) {
  if (String(record.entityKind || "").toLowerCase() === "event") return true;
  if (String(record.entityKind || "").toLowerCase() === "venue") return false;
  const type = `${record.proposedType || ""} ${(record.categories || []).join(" ")} ${record.proposedTitle || ""}`;
  if (/daytime|comedy|festival|concert|flea|farmers|ticketed|music event/i.test(type) && !/club|lounge|bar/i.test(type)) {
    return true;
  }
  if (record.eventStartIso || (record.proposedDate && /event|show|festival|party|market/i.test(type))) return true;
  return false;
}

function missingDatapoints(record = {}, gates = null) {
  const normalized = normalizeImportGates(gates);
  const event = isEventRecord(record);
  const map = event ? normalized.event : normalized.venue;
  const missing = [];
  IMPORT_GATE_FIELDS.forEach(field => {
    if (field.appliesTo === "venue" && event) return;
    if (field.appliesTo === "event" && !event) return;
    if (map[field.key] !== 1) return;
    if (!datapointPresent(record, field.key)) {
      missing.push(event && field.key === "promoters" ? "Organizer(s) / Promoter(s)" : field.label);
    }
  });
  return missing;
}

function classifyEntity(record = {}) {
  const hay = [
    record.proposedType,
    record.primaryType,
    (record.categories || []).join(" "),
    (record.placesTypes || record.types || []).join(" "),
    record.proposedTitle,
    record.proposedLocationName,
    record.proposedDescription
  ].join(" ");
  const jsonLd = String(record.jsonLdType || record.schemaType || "");
  const timed = !!(record.eventStartIso || (record.proposedDate && /event|show|festival|party|market|concert/i.test(hay)));
  const eventHint = /music ?event|comedyevent|festival|concert|ticketed|daytime event|flea|farmers|standup|stand-up|^event$/i.test(`${hay} ${jsonLd}`);
  const venueHint = /night_club|nightclub|beach club|lounge|rooftop|day club|\bbar\b|\bclub\b|night club/i.test(hay)
    || /NightClub|BarOrPub|Nightclub/i.test(jsonLd);

  let entityKind = record.entityKind;
  if (entityKind !== "venue" && entityKind !== "event") {
    if (venueHint) entityKind = "venue";
    else if (eventHint || timed) entityKind = "event";
    else entityKind = "venue";
  }

  let venueCategory = "";
  let eventCategory = "";
  if (entityKind === "event") {
    if (/comedy|stand.?up/i.test(hay)) eventCategory = "comedyShow";
    else if (/flea/i.test(hay)) eventCategory = "fleaMarket";
    else if (/farmers/i.test(hay)) eventCategory = "farmersMarket";
    else if (/community market/i.test(hay)) eventCategory = "communityMarket";
    else if (/festival/i.test(hay)) eventCategory = "festival";
    else if (/concert/i.test(hay)) eventCategory = "concert";
    else if (/promoter/i.test(hay)) eventCategory = "promoterEvent";
    else if (/daytime|market|street fair/i.test(hay)) eventCategory = "daytimeEvent";
    else eventCategory = "event";
  } else {
    if (/beach/i.test(hay)) venueCategory = "beachClub";
    else if (/rooftop/i.test(hay) && /bar/i.test(hay)) venueCategory = "rooftopBar";
    else if (/rooftop/i.test(hay)) venueCategory = "rooftopLounge";
    else if (/day\s*club|dayclub/i.test(hay)) venueCategory = "dayClub";
    else if (/lounge/i.test(hay)) venueCategory = "lounge";
    else if (/night_club|nightclub|night club/i.test(hay)) venueCategory = "nightclub";
    else if (/\bbar\b/i.test(hay) && !/club/i.test(hay)) venueCategory = "bar";
    else venueCategory = "nightclub";
  }

  const proposedType = entityKind === "event" ? eventCategory : venueCategory;
  const kindLabel = entityKind === "event"
    ? (EVENT_TYPE_LABELS[eventCategory] || "Event")
    : (VENUE_TYPE_LABELS[venueCategory] || "Club");
  return {
    entityKind,
    venueCategory: entityKind === "venue" ? venueCategory : "",
    eventCategory: entityKind === "event" ? eventCategory : "",
    proposedType,
    kindLabel,
    listingClass: entityKind === "event" ? "event" : "club"
  };
}

function phoneKey(row = {}) {
  const raw = String(row.telephone || row.phone || row.nationalPhoneNumber || row.internationalPhoneNumber || "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return "";
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(-10);
  return digits.slice(-8);
}

function expandStreet(value = "") {
  return String(value || "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\broad\b/g, "rd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bplace\b/g, "pl");
}

function addressKey(row = {}) {
  let street = normalizedKey(row.streetAddress || row.addressLine1 || "");
  if (!street) street = normalizedKey(row.proposedAddress || row.address || row.fullAddress || row.formattedAddress || "");
  if (!street) return "";
  const city = cityCanonical(row.city);
  const country = countryCanonical(row.country);
  const stripTokens = [row.city, row.country, row.stateRegion, row.postalCode]
    .concat(CITY_ALIAS_GROUPS.flatMap(group => group.members))
    .map(normalizedKey)
    .filter(token => token.length > 1);
  stripTokens.forEach(token => {
    street = street.replace(new RegExp(`\\b${token.replace(/\s+/g, "\\s+")}\\b`, "g"), " ");
  });
  street = expandStreet(street)
    .replace(/\b(apt|apartment|unit|suite|ste|floor|fl|#)\b.*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!street) return "";
  return [street, city, country].filter(Boolean).join("|");
}

function nameKey(row = {}) {
  let text = normalizedKey(
    row.proposedLocationName || row.locationName || row.brandName || row.proposedTitle || row.name || ""
  );
  [row.city, row.country, row.stateRegion].filter(Boolean).forEach(part => {
    const key = normalizedKey(part);
    if (key.length > 2) text = text.replace(new RegExp(`\\b${key}\\b`, "g"), " ");
  });
  CITY_ALIAS_GROUPS.forEach(group => {
    group.members.forEach(member => {
      const key = normalizedKey(member);
      if (key) text = text.replace(new RegExp(`\\b${key}\\b`, "g"), " ");
    });
  });
  text = text
    .replace(/\b(beach club|night club|nightclub|day club|dayclub|club|lounge club|lounge|rooftop bar|rooftop lounge|bar|restaurant|venue|events?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function sameEstablishment(a = {}, b = {}) {
  if (!a || !b) return {match: false, reasons: []};
  if (a.id && b.id && String(a.id) === String(b.id)) return {match: false, reasons: []};
  if (a.placesId && b.placesId && String(a.placesId) === String(b.placesId)) {
    return {match: true, reasons: ["same-places-id"]};
  }
  const reasons = [];
  const phoneA = phoneKey(a);
  const phoneB = phoneKey(b);
  if (phoneA && phoneB && phoneA === phoneB) reasons.push("same-phone");
  const addrA = addressKey(a);
  const addrB = addressKey(b);
  if (addrA && addrB && addrA === addrB) reasons.push("same-address");
  const nameA = nameKey(a);
  const nameB = nameKey(b);
  const cityA = cityCanonical(a.city);
  const cityB = cityCanonical(b.city);
  const countryA = countryCanonical(a.country);
  const countryB = countryCanonical(b.country);
  const cityOk = (!cityA || !cityB || cityA === cityB);
  const countryOk = (!countryA || !countryB || countryA === countryB);
  if (nameA && nameB && nameA === nameB && cityOk && countryOk) reasons.push("same-name");
  return {
    match: reasons.length > 0,
    reasons,
    cityAliasApplied: cityA && cityB && cityA === cityB && normalizedKey(a.city) !== normalizedKey(b.city) ? cityA : ""
  };
}

function findDuplicates(record = {}, candidates = []) {
  const matches = [];
  const recordIsEvent = isEventRecord(record);
  (candidates || []).forEach(other => {
    if (!other) return;
    if (recordIsEvent !== isEventRecord(other)) return;
    const otherCollection = String(other.collection || other._collection || "");
    const sameQueueRow = (record.id && other.id && record.id === other.id)
      || (record.queueDocId && other.queueDocId && record.queueDocId === other.queueDocId)
      || (record.placesId && other.placesId && String(record.placesId) === String(other.placesId)
        && otherCollection !== "clubLocations" && otherCollection !== "events");
    if (sameQueueRow) return;
    if (record.placesId && other.placesId && String(record.placesId) === String(other.placesId)
      && (otherCollection === "clubLocations" || otherCollection === "events")) {
      matches.push({
        id: other.id || other.queueDocId || other.placesId,
        collection: otherCollection,
        name: other.locationName || other.proposedTitle || other.proposedLocationName || other.id,
        reasons: ["same-places-id"],
        cityAliasApplied: ""
      });
      return;
    }
    const result = sameEstablishment(record, other);
    if (!result.match) return;
    matches.push({
      id: other.id || other.queueDocId || other.placesId || "",
      collection: other.collection || other._collection || "",
      name: other.locationName || other.brandName || other.proposedTitle || other.proposedLocationName || other.id,
      reasons: result.reasons,
      cityAliasApplied: result.cityAliasApplied || ""
    });
  });
  return matches;
}

function applyDuplicateStamp(record = {}, matches = []) {
  const unique = [];
  const seen = new Set();
  matches.forEach(match => {
    const id = String(match.id || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    unique.push(match);
  });
  if (!unique.length) {
    return {
      ...record,
      duplicateFlag: false,
      duplicateCandidateIds: [],
      duplicateReasons: [],
      duplicateMatch: null
    };
  }
  const live = unique.find(row => /clubLocations|events/i.test(row.collection || ""));
  const reasons = [...new Set(unique.flatMap(row => row.reasons || []))];
  const alias = unique.map(row => row.cityAliasApplied).find(Boolean) || "";
  const stamp = {
    ...record,
    duplicateFlag: true,
    duplicateCandidateIds: unique.map(row => row.id),
    duplicateReasons: reasons,
    duplicateMatch: {
      kind: live ? "live" : "queue",
      matchId: (live || unique[0]).id,
      matchName: (live || unique[0]).name || "",
      collection: (live || unique[0]).collection || "",
      reasons,
      cityAliasApplied: alias
    }
  };
  if (live && stamp.entityKind !== "event") {
    stamp.crawlScope = "updates-only";
    stamp.discoveryMode = "onboarded-update-scan";
    stamp.onboardedListingId = live.id;
    stamp.onboardedCollection = live.collection || "clubLocations";
  }
  return stamp;
}

function proposedTypeFromJobEventType(eventType = "") {
  const text = String(eventType || "");
  if (/comedy/i.test(text)) return "comedyShow";
  if (/flea/i.test(text)) return "fleaMarket";
  if (/farmers/i.test(text)) return "farmersMarket";
  if (/community market/i.test(text)) return "communityMarket";
  if (/festival/i.test(text)) return "festival";
  if (/daytime/i.test(text)) return "daytimeEvent";
  if (/beach/i.test(text)) return "beachClub";
  if (/rooftop/i.test(text) && /bar/i.test(text)) return "rooftopBar";
  if (/rooftop/i.test(text)) return "rooftopLounge";
  if (/lounge/i.test(text)) return "lounge";
  if (/day\s*club|dayclub/i.test(text)) return "dayClub";
  if (/concert|ticket|promoter event|dj event|brunch|pool party|summer party|^event$/i.test(text)) return "event";
  if (/night\s*club|nightclub|club|bar|venue/i.test(text)) return "nightclub";
  return "nightclub";
}

return {
  IMPORT_GATE_FIELDS,
  CITY_ALIAS_GROUPS,
  COUNTRY_ALIAS_GROUPS,
  VENUE_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  defaultImportGates,
  normalizeImportGates,
  datapointPresent,
  isEventRecord,
  missingDatapoints,
  classifyEntity,
  cityCanonical,
  countryCanonical,
  citiesShareAlias,
  phoneKey,
  addressKey,
  nameKey,
  sameEstablishment,
  findDuplicates,
  applyDuplicateStamp,
  proposedTypeFromJobEventType,
  normalizedKey
};

})();
global.FLOQRDiscoveryGates = api;
})(typeof window !== "undefined" ? window : globalThis);
