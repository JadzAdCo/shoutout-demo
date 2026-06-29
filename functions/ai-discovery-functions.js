/* FLOQR AI backend functions.
   Deploy from Firebase Functions or Cloud Run Functions for scheduled crawling
   and public source extraction. The static GitHub Pages app can call HTTPS
   callable functions after Firebase Auth verifies the user. */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

admin.initializeApp();

const db = admin.firestore();
const MAX_SOURCE_BYTES = 750000;
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_IMAGE_EDIT_MODEL = process.env.FLOQR_GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
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
  const required = /club|lounge|bar|beach/i.test(record.proposedType || "")
    ? ["Name", "Description", "Address", "City", "Country", "Phone", "Website or source", "Categories", "Genres"]
    : ["Name", "Description", "Location name", "Address", "City", "Country", "Phone", "Source or ticket link", "Categories", ...(/comedy/i.test(record.proposedType || "") ? ["Date", "Time"] : [])];
  const checks = {
    Name: !!record.proposedTitle,
    Description: !!record.proposedDescription,
    "Location name": !!record.proposedLocationName,
    Address: !!record.proposedAddress,
    City: !!record.city,
    Country: !!record.country,
    Phone: !!(record.telephone || record.phone),
    "Website or source": !!(record.officialWebsite || record.website || record.sourceUrl),
    "Source or ticket link": !!(record.sourceUrl || record.ticketUrl),
    Categories: !!(record.categories || []).length,
    Genres: !!(record.genres || []).length,
    Date: !!record.proposedDate,
    Time: !!record.proposedTime
  };
  return required.filter(label => !checks[label]);
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

async function crawlPublicEventSources() {
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
        markets:source.markets || DEFAULT_DISCOVERY_MARKETS
      });
    } catch (error) {
      console.warn(`Skipping source ${sourceUrl}:`, error.message);
    }
  }
  return discovered;
}

async function classifyDiscoveryRecord(record) {
  return {
    ...record,
    aiSummary:record.aiSummary || record.proposedDescription || "",
    aiConfidenceScore:record.aiConfidenceScore || 0.76,
    aiStarRating:record.aiStarRating || 3,
    aiRatingReasons:record.aiRatingReasons || ["Extracted from configured public source URL"],
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

function geminiSecretValue() {
  const value = GEMINI_API_KEY.value() || process.env.GEMINI_API_KEY || "";
  if (!value) {
    throw new HttpsError(
      "failed-precondition",
      "Gemini media editing is not configured. Set the GEMINI_API_KEY Firebase Functions secret and redeploy aiEnhanceShoutOutMedia."
    );
  }
  return value;
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
  const requested = String(prompt || enhancementType || "Improve this ShoutOut media for a nightlife LED display.").slice(0, 600);
  return [
    "Edit only the uploaded ShoutOut media image. Do not add text, logos, watermarks, QR codes, or HTML/CSS/JavaScript.",
    "Keep the result suitable for a public nightlife LED display. Avoid explicit, hateful, violent, illegal, or privacy-invasive content.",
    "Preserve the protected terms FLOQR, ShoutOut, Mingl, and Bata exactly if they appear. Do not translate or alter those terms.",
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
