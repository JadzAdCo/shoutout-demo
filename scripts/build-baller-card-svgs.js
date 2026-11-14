#!/usr/bin/env node
/* Build Baller's Express + private Amex black-metal card SVGs.
 * Public: Baller's Express. Private Amex: Master Admin + Aurelia only (pending consent).
 * Outputs 2:1 and 4:3 for blackCard / ballersAlert (+ -amex twins).
 * Gold ornate perimeter filigree matches Centurion-style card frame. */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "images", "baller");

/** Corner flourish path (relative to a corner origin; mirrored via transforms). */
function cornerFlourish(size) {
  const s = size;
  // Scroll / guilloche corner like Centurion frame
  return [
    `M0,${s * 0.55}`,
    `C${s * 0.08},${s * 0.55} ${s * 0.18},${s * 0.48} ${s * 0.22},${s * 0.35}`,
    `C${s * 0.28},${s * 0.18} ${s * 0.42},${s * 0.1} ${s * 0.55},${s * 0.1}`,
    `M${s * 0.12},${s * 0.42}`,
    `C${s * 0.2},${s * 0.42} ${s * 0.28},${s * 0.34} ${s * 0.3},${s * 0.26}`,
    `C${s * 0.34},${s * 0.16} ${s * 0.42},${s * 0.14} ${s * 0.5},${s * 0.14}`,
    `M${s * 0.08},${s * 0.28} Q${s * 0.18},${s * 0.08} ${s * 0.38},${s * 0.08}`,
    `M${s * 0.02},${s * 0.18} Q${s * 0.12},${s * 0.02} ${s * 0.28},${s * 0.02}`
  ].join(" ");
}

