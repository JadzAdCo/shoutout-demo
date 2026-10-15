// Builds decades.json, lima-twist.json and plans.js from pixel boxes measured with detect-shapes.ps1.
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
const placeholderMoney = {amountCents: null, currency: "USD", placeholder: true, note: "Club Admin sets the minimum spend / deposit per section"};
const cap = (min, max, note) => ({min, max, placeholder: true, note});

// ---------- Decades ----------
const DW = 1024, DH = 619;
const dTables = [
  ["C1", [521, 49, 568, 96], "vipTable", "decades-vip-tables-north"],
  ["C2", [618, 49, 666, 96], "vipTable", "decades-vip-tables-north"],
  ["C3", [715, 49, 763, 96], "vipTable", "decades-vip-tables-north"],
  ["C4", [818, 52, 865, 100], "vipTable", "decades-vip-tables-north"],
  ["C5", [920, 52, 967, 100], "vipTable", "decades-vip-tables-north"],
  ["C6", [849, 339, 896, 386], "table", "decades-main-floor"],
  ["C7", [765, 163, 813, 211], "table", "decades-main-floor"],
  ["C8", [669, 160, 717, 207], "table", "decades-main-floor"],
  ["C9", [562, 156, 609, 204], "table", "decades-main-floor"],
  ["C10", [579, 485, 627, 533], "vipTable", "decades-vip-tables-south"],
  ["C11", [810, 487, 857, 535], "vipTable", "decades-vip-tables-south"]
];
const dDesc = {
  "decades-vip-tables-north": "Placeholder — VIP row along the north wall (VIP TABLES). Venue to confirm view, bottle service and seating.",
  "decades-vip-tables-south": "Placeholder — VIP section on the south side (VIP TABLES). Venue to confirm.",
  "decades-main-floor": "Placeholder — table on the main floor between the VIP row and the dance floor. Venue to confirm."
};
const decades = {
  schemaVersion: "floqr.vipFloorPlan/1",
  status: "PROPOSAL — derived from the owner-supplied image; capacities and amounts are placeholders",
  venue: {name: "Decades", city: "Washington, DC", country: "US", clubLocationIdHint: null},
  image: {file: "decades-floor-map.png", widthPx: DW, heightPx: DH, source: "owner attachment Oct 15 2026 (image 1)"},
  coordinateSystem: "Normalized 0–1 of the image; origin top-left; rect = {x, y, w, h}; polygon = [[x, y], …] clockwise; pixelBox = [x0, y0, x1, y1] inclusive, in source pixels.",
  detection: "Table squares found by color segmentation (green fill, 11 components); areas traced from the wall lines.",
  areas: [
    {id: "decades-vip-tables-north", label: "VIP TABLES", type: "vipArea", bookable: false, buyoutCandidate: true,
      ...geom([494, 18, 1006, 124], DW, DH), tableLabels: ["C1", "C2", "C3", "C4", "C5"], description: dDesc["decades-vip-tables-north"]},
    {id: "decades-vip-tables-south", label: "VIP TABLES", type: "vipArea", bookable: false, buyoutCandidate: true,
      ...geom([517, 437, 1006, 590], DW, DH), tableLabels: ["C10", "C11"], description: dDesc["decades-vip-tables-south"]},
    {id: "decades-main-floor", label: null, printedText: "Decades (logo wordmark on the floor)", type: "floorZone", bookable: false,
      ...polyGeom([[60, 133], [1006, 133], [1006, 426], [432, 426], [432, 596], [115, 596], [115, 520], [60, 520]], DW, DH),
      tableLabels: ["C6", "C7", "C8", "C9"], description: "Unlabeled main floor / dance floor. Holds floor tables C6–C9."}
  ],
  sections: dTables.map(([label, box, type, areaId]) => ({
    id: `decades-${label.toLowerCase()}`, label, type, bookable: true, areaId,
    ...geom(box, DW, DH),
    capacity: type === "vipTable" ? cap(4, 8, "placeholder — confirm with venue") : cap(2, 6, "placeholder — confirm with venue"),
    minimumSpend: placeholderMoney, deposit: placeholderMoney,
    description: dDesc[areaId] + (label === "C6" ? " Next to the DJ BOOTH." : ""),
    photos: [], availability: {defaultNights: [], note: "Set per night / event by the VIP Manager"}
  })),
  nonBookable: [
    {id: "decades-bar", label: "BAR", type: "bar", reason: "Service bar — not reservable", ...geom([18, 18, 448, 124], DW, DH)},
    {id: "decades-dj-booth", label: "DJ BOOTH", type: "djBooth", reason: "Performer area", ...geom([906, 232, 999, 378], DW, DH)},
    {id: "decades-emergency-exit", label: "Emergency Exit", type: "exit", reason: "Life safety — must stay clear; never place a section here", ...geom([19, 171, 55, 345], DW, DH)},
    {id: "decades-stairs", label: "stairs", type: "stairs", reason: "Circulation — must stay clear", ...geom([18, 523, 110, 596], DW, DH)},
    {id: "decades-unlabeled-room", label: null, type: "unlabeled", reason: "Unlabeled enclosure west of the south VIP TABLES — ask the venue what it is", ...geom([441, 437, 515, 596], DW, DH)}
  ],
  ignoredArtifacts: [{printedText: "?", reason: "Help icon from the source app's screenshot, not part of the venue", ...geom([985, 572, 1015, 603], DW, DH)}]
};

