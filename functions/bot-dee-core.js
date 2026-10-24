/* BOT DEE session core — tool defs, classification-gated contextualSearch, Gemini message shaping.
   Phase 1: read-only contextualSearch only. Pay / VIP / ShoutOut tools land later and re-validate role. */
"use strict";

const {Type} = require("@google/genai");
const classification = require("./data-classification-core");
const FLOQAI_CONTENT = require("./floqai-content-classes.json");
const SEARCH_CATALOG = require("./bot-dee-search-catalog.json");

const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 2000;
const MAX_RESULTS = 8;
const MAX_TOOL_ROUNDS = 3;
const TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";

const TOOL_CONTEXTUAL_SEARCH = {
  name: "contextualSearch",
  description:
    "Search FLOQR help topics and product intents the signed-in viewer may access. Use for questions about ShoutOut, VIP, floqCast, scheduling, clubs, profile, or how to do something in FLOQR. Returns classification-filtered results only.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Plain-language search query from the patron."
      }
    },
    required: ["query"]
  }
};

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

function scoreEntry(query, entry) {
  const q = normalize(query);
  if (!q) return 0;
  const qTokens = tokens(q);
  let score = 0;
  const hay = normalize([entry.label, entry.blurb, ...(entry.phrases || [])].join(" "));
  if (hay.includes(q)) score += 8;
  (entry.phrases || []).forEach(phrase => {
    if (!phrase) return;
    if (phrase === q) score += 10;
    else if (phrase.startsWith(q) || q.startsWith(phrase)) score += 5;
    else if (phrase.includes(q) || q.includes(phrase)) score += 3;
  });
  const label = normalize(entry.label);
  if (label && q.includes(label)) score += 4;
  qTokens.forEach(token => {
    if (hay.includes(token)) score += 1;
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
  scored.sort((a, b) => b.points - a.points || a.entry.sourceId.localeCompare(b.entry.sourceId));
  const candidates = scored.slice(0, 40).map(row => row.entry.sourceId);
  const {allowed, denied} = classification.filterContent(candidates, FLOQAI_CONTENT, {role});
  const allowedSet = new Set(allowed);
  const results = scored
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
  return {ok: false, error: `Tool not available in Phase 1: ${name}`};
}

function toolDeclarations() {
  return [TOOL_CONTEXTUAL_SEARCH];
}

function systemInstruction(role) {
  return [
    "You are BOT DEE, FLOQR's in-app assistant on the FloqAi page.",
    "Answer briefly in plain language. Prefer short steps and links from tool results.",
    "Only recommend products or help topics returned by contextualSearch for this viewer.",
    "Never invent payment, VIP holds, ShoutOut checkout, or card flows — those tools are not enabled yet.",
    "If search returns nothing useful, say so and suggest the classic intent search or classic Search.",
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

module.exports = {
  TEXT_MODEL,
  MAX_TOOL_ROUNDS,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
  toolDeclarations,
  TOOL_CONTEXTUAL_SEARCH,
  sanitizeUserPrompt,
  sanitizeHistory,
  contextualSearch,
  runTool,
  systemInstruction,
  historyToContents,
  extractText,
  formatSearchFallback,
  resultsForClient,
  FLOQAI_CONTENT,
  SEARCH_CATALOG
};
