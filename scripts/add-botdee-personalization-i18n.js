#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const KEYS = [
  "botdee.sessionPaused",
  "botdee.prefsOpen",
  "botdee.prefsTitle",
  "botdee.prefsSave",
  "botdee.prefsCancel",
  "botdee.callMe",
  "botdee.anotherName",
  "botdee.demeanorAsk",
  "botdee.demeanorCool",
  "botdee.demeanorPro",
  "botdee.demeanorBalanced",
  "botdee.prefsRecap",
  "botdee.prefsSaved",
  "botdee.prefsFailed",
  "botdee.tempOrSaved",
  "botdee.thisConversation",
  "botdee.savedPreference",
  "botdee.greetingMorning",
  "botdee.greetingAfternoon",
  "botdee.greetingEvening",
  "botdee.privacyReply",
  "botdee.recapLead"
];

const T = {
  en: [
    "Session paused. Continue chatting.",
    "Settings",
    "BOT DEE settings",
    "Save & Close",
    "Cancel",
    "What should I call you?",
    "Another name or title",
    "What demeanor would you prefer: Socially Cool, Professional or Balanced?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Remind me where we left off",
    "Saved.",
    "Could not save. Try again.",
    "Just for this conversation, or as your saved preference?",
    "This conversation",
    "Saved preference",
    "Good morning",
    "Good afternoon",
    "Good evening",
    "The five-minute pause ends this live chat. It does not delete history you opted to save in My Profile → Feature & Orders → My BOT DEE. Guests stay ephemeral. Mingl chats are never copied here. Press Enter to send; Shift+Enter starts a new line.",
    "Last time:"
  ],
  fr: [
    "Session en pause. Continuez à discuter.",
    "Réglages",
    "Réglages BOT DEE",
    "Enregistrer et fermer",
    "Annuler",
    "Comment dois-je vous appeler ?",
    "Un autre nom ou titre",
    "Quelle attitude préférez-vous : Socially Cool, Professional ou Balanced ?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Me rappeler où nous en étions",
    "Enregistré.",
    "Enregistrement impossible. Réessayez.",
    "Pour cette conversation seulement, ou comme préférence enregistrée ?",
    "Cette conversation",
    "Préférence enregistrée",
    "Bonjour",
    "Bon après-midi",
    "Bonsoir",
    "La pause de cinq minutes termine ce chat en direct. Elle ne supprime pas l’historique que vous avez choisi d’enregistrer dans Mon profil → Fonctions et commandes → My BOT DEE. Les invités restent éphémères. Les discussions Mingl ne sont jamais copiées ici. Appuyez sur Entrée pour envoyer ; Maj+Entrée commence une nouvelle ligne.",
    "La dernière fois :"
  ],
  de: [
    "Sitzung pausiert. Schreib weiter.",
    "Einstellungen",
    "BOT DEE-Einstellungen",
    "Speichern und schließen",
    "Abbrechen",
    "Wie soll ich dich nennen?",
    "Anderer Name oder Titel",
    "Welches Auftreten möchtest du: Socially Cool, Professional oder Balanced?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Erinnere mich, wo wir aufgehört haben",
    "Gespeichert.",
    "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    "Nur für dieses Gespräch oder als gespeicherte Einstellung?",
    "Dieses Gespräch",
    "Gespeicherte Einstellung",
    "Guten Morgen",
    "Guten Nachmittag",
    "Guten Abend",
    "Die fünfminütige Pause beendet diesen Live-Chat. Sie löscht nicht den Verlauf, den du unter Mein Profil → Funktionen & Bestellungen → My BOT DEE speichern wolltest. Gäste bleiben flüchtig. Mingl-Chats werden hier nie kopiert. Enter sendet; Umschalt+Enter beginnt eine neue Zeile.",
    "Letztes Mal:"
  ],
  es: [
    "Sesión en pausa. Sigue chateando.",
    "Ajustes",
    "Ajustes de BOT DEE",
    "Guardar y cerrar",
    "Cancelar",
    "¿Cómo debo llamarte?",
    "Otro nombre o título",
    "¿Qué tono prefieres: Socially Cool, Professional o Balanced?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Recuérdame dónde lo dejamos",
    "Guardado.",
    "No se pudo guardar. Inténtalo de nuevo.",
    "¿Solo para esta conversación o como preferencia guardada?",
    "Esta conversación",
    "Preferencia guardada",
    "Buenos días",
    "Buenas tardes",
    "Buenas noches",
    "La pausa de cinco minutos termina este chat en vivo. No borra el historial que elegiste guardar en Mi perfil → Funciones y pedidos → My BOT DEE. Los invitados siguen siendo efímeros. Los chats de Mingl nunca se copian aquí. Pulsa Intro para enviar; Mayús+Intro empieza una línea nueva.",
    "La última vez:"
  ],
  nl: [
    "Sessie gepauzeerd. Ga verder met chatten.",
    "Instellingen",
    "BOT DEE-instellingen",
    "Opslaan en sluiten",
    "Annuleren",
    "Hoe mag ik je noemen?",
    "Andere naam of titel",
    "Welke houding wil je: Socially Cool, Professional of Balanced?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Herinner me waar we waren gebleven",
    "Opgeslagen.",
    "Opslaan mislukt. Probeer opnieuw.",
    "Alleen voor dit gesprek, of als opgeslagen voorkeur?",
    "Dit gesprek",
    "Opgeslagen voorkeur",
    "Goedemorgen",
    "Goedemiddag",
    "Goedenavond",
    "De pauze van vijf minuten beëindigt deze livechat. Opgeslagen geschiedenis in Mijn profiel → Functies en bestellingen → My BOT DEE blijft. Gasten blijven tijdelijk. Mingl-chats worden hier nooit gekopieerd. Enter verstuurt; Shift+Enter begint een nieuwe regel.",
    "Vorige keer:"
  ],
  ru: [
    "Сессия на паузе. Продолжайте чат.",
    "Настройки",
    "Настройки BOT DEE",
    "Сохранить и закрыть",
    "Отмена",
    "Как к вам обращаться?",
    "Другое имя или обращение",
    "Какой тон вам ближе: Socially Cool, Professional или Balanced?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Напомнить, на чём мы остановились",
    "Сохранено.",
    "Не удалось сохранить. Попробуйте ещё раз.",
    "Только для этого разговора или как сохранённое предпочтение?",
    "Этот разговор",
    "Сохранённое предпочтение",
    "Доброе утро",
    "Добрый день",
    "Добрый вечер",
    "Пятиминутная пауза завершает этот живой чат. Она не удаляет историю, которую вы сохранили в «Мой профиль» → «Функции и заказы» → My BOT DEE. Гости остаются эфемерными. Чаты Mingl сюда никогда не копируются. Enter отправляет; Shift+Enter начинает новую строку.",
    "В прошлый раз:"
  ],
  it: [
    "Sessione in pausa. Continua a chattare.",
    "Impostazioni",
    "Impostazioni BOT DEE",
    "Salva e chiudi",
    "Annulla",
    "Come devo chiamarti?",
    "Un altro nome o titolo",
    "Quale tono preferisci: Socially Cool, Professional o Balanced?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Ricordami dove eravamo rimasti",
    "Salvato.",
    "Salvataggio non riuscito. Riprova.",
    "Solo per questa conversazione o come preferenza salvata?",
    "Questa conversazione",
    "Preferenza salvata",
    "Buongiorno",
    "Buon pomeriggio",
    "Buonasera",
    "La pausa di cinque minuti termina questa chat dal vivo. Non cancella la cronologia che hai scelto di salvare in Il mio profilo → Funzioni e ordini → My BOT DEE. Gli ospiti restano effimeri. Le chat Mingl non vengono mai copiate qui. Invio invia; Maiusc+Invio inizia una nuova riga.",
    "L’ultima volta:"
  ],
  pt: [
    "Sessão em pausa. Continue a conversar.",
    "Definições",
    "Definições BOT DEE",
    "Guardar e fechar",
    "Cancelar",
    "Como devo chamar-lhe?",
    "Outro nome ou título",
    "Que tom prefere: Socially Cool, Professional ou Balanced?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Lembrar-me onde ficámos",
    "Guardado.",
    "Não foi possível guardar. Tente de novo.",
    "Só nesta conversa, ou como preferência guardada?",
    "Esta conversa",
    "Preferência guardada",
    "Bom dia",
    "Boa tarde",
    "Boa noite",
    "A pausa de cinco minutos termina este chat ao vivo. Não apaga o histórico que escolheu guardar em O meu perfil → Funções e encomendas → My BOT DEE. Os convidados continuam efémeros. Os chats Mingl nunca são copiados para aqui. Enter envia; Shift+Enter começa uma nova linha.",
    "Da última vez:"
  ],
  el: [
    "Η συνεδρία σε παύση. Συνέχισε τη συνομιλία.",
    "Ρυθμίσεις",
    "Ρυθμίσεις BOT DEE",
    "Αποθήκευση και κλείσιμο",
    "Ακύρωση",
    "Πώς να σε φωνάζω;",
    "Άλλο όνομα ή τίτλος",
    "Ποιο ύφος προτιμάς: Socially Cool, Professional ή Balanced;",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Θύμισέ μου πού μείναμε",
    "Αποθηκεύτηκε.",
    "Δεν αποθηκεύτηκε. Δοκίμασε ξανά.",
    "Μόνο για αυτή τη συνομιλία ή ως αποθηκευμένη προτίμηση;",
    "Αυτή η συνομιλία",
    "Αποθηκευμένη προτίμηση",
    "Καλημέρα",
    "Καλό απόγευμα",
    "Καλό βράδυ",
    "Η παύση των πέντε λεπτών τελειώνει αυτή τη ζωντανή συνομιλία. Δεν διαγράφει το ιστορικό που επέλεξες να αποθηκεύσεις στο Προφίλ μου → Λειτουργίες και παραγγελίες → My BOT DEE. Οι επισκέπτες μένουν προσωρινοί. Οι συνομιλίες Mingl δεν αντιγράφονται ποτέ εδώ. Enter στέλνει· Shift+Enter ξεκινά νέα γραμμή.",
    "Την προηγούμενη φορά:"
  ],
  pl: [
    "Sesja wstrzymana. Kontynuuj czat.",
    "Ustawienia",
    "Ustawienia BOT DEE",
    "Zapisz i zamknij",
    "Anuluj",
    "Jak mam się do ciebie zwracać?",
    "Inne imię lub tytuł",
    "Jaki ton wolisz: Socially Cool, Professional czy Balanced?",
    "Socially Cool",
    "Professional",
    "Balanced",
    "Przypomnij, na czym skończyliśmy",
    "Zapisano.",
    "Nie udało się zapisać. Spróbuj ponownie.",
    "Tylko w tej rozmowie, czy jako zapisana preferencja?",
    "Ta rozmowa",
    "Zapisana preferencja",
    "Dzień dobry",
    "Dzień dobry po południu",
    "Dobry wieczór",
    "Pięciominutowa pauza kończy ten czat na żywo. Nie usuwa historii, którą zapiszesz w Mój profil → Funkcje i zamówienia → My BOT DEE. Goście pozostają tymczasowi. Czaty Mingl nigdy nie są tu kopiowane. Enter wysyła; Shift+Enter zaczyna nową linię.",
    "Ostatnio:"
  ],
  ar: [
    "الجلسة متوقفة. تابع المحادثة.",
    "الإعدادات",
    "إعدادات BOT DEE",
    "حفظ وإغلاق",
    "إلغاء",
    "بماذا أناديك؟",
    "اسم أو لقب آخر",
    "أي أسلوب تفضل: Socially Cool أو Professional أو Balanced؟",
    "Socially Cool",
    "Professional",
    "Balanced",
    "ذكّرني أين توقفنا",
    "تم الحفظ.",
    "تعذّر الحفظ. حاول مرة أخرى.",
    "لهذه المحادثة فقط، أم كتفضيل محفوظ؟",
    "هذه المحادثة",
    "تفضيل محفوظ",
    "صباح الخير",
    "طاب مساؤك",
    "مساء الخير",
    "توقف الخمس دقائق ينهي هذه المحادثة المباشرة. لا يحذف السجل الذي اخترت حفظه في ملفي → الميزات والطلبات → My BOT DEE. يبقى الضيوف مؤقتين. لا تُنسخ محادثات Mingl إلى هنا أبدًا. Enter يرسل؛ Shift+Enter يبدأ سطرًا جديدًا.",
    "آخر مرة:"
  ]
};

