"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {createContext, runInContext} = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const vs = require("./botdee-version-smartview");
const bot = require("./bot-dee-core");

test("exact Ver/Vers/Version aliases match; version history does not", () => {
  ["ver", "Vers", "VERSION", " ver ", "Version?", "VERS??"].forEach(raw => {
    assert.equal(vs.isVersionSmartViewAlias(raw), true, raw);
    assert.equal(bot.isVersionPrompt(raw), true, raw);
  });
  assert.equal(vs.isVersionSmartViewAlias("version history"), false);
  assert.equal(bot.isVersionPrompt("version history"), false);
  assert.equal(vs.isVersionSmartViewAlias("versions"), false);
  assert.equal(vs.isVersionSmartViewAlias("what is your version?"), false);
  assert.equal(bot.isVersionPrompt("what is your version?"), true);
});

test("payload probes this request: Operational/Degraded/Unavailable, real Gemini id, no fake rendering numbers", () => {
  const now = Date.parse("2026-11-17T19:00:00.000Z");
  const operational = vs.buildVersionSmartView({
    role: "patron",
    now,
    sessionPath: "local-version",
    functionsReachable: true,
    geminiConfigured: true
  });
  assert.equal(operational.schemaVersion, "floqr.botDeeVersionSmartView/1");
  assert.equal(operational.kind, "botDeeVersion");
  assert.equal(operational.service.status, "operational");
  assert.equal(operational.service.lastCheckAtIso, "2026-11-17T19:00:00.000Z");
  assert.equal(operational.service.checks.functions, true);
  assert.equal(operational.service.checks.package, true);
  assert.equal(operational.service.checks.gemini, true);
  assert.equal(operational.model.usedThisTurn, false);
  assert.equal(operational.model.configuredId, "gemini-3.6-flash");
  assert.equal(operational.model.sessionModel, "gemini-3.6-flash");
  assert.equal(operational.model.sessionPath, "local-version");
  assert.ok(operational.botDee.packageLabel);
  assert.ok(operational.floqr.backendPackage);
  assert.equal(operational.privileged, undefined);
  const degraded = vs.buildVersionSmartView({
    role: "patron",
    now,
    functionsReachable: true,
    geminiConfigured: false
  });
  assert.equal(degraded.service.status, "degraded");
  assert.equal(vs.buildVersionSmartView({
    role: "patron",
    now,
    functionsReachable: false,
    geminiConfigured: false
  }).service.status, "degraded");
  assert.equal(vs.probeVersionService({
    now,
    functionsReachable: false,
    geminiConfigured: false,
    packageLabel: ""
  }).status, "unavailable");
  const blob = JSON.stringify(operational);
  assert.doesNotMatch(blob, /v2\.6\.0/);
  assert.doesNotMatch(blob, /v5\.4\.2/);
  assert.doesNotMatch(blob, /Gemini 2\.5 Pro/);
  assert.doesNotMatch(blob, /not_checked/);
  assert.ok(Array.isArray(operational.changelog));
  assert.ok(operational.changelog.length >= 1, "bundled package bullets");
  assert.match(operational.changelog[0].id, /^s3\./);
  assert.equal(degraded.model.configuredId, "gemini-3.6-flash");
});

