/* FLOQR AI backend functions.
   Deploy from Firebase Functions or Cloud Run Functions for scheduled crawling
   and public source extraction. The static GitHub Pages app can call HTTPS
   callable functions after Firebase Auth verifies the user. */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");

admin.initializeApp();

const db = admin.firestore();
const MAX_SOURCE_BYTES = 750000;
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const EMAIL_OTP_PEPPER = defineSecret("EMAIL_OTP_PEPPER");
const GOOGLE_PLACES_API_KEY = defineSecret("GOOGLE_PLACES_API_KEY");
const EMAIL_OTP_FROM = process.env.FLOQR_EMAIL_OTP_FROM || "login@floqr.com";
const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bands.don@gmail.com,bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
const GEMINI_IMAGE_EDIT_MODEL = process.env.FLOQR_GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const GEMINI_TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const MAX_GEMINI_IMAGE_BYTES = 8 * 1024 * 1024;

const MONTHS = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12"
};

const DEFAULT_ALLOWED_CATEGORIES = [
  "nightclub",
  "beachClub",
  "lounge",
  "rooftopLounge",
  "rooftopBar",
  "brunchParty",
  "poolParty",
  "summerParty",
  "event",
  "djEvent",
  "promoterEvent",
  "comedyShow",
  "ticketResaleEvent",
  "latinMusic",
  "arabicMusic"
];

const DEFAULT_DISCOVERY_MARKETS = [
  {country:"Portugal", languages:["Portuguese"], cities:["Lisbon", "Porto"]},
  {country:"Spain", languages:["Spanish", "Catalan"], cities:["Barcelona", "Madrid", "Ibiza", "Marbella"]},
  {country:"France", languages:["French"], cities:["Paris", "Nice", "Cannes", "Saint-Tropez"]},
  {country:"Belgium", languages:["French", "Dutch"], cities:["Brussels", "Antwerp"]},
  {country:"Netherlands", languages:["Dutch", "English"], cities:["Amsterdam", "Rotterdam"]},
  {country:"Luxembourg", languages:["French", "German"], cities:["Luxembourg City"]},
  {country:"Germany", languages:["German"], cities:["Berlin", "Hamburg", "Munich", "Cologne"]},
  {country:"Switzerland", languages:["German", "French", "Italian"], cities:["Zurich", "Geneva", "Basel"]},
  {country:"Austria", languages:["German"], cities:["Vienna", "Salzburg"]},
  {country:"Italy", languages:["Italian"], cities:["Milan", "Rome", "Florence", "Venice"]},
  {country:"Ireland", languages:["English", "Irish"], cities:["Dublin", "Cork"]},
  {country:"United Kingdom", languages:["English"], cities:["London", "Manchester", "Birmingham"]},
  {country:"Denmark", languages:["Danish"], cities:["Copenhagen"]},
  {country:"Norway", languages:["Norwegian"], cities:["Oslo", "Bergen"]},
  {country:"Sweden", languages:["Swedish"], cities:["Stockholm", "Gothenburg"]},
  {country:"Finland", languages:["Finnish", "Swedish"], cities:["Helsinki"]},
  {country:"Iceland", languages:["Icelandic", "English"], cities:["Reykjavik"]},
  {country:"United Arab Emirates", languages:["Arabic", "English"], cities:["Dubai"]},
  {country:"Turkey", languages:["Turkish"], cities:["Istanbul"]},
  {country:"Singapore", languages:["English", "Mandarin", "Malay", "Tamil"], cities:["Singapore"]},
  {country:"Thailand", languages:["Thai", "English"], cities:["Bangkok", "Phuket"]},
  {country:"China", languages:["Chinese", "English"], cities:["Shanghai"]}
];

function normalized(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stripTags(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(sourceUrl = "") {
  let url;
  try {
    url = new URL(sourceUrl);
  } catch (error) {
    throw new functions.https.HttpsError("invalid-argument", "A valid public source URL is required.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new functions.https.HttpsError("invalid-argument", "Only http/https public source URLs are allowed.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === "::1"
  ) {
    throw new functions.https.HttpsError("invalid-argument", "Private or local URLs are not allowed.");
  }
  return url;
}

function sourceNameForUrl(sourceUrl = "") {
  const host = safeUrl(sourceUrl).hostname.replace(/^www\./, "");
  if (/eventbrite/i.test(host)) return "Eventbrite";
  if (/ticketmaster/i.test(host)) return "Ticketmaster";
  if (/google/i.test(host)) return "Google public search";
  return host || "Public source";
}

function isSearchResultsUrl(sourceUrl = "") {
  const url = safeUrl(sourceUrl);
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.toLowerCase();
  if (/google\./.test(host) && path.includes("/search")) return true;
  if (/ticketmaster\./.test(host) && path.includes("/search")) return true;
  if (/eventbrite\./.test(host) && /^\/d\//.test(path) && /\/events\/?$/.test(path)) return true;
  return false;
}

function searchQueryFromSourceUrl(sourceUrl = "") {
  const url = safeUrl(sourceUrl);
  const q = url.searchParams.get("q") || url.searchParams.get("keyword") || "";
  if (q) return q.replace(/\+/g, " ").trim();
  const pathParts = url.pathname.split("/").filter(Boolean);
  const dIndex = pathParts.indexOf("d");
  if (dIndex >= 0) return decodeURIComponent(pathParts.slice(dIndex + 1).join(" ")).replace(/[-_]+/g, " ").trim();
  return "";
}

function searchResultsRecord(sourceUrl = "", sourceText = "") {
  const query = searchQueryFromSourceUrl(sourceUrl) || "public event search";
  const sourceName = sourceNameForUrl(sourceUrl);
  const cityCountry = cityCountryFromText(sourceUrl, `${query} ${sourceText || ""}`, {});
  return {
    proposedType:"sourceSearchResults",
    proposedTitle:`${sourceName} search results: ${query}`,
    proposedDescription:"This is a search-results page, not a final event or venue detail page. Open one specific result or use official API detail data before saving an approvable review record.",
    proposedDate:"",
    proposedTime:"",
    proposedLocationName:"",
    proposedAddress:"",
    city:cityCountry.city,
    stateRegion:cityCountry.stateRegion,
    country:cityCountry.country,
    officialWebsite:"",
    website:"",
    email:"",
    telephone:"",
    phone:"",
    ticketUrl:"",
    sourceUrl,
    sourceName,
    extractedImages:[],
    extractedTags:["search-results-page", "follow-up-needed"],
    categories:["search-results-page", "follow-up-needed"],
    genres:[],
    searchQuery:query,
    aiSummary:"Search-results page detected. FLOQR will not approve this as a live listing until a final event/venue detail source is provided.",
    aiConfidenceScore:0.4,
    aiStarRating:2,
    aiRatingReasons:[
      "Broad search-results page detected",
      "Final event/venue URL is required for address/date/time extraction",
      "Open one specific result or use Ticketmaster/Eventbrite API detail data"
    ],
    duplicateCandidateIds:[],
    status:"pendingReview",
    discoveryMode:"source-results-follow-up",
    extractionMethod:"search-results-page-guard",
    sourcePageType:"searchResultsPage",
    notApprovable:true,
    missingDatapoints:["Final event/detail URL", "Name", "Address", "Date", "Time"],
    crawlResultStatus:"needs-final-event-source"
  };
}

function titleCase(value = "") {
  return String(value || "").toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase()).replace(/\bDj\b/g, "DJ").replace(/\bEdm\b/g, "EDM");
}

function titleFromUrl(sourceUrl = "") {
  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const segment = parts.includes("e") ? parts[parts.indexOf("e") + 1] : parts[parts.length - 1] || "";
    const clean = decodeURIComponent(segment)
      .replace(/-tickets-\d+.*$/i, "")
      .replace(/-\d{8,}.*$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return clean ? titleCase(clean) : "";
  } catch (error) {
    return "";
  }
}

function extractJsonLd(html = "") {
  const blocks = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      list.forEach(item => {
        if (Array.isArray(item["@graph"])) blocks.push(...item["@graph"]);
        blocks.push(item);
      });
    } catch (error) {
      // Ignore malformed JSON-LD blocks from third-party pages.
    }
  }
  return blocks;
}

function jsonLdEvent(jsonLd = []) {
  return jsonLd.find(item => {
    const type = Array.isArray(item["@type"]) ? item["@type"].join(" ") : item["@type"] || "";
    return /event/i.test(type);
  }) || null;
}

function metaContent(html = "", property = "") {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i");
  return (html.match(regex) || html.match(reverse) || [])[1] || "";
}

function extractDate(text = "") {
  const dayMonth = String(text || "").match(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/i);
  if (dayMonth) return `${dayMonth[3]}-${MONTHS[normalized(dayMonth[2])] || "01"}-${String(dayMonth[1]).padStart(2, "0")}`;
  const iso = String(text || "").match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  return iso ? iso[0] : "";
}

function extractTime(text = "") {
  const match = String(text || "").match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(AM|PM)\b/i);
  return match ? `${match[1]}:${match[2]} ${match[3].toUpperCase()}` : "";
}

