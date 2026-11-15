#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const KEYS = [
  "botdee.memoryTitle",
  "botdee.memoryTimeoutNote",
  "botdee.memoryArchiveOptIn",
  "botdee.memoryFactsOptIn",
  "botdee.memoryPersonalizeOptIn",
  "botdee.memorySave",
  "botdee.memoryExport",
  "botdee.memoryDelete",
  "botdee.memorySaved",
  "botdee.memoryDeleted",
  "botdee.memoryEmpty",
  "botdee.libraryTitle",
  "botdee.libraryEmpty",
  "botdee.libraryRefresh",
  "botdee.explainTitle",
  "botdee.smartviewVenueOpen",
  "botdee.smartviewResearchDisabled",
  "botdee.smartviewRatingsNote",
  "botdee.smartviewMenuExternal",
  "botdee.smartviewMockBadge",
  "botdee.privacyOpenProfile"
];

const T = {
  en: [
    "Saved chats and memories",
    "The five-minute pause ends the live chat. It does not delete history you opted to save. Guests stay ephemeral. Mingl chats are never copied here.",
    "Save this BOT DEE chat after the pause (opt in)",
    "Let BOT DEE remember facts I approve",
    "Use my saved facts to personalize answers",
    "Save memory settings",
    "Export my BOT DEE data",
    "Delete saved history",
    "Saved. The 5-minute pause still ends the live chat; opted-in history stays.",
    "Saved BOT DEE history deleted.",
    "No saved memories yet.",
    "Research Library and SmartViews",
    "No saved SmartViews yet.",
    "Show mock SmartViews",
    "Explain My Recommendation uses the sources and preferences shown on each card. Ads are labeled. You can ask for non-personalized results.",
    "Open FLOQR Public Page",
    "Public Web Research stays off until legal and identity review. Venue cards open the existing FLOQR Public Page.",
    "Ratings are shown separately by source.",
    "Menu (opens outside FLOQR)",
    "Mock / not live licensed data",
    "Open existing profile visibility"
  ],
  fr: [
    "Discussions et souvenirs enregistrés",
    "La pause de cinq minutes termine le chat en direct. Elle ne supprime pas l’historique que vous avez choisi d’enregistrer. Les invités restent éphémères. Les discussions Mingl ne sont jamais copiées ici.",
    "Enregistrer ce chat BOT DEE après la pause (opt-in)",
    "Autoriser BOT DEE à mémoriser les faits que j’approuve",
    "Utiliser mes faits enregistrés pour personnaliser les réponses",
    "Enregistrer les réglages mémoire",
    "Exporter mes données BOT DEE",
    "Supprimer l’historique enregistré",
    "Enregistré. La pause de 5 minutes termine toujours le chat en direct ; l’historique choisi est conservé.",
    "Historique BOT DEE enregistré supprimé.",
    "Aucun souvenir enregistré.",
    "Bibliothèque de recherche et SmartViews",
    "Aucune SmartView enregistrée.",
    "Afficher les SmartViews fictives",
    "Explain My Recommendation utilise les sources et préférences affichées sur chaque carte. Les pubs sont indiquées. Vous pouvez demander des résultats non personnalisés.",
    "Ouvrir la page publique FLOQR",
    "La recherche web publique reste désactivée jusqu’à l’examen juridique et d’identité. Les cartes de lieu ouvrent la page publique FLOQR existante.",
    "Les notes sont affichées séparément par source.",
    "Menu (s’ouvre hors de FLOQR)",
    "Mock / données non licenciées en direct",
    "Ouvrir la visibilité de profil existante"
  ],
  de: [
    "Gespeicherte Chats und Erinnerungen",
    "Die fünfminütige Pause beendet den Live-Chat. Sie löscht nicht den Verlauf, den Sie speichern wollten. Gäste bleiben flüchtig. Mingl-Chats werden nie hierher kopiert.",
    "Diesen BOT DEE-Chat nach der Pause speichern (Opt-in)",
    "BOT DEE darf von mir bestätigte Fakten merken",
    "Gespeicherte Fakten für personalisierte Antworten nutzen",
    "Speichereinstellungen sichern",
    "Meine BOT DEE-Daten exportieren",
    "Gespeicherten Verlauf löschen",
    "Gespeichert. Die 5-Minuten-Pause beendet weiter den Live-Chat; der gewählte Verlauf bleibt.",
    "Gespeicherter BOT DEE-Verlauf gelöscht.",
    "Noch keine gespeicherten Erinnerungen.",
    "Research Library und SmartViews",
    "Noch keine gespeicherten SmartViews.",
    "Mock-SmartViews zeigen",
    "Explain My Recommendation nutzt die Quellen und Präferenzen auf jeder Karte. Werbung ist gekennzeichnet. Sie können unpersonalisierte Ergebnisse verlangen.",
    "FLOQR-Public-Page öffnen",
    "Public Web Research bleibt aus, bis Recht und Identität geprüft sind. Venue-Karten öffnen die vorhandene FLOQR-Public-Page.",
    "Bewertungen werden je Quelle getrennt gezeigt.",
    "Menü (öffnet außerhalb von FLOQR)",
    "Mock / keine live lizenzierten Daten",
    "Vorhandene Profilsichtbarkeit öffnen"
  ],
  es: [
    "Chats y recuerdos guardados",
    "La pausa de cinco minutos termina el chat en vivo. No borra el historial que eligió guardar. Los invitados siguen siendo efímeros. Los chats de Mingl nunca se copian aquí.",
    "Guardar este chat de BOT DEE después de la pausa (optar)",
    "Permitir que BOT DEE recuerde hechos que yo apruebo",
    "Usar mis hechos guardados para personalizar respuestas",
    "Guardar ajustes de memoria",
    "Exportar mis datos de BOT DEE",
    "Eliminar historial guardado",
    "Guardado. La pausa de 5 minutos sigue cerrando el chat en vivo; el historial elegido permanece.",
    "Historial guardado de BOT DEE eliminado.",
    "Aún no hay recuerdos guardados.",
    "Biblioteca de investigación y SmartViews",
    "Aún no hay SmartViews guardadas.",
    "Mostrar SmartViews de prueba",
    "Explain My Recommendation usa las fuentes y preferencias de cada tarjeta. Los anuncios se marcan. Puede pedir resultados sin personalizar.",
    "Abrir la página pública FLOQR",
    "Public Web Research permanece apagada hasta la revisión legal y de identidad. Las tarjetas de local abren la página pública FLOQR existente.",
    "Las valoraciones se muestran por separado según la fuente.",
    "Menú (se abre fuera de FLOQR)",
    "Mock / datos no licenciados en vivo",
    "Abrir la visibilidad de perfil existente"
  ],
  nl: [
    "Opgeslagen chats en herinneringen",
    "De pauze van vijf minuten beëindigt de live chat. Ze verwijdert niet de geschiedenis die u koos om te bewaren. Gasten blijven tijdelijk. Mingl-chats worden nooit hierheen gekopieerd.",
    "Deze BOT DEE-chat na de pauze bewaren (opt-in)",
    "BOT DEE mag feiten onthouden die ik goedkeur",
    "Mijn opgeslagen feiten gebruiken om antwoorden te personaliseren",
    "Geheugeninstellingen opslaan",
    "Mijn BOT DEE-gegevens exporteren",
    "Opgeslagen geschiedenis wissen",
    "Opgeslagen. De pauze van 5 minuten beëindigt nog steeds de live chat; gekozen geschiedenis blijft.",
    "Opgeslagen BOT DEE-geschiedenis gewist.",
    "Nog geen opgeslagen herinneringen.",
    "Research Library en SmartViews",
    "Nog geen opgeslagen SmartViews.",
    "Mock-SmartViews tonen",
    "Explain My Recommendation gebruikt de bronnen en voorkeuren op elke kaart. Advertenties zijn gelabeld. U kunt niet-gepersonaliseerde resultaten vragen.",
    "FLOQR-openbare pagina openen",
    "Public Web Research blijft uit tot juridische en identiteitscontrole. Venuekaarten openen de bestaande FLOQR-openbare pagina.",
    "Beoordelingen worden per bron apart getoond.",
    "Menu (opent buiten FLOQR)",
    "Mock / geen live gelicentieerde data",
    "Bestaande profielzichtbaarheid openen"
  ],
  ru: [
    "Сохранённые чаты и воспоминания",
    "Пятиминутная пауза завершает живой чат. Она не удаляет историю, которую вы согласились сохранить. Гости остаются без записи. Чаты Mingl сюда не копируются.",
    "Сохранять этот чат BOT DEE после паузы (согласие)",
    "Разрешить BOT DEE помнить факты, которые я подтверждаю",
    "Использовать сохранённые факты для персонализации ответов",
    "Сохранить настройки памяти",
    "Экспортировать мои данные BOT DEE",
    "Удалить сохранённую историю",
    "Сохранено. Пауза 5 минут по-прежнему завершает живой чат; выбранная история остаётся.",
    "Сохранённая история BOT DEE удалена.",
    "Пока нет сохранённых воспоминаний.",
    "Библиотека исследований и SmartViews",
    "Пока нет сохранённых SmartViews.",
    "Показать макеты SmartViews",
    "Explain My Recommendation использует источники и предпочтения на каждой карточке. Реклама помечена. Можно запросить неперсонализированные результаты.",
    "Открыть публичную страницу FLOQR",
    "Public Web Research выключен до юридической и идентификационной проверки. Карточки заведений открывают существующую публичную страницу FLOQR.",
    "Оценки показываются отдельно по источнику.",
    "Меню (открывается вне FLOQR)",
    "Макет / нет живых лицензированных данных",
    "Открыть существующую видимость профиля"
  ],
  it: [
    "Chat e memorie salvate",
    "La pausa di cinque minuti chiude la chat dal vivo. Non cancella la cronologia che hai scelto di salvare. Gli ospiti restano effimeri. Le chat Mingl non vengono mai copiate qui.",
    "Salva questa chat BOT DEE dopo la pausa (opt-in)",
    "Consenti a BOT DEE di ricordare i fatti che approvo",
    "Usa i fatti salvati per personalizzare le risposte",
    "Salva impostazioni memoria",
    "Esporta i miei dati BOT DEE",
    "Elimina cronologia salvata",
    "Salvato. La pausa di 5 minuti chiude ancora la chat dal vivo; la cronologia scelta resta.",
    "Cronologia BOT DEE salvata eliminata.",
    "Nessuna memoria salvata.",
    "Research Library e SmartViews",
    "Nessuna SmartView salvata.",
    "Mostra SmartView fittizie",
    "Explain My Recommendation usa le fonti e le preferenze su ogni scheda. Gli annunci sono etichettati. Puoi chiedere risultati non personalizzati.",
    "Apri la pagina pubblica FLOQR",
    "Public Web Research resta disattivata fino alla revisione legale e di identità. Le schede venue aprono la pagina pubblica FLOQR esistente.",
    "Le valutazioni sono mostrate separatamente per fonte.",
    "Menu (si apre fuori da FLOQR)",
    "Mock / dati non concessi in licenza live",
    "Apri la visibilità profilo esistente"
  ],
  pt: [
    "Chats e memórias guardados",
    "A pausa de cinco minutos termina o chat ao vivo. Não apaga o histórico que optou por guardar. Convidados continuam efémeros. Chats Mingl nunca são copiados para aqui.",
    "Guardar este chat BOT DEE após a pausa (aderir)",
    "Permitir que o BOT DEE lembre factos que eu aprovo",
    "Usar os meus factos guardados para personalizar respostas",
    "Guardar definições de memória",
    "Exportar os meus dados BOT DEE",
    "Apagar histórico guardado",
    "Guardado. A pausa de 5 minutos continua a terminar o chat ao vivo; o histórico escolhido permanece.",
    "Histórico BOT DEE guardado apagado.",
    "Ainda sem memórias guardadas.",
    "Biblioteca de pesquisa e SmartViews",
    "Ainda sem SmartViews guardadas.",
    "Mostrar SmartViews de teste",
    "Explain My Recommendation usa as fontes e preferências em cada cartão. Anúncios são rotulados. Pode pedir resultados sem personalização.",
    "Abrir a página pública FLOQR",
    "Public Web Research permanece desligada até revisão legal e de identidade. Cartões de local abrem a página pública FLOQR existente.",
    "As classificações são mostradas em separado por fonte.",
    "Menu (abre fora do FLOQR)",
    "Mock / dados não licenciados em direto",
    "Abrir a visibilidade de perfil existente"
  ],
  el: [
    "Αποθηκευμένες συνομιλίες και μνήμες",
    "Η παύση των πέντε λεπτών κλείνει τη ζωντανή συνομιλία. Δεν διαγράφει το ιστορικό που επιλέξατε να αποθηκεύσετε. Οι επισκέπτες μένουν προσωρινοί. Οι συνομιλίες Mingl δεν αντιγράφονται εδώ.",
    "Αποθήκευση αυτής της συνομιλίας BOT DEE μετά την παύση (opt-in)",
    "Να θυμάται το BOT DEE γεγονότα που εγκρίνω",
    "Χρήση αποθηκευμένων γεγονότων για εξατομίκευση απαντήσεων",
    "Αποθήκευση ρυθμίσεων μνήμης",
    "Εξαγωγή των δεδομένων BOT DEE",
    "Διαγραφή αποθηκευμένου ιστορικού",
    "Αποθηκεύτηκε. Η παύση 5 λεπτών κλείνει ακόμα τη ζωντανή συνομιλία· το επιλεγμένο ιστορικό μένει.",
    "Το αποθηκευμένο ιστορικό BOT DEE διαγράφηκε.",
    "Δεν υπάρχουν ακόμα αποθηκευμένες μνήμες.",
    "Βιβλιοθήκη έρευνας και SmartViews",
    "Δεν υπάρχουν ακόμα αποθηκευμένα SmartViews.",
    "Εμφάνιση δοκιμαστικών SmartViews",
    "Το Explain My Recommendation χρησιμοποιεί πηγές και προτιμήσεις σε κάθε κάρτα. Οι διαφημίσεις επισημαίνονται. Μπορείτε να ζητήσετε μη εξατομικευμένα αποτελέσματα.",
    "Άνοιγμα δημόσιας σελίδας FLOQR",
    "Το Public Web Research μένει κλειστό μέχρι νομικό και ταυτοτικό έλεγχο. Οι κάρτες χώρου ανοίγουν την υπάρχουσα δημόσια σελίδα FLOQR.",
    "Οι αξιολογήσεις εμφανίζονται χωριστά ανά πηγή.",
    "Μενού (ανοίγει εκτός FLOQR)",
    "Mock / όχι ζωντανά αδειοδοτημένα δεδομένα",
    "Άνοιγμα υπάρχουσας ορατότητας προφίλ"
  ],
  pl: [
    "Zapisane czaty i wspomnienia",
    "Pięciominutowa pauza kończy czat na żywo. Nie usuwa historii, którą zdecydowałeś się zapisać. Goście pozostają tymczasowi. Czaty Mingl nigdy nie są tu kopiowane.",
    "Zapisz ten czat BOT DEE po pauzie (zgoda)",
    "Pozwól BOT DEE pamiętać fakty, które zatwierdzam",
    "Używaj zapisanych faktów do personalizacji odpowiedzi",
    "Zapisz ustawienia pamięci",
    "Eksportuj moje dane BOT DEE",
    "Usuń zapisaną historię",
    "Zapisano. 5-minutowa pauza nadal kończy czat na żywo; wybrana historia zostaje.",
    "Zapisana historia BOT DEE usunięta.",
    "Brak zapisanych wspomnień.",
    "Biblioteka badań i SmartViews",
    "Brak zapisanych SmartViews.",
    "Pokaż testowe SmartViews",
    "Explain My Recommendation używa źródeł i preferencji na każdej karcie. Reklamy są oznaczone. Możesz poprosić o wyniki bez personalizacji.",
    "Otwórz publiczną stronę FLOQR",
    "Public Web Research pozostaje wyłączone do przeglądu prawnego i tożsamości. Karty lokali otwierają istniejącą publiczną stronę FLOQR.",
    "Oceny są pokazywane osobno według źródła.",
    "Menu (otwiera się poza FLOQR)",
    "Mock / brak danych na żywo z licencją",
    "Otwórz istniejącą widoczność profilu"
  ],
  ar: [
    "المحادثات والذكريات المحفوظة",
    "توقف الخمس دقائق ينهي الدردشة المباشرة. لا يحذف السجل الذي اخترت حفظه. يبقى الضيوف بلا حفظ. محادثات Mingl لا تُنسخ إلى هنا.",
    "حفظ دردشة BOT DEE هذه بعد التوقف (موافقة)",
    "السماح لـ BOT DEE بتذكر الحقائق التي أوافق عليها",
    "استخدام حقائقي المحفوظة لتخصيص الإجابات",
    "حفظ إعدادات الذاكرة",
    "تصدير بيانات BOT DEE الخاصة بي",
    "حذف السجل المحفوظ",
    "تم الحفظ. توقف الخمس دقائق ما زال ينهي الدردشة المباشرة؛ السجل الذي وافقت عليه يبقى.",
    "تم حذف سجل BOT DEE المحفوظ.",
    "لا ذكريات محفوظة بعد.",
    "مكتبة البحث وSmartViews",
    "لا SmartViews محفوظة بعد.",
    "عرض SmartViews تجريبية",
    "يستخدم Explain My Recommendation المصادر والتفضيلات على كل بطاقة. الإعلانات موسومة. يمكنك طلب نتائج بلا تخصيص.",
    "فتح صفحة FLOQR العامة",
    "يبقى Public Web Research متوقفًا حتى المراجعة القانونية والهوية. بطاقات المكان تفتح صفحة FLOQR العامة الحالية.",
    "تُعرض التقييمات منفصلة حسب المصدر.",
    "القائمة (تُفتح خارج FLOQR)",
    "تجريبي / ليست بيانات مرخّصة مباشرة",
    "فتح إعدادات ظهور الملف الحالية"
  ]
};