const PLACEHOLDER = {
  en: "Ask BOT DEE…",
  fr: "Demandez à BOT DEE…",
  de: "Frag BOT DEE…",
  es: "Pregunta a BOT DEE…",
  nl: "Vraag BOT DEE…",
  ru: "Спросите BOT DEE…",
  it: "Chiedi a BOT DEE…",
  pt: "Pergunte ao BOT DEE…",
  el: "Ρώτα τον BOT DEE…",
  pl: "Zapytaj BOT DEE…",
  ar: "اسأل BOT DEE…"
};

const HELLO = {
  en: "Good afternoon. How can I help?",
  fr: "Bon après-midi. Comment puis-je vous aider ?",
  de: "Guten Nachmittag. Wie kann ich dir helfen?",
  es: "Buenas tardes. ¿En qué puedo ayudarte?",
  nl: "Goedemiddag. Hoe kan ik je helpen?",
  ru: "Добрый день. Чем могу помочь?",
  it: "Buon pomeriggio. Come posso aiutarti?",
  pt: "Boa tarde. Como posso ajudar?",
  el: "Καλό απόγευμα. Πώς μπορώ να βοηθήσω;",
  pl: "Dzień dobry. W czym mogę pomóc?",
  ar: "طاب مساؤك. كيف يمكنني مساعدتك؟"
};

