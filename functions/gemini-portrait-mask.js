"use strict";

/**
 * Gemini person-segmentation → full-frame alpha mask (provider-specific).
 * Default: gemini-3.8-flash (2.5 Flash is retired for many new API keys).
 * Override: FLOQR_GEMINI_SEGMENTATION_MODEL.
 * Docs: aistudio.google.com/docs/image-understanding (Segmentation).
 *
 * 3.x often returns polygon masks (0–1000); 2.5 may return base64 PNG probability maps.
 * Contour quality is coarse (not professional hair matting).
 */

const {GoogleGenAI} = require("@google/genai");
const {PNG} = require("pngjs");

const SEGMENTATION_MODEL = process.env.FLOQR_GEMINI_SEGMENTATION_MODEL || "gemini-3.8-flash";
const LIMITATION =
  "Gemini segmentation returns a coarse probability / contour mask (PNG or polygon). Hair and glasses edges are approximate — not professional soft matting. Original photo pixels are preserved; Gemini only supplies subject boundaries.";

/** Gemini 2.5 uses thinkingBudget; 3.x uses thinkingLevel.
 * gemini-3.8-flash / 3.7-flash reject MINIMAL (400) — use LOW (lowest supported). */
function thinkingConfigForModel(model = SEGMENTATION_MODEL) {
  const id = String(model || "").toLowerCase();
  if (/gemini-2\.5/.test(id)) return {thinkingBudget: 0};
  if (/gemini-3\./.test(id)) return {thinkingLevel: "LOW"};
  return {thinkingLevel: "LOW"};
}

function isThinkingConfigRejected(error) {
  const msg = String(error?.message || error || "");
  return /thinking\s*level|thinkingConfig|MINIMAL|INVALID_ARGUMENT/i.test(msg)
    && /thinking|MINIMAL|not supported/i.test(msg);
}

async function generateSegmentationContent(ai, {contents, thinkingConfig}) {
  const base = {
    model: SEGMENTATION_MODEL,
    contents,
    config: {
      responseMimeType: "application/json"
    }
  };
  if (thinkingConfig) {
    base.config.thinkingConfig = thinkingConfig;
  }
  return ai.models.generateContent(base);
}

function readImageSize(buffer, contentType = "") {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("png") || (buffer[0] === 0x89 && buffer[1] === 0x50)) {
    if (buffer.length < 24) throw new Error("PNG too small to read dimensions.");
    return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
  }
  if (type.includes("jpeg") || type.includes("jpg") || (buffer[0] === 0xff && buffer[1] === 0xd8)) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) { i += 1; continue; }
      const marker = buffer[i + 1];
      if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
      const len = buffer.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7)};
      }
      i += 2 + len;
    }
    throw new Error("Could not read JPEG dimensions.");
  }
  if (type.includes("webp") && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    // VP8X or VP8 simple
    if (buffer.toString("ascii", 12, 16) === "VP8X" && buffer.length >= 30) {
      const w = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
      const h = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
      return {width: w, height: h};
    }
    if (buffer.toString("ascii", 12, 16) === "VP8 " && buffer.length >= 30) {
      const w = buffer.readUInt16LE(26) & 0x3fff;
      const h = buffer.readUInt16LE(28) & 0x3fff;
      return {width: w, height: h};
    }
  }
  throw new Error(`Unsupported image type for dimension probe: ${contentType || "unknown"}`);
}

function stripDataUrl(b64 = "") {
  const raw = String(b64 || "").trim();
  const idx = raw.indexOf("base64,");
  return idx >= 0 ? raw.slice(idx + 7) : raw.replace(/^data:image\/\w+;base64,/, "");
}

function parseSegmentationJson(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end <= start) throw new Error("Gemini segmentation response was not JSON.");
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.boxes)) return parsed.boxes;
  if (Array.isArray(parsed?.masks)) return parsed.masks;
  if (parsed && typeof parsed === "object" && parsed.box_2d) return [parsed];
  return [];
}

