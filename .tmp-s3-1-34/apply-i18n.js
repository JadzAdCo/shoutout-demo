"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const KEYS = ["signIn", "scheduleFor", "typeDj", "typeClub", "typeCompany", "pickClub", "pickCompany", "search", "searchClubs", "djAuto", "noClubs", "noCompanies", "noMatch", "loadingOwners", "allClubs", "refresh", "clubAdminLink", "chooseOwner", "myAssignments", "firebaseError"];

const CHROME = {
  en: ["Sign in", "Schedule for", "My DJ schedule", "Club", "Promoting company", "Club", "Company", "Search", "Type a name", "Your own DJ calendar. Nothing to choose.", "You don't manage a club yet. A Club Admin can give you schedule access in Club Admin.", "No promoting company is linked to your account yet. A Club Admin sets it when they add you as a promoter.", "No match. Try another name.", "Loading what you can manage…", "Master Admin: every club is listed.", "Refresh access & shifts", "Club Admin Scheduling tab", "Choose a club or company under Schedule for first.", "My assignments", "FLOQR could not start on this page. Refresh the page."],
  de: ["Anmelden", "Planen für", "Mein DJ-Plan", "Club", "Promo-Firma", "Club", "Firma", "Suchen", "Namen eingeben", "Dein eigener DJ-Kalender. Keine Auswahl nötig.", "Du verwaltest noch keinen Club. Ein Club Admin kann dir im Club Admin Zugriff auf Schichtpläne geben.", "Mit deinem Konto ist noch keine Promo-Firma verknüpft. Ein Club Admin legt sie fest, wenn er dich als Promoter hinzufügt.", "Kein Treffer. Versuche einen anderen Namen.", "Lade, was du verwalten kannst…", "Master Admin: Alle Clubs werden angezeigt.", "Zugriff & Schichten aktualisieren", "Club Admin – Tab Planung", "Wähle zuerst unter „Planen für“ einen Club oder eine Firma.", "Meine Einsätze", "FLOQR konnte auf dieser Seite nicht starten. Lade die Seite neu."],
  fr: ["Se connecter", "Planning pour", "Mon planning DJ", "Club", "Société de promotion", "Club", "Société", "Rechercher", "Tapez un nom", "Votre propre calendrier DJ. Rien à choisir.", "Vous ne gérez encore aucun club. Un Club Admin peut vous donner l'accès aux plannings dans Club Admin.", "Aucune société de promotion n'est liée à votre compte. Un Club Admin la définit quand il vous ajoute comme promoteur.", "Aucun résultat. Essayez un autre nom.", "Chargement de ce que vous pouvez gérer…", "Master Admin : tous les clubs sont listés.", "Actualiser l'accès et les shifts", "Onglet Planification de Club Admin", "Choisissez d'abord un club ou une société sous « Planning pour ».", "Mes affectations", "FLOQR n'a pas pu démarrer sur cette page. Actualisez la page."],
  es: ["Iniciar sesión", "Horario de", "Mi horario de DJ", "Club", "Empresa de promoción", "Club", "Empresa", "Buscar", "Escribe un nombre", "Tu propio calendario de DJ. No hay nada que elegir.", "Aún no administras ningún club. Un Club Admin puede darte acceso a los horarios en Club Admin.", "Aún no hay ninguna empresa de promoción vinculada a tu cuenta. Un Club Admin la asigna cuando te añade como promotor.", "Sin resultados. Prueba otro nombre.", "Cargando lo que puedes gestionar…", "Master Admin: se muestran todos los clubs.", "Actualizar acceso y turnos", "Pestaña Planificación de Club Admin", "Primero elige un club o una empresa en «Horario de».", "Mis asignaciones", "FLOQR no pudo iniciarse en esta página. Recarga la página."],
  it: ["Accedi", "Turni per", "Il mio calendario DJ", "Club", "Società di promozione", "Club", "Società", "Cerca", "Scrivi un nome", "Il tuo calendario DJ personale. Niente da scegliere.", "Non gestisci ancora nessun club. Un Club Admin può darti accesso ai turni in Club Admin.", "Nessuna società di promozione è collegata al tuo account. La imposta un Club Admin quando ti aggiunge come promoter.", "Nessun risultato. Prova un altro nome.", "Caricamento di ciò che puoi gestire…", "Master Admin: sono elencati tutti i club.", "Aggiorna accesso e turni", "Scheda Pianificazione di Club Admin", "Scegli prima un club o una società in «Turni per».", "I miei incarichi", "FLOQR non è riuscito ad avviarsi in questa pagina. Ricarica la pagina."],
  pt: ["Entrar", "Escala de", "Minha agenda de DJ", "Clube", "Empresa de promoção", "Clube", "Empresa", "Pesquisar", "Digite um nome", "Sua própria agenda de DJ. Nada para escolher.", "Você ainda não administra nenhum clube. Um Club Admin pode dar acesso às escalas no Club Admin.", "Nenhuma empresa de promoção está ligada à sua conta. Um Club Admin a define quando adiciona você como promoter.", "Nada encontrado. Tente outro nome.", "Carregando o que você pode gerenciar…", "Master Admin: todos os clubes estão listados.", "Atualizar acesso e turnos", "Aba Agendamento do Club Admin", "Primeiro escolha um clube ou uma empresa em «Escala de».", "Minhas atribuições", "O FLOQR não conseguiu iniciar nesta página. Recarregue a página."],
  ru: ["Войти", "Расписание для", "Моё расписание DJ", "Клуб", "Промо-компания", "Клуб", "Компания", "Поиск", "Введите название", "Ваш собственный календарь DJ. Выбирать ничего не нужно.", "Вы пока не управляете ни одним клубом. Club Admin может дать вам доступ к расписанию в Club Admin.", "К вашему аккаунту пока не привязана промо-компания. Её указывает Club Admin, когда добавляет вас как промоутера.", "Ничего не найдено. Попробуйте другое название.", "Загружаем, чем вы можете управлять…", "Master Admin: показаны все клубы.", "Обновить доступ и смены", "Вкладка «Расписание» в Club Admin", "Сначала выберите клуб или компанию в «Расписание для».", "Мои назначения", "FLOQR не удалось запустить на этой странице. Обновите страницу."],
  el: ["Σύνδεση", "Πρόγραμμα για", "Το πρόγραμμά μου ως DJ", "Club", "Εταιρεία προώθησης", "Club", "Εταιρεία", "Αναζήτηση", "Πληκτρολογήστε όνομα", "Το δικό σας ημερολόγιο DJ. Δεν χρειάζεται επιλογή.", "Δεν διαχειρίζεστε ακόμη κάποιο club. Ένας Club Admin μπορεί να σας δώσει πρόσβαση στα προγράμματα από το Club Admin.", "Δεν έχει συνδεθεί ακόμη εταιρεία προώθησης με τον λογαριασμό σας. Την ορίζει ένας Club Admin όταν σας προσθέτει ως promoter.", "Κανένα αποτέλεσμα. Δοκιμάστε άλλο όνομα.", "Φόρτωση όσων μπορείτε να διαχειριστείτε…", "Master Admin: εμφανίζονται όλα τα clubs.", "Ανανέωση πρόσβασης και βαρδιών", "Καρτέλα Προγραμματισμός στο Club Admin", "Επιλέξτε πρώτα club ή εταιρεία στο «Πρόγραμμα για».", "Οι αναθέσεις μου", "Το FLOQR δεν μπόρεσε να ξεκινήσει σε αυτή τη σελίδα. Ανανεώστε τη σελίδα."],
  pl: ["Zaloguj się", "Grafik dla", "Mój grafik DJ", "Klub", "Firma promocyjna", "Klub", "Firma", "Szukaj", "Wpisz nazwę", "Twój własny kalendarz DJ. Nic nie trzeba wybierać.", "Nie zarządzasz jeszcze żadnym klubem. Club Admin może dać ci dostęp do grafików w Club Admin.", "Z twoim kontem nie jest jeszcze powiązana żadna firma promocyjna. Ustawia ją Club Admin, gdy dodaje cię jako promotora.", "Brak wyników. Spróbuj innej nazwy.", "Wczytywanie tego, czym możesz zarządzać…", "Master Admin: wyświetlane są wszystkie kluby.", "Odśwież dostęp i zmiany", "Zakładka Planowanie w Club Admin", "Najpierw wybierz klub lub firmę w „Grafik dla”.", "Moje przydziały", "FLOQR nie mógł się uruchomić na tej stronie. Odśwież stronę."],
  nl: ["Inloggen", "Planning voor", "Mijn DJ-planning", "Club", "Promotiebedrijf", "Club", "Bedrijf", "Zoeken", "Typ een naam", "Je eigen DJ-agenda. Niets te kiezen.", "Je beheert nog geen club. Een Club Admin kan je in Club Admin toegang tot de planning geven.", "Er is nog geen promotiebedrijf aan je account gekoppeld. Een Club Admin stelt dit in wanneer hij je als promoter toevoegt.", "Geen resultaat. Probeer een andere naam.", "Laden wat je kunt beheren…", "Master Admin: alle clubs worden getoond.", "Toegang en diensten vernieuwen", "Tabblad Planning in Club Admin", "Kies eerst een club of bedrijf onder 'Planning voor'.", "Mijn toewijzingen", "FLOQR kon niet starten op deze pagina. Vernieuw de pagina."],
  ar: ["تسجيل الدخول", "الجدول لـ", "جدولي كـ DJ", "نادٍ", "شركة ترويج", "النادي", "الشركة", "بحث", "اكتب اسمًا", "تقويمك الخاص كـ DJ. لا حاجة للاختيار.", "لا تدير أي نادٍ بعد. يمكن لـ Club Admin منحك صلاحية الجداول من Club Admin.", "لا توجد شركة ترويج مرتبطة بحسابك بعد. يحددها Club Admin عندما يضيفك كمروّج.", "لا توجد نتائج. جرّب اسمًا آخر.", "جارٍ تحميل ما يمكنك إدارته…", "Master Admin: تظهر جميع النوادي.", "تحديث الصلاحية والمناوبات", "تبويب الجدولة في Club Admin", "اختر أولًا ناديًا أو شركة من «الجدول لـ».", "مهامي", "تعذّر تشغيل FLOQR في هذه الصفحة. أعد تحميل الصفحة."]
};

