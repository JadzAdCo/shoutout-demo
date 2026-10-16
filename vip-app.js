/* VIP reserV — ShoutOut-style venue search → night → hold → consent → Checkout. */
(function () {
  "use strict";

  /** Static floor plans for beta / subscribed clubs (under vip-plans/). */
  const PLAN_BY_ID = Object.freeze({
    "decades-washington-dc": "decades.json",
    "lima-twist-washington-dc": "lima-twist.json",
    "temp-democlub-1": null
  });

  const statusEl = document.getElementById("vipStatus");
  const gateEl = document.getElementById("vipGate");
  const appEl = document.getElementById("vipApp");
  const searchEl = document.getElementById("vipVenueSearch");
  const gridEl = document.getElementById("vipVenueGrid");
  const countEl = document.getElementById("vipVenueCount");
  const selectedWrap = document.getElementById("vipVenueSelected");
  const selectedLabel = document.getElementById("vipSelectedLabel");
  const mapSection = document.getElementById("vipMapSection");
  const mapTitle = document.getElementById("vipMapTitle");
  const nightEl = document.getElementById("vipNight");
  const holdBanner = document.getElementById("vipHoldBanner");
  const consentEl = document.getElementById("vipConsent");

  let venueCatalog = [];
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
        `${esc(activeHold.sectionLabel || activeHold.sectionId)} · ${esc(activeHold.night)} · ` +
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

  function venueSearchHaystack(v) {
    return [
      v.label, v.brandName, v.hint, v.city, v.region, v.country,
      ...(v.genres || [])
    ].join(" ").toLowerCase();
  }

  function filteredVenues() {
    const q = String(searchEl?.value || "").trim().toLowerCase();
    if (!q) return venueCatalog.slice();
    return venueCatalog.filter(v => venueSearchHaystack(v).includes(q));
  }

  function showSearchMode() {
    if (gridEl) gridEl.classList.remove("hidden");
    if (searchEl) searchEl.classList.remove("hidden");
    if (selectedWrap) selectedWrap.classList.add("hidden");
    if (mapSection) mapSection.classList.add("hidden");
    clearHoldUi();
    currentVenue = null;
    renderVenueGrid();
  }

  function renderVenueGrid() {
    if (!gridEl) return;
    const rows = filteredVenues();
    if (countEl) {
      countEl.textContent = rows.length
        ? t("page.vip.venueCount", "{n} VIP reserV venue(s)").replace("{n}", String(rows.length))
        : t("page.vip.noVenues", "No VIP reserV–subscribed clubs match. Ask the venue to enable VIP reserV.");
    }
    if (!rows.length) {
      gridEl.innerHTML = `<p class="sub">${esc(t("page.vip.noVenues", "No VIP reserV–subscribed clubs match. Ask the venue to enable VIP reserV."))}</p>`;
      return;
    }
    gridEl.innerHTML = "";
    rows.forEach(v => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "club-option vip-venue-option";
      card.setAttribute("role", "listitem");
      card.dataset.venue = v.id;
      const badges = [];
      if (v.pending) badges.push(t("page.vip.comingSoon", "Soon"));
      else badges.push(t("page.vip.bookable", "Bookable"));
      (v.genres || []).slice(0, 3).forEach(g => badges.push(g));
      const place = v.hint || [v.city, v.region, v.country].filter(Boolean).join(", ") || "";
      card.innerHTML =
        `<div><div class="club-option-head"><div><h3>${esc(v.label)}</h3>` +
        `<p>${esc(place)}</p></div><strong>VIP reserV</strong></div>` +
        `<div class="badge-row">${badges.map(b => `<span>${esc(b)}</span>`).join("")}</div></div>` +
        `<span class="primary vip-pick-cta">${esc(v.pending ? t("page.vip.comingSoon", "Soon") : t("page.vip.pickVenue", "Select venue"))}</span>`;
      card.disabled = false;
      card.addEventListener("click", () => selectVenue(v));
      gridEl.appendChild(card);
    });
  }

  /**
   * Build catalog: clubs with venue gate vipReservations=true (subscribed),
   * merged with beta plan metadata from getVipBetaVenues when available.
   */
  async function loadSubscribedVenues() {
    const map = window.SHOUTOUT_CLUB_LOCATIONS || {};
    const g = window.FLOQRFeatureGates;
    const db = firebase.firestore();
    const betaMeta = {};
    try {
      const res = await callable("getVipBetaVenues")({});
      (res.data?.venues || []).forEach(v => {
        if (v?.id) betaMeta[v.id] = v;
      });
    } catch (err) {
      console.warn("getVipBetaVenues", err?.message || err);
      Object.keys(PLAN_BY_ID).forEach(id => {
        betaMeta[id] = {
          id,
          name: (map[id] && (map[id].locationName || map[id].brandName)) || id,
          planFile: PLAN_BY_ID[id],
          pending: PLAN_BY_ID[id] == null
        };
      });
    }

    const ids = new Set([...Object.keys(map), ...Object.keys(betaMeta)]);
    const rows = [];
    for (const id of ids) {
      const staticRow = map[id] || {};
      let club = {id, ...staticRow};
      try {
        if (g?.loadVenueRecord) club = (await g.loadVenueRecord(db, id)) || club;
      } catch (_) { /* keep static */ }
      /* Merge gates: Firestore can replace featureGates wholesale and drop static VIP seeds. */
      const mergedGates = Object.assign({}, staticRow.featureGates || {}, club.featureGates || {});
      if (!Object.prototype.hasOwnProperty.call(mergedGates, "vipReservations") && betaMeta[id]) {
        mergedGates.vipReservations = true;
      }
      const gatedClub = Object.assign({}, club, {featureGates: mergedGates});
      const subscribed = g ? g.venueMayUse("vipReservations", gatedClub) : !!mergedGates.vipReservations;
      if (!subscribed) continue;
      const beta = betaMeta[id] || {};
      const plan = PLAN_BY_ID[id] || beta.planFile || null;
      const pending = plan == null || !!beta.pending;
      rows.push({
        id,
        label: club.locationName || club.brandName || beta.name || id,
        brandName: club.brandName || "",
        hint: club.locationLabel || [club.city, club.region || club.regionType, club.country].filter(Boolean).join(", ") || beta.city || "",
        city: club.city || beta.city || "",
        region: club.region || "",
        country: club.country || "",
        genres: Array.isArray(club.genres) ? club.genres : [],
        logoUrl: club.logoUrl || club.coverImageUrl || "",
        plan,
        pending
      });
    }
    rows.sort((a, b) => a.label.localeCompare(b.label));
    venueCatalog = rows;
    renderVenueGrid();
  }

  function selectVenue(venue, opts) {
    if (!venue) return;
    if (venue.pending) {
      setStatus(t("page.vip.aureliaPending", "Aurelia’s interactive 3D demo is in reports; the 2D VIP reserV map lands next."));
      currentVenue = venue;
      if (gridEl) gridEl.classList.add("hidden");
      if (searchEl) searchEl.classList.add("hidden");
      if (countEl) countEl.textContent = "";
      if (selectedWrap) selectedWrap.classList.remove("hidden");
      if (selectedLabel) selectedLabel.textContent = `${venue.label} — ${t("page.vip.comingSoon", "Soon")}`;
      if (mapSection) mapSection.classList.add("hidden");
      clearHoldUi();
      return;
    }
    currentVenue = venue;
    clearHoldUi();
    if (gridEl) gridEl.classList.add("hidden");
    if (searchEl) searchEl.classList.add("hidden");
    if (countEl) countEl.textContent = "";
    if (selectedWrap) selectedWrap.classList.remove("hidden");
    if (selectedLabel) selectedLabel.textContent = venue.label;
    if (mapSection) mapSection.classList.remove("hidden");
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

  async function showApp(user) {
    currentUser = user;
    if (gateEl) gateEl.classList.add("hidden");
    if (appEl) appEl.classList.remove("hidden");
    setStatus(t("page.vip.signedIn", "Signed in — search a VIP reserV club, pick a night, then tap a green table."));
    fillNights();
    await loadSubscribedVenues();
    const params = new URLSearchParams(location.search);
    if (params.get("vipPaid") === "1") {
      setStatus(t("page.vip.paidOk", "Deposit paid — your VIP reserV table is confirmed. Open My Profile → Reservations for your pass."));
    } else if (params.get("vipCancelled") === "1") {
      setStatus(t("page.vip.paidCancel", "Checkout cancelled. Your hold may still be active — finish Terms & pay, or release it."));
    }
    const loc = params.get("location");
    const match = venueCatalog.find(v => v.id === loc);
    if (match) selectVenue(match, {silent: true});
    else showSearchMode();
  }

  function boot() {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    try { window.FLOQRI18n?.apply?.(document); } catch (_) { /* ignore */ }

    const profileLink = document.getElementById("vipOpenProfile");
    if (profileLink && window.FLOQRNav?.portalHome) {
      profileLink.href = window.FLOQRNav.portalLink
        ? window.FLOQRNav.portalLink({tab: "guest-list-reserv"})
        : (window.FLOQRNav.portalHome() + (window.FLOQRNav.portalHome().includes("?") ? "&" : "?") + "tab=guest-list-reserv");
    }

    searchEl?.addEventListener("input", () => renderVenueGrid());
    document.getElementById("vipChangeVenue")?.addEventListener("click", () => {
      try {
        const u = new URL(location.href);
        u.searchParams.delete("location");
        history.replaceState({}, "", u.pathname + u.search + u.hash);
      } catch (_) { /* ignore */ }
      showSearchMode();
      setStatus(t("page.vip.signedIn", "Signed in — search a VIP reserV club, pick a night, then tap a green table."));
    });
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
          setStatus(t("page.vip.needSignIn", "Sign in to explore VIP reserV floor maps."));
          return;
        }
        showApp(user);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
