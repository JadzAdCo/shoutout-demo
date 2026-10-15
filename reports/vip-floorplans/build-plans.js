// Builds decades.json, lima-twist.json, legend.json and plans.js from pixel boxes measured with detect-shapes.ps1.
// Usage: node reports/vip-floorplans/build-plans.js reports/vip-floorplans
const fs = require("fs");
const path = require("path");
const out = process.argv[2] || __dirname;
const r4 = n => Math.round(n * 10000) / 10000;

function geom([x0, y0, x1, y1], W, H, shape = "rect") {
  const x = r4(x0 / W), y = r4(y0 / H), w = r4((x1 - x0 + 1) / W), h = r4((y1 - y0 + 1) / H);
  const g = {shape, pixelBox: [x0, y0, x1, y1], rect: {x, y, w, h},
    polygon: [[x, y], [r4(x + w), y], [r4(x + w), r4(y + h)], [x, r4(y + h)]]};
  if (shape === "circle") g.circle = {cx: r4((x0 + x1 + 1) / 2 / W), cy: r4((y0 + y1 + 1) / 2 / H), rx: r4((x1 - x0 + 1) / 2 / W), ry: r4((y1 - y0 + 1) / 2 / H)};
  return g;
}
function polyGeom(points, W, H) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return {shape: "polygon", pixelBox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    polygon: points.map(([px, py]) => [r4(px / W), r4(py / H)])};
}
// Area = named group for small screens: outline (bounds) + zoom target (viewBox = members' box + padding).
function area(def, members, W, H, pad = 18) {
  const boxes = members.map(m => m.pixelBox);
  const vb = [Math.max(0, Math.min(...boxes.map(b => b[0])) - pad), Math.max(0, Math.min(...boxes.map(b => b[1])) - pad),
    Math.min(W - 1, Math.max(...boxes.map(b => b[2])) + pad), Math.min(H - 1, Math.max(...boxes.map(b => b[3])) + pad)];
  const outline = def.outline ? (Array.isArray(def.outline[0]) ? polyGeom(def.outline, W, H) : geom(def.outline, W, H)) : geom(vb, W, H);
  return {
    id: def.id, label: def.label ?? null, name: def.name, nameEditable: true, type: def.type || "area",
    ...outline, bounds: outline.rect || null, viewBox: geom(vb, W, H).rect, viewPixelBox: vb,
    sectionIds: members.filter(m => m.bookable).map(m => m.id),
    nonBookableIds: members.filter(m => !m.bookable).map(m => m.id),
    description: def.description
  };
}
const placeholderMoney = {amountCents: null, currency: "USD", placeholder: true, note: "Club Admin sets the minimum spend / deposit per section"};
const cap = (min, max, note) => ({min, max, placeholder: true, note});
const availability = {defaultNights: [], note: "Set per night / event by the VIP Manager"};

// ---------- Shared legend (one spec for every floor plan) ----------
function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
const DARK_BACKGROUNDS = {decades: "#222222", limaTwist: "#2d3240", appDark: "#111111"};
const STATES = [
  {state: "available", label: "Available", color: "#22c55e", stroke: "#4ade80", fillOpacity: 0.35, icon: "check", pattern: "none", text: "Available"},
  {state: "held", label: "Held / pending", color: "#f59e0b", stroke: "#fbbf24", fillOpacity: 0.5, icon: "clock", pattern: "diagonal-stripes", text: "Held"},
  {state: "booked", label: "Booked", color: "#ef4444", stroke: "#f87171", fillOpacity: 0.55, icon: "cross", pattern: "cross-hatch", text: "Booked"},
  {state: "notBookable", label: "Not bookable", color: "#9ca3af", stroke: "#9ca3af", fillOpacity: 0.22, icon: "lock", pattern: "dots", strokeDash: "4 3", text: "Not bookable"},
  {state: "djBooth", label: "DJ Booth", color: "#3b82f6", stroke: "#60a5fa", fillOpacity: 0.45, icon: "music", pattern: "none", text: "DJ Booth"},
  {state: "selected", label: "Selected", color: "#ffffff", stroke: "#fde047", fillOpacity: 0, icon: "none", pattern: "none", strokeWidthPx: 4, animation: "pulse (off when prefers-reduced-motion)", text: "Selected"}
];
const legend = {
  schemaVersion: "floqr.vipLegend/1",
  status: "PROPOSAL — owner-approved colors Oct 15 2026: DJ Booth blue, Available green, Booked red; Held, Not bookable, Selected proposed",
  rule: "Color is never the only cue (WCAG 2.2 SC 1.4.1): every state also has an icon badge, a fill pattern and a text label in the list view and the on-map legend. Strokes keep ≥ 3:1 against the dark map background (SC 1.4.11).",
  backgrounds: DARK_BACKGROUNDS,
  states: STATES.map(s => ({...s, strokeContrast: Object.fromEntries(Object.entries(DARK_BACKGROUNDS).map(([k, bg]) => [k, contrast(s.stroke, bg)]))})),
  areaOutline: {stroke: "#e5e7eb", strokeDash: "8 5", labelColor: "#ffffff", note: "Neutral outline so it never competes with state colors"},
  tapTargetMinPx: 44,
  appliesTo: "Every element with type djBooth renders as djBooth in every floor plan, whatever its printed label"
};
const bad = legend.states.filter(s => Object.values(s.strokeContrast).some(v => v < 3));
if (bad.length) throw new Error("Legend stroke under 3:1: " + bad.map(s => s.state).join(", "));

