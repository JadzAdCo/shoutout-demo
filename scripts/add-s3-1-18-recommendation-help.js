#!/usr/bin/env node
/* s3.1.18 — ShoutOut Recommendations help ids: repository seed, canonical English, 10 locale packs. */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);

const EN = {
  "help-shoutout-recommendations": {
    title: "ShoutOut Recommendations",
    body: "Pick a style and an event type, then tap Improve My ShoutOut for ideas that fit your template and display size. Tap any idea to put it in your message, then edit it if you like. Use Past ShoutOut brings back one of your earlier messages.",
    searchPhrases: ["shoutout recommendations", "shoutout ideas", "improve my shoutout", "use past shoutout", "what should i write", "help me write a shoutout", "recommendation style"]
  },
  "help-ai-recommendations": {
    title: "AI Recommendations",
    body: "Ideas written for you from the venue, the event type, your draft and your profile. Every idea already fits the lines and characters your chosen display allows. Tap one to use it.",
    searchPhrases: ["ai recommendations", "ai shoutout", "ai ideas", "write my shoutout with ai", "personalized shoutout"]
  },
  "help-trending-shoutouts": {
    title: "Trending ShoutOuts",
    body: "Popular ShoutOuts approved by FLOQR, with picks that suit this venue's music first. Tap one to use it.",
    searchPhrases: ["trending shoutouts", "popular shoutouts", "top shoutouts", "approved shoutouts"]
  },
  "help-generic-shoutouts": {
    title: "Generic ShoutOuts",
    body: "Ready-made ideas for common moments such as birthdays and celebrations. Tap one to use it, then make it your own.",
    searchPhrases: ["generic shoutouts", "birthday shoutout ideas", "celebration shoutout", "ready made shoutout"]
  }
};

const IDS = Object.keys(EN);
const L = (a, b, c, d) => [a, b, c, d];

