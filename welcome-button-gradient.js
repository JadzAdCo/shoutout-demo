/* Welcome sign-in buttons share one top-to-bottom gradient; each button shows its slice.
   Works with the 2-column #loginActions grid (uses offsetTop within the host). */
(function (global) {
  "use strict";

  const HOST_ID = "loginActions";
  let frame = 0;

  function isShown(el) {
    return el.getClientRects().length > 0;
  }

  function layout() {
    frame = 0;
    const host = global.document.getElementById(HOST_ID);
    if (!host) return;
    const buttons = [...host.children].filter(el => el.classList.contains("signin") && isShown(el));
    if (!buttons.length) return;
    const hostTop = host.getBoundingClientRect().top;
    const tops = buttons.map(btn => Math.max(0, Math.round(btn.getBoundingClientRect().top - hostTop)));
    const bottoms = buttons.map((btn, i) => tops[i] + btn.offsetHeight);
    const total = Math.max(...bottoms, 1);
    buttons.forEach((btn, i) => {
      btn.style.setProperty("--stack-y", `${tops[i]}px`);
      btn.style.setProperty("--stack-h", `${total}px`);
    });
  }

  function schedule() {
    if (frame) return;
    frame = global.requestAnimationFrame ? global.requestAnimationFrame(layout) : setTimeout(layout, 16);
  }

  function watch() {
    const host = global.document.getElementById(HOST_ID);
    if (!host) return;
    if (global.ResizeObserver) {
      const ro = new global.ResizeObserver(schedule);
      ro.observe(host);
      [...host.children].forEach(el => { if (el.classList.contains("signin")) ro.observe(el); });
    }
    if (global.MutationObserver) {
      new global.MutationObserver(schedule).observe(host, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "hidden"]
      });
    }
    global.addEventListener("resize", schedule);
    global.addEventListener("floqr:ui-language", schedule);
    global.document.fonts?.ready?.then(schedule).catch(() => {});
    schedule();
  }

  global.FLOQRWelcomeGradient = { layout, schedule };
  if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", watch);
  else watch();
})(window);