// ---------- Lima Twist ----------
const LW = 1024, LH = 382;
const L = [
  ["209", [37, 60, 72, 85]], ["208", [84, 60, 119, 85]], ["207", [132, 60, 167, 85]], ["206", [183, 60, 218, 85]],
  ["205", [229, 60, 265, 85]], ["204", [278, 60, 313, 85]], ["203", [323, 60, 359, 85]], ["202", [371, 60, 406, 85]],
  ["201", [422, 60, 458, 85]],
  ["106", [515, 60, 551, 86]], ["105", [589, 60, 625, 86]], ["104", [653, 60, 689, 85]], ["103", [722, 60, 758, 85]],
  ["102", [795, 60, 830, 85]], ["101", [860, 60, 895, 85]],
  ["503", [699, 199, 740, 240], "circle"], ["502", [779, 199, 820, 240], "circle"], ["501", [859, 199, 900, 240], "circle"],
  ["403", [9, 279, 73, 315]], ["402", [80, 279, 144, 315]], ["401", [150, 279, 214, 315]],
  ["BAR2", [266, 281, 363, 317]], ["BAR1", [378, 281, 475, 317]],
  ["307", [573, 251, 608, 315]], ["306", [632, 279, 677, 315]], ["305", [706, 279, 751, 315]], ["304", [775, 279, 820, 315]],
  ["303", [843, 279, 888, 315]], ["302", [906, 279, 951, 315]], ["301", [972, 251, 1008, 315]]
];
function limaType(label) {
  if (label.startsWith("BAR")) return {type: "bar", zone: "bar", seats: 8, seatNote: "4 chair marks on each long side"};
  if (label.startsWith("5")) return {type: "round", zone: "500s", seats: 4, seatNote: "4 chair marks"};
  if (label === "301" || label === "307") return {type: "table", zone: "300s", seats: 6, seatNote: "3 chair marks on each long side (vertical table)"};
  if (label.startsWith("3")) return {type: "table", zone: "300s", seats: 4, seatNote: "2 chair marks top and bottom"};
  if (label.startsWith("4")) return {type: "table", zone: "400s", seats: 6, seatNote: "3 chair marks top and bottom"};
  if (label.startsWith("2")) return {type: "table", zone: "200s", seats: 2, seatNote: "1 chair mark each side"};
  return {type: "table", zone: "100s", seats: 2, seatNote: "1 chair mark each side"};
}
const lima = {
  schemaVersion: "floqr.vipFloorPlan/1",
  status: "PROPOSAL — derived from the owner-supplied image; capacities and amounts are placeholders",
  venue: {name: "Lima Twist", city: "Washington, DC", country: "US", clubLocationIdHint: null},
  image: {file: "lima-twist-table-map.png", widthPx: LW, heightPx: LH, source: "owner attachment Oct 15 2026 (image 2)"},
  coordinateSystem: decades.coordinateSystem,
  detection: "Table shapes found by brightness segmentation (30 components = 30 printed labels). Chair marks are included in each box.",
  areas: [],
  suggestedZones: [
    {id: "100s", printed: false, labels: ["101", "102", "103", "104", "105", "106"]},
    {id: "200s", printed: false, labels: ["201", "202", "203", "204", "205", "206", "207", "208", "209"]},
    {id: "300s", printed: false, labels: ["301", "302", "303", "304", "305", "306", "307"]},
    {id: "400s", printed: false, labels: ["401", "402", "403"]},
    {id: "500s", printed: false, labels: ["501", "502", "503"]},
    {id: "bar", printed: false, labels: ["BAR1", "BAR2"]}
  ],
  sections: L.map(([label, box, shape]) => {
    const t = limaType(label);
    return {
      id: `lima-twist-${label.toLowerCase()}`, label, type: t.type, bookable: true,
      bookableNote: t.type === "bar" ? "Printed as a table on the map; confirm with the venue whether bar seats are reservable" : undefined,
      suggestedZone: t.zone, ...geom(box, LW, LH, shape || "rect"),
      capacity: cap(Math.max(1, t.seats - 2), t.seats, `placeholder from the drawing: ${t.seatNote}`),
      minimumSpend: placeholderMoney, deposit: placeholderMoney,
      description: "Placeholder — venue to confirm.", photos: [],
      availability: {defaultNights: [], note: "Set per night / event by the VIP Manager"}
    };
  }),
  nonBookable: [],
  nonBookableNote: "The Lima Twist map shows tables only — no printed bar area, DJ booth, exits or stairs. Ask the venue for a full floor plan before go-live (exits must be marked)."
};

for (const [name, doc] of [["decades.json", decades], ["lima-twist.json", lima]]) {
  doc.counts = {
    bookableSections: doc.sections.filter(s => s.bookable).length,
    byType: doc.sections.reduce((m, s) => ({...m, [s.type]: (m[s.type] || 0) + 1}), {}),
    areas: doc.areas.length, nonBookable: doc.nonBookable.length,
    totalSeatsMaxPlaceholder: doc.sections.reduce((n, s) => n + s.capacity.max, 0)
  };
  fs.writeFileSync(path.join(out, name), JSON.stringify(doc, null, 2) + "\n");
  console.log(name, JSON.stringify(doc.counts));
}
fs.writeFileSync(path.join(out, "plans.js"),
  "// Generated copy of decades.json + lima-twist.json so preview.html also opens from disk (file://). Edit the JSON, not this file.\n" +
  "window.FLOQR_VIP_PLANS = " + JSON.stringify({"decades.json": decades, "lima-twist.json": lima}) + ";\n");
