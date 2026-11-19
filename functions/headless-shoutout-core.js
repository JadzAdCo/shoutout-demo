/* Headless ShoutOut compose — venue + message (+ optional template/screen)
   from chat or FloqR pages. No Firebase. Checkout vs free submit is the caller. */
"use strict";

const DEFAULT_TEMPLATE_ID = "blackwhite";

const LED_FORMATS = Object.freeze(["led-96x48", "led-64x48", "led-64x32"]);

const SCREEN_LABELS = Object.freeze({
  "led-96x48": "96×48",
  "led-64x48": "64×48",
  "led-64x32": "64×32"
});

const CLASSIC_BOARD_CAPS = Object.freeze({
  "led-96x48": {profileId: "classicBoard", lineCount: 3, perLine: 15, main: 45, sub: 20},
  "led-64x48": {profileId: "classicBoard", lineCount: 3, perLine: 12, main: 36, sub: 18},
  "led-64x32": {profileId: "classicBoard", lineCount: 3, perLine: 10, main: 30, sub: 14}
});

const HEADLESS_TEXT_TEMPLATES = Object.freeze({
  blackwhite: {name: "Traditional", className: "blackwhite", priceCents: 0},
  birthday: {name: "Birthday", className: "birthday", priceCents: 0},
  vip: {name: "VIP", className: "vip", priceCents: 0},
  neon: {name: "Neon", className: "neon", priceCents: 0},
  gold: {name: "Gold", className: "gold", priceCents: 0},
  graduation: {name: "Graduation", className: "graduation", priceCents: 0},
  corporate: {name: "Corporate", className: "corporate", priceCents: 0},
  classicHalloween: {name: "Classic Halloween", className: "classicHalloween", priceCents: 1500}
});

const TEMPLATE_ALIASES = Object.freeze({
  blackwhite: "blackwhite",
  traditional: "blackwhite",
  classic: "blackwhite",
  "classic board": "blackwhite",
  birthday: "birthday",
  vip: "vip",
  neon: "neon",
  gold: "gold",
  graduation: "graduation",
  corporate: "corporate",
  halloween: "classicHalloween",
  "classic halloween": "classicHalloween",
  classichalloween: "classicHalloween"
});

const COMPOSER_ONLY_RE = /^(zebbiesFootballTeamIntro|soccer|nba|nfl|ballersAlert|blackCard|heist|birthdayMedia|anniversaryMedia|engagementMedia|fianceMedia)/i;

const CLUB_NAME_ALIASES = Object.freeze({
  aurelia: "temp-democlub-1",
  "aurelia demo": "temp-democlub-1",
  "aurelia demo club": "temp-democlub-1",
  "demo club": "temp-democlub-1",
  decades: "decades-washington-dc",
  "decades washington": "decades-washington-dc",
  "decades washington dc": "decades-washington-dc",
  "decades nightclub": "decades-washington-dc",
  "lima twist": "lima-twist-washington-dc",
  "lima twist club": "lima-twist-washington-dc",
  "lima twist washington": "lima-twist-washington-dc",
  "lima twist washington dc": "lima-twist-washington-dc",
  shoko: "shoko-barcelona-spain",
  "shoko barcelona": "shoko-barcelona-spain",
  "shoko barcelona spain": "shoko-barcelona-spain"
});

const ALIAS_NEEDLES = Object.keys(CLUB_NAME_ALIASES).sort((a, b) => b.length - a.length);

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function normalizeClubNeedle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalFormatId(formatId = "") {
  const raw = String(formatId || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.startsWith("p125-")) return raw.replace(/^p125-/, "led-");
  if (LED_FORMATS.includes(raw)) return raw;
  const compact = raw.replace(/[×x]/g, "x");
  if (compact === "96x48" || compact.endsWith("96x48")) return "led-96x48";
  if (compact === "64x48" || compact.endsWith("64x48")) return "led-64x48";
  if (compact === "64x32" || compact.endsWith("64x32")) return "led-64x32";
  return "";
}

function flag01(value) {
  return value === 1 || value === "1" || value === true;
}

