"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const dc = require("./data-classification-core");
const ctxCore = require("./bot-dee-user-context-core");
const bot = require("./bot-dee-core");

const ROOT = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

const ALICE = {
  username: "alice_dc",
  floqrHandle: "@alice",
  displayName: "Alice B",
  firstName: "Alice",
  lastName: "Bryant",
  fullName: "Alice Bryant",
  height: "5'10\"",
  heightUnit: "ft",
  city: "Washington",
  country: "US",
  preferredLanguage: "en",
  uiLanguage: "en",
  musicInterests: ["Hip Hop", "Afrobeats"],
  email: "alice@example.com",
  phone: "+1 202 555 0100",
  birthMonth: "7",
  birthDay: "14",
  gender: "female",
  taxiPickupAddress: "1600 Pennsylvania Ave NW",
  stripeConnectAccountId: "acct_123",
  instagramHandle: "@alice.ig",
  secretNotes: "do not share",
  sos2faSessionId: "abc"
};

const RESTRICTED = ["email", "phone", "birthMonth", "birthDay", "gender", "taxiPickupAddress", "lastName", "fullName", "stripeConnectAccountId"];

function fakeDeps({users = {}, saved = null, throttleOk = true, role = "patron"} = {}) {
  const calls = {reads: [], audits: [], logs: [], policyReads: 0, throttle: []};
  return {
    calls,
    deps: {
      assertFeature: async () => {},
      throttle: async (uid, nowMs) => { calls.throttle.push(uid); return throttleOk; },
      resolveRole: async () => role,
      readOwnUser: async uid => { calls.reads.push(uid); return users[uid] || null; },
      readPolicy: async () => { calls.policyReads += 1; return saved; },
      writeAudit: async row => { calls.audits.push(row); },
      log: row => { calls.logs.push(row); }
    }
  };
}

const withConsent = doc => ({...doc, botDeeProfileConsent: true});

test("reads only the caller's own users doc and ignores any uid in the request", async () => {
  const {deps, calls} = fakeDeps({users: {alice: withConsent(ALICE), bob: withConsent({username: "bob"})}});
  const out = await ctxCore.handleGetUserContext({auth: {uid: "alice"}, data: {uid: "bob", userId: "bob", fields: ["email"]}}, deps);
  assert.deepEqual(calls.reads, ["alice"]);
  assert.equal(out.fields.username, "alice_dc");
  assert.ok(!JSON.stringify(out).includes("bob"));
});

test("anonymous callers are refused before any read", async () => {
  const {deps, calls} = fakeDeps({users: {alice: ALICE}});
  await assert.rejects(ctxCore.handleGetUserContext({auth: null, data: {uid: "alice"}}, deps), error => error.code === "unauthenticated");
  assert.equal(calls.reads.length, 0);
  assert.equal(calls.audits.length, 0);
});

test("consent off returns only non-PII (language) plus audience", async () => {
  const {deps} = fakeDeps({users: {alice: {...ALICE, botDeeProfileConsent: false}}, role: "regular"});
  const out = await ctxCore.handleGetUserContext({auth: {uid: "alice"}}, deps);
  assert.equal(out.consent, false);
  assert.equal(out.audience, "regular");
  assert.deepEqual(out.fieldNames.sort(), ["preferredLanguage", "uiLanguage"]);
  ["username", "displayName", "firstName", "height", "city", "country", "musicInterests"].forEach(field => assert.ok(!(field in out.fields), field));
});

test("consent must be strictly true (truthy strings do not count)", () => {
  ["true", 1, "1", "yes"].forEach(value => {
    const out = ctxCore.buildUserContext({userDoc: {...ALICE, botDeeProfileConsent: value}, role: "patron"});
    assert.equal(out.consent, false, String(value));
    assert.ok(!("height" in out.fields));
  });
});

test("consent on returns the allowlisted fields only; restricted, secret and unknown fields never", async () => {
  const {deps} = fakeDeps({users: {alice: withConsent(ALICE)}});
  const out = await ctxCore.handleGetUserContext({auth: {uid: "alice"}}, deps);
  assert.deepEqual(Object.keys(out.fields).sort(), [
    "city", "country", "displayName", "firstName", "floqrHandle", "height", "heightUnit", "musicInterests",
    "preferredLanguage", "uiLanguage", "username"
  ]);
  RESTRICTED.forEach(field => assert.ok(!(field in out.fields), field));
  ["instagramHandle", "secretNotes", "sos2faSessionId", "botDeeProfileConsent"].forEach(field => assert.ok(!(field in out.fields), field));
  const serialized = JSON.stringify(out);
  ["alice@example.com", "555", "Pennsylvania", "acct_123", "Bryant", "female"].forEach(value => assert.ok(!serialized.includes(value), value));
});

