/* FLOQR save-button busy guard.
   Grays Save as soon as it is pressed; switches to "Command received…" when a
   callable / Firestore write starts; restores on settle, cancel, or idle.
   Opt out with data-floqr-save="skip". */
(function (root) {
  "use strict";
  if (root.FLOQRSaveBusy) return;

  const SAVE_ATTRS = ["data-feature-save", "data-beta-features-save", "data-discovery-action"];
  const SAVE_WORDS = /^(save|saved|saving|speichern|enregistrer|guardar|salva|salvar|сохранить|αποθήκευση|zapisz|opslaan|حفظ)\b/i;
  const IDLE_MS = 1600;
  const PROMPT_IDLE_MS = 120000;
  const patched = { callable: false, firestore: false, reason: false };
  let active = [];
  let pendingCommands = 0;
  let idleTimer = 0;

  function t(key, fallback) {
    try {
      const value = root.FLOQRI18n?.t?.(key);
      if (value && value !== key) return value;
    } catch (_) {}
    return fallback;
  }

  function isElement(node) {
    return !!(node && node.nodeType === 1);
  }

  function isSaveButton(el) {
    if (!isElement(el) || el.dataset.floqrSave === "skip") return false;
    const tag = String(el.tagName || "").toLowerCase();
    if (tag !== "button" && !(tag === "input" && /submit|button/i.test(el.type || ""))) return false;
    if (el.closest("body.display-page, body.display2-page, #displayRoot, #display2Root")) return false;
    if (SAVE_ATTRS.some(attr => el.hasAttribute(attr))) {
      if (el.getAttribute("data-discovery-action") && el.getAttribute("data-discovery-action") !== "save") return false;
      return true;
    }
    const i18n = String(el.getAttribute("data-i18n") || "");
    if (i18n === "app.save" || i18n === "reason.save") return true;
    if (/\bfloqr-reason-save\b/.test(el.className || "")) return true;
    const id = String(el.id || "");
    if (/(^|-)save(d|btn|button)?$/i.test(id) || /Save(Btn|Button)?$/.test(id)) return true;
    const label = String(el.textContent || el.value || "").replace(/\s+/g, " ").trim();
    return SAVE_WORDS.test(label);
  }

  function snapshot(el) {
    return {
      el,
      text: el.textContent,
      value: el.value,
      html: el.innerHTML,
      disabled: !!el.disabled,
      busy: el.getAttribute("aria-busy")
    };
  }

  function paint(el, label, received) {
    el.classList.add("is-busy");
    el.setAttribute("aria-busy", "true");
    el.setAttribute("aria-disabled", "true");
    if (received) el.classList.add("is-save-received");
    if ("value" in el && el.tagName === "INPUT") el.value = label;
    else el.textContent = label;
    root.setTimeout(() => {
      if (el.classList.contains("is-busy")) el.disabled = true;
    }, 0);
  }

  function restoreOne(item) {
    const el = item.el;
    if (!el) return;
    el.disabled = item.disabled;
    el.classList.remove("is-busy", "is-save-received");
    if (item.busy == null) el.removeAttribute("aria-busy");
    else el.setAttribute("aria-busy", item.busy);
    el.removeAttribute("aria-disabled");
    delete el.dataset.floqrSaveLock;
    if ("value" in el && el.tagName === "INPUT") el.value = item.value;
    else if (item.text != null) el.textContent = item.text;
  }

  function clearIdle() {
    if (idleTimer) {
      root.clearTimeout(idleTimer);
      idleTimer = 0;
    }
  }

  function end() {
    clearIdle();
    pendingCommands = 0;
    active.forEach(restoreOne);
    active = [];
  }

  function scheduleIdle(ms) {
    clearIdle();
    idleTimer = root.setTimeout(() => {
      idleTimer = 0;
      if (!pendingCommands) end();
    }, ms);
  }

  function begin(el) {
    if (!isElement(el)) return;
    if (active.some(item => item.el === el)) return;
    active.push(snapshot(el));
    paint(el, t("app.saveBusy", "Saving…"), false);
    scheduleIdle(IDLE_MS);
  }

  function markReceived() {
    if (!active.length) return;
    clearIdle();
    const label = t("app.saveReceived", "Command received…");
    active.forEach(item => paint(item.el, label, true));
  }

  function noteCommand() {
    if (!active.length) return false;
    pendingCommands += 1;
    markReceived();
    return true;
  }

  function settleCommand() {
    if (!pendingCommands) return;
    pendingCommands -= 1;
    if (pendingCommands <= 0) end();
  }

  function wrapThen(result, counted) {
    if (!counted) return result;
    const done = () => settleCommand();
    if (result && typeof result.then === "function") {
      return result.then(value => { done(); return value; }, error => { done(); throw error; });
    }
    done();
    return result;
  }

  function patchCallable() {
    if (patched.callable) return;
    const fns = root.firebase?.functions;
    const proto = fns?.Functions?.prototype;
    if (!proto || typeof proto.httpsCallable !== "function") return;
    patched.callable = true;
    const original = proto.httpsCallable;
    proto.httpsCallable = function httpsCallableBusy(name, options) {
      const callable = original.call(this, name, options);
      return function busyCallable(data) {
        const counted = noteCommand();
        try {
          return wrapThen(callable(data), counted);
        } catch (error) {
          if (counted) settleCommand();
          throw error;
        }
      };
    };
  }

  function wrapWrite(proto, method) {
    if (!proto || typeof proto[method] !== "function" || proto[method].__floqrSaveBusy) return;
    const original = proto[method];
    function busyWrite(...args) {
      const counted = noteCommand();
      try {
        return wrapThen(original.apply(this, args), counted);
      } catch (error) {
        if (counted) settleCommand();
        throw error;
      }
    }
    busyWrite.__floqrSaveBusy = true;
    proto[method] = busyWrite;
  }

  function patchFirestore() {
    if (patched.firestore) return;
    const fs = root.firebase?.firestore;
    if (!fs) return;
    patched.firestore = true;
    wrapWrite(fs.DocumentReference?.prototype, "set");
    wrapWrite(fs.DocumentReference?.prototype, "update");
    wrapWrite(fs.DocumentReference?.prototype, "delete");
    wrapWrite(fs.CollectionReference?.prototype, "add");
  }

  function patchReasonPrompt() {
    if (patched.reason) return;
    const api = root.FLOQRReasonPrompt;
    if (!api || typeof api.ask !== "function") return;
    patched.reason = true;
    const original = api.ask.bind(api);
    api.ask = function askBusy(options) {
      if (active.length) scheduleIdle(PROMPT_IDLE_MS);
      return original(options).then(reason => {
        if (reason == null) end();
        else scheduleIdle(IDLE_MS);
        return reason;
      });
    };
  }

  function patchAll() {
    try { patchCallable(); } catch (_) {}
    try { patchFirestore(); } catch (_) {}
    try { patchReasonPrompt(); } catch (_) {}
  }

  function onClick(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const fromPath = path.find(node => isSaveButton(node));
    const target = fromPath || event.target?.closest?.("button, input[type=submit], input[type=button]");
    if (!isSaveButton(target)) return;
    if (target.disabled && !target.classList.contains("is-busy")) return;
    if (target.classList.contains("is-busy") || target.dataset.floqrSaveLock === "1") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    target.dataset.floqrSaveLock = "1";
    begin(target);
  }

  function install() {
    if (root.document?.documentElement?.dataset.floqrSaveBusy === "1") return;
    if (root.document?.documentElement) root.document.documentElement.dataset.floqrSaveBusy = "1";
    root.document.addEventListener("click", onClick, true);
    patchAll();
    let tries = 0;
    const timer = root.setInterval(() => {
      patchAll();
      tries += 1;
      if ((patched.callable && patched.firestore) || tries > 40) root.clearInterval(timer);
    }, 250);
  }

  root.FLOQRSaveBusy = {
    begin,
    end,
    markReceived,
    isSaveButton,
    install
  };

  if (root.document?.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})(typeof window !== "undefined" ? window : globalThis);
