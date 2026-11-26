/* BOT DEE session workflow intents + datapoints.
   Deterministic. Gemini off. Native-script aliases (11 langs). No IP.
   s3.3.087 Functions CI retrigger (first push run cancelled by concurrency). */
"use strict";

const city = require("./botdee-city-tokens");

const PRODUCT_INTENTS = Object.freeze(["reserve", "shoutout", "floqcast"]);
const NEUTRAL_STENCIL_ID = "st-people";

const ALIASES = Object.freeze({
  reserve: [
    "reserve", "reservation", "reservations", "book a table", "hold a table", "vip reserv",
    "reservieren", "reservierung", "tisch reserv",
    "réserver", "reserver", "reservation de table",
    "reservar", "reserva", "reservar mesa",
    "prenotare", "prenotazione", "riservare",
    "reservar mesa", "reservar uma mesa",
    "забронировать", "бронирование", "стол в клубе",
    "κράτηση", "κρατηση", "κλείσε τραπέζι",
    "zarezerwować", "rezerwacja",
    "reserveren", "tafel reserveren",
    "احجز", "حجز", "طاولة"
  ],
  shoutout: [
    "shoutout", "shout out", "throw a shoutout",
    "شاوت آوت"
  ],
  floqcast: [
    "floqcast", "floq cast", "go live",
    "فلوکاست"
  ],
  talk: [
    "just want to talk", "just talking", "i want to talk", "lets just talk", "let's just talk",
    "talking to you", "talk to a bot", "talk to bots", "chat with you",
    "nur reden", "nur sprechen", "juste parler", "solo hablar", "solo chiacchierare",
    "so falar", "просто поговорить", "απλά να μιλήσω", "po prostu pogadać",
    "gewoon praten", "أريد أن أتحدث", "بس أحكي"
  ],
  club: [
    "club", "nightclub", "lounge", "discoteca", "discothek", "boite", "boîte",
    "club nocturno", "clube", "клуб", "κλαμπ", "klub", "نادي", "ملهى"
  ],
  "fashion-week": [
    "fashion week", "mfw", "runway", "couture",
    "modewoche", "semaine de la mode", "semana de la moda", "settimana della moda",
    "semana de moda", "неделя моды", "εβδομάδα μόδας", "tydzień mody", "modeweek",
    "أسبوع الموضة", "اسبوع الموضة"
  ]
});

function text(value, max = 400) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function haystack(raw) {
  const orig = text(raw).toLowerCase();
  const folded = city.normalizePlaceNeedle(raw) || orig;
  return {orig, folded};
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAlias(hay, aliases) {
  const orig = hay && hay.orig ? hay.orig : String(hay || "");
  const folded = hay && hay.folded ? hay.folded : orig;
  return (aliases || []).some(alias => {
    const token = String(alias || "").trim().toLowerCase();
    if (!token) return false;
    const foldedAlias = city.normalizePlaceNeedle(alias) || token;
    if (/[^\x00-\x7f]/.test(token) || /[^\x00-\x7f]/.test(foldedAlias)) {
      return orig.includes(token) || folded.includes(token) || (foldedAlias && folded.includes(foldedAlias));
    }
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(token)}(?:$|[^\\p{L}\\p{N}])`, "u");
    const reFold = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(foldedAlias)}(?:$|[^\\p{L}\\p{N}])`, "u");
    return re.test(orig) || re.test(folded) || reFold.test(folded);
  });
}

function unique(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach(item => {
    const next = String(item || "").trim().toLowerCase();
    if (!next || seen.has(next)) return;
    seen.add(next);
    out.push(next);
  });
  return out;
}

function placesFrom(raw) {
  const hay = haystack(raw);
  const ids = [];
  (city.PACKAGED || []).forEach(row => {
    if (!row || row.enabled === 0) return;
    const aliases = Object.values(row.aliasesByLang || {}).flat();
    const tokens = [...(row.canonicalTokens || []), ...(row.matchAliases || []), ...aliases];
    if (hasAlias(hay, tokens)) ids.push(row.placeId);
  });
  return unique(ids);
}

function emptyWorkflow() {
  return {
    intents: [],
    places: [],
    topics: [],
    venueKinds: [],
    productClear: false,
    talkOnly: false,
    placeWithoutProduct: false,
    verbiage: "",
    backgroundHint: "",
    stencilHint: ""
  };
}

