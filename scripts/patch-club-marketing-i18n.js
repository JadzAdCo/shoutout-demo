/**
 * Club Admin Marketing tab group — chrome + venueAdmin help.
 * Run: node scripts/patch-club-marketing-i18n.js
 * Then: node scripts/build-i18n-chrome.js && node scripts/build-i18n-help-packs.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const LANGS = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const CHROME = {
  en: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Ad Performance",
    "admin.marketingCampaigns": "Marketing Campaigns",
    "admin.marketingCampaignsTitle": "Start a marketing campaign",
    "admin.messagingCredit": "Messaging Credit",
    "admin.messagingCreditTitle": "SMS & WhatsApp Credit",
    "admin.smsWhatsappLogs": "SMS & WhatsApp Logs",
    "admin.inAppMarketing": "In-App Marketing",
    "admin.inAppMarketingTitle": "Start a spot advertisement campaign"
  },
  fr: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Performance des annonces",
    "admin.marketingCampaigns": "Campagnes marketing",
    "admin.marketingCampaignsTitle": "Lancer une campagne marketing",
    "admin.messagingCredit": "Crédit messagerie",
    "admin.messagingCreditTitle": "Crédit SMS et WhatsApp",
    "admin.smsWhatsappLogs": "Journaux SMS et WhatsApp",
    "admin.inAppMarketing": "Marketing in-app",
    "admin.inAppMarketingTitle": "Lancer une campagne publicitaire spot"
  },
  de: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Anzeigenleistung",
    "admin.marketingCampaigns": "Marketingkampagnen",
    "admin.marketingCampaignsTitle": "Marketingkampagne starten",
    "admin.messagingCredit": "Messaging-Guthaben",
    "admin.messagingCreditTitle": "SMS- & WhatsApp-Guthaben",
    "admin.smsWhatsappLogs": "SMS- & WhatsApp-Protokolle",
    "admin.inAppMarketing": "In-App-Marketing",
    "admin.inAppMarketingTitle": "Spot-Werbekampagne starten"
  },
  es: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Rendimiento de anuncios",
    "admin.marketingCampaigns": "Campañas de marketing",
    "admin.marketingCampaignsTitle": "Iniciar una campaña de marketing",
    "admin.messagingCredit": "Crédito de mensajería",
    "admin.messagingCreditTitle": "Crédito SMS y WhatsApp",
    "admin.smsWhatsappLogs": "Registros SMS y WhatsApp",
    "admin.inAppMarketing": "Marketing in-app",
    "admin.inAppMarketingTitle": "Iniciar campaña publicitaria spot"
  },
  nl: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Advertentieprestaties",
    "admin.marketingCampaigns": "Marketingcampagnes",
    "admin.marketingCampaignsTitle": "Start een marketingcampagne",
    "admin.messagingCredit": "Messagingtegoed",
    "admin.messagingCreditTitle": "SMS- en WhatsApp-tegoed",
    "admin.smsWhatsappLogs": "SMS- en WhatsApp-logboeken",
    "admin.inAppMarketing": "In-app marketing",
    "admin.inAppMarketingTitle": "Start een spot-advertentiecampagne"
  },
  ru: {
    "admin.marketing": "Маркетинг",
    "admin.adPerformance": "Эффективность рекламы",
    "admin.marketingCampaigns": "Маркетинговые кампании",
    "admin.marketingCampaignsTitle": "Запустить маркетинговую кампанию",
    "admin.messagingCredit": "Кредит сообщений",
    "admin.messagingCreditTitle": "Кредит SMS и WhatsApp",
    "admin.smsWhatsappLogs": "Журналы SMS и WhatsApp",
    "admin.inAppMarketing": "In-app маркетинг",
    "admin.inAppMarketingTitle": "Запустить spot-рекламную кампанию"
  },
  it: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Prestazioni annunci",
    "admin.marketingCampaigns": "Campagne marketing",
    "admin.marketingCampaignsTitle": "Avvia una campagna marketing",
    "admin.messagingCredit": "Credito messaggistica",
    "admin.messagingCreditTitle": "Credito SMS e WhatsApp",
    "admin.smsWhatsappLogs": "Log SMS e WhatsApp",
    "admin.inAppMarketing": "Marketing in-app",
    "admin.inAppMarketingTitle": "Avvia campagna spot pubblicitaria"
  },
  pt: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Desempenho de anúncios",
    "admin.marketingCampaigns": "Campanhas de marketing",
    "admin.marketingCampaignsTitle": "Iniciar campanha de marketing",
    "admin.messagingCredit": "Crédito de mensagens",
    "admin.messagingCreditTitle": "Crédito SMS e WhatsApp",
    "admin.smsWhatsappLogs": "Registos SMS e WhatsApp",
    "admin.inAppMarketing": "Marketing in-app",
    "admin.inAppMarketingTitle": "Iniciar campanha publicitária spot"
  },
  el: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Απόδοση διαφημίσεων",
    "admin.marketingCampaigns": "Καμπάνιες marketing",
    "admin.marketingCampaignsTitle": "Έναρξη καμπάνιας marketing",
    "admin.messagingCredit": "Πίστωση μηνυμάτων",
    "admin.messagingCreditTitle": "Πίστωση SMS & WhatsApp",
    "admin.smsWhatsappLogs": "Αρχεία SMS & WhatsApp",
    "admin.inAppMarketing": "Marketing in-app",
    "admin.inAppMarketingTitle": "Έναρξη spot διαφημιστικής καμπάνιας"
  },
  pl: {
    "admin.marketing": "Marketing",
    "admin.adPerformance": "Skuteczność reklam",
    "admin.marketingCampaigns": "Kampanie marketingowe",
    "admin.marketingCampaignsTitle": "Uruchom kampanię marketingową",
    "admin.messagingCredit": "Kredyt wiadomości",
    "admin.messagingCreditTitle": "Kredyt SMS i WhatsApp",
    "admin.smsWhatsappLogs": "Dzienniki SMS i WhatsApp",
    "admin.inAppMarketing": "Marketing in-app",
    "admin.inAppMarketingTitle": "Uruchom kampanię reklamową spot"
  },
  ar: {
    "admin.marketing": "التسويق",
    "admin.adPerformance": "أداء الإعلانات",
    "admin.marketingCampaigns": "حملات التسويق",
    "admin.marketingCampaignsTitle": "بدء حملة تسويق",
    "admin.messagingCredit": "رصيد المراسلة",
    "admin.messagingCreditTitle": "رصيد SMS وWhatsApp",
    "admin.smsWhatsappLogs": "سجلات SMS وWhatsApp",
    "admin.inAppMarketing": "التسويق داخل التطبيق",
    "admin.inAppMarketingTitle": "بدء حملة إعلان spot"
  }
};

const HELP_CREDIT = {
  en: {
    title: "SMS & WhatsApp Credit",
    body: "Each $10 pack funds $7.00 of Twilio delivery capacity; FloqR keeps $3.00 as platform profit on the pack. SMS pack → 466 messages (≈ $0.015 all-in US SMS). WhatsApp pack → 233 messages (≈ $0.030 Twilio + Meta marketing). When balance reaches 0, buy another $10 messaging bundle before sending more campaign messages. Ops SMS unlock ($10) also grants one SMS pack. WhatsApp service ($10) grants one WhatsApp pack. Pack math: $10 → 466 SMS or 233 WhatsApp ($7.00 Twilio / $3.00 FloqR)."
  },
  fr: {
    title: "Crédit SMS et WhatsApp",
    body: "Chaque pack à 10 $ finance 7,00 $ de capacité Twilio ; FloqR conserve 3,00 $ de marge plateforme. Pack SMS → 466 messages (≈ 0,015 $ SMS US tout compris). Pack WhatsApp → 233 messages (≈ 0,030 $ Twilio + Meta marketing). À 0, achetez un nouveau pack avant d’envoyer. Le déblocage SMS ops (10 $) inclut un pack SMS. Le service WhatsApp (10 $) inclut un pack WhatsApp. Calcul : 10 $ → 466 SMS ou 233 WhatsApp (7,00 $ Twilio / 3,00 $ FloqR)."
  },
  de: {
    title: "SMS- & WhatsApp-Guthaben",
    body: "Jedes 10-$-Paket finanziert 7,00 $ Twilio-Kapazität; FloqR behält 3,00 $ Plattformmarge. SMS-Paket → 466 Nachrichten (≈ 0,015 $ US-SMS). WhatsApp-Paket → 233 Nachrichten (≈ 0,030 $ Twilio + Meta Marketing). Bei 0 Guthaben neues 10-$-Paket kaufen. Ops-SMS-Freischaltung (10 $) inkl. SMS-Paket. WhatsApp-Service (10 $) inkl. WhatsApp-Paket. Rechnung: 10 $ → 466 SMS oder 233 WhatsApp (7,00 $ Twilio / 3,00 $ FloqR)."
  },
  es: {
    title: "Crédito SMS y WhatsApp",
    body: "Cada paquete de 10 $ financia 7,00 $ de capacidad Twilio; FloqR retiene 3,00 $ de margen. Paquete SMS → 466 mensajes (≈ 0,015 $ SMS US). Paquete WhatsApp → 233 mensajes (≈ 0,030 $ Twilio + Meta marketing). Con saldo 0, compre otro paquete antes de enviar. Desbloqueo SMS ops (10 $) incluye un paquete SMS. Servicio WhatsApp (10 $) incluye un paquete WhatsApp. Cálculo: 10 $ → 466 SMS o 233 WhatsApp (7,00 $ Twilio / 3,00 $ FloqR)."
  },
  nl: {
    title: "SMS- en WhatsApp-tegoed",
    body: "Elk pakket van $10 dekt $7,00 Twilio-capaciteit; FloqR houdt $3,00 platformmarge. SMS-pakket → 466 berichten (≈ $0,015 US-SMS). WhatsApp-pakket → 233 berichten (≈ $0,030 Twilio + Meta marketing). Bij saldo 0 eerst een nieuw pakket kopen. Ops SMS-unlock ($10) bevat een SMS-pakket. WhatsApp-service ($10) bevat een WhatsApp-pakket. Rekening: $10 → 466 SMS of 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
  },
  ru: {
    title: "Кредит SMS и WhatsApp",
    body: "Каждый пакет $10 покрывает $7,00 ёмкости Twilio; FloqR оставляет $3,00 платформенной маржи. SMS-пакет → 466 сообщений (≈ $0,015 SMS США). WhatsApp-пакет → 233 сообщения (≈ $0,030 Twilio + Meta marketing). При нуле купите новый пакет перед отправкой. Ops SMS unlock ($10) даёт SMS-пакет. WhatsApp service ($10) даёт WhatsApp-пакет. Расчёт: $10 → 466 SMS или 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
  },
  it: {
    title: "Credito SMS e WhatsApp",
    body: "Ogni pacchetto da $10 finanzia $7,00 di capacità Twilio; FloqR trattiene $3,00 di margine piattaforma. Pacchetto SMS → 466 messaggi (≈ $0,015 SMS US). Pacchetto WhatsApp → 233 messaggi (≈ $0,030 Twilio + Meta marketing). A saldo 0 acquistare un altro pacchetto prima di inviare. Sblocco SMS ops ($10) include un pacchetto SMS. Servizio WhatsApp ($10) include un pacchetto WhatsApp. Calcolo: $10 → 466 SMS o 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
  },
  pt: {
    title: "Crédito SMS e WhatsApp",
    body: "Cada pacote de $10 financia $7,00 de capacidade Twilio; a FloqR retém $3,00 de margem. Pacote SMS → 466 mensagens (≈ $0,015 SMS EUA). Pacote WhatsApp → 233 mensagens (≈ $0,030 Twilio + Meta marketing). Com saldo 0, compre outro pacote antes de enviar. Desbloqueio SMS ops ($10) inclui um pacote SMS. Serviço WhatsApp ($10) inclui um pacote WhatsApp. Conta: $10 → 466 SMS ou 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
  },
  el: {
    title: "Πίστωση SMS & WhatsApp",
    body: "Κάθε πακέτο $10 χρηματοδοτεί $7,00 χωρητικότητας Twilio· η FloqR κρατά $3,00 πλατφόρμας. Πακέτο SMS → 466 μηνύματα (≈ $0,015 SMS ΗΠΑ). Πακέτο WhatsApp → 233 μηνύματα (≈ $0,030 Twilio + Meta marketing). Σε μηδενικό υπόλοιπο αγοράστε νέο πακέτο πριν την αποστολή. Ops SMS unlock ($10) περιλαμβάνει πακέτο SMS. Υπηρεσία WhatsApp ($10) περιλαμβάνει πακέτο WhatsApp. Υπολογισμός: $10 → 466 SMS ή 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
  },
  pl: {
    title: "Kredyt SMS i WhatsApp",
    body: "Każdy pakiet $10 finansuje $7,00 pojemności Twilio; FloqR zatrzymuje $3,00 marży platformy. Pakiet SMS → 466 wiadomości (≈ $0,015 SMS US). Pakiet WhatsApp → 233 wiadomości (≈ $0,030 Twilio + Meta marketing). Przy saldzie 0 kup kolejny pakiet przed wysyłką. Ops SMS unlock ($10) obejmuje pakiet SMS. Usługa WhatsApp ($10) obejmuje pakiet WhatsApp. Rachunek: $10 → 466 SMS lub 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
  },
  ar: {
    title: "رصيد SMS وWhatsApp",
    body: "كل حزمة بـ 10$ تموّل 7.00$ من سعة Twilio؛ تحتفظ FloqR بـ 3.00$ هامش المنصة. حزمة SMS → 466 رسالة (≈ 0.015$ SMS أمريكي). حزمة WhatsApp → 233 رسالة (≈ 0.030$ Twilio + Meta marketing). عند الرصيد 0 اشترِ حزمة أخرى قبل الإرسال. فتح SMS ops (10$) يمنح حزمة SMS. خدمة WhatsApp (10$) تمنح حزمة WhatsApp. الحساب: 10$ → 466 SMS أو 233 WhatsApp (7.00$ Twilio / 3.00$ FloqR)."
  }
};

const HELP_CAMPAIGNS = {
  en: {
    title: "Marketing campaigns",
    body: "Pick an industry template, load background and extra images, edit copy, then save or send. Sending debits SMS or WhatsApp credits from Messaging Credit."
  },
  fr: {
    title: "Campagnes marketing",
    body: "Choisissez un modèle sectoriel, ajoutez images de fond et extras, modifiez le texte, puis enregistrez ou envoyez. L’envoi débite les crédits SMS ou WhatsApp depuis Crédit messagerie."
  },
  de: {
    title: "Marketingkampagnen",
    body: "Branchenvorlage wählen, Hintergrund- und Zusatzbilder laden, Text anpassen, speichern oder senden. Senden belastet SMS- oder WhatsApp-Guthaben unter Messaging-Guthaben."
  },
  es: {
    title: "Campañas de marketing",
    body: "Elija plantilla del sector, cargue fondo e imágenes extra, edite textos y guarde o envíe. El envío debita créditos SMS o WhatsApp en Crédito de mensajería."
  },
  nl: {
    title: "Marketingcampagnes",
    body: "Kies een branchesjabloon, laad achtergrond en extra afbeeldingen, bewerk tekst, sla op of verstuur. Verzenden debiteert SMS- of WhatsApp-tegoed via Messagingtegoed."
  },
  ru: {
    title: "Маркетинговые кампании",
    body: "Выберите отраслевой шаблон, загрузите фон и доп. изображения, отредактируйте текст, сохраните или отправьте. Отправка списывает кредиты SMS или WhatsApp из раздела кредита сообщений."
  },
  it: {
    title: "Campagne marketing",
    body: "Scegli un modello di settore, carica sfondo e immagini extra, modifica i testi, salva o invia. L’invio addebita crediti SMS o WhatsApp da Credito messaggistica."
  },
  pt: {
    title: "Campanhas de marketing",
    body: "Escolha um modelo do setor, carregue fundo e imagens extra, edite textos, guarde ou envie. O envio debita créditos SMS ou WhatsApp em Crédito de mensagens."
  },
  el: {
    title: "Καμπάνιες marketing",
    body: "Επιλέξτε πρότυπο κλάδου, φορτώστε φόντο και επιπλέον εικόνες, επεξεργαστείτε κείμενο, αποθηκεύστε ή στείλτε. Η αποστολή χρεώνει πίστωση SMS ή WhatsApp από Πίστωση μηνυμάτων."
  },
  pl: {
    title: "Kampanie marketingowe",
    body: "Wybierz szablon branżowy, dodaj tło i dodatkowe obrazy, edytuj treść, zapisz lub wyślij. Wysyłka obciąża kredyt SMS lub WhatsApp w Kredyt wiadomości."
  },
  ar: {
    title: "حملات التسويق",
    body: "اختر قالبًا للقطاع، حمّل الخلفية والصور الإضافية، عدّل النص، ثم احفظ أو أرسل. الإرسال يخصم رصيد SMS أو WhatsApp من رصيد المراسلة."
  }
};

const HELP_INAPP = {
  en: {
    title: "In-app marketing",
    body: "Publish an interstitial spot ad into the FLOQR advertisement pool (Mingl, RydR, clubs, shoutout slots). Use templates based on your venue's upcoming events. No SMS credits required."
  },
  fr: {
    title: "Marketing in-app",
    body: "Publiez une annonce spot interstitielle dans le pool FLOQR (Mingl, RydR, clubs, emplacements ShoutOut). Modèles basés sur les événements du lieu. Aucun crédit SMS requis."
  },
  de: {
    title: "In-App-Marketing",
    body: "Veröffentlichen Sie eine Spot-Interstitial-Anzeige im FLOQR-Werbe-Pool (Mingl, RydR, Clubs, ShoutOut-Slots). Vorlagen aus kommenden Events des Standorts. Kein SMS-Guthaben nötig."
  },
  es: {
    title: "Marketing in-app",
    body: "Publique un anuncio spot intersticial en el pool FLOQR (Mingl, RydR, clubs, slots ShoutOut). Plantillas según eventos del local. No requiere créditos SMS."
  },
  nl: {
    title: "In-app marketing",
    body: "Publiceer een interstitiale spot-ad in de FLOQR-advertentiepool (Mingl, RydR, clubs, shoutout-slots). Sjablonen op basis van komende events. Geen SMS-tegoed nodig."
  },
  ru: {
    title: "In-app маркетинг",
    body: "Опубликуйте spot interstitial в пуле рекламы FLOQR (Mingl, RydR, клубы, слоты ShoutOut). Шаблоны по предстоящим событиям площадки. Кредиты SMS не нужны."
  },
  it: {
    title: "Marketing in-app",
    body: "Pubblica uno spot interstitial nel pool pubblicitario FLOQR (Mingl, RydR, club, slot ShoutOut). Modelli dagli eventi in programma. Nessun credito SMS richiesto."
  },
  pt: {
    title: "Marketing in-app",
    body: "Publique um spot interstitial no pool FLOQR (Mingl, RydR, clubes, slots ShoutOut). Modelos com base nos eventos do local. Sem créditos SMS."
  },
  el: {
    title: "Marketing in-app",
    body: "Δημοσιεύστε spot interstitial στο pool διαφημίσεων FLOQR (Mingl, RydR, clubs, θέσεις ShoutOut). Πρότυπα από επερχόμενα events. Δεν απαιτούνται πίστωση SMS."
  },
  pl: {
    title: "Marketing in-app",
    body: "Opublikuj spot interstitial w puli reklam FLOQR (Mingl, RydR, kluby, sloty ShoutOut). Szablony z nadchodzących wydarzeń lokalu. Bez kredytu SMS."
  },
  ar: {
    title: "التسويق داخل التطبيق",
    body: "انشر إعلان spot بينيًا في مجمع إعلانات FLOQR (Mingl وRydR والأندية ومواقع ShoutOut). قوالب من فعاليات المكان القادمة. لا يلزم رصيد SMS."
  }
};

const HELP_LOGS_UPDATE = {
  en: "Club Admin → Marketing → SMS & WhatsApp Logs shows Twilio SMS and WhatsApp for this venue (marketing Send test, club alerts). The same rows appear under Master Admin → Twilio. Dry-run means secrets or From were missing — nothing was delivered and credits were not debited. Phones are masked.",
  fr: "Club Admin → Marketing → Journaux SMS et WhatsApp affiche Twilio SMS et WhatsApp pour ce lieu (test marketing, alertes club). Les mêmes lignes apparaissent sous Master Admin → Twilio. Dry-run : secrets ou From manquants — rien n’a été livré et aucun crédit débité. Téléphones masqués.",
  de: "Club Admin → Marketing → SMS- & WhatsApp-Protokolle zeigt Twilio SMS und WhatsApp für diesen Standort (Marketing-Test, Club-Alerts). Dieselben Zeilen unter Master Admin → Twilio. Dry-run: Secrets oder From fehlten — nichts zugestellt, kein Guthaben belastet. Telefonnummern maskiert.",
  es: "Club Admin → Marketing → Registros SMS y WhatsApp muestra Twilio SMS y WhatsApp de este local (prueba marketing, alertas). Las mismas filas en Master Admin → Twilio. Dry-run: faltaron secretos o From — no se entregó ni se debitó crédito. Teléfonos enmascarados.",
  nl: "Club Admin → Marketing → SMS- en WhatsApp-logboeken toont Twilio SMS en WhatsApp voor deze locatie (marketingtest, clubalerts). Dezelfde rijen onder Master Admin → Twilio. Dry-run: secrets of From ontbraken — niets geleverd, geen tegoed afgeschreven. Telefoons gemaskeerd.",
  ru: "Club Admin → Marketing → Журналы SMS и WhatsApp показывает Twilio SMS и WhatsApp для площадки (тест marketing, алерты клуба). Те же строки в Master Admin → Twilio. Dry-run: не хватало secrets или From — доставки и списания не было. Телефоны скрыты.",
  it: "Club Admin → Marketing → Log SMS e WhatsApp mostra Twilio SMS e WhatsApp per questo locale (test marketing, alert club). Stesse righe in Master Admin → Twilio. Dry-run: secrets o From mancanti — nessuna consegna né addebito crediti. Telefoni mascherati.",
  pt: "Club Admin → Marketing → Registos SMS e WhatsApp mostra Twilio SMS e WhatsApp deste local (teste marketing, alertas). As mesmas linhas em Master Admin → Twilio. Dry-run: faltaram secrets ou From — nada entregue nem crédito debitado. Telefones mascarados.",
  el: "Club Admin → Marketing → Αρχεία SMS & WhatsApp εμφανίζει Twilio SMS και WhatsApp για τον χώρο (δοκιμή marketing, ειδοποιήσεις club). Ίδιες γραμμές στο Master Admin → Twilio. Dry-run: έλειπαν secrets ή From — καμία παράδοση/χρέωση. Τηλέφωνα masked.",
  pl: "Club Admin → Marketing → Dzienniki SMS i WhatsApp pokazuje Twilio SMS i WhatsApp dla lokalu (test marketing, alerty klubu). Te same wiersze w Master Admin → Twilio. Dry-run: brak secrets lub From — brak dostawy i obciążenia. Telefony zamaskowane.",
  ar: "Club Admin → Marketing → سجلات SMS وWhatsApp تعرض Twilio SMS وWhatsApp لهذا المكان (اختبار تسويق، تنبيهات النادي). نفس الصفوف في Master Admin → Twilio. dry-run: نقص secrets أو From — لم يُسلَّم شيء ولم يُخصم رصيد. أرقام مخفية."
};

for (const lang of LANGS) {
  const chromePath = path.join(__dirname, `_chrome-${lang}.json`);
  const pack = JSON.parse(fs.readFileSync(chromePath, "utf8"));
  Object.assign(pack, CHROME[lang]);
  fs.writeFileSync(chromePath, JSON.stringify(pack, null, 2) + "\n");

  const helpPath = path.join(__dirname, `_help-${lang}.json`);
  const help = JSON.parse(fs.readFileSync(helpPath, "utf8"));
  help["help-club-messaging-credit"] = HELP_CREDIT[lang];
  help["help-club-marketing-campaigns"] = HELP_CAMPAIGNS[lang];
  help["help-club-in-app-marketing"] = HELP_INAPP[lang];
  if (help["help-club-messaging-logs"]) {
    help["help-club-messaging-logs"].body = HELP_LOGS_UPDATE[lang];
  }
  fs.writeFileSync(helpPath, JSON.stringify(help, null, 2) + "\n");
}

console.log("Patched chrome + help for club marketing (all langs)");