// ---------- Decades ----------
const DW = 1024, DH = 619;
const dTables = [
  ["C1", [521, 49, 568, 96], "vipTable", "decades-north-vip"],
  ["C2", [618, 49, 666, 96], "vipTable", "decades-north-vip"],
  ["C3", [715, 49, 763, 96], "vipTable", "decades-north-vip"],
  ["C4", [818, 52, 865, 100], "vipTable", "decades-north-vip"],
  ["C5", [920, 52, 967, 100], "vipTable", "decades-north-vip"],
  ["C6", [849, 339, 896, 386], "table", "decades-floor"],
  ["C7", [765, 163, 813, 211], "table", "decades-floor"],
  ["C8", [669, 160, 717, 207], "table", "decades-floor"],
  ["C9", [562, 156, 609, 204], "table", "decades-floor"],
  ["C10", [579, 485, 627, 533], "vipTable", "decades-south-vip"],
  ["C11", [810, 487, 857, 535], "vipTable", "decades-south-vip"]
];
const dDesc = {
  "decades-north-vip": "Placeholder — VIP row along the north wall (VIP TABLES). Venue to confirm view, bottle service and seating.",
  "decades-south-vip": "Placeholder — VIP section on the south side (VIP TABLES). Venue to confirm.",
  "decades-floor": "Placeholder — table on the main floor between the VIP row and the dance floor. Venue to confirm."
};
const dSections = dTables.map(([label, box, type, areaId]) => ({
  id: `decades-${label.toLowerCase()}`, label, type, bookable: true, areaId,
  ...geom(box, DW, DH),
  capacity: type === "vipTable" ? cap(4, 8, "placeholder — confirm with venue") : cap(2, 6, "placeholder — confirm with venue"),
  minimumSpend: placeholderMoney, deposit: placeholderMoney,
  description: dDesc[areaId] + (label === "C6" ? " Next to the DJ BOOTH." : ""),
  photos: [], availability
}));
const dNonBookable = [
  {id: "decades-bar", label: "BAR", type: "bar", state: "notBookable", reason: "Service bar — not reservable", ...geom([18, 18, 448, 124], DW, DH)},
  {id: "decades-dj-booth", label: "DJ BOOTH", type: "djBooth", state: "djBooth", areaId: "decades-floor", reason: "Performer area", ...geom([906, 232, 999, 378], DW, DH)},
  {id: "decades-emergency-exit", label: "Emergency Exit", type: "exit", state: "notBookable", reason: "Life safety — must stay clear; never place a section here", ...geom([19, 171, 55, 345], DW, DH)},
  {id: "decades-stairs", label: "stairs", type: "stairs", state: "notBookable", reason: "Circulation — must stay clear", ...geom([18, 523, 110, 596], DW, DH)},
  {id: "decades-unlabeled-room", label: null, type: "unlabeled", state: "notBookable", reason: "Unlabeled enclosure west of the south VIP TABLES — ask the venue what it is", ...geom([441, 437, 515, 596], DW, DH)}
].map(n => ({...n, bookable: false}));
const dMembers = id => [...dSections, ...dNonBookable].filter(m => m.areaId === id);
const decades = {
  schemaVersion: "floqr.vipFloorPlan/2",
  status: "PROPOSAL — owner: \"The Decades floor plan is wonderful.\" Capacities and amounts are placeholders",
  venue: {name: "Decades", city: "Washington, DC", country: "US", clubLocationIdHint: "decades-washington-dc"},
  image: {file: "decades-floor-map.png", widthPx: DW, heightPx: DH, source: "owner attachment Oct 15 2026 (image 1)"},
  legendRef: "legend.json",
  coordinateSystem: "Normalized 0–1 of the image; origin top-left; rect = {x, y, w, h}; polygon = [[x, y], …] clockwise; pixelBox = [x0, y0, x1, y1] inclusive, in source pixels. Areas: bounds/polygon = outline drawn on the map, viewBox = zoom target for the phone area view.",
  detection: "Table squares found by color segmentation (green fill, 11 components); areas traced from the wall lines.",
  areas: [
    area({id: "decades-north-vip", label: "VIP TABLES", name: "North VIP", type: "vipArea", outline: [494, 18, 1006, 124], description: dDesc["decades-north-vip"]}, dMembers("decades-north-vip"), DW, DH),
    area({id: "decades-floor", label: null, name: "Floor", type: "floorZone",
      outline: [[60, 133], [1006, 133], [1006, 426], [432, 426], [432, 596], [115, 596], [115, 520], [60, 520]],
      description: "Unlabeled main floor / dance floor (Decades logo). Holds floor tables C6–C9 and the DJ BOOTH."}, dMembers("decades-floor"), DW, DH),
    area({id: "decades-south-vip", label: "VIP TABLES", name: "South VIP", type: "vipArea", outline: [517, 437, 1006, 590], description: dDesc["decades-south-vip"]}, dMembers("decades-south-vip"), DW, DH)
  ],
  sections: dSections,
  nonBookable: dNonBookable,
  ignoredArtifacts: [{printedText: "?", reason: "Help icon from the source app's screenshot, not part of the venue", ...geom([985, 572, 1015, 603], DW, DH)}]
};

