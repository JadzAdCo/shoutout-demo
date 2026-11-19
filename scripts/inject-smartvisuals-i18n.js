#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const q = s => JSON.stringify(s);
const CHROME_ORDER = ["en", "fr", "de", "es", "nl", "ru", "it", "pt", "el", "pl", "ar"];
const AFTER = `"master.featuresAuditTrail"`;

const KEYS = [
  "master.smartvisualStudio", "master.smartvisualStudioIntro", "master.smartvisualLibrary",
  "master.smartvisualCreate", "master.smartvisualTagging", "master.smartvisualReview",
  "master.smartvisualDiagnostics", "master.smartvisualAds", "master.smartvisualSearch",
  "sv.notifyTitle", "sv.youAreInvited", "sv.invitedYou", "sv.cancunBlurb", "sv.todayTime",
  "sv.you", "sv.statusAccepted", "sv.statusLive", "sv.statusPending", "sv.statusDeclined",
  "sv.tagTravel", "sv.tagFashion", "sv.tagPlanning", "sv.tagReservations", "sv.tagItinerary",
  "sv.tagRoom", "sv.dismiss", "sv.scenicAlt", "sv.untitled", "sv.unscheduled", "sv.participants",
  "sv.viewInvitation", "sv.notNow", "sv.demoFlag", "sv.roomTitle", "sv.host", "sv.isInviting",
  "sv.liveInRoom", "sv.invite", "sv.noParticipants", "sv.botdeePrompt", "sv.capItinerary",
  "sv.capReservations", "sv.capTickets", "sv.capFriends", "sv.capServices", "sv.joinNow",
  "sv.or", "sv.joinScheduled", "sv.scheduled", "sv.adLabel", "sv.adTravelPartner", "sv.adDisabled",
  "sv.adPolicyBody", "sv.studioEmpty", "sv.studioCount", "sv.licenseNote", "sv.previewNotify",
  "sv.previewRoom", "sv.diagRevision", "sv.diagGemini", "sv.diagAds", "sv.diagAssets", "sv.diagPii",
  "sv.studioNeedMeta", "sv.studioSvgDenied", "sv.studioNeedReason", "sv.cancelled",
  "sv.studioPublishSummary", "sv.studioQueued", "sv.studioDenied", "sv.studioSvgHint",
  "sv.studioSubmit", "sv.studioTagHint", "sv.studioReviewHint", "sv.studioDetail"
];

const T = {
  en: [
    "SMARTvisual Studio", "Approved SMARTstencils and SMARTbackgrounds. Drafts never reach patrons until an audited publish. Scenic art is illustration, not photography.",
    "Library", "Create / Edit", "Tagging & Resolver", "Review / Publish", "Usage & Diagnostics", "Ads / Placement", "Search name, tag, place",
    "Mingl Room Invitation", "You are invited to join a Mingl Room.", "{name} invited you to join a Mingl Room.",
    "Let's plan our Cancun trip together with BOT-DEE.", "Today, 7:00 PM ET", "You", "Accepted", "Live", "Pending", "Declined",
    "Travel", "Fashion", "Planning", "Reservations", "Itinerary", "Mingl Room", "Close",
    "Scenic illustration for this room. Not a photograph.", "Mingl Room", "Time to be confirmed", "Participants",
    "View Invitation", "Not Now", "Demo / synthetic — not a live invitation", "Mingl Room Invitation", "Host",
    "is inviting you to a Mingl Room.", "Live in Room", "Invite", "Participant names appear only for room members.",
    "Use Mingl chat to work with BOT DEE to:", "Plan Itinerary", "Make Reservations", "Get Tickets", "Coordinate with Friends",
    "Execute More Services", "Join Now", "or", "Join at Scheduled Time", "Scheduled", "Ad", "Travel partner",
    "Sponsored placement is off until separately approved.", "Independent labeled slot below Room SMARTview. AdSense is not loaded. No fill, no consent prompt, and no targeting from room or BOT DEE content until a separate approval.",
    "No assets match.", "{n} packaged published assets", "Original FLOQR illustration. Not a photograph or official mark.",
    "Preview in Search SMARTnotification", "Preview in Room SMARTview", "Registry revision", "Gemini on view", "Ads enabled",
    "Published assets", "Diagnostics never include private BOT DEE history, member profiles, or SMARTsummary.",
    "Name and license are required.", "SVG rejected: {reason}", "Reason prompt module missing — nothing was saved.",
    "Cancelled — nothing was saved.", "SMARTvisuals: submit draft for review", "Draft queued for review ({id}). Not visible to patrons.",
    "Publish denied.", "SVG is sanitized. Scripts, foreignObject, event handlers, and external hrefs are rejected. Preview uses img, never inline untrusted SVG.",
    "Submit for review", "Synthetic titles only. The resolver never reads private chat. Gemini is not called on card view.",
    "Git-backed registry.json is the published source of truth. SOS2FA + reason required. Drafts stay off Search and Room SMARTview.",
    "Asset detail / live preview"
  ],
  fr: [
    "SMARTvisual Studio", "SMARTstencils et SMARTbackgrounds approuvés. Les brouillons n’atteignent pas les patrons avant une publication auditée. L’art est une illustration, pas une photo.",
    "Bibliothèque", "Créer / Modifier", "Tags et résolveur", "Revue / Publier", "Usage et diagnostics", "Pubs / emplacement", "Rechercher nom, tag, lieu",
    "Invitation Mingl Room", "Vous êtes invité à rejoindre une Mingl Room.", "{name} vous a invité à rejoindre une Mingl Room.",
    "Planifions notre voyage à Cancun avec BOT-DEE.", "Aujourd’hui, 19 h ET", "Vous", "Accepté", "En direct", "En attente", "Refusé",
    "Voyage", "Mode", "Organisation", "Réservations", "Itinéraire", "Mingl Room", "Fermer",
    "Illustration de cette room. Ce n’est pas une photographie.", "Mingl Room", "Horaire à confirmer", "Participants",
    "Voir l’invitation", "Pas maintenant", "Démo / synthétique — pas une invitation réelle", "Invitation Mingl Room", "Hôte",
    "vous invite dans une Mingl Room.", "En direct dans la room", "Inviter", "Les noms n’apparaissent que pour les membres.",
    "Utilisez le chat Mingl avec BOT DEE pour :", "Planifier l’itinéraire", "Faire des réservations", "Obtenir des billets", "Coordonner avec des amis",
    "Exécuter d’autres services", "Rejoindre maintenant", "ou", "Rejoindre à l’heure prévue", "Planifié", "Pub", "Partenaire voyage",
    "L’emplacement sponsorisé est désactivé jusqu’à une approbation séparée.", "Emplacement étiqueté sous Room SMARTview. AdSense n’est pas chargé. Pas de remplissage, pas de consentement, pas de ciblage à partir de la room ou de BOT DEE tant qu’une revue séparée n’a pas lieu.",
    "Aucun élément.", "{n} ressources publiées", "Illustration originale FLOQR. Pas une photo ni une marque officielle.",
    "Aperçu invitation Recherche", "Aperçu Room SMARTview", "Révision du registre", "Gemini à l’affichage", "Pubs activées",
    "Ressources publiées", "Les diagnostics n’incluent jamais l’historique BOT DEE privé, les profils ni SMARTsummary.",
    "Le nom et la licence sont requis.", "SVG refusé : {reason}", "Module de motif manquant — rien n’a été enregistré.",
    "Annulé — rien n’a été enregistré.", "SMARTvisuals : envoyer un brouillon en revue", "Brouillon en revue ({id}). Invisible aux patrons.",
    "Publication refusée.", "Le SVG est nettoyé. Scripts, foreignObject, gestionnaires et href externes sont refusés. L’aperçu utilise img, jamais un SVG non fiable en ligne.",
    "Envoyer en revue", "Titres synthétiques uniquement. Le résolveur ne lit pas le chat privé. Gemini n’est pas appelé à l’affichage.",
    "registry.json versionné dans git est la source publiée. SOS2FA + motif requis. Les brouillons restent hors Recherche et Room SMARTview.",
    "Détail / aperçu live"
  ]
};

