/* BOT DEE session core — tool defs, classification-gated contextualSearch, Gemini message shaping.
   Product tools (VIP / ShoutOut / FloqCAST / checkout) re-validate role via bot-dee-tools.js. */
"use strict";

const {Type} = require("@google/genai");
const classification = require("./data-classification-core");
const BOTDEE_CONTENT = require("./botdee-content-classes.json");
const SEARCH_CATALOG = require("./bot-dee-search-catalog.json");
const RESULT_LOCALES = require("./bot-dee-result-locales.json");

const MAX_HISTORY = 12;
const MAX_STORED_EVENTS = 24;
const MAX_MESSAGE_CHARS = 2000;
const MAX_MODEL_CHARS = 8000;
const MAX_RESULTS = 8;
const MAX_TOOL_ROUNDS = 4;
const DEFAULT_DURABLE_THREADS = 1;
const THREAD_SCHEMA_VERSION = 1;
const TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";
const SUPPORTED_UI_LANGS = new Set(["en", "de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"]);

function normalizeUiLanguage(value) {
  const code = String(value || "en").trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_UI_LANGS.has(code) ? code : "en";
}

const str = (description) => ({type: Type.STRING, description});
const obj = (properties, required) => ({
  type: Type.OBJECT,
  properties,
  ...(required ? {required} : {})
});

const TOOL_DEFS = [
  {
    name: "contextualSearch",
    description:
      "Search FLOQR help topics and product intents the signed-in viewer may access. Use only for how-to / product questions with a clear intent. Never call for greetings or small talk (hi, hey, thanks). Returns classification-filtered results only. Result card labels are localized by the app language on the server — do not invent English titles when the viewer uses another language.",
    parameters: obj({query: str("Plain-language search query from the patron.")}, ["query"])
  },
  {
    name: "lookupPublicProfiles",
    description:
      "Look up PUBLIC FLOQR patron and/or club profiles (including public photo/gallery image URLs) for contextual answers. Only returns profiles marked public / published. Never returns private fields (email, phone, payment, location coords). Use when the user asks about a person, handle, DJ, staff member, or club public page.",
    parameters: obj({
      query: str("Name, @handle, club brand, or keywords to match public profiles."),
      kind: str("Optional filter: user | club | any (default any)."),
      limit: {type: Type.INTEGER, description: "Max profiles to return (1–8)."}
    }, ["query"])
  },
  {
    name: "listShoutOutTemplates",
    description: "List ShoutOut templates available at a club (or return compose link). Accepts a venue slug OR a display name (e.g. Aurelia → temp-democlub-1). Re-validates shoutOut access.",
    parameters: obj({
      clubLocationId: str("Venue slug or display name (e.g. Aurelia, temp-democlub-1)."),
      locationId: str("Alias for clubLocationId."),
      locationName: str("Optional venue display name (e.g. Aurelia).")
    })
  },
  {
    name: "startShoutOutCheckout",
    description:
      "Start Stripe Checkout for a composed ShoutOut. Requires clubLocationId and shoutout payload (templateId, text fields, screenFormatId as collected). Re-validates shoutOut. Returns checkoutUrl — never collect card data.",
    parameters: obj({
      clubLocationId: str("Venue location id."),
      shoutout: {type: Type.OBJECT, description: "ShoutOut compose payload (templateId, message fields, screenFormatId, etc.)."},
      payload: {type: Type.OBJECT, description: "Optional wrapper with clubLocationId + shoutout."},
      returnBase: str("Optional return base URL."),
      correlationId: str("Optional correlation id.")
    })
  },
  {
    name: "createVipHold",
    description: "Hold a VIP table section for 30 minutes. Needs clubLocationId, night (YYYY-MM-DD), sectionId, partySize. Re-validates vipReservations.",
    parameters: obj({
      clubLocationId: str("Venue id."),
      night: str("Night date YYYY-MM-DD."),
      sectionId: str("Floor section id."),
      partySize: {type: Type.INTEGER, description: "Party size within section capacity."}
    }, ["clubLocationId", "night", "sectionId", "partySize"])
  },
  {
    name: "recordVipConsent",
    description: "Record VIP Terms consent for an active hold before checkout. checks.terms must be true. Re-validates vipReservations.",
    parameters: obj({
      holdId: str("Hold id from createVipHold."),
      checks: {type: Type.OBJECT, description: "Consent checks; terms:true required."}
    }, ["holdId"])
  },
  {
    name: "createVipCheckout",
    description: "Complete VIP payment after consent using the venue's configured collector (not always Stripe). clubPos → confirm for Toast/SpotOn POS (no card URL); no-deposit → confirm reservation; floqrStripe/clubStripe → checkoutUrl. Needs holdId + consentId. Re-validates vipReservations.",
    parameters: obj({
      holdId: str("Active hold id."),
      consentId: str("Consent id from recordVipConsent."),
      returnBase: str("Optional return base URL for Stripe collectors only."),
      correlationId: str("Optional correlation id.")
    }, ["holdId", "consentId"])
  },
  {
    name: "createFloqCastRequest",
    description: "Create a private floqCast preview request for a venue (secondary board). Re-validates floqCast. Returns previewPath.",
    parameters: obj({
      locationId: str("Venue location id."),
      clubLocationId: str("Alias for locationId."),
      locationName: str("Optional venue display name."),
      displayBoard: str("Board; defaults to secondary.")
    })
  },
  {
    name: "createFloqCastCheckout",
    description: "Start Stripe Checkout for an existing floqCast request. Needs requestId. Re-validates floqCast. Returns checkoutUrl.",
    parameters: obj({
      requestId: str("Request id / access token from createFloqCastRequest."),
      clubLocationId: str("Optional venue id."),
      locationId: str("Optional venue id."),
      returnBase: str("Optional return base URL."),
      correlationId: str("Optional correlation id.")
    }, ["requestId"])
  }
];

