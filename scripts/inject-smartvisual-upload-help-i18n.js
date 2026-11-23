#!/usr/bin/env node
"use strict";
/* HISTORICAL one-shot. Do not re-run: Rights / source was removed from Create/Edit. */
throw new Error("Do not re-run. Rights / source was removed from SMARTvisual Studio Create/Edit.");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const NEW_KEYS = [
  "sv.studioNameLabel",
  "sv.studioDescLabel",
  "sv.studioTypeLabel",
  "sv.studioTagsLabel",
  "sv.studioRightsLabel",
  "sv.studioUploadLabel"
];

const NEW = {
  en: ["Name *", "Description", "Type", "Tags", "Rights / source *", "Art upload"],
  fr: ["Nom *", "Description", "Type", "Tags", "Droits / source *", "Téléverser l’art"],
  de: ["Name *", "Beschreibung", "Typ", "Tags", "Rechte / Quelle *", "Kunst hochladen"],
  es: ["Nombre *", "Descripción", "Tipo", "Etiquetas", "Derechos / fuente *", "Subir arte"],
  nl: ["Naam *", "Beschrijving", "Type", "Tags", "Rechten / bron *", "Art uploaden"],
  ru: ["Название *", "Описание", "Тип", "Теги", "Права / источник *", "Загрузить арт"],
  it: ["Nome *", "Descrizione", "Tipo", "Tag", "Diritti / fonte *", "Carica arte"],
  pt: ["Nome *", "Descrição", "Tipo", "Tags", "Direitos / origem *", "Carregar arte"],
  el: ["Όνομα *", "Περιγραφή", "Τύπος", "Ετικέτες", "Δικαιώματα / πηγή *", "Μεταφόρτωση τέχνης"],
  pl: ["Nazwa *", "Opis", "Typ", "Tagi", "Prawa / źródło *", "Wgraj sztukę"],
  ar: ["الاسم *", "الوصف", "النوع", "الوسوم", "الحقوق / المصدر *", "رفع العمل الفني"]
};

