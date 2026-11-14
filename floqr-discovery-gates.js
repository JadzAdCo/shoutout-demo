/* Browser mirror of functions/discovery-gates-core.js — do not edit by hand; keep in lockstep. */
(function (global) {
"use strict";
const api = (function () {
const CONTACT_MODES = [
  {key: "phoneOrEmail", label: "Phone or Email (at least one)"},
  {key: "phone", label: "Phone required"},
  {key: "email", label: "Email required"},
  {key: "none", label: "Contact optional"}
];

const DISCOVERY_CSV_COLUMNS = [
  {key: "recordKind", header: "recordKind", sampleClub: "club", sampleEvent: "event"},
  {key: "crawlType", header: "crawlType", sampleClub: "nightclub", sampleEvent: "comedyShow"},
  {key: "name", header: "name", sampleClub: "Jimmy'z Monte-Carlo", sampleEvent: "Friday Comedy Night"},
  {key: "genres", header: "genres", sampleClub: "Hip Hop, House", sampleEvent: "Comedy"},
  {key: "artistsOrDjs", header: "artistsOrDjs", sampleClub: "Resident DJs", sampleEvent: "Featured comics"},
  {key: "promoters", header: "promoters", sampleClub: "", sampleEvent: ""},
  {key: "address", header: "address", sampleClub: "26 Avenue Princesse Grace", sampleEvent: "12 Rue de la Gaite"},
  {key: "city", header: "city", sampleClub: "Monte Carlo", sampleEvent: "Paris"},
  {key: "country", header: "country", sampleClub: "Monaco", sampleEvent: "France"},
  {key: "phone", header: "phone", sampleClub: "+37798067000", sampleEvent: "+33144556677"},
  {key: "email", header: "email", sampleClub: "", sampleEvent: "comedy@example.com"},
  {key: "instagram", header: "instagram", sampleClub: "jimmyzmontecarlo", sampleEvent: ""},
  {key: "facebook", header: "facebook", sampleClub: "", sampleEvent: ""},
  {key: "website", header: "website", sampleClub: "https://www.montecarlosbm.com/en/jimmyz", sampleEvent: "https://www.example-comedy.fr"},
  {key: "date", header: "date", sampleClub: "", sampleEvent: "2026-12-18"},
  {key: "time", header: "time", sampleClub: "", sampleEvent: "21:00"},
  {key: "description", header: "description", sampleClub: "Iconic Monte-Carlo nightclub.", sampleEvent: "Stand-up comedy with featured artists."},
  {key: "ticketUrl", header: "ticketUrl", sampleClub: "", sampleEvent: "https://www.eventbrite.com/e/example"},
  {key: "sourceUrl", header: "sourceUrl", sampleClub: "https://www.montecarlosbm.com/en/jimmyz", sampleEvent: "https://www.example-comedy.fr/friday"},
  {key: "placesId", header: "placesId", sampleClub: "", sampleEvent: ""}
];

const IMPORT_GATE_FIELDS = [
  {key: "name", label: "Name", group: "identity", appliesTo: "both", defaultVenue: 1, defaultEvent: 1},
  {key: "genres", label: "Genre", group: "nightlife", appliesTo: "both", defaultVenue: 1, defaultEvent: 1},
  {key: "artistsOrDjs", label: "DJ(s)/Artist(s)", group: "nightlife", appliesTo: "venue", defaultVenue: 1, defaultEvent: 0},
  {key: "promoters", label: "Promoter(s)", group: "nightlife", appliesTo: "both", defaultVenue: 0, defaultEvent: 0},
  {key: "address", label: "Address", group: "location", appliesTo: "both", defaultVenue: 1, defaultEvent: 1},
  {key: "city", label: "City", group: "location", appliesTo: "both", defaultVenue: 1, defaultEvent: 1},
  {key: "country", label: "Country", group: "location", appliesTo: "both", defaultVenue: 1, defaultEvent: 1},
  {key: "phone", label: "Phone", group: "contact", appliesTo: "both", defaultVenue: 0, defaultEvent: 0},
  {key: "email", label: "Email", group: "contact", appliesTo: "both", defaultVenue: 0, defaultEvent: 0},
  {key: "instagram", label: "Instagram", group: "social", appliesTo: "both", defaultVenue: 0, defaultEvent: 0},
  {key: "date", label: "Date", group: "schedule", appliesTo: "event", defaultVenue: 0, defaultEvent: 1},
  {key: "time", label: "Time", group: "schedule", appliesTo: "event", defaultVenue: 0, defaultEvent: 1}
];

const NIGHTLIFE_VENUE_FIELDS = {
  name: 1, genres: 1, artistsOrDjs: 1, promoters: 0, address: 1, city: 1, country: 1,
  phone: 0, email: 0, instagram: 0, date: 0, time: 0
};
const NIGHTLIFE_EVENT_FIELDS = {
  name: 1, genres: 1, artistsOrDjs: 1, promoters: 0, address: 1, city: 1, country: 1,
  phone: 0, email: 0, instagram: 0, date: 1, time: 1
};
const DAYTIME_EVENT_FIELDS = {
  name: 1, genres: 1, artistsOrDjs: 0, promoters: 0, address: 1, city: 1, country: 1,
  phone: 0, email: 0, instagram: 0, date: 1, time: 1
};

const CRAWL_TYPE_CATALOG = [
  {key: "nightclub", label: "Nightclub", family: "venue", fields: NIGHTLIFE_VENUE_FIELDS, contactMode: "phoneOrEmail"},
  {key: "club", label: "Club", family: "venue", fields: NIGHTLIFE_VENUE_FIELDS, contactMode: "phoneOrEmail"},
  {key: "beachClub", label: "Beach Club", family: "venue", fields: NIGHTLIFE_VENUE_FIELDS, contactMode: "phoneOrEmail"},
  {key: "lounge", label: "Lounge", family: "venue", fields: NIGHTLIFE_VENUE_FIELDS, contactMode: "phoneOrEmail"},
  {key: "rooftopLounge", label: "Rooftop Lounge", family: "venue", fields: NIGHTLIFE_VENUE_FIELDS, contactMode: "phoneOrEmail"},
  {key: "rooftopBar", label: "Rooftop Bar", family: "venue", fields: NIGHTLIFE_VENUE_FIELDS, contactMode: "phoneOrEmail"},
  {key: "dayClub", label: "Day Club", family: "venue", fields: NIGHTLIFE_VENUE_FIELDS, contactMode: "phoneOrEmail"},
  {key: "bar", label: "Bar", family: "venue", fields: NIGHTLIFE_VENUE_FIELDS, contactMode: "phoneOrEmail"},
  {key: "comedyShow", label: "Comedy Show", family: "event", fields: NIGHTLIFE_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "concert", label: "Concert", family: "event", fields: NIGHTLIFE_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "ticketedShow", label: "Ticketed Show", family: "event", fields: NIGHTLIFE_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "promoterEvent", label: "Promoter Event", family: "event", fields: NIGHTLIFE_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "event", label: "Event", family: "event", fields: NIGHTLIFE_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "daytimeEvent", label: "Daytime Event", family: "event", fields: DAYTIME_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "fleaMarket", label: "Flea Market", family: "event", fields: DAYTIME_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "farmersMarket", label: "Farmers Market", family: "event", fields: DAYTIME_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "communityMarket", label: "Community Market", family: "event", fields: DAYTIME_EVENT_FIELDS, contactMode: "phoneOrEmail"},
  {key: "festival", label: "Festival", family: "event", fields: DAYTIME_EVENT_FIELDS, contactMode: "phoneOrEmail"}
];

const DEFAULT_PAST_EVENT_POLICY = {
  ignoreOnCrawl: 1,
  retireAfterDays: 14,
  removeAfterDays: 14
};

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

function cloneFields(fields = {}) {
  const next = {};
  IMPORT_GATE_FIELDS.forEach(field => {
    next[field.key] = as01(fields[field.key], field.defaultVenue);
  });
  return next;
}

function defaultPublishingRules() {
  const rules = {};
  CRAWL_TYPE_CATALOG.forEach(type => {
    rules[type.key] = {
      fields: cloneFields(type.fields),
      contactMode: type.contactMode || "phoneOrEmail"
    };
  });
  return rules;
}

function normalizeContactMode(value, fallback = "phoneOrEmail") {
  const key = String(value || "").trim();
  return CONTACT_MODES.some(mode => mode.key === key) ? key : fallback;
}

function normalizePublishingRules(raw = {}) {
  const defaults = defaultPublishingRules();
  const source = raw && typeof raw === "object" ? raw : {};
  const next = {};
  CRAWL_TYPE_CATALOG.forEach(type => {
    const row = source[type.key] && typeof source[type.key] === "object" ? source[type.key] : {};
    const fieldsSrc = row.fields && typeof row.fields === "object" ? row.fields : row;
    next[type.key] = {
      fields: cloneFields({...defaults[type.key].fields, ...fieldsSrc}),
      contactMode: normalizeContactMode(row.contactMode, defaults[type.key].contactMode)
    };
  });
  return next;
}

function normalizePastEventPolicy(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    ignoreOnCrawl: as01(source.ignoreOnCrawl, DEFAULT_PAST_EVENT_POLICY.ignoreOnCrawl),
    retireAfterDays: Math.max(0, Number(source.retireAfterDays ?? DEFAULT_PAST_EVENT_POLICY.retireAfterDays) || 0),
    removeAfterDays: Math.max(0, Number(source.removeAfterDays ?? DEFAULT_PAST_EVENT_POLICY.removeAfterDays) || 0)
  };
}

function defaultImportGates() {
  const rules = defaultPublishingRules();
  return {
    venue: {...rules.nightclub.fields},
    event: {...rules.daytimeEvent.fields}
  };
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
    case "facebook":
      return hasAny(record.socialMediaHandles?.facebook || record.facebookHandle);
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

function crawlTypeOf(record = {}) {
  const classified = classifyEntity(record);
  if (classified.entityKind === "event") return classified.eventCategory || "event";
  return classified.venueCategory || "nightclub";
}

function publishingRuleFor(record = {}, bundle = null) {
  const rules = bundle && bundle.publishingRules
    ? normalizePublishingRules(bundle.publishingRules)
    : (bundle && (bundle.nightclub || bundle.daytimeEvent) ? normalizePublishingRules(bundle) : defaultPublishingRules());
  const type = crawlTypeOf(record);
  return rules[type] || (isEventRecord(record) ? rules.daytimeEvent : rules.nightclub);
}

function missingContact(record = {}, mode = "phoneOrEmail") {
  const phone = datapointPresent(record, "phone");
  const email = datapointPresent(record, "email");
  if (mode === "phone") return phone ? [] : ["Phone"];
  if (mode === "email") return email ? [] : ["Email"];
  if (mode === "phoneOrEmail") return (phone || email) ? [] : ["Phone or Email"];
  return [];
}

function missingDatapoints(record = {}, gates = null) {
  const event = isEventRecord(record);
  const missing = [];
  const bundle = gates && typeof gates === "object" ? gates : null;
  const hasPublishing = !!(bundle && (bundle.publishingRules || bundle.nightclub || bundle.beachClub));
  if (hasPublishing || !bundle || (!bundle.venue && !bundle.event)) {
    const rule = publishingRuleFor(record, bundle);
    IMPORT_GATE_FIELDS.forEach(field => {
      if (field.appliesTo === "venue" && event) return;
      if (field.appliesTo === "event" && !event) return;
      if (rule.fields[field.key] !== 1) return;
      if (field.key === "phone" || field.key === "email") return;
      if (!datapointPresent(record, field.key)) {
        missing.push(event && field.key === "promoters" ? "Organizer(s) / Promoter(s)" : field.label);
      }
    });
    missing.push(...missingContact(record, rule.contactMode));
    return missing;
  }
  const normalized = normalizeImportGates(bundle);
  const map = event ? normalized.event : normalized.venue;
  IMPORT_GATE_FIELDS.forEach(field => {
    if (field.appliesTo === "venue" && event) return;
    if (field.appliesTo === "event" && !event) return;
    if (map[field.key] !== 1) return;
    if (!datapointPresent(record, field.key)) {
      missing.push(event && field.key === "promoters" ? "Organizer(s) / Promoter(s)" : field.label);
    }
  });
  const contactMode = bundle.contactMode || (event ? "phoneOrEmail" : "phoneOrEmail");
  if (!map.phone && !map.email) missing.push(...missingContact(record, contactMode));
  return missing;
}

function publishBlockers(record = {}, bundle = null) {
  const missing = missingDatapoints(record, bundle);
  const duplicateBlocks = !!(record.duplicateFlag && record.crawlScope !== "updates-only");
  const past = isEventRecord(record) && /^(past|retired|removed)$/i.test(String(record.lifecycleStatus || ""));
  const blockers = [...missing];
  if (duplicateBlocks) {
    const who = record.duplicateMatch?.matchName || record.duplicateMatch?.matchId || "another listing";
    blockers.push(`Possible duplicate of ${who}`);
  }
  if (past) blockers.push("Past event");
  return {
    ok: blockers.length === 0,
    missing,
    duplicateBlocks,
    pastEvent: past,
    blockers
  };
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

function csvEscape(value = "") {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function splitCsvLine(line = "") {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function csvHeaderRow() {
  return DISCOVERY_CSV_COLUMNS.map(col => col.header).join(",");
}

function listCell(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  return String(value || "").replace(/,/g, "; ");
}

function csvRowFromRecord(record = {}) {
  const classified = classifyEntity(record);
  const kind = classified.entityKind === "event" ? "event" : "club";
  const crawlType = crawlTypeOf(record);
  const values = {
    recordKind: kind,
    crawlType,
    name: record.proposedTitle || record.proposedLocationName || record.locationName || record.eventName || "",
    genres: listCell(record.genres),
    artistsOrDjs: listCell(record.artistsOrDjs || record.artists || record.djs),
    promoters: listCell(record.promoters || record.organizers),
    address: record.proposedAddress || record.address || record.fullAddress || record.streetAddress || "",
    city: record.city || "",
    country: record.country || "",
    phone: record.telephone || record.phone || "",
    email: record.email || "",
    instagram: record.socialMediaHandles?.instagram || record.instagramHandle || "",
    facebook: record.socialMediaHandles?.facebook || record.facebookHandle || "",
    website: record.officialWebsite || record.website || "",
    date: record.proposedDate || record.eventDate || (record.eventStartIso || "").slice(0, 10),
    time: record.proposedTime || record.eventTime || "",
    description: record.proposedDescription || record.aiSummary || record.description || "",
    ticketUrl: record.ticketUrl || "",
    sourceUrl: record.sourceUrl || "",
    placesId: record.placesId || ""
  };
  return DISCOVERY_CSV_COLUMNS.map(col => csvEscape(values[col.key] || "")).join(",");
}

function serializeDiscoveryCsv(records = []) {
  const lines = [csvHeaderRow()];
  (records || []).forEach(record => lines.push(csvRowFromRecord(record)));
  return `${lines.join("\r\n")}\r\n`;
}

function sampleDiscoveryCsv() {
  const club = {};
  const event = {};
  DISCOVERY_CSV_COLUMNS.forEach(col => {
    club[col.key] = col.sampleClub;
    event[col.key] = col.sampleEvent;
  });
  return serializeDiscoveryCsv([
    recordFromCsvRow(club),
    recordFromCsvRow(event)
  ]);
}

function recordFromCsvRow(row = {}) {
  const kind = String(row.recordKind || row.kind || "").toLowerCase() === "event" ? "event" : "club";
  const crawlType = String(row.crawlType || row.proposedType || (kind === "event" ? "event" : "nightclub")).trim();
  const genres = String(row.genres || "").split(/[;,]/).map(part => part.trim()).filter(Boolean);
  const artists = String(row.artistsOrDjs || "").split(/[;,]/).map(part => part.trim()).filter(Boolean);
  const promoters = String(row.promoters || "").split(/[;,]/).map(part => part.trim()).filter(Boolean);
  const instagram = String(row.instagram || "").replace(/^@/, "").trim();
  const facebook = String(row.facebook || "").replace(/^@/, "").trim();
  const record = {
    entityKind: kind === "event" ? "event" : "venue",
    proposedType: crawlType,
    proposedTitle: row.name || "",
    proposedLocationName: kind === "club" ? (row.name || "") : "",
    genres,
    artistsOrDjs: artists,
    promoters,
    proposedAddress: row.address || "",
    streetAddress: row.address || "",
    city: row.city || "",
    country: row.country || "",
    telephone: row.phone || "",
    phone: row.phone || "",
    email: row.email || "",
    instagramHandle: instagram,
    facebookHandle: facebook,
    socialMediaHandles: {instagram, facebook},
    officialWebsite: row.website || "",
    website: row.website || "",
    proposedDate: row.date || "",
    proposedTime: row.time || "",
    eventStartIso: row.date ? `${row.date}T${row.time || "12:00"}` : "",
    proposedDescription: row.description || "",
    ticketUrl: row.ticketUrl || "",
    sourceUrl: row.sourceUrl || "",
    placesId: row.placesId || "",
    discoveryMode: "csv-import",
    status: "pendingReview"
  };
  return {...record, ...classifyEntity(record)};
}

function parseDiscoveryCsv(text = "") {
  const raw = String(text || "").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return {headers: [], rows: [], records: [], errors: ["Empty CSV"]};
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const expected = DISCOVERY_CSV_COLUMNS.map(col => col.header);
  const missingHeaders = expected.filter(name => !headers.includes(name));
  const errors = [];
  if (missingHeaders.length) {
    errors.push(`CSV headers must match the template. Missing: ${missingHeaders.join(", ")}`);
  }
  const records = [];
  const rows = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((header, i) => { row[header] = cells[i] || ""; });
    rows.push(row);
    if (!String(row.name || "").trim()) {
      errors.push(`Row ${index + 2}: name is required`);
      return;
    }
    records.push(recordFromCsvRow(row));
  });
  return {headers, rows, records, errors, templateMatch: missingHeaders.length === 0};
}

return {
  IMPORT_GATE_FIELDS,
  CONTACT_MODES,
  DISCOVERY_CSV_COLUMNS,
  CRAWL_TYPE_CATALOG,
  CITY_ALIAS_GROUPS,
  COUNTRY_ALIAS_GROUPS,
  VENUE_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  DEFAULT_PAST_EVENT_POLICY,
  defaultImportGates,
  normalizeImportGates,
  defaultPublishingRules,
  normalizePublishingRules,
  normalizePastEventPolicy,
  datapointPresent,
  isEventRecord,
  crawlTypeOf,
  publishingRuleFor,
  missingDatapoints,
  publishBlockers,
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
  normalizedKey,
  csvHeaderRow,
  csvRowFromRecord,
  serializeDiscoveryCsv,
  sampleDiscoveryCsv,
  parseDiscoveryCsv,
  recordFromCsvRow
};

})();
global.FLOQRDiscoveryGates = api;
})(typeof window !== "undefined" ? window : globalThis);