function extractAddress(text = "") {
  const clean = String(text || "").replace(/\s+/g, " ");
  const singapore = clean.match(/\b(\d{1,5}\s+[A-Z0-9][A-Z0-9 .'-]+?(?:ROAD|RD|STREET|ST|AVENUE|AVE|LANE|LN|DRIVE|DR|BOULEVARD|BLVD|CRESCENT|CRES|WAY|PLACE|PLAZA|QUAY|WALK|CLOSE)\s*(?:SINGAPORE)?\s*\d{6})\b/i);
  if (singapore) return singapore[1].replace(/\s+/g, " ").trim();
  const general = clean.match(/\b(\d{1,6}\s+[A-Z0-9][A-Z0-9 .'-]+?(?:ROAD|RD|STREET|ST|AVENUE|AVE|LANE|LN|DRIVE|DR|BOULEVARD|BLVD|CRESCENT|CRES|WAY|PLACE|PLAZA|QUAY|WALK|CLOSE))\b/i);
  return general ? general[1].replace(/\s+/g, " ").trim() : "";
}

function extractPhone(text = "") {
  const matches = String(text || "").match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g) || [];
  return (matches.find(item => {
    const digits = item.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 && !/^\d{6}$/.test(digits);
  }) || "").trim();
}

function addressFromJsonLd(location = {}) {
  const address = location.address || {};
  if (typeof address === "string") return address;
  return [
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode,
    address.addressCountry
  ].filter(Boolean).join(", ");
}

function marketFromText(value = "") {
  const source = ` ${normalized(value)} `;
  for (const market of DEFAULT_DISCOVERY_MARKETS) {
    for (const city of market.cities || []) {
      const key = ` ${normalized(city)} `;
      if (key.trim() && source.includes(key)) {
        return {
          city,
          country:market.country,
          stateRegion: city === market.country ? market.country : city,
          language:(market.languages || []).join(", ")
        };
      }
    }
  }
  return null;
}

function cityCountryFromText(sourceUrl = "", text = "", location = {}) {
  const address = location.address || {};
  const locationCity = address.addressLocality || "";
  const locationCountry = address.addressCountry || "";
  if (locationCity || locationCountry) {
    const fallbackMarket = marketFromText(`${locationCity} ${locationCountry}`) || {};
    return {
      city: locationCity || fallbackMarket.city || "",
      country: locationCountry || fallbackMarket.country || "",
      stateRegion: address.addressRegion || fallbackMarket.stateRegion || ""
    };
  }
  const market = marketFromText(`${sourceUrl} ${text} ${JSON.stringify(location)}`);
  if (market) return market;
  return {
    city:"",
    country:"",
    stateRegion:""
  };
}

function missingDatapoints(record = {}) {
  const missing = [];
  if (!record.proposedTitle && !record.proposedLocationName) missing.push("Name");
  if (!(record.genres || []).length) missing.push("Genre");
  const artists = record.artistsOrDjs || record.artists || record.djs;
  if (!(Array.isArray(artists) ? artists.length : String(artists || "").trim())) missing.push("DJ(s)/Artist(s)");
  const promoters = record.promoters || record.promotionGroup;
  if (!(Array.isArray(promoters) ? promoters.length : String(promoters || "").trim())) missing.push("Promoter(s)");
  if (!record.proposedAddress) missing.push("Address");
  if (!record.city) missing.push("City");
  if (!record.country) missing.push("Country");
  if (!(record.telephone || record.phone)) missing.push("Phone");
  if (!record.email) missing.push("Email");
  if (!(record.socialMediaHandles?.instagram || record.instagramHandle)) missing.push("Instagram");
  if (/comedy/i.test(record.proposedType || "")) {
    if (!record.proposedDate) missing.push("Date");
    if (!record.proposedTime) missing.push("Time");
  }
  return missing;
}

async function fetchPublicSource(sourceUrl) {
  const url = safeUrl(sourceUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url.href, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "FLOQR public discovery bot/1.0 (+https://floqr.com)",
        "accept": "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const text = await response.text();
    return text.slice(0, MAX_SOURCE_BYTES);
  } finally {
    clearTimeout(timer);
  }
}

function extractDiscoveryRecordFromHtml(sourceUrl = "", html = "", fallbackText = "") {
  if (isSearchResultsUrl(sourceUrl)) return searchResultsRecord(sourceUrl, fallbackText);
  const jsonLd = extractJsonLd(html);
  const event = jsonLdEvent(jsonLd);
  const visibleText = `${stripTags(html)} ${fallbackText || ""}`;
  const location = event?.location || {};
  const cityCountry = cityCountryFromText(sourceUrl, visibleText, location);
  const title = event?.name || metaContent(html, "og:title") || titleFromUrl(sourceUrl) || "Public source discovery";
  const description = event?.description || metaContent(html, "og:description") || title;
  const address = addressFromJsonLd(location) || extractAddress(visibleText);
  const phone = location.telephone || event?.organizer?.telephone || extractPhone(visibleText);
  const dateText = event?.startDate || visibleText;
  const proposedType = /comedy|stand.?up/i.test(`${title} ${description} ${visibleText}`) ? "comedyShow" : "event";
  const record = {
    proposedType,
    proposedTitle:title,
    proposedDescription:String(description || title).slice(0, 700),
    proposedDate:extractDate(dateText),
    proposedTime:extractTime(dateText) || extractTime(visibleText),
    proposedLocationName:location.name || title,
    proposedAddress:address,
    city:cityCountry.city,
    stateRegion:cityCountry.stateRegion,
    country:cityCountry.country,
    officialWebsite:sourceUrl,
    website:sourceUrl,
    email:"",
    telephone:phone,
    phone,
    socialMediaHandles:{instagram:"", x:"", tiktok:"", facebook:""},
    ticketUrl:event?.offers?.url || sourceUrl,
    sourceUrl,
    sourceName:sourceNameForUrl(sourceUrl),
    extractedImages:[...(Array.isArray(event?.image) ? event.image : event?.image ? [event.image] : [])],
    extractedTags:[proposedType, "public-source-extracted", "ticketing"],
    categories:[proposedType === "comedyShow" ? "comedy show" : "event", "public-source-extracted", "ticketing"],
    genres:proposedType === "comedyShow" ? ["Comedy", "Live Entertainment"] : ["Live Entertainment"],
    searchQuery:title,
    aiSummary:"Extracted from public source page metadata/JSON-LD. Master Admin must verify before approval.",
    aiConfidenceScore:event ? 0.9 : 0.76,
    aiStarRating:event ? 4 : 3,
    aiRatingReasons:[
      event ? "JSON-LD event metadata found" : "Parsed public page metadata/text",
      "Source URL retained for review",
      "Approval remains gated by required datapoints"
    ],
    duplicateCandidateIds:[],
    status:"pendingReview",
    discoveryMode:"source-detail-extraction",
    extractionMethod:event ? "server-json-ld" : "server-html-text"
  };
  record.missingDatapoints = missingDatapoints(record);
  record.crawlResultStatus = record.missingDatapoints.length ? "missing-required-datapoints" : "ready-for-approval";
  return record;
}

async function crawlPublicEventSources(criteria = {}) {
  const sources = await db.collection("aiDiscoverySources").where("enabled", "==", true).get();
  const discovered = [];
  for (const doc of sources.docs) {
    const source = {id:doc.id, ...doc.data()};
    const sourceUrl = String(source.sourceUrl || "");
    if (!/^https?:\/\//i.test(sourceUrl)) continue;
    if (/developer\.ticketmaster|eventbrite\.com\/platform|manual-source-list|partner-config-required/i.test(sourceUrl)) continue;
    if (isSearchResultsUrl(sourceUrl)) continue;
    try {
      const html = await fetchPublicSource(sourceUrl);
      discovered.push({
        ...extractDiscoveryRecordFromHtml(sourceUrl, html, ""),
        sourceName:source.sourceName || sourceNameForUrl(sourceUrl),
        sourceConfigId:source.id,
        allowedCategories:source.allowedCategories || DEFAULT_ALLOWED_CATEGORIES,
        markets:source.markets || DEFAULT_DISCOVERY_MARKETS,
        crawlCriteria:criteria
      });
    } catch (error) {
      console.warn(`Skipping source ${sourceUrl}:`, error.message);
    }
  }
  const places = await discoverPlacesForCriteria(criteria);
  const seen = new Set();
  return [...discovered, ...places].filter(record => {
    const key = normalized(`${record.proposedTitle}|${record.proposedAddress}|${record.telephone}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function optionalPlacesKey() {
  try { return GOOGLE_PLACES_API_KEY.value() || process.env.GOOGLE_PLACES_API_KEY || ""; }
  catch (error) { return process.env.GOOGLE_PLACES_API_KEY || ""; }
}

function languageCode(value = "") {
  const map = {english:"en", spanish:"es", german:"de", french:"fr", italian:"it", portuguese:"pt", dutch:"nl", arabic:"ar", turkish:"tr", chinese:"zh", thai:"th", catalan:"ca"};
  return map[normalized(value)] || "en";
}

async function searchGooglePlaces(job, apiKey) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-goog-api-key":apiKey,
      "x-goog-fieldmask":"places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryType,places.types"
    },
    body:JSON.stringify({textQuery:String(job.query || "").slice(0, 500), languageCode:languageCode(job.language), maxResultCount:20})
  });
  if (!response.ok) throw new Error(`Google Places search returned HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.places || []).map(place => {
    const baseRecord = {
      proposedType:/concert|event/i.test(job.eventType || "") ? "event" : "club",
      proposedTitle:place.displayName?.text || "Discovered nightlife venue",
      proposedDescription:`Discovered through a localized ${job.language || "native-language"} Google Places query for ${job.genre || "nightlife"} in ${job.city || job.country || "the target market"}.`,
      proposedLocationName:place.displayName?.text || "",
      proposedAddress:place.formattedAddress || "",
      city:job.city || "",
      stateRegion:job.stateRegion || "",
      country:job.country || "",
      telephone:place.internationalPhoneNumber || place.nationalPhoneNumber || "",
      phone:place.internationalPhoneNumber || place.nationalPhoneNumber || "",
      officialWebsite:place.websiteUri || place.googleMapsUri || "",
      website:place.websiteUri || place.googleMapsUri || "",
      sourceUrl:place.googleMapsUri || place.websiteUri || "",
      sourceName:"Google Places API",
      email:"",
      artistsOrDjs:[],
      promoters:[],
      promotionGroup:"",
      socialMediaHandles:{instagram:"", x:"", tiktok:"", facebook:""},
      sourceConfirmations:{googlePlaces:true, ticketmaster:"later", publicPage:false, eventbrite:false},
      categories:[job.eventType || place.primaryType || "nightclub", ...(place.types || []).slice(0, 8)],
      genres:job.genre ? [job.genre] : [],
      searchQuery:job.query || "",
      searchLanguage:job.language || "",
      aiSummary:"Localized venue discovery candidate. Complete DJ/artist, promoter, email, and Instagram before approval.",
      aiConfidenceScore:0.86,
      aiStarRating:4,
      aiRatingReasons:["Google Places structured record", "Localized market-language query", "Master Admin review required"],
      status:"pendingReview",
      discoveryMode:"master-admin-refined-discovery-crawl",
      extractionMethod:"google-places-text-search"
    };
    baseRecord.missingDatapoints = missingDatapoints(baseRecord);
    baseRecord.crawlResultStatus = baseRecord.missingDatapoints.length ? "missing-required-datapoints" : "ready-for-approval";
    return baseRecord;
  });
}

async function discoverPlacesForCriteria(criteria = {}) {
  const apiKey = optionalPlacesKey();
  const jobs = Array.isArray(criteria.structuredPlan?.jobs) ? criteria.structuredPlan.jobs.slice(0, 25) : [];
  if (!apiKey || !jobs.length) return [];
  const records = [];
  for (const job of jobs) {
    try { records.push(...await searchGooglePlaces(job, apiKey)); }
    catch (error) { console.warn(`Places job skipped (${job.query || "query"}):`, error.message); }
  }
  return records;
}

function emailOtpSecret() {
  const value = EMAIL_OTP_PEPPER.value() || process.env.EMAIL_OTP_PEPPER || "";
  if (!value) throw new HttpsError("failed-precondition", "Email OTP is not configured. Set EMAIL_OTP_PEPPER and SENDGRID_API_KEY.");
  return value;
}

function normalizeEmail(value = "") {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  return email;
}

function otpHash(email, code) {
  return crypto.createHmac("sha256", emailOtpSecret()).update(`${email}:${String(code).toUpperCase()}`).digest("hex");
}

function createOtpCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(8), byte => alphabet[byte % alphabet.length]).join("");
}

async function sendEmailOtp(email, code) {
  const key = SENDGRID_API_KEY.value() || process.env.SENDGRID_API_KEY || "";
  if (!key) throw new HttpsError("failed-precondition", "Email delivery is not configured. Set the SENDGRID_API_KEY secret.");
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method:"POST",
    headers:{authorization:`Bearer ${key}`, "content-type":"application/json"},
    body:JSON.stringify({
      personalizations:[{to:[{email}]}],
      from:{email:EMAIL_OTP_FROM, name:"FLOQR"},
      subject:"Your FLOQR sign-in code",
      content:[{type:"text/plain", value:`Your FLOQR sign-in code is ${code}. It expires in 5 minutes. If you did not request this code, ignore this email.`}]
    })
  });
  if (!response.ok) throw new HttpsError("internal", `Email provider returned HTTP ${response.status}.`);
}

async function assertMasterAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Master Admin sign-in is required.");
  const email = String(request.auth.token?.email || "").toLowerCase();
  if (MASTER_ADMIN_EMAILS.includes(email) || request.auth.token?.masterAdmin === true) return;
  const record = await db.collection("users").doc(request.auth.uid).get();
  const data = record.exists ? record.data() || {} : {};
  if (data.masterAdmin === true || (data.roles || []).includes("masterAdmin")) return;
  throw new HttpsError("permission-denied", "Master Admin access is required.");
}

function scheduleLocalParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:timeZone || "UTC", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23"
  }).formatToParts(date).reduce((out, part) => ({...out, [part.type]:part.value}), {});
  return {date:`${parts.year}-${parts.month}-${parts.day}`, time:`${parts.hour}:${parts.minute}`};
}

