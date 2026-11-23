/* Headless ShoutOut compose — venue + shoutout text (+ optional template/screen)
   from chat or FloqR pages. Collection list is collectableInput1..N on the
   template (Firestore overlay when the caller loads templates/{id}). Family
   tables seed those slots; runtime iterates the numbered fields. Chat context
   fills first; ask only the next missing required slot. Checkout vs free
   submit is the caller. */
"use strict";

const templateInputs = require("./shoutout-template-inputs");

const DEFAULT_TEMPLATE_ID = "blackwhite";

const LED_FORMATS = Object.freeze(["led-96x48", "led-64x48", "led-64x32"]);

const SCREEN_LABELS = Object.freeze({
  "led-96x48": "96×48",
  "led-64x48": "64×48",
  "led-64x32": "64×32"
});

const TEXT_LAYOUT_VERSION = "29.08.4";

const CLASSIC_BOARD_CAPS = Object.freeze({
  "led-96x48": {
    profileId: "classicBoard", lineCount: 3, perLine: 15, main: 45, sub: 20,
    mainTextSizePercent: 20.8, subTextSizePercent: 7.8, minimumFontPixels: 0
  },
  "led-64x48": {
    profileId: "classicBoard", lineCount: 3, perLine: 12, main: 36, sub: 18,
    mainTextSizePercent: 20.8, subTextSizePercent: 7.8, minimumFontPixels: 0
  },
  "led-64x32": {
    profileId: "classicBoard", lineCount: 3, perLine: 10, main: 30, sub: 14,
    mainTextSizePercent: 20.8, subTextSizePercent: 7.8, minimumFontPixels: 0
  }
});

/** Catalog className / name must match shared-data.js or Preview + LED skip classic-bw.
    stampCatalog writes collectableInput1..N (seed). Runtime reads those fields. */
const HEADLESS_TEXT_TEMPLATES = Object.freeze(templateInputs.stampCatalog({
  blackwhite: {
    id: "blackwhite",
    name: "Traditional Black and White ShoutOut",
    className: "classic-bw",
    priceCents: 0,
    identityRail: true,
    identityAnimation: "identity-loop",
    identityAnimationSeconds: 6
  },
  birthday: {name: "Birthday Glow", className: "neon", priceCents: 0, identityRail: true},
  vip: {name: "VIP Table", className: "gold", priceCents: 0, identityRail: true},
  neon: {name: "Neon ShoutOut", className: "neon", priceCents: 0, identityRail: true},
  gold: {name: "Gold Celebration", className: "gold", priceCents: 0, identityRail: true},
  graduation: {name: "Graduation Night", className: "classic-bw", priceCents: 0, identityRail: true},
  corporate: {name: "Corporate Event", className: "classic-bw", priceCents: 0, identityRail: true},
  classicHalloween: {
    name: "Classic Halloween",
    className: "classic-bw classic-halloween",
    priceCents: 1500,
    identityRail: true,
    allowEmoji: true,
    halloweenFinale: true,
    defaultBackgroundUrl: "./images/halloween/classic-halloween-2x1.svg"
  },
  birthdayMedia: {
    name: "Happy Birthday with image/video placeholder",
    className: "celebration-media",
    priceCents: 0,
    identityRail: true,
    supportsMedia: true
  },
  soccerJersey: {
    name: "Soccer Jersey",
    className: "soccer-jersey sports-jersey jersey-photo-back",
    priceCents: 3000,
    identityRail: true,
    jerseyNameField: true,
    jerseyNumberField: true
  },
  zebbiesFootballTeamIntro: {
    name: "Football Intro",
    className: "football-team-intro",
    priceCents: 3000,
    identityRail: true,
    layout: "football-team-intro"
  },
  heistVaultNight: {
    name: "Locked Up",
    className: "classic-bw",
    priceCents: 3000,
    identityRail: true,
    defaultBackgroundUrl: "./images/heist/heist-jail-bars.png"
  },
  heistPoliceCar: {
    name: "Police Car Arrest",
    className: "classic-bw",
    priceCents: 3000,
    identityRail: true,
    defaultBackgroundUrl: "./images/heist/heist-police-car.png"
  },
  heistInterrogation: {
    name: "I Aint No Snitch",
    className: "classic-bw",
    priceCents: 3000,
    identityRail: true,
    defaultBackgroundUrl: "./images/heist/heist-interrogation.png"
  },
  heistVaultDollars: {
    name: "Tengo muchos dólares",
    className: "classic-bw",
    priceCents: 3000,
    identityRail: true,
    nameOnly: true,
    typedLine: "Tengo muchos dólares... I just did a heist!",
    defaultBackgroundUrl: "./images/heist/vault-night.jpg"
  },
  ballersAlert: {
    id: "ballersAlert",
    name: "Baller's Alert",
    className: "baller-card baller-alert",
    priceCents: 10000,
    identityRail: true,
    requiresFacePhoto: true,
    ballerAlert: true
  }
}));

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
  classichalloween: "classicHalloween",
  jersey: "soccerJersey",
  soccer: "soccerJersey",
  "soccer jersey": "soccerJersey",
  football: "zebbiesFootballTeamIntro",
  "football intro": "zebbiesFootballTeamIntro",
  heist: "heistVaultNight",
  "locked up": "heistVaultNight",
  "tengo muchos": "heistVaultDollars",
  "tengo muchos dolares": "heistVaultDollars",
  ballers: "ballersAlert",
  "ballers alert": "ballersAlert",
  "baller's alert": "ballersAlert"
});

