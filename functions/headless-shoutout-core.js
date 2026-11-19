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

/** Catalog className / name must match shared-data.js or Preview + LED skip classic-bw. */
const HEADLESS_TEXT_TEMPLATES = Object.freeze({
  blackwhite: {
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
  }
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
    priceCents: chosen.priceCents || 0,
    identityRail: chosen.identityRail !== false,
    identityAnimation: chosen.identityAnimation || "identity-loop",
    identityAnimationSeconds: chosen.identityAnimationSeconds || 6,
    allowEmoji: chosen.allowEmoji === true,
    halloweenFinale: chosen.halloweenFinale === true,
    defaultBackgroundUrl: chosen.defaultBackgroundUrl || ""
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

/** Map a bare yes/no onto the current SMARTpreview step. Never mint on “yes” while extras remain. */
function applyBareInteractiveReply(draft, parsed, raw) {
  const next = parsed && typeof parsed === "object" ? parsed : {};
  if (!draft) return next;
  const step = interactiveNeeds(draft)[0] || "";
  if (isBareAffirmative(raw)) {
    if (step === "handle") next.handleDecision = next.handleDecision || "include";
    else if (step === "media") next.mediaDecision = next.mediaDecision || "none";
    else if (step === "template") next.templateId = next.templateId || DEFAULT_TEMPLATE_ID;
    else if (!step) next.confirmSubmit = true;
  } else if (isBareNegative(raw)) {
    if (step === "handle") next.handleDecision = next.handleDecision || "skip";
    else if (step === "media") next.mediaDecision = next.mediaDecision || "none";
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
  const message = stripExtrasFromMessage(
    extractQuotedMessage(source) || extractSaysMessage(source) || extractColonMessage(source)
  );
  const prefix = venuePrefix(source, message);
  const atPhrase = extractAtClub(prefix);
  const atClub = extractAliasClub(atPhrase) || atPhrase;
  const aliasClub = extractAliasClub(prefix);
  return {
    clubQuery: atClub || aliasClub,
    message,
    templateId: extractTemplateHint(prefix) || extras.templateId,
    screenFormatId: extractScreenHint(prefix) || extras.screenFormatId,
    handleDecision: extras.handleDecision,
    attribution: extras.attribution,
    mediaDecision: extras.mediaDecision,
    mediaUrl: extras.mediaUrl,
    confirmSubmit: extras.confirmSubmit,
    skipExtras: extras.skipExtras,
    cancel: extras.cancel
  };
}

function emptyInteractiveDraft() {
  return {
    clubQuery: "",
    message: "",
    templateId: "",
    templateChosen: false,
    screenFormatId: "",
    handleDecision: "",
    attribution: "",
    mediaDecision: "",
    mediaUrl: "",
    skipExtras: false
  };
}

function clipInteractiveDraft(draft = {}) {
  const row = draft && typeof draft === "object" ? draft : {};
  const templateId = resolveTemplateId(row.templateId) || "";
  const mediaUrl = /^https:\/\//i.test(String(row.mediaUrl || "")) ? text(row.mediaUrl, 500) : "";
  const handleDecision = row.handleDecision === "include" || row.handleDecision === "skip" ? row.handleDecision : "";
  let mediaDecision = "";
  if (row.mediaDecision === "none" || row.mediaDecision === "compose") mediaDecision = row.mediaDecision;
  else if (mediaUrl) mediaDecision = "url";
  return {
    clubQuery: text(row.clubQuery || row.clubLocationId, 120),
    message: text(row.message || row.mainText, 400),
    templateId,
    templateChosen: row.templateChosen === true || !!templateId,
    screenFormatId: canonicalFormatId(row.screenFormatId),
    handleDecision,
    attribution: text(row.attribution, 80),
    mediaDecision,
    mediaUrl,
    skipExtras: row.skipExtras === true
  };
}

function mergeInteractiveDraft(previous, parsed = {}, extras = {}) {
  const club = text(parsed.clubQuery || extras.clubQuery, 120);
  const message = text(parsed.message || extras.message, 400);
  const freshThrow = !!(club && message);
  const base = freshThrow ? emptyInteractiveDraft() : clipInteractiveDraft(previous);
  const next = {...base};
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
  if (parsed.skipExtras === true || extras.skipExtras === true) next.skipExtras = true;
  return clipInteractiveDraft(next);
}

function isInteractiveFollowUp(raw, draft) {
  const row = clipInteractiveDraft(draft);
  if (!row.clubQuery || !row.message) return false;
  const extras = parseShoutOutExtras(raw);
  if (extras.cancel || extras.confirmSubmit || extras.skipExtras) return true;
  if (extras.templateId || extras.handleDecision || extras.mediaDecision || extras.screenFormatId) return true;
  if (isBareAffirmative(raw) || isBareNegative(raw)) return true;
  return false;
}

function interactiveNeeds(draft) {
  const row = clipInteractiveDraft(draft);
  const needs = [];
  if (!row.clubQuery) needs.push("club");
  if (!row.message) needs.push("message");
  if (row.mediaDecision === "compose") needs.push("compose");
  if (row.skipExtras) return needs;
  if (!row.templateChosen) needs.push("template");
  if (!row.handleDecision || (row.handleDecision === "include" && !row.attribution)) needs.push("handle");
  if (!row.mediaDecision) needs.push("media");
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
  mediaType
} = {}) {
  const parsed = parseShoutOutExecute(userPrompt || "");
  const club = text(clubLocationId || parsed.clubQuery, 120);
  const main = text(message || parsed.message, 400);
  const requestedTemplate = text(templateId || parsed.templateId, 80);
  const requestedScreen = canonicalFormatId(screenFormatId || parsed.screenFormatId);
  const wantHandle = includeAttribution === true || includeAttribution === 1 || includeAttribution === "1"
    || parsed.handleDecision === "include";
  const skipHandle = includeAttribution === false || parsed.handleDecision === "skip";
  const handleText = formatHandle(attribution || parsed.attribution);
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
  const fullAddress = text(
    venue.fullAddress || venue.locationAddress || venue.formattedAddress || venue.address || "",
    240
  );
  const streetAddress = text(venue.streetAddress || venue.addressLine1 || "", 160);
  const mainText = fitMainText(main, caps);
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
      subText: "",
      priceCents: picked.priceCents || 0,
      headless: true,
      source: "headless"
    }
  };
}

