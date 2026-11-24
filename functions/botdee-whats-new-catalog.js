/* BOT DEE / Gemini What's New catalog.
   Version SMARTview shows only BOT DEE or Gemini notes. Runtime is rules —
   never a live Gemini call (Ver/Version must not invent release notes).
   Patron wording is a checked-in whatsNewText from the authoring Gemini pass
   (scripts/catalog-botdee-whats-new.js --patron). */
"use strict";

const patron = require("./botdee-patron-language");
const SCHEMA_VERSION = "floqr.botDeeWhatsNewCatalog/1";
const WHATS_NEW_LIMIT = 10;
const TEXT_LIMIT = 280;

const AUDIENCE = Object.freeze({
  botDee: "botDee",
  gemini: "gemini",
  masterAdmin: "masterAdmin",
  other: "other"
});

const INCLUDE_AUDIENCES = Object.freeze([AUDIENCE.botDee, AUDIENCE.gemini]);

/** Clause is another FLOQR product / admin surface — drop from BOT DEE What's New. */
const HARD_EXCLUDE = Object.freeze([
  /\bbeta\s+find\s+patron\b/i,
  /\bfind\s+patron\s+by\s+email\b/i,
  /\btester\s+save\b/i,
  /\bsave\s+busy\b/i,
  /\bgray\s+save\b/i,
  /\breason[- ]prompt\b/i,
  /\bfeatures\s+smartviews?\b/i,
  /\bapp\s+check\b/i,
  /\bai\s+crawl(?:ing)?\b/i,
  /\binstant\s+crawl\b/i,
  /\bmingl\s+search\s+chrome\b/i,
  /\bnative\s+select\b/i,
  /\bappearance\s+chrome\b/i,
  /\bmaster\s+hash\b/i,
  /\baudit\s+trail\b/i,
  /^master\s+admin\b/i,
  /\bmaster\s+admin\s+bot\s+dee\s+(?:subtabs?|provider)\b/i
]);

/** Clause is a BOT DEE chat / Gemini model feature patrons should see. */
const INCLUDE = Object.freeze([
  {audience: AUDIENCE.botDee, re: /\bbot[\s-]?dee\b/i},
  {audience: AUDIENCE.gemini, re: /\bgemini\b/i},
  {audience: AUDIENCE.gemini, re: /\bgoogle\s+ai\s+studio\b/i},
  {audience: AUDIENCE.botDee, re: /\bsmart(?:view|card|preview|summary)s?\b/i},
  {audience: AUDIENCE.botDee, re: /\bexecuteBotSession\b/i},
  {audience: AUDIENCE.botDee, re: /\bheadless\s+(?:shoutout|vip)\b/i},
  {audience: AUDIENCE.botDee, re: /\bthrow\s+a\s+shoutout\s+from\s+chat\b/i},
  {audience: AUDIENCE.botDee, re: /\bpeople\s+(?:lookup|card)\b/i},
  {audience: AUDIENCE.botDee, re: /\bver\s*\/\s*vers\s*\/\s*version\b/i},
  {audience: AUDIENCE.botDee, re: /\bfirst-use\s+overlay\b/i},
  {audience: AUDIENCE.botDee, re: /\bhistory\s+collapse\b/i},
  {audience: AUDIENCE.botDee, re: /\brename\s+saved\s+chats\b/i},
  {audience: AUDIENCE.botDee, re: /\brecall\s+after\b/i},
  {audience: AUDIENCE.botDee, re: /\bopt-in\s+memory\b/i}
]);

function stripId(text) {
  return String(text || "").replace(/^s3\.\d+\.\d+:\s*/i, "").trim();
}

function splitClauses(text) {
  const src = stripId(text);
  const parts = [];
  let buf = "";
  let depth = 0;
  for (const ch of src) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      const next = buf.trim();
      if (next) parts.push(next);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last) parts.push(last);
  return parts;
}

function matchesAny(text, patterns) {
  return patterns.find(re => re.test(text)) || null;
}

