/* FLOQR frame loop — one 6s media↔copy rotation for any display template. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.FLOQRFrameLoop = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const g = root || (typeof globalThis !== "undefined" ? globalThis : {});
  const HOLD_MS = 6000;
  const LOOP = "split-media-loop";
  const PHASE_MEDIA = "split-media-phase-media";
  const PHASE_COPY = "split-media-phase-copy";

  let timer = null;
  let activeCanvas = null;
  let lastPhase = "media";

  function prefersReducedMotion() {
    try {
      return !!g.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
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
    lastPhase = copy ? "copy" : "media";
    canvas.classList.toggle(PHASE_MEDIA, !copy);
    canvas.classList.toggle(PHASE_COPY, copy);
  }

  function stop(canvas) {
    if (timer) {
      g.clearInterval(timer);
    }
    timer = null;
    const target = canvas || activeCanvas;
    activeCanvas = null;
    lastPhase = "media";
    target?.classList.remove(LOOP, PHASE_MEDIA, PHASE_COPY);
  }

  function start(canvas, options = {}) {
    if (!canvas) return;
    const onAdvance = typeof options.onAdvance === "function" ? options.onAdvance : null;
    const holdMs = Number(options.holdMs) > 0 ? Number(options.holdMs) : HOLD_MS;
    // Re-render wipes canvas classes. Keep the running phase so the shoutout frame is not skipped.
    // Always rebind the interval so media↔copy never stalls after a class wipe / re-paint.
    const resumePhase = (timer && activeCanvas === canvas)
      ? (canvas.classList.contains(PHASE_COPY) || canvas.classList.contains(PHASE_MEDIA)
        ? phaseOf(canvas)
        : (lastPhase || "media"))
      : "media";
    if (timer) {
      g.clearInterval(timer);
      timer = null;
    }
    activeCanvas = canvas;
    canvas.classList.add(LOOP);
    if (prefersReducedMotion()) {
      setPhase(canvas, "copy");
      if (onAdvance) g.requestAnimationFrame(() => onAdvance("copy", canvas));
      return;
    }
    setPhase(canvas, resumePhase);
    timer = g.setInterval(() => {
      if (!activeCanvas) return;
      const next = phaseOf(activeCanvas) === "media" ? "copy" : "media";
      setPhase(activeCanvas, next);
      if (onAdvance) g.requestAnimationFrame(() => onAdvance(next, activeCanvas));
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
