/**
 * Shared feature landing venue search — GPS nearest (default top 4), chrome-ready cards,
 * feature-specific fact lines for ShoutOut / VIP reserV / floqCast / general Search.
 * Resume: @feature-landing$
 */
(function (global) {
  "use strict";

  const NEARBY_TOP = 4;
  const FEATURES = Object.freeze({
    SHOUTOUT: "shoutOut",
    VIP: "vipReservations",
    FLOQCAST: "floqCast",
    GENERAL: "general"
  });

  function t(key, fallback, vars) {
    try {
      const out = global.FLOQRI18n?.t?.(key, vars);
      if (out && out !== key) return out;
    } catch (_) {}
    let s = fallback != null ? String(fallback) : String(key || "");
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
    return s;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function as01(v) {
    return v === 1 || v === true || v === "1" ? 1 : 0;
  }

  function listOf(v) {
    if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
    if (v == null || v === "") return [];
    return String(v).split(/[,|/]/).map((x) => x.trim()).filter(Boolean);
  }

  function socialHandles(club) {
    const sm = club?.socialMediaHandles || {};
    const out = [];
    ["instagram", "x", "tiktok", "facebook"].forEach((k) => {
      const val = String(sm[k] || club?.[k] || "").trim();
      if (val) out.push(`${k}: ${val}`);
    });
    return out;
  }

  function openDaysLabel(club) {
    const hours = club?.hoursStructured || club?.openingHours || null;
    if (hours && typeof hours === "object" && !Array.isArray(hours)) {
      const days = Object.keys(hours).filter((d) => {
        const row = hours[d];
        if (row == null) return false;
        if (typeof row === "string") return !/closed/i.test(row) && row.trim() !== "";
        if (Array.isArray(row)) return row.length > 0;
        if (typeof row === "object") return !row.closed && (row.open || row.from || row.start);
        return !!row;
      });
      if (days.length) return days.join(", ");
    }
    const activity = listOf(club?.activityDates).slice(0, 4);
    if (activity.length) return activity.join(" · ");
    const hoursText = String(club?.hours || "").trim();
    if (hoursText) return hoursText.length > 72 ? `${hoursText.slice(0, 70)}…` : hoursText;
    return "";
  }

  function ledSizes(club) {
    const Screen = global.FLOQRScreenDatapoints;
    if (Screen?.venueSupportedLeds) {
      try {
        const leds = Screen.venueSupportedLeds(club) || [];
        if (leds.length) return leds.map((id) => String(id).replace(/^led-/, "").replace(/x/g, "×")).join(", ");
      } catch (_) {}
    }
    const labels = [];
    if (as01(club?.VenueSupports96x48)) labels.push("96×48");
    if (as01(club?.VenueSupports64x48)) labels.push("64×48");
    if (as01(club?.VenueSupports64x32)) labels.push("64×32");
    if (labels.length) return labels.join(", ");
    const ids = listOf(club?.displayScreenFormatIds).map((id) => id.replace(/^led-/, "").replace(/x/g, "×"));
    return ids.slice(0, 3).join(", ");
  }

  function patronCustomShoutoutsAllowed(club) {
    if (club?.patronCustomShoutOutsEnabled === false || club?.allowPatronCustomShoutOuts === false) return false;
    if (club?.patronTemplateBackgroundEditingEnabled === false && club?.allowPatronCreatedShoutOuts === false) return false;
    /* Default: FLOQR venues that expose ShoutOut templates allow patron compose. */
    const templates = listOf(club?.templates);
    return templates.length > 0 || club?.featureGates?.shoutOut !== false;
  }

  function soundSupported(club) {
    if (club?.floqCastSoundEnabled === true || club?.floqCastSoundEnabled === 1) return true;
    if (club?.floqCastSoundEnabled === false || club?.floqCastSoundEnabled === 0) return false;
    if (club?.supportsSound === true || club?.supportsSound === 1) return true;
    if (club?.supportsSound === false || club?.supportsSound === 0) return false;
    const amenities = listOf(club?.amenities).join(" ").toLowerCase();
    if (/sound|audio|speaker|pa system/.test(amenities)) return true;
    const desc = String(club?.description || "").toLowerCase();
    if (/state-of-the-art sound|supports sound|audio output/.test(desc)) return true;
    /* floqCast board is video-first; sound is optional — unknown when not published. */
    return null;
  }

  function depositLabel(club) {
    const vip = club?.vipSettings || {};
    const cents = Number(vip.depositCents ?? club?.vipDepositCents ?? club?.minDepositCents ?? NaN);
    if (Number.isFinite(cents) && cents > 0) {
      const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
      return `$${dollars}`;
    }
    if (vip.depositRequired === 0 || vip.depositRequired === false) {
      return t("featureLanding.fact.noDeposit", "No deposit");
    }
    if (vip.depositRequired === 1 || vip.depositRequired === true) {
      return t("featureLanding.fact.depositRequired", "Deposit required");
    }
    return "";
  }

  function normalizeVenue(id, club) {
    const row = club || {};
    const Geo = global.FLOQRGeoSearch;
    const name = row.locationName || row.brandName || row.name || id;
    const place = row.locationLabel
      || [row.city, row.region || row.regionType, row.country].filter(Boolean).join(", ");
    return {
      id: String(id || row.id || "").trim(),
      name: String(name || "").trim(),
      brandName: String(row.brandName || "").trim(),
      city: String(row.city || "").trim(),
      region: String(row.region || row.regionType || "").trim(),
      country: String(row.country || "").trim(),
      locationLabel: String(place || "").trim(),
      genres: listOf(row.genres),
      categories: listOf(row.categories),
      activityDates: listOf(row.activityDates),
      telephone: String(row.telephone || row.phone || "").trim(),
      email: String(row.email || "").trim(),
      officialWebsite: String(row.officialWebsite || row.website || "").trim(),
      eventsUrl: String(row.eventsUrl || "").trim(),
      agePolicy: String(row.agePolicy || "").trim(),
      dressCode: String(row.dressCode || "").trim(),
      hours: String(row.hours || "").trim(),
      hoursStructured: row.hoursStructured || row.openingHours || null,
      logoUrl: String(row.logoUrl || row.coverImageUrl || "").trim(),
      socialMediaHandles: row.socialMediaHandles || {},
      templates: listOf(row.templates),
      amenities: listOf(row.amenities),
      featureGates: row.featureGates || {},
      vipSettings: row.vipSettings || {},
      VenueSupports96x48: row.VenueSupports96x48,
      VenueSupports64x48: row.VenueSupports64x48,
      VenueSupports64x32: row.VenueSupports64x32,
      displayScreenFormatIds: listOf(row.displayScreenFormatIds),
      primaryDisplayScreenFormatId: row.primaryDisplayScreenFormatId || "",
      secondaryDisplayScreenFormatId: row.secondaryDisplayScreenFormatId || "",
      patronTemplateBackgroundEditingEnabled: row.patronTemplateBackgroundEditingEnabled,
      patronCustomShoutOutsEnabled: row.patronCustomShoutOutsEnabled,
      allowPatronCustomShoutOuts: row.allowPatronCustomShoutOuts,
      allowPatronCreatedShoutOuts: row.allowPatronCreatedShoutOuts,
      floqCastSoundEnabled: row.floqCastSoundEnabled,
      supportsSound: row.supportsSound,
      description: String(row.description || "").trim(),
      latitude: row.latitude ?? row.lat,
      longitude: row.longitude ?? row.lng,
      coords: Geo?.recordCoordinates?.(row) || null,
      eventNames: listOf(row.eventNames),
      pending: !!row.pending,
      raw: row
    };
  }

  function fact(label, value) {
    const v = String(value == null ? "" : value).trim();
    if (!v) return null;
    return {label: String(label || "").trim(), value: v};
  }

  /** Feature-specific fact rows for result cards. */
  function factsForFeature(feature, venue) {
    const v = venue || {};
    const f = String(feature || FEATURES.GENERAL);
    const facts = [];

    if (f === FEATURES.SHOUTOUT) {
      const leds = ledSizes(v);
      facts.push(fact(t("featureLanding.fact.displays", "Displays"), leds || t("featureLanding.fact.unknown", "—")));
      facts.push(fact(
        t("featureLanding.fact.patronShoutouts", "Patron ShoutOuts"),
        patronCustomShoutoutsAllowed(v)
          ? t("featureLanding.fact.yes", "Yes")
          : t("featureLanding.fact.no", "No")
      ));
      const templates = listOf(v.templates);
      if (templates.length) {
        facts.push(fact(t("featureLanding.fact.templates", "Templates"), String(templates.length)));
      }
      const nights = openDaysLabel(v);
      if (nights) facts.push(fact(t("featureLanding.fact.nights", "Nights"), nights));
      return facts.filter(Boolean).slice(0, 5);
    }

    if (f === FEATURES.VIP) {
      const nights = openDaysLabel(v);
      if (nights) facts.push(fact(t("featureLanding.fact.openDays", "Open"), nights));
      const dep = depositLabel(v);
      if (dep) facts.push(fact(t("featureLanding.fact.minDeposit", "Min deposit"), dep));
      if (v.dressCode) facts.push(fact(t("featureLanding.fact.dressCode", "Dress"), v.dressCode));
      if (v.agePolicy) facts.push(fact(t("featureLanding.fact.age", "Age"), v.agePolicy));
      if (v.genres?.length) facts.push(fact(t("featureLanding.fact.genres", "Genres"), v.genres.slice(0, 3).join(" · ")));
      return facts.filter(Boolean).slice(0, 5);
    }

    if (f === FEATURES.FLOQCAST) {
      const leds = ledSizes(v);
      facts.push(fact(t("featureLanding.fact.screenSize", "Screen"), leds || t("featureLanding.fact.unknown", "—")));
      const sound = soundSupported(v);
      facts.push(fact(
        t("featureLanding.fact.sound", "Sound"),
        sound === true
          ? t("featureLanding.fact.yes", "Yes")
          : sound === false
            ? t("featureLanding.fact.no", "No")
            : t("featureLanding.fact.askVenue", "Ask venue")
      ));
      const board = v.secondaryDisplayScreenFormatId || v.primaryDisplayScreenFormatId || "";
      if (board) {
        facts.push(fact(
          t("featureLanding.fact.floqcastBoard", "floqCast board"),
          String(board).replace(/^led-/, "").replace(/x/g, "×")
        ));
      }
      if (v.genres?.length) facts.push(fact(t("featureLanding.fact.genres", "Genres"), v.genres.slice(0, 2).join(" · ")));
      return facts.filter(Boolean).slice(0, 5);
    }

    /* general club / event search */
    if (v.telephone) facts.push(fact(t("featureLanding.fact.contact", "Contact"), v.telephone));
    const cats = [...(v.categories || []).slice(0, 2), ...(v.genres || []).slice(0, 2)];
    if (cats.length) facts.push(fact(t("featureLanding.fact.category", "Category"), [...new Set(cats)].slice(0, 3).join(" · ")));
    facts.push(fact(t("featureLanding.fact.floqrPage", "FLOQR page"), "club-profile"));
    if (v.officialWebsite) {
      try {
        const host = new URL(v.officialWebsite).hostname.replace(/^www\./, "");
        facts.push(fact(t("featureLanding.fact.website", "Website"), host));
      } catch (_) {
        facts.push(fact(t("featureLanding.fact.website", "Website"), v.officialWebsite));
      }
    }
    const social = socialHandles(v).slice(0, 2);
    if (social.length) facts.push(fact(t("featureLanding.fact.social", "Social"), social.join(" · ")));
    return facts.filter(Boolean).slice(0, 5);
  }

  function venueHaystack(v) {
    return [
      v.name, v.brandName, v.id, v.city, v.region, v.country, v.locationLabel,
      ...(v.genres || []), ...(v.categories || []), ...(v.eventNames || []),
      v.telephone, v.officialWebsite, ...(socialHandles(v))
    ].join(" ").toLowerCase();
  }

  function locationSourceLabel(source) {
    if (source === "gps") return t("listing.sourceGps", "GPS");
    if (source === "ip") return t("listing.sourceIp", "IP estimate");
    if (source === "profile") return t("listing.sourceProfile", "profile city");
    return "";
  }

  function sortNearest(rows, locationContext, opts = {}) {
    const Geo = global.FLOQRGeoSearch;
    const nameOf = opts.nameOf || ((r) => r.name || r.label || r.id || "");
    const coordsOf = opts.coordsOf || ((r) => r.coords || Geo?.recordCoordinates?.(r) || Geo?.recordCoordinates?.(r.raw) || null);
    const origin = locationContext && locationContext.latitude != null && locationContext.longitude != null
      ? locationContext
      : null;
    if (!Geo?.sortNearest || !origin) {
      return (rows || []).slice().sort((a, b) => String(nameOf(a)).localeCompare(String(nameOf(b)), undefined, {sensitivity: "base", numeric: true}));
    }
    return Geo.sortNearest(rows || [], origin, {coordsOf, nameOf}).map((entry) => entry.item);
  }

  /**
   * Filter + rank venues. Empty query → nearest NEARBY_TOP (default 4).
   * Typed query → all matches, still nearest-first.
   */
  function filterAndRank(rows, {query = "", locationContext = null, nearbyTop = NEARBY_TOP, haystackOf = venueHaystack} = {}) {
    const q = String(query || "").trim().toLowerCase();
    let list = Array.isArray(rows) ? rows.slice() : [];
    if (q) list = list.filter((r) => String(haystackOf(r) || "").includes(q));
    list = sortNearest(list, locationContext);
    if (!q && nearbyTop > 0) return list.slice(0, nearbyTop);
    return list;
  }

  function statusLine({total, shown, query, locationContext, featureLabel}) {
    const label = featureLabel || t("featureLanding.venues", "venues");
    if (!total) return t("featureLanding.noVenues", "No {label} available.", {label});
    if (String(query || "").trim()) {
      return t("featureLanding.matchCount", "{n} match(es)", {n: shown});
    }
    const origin = locationContext && locationContext.latitude != null && locationContext.longitude != null
      ? locationContext
      : null;
    if (origin) {
      const place = locationContext.city || t("listing.yourLocation", "your location");
      const source = locationSourceLabel(locationContext.source) || "GPS";
      return t(
        "featureLanding.nearestOf",
        "{shown} nearest of {n} · {place} ({source})",
        {shown, n: total, place, source}
      );
    }
    return t(
      "featureLanding.allowLocation",
      "{n} {label} · allow location for nearest first",
      {n: total, label}
    );
  }

  async function resolvePatronLocation({profile = null, auth = null, onLateGps = null} = {}) {
    const Geo = global.FLOQRGeoSearch;
    if (!Geo?.resolveUserLocation) return null;
    let prof = profile;
    if (!prof && auth) {
      try {
        const user = auth.currentUser || firebase?.auth?.()?.currentUser;
        if (user) {
          const snap = await firebase.firestore().collection("users").doc(user.uid).get();
          prof = snap.exists ? snap.data() : null;
        }
      } catch (_) {}
    }
    return Geo.resolveUserLocation({
      profile: prof,
      onLateGps: typeof onLateGps === "function" ? onLateGps : undefined
    });
  }

  function productLabel(feature) {
    if (feature === FEATURES.SHOUTOUT) return "ShoutOut";
    if (feature === FEATURES.VIP) return "VIP reserV";
    if (feature === FEATURES.FLOQCAST) return "floqCast";
    return t("featureLanding.club", "Club");
  }

  /**
   * Standardized venue result card HTML (club-option / feature-landing-card).
   * opts: {feature, selected, ctaLabel, ctaAttr, productBadge, extraBadges, actionsHtml}
   */
  function renderVenueCardHtml(venue, opts = {}) {
    const feature = opts.feature || FEATURES.GENERAL;
    const selected = !!opts.selected;
    const badge = opts.productBadge != null ? opts.productBadge : productLabel(feature);
    const ctaLabel = opts.ctaLabel || t("featureLanding.selectVenue", "Select venue");
    const ctaAttr = opts.ctaAttr || `data-select-venue="${esc(venue.id)}"`;
    const place = venue.locationLabel || [venue.city, venue.region, venue.country].filter(Boolean).join(", ");
    const facts = opts.facts || factsForFeature(feature, venue);
    const badges = Array.isArray(opts.extraBadges) ? opts.extraBadges.filter(Boolean) : [];
    const factsHtml = facts.length
      ? `<ul class="feature-landing-facts">${facts.map((f) =>
        `<li><span class="feature-landing-fact-label">${esc(f.label)}</span> <span class="feature-landing-fact-value">${esc(f.value)}</span></li>`
      ).join("")}</ul>`
      : "";
    const badgeRow = badges.length
      ? `<div class="badge-row">${badges.map((b) => `<span>${esc(b)}</span>`).join("")}</div>`
      : "";
    const actions = opts.actionsHtml != null
      ? opts.actionsHtml
      : `<button type="button" class="buttonlike ${selected ? "primary" : ""}" ${ctaAttr}>${esc(ctaLabel)}</button>`;

    return `<article class="card club-card club-option feature-landing-card${selected ? " is-selected" : ""}" role="listitem" data-venue-id="${esc(venue.id)}" data-feature="${esc(feature)}">
      <div class="club-option-head feature-landing-card-head">
        <div>
          <h3>${esc(venue.name || venue.label || venue.id)}</h3>
          ${place ? `<p class="sub small feature-landing-place">${esc(place)}</p>` : ""}
        </div>
        <strong class="feature-landing-product-badge">${esc(badge)}</strong>
      </div>
      ${badgeRow}
      ${factsHtml}
      <div class="queue-actions feature-landing-actions">${actions}</div>
    </article>`;
  }

  /** Strip FloqR parent logos from feature landing heroes (product icon only). */
  function stripParentLogos(root = document) {
    try {
      (root || document).querySelectorAll(
        ".product-page .product-brand-stack > .product-parent-logo, .product-page .product-brand-stack img[alt='FLOQR'], .product-page .product-brand-stack img[alt='FloqR']"
      ).forEach((el) => {
        el.classList.add("hidden");
        el.setAttribute("hidden", "");
        el.style.display = "none";
      });
    } catch (_) {}
  }

  const api = {
    NEARBY_TOP,
    FEATURES,
    t,
    esc,
    normalizeVenue,
    factsForFeature,
    venueHaystack,
    sortNearest,
    filterAndRank,
    statusLine,
    resolvePatronLocation,
    renderVenueCardHtml,
    productLabel,
    stripParentLogos,
    ledSizes,
    openDaysLabel,
    locationSourceLabel
  };

  global.FLOQRFeatureLanding = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
