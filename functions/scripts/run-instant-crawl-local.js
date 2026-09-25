/**
 * Run an instant discovery crawl locally (Admin SDK + Places secret).
 * Usage (from functions/):
 *   $env:GOOGLE_PLACES_API_KEY = (firebase functions:secrets:access GOOGLE_PLACES_API_KEY --project shoutoutdemo-5b402)
 *   node scripts/run-instant-crawl-local.js [--jobs=8] [--write]
 */
const admin = require("firebase-admin");
const path = require("path");

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "shoutoutdemo-5b402" });
}
const db = admin.firestore();

// Ensure Places key is visible to ai-discovery optionalPlacesKey via env.
if (!process.env.GOOGLE_PLACES_API_KEY) {
  console.error("Set GOOGLE_PLACES_API_KEY first (firebase functions:secrets:access GOOGLE_PLACES_API_KEY).");
  process.exit(1);
}

// Load discovery module after env is set. Secrets wrappers may still need defineSecret
// mock — so this script reimplements a thin Places+enrich path using the extractors.
const venueDatapoints = require("../venue-datapoint-extract");

const args = process.argv.slice(2);
const jobLimit = Number((args.find(a => a.startsWith("--jobs=")) || "--jobs=8").split("=")[1]) || 8;
const doWrite = args.includes("--write");

function contactSnap(record = {}) {
  const socials = record.socialMediaHandles || {};
  return {
    phone: !!(record.telephone || record.phone),
    email: !!String(record.email || "").trim(),
    instagram: !!(socials.instagram || record.instagramHandle),
    facebook: !!String(socials.facebook || "").trim()
  };
}

function isComplete(s) {
  return !!(s.phone && s.email && s.instagram);
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "FLOQR public discovery bot/1.0", Accept: "text/html" },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function stripTags(html = "") {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

async function enrichLikeProduction(record) {
  const site = String(record.officialWebsite || record.website || "").trim();
  let next = { ...record };
  if (!/^https?:\/\//i.test(site) || /google\.(com|maps)|maps\.app\.goo\.gl/i.test(site)) {
    const fromUrl = venueDatapoints.socialHandlesFromWebsiteUrl(site);
    if (fromUrl.instagram || fromUrl.facebook) {
      next.socialMediaHandles = {
        ...(next.socialMediaHandles || {}),
        instagram: next.socialMediaHandles?.instagram || fromUrl.instagram,
        facebook: next.socialMediaHandles?.facebook || fromUrl.facebook
      };
    }
    return next;
  }
  const html = await fetchHtml(site);
  next = venueDatapoints.enrichVenueRecord(next, { html, text: stripTags(html) });
  const ctx = { venueName: next.proposedTitle || next.proposedLocationName || "", website: site };
  const brandUrls = venueDatapoints.listOfficialBrandUrls?.(html, site, ctx) || [];
  const follow = [...brandUrls];
  (venueDatapoints.listSocialSecondaryUrls(html, site, ctx) || []).forEach(url => {
    if (!follow.includes(url)) follow.push(url);
  });
  const pages = [site];
  for (const url of follow.slice(0, 6)) {
    if (pages.includes(url)) continue;
    try {
      const html2 = await fetchHtml(url);
      pages.push(url);
      next = venueDatapoints.enrichVenueRecord(next, { html: html2, text: stripTags(html2) });
      if (venueDatapoints.isAggregatorWebsite?.(site) && !venueDatapoints.isAggregatorWebsite?.(url)) {
        next.officialWebsite = url.split("#")[0];
        next.website = next.officialWebsite;
      }
      const aggregatorish = /privateaser|opentable|thefork/i.test(String(next.socialMediaHandles?.facebook || next.email || ""));
      if (next.socialMediaHandles?.instagram && next.email && (next.telephone || next.phone) && !aggregatorish) break;
    } catch (_e) { /* skip */ }
  }
  next.socialPagesFetched = pages;
  return next;
}

async function searchPlaces(job, apiKey) {
  const textQuery = job.query || `${job.genre || "nightlife"} ${job.eventType || "nightclub"} ${job.city || ""} ${job.country || ""}`.trim();
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryType,places.types,places.regularOpeningHours,places.editorialSummary,places.rating,places.userRatingCount,places.businessStatus"
    },
    body: JSON.stringify({
      textQuery,
      languageCode: job.languageCode || "en",
      pageSize: 8
    }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Places HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.places) ? data.places : [];
}