const UPDATE = {
  en: {
    "sv.studioNeedMeta": "Name and rights / source are required.",
    "sv.studioSvgDenied": "File rejected: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG, or WebP. SMARTstencils: SVG only. SVG is sanitized (no scripts, foreignObject, handlers, or external hrefs). Raster files are checked by type. Preview uses img, never inline untrusted SVG."
  },
  fr: {
    "sv.studioNeedMeta": "Le nom et Droits / source sont requis.",
    "sv.studioSvgDenied": "Fichier refusé : {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds : SVG, JPEG, PNG ou WebP. SMARTstencils : SVG uniquement. Le SVG est nettoyé (pas de scripts, foreignObject, gestionnaires ni href externes). Les fichiers raster sont vérifiés par type. L’aperçu utilise img, jamais un SVG non fiable en ligne."
  },
  de: {
    "sv.studioNeedMeta": "Name und Rechte / Quelle sind Pflicht.",
    "sv.studioSvgDenied": "Datei abgelehnt: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG oder WebP. SMARTstencils: nur SVG. SVG wird geprüft (keine Scripts, foreignObject, Handler oder externe hrefs). Rasterdateien werden per Typ geprüft. Vorschau per img, nie unsicheres Inline-SVG."
  },
  es: {
    "sv.studioNeedMeta": "El nombre y Derechos / fuente son obligatorios.",
    "sv.studioSvgDenied": "Archivo rechazado: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG o WebP. SMARTstencils: solo SVG. El SVG se limpia (sin scripts, foreignObject, controladores ni href externos). Los raster se comprueban por tipo. La vista previa usa img, nunca SVG no confiable en línea."
  },
  nl: {
    "sv.studioNeedMeta": "Naam en Rechten / bron zijn verplicht.",
    "sv.studioSvgDenied": "Bestand geweigerd: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG of WebP. SMARTstencils: alleen SVG. SVG wordt schoongemaakt (geen scripts, foreignObject, handlers of externe hrefs). Rasterbestanden worden op type gecontroleerd. Voorbeeld via img, nooit onveilige inline SVG."
  },
  ru: {
    "sv.studioNeedMeta": "Нужны название и Права / источник.",
    "sv.studioSvgDenied": "Файл отклонён: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG или WebP. SMARTstencils: только SVG. SVG очищается (без script, foreignObject, обработчиков и внешних href). Растр проверяется по типу. Превью через img, без ненадёжного inline SVG."
  },
  it: {
    "sv.studioNeedMeta": "Nome e Diritti / fonte sono obbligatori.",
    "sv.studioSvgDenied": "File rifiutato: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG o WebP. SMARTstencils: solo SVG. L’SVG è sanificato (niente script, foreignObject, handler o href esterni). I raster sono verificati per tipo. L’anteprima usa img, mai SVG non attendibile in linea."
  },
  pt: {
    "sv.studioNeedMeta": "Nome e Direitos / origem são obrigatórios.",
    "sv.studioSvgDenied": "Ficheiro recusado: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG ou WebP. SMARTstencils: só SVG. O SVG é limpo (sem scripts, foreignObject, handlers nem href externos). Raster é verificado pelo tipo. A pré-visualização usa img, nunca SVG não confiável em linha."
  },
  el: {
    "sv.studioNeedMeta": "Το όνομα και Δικαιώματα / πηγή είναι υποχρεωτικά.",
    "sv.studioSvgDenied": "Το αρχείο απορρίφθηκε: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG ή WebP. SMARTstencils: μόνο SVG. Το SVG καθαρίζεται (χωρίς scripts, foreignObject, handlers ή εξωτερικά href). Τα raster ελέγχονται κατά τύπο. Η προεπισκόπηση χρησιμοποιεί img, ποτέ μη αξιόπιστο inline SVG."
  },
  pl: {
    "sv.studioNeedMeta": "Nazwa oraz Prawa / źródło są wymagane.",
    "sv.studioSvgDenied": "Odrzucono plik: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG, JPEG, PNG lub WebP. SMARTstencils: tylko SVG. SVG jest czyszczone (bez skryptów, foreignObject, handlerów i zewnętrznych href). Raster sprawdzany po typie. Podgląd przez img, nigdy niezaufane inline SVG."
  },
  ar: {
    "sv.studioNeedMeta": "الاسم والحقوق / المصدر مطلوبان.",
    "sv.studioSvgDenied": "رُفض الملف: {reason}",
    "sv.studioSvgHint": "SMARTbackgrounds: SVG أو JPEG أو PNG أو WebP. SMARTstencils: SVG فقط. يُنظَّف SVG (بلا سكربتات أو foreignObject أو معالجات أو روابط خارجية). تُفحص ملفات الراستر حسب النوع. المعاينة عبر img وليس SVG غير موثوق مضمّن."
  }
};

