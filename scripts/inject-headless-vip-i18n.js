#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "floqr-i18n.js");
let src = fs.readFileSync(file, "utf8");

const KEYS = {
  en: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Hold a table from this chat. Joining a room is not a payment.",
    "botdee.vip.night": "Night",
    "botdee.vip.section": "Table",
    "botdee.vip.party": "Party",
    "botdee.vip.pay": "Pay securely",
    "botdee.vip.openMap": "Open VIP reserV map",
    "botdee.rs.joinLink": "Join this Room SMARTview",
    "botdee.rs.confirmedLive": "Room SMARTview is open. Share the join link so friends can talk with BOT DEE here. Joining is not a payment.",
    "botdee.rs.joined": "You're in this Room SMARTview. Joining is not a payment and does not open a shared tab."
  },
  fr: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Réservez une table depuis ce chat. Rejoindre une room n’est pas un paiement.",
    "botdee.vip.night": "Soirée",
    "botdee.vip.section": "Table",
    "botdee.vip.party": "Groupe",
    "botdee.vip.pay": "Payer en sécurité",
    "botdee.vip.openMap": "Ouvrir la carte VIP reserV",
    "botdee.rs.joinLink": "Rejoindre ce Room SMARTview",
    "botdee.rs.confirmedLive": "Room SMARTview est ouvert. Partagez le lien pour que vos amis parlent avec BOT DEE ici. Rejoindre n’est pas un paiement.",
    "botdee.rs.joined": "Vous êtes dans ce Room SMARTview. Rejoindre n’est pas un paiement et n’ouvre pas un compte partagé."
  },
  de: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Einen Tisch aus diesem Chat halten. Einer Room beizutreten ist keine Zahlung.",
    "botdee.vip.night": "Abend",
    "botdee.vip.section": "Tisch",
    "botdee.vip.party": "Gruppe",
    "botdee.vip.pay": "Sicher bezahlen",
    "botdee.vip.openMap": "VIP reserV-Karte öffnen",
    "botdee.rs.joinLink": "Diesem Room SMARTview beitreten",
    "botdee.rs.confirmedLive": "Room SMARTview ist offen. Teilen Sie den Link, damit Freunde hier mit BOT DEE sprechen. Beitreten ist keine Zahlung.",
    "botdee.rs.joined": "Sie sind in diesem Room SMARTview. Beitreten ist keine Zahlung und öffnet kein Shared Tab."
  },
  es: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Reserva una mesa desde este chat. Unirse a una room no es un pago.",
    "botdee.vip.night": "Noche",
    "botdee.vip.section": "Mesa",
    "botdee.vip.party": "Grupo",
    "botdee.vip.pay": "Pagar de forma segura",
    "botdee.vip.openMap": "Abrir el mapa VIP reserV",
    "botdee.rs.joinLink": "Unirse a este Room SMARTview",
    "botdee.rs.confirmedLive": "Room SMARTview está abierto. Comparte el enlace para que tus amigos hablen con BOT DEE aquí. Unirse no es un pago.",
    "botdee.rs.joined": "Estás en este Room SMARTview. Unirse no es un pago y no abre una cuenta compartida."
  },
  it: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Tieni un tavolo da questa chat. Entrare in una room non è un pagamento.",
    "botdee.vip.night": "Serata",
    "botdee.vip.section": "Tavolo",
    "botdee.vip.party": "Gruppo",
    "botdee.vip.pay": "Paga in sicurezza",
    "botdee.vip.openMap": "Apri la mappa VIP reserV",
    "botdee.rs.joinLink": "Entra in questo Room SMARTview",
    "botdee.rs.confirmedLive": "Room SMARTview è aperto. Condividi il link così gli amici parlano con BOT DEE qui. Entrare non è un pagamento.",
    "botdee.rs.joined": "Sei in questo Room SMARTview. Entrare non è un pagamento e non apre un tab condiviso."
  },
  pt: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Reserve uma mesa neste chat. Entrar numa room não é um pagamento.",
    "botdee.vip.night": "Noite",
    "botdee.vip.section": "Mesa",
    "botdee.vip.party": "Grupo",
    "botdee.vip.pay": "Pagar com segurança",
    "botdee.vip.openMap": "Abrir o mapa VIP reserV",
    "botdee.rs.joinLink": "Entrar neste Room SMARTview",
    "botdee.rs.confirmedLive": "Room SMARTview está aberto. Partilhe o link para os amigos falarem com BOT DEE aqui. Entrar não é um pagamento.",
    "botdee.rs.joined": "Está neste Room SMARTview. Entrar não é um pagamento e não abre um tab partilhado."
  },
  nl: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Houd een tafel vast vanuit deze chat. Deelnemen aan een room is geen betaling.",
    "botdee.vip.night": "Avond",
    "botdee.vip.section": "Tafel",
    "botdee.vip.party": "Groep",
    "botdee.vip.pay": "Veilig betalen",
    "botdee.vip.openMap": "VIP reserV-kaart openen",
    "botdee.rs.joinLink": "Deelnemen aan dit Room SMARTview",
    "botdee.rs.confirmedLive": "Room SMARTview is open. Deel de join-link zodat vrienden hier met BOT DEE praten. Deelnemen is geen betaling.",
    "botdee.rs.joined": "Je zit in dit Room SMARTview. Deelnemen is geen betaling en opent geen shared tab."
  },
  ru: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Удержите стол из этого чата. Вход в room — не платёж.",
    "botdee.vip.night": "Вечер",
    "botdee.vip.section": "Стол",
    "botdee.vip.party": "Компания",
    "botdee.vip.pay": "Оплатить безопасно",
    "botdee.vip.openMap": "Открыть карту VIP reserV",
    "botdee.rs.joinLink": "Войти в этот Room SMARTview",
    "botdee.rs.confirmedLive": "Room SMARTview открыт. Поделитесь ссылкой, чтобы друзья говорили с BOT DEE здесь. Вход — не платёж.",
    "botdee.rs.joined": "Вы в этом Room SMARTview. Вход — не платёж и не открывает общий счёт."
  },
  el: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Κρατήστε τραπέζι από αυτή τη συνομιλία. Η είσοδος σε room δεν είναι πληρωμή.",
    "botdee.vip.night": "Βραδιά",
    "botdee.vip.section": "Τραπέζι",
    "botdee.vip.party": "Παρέα",
    "botdee.vip.pay": "Πληρωμή με ασφάλεια",
    "botdee.vip.openMap": "Άνοιγμα χάρτη VIP reserV",
    "botdee.rs.joinLink": "Μπείτε σε αυτό το Room SMARTview",
    "botdee.rs.confirmedLive": "Το Room SMARTview είναι ανοιχτό. Μοιραστείτε τον σύνδεσμο ώστε οι φίλοι να μιλούν με BOT DEE εδώ. Η είσοδος δεν είναι πληρωμή.",
    "botdee.rs.joined": "Είστε σε αυτό το Room SMARTview. Η είσοδος δεν είναι πληρωμή και δεν ανοίγει κοινό λογαριασμό."
  },
  pl: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "Zatrzymaj stolik z tego czatu. Dołączenie do room nie jest płatnością.",
    "botdee.vip.night": "Wieczór",
    "botdee.vip.section": "Stolik",
    "botdee.vip.party": "Grupa",
    "botdee.vip.pay": "Zapłać bezpiecznie",
    "botdee.vip.openMap": "Otwórz mapę VIP reserV",
    "botdee.rs.joinLink": "Dołącz do tego Room SMARTview",
    "botdee.rs.confirmedLive": "Room SMARTview jest otwarty. Udostępnij link, aby znajomi rozmawiali tu z BOT DEE. Dołączenie nie jest płatnością.",
    "botdee.rs.joined": "Jesteś w tym Room SMARTview. Dołączenie nie jest płatnością i nie otwiera wspólnego rachunku."
  },
  ar: {
    "botdee.vip.title": "VIP reserV",
    "botdee.vip.hint": "احجز طاولة من هذه المحادثة. الانضمام إلى room ليس دفعاً.",
    "botdee.vip.night": "الليلة",
    "botdee.vip.section": "الطاولة",
    "botdee.vip.party": "العدد",
    "botdee.vip.pay": "ادفع بأمان",
    "botdee.vip.openMap": "افتح خريطة VIP reserV",
    "botdee.rs.joinLink": "انضم إلى Room SMARTview هذا",
    "botdee.rs.confirmedLive": "Room SMARTview مفتوح. شارك رابط الانضمام ليتحدث الأصدقاء مع BOT DEE هنا. الانضمام ليس دفعاً.",
    "botdee.rs.joined": "أنت في Room SMARTview هذا. الانضمام ليس دفعاً ولا يفتح حساباً مشتركاً."
  }
};

