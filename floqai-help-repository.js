/* FLOQR app-wide help repository — source of truth for FloqAi contextual search.
 * Every "?" help popout verbiage must be registered here (static seed and/or runtime).
 */
(function (global) {
  "use strict";

  const APP_V = (global.FLOQRNav && global.FLOQRNav.appVersion) || "29.09.49";
  const byId = new Map();

  function vUrl(path, params = {}) {
    const qs = new URLSearchParams({v: APP_V, ...params});
    return `${path}?${qs.toString()}`;
  }

  function normalize(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function slug(value) {
    return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "help";
  }

  function register(entry = {}) {
    const title = normalize(entry.title || entry.label || "");
    if (!title && !normalize(entry.body)) return null;
    const id = String(entry.id || `help-${slug(title)}`).trim();
    const existing = byId.get(id) || {};
    const links = Array.isArray(entry.links) ? entry.links.filter(link => link && link.href) : (existing.links || []);
    const searchPhrases = Array.from(new Set([
      ...(existing.searchPhrases || []),
      ...(entry.searchPhrases || []),
      title,
      ...links.map(link => normalize(link.label))
    ].map(normalize).filter(Boolean)));
    const steps = Array.isArray(entry.steps)
      ? entry.steps.map(normalize).filter(Boolean)
      : (existing.steps || []);
    const next = {
      id,
      title: title || existing.title || id,
      body: normalize(entry.body || existing.body || ""),
      steps,
      links: links.length ? links : (existing.links || []),
      searchPhrases,
      source: entry.source || existing.source || "help-repository",
      page: entry.page || existing.page || "",
      kind: entry.kind || existing.kind || "help"
    };
    byId.set(id, next);
    return next;
  }

  function registerMany(entries) {
    (entries || []).forEach(register);
  }

  function registerFromHelpNode(node, meta = {}) {
    if (!node || node.nodeType !== 1) return null;
    if (node.dataset?.floqaiHelpRegistered === "1") return byId.get(node.dataset.floqaiHelpId || "") || null;
    const title = normalize(meta.title || node.getAttribute("aria-label") || node.querySelector?.("summary")?.getAttribute("aria-label") || "Help");
    const bodyRoot = node.querySelector?.(".floqai-help-body, .help-popout-body, div:not(summary)") || node;
    const body = normalize(meta.body || bodyRoot?.innerText || node.innerText || "");
    const links = [...(node.querySelectorAll?.("a[href]") || [])].map(anchor => ({
      label: normalize(anchor.textContent),
      href: anchor.getAttribute("href") || "",
      searchPhrases: String(anchor.getAttribute("data-search") || "").split("|").map(normalize).filter(Boolean),
      blurb: normalize(anchor.getAttribute("data-blurb") || "")
    })).filter(link => link.href && link.label);
    const id = meta.id || `popout-${slug(title)}-${slug(body).slice(0, 24)}`;
    const entry = register({
      id,
      title,
      body,
      links: links.map(link => ({label: link.label, href: link.href})),
      searchPhrases: [
        title,
        body,
        ...(meta.searchPhrases || []),
        ...links.flatMap(link => [link.label, ...(link.searchPhrases || [])])
      ],
      source: meta.source || "help-popout",
      page: meta.page || (global.location && global.location.pathname) || ""
    });
    // Also register each link as its own searchable help row.
    links.forEach((link, index) => {
      register({
        id: `${id}-link-${index}`,
        title: link.label,
        body: link.blurb || body || `Open “${link.label}” from in-app help.`,
        links: [{label: link.label, href: link.href}],
        searchPhrases: [link.label, ...(link.searchPhrases || [])],
        source: "help-popout-link",
        page: entry.page
      });
    });
    node.dataset.floqaiHelpRegistered = "1";
    node.dataset.floqaiHelpId = id;
    return entry;
  }

  function registerDomHelpPopouts(root = global.document) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    const nodes = [
      ...root.querySelectorAll("#floqAiHelpPopout"),
      ...root.querySelectorAll("details.help-popout"),
      ...root.querySelectorAll(".floqai-help-popout"),
      ...root.querySelectorAll("[data-floqai-help-entry]")
    ];
    return nodes.map(node => registerFromHelpNode(node, {
      title: node.getAttribute("aria-label") || node.querySelector("summary")?.getAttribute("aria-label") || node.querySelector(".eyebrow")?.textContent || "Help",
      page: global.location?.pathname || ""
    })).filter(Boolean);
  }

  function entries() {
    return Array.from(byId.values());
  }

  function toSearchIntents() {
    return entries().map(entry => ({
      id: entry.id,
      kind: "help",
      source: entry.source,
      label: entry.title,
      blurb: entry.body || entry.title,
      steps: entry.steps || [],
      links: (entry.links || []).length
        ? entry.links
        : [{label: entry.title, href: `./?v=${APP_V}&start=intent`}],
      searchPhrases: entry.searchPhrases || [],
      patterns: []
    }));
  }

  /* Seed: FloqAi "?" popout + core onboarding / role help (must stay in sync with UI). */
  registerMany([
    {
      id: "floqai-ask-floqr",
      title: "Ask FloqR with FloqAi",
      body: "Ask FloqR with FloqAi — tap the animated mark or wait for the prompt, then type what you want in plain words. Products: Mingl, RydR, BartR, ShoutOut, SupRstR (superstar), clubs. Goals: say “I want to be able to…” (e.g. become a Club Admin) or “make me a superstar” for steps and links.",
      searchPhrases: ["ask floqr", "floqai", "plain words", "i want to be able to", "help", "make me a superstar"],
      links: [
        {label: "Open FloqAi", href: `./?v=${APP_V}&start=intent`},
        {label: "Open SupRstR", href: vUrl("./suprstr-search.html", {from: "floqai"})}
      ],
      source: "help-repository-seed",
      page: "index.html#floqAiHelpPopout"
    },
    {
      id: "help-suprstr-superstar",
      title: "Make me a supRstar / superstar",
      body: "Pick a venue → private camera preview → pay $20 (Stripe pop-out) → Club Admin approves in the supRstar Queue → Go live on the SupRStar board. Like a ShoutOut, but live video. Preview links use secret tokens so they cannot be guessed from a club URL.",
      searchPhrases: [
        "make me a superstar", "make me a suprstr", "make me a suprstar", "make me a super star", "make me a super-star",
        "superstar", "super star", "super-star", "suprstr", "suprstar", "supr str", "supr star", "go live",
        "live stream", "stream to display", "be a superstar", "become a superstar", "camera to display"
      ],
      links: [
        {label: "Open supRstar", href: vUrl("./suprstr-search.html", {from: "floqai"})}
      ],
      source: "help-repository-seed"
    },
    {
      id: "help-become-club-admin",
      title: "Become a Club Admin",
      body: "Request Club Admin access, then get venue approval.",
      searchPhrases: ["become a club admin", "club admin", "be an admin", "I want to be a club admin"],
      links: [{label: "Request Club Admin access", href: vUrl("./role-request.html", {from: "floqai", type: "clubAdmin"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-become-dj",
      title: "Become a DJ",
      body: "Elect DJ as your service role and associate with clubs.",
      searchPhrases: ["become a dj", "dj access", "I want to be a dj", "disc jockey"],
      links: [{label: "Request DJ access", href: vUrl("./role-request.html", {from: "floqai", type: "dj"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-become-promoter",
      title: "Become a Promoter",
      body: "Request Promoter access for guest lists and campaigns.",
      searchPhrases: ["become a promoter", "promoter access", "promotion company"],
      links: [{label: "Request Promoter access", href: vUrl("./role-request.html", {from: "floqai", type: "promoter"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-role-profiles",
      title: "Role profiles overview",
      body: "See how Club Admin, DJ, Promoter, and hospitality roles work.",
      searchPhrases: ["role profiles", "role profiles overview", "how roles work", "service roles"],
      links: [{label: "Role profiles overview", href: vUrl("./role-profiles.html", {from: "floqai"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-staff-scheduling",
      title: "Staff Scheduling subscription",
      body: "Venue field clubLocations.staffSchedulingPaid is 1 or 0. schedulingSubscriptions status is paid this month or not paid this month. When 1 / paid this month: calendar unlocked. When 0 / not paid this month: Subscribe (new) or Resubscribe (prior subscriber).",
      searchPhrases: [
        "staff scheduling", "scheduling subscription", "subscribe $20", "resubscribe", "staffSchedulingPaid",
        "paid this month", "not paid this month", "staff calendar", "schedule shifts", "scheduling portal", "work schedule"
      ],
      links: [
        {label: "Scheduling portal", href: vUrl("./scheduling.html", {from: "floqai"}), search: "scheduling portal", blurb: "DJ / promoter / club shift calendar"},
        {label: "Club Admin Scheduling tab", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"}), search: "club admin scheduling", blurb: "Venue staff calendar and subscribe gate"}
      ],
      source: "help-repository-seed",
      page: "admin.html#panelScheduling"
    },
    {
      id: "help-club-notification-subscriptions",
      title: "Club SMS and WhatsApp notification subscriptions",
      body: "Club Admin → Notifications stores SMS and WhatsApp as compact pills. Green means Firebase subscription is 1 (paid $10 prepaid pack). Red/flashing means 0 (not subscribed). Labels are SMS and WhatsApp; monthly/yearly, credits remaining, and Subscribe live in the channel ?. Uncheck pauses alerts without losing the paid subscription. Save does not reopen Stripe for a subscribed channel. Test alerts need an E.164 alert phone plus SMS and/or WhatsApp left on. If Send test alert returns Authentication Error - invalid username, Firebase secret TWILIO_ACCOUNT_SID must be the Account SID starting with AC (34 characters) from console.twilio.com — not the Auth Token and not an API Key (SK).",
      searchPhrases: [
        "sms notification subscription", "whatsapp notification subscription", "save notification choices",
        "sms already paid", "notification stripe again", "sms credits", "whatsapp credits",
        "club notifications", "alert phone", "sms subscribed", "green sms", "red whatsapp",
        "invalid username", "twilio account sid", "send test alert", "authentication error"
      ],
      links: [
        {label: "Club Admin Notifications", href: vUrl("./admin.html", {from: "floqai", tab: "notifications"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#panelNotifications"
    },
    {
      id: "help-club-sms-notification",
      title: "SMS notification subscription",
      body: "The SMS pill is green when Firebase smsSubscribed is 1 (prepaid $10 pack, 466 credits, not monthly or yearly). Red/flashing means 0 — open ? and tap Subscribe $10. Credits remaining and last paid date are in this help. Uncheck SMS and Save to pause alerts without losing the paid pack.",
      searchPhrases: ["sms", "sms credits", "sms subscribe", "green sms", "466 credits"],
      links: [
        {label: "Club Admin Notifications", href: vUrl("./admin.html", {from: "floqai", tab: "notifications"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#panelNotifications"
    },
    {
      id: "help-club-whatsapp-notification",
      title: "WhatsApp notification subscription",
      body: "The WhatsApp pill is green when Firebase whatsappSubscribed is 1 (prepaid $10 pack, 233 credits, not monthly or yearly). Red/flashing means 0 — open ? and tap Subscribe $10. Credits remaining and last paid date are in this help. Uncheck WhatsApp and Save to pause alerts without losing the paid pack.",
      searchPhrases: ["whatsapp", "whatsapp credits", "whatsapp subscribe", "red whatsapp", "233 credits"],
      links: [
        {label: "Club Admin Notifications", href: vUrl("./admin.html", {from: "floqai", tab: "notifications"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#panelNotifications"
    },
    {
      id: "help-donpapi-led-wall",
      title: "DonPapi ShoutOut LED wall",
      body: "VIP ShoutOuts are carried by busboys on the handheld DonPapi LED wall — held in the air in front of patrons with the shoutout message on the center screen (club name at the top, glowing white scalloped border). Table LEDs (64×32) and portrait walls (960×1900) remain for other formats.",
      searchPhrases: [
        "donpapi", "don papi", "led wall", "vip sign", "handheld led", "busboy shoutout",
        "bus boys carry", "shoutout led", "checking in", "we're outside"
      ],
      links: [
        {label: "Club public profile gallery", href: vUrl("./club-profile.html", {from: "floqai", location: "temp-democlub-1"})},
        {label: "Display (VIP LED)", href: vUrl("./display.html", {from: "floqai", location: "temp-democlub-1"})}
      ],
      source: "help-repository-seed",
      page: "club-profile.html"
    },
    {
      id: "help-staff-week-calendar",
      title: "Staff week calendar",
      body: "Club Admin Scheduling uses a people × days week grid. Manual: click a cell to place a shift. Round Robin fills selected open days fairly. Published shifts stay pending until the worker confirms via FloqR Inbox, Email, SMS, or WhatsApp (worker privacy settings plus this club's notification channels). Confirm link is in the message. Select shifts to multi-delete drafts, pending, or confirmed chips (tap a day header with the Drafts filter, then add chips from other days). Default shift window = club open − 2 hours through close + 1 hour.",
      searchPhrases: [
        "schedule grid", "week calendar", "round robin", "publish schedule", "people days",
        "shift chips", "worker photo", "staff schedule", "7shifts", "assign shift",
        "open minus two hours", "copy previous week", "public holiday",
        "pending shift", "confirmed shift", "delete shift", "select shifts", "multi delete"
      ],
      links: [
        {label: "Club Admin Scheduling", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#panelScheduling"
    },
    {
      id: "help-staff-schedule-user-guide",
      title: "Staff Scheduling User Guide",
      body: "Club Admin User Guide: create draft shifts on the week grid, Publish schedule so workers confirm pending→confirmed, then Select shifts to delete several at once. Example: all Wednesday drafts plus a Thursday confirmed chip.",
      steps: [
        "Open Club Admin → Scheduling (unlocked when staffSchedulingPaid=1 / paid this month).",
        "Tap + on a person/day cell, set role and times, leave Save as draft checked, then Save shift. Optional: Round Robin fill or Copy previous week into drafts.",
        "Review dashed draft chips, then tap Publish schedule. Workers get Inbox / Email / SMS / WhatsApp with a confirm link.",
        "Published chips stay pending until the worker confirms. Confirmed has a green outline.",
        "To delete several: tap Select shifts. Filter Drafts, tap Wednesday’s column header, switch to All or Confirmed, tap a Thursday confirmed chip, then Delete selected."
      ],
      searchPhrases: [
        "user guide", "staff scheduling user guide", "create a schedule", "create schedule",
        "publish schedule", "how to schedule staff", "how to publish a schedule",
        "make a schedule", "staff schedule steps", "scheduling help"
      ],
      links: [
        {label: "Scheduling User Guide", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"}) + "#schedUserGuide"},
        {label: "Club Admin Scheduling", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#schedUserGuide"
    },
    {
      id: "help-create-publish-schedule",
      title: "Create and publish a staff schedule",
      body: "Add draft shifts on the people × days grid, review chips, then Publish schedule. Workers must confirm before a shift becomes confirmed. FloqAi: create a schedule, publish schedule, how to schedule staff.",
      steps: [
        "Open Club Admin → Scheduling after the venue is paid this month.",
        "Manual: tap + on a cell, set worker/role/times, Save as draft. Repeat, or use Round Robin / Copy previous week.",
        "Tap Publish schedule. Shifts become pending and workers are notified to confirm.",
        "The worker uses the Inbox / Email / SMS / WhatsApp confirm link. The chip then shows confirmed."
      ],
      searchPhrases: [
        "create a schedule", "create schedule", "publish schedule", "how to publish a schedule",
        "how to schedule staff", "make a work schedule", "assign shifts", "save as draft",
        "pending until confirmed", "worker confirm shift"
      ],
      links: [
        {label: "Create and publish (User Guide)", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"}) + "#schedUserGuide"}
      ],
      source: "help-repository-seed",
      page: "admin.html#schedUserGuide"
    },
    {
      id: "help-multi-delete-shifts",
      title: "Delete multiple scheduled or draft shifts",
      body: "Select shifts, mix day headers and chips, then Delete selected. Example: all Wednesday drafts plus one Thursday confirmed shift.",
      steps: [
        "On the week grid, tap Select shifts.",
        "Choose Drafts, then tap the Wednesday column header to select every Wednesday draft.",
        "Switch the filter to All or Confirmed and tap the Thursday confirmed chip (or any other chips you want gone).",
        "Tap Delete selected and confirm. Drafts vanish quietly; pending and confirmed workers get a cancelled notice if they were already notified."
      ],
      searchPhrases: [
        "multi delete", "delete multiple shifts", "delete wednesday drafts", "delete confirmed shift",
        "select shifts", "bulk delete shifts", "delete drafts", "delete thursday shift",
        "remove several shifts", "multi-delete schedule"
      ],
      links: [
        {label: "Multi-delete (User Guide)", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"}) + "#schedUserGuide"}
      ],
      source: "help-repository-seed",
      page: "admin.html#schedUserGuide"
    },
    {
      id: "help-venue-hours-calendar",
      title: "Venue opening hours",
      body: "On Club Public Profile, set the default weekly open/closed hours, then add period overrides for special weeks without losing the default. The public club page shows a Sun–Sat week grid with the date range (e.g. Sun 9 – Sat 15, Aug 2026) and calendar coloring. Upcoming public holidays list open/close hours and call out when they differ from the usual weekday. Staff Scheduling uses open − 2h through close + 1h. Guest List can suggest open nights.",
      searchPhrases: [
        "club hours", "opening times", "venue schedule", "hours exception", "period override",
        "public holiday", "open closed days", "venue calendar"
      ],
      links: [
        {label: "Club Public Profile", href: vUrl("./admin.html", {from: "floqai", tab: "publicProfile"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#clubVenueHoursCard"
    },
    {
      id: "help-venue-crawl-datapoints",
      title: "AI crawl venue datapoints",
      body: "AI Crawling ingests public pages and Google Places, then parses venue public-profile datapoints: name, brand, tagline, description, address, phone, email, website, menu/reservations URLs, Instagram/Facebook/X/TikTok, genres, DJs/artists, promoters, amenities, age policy, dress code, hoursStructured + timeZone, featured people, logo/images, and display formats. Approval writes these into clubLocations for the Club Public Profile.",
      searchPhrases: [
        "ai crawl", "discovery crawl", "venue datapoints", "impactful datapoints",
        "crawl ingest", "parse venue", "hoursStructured crawl"
      ],
      links: [
        {label: "Master Admin Diagnostics / Discovery", href: vUrl("./master-admin.html", {from: "floqai"})}
      ],
      source: "help-repository-seed",
      page: "master-admin.html"
    },
    {
      id: "help-network-promoters",
      title: "Network Promoter Data",
      body: "Master Admin → Promoters shows guest-list referral volume by promoter, Club Public Profile promotion groups (including QA temp-democlub Temp Promoter N Collective cards), and promoter onboarding records. Empty referrals does not mean there are no club promoters.",
      searchPhrases: [
        "promoters", "promoter network", "guest list referrals", "temp promoter",
        "promotion groups", "network promoter data"
      ],
      links: [
        {label: "Master Admin Promoters", href: vUrl("./master-admin.html", {from: "floqai"})}
      ],
      source: "help-repository-seed",
      page: "master-admin.html#promoterNetwork"
    },
    {
      id: "help-club-admin-affiliation",
      title: "Club Admin venue assignment",
      body: "Club Admins only open the Venue Command Center for a club they are assigned to. Opening admin.html without a venue no longer defaults to Zebbies. Demo accounts temp_clubadmin_N@floqr-demo.com map to temp-democlub-N. Unassigned admins request assignment from Master Admin.",
      searchPhrases: [
        "club admin assignment", "affiliated club", "request venue assignment", "temp_clubadmin",
        "temp-democlub", "not an elected club admin", "zebbies default"
      ],
      links: [
        {label: "Request Club Admin access", href: vUrl("./role-request.html", {from: "floqai", type: "clubAdmin"})},
        {label: "Club Admin portal", href: vUrl("./admin.html", {from: "floqai"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#adminVenueGate"
    },
    {
      id: "help-app-language",
      title: "App language",
      body: "On first use, FloqR reads the browser language (for example nl-NL → Dutch / Nederlands) and switches chrome and menus to that language when it is supported. Unsupported languages stay in English. After that, My Profile → App language and the saved profile language win. Dutch is included with German, French, Spanish, Italian, Portuguese, Russian, Greek, Polish, and Arabic.",
      searchPhrases: [
        "app language", "dutch", "nederlands", "browser language", "first use language",
        "change language", "ui language", "floqr language", "switch to dutch", "detect language"
      ],
      links: [
        {label: "App language (My Profile)", href: vUrl("./patron-portal.html", {from: "floqai"}), search: "app language", blurb: "Choose FloqR chrome language, including Dutch"}
      ],
      source: "help-repository-seed",
      page: "patron-portal.html#uiAppLanguage"
    },
    {
      id: "help-my-profile",
      title: "My Profile & Settings",
      body: "Open My Profile & Settings for roles, seller tools, and account options.",
      searchPhrases: ["my profile", "profile and settings", "settings", "account", "my profile & settings"],
      links: [{label: "My Profile & Settings", href: vUrl("./patron-portal.html", {from: "floqai"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-onboarding",
      title: "Onboarding",
      body: "Patron / service-member onboarding — request Club Admin, DJ, Promoter, or hospitality access. Master Admins can also onboard venues.",
      searchPhrases: [
        "onboarding", "link to onboarding", "onboard", "patron onboarding",
        "role onboarding", "service member onboarding", "request access", "get started"
      ],
      links: [
        {label: "Role / service onboarding", href: vUrl("./role-request.html", {from: "floqai"})},
        {label: "Venue onboarding (Master Admin)", href: vUrl("./onboard-dc-venues.html", {from: "floqai"})}
      ],
      source: "help-repository-seed"
    },
    {
      id: "help-venue-onboarding",
      title: "Venue onboarding (Master Admin)",
      body: "Master Admin venue onboarding — push crawled club profiles into Firestore.",
      searchPhrases: ["venue onboarding", "onboard clubs", "onboard venues", "dc venues", "link to onboarding venues", "master admin onboarding"],
      links: [{label: "Venue onboarding", href: vUrl("./onboard-dc-venues.html", {from: "floqai"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-mingl-search",
      title: "About Mingl search",
      body: "Search public profiles by shared interests, lifestyle, music, travel, food, events, cars, city, username, or who you want to meet.",
      searchPhrases: ["mingl search", "search people", "mingl social playground", "find people"],
      links: [{label: "Open Mingl", href: `./?v=${APP_V}&start=mingl`}],
      source: "help-repository-seed",
      page: "index.html#mingl"
    },
    {
      id: "help-mingl-requests",
      title: "About Mingl Requests",
      body: "Sent and received Friend or Mingl Requests appear here. Requests stay on the main Mingl page; accepted conversations open in Mingl Chat.",
      searchPhrases: ["mingl requests", "friend request", "mingl chat"],
      links: [{label: "Open Mingl", href: `./?v=${APP_V}&start=mingl`}],
      source: "help-repository-seed",
      page: "index.html#mingl"
    }
  ]);

  function boot() {
    try { registerDomHelpPopouts(global.document); } catch (error) {}
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.FLOQRHelpRepository = {
    register,
    registerMany,
    registerFromHelpNode,
    registerDomHelpPopouts,
    entries,
    toSearchIntents,
    vUrl
  };
})(window);
