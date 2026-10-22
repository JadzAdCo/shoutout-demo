/**
 * FLOQR Site chrome — Nightlife | Traditional | Black Tiffany | White/Black | Black Dark Green.
 * Preference datapoint: users.isSiteChrome
 *   0 = Nightlife chrome
 *   1 = Traditional
 *   2 = Black Tiffany
 *   3 = White / Black (light)
 *   4 = Black Dark Green
 * Gated by Features & Services key `siteChrome` (beta invite / assignment).
 * Also accepts legacy localStorage floqr.uiChrome / users.uiChrome during migration.
 * Stage pages may set html[data-floqr-theme-ungated="1"] to preview without a beta grant.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.isSiteChrome";
  const LEGACY_STORAGE_KEY = "floqr.uiChrome";
  const FEATURE_KEY = "siteChrome";
  const SCHEMES = ["traditional", "nightlife", "blackTiffany", "whiteBlack", "blackDarkGreen"];
  const DEFAULT_SCHEME = "nightlife";

  /** Numeric isSiteChrome codes. */
  const SITE_CHROME = Object.freeze({
    NIGHTLIFE: 0,
    TRADITIONAL: 1,
    BLACK_TIFFANY: 2,
    WHITE_BLACK: 3,
    BLACK_DARK_GREEN: 4,
    /** @deprecated use BLACK_TIFFANY */
    RESERVED_3RD: 2,
    /** @deprecated use BLACK_DARK_GREEN */
    RESERVED_4TH: 4
  });

  /** Asset cache-bust for chrome icon packs (not navigation). */
  const ICON_V = "s3.2.26";
  /** Once Features & Services has answered, premium chrome may be demoted to Nightlife. */
  let featuresAccessResolved = false;
  const NIGHTLIFE_ICONS = {
    floqCast: "./images/chrome/floqcast-nightlife.jpg?v=" + ICON_V,
    vipReserv: "./images/chrome/vip-nightlife.jpg?v=" + ICON_V,
    shoutOut: "./images/chrome/shoutout-nightlife.png?v=" + ICON_V,
    floqAi: "./images/chrome/botdee-nightlife.jpg?v=" + ICON_V,
    bartR: "./images/chrome/bartr-nightlife.png?v=" + ICON_V,
    rydR: "./images/chrome/rydr-nightlife.png?v=" + ICON_V
  };
  const TRADITIONAL_ICONS = {
    floqCast: "./images/chrome/floqcast-traditional.jpg?v=" + ICON_V,
    vipReserv: "./images/chrome/vip-traditional.jpg?v=" + ICON_V,
    shoutOut: "./images/chrome/shoutout-traditional-green.png?v=" + ICON_V,
    floqAi: "./images/chrome/botdee-traditional.jpg?v=" + ICON_V,
    bartR: "./images/chrome/bartr-traditional.jpg?v=" + ICON_V,
    rydR: "./images/chrome/rydr-traditional.jpg?v=" + ICON_V
  };
  const BLACK_TIFFANY_ICONS = Object.assign({}, NIGHTLIFE_ICONS, {
    vipReserv: "./images/chrome/vip-blacktiffany.jpg?v=" + ICON_V
  });
  const BLACK_DARK_GREEN_ICONS = Object.assign({}, NIGHTLIFE_ICONS, {
    vipReserv: "./images/chrome/vip-blackdarkgreen.jpg?v=" + ICON_V,
    shoutOut: "./images/chrome/shoutout-traditional-green.png?v=" + ICON_V
  });
  const WHITE_BLACK_ICONS = {
    floqCast: "./images/chrome/floqcast-whiteblack.jpg?v=" + ICON_V,
    vipReserv: "./images/chrome/vip-whiteblack.jpg?v=" + ICON_V,
    shoutOut: "./images/chrome/shoutout-whiteblack.png?v=" + ICON_V,
    floqAi: "./images/chrome/botdee-whiteblack.jpg?v=" + ICON_V,
    bartR: "./images/chrome/bartr-whiteblack.jpg?v=" + ICON_V,
    rydR: "./images/chrome/rydr-whiteblack.jpg?v=" + ICON_V
  };
  const ICON_PACK = {
    traditional: TRADITIONAL_ICONS,
    nightlife: NIGHTLIFE_ICONS,
    blackTiffany: BLACK_TIFFANY_ICONS,
    blackDarkGreen: BLACK_DARK_GREEN_ICONS,
    whiteBlack: WHITE_BLACK_ICONS
  };

  const LABEL_KEYS = {
    nightlife: "chrome.nightlifeFull",
    traditional: "chrome.traditionalFull",
    blackTiffany: "chrome.blackTiffanyFull",
    blackDarkGreen: "chrome.blackDarkGreenFull",
    whiteBlack: "chrome.whiteBlackFull"
  };

  const LABEL_FALLBACK = {
    nightlife: "Nightlife theme",
    traditional: "Traditional theme",
    blackTiffany: "Black Tiffany theme",
    blackDarkGreen: "Black Dark Green theme",
    whiteBlack: "White / Black theme"
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
    if (
      lower === "whiteblack" ||
      lower === "white-black" ||
      lower === "white_black" ||
      lower === "white/black" ||
      lower === "light"
    ) {
      return "whiteBlack";
    }
    if (SCHEMES.includes(v)) return v;
    if (lower === "traditional" || lower === "nightlife") return lower;
    return DEFAULT_SCHEME;
  }

  function normalizeSiteChrome(value) {
    const n = Number(value);
    if (n === SITE_CHROME.TRADITIONAL) return SITE_CHROME.TRADITIONAL;
    if (n === SITE_CHROME.BLACK_TIFFANY) return SITE_CHROME.BLACK_TIFFANY;
    if (n === SITE_CHROME.WHITE_BLACK) return SITE_CHROME.WHITE_BLACK;
    if (n === SITE_CHROME.BLACK_DARK_GREEN) return SITE_CHROME.BLACK_DARK_GREEN;
    if (n === SITE_CHROME.NIGHTLIFE) return SITE_CHROME.NIGHTLIFE;
    return SITE_CHROME.NIGHTLIFE;
  }

  function schemeFromSiteChrome(code) {
    const n = normalizeSiteChrome(code);
    if (n === SITE_CHROME.TRADITIONAL) return "traditional";
    if (n === SITE_CHROME.BLACK_TIFFANY) return "blackTiffany";
    if (n === SITE_CHROME.WHITE_BLACK) return "whiteBlack";
    if (n === SITE_CHROME.BLACK_DARK_GREEN) return "blackDarkGreen";
    return DEFAULT_SCHEME;
  }

  function siteChromeFromScheme(scheme) {
    const s = normalizeScheme(scheme);
    if (s === "traditional") return SITE_CHROME.TRADITIONAL;
    if (s === "blackTiffany") return SITE_CHROME.BLACK_TIFFANY;
    if (s === "whiteBlack") return SITE_CHROME.WHITE_BLACK;
    if (s === "blackDarkGreen") return SITE_CHROME.BLACK_DARK_GREEN;
    return SITE_CHROME.NIGHTLIFE;
  }

  function isPremiumScheme(scheme) {
    const s = normalizeScheme(scheme);
    return s !== DEFAULT_SCHEME;
  }

  function isPremiumCode(code) {
    return normalizeSiteChrome(code) !== SITE_CHROME.NIGHTLIFE;
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
    // Paint always honors the patron's last-used chrome (localStorage / profile).
    // Beta access only gates the Language Settings picker + new premium picks.
    return preferred != null ? normalizeSiteChrome(preferred) : getSiteChrome();
  }

  function effectiveChrome(preferredScheme) {
    if (preferredScheme != null) {
      return schemeFromSiteChrome(effectiveSiteChrome(siteChromeFromScheme(preferredScheme)));
    }
    return schemeFromSiteChrome(effectiveSiteChrome());
  }

  function setSiteChrome(code, opts = {}) {
    let next = normalizeSiteChrome(code);
    // Block *new* premium picks only after Features has resolved and access is denied.
    // Never wipe a previously stored chrome on login / signed-out paint.
    if (
      isPremiumCode(next) &&
      featuresAccessResolved &&
      !hasThemeAccess() &&
      opts.force !== true
    ) {
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
      return applyDocument(getChrome());
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(code));
      localStorage.setItem(LEGACY_STORAGE_KEY, schemeFromSiteChrome(code));
    } catch (_) { /* ignore */ }
    // Cross-device: profile wins; paint immediately (incl. signed-out→signed-in on login).
    return applyDocument(schemeFromSiteChrome(code));
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
    // Prefer explicit scheme, else last-used storage — never demote for missing beta.
    const s = scheme != null ? normalizeScheme(scheme) : getChrome();
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

  function markFeaturesAccessResolved() {
    featuresAccessResolved = true;
  }

  function syncAccessGate(root) {
    const allowed = hasThemeAccess();
    if (allowed) featuresAccessResolved = true;
    const scope = root || global.document;
    if (scope?.querySelectorAll) {
      scope.querySelectorAll("[data-floqr-theme-panel]").forEach((el) => {
        el.classList.toggle("hidden", !allowed);
        el.hidden = !allowed;
        el.setAttribute("aria-hidden", allowed ? "false" : "true");
      });
    }
    // Login + Search: always paint last-used chrome (device localStorage). Cross-device
    // comes from hydrateFromProfile after sign-in. Access gate only toggles the picker.
    applyDocument(getChrome());
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
    markFeaturesAccessResolved,
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
    // Optimistic: restore last chrome (Traditional, etc.) so the closed profile card
    // on Search matches the chosen theme before Features & Services returns.
    applyDocument(getChrome());
    if (hasThemeAccess()) {
      featuresAccessResolved = true;
      applyDocument(getChrome());
    }
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
        featuresAccessResolved = true;
        syncAccessGate();
      } catch (_) { /* ignore */ }
    });
  } catch (_) { /* ignore */ }
})(typeof window !== "undefined" ? window : globalThis);