const HELP = {
  "help-smartvisuals-create": {
    en: {
      title: "Create / Edit SMARTvisuals",
      body: "Create or edit a SMARTstencil or SMARTbackground draft. Name and Rights / source are required before Submit for review. SMARTstencils must be SVG. SMARTbackgrounds accept SVG, JPEG, PNG, or WebP. Files are sanitized on the server. Drafts stay off patrons until an audited publish. Scenic art is FLOQR illustration, not photography and not an official destination or Fashion Week mark."
    },
    fr: {
      title: "Créer / modifier SMARTvisuals",
      body: "Créez ou modifiez un brouillon SMARTstencil ou SMARTbackground. Le nom et Droits / source sont requis avant Envoyer en revue. Les SMARTstencils doivent être en SVG. Les SMARTbackgrounds acceptent SVG, JPEG, PNG ou WebP. Les fichiers sont nettoyés côté serveur. Les brouillons n’atteignent pas les patrons avant une publication auditée. L’art est une illustration FLOQR, pas une photo ni une marque officielle de destination ou de Fashion Week."
    },
    de: {
      title: "SMARTvisuals erstellen / bearbeiten",
      body: "Erstellen oder bearbeiten Sie einen SMARTstencil- oder SMARTbackground-Entwurf. Name und Rechte / Quelle sind vor Zur Prüfung senden Pflicht. SMARTstencils müssen SVG sein. SMARTbackgrounds akzeptieren SVG, JPEG, PNG oder WebP. Dateien werden serverseitig geprüft. Entwürfe erreichen Gäste erst nach geprüfter Veröffentlichung. Die Szene ist FLOQR-Illustration, kein Foto und kein offizielles Destinations- oder Fashion-Week-Zeichen."
    },
    es: {
      title: "Crear / editar SMARTvisuals",
      body: "Cree o edite un borrador de SMARTstencil o SMARTbackground. Nombre y Derechos / fuente son obligatorios antes de Enviar a revisión. Los SMARTstencils deben ser SVG. Los SMARTbackgrounds aceptan SVG, JPEG, PNG o WebP. Los archivos se sanitizan en el servidor. Los borradores no llegan a patrons hasta una publicación auditada. El arte es ilustración FLOQR, no fotografía ni una marca oficial de destino o Fashion Week."
    },
    nl: {
      title: "SMARTvisuals maken / bewerken",
      body: "Maak of bewerk een SMARTstencil- of SMARTbackground-concept. Naam en Rechten / bron zijn verplicht vóór Ter review sturen. SMARTstencils moeten SVG zijn. SMARTbackgrounds accepteren SVG, JPEG, PNG of WebP. Bestanden worden op de server schoongemaakt. Concepten bereiken gasten pas na een gecontroleerde publicatie. De scene is FLOQR-illustratie, geen foto en geen officieel bestemming- of Fashion Week-merkteken."
    },
    ru: {
      title: "Создать / изменить SMARTvisuals",
      body: "Создайте или измените черновик SMARTstencil или SMARTbackground. Название и Права / источник обязательны до «Отправить на проверку». SMARTstencils только SVG. SMARTbackgrounds: SVG, JPEG, PNG или WebP. Файлы очищаются на сервере. Черновики не видны гостям до проверенной публикации. Это иллюстрация FLOQR, не фото и не официальный знак места или Fashion Week."
    },
    it: {
      title: "Crea / modifica SMARTvisuals",
      body: "Crea o modifica una bozza SMARTstencil o SMARTbackground. Nome e Diritti / fonte sono obbligatori prima di Invia in revisione. Gli SMARTstencils devono essere SVG. Gli SMARTbackgrounds accettano SVG, JPEG, PNG o WebP. I file sono sanificati sul server. Le bozze non arrivano ai patron prima di una pubblicazione con audit. L’arte è illustrazione FLOQR, non foto né un marchio ufficiale di destinazione o Fashion Week."
    },
    pt: {
      title: "Criar / editar SMARTvisuals",
      body: "Crie ou edite um rascunho SMARTstencil ou SMARTbackground. Nome e Direitos / origem são obrigatórios antes de Enviar para revisão. SMARTstencils têm de ser SVG. SMARTbackgrounds aceitam SVG, JPEG, PNG ou WebP. Os ficheiros são limpos no servidor. Rascunhos não chegam a patrons até uma publicação auditada. A arte é ilustração FLOQR, não fotografia nem marca oficial de destino ou Fashion Week."
    },
    el: {
      title: "Δημιουργία / επεξεργασία SMARTvisuals",
      body: "Δημιουργήστε ή επεξεργαστείτε προσχέδιο SMARTstencil ή SMARTbackground. Το όνομα και Δικαιώματα / πηγή είναι υποχρεωτικά πριν την Υποβολή για έλεγχο. Τα SMARTstencils πρέπει να είναι SVG. Τα SMARTbackgrounds δέχονται SVG, JPEG, PNG ή WebP. Τα αρχεία καθαρίζονται στον διακομιστή. Τα προσχέδια δεν φτάνουν στους patrons πριν από ελεγμένη δημοσίευση. Η τέχνη είναι εικονογράφηση FLOQR, όχι φωτογραφία ούτε επίσημο σήμα προορισμού ή Fashion Week."
    },
    pl: {
      title: "Utwórz / edytuj SMARTvisuals",
      body: "Utwórz lub edytuj szkic SMARTstencil albo SMARTbackground. Nazwa oraz Prawa / źródło są wymagane przed Wyślij do recenzji. SMARTstencils muszą być SVG. SMARTbackgrounds przyjmują SVG, JPEG, PNG lub WebP. Pliki są czyszczone na serwerze. Szkice nie trafiają do gości przed audytowaną publikacją. To ilustracja FLOQR, nie zdjęcie i nie oficjalny znak destynacji ani Fashion Week."
    },
    ar: {
      title: "إنشاء / تعديل SMARTvisuals",
      body: "أنشئ أو عدّل مسودة SMARTstencil أو SMARTbackground. الاسم والحقوق / المصدر مطلوبان قبل الإرسال للمراجعة. يجب أن تكون SMARTstencils بصيغة SVG. تقبل SMARTbackgrounds SVG أو JPEG أو PNG أو WebP. تُنظَّف الملفات على الخادم. لا تصل المسودات إلى الرواد قبل نشر مُدقَّق. الفن رسم FLOQR وليس صورة ولا علامة رسمية لوجهة أو لأسبوع الموضة."
    }
  },
  "help-smartvisuals-rights": {
    en: {
      title: "Rights / source",
      body: "Rights / source records who owns this art. Write Original FLOQR illustration when FLOQR created it, or the licensed source (creator, license, and URL) when it is not original. Required to submit. Scenic SMARTvisuals are illustration, not photography and not an official destination or Fashion Week mark."
    },
    fr: {
      title: "Droits / source",
      body: "Droits / source indique qui possède cet art. Indiquez Original FLOQR illustration si FLOQR l’a créé, ou la source sous licence (créateur, licence et URL) sinon. Obligatoire pour envoyer. Les SMARTvisuals de scène sont une illustration, pas une photo ni une marque officielle de destination ou de Fashion Week."
    },
    de: {
      title: "Rechte / Quelle",
      body: "Rechte / Quelle hält fest, wem diese Kunst gehört. Schreiben Sie Original FLOQR illustration, wenn FLOQR sie erstellt hat, sonst die lizenzierte Quelle (Urheber, Lizenz und URL). Pflicht zum Absenden. Scenic SMARTvisuals sind Illustration, kein Foto und kein offizielles Destinations- oder Fashion-Week-Zeichen."
    },
    es: {
      title: "Derechos / fuente",
      body: "Derechos / fuente registra quién posee este arte. Escriba Original FLOQR illustration si FLOQR lo creó, o la fuente con licencia (autor, licencia y URL) si no es original. Obligatorio para enviar. Los SMARTvisuals escénicos son ilustración, no fotografía ni una marca oficial de destino o Fashion Week."
    },
    nl: {
      title: "Rechten / bron",
      body: "Rechten / bron legt vast wie deze art bezit. Schrijf Original FLOQR illustration als FLOQR het maakte, anders de gelicentieerde bron (maker, licentie en URL). Verplicht om in te dienen. Scenic SMARTvisuals zijn illustratie, geen foto en geen officieel bestemming- of Fashion Week-merkteken."
    },
    ru: {
      title: "Права / источник",
      body: "Права / источник фиксирует, кому принадлежит этот арт. Укажите Original FLOQR illustration, если его создал FLOQR, иначе лицензированный источник (автор, лицензия и URL). Обязательно для отправки. Сценические SMARTvisuals — иллюстрация, не фото и не официальный знак места или Fashion Week."
    },
    it: {
      title: "Diritti / fonte",
      body: "Diritti / fonte registra chi possiede quest’arte. Scrivi Original FLOQR illustration se l’ha creata FLOQR, altrimenti la fonte con licenza (autore, licenza e URL). Obbligatorio per inviare. Gli SMARTvisuals scenici sono illustrazione, non foto né un marchio ufficiale di destinazione o Fashion Week."
    },
    pt: {
      title: "Direitos / origem",
      body: "Direitos / origem regista quem é dono desta arte. Escreva Original FLOQR illustration se a FLOQR a criou, ou a origem licenciada (autor, licença e URL) se não for original. Obrigatório para enviar. SMARTvisuals de cena são ilustração, não fotografia nem marca oficial de destino ou Fashion Week."
    },
    el: {
      title: "Δικαιώματα / πηγή",
      body: "Τα Δικαιώματα / πηγή καταγράφουν ποιος κατέχει αυτή την τέχνη. Γράψτε Original FLOQR illustration αν την δημιούργησε η FLOQR, αλλιώς την αδειοδοτημένη πηγή (δημιουργός, άδεια και URL). Υποχρεωτικό για υποβολή. Τα σκηνικά SMARTvisuals είναι εικονογράφηση, όχι φωτογραφία ούτε επίσημο σήμα προορισμού ή Fashion Week."
    },
    pl: {
      title: "Prawa / źródło",
      body: "Prawa / źródło zapisuje, kto jest właścicielem tej sztuki. Wpisz Original FLOQR illustration, gdy stworzył ją FLOQR, albo licencjonowane źródło (twórca, licencja i URL), gdy nie jest oryginalna. Wymagane do wysłania. Scenic SMARTvisuals to ilustracja, nie zdjęcie i nie oficjalny znak destynacji ani Fashion Week."
    },
    ar: {
      title: "الحقوق / المصدر",
      body: "يسجّل الحقوق / المصدر من يملك هذا العمل. اكتب Original FLOQR illustration إذا أنشأته FLOQR، أو المصدر المرخّص (المنشئ والترخيص والرابط) إن لم يكن أصليًا. مطلوب للإرسال. فن SMARTvisuals المشهدي رسم توضيحي وليس صورة ولا علامة رسمية لوجهة أو لأسبوع الموضة."
    }
  }
};

