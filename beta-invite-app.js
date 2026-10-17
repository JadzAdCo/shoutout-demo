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

  function showSuccess(show) {
    byId("betaSuccess")?.classList.toggle("hidden", !show);
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

  function featureLabels(keys) {
    return (Array.isArray(keys) ? keys : [])
      .map(key => (window.FLOQRFeatureServices?.CATALOG || []).find(row => row.key === key)?.label || key)
      .filter(Boolean);
  }

  function renderSuccess(features) {
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
        renderSuccess([]);
        setStatus(t("beta.alreadyJoined", "You already joined this beta invitation."));
      } else if (/Beta Test Agreement|Booking Transaction/i.test(message)) {
        setStatus(t(
          "beta.consentRequired",
          "Accept both the Beta Test Agreement and the Booking Transaction Disclaimer to join."
        ));
      } else {
        setStatus(t("beta.invalid", "This invitation link is invalid, expired, or was sent to a different account."));
        showActions(false);
      }
    } finally {
      busy = false;
      syncAcceptEnabled();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    byId("betaAcceptBtn")?.addEventListener("click", () => respond(true));
    byId("betaDeclineBtn")?.addEventListener("click", () => respond(false));
    ["betaCheckAgreement", "betaCheckBooking"].forEach(id => {
      byId(id)?.addEventListener("change", syncAcceptEnabled);
    });
    syncAcceptEnabled();

    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setStatus(t("beta.invalid", "This invitation link is invalid, expired, or was sent to a different account."));
      return;
    }

    const portal = byId("betaPortalLink");
    if (portal) portal.href = window.FLOQRNav?.portalHome?.({from: "beta-invite"}) || portal.href;

    const shell = window.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      statusEl: "#betaStatus",
      onUser: () => {
        byId("betaLogin")?.classList.add("hidden");
        showSuccess(false);
        showActions(true);
        setStatus(t(
          "beta.ready",
          "Signed in. Read the Agreement, accept both checkboxes, then I Agree and join beta."
        ));
        byId("betaActions")?.scrollIntoView?.({behavior: "smooth", block: "nearest"});
        syncAcceptEnabled();
      },
      onSignedOut: () => {
        byId("betaLogin")?.classList.remove("hidden");
        showActions(false);
        showSuccess(false);
        setStatus(t("beta.signIn", "Sign in with the account this invitation was sent to."));
      }
    });

    // If auth already resolved before bind listeners, still unlock the Agreement UI.
    shell?.ready?.then?.(user => {
      if (!user) return;
      if (byId("betaActions")?.classList.contains("hidden")) {
        byId("betaLogin")?.classList.add("hidden");
        showSuccess(false);
        showActions(true);
        setStatus(t(
          "beta.ready",
          "Signed in. Read the Agreement, accept both checkboxes, then I Agree and join beta."
        ));
        syncAcceptEnabled();
      }
    }).catch?.(() => {});
  });
})();