const PACKS = {
  fr: [
    L("Recommandations ShoutOut", "Choisissez un style et un type d'événement, puis touchez « Improve My ShoutOut » pour obtenir des idées adaptées à votre modèle et à la taille de l'écran. Touchez une idée pour la placer dans votre message, puis modifiez-la si vous le souhaitez. « Use Past ShoutOut » reprend l'un de vos anciens messages.",
      "Recommandations IA", "Des idées écrites pour vous à partir du lieu, du type d'événement, de votre brouillon et de votre profil. Chaque idée respecte déjà le nombre de lignes et de caractères de l'écran choisi. Touchez-en une pour l'utiliser."),
    L("ShoutOuts tendance", "Des ShoutOuts populaires approuvés par FLOQR, en commençant par ceux qui correspondent à la musique de ce lieu. Touchez-en un pour l'utiliser.",
      "ShoutOuts génériques", "Des idées prêtes à l'emploi pour les moments courants comme les anniversaires et les fêtes. Touchez-en une pour l'utiliser, puis personnalisez-la.")
  ],
  de: [
    L("ShoutOut-Empfehlungen", "Wähle einen Stil und eine Veranstaltungsart und tippe dann auf „Improve My ShoutOut“, um Ideen zu erhalten, die zu deiner Vorlage und Displaygröße passen. Tippe auf eine Idee, um sie in deine Nachricht zu übernehmen, und bearbeite sie bei Bedarf. „Use Past ShoutOut“ holt eine deiner früheren Nachrichten zurück.",
      "KI-Empfehlungen", "Ideen, die für dich aus dem Veranstaltungsort, der Veranstaltungsart, deinem Entwurf und deinem Profil erstellt werden. Jede Idee passt bereits zu den Zeilen und Zeichen deines gewählten Displays. Tippe auf eine, um sie zu verwenden."),
    L("Angesagte ShoutOuts", "Beliebte, von FLOQR freigegebene ShoutOuts – zuerst die, die zur Musik dieses Ortes passen. Tippe auf einen, um ihn zu verwenden.",
      "Allgemeine ShoutOuts", "Fertige Ideen für typische Anlässe wie Geburtstage und Feiern. Tippe auf eine, um sie zu verwenden, und passe sie dann an.")
  ],
  es: [
    L("Recomendaciones de ShoutOut", "Elige un estilo y un tipo de evento y toca «Improve My ShoutOut» para recibir ideas que se ajustan a tu plantilla y al tamaño de la pantalla. Toca una idea para ponerla en tu mensaje y edítala si quieres. «Use Past ShoutOut» recupera uno de tus mensajes anteriores.",
      "Recomendaciones de IA", "Ideas escritas para ti a partir del local, el tipo de evento, tu borrador y tu perfil. Cada idea ya cabe en las líneas y caracteres de la pantalla elegida. Toca una para usarla."),
    L("ShoutOuts en tendencia", "ShoutOuts populares aprobados por FLOQR, primero los que encajan con la música de este local. Toca uno para usarlo.",
      "ShoutOuts genéricos", "Ideas listas para momentos comunes como cumpleaños y celebraciones. Toca una para usarla y luego hazla tuya.")
  ],
  it: [
    L("Consigli ShoutOut", "Scegli uno stile e un tipo di evento, poi tocca «Improve My ShoutOut» per avere idee adatte al tuo modello e alla dimensione dello schermo. Tocca un'idea per inserirla nel messaggio e modificala se vuoi. «Use Past ShoutOut» recupera uno dei tuoi messaggi precedenti.",
      "Consigli IA", "Idee scritte per te in base al locale, al tipo di evento, alla tua bozza e al tuo profilo. Ogni idea rispetta già righe e caratteri dello schermo scelto. Toccane una per usarla."),
    L("ShoutOut di tendenza", "ShoutOut popolari approvati da FLOQR, prima quelli adatti alla musica di questo locale. Toccane uno per usarlo.",
      "ShoutOut generici", "Idee pronte per momenti comuni come compleanni e feste. Toccane una per usarla, poi personalizzala.")
  ],
  pt: [
    L("Recomendações de ShoutOut", "Escolha um estilo e um tipo de evento e toque em «Improve My ShoutOut» para receber ideias que cabem no seu modelo e no tamanho da tela. Toque em uma ideia para colocá-la na sua mensagem e edite-a se quiser. «Use Past ShoutOut» recupera uma das suas mensagens anteriores.",
      "Recomendações de IA", "Ideias escritas para você com base no local, no tipo de evento, no seu rascunho e no seu perfil. Cada ideia já cabe nas linhas e caracteres da tela escolhida. Toque em uma para usá-la."),
    L("ShoutOuts em alta", "ShoutOuts populares aprovados pela FLOQR, primeiro os que combinam com a música deste local. Toque em um para usá-lo.",
      "ShoutOuts genéricos", "Ideias prontas para momentos comuns, como aniversários e comemorações. Toque em uma para usá-la e depois deixe-a do seu jeito.")
  ],
  ru: [
    L("Рекомендации ShoutOut", "Выберите стиль и тип события, затем нажмите «Improve My ShoutOut», чтобы получить идеи под ваш шаблон и размер экрана. Нажмите на идею, чтобы вставить её в сообщение, и при желании отредактируйте. «Use Past ShoutOut» возвращает одно из ваших прежних сообщений.",
      "Рекомендации ИИ", "Идеи, составленные для вас с учётом заведения, типа события, вашего черновика и профиля. Каждая идея уже укладывается в число строк и символов выбранного экрана. Нажмите на идею, чтобы использовать её."),
    L("Популярные ShoutOuts", "Популярные ShoutOuts, одобренные FLOQR; сначала — подходящие под музыку этого заведения. Нажмите, чтобы использовать.",
      "Общие ShoutOuts", "Готовые идеи для обычных поводов — дней рождения и праздников. Нажмите, чтобы использовать, и измените под себя.")
  ],
  nl: [
    L("ShoutOut-aanbevelingen", "Kies een stijl en een soort evenement en tik op 'Improve My ShoutOut' voor ideeën die passen bij je sjabloon en schermformaat. Tik op een idee om het in je bericht te zetten en pas het aan als je wilt. 'Use Past ShoutOut' haalt een van je eerdere berichten terug.",
      "AI-aanbevelingen", "Ideeën die voor jou zijn geschreven op basis van de locatie, het soort evenement, je concept en je profiel. Elk idee past al binnen de regels en tekens van het gekozen scherm. Tik op een idee om het te gebruiken."),
    L("Populaire ShoutOuts", "Populaire ShoutOuts die door FLOQR zijn goedgekeurd, eerst de ideeën die bij de muziek van deze locatie passen. Tik op een ShoutOut om hem te gebruiken.",
      "Algemene ShoutOuts", "Kant-en-klare ideeën voor veelvoorkomende momenten zoals verjaardagen en feestjes. Tik op een idee om het te gebruiken en maak het daarna persoonlijk.")
  ],
  el: [
    L("Προτάσεις ShoutOut", "Επιλέξτε στυλ και τύπο εκδήλωσης και πατήστε «Improve My ShoutOut» για ιδέες που ταιριάζουν στο πρότυπο και στο μέγεθος της οθόνης σας. Πατήστε μια ιδέα για να μπει στο μήνυμά σας και επεξεργαστείτε την αν θέλετε. Το «Use Past ShoutOut» φέρνει πίσω ένα από τα παλαιότερα μηνύματά σας.",
      "Προτάσεις AI", "Ιδέες γραμμένες για εσάς με βάση τον χώρο, τον τύπο εκδήλωσης, το πρόχειρό σας και το προφίλ σας. Κάθε ιδέα χωράει ήδη στις γραμμές και τους χαρακτήρες της οθόνης που επιλέξατε. Πατήστε μία για να τη χρησιμοποιήσετε."),
    L("Δημοφιλή ShoutOuts", "Δημοφιλή ShoutOuts εγκεκριμένα από το FLOQR, πρώτα όσα ταιριάζουν με τη μουσική του χώρου. Πατήστε ένα για να το χρησιμοποιήσετε.",
      "Γενικά ShoutOuts", "Έτοιμες ιδέες για συνηθισμένες στιγμές, όπως γενέθλια και γιορτές. Πατήστε μία για να τη χρησιμοποιήσετε και μετά κάντε τη δική σας.")
  ],
  pl: [
    L("Rekomendacje ShoutOut", "Wybierz styl i rodzaj wydarzenia, a potem dotknij „Improve My ShoutOut”, aby dostać pomysły dopasowane do szablonu i rozmiaru ekranu. Dotknij pomysłu, aby wstawić go do wiadomości, i w razie potrzeby go zmień. „Use Past ShoutOut” przywraca jedną z Twoich wcześniejszych wiadomości.",
      "Rekomendacje AI", "Pomysły napisane dla Ciebie na podstawie lokalu, rodzaju wydarzenia, Twojego szkicu i profilu. Każdy pomysł mieści się już w liczbie wierszy i znaków wybranego ekranu. Dotknij jednego, aby go użyć."),
    L("Popularne ShoutOuts", "Popularne ShoutOuts zatwierdzone przez FLOQR, najpierw te pasujące do muzyki w tym lokalu. Dotknij jednego, aby go użyć.",
      "Ogólne ShoutOuts", "Gotowe pomysły na typowe okazje, takie jak urodziny i uroczystości. Dotknij jednego, aby go użyć, a potem dopasuj go do siebie.")
  ],
  ar: [
    L("توصيات ShoutOut", "اختر أسلوبًا ونوع المناسبة، ثم اضغط «Improve My ShoutOut» للحصول على أفكار تناسب القالب وحجم الشاشة. اضغط على أي فكرة لوضعها في رسالتك، ثم عدّلها إن شئت. يعيد «Use Past ShoutOut» إحدى رسائلك السابقة.",
      "توصيات الذكاء الاصطناعي", "أفكار مكتوبة لك بناءً على المكان ونوع المناسبة ومسودتك وملفك الشخصي. كل فكرة تناسب مسبقًا عدد الأسطر والأحرف في الشاشة التي اخترتها. اضغط على واحدة لاستخدامها."),
    L("ShoutOuts الرائجة", "ShoutOuts شائعة وافقت عليها FLOQR، مع تقديم ما يناسب موسيقى هذا المكان أولًا. اضغط على واحدة لاستخدامها.",
      "ShoutOuts عامة", "أفكار جاهزة للمناسبات الشائعة مثل أعياد الميلاد والاحتفالات. اضغط على واحدة لاستخدامها، ثم اجعلها خاصة بك.")
  ]
};