function pickPrimaryPerson(items = []) {
  const list = Array.isArray(items) ? items : [];
  const person = list.find((item) => /person|human|man|woman|face|portrait|subject|people|boy|girl/i.test(String(item?.label || "")));
  return person || list[0] || null;
}

function decodeMaskPng(base64) {
  const buf = Buffer.from(stripDataUrl(base64), "base64");
  if (!buf.length) throw new Error("Empty segmentation mask.");
  return PNG.sync.read(buf);
}

function rasterizePolygonMask(points, boxW, boxH, imgW, imgH) {
  // points are [x,y] normalized 0–1000 in image space (Gemini 3-style polygon fallback).
  const png = new PNG({width: boxW, height: boxH, colorType: 0, inputColorType: 0, bitDepth: 8});
  png.data.fill(0);
  if (!Array.isArray(points) || points.length < 3) return png;
  const abs = points.map((pt) => {
    const x = Array.isArray(pt) ? Number(pt[0]) : Number(pt?.x);
    const y = Array.isArray(pt) ? Number(pt[1]) : Number(pt?.y);
    return {
      x: Math.round((x / 1000) * imgW),
      y: Math.round((y / 1000) * imgH)
    };
  });
  // Scanline fill in image space, then crop to box — box origin supplied by caller via offsets.
  return {polygonAbs: abs, png};
}

function coverageToGray(r, g, b, a) {
  if (a === 0) return 0;
  // Prefer luminance; Gemini masks are usually grayscale replicated across RGB.
  return Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
}

