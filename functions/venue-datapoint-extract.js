/* FLOQR venue datapoint extraction — crawl ingest → public profile shape. */
"use strict";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Canonical venue datapoints for Club Public Profile + scheduling + discovery. */
const VENUE_PUBLIC_PROFILE_DATAPOINTS = [
  {key: "locationName", label: "Venue / club name", group: "identity", required: true},
  {key: "brandName", label: "Brand name", group: "identity", required: false},
  {key: "tagline", label: "Public tagline", group: "identity", required: false},
  {key: "description", label: "Public description", group: "identity", required: false},
  {key: "type", label: "Venue type (club / lounge / bar / beach)", group: "identity", required: false},
  {key: "categories", label: "Categories", group: "identity", required: false},
  {key: "cuisine", label: "Cuisine / concept", group: "identity", required: false},
  {key: "streetAddress", label: "Street address", group: "location", required: true},
  {key: "city", label: "City", group: "location", required: true},
  {key: "stateRegion", label: "State / region", group: "location", required: false},
  {key: "postalCode", label: "Postal code", group: "location", required: false},
  {key: "country", label: "Country", group: "location", required: true},
  {key: "telephone", label: "Telephone", group: "contact", required: true},
  {key: "email", label: "Email", group: "contact", required: true},
  {key: "officialWebsite", label: "Official website", group: "contact", required: false},
  {key: "menuUrl", label: "Menu URL", group: "contact", required: false},
  {key: "reservationsUrl", label: "Reservations URL", group: "contact", required: false},
  {key: "contactUrl", label: "Contact page URL", group: "contact", required: false},
  {key: "socialMediaHandles.instagram", label: "Instagram", group: "social", required: true},
  {key: "socialMediaHandles.facebook", label: "Facebook", group: "social", required: false},
  {key: "socialMediaHandles.x", label: "X / Twitter", group: "social", required: false},
  {key: "socialMediaHandles.tiktok", label: "TikTok", group: "social", required: false},
  {key: "socialMediaHandles.floqrHandle", label: "FloqR / Mingl handle", group: "social", required: false},
  {key: "genres", label: "Music genres", group: "nightlife", required: true},
  {key: "artistsOrDjs", label: "DJ(s) / artist(s)", group: "nightlife", required: true},
  {key: "promoters", label: "Promoter(s)", group: "nightlife", required: true},
  {key: "amenities", label: "Amenities", group: "nightlife", required: false},
  {key: "agePolicy", label: "Age policy", group: "nightlife", required: false},
  {key: "dressCode", label: "Dress code", group: "nightlife", required: false},
  {key: "publicServices", label: "FLOQR services", group: "nightlife", required: false},
  {key: "hours", label: "Hours summary blurb", group: "hours", required: false},
  {key: "hoursStructured", label: "Weekly open/closed hours", group: "hours", required: false},
  {key: "hoursExceptions", label: "Period hour overrides", group: "hours", required: false},
  {key: "timeZone", label: "Venue time zone", group: "hours", required: false},
  {key: "featuredDjs", label: "Featured DJs", group: "people", required: false},
  {key: "featuredStaff", label: "Featured service staff", group: "people", required: false},
  {key: "promotionGroups", label: "Promotion groups", group: "people", required: false},
  {key: "logoUrl", label: "Club logo URL", group: "media", required: false},
  {key: "extractedImages", label: "Extracted images", group: "media", required: false},
  {key: "displayScreenFormatIds", label: "Display screen formats", group: "display", required: false},
  {key: "primaryDisplayScreenFormatId", label: "Primary display format", group: "display", required: false}
];

function clip(value = "", max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function uniqueList(values = [], max = 24) {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : String(values || "").split(/[,|;]/)).forEach(item => {
    const raw = clip(item, 80);
    const key = raw.toLowerCase();
    if (!raw || seen.has(key)) return;
    seen.add(key);
    out.push(raw);
  });
  return out.slice(0, max);
}

function extractEmail(value = "") {
  const match = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) return "";
  const email = match[0];
  if (/example\.com|sentry\.|wixpress|schema\.org/i.test(email)) return "";
  return email;
}

function extractPhone(value = "") {
  const matches = String(value || "").match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g) || [];
  return (matches.find(item => {
    const digits = item.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 && !/^\d{6}$/.test(digits);
  }) || "").trim();
}

