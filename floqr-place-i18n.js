/* FLOQR place / genre / offering display i18n — Firestore values stay English; UI labels localize. */
(function (global) {
  "use strict";

  const VERSION = "s3.0.87";
  const LANGS = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];

  function row(en, fr, de, es, nl, ru, it, pt, el, pl, ar) {
    return { en, fr, de, es, nl, ru, it, pt, el, pl, ar };
  }

  function pick(table, lang, key) {
    if (!key) return "";
    const k = String(key).trim();
    const entry = table[k];
    if (!entry) return k;
    const code = normalizeLang(lang);
    return entry[code] || entry.en || k;
  }

  function normalizeLang(code) {
    const c = String(code || "en").toLowerCase().split("-")[0];
    return LANGS.includes(c) ? c : "en";
  }

  function lang() {
    const fromI18n = global.FLOQRI18n?.getLanguage?.();
    if (fromI18n) return normalizeLang(fromI18n);
    try {
      const saved = localStorage.getItem("floqr.uiLanguage");
      if (saved) return normalizeLang(saved);
    } catch (_) {}
    return normalizeLang(global.navigator?.language || "en");
  }

  const COUNTRIES = {
    "United States": row("United States", "États-Unis", "Vereinigte Staaten", "Estados Unidos", "Verenigde Staten", "Соединённые Штаты", "Stati Uniti", "Estados Unidos", "Ηνωμένες Πολιτείες", "Stany Zjednoczone", "الولايات المتحدة"),
    Canada: row("Canada", "Canada", "Kanada", "Canadá", "Canada", "Канада", "Canada", "Canadá", "Καναδάς", "Kanada", "كندا"),
    Mexico: row("Mexico", "Mexique", "Mexiko", "México", "Mexico", "Мексика", "Messico", "México", "Μεξικό", "Meksyk", "المكسيك"),
    "United Kingdom": row("United Kingdom", "Royaume-Uni", "Vereinigtes Königreich", "Reino Unido", "Verenigd Koninkrijk", "Великобритания", "Regno Unito", "Reino Unido", "Ηνωμένο Βασίλειο", "Wielka Brytania", "المملكة المتحدة"),
    France: row("France", "France", "Frankreich", "Francia", "Frankrijk", "Франция", "Francia", "França", "Γαλλία", "Francja", "فرنسا"),
    Germany: row("Germany", "Allemagne", "Deutschland", "Alemania", "Duitsland", "Германия", "Germania", "Alemanha", "Γερμανία", "Niemcy", "ألمانيا"),
    Spain: row("Spain", "Espagne", "Spanien", "España", "Spanje", "Испания", "Spagna", "Espanha", "Ισπανία", "Hiszpania", "إسبانيا"),
    Italy: row("Italy", "Italie", "Italien", "Italia", "Italië", "Италия", "Italia", "Itália", "Ιταλία", "Włochy", "إيطاليا"),
    Netherlands: row("Netherlands", "Pays-Bas", "Niederlande", "Países Bajos", "Nederland", "Нидерланды", "Paesi Bassi", "Países Baixos", "Κάτω Χώρες", "Holandia", "هولندا"),
    Belgium: row("Belgium", "Belgique", "Belgien", "Bélgica", "België", "Бельгия", "Belgio", "Bélgica", "Βέλγιο", "Belgia", "بلجيكا"),
    Switzerland: row("Switzerland", "Suisse", "Schweiz", "Suiza", "Zwitserland", "Швейцария", "Svizzera", "Suíça", "Ελβετία", "Szwajcaria", "سويسرا"),
    Portugal: row("Portugal", "Portugal", "Portugal", "Portugal", "Portugal", "Португалия", "Portogallo", "Portugal", "Πορτογαλία", "Portugalia", "البرتغال"),
    Greece: row("Greece", "Grèce", "Griechenland", "Grecia", "Griekenland", "Греция", "Grecia", "Grécia", "Ελλάδα", "Grecja", "اليونان"),
    Poland: row("Poland", "Pologne", "Polen", "Polonia", "Polen", "Польша", "Polonia", "Polónia", "Πολωνία", "Polska", "بولندا"),
    Russia: row("Russia", "Russie", "Russland", "Rusia", "Rusland", "Россия", "Russia", "Rússia", "Ρωσία", "Rosja", "روسيا"),
    Egypt: row("Egypt", "Égypte", "Ägypten", "Egipto", "Egypte", "Египет", "Egitto", "Egito", "Αίγυπτος", "Egipt", "مصر"),
    Morocco: row("Morocco", "Maroc", "Marokko", "Marruecos", "Marokko", "Марокко", "Marocco", "Marrocos", "Μαρόκο", "Maroko", "المغرب"),
    UAE: row("UAE", "Émirats arabes unis", "VAE", "EAU", "VAE", "ОАЭ", "EAU", "EAU", "ΗΑΕ", "ZEA", "الإمارات"),
    "Saudi Arabia": row("Saudi Arabia", "Arabie saoudite", "Saudi-Arabien", "Arabia Saudí", "Saoedi-Arabië", "Саудовская Аравия", "Arabia Saudita", "Arábia Saudita", "Σαουδική Αραβία", "Arabia Saudyjska", "المملكة العربية السعودية"),
    Lebanon: row("Lebanon", "Liban", "Libanon", "Líbano", "Libanon", "Ливан", "Libano", "Líbano", "Λίβανος", "Liban", "لبنان"),
    Jordan: row("Jordan", "Jordanie", "Jordanien", "Jordania", "Jordanië", "Иордания", "Giordania", "Jordânia", "Ιορδανία", "Jordania", "الأردن"),
    Tunisia: row("Tunisia", "Tunisie", "Tunesien", "Túnez", "Tunesië", "Тунис", "Tunisia", "Tunísia", "Τυνησία", "Tunezja", "تونس"),
    Algeria: row("Algeria", "Algérie", "Algerien", "Argelia", "Algerije", "Алжир", "Algeria", "Argélia", "Αλγερία", "Algieria", "الجزائر"),
    Senegal: row("Senegal", "Sénégal", "Senegal", "Senegal", "Senegal", "Сенегал", "Senegal", "Senegal", "Σενεγάλη", "Senegal", "السénégal"),
    Nigeria: row("Nigeria", "Nigeria", "Nigeria", "Nigeria", "Nigeria", "Нигерия", "Nigeria", "Nigéria", "Νιγηρία", "Nigeria", "نigeria"),
    Ghana: row("Ghana", "Ghana", "Ghana", "Ghana", "Ghana", "Гана", "Ghana", "Gana", "Γκάνα", "Ghana", "غانا"),
    "South Africa": row("South Africa", "Afrique du Sud", "Südafrika", "Sudáfrica", "Zuid-Afrika", "Южная Африка", "Sudafrica", "África do Sul", "Νότια Αφρική", "Południowa Afryka", "جنوب أفريقيا"),
    Kenya: row("Kenya", "Kenya", "Kenia", "Kenia", "Kenia", "Кения", "Kenya", "Quénia", "Κένυα", "Kenia", "كينيا"),
    Brazil: row("Brazil", "Brésil", "Brasilien", "Brasil", "Brazilië", "Бразилия", "Brasile", "Brasil", "Βραζιλία", "Brazylia", "البرازيل"),
    Argentina: row("Argentina", "Argentine", "Argentinien", "Argentina", "Argentinië", "Аргентина", "Argentina", "Argentina", "Αργεντινή", "Argentyna", "الأرجنتين"),
    Colombia: row("Colombia", "Colombie", "Kolumbien", "Colombia", "Colombia", "Колумбия", "Colombia", "Colômbia", "Κολομβία", "Kolumbia", "كولombia"),
    Chile: row("Chile", "Chili", "Chile", "Chile", "Chili", "Чили", "Cile", "Chile", "Χιλή", "Chile", "تشيلي"),
    Peru: row("Peru", "Pérou", "Peru", "Perú", "Peru", "Перу", "Perù", "Peru", "Περού", "Peru", "بيرو"),
    Japan: row("Japan", "Japon", "Japan", "Japón", "Japan", "Япония", "Giappone", "Japão", "Ιαπωνία", "Japonia", "اليابان"),
    China: row("China", "Chine", "China", "China", "China", "Китай", "Cina", "China", "Κίνα", "Chiny", "الصين"),
    India: row("India", "Inde", "Indien", "India", "India", "Индия", "India", "Índia", "Ινδία", "Indie", "الهند"),
    Australia: row("Australia", "Australie", "Australien", "Australia", "Australië", "Австралия", "Australia", "Austrália", "Αυστραλία", "Australia", "أستراليا")
  };

  const REGIONS = {
    "District of Columbia": row("District of Columbia", "district de Columbia", "District of Columbia", "Distrito de Columbia", "District of Columbia", "Округ Колумбия", "Distretto di Columbia", "Distrito de Columbia", "Περιφέρεια του Κολόμπου", "Dystrykt Kolumbii", "مقاطعة كولومبيا"),
    Florida: row("Florida", "Floride", "Florida", "Florida", "Florida", "Флорида", "Florida", "Flórida", "Φλόριντα", "Floryda", "فلوريدا"),
    Georgia: row("Georgia", "Géorgie", "Georgia", "Georgia", "Georgia", "Джорджия", "Georgia", "Geórgia", "Τζόρτζια", "Georgia", "جورجيا"),
    "New York": row("New York", "New York", "New York", "Nueva York", "New York", "Нью-Йорк", "New York", "Nova Iorque", "Νέα Υόρκη", "Nowy Jork", "نيويورك"),
    California: row("California", "Californie", "Kalifornien", "California", "Californië", "Калифорния", "California", "Califórnia", "Καλιφόρνια", "Kalifornia", "كاليفورنيا"),
    Catalonia: row("Catalonia", "Catalogne", "Katalonien", "Cataluña", "Catalonië", "Каталония", "Catalogna", "Catalunha", "Καταλονία", "Katalonia", "كاتالونيا"),
    "Provence-Alpes-Côte d’Azur": row("Provence-Alpes-Côte d’Azur", "Provence-Alpes-Côte d’Azur", "Provence-Alpes-Côte d’Azur", "Provenza-Alpes-Costa Azul", "Provence-Alpes-Côte d’Azur", "Прованс — Альпы — Лазурный Берег", "Provenza-Alpi-Costa Azzurra", "Provença-Alpes-Côte d’Azur", "Προβηγκία-Άλπεις-Κôte d’Azur", "Prowansja-Alpy-Lazurowe Wybrzeże", "بروفانس-الألب-كوت دازور"),
    "Provence-Alpes-Cote d'Azur": row("Provence-Alpes-Côte d’Azur", "Provence-Alpes-Côte d’Azur", "Provence-Alpes-Côte d’Azur", "Provenza-Alpes-Costa Azul", "Provence-Alpes-Côte d’Azur", "Прованс — Альпы — Лазурный Берег", "Provenza-Alpi-Costa Azzurra", "Provença-Alpes-Côte d’Azur", "Προβηγκία-Άλπεις-Κôte d’Azur", "Prowansja-Alpy-Lazurowe Wybrzeże", "بروفانس-الألب-كوت دازور"),
    England: row("England", "Angleterre", "England", "Inglaterra", "Engeland", "Англия", "Inghilterra", "Inglaterra", "Αγγλία", "Anglia", "إنجلترا"),
    Ibiza: row("Ibiza", "Ibiza", "Ibiza", "Ibiza", "Ibiza", "Ибица", "Ibiza", "Ibiza", "Ίμπιζα", "Ibiza", "إيبiza"),
    Mykonos: row("Mykonos", "Mykonos", "Mykonos", "Miconos", "Mykonos", "Миконос", "Mykonos", "Míconos", "Μύκονος", "Mykonos", "مikonos"),
    Lombardy: row("Lombardy", "Lombardie", "Lombardei", "Lombardía", "Lombardije", "Ломбардия", "Lombardia", "Lombardia", "Λομβαρδία", "Lombardia", "لومبارديا"),
    "Balearic Islands": row("Balearic Islands", "Îles Baléares", "Balearen", "Islas Baleares", "Balearen", "Бaleарские острова", "Isole Baleari", "Ilhas Baleares", "Βaleαρικά Νησιά", "Baleary", "جزر البaleares")
  };

  const CITIES = {
    Barcelona: row("Barcelona", "Barcelone", "Barcelona", "Barcelona", "Barcelona", "Барселона", "Barcellona", "Barcelona", "Βαρκελώνη", "Barcelona", "برشلونة"),
    Washington: row("Washington", "Washington", "Washington", "Washington", "Washington", "Вашингton", "Washington", "Washington", "Ουάσιγκτον", "Waszyngton", "واشنطن"),
    Miami: row("Miami", "Miami", "Miami", "Miami", "Miami", "Майами", "Miami", "Miami", "Μiami", "Miami", "مiami"),
    Atlanta: row("Atlanta", "Atlanta", "Atlanta", "Atlanta", "Atlanta", "Атланта", "Atlanta", "Atlanta", "Ατλάντα", "Atlanta", "أtlanta"),
    "New York": row("New York", "New York", "New York", "Nueva York", "New York", "Нью-Йорк", "New York", "Nova Iorque", "Νέα Υόρκη", "Nowy Jork", "نيويork"),
    "Los Angeles": row("Los Angeles", "Los Angeles", "Los Angeles", "Los Ángeles", "Los Angeles", "Лос-Анджелес", "Los Angeles", "Los Angeles", "Λος Άντζελες", "Los Angeles", "لوس أنgeles"),
    London: row("London", "Londres", "London", "Londres", "Londen", "Лондон", "Londra", "Londres", "Λονδίνο", "Londyn", "لondon"),
    Cannes: row("Cannes", "Cannes", "Cannes", "Cannes", "Cannes", "Канны", "Cannes", "Cannes", "Κάννες", "Cannes", "كان"),
    Milan: row("Milan", "Milan", "Mailand", "Milán", "Milaan", "Милан", "Milano", "Milão", "Μιλάνο", "Mediolan", "مilan")
  };

  const GENRE_CANON = {
    "hip hop": "Hip Hop",
    hiphop: "Hip Hop",
    "afro beats": "Afro Beats",
    afrobeats: "Afrobeats",
    house: "House",
    "r&b": "R&B",
    rnb: "R&B",
    edm: "EDM",
    international: "International",
    latin: "Latin",
    "top 40": "Top 40",
    throwbacks: "Throwbacks",
    reggaeton: "Reggaeton",
    techno: "Techno",
    "afro house": "Afro House",
    amapiano: "Amapiano",
    lounge: "Lounge",
    "live entertainment": "Live entertainment",
    arabic: "Arabic",
    bollywood: "Bollywood",
    khaleeji: "Khaleeji",
    "deep house": "Deep House",
    "tech house": "Tech House",
    "open format": "Open Format",
    commercial: "Commercial",
    mediterranean: "Mediterranean",
    sunset: "Sunset",
    "latin urban": "Latin Urban",
    cabaret: "Cabaret"
  };

  const GENRES = {
    "Hip Hop": row("Hip Hop", "Hip-hop", "Hip-Hop", "Hip hop", "Hip-hop", "Хип-хоп", "Hip hop", "Hip-hop", "Hip Hop", "Hip-hop", "هيب هوب"),
    "Afro Beats": row("Afro Beats", "Afro Beats", "Afro Beats", "Afro Beats", "Afro Beats", "Афро-бит", "Afro Beats", "Afro Beats", "Afro Beats", "Afro Beats", "أfro beats"),
    Afrobeats: row("Afrobeats", "Afrobeats", "Afrobeats", "Afrobeats", "Afrobeats", "Афробит", "Afrobeats", "Afrobeats", "Afrobeats", "Afrobeats", "أfrobeat"),
    House: row("House", "House", "House", "House", "House", "House", "House", "House", "House", "House", "هاus"),
    "R&B": row("R&B", "R&B", "R&B", "R&B", "R&B", "R&B", "R&B", "R&B", "R&B", "R&B", "آrnb"),
    EDM: row("EDM", "EDM", "EDM", "EDM", "EDM", "EDM", "EDM", "EDM", "EDM", "EDM", "EDM"),
    International: row("International", "International", "International", "Internacional", "Internationaal", "Международная", "Internazionale", "Internacional", "Διεθνές", "Międzynarodowy", "عالمي"),
    Latin: row("Latin", "Latin", "Latin", "Latino", "Latijns", "Лatin", "Latino", "Latino", "Λatin", "Latynoski", "لاتin"),
    "Top 40": row("Top 40", "Top 40", "Top 40", "Top 40", "Top 40", "Топ 40", "Top 40", "Top 40", "Top 40", "Top 40", "Top 40"),
    Throwbacks: row("Throwbacks", "Classiques", "Oldies", "Clásicos", "Oldies", "Ретро", "Classici", "Clássicos", "Ρετρό", "Klasyki", "كلاسيكيات"),
    Reggaeton: row("Reggaeton", "Reggaeton", "Reggaeton", "Reggaetón", "Reggaeton", "Reggaeton", "Reggaeton", "Reggaeton", "Reggaeton", "Reggaeton", "ريgeton"),
    Techno: row("Techno", "Techno", "Techno", "Techno", "Techno", "Techno", "Techno", "Techno", "Techno", "Techno", "Techno"),
    "Afro House": row("Afro House", "Afro House", "Afro House", "Afro House", "Afro House", "Afro House", "Afro House", "Afro House", "Afro House", "Afro House", "Afro House"),
    Amapiano: row("Amapiano", "Amapiano", "Amapiano", "Amapiano", "Amapiano", "Amapiano", "Amapiano", "Amapiano", "Amapiano", "Amapiano", "Amapiano"),
    Lounge: row("Lounge", "Lounge", "Lounge", "Lounge", "Lounge", "Lounge", "Lounge", "Lounge", "Lounge", "Lounge", "Lounge"),
    "Live entertainment": row("Live entertainment", "Spectacle live", "Live-Unterhaltung", "Entretenimiento en vivo", "Live entertainment", "Живые выступления", "Intrattenimento dal vivo", "Entretenimento ao vivo", "Ζωντανή ψυχαγωγία", "Rozrywka na żywo", "ترفيه حي"),
    Arabic: row("Arabic", "Arabe", "Arabisch", "Árabe", "Arabisch", "Арабская", "Araba", "Árabe", "Αραβική", "Arabska", "عربي"),
    Bollywood: row("Bollywood", "Bollywood", "Bollywood", "Bollywood", "Bollywood", "Bollywood", "Bollywood", "Bollywood", "Bollywood", "Bollywood", "Bollywood"),
    Khaleeji: row("Khaleeji", "Khaleeji", "Khaleeji", "Khaleeji", "Khaleeji", "Khaleeji", "Khaleeji", "Khaleeji", "Khaleeji", "Khaleeji", "Khaleeji"),
    "Deep House": row("Deep House", "Deep House", "Deep House", "Deep House", "Deep House", "Deep House", "Deep House", "Deep House", "Deep House", "Deep House", "Deep House"),
    "Tech House": row("Tech House", "Tech House", "Tech House", "Tech House", "Tech House", "Tech House", "Tech House", "Tech House", "Tech House", "Tech House", "Tech House"),
    "Open Format": row("Open Format", "Format libre", "Open Format", "Formato abierto", "Open Format", "Open Format", "Open Format", "Open Format", "Open Format", "Open Format", "Open Format"),
    Commercial: row("Commercial", "Commercial", "Commercial", "Comercial", "Commercial", "Commercial", "Commerciale", "Comercial", "Commercial", "Commercial", "Commercial"),
    Mediterranean: row("Mediterranean", "Méditerranéen", "Mediterran", "Mediterráneo", "Mediterraans", "Средиземноморский", "Mediterraneo", "Mediterrâneo", "Μεσογειακό", "Śródziemnomorski", "متوسطي"),
    Sunset: row("Sunset", "Coucher de soleil", "Sonnenuntergang", "Atardecer", "Zonsondergang", "Закат", "Tramonto", "Pôr do sol", "Ηλιοβασίλεμα", "Zachód słońca", "غروب"),
    "Latin Urban": row("Latin Urban", "Latin urbain", "Latin Urban", "Urbano latino", "Latin Urban", "Latin Urban", "Latin Urban", "Latin Urban", "Latin Urban", "Latin Urban", "Latin Urban"),
    Cabaret: row("Cabaret", "Cabaret", "Kabarett", "Cabaret", "Cabaret", "Кабаре", "Cabaret", "Cabaret", "Καμπαρέ", "Kabaret", "Kabaret")
  };

  const WEEKDAYS = {
    Monday: row("Monday", "Lundi", "Montag", "Lunes", "Maandag", "Понедельник", "Lunedì", "Segunda-feira", "Δευτέρα", "Poniedziałek", "الاثنين"),
    Tuesday: row("Tuesday", "Mardi", "Dienstag", "Martes", "Dinsdag", "Вторник", "Martedì", "Terça-feira", "Τρίτη", "Wtorek", "الثلاثاء"),
    Wednesday: row("Wednesday", "Mercredi", "Mittwoch", "Miércoles", "Woensdag", "Среда", "Mercoledì", "Quarta-feira", "Τετάρτη", "Środa", "الأربعاء"),
    Thursday: row("Thursday", "Jeudi", "Donnerstag", "Jueves", "Donderdag", "Четверг", "Giovedì", "Quinta-feira", "Πέμπτη", "Czwartek", "الخميس"),
    Friday: row("Friday", "Vendredi", "Freitag", "Viernes", "Vrijdag", "Пятница", "Venerdì", "Sexta-feira", "Παρασκευή", "Piątek", "الجمعة"),
    Saturday: row("Saturday", "Samedi", "Samstag", "Sábado", "Zaterdag", "Суббота", "Sabato", "Sábado", "Σάββατο", "Sobota", "السبت"),
    Sunday: row("Sunday", "Dimanche", "Sonntag", "Domingo", "Zondag", "Воскресенье", "Domenica", "Domingo", "Κυριακή", "Niedziela", "الأحد"),
    Mon: row("Mon", "Lun", "Mo", "Lun", "Ma", "Пн", "Lun", "Seg", "Δευ", "Pon", "اث"),
    Tue: row("Tue", "Mar", "Di", "Mar", "Di", "Вт", "Mar", "Ter", "Τρί", "Wt", "ثل"),
    Wed: row("Wed", "Mer", "Mi", "Mié", "Wo", "Ср", "Mer", "Qua", "Τετ", "Śr", "أrb"),
    Thu: row("Thu", "Jeu", "Do", "Jue", "Do", "Чт", "Gio", "Qui", "Πέμ", "Czw", "خم"),
    Fri: row("Fri", "Ven", "Fr", "Vie", "Vr", "Пт", "Ven", "Sex", "Παρ", "Pt", "جم"),
    Sat: row("Sat", "Sam", "Sa", "Sáb", "Za", "Сб", "Sab", "Sáb", "Σάβ", "Sob", "سب"),
    Sun: row("Sun", "Dim", "So", "Dom", "Zo", "Вс", "Dom", "Dom", "Κυρ", "Nie", "أhd"),
    Weeknight: row("Weeknight", "Semaine", "Wochentag", "Entre semana", "Doordeweeks", "Будни", "Feriale", "Noite de semana", "Καθημερινή", "Wieczór w tygodniu", "أيام الأسبوع"),
    Weekend: row("Weekend", "Week-end", "Wochenende", "Fin de semana", "Weekend", "Выходные", "Weekend", "Fim de semana", "Σαββατοκύριακο", "Weekend", "عطلة نهاية الأسبوع")
  };

  const PHRASES = {
    "late night": row("late night", "soir tard", "spät in der Nacht", "noche tardía", "late night", "поздняя ночь", "notte tardiva", "noite tardia", "αργά το βράδυ", "późna noc", "late night"),
    "Late night": row("Late night", "Soir tard", "Spät in der Nacht", "Noche tardía", "Late night", "Поздняя ночь", "Notte tardiva", "Noite tardia", "Αργά το βράδυ", "Późna noc", "late night"),
    rooftop: row("rooftop", "toit-terrasse", "Dachterrasse", "azotea", "dakterras", "кровля", "rooftop", "terraço", "στη στέγη", "dach", "roof"),
    "Private events": row("Private events", "Événements privés", "Private Events", "Eventos privados", "Privé-evenementen", "Частные мероприятия", "Eventi privati", "Eventos privados", "Ιδιωτικές εκδηλώσεις", "Wydarzenia prywatne", "فعاليات خاصة"),
    "Summer Beach Club": row("Summer Beach Club", "Summer Beach Club", "Summer Beach Club", "Summer Beach Club", "Summer Beach Club", "Summer Beach Club", "Summer Beach Club", "Summer Beach Club", "Summer Beach Club", "Summer Beach Club", "Summer Beach Club"),
    "dinner + late bar": row("dinner + late bar", "dîner + bar tardif", "Abendessen + späte Bar", "cena + bar nocturno", "diner + late bar", "ужин + поздний бар", "cena + bar tardivo", "jantar + bar tardio", "δείπνο + late bar", "kolacja + późny bar", "dinner + late bar"),
    "late-night lounge / house": row("late-night lounge / house", "lounge / house tardif", "Late-Night Lounge / House", "lounge / house nocturno", "late-night lounge / house", "поздний lounge / house", "lounge / house notturno", "lounge / house noturno", "late-night lounge / house", "późny lounge / house", "late-night lounge / house"),
    "evening lounge": row("evening lounge", "lounge du soir", "Abend-Lounge", "lounge nocturno", "avond lounge", "вечерний lounge", "lounge serale", "lounge noturno", "βραδινό lounge", "wieczorny lounge", "evening lounge"),
    "Seasonal summer activity": row("Seasonal summer activity", "Activité estivale saisonnière", "Saisonale Sommeraktivität", "Actividad estival", "Seizoensgebonden zomeractiviteit", "Сезонная летняя активность", "Attività estiva stagionale", "Atividade de verão sazonal", "Εποχική καλοκαιρινή δραστηριότητα", "Sezonowa aktywność letnia", "Seasonal summer activity"),
    "Seasonal Ibiza programming": row("Seasonal Ibiza programming", "Programmation saisonnière Ibiza", "Saisonale Ibiza-Programmierung", "Programación estacional de Ibiza", "Seizoensprogrammering Ibiza", "Сезонное программирование Ибицы", "Programmazione stagionale Ibiza", "Programação sazonal de Ibiza", "Seasonal Ibiza programming", "Sezonowe programowanie Ibizy", "Seasonal Ibiza programming"),
    "Weekly club programming": row("Weekly club programming", "Programmation hebdomadaire", "Wöchentliches Club-Programm", "Programación semanal del club", "Wekelijkse clubprogrammering", "Еженедельная программа клуба", "Programmazione settimanale", "Programação semanal do clube", "Weekly club programming", "Tygodniowa programacja klubu", "Weekly club programming")
  };

  function canonicalGenreKey(raw) {
    const norm = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
    return GENRE_CANON[norm] || String(raw || "").trim();
  }

  function country(enName, code) {
    return pick(COUNTRIES, code || lang(), enName);
  }

  function region(enName, code) {
    return pick(REGIONS, code || lang(), enName);
  }

  function city(enName, code) {
    return pick(CITIES, code || lang(), enName);
  }

  function genre(enName, code) {
    const canon = canonicalGenreKey(enName);
    return pick(GENRES, code || lang(), canon) || enName;
  }

  function genres(arr, code) {
    return (arr || []).map((g) => genre(g, code));
  }

  function replaceWeekdays(text, code) {
    let out = String(text);
    const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Weeknight", "Weekend", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    order.forEach((day) => {
      const tr = pick(WEEKDAYS, code, day);
      if (tr === day) return;
      const re = new RegExp(`\\b${day.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      out = out.replace(re, tr);
    });
    return out;
  }

  function replacePhrases(text, code) {
    let out = String(text);
    const keys = Object.keys(PHRASES).sort((a, b) => b.length - a.length);
    keys.forEach((phrase) => {
      const tr = pick(PHRASES, code, phrase);
      if (tr === phrase) return;
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out.replace(re, (m) => (m === m.toUpperCase() ? tr.toUpperCase() : tr));
    });
    return out;
  }

  function offering(enText, code) {
    const raw = String(enText || "").trim();
    if (!raw) return raw;
    const lc = code || lang();
    if (lc === "en") return raw;
    let out = replaceWeekdays(raw, lc);
    out = replacePhrases(out, lc);
    return out;
  }

  function offerings(arr, code) {
    return (arr || []).map((x) => offering(x, code));
  }

  function localizeLabelPart(part, code) {
    const p = String(part || "").trim();
    if (!p) return p;
    return city(p, code) !== p ? city(p, code) : region(p, code) !== p ? region(p, code) : country(p, code) !== p ? country(p, code) : p;
  }

  function placeLine(loc, code) {
    const lc = code || lang();
    const o = loc || {};
    if (o.city || o.region) {
      const parts = [];
      if (o.city) parts.push(city(o.city, lc));
      if (o.region) parts.push(region(o.region, lc));
      return parts.filter(Boolean).join(", ");
    }
    const label = String(o.locationLabel || "").trim();
    if (!label) return "";
    const segments = label.split(",").map((s) => s.trim()).filter(Boolean);
    if (!segments.length) return label;
    const last = segments[segments.length - 1];
    const withoutCountry =
      o.country && last === o.country ? segments.slice(0, -1) : segments.length > 2 && COUNTRIES[last] ? segments.slice(0, -1) : segments;
    return withoutCountry.map((seg) => localizeLabelPart(seg, lc)).join(", ");
  }

  function optionLabel(type, enValue, code) {
    const v = String(enValue || "").trim();
    if (!v) return v;
    const lc = code || lang();
    if (type === "country") return country(v, lc);
    if (type === "region") return region(v, lc);
    if (type === "city") return city(v, lc);
    if (type === "genre") return genre(v, lc);
    return v;
  }

  const api = {
    VERSION,
    LANGS,
    lang,
    country,
    region,
    city,
    placeLine,
    genre,
    genres,
    offering,
    offerings,
    optionLabel,
    canonicalGenreKey
  };

  global.FLOQRPlaceI18n = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
