/* FloqAi server access gate — asks getFloqAiAccess which FloqAi results this account may see.
   Without the callable, intent-search.js falls back to the packaged classification (still fail closed).
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
(function (global) {
  "use strict";

  const BATCH = 60;
  const verdicts = new Map();
  const pending = new Set();
  const listeners = new Set();
  let mode = "idle"; // idle | server | local | denied
  let role = "";
  let timer = null;
  let inFlight = 0;
  let generation = 0;

  function callable() {
    try {
      if (!global.firebase?.functions || !global.firebase.apps?.length) return null;
      return global.firebase.app().functions("us-central1").httpsCallable("getFloqAiAccess");
    } catch (_) {
      return null;
    }
  }

  function notify() {
    listeners.forEach(cb => {
      try { cb({mode, role}); } catch (_) {}
    });
  }

  function activate() {
    if (mode === "idle") mode = callable() ? "server" : "local";
    return mode;
  }

  function isActive() {
    return mode === "server" || mode === "denied";
  }

  function verdict(sourceId) {
    if (mode === "denied") return "deny";
    return verdicts.get(sourceId);
  }

  function hasPending() {
    return mode === "server" && (pending.size > 0 || inFlight > 0);
  }

  function isFeatureDenied(error) {
    const code = String(error?.code || "");
    return code === "failed-precondition" || code === "functions/failed-precondition";
  }

  async function flush() {
    timer = null;
    const batch = [...pending].slice(0, BATCH);
    batch.forEach(id => pending.delete(id));
    if (!batch.length) return;
    const gen = generation;
    const fn = callable();
    if (!fn) {
      mode = "local";
      notify();
      return;
    }
    inFlight += 1;
    try {
      const data = (await fn({sourceIds: batch}))?.data || {};
      if (gen !== generation) return;
      role = String(data.role || "");
      const allowed = new Set(Array.isArray(data.allowed) ? data.allowed : []);
      batch.forEach(id => verdicts.set(id, allowed.has(id) ? "allow" : "deny"));
    } catch (error) {
      if (gen !== generation) return;
      if (isFeatureDenied(error)) {
        mode = "denied";
      } else {
        mode = "local";
        console.warn("FloqAi access check unavailable; using packaged classification", error?.code || error?.message || error);
      }
    } finally {
      inFlight -= 1;
    }
    if (pending.size && mode === "server") timer = setTimeout(flush, 0);
    notify();
  }

  function request(sourceIds) {
    if (mode !== "server") return;
    (sourceIds || []).forEach(id => { if (id && !verdicts.has(id)) pending.add(id); });
    if (pending.size && !timer) timer = setTimeout(flush, 150);
  }

  /** Call when the signed-in account changes: verdicts belong to one viewer. */
  function reset() {
    generation += 1;
    verdicts.clear();
    pending.clear();
    if (timer) clearTimeout(timer);
    timer = null;
    role = "";
    if (mode !== "idle") mode = callable() ? "server" : "local";
    notify();
  }

  function onChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  global.FLOQRFloqAiAccess = {
    activate,
    isActive,
    verdict,
    request,
    reset,
    onChange,
    hasPending,
    mode: () => mode,
    role: () => role
  };
})(window);