function includeHits(text) {
  return INCLUDE.filter(row => row.re.test(text));
}

function classifyClause(raw) {
  const text = String(raw || "").trim();
  if (!text) return {keep: false, audience: AUDIENCE.other, reason: "empty"};
  const excluded = matchesAny(text, HARD_EXCLUDE);
  if (excluded) {
    return {
      keep: false,
      audience: AUDIENCE.masterAdmin,
      reason: "hard-exclude",
      pattern: String(excluded)
    };
  }
  const hits = includeHits(text);
  if (!hits.length) {
    return {keep: false, audience: AUDIENCE.other, reason: "fail-closed"};
  }
  const audience = hits.some(row => row.audience === AUDIENCE.gemini)
    ? AUDIENCE.gemini
    : AUDIENCE.botDee;
  return {keep: true, audience, reason: "include"};
}

function formatWhatsNewText(id, clauses) {
  const body = clauses.join("; ").trim();
  const prefix = id ? `${id}: ` : "";
  return `${prefix}${body}`.slice(0, TEXT_LIMIT);
}

function explicitAudiences(row) {
  if (!row || !Array.isArray(row.audiences)) return null;
  return row.audiences.map(value => String(value || "").trim()).filter(Boolean);
}

function overrideFromSource(sourceText, overrideText) {
  const keepClauses = splitClauses(sourceText).filter(part => classifyClause(part).keep);
  if (!keepClauses.length || !overrideText) return [];
  const allowed = keepClauses.join("; ").toLowerCase();
  return splitClauses(overrideText).filter(part => {
    const clause = stripId(part).toLowerCase();
    return clause && allowed.includes(clause) && classifyClause(part).keep;
  });
}

function classifyItem(row) {
  const id = String((row && row.id) || "").trim();
  const sourceText = String((row && (row.text || row.note)) || "").trim();
  const overrideText = String((row && row.whatsNewText) || "").trim();
  const forced = explicitAudiences(row);
  if (forced && !forced.some(value => INCLUDE_AUDIENCES.includes(value))) {
    return {
      keep: false,
      id,
      text: sourceText,
      audience: forced[0] || AUDIENCE.other,
      reason: "explicit-exclude",
      clauses: []
    };
  }
  const clauses = splitClauses(sourceText).map(text => ({text, ...classifyClause(text)}));
  const kept = clauses.filter(clause => clause.keep).map(clause => clause.text);
  const overrideBody = stripId(overrideText);
  const overrideClean = !!(kept.length && overrideBody
    && !patron.internalTokenHits(overrideBody).length
    && classifyClause(overrideBody).keep);
  const overrideKeep = overrideFromSource(sourceText, overrideText);
  const shown = overrideClean ? [overrideBody] : (overrideKeep.length ? overrideKeep : kept);
  if (overrideClean || overrideKeep.length) {
    const audience = shown.some(part => classifyClause(part).audience === AUDIENCE.gemini)
      ? AUDIENCE.gemini
      : AUDIENCE.botDee;
    return {
      keep: true,
      id,
      text: formatWhatsNewText(id, shown),
      audience,
      reason: overrideClean ? "patron-language" : (kept.length ? "include" : "gemini-split"),
      clauses
    };
  }
  if (!kept.length) {
    return {
      keep: false,
      id,
      text: sourceText,
      audience: (clauses[0] && clauses[0].audience) || AUDIENCE.other,
      reason: clauses.some(clause => clause.reason === "hard-exclude") ? "hard-exclude" : "fail-closed",
      clauses
    };
  }
  const audience = clauses.some(clause => clause.keep && clause.audience === AUDIENCE.gemini)
    ? AUDIENCE.gemini
    : AUDIENCE.botDee;
  return {keep: true, id, text: formatWhatsNewText(id, kept), audience, reason: "include", clauses};
}

