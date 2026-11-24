#!/usr/bin/node
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const KEYS = [
  "botdee.so.needClub",
  "botdee.so.needMessage",
  "botdee.so.needJerseyTeam",
  "botdee.so.needJerseyName",
  "botdee.so.needJerseyNumber",
  "botdee.so.needPlayerName",
  "botdee.so.needFacePhoto",
  "botdee.so.needTeamPhotos",
  "botdee.so.needThrow"
];

const T = {
  en: [
    "Which venue should this ShoutOut play on?",
    "What should the shoutout text say on the sign?",
    "Which country or club kit should the jersey use?",
    "What name goes on the jersey back?",
    "What number goes on the jersey?",
    "What name should the sign show?",
    "Baller's Alert needs a face photo — open compose or send a photo URL.",
    "Football Intro needs four player photos — open compose to add them.",
    "Reply throw it to send this ShoutOut"
  ],
  fr: [
    "Sur quelle venue ce ShoutOut doit-il jouer ?",
    "Que doit dire le texte du shoutout sur le panneau ?",
    "Quel maillot (pays ou club) utiliser ?",
    "Quel nom va au dos du maillot ?",
    "Quel numéro va sur le maillot ?",
    "Quel nom le panneau doit-il montrer ?",
    "Baller's Alert a besoin d'une photo de visage — ouvrez compose ou envoyez une URL photo.",
    "Football Intro a besoin de quatre photos de joueurs — ouvrez compose pour les ajouter.",
    "Répondez throw it pour envoyer ce ShoutOut"
  ],
  de: [
    "Auf welcher Venue soll dieser ShoutOut laufen?",
    "Was soll der ShoutOut-Text auf dem Schild sagen?",
    "Welches Land- oder Club-Trikot soll verwendet werden?",
    "Welcher Name kommt auf den Trikotrücken?",
    "Welche Nummer kommt auf das Trikot?",
    "Welchen Namen soll das Schild zeigen?",
    "Baller's Alert braucht ein Gesichtsfoto — Compose öffnen oder eine Foto-URL senden.",
    "Football Intro braucht vier Spielerfotos — in Compose hinzufügen.",
    "Antworten Sie throw it, um diesen ShoutOut zu senden"
  ],
  es: [
    "¿En qué local debe reproducirse este ShoutOut?",
    "¿Qué debe decir el texto del shoutout en el cartel?",
    "¿Qué camiseta (país o club) debe usarse?",
    "¿Qué nombre va en la espalda de la camiseta?",
    "¿Qué número va en la camiseta?",
    "¿Qué nombre debe mostrar el cartel?",
    "Baller's Alert necesita una foto de cara: abra compose o envíe una URL de foto.",
    "Football Intro necesita cuatro fotos de jugadores: ábralas en compose.",
    "Responda throw it para enviar este ShoutOut"
  ],
  nl: [
    "Op welke venue moet deze ShoutOut spelen?",
    "Wat moet de shoutout-tekst op het bord zeggen?",
    "Welk land- of clubshirt moet de jersey gebruiken?",
    "Welke naam komt op de rug van het shirt?",
    "Welk nummer komt op het shirt?",
    "Welke naam moet het bord tonen?",
    "Baller's Alert heeft een gezichtsfoto nodig — open compose of stuur een foto-URL.",
    "Football Intro heeft vier spelersfoto's nodig — voeg ze toe in compose.",
    "Antwoord throw it om deze ShoutOut te versturen"
  ],
  ru: [
    "На какой площадке должен играть этот ShoutOut?",
    "Что должен говорить текст shoutout на вывеске?",
    "Какой комплект (страна или клуб) использовать на джерси?",
    "Какое имя на спине джерси?",
    "Какой номер на джерси?",
    "Какое имя должна показать вывеска?",
    "Baller's Alert нужна фотография лица — откройте compose или пришлите URL фото.",
    "Football Intro нужны четыре фото игроков — добавьте их в compose.",
    "Ответьте throw it, чтобы отправить этот ShoutOut"
  ],
  it: [
    "Su quale venue deve andare questo ShoutOut?",
    "Cosa deve dire il testo dello shoutout sul cartello?",
    "Quale kit (paese o club) deve usare la maglia?",
    "Quale nome va sul retro della maglia?",
    "Quale numero va sulla maglia?",
    "Quale nome deve mostrare il cartello?",
    "Baller's Alert serve una foto del viso — apri compose o invia un URL foto.",
    "Football Intro serve quattro foto dei giocatori — aggiungile in compose.",
    "Rispondi throw it per inviare questo ShoutOut"
  ],
  pt: [
    "Em que venue deve este ShoutOut ser reproduzido?",
    "O que deve dizer o texto do shoutout no letreiro?",
    "Que equipamento (país ou clube) deve a camisola usar?",
    "Que nome vai nas costas da camisola?",
    "Que número vai na camisola?",
    "Que nome deve o letreiro mostrar?",
    "Baller's Alert precisa de uma foto de rosto — abra compose ou envie um URL de foto.",
    "Football Intro precisa de quatro fotos de jogadores — adicione-as no compose.",
    "Responda throw it para enviar este ShoutOut"
  ],
  el: [
    "Σε ποιον χώρο να παίξει αυτό το ShoutOut;",
    "Τι να λέει το κείμενο shoutout στην πινακίδα;",
    "Ποιο κιτ (χώρα ή σύλλογος) να χρησιμοποιήσει η φανέλα;",
    "Ποιο όνομα πάει στην πλάτη της φανέλας;",
    "Ποιος αριθμός πάει στη φανέλα;",
    "Ποιο όνομα να δείξει η πινακίδα;",
    "Το Baller's Alert χρειάζεται φωτογραφία προσώπου — ανοίξτε compose ή στείλτε URL φωτογραφίας.",
    "Το Football Intro χρειάζεται τέσσερις φωτογραφίες παικτών — προσθέστε τις στο compose.",
    "Απαντήστε throw it για να σταλεί αυτό το ShoutOut"
  ],
  pl: [
    "Na której venue ma grać ten ShoutOut?",
    "Co ma mówić tekst shoutout na tablicy?",
    "Jakiego kompletu (kraj lub klub) użyć na koszulce?",
    "Jakie imię idzie na plecy koszulki?",
    "Jaki numer idzie na koszulkę?",
    "Jakie imię ma pokazać tablica?",
    "Baller's Alert potrzebuje zdjęcia twarzy — otwórz compose albo wyślij URL zdjęcia.",
    "Football Intro potrzebuje czterech zdjęć zawodników — dodaj je w compose.",
    "Odpowiedz throw it, aby wysłać ten ShoutOut"
  ],
  ar: [
    "على أي مكان يجب أن يُعرض هذا ShoutOut؟",
    "ماذا يجب أن يقول نص الـ shoutout على اللافتة؟",
    "أي طقم (دولة أو نادٍ) تستخدمه القميص؟",
    "ما الاسم على ظهر القميص؟",
    "ما الرقم على القميص؟",
    "ما الاسم الذي يجب أن تظهره اللافتة؟",
    "Baller's Alert يحتاج صورة وجه — افتح compose أو أرسل رابط صورة.",
    "Football Intro يحتاج أربع صور لاعبين — أضفها في compose.",
    "أجب throw it لإرسال هذا ShoutOut"
  ]
};

