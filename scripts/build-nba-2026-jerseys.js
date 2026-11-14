/* Paint each club's icon colors onto the blank tank as mesh fabric.
   Same silhouette and collar-to-hem placement as the blank. No name or number. */
"use strict";

const fs = require("fs");
const path = require("path");
const jpeg = require(path.join(process.env.TEMP, "nfl-tools", "node_modules", "jpeg-js"));
const { PNG } = require(path.join(process.env.TEMP, "nfl-tools", "node_modules", "pngjs"));

const root = path.join(__dirname, "..");
const srcPath = path.join(root, "images", "basketball", "_blank-2026-back.jpg");
const outDir = path.join(root, "images", "basketball");

// slug, body, trim (collar + armholes), side panels. 2026-27 Icon colors.
const TEAMS = [
  ["hawks", "#C8102E", "#FDB927", "#161616"],
  ["celtics", "#007A33", "#BA9653", "#FFFFFF"],
  ["nets", "#161616", "#FFFFFF", "#161616"],
  ["hornets", "#1D1160", "#00788C", "#A1A1A4"],
  ["bulls", "#CE1141", "#161616", "#161616"],
  ["cavaliers", "#860038", "#FDBB30", "#041E42"],
  ["mavericks", "#00538C", "#B8C4CA", "#002B5E"],
  ["nuggets", "#0E2240", "#FEC524", "#8B2332"],
  ["pistons", "#C8102E", "#1D42BA", "#BEC0C2"],
  ["warriors", "#1D428A", "#FFC72C", "#FFC72C"],
  ["rockets", "#CE1141", "#FDB927", "#161616"],
  ["pacers", "#002D62", "#FDBB30", "#FDBB30"],
  ["clippers", "#1D428A", "#C8102E", "#FFFFFF"],
  ["lakers", "#552583", "#FDB927", "#FDB927"],
  ["grizzlies", "#5D76A9", "#12173F", "#F5B112"],
  ["heat", "#161616", "#98002E", "#F9A01B"],
  ["bucks", "#00471B", "#EEE1C6", "#0077C0"],
  ["timberwolves", "#0C2340", "#78BE20", "#236192"],
  ["pelicans", "#0C2340", "#C8102E", "#B4975A"],
  ["knicks", "#006BB6", "#F58426", "#F58426"],
  ["thunder", "#007AC1", "#EF3B24", "#FDBB30"],
  ["magic", "#0077C0", "#C4CED4", "#161616"],
  ["76ers", "#006BB6", "#ED174C", "#FFFFFF"],
  ["suns", "#1D1160", "#E56020", "#E56020"],
  ["blazers", "#E03A3E", "#161616", "#161616"],
  ["kings", "#5A2D81", "#63727A", "#161616"],
  ["spurs", "#161616", "#C4CED4", "#C4CED4"],
  ["raptors", "#CE1141", "#161616", "#A1A1A4"],
  ["jazz", "#5B2C82", "#111111", "#6CACE4"],
  ["wizards", "#002B5C", "#E31837", "#C4CED4"]
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

const REGION = { bg: 0, body: 1, plate: 2, side: 3 };
const NAME = ["bg", "body", "plate", "side"];

function fabricMul(x, y, srcL, keyName, reg) {
  const keyL = keys[keyName] || 90;
  const srcN = srcL / Math.max(1, keyL);
  const fold = 0.7 + (srcN - 1) * 1.7;
  const u = x / width;
  const v = y / height;
  const hole = ((x + y) % 4 === 0) ? 0.74 : 1;
  const thread = ((x & 1) === (y & 1)) ? 0.07 : -0.05;
  const mesh = hole + thread;
  const drape = Math.sin(x * 0.05 + Math.sin(y * 0.018) * 2.4) * 0.1
    + Math.sin(x * 0.095 + y * 0.007) * 0.05;
  const spine = Math.sin(v * 9 + Math.sin(u * 5)) * 0.055 * Math.exp(-Math.pow((u - 0.5) * 2.4, 2));
  const sideDark = Math.pow(Math.abs(u - 0.5) * 1.55, 1.2) * 0.18;
  const sheen = Math.exp(-Math.pow((u - 0.47) * 3.4, 2) - Math.pow((v - 0.2) * 2.5, 2)) * 0.28;
  const shoulder = Math.exp(-Math.pow((u - 0.28) * 5.2, 2) - Math.pow((v - 0.14) * 8, 2)) * 0.11
    + Math.exp(-Math.pow((u - 0.72) * 5.2, 2) - Math.pow((v - 0.14) * 8, 2)) * 0.11;
  const rib = reg === REGION.plate ? ((y % 3 === 0) ? 0.68 : 1.14) : 1;
  const hem = hemY[x] >= 0 ? Math.max(0, 16 - (hemY[x] - y)) / 16 : 0;
  const edge = edgeDist[y * width + x];
  const rim = edge < 18 ? ((18 - edge) / 18) * 0.24 : 0;
  let m = fold * mesh * rib * (1 - sideDark) + drape + spine + sheen + shoulder;
  m *= 1 - hem * 0.38;
  m *= 1 - rim;
  return Math.max(0.26, Math.min(1.75, m));
}

function isSeam(i, x, y) {
  const r = region[i];
  if (!r) return false;
  if (x > 0 && region[i - 1] && region[i - 1] !== r) return true;
  if (x + 1 < width && region[i + 1] && region[i + 1] !== r) return true;
  if (y > 0 && region[i - width] && region[i - width] !== r) return true;
  if (y + 1 < height && region[i + width] && region[i + width] !== r) return true;
  return false;
}

const jpg = jpeg.decode(fs.readFileSync(srcPath), { useTArray: true, formatAsRGBA: true });
const { width, height, data } = jpg;
const sums = { body: 0, plate: 0, side: 0 };
const counts = { body: 0, plate: 0, side: 0 };
for (let p = 0; p < data.length; p += 4) {
  const w = weights(data[p], data[p + 1], data[p + 2]);
  let key = "bg";
  let best = w.bg;
  for (const k of ["body", "plate", "side"]) {
    if (w[k] > best) { best = w[k]; key = k; }
  }
  if (key === "bg" || best < 28) continue;
  sums[key] += luma(data[p], data[p + 1], data[p + 2]);
  counts[key] += 1;
}
const keys = {
  body: counts.body ? sums.body / counts.body : 90,
  plate: counts.plate ? sums.plate / counts.plate : 180,
  side: counts.side ? sums.side / counts.side : 80
};
console.log("keys", keys, "counts", counts);

const region = new Uint8Array(width * height);
const hemY = new Int16Array(width);
hemY.fill(-1);
for (let i = 0, p = 0; i < region.length; i += 1, p += 4) {
  const w = weights(data[p], data[p + 1], data[p + 2]);
  let key = "bg";
  let best = w.bg;
  for (const k of ["body", "plate", "side"]) {
    if (w[k] > best) { best = w[k]; key = k; }
  }
  const reg = (key === "bg" || best < 28) ? 0 : REGION[key];
  region[i] = reg;
  if (reg) hemY[i % width] = Math.floor(i / width);
}

const edgeDist = new Uint8Array(width * height);
edgeDist.fill(24);
for (let i = 0; i < region.length; i += 1) if (!region[i]) edgeDist[i] = 0;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = y * width + x;
    let d = edgeDist[i];
    if (x) d = Math.min(d, edgeDist[i - 1] + 1);
    if (y) d = Math.min(d, edgeDist[i - width] + 1);
    edgeDist[i] = d;
  }
}
for (let y = height - 1; y >= 0; y -= 1) {
  for (let x = width - 1; x >= 0; x -= 1) {
    const i = y * width + x;
    let d = edgeDist[i];
    if (x + 1 < width) d = Math.min(d, edgeDist[i + 1] + 1);
    if (y + 1 < height) d = Math.min(d, edgeDist[i + width] + 1);
    edgeDist[i] = d;
  }
}

