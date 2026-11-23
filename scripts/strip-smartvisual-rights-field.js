#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const write = (rel, src) => fs.writeFileSync(path.join(ROOT, rel), src);

const CREATE_BODY = {
  ru: "Создайте или измените черновик SMARTstencil или SMARTbackground. Название обязательно. SMARTstencils только SVG. SMARTbackgrounds: SVG, JPEG, PNG или WebP. Файлы очищаются на сервере. Черновики не видны гостям до проверенной публикации. Это иллюстрация FLOQR, не фото и не официальный знак места или Fashion Week.",
  nl: "Maak of bewerk een SMARTstencil- of SMARTbackground-concept. Naam is verplicht. SMARTstencils moeten SVG zijn. SMARTbackgrounds accepteren SVG, JPEG, PNG of WebP. Bestanden worden op de server schoongemaakt. Concepten bereiken gasten pas na een gecontroleerde publicatie. De scene is FLOQR-illustratie, geen foto en geen officieel bestemming- of Fashion Week-merkteken.",
  fr: "Créez ou modifiez un brouillon SMARTstencil ou SMARTbackground. Le nom est requis. Les SMARTstencils doivent être en SVG. Les SMARTbackgrounds acceptent SVG, JPEG, PNG ou WebP. Les fichiers sont nettoyés côté serveur. Les brouillons n’atteignent pas les patrons avant une publication auditée. L’art est une illustration FLOQR, pas une photo ni une marque officielle de destination ou de Fashion Week.",
  de: "Erstellen oder bearbeiten Sie einen SMARTstencil- oder SMARTbackground-Entwurf. Name ist Pflicht. SMARTstencils müssen SVG sein. SMARTbackgrounds akzeptieren SVG, JPEG, PNG oder WebP. Dateien werden serverseitig geprüft. Entwürfe erreichen Gäste erst nach geprüfter Veröffentlichung. Die Szene ist FLOQR-Illustration, kein Foto und kein offizielles Destinations- oder Fashion-Week-Zeichen.",
  es: "Cree o edite un borrador de SMARTstencil o SMARTbackground. El nombre es obligatorio. Los SMARTstencils deben ser SVG. Los SMARTbackgrounds aceptan SVG, JPEG, PNG o WebP. Los archivos se sanitizan en el servidor. Los borradores no llegan a patrons hasta una publicación auditada. El arte es ilustración FLOQR, no fotografía ni una marca oficial de destino o Fashion Week.",
  it: "Crea o modifica una bozza SMARTstencil o SMARTbackground. Il nome è obbligatorio. Gli SMARTstencils devono essere SVG. Gli SMARTbackgrounds accettano SVG, JPEG, PNG o WebP. I file sono sanificati sul server. Le bozze non arrivano ai patron prima di una pubblicazione con audit. L’arte è illustrazione FLOQR, non foto né un marchio ufficiale di destinazione o Fashion Week.",
  pt: "Crie ou edite um rascunho SMARTstencil ou SMARTbackground. O nome é obrigatório. SMARTstencils têm de ser SVG. SMARTbackgrounds aceitam SVG, JPEG, PNG ou WebP. Os ficheiros são limpos no servidor. Rascunhos não chegam a patrons até uma publicação auditada. A arte é ilustração FLOQR, não fotografia nem marca oficial de destino ou Fashion Week.",
  el: "Δημιουργήστε ή επεξεργαστείτε προσχέδιο SMARTstencil ή SMARTbackground. Το όνομα είναι υποχρεωτικό. Τα SMARTstencils πρέπει να είναι SVG. Τα SMARTbackgrounds δέχονται SVG, JPEG, PNG ή WebP. Τα αρχεία καθαρίζονται στον διακομιστή. Τα προσχέδια δεν φτάνουν στους patrons πριν από ελεγμένη δημοσίευση. Η τέχνη είναι εικονογράφηση FLOQR, όχι φωτογραφία ούτε επίσημο σήμα προορισμού ή Fashion Week.",
  pl: "Utwórz lub edytuj szkic SMARTstencil albo SMARTbackground. Nazwa jest wymagana. SMARTstencils muszą być SVG. SMARTbackgrounds przyjmują SVG, JPEG, PNG lub WebP. Pliki są czyszczone na serwerze. Szkice nie trafiają do gości przed audytowaną publikacją. To ilustracja FLOQR, nie zdjęcie i nie oficjalny znak destynacji ani Fashion Week.",
  ar: "أنشئ أو عدّل مسودة SMARTstencil أو SMARTbackground. الاسم مطلوب. يجب أن تكون SMARTstencils بصيغة SVG. تقبل SMARTbackgrounds SVG أو JPEG أو PNG أو WebP. تُنظَّف الملفات على الخادم. لا تصل المسودات إلى الرواد قبل نشر مُدقَّق. الفن رسم FLOQR وليس صورة ولا علامة رسمية لوجهة أو لأسبوع الموضة."
};

