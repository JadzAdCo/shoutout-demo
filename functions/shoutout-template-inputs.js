/* Patron input lists per ShoutOut template (required vs optional).
   Catalog + composer + SMARTpreview + BOT DEE headless share this map.
   No Firebase. No Places / Yelp / TM. */
"use strict";

const FIELD_ASK = Object.freeze({
  club: "Which venue should this ShoutOut play on?",
  message: "What should the shoutout text say on the sign?",
  handle: "Include your @handle on the FloqR card?",
  media: "Add a photo or video, or keep this a text sign?",
  jerseyTeamId: "Which country or club kit should the jersey use?",
  jerseyName: "What name goes on the jersey back?",
  jerseyNumber: "What number goes on the jersey?",
  playerName: "What name should the sign show?",
  facePhoto: "Baller's Alert needs a face photo. Open compose to add it, or send an https photo URL.",
  teamPhotos: "Football Intro needs four player photos. Open compose to add them.",
  company: "Optional company line on the card?",
  compose: "That board needs a photo on compose. Open ShoutOut compose to finish it, or reply with an https photo URL."
});

const FAMILIES = Object.freeze({
  classicBoard: {
    required: Object.freeze(["club", "message"]),
    optional: Object.freeze(["handle"])
  },
  splitMedia: {
    required: Object.freeze(["club", "message", "media"]),
    optional: Object.freeze(["handle"])
  },
  soccerJersey: {
    required: Object.freeze(["club", "jerseyTeamId", "jerseyName", "jerseyNumber"]),
    optional: Object.freeze(["handle", "message"])
  },
  nameOnly: {
    required: Object.freeze(["club", "playerName"]),
    optional: Object.freeze(["handle"])
  },
  ballersAlert: {
    required: Object.freeze(["club", "facePhoto", "playerName"]),
    optional: Object.freeze(["company", "handle"])
  },
  footballIntro: {
    required: Object.freeze(["club", "teamPhotos"]),
    optional: Object.freeze(["message", "handle"])
  }
});

function text(value) {
  return String(value == null ? "" : value).trim();
}

function familyOf(template = {}) {
  const t = template && typeof template === "object" ? template : {};
  const id = text(t.id || t.templateId || "");
  if (t.nameOnly === true || id === "heistVaultDollars" || id === "heistRedLux") return "nameOnly";
  if (t.layout === "football-team-intro" || id === "zebbiesFootballTeamIntro") return "footballIntro";
  if (t.requiresFacePhoto === true || t.ballerAlert === true || /^ballersAlert/i.test(id)) return "ballersAlert";
  if (
    t.jerseyNameField === true
    || t.layout === "soccer-jersey"
    || t.layout === "nfl-jersey"
    || /^(soccer|nba|nfl)/i.test(id)
  ) return "soccerJersey";
  if (
    t.supportsMedia === true
    || t.supportsImage === true
    || t.supportsVideo === true
    || t.layout === "split-media"
  ) return "splitMedia";
  return "classicBoard";
}

function copyList(list) {
  return Object.freeze((Array.isArray(list) ? list : []).map(String));
}

function normalizeInputs(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  const required = [];
  const optional = [];
  const seen = new Set();
  (Array.isArray(row.required) ? row.required : []).forEach(id => {
    const key = text(id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    required.push(key);
  });
  (Array.isArray(row.optional) ? row.optional : []).forEach(id => {
    const key = text(id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    optional.push(key);
  });
  if (!required.length) {
    const fallback = FAMILIES.classicBoard;
    return {required: copyList(fallback.required), optional: copyList(fallback.optional)};
  }
  return {required: copyList(required), optional: copyList(optional)};
}

function forTemplate(template = {}) {
  const t = template && typeof template === "object" ? template : {};
  if (t.patronInputs && (t.patronInputs.required || t.patronInputs.optional)) {
    return normalizeInputs(t.patronInputs);
  }
  const family = FAMILIES[familyOf(t)] || FAMILIES.classicBoard;
  return {required: copyList(family.required), optional: copyList(family.optional)};
}

function stampTemplate(template = {}) {
  const t = template && typeof template === "object" ? template : {};
  t.patronInputs = forTemplate(t);
  t.patronInputFamily = familyOf(t);
  return t;
}

function stampCatalog(templates = {}) {
  const map = templates && typeof templates === "object" ? templates : {};
  Object.keys(map).forEach(id => {
    const row = map[id];
    if (!row || typeof row !== "object") return;
    if (!row.id) row.id = id;
    stampTemplate(row);
  });
  return map;
}

function fieldAsk(fieldId) {
  const id = text(fieldId);
  return FIELD_ASK[id] || "I need a bit more to throw that ShoutOut from chat.";
}

module.exports = {
  FIELD_ASK,
  FAMILIES,
  familyOf,
  forTemplate,
  stampTemplate,
  stampCatalog,
  fieldAsk,
  normalizeInputs
};