function scheduleIsDue(schedule = {}, now = new Date()) {
  const local = scheduleLocalParts(now, schedule.timeZone || "UTC");
  const hours = Array.isArray(schedule.scheduleHours) && schedule.scheduleHours.length
    ? schedule.scheduleHours
    : [schedule.primaryTime || "02:00"];
  const due = hours.some(value => {
    const target = String(value || "").slice(0, 5);
    const [h, m] = target.split(":").map(Number);
    const [nh, nm] = local.time.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) && Math.abs((nh * 60 + nm) - (h * 60 + m)) < 15;
  });
  return {due, local, slot:`${local.date}_${hours.find(value => {
    const [h, m] = String(value).split(":").map(Number);
    const [nh, nm] = local.time.split(":").map(Number);
    return Math.abs((nh * 60 + nm) - (h * 60 + m)) < 15;
  }) || local.time}`};
}

async function runScheduledCrawl(scheduleDoc, now = new Date()) {
  const schedule = {id:scheduleDoc.id, ...scheduleDoc.data()};
  if (schedule.enabled === false) return null;
  const timing = scheduleIsDue(schedule, now);
  if (!timing.due) return null;
  const claimId = `${schedule.id}_${timing.slot}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const claim = db.collection("aiCrawlRuns").doc(claimId);
  try {
    await claim.create({scheduleId:schedule.id, status:"running", localSlot:timing.slot, timeZone:schedule.timeZone || "UTC", startedAt:admin.firestore.FieldValue.serverTimestamp()});
  } catch (error) {
    return null;
  }
  try {
    const records = await crawlPublicEventSources(schedule.criteria || schedule);
    for (const record of records) await writeDiscoveryQueueItem(await classifyDiscoveryRecord(record));
    await claim.set({status:"completed", resultCount:records.length, completedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
    return records.length;
  } catch (error) {
    await claim.set({status:"failed", error:String(error.message || error).slice(0, 1000), completedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
    throw error;
  }
}

async function classifyDiscoveryRecord(record) {
  const classified = {
    ...record,
    aiSummary:record.aiSummary || record.proposedDescription || "",
    aiConfidenceScore:record.aiConfidenceScore || 0.76,
    aiStarRating:record.aiStarRating || 3,
    aiRatingReasons:record.aiRatingReasons || ["Extracted from configured public source URL"],
    updatedAt:admin.firestore.FieldValue.serverTimestamp()
  };
  classified.missingDatapoints = missingDatapoints(classified);
  classified.crawlResultStatus = classified.missingDatapoints.length ? "missing-required-datapoints" : "ready-for-approval";
  return classified;
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

function optionalGeminiSecretValue() {
  try {
    return GEMINI_API_KEY.value() || process.env.GEMINI_API_KEY || "";
  } catch (error) {
    return process.env.GEMINI_API_KEY || "";
  }
}

function geminiSecretValue() {
  const value = optionalGeminiSecretValue();
  if (!value) {
    throw new HttpsError(
      "failed-precondition",
      "Gemini media editing is not configured. Set the GEMINI_API_KEY Firebase Functions secret and redeploy aiEnhanceShoutOutMedia."
    );
  }
  return value;
}

function clampText(value = "", max = 80) {
  return String(value || "")
    .replace(/[^\p{L}\p{N} @!?.'&:-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function preserveProtectedTerms(value = "") {
  let out = String(value || "");
  ["FLOQR", "ShoutOut", "Mingl", "BartR"].forEach(term => {
    out = out.replace(new RegExp(term, "ig"), term);
  });
  return out;
}

function shoutOutDisplayCaps(data = {}) {
  const raw = data.displayCaps && typeof data.displayCaps === "object" ? data.displayCaps : {};
  const mainLimit = Math.max(1, Math.min(Number(data.mainLimit || raw.main || raw.maxMainCharacters || 36), 90));
  const subLimit = Math.max(0, Math.min(Number(data.subLimit ?? raw.sub ?? raw.maxSubCharacters ?? 60), 90));
  const lineCount = Math.max(1, Math.min(Number(raw.lineCount || 1), 4));
  const perLine = Math.max(1, Math.min(Number(raw.perLine || raw.maxCharactersPerLine || mainLimit), 30));
  return {mainLimit, subLimit, lineCount, perLine};
}

function fitShoutOutDisplayText(value = "", data = {}, type = "main") {
  const caps = shoutOutDisplayCaps(data);
  const limit = type === "sub" ? caps.subLimit : caps.mainLimit;
  const cleaned = preserveProtectedTerms(clampText(value, limit + caps.lineCount - 1));
  if (type === "sub" || caps.lineCount <= 1) return cleaned.slice(0, limit);
  const rows = [];
  let row = "";
  cleaned.split(/\s+/).filter(Boolean).forEach(word => {
    const chunks = [];
    for (let i = 0; i < word.length; i += caps.perLine) chunks.push(word.slice(i, i + caps.perLine));
    chunks.forEach(chunk => {
      const next = row ? `${row} ${chunk}` : chunk;
      if (next.length <= caps.perLine) row = next;
      else if (rows.length < caps.lineCount) { rows.push(row); row = chunk; }
    });
  });
  if (row && rows.length < caps.lineCount) rows.push(row);
  return rows.slice(0, caps.lineCount).join("\n");
}

function fallbackShoutOutSuggestion(data = {}) {
  const tone = normalized(data.tone || "party");
  const profile = data.profileSignals && typeof data.profileSignals === "object" ? data.profileSignals : {};
  const interests = Array.isArray(profile.interests) ? profile.interests.slice(0, 3).join(", ") : "";
  const past = Array.isArray(data.pastShoutouts) ? data.pastShoutouts.find(item => item && (item.mainText || item.subText)) : null;
  const options = [
    {tone:"vip", mainText:"VIP ShoutOut IN THE BUILDING", subText:"Luxury energy all night."},
    {tone:"funny", mainText:"BIG ShoutOut TO THE TABLE", subText:"They came to celebrate."},
    {tone:"romantic", mainText:"LOVE IS IN THE ROOM", subText:"A perfect night for two."},
    {tone:"birthday", mainText:"HAPPY BIRTHDAY", subText:"Your ShoutOut moment is live."},
    {tone:"classy", mainText:"TONIGHT IS YOUR NIGHT", subText:"Elegant, bright, unforgettable."},
    {tone:"party", mainText:"THE PARTY STARTS HERE", subText:"Big ShoutOut energy."},
    {tone:"corporate", mainText:"WELCOME TO THE CELEBRATION", subText:"A polished ShoutOut moment."},
    {tone:"graduation", mainText:"CONGRATS GRAD", subText:"The future starts tonight."}
  ];
  const picked = options.find(item => tone.includes(item.tone)) || options[5];
  const contextSub = interests ? `${interests} energy.` : past?.subText || picked.subText;
  return {
    mainText:fitShoutOutDisplayText(data.mainText || past?.mainText || picked.mainText, data, "main"),
    subText:fitShoutOutDisplayText(data.subText || contextSub, data, "sub"),
    tone:picked.tone,
    provider:"curated-fallback",
    providerMode:"curated-fallback",
    safetyStatus:"passed"
  };
}

function fallbackGrammarSuggestion(data = {}) {
  const text = preserveProtectedTerms(String(data.text || "").slice(0, 1200));
  const fixes = [
    {from:/\bgut\b/gi, to:"good", type:"spelling"},
    {from:/\bteh\b/gi, to:"the", type:"spelling"},
    {from:/\byuo\b/gi, to:"you", type:"spelling"},
    {from:/\bi\b/g, to:"I", type:"grammar"}
  ];
  let corrected = text;
  const detectedIssues = [];
  fixes.forEach(rule => {
    const matches = corrected.match(rule.from) || [];
    matches.forEach(match => detectedIssues.push({
      original:match,
      suggestion:rule.to,
      type:rule.type,
      confidence:0.82
    }));
    corrected = corrected.replace(rule.from, rule.to);
  });
  if (/\s{2,}/.test(corrected)) {
    detectedIssues.push({original:"extra spaces", suggestion:"single spaces", type:"grammar", confidence:0.74});
    corrected = corrected.replace(/\s{2,}/g, " ");
  }
  corrected = preserveProtectedTerms(corrected.trim());
  return {
    correctedText:corrected || text,
    detectedIssues,
    explanation:detectedIssues.length ? "Local fallback corrected likely typo or spacing issues." : "No obvious correction found.",
    confidence:detectedIssues.length ? 0.78 : 0.5,
    provider:"local-fallback"
  };
}

function extractJsonObject(text = "") {
  const clean = String(text || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(clean); } catch (error) {}
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (error) { return null; }
}

async function callGeminiJson(prompt, schemaHint = "") {
  const apiKey = optionalGeminiSecretValue();
  if (!apiKey) return null;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_TEXT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      contents:[{role:"user", parts:[{text:prompt}]}],
      generationConfig:{
        responseMimeType:"application/json",
        temperature:0.35
      }
    })
  });
  const bodyText = await response.text();
  let payload = {};
  try { payload = bodyText ? JSON.parse(bodyText) : {}; } catch (error) {}
  if (!response.ok) {
    const message = payload?.error?.message || bodyText || `Gemini returned HTTP ${response.status}`;
    throw new HttpsError("failed-precondition", `${schemaHint || "Gemini JSON"} failed: ${message}`);
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n") || "";
  return extractJsonObject(text);
}

function locationRankFallback(locations = [], userContext = {}) {
  const hay = value => normalized(Array.isArray(value) ? value.join(" ") : value);
  const city = normalized(userContext.city);
  const country = normalized(userContext.country);
  const prefs = hay([userContext.preferredGenres, userContext.preferredVenueTypes, userContext.preferredCities, userContext.interests]);
  return [...locations].map((item, index) => {
    const data = item.data || item;
    const text = hay([data.locationName, data.brandName, data.city, data.country, data.genres, data.categories, data.type, data.description]);
    let score = Math.max(0, 1000 - index) / 1000;
    if (city && normalized(data.city) === city) score += 80;
    if (country && normalized(data.country) === country) score += 20;
    prefs.split(/\s+/).filter(Boolean).forEach(token => {
      if (token.length > 2 && text.includes(token)) score += 4;
    });
    return {id:String(item.id || data.id || ""), score};
  }).sort((a, b) => b.score - a.score).map(item => item.id).filter(Boolean);
}

function assertOwnedOriginalShoutOutMediaPath(path = "", uid = "") {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  if (!uid || !cleanPath.startsWith(`shoutouts/${uid}/`) || !cleanPath.includes("/original/")) {
    throw new HttpsError("permission-denied", "Gemini media editing can only process the signed-in user's original ShoutOut media.");
  }
  if (cleanPath.includes("..") || cleanPath.includes("//")) {
    throw new HttpsError("invalid-argument", "Invalid media storage path.");
  }
  return cleanPath;
}

function safeEnhancementPrompt(prompt = "", enhancementType = "") {
  const type = String(enhancementType || "").trim();
  if (type === "football-portrait-motion") {
    return [
      "Prepare this portrait for subtle cinematic motion on a public LED stadium display.",
      "Preserve the person's recognizable face and natural identity exactly.",
      "Do not apply color filters, stylized looks, uniforms, logos, text, watermarks, or football branding.",
      "Prefer a clean, high-contrast framing suitable for gentle Ken Burns zoom/parallax playback.",
      "Return a single still image only.",
      `User requested enhancement: ${String(prompt || type).slice(0, 400)}`
    ].join("\n");
  }
  const requested = String(prompt || enhancementType || "Improve this ShoutOut media for a nightlife LED display.").slice(0, 600);
  return [
    "Edit only the uploaded ShoutOut media image. Do not add text, logos, watermarks, QR codes, or HTML/CSS/JavaScript.",
    "Keep the result suitable for a public nightlife LED display. Avoid explicit, hateful, violent, illegal, or privacy-invasive content.",
    "Preserve the protected terms FLOQR, ShoutOut, Mingl, and BartR exactly if they appear. Do not translate or alter those terms.",
    "Return a polished image edit. Do not change any FLOQR template layout, text placement, media placeholder, animation, or approval format.",
    `User requested enhancement: ${requested}`
  ].join("\n");
}

function contentTypeToExtension(contentType = "") {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}

async function downloadOwnedImage(path, uid) {
  const mediaStoragePath = assertOwnedOriginalShoutOutMediaPath(path, uid);
  const bucket = admin.storage().bucket();
  const file = bucket.file(mediaStoragePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Original ShoutOut media was not found in Firebase Storage.");
  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType || "";
  const size = Number(metadata.size || 0);
  if (!contentType.startsWith("image/")) {
    throw new HttpsError("invalid-argument", "Gemini media editing currently supports image uploads. Video uploads still use FLOQR's first-7-second trim path.");
  }
  if (size > MAX_GEMINI_IMAGE_BYTES) {
    throw new HttpsError("invalid-argument", "Image is larger than FLOQR's 8 MB Gemini editing limit.");
  }
  const [buffer] = await file.download();
  return {bucket, buffer, contentType, mediaStoragePath};
}

async function callGeminiImageEdit({buffer, contentType, prompt}) {
  const apiKey = geminiSecretValue();
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
  const response = await fetch(endpoint, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-goog-api-key":apiKey
    },
    body:JSON.stringify({
      model:GEMINI_IMAGE_EDIT_MODEL,
      input:[
        {type:"text", text:prompt},
        {type:"image", mime_type:contentType, data:buffer.toString("base64")}
      ]
    })
  });
  const bodyText = await response.text();
  let payload = {};
  try { payload = bodyText ? JSON.parse(bodyText) : {}; } catch (error) {}
  if (!response.ok) {
    const message = payload?.error?.message || bodyText || `Gemini returned HTTP ${response.status}`;
    throw new HttpsError("failed-precondition", `Gemini image edit failed: ${message}`);
  }
  const candidateParts = payload?.candidates?.flatMap(candidate => candidate?.content?.parts || []) || [];
  const outputParts = Array.isArray(payload?.output) ? payload.output : [];
  const parts = [...candidateParts, ...outputParts];
  const imagePart = parts.find(part => part.inlineData?.data || part.inline_data?.data || part.output_image?.data || part.outputImage?.data)
    || payload?.output_image
    || payload?.outputImage;
  if (!imagePart) {
    const text = parts.map(part => part.text || part.output_text || part.outputText).filter(Boolean).join(" ").slice(0, 500);
    throw new HttpsError("failed-precondition", text || "Gemini did not return an edited image.");
  }
  const inlineData = imagePart.inlineData || imagePart.inline_data || imagePart.output_image || imagePart.outputImage || imagePart;
  return {
    data:Buffer.from(inlineData.data, "base64"),
    contentType:inlineData.mimeType || inlineData.mime_type || "image/png",
    textNotes:parts.map(part => part.text || part.output_text || part.outputText).filter(Boolean).join(" ").slice(0, 800)
  };
}

function enhancedPathForOriginal(mediaStoragePath = "", referenceNumber = "", contentType = "image/png") {
  const parts = String(mediaStoragePath).split("/");
  const uid = parts[1] || "unknown";
  const reference = String(referenceNumber || parts[2] || Date.now()).replace(/[^a-zA-Z0-9._-]/g, "_");
  const originalName = (parts[parts.length - 1] || "shoutout-media").replace(/\.[a-z0-9]+$/i, "");
  const safeBase = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "shoutout-media";
  return `shoutouts/${uid}/${reference}/enhanced/gemini-${Date.now()}-${safeBase}.${contentTypeToExtension(contentType)}`;
}

async function uploadEnhancedGeminiImage({bucket, outputPath, buffer, contentType}) {
  const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await bucket.file(outputPath).save(buffer, {
    resumable:false,
    contentType,
    metadata:{
      metadata:{
        firebaseStorageDownloadTokens:token,
        floqrGeneratedBy:"gemini-media-editing"
      }
    }
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(outputPath)}?alt=media&token=${encodeURIComponent(token)}`;
}

