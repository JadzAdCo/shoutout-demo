/**
 * Patch chrome + venueAdmin help for Twilio / SendGrid mail logs + club messaging logs.
 * Run: node scripts/patch-twilio-logs-i18n.js
 * Then: node scripts/build-i18n-help-packs.js
 * Then: node scripts/i18n-coverage-report.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const CHROME = {
  en: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Messaging logs",
    "admin.messagingLogsTitle": "SMS & WhatsApp delivery logs",
    "admin.messagingLogsBody": "Messages sent for this venue (marketing tests, club alerts). Same rows appear under Master Admin → Twilio. Phones are masked.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Status",
    "admin.logStatusAll": "All",
    "admin.logSearch": "Search",
    "admin.logSearchPlaceholder": "purpose, SID, error",
    "admin.refreshSms": "Refresh SMS",
    "admin.refreshWhatsapp": "Refresh WhatsApp"
  },
  fr: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Journaux de messagerie",
    "admin.messagingLogsTitle": "Journaux SMS et WhatsApp",
    "admin.messagingLogsBody": "Messages envoyés pour ce lieu (tests marketing, alertes club). Les mêmes lignes apparaissent sous Master Admin → Twilio. Les téléphones sont masqués.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Statut",
    "admin.logStatusAll": "Tous",
    "admin.logSearch": "Rechercher",
    "admin.logSearchPlaceholder": "objet, SID, erreur",
    "admin.refreshSms": "Actualiser SMS",
    "admin.refreshWhatsapp": "Actualiser WhatsApp"
  },
  de: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Nachrichtenprotokolle",
    "admin.messagingLogsTitle": "SMS- & WhatsApp-Zustellprotokolle",
    "admin.messagingLogsBody": "Für diesen Standort gesendete Nachrichten (Marketing-Tests, Club-Alerts). Dieselben Einträge erscheinen unter Master Admin → Twilio. Telefonnummern sind maskiert.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Status",
    "admin.logStatusAll": "Alle",
    "admin.logSearch": "Suche",
    "admin.logSearchPlaceholder": "Zweck, SID, Fehler",
    "admin.refreshSms": "SMS aktualisieren",
    "admin.refreshWhatsapp": "WhatsApp aktualisieren"
  },
  es: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Registros de mensajería",
    "admin.messagingLogsTitle": "Registros de entrega SMS y WhatsApp",
    "admin.messagingLogsBody": "Mensajes enviados para este local (pruebas de marketing, alertas del club). Las mismas filas aparecen en Master Admin → Twilio. Los teléfonos están enmascarados.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Estado",
    "admin.logStatusAll": "Todos",
    "admin.logSearch": "Buscar",
    "admin.logSearchPlaceholder": "propósito, SID, error",
    "admin.refreshSms": "Actualizar SMS",
    "admin.refreshWhatsapp": "Actualizar WhatsApp"
  },
  nl: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Berichtenlogboeken",
    "admin.messagingLogsTitle": "SMS- en WhatsApp-bezorglogboeken",
    "admin.messagingLogsBody": "Berichten voor deze locatie (marketingtests, clubalerts). Dezelfde rijen staan onder Master Admin → Twilio. Telefoons zijn gemaskeerd.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Status",
    "admin.logStatusAll": "Alles",
    "admin.logSearch": "Zoeken",
    "admin.logSearchPlaceholder": "doel, SID, fout",
    "admin.refreshSms": "SMS vernieuwen",
    "admin.refreshWhatsapp": "WhatsApp vernieuwen"
  },
  ru: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Журналы сообщений",
    "admin.messagingLogsTitle": "Журналы доставки SMS и WhatsApp",
    "admin.messagingLogsBody": "Сообщения, отправленные для этой площадки (тесты маркетинга, клубные оповещения). Те же строки в Master Admin → Twilio. Телефоны скрыты.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Статус",
    "admin.logStatusAll": "Все",
    "admin.logSearch": "Поиск",
    "admin.logSearchPlaceholder": "цель, SID, ошибка",
    "admin.refreshSms": "Обновить SMS",
    "admin.refreshWhatsapp": "Обновить WhatsApp"
  },
  it: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Registri messaggi",
    "admin.messagingLogsTitle": "Registri di consegna SMS e WhatsApp",
    "admin.messagingLogsBody": "Messaggi inviati per questa sede (test marketing, avvisi club). Le stesse righe compaiono in Master Admin → Twilio. I telefoni sono mascherati.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Stato",
    "admin.logStatusAll": "Tutti",
    "admin.logSearch": "Cerca",
    "admin.logSearchPlaceholder": "scopo, SID, errore",
    "admin.refreshSms": "Aggiorna SMS",
    "admin.refreshWhatsapp": "Aggiorna WhatsApp"
  },
  pt: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Registos de mensagens",
    "admin.messagingLogsTitle": "Registos de entrega SMS e WhatsApp",
    "admin.messagingLogsBody": "Mensagens enviadas para este local (testes de marketing, alertas do clube). As mesmas linhas aparecem em Master Admin → Twilio. Os telefones estão mascarados.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Estado",
    "admin.logStatusAll": "Todos",
    "admin.logSearch": "Pesquisar",
    "admin.logSearchPlaceholder": "objetivo, SID, erro",
    "admin.refreshSms": "Atualizar SMS",
    "admin.refreshWhatsapp": "Atualizar WhatsApp"
  },
  el: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Αρχεία μηνυμάτων",
    "admin.messagingLogsTitle": "Αρχεία παράδοσης SMS και WhatsApp",
    "admin.messagingLogsBody": "Μηνύματα για αυτόν τον χώρο (δοκιμές marketing, ειδοποιήσεις club). Οι ίδιες γραμμές εμφανίζονται στο Master Admin → Twilio. Τα τηλέφωνα είναι καλυμμένα.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Κατάσταση",
    "admin.logStatusAll": "Όλα",
    "admin.logSearch": "Αναζήτηση",
    "admin.logSearchPlaceholder": "σκοπός, SID, σφάλμα",
    "admin.refreshSms": "Ανανέωση SMS",
    "admin.refreshWhatsapp": "Ανανέωση WhatsApp"
  },
  pl: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "Dzienniki wiadomości",
    "admin.messagingLogsTitle": "Dzienniki dostawy SMS i WhatsApp",
    "admin.messagingLogsBody": "Wiadomości wysłane dla tej lokalizacji (testy marketingowe, alerty klubu). Te same wiersze są w Master Admin → Twilio. Telefony są zamaskowane.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "Status",
    "admin.logStatusAll": "Wszystkie",
    "admin.logSearch": "Szukaj",
    "admin.logSearchPlaceholder": "cel, SID, błąd",
    "admin.refreshSms": "Odśwież SMS",
    "admin.refreshWhatsapp": "Odśwież WhatsApp"
  },
  ar: {
    "master.twilio": "Twilio",
    "master.twilioSmsLogs": "twilioSmsLogs",
    "master.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "master.twilioFeatureLogs": "twilioFeatureLogs",
    "master.twilioComplianceLogs": "twilioComplianceLogs",
    "master.twilioSendgridMailLogs": "twilio_sendgridMailLogs",
    "admin.messagingLogs": "سجلات الرسائل",
    "admin.messagingLogsTitle": "سجلات تسليم SMS وWhatsApp",
    "admin.messagingLogsBody": "الرسائل المرسلة لهذا المكان (اختبارات التسويق، تنبيهات النادي). تظهر الصفوف نفسها في Master Admin → Twilio. أرقام الهاتف مخفية.",
    "admin.twilioSmsLogs": "twilioSmsLogs",
    "admin.twilioWhatsAppLogs": "twilioWhatsAppLogs",
    "admin.logStatus": "الحالة",
    "admin.logStatusAll": "الكل",
    "admin.logSearch": "بحث",
    "admin.logSearchPlaceholder": "الغرض، SID، خطأ",
    "admin.refreshSms": "تحديث SMS",
    "admin.refreshWhatsapp": "تحديث WhatsApp"
  }
};

const HELP_CLUB = {
  en: {
    title: "SMS & WhatsApp delivery logs",
    body: "Shows Twilio SMS and WhatsApp messages sent for this venue (marketing Send test, club alerts). The same rows appear under Master Admin → Twilio. Dry-run means secrets or From were missing — nothing was delivered and credits were not debited. Phones are masked."
  },
  fr: {
    title: "Journaux de livraison SMS et WhatsApp",
    body: "Affiche les SMS et WhatsApp Twilio envoyés pour ce lieu (test marketing, alertes club). Les mêmes lignes sont sous Master Admin → Twilio. Dry-run = secrets ou From manquants — rien n’a été livré et aucun crédit débité. Téléphones masqués."
  },
  de: {
    title: "SMS- und WhatsApp-Zustellprotokolle",
    body: "Zeigt Twilio-SMS und WhatsApp für diesen Standort (Marketing-Sendetest, Club-Alerts). Dieselben Zeilen unter Master Admin → Twilio. Dry-run = Secrets oder From fehlen — nichts zugestellt, keine Credits abgebucht. Telefone maskiert."
  },
  es: {
    title: "Registros de entrega SMS y WhatsApp",
    body: "Muestra SMS y WhatsApp de Twilio enviados para este local (prueba de marketing, alertas del club). Las mismas filas están en Master Admin → Twilio. Dry-run = faltan secrets o From — no se entregó nada y no se debitaron créditos. Teléfonos enmascarados."
  },
  nl: {
    title: "SMS- en WhatsApp-bezorglogboeken",
    body: "Toont Twilio SMS en WhatsApp voor deze locatie (marketingtest, clubalerts). Dezelfde rijen staan onder Master Admin → Twilio. Dry-run = secrets of From ontbreken — niets bezorgd en geen credits afgeschreven. Telefoons gemaskeerd."
  },
  ru: {
    title: "Журналы доставки SMS и WhatsApp",
    body: "Показывает SMS и WhatsApp Twilio для этой площадки (тест маркетинга, клубные оповещения). Те же строки в Master Admin → Twilio. Dry-run = нет secrets или From — ничего не доставлено, кредиты не списаны. Телефоны скрыты."
  },
  it: {
    title: "Registri di consegna SMS e WhatsApp",
    body: "Mostra SMS e WhatsApp Twilio inviati per questa sede (test marketing, avvisi club). Le stesse righe sono in Master Admin → Twilio. Dry-run = mancano secrets o From — nulla consegnato e nessun credito addebitato. Telefoni mascherati."
  },
  pt: {
    title: "Registos de entrega SMS e WhatsApp",
    body: "Mostra SMS e WhatsApp Twilio enviados para este local (teste de marketing, alertas do clube). As mesmas linhas estão em Master Admin → Twilio. Dry-run = faltam secrets ou From — nada entregue e créditos não debitados. Telefones mascarados."
  },
  el: {
    title: "Αρχεία παράδοσης SMS και WhatsApp",
    body: "Εμφανίζει SMS και WhatsApp Twilio για αυτόν τον χώρο (δοκιμή marketing, ειδοποιήσεις club). Οι ίδιες γραμμές στο Master Admin → Twilio. Dry-run = λείπουν secrets ή From — τίποτα δεν παραδόθηκε και δεν χρεώθηκαν credits. Τηλέφωνα καλυμμένα."
  },
  pl: {
    title: "Dzienniki dostawy SMS i WhatsApp",
    body: "Pokazuje SMS i WhatsApp Twilio dla tej lokalizacji (test marketingowy, alerty klubu). Te same wiersze są w Master Admin → Twilio. Dry-run = brak secrets lub From — nic nie dostarczono i nie pobrano kredytów. Telefony zamaskowane."
  },
  ar: {
    title: "سجلات تسليم SMS وWhatsApp",
    body: "يعرض رسائل Twilio SMS وWhatsApp لهذا المكان (اختبار التسويق، تنبيهات النادي). تظهر الصفوف نفسها في Master Admin → Twilio. Dry-run يعني غياب secrets أو From — لم يُسلَّم شيء ولم تُخصم أرصدة. أرقام الهاتف مخفية."
  }
};

const LANG_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

function findObjectLiteral(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("Not found: " + marker);
  let i = start + marker.length;
  let depth = 0;
  let end = -1;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("Unbalanced after " + marker);
  return {
    start: start + marker.length,
    end,
    obj: Function(`"use strict"; return (${source.slice(start + marker.length, end)});`)()
  };
}

function stringifyChrome(chrome) {
  const pad = "    ";
  const langLines = LANG_ORDER.map((lang) => {
    const pack = chrome[lang];
    const keys = Object.keys(pack);
    const lines = keys.map((k) => `${pad}  "${k}": ${JSON.stringify(pack[k])}`);
    return `${pad}${lang}: {\n${lines.join(",\n")}\n${pad}}`;
  });
  return `{\n${langLines.join(",\n")}\n  }`;
}

function patchChrome() {
  const file = path.join(ROOT, "floqr-i18n.js");
  let src = fs.readFileSync(file, "utf8");
  const found = findObjectLiteral(src, "const CHROME = ");
  const chrome = found.obj;
  for (const lang of LANG_ORDER) {
    if (!chrome[lang]) throw new Error("missing chrome lang " + lang);
    Object.assign(chrome[lang], CHROME[lang]);
  }
  src = src.slice(0, found.start) + stringifyChrome(chrome) + src.slice(found.end);
  src = src.replace(/const VERSION = "[^"]+"/, 'const VERSION = "s3.0.78"');
  fs.writeFileSync(file, src);
  console.log("chrome keys en=", Object.keys(chrome.en).length);
}

function patchHelpJson() {
  for (const lang of LANG_ORDER) {
    const file = path.join(__dirname, `_help-${lang}.json`);
    const pack = JSON.parse(fs.readFileSync(file, "utf8"));
    pack["help-club-messaging-logs"] = HELP_CLUB[lang];
    fs.writeFileSync(file, JSON.stringify(pack, null, 2) + "\n");
  }
  console.log("help json: help-club-messaging-logs added to all langs");
}

patchChrome();
patchHelpJson();
console.log("ok — next: node scripts/build-i18n-help-packs.js");
