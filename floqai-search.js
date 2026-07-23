/* FloqAi idle float + speech bubbles + open contextual search */
(function (global) {
  "use strict";

  const HELP = "Tell me what you want to do — or say “I want to be able to…”";
  const LINE_HI = "Hi, I am FloqAi";
  const LINE_LOOK = "Tell me, what are you looking for?";
  const LINE_FEATURE = "Need to learn about a feature or do something else?";
  const LINE_WANT = 'Say “I want to be able to…” — for example, become a Club Admin';
  const LINE_SERVICE = "Patrons can request DJ, Promoter, hospitality, or Club Admin access";
  const LINE_HELP_LINKS = "I’ll answer with steps and links when you need help";
  const LINE_ONBOARD = 'Try “Onboarding” or “link to onboarding” for role and venue setup';
  const LINE_PRONOUNCE = 'pronounced Flo-ké (floh-KAY, with a crisp "é" sound)';
  const LINE_CONTEXT = "I am contextual, so speak freely to me";
  const LINE_USE_SEARCH = "Use me to search for templates";
  const TEMPLATE_RANDOM_LINES = [
    "Do you know the name of the paid template you intend to use?",
    "Enter Sports, for sports related templates, Cars, for exotic car related templates",
    "Humor for funny templates",
    "VIP for VIP Templates",
    "Video or Pictures for templates you can upload your images or video for ShoutOuts",
    "Powered by FloqR Social OS",
    "Ballers if you are balling and need baller's related templates...."
  ];
  const INTENT_RANDOM_LINES = [LINE_LOOK, LINE_FEATURE, LINE_WANT, LINE_SERVICE, LINE_HELP_LINKS, LINE_ONBOARD];
  const SHOW_MS = 3000;
  const HIDE_MS = 3000;

  let activeMode = "intent";
  let templateIntroStep = 0;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function isMobile() {
    return window.matchMedia("(max-width:720px), (pointer:coarse)").matches;
  }

  function setMode(mode) {
    activeMode = mode === "templates" ? "templates" : "intent";
    templateIntroStep = 0;
    document.body.classList.toggle("floqai-template-mode", activeMode === "templates");
  }

  function bindFloqAi(opts = {}) {
    const agent = document.getElementById("floqAiAgent");
    const mark = document.getElementById("floqAiMark");
    const speech = document.getElementById("floqAiSpeech");
    const speechText = document.getElementById("floqAiSpeechText") || speech;
    const panel = document.getElementById("floqAiSearchPanel");
    const input = document.getElementById("intentSearchInput") || document.getElementById("templateSearch");
    const helpEl = document.getElementById("floqAiHelpText");
    const logo = document.querySelector(".floqai-hero-logo") || document.querySelector(".intent-floqr-logo");
    if (!agent || !mark) return null;

    let speechTimer = null;
    let searchOpen = false;
    let raf = 0;
    let pos = {x: 0, y: 0};
    let from = {x: 0, y: 0};
    let to = {x: 0, y: 0};
    let moveStart = 0;
    let moveDur = 4200;
    let bobPhase = Math.random() * Math.PI * 2;
    let speechVisible = false;
    let lastBobY = 0;
    let recentLines = [];
    let nextIsHi = false;

    if (opts.mode) setMode(opts.mode);

    function floqrLogoFloor() {
      if (activeMode === "templates") {
        const host = document.getElementById("templateFloqAiHost") || document.getElementById("templateSelectPage");
        if (host) {
          const rect = host.getBoundingClientRect();
          return Math.max(80, Math.ceil(rect.top + 24));
        }
      }
      if (!logo || logo.classList.contains("hidden")) {
        return Math.round(window.innerHeight * (isMobile() ? 0.28 : 0.22));
      }
      const rect = logo.getBoundingClientRect();
      return Math.ceil(rect.bottom + (isMobile() ? 28 : 36));
    }

    function agentSize() {
      return {
        w: agent.offsetWidth || (isMobile() ? 72 : 96),
        h: agent.offsetHeight || (isMobile() ? 72 : 96)
      };
    }

    function bounds() {
      const mobile = isMobile();
      const {w, h} = agentSize();
      const padX = mobile ? 10 : 16;
      const padBottom = mobile ? 16 : 24;
      const userMenu = document.getElementById("userMenu") || document.querySelector(".user-menu");
      const menuBottom = userMenu ? Math.ceil(userMenu.getBoundingClientRect().bottom + 10) : 0;
      // Keep roam area inside the first phone viewport (no scroll required to see FloqAi).
      const visibleBottom = mobile
        ? Math.min(window.innerHeight, Math.round(window.visualViewport?.height || window.innerHeight))
        : window.innerHeight;
      const minTop = Math.max(floqrLogoFloor(), menuBottom, mobile ? 72 : 72);
      const softCeiling = mobile
        ? Math.round(visibleBottom * 0.72) - h
        : visibleBottom - padBottom - h;
      const maxTop = Math.max(minTop + 40, Math.min(visibleBottom - padBottom - h, softCeiling));
      const minLeft = padX;
      const maxLeft = Math.max(minLeft, window.innerWidth - padX - w);
      return {
        minTop,
        maxTop,
        minLeft,
        maxLeft,
        w,
        h,
        mobile
      };
    }

    function mobileMaxBubble() {
      return Math.min(280, window.innerWidth - 24);
    }

    function placeSpeechBubble() {
      if (!speech || !speechVisible) return;
      const pad = 10;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const agentRect = agent.getBoundingClientRect();
      const bubbleW = Math.min(speech.offsetWidth || 220, mobileMaxBubble());
      const bubbleH = speech.offsetHeight || 56;
      const cx = agentRect.left + agentRect.width / 2;
      let left = clamp(cx - bubbleW / 2, pad, vw - bubbleW - pad);
      let top = agentRect.top - bubbleH - 12;
      let place = "above";
      if (top < pad) {
        top = agentRect.bottom + 12;
        place = "below";
      }
      if (top + bubbleH > vh - pad) {
        top = clamp(agentRect.top - bubbleH - 12, pad, vh - bubbleH - pad);
        place = "above";
      }
      speech.style.left = `${Math.round(left)}px`;
      speech.style.top = `${Math.round(top)}px`;
      speech.dataset.place = place;
    }

    function applyPos(x, y, bobY = 0) {
      lastBobY = bobY;
      pos = {x, y};
      agent.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y + bobY)}px, 0)`;
      placeSpeechBubble();
    }

    function randomTarget(b) {
      return {
        x: b.minLeft + Math.random() * Math.max(1, b.maxLeft - b.minLeft),
        y: b.minTop + Math.random() * Math.max(1, b.maxTop - b.minTop)
      };
    }

    function pickNextMove() {
      const b = bounds();
      from = {x: pos.x, y: pos.y};
      to = randomTarget(b);
      if (Math.hypot(to.x - from.x, to.y - from.y) < (b.mobile ? 40 : 60)) to = randomTarget(b);
      moveStart = performance.now();
      moveDur = b.mobile ? 5200 + Math.random() * 3800 : 3800 + Math.random() * 3200;
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (!agent.classList.contains("is-idle") || searchOpen) {
        placeSpeechBubble();
        return;
      }
      const b = bounds();
      const t = clamp((now - moveStart) / moveDur, 0, 1);
      const e = easeInOut(t);
      bobPhase += b.mobile ? 0.018 : 0.022;
      applyPos(lerp(from.x, to.x, e), lerp(from.y, to.y, e), Math.sin(bobPhase) * (b.mobile ? 4 : 7));
      if (t >= 1) pickNextMove();
    }

    function wouldBeThirdRepeat(line) {
      return recentLines.length >= 2
        && recentLines[recentLines.length - 1] === line
        && recentLines[recentLines.length - 2] === line;
    }

    function rememberLine(line) {
      recentLines.push(line);
      if (recentLines.length > 8) recentLines.shift();
    }

    function pickRandomLine() {
      const poolSource = activeMode === "templates" ? TEMPLATE_RANDOM_LINES : INTENT_RANDOM_LINES;
      const options = poolSource.filter(line => !wouldBeThirdRepeat(line));
      const pool = options.length ? options : poolSource;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function nextLine() {
      if (activeMode === "templates" && templateIntroStep < 4) {
        const fixed = [LINE_HI, LINE_USE_SEARCH, LINE_PRONOUNCE, LINE_CONTEXT];
        const line = fixed[templateIntroStep++];
        rememberLine(line);
        return line;
      }
      if (nextIsHi) {
        nextIsHi = false;
        if (wouldBeThirdRepeat(LINE_HI)) {
          const line = pickRandomLine();
          rememberLine(line);
          nextIsHi = true;
          return line;
        }
        rememberLine(LINE_HI);
        return LINE_HI;
      }
      const line = pickRandomLine();
      rememberLine(line);
      nextIsHi = true;
      return line;
    }

    function hideSpeech() {
      speechVisible = false;
      if (!speech) return;
      speech.classList.remove("is-visible");
      speech.classList.add("is-hiding");
      speech.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        speech.classList.remove("is-hiding");
        if (speechText) speechText.textContent = "";
      }, 320);
    }

    function showSpeech(line) {
      if (!speech) return;
      speechVisible = true;
      if (speechText) speechText.textContent = line;
      else speech.textContent = line;
      speech.classList.remove("is-hiding");
      speech.classList.add("is-visible");
      speech.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        placeSpeechBubble();
        requestAnimationFrame(placeSpeechBubble);
      });
    }

    function scheduleSpeech(delay, show) {
      clearTimeout(speechTimer);
      speechTimer = setTimeout(() => {
        if (searchOpen || document.hidden) {
          scheduleSpeech(HIDE_MS, true);
          return;
        }
        if (show) {
          showSpeech(nextLine());
          scheduleSpeech(SHOW_MS, false);
        } else {
          hideSpeech();
          scheduleSpeech(HIDE_MS, true);
        }
      }, delay);
    }

    function openSearch() {
      searchOpen = true;
      clearTimeout(speechTimer);
      hideSpeech();
      agent.classList.remove("is-idle");
      opts.onOpenSearch?.(activeMode);
      if (activeMode === "templates") {
        const templateInput = document.getElementById("templateSearch");
        templateInput?.focus();
        templateInput?.scrollIntoView({behavior: "smooth", block: "center"});
      } else {
        panel?.classList.add("open");
        panel?.setAttribute("aria-hidden", "false");
        (document.getElementById("intentSearchInput") || input)?.focus();
      }
    }

    function closeSearch() {
      searchOpen = false;
      agent.classList.add("is-idle");
      panel?.classList.remove("open");
      panel?.setAttribute("aria-hidden", "true");
      pickNextMove();
      scheduleSpeech(700, true);
    }

    agent.addEventListener("click", () => {
      if (searchOpen) closeSearch();
      else openSearch();
    });

    if (helpEl) helpEl.textContent = activeMode === "templates" ? LINE_USE_SEARCH : HELP;

    window.addEventListener("resize", () => {
      const b = bounds();
      applyPos(clamp(pos.x, b.minLeft, b.maxLeft), clamp(pos.y, b.minTop, b.maxTop), lastBobY);
      pickNextMove();
      placeSpeechBubble();
    });

    agent.classList.add("is-idle");
    const b0 = bounds();
    pos = {
      x: b0.minLeft + (b0.maxLeft - b0.minLeft) * (b0.mobile ? 0.58 : 0.72),
      y: b0.minTop + (b0.maxTop - b0.minTop) * (b0.mobile ? 0.28 : 0.4)
    };
    applyPos(pos.x, pos.y);
    pickNextMove();
    raf = requestAnimationFrame(tick);
    scheduleSpeech(700, true);

    return {openSearch, closeSearch, setMode, HELP};
  }

  let boundController = null;

  function ensureTemplateMode() {
    setMode("templates");
    if (!boundController) boundController = bindFloqAi({mode: "templates"});
    else boundController.setMode?.("templates");
    const mount = document.getElementById("templateFloqAiMount");
    if (mount) {
      mount.innerHTML = '<p class="sub small floqai-template-hint">FloqAi is pulsating on this screen — tap the mark to search templates (Sports, Jersey, VIP, Humor, Cars, Video, Pictures, Ballers).</p>';
    }
    document.getElementById("floqAiAgent")?.classList.add("is-idle");
  }

  global.FLOQRFloqAi = {
    bindFloqAi(opts) {
      boundController = bindFloqAi(opts);
      return boundController;
    },
    ensureTemplateMode,
    setMode,
    HELP,
    LINES: {
      LINE_HI,
      LINE_LOOK,
      LINE_FEATURE,
      LINE_WANT,
      LINE_SERVICE,
      LINE_HELP_LINKS,
      LINE_ONBOARD,
      LINE_USE_SEARCH,
      LINE_PRONOUNCE,
      LINE_CONTEXT,
      TEMPLATE_RANDOM_LINES,
      INTENT_RANDOM_LINES
    }
  };
})(window);
