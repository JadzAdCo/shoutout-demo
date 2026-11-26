/* FLOQR help title/body locales (ru, nl, fr, de, es, it, pt, el, pl, ar) for patron / venueAdmin / serviceMember. */
(function (global) {
  "use strict";

  const VERSION = "s3.3.087";
  const packs = {};

  function mergePacks(extra) {
    Object.keys(extra || {}).forEach(lang => {
      packs[lang] = Object.assign(packs[lang] || {}, extra[lang] || {});
    });
  }

  function localize(entry, lang) {
    if (!entry || typeof entry !== "object") return entry;
    const code = String(lang || "").trim().toLowerCase().split(/[-_]/)[0];
    if (!code || code === "en") return entry;
    const pack = packs[code];
    if (!pack) return entry;
    const id = String(entry.id || "").trim();
    const row = id && pack[id] ? pack[id] : null;
    if (!row) return entry;
    const next = Object.assign({}, entry);
    if (row.title) next.title = row.title;
    if (row.body) next.body = row.body;
    if (Array.isArray(row.searchPhrases) && row.searchPhrases.length) {
      next.searchPhrases = Array.from(new Set([...(entry.searchPhrases || []), ...row.searchPhrases]));
    }
    return next;
  }

  function resolveLang() {
    try {
      if (global.FLOQRI18n && typeof global.FLOQRI18n.getLanguage === "function") {
        return global.FLOQRI18n.getLanguage() || "en";
      }
      if (global.FLOQRI18n && global.FLOQRI18n.current) return global.FLOQRI18n.current;
      return localStorage.getItem("floqr.uiLanguage") || "en";
    } catch (_) {
      return "en";
    }
  }

  function applyHelpDom(root) {
    const doc = root && typeof root.querySelectorAll === "function" ? root : global.document;
    if (!doc || typeof doc.querySelectorAll !== "function") return;
    const lang = resolveLang();
    const nodes = [
      ...doc.querySelectorAll("details.help-popout"),
      ...doc.querySelectorAll(".floqr-help-popout")
    ];
    nodes.forEach(node => {
      const id = String(
        node.dataset?.helpId
        || node.getAttribute?.("data-help-id")
        || node.dataset?.botdeeHelpId || node.dataset?.floqaiHelpId
        || node.getAttribute?.("data-botdee-help-id")
        || node.getAttribute?.("data-floqai-help-id")
        || ""
      ).trim();
      if (!id) return;
      let entry = null;
      try {
        const list = typeof global.FLOQRHelpRepository?.entries === "function"
          ? global.FLOQRHelpRepository.entries()
          : [];
        entry = (list || []).find(e => e && e.id === id) || null;
      } catch (_) {}
      if (!entry) {
        const summary = node.querySelector?.("summary");
        const bodyEl = node.querySelector?.(".help-popout-body, .botdee-help-body, div:not(summary)");
        entry = {
          id,
          title: String(summary?.getAttribute("aria-label") || "").replace(/^Help:\s*/i, "") || id,
          body: String(bodyEl?.textContent || "")
        };
      }
      const localized = localize(entry, lang);
      const packCode = String(lang || "").split(/[-_]/)[0];
      if (!packs[packCode] || !packs[packCode][id]) return;
      const title = localized.title || entry.title;
      const body = localized.body || entry.body;
      const summary = node.querySelector?.("summary");
      if (summary) summary.setAttribute("aria-label", title ? `Help: ${title}` : "Help");
      const bodyEl = node.querySelector?.(".help-popout-body, .botdee-help-body");
      if (bodyEl && body != null && body !== "") {
        if (!bodyEl.querySelector?.("a,button,ul,ol")) bodyEl.textContent = body;
      }
    });
  }

  global.FLOQRI18nHelp = {
    VERSION,
    packs,
    localize,
    applyHelpDom,
    mergePacks
  };
})(typeof window !== "undefined" ? window : globalThis);
