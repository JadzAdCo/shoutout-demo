/**
 * One-shot: inject FloqR Inbox panel chrome keys into floqr-i18n.js CHROME packs.
 * Run: node scripts/patch-inbox-i18n.js
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "floqr-i18n.js");
let src = fs.readFileSync(file, "utf8");

const PACKS = {
  en: {
    "inbox.rulesTitle": "FloqR Inbox Rules",
    "inbox.policySystem": "System notifications are internal FloqR Inbox messages and use System Message as the sender.",
    "inbox.policyStore": "FloqR Inbox messages store sender, timestamp, subject, body, read state, and opened/read timestamps.",
    "inbox.policyPatronSupport": "Patrons can send internal support messages to Club Admins or club-designated Customer Service Representatives.",
    "inbox.policyPatronBlocked": "Patron-to-patron direct FloqR Inbox messages remain blocked unless the sender is an approved Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress, or Bottle Girl.",
    "inbox.policyRoles": "Your current approved role set:",
    "inbox.composeTitle": "Send FloqR Inbox Message",
    "inbox.composeNotePatron": "Patrons can message Club Admins and designated Customer Service Representatives here. Patron-to-patron conversations use Mingl Chat after both patrons Mingl back.",
    "inbox.composeNoteStaff": "Internal messaging is enabled for your approved role. Use patron-originated context before contacting a patron.",
    "inbox.recipientSearch": "Recipient Search",
    "inbox.recipientPlaceholder": "Search club admin, CSR, display name, or username",
    "inbox.subject": "Subject",
    "inbox.subjectPlaceholder": "Subject",
    "inbox.message": "Message",
    "inbox.messagePlaceholder": "Write your message...",
    "inbox.send": "Send Message",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat is separate from Inbox.",
    "inbox.chatPolicyMaster": "Master Admin is excluded from member Mingl Chat.",
    "inbox.chatPolicyMutual": "Patron-to-patron Mingl Chat requires both patrons to Mingl back.",
    "inbox.chatPolicyRole": "Role members cannot initiate Mingl Chat with patrons unless the thread is tied to a patron-originated action such as a payment, guest list request, ShoutOut purchase, reservation, or support question.",
    "inbox.chatPolicyRules": "Role-specific Mingl permissions must be enforced by Firestore rules or a server function before production launch."
  },
  de: {
    "inbox.rulesTitle": "FloqR Inbox-Regeln",
    "inbox.policySystem": "Systembenachrichtigungen sind interne FloqR Inbox-Nachrichten und verwenden System Message als Absender.",
    "inbox.policyStore": "FloqR Inbox-Nachrichten speichern Absender, Zeitstempel, Betreff, Text, Lesestatus sowie Öffnungs-/Lesezeiten.",
    "inbox.policyPatronSupport": "Patrons können interne Support-Nachrichten an Club Admins oder vom Club benannte Customer Service Representatives senden.",
    "inbox.policyPatronBlocked": "Direkte FloqR Inbox-Nachrichten von Patron zu Patron bleiben gesperrt, es sei denn, der Absender ist ein genehmigter Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress oder Bottle Girl.",
    "inbox.policyRoles": "Deine aktuell genehmigte Rollengruppe:",
    "inbox.composeTitle": "FloqR Inbox-Nachricht senden",
    "inbox.composeNotePatron": "Patrons können hier Club Admins und benannte Customer Service Representatives schreiben. Patron-zu-Patron-Gespräche laufen über Mingl Chat, nachdem beide zurück-Mingln.",
    "inbox.composeNoteStaff": "Interne Nachrichten sind für deine genehmigte Rolle aktiviert. Nutze einen patron-initiierten Kontext, bevor du einen Patron kontaktierst.",
    "inbox.recipientSearch": "Empfänger suchen",
    "inbox.recipientPlaceholder": "Club Admin, CSR, Anzeigename oder Benutzername suchen",
    "inbox.subject": "Betreff",
    "inbox.subjectPlaceholder": "Betreff",
    "inbox.message": "Nachricht",
    "inbox.messagePlaceholder": "Schreibe deine Nachricht...",
    "inbox.send": "Nachricht senden",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat ist getrennt von Inbox.",
    "inbox.chatPolicyMaster": "Master Admin ist vom Mitglieder-Mingl Chat ausgeschlossen.",
    "inbox.chatPolicyMutual": "Patron-zu-Patron Mingl Chat erfordert, dass beide zurück-Mingln.",
    "inbox.chatPolicyRole": "Rollenmitglieder dürfen Mingl Chat mit Patrons nur starten, wenn der Thread an eine patron-initiierte Aktion gebunden ist (Zahlung, Gästeliste, ShoutOut-Kauf, Reservierung oder Supportfrage).",
    "inbox.chatPolicyRules": "Rollenspezifische Mingl-Berechtigungen müssen vor dem Produktionsstart durch Firestore-Regeln oder eine Serverfunktion durchgesetzt werden."
  },
  fr: {
    "inbox.rulesTitle": "Règles FloqR Inbox",
    "inbox.policySystem": "Les notifications système sont des messages FloqR Inbox internes et utilisent System Message comme expéditeur.",
    "inbox.policyStore": "Les messages FloqR Inbox enregistrent l'expéditeur, l'horodatage, l'objet, le corps, l'état de lecture et les horodatages d'ouverture/lecture.",
    "inbox.policyPatronSupport": "Les patrons peuvent envoyer des messages d'assistance internes aux Club Admins ou aux Customer Service Representatives désignés par le club.",
    "inbox.policyPatronBlocked": "Les messages FloqR Inbox directs entre patrons restent bloqués sauf si l'expéditeur est un Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress ou Bottle Girl approuvé.",
    "inbox.policyRoles": "Votre ensemble de rôles approuvés actuel :",
    "inbox.composeTitle": "Envoyer un message FloqR Inbox",
    "inbox.composeNotePatron": "Les patrons peuvent écrire ici aux Club Admins et aux Customer Service Representatives désignés. Les conversations patron-à-patron utilisent Mingl Chat après un Mingl mutuel.",
    "inbox.composeNoteStaff": "La messagerie interne est activée pour votre rôle approuvé. Utilisez un contexte initié par un patron avant de contacter un patron.",
    "inbox.recipientSearch": "Recherche de destinataire",
    "inbox.recipientPlaceholder": "Rechercher club admin, CSR, nom d'affichage ou nom d'utilisateur",
    "inbox.subject": "Objet",
    "inbox.subjectPlaceholder": "Objet",
    "inbox.message": "Message",
    "inbox.messagePlaceholder": "Écrivez votre message...",
    "inbox.send": "Envoyer le message",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat est distinct de Inbox.",
    "inbox.chatPolicyMaster": "Master Admin est exclu du Mingl Chat des membres.",
    "inbox.chatPolicyMutual": "Le Mingl Chat patron-à-patron exige que les deux patrons Mingl en retour.",
    "inbox.chatPolicyRole": "Les membres de rôle ne peuvent pas démarrer Mingl Chat avec des patrons sauf si le fil est lié à une action initiée par un patron (paiement, guest list, achat ShoutOut, réservation ou support).",
    "inbox.chatPolicyRules": "Les permissions Mingl spécifiques aux rôles doivent être appliquées par des règles Firestore ou une fonction serveur avant la mise en production."
  },
  es: {
    "inbox.rulesTitle": "Reglas de FloqR Inbox",
    "inbox.policySystem": "Las notificaciones del sistema son mensajes internos de FloqR Inbox y usan System Message como remitente.",
    "inbox.policyStore": "Los mensajes de FloqR Inbox guardan remitente, marca de tiempo, asunto, cuerpo, estado de lectura y marcas de apertura/lectura.",
    "inbox.policyPatronSupport": "Los patrons pueden enviar mensajes internos de soporte a Club Admins o Customer Service Representatives designados por el club.",
    "inbox.policyPatronBlocked": "Los mensajes directos de FloqR Inbox entre patrons siguen bloqueados salvo que el remitente sea un Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress o Bottle Girl aprobado.",
    "inbox.policyRoles": "Tu conjunto de roles aprobados actual:",
    "inbox.composeTitle": "Enviar mensaje de FloqR Inbox",
    "inbox.composeNotePatron": "Los patrons pueden escribir aquí a Club Admins y Customer Service Representatives designados. Las conversaciones patron-a-patron usan Mingl Chat tras Mingl mutuo.",
    "inbox.composeNoteStaff": "La mensajería interna está habilitada para tu rol aprobado. Usa un contexto iniciado por un patron antes de contactar a un patron.",
    "inbox.recipientSearch": "Buscar destinatario",
    "inbox.recipientPlaceholder": "Buscar club admin, CSR, nombre visible o usuario",
    "inbox.subject": "Asunto",
    "inbox.subjectPlaceholder": "Asunto",
    "inbox.message": "Mensaje",
    "inbox.messagePlaceholder": "Escribe tu mensaje...",
    "inbox.send": "Enviar mensaje",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat es independiente de Inbox.",
    "inbox.chatPolicyMaster": "Master Admin queda excluido del Mingl Chat de miembros.",
    "inbox.chatPolicyMutual": "Mingl Chat entre patrons requiere que ambos hagan Mingl de vuelta.",
    "inbox.chatPolicyRole": "Los miembros con rol no pueden iniciar Mingl Chat con patrons salvo que el hilo esté ligado a una acción iniciada por un patron (pago, lista de invitados, compra ShoutOut, reserva o soporte).",
    "inbox.chatPolicyRules": "Los permisos Mingl por rol deben aplicarse con reglas de Firestore o una función de servidor antes del lanzamiento a producción."
  },
  it: {
    "inbox.rulesTitle": "Regole FloqR Inbox",
    "inbox.policySystem": "Le notifiche di sistema sono messaggi interni FloqR Inbox e usano System Message come mittente.",
    "inbox.policyStore": "I messaggi FloqR Inbox memorizzano mittente, timestamp, oggetto, corpo, stato di lettura e timestamp di apertura/lettura.",
    "inbox.policyPatronSupport": "I patron possono inviare messaggi di supporto interni a Club Admin o Customer Service Representative designati dal club.",
    "inbox.policyPatronBlocked": "I messaggi FloqR Inbox diretti tra patron restano bloccati salvo che il mittente sia un Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress o Bottle Girl approvato.",
    "inbox.policyRoles": "Il tuo set di ruoli approvati attuale:",
    "inbox.composeTitle": "Invia messaggio FloqR Inbox",
    "inbox.composeNotePatron": "I patron possono scrivere qui a Club Admin e Customer Service Representative designati. Le conversazioni patron-a-patron usano Mingl Chat dopo il Mingl reciproco.",
    "inbox.composeNoteStaff": "La messaggistica interna è attiva per il tuo ruolo approvato. Usa un contesto avviato dal patron prima di contattare un patron.",
    "inbox.recipientSearch": "Cerca destinatario",
    "inbox.recipientPlaceholder": "Cerca club admin, CSR, nome visualizzato o username",
    "inbox.subject": "Oggetto",
    "inbox.subjectPlaceholder": "Oggetto",
    "inbox.message": "Messaggio",
    "inbox.messagePlaceholder": "Scrivi il tuo messaggio...",
    "inbox.send": "Invia messaggio",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat è separato da Inbox.",
    "inbox.chatPolicyMaster": "Master Admin è escluso dal Mingl Chat dei membri.",
    "inbox.chatPolicyMutual": "Il Mingl Chat tra patron richiede che entrambi rispondano con Mingl.",
    "inbox.chatPolicyRole": "I membri con ruolo non possono avviare Mingl Chat con i patron a meno che il thread non sia legato a un'azione avviata dal patron (pagamento, guest list, acquisto ShoutOut, prenotazione o supporto).",
    "inbox.chatPolicyRules": "I permessi Mingl specifici del ruolo devono essere applicati da regole Firestore o da una funzione server prima del lancio in produzione."
  },
  pt: {
    "inbox.rulesTitle": "Regras do FloqR Inbox",
    "inbox.policySystem": "As notificações do sistema são mensagens internas do FloqR Inbox e usam System Message como remetente.",
    "inbox.policyStore": "As mensagens do FloqR Inbox armazenam remetente, carimbo de data/hora, assunto, corpo, estado de leitura e horários de abertura/leitura.",
    "inbox.policyPatronSupport": "Patrons podem enviar mensagens internas de suporte a Club Admins ou Customer Service Representatives designados pelo clube.",
    "inbox.policyPatronBlocked": "Mensagens diretas FloqR Inbox de patron para patron permanecem bloqueadas, salvo se o remetente for Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress ou Bottle Girl aprovado.",
    "inbox.policyRoles": "Seu conjunto atual de funções aprovadas:",
    "inbox.composeTitle": "Enviar mensagem FloqR Inbox",
    "inbox.composeNotePatron": "Patrons podem escrever aqui para Club Admins e Customer Service Representatives designados. Conversas patron-a-patron usam Mingl Chat após Mingl mútuo.",
    "inbox.composeNoteStaff": "A mensagens internas estão ativadas para sua função aprovada. Use um contexto iniciado pelo patron antes de contatar um patron.",
    "inbox.recipientSearch": "Buscar destinatário",
    "inbox.recipientPlaceholder": "Buscar club admin, CSR, nome de exibição ou usuário",
    "inbox.subject": "Assunto",
    "inbox.subjectPlaceholder": "Assunto",
    "inbox.message": "Mensagem",
    "inbox.messagePlaceholder": "Escreva sua mensagem...",
    "inbox.send": "Enviar mensagem",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat é separado do Inbox.",
    "inbox.chatPolicyMaster": "Master Admin fica excluído do Mingl Chat de membros.",
    "inbox.chatPolicyMutual": "Mingl Chat entre patrons exige que ambos façam Mingl de volta.",
    "inbox.chatPolicyRole": "Membros com função não podem iniciar Mingl Chat com patrons a menos que o fio esteja ligado a uma ação iniciada pelo patron (pagamento, lista de convidados, compra ShoutOut, reserva ou suporte).",
    "inbox.chatPolicyRules": "Permissões Mingl específicas de função devem ser aplicadas por regras Firestore ou uma função de servidor antes do lançamento em produção."
  },
  ru: {
    "inbox.rulesTitle": "Правила FloqR Inbox",
    "inbox.policySystem": "Системные уведомления — внутренние сообщения FloqR Inbox с отправителем System Message.",
    "inbox.policyStore": "Сообщения FloqR Inbox хранят отправителя, время, тему, текст, статус прочтения и метки открытия/чтения.",
    "inbox.policyPatronSupport": "Patrons могут отправлять внутренние сообщения поддержки Club Admins или назначенным Customer Service Representatives клуба.",
    "inbox.policyPatronBlocked": "Прямые сообщения FloqR Inbox между patrons остаются заблокированы, если отправитель не одобренный Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress или Bottle Girl.",
    "inbox.policyRoles": "Ваш текущий набор одобренных ролей:",
    "inbox.composeTitle": "Отправить сообщение FloqR Inbox",
    "inbox.composeNotePatron": "Patrons могут писать здесь Club Admins и назначенным Customer Service Representatives. Переписки patron–patron идут через Mingl Chat после взаимного Mingl.",
    "inbox.composeNoteStaff": "Внутренние сообщения включены для вашей одобренной роли. Используйте контекст, инициированный patron, прежде чем писать patron.",
    "inbox.recipientSearch": "Поиск получателя",
    "inbox.recipientPlaceholder": "Искать club admin, CSR, отображаемое имя или username",
    "inbox.subject": "Тема",
    "inbox.subjectPlaceholder": "Тема",
    "inbox.message": "Сообщение",
    "inbox.messagePlaceholder": "Напишите сообщение...",
    "inbox.send": "Отправить сообщение",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat отделён от Inbox.",
    "inbox.chatPolicyMaster": "Master Admin исключён из Mingl Chat участников.",
    "inbox.chatPolicyMutual": "Mingl Chat между patrons требует взаимного Mingl.",
    "inbox.chatPolicyRole": "Участники с ролью не могут начинать Mingl Chat с patrons, если тред не связан с действием patron (оплата, гостевой список, покупка ShoutOut, бронь или поддержка).",
    "inbox.chatPolicyRules": "Права Mingl по ролям должны обеспечиваться правилами Firestore или серверной функцией до запуска в продакшен."
  },
  el: {
    "inbox.rulesTitle": "Κανόνες FloqR Inbox",
    "inbox.policySystem": "Οι ειδοποιήσεις συστήματος είναι εσωτερικά μηνύματα FloqR Inbox και χρησιμοποιούν System Message ως αποστολέα.",
    "inbox.policyStore": "Τα μηνύματα FloqR Inbox αποθηκεύουν αποστολέα, χρονική σήμανση, θέμα, σώμα, κατάσταση ανάγνωσης και χρονικές σημάνσεις ανοίγματος/ανάγνωσης.",
    "inbox.policyPatronSupport": "Οι patrons μπορούν να στέλνουν εσωτερικά μηνύματα υποστήριξης σε Club Admins ή Customer Service Representatives που ορίζει το club.",
    "inbox.policyPatronBlocked": "Τα άμεσα μηνύματα FloqR Inbox μεταξύ patrons παραμένουν αποκλεισμένα εκτός αν ο αποστολέας είναι εγκεκριμένος Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress ή Bottle Girl.",
    "inbox.policyRoles": "Το τρέχον εγκεκριμένο σύνολο ρόλων σας:",
    "inbox.composeTitle": "Αποστολή μηνύματος FloqR Inbox",
    "inbox.composeNotePatron": "Οι patrons μπορούν να γράφουν εδώ σε Club Admins και ορισμένους Customer Service Representatives. Οι συνομιλίες patron-προς-patron χρησιμοποιούν Mingl Chat μετά από αμοιβαίο Mingl.",
    "inbox.composeNoteStaff": "Η εσωτερική ανταλλαγή μηνυμάτων είναι ενεργή για τον εγκεκριμένο ρόλο σας. Χρησιμοποιήστε πλαίσιο που ξεκίνησε από patron πριν επικοινωνήσετε με patron.",
    "inbox.recipientSearch": "Αναζήτηση παραλήπτη",
    "inbox.recipientPlaceholder": "Αναζήτηση club admin, CSR, εμφανιζόμενου ονόματος ή username",
    "inbox.subject": "Θέμα",
    "inbox.subjectPlaceholder": "Θέμα",
    "inbox.message": "Μήνυμα",
    "inbox.messagePlaceholder": "Γράψτε το μήνυμά σας...",
    "inbox.send": "Αποστολή μηνύματος",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Το Mingl Chat είναι ξεχωριστό από το Inbox.",
    "inbox.chatPolicyMaster": "Ο Master Admin αποκλείεται από το Mingl Chat μελών.",
    "inbox.chatPolicyMutual": "Το Mingl Chat μεταξύ patrons απαιτεί αμοιβαίο Mingl.",
    "inbox.chatPolicyRole": "Μέλη με ρόλο δεν μπορούν να ξεκινήσουν Mingl Chat με patrons εκτός αν το νήμα συνδέεται με ενέργεια από patron (πληρωμή, λίστα επισκεπτών, αγορά ShoutOut, κράτηση ή υποστήριξη).",
    "inbox.chatPolicyRules": "Τα δικαιώματα Mingl ανά ρόλο πρέπει να εφαρμόζονται με κανόνες Firestore ή συνάρτηση διακομιστή πριν την παραγωγή."
  },
  pl: {
    "inbox.rulesTitle": "Zasady FloqR Inbox",
    "inbox.policySystem": "Powiadomienia systemowe to wewnętrzne wiadomości FloqR Inbox i używają System Message jako nadawcy.",
    "inbox.policyStore": "Wiadomości FloqR Inbox przechowują nadawcę, znacznik czasu, temat, treść, status odczytu oraz znaczniki otwarcia/odczytu.",
    "inbox.policyPatronSupport": "Patrons mogą wysyłać wewnętrzne wiadomości wsparcia do Club Admins lub wyznaczonych przez klub Customer Service Representatives.",
    "inbox.policyPatronBlocked": "Bezpośrednie wiadomości FloqR Inbox między patrons pozostają zablokowane, chyba że nadawca to zatwierdzony Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress lub Bottle Girl.",
    "inbox.policyRoles": "Twój aktualny zestaw zatwierdzonych ról:",
    "inbox.composeTitle": "Wyślij wiadomość FloqR Inbox",
    "inbox.composeNotePatron": "Patrons mogą pisać tutaj do Club Admins i wyznaczonych Customer Service Representatives. Rozmowy patron-do-patron używają Mingl Chat po wzajemnym Mingl.",
    "inbox.composeNoteStaff": "Wiadomości wewnętrzne są włączone dla Twojej zatwierdzonej roli. Użyj kontekstu zainicjowanego przez patrona przed kontaktem z patronem.",
    "inbox.recipientSearch": "Szukaj odbiorcy",
    "inbox.recipientPlaceholder": "Szukaj club admin, CSR, nazwy wyświetlanej lub użytkownika",
    "inbox.subject": "Temat",
    "inbox.subjectPlaceholder": "Temat",
    "inbox.message": "Wiadomość",
    "inbox.messagePlaceholder": "Napisz wiadomość...",
    "inbox.send": "Wyślij wiadomość",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat jest oddzielony od Inbox.",
    "inbox.chatPolicyMaster": "Master Admin jest wykluczony z Mingl Chat członków.",
    "inbox.chatPolicyMutual": "Mingl Chat między patrons wymaga wzajemnego Mingl.",
    "inbox.chatPolicyRole": "Członkowie z rolą nie mogą rozpoczynać Mingl Chat z patrons, chyba że wątek jest powiązany z działaniem zainicjowanym przez patrona (płatność, lista gości, zakup ShoutOut, rezerwacja lub wsparcie).",
    "inbox.chatPolicyRules": "Uprawnienia Mingl według ról muszą być egzekwowane przez reguły Firestore lub funkcję serwerową przed uruchomieniem produkcyjnym."
  },
  nl: {
    "inbox.rulesTitle": "FloqR Inbox-regels",
    "inbox.policySystem": "Systeemmeldingen zijn interne FloqR Inbox-berichten en gebruiken System Message als afzender.",
    "inbox.policyStore": "FloqR Inbox-berichten slaan afzender, tijdstempel, onderwerp, inhoud, leesstatus en open-/leestijdstempels op.",
    "inbox.policyPatronSupport": "Patrons kunnen interne supportberichten sturen naar Club Admins of door de club aangewezen Customer Service Representatives.",
    "inbox.policyPatronBlocked": "Directe FloqR Inbox-berichten van patron naar patron blijven geblokkeerd tenzij de afzender een goedgekeurde Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress of Bottle Girl is.",
    "inbox.policyRoles": "Je huidige goedgekeurde rollenset:",
    "inbox.composeTitle": "FloqR Inbox-bericht versturen",
    "inbox.composeNotePatron": "Patrons kunnen hier Club Admins en aangewezen Customer Service Representatives berichten. Patron-naar-patron gesprekken gebruiken Mingl Chat na wederzijds Mingl.",
    "inbox.composeNoteStaff": "Interne berichten zijn ingeschakeld voor je goedgekeurde rol. Gebruik een door een patron gestarte context voordat je een patron contacteert.",
    "inbox.recipientSearch": "Ontvanger zoeken",
    "inbox.recipientPlaceholder": "Zoek club admin, CSR, weergavenaam of gebruikersnaam",
    "inbox.subject": "Onderwerp",
    "inbox.subjectPlaceholder": "Onderwerp",
    "inbox.message": "Bericht",
    "inbox.messagePlaceholder": "Schrijf je bericht...",
    "inbox.send": "Bericht versturen",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat is gescheiden van Inbox.",
    "inbox.chatPolicyMaster": "Master Admin is uitgesloten van leden-Mingl Chat.",
    "inbox.chatPolicyMutual": "Mingl Chat tussen patrons vereist wederzijds Mingl.",
    "inbox.chatPolicyRole": "Rolleden mogen Mingl Chat met patrons alleen starten als de thread gekoppeld is aan een door een patron gestarte actie (betaling, gastenlijst, ShoutOut-aankoop, reservering of support).",
    "inbox.chatPolicyRules": "Rolgebaseerde Mingl-rechten moeten vóór productie worden afgedwongen via Firestore-regels of een serverfunctie."
  },
  ar: {
    "inbox.rulesTitle": "قواعد FloqR Inbox",
    "inbox.policySystem": "إشعارات النظام رسائل FloqR Inbox داخلية وتستخدم System Message كمرسل.",
    "inbox.policyStore": "تحفظ رسائل FloqR Inbox المرسل والطابع الزمني والموضوع والنص وحالة القراءة وأوقات الفتح/القراءة.",
    "inbox.policyPatronSupport": "يمكن للـ patrons إرسال رسائل دعم داخلية إلى Club Admins أو Customer Service Representatives المعيّنين من النادي.",
    "inbox.policyPatronBlocked": "تبقى رسائل FloqR Inbox المباشرة بين patrons محظورة ما لم يكن المرسل Master Admin أو Club Admin أو Promoter أو DJ أو Waiter أو Waitress أو Bottle Girl معتمدًا.",
    "inbox.policyRoles": "مجموعة أدوارك المعتمدة الحالية:",
    "inbox.composeTitle": "إرسال رسالة FloqR Inbox",
    "inbox.composeNotePatron": "يمكن للـ patrons مراسلة Club Admins وممثلي خدمة العملاء المعيّنين هنا. محادثات patron-إلى-patron تستخدم Mingl Chat بعد Mingl متبادل.",
    "inbox.composeNoteStaff": "الرسائل الداخلية مفعّلة لدورك المعتمد. استخدم سياقًا بدأه patron قبل التواصل مع patron.",
    "inbox.recipientSearch": "البحث عن مستلم",
    "inbox.recipientPlaceholder": "ابحث عن club admin أو CSR أو الاسم المعروض أو اسم المستخدم",
    "inbox.subject": "الموضوع",
    "inbox.subjectPlaceholder": "الموضوع",
    "inbox.message": "الرسالة",
    "inbox.messagePlaceholder": "اكتب رسالتك...",
    "inbox.send": "إرسال الرسالة",
    "inbox.listTitle": "FloqR Inbox",
    "inbox.chatPolicySeparate": "Mingl Chat منفصل عن Inbox.",
    "inbox.chatPolicyMaster": "Master Admin مستبعد من Mingl Chat للأعضاء.",
    "inbox.chatPolicyMutual": "Mingl Chat بين patrons يتطلب Mingl متبادلًا.",
    "inbox.chatPolicyRole": "أعضاء الأدوار لا يمكنهم بدء Mingl Chat مع patrons إلا إذا كان الخيط مرتبطًا بإجراء بدأه patron (دفع أو قائمة ضيوف أو شراء ShoutOut أو حجز أو دعم).",
    "inbox.chatPolicyRules": "يجب فرض صلاحيات Mingl حسب الدور عبر قواعد Firestore أو دالة خادم قبل الإطلاق الإنتاجي."
  }
};

function escapeJs(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function blockFor(pack) {
  return Object.entries(pack)
    .map(([k, v]) => `      "${k}": "${escapeJs(v)}",`)
    .join("\n");
}

const chromeStart = src.indexOf("const CHROME = {");
if (chromeStart < 0) {
  console.error("CHROME block not found");
  process.exit(1);
}
const before = src.slice(0, chromeStart);
let chromeAndAfter = src.slice(chromeStart);

// Strip prior inbox keys inside CHROME only
chromeAndAfter = chromeAndAfter.replace(/\n\s*"inbox\.[^"]+": "(?:\\.|[^"\\])*",?/g, "");

const langs = Object.keys(PACKS);
for (const lang of langs) {
  const re = new RegExp(`(    ${lang}: \\{[\\s\\S]*?"nav\\.inbox": "(?:\\\\.|[^"\\\\])*",)`);
  if (!re.test(chromeAndAfter)) {
    console.error("Could not find nav.inbox anchor for", lang);
    process.exit(1);
  }
  chromeAndAfter = chromeAndAfter.replace(re, `$1\n${blockFor(PACKS[lang])}`);
}

src = before + chromeAndAfter;
src = src.replace(/const VERSION = "s3\.0\.\d+"/, 'const VERSION = "s3.0.29"');

fs.writeFileSync(file, src);
console.log("Patched inbox keys for", langs.join(", "));