const FALLBACK_JOBS = [
  { query: "hip hop nightclub Madrid Spain", city: "Madrid", country: "Spain", genre: "Hip Hop", eventType: "nightclub", languageCode: "es" },
  { query: "hip hop club Barcelona Spain", city: "Barcelona", country: "Spain", genre: "Hip Hop", eventType: "nightclub", languageCode: "es" },
  { query: "hip hop concert Berlin Germany", city: "Berlin", country: "Germany", genre: "Hip Hop", eventType: "concert", languageCode: "de" },
  { query: "hip hop nightclub Munich Germany", city: "Munich", country: "Germany", genre: "Hip Hop", eventType: "nightclub", languageCode: "de" },
  { query: "lounge hip hop Madrid Spain", city: "Madrid", country: "Spain", genre: "Hip Hop", eventType: "lounge", languageCode: "es" },
  { query: "nightclub Hamburg Germany hip hop", city: "Hamburg", country: "Germany", genre: "Hip Hop", eventType: "nightclub", languageCode: "de" },
  { query: "club Valencia Spain hip hop", city: "Valencia", country: "Spain", genre: "Hip Hop", eventType: "nightclub", languageCode: "es" },
  { query: "nightclub Cologne Germany concert", city: "Cologne", country: "Germany", genre: "Hip Hop", eventType: "concert", languageCode: "de" }
];

async function loadJobs() {
  try {
    const scheduleSnap = await db.collection("aiCrawlerSchedules").doc("default").get();
    const schedule = scheduleSnap.exists ? scheduleSnap.data() || {} : {};
    const fromSchedule = (schedule.criteria?.structuredPlan?.jobs || []).slice(0, jobLimit);
    if (fromSchedule.length) return { jobs: fromSchedule, source: "aiCrawlerSchedules/default" };
  } catch (err) {
    console.warn("Firestore schedule unavailable:", err.message || err);
  }
  return { jobs: FALLBACK_JOBS.slice(0, jobLimit), source: "fallback-spain-germany-hiphop" };
}

