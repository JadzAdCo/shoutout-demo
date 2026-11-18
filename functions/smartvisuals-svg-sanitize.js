"use strict";
/* SMARTvisual SVG sanitizer — reject scripts, foreignObject, handlers, external refs.
   Prefer <img src> for untrusted files. Only vetted published icons may be inlined. */

const FORBIDDEN_TAG = /<\s*(script|foreignObject|iframe|object|embed|link|meta|style|handler|animate|set|use)\b/i;
const EVENT_ATTR = /\bon[a-z]+\s*=/i;
const EXTERNAL = /\b(?:href|xlink:href|src)\s*=\s*["']\s*(?:https?:|\/\/|javascript:|data:)/i;
const FILTER = /<\s*filter\b/i;
const ENTITY = /<!ENTITY|&lt;script/i;

const MAX_BYTES = 180 * 1024;
const MAX_CHARS = 200 * 1024;

function sanitizeSvg(raw, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const maxBytes = Number(options.maxBytes) || MAX_BYTES;
  const text = String(raw == null ? "" : raw);
  const bytes = Buffer.byteLength(text, "utf8");
  if (!text.trim()) return {ok: false, reason: "empty"};
  if (bytes > maxBytes || text.length > MAX_CHARS) return {ok: false, reason: "too-large", bytes};
  if (!/<svg[\s>]/i.test(text)) return {ok: false, reason: "not-svg"};
  if (FORBIDDEN_TAG.test(text)) return {ok: false, reason: "forbidden-tag"};
  if (EVENT_ATTR.test(text)) return {ok: false, reason: "event-handler"};
  if (EXTERNAL.test(text)) return {ok: false, reason: "external-ref"};
  if (FILTER.test(text) && options.allowFilter !== true) return {ok: false, reason: "filter"};
  if (ENTITY.test(text)) return {ok: false, reason: "entity"};
  if (/<\?xml-stylesheet/i.test(text)) return {ok: false, reason: "stylesheet"};
  return {ok: true, bytes, reason: "ok", svg: text};
}

module.exports = {sanitizeSvg, MAX_BYTES};