const TOOL_NAMES = TOOL_DEFS.map(t => t.name);

/** Product tool → Features & Services key (null = always available when BOT DEE is). */
const TOOL_FEATURE_KEY = Object.freeze({
  contextualSearch: null,
  lookupPublicProfiles: null,
  listShoutOutTemplates: "shoutOut",
  startShoutOutCheckout: "shoutOut",
  createVipHold: "vipReservations",
  recordVipConsent: "vipReservations",
  createVipCheckout: "vipReservations",
  createFloqCastRequest: "floqCast",
  createFloqCastCheckout: "floqCast"
});

/** Intent / help id → feature key. null = no Features gate beyond classification. */
const INTENT_FEATURE_KEY = Object.freeze({
  shoutout: "shoutOut",
  mingl: "mingl",
  bartr: "bartr",
  rydr: "rydr",
  floqcast: "floqCast",
  "vip-reserv": "vipReservations",
  "help-floqcast": "floqCast",
  "help-sell-bartr": "bartr",
  "help-vip": "vipReservations",
  "ballers-alert": "shoutOut",
  "classic-halloween": "shoutOut",
  "football-intro": "shoutOut",
  shiloh: "shoutOut",
  "tengo-muchos-dolares": "shoutOut",
  clubs: null,
  "venue-search": null,
  "ad-campaigns": null
});

/** VIP product phrases across app languages.
 *  Unicode letter boundaries — ASCII `\b` does not treat Cyrillic/Greek/Arabic as word chars. */
const VIP_BRAND_RE =
  /(?<![\p{L}\p{N}_])(?:VIP\s*reserV|VIP[- ]?(?:table|tables|entry|entries|Tisch|Tische|tafel|tafels|стол|стола)|(?:table|tables|mesa|mesas|tavolo|tavoli|stolik|stoliki)\s+VIP|VIP\s+τραπέζι|طاولة\s+VIP)(?![\p{L}\p{N}_])/giu;

const FEATURE_BRAND_PATTERNS = Object.freeze([
  {key: "mingl", re: /\bMingl\b/g},
  {key: "rydr", re: /\bRydR\b/g},
  {key: "bartr", re: /\bBartR\b/g},
  {key: "floqCast", re: /\bfloqCast\b|\bFloqCAST\b|\bFloqCast\b/g},
  {key: "vipReservations", re: VIP_BRAND_RE}
]);

function featureKeyForSource(sourceId, id) {
  const sid = String(sourceId || "");
  const rawId = String(id || "").trim();
  if (sid.startsWith("intent:")) {
    const intentId = sid.slice(7);
    if (Object.prototype.hasOwnProperty.call(INTENT_FEATURE_KEY, intentId)) {
      return INTENT_FEATURE_KEY[intentId];
    }
  }
  const probe = `${sid} ${rawId}`;
  if (/mingl/i.test(probe)) return "mingl";
  if (/\brydr\b|ryd-?r/i.test(probe)) return "rydr";
  if (/bartr|bart-?r|sell-bartr/i.test(probe)) return "bartr";
  if (/floqcast|suprstr|suprstar/i.test(probe)) return "floqCast";
  if (/\bvip\b|reserv/i.test(probe)) return "vipReservations";
  if (/shout/i.test(probe)) return "shoutOut";
  return null;
}

function allowedFeatureSet(allowed) {
  if (allowed instanceof Set) return allowed;
  if (Array.isArray(allowed)) return new Set(allowed);
  if (allowed && typeof allowed === "object" && Array.isArray(allowed.keys)) {
    return new Set(allowed.keys);
  }
  return null;
}

