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

  function extractSocialHandles(rawIn = "") {
    const raw = String(rawIn || "");
    const pick = (re) => {
      const m = raw.match(re);
      return m ? clip(m[1] || m[0], 80).replace(/\/$/, "") : "";
    };
    const ig = pick(/instagram\.com\/([A-Za-z0-9._]+)/i);
    const fb = pick(/facebook\.com\/([A-Za-z0-9.]+)/i);
    const tt = pick(/tiktok\.com\/@?([A-Za-z0-9._]+)/i);
    const x = pick(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)/i);
    return {
      instagram: ig && !/reel|p\/|stories|explore/i.test(ig) ? `@${ig.replace(/^@/, "")}` : "",
      facebook: fb || "",
      tiktok: tt ? `@${tt.replace(/^@/, "")}` : "",
      x: x && !/intent|share|home/i.test(x) ? `@${x.replace(/^@/, "")}` : "",
      floqrHandle: ""
    };
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
    const hoursStructured = record.hoursStructured || extractHoursStructured(blob);
    if (hoursStructured) {
      next.hoursStructured = hoursStructured;
      next.hours = record.hours || hoursBlurbFromStructured(hoursStructured);
    }
    next.timeZone = record.timeZone || guessTimeZone(record.country || "");
    next.publicServices = uniqueList(record.publicServices || ["ShoutOut", "Guest List"]);
    next.displayScreenFormatIds = record.displayScreenFormatIds?.length ? record.displayScreenFormatIds : ["led-96x48", "led-64x32"];
    next.primaryDisplayScreenFormatId = record.primaryDisplayScreenFormatId || "led-96x48";
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
    extractEmail,
    extractPhone,
    extractSocialHandles,
    extractHoursStructured,
    hoursBlurbFromStructured,
    guessTimeZone,
    checklistHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