function block(map) {
  return Object.entries(map).map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n") + "\n";
}

const langs = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
langs.forEach(lang => {
  const keys = KEYS[lang];
  if (!keys) throw new Error(`missing ${lang}`);
  if (src.includes(`"botdee.vip.title"`) && lang === "en" && (src.match(/"botdee.vip.title"/g) || []).length >= 11) {
    return;
  }
});

function injectAfter(srcText, needleRe, pickKeys) {
  const matches = [];
  const re = new RegExp(needleRe.source, "g");
  let hit;
  while ((hit = re.exec(srcText))) matches.push(hit);
  if (matches.length !== 11) {
    throw new Error(`expected 11 ${needleRe} hits, got ${matches.length}`);
  }
  let out = "";
  let last = 0;
  matches.forEach((hit, i) => {
    const end = hit.index + hit[0].length;
    const map = KEYS[langs[i]];
    const extra = pickKeys.map(k => `      ${JSON.stringify(k)}: ${JSON.stringify(map[k])},`).join("\n") + "\n";
    out += srcText.slice(last, end) + extra;
    last = end;
  });
  return out + srcText.slice(last);
}

if (!src.includes('"botdee.vip.title"')) {
  src = injectAfter(
    src,
    /"botdee\.so\.footPending": [^\n]+\n/,
    ["botdee.vip.title", "botdee.vip.hint", "botdee.vip.night", "botdee.vip.section", "botdee.vip.party", "botdee.vip.pay", "botdee.vip.openMap"]
  );
}
if (!src.includes('"botdee.rs.joinLink"')) {
  src = injectAfter(
    src,
    /"botdee\.rs\.confirmedNotLive": [^\n]+\n/,
    ["botdee.rs.joinLink", "botdee.rs.confirmedLive", "botdee.rs.joined"]
  );
}
fs.writeFileSync(file, src);
console.log("injected vip/room chrome keys");
