/* FLOQRPeople — other members' profiles through getPeopleDirectory (private fields are stripped on the server).
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
(function (global) {
  "use strict";

  const cache = new Map();

  function revive(value) {
    if (Array.isArray(value)) return value.map(revive);
    if (!value || typeof value !== "object") return value;
    if (Object.keys(value).length === 1 && typeof value.__ms === "number") {
      const ts = global.firebase?.firestore?.Timestamp;
      return ts ? ts.fromMillis(value.__ms) : new Date(value.__ms);
    }
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, revive(inner)]));
  }

  function list(mode, options = {}) {
    const uid = global.firebase?.auth?.().currentUser?.uid || "";
    const key = JSON.stringify([uid, mode, options]);
    if (!cache.has(key)) {
      const call = global.firebase.app().functions("us-central1").httpsCallable("getPeopleDirectory");
      const pending = call({mode, ...options})
        .then(result => (Array.isArray(result?.data?.people) ? result.data.people : []).map(revive))
        .catch(error => {
          cache.delete(key);
          throw error;
        });
      cache.set(key, pending);
    }
    return cache.get(key);
  }

  async function listSafe(mode, options = {}) {
    try {
      return await list(mode, options);
    } catch (error) {
      console.warn(`FLOQR members (${mode}) unavailable:`, error?.message || error);
      return [];
    }
  }

  global.FLOQRPeople = {list, listSafe, revive, clear: () => cache.clear()};
})(window);
