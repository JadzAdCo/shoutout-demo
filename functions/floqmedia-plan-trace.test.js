"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const core = require("./floqmedia-plan-trace-core");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>';
const SVG_B64 = Buffer.from(SVG_TEXT, "utf8").toString("base64");

const KNOWN_TRACE = {
  spaceName: "Lobby",
  widthM: 6,
  depthM: 4,
  scale: "inferred",
  objects: [
    {kind: "furniture", name: "Desk", x: 1, z: 1, widthM: 1.2, depthM: 0.6},
    {kind: "door", name: "Entry", x: 0, z: 2, widthM: 0.9, depthM: 0.1}
  ],
  warnings: []
};

function mockReq({origin = "https://studio.floqmedia.com", method = "POST", body} = {}) {
  return {
    method,
    body,
    get(name) {
      if (String(name).toLowerCase() === "origin") return origin;
      return "";
    }
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    }
  };
}

function fakeGemini(payload, {fail, capture} = {}) {
  return async (request) => {
    if (capture) capture.request = request;
    if (fail) throw new Error("model exploded");
    return {
      text: JSON.stringify(payload),
      usageMetadata: {promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 18}
    };
  };
}

test("studio CORS list matches Spatial Studio origins and rejects others", () => {
  assert.deepEqual(core.STUDIO_ORIGINS, [
    "https://studio.floqmedia.com",
    "https://www.floqmedia.com",
    "https://floqmedia.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://studio.localhost:3000"
  ]);
  for (const origin of core.STUDIO_ORIGINS) {
    assert.equal(core.corsOrigin(origin), origin);
  }
  assert.equal(core.corsOrigin("https://evil.example"), "");
  assert.equal(core.corsOrigin("https://studio.floqmedia.com.evil"), "");
  assert.equal(core.corsOrigin(""), "");
});

test("validateTrace keeps a known Gemini payload and drops non-finite objects", () => {
  const ok = core.validateTrace(KNOWN_TRACE);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.trace, KNOWN_TRACE);

  const estimated = core.validateTrace({
    spaceName: "Lobby",
    widthM: 6,
    depthM: 4,
    scale: "estimated",
    objects: [],
    warnings: []
  });
  assert.equal(estimated.trace.scale, "estimated");
  assert.equal(estimated.trace.widthM, null);
  assert.equal(estimated.trace.depthM, null);

  const cleaned = core.validateTrace({
    spaceName: "Hall",
    widthM: 10,
    depthM: 8,
    scale: "inferred",
    objects: [
      {kind: "wall", name: "North", x: 0, z: 8, widthM: 10, depthM: 0.2},
      {kind: "sofa", name: "Nope", x: 1, z: 1, widthM: 2, depthM: 1},
      {kind: "window", name: "East", x: Number.NaN, z: 2, widthM: 1, depthM: 0.1},
      {kind: "furniture", name: "Chair", x: 2, z: 2, widthM: Number.POSITIVE_INFINITY, depthM: 1}
    ],
    warnings: ["dim"]
  });
  assert.equal(cleaned.ok, true);
  assert.equal(cleaned.trace.objects.length, 1);
  assert.equal(cleaned.trace.objects[0].kind, "wall");

  assert.equal(core.validateTrace("").ok, false);
  assert.equal(core.validateTrace({}).ok, false);
  assert.equal(core.validateTrace({spaceName: "Room", objects: []}).ok, false);
  assert.equal(core.validateTrace({
    candidates: [{content: {parts: []}}],
    usageMetadata: {totalTokenCount: 0}
  }).ok, false);
});

test("validateTrace caps the object list at 200", () => {
  const objects = [];
  for (let i = 0; i < 205; i += 1) {
    objects.push({kind: "furniture", name: `T${i}`, x: i, z: 0, widthM: 1, depthM: 1});
  }
  const out = core.validateTrace({
    spaceName: "Ballroom",
    widthM: 20,
    depthM: 10,
    scale: "inferred",
    objects,
    warnings: []
  });
  assert.equal(out.trace.objects.length, 200);
  assert.ok(out.trace.warnings.some((item) => /200/.test(item)));
});

