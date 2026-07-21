/* FloqAi idle float + speech bubbles + open contextual search */
(function (global) {
  "use strict";

  const HELP = "Tell me, what are you looking for?";
  const LINE_HI = "Hi, I am FloqAi";
  const LINE_LOOK = "Tell me, what are you looking for?";
  const LINE_FEATURE = "Need to learn about a feature or do something else?";
  const RANDOM_LINES = [LINE_LOOK, LINE_FEATURE];
  const SHOW_MS = 3000;
  const HIDE_MS = 3000;

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

  function bindFloqAi(opts = {}) {
    const agent = document.getElementById("floqAiAgent");
    const mark = document.getElementById("floqAiMark");
    const speech = document.getElementById("floqAiSpeech");
    const speechText = document.getElementById("floqAiSpeechText") || speech;
    const panel = document.getElementById("floqAiSearchPanel");
    const input = document.getElementById("intentSearchInput");
    const helpEl = document.getElementById("floqAiHelpText");
    const page = document.getElementById("floqAiPage");
    const logo = document.querySelector(".floqai-hero-logo") || document.querySelector(".intent-floqr-logo");
    if (!agent || !mark) return;

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
    /* After each randomized line, next spoken line is Hi */
    let nextIsHi = false;

    function floqrLogoFloor() {
      if (!logo || logo.classList.contains("hidden")) {
        return Math.round(window.innerHeight * (isMobile() ? 0.28 : 0.22));
      }
      const rect = logo.getBoundingClientRect();
      const gap = isMobile() ? 28 : 36;
      return Math.ceil(rect.bottom + gap);
    }

    function agentSize() {
      return {
        w: agent.offsetWidth || (isMobile() ? 72 : 96),
        h: agent.offsetHeight || (isMobile() ? 72 : 96)
      };
    }

    function speechReserve() {
      /* Leave room so a bubble next to/above the icon can stay on-screen */
      const mobile = isMobile();
      return {
        x: mobile ? 8 : 12,
        y: mobile ? 64 : 72
      };
    }

    function bounds() {
      const mobile = isMobile();
      const {w, h} = agentSize();
      const reserve = speechReserve();
      const padX = mobile ? 10 : 16;
      const padBottom = mobile ? 18 : 24;
      const userMenu = document.getElementById("userMenu") || document.querySelector(".user-menu");
      const menuBottom = userMenu
        ? Math.ceil(userMenu.getBoundingClientRect().bottom + 10)
        : 0;

      const minTop = Math.max(floqrLogoFloor(), menuBottom, reserve.y);
      const maxTop = Math.max(minTop + 48, window.innerHeight - padBottom - h - (mobile ? 8 : 0));
      const minLeft = padX;
      const maxLeft = Math.max(minLeft, window.innerWidth - padX - w);

      const preferredMinTop = mobile
        ? Math.max(minTop, Math.round(window.innerHeight * 0.34))
        : minTop;

      return {
        minTop: preferredMinTop,
        maxTop,
        minLeft,
        maxLeft,
        w,
        h,
        mobile
      };
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
      const cy = agentRect.top + agentRect.height / 2;

      const candidates = [
        {place:"above", left: cx - bubbleW / 2, top: agentRect.top - bubbleH - 12},
        {place:"below", left: cx - bubbleW / 2, top: agentRect.bottom + 12},
        {place:"right", left: agentRect.right + 12, top: cy - bubbleH / 2},
        {place:"left", left: agentRect.left - bubbleW - 12, top: cy - bubbleH / 2}
      ];

      let best = null;
      for (const c of candidates) {
        const left = clamp(c.left, pad, vw - bubbleW - pad);
        const top = clamp(c.top, pad, vh - bubbleH - pad);
        const fullyVisible =
          left >= pad - 0.5 &&
          top >= pad - 0.5 &&
          left + bubbleW <= vw - pad + 0.5 &&
          top + bubbleH <= vh - pad + 0.5;
        /* Prefer placement that didn't need much clamp (stays near icon) */
        const drift = Math.abs(left - c.left) + Math.abs(top - c.top);
        if (fullyVisible && drift < 2) {
          best = {place:c.place, left, top, drift:0};
          break;
        }
        if (!best || drift < best.drift) best = {place:c.place, left, top, drift};
      }

      if (!best) {
        best = {
          place: "below",
          left: clamp(cx - bubbleW / 2, pad, vw - bubbleW - pad),
          top: clamp(agentRect.bottom + 12, pad, vh - bubbleH - pad),
          drift: 0
        };
      }

      speech.dataset.place = best.place;
      speech.style.position = "fixed";
      speech.style.left = `${best.left}px`;
      speech.style.top = `${best.top}px`;
      speech.style.right = "auto";
      speech.style.bottom = "auto";
      speech.style.transform = "none";
    }

    function mobileMaxBubble() {
      return Math.min(isMobile() ? window.innerWidth - 20 : 280, window.innerWidth - 20);
    }

    function applyPos(x, y, bobY = 0) {
      const {minTop, maxTop, minLeft, maxLeft} = bounds();
      pos.x = clamp(x, minLeft, maxLeft);
      pos.y = clamp(y, minTop, maxTop);
      lastBobY = bobY;
      agent.style.left = `${pos.x}px`;
      agent.style.top = `${pos.y + bobY}px`;
      agent.style.right = "auto";
      placeSpeechBubble();
    }

    function randomTarget(b) {
      const spanX = Math.max(0, b.maxLeft - b.minLeft);
      const spanY = Math.max(0, b.maxTop - b.minTop);
      let nx;
      let ny;
      if (!b.mobile) {
        nx = 0.35 + Math.random() * 0.65;
        ny = 0.15 + Math.random() * 0.85;
      } else {
        nx = 0.08 + Math.random() * 0.84;
        ny = 0.25 + Math.random() * 0.7;
      }
      return {
        x: b.minLeft + nx * spanX,
        y: b.minTop + ny * spanY
      };
    }

    function pickNextMove() {
      const b = bounds();
      from = {x: pos.x, y: pos.y};
      to = randomTarget(b);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (Math.hypot(dx, dy) < (b.mobile ? 40 : 60)) {
        to = randomTarget(b);
      }
      moveStart = performance.now();
      moveDur = b.mobile
        ? 5200 + Math.random() * 3800
        : 3800 + Math.random() * 3200;
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
      const x = lerp(from.x, to.x, e);
      const y = lerp(from.y, to.y, e);

      bobPhase += b.mobile ? 0.018 : 0.022;
      const bobAmp = b.mobile ? 4 : 7;
      const bobY = Math.sin(bobPhase) * bobAmp;

      applyPos(x, y, bobY);
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
      const options = RANDOM_LINES.filter(line => !wouldBeThirdRepeat(line));
      const pool = options.length ? options : RANDOM_LINES;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function nextLine() {
      if (nextIsHi) {
        nextIsHi = false;
        /* Hi always follows a randomized line (3s gap handled by hide timer) */
        if (wouldBeThirdRepeat(LINE_HI)) {
          /* Extremely unlikely; fall back to a random line instead of 3× Hi */
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
      nextIsHi = true; /* after this randomized line is shown, Hi comes next */
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
          /* 3s after randomized text finishes → Hi; same cadence between all lines */
          scheduleSpeech(HIDE_MS, true);
        }
      }, delay);
    }

    function openSearch() {
      searchOpen = true;
      clearTimeout(speechTimer);
      hideSpeech();
      agent.classList.add("is-idle");
      if (helpEl) helpEl.textContent = HELP;
      if (panel) panel.classList.add("open");
      if (page) page.classList.add("search-open");
      if (input) {
        input.setAttribute("placeholder", "Type in plain words…");
        input.focus();
      }
      if (typeof opts.onOpenSearch === "function") opts.onOpenSearch();
    }

    agent.addEventListener("click", event => {
      event.preventDefault();
      openSearch();
    });

    agent.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSearch();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearTimeout(speechTimer);
        hideSpeech();
      } else if (!searchOpen) {
        scheduleSpeech(600, true);
      }
    });

    window.addEventListener("resize", () => {
      const b = bounds();
      applyPos(clamp(pos.x, b.minLeft, b.maxLeft), clamp(pos.y, b.minTop, b.maxTop), lastBobY);
      pickNextMove();
      placeSpeechBubble();
    });

    agent.classList.add("is-idle");
    const b0 = bounds();
    pos = {
      x: b0.minLeft + (b0.maxLeft - b0.minLeft) * (b0.mobile ? 0.62 : 0.72),
      y: b0.minTop + (b0.maxTop - b0.minTop) * (b0.mobile ? 0.55 : 0.45)
    };
    applyPos(pos.x, pos.y);
    pickNextMove();
    raf = requestAnimationFrame(tick);
    /* First line soon after load */
    scheduleSpeech(700, true);

    return {
      openSearch,
      HELP
    };
  }

  global.FLOQRFloqAi = {
    bindFloqAi,
    HELP,
    LINES: {LINE_HI: "Hi, I am FloqAi", LINE_LOOK: "Tell me, what are you looking for?", LINE_FEATURE: "Need to learn about a feature or do something else?"}
  };
})(window);