/** Strip brand names the viewer cannot access (private beta must not leak). */
function sanitizeFeatureMentions(text, allowedFeatures) {
  const allowed = allowedFeatureSet(allowedFeatures);
  if (!allowed) return String(text || "");
  let out = String(text || "");
  FEATURE_BRAND_PATTERNS.forEach(({key, re}) => {
    if (!allowed.has(key)) out = out.replace(re, "");
  });
  out = out
    .replace(/\(\s*superstar\s*\)/gi, "")
    .replace(/,\s+and\s+,/gi, ",")
    .replace(/\s+(?:or|oder|ou|o|или|ή|lub|أو)\s+,/gi, ",")
    .replace(/\(\s*,\s*/g, "(")
    .replace(/,\s*\)/g, ")")
    .replace(/\(\s*\)/g, "")
    .replace(/:\s*,/g, ":");
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = out
      .replace(/,\s*,+/g, ",")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*$/g, "")
      .replace(/^,\s*/g, "")
      .trim();
  }
  out = out
    .replace(/\s+,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/,\s*$/g, "")
    .trim();
  return out;
}

function filterResultsByFeatureAccess(results, allowedFeatures) {
  const allowed = allowedFeatureSet(allowedFeatures);
  if (!allowed) return (results || []).slice();
  return (results || [])
    .filter(row => {
      const key = featureKeyForSource(row.sourceId, row.id);
      return !key || allowed.has(key);
    })
    .map(row => ({
      ...row,
      label: sanitizeFeatureMentions(row.label, allowed),
      blurb: sanitizeFeatureMentions(row.blurb, allowed)
    }));
}

function productPitchLabels(allowedFeatures) {
  const allowed = allowedFeatureSet(allowedFeatures);
  const labels = [];
  if (!allowed || allowed.has("shoutOut")) labels.push("ShoutOut");
  if (!allowed || allowed.has("vipReservations")) labels.push("VIP reserV");
  if (!allowed || allowed.has("floqCast")) labels.push("floqCast");
  labels.push("scheduling");
  return labels;
}

/** Brand names Gemini must not speak unless the viewer has that feature key. */
const GATED_BRAND_LABELS = Object.freeze([
  {key: "mingl", names: ["Mingl"]},
  {key: "rydr", names: ["RydR"]},
  {key: "bartr", names: ["BartR"]},
  {key: "floqCast", names: ["floqCast", "FloqCAST"]},
  {key: "vipReservations", names: ["VIP reserV", "VIP table"]}
]);

function deniedBrandNames(allowedFeatures) {
  const allowed = allowedFeatureSet(allowedFeatures);
  if (!allowed) return [];
  const names = [];
  GATED_BRAND_LABELS.forEach(({key, names: brandNames}) => {
    if (!allowed.has(key)) names.push(...brandNames);
  });
  return names;
}

function productPitchSentence(allowedFeatures) {
  const labels = productPitchLabels(allowedFeatures);
  if (!labels.length) return "just say what you want in plain words.";
  if (labels.length === 1) return `${labels[0]}, or something else — just say it in plain words.`;
  const head = labels.slice(0, -1).join(", ");
  return `${head}, or ${labels[labels.length - 1]} — just say it in plain words.`;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9@\s._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter(token => token.length > 1);
}

/** Word-boundary match after normalize (avoids \"hey\" matching inside \"they\"). */
function hasWord(hay, word) {
  const w = normalize(word);
  if (!w) return false;
  return (` ${normalize(hay)} `).includes(` ${w} `);
}

const MIN_SEARCH_SCORE = 3;

/** Soft name / filler after a greeting (bot dee, there, friend, …). */
const CHITCHAT_TAIL = "(?:\\s+(?:bot\\s*dee|floqai|floq\\s*ai|there|again|friend|everyone|yall|y all))?";

/**
 * Short acknowledgments mid-chat ("cool", "ok", "thanks") — conversational continue,
 * not a fresh "Hey — BOT DEE here" intro and never a search dump.
 * Keep in sync with bot-dee-chat.js.
 */
function isAckPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 80) return false;
  if (new RegExp(`^(?:thanks|thank you|thx|ty|ok|okay|k|kk|cool|nice|great|awesome|perfect|sweet|lit|bet|fire|dope|solid|rad|alright|all right|got it|sounds good|sounds cool|that s cool|thats cool|that is cool|makes sense|copy|roger|yes|yeah|yep|yup|sure|absolutely|for sure|no problem|np|bye|goodbye|see ya|see you|later|peace)${CHITCHAT_TAIL}$`).test(q)) {
    return true;
  }
  return false;
}

/**
 * Mood / "how are you" small talk — answer like a person, never dump search hits.
 * Keep in sync with bot-dee-chat.js.
 */
function isMoodPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 100) return false;
  const moodCore =
    "(?:how are you|how re you|how r you|hows it going|how s it going|how is it going|" +
    "how you doing|how are things|how have you been|hows your day|how s your day|how is your day|" +
    "how was your day|what s new|whats new|how do you feel|you good|you okay|you ok|" +
    "how goes it|hows everything|how s everything|how is everything)";
  if (new RegExp(`^(?:(?:hey|hi|hello|howdy|yo)\\s+)?${moodCore}(?:\\s+today)?${CHITCHAT_TAIL}$`).test(q)) {
    return true;
  }
  return false;
}

/**
 * Greetings / small talk — reply as a chatbot, never dump search hits.
 * Keep in sync with bot-dee-chat.js client mirror (Pages can greet before Functions deploy).
 */
function isChitchatPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 100) return false;
  if (isAckPrompt(q)) return true;
  if (isMoodPrompt(q)) return true;
  // hi / hello / hey (+ optional name)
  if (new RegExp(`^(?:hey|hi|hello|howdy|yo|sup|hiya|hola)${CHITCHAT_TAIL}$`).test(q)) return true;
  if (new RegExp(`^(?:good morning|good afternoon|good evening|good night|what s up|whats up|what up)${CHITCHAT_TAIL}$`).test(q)) return true;
  return false;
}

/** Name / identity — answer as BOT DEE; never dump search hits. */
function isIdentityPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 120) return false;
  if (/^(?:who are you|what(?:'s| s| is) your name|what are you called)\b/.test(q)) return true;
  if (/how (?:is|do you|do i|to) (?:your |the )?name pronounc/.test(q)) return true;
  if (/how (?:do you|to) pronounce (?:your name|bot\s*dee|floqai|floq\s*ai|floqr)\b/.test(q)) return true;
  if (/^(?:pronounce|pronunciation) (?:bot\s*dee|your name|floqai|floqr)?\b/.test(q)) return true;
  if (/^what does (?:bot\s*dee|floqai|floq\s*ai) (?:mean|stand for)\b/.test(q)) return true;
  return false;
}

/** Default idle pause (seconds) before BOT DEE ends the conversation. Master Admin can override. */
const DEFAULT_IDLE_SECONDS = 300;
const MIN_IDLE_SECONDS = 15;
const MAX_IDLE_SECONDS = 600;

function clampIdleSeconds(raw) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_IDLE_SECONDS;
  return Math.min(MAX_IDLE_SECONDS, Math.max(MIN_IDLE_SECONDS, n));
}

function flag01(value, fallback) {
  if (value === 0 || value === "0" || value === false) return 0;
  if (value === 1 || value === "1" || value === true) return 1;
  return fallback === 0 || fallback === 1 ? fallback : 0;
}

function normalizeBotDeeSettings(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return {
    conversationIdleSeconds: clampIdleSeconds(
      row.conversationIdleSeconds != null ? row.conversationIdleSeconds : DEFAULT_IDLE_SECONDS
    ),
    durableThreads: flag01(row.durableThreads, DEFAULT_DURABLE_THREADS),
    revision: Math.max(0, Math.floor(Number(row.revision) || 0))
  };
}

function threadIdForUid(uid) {
  return String(uid || "").trim();
}

/** v1 is one thread per uid. Guessed or foreign ids are ignored. */
function coerceThreadId(requested, uid) {
  void requested;
  return threadIdForUid(uid);
}

function eventDocId(seq) {
  const n = Number(seq);
  if (!Number.isFinite(n) || n < 1) return "";
  return `e${String(Math.floor(n)).padStart(8, "0")}`;
}

function isThreadIdle(lastMessageAtMs, idleSeconds, nowMs) {
  const last = Number(lastMessageAtMs) || 0;
  if (!last) return false;
  const now = Number(nowMs) || Date.now();
  return now - last >= clampIdleSeconds(idleSeconds) * 1000;
}

function remainingIdleMs(lastMessageAtMs, idleSeconds, nowMs) {
  const last = Number(lastMessageAtMs) || 0;
  const budget = clampIdleSeconds(idleSeconds) * 1000;
  if (!last) return budget;
  const now = Number(nowMs) || Date.now();
  return Math.max(0, last + budget - now);
}

function clipStoredText(raw, maxChars) {
  const cap = Number(maxChars) > 0 ? Math.floor(Number(maxChars)) : MAX_MESSAGE_CHARS;
  return String(raw || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, cap);
}

function clipStoredTurns(turns) {
  const list = Array.isArray(turns) ? turns : [];
  const out = [];
  list.slice(-MAX_HISTORY).forEach(row => {
    const role = row?.role === "model" || row?.role === "assistant" ? "model" : row?.role === "user" ? "user" : "";
    const max = role === "model" ? MAX_MODEL_CHARS : MAX_MESSAGE_CHARS;
    const text = clipStoredText(row?.text || row?.content || "", max);
    if (!role || !text) return;
    out.push({role, text});
  });
  return out;
}

function conversationIsActive(history, lastMessageAtMs, idleSeconds, nowMs) {
  if (isThreadIdle(lastMessageAtMs, idleSeconds, nowMs)) return false;
  return sanitizeHistory(history).length > 0;
}

function clipModelText(raw) {
  return clipStoredText(raw, MAX_MODEL_CHARS);
}

/** Canonical stored miss copy — must match `botdee.chatEmpty` English. Client localizes it. */
const SEARCH_MISS_FALLBACK = "No answer yet — try quick intent search.";

function isSearchMissReply(raw) {
  const text = String(raw || "").trim();
  return !text || /could not find a clear match/i.test(text) || text === SEARCH_MISS_FALLBACK;
}

function sanitizeBotReply(raw) {
  if (isSearchMissReply(raw)) return SEARCH_MISS_FALLBACK;
  return clipModelText(raw);
}

function isFarewellPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 80) return false;
  return new RegExp(`^(?:bye|goodbye|see ya|see you|later|peace)${CHITCHAT_TAIL}$`).test(q);
}

