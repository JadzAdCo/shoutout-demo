#!/usr/bin/node
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const KEYS = [
  "botdee.so.title", "botdee.so.hint", "botdee.so.venue", "botdee.so.message",
  "botdee.so.template", "botdee.so.handle", "botdee.so.media",
  "botdee.so.needTemplate", "botdee.so.needHandle", "botdee.so.needMedia", "botdee.so.needCompose",
  "botdee.so.handleOn", "botdee.so.handleOff", "botdee.so.handleUnset",
  "botdee.so.photoCompose", "botdee.so.textOnly", "botdee.so.mediaUnset",
  "botdee.so.templateDefault", "botdee.so.templateUnset",
  "botdee.so.preview", "botdee.so.pay", "botdee.so.portal", "botdee.so.compose"
];

const T = {
  en: [
    "ShoutOut SMARTview",
    "BOT DEE preview only. Reply in chat to fill this in. A third-party headless throw does not need this card.",
    "Venue", "Message", "Template", "@handle", "Photo / video",
    "Choose a template", "Include your @handle?", "Text only, or photo/video via compose", "Open compose for photo/video",
    "FloqR card on", "No @handle", "Not chosen yet",
    "Photo/video — compose", "Text only", "Not chosen yet",
    "Traditional (default until you pick)", "Not chosen yet",
    "ShoutOut preview", "Pay securely", "Open in My ShoutOuts", "Open compose"
  ],
  fr: [
    "SMARTview ShoutOut",
    "Aperçu BOT DEE uniquement. Répondez dans le chat. Un envoi headless tiers n’a pas besoin de cette carte.",
    "Lieu", "Message", "Modèle", "@handle", "Photo / vidéo",
    "Choisissez un modèle", "Inclure votre @handle ?", "Texte seul, ou photo/vidéo via compose", "Ouvrir compose pour photo/vidéo",
    "Carte FloqR activée", "Pas de @handle", "Pas encore choisi",
    "Photo/vidéo — compose", "Texte seul", "Pas encore choisi",
    "Traditional (défaut tant que vous n’avez pas choisi)", "Pas encore choisi",
    "Aperçu ShoutOut", "Payer en sécurité", "Ouvrir dans Mes ShoutOuts", "Ouvrir compose"
  ],
  de: [
    "ShoutOut SMARTview",
    "Nur BOT-DEE-Vorschau. Antworten Sie im Chat. Ein Headless-Wurf von Dritten braucht diese Karte nicht.",
    "Venue", "Nachricht", "Vorlage", "@handle", "Foto / Video",
    "Vorlage wählen", "@handle einbeziehen?", "Nur Text, oder Foto/Video über Compose", "Compose für Foto/Video öffnen",
    "FloqR-Karte an", "Kein @handle", "Noch nicht gewählt",
    "Foto/Video — Compose", "Nur Text", "Noch nicht gewählt",
    "Traditional (Standard, bis Sie wählen)", "Noch nicht gewählt",
    "ShoutOut-Vorschau", "Sicher bezahlen", "In Meine ShoutOuts öffnen", "Compose öffnen"
  ],
  es: [
    "SMARTview de ShoutOut",
    "Solo vista previa de BOT DEE. Responda en el chat. Un envío headless de terceros no necesita esta tarjeta.",
    "Local", "Mensaje", "Plantilla", "@handle", "Foto / vídeo",
    "Elija una plantilla", "¿Incluir su @handle?", "Solo texto, o foto/vídeo en compose", "Abrir compose para foto/vídeo",
    "Tarjeta FloqR activada", "Sin @handle", "Aún no elegido",
    "Foto/vídeo — compose", "Solo texto", "Aún no elegido",
    "Traditional (predeterminado hasta que elija)", "Aún no elegido",
    "Vista previa de ShoutOut", "Pagar de forma segura", "Abrir en Mis ShoutOuts", "Abrir compose"
  ],
  nl: [
    "ShoutOut SMARTview",
    "Alleen BOT DEE-preview. Antwoord in de chat. Een headless throw van derden heeft deze kaart niet nodig.",
    "Venue", "Bericht", "Sjabloon", "@handle", "Foto / video",
    "Kies een sjabloon", "Uw @handle toevoegen?", "Alleen tekst, of foto/video via compose", "Open compose voor foto/video",
    "FloqR-kaart aan", "Geen @handle", "Nog niet gekozen",
    "Foto/video — compose", "Alleen tekst", "Nog niet gekozen",
    "Traditional (standaard tot u kiest)", "Nog niet gekozen",
    "ShoutOut-preview", "Veilig betalen", "Openen in Mijn ShoutOuts", "Compose openen"
  ],
  ru: [
    "ShoutOut SMARTview",
    "Только превью BOT DEE. Ответьте в чате. Сторонний headless-запрос эту карточку не требует.",
    "Площадка", "Сообщение", "Шаблон", "@handle", "Фото / видео",
    "Выберите шаблон", "Добавить ваш @handle?", "Только текст или фото/видео через compose", "Открыть compose для фото/видео",
    "Карточка FloqR включена", "Без @handle", "Ещё не выбрано",
    "Фото/видео — compose", "Только текст", "Ещё не выбрано",
    "Traditional (по умолчанию, пока не выберете)", "Ещё не выбрано",
    "Превью ShoutOut", "Оплатить безопасно", "Открыть в Мои ShoutOuts", "Открыть compose"
  ],
  it: [
    "SMARTview ShoutOut",
    "Solo anteprima BOT DEE. Rispondi in chat. Un throw headless di terze parti non serve questa scheda.",
    "Locale", "Messaggio", "Modello", "@handle", "Foto / video",
    "Scegli un modello", "Includere il tuo @handle?", "Solo testo, o foto/video da compose", "Apri compose per foto/video",
    "Scheda FloqR attiva", "Nessun @handle", "Non ancora scelto",
    "Foto/video — compose", "Solo testo", "Non ancora scelto",
    "Traditional (predefinito finché non scegli)", "Non ancora scelto",
    "Anteprima ShoutOut", "Paga in sicurezza", "Apri in I miei ShoutOuts", "Apri compose"
  ],
  pt: [
    "SMARTview ShoutOut",
    "Apenas pré-visualização BOT DEE. Responda no chat. Um envio headless de terceiros não precisa deste cartão.",
    "Venue", "Mensagem", "Modelo", "@handle", "Foto / vídeo",
    "Escolha um modelo", "Incluir o seu @handle?", "Só texto, ou foto/vídeo via compose", "Abrir compose para foto/vídeo",
    "Cartão FloqR ligado", "Sem @handle", "Ainda não escolhido",
    "Foto/vídeo — compose", "Só texto", "Ainda não escolhido",
    "Traditional (predefinição até escolher)", "Ainda não escolhido",
    "Pré-visualização ShoutOut", "Pagar com segurança", "Abrir em Meus ShoutOuts", "Abrir compose"
  ],
  el: [
    "ShoutOut SMARTview",
    "Μόνο προεπισκόπηση BOT DEE. Απαντήστε στη συνομιλία. Ένα headless throw τρίτου δεν χρειάζεται αυτή την κάρτα.",
    "Χώρος", "Μήνυμα", "Πρότυπο", "@handle", "Φωτογραφία / βίντεο",
    "Επιλέξτε πρότυπο", "Να μπει το @handle σας;", "Μόνο κείμενο, ή φωτογραφία/βίντεο μέσω compose", "Άνοιγμα compose για φωτογραφία/βίντεο",
    "Κάρτα FloqR ενεργή", "Χωρίς @handle", "Δεν επιλέχθηκε ακόμα",
    "Φωτογραφία/βίντεο — compose", "Μόνο κείμενο", "Δεν επιλέχθηκε ακόμα",
    "Traditional (προεπιλογή μέχρι να επιλέξετε)", "Δεν επιλέχθηκε ακόμα",
    "Προεπισκόπηση ShoutOut", "Ασφαλής πληρωμή", "Άνοιγμα στα ShoutOuts μου", "Άνοιγμα compose"
  ],
  pl: [
    "ShoutOut SMARTview",
    "Tylko podgląd BOT DEE. Odpowiedz na czacie. Headless od strony trzeciej nie wymaga tej karty.",
    "Lokal", "Wiadomość", "Szablon", "@handle", "Zdjęcie / wideo",
    "Wybierz szablon", "Dodać Twój @handle?", "Tylko tekst albo zdjęcie/wideo w compose", "Otwórz compose dla zdjęcia/wideo",
    "Karta FloqR włączona", "Bez @handle", "Jeszcze nie wybrane",
    "Zdjęcie/wideo — compose", "Tylko tekst", "Jeszcze nie wybrane",
    "Traditional (domyślnie, aż wybierzesz)", "Jeszcze nie wybrane",
    "Podgląd ShoutOut", "Zapłać bezpiecznie", "Otwórz w Moje ShoutOuts", "Otwórz compose"
  ],
  ar: [
    "ShoutOut SMARTview",
    "معاينة BOT DEE فقط. أجب في الدردشة. الرمي headless من طرف ثالث لا يحتاج هذه البطاقة.",
    "المكان", "الرسالة", "القالب", "@handle", "صورة / فيديو",
    "اختر قالبًا", "تضمين @handle؟", "نص فقط، أو صورة/فيديو عبر compose", "افتح compose للصورة/الفيديو",
    "بطاقة FloqR مفعّلة", "بدون @handle", "لم يُختر بعد",
    "صورة/فيديو — compose", "نص فقط", "لم يُختر بعد",
    "Traditional (افتراضي حتى تختار)", "لم يُختر بعد",
    "معاينة ShoutOut", "ادفع بأمان", "فتح في ShoutOuts الخاصة بي", "فتح compose"
  ]
};

