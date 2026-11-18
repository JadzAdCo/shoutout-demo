/* BOT DEE session core — tool defs, classification-gated contextualSearch, Gemini message shaping.
   Product tools (VIP / ShoutOut / FloqCAST / checkout) re-validate role via bot-dee-tools.js. */
"use strict";

const {Type} = require("@google/genai");
const classification = require("./data-classification-core");
const guard = require("./botdee-privilege-guard");
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
/** FLOQR package stamp — keep in sync with functions/package.json version (s3.3.009). */
const PACKAGE_VERSION = (() => {
  try {
    return String(require("./package.json").version || "").trim() || "0.0.0";
  } catch (_) {
    return "0.0.0";
  }
})();
const PACKAGE_LABEL = PACKAGE_VERSION.startsWith("s") ? PACKAGE_VERSION : `s${PACKAGE_VERSION}`;

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
      "Look up PUBLIC FLOQR patron and/or club profiles in the signed-in viewer's context. Returns the same volunteered public datapoints any signed-in patron can see (sharedDatapoints + datapoints: music, travel, food, hobbies, beverages, events, looking-to-meet, location, gender, height, public photos). Those keys and values are public profile data — not PII/PCI (never email, phone, PAN, GPS). Use EVERY returned datapoint value; do not drop listed food/music/travel items. Use for: (1) what do you know about me / my profile — pass query \"me\"; (2) my friend / connection by name; (3) any public person, @handle, DJ, staff, or club page; (4) the viewer's own public profile. Missing music/food/travel means not filled or not opted public — not that FLOQR never stores them. photoCount means the FLOQR app will display those photos — never print image URLs, tokens, storage paths, or googleusercontent / firebasestorage links.",
    parameters: obj({
      query: str("Name, @handle, \"me\" / \"myself\", club brand, or keywords to match public profiles."),
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

/** Soft name / filler after a greeting (sir, bot dee, there, friend, …). Repeatable. */
const CHITCHAT_TAIL =
  "(?:\\s+(?:bot\\s*dee|floqai|floq\\s*ai|there|again|friend|everyone|yall|y all|sir|ma'?am|madam|miss|mister|mr|ms|mrs|boss|chief|captain|don))*";

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

/** Package / build / version — answer locally with the FLOQR stamp; never dump search hits.
 *  Do NOT match product “package” questions (VIP package, ShoutOut package, etc.).
 *  Exact aliases Ver / Vers / Version (optional trailing ?) open Version SmartView. */
function isVersionPrompt(raw) {
  try {
    if (require("./botdee-version-smartview").isVersionSmartViewAlias(raw)) return true;
  } catch (_) {}
  const q = normalize(raw);
  if (!q || q.length > 140) return false;
  // Product commerce / feature wording — never hijack as FLOQR stamp.
  if (/\b(?:shout\s*out|vip|floq\s*cast|floqcast|baller|jersey|template|checkout|stripe|deposit|table)\b/.test(q)) {
    return false;
  }
  if (/\b(?:your|bot\s*dee|floqr|app|software)\s+(?:version|build|package|release)\b/.test(q)) return true;
  if (/\b(?:what|which|whats|what s|what is)\s+(?:your|the)\s+(?:version|build)(?:\s+info|\s+number)?\b/.test(q)) return true;
  // “what version of FLOQR / the app”
  if (/\b(?:what|which|whats|what s|what is)\s+(?:version|build)\s+of\s+(?:floqr|bot\s*dee|the\s+app|this\s+app|the\s+software)\b/.test(q)) return true;
  if (/\b(?:version|build)\s+of\s+(?:floqr|bot\s*dee|the\s+app|this\s+app)\b/.test(q)) return true;
  if (/^(?:what|which)\s+(?:version|build)\??$/.test(q)) return true;
  if (/\b(?:what|which|whats|what s|what is|tell me|name)\b.{0,24}\b(?:your|bot\s*dee|floqr)\b.{0,20}\b(?:version|build|package|release)\b/.test(q)) return true;
  if (/\b(?:what|which)\s+(?:package|release)\s+(?:are you|is this|is floqr|am i on)\b/.test(q)) return true;
  if (/^(?:version|build)(?:\s+info|\s+number)?\??$/.test(q)) return true;
  if (/^(?:package|release)\s+(?:info|version|number)\??$/.test(q)) return true;
  if (/\bversion\s+info\b/.test(q)) return true;
  if (/\bwhat\s+(?:is\s+)?deployed\b/.test(q)) return true;
  if (/\bwhat\s+changed\b/.test(q)) return true;
  if (/\bwhat\s+limitations?\b/.test(q)) return true;
  if (/\bwhich\s+integrations?\s+(?:are\s+)?approved\b/.test(q)) return true;
  if (/\bwhat\s+version\s+are\s+you\s+running\b/.test(q)) return true;
  return false;
}

/** Bare help / how-to-use-BOT-DEE — local reply like version; never dump search cards.
 *  Do NOT match “help with ShoutOut / VIP / …” product questions. */
function isHelpPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 120) return false;
  if (/\b(?:shout\s*out|vip|floq\s*cast|floqcast|mingl|rydr|bartr|schedule|jersey|baller|template|checkout)\b/.test(q)) {
    return false;
  }
  if (/^(?:help|aide|ayuda|hilfe|aiuto|ajuda|помощь|βοήθεια|pomoc|مساعدة)\??$/.test(q)) return true;
  if (/^(?:\?|help me|need help|i need help)\??$/.test(q)) return true;
  if (/^(?:how (?:do|can|to) (?:i|you) (?:use|get help(?: from)?|ask)(?: (?:you|bot\s*dee|floqr))?)\??$/.test(q)) return true;
  if (/^(?:what can (?:you|bot\s*dee) (?:do|help(?: me)? with))\??$/.test(q)) return true;
  if (/^(?:bot\s*dee help|help bot\s*dee|show help|get help)\??$/.test(q)) return true;
  if (/\b(?:how (?:do|can) i use (?:you|bot\s*dee)|what (?:are you|can you) (?:for|help with))\b/.test(q)) return true;
  return false;
}

