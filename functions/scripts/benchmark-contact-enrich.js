/**
 * Local contact-enrich benchmark (no Admin SDK). Reads a JSON list of queue rows
 * from stdin or --file, fetches websites, prints before/after contact stats.
 * Optional --out=patch.json for fields to write back.
 */
const fs = require("fs");
const venueDatapoints = require("../venue-datapoint-extract");

const args = process.argv.slice(2);
const file = (args.find(a => a.startsWith("--file=")) || "").split("=")[1];
const outFile = (args.find(a => a.startsWith("--out=")) || "").split("=")[1];
const max = Number((args.find(a => a.startsWith("--limit=")) || "--limit=40").split("=")[1]) || 40;

const rows = JSON.parse(fs.readFileSync(file || 0, "utf8")).slice(0, max);

function contactScore(row = {}) {
  const socials = row.socialMediaHandles || {};
  return {
    phone: !!(row.telephone || row.phone),
    email: !!row.email,
    instagram: !!(socials.instagram || row.instagramHandle),
    facebook: !!socials.facebook
  };
}
function complete(s) { return !!(s.phone && s.email && s.instagram); }
function stripTags(html = "") {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}
async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {"user-agent": "FLOQR public discovery bot/1.0", accept: "text/html"},
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.text()).slice(0, 750000);
  } finally { clearTimeout(timer); }
}

async function enrich(record) {
  const site = String(record.officialWebsite || record.website || "").trim();
  const fromUrl = venueDatapoints.socialHandlesFromWebsiteUrl(site);
  let next = {
    ...record,
    socialMediaHandles: {
      ...(record.socialMediaHandles || {}),
      instagram: record.socialMediaHandles?.instagram || fromUrl.instagram || "",
      facebook: record.socialMediaHandles?.facebook || fromUrl.facebook || "",
      x: record.socialMediaHandles?.x || fromUrl.x || "",
      tiktok: record.socialMediaHandles?.tiktok || fromUrl.tiktok || ""
    }
  };
  if (!/^https?:\/\//i.test(site) || /google\.(com|maps)|maps\.app\.goo\.gl/i.test(site)) return next;
  const pages = [];
  const html = await fetchHtml(site);
  pages.push(site);
  next = venueDatapoints.enrichVenueRecord(next, {html, text: stripTags(html)});
  if (!(next.socialMediaHandles?.instagram && next.email)) {
    const secondaries = venueDatapoints.listSocialSecondaryUrls(html, site, {
      venueName: next.proposedTitle || next.proposedLocationName || "",
      website: site
    }).slice(0, 4);
    for (const url of secondaries) {
      if (pages.includes(url)) continue;
      try {
        const html2 = await fetchHtml(url);
        pages.push(url);
        next = venueDatapoints.enrichVenueRecord(next, {html: html2, text: stripTags(html2)});
        if (next.socialMediaHandles?.instagram && next.email) break;
      } catch (_e) {}
    }
  }
  next.socialPagesFetched = pages;
  return next;
}

(async () => {
  const patches = [];
  const stats = {
    sampled: rows.length,
    beforeComplete: 0,
    afterComplete: 0,
    gainedPhone: 0,
    gainedEmail: 0,
    gainedInstagram: 0,
    gainedFacebook: 0,
    errors: 0,
    examples: []
  };
  for (const row of rows) {
    const before = contactScore(row);
    if (complete(before)) stats.beforeComplete += 1;
    try {
      const enriched = await enrich(row);
      const after = contactScore(enriched);
      if (complete(after)) stats.afterComplete += 1;
      if (!before.phone && after.phone) stats.gainedPhone += 1;
      if (!before.email && after.email) stats.gainedEmail += 1;
      if (!before.instagram && after.instagram) stats.gainedInstagram += 1;
      if (!before.facebook && after.facebook) stats.gainedFacebook += 1;
      const patch = {
        id: row.id,
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
        socialPagesFetched: enriched.socialPagesFetched || []
      };
      patches.push(patch);
      if (stats.examples.length < 10) {
        stats.examples.push({
          title: row.proposedTitle,
          site: row.officialWebsite || row.website,
          before,
          after,
          values: {email: patch.email, telephone: patch.telephone, ig: patch.socialMediaHandles.instagram, fb: patch.socialMediaHandles.facebook}
        });
      }
    } catch (e) {
      stats.errors += 1;
    }
  }
  const beforePct = rows.length ? Math.round((stats.beforeComplete / rows.length) * 1000) / 10 : 0;
  const afterPct = rows.length ? Math.round((stats.afterComplete / rows.length) * 1000) / 10 : 0;
  const report = {
    ...stats,
    contactCompleteBeforePct: beforePct,
    contactCompleteAfterPct: afterPct,
    liftPctPoints: Math.round((afterPct - beforePct) * 10) / 10,
    note: "Contact-complete = Phone + Email + Instagram"
  };
  console.log(JSON.stringify(report, null, 2));
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(patches, null, 2));
})();
