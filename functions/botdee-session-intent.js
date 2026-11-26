/* BOT DEE session workflow intents + datapoints.
   Deterministic. Gemini off. Native-script aliases (11 langs). No IP. */
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
  const intents = [];
  if (hasAlias(hay, ALIASES.reserve)) intents.push("reserve");
  if (hasAlias(hay, ALIASES.shoutout)) intents.push("shoutout");
  if (hasAlias(hay, ALIASES.floqcast)) intents.push("floqcast");
  const talk = hasAlias(hay, ALIASES.talk);
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
  if (row.verbiage) payload.summary = row.verbiage;
  payload.workflowVerbiage = row.verbiage;
  payload.tags = tags;
  return payload;
}

function talkJoke() {
  return "Don Papi the founder said humans like talking to bots.";
}

function askIntentReply(workflow) {
  const place = (workflow && workflow.places && workflow.places[0]) || "";
  const topic = (workflow && workflow.topics && workflow.topics[0]) || "";
  const where = [place, topic === "fashion-week" ? "Fashion Week" : topic].filter(Boolean).join(" ");
  if (where) {
    return `Place SMARTview for ${where}. What would you like to do — reserve a VIP reserV table, throw a ShoutOut, or just talk?`;
  }
  return "What would you like to do — reserve a VIP reserV table, throw a ShoutOut, or just talk?";
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
  emptyWorkflow
};
