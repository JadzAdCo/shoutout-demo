/* Welcome sign-in buttons share one top-to-bottom gradient; each button shows its slice. */
(function (global) {
  "use strict";

  const HOST_ID = "loginActions";
  let frame = 0;

  function isShown(el) {
    return el.getClientRects().length > 0;
  }

  function sliceOffsets(items) {
    let y = 0;
    let prevMarginBottom = null;
    const offsets = items.map(({ height, marginTop, marginBottom }) => {
      if (prevMarginBottom !== null) y += Math.max(prevMarginBottom, marginTop);
      const top = y;
      y += height;
      prevMarginBottom = marginBottom;
      return top;
    });
    return { offsets, total: y };
  }

  function layout() {
    frame = 0;
    const host = global.document.getElementById(HOST_ID);
    if (!host) return;
    const buttons = [...host.children].filter(el => el.classList.contains("signin") && isShown(el));
    if (!buttons.length) return;
    const items = buttons.map(btn => {
      const style = global.getComputedStyle(btn);
      return {
        height: btn.offsetHeight,
        marginTop: parseFloat(style.marginTop) || 0,
        marginBottom: parseFloat(style.marginBottom) || 0
      };
    });
    const { offsets, total } = sliceOffsets(items);
    buttons.forEach((btn, i) => {
      btn.style.setProperty("--stack-y", `${offsets[i]}px`);
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

  global.FLOQRWelcomeGradient = { layout, schedule, sliceOffsets };
  if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", watch);
  else watch();
})(window);
