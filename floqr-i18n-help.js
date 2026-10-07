/* FLOQR help title/body locales (ru, nl, fr, de, es, it, pt, el, pl, ar) for patron / venueAdmin / serviceMember. */
(function (global) {
  "use strict";

  const VERSION = "s3.0.88";

  const packs = {
    ru: {
      "help-featured-staff": {
        title: "Избранный персонал",
        body: "Отметьте сотрудников для публичной страницы клуба. Для каждого нажмите на одно из его фото в FLOQR или выберите «Загрузить с компьютера». Роль под именем можно изменить. Нажмите «Save Public Profile», чтобы опубликовать."
      },
      "help-shoutout-recommendations": {
        title: "Рекомендации ShoutOut",
        body: "Выберите стиль и тип события, затем нажмите «Improve My ShoutOut», чтобы получить идеи под ваш шаблон и размер экрана. Нажмите на идею, чтобы вставить её в сообщение, и при желании отредактируйте. «Use Past ShoutOut» возвращает одно из ваших прежних сообщений."
      },
      "help-ai-recommendations": {
        title: "Рекомендации ИИ",
        body: "Идеи, составленные для вас с учётом заведения, типа события, вашего черновика и профиля. Каждая идея уже укладывается в число строк и символов выбранного экрана. Нажмите на идею, чтобы использовать её."
      },
      "help-trending-shoutouts": {
        title: "Популярные ShoutOuts",
        body: "Популярные ShoutOuts, одобренные FLOQR; сначала — подходящие под музыку этого заведения. Нажмите, чтобы использовать."
      },
      "help-generic-shoutouts": {
        title: "Общие ShoutOuts",
        body: "Готовые идеи для обычных поводов — дней рождения и праздников. Нажмите, чтобы использовать, и измените под себя."
      },

      "help-beta-tester": {

        title: "Бета-тестирование",

        body: "Иногда FLOQR приглашает посетителей попробовать новые функции раньше других. Приглашение приходит во «Входящие»; откройте его, войдя в тот же аккаунт, и нажмите «Принять». После этого в поиске с меткой «Бета» появятся только функции, которые FLOQR выбрал для вас. Во время тестирования они могут меняться или отключаться. Приглашение действует 7 дней и только для аккаунта, на который отправлено."

      },
      "help-location-search": {
        title: "Поиск с учётом местоположения",
        body: "FLOQR сначала показывает ближайшие к вам события и клубы, затем — по названию. Если вы разрешите доступ, используется местоположение телефона или браузера (GPS); иначе город определяется примерно по вашему интернет-подключению (IP). Укажите место, например «Клубы в Монако», чтобы искать в другом городе — там результаты тоже начинаются с ближайших к вам. Доступ к местоположению можно отключить в настройках браузера или телефона."
      },
      "help-welcome": {
        title: "Добро пожаловать в FLOQR",
        body: "Ищите и бронируйте развлечения и ночные события по всему миру, отправляйте живой ShoutOut на один из наших экранов ShoutOut или Mingl с новыми людьми, друзьями и семьёй. Войдите через Google, Microsoft, Facebook или с помощью одноразового пароля (OTP). OTP — это короткий код, который FLOQR отправляет на вашу почту, в WhatsApp (по всему миру) или по SMS (только номера США и Канады). Введите код в течение нескольких минут, чтобы войти, — пароль запоминать не нужно. Каждый код действует только один раз. Никому не сообщайте свой код."
      },
      "help-ad-campaigns": {
        title: "Рекламные кампании",
        body: "Публикуйте изображение флаера или видео до 30 секунд от имени своего бизнеса, клуба, промо-группы или услуги (DJ, фотограф, промоутер, FloqQ). Выберите Inline ($45 / 7 дней — экран загрузки поиска и экраны функций) или Mingl Gist ($25 / 7 дней — лента историй), срок показа и аудиторию (возраст, пол, города, интересы). Оплата картой или ежемесячной подпиской; одобренные аккаунты могут платить по счёту. FLOQR проверяет каждое оплаченное объявление перед показом, за отклонённые деньги возвращаются. В разделе «Мои объявления» видны статус, показы, клики и счёт."
      },
      "help-completed-shoutouts": {
        title: "Завершённые ShoutOuts",
        body: "Завершённые ShoutOuts — одобренные клубом (и законченные) ShoutOuts для ваших записей. Архив переносит ShoutOut из Завершённых в Archive со сжатым текстом и медиа (если оно было). Повторное использование открывает Search с тем же текстом. Сохранить как шаблон доступно только если фон шаблона изменяем (IsModifiable). Оплаченные квитанции остаются в FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "Архивные ShoutOuts",
        body: "Архив хранит сжатую копию текста и медиа завершённого ShoutOut (если медиа было) в недорогом Firebase Storage и убирает его из Завершённых. Откройте Archive в любое время. Повторное использование работает и из Archive."
      },
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
      "help-do-not-sell": {
        title: "Не продавать и не передавать",
        body: "Включите, чтобы отказаться от персонализации по тегам профиля. Реклама для всех / house может остаться. Global Privacy Control (GPC) включает этот флаг автоматически. Политика конфиденциальности — детали CCPA / CPRA."
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
        body: "Бесплатный Traditional Black and White Classic. Шаблоны только для этой площадки, например Football Intro или Tengo muchos dólares, собраны в разделе «Эксклюзивно в» с названием площадки. Ниже через FloqAi — шаблоны Sports, Jersey, VIP, Humor, Cars, Video, Pictures и Ballers."
      },
      "help-floqai-template-search": {
        title: "Поиск шаблонов FloqAi",
        body: "Нажмите движущийся знак FloqAi (или дождитесь речевых пузырей) и попросите Sports, Jersey, NBA, NFL, Cars, Humor, VIP, Video, Pictures или Ballers."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "Стадионное интро на 20 секунд для четырёх игроков за $30 — в Zebbies Garden DC, Heist Washington DC и Aurelia. Введите в поиске «Football Intro», выберите одну из этих площадок и загрузите четыре фото, на которые у вас есть разрешение. Только для экранов 96×48."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Эксклюзив Heist Washington DC за $30. Ваше сообщение 5 секунд идёт на фоне хранилища; затем дверь сейфа взрывается, и 10 секунд купюры по $100 разлетаются за вашим текстом. В конце экран показывает логотип HEIST над надписью Washington DC, и всё повторяется. Введите в поиске «Tengo muchos dólares», затем укажите только имя или выберите @ник Instagram / Mingl (до 14 символов). Экран покажет имя и по буквам напечатает «Tengo muchos dólares... I just did a heist!». Только для экранов 96×48."
      },
      "help-club-template-repository": {
        title: "Шаблоны вашего клуба",
        body: "Шаблоны, созданные только для вашего клуба, идут первыми с пометкой «Эксклюзивно в» и названием площадки. Назначенные шаблоны — те, что посетители могут выбрать в вашем клубе; меняйте это кнопками назначения и удаления шаблона. Поиск находит шаблон даже без диакритики или с небольшой опечаткой."
      },
      "help-employee-network": {
        title: "Сеть сотрудников и персонала",
        body: "Показаны только люди, связанные с этим клубом: персонал, назначенный или одобренный здесь, администраторы клуба и персонал, привязанный к этому клубу. Чтобы дать человеку роль, введите имя, имя пользователя или email в поле «Назначить посетителя на роль», нажмите «Выбрать» рядом с нужным человеком, выберите роль, затем нажмите «Назначить выбранного посетителя на роль» и подтвердите. Сначала человеку нужен аккаунт посетителя FLOQR. Официантов, официанток и bottle girls из списка можно сделать представителями службы поддержки (CSR)."
      },
      "help-template-tags": {
        title: "Теги шаблонов",
        body: "Добавьте слова, которые гости могут ввести при поиске шаблона на вашей площадке, например вечер матча или день рождения. Менеджеры шаблонов могут добавлять теги. Администраторы шаблонов и Club Admin могут также удалять теги. Club Admin назначает эти роли в разделе Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Предпросмотр шаблона",
        body: "Нажмите «Предпросмотр» на карточке шаблона, чтобы увидеть его на примерном экране с выдуманным текстом и картинками. Переключайтесь между размерами экранов этой площадки. Ваш ShoutOut покажет ваши слова и фото."
      },
      "help-display-idle-default": {
        title: "Экран ожидания: Use ShoutOut @ площадка",
        body: "Когда ShoutOut не показывается, Display 1 показывает «Use ShoutOut @» и название вашей площадки. Каждый одобренный ShoutOut идёт 10 минут, затем экран сам возвращается к этому сообщению. Сброс экрана по умолчанию в Club Admin делает это сразу."
      },
      "help-mingl-requests": {
        title: "О запросах Mingl",
        body: "Отправленные и полученные Friend или Mingl Requests появляются здесь. Запросы остаются на главной странице Mingl; принятые разговоры открываются в Mingl Chat."
      },
      "help-club-messaging-logs": {
        title: "Журналы доставки SMS и WhatsApp",
        body: "Club Admin → Marketing → Журналы SMS и WhatsApp показывает Twilio SMS и WhatsApp для площадки (тест marketing, алерты клуба). Те же строки в Master Admin → Twilio. Dry-run: не хватало secrets или From — доставки и списания не было. Телефоны скрыты."
      },
      "help-club-messaging-credit": {
        title: "Кредит SMS и WhatsApp",
        body: "Каждый пакет $10 покрывает $7,00 ёмкости Twilio; FloqR оставляет $3,00 платформенной маржи. SMS-пакет → 466 сообщений (≈ $0,015 SMS США). WhatsApp-пакет → 233 сообщения (≈ $0,030 Twilio + Meta marketing). При нуле купите новый пакет перед отправкой. Ops SMS unlock ($10) даёт SMS-пакет. WhatsApp service ($10) даёт WhatsApp-пакет. Расчёт: $10 → 466 SMS или 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Маркетинговые кампании",
        body: "Выберите отраслевой шаблон, загрузите фон и доп. изображения, отредактируйте текст, сохраните или отправьте. Отправка списывает кредиты SMS или WhatsApp из раздела кредита сообщений."
      },
      "help-club-in-app-marketing": {
        title: "In-app маркетинг",
        body: "Публикуйте флаер или видео до 30 секунд от имени клуба. После оплаты и одобрения FLOQR реклама показывается на экране загрузки поиска, в Mingl, RydR и на других экранах FLOQR. В разделе «Публикаторы рекламы клуба» можно разрешить сотруднику публиковать рекламу (роль Club Ad Poster). SMS-кредиты не нужны."
      },
      "help-public-media-sharing": {
        title: "Публичные медиа и обмен данными",
        body: "Выберите несколько изображений или коротких видео сразу, затем задайте их порядок в публичном профиле. Профили поддерживают до 8 изображений и 2 коротких видео."
      }
    },
    nl: {
      "help-featured-staff": {
        title: "Uitgelicht servicepersoneel",
        body: "Vink het personeel aan dat op de openbare clubpagina moet staan. Tik voor elke persoon op een van hun FLOQR-foto’s of kies ‘Uploaden vanaf computer’. Je kunt de rol onder hun naam aanpassen. Tik op ‘Save Public Profile’ om te publiceren."
      },
      "help-shoutout-recommendations": {
        title: "ShoutOut-aanbevelingen",
        body: "Kies een stijl en een soort evenement en tik op 'Improve My ShoutOut' voor ideeën die passen bij je sjabloon en schermformaat. Tik op een idee om het in je bericht te zetten en pas het aan als je wilt. 'Use Past ShoutOut' haalt een van je eerdere berichten terug."
      },
      "help-ai-recommendations": {
        title: "AI-aanbevelingen",
        body: "Ideeën die voor jou zijn geschreven op basis van de locatie, het soort evenement, je concept en je profiel. Elk idee past al binnen de regels en tekens van het gekozen scherm. Tik op een idee om het te gebruiken."
      },
      "help-trending-shoutouts": {
        title: "Populaire ShoutOuts",
        body: "Populaire ShoutOuts die door FLOQR zijn goedgekeurd, eerst de ideeën die bij de muziek van deze locatie passen. Tik op een ShoutOut om hem te gebruiken."
      },
      "help-generic-shoutouts": {
        title: "Algemene ShoutOuts",
        body: "Kant-en-klare ideeën voor veelvoorkomende momenten zoals verjaardagen en feestjes. Tik op een idee om het te gebruiken en maak het daarna persoonlijk."
      },

      "help-beta-tester": {

        title: "Bètatesten",

        body: "FLOQR nodigt soms bezoekers uit om nieuwe functies vroeg te proberen. De uitnodiging komt in je Inbox; open die terwijl je bent ingelogd op hetzelfde account en kies Accepteren. Alleen de functies die FLOQR voor jou heeft gekozen verschijnen dan bij Zoeken met het label Bèta. Ze kunnen tijdens het testen veranderen of worden uitgezet. Uitnodigingen verlopen na 7 dagen en werken alleen voor het account waarnaar ze zijn gestuurd."

      },
      "help-location-search": {
        title: "Zoeken op locatie",
        body: "FLOQR toont evenementen en clubs die het dichtst bij je zijn eerst, daarna op naam. Als je het toestaat, gebruikt FLOQR de locatie van je telefoon of browser (gps); anders wordt je stad geschat op basis van je internetverbinding (IP). Typ een plaats, zoals Clubs in Monaco, om ergens anders te zoeken — ook daar staan de dichtstbijzijnde eerst. Je kunt locatietoegang uitzetten in de instellingen van je browser of telefoon."
      },
      "help-welcome": {
        title: "Welkom bij FLOQR",
        body: "Zoek en boek entertainment- en nachtleven-evenementen wereldwijd, stuur een live ShoutOut naar een van onze ShoutOut-schermen, of Mingl met nieuwe mensen, vrienden en familie. Log in met Google, Microsoft, Facebook of een eenmalig wachtwoord (OTP). Een OTP is een korte code die FLOQR naar je e-mail, via WhatsApp (wereldwijd) of per SMS (alleen nummers uit de VS en Canada) stuurt. Typ de code binnen een paar minuten om in te loggen — geen wachtwoord om te onthouden. Elke code werkt maar één keer. Deel je code nooit met iemand."
      },
      "help-ad-campaigns": {
        title: "Advertentiecampagnes",
        body: "Plaats een flyerafbeelding of een video van maximaal 30 seconden voor je bedrijf, club, promotiegroep of dienst (DJ, fotograaf, promoter, FloqQ). Kies Inline ($45 / 7 dagen — laadscherm van Zoeken en functieschermen) of Mingl Gist ($25 / 7 dagen — storyfeed), de looptijd en wie het moet zien (leeftijd, geslacht, steden, interesses). Betaal per kaart of met een maandabonnement; goedgekeurde accounts kunnen op factuur betalen. FLOQR controleert elke betaalde advertentie voordat ze draait en afgewezen advertenties worden terugbetaald. Mijn advertenties toont de status, weergaven, klikken en je factuur."
      },
      "help-completed-shoutouts": {
        title: "Voltooide ShoutOuts",
        body: "Voltooide ShoutOuts zijn door de club goedgekeurde (en afgeronde) ShoutOuts voor je administratie. Archiveren verplaatst een ShoutOut van Voltooid naar Archive met gecomprimeerde tekst en media (als die er was). Hergebruik opent Search met dezelfde tekst. Opslaan als sjabloon verschijnt alleen als de sjabloonachtergrond wijzigbaar is (IsModifiable). Betaalde bonnen blijven in FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "Gearchiveerde ShoutOuts",
        body: "Archive bewaart een gecomprimeerde kopie van je voltooide ShoutOut-tekst en media (als het origineel media had) in goedkope Firebase-opslag, en haalt het uit Voltooid. Open Archive wanneer je wilt. Hergebruik werkt ook vanuit Archive."
      },
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
      "help-do-not-sell": {
        title: "Niet verkopen of delen",
        body: "Zet dit aan om personalisatie op basis van profieltags uit te schakelen. House- en alle-publiek-creatives kunnen blijven. Global Privacy Control (GPC) zet dit automatisch aan. Zie het Privacybeleid voor CCPA / CPRA."
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
        body: "Gratis Traditional Black and White Classic. Sjablonen die alleen voor deze locatie zijn, zoals Football Intro of Tengo muchos dólares, staan onder ‘Exclusief bij’ met de naam van de locatie. Gebruik FloqAi hieronder voor Sports, Jersey, VIP, Humor, Cars, Video, Pictures en Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi-sjabloonzoeken",
        body: "Tik op het bewegende FloqAi-merkteken (of wacht op de speech bubbles) en vraag om Sports, Jersey, NBA, NFL, Cars, Humor, VIP, Video, Pictures of Ballers."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "Een stadionintro van 20 seconden voor vier spelers voor $30, bij Zebbies Garden DC, Heist Washington DC en Aurelia. Typ ‘Football Intro’ in Zoeken, kies een van die locaties en upload vier foto’s waarvoor je toestemming hebt. Alleen voor 96×48-schermen."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Exclusief bij Heist Washington DC voor $30. Je bericht speelt 5 seconden voor de kluis; dan vliegt de kluisdeur open en vliegen biljetten van $100 10 seconden lang achter je tekst rond. Daarna toont het scherm het HEIST-logo boven Washington DC en begint alles opnieuw. Typ ‘Tengo muchos dólares’ in Zoeken en vul alleen een naam in of kies een @Instagram- / @Mingl-handle (max. 14). Het scherm toont de naam en typt letter voor letter ‘Tengo muchos dólares... I just did a heist!’. Alleen voor 96×48-schermen."
      },
      "help-club-template-repository": {
        title: "Sjablonen van je club",
        body: "Sjablonen die alleen voor je club zijn, staan bovenaan met ‘Exclusief bij’ en de naam van je locatie. Toegewezen sjablonen kunnen gasten bij je club kiezen; wijzig dat met Sjabloon toewijzen of Sjabloon verwijderen. Zoeken vindt een sjabloon ook zonder accent of met een kleine typfout."
      },
      "help-employee-network": {
        title: "Netwerk van medewerkers en personeel",
        body: "Alleen mensen die aan deze club gekoppeld zijn staan in de lijst: personeel dat hier is aangewezen of goedgekeurd, clubbeheerders en personeel dat aan deze club verbonden is. Om iemand een rol te geven, typ je naam, gebruikersnaam of e-mail bij Gast aanwijzen voor een rol, tik je op Selecteren naast de juiste persoon, kies je de rol, tik je op Geselecteerde gast aanwijzen voor rol en bevestig je. De persoon heeft eerst een FLOQR-gastaccount nodig. Obers, serveersters en bottle girls op de lijst kun je klantenservicemedewerker (CSR) maken."
      },
      "help-template-tags": {
        title: "Sjabloontags",
        body: "Voeg woorden toe die gasten kunnen typen als ze een sjabloon zoeken bij je locatie, zoals wedstrijdavond of verjaardag. Sjabloonmanagers kunnen tags toevoegen. Sjabloonbeheerders en Club Admins kunnen tags ook verwijderen. Club Admin wijst deze rollen toe onder Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Een sjabloon bekijken",
        body: "Tik op Voorbeeld op een sjabloonkaart om het op een voorbeeldscherm te zien spelen met verzonnen tekst en beelden. Wissel tussen de schermformaten van deze locatie. Je eigen ShoutOut toont jouw woorden en foto’s."
      },
      "help-display-idle-default": {
        title: "Rustscherm: Use ShoutOut @ locatie",
        body: "Als er geen ShoutOut speelt, toont Display 1 ‘Use ShoutOut @’ met de naam van je locatie. Elke goedgekeurde ShoutOut speelt 10 minuten; daarna keert het scherm vanzelf terug naar die tekst. Scherm terugzetten naar standaard in Club Admin doet dat meteen."
      },
      "help-mingl-requests": {
        title: "Over Mingl Requests",
        body: "Verzonden en ontvangen Friend- of Mingl Requests verschijnen hier. Requests blijven op de hoofd-Mingl-pagina; geaccepteerde gesprekken openen in Mingl Chat."
      },
      "help-club-messaging-logs": {
        title: "SMS- en WhatsApp-bezorglogboeken",
        body: "Club Admin → Marketing → SMS- en WhatsApp-logboeken toont Twilio SMS en WhatsApp voor deze locatie (marketingtest, clubalerts). Dezelfde rijen onder Master Admin → Twilio. Dry-run: secrets of From ontbraken — niets geleverd, geen tegoed afgeschreven. Telefoons gemaskeerd."
      },
      "help-club-messaging-credit": {
        title: "SMS- en WhatsApp-tegoed",
        body: "Elk pakket van $10 dekt $7,00 Twilio-capaciteit; FloqR houdt $3,00 platformmarge. SMS-pakket → 466 berichten (≈ $0,015 US-SMS). WhatsApp-pakket → 233 berichten (≈ $0,030 Twilio + Meta marketing). Bij saldo 0 eerst een nieuw pakket kopen. Ops SMS-unlock ($10) bevat een SMS-pakket. WhatsApp-service ($10) bevat een WhatsApp-pakket. Rekening: $10 → 466 SMS of 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Marketingcampagnes",
        body: "Kies een branchesjabloon, laad achtergrond en extra afbeeldingen, bewerk tekst, sla op of verstuur. Verzenden debiteert SMS- of WhatsApp-tegoed via Messagingtegoed."
      },
      "help-club-in-app-marketing": {
        title: "In-app marketing",
        body: "Plaats een flyer of een video van maximaal 30 seconden namens je club. Zodra hij betaald en door FLOQR goedgekeurd is, verschijnt hij op het laadscherm van Zoeken, in Mingl, RydR en op andere FLOQR-schermen. Met Advertentieplaatsers van de club laat je een teamlid advertenties plaatsen (rol Club Ad Poster). Geen sms-tegoed nodig."
      },
      "help-public-media-sharing": {
        title: "Openbare media en gegevensdeling",
        body: "Kies meerdere afbeeldingen of korte video's tegelijk en rangschik daarna hun volgorde op het openbare profiel. Profielen ondersteunen tot 8 afbeeldingen en 2 korte video's."
      }
    },
    fr: {
      "help-featured-staff": {
        title: "Personnel mis en avant",
        body: "Cochez les membres du personnel à afficher sur la page publique du club. Pour chaque personne, touchez une de ses photos FLOQR ou choisissez « Importer depuis l’ordinateur ». Vous pouvez modifier le rôle affiché sous son nom. Appuyez sur « Save Public Profile » pour publier."
      },
      "help-shoutout-recommendations": {
        title: "Recommandations ShoutOut",
        body: "Choisissez un style et un type d'événement, puis touchez « Improve My ShoutOut » pour obtenir des idées adaptées à votre modèle et à la taille de l'écran. Touchez une idée pour la placer dans votre message, puis modifiez-la si vous le souhaitez. « Use Past ShoutOut » reprend l'un de vos anciens messages."
      },
      "help-ai-recommendations": {
        title: "Recommandations IA",
        body: "Des idées écrites pour vous à partir du lieu, du type d'événement, de votre brouillon et de votre profil. Chaque idée respecte déjà le nombre de lignes et de caractères de l'écran choisi. Touchez-en une pour l'utiliser."
      },
      "help-trending-shoutouts": {
        title: "ShoutOuts tendance",
        body: "Des ShoutOuts populaires approuvés par FLOQR, en commençant par ceux qui correspondent à la musique de ce lieu. Touchez-en un pour l'utiliser."
      },
      "help-generic-shoutouts": {
        title: "ShoutOuts génériques",
        body: "Des idées prêtes à l'emploi pour les moments courants comme les anniversaires et les fêtes. Touchez-en une pour l'utiliser, puis personnalisez-la."
      },

      "help-beta-tester": {

        title: "Tests bêta",

        body: "FLOQR invite parfois des clients à essayer de nouvelles fonctionnalités en avant-première. L'invitation arrive dans votre boîte de réception ; ouvrez-la en étant connecté au même compte et choisissez Accepter. Seules les fonctionnalités que FLOQR a choisies pour vous apparaissent alors dans la recherche avec l'étiquette Bêta. Elles peuvent changer ou être désactivées pendant les tests. Les invitations expirent après 7 jours et ne fonctionnent que pour le compte destinataire."

      },
      "help-location-search": {
        title: "Recherche selon votre position",
        body: "FLOQR affiche d'abord les événements et clubs les plus proches de vous, puis par nom. Si vous l'autorisez, FLOQR utilise la position de votre téléphone ou navigateur (GPS) ; sinon, votre ville est estimée à partir de votre connexion internet (IP). Saisissez un lieu, par exemple Clubs à Monaco, pour chercher ailleurs — les résultats commencent toujours par les plus proches de vous. Vous pouvez désactiver l'accès à la position dans les réglages de votre navigateur ou téléphone."
      },
      "help-welcome": {
        title: "Bienvenue sur FLOQR",
        body: "Recherchez et réservez des sorties et événements nocturnes dans le monde entier, envoyez un ShoutOut en direct sur l'un de nos écrans ShoutOut, ou Mingl avec de nouvelles personnes, des amis et la famille. Connectez-vous avec Google, Microsoft, Facebook ou un mot de passe à usage unique (OTP). Un OTP est un code court que FLOQR envoie à votre e-mail, sur WhatsApp (monde entier) ou par SMS (numéros américains et canadiens uniquement). Saisissez le code en quelques minutes pour vous connecter — aucun mot de passe à retenir. Chaque code ne fonctionne qu'une fois. Ne partagez jamais votre code."
      },
      "help-ad-campaigns": {
        title: "Campagnes publicitaires",
        body: "Publiez une image de flyer ou une vidéo de 30 secondes maximum pour votre entreprise, votre club, votre groupe de promotion ou votre service (DJ, photographe, promoteur, FloqQ). Choisissez Inline (45 $ / 7 jours — écran de chargement de la recherche et pages des fonctions) ou Mingl Gist (25 $ / 7 jours — fil de stories), la durée et qui doit la voir (âge, genre, villes, centres d'intérêt). Payez par carte ou par abonnement mensuel ; les comptes approuvés peuvent payer sur facture. FLOQR vérifie chaque publicité payée avant diffusion et les publicités refusées sont remboursées. Mes publicités affiche le statut, les vues, les clics et votre facture."
      },
      "help-completed-shoutouts": {
        title: "ShoutOuts terminés",
        body: "Les ShoutOuts terminés sont les ShoutOuts approuvés par le club (et terminés) pour vos archives. Archiver déplace un ShoutOut de Terminés vers Archive avec texte et média compressés (s'il y en avait). Réutiliser ouvre Search avec le même texte. Enregistrer comme modèle apparaît seulement si l'arrière-plan du modèle est modifiable (IsModifiable). Les reçus payés restent dans FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "ShoutOuts archivés",
        body: "Archive stocke une copie compressée du texte et du média de votre ShoutOut terminé (s'il y avait un média) dans un stockage Firebase économique, et le retire de Terminés. Ouvrez Archive à tout moment. Réutiliser fonctionne aussi depuis Archive."
      },
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
      "help-do-not-sell": {
        title: "Ne pas vendre ni partager",
        body: "Activez pour refuser la personnalisation par tags de profil. Les creatives house / tous publics peuvent rester. Global Privacy Control (GPC) active ceci automatiquement. Voir la Politique de confidentialite pour CCPA / CPRA."
      },
      "help-app-language": {
        title: "Langue de l'application",
        body: "Lors de la première utilisation, FloqR lit la langue du navigateur (par exemple nl-NL → Néerlandais / Nederlands) et bascule le chrome et les menus vers cette langue lorsqu'elle est prise en charge : catégories de recherche, onglets Mon profil, onglets Club Admin et onglets Master Admin. Les langues non prises en charge restent en anglais. Après cela, Mon profil → Langue de l'application et la langue du profil enregistré gagnent. La langue de l'application de sauvegarde retraduit chaque page qui charge FLOQRI18n, pas seulement cette carte."
      },
      "help-my-profile": {
        title: "Mon profil et paramètres",
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
        body: "Traditional Black and White Classic gratuit. Les modèles réservés à ce lieu, comme Football Intro ou Tengo muchos dólares, apparaissent sous « Exclusif à » suivi du nom du lieu. Utilisez FloqAi ci-dessous pour les modèles Sports, Jersey, VIP, Humor, Cars, Video, Pictures et Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi recherche de modèles",
        body: "Appuyez sur la marque FloqAi en mouvement (ou attendez ses bulles), puis demandez Sports, Jersey, NBA, NFL, Cars, Humour, VIP, Video, Pictures ou Ballers."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "Une intro de stade de 20 secondes pour quatre joueurs, à 30 $, proposée à Zebbies Garden DC, Heist Washington DC et Aurelia. Tapez « Football Intro » dans Recherche, choisissez l’un de ces lieux, puis importez quatre photos que vous avez le droit d’utiliser. Uniquement sur les écrans 96×48."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Exclusivité Heist Washington DC à 30 $. Votre message s’affiche 5 secondes devant la chambre forte ; puis la porte du coffre explose et des billets de 100 $ jaillissent derrière votre texte pendant 10 secondes. L’écran se termine sur le logo HEIST au-dessus de Washington DC, puis tout recommence. Tapez « Tengo muchos dólares » dans Recherche, puis saisissez seulement un nom ou choisissez un @pseudo Instagram / Mingl (14 max.). L’écran affiche le nom et tape « Tengo muchos dólares... I just did a heist! » lettre par lettre. Uniquement sur les écrans 96×48."
      },
      "help-club-template-repository": {
        title: "Les modèles de votre club",
        body: "Les modèles créés uniquement pour votre club apparaissent en premier avec la mention « Exclusif à » suivie du nom du lieu. Les modèles attribués sont ceux que les clients peuvent choisir dans votre club ; modifiez-les avec Attribuer ou Retirer le modèle. La recherche trouve un modèle même sans accent ou avec une petite faute de frappe."
      },
      "help-employee-network": {
        title: "Réseau des employés et du personnel",
        body: "Seules les personnes liées à ce club sont listées : personnel désigné ou approuvé ici, admins du club et personnel affilié à ce club. Pour donner un rôle à quelqu’un, saisissez son nom, son nom d’utilisateur ou son e-mail sous Attribuer un rôle à un client, appuyez sur Sélectionner à côté de la bonne personne, choisissez le rôle, puis appuyez sur Attribuer le rôle au client sélectionné et confirmez. La personne doit d’abord avoir un compte client FLOQR. Les serveurs, serveuses et bottle girls de la liste peuvent devenir représentants du service client (CSR)."
      },
      "help-template-tags": {
        title: "Tags des modèles",
        body: "Ajoutez des mots que les clients pourraient taper pour trouver un modèle dans votre lieu, comme soirée match ou anniversaire. Les Gestionnaires des modèles peuvent ajouter des tags. Les Administrateurs des modèles et les Club Admins peuvent aussi en retirer. Le Club Admin attribue ces rôles dans Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Aperçu d’un modèle",
        body: "Touchez Aperçu sur une carte de modèle pour le voir jouer sur un écran d’exemple avec du texte et des images inventés. Passez d’une taille d’écran à l’autre parmi celles du lieu. Votre ShoutOut affiche vos propres mots et photos."
      },
      "help-display-idle-default": {
        title: "Écran d’attente : Use ShoutOut @ lieu",
        body: "Quand aucun ShoutOut n’est diffusé, Display 1 affiche « Use ShoutOut @ » suivi du nom de votre lieu. Chaque ShoutOut approuvé passe 10 minutes, puis l’écran revient seul à ce message. La réinitialisation de l’affichage par défaut dans Club Admin le fait immédiatement."
      },
      "help-mingl-requests": {
        title: "Environ Mingl demandes",
        body: "Les demandes d'ami ou Mingl envoyées et reçues apparaissent ici. Les demandes restent sur la page Mingl principale ; conversations acceptées ouvertes dans Mingl Chat."
      },
      "help-club-messaging-logs": {
        title: "Journaux de livraison SMS et WhatsApp",
        body: "Club Admin → Marketing → Journaux SMS et WhatsApp affiche Twilio SMS et WhatsApp pour ce lieu (test marketing, alertes club). Les mêmes lignes apparaissent sous Master Admin → Twilio. Dry-run : secrets ou From manquants — rien n’a été livré et aucun crédit débité. Téléphones masqués."
      },
      "help-club-messaging-credit": {
        title: "Crédit SMS et WhatsApp",
        body: "Chaque pack à 10 $ finance 7,00 $ de capacité Twilio ; FloqR conserve 3,00 $ de marge plateforme. Pack SMS → 466 messages (≈ 0,015 $ SMS US tout compris). Pack WhatsApp → 233 messages (≈ 0,030 $ Twilio + Meta marketing). À 0, achetez un nouveau pack avant d’envoyer. Le déblocage SMS ops (10 $) inclut un pack SMS. Le service WhatsApp (10 $) inclut un pack WhatsApp. Calcul : 10 $ → 466 SMS ou 233 WhatsApp (7,00 $ Twilio / 3,00 $ FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Campagnes marketing",
        body: "Choisissez un modèle sectoriel, ajoutez images de fond et extras, modifiez le texte, puis enregistrez ou envoyez. L’envoi débite les crédits SMS ou WhatsApp depuis Crédit messagerie."
      },
      "help-club-in-app-marketing": {
        title: "Marketing in-app",
        body: "Publiez un flyer ou une vidéo de 30 secondes maximum au nom de votre club. Une fois payée et approuvée par FLOQR, elle s'affiche sur l'écran de chargement de la recherche, dans Mingl, RydR et sur d'autres écrans FLOQR. Publicateurs d'annonces du club permet à un membre de l'équipe de publier pour le club (rôle Club Ad Poster). Aucun crédit SMS nécessaire."
      },
      "help-public-media-sharing": {
        title: "Médias publics et partage",
        body: "Choisissez plusieurs images ou courtes vidéos à la fois, puis organisez leur ordre sur le profil public. Les profils acceptent jusqu'à 8 images et 2 courtes vidéos."
      }
    },
    de: {
      "help-featured-staff": {
        title: "Hervorgehobenes Servicepersonal",
        body: "Hake das Personal an, das auf der öffentlichen Clubseite erscheinen soll. Tippe für jede Person auf eines ihrer FLOQR-Fotos oder wähle „Vom Computer hochladen“. Du kannst die Rolle unter dem Namen ändern. Tippe auf „Save Public Profile“, um zu veröffentlichen."
      },
      "help-shoutout-recommendations": {
        title: "ShoutOut-Empfehlungen",
        body: "Wähle einen Stil und eine Veranstaltungsart und tippe dann auf „Improve My ShoutOut“, um Ideen zu erhalten, die zu deiner Vorlage und Displaygröße passen. Tippe auf eine Idee, um sie in deine Nachricht zu übernehmen, und bearbeite sie bei Bedarf. „Use Past ShoutOut“ holt eine deiner früheren Nachrichten zurück."
      },
      "help-ai-recommendations": {
        title: "KI-Empfehlungen",
        body: "Ideen, die für dich aus dem Veranstaltungsort, der Veranstaltungsart, deinem Entwurf und deinem Profil erstellt werden. Jede Idee passt bereits zu den Zeilen und Zeichen deines gewählten Displays. Tippe auf eine, um sie zu verwenden."
      },
      "help-trending-shoutouts": {
        title: "Angesagte ShoutOuts",
        body: "Beliebte, von FLOQR freigegebene ShoutOuts – zuerst die, die zur Musik dieses Ortes passen. Tippe auf einen, um ihn zu verwenden."
      },
      "help-generic-shoutouts": {
        title: "Allgemeine ShoutOuts",
        body: "Fertige Ideen für typische Anlässe wie Geburtstage und Feiern. Tippe auf eine, um sie zu verwenden, und passe sie dann an."
      },

      "help-beta-tester": {

        title: "Beta-Tests",

        body: "FLOQR lädt Gäste manchmal ein, neue Funktionen vorab auszuprobieren. Die Einladung kommt in Ihren Posteingang; öffnen Sie sie, während Sie mit demselben Konto angemeldet sind, und wählen Sie Annehmen. Nur die Funktionen, die FLOQR für Sie ausgewählt hat, erscheinen dann in der Suche mit dem Label Beta. Sie können sich während des Tests ändern oder abgeschaltet werden. Einladungen laufen nach 7 Tagen ab und gelten nur für das Konto, an das sie gesendet wurden."

      },
      "help-location-search": {
        title: "Standortbezogene Suche",
        body: "FLOQR zeigt zuerst die Events und Clubs, die Ihnen am nächsten sind, danach nach Name. Wenn Sie es erlauben, nutzt FLOQR den Standort Ihres Telefons oder Browsers (GPS); sonst wird Ihre Stadt anhand Ihrer Internetverbindung (IP) geschätzt. Geben Sie einen Ort ein, z. B. Clubs in Monaco, um woanders zu suchen — auch dort stehen die nächstgelegenen zuerst. Den Standortzugriff können Sie in den Browser- oder Telefoneinstellungen deaktivieren."
      },
      "help-welcome": {
        title: "Willkommen bei FLOQR",
        body: "Suche und buche Entertainment und Nightlife-Events weltweit, sende einen Live-ShoutOut an eines unserer ShoutOut-Displays oder Mingl mit neuen Leuten, Freunden und Familie. Melde dich mit Google, Microsoft, Facebook oder einem Einmalpasswort (OTP) an. Ein OTP ist ein kurzer Code, den FLOQR an deine E-Mail, per WhatsApp (weltweit) oder per SMS (nur Nummern aus den USA und Kanada) sendet. Gib den Code innerhalb weniger Minuten ein, um dich anzumelden — kein Passwort nötig. Jeder Code funktioniert nur einmal. Teile deinen Code niemals mit anderen."
      },
      "help-ad-campaigns": {
        title: "Werbekampagnen",
        body: "Veröffentliche ein Flyer-Bild oder ein Video bis 30 Sekunden für dein Unternehmen, deinen Club, deine Promotion-Gruppe oder deinen Service (DJ, Fotograf, Promoter, FloqQ). Wähle Inline (45 $ / 7 Tage — Ladebildschirm der Suche und Funktionsseiten) oder Mingl Gist (25 $ / 7 Tage — Story-Feed), die Laufzeit und wer die Anzeige sehen soll (Alter, Geschlecht, Städte, Interessen). Bezahle per Karte oder Monatsabo; freigegebene Konten können auf Rechnung zahlen. FLOQR prüft jede bezahlte Anzeige vor dem Start, abgelehnte Anzeigen werden erstattet. Unter Meine Anzeigen siehst du Status, Aufrufe, Klicks und deine Rechnung."
      },
      "help-completed-shoutouts": {
        title: "Abgeschlossene ShoutOuts",
        body: "Abgeschlossene ShoutOuts sind vom Club freigegebene (und beendete) ShoutOuts für Ihre Unterlagen. Archivieren verschiebt einen ShoutOut von Abgeschlossen nach Archive mit komprimiertem Text und Medien (falls vorhanden). Erneut verwenden öffnet Search mit demselben Text. Als Vorlage speichern erscheint nur, wenn der Vorlagenhintergrund änderbar ist (IsModifiable). Bezahlte Belege bleiben in FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "Archivierte ShoutOuts",
        body: "Archive speichert eine komprimierte Kopie Ihres abgeschlossenen ShoutOut-Texts und der Medien (falls vorhanden) in kostengünstigem Firebase-Speicher und entfernt sie aus Abgeschlossen. Öffnen Sie Archive jederzeit. Erneut verwenden funktioniert auch aus Archive."
      },
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
      "help-do-not-sell": {
        title: "Nicht verkaufen oder teilen",
        body: "Aktivieren Sie dies, um personalisierte Anzeigen anhand von Profil-Tags abzulehnen. House- und All-Audience-Creatives konnen weiterhin erscheinen. Global Privacy Control (GPC) setzt dies automatisch. Details in der Datenschutzrichtlinie (CCPA / CPRA)."
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
        body: "Kostenloses Traditional Black and White Classic. Vorlagen nur für diese Location, etwa Football Intro oder Tengo muchos dólares, stehen unter „Exklusiv bei“ mit dem Namen der Location. Nutze FloqAi unten für Sports, Jersey, VIP, Humor, Cars, Video, Pictures und Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi Vorlagensuche",
        body: "Tippen Sie auf die bewegliche FloqAi-Marke (oder warten Sie auf die Sprechblasen) und fragen Sie dann nach „Sport“, „Trikot“, „NBA“, „NFL“, „Autos“, „Humor“, „VIP“, „Video“, „Bilder“ oder „Ballspieler“."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "Ein 20-sekündiges Stadion-Intro für vier Spieler für 30 $, verfügbar bei Zebbies Garden DC, Heist Washington DC und Aurelia. Gib „Football Intro“ in der Suche ein, wähle eine dieser Locations und lade vier Fotos hoch, für die du die Erlaubnis hast. Nur auf 96×48-Displays."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Exklusiv bei Heist Washington DC für 30 $. Deine Nachricht läuft 5 Sekunden vor dem Tresorraum; dann fliegt die Tresortür auf und 100-$-Scheine wirbeln 10 Sekunden lang hinter deinem Text. Zum Schluss zeigt die Anzeige das HEIST-Logo über Washington DC, dann beginnt alles von vorn. Gib „Tengo muchos dólares“ in der Suche ein und trage nur einen Namen ein oder wähle ein @Instagram- / @Mingl-Handle (max. 14). Die Anzeige zeigt den Namen und tippt „Tengo muchos dólares... I just did a heist!“ Buchstabe für Buchstabe. Nur auf 96×48-Displays."
      },
      "help-club-template-repository": {
        title: "Vorlagen deines Clubs",
        body: "Vorlagen nur für deinen Club stehen ganz oben und sind mit „Exklusiv bei“ und dem Namen deiner Location markiert. Zugewiesene Vorlagen können Gäste in deinem Club wählen; ändere das mit Vorlage zuweisen oder Vorlage entfernen. Die Suche findet eine Vorlage auch ohne Akzent oder mit einem kleinen Tippfehler."
      },
      "help-employee-network": {
        title: "Mitarbeiter- und Personalnetzwerk",
        body: "Nur Personen mit Bezug zu diesem Club werden angezeigt: hier ernanntes oder genehmigtes Personal, Club-Admins und mit diesem Club verbundenes Personal. Um jemandem eine Rolle zu geben, gib unter Gast für eine Rolle ernennen Name, Benutzername oder E-Mail ein, tippe neben der richtigen Person auf Auswählen, wähle die Rolle, tippe dann auf Ausgewählten Gast für die Rolle ernennen und bestätige. Die Person braucht zuerst ein FLOQR-Gastkonto. Kellner, Kellnerinnen und Bottle Girls auf der Liste können zu Kundenservice-Vertretern (CSR) gemacht werden."
      },
      "help-template-tags": {
        title: "Vorlagen-Tags",
        body: "Füge Wörter hinzu, die Gäste eintippen könnten, wenn sie bei deiner Location eine Vorlage suchen, etwa Spieleabend oder Geburtstag. Vorlagen-Manager können Tags hinzufügen. Vorlagen-Administratoren und Club Admins können Tags auch entfernen. Club Admin vergibt diese Rollen unter Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Vorlage ansehen",
        body: "Tippe auf einer Vorlagenkarte auf Vorschau, um sie auf einer Beispielanzeige mit erfundenem Text und Bildern zu sehen. Wechsle zwischen den Anzeigegrößen dieser Location. Dein eigener ShoutOut zeigt deine Worte und Fotos."
      },
      "help-display-idle-default": {
        title: "Ruhebildschirm: Use ShoutOut @ Location",
        body: "Wenn kein ShoutOut läuft, zeigt Display 1 „Use ShoutOut @“ mit dem Namen deiner Location. Jeder freigegebene ShoutOut läuft 10 Minuten, danach kehrt die Anzeige von selbst zu diesem Text zurück. Anzeige auf Standard zurücksetzen in Club Admin macht das sofort."
      },
      "help-mingl-requests": {
        title: "Ungefähr Mingl Anfragen",
        body: "Gesendete und empfangene Freundschafts- oder Mingl-Anfragen werden hier angezeigt. Anfragen bleiben auf der Mingl-Hauptseite; Akzeptierte Konversationen werden im Mingl Chat geöffnet."
      },
      "help-club-messaging-logs": {
        title: "SMS- und WhatsApp-Zustellprotokolle",
        body: "Club Admin → Marketing → SMS- & WhatsApp-Protokolle zeigt Twilio SMS und WhatsApp für diesen Standort (Marketing-Test, Club-Alerts). Dieselben Zeilen unter Master Admin → Twilio. Dry-run: Secrets oder From fehlten — nichts zugestellt, kein Guthaben belastet. Telefonnummern maskiert."
      },
      "help-club-messaging-credit": {
        title: "SMS- & WhatsApp-Guthaben",
        body: "Jedes 10-$-Paket finanziert 7,00 $ Twilio-Kapazität; FloqR behält 3,00 $ Plattformmarge. SMS-Paket → 466 Nachrichten (≈ 0,015 $ US-SMS). WhatsApp-Paket → 233 Nachrichten (≈ 0,030 $ Twilio + Meta Marketing). Bei 0 Guthaben neues 10-$-Paket kaufen. Ops-SMS-Freischaltung (10 $) inkl. SMS-Paket. WhatsApp-Service (10 $) inkl. WhatsApp-Paket. Rechnung: 10 $ → 466 SMS oder 233 WhatsApp (7,00 $ Twilio / 3,00 $ FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Marketingkampagnen",
        body: "Branchenvorlage wählen, Hintergrund- und Zusatzbilder laden, Text anpassen, speichern oder senden. Senden belastet SMS- oder WhatsApp-Guthaben unter Messaging-Guthaben."
      },
      "help-club-in-app-marketing": {
        title: "In-App-Marketing",
        body: "Veröffentliche einen Flyer oder ein Video bis 30 Sekunden im Namen deines Clubs. Sobald die Anzeige bezahlt und von FLOQR freigegeben ist, erscheint sie auf dem Ladebildschirm der Suche, in Mingl, RydR und auf weiteren FLOQR-Seiten. Unter Anzeigen-Poster des Clubs kannst du einem Teammitglied das Veröffentlichen erlauben (Rolle Club Ad Poster). Keine SMS-Guthaben nötig."
      },
      "help-public-media-sharing": {
        title: "Öffentliche Medien und Datenfreigabe",
        body: "Wähle mehrere Bilder oder kurze Videos auf einmal aus und lege dann ihre Reihenfolge im öffentlichen Profil fest. Profile unterstützen bis zu 8 Bilder und 2 kurze Videos."
      }
    },
    es: {
      "help-featured-staff": {
        title: "Personal destacado",
        body: "Marca el personal que quieres en la página pública del club. Para cada persona, toca una de sus fotos de FLOQR o elige «Subir desde el ordenador». Puedes cambiar el puesto que aparece bajo su nombre. Pulsa «Save Public Profile» para publicar."
      },
      "help-shoutout-recommendations": {
        title: "Recomendaciones de ShoutOut",
        body: "Elige un estilo y un tipo de evento y toca «Improve My ShoutOut» para recibir ideas que se ajustan a tu plantilla y al tamaño de la pantalla. Toca una idea para ponerla en tu mensaje y edítala si quieres. «Use Past ShoutOut» recupera uno de tus mensajes anteriores."
      },
      "help-ai-recommendations": {
        title: "Recomendaciones de IA",
        body: "Ideas escritas para ti a partir del local, el tipo de evento, tu borrador y tu perfil. Cada idea ya cabe en las líneas y caracteres de la pantalla elegida. Toca una para usarla."
      },
      "help-trending-shoutouts": {
        title: "ShoutOuts en tendencia",
        body: "ShoutOuts populares aprobados por FLOQR, primero los que encajan con la música de este local. Toca uno para usarlo."
      },
      "help-generic-shoutouts": {
        title: "ShoutOuts genéricos",
        body: "Ideas listas para momentos comunes como cumpleaños y celebraciones. Toca una para usarla y luego hazla tuya."
      },

      "help-beta-tester": {

        title: "Pruebas beta",

        body: "FLOQR a veces invita a clientes a probar funciones nuevas antes que nadie. La invitación llega a tu bandeja de entrada; ábrela con la sesión iniciada en la misma cuenta y elige Aceptar. Solo las funciones que FLOQR eligió para ti aparecerán en la búsqueda con la etiqueta Beta. Pueden cambiar o desactivarse durante las pruebas. Las invitaciones caducan a los 7 días y solo sirven para la cuenta a la que se enviaron."

      },
      "help-location-search": {
        title: "Búsqueda según tu ubicación",
        body: "FLOQR muestra primero los eventos y clubs más cercanos a ti y después por nombre. Si lo permites, usa la ubicación de tu teléfono o navegador (GPS); si no, estima tu ciudad a partir de tu conexión a internet (IP). Escribe un lugar, como Clubs en Mónaco, para buscar en otro sitio: allí los resultados también empiezan por los más cercanos a ti. Puedes desactivar el acceso a la ubicación en los ajustes del navegador o del teléfono."
      },
      "help-welcome": {
        title: "Bienvenido a FLOQR",
        body: "Busca y reserva eventos de entretenimiento y vida nocturna en todo el mundo, envía un ShoutOut en vivo a una de nuestras pantallas ShoutOut o Mingl con nuevas personas, amigos y familia. Inicia sesión con Google, Microsoft, Facebook o una contraseña de un solo uso (OTP). Un OTP es un código corto que FLOQR envía a tu correo, por WhatsApp (todo el mundo) o por SMS (solo números de EE. UU. y Canadá). Escribe el código en pocos minutos para iniciar sesión, sin contraseña que recordar. Cada código funciona una sola vez. Nunca compartas tu código."
      },
      "help-ad-campaigns": {
        title: "Campañas publicitarias",
        body: "Publica una imagen de flyer o un video de hasta 30 segundos para tu negocio, club, grupo de promoción o servicio (DJ, fotógrafo, promotor, FloqQ). Elige Inline ($45 / 7 días — pantalla de carga de la búsqueda y pantallas de funciones) o Mingl Gist ($25 / 7 días — historias), la duración y quién debe verlo (edad, género, ciudades, intereses). Paga con tarjeta o suscripción mensual; las cuentas aprobadas pueden pagar con factura. FLOQR revisa cada anuncio pagado antes de publicarlo y los anuncios rechazados se reembolsan. Mis anuncios muestra el estado, las vistas, los clics y tu factura."
      },
      "help-completed-shoutouts": {
        title: "ShoutOuts completados",
        body: "Los ShoutOuts completados son ShoutOuts aprobados por el club (y terminados) para tus registros. Archivar mueve un ShoutOut de Completados a Archive con texto y media comprimidos (si los había). Reutilizar abre Search con el mismo texto. Guardar como plantilla solo aparece cuando el fondo de la plantilla es modificable (IsModifiable). Los recibos pagados permanecen en FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "ShoutOuts archivados",
        body: "Archive guarda una copia comprimida del texto y media de tu ShoutOut completado (si el original tenía media) en almacenamiento Firebase económico, y lo quita de Completados. Abre Archive cuando quieras. Reutilizar también funciona desde Archive."
      },
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
      "help-do-not-sell": {
        title: "No vender ni compartir",
        body: "Activalo para optar por no personalizacion con etiquetas de perfil. Creatividades house / para todos pueden seguir. Global Privacy Control (GPC) lo activa automaticamente. Consulta la Politica de privacidad (CCPA / CPRA)."
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
        body: "Traditional Black and White Classic gratis. Las plantillas exclusivas de este local, como Football Intro o Tengo muchos dólares, aparecen en «Exclusivo de» con el nombre del local. Usa FloqAi abajo para plantillas Sports, Jersey, VIP, Humor, Cars, Video, Pictures y Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi búsqueda de plantillas",
        body: "Toque la marca FloqAi en movimiento (o espere a que aparezcan los globos de diálogo) y luego pregunte por Deportes, Jersey, NBA, NFL, Autos, Humor, VIP, Video, Imágenes o Jugadores de béisbol."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "Una intro de estadio de 20 segundos para cuatro jugadores por $30, disponible en Zebbies Garden DC, Heist Washington DC y Aurelia. Escribe «Football Intro» en Buscar, elige uno de esos locales y sube cuatro fotos que tengas permiso para usar. Solo en pantallas de 96×48."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Exclusivo de Heist Washington DC por $30. Tu mensaje aparece 5 segundos frente a la bóveda; luego la puerta de la caja fuerte explota y billetes de $100 saltan detrás de tu texto durante 10 segundos. Al final la pantalla muestra el logo de HEIST sobre Washington DC y todo vuelve a empezar. Escribe «Tengo muchos dólares» en Buscar y pon solo un nombre o elige un @usuario de Instagram / Mingl (máx. 14). La pantalla muestra el nombre y escribe «Tengo muchos dólares... I just did a heist!» letra por letra. Solo en pantallas de 96×48."
      },
      "help-club-template-repository": {
        title: "Plantillas de tu club",
        body: "Las plantillas creadas solo para tu club aparecen primero, marcadas con «Exclusivo de» y el nombre del local. Las plantillas asignadas son las que los clientes pueden elegir en tu club; cámbialas con Asignar plantilla o Quitar plantilla. La búsqueda encuentra una plantilla aunque falte una tilde o haya una pequeña errata."
      },
      "help-employee-network": {
        title: "Red de empleados y personal",
        body: "Solo se muestran personas vinculadas a este club: personal designado o aprobado aquí, administradores del club y personal afiliado a este club. Para dar un rol a alguien, escribe su nombre, usuario o email en Designar cliente para un rol, toca Seleccionar junto a la persona correcta, elige el rol, luego toca Designar rol al cliente seleccionado y confirma. La persona necesita primero una cuenta de cliente FLOQR. Los camareros, camareras y bottle girls de la lista pueden ser representantes de atención al cliente (CSR)."
      },
      "help-template-tags": {
        title: "Etiquetas de plantillas",
        body: "Añade palabras que los clientes podrían escribir al buscar una plantilla en tu local, como noche de partido o cumpleaños. Los Gestores de plantillas pueden añadir etiquetas. Los Administradores de plantillas y los Club Admins también pueden quitarlas. El Club Admin asigna estos roles en Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Vista previa de una plantilla",
        body: "Toca Vista previa en cualquier tarjeta de plantilla para verla en una pantalla de ejemplo con texto e imágenes inventados. Cambia entre los tamaños de pantalla de este local. Tu propio ShoutOut muestra tus palabras y fotos."
      },
      "help-display-idle-default": {
        title: "Pantalla en espera: Use ShoutOut @ local",
        body: "Cuando no se muestra ningún ShoutOut, Display 1 muestra «Use ShoutOut @» con el nombre de tu local. Cada ShoutOut aprobado se muestra 10 minutos y luego la pantalla vuelve sola a ese mensaje. Restablecer la pantalla predeterminada en Club Admin lo hace al instante."
      },
      "help-mingl-requests": {
        title: "Acerca de Mingl Solicitudes",
        body: "Las solicitudes de amigo o Mingl enviadas y recibidas aparecen aquí. Las solicitudes permanecen en la página principal Mingl; Las conversaciones aceptadas se abren en Mingl Chat."
      },
      "help-club-messaging-logs": {
        title: "Registros de entrega SMS y WhatsApp",
        body: "Club Admin → Marketing → Registros SMS y WhatsApp muestra Twilio SMS y WhatsApp de este local (prueba marketing, alertas). Las mismas filas en Master Admin → Twilio. Dry-run: faltaron secretos o From — no se entregó ni se debitó crédito. Teléfonos enmascarados."
      },
      "help-club-messaging-credit": {
        title: "Crédito SMS y WhatsApp",
        body: "Cada paquete de 10 $ financia 7,00 $ de capacidad Twilio; FloqR retiene 3,00 $ de margen. Paquete SMS → 466 mensajes (≈ 0,015 $ SMS US). Paquete WhatsApp → 233 mensajes (≈ 0,030 $ Twilio + Meta marketing). Con saldo 0, compre otro paquete antes de enviar. Desbloqueo SMS ops (10 $) incluye un paquete SMS. Servicio WhatsApp (10 $) incluye un paquete WhatsApp. Cálculo: 10 $ → 466 SMS o 233 WhatsApp (7,00 $ Twilio / 3,00 $ FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Campañas de marketing",
        body: "Elija plantilla del sector, cargue fondo e imágenes extra, edite textos y guarde o envíe. El envío debita créditos SMS o WhatsApp en Crédito de mensajería."
      },
      "help-club-in-app-marketing": {
        title: "Marketing in-app",
        body: "Publica un flyer o un video de hasta 30 segundos en nombre de tu club. Cuando está pagado y aprobado por FLOQR, aparece en la pantalla de carga de la búsqueda, en Mingl, RydR y en otras pantallas de FLOQR. Publicadores de anuncios del club permite que un miembro del equipo publique anuncios para el club (rol Club Ad Poster). No necesitas créditos SMS."
      },
      "help-public-media-sharing": {
        title: "Medios públicos y uso compartido de datos",
        body: "Elige varias imágenes o videos cortos a la vez y luego ordena su posición en el perfil público. Los perfiles admiten hasta 8 imágenes y 2 videos cortos."
      }
    },
    it: {
      "help-featured-staff": {
        title: "Personale in evidenza",
        body: "Seleziona il personale da mostrare nella pagina pubblica del club. Per ogni persona tocca una delle sue foto FLOQR o scegli «Carica dal computer». Puoi cambiare il ruolo mostrato sotto il nome. Tocca «Save Public Profile» per pubblicare."
      },
      "help-shoutout-recommendations": {
        title: "Consigli ShoutOut",
        body: "Scegli uno stile e un tipo di evento, poi tocca «Improve My ShoutOut» per avere idee adatte al tuo modello e alla dimensione dello schermo. Tocca un'idea per inserirla nel messaggio e modificala se vuoi. «Use Past ShoutOut» recupera uno dei tuoi messaggi precedenti."
      },
      "help-ai-recommendations": {
        title: "Consigli IA",
        body: "Idee scritte per te in base al locale, al tipo di evento, alla tua bozza e al tuo profilo. Ogni idea rispetta già righe e caratteri dello schermo scelto. Toccane una per usarla."
      },
      "help-trending-shoutouts": {
        title: "ShoutOut di tendenza",
        body: "ShoutOut popolari approvati da FLOQR, prima quelli adatti alla musica di questo locale. Toccane uno per usarlo."
      },
      "help-generic-shoutouts": {
        title: "ShoutOut generici",
        body: "Idee pronte per momenti comuni come compleanni e feste. Toccane una per usarla, poi personalizzala."
      },

      "help-beta-tester": {

        title: "Test beta",

        body: "FLOQR a volte invita i clienti a provare in anteprima nuove funzioni. L'invito arriva nella tua Posta in arrivo; aprilo mentre sei connesso allo stesso account e scegli Accetta. Solo le funzioni che FLOQR ha scelto per te compariranno nella ricerca con l'etichetta Beta. Possono cambiare o essere disattivate durante i test. Gli inviti scadono dopo 7 giorni e valgono solo per l'account a cui sono stati inviati."

      },
      "help-location-search": {
        title: "Ricerca in base alla posizione",
        body: "FLOQR mostra prima gli eventi e i club più vicini a te, poi per nome. Se lo consenti, usa la posizione del telefono o del browser (GPS); altrimenti stima la tua città dalla connessione internet (IP). Scrivi un luogo, ad esempio Club a Monaco, per cercare altrove: anche lì i risultati partono dai più vicini a te. Puoi disattivare l'accesso alla posizione nelle impostazioni del browser o del telefono."
      },
      "help-welcome": {
        title: "Benvenuto su FLOQR",
        body: "Cerca e prenota eventi di intrattenimento e vita notturna in tutto il mondo, invia un ShoutOut dal vivo su uno dei nostri display ShoutOut o Mingl con nuove persone, amici e familiari. Accedi con Google, Microsoft, Facebook o una password monouso (OTP). Un OTP è un codice breve che FLOQR invia alla tua email, su WhatsApp (in tutto il mondo) o via SMS (solo numeri di USA e Canada). Inserisci il codice entro pochi minuti per accedere, senza password da ricordare. Ogni codice funziona una sola volta. Non condividere mai il tuo codice."
      },
      "help-ad-campaigns": {
        title: "Campagne pubblicitarie",
        body: "Pubblica un'immagine del flyer o un video fino a 30 secondi per la tua attività, il tuo club, il tuo gruppo promozionale o il tuo servizio (DJ, fotografo, promoter, FloqQ). Scegli Inline ($45 / 7 giorni — schermata di caricamento della ricerca e schermate delle funzioni) o Mingl Gist ($25 / 7 giorni — storie), la durata e chi deve vederlo (età, genere, città, interessi). Paga con carta o abbonamento mensile; gli account approvati possono pagare con fattura. FLOQR controlla ogni annuncio pagato prima della pubblicazione e gli annunci rifiutati vengono rimborsati. I miei annunci mostra stato, visualizzazioni, clic e fattura."
      },
      "help-completed-shoutouts": {
        title: "ShoutOuts completati",
        body: "Gli ShoutOut completati sono ShoutOut approvati dal club (e terminati) per i tuoi record. Archivia sposta uno ShoutOut da Completati ad Archive con testo e media compressi (se presenti). Riusa apre Search con lo stesso testo. Salva come modello appare solo se lo sfondo del modello è modificabile (IsModifiable). Le ricevute pagate restano in FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "ShoutOut archiviati",
        body: "Archive memorizza una copia compressa del testo e dei media dello ShoutOut completato (se presenti) in storage Firebase economico e lo rimuove da Completati. Apri Archive quando vuoi. Riusa funziona anche da Archive."
      },
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
      "help-do-not-sell": {
        title: "Non vendere ne condividere",
        body: "Attivalo per escludere la personalizzazione con tag del profilo. Le creative house / per tutti possono restare. Global Privacy Control (GPC) lo attiva automaticamente. Vedi l Informativa sulla privacy (CCPA / CPRA)."
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
        body: "Traditional Black and White Classic gratuito. I modelli esclusivi di questo locale, come Football Intro o Tengo muchos dólares, sono elencati in «Esclusivo da» con il nome del locale. Usa FloqAi qui sotto per i modelli Sports, Jersey, VIP, Humor, Cars, Video, Pictures e Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi ricerca modello",
        body: "Tocca il simbolo FloqAi in movimento (o attendi i fumetti), quindi chiedi Sport, Maglia, NBA, NFL, Automobili, Umorismo, VIP, Video, Immagini o Ballerini."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "Un’intro da stadio di 20 secondi per quattro giocatori a 30 $, disponibile da Zebbies Garden DC, Heist Washington DC e Aurelia. Scrivi «Football Intro» in Cerca, scegli uno di questi locali e carica quattro foto che hai il permesso di usare. Solo su schermi 96×48."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Esclusiva Heist Washington DC a 30 $. Il tuo messaggio appare per 5 secondi davanti al caveau; poi la porta della cassaforte esplode e banconote da 100 $ volano dietro il tuo testo per 10 secondi. Alla fine lo schermo mostra il logo HEIST sopra Washington DC e tutto ricomincia. Scrivi «Tengo muchos dólares» in Cerca, poi inserisci solo un nome o scegli un @handle Instagram / Mingl (max 14). Lo schermo mostra il nome e scrive «Tengo muchos dólares... I just did a heist!» lettera per lettera. Solo su schermi 96×48."
      },
      "help-club-template-repository": {
        title: "I modelli del tuo club",
        body: "I modelli creati solo per il tuo club compaiono per primi, contrassegnati da «Esclusivo da» e dal nome del locale. I modelli assegnati sono quelli che i clienti possono scegliere nel tuo club; modificali con Assegna modello o Rimuovi modello. La ricerca trova un modello anche senza accento o con un piccolo errore di battitura."
      },
      "help-employee-network": {
        title: "Rete di dipendenti e personale",
        body: "Sono elencate solo le persone collegate a questo club: personale nominato o approvato qui, admin del club e personale affiliato a questo club. Per dare un ruolo a qualcuno, scrivi nome, username o email in Nomina un cliente per un ruolo, tocca Seleziona accanto alla persona giusta, scegli il ruolo, poi tocca Nomina il cliente selezionato per il ruolo e conferma. La persona deve prima avere un account cliente FLOQR. Camerieri, cameriere e bottle girl in elenco possono diventare rappresentanti del servizio clienti (CSR)."
      },
      "help-template-tags": {
        title: "Tag dei modelli",
        body: "Aggiungi parole che i clienti potrebbero scrivere cercando un modello nel tuo locale, come serata partita o compleanno. I Gestori dei modelli possono aggiungere tag. Gli Amministratori dei modelli e i Club Admin possono anche rimuoverli. Il Club Admin assegna questi ruoli in Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Anteprima di un modello",
        body: "Tocca Anteprima su una scheda modello per vederlo su uno schermo di esempio con testo e immagini inventati. Passa da una dimensione all’altra tra gli schermi del locale. Il tuo ShoutOut mostra le tue parole e le tue foto."
      },
      "help-display-idle-default": {
        title: "Schermo di attesa: Use ShoutOut @ locale",
        body: "Quando non c’è nessuno ShoutOut in onda, Display 1 mostra «Use ShoutOut @» con il nome del tuo locale. Ogni ShoutOut approvato resta 10 minuti, poi lo schermo torna da solo a quel messaggio. Il ripristino del display predefinito in Club Admin lo fa subito."
      },
      "help-mingl-requests": {
        title: "Circa Mingl richieste",
        body: "Le richieste di amico o Mingl inviate e ricevute vengono visualizzate qui. Le richieste rimangono nella pagina principale Mingl; le conversazioni accettate si aprono in Mingl Chat."
      },
      "help-club-messaging-logs": {
        title: "Registri di consegna SMS e WhatsApp",
        body: "Club Admin → Marketing → Log SMS e WhatsApp mostra Twilio SMS e WhatsApp per questo locale (test marketing, alert club). Stesse righe in Master Admin → Twilio. Dry-run: secrets o From mancanti — nessuna consegna né addebito crediti. Telefoni mascherati."
      },
      "help-club-messaging-credit": {
        title: "Credito SMS e WhatsApp",
        body: "Ogni pacchetto da $10 finanzia $7,00 di capacità Twilio; FloqR trattiene $3,00 di margine piattaforma. Pacchetto SMS → 466 messaggi (≈ $0,015 SMS US). Pacchetto WhatsApp → 233 messaggi (≈ $0,030 Twilio + Meta marketing). A saldo 0 acquistare un altro pacchetto prima di inviare. Sblocco SMS ops ($10) include un pacchetto SMS. Servizio WhatsApp ($10) include un pacchetto WhatsApp. Calcolo: $10 → 466 SMS o 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Campagne marketing",
        body: "Scegli un modello di settore, carica sfondo e immagini extra, modifica i testi, salva o invia. L’invio addebita crediti SMS o WhatsApp da Credito messaggistica."
      },
      "help-club-in-app-marketing": {
        title: "Marketing in-app",
        body: "Pubblica un flyer o un video fino a 30 secondi a nome del tuo club. Una volta pagato e approvato da FLOQR, appare nella schermata di caricamento della ricerca, in Mingl, RydR e in altre schermate FLOQR. Pubblicatori di annunci del club consente a un membro del team di pubblicare annunci per il club (ruolo Club Ad Poster). Nessun credito SMS necessario."
      },
      "help-public-media-sharing": {
        title: "Public Media and Data Sharing",
        body: "Scegli più immagini o brevi video insieme, poi definisci l'ordine nel profilo pubblico. I profili supportano fino a 8 immagini e 2 brevi video."
      }
    },
    pt: {
      "help-featured-staff": {
        title: "Equipe em destaque",
        body: "Marque a equipe que deve aparecer na página pública do clube. Para cada pessoa, toque em uma das fotos dela no FLOQR ou escolha “Enviar do computador”. Você pode mudar a função exibida abaixo do nome. Toque em “Save Public Profile” para publicar."
      },
      "help-shoutout-recommendations": {
        title: "Recomendações de ShoutOut",
        body: "Escolha um estilo e um tipo de evento e toque em «Improve My ShoutOut» para receber ideias que cabem no seu modelo e no tamanho da tela. Toque em uma ideia para colocá-la na sua mensagem e edite-a se quiser. «Use Past ShoutOut» recupera uma das suas mensagens anteriores."
      },
      "help-ai-recommendations": {
        title: "Recomendações de IA",
        body: "Ideias escritas para você com base no local, no tipo de evento, no seu rascunho e no seu perfil. Cada ideia já cabe nas linhas e caracteres da tela escolhida. Toque em uma para usá-la."
      },
      "help-trending-shoutouts": {
        title: "ShoutOuts em alta",
        body: "ShoutOuts populares aprovados pela FLOQR, primeiro os que combinam com a música deste local. Toque em um para usá-lo."
      },
      "help-generic-shoutouts": {
        title: "ShoutOuts genéricos",
        body: "Ideias prontas para momentos comuns, como aniversários e comemorações. Toque em uma para usá-la e depois deixe-a do seu jeito."
      },

      "help-beta-tester": {

        title: "Testes beta",

        body: "A FLOQR convida por vezes clientes a experimentar novas funcionalidades mais cedo. O convite chega à sua Caixa de entrada; abra-o com sessão iniciada na mesma conta e escolha Aceitar. Só as funcionalidades que a FLOQR escolheu para si passam a aparecer na pesquisa com a etiqueta Beta. Podem mudar ou ser desativadas durante os testes. Os convites expiram após 7 dias e só funcionam para a conta a que foram enviados."

      },
      "help-location-search": {
        title: "Pesquisa por localização",
        body: "O FLOQR mostra primeiro os eventos e clubes mais próximos de si e depois por nome. Se permitir, usa a localização do telemóvel ou do navegador (GPS); caso contrário, estima a sua cidade a partir da ligação à internet (IP). Escreva um local, como Clubes no Mónaco, para pesquisar noutro sítio — aí os resultados também começam pelos mais próximos de si. Pode desativar o acesso à localização nas definições do navegador ou do telemóvel."
      },
      "help-welcome": {
        title: "Bem-vindo ao FLOQR",
        body: "Pesquise e reserve eventos de entretenimento e vida noturna no mundo todo, envie um ShoutOut ao vivo para uma das nossas telas ShoutOut ou Mingl com novas pessoas, amigos e família. Entre com Google, Microsoft, Facebook ou uma senha de uso único (OTP). Um OTP é um código curto que o FLOQR envia para o seu e-mail, pelo WhatsApp (mundial) ou por SMS (apenas números dos EUA e do Canadá). Digite o código em poucos minutos para entrar — sem senha para lembrar. Cada código funciona só uma vez. Nunca compartilhe o seu código."
      },
      "help-ad-campaigns": {
        title: "Campanhas publicitárias",
        body: "Publique uma imagem de flyer ou um vídeo até 30 segundos para o seu negócio, clube, grupo de promoção ou serviço (DJ, fotógrafo, promotor, FloqQ). Escolha Inline ($45 / 7 dias — ecrã de carregamento da pesquisa e ecrãs de funcionalidades) ou Mingl Gist ($25 / 7 dias — histórias), a duração e quem o deve ver (idade, género, cidades, interesses). Pague com cartão ou subscrição mensal; contas aprovadas podem pagar com fatura. A FLOQR revê cada anúncio pago antes de ir para o ar e os anúncios rejeitados são reembolsados. Os meus anúncios mostra o estado, as visualizações, os cliques e a sua fatura."
      },
      "help-completed-shoutouts": {
        title: "ShoutOuts concluídos",
        body: "ShoutOuts concluídos são ShoutOuts aprovados pelo clube (e finalizados) para seus registros. Arquivar move um ShoutOut de Concluídos para Archive com texto e mídia comprimidos (se houver). Reutilizar abre Search com o mesmo texto. Salvar como modelo aparece só quando o fundo do modelo é modificável (IsModifiable). Recibos pagos ficam no FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "ShoutOuts arquivados",
        body: "Archive guarda uma cópia comprimida do texto e da mídia do seu ShoutOut concluído (se o original tinha mídia) em armazenamento Firebase econômico e remove de Concluídos. Abra Archive a qualquer momento. Reutilizar também funciona a partir de Archive."
      },
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
      "help-do-not-sell": {
        title: "Nao vender nem partilhar",
        body: "Ative para optar por nao personalizacao com tags de perfil. Creatives house / para todos podem permanecer. Global Privacy Control (GPC) ativa isto automaticamente. Veja a Politica de Privacidade (CCPA / CPRA)."
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
        body: "Traditional Black and White Classic grátis. Os modelos exclusivos deste local, como Football Intro ou Tengo muchos dólares, aparecem em «Exclusivo em» com o nome do local. Use o FloqAi abaixo para modelos Sports, Jersey, VIP, Humor, Cars, Video, Pictures e Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi pesquisa de modelos",
        body: "Toque na marca móvel FloqAi (ou espere pelos balões de fala) e peça Esportes, Jersey, NBA, NFL, Carros, Humor, VIP, Vídeo, Fotos ou Ballers."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "Uma intro de estádio de 20 segundos para quatro jogadores por US$ 30, disponível no Zebbies Garden DC, Heist Washington DC e Aurelia. Digite «Football Intro» na Busca, escolha um desses locais e envie quatro fotos que você tem permissão para usar. Somente em telas 96×48."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Exclusivo do Heist Washington DC por US$ 30. Sua mensagem aparece por 5 segundos diante da caixa-forte; depois a porta do cofre explode e notas de US$ 100 voam atrás do seu texto por 10 segundos. No final, o painel mostra o logo HEIST sobre Washington DC e tudo recomeça. Digite «Tengo muchos dólares» na Busca e informe só um nome ou escolha um @usuário do Instagram / Mingl (máx. 14). O painel mostra o nome e digita «Tengo muchos dólares... I just did a heist!» letra por letra. Somente em telas 96×48."
      },
      "help-club-template-repository": {
        title: "Modelos do seu clube",
        body: "Os modelos feitos só para o seu clube aparecem primeiro, marcados com «Exclusivo em» e o nome do local. Os modelos atribuídos são os que os clientes podem escolher no seu clube; altere isso com Atribuir modelo ou Remover modelo. A busca encontra um modelo mesmo sem acento ou com um pequeno erro de digitação."
      },
      "help-employee-network": {
        title: "Rede de funcionários e equipe",
        body: "Só aparecem pessoas vinculadas a este clube: equipe designada ou aprovada aqui, admins do clube e equipe afiliada a este clube. Para dar uma função a alguém, digite o nome, usuário ou e-mail em Designar cliente para uma função, toque em Selecionar ao lado da pessoa certa, escolha a função, depois toque em Designar função ao cliente selecionado e confirme. A pessoa precisa primeiro de uma conta de cliente FLOQR. Garçons, garçonetes e bottle girls da lista podem ser representantes de atendimento ao cliente (CSR)."
      },
      "help-template-tags": {
        title: "Tags de modelos",
        body: "Adicione palavras que os clientes possam digitar ao procurar um modelo no seu local, como noite de jogo ou aniversário. Gestores de modelos podem adicionar tags. Administradores de modelos e Club Admins também podem removê-las. O Club Admin atribui esses papéis em Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Pré-visualizar um modelo",
        body: "Toque em Pré-visualizar em qualquer cartão de modelo para vê-lo em uma tela de exemplo com texto e imagens inventados. Alterne entre os tamanhos de tela deste local. Seu próprio ShoutOut mostra suas palavras e fotos."
      },
      "help-display-idle-default": {
        title: "Tela de espera: Use ShoutOut @ local",
        body: "Quando nenhum ShoutOut está no ar, o Display 1 mostra «Use ShoutOut @» com o nome do seu local. Cada ShoutOut aprovado fica 10 minutos e depois a tela volta sozinha para essa mensagem. Redefinir a tela padrão no Club Admin faz isso na hora."
      },
      "help-mingl-requests": {
        title: "Sobre Mingl solicitações",
        body: "Solicitações de amizade ou Mingl enviadas e recebidas aparecem aqui. As solicitações ficam na página Mingl principal; conversas aceitas abertas em Mingl Chat."
      },
      "help-club-messaging-logs": {
        title: "Registos de entrega SMS e WhatsApp",
        body: "Club Admin → Marketing → Registos SMS e WhatsApp mostra Twilio SMS e WhatsApp deste local (teste marketing, alertas). As mesmas linhas em Master Admin → Twilio. Dry-run: faltaram secrets ou From — nada entregue nem crédito debitado. Telefones mascarados."
      },
      "help-club-messaging-credit": {
        title: "Crédito SMS e WhatsApp",
        body: "Cada pacote de $10 financia $7,00 de capacidade Twilio; a FloqR retém $3,00 de margem. Pacote SMS → 466 mensagens (≈ $0,015 SMS EUA). Pacote WhatsApp → 233 mensagens (≈ $0,030 Twilio + Meta marketing). Com saldo 0, compre outro pacote antes de enviar. Desbloqueio SMS ops ($10) inclui um pacote SMS. Serviço WhatsApp ($10) inclui um pacote WhatsApp. Conta: $10 → 466 SMS ou 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Campanhas de marketing",
        body: "Escolha um modelo do setor, carregue fundo e imagens extra, edite textos, guarde ou envie. O envio debita créditos SMS ou WhatsApp em Crédito de mensagens."
      },
      "help-club-in-app-marketing": {
        title: "Marketing in-app",
        body: "Publique um flyer ou um vídeo até 30 segundos em nome do seu clube. Depois de pago e aprovado pela FLOQR, aparece no ecrã de carregamento da pesquisa, no Mingl, no RydR e noutros ecrãs FLOQR. Publicadores de anúncios do clube permite que um membro da equipa publique anúncios para o clube (função Club Ad Poster). Não são necessários créditos SMS."
      },
      "help-public-media-sharing": {
        title: "Mídia pública e compartilhamento de dados",
        body: "Escolha várias imagens ou vídeos curtos de uma vez e organize a ordem no perfil público. Os perfis suportam até 8 imagens e 2 vídeos curtos."
      }
    },
    el: {
      "help-featured-staff": {
        title: "Προβεβλημένο προσωπικό",
        body: "Επιλέξτε το προσωπικό για τη δημόσια σελίδα του κλαμπ. Για κάθε άτομο, πατήστε μία από τις φωτογραφίες του στο FLOQR ή επιλέξτε «Μεταφόρτωση από υπολογιστή». Μπορείτε να αλλάξετε τον ρόλο κάτω από το όνομα. Πατήστε «Save Public Profile» για δημοσίευση."
      },
      "help-shoutout-recommendations": {
        title: "Προτάσεις ShoutOut",
        body: "Επιλέξτε στυλ και τύπο εκδήλωσης και πατήστε «Improve My ShoutOut» για ιδέες που ταιριάζουν στο πρότυπο και στο μέγεθος της οθόνης σας. Πατήστε μια ιδέα για να μπει στο μήνυμά σας και επεξεργαστείτε την αν θέλετε. Το «Use Past ShoutOut» φέρνει πίσω ένα από τα παλαιότερα μηνύματά σας."
      },
      "help-ai-recommendations": {
        title: "Προτάσεις AI",
        body: "Ιδέες γραμμένες για εσάς με βάση τον χώρο, τον τύπο εκδήλωσης, το πρόχειρό σας και το προφίλ σας. Κάθε ιδέα χωράει ήδη στις γραμμές και τους χαρακτήρες της οθόνης που επιλέξατε. Πατήστε μία για να τη χρησιμοποιήσετε."
      },
      "help-trending-shoutouts": {
        title: "Δημοφιλή ShoutOuts",
        body: "Δημοφιλή ShoutOuts εγκεκριμένα από το FLOQR, πρώτα όσα ταιριάζουν με τη μουσική του χώρου. Πατήστε ένα για να το χρησιμοποιήσετε."
      },
      "help-generic-shoutouts": {
        title: "Γενικά ShoutOuts",
        body: "Έτοιμες ιδέες για συνηθισμένες στιγμές, όπως γενέθλια και γιορτές. Πατήστε μία για να τη χρησιμοποιήσετε και μετά κάντε τη δική σας."
      },

      "help-beta-tester": {

        title: "Δοκιμές beta",

        body: "Το FLOQR προσκαλεί κάποιες φορές πελάτες να δοκιμάσουν νωρίτερα νέες λειτουργίες. Η πρόσκληση έρχεται στα Εισερχόμενα· ανοίξτε την ενώ είστε συνδεδεμένοι στον ίδιο λογαριασμό και επιλέξτε Αποδοχή. Μόνο οι λειτουργίες που επέλεξε το FLOQR για εσάς εμφανίζονται τότε στην αναζήτηση με την ετικέτα Beta. Μπορεί να αλλάξουν ή να απενεργοποιηθούν κατά τις δοκιμές. Οι προσκλήσεις λήγουν μετά από 7 ημέρες και ισχύουν μόνο για τον λογαριασμό στον οποίο στάλθηκαν."

      },
      "help-location-search": {
        title: "Αναζήτηση με βάση την τοποθεσία",
        body: "Το FLOQR δείχνει πρώτα τις εκδηλώσεις και τα κλαμπ που είναι πιο κοντά σας και μετά κατά όνομα. Αν το επιτρέψετε, χρησιμοποιεί την τοποθεσία του τηλεφώνου ή του browser (GPS)· αλλιώς εκτιμά την πόλη σας από τη σύνδεσή σας στο διαδίκτυο (IP). Πληκτρολογήστε ένα μέρος, π.χ. Κλαμπ στο Μονακό, για να ψάξετε αλλού — και εκεί τα αποτελέσματα ξεκινούν από τα πιο κοντινά σας. Μπορείτε να απενεργοποιήσετε την πρόσβαση στην τοποθεσία από τις ρυθμίσεις του browser ή του τηλεφώνου."
      },
      "help-welcome": {
        title: "Καλώς ήρθατε στο FLOQR",
        body: "Αναζητήστε και κλείστε εκδηλώσεις ψυχαγωγίας και νυχτερινής ζωής σε όλο τον κόσμο, στείλτε ένα live ShoutOut σε μία από τις οθόνες ShoutOut μας ή Mingl με νέα άτομα, φίλους και οικογένεια. Συνδεθείτε με Google, Microsoft, Facebook ή με κωδικό μίας χρήσης (OTP). Το OTP είναι ένας σύντομος κωδικός που στέλνει το FLOQR στο email σας, στο WhatsApp (παγκοσμίως) ή με SMS (μόνο αριθμοί ΗΠΑ και Καναδά). Πληκτρολογήστε τον κωδικό μέσα σε λίγα λεπτά για να συνδεθείτε — χωρίς κωδικό πρόσβασης να θυμάστε. Κάθε κωδικός λειτουργεί μόνο μία φορά. Μην κοινοποιείτε ποτέ τον κωδικό σας."
      },
      "help-ad-campaigns": {
        title: "Διαφημιστικές καμπάνιες",
        body: "Δημοσιεύστε εικόνα flyer ή βίντεο έως 30 δευτερόλεπτα για την επιχείρηση, το club, την ομάδα προώθησης ή την υπηρεσία σας (DJ, φωτογράφος, promoter, FloqQ). Επιλέξτε Inline ($45 / 7 ημέρες — οθόνη φόρτωσης αναζήτησης και οθόνες λειτουργιών) ή Mingl Gist ($25 / 7 ημέρες — ιστορίες), τη διάρκεια και ποιος θα τη βλέπει (ηλικία, φύλο, πόλεις, ενδιαφέροντα). Πληρώστε με κάρτα ή μηνιαία συνδρομή· οι εγκεκριμένοι λογαριασμοί μπορούν να πληρώνουν με τιμολόγιο. Το FLOQR ελέγχει κάθε πληρωμένη διαφήμιση πριν προβληθεί και οι απορριφθείσες επιστρέφονται. Στο Οι διαφημίσεις μου βλέπετε κατάσταση, προβολές, κλικ και τιμολόγιο."
      },
      "help-completed-shoutouts": {
        title: "Ολοκληρωμένα ShoutOuts",
        body: "Τα ολοκληρωμένα ShoutOuts είναι εγκεκριμένα από το club (και τελειωμένα) για τα αρχεία σας. Η αρχειοθέτηση μεταφέρει ένα ShoutOut από Ολοκληρωμένα στο Archive με συμπιεσμένο κείμενο και media (αν υπήρχε). Η επαναχρησιμοποίηση ανοίγει Search με το ίδιο κείμενο. Αποθήκευση ως πρότυπο εμφανίζεται μόνο όταν το φόντο είναι τροποποιήσιμο (IsModifiable). Οι πληρωμένες αποδείξεις μένουν στο FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "Αρχειοθετημένα ShoutOuts",
        body: "Το Archive αποθηκεύει συμπιεσμένο αντίγραφο κειμένου και media του ολοκληρωμένου ShoutOut (αν υπήρχε media) σε οικονομικό Firebase storage και το αφαιρεί από Ολοκληρωμένα. Ανοίξτε Archive οποτεδήποτε. Η επαναχρησιμοποίηση δουλεύει και από Archive."
      },
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
      "help-do-not-sell": {
        title: "Μην πουλατε η κοινοποιειτε",
        body: "Ενεργοποιηστε το για να εξαιρεθειτε απο προσωποποιημενες διαφημισεις με tags προφιλ. House / ολοι μπορουν να εμφανιζονται. Το Global Privacy Control (GPC) το θετει αυτοματα. Δειτε την Πολιτικη Απορρητου (CCPA / CPRA)."
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
        body: "Δωρεάν Traditional Black and White Classic. Τα πρότυπα μόνο για αυτόν τον χώρο, όπως Football Intro ή Tengo muchos dólares, εμφανίζονται στο «Αποκλειστικά στο» με το όνομα του χώρου. Χρησιμοποιήστε το FloqAi παρακάτω για πρότυπα Sports, Jersey, VIP, Humor, Cars, Video, Pictures και Ballers."
      },
      "help-floqai-template-search": {
        title: "FloqAi αναζήτηση προτύπου",
        body: "Αγγίξτε την κινούμενη ένδειξη FloqAi (ή περιμένετε τα συννεφάκια ομιλίας του), μετά ζητήστε Sports, Jersey, NBA, NFL, Cars, Humor, VIP, Video, Pictures ή Ballers."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "Εισαγωγή γηπέδου 20 δευτερολέπτων για τέσσερις παίκτες με $30, διαθέσιμη στα Zebbies Garden DC, Heist Washington DC και Aurelia. Πληκτρολογήστε «Football Intro» στην Αναζήτηση, επιλέξτε έναν από αυτούς τους χώρους και ανεβάστε τέσσερις φωτογραφίες για τις οποίες έχετε άδεια. Μόνο σε οθόνες 96×48."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Αποκλειστικό του Heist Washington DC με $30. Το μήνυμά σας παίζει για 5 δευτερόλεπτα μπροστά στο θησαυροφυλάκιο· μετά η πόρτα του χρηματοκιβωτίου εκρήγνυται και χαρτονομίσματα των $100 πετούν πίσω από το κείμενό σας για 10 δευτερόλεπτα. Στο τέλος η οθόνη δείχνει το λογότυπο HEIST πάνω από το Washington DC και όλα ξεκινούν ξανά. Πληκτρολογήστε «Tengo muchos dólares» στην Αναζήτηση και βάλτε μόνο ένα όνομα ή διαλέξτε ένα @handle Instagram / Mingl (έως 14). Η οθόνη δείχνει το όνομα και πληκτρολογεί γράμμα-γράμμα «Tengo muchos dólares... I just did a heist!». Μόνο σε οθόνες 96×48."
      },
      "help-club-template-repository": {
        title: "Τα πρότυπα του club σας",
        body: "Τα πρότυπα που έγιναν μόνο για το club σας εμφανίζονται πρώτα, με την ένδειξη «Αποκλειστικά στο» και το όνομα του χώρου. Τα ανατεθειμένα πρότυπα είναι αυτά που μπορούν να επιλέξουν οι πελάτες στο club σας· αλλάξτε τα με Ανάθεση ή Αφαίρεση προτύπου. Η αναζήτηση βρίσκει ένα πρότυπο ακόμη και χωρίς τόνο ή με μικρό ορθογραφικό λάθος."
      },
      "help-employee-network": {
        title: "Δίκτυο υπαλλήλων και προσωπικού",
        body: "Εμφανίζονται μόνο άτομα συνδεδεμένα με αυτό το club: προσωπικό που ορίστηκε ή εγκρίθηκε εδώ, διαχειριστές του club και προσωπικό συνδεδεμένο με αυτό το club. Για να δώσετε ρόλο σε κάποιον, πληκτρολογήστε όνομα, όνομα χρήστη ή email στο Ορισμός πελάτη σε ρόλο, πατήστε Επιλογή δίπλα στο σωστό άτομο, διαλέξτε τον ρόλο, μετά πατήστε Ορισμός ρόλου στον επιλεγμένο πελάτη και επιβεβαιώστε. Το άτομο χρειάζεται πρώτα λογαριασμό πελάτη FLOQR. Σερβιτόροι, σερβιτόρες και bottle girls της λίστας μπορούν να γίνουν εκπρόσωποι εξυπηρέτησης πελατών (CSR)."
      },
      "help-template-tags": {
        title: "Ετικέτες προτύπων",
        body: "Προσθέστε λέξεις που μπορεί να πληκτρολογήσουν οι πελάτες όταν ψάχνουν πρότυπο στον χώρο σας, όπως βραδιά αγώνα ή γενέθλια. Οι Υπεύθυνοι προτύπων μπορούν να προσθέτουν ετικέτες. Οι Διαχειριστές προτύπων και οι Club Admin μπορούν επίσης να τις αφαιρούν. Ο Club Admin αναθέτει αυτούς τους ρόλους στο Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Προεπισκόπηση προτύπου",
        body: "Πατήστε Προεπισκόπηση σε μια κάρτα προτύπου για να το δείτε σε δείγμα οθόνης με επινοημένο κείμενο και εικόνες. Αλλάξτε ανάμεσα στα μεγέθη οθόνης του χώρου. Το δικό σας ShoutOut δείχνει τα δικά σας λόγια και φωτογραφίες."
      },
      "help-display-idle-default": {
        title: "Οθόνη αναμονής: Use ShoutOut @ χώρος",
        body: "Όταν δεν παίζει κανένα ShoutOut, το Display 1 δείχνει «Use ShoutOut @» με το όνομα του χώρου σας. Κάθε εγκεκριμένο ShoutOut παίζει 10 λεπτά και μετά η οθόνη επιστρέφει μόνη της σε αυτό το μήνυμα. Η επαναφορά της προεπιλεγμένης οθόνης στο Club Admin το κάνει αμέσως."
      },
      "help-mingl-requests": {
        title: "Περίπου Mingl Αιτήματα",
        body: "Απεσταλμένα και ληφθέντα Αιτήματα φίλου ή Mingl εμφανίζονται εδώ. Τα αιτήματα παραμένουν στην κύρια σελίδα Mingl. οι αποδεκτές συνομιλίες ανοίγουν στο Mingl Chat."
      },
      "help-club-messaging-logs": {
        title: "Αρχεία παράδοσης SMS και WhatsApp",
        body: "Club Admin → Marketing → Αρχεία SMS & WhatsApp εμφανίζει Twilio SMS και WhatsApp για τον χώρο (δοκιμή marketing, ειδοποιήσεις club). Ίδιες γραμμές στο Master Admin → Twilio. Dry-run: έλειπαν secrets ή From — καμία παράδοση/χρέωση. Τηλέφωνα masked."
      },
      "help-club-messaging-credit": {
        title: "Πίστωση SMS & WhatsApp",
        body: "Κάθε πακέτο $10 χρηματοδοτεί $7,00 χωρητικότητας Twilio· η FloqR κρατά $3,00 πλατφόρμας. Πακέτο SMS → 466 μηνύματα (≈ $0,015 SMS ΗΠΑ). Πακέτο WhatsApp → 233 μηνύματα (≈ $0,030 Twilio + Meta marketing). Σε μηδενικό υπόλοιπο αγοράστε νέο πακέτο πριν την αποστολή. Ops SMS unlock ($10) περιλαμβάνει πακέτο SMS. Υπηρεσία WhatsApp ($10) περιλαμβάνει πακέτο WhatsApp. Υπολογισμός: $10 → 466 SMS ή 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Καμπάνιες marketing",
        body: "Επιλέξτε πρότυπο κλάδου, φορτώστε φόντο και επιπλέον εικόνες, επεξεργαστείτε κείμενο, αποθηκεύστε ή στείλτε. Η αποστολή χρεώνει πίστωση SMS ή WhatsApp από Πίστωση μηνυμάτων."
      },
      "help-club-in-app-marketing": {
        title: "Marketing in-app",
        body: "Δημοσιεύστε ένα flyer ή ένα βίντεο έως 30 δευτερόλεπτα εκ μέρους του club σας. Μόλις πληρωθεί και εγκριθεί από το FLOQR, εμφανίζεται στην οθόνη φόρτωσης της αναζήτησης, στο Mingl, στο RydR και σε άλλες οθόνες του FLOQR. Με τους Δημοσιευτές διαφημίσεων του club επιτρέπετε σε μέλος της ομάδας να δημοσιεύει για το club (ρόλος Club Ad Poster). Δεν χρειάζονται μονάδες SMS."
      },
      "help-public-media-sharing": {
        title: "Δημόσια Μέσα και Κοινοποίηση Δεδομένων",
        body: "Επιλέξτε πολλές εικόνες ή σύντομα βίντεο μαζί και στη συνέχεια ρυθμίστε τη σειρά τους στο δημόσιο προφίλ. Τα προφίλ υποστηρίζουν έως 8 εικόνες και 2 σύντομα βίντεο."
      }
    },
    pl: {
      "help-featured-staff": {
        title: "Wyróżniony personel",
        body: "Zaznacz pracowników, którzy mają być na publicznej stronie klubu. Dla każdej osoby dotknij jednego z jej zdjęć w FLOQR lub wybierz „Prześlij z komputera”. Możesz zmienić rolę pod imieniem. Naciśnij „Save Public Profile”, aby opublikować."
      },
      "help-shoutout-recommendations": {
        title: "Rekomendacje ShoutOut",
        body: "Wybierz styl i rodzaj wydarzenia, a potem dotknij „Improve My ShoutOut”, aby dostać pomysły dopasowane do szablonu i rozmiaru ekranu. Dotknij pomysłu, aby wstawić go do wiadomości, i w razie potrzeby go zmień. „Use Past ShoutOut” przywraca jedną z Twoich wcześniejszych wiadomości."
      },
      "help-ai-recommendations": {
        title: "Rekomendacje AI",
        body: "Pomysły napisane dla Ciebie na podstawie lokalu, rodzaju wydarzenia, Twojego szkicu i profilu. Każdy pomysł mieści się już w liczbie wierszy i znaków wybranego ekranu. Dotknij jednego, aby go użyć."
      },
      "help-trending-shoutouts": {
        title: "Popularne ShoutOuts",
        body: "Popularne ShoutOuts zatwierdzone przez FLOQR, najpierw te pasujące do muzyki w tym lokalu. Dotknij jednego, aby go użyć."
      },
      "help-generic-shoutouts": {
        title: "Ogólne ShoutOuts",
        body: "Gotowe pomysły na typowe okazje, takie jak urodziny i uroczystości. Dotknij jednego, aby go użyć, a potem dopasuj go do siebie."
      },

      "help-beta-tester": {

        title: "Testy beta",

        body: "FLOQR czasem zaprasza gości do wcześniejszego wypróbowania nowych funkcji. Zaproszenie trafia do skrzynki odbiorczej; otwórz je, będąc zalogowanym na to samo konto, i wybierz Akceptuj. W wyszukiwaniu z etykietą Beta pojawią się tylko funkcje, które FLOQR dla Ciebie wybrał. Mogą się zmieniać lub zostać wyłączone w trakcie testów. Zaproszenia wygasają po 7 dniach i działają tylko dla konta, na które je wysłano."

      },
      "help-location-search": {
        title: "Wyszukiwanie według lokalizacji",
        body: "FLOQR najpierw pokazuje wydarzenia i kluby najbliżej Ciebie, a potem według nazwy. Jeśli na to pozwolisz, używa lokalizacji telefonu lub przeglądarki (GPS); w przeciwnym razie szacuje Twoje miasto na podstawie połączenia internetowego (IP). Wpisz miejsce, np. Kluby w Monako, aby szukać gdzie indziej — tam również wyniki zaczynają się od najbliższych Tobie. Dostęp do lokalizacji możesz wyłączyć w ustawieniach przeglądarki lub telefonu."
      },
      "help-welcome": {
        title: "Witamy w FLOQR",
        body: "Wyszukuj i rezerwuj wydarzenia rozrywkowe i nocne na całym świecie, wyślij ShoutOut na żywo na jeden z naszych ekranów ShoutOut lub Mingl z nowymi ludźmi, przyjaciółmi i rodziną. Zaloguj się przez Google, Microsoft, Facebook lub hasłem jednorazowym (OTP). OTP to krótki kod, który FLOQR wysyła na Twój e-mail, przez WhatsApp (cały świat) lub SMS-em (tylko numery z USA i Kanady). Wpisz kod w ciągu kilku minut, aby się zalogować — bez hasła do zapamiętania. Każdy kod działa tylko raz. Nigdy nikomu nie udostępniaj swojego kodu."
      },
      "help-ad-campaigns": {
        title: "Kampanie reklamowe",
        body: "Opublikuj obraz ulotki lub wideo do 30 sekund dla swojej firmy, klubu, grupy promocyjnej lub usługi (DJ, fotograf, promotor, FloqQ). Wybierz Inline ($45 / 7 dni — ekran ładowania wyszukiwania i ekrany funkcji) lub Mingl Gist ($25 / 7 dni — relacje), czas emisji i odbiorców (wiek, płeć, miasta, zainteresowania). Zapłać kartą lub subskrypcją miesięczną; zatwierdzone konta mogą płacić na fakturę. FLOQR sprawdza każdą opłaconą reklamę przed emisją, a odrzucone są zwracane. Moje reklamy pokazuje status, wyświetlenia, kliknięcia i fakturę."
      },
      "help-completed-shoutouts": {
        title: "Zakończone ShoutOuts",
        body: "Zakończone ShoutOuts to zatwierdzone przez klub (i zakończone) ShoutOuts do Twojej dokumentacji. Archiwizacja przenosi ShoutOut z Zakończonych do Archive ze skompresowanym tekstem i mediami (jeśli były). Ponów otwiera Search z tym samym tekstem. Zapisz jako szablon pojawia się tylko, gdy tło szablonu jest modyfikowalne (IsModifiable). Opłacone paragony zostają w FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "Zarchiwizowane ShoutOuts",
        body: "Archive przechowuje skompresowaną kopię tekstu i mediów zakończonego ShoutOut (jeśli media były) w niedrogim Firebase Storage i usuwa je z Zakończonych. Otwórz Archive w dowolnym momencie. Ponów działa też z Archive."
      },
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
      "help-do-not-sell": {
        title: "Nie sprzedawaj ani nie udostepniaj",
        body: "Wlacz, aby zrezygnowac z personalizacji po tagach profilu. Creatives house / dla wszystkich moga zostac. Global Privacy Control (GPC) ustawia to automatycznie. Zobacz Polityke prywatnosci (CCPA / CPRA)."
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
        body: "Darmowy Traditional Black and White Classic. Szablony dostępne tylko w tym lokalu, np. Football Intro lub Tengo muchos dólares, są w sekcji „Na wyłączność w” z nazwą lokalu. Poniżej użyj FloqAi, aby znaleźć szablony Sports, Jersey, VIP, Humor, Cars, Video, Pictures i Ballers."
      },
      "help-floqai-template-search": {
        title: "Wyszukiwanie szablonów FloqAi",
        body: "Stuknij w poruszający się znak FloqAi (lub poczekaj na jego dymki mowy), a następnie poproś o Sport, Koszulka, NBA, NFL, Samochody, Humor, VIP, Wideo, Zdjęcia lub Ballers."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "20-sekundowe stadionowe intro dla czterech graczy za 30 $, dostępne w Zebbies Garden DC, Heist Washington DC i Aurelia. Wpisz „Football Intro” w wyszukiwarce, wybierz jeden z tych lokali i prześlij cztery zdjęcia, na które masz zgodę. Tylko na ekranach 96×48."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "Wyłącznie w Heist Washington DC za 30 $. Twoja wiadomość wyświetla się przez 5 sekund przed skarbcem; potem drzwi sejfu wybuchają, a banknoty 100 $ fruwają za Twoim tekstem przez 10 sekund. Na koniec ekran pokazuje logo HEIST nad napisem Washington DC i wszystko zaczyna się od nowa. Wpisz „Tengo muchos dólares” w wyszukiwarce i podaj tylko imię albo wybierz @nick z Instagrama / Mingl (maks. 14). Ekran pokaże imię i litera po literze wypisze „Tengo muchos dólares... I just did a heist!”. Tylko na ekranach 96×48."
      },
      "help-club-template-repository": {
        title: "Szablony Twojego klubu",
        body: "Szablony stworzone tylko dla Twojego klubu są na początku listy, oznaczone „Na wyłączność w” z nazwą lokalu. Przypisane szablony to te, które goście mogą wybrać w Twoim klubie; zmienisz to przyciskami Przypisz szablon lub Usuń szablon. Wyszukiwarka znajdzie szablon nawet bez polskich znaków lub z drobną literówką."
      },
      "help-employee-network": {
        title: "Sieć pracowników i personelu",
        body: "Widoczne są tylko osoby powiązane z tym klubem: personel wyznaczony lub zatwierdzony tutaj, administratorzy klubu i personel powiązany z tym klubem. Aby nadać komuś rolę, wpisz imię, nazwę użytkownika lub e-mail w polu Wyznacz gościa do roli, stuknij Wybierz obok właściwej osoby, wybierz rolę, potem stuknij Wyznacz wybranego gościa do roli i potwierdź. Ta osoba potrzebuje najpierw konta gościa FLOQR. Kelnerzy, kelnerki i bottle girls z listy mogą zostać przedstawicielami obsługi klienta (CSR)."
      },
      "help-template-tags": {
        title: "Tagi szablonów",
        body: "Dodaj słowa, które goście mogą wpisać, szukając szablonu w Twoim lokalu, np. wieczór meczowy albo urodziny. Menedżerowie szablonów mogą dodawać tagi. Administratorzy szablonów i Club Admin mogą je też usuwać. Club Admin przydziela te role w sekcji Role Activity & Permission."
      },
      "help-template-preview": {
        title: "Podgląd szablonu",
        body: "Stuknij Podgląd na karcie szablonu, aby zobaczyć go na przykładowym ekranie z wymyślonym tekstem i obrazami. Przełączaj rozmiary ekranów dostępne w tym lokalu. Twój ShoutOut pokaże Twoje słowa i zdjęcia."
      },
      "help-display-idle-default": {
        title: "Ekran oczekiwania: Use ShoutOut @ lokal",
        body: "Gdy nie leci żaden ShoutOut, Display 1 pokazuje „Use ShoutOut @” z nazwą Twojego lokalu. Każdy zatwierdzony ShoutOut trwa 10 minut, potem ekran sam wraca do tego komunikatu. Przywrócenie domyślnego ekranu w Club Admin robi to od razu."
      },
      "help-mingl-requests": {
        title: "O żądaniach Mingl",
        body: "Wysłane i odebrane prośby o przyjaźń lub Mingl pojawiają się tutaj. Prośby pozostają na głównej stronie Mingl; zaakceptowane rozmowy otwierają się w Mingl Czat."
      },
      "help-club-messaging-logs": {
        title: "Dzienniki dostawy SMS i WhatsApp",
        body: "Club Admin → Marketing → Dzienniki SMS i WhatsApp pokazuje Twilio SMS i WhatsApp dla lokalu (test marketing, alerty klubu). Te same wiersze w Master Admin → Twilio. Dry-run: brak secrets lub From — brak dostawy i obciążenia. Telefony zamaskowane."
      },
      "help-club-messaging-credit": {
        title: "Kredyt SMS i WhatsApp",
        body: "Każdy pakiet $10 finansuje $7,00 pojemności Twilio; FloqR zatrzymuje $3,00 marży platformy. Pakiet SMS → 466 wiadomości (≈ $0,015 SMS US). Pakiet WhatsApp → 233 wiadomości (≈ $0,030 Twilio + Meta marketing). Przy saldzie 0 kup kolejny pakiet przed wysyłką. Ops SMS unlock ($10) obejmuje pakiet SMS. Usługa WhatsApp ($10) obejmuje pakiet WhatsApp. Rachunek: $10 → 466 SMS lub 233 WhatsApp ($7,00 Twilio / $3,00 FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "Kampanie marketingowe",
        body: "Wybierz szablon branżowy, dodaj tło i dodatkowe obrazy, edytuj treść, zapisz lub wyślij. Wysyłka obciąża kredyt SMS lub WhatsApp w Kredyt wiadomości."
      },
      "help-club-in-app-marketing": {
        title: "Marketing in-app",
        body: "Opublikuj ulotkę lub wideo do 30 sekund w imieniu klubu. Po opłaceniu i zatwierdzeniu przez FLOQR reklama pojawia się na ekranie ładowania wyszukiwania, w Mingl, RydR i na innych ekranach FLOQR. Publikujący reklamy klubu pozwala członkowi zespołu publikować reklamy dla klubu (rola Club Ad Poster). Kredyty SMS nie są potrzebne."
      },
      "help-public-media-sharing": {
        title: "Udostępnianie mediów publicznych i danych",
        body: "Wybierz kilka obrazów lub krótkich filmów naraz, a następnie ułóż ich kolejność w profilu publicznym. Profile obsługują do 8 obrazów i 2 krótkich filmów."
      }
    },
    ar: {
      "help-featured-staff": {
        title: "طاقم الخدمة المميز",
        body: "حدّد أفراد الطاقم الذين تريدهم في صفحة النادي العامة. لكل شخص، اضغط على إحدى صوره في FLOQR أو اختر «رفع من الكمبيوتر». يمكنك تغيير الدور الظاهر تحت اسمه. اضغط «Save Public Profile» للنشر."
      },
      "help-shoutout-recommendations": {
        title: "توصيات ShoutOut",
        body: "اختر أسلوبًا ونوع المناسبة، ثم اضغط «Improve My ShoutOut» للحصول على أفكار تناسب القالب وحجم الشاشة. اضغط على أي فكرة لوضعها في رسالتك، ثم عدّلها إن شئت. يعيد «Use Past ShoutOut» إحدى رسائلك السابقة."
      },
      "help-ai-recommendations": {
        title: "توصيات الذكاء الاصطناعي",
        body: "أفكار مكتوبة لك بناءً على المكان ونوع المناسبة ومسودتك وملفك الشخصي. كل فكرة تناسب مسبقًا عدد الأسطر والأحرف في الشاشة التي اخترتها. اضغط على واحدة لاستخدامها."
      },
      "help-trending-shoutouts": {
        title: "ShoutOuts الرائجة",
        body: "ShoutOuts شائعة وافقت عليها FLOQR، مع تقديم ما يناسب موسيقى هذا المكان أولًا. اضغط على واحدة لاستخدامها."
      },
      "help-generic-shoutouts": {
        title: "ShoutOuts عامة",
        body: "أفكار جاهزة للمناسبات الشائعة مثل أعياد الميلاد والاحتفالات. اضغط على واحدة لاستخدامها، ثم اجعلها خاصة بك."
      },

      "help-beta-tester": {

        title: "الاختبار التجريبي",

        body: "تدعو FLOQR أحيانًا الزوار لتجربة ميزات جديدة مبكرًا. تصل الدعوة إلى صندوق الوارد؛ افتحها وأنت مسجّل الدخول بالحساب نفسه واختر قبول. ستظهر بعد ذلك في البحث مع شارة تجريبي الميزات التي اختارتها FLOQR لك فقط. قد تتغير أو تُوقَف أثناء الاختبار. تنتهي صلاحية الدعوات بعد 7 أيام ولا تعمل إلا للحساب الذي أُرسلت إليه."

      },
      "help-location-search": {
        title: "البحث حسب الموقع",
        body: "يعرض FLOQR الفعاليات والنوادي الأقرب إليك أولاً، ثم حسب الاسم. إذا سمحت بذلك، يستخدم موقع هاتفك أو متصفحك (GPS)؛ وإلا فإنه يقدّر مدينتك من اتصالك بالإنترنت (IP). اكتب مكاناً، مثل نوادي في موناكو، للبحث في مكان آخر — وستبدأ النتائج هناك أيضاً بالأقرب إليك. يمكنك إيقاف الوصول إلى الموقع من إعدادات المتصفح أو الهاتف."
      },
      "help-welcome": {
        title: "مرحباً بك في FLOQR",
        body: "ابحث واحجز فعاليات الترفيه والحياة الليلية حول العالم، أو أرسل ShoutOut مباشراً إلى إحدى شاشات ShoutOut لدينا، أو Mingl مع أشخاص جدد وأصدقاء وعائلة. سجّل الدخول عبر Google أو Microsoft أو Facebook أو بكلمة مرور لمرة واحدة (OTP). رمز OTP هو رمز قصير يرسله FLOQR إلى بريدك الإلكتروني أو عبر WhatsApp (عالمياً) أو عبر SMS (لأرقام الولايات المتحدة وكندا فقط). اكتب الرمز خلال دقائق قليلة لتسجيل الدخول، دون الحاجة إلى تذكّر كلمة مرور. كل رمز يعمل مرة واحدة فقط. لا تشارك رمزك مع أي شخص."
      },
      "help-ad-campaigns": {
        title: "حملات إعلانية",
        body: "انشر صورة منشور دعائي أو فيديو حتى 30 ثانية لنشاطك التجاري أو ناديك أو مجموعة الترويج أو خدمتك (DJ، مصوّر، مروّج، FloqQ). اختر Inline (45$ / 7 أيام — شاشة تحميل البحث وشاشات الميزات) أو Mingl Gist (25$ / 7 أيام — القصص)، ومدة العرض ومن يجب أن يراه (العمر، الجنس، المدن، الاهتمامات). ادفع بالبطاقة أو باشتراك شهري؛ ويمكن للحسابات المعتمدة الدفع بفاتورة. تراجع FLOQR كل إعلان مدفوع قبل عرضه، وتُسترد قيمة الإعلانات المرفوضة. تعرض إعلاناتي الحالة والمشاهدات والنقرات وفاتورتك."
      },
      "help-completed-shoutouts": {
        title: "ShoutOuts المكتملة",
        body: "ShoutOuts المكتملة هي المعتمدة من النادي (والمنتهية) لسجلاتك. تنقل الأرشفة ShoutOut من المكتملة إلى Archive مع نص ووسائط مضغوطة (إن وُجدت). إعادة الاستخدام تفتح Search بنفس النص. يظهر حفظ كقالب فقط عندما تكون خلفية القالب قابلة للتعديل (IsModifiable). تبقى الإيصالات المدفوعة في FloqR Inbox."
      },
      "help-archived-shoutouts": {
        title: "ShoutOuts المؤرشفة",
        body: "يخزّن Archive نسخة مضغوطة من نص ووسائط ShoutOut المكتمل (إن وُجدت وسائط) في تخزين Firebase منخفض التكلفة ويزيله من المكتملة. افتح Archive في أي وقت. تعمل إعادة الاستخدام أيضاً من Archive."
      },
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
      "help-do-not-sell": {
        title: "عدم البيع أو المشاركة",
        body: "فعّل هذا لإيقاف التخصيص عبر وسوم الملف. إعلانات عامة/منزلية قد تظهر. Global Privacy Control (GPC) يفعّل هذا تلقائياً. راجع سياسة الخصوصية (CCPA / CPRA)."
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
        body: "قالب Traditional Black and White Classic مجاني. القوالب الخاصة بهذا المكان فقط، مثل Football Intro أو Tengo muchos dólares، تظهر تحت «حصريًا في» مع اسم المكان. استخدم FloqAi أدناه لقوالب Sports وJersey وVIP وHumor وCars وVideo وPictures وBallers."
      },
      "help-floqai-template-search": {
        title: "بحث قالب FloqAi",
        body: "اضغط على العلامة المتحركة FloqAi (أو انتظر فقاعات حديثها)، ثم اطلب الرياضة، القمصان، NBA، NFL، السيارات، الفكاهة، كبار الشخصيات، الفيديو، الصور، أو اللاعبين."
      },
      "help-football-intro": {
        title: "Football Intro",
        body: "مقدمة ملعب مدتها 20 ثانية لأربعة لاعبين مقابل 30 دولارًا، متاحة في Zebbies Garden DC وHeist Washington DC وAurelia. اكتب «Football Intro» في البحث، واختر أحد هذه الأماكن، ثم ارفع أربع صور لديك إذن باستخدامها. على شاشات 96×48 فقط."
      },
      "help-tengo-muchos-dolares": {
        title: "Tengo muchos dólares",
        body: "حصري لـ Heist Washington DC مقابل 30 دولارًا. تظهر رسالتك أمام غرفة الخزنة لمدة 5 ثوانٍ؛ ثم ينفجر باب الخزنة وتتطاير أوراق المئة دولار خلف نصك لمدة 10 ثوانٍ. في النهاية تعرض الشاشة شعار HEIST فوق Washington DC ثم يتكرر العرض. اكتب «Tengo muchos dólares» في البحث، ثم أدخل اسمًا فقط أو اختر @معرّف Instagram / Mingl (14 حرفًا كحد أقصى). تعرض الشاشة الاسم ثم تكتب «Tengo muchos dólares... I just did a heist!» حرفًا حرفًا. على شاشات 96×48 فقط."
      },
      "help-club-template-repository": {
        title: "قوالب ناديك",
        body: "تظهر القوالب المصممة لناديك فقط في المقدمة مع عبارة «حصريًا في» واسم المكان. القوالب المعيّنة هي التي يمكن للزبائن اختيارها في ناديك؛ غيّر ذلك عبر تعيين القالب أو إزالة القالب. يعثر البحث على القالب حتى بدون علامات التشكيل أو مع خطأ إملائي بسيط."
      },
      "help-employee-network": {
        title: "شبكة الموظفين والعاملين",
        body: "تظهر هنا فقط الأشخاص المرتبطون بهذا النادي: العاملون المعيّنون أو الموافق عليهم هنا، ومسؤولو النادي، والعاملون المنتسبون إلى هذا النادي. لمنح شخص دورًا، اكتب اسمه أو اسم المستخدم أو بريده الإلكتروني في تعيين زبون لدور، ثم اضغط اختيار بجانب الشخص الصحيح، واختر الدور، ثم اضغط تعيين الزبون المحدد للدور وأكّد. يحتاج الشخص أولًا إلى حساب زبون في FLOQR. يمكن جعل النُدُل والنادلات والـ bottle girls في القائمة ممثلين لخدمة العملاء (CSR)."
      },
      "help-template-tags": {
        title: "وسوم القوالب",
        body: "أضف كلمات قد يكتبها الزبائن عند البحث عن قالب في مكانك، مثل ليلة المباراة أو عيد الميلاد. يمكن لمديري القوالب إضافة الوسوم. ويمكن لمسؤولي القوالب وClub Admin إزالتها أيضًا. يعيّن Club Admin هذه الأدوار من قسم Role Activity & Permission."
      },
      "help-template-preview": {
        title: "معاينة قالب",
        body: "اضغط معاينة على أي بطاقة قالب لتراه يُعرض على شاشة تجريبية بنص وصور مختلقة. بدّل بين أحجام الشاشات المتاحة في هذا المكان. يعرض ShoutOut الخاص بك كلماتك وصورك أنت."
      },
      "help-display-idle-default": {
        title: "شاشة الانتظار: Use ShoutOut @ المكان",
        body: "عندما لا يُعرض أي ShoutOut، يعرض Display 1 عبارة «Use ShoutOut @» مع اسم مكانك. يُعرض كل ShoutOut معتمد لمدة 10 دقائق ثم تعود الشاشة تلقائيًا إلى هذه الرسالة. إعادة ضبط الشاشة إلى الوضع الافتراضي في Club Admin تفعل ذلك فورًا."
      },
      "help-mingl-requests": {
        title: "حول طلبات Mingl",
        body: "تظهر هنا الطلبات المرسلة والمستلمة من الأصدقاء أو Mingl. تبقى الطلبات في الصفحة الرئيسية لـ Mingl؛ المحادثات المقبولة تفتح في دردشة Mingl."
      },
      "help-club-messaging-logs": {
        title: "سجلات تسليم SMS وWhatsApp",
        body: "Club Admin → Marketing → سجلات SMS وWhatsApp تعرض Twilio SMS وWhatsApp لهذا المكان (اختبار تسويق، تنبيهات النادي). نفس الصفوف في Master Admin → Twilio. dry-run: نقص secrets أو From — لم يُسلَّم شيء ولم يُخصم رصيد. أرقام مخفية."
      },
      "help-club-messaging-credit": {
        title: "رصيد SMS وWhatsApp",
        body: "كل حزمة بـ 10$ تموّل 7.00$ من سعة Twilio؛ تحتفظ FloqR بـ 3.00$ هامش المنصة. حزمة SMS → 466 رسالة (≈ 0.015$ SMS أمريكي). حزمة WhatsApp → 233 رسالة (≈ 0.030$ Twilio + Meta marketing). عند الرصيد 0 اشترِ حزمة أخرى قبل الإرسال. فتح SMS ops (10$) يمنح حزمة SMS. خدمة WhatsApp (10$) تمنح حزمة WhatsApp. الحساب: 10$ → 466 SMS أو 233 WhatsApp (7.00$ Twilio / 3.00$ FloqR)."
      },
      "help-club-marketing-campaigns": {
        title: "حملات التسويق",
        body: "اختر قالبًا للقطاع، حمّل الخلفية والصور الإضافية، عدّل النص، ثم احفظ أو أرسل. الإرسال يخصم رصيد SMS أو WhatsApp من رصيد المراسلة."
      },
      "help-club-in-app-marketing": {
        title: "التسويق داخل التطبيق",
        body: "انشر منشورًا دعائيًا أو فيديو حتى 30 ثانية باسم ناديك. بعد الدفع وموافقة FLOQR يظهر على شاشة تحميل البحث وفي Mingl وRydR وشاشات FLOQR الأخرى. يتيح ناشرو إعلانات النادي لأحد أعضاء الفريق نشر إعلانات للنادي (دور Club Ad Poster). لا حاجة إلى رصيد SMS."
      },
      "help-public-media-sharing": {
        title: "وسائل الإعلام العامة ومشاركة البيانات",
        body: "اختر عدة صور أو مقاطع فيديو قصيرة دفعة واحدة، ثم رتّب ترتيبها في الملف العام. تدعم الملفات حتى 8 صور ومقطعي فيديو قصيرين."
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