exports.scheduledAiDiscoveryCrawl = onSchedule({schedule:"every 15 minutes", timeZone:"UTC", region:"us-central1", secrets:[GOOGLE_PLACES_API_KEY]}, async () => {
  const schedules = await db.collection("aiCrawlerSchedules").where("enabled", "==", true).get();
  for (const schedule of schedules.docs) await runScheduledCrawl(schedule);
  return null;
});

exports.runFloqrDiscoveryCrawl = onCall({
  region:"us-central1",
  secrets:[GOOGLE_PLACES_API_KEY],
  timeoutSeconds:120,
  memory:"512MiB"
}, async request => {
  await assertMasterAdmin(request);
  const criteria = request.data?.criteria || {};
  const structuredPlan = request.data?.structuredPlan || criteria.structuredPlan || {};
  const runId = String(request.data?.runId || "");
  const records = await discoverPlacesForCriteria({...criteria, structuredPlan});
  let created = 0;
  for (const record of records) {
    const classified = await classifyDiscoveryRecord({
      ...record,
      crawlRunId: runId,
      criteriaSnapshot: criteria,
      discoveryMode: "master-admin-refined-discovery-crawl"
    });
    await writeDiscoveryQueueItem(classified);
    created += 1;
  }
  return {
    created,
    placesConfigured: !!optionalPlacesKey(),
    ticketmaster: "later",
    message: created
      ? `Discovery crawl wrote ${created} Google Places candidate(s). Complete DJ/artist, promoter, email, and Instagram before approval.`
      : (optionalPlacesKey()
        ? "No Places matches for this refined search. Broaden city/genre/type or add a public page extraction."
        : "GOOGLE_PLACES_API_KEY is not configured. Set the Firebase secret to run live discovery crawls.")
  };
});

exports.requestEmailOtp = onCall({region:"us-central1", secrets:[SENDGRID_API_KEY, EMAIL_OTP_PEPPER]}, async request => {
  const email = normalizeEmail(request.data?.email);
  const challengeId = crypto.createHash("sha256").update(email).digest("hex");
  const ref = db.collection("emailOtpChallenges").doc(challengeId);
  const previous = await ref.get();
  const previousData = previous.exists ? previous.data() || {} : {};
  const lastRequestedMs = previousData.requestedAt?.toMillis?.() || 0;
  if (Date.now() - lastRequestedMs < 60000) throw new HttpsError("resource-exhausted", "Wait one minute before requesting another code.");
  const code = createOtpCode();
  await ref.set({
    email, codeHash:otpHash(email, code), attempts:0, used:false,
    requestedAt:admin.firestore.FieldValue.serverTimestamp(),
    expiresAt:admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000)
  });
  await sendEmailOtp(email, code);
  return {challengeId, expiresInSeconds:300, delivery:"email"};
});

exports.verifyEmailOtp = onCall({region:"us-central1", secrets:[EMAIL_OTP_PEPPER]}, async request => {
  const email = normalizeEmail(request.data?.email);
  const challengeId = String(request.data?.challengeId || "");
  const code = String(request.data?.code || "").trim().toUpperCase();
  if (!challengeId || !/^[A-Z2-9]{8}$/.test(code)) throw new HttpsError("invalid-argument", "Enter the 8-character email code.");
  const ref = db.collection("emailOtpChallenges").doc(challengeId);
  const token = await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "The sign-in code was not found. Request a new code.");
    const data = snap.data() || {};
    if (data.email !== email || data.used) throw new HttpsError("permission-denied", "This code cannot be used.");
    if ((data.expiresAt?.toMillis?.() || 0) < Date.now()) throw new HttpsError("deadline-exceeded", "This code expired. Request a new code.");
    if (Number(data.attempts || 0) >= 5) throw new HttpsError("resource-exhausted", "Too many attempts. Request a new code.");
    if (!crypto.timingSafeEqual(Buffer.from(data.codeHash, "hex"), Buffer.from(otpHash(email, code), "hex"))) {
      transaction.update(ref, {attempts:admin.firestore.FieldValue.increment(1)});
      throw new HttpsError("permission-denied", "The email code is incorrect.");
    }
    transaction.update(ref, {used:true, verifiedAt:admin.firestore.FieldValue.serverTimestamp()});
    return true;
  });
  if (!token) throw new HttpsError("internal", "Email verification failed.");
  let user;
  try { user = await admin.auth().getUserByEmail(email); }
  catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    user = await admin.auth().createUser({email, emailVerified:true});
  }
  if (!user.emailVerified) await admin.auth().updateUser(user.uid, {emailVerified:true});
  return {customToken:await admin.auth().createCustomToken(user.uid, {emailOtp:true}), expiresInSeconds:300};
});

