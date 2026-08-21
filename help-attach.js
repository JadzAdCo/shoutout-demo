/* FLOQR standard "?" help attach — ONLY API for help popout placement + verbiage. */
(function (global) {
  "use strict";

  const STYLE_ID = "floqr-help-attach-css";

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.help-label{
  display:inline-flex !important;
  align-items:center;
  flex-wrap:nowrap;
  gap:6px 8px;
  width:fit-content !important;
  max-width:100%;
  min-width:0;
  box-sizing:border-box;
  justify-content:flex-start !important;
}
.help-label-text{
  flex:0 1 auto;
  width:auto;
  max-width:100%;
  min-width:0;
  line-height:1.35;
}
.help-label > .help-popout,
.help-label > .floqr-help-popout{
  flex:0 0 auto !important;
  margin:0 !important;
  margin-left:0 !important;
  align-self:center;
}
h1.help-label,h2.help-label,h3.help-label,label.help-label,span.help-label{
  width:fit-content !important;
  max-width:100%;
}
.section-title-row,
.template-heading-row,
.section-heading-row{
  justify-content:flex-start !important;
  align-items:center;
  gap:8px 12px;
  flex-wrap:wrap;
}
.section-title-inline{
  display:inline-flex !important;
  align-items:center;
  gap:8px;
  width:fit-content !important;
  max-width:100%;
}
.section-title-row > .help-label,
.section-title-row > .section-title-inline,
.template-heading-row > .help-label,
.section-heading-row > .help-label{
  flex:0 1 auto !important;
  width:fit-content !important;
  margin-right:auto;
}
@media (max-width:640px){
  .help-label{flex-wrap:wrap}
  .help-popout .help-popout-body,
  .help-popout > div:not(summary){
    width:min(320px, calc(100vw - 24px)) !important;
    max-width:calc(100vw - 24px) !important;
    z-index:100002;
  }
  html.floqr-mobile-browser .help-popout,
  html.floqr-mobile-browser .floqr-help-popout,
  html.floqr-mobile-browser .help-popout summary{
    width:auto !important;
    min-width:22px !important;
    max-width:22px !important;
    flex:0 0 auto !important;
  }
}
`;
    document.head.appendChild(style);
  }

  function textOf(value) {
    return String(value == null ? "" : value).trim();
  }

  function resolveHelpCopy({ id, title, body, bodyHtml }) {
    const baseTitle = textOf(title);
    const baseBody = textOf(body);
    const entryId = textOf(id);
    if (!entryId) {
      return { title: baseTitle, body: baseBody, bodyHtml: bodyHtml || "" };
    }
    let entry = { id: entryId, title: baseTitle || entryId, body: baseBody };
    try {
      if (global.FLOQRHelpRepository?.localizeEntry) {
        entry = global.FLOQRHelpRepository.localizeEntry(entry) || entry;
      } else if (global.FLOQRI18nHelp?.localize) {
        const lang =
          global.FLOQRI18n?.getLanguage?.()
          || global.FLOQRI18n?.current
          || (function () { try { return localStorage.getItem("floqr.uiLanguage") || "en"; } catch (_) { return "en"; } })();
        entry = global.FLOQRI18nHelp.localize(entry, lang) || entry;
      }
    } catch (_error) {
      /* localization optional */
    }
    return {
      title: textOf(entry.title) || baseTitle || "Help",
      body: bodyHtml ? baseBody : (textOf(entry.body) || baseBody),
      bodyHtml: bodyHtml || ""
    };
  }

  function ensureLabelShell(target) {
    if (!target) return null;
    let host = target;
    if (!host.classList.contains("help-label")) {
      host.classList.add("help-label");
    }
    let textEl = host.querySelector(":scope > .help-label-text");
    if (!textEl) {
      textEl = document.createElement("span");
      textEl.className = "help-label-text";
      const keep = [];
      [...host.childNodes].forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches?.("details.help-popout, .help-popout, .floqr-help-popout, .floqr-help-panel")) {
          return;
        }
        keep.push(node);
      });
      keep.forEach(node => textEl.appendChild(node));
      host.insertBefore(textEl, host.firstChild);
    }
    return host;
  }

  function buildDetails({ title, bodyHtml, bodyText }) {
    const details = document.createElement("details");
    details.className = "help-popout inline-help-popout";
    details.dataset.floqrHelpAttached = "1";
    const summary = document.createElement("summary");
    summary.setAttribute("aria-label", title ? `Help: ${title}` : "Help");
    summary.textContent = "?";
    const body = document.createElement("div");
    body.className = "help-popout-body";
    if (bodyHtml) body.innerHTML = bodyHtml;
    else body.textContent = bodyText || "";
    details.append(summary, body);
    return details;
  }

  /**
   * Attach a "?" immediately beside correlated verbiage.
   * @param {object} opts
   * @param {Element} opts.target - heading/label/span that holds the verbiage
   * @param {string} [opts.title] - help title (repository + aria)
   * @param {string} [opts.body] - plain-text body
   * @param {string} [opts.bodyHtml] - HTML body (preferred when links needed)
   * @param {string[]} [opts.searchPhrases]
   * @param {Array} [opts.links]
   * @param {string} [opts.id]
   * @param {boolean} [opts.replace=true] - replace existing attached ?
   * @returns {{host: Element, details: HTMLDetailsElement}|null}
   */
  function attach(opts = {}) {
    ensureCss();
    const target = opts.target;
    if (!target || !target.nodeType) return null;
    const host = ensureLabelShell(target);
    if (!host) return null;

    const existing = host.querySelector(":scope > details.help-popout[data-floqr-help-attached='1']");
    if (existing && opts.replace !== false) existing.remove();
    else if (existing) return { host, details: existing };

    const helpId = textOf(opts.id);
    const resolved = resolveHelpCopy({
      id: helpId,
      title: textOf(opts.title) || textOf(host.querySelector(".help-label-text")?.textContent) || "Help",
      body: opts.body || "",
      bodyHtml: opts.bodyHtml || ""
    });
    const title = resolved.title;
    const details = buildDetails({
      title,
      bodyHtml: resolved.bodyHtml || "",
      bodyText: resolved.body || ""
    });
    if (helpId) details.dataset.helpId = helpId;
    host.appendChild(details);

    try {
      global.FLOQRHelpRepository?.registerFromHelpNode?.(details, {
        id: helpId || "",
        title,
        body: resolved.body || details.querySelector(".help-popout-body")?.textContent || "",
        searchPhrases: opts.searchPhrases || [title],
        links: opts.links || [],
        source: opts.source || "help-attach",
        page: location.pathname || ""
      });
      if (helpId || opts.searchPhrases || opts.links) {
        global.FLOQRHelpRepository?.register?.({
          id: helpId || `help-attach-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80),
          title,
          body: resolved.body || details.querySelector(".help-popout-body")?.textContent || "",
          searchPhrases: opts.searchPhrases || [title],
          links: opts.links || [],
          source: opts.source || "help-attach",
          page: location.pathname || ""
        });
      }
    } catch (_error) {
      /* repository optional at attach time */
    }

    return { host, details };
  }

  /** Move a lone "?" that is a flex/grid sibling of a heading into that heading (stops far-right drift on phones). */
  function glueOrphanPopouts(root = document) {
    ensureCss();
    const list = [];
    if (root.matches?.("details.help-popout, button.floqr-help-popout")) list.push(root);
    if (root.querySelectorAll) list.push(...root.querySelectorAll("details.help-popout, button.floqr-help-popout"));
    list.forEach(pop => {
      if (!pop.isConnected) return;
      if (pop.closest(".label-inline-row")) return;
      if (pop.parentElement?.classList.contains("help-label")) return;
      const parent = pop.parentElement;
      if (!parent) return;
      let target = pop.previousElementSibling;
      if (target && /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(target.tagName)) target = null;
      if (target && !/^(H1|H2|H3|H4|LABEL|LEGEND|STRONG)$/.test(target.tagName) && !target.classList.contains("eyebrow") && !target.classList.contains("help-label")) {
        target = null;
      }
      if (!target && parent.matches(".section-title-row, .section-title-inline, .template-heading-row, .section-heading-row")) {
        target = parent.querySelector("h1,h2,h3,h4,label,legend");
      }
      if (!target || target === pop || target.contains(pop)) return;
      const host = ensureLabelShell(target);
      if (!host) return;
      const existing = host.querySelector(":scope > details.help-popout, :scope > .floqr-help-popout");
      if (existing && existing !== pop) {
        pop.remove();
        return;
      }
      pop.classList.add("inline-help-popout");
      pop.dataset.floqrHelpAttached = "1";
      host.appendChild(pop);
    });
  }

  function bindPanelPosition() {
    if (document.documentElement.dataset.floqrHelpPosBound === "1") return;
    document.documentElement.dataset.floqrHelpPosBound = "1";
    document.addEventListener("toggle", event => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("help-popout") || !details.open) return;
      const body = details.querySelector(":scope > .help-popout-body, :scope > div:not(summary)");
      if (!body) return;
      body.style.transform = "";
      const rect = body.getBoundingClientRect();
      const pad = 12;
      let shift = 0;
      if (rect.right > window.innerWidth - pad) shift = window.innerWidth - pad - rect.right;
      if (rect.left + shift < pad) shift = pad - rect.left;
      if (shift) body.style.transform = `translateX(${Math.round(shift)}px)`;
    }, true);
  }

  /** Attach "?" to the nearest preceding heading inside a card/section when converting helper copy. */
  function attachBesideHeading(fromNode, opts = {}) {
    if (!fromNode) return null;
    const container = fromNode.closest(".card, section, header, .admin-panel-section, .topbar, label") || fromNode.parentElement;
    if (!container) return attach({ ...opts, target: fromNode });
    const headings = [...container.querySelectorAll("h1,h2,h3,legend,.eyebrow")];
    let heading = null;
    for (const candidate of headings) {
      if (candidate.contains(fromNode)) continue;
      const pos = candidate.compareDocumentPosition(fromNode);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) heading = candidate;
    }
    heading = heading || headings[0];
    if (!heading) return null;
    if (heading.querySelector(":scope > details.help-popout, .help-popout, .floqr-help-popout")) {
      return null;
    }
    return attach({
      ...opts,
      target: heading,
      title: opts.title || textOf(heading.textContent).replace(/\?$/g, "").trim() || "Help"
    });
  }

  /** Declarative: elements with data-floqr-help-body (and optional data-floqr-help-title). */
  function mountAll(root = document) {
    ensureCss();
    bindPanelPosition();
    glueOrphanPopouts(root);
    root.querySelectorAll?.("[data-floqr-help-body]").forEach(node => {
      if (node.dataset.floqrHelpMounted === "1") return;
      node.dataset.floqrHelpMounted = "1";
      attach({
        target: node,
        title: node.getAttribute("data-floqr-help-title") || "",
        bodyHtml: node.getAttribute("data-floqr-help-html") === "1"
          ? node.getAttribute("data-floqr-help-body")
          : "",
        body: node.getAttribute("data-floqr-help-html") === "1"
          ? ""
          : node.getAttribute("data-floqr-help-body") || "",
        id: node.getAttribute("data-floqr-help-id") || "",
        searchPhrases: String(node.getAttribute("data-floqr-help-search") || "")
          .split("|")
          .map(s => s.trim())
          .filter(Boolean)
      });
    });
    try { global.FLOQRI18nHelp?.applyHelpDom?.(root); } catch (_error) {}
  }

  function bindLanguageRefresh() {
    if (document.documentElement.dataset.floqrHelpI18nBound === "1") return;
    document.documentElement.dataset.floqrHelpI18nBound = "1";
    global.addEventListener?.("floqr:ui-language", () => {
      try {
        if (global.FLOQRI18nHelp?.applyHelpDom) {
          global.FLOQRI18nHelp.applyHelpDom(document);
        } else {
          document.querySelectorAll("[data-floqr-help-mounted='1']").forEach(node => {
            delete node.dataset.floqrHelpMounted;
          });
          mountAll(document);
        }
      } catch (_error) {}
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindLanguageRefresh();
    mountAll(document);
  });

  global.FLOQRHelpAttach = {
    attach,
    attachBesideHeading,
    glueOrphanPopouts,
    mountAll,
    ensureLabelShell,
    ensureCss
  };
})(window);