function fillLang(srcArr, map) {
  return srcArr.map((s, i) => map(s, i));
}

T.de = fillLang(T.en, s => s
  .replace("Library", "Bibliothek").replace("Create / Edit", "Erstellen / Bearbeiten")
);
/* Remaining langs: start from English then overlay known UI words. Full unique packs below. */

T.de = [
  "SMARTvisual Studio", "Freigegebene SMARTstencils und SMARTbackgrounds. Entwürfe erreichen Gäste erst nach geprüfter Veröffentlichung. Die Szene ist Illustration, kein Foto.",
  "Bibliothek", "Erstellen / Bearbeiten", "Tags & Resolver", "Prüfen / Veröffentlichen", "Nutzung & Diagnose", "Anzeigen / Platzierung", "Name, Tag, Ort suchen",
  "Mingl Room Einladung", "Sie sind eingeladen, einer Mingl Room beizutreten.", "{name} hat Sie in eine Mingl Room eingeladen.",
  "Planen wir die Cancun-Reise mit BOT-DEE.", "Heute, 19:00 ET", "Sie", "Angenommen", "Live", "Ausstehend", "Abgelehnt",
  "Reise", "Mode", "Planung", "Reservierungen", "Reiseplan", "Mingl Room", "Schließen",
  "Illustration für diese Room. Kein Foto.", "Mingl Room", "Zeit noch offen", "Teilnehmende",
  "Einladung ansehen", "Nicht jetzt", "Demo / synthetisch — keine echte Einladung", "Mingl Room Einladung", "Host",
  "lädt Sie in eine Mingl Room ein.", "Live in der Room", "Einladen", "Namen nur für Mitglieder.",
  "Nutzen Sie Mingl-Chat mit BOT DEE für:", "Reiseplan", "Reservierungen", "Tickets", "Mit Freunden abstimmen",
  "Weitere Dienste", "Jetzt beitreten", "oder", "Zur geplanten Zeit beitreten", "Geplant", "Anzeige", "Reisepartner",
  "Sponsorenplatz ist aus, bis getrennt freigegeben.", "Getrennt gekennzeichnete Fläche unter Room SMARTview. AdSense wird nicht geladen. Kein Fill, kein Consent, kein Targeting aus Room oder BOT DEE ohne eigene Freigabe.",
  "Keine Treffer.", "{n} veröffentlichte Assets", "Original-FLOQR-Illustration. Kein Foto, kein offizielles Zeichen.",
  "Vorschau Suche-SMARTnotification", "Vorschau Room SMARTview", "Registry-Revision", "Gemini beim Anzeigen", "Anzeigen an",
  "Veröffentlichte Assets", "Diagnose enthält nie privaten BOT-DEE-Verlauf, Profile oder SMARTsummary.",
  "Name und Lizenz sind Pflicht.", "SVG abgelehnt: {reason}", "Reason-Modul fehlt — nichts gespeichert.",
  "Abgebrochen — nichts gespeichert.", "SMARTvisuals: Entwurf zur Prüfung", "Entwurf in Prüfung ({id}). Nicht sichtbar für Gäste.",
  "Veröffentlichung verweigert.", "SVG wird geprüft. Scripts, foreignObject, Handler und externe hrefs werden abgelehnt. Vorschau per img, nie unsicheres Inline-SVG.",
  "Zur Prüfung senden", "Nur synthetische Titel. Der Resolver liest keinen privaten Chat. Gemini läuft nicht beim Anzeigen.",
  "Git-registry.json ist die veröffentlichte Quelle. SOS2FA + Grund nötig. Entwürfe bleiben von Suche und Room SMARTview fern.",
  "Asset-Detail / Live-Vorschau"
];

