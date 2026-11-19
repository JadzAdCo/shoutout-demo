"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("path");

delete process.env.FLOQR_APP_CHECK_ENFORCE;

const core = require("./floqmedia-plan-trace-core");
const appCheckLog = require("./app-check-log");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const APP_ID = "1:858205816285:web:e586eb1c2d7c4567cfa234";
const TOKEN = "do-not-store-this-app-check-token";
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>';

const KNOWN_TRACE = {
  spaceName: "Lobby",
  widthM: 6,
  depthM: 4,
  scale: "inferred",
  objects: [{kind: "furniture", name: "Desk", x: 1, z: 1, widthM: 1.2, depthM: 0.6}],
  warnings: []
};

function fakeDb() {
  const store = new Map();
  function collection(name) {
    if (!store.has(name)) store.set(name, []);
    const rows = store.get(name);
    const filters = [];
    const api = {
      where(field, op, value) {
        filters.push({field, op, value});
        return api;
      },
      orderBy() { return api; },
      limit() { return api; },
      async get() {
        const docs = rows.filter((row) => filters.every((filter) => {
          if (filter.op === "==") return row[filter.field] === filter.value;
          return true;
        })).map((row) => ({id: row.id, data: () => row}));
        return {empty: docs.length === 0, docs, size: docs.length};
      },
      async add(data) {
        const id = `${name}-${rows.length + 1}`;
        rows.push({id, ...data});
        return {id};
      }
    };
    return api;
  }
  return {
    collection,
    rows(name) { return store.get(name) || []; }
  };
}

