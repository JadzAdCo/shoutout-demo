/* FLOQR ad campaign pricing — DOOH-informed packages. Server mirror: functions/ad-core.js (parity test).
 * Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc
 */
(function (root) {
  "use strict";

  const RUN_DAY_OPTIONS = [7, 14, 21, 31];
  const PRICE_TABLE_CENTS = {
    inline: {7: 4500, 14: 8500, 21: 12000, 31: 17000},
    minglGist: {7: 2500, 14: 4500, 21: 6500, 31: 9000}
  };

  const PLACEMENTS = {
    inline: {
      id: "inline",
      label: "Inline advertisement",
      shortLabel: "Inline",
      description: "Shows while a patron is using a FloqR feature (the Search loading splash, RydR, club actions, Mingl people grid).",
      priceCents: 4500,
      flightDays: 7,
      slots: ["default", "clubs", "events", "lounges", "lounge-club", "beach-clubs", "shoutout", "rydr", "mingl"],
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

  function priceFor(placementId, runDays) {
    const table = PRICE_TABLE_CENTS[placementId];
    return (table && table[Number(runDays)]) || 0;
  }

  function priceLabel(cents) {
    const n = Number(cents || 0) / 100;
    return `$${n.toFixed(n % 1 ? 2 : 0)}`;
  }

  function packageFor(placementId, runDays) {
    const row = placement(placementId);
    if (!row) return null;
    const days = RUN_DAY_OPTIONS.includes(Number(runDays)) ? Number(runDays) : row.flightDays;
    const cents = priceFor(placementId, days);
    return {
      ...row,
      priceCents: cents,
      flightDays: days,
      priceLabel: priceLabel(cents),
      packageLabel: `${priceLabel(cents)} / ${days} days`
    };
  }

  root.FLOQRAdPricing = {
    PLACEMENTS,
    RUN_DAY_OPTIONS,
    PRICE_TABLE_CENTS,
    placement,
    priceFor,
    packageFor,
    priceLabel,
    VERSION: "s3.1.0"
  };
})(typeof window !== "undefined" ? window : globalThis);
