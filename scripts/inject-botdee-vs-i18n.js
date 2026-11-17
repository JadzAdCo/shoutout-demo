#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const CHROME = {
  en: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "System & Version Information",
    "botdee.vs.rowBotDee": "BOT DEE version",
    "botdee.vs.rowFloqr": "FLOQR version",
    "botdee.vs.rowModel": "AI model",
    "botdee.vs.rowStatus": "Service status",
    "botdee.vs.tabOverview": "Overview",
    "botdee.vs.tabWhatsNew": "What's New",
    "botdee.vs.tabHelp": "Help",
    "botdee.vs.aboutHeading": "About BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE is FLOQR's in-app assistant for discovery, reservations, and other authorized actions across people, venues, events, and services.",
    "botdee.vs.technical": "Technical Details",
    "botdee.vs.techEnv": "Deployment environment",
    "botdee.vs.techBuild": "Build identifier",
    "botdee.vs.techCheck": "Last successful health check",
    "botdee.vs.whatsNewHeading": "What's New",
    "botdee.vs.whatsNewEmpty": "No verified package notes are available for this build.",
    "botdee.vs.helpHeading": "Version command",
    "botdee.vs.helpBody": "Enter Ver, Vers, or Version to display this SMARTview. The command is case-insensitive. Longer questions like “what is your version?” still get a text answer plus this card.",
    "botdee.vs.footBrand": "FLOQR · System Information",
    "botdee.vs.footUpdated": "Last updated: {when}",
    "botdee.vs.unavailable": "Unavailable",
    "botdee.vs.notChecked": "Not checked",
    "botdee.vs.notUsedThisTurn": "Not used this turn",
    "botdee.vs.configuredModel": "Configured: {id}",
    "botdee.vs.statusNotChecked": "Not checked",
    "botdee.vs.statusUnavailable": "Unavailable",
    "botdee.vs.intro": "Here's the current version information for FLOQR and BOT DEE.",
    "botdee.vs.frontendLabel": "FLOQR frontend",
    "botdee.vs.backendLabel": "FLOQR backend",
    "botdee.vs.privilegedHeading": "Privileged diagnostics",
    "botdee.vs.privilegedNote": "Master Admin only. These flags do not prove a production deploy.",
    "botdee.vs.deployedClaim": "Deployed claim"
  },
  fr: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "Système et informations de version",
    "botdee.vs.rowBotDee": "Version BOT DEE",
    "botdee.vs.rowFloqr": "Version FLOQR",
    "botdee.vs.rowModel": "Modèle d’IA",
    "botdee.vs.rowStatus": "État du service",
    "botdee.vs.tabOverview": "Aperçu",
    "botdee.vs.tabWhatsNew": "Nouveautés",
    "botdee.vs.tabHelp": "Aide",
    "botdee.vs.aboutHeading": "À propos de BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE est l’assistant intégré de FLOQR pour la découverte, les réservations et d’autres actions autorisées sur les personnes, lieux, événements et services.",
    "botdee.vs.technical": "Détails techniques",
    "botdee.vs.techEnv": "Environnement de déploiement",
    "botdee.vs.techBuild": "Identifiant de build",
    "botdee.vs.techCheck": "Dernière vérification de santé réussie",
    "botdee.vs.whatsNewHeading": "Nouveautés",
    "botdee.vs.whatsNewEmpty": "Aucune note de package vérifiée n’est disponible pour cette version.",
    "botdee.vs.helpHeading": "Commande Version",
    "botdee.vs.helpBody": "Saisissez Ver, Vers ou Version pour afficher ce SMARTview. La commande ignore la casse. Les questions plus longues comme « what is your version? » reçoivent encore une réponse texte plus cette carte.",
    "botdee.vs.footBrand": "FLOQR · Informations système",
    "botdee.vs.footUpdated": "Dernière mise à jour : {when}",
    "botdee.vs.unavailable": "Indisponible",
    "botdee.vs.notChecked": "Non vérifié",
    "botdee.vs.notUsedThisTurn": "Non utilisé ce tour",
    "botdee.vs.configuredModel": "Configuré : {id}",
    "botdee.vs.statusNotChecked": "Non vérifié",
    "botdee.vs.statusUnavailable": "Indisponible",
    "botdee.vs.intro": "Voici les informations de version actuelles pour FLOQR et BOT DEE.",
    "botdee.vs.frontendLabel": "Frontend FLOQR",
    "botdee.vs.backendLabel": "Backend FLOQR",
    "botdee.vs.privilegedHeading": "Diagnostics privilégiés",
    "botdee.vs.privilegedNote": "Master Admin uniquement. Ces indicateurs ne prouvent pas un déploiement en production.",
    "botdee.vs.deployedClaim": "Déclaration de déploiement"
  },
  de: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "System- und Versionsinformationen",
    "botdee.vs.rowBotDee": "BOT DEE-Version",
    "botdee.vs.rowFloqr": "FLOQR-Version",
    "botdee.vs.rowModel": "KI-Modell",
    "botdee.vs.rowStatus": "Dienststatus",
    "botdee.vs.tabOverview": "Übersicht",
    "botdee.vs.tabWhatsNew": "Neuigkeiten",
    "botdee.vs.tabHelp": "Hilfe",
    "botdee.vs.aboutHeading": "Über BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE ist FLOQRs In-App-Assistent für Entdeckung, Reservierungen und andere genehmigte Aktionen zu Personen, Locations, Events und Services.",
    "botdee.vs.technical": "Technische Details",
    "botdee.vs.techEnv": "Bereitstellungsumgebung",
    "botdee.vs.techBuild": "Build-Kennung",
    "botdee.vs.techCheck": "Letzte erfolgreiche Gesundheitsprüfung",
    "botdee.vs.whatsNewHeading": "Neuigkeiten",
    "botdee.vs.whatsNewEmpty": "Für diesen Build liegen keine geprüften Package-Hinweise vor.",
    "botdee.vs.helpHeading": "Version-Befehl",
    "botdee.vs.helpBody": "Geben Sie Ver, Vers oder Version ein, um dieses SMARTview anzuzeigen. Der Befehl ignoriert Groß/Kleinschreibung. Längere Fragen wie „what is your version?“ erhalten weiter eine Textantwort plus diese Karte.",
    "botdee.vs.footBrand": "FLOQR · Systeminformationen",
    "botdee.vs.footUpdated": "Zuletzt aktualisiert: {when}",
    "botdee.vs.unavailable": "Nicht verfügbar",
    "botdee.vs.notChecked": "Nicht geprüft",
    "botdee.vs.notUsedThisTurn": "In diesem Zug nicht verwendet",
    "botdee.vs.configuredModel": "Konfiguriert: {id}",
    "botdee.vs.statusNotChecked": "Nicht geprüft",
    "botdee.vs.statusUnavailable": "Nicht verfügbar",
    "botdee.vs.intro": "Hier sind die aktuellen Versionsinformationen für FLOQR und BOT DEE.",
    "botdee.vs.frontendLabel": "FLOQR-Frontend",
    "botdee.vs.backendLabel": "FLOQR-Backend",
    "botdee.vs.privilegedHeading": "Privilegierte Diagnosen",
    "botdee.vs.privilegedNote": "Nur Master Admin. Diese Flags beweisen kein Produktions-Deploy.",
    "botdee.vs.deployedClaim": "Deploy-Angabe"
  },
  es: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "Información de sistema y versión",
    "botdee.vs.rowBotDee": "Versión BOT DEE",
    "botdee.vs.rowFloqr": "Versión FLOQR",
    "botdee.vs.rowModel": "Modelo de IA",
    "botdee.vs.rowStatus": "Estado del servicio",
    "botdee.vs.tabOverview": "Resumen",
    "botdee.vs.tabWhatsNew": "Novedades",
    "botdee.vs.tabHelp": "Ayuda",
    "botdee.vs.aboutHeading": "Acerca de BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE es el asistente integrado de FLOQR para descubrimiento, reservas y otras acciones autorizadas sobre personas, locales, eventos y servicios.",
    "botdee.vs.technical": "Detalles técnicos",
    "botdee.vs.techEnv": "Entorno de implementación",
    "botdee.vs.techBuild": "Identificador de build",
    "botdee.vs.techCheck": "Última comprobación de salud correcta",
    "botdee.vs.whatsNewHeading": "Novedades",
    "botdee.vs.whatsNewEmpty": "No hay notas de paquete verificadas para esta versión.",
    "botdee.vs.helpHeading": "Comando Version",
    "botdee.vs.helpBody": "Escriba Ver, Vers o Version para mostrar este SMARTview. El comando no distingue mayúsculas. Preguntas más largas como “what is your version?” siguen recibiendo una respuesta de texto más esta tarjeta.",
    "botdee.vs.footBrand": "FLOQR · Información del sistema",
    "botdee.vs.footUpdated": "Última actualización: {when}",
    "botdee.vs.unavailable": "No disponible",
    "botdee.vs.notChecked": "Sin comprobar",
    "botdee.vs.notUsedThisTurn": "No usado en este turno",
    "botdee.vs.configuredModel": "Configurado: {id}",
    "botdee.vs.statusNotChecked": "Sin comprobar",
    "botdee.vs.statusUnavailable": "No disponible",
    "botdee.vs.intro": "Aquí está la información de versión actual de FLOQR y BOT DEE.",
    "botdee.vs.frontendLabel": "Frontend FLOQR",
    "botdee.vs.backendLabel": "Backend FLOQR",
    "botdee.vs.privilegedHeading": "Diagnósticos privilegiados",
    "botdee.vs.privilegedNote": "Solo Master Admin. Estas banderas no demuestran un deploy de producción.",
    "botdee.vs.deployedClaim": "Declaración de deploy"
  },
  it: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "Informazioni di sistema e versione",
    "botdee.vs.rowBotDee": "Versione BOT DEE",
    "botdee.vs.rowFloqr": "Versione FLOQR",
    "botdee.vs.rowModel": "Modello IA",
    "botdee.vs.rowStatus": "Stato del servizio",
    "botdee.vs.tabOverview": "Panoramica",
    "botdee.vs.tabWhatsNew": "Novità",
    "botdee.vs.tabHelp": "Aiuto",
    "botdee.vs.aboutHeading": "Informazioni su BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE è l’assistente in-app di FLOQR per scoperta, prenotazioni e altre azioni autorizzate su persone, locali, eventi e servizi.",
    "botdee.vs.technical": "Dettagli tecnici",
    "botdee.vs.techEnv": "Ambiente di distribuzione",
    "botdee.vs.techBuild": "Identificatore di build",
    "botdee.vs.techCheck": "Ultimo controllo di integrità riuscito",
    "botdee.vs.whatsNewHeading": "Novità",
    "botdee.vs.whatsNewEmpty": "Nessuna nota di package verificata è disponibile per questa build.",
    "botdee.vs.helpHeading": "Comando Version",
    "botdee.vs.helpBody": "Inserisci Ver, Vers o Version per mostrare questo SMARTview. Il comando non distingue maiuscole. Domande più lunghe come “what is your version?” ricevono ancora una risposta testuale più questa scheda.",
    "botdee.vs.footBrand": "FLOQR · Informazioni di sistema",
    "botdee.vs.footUpdated": "Ultimo aggiornamento: {when}",
    "botdee.vs.unavailable": "Non disponibile",
    "botdee.vs.notChecked": "Non verificato",
    "botdee.vs.notUsedThisTurn": "Non usato in questo turno",
    "botdee.vs.configuredModel": "Configurato: {id}",
    "botdee.vs.statusNotChecked": "Non verificato",
    "botdee.vs.statusUnavailable": "Non disponibile",
    "botdee.vs.intro": "Ecco le informazioni di versione attuali per FLOQR e BOT DEE.",
    "botdee.vs.frontendLabel": "Frontend FLOQR",
    "botdee.vs.backendLabel": "Backend FLOQR",
    "botdee.vs.privilegedHeading": "Diagnostica privilegiata",
    "botdee.vs.privilegedNote": "Solo Master Admin. Questi flag non dimostrano un deploy di produzione.",
    "botdee.vs.deployedClaim": "Dichiarazione di deploy"
  },
  pt: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "Informações de sistema e versão",
    "botdee.vs.rowBotDee": "Versão BOT DEE",
    "botdee.vs.rowFloqr": "Versão FLOQR",
    "botdee.vs.rowModel": "Modelo de IA",
    "botdee.vs.rowStatus": "Estado do serviço",
    "botdee.vs.tabOverview": "Visão geral",
    "botdee.vs.tabWhatsNew": "Novidades",
    "botdee.vs.tabHelp": "Ajuda",
    "botdee.vs.aboutHeading": "Sobre o BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE é o assistente no app da FLOQR para descoberta, reservas e outras ações autorizadas em pessoas, locais, eventos e serviços.",
    "botdee.vs.technical": "Detalhes técnicos",
    "botdee.vs.techEnv": "Ambiente de implantação",
    "botdee.vs.techBuild": "Identificador de build",
    "botdee.vs.techCheck": "Última verificação de saúde bem-sucedida",
    "botdee.vs.whatsNewHeading": "Novidades",
    "botdee.vs.whatsNewEmpty": "Não há notas de pacote verificadas para esta build.",
    "botdee.vs.helpHeading": "Comando Version",
    "botdee.vs.helpBody": "Digite Ver, Vers ou Version para mostrar este SMARTview. O comando ignora maiúsculas. Perguntas mais longas como “what is your version?” ainda recebem uma resposta em texto mais este cartão.",
    "botdee.vs.footBrand": "FLOQR · Informações do sistema",
    "botdee.vs.footUpdated": "Última atualização: {when}",
    "botdee.vs.unavailable": "Indisponível",
    "botdee.vs.notChecked": "Não verificado",
    "botdee.vs.notUsedThisTurn": "Não usado nesta vez",
    "botdee.vs.configuredModel": "Configurado: {id}",
    "botdee.vs.statusNotChecked": "Não verificado",
    "botdee.vs.statusUnavailable": "Indisponível",
    "botdee.vs.intro": "Aqui estão as informações de versão atuais da FLOQR e do BOT DEE.",
    "botdee.vs.frontendLabel": "Frontend FLOQR",
    "botdee.vs.backendLabel": "Backend FLOQR",
    "botdee.vs.privilegedHeading": "Diagnósticos privilegiados",
    "botdee.vs.privilegedNote": "Apenas Master Admin. Estas flags não comprovam um deploy de produção.",
    "botdee.vs.deployedClaim": "Declaração de deploy"
  },
  nl: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "Systeem- en versie-informatie",
    "botdee.vs.rowBotDee": "BOT DEE-versie",
    "botdee.vs.rowFloqr": "FLOQR-versie",
    "botdee.vs.rowModel": "AI-model",
    "botdee.vs.rowStatus": "Servicestatus",
    "botdee.vs.tabOverview": "Overzicht",
    "botdee.vs.tabWhatsNew": "Nieuw",
    "botdee.vs.tabHelp": "Help",
    "botdee.vs.aboutHeading": "Over BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE is FLOQR’s in-app-assistent voor ontdekking, reserveringen en andere toegestane acties rond mensen, locaties, events en services.",
    "botdee.vs.technical": "Technische details",
    "botdee.vs.techEnv": "Deploy-omgeving",
    "botdee.vs.techBuild": "Build-identificatie",
    "botdee.vs.techCheck": "Laatste geslaagde healthcheck",
    "botdee.vs.whatsNewHeading": "Nieuw",
    "botdee.vs.whatsNewEmpty": "Er zijn geen geverifieerde packagenotities voor deze build.",
    "botdee.vs.helpHeading": "Version-opdracht",
    "botdee.vs.helpBody": "Typ Ver, Vers of Version om dit SMARTview te tonen. De opdracht negeert hoofdletters. Langere vragen zoals “what is your version?” krijgen nog een tekstantwoord plus deze kaart.",
    "botdee.vs.footBrand": "FLOQR · Systeeminformatie",
    "botdee.vs.footUpdated": "Laatst bijgewerkt: {when}",
    "botdee.vs.unavailable": "Niet beschikbaar",
    "botdee.vs.notChecked": "Niet gecontroleerd",
    "botdee.vs.notUsedThisTurn": "Niet gebruikt deze beurt",
    "botdee.vs.configuredModel": "Geconfigureerd: {id}",
    "botdee.vs.statusNotChecked": "Niet gecontroleerd",
    "botdee.vs.statusUnavailable": "Niet beschikbaar",
    "botdee.vs.intro": "Hier is de huidige versie-informatie voor FLOQR en BOT DEE.",
    "botdee.vs.frontendLabel": "FLOQR-frontend",
    "botdee.vs.backendLabel": "FLOQR-backend",
    "botdee.vs.privilegedHeading": "Bevoorrechte diagnostiek",
    "botdee.vs.privilegedNote": "Alleen Master Admin. Deze flags bewijzen geen productie-deploy.",
    "botdee.vs.deployedClaim": "Deploy-claim"
  },
  ru: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "Сведения о системе и версии",
    "botdee.vs.rowBotDee": "Версия BOT DEE",
    "botdee.vs.rowFloqr": "Версия FLOQR",
    "botdee.vs.rowModel": "Модель ИИ",
    "botdee.vs.rowStatus": "Состояние службы",
    "botdee.vs.tabOverview": "Обзор",
    "botdee.vs.tabWhatsNew": "Что нового",
    "botdee.vs.tabHelp": "Справка",
    "botdee.vs.aboutHeading": "О BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE — встроенный помощник FLOQR для поиска, бронирования и других разрешённых действий по людям, площадкам, событиям и сервисам.",
    "botdee.vs.technical": "Технические сведения",
    "botdee.vs.techEnv": "Среда развёртывания",
    "botdee.vs.techBuild": "Идентификатор сборки",
    "botdee.vs.techCheck": "Последняя успешная проверка состояния",
    "botdee.vs.whatsNewHeading": "Что нового",
    "botdee.vs.whatsNewEmpty": "Для этой сборки нет проверенных заметок пакета.",
    "botdee.vs.helpHeading": "Команда Version",
    "botdee.vs.helpBody": "Введите Ver, Vers или Version, чтобы показать этот SMARTview. Регистр не важен. Более длинные вопросы вроде «what is your version?» по-прежнему получают текстовый ответ плюс эту карточку.",
    "botdee.vs.footBrand": "FLOQR · Системная информация",
    "botdee.vs.footUpdated": "Обновлено: {when}",
    "botdee.vs.unavailable": "Недоступно",
    "botdee.vs.notChecked": "Не проверено",
    "botdee.vs.notUsedThisTurn": "Не использовано в этом ходе",
    "botdee.vs.configuredModel": "Настроено: {id}",
    "botdee.vs.statusNotChecked": "Не проверено",
    "botdee.vs.statusUnavailable": "Недоступно",
    "botdee.vs.intro": "Текущая информация о версии FLOQR и BOT DEE.",
    "botdee.vs.frontendLabel": "Фронтенд FLOQR",
    "botdee.vs.backendLabel": "Бэкенд FLOQR",
    "botdee.vs.privilegedHeading": "Привилегированная диагностика",
    "botdee.vs.privilegedNote": "Только Master Admin. Эти флаги не подтверждают продакшен-деплой.",
    "botdee.vs.deployedClaim": "Заявление о деплое"
  },
  el: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "Πληροφορίες συστήματος και έκδοσης",
    "botdee.vs.rowBotDee": "Έκδοση BOT DEE",
    "botdee.vs.rowFloqr": "Έκδοση FLOQR",
    "botdee.vs.rowModel": "Μοντέλο ΤΝ",
    "botdee.vs.rowStatus": "Κατάσταση υπηρεσίας",
    "botdee.vs.tabOverview": "Επισκόπηση",
    "botdee.vs.tabWhatsNew": "Νέα",
    "botdee.vs.tabHelp": "Βοήθεια",
    "botdee.vs.aboutHeading": "Σχετικά με το BOT DEE",
    "botdee.vs.aboutBody": "Το BOT DEE είναι ο βοηθός εντός εφαρμογής της FLOQR για ανακάλυψη, κρατήσεις και άλλες εξουσιοδοτημένες ενέργειες σε άτομα, χώρους, εκδηλώσεις και υπηρεσίες.",
    "botdee.vs.technical": "Τεχνικές λεπτομέρειες",
    "botdee.vs.techEnv": "Περιβάλλον ανάπτυξης",
    "botdee.vs.techBuild": "Αναγνωριστικό build",
    "botdee.vs.techCheck": "Τελευταίος επιτυχής έλεγχος υγείας",
    "botdee.vs.whatsNewHeading": "Νέα",
    "botdee.vs.whatsNewEmpty": "Δεν υπάρχουν επαληθευμένες σημειώσεις πακέτου για αυτό το build.",
    "botdee.vs.helpHeading": "Εντολή Version",
    "botdee.vs.helpBody": "Πληκτρολογήστε Ver, Vers ή Version για αυτό το SMARTview. Η εντολή αγνοεί πεζά/κεφαλαία. Μεγαλύτερες ερωτήσεις όπως «what is your version;» παίρνουν ακόμη κείμενο συν αυτή την κάρτα.",
    "botdee.vs.footBrand": "FLOQR · Πληροφορίες συστήματος",
    "botdee.vs.footUpdated": "Τελευταία ενημέρωση: {when}",
    "botdee.vs.unavailable": "Μη διαθέσιμο",
    "botdee.vs.notChecked": "Δεν ελέγχθηκε",
    "botdee.vs.notUsedThisTurn": "Δεν χρησιμοποιήθηκε σε αυτόν τον γύρο",
    "botdee.vs.configuredModel": "Ρυθμισμένο: {id}",
    "botdee.vs.statusNotChecked": "Δεν ελέγχθηκε",
    "botdee.vs.statusUnavailable": "Μη διαθέσιμο",
    "botdee.vs.intro": "Αυτές είναι οι τρέχουσες πληροφορίες έκδοσης για FLOQR και BOT DEE.",
    "botdee.vs.frontendLabel": "Frontend FLOQR",
    "botdee.vs.backendLabel": "Backend FLOQR",
    "botdee.vs.privilegedHeading": "Προνομιακή διάγνωση",
    "botdee.vs.privilegedNote": "Μόνο Master Admin. Αυτές οι σημαίες δεν αποδεικνύουν production deploy.",
    "botdee.vs.deployedClaim": "Δήλωση deploy"
  },
  pl: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "Informacje o systemie i wersji",
    "botdee.vs.rowBotDee": "Wersja BOT DEE",
    "botdee.vs.rowFloqr": "Wersja FLOQR",
    "botdee.vs.rowModel": "Model AI",
    "botdee.vs.rowStatus": "Status usługi",
    "botdee.vs.tabOverview": "Przegląd",
    "botdee.vs.tabWhatsNew": "Nowości",
    "botdee.vs.tabHelp": "Pomoc",
    "botdee.vs.aboutHeading": "O BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE to asystent FLOQR w aplikacji do odkrywania, rezerwacji i innych dozwolonych działań wobec osób, lokali, wydarzeń i usług.",
    "botdee.vs.technical": "Szczegóły techniczne",
    "botdee.vs.techEnv": "Środowisko wdrożenia",
    "botdee.vs.techBuild": "Identyfikator buildu",
    "botdee.vs.techCheck": "Ostatnie udane sprawdzenie stanu",
    "botdee.vs.whatsNewHeading": "Nowości",
    "botdee.vs.whatsNewEmpty": "Brak zweryfikowanych notatek pakietu dla tego buildu.",
    "botdee.vs.helpHeading": "Polecenie Version",
    "botdee.vs.helpBody": "Wpisz Ver, Vers lub Version, aby pokazać ten SMARTview. Polecenie ignoruje wielkość liter. Dłuższe pytania jak „what is your version?” nadal dostają odpowiedź tekstową plus tę kartę.",
    "botdee.vs.footBrand": "FLOQR · Informacje systemowe",
    "botdee.vs.footUpdated": "Ostatnia aktualizacja: {when}",
    "botdee.vs.unavailable": "Niedostępne",
    "botdee.vs.notChecked": "Nie sprawdzono",
    "botdee.vs.notUsedThisTurn": "Nie użyto w tej turze",
    "botdee.vs.configuredModel": "Skonfigurowano: {id}",
    "botdee.vs.statusNotChecked": "Nie sprawdzono",
    "botdee.vs.statusUnavailable": "Niedostępne",
    "botdee.vs.intro": "Oto bieżące informacje o wersji FLOQR i BOT DEE.",
    "botdee.vs.frontendLabel": "Frontend FLOQR",
    "botdee.vs.backendLabel": "Backend FLOQR",
    "botdee.vs.privilegedHeading": "Diagnostyka uprzywilejowana",
    "botdee.vs.privilegedNote": "Tylko Master Admin. Te flagi nie potwierdzają wdrożenia produkcyjnego.",
    "botdee.vs.deployedClaim": "Deklaracja wdrożenia"
  },
  ar: {
    "botdee.vs.title": "BOT DEE — Version SMARTview",
    "botdee.vs.identityName": "BOT DEE",
    "botdee.vs.identitySub": "معلومات النظام والإصدار",
    "botdee.vs.rowBotDee": "إصدار BOT DEE",
    "botdee.vs.rowFloqr": "إصدار FLOQR",
    "botdee.vs.rowModel": "نموذج الذكاء الاصطناعي",
    "botdee.vs.rowStatus": "حالة الخدمة",
    "botdee.vs.tabOverview": "نظرة عامة",
    "botdee.vs.tabWhatsNew": "ما الجديد",
    "botdee.vs.tabHelp": "مساعدة",
    "botdee.vs.aboutHeading": "عن BOT DEE",
    "botdee.vs.aboutBody": "BOT DEE هو مساعد FLOQR داخل التطبيق للاكتشاف والحجوزات وإجراءات مصرّح بها أخرى حول الأشخاص والأماكن والفعاليات والخدمات.",
    "botdee.vs.technical": "تفاصيل تقنية",
    "botdee.vs.techEnv": "بيئة النشر",
    "botdee.vs.techBuild": "معرّف البناء",
    "botdee.vs.techCheck": "آخر فحص صحة ناجح",
    "botdee.vs.whatsNewHeading": "ما الجديد",
    "botdee.vs.whatsNewEmpty": "لا توجد ملاحظات حزمة موثّقة لهذا البناء.",
    "botdee.vs.helpHeading": "أمر Version",
    "botdee.vs.helpBody": "أدخل Ver أو Vers أو Version لعرض SMARTview هذا. الأمر لا يراعي حالة الأحرف. الأسئلة الأطول مثل “what is your version?” ما زالت تحصل على رد نصي بالإضافة إلى هذه البطاقة.",
    "botdee.vs.footBrand": "FLOQR · معلومات النظام",
    "botdee.vs.footUpdated": "آخر تحديث: {when}",
    "botdee.vs.unavailable": "غير متاح",
    "botdee.vs.notChecked": "لم يُتحقق",
    "botdee.vs.notUsedThisTurn": "لم يُستخدم في هذه الجولة",
    "botdee.vs.configuredModel": "مُعدّ: {id}",
    "botdee.vs.statusNotChecked": "لم يُتحقق",
    "botdee.vs.statusUnavailable": "غير متاح",
    "botdee.vs.intro": "هذه معلومات الإصدار الحالية لـ FLOQR وBOT DEE.",
    "botdee.vs.frontendLabel": "واجهة FLOQR",
    "botdee.vs.backendLabel": "خلفية FLOQR",
    "botdee.vs.privilegedHeading": "تشخيصات مميزة",
    "botdee.vs.privilegedNote": "Master Admin فقط. هذه العلامات لا تثبت نشراً إنتاجياً.",
    "botdee.vs.deployedClaim": "ادعاء النشر"
  }
};

