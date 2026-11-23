/* Numbered collectableInput1..N on each ShoutOut template.
   Family lists seed those slots once. BOT DEE / Gemini / catalog read the
   numbered Firebase fields — not a family switch — as the collection list.
   No Places / Yelp / TM. */
"use strict";

const MAX_SLOTS = 16;

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

/** Seed-only. Runtime collection iterates collectableInput1..N. */
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

function requiredFlag(value, optionalHint) {
  if (optionalHint === true || optionalHint === 1 || optionalHint === "1") return 0;
  if (value === 0 || value === "0" || value === false || value === "optional") return 0;
  if (value === 1 || value === "1" || value === true || value === "required") return 1;
  return 1;
}

function slotRecord(fieldId, required, prompt, index) {
  const id = text(fieldId);
  if (!id) return null;
  const req = requiredFlag(required) === 1 ? 1 : 0;
  return {
    index: Number(index) > 0 ? Number(index) : 0,
    fieldId: id,
    required: req,
    prompt: text(prompt) || FIELD_ASK[id] || "I need a bit more to throw that ShoutOut from chat."
  };
}

function parseSlot(raw, index) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const parts = raw.split("|");
    const fieldId = text(parts[0]);
    if (!fieldId) return null;
    const required = parts.length > 1 ? requiredFlag(parts[1]) : 1;
    return slotRecord(fieldId, required, parts.slice(2).join("|"), index);
  }
  if (typeof raw !== "object") return null;
  const fieldId = text(raw.fieldId || raw.field || raw.id || raw.key);
  if (!fieldId) return null;
  const required = raw.optional === true || raw.optional === 1 || raw.optional === "1"
    ? 0
    : raw.required;
  return slotRecord(fieldId, required, raw.prompt || raw.label || raw.value, index);
}

function listsToSlots(lists = {}, startIndex = 1) {
  const row = lists && typeof lists === "object" ? lists : {};
  const slots = [];
  const seen = new Set();
  let index = startIndex;
  (Array.isArray(row.required) ? row.required : []).forEach(id => {
    const key = text(id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    slots.push(slotRecord(key, 1, FIELD_ASK[key], index++));
  });
  (Array.isArray(row.optional) ? row.optional : []).forEach(id => {
    const key = text(id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    slots.push(slotRecord(key, 0, FIELD_ASK[key], index++));
  });
  return slots.filter(Boolean);
}

function familySeedSlots(template = {}) {
  const family = FAMILIES[familyOf(template)] || FAMILIES.classicBoard;
  return listsToSlots(family);
}

function readNumberedSlots(template = {}) {
  const t = template && typeof template === "object" ? template : {};
  const declared = Number(t.collectableInputCount);
  const max = declared > 0 ? Math.min(MAX_SLOTS, declared) : MAX_SLOTS;
  const slots = [];
  for (let i = 1; i <= max; i++) {
    const parsed = parseSlot(t[`collectableInput${i}`], i);
    if (!parsed) {
      if (declared > 0) continue;
      break;
    }
    parsed.index = i;
    slots.push(parsed);
  }
  return slots;
}

function hasNumberedSlots(template = {}) {
  return readNumberedSlots(template).length > 0;
}

function writeNumberedSlots(template, slots) {
  const t = template && typeof template === "object" ? template : {};
  const list = (Array.isArray(slots) ? slots : []).filter(Boolean);
  const clearUntil = Math.max(Number(t.collectableInputCount) || 0, list.length, MAX_SLOTS);
  for (let i = 1; i <= clearUntil; i++) delete t[`collectableInput${i}`];
  t.collectableInputCount = list.length;
  list.forEach((slot, idx) => {
    const n = idx + 1;
    t[`collectableInput${n}`] = {
      fieldId: slot.fieldId,
      required: Number(slot.required) === 1 ? 1 : 0,
      prompt: slot.prompt || FIELD_ASK[slot.fieldId] || ""
    };
  });
  return t;
}

function slotsFromTemplate(template = {}) {
  const numbered = readNumberedSlots(template);
  if (numbered.length) return numbered;
  const fromLists = listsToSlots(template.patronInputs || {});
  if (fromLists.length) return fromLists;
  return familySeedSlots(template);
}

function forTemplate(template = {}) {
  const slots = slotsFromTemplate(template);
  return {
    required: copyList(slots.filter(slot => Number(slot.required) === 1).map(slot => slot.fieldId)),
    optional: copyList(slots.filter(slot => Number(slot.required) !== 1).map(slot => slot.fieldId)),
    slots
  };
}

function stampTemplate(template = {}) {
  const t = template && typeof template === "object" ? template : {};
  const slots = slotsFromTemplate(t);
  writeNumberedSlots(t, slots);
  const lists = forTemplate(t);
  t.patronInputs = {required: lists.required, optional: lists.optional};
  t.patronInputFamily = familyOf(t);
  t.collectableInputCount = slots.length;
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

function collectableFields(template = {}) {
  const stamped = stampTemplate({...(template && typeof template === "object" ? template : {})});
  const count = Number(stamped.collectableInputCount) || 0;
  const out = {
    id: text(stamped.id || stamped.templateId),
    name: text(stamped.name || stamped.id),
    collectableInputCount: count
  };
  for (let i = 1; i <= count; i++) {
    out[`collectableInput${i}`] = stamped[`collectableInput${i}`];
  }
  return out;
}

function fieldAsk(fieldId, template) {
  const id = text(fieldId);
  if (template) {
    const slot = slotsFromTemplate(template).find(row => row.fieldId === id);
    if (slot && slot.prompt) return slot.prompt;
  }
  return FIELD_ASK[id] || "I need a bit more to throw that ShoutOut from chat.";
}

function normalizeInputs(raw) {
  return forTemplate({patronInputs: raw});
}

module.exports = {
  MAX_SLOTS,
  FIELD_ASK,
  FAMILIES,
  familyOf,
  forTemplate,
  stampTemplate,
  stampCatalog,
  fieldAsk,
  normalizeInputs,
  slotsFromTemplate,
  hasNumberedSlots,
  collectableFields,
  parseSlot,
  writeNumberedSlots
};
