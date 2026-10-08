#!/usr/bin/env node
/* Featured staff photo consent — 5 Club Admin chrome keys (11 packs) + consent sentence on help-featured-staff (all help sources). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const read = file => fs.readFileSync(at(file), "utf8");
const write = (file, src) => fs.writeFileSync(at(file), src);

const KEYS = ["consentTitle", "consentNotice", "consentConfirm", "consentRequired", "consentRecorded"];
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const T = {
  en: ["Photo consent",
    "Only publish a staff member's photo if they have agreed to it. Ask each person before you feature them with a photo. Getting this consent is the club's responsibility.",
    "I confirm each featured staff member has agreed to have their photo published on the club page.",
    "Tick the photo consent box before publishing staff photos.",
    "Consent confirmed by {email} on {date}.",
    "Before publishing photos, get each person's agreement and tick the photo consent box."],
  fr: ["Consentement photo",
    "Ne publiez la photo d’un membre du personnel que s’il a donné son accord. Demandez à chaque personne avant de la mettre en avant avec une photo. Obtenir ce consentement relève de la responsabilité du club.",
    "Je confirme que chaque membre du personnel mis en avant a accepté que sa photo soit publiée sur la page du club.",
    "Cochez la case de consentement photo avant de publier des photos du personnel.",
    "Consentement confirmé par {email} le {date}.",
    "Avant de publier des photos, obtenez l’accord de chaque personne et cochez la case de consentement photo."],
  de: ["Foto-Einwilligung",
    "Veröffentliche das Foto einer Person aus dem Personal nur, wenn sie zugestimmt hat. Frage jede Person, bevor du sie mit Foto hervorhebst. Für diese Einwilligung ist der Club verantwortlich.",
    "Ich bestätige, dass jede hervorgehobene Person der Veröffentlichung ihres Fotos auf der Clubseite zugestimmt hat.",
    "Hake das Feld zur Foto-Einwilligung an, bevor du Fotos des Personals veröffentlichst.",
    "Einwilligung bestätigt von {email} am {date}.",
    "Hole vor dem Veröffentlichen von Fotos die Zustimmung jeder Person ein und hake das Feld zur Foto-Einwilligung an."],
  es: ["Consentimiento de fotos",
    "Publica la foto de un miembro del personal solo si ha dado su permiso. Pregunta a cada persona antes de destacarla con una foto. Obtener este consentimiento es responsabilidad del club.",
    "Confirmo que cada miembro del personal destacado ha aceptado que su foto se publique en la página del club.",
    "Marca la casilla de consentimiento de fotos antes de publicar fotos del personal.",
    "Consentimiento confirmado por {email} el {date}.",
    "Antes de publicar fotos, consigue el permiso de cada persona y marca la casilla de consentimiento de fotos."],
  nl: ["Toestemming voor foto’s",
    "Publiceer de foto van een medewerker alleen als die ermee heeft ingestemd. Vraag het iedereen voordat je ze met een foto uitlicht. De club is verantwoordelijk voor deze toestemming.",
    "Ik bevestig dat elke uitgelichte medewerker heeft ingestemd met publicatie van hun foto op de clubpagina.",
    "Vink het vakje voor fototoestemming aan voordat je foto’s van personeel publiceert.",
    "Toestemming bevestigd door {email} op {date}.",
    "Vraag vóór het publiceren van foto’s ieders toestemming en vink het vakje voor fototoestemming aan."],
  ru: ["Согласие на фото",
    "Публикуйте фото сотрудника, только если он дал на это согласие. Спросите каждого, прежде чем показывать его с фото. Получение этого согласия — ответственность клуба.",
    "Я подтверждаю, что каждый выбранный сотрудник согласился на публикацию своего фото на странице клуба.",
    "Отметьте согласие на фото перед публикацией фотографий персонала.",
    "Согласие подтверждено: {email}, {date}.",
    "Перед публикацией фото получите согласие каждого человека и отметьте поле согласия на фото."],
  it: ["Consenso per le foto",
    "Pubblica la foto di un membro del personale solo se ha dato il suo consenso. Chiedi a ogni persona prima di metterla in evidenza con una foto. Ottenere questo consenso è responsabilità del club.",
    "Confermo che ogni membro del personale in evidenza ha accettato la pubblicazione della propria foto sulla pagina del club.",
    "Seleziona la casella del consenso per le foto prima di pubblicare foto del personale.",
    "Consenso confermato da {email} il {date}.",
    "Prima di pubblicare foto, ottieni il consenso di ogni persona e seleziona la casella del consenso per le foto."],
  pt: ["Consentimento de fotos",
    "Publique a foto de alguém da equipe somente se a pessoa concordar. Pergunte a cada pessoa antes de destacá-la com foto. Obter esse consentimento é responsabilidade do clube.",
    "Confirmo que cada pessoa da equipe em destaque concordou com a publicação da sua foto na página do clube.",
    "Marque a caixa de consentimento de fotos antes de publicar fotos da equipe.",
    "Consentimento confirmado por {email} em {date}.",
    "Antes de publicar fotos, obtenha a concordância de cada pessoa e marque a caixa de consentimento de fotos."],
  el: ["Συγκατάθεση για φωτογραφίες",
    "Δημοσιεύστε τη φωτογραφία ενός μέλους του προσωπικού μόνο αν έχει συμφωνήσει. Ρωτήστε κάθε άτομο πριν το προβάλετε με φωτογραφία. Η λήψη αυτής της συγκατάθεσης είναι ευθύνη του κλαμπ.",
    "Επιβεβαιώνω ότι κάθε προβεβλημένο μέλος του προσωπικού έχει συμφωνήσει να δημοσιευτεί η φωτογραφία του στη σελίδα του κλαμπ.",
    "Επιλέξτε το πλαίσιο συγκατάθεσης για φωτογραφίες πριν δημοσιεύσετε φωτογραφίες του προσωπικού.",
    "Η συγκατάθεση επιβεβαιώθηκε από {email} στις {date}.",
    "Πριν δημοσιεύσετε φωτογραφίες, πάρτε τη συμφωνία κάθε ατόμου και επιλέξτε το πλαίσιο συγκατάθεσης."],
  pl: ["Zgoda na zdjęcia",
    "Publikuj zdjęcie pracownika tylko wtedy, gdy wyraził na to zgodę. Zapytaj każdą osobę, zanim wyróżnisz ją ze zdjęciem. Uzyskanie tej zgody jest obowiązkiem klubu.",
    "Potwierdzam, że każda wyróżniona osoba z personelu zgodziła się na publikację swojego zdjęcia na stronie klubu.",
    "Zaznacz pole zgody na zdjęcia przed opublikowaniem zdjęć personelu.",
    "Zgodę potwierdził(a) {email}, {date}.",
    "Przed opublikowaniem zdjęć uzyskaj zgodę każdej osoby i zaznacz pole zgody na zdjęcia."],
  ar: ["الموافقة على الصور",
    "لا تنشر صورة أحد أفراد الطاقم إلا إذا وافق على ذلك. اسأل كل شخص قبل إبرازه بصورة. الحصول على هذه الموافقة مسؤولية النادي.",
    "أؤكد أن كل فرد من الطاقم المميز وافق على نشر صورته في صفحة النادي.",
    "حدّد مربع الموافقة على الصور قبل نشر صور الطاقم.",
    "أكّد الموافقة {email} بتاريخ {date}.",
    "قبل نشر الصور، احصل على موافقة كل شخص وحدّد مربع الموافقة على الصور."]
};

const q = s => JSON.stringify(s);

// Chrome keys after each "featuredStaff.saveHint" line, packs in file order.
let chrome = read("floqr-i18n.js");
const hintLine = /^(\s*)"featuredStaff\.saveHint": .*,\r?\n/gm;
const hits = [...chrome.matchAll(hintLine)];
if (hits.length !== CHROME_ORDER.length) throw new Error(`saveHint hits ${hits.length}`);
if (chrome.includes('"featuredStaff.consentTitle"')) throw new Error("consent keys already present");
const eol = chrome.includes("\r\n") ? "\r\n" : "\n";
let offset = 0;
hits.forEach((m, i) => {
  const lang = CHROME_ORDER[i];
  const indent = m[1];
  const block = KEYS.map((key, k) => `${indent}"featuredStaff.${key}": ${q(T[lang][k])},${eol}`).join("");
  const pos = m.index + m[0].length + offset;
  chrome = chrome.slice(0, pos) + block + chrome.slice(pos);
  offset += block.length;
});
write("floqr-i18n.js", chrome);

// Help body: append the consent sentence.
const EN_BODY = "Tick the staff you want on your public club page. For each person, tap one of their FLOQR photos or choose Upload from computer. You can change the role shown under their name. Press Save Public Profile to publish your changes.";
const EN_NEW = `${EN_BODY} ${T.en[5]}`;
for (const file of ["floqai-help-repository.js", "admin.html", "scripts/_help-en.json"]) {
  const src = read(file);
  if (src.split(EN_BODY).length !== 2) throw new Error(`${file}: English help body not found once`);
  write(file, src.replace(EN_BODY, EN_NEW));
}
let help = read("floqr-i18n-help.js");
const helpRe = /("help-featured-staff": \{\s*title: "[^"]*",\s*body: ")([^"]*)(")/g;
const helpHits = [...help.matchAll(helpRe)];
if (helpHits.length !== 10) throw new Error(`help hits ${helpHits.length}`);
const HELP_ORDER = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
let i = 0;
help = help.replace(helpRe, (_, a, body, c) => `${a}${body} ${T[HELP_ORDER[i++]][5]}${c}`);
write("floqr-i18n-help.js", help);
console.log("consent chrome keys x11 + help sentence x11");
