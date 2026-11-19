/* BOT DEE Room SMARTview v2 — deterministic intent routing.
   Confirm mints a join link (Functions-write live module). Shared tab / charge
   stay off. Classifier never writes Firestore. */
"use strict";

const SCHEMA_VERSION = "floqr.botDeeRoomSmartView/1";
const KIND = "botDeeRoom";
const MEMBER_CAP = 8;
const ROOMS_LIVE = true;

const TYPOS = [
  [/\borders\b/g, "others"],
  [/\bromm\b/g, "room"],
  [/\bsmartveiw\b/g, "smartview"],
  [/\bsmart vieew\b/g, "smartview"],
  [/\bmingel\b/g, "mingl"],
  [/\binvitee\b/g, "invite"],
  [/\bconverstaion\b/g, "conversation"],
  [/\bconversaton\b/g, "conversation"]
];

const NON_TRIGGER = [
  "what is a room",
  "what's a room",
  "whats a room",
  "tell me about group reservations",
  "tell me about group reservation",
  "my friends like this club",
  "my friends like that club",
  "friends like this club",
  "what are group reservations",
  "was ist ein raum",
  "was ist ein room",
  "erzahl mir von gruppenreservierungen",
  "erzähle mir von gruppenreservierungen",
  "meine freunde mögen diesen club",
  "meine freunde mogen diesen club",
  "qu'est-ce qu'une room",
  "qu est ce qu une room",
  "parle-moi des reservations de groupe",
  "parle moi des reservations de groupe",
  "mes amis aiment ce club",
  "que es una room",
  "qué es una room",
  "hablame de reservas de grupo",
  "háblame de reservas de grupo",
  "mis amigos quieren este club",
  "mis amigos les gusta este club",
  "cos'e una room",
  "cos e una room",
  "parlami delle prenotazioni di gruppo",
  "i miei amici amano questo club",
  "o que e uma room",
  "o que é uma room",
  "fale sobre reservas em grupo",
  "meus amigos gostam deste clube",
  "wat is een room",
  "vertel me over groepsreserveringen",
  "mijn vrienden vinden deze club leuk",
  "что такое room",
  "что такое комната",
  "расскажи про групповые бронирования",
  "моим друзьям нравится этот клуб",
  "τι ειναι ενα room",
  "τι είναι ένα room",
  "πες μου για ομαδικες κρατησεις",
  "οι φιλοι μου αγαπουν αυτο το club",
  "co to jest room",
  "opowiedz o rezerwacjach grupowych",
  "moi znajomi lubia ten klub",
  "ما هي room",
  "ما هي الغرفة",
  "حدثني عن حجوزات المجموعة",
  "أصدقائي يحبون هذا النادي"
];

const EXPLICIT = [
  "start a group chat",
  "open room smartview",
  "open a room smartview",
  "create a room",
  "create room smartview",
  "make a group chat",
  "launch room smartview",
  "show room smartview",
  "can we all talk to bot dee together",
  "can we all talk to bot-dee together",
  "talk to bot dee together",
  "gruppenchat starten",
  "room smartview offnen",
  "room smartview öffnen",
  "einen raum erstellen",
  "gemeinsam mit bot dee sprechen",
  "demarrer un chat de groupe",
  "démarrer un chat de groupe",
  "ouvrir room smartview",
  "creer une room",
  "créer une room",
  "parler a bot dee ensemble",
  "parler à bot dee ensemble",
  "iniciar un chat de grupo",
  "abrir room smartview",
  "crear una room",
  "hablar con bot dee juntos",
  "avvia una chat di gruppo",
  "apri room smartview",
  "crea una room",
  "parlare con bot dee insieme",
  "iniciar um chat em grupo",
  "abrir o room smartview",
  "criar uma room",
  "falar com bot dee juntos",
  "start een groepsChat",
  "start een groeps chat",
  "open room smartview",
  "maak een room",
  "samen met bot dee praten",
  "начать групповой чат",
  "открыть room smartview",
  "создать room",
  "говорить с bot dee вместе",
  "ξεκινα ομαδικη συνομιλια",
  "ξεκίνα ομαδική συνομιλία",
  "άνοιξε room smartview",
  "ανοιξε room smartview",
  "δημιουργησε room",
  "να μιλησουμε ολοι στο bot dee",
  "zacznij czat grupowy",
  "otworz room smartview",
  "otwórz room smartview",
  "utworz room",
  "porozmawiajmy z bot dee razem",
  "ابدأ دردشة جماعية",
  "افتح room smartview",
  "أنشئ room",
  "نتحدث مع bot dee معا"
];

