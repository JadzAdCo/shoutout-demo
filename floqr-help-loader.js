/* Loads one audience's help the first time someone opens ?.
   Patron pages never request the venue-admin or service-member pack. */
(function (global) {
  "use strict";

  const script = global.document && global.document.currentScript;
  const audience = (script && script.dataset && script.dataset.floqrHelpAudience) || "patron";
  const PACK = {
    patron: "./floqr-help-pack-patron.js",
    serviceMember: "./floqr-help-pack-service-member.js",
    venueAdmin: "./floqr-help-pack-venue-admin.js",
    masterAdmin: "./floqr-help-pack-master.js"
  };
  let loading = null;
  let loaded = false;

  function versionOf(src) {
    const own = script && script.src ? new URL(script.src, global.location.href).search : "";
    return own ? `${src}${src.includes("?") ? "&" : "?"}${own.replace(/^\?/, "")}` : src;
  }

  function inject(src) {
    return new Promise((resolve, reject) => {
      const el = global.document.createElement("script");
      el.src = versionOf(src);
      el.async = false;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(src));
      global.document.head.appendChild(el);
    });
  }

  function refreshOpenHelp() {
    const repo = global.FLOQRHelpRepository;
    const entries = repo && typeof repo.entries === "function" ? repo.entries() : [];
    global.document.querySelectorAll("details.help-popout, details.floqr-help-popout").forEach(details => {
      const id = details.dataset.helpId || details.getAttribute("data-help-id") || details.getAttribute("data-floqr-help-id") || "";
      if (!id) return;
      const entry = entries.find(row => row && row.id === id);
      if (!entry) return;
      const localized = repo.localizeEntry ? (repo.localizeEntry(entry) || entry) : entry;
      const bodyEl = details.querySelector(".help-popout-body, .botdee-help-body");
      if (bodyEl && !bodyEl.querySelector("a, button, ul, ol")) {
        bodyEl.textContent = localized.body || entry.body || "";
      }
    });
    try { global.FLOQRI18nHelp && global.FLOQRI18nHelp.applyHelpDom && global.FLOQRI18nHelp.applyHelpDom(global.document); } catch (error) {}
  }

  function ensure() {
    if (loaded) return Promise.resolve(audience);
    if (loading) return loading;
    const pack = PACK[audience];
    if (!pack) {
      loaded = true;
      return Promise.resolve(audience);
    }
    loading = inject("./floqr-help-runtime.js")
      .then(() => inject("./floqr-i18n-help-runtime.js"))
      .then(() => inject(pack))
      .then(() => {
        loaded = true;
        refreshOpenHelp();
        return audience;
      });
    return loading;
  }

  function helpControl(target) {
    if (!target || !target.closest) return null;
    const summary = target.closest("summary");
    if (summary && summary.closest("details.help-popout, details.floqr-help-popout")) return summary;
    const button = target.closest("button.floqr-help-popout");
    return button || null;
  }

  global.document.addEventListener("click", event => {
    const control = helpControl(event.target);
    if (!control || loaded) return;
    event.preventDefault();
    event.stopPropagation();
    const open = () => {
      const details = control.closest("details");
      if (details) details.open = true;
      else control.click();
    };
    ensure().then(open).catch(open);
  }, true);

  global.FLOQRHelpLoader = {ensure, audience};
})(typeof window !== "undefined" ? window : globalThis);
