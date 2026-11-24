/* Standing help verbiage enhancement.
   One entry in, one Gemini rewrite out. Functions set beenModsincelasttextenhun
   from a SHA-256 of the raw title + body. Nobody types 0 or 1.
   Pages never call Gemini from this module. */
"use strict";

const crypto = require("crypto");

const TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";
const COLLECTION = "helpVerbiage";
const AUDIT_COLLECTION = "helpVerbiageAudit";

/** Patron, venue admin, and service member need every language before the flag returns to 0. */
const TRANSLATION_LANGS = Object.freeze(["de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"]);
const TRANSLATION_AUDIENCES = Object.freeze(["patron", "serviceMember", "venueAdmin"]);
const VERSION_HELP_IDS = Object.freeze([
  "help-botdee-version-smartview",
  "help-botdee-version-smartview-status",
  "help-botdee-version-smartview-tabs"
]);

/** Longer marks first so "Room SMARTview" is not treated as a new "SMARTview". */
const BRANDS = Object.freeze([
  "Room SMARTview",
  "VIP reserV",
  "SMARTpreview",
  "SMARTview",
  "BOT DEE",
  "ShoutOut",
  "FloqCAST",
  "floqCast",
  "FloqR",
  "FLOQR",
  "Gemini",
  "Mingl",
  "BartR",
  "RydR"
]);

const INTERNAL_TOKENS = Object.freeze([
  {id: "unmount", re: /\bunmount(?:s|ed|ing)?\b/i},
  {id: "headless", re: /\bheadless\b/i},
  {id: "six-phase", re: /\bsix[-\s]?phase\b/i},
  {id: "night rail", re: /\bnight\s+rail\b/i},
  {id: "identity-only", re: /\bidentity-only\b/i},
  {id: "compact picker", re: /\bcompact\s+picker\b/i},
  {id: "chat dump", re: /\bchat\s+dump\b/i},
  {id: "executeBotSession", re: /\bexecuteBotSession\b/}
]);

const LEGAL_ID = /(?:^|[-_])(?:terms|refund|no-?show|noshow|counsel|legal)(?:[-_]|$)/i;
const LEGAL_TITLE = /\b(terms|refund|no-show|no show|counsel|legal)\b/i;

function text(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function sourceHash(title, body) {
  return crypto.createHash("sha256").update(`${text(title)}\n${text(body)}`, "utf8").digest("hex");
}

function normalizeAudiences(raw) {
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const out = [];
  list.forEach(value => {
    const key = String(value || "").trim();
    if (key && !out.includes(key)) out.push(key);
  });
  return out.length ? out : ["patron"];
}

function audienceLabel(audiences) {
  const list = normalizeAudiences(audiences);
  return {audiences: list, audienceLabel: list[0]};
}

function isMasterOnly(audiences) {
  const list = normalizeAudiences(audiences);
  return list.length === 1 && list[0] === "masterAdmin";
}

function needsTranslations(audiences) {
  return normalizeAudiences(audiences).some(key => TRANSLATION_AUDIENCES.includes(key));
}

function isLegalVerbiage(entry) {
  if (!entry || entry.legal === true || entry.legal === 1) return true;
  const id = String(entry.id || "");
  const title = String(entry.title || "");
  if (LEGAL_ID.test(id)) return true;
  if (LEGAL_TITLE.test(title)) return true;
  return false;
}

function internalTokenHits(value) {
  const src = String(value || "");
  return INTERNAL_TOKENS.filter(row => row.re.test(src)).map(row => row.id);
}

function splitSentences(value) {
  const src = text(value);
  if (!src) return [];
  return src.split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean);
}

function dropRepeatedSentences(value) {
  const seen = new Set();
  const kept = [];
  splitSentences(value).forEach(sentence => {
    const key = sentence.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    kept.push(sentence);
  });
  return kept.join(" ");
}

