/* FLOQR frame loop — one 6s media↔copy rotation for any display template. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FLOQRFrameLoop = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HOLD_MS = 6000;
  const LOOP = "split-media-loop";
  const PHASE_MEDIA = "split-media-phase-media";
  const PHASE_COPY = "split-media-phase-copy";

  let timer = null;
  let activeCanvas = null;

  function prefersReducedMotion() {
    try {
      return !!root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    } catch (_) {
      return false;
    }
  }

  function phaseOf(canvas) {
    if (!canvas) return "";
    return canvas.classList.contains(PHASE_COPY) ? "copy" : "media";
  }

  function setPhase(canvas, phase) {
    const copy = phase === "copy";
    canvas.classList.toggle(PHASE_MEDIA, !copy);
    canvas.classList.toggle(PHASE_COPY, copy);
  }

  function stop(canvas) {
    if (timer) {
      root.clearInterval(timer);
      timer = null;
    }
    const target = canvas || activeCanvas;
    activeCanvas = null;
    target?.classList.remove(LOOP, PHASE_MEDIA, PHASE_COPY);
  }

  function start(canvas, options = {}) {
    stop(canvas);
    if (!canvas) return;
    const onAdvance = typeof options.onAdvance === "function" ? options.onAdvance : null;
    const holdMs = Number(options.holdMs) > 0 ? Number(options.holdMs) : HOLD_MS;
    activeCanvas = canvas;
    canvas.classList.add(LOOP);
    if (prefersReducedMotion()) {
      setPhase(canvas, "copy");
      if (onAdvance) root.requestAnimationFrame(() => onAdvance("copy", canvas));
      return;
    }
    setPhase(canvas, "media");
    timer = root.setInterval(() => {
      const next = phaseOf(canvas) === "media" ? "copy" : "media";
      setPhase(canvas, next);
      if (onAdvance) root.requestAnimationFrame(() => onAdvance(next, canvas));
    }, holdMs);
  }

  return {
    HOLD_MS,
    LOOP,
    PHASE_MEDIA,
    PHASE_COPY,
    start,
    stop,
    phaseOf
  };
});
