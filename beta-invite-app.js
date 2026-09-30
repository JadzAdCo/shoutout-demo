/* Beta tester invitation landing (Inbox link). Design notes: .cursor/rules/design-notes-feature-services.mdc */
(function () {
  "use strict";

  const auth = firebase.auth();
  const token = new URLSearchParams(location.search).get("t") || "";
  let busy = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function t(key, fallback) {
    const value = window.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  }

  function setStatus(message) {
    const el = byId("betaStatus");
    if (el) el.textContent = message || "";
  }

  function showActions(show) {
    byId("betaActions")?.classList.toggle("hidden", !show);
  }

  function hideTokenFromAddressBar() {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("t");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  async function respond(accept) {
    if (busy) return;
    busy = true;
    setStatus(t("beta.working", "Working…"));
    try {
      const fn = firebase.app().functions("us-central1").httpsCallable(accept ? "acceptBetaInvite" : "declineBetaInvite");
      const result = (await fn({token}))?.data || {};
      showActions(false);
      hideTokenFromAddressBar();
      const labels = (Array.isArray(result.features) ? result.features : [])
        .map(key => (window.FLOQRFeatureServices?.CATALOG || []).find(row => row.key === key)?.label || key);
      setStatus(accept
        ? [t("beta.accepted", "You're a FLOQR beta tester. Beta features now appear on Search with a Beta label."),
          labels.length ? `${t("beta.granted", "Features you can test:")} ${labels.join(", ")}` : ""].filter(Boolean).join(" ")
        : t("beta.declined", "Invitation declined. Nothing changed on your account."));
      if (accept) {
        const back = byId("floqrGlobalBack");
        if (back) {
          back.href = window.FLOQRNav?.searchHome?.() || "./?start=search";
          back.textContent = t("feature.backToSearch", "Back to Search");
        }
      }
    } catch (error) {
      console.warn("Beta invite response failed", error?.code || "", error?.message || error);
      setStatus(/Master Admins/.test(String(error?.message || ""))
        ? t("beta.masterAdmin", "Master Admins open test features from Features & Services, not as beta testers.")
        : t("beta.invalid", "This invitation link is invalid, expired, or was sent to a different account."));
      showActions(false);
    } finally {
      busy = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    byId("betaAcceptBtn")?.addEventListener("click", () => respond(true));
    byId("betaDeclineBtn")?.addEventListener("click", () => respond(false));
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setStatus(t("beta.invalid", "This invitation link is invalid, expired, or was sent to a different account."));
      return;
    }
    const portal = byId("betaPortalLink");
    if (portal) portal.href = window.FLOQRNav?.portalHome?.({from: "beta-invite"}) || portal.href;
    window.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      statusEl: "#betaStatus",
      onUser: () => {
        byId("betaLogin")?.classList.add("hidden");
        showActions(true);
        setStatus("");
      },
      onSignedOut: () => {
        byId("betaLogin")?.classList.remove("hidden");
        showActions(false);
        setStatus(t("beta.signIn", "Sign in with the account this invitation was sent to."));
      }
    });
  });
})();
