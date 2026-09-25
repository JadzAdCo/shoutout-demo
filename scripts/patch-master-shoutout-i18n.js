/**
 * Insert master.shoutoutCompletedLog + master.shoutoutRetention into every CHROME pack.
 */
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "floqr-i18n.js");
let src = fs.readFileSync(file, "utf8");

const translations = {
  en: { completed: "Completed Log", retention: "Retention" },
  fr: { completed: "Journal terminé", retention: "Rétention" },
  de: { completed: "Abgeschlossenes Protokoll", retention: "Aufbewahrung" },
  es: { completed: "Registro completado", retention: "Retención" },
  nl: { completed: "Voltooide log", retention: "Retentie" },
  ru: { completed: "Журнал завершённых", retention: "Хранение" },
  it: { completed: "Registro completato", retention: "Conservazione" },
  pt: { completed: "Registo concluído", retention: "Retenção" },
  el: { completed: "Ολοκληρωμένο αρχείο", retention: "Διατήρηση" },
  pl: { completed: "Dziennik zakończonych", retention: "Retencja" },
  ar: { completed: "سجل المكتمل", retention: "الاحتفاظ" }
};

const needle = '"master.shoutouts":';
let inserts = 0;
const langs = Object.keys(translations);
let langIdx = 0;

src = src.replace(/"master\.shoutouts":\s*"[^"]*",/g, match => {
  const lang = langs[langIdx] || "en";
  langIdx += 1;
  const t = translations[lang] || translations.en;
  if (match.includes("master.shoutoutCompletedLog")) return match;
  inserts += 1;
  return `${match}\n      "master.shoutoutCompletedLog": "${t.completed}",\n      "master.shoutoutRetention": "${t.retention}",`;
});

if (inserts !== 11) {
  console.error(`Expected 11 language inserts, got ${inserts}`);
  process.exit(1);
}

fs.writeFileSync(file, src);
console.log(`Inserted Completed Log / Retention chrome keys into ${inserts} packs`);