const HELP = {
  en: {
    title: "ShoutOut SMARTpreview",
    body: "When you throw a ShoutOut in BOT DEE chat, BOT DEE uses that template's patron input list. Context already in the chat fills venue, shoutout text, names, and numbers. BOT DEE asks only for missing required fields, one at a time — there is no canned phrase you must say. Traditional needs a venue and shoutout text. When the list is complete, ShoutOut SMARTpreview is ready; reply throw it (or skip extras) to send. @handle is optional on Traditional. Photo, jersey, Football Intro, Heist name-only, and Baller's Alert use their own required fields; photo boards still open compose. A FloqR or third-party one-shot still sends venue, sign verbiage, and optional extras in one request."
  },
  fr: {
    title: "SMARTpreview ShoutOut",
    body: "Quand vous lancez un ShoutOut dans le chat BOT DEE, BOT DEE utilise la liste d'entrées patrons de ce modèle. Le contexte du chat remplit le lieu, le texte du shoutout, les noms et les numéros. BOT DEE ne demande que les champs requis manquants, un à la fois — aucune phrase magique. Traditional a besoin d'un lieu et du texte du shoutout. Quand la liste est complète, ShoutOut SMARTpreview est prêt ; répondez throw it (ou skip extras) pour envoyer. @handle est optionnel sur Traditional. Photo, jersey, Football Intro, Heist name-only et Baller's Alert ont leurs propres champs ; les boards photo passent par compose. Un envoi FloqR ou tiers en une requête envoie encore lieu, texte du panneau et extras optionnels."
  },
  de: {
    title: "ShoutOut SMARTpreview",
    body: "Wenn Sie in BOT DEE einen ShoutOut werfen, nutzt BOT DEE die Patron-Eingabeliste dieser Vorlage. Chat-Kontext füllt Venue, ShoutOut-Text, Namen und Nummern. BOT DEE fragt nur fehlende Pflichtfelder, eines nach dem anderen — kein Zaubersatz. Traditional braucht Venue und ShoutOut-Text. Wenn die Liste voll ist, ist ShoutOut SMARTpreview bereit; antworten Sie throw it (oder skip extras). @handle ist bei Traditional optional. Foto, Jersey, Football Intro, Heist name-only und Baller's Alert haben eigene Pflichtfelder; Fotoboards bleiben Compose. Ein FloqR- oder Drittanbieter-One-Shot sendet Venue, Schildtext und optionale Extras in einer Anfrage."
  },
  es: {
    title: "SMARTpreview de ShoutOut",
    body: "Al lanzar un ShoutOut en el chat de BOT DEE, BOT DEE usa la lista de entradas de patrón de esa plantilla. El contexto del chat rellena local, texto del shoutout, nombres y números. BOT DEE pide solo los campos requeridos que faltan, uno a uno — no hay frase mágica. Traditional necesita local y texto del shoutout. Cuando la lista está completa, ShoutOut SMARTpreview está listo; responda throw it (o skip extras). @handle es opcional en Traditional. Foto, jersey, Football Intro, Heist name-only y Baller's Alert tienen sus propios campos; los tableros con foto siguen en compose. Un envío FloqR o de un tercero en una petición sigue enviando local, texto del cartel y extras opcionales."
  },
  nl: {
    title: "ShoutOut SMARTpreview",
    body: "Als u in BOT DEE een ShoutOut gooit, gebruikt BOT DEE de patron-invoerlijst van dat sjabloon. Chatcontext vult venue, shoutout-tekst, namen en nummers. BOT DEE vraagt alleen ontbrekende verplichte velden, één voor één — geen toverzinnen. Traditional heeft een venue en shoutout-tekst nodig. Als de lijst compleet is, is ShoutOut SMARTpreview klaar; antwoord throw it (of skip extras). @handle is optioneel op Traditional. Foto, jersey, Football Intro, Heist name-only en Baller's Alert hebben eigen verplichte velden; fotoborden blijven compose. Een FloqR- of derde-party one-shot stuurt venue, bordtekst en optionele extras in één verzoek."
  },
  ru: {
    title: "ShoutOut SMARTpreview",
    body: "Когда вы бросаете ShoutOut в чате BOT DEE, бот берёт список полей этого шаблона. Контекст чата заполняет площадку, текст shoutout, имена и номера. BOT DEE спрашивает только недостающие обязательные поля по одному — без волшебной фразы. Traditional нужны площадка и текст shoutout. Когда список готов, ShoutOut SMARTpreview готов; ответьте throw it (или skip extras). @handle на Traditional необязателен. Фото, джерси, Football Intro, Heist name-only и Baller's Alert имеют свои обязательные поля; фото-борды по-прежнему через compose. One-shot FloqR или третьей стороны по-прежнему передаёт площадку, текст вывески и опции в одном запросе."
  },
  it: {
    title: "SMARTpreview ShoutOut",
    body: "Quando lanci uno ShoutOut in chat BOT DEE, BOT DEE usa l'elenco di input patron di quel modello. Il contesto della chat riempie venue, testo shoutout, nomi e numeri. BOT DEE chiede solo i campi obbligatori mancanti, uno alla volta — nessuna frase magica. Traditional serve venue e testo shoutout. Quando l'elenco è completo, ShoutOut SMARTpreview è pronto; rispondi throw it (o skip extras). @handle è opzionale su Traditional. Foto, jersey, Football Intro, Heist name-only e Baller's Alert hanno i propri campi; i board con foto restano su compose. Un one-shot FloqR o di terzi invia ancora venue, testo del cartello ed extra opzionali in una richiesta."
  },
  pt: {
    title: "SMARTpreview ShoutOut",
    body: "Quando lança um ShoutOut no chat BOT DEE, o BOT DEE usa a lista de entradas de patron desse modelo. O contexto do chat preenche venue, texto do shoutout, nomes e números. O BOT DEE pede só os campos obrigatórios em falta, um de cada vez — sem frase mágica. Traditional precisa de venue e texto do shoutout. Quando a lista está completa, o ShoutOut SMARTpreview está pronto; responda throw it (ou skip extras). @handle é opcional no Traditional. Foto, jersey, Football Intro, Heist name-only e Baller's Alert têm os seus campos; boards com foto continuam no compose. Um envio FloqR ou de terceiros ainda envia venue, texto do letreiro e extras opcionais num pedido."
  },
  el: {
    title: "ShoutOut SMARTpreview",
    body: "Όταν ρίχνετε ShoutOut στη συνομιλία BOT DEE, το BOT DEE χρησιμοποιεί τη λίστα πεδίων του προτύπου. Το πλαίσιο της συνομιλίας συμπληρώνει χώρο, κείμενο shoutout, ονόματα και αριθμούς. Το BOT DEE ρωτά μόνο τα υποχρεωτικά που λείπουν, ένα τη φορά — χωρίς μαγική φράση. Το Traditional θέλει χώρο και κείμενο shoutout. Όταν η λίστα είναι πλήρης, το ShoutOut SMARTpreview είναι έτοιμο· απαντήστε throw it (ή skip extras). Το @handle είναι προαιρετικό στο Traditional. Φωτογραφία, φανέλα, Football Intro, Heist name-only και Baller's Alert έχουν δικά τους πεδία· οι πινακίδες με φωτογραφία μένουν στο compose. Ένα one-shot FloqR ή τρίτου στέλνει χώρο, κείμενο πινακίδας και προαιρετικά extras σε ένα αίτημα."
  },
  pl: {
    title: "ShoutOut SMARTpreview",
    body: "Gdy rzucasz ShoutOut na czacie BOT DEE, BOT DEE używa listy pól patron tego szablonu. Kontekst czatu wypełnia venue, tekst shoutout, imiona i numery. BOT DEE pyta tylko o brakujące wymagane pola, po jednym — bez magicznego zdania. Traditional potrzebuje venue i tekstu shoutout. Gdy lista jest kompletna, ShoutOut SMARTpreview jest gotowy; odpowiedz throw it (albo skip extras). @handle jest opcjonalne na Traditional. Zdjęcie, jersey, Football Intro, Heist name-only i Baller's Alert mają własne pola; tablice ze zdjęciem nadal przez compose. One-shot FloqR lub strony trzeciej nadal wysyła venue, tekst tablicy i opcjonalne dodatki w jednym żądaniu."
  },
  ar: [
  ].length ? null : null
};

