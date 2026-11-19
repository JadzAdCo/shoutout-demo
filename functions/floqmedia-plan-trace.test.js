"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

delete process.env.FLOQR_APP_CHECK_ENFORCE;
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

const STUDIO_APP_ID = "1:858205816285:web:e586eb1c2d7c4567cfa234";

function mockReq({origin = "https://studio.floqmedia.com", method = "POST", body, appCheck = ""} = {}) {
  return {
    method,
    body,
    get(name) {
      const key = String(name).toLowerCase();
      if (key === "origin") return origin;
      if (key === "x-firebase-appcheck") return appCheck;
      return "";
    }
  };
}

function acceptingVerifier() {
  const seen = new Set();
  return async (token, options) => {
    if (!options || options.consume !== true) {
      throw new Error("consume required");
    }
    if (seen.has(token)) return {alreadyConsumed: true, appId: STUDIO_APP_ID};
    seen.add(token);
    return {alreadyConsumed: false, appId: STUDIO_APP_ID};
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
    appCheck: "fresh-pass",
    body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}
  });
  const res = mockRes();
  const result = await core.handlePlanTraceRequest(req, res, {
    generateContent: fakeGemini(KNOWN_TRACE, {capture}),
    logAccess: async (entry) => logs.push(entry),
    verifyAppCheck: acceptingVerifier(),
    model: "gemini-3.6-flash"
  });
  assert.equal(result.ok, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.trace, KNOWN_TRACE);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://studio.floqmedia.com");
  assert.equal(res.headers["Access-Control-Allow-Headers"], core.ALLOW_HEADERS);
  assert.match(res.headers["Access-Control-Allow-Headers"], /X-Firebase-AppCheck/);
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
    mockReq({appCheck: "fresh-pass", body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    res,
    {
      generateContent: async () => ({
        text: "",
        candidates: [{content: {parts: []}}],
        usageMetadata: {totalTokenCount: 0}
      }),
      verifyAppCheck: acceptingVerifier(),
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
    mockReq({appCheck: "fresh-pass", body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    res,
    {
      generateContent: fakeGemini(KNOWN_TRACE, {fail: true}),
      verifyAppCheck: acceptingVerifier(),
      logAccess: async (entry) => logs.push(entry)
    }
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
    mockReq({appCheck: "fresh-pass", body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    mockRes(),
    {
      generateContent: fakeGemini(KNOWN_TRACE),
      verifyAppCheck: acceptingVerifier(),
      logAccess: async (entry) => logs.push(entry)
    }
  );
  assert.equal(logs.length, 1);
  assert.equal(JSON.stringify(logs).includes("fresh-pass"), false);

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
  assert.match(coreSrc, /getAppCheck\(\)\.verifyToken\(token,\s*options\)/);
  assert.match(coreSrc, /\{consume:\s*true\}/);
  assert.match(coreSrc, /X-Firebase-AppCheck/);
  assert.doesNotMatch(coreSrc, /FLOQR_APP_CHECK_ENFORCE\s*=/);
  assert.doesNotMatch(fnSrc, /environmentVariables/);
  assert.doesNotMatch(fnSrc, /FLOQR_APP_CHECK_ENFORCE\s*=/);
});

test("preflight stays 204 and allows X-Firebase-AppCheck for the three studio origins", async () => {
  const origins = [
    "https://studio.floqmedia.com",
    "https://www.floqmedia.com",
    "https://floqmedia.com"
  ];
  for (const origin of origins) {
    const res = mockRes();
    const called = {n: 0};
    const result = await core.handlePlanTraceRequest(
      mockReq({origin, method: "OPTIONS"}),
      res,
      {generateContent: async () => { called.n += 1; return {}; }}
    );
    assert.equal(result.status, 204);
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers["Access-Control-Allow-Origin"], origin);
    assert.equal(res.headers["Access-Control-Allow-Headers"], "Content-Type, Authorization, X-Firebase-AppCheck");
    assert.equal(called.n, 0);
  }
});

test("monitor mode still returns a trace when the App Check pass is missing", async () => {
  const logs = [];
  const called = {n: 0};
  const res = mockRes();
  const result = await core.handlePlanTraceRequest(
    mockReq({body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    res,
    {
      env: {},
      generateContent: async () => {
        called.n += 1;
        return {
          text: JSON.stringify(KNOWN_TRACE),
          usageMetadata: {promptTokenCount: 1, candidatesTokenCount: 1, totalTokens: 2}
        };
      },
      logAccess: async (entry) => logs.push(entry)
    }
  );
  assert.equal(result.ok, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.trace, KNOWN_TRACE);
  assert.equal(called.n, 1);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].ok, true);
  assert.equal(logs.some((entry) => String(entry.failureReason || "").startsWith("app_check_")), false);
  assert.equal(JSON.stringify(logs).includes(PNG_1X1), false);

  const invalidLogs = [];
  const invalidApp = [];
  const invalidCalls = {n: 0};
  const invalid = await core.handlePlanTraceRequest(
    mockReq({appCheck: "not-a-pass", body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    mockRes(),
    {
      env: {FLOQR_APP_CHECK_ENFORCE: "0"},
      verifyAppCheck: async () => { throw new Error("bad token"); },
      generateContent: async () => {
        invalidCalls.n += 1;
        return {text: JSON.stringify(KNOWN_TRACE), usageMetadata: {totalTokenCount: 1}};
      },
      logAccess: async (entry) => invalidLogs.push(entry),
      logAppCheck: async (entry) => invalidApp.push(entry)
    }
  );
  assert.equal(invalid.ok, true);
  assert.equal(invalidCalls.n, 1);
  assert.equal(invalidLogs.some((entry) => String(entry.failureReason || "").startsWith("app_check_")), false);
  assert.equal(invalidApp[0].outcome, "app_check_invalid");
  assert.equal(invalidApp[0].operation, "spatial-plan-trace");
  assert.equal(invalidApp[0].enforce, false);
});

test("enforce mode returns 401 and does not call Gemini", async () => {
  const logs = [];
  const appChecks = [];
  const called = {n: 0};
  const secret = "limited-use-pass-should-not-be-logged";
  const res = mockRes();
  const result = await core.handlePlanTraceRequest(
    mockReq({
      appCheck: secret,
      body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}
    }),
    res,
    {
      env: {FLOQR_APP_CHECK_ENFORCE: "1"},
      verifyAppCheck: async () => {
        throw new Error(`invalid pass ${secret}`);
      },
      generateContent: async () => { called.n += 1; return {}; },
      logAccess: async (entry) => logs.push(entry),
      logAppCheck: async (entry) => appChecks.push(entry)
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {ok: false, error: core.APP_CHECK_REJECTED});
  assert.equal(called.n, 0);
  assert.equal(logs.length, 0);
  assert.equal(appChecks[0].operation, "spatial-plan-trace");
  assert.equal(appChecks[0].outcome, "app_check_invalid");
  assert.equal(appChecks[0].enforce, true);
  assert.equal(JSON.stringify(appChecks).includes(secret), false);
  assert.equal(JSON.stringify(logs).includes(PNG_1X1), false);
  assert.equal(res.headers["Access-Control-Allow-Headers"], core.ALLOW_HEADERS);

  const missingCalls = {n: 0};
  const missingLogs = [];
  const missingApp = [];
  const missing = await core.handlePlanTraceRequest(
    mockReq({body: {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}}),
    mockRes(),
    {
      env: {FLOQR_APP_CHECK_ENFORCE: "1"},
      generateContent: async () => { missingCalls.n += 1; return {}; },
      logAccess: async (entry) => missingLogs.push(entry),
      logAppCheck: async (entry) => missingApp.push(entry)
    }
  );
  assert.equal(missing.status, 401);
  assert.equal(missingCalls.n, 0);
  assert.equal(missingLogs.length, 0);
  assert.equal(missingApp[0].outcome, "app_check_missing");
  assert.equal(missingApp[0].operation, "spatial-plan-trace");
  assert.equal(missingApp[0].enforce, true);
});

test("a second consume of the same App Check pass is app_check_reused", async () => {
  const seen = new Set();
  const optionsSeen = [];
  const pass = "limited-use-pass-once";
  const verifyAppCheck = async (token, options) => {
    optionsSeen.push(options);
    if (seen.has(token)) return {alreadyConsumed: true, appId: STUDIO_APP_ID};
    seen.add(token);
    return {alreadyConsumed: false, appId: STUDIO_APP_ID};
  };
  const body = {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1};
  const calls = {n: 0};
  const generateContent = async () => {
    calls.n += 1;
    return {
      text: JSON.stringify(KNOWN_TRACE),
      usageMetadata: {totalTokenCount: 4}
    };
  };

  const firstLogs = [];
  const firstApp = [];
  const first = await core.handlePlanTraceRequest(
    mockReq({appCheck: pass, body}),
    mockRes(),
    {
      env: {},
      verifyAppCheck,
      generateContent,
      logAccess: async (entry) => firstLogs.push(entry),
      logAppCheck: async (entry) => firstApp.push(entry)
    }
  );
  assert.equal(first.ok, true);
  assert.equal(firstLogs.some((entry) => String(entry.failureReason || "").startsWith("app_check_")), false);
  assert.equal(firstApp[0].outcome, "verified");

  const secondLogs = [];
  const secondApp = [];
  const secondRes = mockRes();
  const second = await core.handlePlanTraceRequest(
    mockReq({appCheck: pass, body}),
    secondRes,
    {
      env: {},
      verifyAppCheck,
      generateContent,
      logAccess: async (entry) => secondLogs.push(entry),
      logAppCheck: async (entry) => secondApp.push(entry)
    }
  );
  assert.equal(second.ok, true);
  assert.equal(secondRes.statusCode, 200);
  assert.equal(secondRes.body.ok, true);
  assert.equal(secondLogs.some((entry) => String(entry.failureReason || "").startsWith("app_check_")), false);
  assert.equal(secondApp[0].operation, "spatial-plan-trace");
  assert.equal(secondApp[0].outcome, "app_check_reused");
  assert.equal(calls.n, 2);
  assert.deepEqual(optionsSeen, [{consume: true}, {consume: true}]);
  assert.equal(JSON.stringify(firstLogs).includes(pass), false);
  assert.equal(JSON.stringify(secondApp).includes(pass), false);
  assert.equal(JSON.stringify(secondLogs).includes(PNG_1X1), false);

  const enforcedLogs = [];
  const enforcedApp = [];
  const enforcedCalls = {n: 0};
  const enforced = await core.handlePlanTraceRequest(
    mockReq({appCheck: pass, body}),
    mockRes(),
    {
      env: {FLOQR_APP_CHECK_ENFORCE: "1"},
      verifyAppCheck,
      generateContent: async () => { enforcedCalls.n += 1; return {}; },
      logAccess: async (entry) => enforcedLogs.push(entry),
      logAppCheck: async (entry) => enforcedApp.push(entry)
    }
  );
  assert.equal(enforced.status, 401);
  assert.equal(enforcedCalls.n, 0);
  assert.equal(enforcedLogs.length, 0);
  assert.equal(enforcedApp[0].outcome, "app_check_reused");
  assert.equal(JSON.stringify(enforcedApp).includes(pass), false);
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
