/* BOT DEE chat client — wires botdee.html transcript to executeBotSession.
   Intent search stays available as a collapsible fast path / fallback.
   Durable threads (getBotDeeThread): signed-in refresh / second device resume.
   Greetings / acks are local-only when durable is off so a stale Functions deploy cannot
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
  let durableEnabled = false;
  let threadId = "";
  let restoreStarted = false;

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

  function clampIdleSeconds(raw) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return DEFAULT_IDLE_SECONDS;
    return Math.min(MAX_IDLE_SECONDS, Math.max(MIN_IDLE_SECONDS, n));
  }

  /** Offer-help — start / idle-resume greetings only. */
  function chitchatReply() {
    return t(
      "botdee.chatHello",
      "Hey — BOT DEE here. What do you want to do in FLOQR? ShoutOut, VIP table, floqCast, scheduling, or something else — just say it in plain words."
    );
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
    return t(
      "botdee.chatResume",
      "Welcome back. What do you want to do in FLOQR? ShoutOut, VIP table, floqCast, scheduling, or something else — just say it in plain words."
    );
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
    if (!durableEnabled && (isAckPrompt(text) || isChitchatPrompt(text) || isIdentityPrompt(text))) {
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
    if (!durableEnabled && resuming && !(isAckPrompt(text) || isChitchatPrompt(text) || isIdentityPrompt(text))) {
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
        threadId: threadId || undefined
      };
      const data = (await fn(payload))?.data || {};
      const reply = displayReply(data.reply);
      appendBubble("bot", reply, data.results);
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
    return text;
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
    setStatus(t("botdee.chatRestoring", "Restoring your conversation…"));
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
  }

  function bind(opts = {}) {
    bindForm();
    restoreOrWelcome();
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