function packSlice(src, lang) {
  const chromeStart = src.indexOf("const CHROME = ");
  const idx = src.indexOf(`\n    ${lang}: {`, chromeStart);
  if (idx < 0) throw new Error(`Missing pack ${lang}`);
  const nextPack = CHROME_ORDER[CHROME_ORDER.indexOf(lang) + 1];
  const end = nextPack ? src.indexOf(`\n    ${nextPack}: {`, idx + 1) : src.indexOf("\n  };", idx);
  return {idx, end, slice: src.slice(idx, end)};
}

function updateChrome(src) {
  let out = src;
  CHROME_ORDER.forEach(lang => {
    const {idx, end, slice} = packSlice(out, lang);
    let next = slice;
    Object.entries(UPDATE[lang]).forEach(([key, value]) => {
      const re = new RegExp(`${key.replace(".", "\\.")}":\\s*${".+?"}`, "s".includes("no") ? "" : "");
      const lineRe = new RegExp(`("${key.replace(".", "\\.")}":\\s*)"[^"]*"`);
      if (!lineRe.test(next)) throw new Error(`Missing ${key} in ${lang}`);
      next = next.replace(lineRe, `$1${q(value)}`);
    });
    if (!NEW_KEYS.every(k => next.includes(q(k)))) {
      const block = NEW_KEYS.map((k, i) => `      ${q(k)}: ${q(NEW[lang][i])},`).join("\n") + "\n";
      if (!next.includes('"sv.studioDetail"')) throw new Error(`Missing sv.studioDetail in ${lang}`);
      next = next.replace(/("sv\.studioDetail":\s*[^,\n]+,\n)/, `$1${block}`);
    }
    out = out.slice(0, idx) + next + out.slice(end);
  });
  return out;
}

