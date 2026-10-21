/**
 * FLOQR chrome scheme — Traditional | Nightlife product marks.
 * Storage: localStorage "floqr.uiChrome"; optional users/{uid}.uiChrome sync.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.uiChrome";
  const SCHEMES = ["traditional", "nightlife"];
  /** Match current neon Search marks until the patron picks Traditional. */
  const DEFAULT_SCHEME = "nightlife";

  const ICON_PACK = {
    traditional: {
      floqCast: "./images/chrome/floqcast-traditional.jpg",
      vipReserv: "./images/chrome/vip-traditional.jpg",
      shoutOut: "./images/chrome/shoutout-traditional.jpg",
      floqAi: "./images/chrome/floqai-traditional.jpg",
      bartR: "./images/chrome/bartr-traditional.jpg",
      rydR: "./images/chrome/rydr-traditional.jpg"
    },
    nightlife: {
      floqCast: "./images/chrome/floqcast-nightlife.jpg",
      vipReserv: "./images/chrome/vip-nightlife.jpg",
      shoutOut: "./images/chrome/shoutout-nightlife.png",
      floqAi: "./images/chrome/floqai-nightlife.png",
      bartR: "./images/chrome/bartr-nightlife.png",
      rydR: "./images/chrome/rydr-nightlife.png"
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

  function setChrome(scheme, opts = {}) {
    const next = normalize(scheme);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) { /* ignore */ }
    applyDocument(next);
    global.dispatchEvent(new CustomEvent("floqr-chrome-change", {detail: {chrome: next}}));
    if (opts.persistProfile !== false) {
      tryPersistProfile(next);
    }
    return next;
  }

  function tryPersistProfile(scheme) {
    try {
      const auth = global.firebase?.auth?.();
      const db = global.firebase?.firestore?.();
      const uid = auth?.currentUser?.uid;
      if (!uid || !db) return;
      db.collection("users").doc(uid).set({
        uiChrome: scheme,
        uiChromeUpdatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true}).catch(() => {});
    } catch (_) { /* ignore */ }
  }

  /** Prefer profile.uiChrome when signed in (once per page). */
  function hydrateFromProfile(profile) {
    const fromProfile = normalize(profile?.uiChrome);
    if (!profile?.uiChrome) return getChrome();
    try {
      localStorage.setItem(STORAGE_KEY, fromProfile);
    } catch (_) { /* ignore */ }
    applyDocument(fromProfile);
    return fromProfile;
  }

  function iconUrl(featureKey, scheme) {
    const pack = ICON_PACK[normalize(scheme || getChrome())] || ICON_PACK[DEFAULT_SCHEME];
    return pack[featureKey] || null;
  }

  function labelFor(scheme) {
    const s = normalize(scheme);
    const t = global.FLOQRI18n?.t;
    if (typeof t === "function") {
      return s === "nightlife" ? t("chrome.nightlifeFull") : t("chrome.traditionalFull");
    }
    return s === "nightlife" ? "Nightlife chrome" : "Traditional chrome";
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
      const bust = (url.includes("?") ? "&" : "?") + "chrome=" + encodeURIComponent(s);
      if (el.tagName === "IMG") {
        el.setAttribute("src", url + bust);
      } else {
        el.style.backgroundImage = 'url("' + url + bust + '")';
      }
    });
    global.document.querySelectorAll("[data-floqr-chrome-label]").forEach((el) => {
      el.textContent = labelFor(s);
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
      if (btn.dataset.floqrChromeBound === "1") return;
      btn.dataset.floqrChromeBound = "1";
      btn.addEventListener("click", () => {
        setChrome(btn.getAttribute("data-floqr-chrome-btn"));
      });
    });
    applyDocument(getChrome());
  }

  global.FLOQRChromeScheme = {
    STORAGE_KEY,
    SCHEMES,
    DEFAULT_SCHEME,
    ICON_PACK,
    getChrome,
    setChrome,
    hydrateFromProfile,
    iconUrl,
    applyDocument,
    bindToggle,
    normalize,
    labelFor
  };

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", () => {
      applyDocument(getChrome());
      bindToggle();
    });
  } else {
    applyDocument(getChrome());
    bindToggle();
  }
})(typeof window !== "undefined" ? window : globalThis);