function placeMaskInFrame({sourceWidth, sourceHeight, box2d, maskPng, polygonAbs = null}) {
  const [ny0, nx0, ny1, nx1] = box2d;
  const x0 = Math.max(0, Math.floor((nx0 / 1000) * sourceWidth));
  const y0 = Math.max(0, Math.floor((ny0 / 1000) * sourceHeight));
  const x1 = Math.min(sourceWidth, Math.ceil((nx1 / 1000) * sourceWidth));
  const y1 = Math.min(sourceHeight, Math.ceil((ny1 / 1000) * sourceHeight));
  const boxW = Math.max(1, x1 - x0);
  const boxH = Math.max(1, y1 - y0);

  const out = new PNG({width: sourceWidth, height: sourceHeight, colorType: 6});
  out.data.fill(0);

  if (polygonAbs && polygonAbs.length >= 3) {
    // Coarse polygon fill (edge limitation — not soft matting).
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        if (!pointInPolygon(x, y, polygonAbs)) continue;
        const i = (sourceWidth * y + x) << 2;
        out.data[i] = 255;
        out.data[i + 1] = 255;
        out.data[i + 2] = 255;
        out.data[i + 3] = 255;
      }
    }
    return {png: out, box: {x0, y0, x1, y1}, softEdges: false};
  }

  if (!maskPng) throw new Error("Segmentation item had neither a PNG mask nor a polygon.");

  // Nearest-neighbor resample mask PNG into the bounding box, grayscale → alpha.
  for (let y = 0; y < boxH; y += 1) {
    const sy = Math.min(maskPng.height - 1, Math.floor((y / boxH) * maskPng.height));
    for (let x = 0; x < boxW; x += 1) {
      const sx = Math.min(maskPng.width - 1, Math.floor((x / boxW) * maskPng.width));
      const si = (maskPng.width * sy + sx) << 2;
      const gray = coverageToGray(maskPng.data[si], maskPng.data[si + 1], maskPng.data[si + 2], maskPng.data[si + 3]);
      const dx = x0 + x;
      const dy = y0 + y;
      if (dx < 0 || dy < 0 || dx >= sourceWidth || dy >= sourceHeight) continue;
      const di = (sourceWidth * dy + dx) << 2;
      out.data[di] = 255;
      out.data[di + 1] = 255;
      out.data[di + 2] = 255;
      out.data[di + 3] = gray; // soft edges retained when Gemini returns midtones
    }
  }
  return {png: out, box: {x0, y0, x1, y1}, softEdges: true};
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x; const yi = poly[i].y;
    const xj = poly[j].x; const yj = poly[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function encodePng(png) {
  return PNG.sync.write(png);
}

async function callGeminiPersonSegmentation({apiKey, buffer, contentType}) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for portrait segmentation.");
  const {width, height} = readImageSize(buffer, contentType);
  if (width < 32 || height < 32) throw new Error("Portrait image is too small.");
  if (width > 8000 || height > 8000) throw new Error("Portrait image dimensions exceed 8000 px.");

  const ai = new GoogleGenAI({apiKey});
  const prompt = [
    "Give the segmentation mask for the primary human person in this photo.",
    "Include head, hair, face, neck, and visible shoulders only (not the full body if cropped).",
    "Output a JSON list of segmentation masks where each entry contains:",
    '- "box_2d": [ymin, xmin, ymax, xmax] normalized to 0-1000',
    '- "mask": either (a) a base64-encoded PNG probability map (values 0–255) for the region inside the box, or (b) a polygon of [x, y] points normalized to 0–1000',
    '- "label": a short text label (e.g. "person")',
    "Prefer exactly one entry for the most prominent person. Do not redraw or beautify the photo."
  ].join("\n");

  const contents = [
    {inlineData: {mimeType: contentType || "image/jpeg", data: buffer.toString("base64")}},
    prompt
  ];
  let response;
  try {
    response = await generateSegmentationContent(ai, {
      contents,
      thinkingConfig: thinkingConfigForModel(SEGMENTATION_MODEL)
    });
  } catch (error) {
    // Model may reject a thinking level we send — retry once with no thinkingConfig.
    if (!isThinkingConfigRejected(error)) throw error;
    response = await generateSegmentationContent(ai, {contents, thinkingConfig: null});
  }

  const text = String(response?.text || response?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") || "");
  const items = parseSegmentationJson(text);
  const primary = pickPrimaryPerson(items);
  if (!primary?.box_2d || !Array.isArray(primary.box_2d) || primary.box_2d.length !== 4) {
    throw new Error("Gemini did not return a valid person segmentation box_2d.");
  }

  let maskPng = null;
  let polygonAbs = null;
  let maskFormat = "unknown";
  if (typeof primary.mask === "string" && /[A-Za-z0-9+/=]{32,}/.test(stripDataUrl(primary.mask))) {
    maskPng = decodeMaskPng(primary.mask);
    maskFormat = "base64-png";
  } else if (Array.isArray(primary.mask) && Array.isArray(primary.mask[0])) {
    const raster = rasterizePolygonMask(primary.mask, 1, 1, width, height);
    polygonAbs = raster.polygonAbs;
    maskFormat = "polygon";
  } else {
    throw new Error(
      "Gemini segmentation mask was not a base64 PNG or polygon. " +
      `Model=${SEGMENTATION_MODEL}. Override with FLOQR_GEMINI_SEGMENTATION_MODEL if needed.`
    );
  }

  const placed = placeMaskInFrame({
    sourceWidth: width,
    sourceHeight: height,
    box2d: primary.box_2d.map((n) => Number(n)),
    maskPng,
    polygonAbs
  });
  const maskBuffer = encodePng(placed.png);

  return {
    model: SEGMENTATION_MODEL,
    label: String(primary.label || "person").slice(0, 80),
    box2d: primary.box_2d,
    boxPixels: placed.box,
    width,
    height,
    maskFormat,
    softEdges: placed.softEdges,
    maskPngBuffer: maskBuffer,
    maskContentType: "image/png",
    limitations: LIMITATION + (maskFormat === "polygon"
      ? " Polygon fallback was used — edges are hard-cut, not soft-matted."
      : "")
  };
}

module.exports = {
  SEGMENTATION_MODEL,
  LIMITATION,
  thinkingConfigForModel,
  isThinkingConfigRejected,
  readImageSize,
  parseSegmentationJson,
  pickPrimaryPerson,
  callGeminiPersonSegmentation,
  placeMaskInFrame,
  encodePng
};
