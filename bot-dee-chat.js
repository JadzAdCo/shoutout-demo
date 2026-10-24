/* BOT DEE chat client — wires floqai.html transcript to executeBotSession.
   Intent search stays available as a collapsible fast path / fallback. */
(function (global) {
  "use strict";

  const MAX_HISTORY = 12;
  const history = [];

  const byId = id => document.getElementById(id);
  const t = (key, fallback) => {
    const value = global.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

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
    setBusy(true);
    setStatus(t("floqai.chatThinking", "FloqAi is thinking…"));

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
      const reply = String(data.reply || "").trim() || t("floqai.chatEmpty", "No answer yet — try quick intent search.");
      appendBubble("bot", reply, data.results);
      pushHistory("model", reply);
      setStatus("");
    } catch (error) {
      const code = String(error?.code || "");
      let msg = t("floqai.chatError", "FloqAi could not answer. Try quick intent search.");
      if (code.includes("unauthenticated")) {
        msg = t("floqai.chatSignIn", "Sign in to chat with FloqAi.");
      } else if (code.includes("failed-precondition")) {
        msg = t("floqai.chatFeatureOff", "FloqAi is not available on your account yet.");
      }
      appendBubble("bot", msg);
      setStatus("");
      openIntentFallback();
      console.warn("FloqAi chat failed", code || error?.message || error);
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
      "Hi — I am FloqAi. Ask in plain words what you want to do in FLOQR. Quick intent search stays available below."
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
