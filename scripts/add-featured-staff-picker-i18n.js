#!/usr/bin/env node
/* Featured service staff picker — Club Admin chrome keys (11 packs) + help-featured-staff (repository, canonical English, 10 help packs). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);

const KEYS = ["title", "intro", "roleLabel", "photoLabel", "photoOption", "upload", "uploading", "uploaded", "uploadFailed", "notImage", "empty", "noPhoto", "selected", "notOnFloqr", "saveHint"];

const CHROME = {
  en: ["Featured service staff",
    "Tick the staff to show on your public club page. For each person, pick one of their FLOQR photos or upload a picture from your computer.",
    "Role on the club page", "Photo", "Use this photo", "Upload from computer", "Uploading photo…",
    "Photo added for {name}. Save Public Profile to publish.",
    "The photo could not be uploaded. Try a JPG or PNG under 10 MB.",
    "Choose an image file (JPG, PNG, WebP or GIF).",
    "No staff yet. Approve or elect people in Employee / Worker Network, then tick who to feature here.",
    "No photos yet. Upload one.", "{count} selected", "Added by hand",
    "Changes go live when you press Save Public Profile."],
  fr: ["Personnel mis en avant",
    "Cochez les membres du personnel à afficher sur la page publique du club. Pour chaque personne, choisissez une de ses photos FLOQR ou importez une image depuis votre ordinateur.",
    "Rôle sur la page du club", "Photo", "Utiliser cette photo", "Importer depuis l’ordinateur", "Importation de la photo…",
    "Photo ajoutée pour {name}. Appuyez sur « Save Public Profile » pour publier.",
    "La photo n’a pas pu être importée. Essayez un JPG ou PNG de moins de 10 Mo.",
    "Choisissez un fichier image (JPG, PNG, WebP ou GIF).",
    "Aucun membre du personnel pour l’instant. Approuvez ou élisez des personnes dans le réseau des employés, puis cochez ici celles à mettre en avant.",
    "Pas encore de photo. Importez-en une.", "{count} sélectionné(s)", "Ajouté manuellement",
    "Les changements sont publiés quand vous appuyez sur « Save Public Profile »."],
  de: ["Hervorgehobenes Servicepersonal",
    "Hake das Personal an, das auf der öffentlichen Clubseite erscheinen soll. Wähle für jede Person eines ihrer FLOQR-Fotos oder lade ein Bild von deinem Computer hoch.",
    "Rolle auf der Clubseite", "Foto", "Dieses Foto verwenden", "Vom Computer hochladen", "Foto wird hochgeladen…",
    "Foto für {name} hinzugefügt. Tippe auf „Save Public Profile“, um es zu veröffentlichen.",
    "Das Foto konnte nicht hochgeladen werden. Versuche ein JPG oder PNG unter 10 MB.",
    "Wähle eine Bilddatei (JPG, PNG, WebP oder GIF).",
    "Noch kein Personal. Genehmige oder wähle Personen im Mitarbeiter- und Personalnetzwerk und hake sie dann hier an.",
    "Noch keine Fotos. Lade eines hoch.", "{count} ausgewählt", "Manuell hinzugefügt",
    "Änderungen werden live, wenn du auf „Save Public Profile“ tippst."],
  es: ["Personal destacado",
    "Marca el personal que quieres mostrar en la página pública del club. Para cada persona, elige una de sus fotos de FLOQR o sube una imagen desde tu ordenador.",
    "Puesto en la página del club", "Foto", "Usar esta foto", "Subir desde el ordenador", "Subiendo foto…",
    "Foto añadida para {name}. Pulsa «Save Public Profile» para publicarla.",
    "No se pudo subir la foto. Prueba con un JPG o PNG de menos de 10 MB.",
    "Elige un archivo de imagen (JPG, PNG, WebP o GIF).",
    "Todavía no hay personal. Aprueba o elige personas en la red de empleados y luego marca aquí a quién destacar.",
    "Aún no hay fotos. Sube una.", "{count} seleccionados", "Añadido a mano",
    "Los cambios se publican al pulsar «Save Public Profile»."],
  nl: ["Uitgelicht servicepersoneel",
    "Vink het personeel aan dat op de openbare clubpagina moet staan. Kies voor elke persoon een van hun FLOQR-foto’s of upload een afbeelding vanaf je computer.",
    "Rol op de clubpagina", "Foto", "Deze foto gebruiken", "Uploaden vanaf computer", "Foto uploaden…",
    "Foto toegevoegd voor {name}. Tik op ‘Save Public Profile’ om te publiceren.",
    "De foto kon niet worden geüpload. Probeer een JPG of PNG kleiner dan 10 MB.",
    "Kies een afbeeldingsbestand (JPG, PNG, WebP of GIF).",
    "Nog geen personeel. Keur mensen goed of kies ze in het netwerk van medewerkers en vink hier aan wie je wilt uitlichten.",
    "Nog geen foto’s. Upload er een.", "{count} geselecteerd", "Handmatig toegevoegd",
    "Wijzigingen gaan live wanneer je op ‘Save Public Profile’ tikt."],
  ru: ["Избранный персонал",
    "Отметьте сотрудников, которых нужно показать на публичной странице клуба. Для каждого выберите одно из его фото в FLOQR или загрузите изображение с компьютера.",
    "Роль на странице клуба", "Фото", "Использовать это фото", "Загрузить с компьютера", "Загрузка фото…",
    "Фото для {name} добавлено. Нажмите «Save Public Profile», чтобы опубликовать.",
    "Не удалось загрузить фото. Попробуйте JPG или PNG размером до 10 МБ.",
    "Выберите файл изображения (JPG, PNG, WebP или GIF).",
    "Сотрудников пока нет. Одобрите или назначьте людей в сети сотрудников, затем отметьте здесь, кого показать.",
    "Фото пока нет. Загрузите одно.", "Выбрано: {count}", "Добавлен вручную",
    "Изменения публикуются после нажатия «Save Public Profile»."],
  it: ["Personale in evidenza",
    "Seleziona il personale da mostrare nella pagina pubblica del club. Per ogni persona scegli una delle sue foto FLOQR o carica un’immagine dal computer.",
    "Ruolo nella pagina del club", "Foto", "Usa questa foto", "Carica dal computer", "Caricamento foto…",
    "Foto aggiunta per {name}. Tocca «Save Public Profile» per pubblicarla.",
    "Impossibile caricare la foto. Prova un JPG o PNG sotto i 10 MB.",
    "Scegli un file immagine (JPG, PNG, WebP o GIF).",
    "Ancora nessun membro del personale. Approva o nomina persone nella rete del personale, poi seleziona qui chi mettere in evidenza.",
    "Ancora nessuna foto. Caricane una.", "{count} selezionati", "Aggiunto a mano",
    "Le modifiche vanno online quando tocchi «Save Public Profile»."],
  pt: ["Equipe em destaque",
    "Marque a equipe que deve aparecer na página pública do clube. Para cada pessoa, escolha uma das fotos dela no FLOQR ou envie uma imagem do seu computador.",
    "Função na página do clube", "Foto", "Usar esta foto", "Enviar do computador", "Enviando foto…",
    "Foto adicionada para {name}. Toque em “Save Public Profile” para publicar.",
    "Não foi possível enviar a foto. Tente um JPG ou PNG com menos de 10 MB.",
    "Escolha um arquivo de imagem (JPG, PNG, WebP ou GIF).",
    "Ainda não há equipe. Aprove ou eleja pessoas na rede de funcionários e depois marque aqui quem destacar.",
    "Ainda não há fotos. Envie uma.", "{count} selecionados", "Adicionado manualmente",
    "As alterações entram no ar quando você toca em “Save Public Profile”."],
  el: ["Προβεβλημένο προσωπικό",
    "Επιλέξτε το προσωπικό που θα εμφανίζεται στη δημόσια σελίδα του κλαμπ. Για κάθε άτομο, διαλέξτε μία από τις φωτογραφίες του στο FLOQR ή ανεβάστε μια εικόνα από τον υπολογιστή σας.",
    "Ρόλος στη σελίδα του κλαμπ", "Φωτογραφία", "Χρήση αυτής της φωτογραφίας", "Μεταφόρτωση από υπολογιστή", "Μεταφόρτωση φωτογραφίας…",
    "Η φωτογραφία για {name} προστέθηκε. Πατήστε «Save Public Profile» για δημοσίευση.",
    "Η φωτογραφία δεν μεταφορτώθηκε. Δοκιμάστε JPG ή PNG κάτω από 10 MB.",
    "Επιλέξτε αρχείο εικόνας (JPG, PNG, WebP ή GIF).",
    "Δεν υπάρχει ακόμη προσωπικό. Εγκρίνετε ή ορίστε άτομα στο δίκτυο υπαλλήλων και μετά επιλέξτε εδώ ποιους θα προβάλετε.",
    "Δεν υπάρχουν ακόμη φωτογραφίες. Ανεβάστε μία.", "{count} επιλεγμένα", "Προστέθηκε χειροκίνητα",
    "Οι αλλαγές δημοσιεύονται όταν πατήσετε «Save Public Profile»."],
  pl: ["Wyróżniony personel",
    "Zaznacz pracowników, którzy mają być widoczni na publicznej stronie klubu. Dla każdej osoby wybierz jedno z jej zdjęć w FLOQR albo prześlij obraz z komputera.",
    "Rola na stronie klubu", "Zdjęcie", "Użyj tego zdjęcia", "Prześlij z komputera", "Przesyłanie zdjęcia…",
    "Dodano zdjęcie dla {name}. Naciśnij „Save Public Profile”, aby opublikować.",
    "Nie udało się przesłać zdjęcia. Spróbuj pliku JPG lub PNG poniżej 10 MB.",
    "Wybierz plik obrazu (JPG, PNG, WebP lub GIF).",
    "Brak personelu. Zatwierdź lub wybierz osoby w sieci pracowników, a potem zaznacz tutaj, kogo wyróżnić.",
    "Brak zdjęć. Prześlij jedno.", "Wybrano: {count}", "Dodano ręcznie",
    "Zmiany są publikowane po naciśnięciu „Save Public Profile”."],
  ar: ["طاقم الخدمة المميز",
    "حدّد أفراد الطاقم الذين تريد عرضهم في صفحة النادي العامة. لكل شخص، اختر إحدى صوره في FLOQR أو ارفع صورة من جهاز الكمبيوتر.",
    "الدور في صفحة النادي", "الصورة", "استخدام هذه الصورة", "رفع من الكمبيوتر", "جارٍ رفع الصورة…",
    "تمت إضافة صورة لـ {name}. اضغط «Save Public Profile» للنشر.",
    "تعذّر رفع الصورة. جرّب ملف JPG أو PNG أصغر من 10 ميغابايت.",
    "اختر ملف صورة (JPG أو PNG أو WebP أو GIF).",
    "لا يوجد طاقم بعد. وافق على الأشخاص أو عيّنهم في شبكة الموظفين، ثم حدّد هنا من تريد إبرازه.",
    "لا توجد صور بعد. ارفع صورة.", "تم تحديد {count}", "أضيف يدويًا",
    "تُنشر التغييرات عند الضغط على «Save Public Profile»."]
};

const PACK_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const PACK_PROBE = {en: "The request", fr: "La demande", de: "Die Anfrage", es: "No se pudo", nl: "Het verzoek", ru: "Не удалось", it: "Impossibile", pt: "Não foi", el: "Το αίτημα", pl: "Nie udało", ar: "تعذّر"};

const HELP_ID = "help-featured-staff";
const HELP_EN = {
  title: "Featured service staff",
  body: "Tick the staff you want on your public club page. For each person, tap one of their FLOQR photos or choose Upload from computer. You can change the role shown under their name. Press Save Public Profile to publish your changes.",
  searchPhrases: ["featured staff", "featured service staff", "staff on club page", "show staff on club page", "staff photo", "waiters on club page", "bottle service on club page"]
};
const HELP = {
  fr: ["Personnel mis en avant", "Cochez les membres du personnel à afficher sur la page publique du club. Pour chaque personne, touchez une de ses photos FLOQR ou choisissez « Importer depuis l’ordinateur ». Vous pouvez modifier le rôle affiché sous son nom. Appuyez sur « Save Public Profile » pour publier."],
  de: ["Hervorgehobenes Servicepersonal", "Hake das Personal an, das auf der öffentlichen Clubseite erscheinen soll. Tippe für jede Person auf eines ihrer FLOQR-Fotos oder wähle „Vom Computer hochladen“. Du kannst die Rolle unter dem Namen ändern. Tippe auf „Save Public Profile“, um zu veröffentlichen."],
  es: ["Personal destacado", "Marca el personal que quieres en la página pública del club. Para cada persona, toca una de sus fotos de FLOQR o elige «Subir desde el ordenador». Puedes cambiar el puesto que aparece bajo su nombre. Pulsa «Save Public Profile» para publicar."],
  it: ["Personale in evidenza", "Seleziona il personale da mostrare nella pagina pubblica del club. Per ogni persona tocca una delle sue foto FLOQR o scegli «Carica dal computer». Puoi cambiare il ruolo mostrato sotto il nome. Tocca «Save Public Profile» per pubblicare."],
  pt: ["Equipe em destaque", "Marque a equipe que deve aparecer na página pública do clube. Para cada pessoa, toque em uma das fotos dela no FLOQR ou escolha “Enviar do computador”. Você pode mudar a função exibida abaixo do nome. Toque em “Save Public Profile” para publicar."],
  ru: ["Избранный персонал", "Отметьте сотрудников для публичной страницы клуба. Для каждого нажмите на одно из его фото в FLOQR или выберите «Загрузить с компьютера». Роль под именем можно изменить. Нажмите «Save Public Profile», чтобы опубликовать."],
  nl: ["Uitgelicht servicepersoneel", "Vink het personeel aan dat op de openbare clubpagina moet staan. Tik voor elke persoon op een van hun FLOQR-foto’s of kies ‘Uploaden vanaf computer’. Je kunt de rol onder hun naam aanpassen. Tik op ‘Save Public Profile’ om te publiceren."],
  el: ["Προβεβλημένο προσωπικό", "Επιλέξτε το προσωπικό για τη δημόσια σελίδα του κλαμπ. Για κάθε άτομο, πατήστε μία από τις φωτογραφίες του στο FLOQR ή επιλέξτε «Μεταφόρτωση από υπολογιστή». Μπορείτε να αλλάξετε τον ρόλο κάτω από το όνομα. Πατήστε «Save Public Profile» για δημοσίευση."],
  pl: ["Wyróżniony personel", "Zaznacz pracowników, którzy mają być na publicznej stronie klubu. Dla każdej osoby dotknij jednego z jej zdjęć w FLOQR lub wybierz „Prześlij z komputera”. Możesz zmienić rolę pod imieniem. Naciśnij „Save Public Profile”, aby opublikować."],
  ar: ["طاقم الخدمة المميز", "حدّد أفراد الطاقم الذين تريدهم في صفحة النادي العامة. لكل شخص، اضغط على إحدى صوره في FLOQR أو اختر «رفع من الكمبيوتر». يمكنك تغيير الدور الظاهر تحت اسمه. اضغط «Save Public Profile» للنشر."]
};

function edit(file, fn) {
  const full = at(file);
  const src = fs.readFileSync(full, "utf8");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const out = fn(src.replace(/\r\n/g, "\n"));
  fs.writeFileSync(full, eol === "\r\n" ? out.replace(/\n/g, "\r\n") : out);
}

for (const [code, values] of Object.entries(CHROME)) {
  if (values.length !== KEYS.length) throw new Error(`chrome ${code}: ${values.length} values`);
}

edit("floqr-i18n.js", src => {
  if (src.includes(`"featuredStaff.title"`)) throw new Error("featuredStaff keys already present");
  const lines = src.split("\n");
  const hits = lines.map((line, i) => line.startsWith(`      "employees.requestFailed": `) ? i : -1).filter(i => i >= 0);
  if (hits.length !== PACK_ORDER.length) throw new Error(`expected ${PACK_ORDER.length} employees.requestFailed lines, found ${hits.length}`);
  for (let n = hits.length - 1; n >= 0; n -= 1) {
    const code = PACK_ORDER[n];
    if (!lines[hits[n]].includes(PACK_PROBE[code])) throw new Error(`pack order mismatch at ${code}`);
    const block = KEYS.map((key, i) => `      ${JSON.stringify(`featuredStaff.${key}`)}: ${JSON.stringify(CHROME[code][i])},`);
    lines.splice(hits[n] + 1, 0, ...block);
  }
  return lines.join("\n");
});

const canonical = JSON.parse(fs.readFileSync(at("scripts/_help-en.json"), "utf8"));
if (canonical[HELP_ID]) throw new Error(`_help-en.json already has ${HELP_ID}`);
canonical[HELP_ID] = {title: HELP_EN.title, body: HELP_EN.body};
fs.writeFileSync(at("scripts/_help-en.json"), `${JSON.stringify(canonical, null, 2)}\n`);

edit("floqr-i18n-help.js", src => {
  let out = src;
  for (const [code, [title, body]] of Object.entries(HELP)) {
    const marker = `\n    ${code}: {\n`;
    if (out.split(marker).length !== 2) throw new Error(`floqr-i18n-help.js: pack ${code} marker`);
    out = out.replace(marker, `${marker}      ${JSON.stringify(HELP_ID)}: {\n        title: ${JSON.stringify(title)},\n        body: ${JSON.stringify(body)}\n      },\n`);
  }
  return out;
});

edit("floqai-help-repository.js", src => {
  const anchor = `    {\n      id: "help-template-tags",\n`;
  if (src.split(anchor).length !== 2) throw new Error("floqai-help-repository.js anchor");
  const block = [
    "    {",
    `      id: ${JSON.stringify(HELP_ID)},`,
    `      title: ${JSON.stringify(HELP_EN.title)},`,
    `      body: ${JSON.stringify(HELP_EN.body)},`,
    `      searchPhrases: ${JSON.stringify(HELP_EN.searchPhrases)},`,
    `      links: [{label: "Club Admin", href: vUrl("./admin.html", {from: "floqai"})}],`,
    `      audiences: ["venueAdmin"],`,
    `      source: "help-repository-seed",`,
    `      page: "admin.html"`,
    "    },\n"
  ].join("\n");
  return src.replace(anchor, `${block}${anchor}`);
});

console.log(`added ${KEYS.length} chrome keys x ${PACK_ORDER.length} packs and ${HELP_ID} in ${Object.keys(HELP).length} help packs`);