const STRONG = [
  "invite others to this chat",
  "invite others to this conversation",
  "bring my friends into this conversation",
  "bring my friends into this chat",
  "i wish to share this conversation with my friends",
  "i wish to share with my friends",
  "can my friends join us",
  "can my friends join",
  "invite friends to this chat",
  "share this conversation",
  "share this chat",
  "andere in diesen chat einladen",
  "freunde in dieses gesprach holen",
  "freunde in dieses gespräch holen",
  "inviter d autres dans ce chat",
  "inviter d'autres dans ce chat",
  "partager cette conversation",
  "mes amis peuvent nous rejoindre",
  "invitar a otros a este chat",
  "traer a mis amigos a esta conversacion",
  "compartir esta conversacion",
  "invita altri in questa chat",
  "porta i miei amici in questa conversazione",
  "condividi questa conversazione",
  "convidar outros para este chat",
  "trazer meus amigos para esta conversa",
  "compartilhar esta conversa",
  "anderen uitnodigen in deze chat",
  "vrienden in dit gesprek brengen",
  "dit gesprek delen",
  "пригласить других в этот чат",
  "пригласить друзей в этот чат",
  "поделиться этим разговором",
  "προσκαλεσε αλλους σε αυτη τη συνομιλια",
  "προσκάλεσε άλλους σε αυτή τη συνομιλία",
  "μοιρασου αυτη τη συνομιλια",
  "zapros innych do tego czatu",
  "zaproś innych do tego czatu",
  "podziel sie ta rozmowa",
  "ادع الآخرين إلى هذه الدردشة",
  "شارك هذه المحادثة"
];

const CONTEXTUAL = [
  "lets plan this together",
  "let's plan this together",
  "i need everyones opinion",
  "i need everyone's opinion",
  "lets organize a night out with friends",
  "let's organize a night out with friends",
  "can everyone see our plans",
  "lets split the bill",
  "let's split the bill",
  "split the bill",
  "can we book a vip table together",
  "book a vip table together",
  "lass uns das zusammen planen",
  "ich brauche jede meinung",
  "rechnung teilen",
  "planifions ca ensemble",
  "planifions ça ensemble",
  "partager l addition",
  "partager l'addition",
  "planifiquemos esto juntos",
  "dividir la cuenta",
  "organizziamo una serata con gli amici",
  "dividiamo il conto",
  "vamos planejar isso juntos",
  "dividir a conta",
  "laten we dit samen plannen",
  "de rekening splitsen",
  "давай спланируем это вместе",
  "давайте разделим счет",
  "ας το σχεδιασουμε μαζι",
  "ας το σχεδιάσουμε μαζί",
  "ας μοιρασουμε τον λογαριασμο",
  "zaplanujmy to razem",
  "podzielmy rachunek",
  "لنخطط هذا معا",
  "لنقسم الفاتورة"
];

const INJECTION = [
  /ignore (?:all |the )?(?:previous|prior|above) instructions/,
  /(?:show|dump|reveal|exfiltrate|leak) (?:the )?(?:host|private|hidden) (?:memory|thread|history|chat|prompt)/,
  /(?:include|copy|paste) (?:the )?(?:private|host) (?:smart ?summary|smartview|thread|memory)/,
  /you are now (?:the )?host/,
  /grant (?:me |yourself )?(?:host|admin) (?:role|permission|access)/,
  /system prompt/,
  /developer message/,
  /jailbreak/,
  /do not follow (?:floqr|room) (?:rules|privacy)/
];