HELP.ar = {
  title: "ShoutOut SMARTpreview",
  body: "عندما ترمي ShoutOut في دردشة BOT DEE يستخدم BOT DEE قائمة حقول ذلك القالب. سياق الدردشة يملأ المكان ونص الـ shoutout والأسماء والأرقام. يسأل BOT DEE فقط عن الحقول المطلوبة الناقصة واحداً تلو الآخر — بلا جملة سحرية. Traditional يحتاج مكاناً ونص shoutout. عندما تكتمل القائمة يكون ShoutOut SMARTpreview جاهزاً؛ أجب throw it (أو skip extras) للإرسال. @handle اختياري على Traditional. الصورة والقميص وFootball Intro وHeist name-only وBaller's Alert لها حقولها؛ لوحات الصور ما زالت عبر compose. طلب FloqR أو طرف ثالث دفعة واحدة ما زال يرسل المكان ونص اللافتة والإضافات الاختيارية في طلب واحد."
};

const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const HELP_ORDER = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];

function q(s) {
  return JSON.stringify(s);
}

function injectChrome(src) {
  const chromeStart = src.indexOf("const CHROME = ");
  if (chromeStart < 0) throw new Error("CHROME missing");
  CHROME_ORDER.forEach((lang, langIdx) => {
    const packStart = src.indexOf(`\n    ${lang}: {`, chromeStart);
    if (packStart < 0) throw new Error(`Missing pack ${lang}`);
    const nextLang = CHROME_ORDER[langIdx + 1];
    const packEnd = nextLang
      ? src.indexOf(`\n    ${nextLang}: {`, packStart + 1)
      : src.indexOf("\n  };", packStart);
    const slice = src.slice(packStart, packEnd);
    if (KEYS.every(k => slice.includes(q(k)))) return;
    const values = T[lang];
    if (!values || values.length !== KEYS.length) throw new Error(`Bad chrome pack ${lang}`);
    const block = KEYS.map((k, i) => `      ${q(k)}: ${q(values[i])},`).join("\n") + "\n";
    const marker = `"botdee.so.needCompose":`;
    const at = slice.indexOf(marker);
    if (at < 0) throw new Error(`Missing needCompose in ${lang}`);
    const lineEnd = slice.indexOf("\n", at);
    const next = slice.slice(0, lineEnd + 1) + block + slice.slice(lineEnd + 1);
    src = src.slice(0, packStart) + next + src.slice(packEnd);
  });
  return src;
}