function hasRepeatedSentences(value) {
  const seen = new Set();
  for (const sentence of splitSentences(value)) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Light grammar normalization the checker also expects from model output. */
function grammarPass(value) {
  let src = text(value);
  if (!src) return "";
  src = src.replace(/\b(the|a|an|to|of|and|or)\s+\1\b/gi, "$1");
  const stamp = src.match(/^(s3\.\d+\.\d+:\s*)/i);
  const head = stamp ? stamp[1] : "";
  const rest = stamp ? src.slice(head.length) : src;
  const fixed = rest.replace(/(^|[.!?]\s+)([a-z])/g, (all, lead, letter) => lead + letter.toUpperCase());
  return head + fixed;
}

function grammarIssues(value, {requireTerminal = false} = {}) {
  const src = String(value || "");
  const issues = [];
  if (!text(src)) issues.push("empty");
  if (/\b(the|a|an|to|of|and|or)\s+\1\b/i.test(src)) issues.push("repeated-word");
  if (/\s{2,}/.test(src)) issues.push("double-space");
  if (splitSentences(src).some(sentence => /^[a-z]/.test(sentence) && !/^s3\.\d+\.\d+:/i.test(sentence))) {
    issues.push("lowercase-sentence");
  }
  if (requireTerminal && text(src) && !/[.!?]$/.test(text(src))) issues.push("terminal");
  return issues;
}

function brandsIn(value) {
  const src = String(value || "");
  const found = [];
  BRANDS.forEach(brand => {
    if (src.includes(brand)) found.push(brand);
  });
  return found;
}

function missingBrands(sourceText, outputText) {
  return brandsIn(sourceText).filter(brand => !String(outputText || "").includes(brand));
}

function inventedBrands(sourceText, outputText) {
  return brandsIn(outputText).filter(brand => !String(sourceText || "").includes(brand));
}

function englishReady(row) {
  return !!(row && text(row.title) && text(row.body));
}

function localesComplete(locales) {
  return TRANSLATION_LANGS.every(code => {
    const row = locales && locales[code];
    return !!(row && text(row.title) && text(row.body));
  });
}

function publishComplete(entry, lasttextenhun, locales) {
  if (!englishReady(lasttextenhun)) return false;
  if (!needsTranslations(entry && entry.audiences)) return true;
  return localesComplete(locales);
}

/**
 * 1 when the raw hash differs, the entry was never published, or required
 * translations are not stored with the English lasttextenhun.
 * 0 only when the stored hash matches and the required languages are present.
 */
function flagFor({entry, rawHash, storedHash, lasttextenhun, locales}) {
  if (isLegalVerbiage(entry)) return 0;
  const hash = String(rawHash || "");
  const stored = String(storedHash || "");
  if (!hash || hash !== stored) return 1;
  if (!publishComplete(entry, lasttextenhun, locales)) return 1;
  return 0;
}

function enhancementPrompt(entry) {
  if (!entry || isLegalVerbiage(entry)) return "";
  const labeled = audienceLabel(entry.audiences);
  const title = text(entry.title);
  const body = text(entry.body);
  const lines = [
    "You enhance exactly one FLOQR help entry.",
    "On this entry, in order: (1) drop repeated sentences, (2) grammar pass, (3) rewrite the title and body so it is contextual and easier to read.",
    "Keep the meaning. Do not add a product, screen, or feature that is not in the source.",
    "Return JSON only with keys title, body, and locales.",
    needsTranslations(labeled.audiences)
      ? `locales must include ${TRANSLATION_LANGS.join(", ")}. Each value is {"title","body"}.`
      : "This entry is Master Admin only. Return locales as an empty object. English is enough.",
    "Keep a leading s3.x.y: stamp when the source body has one.",
    `Never translate these brands: ${BRANDS.join(", ")}.`,
    "Never use these internal tokens: unmount, headless, six-phase, night rail, identity-only, compact picker, chat dump, executeBotSession.",
    "Do not include a person's name, email, phone, chat, secret, or IP address.",
    `Audience: ${labeled.audiences.join(", ")}`,
    `Title: ${title}`,
    `Body: ${body}`
  ];
  return lines.join("\n");
}

function geminiGenerateRequest(prompt, apiKey) {
  const model = TEXT_MODEL;
  const key = String(apiKey || "").trim();
  return {
    model,
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key
      },
      body: JSON.stringify({
        contents: [{role: "user", parts: [{text: String(prompt || "")}]}],
        generationConfig: {responseMimeType: "application/json", temperature: 0}
      })
    }
  };
}

function parseGeminiJson(raw) {
  const value = String(raw || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      return null;
    }
  }
}

function extractGeminiText(payload) {
  const parts = payload && payload.candidates && payload.candidates[0]
    && payload.candidates[0].content && payload.candidates[0].content.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map(part => String(part && part.text || "")).join("");
}

function normalizeLocales(raw) {
  const out = {};
  const source = raw && typeof raw === "object" ? raw : {};
  TRANSLATION_LANGS.forEach(code => {
    const row = source[code];
    if (!row || typeof row !== "object") return;
    const title = text(row.title);
    const body = text(row.body);
    if (!title || !body) return;
    out[code] = {title, body};
  });
  return out;
}

