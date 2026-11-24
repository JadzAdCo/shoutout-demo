#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const CHROME = {
  en: {
    "botdee.rs.joinNow": "Join Now",
    "botdee.rs.setSchedule": "Set a schedule",
    "botdee.rs.changeSchedule": "Change schedule",
    "botdee.rs.scheduleHint": "This is when the BOT DEE room starts — not Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Start time",
    "botdee.rs.scheduleSave": "Save schedule",
    "botdee.rs.scheduleSaved": "Scheduled. Search SMARTnotification is on for you and invited Mingl friends.",
    "botdee.rs.schedulePast": "Pick a future time for the BOT DEE room.",
    "botdee.rs.statusScheduled": "Scheduled",
    "botdee.rs.rsvpAccept": "Accepted",
    "botdee.rs.rsvpPending": "You're in. Join Now is available when the room is live."
  },
  fr: {
    "botdee.rs.joinNow": "Rejoindre maintenant",
    "botdee.rs.setSchedule": "Définir un horaire",
    "botdee.rs.changeSchedule": "Modifier l’horaire",
    "botdee.rs.scheduleHint": "C’est l’heure de début de la room BOT DEE — pas Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Heure de début",
    "botdee.rs.scheduleSave": "Enregistrer l’horaire",
    "botdee.rs.scheduleSaved": "Planifié. SMARTnotification Search est activée pour vous et les amis Mingl invités.",
    "botdee.rs.schedulePast": "Choisissez une heure future pour la room BOT DEE.",
    "botdee.rs.statusScheduled": "Planifié",
    "botdee.rs.rsvpAccept": "Accepté",
    "botdee.rs.rsvpPending": "Vous êtes inscrit. Join Now est disponible quand la room est en ligne."
  },
  de: {
    "botdee.rs.joinNow": "Jetzt beitreten",
    "botdee.rs.setSchedule": "Zeitplan festlegen",
    "botdee.rs.changeSchedule": "Zeitplan ändern",
    "botdee.rs.scheduleHint": "Das ist der Start der BOT DEE-Room — nicht Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Startzeit",
    "botdee.rs.scheduleSave": "Zeitplan speichern",
    "botdee.rs.scheduleSaved": "Geplant. Search SMARTnotification ist für Sie und eingeladene Mingl-Freunde an.",
    "botdee.rs.schedulePast": "Wählen Sie eine zukünftige Zeit für die BOT DEE-Room.",
    "botdee.rs.statusScheduled": "Geplant",
    "botdee.rs.rsvpAccept": "Zugesagt",
    "botdee.rs.rsvpPending": "Sie sind dabei. Join Now ist verfügbar, wenn die Room live ist."
  },
  es: {
    "botdee.rs.joinNow": "Unirse ahora",
    "botdee.rs.setSchedule": "Fijar un horario",
    "botdee.rs.changeSchedule": "Cambiar horario",
    "botdee.rs.scheduleHint": "Esta es la hora de inicio de la room BOT DEE — no Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Hora de inicio",
    "botdee.rs.scheduleSave": "Guardar horario",
    "botdee.rs.scheduleSaved": "Programado. SMARTnotification de Search está activa para usted y los amigos Mingl invitados.",
    "botdee.rs.schedulePast": "Elija una hora futura para la room BOT DEE.",
    "botdee.rs.statusScheduled": "Programado",
    "botdee.rs.rsvpAccept": "Aceptado",
    "botdee.rs.rsvpPending": "Está dentro. Join Now estará disponible cuando la room esté en vivo."
  },
  nl: {
    "botdee.rs.joinNow": "Nu deelnemen",
    "botdee.rs.setSchedule": "Plan instellen",
    "botdee.rs.changeSchedule": "Plan wijzigen",
    "botdee.rs.scheduleHint": "Dit is wanneer de BOT DEE-room start — niet Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Starttijd",
    "botdee.rs.scheduleSave": "Plan opslaan",
    "botdee.rs.scheduleSaved": "Gepland. Search SMARTnotification staat aan voor jou en uitgenodigde Mingl-vrienden.",
    "botdee.rs.schedulePast": "Kies een toekomstig tijdstip voor de BOT DEE-room.",
    "botdee.rs.statusScheduled": "Gepland",
    "botdee.rs.rsvpAccept": "Geaccepteerd",
    "botdee.rs.rsvpPending": "Je zit erin. Join Now is beschikbaar als de room live is."
  },
  ru: {
    "botdee.rs.joinNow": "Войти сейчас",
    "botdee.rs.setSchedule": "Задать расписание",
    "botdee.rs.changeSchedule": "Изменить расписание",
    "botdee.rs.scheduleHint": "Это старт room BOT DEE — не Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Время начала",
    "botdee.rs.scheduleSave": "Сохранить расписание",
    "botdee.rs.scheduleSaved": "Запланировано. Search SMARTnotification включена для вас и приглашённых друзей Mingl.",
    "botdee.rs.schedulePast": "Выберите будущее время для room BOT DEE.",
    "botdee.rs.statusScheduled": "Запланировано",
    "botdee.rs.rsvpAccept": "Принято",
    "botdee.rs.rsvpPending": "Вы в списке. Join Now доступен, когда room в эфире."
  },
  it: {
    "botdee.rs.joinNow": "Entra ora",
    "botdee.rs.setSchedule": "Imposta un orario",
    "botdee.rs.changeSchedule": "Cambia orario",
    "botdee.rs.scheduleHint": "Questo è l’inizio della room BOT DEE — non Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Ora di inizio",
    "botdee.rs.scheduleSave": "Salva orario",
    "botdee.rs.scheduleSaved": "Programmato. SMARTnotification di Search è attiva per te e gli amici Mingl invitati.",
    "botdee.rs.schedulePast": "Scegli un orario futuro per la room BOT DEE.",
    "botdee.rs.statusScheduled": "Programmato",
    "botdee.rs.rsvpAccept": "Accettato",
    "botdee.rs.rsvpPending": "Sei dentro. Join Now è disponibile quando la room è live."
  },
  pt: {
    "botdee.rs.joinNow": "Entrar agora",
    "botdee.rs.setSchedule": "Definir um horário",
    "botdee.rs.changeSchedule": "Alterar horário",
    "botdee.rs.scheduleHint": "Esta é a hora de início da room BOT DEE — não Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Hora de início",
    "botdee.rs.scheduleSave": "Guardar horário",
    "botdee.rs.scheduleSaved": "Agendado. SMARTnotification da Search está ligada para si e amigos Mingl convidados.",
    "botdee.rs.schedulePast": "Escolha uma hora futura para a room BOT DEE.",
    "botdee.rs.statusScheduled": "Agendado",
    "botdee.rs.rsvpAccept": "Aceite",
    "botdee.rs.rsvpPending": "Está dentro. Join Now fica disponível quando a room estiver ao vivo."
  },
  el: {
    "botdee.rs.joinNow": "Συμμετοχή τώρα",
    "botdee.rs.setSchedule": "Ορισμός προγράμματος",
    "botdee.rs.changeSchedule": "Αλλαγή προγράμματος",
    "botdee.rs.scheduleHint": "Αυτή είναι η έναρξη του BOT DEE room — όχι Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Ώρα έναρξης",
    "botdee.rs.scheduleSave": "Αποθήκευση προγράμματος",
    "botdee.rs.scheduleSaved": "Προγραμματίστηκε. Το Search SMARTnotification είναι ενεργό για εσάς και τους προσκεκλημένους φίλους Mingl.",
    "botdee.rs.schedulePast": "Επιλέξτε μελλοντική ώρα για το BOT DEE room.",
    "botdee.rs.statusScheduled": "Προγραμματισμένο",
    "botdee.rs.rsvpAccept": "Αποδεκτό",
    "botdee.rs.rsvpPending": "Είστε μέσα. Το Join Now είναι διαθέσιμο όταν το room είναι live."
  },
  pl: {
    "botdee.rs.joinNow": "Dołącz teraz",
    "botdee.rs.setSchedule": "Ustaw harmonogram",
    "botdee.rs.changeSchedule": "Zmień harmonogram",
    "botdee.rs.scheduleHint": "To godzina startu room BOT DEE — nie Shared Itinerary.",
    "botdee.rs.scheduleWhen": "Czas startu",
    "botdee.rs.scheduleSave": "Zapisz harmonogram",
    "botdee.rs.scheduleSaved": "Zaplanowano. Search SMARTnotification jest włączone dla Ciebie i zaproszonych znajomych Mingl.",
    "botdee.rs.schedulePast": "Wybierz przyszłą godzinę dla room BOT DEE.",
    "botdee.rs.statusScheduled": "Zaplanowano",
    "botdee.rs.rsvpAccept": "Zaakceptowano",
    "botdee.rs.rsvpPending": "Jesteś na liście. Join Now będzie dostępne, gdy room będzie na żywo."
  },
  ar: {
    "botdee.rs.joinNow": "انضم الآن",
    "botdee.rs.setSchedule": "تعيين جدول",
    "botdee.rs.changeSchedule": "تغيير الجدول",
    "botdee.rs.scheduleHint": "هذا وقت بدء room BOT DEE — وليس Shared Itinerary.",
    "botdee.rs.scheduleWhen": "وقت البدء",
    "botdee.rs.scheduleSave": "حفظ الجدول",
    "botdee.rs.scheduleSaved": "مُجدول. SMARTnotification في Search مفعّل لك ولأصدقاء Mingl المدعوين.",
    "botdee.rs.schedulePast": "اختر وقتاً مستقبلياً لـ room BOT DEE.",
    "botdee.rs.statusScheduled": "مُجدول",
    "botdee.rs.rsvpAccept": "مقبول",
    "botdee.rs.rsvpPending": "أنت ضمن القائمة. Join Now يتاح عندما تكون الـ room مباشرة."
  }
};

