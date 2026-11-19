/* Floor-plan trace for FloqMedia Spatial Studio.
   Guest HTTP import: Gemini reads a drawing and returns a proposal. FloqR
   does not store the file, the trace, a project, or a grant. Not a survey. */
"use strict";

const {Type} = require("@google/genai");

const TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";
const OPERATION = "spatial-plan-trace";
const UNREADABLE_ERROR = "That file could not be read as a floor plan.";
const OVERSIZE_ERROR = "That file is too large. Use a file under 12 MB.";
const ORIGIN_ERROR = "That request is not allowed from this site.";
const APP_CHECK_ERROR = "FloqR could not read that plan.";
const ALLOW_HEADERS = "Content-Type, Authorization, X-Firebase-AppCheck";
const APP_CHECK_HEADER = "X-Firebase-AppCheck";
const MAX_APP_CHECK_CHARS = 8192;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_FILE_BYTES * 4 / 3) + 128;
const MAX_OBJECTS = 200;
const MAX_WARNINGS = 20;
const MAX_NAME = 80;
const MAX_WARNING = 240;

const STUDIO_ORIGINS = Object.freeze([
  "https://studio.floqmedia.com",
  "https://www.floqmedia.com",
  "https://floqmedia.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://studio.localhost:3000"
]);

const OBJECT_KINDS = Object.freeze(["wall", "opening", "door", "window", "furniture"]);
const KIND_SET = new Set(OBJECT_KINDS);
const SCALE_SET = new Set(["estimated", "inferred"]);

const MIME_BY_EXT = Object.freeze({
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml"
});

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/tif",
  "image/heic",
  "image/heif",
  "image/avif",
  "application/pdf",
  "application/x-pdf",
  "image/svg+xml"
]);

const PLAN_TRACE_PROMPT = [
  "You read a floor-plan drawing (plan view). Return only JSON that matches the schema.",
  "Do not wrap the JSON in markdown. Do not add commentary.",
  "",
  "JSON fields:",
  "- spaceName: short name for the room if the drawing labels one, else \"Room\".",
  "- widthM, depthM: room size in meters, or JSON null when the drawing has no scale.",
  "- scale: \"inferred\" when dimension labels or a scale bar can be read; otherwise \"estimated\".",
  "- objects: visible elements only. Each object is {kind, name, x, z, widthM, depthM}.",
  "- kind must be one of: wall, opening, door, window, furniture.",
  "- x is east in meters and z is north in meters, from the south-west corner of the room.",
  "- warnings: short notes about missing scale or uncertain pieces. Empty array if none.",
  "",
  "Rules:",
  "- Use meters. Never claim this is a measured survey.",
  "- If the drawing has no readable scale or dimension, set scale to \"estimated\" and set widthM and depthM to JSON null. Do not invent a measured room size.",
  "- Omit a door, window, or furniture piece you cannot see. Do not invent furniture.",
  "- Include walls and openings only when they are drawn.",
  "- Object widthM and depthM may be JSON null when size cannot be read.",
  "- Coordinates must be finite numbers. Skip anything you cannot place."
].join("\n");

const TRACE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    spaceName: {type: Type.STRING},
    widthM: {type: Type.NUMBER, nullable: true},
    depthM: {type: Type.NUMBER, nullable: true},
    scale: {type: Type.STRING, enum: ["estimated", "inferred"]},
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          kind: {type: Type.STRING, enum: OBJECT_KINDS.slice()},
          name: {type: Type.STRING},
          x: {type: Type.NUMBER},
          z: {type: Type.NUMBER},
          widthM: {type: Type.NUMBER, nullable: true},
          depthM: {type: Type.NUMBER, nullable: true}
        },
        required: ["kind", "name", "x", "z"]
      }
    },
    warnings: {type: Type.ARRAY, items: {type: Type.STRING}}
  },
  required: ["spaceName", "scale", "objects"]
};

function text(value, max = MAX_NAME) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function corsOrigin(origin) {
  const clean = String(origin == null ? "" : origin).trim();
  return STUDIO_ORIGINS.includes(clean) ? clean : "";
}