const HELP_ID = "help-scheduling-schedule-for";
const HELP = {
  en: ["Staff Scheduling", "Plan shifts and bookings, then notify each person by Inbox, Email, SMS or WhatsApp. Under Schedule for, choose whose calendar you are working on: My DJ schedule is your own calendar, Club lists the clubs you manage, and Promoting company lists the companies you promote for. Each calendar has its own $20/month subscription. Shifts sent to you appear under My assignments, where you confirm or decline them."],
  de: ["Mitarbeiterplanung", "Plane Schichten und Bookings und benachrichtige jede Person per Inbox, Email, SMS oder WhatsApp. Unter „Planen für“ wählst du, wessen Kalender du bearbeitest: „Mein DJ-Plan“ ist dein eigener Kalender, „Club“ zeigt die Clubs, die du verwaltest, und „Promo-Firma“ die Firmen, für die du promotest. Jeder Kalender hat sein eigenes Abo für 20 $/Monat. Schichten für dich erscheinen unter „Meine Einsätze“, wo du sie bestätigst oder ablehnst."],
  fr: ["Planification du personnel", "Planifiez des shifts et des bookings, puis prévenez chaque personne par Inbox, Email, SMS ou WhatsApp. Sous « Planning pour », choisissez le calendrier sur lequel vous travaillez : « Mon planning DJ » est votre propre calendrier, « Club » liste les clubs que vous gérez et « Société de promotion » les sociétés pour lesquelles vous faites la promotion. Chaque calendrier a son propre abonnement à 20 $/mois. Les shifts qui vous sont attribués apparaissent sous « Mes affectations », où vous les confirmez ou les refusez."],
  es: ["Planificación del personal", "Planifica turnos y contrataciones y avisa a cada persona por Inbox, Email, SMS o WhatsApp. En «Horario de», elige el calendario con el que trabajas: «Mi horario de DJ» es tu propio calendario, «Club» muestra los clubs que administras y «Empresa de promoción» las empresas para las que promocionas. Cada calendario tiene su propia suscripción de 20 $/mes. Los turnos que te asignan aparecen en «Mis asignaciones», donde los confirmas o rechazas."],
  it: ["Pianificazione del personale", "Pianifica turni e ingaggi, poi avvisa ogni persona tramite Inbox, Email, SMS o WhatsApp. In «Turni per» scegli il calendario su cui lavori: «Il mio calendario DJ» è il tuo calendario, «Club» elenca i club che gestisci e «Società di promozione» le società per cui fai promozione. Ogni calendario ha il proprio abbonamento da 20 $/mese. I turni assegnati a te compaiono in «I miei incarichi», dove li confermi o li rifiuti."],
  pt: ["Agendamento de pessoal", "Planeje turnos e contratações e avise cada pessoa por Inbox, Email, SMS ou WhatsApp. Em «Escala de», escolha em qual agenda você está trabalhando: «Minha agenda de DJ» é a sua própria agenda, «Clube» lista os clubes que você administra e «Empresa de promoção» as empresas para as quais você promove. Cada agenda tem sua própria assinatura de US$ 20/mês. Os turnos enviados para você aparecem em «Minhas atribuições», onde você os confirma ou recusa."],
  ru: ["Расписание персонала", "Планируйте смены и букинги и уведомляйте каждого через Inbox, Email, SMS или WhatsApp. В разделе «Расписание для» выберите, с чьим календарём вы работаете: «Моё расписание DJ» — ваш собственный календарь, «Клуб» — клубы, которыми вы управляете, «Промо-компания» — компании, для которых вы промоутер. У каждого календаря своя подписка за 20 $ в месяц. Смены, назначенные вам, появляются в разделе «Мои назначения», где их можно подтвердить или отклонить."],
  el: ["Προγραμματισμός προσωπικού", "Σχεδιάστε βάρδιες και κρατήσεις και ειδοποιήστε κάθε άτομο μέσω Inbox, Email, SMS ή WhatsApp. Στο «Πρόγραμμα για» επιλέξτε σε ποιο ημερολόγιο δουλεύετε: «Το πρόγραμμά μου ως DJ» είναι το δικό σας ημερολόγιο, το «Club» δείχνει τα clubs που διαχειρίζεστε και η «Εταιρεία προώθησης» τις εταιρείες για τις οποίες κάνετε προώθηση. Κάθε ημερολόγιο έχει τη δική του συνδρομή 20 $/μήνα. Οι βάρδιες που σας ανατίθενται εμφανίζονται στις «Οι αναθέσεις μου», όπου τις επιβεβαιώνετε ή τις απορρίπτετε."],
  pl: ["Planowanie personelu", "Planuj zmiany i bookingi, a potem powiadamiaj każdą osobę przez Inbox, Email, SMS lub WhatsApp. W sekcji „Grafik dla” wybierz, czyim kalendarzem się zajmujesz: „Mój grafik DJ” to twój własny kalendarz, „Klub” pokazuje kluby, którymi zarządzasz, a „Firma promocyjna” firmy, dla których promujesz. Każdy kalendarz ma własną subskrypcję za 20 $/miesiąc. Zmiany przypisane tobie pojawiają się w „Moje przydziały”, gdzie je potwierdzasz lub odrzucasz."],
  nl: ["Personeelsplanning", "Plan diensten en boekingen en laat iedereen het weten via Inbox, Email, SMS of WhatsApp. Kies onder 'Planning voor' aan welke agenda je werkt: 'Mijn DJ-planning' is je eigen agenda, 'Club' toont de clubs die je beheert en 'Promotiebedrijf' de bedrijven waarvoor je promoot. Elke agenda heeft een eigen abonnement van $ 20 per maand. Diensten die aan jou zijn toegewezen verschijnen onder 'Mijn toewijzingen', waar je ze bevestigt of weigert."],
  ar: ["جداول الموظفين", "خطّط المناوبات والحجوزات ثم أبلغ كل شخص عبر Inbox أو Email أو SMS أو WhatsApp. من «الجدول لـ» اختر التقويم الذي تعمل عليه: «جدولي كـ DJ» هو تقويمك الخاص، و«نادٍ» يعرض النوادي التي تديرها، و«شركة ترويج» يعرض الشركات التي تروّج لها. لكل تقويم اشتراكه الخاص بـ 20 دولارًا شهريًا. تظهر المناوبات المسندة إليك في «مهامي» حيث تؤكدها أو ترفضها."]
};

