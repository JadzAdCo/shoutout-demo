"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const EN = {
  title: "Shiloh",
  body: "$30 Aurelia exclusive. Shiloh the cat sits on the left of the board and your ShoutOut glows in white on the dark side beside her. Emoji are welcome. Type “Shiloh” in Search, write up to three short lines, and add your @handle if you like. Plays on the board sizes Aurelia has."
};
const T = {
  ru: "Эксклюзив Aurelia за $30. Кошка Shiloh сидит в левой части экрана, а ваш ShoutOut светится белым на тёмной стороне рядом с ней. Эмодзи приветствуются. Введите в поиске «Shiloh», напишите до трёх коротких строк и при желании добавьте свой @ник. Показывается на экранах тех размеров, которые есть в Aurelia.",
  nl: "Exclusief bij Aurelia voor $30. De kat Shiloh zit links op het scherm en je ShoutOut gloeit wit aan de donkere kant naast haar. Emoji zijn welkom. Typ ‘Shiloh’ in Zoeken, schrijf maximaal drie korte regels en voeg desgewenst je @handle toe. Speelt op de schermformaten die Aurelia heeft.",
  fr: "Exclusivité Aurelia à 30 $. Le chat Shiloh est assis à gauche de l’écran et votre ShoutOut brille en blanc sur le côté sombre, juste à côté. Les emoji sont les bienvenus. Tapez « Shiloh » dans Recherche, écrivez jusqu’à trois lignes courtes et ajoutez votre @pseudo si vous le souhaitez. S’affiche sur les tailles d’écran dont dispose Aurelia.",
  de: "Exklusiv bei Aurelia für 30 $. Die Katze Shiloh sitzt links auf der Anzeige, und dein ShoutOut leuchtet weiß auf der dunklen Seite neben ihr. Emojis sind willkommen. Gib „Shiloh“ in der Suche ein, schreib bis zu drei kurze Zeilen und füge auf Wunsch dein @Handle hinzu. Läuft auf den Displaygrößen, die Aurelia hat.",
  es: "Exclusivo de Aurelia por $30. La gata Shiloh aparece a la izquierda de la pantalla y tu ShoutOut brilla en blanco en el lado oscuro, a su lado. Los emojis son bienvenidos. Escribe «Shiloh» en Buscar, escribe hasta tres líneas cortas y añade tu @usuario si quieres. Se muestra en los tamaños de pantalla que tiene Aurelia.",
  it: "Esclusiva Aurelia a 30 $. La gatta Shiloh è seduta a sinistra dello schermo e il tuo ShoutOut brilla in bianco sul lato scuro accanto a lei. Le emoji sono benvenute. Scrivi «Shiloh» in Cerca, scrivi fino a tre righe brevi e aggiungi il tuo @handle se vuoi. Va in onda sulle dimensioni di schermo che ha Aurelia.",
  pt: "Exclusivo do Aurelia por US$ 30. A gata Shiloh fica à esquerda da tela e o seu ShoutOut brilha em branco no lado escuro, ao lado dela. Emojis são bem-vindos. Digite «Shiloh» na Busca, escreva até três linhas curtas e adicione seu @usuário se quiser. Aparece nos tamanhos de tela que o Aurelia tem.",
  el: "Αποκλειστικό του Aurelia στα 30 $. Η γάτα Shiloh κάθεται στα αριστερά της οθόνης και το ShoutOut σας λάμπει λευκό στη σκοτεινή πλευρά δίπλα της. Τα emoji είναι ευπρόσδεκτα. Πληκτρολογήστε «Shiloh» στην Αναζήτηση, γράψτε έως τρεις σύντομες γραμμές και προσθέστε το @handle σας αν θέλετε. Παίζει στα μεγέθη οθόνης που έχει το Aurelia.",
  pl: "Wyłącznie w Aurelia za 30 $. Kotka Shiloh siedzi po lewej stronie ekranu, a Twój ShoutOut świeci na biało po ciemnej stronie obok niej. Emoji są mile widziane. Wpisz „Shiloh” w wyszukiwarce, napisz do trzech krótkich linijek i dodaj swój @nick, jeśli chcesz. Wyświetla się na ekranach w rozmiarach, które ma Aurelia.",
  ar: "حصري في Aurelia مقابل 30 $. تجلس القطة Shiloh على يسار الشاشة ويتوهّج ShoutOut الخاص بك باللون الأبيض على الجانب الداكن بجانبها. الرموز التعبيرية مرحّب بها. اكتب «Shiloh» في البحث، واكتب حتى ثلاثة أسطر قصيرة، وأضف @اسمك إن أردت. يُعرض على أحجام الشاشات المتوفرة في Aurelia."
};

function patchHelpPacks(file) {
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('"help-shiloh"')) return console.log("already patched", file);
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const anchor = /( {6}"help-tengo-muchos-dolares": \{\r?\n {8}title: [^\n]*\r?\n {8}body: [^\n]*\r?\n {6}\},)/g;
  const langs = Object.keys(T);
  let i = 0;
  src = src.replace(anchor, block => {
    const lang = langs[i++];
    return `${block}${eol}      "help-shiloh": {${eol}        title: "Shiloh",${eol}        body: ${JSON.stringify(T[lang])}${eol}      },`;
  });
  if (i !== langs.length) throw new Error(`expected ${langs.length} tengo blocks, found ${i}`);
  fs.writeFileSync(file, src);
  console.log("patched", file);
}

function langOrder(file) {
  const src = fs.readFileSync(file, "utf8");
  return [...src.matchAll(/^ {4}([a-z]{2}): \{/gm)].map(m => m[1]);
}

function patchCanonical(file) {
  const raw = fs.readFileSync(file, "utf8");
  const data = JSON.parse(raw);
  if (data["help-shiloh"]) return console.log("already patched", file);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v;
    if (k === "help-tengo-muchos-dolares") out["help-shiloh"] = EN;
  }
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(file, JSON.stringify(out, null, 2).replace(/\n/g, eol) + (raw.endsWith("\n") ? eol : ""));
  console.log("patched", file);
}

const helpFile = path.join(root, "floqr-i18n-help.js");
const order = langOrder(helpFile);
if (order.join(",") !== Object.keys(T).join(",")) throw new Error(`pack order ${order.join(",")} != ${Object.keys(T).join(",")}`);
patchHelpPacks(helpFile);
patchCanonical(path.join(root, "scripts", "_help-en.json"));
