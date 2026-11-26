#!/usr/bin/env node
"use strict";
/* Build smartvisuals/registry.json from kit SVGs + taxonomy.
   Run: node scripts/build-smartvisuals-registry.js */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "smartvisuals");
const KIT = "/cursor/stores/self/internal/FLOQR_SMART_Visual_Kit/asset-manifest.json";

const LICENSE = "Original FLOQR illustration for project use. Not a photograph, trademark, or official destination graphic.";
const CREATOR = "FLOQR SMARTvisuals starter kit";
const SOURCE = "original programmatically authored illustration";

const PLACE_ALIASES = {
  cancun: {placeId: "cancun", backgroundId: "bg-bali", stencilId: "st-flight", tags: ["travel", "beach", "destination:cancun"]},
  "cancún": {placeId: "cancun", backgroundId: "bg-bali", stencilId: "st-flight", tags: ["travel", "beach", "destination:cancun"]},
  "san dego": {placeId: "san-diego", backgroundId: "bg-san-diego", stencilId: "st-location", tags: ["city", "destination:san-diego"]},
  "san diego": {placeId: "san-diego", backgroundId: "bg-san-diego", stencilId: "st-location", tags: ["city", "destination:san-diego"]},
  burningman: {placeId: "burning-man", backgroundId: "bg-burning-man", stencilId: "st-celebration", tags: ["event", "festival"], officialAffiliation: false},
  "burning man": {placeId: "burning-man", backgroundId: "bg-burning-man", stencilId: "st-celebration", tags: ["event", "festival"], officialAffiliation: false}
};

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function svgSize(xml) {
  const vb = /viewBox=["']([^"']+)["']/.exec(xml);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length === 4) return {width: p[2], height: p[3]};
  }
  return {width: 0, height: 0};
}

function loadKit() {
  if (!fs.existsSync(KIT)) return {backgrounds: [], stencils: []};
  return JSON.parse(fs.readFileSync(KIT, "utf8"));
}

function stencilMeta(id) {
  return {
    flight: {name: "Flight", category: "travel", tags: ["flight", "travel", "airplane", "trip"], aliases: ["plane", "airplane", "airport"]},
    train: {name: "Train", category: "travel", tags: ["train", "travel", "rail"], aliases: ["railway"]},
    hotel: {name: "Hotel", category: "hotel", tags: ["hotel", "stay"], aliases: ["lodging"]},
    beach: {name: "Beach", category: "beach", tags: ["beach", "travel", "tropical"], aliases: ["shore", "coast"]},
    restaurant: {name: "Dining", category: "dining", tags: ["dining", "restaurant", "dinner"], aliases: ["food", "eat"]},
    nightclub: {name: "Nightclub", category: "nightclub", tags: ["nightclub", "club", "nightlife"], aliases: ["club", "vip"]},
    music: {name: "Music", category: "event", tags: ["music", "concert"], aliases: ["dj"]},
    ticket: {name: "Ticket", category: "event", tags: ["ticket", "event"], aliases: ["tickets"]},
    calendar: {name: "Calendar", category: "planning", tags: ["calendar", "planning", "schedule"], aliases: ["date"]},
    people: {name: "People", category: "people", tags: ["people", "mingl", "room"], aliases: ["group", "friends"]},
    reservation: {name: "Reservation", category: "planning", tags: ["reservation", "planning"], aliases: ["rsvp", "book"]},
    sports: {name: "Sports", category: "sports", tags: ["sports", "game"], aliases: ["match"]},
    fashion: {name: "Fashion", category: "fashion", tags: ["fashion", "runway", "event"], aliases: ["runway", "couture"]},
    shopping: {name: "Shopping", category: "shopping", tags: ["shopping"], aliases: ["retail"]},
    camera: {name: "Camera", category: "media", tags: ["camera", "photo"], aliases: ["photos"]},
    car: {name: "Car", category: "travel", tags: ["car", "road-trip", "travel"], aliases: ["drive", "roadtrip"]},
    cruise: {name: "Cruise", category: "travel", tags: ["cruise", "travel"], aliases: ["ship"]},
    celebration: {name: "Celebration", category: "event", tags: ["celebration", "festival"], aliases: ["party", "festival"]},
    meeting: {name: "Meeting", category: "meeting", tags: ["meeting", "planning"], aliases: ["work", "office"]},
    shoutout: {name: "ShoutOut", category: "shoutout", tags: ["shoutout"], aliases: ["shout out"]},
    ai: {name: "BOT DEE", category: "service", tags: ["botdee", "ai"], aliases: ["bot-dee", "floqai"]},
    payments: {name: "Payments", category: "service", tags: ["payments"], aliases: ["pay"]},
    route: {name: "Route", category: "travel", tags: ["route", "travel", "itinerary"], aliases: ["itinerary", "map"]},
    fireworks: {name: "Fireworks", category: "event", tags: ["fireworks", "celebration"], aliases: []},
    art: {name: "Art", category: "art", tags: ["art"], aliases: ["gallery"]},
    location: {name: "Location", category: "city", tags: ["location", "city", "place"], aliases: ["place", "destination"]}
  }[id] || {name: id, category: "neutral", tags: [id], aliases: []};
}