function identityReply() {
  return "I'm BOT DEE — say it like \"bot\" + \"dee\" (the letter D). I'm FLOQR's in-app helper.";
}

/** Offer-help CTA — conversation start / idle resume only (not every mid-chat turn). */
function chitchatReply(role, allowedFeatures) {
  const roleHint = role && role !== "anonymous" && role !== "patron"
    ? ` I can see you as ${role}.`
    : "";
  return `Hey — BOT DEE here.${roleHint} What do you want to do in FLOQR? ${productPitchSentence(allowedFeatures)}`;
}

/** Friendly mood reply — chat first, light invite to keep going (not a search dump). */
function moodReply() {
  return "I'm doing great — thanks for asking! What can I help you with in FLOQR?";
}

/** Soft mid-chat ack — no product pitch, no re-intro. */
function ackReply(role, raw) {
  void role;
  const q = normalize(raw);
  if (isFarewellPrompt(q)) return "Take care — say hi when you want to pick up again.";
  if (/^(?:thanks|thank you|thx|ty)\b/.test(q)) return "You're welcome.";
  return "Cool.";
}

/** Mid-chat greeting while the conversation is still active — no offer-help repeat. */
function stillHereReply() {
  return "Hey — still here.";
}

/** After idle end, when the patron comes back with a greeting. */
function resumeReply(role, allowedFeatures) {
  return chitchatReply(role, allowedFeatures);
}

/** Shown when the idle timer ends the conversation. */
function idleEndedReply() {
  return "I'll pause here for now. Say hi when you want to pick up again.";
}

function scoreEntry(query, entry) {
  const q = normalize(query);
  if (!q) return 0;
  const qTokens = tokens(q);
  let score = 0;
  const hay = normalize([entry.label, entry.blurb, ...(entry.phrases || [])].join(" "));
  if (hasWord(hay, q) || hay.includes(` ${q} `) || hay === q) score += 8;
  else if (q.length >= 4 && hay.includes(q)) score += 6;
  (entry.phrases || []).forEach(phrase => {
    const p = normalize(phrase);
    if (!p) return;
    if (p === q) score += 10;
    else if (p.startsWith(q) || q.startsWith(p)) score += 5;
    else if (hasWord(p, q) || (q.length >= 4 && (p.includes(q) || q.includes(p)))) score += 3;
  });
  const label = normalize(entry.label);
  if (label && (q.includes(label) || hasWord(q, label))) score += 4;
  qTokens.forEach(token => {
    if (hasWord(hay, token)) score += 1;
  });
  return score;
}

function sanitizeUserPrompt(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_CHARS);
}

function sanitizeHistory(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  list.slice(-MAX_HISTORY).forEach(row => {
    const role = row?.role === "model" || row?.role === "assistant" ? "model" : row?.role === "user" ? "user" : "";
    const text = sanitizeUserPrompt(row?.text || row?.content || "");
    if (!role || !text) return;
    out.push({role, text});
  });
  return out;
}