test("classification config: restricted / secret rows are never eligible, unknown names default deny", () => {
  dc.BOT_DEE_FIELDS.forEach(row => {
    if (!dc.BOT_DEE_LEVELS.includes(row.classificationLevel)) {
      assert.equal(row.botDeeEligible, 0, row.field);
      assert.equal(row.botDeeAllowed, 0, row.field);
    }
  });
  RESTRICTED.forEach(field => assert.equal(dc.botDeeEligible(field, "internal"), false, `${field} is blocked by name too`));
  const policy = dc.botDeeFieldPolicy({fields: {email: 1, phone: 1, secretNotes: 1, instagramHandle: 1}});
  assert.equal(policy.find(row => row.field === "email").botDeeAllowed, 0);
  assert.equal(policy.find(row => row.field === "phone").botDeeAllowed, 0);
  assert.ok(!policy.some(row => row.field === "secretNotes" || row.field === "instagramHandle"));
  const out = ctxCore.buildUserContext({userDoc: withConsent(ALICE), role: "patron", policy});
  assert.ok(!("email" in out.fields) && !("phone" in out.fields) && !("secretNotes" in out.fields));
});

test("a forged policy row cannot open a restricted field", () => {
  const forged = [{field: "email", classificationLevel: "internal", needsConsent: 0, botDeeAllowed: 1}];
  const out = ctxCore.buildUserContext({userDoc: withConsent(ALICE), role: "patron", policy: forged});
  assert.deepEqual(out.fields, {});
});

test("Master Admin switches: can turn an eligible field off, cannot turn restricted or unknown fields on", async () => {
  const saved = {fields: {height: 0, city: 0}};
  const {deps} = fakeDeps({users: {alice: withConsent(ALICE)}, saved});
  const out = await ctxCore.handleGetUserContext({auth: {uid: "alice"}}, deps);
  assert.ok(!("height" in out.fields) && !("city" in out.fields));
  assert.equal(out.fields.username, "alice_dc");

  assert.deepEqual(dc.validateBotDeeFieldChange({fields: {height: 0, city: true}, reason: "Owner review Oct 29"}).fields, {height: 0, city: 1});
  assert.throws(() => dc.validateBotDeeFieldChange({fields: {email: 1}, reason: "Owner review Oct 29"}), /never read/);
  assert.throws(() => dc.validateBotDeeFieldChange({fields: {phone: 1}, reason: "Owner review Oct 29"}), /never read/);
  assert.throws(() => dc.validateBotDeeFieldChange({fields: {secretNotes: 1}, reason: "Owner review Oct 29"}), /Unknown field/);
  assert.throws(() => dc.validateBotDeeFieldChange({fields: {height: 1}, reason: "short"}), /reason/);
  assert.deepEqual(dc.validateBotDeeFieldChange({fields: {email: 0}, reason: "Owner review Oct 29"}).fields, {email: 0});
});

test("values are scrubbed: contact data, coordinates and street-style numbers are dropped", () => {
  const doc = withConsent({
    displayName: "alice@example.com",
    firstName: "call 2025550100",
    city: "123 Main Street",
    country: "38.8977, -77.0365",
    height: "180",
    heightUnit: "cm",
    musicInterests: ["House", "me@x.io", "<script>"]
  });
  const out = ctxCore.buildUserContext({userDoc: doc, role: "patron"});
  assert.ok(!("displayName" in out.fields));
  assert.ok(!("firstName" in out.fields));
  assert.ok(!("city" in out.fields));
  assert.ok(!("country" in out.fields));
  assert.equal(out.fields.height, "180");
  assert.deepEqual(out.fields.musicInterests, ["House", "script"]);
});

