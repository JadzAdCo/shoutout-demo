/* FloqAi standalone page — contextual search filtered to the signed-in viewer's access. */
// Design notes: .cursor/rules/design-notes-floqai-page.mdc
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const nav = () => window.FLOQRNav;
  const href = (path, params) => {
    const stamped = nav()?.stampCurrentVersion?.(path, params);
    if (stamped) return stamped;
    const qs = new URLSearchParams(params).toString();
    return qs ? `${path}?${qs}` : path;
  };
  const t = (key, fallback) => {
    const value = window.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

  const SCOPE_KEYS = {
    masterAdmin: ["floqai.scopeMasterAdmin", "Showing answers for Master Admin (all areas)."],
    venueAdmin: ["floqai.scopeVenueAdmin", "Showing answers for Club Admin, staff, and patrons."],
    serviceMember: ["floqai.scopeServiceMember", "Showing answers for staff and patrons."],
    patron: ["floqai.scopePatron", "Showing answers for patrons."],
    anonymous: ["floqai.scopePublic", "Showing public answers. Sign in to see answers for your account."]
  };
  const SERVER_ROLE_SCOPE = {master: "masterAdmin", clubAdmin: "venueAdmin", privileged: "serviceMember", regular: "serviceMember", patron: "patron", anonymous: "anonymous"};
  const access = () => window.FLOQRFloqAiAccess;

  function ensureFirebase() {
    try {
      if (window.firebase && !firebase.apps.length && window.firebaseConfig) firebase.initializeApp(window.firebaseConfig);
    } catch (error) {
      console.warn("FloqAi could not start Firebase", error?.message || error);
    }
  }

  function showScope() {
    const audience = SERVER_ROLE_SCOPE[access()?.role?.()] || window.FLOQRHelpRepository?.getViewerAudience?.() || "patron";
    const [key, fallback] = SCOPE_KEYS[audience] || SCOPE_KEYS.patron;
    const el = byId("floqAiScopeNote");
    if (el) el.textContent = t(key, fallback);
  }

  function rerun() {
    const input = byId("intentSearchInput");
    if (input?.value) input.dispatchEvent(new Event("input"));
  }

  function bindHelpPopout() {
    const btn = byId("floqAiHelpBtn");
    const pop = byId("floqAiHelpPopout");
    const setOpen = open => {
      if (!btn || !pop) return;
      pop.classList.toggle("hidden", !open);
      pop.setAttribute("aria-hidden", open ? "false" : "true");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    };
    btn?.addEventListener("click", event => {
      event.stopPropagation();
      setOpen(pop?.classList.contains("hidden"));
    });
    byId("floqAiHelpClose")?.addEventListener("click", () => setOpen(false));
    document.addEventListener("click", event => {
      if (!pop || pop.classList.contains("hidden") || pop.contains(event.target) || btn?.contains(event.target)) return;
      setOpen(false);
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") setOpen(false); });
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureFirebase();
    access()?.activate?.();
    access()?.onChange?.(() => { showScope(); rerun(); });
    nav()?.applyGlobalBack?.("floqrGlobalBack");
    window.showShoutoutLanding = () => { location.href = href("./", {start: "search"}); };
    window.FLOQRIntentSearch?.bindIntentSearch({
      onShoutout: () => window.showShoutoutLanding(),
      onMingl: () => { location.href = href("./", {start: "mingl"}); }
    });
    bindHelpPopout();
    window.FLOQRFloqAi?.bindFloqAi({
      mode: "intent",
      onOpenSearch() { byId("intentSearchInput")?.focus(); }
    });
    const input = byId("intentSearchInput");
    const q = new URL(location.href).searchParams.get("q");
    if (input && q) {
      input.value = q.slice(0, 200);
      rerun();
    }
    input?.focus();
    showScope();
    window.firebase?.auth?.().onAuthStateChanged(async () => {
      access()?.reset?.();
      try { await window.FLOQRIntentSearch?.syncHelpAudienceFromAuth?.(); } catch (_) {}
      showScope();
      rerun();
    });
    window.addEventListener("floqr:ui-language", () => { showScope(); rerun(); });
  });
})();
