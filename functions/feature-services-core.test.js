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

const MATRIX = {
  live: core.normalizeFeature("mingl", {IsFeatureEnabled: 1, IsTestFeature: 0}),
  test: core.normalizeFeature("mingl", {IsFeatureEnabled: 1, IsTestFeature: 1}),
  offTest: core.normalizeFeature("mingl", {IsFeatureEnabled: 0, IsTestFeature: 1}),
  off: core.normalizeFeature("mingl", {IsFeatureEnabled: 0, IsTestFeature: 0})
};
const VIEWERS = {
  patron: {isMasterAdmin: false, isBetaTester: false, betaFeatures: {}},
  granted: {isMasterAdmin: false, isBetaTester: true, betaFeatures: {mingl: 1}},
  otherGrant: {isMasterAdmin: false, isBetaTester: true, betaFeatures: {bartr: 1}},
  master: {isMasterAdmin: true, isBetaTester: false, betaFeatures: {}},
  masterClaimingBeta: {isMasterAdmin: true, isBetaTester: true, betaFeatures: {mingl: 1}}
};

test("feature state: IsFeatureEnabled=0 is off even when IsTestFeature=1", () => {
  assert.equal(core.featureState(MATRIX.live), "live");
  assert.equal(core.featureState(MATRIX.test), "test");
  assert.equal(core.featureState(MATRIX.offTest), "off");
  assert.equal(core.featureState(MATRIX.off), "off");
  assert.equal(core.featureState(null), "off");
});

test("page/server access: off for everyone; test for Master Admins + granted beta testers; live for all", () => {
  const expected = {
    live: {patron: true, granted: true, otherGrant: true, master: true, masterClaimingBeta: true},
    test: {patron: false, granted: true, otherGrant: false, master: true, masterClaimingBeta: true},
    offTest: {patron: false, granted: false, otherGrant: false, master: false, masterClaimingBeta: false},
    off: {patron: false, granted: false, otherGrant: false, master: false, masterClaimingBeta: false}
  };
  const client = loadClientModule();
  Object.entries(expected).forEach(([state, row]) => {
    Object.entries(row).forEach(([who, allowed]) => {
      assert.equal(core.canAccessFeature(MATRIX[state], VIEWERS[who]), allowed, `server ${state}/${who}`);
      assert.equal(client.canAccess("mingl", VIEWERS[who], {mingl: MATRIX[state]}), allowed, `client ${state}/${who}`);
    });
  });
});

test("Search tile: Master Admins never see test tiles; only granted beta testers do", () => {
  const expected = {
    live: {patron: true, granted: true, otherGrant: true, master: true, masterClaimingBeta: true},
    test: {patron: false, granted: true, otherGrant: false, master: false, masterClaimingBeta: false},
    offTest: {patron: false, granted: false, otherGrant: false, master: false, masterClaimingBeta: false}
  };
  const client = loadClientModule();
  Object.entries(expected).forEach(([state, row]) => {
    Object.entries(row).forEach(([who, visible]) => {
      assert.equal(core.searchTileVisible(MATRIX[state], VIEWERS[who]), visible, `server ${state}/${who}`);
      assert.equal(client.searchVisible("mingl", VIEWERS[who], {mingl: MATRIX[state]}), visible, `client ${state}/${who}`);
    });
  });
  assert.equal(client.stateOf(MATRIX.offTest), "off");
});

test("beta grants are per feature, only for active testers, never ShoutOut", () => {
  assert.equal(core.BETA_ELIGIBLE_KEYS.includes("shoutOut"), false);
  const row = {IsBetaTester: 1, status: "active", features: {mingl: 1, bartr: 0, shoutOut: 1, nope: 1}};
  assert.deepEqual(core.betaGrantsFrom(row), {mingl: 1});
  assert.deepEqual(core.betaGrantsFrom({...row, status: "revoked"}), {});
  assert.deepEqual(core.betaGrantsFrom({IsBetaTester: 1, status: "active"}), {}, "legacy testers without a features map get nothing");
  const client = loadClientModule();
  assert.deepEqual(JSON.parse(JSON.stringify(client.betaGrantsFrom(row))), {mingl: 1});
  assert.deepEqual([...client.BETA_ELIGIBLE_KEYS], [...core.BETA_ELIGIBLE_KEYS]);
});