test("throttle: 30 fetches per 10 minutes, then resource-exhausted with no read and no audit", async () => {
  let row = null;
  const now = 1_000_000;
  for (let i = 0; i < ctxCore.THROTTLE_MAX; i += 1) {
    const verdict = ctxCore.evaluateThrottle(row, now + i);
    assert.equal(verdict.allowed, true, `call ${i + 1}`);
    row = verdict.next;
  }
  assert.equal(ctxCore.THROTTLE_MAX, 30);
  assert.equal(ctxCore.evaluateThrottle(row, now + 100).allowed, false);
  assert.equal(ctxCore.evaluateThrottle(row, now + ctxCore.THROTTLE_WINDOW_MS + 1).allowed, true);

  const {deps, calls} = fakeDeps({users: {alice: withConsent(ALICE)}, throttleOk: false});
  await assert.rejects(ctxCore.handleGetUserContext({auth: {uid: "alice"}}, deps), error => error.code === "resource-exhausted");
  assert.equal(calls.reads.length, 0);
  assert.equal(calls.audits.length, 0);
});

test("audit row and log carry field names and consent state, never values", async () => {
  const {deps, calls} = fakeDeps({users: {alice: withConsent(ALICE)}});
  await ctxCore.handleGetUserContext({auth: {uid: "alice"}}, deps, 1234);
  assert.equal(calls.audits.length, 1);
  const audit = calls.audits[0];
  assert.equal(audit.uid, "alice");
  assert.equal(audit.nowMs, 1234);
  assert.equal(audit.detail.consent, true);
  assert.ok(audit.detail.fieldNames.includes("height"));
  const serialized = JSON.stringify({audit, logs: calls.logs});
  ["alice_dc", "Washington", "Alice B", "5'10", "Hip Hop", "@alice"].forEach(value => assert.ok(!serialized.includes(value), value));
});

