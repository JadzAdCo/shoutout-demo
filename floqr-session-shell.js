/* FLOQRSessionShell — satellite / iframe pages inherit the existing FLOQR session.
   Never treat an embedded or deep-linked page as a fresh Google-only gate. */
(function (root) {
  "use strict";

  const COPY = {
    "session.embedSignedOut":
      "You're signed in on FLOQR My Profile — restoring that session here. If this stays blank, refresh My Profile (not Google on this panel).",
    "session.standaloneSignedOut":
      "Opening the FLOQR sign-in page. After you sign in, you come straight back here.",
    "session.restoring": "Restoring your FLOQR session…",
    "session.openMyProfile": "Open My Profile & Settings",
    "session.popupBlocked": "Sign in on My Profile & Settings first. Google popups are not used inside this panel."
  };

  function t(key) {
    try {
      const out = root.FLOQRI18n?.t?.(key);
      if (out && out !== key) return out;
    } catch (_error) { /* fall back to English */ }
    return COPY[key];
  }

  function params() {
    try {
      return new URL(location.href).searchParams;
    } catch (_error) {
      return new URLSearchParams();
    }
  }

  function isEmbedded() {
    const q = params();
    if (q.get("embed") === "1" || q.get("embedded") === "1") return true;
    if (String(q.get("from") || "") === "portal") return true;
    try {
      return root.self !== root.top;
    } catch (_error) {
      return true;
    }
  }

  function resolveEls(targets) {
    const list = Array.isArray(targets) ? targets : (targets ? [targets] : []);
    return list.map(item => {
      if (!item) return null;
      if (typeof item === "string") return document.querySelector(item);
      return item;
    }).filter(Boolean);
  }

  function setHidden(els, hidden) {
    resolveEls(els).forEach(el => {
      el.classList.toggle("hidden", !!hidden);
      el.hidden = !!hidden;
      if (hidden) el.setAttribute("aria-hidden", "true");
      else el.removeAttribute("aria-hidden");
    });
  }

  function setStatus(statusEl, message) {
    const el = typeof statusEl === "string" ? document.querySelector(statusEl) : statusEl;
    if (el) el.textContent = message || "";
  }

  function portalSignInHref() {
    const next = new URL("./patron-portal.html", location.href);
    next.searchParams.set("from", "session-shell");
    return `${next.pathname}${next.search}`;
  }

  function isLoginOrPublicPage() {
    const file = String(location.pathname || "").split("/").pop() || "index.html";
    if (/^(?:index|display2?|display-error|privacy|translation-policy|auth-debug)\.html$/i.test(file)) return true;
    return document.body?.hasAttribute("data-floqr-public") === true;
  }

  /** General FLOQR sign-in (Search Welcome card: every provider + OTP). Returns here after sign-in. */
  function loginHref() {
    const file = String(location.pathname || "").split("/").pop() || "index.html";
    const q = new URLSearchParams();
    const back = new URLSearchParams(location.search);
    back.delete("v");
    const backSearch = back.toString();
    q.set("profileRequired", "sign-in");
    q.set("returnTo", `${file}${backSearch ? `?${backSearch}` : ""}${location.hash}`);
    return `./?${q.toString()}`;
  }

  /** Standalone only: an iframe must never navigate itself to the sign-in page. */
  function redirectToLogin() {
    if (isEmbedded() || isLoginOrPublicPage()) return false;
    location.replace(loginHref());
    return true;
  }

  function popupBlocked(statusEl) {
    if (!isEmbedded()) return false;
    setStatus(statusEl, t("session.popupBlocked"));
    return true;
  }

  function applyEmbedChrome() {
    if (!isEmbedded()) return;
    document.documentElement.classList.add("floqr-embed-mode");
    document.body?.classList.add("floqr-embed-mode");
    setHidden(["#floqrGlobalBack", ".global-back-btn"], true);
  }

  function paintAuthChrome({chrome, loginButtons, statusEl, user}) {
    const embedded = isEmbedded();
    if (user) {
      document.documentElement.classList.add("floqr-session-ready");
      document.documentElement.classList.remove("floqr-session-signed-out");
      setHidden(chrome, true);
      setHidden(loginButtons, true);
      return;
    }
    document.documentElement.classList.remove("floqr-session-ready");
    document.documentElement.classList.add("floqr-session-signed-out");
    if (embedded) {
      // Popups are unreliable inside iframes; never push Google as the path.
      setHidden(loginButtons, true);
      setHidden(chrome, false);
      const host = resolveEls(chrome)[0];
      if (host && !host.querySelector("[data-floqr-session-portal-link]")) {
        // A plain status line, never `p.sub.small` (helper-popouts would turn it into a `?` on the hero h1).
        const p = document.createElement("p");
        p.className = "floqr-session-hint small";
        p.dataset.keepVisible = "true";
        p.setAttribute("data-floqr-session-portal-link", "1");
        const a = document.createElement("a");
        a.className = "buttonlike";
        a.href = portalSignInHref();
        a.target = "_parent";
        a.rel = "noopener";
        a.textContent = t("session.openMyProfile");
        p.appendChild(a);
        host.appendChild(p);
      }
      setStatus(statusEl, t("session.embedSignedOut"));
    } else {
      // Standalone pages hand off to the general sign-in (every provider + OTP), never a page-local Google button.
      setHidden(chrome, false);
      setHidden(loginButtons, true);
      setStatus(statusEl, t("session.standaloneSignedOut"));
    }
  }

  function waitForUser(auth, {timeoutMs = 8000} = {}) {
    if (!auth) return Promise.resolve(null);
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    if (typeof auth.authStateReady === "function") {
      return Promise.race([
        auth.authStateReady().then(() => auth.currentUser || null),
        new Promise(resolve => setTimeout(() => resolve(auth.currentUser || null), timeoutMs))
      ]);
    }
    return new Promise(resolve => {
      let done = false;
      const finish = user => {
        if (done) return;
        done = true;
        try { unsub(); } catch (_error) { /* ignore */ }
        resolve(user || null);
      };
      const unsub = auth.onAuthStateChanged(user => finish(user));
      setTimeout(() => finish(auth.currentUser || null), timeoutMs);
    });
  }

  /**
   * @param {object} options
   * @param {firebase.auth.Auth} options.auth
   * @param {string|Element|Array} [options.chrome] — account / login card(s) to hide when signed in
   * @param {string|Element|Array} [options.loginButtons] — Google/Microsoft buttons
   * @param {string|Element} [options.statusEl]
   * @param {function} [options.onUser]
   * @param {function} [options.onSignedOut]
   * @param {string} [options.restoringMessage]
   */
  function bind(options = {}) {
    const auth = options.auth;
    if (!auth) return {embedded: isEmbedded(), ready: Promise.resolve(null)};
    applyEmbedChrome();
    setStatus(options.statusEl, options.restoringMessage || t("session.restoring"));
    if (auth.currentUser) {
      paintAuthChrome({chrome: options.chrome, loginButtons: options.loginButtons, statusEl: options.statusEl, user: auth.currentUser});
    } else {
      setHidden(options.loginButtons, true);
    }

    const ready = waitForUser(auth, {timeoutMs: 15000}).then(user => {
      if (!user && redirectToLogin()) return null;
      paintAuthChrome({
        chrome: options.chrome,
        loginButtons: options.loginButtons,
        statusEl: options.statusEl,
        user
      });
      return user;
    });

    auth.onAuthStateChanged(user => {
      paintAuthChrome({
        chrome: options.chrome,
        loginButtons: options.loginButtons,
        statusEl: options.statusEl,
        user
      });
      if (user) options.onUser?.(user);
      else options.onSignedOut?.();
    });

    return {embedded: isEmbedded(), ready, isEmbedded, waitForUser: () => waitForUser(auth)};
  }

  const APP_WAIT_MS = 4000;

  function waitForFirebaseApp() {
    return new Promise(resolve => {
      const started = Date.now();
      (function poll() {
        const fb = root.firebase;
        if (fb?.apps?.length && typeof fb.auth === "function") return resolve(fb.auth());
        if (Date.now() - started > APP_WAIT_MS) return resolve(null);
        setTimeout(poll, 100);
      })();
    });
  }

  /** Every satellite that loads this file requires a FLOQR session, even if the page never calls bind(). */
  async function requireSignIn() {
    if (isEmbedded() || isLoginOrPublicPage()) return;
    const auth = await waitForFirebaseApp();
    if (!auth) return;
    const user = await waitForUser(auth, {timeoutMs: 15000});
    if (!user) redirectToLogin();
  }

  if (typeof document !== "undefined" && typeof location !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", requireSignIn);
    else setTimeout(requireSignIn, 0);
  }

  root.FLOQRSessionShell = {
    isEmbedded,
    waitForUser,
    bind,
    applyEmbedChrome,
    portalSignInHref,
    popupBlocked,
    loginHref,
    redirectToLogin,
    requireSignIn
  };
})(typeof window !== "undefined" ? window : globalThis);
