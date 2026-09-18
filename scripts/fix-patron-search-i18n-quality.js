/**
 * Fix patron-search chrome keys still identical to English in non-en packs.
 * Run: node scripts/fix-patron-search-i18n-quality.js && node scripts/build-i18n-chrome.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const LANGS = ["fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const FIXES = {
  fr: {
    "page.shoutoutLanding.title": "Lancer un ShoutOut",
    "page.shoutoutLanding.start": "Lancer le ShoutOut",
    "page.minglLanding.socialTitle": "Espace social Mingl",
    "page.minglLanding.requestsTitle": "Demandes Mingl",
    "page.minglLanding.openChat": "Ouvrir Mingl Chat",
    "page.minglLanding.requestSent": "Demande Mingl envoyée",
    "page.minglLanding.minglBack": "Mingl en retour",
    "page.minglLanding.letsMingl": "Minglons",
    "page.minglLanding.accept": "Accepter Mingl",
    "page.minglLanding.sectionSent": "Demande Mingl/amitié envoyée",
    "page.minglLanding.sectionReceived": "Demande Mingl/amitié reçue",
    "page.minglLanding.member": "Membre Mingl",
    "page.clubActions.joinGuestList": "Rejoindre la guest list"
  },
  de: {
    "page.shoutoutLanding.title": "Einen ShoutOut senden",
    "page.shoutoutLanding.start": "ShoutOut starten",
    "page.minglLanding.socialTitle": "Mingl Social-Spielplatz",
    "page.minglLanding.requestsTitle": "Mingl-Anfragen",
    "page.minglLanding.openChat": "Mingl Chat öffnen",
    "page.minglLanding.requestSent": "Mingl-Anfrage gesendet",
    "page.minglLanding.minglBack": "Mingl zurück",
    "page.minglLanding.letsMingl": "Lass uns Mingl",
    "page.minglLanding.accept": "Mingl annehmen",
    "page.minglLanding.sectionSent": "Gesendete Mingl-/Freundschaftsanfrage",
    "page.minglLanding.sectionReceived": "Erhaltene Mingl-/Freundschaftsanfrage",
    "page.minglLanding.member": "Mingl-Mitglied",
    "page.clubActions.joinGuestList": "Auf die Gästeliste"
  },
  es: {
    "page.shoutoutLanding.title": "Enviar un ShoutOut",
    "page.shoutoutLanding.start": "Iniciar ShoutOut",
    "page.minglLanding.socialTitle": "Zona social Mingl",
    "page.minglLanding.requestsTitle": "Solicitudes Mingl",
    "page.minglLanding.openChat": "Abrir Mingl Chat",
    "page.minglLanding.requestSent": "Solicitud Mingl enviada",
    "page.minglLanding.minglBack": "Mingl de vuelta",
    "page.minglLanding.letsMingl": "Hagamos Mingl",
    "page.minglLanding.accept": "Aceptar Mingl",
    "page.minglLanding.sectionSent": "Solicitud Mingl/amistad enviada",
    "page.minglLanding.sectionReceived": "Solicitud Mingl/amistad recibida",
    "page.minglLanding.member": "Miembro Mingl",
    "page.clubActions.joinGuestList": "Unirse a la lista de invitados"
  },
  nl: {
    "page.shoutoutLanding.title": "Een ShoutOut sturen",
    "page.shoutoutLanding.start": "ShoutOut starten",
    "page.minglLanding.socialTitle": "Mingl social playground",
    "page.minglLanding.requestsTitle": "Mingl-verzoeken",
    "page.minglLanding.openChat": "Mingl Chat openen",
    "page.minglLanding.requestSent": "Mingl-verzoek verzonden",
    "page.minglLanding.minglBack": "Mingl terug",
    "page.minglLanding.letsMingl": "Laten we Mingl",
    "page.minglLanding.accept": "Mingl accepteren",
    "page.minglLanding.sectionSent": "Verzonden Mingl/vriendschapsverzoek",
    "page.minglLanding.sectionReceived": "Ontvangen Mingl/vriendschapsverzoek",
    "page.minglLanding.member": "Mingl-lid",
    "page.clubActions.joinGuestList": "Op de gastenlijst"
  },
  ru: {
    "page.shoutoutLanding.title": "Отправить ShoutOut",
    "page.shoutoutLanding.start": "Начать ShoutOut",
    "page.minglLanding.socialTitle": "Социальная зона Mingl",
    "page.minglLanding.requestsTitle": "Запросы Mingl",
    "page.minglLanding.openChat": "Открыть Mingl Chat",
    "page.minglLanding.requestSent": "Запрос Mingl отправлен",
    "page.minglLanding.minglBack": "Mingl в ответ",
    "page.minglLanding.letsMingl": "Давайте Mingl",
    "page.minglLanding.accept": "Принять Mingl",
    "page.minglLanding.sectionSent": "Отправленный запрос Mingl/дружбы",
    "page.minglLanding.sectionReceived": "Полученный запрос Mingl/дружбы",
    "page.minglLanding.member": "Участник Mingl",
    "page.clubActions.joinGuestList": "Записаться в гостевой список",
    "template.searchPlaceholder": "Спорт, Jersey, VIP, Юмор, Авто, Видео, Фото, Ballers…"
  },
  it: {
    "page.shoutoutLanding.title": "Invia uno ShoutOut",
    "page.shoutoutLanding.start": "Avvia ShoutOut",
    "page.minglLanding.socialTitle": "Area social Mingl",
    "page.minglLanding.requestsTitle": "Richieste Mingl",
    "page.minglLanding.openChat": "Apri Mingl Chat",
    "page.minglLanding.requestSent": "Richiesta Mingl inviata",
    "page.minglLanding.minglBack": "Mingl indietro",
    "page.minglLanding.letsMingl": "Mingliano",
    "page.minglLanding.accept": "Accetta Mingl",
    "page.minglLanding.sectionSent": "Richiesta Mingl/amico inviata",
    "page.minglLanding.sectionReceived": "Richiesta Mingl/amico ricevuta",
    "page.minglLanding.member": "Membro Mingl",
    "page.clubActions.joinGuestList": "Iscriviti alla lista degli ospiti"
  },
  pt: {
    "page.shoutoutLanding.title": "Enviar um ShoutOut",
    "page.shoutoutLanding.start": "Iniciar ShoutOut",
    "page.minglLanding.socialTitle": "Playground social Mingl",
    "page.minglLanding.requestsTitle": "Pedidos Mingl",
    "page.minglLanding.openChat": "Abrir Mingl Chat",
    "page.minglLanding.requestSent": "Pedido Mingl enviado",
    "page.minglLanding.minglBack": "Mingl de volta",
    "page.minglLanding.letsMingl": "Vamos Mingl",
    "page.minglLanding.accept": "Aceitar Mingl",
    "page.minglLanding.sectionSent": "Pedido Mingl/amizade enviado",
    "page.minglLanding.sectionReceived": "Pedido Mingl/amizade recebido",
    "page.minglLanding.member": "Membro Mingl",
    "page.clubActions.joinGuestList": "Entrar na lista de convidados"
  },
  el: {
    "page.shoutoutLanding.title": "Στείλτε ένα ShoutOut",
    "page.shoutoutLanding.start": "Έναρξη ShoutOut",
    "page.minglLanding.socialTitle": "Κοινωνικός χώρος Mingl",
    "page.minglLanding.requestsTitle": "Αιτήματα Mingl",
    "page.minglLanding.openChat": "Άνοιγμα Mingl Chat",
    "page.minglLanding.requestSent": "Αίτημα Mingl εστάλη",
    "page.minglLanding.minglBack": "Mingl πίσω",
    "page.minglLanding.letsMingl": "Ας κάνουμε Mingl",
    "page.minglLanding.accept": "Αποδοχή Mingl",
    "page.minglLanding.sectionSent": "Απεσταλμένο αίτημα Mingl/φιλίας",
    "page.minglLanding.sectionReceived": "Ληφθέν αίτημα Mingl/φιλίας",
    "page.minglLanding.member": "Μέλος Mingl",
    "page.clubActions.joinGuestList": "Εγγραφή στη λίστα επισκεπτών",
    "template.searchPlaceholder": "Sports, Jersey, VIP, Χιούμορ, Αυτοκίνητα, Βίντεο, Φωτο, Ballers…"
  },
  pl: {
    "page.shoutoutLanding.title": "Wyślij ShoutOut",
    "page.shoutoutLanding.start": "Rozpocznij ShoutOut",
    "page.minglLanding.socialTitle": "Społeczna strefa Mingl",
    "page.minglLanding.requestsTitle": "Prośby Mingl",
    "page.minglLanding.openChat": "Otwórz Mingl Chat",
    "page.minglLanding.requestSent": "Wysłano prośbę Mingl",
    "page.minglLanding.minglBack": "Mingl z powrotem",
    "page.minglLanding.letsMingl": "Minglujmy",
    "page.minglLanding.accept": "Zaakceptuj Mingl",
    "page.minglLanding.sectionSent": "Wysłana prośba Mingl/znajomości",
    "page.minglLanding.sectionReceived": "Otrzymana prośba Mingl/znajomości",
    "page.minglLanding.member": "Członek Mingl",
    "page.clubActions.joinGuestList": "Dołącz do listy gości",
    "template.searchPlaceholder": "Sport, Jersey, VIP, Humor, Auta, Wideo, Zdjęcia, Ballers…"
  },
  ar: {
    "page.shoutoutLanding.title": "إرسال ShoutOut",
    "page.shoutoutLanding.start": "بدء ShoutOut",
    "page.minglLanding.socialTitle": "ملعب Mingl الاجتماعي",
    "page.minglLanding.requestsTitle": "طلبات Mingl",
    "page.minglLanding.openChat": "فتح Mingl Chat",
    "page.minglLanding.requestSent": "تم إرسال طلب Mingl",
    "page.minglLanding.minglBack": "Mingl بالمقابل",
    "page.minglLanding.letsMingl": "لن Mingl",
    "page.minglLanding.accept": "قبول Mingl",
    "page.minglLanding.sectionSent": "طلب Mingl/صداقة مُرسَل",
    "page.minglLanding.sectionReceived": "طلب Mingl/صداقة مُستلم",
    "page.minglLanding.member": "عضو Mingl",
    "page.clubActions.joinGuestList": "الانضمام إلى قائمة الزوار",
    "template.searchPlaceholder": "رياضة، Jersey، VIP، فكاهة، سيارات، فيديو، صور، Ballers…"
  }
};

for (const lang of LANGS) {
  const chromePath = path.join(__dirname, `_chrome-${lang}.json`);
  const pack = JSON.parse(fs.readFileSync(chromePath, "utf8"));
  const fixes = FIXES[lang];
  if (pack["cat.shoutout"] && fixes["page.shoutoutLanding.title"] !== pack["cat.shoutout"]) {
    fixes["page.shoutoutLanding.title"] = pack["cat.shoutout"];
  }
  Object.assign(pack, fixes);
  fs.writeFileSync(chromePath, JSON.stringify(pack, null, 2) + "\n");
  console.log(`Fixed ${lang}: ${Object.keys(fixes).length} keys`);
}