function fashionBackgroundFor(places) {
  const set = new Set(places || []);
  if (set.has("paris")) return "bg-paris-fashion-week";
  if (set.has("london")) return "bg-london-fashion-week";
  if (set.has("new-york") || set.has("new york")) return "bg-new-york-fashion-week";
  if (set.has("milan")) return "bg-milan-fashion-week";
  return "bg-milan-fashion-week";
}

function verbiageFrom(row) {
  const bits = [];
  if (row.intents.includes("reserve")) bits.push("reserve");
  if (row.venueKinds.includes("club")) bits.push("club");
  (row.places || []).forEach(place => bits.push(place));
  if (row.topics.includes("fashion-week")) bits.push("Fashion Week");
  return unique(bits).join(" · ");
}

function classifySessionWorkflow(raw) {
  const source = text(raw, 2000);
  if (!source) return emptyWorkflow();
  const hay = haystack(source);
  const quoted = isBotPlaceSelfQuote(source);
  const intents = [];
  if (!quoted) {
    if (hasAlias(hay, ALIASES.reserve)) intents.push("reserve");
    if (hasAlias(hay, ALIASES.shoutout)) intents.push("shoutout");
    if (hasAlias(hay, ALIASES.floqcast)) intents.push("floqcast");
  }
  const talk = !quoted && hasAlias(hay, ALIASES.talk);
  const places = placesFrom(source);
  const topics = [];
  if (hasAlias(hay, ALIASES["fashion-week"])) topics.push("fashion-week");
  const venueKinds = [];
  if (hasAlias(hay, ALIASES.club)) venueKinds.push("club");
  const productClear = intents.some(id => PRODUCT_INTENTS.includes(id));
  const placeWithoutProduct = !productClear && (places.length > 0 || topics.length > 0);
  const talkOnly = talk && !productClear && !placeWithoutProduct;
  const row = {
    intents: unique(intents),
    places,
    topics: unique(topics),
    venueKinds: unique(venueKinds),
    productClear,
    talkOnly,
    placeWithoutProduct,
    verbiage: "",
    backgroundHint: "",
    stencilHint: placeWithoutProduct ? NEUTRAL_STENCIL_ID : ""
  };
  if (row.topics.includes("fashion-week")) {
    row.backgroundHint = fashionBackgroundFor(places);
  }
  row.verbiage = verbiageFrom(row);
  return row;
}

function mergeWorkflow(previous, next) {
  const prev = previous && typeof previous === "object" ? previous : emptyWorkflow();
  const cur = next && typeof next === "object" ? next : emptyWorkflow();
  const intents = unique([...(prev.intents || []), ...(cur.intents || [])]);
  const places = unique([...(prev.places || []), ...(cur.places || [])]);
  const topics = unique([...(prev.topics || []), ...(cur.topics || [])]);
  const venueKinds = unique([...(prev.venueKinds || []), ...(cur.venueKinds || [])]);
  const productClear = intents.some(id => PRODUCT_INTENTS.includes(id));
  const placeWithoutProduct = !!(cur.placeWithoutProduct && !cur.productClear && !productClear);
  const talkOnly = !!(cur.talkOnly && !cur.productClear);
  const merged = {
    intents,
    places,
    topics,
    venueKinds,
    productClear: productClear || !!cur.productClear,
    talkOnly,
    placeWithoutProduct,
    verbiage: cur.verbiage || verbiageFrom({intents, places, topics, venueKinds}),
    backgroundHint: cur.backgroundHint || prev.backgroundHint || "",
    stencilHint: placeWithoutProduct ? NEUTRAL_STENCIL_ID : (cur.stencilHint || "")
  };
  if (!merged.backgroundHint && merged.topics.includes("fashion-week")) {
    merged.backgroundHint = fashionBackgroundFor(merged.places);
  }
  if (!merged.verbiage) merged.verbiage = verbiageFrom(merged);
  return merged;
}

function clipWorkflow(row) {
  const next = mergeWorkflow(emptyWorkflow(), row);
  return {
    intents: next.intents.slice(0, 8),
    places: next.places.slice(0, 8),
    topics: next.topics.slice(0, 8),
    venueKinds: next.venueKinds.slice(0, 8),
    productClear: !!next.productClear,
    talkOnly: !!next.talkOnly,
    placeWithoutProduct: !!next.placeWithoutProduct,
    verbiage: text(next.verbiage, 180),
    backgroundHint: text(next.backgroundHint, 80),
    stencilHint: text(next.stencilHint, 80)
  };
}

