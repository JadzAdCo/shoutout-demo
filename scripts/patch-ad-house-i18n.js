#!/usr/bin/env node
// Adds the FloqMedia house-card labels after "ad.splash.body" in every chrome pack. Idempotent.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "floqr-i18n.js");
const src = fs.readFileSync(file, "utf8");

const PACKS = {
  "Your shoutout is almost live.": { poweredBy: "Ad Powered by FloqMedia", contactUs: "Contact Us", web: "Web", email: "Email", tel: "Tel", venueBody: "Your ShoutOut goes live after this splash." },
  "Votre ShoutOut est presque en direct.": { poweredBy: "Publicité propulsée par FloqMedia", contactUs: "Contactez-nous", web: "Site web", email: "E-mail", tel: "Tél.", venueBody: "Votre ShoutOut passe en direct après cet écran." },
  "Dein ShoutOut ist fast live.": { poweredBy: "Werbung präsentiert von FloqMedia", contactUs: "Kontakt", web: "Web", email: "E-Mail", tel: "Tel.", venueBody: "Dein ShoutOut geht nach diesem Bildschirm live." },
  "Tu ShoutOut casi está en vivo.": { poweredBy: "Anuncio impulsado por FloqMedia", contactUs: "Contáctanos", web: "Web", email: "Correo", tel: "Tel.", venueBody: "Tu ShoutOut sale en vivo después de esta pantalla." },
  "Je ShoutOut is bijna live.": { poweredBy: "Advertentie mogelijk gemaakt door FloqMedia", contactUs: "Neem contact op", web: "Web", email: "E-mail", tel: "Tel.", venueBody: "Je ShoutOut gaat live na dit scherm." },
  "Ваш ShoutOut почти в эфире.": { poweredBy: "Реклама от FloqMedia", contactUs: "Свяжитесь с нами", web: "Сайт", email: "Эл. почта", tel: "Тел.", venueBody: "Ваш ShoutOut выйдет в эфир после этого экрана." },
  "Il tuo ShoutOut è quasi live.": { poweredBy: "Pubblicità offerta da FloqMedia", contactUs: "Contattaci", web: "Web", email: "Email", tel: "Tel.", venueBody: "Il tuo ShoutOut va live dopo questa schermata." },
  "O seu ShoutOut está quase ao vivo.": { poweredBy: "Anúncio oferecido por FloqMedia", contactUs: "Fale conosco", web: "Site", email: "E-mail", tel: "Tel.", venueBody: "O seu ShoutOut entra ao vivo após este ecrã." },
  "Το ShoutOut σας είναι σχεδόν live.": { poweredBy: "Διαφήμιση από τη FloqMedia", contactUs: "Επικοινωνήστε μαζί μας", web: "Ιστότοπος", email: "Email", tel: "Τηλ.", venueBody: "Το ShoutOut σας βγαίνει live μετά από αυτή την οθόνη." },
  "Twój ShoutOut jest prawie na żywo.": { poweredBy: "Reklama dostarczana przez FloqMedia", contactUs: "Kontakt", web: "Strona", email: "E-mail", tel: "Tel.", venueBody: "Twój ShoutOut pojawi się na żywo po tym ekranie." },
  "ShoutOut الخاص بك على وشك البث المباشر.": { poweredBy: "إعلان مقدم من FloqMedia", contactUs: "اتصل بنا", web: "الموقع", email: "البريد الإلكتروني", tel: "الهاتف", venueBody: "سيُبث ShoutOut الخاص بك مباشرة بعد هذه الشاشة." }
};

if (src.includes('"ad.house.poweredBy"')) {
  console.log("patch-ad-house-i18n: already applied");
  process.exit(0);
}

let changed = 0;
const out = src.replace(/^(\s*)"ad\.splash\.body": "([^"\n]*)",(\r?)$/gm, (line, indent, value, cr) => {
  const pack = PACKS[value];
  if (!pack) return line;
  changed += 1;
  const rows = [
    ["ad.house.poweredBy", pack.poweredBy],
    ["ad.house.contactUs", pack.contactUs],
    ["ad.house.web", pack.web],
    ["ad.house.email", pack.email],
    ["ad.house.tel", pack.tel],
    ["ad.splash.venueBody", pack.venueBody]
  ].map(([key, text]) => `${indent}"${key}": ${JSON.stringify(text)},${cr}`);
  return [line, ...rows].join("\n");
});

if (changed !== Object.keys(PACKS).length) {
  console.error(`patch-ad-house-i18n: expected ${Object.keys(PACKS).length} packs, matched ${changed}`);
  process.exit(1);
}
fs.writeFileSync(file, out, "utf8");
console.log(`patch-ad-house-i18n: added labels to ${changed} packs`);
