/* BOT DEE session core — tool defs, classification-gated contextualSearch, Gemini message shaping.
   Product tools (VIP / ShoutOut / FloqCAST / checkout) re-validate role via bot-dee-tools.js. */
"use strict";

const {Type} = require("@google/genai");
const classification = require("./data-classification-core");
const FLOQAI_CONTENT = require("./floqai-content-classes.json");
const SEARCH_CATALOG = require("./bot-dee-search-catalog.json");

const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 2000;
const MAX_RESULTS = 8;
const MAX_TOOL_ROUNDS = 4;
const TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";

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
      "Search FLOQR help topics and product intents the signed-in viewer may access. Use only for how-to / product questions with a clear intent. Never call for greetings or small talk (hi, hey, thanks). Returns classification-filtered results only.",
    parameters: obj({query: str("Plain-language search query from the patron.")}, ["query"])
  },
  {
    name: "listShoutOutTemplates",
    description: "List ShoutOut templates available at a club (or return compose link). Re-validates shoutOut access.",
    parameters: obj({
      clubLocationId: str("Club location id when known."),
      locationId: str("Alias for clubLocationId.")
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

/** Greetings / small talk — reply as a chatbot, never dump search hits. */
function isChitchatPrompt(raw) {
  const q = normalize(raw);
  if (!q || q.length > 80) return false;
  return /^(hey|hi|hello|howdy|yo|sup|hiya|hola|thanks|thank you|thx|ty|ok|okay|cool|nice|great|bye|goodbye|see ya|see you|good morning|good afternoon|good evening|good night|how are you|what s up|whats up)( bot dee| floqai| there| again)?$/.test(q);
}

function chitchatReply(role) {
  const roleHint = role && role !== "anonymous" && role !== "patron"
    ? ` I can see you as ${role}.`
    : "";
  return `Hey — good to see you.${roleHint} What do you want to do in FLOQR? ShoutOut, VIP table, floqCast, scheduling, or something else — just say it in plain words.`;
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

function contextualSearch(query, viewerRole) {
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
  const {allowed, denied} = classification.filterContent(candidates, FLOQAI_CONTENT, {role});
  const allowedSet = new Set(allowed);
  const results = strong
    .filter(row => allowedSet.has(row.entry.sourceId))
    .slice(0, MAX_RESULTS)
    .map(row => ({
      sourceId: row.entry.sourceId,
      id: row.entry.id,
      kind: row.entry.kind,
      label: row.entry.label,
      blurb: row.entry.blurb,
      href: row.entry.href,
      score: row.points
    }));
  return {
    ok: true,
    query: sanitizeUserPrompt(query),
    role,
    results,
    deniedCount: denied.length,
    tool: "contextualSearch"
  };
}

async function runTool(name, args, session) {
  if (name === "contextualSearch") {
    return contextualSearch(args?.query || session?.lastUserPrompt || "", session.role);
  }
  const tools = require("./bot-dee-tools");
  if (!session?.request) {
    return {ok: false, error: "Session request missing for product tool."};
  }
  return tools.runProductTool(name, args, session.request);
}

function toolDeclarations() {
  return TOOL_DEFS;
}

function systemInstruction(role) {
  return [
    "You are BOT DEE, FLOQR's in-app chatbot on the FloqAi page. Talk like a helpful person, not a search engine.",
    "Greetings and small talk (hi, hey, thanks, how are you): reply in 1–2 short sentences, ask what they want to do, and do NOT call any tools.",
    "Answer briefly. Prefer tool results and real checkoutUrl / passHref / previewPath / holdId values.",
    "Use contextualSearch only for clear how-to / product questions. For booking/pay: VIP = createVipHold → recordVipConsent → createVipCheckout; floqCast = createFloqCastRequest → createFloqCastCheckout; ShoutOut = listShoutOutTemplates then startShoutOutCheckout when payload is complete.",
    "Never ask for or accept card numbers. Pay links come only from tools — VIP createVipCheckout follows the venue collector (clubPos Toast/SpotOn confirm, no-deposit confirm, or Stripe checkoutUrl for floqrStripe/clubStripe). Do not invent a Stripe URL when checkoutMode is clubPos or noDeposit; use passHref / message instead.",
    "If a tool returns ok:false, explain the error and suggest the matching FLOQR page.",
    `Viewer classification role: ${role}.`,
    "Keep brand names as-is: ShoutOut, Mingl, BartR, RydR, FloqAi, FloqCAST, BOT DEE, VIP reserV."
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

function formatSearchFallback(search) {
  const rows = search?.results || [];
  if (!rows.length) {
    return "I could not find a clear match for your account yet. Try the quick intent search below, or ask about ShoutOut, VIP reserV, floqCast, or scheduling.";
  }
  const lines = ["Here is what I found for your account:"];
  rows.slice(0, 5).forEach((row, index) => {
    lines.push(`${index + 1}. ${row.label} — ${row.blurb}`);
    if (row.href) lines.push(`   Open: ${row.href}`);
  });
  return lines.join("\n");
}

function resultsForClient(search) {
  return (search?.results || []).map(row => ({
    sourceId: row.sourceId,
    label: row.label,
    blurb: row.blurb,
    href: row.href,
    kind: row.kind
  }));
}

function linksFromToolResult(result) {
  if (!result || typeof result !== "object") return [];
  const links = [];
  if (result.checkoutUrl) links.push({label: "Pay securely", href: result.checkoutUrl, kind: "checkout"});
  if (result.previewPath) links.push({label: "Open floqCast preview", href: result.previewPath, kind: "floqcast"});
  if (result.composeHref) links.push({label: "Open ShoutOut compose", href: result.composeHref, kind: "shoutout"});
  if (result.holdId && !result.checkoutUrl) {
    links.push({label: "Continue VIP Terms", href: `./vip-terms.html?hold=${encodeURIComponent(result.holdId)}`, kind: "vip"});
  }
  return links;
}

module.exports = {
  TEXT_MODEL,
  MAX_TOOL_ROUNDS,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
  MIN_SEARCH_SCORE,
  TOOL_NAMES,
  toolDeclarations,
  sanitizeUserPrompt,
  sanitizeHistory,
  isChitchatPrompt,
  chitchatReply,
  contextualSearch,
  runTool,
  systemInstruction,
  historyToContents,
  extractText,
  formatSearchFallback,
  resultsForClient,
  linksFromToolResult,
  FLOQAI_CONTENT,
  SEARCH_CATALOG
};
