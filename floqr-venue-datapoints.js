/* FLOQR venue datapoints — browser checklist + enrich helpers for crawl/review UI. */
(function (global) {
  "use strict";

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const VENUE_PUBLIC_PROFILE_DATAPOINTS = [
    {key: "locationName", label: "Venue / club name", group: "identity", required: true},
    {key: "brandName", label: "Brand name", group: "identity", required: false},
    {key: "tagline", label: "Public tagline", group: "identity", required: false},
    {key: "description", label: "Public description", group: "identity", required: false},
    {key: "type", label: "Venue type", group: "identity", required: false},
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
    {key: "socialMediaHandles.floqrHandle", label: "FloqR handle", group: "social", required: false},
    {key: "genres", label: "Music genres", group: "nightlife", required: true},
    {key: "artistsOrDjs", label: "DJ(s) / artist(s)", group: "nightlife", required: true},
    {key: "promoters", label: "Promoter(s)", group: "nightlife", required: true},
    {key: "amenities", label: "Amenities", group: "nightlife", required: false},
    {key: "agePolicy", label: "Age policy", group: "nightlife", required: false},
    {key: "dressCode", label: "Dress code", group: "nightlife", required: false},
    {key: "publicServices", label: "FLOQR services", group: "nightlife", required: false},
    {key: "hours", label: "Hours summary", group: "hours", required: false},
    {key: "hoursStructured", label: "Weekly open/closed hours", group: "hours", required: false},
    {key: "hoursExceptions", label: "Period hour overrides", group: "hours", required: false},
    {key: "timeZone", label: "Venue time zone", group: "hours", required: false},
    {key: "featuredDjs", label: "Featured DJs", group: "people", required: false},
    {key: "featuredStaff", label: "Featured service staff", group: "people", required: false},
    {key: "promotionGroups", label: "Promotion groups", group: "people", required: false},
    {key: "logoUrl", label: "Club logo URL", group: "media", required: false},
    {key: "extractedImages", label: "Extracted images", group: "media", required: false},
    {key: "displayScreenFormatIds", label: "Display screen formats", group: "display", required: false},
    {key: "primaryDisplayScreenFormatId", label: "Primary display format", group: "display", required: false},
    {key: "secondaryDisplayScreenFormatId", label: "Secondary display format", group: "display", required: false},
    {key: "VenueSupports96x48", label: "VenueSupports96x48 (0|1)", group: "display", required: false},
    {key: "VenueSupports64x48", label: "VenueSupports64x48 (0|1)", group: "display", required: false},
    {key: "VenueSupports64x32", label: "VenueSupports64x32 (0|1)", group: "display", required: false}
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

  function as01(value, fallback = 0) {
    if (value === 1 || value === "1" || value === true) return 1;
    if (value === 0 || value === "0" || value === false) return 0;
    return fallback;
  }

  function venueScreenFlags(record = {}) {
    const explicit = ["VenueSupports96x48", "VenueSupports64x48", "VenueSupports64x32"]
      .some(key => record[key] === 0 || record[key] === 1 || record[key] === "0" || record[key] === "1");
    if (explicit) {
      return {
        VenueSupports96x48: as01(record.VenueSupports96x48, 0),
        VenueSupports64x48: as01(record.VenueSupports64x48, 0),
        VenueSupports64x32: as01(record.VenueSupports64x32, 0)
      };
    }
    const ids = Array.isArray(record.displayScreenFormatIds) ? record.displayScreenFormatIds.map(String) : [];
    const hit = family => ids.some(id => id.includes(family)) ? 1 : 0;
    if (!ids.length) return {VenueSupports96x48: 1, VenueSupports64x48: 1, VenueSupports64x32: 1};
    return {
      VenueSupports96x48: hit("96x48"),
      VenueSupports64x48: hit("64x48"),
      VenueSupports64x32: hit("64x32")
    };
  }

  function extractEmail(value = "", context = {}) {
    const raw = String(value || "");
    const mailto = [...raw.matchAll(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)].map(m => m[1]);
    const plain = [...raw.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m => m[0]);
    let hostHint = "";
    try {
      hostHint = new URL(context.website || context.officialWebsite || "").hostname.replace(/^www\./i, "").toLowerCase();
    } catch (_e) { hostHint = ""; }
    const candidates = [...mailto, ...plain].filter(email =>
      !/example\.com|sentry\.|wixpress|schema\.org|wordpress|w3\.org|googleapis|gstatic/i.test(email)
    );
    if (hostHint) {
      const root = hostHint.split(".").slice(-2).join(".");
      const domainMatch = candidates.find(email => {
        const lower = String(email).toLowerCase();
        return lower.endsWith(`@${hostHint}`) || lower.endsWith(`@${root}`);
      });
      if (domainMatch) return domainMatch;
    }
    return candidates[0] || "";
  }

  function extractPhone(value = "") {
    const raw = String(value || "");
    const whatsappHits = [
      ...[...raw.matchAll(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\d{8,15})/gi)].map(m => m[1])
    ];
    const whatsapp = whatsappHits[0] ? `+${String(whatsappHits[0]).replace(/\D/g, "")}` : "";
    const telHrefs = [...raw.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map(m => decodeURIComponent(m[1] || "").trim());
    const labeled = [...raw.matchAll(/(?:tel|phone|telephone|call|appeler)\s*[:#]?\s*([+\d][\d\s()./-]{7,22}\d)/gi)].map(m => m[1]);
    const loose = raw.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g) || [];
    const candidates = [whatsapp, ...telHrefs, ...labeled, ...loose].filter(Boolean);
    return (candidates.find(item => {
      const text = String(item || "").trim();
      if (!text) return false;
      const at = raw.indexOf(text);
      if (/ver=\d|wp-content|fonts\.google|timestamp|unix/i.test(raw.slice(Math.max(0, at - 24), at + text.length + 12))) return false;
      const digits = text.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return false;
      if (/^20\d{8,}$/.test(digits) && !/[+\s().-]/.test(text) && !telHrefs.includes(text) && text !== whatsapp) return false;
      return true;
    }) || "").trim();
  }

  function isAggregatorWebsite(url = "") {
    try {
      const host = new URL(String(url || "").startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./i, "").toLowerCase();
      return /(?:^|\.)(?:privateaser|opentable|thefork|lafourchette|tripadvisor|yelp|timeout|residentadvisor|ra\.co|shotgun\.live|dice\.fm|eventbrite|facebook|instagram|linktr\.ee|beacons\.ai|paris-society)\b/i.test(host);
    } catch (_e) {
      return false;
    }
  }

  function decodeHtmlUrl(value = "") {
    return String(value || "")
      .replace(/&amp;/gi, "&")
      .replace(/&#x2f;/gi, "/")
      .replace(/&#47;/gi, "/")
      .replace(/%2f/gi, "/");
  }

  function venueHandleHints(context = {}) {
    const tokens = [];
    const push = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).forEach(t => {
      if (t.length >= 3) tokens.push(t);
    });
    push(context.venueName);
    push(context.proposedTitle);
    push(context.locationName);
    try {
      const host = new URL(context.website || context.officialWebsite || "").hostname.replace(/^www\./i, "");
      push(host.replace(/\.[a-z]{2,}$/i, "").replace(/\./g, " "));
      const slug = host.split(".")[0];
      if (slug) tokens.push(slug);
    } catch (_e) { /* ignore */ }
    return [...new Set(tokens)];
  }

  function scoreSocialHandle(handle = "", platform = "", hints = []) {
    const value = String(handle || "").replace(/^@/, "").toLowerCase();
    if (!value) return -100;
    let score = 1;
    hints.forEach(hint => {
      if (!hint) return;
      if (value === hint) score += 12;
      else if (value.includes(hint) || hint.includes(value)) score += 8;
    });
    if (/photo|photo(s|grapher)?|studio|agency|design|media|press|prinz|llorca|tuturfu/i.test(value)) score -= 6;
    if (/privateaser|opentable|thefork|tripadvisor|yelp|timeout|shotgun|dicefm|eventbrite|linktree|beacons/i.test(value)) score -= 14;
    if (platform === "facebook" && /profile\.php|people\//i.test(value)) score -= 4;
    return score;
  }

  function collectRegex(raw, re, limit = 40) {
    const out = [];
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let match;
    while ((match = global.exec(String(raw || ""))) !== null) {
      out.push(decodeHtmlUrl(match[1] || match[0]).replace(/\/$/, ""));
      if (out.length >= limit) break;
    }
    return out;
  }

  function extractJsonLdSameAs(html = "") {
    const out = [];
    const blocks = collectRegex(html, /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i, 8);
    blocks.forEach(block => {
      try {
        const parsed = JSON.parse(block);
        const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [])];
        nodes.forEach(node => {
          const sameAs = node?.sameAs;
          (Array.isArray(sameAs) ? sameAs : sameAs ? [sameAs] : []).forEach(url => out.push(String(url || "")));
        });
      } catch (_e) { /* ignore */ }
    });
    return out;
  }

  function extractSocialHandles(rawIn = "", context = {}) {
    const raw = String(rawIn || "");
    const hrefs = collectRegex(raw, /href\s*=\s*["']([^"']+)["']/i, 120);
    const dataUrls = collectRegex(raw, /data-(?:url|href|link|social(?:-url)?)\s*=\s*["']([^"']+)["']/i, 40);
    const sameAs = extractJsonLdSameAs(raw);
    const blob = `${raw}\n${hrefs.join("\n")}\n${dataUrls.join("\n")}\n${sameAs.join("\n")}`;
    const hints = venueHandleHints(context);
    const pick = (candidates, rejectRe, platform) => {
      const ranked = [];
      candidates.forEach(candidate => {
        const value = clip(candidate, 80).replace(/^@/, "");
        if (!value || (rejectRe && rejectRe.test(value))) return;
        ranked.push({value, score: scoreSocialHandle(value, platform, hints)});
      });
      ranked.sort((a, b) => b.score - a.score);
      return ranked[0]?.score > 0 ? ranked[0].value : (ranked[0]?.value || "");
    };
    const ig = pick([
      ...collectRegex(blob, /instagram\.com\/([A-Za-z0-9._]+)/i),
      ...hrefs.map(h => (h.match(/instagram\.com\/([A-Za-z0-9._]+)/i) || [])[1]).filter(Boolean)
    ], /^(?:reel|p|stories|explore|share|accounts|about|legal|directory|tv|tags)$/i, "instagram");
    const fb = pick([
      ...collectRegex(blob, /facebook\.com\/(?:pages\/[^/]+\/)?([A-Za-z0-9.]+)/i),
      ...hrefs.map(h => (h.match(/facebook\.com\/(?:pages\/[^/]+\/)?([A-Za-z0-9.]+)/i) || [])[1]).filter(Boolean)
    ], /^(?:sharer|share|dialog|plugins|pages|watch|events|groups|login|help|privacy|policies|tr|r\.php)$/i, "facebook");
    const tt = pick([
      ...collectRegex(blob, /tiktok\.com\/@?([A-Za-z0-9._]+)/i),
      ...hrefs.map(h => (h.match(/tiktok\.com\/@?([A-Za-z0-9._]+)/i) || [])[1]).filter(Boolean)
    ], /^(?:explore|tag|music|share|login|signup|foryou|following)$/i, "tiktok");
    const x = pick([
      ...collectRegex(blob, /(?:twitter|x)\.com\/([A-Za-z0-9_]+)/i),
      ...hrefs.map(h => (h.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/i) || [])[1]).filter(Boolean)
    ], /^(?:intent|share|home|i|search|explore|settings|login|signup|privacy|tos)$/i, "x");
    return {
      instagram: ig ? `@${ig.replace(/^@/, "")}` : "",
      facebook: fb || "",
      tiktok: tt ? `@${tt.replace(/^@/, "")}` : "",
      x: x ? `@${x.replace(/^@/, "")}` : "",
      floqrHandle: ""
    };
  }

  function listSocialSecondaryUrls(html = "", baseUrl = "", context = {}) {
    let origin = "";
    try { origin = new URL(baseUrl).origin; } catch (_e) { origin = ""; }
    const baseIsAggregator = isAggregatorWebsite(baseUrl);
    const hints = venueHandleHints(context);
    const hrefs = collectRegex(html, /href\s*=\s*["']([^"']+)["']/i, 250);
    const scored = [];
    hrefs.forEach(href => {
      const raw = String(href || "").trim();
      if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return;
      let absolute = raw;
      try {
        absolute = new URL(raw, baseUrl || undefined).toString();
      } catch (_e) {
        return;
      }
      const sameOrigin = origin && absolute.startsWith(origin);
      if (/instagram\.com|facebook\.com|tiktok\.com|(?:twitter|x)\.com|behance\.net|linkedin\.com|wa\.me|whatsapp\.com/i.test(absolute)) return;
      const path = absolute.toLowerCase();
      if (/\.(?:css|js|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|pdf|xml)(?:$|\?)/i.test(path)) return;
      if (/\/wp-(?:content|includes|json|admin)\//i.test(path)) return;
      if (/feed\/?$|\/#|\/cart|\/checkout|\/login|\/account/i.test(path)) return;
      if (isAggregatorWebsite(absolute) && !sameOrigin) return;
      let score = 0;
      if (/contact|contato|kontakt|contacto|nous-contacter|contact-us|get-in-touch/i.test(path)) score += 6;
      if (/privatisation|reservation|book(?:ing)?|infos?|access|plan|venir/i.test(path)) score += 5;
      if (/follow|social|reseaux|r[eé]seaux|redes|community|newsletter|actualit/i.test(path)) score += 4;
      if (/about|a-propos|qui-sommes|presse|press|team|equipe|footer|mentions/i.test(path)) score += 3;
      if (/\b(?:events?|agenda|program(?:me)?|line[- ]?up|residents?|djs?|artists?|calendar|showtimes?)\b/i.test(path)) score += 8;
      if (!sameOrigin) {
        const hostHit = hints.some(hint => hint.length >= 4 && path.includes(hint));
        if (!hostHit) return;
        score += baseIsAggregator ? 20 : 7;
      } else if (baseIsAggregator && /reservation|book(?:ing)?|team-building|privatisation/i.test(path)) {
        score -= 4;
      }
      if (score > 0) scored.push({url: absolute.split("#")[0], score});
    });
    scored.sort((a, b) => b.score - a.score || a.url.length - b.url.length);
    const seen = new Set();
    const fromPage = scored.map(item => item.url).filter(url => {
      const key = url.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const guesses = [
      "/contact", "/contact-us", "/contactus", "/nous-contacter",
      "/about", "/about-us", "/a-propos", "/infos", "/info",
      "/privatisation", "/reservations", "/reservation"
    ];
    if (origin && !baseIsAggregator) {
      guesses.forEach(path => {
        const url = `${origin}${path}`;
        const key = url.replace(/\/$/, "").toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        fromPage.push(url);
      });
    }
    return fromPage.slice(0, 8);
  }

  function listOfficialBrandUrls(html = "", baseUrl = "", context = {}) {
    if (!isAggregatorWebsite(baseUrl)) return [];
    return listSocialSecondaryUrls(html, baseUrl, context)
      .filter(url => !isAggregatorWebsite(url))
      .slice(0, 3);
  }

  function extractAmenities(source = "") {
    const catalog = ["VIP tables", "Bottle service", "Coat check", "Valet", "Valet parking", "Outdoor", "Patio", "Rooftop", "Garden", "Dance floor", "Live music", "Parking", "Reservations", "Private rooms", "Wheelchair accessible"];
    return catalog.filter(item => new RegExp(`\\b${item.replace(/\s+/g, "\\s+")}\\b`, "i").test(source));
  }

  function extractAgePolicy(source = "") {
    const m = String(source || "").match(/\b(18\+|19\+|21\+|all ages|18 and over|21 and over)(?:\s*(?:with\s+valid\s+id)?)?/i);
    return m ? clip(m[0], 80) : "";
  }

  function extractDressCode(source = "") {
    const m = String(source || "").match(/dress\s*code[:\s-]+([^.\n]{6,80})/i)
      || String(source || "").match(/\b(upscale|smart casual|no sneakers|nightlife attire|elegant casual)\b[^.\n]{0,40}/i);
    return m ? clip(m[1] || m[0], 120) : "";
  }

  function parseClockToken(value = "") {
    const raw = clip(value, 40).toLowerCase();
    if (!raw || /closed/i.test(raw)) return null;
    const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
    if (!m) return null;
    let hour = Number(m[1]);
    const minute = Number(m[2] || 0);
    const ap = String(m[3] || "").toLowerCase();
    if (ap.startsWith("p") && hour < 12) hour += 12;
    if (ap.startsWith("a") && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function blankHours() {
    return Object.fromEntries(DAY_KEYS.map(k => [k, {closed: true, open: "", close: ""}]));
  }

  function parseHoursLine(line = "") {
    if (/closed/i.test(line)) return {closed: true, open: "", close: ""};
    const parts = String(line).split(/\s*[–—\-to]+\s*/i);
    if (parts.length < 2) return null;
    const open = parseClockToken(parts[0]);
    const close = parseClockToken(parts[1]);
    return open && close ? {closed: false, open, close} : null;
  }

  function extractHoursStructured(source = "") {
    const hours = blankHours();
    let found = 0;
    DAY_LABELS.forEach((label, idx) => {
      const m = String(source).match(new RegExp(`${label.slice(0, 3)}[a-z]*\\s*[:\\-]?\\s*([^\\n<]{0,60})`, "i"));
      if (!m) return;
      const parsed = parseHoursLine(m[1]);
      if (!parsed) return;
      hours[DAY_KEYS[idx]] = parsed;
      found += 1;
    });
    return found ? hours : null;
  }

  function hoursBlurbFromStructured(structured) {
    if (!structured) return "";
    return DAY_KEYS.map((key, idx) => {
      const day = structured[key];
      if (!day || day.closed) return "";
      return `${DAY_LABELS[idx].slice(0, 3)} ${day.open}–${day.close}`;
    }).filter(Boolean).join(", ");
  }

  function guessTimeZone(country = "") {
    const raw = clip(country, 80).toUpperCase();
    if (/UNITED\s*STATES|\bUSA\b|\bUS\b/.test(raw)) return "America/New_York";
    if (/FRANCE/.test(raw)) return "Europe/Paris";
    if (/GERMANY|DEUTSCH/.test(raw)) return "Europe/Berlin";
    if (/NETHERLAND|HOLLAND/.test(raw)) return "Europe/Amsterdam";
    if (/SPAIN|ESPA/.test(raw)) return "Europe/Madrid";
    if (/ITALY|ITALIA/.test(raw)) return "Europe/Rome";
    if (/UNITED\s*KINGDOM|\bUK\b/.test(raw)) return "Europe/London";
    if (/CANADA/.test(raw)) return "America/Toronto";
    return "America/New_York";
  }

  function enrichVenueRecord(record = {}, {html = "", text: visibleText = ""} = {}) {
    const blob = `${html}\n${visibleText}\n${record.proposedDescription || ""}`;
    const next = {...record};
    const socialContext = {
      venueName: record.proposedTitle || record.proposedLocationName || record.locationName || record.brandName || "",
      proposedTitle: record.proposedTitle || "",
      locationName: record.locationName || "",
      website: record.officialWebsite || record.website || record.sourceUrl || "",
      officialWebsite: record.officialWebsite || ""
    };
    const socials = extractSocialHandles(blob, socialContext);
    const hints = venueHandleHints(socialContext);
    const pickBetterHandle = (existing, incoming, platform) => {
      const a = String(existing || "").replace(/^@/, "");
      const b = String(incoming || "").replace(/^@/, "");
      if (!a) return incoming || "";
      if (!b) return existing || "";
      return scoreSocialHandle(b, platform, hints) > scoreSocialHandle(a, platform, hints) ? incoming : existing;
    };
    next.socialMediaHandles = {
      instagram: pickBetterHandle(record.socialMediaHandles?.instagram, socials.instagram, "instagram"),
      facebook: pickBetterHandle(record.socialMediaHandles?.facebook, socials.facebook, "facebook"),
      x: pickBetterHandle(record.socialMediaHandles?.x, socials.x, "x"),
      tiktok: pickBetterHandle(record.socialMediaHandles?.tiktok, socials.tiktok, "tiktok"),
      floqrHandle: record.socialMediaHandles?.floqrHandle || ""
    };
    const incomingEmail = extractEmail(blob, socialContext);
    if (!record.email) next.email = incomingEmail;
    else if (incomingEmail && /privateaser|opentable|thefork|example\.com/i.test(String(record.email))) next.email = incomingEmail;
    else next.email = record.email;
    const nextPhone = extractPhone(blob);
    next.telephone = record.telephone || record.phone || nextPhone;
    if (nextPhone && /^\+/.test(nextPhone) && !/^\+/.test(String(record.telephone || record.phone || ""))) {
      next.telephone = nextPhone;
    }
    next.phone = next.telephone;
    next.amenities = uniqueList([...(record.amenities || []), ...extractAmenities(blob)]);
    next.agePolicy = record.agePolicy || extractAgePolicy(blob);
    next.dressCode = record.dressCode || extractDressCode(blob);
    const hoursStructured = record.hoursStructured || extractHoursStructured(blob);
    if (hoursStructured) {
      next.hoursStructured = hoursStructured;
      next.hours = record.hours || hoursBlurbFromStructured(hoursStructured);
    }
    next.timeZone = record.timeZone || guessTimeZone(record.country || "");
    next.publicServices = uniqueList(record.publicServices || ["ShoutOut", "Guest List"]);
    next.displayScreenFormatIds = record.displayScreenFormatIds?.length ? record.displayScreenFormatIds : ["led-96x48", "led-64x32"];
    next.primaryDisplayScreenFormatId = record.primaryDisplayScreenFormatId || "led-96x48";
    next.secondaryDisplayScreenFormatId = record.secondaryDisplayScreenFormatId || next.primaryDisplayScreenFormatId;
    Object.assign(next, venueScreenFlags({...record, displayScreenFormatIds: next.displayScreenFormatIds}));
    return next;
  }

  function clubLocationPayloadFromDiscovery(edited = {}, extras = {}) {
    const socials = edited.socialMediaHandles || {};
    return {
      locationName: edited.proposedTitle || edited.proposedLocationName || "",
      brandName: edited.brandName || edited.proposedLocationName || edited.proposedTitle || "",
      tagline: edited.tagline || "",
      description: edited.proposedDescription || edited.aiSummary || "",
      type: extras.type || edited.type || "club",
      categories: uniqueList(edited.categories || []),
      genres: uniqueList(edited.genres || []),
      cuisine: edited.cuisine || "",
      country: edited.country || "",
      region: edited.stateRegion || "",
      stateRegion: edited.stateRegion || "",
      city: edited.city || "",
      postalCode: edited.postalCode || "",
      address: edited.proposedAddress || "",
      streetAddress: edited.streetAddress || edited.proposedAddress || "",
      addressLine1: edited.streetAddress || edited.proposedAddress || "",
      fullAddress: edited.fullAddress || edited.proposedAddress || "",
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
      artists: uniqueList(edited.artistsOrDjs || edited.artists || []),
      artistsOrDjs: uniqueList(edited.artistsOrDjs || edited.artists || []),
      promoters: uniqueList(edited.promoters || []),
      promotionGroup: edited.promotionGroup || "",
      logoUrl: edited.logoUrl || "",
      extractedImages: Array.isArray(edited.extractedImages) ? edited.extractedImages.slice(0, 12) : [],
      displayScreenFormatIds: edited.displayScreenFormatIds?.length ? edited.displayScreenFormatIds : ["led-96x48", "led-64x32"],
      primaryDisplayScreenFormatId: edited.primaryDisplayScreenFormatId || "led-96x48",
      secondaryDisplayScreenFormatId: edited.secondaryDisplayScreenFormatId || edited.primaryDisplayScreenFormatId || "led-96x48",
      ...venueScreenFlags(edited),
      publicProfilePublished: true
    };
  }

  function checklistHtml() {
    const groups = {};
    VENUE_PUBLIC_PROFILE_DATAPOINTS.forEach(dp => {
      groups[dp.group] = groups[dp.group] || [];
      groups[dp.group].push(dp);
    });
    return Object.keys(groups).map(group =>
      `<div class="report-row"><strong>${group}</strong><span>${groups[group].map(dp => `${dp.required ? "*" : ""}${dp.label}`).join(" · ")}</span></div>`
    ).join("");
  }

  global.FLOQRVenueDatapoints = {
    VENUE_PUBLIC_PROFILE_DATAPOINTS,
    enrichVenueRecord,
    clubLocationPayloadFromDiscovery,
    venueScreenFlags,
    isAggregatorWebsite,
    listOfficialBrandUrls,
    extractEmail,
    extractPhone,
    extractSocialHandles,
    listSocialSecondaryUrls,
    extractHoursStructured,
    hoursBlurbFromStructured,
    guessTimeZone,
    checklistHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