test("SVG is sent as prompt text; still image is inline data", () => {
  const svg = core.parseTraceUpload({fileName: "room.svg", mime: "image/svg+xml", dataBase64: SVG_B64});
  assert.equal(svg.ok, true);
  const svgContents = core.buildGeminiContents(svg);
  assert.equal(svgContents[0].parts.length, 1);
  assert.match(svgContents[0].parts[0].text, /<svg/);
  assert.match(svgContents[0].parts[0].text, /south-west corner/);
  assert.equal(svgContents[0].parts[0].inlineData, undefined);

  const charsetSvg = core.parseTraceUpload({
    fileName: "room.svg",
    mime: "image/svg+xml",
    dataBase64: `data:image/svg+xml;charset=utf-8;base64,${SVG_B64}`
  });
  assert.equal(charsetSvg.ok, true);
  assert.match(charsetSvg.svgText, /<svg/);

  const png = core.parseTraceUpload({fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1});
  assert.equal(png.ok, true);
  const pngContents = core.buildGeminiContents(png);
  assert.equal(pngContents[0].parts[1].inlineData.mimeType, "image/png");
  assert.equal(pngContents[0].parts[1].inlineData.data, PNG_1X1);
  assert.doesNotMatch(core.PLAN_TRACE_PROMPT, /SmartView|BOT DEE|contextualSearch/i);
});

test("known image response becomes a trace with ok: true", async () => {
  const logs = [];
  const capture = {};
  const req = mockReq({
    body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}
  });
  const res = mockRes();
  const result = await core.handlePlanTraceRequest(req, res, {
    generateContent: fakeGemini(KNOWN_TRACE, {capture}),
    logAccess: async (entry) => logs.push(entry),
    model: "gemini-3.6-flash"
  });
  assert.equal(result.ok, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.trace, KNOWN_TRACE);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://studio.floqmedia.com");
  assert.equal(capture.request.contents[0].parts[1].inlineData.mimeType, "image/png");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].ok, true);
  assert.equal(logs[0].operation, "spatial-plan-trace");
  assert.equal(logs[0].model, "gemini-3.6-flash");
  assert.equal(logs[0].details.totalTokens, 18);
  assert.equal(logs[0].details.dataBase64, undefined);
  assert.equal(JSON.stringify(logs).includes(PNG_1X1), false);
});