const CREATE_EN =
  "Create or edit a SMARTstencil or SMARTbackground draft. Name is required. SMARTstencils must be SVG. SMARTbackgrounds accept SVG, JPEG, PNG, or WebP. Files are sanitized on the server. Drafts stay off patrons until an audited publish. Scenic art is FLOQR illustration, not photography and not an official destination or Fashion Week mark.";

const NEED_META = [
  ["Name and rights / source are required.", "Name is required."],
  ["Le nom et Droits / source sont requis.", "Le nom est requis."],
  ["Name und Rechte / Quelle sind Pflicht.", "Name ist Pflicht."],
  ["El nombre y Derechos / fuente son obligatorios.", "El nombre es obligatorio."],
  ["Naam en Rechten / bron zijn verplicht.", "Naam is verplicht."],
  ["Нужны название и Права / источник.", "Нужно название."],
  ["Nome e Diritti / fonte sono obbligatori.", "Il nome è obbligatorio."],
  ["Nome e Direitos / origem são obrigatórios.", "O nome é obrigatório."],
  ["Το όνομα και Δικαιώματα / πηγή είναι υποχρεωτικά.", "Το όνομα είναι υποχρεωτικό."],
  ["Nazwa oraz Prawa / źródło są wymagane.", "Nazwa jest wymagana."],
  ["الاسم والحقوق / المصدر مطلوبان.", "الاسم مطلوب."]
];

let help = read("floqr-i18n-help.js");
const rightsCount = (help.match(/"help-smartvisuals-rights"/g) || []).length;
if (rightsCount !== 10) throw new Error(`expected 10 rights help entries, got ${rightsCount}`);
help = help.replace(
  /\n      "help-smartvisuals-rights": \{\n        title: "[^"]*",\n        body: "[^"]*"\n      },?/g,
  ""
);
if (help.includes("help-smartvisuals-rights")) {
  throw new Error("rights help still present after strip");
}

const createMatches = [...help.matchAll(/"help-smartvisuals-create": \{\n        title: "[^"]*",\n        body: "([^"]*)"/g)];
if (createMatches.length !== 10) throw new Error(`expected 10 create help bodies, got ${createMatches.length}`);
const bodies = createMatches.map(m => m[1]);
const langs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
langs.forEach((lang, i) => {
  if (!bodies[i]) throw new Error(`missing create body ${lang}`);
  help = help.replace(bodies[i], CREATE_BODY[lang]);
});
write("floqr-i18n-help.js", help);

let chrome = read("floqr-i18n.js");
const rightsLabelCount = (chrome.match(/"sv\.studioRightsLabel"/g) || []).length;
if (rightsLabelCount !== 11) throw new Error(`expected 11 rights labels, got ${rightsLabelCount}`);
chrome = chrome.replace(/\n      "sv\.studioRightsLabel": "[^"]*",/g, "");
if (chrome.includes("sv.studioRightsLabel")) throw new Error("studioRightsLabel still present");
for (const [from, to] of NEED_META) {
  const needle = `"sv.studioNeedMeta": ${JSON.stringify(from)}`;
  if (!chrome.includes(needle)) throw new Error(`studioNeedMeta not found: ${from}`);
  chrome = chrome.replace(needle, `"sv.studioNeedMeta": ${JSON.stringify(to)}`);
}
write("floqr-i18n.js", chrome);

const helpEn = JSON.parse(read("scripts/_help-en.json"));
helpEn["help-smartvisuals-create"].body = CREATE_EN;
delete helpEn["help-smartvisuals-rights"];
write("scripts/_help-en.json", `${JSON.stringify(helpEn, null, 2)}\n`);

console.log("stripped rights field from i18n packs");
