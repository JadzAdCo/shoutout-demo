/**
 * FLOQR Site chrome — Nightlife | Traditional | Black Tiffany | Black Dark Green.
 * Preference datapoint: users.isSiteChrome
 *   0 = Nightlife chrome
 *   1 = Traditional
 *   2 = Black Tiffany (was Reserved_3rd_chrome)
 *   4 = Black Dark Green (was Reserved_4th_chrome)
 * Gated by Features & Services key `siteChrome` (beta invite / assignment).
 * Also accepts legacy localStorage floqr.uiChrome / users.uiChrome during migration.
 * Stage pages may set html[data-floqr-theme-ungated="1"] to preview without a beta grant.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.isSiteChrome";
  const LEGACY_STORAGE_KEY = "floqr.uiChrome";
  const FEATURE_KEY = "siteChrome";
  const SCHEMES = ["traditional", "nightlife", "blackTiffany", "blackDarkGreen"];
  const DEFAULT_SCHEME = "nightlife";

  /** Numeric isSiteChrome codes. */
  const SITE_CHROME = Object.freeze({
    NIGHTLIFE: 0,
    TRADITIONAL: 1,
    BLACK_TIFFANY: 2,
    BLACK_DARK_GREEN: 4,
    /** @deprecated use BLACK_TIFFANY */
    RESERVED_3RD: 2,
    /** @deprecated use BLACK_DARK_GREEN */
    RESERVED_4TH: 4
  });

  /** Asset cache-bust for chrome icon packs (not navigation). */
  const ICON_V = "s3.2.05";
  const NIGHTLIFE_ICONS = {
    floqCast: "./images/chrome/floqcast-nightlife.jpg?v=" + ICON_V,
    vipReserv: "./images/chrome/vip-nightlife.jpg?v=" + ICON_V,
    shoutOut: "./images/chrome/shoutout-nightlife.png?v=" + ICON_V,
    floqAi: "./images/chrome/floqai-nightlife.png?v=" + ICON_V,
    bartR: "./images/chrome/bartr-nightlife.png?v=" + ICON_V,
    rydR: "./images/chrome/rydr-nightlife.png?v=" + ICON_V
  };
  const TRADITIONAL_ICONS = {
    floqCast: "./images/chrome/floqcast-traditional.jpg?v=" + ICON_V,
    vipReserv: "./images/chrome/vip-traditional.jpg?v=" + ICON_V,
    shoutOut: "./images/chrome/shoutout-traditional-green.png?v=" + ICON_V,
    floqAi: "./images/chrome/floqai-traditional.jpg?v=" + ICON_V,
    bartR: "./images/chrome/bartr-traditional.jpg?v=" + ICON_V,
    rydR: "./images/chrome/rydr-traditional.jpg?v=" + ICON_V
  };
  const ICON_PACK = {
    traditional: TRADITIONAL_ICONS,
    nightlife: NIGHTLIFE_ICONS,
    // Black themes keep nightlife icon art; CSS swaps purple → Tiffany / forest
    blackTiffany: NIGHTLIFE_ICONS,
    blackDarkGreen: Object.assign({}, NIGHTLIFE_ICONS, {
      shoutOut: "./images/chrome/shoutout-traditional-green.png?v=" + ICON_V
    })
  };

  const LABEL_KEYS = {
    nightlife: "chrome.nightlifeFull",
    traditional: "chrome.traditionalFull",
    blackTiffany: "chrome.blackTiffanyFull",
    blackDarkGreen: "chrome.blackDarkGreenFull"
  };

  const LABEL_FALLBACK = {
    nightlife: "Nightlife theme",
    traditional: "Traditional theme",
    blackTiffany: "Black Tiffany theme",
    blackDarkGreen: "Black Dark Green theme"
  };

  function normalizeScheme(value) {
    const v = String(value || "").trim();
    const lower = v.toLowerCase();
    if (lower === "blacktiffany" || lower === "black-tiffany" || lower === "black_tiffany") {
      return "blackTiffany";
    }
    if (
      lower === "blackdarkgreen" ||
      lower === "black-dark-green" ||
      lower === "black_dark_green" ||
      lower === "blackforest" ||
      lower === "black-forest"
    ) {
      return "blackDarkGreen";
    }
    if (SCHEMES.includes(v)) return v;
    if (lower === "traditional" || lower === "nightlife") return lower;
    return DEFAULT_SCHEME;
  }

  function normalizeSiteChrome(value) {
    const n = Number(value);
    if (n === SITE_CHROME.TRADITIONAL) return SITE_CHROME.TRADITIONAL;
    if (n === SITE_CHROME.BLACK_TIFFANY) return SITE_CHROME.BLACK_TIFFANY;
    if (n === SITE_CHROME.BLACK_DARK_GREEN) return SITE_CHROME.BLACK_DARK_GREEN;
    if (n === SITE_CHROME.NIGHTLIFE) return SITE_CHROME.NIGHTLIFE;
    return SITE_CHROME.NIGHTLIFE;
  }

  function schemeFromSiteChrome(code) {
    const n = normalizeSiteChrome(code);
    if (n === SITE_CHROME.TRADITIONAL) return "traditional";
    if (n === SITE_CHROME.BLACK_TIFFANY) return "blackTiffany";
    if (n === SITE_CHROME.BLACK_DARK_GREEN) return "blackDarkGreen";
    return DEFAULT_SCHEME;
  }

  function siteChromeFromScheme(scheme) {
    const s = normalizeScheme(scheme);
    if (s === "traditional") return SITE_CHROME.TRADITIONAL;
    if (s === "blackTiffany") return SITE_CHROME.BLACK_TIFFANY;
    if (s === "blackDarkGreen") return SITE_CHROME.BLACK_DARK_GREEN;
    return SITE_CHROME.NIGHTLIFE;
  }

  function isPremiumScheme(scheme) {
    const s = normalizeScheme(scheme);
    return s === "traditional" || s === "blackTiffany" || s === "blackDarkGreen";
  }

  function isPremiumCode(code) {
    const n = normalizeSiteChrome(code);
    return (
      n === SITE_CHROME.TRADITIONAL ||
      n === SITE_CHROME.BLACK_TIFFANY ||
      n === SITE_CHROME.BLACK_DARK_GREEN
    );
  }

  function isUngated() {
    try {
      return global.document?.documentElement?.getAttribute("data-floqr-theme-ungated") === "1";
    } catch (_) {
      return false;
    }
  }

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

  function readStoredSiteChrome() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw != null && raw !== "") return normalizeSiteChrome(raw);
    } catch (_) { /* ignore */ }
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) return siteChromeFromScheme(legacy);
    } catch (_) { /* ignore */ }
    return SITE_CHROME.NIGHTLIFE;
  }

  function getSiteChrome() {
    return readStoredSiteChrome();
  }

  function getChrome() {
    return schemeFromSiteChrome(getSiteChrome());
  }

  function effectiveSiteChrome(preferred) {
    const want = preferred != null ? normalizeSiteChrome(preferred) : getSiteChrome();
    if (isPremiumCode(want) && !hasThemeAccess()) return SITE_CHROME.NIGHTLIFE;
    return want;
  }

  function effectiveChrome(preferredScheme) {
    if (preferredScheme != null) {
      return schemeFromSiteChrome(effectiveSiteChrome(siteChromeFromScheme(preferredScheme)));
    }
    return schemeFromSiteChrome(effectiveSiteChrome());
  }

  function setSiteChrome(code, opts = {}) {
    let next = normalizeSiteChrome(code);
    if (isPremiumCode(next) && !hasThemeAccess()) next = SITE_CHROME.NIGHTLIFE;
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
      localStorage.setItem(LEGACY_STORAGE_KEY, schemeFromSiteChrome(next));
    } catch (_) { /* ignore */ }
    applyDocument(schemeFromSiteChrome(next));
    global.dispatchEvent(new CustomEvent("floqr-chrome-change", {
      detail: {chrome: schemeFromSiteChrome(next), isSiteChrome: next}
    }));
    if (opts.persistProfile !== false) tryPersistProfile(next);
    return next;
  }

  function setChrome(scheme, opts = {}) {
    return setSiteChrome(siteChromeFromScheme(scheme), opts);
  }

  function tryPersistProfile(code) {
    try {
      const auth = global.firebase?.auth?.();
      const db = global.firebase?.firestore?.();
      const uid = auth?.currentUser?.uid;
      if (!uid || !db) return;
      const isSiteChrome = normalizeSiteChrome(code);
      db.collection("users").doc(uid).set({
        isSiteChrome,
        uiChrome: schemeFromSiteChrome(isSiteChrome),
        uiChromeUpdatedAt: global.firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true}).catch(() => {});
    } catch (_) { /* ignore */ }
  }

  function hydrateFromProfile(profile) {
    let code = SITE_CHROME.NIGHTLIFE;
    if (profile && Object.prototype.hasOwnProperty.call(profile, "isSiteChrome")) {
      code = normalizeSiteChrome(profile.isSiteChrome);
    } else if (profile?.uiChrome) {
      code = siteChromeFromScheme(profile.uiChrome);
    } else {
      return applyDocument(effectiveChrome());
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(code));
      localStorage.setItem(LEGACY_STORAGE_KEY, schemeFromSiteChrome(code));
    } catch (_) { /* ignore */ }
    return applyDocument(schemeFromSiteChrome(effectiveSiteChrome(code)));
  }

  function iconUrl(featureKey, scheme) {
    const pack = ICON_PACK[normalizeScheme(scheme || effectiveChrome())] || ICON_PACK[DEFAULT_SCHEME];
    return pack[featureKey] || null;
  }

  function labelFor(scheme) {
    const s = normalizeScheme(scheme);
    const t = global.FLOQRI18n?.t;
    const key = LABEL_KEYS[s] || LABEL_KEYS[DEFAULT_SCHEME];
    if (typeof t === "function") {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
    return LABEL_FALLBACK[s] || LABEL_FALLBACK[DEFAULT_SCHEME];
  }

  function applyDocument(scheme) {
    const s = effectiveChrome(scheme);
    if (global.document && global.document.documentElement) {
      global.document.documentElement.setAttribute("data-floqr-chrome", s);
      global.document.documentElement.setAttribute("data-is-site-chrome", String(siteChromeFromScheme(s)));
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
      btn.setAttribute("aria-pressed", normalizeScheme(name) === s ? "true" : "false");
    });
    return s;
  }

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
        const name = btn.getAttribute("data-floqr-chrome-btn");
        if (!hasThemeAccess() && isPremiumScheme(name)) {
          syncAccessGate(scope);
          return;
        }
        setChrome(name);
      });
    });
    syncAccessGate(scope);
  }

  global.FLOQRChromeScheme = {
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    FEATURE_KEY,
    SITE_CHROME,
    SCHEMES,
    DEFAULT_SCHEME,
    ICON_PACK,
    getChrome,
    getSiteChrome,
    setChrome,
    setSiteChrome,
    hydrateFromProfile,
    iconUrl,
    applyDocument,
    bindToggle,
    syncAccessGate,
    hasThemeAccess,
    effectiveChrome,
    effectiveSiteChrome,
    schemeFromSiteChrome,
    siteChromeFromScheme,
    normalize: normalizeScheme,
    normalizeSiteChrome,
    labelFor,
    isPremiumScheme
  };

  function boot() {
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