const ITINERARY = {
  en: "Shared Itinerary is night-out notes, not a calendar. Set a schedule is when the BOT DEE room starts.",
  fr: "Shared Itinerary, ce sont des notes de soirée, pas un calendrier. Définir un horaire, c’est le début de la room BOT DEE.",
  de: "Shared Itinerary sind Abendnotizen, kein Kalender. Zeitplan festlegen ist der Start der BOT DEE-Room.",
  es: "Shared Itinerary son notas de la noche, no un calendario. Fijar un horario es cuando empieza la room BOT DEE.",
  nl: "Shared Itinerary zijn avondnotities, geen kalender. Plan instellen is wanneer de BOT DEE-room start.",
  ru: "Shared Itinerary — заметки вечера, не календарь. Задать расписание — это старт room BOT DEE.",
  it: "Shared Itinerary sono note della serata, non un calendario. Imposta un orario è quando inizia la room BOT DEE.",
  pt: "Shared Itinerary são notas da noite, não um calendário. Definir um horário é quando a room BOT DEE começa.",
  el: "Το Shared Itinerary είναι σημειώσεις της βραδιάς, όχι ημερολόγιο. Ορισμός προγράμματος είναι η έναρξη του BOT DEE room.",
  pl: "Shared Itinerary to notatki wieczoru, nie kalendarz. Ustaw harmonogram to start room BOT DEE.",
  ar: "Shared Itinerary ملاحظات للسهرة وليست تقويمًا. تعيين جدول هو وقت بدء room BOT DEE."
};

const PERMISSIONS = {
  en: "Room Permissions is host invite rules. The room stays open until the host taps End Room, about four hours after it opens, or everyone has been gone about 15 minutes. Pausing private BOT DEE chat is separate.",
  fr: "Room Permissions, ce sont les règles d’invitation de l’hôte. La session reste ouverte jusqu’à End Room, environ quatre heures après l’ouverture, ou si tout le monde est parti depuis environ 15 minutes. La pause du chat BOT DEE privé est séparée.",
  de: "Room Permissions sind Einladungsregeln des Hosts. Der Raum bleibt offen, bis der Host End Room tippt, etwa vier Stunden nach dem Öffnen, oder alle etwa 15 Minuten weg sind. Die Pause des privaten BOT DEE-Chats ist getrennt.",
  es: "Room Permissions son las reglas de invitación del anfitrión. La sala sigue abierta hasta End Room, unas cuatro horas después de abrir, o si todos se han ido unos 15 minutos. Pausar el chat privado de BOT DEE es aparte.",
  nl: "Room Permissions zijn de uitnodigingsregels van de host. De room blijft open tot End Room, tot ongeveer vier uur na opening, of tot iedereen zo’n 15 minuten weg is. De pauze van privé-BOT DEE-chat is apart.",
  ru: "Room Permissions — правила приглашений хоста. Сессия открыта, пока хост не нажмёт End Room, около четырёх часов после открытия, или если все отсутствуют около 15 минут. Пауза личного чата BOT DEE отдельно.",
  it: "Room Permissions sono le regole di invito dell’host. La room resta aperta fino a End Room, circa quattro ore dopo l’apertura, o se tutti sono assenti da circa 15 minuti. La pausa della chat BOT DEE privata è distinta.",
  pt: "Room Permissions são as regras de convite do anfitrião. A sala fica aberta até End Room, cerca de quatro horas depois de abrir, ou se todos saíram há cerca de 15 minutos. Pausar o chat privado BOT DEE é separado.",
  el: "Το Room Permissions είναι κανόνες πρόσκλησης του host. Το δωμάτιο μένει ανοιχτό μέχρι End Room, περίπου τέσσερις ώρες μετά το άνοιγμα, ή αν όλοι έχουν φύγει περίπου 15 λεπτά. Η παύση ιδιωτικής συνομιλίας BOT DEE είναι ξεχωριστή.",
  pl: "Room Permissions to zasady zapraszania hosta. Pokój zostaje otwarty do End Room, około czterech godzin po otwarciu, albo gdy wszyscy nieobecni są około 15 minut. Pauza prywatnego czatu BOT DEE jest osobna.",
  ar: "Room Permissions قواعد دعوة المضيف. تبقى الغرفة مفتوحة حتى End Room، أو نحو أربع ساعات بعد فتحها، أو إذا غاب الجميع نحو 15 دقيقة. إيقاف دردشة BOT DEE الخاصة أمر منفصل."
};

