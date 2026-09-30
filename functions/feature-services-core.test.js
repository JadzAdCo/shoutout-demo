/**
 * Features & Services: catalog parity, access rule, invites, audit hash chain, rules, page wiring.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const core = require("./feature-services-core");

const ROOT = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

function loadClientModule() {
  const doc = {readyState: "complete", body: {dataset: {}}, addEventListener() {}};
  const sandbox = {window: {}, document: doc, console, setTimeout, clearTimeout};
  sandbox.window.document = doc;
  vm.runInNewContext(read("floqr-feature-services.js"), sandbox);
  return sandbox.window.FLOQRFeatureServices;
}

test("only ShoutOut is live by default; every other feature is test-only", () => {
  const live = core.FEATURE_CATALOG.filter(row => row.IsFeatureEnabled === 1).map(row => row.key);
  assert.deepEqual(live, ["shoutOut"]);
  core.FEATURE_CATALOG.filter(row => row.key !== "shoutOut").forEach(row => {
    assert.equal(row.IsFeatureEnabled, 0, row.key);
    assert.equal(row.IsTestFeature, 1, row.key);
  });
  assert.deepEqual(core.FEATURE_KEYS, ["shoutOut", "mingl", "bartr", "rydr", "supRstar", "floqAi"]);
});

test("client catalog mirrors the server catalog (keys, routes, defaults)", () => {
  const client = loadClientModule();
  const pick = row => ({key: row.key, route: row.route, IsFeatureEnabled: row.IsFeatureEnabled, IsTestFeature: row.IsTestFeature, patronGate: row.patronGate});
  assert.deepEqual(JSON.parse(JSON.stringify(client.CATALOG.map(pick))), core.FEATURE_CATALOG.map(pick));
});

test("access rule: master admin always; live for all; test only for active beta testers", () => {
  const live = core.normalizeFeature("shoutOut");
  const beta = core.normalizeFeature("mingl");
  const off = core.normalizeFeature("mingl", {IsFeatureEnabled: 0, IsTestFeature: 0});
  const patron = {isMasterAdmin: false, isBetaTester: false};
  const tester = {isMasterAdmin: false, isBetaTester: true};
  const master = {isMasterAdmin: true, isBetaTester: false};
  assert.equal(core.canAccessFeature(live, patron), true);
  assert.equal(core.canAccessFeature(beta, patron), false);
  assert.equal(core.canAccessFeature(beta, tester), true);
  assert.equal(core.canAccessFeature(beta, master), true);
  assert.equal(core.canAccessFeature(off, tester), false);
  assert.equal(core.canAccessFeature(off, master), true);
  assert.equal(core.canAccessFeature(null, master), false);

  const client = loadClientModule();
  assert.equal(client.canAccess("mingl", patron, {mingl: beta}), false);
  assert.equal(client.canAccess("mingl", tester, {mingl: beta}), true);
});

test("beta tester status requires IsBetaTester=1 and status active", () => {
  assert.equal(core.isActiveBetaTester({IsBetaTester: 1, status: "active"}), true);
  assert.equal(core.isActiveBetaTester({IsBetaTester: 1, status: "revoked"}), false);
  assert.equal(core.isActiveBetaTester({IsBetaTester: 0, status: "active"}), false);
  assert.equal(core.isActiveBetaTester(null), false);
});

test("flag changes are validated and need a reason", () => {
  assert.throws(() => core.validateFlagChange({featureKey: "nope", IsFeatureEnabled: 1, reason: "long enough reason"}), /Unknown feature/);
  assert.throws(() => core.validateFlagChange({featureKey: "mingl", IsFeatureEnabled: 2, reason: "long enough reason"}), /0 or 1/);
  assert.throws(() => core.validateFlagChange({featureKey: "mingl", reason: "long enough reason"}), /IsFeatureEnabled/);
  assert.throws(() => core.validateFlagChange({featureKey: "mingl", IsFeatureEnabled: 1, reason: "short"}), /at least 8/);
  const ok = core.validateFlagChange({featureKey: "mingl", IsFeatureEnabled: "1", reason: "  Beta sign-off  "});
  assert.deepEqual(ok, {featureKey: "mingl", next: {IsFeatureEnabled: 1}, reason: "Beta sign-off"});
  assert.equal(core.flagEventType({IsFeatureEnabled: 0, IsTestFeature: 1}, {IsFeatureEnabled: 1, IsTestFeature: 1}), "feature.enabled");
  assert.equal(core.flagEventType({IsFeatureEnabled: 1, IsTestFeature: 1}, {IsFeatureEnabled: 0, IsTestFeature: 0}), "feature.flags_changed");
  assert.equal(core.flagEventType({IsFeatureEnabled: 1, IsTestFeature: 0}, {IsFeatureEnabled: 1, IsTestFeature: 0}), "");
});

test("invite tokens are unguessable, hashed at rest, and bound to one account", () => {
  const token = core.newInviteToken();
  assert.equal(core.isValidInviteToken(token), true);
  assert.equal(core.isValidInviteToken("short"), false);
  assert.notEqual(core.inviteIdFor(token), token);
  assert.match(core.inviteIdFor(token), /^[0-9a-f]{64}$/);
  const now = 1_000_000;
  const invite = {status: "pending", targetUid: "u1", expiresAtMs: now + 1000};
  assert.deepEqual(core.evaluateInvite(invite, {uid: "u1", nowMs: now}), {ok: true, reason: ""});
  assert.equal(core.evaluateInvite(invite, {uid: "u2", nowMs: now}).reason, "wrong-account");
  assert.equal(core.evaluateInvite(invite, {uid: "u1", nowMs: now + 5000}).reason, "expired");
  assert.equal(core.evaluateInvite({...invite, status: "accepted"}, {uid: "u1", nowMs: now}).reason, "used");
  assert.equal(core.evaluateInvite({...invite, status: "revoked"}, {uid: "u1", nowMs: now}).reason, "revoked");
  assert.equal(core.evaluateInvite(null, {uid: "u1", nowMs: now}).reason, "not-found");
});

function chain(records) {
  let prevHash = core.GENESIS_HASH;
  return records.map((record, i) => {
    const body = {...record, eventId: `e${i + 1}`, seq: i + 1, prevHash};
    const hash = core.chainHash(prevHash, body);
    prevHash = hash;
    return {...body, hash, chained: true, createdAt: {seconds: i}};
  });
}

test("audit records carry AU-3 content and privacy-safe source data", () => {
  const record = core.buildAuditRecord({
    eventType: "feature.enabled",
    actor: {uid: "admin1", email: "Admin@Example.com", role: "masterAdmin"},
    target: {type: "feature", id: "mingl"},
    before: {IsFeatureEnabled: 0}, after: {IsFeatureEnabled: 1},
    reason: "QA sign-off", sessionId: "sos-session", ip: "203.0.113.77", userAgent: "UA", nowMs: Date.UTC(2026, 8, 30)
  });
  assert.equal(record.actorEmail, "admin@example.com");
  assert.equal(record.createdAtIso, "2026-09-30T00:00:00.000Z");
  assert.equal(record.sourceIpTruncated, "203.0.113.0/24");
  assert.ok(!JSON.stringify(record).includes("203.0.113.77"));
  assert.ok(!JSON.stringify(record).includes("sos-session"));
  assert.equal(record.retentionYears, 7);
  ["ISO27001-A.8.15", "NIST-800-53r5-AU-3", "NIST-800-53r5-AU-9", "NIST-800-53r5-CM-3"].forEach(control => assert.ok(record.controlSets.includes(control), control));
  assert.equal(core.maskEmail("patron@example.com"), "p***@example.com");
});

test("hash chain verifies and detects edits, deletions, and reordering", () => {
  const rows = chain([
    core.buildAuditRecord({eventType: "feature.seeded", nowMs: 1}),
    core.buildAuditRecord({eventType: "feature.enabled", reason: "QA sign-off", nowMs: 2}),
    core.buildAuditRecord({eventType: "beta.invite_created", nowMs: 3})
  ]);
  assert.equal(core.verifyChain(rows).ok, true);
  const edited = rows.map((row, i) => (i === 1 ? {...row, reason: "tampered reason"} : row));
  assert.equal(core.verifyChain(edited).issue, "hash");
  assert.equal(core.verifyChain([rows[0], rows[2]]).ok, false);
  assert.equal(core.verifyChain([rows[1], rows[0], rows[2]]).ok, false);
});

test("firestore rules: feature collections are server-write-only and superAdmin is protected", () => {
  const rules = read("firestore.rules");
  ["featureServices", "betaTesters", "betaInvites", "featureServiceAuditLogs", "featureServiceAuditHead"].forEach(name => {
    const block = rules.match(new RegExp(`match /${name}/\\{[^}]+\\}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
    assert.ok(block, `rules block for ${name}`);
    assert.match(block[1], /allow write: if false/, `${name} must be server-write-only`);
  });
  assert.match(rules, /hasBackendOnlyIdentityFields[\s\S]*"superAdmin"[\s\S]*"IsBetaTester"/);
});

test("Search tiles: ShoutOut visible, every other feature hidden until Features & Services allows it", () => {
  const html = read("index.html");
  assert.match(html, /id="shoutoutBtnCard" class="category-card hot"[^>]*data-feature-key="shoutOut"/);
  ["minglBtnCard", "bartrBtnCard", "rydrBtnCard", "suprstrBtnCard", "intentSearchBtnCard"].forEach(id => {
    assert.match(html, new RegExp(`id="${id}" class="[^"]*\\bhidden\\b[^"]*"[^>]*data-feature-key=`), id);
  });
  assert.match(html, /floqr-feature-services\.js\?v=s3\.0\.108/);
  assert.match(read("patron-app.js"), /FLOQRFeatureServices\?\.applySearchUi/);
});

test("test-feature satellite pages are guarded", () => {
  const pages = {
    "commerce.html": "bartr", "pickup.html": "rydr", "rydr.html": "rydr",
    "suprstr-search.html": "supRstar", "suprstar-preview.html": "supRstar",
    "mingl-chat.html": "mingl", "mingl-gist.html": "mingl"
  };
  Object.entries(pages).forEach(([file, key]) => {
    const html = read(file);
    assert.match(html, new RegExp(`<body[^>]*data-floqr-feature="${key}"`), file);
    assert.match(html, /floqr-feature-services\.js\?v=s3\.0\.108/, file);
  });
});

test("server enforces feature access on checkout and robotaxi", () => {
  const commerce = read("functions/commerce-functions.js");
  assert.match(commerce, /CHECKOUT_FEATURE_KEYS/);
  assert.match(commerce, /assertFeatureAccess\(request\.auth, serviceFeatureKey, request\)/);
  assert.match(commerce, /assertFeatureAccess\(request\.auth, "rydr", request\)/);
  const index = read("functions/index.js");
  ["setFeatureServiceFlags", "seedFeatureServices", "createBetaInvite", "acceptBetaInvite", "declineBetaInvite",
    "revokeBetaTester", "revokeBetaInvite", "logFeatureCodePromotion", "verifyFeatureServiceAuditChain"].forEach(name => {
    assert.match(index, new RegExp(`\\b${name}: featureServiceFns\\.${name}\\b`), name);
  });
});

test("Master Admin Features & Services tab is SOS2FA gated", () => {
  const html = read("master-admin.html");
  assert.match(html, /data-panel="featuresServices"/);
  assert.match(html, /<section id="featuresServices"/);
  assert.match(html, /master-feature-services\.js\?v=s3\.0\.108/);
  assert.match(read("sos2fa.js"), /"featuresServices"/);
  assert.match(read("master-admin-app.js"), /"featuresServices"/);
});

test("in-app ad splash: 5 second loading message, no countdown or Skip", () => {
  const html = read("index.html");
  const app = read("patron-app.js");
  assert.match(html, /data-i18n="ad\.splash\.loadingSearch">…loading your search</);
  assert.doesNotMatch(html, /skipAdBtn/);
  assert.match(app, /const AD_SPLASH_MS = 5000;/);
  assert.doesNotMatch(app, /skipAdBtn|skipAdSplash/);
});