function paint(file, bodyHex, plateHex, sideHex) {
  const targets = { body: hex(bodyHex), plate: hex(plateHex), side: hex(sideHex) };
  const png = new PNG({ width, height });
  for (let i = 0, p = 0; i < region.length; i += 1, p += 4) {
    const reg = region[i];
    if (!reg) continue;
    const x = i % width;
    const y = (i - x) / width;
    const keyName = NAME[reg];
    const srcL = luma(data[p], data[p + 1], data[p + 2]);
    const m = fabricMul(x, y, srcL, keyName, reg);
    const base = targets[keyName];
    let R = base[0] * m;
    let G = base[1] * m;
    let B = base[2] * m;
    if (isSeam(i, x, y) && ((x + y) % 4 === 0)) {
      R = R * 0.5 + 220 * 0.5;
      G = G * 0.5 + 220 * 0.5;
      B = B * 0.5 + 220 * 0.5;
    } else if (isSeam(i, x, y) && ((x + y) % 4 === 2)) {
      R *= 0.7;
      G *= 0.7;
      B *= 0.7;
    }
    png.data[p] = clamp(Math.round(R));
    png.data[p + 1] = clamp(Math.round(G));
    png.data[p + 2] = clamp(Math.round(B));
    png.data[p + 3] = 255;
  }
  fs.writeFileSync(path.join(outDir, file), PNG.sync.write(png));
}

