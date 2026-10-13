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

  // Named phase cycles (e.g. the FloqR identity card) share the same 6s hold without owning a canvas.
  const cycles = new Map();

  function stopCycle(name) {
    const key = String(name || "");
    const entry = cycles.get(key);
    if (entry?.timer) g.clearInterval(entry.timer);
    cycles.delete(key);
  }

  function cycle(name, options = {}) {
    const key = String(name || "");
    stopCycle(key);
    const count = Math.max(1, Math.floor(Number(options.count) || 1));
    const holdMs = Number(options.holdMs) > 0 ? Number(options.holdMs) : HOLD_MS;
    const onAdvance = typeof options.onAdvance === "function" ? options.onAdvance : () => {};
    const entry = {index: 0, count, timer: null};
    cycles.set(key, entry);
    onAdvance(0);
    if (count > 1) {
      entry.timer = g.setInterval(() => {
        if (cycles.get(key) !== entry) return;
        entry.index = (entry.index + 1) % count;
        onAdvance(entry.index);
      }, holdMs);
    }
    return {
      stop: () => { if (cycles.get(key) === entry) stopCycle(key); },
      index: () => entry.index
    };
  }

  return {
    HOLD_MS,
    LOOP,
    PHASE_MEDIA,
    PHASE_COPY,
    start,
    stop,
    phaseOf,
    cycle,
    stopCycle
  };
});
