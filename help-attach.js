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
  flex-wrap:wrap;
  gap:6px 8px;
  width:fit-content !important;
  max-width:100%;
  min-width:0;
  box-sizing:border-box;
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
`;
    document.head.appendChild(style);
  }

  function textOf(value) {
    return String(value == null ? "" : value).trim();
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

    const title = textOf(opts.title) || textOf(host.querySelector(".help-label-text")?.textContent) || "Help";
    const details = buildDetails({
      title,
      bodyHtml: opts.bodyHtml || "",
      bodyText: opts.body || ""
    });
    host.appendChild(details);

    try {
      global.FLOQRHelpRepository?.registerFromHelpNode?.(details, {
        id: opts.id || "",
        title,
        body: opts.body || details.querySelector(".help-popout-body")?.textContent || "",
        searchPhrases: opts.searchPhrases || [title],
        links: opts.links || [],
        source: opts.source || "help-attach",
        page: location.pathname || ""
      });
      if (opts.id || opts.searchPhrases || opts.links) {
        global.FLOQRHelpRepository?.register?.({
          id: opts.id || `help-attach-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80),
          title,
          body: opts.body || details.querySelector(".help-popout-body")?.textContent || "",
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
  }

  document.addEventListener("DOMContentLoaded", () => mountAll(document));

  global.FLOQRHelpAttach = {
    attach,
    attachBesideHeading,
    mountAll,
    ensureLabelShell,
    ensureCss
  };
})(window);
