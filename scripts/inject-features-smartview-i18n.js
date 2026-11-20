#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const CHROME = {
  en: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Evidence-backed product features. Plans are not treated as shipped.",
    "fsv.tabOverview": "Overview",
    "fsv.tabWhatsNew": "What's New",
    "fsv.tabJourney": "Feature Journey",
    "fsv.tabAll": "All Features",
    "fsv.tabComingSoon": "Coming Soon",
    "fsv.tabPast": "Past/Retired",
    "fsv.dateImplemented": "Date implemented",
    "fsv.dateNotVerified": "Not verified",
    "fsv.mergedOn": "Merged on",
    "fsv.availableSince": "Available since",
    "fsv.tryFeature": "Try feature",
    "fsv.viewJourney": "View journey",
    "fsv.readChanges": "Read changes",
    "fsv.askBotDee": "Ask BOT DEE",
    "fsv.close": "Close",
    "fsv.search": "Search features",
    "fsv.filterProduct": "All products",
    "fsv.filterLifecycle": "Lifecycle",
    "fsv.filterAll": "All statuses",
    "fsv.emptyWhatsNew": "What's New lists only approved, verified releases. None are published yet.",
    "fsv.emptyComingSoon": "No approved planned work is listed. Dates are not invented.",
    "fsv.emptyPast": "No deprecated or retired features are listed.",
    "fsv.emptyAll": "No catalog features match.",
    "fsv.latestRelease": "Latest verified release",
    "fsv.featureCount": "{n} catalog features",
    "fsv.accomplishment": "What it accomplishes",
    "fsv.before": "Before",
    "fsv.now": "Now / target",
    "fsv.why": "Why it matters",
    "fsv.audience": "Audience",
    "fsv.switchProduct": "Product",
    "fsv.citation": "Catalog",
    "fsv.notAvailable": "Not in this repository. No Try action.",
    "fsv.compactMore": "View details",
    "fsv.noTry": "Try is hidden until this feature is available to you.",
    "fsv.signInHint": "Sign in on Search / My Profile to open Features SMARTview. This page reuses your FloqR session — there is no second signup.",
    "fsv.replyUnverified": "Feature status is not verified from live availability evidence. I will not treat a plan as shipped.",
    "fsv.replyOk": "Here is the published Features SMARTview.",
    "fsv.showMaster": "Show Features SMARTview",
    "fsv.editorialHint": "Patron What's New stays empty until a Master Admin approves verified release copy. Do not merge this as a live announcement.",
    "fsv.warning": "Packaged catalog only. Live flags and availability dates are not verified.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  fr: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Fonctionnalités produits étayées par des preuves. Les plans ne sont pas traités comme livrés.",
    "fsv.tabOverview": "Aperçu",
    "fsv.tabWhatsNew": "Nouveautés",
    "fsv.tabJourney": "Parcours de la fonction",
    "fsv.tabAll": "Toutes les fonctions",
    "fsv.tabComingSoon": "Bientôt",
    "fsv.tabPast": "Passé / retiré",
    "fsv.dateImplemented": "Date de mise en œuvre",
    "fsv.dateNotVerified": "Non vérifié",
    "fsv.mergedOn": "Fusionné le",
    "fsv.availableSince": "Disponible depuis",
    "fsv.tryFeature": "Essayer la fonction",
    "fsv.viewJourney": "Voir le parcours",
    "fsv.readChanges": "Lire les changements",
    "fsv.askBotDee": "Demander à BOT DEE",
    "fsv.close": "Fermer",
    "fsv.search": "Rechercher des fonctions",
    "fsv.filterProduct": "Tous les produits",
    "fsv.filterLifecycle": "Cycle de vie",
    "fsv.filterAll": "Tous les statuts",
    "fsv.emptyWhatsNew": "Nouveautés n’affiche que des versions approuvées et vérifiées. Aucune n’est publiée pour l’instant.",
    "fsv.emptyComingSoon": "Aucun travail planifié approuvé n’est listé. Les dates ne sont pas inventées.",
    "fsv.emptyPast": "Aucune fonction dépréciée ou retirée n’est listée.",
    "fsv.emptyAll": "Aucune fonction du catalogue ne correspond.",
    "fsv.latestRelease": "Dernière version vérifiée",
    "fsv.featureCount": "{n} fonctions du catalogue",
    "fsv.accomplishment": "Ce qu’elle accomplit",
    "fsv.before": "Avant",
    "fsv.now": "Maintenant / cible",
    "fsv.why": "Pourquoi c’est important",
    "fsv.audience": "Public",
    "fsv.switchProduct": "Produit",
    "fsv.citation": "Catalogue",
    "fsv.notAvailable": "Absent de ce dépôt. Pas d’action Essayer.",
    "fsv.compactMore": "Voir les détails",
    "fsv.noTry": "Essayer reste masqué tant que cette fonction ne vous est pas disponible.",
    "fsv.signInHint": "Connectez-vous sur Recherche / Mon profil pour ouvrir Features SMARTview. Cette page réutilise votre session FloqR — pas de second compte.",
    "fsv.replyUnverified": "Le statut de la fonction n’est pas vérifié par une preuve de disponibilité en direct. Je ne traiterai pas un plan comme livré.",
    "fsv.replyOk": "Voici le Features SMARTview publié.",
    "fsv.showMaster": "Afficher Features SMARTview",
    "fsv.editorialHint": "Les Nouveautés patrons restent vides jusqu’à ce qu’un Master Admin approuve une copie de version vérifiée. Ne fusionnez pas ceci comme une annonce en direct.",
    "fsv.warning": "Catalogue empaqueté seulement. Les flags live et les dates de disponibilité ne sont pas vérifiés.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planifié",
    "fsv.lifecycle.in_development": "En développement",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  de: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Evidenzgestützte Produktfunktionen. Pläne gelten nicht als ausgeliefert.",
    "fsv.tabOverview": "Überblick",
    "fsv.tabWhatsNew": "Neuigkeiten",
    "fsv.tabJourney": "Feature-Reise",
    "fsv.tabAll": "Alle Features",
    "fsv.tabComingSoon": "Demnächst",
    "fsv.tabPast": "Vergangen / Retired",
    "fsv.dateImplemented": "Umsetzungsdatum",
    "fsv.dateNotVerified": "Nicht verifiziert",
    "fsv.mergedOn": "Zusammengeführt am",
    "fsv.availableSince": "Verfügbar seit",
    "fsv.tryFeature": "Feature ausprobieren",
    "fsv.viewJourney": "Reise ansehen",
    "fsv.readChanges": "Änderungen lesen",
    "fsv.askBotDee": "BOT DEE fragen",
    "fsv.close": "Schließen",
    "fsv.search": "Features suchen",
    "fsv.filterProduct": "Alle Produkte",
    "fsv.filterLifecycle": "Lebenszyklus",
    "fsv.filterAll": "Alle Status",
    "fsv.emptyWhatsNew": "Neuigkeiten listet nur freigegebene, verifizierte Releases. Noch keines ist veröffentlicht.",
    "fsv.emptyComingSoon": "Keine freigegebene geplante Arbeit. Daten werden nicht erfunden.",
    "fsv.emptyPast": "Keine deprecated oder retired Features gelistet.",
    "fsv.emptyAll": "Keine Katalog-Features passen.",
    "fsv.latestRelease": "Letztes verifiziertes Release",
    "fsv.featureCount": "{n} Katalog-Features",
    "fsv.accomplishment": "Was es leistet",
    "fsv.before": "Vorher",
    "fsv.now": "Jetzt / Ziel",
    "fsv.why": "Warum es zählt",
    "fsv.audience": "Zielgruppe",
    "fsv.switchProduct": "Produkt",
    "fsv.citation": "Katalog",
    "fsv.notAvailable": "Nicht in diesem Repository. Keine Try-Aktion.",
    "fsv.compactMore": "Details ansehen",
    "fsv.noTry": "Try bleibt verborgen, bis dieses Feature für dich verfügbar ist.",
    "fsv.signInHint": "Melde dich in Suche / Mein Profil an, um Features SMARTview zu öffnen. Diese Seite nutzt deine FloqR-Sitzung — keine zweite Anmeldung.",
    "fsv.replyUnverified": "Der Feature-Status ist nicht durch Live-Verfügbarkeit belegt. Ich behandle einen Plan nicht als ausgeliefert.",
    "fsv.replyOk": "Hier ist das veröffentlichte Features SMARTview.",
    "fsv.showMaster": "Features SMARTview zeigen",
    "fsv.editorialHint": "Patron-Neuigkeiten bleiben leer, bis ein Master Admin geprüften Release-Text freigibt. Nicht als Live-Ankündigung mergen.",
    "fsv.warning": "Nur gepackter Katalog. Live-Flags und Verfügbarkeitsdaten sind nicht verifiziert.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  es: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Funciones de producto con evidencia. Los planes no se tratan como entregados.",
    "fsv.tabOverview": "Resumen",
    "fsv.tabWhatsNew": "Novedades",
    "fsv.tabJourney": "Recorrido de la función",
    "fsv.tabAll": "Todas las funciones",
    "fsv.tabComingSoon": "Próximamente",
    "fsv.tabPast": "Pasado / Retired",
    "fsv.dateImplemented": "Fecha de implementación",
    "fsv.dateNotVerified": "No verificado",
    "fsv.mergedOn": "Fusionado el",
    "fsv.availableSince": "Disponible desde",
    "fsv.tryFeature": "Probar función",
    "fsv.viewJourney": "Ver recorrido",
    "fsv.readChanges": "Leer cambios",
    "fsv.askBotDee": "Preguntar a BOT DEE",
    "fsv.close": "Cerrar",
    "fsv.search": "Buscar funciones",
    "fsv.filterProduct": "Todos los productos",
    "fsv.filterLifecycle": "Ciclo de vida",
    "fsv.filterAll": "Todos los estados",
    "fsv.emptyWhatsNew": "Novedades solo lista versiones aprobadas y verificadas. Aún no hay ninguna publicada.",
    "fsv.emptyComingSoon": "No hay trabajo planificado aprobado. No se inventan fechas.",
    "fsv.emptyPast": "No hay funciones deprecated o retired listadas.",
    "fsv.emptyAll": "Ninguna función del catálogo coincide.",
    "fsv.latestRelease": "Última versión verificada",
    "fsv.featureCount": "{n} funciones del catálogo",
    "fsv.accomplishment": "Qué logra",
    "fsv.before": "Antes",
    "fsv.now": "Ahora / objetivo",
    "fsv.why": "Por qué importa",
    "fsv.audience": "Audiencia",
    "fsv.switchProduct": "Producto",
    "fsv.citation": "Catálogo",
    "fsv.notAvailable": "No está en este repositorio. Sin acción Probar.",
    "fsv.compactMore": "Ver detalles",
    "fsv.noTry": "Probar permanece oculto hasta que esta función esté disponible para ti.",
    "fsv.signInHint": "Inicia sesión en Búsqueda / Mi perfil para abrir Features SMARTview. Esta página reutiliza tu sesión FloqR — no hay un segundo registro.",
    "fsv.replyUnverified": "El estado de la función no está verificado con evidencia de disponibilidad en vivo. No trataré un plan como entregado.",
    "fsv.replyOk": "Aquí está el Features SMARTview publicado.",
    "fsv.showMaster": "Mostrar Features SMARTview",
    "fsv.editorialHint": "Las Novedades de patron quedan vacías hasta que un Master Admin apruebe copia de versión verificada. No fusionar esto como anuncio en vivo.",
    "fsv.warning": "Solo catálogo empaquetado. Los flags en vivo y las fechas de disponibilidad no están verificados.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  nl: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Productfuncties met bewijs. Plannen gelden niet als geleverd.",
    "fsv.tabOverview": "Overzicht",
    "fsv.tabWhatsNew": "Nieuw",
    "fsv.tabJourney": "Feature-reis",
    "fsv.tabAll": "Alle features",
    "fsv.tabComingSoon": "Binnenkort",
    "fsv.tabPast": "Verleden / Retired",
    "fsv.dateImplemented": "Datum geïmplementeerd",
    "fsv.dateNotVerified": "Niet geverifieerd",
    "fsv.mergedOn": "Gemerged op",
    "fsv.availableSince": "Beschikbaar sinds",
    "fsv.tryFeature": "Feature proberen",
    "fsv.viewJourney": "Reis bekijken",
    "fsv.readChanges": "Wijzigingen lezen",
    "fsv.askBotDee": "Vraag BOT DEE",
    "fsv.close": "Sluiten",
    "fsv.search": "Features zoeken",
    "fsv.filterProduct": "Alle producten",
    "fsv.filterLifecycle": "Levenscyclus",
    "fsv.filterAll": "Alle statussen",
    "fsv.emptyWhatsNew": "Nieuw toont alleen goedgekeurde, geverifieerde releases. Er is er nog geen gepubliceerd.",
    "fsv.emptyComingSoon": "Geen goedgekeurd gepland werk. Datums worden niet verzonnen.",
    "fsv.emptyPast": "Geen deprecated of retired features vermeld.",
    "fsv.emptyAll": "Geen catalogusfeatures komen overeen.",
    "fsv.latestRelease": "Laatste geverifieerde release",
    "fsv.featureCount": "{n} catalogusfeatures",
    "fsv.accomplishment": "Wat het doet",
    "fsv.before": "Voorheen",
    "fsv.now": "Nu / doel",
    "fsv.why": "Waarom het telt",
    "fsv.audience": "Publiek",
    "fsv.switchProduct": "Product",
    "fsv.citation": "Catalogus",
    "fsv.notAvailable": "Niet in deze repository. Geen Probeer-actie.",
    "fsv.compactMore": "Details bekijken",
    "fsv.noTry": "Proberen blijft verborgen tot deze feature voor jou beschikbaar is.",
    "fsv.signInHint": "Meld je aan via Zoeken / Mijn profiel om Features SMARTview te openen. Deze pagina hergebruikt je FloqR-sessie — geen tweede account.",
    "fsv.replyUnverified": "De featurestatus is niet geverifieerd met live-beschikbaarheidsbewijs. Ik behandel een plan niet als geleverd.",
    "fsv.replyOk": "Hier is het gepubliceerde Features SMARTview.",
    "fsv.showMaster": "Features SMARTview tonen",
    "fsv.editorialHint": "Patron-Nieuw blijft leeg tot een Master Admin geverifieerde releasekopie goedkeurt. Niet mergen als live-aankondiging.",
    "fsv.warning": "Alleen verpakte catalogus. Live flags en beschikbaarheidsdata zijn niet geverifieerd.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  ru: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Функции продукта с доказательствами. Планы не считаются выпущенными.",
    "fsv.tabOverview": "Обзор",
    "fsv.tabWhatsNew": "Что нового",
    "fsv.tabJourney": "Путь функции",
    "fsv.tabAll": "Все функции",
    "fsv.tabComingSoon": "Скоро",
    "fsv.tabPast": "Прошлое / Retired",
    "fsv.dateImplemented": "Дата внедрения",
    "fsv.dateNotVerified": "Не проверено",
    "fsv.mergedOn": "Слито",
    "fsv.availableSince": "Доступно с",
    "fsv.tryFeature": "Попробовать функцию",
    "fsv.viewJourney": "Смотреть путь",
    "fsv.readChanges": "Читать изменения",
    "fsv.askBotDee": "Спросить BOT DEE",
    "fsv.close": "Закрыть",
    "fsv.search": "Искать функции",
    "fsv.filterProduct": "Все продукты",
    "fsv.filterLifecycle": "Жизненный цикл",
    "fsv.filterAll": "Все статусы",
    "fsv.emptyWhatsNew": "«Что нового» показывает только одобренные и проверенные релизы. Пока ничего не опубликовано.",
    "fsv.emptyComingSoon": "Нет одобренной запланированной работы. Даты не выдумываются.",
    "fsv.emptyPast": "Нет deprecated или retired функций.",
    "fsv.emptyAll": "Нет совпадений в каталоге.",
    "fsv.latestRelease": "Последний проверенный релиз",
    "fsv.featureCount": "{n} функций каталога",
    "fsv.accomplishment": "Что даёт",
    "fsv.before": "Раньше",
    "fsv.now": "Сейчас / цель",
    "fsv.why": "Почему это важно",
    "fsv.audience": "Аудитория",
    "fsv.switchProduct": "Продукт",
    "fsv.citation": "Каталог",
    "fsv.notAvailable": "Нет в этом репозитории. Нет действия Попробовать.",
    "fsv.compactMore": "Подробности",
    "fsv.noTry": "Попробовать скрыто, пока функция вам недоступна.",
    "fsv.signInHint": "Войдите в Поиск / Мой профиль, чтобы открыть Features SMARTview. Страница использует сессию FloqR — второй вход не нужен.",
    "fsv.replyUnverified": "Статус функции не подтверждён доказательствами живой доступности. Я не считаю план выпущенным.",
    "fsv.replyOk": "Вот опубликованный Features SMARTview.",
    "fsv.showMaster": "Показать Features SMARTview",
    "fsv.editorialHint": "Patron «Что нового» пусто, пока Master Admin не одобрит проверенный текст релиза. Не сливать как живое объявление.",
    "fsv.warning": "Только упакованный каталог. Живые флаги и даты доступности не проверены.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  it: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Funzioni prodotto con evidenze. I piani non sono trattati come rilasciati.",
    "fsv.tabOverview": "Panoramica",
    "fsv.tabWhatsNew": "Novità",
    "fsv.tabJourney": "Percorso della funzione",
    "fsv.tabAll": "Tutte le funzioni",
    "fsv.tabComingSoon": "Prossimamente",
    "fsv.tabPast": "Passato / Retired",
    "fsv.dateImplemented": "Data di implementazione",
    "fsv.dateNotVerified": "Non verificato",
    "fsv.mergedOn": "Unito il",
    "fsv.availableSince": "Disponibile dal",
    "fsv.tryFeature": "Prova la funzione",
    "fsv.viewJourney": "Vedi il percorso",
    "fsv.readChanges": "Leggi le modifiche",
    "fsv.askBotDee": "Chiedi a BOT DEE",
    "fsv.close": "Chiudi",
    "fsv.search": "Cerca funzioni",
    "fsv.filterProduct": "Tutti i prodotti",
    "fsv.filterLifecycle": "Ciclo di vita",
    "fsv.filterAll": "Tutti gli stati",
    "fsv.emptyWhatsNew": "Novità elenca solo release approvate e verificate. Nessuna è ancora pubblicata.",
    "fsv.emptyComingSoon": "Nessun lavoro pianificato approvato. Le date non sono inventate.",
    "fsv.emptyPast": "Nessuna funzione deprecated o retired in elenco.",
    "fsv.emptyAll": "Nessuna funzione del catalogo corrisponde.",
    "fsv.latestRelease": "Ultima release verificata",
    "fsv.featureCount": "{n} funzioni del catalogo",
    "fsv.accomplishment": "Cosa ottiene",
    "fsv.before": "Prima",
    "fsv.now": "Ora / obiettivo",
    "fsv.why": "Perché conta",
    "fsv.audience": "Audience",
    "fsv.switchProduct": "Prodotto",
    "fsv.citation": "Catalogo",
    "fsv.notAvailable": "Non in questo repository. Nessuna azione Prova.",
    "fsv.compactMore": "Vedi dettagli",
    "fsv.noTry": "Prova resta nascosta finché la funzione non è disponibile per te.",
    "fsv.signInHint": "Accedi da Ricerca / Il mio profilo per aprire Features SMARTview. Questa pagina riusa la sessione FloqR — nessun secondo account.",
    "fsv.replyUnverified": "Lo stato della funzione non è verificato da evidenze di disponibilità live. Non tratterò un piano come rilasciato.",
    "fsv.replyOk": "Ecco il Features SMARTview pubblicato.",
    "fsv.showMaster": "Mostra Features SMARTview",
    "fsv.editorialHint": "Le Novità patron restano vuote finché un Master Admin non approva copia di release verificata. Non unire come annuncio live.",
    "fsv.warning": "Solo catalogo impacchettato. Flag live e date di disponibilità non verificati.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  pt: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Funções de produto com evidência. Planos não são tratados como entregues.",
    "fsv.tabOverview": "Visão geral",
    "fsv.tabWhatsNew": "Novidades",
    "fsv.tabJourney": "Jornada da função",
    "fsv.tabAll": "Todas as funções",
    "fsv.tabComingSoon": "Em breve",
    "fsv.tabPast": "Passado / Retired",
    "fsv.dateImplemented": "Data de implementação",
    "fsv.dateNotVerified": "Não verificado",
    "fsv.mergedOn": "Mesclado em",
    "fsv.availableSince": "Disponível desde",
    "fsv.tryFeature": "Experimentar função",
    "fsv.viewJourney": "Ver jornada",
    "fsv.readChanges": "Ler alterações",
    "fsv.askBotDee": "Perguntar ao BOT DEE",
    "fsv.close": "Fechar",
    "fsv.search": "Pesquisar funções",
    "fsv.filterProduct": "Todos os produtos",
    "fsv.filterLifecycle": "Ciclo de vida",
    "fsv.filterAll": "Todos os estados",
    "fsv.emptyWhatsNew": "Novidades lista só versões aprovadas e verificadas. Nenhuma está publicada ainda.",
    "fsv.emptyComingSoon": "Não há trabalho planejado aprovado. Datas não são inventadas.",
    "fsv.emptyPast": "Nenhuma função deprecated ou retired listada.",
    "fsv.emptyAll": "Nenhuma função do catálogo corresponde.",
    "fsv.latestRelease": "Última versão verificada",
    "fsv.featureCount": "{n} funções do catálogo",
    "fsv.accomplishment": "O que realiza",
    "fsv.before": "Antes",
    "fsv.now": "Agora / alvo",
    "fsv.why": "Por que importa",
    "fsv.audience": "Público",
    "fsv.switchProduct": "Produto",
    "fsv.citation": "Catálogo",
    "fsv.notAvailable": "Não está neste repositório. Sem ação Experimentar.",
    "fsv.compactMore": "Ver detalhes",
    "fsv.noTry": "Experimentar fica oculto até esta função estar disponível para você.",
    "fsv.signInHint": "Entre em Pesquisa / Meu perfil para abrir Features SMARTview. Esta página reutiliza a sessão FloqR — sem segundo cadastro.",
    "fsv.replyUnverified": "O estado da função não está verificado com evidência de disponibilidade ao vivo. Não tratarei um plano como entregue.",
    "fsv.replyOk": "Aqui está o Features SMARTview publicado.",
    "fsv.showMaster": "Mostrar Features SMARTview",
    "fsv.editorialHint": "Novidades do patron ficam vazias até um Master Admin aprovar cópia de versão verificada. Não mesclar como anúncio ao vivo.",
    "fsv.warning": "Apenas catálogo empacotado. Flags ao vivo e datas de disponibilidade não verificados.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  el: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Λειτουργίες προϊόντος με τεκμήρια. Τα σχέδια δεν θεωρούνται παραδομένα.",
    "fsv.tabOverview": "Επισκόπηση",
    "fsv.tabWhatsNew": "Νέα",
    "fsv.tabJourney": "Διαδρομή λειτουργίας",
    "fsv.tabAll": "Όλες οι λειτουργίες",
    "fsv.tabComingSoon": "Σύντομα",
    "fsv.tabPast": "Παρελθόν / Retired",
    "fsv.dateImplemented": "Ημερομηνία υλοποίησης",
    "fsv.dateNotVerified": "Μη επαληθευμένο",
    "fsv.mergedOn": "Συγχωνεύτηκε στις",
    "fsv.availableSince": "Διαθέσιμο από",
    "fsv.tryFeature": "Δοκιμή λειτουργίας",
    "fsv.viewJourney": "Δες τη διαδρομή",
    "fsv.readChanges": "Διάβασε αλλαγές",
    "fsv.askBotDee": "Ρώτα τον BOT DEE",
    "fsv.close": "Κλείσιμο",
    "fsv.search": "Αναζήτηση λειτουργιών",
    "fsv.filterProduct": "Όλα τα προϊόντα",
    "fsv.filterLifecycle": "Κύκλος ζωής",
    "fsv.filterAll": "Όλες οι καταστάσεις",
    "fsv.emptyWhatsNew": "Τα Νέα δείχνουν μόνο εγκεκριμένες, επαληθευμένες εκδόσεις. Καμία δεν έχει δημοσιευτεί ακόμα.",
    "fsv.emptyComingSoon": "Δεν υπάρχει εγκεκριμένη προγραμματισμένη εργασία. Οι ημερομηνίες δεν εφευρίσκονται.",
    "fsv.emptyPast": "Δεν υπάρχουν deprecated ή retired λειτουργίες.",
    "fsv.emptyAll": "Καμία λειτουργία καταλόγου δεν ταιριάζει.",
    "fsv.latestRelease": "Τελευταία επαληθευμένη έκδοση",
    "fsv.featureCount": "{n} λειτουργίες καταλόγου",
    "fsv.accomplishment": "Τι επιτυγχάνει",
    "fsv.before": "Πριν",
    "fsv.now": "Τώρα / στόχος",
    "fsv.why": "Γιατί μετράει",
    "fsv.audience": "Κοινό",
    "fsv.switchProduct": "Προϊόν",
    "fsv.citation": "Κατάλογος",
    "fsv.notAvailable": "Δεν υπάρχει σε αυτό το αποθετήριο. Χωρίς ενέργεια Δοκιμή.",
    "fsv.compactMore": "Λεπτομέρειες",
    "fsv.noTry": "Η Δοκιμή μένει κρυφή μέχρι να είναι διαθέσιμη η λειτουργία σε εσάς.",
    "fsv.signInHint": "Συνδεθείτε στην Αναζήτηση / Το προφίλ μου για το Features SMARTview. Η σελίδα επαναχρησιμοποιεί τη συνεδρία FloqR — χωρίς δεύτερη εγγραφή.",
    "fsv.replyUnverified": "Η κατάσταση της λειτουργίας δεν επαληθεύεται από ζωντανά τεκμήρια διαθεσιμότητας. Δεν θα θεωρήσω ένα σχέδιο παραδομένο.",
    "fsv.replyOk": "Ορίστε το δημοσιευμένο Features SMARTview.",
    "fsv.showMaster": "Εμφάνιση Features SMARTview",
    "fsv.editorialHint": "Τα Νέα patron μένουν κενά μέχρι ένας Master Admin να εγκρίνει επαληθευμένο κείμενο έκδοσης. Μην το συγχωνεύσετε ως ζωντανή ανακοίνωση.",
    "fsv.warning": "Μόνο συσκευασμένος κατάλογος. Τα ζωντανά flags και οι ημερομηνίες διαθεσιμότητας δεν επαληθεύονται.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  pl: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "Funkcje produktu oparte na dowodach. Plany nie są traktowane jako dostarczone.",
    "fsv.tabOverview": "Przegląd",
    "fsv.tabWhatsNew": "Nowości",
    "fsv.tabJourney": "Ścieżka funkcji",
    "fsv.tabAll": "Wszystkie funkcje",
    "fsv.tabComingSoon": "Wkrótce",
    "fsv.tabPast": "Przeszłość / Retired",
    "fsv.dateImplemented": "Data wdrożenia",
    "fsv.dateNotVerified": "Niezweryfikowane",
    "fsv.mergedOn": "Scalono",
    "fsv.availableSince": "Dostępne od",
    "fsv.tryFeature": "Wypróbuj funkcję",
    "fsv.viewJourney": "Zobacz ścieżkę",
    "fsv.readChanges": "Czytaj zmiany",
    "fsv.askBotDee": "Zapytaj BOT DEE",
    "fsv.close": "Zamknij",
    "fsv.search": "Szukaj funkcji",
    "fsv.filterProduct": "Wszystkie produkty",
    "fsv.filterLifecycle": "Cykl życia",
    "fsv.filterAll": "Wszystkie statusy",
    "fsv.emptyWhatsNew": "Nowości pokazują tylko zatwierdzone, zweryfikowane wydania. Żadne nie jest jeszcze opublikowane.",
    "fsv.emptyComingSoon": "Brak zatwierdzonej zaplanowanej pracy. Dat nie wymyślamy.",
    "fsv.emptyPast": "Brak funkcji deprecated lub retired.",
    "fsv.emptyAll": "Żadna funkcja katalogu nie pasuje.",
    "fsv.latestRelease": "Ostatnie zweryfikowane wydanie",
    "fsv.featureCount": "{n} funkcji katalogu",
    "fsv.accomplishment": "Co daje",
    "fsv.before": "Wcześniej",
    "fsv.now": "Teraz / cel",
    "fsv.why": "Dlaczego to ważne",
    "fsv.audience": "Odbiorcy",
    "fsv.switchProduct": "Produkt",
    "fsv.citation": "Katalog",
    "fsv.notAvailable": "Nie ma w tym repozytorium. Brak akcji Wypróbuj.",
    "fsv.compactMore": "Zobacz szczegóły",
    "fsv.noTry": "Wypróbuj jest ukryte, dopóki funkcja nie będzie dla Ciebie dostępna.",
    "fsv.signInHint": "Zaloguj się w Wyszukiwaniu / Mój profil, aby otworzyć Features SMARTview. Strona używa sesji FloqR — bez drugiego konta.",
    "fsv.replyUnverified": "Status funkcji nie jest zweryfikowany dowodem dostępności na żywo. Nie traktuję planu jako dostarczonego.",
    "fsv.replyOk": "Oto opublikowany Features SMARTview.",
    "fsv.showMaster": "Pokaż Features SMARTview",
    "fsv.editorialHint": "Nowości patrona zostają puste, aż Master Admin zatwierdzi zweryfikowany tekst wydania. Nie scalać jako ogłoszenia na żywo.",
    "fsv.warning": "Tylko spakowany katalog. Flag na żywo i dat dostępności nie zweryfikowano.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  },
  ar: {
    "fsv.title": "Features SMARTview",
    "fsv.subtitle": "ميزات المنتج المدعومة بالأدلة. لا تُعامل الخطط كأنها أُطلقت.",
    "fsv.tabOverview": "نظرة عامة",
    "fsv.tabWhatsNew": "ما الجديد",
    "fsv.tabJourney": "رحلة الميزة",
    "fsv.tabAll": "كل الميزات",
    "fsv.tabComingSoon": "قريبًا",
    "fsv.tabPast": "سابق / Retired",
    "fsv.dateImplemented": "تاريخ التنفيذ",
    "fsv.dateNotVerified": "غير موثّق",
    "fsv.mergedOn": "دُمج في",
    "fsv.availableSince": "متاح منذ",
    "fsv.tryFeature": "جرّب الميزة",
    "fsv.viewJourney": "عرض الرحلة",
    "fsv.readChanges": "اقرأ التغييرات",
    "fsv.askBotDee": "اسأل BOT DEE",
    "fsv.close": "إغلاق",
    "fsv.search": "البحث في الميزات",
    "fsv.filterProduct": "كل المنتجات",
    "fsv.filterLifecycle": "دورة الحياة",
    "fsv.filterAll": "كل الحالات",
    "fsv.emptyWhatsNew": "ما الجديد يعرض الإصدارات المعتمدة والموثّقة فقط. لا شيء منشور بعد.",
    "fsv.emptyComingSoon": "لا عمل مخطط معتمد. لا نخترع تواريخ.",
    "fsv.emptyPast": "لا ميزات deprecated أو retired مدرجة.",
    "fsv.emptyAll": "لا ميزات في الكتالوج تطابق.",
    "fsv.latestRelease": "آخر إصدار موثّق",
    "fsv.featureCount": "{n} ميزات في الكتالوج",
    "fsv.accomplishment": "ما الذي تنجزه",
    "fsv.before": "قبل",
    "fsv.now": "الآن / الهدف",
    "fsv.why": "لماذا يهم",
    "fsv.audience": "الجمهور",
    "fsv.switchProduct": "المنتج",
    "fsv.citation": "الكتالوج",
    "fsv.notAvailable": "ليست في هذا المستودع. لا إجراء جرّب.",
    "fsv.compactMore": "عرض التفاصيل",
    "fsv.noTry": "يبقى جرّب مخفيًا حتى تصبح الميزة متاحة لك.",
    "fsv.signInHint": "سجّل الدخول من البحث / ملفي لفتح Features SMARTview. الصفحة تعيد استخدام جلسة FloqR — بلا تسجيل ثانٍ.",
    "fsv.replyUnverified": "حالة الميزة غير موثّقة بأدلة التوفر الحي. لن أعامل خطة كأنها أُطلقت.",
    "fsv.replyOk": "إليك Features SMARTview المنشور.",
    "fsv.showMaster": "إظهار Features SMARTview",
    "fsv.editorialHint": "ما الجديد للـ patron يبقى فارغًا حتى يوافق Master Admin على نص إصدار موثّق. لا تدمج هذا كإعلان حي.",
    "fsv.warning": "كتالوج معبّأ فقط. الأعلام الحية وتواريخ التوفر غير موثّقة.",
    "fsv.lifecycle.concept": "Concept",
    "fsv.lifecycle.planned": "Planned",
    "fsv.lifecycle.in_development": "In development",
    "fsv.lifecycle.beta": "Beta",
    "fsv.lifecycle.released": "Released",
    "fsv.lifecycle.deprecated": "Deprecated",
    "fsv.lifecycle.retired": "Retired"
  }
};