function mockReq({appCheck = "", body, enforceHeader} = {}) {
  return {
    method: "POST",
    body,
    get(name) {
      const key = String(name || "").toLowerCase();
      if (key === "origin") return "https://studio.floqmedia.com";
      if (key === "x-firebase-appcheck") return enforceHeader ? appCheck : appCheck;
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

function verifier(mode) {
  const calls = [];
  const fn = async (token) => {
    calls.push(token);
    if (mode === "invalid") {
      const error = new Error(`bad ${token}`);
      error.code = "app-check/invalid-argument";
      throw error;
    }
    if (mode === "reused") {
      return {appId: APP_ID, alreadyConsumed: true, token: {app_id: APP_ID, raw: token}};
    }
    if (mode === "wrong-app") return {appId: "1:other:web:nope", alreadyConsumed: false};
    return {appId: APP_ID, alreadyConsumed: false, token: {app_id: APP_ID, raw: token}};
  };
  fn.calls = calls;
  return fn;
}

function geminiDouble() {
  const calls = [];
  const fn = async () => {
    calls.push(1);
    return {
      text: JSON.stringify(KNOWN_TRACE),
      usageMetadata: {promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 18}
    };
  };
  fn.calls = calls;
  return fn;
}

function harness(db) {
  const geminiLogs = [];
  return {
    db,
    geminiLogs,
    deps(verify, {enforce = false} = {}) {
      return {
        enforce,
        verifyAppCheck: verify,
        generateContent: geminiDouble(),
        logAccess: async (entry) => geminiLogs.push(entry),
        logAppCheck: (entry) => appCheckLog.logAppCheckResult(db, entry, {
          resolveRecipients: async () => ["master-1"]
        }),
        model: "gemini-3.6-flash"
      };
    }
  };
}

function rowsOf(db, category) {
  return db.rows("appLogs").filter((row) => row.category === category);
}

function dump(db) {
  return JSON.stringify({
    appLogs: db.rows("appLogs"),
    inbox: db.rows("inboxNotifications"),
    display: db.rows("displayAccessLogs")
  });
}

async function post(deps, {appCheck = "", body} = {}) {
  const req = mockReq({
    appCheck,
    body: body || {fileName: "lobby.png", mime: "image/png", dataBase64: PNG_1X1}
  });
  const res = mockRes();
  const result = await core.handlePlanTraceRequest(req, res, deps);
  return {req, res, result};
}

test("monitor mode missing pass logs a warning and still returns a trace", async () => {
  const db = fakeDb();
  const box = harness(db);
  const verify = verifier("verified");
  const deps = box.deps(verify);
  const {res, result} = await post(deps);
  assert.equal(result.ok, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.trace.spaceName, "Lobby");
  assert.equal(deps.generateContent.calls.length, 1);
  assert.equal(verify.calls.length, 0);
  const diagnostic = rowsOf(db, "app-check");
  assert.equal(diagnostic.length, 1);
  assert.equal(diagnostic[0].action, "spatial-plan-trace");
  assert.equal(diagnostic[0].level, "warn");
  assert.equal(diagnostic[0].severity, "warn");
  assert.equal(diagnostic[0].critical, false);
  assert.equal(diagnostic[0].details.outcome, "app_check_missing");
  assert.equal(diagnostic[0].details.enforce, "off");
  assert.equal(diagnostic[0].details.totalTokens, 18);
  assert.equal(diagnostic[0].category, "app-check");
  assert.equal(rowsOf(db, "security").length, 0);
  assert.equal(rowsOf(db, "gemini").length, 0);
  assert.equal(db.rows("inboxNotifications").length, 0);
  assert.equal(db.rows("displayAccessLogs").length, 0);
});

test("monitor mode invalid pass writes both categories and still traces", async () => {
  const db = fakeDb();
  const box = harness(db);
  const verify = verifier("invalid");
  const deps = box.deps(verify);
  const {res, result} = await post(deps, {appCheck: TOKEN});
  assert.equal(result.ok, true);
  assert.equal(res.body.ok, true);
  assert.equal(deps.generateContent.calls.length, 1);
  assert.deepEqual(verify.calls, [TOKEN]);
  const diagnostic = rowsOf(db, "app-check");
  const security = rowsOf(db, "security");
  assert.equal(diagnostic.length, 1);
  assert.equal(diagnostic[0].action, "spatial-plan-trace");
  assert.equal(diagnostic[0].level, "error");
  assert.equal(diagnostic[0].severity, "error");
  assert.equal(diagnostic[0].critical, false);
  assert.equal(diagnostic[0].details.outcome, "app_check_invalid");
  assert.equal(diagnostic[0].details.failureReason, "invalid-argument");
  assert.equal(security.length, 1);
  assert.equal(security[0].category, "security");
  assert.equal(security[0].action, "app-check");
  assert.equal(security[0].level, "error");
  assert.equal(security[0].critical, false);
  assert.equal(db.rows("inboxNotifications").length, 0);
  assert.equal(rowsOf(db, "gemini").length, 0);
  const saved = dump(db);
  assert.equal(saved.includes(TOKEN), false);
  assert.equal(saved.includes(PNG_1X1), false);
  assert.equal(saved.includes("<svg"), false);
});

test("monitor mode reused pass is a security row and the trace still returns", async () => {
  const db = fakeDb();
  const box = harness(db);
  const deps = box.deps(verifier("reused"));
  const {result} = await post(deps, {appCheck: TOKEN});
  assert.equal(result.ok, true);
  assert.equal(deps.generateContent.calls.length, 1);
  assert.equal(rowsOf(db, "security")[0].details.outcome, "app_check_reused");
  assert.equal(rowsOf(db, "app-check")[0].details.outcome, "app_check_reused");
  assert.equal(db.rows("inboxNotifications").length, 0);
});

test("enforced rejection does not call Gemini and sends one security message", async () => {
  const db = fakeDb();
  const box = harness(db);
  const deps = box.deps(verifier("invalid"), {enforce: true});
  const {res, result} = await post(deps, {appCheck: TOKEN, body: {fileName: "room.svg", mime: "image/svg+xml", dataBase64: Buffer.from(SVG_TEXT).toString("base64")}});
  assert.equal(result.ok, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.trace, undefined);
  assert.equal(deps.generateContent.calls.length, 0);
  assert.equal(box.geminiLogs.length, 0);
  const diagnostic = rowsOf(db, "app-check")[0];
  const security = rowsOf(db, "security")[0];
  assert.equal(diagnostic.category, "app-check");
  assert.equal(diagnostic.action, "spatial-plan-trace");
  assert.equal(diagnostic.critical, false);
  assert.equal(diagnostic.details.totalTokens, undefined);
  assert.equal(diagnostic.details.enforce, "on");
  assert.equal(security.category, "security");
  assert.equal(security.action, "app-check");
  assert.equal(security.level, "error");
  const inbox = db.rows("inboxNotifications");
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].messageCategory, "security");
  assert.equal(inbox[0].type, "appCheckRejected");
  assert.equal(inbox[0].recipientUid, "master-1");
  const saved = dump(db);
  assert.equal(saved.includes(TOKEN), false);
  assert.equal(saved.includes(SVG_TEXT), false);
  assert.equal(saved.includes("dataBase64"), false);
  assert.equal(db.rows("displayAccessLogs").length, 0);
  assert.equal(rowsOf(db, "gemini").length, 0);
});

test("enforced missing pass does not call Gemini; monitor missing does not message", async () => {
  const enforced = fakeDb();
  const enforcedBox = harness(enforced);
  const enforcedDeps = enforcedBox.deps(verifier("verified"), {enforce: true});
  const denied = await post(enforcedDeps);
  assert.equal(denied.result.status, 401);
  assert.equal(enforcedDeps.generateContent.calls.length, 0);
  assert.equal(enforced.rows("inboxNotifications").length, 1);
  assert.equal(rowsOf(enforced, "app-check")[0].details.outcome, "app_check_missing");
  assert.equal(rowsOf(enforced, "security")[0].action, "app-check");

  const monitor = fakeDb();
  const monitorBox = harness(monitor);
  const monitorDeps = monitorBox.deps(verifier("verified"), {enforce: false});
  const allowed = await post(monitorDeps);
  assert.equal(allowed.result.ok, true);
  assert.equal(monitorDeps.generateContent.calls.length, 1);
  assert.equal(monitor.rows("inboxNotifications").length, 0);
  assert.equal(rowsOf(monitor, "security").length, 0);
  assert.equal(rowsOf(monitor, "app-check")[0].level, "warn");
  assert.equal(rowsOf(monitor, "app-check")[0].severity, "warn");
});

test("verified pass is an info diagnostic row with token counts and no security row", async () => {
  const db = fakeDb();
  const box = harness(db);
  const deps = box.deps(verifier("verified"));
  const {result} = await post(deps, {appCheck: TOKEN});
  assert.equal(result.ok, true);
  const diagnostic = rowsOf(db, "app-check")[0];
  assert.equal(diagnostic.level, "info");
  assert.equal(diagnostic.severity, "info");
  assert.equal(diagnostic.critical, false);
  assert.equal(diagnostic.details.outcome, "verified");
  assert.equal(diagnostic.details.appId, APP_ID);
  assert.equal(diagnostic.details.operation, "spatial-plan-trace");
  assert.equal(diagnostic.details.promptTokens, 11);
  assert.equal(diagnostic.details.totalTokens, 18);
  assert.equal(rowsOf(db, "security").length, 0);
  assert.equal(dump(db).includes(TOKEN), false);
});

test("helper and Master Admin surfaces use the two categories and leave enforcement off", () => {
  const helper = read("functions/app-check-log.js");
  const plan = read("functions/floqmedia-plan-trace-core.js");
  const fn = read("functions/floqmedia-plan-trace-functions.js");
  const html = read("master-admin.html");
  const security = html.slice(html.indexOf('id="securityLogs"'), html.indexOf('id="securitySystemMessages"'));
  assert.equal(core.SPATIAL_STUDIO_APP_ID, APP_ID);
  assert.equal((plan.match(/function defaultVerifyAppCheck/g) || []).length, 1);
  assert.equal((plan.match(/verifyToken\s*\(/g) || []).length, 1);
  assert.match(plan, /getAppCheck\(\)\.verifyToken\(token,\s*options\)/);
  assert.match(plan, /verify\(token,\s*\{consume:\s*true\}\)/);
  assert.doesNotMatch(plan, /function verifyAppCheckPass/);
  assert.doesNotMatch(plan, /safeLog\(deps\.logAccess,\s*\{[^}]*appCheck/);
  assert.equal((fn.match(/verifyToken\s*\(/g) || []).length, 0);
  assert.match(fn, /logAppCheckResult/);
  assert.doesNotMatch(fn, /enforceAppCheck:\s*true/);
  assert.doesNotMatch(fn, /FLOQR_APP_CHECK_ENFORCE\s*=/);
  assert.doesNotMatch(plan, /FLOQR_APP_CHECK_ENFORCE\s*=\s*["']1["']/);
  assert.match(helper, /category: DIAGNOSTIC_CATEGORY/);
  assert.match(helper, /category: SECURITY_CATEGORY/);
  assert.equal(appCheckLog.DIAGNOSTIC_CATEGORY, "app-check");
  assert.equal(appCheckLog.SECURITY_CATEGORY, "security");
  assert.equal(appCheckLog.SECURITY_ACTION, "app-check");
  assert.doesNotMatch(helper, /displayAccessLogs/);
  assert.doesNotMatch(helper, /category:\s*"gemini"/);
  assert.doesNotMatch(helper, /severity:\s*"critical"/);
  assert.doesNotMatch(helper, /critical:\s*true/);
  assert.match(helper, /messageCategory: "security"/);
  assert.match(helper, /type: "appCheckRejected"/);
  const displayAt = security.indexOf("displayAccessLogReport");
  const appCheckAt = security.indexOf("<h3>App Check</h3>");
  assert.ok(displayAt > 0 && appCheckAt > displayAt);
  assert.match(html, /category <code>app-check<\/code>/);
  assert.match(read("master-display-security.js"), /loadAppCheckSecurityLogs/);
  assert.match(read("master-logging-extension.js"), /row\.category !== "app-check"/);
  assert.match(read(".github/workflows/functions-ci.yml"), /floqmediaPlanTrace/);
});