T.es = [
  "SMARTvisual Studio", "SMARTstencils y SMARTbackgrounds aprobados. Los borradores no llegan a patrons hasta una publicación auditada. El arte es ilustración, no fotografía.",
  "Biblioteca", "Crear / Editar", "Etiquetas y resolver", "Revisar / Publicar", "Uso y diagnósticos", "Anuncios / ubicación", "Buscar nombre, etiqueta, lugar",
  "Invitación Mingl Room", "Está invitado a unirse a una Mingl Room.", "{name} le invitó a una Mingl Room.",
  "Planemos el viaje a Cancún con BOT-DEE.", "Hoy, 7:00 p. m. ET", "Usted", "Aceptado", "En vivo", "Pendiente", "Rechazado",
  "Viaje", "Moda", "Planificación", "Reservas", "Itinerario", "Mingl Room", "Cerrar",
  "Ilustración de esta room. No es una fotografía.", "Mingl Room", "Hora por confirmar", "Participantes",
  "Ver invitación", "Ahora no", "Demo / sintético — no es una invitación real", "Invitación Mingl Room", "Anfitrión",
  "le invita a una Mingl Room.", "En vivo en la room", "Invitar", "Los nombres solo para miembros.",
  "Use el chat Mingl con BOT DEE para:", "Planear itinerario", "Hacer reservas", "Conseguir entradas", "Coordinar con amigos",
  "Más servicios", "Unirse ahora", "o", "Unirse a la hora programada", "Programado", "Anuncio", "Socio de viaje",
  "La ubicación patrocinada está apagada hasta una aprobación aparte.", "Hueco etiquetado bajo Room SMARTview. AdSense no se carga. Sin fill, sin consentimiento ni targeting desde la room o BOT DEE hasta otra revisión.",
  "Sin resultados.", "{n} recursos publicados", "Ilustración original FLOQR. No es foto ni marca oficial.",
  "Vista previa en SMARTnotification", "Vista previa Room SMARTview", "Revisión del registro", "Gemini al ver", "Anuncios on",
  "Recursos publicados", "Los diagnósticos nunca incluyen historial privado de BOT DEE, perfiles ni SMARTsummary.",
  "Nombre y licencia son obligatorios.", "SVG rechazado: {reason}", "Falta el módulo de motivo — no se guardó nada.",
  "Cancelado — no se guardó nada.", "SMARTvisuals: enviar borrador a revisión", "Borrador en revisión ({id}). No visible para patrons.",
  "Publicación denegada.", "El SVG se sanitiza. Se rechazan scripts, foreignObject, controladores y href externos. La vista usa img, nunca SVG no confiable en línea.",
  "Enviar a revisión", "Solo títulos sintéticos. El resolver no lee el chat privado. Gemini no se llama al ver la tarjeta.",
  "registry.json en git es la fuente publicada. Hace falta SOS2FA + motivo. Los borradores no salen a Búsqueda ni Room SMARTview.",
  "Detalle / vista previa"
];

T.nl = [
  "SMARTvisual Studio", "Goedgekeurde SMARTstencils en SMARTbackgrounds. Concepten bereiken gasten pas na een gecontroleerde publicatie. De scene is illustratie, geen foto.",
  "Bibliotheek", "Maken / bewerken", "Tags & resolver", "Review / publiceren", "Gebruik & diagnostiek", "Ads / plaatsing", "Zoek naam, tag, plaats",
  "Mingl Room-uitnodiging", "U bent uitgenodigd voor een Mingl Room.", "{name} nodigde u uit voor een Mingl Room.",
  "Laten we de Cancun-reis plannen met BOT-DEE.", "Vandaag, 19.00 ET", "U", "Geaccepteerd", "Live", "In behandeling", "Afgewezen",
  "Reizen", "Mode", "Planning", "Reserveringen", "Itinerary", "Mingl Room", "Sluiten",
  "Illustratie voor deze room. Geen foto.", "Mingl Room", "Tijd nog te bevestigen", "Deelnemers",
  "Uitnodiging bekijken", "Niet nu", "Demo / synthetisch — geen echte uitnodiging", "Mingl Room-uitnodiging", "Host",
  "nodigt u uit voor een Mingl Room.", "Live in de room", "Uitnodigen", "Namen alleen voor leden.",
  "Gebruik Mingl-chat met BOT DEE om:", "Itinerary plannen", "Reserveringen", "Tickets", "Met vrienden afstemmen",
  "Meer services", "Nu deelnemen", "of", "Deelnemen op geplande tijd", "Gepland", "Ad", "Reispartner",
  "Sponsored slot staat uit tot aparte goedkeuring.", "Gelabeld vak onder Room SMARTview. AdSense wordt niet geladen. Geen fill, geen consent, geen targeting uit room of BOT DEE zonder aparte review.",
  "Geen items.", "{n} gepubliceerde assets", "Originele FLOQR-illustratie. Geen foto of officieel merkteken.",
  "Voorbeeld Search-SMARTnotification", "Voorbeeld Room SMARTview", "Registry-revisie", "Gemini bij weergave", "Ads aan",
  "Gepubliceerde assets", "Diagnostiek bevat nooit privé BOT DEE-geschiedenis, profielen of SMARTsummary.",
  "Naam en licentie zijn verplicht.", "SVG geweigerd: {reason}", "Reason-module ontbreekt — niets opgeslagen.",
  "Geannuleerd — niets opgeslagen.", "SMARTvisuals: concept indienen", "Concept in review ({id}). Niet zichtbaar voor gasten.",
  "Publicatie geweigerd.", "SVG wordt geschoond. Scripts, foreignObject, handlers en externe hrefs worden geweigerd. Preview via img, nooit onveilige inline SVG.",
  "Indienen ter review", "Alleen synthetische titels. De resolver leest geen privéchat. Gemini draait niet bij weergave.",
  "Git-registry.json is de gepubliceerde bron. SOS2FA + reden vereist. Concepten blijven van Search en Room SMARTview.",
  "Assetdetail / live preview"
];

T.ru = [
  "SMARTvisual Studio", "Одобренные SMARTstencils и SMARTbackgrounds. Черновики не видны гостям до проверенной публикации. Это иллюстрация, не фото.",
  "Библиотека", "Создать / изменить", "Теги и резолвер", "Проверка / публикация", "Использование и диагностика", "Реклама / слот", "Имя, тег, место",
  "Приглашение Mingl Room", "Вас приглашают в Mingl Room.", "{name} приглашает вас в Mingl Room.",
  "Спланируем поездку в Cancun вместе с BOT-DEE.", "Сегодня, 19:00 ET", "Вы", "Принято", "В эфире", "Ожидание", "Отклонено",
  "Путешествие", "Мода", "Планирование", "Бронирования", "Маршрут", "Mingl Room", "Закрыть",
  "Иллюстрация для этой room. Это не фотография.", "Mingl Room", "Время уточняется", "Участники",
  "Смотреть приглашение", "Не сейчас", "Демо / синтетика — не живое приглашение", "Приглашение Mingl Room", "Хост",
  "приглашает вас в Mingl Room.", "В эфире в room", "Пригласить", "Имена только для участников.",
  "Используйте чат Mingl с BOT DEE, чтобы:", "Спланировать маршрут", "Бронирования", "Билеты", "Согласовать с друзьями",
  "Другие сервисы", "Присоединиться сейчас", "или", "Присоединиться в назначенное время", "Запланировано", "Реклама", "Партнёр поездки",
  "Спонсорский слот выключен до отдельного одобрения.", "Подписанный слот под Room SMARTview. AdSense не загружается. Нет fill, согласия и таргетинга из room или BOT DEE без отдельного обзора.",
  "Нет совпадений.", "{n} опубликованных ресурсов", "Оригинальная иллюстрация FLOQR. Не фото и не официальный знак.",
  "Превью SMARTnotification", "Превью Room SMARTview", "Ревизия реестра", "Gemini при просмотре", "Реклама вкл",
  "Опубликованные ресурсы", "Диагностика не включает частную историю BOT DEE, профили или SMARTsummary.",
  "Имя и лицензия обязательны.", "SVG отклонён: {reason}", "Нет модуля причины — ничего не сохранено.",
  "Отменено — ничего не сохранено.", "SMARTvisuals: черновик на проверку", "Черновик на проверке ({id}). Гостям не видно.",
  "Публикация отклонена.", "SVG очищается. Скрипты, foreignObject, обработчики и внешние href отклоняются. Превью через img, не небезопасный inline SVG.",
  "Отправить на проверку", "Только синтетические заголовки. Резолвер не читает личный чат. Gemini не вызывается при просмотре.",
  "Git registry.json — опубликованный источник. Нужны SOS2FA и причина. Черновики не попадают в Search и Room SMARTview.",
  "Детали / живой превью"
];