const RESUME = {
  en: "Welcome back. How can I help?",
  fr: "Bon retour. Comment puis-je vous aider ?",
  de: "Willkommen zurück. Wie kann ich dir helfen?",
  es: "Bienvenido de nuevo. ¿En qué puedo ayudarte?",
  nl: "Welkom terug. Hoe kan ik je helpen?",
  ru: "С возвращением. Чем могу помочь?",
  it: "Bentornato. Come posso aiutarti?",
  pt: "Bem-vindo de volta. Como posso ajudar?",
  el: "Καλώς όρισες ξανά. Πώς μπορώ να βοηθήσω;",
  pl: "Witaj ponownie. W czym mogę pomóc?",
  ar: "مرحبًا بعودتك. كيف يمكنني مساعدتك؟"
};

const HELP = {
  en: "I'm BOT DEE — ask me anything about FLOQR in plain words. Press Enter to send; Shift+Enter starts a new line. Type privacy for pause and session details. What are you interested in getting help with?",
  fr: "Je suis BOT DEE — posez-moi des questions sur FLOQR en mots simples. Entrée envoie ; Maj+Entrée commence une nouvelle ligne. Tapez privacy pour la pause et la session. Sur quoi voulez-vous de l’aide ?",
  de: "Ich bin BOT DEE — frag mich auf FLOQR in normalen Worten. Enter sendet; Umschalt+Enter beginnt eine neue Zeile. Tippe privacy für Pause und Sitzung. Wobei brauchst du Hilfe?",
  es: "Soy BOT DEE — pregúntame sobre FLOQR con palabras sencillas. Intro envía; Mayús+Intro empieza una línea nueva. Escribe privacy para la pausa y la sesión. ¿En qué quieres ayuda?",
  nl: "Ik ben BOT DEE — vraag me in gewone woorden over FLOQR. Enter stuurt; Shift+Enter begint een nieuwe regel. Typ privacy voor pauze en sessie. Waar wil je hulp bij?",
  ru: "Я BOT DEE — спрашивайте о FLOQR своими словами. Enter отправляет; Shift+Enter начинает новую строку. Напишите privacy для паузы и сессии. С чем помочь?",
  it: "Sono BOT DEE — chiedimi su FLOQR con parole semplici. Invio invia; Maiusc+Invio inizia una nuova riga. Scrivi privacy per pausa e sessione. Su cosa vuoi aiuto?",
  pt: "Sou BOT DEE — pergunte sobre o FLOQR em palavras simples. Enter envia; Shift+Enter começa uma nova linha. Escreva privacy para pausa e sessão. Em que quer ajuda?",
  el: "Είμαι ο BOT DEE — ρώτα με για το FLOQR με απλά λόγια. Enter στέλνει· Shift+Enter ξεκινά νέα γραμμή. Γράψε privacy για παύση και συνεδρία. Με τι θέλεις βοήθεια;",
  pl: "Jestem BOT DEE — pytaj o FLOQR zwykłymi słowami. Enter wysyła; Shift+Enter zaczyna nową linię. Wpisz privacy, aby poznać pauzę i sesję. W czym pomóc?",
  ar: "أنا BOT DEE — اسألني عن FLOQR بكلمات بسيطة. Enter يرسل؛ Shift+Enter يبدأ سطرًا جديدًا. اكتب privacy لتفاصيل الإيقاف والجلسة. بماذا تريد المساعدة؟"
};

