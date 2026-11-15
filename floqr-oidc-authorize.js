/* FloqR OIDC authorize — reuses the current FloqR session. No parallel signup. */
(function (global) {
  "use strict";

  function t(key, fallback) {
    return global.FLOQRI18n?.t?.(key) || fallback;
  }
  function byId(id) {
    return document.getElementById(id);
  }
  function setStatus(msg) {
    const el = byId("oidcStatus");
    if (el) el.textContent = msg || "";
  }
  function params() {
    return Object.fromEntries(new URLSearchParams(location.search));
  }

  function showConsent(user) {
    byId("oidcGate")?.classList.add("hidden");
    byId("oidcConsent")?.classList.remove("hidden");
    const line = byId("oidcUserLine");
    if (line) line.textContent = user.displayName || user.email || user.uid;
    setStatus(t("page.oidc.statusReady", "Signed in. Continue to send FloqMedia an authorization code."));
  }

  async function continueOidc() {
    const fn = firebase.app().functions("us-central1").httpsCallable("issueFloqrOidcAuthCode");
    const q = params();
    const guest = byId("oidcGuestConfirm");
    const res = await fn({
      client_id: q.client_id,
      redirect_uri: q.redirect_uri,
      response_type: q.response_type,
      scope: q.scope,
      code_challenge: q.code_challenge,
      code_challenge_method: q.code_challenge_method,
      state: q.state,
      nonce: q.nonce,
      attachGuestDraft: !!(guest && guest.checked)
    });
    const redirect = res?.data?.redirect;
    if (!redirect) throw new Error("missing_redirect");
    location.replace(redirect);
  }

  function deny() {
    const q = params();
    try {
      const url = new URL(q.redirect_uri);
      const host = url.hostname;
      const allowed = host === "www.floqmedia.com" || host === "floqmedia.com"
        || ((host === "localhost" || host === "127.0.0.1") && url.pathname === "/spatial-studio/auth/callback");
      if (!allowed || url.pathname !== "/spatial-studio/auth/callback") {
        location.replace("./");
        return;
      }
      if (q.state) url.searchParams.set("state", q.state);
      url.searchParams.set("error", "access_denied");
      location.replace(url.toString());
    } catch (_) {
      location.replace("./");
    }
  }

  function boot() {
    if (global.FLOQRNav?.applyGlobalBack) global.FLOQRNav.applyGlobalBack();
    if (global.FLOQRI18n?.apply) global.FLOQRI18n.apply(document);
    if (!global.firebase?.apps?.length && global.firebaseConfig) firebase.initializeApp(global.firebaseConfig);
    const q = params();
    if (q.client_id && q.client_id !== "floqmedia-spatial-studio") {
      setStatus(t("page.oidc.wrongClient", "This sign-in is only for FloqMedia Spatial Studio."));
    }
    byId("oidcContinueBtn")?.addEventListener("click", () => {
      continueOidc().catch((err) => setStatus(err.message || String(err)));
    });
    byId("oidcDenyBtn")?.addEventListener("click", deny);
    if (!global.FLOQRSessionShell) {
      setStatus("Session shell missing.");
      return;
    }
    global.FLOQRSessionShell.bind({
      auth: firebase.auth(),
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#oidcStatus",
      onUser: (user) => {
        if (global.FLOQRSessionShell.popupBlocked?.("#oidcStatus")) return;
        showConsent(user);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
