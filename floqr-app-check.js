/* FLOQR App Check (reCAPTCHA Enterprise, score-based).
   Site key is public by design. Do NOT put any reCAPTCHA secret in Pages code.
   Enforcement stays OFF until Master Admin reviews Console metrics. */
(function (global) {
  "use strict";

  const cfg = () => global.FLOQR_APP_CHECK || {};
  let activated = false;

  function siteKey() {
    return String(cfg().siteKey || global.FLOQR_APP_CHECK_SITE_KEY || "").trim();
  }

  function activate(options = {}) {
    if (activated || global.__FLOQR_APP_CHECK_READY) return {ok: true, skipped: "already-active"};
    if (cfg().enabled === false && options.force !== true) {
      return {ok: false, skipped: "disabled"};
    }
    const key = siteKey();
    if (!key) return {ok: false, skipped: "missing-site-key"};
    if (!global.firebase?.apps?.length) return {ok: false, skipped: "firebase-not-initialized"};
    if (!global.firebase.appCheck || !global.firebase.appCheck.ReCaptchaEnterpriseProvider) {
      return {ok: false, skipped: "app-check-sdk-missing"};
    }
    try {
      const appCheck = global.firebase.appCheck();
      appCheck.activate(
        new global.firebase.appCheck.ReCaptchaEnterpriseProvider(key),
        true
      );
      activated = true;
      global.__FLOQR_APP_CHECK_READY = true;
      return {ok: true, provider: "recaptcha-enterprise"};
    } catch (error) {
      console.warn("FLOQR App Check activate skipped:", error?.message || error);
      return {ok: false, error: String(error?.message || error)};
    }
  }

  function hookInitializeApp() {
    if (!global.firebase || typeof global.firebase.initializeApp !== "function") return;
    if (global.firebase.initializeApp.__floqrAppCheckHooked) return;
    const original = global.firebase.initializeApp.bind(global.firebase);
    function wrapped(config, name) {
      const app = original(config, name);
      try { activate(); } catch (_e) {}
      return app;
    }
    wrapped.__floqrAppCheckHooked = true;
    global.firebase.initializeApp = wrapped;
    if (global.firebase.apps?.length) activate();
  }

  hookInitializeApp();
  global.FLOQRAppCheck = {activate, hookInitializeApp};
})(window);