/** Privacy / session / keyboard — local help, never a product catalog. */
function isPrivacyPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 140) return false;
  if (/^(?:privacy|session|pause|keyboard)\??$/.test(q)) return true;
  if (/^(?:privacy (?:and|&)? session|session (?:pause|privacy)|five minute(?:s)?(?: pause)?|5 minute(?:s)?(?: pause)?)\??$/.test(q)) return true;
  if (/\b(?:enter sends|shift enter|shift\+enter|keyboard shortcuts?)\b/.test(q)) return true;
  if (/\b(?:five.?minute pause|session pause|live chat pause|privacy and session)\b/.test(q)) return true;
  return false;
}

function privacyReply() {
  return "The five-minute pause ends this live session. It does not delete this signed-in chat, memories, or workflows. Opt-in copies in My Profile → Feature & Orders → My BOT DEE stay too. Guests stay ephemeral. Mingl chats are never copied here. Press Enter to send; Shift+Enter starts a new line.";
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

function hostEndsWith(host, suffix) {
  return host === suffix || host.endsWith(`.${suffix}`);
}

function isAllowedPhotoUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (hostEndsWith(host, "stripe.com") || hostEndsWith(host, "stripe.network")) return false;
  if (host === "firebasestorage.googleapis.com" || hostEndsWith(host, "firebasestorage.app")) return true;
  if (hostEndsWith(host, "googleusercontent.com")) return true;
  const path = `${parsed.pathname || ""}${parsed.search || ""}`;
  if (/\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:$|[?#])/i.test(path)) return true;
  if (/\/o\//.test(parsed.pathname || "") && /alt=media/i.test(parsed.search || "")) return true;
  return false;
}

function clipStoredMedia(media) {
  const seen = new Set();
  const out = [];
  (Array.isArray(media) ? media : []).forEach(item => {
    const url = String(item?.url || item || "").trim().slice(0, 500);
    if (!isAllowedPhotoUrl(url) || seen.has(url)) return;
    seen.add(url);
    out.push({
      url,
      alt: String(item?.alt || "Public photo").trim().slice(0, 80) || "Public photo",
      kind: "photo"
    });
  });
  return out.slice(0, 8);
}

function harvestMediaFromText(raw) {
  const seen = new Set();
  const out = [];
  String(raw || "").replace(/https?:\/\/[^\s)\]>'"]+/gi, url => {
    const clean = String(url || "").replace(/[.,;:]+$/, "").trim();
    if (!isAllowedPhotoUrl(clean) || seen.has(clean)) return "";
    seen.add(clean);
    out.push({url: clean.slice(0, 500), alt: "Public photo", kind: "photo"});
    return "";
  });
  return out.slice(0, 8);
}

function stripBackendLinks(raw) {
  let text = String(raw || "");
  text = text.replace(/\[[^\]]{0,120}\]\((https?:[^)\s]+)\)/gi, (full, url) => (
    isAllowedPhotoUrl(url) || /firebasestorage|googleusercontent/i.test(url) ? "" : full
  ));
  text = text.replace(/https?:\/\/[^\s)\]>'"]+/gi, url => {
    const clean = String(url || "").replace(/[.,;:]+$/, "");
    return (isAllowedPhotoUrl(clean) || /firebasestorage|googleusercontent/i.test(clean)) ? "" : url;
  });
  text = text.replace(/\b(?:view image|gallery photo\s*\d+|profile picture)\s*:?/gi, " ");
  text = text.replace(/\(\s*\)/g, "");
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function mediaFromToolResult(result) {
  if (!result || typeof result !== "object") return [];
  const seen = new Set();
  const out = [];
  const push = (url, alt) => {
    const clean = String(url || "").trim().slice(0, 500);
    if (!isAllowedPhotoUrl(clean) || seen.has(clean)) return;
    seen.add(clean);
    out.push({
      url: clean,
      alt: String(alt || "Public photo").trim().slice(0, 80) || "Public photo",
      kind: "photo"
    });
  };
  clipStoredMedia(result.media).forEach(item => push(item.url, item.alt));
  (Array.isArray(result.profiles) ? result.profiles : []).forEach(profile => {
    const name = String(profile?.displayName || profile?.handle || "Public photo").trim() || "Public photo";
    const urls = [];
    if (profile?.photoURL) urls.push(profile.photoURL);
    (Array.isArray(profile?.imageUrls) ? profile.imageUrls : []).forEach(item => urls.push(item));
    [...new Set(urls.filter(Boolean))].forEach((url, index) => push(url, `${name} photo ${index + 1}`));
  });
  return out.slice(0, 8);
}