const HELP = {
  "help-features-smartview": {
    en: {
      title: "Features SMARTview",
      body: "Features SMARTview is the product catalog for BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema, and Si-tube. Open Overview, What's New, Feature Journey, All Features, Coming Soon, or Past/Retired. Status stays Status not verified until availability is evidenced. What's New stays empty until a reviewer approves a verified release. This is not Room SMARTview and not Version SMARTview. Plans are never treated as shipped."
    },
    fr: {
      title: "Features SMARTview",
      body: "Features SMARTview est le catalogue produits de BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema et Si-tube. Ouvrez Aperçu, Nouveautés, Parcours, Toutes les fonctions, Bientôt ou Passé/retiré. Le statut reste Status not verified tant que la disponibilité n’est pas prouvée. Nouveautés reste vide jusqu’à l’approbation d’une version vérifiée. Ce n’est pas Room SMARTview ni Version SMARTview. Les plans ne sont jamais traités comme livrés."
    },
    de: {
      title: "Features SMARTview",
      body: "Features SMARTview ist der Produktkatalog für BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema und Si-tube. Öffne Überblick, Neuigkeiten, Feature-Reise, Alle Features, Demnächst oder Vergangen/Retired. Der Status bleibt Status not verified, bis Verfügbarkeit belegt ist. Neuigkeiten bleibt leer, bis ein Reviewer ein geprüftes Release freigibt. Das ist nicht Room SMARTview und nicht Version SMARTview. Pläne gelten nie als ausgeliefert."
    },
    es: {
      title: "Features SMARTview",
      body: "Features SMARTview es el catálogo de BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema y Si-tube. Abre Resumen, Novedades, Recorrido, Todas las funciones, Próximamente o Pasado/Retired. El estado permanece Status not verified hasta que haya evidencia de disponibilidad. Novedades queda vacío hasta que un revisor apruebe una versión verificada. No es Room SMARTview ni Version SMARTview. Los planes nunca se tratan como entregados."
    },
    nl: {
      title: "Features SMARTview",
      body: "Features SMARTview is de productcatalogus voor BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema en Si-tube. Open Overzicht, Nieuw, Feature-reis, Alle features, Binnenkort of Verleden/Retired. Status blijft Status not verified tot beschikbaarheid is bewezen. Nieuw blijft leeg tot een reviewer een geverifieerde release goedkeurt. Dit is niet Room SMARTview en niet Version SMARTview. Plannen gelden nooit als geleverd."
    },
    ru: {
      title: "Features SMARTview",
      body: "Features SMARTview — каталог продуктов BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema и Si-tube. Откройте Обзор, Что нового, Путь функции, Все функции, Скоро или Прошлое/Retired. Статус остаётся Status not verified, пока нет доказательств доступности. «Что нового» пусто, пока рецензент не одобрит проверенный релиз. Это не Room SMARTview и не Version SMARTview. Планы никогда не считаются выпущенными."
    },
    it: {
      title: "Features SMARTview",
      body: "Features SMARTview è il catalogo prodotti di BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema e Si-tube. Apri Panoramica, Novità, Percorso, Tutte le funzioni, Prossimamente o Passato/Retired. Lo stato resta Status not verified finché la disponibilità non è evidenziata. Novità resta vuoto finché un revisore non approva una release verificata. Non è Room SMARTview né Version SMARTview. I piani non sono mai trattati come rilasciati."
    },
    pt: {
      title: "Features SMARTview",
      body: "Features SMARTview é o catálogo de BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema e Si-tube. Abra Visão geral, Novidades, Jornada, Todas as funções, Em breve ou Passado/Retired. O estado permanece Status not verified até haver evidência de disponibilidade. Novidades fica vazio até um revisor aprovar uma versão verificada. Não é Room SMARTview nem Version SMARTview. Planos nunca são tratados como entregues."
    },
    el: {
      title: "Features SMARTview",
      body: "Το Features SMARTview είναι ο κατάλογος προϊόντων για BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema και Si-tube. Ανοίξτε Επισκόπηση, Νέα, Διαδρομή, Όλες τις λειτουργίες, Σύντομα ή Παρελθόν/Retired. Η κατάσταση μένει Status not verified μέχρι να τεκμηριωθεί η διαθεσιμότητα. Τα Νέα μένουν κενά μέχρι να εγκριθεί επαληθευμένη έκδοση. Δεν είναι Room SMARTview ούτε Version SMARTview. Τα σχέδια δεν θεωρούνται ποτέ παραδομένα."
    },
    pl: {
      title: "Features SMARTview",
      body: "Features SMARTview to katalog produktów BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema i Si-tube. Otwórz Przegląd, Nowości, Ścieżkę, Wszystkie funkcje, Wkrótce lub Przeszłość/Retired. Status zostaje Status not verified, dopóki dostępność nie ma dowodu. Nowości zostają puste, aż recenzent zatwierdzi zweryfikowane wydanie. To nie Room SMARTview i nie Version SMARTview. Planów nigdy nie traktujemy jako dostarczonych."
    },
    ar: {
      title: "Features SMARTview",
      body: "Features SMARTview هو كتالوج منتجات BOT-DEE وMingl وShoutOut وRydR وfloqCast وVIP reserV وSi-nema وSi-tube. افتح نظرة عامة أو ما الجديد أو رحلة الميزة أو كل الميزات أو قريبًا أو السابق/Retired. تبقى الحالة Status not verified حتى يثبت التوفر. ما الجديد يبقى فارغًا حتى يوافق مراجع على إصدار موثّق. هذا ليس Room SMARTview وليس Version SMARTview. لا تُعامل الخطط كأنها أُطلقت."
    }
  },
  "help-features-smartview-status": {
    en: {
      title: "Status not verified",
      body: "Features SMARTview shows Status not verified when live flags, Pages rollout, or patron availability dates were not checked. Merged on is a pull-request merge time, not Available since. Released is only shown with deployment or availability evidence. SAMPLE catalog rows and conversation claims are not proof of a live release."
    },
    fr: {
      title: "Status not verified",
      body: "Features SMARTview affiche Status not verified lorsque les flags live, le déploiement Pages ou les dates de disponibilité patrons n’ont pas été vérifiés. Merged on est une heure de fusion de pull request, pas Available since. Released n’apparaît qu’avec une preuve de déploiement ou de disponibilité. Les lignes SAMPLE et les propos de conversation ne prouvent pas une version live."
    },
    de: {
      title: "Status not verified",
      body: "Features SMARTview zeigt Status not verified, wenn Live-Flags, Pages-Rollout oder Patron-Verfügbarkeitsdaten nicht geprüft wurden. Merged on ist eine Pull-Request-Merge-Zeit, nicht Available since. Released erscheint nur mit Deploy- oder Verfügbarkeitsbeleg. SAMPLE-Zeilen und Gesprächsbehauptungen beweisen kein Live-Release."
    },
    es: {
      title: "Status not verified",
      body: "Features SMARTview muestra Status not verified cuando no se comprobaron flags en vivo, el despliegue de Pages o las fechas de disponibilidad para patrons. Merged on es la hora de fusión de un pull request, no Available since. Released solo aparece con evidencia de despliegue o disponibilidad. Filas SAMPLE y afirmaciones de conversación no prueban una versión en vivo."
    },
    nl: {
      title: "Status not verified",
      body: "Features SMARTview toont Status not verified wanneer live flags, Pages-uitrol of patron-beschikbaarheidsdata niet zijn gecontroleerd. Merged on is een pull-request-mergetijd, niet Available since. Released verschijnt alleen met deploy- of beschikbaarheidsbewijs. SAMPLE-rijen en gesprekclaims bewijzen geen live release."
    },
    ru: {
      title: "Status not verified",
      body: "Features SMARTview показывает Status not verified, если живые флаги, выкладка Pages или даты доступности для patron не проверялись. Merged on — время слияния pull request, не Available since. Released только при доказательстве деплоя или доступности. Строки SAMPLE и слова из разговора не доказывают живой релиз."
    },
    it: {
      title: "Status not verified",
      body: "Features SMARTview mostra Status not verified quando flag live, rollout Pages o date di disponibilità patron non sono stati controllati. Merged on è l’ora di merge di una pull request, non Available since. Released compare solo con evidenza di deploy o disponibilità. Righe SAMPLE e affermazioni in chat non provano una release live."
    },
    pt: {
      title: "Status not verified",
      body: "Features SMARTview mostra Status not verified quando flags ao vivo, o rollout Pages ou datas de disponibilidade para patrons não foram checados. Merged on é o horário de merge de um pull request, não Available since. Released só aparece com evidência de deploy ou disponibilidade. Linhas SAMPLE e afirmações de conversa não provam um lançamento ao vivo."
    },
    el: {
      title: "Status not verified",
      body: "Το Features SMARTview δείχνει Status not verified όταν δεν ελέγχθηκαν ζωντανά flags, το rollout Pages ή ημερομηνίες διαθεσιμότητας για patrons. Το Merged on είναι ώρα συγχώνευσης pull request, όχι Available since. Το Released εμφανίζεται μόνο με τεκμήριο deploy ή διαθεσιμότητας. Γραμμές SAMPLE και ισχυρισμοί συνομιλίας δεν αποδεικνύουν ζωντανή έκδοση."
    },
    pl: {
      title: "Status not verified",
      body: "Features SMARTview pokazuje Status not verified, gdy nie sprawdzono flag na żywo, wdrożenia Pages ani dat dostępności dla patronów. Merged on to czas scalenia pull request, nie Available since. Released pojawia się tylko z dowodem wdrożenia lub dostępności. Wiersze SAMPLE i twierdzenia z rozmowy nie dowodzą wydania na żywo."
    },
    ar: {
      title: "Status not verified",
      body: "يعرض Features SMARTview الحالة Status not verified عندما لم تُفحص الأعلام الحية أو طرح Pages أو تواريخ توفر الـ patron. Merged on وقت دمج طلب سحب، وليس Available since. Released يظهر فقط مع دليل نشر أو توفر. صفوف SAMPLE وادّعاءات المحادثة ليست إثباتًا لإصدار حي."
    }
  },
  "help-features-smartview-botdee": {
    en: {
      title: "Ask BOT DEE about a product",
      body: "In BOT DEE say What can Mingl do, What changed in ShoutOut, What is coming to Si-nema, or When was VIP reserV implemented. BOT DEE answers from the Features catalog with citations. It admits Status not verified and will not treat a plan as shipped. Type Ver for Version SMARTview. Type Open Room SMARTview for a shared room. Those are different cards."
    },
    fr: {
      title: "Demander à BOT DEE un produit",
      body: "Dans BOT DEE dites What can Mingl do, What changed in ShoutOut, What is coming to Si-nema ou When was VIP reserV implemented. BOT DEE répond depuis le catalogue Features avec des citations. Il admet Status not verified et ne traitera pas un plan comme livré. Tapez Ver pour Version SMARTview. Tapez Open Room SMARTview pour une salle partagée. Ce sont d’autres cartes."
    },
    de: {
      title: "BOT DEE zu einem Produkt fragen",
      body: "Sage in BOT DEE What can Mingl do, What changed in ShoutOut, What is coming to Si-nema oder When was VIP reserV implemented. BOT DEE antwortet aus dem Features-Katalog mit Zitaten. Es gibt Status not verified zu und behandelt einen Plan nicht als ausgeliefert. Tippe Ver für Version SMARTview. Tippe Open Room SMARTview für einen gemeinsamen Raum. Das sind andere Karten."
    },
    es: {
      title: "Preguntar a BOT DEE por un producto",
      body: "En BOT DEE di What can Mingl do, What changed in ShoutOut, What is coming to Si-nema o When was VIP reserV implemented. BOT DEE responde desde el catálogo Features con citas. Admite Status not verified y no trata un plan como entregado. Escribe Ver para Version SMARTview. Escribe Open Room SMARTview para una sala compartida. Son otras tarjetas."
    },
    nl: {
      title: "BOT DEE over een product vragen",
      body: "Zeg in BOT DEE What can Mingl do, What changed in ShoutOut, What is coming to Si-nema of When was VIP reserV implemented. BOT DEE antwoordt uit de Features-catalogus met citaten. Het geeft Status not verified toe en behandelt een plan niet als geleverd. Typ Ver voor Version SMARTview. Typ Open Room SMARTview voor een gedeelde ruimte. Dat zijn andere kaarten."
    },
    ru: {
      title: "Спросить BOT DEE о продукте",
      body: "В BOT DEE скажите What can Mingl do, What changed in ShoutOut, What is coming to Si-nema или When was VIP reserV implemented. BOT DEE отвечает из каталога Features со ссылками. Он признаёт Status not verified и не считает план выпущенным. Введите Ver для Version SMARTview. Введите Open Room SMARTview для общей комнаты. Это другие карточки."
    },
    it: {
      title: "Chiedere a BOT DEE un prodotto",
      body: "In BOT DEE di’ What can Mingl do, What changed in ShoutOut, What is coming to Si-nema o When was VIP reserV implemented. BOT DEE risponde dal catalogo Features con citazioni. Ammette Status not verified e non tratta un piano come rilasciato. Digita Ver per Version SMARTview. Digita Open Room SMARTview per una stanza condivisa. Sono altre schede."
    },
    pt: {
      title: "Perguntar ao BOT DEE sobre um produto",
      body: "No BOT DEE diga What can Mingl do, What changed in ShoutOut, What is coming to Si-nema ou When was VIP reserV implemented. BOT DEE responde pelo catálogo Features com citações. Admite Status not verified e não trata um plano como entregue. Digite Ver para Version SMARTview. Digite Open Room SMARTview para uma sala compartilhada. São outros cartões."
    },
    el: {
      title: "Ρώτα τον BOT DEE για ένα προϊόν",
      body: "Στο BOT DEE πες What can Mingl do, What changed in ShoutOut, What is coming to Si-nema ή When was VIP reserV implemented. Ο BOT DEE απαντά από τον κατάλογο Features με παραπομπές. Παραδέχεται Status not verified και δεν θεωρεί σχέδιο παραδομένο. Πληκτρολόγησε Ver για Version SMARTview. Πληκτρολόγησε Open Room SMARTview για κοινό δωμάτιο. Είναι άλλες κάρτες."
    },
    pl: {
      title: "Zapytaj BOT DEE o produkt",
      body: "W BOT DEE powiedz What can Mingl do, What changed in ShoutOut, What is coming to Si-nema albo When was VIP reserV implemented. BOT DEE odpowiada z katalogu Features z cytatami. Przyznaje Status not verified i nie traktuje planu jako dostarczonego. Wpisz Ver dla Version SMARTview. Wpisz Open Room SMARTview dla wspólnego pokoju. To inne karty."
    },
    ar: {
      title: "اسأل BOT DEE عن منتج",
      body: "في BOT DEE قل What can Mingl do أو What changed in ShoutOut أو What is coming to Si-nema أو When was VIP reserV implemented. يجيب BOT DEE من كتالوج Features مع استشهادات. يعترف بـ Status not verified ولن يعامل خطة كأنها أُطلقت. اكتب Ver لـ Version SMARTview. اكتب Open Room SMARTview لغرفة مشتركة. تلك بطاقات مختلفة."
    }
  }
};