function insertKeys(src) {
  if (src.includes('"botdee.sessionPaused"')) return src;
  let out = src;
  let from = 0;
  CHROME_ORDER.forEach((lang, n) => {
    const values = T[lang];
    if (values.length !== KEYS.length) throw new Error(`${lang} value count`);
    const needle = `"botdee.chatPlaceholder":`;
    const idx = out.indexOf(needle, from);
    if (idx < 0) throw new Error(`placeholder missing for ${lang}`);
    const lineEnd = out.indexOf("\n", idx);
    const extra = KEYS.map((key, i) => `      ${q(key)}: ${q(values[i])}`).join(",\n");
    const injected = `\n${extra},`;
    out = `${out.slice(0, lineEnd)}${injected}${out.slice(lineEnd)}`;
    from = lineEnd + injected.length;
    void n;
  });
  return out;
}

function replaceKeyed(src, key, map) {
  let out = src;
  const re = new RegExp(`("${key.replace(".", "\\.")}":\\s*)"[^"]*"` , "g");
  const langs = [];
  out = out.replace(re, (full, prefix) => {
    const lang = CHROME_ORDER[langs.length];
    langs.push(lang);
    if (!map[lang]) throw new Error(`missing ${key} ${lang}`);
    return `${prefix}${q(map[lang])}`;
  });
  if (langs.length !== 11) throw new Error(`${key} replacements ${langs.length}`);
  return out;
}

