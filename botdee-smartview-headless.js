/* Headless SMARTview — authorized text → compact place/info cards.
   Fixed display templates. Gemini off. No Search, no Features catalog.
   Client-only; nothing is persisted. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FLOQRBotDeeSmartViewHeadless = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA_VERSION = "floqr.smartView/1";
  const MAX_INPUT = 2000;
  const SUMMARY_MAX = 160;
  /* Schema requires sources.retrievedAt. This is the mock-catalog filler, not a live fetch. */
  const SCHEMA_RETRIEVED_AT = "2026-11-14T00:00:00.000Z";

  const INJECTION = [
    /ignore (?:previous|all) instructions/i,
    /system prompt/i,
    /<\/?script\b/i,
    /javascript:/i,
    /https?:\/\/\S+/i,
    /data:text\/html/i
  ];

  function text(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || MAX_INPUT);
  }

  function injectionHit(raw) {
    return INJECTION.some(re => re.test(raw));
  }

  function finishClip(hay, start, end, limit) {
    let clip = hay.slice(start, end).trim();
    if (start > 0) clip = clip.replace(/^[,.;:–—-]+\s*/, "");
    const trailing = end < hay.length;
    if (trailing) clip = clip.replace(/[,.;:–—-]+$/, "");
    const ellipsis = trailing ? "…" : "";
    const budget = Math.max(1, limit - ellipsis.length);
    if (clip.length <= budget) return clip + ellipsis;
    let out = clip.slice(0, budget);
    const space = out.lastIndexOf(" ");
    if (space >= 24) out = out.slice(0, space);
    return `${out.replace(/[,.;:–—-]+$/, "")}…`;
  }

  function clipAround(source, match, max) {
    const hay = String(source || "");
    const needle = String(match || "");
    const limit = Math.max(8, Number(max) || SUMMARY_MAX);
    if (!hay) return "";
    const idx = hay.indexOf(needle);
    if (idx < 0) return finishClip(hay, 0, hay.length, limit);
    const pad = Math.max(24, Math.floor((limit - needle.length) / 2));
    let start = Math.max(0, idx - pad);
    let end = Math.min(hay.length, idx + needle.length + pad);
    if (start > 0) {
      const space = hay.lastIndexOf(" ", start);
      if (space >= 0) start = space + 1;
    }
    if (end < hay.length) {
      const space = hay.indexOf(" ", end);
      if (space >= 0) end = space;
    }
    return finishClip(hay, start, end, limit);
  }

  function resolverApi() {
    if (typeof globalThis !== "undefined" && globalThis.FLOQRSmartVisualsResolver) {
      return globalThis.FLOQRSmartVisualsResolver;
    }
    try {
      if (typeof require === "function") return require("./smartvisuals-resolver");
    } catch (_) { /* optional in this host */ }
    return null;
  }

  function stampPlaceVisual(payload) {
    const api = resolverApi();
    if (!payload || !api?.resolvePlaceCard) return payload;
    try {
      const visual = api.resolvePlaceCard(payload);
      payload.floqrPublicData = Object.assign({}, payload.floqrPublicData || {}, {
        smartBackgroundId: visual.backgroundId || "",
        smartStencilId: visual.stencilId || "",
        smartTags: Array.isArray(visual.tags) ? visual.tags : []
      });
    } catch (_) { /* catalog optional */ }
    return payload;
  }

  function cardPayload({kind, title, summary}) {
    return stampPlaceVisual({
      schemaVersion: SCHEMA_VERSION,
      kind,
      title: text(title, 160),
      visibility: "restricted",
      canonicalFloqrPageId: null,
      summary: text(summary, SUMMARY_MAX),
      images: [],
      ratings: [],
      sources: [{
        provider: "FLOQR",
        url: "./botdee-smartview-headless.html",
        retrievedAt: SCHEMA_RETRIEVED_AT,
        reuseRights: "restricted"
      }],
      publicWebResearch: {enabled: false, reason: "legal_gate_blocked"},
      floqrPublicData: {
        authorizedText: true,
        geminiUsed: false
      },
      recommendationExplanation: {},
      actions: []
    });
  }

  function fallbackCard(source) {
    const words = source.split(" ").slice(0, 8).join(" ");
    return cardPayload({
      kind: "product",
      title: text(words, 80) || "Authorized text",
      summary: text(source, SUMMARY_MAX)
    });
  }

  function cardsFromAuthorizedText(raw, opts) {
    const source = text(raw, MAX_INPUT);
    if (!source) {
      return {ok: false, reason: "empty-text", geminiUsed: false, views: []};
    }
    if (injectionHit(source)) {
      return {ok: false, reason: "prompt-injection-ignored", geminiUsed: false, views: []};
    }
    const views = [fallbackCard(source)];
    const tag = text(opts && opts.tag, 40);
    const api = resolverApi();
    const filtered = tag && api?.cardMatchesSmartViewTag
      ? views.filter(row => api.cardMatchesSmartViewTag(row, tag))
      : (tag
        ? views.filter(row => {
          const tags = (row.floqrPublicData && row.floqrPublicData.smartTags) || [];
          return tags.map(String).includes(tag.toLowerCase());
        })
        : views);
    return {
      ok: true,
      reason: "authorized-text",
      sourceKind: "authorized-text",
      geminiUsed: false,
      views: filtered
    };
  }

  function modeFromSearch(search) {
    const params = search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search || ""));
    const raw = String(params.get("mode") || "").toLowerCase();
    if (raw === "interactive" || raw === "headless") return raw;
    return params.get("q") ? "headless" : "interactive";
  }

  function queryFromSearch(search) {
    const params = search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search || ""));
    return text(params.get("q") || params.get("text") || "", MAX_INPUT);
  }

  function tagFromSearch(search) {
    const params = search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search || ""));
    return text(params.get("tag") || "", 40);
  }

  return {
    SCHEMA_VERSION,
    cardsFromAuthorizedText,
    clipAround,
    modeFromSearch,
    queryFromSearch,
    tagFromSearch
  };
});