function eolOf(src) { return src.includes("\r\n") ? "\r\n" : "\n"; }

function applyChrome() {
  const file = path.join(ROOT, "floqr-i18n.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('"sched.scheduleFor"')) { console.log("chrome already applied"); return; }
  const eol = eolOf(src);
  const chromeAt = src.indexOf("const CHROME = {");
  if (chromeAt < 0) throw new Error("CHROME not found");
  for (const lang of Object.keys(CHROME)) {
    const packRe = new RegExp(`\\n    ${lang}: \\{`, "g");
    packRe.lastIndex = chromeAt;
    const pack = packRe.exec(src);
    if (!pack) throw new Error(`pack ${lang}`);
    const anchor = src.indexOf('"page.scheduling.title"', pack.index);
    const nextPack = src.slice(pack.index + 1).search(/\n    [a-z]{2}: \{/);
    if (anchor < 0 || (nextPack >= 0 && anchor > pack.index + 1 + nextPack)) throw new Error(`anchor outside ${lang}`);
    const lineEnd = src.indexOf("\n", anchor) + 1;
    const values = CHROME[lang];
    if (values.length !== KEYS.length) throw new Error(`count ${lang}`);
    const lines = KEYS.map((key, i) => `      ${JSON.stringify(`sched.${key}`)}: ${JSON.stringify(values[i])},${eol}`).join("");
    src = src.slice(0, lineEnd) + lines + src.slice(lineEnd);
  }
  fs.writeFileSync(file, src);
  console.log("chrome keys added");
}

function applyHelp() {
  const file = path.join(ROOT, "floqr-i18n-help.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes(`"${HELP_ID}"`)) { console.log("help already applied"); return; }
  const eol = eolOf(src);
  const packsAt = src.indexOf("const packs = {");
  for (const lang of Object.keys(HELP).filter(l => l !== "en")) {
    const re = new RegExp(`\\n    ${lang}: \\{(\\r?\\n)`, "g");
    re.lastIndex = packsAt;
    const m = re.exec(src);
    if (!m) throw new Error(`help pack ${lang}`);
    const at = m.index + m[0].length;
    const [title, body] = HELP[lang];
    const block = `      ${JSON.stringify(HELP_ID)}: {${eol}        title: ${JSON.stringify(title)},${eol}        body: ${JSON.stringify(body)}${eol}      },${eol}`;
    src = src.slice(0, at) + block + src.slice(at);
  }
  fs.writeFileSync(file, src);
  const canonPath = path.join(ROOT, "scripts", "_help-en.json");
  const canon = JSON.parse(fs.readFileSync(canonPath, "utf8"));
  canon[HELP_ID] = {title: HELP.en[0], body: HELP.en[1]};
  const raw = fs.readFileSync(canonPath, "utf8");
  fs.writeFileSync(canonPath, JSON.stringify(canon, null, 2).replace(/\n/g, eolOf(raw)) + eolOf(raw));
  console.log("help packs added");
}

applyChrome();
applyHelp();