function backgroundMeta(row) {
  const id = row.id;
  const extra = {
    "paris-fashion-week": {placeId: "paris", tags: ["paris", "fashion", "event", "runway"], aliases: ["pfw", "paris fashion week"]},
    "milan-fashion-week": {placeId: "milan", tags: ["milan", "fashion", "event", "runway"], aliases: ["mfw"]},
    "london-fashion-week": {placeId: "london", tags: ["london", "fashion", "event", "runway"], aliases: ["lfw"]},
    "new-york-fashion-week": {placeId: "new-york", tags: ["new-york", "fashion", "event", "runway"], aliases: ["nyfw"]},
    "burning-man": {placeId: "burning-man", tags: ["burning-man", "festival", "event"], aliases: ["burningman"], officialAffiliation: false},
    flight: {placeId: null, tags: ["flight", "travel", "airplane"], aliases: ["plane", "airport"]},
    train: {placeId: null, tags: ["train", "travel"], aliases: []},
    "road-trip": {placeId: null, tags: ["road-trip", "travel", "car"], aliases: ["roadtrip", "drive"]},
    cruise: {placeId: null, tags: ["cruise", "travel"], aliases: []},
    dining: {placeId: null, tags: ["dining", "restaurant"], aliases: ["dinner", "food"]},
    concert: {placeId: null, tags: ["concert", "event", "music"], aliases: []},
    "sports-event": {placeId: null, tags: ["sports", "event"], aliases: ["game"]},
    "hotel-stay": {placeId: null, tags: ["hotel", "stay"], aliases: ["lodging"]},
    shoutout: {placeId: null, tags: ["shoutout"], aliases: []},
    "mingl-room": {placeId: null, tags: ["mingl", "people", "room", "neutral"], aliases: ["group chat"]},
    "vip-nightlife": {placeId: null, tags: ["vip", "nightlife", "nightclub"], aliases: ["vip reserv"]},
    bali: {placeId: "bali", tags: ["bali", "beach", "tropical", "travel"], aliases: ["cancun", "caribbean"]},
    thailand: {placeId: "thailand", tags: ["thailand", "beach", "tropical", "travel"], aliases: []},
    miami: {placeId: "miami", tags: ["miami", "beach", "city"], aliases: []},
    ibiza: {placeId: "ibiza", tags: ["ibiza", "nightclub", "beach"], aliases: []},
    cancun: {placeId: "cancun", tags: ["cancun", "travel", "beach"], aliases: []}
  }[id] || {};
  const placeId = extra.placeId !== undefined ? extra.placeId : id;
  return {
    name: row.title || id,
    category: row.category || "city",
    tags: extra.tags || row.tags || [id],
    aliases: extra.aliases || [String(row.title || id).toLowerCase()],
    placeId,
    pairedStencilId: path.basename(row.stencil || "stencils/location.svg", ".svg"),
    officialAffiliation: extra.officialAffiliation === false ? false : null
  };
}

