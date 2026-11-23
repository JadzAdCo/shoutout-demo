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
  const SPAAVS_SAMPLE =
    "SPAAVS should budget for becoming an approved Mobility Hub infrastructure and integration partner, rather than assume it must manufacture autonomous docking equipment or operate its own Robotaxi fleet.";

  const INJECTION = [
    /ignore (?:previous|all) instructions/i,
    /system prompt/i,
    /<\/?script\b/i,
    /javascript:/i,
    /https?:\/\/\S+/i,
    /data:text\/html/i
  ];

  const ENTITY_RULES = [
    {id: "spaavs", re: /\bSPAAVS\b/, kind: "product", title: "SPAAVS"},
    {id: "mobility-hub", re: /\bMobility Hub\b/i, kind: "travel", title: "Mobility Hub"},
    {id: "docking", re: /\bautonomous docking equipment\b/i, kind: "product", title: "Autonomous docking equipment"},
    {id: "robotaxi", re: /\bRobotaxi(?:\s+fleet)?\b/, kind: "vehicle", title: "Robotaxi fleet"}
  ];

  function text(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || MAX_INPUT);
  }

  function injectionHit(raw) {
    return INJECTION.some(re => re.test(raw));
  }

  function clipAround(source, match, max) {
    const hay = String(source || "");
    const needle = String(match || "");
    const idx = hay.indexOf(needle);
    if (idx < 0) return text(hay, max);
    const pad = Math.max(24, Math.floor((max - needle.length) / 2));
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
    let clip = hay.slice(start, end).trim();
    if (start > 0) clip = clip.replace(/^[,.;:–—-]+\s*/, "");
    if (end < hay.length) clip = `${clip.replace(/[,.;:–—-]+$/, "")}…`;
    return text(clip, max);
  }

  function cardPayload({kind, title, summary}) {
    return {
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
    };
  }

  function extractEntities(source) {
    const views = [];
    const seen = new Set();
    ENTITY_RULES.forEach(rule => {
      const hit = source.match(rule.re);
      if (!hit) return;
      const key = `${rule.kind}:${rule.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      views.push(cardPayload({
        kind: rule.kind,
        title: rule.title,
        summary: clipAround(source, hit[0], SUMMARY_MAX)
      }));
    });
    return views;
  }

  function fallbackCard(source) {
    const words = source.split(" ").slice(0, 8).join(" ");
    return cardPayload({
      kind: "product",
      title: text(words, 80) || "Authorized text",
      summary: text(source, SUMMARY_MAX)
    });
  }

  function cardsFromAuthorizedText(raw) {
    const source = text(raw, MAX_INPUT);
    if (!source) {
      return {ok: false, reason: "empty-text", geminiUsed: false, views: []};
    }
    if (injectionHit(source)) {
      return {ok: false, reason: "prompt-injection-ignored", geminiUsed: false, views: []};
    }
    const views = extractEntities(source);
    if (!views.length) views.push(fallbackCard(source));
    return {
      ok: true,
      reason: "authorized-text",
      sourceKind: "authorized-text",
      geminiUsed: false,
      views
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

  return {
    SCHEMA_VERSION,
    SPAAVS_SAMPLE,
    cardsFromAuthorizedText,
    modeFromSearch,
    queryFromSearch
  };
});
