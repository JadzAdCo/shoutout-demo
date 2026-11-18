/* BOT DEE chat client — wires botdee.html transcript to executeBotSession.
   Intent search stays available as a collapsible fast path / fallback.
   Durable threads (getBotDeeThread): signed-in refresh / second device resume.
   Greetings / acks are local-only when durable is off so a stale Functions deploy cannot
   turn "hello"/"cool" into a contextual-search miss.
   Offer-help CTA only at conversation start and after an idle-ended resume.
   Conversation pause (default 300s / 5 min, Master Admin botDeeSettings/default) ends the chat. */
(function (global) {
  "use strict";

  const MAX_HISTORY = 12;
  const DEFAULT_IDLE_SECONDS = 300;
  const MIN_IDLE_SECONDS = 15;
  const MAX_IDLE_SECONDS = 600;
  const history = [];

  /** fresh = welcome only · active = talking · ended = idle/farewell closed */
  let phase = "fresh";
  let idleSeconds = DEFAULT_IDLE_SECONDS;
  let idleTimer = null;
  let settingsLoaded = false;
  let durableEnabled = false;
  let threadId = "";
  let restoreStarted = false;
  let restoreInFlight = false;
  let chatsOpen = false;
  let signedInForChats = false;
  let storedTurns = [];
  let storedArchiveTurns = [];
  let storedLastMessageAtMs = 0;
  let visitLiveTurns = [];
  let chatsUiBound = false;
  let chatTitles = {};
  let liveConversationId = "";
  let storedConversationId = "";
  let archiveConversationId = "";
  let renameTarget = null;
  let renameDialogBound = false;
  let swallowRename = null;
  let swallowRenameTimer = 0;
  const LONG_PRESS_MS = 520;
  const SWALLOW_CLICK_MS = 800;
  const CHAT_TITLE_MAX = 80;

  const byId = id => document.getElementById(id);
  const t = (key, fallback) => {
    const value = global.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

  function currentUiLanguage() {
    try {
      if (typeof global.FLOQRI18n?.getLanguage === "function") {
        return String(global.FLOQRI18n.getLanguage() || "en").split(/[-_]/)[0] || "en";
      }
      return String(localStorage.getItem("floqr.uiLanguage") || "en").split(/[-_]/)[0] || "en";
    } catch (_) {
      return "en";
    }
  }

  function canUseFeature(key) {
    try {
      const FS = global.FLOQRFeatureServices;
      if (FS && typeof FS.canAccess === "function") return !!FS.canAccess(key);
    } catch (_) {}
    return key === "shoutOut" || key === "botDee" || key === "passes";
  }

  function featureKeyForResult(row) {
    const sid = String(row?.sourceId || "");
    const id = String(row?.id || "");
    const probe = `${sid} ${id}`;
    if (/mingl/i.test(probe)) return "mingl";
    if (/\brydr\b/i.test(probe)) return "rydr";
    if (/bartr|bart-?r/i.test(probe)) return "bartr";
    if (/floqcast|suprstr/i.test(probe)) return "floqCast";
    if (/\bvip\b|reserv/i.test(probe)) return "vipReservations";
    if (/shout/i.test(probe)) return "shoutOut";
    return null;
  }

  /** VIP product phrases across app languages.
   *  Unicode letter boundaries — ASCII `\b` misses Cyrillic/Greek/Arabic. */
  const VIP_BRAND_RE =
    /(?<![\p{L}\p{N}_])(?:VIP\s*reserV|VIP[- ]?(?:table|tables|entry|entries|Tisch|Tische|tafel|tafels|стол|стола)|(?:table|tables|mesa|mesas|tavolo|tavoli|stolik|stoliki)\s+VIP|VIP\s+τραπέζι|طاولة\s+VIP)(?![\p{L}\p{N}_])/giu;

  function scrubGatedBrands(text) {
    let out = String(text || "");
    if (!canUseFeature("mingl")) out = out.replace(/\bMingl\b/g, "");
    if (!canUseFeature("rydr")) out = out.replace(/\bRydR\b/g, "");
    if (!canUseFeature("bartr")) out = out.replace(/\bBartR\b/g, "");
    if (!canUseFeature("floqCast")) out = out.replace(/\bfloqCast\b|\bFloqCAST\b|\bFloqCast\b/g, "");
    if (!canUseFeature("vipReservations")) out = out.replace(VIP_BRAND_RE, "");
    out = out
      .replace(/\(\s*superstar\s*\)/gi, "")
      .replace(/\s+(?:or|oder|ou|o|или|ή|lub|أو)\s+,/gi, ",")
      .replace(/\(\s*\)/g, "")
      .replace(/:\s*,/g, ":");
    let prev = "";
    while (prev !== out) {
      prev = out;
      out = out
        .replace(/,\s*,+/g, ",")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+,/g, ",")
        .replace(/,\s*$/g, "")
        .replace(/^,\s*/g, "")
        .trim();
    }
    return out;
  }

  /** Client safety net — locale remap + drop results for features the viewer cannot use. */
  function localizeResults(results) {
    const lang = currentUiLanguage();
    const helpPack = (lang && lang !== "en") ? (global.FLOQRI18nHelp?.packs?.[lang] || {}) : {};
    const intentLabel = {
      shoutout: "cat.shoutout",
      floqcast: "cat.floqcast",
      "vip-reserv": "cat.vipreserv",
      mingl: "cat.mingl",
      rydr: "cat.rydr",
      bartr: "cat.bartr",
      clubs: "cat.clubs",
      "venue-search": "botdee.intentLabel.venueSearch",
      "ad-campaigns": "botdee.intentLabel.adCampaigns",
      "ballers-alert": "botdee.intentLabel.ballersAlert",
      "classic-halloween": "botdee.intentLabel.classicHalloween",
      "football-intro": "botdee.intentLabel.footballIntro",
      shiloh: "botdee.intentLabel.shiloh",
      "tengo-muchos-dolares": "botdee.intentLabel.tengoMuchosDolares"
    };
    const actionByKind = {
      checkout: "botdee.link.paySecurely",
      floqcast: "botdee.link.floqcastPreview",
      shoutout: "botdee.link.shoutoutCompose",
      vip: "botdee.link.vipTerms"
    };
    return (results || []).filter(row => {
      const key = featureKeyForResult(row);
      return !key || canUseFeature(key);
    }).map(row => {
      if (!row || typeof row !== "object") return row;
      const next = Object.assign({}, row);
      const sourceId = String(row.sourceId || "");
      const kind = String(row.kind || "").toLowerCase();
      if (sourceId.startsWith("help:") || sourceId.startsWith("intent:help-") || String(row.id || "").startsWith("help-")) {
        const id = sourceId.startsWith("help:")
          ? sourceId.slice(5)
          : (sourceId.startsWith("intent:") ? sourceId.slice("intent:".length) : String(row.id || ""));
        const hit = helpPack[id];
        if (hit?.title) next.label = hit.title;
        if (hit?.body) next.blurb = String(hit.body).replace(/\s+/g, " ").trim().slice(0, 280);
      } else if (sourceId.startsWith("intent:") || kind === "product") {
        const id = sourceId.startsWith("intent:") ? sourceId.slice(7) : String(row.id || "");
        const labelKey = intentLabel[id];
        if (labelKey) {
          const label = t(labelKey, next.label);
          if (label) next.label = label;
        }
        const blurb = t(`botdee.intentBlurb.${id}`, "");
        if (blurb && blurb !== `botdee.intentBlurb.${id}`) next.blurb = blurb;
      } else if (actionByKind[kind]) {
        next.label = t(actionByKind[kind], next.label);
      }
      next.label = scrubGatedBrands(next.label);
      next.blurb = scrubGatedBrands(next.blurb);
      return next;
    });
  }

  /** Mirror of functions/bot-dee-core.js isChitchatPrompt / isAckPrompt / replies. */
  function normalizeChat(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9@\s._/-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const CHITCHAT_TAIL =
    "(?:\\s+(?:bot\\s*dee|floqai|floq\\s*ai|there|again|friend|everyone|yall|y all|sir|ma'?am|madam|miss|mister|mr|ms|mrs|boss|chief|captain|don))*";

  function isAckPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 80) return false;
    return new RegExp(`^(?:thanks|thank you|thx|ty|ok|okay|k|kk|cool|nice|great|awesome|perfect|sweet|lit|bet|fire|dope|solid|rad|alright|all right|got it|sounds good|sounds cool|that s cool|thats cool|that is cool|makes sense|copy|roger|yes|yeah|yep|yup|sure|absolutely|for sure|no problem|np|bye|goodbye|see ya|see you|later|peace)${CHITCHAT_TAIL}$`).test(q);
  }

  function isFarewellPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 80) return false;
    return new RegExp(`^(?:bye|goodbye|see ya|see you|later|peace)${CHITCHAT_TAIL}$`).test(q);
  }

  function isMoodPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 100) return false;
    const moodCore =
      "(?:how are you|how re you|how r you|hows it going|how s it going|how is it going|" +
      "how you doing|how are things|how have you been|hows your day|how s your day|how is your day|" +
      "how was your day|what s new|whats new|how do you feel|you good|you okay|you ok|" +
      "how goes it|hows everything|how s everything|how is everything)";
    return new RegExp(`^(?:(?:hey|hi|hello|howdy|yo)\\s+)?${moodCore}(?:\\s+today)?${CHITCHAT_TAIL}$`).test(q);
  }

  function isChitchatPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 100) return false;
    if (isAckPrompt(q)) return true;
    if (isMoodPrompt(q)) return true;
    if (new RegExp(`^(?:hey|hi|hello|howdy|yo|sup|hiya|hola)${CHITCHAT_TAIL}$`).test(q)) return true;
    if (new RegExp(`^(?:good morning|good afternoon|good evening|good night|what s up|whats up|what up)${CHITCHAT_TAIL}$`).test(q)) return true;
    return false;
  }

  function isIdentityPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 120) return false;
    if (/^(?:who are you|what(?:'s| s| is) your name|what are you called)\b/.test(q)) return true;
    if (/how (?:is|do you|do i|to) (?:your |the )?name pronounc/.test(q)) return true;
    if (/how (?:do you|to) pronounce (?:your name|bot\s*dee|floqai|floq\s*ai|floqr)\b/.test(q)) return true;
    if (/^(?:pronounce|pronunciation) (?:bot\s*dee|your name|floqai|floqr)?\b/.test(q)) return true;
    if (/^what does (?:bot\s*dee|floqai|floq\s*ai) (?:mean|stand for)\b/.test(q)) return true;
    return false;
  }

  const PRIVILEGE_REFUSE_EN = "I don't have account-security details.";
  const VIEWER_PRIVILEGE_ROLE = "(?:master(?:\\s|-)*admin|super(?:\\s|-)*admin|beta(?:\\s|-)*tester|club(?:\\s|-)*admin|privileged(?:\\s|-)*employee)";
  /** Keep in sync with functions/botdee-privilege-guard.js (test asserts identical join source). */
  const PRIVILEGE_LEAK_RE = new RegExp([
    `\\bi\\s+(?:can\\s+)?see\\s+you\\s+as\\b`,
    `\\byour\\s+login\\s+is\\s+(?:a\\s+|an\\s+)?(?:master|${VIEWER_PRIVILEGE_ROLE})\\b`,
    `\\byour\\s+role\\s+is\\s+(?:a\\s+|an\\s+)?(?:master|${VIEWER_PRIVILEGE_ROLE})\\b`,
    `\\byou(?:'re|\\s+are|\\s+were|\\s+have\\s+been)\\s+(?:a\\s+|an\\s+)?${VIEWER_PRIVILEGE_ROLE}\\b`,
    `\\byou\\s+(?:have|use|enabled)\\s+(?:a\\s+|an\\s+)?(?:${VIEWER_PRIVILEGE_ROLE}|sos\\s*-?\\s*2fa|sos2fa)\\b`,
    `\\byou\\s+(?:can|cannot|can't|may|may\\s+not)\\s+(?:open|access)\\s+(?:the\\s+)?master(?:\\s|-)*admin\\b`,
    `\\bwhether\\s+you\\s+can\\s+open\\s+master(?:\\s|-)*admin\\b`,
    `\\byour\\s+(?:sos\\s*-?\\s*2fa|sos2fa)\\b`,
    `\\byour\\s+(?:token\\s+|id\\s+token\\s+|custom\\s+)?claims\\b`,
    `\\byour\\s+classification\\s+role\\b`,
    `\\byour\\s+club[- ]admin\\s+status\\b`,
    `\\bviewer\\s+classification\\b`,
    `\\b(?:this\\s+user|this\\s+account|the\\s+viewer|the\\s+signed[-\\s]?in\\s+user|the\\s+user|viewer)\\s+is\\s+(?:a\\s+|an\\s+)?(?:master|${VIEWER_PRIVILEGE_ROLE})\\b`,
    `\\buser\\s+is\\s+(?:a\\s+|an\\s+)?(?:master|${VIEWER_PRIVILEGE_ROLE})\\b`,
    "\\bisMasterAdmin\\b",
    "\\bisSuperAdmin\\b",
    "\\bisBetaTester\\b",
    "\\bisClubAdmin\\b",
    "\\btokenClaims\\b",
    "\\bcustomClaims\\b"
  ].join("|"), "i");

  function privilegeRefuseReply() {
    return t("botdee.privilegeRefuse", PRIVILEGE_REFUSE_EN);
  }

  function isPrivilegeAskPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 200) return false;
    if (/^(?:who am i|about me|what do you know about me|tell me about me)\??$/.test(q)) return false;
    if (/(?:am i|are we|is my (?:account|login)|do i have|what(?: s| is) my|can i open|can i access).{0,48}club\s*-?\s*admin/.test(q)) {
      return true;
    }
    if (/(?:am i|are we|is my (?:account|login|user)|do i have|what(?: s| is) my|can i open|can i access|tell me if i(?: m| am))/.test(q)
      && /master\s*-?\s*admin|super\s*-?\s*admin|sos\s*-?\s*2fa|sos2fa|beta\s*-?\s*tester|token\s+claims?|custom\s+claims?/.test(q)) {
      return true;
    }
    if (/^(?:am i (?:a |the )?(?:master|super|admin|privileged)|what(?: s| is) my (?:privilege|access level|admin status)|what privileges? do i have)\??$/.test(q)) {
      return true;
    }
    return false;
  }

  function packageLabel() {
    try {
      const nav = global.FLOQRNav;
      const v = String(nav?.appVersion || (typeof nav?.currentVersion === "function" ? nav.currentVersion() : "") || "").trim();
      if (v) return v.startsWith("s") ? v : `s${v}`;
    } catch (_) {}
    try {
      const scripts = document.querySelectorAll("script[src*='bot-dee-chat.js']");
      for (const el of scripts) {
        const m = String(el.getAttribute("src") || "").match(/[?&]v=([^&#]+)/);
        if (m && m[1]) return m[1].startsWith("s") ? m[1] : `s${m[1]}`;
      }
    } catch (_) {}
    return "s3.3.037";
  }

  function isVersionSmartViewAlias(raw) {
    const q = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[?؟]+$/g, "")
      .trim();
    return q === "ver" || q === "vers" || q === "version";
  }

  function isVersionPrompt(raw) {
    if (isVersionSmartViewAlias(raw)) return true;
    const q = normalizeChat(raw);
    if (!q || q.length > 140) return false;
    // Product commerce / feature wording — never hijack as FLOQR stamp.
    if (/\b(?:shout\s*out|vip|floq\s*cast|floqcast|baller|jersey|template|checkout|stripe|deposit|table)\b/.test(q)) {
      return false;
    }
    if (/\b(?:your|bot\s*dee|floqr|app|software)\s+(?:version|build|package|release)\b/.test(q)) return true;
    if (/\b(?:what|which|whats|what s|what is)\s+(?:your|the)\s+(?:version|build)(?:\s+info|\s+number)?\b/.test(q)) return true;
    if (/\b(?:what|which|whats|what s|what is)\s+(?:version|build)\s+of\s+(?:floqr|bot\s*dee|the\s+app|this\s+app|the\s+software)\b/.test(q)) return true;
    if (/\b(?:version|build)\s+of\s+(?:floqr|bot\s*dee|the\s+app|this\s+app)\b/.test(q)) return true;
    if (/^(?:what|which)\s+(?:version|build)\??$/.test(q)) return true;
    if (/\b(?:what|which|whats|what s|what is|tell me|name)\b.{0,24}\b(?:your|bot\s*dee|floqr)\b.{0,20}\b(?:version|build|package|release)\b/.test(q)) return true;
    if (/\b(?:what|which)\s+(?:package|release)\s+(?:are you|is this|is floqr|am i on)\b/.test(q)) return true;
    if (/^(?:version|build)(?:\s+info|\s+number)?\??$/.test(q)) return true;
    if (/^(?:package|release)\s+(?:info|version|number)\??$/.test(q)) return true;
    if (/\bversion\s+info\b/.test(q)) return true;
    if (/\bwhat\s+(?:is\s+)?deployed\b/.test(q)) return true;
    if (/\bwhat\s+changed\b/.test(q)) return true;
    if (/\bwhat\s+limitations?\b/.test(q)) return true;
    if (/\bwhich\s+integrations?\s+(?:are\s+)?approved\b/.test(q)) return true;
    if (/\bwhat\s+version\s+are\s+you\s+running\b/.test(q)) return true;
    return false;
  }

  /** Bare help / how-to-use-BOT-DEE — answer locally like version; do not dump search cards. */
  function isHelpPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 120) return false;
    if (/\b(?:shout\s*out|vip|floq\s*cast|floqcast|mingl|rydr|bartr|schedule|jersey|baller|template|checkout)\b/.test(q)) {
      return false;
    }
    if (/^(?:help|aide|ayuda|hilfe|aiuto|ajuda|помощь|βοήθεια|pomoc|مساعدة)\??$/.test(q)) return true;
    if (/^(?:\?|help me|need help|i need help)\??$/.test(q)) return true;
    if (/^(?:how (?:do|can|to) (?:i|you) (?:use|get help(?: from)?|ask)(?: (?:you|bot\s*dee|floqr))?)\??$/.test(q)) return true;
    if (/^(?:what can (?:you|bot\s*dee) (?:do|help(?: me)? with))\??$/.test(q)) return true;
    if (/^(?:bot\s*dee help|help bot\s*dee|show help|get help)\??$/.test(q)) return true;
    if (/\b(?:how (?:do|can) i use (?:you|bot\s*dee)|what (?:are you|can you) (?:for|help with))\b/.test(q)) return true;
    return false;
  }

  function isPrivacyPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 140) return false;
    if (/^(?:privacy|session|pause|keyboard)\??$/.test(q)) return true;
    if (/^(?:privacy (?:and|&)? session|session (?:pause|privacy)|five minute(?:s)?(?: pause)?|5 minute(?:s)?(?: pause)?)\??$/.test(q)) return true;
    if (/\b(?:enter sends|shift enter|shift\+enter|keyboard shortcuts?)\b/.test(q)) return true;
    if (/\b(?:five.?minute pause|session pause|live chat pause|privacy and session)\b/.test(q)) return true;
    return false;
  }

  function clampIdleSeconds(raw) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return DEFAULT_IDLE_SECONDS;
    return Math.min(MAX_IDLE_SECONDS, Math.max(MIN_IDLE_SECONDS, n));
  }

  /** Offer-help — start / idle-resume greetings only. */
  function accessibleProductPitch() {
    const FS = global.FLOQRFeatureServices;
    const parts = [];
    const can = key => {
      try {
        if (FS && typeof FS.canAccess === "function") return !!FS.canAccess(key);
      } catch (_) {}
      return key === "shoutOut";
    };
    if (can("shoutOut")) parts.push("ShoutOut");
    if (can("vipReservations")) parts.push("VIP table");
    if (can("floqCast")) parts.push("floqCast");
    parts.push("scheduling");
    if (parts.length <= 1) return parts[0] ? `${parts[0]} — just say it in plain words.` : "just say it in plain words.";
    const head = parts.slice(0, -1).join(", ");
    return `${head}, or ${parts[parts.length - 1]} — just say it in plain words.`;
  }

  function chitchatReply() {
    const fromPrefs = global.FLOQRBotDeePersonalization?.greetingFor?.();
    if (fromPrefs) return fromPrefs;
    const localized = t("botdee.chatHello", "");
    if (localized && localized !== "botdee.chatHello") {
      return scrubGatedBrands(localized);
    }
    return "Good afternoon. How can I help?";
  }

  /** Soft mid-chat ack — no product pitch. */
  function ackReply(raw) {
    const q = normalizeChat(raw);
    if (isFarewellPrompt(q)) {
      return t("botdee.chatBye", "Take care — say hi when you want to pick up again.");
    }
    if (/^(?:thanks|thank you|thx|ty)\b/.test(q)) {
      return t("botdee.chatThanks", "You're welcome.");
    }
    return t("botdee.chatAck", "Cool.");
  }

  /** Friendly mood reply — chatable, not a search dump. */
  function moodReply() {
    return t(
      "botdee.chatMood",
      "I'm doing great — thanks for asking! What can I help you with in FLOQR?"
    );
  }

  function identityReply() {
    return t(
      "botdee.chatIdentity",
      "I'm BOT DEE — say it like \"bot\" + \"dee\" (the letter D). I'm FLOQR's in-app helper."
    );
  }

  function versionReply(text) {
    if (isVersionSmartViewAlias(text)) return "";
    const label = packageLabel();
    const intro = t("botdee.vs.intro", "Here's the current version information for FLOQR and BOT DEE.");
    if (intro && intro !== "botdee.vs.intro") return intro;
    const template = t("botdee.chatVersion", "I'm BOT DEE on FLOQR package {version}.");
    return String(template).replace(/\{version\}/g, label);
  }

  function ensureVersionSmartViews(text, views) {
    const list = Array.isArray(views) ? views.slice() : [];
    if (!isVersionPrompt(text)) return list;
    const hasVersion = list.some(row => row && row.kind === "botDeeVersion");
    if (hasVersion) return list;
    const local = global.FLOQRBotDeeSmartView?.localVersionPayload?.();
    if (local) list.push(local);
    return list;
  }

  const ROOM_DECLINE_KEY = "floqr.roomSmartView.declined";

  function loadRoomDeclined() {
    try {
      const rows = JSON.parse(global.sessionStorage?.getItem(ROOM_DECLINE_KEY) || "[]");
      return Array.isArray(rows) ? rows.map(String).slice(0, 24) : [];
    } catch (_) {
      return [];
    }
  }

  function rememberRoomDecline(key) {
    const token = String(key || "").slice(0, 80);
    if (!token) return;
    const next = [...new Set(loadRoomDeclined().concat(token))].slice(-24);
    try {
      global.sessionStorage?.setItem(ROOM_DECLINE_KEY, JSON.stringify(next));
    } catch (_) {}
  }

  function roomApi() {
    return global.FLOQRBotDeeRoomSmartView || null;
  }

  function isRoomSmartViewPrompt(raw) {
    try {
      return !!(roomApi() && roomApi().isRoomSmartViewPrompt(raw, {
        hasActiveRoom: false,
        declinedKeys: loadRoomDeclined()
      }));
    } catch (_) {
      return false;
    }
  }

  function buildLocalRoomSession(text) {
    const api = roomApi();
    if (!api || typeof api.buildRoomSession !== "function") return null;
    const session = api.buildRoomSession(text, {
      hasActiveRoom: false,
      declinedKeys: loadRoomDeclined()
    });
    return session && session.handled ? session : null;
  }

  function ensureRoomSmartViews(text, views) {
    const list = Array.isArray(views) ? views.slice() : [];
    if (list.some(row => row && row.kind === "botDeeRoom")) return list;
    const session = buildLocalRoomSession(text);
    if (session && session.smartViews && session.smartViews[0]) list.push(session.smartViews[0]);
    return list;
  }

  function roomReplyText(session, fallback) {
    const key = session && session.replyKey;
    if (key) {
      const localized = t(key, fallback || session.reply || "");
      if (localized && localized !== key) return localized;
    }
    return fallback || (session && session.reply) || "";
  }

  function helpReply() {
    const localized = t("botdee.chatHelp", "");
    if (localized && localized !== "botdee.chatHelp") {
      return scrubGatedBrands(localized);
    }
    return "I'm BOT DEE — ask me anything about FLOQR in plain words. Press Enter to send; Shift+Enter starts a new line. Type privacy for pause and session details. What are you interested in getting help with?";
  }

  function privacyReply() {
    return t(
      "botdee.privacyReply",
      "The five-minute pause ends this live session. It does not delete this signed-in chat, memories, or workflows. Opt-in copies in My Profile → Feature & Orders → My BOT DEE stay too. Guests stay ephemeral. Mingl chats are never copied here. Press Enter to send; Shift+Enter starts a new line."
    );
  }

  function stillHereReply() {
    return t("botdee.chatStillHere", "Hey — still here.");
  }

  function idleEndedReply() {
    return t(
      "botdee.chatIdleEnded",
      "I'll pause here for now. Say hi when you want to pick up again."
    );
  }

  function resumeReply() {
    const fromPrefs = global.FLOQRBotDeePersonalization?.greetingFor?.();
    if (fromPrefs) return fromPrefs;
    const localized = t("botdee.chatResume", "");
    if (localized && localized !== "botdee.chatResume") {
      return scrubGatedBrands(localized);
    }
    return "Welcome back. How can I help?";
  }

  function callable(name) {
    try {
      if (!global.firebase?.functions || !global.firebase.apps?.length) return null;
      return global.firebase.app().functions("us-central1").httpsCallable(name || "executeBotSession");
    } catch (_) {
      return null;
    }
  }

  function waitForAuthUser(ms) {
    return new Promise(resolve => {
      let auth;
      try {
        auth = global.firebase.auth();
      } catch (_) {
        resolve(null);
        return;
      }
      if (auth.currentUser) {
        resolve(auth.currentUser);
        return;
      }
      let done = false;
      const finish = user => {
        if (done) return;
        done = true;
        try { unsub(); } catch (_) { /* ignore */ }
        resolve(user || null);
      };
      let unsub = () => {};
      try {
        unsub = auth.onAuthStateChanged(user => finish(user));
      } catch (_) {
        finish(null);
        return;
      }
      setTimeout(() => finish(auth.currentUser), ms || 8000);
    });
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Dedicated robot-head mark for bubble origin (not Site-chrome pack JPG).
  const BOT_AVATAR_SRC = "./images/botdee-chat-avatar.png";

  function hostEndsWith(host, suffix) {
    return host === suffix || host.endsWith(`.${suffix}`);
  }

  function isAllowedPhotoUrl(raw) {
    let parsed;
    try {
      parsed = new URL(String(raw || "").trim());
    } catch (_) {
      return false;
    }
    const sameOrigin = typeof location !== "undefined" && parsed.origin === location.origin;
    if (parsed.protocol !== "https:" && !sameOrigin) return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    if (hostEndsWith(host, "stripe.com") || hostEndsWith(host, "stripe.network")) return false;
    if (host === "firebasestorage.googleapis.com" || hostEndsWith(host, "firebasestorage.app")) return true;
    if (hostEndsWith(host, "googleusercontent.com")) return true;
    const path = `${parsed.pathname || ""}${parsed.search || ""}`;
    if (/\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:$|[?#])/i.test(path)) return true;
    if (/\/o\//.test(parsed.pathname || "") && /alt=media/i.test(parsed.search || "")) return true;
    return false;
  }

  function harvestMediaFromText(raw) {
    const seen = new Set();
    const out = [];
    String(raw || "").replace(/https?:\/\/[^\s)\]>'"]+/gi, url => {
      const clean = String(url || "").replace(/[.,;:]+$/, "").trim();
      if (!isAllowedPhotoUrl(clean) || seen.has(clean)) return "";
      seen.add(clean);
      out.push({url: clean, alt: "Public photo", kind: "photo"});
      return "";
    });
    return out.slice(0, 8);
  }

  function stripBackendLinks(raw) {
    let text = String(raw || "");
    text = text.replace(/\[[^\]]{0,120}\]\((https?:[^)\s]+)\)/gi, (full, url) => (
      isAllowedPhotoUrl(url) || /firebasestorage|googleusercontent/i.test(url) ? "" : full
    ));
    text = text.replace(/https?:\/\/[^\s)\]>'"]+/gi, url => {
      const clean = String(url || "").replace(/[.,;:]+$/, "");
      return (isAllowedPhotoUrl(clean) || /firebasestorage|googleusercontent/i.test(clean)) ? "" : url;
    });
    text = text.replace(/\b(?:view image|gallery photo\s*\d+|profile picture)\s*:?/gi, " ");
    text = text.replace(/\(\s*\)/g, "");
    text = text.replace(/[ \t]{2,}/g, " ");
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  }

  function mergeMedia(fromServer, fromText) {
    const seen = new Set();
    const out = [];
    [...(Array.isArray(fromServer) ? fromServer : []), ...(Array.isArray(fromText) ? fromText : [])].forEach(item => {
      const url = String(item?.url || "").trim();
      if (!isAllowedPhotoUrl(url) || seen.has(url)) return;
      seen.add(url);
      out.push({url, alt: String(item.alt || "Public photo").slice(0, 80), kind: "photo"});
    });
    return out.slice(0, 8);
  }

  const PHOTO_POPOUT_NAME = "botdeePhotoPopout";
  const PHOTO_FLY_MS = 420;
  const PHOTO_GROW_MS = 360;
  let photoPopoutWin = null;

  function prefersReducedMotion() {
    try {
      return !!(global.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {
      return false;
    }
  }

  function chromeOffset() {
    return {
      x: Math.max(0, (window.outerWidth || 0) - (window.innerWidth || 0)),
      y: Math.max(0, (window.outerHeight || 0) - (window.innerHeight || 0))
    };
  }

  function sourceBox(sourceEl) {
    const rect = sourceEl && typeof sourceEl.getBoundingClientRect === "function"
      ? sourceEl.getBoundingClientRect()
      : {left: window.innerWidth / 2 - 48, top: window.innerHeight / 2 - 48, width: 96, height: 96};
    const w = Math.max(48, rect.width || 96);
    const h = Math.max(48, rect.height || 96);
    const chrome = chromeOffset();
    return {
      left: rect.left,
      top: rect.top,
      w,
      h,
      x: Math.round((window.screenX || 0) + chrome.x + rect.left),
      y: Math.round((window.screenY || 0) + chrome.y + rect.top)
    };
  }

  function targetPopupBox() {
    const availW = window.screen?.availWidth || window.innerWidth || 980;
    const availH = window.screen?.availHeight || window.innerHeight || 860;
    const w = Math.min(980, Math.max(480, Math.round(availW * 0.72)));
    const h = Math.min(860, Math.max(480, Math.round(availH * 0.82)));
    const availLeft = window.screen?.availLeft || 0;
    const availTop = window.screen?.availTop || 0;
    return {
      w,
      h,
      x: Math.round(availLeft + (availW - w) / 2),
      y: Math.round(availTop + (availH - h) / 2)
    };
  }

  function targetViewBox(to) {
    const chrome = chromeOffset();
    return {
      left: to.x - (window.screenX || 0) - chrome.x,
      top: to.y - (window.screenY || 0) - chrome.y,
      w: to.w,
      h: to.h
    };
  }

  function photoPopoutFeatures(from) {
    const w = Math.max(160, Math.round(from.w));
    const h = Math.max(160, Math.round(from.h));
    return [
      "popup=yes",
      "toolbar=no",
      "menubar=no",
      "location=no",
      "personalbar=no",
      "status=no",
      "scrollbars=no",
      "resizable=yes",
      `width=${w}`,
      `height=${h}`,
      `left=${Math.max(0, from.x)}`,
      `top=${Math.max(0, from.y)}`
    ].join(",");
  }

  function storePhotoPopoutPayload(payload) {
    global.__floqrBotDeePhotoPopout = payload;
    try { sessionStorage.setItem("floqr.botdeePhotoPopout", JSON.stringify(payload)); } catch (_) {}
  }

  function playPhotoFlyout(from, toView, url) {
    if (prefersReducedMotion() || !from || !url) return;
    document.querySelectorAll(".botdee-photo-flyout").forEach(node => node.remove());
    const fly = document.createElement("div");
    fly.className = "botdee-photo-flyout";
    fly.setAttribute("aria-hidden", "true");
    Object.assign(fly.style, {
      left: `${Math.round(from.left)}px`,
      top: `${Math.round(from.top)}px`,
      width: `${Math.round(from.w)}px`,
      height: `${Math.round(from.h)}px`
    });
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    fly.appendChild(img);
    document.body.appendChild(fly);
    const finish = () => { try { fly.remove(); } catch (_) {} };
    if (typeof fly.animate === "function") {
      const anim = fly.animate([
        {left: `${Math.round(from.left)}px`, top: `${Math.round(from.top)}px`, width: `${Math.round(from.w)}px`, height: `${Math.round(from.h)}px`, opacity: 1, offset: 0},
        {left: `${Math.round(toView.left)}px`, top: `${Math.round(toView.top)}px`, width: `${Math.round(toView.w)}px`, height: `${Math.round(toView.h)}px`, opacity: 0.15, offset: 1}
      ], {duration: PHOTO_FLY_MS, easing: "cubic-bezier(0.2, 0.85, 0.2, 1)", fill: "forwards"});
      anim.addEventListener("finish", finish);
      anim.addEventListener("cancel", finish);
    } else {
      fly.classList.add("is-popping");
    }
    setTimeout(finish, PHOTO_FLY_MS + 80);
  }

  function animatePhotoPopout(win, from, to) {
    if (!win || win.closed) return;
    const reduced = prefersReducedMotion();
    const apply = (box) => {
      try {
        win.resizeTo(Math.max(160, Math.round(box.w)), Math.max(160, Math.round(box.h)));
        win.moveTo(Math.round(box.x), Math.round(box.y));
      } catch (_) {}
    };
    if (reduced) {
      apply(to);
      return;
    }
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const ease = p => 1 - Math.pow(1 - p, 3);
    const frame = now => {
      if (!win || win.closed) return;
      const elapsed = Math.max(0, now - t0);
      const p = ease(Math.min(1, elapsed / PHOTO_GROW_MS));
      apply({
        w: from.w + (to.w - from.w) * p,
        h: from.h + (to.h - from.h) * p,
        x: from.x + (to.x - from.x) * p,
        y: from.y + (to.y - from.y) * p
      });
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function closePhotoViewer() {
    document.querySelectorAll(".botdee-photo-flyout").forEach(node => node.remove());
    const win = photoPopoutWin;
    photoPopoutWin = null;
    if (win && !win.closed) {
      try { win.close(); } catch (_) {}
    }
  }

  function openPhotoViewer(items, startIndex, sourceEl) {
    const list = (Array.isArray(items) ? items : []).filter(item => isAllowedPhotoUrl(item?.url));
    if (!list.length) return;
    const index = Math.max(0, Math.min(Number(startIndex) || 0, list.length - 1));
    const from = sourceBox(sourceEl);
    const to = targetPopupBox();
    const payload = {
      items: list.map(item => ({url: item.url, alt: String(item.alt || "").slice(0, 80)})),
      index,
      labels: {
        title: t("botdee.photoDialog", "Enlarged photo"),
        close: t("botdee.photoClose", "Close"),
        prev: t("botdee.photoPrev", "Previous photo"),
        next: t("botdee.photoNext", "Next photo")
      }
    };
    storePhotoPopoutPayload(payload);
    let href = "./botdee-photo-popout.html";
    try { href = new URL("botdee-photo-popout.html", location.href).href; } catch (_) {}
    closePhotoViewer();
    let win = null;
    try { win = window.open(href, PHOTO_POPOUT_NAME, photoPopoutFeatures(from)); } catch (_) { win = null; }
    playPhotoFlyout(from, targetViewBox(to), list[index].url);
    if (!win) {
      setStatus(t("botdee.photoPopoutBlocked", "Allow pop-up windows to enlarge the photo. The chat stays behind."));
      return;
    }
    photoPopoutWin = win;
    animatePhotoPopout(win, from, to);
    try { win.focus(); } catch (_) {}
  }

  function appendPhotoGallery(article, media) {
    if (!Array.isArray(media) || !media.length) return;
    const gallery = document.createElement("div");
    gallery.className = "botdee-photo-gallery";
    gallery.setAttribute("role", "list");
    media.forEach((item, index) => {
      const figure = document.createElement("figure");
      figure.className = "botdee-photo";
      figure.setAttribute("role", "listitem");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "botdee-photo-open";
      button.setAttribute("aria-label", t("botdee.photoEnlarge", "Enlarge photo"));
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.alt || "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      button.appendChild(img);
      button.addEventListener("click", event => openPhotoViewer(media, index, event.currentTarget));
      figure.appendChild(button);
      gallery.appendChild(figure);
    });
    article.appendChild(gallery);
  }

  function appendBubble(role, text, results, media, smartViews, peopleSearch) {
    const log = byId("botDeeTranscript");
    if (!log) return;
    const isUser = role === "user";
    const row = document.createElement("div");
    row.className = `botdee-msg botdee-msg-${isUser ? "user" : "bot"}`;

    if (!isUser) {
      const avatar = document.createElement("img");
      avatar.className = "botdee-msg-avatar";
      avatar.src = BOT_AVATAR_SRC;
      avatar.alt = "BOT DEE";
      avatar.width = 36;
      avatar.height = 36;
      avatar.decoding = "async";
      row.appendChild(avatar);
    }

    const article = document.createElement("article");
    article.className = `botdee-bubble botdee-bubble-${isUser ? "user" : "bot"}`;
    article.setAttribute("data-role", isUser ? "user" : "bot");
    if (!isUser) {
      const tail = document.createElement("span");
      tail.className = "botdee-bubble-tail";
      tail.setAttribute("aria-hidden", "true");
      article.appendChild(tail);
    }
    if (text) {
      const body = document.createElement("div");
      body.className = "botdee-bubble-text";
      body.textContent = text;
      article.appendChild(body);
    }
    if (!isUser) appendPhotoGallery(article, media);
    if (Array.isArray(results) && results.length) {
      const list = document.createElement("ul");
      list.className = "botdee-result-links";
      results.slice(0, 6).forEach(rowResult => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = rowResult.href || "./";
        a.textContent = rowResult.label || rowResult.sourceId || "Open";
        a.className = "botdee-result-link";
        li.appendChild(a);
        if (rowResult.blurb) {
          const span = document.createElement("span");
          span.className = "botdee-result-blurb";
          span.textContent = rowResult.blurb;
          li.appendChild(span);
        }
        list.appendChild(li);
      });
      article.appendChild(list);
    }
    if (!isUser && Array.isArray(smartViews) && smartViews.length && global.FLOQRBotDeeSmartView?.mount) {
      const host = document.createElement("div");
      host.className = "botdee-sv-host";
      article.appendChild(host);
      global.FLOQRBotDeeSmartView.mount(host, smartViews, peopleSearch);
    }
    row.appendChild(article);
    log.appendChild(row);
    scrollTranscriptToLatest();
  }

  function scrollTranscriptToLatest() {
    const log = byId("botDeeTranscript");
    if (!log) return;
    const last = log.lastElementChild;
    const card = last?.querySelector(".botdee-sv-people, .botdee-sv-version, .botdee-sv-room");
    if (last && card && card.scrollHeight > log.clientHeight * 0.85) {
      const logBox = log.getBoundingClientRect();
      const lastBox = last.getBoundingClientRect();
      log.scrollTop += lastBox.top - logBox.top;
      return;
    }
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(busy) {
    const form = byId("botDeeChatForm");
    const input = byId("botDeeChatInput");
    const send = byId("botDeeChatSend");
    if (form) form.setAttribute("aria-busy", busy ? "true" : "false");
    if (input) input.disabled = !!busy;
    if (send) send.disabled = !!busy;
  }

  function setStatus(message) {
    const el = byId("botDeeChatStatus");
    if (el) el.textContent = message || "";
  }

  function pushHistory(role, text) {
    history.push({role, text});
    while (history.length > MAX_HISTORY) history.shift();
  }

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function endConversation(reason) {
    clearIdleTimer();
    if (phase === "ended") return;
    const recapTurns = history.slice();
    phase = "ended";
    // Guests stay ephemeral. Signed-in durable retrieve is server-side; keep local
    // turns so in-tab recap can skip the post-pause hello.
    if (!durableEnabled) history.length = 0;
    if (reason !== "silent") {
      const reply = idleEndedReply();
      appendBubble("bot", reply);
      if (durableEnabled) maybeRecap(recapTurns);
    }
  }

  function armIdleTimer(overrideMs) {
    clearIdleTimer();
    // fresh (welcome painted) and active both idle-out; ended stays quiet.
    if (phase === "ended") return;
    const ms = overrideMs != null
      ? Math.max(0, Number(overrideMs) || 0)
      : clampIdleSeconds(idleSeconds) * 1000;
    idleTimer = setTimeout(() => endConversation("idle"), ms);
  }

  function markActive() {
    phase = "active";
    armIdleTimer();
  }

  async function loadIdleSettings() {
    if (settingsLoaded) return idleSeconds;
    settingsLoaded = true;
    try {
      if (!global.firebase?.firestore || !global.firebase.apps?.length) return idleSeconds;
      const snap = await global.firebase.app().firestore().doc("botDeeSettings/default").get();
      if (snap.exists) {
        idleSeconds = clampIdleSeconds(snap.data()?.conversationIdleSeconds);
      }
    } catch (error) {
      console.warn("BOT DEE idle settings load failed", error?.message || error);
    }
    return idleSeconds;
  }

  function localBotReply(text, {resuming}) {
    if (isPrivilegeAskPrompt(text)) return privilegeRefuseReply();
    if (isIdentityPrompt(text)) return identityReply();
    if (isVersionPrompt(text)) return versionReply(text);
    if (isPrivacyPrompt(text)) return privacyReply();
    if (isHelpPrompt(text)) return helpReply();
    if (isAckPrompt(text)) return ackReply(text);
    if (isMoodPrompt(text)) return moodReply();
    if (isChitchatPrompt(text)) {
      // Offer-help only after an idle/farewell resume — welcome already asked once.
      if (resuming) return resumeReply();
      return stillHereReply();
    }
    return null;
  }

  async function sendMessage(raw) {
    if (restoreInFlight || byId("botDeeChatForm")?.getAttribute("aria-busy") === "true") return;
    // Keep intentional Shift+Enter newlines; collapse runs of spaces/tabs only.
    const text = String(raw || "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
      .slice(0, 2000);
    if (!text) return;
    if (global.FLOQRBotDeePersonalization?.interceptSend?.(text)) {
      const inputEl = byId("botDeeChatInput");
      if (inputEl) inputEl.value = "";
      return;
    }
    const input = byId("botDeeChatInput");
    if (input) input.value = "";

    const resuming = phase === "ended";
    if (resuming) {
      // Lease ended (pause bubble). Durable retrieve is on the server; do not wipe it.
      phase = "fresh";
      liveConversationId = mintConversationId();
    } else if (!liveConversationId) {
      liveConversationId = storedConversationId || mintConversationId();
    }

    appendBubble("user", text);
    pushHistory("user", text);
    visitLiveTurns.push({role: "user", text, conversationId: liveConversationId});
    setChatsOpen(false);
    renderChatsList();

    // Local chatbot first only when durable threads are off (old Functions / flag 0).
    // Durable path always hits executeBotSession so refresh / another phone can resume.
    if (!durableEnabled && (isPrivilegeAskPrompt(text) || isAckPrompt(text) || isChitchatPrompt(text) || isIdentityPrompt(text) || isVersionPrompt(text) || isHelpPrompt(text) || isPrivacyPrompt(text) || isRoomSmartViewPrompt(text))) {
      const roomSession = !isVersionPrompt(text) && !isHelpPrompt(text) && !isPrivacyPrompt(text)
        ? buildLocalRoomSession(text)
        : null;
      const reply = roomSession
        ? roomReplyText(roomSession)
        : localBotReply(text, {resuming});
      const versionViews = isVersionPrompt(text) ? ensureVersionSmartViews(text, []) : [];
      const roomViews = roomSession ? ensureRoomSmartViews(text, roomSession.smartViews || []) : [];
      appendBubble("bot", reply, [], [], versionViews.concat(roomViews));
      pushHistory("model", reply);
      visitLiveTurns.push({role: "model", text: reply, conversationId: liveConversationId});
      setStatus("");
      if (isFarewellPrompt(text)) {
        endConversation("silent");
      } else {
        markActive();
      }
      input?.focus();
      return;
    }

    // Substantive restart after idle (memory-only): one short welcome-back, then answer.
    if (!durableEnabled && resuming && !(isAckPrompt(text) || isChitchatPrompt(text) || isIdentityPrompt(text) || isVersionPrompt(text) || isHelpPrompt(text))) {
      const hello = resumeReply();
      appendBubble("bot", hello);
      pushHistory("model", hello);
    }

    markActive();
    setBusy(true);
    setStatus(t("botdee.chatThinking", "BOT DEE is thinking…"));

    const fn = callable("executeBotSession");
    if (!fn) {
      setBusy(false);
      setStatus("");
      const fallback = t("botdee.chatOffline", "Chat is unavailable right now. Try again in a moment.");
      appendBubble("bot", fallback);
      return;
    }

    try {
      const payload = {
        message: text,
        history: history.slice(0, -1).map(row => ({role: row.role, text: row.text})),
        threadId: threadId || undefined,
        conversationId: liveConversationId || undefined,
        uiLanguage: currentUiLanguage(),
        roomSmartViewDeclined: loadRoomDeclined()
      };
      const data = (await fn(payload))?.data || {};
      applyHasUsed(data, 1);
      const media = mergeMedia(data.media, harvestMediaFromText(data.reply));
      const peopleSearch = data.peopleSearch || null;
      const roomView = Array.isArray(data.smartViews)
        ? data.smartViews.find(row => row && row.kind === "botDeeRoom")
        : null;
      const views = ensureVersionSmartViews(text, ensureRoomSmartViews(text, data.smartViews));
      const versionCardOnly = isVersionSmartViewAlias(text)
        && views.some(row => row && row.kind === "botDeeVersion");
      const reply = versionCardOnly
        ? ""
        : peopleSearch?.replyKey
          ? t(peopleSearch.replyKey, displayReply(data.reply))
          : (data.replyKey || roomView?.replyKey)
            ? t(data.replyKey || roomView.replyKey, displayReply(data.reply))
            : displayReply(data.reply);
      appendBubble("bot", reply, localizeResults(data.results), media, views, peopleSearch);
      pushHistory("model", reply);
      if (reply) visitLiveTurns.push({role: "model", text: reply, conversationId: liveConversationId});
      if (data.conversationId && /^cv_[0-9a-f]{32}$/.test(String(data.conversationId))) {
        liveConversationId = String(data.conversationId);
        visitLiveTurns.forEach(row => {
          if (row && !row.conversationId) row.conversationId = liveConversationId;
        });
      }
      if (data.threadId) threadId = String(data.threadId);
      if (data.durable === true) durableEnabled = true;
      if (data.durable === false) durableEnabled = false;
      if (data.conversationIdleSeconds) idleSeconds = clampIdleSeconds(data.conversationIdleSeconds);
      setStatus("");
      if (isFarewellPrompt(text)) {
        endConversation("silent");
      } else {
        armIdleTimer();
      }
    } catch (error) {
      const code = String(error?.code || "");
      let msg = t("botdee.chatError", "BOT DEE could not answer. Try again in a moment.");
      if (code.includes("unauthenticated")) {
        msg = t("botdee.chatSignIn", "Sign in to chat with BOT DEE.");
      } else if (code.includes("failed-precondition")) {
        msg = t("botdee.chatFeatureOff", "BOT DEE is not available on your account yet.");
      }
      appendBubble("bot", msg);
      setStatus("");
      console.warn("BOT DEE chat failed", code || error?.message || error);
    } finally {
      setBusy(false);
      input?.focus();
    }
  }

  function bindForm() {
    const form = byId("botDeeChatForm");
    const input = byId("botDeeChatInput");
    form?.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage(input?.value);
    });
    // Enter = Send · Shift+Enter = new line (chat UX, not a multiline notepad).
    input?.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.keyCode !== 13) return;
      if (event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (form?.getAttribute("aria-busy") === "true") return;
      form?.requestSubmit ? form.requestSubmit() : form?.dispatchEvent(new Event("submit", {cancelable: true, bubbles: true}));
    });
    input?.addEventListener("focus", () => setChatsOpen(false));
  }

  function welcome() {
    const log = byId("botDeeTranscript");
    if (!log || log.childElementCount) return;
    appendBubble("bot", t(
      "botdee.chatWelcome",
      "Hi, I am BOT DEE. How can I help you?"
    ));
    phase = "fresh";
    // Arm idle so an abandoned welcome also ends cleanly.
    armIdleTimer();
    global.FLOQRBotDeePersonalization?.maybeStartSetup?.();
  }

  function isProductCatalogGreeting(raw) {
    const text = String(raw || "").trim();
    if (!text) return false;
    const shout = /shout\s*out/i.test(text);
    const vip = /\bvip\b/i.test(text);
    const floq = /floq\s*cast/i.test(text);
    if (!(shout || vip || floq)) return false;
    if (/i['’]?m bot dee(?:,|\s)/i.test(text) || /your floqr assistant/i.test(text)) return true;
    return shout && vip && floq
      && text.length <= 280
      && /(?:what can i help|how can i help|i can help|let me know)/i.test(text);
  }

  function displayReply(raw) {
    const text = String(raw || "").trim();
    // Server stores English botdee.chatEmpty; live + restore both localize it.
    if (
      !text
      || /could not find a clear match/i.test(text)
      || text === "No answer yet — try asking another way."
      || text === "No answer yet — try quick intent search."
    ) {
      return t("botdee.chatEmpty", "No answer yet — try asking another way.");
    }
    if (text === PRIVILEGE_REFUSE_EN || PRIVILEGE_LEAK_RE.test(text)) {
      return privilegeRefuseReply();
    }
    if (isProductCatalogGreeting(text)) {
      const fromPrefs = global.FLOQRBotDeePersonalization?.greetingFor?.();
      if (fromPrefs) return fromPrefs;
      return t("botdee.chatHello", "Good afternoon. How can I help?");
    }
    return scrubGatedBrands(stripBackendLinks(text));
  }

  function modelBubbleText(role, raw, media) {
    const rawText = String(raw || "").trim();
    if (role === "model" && !rawText && !media.length) return "";
    if (role === "model" && !rawText) return "";
    return role === "model" ? displayReply(raw) : rawText;
  }

  function cloneTurns(turns) {
    return (Array.isArray(turns) ? turns : [])
      .map(row => {
        const item = {
          role: row?.role === "model" || row?.role === "assistant" ? "model" : "user",
          text: String(row?.text || "").trim(),
          media: Array.isArray(row?.media) ? row.media : undefined,
          seq: row?.seq,
          atMs: row?.atMs
        };
        const conversationId = clipConversationId(row?.conversationId);
        if (conversationId) item.conversationId = conversationId;
        return item;
      })
      .filter(row => row.text || (row.media && row.media.length));
  }

  function firstUserLine(turns) {
    const row = cloneTurns(turns).find(item => item.role === "user" && item.text);
    return row ? row.text.replace(/\s+/g, " ").slice(0, 72) : "";
  }

  function clipConversationId(raw) {
    const id = String(raw || "").trim();
    return /^cv_[0-9a-f]{32}$/.test(id) ? id : "";
  }

  function mintConversationId() {
    try {
      const bytes = new Uint8Array(16);
      (global.crypto || crypto).getRandomValues(bytes);
      return `cv_${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
    } catch (_) {
      const hex = `${Date.now().toString(16).padStart(12, "0")}${Math.random().toString(16).slice(2)}0000000000000000`;
      return `cv_${hex.slice(0, 32)}`;
    }
  }

  function fnv1a(str, seed) {
    let h = (Number(seed) >>> 0) || 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  function conversationIdFromFirstUser(text) {
    const line = String(text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
    if (!line) return "";
    const a = fnv1a(line, 2166136261).toString(16).padStart(8, "0");
    const b = fnv1a(line, 0x811c9dc5 ^ 0x01000193).toString(16).padStart(8, "0");
    return `c_${a}${b}`;
  }

  function firstUserText(turns) {
    const row = cloneTurns(turns).find(item => item.role === "user" && item.text);
    return row ? String(row.text).trim() : "";
  }

  function conversationIdFromTurns(turns) {
    const list = cloneTurns(turns);
    for (let i = 0; i < list.length; i += 1) {
      const id = clipConversationId(list[i].conversationId);
      if (id) return id;
    }
    return "";
  }

  function clipChatTitle(raw) {
    return String(raw || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CHAT_TITLE_MAX);
  }

  function titleForChat(chatId, fallback) {
    const row = chatTitles && chatTitles[chatId];
    const stored = clipChatTitle(typeof row === "string" ? row : row?.title);
    return stored || fallback || "";
  }

  function applyChatTitles(raw) {
    const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    chatTitles = {};
    Object.keys(src).forEach(id => {
      const title = clipChatTitle(typeof src[id] === "string" ? src[id] : src[id]?.title);
      if (!title) return;
      if (/^cv_[0-9a-f]{32}$/.test(id) || /^c_[0-9a-f]{16}$/.test(id)) {
        chatTitles[id] = {title, updatedAtMs: Number(src[id]?.updatedAtMs) || 0};
      }
    });
    const currentId = storedConversationId || conversationIdFromTurns(storedTurns);
    const archivedId = archiveConversationId || conversationIdFromTurns(storedArchiveTurns);
    const liveId = liveConversationId || conversationIdFromTurns(visitLiveTurns) || currentId;
    const slotIds = {live: liveId, current: currentId, archive: archivedId};
    ["live", "current", "archive"].forEach(slot => {
      const title = clipChatTitle(typeof src[slot] === "string" ? src[slot] : src[slot]?.title);
      const id = slotIds[slot];
      if (!title || !id || chatTitles[id]) return;
      chatTitles[id] = {title, updatedAtMs: Number(src[slot]?.updatedAtMs) || 0};
    });
    const hashTargets = [
      [currentId, storedTurns],
      [archivedId, storedArchiveTurns],
      [liveId, visitLiveTurns]
    ];
    hashTargets.forEach(([id, turns]) => {
      if (!id || chatTitles[id]) return;
      const hashed = conversationIdFromFirstUser(firstUserText(turns));
      const row = hashed && src[hashed];
      const title = clipChatTitle(typeof row === "string" ? row : row?.title);
      if (!title) return;
      chatTitles[id] = {title, updatedAtMs: Number(row?.updatedAtMs) || 0};
    });
  }

  function formatChatWhen(ms) {
    const at = Number(ms) || 0;
    if (!at) return "";
    try {
      return new Date(at).toLocaleString(undefined, {month: "short", day: "numeric"});
    } catch (_) {
      return "";
    }
  }

  function hydrateHistory(turns) {
    history.length = 0;
    cloneTurns(turns).forEach(row => {
      const text = row.role === "model" ? displayReply(row.text) : row.text;
      if (text) pushHistory(row.role, text);
    });
  }

  function restoreTurns(turns) {
    const log = byId("botDeeTranscript");
    if (log) log.innerHTML = "";
    history.length = 0;
    cloneTurns(turns).forEach(row => {
      const media = row.role === "model" ? mergeMedia(row.media, harvestMediaFromText(row.text)) : [];
      const text = modelBubbleText(row.role, row.text, media);
      if (!text && !media.length) return;
      appendBubble(row.role === "user" ? "user" : "bot", text, null, media);
      if (text) pushHistory(row.role, text);
    });
  }

  function recapStatusLine(turns) {
    const prefs = global.FLOQRBotDeePersonalization;
    if (!prefs || prefs.get?.().remindWhereLeftOff === 0) return "";
    return String(prefs.recapFromTurns?.(turns) || "").trim();
  }

  function landCollapsed(data) {
    const turns = cloneTurns(data.turns);
    const archive = cloneTurns(data.archiveTurns);
    storedTurns = turns.length ? turns : archive;
    storedArchiveTurns = archive;
    storedLastMessageAtMs = Number(data.lastMessageAtMs) || 0;
    storedConversationId = clipConversationId(data.currentConversationId) || conversationIdFromTurns(storedTurns);
    archiveConversationId = clipConversationId(data.archiveConversationId) || conversationIdFromTurns(storedArchiveTurns);
    if (storedConversationId) {
      storedTurns.forEach(row => {
        if (row && !row.conversationId) row.conversationId = storedConversationId;
      });
    }
    if (archiveConversationId) {
      storedArchiveTurns.forEach(row => {
        if (row && !row.conversationId) row.conversationId = archiveConversationId;
      });
    }
    applyChatTitles(data.chatTitles);
    const recall = storedTurns.length ? storedTurns : archive;
    // Visual collapse only — keep last turns in client history so Send still
    // ships BOT DEE context. Server retrieve is unchanged.
    if (recall.length) hydrateHistory(recall);
    welcome();
    if (data.status === "idle_ended" && recall.length) {
      phase = "ended";
      clearIdleTimer();
      const recap = recapStatusLine(recall);
      const paused = t("botdee.sessionPaused", "Session paused. Continue chatting.");
      setStatus(recap ? `${paused} ${recap}` : paused);
    } else {
      phase = "fresh";
      setStatus("");
      armIdleTimer(data.remainingMs);
    }
    renderChatsList();
  }

  function pinComposerToViewport() {
    const apply = () => {
      try {
        const vv = global.visualViewport;
        if (!vv) {
          document.documentElement.style.setProperty("--botdee-kb", "0px");
          return;
        }
        const occluded = Math.max(0, (global.innerHeight || 0) - vv.height - (vv.offsetTop || 0));
        document.documentElement.style.setProperty("--botdee-kb", `${Math.round(occluded)}px`);
      } catch (_) {}
    };
    apply();
    try {
      global.visualViewport?.addEventListener("resize", apply);
      global.visualViewport?.addEventListener("scroll", apply);
    } catch (_) {}
    global.addEventListener("resize", apply);
  }

  function storedChatCount() {
    let n = storedTurns.length ? 1 : 0;
    if (storedArchiveTurns.length && firstUserLine(storedArchiveTurns) !== firstUserLine(storedTurns)) n += 1;
    if (visitLiveTurns.length) n += 1;
    return n;
  }

  function updateChatsBadge() {
    const badge = byId("botDeeChatsBadge");
    const count = storedChatCount();
    if (!badge) return;
    if (!count) {
      badge.hidden = true;
      badge.textContent = "";
      return;
    }
    badge.hidden = false;
    badge.textContent = count > 9 ? "9+" : String(count);
  }

  function setChatsOpen(open) {
    chatsOpen = !!open;
    const toggle = byId("botDeeChatsToggle");
    const panel = byId("botDeeChatsPanel");
    const backdrop = byId("botDeeChatsBackdrop");
    const mark = toggle?.querySelector(".botdee-chats-toggle-mark");
    if (toggle) {
      toggle.setAttribute("aria-expanded", chatsOpen ? "true" : "false");
      if (mark) mark.textContent = chatsOpen ? "−" : "+";
    }
    if (panel) panel.hidden = !chatsOpen;
    if (backdrop) backdrop.hidden = !chatsOpen;
    if (chatsOpen) renderChatsList();
  }

  function startNewChat() {
    const log = byId("botDeeTranscript");
    if (log) log.innerHTML = "";
    setChatsOpen(false);
    phase = "fresh";
    setStatus("");
    liveConversationId = mintConversationId();
    welcome();
    byId("botDeeChatInput")?.focus();
  }

  function resumeSlice(turns) {
    const rows = cloneTurns(turns);
    if (!rows.length) return;
    liveConversationId = conversationIdFromTurns(rows) || liveConversationId;
    restoreTurns(rows);
    setChatsOpen(false);
    phase = "active";
    setStatus("");
    armIdleTimer();
    const log = byId("botDeeTranscript");
    if (log) log.scrollTop = log.scrollHeight;
    byId("botDeeChatInput")?.focus();
  }

  function renderChatsList() {
    const list = byId("botDeeChatsList");
    const hint = byId("botDeeChatsHint");
    if (!list) return;
    list.innerHTML = "";
    updateChatsBadge();
    if (!signedInForChats) {
      if (hint) hint.hidden = true;
      const empty = document.createElement("p");
      empty.className = "botdee-chats-empty";
      empty.textContent = t("botdee.chatsEmptyGuest", "Chats save when you are signed in.");
      list.appendChild(empty);
      return;
    }
    if (hint) hint.hidden = false;
    const addRow = (label, meta, onClick, primary, chatId) => {
      const row = document.createElement("div");
      row.className = "botdee-chats-item";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = primary ? "botdee-chats-row botdee-chats-row-primary" : "botdee-chats-row";
      btn.textContent = label;
      if (meta) {
        const span = document.createElement("span");
        span.className = "botdee-chats-row-meta";
        span.textContent = meta;
        btn.appendChild(span);
      }
      btn.addEventListener("click", event => {
        if (renameClickShouldSwallow(event, btn)) return;
        onClick(event);
      });
      row.appendChild(btn);
      if (chatId) {
        const renameLabel = titleForChat(chatId, meta || label);
        bindChatLongPress(btn, chatId, renameLabel);
        const rename = document.createElement("button");
        rename.type = "button";
        rename.className = "botdee-chats-rename";
        rename.setAttribute("aria-label", t("botdee.chatsRenameAria", "Rename chat"));
        rename.title = t("botdee.chatsRename", "Rename");
        rename.textContent = "⋯";
        rename.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          openRenameDialog(chatId, renameLabel);
        });
        row.appendChild(rename);
      }
      list.appendChild(row);
    };
    addRow(t("botdee.chatsNew", "New chat"), "", startNewChat, true);
    if (visitLiveTurns.length) {
      const snippet = firstUserLine(visitLiveTurns);
      const liveId = conversationIdFromTurns(visitLiveTurns) || liveConversationId;
      addRow(
        t("botdee.chatsResume", "This session"),
        titleForChat(liveId, snippet),
        () => resumeSlice(visitLiveTurns),
        false,
        liveId
      );
    }
    const earlier = [];
    if (storedTurns.length) {
      earlier.push({
        slice: storedTurns,
        chatId: conversationIdFromTurns(storedTurns) || storedConversationId
      });
    }
    if (storedArchiveTurns.length && firstUserLine(storedArchiveTurns) !== firstUserLine(storedTurns)) {
      earlier.push({
        slice: storedArchiveTurns,
        chatId: conversationIdFromTurns(storedArchiveTurns) || archiveConversationId
      });
    }
    earlier.forEach((row, index) => {
      const when = formatChatWhen(storedLastMessageAtMs);
      const line = firstUserLine(row.slice);
      const fallback = [when, line].filter(Boolean).join(" · ") || t("botdee.chatsPanelTitle", "Chats");
      const title = titleForChat(row.chatId, fallback);
      addRow(title, index === 0 && storedTurns.length && title === fallback ? "" : (title !== fallback ? fallback : ""), () => resumeSlice(row.slice), false, row.chatId);
    });
  }

  function armRenameClickSwallow(pointerId, btn) {
    disarmRenameClickSwallow();
    swallowRename = {pointerId, btn};
    swallowRenameTimer = global.setTimeout(() => {
      swallowRenameTimer = 0;
      swallowRename = null;
    }, SWALLOW_CLICK_MS);
  }

  function disarmRenameClickSwallow() {
    if (swallowRenameTimer) {
      global.clearTimeout(swallowRenameTimer);
      swallowRenameTimer = 0;
    }
    swallowRename = null;
  }

  function leftoverRenameClick(event, btn) {
    if (!swallowRename) return false;
    const armedBtn = swallowRename.btn;
    const target = event?.target;
    if (btn && armedBtn === btn) return true;
    if (armedBtn && target && (target === armedBtn || armedBtn.contains(target))) return true;
    const samePointer = swallowRename.pointerId != null && event?.pointerId === swallowRename.pointerId;
    const dialog = byId("botDeeRenameDialog");
    const chatsBackdrop = byId("botDeeChatsBackdrop");
    if (target !== dialog && target !== chatsBackdrop) return false;
    return samePointer || event?.pointerId == null;
  }

  function renameClickShouldSwallow(event, btn) {
    if (!leftoverRenameClick(event, btn)) return false;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    disarmRenameClickSwallow();
    return true;
  }

  function bindChatLongPress(btn, chatId, label) {
    let timer = 0;
    const start = event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      clearTimeout(timer);
      const pointerId = event.pointerId;
      timer = global.setTimeout(() => {
        timer = 0;
        armRenameClickSwallow(pointerId, btn);
        openRenameDialog(chatId, label);
      }, LONG_PRESS_MS);
    };
    const cancelTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", cancelTimer);
    btn.addEventListener("pointercancel", () => {
      cancelTimer();
      disarmRenameClickSwallow();
    });
    btn.addEventListener("pointerleave", cancelTimer);
    btn.addEventListener("contextmenu", event => {
      event.preventDefault();
      event.stopPropagation();
      cancelTimer();
      disarmRenameClickSwallow();
      openRenameDialog(chatId, label);
    });
  }

  function setRenameOpen(open) {
    const dialog = byId("botDeeRenameDialog");
    if (!dialog) return;
    dialog.hidden = !open;
    dialog.setAttribute("aria-hidden", open ? "false" : "true");
    if (!open) {
      renameTarget = null;
      disarmRenameClickSwallow();
    }
  }

  function openRenameDialog(chatId, currentLabel) {
    renameTarget = {chatId, currentLabel};
    const input = byId("botDeeRenameInput");
    const status = byId("botDeeRenameStatus");
    if (status) status.textContent = "";
    if (input) {
      input.value = titleForChat(chatId, clipChatTitle(currentLabel));
    }
    setRenameOpen(true);
    global.setTimeout(() => {
      input?.focus();
      input?.select();
    }, 30);
  }

  async function saveRename() {
    const status = byId("botDeeRenameStatus");
    const input = byId("botDeeRenameInput");
    const title = clipChatTitle(input?.value);
    if (!renameTarget?.chatId) {
      setRenameOpen(false);
      return;
    }
    if (!title) {
      if (status) status.textContent = t("botdee.chatsRenameError", "Could not save that title. Try again.");
      input?.focus();
      return;
    }
    const chatId = renameTarget.chatId;
    const fn = callable("renameBotDeeChat");
    if (!fn) {
      if (status) status.textContent = t("botdee.chatsRenameError", "Could not save that title. Try again.");
      return;
    }
    try {
      const data = (await fn({chatId, title, conversationId: chatId}))?.data || {};
      if (data.chatTitles) applyChatTitles(data.chatTitles);
      else {
        chatTitles[chatId] = {title: clipChatTitle(data.title) || title, updatedAtMs: Date.now()};
      }
      setRenameOpen(false);
      renderChatsList();
    } catch (error) {
      console.warn("BOT DEE rename failed", error?.message || error);
      if (status) status.textContent = t("botdee.chatsRenameError", "Could not save that title. Try again.");
    }
  }

  function bindRenameDialog() {
    if (renameDialogBound) return;
    renameDialogBound = true;
    byId("botDeeRenameSave")?.addEventListener("click", () => saveRename());
    byId("botDeeRenameCancel")?.addEventListener("click", () => setRenameOpen(false));
    byId("botDeeRenameDialog")?.addEventListener("click", event => {
      if (renameClickShouldSwallow(event)) return;
      if (event.target === byId("botDeeRenameDialog")) setRenameOpen(false);
    });
    byId("botDeeRenameInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveRename();
      }
    });
  }

  function bindChatsUi() {
    if (chatsUiBound) return;
    chatsUiBound = true;
    const toggle = byId("botDeeChatsToggle");
    const backdrop = byId("botDeeChatsBackdrop");
    toggle?.addEventListener("click", () => setChatsOpen(!chatsOpen));
    backdrop?.addEventListener("click", event => {
      if (renameClickShouldSwallow(event)) return;
      setChatsOpen(false);
    });
    document.addEventListener("click", event => {
      renameClickShouldSwallow(event);
    }, true);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (!byId("botDeeRenameDialog")?.hidden) {
          event.preventDefault();
          setRenameOpen(false);
          return;
        }
        if (chatsOpen) {
          event.preventDefault();
          setChatsOpen(false);
        }
      }
    });
    bindRenameDialog();
    renderChatsList();
  }

  async function restoreOrWelcome() {
    if (restoreStarted) return;
    restoreStarted = true;
    restoreInFlight = true;
    setBusy(true);
    setStatus(t("botdee.chatRestoring", "Restoring your conversation…"));
    try {
      await loadIdleSettings();
      const user = await waitForAuthUser(8000);
      signedInForChats = !!user;
      const getThread = callable("getBotDeeThread");
      if (user && getThread) {
        try {
          const data = (await getThread({}))?.data || {};
          durableEnabled = data.durable === true;
          if (data.idleSeconds) idleSeconds = clampIdleSeconds(data.idleSeconds);
          if (data.threadId) threadId = String(data.threadId);
          applyChatTitles(data.chatTitles);
          applyHasUsed(data);
          global.FLOQRBotDeePersonalization?.applyFromThread?.(data, true);
          if (durableEnabled && (
            (Array.isArray(data.turns) && data.turns.length)
            || (data.status === "idle_ended" && Array.isArray(data.archiveTurns) && data.archiveTurns.length)
          )) {
            landCollapsed(data);
            return;
          }
        } catch (error) {
          console.warn("BOT DEE restore failed", error?.message || error);
          durableEnabled = false;
        }
      } else {
        global.FLOQRBotDeePersonalization?.applyFromThread?.({}, false);
      }
      setStatus("");
      welcome();
      renderChatsList();
      if (phase === "fresh" || phase === "active") armIdleTimer();
    } finally {
      restoreInFlight = false;
      setBusy(false);
      byId("botDeeChatInput")?.focus();
    }
  }

  function maybeRecap(turns) {
    const recap = recapStatusLine(turns);
    if (!recap) return;
    appendBubble("bot", `${t("botdee.recapLead", "Last time:")} ${recap}`);
  }

  function bind(opts = {}) {
    bindForm();
    bindChatsUi();
    pinComposerToViewport();
    global.FLOQRBotDeePersonalization?.bind?.();
    const q = opts.q || new URL(location.href).searchParams.get("q");
    if (q) {
      const input = byId("botDeeChatInput");
      if (input) input.value = String(q).slice(0, 200);
    }
    restoreOrWelcome();
    return {sendMessage, endConversation, getPhase: () => phase, getIdleSeconds: () => idleSeconds};
  }

  function applyHasUsed(data, fallback) {
    const row = data && typeof data === "object" ? data : {};
    let flag = 0;
    if (row.hasUsedBotDee === 1 || row.hasUsedBotDee === "1") flag = 1;
    else if (Array.isArray(row.turns) && row.turns.length) flag = 1;
    else if (Array.isArray(row.archiveTurns) && row.archiveTurns.length) flag = 1;
    else if (fallback === 1) flag = 1;
    global.FLOQRBotDeeAccess?.applyUsageFlag?.(flag);
    global.FLOQRBotDeeUpgradeUi?.applyUsageFlag?.(flag);
    return flag;
  }

  global.FLOQRBotDeeChat = {
    bind,
    sendMessage,
    openPhotoViewer,
    closePhotoViewer,
    DEFAULT_IDLE_SECONDS,
    clampIdleSeconds
  };
})(typeof window !== "undefined" ? window : global);
