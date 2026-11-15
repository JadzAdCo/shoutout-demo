/* FloqR OIDC authorize — reuses the current FloqR session. No parallel signup. */
(function (global) {
  "use strict";

  let continuing = false;

  function t(key, fallback) {
    return global.FLOQRI18n?.t?.(key) || fallback;
  }
  function byId(id) {
    return document.getElementById(id);
  }
  function setStatus(msg, kind) {
    ["oidcStatus", "oidcConsentStatus"].forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.textContent = msg || "";
      el.classList.toggle("is-error", kind === "error");
      el.classList.toggle("is-busy", kind === "busy");
    });
  }
  function params() {
    return Object.fromEntries(new URLSearchParams(location.search));
  }

  function oidcErrorMessage(err) {
    const code = String(err?.code || "").toLowerCase();
    const msg = String(err?.message || err || "");
    const blob = `${code} ${msg}`;
    if (/unauthenticated|auth\/?/.test(blob) && /sign.?in|unauth/i.test(blob)) {
      return t("page.sinema.signInHint", "Sign in on Search / My Profile to continue. This page reuses your FloqR session — there is no second signup.");
    }
    if (/not-found|unimplemented|internal|404|not found/.test(blob)) {
      return t(
        "page.oidc.statusUnavailable",
        "Continue did not complete. FloqR authorize is not live yet."
      );
    }
    return msg || t("page.oidc.statusUnavailable", "Continue did not complete. FloqR authorize is not live yet.");
  }

  function showConsent(user) {
    byId("oidcGate")?.classList.add("hidden");
    byId("oidcConsent")?.classList.remove("hidden");
    const line = byId("oidcUserLine");
    if (line) line.textContent = user.displayName || user.email || user.uid;
    if (!continuing) {
      setStatus(t("page.oidc.statusReady", "Signed in. Continue to send FloqMedia an authorization code."));
    }
  }

  function setContinueBusy(busy) {
    const btn = byId("oidcContinueBtn");
    if (!btn) return;
    btn.disabled = !!busy;
    btn.classList.toggle("is-busy", !!busy);
    btn.setAttribute("aria-busy", busy ? "true" : "false");
    btn.textContent = busy
      ? t("page.oidc.statusWorking", "Sending you to Spatial Studio…")
      : t("page.oidc.continue", "Continue");
  }

  async function continueOidc() {
    if (continuing) return;
    continuing = true;
    setContinueBusy(true);
    setStatus(t("page.oidc.statusWorking", "Sending you to Spatial Studio…"), "busy");
    try {
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
    } catch (err) {
      continuing = false;
      setContinueBusy(false);
      setStatus(oidcErrorMessage(err), "error");
    }
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
      setStatus(t("page.oidc.wrongClient", "This sign-in is only for FloqMedia Spatial Studio."), "error");
    }
    byId("oidcContinueBtn")?.addEventListener("click", () => {
      continueOidc();
    });
    byId("oidcDenyBtn")?.addEventListener("click", deny);
    if (!global.FLOQRSessionShell) {
      setStatus("Session shell missing.", "error");
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
