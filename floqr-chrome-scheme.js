/**
 * FLOQR Site chrome — Nightlife | Traditional | Black Tiffany | White/Black |
 * Purple & White | Black & Dark Green.
 * Preference datapoint: users.isSiteChrome
 *   0 = Nightlife chrome
 *   1 = Traditional
 *   2 = Black Tiffany
 *   3 = White / Black (light)
 *   4 = Purple & White (formerly mislabeled “Black Dark Green”; violet/coral)
 *   5 = Black & Dark Green (true forest green)
 * Gated by Features & Services key `siteChrome` (beta invite / assignment).
 * Also accepts legacy localStorage floqr.uiChrome / users.uiChrome during migration.
 * Stage pages may set html[data-floqr-theme-ungated="1"] to preview without a beta grant.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.isSiteChrome";
  const LEGACY_STORAGE_KEY = "floqr.uiChrome";
  const FEATURE_KEY = "siteChrome";
  const SCHEMES = [
    "traditional",
    "nightlife",
    "blackTiffany",
    "whiteBlack",
    "purpleWhite",
    "blackDarkGreen"
  ];
  const DEFAULT_SCHEME = "nightlife";

  /** Numeric isSiteChrome codes. */
  const SITE_CHROME = Object.freeze({
    NIGHTLIFE: 0,
    TRADITIONAL: 1,
    BLACK_TIFFANY: 2,
    WHITE_BLACK: 3,
    PURPLE_WHITE: 4,
    BLACK_DARK_GREEN: 5,
    /** @deprecated use PURPLE_WHITE — code 4 was mislabeled Black Dark Green */
    RESERVED_4TH: 4,
    /** @deprecated use BLACK_TIFFANY */
    RESERVED_3RD: 2
  });

  /** Asset cache-bust for chrome icon / brand packs (not navigation). */
  const ICON_V = "s3.2.42";
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
  const PURPLE_WHITE_ICONS = Object.assign({}, NIGHTLIFE_ICONS, {
    // Purple chrome keeps neon nightlife tiles; VIP mark stays nightlife neon
    shoutOut: "./images/chrome/shoutout-nightlife.png?v=" + ICON_V
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
    purpleWhite: PURPLE_WHITE_ICONS,
    blackDarkGreen: BLACK_DARK_GREEN_ICONS,
    whiteBlack: WHITE_BLACK_ICONS
  };

  /** FloqR parent / hero wordmarks — transparent PNGs sized to match floqr-color height. */
  const BRAND_LOGOS = {
    // White script + tinniest Nightlife cyan→violet→magenta border/halo (user base mark)
    nightlife: "./images/chrome/floqr-script/floqr-hero-nightlife-white-glow.png?v=" + ICON_V,
    traditional: "./images/chrome/floqr-script/floqr-hero-traditional.png?v=" + ICON_V,
    blackTiffany: "./images/chrome/floqr-script/floqr-hero-blacktiffany.png?v=" + ICON_V,
    whiteBlack: "./images/chrome/floqr-script/floqr-hero-whiteblack.png?v=" + ICON_V,
    purpleWhite: "./images/chrome/floqr-script/floqr-hero-purplewhite.png?v=" + ICON_V,
    blackDarkGreen: "./images/chrome/floqr-script/floqr-hero-blackdarkgreen.png?v=" + ICON_V
  };

  const LABEL_KEYS = {
    nightlife: "chrome.nightlifeFull",
    traditional: "chrome.traditionalFull",
    blackTiffany: "chrome.blackTiffanyFull",
    purpleWhite: "chrome.purpleWhiteFull",
    blackDarkGreen: "chrome.blackDarkGreenFull",
    whiteBlack: "chrome.whiteBlackFull"
  };

  const LABEL_FALLBACK = {
    nightlife: "Nightlife theme",
    traditional: "Traditional theme",
    blackTiffany: "Black Tiffany theme",
    purpleWhite: "Purple & White theme",
    blackDarkGreen: "Black & Dark Green theme",
    whiteBlack: "White / Black theme"
  };

  const BRAND_LOGO_SELECTOR = [
    "img.floqr-hero-logo",
    "img.product-parent-logo",
    "img.intent-floqr-logo",
    "img.floqai-hero-logo",
    "img.splash-logo",
    "img[data-floqr-brand-logo]",
    "[data-floqr-brand-logo] img"
  ].join(",");

  function isPurpleAlias(lower) {
    return (
      lower === "purplewhite" ||
      lower === "purple-white" ||
      lower === "purple_white" ||
      lower === "purple&white" ||
      lower === "purple and white" ||
      lower === "purple / white" ||
      lower === "purple/white"
    );
  }

  function isBlackDarkGreenAlias(lower) {
    return (
      lower === "blackdarkgreen" ||
      lower === "black-dark-green" ||
      lower === "black_dark_green" ||
      lower === "black & dark green" ||
      lower === "black and dark green" ||
      lower === "blackforest" ||
      lower === "black-forest"
    );
  }

  function normalizeScheme(value) {
    const v = String(value || "").trim();
    const lower = v.toLowerCase();
    if (lower === "blacktiffany" || lower === "black-tiffany" || lower === "black_tiffany") {
      return "blackTiffany";
    }
    if (isPurpleAlias(lower)) return "purpleWhite";
    if (isBlackDarkGreenAlias(lower)) return "blackDarkGreen";
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
    if (n === SITE_CHROME.PURPLE_WHITE) return SITE_CHROME.PURPLE_WHITE;
    if (n === SITE_CHROME.BLACK_DARK_GREEN) return SITE_CHROME.BLACK_DARK_GREEN;
    if (n === SITE_CHROME.NIGHTLIFE) return SITE_CHROME.NIGHTLIFE;
    return SITE_CHROME.NIGHTLIFE;
  }

  function schemeFromSiteChrome(code) {
    const n = normalizeSiteChrome(code);
    if (n === SITE_CHROME.TRADITIONAL) return "traditional";
    if (n === SITE_CHROME.BLACK_TIFFANY) return "blackTiffany";
    if (n === SITE_CHROME.WHITE_BLACK) return "whiteBlack";
    if (n === SITE_CHROME.PURPLE_WHITE) return "purpleWhite";
    if (n === SITE_CHROME.BLACK_DARK_GREEN) return "blackDarkGreen";
    return DEFAULT_SCHEME;
  }

  function siteChromeFromScheme(scheme) {
    const s = normalizeScheme(scheme);
    if (s === "traditional") return SITE_CHROME.TRADITIONAL;
    if (s === "blackTiffany") return SITE_CHROME.BLACK_TIFFANY;
    if (s === "whiteBlack") return SITE_CHROME.WHITE_BLACK;
    if (s === "purpleWhite") return SITE_CHROME.PURPLE_WHITE;
    if (s === "blackDarkGreen") return SITE_CHROME.BLACK_DARK_GREEN;
    return SITE_CHROME.NIGHTLIFE;
  }

  /** Old localStorage / profile uiChrome "blackDarkGreen" meant purple (code 4). */
  function migrateLegacyChromeStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw === "4" && (legacy === "blackDarkGreen" || !legacy)) {
        localStorage.setItem(LEGACY_STORAGE_KEY, "purpleWhite");
      }
      if ((raw == null || raw === "") && legacy === "blackDarkGreen") {
        localStorage.setItem(STORAGE_KEY, "4");
        localStorage.setItem(LEGACY_STORAGE_KEY, "purpleWhite");
      }
    } catch (_) { /* ignore */ }
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
    migrateLegacyChromeStorage();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw != null && raw !== "") return normalizeSiteChrome(raw);
    } catch (_) { /* ignore */ }
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        // Pre-rename string always meant purple (code 4)
        if (String(legacy).toLowerCase() === "blackdarkgreen") {
          return SITE_CHROME.PURPLE_WHITE;
        }
        return siteChromeFromScheme(legacy);
      }
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
      const legacyName = String(profile.uiChrome).trim().toLowerCase();
      // Old profiles stored uiChrome "blackDarkGreen" for the purple theme (code 4)
      if (legacyName === "blackdarkgreen" || legacyName === "black dark green") {
        code = SITE_CHROME.PURPLE_WHITE;
      } else {
        code = siteChromeFromScheme(profile.uiChrome);
      }
    } else {
      return applyDocument(getChrome());
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(code));
      localStorage.setItem(LEGACY_STORAGE_KEY, schemeFromSiteChrome(code));
    } catch (_) { /* ignore */ }
    return applyDocument(schemeFromSiteChrome(code));
  }

  function iconUrl(featureKey, scheme) {
    const pack = ICON_PACK[normalizeScheme(scheme || effectiveChrome())] || ICON_PACK[DEFAULT_SCHEME];
    return pack[featureKey] || null;
  }

  function brandLogoUrl(scheme) {
    const s = normalizeScheme(scheme || effectiveChrome());
    return BRAND_LOGOS[s] || BRAND_LOGOS[DEFAULT_SCHEME];
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

  function applyBrandLogos(scheme) {
    if (!global.document) return;
    const url = brandLogoUrl(scheme);
    if (!url) return;
    const bust = (url.includes("?") ? "&" : "?") + "chrome=" + encodeURIComponent(scheme);
    global.document.querySelectorAll(BRAND_LOGO_SELECTOR).forEach((el) => {
      const img = el.tagName === "IMG" ? el : el.querySelector?.("img");
      if (!img) return;
      // Picker thumbnails stay scheme-specific — do not overwrite with active chrome.
      if (img.classList.contains("chrome-select-logo") || img.closest?.(".chrome-select-card")) return;
      // Skip product logos that are not FloqR parent marks
      const alt = String(img.getAttribute("alt") || "").toLowerCase();
      const src = String(img.getAttribute("src") || "");
      const isFloqr =
        img.classList.contains("floqr-hero-logo") ||
        img.classList.contains("product-parent-logo") ||
        img.classList.contains("intent-floqr-logo") ||
        img.classList.contains("floqai-hero-logo") ||
        img.classList.contains("splash-logo") ||
        img.hasAttribute("data-floqr-brand-logo") ||
        /floqr/i.test(alt) ||
        /floqr-color|floqr-hero|floqr-script/i.test(src);
      if (!isFloqr) return;
      img.setAttribute("src", url + bust);
      img.setAttribute("data-floqr-brand-logo", scheme);
    });
  }

  function applyDocument(scheme) {
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
    applyBrandLogos(s);
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
      scope.querySelectorAll("[data-floqr-theme-locked]").forEach((el) => {
        el.classList.toggle("hidden", allowed);
        el.hidden = allowed;
        el.setAttribute("aria-hidden", allowed ? "true" : "false");
      });
    }
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
    BRAND_LOGOS,
    ICON_V,
    getChrome,
    getSiteChrome,
    setChrome,
    setSiteChrome,
    hydrateFromProfile,
    iconUrl,
    brandLogoUrl,
    applyDocument,
    applyBrandLogos,
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
    migrateLegacyChromeStorage();
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