const HELP = {
  "help-shoutout-headless-smartview": {
    en: {title: "Headless ShoutOut SMARTview", body: "When you throw a ShoutOut in BOT DEE chat, BOT DEE asks for the template, whether to print your @handle on the FloqR card, and whether the board is text-only or needs a photo/video. A ShoutOut SMARTview previews those answers as you fill them. Reply in chat or tap a chip. Photo and video boards still open compose. A true headless throw from FloqR or a third party does not use this card — pass venue, message, and optional extras in one request."},
    fr: {title: "SMARTview ShoutOut headless", body: "Quand vous lancez un ShoutOut dans le chat BOT DEE, BOT DEE demande le modèle, votre @handle sur la carte FloqR, et si le board est texte seul ou photo/vidéo. Un SMARTview ShoutOut prévisualise vos réponses. Répondez dans le chat ou touchez une puce. Photo et vidéo passent par compose. Un envoi headless FloqR ou tiers n’utilise pas cette carte — envoyez lieu, message et extras optionnels en une requête."},
    de: {title: "Headless ShoutOut SMARTview", body: "Wenn Sie in BOT DEE einen ShoutOut werfen, fragt BOT DEE Vorlage, @handle auf der FloqR-Karte und Text-only oder Foto/Video. Ein ShoutOut SMARTview zeigt die Antworten. Antworten Sie im Chat oder tippen Sie einen Chip. Foto/Video bleibt Compose. Ein echter Headless-Wurf von FloqR oder Dritten nutzt diese Karte nicht — Venue, Text und optionale Extras in einer Anfrage."},
    es: {title: "SMARTview ShoutOut headless", body: "Al lanzar un ShoutOut en el chat de BOT DEE, BOT DEE pide la plantilla, su @handle en la tarjeta FloqR y si el tablero es solo texto o foto/vídeo. Un SMARTview de ShoutOut previsualiza las respuestas. Responda en el chat o toque un chip. Foto y vídeo siguen en compose. Un envío headless de FloqR o de un tercero no usa esta tarjeta: local, mensaje y extras opcionales en una petición."},
    nl: {title: "Headless ShoutOut SMARTview", body: "Als u in BOT DEE een ShoutOut gooit, vraagt BOT DEE het sjabloon, uw @handle op de FloqR-kaart, en tekst-only of foto/video. Een ShoutOut SMARTview toont de antwoorden. Antwoord in de chat of tik een chip. Foto en video blijven compose. Een echte headless throw van FloqR of een derde gebruikt deze kaart niet — venue, bericht en optionele extras in één verzoek."},
    ru: {title: "Headless ShoutOut SMARTview", body: "Когда вы бросаете ShoutOut в чате BOT DEE, бот спрашивает шаблон, @handle на карточке FloqR и текст или фото/видео. SMARTview показывает ответы. Ответьте в чате или нажмите чип. Фото и видео по-прежнему через compose. Настоящий headless-запрос FloqR или третьей стороны эту карточку не использует — площадка, текст и опции в одном запросе."},
    it: {title: "SMARTview ShoutOut headless", body: "Quando lanci uno ShoutOut in chat BOT DEE, BOT DEE chiede il modello, il @handle sulla scheda FloqR e se il board è solo testo o foto/video. Una SMARTview ShoutOut anteprima le risposte. Rispondi in chat o tocca un chip. Foto e video restano su compose. Un throw headless FloqR o di terzi non usa questa scheda — locale, messaggio ed extra opzionali in una richiesta."},
    pt: {title: "SMARTview ShoutOut headless", body: "Quando lança um ShoutOut no chat BOT DEE, o BOT DEE pede o modelo, o @handle no cartão FloqR e se o board é só texto ou foto/vídeo. Um SMARTview ShoutOut pré-visualiza as respostas. Responda no chat ou toque num chip. Foto e vídeo continuam no compose. Um envio headless FloqR ou de terceiros não usa este cartão — venue, mensagem e extras opcionais num pedido."},
    el: {title: "Headless ShoutOut SMARTview", body: "Όταν ρίχνετε ShoutOut στη συνομιλία BOT DEE, ρωτά πρότυπο, @handle στην κάρτα FloqR και κείμενο ή φωτογραφία/βίντεο. Ένα ShoutOut SMARTview δείχνει τις απαντήσεις. Απαντήστε στη συνομιλία ή πατήστε chip. Φωτογραφία/βίντεο μένουν στο compose. Ένα πραγματικό headless throw από FloqR ή τρίτο δεν χρησιμοποιεί αυτή την κάρτα — χώρος, μήνυμα και προαιρετικά extras σε ένα αίτημα."},
    pl: {title: "Headless ShoutOut SMARTview", body: "Gdy rzucasz ShoutOut na czacie BOT DEE, BOT DEE pyta o szablon, @handle na karcie FloqR i czy tablica to sam tekst, czy zdjęcie/wideo. ShoutOut SMARTview podgląda odpowiedzi. Odpowiedz na czacie albo stuknij chip. Zdjęcie i wideo nadal przez compose. Prawdziwy headless z FloqR lub strony trzeciej nie używa tej karty — lokal, treść i opcjonalne dodatki w jednym żądaniu."},
    ar: {title: "Headless ShoutOut SMARTview", body: "عندما ترمي ShoutOut في دردشة BOT DEE يطلب القالب و@handle على بطاقة FloqR وهل اللوحة نص فقط أم صورة/فيديو. يعرض ShoutOut SMARTview الإجابات أثناء التعبئة. أجب في الدردشة أو اضغط شريحة. الصورة والفيديو ما زالا عبر compose. الرمي headless الحقيقي من FloqR أو طرف ثالث لا يستخدم هذه البطاقة — المكان والرسالة والإضافات الاختيارية في طلب واحد."}
  }
};

