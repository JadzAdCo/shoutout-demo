/* FLOQR Features SMARTview — catalog helpers (public projection, retrieval, ingest sanitize).
   Same file is copied to functions/features-smartview-core.js (byte-identical). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FLOQRFeaturesSmartViewCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA_VERSION = "floqr.featuresSmartView/1";
  const KIND = "featuresSmartView";
  const PRODUCT_IDS = Object.freeze([
    "bot-dee", "mingl", "shoutout", "rydr", "floqcast", "vip-reserv", "si-nema", "si-tube"
  ]);
  const DISPLAY_NAMES = Object.freeze({
    "bot-dee": "BOT-DEE",
    mingl: "Mingl",
    shoutout: "ShoutOut",
    rydr: "RydR",
    floqcast: "floqCast",
    "vip-reserv": "VIP reserV",
    "si-nema": "Si-nema",
    "si-tube": "Si-tube"
  });
  const LIFECYCLES = Object.freeze([
    "concept", "planned", "in_development", "beta", "released", "deprecated", "retired"
  ]);
  const LIFECYCLE_LABELS = Object.freeze({
    concept: "Concept",
    planned: "Planned",
    in_development: "In development",
    beta: "Beta",
    released: "Released",
    deprecated: "Deprecated",
    retired: "Retired"
  });
  const STATUS_PRODUCTION = "Production";
  const STATUS_TESTING = "Testing";
  const STATUS_BETA = "Beta";
  const STATUS_IN_DEVELOPMENT = "In development";
  const STATUS_STEPS = Object.freeze([
    STATUS_PRODUCTION, STATUS_TESTING, STATUS_BETA, STATUS_IN_DEVELOPMENT
  ]);
  const DATE_NOT_VERIFIED = "Not verified";
  const PACKAGED_FEATURE_FLAGS = Object.freeze({
    botDee: Object.freeze({IsFeatureEnabled: 1, IsTestFeature: 1}),
    mingl: Object.freeze({IsFeatureEnabled: 0, IsTestFeature: 1}),
    shoutOut: Object.freeze({IsFeatureEnabled: 1, IsTestFeature: 0}),
    rydr: Object.freeze({IsFeatureEnabled: 0, IsTestFeature: 1}),
    floqCast: Object.freeze({IsFeatureEnabled: 0, IsTestFeature: 1}),
    vipReservations: Object.freeze({IsFeatureEnabled: 0, IsTestFeature: 1}),
    sinema: Object.freeze({IsFeatureEnabled: 0, IsTestFeature: 1})
  });
  const VIEWS = Object.freeze([
    "overview", "whatsNew", "journey", "all", "comingSoon", "past"
  ]);
  const FEATURE_KEYS = Object.freeze({
    "bot-dee": "botDee",
    mingl: "mingl",
    shoutout: "shoutOut",
    rydr: "rydr",
    floqcast: "floqCast",
    "vip-reserv": "vipReservations",
    "si-nema": "sinema",
    "si-tube": ""
  });
  const TRY_ROUTES = Object.freeze({
    "bot-dee": "./botdee.html",
    mingl: "./mingl-chat.html",
    shoutout: "./",
    rydr: "./rydr.html",
    floqcast: "./floqcast-search.html",
    "vip-reserv": "./vip.html",
    "si-nema": "./sinema.html",
    "si-tube": ""
  });

  const INJECTION_PATTERNS = [
    /ignore (?:all )?(?:previous|prior|above) instructions/gi,
    /you are now (?:a|an|the) /gi,
    /system prompt/gi,
    /override (?:the )?(?:catalog|spec|prompt)/gi,
    /\bsk_live_[A-Za-z0-9]+\b/g,
    /\bsk_test_[A-Za-z0-9]+\b/g,
    /\bwhsec_[A-Za-z0-9]+\b/g,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/g
  ];

  function text(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max || 400);
  }

  function productDisplayName(productId) {
    return DISPLAY_NAMES[productId] || "";
  }

  function flag01(value) {
    return value === true || value === 1 || value === "1" ? 1 : 0;
  }

  /** Patron badge from Features & Services flags. Never invents a release date. */
  function flagStatusLabel(enabled, test) {
    if (flag01(enabled) === 1 && flag01(test) === 0) return STATUS_PRODUCTION;
    if (flag01(enabled) === 1 && flag01(test) === 1) return STATUS_TESTING;
    if (flag01(test) === 1) return STATUS_BETA;
    return STATUS_IN_DEVELOPMENT;
  }

  function flagsForKey(key, access) {
    const canon = String(key || "");
    const fromAccess = access && access.featureFlags && access.featureFlags[canon];
    if (fromAccess && typeof fromAccess === "object") {
      return {
        IsFeatureEnabled: flag01(fromAccess.IsFeatureEnabled),
        IsTestFeature: flag01(fromAccess.IsTestFeature)
      };
    }
    const packaged = PACKAGED_FEATURE_FLAGS[canon];
    if (packaged) {
      return {IsFeatureEnabled: packaged.IsFeatureEnabled, IsTestFeature: packaged.IsTestFeature};
    }
    return {IsFeatureEnabled: 0, IsTestFeature: 0};
  }

  function flagsForProductId(productId, access) {
    return flagsForKey(FEATURE_KEYS[productId] || "", access);
  }

  function lifecycleLabel(lifecycle, statusVerified, flags) {
    if (statusVerified) return LIFECYCLE_LABELS[lifecycle] || STATUS_IN_DEVELOPMENT;
    return flagStatusLabel(flags && flags.IsFeatureEnabled, flags && flags.IsTestFeature);
  }

  function implementedLabel(record) {
    if (!record || !record.releaseDateVerified || !record.releasedAt) return DATE_NOT_VERIFIED;
    return String(record.releasedAt).slice(0, 10);
  }

  function sanitizeUntrustedText(raw, max) {
    let out = String(raw == null ? "" : raw).slice(0, max || 4000);
    INJECTION_PATTERNS.forEach(re => {
      out = out.replace(re, "[redacted]");
    });
    return out.replace(/\s+/g, " ").trim();
  }

  function isMaliciousPrContent(raw) {
    const sample = String(raw == null ? "" : raw);
    return INJECTION_PATTERNS.some(re => {
      re.lastIndex = 0;
      return re.test(sample);
    });
  }

  function normalizePrompt(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/[\u2018\u2019\u201B\u02BC']/g, "")
      .replace(/[^a-z0-9+@.\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function detectProductId(raw) {
    const q = normalizePrompt(raw);
    if (/\bsi[\s-]?tube\b|\bsitube\b/.test(q)) return "si-tube";
    if (/\bsi[\s-]?nema\b|\bsinema\b|\bspatial studio\b/.test(q)) return "si-nema";
    if (/\bvip\s*reserv\b|\bvip reserv\b|\breserv\b|\bvip tables?\b|\bvip\b/.test(q)) return "vip-reserv";
    if (/\bfloq\s*cast\b|\bfloqcast\b/.test(q)) return "floqcast";
    if (/\brydr\b|\bryd\s*r\b/.test(q)) return "rydr";
    if (/\bshout\s*out\b|\bshoutout\b/.test(q)) return "shoutout";
    if (/\bmingl\b|\bmingel\b/.test(q)) return "mingl";
    if (/\bbot[\s-]*dee\b|\bbotdee\b/.test(q)) return "bot-dee";
    return "";
  }

  /** Product-discovery questions. Never matches Ver/Vers/Version aliases or Room/Cancun. */
  function isFeaturesSmartViewPrompt(raw) {
    const q = normalizePrompt(raw);
    if (!q || q.length > 220) return false;
    if (/^(ver|vers|version)\??$/.test(q)) return false;
    if (/\bopen\s+room\s+smartview\b/.test(q) || /\bcancun\s+trip\b/.test(q)) return false;
    if (/\bthrow\b.{0,24}\bshout\s*out/.test(q)) return false;
    if (/\bhold\b.{0,24}\b(vip|table)\b/.test(q)) return false;
    const product = detectProductId(q) || (
      /\bfeatures?\s+smartview\b|\bwhat(?:'s|s| is)?\s+new\b|\bcoming soon\b|\bfeature journey\b/.test(q)
        ? "any"
        : ""
    );
    if (!product) return false;
    if (/\bwhat can\b/.test(q)) return true;
    if (/\bwhats?\s+(?:new|changed)\b|\bwhat(?:'s|s| is)?\s+(?:new|changed)\b/.test(q)) return true;
    if (/\bwhen (?:was|is|did)\b.{0,40}\b(implement|release|available|ship)/.test(q)) return true;
    if (/\bwhat is coming\b|\bcoming soon\b|\bplanned for\b/.test(q)) return true;
    if (/\bfeature journey\b|\ball features\b|\bfeatures smartview\b/.test(q)) return true;
    if (/\bwhat (?:is|does)\b.{0,32}\b(bot-?dee|mingl|shout\s*out|rydr|floq\s*cast|vip|si-?nema|si-?tube)\b/.test(q)) return true;
    if (/\btell me about\b.{0,24}\b(bot-?dee|mingl|shout\s*out|rydr|floq\s*cast|vip reser|si-?nema|si-?tube)\b/.test(q)) return true;
    return false;
  }

  function canMarkReleased(record) {
    if (!record || record.lifecycle !== "released") return false;
    if (!record.statusVerified) return false;
    if (record.availability !== "public" && record.availability !== "limited_beta") return false;
    const evidence = Array.isArray(record.sourceEvidence) ? record.sourceEvidence : [];
    const hasAvailability = evidence.some(row =>
      row && (row.kind === "deployment" || row.kind === "feature_flag" || row.kind === "manual_attestation")
    );
    return hasAvailability && record.releaseDateVerified === true;
  }

  function validateRecord(record, products) {
    const errors = [];
    if (!record || typeof record !== "object") return ["missing record"];
    if (!text(record.id, 80)) errors.push("id");
    if (!PRODUCT_IDS.includes(record.productId)) errors.push("productId");
    if (!LIFECYCLES.includes(record.lifecycle)) errors.push("lifecycle");
    if (typeof record.statusVerified !== "boolean") errors.push("statusVerified");
    if (typeof record.releaseDateVerified !== "boolean") errors.push("releaseDateVerified");
    if (typeof record.publicCopyApproved !== "boolean") errors.push("publicCopyApproved");
    if (!text(record.title, 120) || !text(record.shortDescription, 400)) errors.push("copy");
    if (record.lifecycle === "released" && !canMarkReleased(record)) {
      errors.push("released-without-availability-evidence");
    }
    if (record.releaseDateVerified && record.releasedAt && record.mergedAt && record.releasedAt === record.mergedAt) {
      errors.push("releasedAt-equals-mergedAt");
    }
    if (record.productId === "si-tube" && record.lifecycle === "released") {
      errors.push("si-tube-released-without-repo");
    }
    const product = (products || []).find(row => row && row.id === record.productId);
    if (product && product.presentInRepo === false && record.lifecycle === "released") {
      errors.push("released-missing-repo");
    }
    return errors;
  }

  function validateCatalog(catalog) {
    const errors = [];
    if (!catalog || catalog.schemaVersion !== SCHEMA_VERSION) errors.push("schemaVersion");
    const products = Array.isArray(catalog.products) ? catalog.products : [];
    const names = products.map(row => row.displayName);
    if (names.length !== 8) errors.push("product-count");
    PRODUCT_IDS.forEach((id, idx) => {
      if (!products[idx] || products[idx].id !== id) errors.push("product-order:" + id);
      if (!products[idx] || products[idx].displayName !== DISPLAY_NAMES[id]) errors.push("displayName:" + id);
    });
    const features = Array.isArray(catalog.features) ? catalog.features : [];
    const ids = new Set();
    features.forEach(row => {
      if (ids.has(row.id)) errors.push("duplicate:" + row.id);
      ids.add(row.id);
      validateRecord(row, products).forEach(code => errors.push(row.id + ":" + code));
    });
    return errors;
  }

  function publicEvidence(row) {
    if (!row || row.visibility !== "public") return null;
    if (!row.kind || row.kind === "pr" || row.kind === "commit") return null;
    return {
      kind: row.kind,
      note: sanitizeUntrustedText(row.note, 240),
      observedAt: text(row.observedAt, 40)
    };
  }

  function publicFeature(record, access) {
    const verified = !!record.statusVerified;
    const releasedOk = canMarkReleased(record);
    const tryOk = tryFeatureAllowed(record, access);
    const flags = flagsForProductId(record.productId, access);
    return {
      id: record.id,
      productId: record.productId,
      productName: productDisplayName(record.productId),
      title: record.title,
      category: record.category || "",
      shortDescription: record.shortDescription,
      accomplishment: record.accomplishment,
      patronBenefit: record.patronBenefit,
      // Evidence-backed catalog facts stay visible on the Features page even when
      // publicCopyApproved is false. What's New still requires editorial approval.
      previousBehavior: record.previousBehavior || "",
      currentBehavior: record.currentBehavior || "",
      proposedBehavior: record.proposedBehavior || "",
      lifecycle: record.lifecycle,
      lifecycleLabel: lifecycleLabel(record.lifecycle, verified, flags),
      statusVerified: verified,
      availability: record.availability || "unknown",
      audienceRoles: Array.isArray(record.audienceRoles) ? record.audienceRoles.slice() : [],
      mergedAt: record.mergedAt || "",
      releasedAt: releasedOk ? record.releasedAt : "",
      implementedLabel: implementedLabel(record),
      releaseDateVerified: releasedOk,
      publicCopyApproved: !!record.publicCopyApproved,
      catalogVersion: record.catalogVersion || 1,
      history: Array.isArray(record.history) ? record.history.filter(ev => ev && ev.public !== false).map(ev => ({
        type: ev.type,
        at: ev.at || "",
        note: sanitizeUntrustedText(ev.note, 240)
      })) : [],
      citations: [{featureId: record.id, href: "./features-smartview.html?feature=" + encodeURIComponent(record.id)}],
      tryAllowed: tryOk,
      tryRoute: tryOk ? (TRY_ROUTES[record.productId] || "") : "",
      featureKey: FEATURE_KEYS[record.productId] || "",
      presentInRepo: record.presentInRepo !== false
    };
  }

  function publicProduct(product, features, access) {
    const rows = features.filter(row => row.productId === product.id);
    const verifiedReleaseDates = rows
      .filter(row => row.releaseDateVerified && row.releasedAt)
      .map(row => row.releasedAt)
      .sort();
    const flags = flagsForProductId(product.id, access);
    return {
      id: product.id,
      displayName: product.displayName,
      mission: product.mission || "",
      lifecycleLabel: lifecycleLabel(product.lifecycle, !!product.statusVerified, flags),
      statusVerified: !!product.statusVerified,
      availableCount: rows.filter(row => row.statusVerified && (row.availability === "public" || row.availability === "limited_beta")).length,
      latestRelease: verifiedReleaseDates.length ? verifiedReleaseDates[verifiedReleaseDates.length - 1] : DATE_NOT_VERIFIED,
      presentInRepo: product.presentInRepo !== false,
      packaged: product.packaged || null,
      tryAllowed: tryProductAllowed(product, access),
      tryRoute: TRY_ROUTES[product.id] || ""
    };
  }

  function viewerAccess(raw) {
    const canAccessKeys = {};
    (raw && raw.canAccessKeys ? Object.keys(raw.canAccessKeys) : []).forEach(key => {
      canAccessKeys[key] = raw.canAccessKeys[key] === true;
    });
    const featureFlags = {};
    const incoming = raw && raw.featureFlags && typeof raw.featureFlags === "object" ? raw.featureFlags : {};
    Object.keys(incoming).forEach(key => {
      const row = incoming[key];
      if (!row || typeof row !== "object") return;
      featureFlags[key] = {
        IsFeatureEnabled: flag01(row.IsFeatureEnabled),
        IsTestFeature: flag01(row.IsTestFeature)
      };
    });
    return {
      role: text(raw && raw.role, 40) || "patron",
      canAccessKeys,
      isMasterAdmin: raw && raw.isMasterAdmin === true,
      featureFlags
    };
  }

  function tryFeatureAllowed(record, access) {
    if (!record || record.presentInRepo === false) return false;
    if (!record.statusVerified) return false;
    if (record.lifecycle !== "released" && record.lifecycle !== "beta") return false;
    if (record.availability !== "public" && record.availability !== "limited_beta") return false;
    const key = FEATURE_KEYS[record.productId];
    if (!key) return false;
    const granted = access && access.canAccessKeys && access.canAccessKeys[key] === true;
    const master = !!(access && access.isMasterAdmin);
    return !!granted || master;
  }

  function tryProductAllowed(product, access) {
    if (!product || product.presentInRepo === false) return false;
    const key = FEATURE_KEYS[product.id];
    if (!key) return false;
    return !!(access && access.canAccessKeys && access.canAccessKeys[key]);
  }

  function publicProjection(catalog, accessRaw) {
    const access = viewerAccess(accessRaw);
    const products = (catalog.products || []).map(product =>
      publicProduct(product, catalog.features || [], access)
    );
    const features = (catalog.features || []).map(row => publicFeature(row, access));
    return {
      schemaVersion: SCHEMA_VERSION,
      catalogVersion: catalog.catalogVersion || 1,
      warning: catalog.warning || "",
      products,
      features,
      views: VIEWS.slice()
    };
  }

  function filterFeatures(features, query) {
    const view = query.view || "all";
    const productId = query.productId || "";
    const needle = normalizePrompt(query.q || "");
    return (features || []).filter(row => {
      if (productId && row.productId !== productId) return false;
      if (query.lifecycle && row.lifecycleLabel !== query.lifecycle) return false;
      if (view === "whatsNew") {
        return row.publicCopyApproved && row.lifecycle === "released" && row.releaseDateVerified;
      }
      if (view === "comingSoon") {
        return row.lifecycleLabel === STATUS_IN_DEVELOPMENT;
      }
      if (view === "past") {
        return row.lifecycleLabel === LIFECYCLE_LABELS.deprecated
          || row.lifecycleLabel === LIFECYCLE_LABELS.retired
          || row.lifecycle === "deprecated"
          || row.lifecycle === "retired";
      }
      if (needle) {
        const hay = normalizePrompt([
          row.title, row.shortDescription, row.accomplishment, row.patronBenefit, row.productName
        ].join(" "));
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }

  function retrieve(catalog, prompt, accessRaw) {
    const access = viewerAccess(accessRaw);
    const productId = detectProductId(prompt);
    const q = normalizePrompt(prompt);
    const projection = publicProjection(catalog, access);
    let view = "overview";
    if (/\bcoming soon\b|\bwhat is coming\b|\bplanned\b/.test(q)) view = "comingSoon";
    else if (/\bwhats?\s+new\b|\bwhat(?:'s|s| is)?\s+new\b|\bwhat changed\b/.test(q)) view = "whatsNew";
    else if (/\bpast\b|\bretired\b|\bdeprecated\b/.test(q)) view = "past";
    else if (/\bjourney\b/.test(q)) view = "journey";
    else if (/\ball features\b/.test(q)) view = "all";
    const rows = filterFeatures(projection.features, {view: view === "overview" ? "all" : view, productId, q: ""});
    const product = projection.products.find(row => row.id === productId) || null;
    const admit = !rows.some(row => row.statusVerified && row.lifecycle === "released" && row.releaseDateVerified);
    return {
      kind: KIND,
      schemaVersion: SCHEMA_VERSION,
      productId: productId || "",
      productName: product ? product.displayName : (productId ? productDisplayName(productId) : ""),
      view,
      admitUncertainty: admit,
      features: rows.slice(0, 12),
      products: product ? [product] : projection.products,
      citations: rows.slice(0, 8).map(row => row.citations[0]),
      warning: projection.warning
    };
  }

  function buildSmartView(catalog, prompt, accessRaw) {
    const payload = retrieve(catalog, prompt, accessRaw);
    const productName = payload.productId ? (payload.productName || productDisplayName(payload.productId)) : "";
    const named = !!productName;
    let reply;
    if (!payload.features.length && payload.view === "whatsNew") {
      reply = named
        ? "What's New lists only approved, verified releases. None are published for " + productName + " yet."
        : "What's New lists only approved, verified releases. None are published yet.";
    } else if (payload.admitUncertainty) {
      if (named) {
        const flags = flagsForProductId(payload.productId, accessRaw);
        const status = flagStatusLabel(flags.IsFeatureEnabled, flags.IsTestFeature);
        reply = productName + " is " + status + ". Dates are not verified. I will not treat a plan as shipped.";
      } else {
        reply = "Dates are not verified. Status is Production, Testing, Beta, or In development from Features & Services flags. I will not treat a plan as shipped.";
      }
    } else {
      reply = named
        ? "Here is the published Features SMARTview for " + productName + "."
        : "Here is the published Features SMARTview.";
    }
    return {
      handled: true,
      reply,
      provider: "local-features-smartview",
      model: "featuresSmartView",
      replyKey: payload.admitUncertainty ? "fsv.replyUnverified" : "fsv.replyOk",
      smartViews: [payload]
    };
  }

  function ingestPrPage(items, seen) {
    const nextSeen = seen && typeof seen === "object" ? seen : {};
    const added = [];
    (items || []).forEach(pr => {
      const number = Number(pr && pr.number);
      if (!number) return;
      const key = "pr:" + number;
      if (nextSeen[key]) return;
      const title = sanitizeUntrustedText(pr.title, 180);
      const body = sanitizeUntrustedText(pr.body, 800);
      const malicious = isMaliciousPrContent(pr.title) || isMaliciousPrContent(pr.body);
      nextSeen[key] = {
        number,
        title,
        body: malicious ? "[untrusted-pr-text]" : body,
        state: pr.state || "",
        draft: !!pr.draft,
        mergedAt: pr.merged_at || pr.mergedAt || "",
        closedAt: pr.closed_at || pr.closedAt || "",
        url: pr.html_url || pr.url || "",
        sha: pr.merge_commit_sha || pr.mergeCommitSha || "",
        productId: detectProductId(title),
        untrusted: true,
        malicious,
        publishable: false
      };
      added.push(nextSeen[key]);
    });
    return {seen: nextSeen, added, complete: !items || items.length === 0};
  }

  function mapIngestToDraft(entry) {
    if (!entry || entry.malicious || entry.draft || !entry.mergedAt) return null;
    if (entry.state === "closed" && !entry.mergedAt) return null;
    return {
      id: "draft.pr." + entry.number,
      productId: entry.productId || "",
      title: entry.title,
      lifecycle: "in_development",
      statusVerified: false,
      availability: "unknown",
      mergedAt: entry.mergedAt,
      releasedAt: "",
      releaseDateVerified: false,
      publicCopyApproved: false,
      sourceEvidence: [{
        kind: "pr",
        prNumber: entry.number,
        sha: entry.sha,
        url: entry.url,
        visibility: "internal",
        observedAt: entry.mergedAt,
        note: "PR merged — not proof of patron availability"
      }]
    };
  }

  return {
    SCHEMA_VERSION,
    KIND,
    PRODUCT_IDS,
    DISPLAY_NAMES,
    LIFECYCLES,
    LIFECYCLE_LABELS,
    STATUS_PRODUCTION,
    STATUS_TESTING,
    STATUS_BETA,
    STATUS_IN_DEVELOPMENT,
    STATUS_STEPS,
    DATE_NOT_VERIFIED,
    PACKAGED_FEATURE_FLAGS,
    VIEWS,
    FEATURE_KEYS,
    TRY_ROUTES,
    text,
    productDisplayName,
    flag01,
    flagStatusLabel,
    flagsForKey,
    flagsForProductId,
    lifecycleLabel,
    implementedLabel,
    sanitizeUntrustedText,
    isMaliciousPrContent,
    detectProductId,
    isFeaturesSmartViewPrompt,
    canMarkReleased,
    validateRecord,
    validateCatalog,
    publicFeature,
    publicProjection,
    filterFeatures,
    retrieve,
    buildSmartView,
    tryFeatureAllowed,
    ingestPrPage,
    mapIngestToDraft
  };
});
