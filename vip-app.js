/* VIP ReserV Phase 2 — venue → night → hold → consent → Checkout deposit. */
(function () {
  "use strict";

  const BETA_VENUES = [
    {id: "decades-washington-dc", label: "Decades", plan: "decades.json", hint: "Washington, DC"},
    {id: "lima-twist-washington-dc", label: "Lima Twist Club", plan: "lima-twist.json", hint: "Washington, DC"},
    {id: "temp-democlub-1", label: "Aurelia", plan: null, hint: "Demo club — 3D demo; 2D map Phase 1.1", pending: true}
  ];

  const statusEl = document.getElementById("vipStatus");
  const gateEl = document.getElementById("vipGate");
  const appEl = document.getElementById("vipApp");
  const chipsEl = document.getElementById("vipVenueChips");
  const mapTitle = document.getElementById("vipMapTitle");
  const nightEl = document.getElementById("vipNight");
  const holdBanner = document.getElementById("vipHoldBanner");
  const consentEl = document.getElementById("vipConsent");
  let currentVenue = null;
  let currentUser = null;
  let activeHold = null;
  let holdTimer = null;
  let consentId = null;

  function t(key, fallback) {
    try {
      const v = window.FLOQRI18n?.t?.(key);
      if (v && v !== key) return v;
    } catch (_) { /* ignore */ }
    return fallback;
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function money(cents) {
    return "$" + (Number(cents || 0) / 100).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  function fillNights() {
    if (!nightEl) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    nightEl.innerHTML = "";
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(today.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const opt = document.createElement("option");
      opt.value = iso;
      opt.textContent = d.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"});
      nightEl.appendChild(opt);
    }
  }

  function selectedNight() {
    return nightEl?.value || new Date().toISOString().slice(0, 10);
  }

  async function refreshAvailability() {
    if (!currentVenue || currentVenue.pending || !currentUser) return;
    try {
      const res = await callable("getVipAvailability")({
        clubLocationId: currentVenue.id,
        night: selectedNight()
      });
      const sections = res.data?.sections || [];
      const states = {};
      sections.forEach(s => {
        if (s.status === "booked") states[s.sectionId] = "booked";
        else if (s.status === "held") states[s.sectionId] = "held";
        else if (s.status === "closed") states[s.sectionId] = "notBookable";
      });
      window.FLOQRVipFloorViewer?.setStates?.(states);
    } catch (err) {
      console.warn("VIP availability", err);
    }
  }

  function clearHoldUi() {
    activeHold = null;
    consentId = null;
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = null;
    if (holdBanner) {
      holdBanner.classList.add("hidden");
      holdBanner.innerHTML = "";
    }
    if (consentEl) consentEl.classList.add("hidden");
  }

  function renderHoldBanner() {
    if (!holdBanner || !activeHold) return;
    holdBanner.classList.remove("hidden");
    const tick = () => {
      const left = Math.max(0, Number(activeHold.expiresAtMs || 0) - Date.now());
      const mins = Math.floor(left / 60000);
      const secs = Math.floor((left % 60000) / 1000);
      const amounts = activeHold.amounts || {};
      holdBanner.innerHTML =
        `<strong data-i18n-skip>${t("page.vip.holdActive", "Hold active")}</strong> — ` +
        `${activeHold.sectionLabel || activeHold.sectionId} · ${activeHold.night} · ` +
        `${t("page.vip.payToday", "Pay today")} ${money(amounts.chargedCents)} · ` +
        `<span id="vipHoldClock">${mins}:${String(secs).padStart(2, "0")}</span>` +
        ` <button type="button" id="vipReleaseHold" class="buttonlike">${t("page.vip.releaseHold", "Release hold")}</button>` +
        ` <button type="button" id="vipContinueConsent" class="primary">${t("page.vip.continueTerms", "Accept Terms & pay")}</button>`;
      document.getElementById("vipReleaseHold")?.addEventListener("click", releaseHold);
      document.getElementById("vipContinueConsent")?.addEventListener("click", showConsent);
      if (left <= 0) {
        clearHoldUi();
        setStatus(t("page.vip.holdExpired", "Your hold expired. Pick a table again."));
        refreshAvailability();
      }
    };
    tick();
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = setInterval(tick, 1000);
  }

  function showConsent() {
    if (!consentEl || !activeHold) return;
    consentEl.classList.remove("hidden");
    consentEl.scrollIntoView({block: "nearest", behavior: "smooth"});
  }

  async function releaseHold() {
    if (!activeHold?.holdId) return;
    try {
      await callable("releaseVipHold")({holdId: activeHold.holdId});
    } catch (err) {
      console.warn(err);
    }
    clearHoldUi();
    setStatus(t("page.vip.holdReleased", "Hold released."));
    refreshAvailability();
  }

  async function createHold({sectionId, partySize}) {
    if (!currentVenue || currentVenue.pending) return;
    setStatus(t("page.vip.holding", "Holding your table…"));
    try {
      const res = await callable("createVipHold")({
        clubLocationId: currentVenue.id,
        night: selectedNight(),
        sectionId,
        partySize
      });
      activeHold = res.data;
      consentId = null;
      renderHoldBanner();
      showConsent();
      setStatus(t("page.vip.holdReady", "Table held for 30 minutes. Accept Terms, then pay the deposit."));
      refreshAvailability();
    } catch (err) {
      const msg = err?.message || err?.details || String(err);
      setStatus(msg.replace(/^.*?:\s*/, "") || t("page.vip.holdFailed", "Could not hold that table."));
    }
  }

  async function submitConsentAndPay() {
    if (!activeHold?.holdId) return;
    const checks = {
      terms: !!document.getElementById("vipCheckTerms")?.checked,
      refund: !!document.getElementById("vipCheckRefund")?.checked,
      noShow: !!document.getElementById("vipCheckNoShow")?.checked,
      age21: !!document.getElementById("vipCheckAge")?.checked,
      minimumSpend: !!document.getElementById("vipCheckMinimum")?.checked,
      marketing: !!document.getElementById("vipCheckMarketing")?.checked
    };
    if (!checks.terms || !checks.refund || !checks.noShow || !checks.age21 || !checks.minimumSpend) {
      setStatus(t("page.vip.consentRequired", "Check all required Terms boxes before paying."));
      return;
    }
    setStatus(t("page.vip.recordingConsent", "Recording consent…"));
    try {
      const consentRes = await callable("recordVipConsent")({
        holdId: activeHold.holdId,
        checks
      });
      consentId = consentRes.data?.consentId;
      setStatus(t("page.vip.openingCheckout", "Opening deposit checkout…"));
      const pay = await callable("createFloqrCheckoutSession")({
        orderType: "vipReservation",
        payload: {holdId: activeHold.holdId, consentId}
      });
      const url = pay.data?.checkoutUrl;
      if (!url) throw new Error("Checkout URL missing");
      location.href = url;
    } catch (err) {
      const msg = err?.message || String(err);
      setStatus(msg.replace(/^.*?:\s*/, "") || t("page.vip.checkoutFailed", "Checkout could not start."));
    }
  }

  function showApp(user) {
    currentUser = user;
    if (gateEl) gateEl.classList.add("hidden");
    if (appEl) appEl.classList.remove("hidden");
    setStatus(t("page.vip.signedIn", "Signed in — pick a venue and night, then tap a green table."));
    renderVenues();
    fillNights();
    const params = new URLSearchParams(location.search);
    if (params.get("vipPaid") === "1") {
      setStatus(t("page.vip.paidOk", "Deposit paid — your VIP ReserV table is confirmed. Open My Profile → Reservations for your pass."));
    } else if (params.get("vipCancelled") === "1") {
      setStatus(t("page.vip.paidCancel", "Checkout cancelled. Your hold may still be active — finish Terms & pay, or release it."));
    }
    const loc = params.get("location");
    const match = BETA_VENUES.find(v => v.id === loc) || BETA_VENUES[0];
    selectVenue(match, {silent: true});
  }

  function renderVenues() {
    if (!chipsEl) return;
    chipsEl.innerHTML = "";
    BETA_VENUES.forEach(v => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.dataset.venue = v.id;
      b.textContent = v.pending ? `${v.label} (soon)` : v.label;
      b.title = v.hint || "";
      b.disabled = !!v.pending;
      b.addEventListener("click", () => selectVenue(v));
      chipsEl.appendChild(b);
    });
  }

  function selectVenue(venue, opts) {
    if (!venue || venue.pending) {
      setStatus(t("page.vip.aureliaPending", "Aurelia’s interactive 3D demo is in reports; the 2D VIP ReserV map lands next."));
      return;
    }
    currentVenue = venue;
    clearHoldUi();
    chipsEl?.querySelectorAll("button").forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.venue === venue.id));
    });
    if (mapTitle) mapTitle.textContent = `${venue.label} — ${t("page.vip.floorMap", "Floor map")}`;
    window.FLOQR_VIP_BOOT = {plan: venue.plan};
    if (window.FLOQRVipFloorViewer?.load) {
      window.FLOQRVipFloorViewer.load(venue.plan).then?.(() => refreshAvailability());
      if (!opts?.silent) setStatus(t("page.vip.mapLoaded", "Floor map loaded. Tap a green table for details."));
      refreshAvailability();
    } else if (!opts?.silent) {
      setStatus(t("page.vip.mapLoading", "Loading floor map…"));
    }
    try {
      const u = new URL(location.href);
      u.searchParams.set("location", venue.id);
      history.replaceState({}, "", u.pathname + u.search + u.hash);
    } catch (_) { /* ignore */ }
  }

  function boot() {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    try { window.FLOQRI18n?.apply?.(document); } catch (_) { /* ignore */ }

    const profileLink = document.getElementById("vipOpenProfile");
    if (profileLink && window.FLOQRNav?.portalHome) {
      profileLink.href = window.FLOQRNav.portalLink
        ? window.FLOQRNav.portalLink({tab: "reservations"})
        : (window.FLOQRNav.portalHome() + (window.FLOQRNav.portalHome().includes("?") ? "&" : "?") + "tab=reservations");
    }

    nightEl?.addEventListener("change", () => {
      clearHoldUi();
      refreshAvailability();
    });
    document.getElementById("vipConsentPay")?.addEventListener("click", submitConsentAndPay);
    document.getElementById("vipConsentCancel")?.addEventListener("click", () => {
      if (consentEl) consentEl.classList.add("hidden");
    });

    const auth = firebase.auth();
    if (!window.FLOQRSessionShell?.bind) {
      setStatus(t("page.vip.shellMissing", "Session shell missing — hard refresh and try again."));
      return;
    }

    const bindBook = () => {
      if (window.FLOQRVipFloorViewer) {
        window.FLOQRVipFloorViewer.onBookRequest = createHold;
      }
    };
    bindBook();
    setTimeout(bindBook, 500);

    window.FLOQRSessionShell.bind({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#vipStatus",
      onUser: user => {
        if (!user) {
          currentUser = null;
          clearHoldUi();
          if (appEl) appEl.classList.add("hidden");
          if (gateEl) gateEl.classList.remove("hidden");
          setStatus(t("page.vip.needSignIn", "Sign in to explore VIP ReserV floor maps."));
          return;
        }
        showApp(user);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