function injectChrome(src, lang, pairs) {
  const afterKey = `"botdee.link.shoutoutPending"`;
  const chromeStart = src.indexOf("const CHROME = ");
  const idx = src.indexOf(`\n    ${lang}: {`, chromeStart);
  if (idx < 0) throw new Error(`Missing pack ${lang}`);
  const nextPack = CHROME_ORDER[CHROME_ORDER.indexOf(lang) + 1];
  const end = nextPack ? src.indexOf(`\n    ${nextPack}: {`, idx + 1) : src.indexOf("\n  };", idx);
  const slice = src.slice(idx, end);
  if (KEYS.every(k => slice.includes(q(k)))) return src;
  const block = pairs.map(([k, v]) => `      ${q(k)}: ${q(v)},`).join("\n") + "\n";
  if (!slice.includes(afterKey)) throw new Error(`Missing ${afterKey} in ${lang}`);
  return src.slice(0, idx) + slice.replace(
    new RegExp(`(${afterKey}:\\s*[^\\n]+,\\n)`),
    `$1${block}`
  ) + src.slice(idx + slice.length);
}

CHROME_ORDER.forEach(lang => {
  if (!T[lang] || T[lang].length !== KEYS.length) throw new Error(`Bad chrome pack ${lang}: ${T[lang] && T[lang].length}`);
});