// ---------- LIMA Twist ----------
const LW = 1024, LH = 382;
const L = [
  ["209", [37, 60, 72, 85]], ["208", [84, 60, 119, 85]], ["207", [132, 60, 167, 85]], ["206", [183, 60, 218, 85]],
  ["205", [229, 60, 265, 85]], ["204", [278, 60, 313, 85]], ["203", [323, 60, 359, 85]], ["202", [371, 60, 406, 85]],
  ["201", [422, 60, 458, 85]],
  ["105", [589, 60, 625, 86]], ["104", [653, 60, 689, 85]], ["103", [722, 60, 758, 85]],
  ["102", [795, 60, 830, 85]], ["101", [860, 60, 895, 85]],
  ["503", [699, 199, 740, 240], "circle"], ["502", [779, 199, 820, 240], "circle"], ["501", [859, 199, 900, 240], "circle"],
  ["403", [9, 279, 73, 315]], ["402", [80, 279, 144, 315]], ["401", [150, 279, 214, 315]],
  ["BAR2", [266, 281, 363, 317]], ["BAR1", [378, 281, 475, 317]],
  ["307", [573, 251, 608, 315]], ["306", [632, 279, 677, 315]], ["305", [706, 279, 751, 315]], ["304", [775, 279, 820, 315]],
  ["303", [843, 279, 888, 315]], ["302", [906, 279, 951, 315]], ["301", [972, 251, 1008, 315]]
];
function limaType(label) {
  if (label.startsWith("BAR")) return {type: "bar", areaId: "lima-twist-area-c", seats: 8, seatNote: "4 chair marks on each long side"};
  if (label.startsWith("5")) return {type: "round", areaId: "lima-twist-area-d", seats: 4, seatNote: "4 chair marks"};
  if (label === "301" || label === "307") return {type: "table", areaId: "lima-twist-area-d", seats: 6, seatNote: "3 chair marks on each long side (vertical table)"};
  if (label.startsWith("3")) return {type: "table", areaId: "lima-twist-area-d", seats: 4, seatNote: "2 chair marks top and bottom"};
  if (label.startsWith("4")) return {type: "table", areaId: "lima-twist-area-c", seats: 6, seatNote: "3 chair marks top and bottom"};
  if (label.startsWith("2")) return {type: "table", areaId: "lima-twist-area-a", seats: 2, seatNote: "1 chair mark each side"};
  return {type: "table", areaId: "lima-twist-area-b", seats: 2, seatNote: "1 chair mark each side"};
}
const lSections = L.map(([label, box, shape]) => {
  const t = limaType(label);
  return {
    id: `lima-twist-${label.toLowerCase()}`, label, type: t.type, bookable: true, areaId: t.areaId,
    bookableNote: t.type === "bar" ? "Printed as a table on the map; confirm with the venue whether bar seats are reservable" : undefined,
    ...geom(box, LW, LH, shape || "rect"),
    capacity: cap(Math.max(1, t.seats - 2), t.seats, `placeholder from the drawing: ${t.seatNote}`),
    minimumSpend: placeholderMoney, deposit: placeholderMoney,
    description: "Placeholder — venue to confirm.", photos: [], availability
  };
});
const lNonBookable = [
  {id: "lima-twist-106", label: "106", name: "DJ BOOTH", type: "djBooth", state: "djBooth", bookable: false, areaId: "lima-twist-area-b",
    reason: "Owner Oct 15 2026: 106 is the DJ BOOTH (printed label kept as 106)", ...geom([515, 60, 551, 86], LW, LH)}
];
const lMembers = id => [...lSections, ...lNonBookable].filter(m => m.areaId === id);
const lima = {
  schemaVersion: "floqr.vipFloorPlan/2",
  status: "PROPOSAL — derived from the owner-supplied image; capacities and amounts are placeholders; area names are suggestions the owner can rename",
  venue: {name: "LIMA Twist", nameNote: "Spelled \"LIMA Twist\" in shared-data.js / limatwist.com — owner to confirm (Twist vs Twyst)", city: "Washington, DC", country: "US", clubLocationIdHint: "lima-twist-washington-dc"},
  image: {file: "lima-twist-table-map.png", widthPx: LW, heightPx: LH, source: "owner attachment Oct 15 2026 (image 2)"},
  legendRef: "legend.json",
  coordinateSystem: decades.coordinateSystem,
  detection: "Table shapes found by brightness segmentation (30 components = 30 printed labels; 106 is the DJ BOOTH). Chair marks are included in each box.",
  areas: [
    area({id: "lima-twist-area-a", name: "Area A · 200 Row", description: "Top-left row, tables 201–209."}, lMembers("lima-twist-area-a"), LW, LH),
    area({id: "lima-twist-area-b", name: "Area B · DJ & 100 Row", description: "Top-right row, tables 101–105 beside the DJ BOOTH (106)."}, lMembers("lima-twist-area-b"), LW, LH),
    area({id: "lima-twist-area-c", name: "Area C · Bar & 400s", description: "Bottom-left: tables 401–403 and bar seating BAR1 / BAR2."}, lMembers("lima-twist-area-c"), LW, LH),
    area({id: "lima-twist-area-d", name: "Area D · 300s & Rounds", description: "Bottom-right: tables 301–307 and round tables 501–503."}, lMembers("lima-twist-area-d"), LW, LH)
  ],
  sections: lSections,
  nonBookable: lNonBookable,
  nonBookableNote: "The LIMA Twist drawing shows tables only — no walls, bar counter, exits or stairs. Ask the venue for a full floor plan before go-live (exits must be marked)."
};

