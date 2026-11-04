#!/usr/bin/env node
/* Build Baller's Express + private Amex black-metal card SVGs.
 * Public: Baller's Express. Private Amex: Master Admin + Aurelia only (pending consent).
 * Outputs 2:1 and 4:3 for blackCard / ballersAlert (+ -amex twins). */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "images", "baller");

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

  const borderPad = Math.round(Math.min(w, h) * 0.028);
  const innerPad = borderPad + Math.round(Math.min(w, h) * 0.018);

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
    <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8e4d8"/>
      <stop offset=".5" stop-color="#b7a878"/>
      <stop offset="1" stop-color="#7a6a3a"/>
    </linearGradient>
    <pattern id="micro" width="110" height="14" patternUnits="userSpaceOnUse">
      <text x="0" y="11" font-family="Arial,Helvetica,sans-serif" font-size="7" fill="#2a2a2e" letter-spacing="1">${micro}</text>
    </pattern>
    <filter id="emboss" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.2" stdDeviation="0.6" flood-color="#000" flood-opacity=".55"/>
      <feDropShadow dx="0" dy="-0.6" stdDeviation="0.4" flood-color="#fff" flood-opacity=".18"/>
    </filter>
  </defs>

  <rect width="${w}" height="${h}" rx="${Math.round(h * 0.06)}" fill="url(#metal)"/>
  <rect width="${w}" height="${h}" rx="${Math.round(h * 0.06)}" fill="url(#micro)" opacity=".55"/>

  <rect x="${borderPad}" y="${borderPad}" width="${w - borderPad * 2}" height="${h - borderPad * 2}"
        rx="${Math.round(h * 0.045)}" fill="none" stroke="url(#silver)" stroke-width="${Math.max(2, h * 0.008)}"/>
  <rect x="${innerPad}" y="${innerPad}" width="${w - innerPad * 2}" height="${h - innerPad * 2}"
        rx="${Math.round(h * 0.035)}" fill="none" stroke="#6a6a72" stroke-width="1" opacity=".7"/>

  <circle cx="${medCx}" cy="${medCy}" r="${medR}" fill="#0d0d10" stroke="url(#silver)" stroke-width="${Math.max(2, h * 0.01)}"/>
  <circle cx="${medCx}" cy="${medCy}" r="${medR * 0.92}" fill="#151518" stroke="#3a3a40" stroke-width="1"/>
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

  <text x="${w * 0.5}" y="${h - borderPad * 0.55}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.round(h * 0.022)}" fill="#4a4a52">${footer}</text>
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