function venueSupportsFormat(venue = {}, formatId = "") {
  const id = canonicalFormatId(formatId);
  if (!id) return false;
  const key = {
    "led-96x48": "VenueSupports96x48",
    "led-64x48": "VenueSupports64x48",
    "led-64x32": "VenueSupports64x32"
  }[id];
  if (!key) return false;
  const hasExplicit = LED_FORMATS.some(fid => {
    const k = {
      "led-96x48": "VenueSupports96x48",
      "led-64x48": "VenueSupports64x48",
      "led-64x32": "VenueSupports64x32"
    }[fid];
    const v = venue[k];
    return v === 0 || v === 1 || v === "0" || v === "1" || v === true || v === false;
  });
  if (!hasExplicit) return true;
  return flag01(venue[key]);
}

function pickScreenFormat(venue = {}, requested = "") {
  const want = canonicalFormatId(requested);
  if (want && venueSupportsFormat(venue, want)) return want;
  const primary = canonicalFormatId(venue.primaryDisplayScreenFormatId);
  if (primary && venueSupportsFormat(venue, primary)) return primary;
  for (const id of LED_FORMATS) {
    if (venueSupportsFormat(venue, id)) return id;
  }
  return "led-96x48";
}

function isComposerOnlyTemplate(templateId = "") {
  return COMPOSER_ONLY_RE.test(String(templateId || ""));
}

function resolveTemplateId(raw = "") {
  const id = String(raw || "").trim();
  if (!id) return "";
  if (HEADLESS_TEXT_TEMPLATES[id]) return id;
  const alias = TEMPLATE_ALIASES[normalizeClubNeedle(id)];
  return alias || "";
}

function pickTemplate(venue = {}, requested = "") {
  const explicit = String(requested || "").trim();
  if (explicit && isComposerOnlyTemplate(explicit)) {
    return {
      composerOnly: true,
      templateId: explicit,
      reason: "That template needs photos or extra fields on compose. Open ShoutOut compose to finish it."
    };
  }
  let id = resolveTemplateId(explicit);
  if (!id) id = DEFAULT_TEMPLATE_ID;
  const meta = HEADLESS_TEXT_TEMPLATES[id] || HEADLESS_TEXT_TEMPLATES[DEFAULT_TEMPLATE_ID];
  const venueIds = Array.isArray(venue.templates) ? venue.templates.map(String) : null;
  const keepExplicit = !!explicit && !!HEADLESS_TEXT_TEMPLATES[id];
  if (venueIds && venueIds.length && id !== DEFAULT_TEMPLATE_ID && !venueIds.includes(id) && !keepExplicit) {
    id = DEFAULT_TEMPLATE_ID;
  }
  const chosen = HEADLESS_TEXT_TEMPLATES[id] || meta;
  return {
    composerOnly: false,
    templateId: id,
    templateName: chosen.name,
    templateClassName: chosen.className,
    priceCents: chosen.priceCents || 0
  };
}

function graphemes(value) {
  const raw = String(value || "");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [...new Intl.Segmenter("en", {granularity: "grapheme"}).segment(raw)].map(part => part.segment);
  }
  return Array.from(raw);
}

function glyphSlice(value, start, end) {
  return graphemes(value).slice(start, end).join("");
}

function textCaps(templateId, screenFormatId) {
  void templateId;
  const screen = canonicalFormatId(screenFormatId) || "led-96x48";
  return CLASSIC_BOARD_CAPS[screen] || CLASSIC_BOARD_CAPS["led-96x48"];
}