function assetRecord({id, type, file, extra}) {
  const abs = path.join(DIR, file);
  const xml = fs.readFileSync(abs, "utf8");
  const buf = fs.readFileSync(abs);
  const dim = svgSize(xml);
  return {
    id,
    type,
    name: extra.name,
    description: extra.description || `${extra.name} SMARTvisual ${type} (original illustration).`,
    category: extra.category,
    tags: extra.tags,
    placeId: extra.placeId || null,
    aliases: extra.aliases || [],
    license: LICENSE,
    creator: CREATOR,
    sourceUrl: `./smartvisuals/${file}`,
    attribution: SOURCE,
    approvalStatus: "published",
    revision: 1,
    checksum: sha256(buf),
    dimensions: dim,
    mime: "image/svg+xml",
    path: `smartvisuals/${file}`,
    bytes: buf.length,
    intendedSurfaces: ["smartNotification", "roomSmartView", "peopleSmartView", "placeSmartView", "studioPreview"],
    pairedStencilId: extra.pairedStencilId || null,
    photographic: false,
    officialAffiliation: extra.officialAffiliation === false ? false : null
  };
}

function main() {
  const kit = loadKit();
  const backgrounds = (kit.backgrounds || []).map(row => {
    const extra = backgroundMeta(row);
    extra.description = `${extra.name} scenic SMARTbackground. Original illustration — not a photograph or official destination graphic.`;
    return assetRecord({
      id: `bg-${row.id}`,
      type: "background",
      file: `backgrounds/${row.id}.svg`,
      extra: {...extra, placeId: extra.placeId}
    });
  });
  const stencils = (kit.stencils || []).map(row => {
    const extra = stencilMeta(row.id);
    extra.description = `${extra.name} SMARTstencil. Monochrome currentColor icon; not a user identity.`;
    extra.placeId = null;
    extra.pairedStencilId = null;
    return assetRecord({
      id: `st-${row.id}`,
      type: "stencil",
      file: `stencils/${row.id}.svg`,
      extra
    });
  });

  const registry = {
    schemaVersion: "floqr.smartVisuals/1",
    revision: 1,
    generatedAt: new Date().toISOString(),
    source: "FLOQR_SMART_Visual_Kit v2",
    licenseNote: LICENSE,
    counts: {backgrounds: backgrounds.length, stencils: stencils.length},
    taxonomy: {
      categories: [...new Set([...backgrounds, ...stencils].map(a => a.category))].sort(),
      placeAliases: PLACE_ALIASES,
      collisionRule: "two-or-more-distinct-placeIds-without-travel-connector → ambiguous → neutral",
      confidenceThreshold: 0.78,
      typoThreshold: 0.86,
      geminiOnView: false,
      defaultDenyUnapproved: true,
      neutral: {backgroundId: "bg-mingl-room", stencilId: "st-people", reasonCode: "neutral-fallback"}
    },
    assets: [...backgrounds, ...stencils]
  };

  const out = path.join(DIR, "registry.json");
  fs.writeFileSync(out, JSON.stringify(registry, null, 2) + "\n");
  const catalog = {
    schemaVersion: registry.schemaVersion,
    revision: registry.revision,
    taxonomy: registry.taxonomy,
    assets: registry.assets.map(a => ({
      id: a.id,
      type: a.type,
      name: a.name,
      category: a.category,
      tags: a.tags,
      placeId: a.placeId,
      aliases: a.aliases,
      approvalStatus: a.approvalStatus,
      path: a.path,
      checksum: a.checksum,
      pairedStencilId: a.pairedStencilId,
      officialAffiliation: a.officialAffiliation
    }))
  };
  fs.writeFileSync(path.join(DIR, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Wrote ${out} (${registry.counts.backgrounds} backgrounds, ${registry.counts.stencils} stencils)`);
}

main();
