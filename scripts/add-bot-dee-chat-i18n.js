#!/usr/bin/env node
/* BOT DEE chat chrome keys — all 11 packs. */
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "floqr-i18n.js");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const KEYS = [
  "floqai.chatWelcome",
  "floqai.chatPlaceholder",
  "floqai.chatSend",
  "floqai.chatThinking",
  "floqai.chatOffline",
  "floqai.chatEmpty",
  "floqai.chatError",
  "floqai.chatSignIn",
  "floqai.chatFeatureOff",
  "floqai.intentFallback"
];

const T = {
  en: [
    "Hi — I am BOT DEE. Ask in plain words what you want to do in FLOQR. Quick intent search stays available below.",
    "Ask BOT DEE… ShoutOut · VIP · floqCast · schedule",
    "Send",
    "BOT DEE is thinking…",
    "Chat is unavailable right now. Use quick intent search below.",
    "No answer yet — try quick intent search.",
    "BOT DEE could not answer. Try quick intent search.",
    "Sign in to chat with BOT DEE.",
    "BOT DEE is not available on your account yet.",
    "Quick intent search"
  ],
  fr: [
    "Bonjour — je suis BOT DEE. Dites en mots simples ce que vous voulez faire dans FLOQR. La recherche d’intention rapide reste disponible ci-dessous.",
    "Demandez à BOT DEE… ShoutOut · VIP · floqCast · planning",
    "Envoyer",
    "BOT DEE réfléchit…",
    "Le chat est indisponible pour le moment. Utilisez la recherche d’intention rapide ci-dessous.",
    "Pas encore de réponse — essayez la recherche d’intention rapide.",
    "BOT DEE n’a pas pu répondre. Essayez la recherche d’intention rapide.",
    "Connectez-vous pour discuter avec BOT DEE.",
    "BOT DEE n’est pas encore disponible sur votre compte.",
    "Recherche d’intention rapide"
  ],
  de: [
    "Hallo — ich bin BOT DEE. Sag in einfachen Worten, was du in FLOQR tun möchtest. Die schnelle Intent-Suche bleibt unten verfügbar.",
    "Frag BOT DEE… ShoutOut · VIP · floqCast · Plan",
    "Senden",
    "BOT DEE denkt nach…",
    "Chat ist gerade nicht verfügbar. Nutze unten die schnelle Intent-Suche.",
    "Noch keine Antwort — versuche die schnelle Intent-Suche.",
    "BOT DEE konnte nicht antworten. Versuche die schnelle Intent-Suche.",
    "Melde dich an, um mit BOT DEE zu chatten.",
    "BOT DEE ist für dein Konto noch nicht verfügbar.",
    "Schnelle Intent-Suche"
  ],
  es: [
    "Hola — soy BOT DEE. Di en palabras sencillas qué quieres hacer en FLOQR. La búsqueda rápida de intención sigue abajo.",
    "Pregunta a BOT DEE… ShoutOut · VIP · floqCast · horario",
    "Enviar",
    "BOT DEE está pensando…",
    "El chat no está disponible ahora. Usa la búsqueda rápida de intención abajo.",
    "Aún no hay respuesta — prueba la búsqueda rápida de intención.",
    "BOT DEE no pudo responder. Prueba la búsqueda rápida de intención.",
    "Inicia sesión para chatear con BOT DEE.",
    "BOT DEE aún no está disponible en tu cuenta.",
    "Búsqueda rápida de intención"
  ],
  nl: [
    "Hoi — ik ben BOT DEE. Zeg in gewone taal wat je in FLOQR wilt doen. Snelle intent-zoekactie blijft hieronder beschikbaar.",
    "Vraag BOT DEE… ShoutOut · VIP · floqCast · planning",
    "Versturen",
    "BOT DEE denkt na…",
    "Chat is nu niet beschikbaar. Gebruik hieronder de snelle intent-zoekactie.",
    "Nog geen antwoord — probeer de snelle intent-zoekactie.",
    "BOT DEE kon niet antwoorden. Probeer de snelle intent-zoekactie.",
    "Log in om met BOT DEE te chatten.",
    "BOT DEE is nog niet beschikbaar op je account.",
    "Snelle intent-zoekactie"
  ],
  ru: [
    "Привет — я BOT DEE. Скажите простыми словами, что хотите сделать в FLOQR. Быстрый поиск намерений остаётся ниже.",
    "Спросите BOT DEE… ShoutOut · VIP · floqCast · расписание",
    "Отправить",
    "BOT DEE думает…",
    "Чат сейчас недоступен. Используйте быстрый поиск намерений ниже.",
    "Пока нет ответа — попробуйте быстрый поиск намерений.",
    "BOT DEE не смог ответить. Попробуйте быстрый поиск намерений.",
    "Войдите, чтобы общаться с BOT DEE.",
    "BOT DEE пока недоступен для вашего аккаунта.",
    "Быстрый поиск намерений"
  ],
  it: [
    "Ciao — sono BOT DEE. Dimmi con parole semplici cosa vuoi fare in FLOQR. La ricerca rapida di intent resta disponibile sotto.",
    "Chiedi a BOT DEE… ShoutOut · VIP · floqCast · turni",
    "Invia",
    "BOT DEE sta pensando…",
    "La chat non è disponibile ora. Usa la ricerca rapida di intent sotto.",
    "Nessuna risposta ancora — prova la ricerca rapida di intent.",
    "BOT DEE non ha potuto rispondere. Prova la ricerca rapida di intent.",
    "Accedi per chattare con BOT DEE.",
    "BOT DEE non è ancora disponibile sul tuo account.",
    "Ricerca rapida di intent"
  ],
  pt: [
    "Olá — sou BOT DEE. Diga em palavras simples o que quer fazer no FLOQR. A pesquisa rápida de intenção continua abaixo.",
    "Pergunte ao BOT DEE… ShoutOut · VIP · floqCast · escala",
    "Enviar",
    "BOT DEE está a pensar…",
    "O chat não está disponível agora. Use a pesquisa rápida de intenção abaixo.",
    "Ainda sem resposta — tente a pesquisa rápida de intenção.",
    "BOT DEE não conseguiu responder. Tente a pesquisa rápida de intenção.",
    "Inicie sessão para conversar com o BOT DEE.",
    "BOT DEE ainda não está disponível na sua conta.",
    "Pesquisa rápida de intenção"
  ],
  el: [
    "Γεια — είμαι ο BOT DEE. Πες με απλά λόγια τι θέλεις να κάνεις στο FLOQR. Η γρήγορη αναζήτηση πρόθεσης μένει παρακάτω.",
    "Ρώτα τον BOT DEE… ShoutOut · VIP · floqCast · πρόγραμμα",
    "Αποστολή",
    "Ο BOT DEE σκέφτεται…",
    "Η συνομιλία δεν είναι διαθέσιμη τώρα. Χρησιμοποίησε τη γρήγορη αναζήτηση πρόθεσης παρακάτω.",
    "Δεν υπάρχει ακόμα απάντηση — δοκίμασε τη γρήγορη αναζήτηση πρόθεσης.",
    "Ο BOT DEE δεν μπόρεσε να απαντήσει. Δοκίμασε τη γρήγορη αναζήτηση πρόθεσης.",
    "Συνδέσου για συνομιλία με τον BOT DEE.",
    "Ο BOT DEE δεν είναι ακόμα διαθέσιμος στον λογαριασμό σου.",
    "Γρήγορη αναζήτηση πρόθεσης"
  ],
  pl: [
    "Cześć — jestem BOT DEE. Powiedz prostymi słowami, co chcesz zrobić w FLOQR. Szybkie wyszukiwanie intencji zostaje poniżej.",
    "Zapytaj BOT DEE… ShoutOut · VIP · floqCast · grafik",
    "Wyślij",
    "BOT DEE myśli…",
    "Czat jest teraz niedostępny. Użyj szybkiego wyszukiwania intencji poniżej.",
    "Jeszcze brak odpowiedzi — spróbuj szybkiego wyszukiwania intencji.",
    "BOT DEE nie mógł odpowiedzieć. Spróbuj szybkiego wyszukiwania intencji.",
    "Zaloguj się, aby czatować z BOT DEE.",
    "BOT DEE nie jest jeszcze dostępny na Twoim koncie.",
    "Szybkie wyszukiwanie intencji"
  ],
  ar: [
    "مرحبًا — أنا BOT DEE. قل بكلمات بسيطة ما تريد فعله في FLOQR. يبقى البحث السريع عن النية أدناه.",
    "اسأل BOT DEE… ShoutOut · VIP · floqCast · الجدول",
    "إرسال",
    "BOT DEE يفكر…",
    "الدردشة غير متاحة الآن. استخدم البحث السريع عن النية أدناه.",
    "لا إجابة بعد — جرّب البحث السريع عن النية.",
    "تعذّر على BOT DEE الإجابة. جرّب البحث السريع عن النية.",
    "سجّل الدخول للدردشة مع BOT DEE.",
    "BOT DEE غير متاح على حسابك بعد.",
    "بحث سريع عن النية"
  ]
};

