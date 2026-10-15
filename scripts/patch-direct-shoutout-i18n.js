#!/usr/bin/env node
// Adds "app.directShoutoutUnavailable" after "page.clubProfile.shoutout" in every chrome pack. Idempotent.
// Usage: node scripts/patch-direct-shoutout-i18n.js [repoRoot]
"use strict";
const fs = require("fs");
const path = require("path");

const KEY = "app.directShoutoutUnavailable";
const PACKS = {
  "Throw a ShoutOut": "That venue isn't available for ShoutOuts right now. Search for another venue below.",
  "Lancer un ShoutOut": "Ce lieu n'accepte pas de ShoutOut pour le moment. Recherchez un autre lieu ci-dessous.",
  "Einen ShoutOut senden": "Diese Location ist für ShoutOuts gerade nicht verfügbar. Suche unten nach einer anderen Location.",
  "Enviar un ShoutOut": "Ese local no está disponible para ShoutOuts en este momento. Busca otro local abajo.",
  "Een ShoutOut sturen": "Deze locatie is nu niet beschikbaar voor ShoutOuts. Zoek hieronder een andere locatie.",
  "Отправить ShoutOut": "Это заведение сейчас не принимает ShoutOut. Найдите другое заведение ниже.",
  "Lancia un ShoutOut": "Questo locale non è disponibile per gli ShoutOut in questo momento. Cerca un altro locale qui sotto.",
  "Jogar um ShoutOut": "Este local não está disponível para ShoutOuts neste momento. Pesquise outro local abaixo.",
  "Ρίξε ένα ShoutOut": "Αυτός ο χώρος δεν είναι διαθέσιμος για ShoutOut αυτή τη στιγμή. Αναζητήστε άλλο χώρο παρακάτω.",
  "Rzuć ShoutOut": "Ten lokal nie przyjmuje teraz ShoutOutów. Wyszukaj inny lokal poniżej.",
  "ارمِ ShoutOut": "هذا المكان غير متاح لـ ShoutOut حاليًا. ابحث عن مكان آخر أدناه."
};

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const file = path.join(root, "floqr-i18n.js");
const src = fs.readFileSync(file, "utf8");

if (src.includes(`"${KEY}"`)) {
  console.log("patch-direct-shoutout-i18n: already applied");
  process.exit(0);
}

let changed = 0;
const out = src.replace(/^(\s*)"page\.clubProfile\.shoutout": "([^"\n]*)",(\r?)$/gm, (line, indent, value, cr) => {
  const text = PACKS[value];
  if (!text) return line;
  changed += 1;
  return `${line}\n${indent}"${KEY}": ${JSON.stringify(text)},${cr}`;
});

if (changed !== Object.keys(PACKS).length) {
  console.error(`patch-direct-shoutout-i18n: expected ${Object.keys(PACKS).length} packs, matched ${changed}`);
  process.exit(1);
}
fs.writeFileSync(file, out, "utf8");
console.log(`patch-direct-shoutout-i18n: added ${KEY} to ${changed} packs`);
