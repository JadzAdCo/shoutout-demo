/**
 * Recrawl incomplete aiDiscoveryQueue rows with the new website contact enricher.
 * Usage (from functions/): node scripts/recrawl-incomplete-discovery-contacts.js [--limit=60] [--write]
 */
const admin = require("firebase-admin");
const venueDatapoints = require("../venue-datapoint-extract");

if (!admin.apps.length) admin.initializeApp({projectId: "shoutoutdemo-5b402"});
const db = admin.firestore();

const args = process.argv.slice(2);
const limit = Number((args.find(a => a.startsWith("--limit=")) || "--limit=60").split("=")[1]) || 60;
const doWrite = args.includes("--write");
const MAX_SOURCE_BYTES = 750000;

function contactScore(row = {}) {
  const socials = row.socialMediaHandles || {};
  return {
    phone: !!(row.telephone || row.phone),
    email: !!row.email,
    instagram: !!(socials.instagram || row.instagramHandle),
    facebook: !!socials.facebook
  };
}

function contactComplete(score) {
  return !!(score.phone && score.email && score.instagram);
}

function missingContact(row = {}) {
  const score = contactScore(row);
  const missing = [];
  if (!score.phone) missing.push("Phone");
  if (!score.email) missing.push("Email");
  if (!score.instagram) missing.push("Instagram");
  return missing;
}

