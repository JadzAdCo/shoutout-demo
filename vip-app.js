/* VIP reserV — venue search → floor map → Terms page → Checkout → confirmation. */
(function () {
  "use strict";

  const HOLD_KEY = "FLOQR_VIP_HOLD";

  /** Static floor plans for beta / subscribed clubs (under vip-plans/). */
  const PLAN_BY_ID = Object.freeze({
    "decades-washington-dc": "decades.json",
    "lima-twist-washington-dc": "lima-twist.json",
    "temp-democlub-1": "aurelia.json",
    "shoko-barcelona-spain": "shoko-barcelona.json"
  });

  /** Optional 3D walk-through (Aurelia demo only — reports/vip-aurelia-demo). */
  const EXPLORE_3D_BY_ID = Object.freeze({
    "temp-democlub-1": "./reports/vip-aurelia-demo/"
  });

  const statusEl = document.getElementById("vipStatus");
  const gateEl = document.getElementById("vipGate");
  const appEl = document.getElementById("vipApp");
  const confirmEl = document.getElementById("vipConfirmation");
  const searchEl = document.getElementById("vipVenueSearch");
  const gridEl = document.getElementById("vipVenueGrid");
  const countEl = document.getElementById("vipVenueCount");
  const selectedWrap = document.getElementById("vipVenueSelected");
  const selectedLabel = document.getElementById("vipSelectedLabel");
  const explore3dEl = document.getElementById("vipExplore3d");
  const mapSection = document.getElementById("vipMapSection");
  const mapTitle = document.getElementById("vipMapTitle");
  const nightEl = document.getElementById("vipNight");
  const holdBanner = document.getElementById("vipHoldBanner");

  function setExplore3d(venue) {
    if (!explore3dEl) return;
    const href = venue && (EXPLORE_3D_BY_ID[venue.id] || venue.explore3dUrl);
    if (href) {
      explore3dEl.href = href;
      explore3dEl.classList.remove("hidden");
    } else {
      explore3dEl.classList.add("hidden");
    }
  }

  let venueCatalog = [];
  let currentVenue = null;
  let currentUser = null;
  let activeHold = null;
  let holdTimer = null;
  let locationContext = null;

  function FL() {
    return window.FLOQRFeatureLanding;
  }

  function t(key, fallback, vars) {
    if (FL()?.t) return FL().t(key, fallback, vars);
    try {
      const v = window.FLOQRI18n?.t?.(key, vars);
      if (v && v !== key) return v;
    } catch (_) { /* ignore */ }
    let s = fallback != null ? String(fallback) : String(key || "");
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
    return s;
  }

  function esc(value) {
    return FL()?.esc?.(value) || String(value == null ? "" : value)
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

  function money(cents, currency) {
    const cur = String(currency || "USD").toUpperCase();
    const amount = Number(cents || 0) / 100;
    try {
      return amount.toLocaleString("en-US", {style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2});
    } catch (_) {
      const sym = cur === "EUR" ? "€" : "$";
      return sym + amount.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
  }

  function storeHold(hold) {
    try {
      sessionStorage.setItem(HOLD_KEY, JSON.stringify(hold || {}));
    } catch (_) { /* ignore */ }
  }

  function clearHoldStorage() {
    try { sessionStorage.removeItem(HOLD_KEY); } catch (_) { /* ignore */ }
  }

  function termsUrl(hold) {
    const u = new URL("./vip-terms.html", location.href);
    if (hold?.holdId) u.searchParams.set("holdId", hold.holdId);
    if (hold?.clubLocationId) u.searchParams.set("location", hold.clubLocationId);
    if (hold?.night) u.searchParams.set("night", hold.night);
    return u.pathname.split("/").pop() + u.search;
  }

  function localYmd(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /** Fill night select from club open nights (hoursStructured) when provided. */
  function fillNights(preferred, bookableNights) {
    if (!nightEl) return;
    nightEl.innerHTML = "";
    let rows = Array.isArray(bookableNights) ? bookableNights.filter(n => n && (n.night || n)) : [];
    if (!rows.length && window.FLOQRVenueCalendar && currentVenue) {
      const api = window.FLOQRVenueCalendar;
      const club = {
        hoursStructured: currentVenue.hoursStructured || currentVenue.openingHours,
        hoursExceptions: currentVenue.hoursExceptions || [],
        country: currentVenue.country || "US"
      };
      const cursor = new Date();
      cursor.setHours(12, 0, 0, 0);
      for (let i = 0; i < 60 && rows.length < 14; i += 1) {
        const hours = api.hoursForDate(club, cursor);
        if (!hours.closed) {
          const night = api.ymd(cursor);
          const window = hours.open && hours.close ? ` · ${hours.open}–${hours.close}` : "";
          rows.push({
            night,
            label: `${cursor.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"})}${window}`
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    if (!rows.length) {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      for (let i = 0; i < 14; i += 1) {
        const d = new Date(today.getTime() + i * 86400000);
        rows.push({
          night: localYmd(d),
          label: d.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"})
        });
      }
    }
    let matched = false;
    rows.forEach(row => {
      const iso = typeof row === "string" ? row : String(row.night || "");
      if (!iso) return;
      const opt = document.createElement("option");
      opt.value = iso;
      opt.textContent = (typeof row === "object" && row.label) ? row.label : iso;
      if (preferred && preferred === iso) {
        opt.selected = true;
        matched = true;
      }
      nightEl.appendChild(opt);
    });
    if (preferred && !matched) nightEl.value = nightEl.options[0]?.value || "";
  }

  function selectedNight() {
    return nightEl?.value || localYmd();
  }

  async function refreshAvailability(opts) {
    if (!currentVenue || currentVenue.pending || !currentUser) return;
    try {
      const res = await callable("getVipAvailability")({
        clubLocationId: currentVenue.id,
        night: selectedNight()
      });
      if (Array.isArray(res.data?.bookableNights) && res.data.bookableNights.length) {
        const pref = selectedNight();
        fillNights(pref, res.data.bookableNights);
      }
      if (res.data?.nightOpen === false) {
        setStatus(t("page.vip.nightClosed", "Club is closed this night — pick an open night from the list."));
      }
      const sections = res.data?.sections || [];
      const states = {};
      let available = 0;
      let held = 0;
      let booked = 0;
      // Full map for every section — setStates replaces (does not merge). Omitting
      // "available" left demo/baked map status fighting the list (B3 Booked vs Available).
      sections.forEach(s => {
        const id = s.sectionId;
        if (!id) return;
        const reserved = Number(s.isReserved) === 1 || s.status === "booked" || s.status === "confirmed";
        if (reserved) {
          states[id] = "booked";
          booked += 1;
        } else if (s.status === "held") {
          states[id] = "held";
          held += 1;
        } else if (s.status === "closed") {
          states[id] = "notBookable";
        } else {
          states[id] = "available";
          available += 1;
        }
      });
      window.FLOQRVipFloorViewer?.setStates?.(states);
      const pricing = {};
      sections.forEach(s => {
        if (!s.sectionId) return;
        pricing[s.sectionId] = {
          minimumAmountCents: s.minimumAmountCents,
          depositCents: s.depositCents,
          extraGuestFeeCents: s.extraGuestFeeCents,
          includedGuests: s.includedGuests,
          maxCapacity: s.maxCapacity,
          currency: s.currency || res.data?.currency || "USD",
          nightPriced: !!s.nightPriced
        };
      });
      window.FLOQRVipFloorViewer?.setLivePricing?.(pricing);
      if (opts?.announce !== false && !activeHold) {
        const base = t("page.vip.inventorySummary", "{available} available · {held} held · {booked} booked — tap a green table to hold.")
          .replace("{available}", String(available))
          .replace("{held}", String(held))
          .replace("{booked}", String(booked));
        const extra = EXPLORE_3D_BY_ID[currentVenue.id]
          ? ` ${t("page.vip.explore3dHint", "Open Explore 3D walk-through for the interactive room.")}`
          : "";
        setStatus(base + extra);
      }
    } catch (err) {
      console.warn("VIP availability", err);
      const msg = err?.message || err?.details || String(err);
      setStatus(
        t("page.vip.availabilityFailed", "Could not load live inventory.") +
        " " +
        String(msg).replace(/^FirebaseError:\s*/i, "").replace(/^.*?:\s*/, "")
      );
    }
  }

  function clearHoldUi() {
    activeHold = null;
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = null;
    if (holdBanner) {
      holdBanner.classList.add("hidden");
      holdBanner.innerHTML = "";
    }
  }

  function goToTerms() {
    if (!activeHold?.holdId) return;
    storeHold(activeHold);
    location.href = termsUrl(activeHold);
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
        `${t("page.vip.payToday", "Pay today")} ${money(amounts.chargedCents, amounts.currency)} · ` +
        `<span id="vipHoldClock">${mins}:${String(secs).padStart(2, "0")}</span>` +
        ` <button type="button" id="vipReleaseHold" class="buttonlike">${t("page.vip.releaseHold", "Release hold")}</button>` +
        ` <button type="button" id="vipContinueConsent" class="primary">${t("page.vip.continueTerms", "Continue to Terms")}</button>`;
      document.getElementById("vipReleaseHold")?.addEventListener("click", releaseHold);
      document.getElementById("vipContinueConsent")?.addEventListener("click", goToTerms);
      if (left <= 0) {
        clearHoldUi();
        clearHoldStorage();
        setStatus(t("page.vip.holdExpired", "Your hold expired. Pick a table again."));
        refreshAvailability();
      }
    };
    tick();
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = setInterval(tick, 1000);
  }

  async function releaseHold() {
    if (!activeHold?.holdId) return;
    try {
      await callable("releaseVipHold")({holdId: activeHold.holdId});
    } catch (err) {
      console.warn(err);
    }
    clearHoldUi();
    clearHoldStorage();
    setStatus(t("page.vip.holdReleased", "Hold released."));
    refreshAvailability();
  }

  async function createHold({sectionId, partySize}) {
    if (!currentVenue || currentVenue.pending) {
      throw new Error(t("page.vip.holdFailed", "Could not hold that table."));
    }
    setStatus(t("page.vip.holding", "Holding your table…"));
    try {
      const res = await callable("createVipHold")({
        clubLocationId: currentVenue.id,
        night: selectedNight(),
        sectionId,
        partySize
      });
      activeHold = Object.assign({}, res.data || {}, {
        venueName: currentVenue.label || res.data?.venueName || "",
        clubLocationId: currentVenue.id
      });
      storeHold(activeHold);
      // Close table popout so #vipHoldBanner / Continue to Terms is visible.
      window.FLOQRVipFloorViewer?.closePopout?.();
      renderHoldBanner();
      try {
        holdBanner?.scrollIntoView?.({behavior: "smooth", block: "nearest"});
      } catch (_) { /* ignore */ }
      const needsDeposit = Number(activeHold.depositRequired) !== 0
        && Number(activeHold.amounts?.depositCents || activeHold.amounts?.chargedCents || 0) > 0;
      setStatus(needsDeposit
        ? t("page.vip.holdReady", "Table held for 30 minutes. Continue to Terms, then pay the deposit.")
        : t("page.vip.holdReadyNoDeposit", "Table held for 30 minutes. Continue to Terms to confirm — no deposit required at this venue."));
      await refreshAvailability({announce: false});
      return activeHold;
    } catch (err) {
      const msg = err?.message || err?.details || String(err);
      const clean = msg.replace(/^Firebase:\s*/i, "").replace(/^.*?:\s*/, "")
        || t("page.vip.holdFailed", "Could not hold that table.");
      setStatus(clean);
      throw new Error(clean);
    }
  }

  function venueSearchHaystack(v) {
    return FL()?.venueHaystack?.(v) || [
      v.label, v.name, v.brandName, v.hint, v.locationLabel, v.city, v.region, v.country,
      ...(v.genres || [])
    ].join(" ").toLowerCase();
  }

  function filteredVenues() {
    const q = String(searchEl?.value || "").trim();
    if (FL()?.filterAndRank) {
      return FL().filterAndRank(venueCatalog, {
        query: q,
        locationContext,
        haystackOf: venueSearchHaystack,
        nearbyTop: FL().NEARBY_TOP || 4
      });
    }
    const lower = q.toLowerCase();
    const rows = !lower ? venueCatalog.slice() : venueCatalog.filter((v) => venueSearchHaystack(v).includes(lower));
    return lower ? rows : rows.slice(0, 4);
  }

  function showSearchMode() {
    if (gridEl) gridEl.classList.remove("hidden");
    if (searchEl) searchEl.classList.remove("hidden");
    if (selectedWrap) selectedWrap.classList.add("hidden");
    if (mapSection) mapSection.classList.add("hidden");
    setExplore3d(null);
    clearHoldUi();
    currentVenue = null;
    renderVenueGrid();
  }

  function renderVenueGrid() {
    if (!gridEl) return;
    const rows = filteredVenues();
    const q = String(searchEl?.value || "").trim();
    if (countEl) {
      if (!venueCatalog.length) {
        countEl.textContent = t("page.vip.noVenues", "No VIP reserV–subscribed clubs match. Ask the venue to enable VIP reserV.");
      } else if (FL()?.statusLine) {
        countEl.textContent = FL().statusLine({
          total: venueCatalog.length,
          shown: rows.length,
          query: q,
          locationContext,
          featureLabel: "VIP reserV venues"
        });
      } else {
        countEl.textContent = rows.length
          ? t("page.vip.venueCount", "{n} VIP reserV venue(s)", {n: rows.length})
          : t("page.vip.noVenues", "No VIP reserV–subscribed clubs match. Ask the venue to enable VIP reserV.");
      }
    }
    if (!rows.length) {
      gridEl.innerHTML = `<p class="sub">${esc(t("page.vip.noVenues", "No VIP reserV–subscribed clubs match. Ask the venue to enable VIP reserV."))}</p>`;
      return;
    }
    gridEl.innerHTML = "";
    rows.forEach((v) => {
      const card = document.createElement("div");
      card.className = "vip-venue-option";
      card.setAttribute("role", "listitem");
      card.dataset.venue = v.id;
      const badges = [];
      if (v.pending) badges.push(t("page.vip.comingSoon", "Soon"));
      else badges.push(t("page.vip.bookable", "Bookable"));
      const venueForFacts = Object.assign({}, v, {
        name: v.label || v.name,
        locationLabel: v.hint || v.locationLabel
      });
      const ctaLabel = v.pending
        ? t("page.vip.comingSoon", "Soon")
        : t("page.vip.pickVenue", "Select venue");
      if (FL()?.renderVenueCardHtml) {
        card.innerHTML = FL().renderVenueCardHtml(venueForFacts, {
          feature: FL().FEATURES.VIP,
          productBadge: "VIP reserV",
          ctaLabel,
          ctaAttr: `data-vip-pick="${esc(v.id)}"`,
          extraBadges: badges
        });
      } else {
        card.innerHTML = `<button type="button" class="club-option" data-vip-pick="${esc(v.id)}"><h3>${esc(v.label)}</h3><span class="primary">${esc(ctaLabel)}</span></button>`;
      }
      card.addEventListener("click", (ev) => {
        if (ev.target?.closest?.("[data-vip-pick], .feature-landing-card, .club-option")) selectVenue(v);
      });
      gridEl.appendChild(card);
    });
  }

  /**
   * Candidate VIP venue ids only — never every club in SHOUTOUT_CLUB_LOCATIONS
   * (~590 sequential Firestore reads left the page stuck on "Restoring…").
   */
  function vipCandidateIds(map, betaMeta) {
    const staticVip = Object.keys(map).filter(id => {
      const gates = (map[id] && map[id].featureGates) || {};
      return gates.vipReservations === true;
    });
    return [...new Set([
      ...Object.keys(PLAN_BY_ID),
      ...Object.keys(betaMeta || {}),
      ...staticVip
    ])];
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

    const ids = vipCandidateIds(map, betaMeta);
    const rows = (await Promise.all(ids.map(async id => {
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
      if (!subscribed) return null;
      const beta = betaMeta[id] || {};
      const plan = PLAN_BY_ID[id] || beta.planFile || null;
      /* Static plan in PLAN_BY_ID wins over a stale Functions pending flag. */
      const pending = plan == null || (!PLAN_BY_ID[id] && !!beta.pending);
      const base = FL()?.normalizeVenue?.(id, club) || {};
      return {
        ...base,
        id,
        label: club.locationName || club.brandName || beta.name || id,
        name: club.locationName || club.brandName || beta.name || id,
        brandName: club.brandName || "",
        hint: club.locationLabel || base.locationLabel || [club.city, club.region || club.regionType, club.country].filter(Boolean).join(", ") || beta.city || "",
        city: club.city || beta.city || "",
        region: club.region || "",
        country: club.country || "",
        genres: Array.isArray(club.genres) ? club.genres : [],
        logoUrl: club.logoUrl || club.coverImageUrl || "",
        hoursStructured: club.hoursStructured || club.openingHours || null,
        hoursExceptions: club.hoursExceptions || [],
        hours: club.hours || "",
        agePolicy: club.agePolicy || "",
        dressCode: club.dressCode || "",
        activityDates: Array.isArray(club.activityDates) ? club.activityDates : [],
        vipSettings: club.vipSettings || {},
        plan,
        pending
      };
    }))).filter(Boolean);
    if (countEl) countEl.textContent = t("page.floqcast.locating", "Finding venues near you…");
    try {
      locationContext = await FL()?.resolvePatronLocation?.({auth: firebase.auth()}) || null;
    } catch (_) {
      locationContext = null;
    }
    venueCatalog = FL()?.sortNearest?.(rows, locationContext, {nameOf: (r) => r.label || r.name || r.id}) || rows;
    renderVenueGrid();
  }

  function selectVenue(venue, opts) {
    if (!venue) return;
    if (venue.pending) {
      setStatus(t("page.vip.aureliaPending", "This club’s VIP reserV map is not published yet."));
      currentVenue = venue;
      if (gridEl) gridEl.classList.add("hidden");
      if (searchEl) searchEl.classList.add("hidden");
      if (countEl) countEl.textContent = "";
      if (selectedWrap) selectedWrap.classList.remove("hidden");
      if (selectedLabel) selectedLabel.textContent = `${venue.label} — ${t("page.vip.comingSoon", "Soon")}`;
      setExplore3d(venue);
      if (mapSection) mapSection.classList.add("hidden");
      clearHoldUi();
      return;
    }
    currentVenue = venue;
    clearHoldUi();
    fillNights(selectedNight(), null);
    if (gridEl) gridEl.classList.add("hidden");
    if (searchEl) searchEl.classList.add("hidden");
    if (countEl) countEl.textContent = "";
    if (selectedWrap) selectedWrap.classList.remove("hidden");
    if (selectedLabel) selectedLabel.textContent = venue.label;
    setExplore3d(venue);
    if (mapSection) mapSection.classList.remove("hidden");
    if (mapTitle) mapTitle.textContent = `${venue.label} — ${t("page.vip.floorMap", "Floor map")}`;
    window.FLOQR_VIP_BOOT = {plan: venue.plan};
    if (window.FLOQRVipFloorViewer?.load) {
      if (!opts?.silent) setStatus(t("page.vip.mapLoading", "Loading floor map…"));
      Promise.resolve(window.FLOQRVipFloorViewer.load(venue.plan))
        .then(() => refreshAvailability({announce: true}))
        .catch(err => {
          console.warn(err);
          setStatus(t("page.vip.mapFailed", "Floor map failed to load. Hard refresh and try again."));
        });
    } else if (!opts?.silent) {
      setStatus(t("page.vip.mapLoading", "Loading floor map…"));
    }
    try {
      const u = new URL(location.href);
      u.searchParams.set("location", venue.id);
      history.replaceState({}, "", u.pathname + u.search + u.hash);
    } catch (_) { /* ignore */ }
    try {
      mapSection?.scrollIntoView?.({block: "nearest", behavior: "smooth"});
    } catch (_) { /* ignore */ }
  }

  function setConfirmField(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "—";
  }

  async function showPaidConfirmation(params) {
    clearHoldStorage();
    clearHoldUi();
    if (appEl) appEl.classList.add("hidden");
    if (confirmEl) confirmEl.classList.remove("hidden");
    const orderId = params.get("order") || "";
    setConfirmField("vipConfirmOrder", orderId || "—");
    setConfirmField("vipConfirmRef", orderId ? `VR-${orderId.slice(0, 8).toUpperCase()}` : "—");
    setConfirmField("vipConfirmVenue", "—");
    setConfirmField("vipConfirmNight", "—");
    setConfirmField("vipConfirmTable", "—");
    setStatus(t("page.vip.paidOk", "Deposit paid — your VIP reserV table is confirmed. Open My Profile → Reservations for your pass."));

    const passLink = document.getElementById("vipConfirmPass");
    if (passLink && window.FLOQRNav?.portalHome) {
      passLink.href = window.FLOQRNav.portalHome({tab: "passes"});
    } else if (passLink) {
      passLink.href = "./patron-portal.html?tab=passes";
    }

    try {
      const res = await callable("getMyVipReservations")({});
      const rows = res.data?.reservations || res.data || [];
      const list = Array.isArray(rows) ? rows : [];
      const match = list.find(r => orderId && (r.orderId === orderId || r.commerceOrderId === orderId)) ||
        list.find(r => r.status === "confirmed") ||
        list[0];
      if (match) {
        setConfirmField("vipConfirmVenue", match.venueName || match.clubLocationId || "—");
        setConfirmField("vipConfirmNight", match.night || "—");
        setConfirmField("vipConfirmTable", match.sectionLabel || match.sectionId || "—");
        if (match.reservationId && passLink) {
          if (window.FLOQRNav?.portalHome) {
            passLink.href = window.FLOQRNav.portalHome({tab: "passes", id: match.reservationId});
          } else {
            const base = passLink.href.split("?")[0];
            passLink.href = `${base}?tab=passes&id=${encodeURIComponent(match.reservationId)}`;
          }
        }
      }
    } catch (err) {
      console.warn("VIP confirmation receipt", err);
    }
  }

  function hideConfirmation() {
    if (confirmEl) confirmEl.classList.add("hidden");
    if (appEl) appEl.classList.remove("hidden");
    try {
      const u = new URL(location.href);
      u.searchParams.delete("vipPaid");
      u.searchParams.delete("vipCancelled");
      u.searchParams.delete("order");
      u.searchParams.delete("session_id");
      history.replaceState({}, "", u.pathname + u.search + u.hash);
    } catch (_) { /* ignore */ }
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

  async function showApp(user) {
    currentUser = user;
    if (gateEl) gateEl.classList.add("hidden");
    if (appEl) appEl.classList.remove("hidden");
    if (confirmEl) confirmEl.classList.add("hidden");
    /* Leave "Restoring…" immediately — keep chrome clean (no green Signed-in line). */
    setStatus("");
    await hydrateSiteChrome(user);
    const params = new URLSearchParams(location.search);
    fillNights(params.get("night") || "");
    try {
      await loadSubscribedVenues();
    } catch (err) {
      console.warn("VIP venue catalog", err);
      setStatus(t("page.vip.venuesFailed", "Could not load VIP reserV clubs. Hard refresh and try again."));
      return;
    }

    if (params.get("vipPaid") === "1") {
      await showPaidConfirmation(params);
      return;
    }

    if (params.get("vipCancelled") === "1") {
      setStatus(t("page.vip.paidCancel", "Checkout cancelled. Your hold may still be active — continue to Terms & pay, or release it."));
      try {
        const stored = JSON.parse(sessionStorage.getItem(HOLD_KEY) || "null");
        if (stored?.holdId && Number(stored.expiresAtMs || 0) > Date.now()) {
          activeHold = stored;
          renderHoldBanner();
        }
      } catch (_) { /* ignore */ }
    } else {
      setStatus("");
    }

    const loc = params.get("location");
    const match = venueCatalog.find(v => v.id === loc);
    if (match) selectVenue(match, {silent: true});
    else showSearchMode();
  }

  function boot() {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    try { window.FLOQRI18n?.apply?.(document); } catch (_) { /* ignore */ }
    try { window.FLOQRChromeScheme?.syncAccessGate?.(); } catch (_) { /* ignore */ }
    try { window.FLOQRFeatureLanding?.stripParentLogos?.(document); } catch (_) { /* ignore */ }

    const profileLink = document.getElementById("vipOpenProfile");
    if (profileLink && window.FLOQRNav?.portalHome) {
      profileLink.href = window.FLOQRNav.portalLink
        ? window.FLOQRNav.portalHome({tab: "passes"})
        : (window.FLOQRNav.portalHome() + (window.FLOQRNav.portalHome().includes("?") ? "&" : "?") + "tab=passes");
    }

    searchEl?.addEventListener("input", () => renderVenueGrid());
    document.getElementById("vipChangeVenue")?.addEventListener("click", () => {
      try {
        const u = new URL(location.href);
        u.searchParams.delete("location");
        history.replaceState({}, "", u.pathname + u.search + u.hash);
      } catch (_) { /* ignore */ }
      showSearchMode();
      setStatus("");
    });
    nightEl?.addEventListener("change", () => {
      clearHoldUi();
      clearHoldStorage();
      refreshAvailability();
    });
    document.getElementById("vipConfirmAgain")?.addEventListener("click", () => {
      hideConfirmation();
      showSearchMode();
      setStatus("");
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
          if (confirmEl) confirmEl.classList.add("hidden");
          if (gateEl) gateEl.classList.remove("hidden");
          setStatus(t("page.vip.needSignIn", "Sign in to explore VIP reserV floor maps."));
          return;
        }
        Promise.resolve(showApp(user)).catch(err => {
          console.warn("VIP showApp", err);
          setStatus(t("page.vip.venuesFailed", "Could not load VIP reserV clubs. Hard refresh and try again."));
        });
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