for (const [name, doc] of [["decades.json", decades], ["lima-twist.json", lima]]) {
  const all = [...doc.sections, ...doc.nonBookable];
  for (const a of doc.areas) for (const id of [...a.sectionIds, ...a.nonBookableIds]) if (!all.some(m => m.id === id)) throw new Error(`${name}: area ${a.id} lists unknown ${id}`);
  const orphans = doc.sections.filter(s => !doc.areas.some(a => a.sectionIds.includes(s.id)));
  if (orphans.length) throw new Error(`${name}: sections without an area: ${orphans.map(s => s.label)}`);
  doc.counts = {
    bookableSections: doc.sections.filter(s => s.bookable).length,
    byType: doc.sections.reduce((m, s) => ({...m, [s.type]: (m[s.type] || 0) + 1}), {}),
    areas: doc.areas.length, nonBookable: doc.nonBookable.length,
    djBooths: doc.nonBookable.filter(n => n.type === "djBooth").length,
    totalSeatsMaxPlaceholder: doc.sections.reduce((n, s) => n + s.capacity.max, 0)
  };
  fs.writeFileSync(path.join(out, name), JSON.stringify(doc, null, 2) + "\n");
  console.log(name, JSON.stringify(doc.counts));
}
fs.writeFileSync(path.join(out, "legend.json"), JSON.stringify(legend, null, 2) + "\n");
console.log("legend.json", legend.states.map(s => `${s.state} ${Math.min(...Object.values(s.strokeContrast))}:1`).join(" · "));
fs.writeFileSync(path.join(out, "plans.js"),
  "// Generated copy of decades.json + lima-twist.json + legend.json so preview.html also opens from disk (file://). Edit build-plans.js, not this file.\n" +
  "window.FLOQR_VIP_PLANS = " + JSON.stringify({"decades.json": decades, "lima-twist.json": lima, "legend.json": legend}) + ";\n");