exports.assignClubAdmin = onCall({region:"us-central1"}, async request => {
  await assertMasterAdmin(request);
  const clubId = String(request.data?.clubId || request.data?.clubLocationId || "").trim();
  const patronUid = String(request.data?.patronUid || "").trim();
  if (!clubId || !patronUid) throw new HttpsError("invalid-argument", "clubId and patronUid are required.");
  const [clubSnap, userSnap] = await Promise.all([db.collection("clubLocations").doc(clubId).get(), db.collection("users").doc(patronUid).get()]);
  if (!clubSnap.exists) throw new HttpsError("not-found", "The selected club was not found.");
  if (!userSnap.exists) throw new HttpsError("failed-precondition", "The club admin must first register as a FLOQR patron.");
  const patron = userSnap.data() || {};
  if (patron.profileCompleted !== true) throw new HttpsError("failed-precondition", "The selected patron must complete patron registration first.");
  const electedServiceRoles = [
    ...(Array.isArray(patron.requestedRoles) ? patron.requestedRoles : []),
    ...(Array.isArray(patron.electedRoles) ? patron.electedRoles : []),
    ...(Array.isArray(patron.approvedRoles) ? patron.approvedRoles : []),
    patron.requestedRole,
    patron.electedRole,
    patron.serviceSubtype,
    patron.publicProfileType,
    patron.roleType,
    patron.role
  ].filter(Boolean).map(value => String(value).toLowerCase());
  if (!electedServiceRoles.some(value => /promoter|\bdj\b|disc jockey|waiter|waitress|hospitality|bottle|bartender|barman|bar man|videographer|camera operator|cameraman|camera man|photographer|cinematographer|media ?creator/.test(value))) {
    throw new HttpsError("failed-precondition", "The selected patron must first elect an eligible service role, including videographer/camera operator when applicable.");
  }
  const email = String(patron.email || "").toLowerCase();
  const assignmentId = `${clubId}_${patronUid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const batch = db.batch();
  batch.set(db.collection("clubAdminAssignments").doc(assignmentId), {clubId, patronUid, patronEmail:email, electedServiceRoles, status:"active", assignedByUid:request.auth.uid, assignedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
  batch.set(db.collection("clubLocations").doc(clubId), {adminUids:admin.firestore.FieldValue.arrayUnion(patronUid), adminEmails:admin.firestore.FieldValue.arrayUnion(email), updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
  batch.set(db.collection("users").doc(patronUid), {roles:admin.firestore.FieldValue.arrayUnion("clubAdmin"), clubAdminLocationIds:admin.firestore.FieldValue.arrayUnion(clubId), updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
  await batch.commit();
  return {assignmentId, clubId, patronUid, patronEmail:email, status:"active"};
});

exports.aiSearch = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  return {answer:"AI search backend is scaffolded. Static local search remains active.", results:[], suggestedActions:[]};
});

exports.aiExtractPublicSourceUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  const sourceUrl = String(data?.sourceUrl || "").trim();
  const sourceText = String(data?.sourceText || "").slice(0, 50000);
  if (!sourceUrl) throw new functions.https.HttpsError("invalid-argument", "sourceUrl is required.");
  if (isSearchResultsUrl(sourceUrl)) {
    const record = searchResultsRecord(sourceUrl, sourceText);
    return {
      status:"searchResultsPage",
      sourceUrl,
      record,
      missingDatapoints:record.missingDatapoints || []
    };
  }
  const html = await fetchPublicSource(sourceUrl);
  const record = extractDiscoveryRecordFromHtml(sourceUrl, html, sourceText);
  return {
    status:"extracted",
    sourceUrl,
    record,
    missingDatapoints:record.missingDatapoints || []
  };
});

exports.aiEnhanceShoutOutMedia = onCall({
  region:"us-central1",
  secrets:[GEMINI_API_KEY],
  timeoutSeconds:120,
  memory:"1GiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (request.data?.mode === "diagnostic") {
    geminiSecretValue();
    return {
      status:"configured",
      provider:"gemini",
      model:GEMINI_IMAGE_EDIT_MODEL,
      capabilities:["authenticated ShoutOut image editing", "Storage owner path enforcement", "diagnostic secret check"],
      videoEditing:"Video uploads use FLOQR first-7-second trim; this callable edits images."
    };
  }
  const uid = request.auth.uid;
  const mediaStoragePath = String(request.data?.mediaStoragePath || "").trim();
  const prompt = safeEnhancementPrompt(request.data?.prompt, request.data?.enhancementType);
  if (!mediaStoragePath) throw new HttpsError("invalid-argument", "mediaStoragePath is required.");
  const original = await downloadOwnedImage(mediaStoragePath, uid);
  const edited = await callGeminiImageEdit({
    buffer:original.buffer,
    contentType:original.contentType,
    prompt
  });
  const outputPath = enhancedPathForOriginal(original.mediaStoragePath, request.data?.referenceNumber, edited.contentType);
  const enhancedMediaUrl = await uploadEnhancedGeminiImage({
    bucket:original.bucket,
    outputPath,
    buffer:edited.data,
    contentType:edited.contentType
  });
  await db.collection("aiMediaEdits").add({
    uid,
    sourceType:"shoutoutMedia",
    originalMediaStoragePath:original.mediaStoragePath,
    enhancedMediaStoragePath:outputPath,
    enhancementType:String(request.data?.enhancementType || "image-edit").slice(0, 80),
    prompt:String(request.data?.prompt || "").slice(0, 600),
    provider:"gemini",
    model:GEMINI_IMAGE_EDIT_MODEL,
    status:"completed",
    createdAt:admin.firestore.FieldValue.serverTimestamp()
  });
  return {
    status:"enhanced",
    provider:"gemini",
    model:GEMINI_IMAGE_EDIT_MODEL,
    enhancedMediaUrl,
    enhancedMediaStoragePath:outputPath,
    aiMediaSafetyStatus:"passed",
    aiMediaSafetyNotes:edited.textNotes || "Gemini returned an edited image suitable for ShoutOut review."
  };
});

exports.aiSuggestShoutOut = onCall({
  region:"us-central1",
  secrets:[GEMINI_API_KEY],
  timeoutSeconds:45,
  memory:"512MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const data = request.data || {};
  const fallback = fallbackShoutOutSuggestion(data);
  if (!optionalGeminiSecretValue()) return fallback;
  const {mainLimit, subLimit, lineCount, perLine} = shoutOutDisplayCaps(data);
  const profileSignals = data.profileSignals && typeof data.profileSignals === "object" ? {
    displayName:clampText(data.profileSignals.displayName || "", 40),
    city:clampText(data.profileSignals.city || "", 60),
    country:clampText(data.profileSignals.country || "", 60),
    interests:Array.isArray(data.profileSignals.interests) ? data.profileSignals.interests.slice(0, 8).map(item => clampText(item, 40)) : []
  } : {};
  const pastShoutouts = Array.isArray(data.pastShoutouts)
    ? data.pastShoutouts.slice(0, 6).map(item => ({
      mainText:clampText(item?.mainText || "", 70),
      subText:clampText(item?.subText || "", 90),
      tone:clampText(item?.tone || "", 30),
      template:clampText(item?.template || "", 50),
      location:clampText(item?.location || "", 70)
    }))
    : [];
  const prompt = [
    "You are FLOQR AI helping write public LED-safe ShoutOut copy.",
    "Return only JSON with keys: mainText, subText, tone, safetyStatus.",
    `mainText must be ${mainLimit} visible characters or fewer, arranged in no more than ${lineCount} lines with about ${perLine} characters per line. subText must be ${subLimit} characters or fewer.`,
    "Prefer short familiar words that wrap cleanly. Never depend on clipping, ellipsis, or automatic font shrinking.",
    "Preserve the protected terms FLOQR, ShoutOut, Mingl, and BartR exactly. Do not translate or alter those terms.",
    "Do not include offensive, explicit, hateful, illegal, private, payment, or sensitive personal data.",
    "Keep the copy suitable for a public nightlife display.",
    `Tone: ${clampText(data.tone || "party", 40)}`,
    `Current main text: ${clampText(data.mainText || "", 120)}`,
    `Current sub text: ${clampText(data.subText || "", 120)}`,
    `Template id: ${clampText(data.templateId || "", 80)}`,
    `Venue/event type: ${clampText(data.eventType || "", 80)}`,
    `User-owned profile signals JSON: ${JSON.stringify(profileSignals)}`,
    `User-owned past ShoutOut examples JSON: ${JSON.stringify(pastShoutouts)}`,
    "Use these profile and past ShoutOut signals only for tone and style. Do not reveal private details."
  ].join("\n");
  try {
    const json = await callGeminiJson(prompt, "ShoutOut suggestion");
    return {
      mainText:fitShoutOutDisplayText(json?.mainText || fallback.mainText, data, "main"),
      subText:fitShoutOutDisplayText(json?.subText || fallback.subText, data, "sub"),
      tone:clampText(json?.tone || data.tone || fallback.tone, 40),
      provider:"gemini",
      providerMode:"gemini",
      model:GEMINI_TEXT_MODEL,
      safetyStatus:json?.safetyStatus === "flagged" ? "flagged" : "passed"
    };
  } catch (error) {
    console.warn("Gemini ShoutOut suggestion fallback:", error.message);
    return fallback;
  }
});

exports.aiSuggestGrammarCorrection = onCall({
  region:"us-central1",
  secrets:[GEMINI_API_KEY],
  timeoutSeconds:30,
  memory:"256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const data = request.data || {};
  const fallback = fallbackGrammarSuggestion(data);
  if (!optionalGeminiSecretValue()) return fallback;
  const text = preserveProtectedTerms(String(data.text || "").slice(0, 1200));
  if (!text.trim()) return fallback;
  const context = {
    product:clampText(data.product || "mingl", 40),
    inputType:clampText(data.inputType || "chat", 60),
    preferredLanguage:clampText(data.preferredLanguage || "auto", 40),
    tonePreference:clampText(data.tonePreference || "keepTone", 40),
    correctionMode:clampText(data.correctionMode || "approvalRequired", 40)
  };
  const prompt = [
    "You are FLOQR AI helping a signed-in user correct their own private draft text.",
    "Return only JSON with keys: correctedText, detectedIssues, explanation, confidence.",
    "detectedIssues must be an array of objects with original, suggestion, type, and confidence.",
    "Preserve FLOQR, ShoutOut, Mingl, and BartR exactly. Do not translate or alter those protected terms.",
    "Do not add new private facts. Keep the user's meaning and tone unless a tone preference is provided.",
    "This draft is private and must not be treated as searchable or public content.",
    `Context JSON: ${JSON.stringify(context)}`,
    `Draft text: ${text}`
  ].join("\n");
  try {
    const json = await callGeminiJson(prompt, "Grammar correction");
    return {
      correctedText:preserveProtectedTerms(String(json?.correctedText || fallback.correctedText || text).slice(0, 1200)),
      detectedIssues:Array.isArray(json?.detectedIssues) ? json.detectedIssues.slice(0, 20) : fallback.detectedIssues,
      explanation:clampText(json?.explanation || fallback.explanation, 500),
      confidence:Math.max(0, Math.min(Number(json?.confidence || fallback.confidence || 0.5), 1)),
      provider:"gemini",
      model:GEMINI_TEXT_MODEL
    };
  } catch (error) {
    console.warn("Gemini grammar correction fallback:", error.message);
    return fallback;
  }
});

exports.aiRankLocations = onCall({
  region:"us-central1",
  secrets:[GEMINI_API_KEY],
  timeoutSeconds:45,
  memory:"512MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const locations = Array.isArray(request.data?.locations) ? request.data.locations.slice(0, 80) : [];
  const userContext = request.data?.userContext || {};
  const fallbackIds = locationRankFallback(locations, userContext);
  if (!optionalGeminiSecretValue() || locations.length < 2) {
    return {rankedIds:fallbackIds, provider:"local-fallback"};
  }
  const compactLocations = locations.map(item => {
    const data = item.data || item;
    return {
      id:String(item.id || data.id || "").slice(0, 120),
      name:clampText(data.locationName || data.brandName || data.name || "", 90),
      city:clampText(data.city || "", 60),
      country:clampText(data.country || "", 60),
      type:clampText(data.type || "", 50),
      genres:Array.isArray(data.genres) ? data.genres.slice(0, 8).map(value => clampText(value, 40)) : []
    };
  });
  const safeContext = {
    city:clampText(userContext.city || "", 60),
    stateRegion:clampText(userContext.stateRegion || "", 60),
    country:clampText(userContext.country || "", 60),
    preferredGenres:Array.isArray(userContext.preferredGenres) ? userContext.preferredGenres.slice(0, 12).map(value => clampText(value, 40)) : [],
    preferredVenueTypes:Array.isArray(userContext.preferredVenueTypes) ? userContext.preferredVenueTypes.slice(0, 12).map(value => clampText(value, 40)) : [],
    preferredCities:Array.isArray(userContext.preferredCities) ? userContext.preferredCities.slice(0, 12).map(value => clampText(value, 40)) : [],
    interests:Array.isArray(userContext.interests) ? userContext.interests.slice(0, 12).map(value => clampText(value, 40)) : [],
    locationSource:clampText(userContext.locationSource || "unknown", 30)
  };
  const prompt = [
    "You are FLOQR AI ranking public venue/event results for the signed-in user.",
    "Use only this provided public venue data and this user's own non-sensitive preference context.",
    "Return only JSON: {\"rankedIds\":[\"id1\",\"id2\"]}. Include every id exactly once.",
    "Prioritize nearby city/country matches, preferred genres, preferred venue types, and interests.",
    `User context JSON: ${JSON.stringify(safeContext)}`,
    `Locations JSON: ${JSON.stringify(compactLocations)}`
  ].join("\n");
  try {
    const json = await callGeminiJson(prompt, "Location ranking");
    const ids = Array.isArray(json?.rankedIds) ? json.rankedIds.map(String) : [];
    const allowed = new Set(compactLocations.map(item => item.id));
    const clean = ids.filter(id => allowed.has(id));
    const missing = compactLocations.map(item => item.id).filter(id => !clean.includes(id));
    return {rankedIds:[...clean, ...missing], provider:"gemini", model:GEMINI_TEXT_MODEL};
  } catch (error) {
    console.warn("Gemini location ranking fallback:", error.message);
    return {rankedIds:fallbackIds, provider:"local-fallback"};
  }
});

exports.aiGenerateTemplateBackground = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  return {status:"notConfigured", message:"Configure Firebase AI Logic, Gemini, Imagen, or an approved image provider server-side."};
});

exports.aiModifyTemplateBackground = exports.aiGenerateTemplateBackground;
exports.aiSummarizeAdminQueue = exports.aiSearch;
exports.aiGenerateRecommendation = exports.aiSearch;
exports.aiProcessNotificationPreferences = exports.aiSearch;

/** One-shot: email v29.09.14 test links to Master Admin testers via SendGrid. */
exports.emailV290914TestLinks = onRequest({
  region: "us-central1",
  secrets: [SENDGRID_API_KEY],
  timeoutSeconds: 30,
  memory: "256MiB",
  cors: true
}, async (req, res) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }
    const toEmail = "bans.don@gmail.com";
    const base = "https://jadzadco.github.io/shoutout-demo";
    const v = "29.09.14";
    const links = [
      ["Master seed (spot ads + Lucy/Cobra BartR)", `${base}/seed-v29-09-14.html?v=${v}`],
      ["Search / Mingl entry", `${base}/?v=${v}&start=search`],
      ["Mingl Gist (Stories)", `${base}/mingl-gist.html?v=${v}&from=mingl`],
      ["RydR landing", `${base}/rydr.html?v=${v}&from=search`],
      ["Pickup / RydR hail (Stripe fare + sim stages)", `${base}/pickup.html?v=${v}`],
      ["BartR commerce", `${base}/commerce.html?v=${v}`],
      ["Casamara Club Admin (spot ads)", `${base}/admin.html?location=casamara-rooftop-washington-dc&v=${v}`],
      ["Heist Club Admin", `${base}/admin.html?location=heist-washington-dc&v=${v}`],
      ["Onyx Club Admin", `${base}/admin.html?location=onyx-rooftop-washington-dc&v=${v}`],
      ["GAIA Club Admin", `${base}/admin.html?location=gaia-supperclub-washington-dc&v=${v}`],
      ["Vera Club Admin", `${base}/admin.html?location=vera-cocina-washington-dc&v=${v}`],
      ["SAX Club Admin", `${base}/admin.html?location=sax-washington-dc&v=${v}`],
      ["Decades Club Admin", `${base}/admin.html?location=decades-washington-dc&v=${v}`],
      ["Rosebar Club Admin", `${base}/admin.html?location=rosebar-lounge-washington-dc&v=${v}`],
      ["KATA Club Admin", `${base}/admin.html?location=kata-washington-dc&v=${v}`],
      ["LIMA Twist Club Admin", `${base}/admin.html?location=lima-twist-washington-dc&v=${v}`],
      ["Zebbies Club Admin", `${base}/admin.html?location=zebbies-garden-washington-dc&v=${v}`],
      ["Casamara public profile", `${base}/club-profile.html?location=casamara-rooftop-washington-dc&v=${v}`],
      ["Onboard DC venues (Firestore)", `${base}/onboard-dc-venues.html?v=${v}`],
      ["Deployment notes", `${base}/DEPLOYMENT-V29-09.14.md`]
    ];
    const textBody = [
      "FLOQR v29.09.14 — test links",
      "",
      "Hard-refresh (Ctrl+F5). Use ?v=29.09.14 on every URL.",
      "",
      "1) First: open Master seed and run both buttons (spot ad pool + Lucy/Cobra BartR).",
      "2) Then walk Mingl → Mingl Gist, RydR/Pickup (real Stripe fare), Club Admin Advertising spot campaigns, and BartR checkout.",
      "",
      ...links.map(([label, url], i) => `${i + 1}. ${label}\n   ${url}`),
      "",
      "— FLOQR automated test-link mailer"
    ].join("\n");
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.45;color:#111">
        <h2>FLOQR v29.09.14 — test links</h2>
        <p>Hard-refresh (<strong>Ctrl+F5</strong>). Keep <code>?v=29.09.14</code> on every URL.</p>
        <ol>
          <li>Open <strong>Master seed</strong> and run both buttons (DC spot ad pool + Lucy/Cobra BartR).</li>
          <li>Test Mingl → Mingl Gist, RydR/Pickup (real Stripe fare; simulated dispatch), Club Admin spot ads, BartR checkout.</li>
        </ol>
        <ul>
          ${links.map(([label, url]) => `<li><a href="${url}">${label}</a><br/><span style="color:#555;font-size:12px">${url}</span></li>`).join("")}
        </ul>
        <p style="color:#666;font-size:12px">Sent by FLOQR emailV290914TestLinks</p>
      </div>`;
    const key = SENDGRID_API_KEY.value() || process.env.SENDGRID_API_KEY || "";
    if (!key) {
      res.status(500).json({ok: false, error: "SENDGRID_API_KEY missing"});
      return;
    }
    // Verified Single Sender Identity in SendGrid (Domain Auth not required).
    const fromEmail = "bans.don@gmail.com";
    const replyTo = {email: "bans.don@gmail.com"};
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {authorization: `Bearer ${key}`, "content-type": "application/json"},
      body: JSON.stringify({
        personalizations: [{to: [{email: toEmail}]}],
        from: {email: fromEmail, name: "FLOQR"},
        reply_to: replyTo,
        subject: "FLOQR v29.09.14 - your test links",
        content: [
          {type: "text/plain", value: textBody},
          {type: "text/html", value: htmlBody}
        ]
      })
    });
    if (!(response.ok || response.status === 202)) {
      const errText = await response.text().catch(() => "");
      res.status(502).json({ok: false, status: response.status, from: fromEmail, error: errText.slice(0, 500)});
      return;
    }
    res.status(200).json({ok: true, to: toEmail, from: fromEmail, reply_to: replyTo.email, links: links.length, package: v, status: response.status});
  } catch (error) {
    res.status(500).json({ok: false, error: error?.message || String(error)});
  }
});

