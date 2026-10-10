"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const core = require("./demo-signin-core");
const {evaluateOtpAttempt} = require("./otp-attempts");

const root = path.join(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const functionsSrc = read("functions/ai-discovery-functions.js");

function sliceExport(name) {
  const start = functionsSrc.indexOf(`exports.${name} = `);
  assert.ok(start >= 0, `${name} export missing`);
  const end = functionsSrc.indexOf("\nexports.", start + 10);
  return functionsSrc.slice(start, end < 0 ? undefined : end);
}

const PEPPER = "test-pepper";
const hashOf = (email, code) => crypto.createHmac("sha256", PEPPER).update(`${email}:${String(code).toUpperCase()}`).digest("hex");

test("demo gate accepts only temp_<role>_<n>@floqr-demo.com with a reason of 8+ characters", () => {
  assert.equal(core.validateDemoSigninRequest({email: "Temp_Waitress_1@floqr-demo.com ", reason: "QA schedule test"}).ok, true);
  assert.equal(core.validateDemoSigninRequest({email: "temp_waitress_1@floqr-demo.com", reason: "QA schedule test"}).email, "temp_waitress_1@floqr-demo.com");
  for (const email of ["bans.don@gmail.com", "temp_waitress_n@floqr-demo.com", "temp_waitress_1@floqr-demo.com.evil.io", "waitress_1@floqr-demo.com", ""]) {
    const verdict = core.validateDemoSigninRequest({email, reason: "QA schedule test"});
    assert.equal(verdict.ok, false, email);
    assert.equal(verdict.code, "demo-only", email);
  }
  const short = core.validateDemoSigninRequest({email: "temp_dj_2@floqr-demo.com", reason: " short "});
  assert.equal(short.ok, false);
  assert.equal(short.code, "reason");
});

test("challenge id is sha256(email) hex — the same id the Welcome card derives", () => {
  const email = "temp_waitress_1@floqr-demo.com";
  assert.equal(core.emailOtpChallengeId(email), crypto.createHash("sha256").update(email).digest("hex"));
  assert.match(core.emailOtpChallengeId(email), /^[0-9a-f]{64}$/);
});

test("admin-issued challenge has the requestEmailOtp shape plus audit-only extras", () => {
  const base = core.emailOtpChallengeRecord({email: "a@b.co", codeHash: "h", requestedAt: "R", expiresAt: "E"});
  assert.deepEqual(Object.keys(base).sort(), ["attempts", "codeHash", "email", "expiresAt", "requestedAt", "used"]);
  assert.equal(base.attempts, 0);
  assert.equal(base.used, false);
  const demo = core.emailOtpChallengeRecord({
    email: "temp_bottle_3@floqr-demo.com", codeHash: "h", requestedAt: "R", expiresAt: "E",
    extra: core.demoChallengeExtra({actorUid: "uid1", nowMs: 1000})
  });
  for (const key of Object.keys(base)) assert.ok(key in demo, key);
  assert.equal(demo.source, core.DEMO_SIGNIN_PURPOSE);
  assert.equal(demo.expiresAtMs, 1000 + core.DEMO_SIGNIN_TTL_MS);
  assert.equal(core.DEMO_SIGNIN_TTL_MS, 10 * 60 * 1000);
  assert.ok(!JSON.stringify(demo).includes("code\":"), "no plain code field");
});

test("verifyEmailOtp's attempt logic accepts the issued code once and locks after 5 wrong tries", () => {
  const email = "temp_waitress_1@floqr-demo.com";
  const code = "ABCD2345";
  const record = core.emailOtpChallengeRecord({email, codeHash: hashOf(email, code), requestedAt: 0, expiresAt: 0});
  const nowMs = 5000;
  const expiresAtMs = nowMs + core.DEMO_SIGNIN_TTL_MS;
  const ok = evaluateOtpAttempt({storedHash: record.codeHash, providedHash: hashOf(email, code.toLowerCase()), attempts: record.attempts, maxAttempts: 5, expiresAtMs, nowMs, consumed: record.used});
  assert.equal(ok.outcome, "ok");
  let attempts = 0;
  let last;
  for (let i = 0; i < 5; i += 1) {
    last = evaluateOtpAttempt({storedHash: record.codeHash, providedHash: hashOf(email, "ZZZZ2222"), attempts, maxAttempts: 5, expiresAtMs, nowMs});
    attempts = last.nextAttempts;
  }
  assert.equal(last.lock, true);
  assert.equal(evaluateOtpAttempt({storedHash: record.codeHash, providedHash: hashOf(email, code), attempts, maxAttempts: 5, expiresAtMs, nowMs, locked: true}).outcome, "locked");
  assert.equal(evaluateOtpAttempt({storedHash: record.codeHash, providedHash: hashOf(email, code), attempts: 0, expiresAtMs: nowMs - 1, nowMs}).outcome, "expired");
});

test("a live admin-issued code blocks a Welcome-card resend; used, locked, expired or normal codes do not", () => {
  const nowMs = 10_000;
  const live = {source: core.DEMO_SIGNIN_PURPOSE, used: false, expiresAt: {toMillis: () => nowMs + 1}};
  assert.equal(core.adminIssuedChallengeActive(live, nowMs), true);
  assert.equal(core.adminIssuedChallengeActive({...live, used: true}, nowMs), false);
  assert.equal(core.adminIssuedChallengeActive({...live, locked: true}, nowMs), false);
  assert.equal(core.adminIssuedChallengeActive({...live, expiresAt: {toMillis: () => nowMs - 1}}, nowMs), false);
  assert.equal(core.adminIssuedChallengeActive({used: false, expiresAt: {toMillis: () => nowMs + 1}}, nowMs), false);
  assert.equal(core.adminIssuedChallengeActive(null, nowMs), false);
});

test("mail log row records the issue without a code or body", () => {
  const row = core.demoSigninMailLogRow({email: "temp_dj_1@floqr-demo.com", actorUid: "u", actorEmail: "Bans.Don@gmail.com", nowMs: 1});
  assert.equal(row.kind, "email-otp");
  assert.equal(row.purpose, "demo-signin-code");
  assert.equal(row.extra.purpose, "demo-signin-code");
  assert.equal(row.textBody, "");
  assert.equal(row.htmlBody, "");
  assert.deepEqual(row.to, []);
  assert.equal(row.sendOk, false);
  assert.equal(row.extra.issuedByEmail, "bans.don@gmail.com");
  assert.ok(!/code"\s*:/.test(JSON.stringify(row)));
});

test("issueDemoSignInCode: Master Admin + SOS2FA first, demo-only gate, same challenge record, chained audit, code never logged", () => {
  const body = sliceExport("issueDemoSignInCode");
  assert.match(body, /onCall\(\{region:"us-central1", secrets:\[EMAIL_OTP_PEPPER\]/);
  const gate = body.indexOf("await assertSos2faSession(request)");
  assert.ok(gate > 0, "SOS2FA session (which runs admin-trust isServerAdminAuth) is required");
  assert.ok(gate < body.indexOf("validateDemoSigninRequest"), "auth gate runs before input handling");
  assert.ok(gate < body.indexOf("createOtpCode()"), "no code is minted before the gate");
  assert.match(body, /eventType:"demo\.signin_code_issued"/);
  assert.match(body, /target:\{type:"demoAccount", id:email\}/);
  assert.match(body, /appendDemoSigninChainedAudit\(tx, headRef, headSnap/);
  assert.match(body, /demoSignin\.emailOtpChallengeRecord\(\{/);
  assert.match(body, /codeHash,/);
  assert.match(body, /otpHash\(email, code\)/);
  assert.match(body, /demoSignin\.emailOtpChallengeId\(email\)/);
  assert.match(body, /return \{email, code, expiresAtMs/);
  const uses = body.replace(/"[^"\n]*"/g, "\"\"").match(/(?<![.\w])code\b(?!:)/g) || [];
  assert.equal(uses.length, 3, "code: minted, hashed, returned — nothing else");
  assert.doesNotMatch(body, /console\.[a-z]+\([^)]*\bcode\b/);
  assert.match(functionsSrc, /eventType:"demo\.signin_code_denied", outcome:"denied"/);
  assert.match(functionsSrc, /chained:false/);
  assert.match(functionsSrc, /const featureAudit = require\("\.\/feature-services-core"\)/);
});

test("requestEmailOtp writes the shared record and will not overwrite a live admin-issued code", () => {
  const body = sliceExport("requestEmailOtp");
  assert.match(body, /demoSignin\.emailOtpChallengeId\(email\)/);
  assert.match(body, /demoSignin\.emailOtpChallengeRecord\(\{/);
  assert.ok(body.indexOf("adminIssuedChallengeActive(previousData)") < body.indexOf("createOtpCode()"));
  assert.ok(body.indexOf("ref.set(") < body.indexOf("sendEmailOtp(email, code)"));
});

test("verifyEmailOtp is unchanged: attempt count commits before any throw (s3.1.26)", () => {
  const body = sliceExport("verifyEmailOtp");
  const txStart = body.indexOf("const verdict = await db.runTransaction");
  const txEnd = body.indexOf("});\n  const outcome = verdict");
  assert.ok(txStart > 0 && txEnd > txStart);
  assert.doesNotMatch(body.slice(txStart, txEnd), /throw /);
  assert.match(body, /maxAttempts:5/);
  assert.match(body, /emailOtpChallenges/);
});

test("Welcome card: I already have a code verifies without sending email", () => {
  const html = read("index.html");
  assert.match(html, /id="emailOtpHaveCodeBtn" type="button" data-i18n="app\.emailHaveCode">I already have a code<\/button>/);
  const app = read("patron-app.js");
  assert.match(app, /bind\("emailOtpHaveCodeBtn", useExistingEmailOtpCode\)/);
  const helper = app.slice(app.indexOf("function useExistingEmailOtpCode()"), app.indexOf("async function verifyEmailOtp()"));
  assert.doesNotMatch(helper, /requestEmailOtp|httpsCallable/);
  const verify = app.slice(app.indexOf("async function verifyEmailOtp()"), app.indexOf("async function logout()"));
  assert.match(verify, /await emailOtpChallengeIdFor\(email\)/);
  assert.match(verify, /httpsCallable\("verifyEmailOtp"\)\(\{email, code, challengeId\}\)/);
  assert.match(app, /crypto\.subtle\.digest\("SHA-256", new TextEncoder\(\)\.encode\(email\)\)/);
});

test("Welcome-card code strings exist in all 11 chrome packs", () => {
  const src = read("floqr-i18n.js");
  for (const key of ["app.emailHaveCode", "app.emailHaveCodeHint", "app.emailHaveCodeNeedEmail"]) {
    const count = (src.match(new RegExp(`"${key.replace(/\./g, "\\.")}":`, "g")) || []).length;
    assert.equal(count, 11, key);
  }
});

test("demo-signin.html is a Master Admin satellite with SOS2FA and help beside the heading", () => {
  const html = read("demo-signin.html");
  assert.match(html, /href="\.\/floqr-reason-prompt\.css\?v=/);
  assert.doesNotMatch(html, /id="demoReason"|placeholder="Why/, "reason is asked after Generate, never a standing input");
  const order = ["firebase-config.js", "floqr-session-shell.js", "sos2fa.js", "floqai-help-repository.js", "help-attach.js", "floqr-reason-prompt.js", "demo-signin.js"]
    .map(file => html.indexOf(`src="./${file}?v=`));
  order.forEach((at, i) => assert.ok(at > 0 && (i === 0 || at > order[i - 1]), `script order ${i}`));
  assert.match(html, /data-floqr-auth-chrome/);
  assert.match(html, /data-floqr-help-id="help-master-demo-signin"/);
  assert.match(html, /class="sos2fa-recovery hidden"/);
  assert.doesNotMatch(html, /display2?\.html\?location=/);
  const js = read("demo-signin.js");
  assert.match(js, /FLOQRSessionShell\.bind\(/);
  assert.match(js, /isMasterAdminUser\(user, claims\)/);
  assert.match(js, /httpsCallable\("issueDemoSignInCode"\)\(\{email, reason, sos2faSessionId\}\)/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|console\.log/);
  assert.match(js, /FLOQRReasonPrompt[\s\S]*prompt\.ask\(\{summary: `Demo sign-in code for \$\{email\}`, minLength: MIN_REASON/);
  assert.doesNotMatch(js, /window\.prompt|[^.\w]prompt\(/);
  assert.ok(js.indexOf("await askReason(email)") < js.indexOf("httpsCallable(\"issueDemoSignInCode\")"));
});

test("FloqAi help entry is Master Admin only and classified", () => {
  const win = {FLOQRNav: {appVersion: "t"}, location: {href: "https://x/", pathname: "/"}, localStorage: {getItem() { return null; }, setItem() {}}, navigator: {language: "en"}, addEventListener() {}, document: null, URLSearchParams, URL, console, setTimeout};
  win.window = win;
  vm.runInContext(read("floqai-help-repository.js"), vm.createContext(win));
  const entry = win.FLOQRHelpRepository.entries().find(row => row.id === "help-master-demo-signin");
  assert.ok(entry);
  assert.deepEqual([...entry.audiences], ["masterAdmin"]);
  assert.doesNotMatch(entry.body, /sha256|challenge|EMAIL_OTP_PEPPER|design note/i);
  const classes = JSON.parse(read("functions/floqai-content-classes.json"));
  assert.deepEqual(classes.help["help-master-demo-signin"], ["masterAdmin"]);
});