function extractSocialHandles(textOrHtml = "") {
  const raw = String(textOrHtml || "");
  const pick = (re) => {
    const m = raw.match(re);
    return m ? clip(m[1] || m[0], 80).replace(/\/$/, "") : "";
  };
  const instagram = pick(/instagram\.com\/([A-Za-z0-9._]+)/i)
    || pick(/@([A-Za-z0-9._]{2,30})\b(?=[^<]{0,40}instagram|ig\b)/i)
    || "";
  const facebook = pick(/facebook\.com\/([A-Za-z0-9.]+)/i);
  const tiktok = pick(/tiktok\.com\/@?([A-Za-z0-9._]+)/i);
  const x = pick(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/i);
  return {
    instagram: instagram && !/reel|p\/|stories|explore/i.test(instagram) ? (instagram.startsWith("@") ? instagram : `@${instagram}`) : "",
    facebook: facebook || "",
    tiktok: tiktok ? (tiktok.startsWith("@") ? tiktok : `@${tiktok}`) : "",
    x: x && !/intent|share|home/i.test(x) ? (x.startsWith("@") ? x : `@${x}`) : "",
    floqrHandle: ""
  };
}

function extractUrlByLabel(htmlOrText = "", labels = []) {
  const raw = String(htmlOrText || "");
  for (const label of labels) {
    const re = new RegExp(`(?:href=["']([^"']+)["'][^>]*>\\s*[^<]*${label}|${label}[^\\n]{0,80}(https?:\\/\\/\\S+))`, "i");
    const m = raw.match(re);
    if (m) return clip(m[1] || m[2], 300).replace(/[),.;]+$/, "");
  }
  return "";
}

function extractAmenities(text = "") {
  const source = String(text || "");
  const catalog = [
    "VIP tables", "Bottle service", "Coat check", "Valet", "Valet parking", "Outdoor", "Patio",
    "Rooftop", "Garden", "Dance floor", "DJ booth", "Live music", "Karaoke", "Hookah",
    "Kitchen", "Full kitchen", "Late kitchen", "Happy hour", "Private rooms", "Wheelchair accessible",
    "Parking", "Street parking", "Reservations", "Walk-ins welcome", "Dress code enforced"
  ];
  return catalog.filter(item => new RegExp(`\\b${item.replace(/\s+/g, "\\s+")}\\b`, "i").test(source));
}

function extractAgePolicy(text = "") {
  const m = String(text || "").match(/\b(18\+|19\+|21\+|all ages|18 and over|21 and over)(?:\s*(?:with\s+valid\s+id)?)?/i);
  return m ? clip(m[0], 80) : "";
}

function extractDressCode(text = "") {
  const m = String(text || "").match(/dress\s*code[:\s-]+([^.\n]{6,80})/i)
    || String(text || "").match(/\b(upscale|smart casual|no sneakers|no athletic wear|nightlife attire|elegant casual)\b[^.\n]{0,40}/i);
  return m ? clip(m[1] || m[0], 120) : "";
}

function extractCuisine(text = "") {
  const m = String(text || "").match(/\b(south american|latin|mediterranean|asian fusion|japanese|italian|french|american|seafood|steakhouse|tapas|fusion)\b(?:\s+(?:cuisine|food|restaurant))?/i);
  return m ? clip(m[0], 80) : "";
}

function extractTagline(html = "", title = "") {
  const og = String(html || "").match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || String(html || "").match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const candidate = clip(og?.[1] || "", 140);
  if (candidate && candidate.toLowerCase() !== String(title || "").toLowerCase()) return candidate;
  return "";
}