function cardSvg({ w, h, variant, brand }) {
  const isAlert = variant === "ballersAlert";
  const isAmex = brand === "amex";
  const brandName = isAmex ? "AMERICAN EXPRESS" : "BALLER'S EXPRESS";
  const medCx = w * 0.17;
  const medCy = h * 0.28;
  const medR = Math.min(w, h) * (isAlert ? 0.16 : 0.11);
  const brandX = isAlert ? w * 0.42 : w * 0.52;
  const brandY = h * 0.16;
  const expYear = isAlert ? "50" : "28";
  const micro = brandName;
  const num = "8721  448291  55021";
  const cid = "9042";
  const title = `${brandName} ${isAlert ? "Baller's Alert" : "Black Card"}${isAmex ? " (private)" : ""}`;
  const footer = isAmex
    ? "© AMERICAN EXPRESS · FLOQR PRIVATE PREVIEW"
    : "© BALLER'S EXPRESS · FLOQR SHOUTOUT";
  const brandSize = Math.round(h * (isAmex ? 0.05 : 0.055));

  const rim = Math.max(3, Math.round(Math.min(w, h) * 0.014));
  const borderPad = Math.round(Math.min(w, h) * 0.034);
  const midPad = borderPad + Math.round(Math.min(w, h) * 0.012);
  const innerPad = midPad + Math.round(Math.min(w, h) * 0.014);
  const flourish = Math.round(Math.min(w, h) * 0.11);
  const rxOuter = Math.round(h * 0.06);
  const rxMid = Math.round(h * 0.048);
  const rxInner = Math.round(h * 0.038);
  const strokeOuter = Math.max(2.5, h * 0.009);
  const strokeMid = Math.max(1.5, h * 0.0055);
  const strokeInner = Math.max(1.2, h * 0.004);
  const motifW = Math.max(28, Math.round(Math.min(w, h) * 0.045));
  const motifH = Math.max(10, Math.round(Math.min(w, h) * 0.016));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
  <title>${title}</title>
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1a1c"/>
      <stop offset=".35" stop-color="#0a0a0b"/>
      <stop offset=".7" stop-color="#121214"/>
      <stop offset="1" stop-color="#050506"/>
    </linearGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5f5f7"/>
      <stop offset=".45" stop-color="#c8c8ce"/>
      <stop offset="1" stop-color="#8e8e96"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff1c2"/>
      <stop offset=".22" stop-color="#e8c872"/>
      <stop offset=".5" stop-color="#c9a227"/>
      <stop offset=".78" stop-color="#8a6814"/>
      <stop offset="1" stop-color="#f0d78a"/>
    </linearGradient>
    <linearGradient id="goldSoft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7e7b0"/>
      <stop offset=".5" stop-color="#d4af37"/>
      <stop offset="1" stop-color="#9a7420"/>
    </linearGradient>
    <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8e4d8"/>
      <stop offset=".5" stop-color="#b7a878"/>
      <stop offset="1" stop-color="#7a6a3a"/>
    </linearGradient>
    <pattern id="micro" width="110" height="14" patternUnits="userSpaceOnUse">
      <text x="0" y="11" font-family="Arial,Helvetica,sans-serif" font-size="7" fill="#2a2a2e" letter-spacing="1">${micro}</text>
    </pattern>
    <pattern id="filigree" width="${motifW}" height="${motifH}" patternUnits="userSpaceOnUse">
      <path d="M2,${motifH * 0.55} C${motifW * 0.18},${motifH * 0.1} ${motifW * 0.32},${motifH * 0.95} ${motifW * 0.5},${motifH * 0.5}
               C${motifW * 0.68},${motifH * 0.05} ${motifW * 0.82},${motifH * 0.9} ${motifW - 2},${motifH * 0.45}"
            fill="none" stroke="url(#goldSoft)" stroke-width="1.15" opacity=".95"/>
      <circle cx="${motifW * 0.5}" cy="${motifH * 0.5}" r="1.15" fill="url(#gold)"/>
      <path d="M${motifW * 0.22},${motifH * 0.5} Q${motifW * 0.5},${motifH * 0.15} ${motifW * 0.78},${motifH * 0.5}"
            fill="none" stroke="#f5e6b0" stroke-width="0.7" opacity=".55"/>
    </pattern>
    <filter id="emboss" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.2" stdDeviation="0.6" flood-color="#000" flood-opacity=".55"/>
      <feDropShadow dx="0" dy="-0.6" stdDeviation="0.4" flood-color="#fff" flood-opacity=".18"/>
    </filter>
    <filter id="goldGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="#d4af37" flood-opacity=".35"/>
    </filter>
  </defs>

  <rect width="${w}" height="${h}" rx="${rxOuter}" fill="url(#metal)"/>
  <rect width="${w}" height="${h}" rx="${rxOuter}" fill="url(#micro)" opacity=".55"/>

  <!-- Gold rim (outer edge of the metal plate) -->
  <rect x="${rim / 2}" y="${rim / 2}" width="${w - rim}" height="${h - rim}"
        rx="${rxOuter - 2}" fill="none" stroke="url(#gold)" stroke-width="${rim}" filter="url(#goldGlow)"/>

  <!-- Ornate gold filigree band -->
  <rect x="${borderPad}" y="${borderPad}" width="${w - borderPad * 2}" height="${h - borderPad * 2}"
        rx="${rxMid}" fill="none" stroke="url(#filigree)" stroke-width="${Math.max(6, h * 0.022)}"/>
  <rect x="${borderPad}" y="${borderPad}" width="${w - borderPad * 2}" height="${h - borderPad * 2}"
        rx="${rxMid}" fill="none" stroke="url(#gold)" stroke-width="${strokeOuter}" opacity=".95"/>

  <!-- Mid + inner gold rules -->
  <rect x="${midPad}" y="${midPad}" width="${w - midPad * 2}" height="${h - midPad * 2}"
        rx="${rxInner}" fill="none" stroke="url(#goldSoft)" stroke-width="${strokeMid}" opacity=".85"/>
  <rect x="${innerPad}" y="${innerPad}" width="${w - innerPad * 2}" height="${h - innerPad * 2}"
        rx="${Math.round(h * 0.03)}" fill="none" stroke="url(#gold)" stroke-width="${strokeInner}" opacity=".7"/>

  <!-- Corner flourishes -->
  <g fill="none" stroke="url(#gold)" stroke-width="${Math.max(1.2, h * 0.0035)}" stroke-linecap="round" opacity=".95">
    <path d="${cornerFlourish(flourish)}" transform="translate(${borderPad + 2},${borderPad + 2})"/>
    <path d="${cornerFlourish(flourish)}" transform="translate(${w - borderPad - 2},${borderPad + 2}) scale(-1,1)"/>
    <path d="${cornerFlourish(flourish)}" transform="translate(${borderPad + 2},${h - borderPad - 2}) scale(1,-1)"/>
    <path d="${cornerFlourish(flourish)}" transform="translate(${w - borderPad - 2},${h - borderPad - 2}) scale(-1,-1)"/>
  </g>

  <circle cx="${medCx}" cy="${medCy}" r="${medR}" fill="#0d0d10" stroke="url(#gold)" stroke-width="${Math.max(2, h * 0.01)}"/>
  <circle cx="${medCx}" cy="${medCy}" r="${medR * 0.92}" fill="#151518" stroke="#8a6814" stroke-width="1" opacity=".85"/>
  ${isAlert ? `
  <circle cx="${medCx}" cy="${medCy}" r="${medR * 0.88}" fill="#1c1c22" class="baller-face-hole"/>
  <text x="${medCx}" y="${medCy + h * 0.012}" text-anchor="middle" font-family="Georgia,serif" font-size="${Math.round(h * 0.035)}" fill="#6a6a72">FACE</text>
  ` : `
  <g transform="translate(${medCx},${medCy})" fill="url(#silver)" opacity=".9">
    <ellipse cx="0" cy="8" rx="${medR * 0.38}" ry="${medR * 0.48}"/>
    <path d="M${-medR * 0.42},${-medR * 0.05} Q0,${-medR * 0.75} ${medR * 0.42},${-medR * 0.05} L${medR * 0.28},${medR * 0.15} Q0,${-medR * 0.15} ${-medR * 0.28},${medR * 0.15} Z"/>
    <path d="M${-medR * 0.08},${-medR * 0.55} L0,${-medR * 0.85} L${medR * 0.08},${-medR * 0.55} Z" opacity=".85"/>
  </g>
  `}

  <g transform="translate(${medCx - medR * 0.55}, ${medCy + medR * 1.15})">
    <rect width="${medR * 1.1}" height="${medR * 0.85}" rx="4" fill="url(#chip)" stroke="#5a4a28" stroke-width="1"/>
    <path d="M${medR * 0.15},0 V${medR * 0.85} M${medR * 0.55},0 V${medR * 0.85} M${medR * 0.95},0 V${medR * 0.85} M0,${medR * 0.28} H${medR * 1.1} M0,${medR * 0.55} H${medR * 1.1}" stroke="#4a3a18" stroke-width="1" opacity=".55"/>
  </g>

  <g transform="translate(${brandX},${brandY})" filter="url(#emboss)">
    <text x="0" y="0" font-family="Arial Black,Impact,Arial,sans-serif" font-size="${brandSize}" fill="url(#silver)" letter-spacing="${w * 0.003}">${brandName}</text>
    <text x="0" y="${Math.round(h * 0.095)}" font-family="Georgia,'Times New Roman',serif" font-size="${Math.round(h * 0.11)}" fill="url(#silver)" letter-spacing="${w * 0.012}" font-weight="700">BUSINESS</text>
  </g>

  <text x="${w * 0.12}" y="${h * 0.62}" font-family="'Courier New',Courier,monospace" font-size="${Math.round(h * 0.085)}" fill="url(#silver)" letter-spacing="${w * 0.006}" filter="url(#emboss)">${num}</text>
  <text x="${w * 0.78}" y="${h * 0.62}" font-family="'Courier New',Courier,monospace" font-size="${Math.round(h * 0.045)}" fill="#a8a8b0">${cid}</text>

  <g fill="url(#silver)" font-family="Arial,Helvetica,sans-serif">
    <text x="${w * 0.12}" y="${h * 0.72}" font-size="${Math.round(h * 0.028)}" fill="#8a8a92" letter-spacing="1">Valid Thru</text>
    <text x="${w * 0.12}" y="${h * 0.785}" font-size="${Math.round(h * 0.055)}" font-family="'Courier New',Courier,monospace" filter="url(#emboss)">02/${expYear}</text>
    <text x="${w * 0.42}" y="${h * 0.72}" font-size="${Math.round(h * 0.028)}" fill="#8a8a92" letter-spacing="1">Member Since</text>
    <text x="${w * 0.42}" y="${h * 0.785}" font-size="${Math.round(h * 0.055)}" font-family="'Courier New',Courier,monospace" filter="url(#emboss)">05</text>
  </g>

  <text x="${w * 0.12}" y="${h * 0.88}" font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(h * 0.045)}" fill="#3a3a40" letter-spacing="2" class="baller-name-guide">CARDHOLDER NAME</text>
  <text x="${w * 0.12}" y="${h * 0.94}" font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(h * 0.035)}" fill="#2e2e34" letter-spacing="1" class="baller-company-guide">COMPANY</text>

  <text x="${w * 0.5}" y="${h - borderPad * 0.45}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.round(h * 0.022)}" fill="#4a4a52">${footer}</text>
</svg>
`;
}

function write(name, contents) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, contents);
  console.log("wrote", path.relative(ROOT, file), `(${contents.length} bytes)`);
}

fs.mkdirSync(OUT, {recursive: true});

const sizes = [
  {suffix: "2x1", w: 1600, h: 800},
  {suffix: "4x3", w: 1200, h: 900}
];

for (const {suffix, w, h} of sizes) {
  write(`black-card-${suffix}.svg`, cardSvg({w, h, variant: "blackCard", brand: "ballers"}));
  write(`ballers-alert-${suffix}.svg`, cardSvg({w, h, variant: "ballersAlert", brand: "ballers"}));
  write(`black-card-amex-${suffix}.svg`, cardSvg({w, h, variant: "blackCard", brand: "amex"}));
  write(`ballers-alert-amex-${suffix}.svg`, cardSvg({w, h, variant: "ballersAlert", brand: "amex"}));
}

console.log("done");
