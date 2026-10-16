const fs = require("fs");
const path = require("path");
const {
  extractSocialHandles,
  listSocialSecondaryUrls,
  enrichVenueRecord,
  extractEmail,
  extractPhone
} = require("../functions/venue-datapoint-extract");

function oldExtractSocialHandles(textOrHtml = "") {
  const raw = String(textOrHtml || "");
  const collect = (re) => {
    const out = [];
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let match;
    while ((match = global.exec(raw)) !== null) {
      out.push(String(match[1] || "").replace(/\/$/, ""));
      if (out.length >= 24) break;
    }
    return out;
  };
  const hrefs = collect(/href\s*=\s*["']([^"']+)["']/i);
  const pick = (candidates, rejectRe) => {
    for (const candidate of candidates) {
      const value = String(candidate || "").replace(/^@/, "");
      if (!value || (rejectRe && rejectRe.test(value))) continue;
      return value;
    }
    return "";
  };
  const ig = pick([
    ...collect(/instagram\.com\/([A-Za-z0-9._]+)/i),
    ...hrefs.map(h => (h.match(/instagram\.com\/([A-Za-z0-9._]+)/i) || [])[1]).filter(Boolean)
  ], /^(?:reel|p|stories|explore|share|accounts|about|legal|directory)$/i);
  const fb = pick([
    ...collect(/facebook\.com\/([A-Za-z0-9.]+)/i),
    ...hrefs.map(h => (h.match(/facebook\.com\/([A-Za-z0-9.]+)/i) || [])[1]).filter(Boolean)
  ], /^(?:sharer|share|dialog|plugins|pages|watch|events|groups|login|help|privacy|policies)$/i);
  return {
    instagram: ig ? `@${ig}` : "",
    facebook: fb || "",
    email: (raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0],
    telephone: (raw.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/) || [""])[0]
  };
}

function requiredContactHits(rec) {
  const socials = rec.socialMediaHandles || {};
  return {
    instagram: !!socials.instagram,
    facebook: !!socials.facebook,
    email: !!rec.email,
    telephone: !!(rec.telephone || rec.phone),
    website: !!(rec.officialWebsite || rec.website)
  };
}

const files = [
  {
    name: "Buddha-Bar Monte-Carlo (SBM)",
    file: "buddha-bar.html",
    url: "https://www.montecarlosbm.com/fr/restaurant-monaco/buddha-bar-monte-carlo",
    title: "Buddha-Bar Monte-Carlo"
  }
];

for (const item of files) {
  const htmlPath = path.join(__dirname, "..", item.file);
  if (!fs.existsSync(htmlPath)) {
    console.log(JSON.stringify({name: item.name, error: "missing html"}));
    continue;
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  const old = oldExtractSocialHandles(html);
  const enriched = enrichVenueRecord({
    proposedTitle: item.title,
    officialWebsite: item.url
  }, {html, text: html.replace(/<[^>]+>/g, " ")});
  const secondaries = listSocialSecondaryUrls(html, item.url);
  const hits = requiredContactHits(enriched);
  const oldHits = {
    instagram: !!old.instagram,
    facebook: !!old.facebook,
    email: !!old.email && !/example|schema|wixpress/i.test(old.email),
    telephone: !!old.telephone
  };
  console.log(JSON.stringify({
    name: item.name,
    htmlBytes: html.length,
    old: oldHits,
    oldValues: old,
    neu: hits,
    neuValues: {
      instagram: enriched.socialMediaHandles?.instagram,
      facebook: enriched.socialMediaHandles?.facebook,
      x: enriched.socialMediaHandles?.x,
      tiktok: enriched.socialMediaHandles?.tiktok,
      email: enriched.email,
      telephone: enriched.telephone
    },
    secondaries: secondaries.slice(0, 6),
    igMatches: [...new Set([...html.matchAll(/instagram\.com\/([A-Za-z0-9._]+)/gi)].map(m => m[1]))].slice(0, 12),
    fbMatches: [...new Set([...html.matchAll(/facebook\.com\/([A-Za-z0-9.]+)/gi)].map(m => m[1]))].slice(0, 12)
  }, null, 2));
}
