/* FLOQR SMARTvisuals — deterministic tag extract + asset resolver.
   Local rules first. Never call Gemini on card view. Unapproved assets denied.
   Same file is copied to functions/smartvisuals-resolver.js (byte-identical). */
"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FLOQRSmartVisualsResolver = api;
})(typeof self !== "undefined" ? self : this, function () {
  const SCHEMA = "floqr.smartVisuals/1";
  const MAX_INPUT = 400;
  const CONFIDENCE_THRESHOLD = 0.78;
  const TYPO_THRESHOLD = 0.86;

  const CATEGORY_PRIORITY = [
    "fashion", "travel", "nightclub", "dining", "sports", "event", "hotel",
    "meeting", "shoutout", "beach", "city", "people", "planning", "service"
  ];

  const CATEGORY_PHRASES = [
    {re: /\bfashion week\b|\brunway\b|\bcouture\b|\bfashion\b/, category: "fashion", confidence: 0.94},
    {re: /\btrip\b|\btravel\b|\bflight\b|\bflights\b|\bairplane\b|\bairport\b|\bitinerary\b|\bvocation\b|\bvacation\b/, category: "travel", confidence: 0.92},
    {re: /\bdinner\b|\bdining\b|\brestaurant\b|\bbrunch\b/, category: "dining", confidence: 0.9},
    {re: /\bnightclub\b|\bnightlife\b|\bclub night\b|\bvip\b/, category: "nightclub", confidence: 0.88},
    {re: /\bhotel\b|\bstay\b|\bresort\b/, category: "hotel", confidence: 0.86},
    {re: /\bsports?\b|\bgame\b|\bstadium\b/, category: "sports", confidence: 0.86},
    {re: /\bconcert\b|\bfestival\b|\bticket\b/, category: "event", confidence: 0.84},
    {re: /\bmeeting\b|\boffice\b|\bplanning\b/, category: "meeting", confidence: 0.72},
    {re: /\bshoutout\b/, category: "shoutout", confidence: 0.95}
  ];

  const SHORT_PLACES = {
    la: "los-angeles",
    nyc: "new-york",
    dc: "washington-dc"
  };

  const TRAVEL_CONNECTOR = /\b(?:to|→|->|via|from)\b/;
  const FUTURE_HINT = /\b(?:trip|plan|planning|itinerary|upcoming|next|tomorrow|tonight|this weekend)\b/;
  const PAST_HINT = /\b(?:last|yesterday|went|was|were|visited|remember)\b/;

  const TYPOS = [
    [/\bsan dego\b/g, "san diego"],
    [/\bburningman\b/g, "burning man"],
    [/\bcancun\b/g, "cancun"],
    [/\bcancún\b/g, "cancun"],
    [/\bla\b/g, "la"]
  ];

  const INJECTION = [
    /ignore (?:previous|all) instructions/,
    /system prompt/,
    /<\/?script\b/,
    /javascript:/,
    /https?:\/\/[^\s]+/i,
    /data:text\/html/i
  ];

  function text(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || MAX_INPUT);
  }

  function fold(value) {
    return text(value, MAX_INPUT)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function applyTypos(folded) {
    let out = folded;
    TYPOS.forEach(([re, to]) => {
      out = out.replace(re, to);
    });
    return out;
  }

  function tokens(folded) {
    return folded.split(/[^a-z0-9]+/).filter(t => t.length > 1);
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = i - 1;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return row[b.length];
  }

  function similarity(a, b) {
    const max = Math.max(a.length, b.length, 1);
    return 1 - (levenshtein(a, b) / max);
  }

  function loadCatalog(injected) {
    if (injected && typeof injected === "object") return injected;
    if (typeof require === "function") {
      try {
        return require("./smartvisuals/catalog.json");
      } catch (_) {
        try {
          return require("../smartvisuals/catalog.json");
        } catch (e) {
          return null;
        }
      }
    }
    return (typeof self !== "undefined" && self.FLOQRSmartVisualsCatalog) || null;
  }

  function publishedAssets(catalog) {
    const assets = catalog && Array.isArray(catalog.assets) ? catalog.assets : [];
    return assets.filter(a => a && a.approvalStatus === "published");
  }

  function byId(catalog, id) {
    return publishedAssets(catalog).find(a => a.id === id) || null;
  }

  function backgroundIdOf(raw) {
    const s = String(raw || "").trim();
    if (!s) return "bg-mingl-room";
    return s.startsWith("bg-") ? s : `bg-${s}`;
  }

  function stencilIdOf(raw) {
    const s = String(raw || "").trim();
    if (!s) return "st-people";
    return s.startsWith("st-") ? s : `st-${s}`;
  }

  function placeIndex(catalog) {
    const map = new Map();
    const aliases = (catalog && catalog.taxonomy && catalog.taxonomy.placeAliases) || {};
    Object.entries(aliases).forEach(([alias, row]) => {
      map.set(fold(alias), {
        ...row,
        backgroundId: backgroundIdOf(row.backgroundId),
        stencilId: stencilIdOf(row.stencilId),
        via: "alias"
      });
    });
    publishedAssets(catalog).forEach(asset => {
      if (asset.type !== "background") return;
      const keys = [asset.placeId, asset.id.replace(/^bg-/, ""), asset.name, ...(asset.aliases || [])]
        .filter(Boolean)
        .map(fold);
      keys.forEach(key => {
        if (!key || map.has(key)) return;
        map.set(key, {
          placeId: asset.placeId || asset.id.replace(/^bg-/, ""),
          backgroundId: asset.id,
          stencilId: asset.pairedStencilId ? `st-${asset.pairedStencilId}` : "st-location",
          tags: asset.tags || [],
          officialAffiliation: asset.officialAffiliation,
          via: "asset"
        });
      });
    });
    return map;
  }

  function extractPlaces(folded, catalog) {
    const index = placeIndex(catalog);
    const hits = [];
    const seen = new Set();
    const words = folded;
    Object.entries(SHORT_PLACES).forEach(([code, placeId]) => {
      const re = new RegExp(`(?:^|[^a-z0-9])${code}(?:[^a-z0-9]|$)`);
      if (!re.test(words)) return;
      const row = index.get(placeId);
      if (row && !seen.has(row.placeId || placeId)) {
        seen.add(row.placeId || placeId);
        hits.push({...row, placeId: row.placeId || placeId, matched: code, confidence: 0.9, via: "short-code"});
      }
    });
    index.forEach((row, key) => {
      if (key.length < 3) return;
      const re = new RegExp(`(?:^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`);
      if (!re.test(words)) return;
      const id = row.placeId;
      if (seen.has(id)) return;
      seen.add(id);
      hits.push({...row, matched: key, confidence: 0.95});
    });
    if (!hits.length) {
      tokens(folded).forEach(tok => {
        if (tok.length < 5) return;
        let best = null;
        index.forEach((row, key) => {
          if (key.length < 5) return;
          const score = similarity(tok, key);
          if (score >= TYPO_THRESHOLD && (!best || score > best.score)) {
            best = {row, key, score};
          }
        });
        if (best && !seen.has(best.row.placeId)) {
          seen.add(best.row.placeId);
          hits.push({...best.row, matched: tok, confidence: best.score, via: "typo"});
        }
      });
    }
    return hits;
  }

  function extractCategories(folded) {
    const hits = [];
    CATEGORY_PHRASES.forEach(row => {
      if (row.re.test(folded)) hits.push({category: row.category, confidence: row.confidence});
    });
    hits.sort((a, b) => {
      const pa = CATEGORY_PRIORITY.indexOf(a.category);
      const pb = CATEGORY_PRIORITY.indexOf(b.category);
      return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || b.confidence - a.confidence;
    });
    return hits;
  }

  function contentHash(title, description) {
    const body = `${fold(title)}\n${fold(description)}`;
    let h = 2166136261;
    for (let i = 0; i < body.length; i++) {
      h ^= body.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `svh_${(h >>> 0).toString(16)}`;
  }

  function injectionHit(raw) {
    const sample = fold(raw);
    return INJECTION.some(re => re.test(sample) || re.test(String(raw || "").toLowerCase()));
  }

  function neutral(catalog, reasonCode, extra) {
    const tax = (catalog && catalog.taxonomy) || {};
    const n = tax.neutral || {backgroundId: "bg-mingl-room", stencilId: "st-people"};
    return {
      schemaVersion: SCHEMA,
      ok: true,
      ambiguous: reasonCode === "ambiguous" || reasonCode === "collision",
      category: "people",
      placeIds: [],
      tags: ["neutral"],
      backgroundId: n.backgroundId,
      stencilId: n.stencilId,
      confidence: 0,
      reasonCode,
      registryRevision: catalog && catalog.revision ? catalog.revision : 1,
      modelCalls: 0,
      geminiUsed: false,
      officialAffiliation: false,
      ...extra
    };
  }

  function classify(input, catalogOpt) {
    const catalog = loadCatalog(catalogOpt);
    const title = text(input && input.title, MAX_INPUT);
    const description = text(input && input.description, MAX_INPUT);
    const sourceKind = text(input && input.sourceKind, 40) || "authorized-room";
    const hash = contentHash(title, description);
    const base = {contentHash: hash, title, sourceKind, modelCalls: 0, geminiUsed: false};

    if (sourceKind === "private-chat" || sourceKind === "privateChat") {
      return {
        ...neutral(catalog, "private-source-denied", base),
        ok: false,
        publicNotification: false
      };
    }
    if (!title) return neutral(catalog, "empty-title", base);

    const raw = `${title} ${description}`;
    const injected = injectionHit(raw);
    const folded = applyTypos(fold(raw.replace(/https?:\/\/\S+/gi, " ")));
    const places = extractPlaces(folded, catalog);
    const categories = extractCategories(folded);
    const tense = PAST_HINT.test(folded) && !FUTURE_HINT.test(folded) ? "past" : "future-or-unspecified";

    if (injected) {
      return {
        ...neutral(catalog, "prompt-injection-ignored", {
          ...base,
          injectionIgnored: true,
          tags: ["neutral"]
        })
      };
    }

    const distinctPlaces = [...new Set(places.map(p => p.placeId))];
    if (distinctPlaces.length >= 2 && !TRAVEL_CONNECTOR.test(folded)) {
      return {
        ...neutral(catalog, "collision", {
          ...base,
          placeIds: distinctPlaces,
          ambiguous: true,
          extracted: {places: distinctPlaces, categories: categories.map(c => c.category)}
        })
      };
    }

    const category = categories[0] || null;
    const place = places[0] || null;
    let confidence = 0;
    if (place) confidence = Math.max(confidence, place.confidence || 0);
    if (category) confidence = Math.max(confidence, category.confidence || 0);
    if (place && category) confidence = Math.min(1, confidence + 0.04);

    if (!place && !category) return neutral(catalog, "no-signal", base);
    if (confidence < CONFIDENCE_THRESHOLD) {
      return {
        ...neutral(catalog, "below-threshold", {
          ...base,
          confidence,
          extracted: {places: distinctPlaces, categories: categories.map(c => c.category)}
        })
      };
    }

    let backgroundId = "bg-mingl-room";
    let stencilId = "st-people";
    let tags = [];
    let reasonCode = "rule";
    let officialAffiliation = false;

    if (place) {
      backgroundId = backgroundIdOf(place.backgroundId);
      stencilId = stencilIdOf(place.stencilId || "st-location");
      tags = [...(place.tags || []), `destination:${place.placeId}`];
      reasonCode = place.via === "typo" ? "typo-place" : place.via === "alias" ? "place-alias" : "place";
      officialAffiliation = place.officialAffiliation === true;
    }
    if (category && category.category === "fashion") {
      if (place && place.placeId === "paris") {
        backgroundId = "bg-paris-fashion-week";
        stencilId = "st-fashion";
        tags = ["fashion", "event", "destination:paris", "runway"];
        reasonCode = "fashion-place";
      } else if (place && byId(catalog, `bg-${place.placeId}-fashion-week`)) {
        backgroundId = `bg-${place.placeId}-fashion-week`;
        stencilId = "st-fashion";
        tags = ["fashion", "event", `destination:${place.placeId}`];
        reasonCode = "fashion-place";
      } else {
        stencilId = "st-fashion";
        tags = ["fashion", ...(tags || [])];
        if (!place) backgroundId = "bg-paris-fashion-week";
        reasonCode = "fashion";
      }
    } else if (category && category.category === "travel") {
      stencilId = "st-flight";
      tags = ["travel", ...(tags || [])];
      if (!place) backgroundId = "bg-flight";
      reasonCode = place ? "travel-place" : "travel";
    } else if (category && category.category === "dining") {
      stencilId = "st-restaurant";
      if (!place) backgroundId = "bg-dining";
      tags = ["dining", ...(tags || [])];
    } else if (category && !place) {
      const matchBg = publishedAssets(catalog).find(a => a.type === "background" && a.category === category.category);
      if (matchBg) backgroundId = matchBg.id;
      if (matchBg && matchBg.pairedStencilId) stencilId = `st-${matchBg.pairedStencilId}`;
      tags = [category.category];
      reasonCode = "category";
    }

    if (!byId(catalog, backgroundId)) backgroundId = "bg-mingl-room";
    if (!byId(catalog, stencilId)) stencilId = "st-people";

    return {
      schemaVersion: SCHEMA,
      ok: true,
      ambiguous: false,
      category: (category && category.category) || (place && publishedAssets(catalog).find(a => a.id === backgroundId)?.category) || "people",
      placeIds: distinctPlaces,
      tags: [...new Set(tags)],
      backgroundId,
      stencilId,
      confidence,
      reasonCode,
      registryRevision: catalog && catalog.revision ? catalog.revision : 1,
      modelCalls: 0,
      geminiUsed: false,
      officialAffiliation: officialAffiliation === true,
      tense,
      publicNotification: true,
      injectionIgnored: false,
      contentHash: hash,
      sourceKind,
      title
    };
  }

  function resolve(input, catalogOpt) {
    const catalog = loadCatalog(catalogOpt);
    const classified = classify(input, catalog);
    const override = input && input.override;
    if (override && override.backgroundId && override.authorized === true) {
      const bg = byId(catalog, override.backgroundId);
      const st = byId(catalog, override.stencilId || classified.stencilId);
      if (!bg || bg.approvalStatus !== "published") {
        return {...classified, overrideRejected: true, reasonCode: "override-unapproved"};
      }
      return {
        ...classified,
        backgroundId: bg.id,
        stencilId: (st && st.id) || classified.stencilId,
        reasonCode: "manual-override",
        overrideApplied: true
      };
    }
    return classified;
  }

  function urlsFor(selection, catalogOpt) {
    const catalog = loadCatalog(catalogOpt);
    const bg = byId(catalog, selection && selection.backgroundId);
    const st = byId(catalog, selection && selection.stencilId);
    return {
      backgroundUrl: bg ? `./${bg.path}` : "./smartvisuals/backgrounds/mingl-room.svg",
      stencilUrl: st ? `./${st.path}` : "./smartvisuals/stencils/people.svg",
      backgroundName: bg ? bg.name : "Mingl Room",
      stencilName: st ? st.name : "People",
      photographic: false
    };
  }

  function geminiAllowed() {
    return false;
  }

  const PLACE_CARD_DEFAULTS = {
    venue: {backgroundId: "bg-vip-nightlife", stencilId: "st-nightclub"},
    restaurant: {backgroundId: "bg-dining", stencilId: "st-restaurant"},
    hotel: {backgroundId: "bg-hotel-stay", stencilId: "st-hotel"},
    short_term_rental: {backgroundId: "bg-hotel-stay", stencilId: "st-hotel"},
    event: {backgroundId: "bg-concert", stencilId: "st-music"},
    travel: {backgroundId: "bg-bali", stencilId: "st-flight"},
    vehicle: {backgroundId: "bg-road-trip", stencilId: "st-car"},
    product: {backgroundId: "bg-shoutout", stencilId: "st-shopping"},
    real_estate: {backgroundId: "bg-washington-dc", stencilId: "st-location"}
  };

  function publishedBackground(catalog, id) {
    const bg = byId(catalog, id);
    return bg && bg.type === "background" && bg.approvalStatus === "published" ? bg : null;
  }

  function placeKindDefault(kind, catalog) {
    const tax = (catalog && catalog.taxonomy && catalog.taxonomy.placeCardDefaults) || {};
    const packed = tax[kind] || PLACE_CARD_DEFAULTS[kind] || PLACE_CARD_DEFAULTS.venue;
    return {
      backgroundId: backgroundIdOf(packed.backgroundId),
      stencilId: stencilIdOf(packed.stencilId)
    };
  }

  function explicitPlaceBackgroundId(payload) {
    if (!payload || typeof payload !== "object") return "";
    const publicData = payload.floqrPublicData && typeof payload.floqrPublicData === "object"
      ? payload.floqrPublicData
      : {};
    return text(
      payload.backgroundId
        || payload.smartBackgroundId
        || publicData.smartBackgroundId
        || publicData.backgroundId,
      80
    );
  }

  function classifyUsefulForPlace(classified) {
    if (!classified || classified.ok === false) return false;
    const reason = String(classified.reasonCode || "");
    if (classified.injectionIgnored === true) return false;
    if (reason === "neutral-fallback" || reason === "no-signal" || reason === "empty-title"
      || reason === "below-threshold" || reason === "collision" || reason === "prompt-injection-ignored"
      || reason === "private-source-denied") return false;
    return classified.backgroundId && classified.backgroundId !== "bg-mingl-room";
  }

  /** Place / venue SMARTview art. Gemini off. Explicit published id wins, then city/title, then kind default. */
  function resolvePlaceCard(input, catalogOpt) {
    const catalog = loadCatalog(catalogOpt);
    const payload = input && typeof input === "object" ? input : {};
    const kind = String(payload.kind || "venue");
    const def = placeKindDefault(kind, catalog);
    const explicit = explicitPlaceBackgroundId(payload);
    if (explicit) {
      const bg = publishedBackground(catalog, explicit);
      if (bg) {
        return {
          ok: true,
          kind,
          backgroundId: bg.id,
          stencilId: def.stencilId,
          reasonCode: "place-card-explicit",
          geminiUsed: false,
          modelCalls: 0
        };
      }
    }
    const city = payload.floqrPublicData && payload.floqrPublicData.city;
    const classified = resolve({
      title: text(payload.title, 160),
      description: text([payload.summary, city, kind].filter(Boolean).join(" "), 400),
      sourceKind: "place-smartview"
    }, catalog);
    if (classifyUsefulForPlace(classified) && publishedBackground(catalog, classified.backgroundId)) {
      return {
        ok: true,
        kind,
        backgroundId: classified.backgroundId,
        stencilId: classified.stencilId || def.stencilId,
        reasonCode: "place-card-classified",
        geminiUsed: false,
        modelCalls: 0
      };
    }
    const fallback = publishedBackground(catalog, def.backgroundId);
    return {
      ok: true,
      kind,
      backgroundId: (fallback && fallback.id) || "bg-vip-nightlife",
      stencilId: def.stencilId,
      reasonCode: "place-card-kind-default",
      geminiUsed: false,
      modelCalls: 0
    };
  }

  const EMPTY_WHEN = ["private-source-denied", "prompt-injection-ignored", "private-chat", "privateChat"];
  const THEMATIC = ["travel", "fashion", "dining", "nightclub", "event", "sports", "hotel"];
  const PLACE_LABELS = {
    cancun: "Cancun",
    paris: "Paris",
    "washington-dc": "Washington, DC",
    "new-york": "New York",
    "los-angeles": "Los Angeles",
    "san-diego": "San Diego",
    milan: "Milan",
    london: "London",
    miami: "Miami",
    ibiza: "Ibiza",
    bali: "Bali",
    barcelona: "Barcelona",
    madrid: "Madrid",
    lisbon: "Lisbon",
    seattle: "Seattle",
    atlanta: "Atlanta",
    "burning-man": "Burning Man"
  };

  const DEFAULT_AD_POLICY = {
    adsEnabled: false,
    adsenseApproved: false,
    mockFill: true,
    mockFillKind: "contextual-from-authorized-tags",
    placement: "below-room-smartview",
    emptyWhen: EMPTY_WHEN.slice(),
    targeting: "authorized-title-tags-only",
    note: "Labeled mock fill from authorized SMARTview tags. Not a live advertiser or booked inventory. AdSense is not loaded."
  };

  function adPolicy(overrides) {
    const o = overrides && typeof overrides === "object" ? overrides : {};
    const emptyWhen = Array.isArray(o.emptyWhen)
      ? o.emptyWhen.map(v => String(v || "").trim()).filter(Boolean)
      : EMPTY_WHEN.slice();
    return {
      adsEnabled: false,
      adsenseApproved: false,
      mockFill: o.mockFill !== false,
      mockFillKind: "contextual-from-authorized-tags",
      placement: String(o.placement || DEFAULT_AD_POLICY.placement),
      emptyWhen,
      targeting: "authorized-title-tags-only",
      note: String(o.note || DEFAULT_AD_POLICY.note)
    };
  }

  function humanizePlace(placeId) {
    const id = String(placeId || "").trim();
    if (!id) return "";
    if (PLACE_LABELS[id]) return PLACE_LABELS[id];
    return id.split(/[-_]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }

  function emptyAd(reasonCode) {
    return {
      fill: false,
      kind: "none",
      category: null,
      placeId: "",
      placeLabel: "",
      kickerKey: "",
      headlineKey: "",
      headlineVars: {},
      subKey: "sv.adSubMinglDeals",
      disclaimerKey: "sv.adMockDisclaimer",
      backgroundId: "",
      stencilId: "",
      reasonCode: reasonCode || "ad-policy-empty",
      mock: true,
      liveInventory: false,
      advertiser: null
    };
  }

  function mockAd(category, opts) {
    const row = opts || {};
    return {
      fill: true,
      kind: "mock-contextual",
      category,
      placeId: row.placeId || "",
      placeLabel: row.placeLabel || "",
      kickerKey: row.kickerKey,
      headlineKey: row.headlineKey,
      headlineVars: row.headlineVars || {},
      subKey: "sv.adSubMinglDeals",
      disclaimerKey: "sv.adMockDisclaimer",
      backgroundId: row.backgroundId || "",
      stencilId: row.stencilId || "",
      reasonCode: row.reasonCode,
      mock: true,
      liveInventory: false,
      advertiser: null
    };
  }

  function isGeographicPlace(placeId, catalog) {
    const id = String(placeId || "").trim();
    if (!id) return false;
    const aliases = (catalog && catalog.taxonomy && catalog.taxonomy.placeAliases) || {};
    if (Object.keys(aliases).some(alias => (aliases[alias] && aliases[alias].placeId) === id)) return true;
    const named = publishedAssets(catalog).find(a => a.type === "background" && a.placeId === id);
    if (named) return true;
    const bg = byId(catalog, backgroundIdOf(id));
    return !!(bg && bg.placeId);
  }

  function destinationPlace(selection, catalog) {
    const places = Array.isArray(selection.placeIds) ? selection.placeIds.map(String).filter(Boolean) : [];
    const tags = Array.isArray(selection.tags) ? selection.tags.map(String) : [];
    const dest = tags.find(tag => tag.indexOf("destination:") === 0);
    const raw = places[0] || (dest ? dest.slice("destination:".length) : "");
    return isGeographicPlace(raw, catalog) ? raw : "";
  }

  function hasTag(tags, key) {
    return tags.indexOf(key) >= 0;
  }

  function thematicOf(category, tags) {
    if (THEMATIC.indexOf(category) >= 0) return category;
    for (let i = 0; i < THEMATIC.length; i++) {
      if (hasTag(tags, THEMATIC[i])) return THEMATIC[i];
    }
    return "";
  }

  function selectAd(selection, policyOpt, catalogOpt) {
    const policy = adPolicy(policyOpt);
    const catalog = loadCatalog(catalogOpt);
    const sel = selection && typeof selection === "object" ? selection : {};
    const reason = String(sel.reasonCode || "");
    const source = String(sel.sourceKind || "");
    if (policy.mockFill !== true) return emptyAd("ad-policy-off");
    const deny = {};
    (policy.emptyWhen || []).forEach(key => { deny[key] = true; });
    if (deny[reason] || deny[source] || sel.injectionIgnored === true) {
      return emptyAd(sel.injectionIgnored || reason === "prompt-injection-ignored" ? "ad-injection-denied" : "ad-private-denied");
    }
    const tags = Array.isArray(sel.tags) ? sel.tags.map(String) : [];
    const category = String(sel.category || "");
    const theme = thematicOf(category, tags);
    const placeId = destinationPlace(sel, catalog);
    const placeLabel = humanizePlace(placeId);
    const bg = String(sel.backgroundId || "");
    const ambiguous = sel.ambiguous === true || reason === "collision";
    const genericRoom = ambiguous
      || reason === "no-signal"
      || reason === "empty-title"
      || reason === "below-threshold"
      || hasTag(tags, "neutral")
      || !theme;

    if (genericRoom) {
      return mockAd("generic", {
        kickerKey: "sv.adKickerRoom",
        headlineKey: "sv.adHeadlineRoom",
        backgroundId: "bg-mingl-room",
        stencilId: "st-people",
        reasonCode: "ad-generic-room"
      });
    }
    if (theme === "fashion") {
      return mockAd("fashion", {
        placeId,
        placeLabel,
        kickerKey: "sv.adKickerFashion",
        headlineKey: placeLabel ? "sv.adHeadlineFashionPlace" : "sv.adHeadlineFashion",
        headlineVars: placeLabel ? {place: placeLabel} : {},
        backgroundId: bg,
        stencilId: "st-fashion",
        reasonCode: placeLabel ? "ad-fashion-place" : "ad-fashion"
      });
    }
    if (theme === "dining") {
      return mockAd("dining", {
        placeId,
        placeLabel,
        kickerKey: "sv.adKickerDining",
        headlineKey: "sv.adHeadlineDining",
        backgroundId: bg || "bg-dining",
        stencilId: "st-restaurant",
        reasonCode: "ad-dining"
      });
    }
    if (theme === "nightclub") {
      return mockAd("nightclub", {
        kickerKey: "sv.adKickerNightlife",
        headlineKey: "sv.adHeadlineNightlife",
        backgroundId: bg,
        stencilId: "st-nightclub",
        reasonCode: "ad-nightclub"
      });
    }
    if (theme === "sports") {
      return mockAd("sports", {
        kickerKey: "sv.adKickerSports",
        headlineKey: "sv.adHeadlineSports",
        backgroundId: bg,
        stencilId: "st-sports",
        reasonCode: "ad-sports"
      });
    }
    if (theme === "event") {
      return mockAd("event", {
        kickerKey: "sv.adKickerEvent",
        headlineKey: "sv.adHeadlineEvent",
        backgroundId: bg,
        stencilId: "st-ticket",
        reasonCode: "ad-event"
      });
    }
    if (theme === "hotel") {
      return mockAd("hotel", {
        kickerKey: "sv.adKickerHotel",
        headlineKey: "sv.adHeadlineHotel",
        backgroundId: bg,
        stencilId: "st-hotel",
        reasonCode: "ad-hotel"
      });
    }
    return mockAd("travel", {
      placeId,
      placeLabel,
      kickerKey: "sv.adKickerTravel",
      headlineKey: placeLabel ? "sv.adHeadlineFlyTo" : "sv.adHeadlineTravel",
      headlineVars: placeLabel ? {place: placeLabel} : {},
      backgroundId: bg,
      stencilId: "st-flight",
      reasonCode: placeLabel ? "ad-travel-place" : "ad-travel"
    });
  }

  return {
    SCHEMA,
    CONFIDENCE_THRESHOLD,
    TYPO_THRESHOLD,
    DEFAULT_AD_POLICY,
    PLACE_CARD_DEFAULTS,
    loadCatalog,
    classify,
    resolve,
    resolvePlaceCard,
    urlsFor,
    contentHash,
    geminiAllowed,
    adPolicy,
    humanizePlace,
    selectAd,
    fold,
    similarity
  };
});
