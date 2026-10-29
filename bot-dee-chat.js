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

  /** Mirror of functions/bot-dee-core.js isChitchatPrompt / chitchatReply. */
  function normalizeChat(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9@\s._/-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const CHITCHAT_TAIL = "(?:\\s+(?:bot\\s*dee|floqai|floq\\s*ai|there|again|friend|everyone|yall|y all))?";

  function isChitchatPrompt(raw) {
    const q = normalizeChat(raw);
    if (!q || q.length > 100) return false;
    if (new RegExp(`^(?:hey|hi|hello|howdy|yo|sup|hiya|hola)${CHITCHAT_TAIL}$`).test(q)) return true;
    if (new RegExp(`^(?:hey|hi|hello|howdy) how are you${CHITCHAT_TAIL}$`).test(q)) return true;
    if (new RegExp(`^(?:good morning|good afternoon|good evening|good night|how are you|what s up|whats up|what up)${CHITCHAT_TAIL}$`).test(q)) return true;
    if (new RegExp(`^(?:thanks|thank you|thx|ty|ok|okay|cool|nice|great|bye|goodbye|see ya|see you)${CHITCHAT_TAIL}$`).test(q)) return true;
    return false;
  }

  function chitchatReply() {
    return t(
      "floqai.chatHello",
      "Hey — BOT DEE here. What do you want to do in FLOQR? ShoutOut, VIP table, floqCast, scheduling, or something else — just say it in plain words."
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

  function appendBubble(role, text, results) {
    const log = byId("botDeeTranscript");
    if (!log) return;
    const article = document.createElement("article");
    article.className = `botdee-bubble botdee-bubble-${role === "user" ? "user" : "bot"}`;
    article.setAttribute("data-role", role === "user" ? "user" : "bot");
    const body = document.createElement("div");
    body.className = "botdee-bubble-text";
    body.textContent = text;
    article.appendChild(body);
    if (Array.isArray(results) && results.length) {
      const list = document.createElement("ul");
      list.className = "botdee-result-links";
      results.slice(0, 6).forEach(row => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = row.href || "./";
        a.textContent = row.label || row.sourceId || "Open";
        a.className = "botdee-result-link";
        li.appendChild(a);
        if (row.blurb) {
          const span = document.createElement("span");
          span.className = "botdee-result-blurb";
          span.textContent = row.blurb;
          li.appendChild(span);
        }
        list.appendChild(li);
      });
      article.appendChild(list);
    }
    log.appendChild(article);
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

    // Chatbot first: never let "hello" fall through to a search-miss reply.
    if (isChitchatPrompt(text)) {
      const reply = chitchatReply();
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
