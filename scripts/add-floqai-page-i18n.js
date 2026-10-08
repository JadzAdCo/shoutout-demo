#!/usr/bin/env node
/* FloqAi standalone page — 15 chrome keys (11 packs) + help-floqai-page (repository, _help-en.json, 10 help packs). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const read = file => fs.readFileSync(at(file), "utf8").replace(/\r\n/g, "\n");
const write = (file, src) => fs.writeFileSync(at(file), src);

const KEYS = ["page.floqai.title", "floqai.helpIntro", "floqai.helpScope", "floqai.prompt", "floqai.placeholder", "floqai.hint",
  "floqai.scopeMasterAdmin", "floqai.scopeVenueAdmin", "floqai.scopeServiceMember", "floqai.scopePatron",
  "floqai.wantTo", "floqai.noMatch", "floqai.noMatchHint", "floqai.onboardingLink", "floqai.classicSearch"];
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const HELP_ORDER = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];

const T = {
  en: ["FloqAi",
    "Ask FloqAi anything about FLOQR in plain words: events and clubs, ShoutOut, Mingl, RydR, BartR, supRstar, your profile, staff schedules, or Club Admin tools.",
    "Results only include what your account can use. Patrons, staff, Club Admins, and Master Admins each see their own answers.",
    "Tell me what you want to do",
    "Clubs near me · Create a schedule · Club website feed · ShoutOut",
    "Try: clubs near me · create a schedule · club website feed · make me a superstar · I want to be a Club Admin",
    "Showing answers for Master Admin (all areas).", "Showing answers for Club Admin, staff, and patrons.", "Showing answers for staff and patrons.", "Showing answers for patrons.",
    "I want to be able to…", "No clear match yet",
    "Try a product (Mingl, RydR, BartR, ShoutOut), a goal like “I want to be a Club Admin,” or a phrase like “Onboarding”.",
    "Onboarding / role access", "Open classic Search"],
  fr: ["FloqAi",
    "Demandez à FloqAi tout ce qui concerne FLOQR, avec vos mots : événements et clubs, ShoutOut, Mingl, RydR, BartR, supRstar, votre profil, les plannings du personnel ou les outils Club Admin.",
    "Les résultats ne montrent que ce que votre compte peut utiliser. Clients, personnel, Club Admins et Master Admins voient chacun leurs propres réponses.",
    "Dites-moi ce que vous voulez faire",
    "Clubs près de moi · Créer un planning · Flux du site du club · ShoutOut",
    "Essayez : clubs près de moi · créer un planning · flux du site du club · make me a superstar · je veux devenir Club Admin",
    "Réponses pour Master Admin (tous les domaines).", "Réponses pour Club Admin, personnel et clients.", "Réponses pour le personnel et les clients.", "Réponses pour les clients.",
    "Je veux pouvoir…", "Pas encore de résultat clair",
    "Essayez un produit (Mingl, RydR, BartR, ShoutOut), un objectif comme « Je veux devenir Club Admin » ou un mot comme « Onboarding ».",
    "Onboarding / accès aux rôles", "Ouvrir la recherche classique"],
  de: ["FloqAi",
    "Frag FloqAi alles über FLOQR in deinen eigenen Worten: Events und Clubs, ShoutOut, Mingl, RydR, BartR, supRstar, dein Profil, Mitarbeiterpläne oder Club-Admin-Werkzeuge.",
    "Die Ergebnisse zeigen nur, was dein Konto nutzen darf. Gäste, Personal, Club Admins und Master Admins sehen jeweils ihre eigenen Antworten.",
    "Sag mir, was du tun möchtest",
    "Clubs in meiner Nähe · Plan erstellen · Feed für die Club-Website · ShoutOut",
    "Probier: Clubs in meiner Nähe · Plan erstellen · Feed für die Club-Website · make me a superstar · Ich möchte Club Admin werden",
    "Antworten für Master Admin (alle Bereiche).", "Antworten für Club Admin, Personal und Gäste.", "Antworten für Personal und Gäste.", "Antworten für Gäste.",
    "Ich möchte…", "Noch kein eindeutiger Treffer",
    "Probier ein Produkt (Mingl, RydR, BartR, ShoutOut), ein Ziel wie „Ich möchte Club Admin werden“ oder ein Wort wie „Onboarding“.",
    "Onboarding / Rollenzugang", "Klassische Suche öffnen"],
  es: ["FloqAi",
    "Pregunta a FloqAi lo que quieras sobre FLOQR con tus palabras: eventos y clubs, ShoutOut, Mingl, RydR, BartR, supRstar, tu perfil, horarios del personal o herramientas de Club Admin.",
    "Los resultados solo incluyen lo que tu cuenta puede usar. Clientes, personal, Club Admins y Master Admins ven cada uno sus propias respuestas.",
    "Dime qué quieres hacer",
    "Clubs cerca de mí · Crear un horario · Feed para la web del club · ShoutOut",
    "Prueba: clubs cerca de mí · crear un horario · feed para la web del club · make me a superstar · quiero ser Club Admin",
    "Respuestas para Master Admin (todas las áreas).", "Respuestas para Club Admin, personal y clientes.", "Respuestas para personal y clientes.", "Respuestas para clientes.",
    "Quiero poder…", "Aún no hay una coincidencia clara",
    "Prueba un producto (Mingl, RydR, BartR, ShoutOut), un objetivo como «Quiero ser Club Admin» o una palabra como «Onboarding».",
    "Onboarding / acceso a roles", "Abrir la búsqueda clásica"],
  nl: ["FloqAi",
    "Vraag FloqAi alles over FLOQR in je eigen woorden: evenementen en clubs, ShoutOut, Mingl, RydR, BartR, supRstar, je profiel, personeelsroosters of Club Admin-tools.",
    "De resultaten tonen alleen wat jouw account mag gebruiken. Bezoekers, personeel, Club Admins en Master Admins zien elk hun eigen antwoorden.",
    "Vertel me wat je wilt doen",
    "Clubs bij mij in de buurt · Rooster maken · Feed voor de clubwebsite · ShoutOut",
    "Probeer: clubs bij mij in de buurt · rooster maken · feed voor de clubwebsite · make me a superstar · ik wil Club Admin worden",
    "Antwoorden voor Master Admin (alle onderdelen).", "Antwoorden voor Club Admin, personeel en bezoekers.", "Antwoorden voor personeel en bezoekers.", "Antwoorden voor bezoekers.",
    "Ik wil kunnen…", "Nog geen duidelijke match",
    "Probeer een product (Mingl, RydR, BartR, ShoutOut), een doel zoals ‘Ik wil Club Admin worden’ of een woord zoals ‘Onboarding’.",
    "Onboarding / roltoegang", "Klassiek zoeken openen"],
  ru: ["FloqAi",
    "Спросите FloqAi о чём угодно в FLOQR своими словами: события и клубы, ShoutOut, Mingl, RydR, BartR, supRstar, ваш профиль, расписания персонала или инструменты Club Admin.",
    "В результатах только то, что доступно вашему аккаунту. Гости, персонал, Club Admins и Master Admins видят свои ответы.",
    "Расскажите, что вы хотите сделать",
    "Клубы рядом · Создать расписание · Фид для сайта клуба · ShoutOut",
    "Попробуйте: клубы рядом · создать расписание · фид для сайта клуба · make me a superstar · хочу стать Club Admin",
    "Ответы для Master Admin (все разделы).", "Ответы для Club Admin, персонала и гостей.", "Ответы для персонала и гостей.", "Ответы для гостей.",
    "Я хочу…", "Точного совпадения пока нет",
    "Попробуйте продукт (Mingl, RydR, BartR, ShoutOut), цель вроде «Хочу стать Club Admin» или слово «Onboarding».",
    "Onboarding / доступ к ролям", "Открыть обычный поиск"],
  it: ["FloqAi",
    "Chiedi a FloqAi qualsiasi cosa su FLOQR con parole tue: eventi e club, ShoutOut, Mingl, RydR, BartR, supRstar, il tuo profilo, gli orari del personale o gli strumenti Club Admin.",
    "I risultati includono solo ciò che il tuo account può usare. Clienti, personale, Club Admin e Master Admin vedono ognuno le proprie risposte.",
    "Dimmi cosa vuoi fare",
    "Club vicino a me · Crea un orario · Feed per il sito del club · ShoutOut",
    "Prova: club vicino a me · crea un orario · feed per il sito del club · make me a superstar · voglio diventare Club Admin",
    "Risposte per Master Admin (tutte le aree).", "Risposte per Club Admin, personale e clienti.", "Risposte per personale e clienti.", "Risposte per i clienti.",
    "Voglio poter…", "Ancora nessun risultato chiaro",
    "Prova un prodotto (Mingl, RydR, BartR, ShoutOut), un obiettivo come «Voglio diventare Club Admin» o una parola come «Onboarding».",
    "Onboarding / accesso ai ruoli", "Apri la ricerca classica"],
  pt: ["FloqAi",
    "Pergunte ao FloqAi qualquer coisa sobre o FLOQR com suas palavras: eventos e clubes, ShoutOut, Mingl, RydR, BartR, supRstar, seu perfil, escalas da equipe ou ferramentas de Club Admin.",
    "Os resultados mostram só o que sua conta pode usar. Clientes, equipe, Club Admins e Master Admins veem cada um as próprias respostas.",
    "Diga o que você quer fazer",
    "Clubes perto de mim · Criar escala · Feed para o site do clube · ShoutOut",
    "Tente: clubes perto de mim · criar escala · feed para o site do clube · make me a superstar · quero ser Club Admin",
    "Respostas para Master Admin (todas as áreas).", "Respostas para Club Admin, equipe e clientes.", "Respostas para equipe e clientes.", "Respostas para clientes.",
    "Quero poder…", "Ainda sem resultado claro",
    "Tente um produto (Mingl, RydR, BartR, ShoutOut), um objetivo como “Quero ser Club Admin” ou uma palavra como “Onboarding”.",
    "Onboarding / acesso a funções", "Abrir a busca clássica"],
  el: ["FloqAi",
    "Ρωτήστε το FloqAi οτιδήποτε για το FLOQR με δικά σας λόγια: εκδηλώσεις και κλαμπ, ShoutOut, Mingl, RydR, BartR, supRstar, το προφίλ σας, προγράμματα προσωπικού ή εργαλεία Club Admin.",
    "Τα αποτελέσματα περιλαμβάνουν μόνο ό,τι μπορεί να χρησιμοποιήσει ο λογαριασμός σας. Θαμώνες, προσωπικό, Club Admins και Master Admins βλέπουν ο καθένας τις δικές του απαντήσεις.",
    "Πείτε μου τι θέλετε να κάνετε",
    "Κλαμπ κοντά μου · Δημιουργία προγράμματος · Ροή για τον ιστότοπο του κλαμπ · ShoutOut",
    "Δοκιμάστε: κλαμπ κοντά μου · δημιουργία προγράμματος · ροή για τον ιστότοπο του κλαμπ · make me a superstar · θέλω να γίνω Club Admin",
    "Απαντήσεις για Master Admin (όλες οι περιοχές).", "Απαντήσεις για Club Admin, προσωπικό και θαμώνες.", "Απαντήσεις για προσωπικό και θαμώνες.", "Απαντήσεις για θαμώνες.",
    "Θέλω να μπορώ να…", "Δεν υπάρχει ακόμη σαφές αποτέλεσμα",
    "Δοκιμάστε ένα προϊόν (Mingl, RydR, BartR, ShoutOut), έναν στόχο όπως «Θέλω να γίνω Club Admin» ή μια λέξη όπως «Onboarding».",
    "Onboarding / πρόσβαση σε ρόλους", "Άνοιγμα κλασικής αναζήτησης"],
  pl: ["FloqAi",
    "Zapytaj FloqAi o wszystko w FLOQR własnymi słowami: wydarzenia i kluby, ShoutOut, Mingl, RydR, BartR, supRstar, Twój profil, grafiki personelu lub narzędzia Club Admin.",
    "Wyniki obejmują tylko to, z czego może korzystać Twoje konto. Goście, personel, Club Admini i Master Admini widzą własne odpowiedzi.",
    "Powiedz, co chcesz zrobić",
    "Kluby w pobliżu · Utwórz grafik · Kanał dla strony klubu · ShoutOut",
    "Spróbuj: kluby w pobliżu · utwórz grafik · kanał dla strony klubu · make me a superstar · chcę zostać Club Admin",
    "Odpowiedzi dla Master Admin (wszystkie obszary).", "Odpowiedzi dla Club Admin, personelu i gości.", "Odpowiedzi dla personelu i gości.", "Odpowiedzi dla gości.",
    "Chcę móc…", "Brak wyraźnego dopasowania",
    "Spróbuj produktu (Mingl, RydR, BartR, ShoutOut), celu jak „Chcę zostać Club Admin” lub słowa „Onboarding”.",
    "Onboarding / dostęp do ról", "Otwórz klasyczne wyszukiwanie"],
  ar: ["FloqAi",
    "اسأل FloqAi عن أي شيء في FLOQR بكلماتك: الفعاليات والنوادي وShoutOut وMingl وRydR وBartR وsupRstar وملفك الشخصي وجداول الطاقم وأدوات Club Admin.",
    "تتضمن النتائج فقط ما يمكن لحسابك استخدامه. يرى الرواد والطاقم ومسؤولو النوادي ومسؤولو المنصة كلٌّ إجاباته الخاصة.",
    "أخبرني بما تريد فعله",
    "نوادٍ قريبة مني · إنشاء جدول · موجز موقع النادي · ShoutOut",
    "جرّب: نوادٍ قريبة مني · إنشاء جدول · موجز موقع النادي · make me a superstar · أريد أن أصبح Club Admin",
    "إجابات لـ Master Admin (جميع الأقسام).", "إجابات لـ Club Admin والطاقم والرواد.", "إجابات للطاقم والرواد.", "إجابات للرواد.",
    "أريد أن أتمكن من…", "لا توجد نتيجة واضحة بعد",
    "جرّب منتجًا (Mingl وRydR وBartR وShoutOut)، أو هدفًا مثل «أريد أن أصبح Club Admin»، أو كلمة مثل «Onboarding».",
    "Onboarding / الوصول إلى الأدوار", "فتح البحث الكلاسيكي"]
};

const q = s => JSON.stringify(s);

let chrome = read("floqr-i18n.js");
if (chrome.includes('"floqai.helpIntro"')) throw new Error("floqai keys already present");
const anchor = /^( *)"page\.clubEmbed\.poweredBy": .*,\n/gm;
const hits = [...chrome.matchAll(anchor)];
if (hits.length !== CHROME_ORDER.length) throw new Error(`anchor hits ${hits.length}`);
let offset = 0;
hits.forEach((m, i) => {
  const lang = CHROME_ORDER[i];
  if (T[lang].length !== KEYS.length) throw new Error(`${lang} length ${T[lang].length}`);
  const block = KEYS.map((key, k) => `${m[1]}${q(key)}: ${q(T[lang][k])},\n`).join("");
  const pos = m.index + m[0].length + offset;
  chrome = chrome.slice(0, pos) + block + chrome.slice(pos);
  offset += block.length;
});
write("floqr-i18n.js", chrome);

const helpBody = lang => `${T[lang][1]} ${T[lang][2]}`;

let repo = read("floqai-help-repository.js");
if (repo.includes('id: "help-floqai-page"')) throw new Error("repository entry exists");
const repoAnchor = '      id: "help-soccer-jersey",';
if (repo.split(repoAnchor).length !== 2) throw new Error("repository anchor");
repo = repo.replace(repoAnchor, `      id: "help-floqai-page",
      title: "FloqAi",
      body: ${q(helpBody("en"))},
      searchPhrases: ["floqai", "floqai page", "ask floqai", "general search", "search everything", "what can i search"],
      links: [{label: "Open FloqAi", href: \`./floqai.html?v=\${APP_V}\`}],
      audiences: ["patron", "serviceMember", "venueAdmin", "masterAdmin"],
      source: "help-repository-seed",
      page: "floqai.html#floqAiHelpPopout"
    },
    {
${repoAnchor}`);
write("floqai-help-repository.js", repo);

const enJson = JSON.parse(read("scripts/_help-en.json"));
enJson["help-floqai-page"] = {title: "FloqAi", body: helpBody("en")};
write("scripts/_help-en.json", `${JSON.stringify(enJson, null, 2)}\n`);

let help = read("floqr-i18n-help.js");
const helpAnchor = /^( *)"help-club-website-feed": \{\n/gm;
const helpHits = [...help.matchAll(helpAnchor)];
if (helpHits.length !== HELP_ORDER.length) throw new Error(`help hits ${helpHits.length}`);
let helpOffset = 0;
helpHits.forEach((m, i) => {
  const lang = HELP_ORDER[i];
  const ind = m[1];
  const block = `${ind}"help-floqai-page": {\n${ind}  title: "FloqAi",\n${ind}  body: ${q(helpBody(lang))}\n${ind}},\n`;
  const pos = m.index + helpOffset;
  help = help.slice(0, pos) + block + help.slice(pos);
  helpOffset += block.length;
});
write("floqr-i18n-help.js", help);
console.log("floqai page: 15 chrome keys x11 + help-floqai-page x11");
