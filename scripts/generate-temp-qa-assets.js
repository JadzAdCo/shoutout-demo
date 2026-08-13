/* Generate fake QA icons / venue art / employee avatars for temp-democlub-* only. */
"use strict";

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "images", "temp-qa");
fs.mkdirSync(dir, {recursive: true});

const palettes = [
  ["#121826", "#f59e0b", "#ff6b4a"],
  ["#0f172a", "#38bdf8", "#a78bfa"],
  ["#1a1025", "#f472b6", "#34d399"],
  ["#102018", "#84cc16", "#22d3ee"],
  ["#1c1220", "#fb7185", "#fbbf24"],
  ["#0b1220", "#60a5fa", "#c084fc"],
  ["#1a1408", "#f97316", "#fde047"],
  ["#101820", "#2dd4bf", "#f472b6"],
  ["#18101c", "#e879f9", "#67e8f9"],
  ["#141218", "#facc15", "#fb923c"]
];

function logo(n) {
  const [bg, a, b] = palettes[(n - 1) % palettes.length];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>
  <rect width="512" height="512" rx="96" fill="${bg}"/>
  <circle cx="256" cy="210" r="110" fill="url(#g)" opacity="0.95"/>
  <rect x="146" y="300" width="220" height="120" rx="28" fill="url(#g)" opacity="0.85"/>
  <text x="256" y="240" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="92" fill="#0b1020">T${n}</text>
  <text x="256" y="372" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#0b1020">DEMO</text>
</svg>`;
}

function venue(n, caption = "Demo Club Floor") {
  const [bg, a, b] = palettes[(n - 1) % palettes.length];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#050713"/></linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="80" y="120" width="520" height="480" rx="28" fill="#0a0f1c" stroke="url(#neon)" stroke-width="6"/>
  <rect x="140" y="180" width="400" height="220" rx="18" fill="url(#neon)" opacity="0.35"/>
  <circle cx="900" cy="260" r="140" fill="url(#neon)" opacity="0.55"/>
  <rect x="760" y="420" width="360" height="180" rx="20" fill="#121826" stroke="${a}" stroke-width="4"/>
  <text x="940" y="520" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="48" fill="${a}">TEMP ${n}</text>
  <text x="940" y="570" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#dbe4ff">${caption}</text>
</svg>`;
}

function person(kind, n, label) {
  const [bg, a, b] = palettes[(n - 1) % palettes.length];
  const initial = String(label || kind || "?").slice(0, 1).toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>
  <rect width="512" height="512" fill="${bg}"/>
  <circle cx="256" cy="190" r="96" fill="url(#g)"/>
  <path d="M96 470c24-110 120-160 160-160s136 50 160 160" fill="url(#g)"/>
  <text x="256" y="210" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="84" fill="#0b1020">${initial}</text>
  <text x="256" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#e8eeff">${String(kind).toUpperCase()} ${n}</text>
</svg>`;
}

const roles = [
  ["dj", "DJ"],
  ["waitress", "Waitress"],
  ["waiter", "Waiter"],
  ["promoter", "Promoter"],
  ["bottle", "Bottle"],
  ["admin", "Admin"]
];

for (let n = 1; n <= 10; n += 1) {
  fs.writeFileSync(path.join(dir, `club-${n}-logo.svg`), logo(n));
  fs.writeFileSync(path.join(dir, `club-${n}-venue.svg`), venue(n, "Demo Club Floor"));
  fs.writeFileSync(path.join(dir, `club-${n}-gallery-a.svg`), venue(n, "VIP Room"));
  fs.writeFileSync(path.join(dir, `club-${n}-gallery-b.svg`), venue(((n % 10) + 1), "Entrance"));
  roles.forEach(([kind, label]) => {
    fs.writeFileSync(path.join(dir, `${kind}-${n}.svg`), person(kind, n, label));
  });
}

console.log(`wrote ${fs.readdirSync(dir).length} assets to ${dir}`);
