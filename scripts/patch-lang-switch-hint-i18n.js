#!/usr/bin/env node
/* Adds lang.switchHint (App language Save preview) to every chrome pack. Idempotent. */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "floqr-i18n.js");
const HINTS = [
  ["FloqR language set to {native}.", "Tap Save to switch FloqR to {native}."],
  ["Langue FloqR définie sur {native}.", "Touchez Enregistrer pour passer FloqR en {native}."],
  ["FloqR-Sprache auf {native} gesetzt.", "Tippe auf Speichern, um FloqR auf {native} umzustellen."],
  ["Idioma de FloqR establecido en {native}.", "Toca Guardar para cambiar FloqR a {native}."],
  ["FloqR-taal ingesteld op {native}.", "Tik op Opslaan om de taal van FloqR in te stellen op {native}."],
  ["Язык FloqR установлен: {native}.", "Нажмите «Сохранить», чтобы переключить FloqR на язык: {native}."],
  ["Lingua FloqR impostata su {native}.", "Tocca Salva per impostare FloqR su {native}."],
  ["Idioma do FloqR definido como {native}.", "Toque em Salvar para mudar o FloqR para {native}."],
  ["Η γλώσσα FloqR έχει οριστεί σε {native}.", "Πατήστε Αποθήκευση για να αλλάξει η γλώσσα του FloqR σε {native}."],
  ["Język FloqR ustawiono na {native}.", "Stuknij Zapisz, aby przełączyć FloqR na język: {native}."],
  ["تم ضبط لغة FloqR على {native}.", "اضغط حفظ لتغيير لغة FloqR إلى {native}."]
];

let src = fs.readFileSync(file, "utf8");
let added = 0;
for (const [saved, hint] of HINTS) {
  const line = `"lang.languageSaved": ${JSON.stringify(saved)},`;
  const at = src.indexOf(line);
  if (at < 0) throw new Error(`Pack anchor not found: ${saved}`);
  const lineEnd = src.indexOf("\n", at);
  const nextLine = src.slice(lineEnd + 1, src.indexOf("\n", lineEnd + 1));
  if (nextLine.includes('"lang.switchHint"')) continue;
  const indent = src.slice(src.lastIndexOf("\n", at) + 1, at);
  src = `${src.slice(0, lineEnd + 1)}${indent}"lang.switchHint": ${JSON.stringify(hint)},\n${src.slice(lineEnd + 1)}`;
  added += 1;
}
fs.writeFileSync(file, src);
console.log(`lang.switchHint added to ${added} packs`);
