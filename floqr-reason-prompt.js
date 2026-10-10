/* FLOQR reason prompt — asks for the audit reason AFTER the user presses Save.
   Modal dialog on desktop / tablet, bottom sheet on phones (same component inside a hybrid WebView).
   FLOQRReasonPrompt.ask({summary, minLength}) → Promise<string|null> (null = cancelled).
   Design notes: .cursor/rules/reason-prompt-on-save.mdc */
(function (root) {
  "use strict";
  if (root.FLOQRReasonPrompt) return;

  const DEFAULT_MIN = 8;
  const DEFAULT_MAX = 500;
  const FOCUSABLE = "button:not([disabled]), textarea, input, select, a[href], [tabindex]:not([tabindex='-1'])";
  let openPrompt = null;
  let idSeq = 0;

  function t(key, fallback, vars = {}) {
    let text = fallback;
    try {
      const value = root.FLOQRI18n?.t?.(key, vars);
      if (value && value !== key) return value;
    } catch (_) {}
    Object.keys(vars).forEach(name => { text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(vars[name])); });
    return text;
  }

  function trimmedLength(value) {
    return String(value || "").trim().length;
  }

  /** Keeps the bottom sheet above an on-screen keyboard (visualViewport shrinks; layout viewport does not). */
  function trackKeyboard(sheet) {
    const vv = root.visualViewport;
    if (!vv) return () => {};
    const update = () => {
      const covered = Math.max(0, root.innerHeight - vv.height - vv.offsetTop);
      sheet.style.setProperty("--floqr-reason-kb", `${Math.round(covered)}px`);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }

  function build({title, help, summary, placeholder, saveLabel, cancelLabel, minLength, maxLength, initial}) {
    const id = `floqrReason${++idSeq}`;
    const overlay = document.createElement("div");
    overlay.className = "floqr-reason-overlay";
    overlay.innerHTML = `
      <div class="floqr-reason-sheet" role="dialog" aria-modal="true" aria-labelledby="${id}Title" aria-describedby="${id}Help">
        <div class="floqr-reason-grip" aria-hidden="true"></div>
        <h2 class="floqr-reason-title" id="${id}Title"></h2>
        <div class="floqr-reason-summary" hidden>
          <span class="floqr-reason-summary-label"></span>
          <p class="floqr-reason-summary-text"></p>
        </div>
        <label class="floqr-reason-label" for="${id}Input"></label>
        <p class="floqr-reason-help" id="${id}Help"></p>
        <textarea class="floqr-reason-input" id="${id}Input" rows="3" autocomplete="off" enterkeyhint="done"></textarea>
        <p class="floqr-reason-counter" aria-live="polite"></p>
        <div class="floqr-reason-actions">
          <button type="button" class="ghost floqr-reason-cancel"></button>
          <button type="button" class="primary floqr-reason-save" disabled></button>
        </div>
      </div>`;
    const q = selector => overlay.querySelector(selector);
    q(".floqr-reason-title").textContent = title;
    q(".floqr-reason-label").textContent = t("reason.label", "Reason");
    q(".floqr-reason-help").textContent = help;
    if (summary) {
      q(".floqr-reason-summary").hidden = false;
      q(".floqr-reason-summary-label").textContent = t("reason.changing", "What is changing");
      q(".floqr-reason-summary-text").textContent = summary;
    }
    const input = q(".floqr-reason-input");
    input.maxLength = maxLength;
    input.placeholder = placeholder;
    input.value = initial;
    q(".floqr-reason-cancel").textContent = cancelLabel;
    q(".floqr-reason-save").textContent = saveLabel;
    return overlay;
  }

  /**
   * @param {object} [options]
   * @param {string} [options.summary]   short "what is changing" line, e.g. "BartR: Enable Feature 0 → 1"
   * @param {number} [options.minLength] trimmed minimum (default 8)
   * @returns {Promise<string|null>}     trimmed reason, or null when cancelled
   */
  function ask(options = {}) {
    if (openPrompt) openPrompt.cancel();
    const minLength = Math.max(0, Number(options.minLength ?? DEFAULT_MIN));
    const maxLength = Math.max(minLength || 1, Number(options.maxLength ?? DEFAULT_MAX));
    const overlay = build({
      title: options.title || t("reason.title", "Reason for this change"),
      help: options.help || t("reason.help", "Why are you making this change? Saved in the audit trail. At least {min} characters.", {min: minLength}),
      summary: String(options.summary || "").trim(),
      placeholder: options.placeholder || t("reason.placeholder", "Type your reason"),
      saveLabel: options.saveLabel || t("reason.save", "Save"),
      cancelLabel: options.cancelLabel || t("reason.cancel", "Cancel"),
      minLength,
      maxLength,
      initial: String(options.initial || "")
    });
    const sheet = overlay.querySelector(".floqr-reason-sheet");
    const input = overlay.querySelector(".floqr-reason-input");
    const counter = overlay.querySelector(".floqr-reason-counter");
    const save = overlay.querySelector(".floqr-reason-save");
    const cancel = overlay.querySelector(".floqr-reason-cancel");
    const returnFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    return new Promise(resolve => {
      let untrackKeyboard = () => {};
      const valid = () => trimmedLength(input.value) >= minLength;
      const refresh = () => {
        const count = trimmedLength(input.value);
        save.disabled = !valid();
        counter.textContent = t("reason.counter", "{count} / {min} characters minimum", {count, min: minLength});
        counter.classList.toggle("is-ok", valid());
      };
      const close = value => {
        if (openPrompt?.overlay !== overlay) return;
        openPrompt = null;
        untrackKeyboard();
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        document.body.style.overflow = previousOverflow;
        if (returnFocus && typeof returnFocus.focus === "function" && returnFocus.isConnected) returnFocus.focus();
        resolve(value);
      };
      const submit = () => { if (valid()) close(String(input.value).trim()); };
      const onKey = event => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(null);
        } else if (event.key === "Enter" && event.target === input && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          submit();
        } else if (event.key === "Tab") {
          const items = [...sheet.querySelectorAll(FOCUSABLE)].filter(el => !el.hidden && el.offsetParent !== null);
          if (!items.length) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
          }
        }
      };
      input.addEventListener("input", refresh);
      save.addEventListener("click", submit);
      cancel.addEventListener("click", () => close(null));
      overlay.addEventListener("mousedown", event => { if (event.target === overlay) close(null); });
      document.addEventListener("keydown", onKey, true);
      openPrompt = {overlay, cancel: () => close(null)};
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";
      untrackKeyboard = trackKeyboard(sheet);
      refresh();
      requestAnimationFrame(() => input.focus());
    });
  }

  root.FLOQRReasonPrompt = {ask, DEFAULT_MIN};
})(window);