function helpBodies() {
  return {
    ru: {
      title: "Конфиденциальность и сессия BOT DEE",
      body: "Пауза в пять минут завершает живой чат BOT DEE. Она не удаляет историю, которую вы сохранили в «Мой профиль» → «Функции и заказы» → My BOT DEE. Гости остаются эфемерными. Чаты Mingl сюда не копируются. Enter отправляет сообщение; Shift+Enter начинает новую строку. Настройки имени и тона открываются кнопкой Settings на странице BOT DEE."
    },
    nl: {
      title: "BOT DEE privacy en sessie",
      body: "De pauze van vijf minuten beëindigt de live BOT DEE-chat. Opgeslagen geschiedenis in Mijn profiel → Functies en bestellingen → My BOT DEE blijft. Gasten blijven tijdelijk. Mingl-chats worden hier nooit gekopieerd. Enter verstuurt; Shift+Enter begint een nieuwe regel. Naam en toon staan onder Settings op de BOT DEE-pagina."
    },
    fr: {
      title: "Confidentialité et session BOT DEE",
      body: "La pause de cinq minutes termine le chat BOT DEE en direct. Elle ne supprime pas l’historique enregistré dans Mon profil → Fonctions et commandes → My BOT DEE. Les invités restent éphémères. Les discussions Mingl ne sont jamais copiées ici. Entrée envoie ; Maj+Entrée commence une nouvelle ligne. Le nom et le ton se règlent via Settings sur la page BOT DEE."
    },
    de: {
      title: "BOT DEE Datenschutz und Sitzung",
      body: "Die fünfminütige Pause beendet den Live-Chat. Gespeicherter Verlauf unter Mein Profil → Funktionen & Bestellungen → My BOT DEE bleibt. Gäste bleiben flüchtig. Mingl-Chats werden hier nie kopiert. Enter sendet; Umschalt+Enter beginnt eine neue Zeile. Name und Ton stellst du unter Settings auf der BOT DEE-Seite ein."
    },
    es: {
      title: "Privacidad y sesión de BOT DEE",
      body: "La pausa de cinco minutos termina el chat en vivo. No borra el historial guardado en Mi perfil → Funciones y pedidos → My BOT DEE. Los invitados siguen siendo efímeros. Los chats de Mingl nunca se copian aquí. Intro envía; Mayús+Intro empieza una línea nueva. Nombre y tono se eligen en Settings en la página BOT DEE."
    },
    it: {
      title: "Privacy e sessione BOT DEE",
      body: "La pausa di cinque minuti termina la chat dal vivo. Non cancella la cronologia salvata in Il mio profilo → Funzioni e ordini → My BOT DEE. Gli ospiti restano effimeri. Le chat Mingl non vengono mai copiate qui. Invio invia; Maiusc+Invio inizia una nuova riga. Nome e tono sono in Settings sulla pagina BOT DEE."
    },
    pt: {
      title: "Privacidade e sessão BOT DEE",
      body: "A pausa de cinco minutos termina o chat ao vivo. Não apaga o histórico guardado em O meu perfil → Funções e encomendas → My BOT DEE. Os convidados continuam efémeros. Os chats Mingl nunca são copiados para aqui. Enter envia; Shift+Enter começa uma nova linha. Nome e tom estão em Settings na página BOT DEE."
    },
    el: {
      title: "Απόρρητο και συνεδρία BOT DEE",
      body: "Η παύση των πέντε λεπτών τελειώνει τη ζωντανή συνομιλία. Δεν διαγράφει το ιστορικό στο Προφίλ μου → Λειτουργίες και παραγγελίες → My BOT DEE. Οι επισκέπτες μένουν προσωρινοί. Οι συνομιλίες Mingl δεν αντιγράφονται εδώ. Enter στέλνει· Shift+Enter ξεκινά νέα γραμμή. Όνομα και ύφος είναι στις Settings της σελίδας BOT DEE."
    },
    pl: {
      title: "Prywatność i sesja BOT DEE",
      body: "Pięciominutowa pauza kończy czat na żywo. Nie usuwa historii w Mój profil → Funkcje i zamówienia → My BOT DEE. Goście pozostają tymczasowi. Czaty Mingl nigdy nie są tu kopiowane. Enter wysyła; Shift+Enter zaczyna nową linię. Imię i ton ustawisz w Settings na stronie BOT DEE."
    },
    ar: [
      null
    ]
  };
}