function applyCors(res, origin) {
  if (!origin) return;
  if (typeof res.set === "function") {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
    res.set("Access-Control-Max-Age", "3600");
    return;
  }
  res.headers = Object.assign({}, res.headers, {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "3600"
  });
}

function sendJson(res, status, body) {
  if (typeof res.status === "function") res.status(status);
  else res.statusCode = status;
  if (typeof res.json === "function") {
    res.json(body);
    return;
  }
  res.body = body;
}

function header(req, name) {
  const key = String(name || "").toLowerCase();
  if (typeof req.get === "function") return req.get(name) || req.get(key) || "";
  const headers = req.headers || {};
  return headers[name] || headers[key] || "";
}

function extOf(fileName) {
  const base = String(fileName || "").trim().toLowerCase();
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : "";
}

function normalizeMime(mime, fileName) {
  const raw = String(mime || "").trim().toLowerCase().split(";")[0].trim();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw === "image/tif") return "image/tiff";
  if (raw === "application/x-pdf") return "application/pdf";
  if (raw === "image/svg+xml" || (raw === "text/xml" && extOf(fileName) === ".svg")) return "image/svg+xml";
  if (raw && ALLOWED_MIMES.has(raw)) return raw;
  return MIME_BY_EXT[extOf(fileName)] || "";
}

function isSvg(mime, fileName) {
  return normalizeMime(mime, fileName) === "image/svg+xml" || extOf(fileName) === ".svg";
}

function stripDataUrl(raw) {
  const value = String(raw == null ? "" : raw).trim();
  const idx = value.search(/base64,/i);
  const packed = idx >= 0 ? value.slice(idx + 7) : value;
  return packed.replace(/\s+/g, "");
}

function decodeBase64(dataBase64) {
  const packed = stripDataUrl(dataBase64);
  if (!packed) return {ok: false, error: UNREADABLE_ERROR, status: 400};
  if (packed.length > MAX_BASE64_CHARS) return {ok: false, error: OVERSIZE_ERROR, status: 413};
  let buffer;
  try {
    buffer = Buffer.from(packed, "base64");
  } catch (_) {
    return {ok: false, error: UNREADABLE_ERROR, status: 400};
  }
  if (!buffer.length) return {ok: false, error: UNREADABLE_ERROR, status: 400};
  if (buffer.length > MAX_FILE_BYTES) return {ok: false, error: OVERSIZE_ERROR, status: 413};
  return {ok: true, buffer, dataBase64: packed};
}

function readBody(req) {
  const body = req && req.body;
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  const raw = req && (req.rawBody != null ? req.rawBody : body);
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  if (Buffer.isBuffer(raw)) {
    try { return JSON.parse(raw.toString("utf8")); } catch (_) { return null; }
  }
  return null;
}

function parseTraceUpload(input = {}) {
  const fileName = text(input.fileName, 200);
  const mime = normalizeMime(input.mime, fileName);
  if (!mime) return {ok: false, error: UNREADABLE_ERROR, status: 400};
  const decoded = decodeBase64(input.dataBase64);
  if (!decoded.ok) return decoded;
  if (isSvg(mime, fileName)) {
    const svgText = decoded.buffer.toString("utf8");
    if (!/<svg[\s>]/i.test(svgText)) return {ok: false, error: UNREADABLE_ERROR, status: 400};
    return {
      ok: true,
      fileName,
      mime: "image/svg+xml",
      kind: "svg",
      svgText,
      byteLength: decoded.buffer.length
    };
  }
  return {
    ok: true,
    fileName,
    mime,
    kind: "inline",
    dataBase64: decoded.dataBase64,
    byteLength: decoded.buffer.length
  };
}

function buildGeminiContents(upload) {
  if (upload.kind === "svg") {
    return [{
      role: "user",
      parts: [{text: `${PLAN_TRACE_PROMPT}\n\nSVG drawing:\n${upload.svgText}`}]
    }];
  }
  return [{
    role: "user",
    parts: [
      {text: PLAN_TRACE_PROMPT},
      {inlineData: {mimeType: upload.mime, data: upload.dataBase64}}
    ]
  }];
}

function looksLikeTrace(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && SCALE_SET.has(text(value.scale, 32).toLowerCase())
    && Array.isArray(value.objects)
  );
}