const HELP = {
  "help-botdee-version-smartview": {
    en: {
      title: "Version SMARTview",
      body: "In BOT DEE chat, type Ver, Vers, or Version (any capitalization, optional ?). A Version SMARTview card opens in the same bubble. It shows the real FLOQR package stamp, whether this turn used an AI model, and service status. Numbers in design pictures are examples — live values come from the app. Site Chrome follows your Appearance theme."
    },
    de: {
      title: "Version SMARTview",
      body: "Im BOT DEE-Chat tippen Sie Ver, Vers oder Version (Groß/Klein egal, optional ?). Eine Version-SMARTview-Karte öffnet sich in derselben Blase. Sie zeigt den echten FLOQR-Package-Stempel, ob dieser Zug ein KI-Modell genutzt hat, und den Dienststatus. Zahlen in Designbildern sind Beispiele — Live-Werte kommen aus der App. Site Chrome folgt Ihrem Appearance-Thema."
    },
    fr: {
      title: "Version SMARTview",
      body: "Dans le chat BOT DEE, saisissez Ver, Vers ou Version (casse indifférente, ? optionnel). Une carte Version SMARTview s’ouvre dans la même bulle. Elle affiche le vrai tampon de package FLOQR, si ce tour a utilisé un modèle d’IA, et l’état du service. Les chiffres des visuels de design sont des exemples — les valeurs live viennent de l’app. Site Chrome suit votre thème Appearance."
    },
    es: {
      title: "Version SMARTview",
      body: "En el chat de BOT DEE, escriba Ver, Vers o Version (mayúsculas da igual, ? opcional). Se abre una tarjeta Version SMARTview en la misma burbuja. Muestra el sello real del paquete FLOQR, si este turno usó un modelo de IA y el estado del servicio. Los números de las imágenes de diseño son ejemplos — los valores en vivo salen de la app. Site Chrome sigue su tema de Appearance."
    },
    it: {
      title: "Version SMARTview",
      body: "Nella chat BOT DEE, digita Ver, Vers o Version (maiuscole indifferenti, ? opzionale). Si apre una scheda Version SMARTview nella stessa bolla. Mostra il vero timbro del package FLOQR, se questo turno ha usato un modello IA e lo stato del servizio. I numeri nelle immagini di design sono esempi — i valori live arrivano dall’app. Site Chrome segue il tema Appearance."
    },
    pt: {
      title: "Version SMARTview",
      body: "No chat BOT DEE, digite Ver, Vers ou Version (maiúsculas não importam, ? opcional). Um cartão Version SMARTview abre no mesmo balão. Mostra o carimbo real do pacote FLOQR, se esta vez usou um modelo de IA e o estado do serviço. Números nas imagens de design são exemplos — os valores ao vivo vêm do app. Site Chrome segue o tema Appearance."
    },
    nl: {
      title: "Version SMARTview",
      body: "Typ in de BOT DEE-chat Ver, Vers of Version (hoofdletters maken niet uit, ? optioneel). Er opent een Version SMARTview-kaart in dezelfde bubble. Die toont de echte FLOQR-packagestempel, of deze beurt een AI-model gebruikte, en de servicestatus. Cijfers op ontwerpbeelden zijn voorbeelden — live waarden komen uit de app. Site Chrome volgt je Appearance-thema."
    },
    ru: {
      title: "Version SMARTview",
      body: "В чате BOT DEE введите Ver, Vers или Version (регистр не важен, ? по желанию). Карточка Version SMARTview открывается в том же пузыре. На ней реальный штамп пакета FLOQR, использовалась ли модель ИИ в этом ходе, и статус службы. Цифры на дизайн-макетах — примеры; живые значения берутся из приложения. Site Chrome следует теме Appearance."
    },
    el: {
      title: "Version SMARTview",
      body: "Στη συνομιλία BOT DEE πληκτρολογήστε Ver, Vers ή Version (κεφαλαία αδιάφορα, προαιρετικό ;). Ανοίγει κάρτα Version SMARTview στην ίδια φυσαλίδα. Δείχνει την πραγματική σφραγίδα πακέτου FLOQR, αν αυτός ο γύρος χρησιμοποίησε μοντέλο ΤΝ και την κατάσταση υπηρεσίας. Οι αριθμοί στις εικόνες σχεδίασης είναι παραδείγματα — οι ζωντανές τιμές έρχονται από την εφαρμογή. Το Site Chrome ακολουθεί το θέμα Appearance."
    },
    pl: {
      title: "Version SMARTview",
      body: "W czacie BOT DEE wpisz Ver, Vers lub Version (wielkość liter nieważna, opcjonalny ?). Karta Version SMARTview otwiera się w tej samej dymku. Pokazuje prawdziwy stempel pakietu FLOQR, czy ta tura użyła modelu AI i status usługi. Liczby na obrazach projektu to przykłady — żywe wartości pochodzą z aplikacji. Site Chrome idzie za motywem Appearance."
    },
    ar: {
      title: "Version SMARTview",
      body: "في دردشة BOT DEE اكتب Ver أو Vers أو Version (حجم الأحرف لا يهم، ? اختياري). تُفتح بطاقة Version SMARTview في نفس الفقاعة. تعرض ختم حزمة FLOQR الحقيقي، وما إذا استخدم هذا الدور نموذجاً للذكاء الاصطناعي، وحالة الخدمة. الأرقام في صور التصميم أمثلة — القيم الحية تأتي من التطبيق. يتبع Site Chrome مظهر Appearance."
    }
  },
  "help-botdee-version-smartview-status": {
    en: {
      title: "Version SMARTview status is honest",
      body: "Service status is Not checked until FLOQR actually probes the service. The card never shows Operational from a picture or a guess. AI model is Not used this turn on the Version command because that path does not call Gemini. Frontend and backend package stamps can differ; both are labeled. Master Admin may see extra diagnostics after Technical Details — patrons do not."
    },
    de: {
      title: "Version-SMARTview-Status ist ehrlich",
      body: "Der Dienststatus ist Nicht geprüft, bis FLOQR den Dienst wirklich prüft. Die Karte zeigt nie Operational aus einem Bild oder einer Vermutung. Das KI-Modell ist In diesem Zug nicht verwendet, weil der Version-Befehl Gemini nicht aufruft. Frontend- und Backend-Stempel können sich unterscheiden; beide sind beschriftet. Master Admin sieht extra Diagnosen unter Technische Details — Gäste nicht."
    },
    fr: {
      title: "L’état Version SMARTview est honnête",
      body: "L’état du service est Non vérifié tant que FLOQR n’a pas réellement sondé le service. La carte n’affiche jamais Operational d’après une image ou une supposition. Le modèle d’IA est Non utilisé ce tour car la commande Version n’appelle pas Gemini. Les tampons frontend et backend peuvent différer ; les deux sont étiquetés. Master Admin peut voir des diagnostics sous Détails techniques — pas les patrons."
    },
    es: {
      title: "El estado de Version SMARTview es honesto",
      body: "El estado del servicio es Sin comprobar hasta que FLOQR sondee de verdad el servicio. La tarjeta nunca muestra Operational por una imagen o una suposición. El modelo de IA es No usado en este turno porque el comando Version no llama a Gemini. Los sellos de frontend y backend pueden diferir; ambos se etiquetan. Master Admin puede ver diagnósticos extra en Detalles técnicos — los patrons no."
    },
    it: {
      title: "Lo stato Version SMARTview è onesto",
      body: "Lo stato del servizio è Non verificato finché FLOQR non sonda davvero il servizio. La scheda non mostra mai Operational da un’immagine o da una stima. Il modello IA è Non usato in questo turno perché il comando Version non chiama Gemini. I timbri frontend e backend possono differire; entrambi sono etichettati. Master Admin può vedere diagnostica extra in Dettagli tecnici — i patron no."
    },
    pt: {
      title: "O estado do Version SMARTview é honesto",
      body: "O estado do serviço é Não verificado até a FLOQR realmente sondar o serviço. O cartão nunca mostra Operational a partir de uma imagem ou palpite. O modelo de IA é Não usado nesta vez porque o comando Version não chama o Gemini. Os carimbos de frontend e backend podem diferir; ambos são rotulados. Master Admin pode ver diagnósticos extra em Detalhes técnicos — patrons não."
    },
    nl: {
      title: "Version SMARTview-status is eerlijk",
      body: "Servicestatus is Niet gecontroleerd tot FLOQR de dienst echt peilt. De kaart toont nooit Operational uit een plaatje of een gok. Het AI-model is Niet gebruikt deze beurt omdat het Version-commando Gemini niet aanroept. Frontend- en backendstempels kunnen verschillen; beide zijn gelabeld. Master Admin kan extra diagnostiek zien onder Technische details — patrons niet."
    },
    ru: {
      title: "Статус Version SMARTview честный",
      body: "Состояние службы — Не проверено, пока FLOQR реально не опросит службу. Карточка никогда не показывает Operational с картинки или догадки. Модель ИИ — Не использовано в этом ходе, потому что команда Version не вызывает Gemini. Штампы фронтенда и бэкенда могут различаться; оба подписаны. Master Admin видит доп. диагностику в технических сведениях — гости нет."
    },
    el: {
      title: "Η κατάσταση Version SMARTview είναι ειλικρινής",
      body: "Η κατάσταση υπηρεσίας είναι Δεν ελέγχθηκε μέχρι η FLOQR να ελέγξει πραγματικά την υπηρεσία. Η κάρτα δεν δείχνει ποτέ Operational από εικόνα ή εικασία. Το μοντέλο ΤΝ είναι Δεν χρησιμοποιήθηκε σε αυτόν τον γύρο γιατί η εντολή Version δεν καλεί Gemini. Τα σφραγίσματα frontend και backend μπορεί να διαφέρουν· και τα δύο έχουν ετικέτα. Ο Master Admin μπορεί να δει επιπλέον διάγνωση στις Τεχνικές λεπτομέρειες — οι patrons όχι."
    },
    pl: {
      title: "Status Version SMARTview jest uczciwy",
      body: "Status usługi to Nie sprawdzono, dopóki FLOQR naprawdę nie zbada usługi. Karta nigdy nie pokazuje Operational z obrazka ani zgadywania. Model AI to Nie użyto w tej turze, bo polecenie Version nie woła Gemini. Stemple frontendu i backendu mogą się różnić; oba są opisane. Master Admin może zobaczyć dodatkową diagnostykę w Szczegółach technicznych — patroni nie."
    },
    ar: {
      title: "حالة Version SMARTview صادقة",
      body: "حالة الخدمة «لم يُتحقق» حتى تفحص FLOQR الخدمة فعلاً. لا تعرض البطاقة Operational من صورة أو تخمين. نموذج الذكاء الاصطناعي «لم يُستخدم في هذه الجولة» لأن أمر Version لا يستدعي Gemini. يمكن أن يختلف ختم الواجهة عن الخلفية؛ كلاهما مُسمّى. قد يرى Master Admin تشخيصاً إضافياً تحت التفاصيل التقنية — الضيوف لا."
    }
  },
  "help-botdee-version-smartview-tabs": {
    en: {
      title: "Version SMARTview tabs",
      body: "Overview describes BOT DEE and opens Technical Details without leaving chat. What's New lists verified FLOQR package notes from the current README. Help repeats the Ver / Vers / Version command. Switching tabs or expanding details keeps your unsent draft and scroll. The card uses your Site Chrome — there is no second theme."
    },
    de: {
      title: "Version-SMARTview-Reiter",
      body: "Übersicht beschreibt BOT DEE und öffnet Technische Details ohne den Chat zu verlassen. Neuigkeiten listet geprüfte FLOQR-Package-Hinweise aus der aktuellen README. Hilfe wiederholt den Befehl Ver / Vers / Version. Reiterwechsel oder Aufklappen behält den ungesendeten Entwurf und den Scroll. Die Karte nutzt Ihr Site Chrome — kein zweites Thema."
    },
    fr: {
      title: "Onglets Version SMARTview",
      body: "Aperçu décrit BOT DEE et ouvre les Détails techniques sans quitter le chat. Nouveautés liste les notes de package FLOQR vérifiées du README actuel. Aide répète la commande Ver / Vers / Version. Changer d’onglet ou déplier garde le brouillon non envoyé et le défilement. La carte utilise votre Site Chrome — pas de second thème."
    },
    es: {
      title: "Pestañas de Version SMARTview",
      body: "Resumen describe BOT DEE y abre Detalles técnicos sin salir del chat. Novedades lista notas de paquete FLOQR verificadas del README actual. Ayuda repite el comando Ver / Vers / Version. Cambiar de pestaña o expandir conserva el borrador no enviado y el scroll. La tarjeta usa su Site Chrome — no hay un segundo tema."
    },
    it: {
      title: "Schede Version SMARTview",
      body: "Panoramica descrive BOT DEE e apre Dettagli tecnici senza uscire dalla chat. Novità elenca note di package FLOQR verificate dal README attuale. Aiuto ripete il comando Ver / Vers / Version. Cambiare scheda o espandere tiene la bozza non inviata e lo scorrimento. La scheda usa il tuo Site Chrome — non c’è un secondo tema."
    },
    pt: {
      title: "Abas do Version SMARTview",
      body: "Visão geral descreve o BOT DEE e abre Detalhes técnicos sem sair do chat. Novidades lista notas de pacote FLOQR verificadas do README atual. Ajuda repete o comando Ver / Vers / Version. Trocar de aba ou expandir mantém o rascunho não enviado e a rolagem. O cartão usa o seu Site Chrome — não há um segundo tema."
    },
    nl: {
      title: "Version SMARTview-tabbladen",
      body: "Overzicht beschrijft BOT DEE en opent Technische details zonder de chat te verlaten. Nieuw toont geverifieerde FLOQR-packagenotities uit de huidige README. Help herhaalt het commando Ver / Vers / Version. Tab wisselen of uitklappen bewaart je onverzonden concept en scroll. De kaart gebruikt jouw Site Chrome — er is geen tweede thema."
    },
    ru: {
      title: "Вкладки Version SMARTview",
      body: "Обзор описывает BOT DEE и открывает технические сведения, не покидая чат. Что нового — проверенные заметки пакета FLOQR из текущего README. Справка повторяет команду Ver / Vers / Version. Смена вкладки или раскрытие сохраняет неотправленный черновик и прокрутку. Карточка берёт ваш Site Chrome — второй темы нет."
    },
    el: {
      title: "Καρτέλες Version SMARTview",
      body: "Η Επισκόπηση περιγράφει το BOT DEE και ανοίγει Τεχνικές λεπτομέρειες χωρίς να φύγετε από τη συνομιλία. Νέα δείχνει επαληθευμένες σημειώσεις πακέτου FLOQR από το τρέχον README. Βοήθεια επαναλαμβάνει την εντολή Ver / Vers / Version. Αλλαγή καρτέλας ή ανάπτυξη κρατά το μη σταλμένο πρόχειρο και την κύλιση. Η κάρτα χρησιμοποιεί το Site Chrome σας — δεν υπάρχει δεύτερο θέμα."
    },
    pl: {
      title: "Karty Version SMARTview",
      body: "Przegląd opisuje BOT DEE i otwiera Szczegóły techniczne bez opuszczania czatu. Nowości wypisuje zweryfikowane notatki pakietu FLOQR z bieżącego README. Pomoc powtarza polecenie Ver / Vers / Version. Zmiana karty lub rozwinięcie zostawia niewysłany szkic i przewijanie. Karta używa Twojego Site Chrome — nie ma drugiego motywu."
    },
    ar: {
      title: "علامات Version SMARTview",
      body: "نظرة عامة تصف BOT DEE وتفتح التفاصيل التقنية دون مغادرة الدردشة. ما الجديد يعرض ملاحظات حزمة FLOQR الموثّقة من README الحالي. المساعدة تكرر أمر Ver / Vers / Version. تبديل العلامات أو توسيع التفاصيل يبقي المسودة غير المُرسلة والتمرير. البطاقة تستخدم Site Chrome لديك — لا يوجد مظهر ثانٍ."
    }
  }
};

