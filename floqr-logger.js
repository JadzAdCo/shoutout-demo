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
      createdAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date()
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

  window.FLOQRLog = { write, fromError, correlationId, ensureSessionId };
})();
