/**
 * FLOQR Site chrome — Nightlife | Traditional (beta) (+ reserved codes).
 * Preference datapoint: users.isSiteChrome
 *   0 = Nightlife chrome
 *   1 = Traditional
 *   2 = Reserved_3rd_chrome
 *   4 = Reserved_4th_chrome
 * Gated by Features & Services key `siteChrome` (beta invite / assignment).
 * Also accepts legacy localStorage floqr.uiChrome / users.uiChrome during migration.
 * Stage pages may set html[data-floqr-theme-ungated="1"] to preview without a beta grant.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.isSiteChrome";
  const LEGACY_STORAGE_KEY = "floqr.uiChrome";
  const FEATURE_KEY = "siteChrome";
  const SCHEMES = ["traditional", "nightlife"];
  const DEFAULT_SCHEME = "nightlife";

  /** Numeric isSiteChrome codes. */
  const SITE_CHROME = Object.freeze({
    NIGHTLIFE: 0,
    TRADITIONAL: 1,
    RESERVED_3RD: 2,
    RESERVED_4TH: 4
  });

  /** Asset cache-bust for chrome icon packs (not navigation). */
  const ICON_V = "28";
  const ICON_PACK = {
    traditional: {
      floqCast: "./images/chrome/floqcast-traditional.jpg?v=" + ICON_V,
      vipReserv: "./images/chrome/vip-traditional.jpg?v=" + ICON_V,
      shoutOut: "./images/chrome/shoutout-traditional.jpg?v=" + ICON_V,
      floqAi: "./images/chrome/floqai-traditional.jpg?v=" + ICON_V,
      bartR: "./images/chrome/bartr-traditional.jpg?v=" + ICON_V,
      rydR: "./images/chrome/rydr-traditional.jpg?v=" + ICON_V
    },
    nightlife: {
      floqCast: "./images/chrome/floqcast-nightlife.jpg?v=" + ICON_V,
      vipReserv: "./images/chrome/vip-nightlife.jpg?v=" + ICON_V,
      shoutOut: "./images/chrome/shoutout-nightlife.png?v=" + ICON_V,
      floqAi: "./images/chrome/floqai-nightlife.png?v=" + ICON_V,
      bartR: "./images/chrome/bartr-nightlife.png?v=" + ICON_V,
      rydR: "./images/chrome/rydr-nightlife.png?v=" + ICON_V
    }
  };

  function normalizeScheme(value) {
    const v = String(value || "").trim().toLowerCase();
    return SCHEMES.includes(v) ? v : DEFAULT_SCHEME;
  }

  function normalizeSiteChrome(value) {
    const n = Number(value);
    if (n === SITE_CHROME.TRADITIONAL) return SITE_CHROME.TRADITIONAL;
    if (n === SITE_CHROME.RESERVED_3RD) return SITE_CHROME.RESERVED_3RD;
    if (n === SITE_CHROME.RESERVED_4TH) return SITE_CHROME.RESERVED_4TH;
    if (n === SITE_CHROME.NIGHTLIFE) return SITE_CHROME.NIGHTLIFE;
    return SITE_CHROME.NIGHTLIFE;
  }

  /** Map isSiteChrome → paint scheme. Reserved 2/4 fall back to Nightlife until defined. */
  function schemeFromSiteChrome(code) {
    const n = normalizeSiteChrome(code);
    if (n === SITE_CHROME.TRADITIONAL) return "traditional";
    return DEFAULT_SCHEME;
  }

  function siteChromeFromScheme(scheme) {
    return normalizeScheme(scheme) === "traditional" ? SITE_CHROME.TRADITIONAL : SITE_CHROME.NIGHTLIFE;
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
    if (want === SITE_CHROME.TRADITIONAL && !hasThemeAccess()) return SITE_CHROME.NIGHTLIFE;
    // Reserved codes require access too; until defined they paint as Nightlife.
    if ((want === SITE_CHROME.RESERVED_3RD || want === SITE_CHROME.RESERVED_4TH) && !hasThemeAccess()) {
      return SITE_CHROME.NIGHTLIFE;
    }
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
    if (next === SITE_CHROME.TRADITIONAL && !hasThemeAccess()) next = SITE_CHROME.NIGHTLIFE;
    if ((next === SITE_CHROME.RESERVED_3RD || next === SITE_CHROME.RESERVED_4TH) && !hasThemeAccess()) {
      next = SITE_CHROME.NIGHTLIFE;
    }
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
    if (typeof t === "function") {
      return s === "nightlife" ? t("chrome.nightlifeFull") : t("chrome.traditionalFull");
    }
    return s === "nightlife" ? "Nightlife theme" : "Traditional theme";
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
      btn.setAttribute("aria-pressed", name === s ? "true" : "false");
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
        if (!hasThemeAccess() && name === "traditional") {
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
    labelFor
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