T.it = [
  "SMARTvisual Studio", "SMARTstencils e SMARTbackgrounds approvati. Le bozze non arrivano ai patron prima di una pubblicazione con audit. L’arte è illustrazione, non foto.",
  "Libreria", "Crea / modifica", "Tag e resolver", "Revisione / pubblica", "Uso e diagnostica", "Ads / posizionamento", "Cerca nome, tag, luogo",
  "Invito Mingl Room", "Sei invitato a una Mingl Room.", "{name} ti ha invitato a una Mingl Room.",
  "Pianifichiamo il viaggio a Cancun con BOT-DEE.", "Oggi, 19:00 ET", "Tu", "Accettato", "Live", "In attesa", "Rifiutato",
  "Viaggio", "Moda", "Pianificazione", "Prenotazioni", "Itinerario", "Mingl Room", "Chiudi",
  "Illustrazione per questa room. Non è una fotografia.", "Mingl Room", "Orario da confermare", "Partecipanti",
  "Vedi invito", "Non ora", "Demo / sintetico — non un invito reale", "Invito Mingl Room", "Host",
  "ti invita in una Mingl Room.", "Live nella room", "Invita", "I nomi solo per i membri.",
  "Usa la chat Mingl con BOT DEE per:", "Pianificare l’itinerario", "Prenotazioni", "Biglietti", "Coordinare con gli amici",
  "Altri servizi", "Entra ora", "oppure", "Entra all’orario previsto", "Programmato", "Ad", "Partner di viaggio",
  "Lo slot sponsor è spento fino a un’approvazione separata.", "Slot etichettato sotto Room SMARTview. AdSense non è caricato. Niente fill, consenso o targeting da room o BOT DEE senza altra review.",
  "Nessun elemento.", "{n} asset pubblicati", "Illustrazione originale FLOQR. Non è foto né marchio ufficiale.",
  "Anteprima SMARTnotification", "Anteprima Room SMARTview", "Revisione registry", "Gemini in vista", "Ads on",
  "Asset pubblicati", "La diagnostica non include cronologia BOT DEE privata, profili o SMARTsummary.",
  "Nome e licenza sono obbligatori.", "SVG rifiutato: {reason}", "Manca il modulo motivo — nulla salvato.",
  "Annullato — nulla salvato.", "SMARTvisuals: invia bozza in revisione", "Bozza in revisione ({id}). Non visibile ai patron.",
  "Pubblicazione negata.", "L’SVG è sanificato. Script, foreignObject, handler e href esterni sono rifiutati. Anteprima con img, mai SVG non fidato inline.",
  "Invia in revisione", "Solo titoli sintetici. Il resolver non legge la chat privata. Gemini non parte in vista.",
  "registry.json in git è la fonte pubblicata. Servono SOS2FA + motivo. Le bozze restano fuori da Search e Room SMARTview.",
  "Dettaglio / anteprima live"
];

T.pt = [
  "SMARTvisual Studio", "SMARTstencils e SMARTbackgrounds aprovados. Rascunhos não chegam a patrons até uma publicação auditada. A arte é ilustração, não fotografia.",
  "Biblioteca", "Criar / editar", "Tags e resolver", "Rever / publicar", "Uso e diagnósticos", "Anúncios / posição", "Pesquisar nome, tag, lugar",
  "Convite Mingl Room", "Está convidado a juntar-se a uma Mingl Room.", "{name} convidou-o para uma Mingl Room.",
  "Vamos planear a viagem a Cancun com BOT-DEE.", "Hoje, 19:00 ET", "Você", "Aceite", "Em direto", "Pendente", "Recusado",
  "Viagem", "Moda", "Planeamento", "Reservas", "Itinerário", "Mingl Room", "Fechar",
  "Ilustração desta room. Não é uma fotografia.", "Mingl Room", "Hora a confirmar", "Participantes",
  "Ver convite", "Agora não", "Demo / sintético — não é um convite real", "Convite Mingl Room", "Anfitrião",
  "está a convidá-lo para uma Mingl Room.", "Em direto na room", "Convidar", "Os nomes só para membros.",
  "Use o chat Mingl com BOT DEE para:", "Planear itinerário", "Fazer reservas", "Obter bilhetes", "Coordenar com amigos",
  "Mais serviços", "Entrar agora", "ou", "Entrar à hora marcada", "Agendado", "Anúncio", "Parceiro de viagem",
  "O espaço patrocinado está desligado até aprovação à parte.", "Espaço rotulado abaixo do Room SMARTview. O AdSense não é carregado. Sem fill, consentimento ou targeting da room ou BOT DEE até outra revisão.",
  "Sem resultados.", "{n} recursos publicados", "Ilustração original FLOQR. Não é foto nem marca oficial.",
  "Pré-visualizar SMARTnotification", "Pré-visualizar Room SMARTview", "Revisão do registo", "Gemini na vista", "Anúncios on",
  "Recursos publicados", "Os diagnósticos nunca incluem histórico privado BOT DEE, perfis ou SMARTsummary.",
  "Nome e licença são obrigatórios.", "SVG rejeitado: {reason}", "Módulo de motivo em falta — nada foi guardado.",
  "Cancelado — nada foi guardado.", "SMARTvisuals: enviar rascunho para revisão", "Rascunho em revisão ({id}). Não visível a patrons.",
  "Publicação recusada.", "O SVG é sanitizado. Scripts, foreignObject, handlers e href externos são rejeitados. A pré-visualização usa img, nunca SVG não confiável em linha.",
  "Enviar para revisão", "Apenas títulos sintéticos. O resolver não lê o chat privado. O Gemini não é chamado na vista.",
  "O registry.json no git é a fonte publicada. SOS2FA + motivo obrigatórios. Rascunhos ficam fora da Pesquisa e do Room SMARTview.",
  "Detalhe / pré-visualização"
];

