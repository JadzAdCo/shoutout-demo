/* FloqAi idle path + pop/explode phrase + open contextual search */
(function (global) {
  "use strict";

  const HELP = "Tell, how can I help you?";
  const IDLE_MS = 14000;
  const FIRST_POP_MS = 4200;

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
    const phrase = document.getElementById("floqAiPhrase");
    const panel = document.getElementById("floqAiSearchPanel");
    const input = document.getElementById("intentSearchInput");
    const helpEl = document.getElementById("floqAiHelpText");
    const page = document.getElementById("floqAiPage");
    const logo = document.querySelector(".floqai-hero-logo") || document.querySelector(".intent-floqr-logo");
    if (!agent || !mark) return;

    let idleTimer = null;
    let cycleBusy = false;
    let searchOpen = false;
    let raf = 0;
    let pos = {x: 0, y: 0};
    let from = {x: 0, y: 0};
    let to = {x: 0, y: 0};
    let moveStart = 0;
    let moveDur = 4200;
    let bobPhase = Math.random() * Math.PI * 2;

    function floqrLogoFloor() {
      if (!logo || logo.classList.contains("hidden")) {
        return Math.round(window.innerHeight * (isMobile() ? 0.28 : 0.22));
      }
      const rect = logo.getBoundingClientRect();
      /* Never rise into the FloqR logo band — keep a clear gap below it */
      const gap = isMobile() ? 28 : 36;
      return Math.ceil(rect.bottom + gap);
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
      const padBottom = mobile ? 18 : 24;
      const userMenu = document.getElementById("userMenu") || document.querySelector(".user-menu");
      const menuBottom = userMenu
        ? Math.ceil(userMenu.getBoundingClientRect().bottom + 10)
        : 0;

      const minTop = Math.max(floqrLogoFloor(), menuBottom);
      const maxTop = Math.max(minTop + 48, window.innerHeight - padBottom - h);
      const minLeft = padX;
      const maxLeft = Math.max(minLeft, window.innerWidth - padX - w);

      /* On phones, prefer lower 2/3 so the logo + help stay clear */
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

    function applyPos(x, y, bobY = 0) {
      const {minTop, maxTop, minLeft, maxLeft} = bounds();
      pos.x = clamp(x, minLeft, maxLeft);
      pos.y = clamp(y, minTop, maxTop);
      agent.style.left = `${pos.x}px`;
      agent.style.top = `${pos.y + bobY}px`;
      agent.style.right = "auto";
    }

    function randomTarget(b) {
      const spanX = Math.max(0, b.maxLeft - b.minLeft);
      const spanY = Math.max(0, b.maxTop - b.minTop);
      /* Bias away from top-left logo zone: pick mid/right more often on desktop */
      let nx = Math.random();
      let ny = Math.random();
      if (!b.mobile) {
        nx = 0.35 + Math.random() * 0.65;
        ny = 0.15 + Math.random() * 0.85;
      } else {
        /* Mobile: shorter hops, stay mid-lower */
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
      /* Avoid tiny no-op hops */
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (Math.hypot(dx, dy) < (b.mobile ? 40 : 60)) {
        to = randomTarget(b);
      }
      moveStart = performance.now();
      /* Slower, softer travel on phones */
      moveDur = b.mobile
        ? 5200 + Math.random() * 3800
        : 3800 + Math.random() * 3200;
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (!agent.classList.contains("is-idle") || cycleBusy) return;

      const b = bounds();
      const t = clamp((now - moveStart) / moveDur, 0, 1);
      const e = easeInOut(t);
      const x = lerp(from.x, to.x, e);
      const y = lerp(from.y, to.y, e);

      /* Gentle hover bob — smaller amplitude on mobile */
      bobPhase += b.mobile ? 0.018 : 0.022;
      const bobAmp = b.mobile ? 4 : 7;
      const bobY = Math.sin(bobPhase) * bobAmp;

      applyPos(x, y, bobY);

      if (t >= 1) pickNextMove();
    }

    function clearCycleClasses() {
      agent.classList.remove("is-pop", "is-explode", "is-phrase", "is-phrase-out", "is-reform");
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function runPhraseCycle() {
      if (cycleBusy || searchOpen || document.hidden) return;
      cycleBusy = true;
      agent.setAttribute("aria-busy", "true");
      agent.classList.remove("is-idle");
      clearCycleClasses();

      agent.classList.add("is-pop");
      await wait(560);
      agent.classList.remove("is-pop");
      agent.classList.add("is-explode");
      await wait(280);
      if (phrase) phrase.textContent = HELP;
      agent.classList.add("is-phrase");
      await wait(2200);
      agent.classList.add("is-phrase-out");
      await wait(420);
      agent.classList.remove("is-phrase", "is-phrase-out", "is-explode");
      agent.classList.add("is-reform");
      mark.classList.remove("is-hidden");
      await wait(480);
      clearCycleClasses();
      agent.classList.add("is-idle");
      agent.setAttribute("aria-busy", "false");
      cycleBusy = false;
      /* Resume float from current spot */
      pickNextMove();
      scheduleCycle(IDLE_MS);
    }

    function scheduleCycle(delay) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { runPhraseCycle(); }, delay);
    }

    function openSearch() {
      searchOpen = true;
      clearTimeout(idleTimer);
      clearCycleClasses();
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
      if (cycleBusy) return;
      openSearch();
    });

    agent.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSearch();
      }
    });

    window.addEventListener("resize", () => {
      const b = bounds();
      applyPos(clamp(pos.x, b.minLeft, b.maxLeft), clamp(pos.y, b.minTop, b.maxTop));
      pickNextMove();
    });

    agent.classList.add("is-idle");
    const b0 = bounds();
    /* Start mid-lower / rightish so it doesn't collide with FloqR on load */
    pos = {
      x: b0.minLeft + (b0.maxLeft - b0.minLeft) * (b0.mobile ? 0.62 : 0.72),
      y: b0.minTop + (b0.maxTop - b0.minTop) * (b0.mobile ? 0.55 : 0.45)
    };
    applyPos(pos.x, pos.y);
    pickNextMove();
    raf = requestAnimationFrame(tick);
    scheduleCycle(FIRST_POP_MS);
    setTimeout(() => { if (!searchOpen) runPhraseCycle(); }, 900);

    return {
      openSearch,
      HELP
    };
  }

  global.FLOQRFloqAi = { bindFloqAi, HELP: "Tell, how can I help you?" };
})(window);