function contextualSearch(query, viewerRole, allowedFeatures) {
  const role = String(viewerRole || "anonymous");
  const scored = [];
  (SEARCH_CATALOG.entries || []).forEach(entry => {
    const points = scoreEntry(query, entry);
    if (points <= 0) return;
    scored.push({entry, points});
  });
  const strong = scored.filter(row => row.points >= MIN_SEARCH_SCORE);
  strong.sort((a, b) => b.points - a.points || a.entry.sourceId.localeCompare(b.entry.sourceId));
  const candidates = strong.slice(0, 40).map(row => row.entry.sourceId);
  const {allowed, denied} = classification.filterContent(candidates, BOTDEE_CONTENT, {role});
  const allowedSet = new Set(allowed);
  let results = strong
    .filter(row => allowedSet.has(row.entry.sourceId))
    .slice(0, MAX_RESULTS * 2)
    .map(row => ({
      sourceId: row.entry.sourceId,
      id: row.entry.id,
      kind: row.entry.kind,
      label: row.entry.label,
      blurb: row.entry.blurb,
      href: row.entry.href,
      score: row.points
    }));
  const beforeFeature = results.length;
  results = filterResultsByFeatureAccess(results, allowedFeatures).slice(0, MAX_RESULTS);
  return {
    ok: true,
    query: sanitizeUserPrompt(query),
    role,
    results,
    deniedCount: denied.length + Math.max(0, beforeFeature - results.length),
    tool: "contextualSearch"
  };
}

async function runTool(name, args, session) {
  const allowed = session?.allowedFeatures;
  if (name === "contextualSearch") {
    const search = contextualSearch(args?.query || session?.lastUserPrompt || "", session.role, allowed);
    return localizeSearchPayload(search, session?.uiLanguage, allowed);
  }
  if (name === "lookupPublicProfiles") {
    const tools = require("./bot-dee-tools");
    return tools.lookupPublicProfiles(args || {}, session?.request);
  }
  const need = TOOL_FEATURE_KEY[name];
  if (need && allowedFeatureSet(allowed) && !allowedFeatureSet(allowed).has(need)) {
    return {ok: false, error: `That feature isn't available on your account yet.`, code: "failed-precondition", featureKey: need};
  }
  const tools = require("./bot-dee-tools");
  if (!session?.request) {
    return {ok: false, error: "Session request missing for product tool."};
  }
  return tools.runProductTool(name, args, session.request);
}

function toolDeclarations(allowedFeatures) {
  const allowed = allowedFeatureSet(allowedFeatures);
  if (!allowed) return TOOL_DEFS;
  return TOOL_DEFS.filter(tool => {
    const need = TOOL_FEATURE_KEY[tool.name];
    return !need || allowed.has(need);
  });
}

function localePack(lang) {
  const code = normalizeUiLanguage(lang);
  if (code === "en") return null;
  return RESULT_LOCALES.byLang?.[code] || null;
}

function localeLookupKeys(row) {
  const sourceId = String(row?.sourceId || "").trim();
  const id = String(row?.id || "").trim();
  const keys = [];
  if (sourceId) keys.push(sourceId);
  // HELP intents are catalogued as intent:help-* but locales are keyed help:<id>.
  if (sourceId.startsWith("intent:help-")) keys.push(`help:${sourceId.slice("intent:".length)}`);
  if (id.startsWith("help-")) keys.push(`help:${id}`);
  if (sourceId.startsWith("intent:") && !sourceId.startsWith("intent:help-")) {
    keys.push(sourceId);
  }
  return [...new Set(keys.filter(Boolean))];
}

function localizeResultRow(row, lang) {
  if (!row || typeof row !== "object") return row;
  const pack = localePack(lang);
  if (!pack) return {...row};
  let hit = null;
  for (const key of localeLookupKeys(row)) {
    if (pack.results?.[key]) {
      hit = pack.results[key];
      break;
    }
  }
  const next = {...row};
  if (hit?.label) next.label = hit.label;
  if (hit?.blurb) next.blurb = hit.blurb;
  return next;
}

function localizeSearchPayload(search, lang, allowedFeatures) {
  if (!search || typeof search !== "object") return search;
  const code = normalizeUiLanguage(lang);
  const localized = (search.results || []).map(row => localizeResultRow(row, code));
  return {
    ...search,
    uiLanguage: code,
    results: filterResultsByFeatureAccess(localized, allowedFeatures || search.allowedFeatures)
  };
}

function localizeActionLink(link, lang) {
  if (!link || typeof link !== "object") return link;
  const pack = localePack(lang);
  if (!pack?.action) return {...link};
  const kind = String(link.kind || "").toLowerCase();
  const next = {...link};
  if (kind === "checkout" && pack.action.paySecurely) next.label = pack.action.paySecurely;
  if (kind === "floqcast" && pack.action.floqcastPreview) next.label = pack.action.floqcastPreview;
  if (kind === "shoutout" && pack.action.shoutoutCompose) next.label = pack.action.shoutoutCompose;
  if (kind === "vip" && pack.action.vipTerms) next.label = pack.action.vipTerms;
  return next;
}