function packLines(map) {
  return Object.entries(map).map(([key, value]) => `      ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join("\n");
}

function helpBlock(lang) {
  return Object.entries(HELP).map(([id, byLang]) => {
    const row = byLang[lang];
    return `      ${JSON.stringify(id)}: {\n        title: ${JSON.stringify(row.title)},\n        body: ${JSON.stringify(row.body)}\n      },`;
  }).join("\n");
}

function injectChrome() {
  const file = path.join(root, "floqr-i18n.js");
  let src = fs.readFileSync(file, "utf8");
  const langs = ["en", "fr", "de", "es", "it", "pt", "ru", "nl", "el", "pl", "ar"];
  langs.forEach(lang => {
    const pack = CHROME[lang];
    if (!pack) throw new Error(`missing chrome ${lang}`);
    const re = new RegExp(`("botdee\\.sv\\.videoCount":\\s*"[^"]*",)`);
    const hits = [];
    src.replace(re, (m, p1, offset) => {
      hits.push(offset);
      return m;
    });
  });
  let count = 0;
  src = src.replace(/("botdee\.sv\.videoCount":\s*"[^"]*",)/g, (full, _g, offset) => {
    if (src.slice(offset, offset + 400).includes('"botdee.vs.title"')) return full;
    const before = src.slice(0, offset);
    const enCount = (before.match(/en:\s*\{/g) || []).length;
    const langOrder = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
    const idx = Math.min(count, langOrder.length - 1);
    const lang = langOrder[idx];
    count += 1;
    const pack = CHROME[lang];
    if (!pack) throw new Error(`no pack for slot ${idx}`);
    return `${full}\n${packLines(pack)}`;
  });
  if (count !== 11) throw new Error(`expected 11 chrome injections, got ${count} (enCount probe)`);
  fs.writeFileSync(file, src);
  console.log("chrome keys injected", count);
}

function injectHelpJs() {
  const file = path.join(root, "floqr-i18n-help.js");
  let src = fs.readFileSync(file, "utf8");
  const langs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
  let count = 0;
  src = src.replace(/("help-botdee-smartview-troubleshoot":\s*\{[\s\S]*?\n\s*\},)/g, (full, _g, offset) => {
    if (src.slice(offset, offset + 500).includes("help-botdee-version-smartview")) return full;
    const lang = langs[count];
    count += 1;
    if (!lang) throw new Error("extra help pack");
    return `${full}\n${helpBlock(lang)}`;
  });
  if (count !== 10) throw new Error(`expected 10 help injections, got ${count}`);
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

injectChrome();
injectHelpJs();
injectHelpEn();
console.log("chrome key count", Object.keys(CHROME.en).length);
