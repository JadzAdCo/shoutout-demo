/* BOT DEE chat client — wires floqai.html transcript to executeBotSession.
   Intent search stays available as a collapsible fast path / fallback.
   Greetings are answered locally (chatbot) so a stale Functions deploy cannot
   turn "hello" into a contextual-search miss. */
(function (global) {
  "use strict";

  const MAX_HISTORY = 12;
  const history = [];

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

  function chitchatReply() {
    return t(
      "floqai.chatHello",
      "Hey — BOT DEE here. What do you want to do in FLOQR? ShoutOut, VIP table, floqCast, scheduling, or something else — just say it in plain words."
    );
  }

  function ackReply() {
    return t(
      "floqai.chatAck",
      "Cool. Want to keep going? ShoutOut, VIP table, floqCast, scheduling — or ask me anything in plain words."
    );
  }

  function identityReply() {
    return t(
      "floqai.chatIdentity",
      "I'm BOT DEE — say it like \"bot\" + \"dee\" (the letter D). I'm FLOQR's in-app helper. What do you want to do — ShoutOut, VIP table, floqCast, scheduling, or something else?"
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

  async function sendMessage(raw) {
    const text = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 2000);
    if (!text) return;
    const input = byId("botDeeChatInput");
    if (input) input.value = "";
    appendBubble("user", text);
    pushHistory("user", text);

    // Chatbot first: never let hello / "cool" / name questions fall through to a search miss.
    if (isAckPrompt(text) || isChitchatPrompt(text) || isIdentityPrompt(text)) {
      const reply = isIdentityPrompt(text)
        ? identityReply()
        : (isAckPrompt(text) ? ackReply() : chitchatReply());
      appendBubble("bot", reply);
      pushHistory("model", reply);
      setStatus("");
      input?.focus();
      return;
    }

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
  }

  function bind(opts = {}) {
    bindForm();
    welcome();
    const q = opts.q || new URL(location.href).searchParams.get("q");
    if (q) {
      const input = byId("botDeeChatInput");
      if (input) input.value = String(q).slice(0, 200);
    }
    byId("botDeeChatInput")?.focus();
    return {sendMessage, openIntentFallback};
  }

  global.FLOQRBotDeeChat = {bind, sendMessage, openIntentFallback};
})(typeof window !== "undefined" ? window : global);