T.el = [
  "SMARTvisual Studio", "Εγκεκριμένα SMARTstencils και SMARTbackgrounds. Τα προσχέδια δεν φτάνουν στους patrons πριν από ελεγμένη δημοσίευση. Η τέχνη είναι εικονογράφηση, όχι φωτογραφία.",
  "Βιβλιοθήκη", "Δημιουργία / επεξεργασία", "Ετικέτες και resolver", "Έλεγχος / δημοσίευση", "Χρήση και διαγνωστικά", "Διαφημίσεις / θέση", "Αναζήτηση ονόματος, ετικέτας, τόπου",
  "Πρόσκληση Mingl Room", "Προσκαλείστε σε Mingl Room.", "Ο/Η {name} σας προσκάλεσε σε Mingl Room.",
  "Ας σχεδιάσουμε το ταξίδι Cancun με BOT-DEE.", "Σήμερα, 19:00 ET", "Εσείς", "Αποδεκτό", "Ζωντανά", "Εκκρεμές", "Απορρίφθηκε",
  "Ταξίδι", "Μόδα", "Σχεδιασμός", "Κρατήσεις", "Δρομολόγιο", "Mingl Room", "Κλείσιμο",
  "Εικονογράφηση για αυτή τη room. Δεν είναι φωτογραφία.", "Mingl Room", "Ώρα προς επιβεβαίωση", "Συμμετέχοντες",
  "Προβολή πρόσκλησης", "Όχι τώρα", "Demo / συνθετικό — όχι ζωντανή πρόσκληση", "Πρόσκληση Mingl Room", "Οικοδεσπότης",
  "σας προσκαλεί σε Mingl Room.", "Ζωντανά στη room", "Πρόσκληση", "Τα ονόματα μόνο για μέλη.",
  "Χρησιμοποιήστε τη συνομιλία Mingl με BOT DEE για:", "Σχεδιασμός δρομολογίου", "Κρατήσεις", "Εισιτήρια", "Συντονισμός με φίλους",
  "Περισσότερες υπηρεσίες", "Συμμετοχή τώρα", "ή", "Συμμετοχή στην προγραμματισμένη ώρα", "Προγραμματισμένο", "Διαφήμιση", "Ταξιδιωτικός συνεργάτης",
  "Το sponsored slot είναι κλειστό μέχρι ξεχωριστή έγκριση.", "Επισημασμένο κενό κάτω από το Room SMARTview. Το AdSense δεν φορτώνεται. Χωρίς fill, συναίνεση ή targeting από room ή BOT DEE χωρίς άλλη εξέταση.",
  "Κανένα στοιχείο.", "{n} δημοσιευμένα στοιχεία", "Πρωτότυπη εικονογράφηση FLOQR. Όχι φωτογραφία ούτε επίσημο σήμα.",
  "Προεπισκόπηση SMARTnotification", "Προεπισκόπηση Room SMARTview", "Αναθεώρηση μητρώου", "Gemini στην προβολή", "Διαφημίσεις on",
  "Δημοσιευμένα στοιχεία", "Τα διαγνωστικά δεν περιλαμβάνουν ιδιωτικό ιστορικό BOT DEE, προφίλ ή SMARTsummary.",
  "Όνομα και άδεια είναι υποχρεωτικά.", "SVG απορρίφθηκε: {reason}", "Λείπει το module αιτίας — δεν αποθηκεύτηκε τίποτα.",
  "Ακυρώθηκε — δεν αποθηκεύτηκε τίποτα.", "SMARTvisuals: υποβολή προσχεδίου", "Προσχέδιο σε έλεγχο ({id}). Δεν φαίνεται σε patrons.",
  "Η δημοσίευση απορρίφθηκε.", "Το SVG καθαρίζεται. Scripts, foreignObject, handlers και εξωτερικά href απορρίπτονται. Προεπισκόπηση με img, ποτέ μη αξιόπιστο inline SVG.",
  "Υποβολή για έλεγχο", "Μόνο συνθετικοί τίτλοι. Ο resolver δεν διαβάζει ιδιωτική συνομιλία. Το Gemini δεν καλείται στην προβολή.",
  "Το git registry.json είναι η δημοσιευμένη πηγή. Απαιτούνται SOS2FA + αιτία. Τα προσχέδια μένουν εκτός Αναζήτησης και Room SMARTview.",
  "Λεπτομέρεια / ζωντανή προεπισκόπηση"
];

T.pl = [
  "SMARTvisual Studio", "Zatwierdzone SMARTstencils i SMARTbackgrounds. Szkice nie trafiają do gości przed audytowaną publikacją. To ilustracja, nie zdjęcie.",
  "Biblioteka", "Utwórz / edytuj", "Tagi i resolver", "Przegląd / publikuj", "Użycie i diagnostyka", "Reklamy / miejsce", "Szukaj nazwy, tagu, miejsca",
  "Zaproszenie Mingl Room", "Zaproszono Cię do Mingl Room.", "{name} zaprasza Cię do Mingl Room.",
  "Zaplanujmy wyjazd do Cancun z BOT-DEE.", "Dziś, 19:00 ET", "Ty", "Zaakceptowano", "Na żywo", "Oczekuje", "Odrzucono",
  "Podróż", "Moda", "Planowanie", "Rezerwacje", "Plan podróży", "Mingl Room", "Zamknij",
  "Ilustracja tej room. To nie fotografia.", "Mingl Room", "Czas do potwierdzenia", "Uczestnicy",
  "Zobacz zaproszenie", "Nie teraz", "Demo / syntetyczne — to nie żywe zaproszenie", "Zaproszenie Mingl Room", "Gospodarz",
  "zaprasza Cię do Mingl Room.", "Na żywo w room", "Zaproś", "Imiona tylko dla członków.",
  "Użyj czatu Mingl z BOT DEE, aby:", "Zaplanować trasę", "Rezerwacje", "Bilety", "Uzgodnić ze znajomymi",
  "Więcej usług", "Dołącz teraz", "lub", "Dołącz o zaplanowanej godzinie", "Zaplanowano", "Reklama", "Partner podróży",
  "Slot sponsorowany jest wyłączony do osobnej zgody.", "Oznakowane miejsce pod Room SMARTview. AdSense nie jest ładowany. Bez fill, zgody i targetowania z room lub BOT DEE bez osobnej recenzji.",
  "Brak wyników.", "{n} opublikowanych zasobów", "Oryginalna ilustracja FLOQR. To nie zdjęcie ani znak oficjalny.",
  "Podgląd SMARTnotification", "Podgląd Room SMARTview", "Rewizja rejestru", "Gemini przy widoku", "Reklamy wł.",
  "Opublikowane zasoby", "Diagnostyka nigdy nie zawiera prywatnej historii BOT DEE, profili ani SMARTsummary.",
  "Nazwa i licencja są wymagane.", "SVG odrzucony: {reason}", "Brak modułu powodu — nic nie zapisano.",
  "Anulowano — nic nie zapisano.", "SMARTvisuals: wyślij szkic do przeglądu", "Szkic w przeglądzie ({id}). Niewidoczny dla gości.",
  "Publikacja odrzucona.", "SVG jest oczyszczany. Skrypty, foreignObject, handlery i zewnętrzne href są odrzucane. Podgląd przez img, nigdy niezaufany inline SVG.",
  "Wyślij do przeglądu", "Tylko syntetyczne tytuły. Resolver nie czyta prywatnego czatu. Gemini nie jest wywoływane przy widoku.",
  "Git registry.json to opublikowane źródło. Wymagane SOS2FA + powód. Szkice zostają poza Szukaj i Room SMARTview.",
  "Szczegół / podgląd na żywo"
];