function injectPack(src, lang, pairs) {
  const marker = new RegExp(`(\\n\\s*${lang}:\\s*\\{)`);
  if (!marker.test(src)) throw new Error(`Missing pack ${lang}`);
  const block = pairs.map(([k, v]) => `      ${q(k)}: ${q(v)},`).join("\n");
  // Insert after floqai.scopePublic if present, else after pack open
  const afterKey = `"floqai.scopePublic"`;
  const idx = src.indexOf(`${lang}:`);
  const nextPack = CHROME_ORDER[CHROME_ORDER.indexOf(lang) + 1];
  const end = nextPack ? src.indexOf(`\n  ${nextPack}:`, idx) : src.indexOf("\n};", idx);
  const slice = src.slice(idx, end);
  if (KEYS.every(k => slice.includes(q(k)))) return src;
  if (slice.includes(afterKey)) {
    return src.replace(
      new RegExp(`(${lang}:[\\s\\S]*?${afterKey}:\\s*[^\\n]+,\\n)`),
      `$1${block}\n`
    );
  }
  return src.replace(marker, `$1\n${block}`);
}

let src = fs.readFileSync(file, "utf8");
CHROME_ORDER.forEach(lang => {
  const values = T[lang];
  if (!values || values.length !== KEYS.length) throw new Error(`Bad pack ${lang}`);
  const pairs = KEYS.map((k, i) => [k, values[i]]);
  src = injectPack(src, lang, pairs);
});

// Title stays FloqAi in packs historically; Search tile uses cat.floqai = BOT DEE.
// Keep page.floqai.title as FloqAi for chrome parity unless product asks to rename.

fs.writeFileSync(file, src);
console.log("Added BOT DEE chat i18n keys to", KEYS.length, "×", CHROME_ORDER.length, "packs");
