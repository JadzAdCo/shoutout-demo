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
    clearActiveTimer();
    const target = canvas || activeCanvas;
    activeCanvas = null;
    lastPhase = "media";
    target?.classList.remove(LOOP, PHASE_MEDIA, PHASE_COPY);
  }

  function clearActiveTimer() {
    if (timer) {
      g.clearTimeout(timer);
      g.clearInterval(timer);
    }
    timer = null;
  }

  function start(canvas, options = {}) {
    if (!canvas) return;
    const onAdvance = typeof options.onAdvance === "function" ? options.onAdvance : null;
    const holdMs = Number(options.holdMs) > 0 ? Number(options.holdMs) : HOLD_MS;
    const holdByPhase = options.holdMsByPhase && typeof options.holdMsByPhase === "object"
      ? options.holdMsByPhase
      : null;
    // When false, stay on media forever (jersey-only when ShoutOut message is blank).
    const includeCopy = options.includeCopy !== false;
    const holdFor = (phase) => {
      if (holdByPhase) {
        const keyed = Number(holdByPhase[phase]);
        if (keyed > 0) return keyed;
      }
      return holdMs;
    };
    // Re-render wipes canvas classes. Keep the running phase so the shoutout frame is not skipped.
    // Always rebind the interval so media↔copy never stalls after a class wipe / re-paint.
    let resumePhase = (timer && activeCanvas === canvas)
      ? (canvas.classList.contains(PHASE_COPY) || canvas.classList.contains(PHASE_MEDIA)
        ? phaseOf(canvas)
        : (lastPhase || "media"))
      : "media";
    if (!includeCopy && resumePhase === "copy") resumePhase = "media";
    clearActiveTimer();
    activeCanvas = canvas;
    canvas.classList.add(LOOP);
    if (prefersReducedMotion()) {
      const reduced = includeCopy ? "copy" : "media";
      setPhase(canvas, reduced);
      if (onAdvance) g.requestAnimationFrame(() => onAdvance(reduced, canvas));
      return;
    }
    setPhase(canvas, resumePhase);
    if (onAdvance) g.requestAnimationFrame(() => onAdvance(resumePhase, canvas));
    if (!includeCopy) {
      // Jersey-only: no message card — hold media without flipping.
      return;
    }
    const tick = () => {
      if (!activeCanvas) return;
      const next = phaseOf(activeCanvas) === "media" ? "copy" : "media";
      setPhase(activeCanvas, next);
      if (onAdvance) g.requestAnimationFrame(() => onAdvance(next, activeCanvas));
      timer = g.setTimeout(tick, holdFor(next));
    };
    timer = g.setTimeout(tick, holdFor(resumePhase));
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
