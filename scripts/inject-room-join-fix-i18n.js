#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "floqr-i18n.js");
let src = fs.readFileSync(file, "utf8");

const KEYS = {
  en: {
    "botdee.rs.joinFailed": "That Room SMARTview join link isn't available. Ask the host to Confirm again for a new link.",
    "botdee.rs.joinClosed": "That Room SMARTview is closed. Ask the host for a new join link.",
    "botdee.rs.joinFull": "That Room SMARTview is full (8 people). Ask the host to open another room.",
    "botdee.rs.leftLive": "You left this Room SMARTview. Your private BOT DEE chat continues here.",
    "botdee.rs.endedLive": "This Room SMARTview is closed. Private BOT DEE chat continues here.",
    "botdee.rs.alreadyOpen": "You're already in this Room SMARTview. Ask the host to share the join link — Confirm does not open a second room."
  },
  fr: {
    "botdee.rs.joinFailed": "Ce lien Room SMARTview n’est pas disponible. Demandez à l’hôte de Confirmer à nouveau.",
    "botdee.rs.joinClosed": "Ce Room SMARTview est fermé. Demandez un nouveau lien à l’hôte.",
    "botdee.rs.joinFull": "Ce Room SMARTview est complet (8 personnes). Demandez à l’hôte d’ouvrir une autre room.",
    "botdee.rs.leftLive": "Vous avez quitté ce Room SMARTview. Votre chat BOT DEE privé continue ici.",
    "botdee.rs.endedLive": "Ce Room SMARTview est fermé. Le chat BOT DEE privé continue ici.",
    "botdee.rs.alreadyOpen": "Vous êtes déjà dans ce Room SMARTview. Demandez le lien à l’hôte — Confirmer n’ouvre pas une deuxième room."
  },
  de: {
    "botdee.rs.joinFailed": "Dieser Room-SMARTview-Link ist nicht verfügbar. Bitten Sie den Host erneut um Bestätigen.",
    "botdee.rs.joinClosed": "Dieser Room SMARTview ist geschlossen. Bitten Sie den Host um einen neuen Link.",
    "botdee.rs.joinFull": "Dieser Room SMARTview ist voll (8 Personen). Bitten Sie den Host, einen weiteren Raum zu öffnen.",
    "botdee.rs.leftLive": "Sie haben diesen Room SMARTview verlassen. Ihr privater BOT-DEE-Chat geht hier weiter.",
    "botdee.rs.endedLive": "Dieser Room SMARTview ist geschlossen. Der private BOT-DEE-Chat geht hier weiter.",
    "botdee.rs.alreadyOpen": "Sie sind bereits in diesem Room SMARTview. Bitten Sie den Host um den Link — Bestätigen öffnet keinen zweiten Raum."
  },
  es: {
    "botdee.rs.joinFailed": "Ese enlace de Room SMARTview no está disponible. Pide al anfitrión que Confirme de nuevo.",
    "botdee.rs.joinClosed": "Ese Room SMARTview está cerrado. Pide un enlace nuevo al anfitrión.",
    "botdee.rs.joinFull": "Ese Room SMARTview está lleno (8 personas). Pide al anfitrión que abra otra room.",
    "botdee.rs.leftLive": "Saliste de este Room SMARTview. Tu chat privado de BOT DEE continúa aquí.",
    "botdee.rs.endedLive": "Este Room SMARTview está cerrado. El chat privado de BOT DEE continúa aquí.",
    "botdee.rs.alreadyOpen": "Ya estás en este Room SMARTview. Pide el enlace al anfitrión — Confirmar no abre una segunda room."
  },
  it: {
    "botdee.rs.joinFailed": "Quel link Room SMARTview non è disponibile. Chiedi all’host di Confermare di nuovo.",
    "botdee.rs.joinClosed": "Quel Room SMARTview è chiuso. Chiedi un nuovo link all’host.",
    "botdee.rs.joinFull": "Quel Room SMARTview è pieno (8 persone). Chiedi all’host di aprire un’altra room.",
    "botdee.rs.leftLive": "Hai lasciato questo Room SMARTview. La chat privata BOT DEE continua qui.",
    "botdee.rs.endedLive": "Questo Room SMARTview è chiuso. La chat privata BOT DEE continua qui.",
    "botdee.rs.alreadyOpen": "Sei già in questo Room SMARTview. Chiedi il link all’host — Conferma non apre una seconda room."
  },
  pt: {
    "botdee.rs.joinFailed": "Esse link de Room SMARTview não está disponível. Peça ao anfitrião para Confirmar de novo.",
    "botdee.rs.joinClosed": "Esse Room SMARTview está fechado. Peça um novo link ao anfitrião.",
    "botdee.rs.joinFull": "Esse Room SMARTview está cheio (8 pessoas). Peça ao anfitrião para abrir outra room.",
    "botdee.rs.leftLive": "Saiu deste Room SMARTview. O chat privado BOT DEE continua aqui.",
    "botdee.rs.endedLive": "Este Room SMARTview está fechado. O chat privado BOT DEE continua aqui.",
    "botdee.rs.alreadyOpen": "Já está neste Room SMARTview. Peça o link ao anfitrião — Confirmar não abre uma segunda room."
  },
  nl: {
    "botdee.rs.joinFailed": "Die Room SMARTview-link is niet beschikbaar. Vraag de host opnieuw te Bevestigen.",
    "botdee.rs.joinClosed": "Die Room SMARTview is gesloten. Vraag de host om een nieuwe link.",
    "botdee.rs.joinFull": "Die Room SMARTview is vol (8 personen). Vraag de host een andere room te openen.",
    "botdee.rs.leftLive": "Je hebt deze Room SMARTview verlaten. Je privé-BOT DEE-chat gaat hier verder.",
    "botdee.rs.endedLive": "Deze Room SMARTview is gesloten. De privé-BOT DEE-chat gaat hier verder.",
    "botdee.rs.alreadyOpen": "Je zit al in deze Room SMARTview. Vraag de host om de link — Bevestigen opent geen tweede room."
  },
  ru: {
    "botdee.rs.joinFailed": "Эта ссылка Room SMARTview недоступна. Попросите хоста снова нажать Confirm.",
    "botdee.rs.joinClosed": "Этот Room SMARTview закрыт. Попросите хоста новую ссылку.",
    "botdee.rs.joinFull": "Этот Room SMARTview заполнен (8 человек). Попросите хоста открыть другую room.",
    "botdee.rs.leftLive": "Вы вышли из этого Room SMARTview. Личный чат BOT DEE продолжается здесь.",
    "botdee.rs.endedLive": "Этот Room SMARTview закрыт. Личный чат BOT DEE продолжается здесь.",
    "botdee.rs.alreadyOpen": "Вы уже в этом Room SMARTview. Попросите ссылку у хоста — Confirm не открывает вторую room."
  },
  el: {
    "botdee.rs.joinFailed": "Αυτός ο σύνδεσμος Room SMARTview δεν είναι διαθέσιμος. Ζητήστε από τον οικοδεσπότη Confirm ξανά.",
    "botdee.rs.joinClosed": "Αυτό το Room SMARTview είναι κλειστό. Ζητήστε νέο σύνδεσμο από τον οικοδεσπότη.",
    "botdee.rs.joinFull": "Αυτό το Room SMARTview είναι γεμάτο (8 άτομα). Ζητήστε από τον οικοδεσπότη να ανοίξει άλλη room.",
    "botdee.rs.leftLive": "Αφήσατε αυτό το Room SMARTview. Η ιδιωτική συνομιλία BOT DEE συνεχίζεται εδώ.",
    "botdee.rs.endedLive": "Αυτό το Room SMARTview είναι κλειστό. Η ιδιωτική συνομιλία BOT DEE συνεχίζεται εδώ.",
    "botdee.rs.alreadyOpen": "Είστε ήδη σε αυτό το Room SMARTview. Ζητήστε τον σύνδεσμο από τον οικοδεσπότη — το Confirm δεν ανοίγει δεύτερη room."
  },
  pl: {
    "botdee.rs.joinFailed": "Ten link Room SMARTview jest niedostępny. Poproś gospodarza, aby ponownie wybrał Confirm.",
    "botdee.rs.joinClosed": "Ten Room SMARTview jest zamknięty. Poproś gospodarza o nowy link.",
    "botdee.rs.joinFull": "Ten Room SMARTview jest pełny (8 osób). Poproś gospodarza o otwarcie innej room.",
    "botdee.rs.leftLive": "Opuszczono ten Room SMARTview. Prywatny czat BOT DEE trwa tutaj.",
    "botdee.rs.endedLive": "Ten Room SMARTview jest zamknięty. Prywatny czat BOT DEE trwa tutaj.",
    "botdee.rs.alreadyOpen": "Jesteś już w tym Room SMARTview. Poproś gospodarza o link — Confirm nie otwiera drugiej room."
  },
  ar: {
    "botdee.rs.joinFailed": "رابط Room SMARTview هذا غير متاح. اطلب من المضيف Confirm مرة أخرى.",
    "botdee.rs.joinClosed": "Room SMARTview هذا مغلق. اطلب رابطاً جديداً من المضيف.",
    "botdee.rs.joinFull": "Room SMARTview هذا ممتلئ (8 أشخاص). اطلب من المضيف فتح room أخرى.",
    "botdee.rs.leftLive": "غادرت Room SMARTview هذا. دردشة BOT DEE الخاصة تستمر هنا.",
    "botdee.rs.endedLive": "Room SMARTview هذا مغلق. دردشة BOT DEE الخاصة تستمر هنا.",
    "botdee.rs.alreadyOpen": "أنت بالفعل في Room SMARTview هذا. اطلب الرابط من المضيف — Confirm لا يفتح room ثانية."
  }
};

function block(map) {
  return Object.entries(map).map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n") + "\n";
}

if ((src.match(/"botdee\.rs\.joinFailed"/g) || []).length >= 11) {
  console.log("already injected");
  process.exit(0);
}

const langs = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const joinedRe = /      "botdee\.rs\.joined": "[^"]*",\n/g;
const hits = [];
let match;
while ((match = joinedRe.exec(src))) hits.push(match);
if (hits.length !== 11) {
  console.error("expected 11 joined keys, got", hits.length);
  process.exit(1);
}
for (let i = hits.length - 1; i >= 0; i -= 1) {
  const lang = langs[i];
  const keys = KEYS[lang];
  if (!keys) throw new Error(`missing ${lang}`);
  const at = hits[i].index + hits[i][0].length;
  src = src.slice(0, at) + block(keys) + src.slice(at);
}
fs.writeFileSync(file, src);
console.log("injected room join-fix i18n");