async function fetchHtml(sourceUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "FLOQR public discovery bot/1.0 (+https://floqr.com)",
        accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.text()).slice(0, MAX_SOURCE_BYTES);
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html = "") {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

async function enrichLikeProduction(record = {}) {
  const site = String(record.officialWebsite || record.website || "").trim();
  if (!/^https?:\/\//i.test(site) || /google\.(com|maps)|maps\.app\.goo\.gl/i.test(site)) {
    // Still stamp handles when Places stored Instagram/Facebook as the "website".
    const fromUrl = venueDatapoints.socialHandlesFromWebsiteUrl(site);
    if (fromUrl.instagram || fromUrl.facebook) {
      return {
        ...record,
        socialMediaHandles: {
          ...(record.socialMediaHandles || {}),
          instagram: record.socialMediaHandles?.instagram || fromUrl.instagram,
          facebook: record.socialMediaHandles?.facebook || fromUrl.facebook,
          x: record.socialMediaHandles?.x || fromUrl.x,
          tiktok: record.socialMediaHandles?.tiktok || fromUrl.tiktok
        }
      };
    }
    return record;
  }
  let next = {...record};
  const pagesFetched = [];
  const html = await fetchHtml(site);
  pagesFetched.push(site);
  next = venueDatapoints.enrichVenueRecord(next, {html, text: stripTags(html)});
  const venueContext = {
    venueName: next.proposedTitle || next.proposedLocationName || "",
    website: site
  };
  const brandUrls = (venueDatapoints.listOfficialBrandUrls?.(html, site, venueContext) || []);
  const needsMore = !(next.socialMediaHandles?.instagram && (next.email || next.telephone || next.phone))
    || venueDatapoints.isAggregatorWebsite?.(site)
    || /privateaser|opentable|thefork/i.test(String(next.socialMediaHandles?.facebook || next.email || ""));
  const follow = [...brandUrls];
  if (needsMore) {
    (venueDatapoints.listSocialSecondaryUrls(html, site, venueContext) || []).forEach(url => {
      if (!follow.includes(url)) follow.push(url);
    });
  }
  for (const url of follow.slice(0, 6)) {
    if (pagesFetched.includes(url)) continue;
    try {
      const html2 = await fetchHtml(url);
      pagesFetched.push(url);
      next = venueDatapoints.enrichVenueRecord(next, {html: html2, text: stripTags(html2)});
      if (venueDatapoints.isAggregatorWebsite?.(site) && !venueDatapoints.isAggregatorWebsite?.(url)) {
        next.officialWebsite = url.split("#")[0];
        next.website = next.officialWebsite;
      }
      const aggregatorish = /privateaser|opentable|thefork/i.test(String(next.socialMediaHandles?.facebook || next.email || ""));
      if (next.socialMediaHandles?.instagram && next.email && (next.telephone || next.phone) && !aggregatorish) break;
    } catch (_e) {
      /* skip dead secondary */
    }
  }
  next.socialPagesFetched = pagesFetched;
  next.extractionMethod = `${record.extractionMethod || "public-page"}+contact-recrawl`;
  return next;
}

function approvalMissing(row = {}) {
  // Mirror functions/ai-discovery-functions missingDatapoints contact+identity subset used for review readiness.
  const missing = [];
  if (!row.proposedTitle && !row.proposedLocationName) missing.push("Name");
  if (!(row.genres || []).length) missing.push("Genre");
  const artists = row.artistsOrDjs || row.artists || row.djs;
  if (!(Array.isArray(artists) ? artists.length : String(artists || "").trim()) || String(artists?.[0] || "").toLowerCase() === "places hours") missing.push("DJ(s)/Artist(s)");
  const promoters = row.promoters || row.promotionGroup;
  if (!(Array.isArray(promoters) ? promoters.length : String(promoters || "").trim())) missing.push("Promoter(s)");
  if (!row.proposedAddress) missing.push("Address");
  if (!row.city) missing.push("City");
  if (!row.country) missing.push("Country");
  missing.push(...missingContact(row));
  return [...new Set(missing)];
}

async function main() {
  const snap = await db.collection("aiDiscoveryQueue")
    .where("status", "in", ["pendingReview", "needsResearch"])
    .orderBy("createdAt", "desc")
    .limit(Math.max(limit * 4, 120))
    .get()
    .catch(async () => db.collection("aiDiscoveryQueue").limit(Math.max(limit * 4, 120)).get());

  const candidates = snap.docs
    .map(doc => ({id: doc.id, ...doc.data()}))
    .filter(row => {
      const status = String(row.status || "pendingReview");
      if (!["pendingReview", "needsResearch"].includes(status)) return false;
      return missingContact(row).length > 0;
    })
    .slice(0, limit);

  const stats = {
    sampled: candidates.length,
    hadWebsite: 0,
    beforeContactComplete: 0,
    afterContactComplete: 0,
    gainedPhone: 0,
    gainedEmail: 0,
    gainedInstagram: 0,
    gainedFacebook: 0,
    wrote: 0,
    errors: 0,
    examples: []
  };

  for (const row of candidates) {
    const before = contactScore(row);
    if (contactComplete(before)) stats.beforeContactComplete += 1;
    const site = String(row.officialWebsite || row.website || "").trim();
    const usableSite = /^https?:\/\//i.test(site);
    if (usableSite) stats.hadWebsite += 1;
    try {
      const enriched = await enrichLikeProduction(row);
      const after = contactScore(enriched);
      if (contactComplete(after)) stats.afterContactComplete += 1;
      if (!before.phone && after.phone) stats.gainedPhone += 1;
      if (!before.email && after.email) stats.gainedEmail += 1;
      if (!before.instagram && after.instagram) stats.gainedInstagram += 1;
      if (!before.facebook && after.facebook) stats.gainedFacebook += 1;

      const missing = approvalMissing(enriched);
      const patch = {
        socialMediaHandles: {
          instagram: enriched.socialMediaHandles?.instagram || "",
          facebook: enriched.socialMediaHandles?.facebook || "",
          x: enriched.socialMediaHandles?.x || "",
          tiktok: enriched.socialMediaHandles?.tiktok || "",
          floqrHandle: enriched.socialMediaHandles?.floqrHandle || ""
        },
        email: enriched.email || row.email || "",
        telephone: enriched.telephone || enriched.phone || row.telephone || row.phone || "",
        phone: enriched.telephone || enriched.phone || row.telephone || row.phone || "",
        socialPagesFetched: enriched.socialPagesFetched || [],
        extractionMethod: enriched.extractionMethod || row.extractionMethod || "",
        missingDatapoints: missing,
        crawlResultStatus: missing.length ? "missing-required-datapoints" : "ready-for-approval",
        contactRecrawledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (stats.examples.length < 8) {
        stats.examples.push({
          id: row.id,
          title: row.proposedTitle || row.proposedLocationName,
          site,
          before,
          after: {
            phone: after.phone,
            email: after.email,
            instagram: after.instagram,
            facebook: after.facebook,
            values: {
              telephone: patch.telephone,
              email: patch.email,
              instagram: patch.socialMediaHandles.instagram,
              facebook: patch.socialMediaHandles.facebook
            }
          }
        });
      }

      if (doWrite && (after.phone || after.email || after.instagram || after.facebook)) {
        await db.collection("aiDiscoveryQueue").doc(row.id).set(patch, {merge: true});
        stats.wrote += 1;
      }
    } catch (error) {
      stats.errors += 1;
      if (stats.examples.length < 8) {
        stats.examples.push({id: row.id, title: row.proposedTitle, error: String(error.message || error)});
      }
    }
  }

  const beforePct = stats.sampled ? Math.round((stats.beforeContactComplete / stats.sampled) * 1000) / 10 : 0;
  const afterPct = stats.sampled ? Math.round((stats.afterContactComplete / stats.sampled) * 1000) / 10 : 0;
  const report = {
    mode: doWrite ? "write" : "dry-run",
    limit,
    ...stats,
    contactCompleteBeforePct: beforePct,
    contactCompleteAfterPct: afterPct,
    liftPctPoints: Math.round((afterPct - beforePct) * 10) / 10,
    note: "Contact-complete = Phone + Email + Instagram. DJ/Promoter are not filled by website enrich."
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
