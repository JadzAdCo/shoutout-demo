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

  return {
    SCHEMA,
    CONFIDENCE_THRESHOLD,
    TYPO_THRESHOLD,
    loadCatalog,
    classify,
    resolve,
    urlsFor,
    contentHash,
    geminiAllowed,
    fold,
    similarity
  };
});