function edit(file, fn) {
  const full = at(file);
  const src = fs.readFileSync(full, "utf8");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const out = fn(src.replace(/\r\n/g, "\n"));
  fs.writeFileSync(full, eol === "\r\n" ? out.replace(/\n/g, "\r\n") : out);
}

const canonical = JSON.parse(fs.readFileSync(at("scripts/_help-en.json"), "utf8"));
for (const id of IDS) {
  if (canonical[id]) throw new Error(`_help-en.json already has ${id}`);
  canonical[id] = {title: EN[id].title, body: EN[id].body};
}
fs.writeFileSync(at("scripts/_help-en.json"), `${JSON.stringify(canonical, null, 2)}\n`);

edit("floqr-i18n-help.js", src => {
  let out = src;
  for (const [code, [first, second]] of Object.entries(PACKS)) {
    const marker = `\n    ${code}: {\n`;
    if (out.split(marker).length !== 2) throw new Error(`floqr-i18n-help.js: pack ${code} marker`);
    const rows = [...first, ...second];
    const block = IDS.map((id, i) => `      ${JSON.stringify(id)}: {\n        title: ${JSON.stringify(rows[i * 2])},\n        body: ${JSON.stringify(rows[i * 2 + 1])}\n      },\n`).join("");
    out = out.replace(marker, `${marker}${block}`);
  }
  return out;
});

edit("floqai-help-repository.js", src => {
  const anchor = `    {\n      id: "help-location-search",\n`;
  if (src.split(anchor).length !== 2) throw new Error("floqai-help-repository.js anchor");
  const block = IDS.map(id => [
    "    {",
    `      id: ${JSON.stringify(id)},`,
    `      title: ${JSON.stringify(EN[id].title)},`,
    `      body: ${JSON.stringify(EN[id].body)},`,
    `      searchPhrases: ${JSON.stringify(EN[id].searchPhrases)},`,
    `      links: [{label: "Search", href: vUrl("./", {start: "search", from: "floqai"})}],`,
    `      audiences: ["patron"],`,
    `      source: "help-repository-seed",`,
    `      page: "index.html#shoutoutRecommendations"`,
    "    },\n"
  ].join("\n")).join("");
  return src.replace(anchor, `${block}${anchor}`);
});

console.log(`added ${IDS.length} help ids to repository, _help-en.json and ${Object.keys(PACKS).length} packs`);