function reviewOutput(entry, model) {
  const sourceTitle = text(entry && entry.title);
  const sourceBody = text(entry && entry.body);
  const sourceText = `${sourceTitle}\n${sourceBody}`;
  const title = grammarPass(dropRepeatedSentences(model && model.title));
  const body = grammarPass(dropRepeatedSentences(model && model.body));
  const reasons = [];
  if (!title || !body) reasons.push("empty");
  if (hasRepeatedSentences(title) || hasRepeatedSentences(body)) reasons.push("repeats");
  grammarIssues(title).forEach(issue => reasons.push(`grammar-title:${issue}`));
  grammarIssues(body, {requireTerminal: true}).forEach(issue => reasons.push(`grammar-body:${issue}`));
  const outputText = `${title}\n${body}`;
  missingBrands(sourceText, outputText).forEach(brand => reasons.push(`brand:${brand}`));
  inventedBrands(sourceText, outputText).forEach(brand => reasons.push(`invented:${brand}`));
  internalTokenHits(outputText).forEach(token => reasons.push(`jargon:${token}`));
  const stamp = sourceBody.match(/^(s3\.\d+\.\d+:)/i);
  if (stamp && !body.startsWith(stamp[1])) reasons.push("stamp");
  const locales = needsTranslations(entry && entry.audiences) ? normalizeLocales(model && model.locales) : {};
  if (needsTranslations(entry && entry.audiences)) {
    TRANSLATION_LANGS.forEach(code => {
      const row = locales[code];
      if (!row) {
        reasons.push(`locale:${code}`);
        return;
      }
      const localeText = `${row.title}\n${row.body}`;
      missingBrands(sourceText, localeText).forEach(brand => reasons.push(`brand:${code}:${brand}`));
      internalTokenHits(localeText).forEach(token => reasons.push(`jargon:${code}:${token}`));
    });
  }
  return {
    ok: reasons.length === 0,
    reasons,
    lasttextenhun: {title, body},
    locales
  };
}

function seedRecord(entry, lasttextenhun) {
  const labeled = audienceLabel(entry.audiences);
  const rawTitle = text(entry.title);
  const rawBody = text(entry.body);
  const published = {
    title: text(lasttextenhun && lasttextenhun.title) || rawTitle,
    body: text(lasttextenhun && lasttextenhun.body) || rawBody
  };
  const hash = sourceHash(rawTitle, rawBody);
  return {
    id: String(entry.id || ""),
    audiences: labeled.audiences,
    audienceLabel: labeled.audienceLabel,
    rawTitle,
    rawBody,
    lasttextenhun: published,
    lasttextenhunSourceHash: hash,
    locales: {},
    beenModsincelasttextenhun: flagFor({
      entry,
      rawHash: hash,
      storedHash: hash,
      lasttextenhun: published,
      locales: {}
    }),
    seeded: 1,
    legal: 0
  };
}

function versionSeedRecords(helpEntries) {
  const byId = new Map((helpEntries || []).map(entry => [entry.id, entry]));
  return VERSION_HELP_IDS.map(id => byId.get(id)).filter(Boolean).map(entry => seedRecord(entry, {
    title: entry.title,
    body: entry.body
  }));
}

function whatsNewSeedRecords(changelogRows, catalog) {
  const shown = catalog.forVersionWhatsNew(changelogRows, 100);
  const rawById = new Map((changelogRows || []).map(row => [String(row.id || ""), row]));
  return shown.map(row => {
    const raw = rawById.get(row.id) || {};
    const engineer = text(raw.text || row.text);
    return seedRecord({
      id: `whatsnew-${row.id}`,
      title: `What's New ${row.id}`,
      body: engineer,
      audiences: ["patron"]
    }, {
      title: `What's New ${row.id}`,
      body: text(row.text)
    });
  });
}

function pagesSnapshot(records) {
  return (records || []).filter(row => row && row.id && !isMasterOnly(row.audiences) && !isLegalVerbiage(row)).map(row => ({
    id: row.id,
    audiences: normalizeAudiences(row.audiences).filter(key => key !== "masterAdmin"),
    audienceLabel: row.audienceLabel === "masterAdmin"
      ? (normalizeAudiences(row.audiences).find(key => key !== "masterAdmin") || "patron")
      : (row.audienceLabel || normalizeAudiences(row.audiences)[0]),
    lasttextenhun: {
      title: text(row.lasttextenhun && row.lasttextenhun.title),
      body: text(row.lasttextenhun && row.lasttextenhun.body)
    },
    locales: needsTranslations(row.audiences) ? normalizeLocales(row.locales) : {},
    beenModsincelasttextenhun: row.beenModsincelasttextenhun === 0 ? 0 : 1
  })).filter(row => row.lasttextenhun.title && row.lasttextenhun.body);
}

