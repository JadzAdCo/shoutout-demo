#!/usr/bin/env node
/* s3.1.17 — swap the VIP Maya room + busboy gallery photos in a main-line floqr-temp-qa-showcase.js. */
"use strict";

const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("usage: node apply-s3-1-17-showcase-gallery.js <path/to/floqr-temp-qa-showcase.js>");
  process.exit(2);
}

const MAYA_TITLE = "VIP table — Maya's birthday crew + portrait LED wall";
const MAYA_CARRY_TITLE = "Go Maya — BusBoy with the Papi's ClubTech 64x48 photo ShoutOut";
const BUSBOY_TITLE = "BusBoy - Papi's ClubTech Led 64x48 Mobile display";

const swaps = [
  [
    `    dualLed: "club-aurelia-dual-led.png",\n`,
    `    dualLed: "club-aurelia-vip-maya-guests.jpg",\n    dualLedCarry: "club-aurelia-vip-maya-busboy-64x48.jpg",\n    busboyLed: "busboy-papis-clubtech-64x48.jpg",\n`
  ],
  [
    `{mediaUrl: url(PHOTOS.dualLed), mediaType: "image", slotType: "gallery", title: "VIP table LED + portrait wall in one room", galleryOrder: 6},`,
    `{mediaUrl: url(PHOTOS.dualLed), mediaType: "image", slotType: "gallery", title: "${MAYA_TITLE}", galleryOrder: 6},\n        {mediaUrl: url(PHOTOS.dualLedCarry), mediaType: "image", slotType: "gallery", title: "${MAYA_CARRY_TITLE}", galleryOrder: 7},`
  ],
  ...[
    ["galleryA", "VIP Room", 7], ["galleryB", "Entrance", 8], ["venue", "Main room", 9]
  ].map(([src, title, order]) => [
    `{mediaUrl: ${src}, mediaType: "image", slotType: "gallery", title: "${title}", galleryOrder: ${order}}`,
    `{mediaUrl: ${src}, mediaType: "image", slotType: "gallery", title: "${title}", galleryOrder: ${order + 1}}`
  ]),
  ...[
    ["PHOTOS.bartenderPour", "Barman", 10], ["PHOTOS.waitressFloor(n)", "Waitress on the floor", 11],
    ["PHOTOS.djBooth(n)", "Resident DJ booth", 12], ["PHOTOS.bottleExtra(n)", "Bottle service", 13],
    ["PHOTOS.waiterTable(n)", "VIP waiter", 14]
  ].map(([src, title, order]) => [
    `{mediaUrl: url(${src}), mediaType: "image", slotType: "gallery", title: "${title}", galleryOrder: ${order}}`,
    `{mediaUrl: url(${src}), mediaType: "image", slotType: "gallery", title: "${title}", galleryOrder: ${order + 1}}`
  ]),
  [
    `{mediaUrl: url(PHOTOS.busboy(n)), mediaType: "image", slotType: "gallery", title: "Busboy — DonPapi LED wall", galleryOrder: 15}`,
    `{mediaUrl: url(PHOTOS.busboyLed), mediaType: "image", slotType: "gallery", title: "${BUSBOY_TITLE}", galleryOrder: 16}`
  ]
];

const eol = fs.readFileSync(file, "utf8").includes("\r\n") ? "\r\n" : "\n";
let src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
for (const [from, to] of swaps) {
  const hits = src.split(from).length - 1;
  if (hits !== 1) {
    console.error(`Expected exactly one match (found ${hits}): ${from.slice(0, 120)}`);
    process.exit(1);
  }
  src = src.replace(from, to);
}
fs.writeFileSync(file, eol === "\r\n" ? src.replace(/\n/g, "\r\n") : src);
console.log(`Applied ${swaps.length} gallery swaps to ${file}`);