function forVersionWhatsNew(rows, limit) {
  const cap = Number.isFinite(Number(limit)) ? Number(limit) : WHATS_NEW_LIMIT;
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const classified = classifyItem(row);
    if (!classified.keep || !classified.id || seen.has(classified.id)) continue;
    seen.add(classified.id);
    out.push({id: classified.id, text: classified.text, audience: classified.audience});
    if (out.length >= cap) break;
  }
  return out;
}

function geminiCatalogPrompt(rows) {
  const bullets = (Array.isArray(rows) ? rows : []).map(row => `- ${row.id}: ${stripId(row.text)}`).join("\n");
  return [
    "You catalogue FLOQR package changelog bullets for BOT DEE What's New (Version SMARTview).",
    "Return JSON only: {\"items\":[{\"id\":\"s3.x.y\",\"keep\":true|false,\"audience\":\"botDee\"|\"gemini\"|\"masterAdmin\"|\"other\",\"whatsNewText\":\"s3.x.y: patron-facing BOT DEE/Gemini clause only\"}]}",
    "KEEP only BOT DEE chat features or Gemini model features (SMARTview/SMARTcard/SMARTpreview/SMARTsummary in BOT DEE, headless ShoutOut/VIP from chat, Ver/Vers/Version, memory/recall, Room SMARTview, People cards, Gemini model id).",
    "DROP Master Admin, beta Find patron, tester/Gray/busy Save, Features SMARTview, App Check, AI crawl, Mingl Search chrome, Appearance/native select, other product notes.",
    "Mixed bullets: keep BOT DEE/Gemini clauses; drop the rest. Do not invent features. Do not translate brands (BOT DEE, Gemini, SMARTview, ShoutOut, Mingl, VIP reserV, FloqR).",
    "whatsNewText must be plain patron language. Never use unmount, headless, six-phase, night rail, identity-only, compact picker, chat dump, or executeBotSession.",
    "Rules in code are the runtime source of truth. Your output is a review proposal only.",
    "Bullets:",
    bullets
  ].join("\n");
}

function applyPatronProposal(rows, proposal) {
  const byId = new Map();
  const items = proposal && Array.isArray(proposal.items) ? proposal.items : [];
  items.forEach(item => {
    const id = String((item && item.id) || "").trim();
    if (id) byId.set(id, item);
  });
  return (Array.isArray(rows) ? rows : []).map(row => {
    const sourceOnly = classifyItem({...row, whatsNewText: ""});
    if (!sourceOnly.keep) return row;
    const suggestion = byId.get(sourceOnly.id);
    const raw = suggestion && (suggestion.patronText || suggestion.whatsNewText);
    if (!raw) return row;
    const body = stripId(raw);
    if (!body || patron.internalTokenHits(body).length || !classifyClause(body).keep) return row;
    const audiences = Array.isArray(row.audiences) && row.audiences.length
      ? row.audiences.slice()
      : [sourceOnly.audience];
    return {...row, audiences, whatsNewText: formatWhatsNewText(sourceOnly.id, [body])};
  });
}

function mergeGeminiProposal(rows, proposal) {
  const byId = new Map();
  const items = proposal && Array.isArray(proposal.items) ? proposal.items : [];
  items.forEach(item => {
    const id = String((item && item.id) || "").trim();
    if (id) byId.set(id, item);
  });
  return (Array.isArray(rows) ? rows : []).map(row => {
    const classified = classifyItem(row);
    const suggestion = byId.get(classified.id);
    if (!suggestion || classified.keep) return classified;
    if (suggestion.keep === true && suggestion.whatsNewText) {
      const retry = classifyItem({...row, whatsNewText: suggestion.whatsNewText});
      if (retry.keep) return {...retry, reason: "gemini-split"};
    }
    return classified;
  });
}

module.exports = {
  SCHEMA_VERSION,
  WHATS_NEW_LIMIT,
  AUDIENCE,
  INCLUDE_AUDIENCES,
  HARD_EXCLUDE,
  INCLUDE,
  stripId,
  splitClauses,
  classifyClause,
  classifyItem,
  forVersionWhatsNew,
  geminiCatalogPrompt,
  mergeGeminiProposal,
  applyPatronProposal
};