test("What's New ships inside Functions (no repo-root README required)", () => {
  const bundled = vs.changelogFromBundle();
  assert.ok(bundled.length >= 1);
  assert.equal(bundled[0].id, `s${require("./package.json").version}`);
  const missingRoot = vs.buildVersionSmartView({
    role: "patron",
    rootDir: path.join(__dirname, "no-such-readme-dir")
  });
  assert.ok(missingRoot.changelog.length >= 1);
  assert.equal(missingRoot.changelog[0].id, bundled[0].id);
  const fromReadme = vs.changelogFromReadme(root);
  assert.equal(bundled[0].id, fromReadme[0].id);
  assert.doesNotMatch(read("functions/botdee-version-smartview.js"), /changelogFromReadme\(options\.rootDir\)/);
  assert.match(read("functions/botdee-version-smartview.js"), /changelogItems\(/);
});

test("Master Admin privileged block is server-gated; patrons cannot mint it client-side", () => {
  const master = vs.buildVersionSmartView({role: "master"});
  assert.equal(master.privileged.deployedClaim, false);
  assert.ok(Array.isArray(master.privileged.phases));
  assert.ok(master.privileged.capabilities.executeBotSession);
  const patron = vs.buildVersionSmartView({role: "patron", privileged: {hack: true}});
  assert.equal(patron.privileged, undefined);
});

test("localSession attaches Version SMARTview for aliases and longer version questions", () => {
  const fns = require("./bot-dee-functions");
  const dump = /Part\s+[1-6]|six-phase|implemented\/tested|not-deployed|mock-only|Google Places|Ticketmaster/;
  const alias = fns.__botDeeHelpers.localSession("patron", "Ver", {geminiConfigured: true});
  assert.equal(alias.provider, "local-version");
  assert.equal(alias.smartViews[0].kind, "botDeeVersion");
  assert.equal(alias.smartViews[0].service.status, "operational");
  assert.equal(alias.smartViews[0].model.configuredId, "gemini-3.6-flash");
  assert.equal(alias.reply, "");
  assert.doesNotMatch(String(alias.reply), dump);
  const noGemini = fns.__botDeeHelpers.localSession("patron", "Ver");
  assert.equal(noGemini.smartViews[0].service.status, "degraded");
  const longer = fns.__botDeeHelpers.localSession("patron", "what is your version?", {geminiConfigured: true});
  assert.equal(longer.provider, "local-version");
  assert.equal(longer.smartViews[0].kind, "botDeeVersion");
  assert.match(longer.reply, /package/i);
  assert.doesNotMatch(longer.reply, dump);
  const history = fns.__botDeeHelpers.localSession("patron", "version history");
  assert.notEqual(history.provider, "local-version");
  assert.ok(!history.smartViews || !history.smartViews.length);
  const master = fns.__botDeeHelpers.localSession("master", "version", {geminiConfigured: true});
  assert.ok(master.smartViews[0].privileged);
  assert.equal(master.reply, "");
  assert.doesNotMatch(String(master.reply), dump);
  assert.doesNotMatch(read("functions/bot-dee-core.js"), /describeForRole/);
  assert.match(read("bot-dee-chat.js"), /if \(isVersionSmartViewAlias\(text\)\) return ""/);
  assert.match(read("functions/bot-dee-thread.js"), /allowEmpty:\s*options\.allowEmpty/);
  assert.match(read("functions/bot-dee-functions.js"), /allowEmpty:\s*versionCardOnly/);
  assert.match(read("bot-dee-chat.js"), /role === "model" && !rawText && !media\.length/);
  assert.equal(bot.sanitizeBotReply("", {allowEmpty: true}), "");
  assert.equal(bot.sanitizeBotReply(""), bot.SEARCH_MISS_FALLBACK);
});

test("client renderer + CSS inherit Site Chrome; live probe labels; People contract untouched", () => {
  const js = read("botdee-smartview.js");
  const css = read("botdee-smartview.css");
  const chat = read("bot-dee-chat.js");
  assert.match(js, /function renderVersionCard\(/);
  assert.match(js, /function bindVersionCard\(/);
  assert.match(js, /botDeeVersion/);
  assert.match(js, /localVersionPayload/);
  assert.match(js, /statusOperational/);
  assert.match(js, /statusDegraded/);
  assert.doesNotMatch(js, /Not used this turn/);
  assert.doesNotMatch(css, /Operational/);
  assert.match(css, /\.botdee-sv-version/);
  assert.match(css, /data-status="operational"/);
  assert.match(css, /var\(--accent/);
  assert.doesNotMatch(css, /#00e3db/);
  assert.doesNotMatch(css, /#00ba75/);
  assert.match(chat, /isVersionSmartViewAlias|ensureVersionSmartViews/);
  assert.match(js, /usercharacter_analysis/);
  assert.match(js, /function renderCompactPeopleCard\(/);
  assert.match(js, /function renderRoomCard\(/);
  assert.doesNotMatch(read("functions/botdee-version-smartview.js"), /usercharacter_analysis/);
  assert.match(read("functions/botdee-smartview-v2-core.js"), /function publicPageMedia\(/);
  assert.match(read("functions/botdee-room-smartview.js"), /function classifyRoomIntent\(/);
});

test("client mount paints Version SMARTview tabs without inventing health", () => {
  const ctx = createContext({
    window: null,
    document: {
      addEventListener() {},
      querySelectorAll: () => []
    },
    addEventListener() {},
    FLOQRI18n: {t: key => key},
    FLOQRNav: {appVersion: "s3.3.034"},
    location: {href: "https://example.test/botdee.html", origin: "https://example.test"},
    URL
  });
  ctx.window = ctx;
  ctx.global = ctx;
  runInContext(read("botdee-smartview.js"), ctx, {filename: "botdee-smartview.js"});
  const api = ctx.FLOQRBotDeeSmartView;
  const html = api.renderCard({
    kind: "botDeeVersion",
    botDee: {packageLabel: "s3.3.034"},
    floqr: {backendPackage: "s3.3.034", frontendPackage: "s3.3.034"},
    model: {configuredId: "gemini-3.6-flash", usedThisTurn: false, sessionPath: "local-version"},
    service: {status: "operational", lastCheckAtIso: "2026-11-17T19:00:00.000Z"},
    changelog: [{id: "s3.3.034", text: "s3.3.034: Version SMARTview"}]
  });
  assert.match(html, /botdee-sv-version/);
  assert.match(html, /data-vs-tab="overview"/);
  assert.match(html, /data-vs-tab="updates"/);
  assert.match(html, /data-vs-tab="help"/);
  assert.match(html, /data-status="operational"/);
  assert.match(html, /botdee\.vs\.statusOperational|Operational/);
  assert.match(html, /gemini-3\.6-flash/);
  assert.doesNotMatch(html, /Not checked|notChecked|Not used this turn|notUsedThisTurn/);
  const localHtml = api.renderCard(api.localVersionPayload());
  assert.match(localHtml, /s3\.3\.034/);
  assert.match(localHtml, /gemini-3\.6-flash/);
  assert.doesNotMatch(localHtml, /Not used this turn|notUsedThisTurn|Not checked/);
  assert.doesNotMatch(localHtml, /\/ Unavailable|\/ botdee\.vs\.unavailable/);
});

test("display URLs stay without ?v= and chrome keys are vs not sv/sc", () => {
  const i18n = read("floqr-i18n.js");
  assert.match(i18n, /"botdee\.vs\.title"/);
  assert.match(i18n, /Version SMARTview/);
  assert.doesNotMatch(read("botdee-smartview.js"), /display\.html\?[^"']*v=/);
  assert.doesNotMatch(read("functions/botdee-version-smartview.js"), /[?&]v=/);
});