function stampPlacePayload(payload, workflow) {
  if (!payload || typeof payload !== "object") return payload;
  const row = clipWorkflow(workflow);
  const publicData = Object.assign({}, payload.floqrPublicData || {});
  if (row.backgroundHint) publicData.smartBackgroundId = row.backgroundHint;
  if (row.stencilHint) publicData.smartStencilId = row.stencilHint;
  const tags = unique([
    ...(publicData.smartTags || payload.tags || []),
    ...row.places,
    ...row.topics,
    ...row.venueKinds,
    ...row.intents
  ]);
  if (tags.length) publicData.smartTags = tags;
  payload.floqrPublicData = publicData;
  payload.workflowVerbiage = row.verbiage;
  payload.tags = tags;
  return payload;
}

function talkJoke() {
  return "Don Papi the founder said humans like talking to bots.";
}

/** Patron pasted BOT DEE's own Place ask — not throw-ShoutOut / VIP reserV intent. */
function isBotPlaceSelfQuote(raw) {
  const q = text(raw, 2000).toLowerCase().replace(/[’']/g, "'");
  if (!q) return false;
  if (/\bplace smartview for\b/.test(q)) return true;
  if (/i'?ve added a smartview card of/.test(q)) return true;
  if (/what activities would you like to plan with me/.test(q)) return true;
  if (/\bbeautiful city/.test(q) && /\bsmartview card\b/.test(q)) return true;
  if (/what would you like to do/.test(q)
    && /throw a shout\s*out/.test(q)
    && /vip\s*reserv/.test(q)) {
    return true;
  }
  return false;
}

function titlePlace(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function placeLabel(placeId, lang) {
  const id = String(placeId || "").trim().toLowerCase();
  if (!id) return "";
  const code = String(lang || "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
  const row = (city.PACKAGED || []).find(item => item && item.placeId === id);
  const aliases = row && row.aliasesByLang && (row.aliasesByLang[code] || row.aliasesByLang.en);
  const token = Array.isArray(aliases) && aliases[0] ? aliases[0] : id;
  return titlePlace(token);
}

function fillAsk(tpl, vars) {
  const dict = vars && typeof vars === "object" ? vars : {};
  return String(tpl || "").replace(/\{(\w+)\}/g, (_, key) => (
    dict[key] == null ? "" : String(dict[key])
  ));
}

const ASK_NAMED = "{name}, {place} is a beautiful city… I've added a SMARTview card of {place} for your quick review. What activities would you like to plan with me in regards to {place}";
const ASK_UNNAMED = "{place} is a beautiful city… I've added a SMARTview card of {place} for your quick review. What activities would you like to plan with me in regards to {place}";
const ASK_GENERIC = "I've added a SMARTview card for your quick review. What activities would you like to plan with me?";

function askIntentReply(workflow, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const lang = String(options.lang || options.uiLanguage || "en").trim() || "en";
  const name = text(options.name, 40);
  const placeId = (workflow && workflow.places && workflow.places[0]) || "";
  const place = placeLabel(placeId, lang) || titlePlace(placeId);
  if (!place) {
    return name ? fillAsk("{name}, " + ASK_GENERIC, {name}) : ASK_GENERIC;
  }
  return name
    ? fillAsk(ASK_NAMED, {name, place})
    : fillAsk(ASK_UNNAMED, {place});
}

function askIntentMeta(workflow, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const lang = String(options.lang || options.uiLanguage || "en").trim() || "en";
  const name = text(options.name, 40);
  const placeId = (workflow && workflow.places && workflow.places[0]) || "";
  const place = placeLabel(placeId, lang) || titlePlace(placeId);
  return {
    reply: askIntentReply(workflow, options),
    replyKey: name && place ? "botdee.place.askNamed" : (place ? "botdee.place.askUnnamed" : "botdee.place.askGeneric"),
    replyVars: {name, place},
    replyAfterCards: true
  };
}

module.exports = {
  PRODUCT_INTENTS,
  NEUTRAL_STENCIL_ID,
  ALIASES,
  classifySessionWorkflow,
  mergeWorkflow,
  clipWorkflow,
  stampPlacePayload,
  talkJoke,
  askIntentReply,
  askIntentMeta,
  isBotPlaceSelfQuote,
  placeLabel,
  emptyWorkflow
};
