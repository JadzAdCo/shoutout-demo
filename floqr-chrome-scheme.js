/**
 * FLOQR site theme — Nightlife (default) | Traditional (beta).
 * Traditional switches the full site color theme (CSS vars + chrome icons where marked).
 * Gated by Features & Services key `traditionalTheme` (beta invite / assignment).
 * Storage: localStorage "floqr.uiChrome"; optional users/{uid}.uiChrome sync.
 * Stage pages may set html[data-floqr-theme-ungated="1"] to preview without a beta grant.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.uiChrome";
  const FEATURE_KEY = "traditionalTheme";
  const SCHEMES = ["traditional", "nightlife"];
  /** Public default — neon nightlife until a granted beta tester picks Traditional. */
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

  function isUngated() {
    try {
      return global.document?.documentElement?.getAttribute("data-floqr-theme-ungated") === "1";
    } catch (_) {
      return false;
    }
  }

  /** True when Features & Services grants traditionalTheme (or stage ungated). */
  function hasThemeAccess() {
    if (isUngated()) return true;
    try {
      const fs = global.FLOQRFeatureServices;
      if (!fs?.canAccess) return false;
      return fs.canAccess(FEATURE_KEY) === true;
    } catch (_) {
      return false;
    }
  }

  function getChrome() {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return DEFAULT_SCHEME;
    }
  }

  /** Effective scheme for paint — Traditional only with beta access. */
  function effectiveChrome(preferred) {
    const want = normalize(preferred != null ? preferred : getChrome());
    if (want === "traditional" && !hasThemeAccess()) return DEFAULT_SCHEME;
    return want;
  }

  function setChrome(scheme, opts = {}) {
    let next = normalize(scheme);
    if (next === "traditional" && !hasThemeAccess()) {
      next = DEFAULT_SCHEME;
    }
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

  /** Prefer profile.uiChrome when signed in (once per page); still access-gated. */
  function hydrateFromProfile(profile) {
    if (!profile?.uiChrome) return applyDocument(effectiveChrome());
    const fromProfile = normalize(profile.uiChrome);
    try {
      localStorage.setItem(STORAGE_KEY, fromProfile);
    } catch (_) { /* ignore */ }
    return applyDocument(effectiveChrome(fromProfile));
  }

  function iconUrl(featureKey, scheme) {
    const pack = ICON_PACK[normalize(scheme || effectiveChrome())] || ICON_PACK[DEFAULT_SCHEME];
    return pack[featureKey] || null;
  }

  function labelFor(scheme) {
    const s = normalize(scheme);
    const t = global.FLOQRI18n?.t;
    if (typeof t === "function") {
      return s === "nightlife" ? t("chrome.nightlifeFull") : t("chrome.traditionalFull");
    }
    return s === "nightlife" ? "Nightlife theme" : "Traditional theme";
  }

  function applyDocument(scheme) {
    const s = effectiveChrome(scheme);
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

  /** Show/hide Profile theme panel; force Nightlife paint without beta. */
  function syncAccessGate(root) {
    const allowed = hasThemeAccess();
    const scope = root || global.document;
    if (scope?.querySelectorAll) {
      scope.querySelectorAll("[data-floqr-theme-panel]").forEach((el) => {
        el.classList.toggle("hidden", !allowed);
        el.hidden = !allowed;
        el.setAttribute("aria-hidden", allowed ? "false" : "true");
      });
    }
    applyDocument(allowed ? getChrome() : DEFAULT_SCHEME);
    return allowed;
  }

  function bindToggle(root) {
    const scope = root || global.document;
    if (!scope) return;
    scope.querySelectorAll("[data-floqr-chrome-btn]").forEach((btn) => {
      if (btn.dataset.floqrChromeBound === "1") return;
      btn.dataset.floqrChromeBound = "1";
      btn.addEventListener("click", () => {
        if (!hasThemeAccess() && btn.getAttribute("data-floqr-chrome-btn") === "traditional") {
          syncAccessGate(scope);
          return;
        }
        setChrome(btn.getAttribute("data-floqr-chrome-btn"));
      });
    });
    syncAccessGate(scope);
  }

  global.FLOQRChromeScheme = {
    STORAGE_KEY,
    FEATURE_KEY,
    SCHEMES,
    DEFAULT_SCHEME,
    ICON_PACK,
    getChrome,
    setChrome,
    hydrateFromProfile,
    iconUrl,
    applyDocument,
    bindToggle,
    syncAccessGate,
    hasThemeAccess,
    effectiveChrome,
    normalize,
    labelFor
  };

  function boot() {
    // Fail closed: Nightlife until Features & Services confirms traditionalTheme access.
    applyDocument(DEFAULT_SCHEME);
    if (hasThemeAccess()) applyDocument(getChrome());
    bindToggle();
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  try {
    global.addEventListener("floqr:features-loaded", () => {
      try {
        syncAccessGate();
      } catch (_) { /* ignore */ }
    });
  } catch (_) { /* ignore */ }
})(typeof window !== "undefined" ? window : globalThis);
