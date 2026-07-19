/* FloqAi idle path + pop/explode phrase + open contextual search */
(function (global) {
  "use strict";

  const HELP = "Tell, how can I help you?";
  const IDLE_MS = 14000;
  const FIRST_POP_MS = 4200;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function bindFloqAi(opts = {}) {
    const agent = document.getElementById("floqAiAgent");
    const mark = document.getElementById("floqAiMark");
    const phrase = document.getElementById("floqAiPhrase");
    const panel = document.getElementById("floqAiSearchPanel");
    const input = document.getElementById("intentSearchInput");
    const helpEl = document.getElementById("floqAiHelpText");
    const page = document.getElementById("floqAiPage");
    if (!agent || !mark) return;

    let idleTimer = null;
    let cycleBusy = false;
    let searchOpen = false;
    let raf = 0;
    let start = performance.now();

    const bounds = () => {
      const topPad = 72;
      const bottomPad = 96;
      const userMenu = document.getElementById("userMenu") || document.querySelector(".user-menu");
      const menuBottom = userMenu
        ? Math.max(topPad + 40, userMenu.getBoundingClientRect().bottom + 12)
        : topPad + 80;
      /* Idle path stays on the right; top capped near top-right profile card */
      const minTop = Math.min(menuBottom, window.innerHeight * 0.22);
      const maxTop = Math.max(minTop + 80, window.innerHeight - bottomPad - agent.offsetHeight);
      return { minTop, maxTop };
    };

    function setTop(px) {
      agent.style.top = `${px}px`;
      agent.style.right = `${clamp(window.innerWidth < 720 ? 10 : 18, 10, 40)}px`;
    }

    function tick(now) {
      if (!agent.classList.contains("is-idle") || cycleBusy) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const { minTop, maxTop } = bounds();
      const t = (now - start) / 1000;
      /* Slow vertical sine + slight horizontal sway via right offset */
      const mid = (minTop + maxTop) / 2;
      const amp = (maxTop - minTop) / 2;
      const y = mid + Math.sin(t * 0.28) * amp;
      const xSway = 6 + Math.sin(t * 0.19) * 8;
      agent.style.top = `${y}px`;
      agent.style.right = `${clamp(12 + xSway, 8, 48)}px`;
      raf = requestAnimationFrame(tick);
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
      const { minTop, maxTop } = bounds();
      const current = parseFloat(agent.style.top) || minTop;
      setTop(clamp(current, minTop, maxTop));
    });

    agent.classList.add("is-idle");
    const { minTop, maxTop } = bounds();
    setTop((minTop + maxTop) / 2);
    start = performance.now();
    raf = requestAnimationFrame(tick);
    scheduleCycle(FIRST_POP_MS);
    /* First invite: run phrase cycle soon so FloqAi + help text are obvious on load */
    setTimeout(() => { if (!searchOpen) runPhraseCycle(); }, 900);

    return {
      openSearch,
      HELP
    };
  }

  global.FLOQRFloqAi = { bindFloqAi, HELP: "Tell, how can I help you?" };
})(window);