const HELP = {
  "help-botdee-room-smartview-schedule": {
    en: {title: "Join Now or set a schedule", body: "After Room SMARTview setup, choose Join Now or Set a schedule. Join Now opens the BOT DEE session now and does not put a card on Search. Set a schedule is when the BOT DEE room starts — not Shared Itinerary. Saving a future time turns on Search SMARTnotification for you and invited Mingl friends only. Guests RSVP until the room is live, then Join Now opens BOT DEE (not Mingl chat)."},
    de: {title: "Jetzt beitreten oder Zeitplan festlegen", body: "Nach dem Room-SMARTview-Setup wählen Sie Jetzt beitreten oder Zeitplan festlegen. Jetzt beitreten öffnet die BOT DEE-Session sofort und legt keine Karte auf Search. Zeitplan festlegen ist der Start der BOT DEE-Room — nicht Shared Itinerary. Ein zukünftiger Zeitpunkt schaltet Search SMARTnotification nur für Sie und eingeladene Mingl-Freunde ein. Gäste sagen zu, bis die Room live ist; dann öffnet Join Now BOT DEE (nicht Mingl-Chat)."},
    fr: {title: "Rejoindre maintenant ou définir un horaire", body: "Après la configuration Room SMARTview, choisissez Rejoindre maintenant ou Définir un horaire. Rejoindre maintenant ouvre la session BOT DEE tout de suite et ne met pas de carte sur Search. Définir un horaire, c’est le début de la room BOT DEE — pas Shared Itinerary. Une heure future active SMARTnotification Search pour vous et les amis Mingl invités seulement. Les invités RSVP jusqu’à ce que la room soit en ligne ; Join Now ouvre alors BOT DEE (pas Mingl chat)."},
    es: {title: "Unirse ahora o fijar un horario", body: "Tras configurar Room SMARTview, elija Unirse ahora o Fijar un horario. Unirse ahora abre la sesión BOT DEE ya y no pone una tarjeta en Search. Fijar un horario es cuando empieza la room BOT DEE — no Shared Itinerary. Una hora futura activa SMARTnotification de Search solo para usted y amigos Mingl invitados. Los invitados confirman RSVP hasta que la room esté en vivo; entonces Join Now abre BOT DEE (no Mingl chat)."},
    it: {title: "Entra ora o imposta un orario", body: "Dopo il setup Room SMARTview, scegli Entra ora o Imposta un orario. Entra ora apre la sessione BOT DEE subito e non mette una scheda su Search. Imposta un orario è quando inizia la room BOT DEE — non Shared Itinerary. Un orario futuro attiva SMARTnotification di Search solo per te e gli amici Mingl invitati. Gli ospiti RSVP finché la room è live; poi Join Now apre BOT DEE (non Mingl chat)."},
    pt: {title: "Entrar agora ou definir um horário", body: "Depois da configuração Room SMARTview, escolha Entrar agora ou Definir um horário. Entrar agora abre a sessão BOT DEE já e não põe um cartão na Search. Definir um horário é quando a room BOT DEE começa — não Shared Itinerary. Uma hora futura liga SMARTnotification da Search só para si e amigos Mingl convidados. Convidados RSVP até a room estar ao vivo; depois Join Now abre BOT DEE (não Mingl chat)."},
    nl: {title: "Nu deelnemen of plan instellen", body: "Na Room SMARTview-setup kies je Nu deelnemen of Plan instellen. Nu deelnemen opent de BOT DEE-sessie nu en zet geen kaart op Search. Plan instellen is wanneer de BOT DEE-room start — niet Shared Itinerary. Een toekomstig tijdstip zet Search SMARTnotification alleen aan voor jou en uitgenodigde Mingl-vrienden. Gasten RSVP tot de room live is; daarna opent Join Now BOT DEE (niet Mingl-chat)."},
    ru: {title: "Войти сейчас или задать расписание", body: "После настройки Room SMARTview выберите Войти сейчас или Задать расписание. Войти сейчас открывает сессию BOT DEE сразу и не ставит карточку на Search. Задать расписание — старт room BOT DEE, не Shared Itinerary. Будущее время включает Search SMARTnotification только для вас и приглашённых друзей Mingl. Гости RSVP, пока room не в эфире; затем Join Now открывает BOT DEE (не Mingl chat)."},
    el: {title: "Συμμετοχή τώρα ή ορισμός προγράμματος", body: "Μετά το setup Room SMARTview επιλέξτε Συμμετοχή τώρα ή Ορισμός προγράμματος. Η συμμετοχή τώρα ανοίγει τη συνεδρία BOT DEE τώρα και δεν βάζει κάρτα στο Search. Ορισμός προγράμματος είναι η έναρξη του BOT DEE room — όχι Shared Itinerary. Μελλοντική ώρα ενεργοποιεί Search SMARTnotification μόνο για εσάς και προσκεκλημένους φίλους Mingl. Οι επισκέπτες RSVP μέχρι το room να είναι live· μετά το Join Now ανοίγει BOT DEE (όχι Mingl chat)."},
    pl: {title: "Dołącz teraz lub ustaw harmonogram", body: "Po konfiguracji Room SMARTview wybierz Dołącz teraz lub Ustaw harmonogram. Dołącz teraz otwiera sesję BOT DEE od razu i nie kładzie karty na Search. Ustaw harmonogram to start room BOT DEE — nie Shared Itinerary. Przyszła godzina włącza Search SMARTnotification tylko dla Ciebie i zaproszonych znajomych Mingl. Goście RSVP, aż room będzie na żywo; potem Join Now otwiera BOT DEE (nie Mingl chat)."},
    ar: {title: "انضم الآن أو عيّن جدولاً", body: "بعد إعداد Room SMARTview اختر انضم الآن أو تعيين جدول. انضم الآن يفتح جلسة BOT DEE فوراً ولا يضع بطاقة على Search. تعيين جدول هو وقت بدء room BOT DEE — وليس Shared Itinerary. وقت مستقبلي يفعّل SMARTnotification في Search لك ولأصدقاء Mingl المدعوين فقط. الضيوف يؤكدون RSVP حتى تصبح الـ room مباشرة؛ ثم Join Now يفتح BOT DEE (وليس Mingl chat)."}
  }
};