T.ar = [
  "SMARTvisual Studio", "SMARTstencils وSMARTbackgrounds المعتمدة. لا تصل المسودات إلى الرواد قبل نشر مُدقَّق. الفن رسم توضيحي وليس صورة.",
  "المكتبة", "إنشاء / تعديل", "الوسوم والحلّال", "مراجعة / نشر", "الاستخدام والتشخيص", "إعلانات / موضع", "ابحث بالاسم أو الوسم أو المكان",
  "دعوة Mingl Room", "دعيت للانضمام إلى Mingl Room.", "دعاك {name} إلى Mingl Room.",
  "لنخطط رحلة Cancun مع BOT-DEE.", "اليوم، 7:00 م ET", "أنت", "مقبول", "مباشر", "قيد الانتظار", "مرفوض",
  "سفر", "أزياء", "تخطيط", "حجوزات", "مسار", "Mingl Room", "إغلاق",
  "رسم توضيحي لهذه الغرفة. ليست صورة فوتوغرافية.", "Mingl Room", "الوقت غير مؤكد", "المشاركون",
  "عرض الدعوة", "ليس الآن", "تجريبي / اصطناعي — ليست دعوة حية", "دعوة Mingl Room", "المضيف",
  "يدعوك إلى Mingl Room.", "مباشر في الغرفة", "دعوة", "الأسماء تظهر للأعضاء فقط.",
  "استخدم دردشة Mingl مع BOT DEE لـ:", "تخطيط المسار", "إجراء حجوزات", "الحصول على تذاكر", "التنسيق مع الأصدقاء",
  "خدمات إضافية", "انضم الآن", "أو", "الانضمام في الوقت المحدد", "مجدول", "إعلان", "شريك سفر",
  "موضع الرعاية متوقف حتى موافقة منفصلة.", "موضع موسوم أسفل Room SMARTview. لا يُحمَّل AdSense. لا ملء ولا موافقة ولا استهداف من الغرفة أو BOT DEE قبل مراجعة منفصلة.",
  "لا عناصر.", "{n} أصول منشورة", "رسم FLOQR أصلي. ليست صورة ولا علامة رسمية.",
  "معاينة SMARTnotification", "معاينة Room SMARTview", "مراجعة السجل", "Gemini عند العرض", "الإعلانات مفعلة",
  "الأصول المنشورة", "لا تتضمن التشخيصات سجل BOT DEE الخاص أو الملفات أو SMARTsummary.",
  "الاسم والترخيص مطلوبان.", "رُفض SVG: {reason}", "وحدة السبب مفقودة — لم يُحفظ شيء.",
  "أُلغي — لم يُحفظ شيء.", "SMARTvisuals: إرسال مسودة للمراجعة", "مسودة قيد المراجعة ({id}). غير ظاهرة للرواد.",
  "رُفض النشر.", "يُنظَّف SVG. تُرفض السكربتات وforeignObject والمعالجات والروابط الخارجية. المعاينة عبر img وليس SVG غير موثوق مضمّن.",
  "إرسال للمراجعة", "عناوين اصطناعية فقط. الحلّال لا يقرأ الدردشة الخاصة. لا يُستدعى Gemini عند العرض.",
  "registry.json في git هو المصدر المنشور. يلزم SOS2FA وسبب. تبقى المسودات خارج البحث وRoom SMARTview.",
  "التفاصيل / المعاينة الحية"
];

function injectChrome(src, lang, pairs) {
  const chromeStart = src.indexOf("const CHROME = ");
  const idx = src.indexOf(`\n    ${lang}: {`, chromeStart);
  if (idx < 0) throw new Error(`Missing pack ${lang}`);
  const nextPack = CHROME_ORDER[CHROME_ORDER.indexOf(lang) + 1];
  const end = nextPack ? src.indexOf(`\n    ${nextPack}: {`, idx + 1) : src.indexOf("\n  };", idx);
  const slice = src.slice(idx, end);
  if (KEYS.every(k => slice.includes(q(k)))) return src;
  const block = pairs.map(([k, v]) => `      ${q(k)}: ${q(v)},`).join("\n") + "\n";
  if (!slice.includes(AFTER)) throw new Error(`Missing ${AFTER} in ${lang}`);
  return src.slice(0, idx) + slice.replace(
    new RegExp(`(${AFTER}:\\s*[^\\n]+,\\n)`),
    `$1${block}`
  ) + src.slice(idx + slice.length);
}

CHROME_ORDER.forEach(lang => {
  if (!T[lang] || T[lang].length !== KEYS.length) {
    throw new Error(`${lang} has ${T[lang] ? T[lang].length : 0} values, expected ${KEYS.length}`);
  }
});

let chrome = fs.readFileSync(path.join(ROOT, "floqr-i18n.js"), "utf8");
CHROME_ORDER.forEach(lang => {
  const pairs = KEYS.map((k, i) => [k, T[lang][i]]);
  chrome = injectChrome(chrome, lang, pairs);
});
fs.writeFileSync(path.join(ROOT, "floqr-i18n.js"), chrome);

