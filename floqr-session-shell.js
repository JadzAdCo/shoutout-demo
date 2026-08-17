/* FLOQRSessionShell — satellite / iframe pages inherit the existing FLOQR session.
   Never treat an embedded or deep-linked page as a fresh Google-only gate. */
(function (root) {
  "use strict";

  const SIGNED_OUT_EMBED =
    "You're signed in on FLOQR My Profile — restoring that session here. If this stays blank, refresh My Profile (not Google on this panel).";
  const SIGNED_OUT_STANDALONE =
    "Sign in with the same FLOQR account you use on Search / My Profile (email, phone, or Google). This page shares that session.";

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
    const v = params().get("v") || "s3.0.3";
    const next = new URL("./patron-portal.html", location.href);
    next.searchParams.set("v", v);
    next.searchParams.set("from", "session-shell");
    return `${next.pathname}${next.search}`;
  }

  function popupBlocked(statusEl) {
    if (!isEmbedded()) return false;
    setStatus(statusEl, "Sign in on My Profile & Settings first. Google popups are not used inside this panel.");
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
        const p = document.createElement("p");
        p.className = "sub small";
        p.setAttribute("data-floqr-session-portal-link", "1");
        p.innerHTML = `<a class="buttonlike" href="${portalSignInHref()}" target="_parent" rel="noopener">Open My Profile &amp; Settings</a>`;
        host.appendChild(p);
      }
      setStatus(statusEl, SIGNED_OUT_EMBED);
    } else {
      setHidden(chrome, false);
      setHidden(loginButtons, false);
      setStatus(statusEl, SIGNED_OUT_STANDALONE);
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
    setStatus(options.statusEl, options.restoringMessage || "Restoring your FLOQR session…");
    paintAuthChrome({
      chrome: options.chrome,
      loginButtons: options.loginButtons,
      statusEl: options.statusEl,
      user: auth.currentUser
    });

    const ready = waitForUser(auth).then(user => {
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

  root.FLOQRSessionShell = {
    isEmbedded,
    waitForUser,
    bind,
    applyEmbedChrome,
    portalSignInHref,
    popupBlocked
  };
})(typeof window !== "undefined" ? window : globalThis);