const HELP_UPDATES = {
  "help-botdee-room-smartview": {
    en: "In BOT DEE chat, say Open Room SMARTview, Start a group chat, or plan a Cancun trip in plain words. Confirm shows Join Now or Set a schedule. Join Now opens a Mingl-friends session now and does not paint Search. Set a schedule is when the BOT DEE room starts — not Shared Itinerary — and turns on Search SMARTnotification for you and invited Mingl friends. Invite Mingl friends only — host plus 7 guests. Guests can invite too. Joining is not a payment and does not open a shared tab. BOT DEE never takes card numbers. Private BOT DEE messages stay private. Site Chrome follows your Appearance theme. A live room stays open until the host taps End Room, about four hours after it opens, or everyone has been gone about 15 minutes. Pausing private BOT DEE chat is separate.",
    de: "Im BOT DEE-Chat sagen Sie Open Room SMARTview, Start a group chat oder planen Sie eine Cancun-Reise in einfachen Worten. Danach: Jetzt beitreten oder Zeitplan festlegen. Jetzt beitreten öffnet eine Mingl-Freunde-Session sofort und legt keine Karte auf Search. Zeitplan festlegen ist der Start der BOT DEE-Room — nicht Shared Itinerary — und schaltet Search SMARTnotification für Sie und eingeladene Mingl-Freunde ein. Nur Mingl-Freunde einladen — Host plus 7 Gäste. Gäste können auch einladen. Beitreten ist keine Zahlung und öffnet keine geteilte Rechnung. BOT DEE nimmt nie Kartennummern. Private BOT DEE-Nachrichten bleiben privat. Site Chrome folgt Appearance. Eine Live-Room bleibt offen, bis der Host End Room tippt, etwa vier Stunden nach dem Öffnen, oder alle etwa 15 Minuten weg sind. Die Pause des privaten BOT DEE-Chats ist getrennt.",
    fr: "Dans le chat BOT DEE, dites Open Room SMARTview, Start a group chat, ou planifiez un voyage à Cancun en mots simples. Ensuite : Rejoindre maintenant ou Définir un horaire. Rejoindre maintenant ouvre une session d’amis Mingl tout de suite et ne met pas de carte sur Search. Définir un horaire, c’est le début de la room BOT DEE — pas Shared Itinerary — et active SMARTnotification Search pour vous et les amis Mingl invités. Invitez seulement des amis Mingl — hôte plus 7 invités. Les invités peuvent aussi inviter. Rejoindre n’est pas un paiement et n’ouvre pas d’addition partagée. BOT DEE ne prend jamais de numéros de carte. Les messages BOT DEE privés restent privés. Site Chrome suit Appearance. Une room en ligne reste ouverte jusqu’à End Room, environ quatre heures après l’ouverture, ou si tout le monde est parti depuis environ 15 minutes. La pause du chat BOT DEE privé est séparée.",
    es: "En el chat de BOT DEE, diga Open Room SMARTview, Start a group chat, o planee un viaje a Cancun en palabras simples. Luego: Unirse ahora o Fijar un horario. Unirse ahora abre una sesión de amigos Mingl ya y no pone una tarjeta en Search. Fijar un horario es cuando empieza la room BOT DEE — no Shared Itinerary — y activa SMARTnotification de Search para usted y amigos Mingl invitados. Invite solo amigos Mingl — anfitrión más 7 invitados. Los invitados también pueden invitar. Unirse no es un pago y no abre una cuenta compartida. BOT DEE nunca toma números de tarjeta. Los mensajes privados de BOT DEE siguen privados. Site Chrome sigue Appearance. Una room en vivo sigue abierta hasta End Room, unas cuatro horas después de abrir, o si todos se han ido unos 15 minutos. Pausar el chat privado de BOT DEE es aparte.",
    it: "Nella chat BOT DEE di’ Open Room SMARTview, Start a group chat, o pianifica un viaggio a Cancun in parole semplici. Poi: Entra ora o Imposta un orario. Entra ora apre una sessione di amici Mingl subito e non mette una scheda su Search. Imposta un orario è quando inizia la room BOT DEE — non Shared Itinerary — e attiva SMARTnotification di Search per te e gli amici Mingl invitati. Invita solo amici Mingl — host più 7 ospiti. Anche gli ospiti possono invitare. Unirsi non è un pagamento e non apre un conto condiviso. BOT DEE non prende mai numeri di carta. I messaggi BOT DEE privati restano privati. Site Chrome segue Appearance. Una room live resta aperta fino a End Room, circa quattro ore dopo l’apertura, o se tutti sono assenti da circa 15 minuti. La pausa della chat BOT DEE privata è distinta.",
    pt: "No chat BOT DEE, diga Open Room SMARTview, Start a group chat, ou planeie uma viagem a Cancun em palavras simples. Depois: Entrar agora ou Definir um horário. Entrar agora abre uma sessão de amigos Mingl já e não põe um cartão na Search. Definir um horário é quando a room BOT DEE começa — não Shared Itinerary — e liga SMARTnotification da Search para si e amigos Mingl convidados. Convide só amigos Mingl — anfitrião mais 7 convidados. Convidados também podem convidar. Entrar não é um pagamento e não abre uma conta partilhada. O BOT DEE nunca pede números de cartão. As mensagens privadas do BOT DEE ficam privadas. Site Chrome segue Appearance. Uma room ao vivo fica aberta até End Room, cerca de quatro horas depois de abrir, ou se todos saíram há cerca de 15 minutos. Pausar o chat privado BOT DEE é separado.",
    nl: "Zeg in de BOT DEE-chat Open Room SMARTview, Start a group chat, of plan een Cancun-reis in gewone woorden. Daarna: Nu deelnemen of Plan instellen. Nu deelnemen opent nu een Mingl-vrienden-sessie en zet geen kaart op Search. Plan instellen is wanneer de BOT DEE-room start — niet Shared Itinerary — en zet Search SMARTnotification aan voor jou en uitgenodigde Mingl-vrienden. Nodig alleen Mingl-vrienden uit — host plus 7 gasten. Gasten kunnen ook uitnodigen. Deelnemen is geen betaling en opent geen gedeelde rekening. BOT DEE neemt nooit kaartnummers. Privé-BOT DEE-berichten blijven privé. Site Chrome volgt Appearance. Een live room blijft open tot End Room, tot ongeveer vier uur na opening, of tot iedereen zo’n 15 minuten weg is. De pauze van privé-BOT DEE-chat is apart.",
    ru: "В чате BOT DEE скажите Open Room SMARTview, Start a group chat или простыми словами запланируйте поездку в Cancun. Дальше: Войти сейчас или Задать расписание. Войти сейчас открывает сессию друзей Mingl сразу и не ставит карточку на Search. Задать расписание — старт room BOT DEE, не Shared Itinerary, и включает Search SMARTnotification для вас и приглашённых друзей Mingl. Приглашайте только друзей Mingl — хост плюс 7 гостей. Гости тоже могут приглашать. Вход — не платёж и не общий счёт. BOT DEE никогда не берёт номера карт. Личные сообщения остаются личными. Site Chrome следует Appearance. Живая room открыта, пока хост не нажмёт End Room, около четырёх часов после открытия, или если все отсутствуют около 15 минут. Пауза личного чата BOT DEE отдельно.",
    el: "Στη συνομιλία BOT DEE πείτε Open Room SMARTview, Start a group chat ή σχεδιάστε ταξίδι Cancun με απλά λόγια. Έπειτα: Συμμετοχή τώρα ή Ορισμός προγράμματος. Η συμμετοχή τώρα ανοίγει συνεδρία φίλων Mingl τώρα και δεν βάζει κάρτα στο Search. Ορισμός προγράμματος είναι η έναρξη του BOT DEE room — όχι Shared Itinerary — και ενεργοποιεί Search SMARTnotification για εσάς και προσκεκλημένους φίλους Mingl. Προσκαλέστε μόνο φίλους Mingl — host συν 7 επισκέπτες. Οι επισκέπτες μπορούν επίσης να προσκαλούν. Η είσοδος δεν είναι πληρωμή και δεν ανοίγει κοινό λογαριασμό. Το BOT DEE δεν παίρνει ποτέ αριθμούς κάρτας. Τα ιδιωτικά μηνύματα BOT DEE μένουν ιδιωτικά. Το Site Chrome ακολουθεί Appearance. Ένα live room μένει ανοιχτό μέχρι End Room, περίπου τέσσερις ώρες μετά το άνοιγμα, ή αν όλοι έχουν φύγει περίπου 15 λεπτά. Η παύση ιδιωτικής συνομιλίας BOT DEE είναι ξεχωριστή.",
    pl: "W czacie BOT DEE powiedz Open Room SMARTview, Start a group chat albo zaplanuj wyjazd do Cancun zwykłymi słowami. Potem: Dołącz teraz lub Ustaw harmonogram. Dołącz teraz otwiera sesję znajomych Mingl od razu i nie kładzie karty na Search. Ustaw harmonogram to start room BOT DEE — nie Shared Itinerary — i włącza Search SMARTnotification dla Ciebie i zaproszonych znajomych Mingl. Zaproś tylko znajomych Mingl — host plus 7 gości. Goście też mogą zapraszać. Dołączenie to nie płatność i nie otwiera wspólnego rachunku. BOT DEE nigdy nie bierze numerów kart. Prywatne wiadomości BOT DEE zostają prywatne. Site Chrome idzie za Appearance. Live room zostaje otwarty do End Room, około czterech godzin po otwarciu, albo gdy wszyscy nieobecni są około 15 minut. Pauza prywatnego czatu BOT DEE jest osobna.",
    ar: "في دردشة BOT DEE قل Open Room SMARTview أو Start a group chat أو خطط لرحلة Cancun بكلام بسيط. بعد ذلك: انضم الآن أو تعيين جدول. انضم الآن يفتح جلسة أصدقاء Mingl فوراً ولا يضع بطاقة على Search. تعيين جدول هو وقت بدء room BOT DEE — وليس Shared Itinerary — ويفعّل SMARTnotification في Search لك ولأصدقاء Mingl المدعوين. ادعُ أصدقاء Mingl فقط — مضيف زائد 7 ضيوف. يمكن للضيوف الدعوة أيضاً. الانضمام ليس دفعاً ولا يفتح فاتورة مشتركة. BOT DEE لا يأخذ أرقام بطاقات أبداً. رسائل BOT DEE الخاصة تبقى خاصة. يتبع Site Chrome مظهر Appearance. تبقى الـ room المباشرة مفتوحة حتى End Room، أو نحو أربع ساعات بعد فتحها، أو إذا غاب الجميع نحو 15 دقيقة. إيقاف دردشة BOT DEE الخاصة أمر منفصل."
  },
  "help-botdee-room-smartview-end": {
    en: "Only the host can end a room. Ending does not charge anyone or erase other people’s private chats. An unpaid shared tab must be paid or voided first. A live room stays open until End Room, about four hours after it opens, or everyone has been gone about 15 minutes. Pausing private BOT DEE chat is not room logout. A guest leaving does not end the room while the host is still present.",
    de: "Nur der Host kann einen Room beenden. Beenden belastet niemanden und löscht keine privaten Chats anderer. Eine unbezahlte geteilte Rechnung muss zuerst bezahlt oder storniert werden. Eine Live-Room bleibt offen bis End Room, etwa vier Stunden nach dem Öffnen, oder bis alle etwa 15 Minuten weg sind. Die Pause des privaten BOT DEE-Chats ist kein Room-Logout. Ein Gast, der geht, beendet die Room nicht, solange der Host da ist.",
    fr: "Seul l’hôte peut terminer une room. Terminer ne facture personne et n’efface pas les chats privés des autres. Une addition partagée impayée doit d’abord être payée ou annulée. Une room en ligne reste ouverte jusqu’à End Room, environ quatre heures après l’ouverture, ou si tout le monde est parti depuis environ 15 minutes. La pause du chat BOT DEE privé n’est pas une déconnexion de room. Un invité qui part ne termine pas la room tant que l’hôte est présent.",
    es: "Solo el anfitrión puede terminar una room. Terminar no cobra a nadie ni borra chats privados de otros. Una cuenta compartida impagada debe pagarse o anularse primero. Una room en vivo sigue abierta hasta End Room, unas cuatro horas después de abrir, o si todos se han ido unos 15 minutos. Pausar el chat privado de BOT DEE no es salir de la room. Un invitado que se va no termina la room mientras el anfitrión sigue.",
    it: "Solo l’host può terminare una room. Terminare non addebita nessuno e non cancella le chat private altrui. Un conto condiviso non pagato va prima pagato o annullato. Una room live resta aperta fino a End Room, circa quattro ore dopo l’apertura, o se tutti sono assenti da circa 15 minuti. La pausa della chat BOT DEE privata non è un logout della room. Un ospite che esce non termina la room se l’host è presente.",
    pt: "Só o anfitrião pode terminar uma room. Terminar não cobra ninguém nem apaga chats privados de outros. Uma conta partilhada por pagar deve ser paga ou anulada primeiro. Uma room ao vivo fica aberta até End Room, cerca de quatro horas depois de abrir, ou se todos saíram há cerca de 15 minutos. Pausar o chat privado BOT DEE não é logout da room. Um convidado que sai não termina a room enquanto o anfitrião está presente.",
    nl: "Alleen de host kan een room beëindigen. Beëindigen belast niemand en wist geen privéchats van anderen. Een onbetaalde gedeelde rekening moet eerst betaald of geannuleerd. Een live room blijft open tot End Room, tot ongeveer vier uur na opening, of tot iedereen zo’n 15 minuten weg is. De pauze van privé-BOT DEE-chat is geen room-logout. Een gast die weggaat beëindigt de room niet zolang de host er is.",
    ru: "Только хост может завершить room. Завершение никого не списывает и не стирает чужие личные чаты. Неоплаченный общий счёт нужно оплатить или аннулировать сначала. Живая room открыта до End Room, около четырёх часов после открытия, или если все отсутствуют около 15 минут. Пауза личного чата BOT DEE — не выход из room. Гость, который уходит, не завершает room, пока хост на месте.",
    el: "Μόνο ο host μπορεί να τελειώσει μια room. Το τέλος δεν χρεώνει κανέναν και δεν σβήνει ιδιωτικές συνομιλίες άλλων. Ένας απλήρωτος κοινός λογαριασμός πρέπει πρώτα να πληρωθεί ή να ακυρωθεί. Ένα live room μένει ανοιχτό μέχρι End Room, περίπου τέσσερις ώρες μετά το άνοιγμα, ή αν όλοι έχουν φύγει περίπου 15 λεπτά. Η παύση ιδιωτικής συνομιλίας BOT DEE δεν είναι αποσύνδεση room. Ένας επισκέπτης που φεύγει δεν τελειώνει τη room όσο ο host είναι εκεί.",
    pl: "Tylko host może zakończyć room. Zakończenie nikogo nie obciąża i nie kasuje prywatnych czatów innych. Nieopłacony wspólny rachunek trzeba najpierw zapłacić lub unieważnić. Live room zostaje otwarty do End Room, około czterech godzin po otwarciu, albo gdy wszyscy nieobecni są około 15 minut. Pauza prywatnego czatu BOT DEE to nie wylogowanie z room. Gość, który wychodzi, nie zamyka room, gdy host jest obecny.",
    ar: "المضيف وحده يمكنه إنهاء room. الإنهاء لا يحصّل أحداً ولا يمسح دردشات الآخرين الخاصة. يجب دفع الفاتورة المشتركة غير المدفوعة أو إلغاؤها أولاً. تبقى الـ room المباشرة مفتوحة حتى End Room، أو نحو أربع ساعات بعد فتحها، أو إذا غاب الجميع نحو 15 دقيقة. إيقاف دردشة BOT DEE الخاصة ليس خروجاً من الـ room. مغادرة ضيف لا تنهي الـ room ما دام المضيف موجوداً."
  },
  "help-smartvisuals-notification": {
    en: "A compact Mingl Room Invitation can appear on Search when a Mingl friend scheduled a BOT DEE room you were invited to. View Invitation opens Room SMARTview. Join Now goes to BOT DEE, not Mingl chat. Not Now hides the card this tab; Inbox still has Review BOT DEE invite. The Cancun demo query is Studio-only. Art is illustration, not a photo. Join Now rooms without a schedule do not paint Search.",
    de: "Eine kompakte Mingl-Room-Einladung kann auf Search erscheinen, wenn ein Mingl-Freund eine BOT DEE-Room geplant hat, zu der Sie eingeladen sind. Einladung ansehen öffnet Room SMARTview. Join Now geht zu BOT DEE, nicht Mingl-Chat. Nicht jetzt blendet die Karte in diesem Tab aus; Inbox behält Review BOT DEE invite. Die Cancun-Demo-Abfrage ist nur Studio. Kunst ist Illustration, kein Foto. Join-Now-Rooms ohne Zeitplan erscheinen nicht auf Search.",
    fr: "Une invitation Mingl Room compacte peut apparaître sur Search quand un ami Mingl a planifié une room BOT DEE à laquelle vous êtes invité. Voir l’invitation ouvre Room SMARTview. Join Now va vers BOT DEE, pas Mingl chat. Pas maintenant masque la carte dans cet onglet ; Inbox garde Review BOT DEE invite. La requête démo Cancun est réservée au Studio. L’art est une illustration, pas une photo. Les rooms Join Now sans horaire n’apparaissent pas sur Search.",
    es: "Una invitación compacta Mingl Room puede aparecer en Search cuando un amigo Mingl programó una room BOT DEE a la que usted está invitado. Ver invitación abre Room SMARTview. Join Now va a BOT DEE, no a Mingl chat. Ahora no oculta la tarjeta en esta pestaña; Inbox sigue con Review BOT DEE invite. La consulta demo Cancun es solo Studio. El arte es ilustración, no foto. Las rooms Join Now sin horario no aparecen en Search.",
    it: "Un invito compatto Mingl Room può comparire su Search quando un amico Mingl ha programmato una room BOT DEE a cui sei invitato. Vedi invito apre Room SMARTview. Join Now va a BOT DEE, non Mingl chat. Non ora nasconde la scheda in questa scheda; Inbox tiene Review BOT DEE invite. La query demo Cancun è solo Studio. L’arte è illustrazione, non foto. Le room Join Now senza orario non appaiono su Search.",
    pt: "Um convite compacto Mingl Room pode aparecer na Search quando um amigo Mingl agendou uma room BOT DEE para a qual foi convidado. Ver convite abre Room SMARTview. Join Now vai para BOT DEE, não Mingl chat. Agora não esconde o cartão neste separador; Inbox mantém Review BOT DEE invite. A consulta demo Cancun é só Studio. A arte é ilustração, não foto. Rooms Join Now sem horário não aparecem na Search.",
    nl: "Een compacte Mingl Room-uitnodiging kan op Search verschijnen als een Mingl-vriend een BOT DEE-room plande waar jij voor bent uitgenodigd. Uitnodiging bekijken opent Room SMARTview. Join Now gaat naar BOT DEE, niet Mingl-chat. Niet nu verbergt de kaart in dit tabblad; Inbox houdt Review BOT DEE invite. De Cancun-demovraag is alleen Studio. Kunst is illustratie, geen foto. Join Now-rooms zonder plan verschijnen niet op Search.",
    ru: "Компактное приглашение Mingl Room может появиться в Search, когда друг Mingl запланировал room BOT DEE, куда вас пригласили. Смотреть приглашение открывает Room SMARTview. Join Now ведёт в BOT DEE, не в Mingl chat. Не сейчас скрывает карточку в этой вкладке; Inbox сохраняет Review BOT DEE invite. Демо-запрос Cancun — только Studio. Картинка — иллюстрация, не фото. Rooms Join Now без расписания не появляются в Search.",
    el: "Μια συμπαγής πρόσκληση Mingl Room μπορεί να εμφανιστεί στο Search όταν ένας φίλος Mingl προγραμμάτισε BOT DEE room στο οποίο προσκληθήκατε. Προβολή πρόσκλησης ανοίγει Room SMARTview. Το Join Now πηγαίνει στο BOT DEE, όχι Mingl chat. Όχι τώρα κρύβει την κάρτα σε αυτή την καρτέλα· το Inbox κρατά Review BOT DEE invite. Το demo Cancun είναι μόνο Studio. Η τέχνη είναι εικονογράφηση, όχι φωτογραφία. Rooms Join Now χωρίς πρόγραμμα δεν εμφανίζονται στο Search.",
    pl: "Kompaktowe zaproszenie Mingl Room może pojawić się na Search, gdy znajomy Mingl zaplanował room BOT DEE, na które Cię zaproszono. Zobacz zaproszenie otwiera Room SMARTview. Join Now idzie do BOT DEE, nie Mingl chat. Nie teraz chowa kartę w tej karcie; Inbox zostawia Review BOT DEE invite. Demo Cancun jest tylko Studio. Grafika to ilustracja, nie zdjęcie. Roomy Join Now bez harmonogramu nie pojawiają się na Search.",
    ar: "يمكن أن تظهر دعوة Mingl Room مختصرة على Search عندما يجدول صديق Mingl room BOT DEE دُعيت إليها. عرض الدعوة يفتح Room SMARTview. Join Now يذهب إلى BOT DEE وليس Mingl chat. ليس الآن يخفي البطاقة في هذا التبويب؛ يبقى Inbox فيه Review BOT DEE invite. استعلام Cancun التجريبي لـ Studio فقط. الرسم توضيح وليس صورة. غرف Join Now بلا جدول لا تظهر على Search."
  },
  "help-smartvisuals-room": {
    en: "Room SMARTview shows the Mingl invitation: schedule, RSVP or live status, and Join Now. Join Now on Search opens BOT DEE (not Mingl chat) with room= and t=. SMARTstencils and SMARTbackgrounds follow the authorized room title — Cancun Trip uses travel art, not a real Cancun photo. Private BOT DEE chat is never used to pick art. A labeled Ad below is a sample from those tags. It stays empty for private chat or injection and is not a live advertiser.",
    de: "Room SMARTview zeigt die Mingl-Einladung: Zeitplan, RSVP oder Live-Status und Join Now. Join Now auf Search öffnet BOT DEE (nicht Mingl-Chat) mit room= und t=. SMARTstencils und SMARTbackgrounds folgen dem autorisierten Room-Titel — Cancun Trip nutzt Reisekunst, kein echtes Cancun-Foto. Privater BOT DEE-Chat wählt nie die Kunst. Ein beschriftetes Ad darunter ist ein Muster aus diesen Tags. Leer bei privatem Chat oder Injektion; kein Live-Werber.",
    fr: "Room SMARTview montre l’invitation Mingl : horaire, RSVP ou statut en ligne, et Join Now. Join Now sur Search ouvre BOT DEE (pas Mingl chat) avec room= et t=. SMARTstencils et SMARTbackgrounds suivent le titre autorisé — Cancun Trip utilise une illustration voyage, pas une vraie photo de Cancun. Le chat BOT DEE privé ne choisit jamais l’art. Un Ad étiqueté en dessous est un échantillon de ces tags. Vide pour chat privé ou injection ; ce n’est pas un annonceur en direct.",
    es: "Room SMARTview muestra la invitación Mingl: horario, RSVP o estado en vivo, y Join Now. Join Now en Search abre BOT DEE (no Mingl chat) con room= y t=. SMARTstencils y SMARTbackgrounds siguen el título autorizado — Cancun Trip usa arte de viaje, no una foto real de Cancun. El chat privado de BOT DEE nunca elige el arte. Un Ad etiquetado debajo es una muestra de esas etiquetas. Vacío para chat privado o inyección; no es un anunciante en vivo.",
    it: "Room SMARTview mostra l’invito Mingl: orario, RSVP o stato live, e Join Now. Join Now su Search apre BOT DEE (non Mingl chat) con room= e t=. SMARTstencils e SMARTbackgrounds seguono il titolo autorizzato — Cancun Trip usa arte di viaggio, non una foto reale di Cancun. La chat BOT DEE privata non sceglie mai l’arte. Un Ad etichettato sotto è un campione da quei tag. Vuoto per chat privata o iniezione; non è un inserzionista live.",
    pt: "Room SMARTview mostra o convite Mingl: horário, RSVP ou estado ao vivo, e Join Now. Join Now na Search abre BOT DEE (não Mingl chat) com room= e t=. SMARTstencils e SMARTbackgrounds seguem o título autorizado — Cancun Trip usa arte de viagem, não uma foto real de Cancun. O chat privado BOT DEE nunca escolhe a arte. Um Ad rotulado abaixo é uma amostra dessas etiquetas. Vazio para chat privado ou injeção; não é um anunciante ao vivo.",
    nl: "Room SMARTview toont de Mingl-uitnodiging: plan, RSVP of live-status, en Join Now. Join Now op Search opent BOT DEE (niet Mingl-chat) met room= en t=. SMARTstencils en SMARTbackgrounds volgen de geautoriseerde roomtitel — Cancun Trip gebruikt reisillustratie, geen echte Cancun-foto. Privé-BOT DEE-chat kiest nooit de kunst. Een gelabelde Ad eronder is een sample van die tags. Leeg bij privéchat of injectie; geen live adverteerder.",
    ru: "Room SMARTview показывает приглашение Mingl: расписание, RSVP или эфир и Join Now. Join Now в Search открывает BOT DEE (не Mingl chat) с room= и t=. SMARTstencils и SMARTbackgrounds следуют разрешённому названию — Cancun Trip даёт travel-иллюстрацию, не настоящее фото Cancun. Личный чат BOT DEE не выбирает картинку. Подписанный Ad снизу — образец из этих тегов. Пусто для личного чата или инъекции; это не живой рекламодатель.",
    el: "Το Room SMARTview δείχνει την πρόσκληση Mingl: πρόγραμμα, RSVP ή live κατάσταση, και Join Now. Το Join Now στο Search ανοίγει BOT DEE (όχι Mingl chat) με room= και t=. SMARTstencils και SMARTbackgrounds ακολουθούν τον εγκεκριμένο τίτλο — Cancun Trip χρησιμοποιεί ταξιδιωτική εικονογράφηση, όχι πραγματική φωτογραφία Cancun. Η ιδιωτική συνομιλία BOT DEE δεν επιλέγει ποτέ την τέχνη. Ένα επισημασμένο Ad από κάτω είναι δείγμα από αυτές τις ετικέτες. Κενό για ιδιωτική συνομιλία ή έγχυση· δεν είναι ζωντανός διαφημιστής.",
    pl: "Room SMARTview pokazuje zaproszenie Mingl: harmonogram, RSVP lub status na żywo oraz Join Now. Join Now na Search otwiera BOT DEE (nie Mingl chat) z room= i t=. SMARTstencils i SMARTbackgrounds idą za autoryzowanym tytułem — Cancun Trip używa grafiki podróży, nie prawdziwego zdjęcia Cancun. Prywatny czat BOT DEE nigdy nie wybiera grafiki. Oznakowane Ad poniżej to próbka z tych tagów. Puste przy czacie prywatnym lub iniekcji; to nie żywy reklamodawca.",
    ar: "يعرض Room SMARTview دعوة Mingl: الجدول وRSVP أو الحالة المباشرة وJoin Now. Join Now على Search يفتح BOT DEE (وليس Mingl chat) مع room= وt=. تتبع SMARTstencils وSMARTbackgrounds العنوان المصرّح — Cancun Trip فن سفر وليس صورة Cancun حقيقية. دردشة BOT DEE الخاصة لا تختار الرسم أبداً. إعلان موسوم أسفلها عيّنة من تلك الوسوم. يبقى فارغاً للدردشة الخاصة أو الحقن وليس معلناً مباشراً."
  }
};