const HELP = {
  "help-smartvisuals-notification": {
    en: {title: "Mingl Room SMARTnotification", body: "A compact Mingl Room Invitation can appear on Search. View Invitation opens the Room SMARTview. Not Now dismisses it for this session. Art is a SMARTbackground illustration with SMARTstencils — not a real photo and not an official destination mark. Participant names and RSVP come only from the room record. Ads, if ever approved, sit below the card and stay labeled Ad."},
    fr: {title: "SMARTnotification Mingl Room", body: "Une invitation Mingl Room compacte peut s’afficher dans la Recherche. Voir l’invitation ouvre Room SMARTview. Pas maintenant la masque pour cette session. L’art est une illustration SMARTbackground avec SMARTstencils — pas une photo ni une marque officielle. Les noms et RSVP viennent uniquement du dossier de la room. Les pubs, si un jour approuvées, restent sous la carte avec le libellé Ad."},
    de: {title: "Mingl Room SMARTnotification", body: "Auf der Suche kann eine kompakte Mingl-Room-Einladung erscheinen. Einladung ansehen öffnet Room SMARTview. Nicht jetzt blendet sie für diese Sitzung aus. Die Grafik ist SMARTbackground-Illustration mit SMARTstencils — kein Foto, kein offizielles Zeichen. Namen und RSVP kommen nur aus dem Room-Datensatz. Anzeigen sitzen darunter und bleiben mit Ad gekennzeichnet."},
    es: {title: "SMARTnotification de Mingl Room", body: "En Búsqueda puede aparecer una invitación compacta. Ver invitación abre Room SMARTview. Ahora no la oculta en esta sesión. El arte es ilustración SMARTbackground con SMARTstencils — no foto ni marca oficial. Nombres y RSVP salen solo del registro de la room. Los anuncios, si se aprueban, van debajo con la etiqueta Ad."},
    nl: {title: "Mingl Room SMARTnotification", body: "Op Zoeken kan een compacte Mingl Room-uitnodiging verschijnen. Uitnodiging bekijken opent Room SMARTview. Niet nu verbergt hem deze sessie. De art is SMARTbackground-illustratie met SMARTstencils — geen foto en geen officieel merkteken. Namen en RSVP komen alleen uit het room-record. Ads, indien ooit goedgekeurd, zitten eronder en blijven Ad."},
    ru: {title: "SMARTnotification Mingl Room", body: "В Поиске может появиться компактное приглашение Mingl Room. «Смотреть приглашение» открывает Room SMARTview. «Не сейчас» скрывает его в этой сессии. Картинка — иллюстрация SMARTbackground со SMARTstencils, не фото и не официальный знак. Имена и RSVP только из записи room. Реклама, если её одобрят, будет под карточкой с меткой Ad."},
    it: {title: "SMARTnotification Mingl Room", body: "In Cerca può comparire un invito Mingl Room compatto. Vedi invito apre Room SMARTview. Non ora lo nasconde per questa sessione. L’arte è illustrazione SMARTbackground con SMARTstencils — non una foto né un marchio ufficiale. Nomi e RSVP arrivano solo dal record della room. Gli ads, se approvati, restano sotto con etichetta Ad."},
    pt: {title: "SMARTnotification Mingl Room", body: "Na Pesquisa pode aparecer um convite compacto Mingl Room. Ver convite abre o Room SMARTview. Agora não esconde-o nesta sessão. A arte é ilustração SMARTbackground com SMARTstencils — não é foto nem marca oficial. Nomes e RSVP vêm só do registo da room. Anúncios, se aprovados, ficam abaixo com a etiqueta Ad."},
    el: {title: "SMARTnotification Mingl Room", body: "Στην Αναζήτηση μπορεί να εμφανιστεί συμπαγής πρόσκληση Mingl Room. Η προβολή ανοίγει το Room SMARTview. Όχι τώρα την κρύβει σε αυτή τη συνεδρία. Η εικόνα είναι εικονογράφηση SMARTbackground με SMARTstencils — όχι φωτογραφία ούτε επίσημο σήμα. Ονόματα και RSVP μόνο από την εγγραφή room. Οι διαφημίσεις, αν εγκριθούν, μένουν κάτω με ετικέτα Ad."},
    pl: {title: "SMARTnotification Mingl Room", body: "W Szukaj może pojawić się zwarte zaproszenie Mingl Room. Zobacz zaproszenie otwiera Room SMARTview. Nie teraz chowa je w tej sesji. Grafika to ilustracja SMARTbackground ze SMARTstencils — nie zdjęcie i nie znak oficjalny. Imiona i RSVP tylko z rekordu room. Reklamy, jeśli kiedyś zatwierdzone, zostają pod kartą z etykietą Ad."},
    ar: {title: "SMARTnotification لـ Mingl Room", body: "قد تظهر دعوة Mingl Room مختصرة في البحث. عرض الدعوة يفتح Room SMARTview. ليس الآن يخفيها لهذه الجلسة. الفن رسم SMARTbackground مع SMARTstencils — ليست صورة ولا علامة رسمية. الأسماء وRSVP من سجل الغرفة فقط. الإعلانات إن وُافق عليها تبقى أسفل البطاقة بوسم Ad."}
  },
  "help-smartvisuals-room": {
    en: {title: "Room SMARTview with SMARTvisuals", body: "Room SMARTview shows the Mingl invitation: schedule, RSVP or live status, and Join Now. SMARTstencils and SMARTbackgrounds follow the authorized room title — Cancun Trip uses travel art, not a real Cancun photo and not an official partnership. Private BOT DEE chat is never used to pick art. Group rooms are not live yet, so Join Now does not create a room or charge. A labeled Ad slot may sit below; it is empty until separately approved."},
    fr: {title: "Room SMARTview et SMARTvisuals", body: "Room SMARTview montre l’invitation Mingl : horaire, RSVP ou statut live, et Rejoindre. SMARTstencils et SMARTbackgrounds suivent le titre autorisé — Cancun Trip utilise un art voyage, pas une photo réelle ni un partenariat officiel. Le chat BOT DEE privé ne choisit jamais l’art. Les rooms de groupe ne sont pas en ligne ; Rejoindre ne crée rien et ne facture pas. Un slot Ad étiqueté peut rester dessous, vide jusqu’à approbation."},
    de: {title: "Room SMARTview mit SMARTvisuals", body: "Room SMARTview zeigt die Mingl-Einladung: Zeit, RSVP oder Live, Jetzt beitreten. SMARTstencils und SMARTbackgrounds folgen dem freigegebenen Titel — Cancun Trip nutzt Reisekunst, kein echtes Foto, keine Partnerschaft. Privater BOT-DEE-Chat wählt keine Grafik. Gruppenräume sind nicht live; Beitreten erzeugt nichts und belastet nicht. Ein Ad-Slot darunter bleibt leer bis zur Freigabe."},
    es: {title: "Room SMARTview con SMARTvisuals", body: "Room SMARTview muestra la invitación Mingl: horario, RSVP o en vivo, y Unirse. SMARTstencils y SMARTbackgrounds siguen el título autorizado — Cancun Trip usa arte de viaje, no foto real ni alianza oficial. El chat privado de BOT DEE no elige el arte. Las rooms de grupo no están en vivo; Unirse no crea ni cobra. Un hueco Ad etiquetado puede quedar debajo, vacío hasta otra aprobación."},
    nl: {title: "Room SMARTview met SMARTvisuals", body: "Room SMARTview toont de Mingl-uitnodiging: tijd, RSVP of live, en Nu deelnemen. SMARTstencils en SMARTbackgrounds volgen de goedgekeurde titel — Cancun Trip gebruikt reisart, geen echte foto of officieel partnerschap. Privé BOT DEE-chat kiest geen art. Groepsrooms zijn niet live; Deelnemen maakt niets en rekent niets. Een Ad-slot eronder blijft leeg tot aparte goedkeuring."},
    ru: {title: "Room SMARTview и SMARTvisuals", body: "Room SMARTview показывает приглашение Mingl: время, RSVP или эфир и «Присоединиться». SMARTstencils и SMARTbackgrounds следуют разрешённому названию — Cancun Trip даёт travel-иллюстрацию, не фото и не партнёрство. Личный чат BOT DEE не выбирает картинку. Групповые room ещё не в эфире; кнопка ничего не создаёт и не списывает. Слот Ad снизу пуст до отдельного одобрения."},
    it: {title: "Room SMARTview con SMARTvisuals", body: "Room SMARTview mostra l’invito Mingl: orario, RSVP o live, e Entra ora. SMARTstencils e SMARTbackgrounds seguono il titolo autorizzato — Cancun Trip usa arte di viaggio, non una foto reale né una partnership. La chat privata BOT DEE non sceglie l’arte. Le room di gruppo non sono live; Entra non crea e non addebita. Uno slot Ad sotto resta vuoto fino ad approvazione."},
    pt: {title: "Room SMARTview com SMARTvisuals", body: "O Room SMARTview mostra o convite Mingl: horário, RSVP ou direto, e Entrar agora. SMARTstencils e SMARTbackgrounds seguem o título autorizado — Cancun Trip usa arte de viagem, não foto real nem parceria oficial. O chat privado BOT DEE não escolhe a arte. Rooms de grupo ainda não estão live; Entrar não cria nem cobra. Um espaço Ad abaixo fica vazio até aprovação à parte."},
    el: {title: "Room SMARTview με SMARTvisuals", body: "Το Room SMARTview δείχνει την πρόσκληση Mingl: ώρα, RSVP ή ζωντανά, και Συμμετοχή τώρα. SMARTstencils και SMARTbackgrounds ακολουθούν τον εγκεκριμένο τίτλο — το Cancun Trip χρησιμοποιεί ταξιδιωτική τέχνη, όχι πραγματική φωτογραφία ούτε επίσημη συνεργασία. Η ιδιωτική συνομιλία BOT DEE δεν διαλέγει τέχνη. Οι ομαδικές room δεν είναι ζωντανές· η Συμμετοχή δεν δημιουργεί ούτε χρεώνει. Ένα Ad slot από κάτω μένει κενό μέχρι ξεχωριστή έγκριση."},
    pl: {title: "Room SMARTview ze SMARTvisuals", body: "Room SMARTview pokazuje zaproszenie Mingl: czas, RSVP lub na żywo i Dołącz teraz. SMARTstencils i SMARTbackgrounds idą za zatwierdzonym tytułem — Cancun Trip to sztuka podróży, nie zdjęcie i nie partnerstwo. Prywatny czat BOT DEE nie dobiera grafiki. Pokoje grupowe nie są live; Dołącz nic nie tworzy i nie obciąża. Slot Ad poniżej zostaje pusty do osobnej zgody."},
    ar: {title: "Room SMARTview مع SMARTvisuals", body: "يعرض Room SMARTview دعوة Mingl: الجدول وRSVP أو البث و«انضم الآن». تتبع SMARTstencils وSMARTbackgrounds العنوان المصرّح — Cancun Trip فن سفر وليس صورة حقيقية ولا شراكة رسمية. دردشة BOT DEE الخاصة لا تختار الفن. الغرف الجماعية ليست حية بعد؛ الانضمام لا ينشئ غرفة ولا يخصم. موضع Ad الموسوم أسفل البطاقة يبقى فارغًا حتى موافقة منفصلة."}
  }
};