function replaceHelpBody(src, lang, title, body) {
  const id = `"help-shoutout-headless-smartview"`;
  const packStart = src.indexOf(`"${lang}": {`);
  if (packStart < 0) throw new Error(`help pack ${lang} missing`);
  const nextLang = HELP_ORDER[HELP_ORDER.indexOf(lang) + 1];
  const packEnd = nextLang
    ? src.indexOf(`"${nextLang}": {`, packStart + 1)
    : src.indexOf("\n  };", packStart);
  const slice = src.slice(packStart, packEnd);
  const idAt = slice.indexOf(id);
  if (idAt < 0) throw new Error(`help id missing in ${lang}`);
  const entryStart = slice.lastIndexOf("{", slice.indexOf("title:", idAt));
  const entryEnd = slice.indexOf("\n      }", idAt);
  if (entryStart < 0 || entryEnd < 0) throw new Error(`help entry bounds ${lang}`);
  const replacement = `{
        title: ${q(title)},
        body: ${q(body)}
      }`;
  const next = slice.slice(0, entryStart) + replacement + slice.slice(entryEnd + "\n      }".length);
  return src.slice(0, packStart) + next + src.slice(packEnd);
}

CHROME_ORDER.forEach(lang => {
  if (!T[lang] || T[lang].length !== KEYS.length) throw new Error(`Bad T.${lang}`);
});