function text(value, max = 240) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function fold(raw) {
  return text(raw, 240)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”«»„]/g, "\"")
    .replace(/[’‘]/g, "'")
    .replace(/bot[\s-]*dee/g, "bot dee")
    .replace(/smart\s+view/g, "smartview")
    .replace(/mingl\s+room\s+smartview/g, "room smartview")
    .replace(/mingl\s+room/g, "room smartview")
    .replace(/[?!؟,.;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyTypos(normalized) {
  let next = normalized;
  TYPOS.forEach(([re, to]) => {
    next = next.replace(re, to);
  });
  return next.replace(/\s+/g, " ").trim();
}

function normalizeUtterance(raw) {
  return applyTypos(fold(raw));
}

function includesAny(normalized, list) {
  return list.some(phrase => normalized === phrase || normalized.includes(phrase));
}

const NAME_STOP = /^(friends|others|everyone|them|us|people|guests|someone|anyone|my|the|a|an|this|that|chat|conversation|orders|two|more|few|some|other)$/i;

function extractNamedNeedles(raw) {
  const original = text(raw, 200);
  const invite = original.match(
    /(?:invite|bring|add|remove|kick)\s+((?:[A-Z][\w.'-]+)(?:\s+and\s+[A-Z][\w.'-]+)*)/
  );
  const canJoin = original.match(
    /[Cc]an\s+((?:[A-Z][\w.'-]+)(?:\s+and\s+[A-Z][\w.'-]+)*)\s+join/
  );
  const chunk = (invite && invite[1]) || (canJoin && canJoin[1]) || "";
  if (!chunk) return [];
  return chunk
    .split(/\s+and\s+/i)
    .map(name => text(name, 40))
    .filter(name => name && !NAME_STOP.test(name) && !/^\d+$/.test(name))
    .slice(0, 8)
    .map(name => ({
      displayName: name,
      eligibility: "unresolved",
      accountExists: null
    }));
}

function shareableFactsFromUtterance(raw) {
  const original = text(raw, 200);
  const facts = [];
  const place = original.match(
    /\b(mykonos|aurelia|decades|lima twist|paris|ibiza|miami|vegas|london)\b/i
  );
  if (place) {
    facts.push({
      id: "place",
      label: `${place[1]} plans`,
      tentative: true,
      selected: true
    });
  }
  if (/\b(vip table|vip reserv|reservation|night out|itinerary)\b/i.test(original)) {
    facts.push({
      id: "plan",
      label: "Selected night-out details from this message",
      tentative: true,
      selected: true
    });
  }
  if (/\b(plan|plans)\b/i.test(original) && !facts.some(row => row.id === "place")) {
    facts.push({
      id: "plans",
      label: "Plans mentioned in this message",
      tentative: true,
      selected: true
    });
  }
  return facts.slice(0, 4);
}

function detectCommand(normalized, raw) {
  if (
    /^(?:confirm room(?: smartview)?)$/.test(normalized)
    || /\bconfirm room smartview\b/.test(normalized)
  ) {
    return "confirm";
  }
  if (
    /^(?:invite|add)\s+(?:two more|more)\s+(?:friends|people|guests)/.test(normalized)
    || /invite (?:two more|more) (?:friends|people)/.test(normalized)
    || /noch zwei freunde einladen/.test(normalized)
    || /inviter deux amis de plus/.test(normalized)
  ) {
    return "invite";
  }
  if (
    /who(?:'s| is|s)? in (?:this |the )?room/.test(normalized)
    || /qui est dans (?:cette |la )?room/.test(normalized)
    || /wer ist in (?:diesem |dem )?raum/.test(normalized)
    || /quien esta en (?:esta |la )?room/.test(normalized)
    || /chi e in (?:questa )?room/.test(normalized)
    || /wie zit er in deze room/.test(normalized)
    || /кто в (?:этой )?room/.test(normalized)
    || /ποιος ειναι σε αυτ(?:ο|η) το room/.test(normalized)
    || /kto jest w (?:tym )?room/.test(normalized)
    || /من في هذه الغرفة/.test(normalized)
    || /من في هذه الroom/.test(normalized)
  ) {
    return "members";
  }
  if (
    /what have we decided/.test(normalized)
    || /room summary/.test(normalized)
    || /summarize (?:the |this )?room/.test(normalized)
  ) {
    return "summarize";
  }
  if (
    /who(?:'s| is|s)? paying/.test(normalized)
    || /who pays/.test(normalized)
    || /qui paye/.test(normalized)
    || /wer zahlt/.test(normalized)
    || /quien paga/.test(normalized)
  ) {
    return "who_pays";
  }
  if (/^(?:remove|kick)\b/.test(normalized) || /\b(?:remove|kick) [a-z]/.test(normalized)) {
    return "kick";
  }
  if (/^(?:leave the room|leave this room|leave room)\b/.test(normalized) || /\bleave (?:the |this )?room\b/.test(normalized)) {
    return "leave";
  }
  if (
    /^(?:end this room|end the room|end room|close this room)\b/.test(normalized)
    || /\bend this room\b/.test(normalized)
  ) {
    return "end";
  }
  if (
    /make (?:this |it )?private again/.test(normalized)
    || /make this private/.test(normalized)
    || /private chat again/.test(normalized)
  ) {
    return "make_private";
  }
  return "";
}

function isShareAsk(normalized) {
  return (
    /share (?:this )?(?:conversation|chat|thread)/.test(normalized)
    || /share .{0,40}(?:plans|itinerary)/.test(normalized)
    || /(?:wish|want) to share(?: with my friends)?/.test(normalized)
    || /share with my friends/.test(normalized)
    || /partager (?:cette conversation|ce chat|nos plans|avec mes amis)/.test(normalized)
    || /diese[sn]? (?:gespraech|gesprech|chat) teilen/.test(normalized)
    || /compartir (?:esta conversacion|este chat|nuestros planes)/.test(normalized)
  );
}

function isSplitAsk(normalized) {
  return (
    /split (?:the )?(?:bill|tab|cost)/.test(normalized)
    || /pay together/.test(normalized)
    || /shared tab/.test(normalized)
    || /rechnung teilen/.test(normalized)
    || /partager l[' ]?addition/.test(normalized)
    || /dividir (?:la |a )?cuenta/.test(normalized)
    || /dividiamo il conto/.test(normalized)
  );
}

function declineKey(classified) {
  const row = classified && typeof classified === "object" ? classified : {};
  return ["rs", row.level || "none", row.route || "none", row.command || "", row.share ? "share" : ""]
    .join(":")
    .replace(/:+$/g, "");
}

function classifyRoomIntent(raw, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const normalized = normalizeUtterance(raw);
  const declined = new Set(
    Array.isArray(options.declinedKeys) ? options.declinedKeys.map(String) : []
  );
  const hasActiveRoom = options.hasActiveRoom === true;
  const empty = {
    level: "none",
    route: "none",
    command: "",
    handled: false,
    needsConfirmation: false,
    hasActiveRoom,
    roomsLive: ROOMS_LIVE,
    share: false,
    namedNeedles: [],
    shareFacts: [],
    injection: false,
    declined: false
  };
  if (!normalized || normalized.length < 3) return empty;

  if (INJECTION.some(re => re.test(normalized))) {
    const injection = {
      ...empty,
      level: "adversarial",
      route: "deny",
      handled: true,
      injection: true,
      needsConfirmation: false
    };
    injection.declineKey = declineKey(injection);
    return injection;
  }

  if (includesAny(normalized, NON_TRIGGER)) {
    return empty;
  }
  if (/^what(?: s| is)? (?:a )?room smartview$/.test(normalized)) {
    const explain = {
      ...empty,
      level: "contextual",
      route: "offer",
      handled: true,
      needsConfirmation: true
    };
    explain.declineKey = declineKey(explain);
    if (declined.has(explain.declineKey)) {
      return {...empty, declined: true, declineKey: explain.declineKey};
    }
    return explain;
  }

  const command = detectCommand(normalized, raw);
  if (command) {
    const row = {
      ...empty,
      level: "command",
      route: command === "confirm" ? "confirm" : "command",
      command,
      handled: true,
      needsConfirmation: command === "kick" || command === "end",
      namedNeedles: command === "kick" || command === "invite" ? extractNamedNeedles(raw) : []
    };
    row.declineKey = declineKey(row);
    return row;
  }

  const namedNeedles = extractNamedNeedles(raw);
  const share = isShareAsk(normalized);
  const split = isSplitAsk(normalized);
  let level = "";
  if (
    includesAny(normalized, EXPLICIT)
    || /^(?:open|create|start|make|launch|show)\s+(?:a\s+)?(?:group chat|room|room smartview)\b/.test(normalized)
    || /\broom smartview\b/.test(normalized)
  ) {
    level = "explicit";
  } else if (
    includesAny(normalized, STRONG)
    || namedNeedles.length > 0
    || /\binvite\b.{0,48}\b(?:friends|others|chat|conversation)\b/.test(normalized)
    || /\bbring (?:my )?friends\b/.test(normalized)
    || /\b(?:join us|join this chat|join this conversation)\b/.test(normalized)
  ) {
    level = "strong";
  } else if (includesAny(normalized, CONTEXTUAL) || split || share) {
    level = "contextual";
  } else {
    return empty;
  }

  let route = "offer";
  if (level === "explicit") route = hasActiveRoom ? "reopen" : "setup";
  if (share) route = "share_preview";
  if (level === "strong" && !share) route = hasActiveRoom ? "command" : "offer";
  if (level === "strong" && namedNeedles.length && !share) {
    route = hasActiveRoom ? "command" : "offer";
  }

  const row = {
    ...empty,
    level,
    route,
    command: route === "command" ? (namedNeedles.length ? "invite" : "") : "",
    handled: true,
    needsConfirmation: true,
    share,
    split,
    namedNeedles,
    shareFacts: share ? shareableFactsFromUtterance(raw) : []
  };
  row.declineKey = declineKey(row);
  if (declined.has(row.declineKey) && (route === "offer" || route === "share_preview")) {
    return {
      ...empty,
      declined: true,
      declineKey: row.declineKey
    };
  }
  return row;
}

function isRoomSmartViewPrompt(raw, opts) {
  return classifyRoomIntent(raw, opts).handled === true;
}

function replyFor(classified) {
  const row = classified || {};
  if (row.injection) {
    return {
      key: "botdee.rs.injectionDenied",
      text: "I can’t use private BOT DEE history or host memory for that. Room SMARTview only uses what this group later confirms."
    };
  }
  if (row.route === "confirm") {
    return {
      key: "botdee.rs.confirmedLive",
      text: "Room SMARTview is open. Share the join link so friends can talk with BOT DEE here. Joining is not a payment."
    };
  }
  if (row.route === "setup") {
    return {
      key: "botdee.rs.setupIntro",
      text: "Here’s Room SMARTview setup. Confirm to mint a join link — friends can talk with BOT DEE in this room. Joining is not a payment. Your private BOT DEE chat stays private."
    };
  }
  if (row.route === "reopen") {
    return {
      key: "botdee.rs.reopenIntro",
      text: "You already have a Room SMARTview in this session. Opening it again — not a second room."
    };
  }
  if (row.route === "share_preview") {
    return {
      key: "botdee.rs.shareIntro",
      text: "I can preview selected shareable facts only. Private BOT DEE messages and other people’s SMARTsummary stay out. Approve before anything is published."
    };
  }
  if (row.route === "offer") {
    return {
      key: "botdee.rs.offerIntro",
      text: "Would you like to open Room SMARTview so friends can join this BOT DEE chat? Joining a room does not authorize a payment. Confirm or not now."
    };
  }
  const commandCopy = {
    invite: ["botdee.rs.commandInvite", "Share the Room SMARTview join link. Joining is not a payment and does not open a shared tab."],
    members: ["botdee.rs.commandMembers", "There is no active Room SMARTview yet, so there is no member list to show."],
    summarize: ["botdee.rs.commandSummary", "There are no room-only decisions yet. Private BOT DEE history is not used as a room summary."],
    who_pays: ["botdee.rs.commandWhoPays", "No one is charged from chat. A shared tab needs a later opt-in per person — it is not live."],
    kick: ["botdee.rs.commandKick", "Only a verified host can remove someone, and only after confirm. There is no live room to change."],
    leave: ["botdee.rs.commandLeave", "Leave applies only to a Room SMARTview you have joined. There is no active room."],
    end: ["botdee.rs.commandEnd", "Ending a room needs host confirmation and does not settle money. There is no live room to close."],
    make_private: ["botdee.rs.commandPrivate", "Do you want to leave Room SMARTview, or keep chatting privately here? Other people’s messages are not erased."]
  };
  const pair = commandCopy[row.command] || ["botdee.rs.noActiveRoom", "There is no active Room SMARTview in this chat."];
  return {key: pair[0], text: pair[1]};
}

function authorizedFromUtterance(raw, classified) {
  if (classified && classified.injection) {
    return {authorizedTitle: "", authorizedDescription: ""};
  }
  const cleaned = text(String(raw || "").replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " "), 120);
  if (!cleaned) return {authorizedTitle: "", authorizedDescription: ""};
  return {authorizedTitle: cleaned, authorizedDescription: cleaned};
}

function buildRoomSmartView(opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const classified = options.classified || classifyRoomIntent(options.utterance, options);
  const nowMs = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const copy = replyFor(classified);
  const mode = classified.route === "none" ? "none" : classified.route;
  const lifecycle = classified.route === "reopen" && classified.hasActiveRoom ? "active" : "created";
  const authorized = authorizedFromUtterance(options.utterance, classified);
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: KIND,
    generatedAtIso: new Date(nowMs).toISOString(),
    roomsLive: ROOMS_LIVE,
    hasActiveRoom: classified.hasActiveRoom === true,
    mode,
    level: classified.level,
    command: classified.command || "",
    lifecycle,
    participantCount: classified.hasActiveRoom ? Math.min(MEMBER_CAP, Number(options.participantCount) || 1) : 0,
    participantCap: MEMBER_CAP,
    hostIncludedInCap: true,
    needsConfirmation: classified.needsConfirmation === true,
    injectionDenied: classified.injection === true,
    namedNeedles: Array.isArray(classified.namedNeedles) ? classified.namedNeedles : [],
    authorizedTitle: authorized.authorizedTitle,
    authorizedDescription: authorized.authorizedDescription,
    sharePreview: {
      facts: Array.isArray(classified.shareFacts) ? classified.shareFacts : [],
      includesPrivateThread: false,
      includesSmartSummary: false,
      includesOtherProfiles: false,
      publishAllowed: false
    },
    actions: {
      create: false,
      invite: classified.hasActiveRoom === true,
      kick: false,
      end: classified.hasActiveRoom === true,
      tabOptIn: false,
      charge: false
    },
    joinHref: text(options.joinHref, 240),
    replyKey: copy.key,
    declineKey: classified.declineKey || declineKey(classified)
  };
}

function buildRoomSession(raw, opts) {
  const classified = classifyRoomIntent(raw, opts);
  if (!classified.handled) {
    return {handled: false, classified};
  }
  const view = buildRoomSmartView({...opts, classified, utterance: raw});
  const copy = replyFor(classified);
  return {
    handled: true,
    classified,
    reply: copy.text,
    replyKey: copy.key,
    smartViews: [view],
    provider: "local-room-smartview",
    model: "roomSmartView",
    geminiOnView: false
  };
}

const api = {
  SCHEMA_VERSION,
  KIND,
  MEMBER_CAP,
  ROOMS_LIVE,
  normalizeUtterance,
  classifyRoomIntent,
  isRoomSmartViewPrompt,
  buildRoomSmartView,
  buildRoomSession,
  declineKey,
  shareableFactsFromUtterance,
  extractNamedNeedles
};

if (typeof module === "object" && module.exports) {
  module.exports = api;
}
if (typeof globalThis !== "undefined") {
  globalThis.FLOQRBotDeeRoomSmartView = api;
}