const HELP_AR = {
  title: "خصوصية وجلسة BOT DEE",
  body: "توقف الخمس دقائق ينهي محادثة BOT DEE المباشرة. لا يحذف السجل المحفوظ في ملفي → الميزات والطلبات → My BOT DEE. يبقى الضيوف مؤقتين. لا تُنسخ محادثات Mingl إلى هنا. Enter يرسل؛ Shift+Enter يبدأ سطرًا جديدًا. الاسم والأسلوب من Settings في صفحة BOT DEE."
};

function run() {
  const file = path.join(ROOT, "floqr-i18n.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('"botdee.sessionPaused"')) {
    console.log("chrome keys already present — updating placeholder/hello/resume/help");
  } else {
    src = insertKeys(src);
  }
  src = replaceKeyed(src, "botdee.chatPlaceholder", PLACEHOLDER);
  src = replaceKeyed(src, "botdee.chatHello", HELLO);
  src = replaceKeyed(src, "botdee.chatResume", RESUME);
  src = replaceKeyed(src, "botdee.chatHelp", HELP);
  fs.writeFileSync(file, src);
  console.log("updated floqr-i18n.js");

  const helpFile = path.join(ROOT, "floqr-i18n-help.js");
  let help = fs.readFileSync(helpFile, "utf8");
  const packs = helpBodies();
  packs.ar = HELP_AR;
  const helpLangs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
  if (!help.includes('"help-botdee-privacy-session"')) {
    let from = 0;
    helpLangs.forEach(lang => {
      const block = packs[lang];
      const insert = `      "help-botdee-privacy-session": {\n        title: ${q(block.title)},\n        body: ${q(block.body)}\n      },\n`;
      const marker = `"help-botdee-page": {`;
      const start = help.indexOf(marker, from);
      if (start < 0) throw new Error(`help-botdee-page missing for ${lang}`);
      help = help.slice(0, start) + insert + help.slice(start);
      from = start + insert.length + marker.length;
    });
    fs.writeFileSync(helpFile, help);
    console.log("inserted help-botdee-privacy-session");
  } else {
    console.log("help id already present");
  }
}

run();