function stripMediaFromToolResult(result) {
  if (!result || typeof result !== "object") return result;
  const copy = JSON.parse(JSON.stringify(result));
  delete copy.media;
  (Array.isArray(copy.profiles) ? copy.profiles : []).forEach((profile, index) => {
    const original = (result.profiles || [])[index] || profile;
    profile.photoCount = mediaFromToolResult({profiles: [original]}).length;
    delete profile.photoURL;
    delete profile.imageUrls;
  });
  if (copy.note) {
    copy.note = String(copy.note).replace(/Image URLs are published gallery media\.?/i, "").trim();
  }
  copy.displayHint = "The FLOQR app displays photos in the chat. Never print URLs, tokens, storage paths, or googleusercontent / firebasestorage links.";
  return copy;
}

const CONVERSATION_ID_RE = /^cv_[0-9a-f]{32}$/;

function clipConversationId(raw) {
  const id = String(raw || "").trim();
  return CONVERSATION_ID_RE.test(id) ? id : "";
}

function clipStoredTurns(turns) {
  const list = Array.isArray(turns) ? turns : [];
  const out = [];
  list.slice(-MAX_HISTORY).forEach(row => {
    const role = row?.role === "model" || row?.role === "assistant" ? "model" : row?.role === "user" ? "user" : "";
    const max = role === "model" ? MAX_MODEL_CHARS : MAX_MESSAGE_CHARS;
    const text = clipStoredText(row?.text || row?.content || "", max);
    if (!role || !text) return;
    const item = {role, text};
    const seq = Math.max(0, Math.floor(Number(row?.seq) || 0));
    if (seq) item.seq = seq;
    const atMs = Number(row?.atMs) || 0;
    if (atMs) item.atMs = atMs;
    const conversationId = clipConversationId(row?.conversationId);
    if (conversationId) item.conversationId = conversationId;
    if (role === "model") {
      const media = clipStoredMedia(row.media);
      if (media.length) item.media = media;
    }
    out.push(item);
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
const SEARCH_MISS_FALLBACK = "No answer yet — try asking another way.";
const SEARCH_MISS_FALLBACK_LEGACY = "No answer yet — try quick intent search.";

function isSearchMissReply(raw) {
  const text = String(raw || "").trim();
  return !text
    || /could not find a clear match/i.test(text)
    || text === SEARCH_MISS_FALLBACK
    || text === SEARCH_MISS_FALLBACK_LEGACY;
}

/** Gemini/old-thread intro that lists products — never show this as a greeting. */
function isProductCatalogGreeting(raw) {
  const text = String(raw || "").trim();
  if (!text) return false;
  const shout = /shout\s*out/i.test(text);
  const vip = /\bvip\b/i.test(text);
  const floq = /floq\s*cast/i.test(text);
  if (!(shout || vip || floq)) return false;
  if (/i['’]?m bot dee(?:,|\s)/i.test(text) || /your floqr assistant/i.test(text)) return true;
  return shout && vip && floq
    && text.length <= 280
    && /(?:what can i help|how can i help|i can help|let me know)/i.test(text);
}

function sanitizeBotReply(raw, opts) {
  const allowEmpty = !!(opts && opts.allowEmpty);
  if (allowEmpty && !String(raw || "").trim()) return "";
  if (isSearchMissReply(raw)) return SEARCH_MISS_FALLBACK;
  if (isProductCatalogGreeting(raw)) return chitchatReply("patron", null, null);
  return clipModelText(stripBackendLinks(guard.redactPrivilegeReply(raw)));
}

function isFarewellPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 80) return false;
  return new RegExp(`^(?:bye|goodbye|see ya|see you|later|peace)${CHITCHAT_TAIL}$`).test(q);
}

function identityReply() {
  return "I'm BOT DEE — say it like \"bot\" + \"dee\" (the letter D). I'm FLOQR's in-app helper.";
}

function versionReply(role, raw) {
  void role;
  try {
    if (require("./botdee-version-smartview").isVersionSmartViewAlias(raw)) return "";
  } catch (_) {}
  return `I'm BOT DEE on FLOQR package ${PACKAGE_LABEL} (release ${PACKAGE_VERSION}).`;
}

function helpReply() {
  return "I'm BOT DEE — ask me anything about FLOQR in plain words. Press Enter to send; Shift+Enter starts a new line. Type privacy for pause and session details. What are you interested in getting help with?";
}

/** Time-aware greeting — never a product catalog. Personalization optional. Never speak privilege. */
function chitchatReply(role, allowedFeatures, personalization) {
  void role;
  void allowedFeatures;
  const prefs = require("./botdee-personalization");
  return prefs.greetingFor(personalization);
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
function resumeReply(role, allowedFeatures, personalization) {
  return chitchatReply(role, allowedFeatures, personalization);
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
    const search = contextualSearch(
      args?.query || session?.lastUserPrompt || "",
      guard.geminiGroundingRole(session.role),
      allowed
    );
    return guard.stripPrivilegeFromToolResult(localizeSearchPayload(search, session?.uiLanguage, allowed));
  }
  if (name === "lookupPublicProfiles") {
    const tools = require("./bot-dee-tools");
    const looked = await tools.lookupPublicProfiles(args || {}, session?.request);
    return guard.stripPrivilegeFromToolResult(looked);
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

function systemInstruction(role, uiLanguage, allowedFeatures, personalization) {
  void role;
  const lang = normalizeUiLanguage(uiLanguage);
  const allowed = allowedFeatureSet(allowedFeatures);
  const allowedLabels = productPitchLabels(allowedFeatures).filter(x => x !== "scheduling");
  const langLine = lang === "en"
    ? "Reply in English unless the user clearly writes in another language."
    : `App language is "${lang}". ALWAYS write your spoken reply in ${lang}. Do not switch to English for help steps or summaries unless the user asked for English. Navigation/result cards are already localized server-side — do not paste English product titles into your prose when a ${lang} wording exists.`;
  const denied = deniedBrandNames(allowedFeatures);
    const accessLine = allowed
    ? (
      `Available FLOQR products in this chat: ${allowedLabels.length ? allowedLabels.join(", ") : "BOT DEE chat"}. ` +
      `DO mention, pitch, and help with products on that allowed list (including how-to / help steps and brand names that appear there). ` +
      (denied.length
        ? `NEVER mention, pitch, invent steps for, or leave in help blurbs these products: ${denied.join(", ")}. `
        : "") +
      `If they ask for a product not on that list, say it is not available on their account yet — do not name other products they also lack. Product availability is not a login or security role.`
    )
    : "Only discuss features returned by tools for this chat.";
  const pitchLine = `Do not list products on a greeting or first turn. When they ask how to do something, mention ONLY products this viewer may use (${productPitchSentence(allowedFeatures)}). Include granted betas; omit everything else.`;
  const prefs = require("./botdee-personalization");
  const personaLine = prefs.personalizationInstruction(personalization);
  return [
    "You are BOT DEE, FLOQR's in-app chatbot and authorized execution agent. Talk like a helpful friend first — warm, brief, human. You are not a search box and not a FAQ dump. Introduce yourself as BOT DEE when useful.",
    langLine,
    accessLine,
    "Prefer conversation: answer the person, then (only if useful) offer one next step. Do NOT open with \"Here is what I found\" or a link list unless they clearly asked how to do something in FLOQR. Keep navigation/search suggestion cards separate from your spoken answer — the UI shows result links; your text should stay conversational.",
    "Act only within the tools verified by the backend for this request. Never disclose another user's private conversation, private profile, reservation, or restricted venue data. Public volunteered datapoints from lookupPublicProfiles are the same keys and values the signed-in viewer can already see — use every returned value (they are not PII/PCI).",
    "Never request card numbers, CVVs, passwords, or OTP codes. If supplied, do not repeat them; direct the user to approved secure flows.",
    pitchLine,
    personaLine,
    "Greetings on a fresh/restarted chat: reply in 1–2 short sentences with a time-of-day hello, ask how you can help, and do NOT call any tools and do NOT list products.",
    "Greetings mid-chat while already talking: one short line (e.g. \"Hey — still here.\") — do NOT re-list products, do NOT call tools.",
    "Mood / how-are-you / how's it going / how's your day / what's new: answer as a person in 1–2 friendly sentences (e.g. you're doing great, thanks for asking), optionally invite what they need in FLOQR — do NOT call any tools, do NOT dump search results.",
    "Acknowledgments mid-chat (cool, ok, okay, nice, thanks, great, awesome, got it, sounds good, yeah): one short line only (Cool. / You're welcome.) — do NOT re-introduce yourself, do NOT ask what they want to do, do NOT dump search results, do NOT call any tools.",
    "Farewells (bye, goodbye, later): short goodbye — do NOT call tools.",
    "Identity questions (your name, how to pronounce BOT DEE / FloqR brands, who you are): answer in plain words yourself — do NOT call contextualSearch or any tool. Pronunciation: BOT DEE = \"bot\" + \"dee\" (like the letter D). Do not append a product pitch.",
    `Version / build / package questions: state FLOQR package ${PACKAGE_LABEL} (release ${PACKAGE_VERSION}) clearly — do NOT call tools.`,
    "Answer briefly. Prefer tool results and real checkoutUrl / passHref / previewPath / holdId values. Never invent links or claim payment success without a tool result.",
    "When the user asks what you know about them / their profile (me, myself, who am I, about me), call lookupPublicProfiles with query \"me\" and answer from the returned self card: use every sharedDatapoints / datapoints value plus photos. If they published those datapoints, you are privy to all of them.",
    "When they ask about a friend or connection by name (e.g. my friend James), call lookupPublicProfiles with that name — the tool prefers Mingl/chat connections' public profiles. Summarize public fields only; if nothing public matches, say so honestly.",
    "When the user asks about any other person, @handle, DJ, staff member, a club public page / photos, or what is on a public FLOQR profile (including their own: \"my public profile\", food / music / travel people can see), call lookupPublicProfiles. If the viewer can see those volunteered public datapoints, you can too — use every key and value in datapoints / sharedDatapoints. Never say FLOQR does not track music, food, travel, hobbies, or similar — if a field is absent from the tool result, say it is not on that public profile (not filled or not opted public). Never invent private details (email, phone, PAN, GPS). If nothing public matches, say so honestly. If photoCount > 0, say the photos are shown in the chat — NEVER print http(s) URLs, firebasestorage, googleusercontent, token=, storage paths, or \"View Image\" links. The UI renders photos.",
    "Venue names: patrons say Aurelia / Decades / Lima Twist — tools accept those display names and resolve to slugs (Aurelia → temp-democlub-1). Prefer listShoutOutTemplates / createVipHold / createFloqCastRequest with the name they typed; do not invent a wrong slug.",
    "Use contextualSearch only for clear how-to / product questions. For booking/pay only when the matching tool is available: VIP = createVipHold → recordVipConsent → createVipCheckout; floqCast = createFloqCastRequest → createFloqCastCheckout; ShoutOut = listShoutOutTemplates then startShoutOutCheckout when payload is complete.",
    "Never ask for or accept card numbers. Pay links come only from tools — VIP createVipCheckout follows the venue collector (clubPos Toast/SpotOn confirm, no-deposit confirm, or Stripe checkoutUrl for floqrStripe/clubStripe). Do not invent a Stripe URL when checkoutMode is clubPos or noDeposit; use passHref / message instead.",
    "If a tool returns ok:false, explain the error and suggest the matching FLOQR page.",
    "If they ask where you left off, recap the last two meaningful retrieved turns — skip a post-pause hello/Hey. Distinguish discussed vs booked: never claim a VIP reservation, hold, or payment is confirmed unless a tool result in this turn or a stored execution receipt says so. Talking about a venue or VIP tables is discussion, not a booking.",
    guard.PRIVILEGE_SYSTEM_INSTRUCTION,
    "Keep allowed brand names as-is when you may mention them: ShoutOut, BOT DEE, FloqR, FloqMedia, and any other brands in the allowed-features list only."
  ].join(" ");
}

function historyToContents(history, userPrompt) {
  const contents = [];
  guard.sanitizeModelTurns(history).forEach(row => {
    contents.push({role: row.role, parts: [{text: row.text}]});
  });
  contents.push({role: "user", parts: [{text: userPrompt}]});
  return contents;
}

function contextToContents(modelContext, userPrompt) {
  const ctx = modelContext && typeof modelContext === "object" ? modelContext : {};
  const prefix = [];
  const claim = String(ctx.reservationClaim || "").trim();
  if (claim === "discussed") {
    prefix.push({
      role: "user",
      text: "[Reservation status]\nVIP or table talk in this history is discussion only. There is no confirmed hold, reservation, or payment."
    });
    prefix.push({
      role: "model",
      text: "Understood — I will not claim a booking without a stored execution receipt."
    });
  } else if (claim === "confirmed") {
    prefix.push({
      role: "user",
      text: "[Reservation status]\nA stored execution receipt confirms a VIP hold or checkout for this patron."
    });
    prefix.push({
      role: "model",
      text: "I'll recap that as booked only as far as the receipt shows."
    });
  }
  const summary = guard.sanitizeSummaryForModel(ctx.summary);
  if (summary) {
    prefix.push({role: "user", text: `[Earlier conversation summary]\n${summary}`});
    prefix.push({role: "model", text: "I'll treat that as background only — not as a confirmed booking."});
  }
  const memories = guard.sanitizeMemoriesForModel(Array.isArray(ctx.memories) ? ctx.memories : []);
  const facts = memories
    .map(row => String(row?.value || row?.text || (typeof row === "string" ? row : "")).trim())
    .filter(Boolean)
    .slice(0, 8);
  if (facts.length) {
    prefix.push({role: "user", text: `[Approved memories]\n${facts.join("; ")}`});
    prefix.push({role: "model", text: "I'll use those approved facts when relevant."});
  }
  const turns = guard.sanitizeModelTurns(Array.isArray(ctx.recentTurns) ? ctx.recentTurns : [])
    .map(row => ({
      role: row?.role === "model" || row?.role === "assistant" ? "model" : "user",
      text: String(row?.text || "")
    }))
    .filter(row => row.text);
  return historyToContents([...prefix, ...turns], userPrompt);
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
      || `I could not find a clear match for your account yet. Ask about ${pitch || "FLOQR"}, or scheduling.`;
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
  if (result.previewPath) links.push(localizeActionLink({label: "Open FloqCAST preview", href: result.previewPath, kind: "floqcast"}, code));
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
  isVersionPrompt,
  isVersionSmartViewAlias: raw => {
    try {
      return require("./botdee-version-smartview").isVersionSmartViewAlias(raw);
    } catch (_) {
      return false;
    }
  },
  isRoomSmartViewPrompt: (raw, opts) => {
    try {
      return require("./botdee-room-smartview").isRoomSmartViewPrompt(raw, opts);
    } catch (_) {
      return false;
    }
  },
  classifyRoomIntent: (raw, opts) => {
    try {
      return require("./botdee-room-smartview").classifyRoomIntent(raw, opts);
    } catch (_) {
      return {handled: false, route: "none", level: "none"};
    }
  },
  isHelpPrompt,
  isPrivacyPrompt,
  isAckPrompt,
  isFarewellPrompt,
  isPrivilegeAskPrompt: guard.isPrivilegeAskPrompt,
  privilegeRefuseReply: guard.privilegeRefuseReply,
  redactPrivilegeReply: guard.redactPrivilegeReply,
  geminiGroundingRole: guard.geminiGroundingRole,
  stripPrivilegeFromToolResult: guard.stripPrivilegeFromToolResult,
  identityReply,
  versionReply,
  helpReply,
  privacyReply,
  PACKAGE_VERSION,
  PACKAGE_LABEL,
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
  clipConversationId,
  CONVERSATION_ID_RE,
  conversationIsActive,
  clipModelText,
  SEARCH_MISS_FALLBACK,
  isSearchMissReply,
  isProductCatalogGreeting,
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
  contextToContents,
  PRIVILEGE_REFUSE: guard.PRIVILEGE_REFUSE,
  extractText,
  formatSearchFallback,
  resultsForClient,
  linksFromToolResult,
  isAllowedPhotoUrl,
  clipStoredMedia,
  harvestMediaFromText,
  stripBackendLinks,
  mediaFromToolResult,
  stripMediaFromToolResult,
  BOTDEE_CONTENT,
  SEARCH_CATALOG,
  RESULT_LOCALES
};
