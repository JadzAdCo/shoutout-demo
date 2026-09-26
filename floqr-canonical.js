/* FLOQR canonical origin — staging vs production cutover.
 * Design notes: .cursor/rules/cutoffrequirement.mdc
 */
(function (global) {
  "use strict";

  const PRODUCTION_ORIGIN = "https://www.floqr.com";
  const STAGING_HOST_RE = /(^|\.)github\.io$/i;

  function pageOrigin() {
    try {
      return String(global.location?.origin || "").replace(/\/$/, "");
    } catch (_) {
      return "";
    }
  }

  function isStagingHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return STAGING_HOST_RE.test(host) || host === "localhost" || host === "127.0.0.1";
  }

  function isProductionHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return host === "www.floqr.com" || host === "floqr.com";
  }

  /** Origin for legal / Store / absolute links. Prefer live host; else production canonical. */
  function canonicalOrigin() {
    const origin = pageOrigin();
    try {
      const host = origin ? new URL(origin).hostname : "";
      if (isProductionHost(host)) return "https://www.floqr.com";
      if (origin && !isStagingHost(host)) return origin;
    } catch (_) { /* ignore */ }
    return PRODUCTION_ORIGIN;
  }

  /** Absolute URL on the canonical brand host (privacy, DNS). */
  function absoluteCanonicalPath(path) {
    const clean = String(path || "/").replace(/^\.\//, "/");
    const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
    return `${canonicalOrigin()}${withSlash}`;
  }

  /** Same-origin relative link for the current demo/staging host. */
  function localPath(path, version) {
    const file = String(path || "").replace(/^\.\//, "");
    const v = version != null && String(version).trim() !== ""
      ? `?v=${encodeURIComponent(String(version).trim())}`
      : "";
    return `./${file}${v}`;
  }

  global.FLOQRCanonical = {
    PRODUCTION_ORIGIN,
    canonicalOrigin,
    absoluteCanonicalPath,
    localPath,
    isStagingHost,
    isProductionHost,
    privacyPolicyUrl(version) {
      return localPath("privacy.html", version || global.FLOQRNav?.appVersion);
    },
    privacyPolicyCanonicalUrl() {
      return absoluteCanonicalPath("/privacy.html");
    },
    doNotSellCanonicalUrl() {
      return absoluteCanonicalPath("/privacy.html#do-not-sell");
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