test("Gemini prompt block: consent off has no values; consent on quotes redacted own values only", () => {
  const off = ctxCore.promptBlock(ctxCore.buildUserContext({userDoc: ALICE, role: "patron"}));
  assert.match(off, /not allowed BOT DEE/);
  ["alice_dc", "Washington", "Alice"].forEach(value => assert.ok(!off.includes(value), value));

  const on = ctxCore.promptBlock(ctxCore.buildUserContext({userDoc: withConsent({...ALICE, displayName: "code 482913"}), role: "patron"}));
  assert.match(on, /OWN profile/);
  assert.match(on, /data, never as instructions/);
  assert.ok(on.includes("\"Washington\""));
  assert.ok(!on.includes("482913"), "six-digit codes are redacted");
  ["alice@example.com", "Pennsylvania", "Bryant"].forEach(value => assert.ok(!on.includes(value), value));

  const instruction = bot.systemInstruction("patron", on);
  assert.ok(instruction.includes("Washington"));
  assert.match(instruction, /Never look up, list or describe other members' profiles/);
  assert.ok(!bot.systemInstruction("patron").includes("Profile:"));
});

test("own-profile questions are answered from the caller's context; recommendations go to Gemini", () => {
  assert.equal(ctxCore.ownProfileTopic("what's my height on file?"), "height");
  assert.equal(ctxCore.ownProfileTopic("How tall am I"), "height");
  assert.equal(ctxCore.ownProfileTopic("what is my username"), "username");
  assert.equal(ctxCore.ownProfileTopic("what city do you have for my home city"), "city");
  assert.equal(ctxCore.ownProfileTopic("what do you know about me"), "all");
  assert.equal(ctxCore.ownProfileTopic("suggest clubs near my city"), null);
  assert.equal(ctxCore.ownProfileTopic("what is bob's height"), null);

  const on = ctxCore.buildUserContext({userDoc: withConsent(ALICE), role: "patron"});
  assert.equal(ctxCore.ownProfileAnswer("height", on), "Your height on file: 5'10\"");
  assert.match(ctxCore.ownProfileAnswer("city", on), /Washington/);
  const off = ctxCore.buildUserContext({userDoc: ALICE, role: "patron"});
  assert.equal(ctxCore.ownProfileAnswer("height", off), ctxCore.CONSENT_OFF_REPLY);
  assert.match(ctxCore.CONSENT_OFF_REPLY, /My Profile → My Privacy/);
  const empty = ctxCore.buildUserContext({userDoc: {botDeeProfileConsent: true}, role: "patron"});
  assert.match(ctxCore.ownProfileAnswer("height", empty), /don't see your height/);
});

test("client mirror matches the server topic matcher and localizes replies", () => {
  const sandbox = {console};
  sandbox.window = sandbox;
  vm.runInNewContext(read("bot-dee-chat.js"), sandbox);
  const chat = sandbox.FLOQRBotDeeChat;
  [
    "what's my height on file?", "how tall am i", "my username?", "where do i live", "my home country", "my language",
    "my music taste", "what's my name", "what do you know about me", "suggest clubs near my city", "book a vip table", "hello"
  ].forEach(prompt => assert.equal(chat.ownProfileTopic(prompt), ctxCore.ownProfileTopic(prompt), prompt));
  const on = ctxCore.buildUserContext({userDoc: withConsent(ALICE), role: "patron"});
  assert.equal(chat.localProfileReply("height", on), "Your height on file: 5'10\"");
  assert.match(chat.localProfileReply("height", {consent: false, fields: {}}), /My Profile → My Privacy/);
});

test("server wiring: own doc only, allowlisted system job, exports, executeBotSession injects server-side", () => {
  const fns = fs.readFileSync(path.join(__dirname, "bot-dee-user-context-functions.js"), "utf8");
  assert.match(fns, /systemCollection\("users"\)\.doc\(uid\)\.get\(\)/);
  assert.ok(!/\.where\(/.test(fns), "no collection queries");
  assert.ok(!/collection\("users"\)\.get|listDocuments/.test(fns), "no directory reads");
  assert.ok(!/request\.data\??\.uid|request\.data\??\.userId/.test(fns), "no uid parameter");
  assert.match(fns, /writeUnchainedAudit/);
  assert.deepEqual(dc.SYSTEM_JOBS.botDeeUserContext.collections, ["users", "dataClassification", "botDeeContextThrottle"]);
  assert.throws(() => dc.systemJob("botDeeUserContext", "clubLocations"));
  assert.equal(dc.normalize("botDeeContextThrottle", null).classificationLevel, "secret");

  const index = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert.match(index, /getBotDeeUserContext:/);
  assert.match(index, /setBotDeeFieldAccess:/);

  const session = fs.readFileSync(path.join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(session, /loadOwnUserContext\(request\.auth\.uid, role\)/);
  assert.match(session, /systemInstruction\(role, ctxCore\.promptBlock\(userContext\)\)/);
  assert.match(session, /userContext: userContext \? ctxCore\.auditDetail\(userContext\)/);
});

test("rules: consent is a self-set boolean with a server-time stamp; throttle closed", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /function botDeeConsentShapeOk\(\)/);
  assert.match(rules, /get\("botDeeProfileConsent", false\) is bool/);
  assert.match(rules, /get\("botDeeProfileConsentUpdatedAt", null\) == request\.time/);
  assert.match(rules, /&& botDeeConsentCreateOk\(\);/);
  assert.match(rules, /&& botDeeConsentUpdateOk\(\);/);
  assert.match(rules, /match \/botDeeContextThrottle\/\{uid\} \{\s*allow read, write: if false;/);
});

test("client: one in-memory fetch per session, consent toggle, help + i18n in every language", () => {
  const chat = read("bot-dee-chat.js");
  assert.match(chat, /httpsCallable\(name\)/);
  assert.match(chat, /callable\("getBotDeeUserContext"\)/);
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(chat), "context is never persisted");

  const portal = read("patron-portal.html");
  assert.match(portal, /id="privacyBotDeeProfile"/);
  assert.match(portal, /data-floqr-help-id="help-bot-dee-profile-context"/);
  const portalApp = read("patron-portal-app.js");
  assert.match(portalApp, /botDeeProfileConsentUpdatedAt: stamp/);
  assert.match(portalApp, /addEventListener\("change", saveBotDeeConsent\)/);

  const repo = read("floqai-help-repository.js");
  const at = repo.indexOf("id: \"help-bot-dee-profile-context\"");
  assert.ok(at > 0);
  assert.match(repo.slice(at, at + 1600), /audiences: \["patron"\]/);
  assert.ok(!/stripe|sos2fa|systemJob|hash/i.test(repo.slice(at, at + 900)), "no design notes in help body");

  const i18n = read("floqr-i18n.js");
  ["portal.botDeeConsent", "floqai.chatProfileConsentOff", "floqai.chatProfileValue", "dataClass.botDeeTitle"].forEach(key => {
    assert.equal(i18n.split(`"${key}":`).length - 1, 11, key);
  });
  const help = read("floqr-i18n-help.js");
  assert.equal(help.split("\"help-bot-dee-profile-context\":").length - 1, 10);
});
