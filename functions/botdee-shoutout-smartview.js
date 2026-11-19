/* BOT DEE ShoutOut SMARTview — chat preview of a headless draft.
   Optional BOT DEE collection UI only. Headless compose / checkout
   (headless-shoutout-core.js) never require this module. Third-party
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
    {id: "blackwhite", prompt: "Traditional"},
    {id: "neon", prompt: "Neon"},
    {id: "birthday", prompt: "Birthday"},
    {id: "gold", prompt: "Gold"},
    {id: "vip", prompt: "VIP"},
    {id: "graduation", prompt: "Graduation"},
    {id: "corporate", prompt: "Corporate"},
    {id: "classicHalloween", prompt: "Halloween"},
    {id: "includeHandle", prompt: "include my handle"},
    {id: "skipHandle", prompt: "no handle"},
    {id: "textOnly", prompt: "text only"},
    {id: "photoCompose", prompt: "with a photo"},
    {id: "throwIt", prompt: "throw it"}
  ];
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
  suggestionPrompts,
  buildShoutOutSmartView,
  isShoutOutPayload
};
