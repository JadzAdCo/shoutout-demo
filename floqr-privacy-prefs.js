/* FLOQR privacy preferences + GPC / Do Not Sell signals.
 * Design notes: .cursor/rules/design-notes-privacy-compliance-safe-rollout.mdc
 */
(function (global) {
  "use strict";

  const POLICY_VERSION = "s3.0.103";
  const GPC_STORAGE_KEY = "floqrGpcApplied:v1";

  function truthy(value) {
    if (value === true || value === 1) return true;
    const s = String(value == null ? "" : value).trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
  }

  function falsyExplicit(value) {
    if (value === false || value === 0) return true;
    const s = String(value == null ? "" : value).trim().toLowerCase();
    return s === "0" || s === "false" || s === "no" || s === "off";
  }

  function detectGpc() {
    try {
      if (global.navigator && global.navigator.globalPrivacyControl === true) return true;
    } catch (_) { /* ignore */ }
    return false;
  }

  function readLocalGpcStamp() {
    try {
      return global.localStorage?.getItem(GPC_STORAGE_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function stampLocalGpc() {
    try {
      global.localStorage?.setItem(GPC_STORAGE_KEY, new Date().toISOString());
    } catch (_) { /* ignore */ }
  }

  /** Personalized ads / sale-or-share of profile tags — false when opted out or GPC. */
  function allowsPersonalizedAds(profile = {}) {
    if (detectGpc()) return false;
    if (truthy(profile.doNotSellOrShare)) return false;
    if (falsyExplicit(profile.dataSharingConsent)) return false;
    return true;
  }

  /**
   * Marketing SMS/email: explicit false blocks; unset allowed until cutover (grandfather).
   * Pass enforceOptIn true after cutover to require marketingConsent === true.
   */
  function allowsMarketing(profile = {}, {enforceOptIn = false} = {}) {
    if (falsyExplicit(profile.marketingConsent)) return false;
    if (truthy(profile.doNotSellOrShare) && !truthy(profile.marketingConsent)) return false;
    if (enforceOptIn) return truthy(profile.marketingConsent);
    return true;
  }

  function patchFromGpc(profile = {}) {
    if (!detectGpc()) return null;
    stampLocalGpc();
    if (truthy(profile.doNotSellOrShare) && readLocalGpcStamp()) return null;
    return {
      doNotSellOrShare: true,
      gpcAppliedAt: new Date().toISOString(),
      privacyPolicyVersionAccepted: profile.privacyPolicyVersionAccepted || POLICY_VERSION
    };
  }

  global.FLOQRPrivacyPrefs = {
    POLICY_VERSION,
    detectGpc,
    allowsPersonalizedAds,
    allowsMarketing,
    patchFromGpc,
    truthy,
    falsyExplicit
  };
})(typeof window !== "undefined" ? window : globalThis);