const JERSEY_TEAM_ALIASES = Object.freeze({
  morocco: "soccerMorocco",
  spain: "soccerSpain",
  cameroon: "soccerCameroon",
  nigeria: "soccerNigeria",
  tanzania: "soccerTanzania",
  egypt: "soccerEgypt",
  ghana: "soccerGhana",
  senegal: "soccerSenegal",
  kenya: "soccerKenya",
  chelsea: "soccerChelsea",
  psg: "soccerParisSaintGermain",
  "paris saint germain": "soccerParisSaintGermain",
  monaco: "soccerMonaco",
  "ivory coast": "soccerIvoryCoast",
  "dr congo": "soccerDRCongo"
});

const JERSEY_TEAM_NEEDLES = Object.keys(JERSEY_TEAM_ALIASES).sort((a, b) => b.length - a.length);

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

function resolveTemplateId(raw = "") {
  const id = String(raw || "").trim();
  if (!id) return "";
  if (HEADLESS_TEXT_TEMPLATES[id]) return id;
  const alias = TEMPLATE_ALIASES[normalizeClubNeedle(id)];
  return alias || "";
}

function catalogShapeFor(id = "", overlay = null) {
  const meta = HEADLESS_TEXT_TEMPLATES[id] || {};
  const extra = overlay && typeof overlay === "object" ? overlay : {};
  return templateInputs.stampTemplate({
    ...meta,
    ...extra,
    id,
    name: extra.name || meta.name,
    className: extra.className || meta.className,
    priceCents: extra.priceCents != null ? extra.priceCents : (meta.priceCents || 0),
    nameOnly: extra.nameOnly === true || meta.nameOnly === true,
    jerseyNameField: extra.jerseyNameField === true || meta.jerseyNameField === true,
    jerseyNumberField: extra.jerseyNumberField === true || meta.jerseyNumberField === true,
    requiresFacePhoto: extra.requiresFacePhoto === true || meta.requiresFacePhoto === true,
    ballerAlert: extra.ballerAlert === true || meta.ballerAlert === true,
    supportsMedia: extra.supportsMedia === true || meta.supportsMedia === true,
    layout: extra.layout || meta.layout || "",
    typedLine: extra.typedLine || meta.typedLine || ""
  });
}

