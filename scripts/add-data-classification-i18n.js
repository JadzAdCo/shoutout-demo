#!/usr/bin/env node
/* Data classification (Master Admin → Security) + FloqAi access-check status — chrome keys in all 11 packs.
   Reads floqr-i18n.js fresh and writes it immediately (other agents may edit the same file). */
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "floqr-i18n.js");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

const KEYS = [
  "master.securityDataClassification", "dataClass.title", "dataClass.intro", "dataClass.systemNote", "dataClass.auditNote",
  "dataClass.reason", "dataClass.filter", "dataClass.reload", "dataClass.seed", "dataClass.exportCsv",
  "dataClass.colCollection", "dataClass.colLevel", "dataClass.colPublic", "dataClass.colPatron", "dataClass.colRegular",
  "dataClass.colPrivileged", "dataClass.colClubAdmin", "dataClass.colMaster", "dataClass.colSystem", "dataClass.colOwn",
  "dataClass.colPii", "dataClass.colRetention", "dataClass.colRules", "dataClass.save", "dataClass.notSaved",
  "dataClass.fieldsTitle", "dataClass.fieldsIntro", "dataClass.simTitle", "dataClass.simIntro", "dataClass.simRole",
  "dataClass.simSameClub", "dataClass.simOwn", "dataClass.exposureTitle", "dataClass.exposureIntro", "dataClass.exposureRun",
  "dataClass.exposureNone", "dataClass.kindReadBroader", "dataClass.kindWriteOpen", "dataClass.severityHigh", "dataClass.severityMedium",
  "dataClass.unlock", "dataClass.loading", "dataClass.saved", "dataClass.level.public", "dataClass.level.internal",
  "dataClass.level.clubConfidential", "dataClass.level.restricted", "dataClass.level.secret", "dataClass.role.anonymous", "dataClass.role.system",
  "dataClass.access.yes", "dataClass.access.own", "dataClass.access.no", "dataClass.retentionHint",
  "floqai.checkingAccess", "floqai.scopePublic"
];

