/* FLOQRAccessNotice — page loaders report failed reads here instead of silently showing an empty list.
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
(function (global) {
  "use strict";

  const reported = new Map();

  function isDenied(error) {
    const code = String(error?.code || "").toLowerCase();
    return code === "permission-denied" || code.endsWith("/permission-denied") || /missing or insufficient permissions|permission[- ]denied/i.test(String(error?.message || ""));
  }

  function t(key, fallback) {
    const value = global.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  }

  function host() {
    let el = global.document?.getElementById("floqrAccessNotice");
    if (el || !global.document?.body) return el;
    el = global.document.createElement("div");
    el.id = "floqrAccessNotice";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:640px;margin:0 auto;padding:10px 14px;border-radius:10px;background:#2a1a1a;color:#ffe9e9;border:1px solid #a33;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);display:flex;gap:10px;align-items:flex-start";
    global.document.body.appendChild(el);
    return el;
  }

  function render() {
    const el = host();
    if (!el) return;
    const kinds = new Set(reported.values());
    const lines = [];
    if (kinds.has("denied")) lines.push(t("access.denied", "Some information on this page is hidden because your account does not have access to it."));
    if (kinds.has("failed")) lines.push(t("access.failed", "Some information on this page could not load. Refresh the page to try again."));
    el.textContent = "";
    const text = global.document.createElement("div");
    text.style.flex = "1";
    lines.forEach(line => { const p = global.document.createElement("div"); p.textContent = line; text.appendChild(p); });
    const close = global.document.createElement("button");
    close.type = "button";
    close.textContent = t("access.dismiss", "Dismiss");
    close.style.cssText = "background:transparent;color:inherit;border:1px solid currentColor;border-radius:6px;padding:2px 8px;cursor:pointer";
    close.addEventListener("click", () => { reported.clear(); el.remove(); });
    el.append(text, close);
  }

  /** Call from a loader's catch block; returns the empty fallback so callers keep working. */
  function report(name, error, fallback = []) {
    const kind = isDenied(error) ? "denied" : "failed";
    console.warn(`FLOQR could not read ${name} (${kind}):`, error?.message || error);
    if (!reported.has(name) || kind === "denied") reported.set(name, kind);
    if (global.document?.readyState === "loading") global.document.addEventListener("DOMContentLoaded", render, {once: true});
    else render();
    return fallback;
  }

  global.FLOQRAccessNotice = {report, isDenied, clear: () => reported.clear()};
})(window);
