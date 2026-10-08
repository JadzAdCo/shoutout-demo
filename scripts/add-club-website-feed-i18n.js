#!/usr/bin/env node
/* Club website feed — 16 Club Admin keys + 13 club-embed keys (11 chrome packs) + help-club-website-feed (all help sources). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const at = file => path.join(root, file);
const read = file => fs.readFileSync(at(file), "utf8");
const write = (file, src) => fs.writeFileSync(at(file), src);

const FEED_KEYS = ["title", "intro", "rotateWarning", "generate", "oneTime", "iframeLabel", "jsonLabel", "rssLabel", "copy", "active", "none", "statusFailed", "generating", "ready", "failed", "copied"];
const EMBED_KEYS = ["title", "loading", "events", "djs", "staff", "gallery", "noEvents", "tickets", "openOnFloqr", "needsSecret", "unpublished", "loadFailed", "poweredBy"];
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const HELP_ORDER = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];

const FEED = {
  en: ["Club website feed",
    "Show your events, DJs, team, and gallery on your own website. Paste the iframe code into your site, or give your web admin the JSON or RSS link.",
    "Generating a new key turns off the old links, including the staff schedule links. Update your website afterwards.",
    "Generate feed key and links", "Copy these now. The key is only shown once.",
    "Iframe code for your website", "Club data (JSON API)", "Events RSS feed", "Copy iframe code",
    "Feed key active ({prefix}). Generate a new one to see the links again.", "No feed key yet.",
    "Could not check the feed key. You may not have permission for this venue.",
    "Generating…", "New feed key ready. Copy the links below.", "Could not generate the feed: {message}", "Iframe code copied."],
  fr: ["Flux pour le site du club",
    "Affichez vos événements, DJ, équipe et galerie sur votre propre site. Collez le code iframe dans votre site ou donnez le lien JSON ou RSS à votre webmaster.",
    "Générer une nouvelle clé désactive les anciens liens, y compris ceux du planning du personnel. Mettez ensuite votre site à jour.",
    "Générer la clé et les liens", "Copiez-les maintenant. La clé n’est affichée qu’une seule fois.",
    "Code iframe pour votre site", "Données du club (API JSON)", "Flux RSS des événements", "Copier le code iframe",
    "Clé active ({prefix}). Générez-en une nouvelle pour revoir les liens.", "Pas encore de clé.",
    "Impossible de vérifier la clé. Vous n’avez peut-être pas l’autorisation pour ce lieu.",
    "Génération…", "Nouvelle clé prête. Copiez les liens ci-dessous.", "Impossible de générer le flux : {message}", "Code iframe copié."],
  de: ["Feed für die Club-Website",
    "Zeige deine Events, DJs, dein Team und deine Galerie auf deiner eigenen Website. Füge den iframe-Code in deine Seite ein oder gib deinem Webadmin den JSON- oder RSS-Link.",
    "Ein neuer Schlüssel deaktiviert die alten Links, auch die Links zum Mitarbeiterplan. Aktualisiere danach deine Website.",
    "Schlüssel und Links erzeugen", "Kopiere sie jetzt. Der Schlüssel wird nur einmal angezeigt.",
    "iframe-Code für deine Website", "Clubdaten (JSON-API)", "RSS-Feed der Events", "iframe-Code kopieren",
    "Schlüssel aktiv ({prefix}). Erzeuge einen neuen, um die Links wieder zu sehen.", "Noch kein Schlüssel.",
    "Schlüssel konnte nicht geprüft werden. Möglicherweise fehlt dir die Berechtigung für diesen Ort.",
    "Wird erzeugt…", "Neuer Schlüssel bereit. Kopiere die Links unten.", "Feed konnte nicht erzeugt werden: {message}", "iframe-Code kopiert."],
  es: ["Feed para la web del club",
    "Muestra tus eventos, DJ, equipo y galería en tu propia web. Pega el código iframe en tu sitio o da el enlace JSON o RSS a tu administrador web.",
    "Generar una clave nueva desactiva los enlaces anteriores, incluidos los del horario del personal. Actualiza tu web después.",
    "Generar clave y enlaces", "Cópialos ahora. La clave solo se muestra una vez.",
    "Código iframe para tu web", "Datos del club (API JSON)", "Feed RSS de eventos", "Copiar código iframe",
    "Clave activa ({prefix}). Genera una nueva para volver a ver los enlaces.", "Aún no hay clave.",
    "No se pudo comprobar la clave. Puede que no tengas permiso para este local.",
    "Generando…", "Nueva clave lista. Copia los enlaces de abajo.", "No se pudo generar el feed: {message}", "Código iframe copiado."],
  nl: ["Feed voor de clubwebsite",
    "Toon je evenementen, dj’s, team en galerij op je eigen website. Plak de iframe-code in je site of geef je webbeheerder de JSON- of RSS-link.",
    "Een nieuwe sleutel schakelt de oude links uit, ook de links van het personeelsrooster. Werk daarna je website bij.",
    "Sleutel en links aanmaken", "Kopieer ze nu. De sleutel wordt maar één keer getoond.",
    "Iframe-code voor je website", "Clubgegevens (JSON-API)", "RSS-feed met evenementen", "Iframe-code kopiëren",
    "Sleutel actief ({prefix}). Maak een nieuwe aan om de links weer te zien.", "Nog geen sleutel.",
    "Kon de sleutel niet controleren. Mogelijk heb je geen toegang tot deze locatie.",
    "Bezig met aanmaken…", "Nieuwe sleutel klaar. Kopieer de links hieronder.", "Kon de feed niet aanmaken: {message}", "Iframe-code gekopieerd."],
  ru: ["Фид для сайта клуба",
    "Показывайте события, диджеев, команду и галерею на своём сайте. Вставьте код iframe на сайт или передайте веб-администратору ссылку JSON или RSS.",
    "Новый ключ отключает старые ссылки, включая ссылки на расписание персонала. После этого обновите сайт.",
    "Создать ключ и ссылки", "Скопируйте их сейчас. Ключ показывается только один раз.",
    "Код iframe для вашего сайта", "Данные клуба (JSON API)", "RSS-лента событий", "Скопировать код iframe",
    "Ключ активен ({prefix}). Создайте новый, чтобы снова увидеть ссылки.", "Ключа пока нет.",
    "Не удалось проверить ключ. Возможно, у вас нет прав на это заведение.",
    "Создание…", "Новый ключ готов. Скопируйте ссылки ниже.", "Не удалось создать фид: {message}", "Код iframe скопирован."],
  it: ["Feed per il sito del club",
    "Mostra eventi, DJ, team e galleria sul tuo sito. Incolla il codice iframe nel sito o dai il link JSON o RSS al tuo webmaster.",
    "Generare una nuova chiave disattiva i vecchi link, compresi quelli dell’orario del personale. Aggiorna poi il tuo sito.",
    "Genera chiave e link", "Copiali ora. La chiave viene mostrata una sola volta.",
    "Codice iframe per il tuo sito", "Dati del club (API JSON)", "Feed RSS degli eventi", "Copia codice iframe",
    "Chiave attiva ({prefix}). Generane una nuova per rivedere i link.", "Nessuna chiave per ora.",
    "Impossibile verificare la chiave. Forse non hai i permessi per questo locale.",
    "Generazione…", "Nuova chiave pronta. Copia i link qui sotto.", "Impossibile generare il feed: {message}", "Codice iframe copiato."],
  pt: ["Feed para o site do clube",
    "Mostre seus eventos, DJs, equipe e galeria no seu próprio site. Cole o código iframe no site ou passe o link JSON ou RSS para o administrador do site.",
    "Gerar uma nova chave desativa os links antigos, inclusive os da escala da equipe. Depois, atualize seu site.",
    "Gerar chave e links", "Copie agora. A chave é mostrada só uma vez.",
    "Código iframe para o seu site", "Dados do clube (API JSON)", "Feed RSS de eventos", "Copiar código iframe",
    "Chave ativa ({prefix}). Gere uma nova para ver os links de novo.", "Ainda não há chave.",
    "Não foi possível verificar a chave. Talvez você não tenha permissão para este local.",
    "Gerando…", "Nova chave pronta. Copie os links abaixo.", "Não foi possível gerar o feed: {message}", "Código iframe copiado."],
  el: ["Ροή για τον ιστότοπο του κλαμπ",
    "Δείξτε εκδηλώσεις, DJ, ομάδα και συλλογή φωτογραφιών στον δικό σας ιστότοπο. Επικολλήστε τον κώδικα iframe στον ιστότοπο ή δώστε τον σύνδεσμο JSON ή RSS στον διαχειριστή του.",
    "Ένα νέο κλειδί απενεργοποιεί τους παλιούς συνδέσμους, και αυτούς του προγράμματος προσωπικού. Ενημερώστε μετά τον ιστότοπό σας.",
    "Δημιουργία κλειδιού και συνδέσμων", "Αντιγράψτε τους τώρα. Το κλειδί εμφανίζεται μόνο μία φορά.",
    "Κώδικας iframe για τον ιστότοπό σας", "Δεδομένα κλαμπ (JSON API)", "Ροή RSS εκδηλώσεων", "Αντιγραφή κώδικα iframe",
    "Ενεργό κλειδί ({prefix}). Δημιουργήστε νέο για να δείτε ξανά τους συνδέσμους.", "Δεν υπάρχει ακόμη κλειδί.",
    "Δεν ήταν δυνατός ο έλεγχος του κλειδιού. Ίσως δεν έχετε δικαίωμα για αυτόν τον χώρο.",
    "Δημιουργία…", "Το νέο κλειδί είναι έτοιμο. Αντιγράψτε τους συνδέσμους παρακάτω.", "Δεν ήταν δυνατή η δημιουργία της ροής: {message}", "Ο κώδικας iframe αντιγράφηκε."],
  pl: ["Kanał dla strony klubu",
    "Pokaż wydarzenia, DJ-ów, zespół i galerię na własnej stronie. Wklej kod iframe na stronę lub przekaż webmasterowi link JSON albo RSS.",
    "Nowy klucz wyłącza stare linki, także linki do grafiku personelu. Potem zaktualizuj swoją stronę.",
    "Utwórz klucz i linki", "Skopiuj je teraz. Klucz jest pokazywany tylko raz.",
    "Kod iframe dla Twojej strony", "Dane klubu (API JSON)", "Kanał RSS wydarzeń", "Kopiuj kod iframe",
    "Klucz aktywny ({prefix}). Utwórz nowy, aby znów zobaczyć linki.", "Brak klucza.",
    "Nie udało się sprawdzić klucza. Możliwe, że nie masz uprawnień do tego lokalu.",
    "Tworzenie…", "Nowy klucz gotowy. Skopiuj linki poniżej.", "Nie udało się utworzyć kanału: {message}", "Skopiowano kod iframe."],
  ar: ["موجز موقع النادي",
    "اعرض فعالياتك ومنسقي الموسيقى وفريقك ومعرض الصور على موقعك الخاص. الصق رمز iframe في موقعك، أو أعطِ مسؤول الموقع رابط JSON أو RSS.",
    "إنشاء مفتاح جديد يعطّل الروابط القديمة، بما فيها روابط جدول الطاقم. حدّث موقعك بعد ذلك.",
    "إنشاء المفتاح والروابط", "انسخها الآن. يظهر المفتاح مرة واحدة فقط.",
    "رمز iframe لموقعك", "بيانات النادي (JSON API)", "موجز RSS للفعاليات", "نسخ رمز iframe",
    "المفتاح نشط ({prefix}). أنشئ مفتاحًا جديدًا لرؤية الروابط مرة أخرى.", "لا يوجد مفتاح بعد.",
    "تعذّر التحقق من المفتاح. ربما لا تملك صلاحية لهذا المكان.",
    "جارٍ الإنشاء…", "المفتاح الجديد جاهز. انسخ الروابط أدناه.", "تعذّر إنشاء الموجز: {message}", "تم نسخ رمز iframe."]
};

const EMBED = {
  en: ["Club events and team", "Loading…", "Upcoming events", "DJs", "Our team", "Gallery", "No upcoming events yet.", "Tickets", "Open on FLOQR", "This embed needs a venue location and feed key.", "This club page is not published yet.", "Could not load club info ({status}).", "Powered by FLOQR"],
  fr: ["Événements et équipe du club", "Chargement…", "Événements à venir", "DJ", "Notre équipe", "Galerie", "Aucun événement à venir pour l’instant.", "Billets", "Ouvrir sur FLOQR", "Cette intégration a besoin d’un lieu et d’une clé de flux.", "Cette page de club n’est pas encore publiée.", "Impossible de charger les infos du club ({status}).", "Propulsé par FLOQR"],
  de: ["Events und Team des Clubs", "Wird geladen…", "Kommende Events", "DJs", "Unser Team", "Galerie", "Noch keine kommenden Events.", "Tickets", "Auf FLOQR öffnen", "Diese Einbettung braucht einen Ort und einen Feed-Schlüssel.", "Diese Clubseite ist noch nicht veröffentlicht.", "Clubinfos konnten nicht geladen werden ({status}).", "Bereitgestellt von FLOQR"],
  es: ["Eventos y equipo del club", "Cargando…", "Próximos eventos", "DJ", "Nuestro equipo", "Galería", "Aún no hay próximos eventos.", "Entradas", "Abrir en FLOQR", "Esta inserción necesita un local y una clave de feed.", "Esta página del club aún no está publicada.", "No se pudo cargar la información del club ({status}).", "Con la tecnología de FLOQR"],
  nl: ["Evenementen en team van de club", "Laden…", "Komende evenementen", "Dj’s", "Ons team", "Galerij", "Nog geen komende evenementen.", "Tickets", "Openen op FLOQR", "Deze insluiting heeft een locatie en een feedsleutel nodig.", "Deze clubpagina is nog niet gepubliceerd.", "Kon clubinfo niet laden ({status}).", "Mogelijk gemaakt door FLOQR"],
  ru: ["События и команда клуба", "Загрузка…", "Ближайшие события", "Диджеи", "Наша команда", "Галерея", "Ближайших событий пока нет.", "Билеты", "Открыть в FLOQR", "Для этого виджета нужны заведение и ключ фида.", "Страница клуба ещё не опубликована.", "Не удалось загрузить данные клуба ({status}).", "Работает на FLOQR"],
  it: ["Eventi e team del club", "Caricamento…", "Prossimi eventi", "DJ", "Il nostro team", "Galleria", "Nessun evento in programma per ora.", "Biglietti", "Apri su FLOQR", "Questo widget richiede un locale e una chiave del feed.", "Questa pagina del club non è ancora pubblicata.", "Impossibile caricare le info del club ({status}).", "Realizzato con FLOQR"],
  pt: ["Eventos e equipe do clube", "Carregando…", "Próximos eventos", "DJs", "Nossa equipe", "Galeria", "Ainda não há próximos eventos.", "Ingressos", "Abrir no FLOQR", "Esta incorporação precisa de um local e de uma chave do feed.", "Esta página do clube ainda não foi publicada.", "Não foi possível carregar as informações do clube ({status}).", "Desenvolvido com FLOQR"],
  el: ["Εκδηλώσεις και ομάδα του κλαμπ", "Φόρτωση…", "Επερχόμενες εκδηλώσεις", "DJ", "Η ομάδα μας", "Συλλογή", "Δεν υπάρχουν ακόμη επερχόμενες εκδηλώσεις.", "Εισιτήρια", "Άνοιγμα στο FLOQR", "Αυτή η ενσωμάτωση χρειάζεται χώρο και κλειδί ροής.", "Η σελίδα του κλαμπ δεν έχει δημοσιευτεί ακόμη.", "Δεν ήταν δυνατή η φόρτωση των στοιχείων του κλαμπ ({status}).", "Με την υποστήριξη του FLOQR"],
  pl: ["Wydarzenia i zespół klubu", "Ładowanie…", "Nadchodzące wydarzenia", "DJ-e", "Nasz zespół", "Galeria", "Brak nadchodzących wydarzeń.", "Bilety", "Otwórz w FLOQR", "Ten widżet wymaga lokalu i klucza kanału.", "Ta strona klubu nie jest jeszcze opublikowana.", "Nie udało się wczytać informacji o klubie ({status}).", "Działa dzięki FLOQR"],
  ar: ["فعاليات النادي وفريقه", "جارٍ التحميل…", "الفعاليات القادمة", "منسقو الموسيقى", "فريقنا", "معرض الصور", "لا توجد فعاليات قادمة بعد.", "التذاكر", "فتح على FLOQR", "يحتاج هذا التضمين إلى مكان ومفتاح موجز.", "صفحة هذا النادي غير منشورة بعد.", "تعذّر تحميل معلومات النادي ({status}).", "مدعوم من FLOQR"]
};

const HELP = {
  en: ["Club website feed", "Show your published FLOQR club page on your own website. Press Generate feed key and links, then paste the iframe code into your website, or give your web admin the JSON or RSS link. The feed shows upcoming events, featured DJs, featured staff, gallery, and contact details, following your Public page controls. Staff photos appear only when photo consent is confirmed. Generating a new key turns off the old links, including the staff schedule links."],
  ru: ["Фид для сайта клуба", "Показывайте опубликованную страницу клуба FLOQR на своём сайте. Нажмите «Создать ключ и ссылки», затем вставьте код iframe на сайт или передайте веб-администратору ссылку JSON или RSS. Фид показывает ближайшие события, избранных диджеев, избранный персонал, галерею и контакты с учётом настроек публичной страницы. Фото персонала появляются, только если согласие на фото подтверждено. Новый ключ отключает старые ссылки, включая ссылки на расписание персонала."],
  nl: ["Feed voor de clubwebsite", "Toon je gepubliceerde FLOQR-clubpagina op je eigen website. Tik op ‘Sleutel en links aanmaken’ en plak de iframe-code in je website, of geef je webbeheerder de JSON- of RSS-link. De feed toont komende evenementen, uitgelichte dj’s, uitgelicht personeel, de galerij en contactgegevens, volgens je instellingen voor de openbare pagina. Foto’s van personeel verschijnen alleen als de fototoestemming is bevestigd. Een nieuwe sleutel schakelt de oude links uit, ook de links van het personeelsrooster."],
  fr: ["Flux pour le site du club", "Affichez votre page de club FLOQR publiée sur votre propre site. Appuyez sur « Générer la clé et les liens », puis collez le code iframe dans votre site ou donnez le lien JSON ou RSS à votre webmaster. Le flux montre les événements à venir, les DJ et le personnel mis en avant, la galerie et les coordonnées, selon vos réglages de page publique. Les photos du personnel n’apparaissent que si le consentement photo est confirmé. Générer une nouvelle clé désactive les anciens liens, y compris ceux du planning du personnel."],
  de: ["Feed für die Club-Website", "Zeige deine veröffentlichte FLOQR-Clubseite auf deiner eigenen Website. Tippe auf „Schlüssel und Links erzeugen“ und füge den iframe-Code in deine Website ein oder gib deinem Webadmin den JSON- oder RSS-Link. Der Feed zeigt kommende Events, hervorgehobene DJs und hervorgehobenes Personal, die Galerie und Kontaktdaten gemäß deinen Einstellungen für die öffentliche Seite. Fotos des Personals erscheinen nur, wenn die Foto-Einwilligung bestätigt ist. Ein neuer Schlüssel deaktiviert die alten Links, auch die Links zum Mitarbeiterplan."],
  es: ["Feed para la web del club", "Muestra tu página de club de FLOQR publicada en tu propia web. Pulsa «Generar clave y enlaces» y pega el código iframe en tu web, o da el enlace JSON o RSS a tu administrador web. El feed muestra próximos eventos, DJ y personal destacados, la galería y los datos de contacto, según los controles de tu página pública. Las fotos del personal solo aparecen si el consentimiento de fotos está confirmado. Generar una clave nueva desactiva los enlaces anteriores, incluidos los del horario del personal."],
  it: ["Feed per il sito del club", "Mostra la pagina del club FLOQR pubblicata sul tuo sito. Tocca «Genera chiave e link», poi incolla il codice iframe nel sito o dai il link JSON o RSS al tuo webmaster. Il feed mostra prossimi eventi, DJ e personale in evidenza, galleria e contatti, secondo le impostazioni della pagina pubblica. Le foto del personale compaiono solo se il consenso per le foto è confermato. Generare una nuova chiave disattiva i vecchi link, compresi quelli dell’orario del personale."],
  pt: ["Feed para o site do clube", "Mostre a página do clube publicada no FLOQR no seu próprio site. Toque em “Gerar chave e links” e cole o código iframe no site, ou passe o link JSON ou RSS para o administrador do site. O feed mostra próximos eventos, DJs e equipe em destaque, galeria e contatos, conforme os controles da página pública. As fotos da equipe só aparecem quando o consentimento de fotos está confirmado. Gerar uma nova chave desativa os links antigos, inclusive os da escala da equipe."],
  el: ["Ροή για τον ιστότοπο του κλαμπ", "Δείξτε τη δημοσιευμένη σελίδα του κλαμπ στο FLOQR στον δικό σας ιστότοπο. Πατήστε «Δημιουργία κλειδιού και συνδέσμων» και επικολλήστε τον κώδικα iframe στον ιστότοπο ή δώστε τον σύνδεσμο JSON ή RSS στον διαχειριστή του. Η ροή δείχνει επερχόμενες εκδηλώσεις, προβεβλημένους DJ και προσωπικό, τη συλλογή και τα στοιχεία επικοινωνίας, σύμφωνα με τις ρυθμίσεις της δημόσιας σελίδας. Οι φωτογραφίες του προσωπικού εμφανίζονται μόνο όταν η συγκατάθεση έχει επιβεβαιωθεί. Ένα νέο κλειδί απενεργοποιεί τους παλιούς συνδέσμους, και αυτούς του προγράμματος προσωπικού."],
  pl: ["Kanał dla strony klubu", "Pokaż opublikowaną stronę klubu FLOQR na własnej stronie. Naciśnij „Utwórz klucz i linki”, a potem wklej kod iframe na stronę albo przekaż webmasterowi link JSON lub RSS. Kanał pokazuje nadchodzące wydarzenia, wyróżnionych DJ-ów i personel, galerię oraz dane kontaktowe zgodnie z ustawieniami strony publicznej. Zdjęcia personelu pojawiają się tylko po potwierdzeniu zgody na zdjęcia. Nowy klucz wyłącza stare linki, także linki do grafiku personelu."],
  ar: ["موجز موقع النادي", "اعرض صفحة ناديك المنشورة على FLOQR في موقعك الخاص. اضغط «إنشاء المفتاح والروابط»، ثم الصق رمز iframe في موقعك أو أعطِ مسؤول الموقع رابط JSON أو RSS. يعرض الموجز الفعاليات القادمة ومنسقي الموسيقى والطاقم المميزين ومعرض الصور وبيانات التواصل وفق إعدادات صفحتك العامة. لا تظهر صور الطاقم إلا بعد تأكيد الموافقة على الصور. إنشاء مفتاح جديد يعطّل الروابط القديمة، بما فيها روابط جدول الطاقم."]
};

const q = s => JSON.stringify(s);

let chrome = read("floqr-i18n.js");
if (chrome.includes('"websiteFeed.title"')) throw new Error("website feed keys already present");
const anchor = /^(\s*)"featuredStaff\.consentRecorded": .*,\r?\n/gm;
const hits = [...chrome.matchAll(anchor)];
if (hits.length !== CHROME_ORDER.length) throw new Error(`anchor hits ${hits.length}`);
const eol = chrome.includes("\r\n") ? "\r\n" : "\n";
let offset = 0;
hits.forEach((m, i) => {
  const lang = CHROME_ORDER[i];
  const indent = m[1];
  if (FEED[lang].length !== FEED_KEYS.length || EMBED[lang].length !== EMBED_KEYS.length) throw new Error(`${lang} length`);
  const block = FEED_KEYS.map((key, k) => `${indent}"websiteFeed.${key}": ${q(FEED[lang][k])},${eol}`).join("")
    + EMBED_KEYS.map((key, k) => `${indent}"page.clubEmbed.${key}": ${q(EMBED[lang][k])},${eol}`).join("");
  const pos = m.index + m[0].length + offset;
  chrome = chrome.slice(0, pos) + block + chrome.slice(pos);
  offset += block.length;
});
write("floqr-i18n.js", chrome);

// Help: repository seed, English canonical JSON, 10 locale packs.
let repo = read("floqai-help-repository.js");
if (repo.includes('"help-club-website-feed"')) throw new Error("repository entry exists");
const repoAnchor = '      id: "help-template-tags",';
if (repo.split(repoAnchor).length !== 2) throw new Error("repository anchor");
const repoEntry = `      id: "help-club-website-feed",
      title: ${q(HELP.en[0])},
      body: ${q(HELP.en[1])},
      searchPhrases: ["club website feed","website feed","embed on my website","put events on my website","iframe","rss feed","club api","website widget","staff list on website"],
      links: [{label: "Club Admin", href: vUrl("./admin.html", {from: "floqai"})}],
      audiences: ["venueAdmin"],
      source: "help-repository-seed",
      page: "admin.html"
    },
    {
`;
repo = repo.replace(repoAnchor, repoEntry + repoAnchor);
write("floqai-help-repository.js", repo);

const enJson = JSON.parse(read("scripts/_help-en.json"));
enJson["help-club-website-feed"] = {title: HELP.en[0], body: HELP.en[1]};
write("scripts/_help-en.json", `${JSON.stringify(enJson, null, 2)}\n`);

let help = read("floqr-i18n-help.js");
const helpAnchor = /^(\s*)"help-featured-staff": \{\r?\n/gm;
const helpHits = [...help.matchAll(helpAnchor)];
if (helpHits.length !== HELP_ORDER.length) throw new Error(`help hits ${helpHits.length}`);
let helpOffset = 0;
helpHits.forEach((m, i) => {
  const lang = HELP_ORDER[i];
  const indent = m[1];
  const block = `${indent}"help-club-website-feed": {${eol}${indent}  title: ${q(HELP[lang][0])},${eol}${indent}  body: ${q(HELP[lang][1])}${eol}${indent}},${eol}`;
  const pos = m.index + helpOffset;
  help = help.slice(0, pos) + block + help.slice(pos);
  helpOffset += block.length;
});
write("floqr-i18n-help.js", help);
console.log("website feed: 29 chrome keys x11 + help-club-website-feed x11");
