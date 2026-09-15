/* FLOQR client public IP capture for ShoutOut compliance sessions.
   Server is source of truth (Functions x-forwarded-for). Cached for the browser session. */
(function (global) {
  "use strict";

  const STORAGE_KEY = "FLOQR_CLIENT_IP_SESSION";
  const TTL_MS = 45 * 60 * 1000;
  let memory = null;
  let inflight = null;

  function readCache() {
    if (memory?.clientIp && Date.now() - Number(memory.at || 0) < TTL_MS) return memory;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.clientIp && Date.now() - Number(parsed.at || 0) < TTL_MS) {
        memory = parsed;
        return parsed;
      }
    } catch (_e) {}
    return null;
  }

  function writeCache(clientIp, source) {
    memory = {
      clientIp: String(clientIp || "").slice(0, 80),
      ipSource: String(source || "session-callable").slice(0, 40),
      at: Date.now()
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch (_e) {}
    global.__FLOQR_CLIENT_IP = memory.clientIp;
    return memory;
  }

  function current() {
    const cached = readCache();
    return {
      clientIp: cached?.clientIp || "",
      ipSource: cached?.ipSource || ""
    };
  }

  function patchPayload(payload = {}) {
    const {clientIp, ipSource} = current();
    if (!clientIp) return payload;
    return {
      ...payload,
      clientIp,
      ipSource: ipSource || "session-cache",
      submitterIp: clientIp
    };
  }

  async function ensure(options = {}) {
    const force = options.force === true;
    if (!force) {
      const cached = readCache();
      if (cached?.clientIp) return cached;
    }
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        if (!global.firebase?.apps?.length) return current();
        if (!global.firebase.auth?.()?.currentUser) return current();
        const region = global.FLOQR_AI_FUNCTIONS_REGION || "us-central1";
        const callable = global.firebase.app().functions(region).httpsCallable("getFloqrClientIp");
        const response = await callable({});
        const data = response?.data || {};
        if (data.clientIp) return writeCache(data.clientIp, data.ipSource || "session-callable");
      } catch (error) {
        console.warn("FLOQR client IP capture skipped:", error?.message || error);
      } finally {
        inflight = null;
      }
      return current();
    })();
    return inflight;
  }

  global.FLOQRClientIp = {ensure, current, patchPayload, writeCache};
})(window);