function missingAsk(needs = []) {
  const set = new Set(needs);
  if (set.has("compose")) {
    return "That board needs a photo or video on compose. Open ShoutOut compose to finish it, or reply text only to stay on a letter board.";
  }
  if (set.has("club") && set.has("message")) {
    return "I can throw the ShoutOut from chat once I have the club and the message. Which venue, and what should it say?";
  }
  if (set.has("club")) return "Which venue should this ShoutOut play on?";
  if (set.has("message")) return "What should the ShoutOut say on the board?";
  const extras = [];
  if (set.has("template")) extras.push("a template (Traditional is the default; Neon, Birthday, Gold, VIP, Graduation, Corporate, or Halloween $15)");
  if (set.has("handle")) extras.push("whether to include your @handle on the FloqR card");
  if (set.has("media")) extras.push("text only, or a photo/video via compose");
  if (extras.length) {
    return `A few ShoutOut details still open: ${extras.join("; ")}. Reply in chat, or say throw it to use Traditional with no handle.`;
  }
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
  TEXT_LAYOUT_VERSION,
  LED_FORMATS,
  SCREEN_LABELS,
  HEADLESS_TEXT_TEMPLATES,
  TEMPLATE_ALIASES,
  CLUB_NAME_ALIASES,
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
  listHeadlessTemplates,
  formatHandle,
  isConfirmSubmitPrompt,
  isSkipExtrasPrompt,
  isCancelShoutOutPrompt,
  isBareAffirmative,
  isBareNegative,
  applyBareInteractiveReply
};