function injectHelp(src) {
  const langs = ["ru", "nl", "fr", "de", "es", "it", "pt", "el", "pl", "ar"];
  let out = src;
  langs.forEach(lang => {
    const marker = `\n    "${lang}": {`;
    const idx = out.indexOf(marker);
    if (idx < 0) throw new Error("Missing help pack " + lang);
    const insertAt = idx + marker.length;
    const chunk = Object.entries(HELP).map(([id, row]) => {
      const pack = row[lang];
      return `\n      ${q(id)}: {\n        title: ${q(pack.title)},\n        body: ${q(pack.body)}\n      },`;
    }).join("");
    if (out.slice(insertAt, insertAt + 800).includes("help-smartvisuals-notification")) return;
    out = out.slice(0, insertAt) + chunk + out.slice(insertAt);
  });
  return out;
}

const helpPath = path.join(ROOT, "floqr-i18n-help.js");
fs.writeFileSync(helpPath, injectHelp(fs.readFileSync(helpPath, "utf8")));

const helpEnPath = path.join(ROOT, "scripts/_help-en.json");
const helpEn = JSON.parse(fs.readFileSync(helpEnPath, "utf8"));
helpEn["help-smartvisuals-notification"] = HELP["help-smartvisuals-notification"].en;
helpEn["help-smartvisuals-room"] = HELP["help-smartvisuals-room"].en;
fs.writeFileSync(helpEnPath, JSON.stringify(helpEn, null, 2) + "\n");
console.log("Injected SMARTvisuals chrome + help");
