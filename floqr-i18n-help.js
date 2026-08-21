/* FLOQR help title/body locales (ru, nl) for patron / venueAdmin / serviceMember. */
(function (global) {
  "use strict";

  const VERSION = "s3.0.27";

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
        body: "Settings → Services & Service Members скрыт, когда users.IsPatron = 1/yes. Выберите роль в My Profile, чтобы выставить IsServiceMember (IsserviceMember) в 1/yes и IsPatron в 0/no. Затем запросите Club Admin, DJ, Promoter, hospitality или другие роли. Club Admins также видят Review & elect."
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
        body: "Settings → Services & Service Members is verborgen wanneer users.IsPatron 1/yes is. Kies via My Profile om IsServiceMember (IsserviceMember) op 1/yes en IsPatron op 0/no te zetten. Vraag daarna Club Admin, DJ, Promoter, hospitality of andere rollen aan. Club Admins zien ook Review & elect."
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
