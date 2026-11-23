/* VIP reserV SMARTview — BOT DEE collection preview of a headless hold.
   Optional UI; headless-vip-core never requires this module. */
"use strict";

const vip = require("./headless-vip-core");

const SCHEMA_VERSION = "floqr.botDeeVipSmartView/1";
const KIND = "botDeeVip";

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function suggestionPrompts(draft = {}) {
  const row = vip.clipInteractiveDraft(draft);
  const chips = (row.matches || []).slice(0, 8).map(item => ({
    id: item.id,
    prompt: item.label,
    group: "section"
  }));
  if (!chips.length) {
    chips.push(
      {id: "mezzanine", prompt: "Mezzanine", group: "section"},
      {id: "v1", prompt: "V1", group: "section"}
    );
  }
  chips.push({id: "tonight", prompt: "tonight", group: "night"});
  chips.push({id: "party2", prompt: "2 guests", group: "party"});
  chips.push({id: "party4", prompt: "4 guests", group: "party"});
  chips.push({id: "hold", prompt: "hold it", group: "hold"});
  chips.push({id: "terms", prompt: "I agree", group: "terms"});
  chips.push({id: "cancel", prompt: "cancel", group: "cancel"});
  return chips;
}

function buildVipSmartView(opts = {}) {
  const options = opts && typeof opts === "object" ? opts : {};
  const draft = vip.clipInteractiveDraft(options.draft);
  const needs = Array.isArray(options.needs) ? options.needs : vip.interactiveNeeds(draft);
  const mode = text(options.mode, 24) || (draft.holdId ? "hold" : (needs.length ? "draft" : "ready"));
  const floor = options.floor && typeof options.floor === "object" ? options.floor : null;
  const nightMeta = Array.isArray(floor?.bookableNights)
    ? floor.bookableNights.map(row => ({
      night: row.night,
      iso: row.night,
      open: true,
      hours: row.label || ""
    }))
    : [];
  if (floor && floor.nightOpen === false) {
    nightMeta.push({night: draft.night, iso: draft.night, open: false, closed: true});
  }
  const nights = vip.nightOptions(draft.night, 7, nightMeta);
  if (Array.isArray(floor?.bookableNights) && floor.bookableNights.length) {
    const open = new Set(floor.bookableNights.map(row => String(row.night || "")));
    nights.forEach(row => {
      if (!open.has(row.iso)) row.closed = true;
    });
  }
  let map = vip.mapLiteForClub(draft.clubQuery, draft);
  if (map && Array.isArray(floor?.sections)) map = vip.applyFloorStatus(map, floor.sections);
  const mapFull = vip.mapLiteForClub(draft.clubQuery, draft, {full: true});
  const fullMap = mapFull && Array.isArray(floor?.sections)
    ? vip.applyFloorStatus(mapFull, floor.sections)
    : mapFull;
  const venues = vip.listBookableVenues();
  const maxCapacity = Math.max(0, Math.floor(Number(draft.maxCapacity || options.maxCapacity) || 0));
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: KIND,
    generatedAtIso: new Date().toISOString(),
    mode,
    venueName: text(options.venueName || vip.clubDisplayName(draft.clubQuery) || draft.clubQuery, 80),
    clubLocationId: text(draft.clubQuery, 120),
    night: text(draft.night, 12),
    nightOpen: floor && typeof floor.nightOpen === "boolean" ? floor.nightOpen : true,
    sectionId: text(draft.sectionId, 80),
    sectionLabel: text(draft.sectionLabel || draft.sectionQuery, 80),
    partySize: draft.partySize || 0,
    maxCapacity,
    holdId: text(draft.holdId, 80),
    consentId: text(draft.consentId, 80),
    holdExpiresAtMs: Math.max(0, Math.floor(Number(options.holdExpiresAtMs || draft.holdExpiresAtMs) || 0)),
    checkoutUrl: text(options.checkoutUrl, 500),
    passHref: text(options.passHref, 200),
    reservationId: text(options.reservationId, 80),
    needs,
    matches: draft.matches || [],
    venues,
    nights,
    map,
    mapFull: fullMap,
    collapsed: mode === "ready" || mode === "hold" ? !!draft.sectionId : false,
    termsTitle: "VIP reserV Terms of use (beta)",
    termsSummary: "I agree records VIP Terms consent and opens Stripe in a pop-out. BOT DEE never takes card numbers. This chat stays here.",
    suggestions: suggestionPrompts(draft),
    surface: text(options.surface, 24) || "bubble"
  };
}

module.exports = {
  SCHEMA_VERSION,
  KIND,
  suggestionPrompts,
  buildVipSmartView
};