/** One-shot: email 3-day FLOQR feature test checklist to Master Admin. */
exports.emailFloqrThreeDayTestPlan = onRequest({
  region: "us-central1",
  secrets: [SENDGRID_API_KEY],
  timeoutSeconds: 30,
  memory: "256MiB",
  cors: true
}, async (req, res) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }
    const toEmail = "bans.don@gmail.com";
    const fromEmail = "bans.don@gmail.com";
    const base = "https://jadzadco.github.io/shoutout-demo";
    const vMingl = "29.09.16";
    const v = "29.09.14";
    const items = [
      {
        title: "1. DC venues onboarded",
        open: `${base}/onboard-dc-venues.html?v=${v}`,
        do: "Sign in as Master Admin; push venues (Heist, GAIA, Onyx, Vera, SAX, Decades, Rosebar, KATA, LIMA Twist, Casamara). Spot-check club admin + profile + display for one venue.",
        expect: "Venue docs exist; Club Admin / club-profile / display open without missing-location errors."
      },
      {
        title: "2. Casamara Rooftop events",
        open: `${base}/admin.html?location=casamara-rooftop-washington-dc&v=${v}`,
        do: "Open Casamara Club Admin / profile; confirm Sunset Sundays + private events from seed.",
        expect: "Events list shows seeded Casamara events (public + private)."
      },
      {
        title: "3. Spot ads pool + Club Admin Advertising",
        open: `${base}/admin.html?location=casamara-rooftop-washington-dc&v=${v}`,
        do: "Advertising tab → Publish to advertisement pool / seed from website events. Repeat on another DC club if needed.",
        expect: "Campaigns appear in the pool; patron surfaces can pick DC spot ads."
      },
      {
        title: "4. Master seed page",
        open: `${base}/seed-v29-09-14.html?v=${v}`,
        do: "Run both buttons: DC spot ad pool + Lucy/Cobra BartR seed.",
        expect: "Success toasts; ads + BartR sellers/products written to Firestore."
      },
      {
        title: "5. BartR — Cobra Callisto Arts",
        open: `${base}/commerce.html?v=${v}`,
        do: "Search “art”; open Cobra Callisto Arts (~20 art/jewelry/accessory items); start Stripe checkout on one SKU.",
        expect: "Catalog loads; checkout session opens (test mode OK)."
      },
      {
        title: "6. RydR / Pickup",
        open: `${base}/pickup.html?v=${v}`,
        do: "Use saved labels (Home / Preferred Home Pickup); confirm ride history; note spot ad between address + matching; pay real Stripe rydrFare; walk map stages through drop-off confirm.",
        expect: "Fare charges via Stripe; stages advance to drop-off confirm; dispatch remains simulated."
      },
      {
        title: "7. Mingl ads + Mingl Gist",
        open: `${base}/?v=${vMingl}&start=search`,
        do: `Open Mingl → see ad splash; people grid spot ads. Then open ${base}/mingl-gist.html?v=${v}&from=mingl`,
        expect: "Splash + in-grid ads show; Gist shows shoutouts + ads."
      },
      {
        title: "8. Mingl Accept (Anne) permission fix",
        open: `${base}/?v=${vMingl}&start=search`,
        do: "Hard-refresh; open Mingl Requests; Accept Anne (or pending Friend/Mingl request).",
        expect: "No permission-denied; status becomes mutual; Mingl Chat opens."
      },
      {
        title: "9. Marketing SMS/WhatsApp packs",
        open: `${base}/admin.html?location=casamara-rooftop-washington-dc&v=${v}`,
        do: "Club Admin → Advertising: check $10 SMS/WhatsApp packs / campaigns UI (if present).",
        expect: "Pack purchase / campaign controls visible and usable for the club."
      },
      {
        title: "10. SendGrid From verified",
        open: "(this email)",
        do: "Confirm this checklist arrived From bans.don@gmail.com.",
        expect: "Inbox delivery; no 403 sender-identity errors."
      }
    ];
    const textBody = [
      "FLOQR — 3-day feature test checklist",
      "",
      `Hard-refresh (Ctrl+F5). Mingl/search: ?v=${vMingl}. Other pages: ?v=${v}.`,
      "",
      ...items.flatMap((it, i) => [
        it.title,
        `  Open: ${it.open}`,
        `  Do: ${it.do}`,
        `  Expect: ${it.expect}`,
        ""
      ]),
      "— FLOQR emailFloqrThreeDayTestPlan"
    ].join("\n");
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.45;color:#111;max-width:720px">
        <h2 style="margin:0 0 8px">FLOQR — 3-day feature test checklist</h2>
        <p style="margin:0 0 16px">Hard-refresh (<strong>Ctrl+F5</strong>). Mingl/search use <code>?v=${vMingl}</code>; other pages <code>?v=${v}</code>.</p>
        ${items.map(it => `
          <div style="margin:0 0 14px;padding:10px 12px;border-left:3px solid #111">
            <strong>${it.title}</strong>
            <div style="margin-top:6px"><a href="${it.open}">${it.open}</a></div>
            <div style="margin-top:4px"><strong>Do:</strong> ${it.do}</div>
            <div style="margin-top:4px"><strong>Expect:</strong> ${it.expect}</div>
          </div>`).join("")}
        <p style="color:#666;font-size:12px">Sent by FLOQR emailFloqrThreeDayTestPlan · From ${fromEmail}</p>
      </div>`;
    const key = SENDGRID_API_KEY.value() || process.env.SENDGRID_API_KEY || "";
    if (!key) {
      res.status(500).json({ok: false, error: "SENDGRID_API_KEY missing"});
      return;
    }
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {authorization: `Bearer ${key}`, "content-type": "application/json"},
      body: JSON.stringify({
        personalizations: [{to: [{email: toEmail}]}],
        from: {email: fromEmail, name: "FLOQR"},
        reply_to: {email: fromEmail},
        subject: "FLOQR — 3-day feature test checklist",
        content: [
          {type: "text/plain", value: textBody},
          {type: "text/html", value: htmlBody}
        ]
      })
    });
    if (!(response.ok || response.status === 202)) {
      const errText = await response.text().catch(() => "");
      res.status(502).json({ok: false, status: response.status, from: fromEmail, error: errText.slice(0, 500)});
      return;
    }
    res.status(200).json({
      ok: true,
      to: toEmail,
      from: fromEmail,
      subject: "FLOQR — 3-day feature test checklist",
      items: items.length,
      status: response.status
    });
  } catch (error) {
    res.status(500).json({ok: false, error: error?.message || String(error)});
  }
});

async function sendgridMail({to, from, subject, textBody, htmlBody}) {
  const key = SENDGRID_API_KEY.value() || process.env.SENDGRID_API_KEY || "";
  if (!key) {
    const err = new Error("SENDGRID_API_KEY missing");
    err.code = "missing-key";
    throw err;
  }
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {authorization: `Bearer ${key}`, "content-type": "application/json"},
    body: JSON.stringify({
      personalizations: [{to: [{email: to}]}],
      from: {email: from, name: "FLOQR"},
      reply_to: {email: from},
      subject,
      content: [
        {type: "text/plain", value: textBody},
        {type: "text/html", value: htmlBody}
      ]
    })
  });
  if (!(response.ok || response.status === 202)) {
    const errText = await response.text().catch(() => "");
    const err = new Error(errText.slice(0, 500) || `SendGrid ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.status;
}

