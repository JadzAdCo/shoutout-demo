/* FLOQR ad campaign pricing — DOOH-informed packages.
 * Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc
 */
(function (root) {
  "use strict";

  const PLACEMENTS = {
    inline: {
      id: "inline",
      label: "Inline advertisement",
      shortLabel: "Inline",
      description: "Shows while a patron is using a FloqR feature (Search, RydR, club actions, Mingl people grid).",
      priceCents: 4500,
      flightDays: 7,
      slots: ["default", "clubs", "events", "lounges", "lounge-club", "shoutout", "rydr", "mingl"],
      justification: "Comparable to mid-market DOOH interstitial CPM (~$12–18). High attention because the ad interrupts a feature path."
    },
    minglGist: {
      id: "minglGist",
      label: "Mingl Gist advertisement",
      shortLabel: "Mingl Gist",
      description: "Shows in the Mingl Gist story / scroll feed while patrons browse stories.",
      priceCents: 2500,
      flightDays: 7,
      slots: ["mingl-gist", "mingl"],
      justification: "Comparable to social/feed native CPM (~$6–10). Lower interrupt, higher scroll volume than inline."
    }
  };

  function placement(id) {
    return PLACEMENTS[id] || null;
  }

  function priceLabel(cents) {
    const n = Number(cents || 0) / 100;
    return `$${n.toFixed(n % 1 ? 2 : 0)}`;
  }

  function packageFor(placementId) {
    const row = placement(placementId);
    if (!row) return null;
    return {
      ...row,
      priceLabel: priceLabel(row.priceCents),
      packageLabel: `${priceLabel(row.priceCents)} / ${row.flightDays} days`
    };
  }

  root.FLOQRAdPricing = {
    PLACEMENTS,
    placement,
    packageFor,
    priceLabel,
    VERSION: "s3.0.76"
  };
})(typeof window !== "undefined" ? window : globalThis);
