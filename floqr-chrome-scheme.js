/**
 * FLOQR chrome scheme (local staging).
 * Patron choice: traditional | nightlife
 * Storage: localStorage "floqr.uiChrome" (profile.uiChrome later when go-live).
 * Does NOT wire Search/Pages until go-ahead.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.uiChrome";
  const SCHEMES = ["traditional", "nightlife"];
  const DEFAULT_SCHEME = "traditional";

  /** Chosen / proposed icon packs for local stage only. */
  const ICON_PACK = {
    traditional: {
      floqCast: "./images/review/floqcast-traditional-v8.jpg",
      vipReserv: "./images/review/vip-traditional-grey-black-border-v6.jpg",
      shoutOut: "./images/review/shoutout-traditional-v2.jpg",
      floqAi: "./images/review/floqai-traditional-v1.jpg",
      bartR: "./images/review/bartr-traditional-v1.jpg",
      rydR: "./images/review/rydr-traditional-v1.jpg"
    },
    nightlife: {
      floqCast: "./images/review/floqcast-nightlife-v9.jpg",
      vipReserv: "./images/review/vip-nightlife-v6.jpg",
      // Proposals pending — fall back to current live marks until nightlife pack chosen
      shoutOut: "./images/shoutout-neon-icon.png",
      floqAi: "./images/floqai-mark.png",
      bartR: "./images/bartr-icon.png",
      rydR: "./images/rydr-logo-car-text-approved.png"
    }
  };

  function normalize(value) {
    const v = String(value || "").trim().toLowerCase();
    return SCHEMES.includes(v) ? v : DEFAULT_SCHEME;
  }

  function getChrome() {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return DEFAULT_SCHEME;
    }
  }

  function setChrome(scheme) {
    const next = normalize(scheme);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) { /* ignore */ }
    applyDocument(next);
    global.dispatchEvent(new CustomEvent("floqr-chrome-change", { detail: { chrome: next } }));
    return next;
  }

  function iconUrl(featureKey, scheme) {
    const pack = ICON_PACK[normalize(scheme || getChrome())] || ICON_PACK[DEFAULT_SCHEME];
    return pack[featureKey] || null;
  }

  function applyDocument(scheme) {
    const s = normalize(scheme || getChrome());
    if (global.document && global.document.documentElement) {
      global.document.documentElement.setAttribute("data-floqr-chrome", s);
    }
    if (!global.document) return s;
    global.document.querySelectorAll("[data-floqr-chrome-icon]").forEach((el) => {
      const key = el.getAttribute("data-floqr-chrome-icon");
      const url = iconUrl(key, s);
      if (!url) return;
      if (el.tagName === "IMG") {
        el.setAttribute("src", url + (url.includes("?") ? "&" : "?") + "chrome=" + s);
      } else {
        el.style.backgroundImage = 'url("' + url + '")';
      }
    });
    global.document.querySelectorAll("[data-floqr-chrome-label]").forEach((el) => {
      el.textContent = s === "nightlife" ? "Nightlife chrome" : "Traditional chrome";
    });
    global.document.querySelectorAll("[data-floqr-chrome-btn]").forEach((btn) => {
      const name = btn.getAttribute("data-floqr-chrome-btn");
      btn.setAttribute("aria-pressed", name === s ? "true" : "false");
    });
    return s;
  }

  function bindToggle(root) {
    const scope = root || global.document;
    if (!scope) return;
    scope.querySelectorAll("[data-floqr-chrome-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setChrome(btn.getAttribute("data-floqr-chrome-btn"));
      });
    });
    applyDocument(getChrome());
  }

  global.FLOQRChromeScheme = {
    STORAGE_KEY,
    SCHEMES,
    ICON_PACK,
    getChrome,
    setChrome,
    iconUrl,
    applyDocument,
    bindToggle,
    normalize
  };
})(typeof window !== "undefined" ? window : globalThis);