function injectHelp(src) {
  let out = src;
  ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"].forEach(lang => {
    const marker = `\n    "${lang}": {`;
    const idx = out.indexOf(marker);
    if (idx < 0) throw new Error("Missing help pack " + lang);
    const insertAt = idx + marker.length;
    if (out.slice(insertAt, insertAt + 1200).includes("help-smartvisuals-create")) return;
    const chunk = Object.entries(HELP).map(([id, row]) => {
      const pack = row[lang];
      return `\n      ${q(id)}: {\n        title: ${q(pack.title)},\n        body: ${q(pack.body)}\n      },`;
    }).join("");
    out = out.slice(0, insertAt) + chunk + out.slice(insertAt);
  });
  return out;
}

const chromePath = path.join(ROOT, "floqr-i18n.js");
fs.writeFileSync(chromePath, updateChrome(fs.readFileSync(chromePath, "utf8")));

const helpPath = path.join(ROOT, "floqr-i18n-help.js");
fs.writeFileSync(helpPath, injectHelp(fs.readFileSync(helpPath, "utf8")));

const helpEnPath = path.join(ROOT, "scripts/_help-en.json");
const helpEn = JSON.parse(fs.readFileSync(helpEnPath, "utf8"));
helpEn["help-smartvisuals-create"] = HELP["help-smartvisuals-create"].en;
helpEn["help-smartvisuals-rights"] = HELP["help-smartvisuals-rights"].en;
fs.writeFileSync(helpEnPath, JSON.stringify(helpEn, null, 2) + "\n");
console.log("Injected SMARTvisual upload chrome + help");