/** Email iPhone mobile test checklist link (no RydR). */
exports.emailMobileTestChecklist = onRequest({
  region: "us-central1",
  secrets: [SENDGRID_API_KEY],
  timeoutSeconds: 30,
  memory: "256MiB",
  cors: true
}, async (req, res) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }
    const toEmail = "bans.don@gmail.com";
    const fromEmail = "bans.don@gmail.com";
    const base = "https://jadzadco.github.io/shoutout-demo";
    const checklistV = "29.09.20";
    const checklistUrl = `${base}/mobile-test-checklist.html?v=${checklistV}`;
    const bullets = [
      "DC venues / Casamara Club Admin + events (spot-check one venue)",
      "Spot ads + device media upload on Advertising template inputs",
      "$10 SMS/WhatsApp credits → Stripe Checkout",
      "BartR Cobra arts products catalog",
      "Mingl Accept + Mingl Gist + spot ads",
      "Profile tabs readable on iPhone (wrap)",
      "FloqR branding looks correct on the surfaces you open (not Flocker)"
    ];
    const subject = "FLOQR — mobile test checklist (iPhone)";
    const textBody = [
      subject,
      "",
      "Open this on your iPhone, run tests in comfort, tap Submit when done.",
      "Or reply to this email with Pass/Fail notes if easier.",
      "",
      checklistUrl,
      "",
      "Past ~3 days — what to verify:",
      ...bullets.map((b) => `• ${b}`),
      "",
      "Feedback: use Submit on the page (emails a summary here) OR reply to this email.",
      "",
      "— FLOQR emailMobileTestChecklist"
    ].join("\n");
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.45;color:#111;max-width:640px">
        <h2 style="margin:0 0 8px">${subject}</h2>
        <p style="margin:0 0 14px">Open this on your iPhone, run tests in comfort, tap <strong>Submit</strong> when done.<br/>
        Or <strong>reply to this email</strong> with Pass/Fail notes if easier.</p>
        <p style="margin:0 0 16px"><a href="${checklistUrl}" style="font-size:18px;font-weight:700">${checklistUrl}</a></p>
        <p style="margin:0 0 6px"><strong>Past ~3 days — what to verify</strong></p>
        <ul style="margin:0;padding-left:20px">
          ${bullets.map((b) => `<li>${b}</li>`).join("")}
        </ul>
        <p style="margin:16px 0 0">Feedback: <strong>Submit</strong> on the page emails a summary here, or just reply to this message.</p>
        <p style="color:#666;font-size:12px;margin-top:18px">Sent by FLOQR emailMobileTestChecklist · From ${fromEmail}</p>
      </div>`;
    const status = await sendgridMail({to: toEmail, from: fromEmail, subject, textBody, htmlBody});
    res.status(200).json({ok: true, to: toEmail, from: fromEmail, subject, checklistUrl, status});
  } catch (error) {
    const code = error?.code === "missing-key" ? 500 : (error?.status ? 502 : 500);
    res.status(code).json({ok: false, error: error?.message || String(error)});
  }
});

/** Callable: phone submits Pass/Fail/Skip summary → email Master Admin. */
exports.submitMobileTestResults = onCall({
  region: "us-central1",
  secrets: [SENDGRID_API_KEY],
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (request) => {
  const data = request.data || {};
  const results = Array.isArray(data.results) ? data.results.slice(0, 40) : [];
  if (!results.length) {
    throw new HttpsError("invalid-argument", "results required");
  }
  const auth = request.auth || null;
  const runRef = db.collection("mobileTestRuns").doc();
  const runId = runRef.id;
  const normalized = results.map((row) => ({
    id: String(row?.id || "").slice(0, 80),
    title: String(row?.title || row?.id || "test").slice(0, 160),
    result: ["pass", "fail", "skip", "unset"].includes(String(row?.result || "").toLowerCase())
      ? String(row.result).toLowerCase()
      : "unset",
    note: String(row?.note || "").slice(0, 500)
  }));
  const counts = {pass: 0, fail: 0, skip: 0, unset: 0};
  normalized.forEach((r) => { counts[r.result] = (counts[r.result] || 0) + 1; });
  const submitter = auth
    ? `${auth.token?.email || auth.uid}`
    : "anonymous";
  const toEmail = "bans.don@gmail.com";
  const fromEmail = "bans.don@gmail.com";
  const subject = `FLOQR — mobile test results (${counts.pass}P / ${counts.fail}F / ${counts.skip}S)`;
  const lines = normalized.map((r) => {
    const mark = r.result.toUpperCase();
    const note = r.note ? ` — ${r.note}` : "";
    return `• [${mark}] ${r.title}${note}`;
  });
  const textBody = [
    subject,
    "",
    `Submitter: ${submitter}`,
    `Run: ${runId}`,
    `UA: ${String(data.userAgent || "").slice(0, 240)}`,
    "",
    ...lines,
    "",
    "— FLOQR submitMobileTestResults"
  ].join("\n");
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;line-height:1.45;color:#111;max-width:640px">
      <h2 style="margin:0 0 8px">${subject}</h2>
      <p style="margin:0 0 8px">Submitter: <strong>${submitter}</strong><br/>Run: <code>${runId}</code></p>
      <ul style="margin:0;padding-left:18px">
        ${normalized.map((r) => {
          const color = r.result === "pass" ? "#0a7a2f" : r.result === "fail" ? "#b00020" : "#555";
          const note = r.note ? `<br/><span style="color:#555">${r.note.replace(/</g, "&lt;")}</span>` : "";
          return `<li style="margin:0 0 8px"><strong style="color:${color}">${r.result.toUpperCase()}</strong> — ${r.title.replace(/</g, "&lt;")}${note}</li>`;
        }).join("")}
      </ul>
      <p style="color:#666;font-size:12px;margin-top:16px">FLOQR submitMobileTestResults</p>
    </div>`;

  let emailStatus = 0;
  try {
    emailStatus = await sendgridMail({to: toEmail, from: fromEmail, subject, textBody, htmlBody});
  } catch (error) {
    throw new HttpsError("internal", error?.message || "email failed");
  }

  const doc = {
    results: normalized,
    counts,
    submitterUid: auth?.uid || null,
    submitterEmail: auth?.token?.email || null,
    userAgent: String(data.userAgent || "").slice(0, 400),
    pageUrl: String(data.pageUrl || "").slice(0, 400),
    submittedAtClient: String(data.submittedAtClient || "").slice(0, 64),
    emailed: true,
    emailStatus,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  try {
    await runRef.set(doc);
  } catch (_) {
    /* email already delivered; doc write is best-effort for anonymous */
  }

  return {ok: true, runId, to: toEmail, counts, emailStatus};
});

