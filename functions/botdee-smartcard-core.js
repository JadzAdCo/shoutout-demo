/* People SMARTcard v6 — compact projections of the same authorized
   usercharacter_analysis + public profile as People SMARTview.
   No independent card summary store. No Gemini on card render. */
"use strict";

const v2 = require("./botdee-smartview-v2-core");

const PAGE_SIZE = 4;
const SCHEMA_VERSION = "floqr.peopleSmartCard/6";
const SELF_QUERY = /^(me|myself|my profile|my account|my info|my information|about me|who am i|what(?:'s| is| do you) know (?:about|of) (?:me|myself)|tell me about (?:me|myself)|describe (?:me|myself)|what can you tell me about (?:me|myself))$/i;

const WHO_IS = /^(?:who(?:'s| is| s))\s+/i;
const DO_YOU_KNOW = /^(?:do you know|did you meet)\s+/i;
const KNOW_OF = /^(?:what(?:'s| is| do you) know (?:of|about)|what can you tell me about|tell me about|describe)\s+/i;
const PROFILE_OF = /^(?:what(?:'s| is) (?:on )?(?:the )?profile (?:of|for)|look up|lookup)\s+/i;
const PERSON_PREFIX = /^(?:who(?:'s| is| s)|do you know|did you meet|look up|lookup|find|search for|what(?:'s| is) (?:on )?(?:the )?profile (?:of|for)|what(?:'s| is| do you) know (?:of|about)|what can you tell me about|tell me about|describe)\s+/i;
const PERSON_SUFFIX = /\s+(?:on floqr|on mingl|on here|(?:['’]s)?\s*(?:public )?profile)\s*$/i;
const STOP_AFTER = /^(working|on (?:duty|tonight)|the (?:dj|club)|playing|singing|available)\b/i;
const GENERIC_PERSON = /^(this person|that person|them|him|her|someone|anybody|anyone)$/i;
const VENUE_NEEDLE = /^(a |an |the )?(djs?|clubs?|venues?|events?|shoutouts?|vips?|tables?)\b/i;
const PRODUCT_NEEDLE = /^(?:a |an |the )?(?:bot\s*dee|botdee|floq\s*ai|floqai|floqr|shout\s*outs?|mingl|floq\s*casts?|bartr|bart\s*r|rydr|vip(?:\s*reserv)?)\s*$/i;
const OPERATIONAL = /\b(tonight|today|near me|on duty|available|playing|working)\b/i;

function text(value, max = 160) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeQuery(raw) {
  return text(raw, 200).toLowerCase().replace(/[?!.,]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractPersonNeedle(raw) {
  const original = text(raw, 200);
  const n = normalizeQuery(original);
  if (!n) return "";
  if (SELF_QUERY.test(n)) return "";
  let rest = original.replace(PERSON_PREFIX, "").replace(PERSON_SUFFIX, "").trim();
  rest = rest.replace(/^[@]+/, "").replace(/["“”']/g, "").replace(/[?!.,]+$/g, "").trim();
  const needle = normalizeQuery(rest);
  if (!needle || needle.length < 2) return "";
  if (STOP_AFTER.test(needle) || GENERIC_PERSON.test(needle)) return "";
  if (VENUE_NEEDLE.test(needle) || PRODUCT_NEEDLE.test(needle) || OPERATIONAL.test(needle)) return "";
  return rest;
}

function foldNamePunct(value) {
  return String(value || "").replace(/['’]/g, "'");
}

function isPersonNameNeedle(rest) {
  const trimmed = foldNamePunct(String(rest || "").replace(/[?!]+$/g, "").trim());
  if (!trimmed) return false;
  if (/^@[\p{L}\p{M}0-9_.-]+$/u.test(trimmed)) return true;
  const needle = normalizeQuery(trimmed);
  if (!needle || needle.length < 2) return false;
  if (STOP_AFTER.test(needle) || GENERIC_PERSON.test(needle)) return false;
  if (VENUE_NEEDLE.test(needle) || PRODUCT_NEEDLE.test(needle) || OPERATIONAL.test(needle)) return false;
  const tokens = needle.split(" ").filter(Boolean);
  if (!tokens.length || tokens.length > 4) return false;
  return tokens.every(token => /^@?[\p{L}\p{M}0-9_.'-]+$/u.test(token)
    && !/^(my|mine|our|your|their|his|her|this|that|these|those|who|what|where|when|how|the|a|an)$/.test(token)
    && !/^(djs?|clubs?|venues?|events?|shoutouts?|vips?|tables?|reservations?|bookings?|bottle|service|composer)$/.test(token));
}

function isFindPersonPrompt(raw) {
  const match = text(raw, 200).match(/^(?:find|search for)\s+(.+)$/i);
  if (!match) return false;
  return isPersonNameNeedle(match[1]);
}

function remainderAfterLookupPrefix(raw) {
  return text(raw, 200)
    .replace(WHO_IS, "")
    .replace(DO_YOU_KNOW, "")
    .replace(KNOW_OF, "")
    .replace(PROFILE_OF, "")
    .replace(PERSON_SUFFIX, "")
    .trim();
}

function isNamedProfileSuffix(raw) {
  const match = text(raw, 200).match(/^(.+?)(?:['’]s)?\s+(?:public )?profile\s*$/i);
  if (!match) return false;
  return isPersonNameNeedle(match[1].replace(/['’]s$/i, "").trim());
}

function isNamedNetworkSuffix(raw) {
  const match = text(raw, 200).match(/^(.+?)\s+(?:on floqr|on mingl|on here)\s*$/i);
  if (!match) return false;
  return isPersonNameNeedle(match[1]);
}

function isPeopleLookupPrompt(raw) {
  const original = text(raw, 200);
  if (WHO_IS.test(original) || DO_YOU_KNOW.test(original) || KNOW_OF.test(original) || PROFILE_OF.test(original)) {
    const rest = remainderAfterLookupPrefix(original);
    return isPersonNameNeedle(rest) || GENERIC_PERSON.test(normalizeQuery(rest));
  }
  return isFindPersonPrompt(original)
    || isNamedProfileSuffix(original)
    || isNamedNetworkSuffix(original);
}

function classifyPeopleSearchIntent(raw) {
  const n = normalizeQuery(raw);
  if (!n || n.length < 2) return {intent: "none", needle: "", self: false};
  if (SELF_QUERY.test(n) || /^(what do you know (?:about|of) me|tell me about my (?:public )?profile|what can you tell me about me)$/.test(n)) {
    return {intent: "self", needle: "me", self: true};
  }
  const original = text(raw, 200);
  if (!isPeopleLookupPrompt(original)) return {intent: "none", needle: "", self: false};
  const needle = extractPersonNeedle(raw);
  if (needle && isPersonNameNeedle(needle)) return {intent: "person", needle, self: false};
  const rest = normalizeQuery(remainderAfterLookupPrefix(original));
  if (GENERIC_PERSON.test(rest)) return {intent: "empty", needle: "", self: false};
  return {intent: "none", needle: "", self: false};
}

function looksLikeProfileFieldDump(raw) {
  const blob = String(raw || "");
  if (!blob.trim()) return false;
  const headings = ["Bio", "Location", "Details", "Looking to Meet", "Social Handles"];
  let hits = 0;
  for (const heading of headings) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\*\\*\\s*${escaped}\\s*\\*\\*`, "i").test(blob)
      || new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*:`, "im").test(blob)) {
      hits += 1;
    }
  }
  return hits >= 2;
}

function canonicalPeopleLookupQuery(classified) {
  if (!classified || classified.intent === "none") return "";
  if (classified.intent === "self") return "Who am I?";
  if (classified.intent === "empty") return "Who is this person?";
  const needle = text(classified.needle, 120).replace(/[?!.,]+$/g, "").trim();
  if (!needle) return "Who is this person?";
  return `Who is ${needle}?`;
}

const PEOPLE_CARD_PRIVILEGE_KEYS = Object.freeze([
  "isMasterAdmin", "isSuperAdmin", "superAdmin", "masterAdmin", "isClubAdmin",
  "clubAdmin", "clubAdminClubIds", "isBetaTester", "betaTester", "betaFeatures",
  "betaGrants", "sos2fa", "sos2faSession", "sos2faSessionHash", "claims",
  "customClaims", "tokenClaims", "idTokenClaims", "featureGates",
  "featureServiceFlags", "classificationRole", "viewerRole", "privileged", "role"
]);

function peopleCardHasPrivilegeField(value, depth = 0) {
  if (depth > 8 || value == null) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(item => peopleCardHasPrivilegeField(item, depth + 1));
  return Object.keys(value).some(key => (
    PEOPLE_CARD_PRIVILEGE_KEYS.some(name => name.toLowerCase() === String(key).toLowerCase())
    || peopleCardHasPrivilegeField(value[key], depth + 1)
  ));
}

function editorialProvenance(analysis, snap) {
  const authored = analysis && analysis.sourceAuthoredBy === "owner" ? "patron_edit" : "gemini";
  return {
    summary_source: authored,
    summary_version: Number(analysis && analysis.revision) || 0,
    summary_updated_at: analysis && analysis.updatedAtMs ? Number(analysis.updatedAtMs) : null,
    summary_locale: (analysis && analysis.sourceLocale) || (snap && snap.sourceLocale) || "en",
    source_profile_version: (snap && v2.publicFieldsHash(snap)) || (analysis && analysis.publicFieldsHash) || null
  };
}

function stampDiscoverable(doc, isPublicProfile) {
  const next = doc && typeof doc === "object" ? {...doc} : {};
  next.publicWithinFloqr = isPublicProfile ? 1 : 0;
  const provenance = editorialProvenance(next);
  next.summary_source = provenance.summary_source;
  next.summary_version = provenance.summary_version;
  next.summary_updated_at = provenance.summary_updated_at;
  next.summary_locale = provenance.summary_locale;
  next.source_profile_version = provenance.source_profile_version;
  return next;
}

function compactPeopleV2(peopleV2) {
  if (!peopleV2 || typeof peopleV2 !== "object") return null;
  const summaryText = text(peopleV2.summary && peopleV2.summary.text, v2.SUMMARY_MAX);
  return {
    ...peopleV2,
    presentation: "peopleSmartCard",
    summary: {
      ...(peopleV2.summary || {}),
      text: summaryText,
      excerpt: summaryText,
      clampLines: 4
    }
  };
}

function asSmartCardView(fullView) {
  if (!fullView || typeof fullView !== "object") return null;
  const people = fullView.floqrPublicData && fullView.floqrPublicData.peopleV2;
  const compact = compactPeopleV2(people);
  if (!compact) return null;
  return {
    ...fullView,
    floqrPublicData: {
      ...fullView.floqrPublicData,
      peopleV2: compact
    }
  };
}

function sameSubject(a, b) {
  return String(a || "") === String(b || "") && !!a;
}

function applyLiveProjection(cardView, nextFullView) {
  const currentId = cardView && cardView.floqrPublicData && cardView.floqrPublicData.peopleV2
    ? cardView.floqrPublicData.peopleV2.subjectUid
    : "";
  const nextId = nextFullView && nextFullView.floqrPublicData && nextFullView.floqrPublicData.peopleV2
    ? nextFullView.floqrPublicData.peopleV2.subjectUid
    : "";
  if (!sameSubject(currentId, nextId)) return cardView;
  const compact = nextFullView.floqrPublicData.peopleV2.presentation === "peopleSmartCard"
    ? nextFullView
    : asSmartCardView(nextFullView);
  return compact || cardView;
}

function redactView(view) {
  if (!view) return null;
  const people = view.floqrPublicData && view.floqrPublicData.peopleV2;
  if (!people) return null;
  return {
    ...view,
    title: "",
    summary: "",
    floqrPublicData: {
      peopleV2: {
        presentation: "peopleSmartCard",
        subjectUid: people.subjectUid,
        redacted: true,
        displayName: "",
        handle: "",
        city: "",
        handles: [],
        photo: null,
        summary: {text: "", status: "redacted"}
      }
    }
  };
}

function paginate(rows, page, pageSize = PAGE_SIZE) {
  const list = Array.isArray(rows) ? rows : [];
  const size = Math.max(1, Number(pageSize) || PAGE_SIZE);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const index = Math.min(pages, Math.max(1, Number(page) || 1));
  const start = (index - 1) * size;
  return {
    page: index,
    pageSize: size,
    pages,
    total,
    rows: list.slice(start, start + size),
    hasMore: index < pages
  };
}

function routePeopleSearch({self, matches, error, page}) {
  if (error) {
    return {
      mode: "error",
      eligibleCount: 0,
      views: [],
      geminiOnView: false,
      discloseExistence: false
    };
  }
  if (self) {
    return {
      mode: "self",
      eligibleCount: 1,
      views: [self],
      geminiOnView: false,
      discloseExistence: true
    };
  }
  const eligible = (Array.isArray(matches) ? matches : []).filter(Boolean);
  if (!eligible.length) {
    return {
      mode: "none",
      eligibleCount: 0,
      views: [],
      geminiOnView: false,
      discloseExistence: false
    };
  }
  if (eligible.length === 1) {
    return {
      mode: "one",
      eligibleCount: 1,
      views: eligible,
      geminiOnView: false,
      discloseExistence: true
    };
  }
  const paged = paginate(eligible.map(asSmartCardView).filter(Boolean), page);
  return {
    mode: "many",
    eligibleCount: eligible.length,
    views: paged.rows,
    page: paged.page,
    pages: paged.pages,
    hasMore: paged.hasMore,
    geminiOnView: false,
    discloseExistence: true
  };
}

function replyKeyForMode(mode) {
  if (mode === "self") return "botdee.sc.selfView";
  if (mode === "one") return "botdee.sc.oneResult";
  if (mode === "many") return "botdee.sc.selectPerson";
  if (mode === "error") return "botdee.sc.searchFailed";
  return "botdee.sc.none";
}

function fallbackReply(mode) {
  if (mode === "self") return "Here is your SMARTview.";
  if (mode === "one") return "Here is their SMARTview.";
  if (mode === "many") return "I found more than one eligible public profile. Select the right person to open their SMARTview.";
  if (mode === "error") return "People search could not finish. Try again in a moment.";
  return "No eligible public profile matched.";
}

function peopleSearchMeta(routed, classified, query) {
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: routed.mode,
    intent: classified.intent,
    query: String(query || classified.needle || "").slice(0, 200),
    eligibleCount: routed.eligibleCount,
    page: routed.page || 1,
    pages: routed.pages || 1,
    hasMore: !!routed.hasMore,
    geminiOnView: false,
    replyKey: replyKeyForMode(routed.mode)
  };
}

module.exports = {
  PAGE_SIZE,
  SCHEMA_VERSION,
  classifyPeopleSearchIntent,
  extractPersonNeedle,
  isPersonNameNeedle,
  looksLikeProfileFieldDump,
  canonicalPeopleLookupQuery,
  peopleCardHasPrivilegeField,
  PEOPLE_CARD_PRIVILEGE_KEYS,
  editorialProvenance,
  stampDiscoverable,
  compactPeopleV2,
  asSmartCardView,
  applyLiveProjection,
  redactView,
  paginate,
  routePeopleSearch,
  replyKeyForMode,
  fallbackReply,
  peopleSearchMeta
};