function systemInstruction(role, uiLanguage, allowedFeatures) {
  const lang = normalizeUiLanguage(uiLanguage);
  const allowed = allowedFeatureSet(allowedFeatures);
  const allowedLabels = productPitchLabels(allowedFeatures).filter(x => x !== "scheduling");
  const langLine = lang === "en"
    ? "Reply in English unless the user clearly writes in another language."
    : `App language is "${lang}". ALWAYS write your spoken reply in ${lang}. Do not switch to English for help steps or summaries unless the user asked for English. Navigation/result cards are already localized server-side — do not paste English product titles into your prose when a ${lang} wording exists.`;
  const denied = deniedBrandNames(allowedFeatures);
  const accessLine = allowed
    ? (
      `Principle of least privilege — Features & Services + beta grants for THIS viewer: ${allowedLabels.length ? allowedLabels.join(", ") : "none beyond BOT DEE chat"}. ` +
      `DO mention, pitch, and help with products on that allowed list (including how-to / help steps and brand names that appear there). ` +
      (denied.length
        ? `NEVER mention, pitch, invent steps for, or leave in help blurbs these products this viewer lacks: ${denied.join(", ")}. `
        : "") +
      `If they ask for a product not on their allowed list, say it is not available on their account yet — do not name other products they also lack.`
    )
    : "Only discuss features returned by tools for this viewer.";
  const pitchLine = `Ask "what do you want to do" / list ONLY products this viewer may use (${productPitchSentence(allowedFeatures)}) ONLY on the first turn or after a clear restart — never every reply. Include granted betas; omit everything else.`;
  return [
    "You are BOT DEE, FLOQR's in-app chatbot and authorized execution agent. Talk like a helpful friend first — warm, brief, human. You are not a search box and not a FAQ dump. Introduce yourself as BOT DEE when useful.",
    langLine,
    accessLine,
    "Prefer conversation: answer the person, then (only if useful) offer one next step. Do NOT open with \"Here is what I found\" or a link list unless they clearly asked how to do something in FLOQR. Keep navigation/search suggestion cards separate from your spoken answer — the UI shows result links; your text should stay conversational.",
    "Act only within the identity, role, and tools verified by the backend for this request. Never disclose another user's private conversation, private profile, reservation, or restricted venue data. Public profiles (lookupPublicProfiles) are OK to summarize.",
    "Never request card numbers, CVVs, passwords, or OTP codes. If supplied, do not repeat them; direct the user to approved secure flows.",
    pitchLine,
    "Greetings on a fresh/restarted chat: reply in 1–2 short sentences, introduce yourself as BOT DEE, ask what they want to do, and do NOT call any tools.",
    "Greetings mid-chat while already talking: one short line (e.g. \"Hey — still here.\") — do NOT re-list products, do NOT call tools.",
    "Mood / how-are-you / how's it going / how's your day / what's new: answer as a person in 1–2 friendly sentences (e.g. you're doing great, thanks for asking), optionally invite what they need in FLOQR — do NOT call any tools, do NOT dump search results.",
    "Acknowledgments mid-chat (cool, ok, okay, nice, thanks, great, awesome, got it, sounds good, yeah): one short line only (Cool. / You're welcome.) — do NOT re-introduce yourself, do NOT ask what they want to do, do NOT dump search results, do NOT call any tools.",
    "Farewells (bye, goodbye, later): short goodbye — do NOT call tools.",
    "Identity questions (your name, how to pronounce BOT DEE / FloqR brands, who you are): answer in plain words yourself — do NOT call contextualSearch or any tool. Pronunciation: BOT DEE = \"bot\" + \"dee\" (like the letter D). Do not append a product pitch.",
    "Answer briefly. Prefer tool results and real checkoutUrl / passHref / previewPath / holdId values. Never invent links or claim payment success without a tool result.",
    "When the user asks about a person, @handle, DJ, staff member, or a club's public page / photos, call lookupPublicProfiles and answer from returned public fields and image URLs only. If nothing public matches, say so honestly.",
    "Venue names: patrons say Aurelia / Decades / Lima Twist — tools accept those display names and resolve to slugs (Aurelia → temp-democlub-1). Prefer listShoutOutTemplates / createVipHold / createFloqCastRequest with the name they typed; do not invent a wrong slug.",
    "Use contextualSearch only for clear how-to / product questions. For booking/pay only when the matching tool is available: VIP = createVipHold → recordVipConsent → createVipCheckout; floqCast = createFloqCastRequest → createFloqCastCheckout; ShoutOut = listShoutOutTemplates then startShoutOutCheckout when payload is complete.",
    "Never ask for or accept card numbers. Pay links come only from tools — VIP createVipCheckout follows the venue collector (clubPos Toast/SpotOn confirm, no-deposit confirm, or Stripe checkoutUrl for floqrStripe/clubStripe). Do not invent a Stripe URL when checkoutMode is clubPos or noDeposit; use passHref / message instead.",
    "If a tool returns ok:false, explain the error and suggest the matching FLOQR page.",
    `Viewer classification role: ${role}.`,
    "Keep allowed brand names as-is when you may mention them: ShoutOut, BOT DEE, FloqR, FloqMedia, and any other brands in the allowed-features list only."
  ].join(" ");
}