function extractJsonObject(raw) {
  if (looksLikeTrace(raw)) return raw;
  if (raw && typeof raw === "object") return null;
  const clean = String(raw || "").trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  if (!clean) return null;
  try { return JSON.parse(clean); } catch (_) { /* fall through */ }
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
}

function extractModelText(response) {
  if (response == null) return "";
  if (typeof response.text === "function") {
    try {
      const value = response.text();
      if (value) return String(value);
    } catch (_) { /* use parts */ }
  }
  if (response.text && typeof response.text !== "function") return String(response.text);
  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part && part.text ? part.text : "").join("");
}

function tokenCounts(response) {
  const usage = response?.usageMetadata || response?.usage_metadata || {};
  const promptTokens = Number(usage.promptTokenCount || usage.prompt_token_count) || 0;
  const candidateTokens = Number(usage.candidatesTokenCount || usage.candidates_token_count) || 0;
  const totalTokens = Number(usage.totalTokenCount || usage.total_token_count) || (promptTokens + candidateTokens);
  return {promptTokens, candidateTokens, totalTokens};
}

function finiteOrNull(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function validateObject(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = text(raw.kind, 32).toLowerCase();
  if (!KIND_SET.has(kind)) return null;
  const x = finiteOrNull(raw.x);
  const z = finiteOrNull(raw.z);
  if (x == null || z == null) return null;
  const widthM = finiteOrNull(raw.widthM);
  const depthM = finiteOrNull(raw.depthM);
  if (widthM === undefined || depthM === undefined) return null;
  const name = text(raw.name, MAX_NAME) || kind;
  return {kind, name, x, z, widthM, depthM};
}

function validateTrace(raw) {
  const parsed = extractJsonObject(raw);
  if (!looksLikeTrace(parsed)) return {ok: false, error: UNREADABLE_ERROR};
  const scale = text(parsed.scale, 32).toLowerCase();
  let widthM = finiteOrNull(parsed.widthM);
  let depthM = finiteOrNull(parsed.depthM);
  if (widthM === undefined || depthM === undefined) return {ok: false, error: UNREADABLE_ERROR};
  if (scale === "estimated") {
    widthM = null;
    depthM = null;
  } else if (widthM == null || depthM == null || widthM <= 0 || depthM <= 0) {
    widthM = null;
    depthM = null;
  }
  const source = Array.isArray(parsed.objects) ? parsed.objects : [];
  const objects = [];
  for (const item of source) {
    if (objects.length >= MAX_OBJECTS) break;
    const next = validateObject(item);
    if (next) objects.push(next);
  }
  const warnings = (Array.isArray(parsed.warnings) ? parsed.warnings : [])
    .map((item) => text(item, MAX_WARNING))
    .filter(Boolean)
    .slice(0, MAX_WARNINGS);
  if (source.length > MAX_OBJECTS) {
    warnings.push(`Kept the first ${MAX_OBJECTS} objects.`);
  }
  const spaceName = text(parsed.spaceName, MAX_NAME) || "Room";
  return {
    ok: true,
    trace: {
      spaceName,
      widthM,
      depthM,
      scale: widthM == null || depthM == null ? "estimated" : scale,
      objects,
      warnings
    }
  };
}

function appCheckEnforced(deps = {}) {
  const env = deps.env || process.env;
  return String(env.FLOQR_APP_CHECK_ENFORCE || "") === "1";
}

async function defaultVerifyAppCheck(token, options) {
  const {getAppCheck} = require("firebase-admin/app-check");
  return getAppCheck().verifyToken(token, options);
}

async function inspectAppCheck(req, deps) {
  const token = String(header(req, APP_CHECK_HEADER) || "").trim();
  if (!token) return {ok: false, failureReason: "app_check_missing"};
  if (token.length > MAX_APP_CHECK_CHARS) return {ok: false, failureReason: "app_check_invalid"};
  const verify = typeof deps.verifyAppCheck === "function" ? deps.verifyAppCheck : defaultVerifyAppCheck;
  try {
    const decoded = await verify(token, {consume: true});
    if (!decoded || decoded.alreadyConsumed === true) {
      return {ok: false, failureReason: "app_check_invalid"};
    }
    return {ok: true};
  } catch (_error) {
    return {ok: false, failureReason: "app_check_invalid"};
  }
}

async function safeLog(logAccess, entry) {
  if (typeof logAccess !== "function") return;
  try {
    await logAccess({
      operation: OPERATION,
      uid: "guest",
      ...entry
    });
  } catch (error) {
    console.warn("spatial-plan-trace access log failed", error?.message || error);
  }
}

async function handlePlanTraceRequest(req, res, deps = {}) {
  const origin = corsOrigin(header(req, "origin"));
  if (!origin) {
    sendJson(res, 403, {ok: false, error: ORIGIN_ERROR});
    return {ok: false, status: 403, error: ORIGIN_ERROR};
  }
  applyCors(res, origin);
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    if (typeof res.status === "function") res.status(204);
    else res.statusCode = 204;
    if (typeof res.send === "function") res.send("");
    else res.body = "";
    return {ok: true, status: 204};
  }
  if (method !== "POST") {
    sendJson(res, 405, {ok: false, error: "invalid_request"});
    return {ok: false, status: 405};
  }

  const model = text(deps.model, 80) || TEXT_MODEL;
  const appCheck = await inspectAppCheck(req, deps);
  if (!appCheck.ok) {
    await safeLog(deps.logAccess, {
      ok: false,
      model,
      failureReason: appCheck.failureReason,
      details: {totalTokens: 0}
    });
    if (appCheckEnforced(deps)) {
      sendJson(res, 401, {ok: false, error: APP_CHECK_ERROR});
      return {ok: false, status: 401, error: APP_CHECK_ERROR};
    }
  }

  const body = readBody(req);
  if (!body) {
    sendJson(res, 400, {ok: false, error: UNREADABLE_ERROR});
    return {ok: false, status: 400};
  }
  const upload = parseTraceUpload(body);
  if (!upload.ok) {
    sendJson(res, upload.status || 400, {ok: false, error: upload.error || UNREADABLE_ERROR});
    return {ok: false, status: upload.status || 400, error: upload.error};
  }

  const generateContent = deps.generateContent;
  if (typeof generateContent !== "function") {
    await safeLog(deps.logAccess, {ok: false, model, failureReason: "gemini_unconfigured", details: {totalTokens: 0}});
    sendJson(res, 200, {ok: false, error: UNREADABLE_ERROR});
    return {ok: false, status: 200, error: UNREADABLE_ERROR};
  }

  let response;
  try {
    response = await generateContent({
      model,
      contents: buildGeminiContents(upload),
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: TRACE_SCHEMA
      }
    });
  } catch (error) {
    await safeLog(deps.logAccess, {
      ok: false,
      model,
      failureReason: text(error?.message || error, 180) || "gemini_failed",
      details: {totalTokens: 0}
    });
    sendJson(res, 200, {ok: false, error: UNREADABLE_ERROR});
    return {ok: false, status: 200, error: UNREADABLE_ERROR};
  }

  const tokens = tokenCounts(response);
  const validated = validateTrace(extractModelText(response));
  if (!validated.ok) {
    await safeLog(deps.logAccess, {
      ok: false,
      model,
      failureReason: "trace_invalid",
      details: tokens
    });
    sendJson(res, 200, {ok: false, error: UNREADABLE_ERROR});
    return {ok: false, status: 200, error: UNREADABLE_ERROR};
  }

  await safeLog(deps.logAccess, {
    ok: true,
    model,
    details: tokens
  });
  sendJson(res, 200, {ok: true, trace: validated.trace});
  return {ok: true, status: 200, trace: validated.trace};
}

module.exports = {
  TEXT_MODEL,
  OPERATION,
  UNREADABLE_ERROR,
  OVERSIZE_ERROR,
  ORIGIN_ERROR,
  APP_CHECK_ERROR,
  ALLOW_HEADERS,
  MAX_FILE_BYTES,
  MAX_OBJECTS,
  STUDIO_ORIGINS,
  OBJECT_KINDS,
  PLAN_TRACE_PROMPT,
  TRACE_SCHEMA,
  corsOrigin,
  parseTraceUpload,
  buildGeminiContents,
  extractJsonObject,
  validateTrace,
  handlePlanTraceRequest
};
