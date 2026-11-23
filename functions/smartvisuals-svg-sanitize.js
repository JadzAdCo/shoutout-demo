"use strict";
/* SMARTvisual media sanitizer — SVG (stencils + backgrounds) and JPEG/PNG/WebP (backgrounds).
   Reject scripts, foreignObject, handlers, external refs. Prefer <img src> for untrusted files.
   Only vetted published icons may be inlined. Raster is magic-byte gated, never treated as SVG. */

const FORBIDDEN_TAG = /<\s*(script|foreignObject|iframe|object|embed|link|meta|style|handler|animate|set|use)\b/i;
const EVENT_ATTR = /\bon[a-z]+\s*=/i;
const EXTERNAL = /\b(?:href|xlink:href|src)\s*=\s*["']\s*(?:https?:|\/\/|javascript:|data:)/i;
const FILTER = /<\s*filter\b/i;
const ENTITY = /<!ENTITY|&lt;script/i;

const MAX_BYTES = 180 * 1024;
const MAX_RASTER_BYTES = 500 * 1024;
const MAX_CHARS = 200 * 1024;

const RASTER_TYPES = Object.freeze({
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp"
});

function sniffRaster(buf) {
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {ok: true, contentType: "image/jpeg"};
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return {ok: true, contentType: "image/png"};
  }
  if (
    bytes.length >= 12
    && bytes.slice(0, 4).toString("ascii") === "RIFF"
    && bytes.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return {ok: true, contentType: "image/webp"};
  }
  return {ok: false, reason: "unsupported-type"};
}

function decodeImagePayload(raw) {
  if (Buffer.isBuffer(raw)) return raw;
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return Buffer.alloc(0);
  const dataUrl = text.match(/^data:([a-z0-9.+/-]+);base64,(.+)$/i);
  const b64 = dataUrl ? dataUrl[2] : text.replace(/\s+/g, "");
  try {
    return Buffer.from(b64, "base64");
  } catch (_) {
    return Buffer.alloc(0);
  }
}

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
  return {ok: true, bytes, reason: "ok", svg: text, contentType: "image/svg+xml", kind: "svg"};
}

function sanitizeRaster(raw, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const maxBytes = Number(options.maxBytes) || MAX_RASTER_BYTES;
  const buf = decodeImagePayload(raw);
  if (!buf.length) return {ok: false, reason: "empty"};
  if (buf.length > maxBytes) return {ok: false, reason: "too-large", bytes: buf.length};
  const sniff = sniffRaster(buf);
  if (!sniff.ok) return {ok: false, reason: sniff.reason || "unsupported-type", bytes: buf.length};
  const declared = RASTER_TYPES[String(options.contentType || "").toLowerCase()] || "";
  if (declared && declared !== sniff.contentType) {
    return {ok: false, reason: "type-mismatch", bytes: buf.length, contentType: sniff.contentType};
  }
  return {
    ok: true,
    reason: "ok",
    kind: "raster",
    bytes: buf.length,
    contentType: sniff.contentType,
    imageBase64: buf.toString("base64")
  };
}

function sanitizeSmartVisualUpload(payload, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const assetType = String(options.assetType || payload && payload.type || "").toLowerCase();
  const svg = payload && payload.svg != null ? String(payload.svg) : "";
  const image = payload && (payload.imageBase64 || payload.image || payload.raster);
  if (svg.trim() && image) return {ok: false, reason: "mixed-payload"};
  if (svg.trim()) {
    return sanitizeSvg(svg, options);
  }
  if (image) {
    if (assetType === "stencil") return {ok: false, reason: "stencil-requires-svg"};
    return sanitizeRaster(image, {
      maxBytes: options.maxBytes,
      contentType: options.contentType || payload.contentType
    });
  }
  return {ok: false, reason: "empty"};
}

module.exports = {
  sanitizeSvg,
  sanitizeRaster,
  sanitizeSmartVisualUpload,
  sniffRaster,
  MAX_BYTES,
  MAX_RASTER_BYTES,
  RASTER_TYPES
};