function fitMainText(value = "", caps = CLASSIC_BOARD_CAPS["led-96x48"]) {
  const limit = Math.max(1, Number(caps.main || 45));
  const perLine = Math.max(1, Number(caps.perLine || 15));
  const lineCount = Math.max(1, Number(caps.lineCount || 3));
  const clean = String(value || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (lineCount <= 1) return glyphSlice(clean, 0, limit);
  const rows = [];
  let row = [];
  clean.split(/\s+/).filter(Boolean).forEach(word => {
    const wordGlyphs = graphemes(word);
    for (let i = 0; i < wordGlyphs.length; i += perLine) {
      const chunk = wordGlyphs.slice(i, i + perLine);
      const nextLen = row.length ? row.length + 1 + chunk.length : chunk.length;
      if (nextLen <= perLine) {
        if (row.length) row.push(" ");
        row.push(...chunk);
      } else if (rows.length < lineCount) {
        if (row.length) rows.push(row.join(""));
        row = chunk.slice();
      }
    }
  });
  if (row.length && rows.length < lineCount) rows.push(row.join(""));
  return glyphSlice(rows.join(" "), 0, limit);
}

function stripMessageWrap(raw) {
  return String(raw || "")
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuotedMessage(raw) {
  const match = String(raw || "").match(/[“"']([^"'”]{2,200})[”"']/);
  return match ? stripMessageWrap(match[1]) : "";
}

function extractSaysMessage(raw) {
  const match = String(raw || "").match(
    /\b(?:that says|saying|that reads|message(?: is)?|text(?: is)?|board(?: that)? says)\s*[:\-–]?\s*(.+)$/i
  );
  return match ? stripMessageWrap(match[1]) : "";
}

function extractColonMessage(raw) {
  const match = String(raw || "").match(/\bshout\s*out\b(?:.{0,80}?)[:\-–]\s*(?!\/\/)(.+)$/i);
  return match ? stripMessageWrap(match[1]) : "";
}

function extractAliasClub(raw) {
  const folded = ` ${normalizeClubNeedle(raw)} `;
  if (folded === "  ") return "";
  for (const needle of ALIAS_NEEDLES) {
    if (folded.includes(` ${needle} `)) return CLUB_NAME_ALIASES[needle];
  }
  return "";
}

function extractAtClub(raw) {
  const match = String(raw || "").match(
    /\b(?:at|@)\s+([A-Za-z0-9][A-Za-z0-9 .,'&-]{1,80}?)(?=\s+(?:that says|saying|that reads|message|text|:)|[.?]|$)/i
  );
  if (!match) return "";
  return String(match[1] || "")
    .replace(/,?\s*washington(?:\s*,?\s*dc)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function venuePrefix(raw, message = "") {
  const source = String(raw || "");
  const copy = String(message || "").trim();
  if (copy) {
    const idx = source.toLowerCase().lastIndexOf(copy.toLowerCase());
    if (idx > 0) return source.slice(0, idx);
  }
  const cut = source.search(/\b(?:that says|saying|that reads|message(?: is)?|text(?: is)?|board(?: that)? says)\b/i);
  if (cut > 0) return source.slice(0, cut);
  return source;
}

function extractTemplateHint(raw) {
  const folded = ` ${normalizeClubNeedle(raw)} `;
  const verbs = "(?:throw|send|post|compose|buy|pay for)";
  const board = "(?:shoutout|shout|board|template)";
  if (/\bclassic halloween\b/.test(folded)
    || new RegExp(`\\bhalloween ${board}\\b`).test(folded)
    || new RegExp(`\\b${verbs}(?: a)? halloween\\b`).test(folded)) {
    return "classicHalloween";
  }
  const named = [
    ["birthday", "birthday"],
    ["neon", "neon"],
    ["gold", "gold"],
    ["vip", "vip"],
    ["graduation", "graduation"],
    ["corporate", "corporate"]
  ];
  for (const [needle, id] of named) {
    if (new RegExp(`\\b${needle} ${board}\\b`).test(folded)
      || new RegExp(`\\b${verbs}(?: a)? ${needle}\\b`).test(folded)) {
      return id;
    }
  }
  return "";
}

function extractScreenHint(raw) {
  const compact = String(raw || "").toLowerCase().replace(/\s+/g, "");
  if (/96[x×]48/.test(compact)) return "led-96x48";
  if (/64[x×]48/.test(compact)) return "led-64x48";
  if (/64[x×]32/.test(compact)) return "led-64x32";
  return "";
}

function parseShoutOutExecute(raw) {
  const source = String(raw || "").trim();
  const message = extractQuotedMessage(source) || extractSaysMessage(source) || extractColonMessage(source);
  const prefix = venuePrefix(source, message);
  const atPhrase = extractAtClub(prefix);
  const atClub = extractAliasClub(atPhrase) || atPhrase;
  const aliasClub = extractAliasClub(prefix);
  return {
    clubQuery: atClub || aliasClub,
    message,
    templateId: extractTemplateHint(prefix),
    screenFormatId: extractScreenHint(prefix)
  };
}

function shoutOutComposeHref(clubLocationId) {
  const id = String(clubLocationId || "").trim();
  return id
    ? `./shoutout-search.html?from=botdee&location=${encodeURIComponent(id)}`
    : "./shoutout-search.html?from=botdee";
}

function composeShoutOutPayload({
  clubLocationId,
  venue = {},
  message,
  templateId,
  screenFormatId,
  userPrompt
} = {}) {
  const parsed = parseShoutOutExecute(userPrompt || "");
  const club = text(clubLocationId || parsed.clubQuery, 120);
  const main = text(message || parsed.message, 400);
  const requestedTemplate = text(templateId || parsed.templateId, 80);
  const requestedScreen = canonicalFormatId(screenFormatId || parsed.screenFormatId);
  const missing = [];
  if (!club) missing.push("club");
  if (!main) missing.push("message");
  if (missing.length) {
    return {
      ok: false,
      missing,
      parsed,
      composeHref: shoutOutComposeHref(club)
    };
  }
  const picked = pickTemplate(venue, requestedTemplate);
  if (picked.composerOnly) {
    return {
      ok: false,
      missing: [],
      composerOnly: true,
      templateId: picked.templateId,
      reason: picked.reason,
      parsed,
      composeHref: shoutOutComposeHref(club)
    };
  }
  const screen = pickScreenFormat(venue, requestedScreen);
  const caps = textCaps(picked.templateId, screen);
  const locationName = text(venue.locationName || venue.brandName || venue.displayName || club, 160);
  const brandName = text(venue.brandName || venue.locationName || "", 160);
  const mainText = fitMainText(main, caps);
  return {
    ok: true,
    missing: [],
    parsed,
    clubLocationId: club,
    templateId: picked.templateId,
    screenFormatId: screen,
    priceCents: picked.priceCents || 0,
    composeHref: shoutOutComposeHref(club),
    shoutout: {
      clubLocationId: club,
      location: club,
      club,
      locationName,
      brandName,
      clubName: locationName,
      template: picked.templateId,
      templateId: picked.templateId,
      templateName: picked.templateName,
      templateClassName: picked.templateClassName,
      screenFormatId: screen,
      screenFormatLabel: SCREEN_LABELS[screen] || screen,
      textProfileId: caps.profileId,
      maxMainCharacters: caps.main,
      maxSubCharacters: caps.sub,
      lineCount: caps.lineCount,
      maxCharactersPerLine: caps.perLine,
      mainText,
      subText: "",
      priceCents: picked.priceCents || 0,
      headless: true,
      source: "headless"
    }
  };
}

function missingAsk(needs = []) {
  const set = new Set(needs);
  if (set.has("club") && set.has("message")) {
    return "I can throw the ShoutOut from chat once I have the club and the message. Which venue, and what should it say?";
  }
  if (set.has("club")) return "Which venue should this ShoutOut play on?";
  if (set.has("message")) return "What should the ShoutOut say on the board?";
  return "I need a bit more to throw that ShoutOut from chat.";
}

function newReferenceNumber(now = new Date()) {
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FLOQR-${ymd}-${rand}`;
}

function portalShoutOutHref(shoutoutId) {
  const id = String(shoutoutId || "").trim();
  return id
    ? `./patron-portal.html?tab=shoutouts&id=${encodeURIComponent(id)}`
    : "./patron-portal.html?tab=shoutouts";
}

module.exports = {
  DEFAULT_TEMPLATE_ID,
  LED_FORMATS,
  SCREEN_LABELS,
  HEADLESS_TEXT_TEMPLATES,
  TEMPLATE_ALIASES,
  CLUB_NAME_ALIASES,
  parseShoutOutExecute,
  composeShoutOutPayload,
  pickScreenFormat,
  pickTemplate,
  fitMainText,
  textCaps,
  canonicalFormatId,
  shoutOutComposeHref,
  missingAsk,
  newReferenceNumber,
  portalShoutOutHref,
  isComposerOnlyTemplate,
  normalizeClubNeedle,
  venueSupportsFormat
};
