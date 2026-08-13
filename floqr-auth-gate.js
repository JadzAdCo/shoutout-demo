/* FLOQR auth gate — private pages redirect to home login (all methods). */
(function () {
  "use strict";

  const path = String(window.location.pathname.split("/").pop() || "").toLowerCase();
  const PUBLIC = new Set([
    "", "index.html",
    "display.html", "display2.html", "display-error.html", "displays.html",
    "club-profile.html", "role-profiles.html", "rydr.html", "floqai-search.html",
    "payment-return.html", "auth-debug.html"
  ]);
  const IS_PREVIEW = /preview|popout|seed|migration|feature-tests|onboard-dc|jersey-preview|heist-|bartr-ui|rydr-icon|rydr-logo|ad-campaign|mobile-test/i.test(path);
  const IS_MASTER = path === "master-admin.html";
  const IS_HOME = path === "" || path === "index.html";

  if (window.FLOQR_AUTH_GATE_DISABLED || PUBLIC.has(path) || IS_PREVIEW || IS_HOME) return;

  function returnPath() {
    const file = window.location.pathname.split("/").pop() || "index.html";
    return `${file}${window.location.search || ""}${window.location.hash || ""}`;
  }

  function safeReturnTo(value) {
    const raw = String(value || "").trim();
    if (!raw || raw.startsWith("http") || raw.startsWith("//") || raw.includes("://")) return "";
    if (raw.startsWith("./")) return raw.slice(2);
    if (raw.startsWith("/")) return raw.replace(/^\/+/, "");
    return raw;
  }

  function loginUrl(reason) {
    const params = new URLSearchParams();
    const ret = safeReturnTo(returnPath());
    if (ret) params.set("returnTo", ret);
    if (reason) params.set("authRequired", reason);
    // Prefer FLOQRNav version when present; otherwise leave unversioned.
    try {
      const v = window.FLOQRNav?.appVersion;
      if (v) params.set("v", v);
    } catch (_) {}
    const q = params.toString();
    return `./${q ? `?${q}` : ""}`;
  }

  function redirectToLogin(reason) {
    if (IS_MASTER) return; // Master Admin keeps its own allow-listed providers UI
    window.location.replace(loginUrl(reason || "sign-in"));
  }

  function boot() {
    if (!window.firebase?.auth || !window.firebaseConfig) {
      // Firebase not ready yet — retry briefly
      setTimeout(boot, 50);
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
    } catch (_) {}
    const auth = firebase.auth();
    let settled = false;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      if (!user) redirectToLogin("sign-in");
      else {
        window.FLOQRAuthGate = {signedIn: true, uid: user.uid};
        window.dispatchEvent(new CustomEvent("floqr:auth-gate-ready", {detail: {user}}));
      }
    };
    // Prefer authStateReady when available so we don't flash private UI.
    const ready = typeof auth.authStateReady === "function" ? auth.authStateReady() : Promise.resolve();
    ready.then(() => {
      if (auth.currentUser) finish(auth.currentUser);
      else {
        const unsub = auth.onAuthStateChanged((user) => {
          unsub?.();
          finish(user);
        });
        // Safety timeout: if still no user, redirect
        setTimeout(() => {
          if (!settled && !auth.currentUser) finish(null);
        }, 2500);
      }
    }).catch(() => finish(auth.currentUser || null));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
