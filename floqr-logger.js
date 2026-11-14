/* FLOQR client application logger v29.09.4 — persists operational issues to Firestore appLogs. */
(function () {
  "use strict";

  const LEVELS = new Set(["debug", "info", "warn", "error"]);
  const MAX_MESSAGE = 2000;
  const MAX_DETAILS_JSON = 12000;
  let sessionId = "";

  function byAuth() {
    try { return window.firebase?.auth?.()?.currentUser || null; } catch (_) { return null; }
  }

  function byDb() {
    try { return window.firebase?.firestore?.() || null; } catch (_) { return null; }
  }

  function ensureSessionId() {
    if (sessionId) return sessionId;
    try {
      sessionId = sessionStorage.getItem("floqrLogSessionId") || "";
      if (!sessionId) {
        sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem("floqrLogSessionId", sessionId);
      }
    } catch (_) {
      sessionId = `sess_${Date.now().toString(36)}`;
    }
    return sessionId;
  }

  function correlationId(prefix = "corr") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function safeDetails(details) {
    if (details == null) return null;
    try {
      const json = JSON.stringify(details, (_, value) => {
        if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
        if (value instanceof Error) return { name: value.name, message: value.message, code: value.code || "" };
        return value;
      });
      if (json.length <= MAX_DETAILS_JSON) return JSON.parse(json);
      return { truncated: true, preview: json.slice(0, MAX_DETAILS_JSON) };
    } catch (_) {
      return { note: "details_not_serializable" };
    }
  }

  function consoleMirror(level, message, payload) {
    const line = `[FLOQR ${level}] ${message}`;
    if (level === "error") console.error(line, payload || "");
    else if (level === "warn") console.warn(line, payload || "");
    else console.info(line, payload || "");
  }

  async function write(entry = {}) {
    const level = LEVELS.has(entry.level) ? entry.level : "info";
    const category = String(entry.category || "general").slice(0, 80);
    const action = String(entry.action || "").slice(0, 120);
    const message = String(entry.message || "No message").slice(0, MAX_MESSAGE);
    const user = byAuth();
    const payload = {
      level,
      category,
      action,
      message,
      details: safeDetails(entry.details),
      correlationId: String(entry.correlationId || correlationId()).slice(0, 80),
      sessionId: ensureSessionId(),
      uid: user?.uid || "anonymous",
      email: String(user?.email || "").slice(0, 200),
      href: String(entry.href || (typeof location !== "undefined" ? location.href : "")).slice(0, 500),
      userAgent: String(typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 300),
      appVersion: String(entry.appVersion || "29.09.4").slice(0, 40),
      source: String(entry.source || "client").slice(0, 40),
      logCategory: "diagnostic",
      createdAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date(),
      createdAtMs: Date.now(),
      expireAtMs: Date.now() + (30 * 24 * 60 * 60 * 1000)
    };
    consoleMirror(level, `${category}${action ? `/${action}` : ""}: ${message}`, payload.details);
    const db = byDb();
    if (!db || !user) return { ok: false, skipped: !user ? "not_signed_in" : "no_firestore", correlationId: payload.correlationId };
    try {
      const ref = await db.collection("appLogs").add(payload);
      return { ok: true, id: ref.id, correlationId: payload.correlationId };
    } catch (error) {
      console.error("[FLOQR log] persist failed", error);
      return { ok: false, error: error?.message || String(error), correlationId: payload.correlationId };
    }
  }

  function fromError(error, defaults = {}) {
    const code = error?.code || error?.details?.code || "";
    const message = error?.message || String(error || "Unknown error");
    return write({
      level: "error",
      category: defaults.category || "runtime",
      action: defaults.action || "exception",
      message,
      correlationId: defaults.correlationId,
      details: {
        code,
        name: error?.name || "",
        stack: String(error?.stack || "").slice(0, 1500),
        ...(defaults.details || {})
      },
      source: defaults.source || "client"
    });
  }

  const SHOUTOUT_TRAIL_KEY = "floqrShoutoutTrailId";
  const SHOUTOUT_TRAIL_STARTED_KEY = "floqrShoutoutTrailStartedAtMs";
  const SHOUTOUT_TRAIL_LAST_KEY = "floqrShoutoutTrailLastPage";
  let lastShoutoutPage = { trailId: "", pageId: "", atMs: 0 };

  function queryParam(name) {
    try {
      return new URL(typeof location !== "undefined" ? location.href : "").searchParams.get(name) || "";
    } catch (_) {
      return "";
    }
  }

  function readShoutoutTrailId() {
    try { return sessionStorage.getItem(SHOUTOUT_TRAIL_KEY) || ""; } catch (_) { return ""; }
  }

  function persistShoutoutTrail(id, startedAtMs) {
    try {
      sessionStorage.setItem(SHOUTOUT_TRAIL_KEY, id);
      if (startedAtMs) sessionStorage.setItem(SHOUTOUT_TRAIL_STARTED_KEY, String(startedAtMs));
    } catch (_) {}
  }

  function startShoutoutTrail(reason = "start") {
    const startedAtMs = Date.now();
    const id = correlationId("so");
    persistShoutoutTrail(id, startedAtMs);
    lastShoutoutPage = { trailId: "", pageId: "", atMs: 0 };
    try { sessionStorage.removeItem(SHOUTOUT_TRAIL_LAST_KEY); } catch (_) {}
    return {
      correlationId: id,
      startedAtMs,
      reason: String(reason || "start").slice(0, 40)
    };
  }

  function ensureShoutoutTrail(reason = "flow") {
    const fromUrl = queryParam("shoutoutTrailId") || queryParam("trail");
    const stored = readShoutoutTrailId();
    const id = String(fromUrl || stored || "").trim();
    if (!id) return startShoutoutTrail(reason);
    if (fromUrl && fromUrl !== stored) persistShoutoutTrail(fromUrl, Date.now());
    let startedAtMs = Date.now();
    try { startedAtMs = Number(sessionStorage.getItem(SHOUTOUT_TRAIL_STARTED_KEY) || 0) || startedAtMs; } catch (_) {}
    return {
      correlationId: id,
      startedAtMs,
      reason: String(reason || "flow").slice(0, 40)
    };
  }

  function clearShoutoutTrail() {
    try {
      sessionStorage.removeItem(SHOUTOUT_TRAIL_KEY);
      sessionStorage.removeItem(SHOUTOUT_TRAIL_STARTED_KEY);
      sessionStorage.removeItem(SHOUTOUT_TRAIL_LAST_KEY);
    } catch (_) {}
    lastShoutoutPage = { trailId: "", pageId: "", atMs: 0 };
  }

  function shoutoutPageCall(pageId, details = {}) {
    const page = String(pageId || "").trim();
    if (!page) return null;
    const trail = ensureShoutoutTrail(page);
    const now = Date.now();
    if (trail.correlationId === lastShoutoutPage.trailId && page === lastShoutoutPage.pageId && (now - lastShoutoutPage.atMs) < 2500) {
      return trail;
    }
    lastShoutoutPage = { trailId: trail.correlationId, pageId: page, atMs: now };
    try { sessionStorage.setItem(SHOUTOUT_TRAIL_LAST_KEY, `${trail.correlationId}|${page}|${now}`); } catch (_) {}
    const locationId = String(details.locationId || "").trim();
    const template = String(details.template || "").trim();
    const screenFormatId = String(details.screenFormatId || "").trim();
    write({
      level: "info",
      category: "shoutout",
      action: "page_call",
      message: `ShoutOut page ${page}`,
      correlationId: trail.correlationId,
      source: details.source || "client",
      details: {
        shoutoutTrailId: trail.correlationId,
        pageId: page,
        locationId,
        template,
        screenFormatId,
        venueChosen: !!locationId,
        templateChosen: !!template,
        destHost: String(details.destHost || "").slice(0, 120),
        sourcePage: String(details.sourcePage || "").slice(0, 80),
        pageIndex: details.pageIndex || 0,
        atMs: now,
        atIso: new Date(now).toISOString(),
        trailStartedAtMs: trail.startedAtMs
      }
    });
    return trail;
  }

  window.FLOQRLog = {
    write,
    fromError,
    correlationId,
    ensureSessionId,
    startShoutoutTrail,
    ensureShoutoutTrail,
    clearShoutoutTrail,
    shoutoutPageCall,
    readShoutoutTrailId
  };
})();