function packLines(map) {
  return Object.entries(map).map(([key, value]) => `      ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join("\n");
}

function injectChrome() {
  const file = path.join(root, "floqr-i18n.js");
  let src = fs.readFileSync(file, "utf8");
  const langOrder = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
  let count = 0;
  src = src.replace(/("botdee\.rs\.permissionsNotSchedule":\s*")((?:\\.|[^"\\])*)(")/g, (full, pre, oldVal, post, offset) => {
    const lang = langOrder[count];
    count += 1;
    if (!lang || !CHROME[lang]) throw new Error(`no chrome pack for slot ${count - 1}`);
    const next = PERMISSIONS[lang];
    const replaced = `${pre}${next.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}${post}`;
    const ahead = src.slice(offset, offset + 900);
    if (ahead.includes('"botdee.rs.joinNow"')) return replaced;
    return `${replaced},\n${packLines(CHROME[lang])}`; // leftover original comma after match is stripped below
  });
  if (count !== 11) throw new Error(`expected 11 permissions replacements, got ${count}`);
  count = 0;
  src = src.replace(/("botdee\.rs\.itineraryNotCalendar":\s*")((?:\\.|[^"\\])*)(")/g, (full, pre, _old, post) => {
    const lang = langOrder[count];
    count += 1;
    const next = ITINERARY[lang];
    if (!next) throw new Error(`no itinerary for ${lang}`);
    return `${pre}${next.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}${post}`;
  });
  if (count !== 11) throw new Error(`expected 11 itinerary replacements, got ${count}`);
  fs.writeFileSync(file, src);
  console.log("chrome schedule keys injected");
}

function helpBlock(lang) {
  const row = HELP["help-botdee-room-smartview-schedule"][lang];
  return `      "help-botdee-room-smartview-schedule": {\n        title: ${JSON.stringify(row.title)},\n        body: ${JSON.stringify(row.body)}\n      },`;
}

function injectHelpJs() {
  const file = path.join(root, "floqr-i18n-help.js");
  let src = fs.readFileSync(file, "utf8");
  const langs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
  let count = 0;
  src = src.replace(/("help-botdee-room-smartview-share":\s*\{[\s\S]*?\n\s*\},)/g, (full, _g, offset) => {
    const ahead = src.slice(offset, offset + 400);
    if (ahead.includes("help-botdee-room-smartview-schedule")) return full;
    const lang = langs[count];
    count += 1;
    if (!lang) throw new Error("extra help pack");
    return `${full}\n${helpBlock(lang)}`;
  });
  if (count !== 10) throw new Error(`expected 10 help injections, got ${count}`);
  const packStarts = langs.map(lang => {
    const at = src.indexOf(`"${lang}": {`);
    if (at < 0) throw new Error(`missing pack ${lang}`);
    return {lang, at};
  });
  Object.keys(HELP_UPDATES).forEach(id => {
    langs.forEach((lang, langIndex) => {
      const body = HELP_UPDATES[id][lang];
      const start = packStarts[langIndex].at;
      const end = langIndex + 1 < packStarts.length ? packStarts[langIndex + 1].at : src.length;
      const slice = src.slice(start, end);
      const marker = `"${id}": {`;
      const local = slice.indexOf(marker);
      if (local < 0) throw new Error(`missing ${id} in ${lang}`);
      const bodyAt = slice.indexOf("body:", local);
      const quote = slice.indexOf('"', bodyAt);
      let i = quote + 1;
      while (i < slice.length) {
        const ch = slice[i];
        if (ch === "\\") { i += 2; continue; }
        if (ch === '"') break;
        i += 1;
      }
      const absQuote = start + quote;
      const absEnd = start + i;
      src = `${src.slice(0, absQuote + 1)}${JSON.stringify(body).slice(1, -1)}${src.slice(absEnd)}`;
      const delta = JSON.stringify(body).length - 2 - (absEnd - absQuote - 1);
      for (let n = langIndex + 1; n < packStarts.length; n++) packStarts[n].at += delta;
    });
  });
  fs.writeFileSync(file, src);
  console.log("help packs injected");
}

function injectHelpEn() {
  const file = path.join(root, "scripts/_help-en.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json["help-botdee-room-smartview-schedule"] = HELP["help-botdee-room-smartview-schedule"].en;
  json["help-botdee-room-smartview"].body = HELP_UPDATES["help-botdee-room-smartview"].en;
  json["help-botdee-room-smartview-end"].body = HELP_UPDATES["help-botdee-room-smartview-end"].en;
  json["help-smartvisuals-notification"].body = HELP_UPDATES["help-smartvisuals-notification"].en;
  json["help-smartvisuals-room"].body = HELP_UPDATES["help-smartvisuals-room"].en;
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log("canonical help updated");
}

Object.keys(CHROME).forEach(lang => {
  const keys = Object.keys(CHROME[lang]);
  if (keys.length !== Object.keys(CHROME.en).length) throw new Error(`chrome ${lang} mismatch`);
});

injectChrome();
injectHelpJs();
injectHelpEn();
console.log("done", Object.keys(CHROME.en).length, "chrome keys");
