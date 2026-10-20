/* FLOQR venue Select routing — product intent from the search query drives the CTA.
 * One registry per feature: match patterns → label + URL (or inline ShoutOut callback).
 * Client routing is UX only; each landing page still enforces feature gates / Auth / callables.
 * Design: docs/FEATURE-WIRING.md (Search venue Select), FLOQR-TECHNICAL-BIBLE §8.3 / §11. */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FLOQRVenueActions = api;
})(typeof window !== "undefined" ? window : null, function (root) {
  "use strict";

  const VERSION = "s3.1.89";

  /** Venue-scoped product actions. Add a row when shipping a new feature that picks a club first. */
  const ACTIONS = Object.freeze([
    {
      id: "floqCast",
      featureKey: "floqCast",
      priority: 100,
      ctaKey: "listing.goFloqCast",
      ctaFallback: "Go floqCast",
      strip: [
        "floqcast", "floq cast", "floq-cast",
        "superstar", "super star", "super-star",
        "suprstar", "suprstr", "supr str", "supr star",
        "go live", "live stream", "livestream"
      ],
      patterns: [
        /floq\s*cast/, /floqcast/,
        /supr\s*str/, /suprstr/, /supr\s*star/, /suprstar/, /super\s*-?\s*star/, /superstar/,
        /make\s+me\s+(a\s+)?(floq\s*cast|floqcast|super\s*-?\s*star|superstar|suprstr|suprstar)/,
        /be(come)?\s+(a\s+)?(floq\s*cast|floqcast|super\s*-?\s*star|superstar|suprstar)/,
        /go\s+live/, /live\s*stream/, /stream\s+(to\s+)?(the\s+)?display/,
        /camera\s+to\s+(the\s+)?(club|venue|display)/, /broadcast\s+(live|myself|to)/
      ],
      buildUrl(locationId, extras = {}) {
        const params = {from: extras.from || "search", location: locationId};
        return root?.FLOQRNav?.stampCurrentVersion?.("./floqcast-search.html", params)
          || `./floqcast-search.html?from=search&location=${encodeURIComponent(locationId)}`;
      }
    },
    {
      id: "vipReservations",
      featureKey: "vipReservations",
      priority: 90,
      ctaKey: "listing.bookVipTable",
      ctaFallback: "Book VIP table",
      strip: [
        "vip reserv", "vipreserv", "vip table", "book a table", "book vip",
        "reserve a table", "table reservation", "vip booth", "bottle service"
      ],
      patterns: [
        /vip\s*reserv/, /vipreserv/, /vip\s*table/, /book\s+(a\s+)?(vip\s+)?table/,
        /reserve\s+(a\s+)?(vip\s+)?table/, /table\s+reservation/, /vip\s*booth/,
        /bottle\s+service\s+(book|reserv)/, /floor\s*map\s+(book|reserv)/
      ],
      buildUrl(locationId, extras = {}) {
        const params = {from: extras.from || "search", location: locationId};
        return root?.FLOQRNav?.stampCurrentVersion?.("./vip.html", params)
          || `./vip.html?from=search&location=${encodeURIComponent(locationId)}`;
      }
    },
    {
      id: "shoutout",
      featureKey: null,
      priority: 40,
      ctaKey: "listing.throwShoutoutHere",
      ctaFallback: "Throw ShoutOut Here",
      listingTypes: ["shoutout"],
      strip: ["shoutout", "shout out", "throw a shoutout", "led message", "message board"],
      patterns: [
        /shout\s*out/, /shoutout/, /throw\s+(a\s+)?shout/,
        /message\s*board/, /\bled\b/, /birthday\s+shout/, /congrats\s+shout/
      ],
      /** Inline composer — not a satellite URL. */
      mode: "shoutout"
    }
  ]);

  function normalize(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function scoreAction(action, q) {
    if (!q) return 0;
    let score = 0;
    (action.patterns || []).forEach((re) => {
      if (re.test(q)) score += 1;
    });
    (action.strip || []).forEach((phrase) => {
      const p = normalize(phrase);
      if (p && q.includes(p)) score += 0.5;
    });
    if (score > 0) score += (Number(action.priority) || 0) / 1000;
    return score;
  }

  function featureAllowed(featureKey) {
    if (!featureKey) return true;
    const FS = root?.FLOQRFeatureServices;
    try {
      if (typeof FS?.searchVisible === "function") return FS.searchVisible(featureKey) === true;
      if (typeof FS?.linkState === "function") return FS.linkState(featureKey, {surface: "search"}).show === true;
      if (typeof FS?.canAccess === "function") return FS.canAccess(featureKey) === true;
    } catch (_) {}
    return true; // fail open for UX when packs not loaded; destination Auth + gates still enforce
  }

  /**
   * Resolve which feature owns the Select CTA for this listing context.
   * @param {{query?:string, listingType?:string}} opts
   * @returns {{id:string, featureKey:string|null, mode:string, ctaKey:string, ctaFallback:string, buildUrl?:Function, action:object}|null}
   */
  function resolve({query = "", listingType = ""} = {}) {
    const type = String(listingType || "").trim();
    if (type.startsWith("club-action:")) {
      return {
        id: "club-action",
        featureKey: null,
        mode: "club-action",
        ctaKey: "listing.continue",
        ctaFallback: "Continue",
        action: null
      };
    }
    if (type === "shoutout") {
      const shout = ACTIONS.find((a) => a.id === "shoutout");
      return {
        id: shout.id,
        featureKey: null,
        mode: "shoutout",
        ctaKey: shout.ctaKey,
        ctaFallback: shout.ctaFallback,
        action: shout
      };
    }

    const q = normalize(query);
    let best = null;
    let bestScore = 0;
    ACTIONS.forEach((action) => {
      if (action.listingTypes?.includes(type)) {
        const forced = {action, score: 100 + (action.priority || 0)};
        if (forced.score > bestScore) {
          best = forced.action;
          bestScore = forced.score;
        }
        return;
      }
      const score = scoreAction(action, q);
      if (score > bestScore) {
        best = action;
        bestScore = score;
      }
    });

    if (!best || bestScore <= 0) {
      // Historical default for club browse: Select starts a ShoutOut (primary LED product).
      const shout = ACTIONS.find((a) => a.id === "shoutout");
      return {
        id: shout.id,
        featureKey: null,
        mode: "shoutout",
        ctaKey: "listing.select",
        ctaFallback: "Select",
        action: shout,
        defaulted: true
      };
    }

    if (best.featureKey && !featureAllowed(best.featureKey)) {
      return {
        id: "shoutout",
        featureKey: null,
        mode: "shoutout",
        ctaKey: "listing.select",
        ctaFallback: "Select",
        action: ACTIONS.find((a) => a.id === "shoutout"),
        gated: best.featureKey
      };
    }

    return {
      id: best.id,
      featureKey: best.featureKey || null,
      mode: best.mode || "navigate",
      ctaKey: best.ctaKey,
      ctaFallback: best.ctaFallback,
      buildUrl: best.buildUrl ? (locationId, extras) => best.buildUrl(locationId, extras) : null,
      action: best
    };
  }

  /** Remove feature cue words so venue name matching is not polluted (e.g. "floqcast aurelia" → "aurelia"). */
  function stripFeatureTokens(query) {
    let out = normalize(query);
    if (!out) return "";
    ACTIONS.forEach((action) => {
      (action.strip || []).forEach((phrase) => {
        const p = normalize(phrase);
        if (!p) return;
        out = out.replace(new RegExp(`\\b${p.replace(/\s+/g, "\\s+")}\\b`, "g"), " ");
      });
    });
    return out.replace(/\s+/g, " ").trim();
  }

  function ctaLabel(resolved, t) {
    const key = resolved?.ctaKey || "listing.select";
    const fallback = resolved?.ctaFallback || "Select";
    if (typeof t === "function") return t(key, {}, fallback);
    try {
      const out = root?.FLOQRI18n?.t?.(key);
      if (out && out !== key) return out;
    } catch (_) {}
    return fallback;
  }

  function navigateToVenue(resolved, locationId, extras = {}) {
    const id = String(locationId || "").trim();
    if (!id || !resolved) return false;
    if (resolved.mode === "navigate" && typeof resolved.buildUrl === "function") {
      const href = resolved.buildUrl(id, extras);
      if (href) {
        root.location.href = href;
        return true;
      }
    }
    return false;
  }

  return {
    VERSION,
    ACTIONS,
    resolve,
    stripFeatureTokens,
    ctaLabel,
    navigateToVenue,
    featureAllowed,
    normalize
  };
});
