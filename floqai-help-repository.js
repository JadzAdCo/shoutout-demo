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
      id: "help-soccer-jersey",
      title: "Soccer jersey ShoutOut",
      body: "Search Soccer, Jersey, or a country/club (Tanzania, Chelsea). Each photo kit card is the LED back you will see on ShoutOut — Soccer · Jersey · Country or Club. Sizes 96×48, 64×48, 64×32. Name and 2-character mark overlay the kit; numbers stay center-justified.",
      searchPhrases: ["soccer jersey", "jersey", "tanzania jersey", "football kit", "country jersey", "club jersey", "chelsea jersey"],
      links: [
        {label: "Start ShoutOut", href: `./?v=${APP_V}&start=search`}
      ],
      source: "help-repository-seed"
    },
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
      title: "Calendar & Scheduler",
      body: "Club Admin Calendar shows Draft (purple), Pending (amber), Confirmed (green), and Open/unfilled cards — each with a written status, not color alone. Scheduler is the people × days draft/publish grid. Website ingest / publicVenueCalendar returns Confirmed assignments only. A green Paid this month pill is shown to Club Admins when staffSchedulingPaid=1.",
      searchPhrases: [
        "staff scheduling", "scheduling subscription", "subscribe $20", "resubscribe", "staffSchedulingPaid",
        "paid this month", "not paid this month", "staff calendar", "schedule shifts", "scheduling portal", "work schedule",
        "draft shift", "purple card", "pending shift", "confirmed shift", "open shift", "unfilled", "assignment card",
        "website ingest", "confirmed only", "public calendar"
      ],
      links: [
        {label: "Scheduling portal", href: vUrl("./scheduling.html", {from: "floqai"}), search: "scheduling portal", blurb: "DJ / promoter / club shift calendar"},
        {label: "Club Admin Calendar & Scheduler", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"}), search: "calendar scheduler", blurb: "Draft / Pending / Confirmed / Open cards plus Scheduler drafts"}
      ],
      source: "help-repository-seed",
      page: "admin.html#panelScheduling"
    },
    {
      id: "help-club-notification-subscriptions",
      title: "Club SMS and WhatsApp notification subscriptions",
      body: "Club Admin → Notifications: Send test alert uses the boxes currently checked. In-app (and Push) writes a System Message in FloqR Inbox. Email uses club admin addresses. SMS and WhatsApp still need a paid subscription plus an E.164 alert phone. Green pill = Firebase subscription 1 (prepaid $10 pack); red = 0. If Send test alert returns Authentication Error - invalid username, Firebase secret TWILIO_ACCOUNT_SID must be the Account SID starting with AC (34 characters) from console.twilio.com — not the Auth Token and not an API Key (SK).",
      searchPhrases: [
        "sms notification subscription", "whatsapp notification subscription", "save notification choices",
        "sms already paid", "notification stripe again", "sms credits", "whatsapp credits",
        "club notifications", "alert phone", "sms subscribed", "green sms", "red whatsapp",
        "invalid username", "twilio account sid", "send test alert", "authentication error",
        "in-app notification", "system message", "floqr inbox test"
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
      id: "help-schedule-message-templates",
      title: "Schedule message templates",
      body: "Club Admin → Notifications → Message templates. These are System Messages (Inbox / Email / SMS / WhatsApp), not ShoutOuts. Edit title and body for New shift needs confirmation, Schedule update, Shift confirmed, and Shift declined. Placeholders: {club} {role} {when} {link} {worker}. Worker inbox uses Review & confirm shift — never Open Related ShoutOut.",
      searchPhrases: [
        "message template", "system message", "schedule invite", "shift confirmation message",
        "open related shoutout", "new shift needs your confirmation", "edit system message",
        "notification templates", "confirm or decline this shift"
      ],
      links: [
        {label: "Message templates", href: vUrl("./admin.html", {from: "floqai", tab: "notifications", notify: "templates"})},
        {label: "Club Admin Notifications", href: vUrl("./admin.html", {from: "floqai", tab: "notifications"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#notifyTemplatesPane"
    },
    {
      id: "help-schedule-confirm",
      title: "Confirm assigned shifts",
      body: "Inbox / Email / SMS links open Work Calendar. Look at each pending assignment, tick it (or Select all), then Approve selected. Opening the link does not confirm. Only the assigned service member can approve — Club Admin cannot confirm on their behalf.",
      searchPhrases: [
        "confirm shift", "approve shift", "select all shifts", "pending assignment",
        "schedule notify", "review and confirm shift", "my assigned shifts", "decline shift"
      ],
      links: [
        {label: "Work Calendar", href: vUrl("./patron-portal.html", {from: "floqai", tab: "work-calendar"})},
        {label: "Message templates", href: vUrl("./admin.html", {from: "floqai", tab: "notifications", notify: "templates"})}
      ],
      source: "help-repository-seed",
      page: "patron-portal.html#portalWorkCalendar"
    },
    {
      id: "help-template-catalog-report",
      title: "Template catalog report",
      body: "Lists every ShoutOut template type and which LED sizes it supports (Is96x48, Is64x48, Is64x32). A venue only offers a template when at least one of those flags is 1 and the matching VenueSupports* flag is 1. Birthday / split-media templates are 1 on 96×48, 64×48, and 64×32. 96×48 is 3-line side-by-side; 64×48 and 64×32 loop the photo then the 3-line shoutout with a FLOQR + handle card.",
      searchPhrases: [
        "template catalog", "template types", "Is96x48", "display sizes", "which templates",
        "split media", "birthday 64x32", "template report"
      ],
      links: [
        {label: "Club Admin Reports", href: vUrl("./admin.html", {from: "floqai", tab: "reports"})},
        {label: "Master Admin Template Catalog", href: vUrl("./master-admin.html", {from: "floqai", tab: "templateCatalogReport"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#panelReports"
    },
    {
      id: "help-club-display-screens",
      title: "FLOQR display screens",
      body: "Firebase clubLocations stores VenueSupports96x48, VenueSupports64x48, and VenueSupports64x32 as 0 or 1. templates stores Is96x48, Is64x48, and Is64x32 the same way. A venue only lists a template when at least one pair is 1. Xibo URLs stay display.html?location=id and display2.html?location=id — screen size is not in the URL. Birthday is offered on all three sizes (3-line side-by-side on 96×48; photo/shoutout loop on 64×48 and 64×32). Primary is display.html. Secondary is display2.html.",
      searchPhrases: [
        "display screens", "64x48", "96x48", "64x32", "primary shoutout led",
        "birthday template screen", "VenueSupports96x48", "Is96x48", "xibo display url",
        "screen datapoint", "led size"
      ],
      links: [
        {label: "Club Public Profile display screens", href: vUrl("./admin.html", {from: "floqai", tab: "public-profile"})},
        {label: "Display 1 (Xibo)", href: "./display.html"}
      ],
      source: "help-repository-seed",
      page: "admin.html#panelPublicProfile"
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
      title: "Scheduler",
      body: "Club Admin Scheduler is a people × days week grid. Save shift closes the editor with Schedule card successfully saved. Create drafts, Publish schedule so workers confirm pending until confirmed, Select shifts to multi-delete, and Website ingest to put published shifts on the club site. Default shift window = club open − 2 hours through close + 1 hour.",
      searchPhrases: [
        "scheduler", "schedule grid", "week calendar", "round robin", "publish schedule", "people days",
        "shift chips", "worker photo", "staff schedule", "7shifts", "assign shift",
        "open minus two hours", "copy previous week", "public holiday",
        "pending shift", "confirmed shift", "delete shift", "select shifts", "multi delete",
        "user guide", "create a schedule", "schedule card successfully saved", "save shift"
      ],
      links: [
        {label: "Club Admin Scheduler", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#schedGridHeading"
    },
    {
      id: "help-staff-schedule-user-guide",
      title: "Staff Scheduling User Guide",
      body: "Open the ? beside Scheduler on Club Admin Scheduling. Create draft shifts, Publish schedule so workers confirm pending→confirmed, then Select shifts to delete several at once. Example: all Wednesday drafts plus a Thursday confirmed chip.",
      steps: [
        "Open Club Admin → Scheduling (unlocked when staffSchedulingPaid=1 / paid this month).",
        "Tap + on a person/day cell, set role and times, leave Save as draft checked, then Save shift. Save closes the editor and shows Schedule card successfully saved. Optional: Round Robin fill or Copy previous week into drafts.",
        "Review dashed draft chips, then tap Publish schedule. Workers get Inbox / Email / SMS / WhatsApp with a confirm link.",
        "Published chips stay pending until the worker confirms. Confirmed has a green outline.",
        "To delete several: tap Select shifts. Filter Drafts, tap Wednesday’s column header, switch to All or Confirmed, tap a Thursday confirmed chip, then Delete selected."
      ],
      searchPhrases: [
        "user guide", "staff scheduling user guide", "create a schedule", "create schedule",
        "publish schedule", "how to schedule staff", "how to publish a schedule",
        "make a schedule", "staff schedule steps", "scheduling help", "scheduler"
      ],
      links: [
        {label: "Scheduler help", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})},
        {label: "Club Admin Scheduling", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#schedGridHeading"
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
        {label: "Create and publish (Scheduler)", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#schedGridHeading"
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
        {label: "Multi-delete (Scheduler)", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      source: "help-repository-seed",
      page: "admin.html#schedGridHeading"
    },
    {
      id: "help-staff-worksheet",
      title: "Work Sheet - Weekly Staff Calendar",
      body: "Elected service members open Work Calendar in Settings. Inbox / Email / SMS confirmation links land here. Review pending assignments, tick each shift (or Select all), then Approve selected — opening the message does not confirm. The week grid shows published colleague shifts. Drafts stay in Club Admin.",
      searchPhrases: [
        "staff calendar", "work sheet", "worksheet", "weekly staff calendar",
        "colleague schedule", "who is working", "my shifts this week", "elected staff schedule",
        "confirm shift", "approve selected", "my assigned shifts"
      ],
      links: [
        {label: "Work Calendar tab", href: vUrl("./patron-portal.html", {from: "floqai", tab: "work-calendar"})},
        {label: "Work Sheet", href: vUrl("./staff-worksheet.html", {from: "floqai"})}
      ],
      source: "help-repository-seed",
      page: "staff-worksheet.html"
    },
    {
      id: "help-service-members",
      title: "Services & Service Members",
      body: "Settings → Services & Service Members is hidden when users.IsPatron is 1/yes. Elect from My Profile to set IsServiceMember (IsserviceMember) to 1/yes and IsPatron to 0/no. Then request Club Admin, DJ, Promoter, hospitality, or other roles. Club Admins also see Review & elect.",
      searchPhrases: [
        "service members", "services and service members", "request club admin", "request access", "elect service member",
        "worker association", "request dj access", "request promoter", "bus boys or security",
        "venue manager", "approve worker request", "IsPatron", "IsServiceMember"
      ],
      links: [
        {label: "Services & Service Members", href: vUrl("./patron-portal.html", {from: "floqai", tab: "service-members"})},
        {label: "My Profile & Settings", href: vUrl("./patron-portal.html", {from: "floqai", tab: "profile"})},
        {label: "Club Admin Employee/Workers", href: vUrl("./admin.html", {from: "floqai", tab: "employees"})}
      ],
      source: "help-repository-seed",
      page: "patron-portal.html#portalServiceMembers"
    },
    {
      id: "help-venue-website-ingest",
      title: "Club website ingest (API, RSS, iframe)",
      body: "Club Admin → Scheduling → Website ingest. Generate a secret (shown once; only a hash is stored). Pull published staff shifts onto the official club website with JSON (?format=json&dataset=schedule|hours|profile|all), RSS, or an iframe snippet. Drafts, worker email, and phone are never included. Rotate the secret if it leaks.",
      searchPhrases: [
        "website ingest", "club website schedule", "rss feed", "iframe schedule",
        "schedule api", "ingest secret", "embed staff schedule", "official website",
        "json schedule feed", "pull schedule onto website"
      ],
      links: [
        {label: "Website ingest", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"}) + "#schedWebsiteIngest"}
      ],
      source: "help-repository-seed",
      page: "admin.html#schedWebsiteIngest"
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
      id: "help-sos2fa-request-channels",
      title: "Request SOS2FA Code",
      body: "Request is sent using your general Notifications settings",
      searchPhrases: [
        "request sos2fa code", "sos2fa", "notifications settings", "general notifications",
        "entity management unlock", "sos2fa email sms", "notifyEmail", "notifySms"
      ],
      links: [
        {label: "General Notifications (My Privacy)", href: vUrl("./patron-portal.html", {from: "floqai", tab: "privacy"})},
        {label: "Venue Links", href: vUrl("./master-admin.html", {from: "floqai"}), search: "venue links"}
      ],
      source: "help-repository-seed",
      page: "master-admin.html#entityManagement"
    },
    {
      id: "help-general-notifications",
      title: "General Notifications",
      body: "My Profile → My Privacy → General Notifications (Email / SMS). These users.notifyEmail and users.notifySms flags control SOS2FA, schedule invites, and other FloqR system messages. Club Admin → Notifications is a separate paid SMS/WhatsApp overlay for a venue, not Super Admin SOS2FA.",
      searchPhrases: [
        "general notifications", "email notifications", "sms notifications", "notifyEmail", "notifySms",
        "sos2fa email sms", "notification settings"
      ],
      links: [
        {label: "My Privacy", href: vUrl("./patron-portal.html", {from: "floqai", tab: "privacy"})}
      ],
      source: "help-repository-seed",
      page: "patron-portal.html#portalPrivacy"
    },
    {
      id: "help-sos2fa-entity-mgmt",
      title: "SOS2FA",
      body: "Entity Management is protected by SOS2FA (Social OS two-factor). Request SOS2FA Code sends a one-time code using your FloqR notification channels — Email and/or SMS — not a hardcoded SMS-only path. Enter the six-digit code, then Verify & unlock. Activity is logged for 90 days.",
      searchPhrases: [
        "sos2fa", "entity management unlock", "request sos2fa code", "two factor",
        "sos2fa sms", "entity management 2fa"
      ],
      links: [
        {label: "General Notifications (My Privacy)", href: vUrl("./patron-portal.html", {from: "floqai", tab: "privacy"})},
        {label: "Venue Links", href: vUrl("./master-admin.html", {from: "floqai"}), search: "venue links"}
      ],
      source: "help-repository-seed",
      page: "master-admin.html#clubAdminUrls"
    },
    {
      id: "help-app-language",
      title: "App language",
      body: "On first use, FloqR reads the browser language (for example nl-NL → Dutch / Nederlands) and switches chrome and menus to that language when it is supported — Search categories, My Profile tabs, Club Admin tabs, and Master Admin tabs. Unsupported languages stay in English. After that, My Profile → App language and the saved profile language win. Saving App language re-translates every page that loads FLOQRI18n, not only this card.",
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
      id: "help-venue-links",
      title: "Venue Links",
      body: "Venue Admin Portal URLs are generated when you search — they are not stored with an old package number. Each link stamps the current FLOQR package from FLOQRNav so Club Admin cache-busts to the latest release. Opening Master Admin with an old ?v= bookmark does not freeze these links. Display board URLs stay location-only with no ?v=.",
      searchPhrases: [
        "venue links", "venue admin portal url", "club admin url", "admin.html version",
        "hardcoded version", "club admin link", "master admin venue links"
      ],
      links: [
        {label: "Venue Links", href: vUrl("./master-admin.html", {from: "floqai"})}
      ],
      source: "help-repository-seed",
      page: "master-admin.html#clubAdminUrls"
    },
    {
      id: "help-mail-logging",
      title: "Mail Logging",
      body: "Every FLOQR system-generated email is logged here: queued, accepted, failed, and later delivery (delivered, bounce, drop). Search by status, kind, address, subject, or message id. Open a row for headers, body, TLS 1.3 on the SendGrid API hop, and provider delivery events. OTP digits are redacted. Retention is 90 days. This is not Application Logging and not Security Logs.",
      searchPhrases: [
        "mail logging", "email log", "sendgrid", "system mail", "preview links email",
        "tls 1.3", "mail delivery", "who sent that email", "system generated mail"
      ],
      links: [
        {label: "Mail Logging", href: vUrl("./master-admin.html", {from: "floqai"})}
      ],
      source: "help-repository-seed",
      page: "master-admin.html#mailLogging"
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
      id: "help-default-template",
      title: "Default Template",
      body: "Free Traditional Black and White Classic. Use FloqAi below for Sports, Jersey, VIP, Humor, Cars, Video, Pictures, and Ballers templates.",
      searchPhrases: ["default template", "black and white", "classic shoutout"],
      links: [{label: "Throw a ShoutOut", href: `./?v=${APP_V}&start=search`}],
      source: "help-repository-seed",
      page: "index.html#templates"
    },
    {
      id: "help-floqai-template-search",
      title: "FloqAi template search",
      body: "Tap the moving FloqAi mark (or wait for its speech bubbles), then ask for Sports, Jersey, NBA, NFL, Cars, Humor, VIP, Video, Pictures, or Ballers.",
      searchPhrases: ["floqai template", "sports jersey", "nba nfl cars humor"],
      links: [{label: "Throw a ShoutOut", href: `./?v=${APP_V}&start=search`}],
      source: "help-repository-seed",
      page: "index.html#templates"
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
