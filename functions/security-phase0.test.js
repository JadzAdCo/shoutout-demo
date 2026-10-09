"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {SERVER_ADMIN_EMAILS, isServerAdminAuth, isServerAdminEmail} = require("./admin-trust");
const {evaluateOtpAttempt} = require("./otp-attempts");

const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");

function bracedBlock(source, startToken, from = 0) {
  const start = source.indexOf(startToken, from);
  assert.ok(start >= 0, `missing ${startToken}`);
  let depth = 0;
  for (let i = source.indexOf("{", start + startToken.length); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unclosed ${startToken}`);
}

function callableBody(source, name) {
  const start = source.indexOf(`exports.${name} = onCall(`);
  assert.ok(start >= 0, `missing callable ${name}`);
  const end = source.indexOf("\nexports.", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

/* ---------- admin-trust ---------- */

test("admin-trust: token claims grant admin", () => {
  assert.equal(isServerAdminAuth({uid: "u1", token: {masterAdmin: true}}), true);
  assert.equal(isServerAdminAuth({uid: "u1", token: {superAdmin: true}}), true);
  assert.equal(isServerAdminAuth({uid: "u1", token: {masterAdmin: "true"}}), false, "only boolean true claims count");
});

test("admin-trust: allowlisted emails grant admin only when the token email is verified", () => {
  ["bans.don@gmail.com", "don.b@jadzholdings.com"].forEach(email => {
    assert.ok(SERVER_ADMIN_EMAILS.includes(email), email);
    assert.equal(isServerAdminEmail(email), true, email);
    assert.equal(isServerAdminAuth({uid: "u1", token: {email, email_verified: true}}), true, email);
    assert.equal(isServerAdminAuth({uid: "u1", token: {email}}), false, `${email} without email_verified`);
    assert.equal(isServerAdminAuth({uid: "u1", token: {email, email_verified: false}}), false, `${email} unverified`);
    assert.equal(isServerAdminAuth({uid: "u1", token: {email, email_verified: "true"}}), false, "only boolean true counts");
  });
  assert.equal(isServerAdminAuth({uid: "u1", token: {email: "  BANS.DON@gmail.com ", email_verified: true}}), true, "case and whitespace insensitive");
});

test("admin-trust: the unowned typo address is not an admin", () => {
  assert.equal(SERVER_ADMIN_EMAILS.includes("bands.don@gmail.com"), false);
  assert.equal(isServerAdminAuth({uid: "u1", token: {email: "bands.don@gmail.com", email_verified: true}}), false);
});

test("admin-trust: env list merges with the defaults", () => {
  const previous = process.env.FLOQR_MASTER_ADMIN_EMAILS;
  process.env.FLOQR_MASTER_ADMIN_EMAILS = "Ops@Example.com, second@example.com";
  delete require.cache[require.resolve("./admin-trust")];
  try {
    const fresh = require("./admin-trust");
    assert.equal(fresh.isServerAdminEmail("ops@example.com"), true);
    assert.equal(fresh.isServerAdminEmail("second@example.com"), true);
    assert.equal(fresh.isServerAdminEmail("bans.don@gmail.com"), true, "defaults are never dropped by the env list");
    assert.equal(fresh.isServerAdminEmail("bands.don@gmail.com"), false);
  } finally {
    if (previous === undefined) delete process.env.FLOQR_MASTER_ADMIN_EMAILS;
    else process.env.FLOQR_MASTER_ADMIN_EMAILS = previous;
    delete require.cache[require.resolve("./admin-trust")];
  }
});

test("admin-trust: patron profile fields never grant admin", () => {
  const patron = {uid: "p1", token: {email: "patron@example.com"}};
  const profile = {superAdmin: true, masterAdmin: true, roles: ["masterAdmin", "superAdmin"], approvedRoles: ["Club Admin"]};
  assert.equal(isServerAdminAuth(patron), false);
  assert.equal(isServerAdminAuth({...patron, profile}), false);
  assert.equal(isServerAdminAuth({...patron, ...profile}), false);
  assert.equal(isServerAdminAuth({uid: "p1", token: {email: "patron@example.com", roles: ["masterAdmin"]}}), false);
});

test("admin-trust: missing auth or email is not admin", () => {
  assert.equal(isServerAdminAuth(null), false);
  assert.equal(isServerAdminAuth(undefined), false);
  assert.equal(isServerAdminAuth({}), false);
  assert.equal(isServerAdminAuth({uid: "u1"}), false);
  assert.equal(isServerAdminAuth({uid: "u1", token: {}}), false);
  assert.equal(isServerAdminEmail(""), false);
  assert.equal(isServerAdminEmail(null), false);
});

test("admin-trust: module does not reach Firestore", () => {
  const source = read("admin-trust.js");
  assert.doesNotMatch(source, /require\(["']firebase-admin["']\)|collection\(|\.firestore\(/);
});

/* ---------- OTP attempt evaluator ---------- */

const NOW = 1_800_000_000_000;
const base = {storedHash: "a".repeat(64), maxAttempts: 5, expiresAtMs: NOW + 60_000, nowMs: NOW};

test("otp: correct code within the limit succeeds", () => {
  const verdict = evaluateOtpAttempt({...base, providedHash: "a".repeat(64), attempts: 4});
  assert.deepEqual(verdict, {outcome: "ok", nextAttempts: 4, lock: false});
});

test("otp: wrong code increments the count", () => {
  const verdict = evaluateOtpAttempt({...base, providedHash: "b".repeat(64), attempts: 0});
  assert.deepEqual(verdict, {outcome: "wrong", nextAttempts: 1, lock: false});
});

test("otp: the attempt that reaches the max locks the challenge", () => {
  const verdict = evaluateOtpAttempt({...base, providedHash: "b".repeat(64), attempts: 4});
  assert.deepEqual(verdict, {outcome: "wrong", nextAttempts: 5, lock: true});
});

test("otp: a locked challenge stays locked even with the right code", () => {
  assert.equal(evaluateOtpAttempt({...base, providedHash: "a".repeat(64), attempts: 5}).outcome, "locked");
  assert.equal(evaluateOtpAttempt({...base, providedHash: "a".repeat(64), attempts: 0, locked: true}).outcome, "locked");
});

test("otp: five wrong guesses then the right code is refused", () => {
  let attempts = 0;
  let locked = false;
  for (let i = 0; i < 5; i += 1) {
    const verdict = evaluateOtpAttempt({...base, providedHash: `${i}`.padStart(64, "0"), attempts, locked});
    assert.equal(verdict.outcome, "wrong");
    attempts = verdict.nextAttempts;
    locked = verdict.lock;
  }
  assert.equal(locked, true);
  assert.equal(evaluateOtpAttempt({...base, providedHash: "a".repeat(64), attempts, locked}).outcome, "locked");
});

test("otp: expired and consumed challenges are refused", () => {
  assert.equal(evaluateOtpAttempt({...base, providedHash: "a".repeat(64), expiresAtMs: NOW - 1}).outcome, "expired");
  assert.equal(evaluateOtpAttempt({...base, providedHash: "a".repeat(64), consumed: true}).outcome, "consumed");
  assert.equal(evaluateOtpAttempt({...base, storedHash: "", providedHash: ""}).outcome, "consumed", "a challenge without a hash is unusable");
});

test("otp: different-length hashes are a wrong code, not a crash", () => {
  assert.equal(evaluateOtpAttempt({...base, providedHash: "a"}).outcome, "wrong");
});

/* ---------- source assertions ---------- */

test("assertSuperAdmin trusts claims / server email list only", () => {
  const sos2fa = read("sos2fa-functions.js");
  const body = bracedBlock(sos2fa, "async function assertSuperAdmin(");
  assert.match(body, /isServerAdminAuth\(request\.auth\)/);
  assert.doesNotMatch(body, /collection\("users"\)|profile|\.superAdmin ===/);
  assert.doesNotMatch(sos2fa, /profile\?*\.superAdmin/);
  assert.match(sos2fa, /require\("\.\/admin-trust"\)/);
});

test("Master Admin asserts in display-security and ai-discovery ignore user docs", () => {
  ["display-security-functions.js", "ai-discovery-functions.js"].forEach(file => {
    const body = bracedBlock(read(file), "async function assertMasterAdmin(");
    assert.match(body, /isServerAdminAuth\(request\.auth\)/, file);
    assert.doesNotMatch(body, /data\.masterAdmin|roles|collection\("users"\)/, file);
  });
});

test("feature-services privilege checks ignore patron-editable profile fields", () => {
  const fns = read("feature-services-functions.js");
  const profileCheck = bracedBlock(fns, "async function isPrivilegedProfile(");
  assert.doesNotMatch(profileCheck, /\.superAdmin|\.masterAdmin|\.roles|collection\("users"\)/);
  assert.match(profileCheck, /customClaims/);
  const authCheck = bracedBlock(fns, "async function isPrivilegedAuth(");
  assert.match(authCheck, /isServerAdminAuth\(auth\)/);
  assert.doesNotMatch(authCheck, /collection\("users"\)/);
  assert.match(fns, /await isPrivilegedProfile\(targetUid, user\.email\)/);
});

test("assignVenueEmployee and removeVenueEmployee require an SOS2FA session", () => {
  const sos2fa = read("sos2fa-functions.js");
  ["assignVenueEmployee", "removeVenueEmployee"].forEach(name => {
    const body = callableBody(sos2fa, name);
    assert.match(body, /await assertSos2faSession\(request\)/, name);
    assert.doesNotMatch(body, /await assertSuperAdmin\(request\)/, name);
    assert.match(body, /writeEntityManagementAudit\(\{[\s\S]*sessionId\s*\}\)/, name);
  });
});

function transactionCallback(body) {
  const start = body.indexOf("runTransaction(async");
  assert.ok(start >= 0, "missing runTransaction");
  return bracedBlock(body, "async", start);
}

test("verifySos2faCode records failures and throws only after the transaction commits", () => {
  const body = callableBody(read("sos2fa-functions.js"), "verifySos2faCode");
  const tx = transactionCallback(body);
  assert.doesNotMatch(tx, /\bthrow\b/);
  assert.match(tx, /evaluateOtpAttempt\(/);
  assert.match(tx, /attempts: verdict\.nextAttempts/);
  assert.match(tx, /locked: true/);
  const after = body.slice(body.indexOf(tx) + tx.length);
  assert.match(after, /throw new HttpsError\("permission-denied", "Wrong code entered/);
  assert.match(after, /throw new HttpsError\("resource-exhausted"/);
});

test("verifyEmailOtp records failures and throws only after the transaction commits", () => {
  const body = callableBody(read("ai-discovery-functions.js"), "verifyEmailOtp");
  const tx = transactionCallback(body);
  assert.doesNotMatch(tx, /\bthrow\b/);
  assert.match(tx, /evaluateOtpAttempt\(/);
  assert.match(tx, /attempts:result\.nextAttempts/);
  assert.match(tx, /return result;/);
  const after = body.slice(body.indexOf(tx) + tx.length);
  assert.match(after, /throw new HttpsError\("permission-denied", "The email code is incorrect\."\)/);
  assert.match(after, /throw new HttpsError\("resource-exhausted"/);
});

test("feature-gate Super Admin protection reads the Auth record, never users/{uid} fields", () => {
  const fg = read("feature-gate-functions.js");
  assert.match(fg, /require\("\.\/admin-trust"\)/);
  assert.doesNotMatch(fg, /row\.superAdmin|profile\?\.superAdmin|data\.masterAdmin|\(data\.roles/);
  assert.doesNotMatch(fg, /async function assertMasterAdmin\(/);
  const lookup = bracedBlock(fg, "async function isSuperAdminUid(");
  assert.match(lookup, /admin\.auth\(\)\.getUser\(uid\)/);
  assert.match(lookup, /email_verified: record\.emailVerified === true/);
  const protect = bracedBlock(fg, "async function protectSuperAdminEntity(");
  assert.match(protect, /await isSuperAdminUid\(row\.uid\)/);
  assert.equal((fg.match(/await protectSuperAdminEntity\(user,/g) || []).length, 2);
});

test("every Functions Master Admin check goes through admin-trust", () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".js") && !f.endsWith(".test.js"));
  files.forEach(file => {
    const src = read(file);
    assert.doesNotMatch(src, /MASTER_ADMIN_EMAILS\.includes\(/, `${file}: inline admin email check`);
    assert.doesNotMatch(src, /data\.masterAdmin === true|profile\?\.superAdmin === true/, `${file}: trusts a users-doc admin flag`);
    if (src.includes('doc("masterAdmins")')) {
      const fn = (src.match(/async function isMasterAdminAuth\(authContext = \{\}\) \{[\s\S]*?\r?\n\}/) || [""])[0];
      assert.match(fn, /isServerAdminAuth\(authContext\)/, `${file}: admin-trust first`);
      assert.match(fn, /email_verified !== true\) return false/, `${file}: platformSettings list needs a verified email`);
    }
  });
});

test("rules admin email lists require a verified email and match each other", () => {
  const block = (src, name) => bracedBlock(src, `function ${name}(`);
  const fsRules = block(read("../firestore.rules"), "isMasterAdmin");
  const stRules = block(read("../storage.rules"), "isStorageMasterAdmin");
  [fsRules, stRules].forEach(body => {
    assert.match(body, /request\.auth\.token\.get\("email_verified", false\) == true\s*&& request\.auth\.token\.get\("email", ""\) in \[/);
    assert.match(body, /request\.auth\.token\.get\("masterAdmin", false\) == true/);
    assert.doesNotMatch(body, /bands\.don/);
  });
});

test("approvedRoles is not the only signal for member publishing or promoter scheduling", () => {
  const commerce = bracedBlock(read("commerce-functions.js"), "async function canPublishForEntity(entityId, authContext = {})");
  assert.match(commerce, /if \(!wanted\) return false;/, "an unknown role must not match an empty normalized role");
  assert.match(commerce, /clubEmployeeDesignations"\)\.where\("workerUid", "==", uid\)/);
  const scheduling = bracedBlock(read("scheduling-functions.js"), "async function canManageOwner(ownerType, ownerId, authContext = {})");
  assert.doesNotMatch(scheduling, /userSnap\.data\(\)\?\.promoterCompany|approvedRoles/);
  assert.match(scheduling, /row\.promoterCompany/);
});
