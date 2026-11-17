/* People SMARTcard v6 — compact projections of the same authorized
   usercharacter_analysis + public profile as People SmartView.
   No independent card summary store. No Gemini on card render. */
"use strict";

const v2 = require("./botdee-smartview-v2-core");

const PAGE_SIZE = 4;
const SCHEMA_VERSION = "floqr.peopleSmartCard/6";
const SELF_QUERY = /^(me|myself|my profile|my account|my info|my information|about me|who am i|what(?:'s| is| do you) know about (?:me|myself)|tell me about (?:me|myself)|describe (?:me|myself))$/i;

const WHO_IS = /^(?:who(?:'s| is| s))\s+/i;
const DO_YOU_KNOW = /^(?:do you know|did you meet)\s+/i;
const PROFILE_OF = /^(?:what(?:'s| is) (?:on )?(?:the )?profile (?:of|for)|look up|lookup)\s+/i;
const PERSON_PREFIX = /^(?:who(?:'s| is| s)|do you know|did you meet|look up|lookup|find|search for|what(?:'s| is) (?:on )?(?:the )?profile (?:of|for))\s+/i;
const PERSON_SUFFIX = /\s+(?:on floqr|on mingl|on here)\s*$/i;
const STOP_AFTER = /^(working|on (?:duty|tonight)|the (?:dj|club)|playing|singing|available)\b/i;
const GENERIC_PERSON = /^(this person|that person|them|him|her|someone|anybody|anyone)$/i;

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
  rest = rest.replace(/^[@]+/, "").replace(/["“”']/g, "").trim();
  const needle = normalizeQuery(rest);
  if (!needle || needle.length < 2) return "";
  if (STOP_AFTER.test(needle) || GENERIC_PERSON.test(needle)) return "";
  if (/^(a |an |the )?(dj|club|venue|event|shoutout|vip|table)\b/.test(needle)) return "";
  return rest;
}

function isFindPersonPrompt(raw) {
  const match = text(raw, 200).match(/^(?:find|search for)\s+(.+)$/i);
  if (!match) return false;
  const rest = match[1].replace(/[?!]+$/g, "").trim();
  if (/^@[\w.-]+$/.test(rest)) return true;
  return /^[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,4}$/.test(rest);
}

function isPeopleLookupPrompt(raw) {
  const original = text(raw, 200);
  return WHO_IS.test(original)
    || DO_YOU_KNOW.test(original)
    || PROFILE_OF.test(original)
    || isFindPersonPrompt(original)
    || PERSON_SUFFIX.test(original);
}

function classifyPeopleSearchIntent(raw) {
  const n = normalizeQuery(raw);
  if (!n || n.length < 2) return {intent: "none", needle: "", self: false};
  if (SELF_QUERY.test(n) || /^(what do you know about me|tell me about my (?:public )?profile)$/.test(n)) {
    return {intent: "self", needle: "me", self: true};
  }
  const original = text(raw, 200);
  if (!isPeopleLookupPrompt(original)) return {intent: "none", needle: "", self: false};
  const needle = extractPersonNeedle(raw);
  if (needle) return {intent: "person", needle, self: false};
  const rest = normalizeQuery(
    original.replace(WHO_IS, "").replace(DO_YOU_KNOW, "").replace(PROFILE_OF, "").replace(PERSON_SUFFIX, "")
  );
  if (GENERIC_PERSON.test(rest)) return {intent: "empty", needle: "", self: false};
  return {intent: "none", needle: "", self: false};
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
  if (mode === "self") return "Here is your SmartView.";
  if (mode === "one") return "Here is their SmartView.";
  if (mode === "many") return "I found more than one eligible public profile. Select the right person to open their SmartView.";
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
