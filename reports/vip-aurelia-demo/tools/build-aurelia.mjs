// Builds aurelia.json (floqr.vipFloorPlan/2 + demo extensions) and plan.svg from a metric layout.
// Run: node reports/vip-aurelia-demo/tools/build-aurelia.mjs
import {writeFileSync, readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {renderPlanSvg, LEGEND} from "../plan-svg.mjs";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOM_W = 32, ROOM_D = 22, PX_PER_M = 50; // metres; virtual plan image 1600×1100
const IMG_W = ROOM_W * PX_PER_M, IMG_H = ROOM_D * PX_PER_M;
const r4 = n => Math.round(n * 10000) / 10000;
const ID = s => `aurelia-${String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function rectM(x, z, w, d) {
  const rect = {x: r4(x / ROOM_W), y: r4(z / ROOM_D), w: r4(w / ROOM_W), h: r4(d / ROOM_D)};
  return {
    shape: "rect", rect, circle: null,
    polygon: [[rect.x, rect.y], [r4(rect.x + rect.w), rect.y], [r4(rect.x + rect.w), r4(rect.y + rect.h)], [rect.x, r4(rect.y + rect.h)]],
    bounds: {...rect},
    pixelBox: [Math.round(x * PX_PER_M), Math.round(z * PX_PER_M), Math.round((x + w) * PX_PER_M) - 1, Math.round((z + d) * PX_PER_M) - 1],
    meters: {x, z, w, d}
  };
}
function circleM(cx, cz, r) {
  const g = rectM(cx - r, cz - r, 2 * r, 2 * r);
  return {...g, shape: "circle", circle: {cx: r4(cx / ROOM_W), cy: r4(cz / ROOM_D), rx: r4(r / ROOM_W), ry: r4(r / ROOM_D)}, polygon: [], meters: {...g.meters, cx, cz, r}};
}
const usd = (dollars, extra = {}) => dollars == null ? null : {amountCents: dollars * 100, currency: "USD", placeholder: false, demo: true, ...extra};

// Demo price book (USD, Washington DC nightlife ranges; not a real venue quote).
const TIERS = {
  booth: {typeLabel: "Booth", maxCapacity: 8, includedGuests: 6, min: 1000, extra: 50, deposit: 250, description: "Curved velvet booth on the west wall, sightline to the DJ."},
  round: {typeLabel: "Round table", maxCapacity: 6, includedGuests: 4, min: 600, extra: 40, deposit: 150, description: "Round lounge table between the booths and the dance floor."},
  table: {typeLabel: "High-top", maxCapacity: 4, includedGuests: 4, min: 350, extra: null, deposit: 100, description: "High-top on the dance-floor rail."},
  standing: {typeLabel: "Standing table", maxCapacity: 4, includedGuests: 2, min: 250, extra: 30, deposit: 50, description: "Standing cocktail table near the main bar."},
  vipTable: {typeLabel: "VIP table", maxCapacity: 10, includedGuests: 8, min: 2000, extra: 75, deposit: 500, description: "Raised VIP table on the mezzanine with dedicated host and bottle service."},
  vipArea: {typeLabel: "VIP area (whole)", maxCapacity: 20, includedGuests: 15, min: 5000, extra: 100, deposit: 1500, description: "The Aurelia Suite: private mezzanine lounge for up to 20, own host, sparkler presentation."}
};

const AREAS = [
  {key: "a", defaultName: "Area A · West Booths", type: "area", box: [0.3, 3.0, 3.9, 14.3], photos: [["main-room.jpg", "high", "Curved black booths with ice buckets in the foreground match the west booths."]]},
  {key: "b", defaultName: "Area B · Dance Floor", type: "floorZone", box: [4.6, 0.4, 17.2, 15.2], photos: [["dj-booth.jpg", "high", "Resident DJ booth facing the floor (club staff photo)."], ["portrait-led-wall.jpg", "high", "Portrait LED wall behind the DJ booth."], ["main-room.jpg", "medium", "Chandeliers and light show over the floor."]]},
  {key: "c", defaultName: "Area C · VIP Mezzanine", type: "vipArea", box: [24.0, 0.3, 7.7, 17.2], photos: [["vip-room.jpg", "high", "Red tufted VIP banquettes with champagne on ice."], ["bottle-service.jpg", "high", "Sparkler bottle presentation in the VIP room (club staff photo)."]]},
  {key: "d", defaultName: "Area D · Bar Lounge", type: "area", box: [4.4, 15.8, 17.6, 6.1], photos: [["bar.jpg", "high", "Main bar champagne tower under the chandeliers (club staff photo)."], ["entrance.jpg", "medium", "Red-carpet entrance and host stand leading into the lounge."]]}
];

// [label, tier, area, geometry(m), demoState?]
const S = [];
["B1", "B2", "B3", "B4", "B5", "B6"].forEach((l, i) => S.push([l, "booth", "a", rectM(0.6, 3.4 + i * 2.3, 3.0, 2.0), l === "B3" ? "booked" : null]));
[[6.2, 5.0], [9.0, 5.0], [6.2, 8.5], [9.0, 8.5], [6.2, 12.0], [9.0, 12.0]].forEach(([x, z], i) => S.push([`R${i + 1}`, "round", "b", circleM(x, z, 1.0), i === 1 ? "held" : null]));
[11.5, 14.0, 16.5, 19.0].forEach((x, i) => S.push([`T${i + 1}`, "table", "b", rectM(x, 13.6, 1.4, 1.4), i === 0 ? "booked" : null]));
[11.5, 14.2, 16.9, 19.6].forEach((x, i) => S.push([`L${i + 1}`, "standing", "d", circleM(x + 0.6, 17.0, 0.6), i === 1 ? "held" : null]));
[1.0, 4.0, 7.0, 10.0].forEach((z, i) => S.push([`V${i + 1}`, "vipTable", "c", rectM(28.6, z, 2.8, 2.4), i === 1 ? "booked" : null]));
S.push(["AURELIA SUITE", "vipArea", "c", rectM(24.6, 1.0, 3.4, 6.0), null]);

// [label, name, type, area, geometry, reason]
const N = [
  ["DJ BOOTH", "DJ booth", "djBooth", "b", rectM(13.5, 0.6, 5.0, 2.2), "DJ booth with portrait LED wall behind it — never bookable."],
  ["DANCE FLOOR", "Dance floor", "walkway", "b", rectM(11.0, 4.0, 10.0, 8.6), "Open dance floor — keep clear."],
  ["BAR", "Main bar", "bar", "d", rectM(11.0, 19.4, 10.0, 2.3), "Main bar (service only)."],
  ["VIP BAR", "VIP bar", "bar", "c", rectM(28.6, 13.6, 2.8, 3.0), "Mezzanine service bar."],
  ["ENTRANCE", "Entrance & host stand", "entrance", "d", rectM(4.6, 18.4, 5.0, 3.4), "Red-carpet entrance, ID check and host stand."],
  ["COAT CHECK", "Coat check", "coatCheck", null, rectM(0.4, 18.4, 3.4, 3.4), "Coat check."],
  ["RESTROOMS", "Restrooms", "restroom", "a", rectM(0.4, 0.4, 4.0, 2.3), "Restrooms."],
  ["STAIRS", "Stairs to mezzanine", "stairs", "c", rectM(22.2, 13.5, 1.7, 4.0), "Stairs up to the VIP mezzanine (+1.2 m)."],
  ["EXIT N", "Emergency exit (north)", "exit", "b", rectM(6.0, 0.05, 2.0, 0.6), "Emergency exit — keep clear."],
  ["EXIT E", "Emergency exit (east)", "exit", null, rectM(30.9, 19.2, 1.0, 2.0), "Emergency exit — keep clear."]
];

const photoEntry = ([file, confidence, note]) => {
  const meta = JSON.parse(readFileSync(join(DIR, "photos", "photos.json"), "utf8")).find(p => p.file === file);
  return {file: `photos/${file}`, sourceMediaUrl: meta.sourceMediaUrl, title: meta.title, match: confidence, note};
};

const areas = AREAS.map(a => {
  const [x, z, w, d] = a.box;
  const g = rectM(x, z, w, d);
  const pad = 0.6;
  const vx = Math.max(0, x - pad), vz = Math.max(0, z - pad);
  const vb = rectM(vx, vz, Math.min(ROOM_W, x + w + pad) - vx, Math.min(ROOM_D, z + d + pad) - vz);
  return {
    id: ID(`area-${a.key}`), label: null, defaultName: a.defaultName, name: a.defaultName, nameEditable: true,
    nameSetByUid: null, nameSetAtMs: null, type: a.type, shape: "rect", pixelBox: g.pixelBox, rect: g.rect, polygon: g.polygon,
    bounds: g.bounds, viewBox: vb.rect, viewPixelBox: vb.pixelBox,
    sectionIds: S.filter(s => s[2] === a.key).map(s => ID(s[0])),
    nonBookableIds: N.filter(n => n[3] === a.key).map(n => ID(n[0])),
    photos: a.photos.map(photoEntry)
  };
});

const sections = S.map(([label, tier, areaKey, g, demoState]) => {
  const t = TIERS[tier];
  return {
    id: ID(label), label, type: tier, typeLabel: t.typeLabel, bookable: true, areaId: ID(`area-${areaKey}`),
    shape: g.shape, rect: g.rect, polygon: g.polygon, circle: g.circle, bounds: g.bounds, pixelBox: g.pixelBox, meters: g.meters,
    elevationM: areaKey === "c" ? 1.2 : 0,
    maxCapacity: t.maxCapacity, includedGuests: t.includedGuests, capacityPlaceholder: false, capacityDemo: true,
    minimumAmount: usd(t.min), extraGuestFee: t.extra == null ? null : usd(t.extra, {per: "guest", label: "VIP entry fee per extra guest"}),
    deposit: usd(t.deposit), isAccessible: areaKey !== "c", description: t.description,
    demoState: demoState || "available", photos: []
  };
});

const nonBookable = N.map(([label, name, type, areaKey, g, reason]) => ({
  id: ID(label), label, name, type, state: type === "djBooth" ? "djBooth" : "notBookable", bookable: false,
  areaId: areaKey ? ID(`area-${areaKey}`) : null, reason, shape: g.shape, rect: g.rect, bounds: g.bounds, pixelBox: g.pixelBox, meters: g.meters,
  elevationM: areaKey === "c" && type === "bar" ? 1.2 : 0
}));

const byType = sections.reduce((m, s) => ({...m, [s.type]: (m[s.type] || 0) + 1}), {});
const demoStates = sections.reduce((m, s) => ({...m, [s.demoState]: (m[s.demoState] || 0) + 1}), {});

const plan = {
  schemaVersion: "floqr.vipFloorPlan/2",
  status: "review",
  demo: true,
  demoNote: "DEMO for Aurelia (Demo Club). Modeled layout inspired by the club's public FloqR photos — not a survey, not photogrammetry. Prices and capacities are demo values (demo:true).",
  venue: {name: "Aurelia (Demo Club)", city: "Washington, DC", country: "US", clubLocationIdHint: "temp-democlub-1", eventId: null,
    note: "Firestore clubLocations/temp-democlub-1 currently lists New York as city/address (seed data); the demo follows the owner's Washington, DC description."},
  image: {file: "plan.svg", widthPx: IMG_W, heightPx: IMG_H, source: "Generated by tools/build-aurelia.mjs (modeled from photos, Oct 15 2026)", sha256: null},
  legendRef: "../vip-floorplans/legend.json",
  coordinateSystem: "Normalized 0–1 of the 1600×1100 plan; origin top-left (north up); rect = {x,y,w,h}; circle = {cx,cy,rx,ry}; pixelBox inclusive. Demo extension: meters {x,z,w,d} with room 32 m × 22 m for the 3D model.",
  model3d: {
    roomWidthM: ROOM_W, roomDepthM: ROOM_D, wallHeightM: 6, eyeHeightM: 1.65,
    mezzanine: {elevationM: 1.2, rect: rectM(24.0, 0.3, 7.7, 17.2).rect, meters: {x: 24.0, z: 0.3, w: 7.7, d: 17.2}},
    doors: [
      {id: "door-main", kind: "entrance", label: "Main entrance", ...pick(rectM(5.0, 21.6, 3.5, 0.4))},
      {id: "door-exit-n", kind: "exit", label: "Exit N", ...pick(rectM(6.0, 0.0, 2.0, 0.3))},
      {id: "door-exit-e", kind: "exit", label: "Exit E", ...pick(rectM(31.7, 19.2, 0.3, 2.0))}
    ],
    wallPhotos: [
      {photo: "photos/portrait-led-wall.jpg", wall: "north", centerM: 16.0, widthM: 3.2, heightM: 4.8, bottomM: 1.2, label: "Portrait LED wall"},
      {photo: "photos/dj-booth.jpg", wall: "north", centerM: 10.8, widthM: 3.0, heightM: 3.0, bottomM: 2.4, label: "Resident DJ"},
      {photo: "photos/main-room.jpg", wall: "west", centerM: 9.0, widthM: 6.0, heightM: 4.0, bottomM: 2.0, label: "Main room"},
      {photo: "photos/bar.jpg", wall: "south", centerM: 16.0, widthM: 3.4, heightM: 3.4, bottomM: 2.2, label: "Back bar"},
      {photo: "photos/entrance.jpg", wall: "south", centerM: 2.1, widthM: 3.4, heightM: 2.3, bottomM: 2.6, label: "Entrance"},
      {photo: "photos/vip-room.jpg", wall: "east", centerM: 6.0, widthM: 5.4, heightM: 3.6, bottomM: 2.6, label: "VIP room"},
      {photo: "photos/bottle-service.jpg", wall: "east", centerM: 13.0, widthM: 3.0, heightM: 3.0, bottomM: 2.8, label: "Bottle service"}
    ]
  },
  areas, sections, nonBookable,
  ignoredArtifacts: [],
  openQuestions: [
    "DEMO: a real Aurelia plan needs the club's own drawing or a 360°/photo walk-through; this layout is modeled.",
    "Confirm area names (defaults shown; nameEditable).",
    "Confirm capacities, included guests, minimums, VIP entry fee per extra guest and deposits (all demo values).",
    "Is the mezzanine step-free? Mezzanine tables are marked not accessible until confirmed.",
    "Confirm exit positions with the venue's fire plan."
  ],
  counts: {
    bookableSections: sections.length, byType, areas: areas.length, nonBookable: nonBookable.length,
    djBooths: nonBookable.filter(n => n.type === "djBooth").length,
    maxCapacityTotalPlaceholder: sections.reduce((n, s) => n + s.maxCapacity, 0),
    includedGuestsTotalPlaceholder: sections.reduce((n, s) => n + s.includedGuests, 0),
    demoStates
  }
};
function pick(g) { return {rect: g.rect, meters: g.meters}; }

// ---- validations (same rules as vip-floorplan-ingest) ----
const errors = [];
const sectionIds = new Set(sections.map(s => s.id));
const inArea = new Map();
for (const a of areas) for (const id of a.sectionIds) {
  if (!sectionIds.has(id)) errors.push(`area ${a.id} references missing ${id}`);
  inArea.set(id, (inArea.get(id) || 0) + 1);
}
for (const s of sections) {
  if (inArea.get(s.id) !== 1) errors.push(`${s.id} must be in exactly one area`);
  if (["bar", "djBooth", "exit", "stairs", "restroom", "stage", "kitchen", "coatCheck", "entrance", "walkway"].includes(s.type)) errors.push(`${s.id} never-bookable type`);
  if (!(s.includedGuests >= 1 && s.includedGuests <= s.maxCapacity)) errors.push(`${s.id} includedGuests out of range`);
  if (s.includedGuests === s.maxCapacity && s.extraGuestFee !== null) errors.push(`${s.id} extraGuestFee must be null`);
}
const labels = [...sections, ...nonBookable].map(e => e.label);
if (new Set(labels).size !== labels.length) errors.push("labels not unique");
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
for (const s of sections) for (const n of nonBookable) {
  if (overlap(s.bounds, n.bounds)) errors.push(`${s.label} overlaps ${n.label}`);
}
for (let i = 0; i < sections.length; i++) for (let j = i + 1; j < sections.length; j++) {
  if (overlap(sections[i].bounds, sections[j].bounds)) errors.push(`${sections[i].label} overlaps ${sections[j].label}`);
}
for (const s of sections) {
  const a = areas.find(x => x.id === s.areaId).bounds;
  const b = s.bounds;
  if (b.x < a.x - 1e-4 || b.y < a.y - 1e-4 || b.x + b.w > a.x + a.w + 1e-4 || b.y + b.h > a.y + a.h + 1e-4) errors.push(`${s.label} outside its area outline`);
}
for (const k of ["available", "held", "booked", "notBookable", "djBooth"]) if (!LEGEND[k]) errors.push(`legend missing ${k}`);
if (errors.length) { console.error("VALIDATION FAILED\n" + errors.join("\n")); process.exit(1); }

const svg = renderPlanSvg(plan, {interactive: false});
writeFileSync(join(DIR, "plan.svg"), svg + "\n");
plan.image.sha256 = createHash("sha256").update(svg + "\n").digest("hex");
writeFileSync(join(DIR, "aurelia.json"), JSON.stringify(plan, null, 2) + "\n");
console.log(`ok: ${areas.length} areas, ${sections.length} bookable sections ${JSON.stringify(byType)}, ${nonBookable.length} non-bookable, states ${JSON.stringify(demoStates)}`);