function selectNext(entries, docsById) {
  const queue = (entries || []).filter(entry => {
    if (!entry || !entry.id || isLegalVerbiage(entry)) return false;
    const doc = docsById && docsById[entry.id];
    const rawHash = sourceHash(entry.title, entry.body);
    const flag = doc
      ? flagFor({
        entry,
        rawHash,
        storedHash: doc.lasttextenhunSourceHash,
        lasttextenhun: doc.lasttextenhun,
        locales: doc.locales
      })
      : 1;
    return flag === 1;
  });
  queue.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return queue[0] || null;
}

function reconcileDoc(entry, existing) {
  if (isLegalVerbiage(entry)) return {skip: true, id: entry && entry.id};
  const labeled = audienceLabel(entry.audiences);
  const rawTitle = text(entry.title);
  const rawBody = text(entry.body);
  const rawHash = sourceHash(rawTitle, rawBody);
  const prior = existing || {};
  const lasttextenhun = englishReady(prior.lasttextenhun) ? {
    title: text(prior.lasttextenhun.title),
    body: text(prior.lasttextenhun.body)
  } : null;
  const locales = normalizeLocales(prior.locales);
  const flag = flagFor({
    entry,
    rawHash,
    storedHash: prior.lasttextenhunSourceHash,
    lasttextenhun,
    locales
  });
  return {
    skip: false,
    id: String(entry.id),
    audiences: labeled.audiences,
    audienceLabel: labeled.audienceLabel,
    rawTitle,
    rawBody,
    lasttextenhun,
    locales,
    lasttextenhunSourceHash: String(prior.lasttextenhunSourceHash || ""),
    beenModsincelasttextenhun: flag,
    seeded: prior.seeded === 1 ? 1 : 0,
    legal: 0
  };
}

function applyReview(entry, existing, review) {
  const base = reconcileDoc(entry, existing);
  if (!review || review.ok !== true) {
    return {
      outcome: review && review.down ? "gemini-down" : "rejected",
      doc: {
        ...base,
        lasttextenhun: base.lasttextenhun,
        locales: base.locales,
        beenModsincelasttextenhun: 1
      },
      reasons: (review && review.reasons) || ["rejected"]
    };
  }
  const nextLocales = needsTranslations(entry.audiences) ? review.locales : {};
  const hash = sourceHash(entry.title, entry.body);
  const flag = flagFor({
    entry,
    rawHash: hash,
    storedHash: hash,
    lasttextenhun: review.lasttextenhun,
    locales: nextLocales
  });
  return {
    outcome: flag === 0 ? "published" : "rejected",
    doc: {
      ...base,
      lasttextenhun: flag === 0 ? review.lasttextenhun : base.lasttextenhun,
      locales: flag === 0 ? nextLocales : base.locales,
      lasttextenhunSourceHash: flag === 0 ? hash : base.lasttextenhunSourceHash,
      beenModsincelasttextenhun: flag === 0 ? 0 : 1,
      seeded: flag === 0 ? 0 : base.seeded
    },
    reasons: flag === 0 ? [] : ["incomplete-publish"]
  };
}

function applyPublishedVerbiage(results, recordsById) {
  const map = recordsById || {};
  return (results || []).map(row => {
    if (!row) return row;
    const rec = map[row.id] || map[row.sourceId] || null;
    if (!rec || !englishReady(rec.lasttextenhun)) return row;
    if (isMasterOnly(rec.audiences)) return row;
    return {
      ...row,
      label: rec.lasttextenhun.title,
      blurb: rec.lasttextenhun.body
    };
  });
}

function publicSnapshotRecord(id, snapshot) {
  const row = snapshot && snapshot[id];
  if (!row || isMasterOnly(row.audiences)) return null;
  return row;
}

module.exports = {
  TEXT_MODEL,
  COLLECTION,
  AUDIT_COLLECTION,
  TRANSLATION_LANGS,
  TRANSLATION_AUDIENCES,
  VERSION_HELP_IDS,
  BRANDS,
  INTERNAL_TOKENS,
  text,
  sourceHash,
  normalizeAudiences,
  audienceLabel,
  isMasterOnly,
  needsTranslations,
  isLegalVerbiage,
  internalTokenHits,
  dropRepeatedSentences,
  hasRepeatedSentences,
  grammarPass,
  grammarIssues,
  missingBrands,
  inventedBrands,
  localesComplete,
  publishComplete,
  flagFor,
  enhancementPrompt,
  geminiGenerateRequest,
  parseGeminiJson,
  extractGeminiText,
  normalizeLocales,
  reviewOutput,
  seedRecord,
  versionSeedRecords,
  whatsNewSeedRecords,
  pagesSnapshot,
  selectNext,
  reconcileDoc,
  applyReview,
  applyPublishedVerbiage,
  publicSnapshotRecord
};
