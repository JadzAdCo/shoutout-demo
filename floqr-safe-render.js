/* Safe render helpers: every URL / color / gradient / text that reaches innerHTML, an attribute or a style goes through here.
   Design notes: .cursor/rules/design-notes-board-fit.mdc (Safe render) */
(function (global) {
  "use strict";

  const HTML_ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;"};
  const MAX_URL_LENGTH = 2048;
  const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
  const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
  const RELATIVE_IMAGE = /^(\.\/)?images\/[A-Za-z0-9._~%\/-]+$/;
  const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+\/]+={0,2}$/i;
  const BLOB_URL = /^blob:https?:\/\/[A-Za-z0-9.:\[\]-]+\/[A-Za-z0-9-]+$/i;
  const CSS_URL_UNSAFE = /["'()\\<>\s]/g;
  const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  const FUNC_COLOR = /^(?:rgba?|hsla?)\(\s*[0-9.]+%?(?:\s*[,\s\/]\s*[0-9.]+%?){2,3}\s*\)$/i;
  const NAMED_COLOR = /^[a-z]{3,20}$/i;
  const GRADIENT = /^linear-gradient\([#0-9a-z.,%\s()+-]+\)$/i;
  const GRADIENT_FORBIDDEN = /url\s*\(|expression|image-set|var\s*\(|attr\s*\(|env\s*\(/i;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"'`]/g, c => HTML_ESCAPES[c]);
  }

  /**
   * Returns a vetted URL string or "".
   * Allowed: absolute http(s) URLs (no credentials) and same-origin relative paths under images/.
   * Options: allowBlob (local object URLs from a file picker), allowDataImage (base64 raster only — never SVG).
   */
  function safeUrl(value, {allowBlob = false, allowDataImage = false} = {}) {
    const raw = String(value ?? "").trim();
    if (!raw || raw.length > MAX_URL_LENGTH || CONTROL_CHARS.test(raw)) return "";
    if (allowDataImage && DATA_IMAGE.test(raw)) return raw;
    if (allowBlob && BLOB_URL.test(raw)) return raw;
    if (SCHEME.test(raw)) {
      if (!/^https?:\/\//i.test(raw)) return "";
      let parsed;
      try { parsed = new URL(raw); } catch (_) { return ""; }
      if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return "";
      return parsed.href;
    }
    if (!RELATIVE_IMAGE.test(raw) || raw.split("/").includes("..")) return "";
    return raw;
  }

  /** `url("…")` for a style value, or "" when the URL is not allowed. Quotes, parens, backslashes, <, > and spaces are percent-encoded. */
  function cssUrl(value, options = {}) {
    const url = safeUrl(value, options);
    if (!url) return "";
    const encoded = url.replace(CSS_URL_UNSAFE, c => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
    return `url("${encoded}")`;
  }

  function safeColor(value, fallback = "") {
    const raw = String(value ?? "").trim();
    if (raw && (HEX_COLOR.test(raw) || FUNC_COLOR.test(raw) || NAMED_COLOR.test(raw))) return raw;
    return fallback;
  }

  function safeGradient(value, fallback = "") {
    const raw = String(value ?? "").trim();
    if (!raw || raw.length > 400 || !GRADIENT.test(raw) || GRADIENT_FORBIDDEN.test(raw)) return fallback;
    let depth = 0;
    for (const c of raw) {
      if (c === "(") depth += 1;
      if (c === ")") depth -= 1;
      if (depth < 0) return fallback;
    }
    return depth === 0 ? raw : fallback;
  }

  /** Joins `prop:value` declarations and HTML-escapes the whole value for a style="…" attribute. */
  function styleAttr(declarations = []) {
    return escapeHtml(declarations.filter(Boolean).join(";"));
  }

  const api = {escapeHtml, safeUrl, cssUrl, safeColor, safeGradient, styleAttr};
  global.FLOQRSafeRender = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
