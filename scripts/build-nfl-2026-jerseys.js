/* Recolor one blank 2026 NFL back into each club's home kit.
   Body / nameplate+collar+cuffs / side stripes stay separate so the
   LED can type the club word, patron name, and number on top. */
"use strict";

const fs = require("fs");
const path = require("path");
const jpeg = require(path.join(process.env.TEMP, "nfl-tools", "node_modules", "jpeg-js"));
const { PNG } = require(path.join(process.env.TEMP, "nfl-tools", "node_modules", "pngjs"));

const root = path.join(__dirname, "..");
const srcPath = path.join(root, "images", "nfl", "_blank-2026-back.jpg");
const outDir = path.join(root, "images", "nfl");

const TEAMS = [
  ["cardinals", "#97233F", "#FFFFFF", "#000000"],
  ["falcons", "#A71930", "#161616", "#161616"],
  ["ravens", "#241773", "#9E7C0C", "#9E7C0C"],
  ["bills", "#00338D", "#C60C30", "#C60C30"],
  ["panthers", "#101820", "#B0B7BC", "#0085CA"],
  ["bears", "#0B162A", "#C83803", "#C83803"],
  ["bengals", "#1A1A1A", "#FB4F14", "#FB4F14"],
  ["browns", "#3C2415", "#FF3C00", "#FF3C00"],
  ["cowboys", "#F4F4F4", "#041E42", "#869397"],
  ["broncos", "#FB4F14", "#002244", "#FFFFFF"],
  ["lions", "#0076B6", "#B0B7BC", "#B0B7BC"],
  ["packers", "#203731", "#FFB612", "#FFB612"],
  ["texans", "#03202F", "#A71930", "#FFFFFF"],
  ["colts", "#002C5F", "#A2AAAD", "#FFFFFF"],
  ["jaguars", "#101820", "#D7A22A", "#006778"],
  ["chiefs", "#E31837", "#FFB81C", "#FFFFFF"],
  ["raiders", "#1A1A1A", "#A5ACAF", "#A5ACAF"],
  ["chargers", "#0073CF", "#FFC20E", "#FFC20E"],
  ["rams", "#003594", "#FFD100", "#FFD100"],
  ["dolphins", "#008E97", "#FC4C02", "#FFFFFF"],
  ["vikings", "#4F2683", "#FFC62F", "#FFC62F"],
  ["patriots", "#002244", "#C60C30", "#FFFFFF"],
  ["saints", "#C5B17A", "#101820", "#101820"],
  ["giants", "#0B2265", "#A71930", "#FFFFFF"],
  ["jets", "#125740", "#FFFFFF", "#FFFFFF"],
  ["eagles", "#004C54", "#A5ACAF", "#A5ACAF"],
  ["steelers", "#161616", "#FFB612", "#FFB612"],
  ["49ers", "#AA0000", "#B3995D", "#FFFFFF"],
  ["seahawks", "#002244", "#69BE28", "#69BE28"],
  ["buccaneers", "#D50A0A", "#34302B", "#FF7900"],
  ["titans", "#4BA3E3", "#C8102E", "#FFFFFF"],
  ["commanders", "#5A1414", "#FFB612", "#FFB612"],
  ["scammerville", "#004C54", "#B3995D", "#B3995D"]
];

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }
function clamp(n) { return n < 0 ? 0 : n > 255 ? 255 : n; }

function weights(r, g, b) {
  const red = Math.max(0, r - Math.max(g, b));
  const yellow = Math.max(0, Math.min(r, g) - b - 15);
  const blue = Math.max(0, b - Math.max(r, g));
  const l = (r + g + b) / 3;
  const bg = l < 36 ? (36 - l) * 4 : 0;
  return { body: red, plate: yellow, side: blue, bg };
}

function shade(target, srcL, keyL) {
  const ratio = srcL / Math.max(1, keyL);
  const compressed = 1 + (ratio - 1) * 0.45;
  return target.map(c => clamp(Math.round(c * compressed)));
}

const jpg = jpeg.decode(fs.readFileSync(srcPath), { useTArray: true, formatAsRGBA: true });
const { width, height, data } = jpg;
let plate = { minX: width, minY: height, maxX: 0, maxY: 0, n: 0 };
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const w = weights(data[i], data[i + 1], data[i + 2]);
    if (w.plate > w.body && w.plate > w.side && w.plate > w.bg && w.plate > 40) {
      if (x < plate.minX) plate.minX = x;
      if (y < plate.minY) plate.minY = y;
      if (x > plate.maxX) plate.maxX = x;
      if (y > plate.maxY) plate.maxY = y;
      plate.n++;
    }
  }
}
console.log(JSON.stringify({
  width, height,
  plate: {
    x: +(plate.minX / width).toFixed(4),
    y: +(plate.minY / height).toFixed(4),
    r: +(plate.maxX / width).toFixed(4),
    b: +(plate.maxY / height).toFixed(4),
    n: plate.n
  }
}));

const keys = { body: 90, plate: 180, side: 80 };

function paint(file, bodyHex, plateHex, sideHex) {
  const targets = { body: hex(bodyHex), plate: hex(plateHex), side: hex(sideHex), bg: [0, 0, 0] };
  const png = new PNG({ width, height });
  for (let p = 0; p < data.length; p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const w = weights(r, g, b);
    const sum = w.body + w.plate + w.side + w.bg || 1;
    const srcL = luma(r, g, b);
    let R = 0, G = 0, B = 0;
    for (const key of ["body", "plate", "side", "bg"]) {
      const share = w[key] / sum;
      if (!share) continue;
      const shaded = key === "bg" ? [0, 0, 0] : shade(targets[key], srcL, keys[key]);
      R += shaded[0] * share;
      G += shaded[1] * share;
      B += shaded[2] * share;
    }
    png.data[p] = clamp(Math.round(R));
    png.data[p + 1] = clamp(Math.round(G));
    png.data[p + 2] = clamp(Math.round(B));
    png.data[p + 3] = 255;
  }
  fs.writeFileSync(path.join(outDir, file), PNG.sync.write(png));
}

for (const [slug, body, plateColor, side] of TEAMS) {
  paint(`nfl-${slug}-back-with-club.png`, body, plateColor, side);
  console.log("wrote", slug);
}
