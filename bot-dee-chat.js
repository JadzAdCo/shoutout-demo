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

  const CHITCHAT_TAIL = "(?:\\s+(?:bot\\s*dee|floqai|floq\\s*ai|there|again|friend|everyone|yall|y all))?";

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
    return "s3.3.008";
  }

  function isVersionPrompt(raw) {
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
    const localized = t("botdee.chatHello", "");
    // Keep locale; scrub brands the viewer cannot access (do not force English).
    if (localized && localized !== "botdee.chatHello") {
      return scrubGatedBrands(localized);
    }
    return `Hey — BOT DEE here. What do you want to do in FLOQR? ${accessibleProductPitch()}`;
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

  function versionReply() {
    const label = packageLabel();
    const template = t("botdee.chatVersion", "I'm BOT DEE on FLOQR package {version}.");
    return String(template).replace(/\{version\}/g, label);
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
    const localized = t("botdee.chatResume", "");
    if (localized && localized !== "botdee.chatResume") {
      return scrubGatedBrands(localized);
    }
    return `Welcome back. What do you want to do in FLOQR? ${accessibleProductPitch()}`;
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

  function appendBubble(role, text, results) {
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
    const body = document.createElement("div");
    body.className = "botdee-bubble-text";
    body.textContent = text;
    article.appendChild(body);
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
    row.appendChild(article);
    log.appendChild(row);
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
    phase = "ended";
    history.length = 0;
    if (reason !== "silent") {
      const reply = idleEndedReply();
      appendBubble("bot", reply);
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
    if (isIdentityPrompt(text)) return identityReply();
    if (isVersionPrompt(text)) return versionReply();
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
    const input = byId("botDeeChatInput");
    if (input) input.value = "";

    const resuming = phase === "ended";
    if (resuming) {
      // New conversation after idle / farewell — history already cleared.
      phase = "fresh";
    }

    appendBubble("user", text);
    pushHistory("user", text);

    // Local chatbot first only when durable threads are off (old Functions / flag 0).
    // Durable path always hits executeBotSession so refresh / another phone can resume.
    if (!durableEnabled && (isAckPrompt(text) || isChitchatPrompt(text) || isIdentityPrompt(text) || isVersionPrompt(text))) {
      const reply = localBotReply(text, {resuming});
      appendBubble("bot", reply);
      pushHistory("model", reply);
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
    if (!durableEnabled && resuming && !(isAckPrompt(text) || isChitchatPrompt(text) || isIdentityPrompt(text) || isVersionPrompt(text))) {
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
      const fallback = t("botdee.chatOffline", "Chat is unavailable right now. Use quick intent search below.");
      appendBubble("bot", fallback);
      openIntentFallback();
      return;
    }

    try {
      const payload = {
        message: text,
        history: history.slice(0, -1).map(row => ({role: row.role, text: row.text})),
        threadId: threadId || undefined,
        uiLanguage: currentUiLanguage()
      };
      const data = (await fn(payload))?.data || {};
      const reply = displayReply(data.reply);
      appendBubble("bot", reply, localizeResults(data.results));
      pushHistory("model", reply);
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
      let msg = t("botdee.chatError", "BOT DEE could not answer. Try quick intent search.");
      if (code.includes("unauthenticated")) {
        msg = t("botdee.chatSignIn", "Sign in to chat with BOT DEE.");
      } else if (code.includes("failed-precondition")) {
        msg = t("botdee.chatFeatureOff", "BOT DEE is not available on your account yet.");
      }
      appendBubble("bot", msg);
      setStatus("");
      openIntentFallback();
      console.warn("BOT DEE chat failed", code || error?.message || error);
    } finally {
      setBusy(false);
      input?.focus();
    }
  }

  function openIntentFallback() {
    const details = byId("botDeeIntentFallback");
    if (details) details.open = true;
    byId("intentSearchInput")?.focus();
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
  }

  function displayReply(raw) {
    const text = String(raw || "").trim();
    // Server stores English botdee.chatEmpty; live + restore both localize it.
    if (
      !text
      || /could not find a clear match/i.test(text)
      || text === "No answer yet — try quick intent search."
    ) {
      return t("botdee.chatEmpty", "No answer yet — try quick intent search.");
    }
    return scrubGatedBrands(text);
  }

  function restoreTurns(turns) {
    const log = byId("botDeeTranscript");
    if (log) log.innerHTML = "";
    history.length = 0;
    (Array.isArray(turns) ? turns : []).forEach(row => {
      const role = row?.role === "model" || row?.role === "assistant" ? "model" : "user";
      const text = role === "model" ? displayReply(row?.text) : String(row?.text || "").trim();
      if (!text) return;
      appendBubble(role === "user" ? "user" : "bot", text);
      pushHistory(role, text);
    });
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
      const getThread = callable("getBotDeeThread");
      if (user && getThread) {
        try {
          const data = (await getThread({}))?.data || {};
          durableEnabled = data.durable === true;
          if (data.idleSeconds) idleSeconds = clampIdleSeconds(data.idleSeconds);
          if (data.threadId) threadId = String(data.threadId);
          if (durableEnabled && data.status === "active" && Array.isArray(data.turns) && data.turns.length) {
            restoreTurns(data.turns);
            phase = "active";
            setStatus("");
            armIdleTimer(data.remainingMs);
            return;
          }
        } catch (error) {
          console.warn("BOT DEE restore failed", error?.message || error);
          durableEnabled = false;
        }
      }
      setStatus("");
      welcome();
      if (phase === "fresh" || phase === "active") armIdleTimer();
    } finally {
      restoreInFlight = false;
      setBusy(false);
      byId("botDeeChatInput")?.focus();
    }
  }

  function bind(opts = {}) {
    bindForm();
    const q = opts.q || new URL(location.href).searchParams.get("q");
    if (q) {
      const input = byId("botDeeChatInput");
      if (input) input.value = String(q).slice(0, 200);
    }
    restoreOrWelcome();
    return {sendMessage, openIntentFallback, endConversation, getPhase: () => phase, getIdleSeconds: () => idleSeconds};
  }

  global.FLOQRBotDeeChat = {
    bind,
    sendMessage,
    openIntentFallback,
    DEFAULT_IDLE_SECONDS,
    clampIdleSeconds
  };
})(typeof window !== "undefined" ? window : global);
