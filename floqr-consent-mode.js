/* Consent Mode v2 bootstrap — only mutates gtag if it already exists.
 * Do not load GA4 until CMP + denied defaults are product-ready.
 * Design notes: .cursor/rules/design-notes-privacy-compliance-safe-rollout.mdc
 */
(function (global) {
  "use strict";

  const DENIED = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  };

  function applyDeniedDefaults() {
    if (typeof global.gtag !== "function") return false;
    try {
      global.gtag("consent", "default", DENIED);
      return true;
    } catch (_) {
      return false;
    }
  }

  function updateFromPrefs(profile = {}) {
    if (typeof global.gtag !== "function") return false;
    const prefs = global.FLOQRPrivacyPrefs;
    const analytics = prefs?.truthy?.(profile.analyticsConsent) ? "granted" : "denied";
    const ads = prefs?.allowsPersonalizedAds?.(profile) ? "granted" : "denied";
    try {
      global.gtag("consent", "update", {
        analytics_storage: analytics,
        ad_storage: ads,
        ad_user_data: ads,
        ad_personalization: ads
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  applyDeniedDefaults();

  global.FLOQRConsentMode = {
    applyDeniedDefaults,
    updateFromPrefs,
    DENIED
  };
})(typeof window !== "undefined" ? window : globalThis);
