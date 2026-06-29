/* FLOQR AI core service.
   Static-app safe: no API keys, no required AI provider, local fallback first. */
(function () {
  "use strict";

  const PROTECTED_TERMS = ["FLOQR", "ShoutOut", "Mingl", "Bata"];
  const AI_FLAGS = {
    enabled: () => window.FLOQR_AI_ENABLED === true,
    provider: () => window.FLOQR_AI_PROVIDER || "firebase-ai-logic",
    fallbackMode: () => window.FLOQR_AI_FALLBACK_MODE || "local-contextual-search",
    templateHelpEnabled: () => window.FLOQR_AI_TEMPLATE_HELP_ENABLED !== false
  };

  const SEARCH_ALIASES = {
    hiphop: ["hip hop", "hiphop", "rap"],
    "hip hop": ["hip hop", "hiphop", "rap"],
    afrobeats: ["afrobeats", "afro beats", "afrobeat", "afro beats"],
    "afro beats": ["afrobeats", "afro beats", "afrobeat"],
    amapiano: ["amapiano", "afro house", "afrohouse"],
    latin: ["latin", "latina", "latino", "reggaeton"],
    girls: ["girls", "women", "female", "ladies"],
    women: ["girls", "women", "female", "ladies"],
    cars: ["cars", "fast cars", "luxury cars", "coupe", "ferrari", "rolls royce"],
    dc: ["dc", "washington dc", "washington district of columbia"],
    "washington dc": ["dc", "washington dc", "washington district of columbia"],
    merch: ["merch", "merchandise", "apparel", "bata"],
    comedy: ["comedy", "comedy show", "comedian", "stand up"],
    club: ["club", "nightclub", "lounge", "nightlife"],
    ticket: ["ticket", "tickets", "entry", "ticketmaster", "eventbrite", "resale"],
    template: ["template", "background", "board", "variant"],
    flowers: ["flowers", "floral", "roses", "flower"],
    tattoos: ["tattoos", "tattoo", "ink", "body art"]
  };

  const ROLE_ALIASES = {
    master: "masterAdmin",
    "master admin": "masterAdmin",
    super: "masterAdmin",
    "super admin": "masterAdmin",
    admin: "clubAdmin",
    "club admin": "clubAdmin",
    venue: "clubAdmin",
    patron: "patron",
    promoter: "promoter",
    dj: "dj",
    csr: "csr",
    hospitality: "venueStaff",
    staff: "venueStaff"
  };

  function restoreProtectedTerms(value) {
    let out = String(value || "");
    PROTECTED_TERMS.forEach(term => {
      const re = new RegExp(term, "ig");
      out = out.replace(re, term);
    });
    return out;
  }

  function normalizeQuery(value) {
    return restoreProtectedTerms(String(value || ""))
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function compact(value) {
    return normalizeQuery(value).replace(/[^a-z0-9]/g, "");
  }

  function expandedTokens(query) {
    const raw = normalizeQuery(query).split(/\s+/).filter(Boolean);
    const pairs = [];
    for (let i = 0; i < raw.length; i += 1) {
      pairs.push(raw[i]);
      if (raw[i + 1]) pairs.push(`${raw[i]} ${raw[i + 1]}`);
    }
    const out = new Set();
    pairs.forEach(token => {
      out.add(token);
      (SEARCH_ALIASES[token] || SEARCH_ALIASES[compact(token)] || []).forEach(alias => {
        normalizeQuery(alias).split(/\s+/).filter(Boolean).forEach(part => out.add(part));
        out.add(normalizeQuery(alias));
      });
    });
    return Array.from(out).filter(Boolean);
  }

  function editDistanceWithin(a, b, limit) {
    if (!a || !b || Math.abs(a.length - b.length) > limit) return false;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const curr = [i];
      let rowMin = curr[0];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        rowMin = Math.min(rowMin, curr[j]);
      }
      if (rowMin > limit) return false;
      for (let j = 0; j < curr.length; j += 1) prev[j] = curr[j];
    }
    return prev[b.length] <= limit;
  }

  function valueList(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (value && typeof value === "object") return Object.values(value).flatMap(valueList);
    return String(value || "").split(/[,;|/]+/).map(x => x.trim()).filter(Boolean);
  }

  function roleSet(context = {}) {
    const roles = new Set(["patron"]);
    valueList(context.role || context.roles || context.currentRole).forEach(role => {
      const key = normalizeQuery(role);
      roles.add(ROLE_ALIASES[key] || role);
    });
    const profile = context.profile || context.userProfile || {};
    valueList([profile.memberLevel, profile.role, profile.approvedRole, profile.roles, profile.approvedRoles]).forEach(role => {
      const key = normalizeQuery(role);
      roles.add(ROLE_ALIASES[key] || role);
    });
    return roles;
  }

  function uidFromContext(context = {}) {
    return context.uid || context.userUid || context.currentUser?.uid || context.user?.uid || "";
  }

  function isVisibleRecord(record = {}, context = {}) {
    const data = record.data || record;
    const status = normalizeQuery(record.status || data.status || "");
    if (status === "deleted" || status === "unapproved" || status === "rejected") return false;
    if (data.aiIndexExcluded === true || data.privateIndex === true) return false;

    const visibility = normalizeQuery(record.visibility || data.visibility || data.publicProfileVisibility || "public");
    const ownerUid = record.ownerUid || data.ownerUid || data.uid || data.submittedByUid || "";
    const uid = uidFromContext(context);
    if (visibility === "private") return !!uid && ownerUid === uid;

    const allowedUids = valueList(record.allowedUids || data.allowedUids);
    if (allowedUids.length && (!uid || !allowedUids.includes(uid))) return false;

    const allowedRoles = valueList(record.allowedRoles || data.allowedRoles);
    if (allowedRoles.length) {
      const roles = roleSet(context);
      if (!allowedRoles.some(role => roles.has(role))) return false;
    }

    if (visibility && !["public", "shared", "followers", "visible"].includes(visibility) && ownerUid !== uid) return false;
    return true;
  }

  function recordText(record = {}) {
    const data = record.data || record;
    const parts = [
      record.title, record.summary, record.sourceType, record.type, record.collection,
      data.title, data.name, data.eventName, data.locationName, data.brandName,
      data.baseTemplateName, data.variantName, data.ownerDisplayName,
      data.city, data.region, data.stateRegion, data.country, data.locationLabel,
      data.category, data.categories, data.genres, data.artists, data.tags,
      data.keywords, data.searchKeywords, data.description, data.aiSummary,
      data.activityDates, data.eventDay, data.eventDate, data.eventTime,
      data.officialWebsite, data.website, data.telephone, data.email,
      data.socialMediaHandles, data.socialHandles, record.searchText
    ];
    return valueList(parts).join(" ");
  }

  function scoreRecord(query, record) {
    const normalized = normalizeQuery(query);
    if (!normalized) return 1;
    const tokens = expandedTokens(normalized);
    const hay = normalizeQuery(recordText(record));
    const hayCompact = compact(hay);
    const hayTokens = hay.split(/\s+/).filter(Boolean);
    let score = 0;
    tokens.forEach(token => {
      const t = normalizeQuery(token);
      const tc = compact(t);
      if (!tc) return;
      if (hay.includes(t)) score += t.includes(" ") ? 4 : 3;
      else if (hayCompact.includes(tc)) score += 2;
      else {
        const tolerance = tc.length >= 7 ? 2 : tc.length >= 4 ? 1 : 0;
        if (tolerance && hayTokens.some(candidate => editDistanceWithin(tc, candidate, tolerance))) score += 1;
      }
    });
    const data = record.data || record;
    if (data.city && normalized.includes(normalizeQuery(data.city))) score += 3;
    if (data.country && normalized.includes(normalizeQuery(data.country))) score += 2;
    if ((record.sourceType || record.type || "").includes("template") && /template|background|birthday|flower|tattoo|video/.test(normalized)) score += 2;
    if ((record.sourceType || record.type || "").includes("bata") && /bata|merch|market|apparel/.test(normalized)) score += 2;
    if ((record.sourceType || record.type || "").includes("event") && /ticket|event|tonight|weekend|comedy|show/.test(normalized)) score += 2;
    return score;
  }

  async function logSearch(query, context, resultCount, mode) {
    try {
      const db = context.db || (window.firebase?.apps?.length ? firebase.firestore() : null);
      const uid = uidFromContext(context);
      if (!db || !uid) return;
      await db.collection("aiSearchLogs").add({
        uid,
        query: String(query || "").slice(0, 220),
        source: context.source || context.collection || "floqrSearch",
        role: Array.from(roleSet(context)).join(","),
        mode,
        resultCount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {
      console.warn("FLOQR AI search log skipped:", e.message);
    }
  }

  async function localContextualSearch(query, context = {}) {
    const records = Array.isArray(context.records) ? context.records : [];
    const visible = records.filter(record => isVisibleRecord(record, context));
    const scored = visible
      .map(record => ({ record, score: scoreRecord(query, record) }))
      .filter(item => !normalizeQuery(query) || item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, context.limit || 80)
      .map(item => Object.assign({}, item.record, {
        _score: item.score,
        _matchMode: AI_FLAGS.fallbackMode()
      }));
    await logSearch(query, context, scored.length, AI_FLAGS.fallbackMode());
    return scored;
  }

  async function aiSemanticSearch(query, context = {}) {
    if (!AI_FLAGS.enabled()) return localContextualSearch(query, context);
    try {
      if (context.callableSearch) return context.callableSearch(query, context);
      if (window.firebase?.functions && context.functionsRegion) {
        const fn = firebase.app().functions(context.functionsRegion).httpsCallable("aiSearch");
        const res = await fn({ query, context: { source: context.source, role: context.role } });
        return res?.data?.results || [];
      }
    } catch(e) {
      console.warn("FLOQR AI provider unavailable, using local fallback:", e.message);
    }
    return localContextualSearch(query, context);
  }

  async function floqrSearch(query, context = {}) {
    const normalized = normalizeQuery(query);
    if (AI_FLAGS.enabled()) return aiSemanticSearch(normalized, context);
    return localContextualSearch(normalized, context);
  }

  function safeShoutOutSuggestion(inputs = {}) {
    const tone = normalizeQuery(inputs.tone || "party");
    const main = String(inputs.mainText || "").trim();
    const template = normalizeQuery(inputs.templateId || "");
    const pool = [
      {tone:"vip", main:"VIP ShoutOut IN THE BUILDING", sub:"Luxury energy all night."},
      {tone:"funny", main:"BIG ShoutOut TO THE TABLE", sub:"They came to celebrate."},
      {tone:"romantic", main:"LOVE IS IN THE ROOM", sub:"A perfect night for two."},
      {tone:"birthday", main:"HAPPY BIRTHDAY", sub:"Your ShoutOut moment is live."},
      {tone:"classy", main:"TONIGHT IS YOUR NIGHT", sub:"Elegant, bright, unforgettable."},
      {tone:"party", main:"THE PARTY STARTS HERE", sub:"Big ShoutOut energy."},
      {tone:"corporate", main:"WELCOME TO THE CELEBRATION", sub:"A polished ShoutOut moment."},
      {tone:"graduation", main:"CONGRATS GRAD", sub:"The future starts tonight."}
    ];
    const picked = pool.find(item => tone.includes(item.tone)) || pool.find(item => template.includes(item.tone)) || pool[5];
    const limit = Number(inputs.mainLimit || 36);
    const mainText = restoreProtectedTerms((main || picked.main).replace(/[^a-zA-Z0-9 @!?.'-]/g, " ").replace(/\s+/g, " ").trim()).slice(0, limit);
    const subText = restoreProtectedTerms(picked.sub).slice(0, Number(inputs.subLimit || 60));
    return {
      mainText,
      subText,
      tone: picked.tone,
      providerMode: AI_FLAGS.enabled() ? "ai-ready" : "curated-fallback",
      safetyStatus: "passed"
    };
  }

  function functionsClient() {
    if (!window.firebase?.app || !window.firebase?.functions) return null;
    const region = window.FLOQR_AI_FUNCTIONS_REGION || "us-central1";
    try {
      return firebase.app().functions(region);
    } catch (error) {
      return null;
    }
  }

  async function aiSuggestShoutOut(inputs = {}) {
    const fallback = () => safeShoutOutSuggestion(inputs);
    if (!AI_FLAGS.templateHelpEnabled()) return fallback();
    const client = functionsClient();
    if (!client) return fallback();
    try {
      const functionName = window.FLOQR_AI_SHOUTOUT_SUGGEST_FUNCTION || "aiSuggestShoutOut";
      const callable = client.httpsCallable(functionName);
      const response = await callable({
        mainText:String(inputs.mainText || "").slice(0, 120),
        subText:String(inputs.subText || "").slice(0, 120),
        templateId:String(inputs.templateId || "").slice(0, 80),
        clubLocationId:String(inputs.clubLocationId || "").slice(0, 120),
        eventType:String(inputs.eventType || "").slice(0, 80),
        tone:String(inputs.tone || "party").slice(0, 40),
        mainLimit:Number(inputs.mainLimit || 36),
        subLimit:Number(inputs.subLimit || 60)
      });
      const data = response?.data || {};
      if (!data.mainText && !data.subText) throw new Error("AI suggestion response was empty.");
      const safeFallback = fallback();
      return {
        ...safeFallback,
        ...data,
        mainText:restoreProtectedTerms(String(data.mainText || safeFallback.mainText || "").slice(0, Number(inputs.mainLimit || 36))),
        subText:restoreProtectedTerms(String(data.subText || safeFallback.subText || "").slice(0, Number(inputs.subLimit || 60))),
        providerMode:data.provider || data.providerMode || "gemini"
      };
    } catch (error) {
      console.warn("FLOQR ShoutOut AI suggestion fallback used:", error?.message || error);
      return fallback();
    }
  }

  window.FLOQRAI = {
    protectedTerms: PROTECTED_TERMS,
    normalizeQuery,
    floqrSearch,
    aiSemanticSearch,
    localContextualSearch,
    isVisibleRecord,
    scoreRecord,
    recordText,
    roleSet,
    safeShoutOutSuggestion,
    aiSuggestShoutOut
  };
  window.normalizeQuery = normalizeQuery;
  window.floqrSearch = floqrSearch;
  window.aiSemanticSearch = aiSemanticSearch;
  window.localContextualSearch = localContextualSearch;
  window.floqrSuggestShoutOut = safeShoutOutSuggestion;
  window.floqrSuggestShoutOutAsync = aiSuggestShoutOut;
})();
