/* VIP ReserV Phase 1 — session shell, feature gate, venue → floor plan boot. */
(function () {
  "use strict";

  const BETA_VENUES = [
    {
      id: "decades-washington-dc",
      label: "Decades",
      plan: "decades.json",
      hint: "Washington, DC"
    },
    {
      id: "lima-twist-washington-dc",
      label: "Lima Twist Club",
      plan: "lima-twist.json",
      hint: "Washington, DC"
    },
    {
      id: "temp-democlub-1",
      label: "Aurelia",
      plan: null,
      hint: "Demo club — 3D demo; 2D map Phase 1.1",
      pending: true
    }
  ];

  const statusEl = document.getElementById("vipStatus");
  const gateEl = document.getElementById("vipGate");
  const appEl = document.getElementById("vipApp");
  const chipsEl = document.getElementById("vipVenueChips");
  const mapTitle = document.getElementById("vipMapTitle");

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

  function showApp(user) {
    if (gateEl) gateEl.classList.add("hidden");
    if (appEl) appEl.classList.remove("hidden");
    setStatus(t("page.vip.signedIn", "Signed in — pick a venue to open its floor map."));
    renderVenues();
    const params = new URLSearchParams(location.search);
    const loc = params.get("location");
    const match = BETA_VENUES.find(v => v.id === loc) || BETA_VENUES[0];
    selectVenue(match, { silent: true });
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
    chipsEl?.querySelectorAll("button").forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.venue === venue.id));
    });
    if (mapTitle) mapTitle.textContent = `${venue.label} — ${t("page.vip.floorMap", "Floor map")}`;
    window.FLOQR_VIP_BOOT = { plan: venue.plan };
    if (window.FLOQRVipFloorViewer?.load) {
      window.FLOQRVipFloorViewer.load(venue.plan);
      if (!opts?.silent) setStatus(t("page.vip.mapLoaded", "Floor map loaded. Tap a green table for details."));
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
        ? window.FLOQRNav.portalLink({ tab: "profile" })
        : (window.FLOQRNav.portalHome() + (window.FLOQRNav.portalHome().includes("?") ? "&" : "?") + "tab=profile");
    }

    const auth = firebase.auth();
    if (!window.FLOQRSessionShell?.bind) {
      setStatus(t("page.vip.shellMissing", "Session shell missing — hard refresh and try again."));
      return;
    }

    window.FLOQRSessionShell.bind({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#vipStatus",
      onUser: user => {
        if (!user) {
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
