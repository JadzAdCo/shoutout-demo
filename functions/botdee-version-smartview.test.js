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

test("payload is honest: not Operational, no fake rendering numbers, no privileged for patrons", () => {
  const payload = vs.buildVersionSmartView({
    role: "patron",
    now: Date.parse("2026-11-17T19:00:00.000Z"),
    sessionPath: "local-version"
  });
  assert.equal(payload.schemaVersion, "floqr.botDeeVersionSmartView/1");
  assert.equal(payload.kind, "botDeeVersion");
  assert.equal(payload.service.status, "not_checked");
  assert.equal(payload.service.lastCheckAtIso, null);
  assert.equal(payload.model.usedThisTurn, false);
  assert.equal(payload.model.sessionModel, null);
  assert.equal(payload.model.sessionPath, "local-version");
  assert.ok(payload.botDee.packageLabel);
  assert.ok(payload.floqr.backendPackage);
  assert.equal(payload.privileged, undefined);
  const blob = JSON.stringify(payload);
  assert.doesNotMatch(blob, /Operational/);
  assert.doesNotMatch(blob, /v2\.6\.0/);
  assert.doesNotMatch(blob, /v5\.4\.2/);
  assert.doesNotMatch(blob, /Gemini 2\.5 Pro/);
  assert.ok(Array.isArray(payload.changelog));
  assert.ok(payload.changelog.length >= 1, "bundled package bullets");
  assert.match(payload.changelog[0].id, /^s3\./);
});

test("What's New ships inside Functions (no repo-root README required)", () => {
  const bundled = vs.changelogFromBundle();
  assert.ok(bundled.length >= 1);
  assert.equal(bundled[0].id, "s3.3.033");
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
  const alias = fns.__botDeeHelpers.localSession("patron", "Ver");
  assert.equal(alias.provider, "local-version");
  assert.equal(alias.smartViews[0].kind, "botDeeVersion");
  assert.equal(alias.smartViews[0].service.status, "not_checked");
  const longer = fns.__botDeeHelpers.localSession("patron", "what is your version?");
  assert.equal(longer.provider, "local-version");
  assert.equal(longer.smartViews[0].kind, "botDeeVersion");
  const history = fns.__botDeeHelpers.localSession("patron", "version history");
  assert.notEqual(history.provider, "local-version");
  assert.ok(!history.smartViews || !history.smartViews.length);
  const master = fns.__botDeeHelpers.localSession("master", "version");
  assert.ok(master.smartViews[0].privileged);
});

test("client renderer + CSS inherit Site Chrome; no Operational; People contract untouched", () => {
  const js = read("botdee-smartview.js");
  const css = read("botdee-smartview.css");
  const chat = read("bot-dee-chat.js");
  assert.match(js, /function renderVersionCard\(/);
  assert.match(js, /function bindVersionCard\(/);
  assert.match(js, /botDeeVersion/);
  assert.match(js, /localVersionPayload/);
  assert.doesNotMatch(js, /Operational/);
  assert.doesNotMatch(css, /Operational/);
  assert.match(css, /\.botdee-sv-version/);
  assert.match(css, /var\(--accent/);
  assert.doesNotMatch(css, /#00e3db/);
  assert.doesNotMatch(css, /#00ba75/);
  assert.match(chat, /isVersionSmartViewAlias|ensureVersionSmartViews/);
  assert.match(js, /usercharacter_analysis/);
  assert.match(js, /function renderCompactPeopleCard\(/);
  assert.doesNotMatch(read("functions/botdee-version-smartview.js"), /usercharacter_analysis/);
  assert.match(read("functions/botdee-smartview-v2-core.js"), /function publicPageMedia\(/);
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
    FLOQRNav: {appVersion: "s3.3.032"},
    location: {href: "https://example.test/botdee.html", origin: "https://example.test"},
    URL
  });
  ctx.window = ctx;
  ctx.global = ctx;
  runInContext(read("botdee-smartview.js"), ctx, {filename: "botdee-smartview.js"});
  const api = ctx.FLOQRBotDeeSmartView;
  const html = api.renderCard({
    kind: "botDeeVersion",
    botDee: {packageLabel: "s3.3.032"},
    floqr: {backendPackage: "s3.3.032", frontendPackage: "s3.3.032"},
    model: {configuredId: "gemini-3.6-flash", usedThisTurn: false, sessionPath: "local-version"},
    service: {status: "not_checked", lastCheckAtIso: null},
    changelog: [{id: "s3.3.032", text: "s3.3.032: Version SMARTview"}]
  });
  assert.match(html, /botdee-sv-version/);
  assert.match(html, /data-vs-tab="overview"/);
  assert.match(html, /data-vs-tab="updates"/);
  assert.match(html, /data-vs-tab="help"/);
  assert.doesNotMatch(html, /Operational/);
  assert.match(html, /botdee\.vs\.notChecked|Not checked/);
  const localHtml = api.renderCard(api.localVersionPayload());
  assert.match(localHtml, /s3\.3\.032/);
  assert.doesNotMatch(localHtml, /\/ Unavailable|\/ botdee\.vs\.unavailable/);
});

test("display URLs stay without ?v= and chrome keys are vs not sv/sc", () => {
  const i18n = read("floqr-i18n.js");
  assert.match(i18n, /"botdee\.vs\.title"/);
  assert.match(i18n, /Version SMARTview/);
  assert.doesNotMatch(read("botdee-smartview.js"), /display\.html\?[^"']*v=/);
  assert.doesNotMatch(read("functions/botdee-version-smartview.js"), /[?&]v=/);
});
