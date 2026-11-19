/* ShoutOut SMARTpreview — BOT DEE collection preview of a headless draft.
   Optional BOT DEE UI only; docks above the composer. Headless compose /
   checkout (headless-shoutout-core.js) never require this module. Third-party
   one-shot throws stay a payload contract. */
"use strict";

const headless = require("./headless-shoutout-core");

const SCHEMA_VERSION = "floqr.botDeeShoutOutSmartView/1";
const KIND = "botDeeShoutOut";

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function previewHref(draft = {}) {
  const row = headless.clipInteractiveDraft(draft);
  const params = new URLSearchParams();
  if (row.clubQuery) params.set("location", row.clubQuery);
  params.set("template", row.templateId || headless.DEFAULT_TEMPLATE_ID);
  if (row.message) params.set("main", row.message);
  if (row.handleDecision === "include" && row.attribution) {
    params.set("attribution", row.attribution);
    params.set("includeAttribution", "1");
  }
  if (row.screenFormatId) params.set("screen", row.screenFormatId);
  params.set("preview", "1");
  return `./display.html?${params.toString()}`;
}

function suggestionPrompts() {
  return [
    {id: "blackwhite", prompt: "Traditional", group: "template"},
    {id: "neon", prompt: "Neon", group: "template"},
    {id: "birthday", prompt: "Birthday", group: "template"},
    {id: "gold", prompt: "Gold", group: "template"},
    {id: "vip", prompt: "VIP", group: "template"},
    {id: "graduation", prompt: "Graduation", group: "template"},
    {id: "corporate", prompt: "Corporate", group: "template"},
    {id: "classicHalloween", prompt: "Halloween", group: "template"},
    {id: "includeHandle", prompt: "include my handle", group: "handle"},
    {id: "skipHandle", prompt: "no handle", group: "handle"},
    {id: "textOnly", prompt: "text only", group: "media"},
    {id: "photoCompose", prompt: "with a photo", group: "media"},
    {id: "throwIt", prompt: "throw it", group: "throw"}
  ];
}

/** Three classic-board lines for the SMARTview replica. Not Display 1. */
function previewLines(message = "") {
  const perLine = 15;
  const lineCount = 3;
  const clean = String(message || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  if (!clean) return [];
  const rows = [];
  let row = [];
  clean.split(/\s+/).filter(Boolean).forEach(word => {
    const chunks = [];
    for (let i = 0; i < word.length; i += perLine) chunks.push(word.slice(i, i + perLine));
    chunks.forEach(chunk => {
      const nextLen = row.length ? row.join("").length + 1 + chunk.length : chunk.length;
      if (nextLen <= perLine) {
        if (row.length) row.push(" ");
        row.push(chunk);
      } else if (rows.length < lineCount) {
        if (row.length) rows.push(row.join(""));
        row = [chunk];
      }
    });
  });
  if (row.length && rows.length < lineCount) rows.push(row.join(""));
  return rows.slice(0, lineCount);
}

function boardSkin(templateId) {
  const id = String(templateId || headless.DEFAULT_TEMPLATE_ID);
  if (id === "classicHalloween") return "halloween";
  if (id === "gold" || id === "vip") return "gold";
  if (id === "neon" || id === "birthday") return "neon";
  return "traditional";
}

function buildShoutOutSmartView(opts = {}) {
  const options = opts && typeof opts === "object" ? opts : {};
  const draft = headless.clipInteractiveDraft(options.draft || {});
  const needs = Array.isArray(options.needs) ? options.needs.map(String) : headless.interactiveNeeds(draft);
  const mode = text(options.mode || (needs.length ? "draft" : "ready"), 24);
  const picked = headless.pickTemplate({}, draft.templateId || headless.DEFAULT_TEMPLATE_ID);
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: KIND,
    generatedAtIso: new Date(nowMs).toISOString(),
    title: "ShoutOut",
    mode,
    venueName: text(options.venueName || draft.clubQuery, 160),
    clubLocationId: draft.clubQuery,
    mainText: draft.message,
    templateId: draft.templateChosen ? draft.templateId : (draft.templateId || ""),
    templateName: draft.templateChosen ? picked.templateName : "",
    templateSuggestedId: draft.templateChosen ? "" : headless.DEFAULT_TEMPLATE_ID,
    templateSuggestedName: headless.HEADLESS_TEXT_TEMPLATES[headless.DEFAULT_TEMPLATE_ID].name,
    screenFormatId: draft.screenFormatId,
    screenFormatLabel: headless.SCREEN_LABELS[draft.screenFormatId] || "",
    includeAttribution: draft.handleDecision === "include",
    attribution: draft.attribution,
    handleDecision: draft.handleDecision,
    mediaDecision: draft.mediaDecision,
    mediaUrl: draft.mediaUrl,
    previewLines: previewLines(draft.message),
    boardSkin: boardSkin(draft.templateId || headless.DEFAULT_TEMPLATE_ID),
    currentStep: needs[0] || (mode === "draft" ? "throw" : ""),
    needs,
    templates: headless.listHeadlessTemplates(),
    suggestions: suggestionPrompts(),
    previewHref: previewHref(draft),
    composeHref: headless.shoutOutComposeHref(draft.clubQuery),
    checkoutUrl: text(options.checkoutUrl, 500),
    shoutoutId: text(options.shoutoutId, 80),
    portalHref: text(options.portalHref, 200),
    priceCents: Number(picked.priceCents) || 0
  };
}

function isShoutOutPayload(payload) {
  return !!(payload && typeof payload === "object" && payload.kind === KIND);
}

module.exports = {
  SCHEMA_VERSION,
  KIND,
  previewHref,
  previewLines,
  boardSkin,
  suggestionPrompts,
  buildShoutOutSmartView,
  isShoutOutPayload
};
