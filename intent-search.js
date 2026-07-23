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
      id: "help-club-admin",
      kind: "help",
      label: "Become a Club Admin",
      blurb: "Patrons can request Club Admin access. A venue must approve your association before you can manage that club.",
      steps: [
        "Sign in as a FLOQR patron (everyone starts here).",
        "Open Role Request and choose Club Admin.",
        "Select the club(s) you work with and submit.",
        "After approval, open Club Admin for that location."
      ],
      links: [
        {label: "Request Club Admin access", href: vUrl("./role-request.html", {from: "floqai", type: "clubAdmin"})},
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
      blurb: "All users start as patrons. Elect a service role (DJ, promoter, hospitality, bartender, media, or Club Admin) and request club association.",
      steps: [
        "Open Role Request from your profile.",
        "Pick the role that matches how you work nightlife.",
        "Select clubs and submit — each club must approve."
      ],
      links: [
        {label: "Request service / role access", href: vUrl("./role-request.html", {from: "floqai"})},
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
      blurb: "Clubs, promoting companies, and DJs can subscribe to Scheduling ($20/mo) — not individual events. Notify workers and collect approvals.",
      links: [
        {label: "Scheduling portal", href: vUrl("./scheduling.html", {from: "floqai"})},
        {label: "Club Admin Scheduling tab", href: vUrl("./admin.html", {from: "floqai", tab: "scheduling"})},
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
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(intent);
    });
    return merged;
  }

  function looksLikeHelpQuery(q) {
    return /help|how\s+do\s+i|i\s+want\s+to\s+be|become|request\s+access|service\s*member|role|admin|promot|dj|waitress|bartender|schedul|onboard|link\s+to|profile|settings/.test(q);
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
