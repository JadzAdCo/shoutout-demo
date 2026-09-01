/* FLOQR help title/body locales (ru, nl, fr, de, es, it, pt, el, pl, ar) for patron / venueAdmin / serviceMember. */
(function (global) {
  "use strict";

  const VERSION = "s3.0.32";

  const packs = {
    ru: {
      "floqai-ask-floqr": {
        title: "Спросите FloqR через FloqAi",
        body: "Спросите FloqR через FloqAi — нажмите анимированный знак или дождитесь подсказки, затем опишите, что нужно, простыми словами. Продукты: Mingl, RydR, BartR, ShoutOut, SupRstR (superstar), клубы. Цели: скажите «я хочу уметь…» (например, стать Club Admin) или «make me a superstar» — получите шаги и ссылки."
      },
      "help-soccer-jersey": {
        title: "ShoutOut в футбольной майке",
        body: "Ищите Soccer, Jersey или страну/клуб (Tanzania, Chelsea). Каждая карточка фото-кита — это спина LED, которую вы увидите в ShoutOut — Soccer · Jersey · Country или Club. Размеры 96×48, 64×48, 64×32. Имя и 2-символьная метка накладываются на кит; номера остаются по центру."
      },
      "help-suprstar": {
        title: "Сделать меня supRstar / superstar",
        body: "Выберите площадку → приватный превью камеры → оплата $20 (окно Stripe) → Club Admin одобряет в очереди supRstar → Go live на доске SupRStar. Как ShoutOut, но с живым видео. Ссылки превью используют секретные токены — их нельзя угадать по URL клуба."
      },
      "help-become-club-admin": {
        title: "Стать Club Admin",
        body: "Запросите доступ Club Admin, затем получите одобрение площадки."
      },
      "help-become-dj": {
        title: "Стать DJ",
        body: "Выберите роль DJ и привяжитесь к клубам."
      },
      "help-become-promoter": {
        title: "Стать Promoter",
        body: "Запросите доступ Promoter для гостевых списков и кампаний."
      },
      "help-role-profiles": {
        title: "Обзор ролей",
        body: "Как работают роли Club Admin, DJ, Promoter и hospitality."
      },
      "help-staff-scheduling": {
        title: "Календарь и планировщик",
        body: "Календарь Club Admin показывает Draft (фиолетовый), Pending (янтарный), Confirmed (зелёный) и Open/незаполненные карточки — у каждой есть текстовый статус, не только цвет. Scheduler — сетка люди × дни для черновиков и публикации. Website ingest / publicVenueCalendar отдаёт только Confirmed назначения. Зелёная метка Paid this month видна Club Admins, когда staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Подписки клуба на SMS и WhatsApp уведомления",
        body: "Club Admin → Notifications: Send test alert использует сейчас отмеченные каналы. In-app (и Push) пишет System Message в FloqR Inbox. Email идёт на адреса админов клуба. SMS и WhatsApp требуют оплаченную подписку и телефон оповещения в E.164. Зелёная метка = подписка Firebase 1 (предоплаченный пакет $10); красная = 0. Если Send test alert возвращает Authentication Error - invalid username, секрет Firebase TWILIO_ACCOUNT_SID должен быть Account SID, начинающийся с AC (34 символа) из console.twilio.com — не Auth Token и не API Key (SK)."
      },
      "help-club-sms-notification": {
        title: "Подписка на SMS уведомления",
        body: "Метка SMS зелёная, когда Firebase smsSubscribed = 1 (предоплаченный пакет $10, 466 кредитов, не месяц и не год). Красная/мигающая = 0 — откройте ? и нажмите Subscribe $10. Остаток кредитов и дата последней оплаты — в этой справке. Снимите SMS и Save, чтобы приостановить оповещения, не теряя оплаченный пакет."
      },
      "help-club-whatsapp-notification": {
        title: "Подписка на WhatsApp уведомления",
        body: "Метка WhatsApp зелёная, когда Firebase whatsappSubscribed = 1 (предоплаченный пакет $10, 233 кредита, не месяц и не год). Красная/мигающая = 0 — откройте ? и нажмите Subscribe $10. Остаток кредитов и дата последней оплаты — в этой справке. Снимите WhatsApp и Save, чтобы приостановить оповещения, не теряя оплаченный пакет."
      },
      "help-schedule-message-templates": {
        title: "Шаблоны сообщений расписания",
        body: "Club Admin → Notifications → Message templates. Это System Messages (Inbox / Email / SMS / WhatsApp), не ShoutOuts. Редактируйте заголовок и текст для New shift needs confirmation, Schedule update, Shift confirmed и Shift declined. Плейсхолдеры: {club} {role} {when} {link} {worker}. В inbox работника — Review & confirm shift, никогда не Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Подтверждение назначенных смен",
        body: "Ссылки Inbox / Email / SMS открывают Work Calendar. Просмотрите каждое ожидание, отметьте его (или Select all), затем Approve selected. Открытие ссылки само по себе не подтверждает. Подтвердить может только назначенный service member — Club Admin не может сделать это за него."
      },
      "help-template-catalog-report": {
        title: "Отчёт каталога шаблонов",
        body: "Список всех типов шаблонов ShoutOut и поддерживаемых размеров LED (Is96x48, Is64x48, Is64x32). Площадка предлагает шаблон только если хотя бы один флаг = 1 и соответствующий VenueSupports* = 1. Birthday / split-media шаблоны = 1 на 96×48, 64×48 и 64×32. 96×48 — 3 строки рядом; 64×48 и 64×32 чередуют фото и 3-строчный shoutout с карточкой FLOQR + handle."
      },
      "help-club-display-screens": {
        title: "Экраны FLOQR",
        body: "В Firebase clubLocations хранятся VenueSupports96x48, VenueSupports64x48 и VenueSupports64x32 как 0 или 1. В templates — Is96x48, Is64x48 и Is64x32 так же. Площадка показывает шаблон, только если хотя бы одна пара = 1. URL Xibo остаются display.html?location=id и display2.html?location=id — размер экрана не в URL. Birthday доступен на всех трёх размерах (3 строки рядом на 96×48; цикл фото/shoutout на 64×48 и 64×32). Primary — display.html. Secondary — display2.html."
      },
      "help-donpapi-led-wall": {
        title: "LED-стена DonPapi ShoutOut",
        body: "VIP ShoutOuts несут busboys на ручной LED-стене DonPapi — держат в воздухе перед гостями с сообщением на центральном экране (название клуба сверху, светящаяся белая фестонная рамка). Настольные LED (64×32) и портретные стены (960×1900) остаются для других форматов."
      },
      "help-staff-week-calendar": {
        title: "Планировщик",
        body: "Планировщик Club Admin — недельная сетка люди × дни. Save shift закрывает редактор с сообщением Schedule card successfully saved. Создавайте черновики, Publish schedule чтобы работники подтвердили pending→confirmed, Select shifts для множественного удаления и Website ingest для публикации смен на сайте клуба. Окно смены по умолчанию = открытие клуба − 2 часа до закрытия + 1 час."
      },
      "help-staff-schedule-user-guide": {
        title: "Руководство по расписанию персонала",
        body: "Откройте ? рядом с Scheduler в Club Admin Scheduling. Создайте черновики смен, Publish schedule чтобы работники подтвердили pending→confirmed, затем Select shifts чтобы удалить несколько сразу. Пример: все черновики среды плюс подтверждённый чип четверга."
      },
      "help-create-publish-schedule": {
        title: "Создать и опубликовать расписание персонала",
        body: "Добавьте черновики на сетке люди × дни, проверьте чипы, затем Publish schedule. Работники должны подтвердить смену, прежде чем она станет confirmed. FloqAi: create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Удалить несколько запланированных или черновых смен",
        body: "Select shifts, комбинируйте заголовки дней и чипы, затем Delete selected. Пример: все черновики среды плюс одна подтверждённая смена четверга."
      },
      "help-staff-worksheet": {
        title: "Work Sheet — недельный календарь персонала",
        body: "Выбранные service members открывают Work Calendar в Settings. Ссылки подтверждения Inbox / Email / SMS ведут сюда. Просмотрите ожидающие назначения, отметьте каждую смену (или Select all), затем Approve selected — открытие сообщения не подтверждает. Недельная сетка показывает опубликованные смены коллег. Черновики остаются в Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Все начинают как patron FLOQR. В My Profile & Settings нажмите Elect to become a service member, выберите роль и клубы, отправьте внизу страницы.\n\nГид по шаблонам профиля — социальные профили patron остаются в Публичных медиа.\n\nУтверждение Club Admin — Club Admin → Employee/Workers → Pending Worker Requests или Проверить и выбрать на этой вкладке."
      },
      "help-venue-website-ingest": {
        title: "Ингест сайта клуба (API, RSS, iframe)",
        body: "Club Admin → Scheduling → Website ingest. Сгенерируйте секрет (показывается один раз; хранится только хеш). Тяните опубликованные смены на официальный сайт клуба через JSON (?format=json&dataset=schedule|hours|profile|all), RSS или iframe. Черновики, email и телефон работника никогда не включаются. Смените секрет при утечке."
      },
      "help-venue-hours-calendar": {
        title: "Часы работы площадки",
        body: "В Club Public Profile задайте стандартные часы открытия/закрытия на неделю, затем добавьте period overrides для особых недель, не теряя стандарт. Публичная страница клуба показывает сетку вс–сб с диапазоном дат (например Sun 9 – Sat 15, Aug 2026) и календарной раскраской. Ближайшие праздники показывают часы и отмечают отличие от обычного дня недели. Staff Scheduling использует открытие − 2ч до закрытия + 1ч. Guest List может предлагать открытые вечера."
      },
      "help-club-admin-affiliation": {
        title: "Назначение Club Admin на площадку",
        body: "Club Admins открывают Venue Command Center только для назначенного клуба. Открытие admin.html без площадки больше не ведёт по умолчанию на Zebbies. Демо-аккаунты temp_clubadmin_N@floqr-demo.com соответствуют temp-democlub-N. Неназначенные админы запрашивают назначение у Master Admin."
      },
      "help-general-notifications": {
        title: "Общие уведомления",
        body: "SOS2FA и другие системные сообщения FloqR следуют этим флагам в записи пользователя патрона. Площадкам или независимым service members нужна подписка на платные SMS/WhatsApp сервисы Twilio."
      },
      "help-app-language": {
        title: "Язык приложения",
        body: "При первом запуске FloqR читает язык браузера (например nl-NL → Dutch / Nederlands) и переключает интерфейс и меню, если язык поддерживается — категории Search, вкладки My Profile, Club Admin и Master Admin. Неподдерживаемые языки остаются на английском. После этого побеждают My Profile → App language и сохранённый язык профиля. Сохранение App language переводит каждую страницу с FLOQRI18n, не только эту карточку."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Откройте My Profile & Settings для ролей, инструментов продавца и настроек аккаунта."
      },
      "help-onboarding": {
        title: "Онбординг",
        body: "Онбординг патрона / service member — запросите доступ Club Admin, DJ, Promoter или hospitality. Master Admins также могут онбордить площадки."
      },
      "help-mingl-search": {
        title: "О поиске Mingl",
        body: "Ищите публичные профили по общим интересам, стилю жизни, музыке, путешествиям, еде, событиям, авто, городу, username или по тому, кого хотите встретить."
      },
      "help-default-template": {
        title: "Шаблон по умолчанию",
        body: "Бесплатный Traditional Black and White Classic. Ниже через FloqAi — шаблоны Sports, Jersey, VIP, Humor, Cars, Video, Pictures и Ballers."
      },
      "help-floqai-template-search": {
        title: "Поиск шаблонов FloqAi",
        body: "Нажмите движущийся знак FloqAi (или дождитесь речевых пузырей) и попросите Sports, Jersey, NBA, NFL, Cars, Humor, VIP, Video, Pictures или Ballers."
      },
      "help-mingl-requests": {
        title: "О запросах Mingl",
        body: "Отправленные и полученные Friend или Mingl Requests появляются здесь. Запросы остаются на главной странице Mingl; принятые разговоры открываются в Mingl Chat."
      }
    },
    nl: {
      "floqai-ask-floqr": {
        title: "Vraag FloqR met FloqAi",
        body: "Vraag FloqR met FloqAi — tik op het bewegende merkteken of wacht op de prompt, en typ in gewone woorden wat je wilt. Producten: Mingl, RydR, BartR, ShoutOut, SupRstR (superstar), clubs. Doelen: zeg “ik wil kunnen…” (bijv. Club Admin worden) of “make me a superstar” voor stappen en links."
      },
      "help-soccer-jersey": {
        title: "Voetbalshirt ShoutOut",
        body: "Zoek Soccer, Jersey of een land/club (Tanzania, Chelsea). Elke foto-kitkaart is de LED-rug die je op ShoutOut ziet — Soccer · Jersey · Country of Club. Formaten 96×48, 64×48, 64×32. Naam en 2-tekenmarkering liggen over de kit; nummers blijven gecentreerd."
      },
      "help-suprstar": {
        title: "Maak me een supRstar / superstar",
        body: "Kies een venue → privé camerapreview → betaal $20 (Stripe-pop-out) → Club Admin keurt goed in de supRstar Queue → Go live op het SupRStar-bord. Als een ShoutOut, maar met live video. Previewlinks gebruiken geheime tokens en zijn niet te raden via een club-URL."
      },
      "help-become-club-admin": {
        title: "Word Club Admin",
        body: "Vraag Club Admin-toegang aan en krijg goedkeuring van de venue."
      },
      "help-become-dj": {
        title: "Word DJ",
        body: "Kies DJ als service-rol en koppel je aan clubs."
      },
      "help-become-promoter": {
        title: "Word Promoter",
        body: "Vraag Promoter-toegang aan voor gastenlijsten en campagnes."
      },
      "help-role-profiles": {
        title: "Overzicht rolprofielen",
        body: "Bekijk hoe Club Admin, DJ, Promoter en hospitality-rollen werken."
      },
      "help-staff-scheduling": {
        title: "Agenda & Planner",
        body: "Club Admin Calendar toont Draft (paars), Pending (amber), Confirmed (groen) en Open/onbezette kaarten — elk met een tekststatus, niet alleen kleur. Scheduler is het raster mensen × dagen voor concept/publicatie. Website ingest / publicVenueCalendar geeft alleen Confirmed toewijzingen. Een groene Paid this month-pill verschijnt voor Club Admins wanneer staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Club SMS- en WhatsApp-notificatieabonnementen",
        body: "Club Admin → Notifications: Send test alert gebruikt de momenteel aangevinkte kanalen. In-app (en Push) schrijft een System Message in FloqR Inbox. Email gebruikt clubadmin-adressen. SMS en WhatsApp vereisen een betaald abonnement plus een E.164-alerttelefoon. Groene pill = Firebase-abonnement 1 (vooruitbetaald $10-pakket); rood = 0. Als Send test alert Authentication Error - invalid username teruggeeft, moet Firebase-secret TWILIO_ACCOUNT_SID de Account SID zijn die met AC begint (34 tekens) van console.twilio.com — niet de Auth Token en niet een API Key (SK)."
      },
      "help-club-sms-notification": {
        title: "SMS-notificatieabonnement",
        body: "De SMS-pill is groen wanneer Firebase smsSubscribed 1 is (vooruitbetaald $10-pakket, 466 credits, niet maandelijks of jaarlijks). Rood/knipperend betekent 0 — open ? en tik Subscribe $10. Resterende credits en laatste betaaldatum staan in deze hulp. Vink SMS uit en Save om alerts te pauzeren zonder het betaalde pakket te verliezen."
      },
      "help-club-whatsapp-notification": {
        title: "WhatsApp-notificatieabonnement",
        body: "De WhatsApp-pill is groen wanneer Firebase whatsappSubscribed 1 is (vooruitbetaald $10-pakket, 233 credits, niet maandelijks of jaarlijks). Rood/knipperend betekent 0 — open ? en tik Subscribe $10. Resterende credits en laatste betaaldatum staan in deze hulp. Vink WhatsApp uit en Save om alerts te pauzeren zonder het betaalde pakket te verliezen."
      },
      "help-schedule-message-templates": {
        title: "Berichtensjablonen voor roosters",
        body: "Club Admin → Notifications → Message templates. Dit zijn System Messages (Inbox / Email / SMS / WhatsApp), geen ShoutOuts. Bewerk titel en tekst voor New shift needs confirmation, Schedule update, Shift confirmed en Shift declined. Placeholders: {club} {role} {when} {link} {worker}. Worker-inbox gebruikt Review & confirm shift — nooit Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Toegewezen diensten bevestigen",
        body: "Inbox- / Email- / SMS-links openen Work Calendar. Bekijk elke pending toewijzing, vink aan (of Select all), en dan Approve selected. De link openen bevestigt niet. Alleen het toegewezen service member kan goedkeuren — Club Admin kan dat niet namens hen doen."
      },
      "help-template-catalog-report": {
        title: "Rapport sjablooncatalogus",
        body: "Lijst van elk ShoutOut-sjabloontype en welke LED-formaten het ondersteunt (Is96x48, Is64x48, Is64x32). Een venue biedt een sjabloon alleen aan als minstens één van die vlaggen 1 is en de bijpassende VenueSupports*-vlag 1 is. Birthday- / split-media-sjablonen zijn 1 op 96×48, 64×48 en 64×32. 96×48 is 3 regels naast elkaar; 64×48 en 64×32 wisselen foto en 3-regelige shoutout met een FLOQR + handle-kaart."
      },
      "help-club-display-screens": {
        title: "FLOQR-displayschermen",
        body: "Firebase clubLocations bewaart VenueSupports96x48, VenueSupports64x48 en VenueSupports64x32 als 0 of 1. templates bewaart Is96x48, Is64x48 en Is64x32 op dezelfde manier. Een venue toont een sjabloon alleen als minstens één paar 1 is. Xibo-URL’s blijven display.html?location=id en display2.html?location=id — schermgrootte zit niet in de URL. Birthday is beschikbaar op alle drie formaten (3 regels naast elkaar op 96×48; foto/shoutout-lus op 64×48 en 64×32). Primary is display.html. Secondary is display2.html."
      },
      "help-donpapi-led-wall": {
        title: "DonPapi ShoutOut LED-wand",
        body: "VIP ShoutOuts worden door busboys gedragen op de handheld DonPapi LED-wand — in de lucht gehouden voor gasten met het shoutout-bericht op het midden-scherm (clubnaam bovenaan, gloeiende witte festonrand). Tafel-LED’s (64×32) en portretwanden (960×1900) blijven voor andere formaten."
      },
      "help-staff-week-calendar": {
        title: "Planner",
        body: "Club Admin Scheduler is een weekraster mensen × dagen. Save shift sluit de editor met Schedule card successfully saved. Maak concepten, Publish schedule zodat medewerkers pending bevestigen tot confirmed, Select shifts om meerdere te verwijderen, en Website ingest om gepubliceerde diensten op de clubsites te zetten. Standaard dienstvenster = club open − 2 uur tot sluiting + 1 uur."
      },
      "help-staff-schedule-user-guide": {
        title: "Gebruikersgids personeelsplanning",
        body: "Open de ? naast Scheduler op Club Admin Scheduling. Maak conceptdiensten, Publish schedule zodat medewerkers pending→confirmed bevestigen, daarna Select shifts om er meerdere tegelijk te verwijderen. Voorbeeld: alle woensdagconcepten plus een donderdag confirmed-chip."
      },
      "help-create-publish-schedule": {
        title: "Personeelsrooster maken en publiceren",
        body: "Voeg conceptdiensten toe op het raster mensen × dagen, controleer chips, en Publish schedule. Medewerkers moeten bevestigen voordat een dienst confirmed wordt. FloqAi: create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Meerdere geplande of conceptdiensten verwijderen",
        body: "Select shifts, combineer dagkoppen en chips, daarna Delete selected. Voorbeeld: alle woensdagconcepten plus één donderdag confirmed dienst."
      },
      "help-staff-worksheet": {
        title: "Work Sheet — wekelijkse personeelskalender",
        body: "Gekozen service members openen Work Calendar in Settings. Inbox- / Email- / SMS-bevestigingslinks landen hier. Bekijk pending toewijzingen, vink elke dienst aan (of Select all), daarna Approve selected — het bericht openen bevestigt niet. Het weekraster toont gepubliceerde diensten van collega’s. Concepten blijven in Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Iedereen start als FLOQR-patron. Tik Elect to become a service member, kies servicerol en clubs, en dien onderaan in.\n\nProfielsjabloon-gids — patron-sociale profielen blijven onder Openbare media.\n\nClub Admin-goedkeuring — Club Admin → Employee/Workers → Pending Worker Requests, of Beoordelen en kiezen op dit tabblad."
      },
      "help-venue-website-ingest": {
        title: "Clubwebsite-ingest (API, RSS, iframe)",
        body: "Club Admin → Scheduling → Website ingest. Genereer een secret (eenmalig zichtbaar; alleen een hash wordt bewaard). Haal gepubliceerde diensten naar de officiële clubsites met JSON (?format=json&dataset=schedule|hours|profile|all), RSS of een iframe-snippet. Concepten, e-mail en telefoon van medewerkers zitten er nooit in. Roteer het secret bij lek."
      },
      "help-venue-hours-calendar": {
        title: "Openingstijden van de venue",
        body: "Op Club Public Profile stel je de standaard wekelijkse open/gesloten uren in, en voeg period overrides toe voor speciale weken zonder de standaard te verliezen. De openbare clubpagina toont een zo–za weekraster met datumbereik (bijv. Sun 9 – Sat 15, Aug 2026) en kalenderkleuren. Aankomende feestdagen tonen open/sluituren en markeren afwijkingen van de gebruikelijke weekdag. Staff Scheduling gebruikt open − 2u tot sluit + 1u. Guest List kan open avonden voorstellen."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin-venue toewijzing",
        body: "Club Admins openen het Venue Command Center alleen voor een club waaraan ze zijn toegewezen. admin.html zonder venue opent niet langer standaard Zebbies. Demo-accounts temp_clubadmin_N@floqr-demo.com horen bij temp-democlub-N. Niet-toegewezen admins vragen toewijzing aan bij Master Admin."
      },
      "help-general-notifications": {
        title: "Algemene meldingen",
        body: "SOS2FA en andere FloqR-systeemberichten volgen deze vlaggen in het gebruikersrecord van een patron. Venues of onafhankelijke service members moeten zich abonneren op betaalde SMS/WhatsApp Twilio-diensten."
      },
      "help-app-language": {
        title: "App-taal",
        body: "Bij eerste gebruik leest FloqR de browsertaal (bijvoorbeeld nl-NL → Dutch / Nederlands) en schakelt chrome en menu’s over wanneer die taal wordt ondersteund — Search-categorieën, My Profile-tabbladen, Club Admin-tabbladen en Master Admin-tabbladen. Niet-ondersteunde talen blijven Engels. Daarna winnen My Profile → App language en de opgeslagen profieltaal. App language opslaan vertaalt elke pagina die FLOQRI18n laadt, niet alleen deze kaart."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Open My Profile & Settings voor rollen, verkoperstools en accountopties."
      },
      "help-onboarding": {
        title: "Onboarding",
        body: "Patron- / service-member-onboarding — vraag Club Admin-, DJ-, Promoter- of hospitality-toegang aan. Master Admins kunnen ook venues onboarden."
      },
      "help-mingl-search": {
        title: "Over Mingl-zoeken",
        body: "Zoek openbare profielen op gedeelde interesses, lifestyle, muziek, reizen, eten, events, auto’s, stad, username of wie je wilt ontmoeten."
      },
      "help-default-template": {
        title: "Standaardsjabloon",
        body: "Gratis Traditional Black and White Classic. Gebruik FloqAi hieronder voor Sports-, Jersey-, VIP-, Humor-, Cars-, Video-, Pictures- en Ballers-sjablonen."
      },
      "help-floqai-template-search": {
        title: "FloqAi-sjabloonzoeken",
        body: "Tik op het bewegende FloqAi-merkteken (of wacht op de speech bubbles) en vraag om Sports, Jersey, NBA, NFL, Cars, Humor, VIP, Video, Pictures of Ballers."
      },
      "help-mingl-requests": {
        title: "Over Mingl Requests",
        body: "Verzonden en ontvangen Friend- of Mingl Requests verschijnen hier. Requests blijven op de hoofd-Mingl-pagina; geaccepteerde gesprekken openen in Mingl Chat."
      }
    },
    fr: {
      "floqai-ask-floqr": {
        title: "Demandez FloqR avec FloqAi",
        body: "Demandez FloqR avec FloqAi — appuyez sur la marque animée ou attendez l'invite, puis décrivez ce que vous voulez en mots simples. Produits : Mingl, RydR, BartR, ShoutOut, SupRstR (superstar), clubs. Objectifs : dites « je veux pouvoir… » (par ex. devenir Club Admin) ou « make me a superstar » pour les étapes et les liens."
      },
      "help-soccer-jersey": {
        title: "Maillot de football ShoutOut",
        body: "Recherchez Football, Jersey ou un pays/club (Tanzanie, Chelsea). Chaque carte du kit photo est le dos LED que vous verrez sur ShoutOut — Football · Maillot · Pays ou Club. Tailles 96×48, 64×48, 64×32. Le nom et la marque à 2 caractères superposent le kit ; les nombres restent justifiés au centre."
      },
      "help-suprstar": {
        title: "Fais de moi une supRstar / superstar",
        body: "Choisissez un lieu → aperçu par caméra privée → payez 20 $ (Stripe pop-out) → Club Admin approuve dans la file d'attente supRstar → Go live sur le tableau SupRStar. Comme un ShoutOut, mais en vidéo en direct. Les liens de prévisualisation utilisent des jetons secrets afin qu'ils ne puissent pas être devinés à partir de l'URL d'un club."
      },
      "help-become-club-admin": {
        title: "Devenez un Club Admin",
        body: "Demandez un accès Club Admin, puis obtenez l'approbation du lieu."
      },
      "help-become-dj": {
        title: "Devenez un DJ",
        body: "Choisissez DJ comme votre rôle de service et associez-vous à des clubs."
      },
      "help-become-promoter": {
        title: "Devenez un Promoter",
        body: "Demandez un accès Promoter aux listes d'invités et aux campagnes."
      },
      "help-role-profiles": {
        title: "Présentation des profils de rôle",
        body: "Découvrez comment fonctionnent les rôles Club Admin, DJ, Promoter et d'accueil."
      },
      "help-staff-scheduling": {
        title: "Calendrier et planificateur",
        body: "Le calendrier Club Admin affiche les cartes Brouillon (violet), En attente (ambre), Confirmé (vert) et Ouvert/non pourvu — chacune avec un statut écrit, pas seulement une couleur. Scheduler est la grille personnes × jours pour brouillon/publication. Website ingest / publicVenueCalendar ne renvoie que les affectations Confirmées. Une pastille verte Paid this month s'affiche pour les Club Admins quand staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Abonnements aux notifications Club SMS et WhatsApp",
        body: "Club Admin → Notifications : Send test alert utilise les cases actuellement cochées. L'application (et Push) écrit un message système en FloqR Inbox. Le courrier électronique utilise les adresses d'administrateur du club. SMS et WhatsApp ont toujours besoin d'un abonnement payant et d'un téléphone d'alerte E.164. Pilule verte = Firebase abonnement 1 (pack prépayé de 10$) ; rouge = 0. Si Send test alert renvoie Authentication Error - invalid username, Firebase secret TWILIO_ACCOUNT_SID doit être le SID du compte commençant par AC (34 caractères) de console.twilio.com — pas le jeton d'authentification ni une clé API (SK)."
      },
      "help-club-sms-notification": {
        title: "Abonnement aux notifications SMS",
        body: "La pastille SMS est verte lorsque Firebase smsSubscribed vaut 1 (pack prépayé 10 $, 466 crédits, ni mensuel ni annuel). Rouge/clignotant signifie 0 — ouvrez ? et appuyez sur Subscribe $10. Les crédits restants et la date du dernier paiement sont dans cette aide. Décochez SMS et Save pour suspendre les alertes sans perdre le pack payé."
      },
      "help-club-whatsapp-notification": {
        title: "Abonnement aux notifications WhatsApp",
        body: "La pastille WhatsApp est verte lorsque Firebase whatsappSubscribed vaut 1 (pack prépayé 10 $, 233 crédits, ni mensuel ni annuel). Rouge/clignotant signifie 0 — ouvrez ? et appuyez sur Subscribe $10. Les crédits restants et la date du dernier paiement sont dans cette aide. Décochez WhatsApp et Save pour suspendre les alertes sans perdre le pack payé."
      },
      "help-schedule-message-templates": {
        title: "Modèles de messages de planning",
        body: "Club Admin → Notifications → Message templates. Ce sont des System Messages (Inbox / Email / SMS / WhatsApp), pas des ShoutOuts. Modifiez le titre et le texte pour New shift needs confirmation, Schedule update, Shift confirmed et Shift declined. Placeholders : {club} {role} {when} {link} {worker}. La boîte Inbox du travailleur utilise Review & confirm shift — jamais Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Confirmer les shifts assignés",
        body: "Les liens Inbox / Email / SMS ouvrent Work Calendar. Examinez chaque affectation en attente, cochez-la (ou Select all), puis Approve selected. Ouvrir le lien ne confirme pas. Seul le service member assigné peut approuver — un Club Admin ne peut pas confirmer à sa place."
      },
      "help-template-catalog-report": {
        title: "Rapport de catalogue de modèles",
        body: "Répertorie chaque ShoutOut type de modèle et les tailles de LED qu'il prend en charge (Is96x48, Is64x48, Is64x32). Un lieu ne propose un modèle que lorsqu'au moins un de ces indicateurs est 1 et que l'indicateur VenueSupports* correspondant est 1. Les modèles d'anniversaire/média partagé sont 1 sur 96×48, 64×48 et 64×32. 96×48 correspond à 3 lignes côte à côte ; 64×48 et 64×32 bouclent la photo puis le cri sur 3 lignes avec une carte FLOQR + poignée."
      },
      "help-club-display-screens": {
        title: "FLOQR écrans d'affichage",
        body: "Firebase clubLocations stocke VenueSupports96x48, VenueSupports64x48 et VenueSupports64x32 sous la forme 0 ou 1. Les modèles stockent Is96x48, Is64x48 et Is64x32 de la même manière. Un lieu ne répertorie un modèle que lorsqu'au moins une paire vaut 1. Les URL Xibo restent display.html?location=id et display2.html?location=id — la taille de l'écran n'est pas dans l'URL. Anniversaire est proposé dans les trois tailles (3 lignes côte à côte sur 96×48 ; boucle photo/cri sur 64×48 et 64×32). Le principal est display.html. Le secondaire est display2.html."
      },
      "help-donpapi-led-wall": {
        title: "DonPapi ShoutOut Mur LED",
        body: "Les ShoutOut VIP sont transportés par des busboys sur le mur LED portatif DonPapi — tenus en l'air devant les clients avec le message crié sur l'écran central (nom du club en haut, bordure festonnée blanche brillante). Les LED de table (64×32) et les murs portraits (960×1900) restent pour les autres formats."
      },
      "help-staff-week-calendar": {
        title: "Planificateur",
        body: "Club Admin Scheduler est une grille de personnes × jours par semaine. Save shift ferme l'éditeur avec Schedule card successfully saved. Créez des brouillons, Publish schedule pour que les employés confirment en attente jusqu'à confirmation, Select shifts pour effectuer des suppressions multiples et Website ingest pour mettre les équipes publiées sur le site du club. Fenêtre de changement par défaut = club ouvert − 2 heures jusqu'à la fermeture + 1 heure."
      },
      "help-staff-schedule-user-guide": {
        title: "Guide de l'utilisateur de la planification du personnel",
        body: "Ouvrez le ? à côté de Planificateur dans Club Admin Planification. Créez des brouillons d'équipes, Publish schedule pour que les travailleurs confirment en attente → confirmé, puis Select shifts pour en supprimer plusieurs à la fois. Exemple : toutes les drafts du mercredi plus un jeton confirmé le jeudi."
      },
      "help-create-publish-schedule": {
        title: "Créer et publier un planning du personnel",
        body: "Ajoutez des équipes de brouillon sur la grille personnes × jours, examinez les puces, puis Publish schedule. Les travailleurs doivent confirmer avant qu'un quart de travail soit confirmé. FloqAi : create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Supprimer plusieurs équipes planifiées ou brouillons",
        body: "Select shifts, mélangez les têtes de jour et les chips, puis Delete selected. Exemple : toutes les ébauches du mercredi plus une équipe confirmée du jeudi."
      },
      "help-staff-worksheet": {
        title: "Feuille de travail - Calendrier hebdomadaire du personnel",
        body: "Les militaires élus ouvrent Work Calendar dans Paramètres. Les liens de confirmation Inbox / Email / SMS atterrissent ici. Vérifiez les missions en attente, cochez chaque équipe (ou Select all), puis Approve selected — l'ouverture du message ne confirme pas. La grille hebdomadaire montre les quarts de travail publiés des collègues. Les brouillons restent en Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Tout le monde commence comme patron FLOQR. Dans My Profile & Settings, appuyez sur Elect to become a service member pour ouvrir cet onglet. Choisissez votre rôle (Waitress, DJ, Promoter, etc.), sélectionnez un ou plusieurs clubs, puis soumettez en bas de page.\n\nGuide des modèles de profil — les profils sociaux patron restent dans Médias publics. Chaque rôle de service a son modèle sur Mon profil (Patron, Promoter, DJ, Waitress, Bus Boys or Security, Venue Manager).\n\nApprobation Club Admin — chaque Club Admin approuve après votre envoi : Club Admin → Employee/Workers → Pending Worker Requests, ou Réviser et élire sur cet onglet."
      },
      "help-venue-website-ingest": {
        title: "Ingestion du site Web du club (API, RSS, iframe)",
        body: "Club Admin → Planification → Website ingest. Générez un secret (affiché une fois ; seul un hachage est stocké). Affichez les équipes publiées sur le site Web officiel du club avec JSON (?format=json&dataset=schedule|hours|profile|all), RSS ou un extrait iframe. Les brouillons, les e-mails et les numéros de téléphone des employés ne sont jamais inclus. Faites pivoter le secret s’il fuit."
      },
      "help-venue-hours-calendar": {
        title: "Horaires d'ouverture du lieu",
        body: "Sur le profil public du club, définissez les heures d'ouverture/fermeture hebdomadaires par défaut, puis ajoutez des remplacements de période pour les semaines spéciales sans perdre la valeur par défaut. La page du club public affiche une grille hebdomadaire du dimanche au samedi avec la plage de dates (par exemple du dimanche 9 au samedi 15 août 2026) et la coloration du calendrier. Les jours fériés à venir répertorient les heures d'ouverture et de fermeture et avertissent lorsqu'elles diffèrent du jour de semaine habituel. Staff Scheduling utilise l'ouverture − 2h jusqu'à la fermeture + 1h. La liste d'invités peut suggérer des soirées portes ouvertes."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin affectation du lieu",
        body: "Les 3 joueurs n'ouvrent le Venue Command Center que pour le club auquel ils sont affectés. L'ouverture de admin.html sans lieu n'est plus par défaut Zebbies. Les comptes de démonstration temp_clubadmin_N@floqr-demo.com correspondent à temp-democlub-N. Les administrateurs non attribués demandent une affectation à Master Admin."
      },
      "help-general-notifications": {
        title: "Notifications générales",
        body: "SOS2FA et d'autres messages du système FloqR suivent ces indicateurs tels que définis dans l'enregistrement de votre utilisateur. Les sites ou les membres de services indépendants spécifiques doivent s'abonner aux services Twilio payants SMS/WhatsApp"
      },
      "help-app-language": {
        title: "Langue de l'application",
        body: "Lors de la première utilisation, FloqR lit la langue du navigateur (par exemple nl-NL → Néerlandais / Nederlands) et bascule le chrome et les menus vers cette langue lorsqu'elle est prise en charge : catégories de recherche, onglets Mon profil, onglets Club Admin et onglets Master Admin. Les langues non prises en charge restent en anglais. Après cela, Mon profil → Langue de l'application et la langue du profil enregistré gagnent. La langue de l'application de sauvegarde retraduit chaque page qui charge FLOQRI18n, pas seulement cette carte."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Ouvrez My Profile & Settings pour les rôles, les outils de vendeur et les options de compte."
      },
      "help-onboarding": {
        title: "Intégration",
        body: "Intégration des clients/membres de service : demandez un accès Club Admin, DJ, Promoter ou un accès d'hospitalité. Les Master Admins peuvent également embarquer sur des sites."
      },
      "help-mingl-search": {
        title: "À propos de la recherche Mingl",
        body: "Recherchez des profils publics par intérêts communs, style de vie, musique, voyages, nourriture, événements, voitures, ville, nom d'utilisateur ou personne que vous souhaitez rencontrer."
      },
      "help-default-template": {
        title: "Modèle par défaut",
        body: "Classique traditionnel noir et blanc gratuit. Utilisez FloqAi ci-dessous pour les modèles Sports, Jersey, VIP, Humour, Voitures, Vidéo, Images et Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi recherche de modèles",
        body: "Appuyez sur la marque FloqAi en mouvement (ou attendez ses bulles), puis demandez Sports, Jersey, NBA, NFL, Cars, Humour, VIP, Video, Pictures ou Ballers."
      },
      "help-mingl-requests": {
        title: "Environ Mingl demandes",
        body: "Les demandes d'ami ou Mingl envoyées et reçues apparaissent ici. Les demandes restent sur la page Mingl principale ; conversations acceptées ouvertes dans Mingl Chat."
      }
    },
    de: {
      "floqai-ask-floqr": {
        title: "Fragen Sie FloqR mit FloqAi",
        body: "Fragen Sie FloqR mit FloqAi – tippen Sie auf die animierte Markierung oder warten Sie auf die Aufforderung und geben Sie dann in einfachen Worten ein, was Sie möchten. Produkte: Mingl, RydR, BartR, ShoutOut, SupRstR (Superstar), Keulen. Ziele: Sagen Sie „Ich möchte in der Lage sein…“ (z. B. ein Club Admin werden) oder „make me a superstar“ für Schritte und Links."
      },
      "help-soccer-jersey": {
        title: "Fußballtrikot ShoutOut",
        body: "Suchen Sie nach Fußball, Trikot oder einem Land/Verein (Tansania, Chelsea). Jede Foto-Kit-Karte ist die LED-Rückseite, die Sie auf ShoutOut sehen – Fußball · Trikot · Land oder Verein. Größen 96×48, 64×48, 64×32. Name und zweistellige Markierung liegen über dem Kit; Zahlen bleiben mittig ausgerichtet."
      },
      "help-suprstar": {
        title: "Mach mich zu einem supRstar/Superstar",
        body: "Wählen Sie einen Veranstaltungsort → private Kameravorschau → zahlen Sie 20 $ (5 Pop-out) → Club Admin Genehmigungen in der supRstar-Warteschlange → Go live auf der SupRStar-Tafel. Wie ein ShoutOut, aber Live-Video. Vorschau-Links verwenden geheime Token, sodass sie nicht anhand einer Club-URL erraten werden können."
      },
      "help-become-club-admin": {
        title: "Werde ein Club Admin",
        body: "Fordern Sie Club Admin Zugang an und holen Sie dann die Genehmigung für den Veranstaltungsort ein."
      },
      "help-become-dj": {
        title: "Werde ein DJ",
        body: "Wählen Sie DJ als Ihre Servicerolle und verbinden Sie sich mit Clubs."
      },
      "help-become-promoter": {
        title: "Werde ein Promoter",
        body: "Fordern Sie Promoter Zugang für Gästelisten und Kampagnen an."
      },
      "help-role-profiles": {
        title: "Übersicht über Rollenprofile",
        body: "Sehen Sie, wie die Rollen Club Admin, DJ, Promoter und Gastgewerbe funktionieren."
      },
      "help-staff-scheduling": {
        title: "Kalender und Terminplaner",
        body: "Club Admin Der Kalender zeigt Karten „Entwurf“ (lila), „Ausstehend“ (gelb), „Bestätigt“ (grün) und „Offen/unausgefüllt“ an – jeweils mit einem geschriebenen Status, nicht nur mit Farbe. Der Planer ist das Personen × Tage-Entwurfs-/Veröffentlichungsraster. Website ingest / publicVenueCalendar gibt nur bestätigte Aufgaben zurück. Eine grüne „Diesen Monat bezahlt“-Pille wird für Club Admins angezeigt, wenn staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Benachrichtigungsabonnements für Club SMS und WhatsApp",
        body: "Club Admin → Benachrichtigungen: Send test alert verwendet die aktuell aktivierten Kästchen. In-App (und Push) schreibt eine Systemnachricht in FloqR Inbox. Für E-Mails werden Club-Administratoradressen verwendet. SMS und WhatsApp benötigen weiterhin ein kostenpflichtiges Abonnement sowie ein Alarmierungstelefon für E.164. Grüne Pille = Firebase Abonnement 1 (Prepaid-Paket im Wert von 10 $); rot = 0. Wenn Send test alert Authentication Error - invalid username zurückgibt, muss Firebase Secret TWILIO_ACCOUNT_SID die Konto-SID beginnend mit AC (34 Zeichen) von console.twilio.com sein – nicht das Auth-Token und kein API-Schlüssel (SK)."
      },
      "help-club-sms-notification": {
        title: "SMS Benachrichtigungsabonnement",
        body: "Die SMS-Pille ist grün, wenn Firebase smsSubscribed 1 ist (Prepaid-$10-Packung, 466 Credits, nicht monatlich oder jährlich). Rot/Blinken bedeutet 0 – offen? und tippen Sie auf Subscribe $10. Die verbleibenden Credits und das Datum der letzten Zahlung finden Sie in dieser Hilfe. Deaktivieren Sie SMS und „Speichern“, um Benachrichtigungen anzuhalten, ohne das kostenpflichtige Paket zu verlieren."
      },
      "help-club-whatsapp-notification": {
        title: "WhatsApp Benachrichtigungsabonnement",
        body: "Die WhatsApp-Pille ist grün, wenn Firebase whatsappSubscribed 1 ist (Prepaid-$10-Packung, 233 Credits, nicht monatlich oder jährlich). Rot/Blinken bedeutet 0 – offen? und tippen Sie auf Subscribe $10. Die verbleibenden Credits und das Datum der letzten Zahlung finden Sie in dieser Hilfe. Deaktivieren Sie WhatsApp und „Speichern“, um Benachrichtigungen anzuhalten, ohne das kostenpflichtige Paket zu verlieren."
      },
      "help-schedule-message-templates": {
        title: "Planen Sie Nachrichtenvorlagen",
        body: "Club Admin → Benachrichtigungen → Message templates. Dies sind Systemnachrichten (Inbox / E-Mail / SMS / WhatsApp), nicht ShoutOuts. Titel und Text für New shift needs confirmation bearbeiten, Zeitplan aktualisieren, Schicht bestätigt und Schicht abgelehnt. Platzhalter: {club} {role} {when} {link} {worker}. Der Posteingang des Mitarbeiters verwendet Review & confirm shift – niemals Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Bestätigen Sie zugewiesene Schichten",
        body: "Inbox / E-Mail / SMS Links öffnen Work Calendar. Schauen Sie sich jede ausstehende Aufgabe an, kreuzen Sie sie an (oder Select all) und dann Approve selected. Das Öffnen des Links führt zu keiner Bestätigung. Nur der zugewiesene Servicemitarbeiter kann genehmigen – Club Admin kann nicht in seinem Namen bestätigen."
      },
      "help-template-catalog-report": {
        title: "Vorlagenkatalogbericht",
        body: "Listet jeden ShoutOut-Vorlagentyp und die unterstützten LED-Größen auf (Is96x48, Is64x48, Is64x32). Ein Veranstaltungsort bietet nur dann eine Vorlage an, wenn mindestens eines dieser Flags 1 ist und das entsprechende VenueSupports*-Flag 1 ist. Geburtstags-/Split-Media-Vorlagen sind 1 auf 96×48, 64×48 und 64×32. 96×48 ist 3-zeilig nebeneinander; 64×48 und 64×32 Schleife des Fotos, dann der 3-zeilige Shoutout mit einer FLOQR + Handle-Karte."
      },
      "help-club-display-screens": {
        title: "FLOQR Anzeigebildschirme",
        body: "Firebase clubLocations speichert VenueSupports96x48, VenueSupports64x48 und VenueSupports64x32 als 0 oder 1. templates speichert Is96x48, Is64x48 und Is64x32 auf die gleiche Weise. Ein Veranstaltungsort listet nur dann eine Vorlage auf, wenn mindestens ein Paar 1 ist. Xibo-URLs bleiben display.html?location=id und display2.html?location=id – die Bildschirmgröße ist nicht in der URL enthalten. „Geburtstag“ wird in allen drei Größen angeboten (dreizeilig nebeneinander auf 96×48; Foto-/Shoutout-Schleife auf 64×48 und 64×32). Primär ist display.html. Sekundär ist display2.html."
      },
      "help-donpapi-led-wall": {
        title: "DonPapi ShoutOut LED-Wand",
        body: "VIP-Fans werden von Busboys auf der tragbaren DonPapi-LED-Wand getragen – sie werden vor den Gästen in die Luft gehalten, mit der Shoutout-Botschaft auf dem mittleren Bildschirm (Clubname oben, leuchtend weißer Wellenrand). Für andere Formate bleiben Tisch-LEDs (64×32) und Hochformatwände (960×1900) übrig."
      },
      "help-staff-week-calendar": {
        title: "Planer",
        body: "Club Admin Scheduler ist ein Personen-×-Tage-Wochen-Raster. Save shift schließt den Editor mit Schedule card successfully saved. Erstellen Sie Entwürfe, Publish schedule, damit die Mitarbeiter die ausstehenden Arbeiten bis zur Bestätigung bestätigen, Select shifts, um sie mehrfach zu löschen, und Website ingest, um veröffentlichte Schichten auf der Club-Website zu veröffentlichen. Standardmäßiges Schichtfenster = geöffneter Club – 2 Stunden bis Schließung + 1 Stunde."
      },
      "help-staff-schedule-user-guide": {
        title: "Benutzerhandbuch zur Personalplanung",
        body: "Öffnen Sie das ? neben Scheduler auf Club Admin Scheduling. Erstellen Sie Entwurfsschichten, Publish schedule, damit die Mitarbeiter ausstehend→bestätigt bestätigen, und dann Select shifts, um mehrere auf einmal zu löschen. Beispiel: alle Mittwochs-Drafts plus ein am Donnerstag bestätigter Chip."
      },
      "help-create-publish-schedule": {
        title: "Erstellen und veröffentlichen Sie einen Personalplan",
        body: "Fügen Sie Entwurfsschichten im Raster „Personen × Tage“ hinzu, überprüfen Sie die Chips und dann Publish schedule. Arbeiter müssen bestätigen, bevor eine Schicht bestätigt wird. FloqAi: create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Löschen Sie mehrere geplante oder Entwurfsschichten",
        body: "Select shifts, Tagesköpfe und Chips mischen, dann Delete selected. Beispiel: alle Entwürfe am Mittwoch plus eine bestätigte Schicht am Donnerstag."
      },
      "help-staff-worksheet": {
        title: "Arbeitsblatt – Wöchentlicher Personalkalender",
        body: "Ausgewählte Servicemitglieder öffnen Work Calendar in den Einstellungen. Inbox / E-Mail / SMS Bestätigungslinks landen hier. Überprüfen Sie ausstehende Aufgaben, kreuzen Sie jede Schicht an (oder Select all) und dann Approve selected – das Öffnen der Nachricht führt nicht zu einer Bestätigung. Das Wochenraster zeigt veröffentlichte Kollegenschichten. Entwürfe bleiben in Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Alle beginnen als FLOQR-Patron. In My Profile & Settings tippen Sie Elect to become a service member. Wählen Sie Ihre Service-Rolle, Clubs, und senden Sie unten auf der Seite.\n\nProfilvorlagen-Leitfaden — Patron-Sozialprofile bleiben unter Öffentliche Medien. Service-Rollen nutzen eigene Vorlagen auf Mein Profil.\n\nClub-Admin-Genehmigung — Club Admin → Employee/Workers → Pending Worker Requests, oder Prüfen und wählen auf diesem Tab."
      },
      "help-venue-website-ingest": {
        title: "Aufnahme der Club-Website (API, RSS, Iframe)",
        body: "Club Admin → Terminplanung → Website ingest. Generieren Sie ein Geheimnis (wird einmal angezeigt; es wird nur ein Hash gespeichert). Ziehen Sie veröffentlichte Personalschichten mit JSON (?format=json&dataset=schedule|hours|profile|all), RSS oder einem Iframe-Snippet auf die offizielle Club-Website. Entwürfe, E-Mail-Adressen des Mitarbeiters und Telefonnummern sind niemals enthalten. Drehen Sie das Geheimnis, wenn es ausläuft."
      },
      "help-venue-hours-calendar": {
        title: "Öffnungszeiten des Veranstaltungsortes",
        body: "Legen Sie im öffentlichen Profil des Clubs die standardmäßigen wöchentlichen Öffnungs-/Schließzeiten fest und fügen Sie dann Periodenüberschreibungen für besondere Wochen hinzu, ohne die Standardeinstellung zu verlieren. Die öffentliche Clubseite zeigt ein So-Sa-Wochenraster mit dem Datumsbereich (z. B. So, 9. – Sa, 15. August 2026) und Kalenderfarben. Anstehende Feiertage listen die Öffnungs-/Schließzeiten auf und weisen Sie darauf hin, wenn diese vom üblichen Wochentag abweichen. Die Personaleinsatzplanung verwendet Öffnungszeit − 2 Stunden bis Schließungszeit + 1 Stunde. Die Gästeliste kann Ihnen Abende der offenen Tür vorschlagen."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin Veranstaltungsortzuweisung",
        body: "Club Admins öffnen das Venue Command Center nur für einen Club, dem sie zugewiesen sind. Beim Öffnen von admin.html ohne Veranstaltungsort wird nicht mehr standardmäßig Zebbies verwendet. Demokonten temp_clubadmin_N@floqr-demo.com sind temp-democlub-N zugeordnet. Nicht zugewiesene Administratoren beantragen eine Zuweisung ab Master Admin."
      },
      "help-general-notifications": {
        title: "Allgemeine Benachrichtigungen",
        body: "SOS2FA und andere FloqR-Systemmeldungen folgen diesen Flags, die in einem Benutzerdatensatz Ihres Benutzers festgelegt sind. Veranstaltungsorte oder bestimmte unabhängige Servicemitglieder müssen kostenpflichtige Twilio-Dienste für SMS/WhatsApp abonnieren"
      },
      "help-app-language": {
        title: "App-Sprache",
        body: "Bei der ersten Verwendung liest FloqR die Browsersprache (zum Beispiel nl-NL → Niederländisch / Nederlands) und schaltet Chrome und Menüs auf diese Sprache um, sofern diese unterstützt wird – Suchkategorien, Registerkarten „Mein Profil“, Club Admin-Registerkarten und Master Admin-Registerkarten. Nicht unterstützte Sprachen bleiben auf Englisch. Danach gewinnen Mein Profil → App-Sprache und die gespeicherte Profilsprache. Beim Speichern der App-Sprache wird jede Seite, die FLOQRI18n lädt, neu übersetzt, nicht nur diese Karte."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Öffnen Sie My Profile & Settings für Rollen, Verkäufer-Tools und Kontooptionen."
      },
      "help-onboarding": {
        title: "Onboarding",
        body: "Onboarding von Gönnern/Service-Mitgliedern – Fordern Sie Club Admin, DJ, Promoter oder Hospitality-Zugang an. Master Admins können auch Veranstaltungsorte an Bord nehmen."
      },
      "help-mingl-search": {
        title: "Etwa Mingl Suche",
        body: "Durchsuchen Sie öffentliche Profile nach gemeinsamen Interessen, Lebensstil, Musik, Reisen, Essen, Veranstaltungen, Autos, Stadt, Benutzername oder wem Sie treffen möchten."
      },
      "help-default-template": {
        title: "Standardvorlage",
        body: "Kostenloser traditioneller Schwarz-Weiß-Klassiker. Verwenden Sie FloqAi unten für die Vorlagen „Sport“, „Trikot“, „VIP“, „Humor“, „Autos“, „Video“, „Bilder“ und „Baller“."
      },
      "help-floqai-template-search": {
        title: "FloqAi Vorlagensuche",
        body: "Tippen Sie auf die bewegliche FloqAi-Marke (oder warten Sie auf die Sprechblasen) und fragen Sie dann nach „Sport“, „Trikot“, „NBA“, „NFL“, „Autos“, „Humor“, „VIP“, „Video“, „Bilder“ oder „Ballspieler“."
      },
      "help-mingl-requests": {
        title: "Ungefähr Mingl Anfragen",
        body: "Gesendete und empfangene Freundschafts- oder Mingl-Anfragen werden hier angezeigt. Anfragen bleiben auf der Mingl-Hauptseite; Akzeptierte Konversationen werden im Mingl Chat geöffnet."
      }
    },
    es: {
      "floqai-ask-floqr": {
        title: "Pregunta FloqR con FloqAi",
        body: "Pregunta FloqR con FloqAi: toca la marca animada o espera el mensaje y luego escribe lo que quieras en palabras sencillas. Productos: Mingl, RydR, BartR, ShoutOut, SupRstR (superestrella), palos. Metas: diga “Quiero poder…” (por ejemplo, convertirme en Club Admin) o “make me a superstar” para conocer los pasos y enlaces."
      },
      "help-soccer-jersey": {
        title: "Camiseta de fútbol ShoutOut",
        body: "Busque fútbol, ​​camiseta o un país/club (Tanzania, Chelsea). Cada tarjeta del kit fotográfico es el LED posterior que verás en ShoutOut — Fútbol · Camiseta · País o Club. Medidas 96×48, 64×48, 64×32. El nombre y la marca de 2 caracteres se superponen en el kit; los números permanecen justificados en el centro."
      },
      "help-suprstar": {
        title: "Hazme un supRstar / superestrella",
        body: "Elija un lugar → vista previa de cámara privada → pague $20 (Stripe ventana emergente) → Club Admin aprueba en la cola supRstar → Go live en el tablero SupRStar. Como un ShoutOut, pero vídeo en directo. Los enlaces de vista previa utilizan tokens secretos para que no se puedan adivinar a partir de la URL de un club."
      },
      "help-become-club-admin": {
        title: "Conviértete en un Club Admin",
        body: "Solicite acceso Club Admin y luego obtenga la aprobación del lugar."
      },
      "help-become-dj": {
        title: "Conviértete en un DJ",
        body: "Elija DJ como su función de servicio y asóciese con clubes."
      },
      "help-become-promoter": {
        title: "Conviértete en un Promoter",
        body: "Solicite acceso Promoter para listas de invitados y campañas."
      },
      "help-role-profiles": {
        title: "Descripción general de los perfiles de roles",
        body: "Vea cómo funcionan los roles Club Admin, DJ, Promoter y hospitalidad."
      },
      "help-staff-scheduling": {
        title: "Calendario y programador",
        body: "Club Admin El calendario muestra tarjetas Borrador (morado), Pendiente (ámbar), Confirmado (verde) y Abierto/sin completar, cada una con un estado escrito, no solo con un color. El programador es la cuadrícula de borrador/publicación de personas × días. Website ingest / publicVenueCalendar devuelve solo asignaciones confirmadas. Se muestra que una pastilla verde Pagada este mes es Club Admins cuando staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Suscripciones de notificación del club SMS y WhatsApp",
        body: "Club Admin → Notificaciones: Send test alert usa las casillas actualmente marcadas. In-app (y Push) escribe un mensaje del sistema en FloqR Inbox. El correo electrónico utiliza direcciones de administrador del club. SMS y WhatsApp aún necesitan una suscripción paga más un teléfono de alerta E.164. Pastilla verde = Firebase suscripción 1 (paquete prepago de $10); rojo = 0. Si Send test alert devuelve Authentication Error - invalid username, Firebase secreto TWILIO_ACCOUNT_SID debe ser el SID de cuenta que comienza con AC (34 caracteres) de console.twilio.com, no el token de autenticación ni una clave API (SK)."
      },
      "help-club-sms-notification": {
        title: "SMS suscripción de notificación",
        body: "La píldora SMS es verde cuando Firebase smsSubscribed es 1 (paquete prepago de $10, 466 créditos, no mensual ni anual). Rojo/intermitente significa 0: ¿abierto? y toque Subscribe $10. Los créditos restantes y la fecha del último pago se encuentran en esta ayuda. Desmarque SMS y Guardar para pausar las alertas sin perder el paquete pago."
      },
      "help-club-whatsapp-notification": {
        title: "WhatsApp suscripción de notificación",
        body: "La píldora WhatsApp es verde cuando Firebase whatsappSubscribed es 1 (paquete prepago de $10, 233 créditos, no mensual ni anual). Rojo/intermitente significa 0: ¿abierto? y toque Subscribe $10. Los créditos restantes y la fecha del último pago se encuentran en esta ayuda. Desmarque WhatsApp y Guardar para pausar las alertas sin perder el paquete pago."
      },
      "help-schedule-message-templates": {
        title: "Programar plantillas de mensajes",
        body: "Club Admin → Notificaciones → Message templates. Estos son mensajes del sistema (Inbox / correo electrónico / SMS / WhatsApp), no ShoutOut. Edite el título y el cuerpo de New shift needs confirmation, Actualización de programación, Turno confirmado y Turno rechazado. Marcadores de posición: {club} {role} {when} {link} {worker}. La bandeja de entrada del trabajador usa Review & confirm shift, nunca Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Confirmar turnos asignados",
        body: "Inbox / Correo electrónico / SMS enlaces abiertos Work Calendar. Mire cada tarea pendiente, márquela (o Select all), luego Approve selected. Abrir el enlace no confirma. Solo el miembro del servicio asignado puede aprobar; Club Admin no puede confirmar en su nombre."
      },
      "help-template-catalog-report": {
        title: "Informe de catálogo de plantillas",
        body: "Enumera cada tipo de plantilla ShoutOut y qué tamaños de LED admite (Is96x48, Is64x48, Is64x32). Un lugar solo ofrece una plantilla cuando al menos una de esas banderas es 1 y la bandera VenueSupports* correspondiente es 1. Las plantillas de cumpleaños/medios divididos son 1 en 96×48, 64×48 y 64×32. 96 × 48 tiene 3 líneas una al lado de la otra; 64×48 y 64×32 repiten la foto y luego el mensaje de 3 líneas con una tarjeta de mango FLOQR +."
      },
      "help-club-display-screens": {
        title: "FLOQR pantallas de visualización",
        body: "Firebase clubLocations almacena VenueSupports96x48, VenueSupports64x48 y VenueSupports64x32 como 0 o 1. Las plantillas almacenan Is96x48, Is64x48 y Is64x32 de la misma manera. Un lugar solo enumera una plantilla cuando al menos un par es 1. Las URL de Xibo permanecen display.html?location=id y display2.html?location=id: el tamaño de la pantalla no está en la URL. Cumpleaños se ofrece en los tres tamaños (3 líneas una al lado de la otra en 96×48; bucle de foto/grito en 64×48 y 64×32). El principal es display.html. El secundario es display2.html."
      },
      "help-donpapi-led-wall": {
        title: "DonPapi ShoutOut Pared LED",
        body: "Los camareros llevan a los VIP ShoutOut en la pared LED DonPapi portátil, sostenida en el aire frente a los clientes con el mensaje de agradecimiento en la pantalla central (nombre del club en la parte superior, borde festoneado blanco brillante). Para otros formatos quedan los LED de mesa (64×32) y las paredes verticales (960×1900)."
      },
      "help-staff-week-calendar": {
        title: "Programador",
        body: "Club Admin El programador es una cuadrícula de personas × días de la semana. Save shift cierra el editor con Schedule card successfully saved. Cree borradores, Publish schedule para que los trabajadores confirmen pendientes hasta que se confirmen, Select shifts para realizar una eliminación múltiple y Website ingest para colocar los turnos publicados en el sitio del club. Ventana de turno predeterminada = club abierto − 2 horas hasta el cierre + 1 hora."
      },
      "help-staff-schedule-user-guide": {
        title: "Guía del usuario de programación de personal",
        body: "Abrir el ? al lado de Programador en Club Admin Programación. Cree borradores de turnos, Publish schedule para que los trabajadores confirmen pendientes → confirmados, luego Select shifts para eliminar varios a la vez. Ejemplo: todos los drafts del miércoles más una ficha confirmada el jueves."
      },
      "help-create-publish-schedule": {
        title: "Crear y publicar un horario de personal",
        body: "Agregue turnos preliminares en la cuadrícula de personas x días, revise los chips y luego Publish schedule. Los trabajadores deben confirmar antes de que se confirme un turno. FloqAi: create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Eliminar múltiples turnos programados o borradores",
        body: "Select shifts, mezcle las cabezas del día y las patatas fritas, luego Delete selected. Ejemplo: todos los borradores del miércoles más un turno confirmado del jueves."
      },
      "help-staff-worksheet": {
        title: "Hoja de Trabajo - Calendario Semanal del Personal",
        body: "Los miembros del servicio electos abren Work Calendar en Configuración. Inbox / Correo electrónico / SMS enlaces de confirmación llegan aquí. Revise las tareas pendientes, marque cada turno (o Select all), luego Approve selected; abrir el mensaje no confirma. La cuadrícula semanal muestra los turnos de colegas publicados. Los borradores se quedan en Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Todos empiezan como patron FLOQR. En My Profile & Settings pulse Elect to become a service member, elija rol, clubs y envíe al final de la página.\n\nGuía de plantillas de perfil — los perfiles sociales patron siguen en Medios públicos. Cada rol de servicio usa su plantilla en Mi perfil.\n\nAprobación Club Admin — Club Admin → Employee/Workers → Pending Worker Requests, o Revisar y elegir en esta pestaña."
      },
      "help-venue-website-ingest": {
        title: "Ingesta del sitio web del club (API, RSS, iframe)",
        body: "Club Admin → Programación → Website ingest. Genera un secreto (se muestra una vez; solo se almacena un hash). Introduzca los turnos del personal publicados en el sitio web oficial del club con JSON (?format=json&dataset=schedule|hours|profile|all), RSS o un fragmento de iframe. Los borradores, el correo electrónico de los trabajadores y el teléfono nunca se incluyen. Gire el secreto si gotea."
      },
      "help-venue-hours-calendar": {
        title: "Horario de apertura del lugar",
        body: "En el perfil público del club, establezca el horario de apertura/cierre semanal predeterminado y luego agregue anulaciones de períodos para semanas especiales sin perder el horario predeterminado. La página pública del club muestra una cuadrícula de la semana de domingo a sábado con el rango de fechas (por ejemplo, del domingo 9 al sábado 15 de agosto de 2026) y el color del calendario. Los próximos días festivos enumeran los horarios de apertura y cierre y avisan cuando difieren del día habitual de la semana. La programación del personal utiliza abierto − 2 h hasta cierre + 1 h. La lista de invitados puede sugerir noches de puertas abiertas."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin asignación de lugar",
        body: "Los 3 solo abren el Centro de comando del lugar para un club al que están asignados. Abrir admin.html sin un lugar ya no es el predeterminado Zebbies. Las cuentas de demostración temp_clubadmin_N@floqr-demo.com se asignan a temp-democlub-N. Los administradores no asignados solicitan la asignación desde Master Admin."
      },
      "help-general-notifications": {
        title: "Notificaciones generales",
        body: "SOS2FA y otros mensajes del sistema FloqR siguen estas banderas según lo establecido en su registro de usuario. Los lugares o miembros del servicio independientes específicos deben suscribirse a servicios pagos de SMS/WhatsApp Twilio."
      },
      "help-app-language": {
        title: "Idioma de la aplicación",
        body: "En el primer uso, FloqR lee el idioma del navegador (por ejemplo, nl-NL → Holandés/Nederlands) y cambia Chrome y los menús a ese idioma cuando sea compatible: categorías de búsqueda, pestañas Mi perfil, pestañas Club Admin y pestañas Master Admin. Los idiomas no admitidos permanecen en inglés. Después de eso, ganan Mi perfil → Idioma de la aplicación y el idioma del perfil guardado. Al guardar el idioma de la aplicación, se vuelve a traducir cada página que se carga FLOQRI18n, no solo esta tarjeta."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Abra My Profile & Settings para funciones, herramientas de vendedor y opciones de cuenta."
      },
      "help-onboarding": {
        title: "Incorporación",
        body: "Incorporación de patrón/miembro del servicio: solicite Club Admin, DJ, Promoter o acceso de hospitalidad. Los Master Admins también pueden incorporar lugares."
      },
      "help-mingl-search": {
        title: "Acerca de la búsqueda Mingl",
        body: "Busque perfiles públicos por intereses compartidos, estilo de vida, música, viajes, comida, eventos, automóviles, ciudad, nombre de usuario o a quién desea conocer."
      },
      "help-default-template": {
        title: "Plantilla predeterminada",
        body: "Clásico tradicional en blanco y negro gratuito. Utilice FloqAi a continuación para plantillas de Deportes, Jersey, VIP, Humor, Autos, Vídeo, Imágenes y Jugadores."
      },
      "help-floqai-template-search": {
        title: "FloqAi búsqueda de plantillas",
        body: "Toque la marca FloqAi en movimiento (o espere a que aparezcan los globos de diálogo) y luego pregunte por Deportes, Jersey, NBA, NFL, Autos, Humor, VIP, Video, Imágenes o Jugadores de béisbol."
      },
      "help-mingl-requests": {
        title: "Acerca de Mingl Solicitudes",
        body: "Las solicitudes de amigo o Mingl enviadas y recibidas aparecen aquí. Las solicitudes permanecen en la página principal Mingl; Las conversaciones aceptadas se abren en Mingl Chat."
      }
    },
    it: {
      "floqai-ask-floqr": {
        title: "Chiedi FloqR con FloqAi",
        body: "Chiedi FloqR con FloqAi: tocca il segno animato o attendi il messaggio, quindi digita ciò che desideri in parole semplici. Prodotti: Mingl, RydR, BartR, ShoutOut, SupRstR (superstar), mazze. Obiettivi: dì \"Voglio poter...\" (ad esempio diventare un Club Admin) o \"make me a superstar\" per passaggi e collegamenti."
      },
      "help-soccer-jersey": {
        title: "Maglia da calcio ShoutOut",
        body: "Cerca calcio, maglia o un paese/club (Tanzania, Chelsea). Ogni scheda del kit fotografico è il retro LED che vedrai su ShoutOut — Calcio · Maglia · Nazione o Club. Formati 96×48, 64×48, 64×32. Nome e marchio di 2 caratteri sovrapposti al kit; i numeri rimangono giustificati al centro."
      },
      "help-suprstar": {
        title: "Fammi un supRstar / superstar",
        body: "Scegli un luogo → anteprima tramite telecamera privata → paga $ 20 (Stripe pop-out) → Club Admin approva nella coda supRstar → Go live sulla bacheca SupRStar. Come un ShoutOut, ma video dal vivo. I collegamenti di anteprima utilizzano token segreti in modo che non possano essere indovinati dall'URL di un club."
      },
      "help-become-club-admin": {
        title: "Diventa un Club Admin",
        body: "Richiedi l'accesso Club Admin, quindi ottieni l'approvazione della sede."
      },
      "help-become-dj": {
        title: "Diventa un DJ",
        body: "Scegli DJ come tuo ruolo di servizio e associalo ai club."
      },
      "help-become-promoter": {
        title: "Diventa un Promoter",
        body: "Richiedi l'accesso Promoter per elenchi di invitati e campagne."
      },
      "help-role-profiles": {
        title: "Panoramica dei profili di ruolo",
        body: "Scopri come funzionano i ruoli Club Admin, DJ, Promoter e ospitalità."
      },
      "help-staff-scheduling": {
        title: "Calendario e pianificazione",
        body: "Club Admin Il calendario mostra le carte Bozza (viola), In sospeso (ambra), Confermata (verde) e Aperte/non compilate, ciascuna con uno stato scritto, non solo il colore. Lo strumento di pianificazione è la griglia di bozze/pubblicazioni persone x giorni. Website ingest / publicVenueCalendar restituisce solo le assegnazioni confermate. Una pillola verde pagata questo mese viene mostrata a Club Admins quando staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Abbonamenti alle notifiche Club SMS e WhatsApp",
        body: "Club Admin → Notifiche: Send test alert utilizza le caselle attualmente selezionate. In-app (e Push) scrive un messaggio di sistema in FloqR Inbox. L'e-mail utilizza gli indirizzi dell'amministratore del club. SMS e WhatsApp necessitano ancora di un abbonamento a pagamento più un telefono di allarme E.164. Pillola verde = abbonamento da Firebase 1 (pacchetto prepagato da $ 10); rosso = 0. Se Send test alert restituisce Authentication Error - invalid username, Firebase segreto TWILIO_ACCOUNT_SID deve essere il SID dell'account che inizia con AC (34 caratteri) da console.twilio.com — non il token di autenticazione e non una chiave API (SK)."
      },
      "help-club-sms-notification": {
        title: "SMS abbonamento alle notifiche",
        body: "La pillola SMS è verde quando Firebase smsSubscribed è 1 (pacchetto prepagato da $ 10, 466 crediti, non mensile o annuale). Rosso/lampeggiante significa 0 — aperto? e tocca Subscribe $10. I crediti rimanenti e la data dell'ultimo pagamento si trovano in questa guida. Deseleziona SMS e Salva per mettere in pausa gli avvisi senza perdere il pacchetto a pagamento."
      },
      "help-club-whatsapp-notification": {
        title: "WhatsApp abbonamento alle notifiche",
        body: "La pillola da WhatsApp è verde quando Firebase whatsappSubscribed è 1 (pacchetto prepagato da $ 10, 233 crediti, non mensile o annuale). Rosso/lampeggiante significa 0 — aperto? e tocca Subscribe $10. I crediti rimanenti e la data dell'ultimo pagamento si trovano in questa guida. Deseleziona WhatsApp e Salva per mettere in pausa gli avvisi senza perdere il pacchetto pagato."
      },
      "help-schedule-message-templates": {
        title: "Pianifica modelli di messaggi",
        body: "Club Admin → Notifiche → Message templates. Questi sono messaggi di sistema (Inbox / Email / SMS / WhatsApp), non ShoutOut. Modifica titolo e corpo per New shift needs confirmation, Aggiornamento programma, Turno confermato e Turno rifiutato. Segnaposto: {club} {role} {when} {link} {worker}. La posta in arrivo del lavoratore utilizza Review & confirm shift, mai Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Conferma i turni assegnati",
        body: "Inbox / E-mail / SMS i collegamenti si aprono Work Calendar. Guarda ogni compito in sospeso, selezionalo (o Select all), quindi Approve selected. L'apertura del collegamento non conferma. Solo il membro del servizio assegnato può approvare: Club Admin non può confermare per suo conto."
      },
      "help-template-catalog-report": {
        title: "Rapporto sul catalogo dei modelli",
        body: "Elenca ogni tipo di modello ShoutOut e le dimensioni dei LED supportati (Is96x48, Is64x48, Is64x32). Una sede offre un modello solo quando almeno uno di questi flag è 1 e il flag VenueSupports* corrispondente è 1. I modelli Compleanno/Split-Media sono 1 su 96×48, 64×48 e 64×32. 96×48 è a 3 righe affiancate; 64×48 e 64×32 mettono in loop la foto, quindi il messaggio di 3 righe con una carta FLOQR + maniglia."
      },
      "help-club-display-screens": {
        title: "FLOQR schermate di visualizzazione",
        body: "Firebase clubLocations memorizza VenueSupports96x48, VenueSupports64x48 e VenueSupports64x32 come 0 o 1. I modelli memorizza Is96x48, Is64x48 e Is64x32 allo stesso modo. Una sede elenca un modello solo quando almeno una coppia è 1. Gli URL Xibo rimangono display.html?location=id e display2.html?location=id: la dimensione dello schermo non è nell'URL. Birthday è disponibile in tutti e tre i formati (3 righe affiancate su 96×48; ciclo di foto/scherzi su 64×48 e 64×32). Il principale è display.html. Il secondario è display2.html."
      },
      "help-donpapi-led-wall": {
        title: "DonPapi ShoutOut Parete LED",
        body: "I VIP vengono trasportati dai camerieri sulla parete LED portatile DonPapi, tenuta in aria davanti agli avventori con il messaggio di ringraziamento sullo schermo centrale (nome del club in alto, bordo smerlato bianco brillante). Per gli altri formati rimangono i LED da tavolo (64×32) e le pareti verticali (960×1900)."
      },
      "help-staff-week-calendar": {
        title: "Pianificatore",
        body: "Club Admin Lo Scheduler è una griglia persone x giorni settimana. Save shift chiude l'editor con Schedule card successfully saved. Crea bozze, Publish schedule in modo che i lavoratori confermino in sospeso fino alla conferma, Select shifts per eliminare più volte e Website ingest per inserire i turni pubblicati sul sito del club. Finestra di turno predefinita = club aperto − 2 ore fino alla chiusura + 1 ora."
      },
      "help-staff-schedule-user-guide": {
        title: "Guida per l'utente alla pianificazione del personale",
        body: "Apri il ? accanto a Pianificatore in Club Admin Pianificazione. Crea una bozza di turni, Publish schedule in modo che i lavoratori confermino in sospeso→confermato, quindi Select shifts per eliminarne diversi contemporaneamente. Esempio: tutti i draft del mercoledì più una fiche confermata del giovedì."
      },
      "help-create-publish-schedule": {
        title: "Creare e pubblicare un programma del personale",
        body: "Aggiungi i turni provvisori sulla griglia persone x giorni, rivedi i chip, quindi Publish schedule. I lavoratori devono confermare prima che un turno venga confermato. FloqAi: create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Elimina più turni programmati o bozze",
        body: "Select shifts, mescola le intestazioni del giorno e le fiches, quindi Delete selected. Esempio: tutte le bozze del mercoledì più un turno confermato del giovedì."
      },
      "help-staff-worksheet": {
        title: "Foglio di lavoro - Calendario settimanale del personale",
        body: "I membri del servizio eletti aprono Work Calendar in Impostazioni. I link di conferma Inbox / E-mail / SMS arrivano qui. Rivedi i compiti in sospeso, seleziona ogni turno (o Select all), quindi Approve selected: l'apertura del messaggio non conferma. La griglia settimanale mostra i turni dei colleghi pubblicati. Le bozze restano in Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Tutti iniziano come patron FLOQR. In My Profile & Settings tocca Elect to become a service member, scegli ruolo e club, invia in fondo alla pagina.\n\nGuida modelli profilo — i profili social patron restano in Media pubblici.\n\nApprovazione Club Admin — Club Admin → Employee/Workers → Pending Worker Requests, o Rivedi ed eleggi su questa scheda."
      },
      "help-venue-website-ingest": {
        title: "Acquisizione del sito web del club (API, RSS, iframe)",
        body: "Club Admin → Programmazione → Website ingest. Genera un segreto (mostrato una volta; viene memorizzato solo un hash). Inserisci i turni dello staff pubblicati sul sito web ufficiale del club con JSON (?format=json&dataset=schedule|hours|profile|all), RSS o uno snippet iframe. Le bozze, l'e-mail del lavoratore e il telefono non vengono mai inclusi. Ruota il segreto se perde."
      },
      "help-venue-hours-calendar": {
        title: "Orari di apertura della sede",
        body: "Nel profilo pubblico del club, imposta gli orari di apertura/chiusura settimanali predefiniti, quindi aggiungi le sostituzioni del periodo per le settimane speciali senza perdere l'impostazione predefinita. La pagina del club pubblico mostra una griglia settimanale da domenica a sabato con l'intervallo di date (ad esempio, domenica 9 - sabato 15, agosto 2026) e la colorazione del calendario. I prossimi giorni festivi elencano gli orari di apertura/chiusura e avvisano quando differiscono dal consueto giorno feriale. La pianificazione del personale utilizza l'apertura da − 2 ore alla chiusura + 1 ora. La Guest List può suggerire serate aperte."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin assegnazione della sede",
        body: "I 3 aprono il Venue Command Center solo per il club a cui sono assegnati. L'apertura di admin.html senza una sede non viene più impostata su Zebbies. I conti demo temp_clubadmin_N@floqr-demo.com sono mappati su temp-democlub-N. Gli amministratori non assegnati richiedono l'assegnazione da Master Admin."
      },
      "help-general-notifications": {
        title: "Notifiche generali",
        body: "SOS2FA e altri messaggi di sistema FloqR seguono questi flag come impostati nel record utente di un utente. Le sedi o i membri specifici del servizio indipendente devono abbonarsi ai servizi Twilio a pagamento SMS/WhatsApp"
      },
      "help-app-language": {
        title: "Lingua dell'app",
        body: "Al primo utilizzo, FloqR legge la lingua del browser (ad esempio nl-NL → olandese/olandese) e imposta Chrome e i menu su quella lingua quando è supportata: categorie di ricerca, schede Il mio profilo, schede Club Admin e schede Master Admin. Le lingue non supportate rimangono l'inglese. Successivamente prevalgono Il mio profilo → Lingua dell'app e la lingua del profilo salvata. Il salvataggio della lingua dell'app traduce nuovamente ogni pagina che carica FLOQRI18n, non solo questa scheda."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Apri My Profile & Settings per ruoli, strumenti del venditore e opzioni dell'account."
      },
      "help-onboarding": {
        title: "Onboarding",
        body: "Onboarding utente/membro del servizio: richiedi Club Admin, DJ, Promoter o accesso all'ospitalità. Anche gli utenti possono partecipare alle sedi."
      },
      "help-mingl-search": {
        title: "Informazioni sulla ricerca Mingl",
        body: "Cerca i profili pubblici per interessi condivisi, stile di vita, musica, viaggi, cibo, eventi, automobili, città, nome utente o chi desideri incontrare."
      },
      "help-default-template": {
        title: "Modello predefinito",
        body: "Classico tradizionale in bianco e nero. Utilizza FloqAi qui sotto per i modelli Sport, Maglia, VIP, Umorismo, Automobili, Video, Immagini e Ballerini."
      },
      "help-floqai-template-search": {
        title: "FloqAi ricerca modello",
        body: "Tocca il simbolo FloqAi in movimento (o attendi i fumetti), quindi chiedi Sport, Maglia, NBA, NFL, Automobili, Umorismo, VIP, Video, Immagini o Ballerini."
      },
      "help-mingl-requests": {
        title: "Circa Mingl richieste",
        body: "Le richieste di amico o Mingl inviate e ricevute vengono visualizzate qui. Le richieste rimangono nella pagina principale Mingl; le conversazioni accettate si aprono in Mingl Chat."
      }
    },
    pt: {
      "floqai-ask-floqr": {
        title: "Pergunte FloqR com FloqAi",
        body: "Pergunte FloqR com FloqAi — toque na marca animada ou aguarde o prompt e digite o que deseja em palavras simples. Produtos: Mingl, RydR, BartR, ShoutOut, SupRstR (superstar), clubes. Metas: diga “Eu quero poder…” (por exemplo, tornar-se um Club Admin) ou “make me a superstar” para etapas e links."
      },
      "help-soccer-jersey": {
        title: "Camisa de futebol ShoutOut",
        body: "Pesquise Futebol, Jersey ou um país/clube (Tanzânia, Chelsea). Cada cartão de kit fotográfico é o LED traseiro que você verá em ShoutOut — Futebol · Camisa · País ou Clube. Tamanhos 96×48, 64×48, 64×32. O nome e a marca de 2 caracteres sobrepõem o kit; os números permanecem justificados ao centro."
      },
      "help-suprstar": {
        title: "Faça de mim um supRstar / superstar",
        body: "Escolha um local → visualização da câmera privada → pague $20 (Stripe pop-out) → Club Admin aprova na fila supRstar → Go live no quadro SupRStar. Como um ShoutOut, mas vídeo ao vivo. Os links de visualização usam tokens secretos para que não possam ser adivinhados a partir do URL do clube."
      },
      "help-become-club-admin": {
        title: "Torne-se um Club Admin",
        body: "Solicite acesso Club Admin e obtenha a aprovação do local."
      },
      "help-become-dj": {
        title: "Torne-se um DJ",
        body: "Eleja DJ como sua função de serviço e associe-se aos clubes."
      },
      "help-become-promoter": {
        title: "Torne-se um Promoter",
        body: "Solicite acesso Promoter para listas de convidados e campanhas."
      },
      "help-role-profiles": {
        title: "Visão geral dos perfis de função",
        body: "Veja como funcionam as funções Club Admin, DJ, Promoter e hospitalidade."
      },
      "help-staff-scheduling": {
        title: "Calendário e agendador",
        body: "Club Admin O calendário mostra os cartões Rascunho (roxo), Pendente (âmbar), Confirmado (verde) e Aberto/não preenchido — cada um com um status escrito, e não apenas uma cor. O Agendador é a grade de rascunho/publicação de pessoas × dias. Website ingest / publicVenueCalendar retorna apenas atribuições confirmadas. Uma pílula verde paga este mês é mostrada como Club Admins quando staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Assinaturas de notificação do Club SMS e WhatsApp",
        body: "Club Admin → Notificações: Send test alert usa as caixas atualmente marcadas. No aplicativo (e Push) escreve uma mensagem do sistema em FloqR Inbox. O e-mail usa endereços de administrador do clube. SMS e WhatsApp ainda precisam de uma assinatura paga, além de um telefone de alerta E.164. Pílula verde = Firebase assinatura 1 (pacote pré-pago de US$ 10); vermelho = 0. Se Send test alert retornar Authentication Error - invalid username, Firebase segredo TWILIO_ACCOUNT_SID deve ser o SID da conta começando com AC (34 caracteres) de console.twilio.com — não o token de autenticação e não uma chave de API (SK)."
      },
      "help-club-sms-notification": {
        title: "SMS assinatura de notificação",
        body: "A pílula SMS é verde quando Firebase smsSubscribed é 1 (pacote pré-pago de US$ 10, 466 créditos, não mensal ou anual). Vermelho/piscando significa 0 — aberto? e toque em Subscribe $10. Os créditos restantes e a data do último pagamento estão nesta ajuda. Desmarque SMS e Salvar para pausar alertas sem perder o pacote pago."
      },
      "help-club-whatsapp-notification": {
        title: "WhatsApp assinatura de notificação",
        body: "A pílula WhatsApp é verde quando Firebase whatsappSubscribed é 1 (pacote pré-pago de US$ 10, 233 créditos, não mensal ou anual). Vermelho/piscando significa 0 — aberto? e toque em Subscribe $10. Os créditos restantes e a data do último pagamento estão nesta ajuda. Desmarque WhatsApp e Salvar para pausar alertas sem perder o pacote pago."
      },
      "help-schedule-message-templates": {
        title: "Agendar modelos de mensagens",
        body: "Club Admin → Notificações → Message templates. Estas são mensagens do sistema (Inbox / Email / SMS / WhatsApp), não ShoutOuts. Edite o título e o corpo de New shift needs confirmation, Atualização programada, Turno confirmado e Turno recusado. Espaços reservados: {club} {role} {when} {link} {worker}. A caixa de entrada do trabalhador usa Review & confirm shift — nunca Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Confirmar turnos atribuídos",
        body: "Inbox / Email / SMS links abrem Work Calendar. Veja cada tarefa pendente, marque-a (ou Select all) e depois Approve selected. Abrir o link não confirma. Somente o membro do serviço designado pode aprovar — Club Admin não pode confirmar em seu nome."
      },
      "help-template-catalog-report": {
        title: "Relatório de catálogo de modelos",
        body: "Lista cada tipo de modelo ShoutOut e quais tamanhos de LED ele suporta (Is96x48, Is64x48, Is64x32). Um local só oferece um modelo quando pelo menos um desses sinalizadores é 1 e o sinalizador VenueSupports* correspondente é 1. Os modelos de aniversário/mídia dividida são 1 em 96×48, 64×48 e 64×32. 96×48 são 3 linhas lado a lado; 64×48 e 64×32 fazem um loop na foto e depois na mensagem de 3 linhas com um cartão FLOQR + alça."
      },
      "help-club-display-screens": {
        title: "FLOQR telas de exibição",
        body: "Firebase clubLocations armazena VenueSupports96x48, VenueSupports64x48 e VenueSupports64x32 como 0 ou 1. templates armazena Is96x48, Is64x48 e Is64x32 da mesma maneira. Um local só lista um modelo quando pelo menos um par é 1. As URLs do Xibo permanecem display.html?location=id e display2.html?location=id — o tamanho da tela não está na URL. O aniversário é oferecido em todos os três tamanhos (3 linhas lado a lado em 96×48; loop de foto/mensagem em 64×48 e 64×32). O principal é display.html. O secundário é display2.html."
      },
      "help-donpapi-led-wall": {
        title: "DonPapi ShoutOut Parede LED",
        body: "Os VIP ShoutOuts são carregados por ajudantes de mesa na parede de LED portátil DonPapi – mantida no ar na frente dos clientes com a mensagem de aviso na tela central (nome do clube na parte superior, borda recortada branca brilhante). Os LEDs de mesa (64x32) e as paredes retrato (960x1900) permanecem para os demais formatos."
      },
      "help-staff-week-calendar": {
        title: "Agendador",
        body: "Club Admin O Agendador é uma grade de pessoas × dias por semana. Save shift fecha o editor com Schedule card successfully saved. Crie rascunhos, Publish schedule para que os trabalhadores confirmem pendências até serem confirmados, Select shifts para exclusão múltipla e Website ingest para colocar turnos publicados no site do clube. Janela de turno padrão = clube aberto − 2 horas até o fechamento + 1 hora."
      },
      "help-staff-schedule-user-guide": {
        title: "Guia do usuário de agendamento de equipe",
        body: "Abra o? ao lado de Agendador em Club Admin Agendamento. Crie turnos de rascunho, Publish schedule para que os trabalhadores confirmem pendentes→confirmados, depois Select shifts para excluir vários de uma vez. Exemplo: todos os drafts de quarta-feira mais uma ficha confirmada de quinta-feira."
      },
      "help-create-publish-schedule": {
        title: "Crie e publique uma agenda de equipe",
        body: "Adicione turnos de rascunho na grade pessoas × dias, revise fichas e depois Publish schedule. Os trabalhadores devem confirmar antes que um turno seja confirmado. FloqAi: create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Excluir vários turnos agendados ou rascunhos",
        body: "Select shifts, misture cabeçalhos e fichas do dia e depois Delete selected. Exemplo: todos os rascunhos de quarta-feira mais um turno confirmado de quinta-feira."
      },
      "help-staff-worksheet": {
        title: "Planilha de Trabalho - Calendário Semanal da Equipe",
        body: "Os militares eleitos abrem Work Calendar em Configurações. Inbox / Email / SMS links de confirmação chegam aqui. Revise as tarefas pendentes, marque cada turno (ou Select all) e depois Approve selected — abrir a mensagem não confirma. A grade semanal mostra os turnos publicados dos colegas. Os rascunhos ficam em Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Todos começam como patron FLOQR. Em My Profile & Settings toque Elect to become a service member, escolha papel e clubes, envie no final da página.\n\nGuia de modelos de perfil — perfis sociais patron ficam em Mídia pública.\n\nAprovação Club Admin — Club Admin → Employee/Workers → Pending Worker Requests, ou Revisar e eleger neste separador."
      },
      "help-venue-website-ingest": {
        title: "Ingestão do site do clube (API, RSS, iframe)",
        body: "Club Admin → Agendamento → Website ingest. Gere um segredo (mostrado uma vez; apenas um hash é armazenado). Extraia os turnos de funcionários publicados no site oficial do clube com JSON (?format=json&dataset=schedule|hours|profile|all), RSS ou um snippet de iframe. Rascunhos, e-mail do funcionário e telefone nunca são incluídos. Gire o segredo se ele vazar."
      },
      "help-venue-hours-calendar": {
        title: "Horário de funcionamento do local",
        body: "No Perfil Público do Clube, defina o horário de abertura/fechamento semanal padrão e, em seguida, adicione substituições de período para semanas especiais sem perder o padrão. A página pública do clube mostra uma grade semanal de domingo a sábado com o intervalo de datas (por exemplo, domingo, 9 a sábado, 15 de agosto de 2026) e cores do calendário. Os próximos feriados listam os horários de abertura/fechamento e avisam quando forem diferentes do dia normal da semana. O agendamento da equipe utiliza aberto − 2h até fechamento + 1h. A Guest List pode sugerir noites abertas."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin atribuição de local",
        body: "Club Adminsó abrem o Venue Command Center para um clube ao qual estão atribuídos. Abrir admin.html sem um local não é mais o padrão Zebbies. As contas de demonstração temp_clubadmin_N@floqr-demo.com são mapeadas para temp-democlub-N. Administradores não atribuídos solicitam atribuição de Master Admin."
      },
      "help-general-notifications": {
        title: "Notificações Gerais",
        body: "O SOS2FA e outras mensagens do sistema FloqR seguem essas sinalizações conforme definido no registro do usuário do usuário. Locais ou membros de serviços independentes específicos precisam assinar serviços pagos SMS/WhatsApp da Twilio"
      },
      "help-app-language": {
        title: "Idioma do aplicativo",
        body: "Na primeira utilização, FloqR lê o idioma do navegador (por exemplo, nl-NL → Holandês / Nederlands) e alterna o cromo e os menus para esse idioma quando é suportado – categorias de pesquisa, guias Meu perfil, guias Club Admin e guias Master Admin. Os idiomas não suportados permanecem em inglês. Depois disso, Meu Perfil → Idioma do aplicativo e o idioma do perfil salvo vencem. Salvar o idioma do aplicativo traduz novamente todas as páginas que carregam FLOQRI18n, não apenas este cartão."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Abra My Profile & Settings para funções, ferramentas de vendedor e opções de conta."
      },
      "help-onboarding": {
        title: "Integração",
        body: "Integração de usuários/membros de serviço — solicite acesso Club Admin, DJ, Promoter ou acesso de hospitalidade. Os Master Admins também podem integrar locais."
      },
      "help-mingl-search": {
        title: "Sobre a pesquisa Mingl",
        body: "Pesquise perfis públicos por interesses comuns, estilo de vida, música, viagens, comida, eventos, carros, cidade, nome de usuário ou quem você deseja conhecer."
      },
      "help-default-template": {
        title: "Modelo padrão",
        body: "Clássico tradicional preto e branco grátis. Use FloqAi abaixo para modelos de Esportes, Jersey, VIP, Humor, Carros, Vídeo, Fotos e Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi pesquisa de modelos",
        body: "Toque na marca móvel FloqAi (ou espere pelos balões de fala) e peça Esportes, Jersey, NBA, NFL, Carros, Humor, VIP, Vídeo, Fotos ou Ballers."
      },
      "help-mingl-requests": {
        title: "Sobre Mingl solicitações",
        body: "Solicitações de amizade ou Mingl enviadas e recebidas aparecem aqui. As solicitações ficam na página Mingl principal; conversas aceitas abertas em Mingl Chat."
      }
    },
    el: {
      "floqai-ask-floqr": {
        title: "Ρωτήστε το FloqR με το FloqAi",
        body: "Ρωτήστε το FloqR με το FloqAi — πατήστε την κινούμενη ένδειξη ή περιμένετε να σας ζητηθεί και μετά πληκτρολογήστε αυτό που θέλετε με απλά λόγια. Προϊόντα: Mingl, RydR, BartR, ShoutOut, SupRstR (σούπερ σταρ), κλαμπ. Στόχοι: πείτε «Θέλω να μπορώ να…» (π.χ. να γίνω Club Admin) ή «make me a superstar» για βήματα και συνδέσμους."
      },
      "help-soccer-jersey": {
        title: "Ποδοσφαιρική φανέλα ShoutOut",
        body: "Αναζητήστε Ποδόσφαιρο, Τζέρσεϊ ή χώρα/σύλλογο (Τανζανία, Τσέλσι). Κάθε κάρτα κιτ φωτογραφιών είναι το LED πίσω που θα δείτε στο ShoutOut — Ποδόσφαιρο · Τζέρσεϊ · Χώρα ή Σύλλογος. Μεγέθη 96×48, 64×48, 64×32. Το όνομα και το σημάδι 2 χαρακτήρων επικαλύπτουν το κιτ. οι αριθμοί παραμένουν στο κέντρο-δικαιολογημένοι."
      },
      "help-suprstar": {
        title: "Κάνε με supRstar / σούπερ σταρ",
        body: "Επιλέξτε έναν χώρο → προεπισκόπηση ιδιωτικής κάμερας → πληρώστε $20 (Stripe αναδυόμενο παράθυρο) → Club Admin εγκρίνει στην ουρά supRstar → Go live στον πίνακα SupRStar. Όπως ένα ShoutOut, αλλά ζωντανό βίντεο. Οι σύνδεσμοι προεπισκόπησης χρησιμοποιούν μυστικά διακριτικά, ώστε να μην μπορούν να μαντευτούν από μια διεύθυνση URL συλλόγου."
      },
      "help-become-club-admin": {
        title: "Γίνε Club Admin",
        body: "Ζητήστε πρόσβαση Club Admin και, στη συνέχεια, λάβετε έγκριση του χώρου."
      },
      "help-become-dj": {
        title: "Γίνε DJ",
        body: "Επιλέξτε το DJ ως ρόλο υπηρεσίας και συνεργαστείτε με συλλόγους."
      },
      "help-become-promoter": {
        title: "Γίνε Promoter",
        body: "Ζητήστε Promoter πρόσβαση για λίστες καλεσμένων και καμπάνιες."
      },
      "help-role-profiles": {
        title: "Επισκόπηση προφίλ ρόλων",
        body: "Δείτε πώς λειτουργούν οι ρόλοι Club Admin, DJ, Promoter και φιλοξενίας."
      },
      "help-staff-scheduling": {
        title: "Ημερολόγιο & Χρονοδιάγραμμα",
        body: "Club Admin Το Ημερολόγιο εμφανίζει πρόχειρες (μωβ), Εκκρεμείς (πορτοκαλί), Επιβεβαιωμένες (πράσινες) και Ανοιχτές/μη συμπληρωμένες κάρτες — καθεμία με γραπτή κατάσταση, όχι μόνο χρώμα. Ο χρονοπρογραμματιστής είναι το πλέγμα προσχέδιο/δημοσίευσης ατόμων × ημερών. Το Website ingest / publicVenueCalendar επιστρέφει Μόνο επιβεβαιωμένες εργασίες. Ένα πράσινο χάπι Payid this month εμφανίζεται σε Club Admins όταν staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Συνδρομές ειδοποιήσεων Club SMS και WhatsApp",
        body: "Club Admin → Ειδοποιήσεις: Send test alert χρησιμοποιεί τα πλαίσια που είναι επιλεγμένα αυτήν τη στιγμή. Εντός εφαρμογής (και Push) γράφει ένα μήνυμα συστήματος στο FloqR Inbox. Το email χρησιμοποιεί διευθύνσεις διαχειριστή συλλόγου. Τα SMS και WhatsApp εξακολουθούν να χρειάζονται συνδρομή επί πληρωμή συν ένα τηλέφωνο ειδοποίησης E.164. Πράσινο χάπι = Firebase συνδρομή 1 (προπληρωμένο πακέτο 10 $). κόκκινο = 0. Εάν το Send test alert επιστρέψει Authentication Error - invalid username, το Firebase μυστικό TWILIO_ACCOUNT_SID πρέπει να είναι το SID του λογαριασμού που ξεκινά με AC (34 χαρακτήρες) από το console.twilio.com — όχι το Auth Token και όχι ένα κλειδί API (SK)."
      },
      "help-club-sms-notification": {
        title: "SMS συνδρομή ειδοποιήσεων",
        body: "Το χάπι SMS είναι πράσινο όταν το Firebase smsSubscribed είναι 1 (προπληρωμένο πακέτο $10, 466 μονάδες, όχι μηνιαία ή ετήσια). Κόκκινο/αναβοσβήνει σημαίνει 0 — ανοιχτό ? και πατήστε Subscribe $10. Οι πιστώσεις που απομένουν και η ημερομηνία τελευταίας πληρωμής είναι σε αυτήν τη βοήθεια. Καταργήστε την επιλογή SMS και Αποθήκευση για παύση των ειδοποιήσεων χωρίς να χάσετε το πακέτο επί πληρωμή."
      },
      "help-club-whatsapp-notification": {
        title: "WhatsApp συνδρομή ειδοποιήσεων",
        body: "Το χάπι WhatsApp είναι πράσινο όταν το Firebase whatsappSubscribed είναι 1 (προπληρωμένο πακέτο $10, 233 μονάδες, όχι μηνιαία ή ετήσια). Κόκκινο/αναβοσβήνει σημαίνει 0 — ανοιχτό ? και πατήστε Subscribe $10. Οι πιστώσεις που απομένουν και η ημερομηνία τελευταίας πληρωμής είναι σε αυτήν τη βοήθεια. Καταργήστε την επιλογή WhatsApp και Αποθήκευση για παύση των ειδοποιήσεων χωρίς να χάσετε το πακέτο επί πληρωμή."
      },
      "help-schedule-message-templates": {
        title: "Προγραμματίστε πρότυπα μηνυμάτων",
        body: "Club Admin → Ειδοποιήσεις → Message templates. Αυτά είναι μηνύματα συστήματος (Inbox / Email / SMS / WhatsApp), όχι ShoutOut. Επεξεργαστείτε τον τίτλο και το σώμα για το New shift needs confirmation, το πρόγραμμα ενημέρωσης, το Shift επιβεβαιώθηκε και το Shift απορρίφθηκε. Placeholders: {club} {role} {when} {link} {worker}. Τα εισερχόμενα εργαζομένων χρησιμοποιούν Review & confirm shift — ποτέ Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Επιβεβαιώστε τις ανατεθειμένες βάρδιες",
        body: "Οι σύνδεσμοι Inbox / Email / SMS ανοίγουν Work Calendar. Κοιτάξτε κάθε εκκρεμή εργασία, σημειώστε την (ή Select all) και μετά Approve selected. Το άνοιγμα του συνδέσμου δεν επιβεβαιώνεται. Μόνο το εξουσιοδοτημένο μέλος σέρβις μπορεί να εγκρίνει — Club Admin δεν μπορεί να επιβεβαιώσει εκ μέρους του."
      },
      "help-template-catalog-report": {
        title: "Πρότυπο αναφοράς καταλόγου",
        body: "Εμφανίζει κάθε τύπο προτύπου ShoutOut και ποια μεγέθη LED υποστηρίζει (Is96x48, Is64x48, Is64x32). Ένας χώρος προσφέρει ένα πρότυπο μόνο όταν τουλάχιστον μία από αυτές τις σημαίες είναι 1 και η αντίστοιχη σημαία VenueSupports* είναι 1. Τα πρότυπα γενεθλίων / διαχωρισμένων μέσων είναι 1 σε 96×48, 64×48 και 64×32. Το 96×48 είναι 3 γραμμών δίπλα-δίπλα. 64×48 και 64×32 επαναφέρετε τη φωτογραφία και στη συνέχεια το φωνητικό 3 γραμμών με μια κάρτα λαβής FLOQR +."
      },
      "help-club-display-screens": {
        title: "FLOQR οθόνες εμφάνισης",
        body: "Το Firebase clubLocations αποθηκεύει τα VenueSupports96x48, VenueSupports64x48 και VenueSupports64x32 ως 0 ή 1. Τα πρότυπα αποθηκεύουν τα Is96x48, Is64x48 και Is64x32 με τον ίδιο τρόπο. Ένας χώρος εμφανίζει ένα πρότυπο μόνο όταν τουλάχιστον ένα ζεύγος είναι 1. Οι διευθύνσεις URL Xibo παραμένουν display.html?location=id και display2.html?location=id — το μέγεθος οθόνης δεν περιλαμβάνεται στη διεύθυνση URL. Το Birthday προσφέρεται και στα τρία μεγέθη (3-γραμμές δίπλα-δίπλα σε 96×48· βρόχος φωτογραφίας/αναφώνησης σε 64×48 και 64×32). Το κύριο είναι το display.html. Δευτερεύον είναι το display2.html."
      },
      "help-donpapi-led-wall": {
        title: "DonPapi ShoutOut τοίχος LED",
        body: "Τα VIP ShoutOut μεταφέρονται από busboys στον φορητό τοίχο DonPapi LED — κρατούνται στον αέρα μπροστά από τους θαμώνες με το μήνυμα κραυγής στην κεντρική οθόνη (όνομα κλαμπ στην κορυφή, λαμπερό λευκό περίγραμμα). Οι επιτραπέζιες λυχνίες LED (64×32) και οι κατακόρυφα τοίχοι (960×1900) παραμένουν για άλλες μορφές."
      },
      "help-staff-week-calendar": {
        title: "Προγραμματιστής",
        body: "Club Admin Προγραμματιστής είναι ένα πλέγμα ατόμων × ημερών της εβδομάδας. Το Save shift κλείνει το πρόγραμμα επεξεργασίας με Schedule card successfully saved. Δημιουργήστε πρόχειρα, Publish schedule έτσι ώστε οι εργαζόμενοι να επιβεβαιώνουν ότι εκκρεμούν μέχρι να επιβεβαιωθούν, Select shifts για πολλαπλή διαγραφή και Website ingest για να τοποθετήσετε δημοσιευμένες βάρδιες στον ιστότοπο του κλαμπ. Προεπιλεγμένο παράθυρο βάρδιας = κλαμπ ανοιχτό − 2 ώρες έως κλείσιμο + 1 ώρα."
      },
      "help-staff-schedule-user-guide": {
        title: "Οδηγός Χρήστη Προγραμματισμός Προσωπικού",
        body: "Ανοίξτε το ? δίπλα στο Χρονοδιάγραμμα στο Club Admin Προγραμματισμός. Δημιουργήστε πρόχειρες βάρδιες, Publish schedule ώστε οι εργαζόμενοι να επιβεβαιώσουν ότι βρίσκονται σε εκκρεμότητα→ επιβεβαιωθεί, και μετά Select shifts για να διαγράψετε πολλές ταυτόχρονα. Παράδειγμα: όλα τα ντραφτ της Τετάρτης συν ένα τσιπ επιβεβαιωμένο την Πέμπτη."
      },
      "help-create-publish-schedule": {
        title: "Δημιουργήστε και δημοσιεύστε ένα πρόγραμμα προσωπικού",
        body: "Προσθέστε αλλαγές πρόχειρων στο πλέγμα ατόμων × ημερών, ελέγξτε τις μάρκες και μετά Publish schedule. Οι εργαζόμενοι πρέπει να επιβεβαιώσουν πριν επιβεβαιωθεί μια βάρδια. FloqAi: create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Διαγράψτε πολλές προγραμματισμένες ή πρόχειρες βάρδιες",
        body: "Select shifts, ανακατέψτε κεφαλίδες ημέρας και μάρκες και μετά Delete selected. Παράδειγμα: όλα τα ντραφτ της Τετάρτης συν μία Πέμπτη επιβεβαιωμένη βάρδια."
      },
      "help-staff-worksheet": {
        title: "Φύλλο Εργασίας - Εβδομαδιαίο Ημερολόγιο Προσωπικού",
        body: "Τα εκλεγμένα μέλη υπηρεσίας ανοίγουν το Work Calendar στις Ρυθμίσεις. Οι σύνδεσμοι Inbox / Email / SMS επιβεβαιώνουν εδώ. Ελέγξτε τις εκκρεμείς εργασίες, επιλέξτε κάθε βάρδια (ή Select all) και μετά Approve selected — το άνοιγμα του μηνύματος δεν επιβεβαιώνεται. Το πλέγμα εβδομάδας δείχνει δημοσιευμένες βάρδιες συναδέλφων. Τα πρόχειρα παραμένουν στο Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Όλοι ξεκινούν ως patron FLOQR. Στο My Profile & Settings πατήστε Elect to become a service member, επιλέξτε ρόλο και clubs, υποβάλετε στο κάτω μέρος.\n\nΟδηγός προτύπων προφίλ — τα κοινωνικά προφίλ patron παραμένουν στα Δημόσια μέσα.\n\nΈγκριση Club Admin — Club Admin → Employee/Workers → Pending Worker Requests, ή Αναθεώρηση και επιλογή σε αυτή την καρτέλα."
      },
      "help-venue-website-ingest": {
        title: "Απορρόφηση ιστότοπου συλλόγου (API, RSS, iframe)",
        body: "Club Admin → Προγραμματισμός → Website ingest. Δημιουργήστε ένα μυστικό (εμφανίζεται μία φορά, αποθηκεύεται μόνο ένας κατακερματισμός). Τραβήξτε τις δημοσιευμένες μετακινήσεις προσωπικού στον επίσημο ιστότοπο του συλλόγου με JSON (?format=json&dataset=schedule|hours|profile|all), RSS ή ένα απόσπασμα iframe. Πρόχειρα, email εργαζομένου και τηλέφωνο δεν περιλαμβάνονται ποτέ. Περιστρέψτε το μυστικό εάν διαρρεύσει."
      },
      "help-venue-hours-calendar": {
        title: "Ώρες λειτουργίας του χώρου",
        body: "Στο Δημόσιο Προφίλ Club, ορίστε τις προεπιλεγμένες εβδομαδιαίες ανοιχτές/κλειστές ώρες και, στη συνέχεια, προσθέστε παρακάμψεις περιόδου για ειδικές εβδομάδες χωρίς να χάσετε την προεπιλογή. Η δημόσια σελίδα του κλαμπ εμφανίζει ένα πλέγμα εβδομάδας Κυριακής-Σαββάτου με το εύρος ημερομηνιών (π.χ. Κυρ 9 – Σαβ 15, Αυγ 2026) και χρωματισμό ημερολογίου. Οι επερχόμενες επίσημες αργίες αναφέρουν τις ώρες λειτουργίας/κλεισίματος και καλέστε όταν διαφέρουν από τις συνηθισμένες καθημερινές. Ο Προγραμματισμός Προσωπικού χρησιμοποιεί ανοιχτό − 2h έως κλείσιμο + 1h. Η λίστα επισκεπτών μπορεί να προτείνει ανοιχτές βραδιές."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin ανάθεση χώρου",
        body: "Club Admin ανοίγει μόνο το Κέντρο Διοίκησης του Χώρου για μια λέσχη στην οποία έχουν ανατεθεί. Το άνοιγμα του admin.html χωρίς χώρο δεν είναι πλέον ως προεπιλογή Zebbies. Οι δοκιμαστικοί λογαριασμοί temp_clubadmin_N@floqr-demo.com αντιστοιχίζονται στο temp-democlub-N. Οι μη εκχωρημένοι διαχειριστές ζητούν εκχώρηση από το Master Admin."
      },
      "help-general-notifications": {
        title: "Γενικές Ειδοποιήσεις",
        body: "Το SOS2FA και άλλα μηνύματα συστήματος FloqR ακολουθούν αυτές τις σημαίες, όπως έχουν οριστεί στο αρχείο χρηστών σας. Χώροι εκδηλώσεων ή συγκεκριμένα ανεξάρτητα μέλη υπηρεσίας πρέπει να εγγραφούν στις επί πληρωμή υπηρεσίες SMS/WhatsApp Twilio"
      },
      "help-app-language": {
        title: "Γλώσσα εφαρμογής",
        body: "Κατά την πρώτη χρήση, το FloqR διαβάζει τη γλώσσα του προγράμματος περιήγησης (για παράδειγμα nl-NL → Ολλανδικά / Ολλανδικά) και αλλάζει το chrome και τα μενού σε αυτήν τη γλώσσα όταν υποστηρίζεται — Κατηγορίες αναζήτησης, καρτέλες Το προφίλ μου, καρτέλες Club Admin και καρτέλες Master Admin. Οι μη υποστηριζόμενες γλώσσες παραμένουν στα Αγγλικά. Μετά από αυτό, το προφίλ μου → Γλώσσα εφαρμογής και η αποθηκευμένη γλώσσα προφίλ κερδίζουν. Η αποθήκευση της γλώσσας εφαρμογής μεταφράζει εκ νέου κάθε σελίδα που φορτώνει το FLOQRI18n, όχι μόνο αυτήν την κάρτα."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Ανοίξτε το My Profile & Settings για ρόλους, εργαλεία πωλητή και επιλογές λογαριασμού."
      },
      "help-onboarding": {
        title: "Ενσωμάτωση",
        body: "Επιβίβαση προστάτη/μέλους υπηρεσίας — αίτημα Club Admin, DJ, Promoter ή πρόσβαση φιλοξενίας. Τα Master Admin μπορούν επίσης να επιβιβαστούν σε χώρους."
      },
      "help-mingl-search": {
        title: "Σχετικά με την αναζήτηση Mingl",
        body: "Αναζητήστε δημόσια προφίλ με βάση κοινά ενδιαφέροντα, τρόπο ζωής, μουσική, ταξίδια, φαγητό, εκδηλώσεις, αυτοκίνητα, πόλη, όνομα χρήστη ή ποιον θέλετε να γνωρίσετε."
      },
      "help-default-template": {
        title: "Προεπιλεγμένο πρότυπο",
        body: "Δωρεάν Παραδοσιακό Ασπρόμαυρο Κλασικό. Χρησιμοποιήστε το FloqAi παρακάτω για πρότυπα Sports, Jersey, VIP, Humor, Cars, Video, Pictures και Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi αναζήτηση προτύπου",
        body: "Αγγίξτε την κινούμενη ένδειξη FloqAi (ή περιμένετε τα συννεφάκια ομιλίας του), μετά ζητήστε Sports, Jersey, NBA, NFL, Cars, Humor, VIP, Video, Pictures ή Ballers."
      },
      "help-mingl-requests": {
        title: "Περίπου Mingl Αιτήματα",
        body: "Απεσταλμένα και ληφθέντα Αιτήματα φίλου ή Mingl εμφανίζονται εδώ. Τα αιτήματα παραμένουν στην κύρια σελίδα Mingl. οι αποδεκτές συνομιλίες ανοίγουν στο Mingl Chat."
      }
    },
    pl: {
      "floqai-ask-floqr": {
        title: "Zapytaj FloqR z FloqAi",
        body: "Zapytaj FloqR z FloqAi — stuknij animowaną ikonę lub poczekaj na komunikat, a następnie wpisz, czego chcesz w zwykłych słowach. Produkty: Mingl, RydR, BartR, ShoutOut, SupRstR (supergwiazda), kluby. Cele: powiedz „Chcę być w stanie…” (np. zostać Club Admin) lub „make me a superstar” po kroki i linki."
      },
      "help-soccer-jersey": {
        title: "Koszulka piłkarska ShoutOut",
        body: "Wyszukaj Soccer, Jersey lub kraj/klub (Tanzania, Chelsea). Każda karta z zestawem zdjęć to podświetlenie LED, które zobaczysz na ShoutOut — Soccer · Jersey · Country or Club. Rozmiary 96×48, 64×48, 64×32. Nazwa i 2-znakowa ikona nałożone na zestaw; numery pozostają wyśrodkowane."
      },
      "help-suprstar": {
        title: "Zrób mi supRstar / supergwiazdę",
        body: "Wybierz miejsce → prywatny podgląd kamery → zapłać 20 $ (Stripe wysuwane) → Club Admin zatwierdza w kolejce supRstar → Go live na tablicy SupRStar. Jak ShoutOut, ale wideo na żywo. Linki podglądu używają tajnych tokenów, więc nie można ich odgadnąć z URL-u klubu."
      },
      "help-become-club-admin": {
        title: "Zostań Club Admin",
        body: "Poproś o dostęp do Club Admin, a następnie uzyskaj zatwierdzenie miejsca."
      },
      "help-become-dj": {
        title: "Zostań DJ",
        body: "Wybierz DJ jako swoją rolę usługową i połącz się z klubami."
      },
      "help-become-promoter": {
        title: "Zostań Promoter",
        body: "Poproś o dostęp Promoter do list gości i kampanii."
      },
      "help-role-profiles": {
        title: "Przegląd profili ról",
        body: "Zobacz, jak działają role Club Admin, DJ, Promoter i gościnne."
      },
      "help-staff-scheduling": {
        title: "Kalendarz i Harmonogram",
        body: "Kalendarz Club Admin pokazuje Wersje robocze (fioletowe), Oczekujące (bursztynowe), Potwierdzone (zielone) i Otwarte/niewypełnione karty — każda z pisanym statusie, nie tylko kolorem. Harmonogram to siatka osób × dni dla wersji roboczej/publikacji. Website ingest / publicVenueCalendar pokazuje tylko potwierdzone zadania. Zielona etykieta Opłacone w tym miesiącu jest wyświetlana dla Club Admin, gdy staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "Subskrypcje powiadomień Klubowe dla SMS i WhatsApp",
        body: "Club Admin → Powiadomienia: Send test alert używa obecnie zaznaczonych pól. W aplikacji (i Push) zapisuje wiadomość systemową w FloqR Inbox. E-mail używa adresów administratora klubu. SMS i WhatsApp nadal wymagają płatnej subskrypcji oraz telefonu ostrzegawczego E.164. Zielona tabletka = Firebase subskrypcja 1 (przedpłacony pakiet $10); czerwona = 0. Jeśli Send test alert zwraca Authentication Error - invalid username, sekret Firebase TWILIO_ACCOUNT_SID musi być SID konta zaczynającym się od AC (34 znaki) z console.twilio.com — nie Token uwierzytelniający i nie Klucz API (SK)."
      },
      "help-club-sms-notification": {
        title: "SMS subskrypcja powiadomień",
        body: "Tabletka SMS jest zielona, gdy Firebase smsSubscribed wynosi 1 (przedpłacony pakiet $10, 466 kredytów, nie miesięczny ani roczny). Czerwona/migająca oznacza 0 — otwórz ? i stuknij Subscribe $10. Pozostałe kredyty i data ostatniej płatności są w tej pomocy. Odznacz SMS i Zapisz, aby wstrzymać alerty bez utraty opłaconego pakietu."
      },
      "help-club-whatsapp-notification": {
        title: "WhatsApp subskrypcja powiadomień",
        body: "Pigułka WhatsApp jest zielona, gdy Firebase whatsappSubscribed wynosi 1 (przedpłacony pakiet $10, 233 kredyty, nie miesięczny ani roczny). Czerwona/migająca oznacza 0 — otwórz ? i stuknij Subscribe $10. Pozostałe kredyty i ostatnia data płatności znajdują się w tej pomocy. Odznacz WhatsApp i Zapisz, aby wstrzymać alerty bez utraty opłaconego pakietu."
      },
      "help-schedule-message-templates": {
        title: "Szablony wiadomości w harmonogramie",
        body: "Club Admin → Powiadomienia → Message templates. Są to Wiadomości systemowe (Inbox / Email / SMS / WhatsApp), nie ShoutOut. Edytuj tytuł i treść dla New shift needs confirmation, Aktualizacja harmonogramu, Potwierdzono zmianę i Odrzucono zmianę. Pola zastępcze: {club} {role} {when} {link} {worker}. Skrzynka odbiorcza pracownika używa Review & confirm shift — nigdy Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "Potwierdź przypisane zmiany",
        body: "Inbox / Email / linki SMS otwierają Work Calendar. Sprawdź każde oczekujące przypisanie, zaznacz je (lub Select all), a następnie Approve selected. Otwarcie linku nie oznacza potwierdzenia. Tylko przypisany członek służby może zatwierdzić — Club Admin nie może potwierdzić w jego imieniu."
      },
      "help-template-catalog-report": {
        title: "Raport katalogu szablonów",
        body: "Wymienia każdy typ szablonu ShoutOut i jakie rozmiary LED obsługuje (Is96x48, Is64x48, Is64x32). Miejsce oferuje szablon tylko wtedy, gdy przynajmniej jeden z tych wskaźników wynosi 1, a odpowiadający mu wskaźnik VenueSupports* jest również równy 1. Szablony urodzinowe / z podziałem mediów są 1 na 96×48, 64×48 i 64×32. 96×48 to 3-liniowy obok siebie; 64×48 i 64×32 pokazują w pętli zdjęcie, a następnie 3-liniowy shoutout z kartą FLOQR + handle."
      },
      "help-club-display-screens": {
        title: "FLOQR ekrany wyświetlaczy",
        body: "Firebase clubLocations przechowuje VenueSupports96x48, VenueSupports64x48 i VenueSupports64x32 jako 0 lub 1. Szablony przechowują Is96x48, Is64x48 i Is64x32 w ten sam sposób. Miejsce wyświetla szablon tylko wtedy, gdy przynajmniej jedna para wynosi 1. Adresy URL Xibo pozostają display.html?location=id i display2.html?location=id — rozmiar ekranu nie jest w URL. Urodziny są oferowane we wszystkich trzech rozmiarach (3-liniowy obok siebie na 96×48; pętla zdjęcie/shoutout na 64×48 i 64×32). Główny to display.html. Drugorzędny to display2.html."
      },
      "help-donpapi-led-wall": {
        title: "DonPapi ShoutOut ściana LED",
        body: "VIP ShoutOut są przenoszeni przez kelnerów na przenośnej ścianie LED DonPapi — trzymanej w powietrzu przed gośćmi z wiadomością powitalną na ekranie centralnym (nazwa klubu na górze, świecąca biała falista ramka). Diody stołowe (64×32) i ściany portretowe (960×1900) pozostają dla innych formatów."
      },
      "help-staff-week-calendar": {
        title: "Harmonogram",
        body: "Club Admin Harmonogram to siatka osób × dni tygodnia. Save shift zamyka edytor z Schedule card successfully saved. Twórz szkice, Publish schedule aby pracownicy potwierdzili oczekujące na potwierdzenie, Select shifts do wielokrotnego usuwania oraz Website ingest do publikowania harmonogramu zmian na stronie klubu. Domyślne okno zmian = otwarcie klubu − 2 godziny do zamknięcia + 1 godzina."
      },
      "help-staff-schedule-user-guide": {
        title: "Przewodnik użytkownika do harmonogramu personelu",
        body: "Otwórz ? obok Harmonogramu na Club Admin Harmonogramowanie. Twórz szkice zmian, Publish schedule aby pracownicy potwierdzili oczekujące→potwierdzone, następnie Select shifts aby usunąć kilka naraz. Przykład: wszystkie środowe szkice oraz potwierdzona zmianę z czwartku."
      },
      "help-create-publish-schedule": {
        title: "Tworzenie i publikowanie harmonogramu pracy personelu",
        body: "Dodaj robocze zmiany na siatce osoby × dni, przejrzyj chipy, potem Publish schedule. Pracownicy muszą potwierdzić, zanim zmiana zostanie potwierdzona. FloqAi: create a schedule, publish schedule, how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "Usuń wiele zaplanowanych lub roboczych zmian",
        body: "Select shifts, połącz nagłówki dni i chipy, potem Delete selected. Przykład: wszystkie robocze zmiany w środę plus jedna potwierdzona zmiana w czwartek."
      },
      "help-staff-worksheet": {
        title: "Arkusz pracy - Tygodniowy kalendarz personelu",
        body: "Wybrani członkowie służby otwierają Work Calendar w Ustawieniach. Inbox / Email / SMS linki potwierdzające trafiają tutaj. Przejrzyj oczekujące zadania, zaznacz każdą zmianę (lub Select all), potem Approve selected — otwarcie wiadomości nie oznacza potwierdzenia. Siatka tygodnia pokazuje opublikowane zmiany współpracowników. Robocze pozostają w Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "Wszyscy zaczynają jako patron FLOQR. W My Profile & Settings naciśnij Elect to become a service member, wybierz rolę i kluby, wyślij na dole strony.\n\nPrzewodnik po szablonach profilu — profile społeczne patron pozostają w Mediach publicznych.\n\nZatwierdzenie Club Admin — Club Admin → Employee/Workers → Pending Worker Requests lub Przegląd i wybór na tej karcie."
      },
      "help-venue-website-ingest": {
        title: "Import strony klubu (API, RSS, iframe)",
        body: "Club Admin → Harmonogram → Website ingest. Wygeneruj sekret (pokazany raz; przechowywany jest tylko hash). Pobierz opublikowane zmiany pracowników na oficjalną stronę klubu za pomocą JSON (?format=json&dataset=schedule|hours|profile|all), RSS lub fragmentu iframe. Szkice, e-mail pracownika i telefon nigdy nie są uwzględniane. Zmień sekret, jeśli wycieknie."
      },
      "help-venue-hours-calendar": {
        title: "Godziny otwarcia lokalu",
        body: "Na profilu publicznym klubu ustaw domyślne godziny otwarcia/zamknięcia w tygodniu, a następnie dodaj nadpisania okresowe dla specjalnych tygodni, nie tracąc wartości domyślnych. Publiczna strona klubu pokazuje siatkę tygodnia od niedzieli do soboty z zakresem dat (np. Nied 9 – Sob 15, sierpnia 2026) i kolorowanie kalendarza. Nadchodzące święta publiczne uwzględniają godziny otwarcia/zamknięcia i wskazują, kiedy różnią się od zwykłego dnia roboczego. Harmonogram pracowników korzysta z czasu otwarcia − 2h do zamknięcia + 1h. Lista gości może sugerować nocne otwarcia."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin przypisanie lokalu",
        body: "Club Adminotwierza tylko Centrum Dowodzenia Miejsca dla klubu, do którego są przypisani. Otwarcie admin.html bez miejsca nie domyślnie ustawia już Zebbies. Konta demonstracyjne temp_clubadmin_N@floqr-demo.com mapują na temp-democlub-N. Nieprzypisani administratorzy proszą o przypisanie od Master Admin."
      },
      "help-general-notifications": {
        title: "Powiadomienia ogólne",
        body: "SOS2FA i inne systemowe wiadomości FloqR podążają za tymi flagami ustawionymi w rekordzie użytkownika patrona. Miejsca lub konkretnych niezależnych członków usługowych muszą subskrybować płatne usługi Twilio SMS/WhatsApp"
      },
      "help-app-language": {
        title: "Język aplikacji",
        body: "Przy pierwszym użyciu, FloqR odczytuje język przeglądarki (na przykład nl-NL → holenderski / Nederlands) i zmienia język Chrome i menu na ten język, jeśli jest obsługiwany — Kategorie wyszukiwania, zakładki Mój profil, zakładki Club Admin i zakładki Master Admin. Języki nieobsługiwane pozostają w języku angielskim. Następnie Mój profil → Język aplikacji i zapisany język profilu mają pierwszeństwo. Zapisanie języka aplikacji powoduje ponowne tłumaczenie każdej wczytywanej strony FLOQRI18n, nie tylko tej karty."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "Otwórz My Profile & Settings, aby uzyskać dostęp do ról, narzędzi sprzedawcy i opcji konta."
      },
      "help-onboarding": {
        title: "Wprowadzenie",
        body: "Onboarding patrona / członka obsługi — żądanie dostępu do Club Admin, DJ, Promoter lub usług hotelarskich. Master Admin może również wdrażać obiekty."
      },
      "help-mingl-search": {
        title: "O wyszukiwaniu Mingl",
        body: "Wyszukuj publiczne profile według wspólnych zainteresowań, stylu życia, muzyki, podróży, jedzenia, wydarzeń, samochodów, miasta, nazwy użytkownika lub osoby, którą chcesz poznać."
      },
      "help-default-template": {
        title: "Domyślny szablon",
        body: "Darmowy tradycyjny czarno-biały klasyk. Użyj FloqAi poniżej do szablonów Sport, Koszulka, VIP, Humor, Samochody, Wideo, Zdjęcia i Ballers."
      },
      "help-floqai-template-search": {
        title: "Wyszukiwanie szablonów FloqAi",
        body: "Stuknij w poruszający się znak FloqAi (lub poczekaj na jego dymki mowy), a następnie poproś o Sport, Koszulka, NBA, NFL, Samochody, Humor, VIP, Wideo, Zdjęcia lub Ballers."
      },
      "help-mingl-requests": {
        title: "O żądaniach Mingl",
        body: "Wysłane i odebrane prośby o przyjaźń lub Mingl pojawiają się tutaj. Prośby pozostają na głównej stronie Mingl; zaakceptowane rozmowy otwierają się w Mingl Czat."
      }
    },
    ar: {
      "floqai-ask-floqr": {
        title: "اسأل FloqR مع FloqAi",
        body: "اسأل FloqR مع FloqAi — اضغط على العلامة المتحركة أو انتظر المطالبة، ثم اكتب ما تريد بكلمات عادية. المنتجات: Mingl، RydR، BartR، ShoutOut، SupRstR (نجمة مشهورة)، الأندية. الأهداف: قُل “أريد أن أتمكن من…” (مثلاً أن أصبح Club Admin) أو “make me a superstar” للخطوات والروابط."
      },
      "help-soccer-jersey": {
        title: "قميص كرة القدم ShoutOut",
        body: "ابحث عن كرة القدم، القميص، أو دولة/نادي (تنزانيا، تشيلسي). كل بطاقة مجموعة الصور هي الخلفية LED التي ستراها على ShoutOut — كرة القدم · القميص · الدولة أو النادي. المقاسات 96×48، 64×48، 64×32. الاسم وعلامة من حرفين فوق المجموعة؛ الأرقام تبقى في مركز التوسيط."
      },
      "help-suprstar": {
        title: "اصنع لي supRstar / نجمة مشهورة",
        body: "اختر مكانًا → معاينة الكاميرا الخاصة → دفع 20 دولارًا (نافذة منبثقة Stripe) → موافقة Club Admin في قائمة supRstar → Go live على لوح SupRStar. مثل ShoutOut، ولكن فيديو مباشر. روابط المعاينة تستخدم رموزًا سرية بحيث لا يمكن التخمين منها من عنوان URL للنادي."
      },
      "help-become-club-admin": {
        title: "كن Club Admin",
        body: "اطلب الوصول إلى Club Admin، ثم الحصول على موافقة المكان."
      },
      "help-become-dj": {
        title: "أصبح DJ",
        body: "اختر DJ كدور الخدمة الخاص بك وارتبط بالأندية."
      },
      "help-become-promoter": {
        title: "أصبح Promoter",
        body: "اطلب الوصول إلى Promoter لقوائم الضيوف والحملات."
      },
      "help-role-profiles": {
        title: "نظرة عامة على ملفات الأدوار",
        body: "شاهد كيف تعمل أدوار Club Admin وDJ وPromoter ودوام الضيافة."
      },
      "help-staff-scheduling": {
        title: "التقويم والجدولة",
        body: "يعرض تقويم Club Admin الحالات المسودة (بنفسجي)، المعلقة (كهرماني)، المؤكدة (أخضر)، والبطاقات المفتوحة / غير المملوءة — كل منها مع حالة مكتوبة، وليس اللون فقط. الجدول هو شبكة الأشخاص × الأيام للمسودات / النشر. تعود Website ingest / publicVenueCalendar بالمهام المؤكدة فقط. يتم عرض علامة مدفوع هذا الشهر باللون الأخضر لـ Club Admins عندما تكون staffSchedulingPaid=1."
      },
      "help-club-notification-subscriptions": {
        title: "اشتراكات الإشعارات لنادي SMS وWhatsApp",
        body: "Club Admin → الإشعارات: Send test alert يستخدم المربعات المؤشرة حاليًا. داخل التطبيق (والإشعارات الفورية) يكتب رسالة نظام في FloqR Inbox. البريد الإلكتروني يستخدم عناوين مديري النادي. SMS و WhatsApp لا تزال بحاجة إلى اشتراك مدفوع بالإضافة إلى هاتف تنبيه E.164. الحبة الخضراء = اشتراك Firebase 1 (حزمة مسبقة الدفع بقيمة 10 دولارات)؛ الأحمر = 0. إذا أعاد Send test alert Authentication Error - invalid username، يجب أن يكون سر Firebase TWILIO_ACCOUNT_SID هو SID الحساب الذي يبدأ بـ AC (34 حرفًا) من console.twilio.com — وليس رمز المصادقة ولا مفتاح API (SK)."
      },
      "help-club-sms-notification": {
        title: "اشتراك إشعارات SMS",
        body: "الحبة SMS خضراء عندما يكون Firebase smsSubscribed 1 (حزمة مسبقة الدفع بقيمة 10 دولارات، 466 رصيدًا، ليست شهرية أو سنوية). الأحمر/يومض يعني 0 — افتح ؟ واضغط على Subscribe $10. الأرصدة المتبقية وآخر تاريخ دفع موجودان في هذه المساعدة. قم بإلغاء تحديد SMS وحفظ للإيقاف المؤقت للتنبيهات دون فقدان الحزمة المدفوعة."
      },
      "help-club-whatsapp-notification": {
        title: "اشتراك إشعارات WhatsApp",
        body: "حبّة WhatsApp تكون خضراء عندما يكون Firebase whatsappSubscribed 1 (حزمة مدفوعة مسبقًا $10، 233 رصيد، ليست شهرية أو سنوية). الأحمر / الوميض يعني 0 — افتح ? واضغط Subscribe $10. الأرصدة المتبقية وتاريخ الدفع الأخير موجودان في هذه المساعدة. قم بإلغاء تحديد WhatsApp وحفظ لإيقاف التنبيهات دون فقدان الحزمة المدفوعة."
      },
      "help-schedule-message-templates": {
        title: "جدول نماذج الرسائل",
        body: "Club Admin → الإشعارات → Message templates. هذه رسائل النظام (Inbox / البريد الإلكتروني / SMS / WhatsApp)، ليست ShoutOut. حرر العنوان والنص لـ New shift needs confirmation، تحديث الجدول، تأكيد الوردية، ورفض الوردية. العناصر النائبة: {club} {role} {when} {link} {worker}. صندوق وارد العامل يستخدم Review & confirm shift — أبدًا Open Related ShoutOut."
      },
      "help-schedule-confirm": {
        title: "تأكيد الورديات المخصصة",
        body: "Inbox / البريد الإلكتروني / روابط SMS تفتح Work Calendar. انظر لكل مهمة معلقة، ضع علامة عليها (أو Select all)، ثم Approve selected. فتح الرابط لا يؤكد. فقط عضو الخدمة المخصص يمكنه الموافقة — Club Admin لا يمكنه التأكيد نيابة عنه."
      },
      "help-template-catalog-report": {
        title: "تقرير كتالوج النماذج",
        body: "يسرد كل نوع قالب ShoutOut وأي أحجام LED يدعمه (Is96x48، Is64x48، Is64x32). يقدم المكان قالبًا فقط عندما يكون واحد على الأقل من هذه العلامات 1 وعلامة VenueSupports* المطابقة 1. قوالب عيد الميلاد / الوسائط المقسمة هي 1 على 96×48 و64×48 و64×32. 96×48 عبارة عن 3 أسطر جنبًا إلى جنب؛ 64×48 و64×32 يقومان بتكرار الصورة ثم التحية المكونة من 3 أسطر مع بطاقة FLOQR + معرف."
      },
      "help-club-display-screens": {
        title: "شاشات العرض FLOQR",
        body: "مخازن clubLocations Firebase تحفظ VenueSupports96x48 وVenueSupports64x48 وVenueSupports64x32 كـ 0 أو 1. القوالب تحفظ Is96x48 وIs64x48 و8 بنفس الطريقة. يسرد المكان قالبًا فقط عندما تكون إحدى الأزواج 1 على الأقل. تظل عناوين Xibo URL على display.html?location=id وdisplay2.html?location=id — حجم الشاشة غير موجود في URL. يتم تقديم عيد الميلاد بجميع الأحجام الثلاثة (3 أسطر جنبًا إلى جنب على 96×48؛ تكرار الصورة/التحية على 64×48 و64×32). القالب الأساسي هو display.html. القالب الثانوي هو display2.html."
      },
      "help-donpapi-led-wall": {
        title: "جدار LED DonPapi ShoutOut",
        body: "يتم حمل كبار الشخصيات بواسطة العاملين في الباص على الحائط LED المحمول — يُرفع في الهواء أمام الزبائن مع رسالة التحية على الشاشة الوسطى (اسم النادي في الأعلى، إطار متوهج أبيض على شكل متموّج). تبقى شاشات الطاولة LED (64×32) وجدران البورتريه (960×1900) للمحتويات الأخرى."
      },
      "help-staff-week-calendar": {
        title: "الجدول الزمني",
        body: "الجدول الزمني 5 هو شبكة أشخاص × أيام الأسبوع. 4 يغلق المحرر باستخدام 0. إنشاء مسودات، 1 حتى يؤكد العمال ما هو معلق حتى يُؤكد، 3 للحذف الجماعي، و2 لوضع الورديات المنشورة على موقع النادي. نافذة الورديات الافتراضية = وقت فتح النادي − ساعتان مروراً بالإغلاق + ساعة واحدة."
      },
      "help-staff-schedule-user-guide": {
        title: "دليل مستخدم جدولة الموظفين",
        body: "افتح ؟ بجانب الجدول الزمني على 2 الجدولة. أنشئ مسودات الورديات، 0 حتى يؤكد العمال ما هو معلق→مؤكد، ثم 1 لحذف عدة ورديات مرة واحدة. مثال: جميع مسودات يوم الأربعاء بالإضافة إلى شريحة يوم الخميس المؤكدة."
      },
      "help-create-publish-schedule": {
        title: "إنشاء ونشر جدول الموظفين",
        body: "أضف نوبات مسودة على شبكة الأشخاص × الأيام، راجع البطاقات، ثم Publish schedule. يجب على العمال التأكيد قبل أن تصبح النوبة مؤكدة. FloqAi: create a schedule، publish schedule، how to schedule staff."
      },
      "help-multi-delete-shifts": {
        title: "حذف عدة نوبات مجدولة أو مسودة",
        body: "Select shifts، اخلط رؤوس الأيام والبطاقات، ثم Delete selected. مثال: جميع مسودات يوم الأربعاء بالإضافة إلى نوبة مؤكدة واحدة يوم الخميس."
      },
      "help-staff-worksheet": {
        title: "ورقة العمل - تقويم الموظفين الأسبوعي",
        body: "الأعضاء المنتخبون يفتحون Work Calendar في الإعدادات. روابط التأكيد Inbox / البريد الإلكتروني / SMS تصل هنا. راجع المهام المعلقة، ضع علامة على كل نوبة (أو Select all)، ثم Approve selected — فتح الرسالة لا يؤكد. تظهر شبكة الأسبوع نوبات الزملاء المنشورة. تبقى المسودات في Club Admin."
      },
      "help-service-members": {
        title: "Services & Service Members",
        body: "يبدأ الجميع كـ patron FLOQR. في My Profile & Settings اضغط Elect to become a service member واختر الدور والأندية وأرسل في أسفل الصفحة.\n\nدليل قوالب الملف — تبقى الملفات الاجتماعية للـ patron في الوسائط العامة.\n\nموافقة Club Admin — Club Admin → Employee/Workers → Pending Worker Requests، أو مراجعة واختيار على هذا التبويب."
      },
      "help-venue-website-ingest": {
        title: "استيراد موقع النادي (API، RSS، iframe)",
        body: "Club Admin → الجدولة → Website ingest. إنشاء سرّي (يُعرض مرة واحدة فقط؛ يُخزن مجرد هاش). استدعاء الورديات المنشورة للموظفين على الموقع الرسمي للنادي باستخدام JSON (?format=json&dataset=schedule|hours|profile|all)، أو RSS، أو كود iframe. المسودات، البريد الإلكتروني للموظفين، والهاتف لا تُدرج أبداً. قم بتدوير السر إذا تسرب."
      },
      "help-venue-hours-calendar": {
        title: "ساعات فتح المكان",
        body: "في الملف العام للنادي، اضبط ساعات الفتح/الإغلاق الأسبوعية الافتراضية، ثم أضف تجاوزات للفترات الخاصة دون فقدان الافتراضي. تُظهر صفحة النادي العامة شبكة أسبوعية من الأحد إلى السبت مع نطاق التواريخ (مثلاً الأحد 9 – السبت 15، أغسطس 2026) وتلوين التقويم. تُدرج قائمة العطلات الرسمية القادمة ساعات الفتح والإغلاق وتوضح متى تختلف عن أيام الأسبوع المعتادة. يستخدم جدول الموظفين ساعات من الفتح − ساعتين إلى الإغلاق + ساعة. يمكن لقائمة الضيوف اقتراح الليالي المفتوحة."
      },
      "help-club-admin-affiliation": {
        title: "Club Admin تعيين المكان",
        body: "Club Admin يفتح فقط مركز قيادة المكان للنادي الذي يتم تعيينه له. فتح admin.html بدون مكان لم يعد يحدد Zebbies افتراضياً. حسابات العرض temp_clubadmin_N@floqr-demo.com تتطابق مع temp-democlub-N. المطالبين الذين لم يتم تعيينهم يطلبون التعيين من Master Admin."
      },
      "help-general-notifications": {
        title: "الإشعارات العامة",
        body: "رسائل نظام SOS2FA وغيرها من FloqR تتبع هذه العلامات كما هو محدد في سجل المستخدم الخاص بك. الأماكن أو أعضاء الخدمة المستقلين المحددين بحاجة للاشتراك في خدمات Twilio المدفوعة SMS/WhatsApp"
      },
      "help-app-language": {
        title: "لغة التطبيق",
        body: "عند الاستخدام الأول، يقرأ FloqR لغة المتصفح (على سبيل المثال nl-NL → الهولندية / Nederlands) ويحوّل كروم والقوائم إلى تلك اللغة عندما تكون مدعومة — فئات البحث، تبويبات ملفي الشخصي، تبويبات Club Admin، وتبويبات Master Admin. اللغات غير المدعومة تبقى بالإنجليزية. بعد ذلك، يكون لملفي الشخصي → لغة التطبيق ولغة الملف الشخصي المحفوظة الأسبقية. حفظ لغة التطبيق يُعيد ترجمة كل صفحة يتم تحميلها FLOQRI18n، وليس هذه البطاقة فقط."
      },
      "help-my-profile": {
        title: "My Profile & Settings",
        body: "افتح My Profile & Settings للأدوار، أدوات البائع، وخيارات الحساب."
      },
      "help-onboarding": {
        title: "الإعداد",
        body: "إعداد الرعاة / أعضائها في الخدمة — طلب Club Admin، DJ، Promoter، أو الوصول للضيافة. يمكن أيضًا لـ Master Admin إعداد الأماكن."
      },
      "help-mingl-search": {
        title: "حول بحث Mingl",
        body: "ابحث في الملفات الشخصية العامة حسب الاهتمامات المشتركة، أسلوب الحياة، الموسيقى، السفر، الطعام، الفعاليات، السيارات، المدينة، اسم المستخدم، أو من ترغب في مقابلتهم."
      },
      "help-default-template": {
        title: "القالب الافتراضي",
        body: "الكلاسيكية السوداء والبيضاء التقليدية المجانية. استخدم FloqAi أدناه للرياضة، القمصان، كبار الشخصيات، الفكاهة، السيارات، الفيديو، الصور، وقوالب اللاعبين."
      },
      "help-floqai-template-search": {
        title: "بحث قالب FloqAi",
        body: "اضغط على العلامة المتحركة FloqAi (أو انتظر فقاعات حديثها)، ثم اطلب الرياضة، القمصان، NBA، NFL، السيارات، الفكاهة، كبار الشخصيات، الفيديو، الصور، أو اللاعبين."
      },
      "help-mingl-requests": {
        title: "حول طلبات Mingl",
        body: "تظهر هنا الطلبات المرسلة والمستلمة من الأصدقاء أو Mingl. تبقى الطلبات في الصفحة الرئيسية لـ Mingl؛ المحادثات المقبولة تفتح في دردشة Mingl."
      }
    }
  };

  function localize(entry, lang) {
    if (!entry || typeof entry !== "object") return entry;
    const code = String(lang || "").trim().toLowerCase().split(/[-_]/)[0];
    if (!code || code === "en") return entry;
    const pack = packs[code];
    if (!pack) return entry;
    const id = String(entry.id || "").trim();
    const row = id && pack[id] ? pack[id] : null;
    if (!row) return entry;
    const next = Object.assign({}, entry);
    if (row.title) next.title = row.title;
    if (row.body) next.body = row.body;
    if (Array.isArray(row.searchPhrases) && row.searchPhrases.length) {
      next.searchPhrases = Array.from(new Set([...(entry.searchPhrases || []), ...row.searchPhrases]));
    }
    return next;
  }

  function resolveLang() {
    try {
      if (global.FLOQRI18n && typeof global.FLOQRI18n.getLanguage === "function") {
        return global.FLOQRI18n.getLanguage() || "en";
      }
      if (global.FLOQRI18n && global.FLOQRI18n.current) return global.FLOQRI18n.current;
      return localStorage.getItem("floqr.uiLanguage") || "en";
    } catch (_) {
      return "en";
    }
  }

  function applyHelpDom(root) {
    const doc = root && typeof root.querySelectorAll === "function" ? root : global.document;
    if (!doc || typeof doc.querySelectorAll !== "function") return;
    const lang = resolveLang();
    const nodes = [
      ...doc.querySelectorAll("details.help-popout"),
      ...doc.querySelectorAll(".floqr-help-popout")
    ];
    nodes.forEach(node => {
      const id = String(
        node.dataset?.helpId
        || node.getAttribute?.("data-help-id")
        || node.dataset?.floqaiHelpId
        || node.getAttribute?.("data-floqai-help-id")
        || ""
      ).trim();
      if (!id) return;
      let entry = null;
      try {
        const list = typeof global.FLOQRHelpRepository?.entries === "function"
          ? global.FLOQRHelpRepository.entries()
          : [];
        entry = (list || []).find(e => e && e.id === id) || null;
      } catch (_) {}
      if (!entry) {
        const summary = node.querySelector?.("summary");
        const bodyEl = node.querySelector?.(".help-popout-body, .floqai-help-body, div:not(summary)");
        entry = {
          id,
          title: String(summary?.getAttribute("aria-label") || "").replace(/^Help:\s*/i, "") || id,
          body: String(bodyEl?.textContent || "")
        };
      }
      const localized = localize(entry, lang);
      const packCode = String(lang || "").split(/[-_]/)[0];
      if (!packs[packCode] || !packs[packCode][id]) return;
      const title = localized.title || entry.title;
      const body = localized.body || entry.body;
      const summary = node.querySelector?.("summary");
      if (summary) summary.setAttribute("aria-label", title ? `Help: ${title}` : "Help");
      const bodyEl = node.querySelector?.(".help-popout-body, .floqai-help-body");
      if (bodyEl && body != null && body !== "") {
        if (!bodyEl.querySelector?.("a,button,ul,ol")) bodyEl.textContent = body;
      }
    });
  }

  global.FLOQRI18nHelp = {
    VERSION,
    packs,
    localize,
    applyHelpDom
  };
})(typeof window !== "undefined" ? window : globalThis);