for (const [slug, body, trim, side] of TEAMS) {
  paint(`nba-${slug}-back-with-club.png`, body, trim, side);
  console.log("wrote", slug);
}

const terpsPath = path.join(outDir, "maryland-terps-2026-back.jpg");
const terps = jpeg.decode(fs.readFileSync(terpsPath), { useTArray: true, formatAsRGBA: true });
if (terps.width === width && terps.height === height) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < region.length; i += 1, p += 4) {
    const reg = region[i];
    if (!reg) continue;
    const x = i % width;
    const y = (i - x) / width;
    const srcL = luma(data[p], data[p + 1], data[p + 2]);
    if (reg === REGION.side) {
      const pr = terps.data[p], pg = terps.data[p + 1], pb = terps.data[p + 2];
      const thread = (((x * 2 + y) & 3) === 0 || ((x - y * 2) & 3) === 0) ? -0.05 : 0.03;
      const m = 1 + thread;
      out[p] = clamp(Math.round(pr * m));
      out[p + 1] = clamp(Math.round(pg * m));
      out[p + 2] = clamp(Math.round(pb * m));
    } else {
      const keyName = NAME[reg];
      const base = reg === REGION.plate ? hex("#FFD520") : hex("#E21833");
      const m = fabricMul(x, y, srcL, keyName, reg);
      out[p] = clamp(Math.round(base[0] * m));
      out[p + 1] = clamp(Math.round(base[1] * m));
      out[p + 2] = clamp(Math.round(base[2] * m));
    }
    if (isSeam(i, x, y) && ((x + y) % 4 === 0)) {
      out[p] = clamp(Math.round(out[p] * 0.5 + 230 * 0.5));
      out[p + 1] = clamp(Math.round(out[p + 1] * 0.5 + 230 * 0.5));
      out[p + 2] = clamp(Math.round(out[p + 2] * 0.5 + 230 * 0.5));
    } else if (isSeam(i, x, y) && ((x + y) % 4 === 2)) {
      out[p] = clamp(Math.round(out[p] * 0.7));
      out[p + 1] = clamp(Math.round(out[p + 1] * 0.7));
      out[p + 2] = clamp(Math.round(out[p + 2] * 0.7));
    }
    out[p + 3] = 255;
  }
  fs.writeFileSync(terpsPath, jpeg.encode({ data: out, width, height }, 92).data);
  console.log("wrote terps");
} else {
  console.log("terps size mismatch", terps.width, terps.height, width, height);
}