(async () => {
  const loaded = await loadJobs();
  const jobs = loaded.jobs;
  if (!jobs.length) {
    console.error("No crawl jobs available");
    process.exit(1);
  }
  console.log(`Instant crawl local: ${jobs.length} jobs from ${loaded.source}, write=${doWrite}`);

  const liftRows = [];
  const created = [];
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const seen = new Set();

  for (const job of jobs) {
    let places = [];
    try {
      places = await searchPlaces(job, apiKey);
    } catch (e) {
      console.warn(`Job skipped (${job.query || job.city}):`, e.message);
      continue;
    }
    for (const place of places) {
      const title = place.displayName?.text || "";
      const key = `${title}|${place.formattedAddress || ""}|${place.internationalPhoneNumber || place.nationalPhoneNumber || ""}`.toLowerCase();
      if (!title || seen.has(key)) continue;
      seen.add(key);
      let record = {
        proposedType: /concert|event/i.test(job.eventType || "") ? "event" : "club",
        proposedTitle: title,
        proposedLocationName: title,
        proposedAddress: place.formattedAddress || "",
        city: job.city || "",
        country: job.country || "",
        telephone: place.internationalPhoneNumber || place.nationalPhoneNumber || "",
        phone: place.internationalPhoneNumber || place.nationalPhoneNumber || "",
        officialWebsite: place.websiteUri || place.googleMapsUri || "",
        website: place.websiteUri || place.googleMapsUri || "",
        email: "",
        socialMediaHandles: { instagram: "", facebook: "", x: "", tiktok: "", floqrHandle: "" },
        genres: job.genre ? [job.genre] : [],
        searchQuery: job.query || "",
        discoveryMode: "instant-discovery-crawl-local",
        extractionMethod: "google-places-text-search+instant-local",
        sourceName: "Google Places API",
        status: "pendingReview"
      };
      const before = contactSnap(record);
      try {
        record = await enrichLikeProduction(record);
      } catch (e) {
        console.warn(`Enrich skipped (${title}):`, e.message);
      }
      const after = contactSnap(record);
      liftRows.push({ before, after, title, site: record.officialWebsite || "" });
      created.push(record);
    }
  }

  const n = liftRows.length;
  const beforeComplete = liftRows.filter(r => isComplete(r.before)).length;
  const afterComplete = liftRows.filter(r => isComplete(r.after)).length;
  const pct = v => (n ? Math.round((v / n) * 1000) / 10 : 0);

  function missingOnboard(record = {}) {
    const missing = [];
    if (!record.proposedTitle && !record.proposedLocationName) missing.push("Name");
    if (!(record.genres || []).length) missing.push("Genre");
    const artists = record.artistsOrDjs || record.artists || record.djs;
    if (!(Array.isArray(artists) ? artists.length : String(artists || "").trim())) missing.push("DJ(s)/Artist(s)");
    const promoters = record.promoters || record.promotionGroup;
    if (!(Array.isArray(promoters) ? promoters.length : String(promoters || "").trim())) missing.push("Promoter(s)");
    if (!(record.proposedAddress || record.address)) missing.push("Address");
    if (!record.city) missing.push("City");
    if (!record.country) missing.push("Country");
    if (!(record.telephone || record.phone)) missing.push("Phone");
    if (!record.email) missing.push("Email");
    if (!(record.socialMediaHandles?.instagram || record.instagramHandle)) missing.push("Instagram");
    return missing;
  }

  const completedAt = new Date().toISOString();
  const rows = created.map((record, i) => {
    const missing = missingOnboard(record);
    return {
      name: record.proposedTitle || record.proposedLocationName || "",
      type: record.proposedType || "club",
      country: record.country || "",
      city: record.city || "",
      genre: Array.isArray(record.genres) ? record.genres.join(", ") : String(record.genres || ""),
      phone: !!(record.telephone || record.phone),
      email: !!String(record.email || "").trim(),
      instagram: !!(record.socialMediaHandles?.instagram || record.instagramHandle),
      address: !!(record.proposedAddress || record.address),
      website: record.officialWebsite || record.website || "",
      onboardReady: missing.length === 0,
      missingDatapoints: missing,
      contactLift: liftRows[i] || null
    };
  });
  const readyCount = rows.filter(r => r.onboardReady).length;
  const missingFreq = {};
  rows.forEach(r => r.missingDatapoints.forEach(m => { missingFreq[m] = (missingFreq[m] || 0) + 1; }));
  const report = {
    crawlCompletedAt: completedAt,
    sampled: n,
    jobsAttempted: jobs.length,
    jobSource: loaded.source,
    contactCompleteBeforePct: pct(beforeComplete),
    contactCompleteAfterPct: pct(afterComplete),
    liftPctPoints: pct(afterComplete - beforeComplete),
    gained: {
      phone: liftRows.filter(r => !r.before.phone && r.after.phone).length,
      email: liftRows.filter(r => !r.before.email && r.after.email).length,
      instagram: liftRows.filter(r => !r.before.instagram && r.after.instagram).length,
      facebook: liftRows.filter(r => !r.before.facebook && r.after.facebook).length
    },
    onboardReadyCount: readyCount,
    onboardReadyPct: pct(readyCount),
    missingDatapointFrequency: missingFreq,
    baselines: {
      previousEngineContactCompletePct: 0,
      enrichV1ContactCompletePct: 37.8
    },
    rows: rows.sort((a, b) =>
      String(a.country).localeCompare(b.country) ||
      String(a.city).localeCompare(b.city) ||
      String(a.genre).localeCompare(b.genre) ||
      String(a.name).localeCompare(b.name)
    ),
    note: "Contact-complete = Phone + Email + Instagram. Onboard-ready = Name, Genre, DJ(s)/Artist(s), Promoter(s), Address, City, Country, Phone, Email, Instagram."
  };

  if (doWrite) {
    try {
      const runRef = db.collection("aiCrawlRuns").doc();
      await runRef.set({
        trigger: "instant-local",
        mode: "instant-discovery-crawl",
        status: "completed",
        createdRecordCount: created.length,
        resultCount: created.length,
        jobsAttempted: jobs.length,
        contactStats: {
          sampled: report.sampled,
          contactCompleteBeforePct: report.contactCompleteBeforePct,
          contactCompleteAfterPct: report.contactCompleteAfterPct,
          liftPctPoints: report.liftPctPoints,
          gained: report.gained,
          note: report.note
        },
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      for (const record of created) {
        await db.collection("aiDiscoveryQueue").add({
          ...record,
          crawlRunId: runRef.id,
          collectedAtIso: new Date().toISOString(),
          collectedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      report.runId = runRef.id;
      report.wrote = created.length;
    } catch (err) {
      report.writeError = String(err.message || err);
      console.warn("Firestore write skipped:", report.writeError);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  try {
    const fs = require("fs");
    const outPath = path.join(__dirname, "..", "..", "reports", "instant-crawl-onboard-report.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    console.error(`Wrote ${outPath}`);
  } catch (err) {
    console.warn("Could not write report file:", err.message || err);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
