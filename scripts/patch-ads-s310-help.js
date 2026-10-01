"use strict";
// s3.1.0: refresh help-ad-campaigns and help-club-in-app-marketing bodies in every help locale + repository.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const LANG_ORDER = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];

const EN = {
  "help-ad-campaigns": "Post a flyer image or a video of 30 seconds or less for your business, club, promotion group or service (DJ, photographer, promoter, FloqQ). Choose Inline ($45 / 7 days — Search loading splash and feature screens) or Mingl Gist ($25 / 7 days — story scroll), the run length and who should see it (age, gender, cities, interests). Pay by card or monthly subscription; approved accounts can use an invoice. FLOQR reviews every paid ad before it runs, and rejected ads are refunded. My ads shows the status, views, clicks and your invoice.",
  "help-club-in-app-marketing": "Post a flyer or a video of 30 seconds or less as your club. Once it is paid and approved by FLOQR it shows on the Search loading splash, Mingl, RydR and other FLOQR screens. Club ad posters lets a team member post ads for the club (Club Ad Poster role). No SMS credits required."
};

const BODIES = {
  ru: {
    "help-ad-campaigns": "Публикуйте изображение флаера или видео до 30 секунд от имени своего бизнеса, клуба, промо-группы или услуги (DJ, фотограф, промоутер, FloqQ). Выберите Inline ($45 / 7 дней — экран загрузки поиска и экраны функций) или Mingl Gist ($25 / 7 дней — лента историй), срок показа и аудиторию (возраст, пол, города, интересы). Оплата картой или ежемесячной подпиской; одобренные аккаунты могут платить по счёту. FLOQR проверяет каждое оплаченное объявление перед показом, за отклонённые деньги возвращаются. В разделе «Мои объявления» видны статус, показы, клики и счёт.",
    "help-club-in-app-marketing": "Публикуйте флаер или видео до 30 секунд от имени клуба. После оплаты и одобрения FLOQR реклама показывается на экране загрузки поиска, в Mingl, RydR и на других экранах FLOQR. В разделе «Публикаторы рекламы клуба» можно разрешить сотруднику публиковать рекламу (роль Club Ad Poster). SMS-кредиты не нужны."
  },
  nl: {
    "help-ad-campaigns": "Plaats een flyerafbeelding of een video van maximaal 30 seconden voor je bedrijf, club, promotiegroep of dienst (DJ, fotograaf, promoter, FloqQ). Kies Inline ($45 / 7 dagen — laadscherm van Zoeken en functieschermen) of Mingl Gist ($25 / 7 dagen — storyfeed), de looptijd en wie het moet zien (leeftijd, geslacht, steden, interesses). Betaal per kaart of met een maandabonnement; goedgekeurde accounts kunnen op factuur betalen. FLOQR controleert elke betaalde advertentie voordat ze draait en afgewezen advertenties worden terugbetaald. Mijn advertenties toont de status, weergaven, klikken en je factuur.",
    "help-club-in-app-marketing": "Plaats een flyer of een video van maximaal 30 seconden namens je club. Zodra hij betaald en door FLOQR goedgekeurd is, verschijnt hij op het laadscherm van Zoeken, in Mingl, RydR en op andere FLOQR-schermen. Met Advertentieplaatsers van de club laat je een teamlid advertenties plaatsen (rol Club Ad Poster). Geen sms-tegoed nodig."
  },
  fr: {
    "help-ad-campaigns": "Publiez une image de flyer ou une vidéo de 30 secondes maximum pour votre entreprise, votre club, votre groupe de promotion ou votre service (DJ, photographe, promoteur, FloqQ). Choisissez Inline (45 $ / 7 jours — écran de chargement de la recherche et pages des fonctions) ou Mingl Gist (25 $ / 7 jours — fil de stories), la durée et qui doit la voir (âge, genre, villes, centres d'intérêt). Payez par carte ou par abonnement mensuel ; les comptes approuvés peuvent payer sur facture. FLOQR vérifie chaque publicité payée avant diffusion et les publicités refusées sont remboursées. Mes publicités affiche le statut, les vues, les clics et votre facture.",
    "help-club-in-app-marketing": "Publiez un flyer ou une vidéo de 30 secondes maximum au nom de votre club. Une fois payée et approuvée par FLOQR, elle s'affiche sur l'écran de chargement de la recherche, dans Mingl, RydR et sur d'autres écrans FLOQR. Publicateurs d'annonces du club permet à un membre de l'équipe de publier pour le club (rôle Club Ad Poster). Aucun crédit SMS nécessaire."
  },
  de: {
    "help-ad-campaigns": "Veröffentliche ein Flyer-Bild oder ein Video bis 30 Sekunden für dein Unternehmen, deinen Club, deine Promotion-Gruppe oder deinen Service (DJ, Fotograf, Promoter, FloqQ). Wähle Inline (45 $ / 7 Tage — Ladebildschirm der Suche und Funktionsseiten) oder Mingl Gist (25 $ / 7 Tage — Story-Feed), die Laufzeit und wer die Anzeige sehen soll (Alter, Geschlecht, Städte, Interessen). Bezahle per Karte oder Monatsabo; freigegebene Konten können auf Rechnung zahlen. FLOQR prüft jede bezahlte Anzeige vor dem Start, abgelehnte Anzeigen werden erstattet. Unter Meine Anzeigen siehst du Status, Aufrufe, Klicks und deine Rechnung.",
    "help-club-in-app-marketing": "Veröffentliche einen Flyer oder ein Video bis 30 Sekunden im Namen deines Clubs. Sobald die Anzeige bezahlt und von FLOQR freigegeben ist, erscheint sie auf dem Ladebildschirm der Suche, in Mingl, RydR und auf weiteren FLOQR-Seiten. Unter Anzeigen-Poster des Clubs kannst du einem Teammitglied das Veröffentlichen erlauben (Rolle Club Ad Poster). Keine SMS-Guthaben nötig."
  },
  es: {
    "help-ad-campaigns": "Publica una imagen de flyer o un video de hasta 30 segundos para tu negocio, club, grupo de promoción o servicio (DJ, fotógrafo, promotor, FloqQ). Elige Inline ($45 / 7 días — pantalla de carga de la búsqueda y pantallas de funciones) o Mingl Gist ($25 / 7 días — historias), la duración y quién debe verlo (edad, género, ciudades, intereses). Paga con tarjeta o suscripción mensual; las cuentas aprobadas pueden pagar con factura. FLOQR revisa cada anuncio pagado antes de publicarlo y los anuncios rechazados se reembolsan. Mis anuncios muestra el estado, las vistas, los clics y tu factura.",
    "help-club-in-app-marketing": "Publica un flyer o un video de hasta 30 segundos en nombre de tu club. Cuando está pagado y aprobado por FLOQR, aparece en la pantalla de carga de la búsqueda, en Mingl, RydR y en otras pantallas de FLOQR. Publicadores de anuncios del club permite que un miembro del equipo publique anuncios para el club (rol Club Ad Poster). No necesitas créditos SMS."
  },
  it: {
    "help-ad-campaigns": "Pubblica un'immagine del flyer o un video fino a 30 secondi per la tua attività, il tuo club, il tuo gruppo promozionale o il tuo servizio (DJ, fotografo, promoter, FloqQ). Scegli Inline ($45 / 7 giorni — schermata di caricamento della ricerca e schermate delle funzioni) o Mingl Gist ($25 / 7 giorni — storie), la durata e chi deve vederlo (età, genere, città, interessi). Paga con carta o abbonamento mensile; gli account approvati possono pagare con fattura. FLOQR controlla ogni annuncio pagato prima della pubblicazione e gli annunci rifiutati vengono rimborsati. I miei annunci mostra stato, visualizzazioni, clic e fattura.",
    "help-club-in-app-marketing": "Pubblica un flyer o un video fino a 30 secondi a nome del tuo club. Una volta pagato e approvato da FLOQR, appare nella schermata di caricamento della ricerca, in Mingl, RydR e in altre schermate FLOQR. Pubblicatori di annunci del club consente a un membro del team di pubblicare annunci per il club (ruolo Club Ad Poster). Nessun credito SMS necessario."
  },
  pt: {
    "help-ad-campaigns": "Publique uma imagem de flyer ou um vídeo até 30 segundos para o seu negócio, clube, grupo de promoção ou serviço (DJ, fotógrafo, promotor, FloqQ). Escolha Inline ($45 / 7 dias — ecrã de carregamento da pesquisa e ecrãs de funcionalidades) ou Mingl Gist ($25 / 7 dias — histórias), a duração e quem o deve ver (idade, género, cidades, interesses). Pague com cartão ou subscrição mensal; contas aprovadas podem pagar com fatura. A FLOQR revê cada anúncio pago antes de ir para o ar e os anúncios rejeitados são reembolsados. Os meus anúncios mostra o estado, as visualizações, os cliques e a sua fatura.",
    "help-club-in-app-marketing": "Publique um flyer ou um vídeo até 30 segundos em nome do seu clube. Depois de pago e aprovado pela FLOQR, aparece no ecrã de carregamento da pesquisa, no Mingl, no RydR e noutros ecrãs FLOQR. Publicadores de anúncios do clube permite que um membro da equipa publique anúncios para o clube (função Club Ad Poster). Não são necessários créditos SMS."
  },
  el: {
    "help-ad-campaigns": "Δημοσιεύστε εικόνα flyer ή βίντεο έως 30 δευτερόλεπτα για την επιχείρηση, το club, την ομάδα προώθησης ή την υπηρεσία σας (DJ, φωτογράφος, promoter, FloqQ). Επιλέξτε Inline ($45 / 7 ημέρες — οθόνη φόρτωσης αναζήτησης και οθόνες λειτουργιών) ή Mingl Gist ($25 / 7 ημέρες — ιστορίες), τη διάρκεια και ποιος θα τη βλέπει (ηλικία, φύλο, πόλεις, ενδιαφέροντα). Πληρώστε με κάρτα ή μηνιαία συνδρομή· οι εγκεκριμένοι λογαριασμοί μπορούν να πληρώνουν με τιμολόγιο. Το FLOQR ελέγχει κάθε πληρωμένη διαφήμιση πριν προβληθεί και οι απορριφθείσες επιστρέφονται. Στο Οι διαφημίσεις μου βλέπετε κατάσταση, προβολές, κλικ και τιμολόγιο.",
    "help-club-in-app-marketing": "Δημοσιεύστε ένα flyer ή ένα βίντεο έως 30 δευτερόλεπτα εκ μέρους του club σας. Μόλις πληρωθεί και εγκριθεί από το FLOQR, εμφανίζεται στην οθόνη φόρτωσης της αναζήτησης, στο Mingl, στο RydR και σε άλλες οθόνες του FLOQR. Με τους Δημοσιευτές διαφημίσεων του club επιτρέπετε σε μέλος της ομάδας να δημοσιεύει για το club (ρόλος Club Ad Poster). Δεν χρειάζονται μονάδες SMS."
  },
  pl: {
    "help-ad-campaigns": "Opublikuj obraz ulotki lub wideo do 30 sekund dla swojej firmy, klubu, grupy promocyjnej lub usługi (DJ, fotograf, promotor, FloqQ). Wybierz Inline ($45 / 7 dni — ekran ładowania wyszukiwania i ekrany funkcji) lub Mingl Gist ($25 / 7 dni — relacje), czas emisji i odbiorców (wiek, płeć, miasta, zainteresowania). Zapłać kartą lub subskrypcją miesięczną; zatwierdzone konta mogą płacić na fakturę. FLOQR sprawdza każdą opłaconą reklamę przed emisją, a odrzucone są zwracane. Moje reklamy pokazuje status, wyświetlenia, kliknięcia i fakturę.",
    "help-club-in-app-marketing": "Opublikuj ulotkę lub wideo do 30 sekund w imieniu klubu. Po opłaceniu i zatwierdzeniu przez FLOQR reklama pojawia się na ekranie ładowania wyszukiwania, w Mingl, RydR i na innych ekranach FLOQR. Publikujący reklamy klubu pozwala członkowi zespołu publikować reklamy dla klubu (rola Club Ad Poster). Kredyty SMS nie są potrzebne."
  },
  ar: {
    "help-ad-campaigns": "انشر صورة منشور دعائي أو فيديو حتى 30 ثانية لنشاطك التجاري أو ناديك أو مجموعة الترويج أو خدمتك (DJ، مصوّر، مروّج، FloqQ). اختر Inline (45$ / 7 أيام — شاشة تحميل البحث وشاشات الميزات) أو Mingl Gist (25$ / 7 أيام — القصص)، ومدة العرض ومن يجب أن يراه (العمر، الجنس، المدن، الاهتمامات). ادفع بالبطاقة أو باشتراك شهري؛ ويمكن للحسابات المعتمدة الدفع بفاتورة. تراجع FLOQR كل إعلان مدفوع قبل عرضه، وتُسترد قيمة الإعلانات المرفوضة. تعرض إعلاناتي الحالة والمشاهدات والنقرات وفاتورتك.",
    "help-club-in-app-marketing": "انشر منشورًا دعائيًا أو فيديو حتى 30 ثانية باسم ناديك. بعد الدفع وموافقة FLOQR يظهر على شاشة تحميل البحث وفي Mingl وRydR وشاشات FLOQR الأخرى. يتيح ناشرو إعلانات النادي لأحد أعضاء الفريق نشر إعلانات للنادي (دور Club Ad Poster). لا حاجة إلى رصيد SMS."
  }
};