test("empty Gemini output becomes ok: false, not an empty Room", async () => {
  const logs = [];
  const res = mockRes();
  const result = await core.handlePlanTraceRequest(
    mockReq({body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    res,
    {
      generateContent: async () => ({
        text: "",
        candidates: [{content: {parts: []}}],
        usageMetadata: {totalTokenCount: 0}
      }),
      logAccess: async (entry) => logs.push(entry)
    }
  );
  assert.equal(result.ok, false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {ok: false, error: core.UNREADABLE_ERROR});
  assert.equal(logs[0].ok, false);
  assert.equal(logs[0].failureReason, "trace_invalid");
});

test("model failure becomes ok: false and a short error", async () => {
  const logs = [];
  const res = mockRes();
  const result = await core.handlePlanTraceRequest(
    mockReq({body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    res,
    {generateContent: fakeGemini(KNOWN_TRACE, {fail: true}), logAccess: async (entry) => logs.push(entry)}
  );
  assert.equal(result.ok, false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {ok: false, error: core.UNREADABLE_ERROR});
  assert.equal(logs[0].ok, false);
  assert.equal(logs[0].operation, "spatial-plan-trace");
  assert.match(logs[0].failureReason, /exploded/);
});

test("oversize body is refused", async () => {
  const huge = Buffer.alloc(core.MAX_FILE_BYTES + 1).toString("base64");
  const res = mockRes();
  const called = {n: 0};
  const result = await core.handlePlanTraceRequest(
    mockReq({body: {fileName: "huge.png", mime: "image/png", dataBase64: huge}}),
    res,
    {generateContent: async () => { called.n += 1; return {}; }}
  );
  assert.equal(result.ok, false);
  assert.equal(res.statusCode, 413);
  assert.deepEqual(res.body, {ok: false, error: core.OVERSIZE_ERROR});
  assert.equal(called.n, 0);
});

test("origin outside the studio list is refused", async () => {
  const res = mockRes();
  const called = {n: 0};
  const result = await core.handlePlanTraceRequest(
    mockReq({
      origin: "https://evil.example",
      body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}
    }),
    res,
    {generateContent: async () => { called.n += 1; return {}; }}
  );
  assert.equal(result.ok, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.ok, false);
  assert.equal(res.headers["Access-Control-Allow-Origin"], undefined);
  assert.equal(called.n, 0);
});

test("localhost studio origins are allowed for a guest with no FloqR session", async () => {
  const res = mockRes();
  const result = await core.handlePlanTraceRequest(
    mockReq({
      origin: "http://studio.localhost:3000",
      body: {fileName: "room.svg", mime: "image/svg+xml", dataBase64: SVG_B64}
    }),
    res,
    {generateContent: fakeGemini(KNOWN_TRACE)}
  );
  assert.equal(result.ok, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "http://studio.localhost:3000");
});

test("function does not write a project document or a spatialGrantRefs row", async () => {
  const logs = [];
  await core.handlePlanTraceRequest(
    mockReq({body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    mockRes(),
    {generateContent: fakeGemini(KNOWN_TRACE), logAccess: async (entry) => logs.push(entry)}
  );
  assert.equal(logs.length, 1);

  const coreSrc = read("functions/floqmedia-plan-trace-core.js");
  const fnSrc = read("functions/floqmedia-plan-trace-functions.js");
  assert.doesNotMatch(coreSrc, /spatialGrantRefs|sinemaScenes|oidcAuthCodes|collection\(/);
  assert.doesNotMatch(fnSrc, /spatialGrantRefs|sinemaScenes|oidcAuthCodes/);
  assert.doesNotMatch(fnSrc, /\.collection\((['"])(?!geminiApiAccessLogs)/);
  assert.match(fnSrc, /logGeminiApiAccess/);
  assert.doesNotMatch(fnSrc, /request\.auth|requireAuth|verifyJwt/);
  assert.doesNotMatch(coreSrc, /console\.(log|info|debug|warn).*(dataBase64|svgText)/);
  assert.doesNotMatch(fnSrc, /FLOQR_OIDC_JWT_SECRET/);
  assert.match(fnSrc, /defineSecret\("GEMINI_API_KEY"\)/);
  assert.match(fnSrc, /@google\/genai/);
  assert.match(fnSrc, /FLOQR_GEMINI_TEXT_MODEL/);
  assert.match(fnSrc, /gemini-3\.6-flash/);
  assert.match(fnSrc, /invoker:\s*"public"/);
  assert.match(fnSrc, /cors:\s*false/);
});

test("HTTP function is exported next to the other spatial functions and tagged for spatial deploy", () => {
  const index = read("functions/index.js");
  assert.match(index, /floqmediaPlanTrace:\s*require\("\.\/floqmedia-plan-trace-functions"\)\.floqmediaPlanTrace/);
  const workflow = read(".github/workflows/functions-ci.yml");
  assert.match(workflow, /floqmediaPlanTrace/);
  const oidcDoc = read("docs/FLOQR-OIDC-FLOQMEDIA.md");
  assert.match(oidcDoc, /floqmediaPlanTrace/);
  const wiring = read("docs/FEATURE-WIRING.md");
  assert.match(wiring, /floqmediaPlanTrace/);
  assert.match(wiring, /spatial-plan-trace/);
});