function injectChrome(src, lang, pairs) {
  const afterKey = `"botdee.fallback.foundHeader"`;
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

const HELP = {
  "help-botdee-memory": {
    en: {title: "BOT DEE saved chats", body: "The five-minute pause ends the live BOT DEE session. If you opt in, BOT DEE keeps that chat so you can come back later. You can export or delete it. Guests are not saved. Mingl conversations stay in Mingl."},
    fr: {title: "Chats BOT DEE enregistrés", body: "La pause de cinq minutes termine la session BOT DEE en direct. Si vous acceptez, BOT DEE conserve ce chat pour y revenir. Vous pouvez l’exporter ou le supprimer. Les invités ne sont pas enregistrés. Les conversations Mingl restent dans Mingl."},
    de: {title: "Gespeicherte BOT DEE-Chats", body: "Die fünfminütige Pause beendet die live BOT DEE-Sitzung. Mit Opt-in behält BOT DEE den Chat. Sie können exportieren oder löschen. Gäste werden nicht gespeichert. Mingl bleibt Mingl."},
    es: {title: "Chats BOT DEE guardados", body: "La pausa de cinco minutos termina la sesión BOT DEE en vivo. Si acepta, BOT DEE guarda el chat. Puede exportar o borrar. Los invitados no se guardan. Mingl se queda en Mingl."},
    nl: {title: "Opgeslagen BOT DEE-chats", body: "De pauze van vijf minuten beëindigt de live BOT DEE-sessie. Met opt-in bewaart BOT DEE de chat. U kunt exporteren of wissen. Gasten worden niet bewaard. Mingl blijft Mingl."},
    ru: {title: "Сохранённые чаты BOT DEE", body: "Пятиминутная пауза завершает живую сессию BOT DEE. При согласии BOT DEE сохраняет чат. Можно экспортировать или удалить. Гости не сохраняются. Mingl остаётся в Mingl."},
    it: {title: "Chat BOT DEE salvate", body: "La pausa di cinque minuti chiude la sessione BOT DEE dal vivo. Con opt-in BOT DEE tiene la chat. Puoi esportare o eliminare. Gli ospiti non vengono salvati. Mingl resta in Mingl."},
    pt: {title: "Chats BOT DEE guardados", body: "A pausa de cinco minutos termina a sessão BOT DEE ao vivo. Se aderir, o BOT DEE guarda o chat. Pode exportar ou apagar. Convidados não são guardados. Mingl fica no Mingl."},
    el: {title: "Αποθηκευμένες συνομιλίες BOT DEE", body: "Η παύση των πέντε λεπτών κλείνει τη ζωντανή συνεδρία BOT DEE. Με opt-in το BOT DEE κρατά τη συνομιλία. Μπορείτε να εξαγάγετε ή να διαγράψετε. Οι επισκέπτες δεν αποθηκεύονται. Το Mingl μένει στο Mingl."},
    pl: {title: "Zapisane czaty BOT DEE", body: "Pięciominutowa pauza kończy sesję BOT DEE na żywo. Po zgodzie BOT DEE zachowuje czat. Możesz eksportować lub usunąć. Goście nie są zapisywani. Mingl zostaje w Mingl."},
    ar: {title: "محادثات BOT DEE المحفوظة", body: "توقف الخمس دقائق ينهي جلسة BOT DEE المباشرة. إذا وافقت، يحتفظ BOT DEE بالمحادثة. يمكنك التصدير أو الحذف. لا يُحفظ الضيوف. تبقى محادثات Mingl في Mingl."}
  },
  "help-botdee-smartview": {
    en: {title: "BOT DEE SmartViews", body: "SmartViews are compact cards for venues, events, restaurants, and more. A club card opens the existing FLOQR Public Page — it is not a second profile. Mock cards are labeled until providers are approved."},
    fr: {title: "SmartViews BOT DEE", body: "Les SmartViews sont des cartes compactes pour lieux, événements, restaurants. Une carte club ouvre la page publique FLOQR existante — ce n’est pas un second profil. Les maquettes sont indiquées tant que les fournisseurs ne sont pas approuvés."},
    de: {title: "BOT DEE SmartViews", body: "SmartViews sind kompakte Karten für Venues, Events, Restaurants. Eine Club-Karte öffnet die vorhandene FLOQR-Public-Page — kein zweites Profil. Mock-Karten sind gekennzeichnet, bis Anbieter genehmigt sind."},
    es: {title: "SmartViews de BOT DEE", body: "Las SmartViews son tarjetas compactas de locales, eventos y restaurantes. Una tarjeta de club abre la página pública FLOQR existente — no es un segundo perfil. Las maquetas se marcan hasta que los proveedores estén aprobados."},
    nl: {title: "BOT DEE SmartViews", body: "SmartViews zijn compacte kaarten voor venues, events en restaurants. Een clubkaart opent de bestaande FLOQR-openbare pagina — geen tweede profiel. Mockkaarten zijn gelabeld tot providers zijn goedgekeurd."},
    ru: {title: "SmartViews BOT DEE", body: "SmartViews — компактные карточки заведений, событий и ресторанов. Карточка клуба открывает существующую публичную страницу FLOQR — это не второй профиль. Макеты помечены, пока провайдеры не одобрены."},
    it: {title: "SmartView BOT DEE", body: "Le SmartView sono schede compatte per locali, eventi e ristoranti. Una scheda club apre la pagina pubblica FLOQR esistente — non è un secondo profilo. Le mock sono etichettate finché i provider non sono approvati."},
    pt: {title: "SmartViews BOT DEE", body: "SmartViews são cartões compactos de locais, eventos e restaurantes. Um cartão de clube abre a página pública FLOQR existente — não é um segundo perfil. Os mocks são rotulados até os fornecedores serem aprovados."},
    el: {title: "SmartViews BOT DEE", body: "Τα SmartViews είναι συμπαγείς κάρτες για χώρους, εκδηλώσεις και εστιατόρια. Μια κάρτα club ανοίγει την υπάρχουσα δημόσια σελίδα FLOQR — όχι δεύτερο προφίλ. Τα mock επισημαίνονται μέχρι να εγκριθούν οι πάροχοι."},
    pl: {title: "SmartViews BOT DEE", body: "SmartViews to zwarte karty lokali, wydarzeń i restauracji. Karta klubu otwiera istniejącą publiczną stronę FLOQR — to nie drugi profil. Mocki są oznaczone, dopóki dostawcy nie zostaną zatwierdzeni."},
    ar: {title: "SmartViews لـ BOT DEE", body: "SmartViews بطاقات موجزة للأماكن والفعاليات والمطاعم. بطاقة النادي تفتح صفحة FLOQR العامة الحالية — وليست ملفًا ثانيًا. البطاقات التجريبية موسومة حتى اعتماد المزودين."}
  },
  "help-botdee-research-library": {
    en: {title: "BOT DEE Research Library", body: "Save places and cards you asked BOT DEE about. A Google Place ID is not a copy of Google’s photos or reviews. You can refresh or delete a saved item. Licensed caches stay off until the provider is approved."},
    fr: {title: "Bibliothèque de recherche BOT DEE", body: "Enregistrez les lieux et cartes demandés à BOT DEE. Un identifiant Google Place n’est pas une copie des photos ou avis Google. Vous pouvez actualiser ou supprimer. Les caches licenciés restent off tant que le fournisseur n’est pas approuvé."},
    de: {title: "BOT DEE Research Library", body: "Speichern Sie Orte und Karten, die Sie BOT DEE gefragt haben. Eine Google Place-ID ist keine Kopie von Fotos oder Bewertungen. Sie können aktualisieren oder löschen. Lizenzierte Caches bleiben aus, bis der Anbieter genehmigt ist."},
    es: {title: "Biblioteca de investigación BOT DEE", body: "Guarde lugares y tarjetas que pidió a BOT DEE. Un Place ID de Google no copia fotos ni reseñas. Puede actualizar o borrar. Las cachés con licencia siguen apagadas hasta aprobar al proveedor."},
    nl: {title: "BOT DEE Research Library", body: "Bewaar plaatsen en kaarten die u BOT DEE vroeg. Een Google Place-ID is geen kopie van foto’s of reviews. U kunt vernieuwen of wissen. Gelicentieerde caches blijven uit tot de provider is goedgekeurd."},
    ru: {title: "Библиотека исследований BOT DEE", body: "Сохраняйте места и карточки, о которых вы спрашивали BOT DEE. Place ID Google — не копия фото или отзывов. Можно обновить или удалить. Лицензионные кэши выключены, пока провайдер не одобрен."},
    it: {title: "Research Library BOT DEE", body: "Salva luoghi e schede chieste a BOT DEE. Un Place ID Google non è una copia di foto o recensioni. Puoi aggiornare o eliminare. Le cache con licenza restano off finché il provider non è approvato."},
    pt: {title: "Biblioteca de pesquisa BOT DEE", body: "Guarde lugares e cartões que pediu ao BOT DEE. Um Place ID do Google não copia fotos ou avaliações. Pode atualizar ou apagar. Caches licenciados ficam desligados até o fornecedor ser aprovado."},
    el: {title: "Βιβλιοθήκη έρευνας BOT DEE", body: "Αποθηκεύστε μέρη και κάρτες που ρωτήσατε το BOT DEE. Ένα Google Place ID δεν αντιγράφει φωτογραφίες ή κριτικές. Μπορείτε να ανανεώσετε ή να διαγράψετε. Οι αδειοδοτημένες μνήμες μένουν κλειστές μέχρι έγκριση παρόχου."},
    pl: {title: "Biblioteka badań BOT DEE", body: "Zapisuj miejsca i karty, o które pytałeś BOT DEE. Google Place ID to nie kopia zdjęć ani recenzji. Możesz odświeżyć lub usunąć. Licencjonowane cache zostaje wyłączone, dopóki dostawca nie zostanie zatwierdzony."},
    ar: {title: "مكتبة بحث BOT DEE", body: "احفظ الأماكن والبطاقات التي سألت BOT DEE عنها. معرّف Google Place ليس نسخة من صور أو مراجعات Google. يمكنك التحديث أو الحذف. تبقى ذاكرة التخزين المرخّصة متوقفة حتى اعتماد المزود."}
  },
  "help-botdee-explain": {
    en: {title: "Explain My Recommendation", body: "Each recommendation can show evidence, the date it was checked, whether personalization was on, and if a placement is sponsored. You can ask BOT DEE not to personalize this search."},
    fr: {title: "Explain My Recommendation", body: "Chaque recommandation peut montrer les preuves, la date de vérification, si la personnalisation était active, et si un emplacement est sponsorisé. Vous pouvez demander à BOT DEE de ne pas personnaliser cette recherche."},
    de: {title: "Explain My Recommendation", body: "Jede Empfehlung kann Belege, Prüfdatum, Personalisierung und Sponsoring zeigen. Sie können BOT DEE bitten, diese Suche nicht zu personalisieren."},
    es: {title: "Explain My Recommendation", body: "Cada recomendación puede mostrar evidencias, fecha de comprobación, si hubo personalización y si un espacio es patrocinado. Puede pedir a BOT DEE que no personalice esta búsqueda."},
    nl: {title: "Explain My Recommendation", body: "Elke aanbeveling kan bewijs, controledatum, personalisatie en sponsoring tonen. U kunt BOT DEE vragen deze zoekopdracht niet te personaliseren."},
    ru: {title: "Explain My Recommendation", body: "Каждая рекомендация может показать доказательства, дату проверки, персонализацию и спонсорство. Можно попросить BOT DEE не персонализировать этот поиск."},
    it: {title: "Explain My Recommendation", body: "Ogni raccomandazione può mostrare prove, data di verifica, personalizzazione e sponsorship. Puoi chiedere a BOT DEE di non personalizzare questa ricerca."},
    pt: {title: "Explain My Recommendation", body: "Cada recomendação pode mostrar evidências, data da verificação, personalização e patrocínio. Pode pedir ao BOT DEE para não personalizar esta pesquisa."},
    el: {title: "Explain My Recommendation", body: "Κάθε σύσταση μπορεί να δείξει στοιχεία, ημερομηνία ελέγχου, εξατομίκευση και χορηγία. Μπορείτε να ζητήσετε από το BOT DEE να μην εξατομικεύσει αυτή την αναζήτηση."},
    pl: {title: "Explain My Recommendation", body: "Każda rekomendacja może pokazać dowody, datę sprawdzenia, personalizację i sponsoring. Możesz poprosić BOT DEE, aby nie personalizował tego wyszukiwania."},
    ar: {title: "Explain My Recommendation", body: "يمكن لكل توصية إظهار الأدلة وتاريخ الفحص وما إذا كان التخصيص قيد التشغيل وما إذا كان الموضع مدعومًا. يمكنك أن تطلب من BOT DEE عدم تخصيص هذا البحث."}
  },
  "help-botdee-privacy-assistant": {
    en: {title: "BOT DEE Privacy Assistant", body: "Change what other FLOQR users see in My Profile visibility — BOT DEE does not add a second public switch. If web research attached the wrong person, you can dispute it here without changing your profile. BOT DEE cannot promise that a third-party site will delete the original page."},
    fr: {title: "Assistant confidentialité BOT DEE", body: "Changez ce que les autres utilisateurs FLOQR voient dans la visibilité de Mon profil — BOT DEE n’ajoute pas un second interrupteur public. Si la recherche web a lié la mauvaise personne, vous pouvez contester sans changer votre profil. BOT DEE ne promet pas qu’un site tiers supprimera la page d’origine."},
    de: {title: "BOT DEE Privacy Assistant", body: "Ändern Sie in Mein Profil, was andere FLOQR-Nutzer sehen — BOT DEE fügt keinen zweiten Öffentlich-Schalter hinzu. Falsche Web-Zuordnung können Sie widersprechen, ohne das Profil zu ändern. BOT DEE verspricht keine Löschung auf Drittseiten."},
    es: {title: "Asistente de privacidad BOT DEE", body: "Cambie lo que otros usuarios FLOQR ven en la visibilidad de Mi perfil — BOT DEE no añade un segundo interruptor público. Si la investigación web asoció a la persona equivocada, puede disputarlo sin cambiar su perfil. BOT DEE no promete que un sitio tercero borre la página original."},
    nl: {title: "BOT DEE Privacy Assistant", body: "Wijzig in Mijn profiel wat andere FLOQR-gebruikers zien — BOT DEE voegt geen tweede openbare schakelaar toe. Verkeerde webkoppeling kunt u betwisten zonder uw profiel te wijzigen. BOT DEE belooft geen verwijdering op sites van derden."},
    ru: {title: "Помощник конфиденциальности BOT DEE", body: "Меняйте видимость в «Моём профиле» — BOT DEE не добавляет второй публичный переключатель. Неверную веб-привязку можно оспорить, не меняя профиль. BOT DEE не обещает удаление на стороннем сайте."},
    it: {title: "Privacy Assistant BOT DEE", body: "Cambia in Il mio profilo cosa vedono gli altri utenti FLOQR — BOT DEE non aggiunge un secondo interruttore pubblico. Se la ricerca web ha collegato la persona sbagliata, puoi contestare senza cambiare il profilo. BOT DEE non promette la cancellazione su siti terzi."},
    pt: {title: "Assistente de privacidade BOT DEE", body: "Altere em O meu perfil o que outros utilizadores FLOQR veem — o BOT DEE não adiciona um segundo interruptor público. Se a pesquisa web associou a pessoa errada, pode contestar sem alterar o perfil. O BOT DEE não promete que um site terceiro apague a página original."},
    el: {title: "Βοηθός απορρήτου BOT DEE", body: "Αλλάξτε στο Προφίλ μου τι βλέπουν άλλοι χρήστες FLOQR — το BOT DEE δεν προσθέτει δεύτερο δημόσιο διακόπτη. Λάθος διαδικτυακή αντιστοίχιση μπορείτε να αμφισβητήσετε χωρίς αλλαγή προφίλ. Το BOT DEE δεν υπόσχεται διαγραφή σε ιστότοπο τρίτου."},
    pl: {title: "Asystent prywatności BOT DEE", body: "W Mój profil zmień, co widzą inni użytkownicy FLOQR — BOT DEE nie dodaje drugiego przełącznika publicznego. Błędne powiązanie z sieci możesz zgłosić bez zmiany profilu. BOT DEE nie obiecuje usunięcia na stronie trzeciej."},
    ar: {title: "مساعد خصوصية BOT DEE", body: "غيّر في ملفي ما يراه مستخدمو FLOQR الآخرون — لا يضيف BOT DEE مفتاحًا عامًا ثانيًا. إذا ربط البحث شخصًا خطأ، يمكنك الاعتراض دون تغيير ملفك. لا يعد BOT DEE بحذف الصفحة الأصلية لدى طرف ثالث."}
  }
};

function injectHelpPacks() {
  const file = path.join(ROOT, "floqr-i18n-help.js");
  let src = fs.readFileSync(file, "utf8");
  const langs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
  langs.forEach(lang => {
    Object.keys(HELP).forEach(id => {
      if (src.includes(`"${id}"`) && src.split(`"${id}"`).length > langs.length) {
        /* still insert per pack */
      }
      const marker = new RegExp(`(\\n    "${lang}": \\{[\\s\\S]*?"help-botdee-page": \\{[\\s\\S]*?\\n      \\},)`);
      const block = HELP[id][lang];
      const insert = `\n      "${id}": {\n        title: ${q(block.title)},\n        body: ${q(block.body)}\n      },`;
      const packStart = src.indexOf(`\n    "${lang}": {`);
      const next = langs[langs.indexOf(lang) + 1];
      const packEnd = next ? src.indexOf(`\n    "${next}": {`, packStart + 1) : src.indexOf("\n  };", packStart);
      const pack = src.slice(packStart, packEnd);
      if (pack.includes(`"${id}"`)) return;
      const needle = pack.indexOf(`"help-botdee-page"`);
      const after = pack.indexOf("\n      },", needle);
      if (needle < 0 || after < 0) throw new Error(`help-botdee-page missing in ${lang}`);
      const cut = after + "\n      },".length;
      const updated = pack.slice(0, cut) + insert + pack.slice(cut);
      src = src.slice(0, packStart) + updated + src.slice(packEnd);
    });
  });
  fs.writeFileSync(file, src);
}

function injectHelpEn() {
  const file = path.join(ROOT, "scripts", "_help-en.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.keys(HELP).forEach(id => {
    json[id] = HELP[id].en;
  });
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

CHROME_ORDER.forEach(lang => {
  if (!T[lang] || T[lang].length !== KEYS.length) throw new Error(`Bad chrome pack ${lang}`);
});

let chrome = fs.readFileSync(path.join(ROOT, "floqr-i18n.js"), "utf8");
CHROME_ORDER.forEach(lang => {
  const pairs = KEYS.map((k, i) => [k, T[lang][i]]);
  chrome = injectChrome(chrome, lang, pairs);
});
fs.writeFileSync(path.join(ROOT, "floqr-i18n.js"), chrome);
injectHelpEn();
injectHelpPacks();
console.log("Added", KEYS.length, "chrome keys ×", CHROME_ORDER.length, "and", Object.keys(HELP).length, "help ids");