function parseClockToken(value = "") {
  const raw = clip(value, 40).toLowerCase().replace(/\./g, "");
  if (!raw || /closed|ferme|geschlossen|cerrado/.test(raw)) return null;
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const ap = String(m[3] || "").toLowerCase();
  if (ap.startsWith("p") && hour < 12) hour += 12;
  if (ap.startsWith("a") && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function blankHoursStructured() {
  const blank = {closed: true, open: "", close: ""};
  return Object.fromEntries(DAY_KEYS.map(key => [key, {...blank}]));
}

function parseHoursLine(line = "") {
  const raw = clip(line, 160);
  if (!raw) return null;
  if (/closed/i.test(raw)) return {closed: true, open: "", close: ""};
  const parts = raw.split(/\s*[–—\-to]+\s*/i);
  if (parts.length < 2) return null;
  const open = parseClockToken(parts[0]);
  const close = parseClockToken(parts[1]);
  if (!open || !close) return null;
  return {closed: false, open, close};
}

function extractHoursStructured(textOrHtml = "") {
  const source = String(textOrHtml || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(p|li|div|tr|td)[^>]*>/gi, "\n");
  const hours = blankHoursStructured();
  let found = 0;
  DAY_LABELS.forEach((label, idx) => {
    const key = DAY_KEYS[idx];
    const re = new RegExp(`${label.slice(0, 3)}[a-z]*\\s*[:\\-]?\\s*([^\\n<]{0,60})`, "i");
    const m = source.match(re);
    if (!m) return;
    const parsed = parseHoursLine(m[1]);
    if (!parsed) return;
    hours[key] = parsed;
    found += 1;
  });
  if (!found) {
    const range = source.match(/\b((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)\s*[–—\-]\s*((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)\s*[:\\-]?\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*[–—\-to]+\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i);
    if (range) {
      const startIdx = DAY_LABELS.findIndex(d => d.toLowerCase().startsWith(range[1].slice(0, 3).toLowerCase()));
      const endIdx = DAY_LABELS.findIndex(d => d.toLowerCase().startsWith(range[2].slice(0, 3).toLowerCase()));
      const parsed = parseHoursLine(range[3]);
      if (parsed && startIdx >= 0 && endIdx >= 0) {
        for (let i = startIdx; ; i = (i + 1) % 7) {
          hours[DAY_KEYS[i]] = {...parsed};
          found += 1;
          if (i === endIdx) break;
        }
      }
    }
  }
  return found ? hours : null;
}

function hoursBlurbFromStructured(structured) {
  if (!structured) return "";
  const bits = [];
  DAY_KEYS.forEach((key, idx) => {
    const day = structured[key];
    if (!day || day.closed) return;
    bits.push(`${DAY_LABELS[idx].slice(0, 3)} ${day.open}–${day.close}`);
  });
  return bits.join(", ");
}

function hoursStructuredFromPlaces(regularOpeningHours = {}) {
  const hours = blankHoursStructured();
  const periods = Array.isArray(regularOpeningHours.periods) ? regularOpeningHours.periods : [];
  if (periods.length) {
    periods.forEach(period => {
      const openDay = Number(period?.open?.day);
      if (!Number.isFinite(openDay) || openDay < 0 || openDay > 6) return;
      const openH = Number(period?.open?.hour || 0);
      const openM = Number(period?.open?.minute || 0);
      const closeH = Number(period?.close?.hour ?? openH);
      const closeM = Number(period?.close?.minute || 0);
      hours[DAY_KEYS[openDay]] = {
        closed: false,
        open: `${String(openH).padStart(2, "0")}:${String(openM).padStart(2, "0")}`,
        close: `${String(closeH).padStart(2, "0")}:${String(closeM).padStart(2, "0")}`
      };
    });
    return hours;
  }
  const descriptions = Array.isArray(regularOpeningHours.weekdayDescriptions)
    ? regularOpeningHours.weekdayDescriptions
    : [];
  descriptions.forEach(line => {
    const m = String(line || "").match(/^([A-Za-z]+)\s*:\s*(.+)$/);
    if (!m) return;
    const idx = DAY_LABELS.findIndex(d => d.toLowerCase().startsWith(m[1].slice(0, 3).toLowerCase()));
    if (idx < 0) return;
    const parsed = parseHoursLine(m[2]);
    if (parsed) hours[DAY_KEYS[idx]] = parsed;
  });
  const anyOpen = DAY_KEYS.some(key => hours[key] && !hours[key].closed);
  return anyOpen ? hours : null;
}

function guessTimeZone(country = "") {
  const raw = clip(country, 80).toUpperCase();
  if (/UNITED\s*STATES|\bUSA\b|\bUS\b/.test(raw)) return "America/New_York";
  if (/CANADA/.test(raw)) return "America/Toronto";
  if (/UNITED\s*KINGDOM|\bUK\b|ENGLAND/.test(raw)) return "Europe/London";
  if (/FRANCE/.test(raw)) return "Europe/Paris";
  if (/GERMANY|DEUTSCH/.test(raw)) return "Europe/Berlin";
  if (/NETHERLAND|HOLLAND|NEDERLAND/.test(raw)) return "Europe/Amsterdam";
  if (/SPAIN|ESPA/.test(raw)) return "Europe/Madrid";
  if (/ITALY|ITALIA/.test(raw)) return "Europe/Rome";
  if (/PORTUGAL/.test(raw)) return "Europe/Lisbon";
  if (/BELGIUM|BELGIQUE/.test(raw)) return "Europe/Brussels";
  return "America/New_York";
}

function extractArtistsHint(text = "") {
  const m = String(text || "").match(/(?:dj|resident|featuring|with)\s+([A-Z][A-Za-z0-9 .'-]{2,40})/gi) || [];
  return uniqueList(m.map(item => item.replace(/^(?:dj|resident|featuring|with)\s+/i, "")), 8);
}

function extractPromotersHint(text = "") {
  const m = String(text || "").match(/(?:presented by|promoted by|promotion(?:s)? by)\s+([A-Z][A-Za-z0-9 .'-]{2,50})/gi) || [];
  return uniqueList(m.map(item => item.replace(/^(?:presented by|promoted by|promotion(?:s)? by)\s+/i, "")), 6);
}

/**
 * Enrich a discovery/venue record from HTML + visible text.
 * Does not wipe existing non-empty fields.
 */
function enrichVenueRecord(record = {}, {html = "", text: visibleText = ""} = {}) {
  const blob = `${html}\n${visibleText}\n${record.proposedDescription || ""}\n${record.aiSummary || ""}`;
  const next = {...record};
  const socials = extractSocialHandles(blob);
  next.socialMediaHandles = {
    instagram: record.socialMediaHandles?.instagram || socials.instagram,
    facebook: record.socialMediaHandles?.facebook || socials.facebook,
    x: record.socialMediaHandles?.x || socials.x,
    tiktok: record.socialMediaHandles?.tiktok || socials.tiktok,
    floqrHandle: record.socialMediaHandles?.floqrHandle || ""
  };
  next.email = record.email || extractEmail(blob);
  next.telephone = record.telephone || record.phone || extractPhone(blob);
  next.phone = next.telephone;
  next.amenities = uniqueList([...(record.amenities || []), ...extractAmenities(blob)]);
  next.agePolicy = record.agePolicy || extractAgePolicy(blob);
  next.dressCode = record.dressCode || extractDressCode(blob);
  next.cuisine = record.cuisine || extractCuisine(blob);
  next.tagline = record.tagline || extractTagline(html, record.proposedTitle || record.locationName || "");
  next.menuUrl = record.menuUrl || extractUrlByLabel(blob, ["menu"]);
  next.reservationsUrl = record.reservationsUrl || extractUrlByLabel(blob, ["reserv", "book a table", "opentable"]);
  next.contactUrl = record.contactUrl || extractUrlByLabel(blob, ["contact"]);
  const hoursStructured = record.hoursStructured || extractHoursStructured(blob);
  if (hoursStructured) {
    next.hoursStructured = hoursStructured;
    next.hours = record.hours || hoursBlurbFromStructured(hoursStructured);
  }
  next.timeZone = record.timeZone || guessTimeZone(record.country || "");
  next.artistsOrDjs = uniqueList([...(record.artistsOrDjs || record.artists || record.djs || []), ...extractArtistsHint(blob)]);
  next.promoters = uniqueList([...(record.promoters || []), ...extractPromotersHint(blob)]);
  if (!next.promotionGroup && next.promoters[0]) next.promotionGroup = next.promoters[0];
  next.publicServices = uniqueList(record.publicServices || ["ShoutOut", "Guest List"]);
  next.displayScreenFormatIds = Array.isArray(record.displayScreenFormatIds) && record.displayScreenFormatIds.length
    ? record.displayScreenFormatIds
    : ["led-96x48", "led-64x32"];
  next.primaryDisplayScreenFormatId = record.primaryDisplayScreenFormatId || "led-96x48";
  next.venueDatapointsCaptured = summarizeCaptured(next);
  return next;
}

function summarizeCaptured(record = {}) {
  const captured = [];
  const missing = [];
  VENUE_PUBLIC_PROFILE_DATAPOINTS.forEach(dp => {
    const value = dp.key.includes(".")
      ? dp.key.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), record)
      : record[dp.key];
    const ok = Array.isArray(value) ? value.length > 0 : (value && typeof value === "object" ? Object.keys(value).length > 0 : !!String(value || "").trim());
    (ok ? captured : missing).push(dp.key);
  });
  return {captured, missing, capturedCount: captured.length, missingCount: missing.length};
}

/** Shape used when approving a venue into clubLocations. */
function clubLocationPayloadFromDiscovery(edited = {}, extras = {}) {
  const socials = edited.socialMediaHandles || {};
  return {
    locationName: edited.proposedTitle || edited.proposedLocationName || edited.locationName || "",
    brandName: edited.brandName || edited.proposedLocationName || edited.proposedTitle || "",
    tagline: edited.tagline || "",
    description: edited.proposedDescription || edited.aiSummary || edited.description || "",
    type: extras.type || edited.type || "club",
    categories: uniqueList(edited.categories || []),
    genres: uniqueList(edited.genres || []),
    cuisine: edited.cuisine || "",
    country: edited.country || "",
    region: edited.stateRegion || edited.region || "",
    stateRegion: edited.stateRegion || edited.region || "",
    city: edited.city || "",
    postalCode: edited.postalCode || "",
    address: edited.proposedAddress || edited.address || "",
    streetAddress: edited.streetAddress || edited.addressLine1 || edited.proposedAddress || "",
    addressLine1: edited.streetAddress || edited.addressLine1 || edited.proposedAddress || "",
    fullAddress: edited.fullAddress || edited.proposedAddress || edited.address || "",
    officialWebsite: edited.officialWebsite || edited.website || "",
    website: edited.officialWebsite || edited.website || "",
    menuUrl: edited.menuUrl || "",
    reservationsUrl: edited.reservationsUrl || "",
    contactUrl: edited.contactUrl || "",
    email: edited.email || "",
    telephone: edited.telephone || edited.phone || "",
    phone: edited.telephone || edited.phone || "",
    socialMediaHandles: {
      instagram: socials.instagram || edited.instagramHandle || "",
      facebook: socials.facebook || "",
      x: socials.x || "",
      tiktok: socials.tiktok || "",
      floqrHandle: socials.floqrHandle || ""
    },
    amenities: uniqueList(edited.amenities || []),
    agePolicy: edited.agePolicy || "",
    dressCode: edited.dressCode || "",
    publicServices: uniqueList(edited.publicServices || ["ShoutOut", "Guest List"]),
    hours: edited.hours || hoursBlurbFromStructured(edited.hoursStructured) || "",
    hoursStructured: edited.hoursStructured || null,
    hoursExceptions: Array.isArray(edited.hoursExceptions) ? edited.hoursExceptions : [],
    timeZone: edited.timeZone || guessTimeZone(edited.country || ""),
    featuredDjs: Array.isArray(edited.featuredDjs) ? edited.featuredDjs : [],
    featuredStaff: Array.isArray(edited.featuredStaff) ? edited.featuredStaff : [],
    promotionGroups: Array.isArray(edited.promotionGroups) ? edited.promotionGroups : [],
    artists: uniqueList(edited.artistsOrDjs || edited.artists || edited.djs || []),
    artistsOrDjs: uniqueList(edited.artistsOrDjs || edited.artists || edited.djs || []),
    promoters: uniqueList(edited.promoters || []),
    promotionGroup: edited.promotionGroup || "",
    logoUrl: edited.logoUrl || "",
    extractedImages: Array.isArray(edited.extractedImages) ? edited.extractedImages.slice(0, 12) : [],
    displayScreenFormatIds: Array.isArray(edited.displayScreenFormatIds) && edited.displayScreenFormatIds.length
      ? edited.displayScreenFormatIds
      : ["led-96x48", "led-64x32"],
    primaryDisplayScreenFormatId: edited.primaryDisplayScreenFormatId || "led-96x48",
    publicProfilePublished: true,
    publicProfileSections: edited.publicProfileSections || {
      about: true, contact: true, upcomingEvents: true, pastEvents: true,
      featuredDjs: true, featuredStaff: true, promotionGroups: true, gallery: true
    },
    venueDatapointsCaptured: edited.venueDatapointsCaptured || summarizeCaptured(edited)
  };
}

module.exports = {
  DAY_KEYS,
  DAY_LABELS,
  VENUE_PUBLIC_PROFILE_DATAPOINTS,
  extractEmail,
  extractPhone,
  extractSocialHandles,
  extractAmenities,
  extractAgePolicy,
  extractDressCode,
  extractCuisine,
  extractHoursStructured,
  hoursBlurbFromStructured,
  hoursStructuredFromPlaces,
  guessTimeZone,
  enrichVenueRecord,
  summarizeCaptured,
  clubLocationPayloadFromDiscovery
};