let chrome = fs.readFileSync(path.join(ROOT, "floqr-i18n.js"), "utf8");
CHROME_ORDER.forEach(lang => {
  chrome = injectChrome(chrome, lang, KEYS.map((k, i) => [k, T[lang][i]]));
});
fs.writeFileSync(path.join(ROOT, "floqr-i18n.js"), chrome);

const helpEn = path.join(ROOT, "scripts", "_help-en.json");
const json = JSON.parse(fs.readFileSync(helpEn, "utf8"));
Object.keys(HELP).forEach(id => { json[id] = HELP[id].en; });
fs.writeFileSync(helpEn, `${JSON.stringify(json, null, 2)}\n`);

let helpSrc = fs.readFileSync(path.join(ROOT, "floqr-i18n-help.js"), "utf8");
const langs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
langs.forEach(lang => {
  Object.keys(HELP).forEach(id => {
    const packStart = helpSrc.indexOf(`\n    "${lang}": {`);
    const next = langs[langs.indexOf(lang) + 1];
    const packEnd = next ? helpSrc.indexOf(`\n    "${next}": {`, packStart + 1) : helpSrc.indexOf("\n  };", packStart);
    const pack = helpSrc.slice(packStart, packEnd);
    if (pack.includes(`"${id}"`)) return;
    const needle = pack.indexOf(`"help-shoutout-choose-venue"`);
    const after = pack.indexOf("\n      },", needle);
    if (needle < 0 || after < 0) throw new Error(`help-shoutout-choose-venue missing in ${lang}`);
    const block = HELP[id][lang];
    const insert = `\n      "${id}": {\n        title: ${q(block.title)},\n        body: ${q(block.body)}\n      },`;
    const cut = after + "\n      },".length;
    const updated = pack.slice(0, cut) + insert + pack.slice(cut);
    helpSrc = helpSrc.slice(0, packStart) + updated + helpSrc.slice(packEnd);
  });
});
fs.writeFileSync(path.join(ROOT, "floqr-i18n-help.js"), helpSrc);
console.log("Added", KEYS.length, "chrome keys ×", CHROME_ORDER.length, "and", Object.keys(HELP).length, "help ids");