const T = {
  en: [
    "Data classification", "Data classification",
    "Each row is a Firestore collection. Tick who may read it. Higher tiers include lower ones, and Master Admins can read anything anyone else can. Turn every switch off to make a collection Secret.",
    "System is the FLOQR server. It can read every collection, but only from server code, for a stated job, and it never gives a person more than their own tier allows. It cannot be switched off here.",
    "Every change needs SOS2FA and a reason, and is written to the tamper-evident audit trail on Features & Services.",
    "Reason for change (required, 8+ characters)", "Filter collections", "Reload", "Save missing rows", "Export CSV",
    "Collection", "Level", "Public", "Patron", "Regular employee",
    "Privileged employee", "Club Admin", "Master Admin", "System", "Own record",
    "Personal data", "Keep (days)", "Rules today (read / write)", "Save", "Packaged default (not saved yet)",
    "Sensitive fields", "These fields are stricter than the rest of their collection. They change only with a release.",
    "Who can read what", "Pick a role to see what it may read.", "Role",
    "Record belongs to their club", "Reading their own record", "Exposure report",
    "Compares this register with the live security rules and lists collections that more people can read or write than the register allows.",
    "Run exposure report",
    "No collection is more open than its classification.", "More people can read it than allowed", "Any signed-in account can write it", "High", "Medium",
    "Unlock with SOS2FA to manage data classification.", "Loading…", "Saved.", "Public", "Internal",
    "Club confidential", "Restricted", "Secret", "Signed out", "System (server only)",
    "Yes", "Own only", "No", "0 = keep until deleted",
    "Checking what your account can see…", "Showing public answers. Sign in to see answers for your account."
  ],
  fr: [
    "Classification des données", "Classification des données",
    "Chaque ligne est une collection Firestore. Cochez qui peut la lire. Les niveaux supérieurs incluent les inférieurs, et les Master Admins peuvent lire tout ce que les autres peuvent lire. Désactivez tous les interrupteurs pour rendre une collection Secrète.",
    "System est le serveur FLOQR. Il peut lire toutes les collections, mais uniquement depuis le code serveur, pour une tâche déclarée, et ne donne jamais à une personne plus que ce que son propre niveau autorise. Il ne peut pas être désactivé ici.",
    "Chaque modification exige SOS2FA et un motif, et est inscrite dans le journal d’audit inviolable de Features & Services.",
    "Motif de la modification (obligatoire, 8 caractères ou plus)", "Filtrer les collections", "Recharger", "Enregistrer les lignes manquantes", "Exporter en CSV",
    "Collection", "Niveau", "Public", "Client", "Employé standard",
    "Employé privilégié", "Club Admin", "Master Admin", "System", "Sa propre fiche",
    "Données personnelles", "Conserver (jours)", "Règles actuelles (lecture / écriture)", "Enregistrer", "Valeur par défaut (pas encore enregistrée)",
    "Champs sensibles", "Ces champs sont plus stricts que le reste de leur collection. Ils ne changent qu’avec une nouvelle version.",
    "Qui peut lire quoi", "Choisissez un rôle pour voir ce qu’il peut lire.", "Rôle",
    "La fiche appartient à son club", "Lecture de sa propre fiche", "Rapport d’exposition",
    "Compare ce registre avec les règles de sécurité en ligne et liste les collections que plus de personnes peuvent lire ou modifier que le registre ne l’autorise.",
    "Lancer le rapport d’exposition",
    "Aucune collection n’est plus ouverte que sa classification.", "Plus de personnes peuvent la lire que prévu", "Tout compte connecté peut la modifier", "Élevée", "Moyenne",
    "Déverrouillez avec SOS2FA pour gérer la classification des données.", "Chargement…", "Enregistré.", "Public", "Interne",
    "Confidentiel club", "Restreint", "Secret", "Déconnecté", "System (serveur uniquement)",
    "Oui", "Sa fiche uniquement", "Non", "0 = conserver jusqu’à suppression",
    "Vérification de ce que votre compte peut voir…", "Réponses publiques affichées. Connectez-vous pour voir les réponses de votre compte."
  ],
  de: [
    "Datenklassifizierung", "Datenklassifizierung",
    "Jede Zeile ist eine Firestore-Sammlung. Hake an, wer sie lesen darf. Höhere Stufen schließen niedrigere ein, und Master Admins können alles lesen, was andere lesen können. Schalte alle Schalter aus, um eine Sammlung geheim zu machen.",
    "System ist der FLOQR-Server. Er kann jede Sammlung lesen, aber nur aus Servercode, für eine benannte Aufgabe, und gibt einer Person nie mehr, als ihre eigene Stufe erlaubt. Er lässt sich hier nicht abschalten.",
    "Jede Änderung braucht SOS2FA und eine Begründung und wird im manipulationssicheren Prüfprotokoll unter Features & Services gespeichert.",
    "Grund der Änderung (Pflicht, mindestens 8 Zeichen)", "Sammlungen filtern", "Neu laden", "Fehlende Zeilen speichern", "Als CSV exportieren",
    "Sammlung", "Stufe", "Öffentlich", "Gast", "Reguläre Mitarbeitende",
    "Privilegierte Mitarbeitende", "Club Admin", "Master Admin", "System", "Eigener Datensatz",
    "Personenbezogene Daten", "Aufbewahren (Tage)", "Regeln heute (lesen / schreiben)", "Speichern", "Standardwert (noch nicht gespeichert)",
    "Sensible Felder", "Diese Felder sind strenger als der Rest ihrer Sammlung. Sie ändern sich nur mit einem Release.",
    "Wer darf was lesen", "Wähle eine Rolle, um zu sehen, was sie lesen darf.", "Rolle",
    "Datensatz gehört zu ihrem Club", "Liest den eigenen Datensatz", "Offenlegungsbericht",
    "Vergleicht dieses Register mit den aktiven Sicherheitsregeln und listet Sammlungen, die mehr Personen lesen oder schreiben können, als das Register erlaubt.",
    "Offenlegungsbericht starten",
    "Keine Sammlung ist offener als ihre Klassifizierung.", "Mehr Personen können sie lesen als erlaubt", "Jedes angemeldete Konto kann sie schreiben", "Hoch", "Mittel",
    "Mit SOS2FA entsperren, um die Datenklassifizierung zu verwalten.", "Wird geladen…", "Gespeichert.", "Öffentlich", "Intern",
    "Club-vertraulich", "Eingeschränkt", "Geheim", "Abgemeldet", "System (nur Server)",
    "Ja", "Nur eigener", "Nein", "0 = aufbewahren bis zur Löschung",
    "Prüfe, was dein Konto sehen darf…", "Öffentliche Antworten werden angezeigt. Melde dich an, um Antworten für dein Konto zu sehen."
  ],
  es: [
    "Clasificación de datos", "Clasificación de datos",
    "Cada fila es una colección de Firestore. Marca quién puede leerla. Los niveles superiores incluyen a los inferiores, y los Master Admins pueden leer todo lo que otros pueden leer. Desactiva todos los interruptores para que una colección sea Secreta.",
    "System es el servidor de FLOQR. Puede leer todas las colecciones, pero solo desde código de servidor, para una tarea declarada, y nunca da a una persona más de lo que permite su propio nivel. No se puede desactivar aquí.",
    "Cada cambio requiere SOS2FA y un motivo, y se registra en el historial de auditoría a prueba de manipulaciones de Features & Services.",
    "Motivo del cambio (obligatorio, 8 caracteres o más)", "Filtrar colecciones", "Recargar", "Guardar filas que faltan", "Exportar CSV",
    "Colección", "Nivel", "Público", "Cliente", "Empleado normal",
    "Empleado con privilegios", "Club Admin", "Master Admin", "System", "Registro propio",
    "Datos personales", "Conservar (días)", "Reglas actuales (lectura / escritura)", "Guardar", "Valor predeterminado (aún sin guardar)",
    "Campos sensibles", "Estos campos son más estrictos que el resto de su colección. Solo cambian con una nueva versión.",
    "Quién puede leer qué", "Elige un rol para ver qué puede leer.", "Rol",
    "El registro pertenece a su club", "Leyendo su propio registro", "Informe de exposición",
    "Compara este registro con las reglas de seguridad activas y muestra las colecciones que más personas pueden leer o escribir de lo que permite el registro.",
    "Ejecutar informe de exposición",
    "Ninguna colección está más abierta que su clasificación.", "Más personas pueden leerla de lo permitido", "Cualquier cuenta con sesión iniciada puede escribirla", "Alta", "Media",
    "Desbloquea con SOS2FA para gestionar la clasificación de datos.", "Cargando…", "Guardado.", "Público", "Interno",
    "Confidencial del club", "Restringido", "Secreto", "Sin sesión", "System (solo servidor)",
    "Sí", "Solo el propio", "No", "0 = conservar hasta borrar",
    "Comprobando lo que tu cuenta puede ver…", "Mostrando respuestas públicas. Inicia sesión para ver las respuestas de tu cuenta."
  ],
  nl: [
    "Dataclassificatie", "Dataclassificatie",
    "Elke rij is een Firestore-collectie. Vink aan wie die mag lezen. Hogere niveaus omvatten lagere, en Master Admins kunnen alles lezen wat anderen kunnen lezen. Zet alle schakelaars uit om een collectie Geheim te maken.",
    "System is de FLOQR-server. Die kan elke collectie lezen, maar alleen vanuit servercode, voor een benoemde taak, en geeft een persoon nooit meer dan diens eigen niveau toestaat. Dit kan hier niet worden uitgezet.",
    "Elke wijziging vereist SOS2FA en een reden en wordt vastgelegd in het fraudebestendige auditlogboek bij Features & Services.",
    "Reden van wijziging (verplicht, minimaal 8 tekens)", "Collecties filteren", "Opnieuw laden", "Ontbrekende rijen opslaan", "CSV exporteren",
    "Collectie", "Niveau", "Openbaar", "Bezoeker", "Gewone medewerker",
    "Bevoorrechte medewerker", "Club Admin", "Master Admin", "System", "Eigen record",
    "Persoonsgegevens", "Bewaren (dagen)", "Regels nu (lezen / schrijven)", "Opslaan", "Standaardwaarde (nog niet opgeslagen)",
    "Gevoelige velden", "Deze velden zijn strenger dan de rest van hun collectie. Ze veranderen alleen met een release.",
    "Wie mag wat lezen", "Kies een rol om te zien wat die mag lezen.", "Rol",
    "Record hoort bij hun club", "Leest het eigen record", "Blootstellingsrapport",
    "Vergelijkt dit register met de actieve beveiligingsregels en toont collecties die meer mensen kunnen lezen of schrijven dan het register toestaat.",
    "Blootstellingsrapport uitvoeren",
    "Geen enkele collectie is opener dan haar classificatie.", "Meer mensen kunnen het lezen dan toegestaan", "Elk ingelogd account kan het schrijven", "Hoog", "Gemiddeld",
    "Ontgrendel met SOS2FA om dataclassificatie te beheren.", "Laden…", "Opgeslagen.", "Openbaar", "Intern",
    "Vertrouwelijk voor de club", "Beperkt", "Geheim", "Uitgelogd", "System (alleen server)",
    "Ja", "Alleen eigen", "Nee", "0 = bewaren tot verwijderd",
    "Controleren wat je account mag zien…", "Openbare antwoorden worden getoond. Log in om antwoorden voor je account te zien."
  ],
  ru: [
    "Классификация данных", "Классификация данных",
    "Каждая строка — коллекция Firestore. Отметьте, кто может её читать. Более высокие уровни включают нижние, а Master Admins могут читать всё, что могут читать другие. Выключите все переключатели, чтобы сделать коллекцию секретной.",
    "System — это сервер FLOQR. Он может читать любую коллекцию, но только из серверного кода, для указанной задачи, и никогда не выдаёт человеку больше, чем позволяет его уровень. Здесь его отключить нельзя.",
    "Каждое изменение требует SOS2FA и причины и записывается в защищённый от подделки журнал аудита в Features & Services.",
    "Причина изменения (обязательно, не менее 8 символов)", "Фильтр коллекций", "Обновить", "Сохранить недостающие строки", "Экспорт в CSV",
    "Коллекция", "Уровень", "Публично", "Гость", "Обычный сотрудник",
    "Привилегированный сотрудник", "Club Admin", "Master Admin", "System", "Своя запись",
    "Персональные данные", "Хранить (дней)", "Правила сейчас (чтение / запись)", "Сохранить", "Значение по умолчанию (ещё не сохранено)",
    "Чувствительные поля", "Эти поля строже остальной части коллекции. Они меняются только с новым выпуском.",
    "Кто что может читать", "Выберите роль, чтобы увидеть, что ей доступно.", "Роль",
    "Запись относится к их клубу", "Читает свою запись", "Отчёт об открытости",
    "Сравнивает этот реестр с действующими правилами безопасности и показывает коллекции, которые могут читать или изменять больше людей, чем разрешает реестр.",
    "Запустить отчёт",
    "Ни одна коллекция не открыта шире своей классификации.", "Читать могут больше людей, чем разрешено", "Изменять может любой вошедший аккаунт", "Высокая", "Средняя",
    "Разблокируйте через SOS2FA, чтобы управлять классификацией данных.", "Загрузка…", "Сохранено.", "Публично", "Внутреннее",
    "Конфиденциально для клуба", "Ограничено", "Секретно", "Без входа", "System (только сервер)",
    "Да", "Только своё", "Нет", "0 = хранить до удаления",
    "Проверяем, что доступно вашему аккаунту…", "Показаны общедоступные ответы. Войдите, чтобы увидеть ответы для своего аккаунта."
  ],
  it: [
    "Classificazione dei dati", "Classificazione dei dati",
    "Ogni riga è una raccolta Firestore. Seleziona chi può leggerla. I livelli superiori includono quelli inferiori e i Master Admin possono leggere tutto ciò che possono leggere gli altri. Disattiva tutti gli interruttori per rendere una raccolta Segreta.",
    "System è il server FLOQR. Può leggere ogni raccolta, ma solo dal codice del server, per un compito dichiarato, e non dà mai a una persona più di quanto consenta il suo livello. Non si può disattivare qui.",
    "Ogni modifica richiede SOS2FA e un motivo e viene registrata nel registro di audit a prova di manomissione di Features & Services.",
    "Motivo della modifica (obbligatorio, almeno 8 caratteri)", "Filtra raccolte", "Ricarica", "Salva le righe mancanti", "Esporta CSV",
    "Raccolta", "Livello", "Pubblico", "Cliente", "Dipendente normale",
    "Dipendente con privilegi", "Club Admin", "Master Admin", "System", "Propria scheda",
    "Dati personali", "Conserva (giorni)", "Regole attuali (lettura / scrittura)", "Salva", "Valore predefinito (non ancora salvato)",
    "Campi sensibili", "Questi campi sono più restrittivi del resto della raccolta. Cambiano solo con una nuova versione.",
    "Chi può leggere cosa", "Scegli un ruolo per vedere cosa può leggere.", "Ruolo",
    "La scheda appartiene al suo club", "Legge la propria scheda", "Rapporto di esposizione",
    "Confronta questo registro con le regole di sicurezza attive ed elenca le raccolte che più persone possono leggere o scrivere di quanto consenta il registro.",
    "Esegui rapporto di esposizione",
    "Nessuna raccolta è più aperta della sua classificazione.", "Più persone possono leggerla del consentito", "Qualsiasi account connesso può scriverla", "Alta", "Media",
    "Sblocca con SOS2FA per gestire la classificazione dei dati.", "Caricamento…", "Salvato.", "Pubblico", "Interno",
    "Riservato al club", "Riservato", "Segreto", "Non connesso", "System (solo server)",
    "Sì", "Solo la propria", "No", "0 = conserva fino all’eliminazione",
    "Verifica di ciò che il tuo account può vedere…", "Mostro le risposte pubbliche. Accedi per vedere le risposte per il tuo account."
  ],
  pt: [
    "Classificação de dados", "Classificação de dados",
    "Cada linha é uma coleção do Firestore. Marque quem pode lê-la. Níveis mais altos incluem os mais baixos, e Master Admins podem ler tudo o que outros podem ler. Desligue todos os interruptores para tornar uma coleção Secreta.",
    "System é o servidor do FLOQR. Ele pode ler todas as coleções, mas só a partir de código de servidor, para uma tarefa declarada, e nunca dá a uma pessoa mais do que o nível dela permite. Não pode ser desligado aqui.",
    "Cada alteração exige SOS2FA e um motivo e fica registrada no histórico de auditoria à prova de adulteração em Features & Services.",
    "Motivo da alteração (obrigatório, 8+ caracteres)", "Filtrar coleções", "Recarregar", "Salvar linhas que faltam", "Exportar CSV",
    "Coleção", "Nível", "Público", "Cliente", "Funcionário comum",
    "Funcionário privilegiado", "Club Admin", "Master Admin", "System", "Registro próprio",
    "Dados pessoais", "Manter (dias)", "Regras hoje (leitura / escrita)", "Salvar", "Padrão do pacote (ainda não salvo)",
    "Campos sensíveis", "Estes campos são mais restritos que o resto da coleção. Só mudam com uma nova versão.",
    "Quem pode ler o quê", "Escolha uma função para ver o que ela pode ler.", "Função",
    "O registro pertence ao clube dele", "Lendo o próprio registro", "Relatório de exposição",
    "Compara este registro com as regras de segurança ativas e lista as coleções que mais pessoas podem ler ou gravar do que o registro permite.",
    "Gerar relatório de exposição",
    "Nenhuma coleção está mais aberta que sua classificação.", "Mais pessoas podem ler do que o permitido", "Qualquer conta conectada pode gravar", "Alta", "Média",
    "Desbloqueie com SOS2FA para gerenciar a classificação de dados.", "Carregando…", "Salvo.", "Público", "Interno",
    "Confidencial do clube", "Restrito", "Secreto", "Desconectado", "System (só servidor)",
    "Sim", "Só o próprio", "Não", "0 = manter até excluir",
    "Verificando o que sua conta pode ver…", "Mostrando respostas públicas. Entre para ver as respostas da sua conta."
  ],
  el: [
    "Ταξινόμηση δεδομένων", "Ταξινόμηση δεδομένων",
    "Κάθε γραμμή είναι μια συλλογή Firestore. Επιλέξτε ποιος μπορεί να τη διαβάσει. Τα ανώτερα επίπεδα περιλαμβάνουν τα κατώτερα, και οι Master Admins μπορούν να διαβάσουν ό,τι μπορεί να διαβάσει οποιοσδήποτε άλλος. Απενεργοποιήστε όλους τους διακόπτες για να γίνει μια συλλογή Απόρρητη.",
    "Το System είναι ο διακομιστής του FLOQR. Μπορεί να διαβάσει κάθε συλλογή, αλλά μόνο από κώδικα διακομιστή, για δηλωμένη εργασία, και ποτέ δεν δίνει σε κάποιον περισσότερα από όσα επιτρέπει το δικό του επίπεδο. Δεν απενεργοποιείται εδώ.",
    "Κάθε αλλαγή απαιτεί SOS2FA και αιτιολογία και καταγράφεται στο προστατευμένο από αλλοίωση ιστορικό ελέγχου στο Features & Services.",
    "Αιτιολογία αλλαγής (υποχρεωτική, τουλάχιστον 8 χαρακτήρες)", "Φιλτράρισμα συλλογών", "Επαναφόρτωση", "Αποθήκευση γραμμών που λείπουν", "Εξαγωγή CSV",
    "Συλλογή", "Επίπεδο", "Δημόσιο", "Θαμώνας", "Απλός εργαζόμενος",
    "Προνομιούχος εργαζόμενος", "Club Admin", "Master Admin", "System", "Δική του εγγραφή",
    "Προσωπικά δεδομένα", "Διατήρηση (ημέρες)", "Κανόνες σήμερα (ανάγνωση / εγγραφή)", "Αποθήκευση", "Προεπιλογή πακέτου (δεν έχει αποθηκευτεί)",
    "Ευαίσθητα πεδία", "Αυτά τα πεδία είναι αυστηρότερα από την υπόλοιπη συλλογή. Αλλάζουν μόνο με νέα έκδοση.",
    "Ποιος διαβάζει τι", "Επιλέξτε ρόλο για να δείτε τι μπορεί να διαβάσει.", "Ρόλος",
    "Η εγγραφή ανήκει στο κλαμπ του", "Διαβάζει τη δική του εγγραφή", "Αναφορά έκθεσης",
    "Συγκρίνει αυτό το μητρώο με τους ενεργούς κανόνες ασφαλείας και δείχνει τις συλλογές που μπορούν να διαβάσουν ή να γράψουν περισσότερα άτομα από όσα επιτρέπει το μητρώο.",
    "Εκτέλεση αναφοράς έκθεσης",
    "Καμία συλλογή δεν είναι πιο ανοιχτή από την ταξινόμησή της.", "Περισσότερα άτομα μπορούν να τη διαβάσουν από όσα επιτρέπεται", "Κάθε συνδεδεμένος λογαριασμός μπορεί να γράψει", "Υψηλή", "Μέτρια",
    "Ξεκλειδώστε με SOS2FA για να διαχειριστείτε την ταξινόμηση δεδομένων.", "Φόρτωση…", "Αποθηκεύτηκε.", "Δημόσιο", "Εσωτερικό",
    "Εμπιστευτικό κλαμπ", "Περιορισμένο", "Απόρρητο", "Αποσυνδεδεμένος", "System (μόνο διακομιστής)",
    "Ναι", "Μόνο τη δική του", "Όχι", "0 = διατήρηση έως τη διαγραφή",
    "Ελέγχουμε τι μπορεί να δει ο λογαριασμός σας…", "Εμφανίζονται δημόσιες απαντήσεις. Συνδεθείτε για απαντήσεις για τον λογαριασμό σας."
  ],
  pl: [
    "Klasyfikacja danych", "Klasyfikacja danych",
    "Każdy wiersz to kolekcja Firestore. Zaznacz, kto może ją czytać. Wyższe poziomy obejmują niższe, a Master Admini mogą czytać wszystko, co mogą czytać inni. Wyłącz wszystkie przełączniki, aby kolekcja była Tajna.",
    "System to serwer FLOQR. Może czytać każdą kolekcję, ale tylko z kodu serwera, dla określonego zadania, i nigdy nie daje osobie więcej, niż pozwala jej własny poziom. Nie można go tu wyłączyć.",
    "Każda zmiana wymaga SOS2FA i powodu i jest zapisywana w odpornym na manipulacje dzienniku audytu w Features & Services.",
    "Powód zmiany (wymagany, co najmniej 8 znaków)", "Filtruj kolekcje", "Odśwież", "Zapisz brakujące wiersze", "Eksportuj CSV",
    "Kolekcja", "Poziom", "Publiczne", "Gość", "Zwykły pracownik",
    "Uprzywilejowany pracownik", "Club Admin", "Master Admin", "System", "Własny rekord",
    "Dane osobowe", "Przechowuj (dni)", "Reguły obecnie (odczyt / zapis)", "Zapisz", "Wartość domyślna (jeszcze nie zapisana)",
    "Pola wrażliwe", "Te pola są bardziej restrykcyjne niż reszta kolekcji. Zmieniają się tylko z nowym wydaniem.",
    "Kto może czytać co", "Wybierz rolę, aby zobaczyć, co może czytać.", "Rola",
    "Rekord należy do ich klubu", "Czyta własny rekord", "Raport ekspozycji",
    "Porównuje ten rejestr z aktywnymi regułami bezpieczeństwa i pokazuje kolekcje, które może czytać lub zapisywać więcej osób, niż pozwala rejestr.",
    "Uruchom raport ekspozycji",
    "Żadna kolekcja nie jest bardziej otwarta niż jej klasyfikacja.", "Więcej osób może ją czytać, niż dozwolono", "Każde zalogowane konto może ją zapisywać", "Wysoka", "Średnia",
    "Odblokuj przez SOS2FA, aby zarządzać klasyfikacją danych.", "Ładowanie…", "Zapisano.", "Publiczne", "Wewnętrzne",
    "Poufne klubu", "Ograniczone", "Tajne", "Niezalogowany", "System (tylko serwer)",
    "Tak", "Tylko własny", "Nie", "0 = przechowuj do usunięcia",
    "Sprawdzamy, co może zobaczyć Twoje konto…", "Pokazujemy publiczne odpowiedzi. Zaloguj się, aby zobaczyć odpowiedzi dla swojego konta."
  ],
  ar: [
    "تصنيف البيانات", "تصنيف البيانات",
    "كل صف هو مجموعة في Firestore. حدّد من يمكنه قراءتها. المستويات الأعلى تشمل الأدنى، ويمكن لمسؤولي المنصة قراءة كل ما يقرؤه غيرهم. أوقف كل المفاتيح لجعل المجموعة سرية.",
    "System هو خادم FLOQR. يمكنه قراءة كل مجموعة، لكن فقط من شيفرة الخادم ولمهمة محددة، ولا يعطي أي شخص أكثر مما يسمح به مستواه. لا يمكن إيقافه هنا.",
    "يتطلب كل تغيير SOS2FA وسببًا، ويُسجَّل في سجل التدقيق المحمي من التلاعب في Features & Services.",
    "سبب التغيير (مطلوب، 8 أحرف على الأقل)", "تصفية المجموعات", "إعادة التحميل", "حفظ الصفوف الناقصة", "تصدير CSV",
    "المجموعة", "المستوى", "عام", "رائد", "موظف عادي",
    "موظف بصلاحيات", "Club Admin", "Master Admin", "System", "سجله الخاص",
    "بيانات شخصية", "الاحتفاظ (أيام)", "القواعد الحالية (قراءة / كتابة)", "حفظ", "القيمة الافتراضية (لم تُحفظ بعد)",
    "حقول حساسة", "هذه الحقول أكثر تقييدًا من بقية مجموعتها. لا تتغير إلا مع إصدار جديد.",
    "من يقرأ ماذا", "اختر دورًا لترى ما يمكنه قراءته.", "الدور",
    "السجل يخص ناديه", "يقرأ سجله الخاص", "تقرير الانكشاف",
    "يقارن هذا السجل بقواعد الأمان الحالية ويعرض المجموعات التي يمكن لعدد أكبر من الأشخاص قراءتها أو الكتابة فيها مما يسمح به السجل.",
    "تشغيل تقرير الانكشاف",
    "لا توجد مجموعة أكثر انفتاحًا من تصنيفها.", "يمكن لعدد أكبر من المسموح قراءتها", "يمكن لأي حساب مسجّل الكتابة فيها", "مرتفعة", "متوسطة",
    "افتح القفل عبر SOS2FA لإدارة تصنيف البيانات.", "جارٍ التحميل…", "تم الحفظ.", "عام", "داخلي",
    "سري للنادي", "مقيّد", "سري", "غير مسجّل الدخول", "System (الخادم فقط)",
    "نعم", "سجله فقط", "لا", "0 = الاحتفاظ حتى الحذف",
    "نتحقق مما يمكن لحسابك رؤيته…", "نعرض الإجابات العامة. سجّل الدخول لرؤية إجابات حسابك."
  ]
};

let src = fs.readFileSync(file, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
if (src.includes(q(KEYS[1]))) throw new Error("data classification keys already present");
const anchor = /^( *)"floqai\.classicSearch": .*\r?\n/gm;
const hits = [...src.matchAll(anchor)];
if (hits.length !== CHROME_ORDER.length) throw new Error(`anchor hits ${hits.length}`);
let offset = 0;
hits.forEach((m, i) => {
  const lang = CHROME_ORDER[i];
  if (T[lang].length !== KEYS.length) throw new Error(`${lang} has ${T[lang].length} strings, expected ${KEYS.length}`);
  const block = KEYS.map((key, k) => `${m[1]}${q(key)}: ${q(T[lang][k])},${eol}`).join("");
  const pos = m.index + m[0].length + offset;
  src = src.slice(0, pos) + block + src.slice(pos);
  offset += block.length;
});
fs.writeFileSync(file, src);
console.log(`data classification: ${KEYS.length} chrome keys x ${CHROME_ORDER.length}`);