const PREVIEW_LINKS_DEFAULT_TO = "bans.don@gmail.com";
const PREVIEW_LINKS_DEFAULT_FROM = "bans.don@gmail.com";
const PREVIEW_LINKS_DEFAULT_BASE = "https://jadzadco.github.io/shoutout-demo";

function defaultFloqrPreviewLinks(v = "29.09.40") {
  const base = PREVIEW_LINKS_DEFAULT_BASE;
  return [
    ["FloqAi — Ask FloqR intent", `${base}/?v=${v}&start=intent`],
    ["Search / Mingl entry", `${base}/?v=${v}&start=search`],
    ["Heist ShoutOut — Soccer + Heist templates", `${base}/?v=${v}&location=heist-washington-dc`],
    ["Heist Club Admin", `${base}/admin.html?location=heist-washington-dc&v=${v}`],
    ["Soccer Morocco $30", `${base}/display.html?location=heist-washington-dc&template=soccerMorocco&main=FLOQR&sub=10&screen=led-64x32&preview=1&v=${v}`],
    ["Soccer Spain $30", `${base}/display.html?location=heist-washington-dc&template=soccerSpain&main=DON&sub=OK&screen=led-64x32&preview=1&v=${v}`],
    ["Soccer Chelsea $30", `${base}/display.html?location=heist-washington-dc&template=soccerChelsea&main=BLUE&sub=CF&screen=led-64x32&preview=1&v=${v}`],
    ["Soccer PSG $30", `${base}/display.html?location=heist-washington-dc&template=soccerParisSaintGermain&main=PARIS&sub=PS&screen=led-64x32&preview=1&v=${v}`],
    ["Soccer Monaco $30", `${base}/display.html?location=heist-washington-dc&template=soccerMonaco&main=ASM&sub=MC&screen=led-64x32&preview=1&v=${v}`],
    ["Locked Up — no handle", `${base}/display.html?location=heist-washington-dc&template=heistVaultNight&main=LOCKED%20UP&screen=led-64x32&preview=1&v=${v}`],
    ["Locked Up — with patron handle", `${base}/display.html?location=heist-washington-dc&template=heistVaultNight&main=LOCKED%20UP&sub=%40mingl.don&screen=led-64x32&preview=1&v=${v}`],
    ["Police Car Arrest", `${base}/display.html?location=heist-washington-dc&template=heistPoliceCar&main=IN%20CUSTODY&screen=led-64x32&preview=1&v=${v}`],
    ["I Aint No Snitch — with name", `${base}/display.html?location=heist-washington-dc&template=heistInterrogation&main=NO%20COMMENT&sub=Don&screen=led-64x32&preview=1&v=${v}`],
    ["Tengo muchos dólares (Vault Night)", `${base}/display.html?location=heist-washington-dc&template=heistVaultDollars&main=TENGO%20MUCHO&screen=led-64x32&preview=1&v=${v}`],
    ["Heist preview gallery", `${base}/heist-frame-preview.html?v=${v}`],
    ["Shôko Club Admin", `${base}/admin.html?location=shoko-barcelona-beach-club-spain&v=${v}`],
    ["Master Admin diagnostics", `${base}/master-admin.html?v=${v}`]
  ];
}

function normalizePreviewLinks(raw = [], fallbackVersion = "29.09.40") {
  if (!Array.isArray(raw) || !raw.length) return defaultFloqrPreviewLinks(fallbackVersion);
  return raw.slice(0, 40).map((row) => {
    if (Array.isArray(row)) return [String(row[0] || "Link").slice(0, 160), String(row[1] || "").slice(0, 500)];
    return [String(row?.label || row?.title || "Link").slice(0, 160), String(row?.url || row?.href || "").slice(0, 500)];
  }).filter((row) => row[0] && row[1]);
}

function buildPreviewLinksEmail({packageVersion = "29.09.40", links = [], note = ""} = {}) {
  const v = String(packageVersion || "29.09.40").replace(/^v/i, "");
  const rows = normalizePreviewLinks(links, v);
  const subject = `FLOQR v${v} — mobile preview links`;
  const intro = String(note || "").trim();
  const textBody = [
    subject,
    "",
    intro ? `${intro}\n` : "",
    "Open these on your phone. Admin/portal URLs include ?v= for cache-bust. Display board URLs stay stable (no version query).",
    "",
    ...rows.map(([label, url], i) => `${i + 1}. ${label}\n   ${url}`),
    "",
    "— FLOQR emailFloqrPreviewLinks"
  ].join("\n");
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;line-height:1.45;color:#111;max-width:680px">
      <h2 style="margin:0 0 8px">${subject}</h2>
      ${intro ? `<p style="margin:0 0 12px">${intro.replace(/</g, "&lt;")}</p>` : ""}
      <p style="margin:0 0 14px">Open on your phone. <strong>Admin/portal</strong> links use <code>?v=</code> for cache-bust. <strong>Display board</strong> links stay stable (no version query) for LED devices and external embeds.</p>
      <ul style="margin:0;padding-left:18px">
        ${rows.map(([label, url]) => `<li style="margin:0 0 10px"><a href="${url}">${label.replace(/</g, "&lt;")}</a><br/><span style="color:#555;font-size:12px;word-break:break-all">${url}</span></li>`).join("")}
      </ul>
      <p style="color:#666;font-size:12px;margin-top:16px">Sent by FLOQR emailFloqrPreviewLinks</p>
    </div>`;
  return {subject, textBody, htmlBody, links: rows, packageVersion: v};
}

/** Email current-iteration preview links for iPhone / mobile testing (SendGrid). */
exports.emailFloqrPreviewLinks = onRequest({
  region: "us-central1",
  secrets: [SENDGRID_API_KEY],
  timeoutSeconds: 30,
  memory: "256MiB",
  cors: true
}, async (req, res) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const query = req.query || {};
    const toEmail = String(body.to || query.to || PREVIEW_LINKS_DEFAULT_TO).trim().toLowerCase();
    const packageVersion = String(body.package || body.v || query.package || query.v || "29.09.34").trim();
    const note = String(body.note || query.note || "").trim();
    const links = Array.isArray(body.links) ? body.links : [];
    const mail = buildPreviewLinksEmail({packageVersion, links, note});
    const status = await sendgridMail({
      to: toEmail,
      from: PREVIEW_LINKS_DEFAULT_FROM,
      subject: mail.subject,
      textBody: mail.textBody,
      htmlBody: mail.htmlBody
    });
    res.status(200).json({ok: true, to: toEmail, from: PREVIEW_LINKS_DEFAULT_FROM, subject: mail.subject, links: mail.links.length, package: mail.packageVersion, status});
  } catch (error) {
    const code = error?.code === "missing-key" ? 500 : (error?.status ? 502 : 500);
    res.status(code).json({ok: false, error: error?.message || String(error)});
  }
});

/** Callable: Master Admin emails preview links (defaults to signed-in email). */
exports.sendFloqrPreviewLinksEmail = onCall({
  region: "us-central1",
  secrets: [SENDGRID_API_KEY],
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const email = String(request.auth.token?.email || "").trim().toLowerCase();
  if (!MASTER_ADMIN_EMAILS.includes(email) && request.auth.token?.masterAdmin !== true) {
    throw new HttpsError("permission-denied", "Master Admin access is required.");
  }
  const data = request.data || {};
  const toEmail = String(data.to || email || PREVIEW_LINKS_DEFAULT_TO).trim().toLowerCase();
  const packageVersion = String(data.package || data.v || "29.09.34").trim();
  const note = String(data.note || "").trim();
  const links = Array.isArray(data.links) ? data.links : [];
  const mail = buildPreviewLinksEmail({packageVersion, links, note});
  const status = await sendgridMail({
    to: toEmail,
    from: PREVIEW_LINKS_DEFAULT_FROM,
    subject: mail.subject,
    textBody: mail.textBody,
    htmlBody: mail.htmlBody
  });
  return {ok: true, to: toEmail, subject: mail.subject, links: mail.links.length, package: mail.packageVersion, status};
});
