#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const KEYS = [
  "botdee.greetingCool",
  "botdee.greetingCoolNamed",
  "botdee.greetingPro",
  "botdee.greetingProNamed",
  "botdee.greetingBalanced",
  "botdee.greetingBalancedNamed"
];

const T = {
  en: [
    "Wassup! What's the move?",
    "Wassup, {name}! What's the move?",
    "{lead}. How can I help?",
    "{lead}, {name}. How can I help?",
    "Hey, {leadLower}. What are we working on?",
    "Hey, {leadLower}, {name}. What are we working on?"
  ],
  fr: [
    "Wassup ! C’est quoi le plan ?",
    "Wassup, {name} ! C’est quoi le plan ?",
    "{lead}. Comment puis-je vous aider ?",
    "{lead}, {name}. Comment puis-je vous aider ?",
    "Salut, {leadLower}. Sur quoi travaille-t-on ?",
    "Salut, {leadLower}, {name}. Sur quoi travaille-t-on ?"
  ],
  de: [
    "Wassup! Was steht an?",
    "Wassup, {name}! Was steht an?",
    "{lead}. Wie kann ich dir helfen?",
    "{lead}, {name}. Wie kann ich dir helfen?",
    "Hey, {leadLower}. Woran arbeiten wir?",
    "Hey, {leadLower}, {name}. Woran arbeiten wir?"
  ],
  es: [
    "¡Wassup! ¿Cuál es el plan?",
    "¡Wassup, {name}! ¿Cuál es el plan?",
    "{lead}. ¿En qué puedo ayudarte?",
    "{lead}, {name}. ¿En qué puedo ayudarte?",
    "Hola, {leadLower}. ¿En qué trabajamos?",
    "Hola, {leadLower}, {name}. ¿En qué trabajamos?"
  ],
  nl: [
    "Wassup! Wat is het plan?",
    "Wassup, {name}! Wat is het plan?",
    "{lead}. Hoe kan ik je helpen?",
    "{lead}, {name}. Hoe kan ik je helpen?",
    "Hoi, {leadLower}. Waar werken we aan?",
    "Hoi, {leadLower}, {name}. Waar werken we aan?"
  ],
  ru: [
    "Wassup! Какие планы?",
    "Wassup, {name}! Какие планы?",
    "{lead}. Чем могу помочь?",
    "{lead}, {name}. Чем могу помочь?",
    "Привет, {leadLower}. Над чем работаем?",
    "Привет, {leadLower}, {name}. Над чем работаем?"
  ],
  it: [
    "Wassup! Che si fa?",
    "Wassup, {name}! Che si fa?",
    "{lead}. Come posso aiutarti?",
    "{lead}, {name}. Come posso aiutarti?",
    "Ehi, {leadLower}. Su cosa lavoriamo?",
    "Ehi, {leadLower}, {name}. Su cosa lavoriamo?"
  ],
  pt: [
    "Wassup! Qual é o plano?",
    "Wassup, {name}! Qual é o plano?",
    "{lead}. Como posso ajudar?",
    "{lead}, {name}. Como posso ajudar?",
    "Olá, {leadLower}. Em que estamos a trabalhar?",
    "Olá, {leadLower}, {name}. Em que estamos a trabalhar?"
  ],
  el: [
    "Wassup! Ποιο είναι το σχέδιο;",
    "Wassup, {name}! Ποιο είναι το σχέδιο;",
    "{lead}. Πώς μπορώ να βοηθήσω;",
    "{lead}, {name}. Πώς μπορώ να βοηθήσω;",
    "Γεια, {leadLower}. Με τι ασχολούμαστε;",
    "Γεια, {leadLower}, {name}. Με τι ασχολούμαστε;"
  ],
  pl: [
    "Wassup! Jaki plan?",
    "Wassup, {name}! Jaki plan?",
    "{lead}. W czym mogę pomóc?",
    "{lead}, {name}. W czym mogę pomóc?",
    "Hej, {leadLower}. Nad czym pracujemy?",
    "Hej, {leadLower}, {name}. Nad czym pracujemy?"
  ],
  ar: [
    "Wassup! شو الخطة؟",
    "Wassup, {name}! شو الخطة؟",
    "{lead}. كيف يمكنني مساعدتك؟",
    "{lead}، {name}. كيف يمكنني مساعدتك؟",
    "مرحبًا، {leadLower}. على ماذا نعمل؟",
    "مرحبًا، {leadLower}، {name}. على ماذا نعمل؟"
  ]
};

function insertKeys(src) {
  if (src.includes('"botdee.greetingCool"')) return src;
  let out = src;
  let from = 0;
  CHROME_ORDER.forEach(lang => {
    const values = T[lang];
    if (values.length !== KEYS.length) throw new Error(`${lang} value count`);
    const needle = `"botdee.greetingEvening":`;
    const idx = out.indexOf(needle, from);
    if (idx < 0) throw new Error(`greetingEvening missing for ${lang}`);
    const lineEnd = out.indexOf("\n", idx);
    const extra = KEYS.map((key, i) => `      ${q(key)}: ${q(values[i])}`).join(",\n");
    const injected = `\n${extra},`;
    out = `${out.slice(0, lineEnd)}${injected}${out.slice(lineEnd)}`;
    from = lineEnd + injected.length;
  });
  return out;
}

function run() {
  const file = path.join(ROOT, "floqr-i18n.js");
  let src = fs.readFileSync(file, "utf8");
  src = insertKeys(src);
  fs.writeFileSync(file, src);
  console.log(src.includes('"botdee.greetingCool"') ? "inserted greeting templates" : "failed");
}

run();