let chrome = fs.readFileSync(path.join(ROOT, "floqr-i18n.js"), "utf8");
chrome = injectChrome(chrome);
fs.writeFileSync(path.join(ROOT, "floqr-i18n.js"), chrome);

let helpSrc = fs.readFileSync(path.join(ROOT, "floqr-i18n-help.js"), "utf8");
HELP_ORDER.forEach(lang => {
  const row = HELP[lang];
  if (!row) throw new Error(`HELP.${lang} missing`);
  helpSrc = replaceHelpBody(helpSrc, lang, row.title, row.body);
});
fs.writeFileSync(path.join(ROOT, "floqr-i18n-help.js"), helpSrc);

let repo = fs.readFileSync(path.join(ROOT, "botdee-help-repository.js"), "utf8");
const en = HELP.en;
const repoRe = /(id: "help-shoutout-headless-smartview",\s*title: )"[^"]+",\s*body: "[^"]*"/;
if (!repoRe.test(repo)) throw new Error("help-shoutout-headless-smartview missing in repository");
repo = repo.replace(repoRe, `$1${q(en.title)},\n      body: ${q(en.body)}`);
if (!repo.includes("patron input list")) throw new Error("repository body not updated");
fs.writeFileSync(path.join(ROOT, "botdee-help-repository.js"), repo);

const helpEnPath = path.join(ROOT, "scripts", "_help-en.json");
if (fs.existsSync(helpEnPath)) {
  const json = JSON.parse(fs.readFileSync(helpEnPath, "utf8"));
  json["help-shoutout-headless-smartview"] = en;
  fs.writeFileSync(helpEnPath, `${JSON.stringify(json, null, 2)}\n`);
}

console.log("injected headless template-input i18n + help");
