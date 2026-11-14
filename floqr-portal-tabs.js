/* FLOQR My Profile / portal tab restore.
   Club Admin already writes location.hash. The portal only read ?tab= on load
   and never wrote it, so a hard refresh on My Profile fell back to Overview.
   Persist the active panel in ?tab= + #panelId (and sessionStorage on reload). */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.portalPanel";

  const PANEL_TO_TAB = {
    portalOverview: "overview",
    portalProfile: "profile",
    portalPrivacy: "privacy",
    portalLanguageSettings: "language",
    portalAppearance: "appearance",
    portalAiNotifications: "ai-notifications",
    portalPublicProfile: "public",
    portalFeatureOrders: "feature-orders",
    portalGuestLists: "guest-lists",
    portalBartrStore: "bartr",
    portalAdCampaigns: "ads",
    portalMessages: "inbox",
    portalMinglFriends: "friends",
    portalWorkCalendar: "work-calendar",
    portalServiceMembers: "service-members",
    portalHelp: "help"
  };

  const TAB_TO_PANEL = {
    overview: "portalOverview",
    profile: "portalProfile",
    settings: "portalProfile",
    privacy: "portalPrivacy",
    "my-privacy": "portalPrivacy",
    language: "portalLanguageSettings",
    "language-settings": "portalLanguageSettings",
    appearance: "portalAppearance",
    chrome: "portalAppearance",
    "site-chrome": "portalAppearance",
    sitechrome: "portalAppearance",
    theme: "portalAppearance",
    "ai-notifications": "portalAiNotifications",
    public: "portalPublicProfile",
    media: "portalPublicProfile",
    templates: "portalFeatureOrders",
    "my-templates": "portalFeatureOrders",
    shoutouts: "portalFeatureOrders",
    myshoutouts: "portalFeatureOrders",
    "my-shoutouts": "portalFeatureOrders",
    shoutout: "portalFeatureOrders",
    "feature-orders": "portalFeatureOrders",
    featureorders: "portalFeatureOrders",
    "paid-services": "portalFeatureOrders",
    invoices: "portalFeatureOrders",
    reservations: "portalFeatureOrders",
    "guest-list-reserv": "portalFeatureOrders",
    vip: "portalFeatureOrders",
    "vip-reservations": "portalFeatureOrders",
    vipreservations: "portalFeatureOrders",
    passes: "portalFeatureOrders",
    pass: "portalFeatureOrders",
    "door-pass": "portalFeatureOrders",
    doorpass: "portalFeatureOrders",
    "guest-lists": "portalGuestLists",
    guestlists: "portalGuestLists",
    bartr: "portalBartrStore",
    commerce: "portalBartrStore",
    store: "portalBartrStore",
    "ad-campaigns": "portalAdCampaigns",
    adcampaigns: "portalAdCampaigns",
    advertise: "portalAdCampaigns",
    ads: "portalAdCampaigns",
    messages: "portalMessages",
    inbox: "portalMessages",
    "mingl-friends": "portalMinglFriends",
    friends: "portalMinglFriends",
    unmingl: "portalMinglFriends",
    "work-calendar": "portalWorkCalendar",
    workcalendar: "portalWorkCalendar",
    "staff-calendar": "portalWorkCalendar",
    "service-members": "portalServiceMembers",
    servicemembers: "portalServiceMembers",
    "role-request": "portalServiceMembers",
    help: "portalHelp"
  };

  const MINGL_TABS = new Set(["chats", "mingl", "mingl-chat"]);

  const FO_PANE_SUB = {
    foShoutoutsPane: "shoutouts",
    foVipPane: "vip",
    foInvoicesPane: "invoices",
    foFloqCastsPane: "floqcast"
  };

  function panelFromTab(tab) {
    return TAB_TO_PANEL[String(tab || "").trim().toLowerCase()] || "";
  }

  function tabFromPanel(panelId) {
    return PANEL_TO_TAB[String(panelId || "").trim()] || "";
  }

  function knownPanel(panelId) {
    return !!PANEL_TO_TAB[String(panelId || "").trim()];
  }

  function navigationType(perf) {
    const p = perf || (typeof performance !== "undefined" ? performance : null);
    try {
      const nav = p?.getEntriesByType?.("navigation")?.[0];
      if (nav?.type) return String(nav.type);
    } catch (_) { /* ignore */ }
    try {
      if (p?.navigation && typeof p.navigation.type === "number") {
        if (p.navigation.type === 1) return "reload";
        if (p.navigation.type === 2) return "back_forward";
        return "navigate";
      }
    } catch (_) { /* ignore */ }
    return "navigate";
  }

  function resolve(opts = {}) {
    const href = opts.href || (typeof location !== "undefined" ? location.href : "");
    const stored = String(opts.stored || "").trim();
    const navType = opts.navType || navigationType(opts.performance);
    let url;
    try {
      url = new URL(href, "https://floqr.local/");
    } catch (_) {
      return { panelId: "", tab: "", source: "" };
    }
    const tab = String(url.searchParams.get("tab") || "").trim().toLowerCase();
    if (MINGL_TABS.has(tab)) return { redirectMingl: true, tab, panelId: "", source: "query" };
    const mapped = panelFromTab(tab);
    if (mapped) return { panelId: mapped, tab, source: "query" };
    const hash = String(url.hash || "").replace(/^#/, "").trim();
    if (hash && knownPanel(hash)) return { panelId: hash, tab: tabFromPanel(hash), source: "hash" };
    if (stored && knownPanel(stored) && (navType === "reload" || navType === "back_forward")) {
      return { panelId: stored, tab: tabFromPanel(stored), source: "session" };
    }
    return { panelId: "", tab: "", source: "" };
  }

  function persistHref(href, panelId, extra = {}) {
    const url = new URL(href, "https://floqr.local/");
    const resolved = String(extra.resolvedPanelId || panelId || "").trim();
    const alias = tabFromPanel(resolved);
    if (alias && alias !== "overview") url.searchParams.set("tab", alias);
    else url.searchParams.delete("tab");
    if (resolved !== "portalFeatureOrders") {
      url.searchParams.delete("sub");
    } else if (extra.sub) {
      url.searchParams.set("sub", extra.sub);
    } else {
      url.searchParams.delete("sub");
    }
    url.hash = resolved ? resolved : "";
    return url.pathname + url.search + url.hash;
  }

  function subForFoPane(paneId) {
    return FO_PANE_SUB[String(paneId || "")] || "";
  }

  const api = {
    STORAGE_KEY,
    PANEL_TO_TAB,
    TAB_TO_PANEL,
    panelFromTab,
    tabFromPanel,
    knownPanel,
    navigationType,
    resolve,
    persistHref,
    subForFoPane
  };

  global.FLOQRPortalTabs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
