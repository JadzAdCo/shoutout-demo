/* FloqR plain-language intent router — products + “I want to…” contextual help */
(function (global) {
  "use strict";

  const APP_V = (global.FLOQRNav && global.FLOQRNav.appVersion) || "29.09.48";

  function vUrl(path, params = {}) {
    const qs = new URLSearchParams({v: APP_V, ...params});
    return `${path}?${qs.toString()}`;
  }

  const PRODUCT_INTENTS = [
    {
      id: "mingl",
      kind: "product",
      label: "Mingl",
      blurb: "Meet people, chat, and social discovery.",
      href: `./?v=${APP_V}&start=mingl`,
      patterns: [/meet/, /mingl/, /date/, /social/, /someone/, /people/, /friend/, /chat/, /connect/, /match/]
    },
    {
      id: "rydr",
      kind: "product",
      label: "RydR",
      blurb: "Robotaxi or ultra-luxury ride to the venue.",
      href: vUrl("./rydr.html", {from: "search"}),
      patterns: [/ride/, /rydr/, /taxi/, /uber/, /lyft/, /pickup/, /\bcar\b/, /driver/, /robotaxi/, /chauffeur/, /luxury\s*ride/, /get\s*(me\s*)?(there|home)/]
    },
    {
      id: "bartr",
      kind: "product",
      label: "Trade by BartR",
      blurb: "Marketplace — barter and swag.",
      href: vUrl("./commerce.html", {from: "search"}),
      patterns: [/trade/, /bartr/, /buy/, /shop/, /swag/, /marketplace/, /sell/, /merch/, /product/]
    },
    {
      id: "shoutout",
      kind: "product",
      label: "Throw a ShoutOut",
      blurb: "Send a live message to a FloqR display.",
      href: `./?v=${APP_V}&start=search`,
      action: "shoutout",
      patterns: [/shout/, /display/, /led/, /message\s*board/, /birthday/, /congrats/, /announce/]
    },
    {
      id: "suprstr",
      kind: "product",
      label: "supRstar — go live / be a superstar",
      blurb: "Pick a venue, privately preview your camera, pay $20, get Club Admin approval, then go live on the SupRStar board.",
      href: vUrl("./suprstr-search.html", {from: "floqai"}),
      patterns: [
        /supr\s*str/, /suprstr/, /supr\s*star/, /suprstar/, /super\s*-?\s*star/, /superstar/,
        /make\s+me\s+(a\s+)?(super\s*-?\s*star|superstar|suprstr|suprstar|supr\s*str|supr\s*star)/,
        /be(come)?\s+(a\s+)?(super\s*-?\s*star|superstar|suprstar)/,
        /go\s+live/, /live\s*stream/, /stream\s+(to\s+)?(the\s+)?display/,
        /camera\s+to\s+(the\s+)?(club|venue|display)/, /broadcast\s+(live|myself|to)/
      ]
    },
    {
      id: "clubs",
      kind: "product",
      label: "Clubs & venues",
      blurb: "Browse clubs, lounges, beach clubs, and events.",
      href: `./?v=${APP_V}&start=search`,
      patterns: [/club/, /lounge/, /beach/, /event/, /nightlife/, /venue/, /party/, /tonight/]
    }
  ];

  /* “I want to be able to…” / how-to help for patrons & service members */
  const HELP_INTENTS = [
    {
      id: "help-suprstr",
      kind: "help",
      label: "Make me a supRstar / superstar",
      blurb: "Like a ShoutOut for video: pick a venue → private camera preview → pay $20 in a Stripe pop-out → Club Admin approves in the supRstar Queue → Go live on the SupRStar board (display2). Preview URLs are secret tokens so video cannot leak from a guessed club URL.",
      steps: [
        "Open supRstar from Search or FloqAi.",
        "Choose a venue that has supRstar enabled.",
        "Tap Go live, be a supRstar — a private preview page opens (camera only, not on the board yet).",
        "Pay $20 in the Stripe pop-out while the preview stays open.",
        "Wait for Club Admin to Approve in Club Admin → supRstar Queue.",
        "When approved, tap Go live on your preview page."
      ],
      links: [
        {label: "Open supRstar", href: vUrl("./suprstr-search.html", {from: "floqai"})}
      ],
      searchPhrases: [
        "make me a superstar", "make me a suprstr", "make me a suprstar", "make me a super star", "make me a super-star",
        "superstar", "super star", "super-star", "suprstr", "suprstar", "supr str", "supr star",
        "go live", "live stream", "stream to display", "be a superstar", "become a superstar"
      ],
      patterns: [
        /make\s+me\s+(a\s+)?(super\s*-?\s*star|superstar|suprstr|suprstar)/,
        /be(come)?\s+(a\s+)?(super\s*-?\s*star|superstar|suprstar)/,
        /supr\s*str/, /supr\s*star/, /super\s*-?\s*star/, /go\s+live/, /live\s*stream/
      ]
    },
    {
      id: "help-club-admin",
      kind: "help",
      label: "Become a Club Admin",
      blurb: "Club Admins only open the Venue Command Center for a venue they are assigned to. admin.html no longer defaults to Zebbies. Demo accounts temp_clubadmin_N@floqr-demo.com go to temp-democlub-N. Unassigned admins request Master Admin assignment.",
      steps: [
        "Sign in as a FLOQR patron (everyone starts here).",
        "Open Role Request and choose Club Admin, or wait for Master Admin assignment.",
        "After assignment, open Club Admin — you are redirected to your venue.",
        "Demo: temp_clubadmin_1 maps to temp-democlub-1 (same pattern for 2, 3, …)."
      ],
      links: [
        {label: "Request Club Admin access", href: vUrl("./patron-portal.html", {from: "floqai", tab: "service-members"})},
        {label: "My Profile & Settings", href: vUrl("./patron-portal.html", {from: "floqai"})},
        {label: "Role profiles overview", href: vUrl("./role-profiles.html", {from: "floqai"})},
        {label: "Open Club Admin (after approval)", href: vUrl("./admin.html", {from: "floqai"})}
      ],
      searchPhrases: ["become a club admin", "club admin", "be an admin", "I want to be a club admin"],
      patterns: [
        /club\s*admin/, /be(come)?\s*(an?\s*)?admin/, /want\s+to\s+be\s+(an?\s*)?admin/,
        /admin\s*(access|role|portal)/, /manage\s*(the\s*)?(club|venue)/,
        /i\s+want\s+to\s+be\s+able\s+to\s+.*(admin|manage)/
      ]
    },
    {
      id: "help-club-notification-subscriptions",
      kind: "help",
      label: "Club SMS and WhatsApp notification subscriptions",
      blurb: "SMS and WhatsApp pills turn green when Firebase subscription is 1 (prepaid $10 pack) and red when 0. Payment, credits remaining, and Subscribe live in the channel ?. Saving again does not reopen Stripe for a subscribed channel. Uncheck a channel to pause alerts without losing the paid subscription. If Send test alert returns Authentication Error - invalid username, TWILIO_ACCOUNT_SID must be the Account SID starting with AC, not an Auth Token or API Key (SK).",
      steps: [
        "Open Club Admin → Notifications.",
        "Check SMS and/or WhatsApp. The first save for an unsubscribed channel opens the $10 Stripe checkout.",
        "After payment, Firebase marks that channel subscribed. Later saves keep settings and skip checkout.",
        "Uncheck a subscribed channel to pause alerts; you will not be charged again when you re-check it.",
        "If a test alert says invalid username, set Firebase secret TWILIO_ACCOUNT_SID to the AC… Account SID from Twilio Console."
      ],
      links: [
        {label: "Club Admin Notifications", href: vUrl("./admin.html", {from: "floqai", tab: "notifications"})}
      ],
      searchPhrases: [
        "sms notification subscription", "whatsapp notification subscription", "save notification choices",
        "sms already paid", "notification stripe again", "sms credits", "club notifications",
        "invalid username", "twilio account sid", "send test alert", "authentication error"
      ],
      patterns: [
        /sms\s*(notification|subscription|already\s*paid)/,
        /whatsapp\s*(notification|subscription)/,
        /save\s*notification/,
        /notification\s*(stripe|checkout|payment)/,
        /invalid\s*username/,
        /twilio\s*(account\s*sid|auth)/
      ]
    },
    {
      id: "help-schedule-message-templates",
      kind: "help",
      label: "Schedule message templates",
      blurb: "Club Admin → Notifications → Message templates. Edit System Messages for shift invite, update, confirmed, and declined. They are not ShoutOuts. Placeholders: {club} {role} {when} {link} {worker}.",
      steps: [
        "Open Club Admin → Notifications → Message templates.",
        "Edit title and body for each System Message type.",
        "Use {club}, {role}, {when}, {link}, and {worker} placeholders.",
        "Save. New Inbox / Email / SMS / WhatsApp notices use this copy. Worker inbox shows Review & confirm shift, not Open Related ShoutOut."
      ],
      links: [
        {label: "Message templates", href: vUrl("./admin.html", {from: "floqai", tab: "notifications", notify: "templates"})}
      ],
      searchPhrases: [
        "message template", "system message", "schedule invite", "shift confirmation message",
        "open related shoutout", "edit system message", "notification templates"
      ],
      patterns: [
        /message\s*templates?/, /system\s*message/, /open\s*related\s*shout/,
        /schedule\s*(invite|message\s*template)/, /edit\s*(the\s*)?(system|shift)\s*message/
      ]
    },
    {
      id: "help-schedule-confirm",
      kind: "help",
      label: "Confirm assigned shifts",
      blurb: "Inbox links open Work Calendar. Tick pending shifts (or Select all), then Approve selected. Opening the link does not confirm. Only the assigned service member can approve.",
      steps: [
        "Stay signed in and open Review & confirm shift from Inbox (not Open Related ShoutOut).",
        "Look at the assigned shift on Work Calendar.",
        "Tick that shift or Select all.",
        "Tap Approve selected or Decline selected."
      ],
      links: [
        {label: "Work Calendar", href: vUrl("./patron-portal.html", {from: "floqai", tab: "work-calendar"})}
      ],
      searchPhrases: [
        "confirm shift", "approve shift", "select all shifts", "pending assignment",
        "review and confirm shift", "my assigned shifts"
      ],
      patterns: [
        /confirm\s*(my\s*)?(assigned\s*)?shift/, /approve\s*(selected|shift)/,
        /select\s*all\s*shifts/, /pending\s*assignment/
      ]
    },
    {
      id: "help-donpapi-led-wall",
      kind: "help",
      label: "DonPapi ShoutOut LED wall",
      blurb: "VIP ShoutOuts are carried by busboys on the handheld DonPapi LED wall — held in the air in front of patrons with the shoutout message on the center screen.",
      steps: [
        "Open a club public profile gallery to see busboys holding the DonPapi wall.",
        "VIP ShoutOut text appears on the center LED; club name sits at the top of the scalloped frame.",
        "Table LEDs and portrait walls are separate formats."
      ],
      links: [
        {label: "Club public profile gallery", href: vUrl("./club-profile.html", {from: "floqai", location: "temp-democlub-1"})}
      ],
      searchPhrases: [
        "donpapi", "don papi", "led wall", "vip sign", "handheld led", "busboy shoutout",
        "bus boys carry", "shoutout led"
      ],
      patterns: [
        /don\s*papi/, /led\s*wall/, /bus\s*boys?/, /handheld\s*led/, /vip\s*sign/
      ]
    },
    {
      id: "help-role-profiles",
      kind: "help",
      label: "Role profiles overview",
      blurb: "How Club Admin, DJ, Promoter, hospitality, CSR, and scheduling roles fit together.",
      links: [
        {label: "Role profiles overview", href: vUrl("./role-profiles.html", {from: "floqai"})},
        {label: "Request a role", href: vUrl("./role-request.html", {from: "floqai"})}
      ],
      searchPhrases: ["role profiles", "role profiles overview", "how roles work", "service roles"],
      patterns: [/role\s*profiles?/, /how\s+roles\s+work/, /service\s*roles/]
    },
    {
      id: "help-app-language",
      kind: "help",
      label: "App language / Dutch / browser language",
      blurb: "First visit uses the browser language when FloqR supports it (including Dutch / Nederlands). Otherwise English. Change it anytime under My Profile → App language.",
      steps: [
        "On first use, FloqR reads navigator.language (nl-NL becomes Dutch).",
        "If that language is not in the app list, chrome stays English.",
        "Open My Profile & Settings → App language to switch later (saved on this device and on your profile)."
      ],
      links: [
        {label: "App language (My Profile)", href: vUrl("./patron-portal.html", {from: "floqai"})}
      ],
      searchPhrases: [
        "app language", "dutch", "nederlands", "browser language", "first use language",
        "change language", "switch language", "ui language", "detect language"
      ],
      patterns: [
        /app\s*language/, /dutch/, /nederlands/, /browser\s*language/,
        /change\s*(the\s*)?(app\s*)?language/, /switch\s*(to\s*)?(dutch|nederlands|english)/,
        /detect\s*(my\s*)?language/, /first\s*use\s*language/
      ]
    },
    {
      id: "help-template-catalog-report",
      kind: "help",
      label: "Template catalog / which templates fit which LED",
      blurb: "Reports → Template catalog lists template types and Is96x48 / Is64x48 / Is64x32. Split-media birthday templates are offered on 64×32 as a photo/shoutout loop. A club only shows templates that overlap its VenueSupports* flags.",
      steps: [
        "Open Club Admin → Reports for this venue’s offered vs hidden templates.",
        "Open Master Admin → Reports → Template Catalog for the full network catalog.",
        "Is* flags live on templates; VenueSupports* live on clubLocations."
      ],
      links: [
        {label: "Club Admin Reports", href: vUrl("./admin.html", {from: "floqai", tab: "reports"})},
        {label: "Master Admin Template Catalog", href: vUrl("./master-admin.html", {from: "floqai", tab: "templateCatalogReport"})}
      ],
      searchPhrases: [
        "template catalog", "template types", "which templates", "Is96x48", "display sizes",
        "template report", "split media templates"
      ],
      patterns: [
        /template\s*catalog/, /which\s+templates/, /template\s*types/, /is96x48/, /display\s*sizes/
      ]
    },
    {
      id: "help-club-display-screens",
      kind: "help",
      label: "FLOQR display screens / LED sizes",
      blurb: "Club Public Profile stores VenueSupports96x48 / 64x48 / 64x32 on clubLocations. Templates store Is96x48 / Is64x48 / Is64x32. A club only offers templates that share a 1. Xibo stays display.html?location=id — never ?screen=.",
      steps: [
        "Open Club Admin → Club Public Profile → FLOQR display screens.",
        "Check only the LED sizes installed at the venue. Save writes VenueSupports* 0|1 to Firebase.",
        "Master Admin template save writes matching Is* flags on templates.",
        "Paste display.html?location=<id> (and display2.html for Display 2) into Xibo. Do not add ?screen=."
      ],
      links: [
        {label: "Club Public Profile display screens", href: vUrl("./admin.html", {from: "floqai", tab: "public-profile"})}
      ],
      searchPhrases: [
        "display screens", "64x48", "96x48", "64x32", "xibo url", "led size",
        "VenueSupports96x48", "Is96x48", "birthday template screen", "screen datapoint"
      ],
      patterns: [
        /display\s*screens?/, /venue\s*supports/, /is96x48/, /64\s*[x×]\s*48/, /96\s*[x×]\s*48/,
        /xibo\s*(url|display)/, /screen\s*datapoint/
      ]
    },
    {
      id: "help-staff-schedule-grid",
      kind: "help",
      label: "Scheduler / Round Robin",
      blurb: "Club Admin → Scheduling → Scheduler. Published shifts stay pending until the worker confirms via Inbox / Email / SMS / WhatsApp. Select shifts to multi-delete. Website ingest publishes JSON / RSS / iframe. Round Robin fills days fairly.",
      steps: [
        "Open Club Admin → Scheduling (after paid this month).",
        "Manual: click + on a person/day cell, set times, Save as draft.",
        "Round Robin: pick days + role, Fill → drafts, review chips.",
        "Publish schedule to notify workers. Shifts stay pending until they confirm.",
        "Select shifts to delete several at once (day header + chips), or open a chip for single Delete.",
        "Website ingest: rotate a secret and paste JSON, RSS, or iframe onto the club site."
      ],
      links: [
        {label: "Club Admin Scheduler", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      searchPhrases: [
        "schedule grid", "round robin", "publish schedule", "week calendar", "shift chips",
        "staff schedule", "assign shift", "worker photo", "7shifts",
        "pending shift", "confirmed shift", "delete shift", "require approval",
        "select shifts", "multi delete", "user guide"
      ],
      patterns: [
        /round\s*robin/, /publish\s*schedule/, /schedule\s*grid/, /week\s*calendar/,
        /shift\s*chips?/, /staff\s*schedule/, /assign\s*shift/, /open\s*minus/, /copy\s*previous\s*week/,
        /venue\s*hours/, /opening\s*hours/, /public\s*holiday/, /select\s*shifts/, /multi[\s-]?delete/,
        /website\s*ingest/, /iframe\s*schedule/, /rss\s*(feed|schedule)/
      ]
    },
    {
      id: "help-staff-schedule-user-guide",
      kind: "help",
      label: "Staff Scheduling User Guide",
      blurb: "Open the ? beside Scheduler: create drafts, publish so workers confirm, then select and delete several shifts (for example all Wednesday drafts plus a Thursday confirmed chip).",
      steps: [
        "Open Club Admin → Scheduling (unlocked when staffSchedulingPaid=1 / paid this month).",
        "Tap + on a person/day cell, set role and times, leave Save as draft checked, then Save shift. Optional: Round Robin or Copy previous week.",
        "Review dashed draft chips, then tap Publish schedule. Workers get Inbox / Email / SMS / WhatsApp with a confirm link.",
        "Published chips stay pending until the worker confirms.",
        "Tap Select shifts. Filter Drafts + Wednesday header, then tap a Thursday confirmed chip, then Delete selected."
      ],
      links: [
        {label: "Scheduler help", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      searchPhrases: [
        "user guide", "staff scheduling user guide", "create a schedule", "publish schedule",
        "how to schedule staff", "scheduling help"
      ],
      patterns: [
        /user\s*guide/, /staff\s*scheduling\s*user\s*guide/, /how\s+to\s+(create|publish)\s+(a\s+)?schedule/,
        /create\s+(a\s+)?(staff\s+)?schedule/, /publish\s+(the\s+)?schedule/
      ]
    },
    {
      id: "help-create-publish-schedule",
      kind: "help",
      label: "Create and publish a staff schedule",
      blurb: "Add draft shifts on the week grid, then Publish schedule. Workers confirm pending shifts before they become confirmed.",
      steps: [
        "Open Club Admin → Scheduling after the venue is paid this month.",
        "Tap + on a cell, set worker/role/times, Save as draft. Repeat, or Round Robin / Copy previous week.",
        "Tap Publish schedule. Shifts become pending and workers are notified to confirm.",
        "The worker uses the confirm link. The chip then shows confirmed."
      ],
      links: [
        {label: "Create and publish (Scheduler)", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      searchPhrases: [
        "create a schedule", "create schedule", "publish schedule", "how to publish a schedule",
        "how to schedule staff", "make a work schedule", "save as draft"
      ],
      patterns: [
        /create\s+(a\s+)?(work\s+|staff\s+)?schedule/, /publish\s+(a\s+|the\s+)?schedule/,
        /how\s+to\s+schedule\s+staff/, /save\s+as\s+draft/, /make\s+(me\s+)?(a\s+)?schedule/
      ]
    },
    {
      id: "help-multi-delete-shifts",
      kind: "help",
      label: "Delete multiple scheduled or draft shifts",
      blurb: "Select shifts, mix day headers and chips, then Delete selected. Example: all Wednesday drafts plus one Thursday confirmed shift.",
      steps: [
        "On the week grid, tap Select shifts.",
        "Choose Drafts, then tap the Wednesday column header to select every Wednesday draft.",
        "Switch the filter to All or Confirmed and tap the Thursday confirmed chip.",
        "Tap Delete selected and confirm."
      ],
      links: [
        {label: "Multi-delete (Scheduler)", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})}
      ],
      searchPhrases: [
        "multi delete", "delete multiple shifts", "delete wednesday drafts", "delete confirmed shift",
        "select shifts", "bulk delete shifts", "delete drafts"
      ],
      patterns: [
        /multi[\s-]?delete/, /delete\s+multiple/, /delete\s+(all\s+)?(wednesday|thursday|friday)?\s*drafts/,
        /delete\s+(a\s+)?confirmed\s+shift/, /select\s+shifts/, /bulk\s+delete\s+shifts/
      ]
    },
    {
      id: "help-staff-worksheet",
      kind: "help",
      label: "Work Sheet - Weekly Staff Calendar",
      blurb: "Elected staff open Work Calendar for pending assignments (tick / Select all / Approve selected) plus a people × days grid of published colleague shifts.",
      steps: [
        "Sign in as the assigned service member.",
        "Open the Inbox link or My Profile → Work Calendar.",
        "Review pending shifts, tick them or Select all, then Approve selected. The link itself does not confirm.",
        "Pick the club if you work at more than one venue. Your row is highlighted. Drafts are not shown."
      ],
      links: [
        {label: "Work Calendar", href: vUrl("./patron-portal.html", {from: "floqai", tab: "work-calendar"})},
        {label: "Work Sheet", href: vUrl("./staff-worksheet.html", {from: "floqai"})},
        {label: "My Profile", href: vUrl("./patron-portal.html", {from: "floqai"})}
      ],
      searchPhrases: [
        "staff calendar", "work sheet", "worksheet", "weekly staff calendar",
        "colleague schedule", "who is working", "confirm shift", "approve selected"
      ],
      patterns: [
        /staff\s*calendar/, /work\s*sheet/, /weekly\s*staff\s*calendar/,
        /who\s+is\s+working/, /colleague\s+schedule/, /confirm\s*(my\s*)?shift/, /approve\s*selected/
      ]
    },
    {
      id: "help-venue-website-ingest",
      kind: "help",
      label: "Club website ingest (API, RSS, iframe)",
      blurb: "Generate a venue secret in Club Admin Scheduling, then pull Confirmed assignments onto the official website with JSON, RSS, or an iframe. Draft, Pending, Open, cancelled, and staffing requirements never appear.",
      steps: [
        "Open Club Admin → Scheduling → Website ingest.",
        "Tap Generate / rotate secret and copy the yellow URLs immediately.",
        "Paste the JSON URL, RSS feed, or iframe snippet onto the club website.",
        "The feed ignores any status= query and returns Confirmed only. Optional datasets: schedule, hours, profile, or all."
      ],
      links: [
        {label: "Website ingest", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"}) + "#schedWebsiteIngest"}
      ],
      searchPhrases: [
        "website ingest", "club website schedule", "rss feed", "iframe schedule",
        "schedule api", "ingest secret", "embed staff schedule", "official website"
      ],
      patterns: [
        /website\s*ingest/, /schedule\s*api/, /rss\s*(feed|schedule)/,
        /iframe\s*(schedule|embed)/, /ingest\s*secret/, /official\s*website/
      ]
    },
    {
      id: "help-venue-hours-calendar",
      kind: "help",
      label: "Venue opening hours / public holidays",
      blurb: "Club Public Profile shows a Sun–Sat week grid with the covered dates. Upcoming holidays list open/close hours, especially when they differ from the usual weekday.",
      links: [
        {label: "Club Public Profile hours", href: vUrl("./admin.html", {from: "floqai", tab: "publicProfile"})}
      ],
      searchPhrases: ["venue hours", "opening hours", "club schedule", "public holiday", "period override"],
      patterns: [/venue\s*hours/, /opening\s*hours/, /public\s*holiday/, /period\s*override/, /open\/closed/]
    },
    {
      id: "help-venue-crawl-datapoints",
      kind: "help",
      label: "AI crawl venue datapoints",
      blurb: "Discovery crawl parses Club Public Profile fields: contact, socials, genres/DJs/promoters, amenities, dress/age, hoursStructured + timeZone, media, and display formats before approval.",
      links: [
        {label: "Master Admin Discovery", href: vUrl("./master-admin.html", {from: "floqai"})}
      ],
      searchPhrases: [
        "ai crawl", "discovery crawl", "venue datapoints", "impactful datapoints",
        "crawl ingest", "parse venue", "hoursStructured"
      ],
      patterns: [/ai\s*crawl/, /discovery\s*crawl/, /venue\s*datapoints?/, /impactful\s*datapoints?/, /crawl\s*ingest/]
    },
    {
      id: "help-my-profile",
      kind: "help",
      label: "My Profile & Settings",
      blurb: "Account, identity, seller tools, and links into role / service onboarding.",
      links: [
        {label: "My Profile & Settings", href: vUrl("./patron-portal.html", {from: "floqai"})},
        {label: "Onboarding / role request", href: vUrl("./role-request.html", {from: "floqai"})}
      ],
      searchPhrases: ["my profile", "profile and settings", "settings", "account", "my profile & settings"],
      patterns: [/my\s+profile/, /profile\s*(and\s*)?settings/, /\bsettings\b/, /\baccount\b/]
    },
    {
      id: "help-dj",
      kind: "help",
      label: "Become a DJ on FLOQR",
      blurb: "Elect DJ as your service role, associate with clubs, and optionally subscribe to Staff Scheduling ($20/mo) for bookings.",
      steps: [
        "Request DJ access and pick your clubs.",
        "Wait for club approval of your association.",
        "Use Scheduling for notify-and-approve bookings."
      ],
      links: [
        {label: "Request DJ access", href: vUrl("./role-request.html", {from: "floqai", type: "dj"})},
        {label: "DJ / Staff Scheduling", href: vUrl("./scheduling.html", {from: "floqai"})},
        {label: "Role profiles", href: vUrl("./role-profiles.html", {from: "floqai"})}
      ],
      patterns: [
        /\bdj\b/, /disc\s*jockey/, /resident\s*dj/, /want\s+to\s+be\s+(a\s*)?dj/,
        /i\s+want\s+to\s+be\s+able\s+to\s+.*(dj|spin|play\s*music)/
      ]
    },
    {
      id: "help-promoter",
      kind: "help",
      label: "Become a Promoter",
      blurb: "Independent or company-affiliated promoters request association, then drive guest lists and campaigns.",
      steps: [
        "Request Promoter access and name your public / company identity.",
        "Select clubs you promote for and submit.",
        "After approval, use guest-list and marketing tools."
      ],
      links: [
        {label: "Request Promoter access", href: vUrl("./role-request.html", {from: "floqai", type: "promoter"})},
        {label: "Guest list", href: vUrl("./guest-list.html", {from: "floqai"})},
        {label: "Scheduling for promoting companies", href: vUrl("./scheduling.html", {from: "floqai"})},
        {label: "Role profiles", href: vUrl("./role-profiles.html", {from: "floqai"})}
      ],
      patterns: [
        /promot(er|ion)/, /street\s*team/, /want\s+to\s+be\s+(a\s*)?promot/,
        /i\s+want\s+to\s+be\s+able\s+to\s+.*(promot|guest\s*list|campaign)/
      ]
    },
    {
      id: "help-hospitality",
      kind: "help",
      label: "Join hospitality / bottle service staff",
      blurb: "Waiters, waitresses, bottle girls, and related roles request worker association; club admins approve and can designate CSR.",
      steps: [
        "Choose hospitality (or bartender) on Role Request.",
        "Pick a service specialty and your clubs.",
        "Club Admin approves — then you can be scheduled / messaged."
      ],
      links: [
        {label: "Request hospitality access", href: vUrl("./role-request.html", {from: "floqai", type: "hospitality"})},
        {label: "Request bartender access", href: vUrl("./role-request.html", {from: "floqai", type: "bartender"})},
        {label: "Role profiles", href: vUrl("./role-profiles.html", {from: "floqai"})}
      ],
      patterns: [
        /hospitality/, /waitress/, /waiter/, /bottle\s*girl/, /bottle\s*service\s*staff/,
        /bartender/, /barman/, /want\s+to\s+(work|serve)\s+(at|in)\s*(a\s*)?club/,
        /i\s+want\s+to\s+be\s+able\s+to\s+.*(serve|bottle|bar)/
      ]
    },
    {
      id: "help-media-creator",
      kind: "help",
      label: "Join as videographer / media creator",
      blurb: "Camera and media roles associate with clubs the same way other service members do.",
      links: [
        {label: "Request media creator access", href: vUrl("./role-request.html", {from: "floqai", type: "mediaCreator"})},
        {label: "Role profiles", href: vUrl("./role-profiles.html", {from: "floqai"})}
      ],
      patterns: [
        /videograph/, /camera\s*operat/, /photographer/, /media\s*creator/, /cinematograph/
      ]
    },
    {
      id: "help-service-member",
      kind: "help",
      label: "Become a service member",
      blurb: "All users start as patrons. Elect from My Profile so IsServiceMember is 1 and IsPatron is 0, then open Settings → Services & Service Members to request a role and club association.",
      steps: [
        "Open My Profile & Settings → My Profile and elect to become a service member if the tab is hidden.",
        "Open Services & Service Members and pick the role that matches how you work nightlife.",
        "Select clubs and submit — each club must approve.",
        "Club Admins use Review & elect on the same tab to approve or elect patrons."
      ],
      links: [
        {label: "Services & Service Members", href: vUrl("./patron-portal.html", {from: "floqai", tab: "service-members"})},
        {label: "My Profile & Settings", href: vUrl("./patron-portal.html", {from: "floqai"})},
        {label: "How roles work", href: vUrl("./role-profiles.html", {from: "floqai"})}
      ],
      patterns: [
        /service\s*member/, /work\s*(for|with|at)\s*(a\s*)?(club|venue)/,
        /additional\s*access/, /elect\s*(myself|a\s*role)/,
        /i\s+want\s+to\s+be\s+able\s+to\s+.*(work|help|staff)/,
        /how\s+do\s+i\s+(get|become|request)\s+(access|a\s*role)/
      ]
    },
    {
      id: "help-general-notifications",
      kind: "help",
      label: "General Notifications (Email / SMS)",
      blurb: "SOS2FA and other FloqR system messages follow these flags as set in a patrons your user record. Venues or specific independent service members need to subscribe to paid SMS/WhatsApp Twilio services",
      steps: [
        "Open My Profile & Settings → My Privacy.",
        "Use the ? beside General Notifications (Email / SMS) for the full note.",
        "Tick Email notifications and/or SMS notifications, then Save Privacy Preferences."
      ],
      links: [
        {label: "My Privacy", href: vUrl("./patron-portal.html", {from: "floqai", tab: "privacy"})}
      ],
      searchPhrases: [
        "general notifications", "email notifications", "sms notifications", "notifyEmail", "notifySms",
        "sos2fa", "twilio", "paid sms", "whatsapp"
      ],
      patterns: [
        /general\s+notifications/, /email\s+notifications?/, /sms\s+notifications?/,
        /notify\s*(email|sms)/, /sos2fa/, /twilio/, /paid\s+sms/
      ]
    },
    {
      id: "help-guest-list",
      kind: "help",
      label: "Get on a guest list",
      blurb: "Join a venue guest list from Search or the dedicated guest-list page for that club.",
      links: [
        {label: "Guest list", href: vUrl("./guest-list.html", {from: "floqai"})},
        {label: "Find a club first", href: `./?v=${APP_V}&start=search`}
      ],
      patterns: [/guest\s*list/, /guestlist/, /rsvp/, /get\s*on\s*(the\s*)?list/]
    },
    {
      id: "help-scheduling",
      kind: "help",
      label: "Staff Scheduling help",
      blurb: "Clubs, promoting companies, and DJs unlock Staff Scheduling when staffSchedulingPaid=1 (demo venues or $20/mo Stripe). Unpaid (0) shows Subscribe; paid shows the calendar workspace. Create drafts, Publish schedule (workers confirm pending→confirmed on Work Calendar), Select shifts to multi-delete. Edit System Message copy under Notifications → Message templates.",
      links: [
        {label: "Scheduling portal", href: vUrl("./scheduling.html", {from: "floqai"})},
        {label: "Club Admin Scheduling tab", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})},
        {label: "Message templates", href: vUrl("./admin.html", {from: "floqai", tab: "notifications", notify: "templates"})},
        {label: "Role profiles (who can subscribe)", href: vUrl("./role-profiles.html", {from: "floqai"})}
      ],
      patterns: [/schedul/, /shift/, /staff\s*calendar/, /notify\s*(and\s*)?approve/]
    },
    {
      id: "help-shoutout",
      kind: "help",
      label: "How to throw a ShoutOut",
      blurb: "Pick a club, choose a template (free Black & White Classic, or FloqAi for paid themes), pay if needed, and send to the live display.",
      links: [
        {label: "Start ShoutOut", href: `./?v=${APP_V}&start=search`},
        {label: "Ask FloqAi for templates", href: `./?v=${APP_V}&start=intent`}
      ],
      patterns: [/how\s+(do\s+i|to)\s+(throw|send|make)\s*(a\s*)?shout/, /want\s+to\s+(throw|send)\s*(a\s*)?shout/]
    },
    {
      id: "help-soccer-jersey",
      kind: "help",
      label: "Soccer jersey ShoutOut",
      blurb: "Search Soccer, Jersey, or a country/club name (Tanzania, Chelsea). Cards show the real LED kit. Pick name + 2-character mark. Boards: 96×48, 64×48, 64×32.",
      links: [
        {label: "Start ShoutOut", href: `./?v=${APP_V}&start=search`},
        {label: "Ask FloqAi for jersey templates", href: `./?v=${APP_V}&start=intent`}
      ],
      patterns: [/soccer\s*jersey/, /\bjersey\b/, /tanzania\s*jersey/, /football\s*kit/, /country\s*jersey/, /club\s*jersey/]
    },
    {
      id: "help-sell-bartr",
      kind: "help",
      label: "Sell on BartR",
      blurb: "U.S. patrons and service members can manage a seller store from My Profile; shoppers buy on BartR / commerce.",
      links: [
        {label: "My Profile — seller tools", href: vUrl("./patron-portal.html", {from: "floqai"})},
        {label: "Browse BartR marketplace", href: vUrl("./commerce.html", {from: "floqai"})}
      ],
      patterns: [/sell\s*(on\s*)?(bartr|marketplace)/, /become\s*(a\s*)?seller/, /list\s*(a\s*)?product/]
    },
    {
      id: "help-vip",
      kind: "help",
      label: "VIP / bottle / table help",
      blurb: "VIP and bottle flows are venue-scoped. Find the club, then use VIP / guest-list / venue links from the club profile.",
      links: [
        {label: "Find a club", href: `./?v=${APP_V}&start=search`},
        {label: "Guest list", href: vUrl("./guest-list.html", {from: "floqai"})}
      ],
      patterns: [/\bvip\b/, /bottle\s*service/, /table\s*service/, /reserve\s*(a\s*)?table/]
    },
    {
      id: "help-onboarding",
      kind: "help",
      label: "Onboarding",
      blurb: "Patrons start here, then request service roles. Master Admins can also onboard crawled venues into Firestore.",
      steps: [
        "Create / sign in as a FLOQR patron.",
        "Open role onboarding to request Club Admin, DJ, Promoter, or hospitality.",
        "Select clubs and submit — each club must approve.",
        "Master Admins: use Venue onboarding to push club profiles, events, and media."
      ],
      links: [
        {label: "Role / service onboarding", href: vUrl("./role-request.html", {from: "floqai"})},
        {label: "My Profile & Settings", href: vUrl("./patron-portal.html", {from: "floqai"})},
        {label: "Role profiles overview", href: vUrl("./role-profiles.html", {from: "floqai"})},
        {label: "Venue onboarding (Master Admin)", href: vUrl("./onboard-dc-venues.html", {from: "floqai"})}
      ],
      searchPhrases: [
        "onboarding", "link to onboarding", "onboard", "patron onboarding",
        "role onboarding", "service member onboarding", "venue onboarding",
        "onboard clubs", "onboard venues", "get started", "sign up help"
      ],
      patterns: [
        /\bonboard(ing)?\b/, /link\s+to\s+onboard/, /get\s+started/,
        /sign\s*up\s*(help|guide)?/, /new\s+(patron|user|member)/
      ]
    },
    {
      id: "help-mail-logging",
      kind: "help",
      label: "Mail Logging",
      blurb: "Master Admin Diagnostics → Mail Logging lists every system-generated SendGrid email (accepted, failed, delivered). Search status, kind, address, subject. Open a row for headers, body, TLS 1.3, and delivery events.",
      steps: [
        "Sign in as Master Admin.",
        "Open Diagnostics → Mail Logging.",
        "Filter by status or kind, or search to / subject / message id.",
        "Select a row to view headers, stored content, TLS, and SendGrid delivery events."
      ],
      links: [
        {label: "Mail Logging", href: vUrl("./master-admin.html", {from: "floqai"})}
      ],
      searchPhrases: [
        "mail logging", "email log", "sendgrid", "system mail", "preview links email",
        "tls 1.3", "mail delivery", "who sent that email"
      ],
      patterns: [
        /mail\s*log/, /email\s*log/, /system\s*(generated\s*)?(mail|email)/,
        /sendgrid/, /tls\s*1\.?3/, /preview\s*links\s*email/
      ]
    },
    {
      id: "help-general",
      kind: "help",
      label: "What can FloqAi help with?",
      blurb: "Say what you want in plain words — products (Mingl, RydR, BartR, ShoutOut), goals like “I want to be a Club Admin,” or help-popout phrases like “Onboarding.”",
      links: [
        {label: "Onboarding", href: vUrl("./role-request.html", {from: "floqai"})},
        {label: "Request a role / service access", href: vUrl("./role-request.html", {from: "floqai"})},
        {label: "My Profile", href: vUrl("./patron-portal.html", {from: "floqai"})},
        {label: "Role profiles", href: vUrl("./role-profiles.html", {from: "floqai"})},
        {label: "Classic Search", href: `./?v=${APP_V}&start=search`}
      ],
      searchPhrases: ["ask floqr", "floqai help", "help popout", "what can floqai"],
      patterns: [
        /help\s*me/, /how\s+do\s+i/, /i\s+want\s+to\s+be\s+able/,
        /what\s+can\s+(you|floqai|i)\s+(do|help)/, /show\s*me\s*how/,
        /need\s+help/, /guide\s*me/, /ask\s+floqr/
      ]
    }
  ];

  const INTENTS = [...HELP_INTENTS, ...PRODUCT_INTENTS];

  function normalizePhrase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&amp;/g, "&")
      .replace(/[“”"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function phraseScore(query, phrases = []) {
    const q = normalizePhrase(query);
    if (!q) return 0;
    let score = 0;
    phrases.forEach(raw => {
      const phrase = normalizePhrase(raw);
      if (!phrase) return;
      if (q === phrase) score += 5;
      else if (q.includes(phrase)) score += 3;
      else if (phrase.includes(q) && q.length >= 4) score += 2;
      else {
        const qWords = q.split(/[^a-z0-9+]+/).filter(w => w.length > 2);
        const pWords = phrase.split(/[^a-z0-9+]+/).filter(w => w.length > 2);
        const hits = pWords.filter(w => qWords.includes(w)).length;
        if (hits >= 2) score += hits;
        else if (hits === 1 && pWords.length === 1) score += 1.5;
      }
    });
    return score;
  }

  function collectPopoutIntents() {
    const fromRepo = typeof global.FLOQRHelpRepository?.toSearchIntents === "function"
      ? global.FLOQRHelpRepository.toSearchIntents()
      : [];
    const doc = global.document;
    if (doc && typeof global.FLOQRHelpRepository?.registerDomHelpPopouts === "function") {
      try { global.FLOQRHelpRepository.registerDomHelpPopouts(doc); } catch (error) {}
    }
    const refreshed = typeof global.FLOQRHelpRepository?.toSearchIntents === "function"
      ? global.FLOQRHelpRepository.toSearchIntents()
      : fromRepo;
    return refreshed;
  }

  function allIntents() {
    const seen = new Set();
    const merged = [];
    // Help repository first (includes every "?" popout verbiage), then curated product/help intents.
    [...collectPopoutIntents(), ...INTENTS].forEach(intent => {
      const key = intent.id || intent.label;
      if (seen.has(key)) {
        const existing = merged.find(row => (row.id || row.label) === key);
        if (existing) {
          existing.patterns = [...(existing.patterns || []), ...(intent.patterns || [])];
          if (!(existing.steps || []).length && (intent.steps || []).length) existing.steps = intent.steps;
          existing.searchPhrases = Array.from(new Set([...(existing.searchPhrases || []), ...(intent.searchPhrases || [])]));
        }
        return;
      }
      seen.add(key);
      merged.push({...intent, patterns: [...(intent.patterns || [])]});
    });
    return merged;
  }

  function looksLikeHelpQuery(q) {
    return /help|how\s+do\s+i|i\s+want\s+to\s+be|become|request\s+access|service\s*member|role|admin|promot|dj|waitress|bartender|schedul|onboard|link\s+to|profile|settings|user\s*guide|multi[\s-]?delete|publish\s*schedule/.test(q);
  }

  function matchIntents(raw) {
    const q = normalizePhrase(raw);
    if (!q) return [];
    const helpBias = looksLikeHelpQuery(q) ? 1.5 : 1;
    const scored = allIntents().map(intent => {
      let score = 0;
      (intent.patterns || []).forEach(re => { if (re.test(q)) score += intent.kind === "help" ? helpBias : 1; });
      const labelKey = normalizePhrase(intent.label).replace(/^trade by /, "");
      if (labelKey && q.includes(labelKey)) score += 2.5;
      score += phraseScore(q, intent.searchPhrases || []);
      if (intent.source === "help-popout" && score > 0) score += 0.75;
      if (intent.kind === "help" && /i\s+want\s+to\s+be\s+able/.test(q) && score > 0) score += 1;
      return {intent, score};
    }).filter(row => row.score > 0);
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.intent.kind === "help" && b.intent.kind !== "help") return -1;
      if (b.intent.kind === "help" && a.intent.kind !== "help") return 1;
      return 0;
    });
    return scored.map(row => row.intent);
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHelpCard(intent) {
    const steps = (intent.steps || []).map(step => `<li>${esc(step)}</li>`).join("");
    const links = (intent.links || []).map(link =>
      `<a class="intent-help-link" href="${esc(link.href)}">${esc(link.label)}</a>`
    ).join("");
    return `
      <article class="card intent-result-card intent-help-card" data-intent="${esc(intent.id)}" data-kind="help">
        <p class="eyebrow">I want to be able to…</p>
        <strong>${esc(intent.label)}</strong>
        <span>${esc(intent.blurb)}</span>
        ${steps ? `<ol class="intent-help-steps">${steps}</ol>` : ""}
        <div class="floqai-help-links intent-help-link-row">${links}</div>
      </article>`;
  }

  function renderProductCard(intent) {
    return `
      <a class="card intent-result-card" href="${esc(intent.href)}" data-intent="${esc(intent.id)}" data-kind="product">
        <strong>${esc(intent.label)}</strong>
        <span>${esc(intent.blurb)}</span>
      </a>`;
  }

  function renderResults(container, intents, query) {
    if (!container) return;
    if (!String(query || "").trim()) {
      container.innerHTML = "";
      return;
    }
    if (!intents.length) {
      container.innerHTML = `<div class="card intent-result-empty"><strong>No clear match yet</strong><p class="sub small">Try a product (Mingl, RydR, BartR, ShoutOut), a goal like “I want to be a Club Admin,” or a help-popout phrase like “Onboarding” / “link to onboarding.”</p><div class="floqai-help-links"><a href="${vUrl("./role-request.html", {from: "floqai"})}">Onboarding / role access</a><a href="./?v=${APP_V}&start=search">Open classic Search</a></div></div>`;
      return;
    }
    container.innerHTML = intents.map(intent =>
      intent.kind === "help" ? renderHelpCard(intent) : renderProductCard(intent)
    ).join("");
  }

  function goPrimary(intents) {
    const top = intents[0];
    if (!top) return;
    if (top.kind === "help") {
      const first = (top.links || [])[0];
      if (first?.href) {
        global.location.href = first.href;
        return;
      }
    }
    if (top.action === "shoutout" && typeof global.showShoutoutLanding === "function") {
      global.showShoutoutLanding();
      return;
    }
    if (top.href) global.location.href = top.href;
  }

  function syncPatronCard(user, profile = {}) {
    const nameEl = document.getElementById("intentPatronName");
    const emailEl = document.getElementById("intentPatronEmail");
    if (!nameEl || !emailEl) return;
    if (!user) {
      nameEl.textContent = "Guest";
      emailEl.textContent = "Sign in from Welcome to unlock full status links";
      return;
    }
    nameEl.textContent = profile.displayName || user.displayName || user.email || "Patron";
    emailEl.textContent = user.email || "Signed in";
  }

  function bindIntentSearch(opts = {}) {
    const input = document.getElementById("intentSearchInput");
    const results = document.getElementById("intentSearchResults");
    if (!input) return;

    const run = () => {
      const matches = matchIntents(input.value);
      renderResults(results, matches, input.value);
      return matches;
    };

    input.addEventListener("input", run);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        const matches = run();
        if (matches.length === 1 || (matches.length && !event.shiftKey)) goPrimary(matches);
      }
    });

    results?.addEventListener("click", event => {
      const card = event.target.closest("[data-intent]");
      if (!card) return;
      if (card.dataset.kind === "help") return;
      if (card.dataset.intent === "shoutout" && typeof opts.onShoutout === "function") {
        event.preventDefault();
        opts.onShoutout();
      }
      if (card.dataset.intent === "mingl" && typeof opts.onMingl === "function") {
        event.preventDefault();
        opts.onMingl();
      }
    });
  }

  global.FLOQRIntentSearch = {
    matchIntents,
    bindIntentSearch,
    syncPatronCard,
    collectPopoutIntents,
    INTENTS,
    HELP_INTENTS,
    PRODUCT_INTENTS,
    helpRepository: () => global.FLOQRHelpRepository || null
  };
})(window);
