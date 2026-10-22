/* VIP reserV Terms — ShoutOut-style consent step before FloqR Stripe deposit. */
(function () {
  "use strict";

  const HOLD_KEY = "FLOQR_VIP_HOLD";

  const statusEl = document.getElementById("vipTermsStatus");
  const gateEl = document.getElementById("vipTermsGate");
  const appEl = document.getElementById("vipTermsApp");
  const summaryEl = document.getElementById("vipTermsHoldSummary");
  const backEl = document.getElementById("vipTermsBack");
  const payBtn = document.getElementById("vipConsentPay");

  let activeHold = null;
  let holdTimer = null;

  function t(key, fallback) {
    try {
      const v = window.FLOQRI18n?.t?.(key);
      if (v && v !== key) return v;
    } catch (_) { /* ignore */ }
    return fallback;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function money(cents) {
    return "$" + (Number(cents || 0) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function mapReturnUrl(hold) {
    const params = new URLSearchParams();
    if (hold?.clubLocationId) params.set("location", hold.clubLocationId);
    if (hold?.night) params.set("night", hold.night);
    const q = params.toString();
    return q ? `./vip.html?${q}` : "./vip.html";
  }

  function readHoldFromStorage() {
    try {
      const raw = sessionStorage.getItem(HOLD_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function clearHoldStorage() {
    try { sessionStorage.removeItem(HOLD_KEY); } catch (_) { /* ignore */ }
  }

  function loadHold() {
    const params = new URLSearchParams(location.search);
    const holdId = String(params.get("holdId") || "").trim();
    const stored = readHoldFromStorage();
    if (stored && (!holdId || stored.holdId === holdId)) return stored;
    if (stored && holdId && stored.holdId !== holdId) return null;
    return null;
  }

  function renderSummary() {
    if (!summaryEl || !activeHold) return;
    const tick = () => {
      if (!activeHold) return;
      const left = Math.max(0, Number(activeHold.expiresAtMs || 0) - Date.now());
      const mins = Math.floor(left / 60000);
      const secs = Math.floor((left % 60000) / 1000);
      const amounts = activeHold.amounts || {};
      summaryEl.innerHTML =
        `<strong>${esc(t("page.vip.holdActive", "Hold active"))}</strong> — ` +
        `${esc(activeHold.venueName || activeHold.clubLocationId || "")} · ` +
        `${esc(activeHold.sectionLabel || activeHold.sectionId)} · ${esc(activeHold.night)} · ` +
        `${esc(t("page.vip.payToday", "Pay today"))} ${money(amounts.chargedCents)} · ` +
        `<span id="vipTermsHoldClock">${mins}:${String(secs).padStart(2, "0")}</span>`;
      if (left <= 0) {
        if (holdTimer) clearInterval(holdTimer);
        holdTimer = null;
        clearHoldStorage();
        setStatus(t("page.vip.holdExpired", "Your hold expired. Pick a table again."));
        if (payBtn) payBtn.disabled = true;
        if (backEl) backEl.href = mapReturnUrl(activeHold);
      }
    };
    tick();
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = setInterval(tick, 1000);
  }

  let venueCollector = "floqrStripe";

  function depositRequiredForHold(hold) {
    if (Number(hold?.depositRequired) === 0) return false;
    if (Number(hold?.depositRequired) === 1) return true;
    return Number(hold?.amounts?.depositCents || hold?.amounts?.chargedCents || 0) > 0;
  }

  async function refreshCollector() {
    venueCollector = String(activeHold?.paymentCollector || "floqrStripe");
  }

  async function submitConsentAndPay() {
    if (!activeHold?.holdId) {
      setStatus(t("page.vipTerms.missingHold", "No active hold. Return to the floor map and hold a table first."));
      return;
    }
    const termsOk = !!document.getElementById("vipCheckTerms")?.checked;
    if (!termsOk) {
      setStatus(t("page.vip.consentRequired", "Accept the VIP reserV Terms before paying."));
      return;
    }
    const checks = {
      terms: true,
      marketing: !!document.getElementById("vipCheckMarketing")?.checked
    };
    setStatus(t("page.vip.recordingConsent", "Recording consent…"));
    if (payBtn) payBtn.disabled = true;
    try {
      await refreshCollector();
      const consentRes = await callable("recordVipConsent")({
        holdId: activeHold.holdId,
        checks
      });
      const consentId = consentRes.data?.consentId;
      if (venueCollector === "clubPos") {
        setStatus(t("page.vip.confirmingPos", "Reserving your table — deposit opens on the venue POS…"));
        await callable("confirmVipReservationForClubPos")({
          holdId: activeHold.holdId,
          consentId
        });
        try { sessionStorage.removeItem("FLOQR_VIP_HOLD"); } catch (_) { /* ignore */ }
        location.href = "./vip.html?vipPaid=1&collector=clubPos";
        return;
      }
      const needsDeposit = depositRequiredForHold(activeHold);
      if (!needsDeposit || venueCollector === "manualCsv") {
        if (!needsDeposit) {
          setStatus(t("page.vip.confirmingNoDeposit", "Confirming your table (no deposit required)…"));
          await callable("confirmVipReservationWithoutDeposit")({
            holdId: activeHold.holdId,
            consentId
          });
          try { sessionStorage.removeItem("FLOQR_VIP_HOLD"); } catch (_) { /* ignore */ }
          location.href = "./vip.html?vipPaid=1";
          return;
        }
      }
      setStatus(t("page.vip.openingCheckout", "Opening deposit checkout…"));
      const pay = await callable("createFloqrCheckoutSession")({
        orderType: "vipReservation",
        payload: {holdId: activeHold.holdId, consentId}
      });
      const url = pay.data?.checkoutUrl;
      if (!url) throw new Error("Checkout URL missing");
      location.href = url;
    } catch (err) {
      if (payBtn) payBtn.disabled = false;
      const msg = err?.message || String(err);
      setStatus(msg.replace(/^.*?:\s*/, "") || t("page.vip.checkoutFailed", "Checkout could not start."));
    }
  }

  function showApp() {
    if (gateEl) gateEl.classList.add("hidden");
    activeHold = loadHold();
    if (!activeHold?.holdId) {
      if (appEl) appEl.classList.add("hidden");
      setStatus(t("page.vipTerms.missingHold", "No active hold. Return to the floor map and hold a table first."));
      if (backEl) backEl.href = "./vip.html";
      return;
    }
    if (appEl) appEl.classList.remove("hidden");
    if (backEl) backEl.href = mapReturnUrl(activeHold);
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack", {href: mapReturnUrl(activeHold)});
    renderSummary();
    refreshCollector().then(() => {
      const needsDeposit = depositRequiredForHold(activeHold);
      if (payBtn) {
        if (venueCollector === "clubPos") {
          payBtn.textContent = t("page.vip.consentPos", "Confirm — pay on venue POS");
        } else {
          payBtn.textContent = needsDeposit
            ? t("page.vip.consentPay", "Pay deposit")
            : t("page.vip.consentConfirm", "Confirm reservation");
        }
      }
      if (venueCollector === "clubPos") {
        setStatus(t("page.vipTerms.readyPos", "Read the Terms, then confirm. FLOQR holds your table; deposit and tab open on the club POS when you arrive."));
      } else {
        setStatus(needsDeposit
          ? t("page.vipTerms.ready", "Read the Terms, accept once, then pay the deposit.")
          : t("page.vipTerms.readyNoDeposit", "Read the Terms, accept once, then confirm — this venue does not require a deposit before the table is booked."));
      }
    });
  }

  async function hydrateSiteChrome(user) {
    const cs = window.FLOQRChromeScheme;
    if (!cs) return;
    try {
      cs.syncAccessGate?.();
      if (!user?.uid || !firebase?.firestore) {
        cs.applyDocument?.(cs.effectiveChrome?.());
        return;
      }
      const snap = await firebase.firestore().collection("users").doc(user.uid).get();
      if (snap.exists) cs.hydrateFromProfile?.(snap.data() || {});
      else cs.applyDocument?.(cs.effectiveChrome?.());
    } catch (_) {
      try { cs.syncAccessGate?.(); } catch (__) { /* ignore */ }
    }
  }

  function boot() {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    try { window.FLOQRI18n?.apply?.(document); } catch (_) { /* ignore */ }
    try { window.FLOQRChromeScheme?.syncAccessGate?.(); } catch (_) { /* ignore */ }

    const profileLink = document.getElementById("vipTermsOpenProfile");
    if (profileLink && window.FLOQRNav?.portalHome) {
      profileLink.href = window.FLOQRNav.portalLink
        ? window.FLOQRNav.portalLink({tab: "guest-list-reserv"})
        : (window.FLOQRNav.portalHome() + (window.FLOQRNav.portalHome().includes("?") ? "&" : "?") + "tab=guest-list-reserv");
    }

    payBtn?.addEventListener("click", submitConsentAndPay);

    if (!window.FLOQRSessionShell?.bind) {
      setStatus(t("page.vip.shellMissing", "Session shell missing — hard refresh and try again."));
      return;
    }

    window.FLOQRSessionShell.bind({
      auth: firebase.auth(),
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#vipTermsStatus",
      onUser: user => {
        if (!user) {
          if (appEl) appEl.classList.add("hidden");
          if (gateEl) gateEl.classList.remove("hidden");
          setStatus(t("page.vip.needSignIn", "Sign in to explore VIP reserV floor maps."));
          return;
        }
        Promise.resolve(hydrateSiteChrome(user)).finally(() => showApp());
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