const EXACT_LIFECYCLE = {
  "fsv.lifecycle.concept": "Concept",
  "fsv.lifecycle.planned": "Planned",
  "fsv.lifecycle.in_development": "In development",
  "fsv.lifecycle.beta": "Beta",
  "fsv.lifecycle.released": "Released",
  "fsv.lifecycle.deprecated": "Deprecated",
  "fsv.lifecycle.retired": "Retired"
};
Object.keys(CHROME).forEach(lang => Object.assign(CHROME[lang], EXACT_LIFECYCLE));

function packLines(map) {
  return Object.entries(map).map(([key, value]) => `      ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join("\n");
}

function helpBlock(lang) {
  return Object.entries(HELP).map(([id, byLang]) => {
    const row = byLang[lang];
    if (!row) throw new Error(`missing help ${id} ${lang}`);
    return `      ${JSON.stringify(id)}: {\n        title: ${JSON.stringify(row.title)},\n        body: ${JSON.stringify(row.body)}\n      },`;
  }).join("\n");
}

function injectChrome() {
  const file = path.join(root, "floqr-i18n.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('"fsv.title"')) {
    console.log("chrome already has fsv.title");
    return;
  }
  let count = 0;
  src = src.replace(/("botdee\.vs\.deployedClaim":\s*"[^"]*",)/g, (full, _g, offset) => {
    if (src.slice(offset, offset + 400).includes('"fsv.title"')) return full;
    const langOrder = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
    const lang = langOrder[count];
    count += 1;
    const pack = CHROME[lang];
    if (!pack) throw new Error(`no chrome pack ${lang}`);
    return `${full}\n${packLines(pack)}`;
  });
  if (count !== 11) throw new Error(`expected 11 chrome injections, got ${count}`);
  src = src.replace(/const VERSION\s*=\s*"s3\.3\.055"/, 'const VERSION = "s3.3.056"');
  fs.writeFileSync(file, src);
  console.log("chrome keys injected", count, Object.keys(CHROME.en).length);
}

function injectHelpJs() {
  const file = path.join(root, "floqr-i18n-help.js");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("help-features-smartview")) {
    console.log("help already has help-features-smartview");
    return;
  }
  const langs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
  let count = 0;
  src = src.replace(/("help-botdee-headless-vip":\s*\{[\s\S]*?\n\s*\},)/g, (full, _g, offset) => {
    if (src.slice(offset, offset + 500).includes("help-features-smartview")) return full;
    const lang = langs[count];
    count += 1;
    if (!lang) throw new Error("extra help pack");
    return `${full}\n${helpBlock(lang)}`;
  });
  if (count !== 10) throw new Error(`expected 10 help injections, got ${count}`);
  src = src.replace(/const VERSION\s*=\s*"s3\.3\.055"/, 'const VERSION = "s3.3.056"');
  fs.writeFileSync(file, src);
  console.log("help packs injected", count);
}

function injectHelpEn() {
  const file = path.join(root, "scripts/_help-en.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.entries(HELP).forEach(([id, byLang]) => {
    json[id] = {title: byLang.en.title, body: byLang.en.body};
  });
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log("canonical help ids", Object.keys(HELP).join(", "));
}

Object.keys(CHROME).forEach(lang => {
  const missing = Object.keys(CHROME.en).filter(key => !CHROME[lang][key]);
  if (missing.length) throw new Error(`${lang} missing ${missing.join(",")}`);
});

injectChrome();
injectHelpJs();
injectHelpEn();
console.log("chrome key count", Object.keys(CHROME.en).length);