function historyToContents(history, userPrompt) {
  const contents = [];
  (history || []).forEach(row => {
    contents.push({role: row.role, parts: [{text: row.text}]});
  });
  contents.push({role: "user", parts: [{text: userPrompt}]});
  return contents;
}

function extractText(response) {
  const fromHelper = typeof response?.text === "string" ? response.text.trim() : "";
  if (fromHelper) return fromHelper;
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map(part => part.text || "").join("\n").trim();
}

function formatSearchFallback(search, lang, allowedFeatures) {
  const code = normalizeUiLanguage(lang || search?.uiLanguage);
  const pack = localePack(code);
  const rows = search?.results || [];
  if (!rows.length) {
    const pitch = productPitchLabels(allowedFeatures).join(", ");
    return pack?.fallback?.noMatch
      || `I could not find a clear match for your account yet. Try the quick intent search below, or ask about ${pitch || "FLOQR"}, or scheduling.`;
  }
  const header = pack?.fallback?.foundHeader || "Here is what I found for your account:";
  const lines = [header];
  rows.slice(0, 5).forEach((row, index) => {
    const localized = localizeResultRow(row, code);
    lines.push(`${index + 1}. ${localized.label} — ${localized.blurb}`);
    if (localized.href) lines.push(`   Open: ${localized.href}`);
  });
  return lines.join("\n");
}

function resultsForClient(search, lang) {
  const code = normalizeUiLanguage(lang || search?.uiLanguage);
  return (search?.results || []).map(row => {
    const localized = localizeResultRow(row, code);
    return {
      sourceId: localized.sourceId,
      label: localized.label,
      blurb: localized.blurb,
      href: localized.href,
      kind: localized.kind
    };
  });
}

function linksFromToolResult(result, lang) {
  if (!result || typeof result !== "object") return [];
  const code = normalizeUiLanguage(lang);
  const links = [];
  if (result.checkoutUrl) links.push(localizeActionLink({label: "Pay securely", href: result.checkoutUrl, kind: "checkout"}, code));
  if (result.previewPath) links.push(localizeActionLink({label: "Open floqCast preview", href: result.previewPath, kind: "floqcast"}, code));
  if (result.composeHref) links.push(localizeActionLink({label: "Open ShoutOut compose", href: result.composeHref, kind: "shoutout"}, code));
  if (result.holdId && !result.checkoutUrl) {
    links.push(localizeActionLink({
      label: "Continue VIP Terms",
      href: `./vip-terms.html?hold=${encodeURIComponent(result.holdId)}`,
      kind: "vip"
    }, code));
  }
  return links;
}

module.exports = {
  TEXT_MODEL,
  MAX_TOOL_ROUNDS,
  MAX_HISTORY,
  MAX_STORED_EVENTS,
  MAX_MESSAGE_CHARS,
  MAX_MODEL_CHARS,
  DEFAULT_DURABLE_THREADS,
  THREAD_SCHEMA_VERSION,
  MIN_SEARCH_SCORE,
  DEFAULT_IDLE_SECONDS,
  MIN_IDLE_SECONDS,
  MAX_IDLE_SECONDS,
  TOOL_NAMES,
  toolDeclarations,
  sanitizeUserPrompt,
  sanitizeHistory,
  isChitchatPrompt,
  isMoodPrompt,
  isIdentityPrompt,
  isAckPrompt,
  isFarewellPrompt,
  identityReply,
  chitchatReply,
  moodReply,
  ackReply,
  stillHereReply,
  resumeReply,
  idleEndedReply,
  clampIdleSeconds,
  flag01,
  normalizeBotDeeSettings,
  threadIdForUid,
  coerceThreadId,
  eventDocId,
  isThreadIdle,
  remainingIdleMs,
  clipStoredText,
  clipStoredTurns,
  conversationIsActive,
  clipModelText,
  SEARCH_MISS_FALLBACK,
  isSearchMissReply,
  sanitizeBotReply,
  normalizeUiLanguage,
  localizeResultRow,
  localeLookupKeys,
  localizeSearchPayload,
  localizeActionLink,
  featureKeyForSource,
  sanitizeFeatureMentions,
  filterResultsByFeatureAccess,
  productPitchSentence,
  productPitchLabels,
  deniedBrandNames,
  TOOL_FEATURE_KEY,
  contextualSearch,
  runTool,
  systemInstruction,
  historyToContents,
  extractText,
  formatSearchFallback,
  resultsForClient,
  linksFromToolResult,
  BOTDEE_CONTENT,
  SEARCH_CATALOG,
  RESULT_LOCALES
};
