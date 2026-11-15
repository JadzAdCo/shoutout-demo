#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const NEW_KEYS = [
  "nav.myBotDee",
  "portal.fo.botDeeNote",
  "botdee.knowsTitle",
  "botdee.knowsEmpty",
  "botdee.knowsOff",
  "botdee.knowsNote",
  "botdee.knowsDelete",
  "botdee.knowsDeleted",
  "botdee.openChat",
  "master.botDeeSubPause",
  "master.botDeeSubLegal",
  "master.botDeeSubSmartviews",
  "master.botDeePauseNote",
  "master.botDeeIdleLabel",
  "master.botDeeLegalIntro",
  "master.botDeeReloadManifest",
  "master.botDeeSaveLegalGate",
  "master.botDeeSlotsTitle",
  "master.botDeeSlotsNote",
  "master.botDeeSaveSlot"
];

const REMOVE_KEYS = [
  "botdee.settingsBubble",
  "botdee.settingsClose",
  "botdee.settingsOpen",
  "botdee.settingsFirstUse"
];

const T = {
  en: ["My BOT DEE", "Saved chats, memories, and facts BOT DEE may keep with your approval.", "What BOT DEE knows of me", "BOT DEE has not stored any facts about you yet.", "Turn on memory above so BOT DEE can keep facts you approve.", "These facts were saved with your approval. Export or delete them here. BOT DEE never stores your IP address.", "Remove this fact", "Fact removed.", "Open BOT DEE chat", "Conversation Pause", "Version & Legal Gates", "SMARTviews", "After this many seconds with no new message, BOT DEE ends the conversation. Saying hi (or anything) after that starts a fresh chat. Default is 300 seconds (5 minutes). Range 15–600.", "Idle pause (seconds)", "Capability registry is code-derived. New six-phase work is not production-deployed until you approve. Every third-party provider stays mock-only until you record license evidence.", "Reload capability report", "Save legal gate", "Later-fill integration slots", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner, and Eventbrite stay mock until enabled=1, the named Firebase secret is present, and a legal evidence ref is saved. Do not paste API keys here. Live vendor HTTP is not wired.", "Save integration slot"],
  fr: ["Mon BOT DEE", "Discussions, souvenirs et faits que BOT DEE peut garder avec votre accord.", "Ce que BOT DEE sait de moi", "BOT DEE n’a encore enregistré aucun fait vous concernant.", "Activez la mémoire ci-dessus pour que BOT DEE garde les faits que vous approuvez.", "Ces faits ont été enregistrés avec votre accord. Exportez-les ou supprimez-les ici. BOT DEE n’enregistre jamais votre adresse IP.", "Retirer ce fait", "Fait retiré.", "Ouvrir le chat BOT DEE", "Pause de conversation", "Version et portes juridiques", "SMARTviews", "Après ce nombre de secondes sans nouveau message, BOT DEE met fin à la conversation. Dire bonjour après cela ouvre un nouveau chat. Par défaut 300 secondes (5 minutes). Plage 15–600.", "Pause d’inactivité (secondes)", "Le registre des capacités est dérivé du code. Le travail en six phases n’est pas déployé en production tant que vous n’approuvez pas. Chaque fournisseur tiers reste en mock tant qu’aucune preuve de licence n’est enregistrée.", "Recharger le rapport de capacités", "Enregistrer la porte juridique", "Emplacements d’intégration à remplir plus tard", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner et Eventbrite restent en mock jusqu’à enabled=1, secret Firebase nommé et référence de preuve juridique. Ne collez pas de clés API ici. Pas d’HTTP fournisseur en direct.", "Enregistrer l’emplacement"],
  de: ["Mein BOT DEE", "Gespeicherte Chats, Erinnerungen und Fakten, die BOT DEE mit Ihrer Zustimmung behält.", "Was BOT DEE von mir weiß", "BOT DEE hat noch keine Fakten über Sie gespeichert.", "Aktivieren Sie oben die Erinnerung, damit BOT DEE von Ihnen bestätigte Fakten behält.", "Diese Fakten wurden mit Ihrer Zustimmung gespeichert. Exportieren oder löschen Sie sie hier. BOT DEE speichert niemals Ihre IP-Adresse.", "Diese Tatsache entfernen", "Tatsache entfernt.", "BOT DEE-Chat öffnen", "Gesprächspause", "Version & rechtliche Gates", "SMARTviews", "Nach so vielen Sekunden ohne neue Nachricht beendet BOT DEE das Gespräch. Ein Hallo danach startet einen neuen Chat. Standard 300 Sekunden (5 Minuten). Bereich 15–600.", "Inaktivitätspause (Sekunden)", "Die Fähigkeitsregistrierung leitet sich aus dem Code ab. Die Sechs-Phasen-Arbeit wird erst nach Ihrer Freigabe produktiv. Jeder Drittanbieter bleibt mock, bis Sie Lizenznachweise hinterlegen.", "Fähigkeitsbericht neu laden", "Rechtliches Gate speichern", "Später zu füllende Integrations-Slots", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner und Eventbrite bleiben mock bis enabled=1, benanntes Firebase-Geheimnis und rechtlicher Nachweis. Keine API-Schlüssel hier einfügen.", "Slot speichern"],
  es: ["Mi BOT DEE", "Chats, recuerdos y hechos que BOT DEE puede guardar con su consentimiento.", "Lo que BOT DEE sabe de mí", "BOT DEE aún no ha guardado hechos sobre usted.", "Active la memoria arriba para que BOT DEE guarde los hechos que apruebe.", "Estos hechos se guardaron con su consentimiento. Expórtelos o bórrelos aquí. BOT DEE nunca guarda su dirección IP.", "Quitar este hecho", "Hecho quitado.", "Abrir el chat BOT DEE", "Pausa de conversación", "Versión y compuertas legales", "SMARTviews", "Tras estos segundos sin un mensaje nuevo, BOT DEE termina la conversación. Decir hola después inicia un chat nuevo. Predeterminado 300 segundos (5 minutos). Rango 15–600.", "Pausa por inactividad (segundos)", "El registro de capacidades se deriva del código. El trabajo de seis fases no se despliega en producción hasta que usted apruebe. Cada proveedor externo sigue en mock hasta registrar evidencia de licencia.", "Recargar informe de capacidades", "Guardar compuerta legal", "Ranuras de integración para más adelante", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner y Eventbrite siguen en mock hasta enabled=1, secreto de Firebase y referencia legal. No pegue claves API aquí.", "Guardar ranura"],
  nl: ["Mijn BOT DEE", "Opgeslagen chats, herinneringen en feiten die BOT DEE met uw toestemming bewaart.", "Wat BOT DEE van mij weet", "BOT DEE heeft nog geen feiten over u opgeslagen.", "Zet hierboven geheugen aan zodat BOT DEE feiten bewaart die u goedkeurt.", "Deze feiten zijn met uw toestemming opgeslagen. Exporteer of wis ze hier. BOT DEE slaat nooit uw IP-adres op.", "Dit feit verwijderen", "Feit verwijderd.", "BOT DEE-chat openen", "Gesprekspauze", "Versie & juridische poorten", "SMARTviews", "Na zoveel seconden zonder nieuw bericht beëindigt BOT DEE het gesprek. Daarna hallo zeggen start een nieuwe chat. Standaard 300 seconden (5 minuten). Bereik 15–600.", "Inactieve pauze (seconden)", "Het capaciteitenregister komt uit de code. Zes-fasenwerk gaat niet live tot u goedkeurt. Elke derde partij blijft mock tot u licentiebewijs vastlegt.", "Capaciteitsrapport herladen", "Juridische poort opslaan", "Integratieslots voor later", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner en Eventbrite blijven mock tot enabled=1, Firebase-geheim en juridische referentie. Plak geen API-sleutels hier.", "Slot opslaan"],
  ru: ["Мой BOT DEE", "Сохранённые чаты, воспоминания и факты, которые BOT DEE может хранить с вашего согласия.", "Что BOT DEE знает обо мне", "BOT DEE пока не сохранил фактов о вас.", "Включите память выше, чтобы BOT DEE хранил факты, которые вы одобряете.", "Эти факты сохранены с вашего согласия. Экспортируйте или удалите их здесь. BOT DEE никогда не сохраняет ваш IP-адрес.", "Удалить этот факт", "Факт удалён.", "Открыть чат BOT DEE", "Пауза разговора", "Версия и юридические шлюзы", "SMARTviews", "После стольких секунд без нового сообщения BOT DEE завершает разговор. Привет после этого начинает новый чат. По умолчанию 300 секунд (5 минут). Диапазон 15–600.", "Пауза бездействия (секунды)", "Реестр возможностей берётся из кода. Шестифазная работа не развёрнута в продакшн, пока вы не утвердите. Каждый сторонний провайдер остаётся mock, пока не зафиксирована лицензия.", "Перезагрузить отчёт о возможностях", "Сохранить юридический шлюз", "Слоты интеграции на потом", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner и Eventbrite остаются mock до enabled=1, именованного секрета Firebase и юридической ссылки. Не вставляйте API-ключи здесь.", "Сохранить слот"],
  it: ["Il mio BOT DEE", "Chat, memorie e fatti che BOT DEE può tenere con il tuo consenso.", "Cosa BOT DEE sa di me", "BOT DEE non ha ancora salvato fatti su di te.", "Attiva sopra la memoria così BOT DEE tiene i fatti che approvi.", "Questi fatti sono salvati con il tuo consenso. Esportali o eliminali qui. BOT DEE non memorizza mai il tuo indirizzo IP.", "Rimuovi questo fatto", "Fatto rimosso.", "Apri la chat BOT DEE", "Pausa conversazione", "Versione e gate legali", "SMARTviews", "Dopo così tanti secondi senza un nuovo messaggio, BOT DEE termina la conversazione. Dire ciao dopo avvia una nuova chat. Predefinito 300 secondi (5 minuti). Intervallo 15–600.", "Pausa inattività (secondi)", "Il registro delle capacità deriva dal codice. Il lavoro a sei fasi non è in produzione finché non approvi. Ogni fornitore terzo resta mock finché non registri prove di licenza.", "Ricarica report capacità", "Salva gate legale", "Slot di integrazione da compilare", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner ed Eventbrite restano mock finché enabled=1, secret Firebase e riferimento legale. Non incollare chiavi API qui.", "Salva slot"],
  pt: ["O meu BOT DEE", "Chats, memórias e factos que o BOT DEE pode guardar com a sua aprovação.", "O que o BOT DEE sabe de mim", "O BOT DEE ainda não guardou factos sobre si.", "Ative a memória acima para o BOT DEE guardar factos que aprova.", "Estes factos foram guardados com a sua aprovação. Exporte ou apague-os aqui. O BOT DEE nunca guarda o seu endereço IP.", "Remover este facto", "Facto removido.", "Abrir o chat BOT DEE", "Pausa de conversa", "Versão e portas legais", "SMARTviews", "Após tantos segundos sem nova mensagem, o BOT DEE termina a conversa. Dizer olá depois inicia um chat novo. Predefinição 300 segundos (5 minutos). Intervalo 15–600.", "Pausa por inatividade (segundos)", "O registo de capacidades deriva do código. O trabalho de seis fases não vai a produção até aprovar. Cada fornecedor terceiro fica mock até registar evidência de licença.", "Recarregar relatório de capacidades", "Guardar porta legal", "Slots de integração para mais tarde", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner e Eventbrite ficam mock até enabled=1, segredo Firebase e referência legal. Não cole chaves API aqui.", "Guardar slot"],
  el: ["Το BOT DEE μου", "Αποθηκευμένες συνομιλίες, μνήμες και γεγονότα που το BOT DEE κρατά με την έγκρισή σας.", "Τι γνωρίζει το BOT DEE για μένα", "Το BOT DEE δεν έχει αποθηκεύσει γεγονότα για εσάς ακόμα.", "Ενεργοποιήστε τη μνήμη παραπάνω ώστε το BOT DEE να κρατά γεγονότα που εγκρίνετε.", "Αυτά τα γεγονότα αποθηκεύτηκαν με την έγκρισή σας. Εξαγάγετε ή διαγράψτε τα εδώ. Το BOT DEE δεν αποθηκεύει ποτέ τη διεύθυνση IP σας.", "Αφαίρεση αυτού του γεγονότος", "Το γεγονός αφαιρέθηκε.", "Άνοιγμα συνομιλίας BOT DEE", "Παύση συνομιλίας", "Έκδοση & νομικές πύλες", "SMARTviews", "Μετά από τόσα δευτερόλεπτα χωρίς νέο μήνυμα, το BOT DEE τερματίζει τη συνομιλία. Ένα γεια μετά ξεκινά νέα συνομιλία. Προεπιλογή 300 δευτερόλεπτα (5 λεπτά). Εύρος 15–600.", "Παύση αδράνειας (δευτερόλεπτα)", "Το μητρώο δυνατοτήτων προέρχεται από τον κώδικα. Η εργασία έξι φάσεων δεν ανέβει σε παραγωγή μέχρι να εγκρίνετε. Κάθε τρίτος πάροχος μένει mock μέχρι να καταγράψετε άδεια.", "Επαναφόρτωση αναφοράς δυνατοτήτων", "Αποθήκευση νομικής πύλης", "Θέσεις ολοκλήρωσης αργότερα", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner και Eventbrite μένουν mock μέχρι enabled=1, ονομαστικό Firebase secret και νομική αναφορά. Μην επικολλάτε κλειδιά API εδώ.", "Αποθήκευση θέσης"],
  pl: ["Mój BOT DEE", "Zapisane czaty, wspomnienia i fakty, które BOT DEE może przechowywać za Twoją zgodą.", "Co BOT DEE wie o mnie", "BOT DEE nie zapisał jeszcze żadnych faktów o Tobie.", "Włącz pamięć powyżej, aby BOT DEE zapisywał fakty, które zatwierdzasz.", "Te fakty zapisano za Twoją zgodą. Eksportuj lub usuń je tutaj. BOT DEE nigdy nie zapisuje Twojego adresu IP.", "Usuń ten fakt", "Fakt usunięty.", "Otwórz czat BOT DEE", "Pauza rozmowy", "Wersja i bramki prawne", "SMARTviews", "Po tylu sekundach bez nowej wiadomości BOT DEE kończy rozmowę. Cześć potem uruchamia nowy czat. Domyślnie 300 sekund (5 minut). Zakres 15–600.", "Pauza bezczynności (sekundy)", "Rejestr możliwości pochodzi z kodu. Praca sześciofazowa nie trafi na produkcję, dopóki nie zatwierdzisz. Każdy dostawca zewnętrzny pozostaje mock, dopóki nie zapiszesz dowodu licencji.", "Przeładuj raport możliwości", "Zapisz bramkę prawną", "Sloty integracji do uzupełnienia", "Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner i Eventbrite pozostają mock do enabled=1, nazwanego sekretu Firebase i odniesienia prawnego. Nie wklejaj kluczy API tutaj.", "Zapisz slot"],
  ar: ["BOT DEE الخاص بي", "المحادثات والذكريات والحقائق التي قد يحتفظ بها BOT DEE بموافقتك.", "ما يعرفه BOT DEE عني", "لم يخزّن BOT DEE أي حقائق عنك بعد.", "فعّل الذاكرة أعلاه حتى يحتفظ BOT DEE بالحقائق التي توافق عليها.", "حُفظت هذه الحقائق بموافقتك. صدّرها أو احذفها هنا. لا يخزّن BOT DEE عنوان IP الخاص بك أبدًا.", "إزالة هذه الحقيقة", "أُزيلت الحقيقة.", "فتح دردشة BOT DEE", "إيقاف المحادثة", "الإصدار والبوابات القانونية", "SMARTviews", "بعد هذه الثواني دون رسالة جديدة، ينهي BOT DEE المحادثة. قول مرحبًا بعدها يبدأ محادثة جديدة. الافتراضي 300 ثانية (5 دقائق). النطاق 15–600.", "إيقاف الخمول (ثوانٍ)", "سجل القدرات مستمد من الشيفرة. عمل المراحل الست لا يُنشر للإنتاج حتى توافق. كل مزود طرف ثالث يبقى وهميًا حتى تسجل دليل الترخيص.", "إعادة تحميل تقرير القدرات", "حفظ البوابة القانونية", "فتحات تكامل لاحقًا", "Google Places وGemini Search grounding وYelp وTicketmaster Discovery وTicketmaster Partner وEventbrite تبقى وهمية حتى enabled=1 والسر Firebase والمرجع القانوني. لا تلصق مفاتيح API هنا.", "حفظ الفتحة"]
};

function stripKeys(slice) {
  let out = slice;
  REMOVE_KEYS.forEach(key => {
    out = out.replace(new RegExp(`\\s*${q(key)}:\\s*[^\\n]+,?\\n`, "g"), "");
  });
  return out;
}

function injectChrome(src, lang) {
  const afterKey = q("botdee.privacyOpenProfile");
  const chromeStart = src.indexOf("const CHROME = ");
  const idx = src.indexOf(`\n    ${lang}: {`, chromeStart);
  if (idx < 0) throw new Error(`Missing pack ${lang}`);
  const nextPack = CHROME_ORDER[CHROME_ORDER.indexOf(lang) + 1];
  const end = nextPack ? src.indexOf(`\n    ${nextPack}: {`, idx + 1) : src.indexOf("\n  };", idx);
  let slice = src.slice(idx, end);
  slice = stripKeys(slice);
  const pairs = NEW_KEYS.map((k, i) => [k, T[lang][i]]);
  if (NEW_KEYS.every(k => slice.includes(q(k)))) {
    src = src.slice(0, idx) + slice + src.slice(end);
    return src;
  }
  const block = pairs.map(([k, v]) => `      ${q(k)}: ${q(v)},`).join("\n") + "\n";
  if (!slice.includes(afterKey)) throw new Error(`Missing ${afterKey} in ${lang}`);
  slice = slice.replace(new RegExp(`(${afterKey}:\\s*[^\\n]+,\\n)`), `$1${block}`);
  return src.slice(0, idx) + slice + src.slice(end);
}

let chrome = fs.readFileSync(path.join(ROOT, "floqr-i18n.js"), "utf8");
if (!process.env.FLOQR_SKIP_CHROME) {
  CHROME_ORDER.forEach(lang => {
    chrome = injectChrome(chrome, lang);
  });
  fs.writeFileSync(path.join(ROOT, "floqr-i18n.js"), chrome);
}

const HELP_KNOWS = {
  en: {title: "What BOT DEE knows of me", body: "Facts BOT DEE stored with your approval live in Feature & Orders → My BOT DEE. The list is empty if memory is off or nothing is stored. Export or delete facts here. BOT DEE never stores your IP address. Mingl chats are not copied."},
  fr: {title: "Ce que BOT DEE sait de moi", body: "Les faits enregistrés avec votre accord se trouvent dans Fonctionnalités et commandes → Mon BOT DEE. La liste est vide si la mémoire est désactivée ou vide. Exportez ou supprimez ici. BOT DEE n’enregistre jamais votre adresse IP. Mingl n’est pas copié."},
  de: {title: "Was BOT DEE von mir weiß", body: "Mit Ihrer Zustimmung gespeicherte Fakten liegen unter Funktionen & Bestellungen → Mein BOT DEE. Die Liste ist leer, wenn die Erinnerung aus ist oder nichts gespeichert ist. Export oder Löschung hier. BOT DEE speichert keine IP-Adresse. Mingl wird nicht kopiert."},
  es: {title: "Lo que BOT DEE sabe de mí", body: "Los hechos guardados con su consentimiento están en Funciones y pedidos → Mi BOT DEE. La lista está vacía si la memoria está apagada o no hay datos. Exporte o borre aquí. BOT DEE nunca guarda su dirección IP. Mingl no se copia."},
  nl: {title: "Wat BOT DEE van mij weet", body: "Feiten met uw toestemming staan onder Functies & bestellingen → Mijn BOT DEE. De lijst is leeg als geheugen uit staat of er niets is opgeslagen. Exporteer of wis hier. BOT DEE slaat geen IP-adres op. Mingl wordt niet gekopieerd."},
  ru: {title: "Что BOT DEE знает обо мне", body: "Факты с вашего согласия — в разделе Функции и заказы → Мой BOT DEE. Список пуст, если память выключена или фактов нет. Экспорт или удаление здесь. BOT DEE не сохраняет IP. Mingl не копируется."},
  it: {title: "Cosa BOT DEE sa di me", body: "I fatti salvati con il tuo consenso sono in Funzioni e ordini → Il mio BOT DEE. L’elenco è vuoto se la memoria è spenta o non c’è nulla. Esporta o elimina qui. BOT DEE non memorizza l’IP. Mingl non viene copiato."},
  pt: {title: "O que o BOT DEE sabe de mim", body: "Factos guardados com a sua aprovação estão em Funcionalidades e encomendas → O meu BOT DEE. A lista fica vazia se a memória estiver desligada ou não houver dados. Exporte ou apague aqui. O BOT DEE não guarda IP. Mingl não é copiado."},
  el: {title: "Τι γνωρίζει το BOT DEE για μένα", body: "Τα γεγονότα με την έγκρισή σας βρίσκονται σε Λειτουργίες & παραγγελίες → Το BOT DEE μου. Η λίστα είναι κενή αν η μνήμη είναι off ή δεν υπάρχουν δεδομένα. Εξαγωγή ή διαγραφή εδώ. Το BOT DEE δεν αποθηκεύει IP. Το Mingl δεν αντιγράφεται."},
  pl: {title: "Co BOT DEE wie o mnie", body: "Fakty zapisane za zgodą są w Funkcje i zamówienia → Mój BOT DEE. Lista jest pusta, gdy pamięć jest wyłączona lub brak danych. Eksport lub usuń tutaj. BOT DEE nie zapisuje IP. Mingl nie jest kopiowany."},
  ar: {title: "ما يعرفه BOT DEE عني", body: "الحقائق المحفوظة بموافقتك في الميزات والطلبات → BOT DEE الخاص بي. القائمة فارغة إذا كانت الذاكرة مغلقة أو لا توجد بيانات. صدّر أو احذف هنا. لا يخزّن BOT DEE عنوان IP. لا يُنسخ Mingl."}
};

const MEMORY_BODY = {
  en: "Open Feature & Orders → My BOT DEE to save chats after the pause, export, or delete history. The five-minute pause ends the live BOT DEE session. If you opt in, BOT DEE keeps that chat so you can come back later. Guests are not saved. Mingl conversations stay in Mingl.",
  fr: "Ouvrez Fonctionnalités et commandes → Mon BOT DEE pour enregistrer les chats après la pause, exporter ou supprimer l’historique. La pause de cinq minutes termine la session en direct. Si vous acceptez, BOT DEE conserve le chat. Les invités ne sont pas enregistrés. Mingl reste dans Mingl.",
  de: "Öffnen Sie Funktionen & Bestellungen → Mein BOT DEE, um Chats nach der Pause zu speichern, zu exportieren oder den Verlauf zu löschen. Die 5-Minuten-Pause beendet die Live-Sitzung. Mit Opt-in behält BOT DEE den Chat. Gäste werden nicht gespeichert. Mingl bleibt Mingl.",
  es: "Abra Funciones y pedidos → Mi BOT DEE para guardar chats tras la pausa, exportar o borrar historial. La pausa de cinco minutos termina la sesión en vivo. Si acepta, BOT DEE guarda el chat. Los invitados no se guardan. Mingl se queda en Mingl.",
  nl: "Open Functies & bestellingen → Mijn BOT DEE om chats na de pauze op te slaan, te exporteren of geschiedenis te wissen. De pauze van vijf minuten beëindigt de live sessie. Met opt-in bewaart BOT DEE de chat. Gasten worden niet bewaard. Mingl blijft Mingl.",
  ru: "Откройте Функции и заказы → Мой BOT DEE, чтобы сохранять чаты после паузы, экспортировать или удалять историю. Пятиминутная пауза завершает живую сессию. При согласии BOT DEE сохраняет чат. Гости не сохраняются. Mingl остаётся в Mingl.",
  it: "Apri Funzioni e ordini → Il mio BOT DEE per salvare le chat dopo la pausa, esportare o eliminare la cronologia. La pausa di cinque minuti chiude la sessione dal vivo. Con opt-in BOT DEE tiene la chat. Gli ospiti non vengono salvati. Mingl resta in Mingl.",
  pt: "Abra Funcionalidades e encomendas → O meu BOT DEE para guardar chats após a pausa, exportar ou apagar histórico. A pausa de cinco minutos termina a sessão ao vivo. Se aderir, o BOT DEE guarda o chat. Convidados não são guardados. Mingl fica no Mingl.",
  el: "Ανοίξτε Λειτουργίες & παραγγελίες → Το BOT DEE μου για αποθήκευση μετά την παύση, εξαγωγή ή διαγραφή ιστορικού. Η παύση πέντε λεπτών κλείνει τη ζωντανή συνεδρία. Με opt-in το BOT DEE κρατά τη συνομιλία. Οι επισκέπτες δεν αποθηκεύονται. Το Mingl μένει στο Mingl.",
  pl: "Otwórz Funkcje i zamówienia → Mój BOT DEE, aby zapisywać czaty po pauzie, eksportować lub usuwać historię. Pięciominutowa pauza kończy sesję na żywo. Po zgodzie BOT DEE zachowuje czat. Goście nie są zapisywani. Mingl zostaje w Mingl.",
  ar: "افتح الميزات والطلبات → BOT DEE الخاص بي لحفظ المحادثات بعد التوقف أو التصدير أو الحذف. توقف الخمس دقائق ينهي الجلسة المباشرة. إذا وافقت، يحتفظ BOT DEE بالمحادثة. لا يُحفظ الضيوف. يبقى Mingl في Mingl."
};

if (!process.env.FLOQR_SKIP_HELP_JSON) {
["en", ...CHROME_ORDER.filter(l => l !== "en")].forEach(lang => {
  const file = path.join(ROOT, "scripts", `_help-${lang}.json`);
  const pack = JSON.parse(fs.readFileSync(file, "utf8"));
  pack["help-botdee-knows-of-me"] = HELP_KNOWS[lang];
  if (pack["help-botdee-memory"]) pack["help-botdee-memory"].body = MEMORY_BODY[lang];
  fs.writeFileSync(file, JSON.stringify(pack, null, 2) + "\n");
});
}

function patchHelpJs() {
  const HELP_JS = path.join(ROOT, "floqr-i18n-help.js");
  let src = fs.readFileSync(HELP_JS, "utf8");
  const locales = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
  locales.forEach((code, idx) => {
    const knows = HELP_KNOWS[code] || HELP_KNOWS.en;
    const memBody = MEMORY_BODY[code] || MEMORY_BODY.en;
    const locStart = src.indexOf(`    "${code}": {`);
    if (locStart < 0) throw new Error(`help pack ${code} not found`);
    const nextCode = locales[idx + 1];
    const locEnd = nextCode
      ? src.indexOf(`    "${nextCode}": {`, locStart)
      : src.indexOf("\n  };", locStart);
    let chunk = src.slice(locStart, locEnd);
    chunk = chunk.replace(
      /("help-botdee-memory": \{[\s\S]*?body: )[^\n]+/,
      `$1${q(memBody)}`
    );
    if (!chunk.includes("help-botdee-knows-of-me")) {
      const ins =
        `      "help-botdee-knows-of-me": {\n` +
        `        title: ${q(knows.title)},\n` +
        `        body: ${q(knows.body)}\n` +
        `      },\n`;
      chunk = chunk.replace(/(      "help-botdee-memory": \{[\s\S]*?\n      \},)\n/, `$1\n${ins}`);
    }
    src = src.slice(0, locStart) + chunk + src.slice(locEnd);
  });
  fs.writeFileSync(HELP_JS, src);
}

patchHelpJs();
console.log("Updated floqr-i18n.js, help JSON packs, and floqr-i18n-help.js");