function replaceBodyAfter(src, marker, fromIndex, body) {
  const at = src.indexOf(marker, fromIndex);
  if (at < 0) throw new Error(`missing ${marker} after ${fromIndex}`);
  const bodyAt = src.indexOf("body:", at);
  const lineEnd = src.indexOf("\n", bodyAt);
  const line = src.slice(bodyAt, lineEnd);
  const trailing = /,\s*\r?$/.test(line) ? "," : "";
  const cr = line.endsWith("\r") ? "\r" : "";
  const next = `body: ${JSON.stringify(body)}${trailing}${cr}`;
  return {src: src.slice(0, bodyAt) + next + src.slice(lineEnd), end: bodyAt + next.length};
}

// Help locales: each id appears once per language, in LANG_ORDER.
const helpFile = path.join(root, "floqr-i18n-help.js");
let help = fs.readFileSync(helpFile, "utf8");
for (const id of Object.keys(EN)) {
  let cursor = 0;
  for (const lang of LANG_ORDER) {
    const result = replaceBodyAfter(help, `"${id}": {`, cursor, BODIES[lang][id]);
    help = result.src;
    cursor = result.end;
  }
  if (help.indexOf(`"${id}": {`, cursor) >= 0) throw new Error(`${id} appears more than ${LANG_ORDER.length} times`);
}
fs.writeFileSync(helpFile, help);

const repoFile = path.join(root, "floqai-help-repository.js");
let repo = fs.readFileSync(repoFile, "utf8");
for (const id of Object.keys(EN)) repo = replaceBodyAfter(repo, `id: "${id}",`, 0, EN[id]).src;
fs.writeFileSync(repoFile, repo);
console.log("help bodies updated");
