/* FLOQR UI i18n — Phase 2: browser-default first use, saved preference, returning-user prompt, Master Admin overrides. */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.uiLanguage";
  const PROMPT_KEY = "floqr.uiLanguagePromptDone";
  const VERSION = "s3.0.4";

  const SUPPORTED = [
    {code: "en", label: "English", native: "English", dir: "ltr"},
    {code: "de", label: "German", native: "Deutsch", dir: "ltr"},
    {code: "fr", label: "French", native: "Français", dir: "ltr"},
    {code: "es", label: "Spanish", native: "Español", dir: "ltr"},
    {code: "it", label: "Italian", native: "Italiano", dir: "ltr"},
    {code: "pt", label: "Portuguese", native: "Português", dir: "ltr"},
    {code: "ru", label: "Russian", native: "Русский", dir: "ltr"},
    {code: "el", label: "Greek", native: "Ελληνικά", dir: "ltr"},
    {code: "pl", label: "Polish", native: "Polski", dir: "ltr"},
    {code: "nl", label: "Dutch", native: "Nederlands", dir: "ltr"},
    {code: "ar", label: "Arabic", native: "العربية", dir: "rtl"}
  ];

  const STRINGS = {
    en: {
      "app.welcome": "Welcome",
      "app.continue": "Continue",
      "app.signOut": "Sign out",
      "app.signIn": "Please Sign-In or Sign-Up:",
      "app.search": "Search",
      "app.back": "Back",
      "app.save": "Save",
      "app.language": "Language",
      "app.languageSettings": "App language",
      "app.languageHint": "Choose the language for FloqR chrome and menus.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "My Profile",
      "nav.settings": "Settings",
      "nav.inbox": "Inbox",
      "prompt.title": "Use your language?",
      "prompt.body": "Your device prefers {lang}. Would you like FloqR in {native}?",
      "prompt.yes": "Yes, switch to {native}",
      "prompt.no": "Keep English",
      "prompt.later": "Ask me later",
      "mingl.matchReason": "Matched on shared interests",
      "mingl.matchReasonCount": "Matched on {n} shared interest areas",
      "bartr.categoryTemplate": "Seller layout template"
    },
    de: {
      "app.welcome": "Willkommen",
      "app.continue": "Weiter",
      "app.signOut": "Abmelden",
      "app.signIn": "Bitte anmelden oder registrieren:",
      "app.search": "Suche",
      "app.back": "Zurück",
      "app.save": "Speichern",
      "app.language": "Sprache",
      "app.languageSettings": "App-Sprache",
      "app.languageHint": "Wähle die Sprache für FloqR-Menüs und Oberfläche.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Mein Profil",
      "nav.settings": "Einstellungen",
      "nav.inbox": "Posteingang",
      "prompt.title": "Ihre Sprache verwenden?",
      "prompt.body": "Ihr Gerät bevorzugt {lang}. Möchten Sie FloqR auf {native}?",
      "prompt.yes": "Ja, zu {native} wechseln",
      "prompt.no": "Englisch behalten",
      "prompt.later": "Später fragen",
      "mingl.matchReason": "Übereinstimmung bei gemeinsamen Interessen",
      "mingl.matchReasonCount": "Übereinstimmung in {n} Interessenbereichen",
      "bartr.categoryTemplate": "Verkäufer-Layoutvorlage"
    },
    fr: {
      "app.welcome": "Bienvenue",
      "app.continue": "Continuer",
      "app.signOut": "Se déconnecter",
      "app.signIn": "Veuillez vous connecter ou vous inscrire :",
      "app.search": "Recherche",
      "app.back": "Retour",
      "app.save": "Enregistrer",
      "app.language": "Langue",
      "app.languageSettings": "Langue de l'application",
      "app.languageHint": "Choisissez la langue des menus FloqR.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Mon profil",
      "nav.settings": "Paramètres",
      "nav.inbox": "Boîte de réception",
      "prompt.title": "Utiliser votre langue ?",
      "prompt.body": "Votre appareil préfère {lang}. Afficher FloqR en {native} ?",
      "prompt.yes": "Oui, passer en {native}",
      "prompt.no": "Garder l'anglais",
      "prompt.later": "Plus tard",
      "mingl.matchReason": "Correspondance sur des centres d'intérêt communs",
      "mingl.matchReasonCount": "Correspondance sur {n} domaines d'intérêt",
      "bartr.categoryTemplate": "Modèle de mise en page vendeur"
    },
    es: {
      "app.welcome": "Bienvenido",
      "app.continue": "Continuar",
      "app.signOut": "Cerrar sesión",
      "app.signIn": "Inicia sesión o regístrate:",
      "app.search": "Buscar",
      "app.back": "Atrás",
      "app.save": "Guardar",
      "app.language": "Idioma",
      "app.languageSettings": "Idioma de la app",
      "app.languageHint": "Elige el idioma de los menús de FloqR.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Mi perfil",
      "nav.settings": "Ajustes",
      "nav.inbox": "Bandeja",
      "prompt.title": "¿Usar tu idioma?",
      "prompt.body": "Tu dispositivo prefiere {lang}. ¿Quieres FloqR en {native}?",
      "prompt.yes": "Sí, cambiar a {native}",
      "prompt.no": "Mantener inglés",
      "prompt.later": "Preguntar después",
      "mingl.matchReason": "Coincidencia por intereses compartidos",
      "mingl.matchReasonCount": "Coincidencia en {n} áreas de interés",
      "bartr.categoryTemplate": "Plantilla de diseño del vendedor"
    },
    it: {
      "app.welcome": "Benvenuto",
      "app.continue": "Continua",
      "app.signOut": "Esci",
      "app.signIn": "Accedi o registrati:",
      "app.search": "Cerca",
      "app.back": "Indietro",
      "app.save": "Salva",
      "app.language": "Lingua",
      "app.languageSettings": "Lingua dell'app",
      "app.languageHint": "Scegli la lingua dei menu FloqR.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Il mio profilo",
      "nav.settings": "Impostazioni",
      "nav.inbox": "Posta",
      "prompt.title": "Usare la tua lingua?",
      "prompt.body": "Il dispositivo preferisce {lang}. Vuoi FloqR in {native}?",
      "prompt.yes": "Sì, passa a {native}",
      "prompt.no": "Mantieni l'inglese",
      "prompt.later": "Chiedi dopo",
      "mingl.matchReason": "Corrispondenza su interessi condivisi",
      "mingl.matchReasonCount": "Corrispondenza su {n} aree di interesse",
      "bartr.categoryTemplate": "Modello layout venditore"
    },
    pt: {
      "app.welcome": "Bem-vindo",
      "app.continue": "Continuar",
      "app.signOut": "Sair",
      "app.signIn": "Entre ou cadastre-se:",
      "app.search": "Pesquisar",
      "app.back": "Voltar",
      "app.save": "Salvar",
      "app.language": "Idioma",
      "app.languageSettings": "Idioma do app",
      "app.languageHint": "Escolha o idioma dos menus FloqR.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Meu perfil",
      "nav.settings": "Configurações",
      "nav.inbox": "Caixa de entrada",
      "prompt.title": "Usar o seu idioma?",
      "prompt.body": "Seu dispositivo prefere {lang}. Quer o FloqR em {native}?",
      "prompt.yes": "Sim, mudar para {native}",
      "prompt.no": "Manter inglês",
      "prompt.later": "Perguntar depois",
      "mingl.matchReason": "Correspondência por interesses compartilhados",
      "mingl.matchReasonCount": "Correspondência em {n} áreas de interesse",
      "bartr.categoryTemplate": "Modelo de layout do vendedor"
    },
    ru: {
      "app.welcome": "Добро пожаловать",
      "app.continue": "Продолжить",
      "app.signOut": "Выйти",
      "app.signIn": "Войдите или зарегистрируйтесь:",
      "app.search": "Поиск",
      "app.back": "Назад",
      "app.save": "Сохранить",
      "app.language": "Язык",
      "app.languageSettings": "Язык приложения",
      "app.languageHint": "Выберите язык меню FloqR.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Мой профиль",
      "nav.settings": "Настройки",
      "nav.inbox": "Входящие",
      "prompt.title": "Использовать ваш язык?",
      "prompt.body": "Устройство предпочитает {lang}. Открыть FloqR на {native}?",
      "prompt.yes": "Да, переключить на {native}",
      "prompt.no": "Оставить английский",
      "prompt.later": "Спросить позже",
      "mingl.matchReason": "Совпадение по общим интересам",
      "mingl.matchReasonCount": "Совпадение по {n} областям интересов",
      "bartr.categoryTemplate": "Шаблон витрины продавца"
    },
    el: {
      "app.welcome": "Καλώς ήρθατε",
      "app.continue": "Συνέχεια",
      "app.signOut": "Αποσύνδεση",
      "app.signIn": "Συνδεθείτε ή εγγραφείτε:",
      "app.search": "Αναζήτηση",
      "app.back": "Πίσω",
      "app.save": "Αποθήκευση",
      "app.language": "Γλώσσα",
      "app.languageSettings": "Γλώσσα εφαρμογής",
      "app.languageHint": "Επιλέξτε τη γλώσσα των μενού FloqR.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Το προφίλ μου",
      "nav.settings": "Ρυθμίσεις",
      "nav.inbox": "Εισερχόμενα",
      "prompt.title": "Χρήση της γλώσσας σας;",
      "prompt.body": "Η συσκευή προτιμά {lang}. Θέλετε FloqR στα {native};",
      "prompt.yes": "Ναι, αλλαγή σε {native}",
      "prompt.no": "Διατήρηση Αγγλικών",
      "prompt.later": "Ρώτα αργότερα",
      "mingl.matchReason": "Αντιστοιχία σε κοινά ενδιαφέροντα",
      "mingl.matchReasonCount": "Αντιστοιχία σε {n} τομείς ενδιαφέροντος",
      "bartr.categoryTemplate": "Πρότυπο διάταξης πωλητή"
    },
    pl: {
      "app.welcome": "Witamy",
      "app.continue": "Kontynuuj",
      "app.signOut": "Wyloguj",
      "app.signIn": "Zaloguj się lub zarejestruj:",
      "app.search": "Szukaj",
      "app.back": "Wstecz",
      "app.save": "Zapisz",
      "app.language": "Język",
      "app.languageSettings": "Język aplikacji",
      "app.languageHint": "Wybierz język menu FloqR.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Mój profil",
      "nav.settings": "Ustawienia",
      "nav.inbox": "Skrzynka",
      "prompt.title": "Użyć Twojego języka?",
      "prompt.body": "Urządzenie preferuje {lang}. Chcesz FloqR w języku {native}?",
      "prompt.yes": "Tak, przełącz na {native}",
      "prompt.no": "Zostaw angielski",
      "prompt.later": "Zapytaj później",
      "mingl.matchReason": "Dopasowanie po wspólnych zainteresowaniach",
      "mingl.matchReasonCount": "Dopasowanie w {n} obszarach zainteresowań",
      "bartr.categoryTemplate": "Szablon układu sprzedawcy"
    },
    nl: {
      "app.welcome": "Welkom",
      "app.continue": "Doorgaan",
      "app.signOut": "Uitloggen",
      "app.signIn": "Log in of maak een account:",
      "app.search": "Zoeken",
      "app.back": "Terug",
      "app.save": "Opslaan",
      "app.language": "Taal",
      "app.languageSettings": "App-taal",
      "app.languageHint": "Kies de taal voor FloqR-menu's en schermen.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "Mijn profiel",
      "nav.settings": "Instellingen",
      "nav.inbox": "Inbox",
      "prompt.title": "Jouw taal gebruiken?",
      "prompt.body": "Je apparaat geeft de voorkeur aan {lang}. FloqR openen in het {native}?",
      "prompt.yes": "Ja, schakel over naar {native}",
      "prompt.no": "Engels houden",
      "prompt.later": "Later vragen",
      "mingl.matchReason": "Overeenkomst op gedeelde interesses",
      "mingl.matchReasonCount": "Overeenkomst op {n} interessegebieden",
      "bartr.categoryTemplate": "Verkoper-lay-outsjabloon"
    },
    ar: {
      "app.welcome": "مرحباً",
      "app.continue": "متابعة",
      "app.signOut": "تسجيل الخروج",
      "app.signIn": "يرجى تسجيل الدخول أو إنشاء حساب:",
      "app.search": "بحث",
      "app.back": "رجوع",
      "app.save": "حفظ",
      "app.language": "اللغة",
      "app.languageSettings": "لغة التطبيق",
      "app.languageHint": "اختر لغة قوائم FloqR.",
      "nav.mingl": "Mingl",
      "nav.bartr": "BartR",
      "nav.shoutout": "ShoutOut",
      "nav.profile": "ملفي",
      "nav.settings": "الإعدادات",
      "nav.inbox": "الوارد",
      "prompt.title": "استخدام لغتك؟",
      "prompt.body": "جهازك يفضّل {lang}. هل تريد FloqR بـ {native}؟",
      "prompt.yes": "نعم، التبديل إلى {native}",
      "prompt.no": "الإبقاء على الإنجليزية",
      "prompt.later": "اسأل لاحقاً",
      "mingl.matchReason": "تطابق في اهتمامات مشتركة",
      "mingl.matchReasonCount": "تطابق في {n} مجالات اهتمام",
      "bartr.categoryTemplate": "قالب تخطيط البائع"
    }
  };

  const CHROME = {
    en: {
      "portal.title": "My Profile and Settings",
      "portal.subtitle": "Manage your profile, My Privacy, AI notifications, ShoutOut templates, public media, ShoutOuts, guest lists, FloqR Inbox, and Mingl.",
      "portal.signInTitle": "Sign in",
      "portal.signInHint": "Sign in to view and update your patron profile.",
      "nav.overview": "Overview",
      "nav.myProfile": "My Profile",
      "nav.myPrivacy": "My Privacy",
      "nav.languageSettings": "Language Settings",
      "nav.aiNotifications": "AI Notification Preferences",
      "nav.myTemplates": "My ShoutOut Templates",
      "nav.publicMedia": "Public Media and Data Sharing",
      "nav.myShoutouts": "My ShoutOuts",
      "nav.guestLists": "My Guest Lists",
      "nav.paidServices": "Paid Services & Orders",
      "nav.bartrStore": "BartR Store",
      "nav.inbox": "FloqR Inbox",
      "nav.minglFriends": "Manage Mingl Friends",
      "nav.minglChat": "Mingl Chat",
      "nav.followServices": "Follow Services",
      "nav.openBartr": "Open BartR",
      "nav.workCalendar": "Work Calendar",
      "nav.serviceMembers": "Service Members",
      "nav.help": "Help",
      "nav.backToSearch": "Back to Search",
      "lang.pageTitle": "Language Settings",
      "lang.pageHint": "Control profile-wide grammar and spelling help for chats, messages, ShoutOut text, profile updates, and future BartR descriptions.",
      "lang.enableGrammar": "Enable grammar and spelling check before sending messages, chats, ShoutOuts, profile updates, and other text inputs.",
      "lang.correctionMode": "Correction Mode",
      "lang.suggestionsOnly": "Show suggestions only",
      "lang.approvalRequired": "Require approval before replacing my text",
      "lang.autoFixMinor": "Auto-fix minor typos only",
      "lang.webappLanguage": "FloqR webapp language",
      "lang.languageSaved": "FloqR language set to {native}.",
      "lang.highlightSpelling": "Highlight possible spelling errors in red before correction",
      "lang.highlightGrammar": "Highlight grammar suggestions in yellow or underline",
      "lang.preferredGrammar": "Preferred Language (grammar / bio)",
      "lang.tone": "Tone Preference",
      "lang.emojiSkin": "Emoji Skin Tone",
      "lang.wordList": "My Word List",
      "lang.personalCorrections": "My Personal Corrections",
      "lang.saveLanguageSettings": "Save Language Settings",
      "app.loginCopy": "Search and book entertainment and nightlife events worldwide or send a live ShoutOut to one of our ShoutOut displays or Mingl with new people, friends, and family.",
      "app.google": "Continue with Google",
      "app.microsoft": "Continue with Microsoft",
      "app.facebook": "Continue with Facebook",
      "app.emailContinue": "Continue with your own Email",
      "nav.searchFor": "Search for",
      "cat.events": "Events",
      "cat.clubs": "Clubs",
      "cat.beachClubs": "Beach Clubs",
      "cat.lounges": "Lounges",
      "cat.loungeClubs": "Lounge-Clubs",
      "cat.or": "Or",
      "cat.shoutout": "Throw a ShoutOut",
      "cat.mingl": "Mingl",
      "cat.bartr": "Trade by BartR",
      "cat.rydr": "RydR",
      "cat.suprstar": "supRstar",
      "cat.floqai": "FloqAi",
      "listing.searchClubs": "Search Clubs",
      "admin.dashboard": "Dashboard",
      "admin.displaySecurity": "Display Security",
      "admin.publicProfile": "Club Public Profile",
      "admin.templateBackgrounds": "Template Backgrounds",
      "admin.queue": "ShoutOut Queue",
      "admin.suprstarQueue": "supRstar Queue",
      "admin.analytics": "Analytics",
      "admin.advertising": "Advertising",
      "admin.guestLists": "Guest Lists / Promoters",
      "admin.employees": "Employee/Workers",
      "admin.scheduling": "Calendar & Scheduler",
      "admin.rep": "Role Activity & Permission (REP)",
      "admin.notifications": "Notifications",
      "admin.reconciliation": "Account Reconciliation",
      "admin.reports": "Reports",
      "admin.venueCommand": "Venue Command Center",
      "master.networkDashboard": "Network Dashboard",
      "master.entityManagement": "Entity Management",
      "master.venueLinks": "Venue Links",
      "master.manageEntities": "Manage Entities",
      "master.allQueues": "All ShoutOut Queues",
      "master.onboarding": "Entity Onboarding",
      "master.templates": "Template Management",
      "master.recommendations": "Unapproved Recommendations",
      "master.security": "Security",
      "master.reports": "Reports",
      "master.adCampaigns": "Ad Campaign Management",
      "master.promoters": "Promoters",
      "master.reconciliation": "Network Reconciliation",
      "master.services": "Services & Commerce",
      "master.diagnostics": "Diagnostics"
    },
    fr: {
      "portal.title": "Mon profil et paramètres",
      "portal.subtitle": "Gérez votre profil, Ma confidentialité, les notifications IA, les modèles ShoutOut, les médias publics, les ShoutOuts, les guest lists, FloqR Inbox et Mingl.",
      "portal.signInTitle": "Connexion",
      "portal.signInHint": "Connectez-vous pour voir et modifier votre profil.",
      "nav.overview": "Aperçu",
      "nav.myProfile": "Mon profil",
      "nav.myPrivacy": "Ma confidentialité",
      "nav.languageSettings": "Paramètres de langue",
      "nav.aiNotifications": "Préférences de notification IA",
      "nav.myTemplates": "Mes modèles ShoutOut",
      "nav.publicMedia": "Médias publics et partage",
      "nav.myShoutouts": "Mes ShoutOuts",
      "nav.guestLists": "Mes guest lists",
      "nav.paidServices": "Services payants et commandes",
      "nav.bartrStore": "Boutique BartR",
      "nav.inbox": "Boîte de réception FloqR",
      "nav.minglFriends": "Gérer les amis Mingl",
      "nav.minglChat": "Mingl Chat",
      "nav.followServices": "Suivre les services",
      "nav.openBartr": "Ouvrir BartR",
      "nav.workCalendar": "Calendrier de travail",
      "nav.serviceMembers": "Membres de service",
      "nav.help": "Aide",
      "nav.backToSearch": "Retour à la recherche",
      "lang.pageTitle": "Paramètres de langue",
      "lang.pageHint": "Contrôlez la grammaire et l'orthographe pour les chats, messages, ShoutOuts, le profil et BartR.",
      "lang.enableGrammar": "Activer la vérification grammaticale et orthographique avant d'envoyer des messages, chats, ShoutOuts, mises à jour de profil et autres textes.",
      "lang.correctionMode": "Mode de correction",
      "lang.suggestionsOnly": "Afficher uniquement les suggestions",
      "lang.approvalRequired": "Demander une approbation avant de remplacer mon texte",
      "lang.autoFixMinor": "Corriger uniquement les fautes mineures",
      "lang.webappLanguage": "Langue de l'application FloqR",
      "lang.languageSaved": "Langue FloqR définie sur {native}.",
      "lang.highlightSpelling": "Surligner les fautes d'orthographe possibles en rouge avant correction",
      "lang.highlightGrammar": "Surligner les suggestions grammaticales en jaune ou les souligner",
      "lang.preferredGrammar": "Langue préférée (grammaire / bio)",
      "lang.tone": "Ton",
      "lang.emojiSkin": "Teinte d'emoji",
      "lang.wordList": "Ma liste de mots",
      "lang.personalCorrections": "Mes corrections personnelles",
      "lang.saveLanguageSettings": "Enregistrer les paramètres de langue",
      "app.loginCopy": "Recherchez et réservez des sorties et événements dans le monde, envoyez un ShoutOut en direct, ou Mingl avec de nouvelles personnes, des amis et la famille.",
      "app.google": "Continuer avec Google",
      "app.microsoft": "Continuer avec Microsoft",
      "app.facebook": "Continuer avec Facebook",
      "app.emailContinue": "Continuer avec votre e-mail",
      "nav.searchFor": "Rechercher",
      "cat.events": "Événements",
      "cat.clubs": "Clubs",
      "cat.beachClubs": "Beach clubs",
      "cat.lounges": "Lounges",
      "cat.loungeClubs": "Lounge-clubs",
      "cat.or": "Ou",
      "cat.shoutout": "Lancer un ShoutOut",
      "cat.mingl": "Mingl",
      "cat.bartr": "Échanger sur BartR",
      "cat.rydr": "RydR",
      "cat.suprstar": "supRstar",
      "cat.floqai": "FloqAi",
      "listing.searchClubs": "Rechercher des clubs",
      "admin.dashboard": "Tableau de bord",
      "admin.displaySecurity": "Sécurité des écrans",
      "admin.publicProfile": "Profil public du club",
      "admin.templateBackgrounds": "Arrière-plans de modèles",
      "admin.queue": "File ShoutOut",
      "admin.suprstarQueue": "File supRstar",
      "admin.analytics": "Analytique",
      "admin.advertising": "Publicité",
      "admin.guestLists": "Guest lists / Promoteurs",
      "admin.employees": "Employés",
      "admin.scheduling": "Calendrier et planification",
      "admin.rep": "Activité et permission des rôles (REP)",
      "admin.notifications": "Notifications",
      "admin.reconciliation": "Rapprochement de compte",
      "admin.reports": "Rapports",
      "admin.venueCommand": "Centre de commande du lieu",
      "master.networkDashboard": "Tableau de bord réseau",
      "master.entityManagement": "Gestion des entités",
      "master.venueLinks": "Liens du lieu",
      "master.manageEntities": "Gérer les entités",
      "master.allQueues": "Toutes les files ShoutOut",
      "master.onboarding": "Onboarding des entités",
      "master.templates": "Gestion des modèles",
      "master.recommendations": "Recommandations non approuvées",
      "master.security": "Sécurité",
      "master.reports": "Rapports",
      "master.adCampaigns": "Campagnes publicitaires",
      "master.promoters": "Promoteurs",
      "master.reconciliation": "Rapprochement réseau",
      "master.services": "Services et commerce",
      "master.diagnostics": "Diagnostics"
    },
    de: {
      "portal.title": "Mein Profil und Einstellungen",
      "nav.overview": "Übersicht",
      "nav.myProfile": "Mein Profil",
      "nav.myPrivacy": "Meine Privatsphäre",
      "nav.languageSettings": "Spracheinstellungen",
      "nav.help": "Hilfe",
      "nav.backToSearch": "Zurück zur Suche",
      "lang.pageTitle": "Spracheinstellungen",
      "lang.suggestionsOnly": "Nur Vorschläge anzeigen",
      "lang.approvalRequired": "Genehmigung vor dem Ersetzen meines Texts",
      "lang.autoFixMinor": "Nur kleine Tippfehler automatisch korrigieren",
      "lang.webappLanguage": "FloqR-Webapp-Sprache",
      "lang.languageSaved": "FloqR-Sprache auf {native} gesetzt.",
      "nav.searchFor": "Suchen nach",
      "cat.events": "Events",
      "cat.clubs": "Clubs",
      "cat.shoutout": "ShoutOut senden",
      "admin.dashboard": "Dashboard",
      "admin.notifications": "Benachrichtigungen",
      "master.venueLinks": "Venue-Links",
      "master.entityManagement": "Entitätsverwaltung"
    },
    es: {
      "portal.title": "Mi perfil y ajustes",
      "nav.overview": "Resumen",
      "nav.myProfile": "Mi perfil",
      "nav.myPrivacy": "Mi privacidad",
      "nav.languageSettings": "Ajustes de idioma",
      "nav.help": "Ayuda",
      "nav.backToSearch": "Volver a buscar",
      "lang.pageTitle": "Ajustes de idioma",
      "lang.suggestionsOnly": "Mostrar solo sugerencias",
      "lang.approvalRequired": "Pedir aprobación antes de reemplazar mi texto",
      "lang.autoFixMinor": "Corregir solo errores menores",
      "lang.webappLanguage": "Idioma de la webapp FloqR",
      "lang.languageSaved": "Idioma de FloqR establecido en {native}.",
      "nav.searchFor": "Buscar",
      "cat.events": "Eventos",
      "cat.clubs": "Clubes",
      "cat.shoutout": "Lanzar un ShoutOut",
      "admin.dashboard": "Panel",
      "admin.notifications": "Notificaciones",
      "master.venueLinks": "Enlaces del local",
      "master.entityManagement": "Gestión de entidades"
    },
    nl: {
      "portal.title": "Mijn profiel en instellingen",
      "nav.overview": "Overzicht",
      "nav.myProfile": "Mijn profiel",
      "nav.myPrivacy": "Mijn privacy",
      "nav.languageSettings": "Taalinstellingen",
      "nav.help": "Help",
      "nav.backToSearch": "Terug naar zoeken",
      "lang.pageTitle": "Taalinstellingen",
      "lang.suggestionsOnly": "Alleen suggesties tonen",
      "lang.approvalRequired": "Goedkeuring vragen voordat mijn tekst wordt vervangen",
      "lang.autoFixMinor": "Alleen kleine typfouten automatisch herstellen",
      "lang.webappLanguage": "FloqR-webapp-taal",
      "lang.languageSaved": "FloqR-taal ingesteld op {native}.",
      "nav.searchFor": "Zoeken naar",
      "cat.events": "Evenementen",
      "cat.clubs": "Clubs",
      "cat.shoutout": "Een ShoutOut sturen",
      "admin.dashboard": "Dashboard",
      "admin.notifications": "Meldingen",
      "master.venueLinks": "Venue-links",
      "master.entityManagement": "Entiteitenbeheer"
    }
  };

  Object.keys(CHROME).forEach(lang => {
    STRINGS[lang] = {...(STRINGS[lang] || {}), ...CHROME[lang]};
  });

  let current = "en";
  let overrides = {};

  function normalizeCode(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw || raw === "auto") return "";
    const short = raw.split("-")[0];
    return SUPPORTED.some(x => x.code === short) ? short : "";
  }

  function meta(code) {
    return SUPPORTED.find(x => x.code === code) || SUPPORTED[0];
  }

  function browserPreferred() {
    const list = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || "en"];
    for (const item of list) {
      const code = normalizeCode(item);
      if (code) return code;
    }
    return "en";
  }

  function storedLanguage() {
    try { return normalizeCode(localStorage.getItem(STORAGE_KEY)); } catch (_) { return ""; }
  }

  function promptDone() {
    try { return localStorage.getItem(PROMPT_KEY) === "1"; } catch (_) { return false; }
  }

  function markPromptDone() {
    try { localStorage.setItem(PROMPT_KEY, "1"); } catch (_) {}
  }

  function t(key, vars = {}) {
    const pack = STRINGS[current] || STRINGS.en;
    const overridePack = overrides[current] || {};
    let text = overridePack[key] || pack[key] || STRINGS.en[key] || key;
    Object.keys(vars).forEach(name => {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(vars[name]));
    });
    return text;
  }

  function applyText(el, value) {
    const attr = el.getAttribute("data-i18n-attr");
    if (attr) {
      el.setAttribute(attr, value);
      return;
    }
    const host = el.querySelector(":scope > .help-label-text, :scope > .i18n-text");
    if (host) {
      host.textContent = value;
      return;
    }
    const hasElementChildren = [...el.childNodes].some(n => n.nodeType === 1);
    if (hasElementChildren) {
      const textNode = [...el.childNodes].find(n => n.nodeType === 3 && String(n.textContent || "").trim());
      if (textNode) {
        const lead = textNode.textContent.match(/^\s*/)[0] || "";
        const trail = textNode.textContent.match(/\s*$/)[0] || "";
        textNode.textContent = `${lead}${value}${trail}`;
        return;
      }
    }
    el.textContent = value;
  }

  function applyDom(root = document) {
    root.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      applyText(el, t(key));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });
    const titleKey = document.documentElement.getAttribute("data-i18n-title")
      || document.querySelector("title[data-i18n]")?.getAttribute("data-i18n");
    if (titleKey) document.title = t(titleKey);
    const info = meta(current);
    document.documentElement.lang = current;
    document.documentElement.dir = info.dir;
    document.body?.setAttribute("data-ui-lang", current);
    document.body?.setAttribute("dir", info.dir);
  }

  async function persistToUser(code) {
    try {
      const user = global.firebase?.auth?.()?.currentUser;
      if (!user) return;
      await global.firebase.firestore().collection("users").doc(user.uid).set({
        uiLanguage: code,
        uiLanguageUpdatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
    } catch (_) {}
  }

  async function setLanguage(code, {persist = true, markPrompt = true} = {}) {
    const next = normalizeCode(code) || "en";
    current = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    if (markPrompt) markPromptDone();
    applyDom();
    if (persist) await persistToUser(next);
    global.dispatchEvent(new CustomEvent("floqr:ui-language", {detail: {code: next}}));
    return next;
  }

  async function loadOverrides() {
    try {
      if (!global.firebase?.firestore) return;
      const snap = await global.firebase.firestore().collection("translationOverrides").limit(40).get();
      const map = {};
      snap.forEach(doc => {
        const data = doc.data() || {};
        const lang = normalizeCode(doc.id) || normalizeCode(data.lang);
        if (!lang) return;
        map[lang] = {...(map[lang] || {}), ...(data.strings || {})};
      });
      overrides = map;
    } catch (_) {}
  }

  function ensurePromptStyles() {
    if (document.getElementById("floqrI18nPromptStyle")) return;
    const style = document.createElement("style");
    style.id = "floqrI18nPromptStyle";
    style.textContent = `
      .floqr-lang-prompt{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:18px;background:rgba(4,8,20,.72)}
      .floqr-lang-prompt-card{width:min(440px,100%);padding:22px;border-radius:20px;border:1px solid rgba(255,255,255,.16);background:#101937;color:#fff;display:grid;gap:12px}
      .floqr-lang-prompt-card h2{margin:0;font-size:1.35rem}
      .floqr-lang-prompt-card p{margin:0;color:rgba(255,255,255,.82)}
      .floqr-lang-prompt-actions{display:flex;flex-wrap:wrap;gap:8px}
      .floqr-lang-prompt-actions button{flex:1 1 140px}
      body[dir="rtl"] .floqr-lang-prompt-card{text-align:right}
    `;
    document.head.appendChild(style);
  }

  function showLanguagePrompt(suggested) {
    if (document.getElementById("floqrLangPrompt")) return;
    ensurePromptStyles();
    const info = meta(suggested);
    const wrap = document.createElement("div");
    wrap.id = "floqrLangPrompt";
    wrap.className = "floqr-lang-prompt";
    wrap.innerHTML = `
      <div class="floqr-lang-prompt-card" role="dialog" aria-modal="true" aria-labelledby="floqrLangPromptTitle">
        <h2 id="floqrLangPromptTitle">${t("prompt.title")}</h2>
        <p>${t("prompt.body", {lang: info.label, native: info.native})}</p>
        <div class="floqr-lang-prompt-actions">
          <button type="button" class="primary" data-lang-choice="yes">${t("prompt.yes", {native: info.native})}</button>
          <button type="button" data-lang-choice="no">${t("prompt.no")}</button>
          <button type="button" class="ghost" data-lang-choice="later">${t("prompt.later")}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", async event => {
      const choice = event.target?.getAttribute?.("data-lang-choice");
      if (!choice) return;
      if (choice === "yes") await setLanguage(suggested, {persist: true, markPrompt: true});
      else if (choice === "no") await setLanguage("en", {persist: true, markPrompt: true});
      else markPromptDone();
      wrap.remove();
    });
  }

  /**
   * First use: adopt the browser language when supported, otherwise English.
   * Returning patrons with a profile language keep that choice (wins over this-device localStorage).
   * Returning patrons with no saved UI language are asked once if the browser is not English.
   */
  async function maybePromptReturningPatron(profile = {}) {
    const fromProfile = normalizeCode(profile.uiLanguage);
    const saved = storedLanguage();
    if (fromProfile) {
      await setLanguage(fromProfile, {persist: false, markPrompt: true});
      return;
    }
    if (saved) {
      await setLanguage(saved, {persist: true, markPrompt: true});
      return;
    }
    const preferred = normalizeCode(profile.languageSettings?.preferredLanguage || profile.preferredLanguage);
    const browser = browserPreferred();
    const suggested = (preferred && preferred !== "en" ? preferred : "") || browser;
    const firstUse = !promptDone() && !profile.createdAt && !profile.profileCompleted;
    if (firstUse || !suggested || suggested === "en") {
      await setLanguage(suggested || "en", {persist: true, markPrompt: true});
      return;
    }
    const onboarded = !!(profile.uid || profile.email || profile.memberLevel || profile.createdAt);
    if (!onboarded) {
      await setLanguage(suggested, {persist: true, markPrompt: true});
      return;
    }
    showLanguagePrompt(suggested);
  }

  function languageOptionsHtml(selected = "en") {
    return SUPPORTED.map(x =>
      `<option value="${x.code}" ${x.code === selected ? "selected" : ""}>${x.native} (${x.label})</option>`
    ).join("");
  }

  async function init(profile = {}) {
    await loadOverrides();
    const fromProfile = normalizeCode(profile.uiLanguage);
    const saved = storedLanguage();
    if (fromProfile) {
      current = fromProfile;
      try { localStorage.setItem(STORAGE_KEY, current); } catch (_) {}
      applyDom();
      return current;
    }
    if (saved) {
      current = saved;
      applyDom();
      persistToUser(saved);
      return current;
    }
    current = browserPreferred() || "en";
    try { localStorage.setItem(STORAGE_KEY, current); } catch (_) {}
    applyDom();
    persistToUser(current);
    return current;
  }

  global.FLOQRI18n = {
    VERSION,
    SUPPORTED,
    STRINGS,
    t,
    meta,
    normalizeCode,
    browserPreferred,
    getLanguage: () => current,
    setLanguage,
    applyDom,
    init,
    maybePromptReturningPatron,
    languageOptionsHtml,
    loadOverrides,
    markPromptDone
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init({}).then(() => applyDom()).catch(() => {});
    });
  } else {
    init({}).then(() => applyDom()).catch(() => {});
  }
})(typeof window !== "undefined" ? window : globalThis);
