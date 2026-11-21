/* Patron-language pass for BOT DEE What's New and version help.
   Authoring only: Pages cannot call Gemini while painting the version card.
   Runtime still shows the checked-in line. Model is the same gemini-3.6-flash
   path the version card reports (FLOQR_GEMINI_TEXT_MODEL). */
"use strict";

const TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";

/** Internal tokens that must not ship in patron English. Brands are not tokens. */
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

/** Protected brands. The rewrite must not translate these spellings. */
const BRANDS = Object.freeze([
  "BOT DEE",
  "VIP reserV",
  "ShoutOut",
  "FloqR",
  "FLOQR",
  "SMARTview",
  "Room SMARTview",
  "SMARTpreview",
  "Gemini",
  "Mingl"
]);

function internalTokenHits(text) {
  const src = String(text || "");
  return INTERNAL_TOKENS.filter(row => row.re.test(src)).map(row => row.id);
}

function geminiPatronPrompt(items) {
  const bullets = (Array.isArray(items) ? items : []).map(row => {
    const id = String((row && row.id) || "").trim();
    const text = String((row && (row.text || row.note)) || "").replace(/^s3\.\d+\.\d+:\s*/i, "").trim();
    return `- ${id}: ${text}`;
  }).join("\n");
  return [
    "You rewrite FLOQR BOT DEE What's New lines and help into plain patron language.",
    `Use the same model BOT DEE already uses: ${TEXT_MODEL}. Do not switch AI vendor.`,
    "Return JSON only: {\"items\":[{\"id\":\"s3.x.y\",\"patronText\":\"s3.x.y: one or two short sentences a patron understands\"}]}",
    "Rules:",
    "- Keep the version stamp (s3.x.y:) when the source has one.",
    "- Say what the patron can do. For a table booking: book or hold a table interactively with BOT DEE, including the night, the 2D floor map, and cancel, which removes the booking panel.",
    "- People search: names and handles only, not bios, and smaller cards when several people match.",
    "- Room SMARTview stays Room SMARTview. It is the product name.",
    "- Do not invent features that are not in the source.",
    "- Never use these internal tokens: unmount, headless, six-phase, night rail, identity-only, compact picker, chat dump, executeBotSession.",
    `- Never translate these brands: ${BRANDS.join(", ")}.`,
    "Sources:",
    bullets
  ].join("\n");
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
  const text = String(raw || "").replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

module.exports = {
  TEXT_MODEL,
  INTERNAL_TOKENS,
  BRANDS,
  internalTokenHits,
  geminiPatronPrompt,
  geminiGenerateRequest,
  parseGeminiJson
};