test("beta feature choices are validated", () => {
  const all = Object.fromEntries(core.BETA_ELIGIBLE_KEYS.map(key => [key, 0]));
  assert.deepEqual(core.validateBetaFeatures(["mingl", "rydr"]), {...all, mingl: 1, rydr: 1});
  assert.deepEqual(core.validateBetaFeatures({bartr: "1", floqAi: 0}), {...all, bartr: 1});
  assert.throws(() => core.validateBetaFeatures(["shoutOut"]), /Not a beta feature/);
  assert.throws(() => core.validateBetaFeatures(["nope"]), /Not a beta feature/);
  assert.throws(() => core.validateBetaFeatures([]), /at least one feature/);
  assert.deepEqual(core.validateBetaFeatures([], {requireOne: false}), all);
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
  assert.match(html, /id="shoutoutBtnCard" class="shoutout-icon-card"[^>]*data-feature-key="shoutOut"/);
  ["minglBtnCard", "bartrBtnCard", "rydrBtnCard", "suprstrBtnCard", "intentSearchBtnCard"].forEach(id => {
    assert.match(html, new RegExp(`id="${id}" class="[^"]*\\bhidden\\b[^"]*"[^>]*data-feature-key=`), id);
  });
  assert.match(html, /floqr-feature-services\.js\?v=s3\.\d+\.\d+/);
  const app = read("patron-app.js");
  assert.match(app, /FLOQRFeatureServices\?\.applySearchUi/);
  assert.match(app, /intentSearchPage"\)\?\.classList\.contains\("active"\) && !featureServiceAllows\("floqAi"\)/, "start=intent must not bypass the floqAi gate");
  assert.match(read("floqr-feature-services.js"), /searchVisible\(/);
});

test("test-feature satellite pages are guarded", () => {
  const pages = {
    "commerce.html": "bartr", "pickup.html": "rydr", "rydr.html": "rydr",
    "suprstr-search.html": "supRstar", "suprstar-preview.html": "supRstar",
    "mingl-chat.html": "mingl", "mingl-gist.html": "mingl"
  };
  const guard = read("floqr-feature-services.js");
  assert.match(guard, /if \(!fb\.apps\?\.length && root\.firebaseConfig\) fb\.initializeApp\(root\.firebaseConfig\)/, "guard must start Firebase on pages without an app script");
  Object.entries(pages).forEach(([file, key]) => {
    const html = read(file);
    assert.match(html, new RegExp(`<body[^>]*data-floqr-feature="${key}"`), file);
    assert.match(html, /floqr-feature-services\.js\?v=s3\.\d+\.\d+/, file);
    assert.doesNotMatch(html, /data-floqr-feature-signed-out="allow"/, `${file} must send signed-out visitors to sign-in`);
  });
  assert.match(guard, /if \(!root\.FLOQRSessionShell\?\.redirectToLogin\?\.\(\)\) showDenied\(doc\)/);
  assert.match(guard, /httpsCallable\("logFeatureAccessAttempt"\)/);
});

function loadShell(href, {top = null, publicPage = false} = {}) {
  const replaced = [];
  const url = new URL(href);
  const doc = {
    readyState: "loading",
    addEventListener() {},
    querySelector: () => null,
    body: {hasAttribute: name => publicPage && name === "data-floqr-public"}
  };
  const win = {document: doc, FLOQRNav: {appVersion: "s3.0.110"}};
  win.self = win;
  win.top = top || win;
  const location = {href, pathname: url.pathname, search: url.search, hash: url.hash, replace: next => replaced.push(next)};
  vm.runInNewContext(read("floqr-session-shell.js"), {window: win, document: doc, location, URL, URLSearchParams, setTimeout, clearTimeout, console});
  return {shell: win.FLOQRSessionShell, replaced};
}

test("signed-out visitors on a forwarded page go to the general sign-in, then back", () => {
  const {shell, replaced} = loadShell("https://example.test/shoutout-demo/commerce.html?v=s3.0.1&club=abc#store");
  assert.equal(shell.redirectToLogin(), true);
  const next = new URL(replaced[0], "https://example.test/shoutout-demo/commerce.html");
  assert.equal(next.pathname, "/shoutout-demo/");
  assert.equal(next.searchParams.get("profileRequired"), "sign-in");
  assert.equal(next.searchParams.get("v"), null, "page links never carry a version");
  assert.equal(next.searchParams.get("returnTo"), "commerce.html?club=abc#store");

  const embedded = loadShell("https://example.test/staff-worksheet.html?embed=1");
  assert.equal(embedded.shell.redirectToLogin(), false, "iframes never navigate to sign-in");
  const framed = loadShell("https://example.test/staff-worksheet.html", {top: {}});
  assert.equal(framed.shell.redirectToLogin(), false);
  ["index.html", "display.html", "display2.html", "privacy.html"].forEach(file => {
    assert.equal(loadShell(`https://example.test/${file}`).shell.redirectToLogin(), false, file);
  });
  assert.equal(loadShell("https://example.test/tool.html", {publicPage: true}).shell.redirectToLogin(), false);
  assert.match(read("patron-app.js"), /app\.signInToContinue/);
});

test("server enforces feature access on checkout and robotaxi", () => {
  const commerce = read("functions/commerce-functions.js");
  assert.match(commerce, /CHECKOUT_FEATURE_KEYS/);
  assert.match(commerce, /assertFeatureAccess\(request\.auth, serviceFeatureKey, request\)/);
  assert.match(commerce, /assertFeatureAccess\(request\.auth, "rydr", request\)/);
  const index = read("functions/index.js");
  ["setFeatureServiceFlags", "seedFeatureServices", "createBetaInvite", "acceptBetaInvite", "declineBetaInvite",
    "revokeBetaTester", "revokeBetaInvite", "setBetaTesterFeatures", "logFeatureAccessAttempt",
    "logFeatureCodePromotion", "verifyFeatureServiceAuditChain"].forEach(name => {
    assert.match(index, new RegExp(`\\b${name}: featureServiceFns\\.${name}\\b`), name);
  });
});

test("Master Admins cannot become beta testers; feature grants and denials are logged", () => {
  const fns = read("functions/feature-services-functions.js");
  assert.match(fns, /beta\.invite_denied/);
  assert.match(fns, /Master Admins cannot be beta testers/);
  assert.match(fns, /accept && await isPrivilegedAuth\(/);
  assert.match(fns, /beta\.features_changed/);
  assert.match(fns, /feature\.page_denied/);
  assert.match(fns, /featureServiceAccessThrottle/);
  assert.match(fns, /const isBetaTester = !privileged && core\.isActiveBetaTester\(row\)/);
  const rules = read("firestore.rules");
  assert.match(rules, /match \/featureServiceAccessThrottle\/\{uid\}\s*\{\s*allow read, write: if false;/);
});

test("Master Admin Features & Services tab is SOS2FA gated", () => {
  const html = read("master-admin.html");
  assert.match(html, /data-panel="featuresServices"/);
  assert.match(html, /<section id="featuresServices"/);
  assert.match(html, /master-feature-services\.js\?v=s3\.\d+\.\d+/);
  assert.match(html, /id="betaInviteFeatures"/);
  const app = read("master-feature-services.js");
  assert.match(app, /httpsCallable\("setBetaTesterFeatures"\)|call\("setBetaTesterFeatures"/);
  assert.match(app, /featureKeys/);
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