function pickTemplate(venue = {}, requested = "", overlay = null) {
  const explicit = String(requested || "").trim();
  let id = resolveTemplateId(explicit);
  if (!id) id = DEFAULT_TEMPLATE_ID;
  const meta = HEADLESS_TEXT_TEMPLATES[id] || HEADLESS_TEXT_TEMPLATES[DEFAULT_TEMPLATE_ID];
  const venueIds = Array.isArray(venue.templates) ? venue.templates.map(String) : null;
  const keepExplicit = !!explicit && !!HEADLESS_TEXT_TEMPLATES[id];
  if (venueIds && venueIds.length && id !== DEFAULT_TEMPLATE_ID && !venueIds.includes(id) && !keepExplicit) {
    id = DEFAULT_TEMPLATE_ID;
  }
  const chosen = HEADLESS_TEXT_TEMPLATES[id] || meta;
  const shape = catalogShapeFor(id, overlay);
  const inputs = templateInputs.forTemplate(shape);
  return {
    composerOnly: false,
    templateId: id,
    templateName: chosen.name,
    templateClassName: chosen.className,
    priceCents: chosen.priceCents || 0,
    identityRail: chosen.identityRail !== false,
    identityAnimation: chosen.identityAnimation || "identity-loop",
    identityAnimationSeconds: chosen.identityAnimationSeconds || 6,
    allowEmoji: chosen.allowEmoji === true,
    halloweenFinale: chosen.halloweenFinale === true,
    defaultBackgroundUrl: chosen.defaultBackgroundUrl || "",
    nameOnly: chosen.nameOnly === true,
    typedLine: chosen.typedLine || "",
    jerseyNameField: chosen.jerseyNameField === true,
    requiresFacePhoto: chosen.requiresFacePhoto === true,
    supportsMedia: chosen.supportsMedia === true,
    layout: chosen.layout || "",
    patronInputs: {required: inputs.required, optional: inputs.optional},
    patronInputFamily: templateInputs.familyOf(shape),
    collectableInputCount: Number(shape.collectableInputCount) || inputs.slots.length,
    slots: inputs.slots,
    ...templateInputs.collectableFields(shape)
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

function looksLikeQuestion(raw) {
  return /\?/.test(String(raw || "")) || /^(?:what|who|where|when|why|how|can you|could you)\b/i.test(String(raw || "").trim());
}

function extractCelebrationMessage(raw) {
  const source = stripMessageWrap(raw);
  if (!source || looksLikeQuestion(source)) return "";
  if (/\b(?:throw|send|post|compose|buy|pay for)\b.{0,48}\bshout\s*out\b/i.test(source)
    && !/\b(?:happy|congrats|congratulations|we love you|love you)\b/i.test(source)) {
    return "";
  }
  if (/^\s*(?:happy(?:\s+\w+)?|congratulations?|congrats|we love you|love you|best wishes|go\s+\w+)(?:\s+.+)?$/i.test(source)
    && source.length <= 200) {
    return source;
  }
  const embedded = source.match(
    /\b((?:happy(?:\s+(?:birthday|anniversary|engagement|halloween|graduation|new year))?|congratulations?|congrats|we love you|love you)\b[^"”]{0,160})$/i
  );
  return embedded ? stripMessageWrap(embedded[1]) : "";
}

function extractBareThrowMessage(raw) {
  const source = String(raw || "");
  if (!/\b(?:throw|send|post|compose|buy|pay for)\s+(?:an?\s+)?(?:\w+\s+)?shout\s*outs?\b/i.test(source)) {
    return "";
  }
  let rest = source
    .replace(/^\s*(?:please\s+)?(?:throw|send|post|compose|buy|pay for)\s+(?:an?\s+)?(?:\w+\s+)?shout\s*outs?\b/i, "")
    .replace(/^\s*(?:at|@)\s+[A-Za-z0-9][A-Za-z0-9 .,'&-]{1,80}?(?=\s+(?:that says|saying|that reads|message|text|:)|[.?]|,|$)/i, "")
    .replace(/^\s*[,:\-–]\s*/, "")
    .replace(/\s+(?:with|include|add|put|use)\s+(?:my\s+)?(?:@?handle|floqr card|attribution)\b.*$/i, "")
    .replace(/\s+(?:text only|with a photo|with a video|with an image|no handle|skip extras)\b.*$/i, "")
    .trim();
  if (!rest || /^(please|thanks|now|tonight|today)$/i.test(rest)) return "";
  if (/^(that says|saying|that reads|message|text)\b/i.test(rest)) {
    return extractSaysMessage(`board ${rest}`);
  }
  if (extractQuotedMessage(rest)) return extractQuotedMessage(rest);
  if (extractCelebrationMessage(rest)) return extractCelebrationMessage(rest);
  if (looksLikeQuestion(rest) || rest.length > 180) return "";
  if (/\b(?:template|handle|photo|video|jersey|football intro)\b/i.test(rest)) return "";
  return stripMessageWrap(rest);
}

function extractJerseyTeam(raw) {
  const folded = ` ${normalizeClubNeedle(raw)} `;
  if (folded === "  ") return "";
  for (const needle of JERSEY_TEAM_NEEDLES) {
    if (folded.includes(` ${needle} `)) return JERSEY_TEAM_ALIASES[needle];
  }
  const idMatch = String(raw || "").match(/\b(soccer[A-Za-z0-9]+)\b/);
  return idMatch ? idMatch[1] : "";
}

function extractJerseyName(raw) {
  const match = String(raw || "").match(
    /\b(?:name(?:\s+on(?:\s+the)?(?:\s+back)?)?|player)\s*[:\-–]?\s*([A-Za-z][A-Za-z'-]{0,15})(?=\s+(?:number|num|#|\d)|[,\s]|$)/i
  );
  return match ? stripMessageWrap(match[1]).toUpperCase().slice(0, 8) : "";
}

function extractJerseyNumber(raw) {
  const labeled = String(raw || "").match(/\b(?:number|num|#)\s*[:\-–]?\s*([A-Za-z0-9*]{1,2})\b/i);
  if (labeled) return labeled[1].toUpperCase();
  const hash = String(raw || "").match(/(?:^|\s)#(\d{1,2})\b/);
  return hash ? hash[1] : "";
}

function extractPlayerName(raw) {
  const labeled = String(raw || "").match(
    /\b(?:name|handle)\s*[:\-–]?\s*(@?[A-Za-z][A-Za-z0-9._' -]{1,24})\b/i
  );
  if (labeled) return stripMessageWrap(labeled[1]);
  const at = String(raw || "").match(/(?:^|\s)(@[A-Za-z0-9._]{2,24})\b/);
  return at ? at[1] : "";
}

function isLikelyVenueOnlyTurn(raw) {
  const source = stripMessageWrap(raw);
  if (!source) return false;
  if (extractAliasClub(source) && source.length <= 80 && !extractCelebrationMessage(source)) {
    return !/\b(?:throw|send|shout)\b/i.test(source);
  }
  return false;
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
  if (/\b(?:soccer\s+jersey|jersey shoutout|jersey board)\b/.test(folded)
    || new RegExp(`\\b${verbs}(?: a)? jersey\\b`).test(folded)) {
    return "soccerJersey";
  }
  if (/\bfootball intro\b/.test(folded) || new RegExp(`\\b${verbs}(?: a)? football\\b`).test(folded)) {
    return "zebbiesFootballTeamIntro";
  }
  if (/\btengo muchos\b/.test(folded) || /\bvault (?:night|dollars)\b/.test(folded)) {
    return "heistVaultDollars";
  }
  if (/\bballer's alert\b|\bballers alert\b/.test(folded)) return "ballersAlert";
  const named = [
    ["traditional", "blackwhite"],
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

function extractStandaloneTemplate(raw) {
  const folded = normalizeClubNeedle(raw)
    .replace(/^(use|pick|choose|go with|make it|i want|please)\s+/, "")
    .replace(/\s+(please|thanks|template|board|shoutout|shout out)$/, "")
    .trim();
  if (!folded) return "";
  if (HEADLESS_TEXT_TEMPLATES[folded]) return folded;
  return TEMPLATE_ALIASES[folded] || "";
}

function parseHandleHint(raw) {
  const source = String(raw || "");
  if (/\b(?:no|skip|without|don't include|do not include|dont include)\s+(?:my\s+)?(?:@?handle|attribution|floqr card)\b/i.test(source)) {
    return {decision: "skip", attribution: ""};
  }
  const named = source.match(/\b(?:from|as)\s+@([A-Za-z0-9._]{2,40})\b/);
  if (named) return {decision: "include", attribution: `@${named[1]}`};
  const atOnly = source.match(/(?:^|\s)@([A-Za-z0-9._]{2,40})\b/);
  if (atOnly && !/\b(?:at|@)\s+[A-Za-z]/.test(source.slice(0, 12))) {
    return {decision: "include", attribution: `@${atOnly[1]}`};
  }
  if (/\b(?:with|include|add|put|use)\s+(?:my\s+)?(?:@?handle|floqr card|attribution)\b|\binclude (?:my )?@handle\b|\bwith my handle\b/i.test(source)) {
    return {decision: "include", attribution: ""};
  }
  return {decision: "", attribution: ""};
}

function parseMediaHint(raw) {
  const source = String(raw || "");
  const https = source.match(/\bhttps:\/\/[^\s<>"']+/i);
  if (https) {
    return {decision: "url", mediaUrl: https[0].replace(/[),.;]+$/, "")};
  }
  if (/\b(?:text only|no photo|no video|skip (?:the )?(?:photo|image|video|media)|without (?:a )?(?:photo|image|video|picture))\b/i.test(source)) {
    return {decision: "none", mediaUrl: ""};
  }
  if (/\b(?:with|add|include)\s+(?:a\s+)?(?:photo|image|video|picture)\b|\b(?:photo|video|picture) board\b|\bopen compose\b/i.test(source)) {
    return {decision: "compose", mediaUrl: ""};
  }
  return {decision: "", mediaUrl: ""};
}

function isConfirmSubmitPrompt(raw) {
  return /\b(?:throw it|send it|submit(?: it)?|go ahead|that's all|thats all|just throw(?: it)?|confirm(?: throw)?|yes throw|do it)\b/i.test(String(raw || ""));
}

function isSkipExtrasPrompt(raw) {
  return /\b(?:skip(?: the)? extras?|defaults? (?:are )?fine|traditional is fine|just the message|no extras)\b/i.test(String(raw || ""));
}

function isCancelShoutOutPrompt(raw) {
  return /\b(?:cancel(?: the)? shoutout|never mind|nevermind|stop (?:the )?shoutout|forget (?:the |this )?shoutout)\b/i.test(String(raw || ""));
}

function isBareAffirmative(raw) {
  return /^(yes|yeah|yep|yup|ok|okay|sure)[.!?]*$/i.test(String(raw || "").trim());
}

function isBareNegative(raw) {
  return /^(no|nope|nah|skip)[.!?]*$/i.test(String(raw || "").trim());
}

function isControlReply(raw) {
  return isBareAffirmative(raw)
    || isBareNegative(raw)
    || isConfirmSubmitPrompt(raw)
    || isCancelShoutOutPrompt(raw);
}

function bareSlotText(raw, max) {
  return stripMessageWrap(raw).slice(0, max);
}

/** Map a follow-up (yes/no or the asked collectableInput) onto the current step. Never mint on “yes”. */
function applyBareInteractiveReply(draft, parsed, raw, templateRow) {
  const next = parsed && typeof parsed === "object" ? parsed : {};
  if (!draft) return next;
  const step = interactiveNeeds(draft, templateRow)[0] || "";
  if (isBareAffirmative(raw)) {
    if (step === "handle") next.handleDecision = next.handleDecision || "include";
    else if (step === "media") next.mediaDecision = next.mediaDecision || "none";
    else if (step === "teamPhotos" || step === "facePhoto" || step === "compose") {
      next.mediaDecision = next.mediaDecision || "compose";
    }
    else if (!step) next.confirmSubmit = false;
    return next;
  }
  if (isBareNegative(raw)) {
    if (step === "handle") next.handleDecision = next.handleDecision || "skip";
    else if (step === "media") next.mediaDecision = next.mediaDecision || "none";
    else if (!step) next.cancel = true;
    return next;
  }
  if (!step || isControlReply(raw)) return next;
  const text = String(raw || "").trim();
  if (!text) return next;
  if (step === "club" && !next.clubQuery) {
    next.clubQuery = extractAliasClub(text) || extractAtClub(text)
      || (!extractCelebrationMessage(text) && text.length <= 80 ? text : "");
  } else if (step === "message" && !next.message) {
    next.message = extractCelebrationMessage(text) || extractQuotedMessage(text) || bareSlotText(text, 400);
  } else if (step === "jerseyTeamId" && !next.jerseyTeamId) {
    next.jerseyTeamId = extractJerseyTeam(text) || text;
  } else if (step === "jerseyName" && !next.jerseyName) {
    next.jerseyName = extractJerseyName(text) || bareSlotText(text, 16).toUpperCase();
  } else if (step === "jerseyNumber" && !next.jerseyNumber) {
    const labeled = extractJerseyNumber(text);
    const bare = /^[A-Za-z0-9*]{1,2}$/.test(text) ? text.toUpperCase() : "";
    next.jerseyNumber = labeled || bare;
  } else if (step === "playerName" && !next.playerName) {
    next.playerName = extractPlayerName(text) || bareSlotText(text, 40);
  } else if (step === "company" && !next.company) {
    next.company = bareSlotText(text, 18).toUpperCase();
  }
  return next;
}

function parseShoutOutExtras(raw) {
  const source = String(raw || "").trim();
  const handle = parseHandleHint(source);
  const media = parseMediaHint(source);
  return {
    templateId: extractTemplateHint(source) || extractStandaloneTemplate(source),
    screenFormatId: extractScreenHint(source),
    handleDecision: handle.decision,
    attribution: handle.attribution,
    mediaDecision: media.decision,
    mediaUrl: media.mediaUrl,
    confirmSubmit: isConfirmSubmitPrompt(source),
    skipExtras: isSkipExtrasPrompt(source),
    cancel: isCancelShoutOutPrompt(source)
  };
}

function stripExtrasFromMessage(raw) {
  return stripMessageWrap(String(raw || "")
    .replace(/\s+(?:with|include|add|put|use)\s+(?:my\s+)?(?:@?handle|floqr card|attribution)\b.*$/i, "")
    .replace(/\s+(?:text only|with a photo|with a video|with an image|no handle|skip extras)\b.*$/i, ""));
}

function parseShoutOutExecute(raw) {
  const source = String(raw || "").trim();
  const extras = parseShoutOutExtras(source);
  const jerseyTeamId = extractJerseyTeam(source);
  const jerseyName = extractJerseyName(source);
  const jerseyNumber = extractJerseyNumber(source);
  const playerName = extractPlayerName(source);
  const message = stripExtrasFromMessage(
    extractQuotedMessage(source)
    || extractSaysMessage(source)
    || extractColonMessage(source)
    || extractCelebrationMessage(source)
    || extractBareThrowMessage(source)
  );
  const prefix = venuePrefix(source, message);
  const atPhrase = extractAtClub(prefix);
  const atClub = extractAliasClub(atPhrase) || atPhrase;
  const aliasClub = extractAliasClub(prefix) || extractAliasClub(source);
  const jerseyHint = extractTemplateHint(prefix) === "soccerJersey"
    || extras.templateId === "soccerJersey"
    || /\b(?:jersey|kit)\b/i.test(source);
  const templateId = extractTemplateHint(prefix) || extras.templateId
    || (jerseyHint && (jerseyTeamId || jerseyName || jerseyNumber) ? "soccerJersey" : "");
  return {
    clubQuery: atClub || aliasClub,
    message,
    templateId,
    screenFormatId: extractScreenHint(prefix) || extras.screenFormatId,
    handleDecision: extras.handleDecision,
    attribution: extras.attribution,
    mediaDecision: extras.mediaDecision,
    mediaUrl: extras.mediaUrl,
    jerseyTeamId,
    jerseyName,
    jerseyNumber,
    playerName: playerName || (templateId === "heistVaultDollars" || templateId === "ballersAlert" ? message : ""),
    confirmSubmit: extras.confirmSubmit,
    skipExtras: extras.skipExtras,
    cancel: extras.cancel
  };
}

function userTurns(turns) {
  return (Array.isArray(turns) ? turns : [])
    .filter(row => row && (row.role === "user" || row.role === "patron"))
    .map(row => String(row.text || row.content || row.prompt || "").trim())
    .filter(Boolean);
}

function fillFromConversation(turns, currentPrompt) {
  const texts = userTurns(turns);
  const current = String(currentPrompt || "").trim();
  if (current) texts.push(current);
  const filled = {
    clubQuery: "",
    message: "",
    templateId: "",
    screenFormatId: "",
    handleDecision: "",
    attribution: "",
    mediaDecision: "",
    mediaUrl: "",
    jerseyTeamId: "",
    jerseyName: "",
    jerseyNumber: "",
    playerName: "",
    confirmSubmit: false,
    skipExtras: false,
    cancel: false
  };
  texts.forEach(text => {
    const parsed = parseShoutOutExecute(text);
    if (parsed.clubQuery) filled.clubQuery = parsed.clubQuery;
    else if (isLikelyVenueOnlyTurn(text) && extractAliasClub(text)) {
      filled.clubQuery = extractAliasClub(text);
    }
    if (parsed.message) filled.message = parsed.message;
    else if (extractCelebrationMessage(text)) filled.message = extractCelebrationMessage(text);
    if (parsed.templateId) filled.templateId = parsed.templateId;
    if (parsed.screenFormatId) filled.screenFormatId = parsed.screenFormatId;
    if (parsed.handleDecision) filled.handleDecision = parsed.handleDecision;
    if (parsed.attribution) filled.attribution = parsed.attribution;
    if (parsed.mediaDecision) filled.mediaDecision = parsed.mediaDecision;
    if (parsed.mediaUrl) filled.mediaUrl = parsed.mediaUrl;
    const jerseyTurn = parsed.templateId === "soccerJersey" || filled.templateId === "soccerJersey";
    if (parsed.jerseyTeamId && jerseyTurn) filled.jerseyTeamId = parsed.jerseyTeamId;
    if (parsed.jerseyName && jerseyTurn) filled.jerseyName = parsed.jerseyName;
    if (parsed.jerseyNumber && jerseyTurn) filled.jerseyNumber = parsed.jerseyNumber;
    if (parsed.playerName) filled.playerName = parsed.playerName;
    if (parsed.confirmSubmit) filled.confirmSubmit = true;
    if (parsed.skipExtras) filled.skipExtras = true;
    if (parsed.cancel) filled.cancel = true;
  });
  if (current) {
    const latest = parseShoutOutExecute(current);
    filled.confirmSubmit = latest.confirmSubmit === true;
    filled.skipExtras = latest.skipExtras === true;
    filled.cancel = latest.cancel === true;
    if (latest.handleDecision) filled.handleDecision = latest.handleDecision;
    if (latest.mediaDecision) filled.mediaDecision = latest.mediaDecision;
    if (latest.templateId) filled.templateId = latest.templateId;
  }
  return filled;
}

function emptyInteractiveDraft() {
  return {
    active: true,
    clubQuery: "",
    message: "",
    templateId: "",
    templateChosen: false,
    screenFormatId: "",
    handleDecision: "",
    attribution: "",
    mediaDecision: "",
    mediaUrl: "",
    jerseyTeamId: "",
    jerseyName: "",
    jerseyNumber: "",
    playerName: "",
    company: "",
    facePhotoUrl: "",
    skipExtras: false
  };
}

function clipInteractiveDraft(draft = {}) {
  const row = draft && typeof draft === "object" ? draft : {};
  const templateId = resolveTemplateId(row.templateId) || "";
  const mediaUrl = /^https:\/\//i.test(String(row.mediaUrl || "")) ? text(row.mediaUrl, 500) : "";
  const facePhotoUrl = /^https:\/\//i.test(String(row.facePhotoUrl || "")) ? text(row.facePhotoUrl, 500) : "";
  const handleDecision = row.handleDecision === "include" || row.handleDecision === "skip" ? row.handleDecision : "";
  let mediaDecision = "";
  if (row.mediaDecision === "none" || row.mediaDecision === "compose") mediaDecision = row.mediaDecision;
  else if (mediaUrl || facePhotoUrl) mediaDecision = "url";
  return {
    active: row.active !== false,
    clubQuery: text(row.clubQuery || row.clubLocationId, 120),
    message: text(row.message || row.mainText, 400),
    templateId,
    templateChosen: row.templateChosen === true || !!templateId,
    screenFormatId: canonicalFormatId(row.screenFormatId),
    handleDecision,
    attribution: text(row.attribution, 80),
    mediaDecision,
    mediaUrl,
    jerseyTeamId: text(row.jerseyTeamId, 80),
    jerseyName: text(row.jerseyName || row.jerseyPatronName, 16).toUpperCase(),
    jerseyNumber: text(row.jerseyNumber, 4).toUpperCase().slice(0, 2),
    playerName: text(row.playerName, 40),
    company: text(row.company, 18).toUpperCase(),
    facePhotoUrl: facePhotoUrl || mediaUrl,
    skipExtras: row.skipExtras === true
  };
}

function mergeInteractiveDraft(previous, parsed = {}, extras = {}) {
  const club = text(parsed.clubQuery || extras.clubQuery, 120);
  const message = text(parsed.message || extras.message, 400);
  const currentHasBoth = extras.freshThrow === true
    || (extras.freshThrow !== false && !!(text(parsed.clubQuery, 120) && text(parsed.message, 400)));
  const base = currentHasBoth ? emptyInteractiveDraft() : clipInteractiveDraft(previous);
  const next = {...base, active: true};
  if (club) next.clubQuery = club;
  if (message) next.message = message;
  const templateId = resolveTemplateId(parsed.templateId || extras.templateId || "") || "";
  if (templateId) {
    next.templateId = templateId;
    next.templateChosen = true;
  }
  const screen = canonicalFormatId(parsed.screenFormatId || extras.screenFormatId);
  if (screen) next.screenFormatId = screen;
  const handleDecision = parsed.handleDecision || extras.handleDecision || "";
  if (handleDecision === "include" || handleDecision === "skip") next.handleDecision = handleDecision;
  const attribution = text(parsed.attribution || extras.attribution, 80);
  if (attribution) next.attribution = attribution;
  const mediaDecision = parsed.mediaDecision || extras.mediaDecision || "";
  if (mediaDecision === "none" || mediaDecision === "compose" || mediaDecision === "url") {
    next.mediaDecision = mediaDecision;
  }
  const mediaUrl = /^https:\/\//i.test(String(parsed.mediaUrl || extras.mediaUrl || ""))
    ? text(parsed.mediaUrl || extras.mediaUrl, 500)
    : "";
  if (mediaUrl) {
    next.mediaUrl = mediaUrl;
    next.mediaDecision = "url";
  }
  const jerseyTeamId = text(parsed.jerseyTeamId || extras.jerseyTeamId, 80);
  if (jerseyTeamId) next.jerseyTeamId = jerseyTeamId;
  const jerseyName = text(parsed.jerseyName || extras.jerseyName, 16);
  if (jerseyName) next.jerseyName = jerseyName;
  const jerseyNumber = text(parsed.jerseyNumber || extras.jerseyNumber, 4);
  if (jerseyNumber) next.jerseyNumber = jerseyNumber;
  const playerName = text(parsed.playerName || extras.playerName, 40);
  if (playerName) next.playerName = playerName;
  const company = text(parsed.company || extras.company, 18);
  if (company) next.company = company;
  const facePhotoUrl = /^https:\/\//i.test(String(parsed.facePhotoUrl || extras.facePhotoUrl || ""))
    ? text(parsed.facePhotoUrl || extras.facePhotoUrl, 500)
    : "";
  if (facePhotoUrl) next.facePhotoUrl = facePhotoUrl;
  if (parsed.skipExtras === true || extras.skipExtras === true) next.skipExtras = true;
  return clipInteractiveDraft(next);
}

function isVipLikePrompt(raw) {
  return /\b(?:book|hold|reserv)\b/i.test(String(raw || ""))
    && /\b(?:table|vip|section|mezzanine)\b/i.test(String(raw || ""));
}

function isInteractiveFollowUp(raw, draft) {
  const row = clipInteractiveDraft(draft);
  if (!row.active && !row.clubQuery && !row.message && !row.jerseyName && !row.playerName) return false;
  if (isVipLikePrompt(raw)) return false;
  if (/\b(?:how|help|what is|instructions?|explain)\b/i.test(String(raw || "")) && !extractCelebrationMessage(raw)) {
    return false;
  }
  const extras = parseShoutOutExtras(raw);
  if (extras.cancel || extras.confirmSubmit || extras.skipExtras) return true;
  if (extras.templateId || extras.handleDecision || extras.mediaDecision || extras.screenFormatId) return true;
  if (isBareAffirmative(raw) || isBareNegative(raw)) return true;
  if (extractAliasClub(raw) || extractJerseyTeam(raw) || extractJerseyName(raw) || extractJerseyNumber(raw)) return true;
  if (extractCelebrationMessage(raw) || extractQuotedMessage(raw) || extractPlayerName(raw)) return true;
  const needs = interactiveNeeds(row);
  if (needs[0] && String(raw || "").trim()) return true;
  return false;
}

function inputsForDraft(draft, templateRow) {
  const row = clipInteractiveDraft(draft);
  const overlay = templateRow && typeof templateRow === "object" ? templateRow : null;
  const templateId = text(overlay && (overlay.id || overlay.templateId), 80)
    || row.templateId
    || DEFAULT_TEMPLATE_ID;
  const shape = overlay && templateInputs.hasNumberedSlots(overlay)
    ? templateInputs.stampTemplate({...overlay, id: overlay.id || templateId})
    : catalogShapeFor(templateId, overlay);
  return templateInputs.forTemplate(shape);
}

function fieldFilled(row, fieldId) {
  switch (String(fieldId || "")) {
    case "club": return !!row.clubQuery;
    case "message": return !!row.message;
    case "handle":
      return !!row.handleDecision && (row.handleDecision !== "include" || !!row.attribution);
    case "media": return !!row.mediaDecision || !!row.mediaUrl;
    case "jerseyTeamId": return !!row.jerseyTeamId;
    case "jerseyName": return !!row.jerseyName;
    case "jerseyNumber": return !!row.jerseyNumber;
    case "playerName": return !!(row.playerName || row.message);
    case "facePhoto": return !!(row.facePhotoUrl || row.mediaUrl);
    case "teamPhotos": return false;
    case "company": return !!row.company;
    case "compose": return false;
    default: return true;
  }
}

function interactiveNeeds(draft, templateRow) {
  const row = clipInteractiveDraft(draft);
  const inputs = inputsForDraft(row, templateRow);
  const slots = Array.isArray(inputs.slots) ? inputs.slots : [];
  const needs = [];
  slots.forEach(slot => {
    if (Number(slot.required) === 1 && !fieldFilled(row, slot.fieldId)) needs.push(slot.fieldId);
  });
  if (row.mediaDecision === "compose" && !needs.includes("compose")) needs.push("compose");
  if (row.skipExtras) {
    const requiredIds = slots.filter(slot => Number(slot.required) === 1).map(slot => slot.fieldId);
    return needs.filter(id => requiredIds.includes(id) || id === "compose");
  }
  return needs;
}

function listHeadlessTemplates() {
  return Object.keys(HEADLESS_TEXT_TEMPLATES).map(id => {
    const meta = HEADLESS_TEXT_TEMPLATES[id];
    return {
      id,
      name: meta.name,
      priceCents: meta.priceCents || 0,
      className: meta.className
    };
  });
}

function formatHandle(value) {
  const raw = text(value, 80).replace(/^@+/, "");
  return raw ? `@${raw}` : "";
}

function isComposerOnlyTemplate(templateId = "", templateRow) {
  const id = resolveTemplateId(templateId) || String(templateId || "").trim();
  const shape = templateRow && templateInputs.hasNumberedSlots(templateRow)
    ? templateRow
    : catalogShapeFor(id);
  const slots = templateInputs.slotsFromTemplate(shape);
  return slots.some(slot => (
    Number(slot.required) === 1
    && (slot.fieldId === "facePhoto" || slot.fieldId === "teamPhotos" || slot.fieldId === "media")
  ));
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
  userPrompt,
  includeAttribution,
  attribution,
  attributionChoice,
  mediaUrl,
  mediaType,
  jerseyTeamId,
  jerseyName,
  jerseyNumber,
  playerName,
  facePhotoUrl,
  templateRow
} = {}) {
  const parsed = parseShoutOutExecute(userPrompt || "");
  const club = text(clubLocationId || parsed.clubQuery, 120);
  const main = text(message || parsed.message || playerName || parsed.playerName, 400);
  const requestedTemplate = text(templateId || parsed.templateId, 80);
  const requestedScreen = canonicalFormatId(screenFormatId || parsed.screenFormatId);
  const wantHandle = includeAttribution === true || includeAttribution === 1 || includeAttribution === "1"
    || parsed.handleDecision === "include";
  const skipHandle = includeAttribution === false || parsed.handleDecision === "skip";
  const handleText = formatHandle(attribution || parsed.attribution);
  const picked = pickTemplate(venue, requestedTemplate, templateRow);
  const jerseyTeam = text(jerseyTeamId || parsed.jerseyTeamId, 80);
  const jerseyPatronName = text(jerseyName || parsed.jerseyName, 16).toUpperCase();
  const jerseyMark = text(jerseyNumber || parsed.jerseyNumber, 4).toUpperCase().slice(0, 2);
  const nameOnBoard = text(playerName || parsed.playerName || (picked.nameOnly ? main : ""), 40);
  const pickedPhoto = text(facePhotoUrl || mediaUrl || parsed.mediaUrl, 500);
  const draftForNeeds = clipInteractiveDraft({
    clubQuery: club,
    message: main,
    templateId: picked.templateId,
    templateChosen: true,
    screenFormatId: requestedScreen,
    handleDecision: skipHandle ? "skip" : (wantHandle ? "include" : ""),
    attribution: handleText,
    mediaUrl: pickedPhoto,
    jerseyTeamId: jerseyTeam,
    jerseyName: jerseyPatronName,
    jerseyNumber: jerseyMark,
    playerName: nameOnBoard,
    facePhotoUrl: pickedPhoto
  });
  const missing = interactiveNeeds({
    ...draftForNeeds,
    skipExtras: true
  }, templateRow || picked);
  if (missing.length) {
    const photoNeed = missing.includes("facePhoto") || missing.includes("teamPhotos") || missing.includes("media");
    return {
      ok: false,
      missing,
      composerOnly: photoNeed,
      templateId: picked.templateId,
      reason: missingAsk(missing),
      parsed,
      composeHref: shoutOutComposeHref(club)
    };
  }
  const screen = pickScreenFormat(venue, requestedScreen);
  const caps = textCaps(picked.templateId, screen);
  const locationName = text(venue.locationName || venue.brandName || venue.displayName || club, 160);
  const brandName = text(venue.brandName || venue.locationName || "", 160);
  const fullAddress = text(
    venue.fullAddress || venue.locationAddress || venue.formattedAddress || venue.address || "",
    240
  );
  const streetAddress = text(venue.streetAddress || venue.addressLine1 || "", 160);
  const boardCopy = picked.nameOnly ? (nameOnBoard || main) : (jerseyPatronName && picked.jerseyNameField ? jerseyPatronName : main);
  const mainText = fitMainText(boardCopy, caps);
  const attributionText = wantHandle && !skipHandle ? handleText : "";
  const includeHandle = wantHandle && !skipHandle && !!attributionText;
  const httpsMedia = /^https:\/\//i.test(String(mediaUrl || parsed.mediaUrl || ""))
    ? text(mediaUrl || parsed.mediaUrl, 500)
    : "";
  const mediaKind = httpsMedia
    ? (String(mediaType || "").toLowerCase() === "video" ? "video" : "image")
    : "";
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
      country: text(venue.country, 80),
      region: text(venue.region || venue.state || venue.province, 80),
      city: text(venue.city, 80),
      streetAddress,
      postalCode: text(venue.postalCode || venue.zip, 24),
      fullAddress,
      locationAddress: fullAddress,
      locationLabel: text(venue.locationLabel, 160),
      template: picked.templateId,
      templateId: picked.templateId,
      templateName: picked.templateName,
      templateClassName: picked.templateClassName,
      templateSupportsMedia: !!httpsMedia,
      screenFormatId: screen,
      screenFormatLabel: SCREEN_LABELS[screen] || screen,
      textLayoutVersion: TEXT_LAYOUT_VERSION,
      textProfileId: caps.profileId,
      maxMainCharacters: caps.main,
      maxSubCharacters: caps.sub,
      lineCount: caps.lineCount,
      maxCharactersPerLine: caps.perLine,
      minimumFontPixels: caps.minimumFontPixels || 0,
      mainTextSizePercent: caps.mainTextSizePercent || 20.8,
      subTextSizePercent: caps.subTextSizePercent || 7.8,
      identityRail: picked.identityRail !== false,
      identityAnimation: picked.identityAnimation || "identity-loop",
      identityAnimationSeconds: picked.identityAnimationSeconds || 6,
      includeAttribution: includeHandle,
      attribution: attributionText,
      attributionChoice: includeHandle ? text(attributionChoice || "displayName", 40) : "none",
      mediaUrl: httpsMedia,
      mediaType: mediaKind,
      allowEmoji: picked.allowEmoji === true,
      halloweenFinale: picked.halloweenFinale === true,
      backgroundUrl: picked.defaultBackgroundUrl || "",
      defaultBackgroundUrl: picked.defaultBackgroundUrl || "",
      mainText,
      subText: jerseyMark,
      jerseyTeamId: jerseyTeam,
      jerseyPatronName,
      jerseyName: jerseyPatronName,
      jerseyNumber: jerseyMark,
      playerName: nameOnBoard,
      typedLine: picked.typedLine || "",
      nameOnly: picked.nameOnly === true,
      priceCents: picked.priceCents || 0,
      headless: true,
      source: "headless"
    }
  };
}

function missingAsk(needs = [], templateRow) {
  const first = String((Array.isArray(needs) ? needs : [])[0] || "");
  if (!first) return "ShoutOut SMARTpreview is ready. Reply throw it to send, or cancel the shoutout.";
  return templateInputs.fieldAsk(first, templateRow);
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
  TEXT_LAYOUT_VERSION,
  LED_FORMATS,
  SCREEN_LABELS,
  HEADLESS_TEXT_TEMPLATES,
  TEMPLATE_ALIASES,
  CLUB_NAME_ALIASES,
  catalogShapeFor,
  resolveTemplateId,
  parseShoutOutExecute,
  parseShoutOutExtras,
  parseHandleHint,
  parseMediaHint,
  extractStandaloneTemplate,
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
  venueSupportsFormat,
  emptyInteractiveDraft,
  clipInteractiveDraft,
  mergeInteractiveDraft,
  isInteractiveFollowUp,
  interactiveNeeds,
  inputsForDraft,
  fillFromConversation,
  extractCelebrationMessage,
  extractJerseyTeam,
  listHeadlessTemplates,
  formatHandle,
  isConfirmSubmitPrompt,
  isSkipExtrasPrompt,
  isCancelShoutOutPrompt,
  isBareAffirmative,
  isBareNegative,
  applyBareInteractiveReply
};
