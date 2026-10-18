/* Beta tester invitation landing (Inbox / email link). Design notes: .cursor/rules/design-notes-feature-services.mdc */
(function () {
  "use strict";

  const TOKEN_KEY = "FLOQR_BETA_INVITE_TOKEN";
  let token = "";
  let busy = false;
  let auth = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function t(key, fallback) {
    const value = window.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  }

  function isValidToken(value) {
    return /^[A-Za-z0-9_-]{43}$/.test(String(value || ""));
  }

  function storeToken(value) {
    if (!isValidToken(value)) return;
    try { sessionStorage.setItem(TOKEN_KEY, value); } catch (_) {}
    try { localStorage.setItem(TOKEN_KEY, value); } catch (_) {}
  }

  function clearStoredToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
  }

  function readStoredToken() {
    try {
      const session = sessionStorage.getItem(TOKEN_KEY) || "";
      if (isValidToken(session)) return session;
    } catch (_) {}
    try {
      const local = localStorage.getItem(TOKEN_KEY) || "";
      if (isValidToken(local)) return local;
    } catch (_) {}
    return "";
  }

  /** Invite `t=` must survive email WebViews (no Firebase session) → home OTP → returnTo. */
  function resolveInviteToken() {
    const fromUrl = new URLSearchParams(location.search).get("t") || "";
    if (isValidToken(fromUrl)) {
      storeToken(fromUrl);
      return fromUrl;
    }
    const stored = readStoredToken();
    if (isValidToken(stored)) {
      try {
        const url = new URL(location.href);
        url.searchParams.set("t", stored);
        if (!url.searchParams.get("from")) url.searchParams.set("from", "beta-invite");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      } catch (_) {}
      return stored;
    }
    return "";
  }

  function ensureAuth() {
    try {
      const fb = window.firebase;
      if (!fb || typeof fb.auth !== "function") return null;
      if (!fb.apps?.length && window.firebaseConfig) fb.initializeApp(window.firebaseConfig);
      return fb.auth();
    } catch (error) {
      console.warn("Beta invite could not start Firebase Auth", error?.message || error);
      return null;
    }
  }

  function setStatus(message) {
    const el = byId("betaStatus");
    if (!el) return;
    el.removeAttribute("data-i18n");
    el.textContent = message || "";
  }

  function showActions(show) {
    byId("betaActions")?.classList.toggle("hidden", !show);
  }

  function showSuccess(show) {
    byId("betaSuccess")?.classList.toggle("hidden", !show);
  }

  function showLogin(show) {
    byId("betaLogin")?.classList.toggle("hidden", !show);
  }

  function consentChecks() {
    return {
      betaAgreement: !!byId("betaCheckAgreement")?.checked,
      bookingDisclaimer: !!byId("betaCheckBooking")?.checked
    };
  }

  function syncAcceptEnabled() {
    const btn = byId("betaAcceptBtn");
    if (!btn) return;
    const checks = consentChecks();
    const ready = checks.betaAgreement && checks.bookingDisclaimer && !busy;
    btn.disabled = !ready;
  }

  function hideTokenFromAddressBar() {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("t");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function signInHref() {
    // Ensure `t` is on the current URL so loginHref's returnTo keeps the invite.
    if (isValidToken(token)) {
      try {
        const url = new URL(location.href);
        if (url.searchParams.get("t") !== token) {
          url.searchParams.set("t", token);
          if (!url.searchParams.get("from")) url.searchParams.set("from", "beta-invite");
          history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
      } catch (_) {}
    }
    return window.FLOQRSessionShell?.loginHref?.()
      || `./?profileRequired=sign-in&returnTo=${encodeURIComponent(`beta-invite.html?t=${token}&from=beta-invite`)}`;
  }

  function wireSignInLink() {
    const link = byId("betaSignInLink");
    if (!link) return;
    link.href = signInHref();
    link.removeAttribute("data-i18n");
    link.textContent = t("beta.signInCta", "Sign in to accept this invite");
  }

  function featureLabels(keys) {
    return (Array.isArray(keys) ? keys : [])
      .map(key => (window.FLOQRFeatureServices?.CATALOG || []).find(row => row.key === key)?.label || key)
      .filter(Boolean);
  }

  function renderSuccess(features) {
    showLogin(false);
    showActions(false);
    showSuccess(true);
    const labels = featureLabels(features);
    const body = byId("betaSuccessBody");
    if (body) {
      body.textContent = t(
        "beta.accepted",
        "You're a FLOQR beta tester. Beta features now appear on Search with a Beta label."
      );
    }
    const featEl = byId("betaSuccessFeatures");
    if (featEl) {
      featEl.textContent = labels.length
        ? `${t("beta.granted", "Features you can test:")} ${labels.join(", ")}`
        : "";
    }
    setStatus(t("beta.successStatus", "Joined — Agreement accepted and recorded."));
    const back = byId("floqrGlobalBack");
    if (back) {
      back.href = window.FLOQRNav?.searchHome?.() || "./?start=search";
      back.textContent = t("feature.backToSearch", "Back to Search");
    }
    const search = byId("betaSuccessSearch");
    if (search) search.href = window.FLOQRNav?.searchHome?.() || "./?start=search";
    const portal = byId("betaSuccessPortal");
    if (portal) portal.href = window.FLOQRNav?.portalHome?.({from: "beta-invite"}) || portal.href;
    byId("betaSuccess")?.scrollIntoView?.({behavior: "smooth", block: "start"});
  }

  async function respond(accept) {
    if (busy) return;
    if (!isValidToken(token)) {
      setStatus(t("beta.invalid", "This invitation link is invalid, expired, or was sent to a different account."));
      return;
    }
    if (!auth?.currentUser) {
      paintSignedOut();
      return;
    }
    if (accept) {
      const checks = consentChecks();
      if (!checks.betaAgreement || !checks.bookingDisclaimer) {
        setStatus(t(
          "beta.consentRequired",
          "Accept both the Beta Test Agreement and the Booking Transaction Disclaimer to join."
        ));
        syncAcceptEnabled();
        return;
      }
    }
    busy = true;
    syncAcceptEnabled();
    setStatus(t("beta.working", "Working…"));
    try {
      const fn = firebase.app().functions("us-central1").httpsCallable(accept ? "acceptBetaInvite" : "declineBetaInvite");
      const payload = accept ? {token, checks: consentChecks()} : {token};
      const result = (await fn(payload))?.data || {};
      clearStoredToken();
      hideTokenFromAddressBar();
      if (accept) {
        renderSuccess(result.features);
      } else {
        showActions(false);
        showSuccess(false);
        setStatus(t("beta.declined", "Invitation declined. Nothing changed on your account."));
      }
    } catch (error) {
      console.warn("Beta invite response failed", error?.code || "", error?.message || error);
      const message = String(error?.message || "");
      if (/Master Admins/.test(message)) {
        setStatus(t("beta.masterAdmin", "Master Admins open test features from Features & Services, not as beta testers."));
        showActions(false);
      } else if (/already joined/i.test(message)) {
        clearStoredToken();
        renderSuccess([]);
        setStatus(t("beta.alreadyJoined", "You already joined this beta invitation."));
      } else if (/Beta Test Agreement|Booking Transaction/i.test(message)) {
        setStatus(t(
          "beta.consentRequired",
          "Accept both the Beta Test Agreement and the Booking Transaction Disclaimer to join."
        ));
      } else if (/unauthenticated|sign in/i.test(message) || error?.code === "unauthenticated") {
        paintSignedOut();
      } else {
        setStatus(t("beta.invalid", "This invitation link is invalid, expired, or was sent to a different account."));
        showActions(false);
      }
    } finally {
      busy = false;
      syncAcceptEnabled();
    }
  }

  function unlockAgreementUi() {
    showLogin(false);
    showSuccess(false);
    showActions(true);
    setStatus(t(
      "beta.ready",
      "Signed in. Read the Agreement, accept both checkboxes, then I Agree and join beta."
    ));
    byId("betaActions")?.scrollIntoView?.({behavior: "smooth", block: "nearest"});
    syncAcceptEnabled();
  }

  function paintSignedOut() {
    showActions(false);
    showSuccess(false);
    showLogin(true);
    wireSignInLink();
    setStatus(t(
      "beta.sessionHandoff",
      "Email and private browsers do not keep your FLOQR login. Sign in with the invited account — you return here with this invite."
    ));
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    byId("betaAcceptBtn")?.addEventListener("click", () => respond(true));
    byId("betaDeclineBtn")?.addEventListener("click", () => respond(false));
    ["betaCheckAgreement", "betaCheckBooking"].forEach(id => {
      byId(id)?.addEventListener("change", syncAcceptEnabled);
    });
    syncAcceptEnabled();

    token = resolveInviteToken();
    if (!isValidToken(token)) {
      showLogin(false);
      showActions(false);
      setStatus(t("beta.invalid", "This invitation link is invalid, expired, or was sent to a different account."));
      return;
    }

    // Always wire the CTA first so a Firebase failure never leaves "Checking…" forever.
    wireSignInLink();
    auth = ensureAuth();
    if (!auth) {
      paintSignedOut();
      return;
    }

    const shell = window.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      statusEl: "#betaStatus",
      // Email WebViews rarely share IndexedDB with Safari — fail open to sign-in fast.
      timeoutMs: 2500,
      // Keep the invite CTA visible; shell still builds returnTo with `t` via loginHref.
      autoRedirect: false,
      onUser: () => unlockAgreementUi(),
      onSignedOut: () => paintSignedOut()
    });

    if (!shell) {
      paintSignedOut();
      return;
    }

    shell.ready?.then?.(user => {
      if (user) {
        if (byId("betaActions")?.classList.contains("hidden")) unlockAgreementUi();
        return;
      }
      paintSignedOut();
      // Soft redirect after a beat so the CTA is readable; returnTo keeps `t`.
      setTimeout(() => {
        if (auth?.currentUser) return;
        const href = signInHref();
        try { location.replace(href); } catch (_) { location.href = href; }
      }, 1200);
    }).catch?.(() => {
      paintSignedOut();
    });
  });
})();
