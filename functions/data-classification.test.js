/* Data classification register, System tier, and FloqAi enforcement.
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dc = require("./data-classification-core");
const manifest = require("./floqai-content-classes.json");
const {buildManifest, serialize} = require("../scripts/build-floqai-content-classes");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const rules = read("firestore.rules");

test("every collection in firestore.rules is classified (including nested subcollections)", () => {
  const access = dc.parseRulesAccess(rules);
  const ruled = Object.keys(access);
  assert.ok(ruled.length > 100, `parsed ${ruled.length} rule paths`);
  const missing = ruled.filter(name => !dc.COLLECTIONS.includes(name));
  assert.deepEqual(missing, [], `unclassified rules collections: ${missing.join(", ")}`);
  assert.ok(dc.COLLECTIONS.includes("suprstrSessions/callerCandidates"));
  assert.ok(dc.COLLECTIONS.includes("suprstrSessions/calleeCandidates"));
  assert.equal(new Set(dc.COLLECTIONS).size, dc.COLLECTIONS.length, "no duplicate catalog rows");
});

test("every catalog row carries the full datapoint set", () => {
  dc.COLLECTIONS.forEach(collection => {
    const row = dc.normalize(collection, null);
    [...dc.FLAGS, dc.SYSTEM_FLAG].forEach(key => assert.ok(row[key] === 0 || row[key] === 1, `${collection}.${key}`));
    assert.equal(typeof row.retentionDays, "number");
    assert.ok(dc.LEVELS.includes(row.classificationLevel));
    assert.equal(row[dc.SYSTEM_FLAG], 1, `${collection} system access`);
  });
});

test("served client module is byte-identical to the server core", () => {
  const server = fs.readFileSync(path.join(__dirname, "data-classification-core.js"));
  const client = fs.readFileSync(path.join(ROOT, "floqr-data-classification.js"));
  assert.ok(client.equals(server), "run node scripts/sync-data-classification-client.js");
});

test("System tier is server-only and cannot be switched off", () => {
  assert.ok(!dc.CLIENT_ROLES.includes("system"));
  const facts = [
    {}, {signedIn: true}, {signedIn: true, isMasterAdmin: true}, {signedIn: true, role: "system", server: true},
    {signedIn: true, clubAdminClubIds: ["c1"]}, {signedIn: true, designations: [{clubId: "c1", status: "approved", rolePermissions: ["schedule"]}]}
  ];
  facts.forEach(f => assert.notEqual(dc.resolveViewerRole(f).role, "system"));
  const row = dc.normalize("users", null);
  assert.equal(dc.access(row, {role: "system"}), "no", "system without a server context");
  assert.equal(dc.access(row, {role: "system", server: true}), "yes");
  assert.equal(dc.access(dc.normalize("sos2faTotp", null), {role: "system", server: true}), "yes");
  const {next} = dc.validateChange({collection: "events", reason: "Lock events down for review", isMasterAdminAccessible: 1, [dc.SYSTEM_FLAG]: 0});
  assert.equal(next[dc.SYSTEM_FLAG], 1);
  assert.ok(!dc.FLAGS.includes(dc.SYSTEM_FLAG), "system flag is never an editable datapoint");
});

test("System jobs are least-privilege: allowlisted collections only, each with a purpose", () => {
  Object.entries(dc.SYSTEM_JOBS).forEach(([job, entry]) => {
    assert.ok(entry.purpose.length > 20, `${job} purpose`);
    entry.collections.forEach(collection => assert.ok(dc.COLLECTIONS.includes(collection), `${job} → ${collection} is classified`));
  });
  assert.equal(dc.systemJob("floqAiAccess", "clubLocations").job, "floqAiAccess");
  assert.throws(() => dc.systemJob("floqAiAccess", "sos2faTotp"), /may not read/);
  assert.throws(() => dc.systemJob("unknownJob", "users"), /Unknown system job/);
});

test("resolveViewerRole maps server facts to tiers", () => {
  assert.equal(dc.resolveViewerRole({}).role, "anonymous");
  assert.equal(dc.resolveViewerRole({signedIn: true}).role, "patron");
  assert.equal(dc.resolveViewerRole({signedIn: true, isMasterAdmin: true}).role, "master");
  assert.deepEqual(dc.resolveViewerRole({signedIn: true, clubAdminClubIds: ["c1"]}), {role: "clubAdmin", clubIds: ["c1"]});
  assert.equal(dc.resolveViewerRole({signedIn: true, designations: [{clubId: "c1", status: "approved"}]}).role, "regular");
  assert.equal(dc.resolveViewerRole({signedIn: true, designations: [{clubId: "c1", status: "approved", rolePermissions: ["publishSchedule"]}]}).role, "privileged");
  assert.equal(dc.resolveViewerRole({signedIn: true, designations: [{clubId: "c1", status: "rejected", rolePermissions: ["x"]}]}).role, "patron");
  assert.equal(dc.resolveViewerRole({signedIn: true, designations: [{clubId: "c2", status: "approved", roleElectionType: "Club Admin"}]}).role, "clubAdmin");
});

const SAMPLE = {
  public: "intent:venue-search",
  patron: "intent:help-general",
  serviceMember: "intent:help-scheduling",
  privilegedEmployee: "intent:help-create-publish-schedule",
  venueAdmin: "intent:help-venue-hours-calendar",
  masterAdmin: "intent:help-mail-logging"
};
const EXPECTED = {
  anonymous: ["public"],
  patron: ["public", "patron"],
  regular: ["public", "patron", "serviceMember"],
  privileged: ["public", "patron", "serviceMember", "privilegedEmployee"],
  clubAdmin: ["public", "patron", "serviceMember", "privilegedEmployee", "venueAdmin"],
  master: Object.keys(SAMPLE),
  system: []
};

test("FloqAi filter matrix: each tier sees exactly its classified content", () => {
  Object.entries(EXPECTED).forEach(([role, audiences]) => {
    const {allowed} = dc.filterContent(Object.values(SAMPLE), manifest, {role});
    assert.deepEqual(allowed.sort(), audiences.map(key => SAMPLE[key]).sort(), role);
  });
});

test("FloqAi fails closed on unclassified, malformed, or unknown ids", () => {
  const bad = ["intent:does-not-exist", "help:popout-runtime-only", "", "intent:", "help:../users", "users", "intent:<script>", "x:help-general"];
  const {allowed, denied} = dc.filterContent(bad, manifest, {role: "master"});
  assert.deepEqual(allowed, []);
  assert.ok(denied.every(row => row.level === "unclassified"));
  assert.equal(dc.contentRow("intent:help-general", {intents: {"help-general": []}}), null, "empty audience list = unclassified");
  assert.equal(dc.classifyAudiences(["notARealAudience"]), null);
  assert.deepEqual(dc.denialsToLog([{id: "a", level: "public"}, {id: "b", level: "restricted"}, {id: "c", level: "unclassified"}]).map(r => r.id), ["b", "c"]);
  assert.deepEqual(dc.sanitizeSourceIds(["a", "a", 5, null, " b ", "x".repeat(300)]), ["a", "b", "x".repeat(140)]);
  assert.equal(dc.sanitizeSourceIds(Array.from({length: 200}, (_, i) => `intent:i${i}`)).length, dc.MAX_CONTENT_IDS);
});

test("every FloqAi help entry and intent is classified, and the server manifest matches the source", () => {
  const built = buildManifest(ROOT);
  const unclassifiedHelp = Object.entries(built.help).filter(([, a]) => !a.length).map(([id]) => id);
  const unclassifiedIntents = Object.entries(built.intents).filter(([, a]) => !a.length).map(([id]) => id);
  assert.deepEqual(unclassifiedHelp, []);
  assert.deepEqual(unclassifiedIntents, []);
  assert.ok(Object.keys(built.help).length >= 80);
  assert.ok(Object.keys(built.intents).length >= 45);
  const current = fs.readFileSync(path.join(__dirname, "floqai-content-classes.json"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(current, serialize(built), "run node scripts/build-floqai-content-classes.js");
  Object.entries(built.help).forEach(([id, audiences]) => assert.ok(dc.contentRow(`help:${id}`, built), `help:${id} classifies`));
  Object.entries(built.intents).forEach(([id]) => assert.ok(dc.contentRow(`intent:${id}`, built), `intent:${id} classifies`));
});

test("translated help inherits its source entry's classification", () => {
  const win = {
    FLOQRNav: {appVersion: "t"}, location: {href: "https://t/", pathname: "/"}, navigator: {language: "fr"}, addEventListener() {}, document: null,
    localStorage: {getItem: () => "fr", setItem() {}}, URLSearchParams, URL, console, setTimeout,
    FLOQRI18nHelp: {localize: (entry, lang) => ({...entry, title: `[${lang}] ${entry.title}`, body: `[${lang}] ${entry.body}`})}
  };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(read("floqai-help-repository.js"), ctx);
  const repo = win.FLOQRHelpRepository;
  const all = {IsPatron: 1, IsServiceMember: 1, IsVenueAdmin: 1, IsMasterAdmin: 1};
  const localized = repo.toSearchIntents(all);
  assert.ok(localized.length >= 80);
  localized.forEach(row => {
    assert.ok(row.label.startsWith("[fr]"), `${row.id} localized`);
    const fromSource = dc.contentRow(`help:${row.id}`, manifest);
    assert.ok(fromSource, `${row.id} classified by source id`);
    assert.deepEqual([...row.audiences].sort(), manifest.help[row.id], `${row.id} keeps source audiences`);
  });
});

test("intent-search.js classifies every curated intent and has no default-audience fallback", () => {
  const src = read("intent-search.js");
  assert.ok(src.includes("const INTENT_AUDIENCES"));
  assert.ok(!/\["patron"\]\s*:\s*\["patron"\]/.test(src), "no default patron audience");
  assert.ok(src.includes("sourceId: `help:${intent.id}`"));
  assert.ok(src.includes("sourceId: `intent:${intent.id}`"));
  assert.ok(src.includes("enforceServerVerdicts"));
});

test("getFloqAiAccess resolves the tier server-side, keeps the floqAi feature guard, and logs restricted denials", () => {
  const src = fs.readFileSync(path.join(__dirname, "data-classification-functions.js"), "utf8");
  assert.ok(src.includes("exports.getFloqAiAccess"));
  assert.ok(src.includes('assertFeatureAccess(request.auth || null, "floqAi", request)'));
  assert.ok(src.includes("core.resolveViewerRole(await roleFactsFor(request.auth))"));
  assert.ok(!/request\.data\??\.(role|tier|audience|isMasterAdmin)/.test(src), "never trusts a client-supplied role");
  assert.ok(src.includes("writeUnchainedAudit"));
  assert.ok(src.includes("floqai.content_denied"));
  assert.ok(src.includes("core.systemJob(FLOQAI_JOB, collection)"));
  assert.ok(src.includes('request.app ? "verified" : "missing"'));
  assert.ok(!/enforceAppCheck:\s*true/.test(src), "App Check is recorded, not enforced yet");
  const index = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert.ok(index.includes('require("./data-classification-functions")'));
});

test("rules lock the register, throttles, and consent evidence to server writes", () => {
  const access = dc.parseRulesAccess(rules);
  assert.deepEqual(access.dataClassification, {read: "master", write: "none"});
  assert.deepEqual(access.floqAiAccessThrottle, {read: "none", write: "none"});
  assert.deepEqual(access.staffMarketingConsentThrottle, {read: "none", write: "none"});
  assert.equal(access.staffMarketingConsentLogs.write, "none");
});

test("marketing media consent is restricted, own-record readable, and readable by the affiliated club's admins", () => {
  const field = dc.FIELD_CATALOG.find(row => row.collection === "users.marketingMediaConsent");
  assert.ok(field);
  assert.equal(field.classificationLevel, "restricted");
  assert.equal(field.ownRecordReadable, 1);
  assert.equal(field.isClubAdminAccessible, 1);
  assert.equal(field.isPrivilegedEmployeeAccessible, 0);
  assert.equal(field.scope, "club");
  assert.equal(dc.access(field, {role: "clubAdmin", sameClub: true}), "yes");
  assert.equal(dc.access(field, {role: "clubAdmin", sameClub: false}), "no");
  assert.equal(dc.access(field, {role: "patron", own: true}), "own");
  const logs = dc.normalize("staffMarketingConsentLogs", null);
  assert.equal(logs.classificationLevel, "restricted");
  assert.equal(logs.containsPII, 1);
});

test("rules parser and exposure report", () => {
  const sample = `service cloud.firestore { match /databases/{db}/documents {
    match /a/{id} { allow read: if true; allow write: if signedIn(); match /sub/{x} { allow read: if isMasterAdmin(); } }
    match /b/{id} { allow read, write: if false; } } }`;
  const access = dc.parseRulesAccess(sample);
  assert.deepEqual(access.a, {read: "public", write: "signedIn"});
  assert.deepEqual(access["a/sub"], {read: "master", write: "none"});
  assert.deepEqual(access.b, {read: "none", write: "none"});
  const rows = [{...dc.normalize("users", null), collection: "a"}];
  const issues = dc.exposureReport(rows, access);
  assert.deepEqual(issues.map(i => i.kind).sort(), ["readBroader", "writeOpen"]);
  assert.ok(issues.every(i => i.severity === "high"));
  const csv = dc.toCsv([{collection: "=cmd", description: "a,b"}]);
  assert.ok(csv.includes("'=cmd"));
  assert.ok(csv.includes("\"a,b\""));
});

test("Master Admin Security → Data classification panel is wired and SOS2FA-gated", () => {
  const html = read("master-admin.html");
  assert.ok(html.includes('data-panel="dataClassification"'));
  assert.ok(html.includes('<section id="dataClassification"'));
  assert.ok(html.includes("isSystemAccessible"));
  assert.ok(/floqr-data-classification\.js[\s\S]*master-data-classification\.js/.test(html));
  assert.ok(/"dataClassification"/.test(read("sos2fa.js")));
  assert.ok(read("master-admin-app.js").includes("FLOQRMasterDataClassification"));
  const floqai = read("floqai.html");
  assert.ok(/floqr-data-classification\.js[\s\S]*floqai-access\.js[\s\S]*intent-search\.js/.test(floqai));
  assert.ok(floqai.includes('data-floqr-feature="floqAi"'));
});
