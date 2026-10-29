/* BOT DEE chat client — wires floqai.html transcript to executeBotSession.
   Intent search stays available as a collapsible fast path / fallback.
   Greetings / acks are answered locally (chatbot) so a stale Functions deploy cannot
   turn "hello"/"cool" into a contextual-search miss.
   Offer-help CTA only at conversation start and after an idle-ended resume.
   Idle pause (default 60s, Master Admin botDeeSettings/default) ends the chat. */
(function (global) {
  "use strict";

  const MAX_HISTORY = 12;
  const DEFAULT_IDLE_SECONDS = 60;
  const MIN_IDLE_SECONDS = 15;
  const MAX_IDLE_SECONDS = 600;
  const history = [];

  /** fresh = welcome only · active = talking · ended = idle/farewell closed */
  let phase = "fresh";
  let idleSeconds = DEFAULT_IDLE_SECONDS;
  let idleTimer = null;
  let settingsLoaded = false;

  const byId = id => document.getElementById(id);
  const t = (key, fallback) => {
    const value = global.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

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

  function isChitchatPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 100) return false;
    if (isAckPrompt(q)) return true;
    if (new RegExp(`^(?:hey|hi|hello|howdy|yo|sup|hiya|hola)${CHITCHAT_TAIL}$`).test(q)) return true;
    if (new RegExp(`^(?:hey|hi|hello|howdy) how are you${CHITCHAT_TAIL}$`).test(q)) return true;
    if (new RegExp(`^(?:good morning|good afternoon|good evening|good night|how are you|what s up|whats up|what up)${CHITCHAT_TAIL}$`).test(q)) return true;
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

  function clampIdleSeconds(raw) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return DEFAULT_IDLE_SECONDS;
    return Math.min(MAX_IDLE_SECONDS, Math.max(MIN_IDLE_SECONDS, n));
  }

  /** Offer-help — start / idle-resume greetings only. */
  function chitchatReply() {
    return t(
      "floqai.chatHello",
      "Hey — BOT DEE here. What do you want to do in FLOQR? ShoutOut, VIP table, floqCast, scheduling, or something else — just say it in plain words."
    );
  }

  /** Soft mid-chat ack — no product pitch. */
  function ackReply(raw) {
    const q = normalizeChat(raw);
    if (isFarewellPrompt(q)) {
      return t("floqai.chatBye", "Take care — say hi when you want to pick up again.");
    }
    if (/^(?:thanks|thank you|thx|ty)\b/.test(q)) {
      return t("floqai.chatThanks", "You're welcome.");
    }
    return t("floqai.chatAck", "Cool.");
  }

  function identityReply() {
    return t(
      "floqai.chatIdentity",
      "I'm BOT DEE — say it like \"bot\" + \"dee\" (the letter D). I'm FLOQR's in-app helper."
    );
  }

  function stillHereReply() {
    return t("floqai.chatStillHere", "Hey — still here.");
  }

  function idleEndedReply() {
    return t(
      "floqai.chatIdleEnded",
      "I'll pause here for now. Say hi when you want to pick up again."
    );
  }

  function resumeReply() {
    return t(
      "floqai.chatResume",
      "Welcome back. What do you want to do in FLOQR? ShoutOut, VIP table, floqCast, scheduling, or something else — just say it in plain words."
    );
  }

  function callable() {
    try {
      if (!global.firebase?.functions || !global.firebase.apps?.length) return null;
      return global.firebase.app().functions("us-central1").httpsCallable("executeBotSession");
    } catch (_) {
      return null;
    }
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

  function armIdleTimer() {
    clearIdleTimer();
    // fresh (welcome painted) and active both idle-out; ended stays quiet.
    if (phase === "ended") return;
    const ms = clampIdleSeconds(idleSeconds) * 1000;
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
    if (isAckPrompt(text)) return ackReply(text);
    if (isChitchatPrompt(text)) {
      // Offer-help only after an idle/farewell resume — welcome already asked once.
      if (resuming) return resumeReply();
      return stillHereReply();
    }
    return null;
  }

  async function sendMessage(raw) {
    const text = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 2000);
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

    // Chatbot first: never let hello / "cool" / name questions fall through to a search miss.
    if (isAckPrompt(text) || isChitchatPrompt(text) || isIdentityPrompt(text)) {
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

    // Substantive restart after idle: one short welcome-back, then answer their ask.
    if (resuming) {
      const hello = resumeReply();
      appendBubble("bot", hello);
      pushHistory("model", hello);
    }

    markActive();
    setBusy(true);
    setStatus(t("floqai.chatThinking", "BOT DEE is thinking…"));

    const fn = callable();
    if (!fn) {
      setBusy(false);
      setStatus("");
      const fallback = t("floqai.chatOffline", "Chat is unavailable right now. Use quick intent search below.");
      appendBubble("bot", fallback);
      openIntentFallback();
      return;
    }

    try {
      const payload = {
        message: text,
        history: history.slice(0, -1).map(row => ({role: row.role, text: row.text}))
      };
      const data = (await fn(payload))?.data || {};
      let reply = String(data.reply || "").trim();
      // Stale Functions may still search-miss a greeting-shaped reply — never show that.
      if (!reply || /could not find a clear match/i.test(reply)) {
        reply = t("floqai.chatEmpty", "No answer yet — try quick intent search.");
      }
      appendBubble("bot", reply, data.results);
      pushHistory("model", reply);
      setStatus("");
      armIdleTimer();
    } catch (error) {
      const code = String(error?.code || "");
      let msg = t("floqai.chatError", "BOT DEE could not answer. Try quick intent search.");
      if (code.includes("unauthenticated")) {
        msg = t("floqai.chatSignIn", "Sign in to chat with BOT DEE.");
      } else if (code.includes("failed-precondition")) {
        msg = t("floqai.chatFeatureOff", "BOT DEE is not available on your account yet.");
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
    form?.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage(byId("botDeeChatInput")?.value);
    });
  }

  function welcome() {
    const log = byId("botDeeTranscript");
    if (!log || log.childElementCount) return;
    appendBubble("bot", t(
      "floqai.chatWelcome",
      "Hi, I am BOT DEE. How can I help you?"
    ));
    phase = "fresh";
    // Arm idle so an abandoned welcome also ends cleanly.
    armIdleTimer();
  }

  function bind(opts = {}) {
    bindForm();
    loadIdleSettings().finally(() => {
      welcome();
      // Re-arm with loaded idle seconds if welcome already painted.
      if (phase === "fresh" || phase === "active") armIdleTimer();
    });
    const q = opts.q || new URL(location.href).searchParams.get("q");
    if (q) {
      const input = byId("botDeeChatInput");
      if (input) input.value = String(q).slice(0, 200);
    }
    byId("botDeeChatInput")?.focus();
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
