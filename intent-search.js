/* FloqR plain-language intent router — maps wishes to products */
(function (global) {
  "use strict";

  const APP_V = (global.FLOQRNav && global.FLOQRNav.appVersion) || "29.09.9";

  const INTENTS = [
    {
      id: "mingl",
      label: "Mingl",
      blurb: "Meet people, chat, and social discovery.",
      href: `./?v=${APP_V}&start=mingl`,
      patterns: [/meet/, /mingl/, /date/, /social/, /someone/, /people/, /friend/, /chat/, /connect/, /match/]
    },
    {
      id: "rydr",
      label: "RydR",
      blurb: "Robotaxi or ultra-luxury ride to the venue.",
      href: `./rydr.html?v=${APP_V}&from=search`,
      patterns: [/ride/, /rydr/, /taxi/, /uber/, /lyft/, /pickup/, /\bcar\b/, /driver/, /robotaxi/, /chauffeur/, /luxury\s*ride/, /get\s*(me\s*)?(there|home)/]
    },
    {
      id: "bartr",
      label: "Trade by BartR",
      blurb: "Marketplace — barter and swag.",
      href: `./commerce.html?v=${APP_V}&from=search`,
      patterns: [/trade/, /bartr/, /buy/, /shop/, /swag/, /marketplace/, /sell/, /merch/, /product/]
    },
    {
      id: "shoutout",
      label: "Throw a ShoutOut",
      blurb: "Send a live message to a FloqR display.",
      href: `./?v=${APP_V}&start=search`,
      action: "shoutout",
      patterns: [/shout/, /display/, /led/, /message\s*board/, /birthday/, /congrats/, /announce/]
    },
    {
      id: "clubs",
      label: "Clubs & venues",
      blurb: "Browse clubs, lounges, beach clubs, and events.",
      href: `./?v=${APP_V}&start=search`,
      patterns: [/club/, /lounge/, /beach/, /event/, /nightlife/, /venue/, /party/, /tonight/]
    }
  ];

  function matchIntents(raw) {
    const q = String(raw || "").trim().toLowerCase();
    if (!q) return [];
    const scored = INTENTS.map(intent => {
      let score = 0;
      intent.patterns.forEach(re => { if (re.test(q)) score += 1; });
      if (q.includes(intent.label.toLowerCase().replace(/^trade by /, ""))) score += 2;
      return { intent, score };
    }).filter(row => row.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map(row => row.intent);
  }

  function renderResults(container, intents, query) {
    if (!container) return;
    if (!String(query || "").trim()) {
      container.innerHTML = "";
      return;
    }
    if (!intents.length) {
      container.innerHTML = `<div class="card intent-result-empty"><strong>No clear match yet</strong><p class="sub small">Try naming a product (Mingl, RydR, BartR, ShoutOut) or say what you want in plain words.</p><a class="buttonlike" href="./?v=${APP_V}&start=search">Open classic Search</a></div>`;
      return;
    }
    container.innerHTML = intents.map(intent => `
      <a class="card intent-result-card" href="${intent.href}" data-intent="${intent.id}">
        <strong>${intent.label}</strong>
        <span>${intent.blurb}</span>
      </a>`).join("");
  }

  function goPrimary(intents) {
    const top = intents[0];
    if (!top) return;
    if (top.action === "shoutout" && typeof global.showShoutoutLanding === "function") {
      global.showShoutoutLanding();
      return;
    }
    global.location.href = top.href;
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
    INTENTS
  };
})(window);
