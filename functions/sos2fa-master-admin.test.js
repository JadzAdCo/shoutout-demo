"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {isServerAdminAuth} = require("./admin-trust");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function fakeElement() {
  const classes = new Set(["hidden"]);
  return {
    classList: {
      add: c => classes.add(c),
      remove: c => classes.delete(c),
      contains: c => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c);
        else classes.delete(c);
        return on;
      }
    },
    addEventListener() {},
    querySelectorAll: () => [],
    prepend() {},
    appendChild() {},
    dataset: {},
    textContent: "",
    value: ""
  };
}

function loadClient({currentUser, callables = {}} = {}) {
  const elements = new Map();
  const recovery = fakeElement();
  const calls = [];
  const document = {
    getElementById: id => {
      if (!elements.has(id)) elements.set(id, fakeElement());
      return elements.get(id);
    },
    querySelector: () => null,
    querySelectorAll: selector => (selector === ".sos2fa-recovery" ? [recovery] : []),
    createElement: () => fakeElement(),
    dispatchEvent() {}
  };
  const store = new Map();
  const window = {
    SHOUTOUT_MASTER_ADMIN_EMAILS: ["bans.don@gmail.com", "don.b@jadzholdings.com"],
    SHOUTOUT_SUPER_ADMIN_EMAILS: ["bans.don@gmail.com"]
  };
  const firebase = {
    auth: () => ({currentUser}),
    app: () => ({
      functions: () => ({
        httpsCallable: name => async data => {
          calls.push({name, data});
          return {data: callables[name] || {ok: true}};
        }
      })
    })
  };
  const sandbox = {
    window,
    document,
    firebase,
    sessionStorage: {
      getItem: k => store.get(k) || null,
      setItem: (k, v) => store.set(k, v),
      removeItem: k => store.delete(k)
    },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  };
  vm.runInNewContext(read("sos2fa.js"), sandbox);
  return {api: window.FLOQRSOS2FA, el: id => document.getElementById(id), recovery, calls};
}

const microsoftUser = (overrides = {}) => ({
  uid: "PQjxPJqFTrQ1wfelyFE30DF6t1D2",
  email: "don.b@jadzholdings.com",
  emailVerified: false,
  getIdTokenResult: async () => ({claims: {masterAdmin: true}}),
  ...overrides
});

test("client: masterAdmin / superAdmin claim holders count as Master Admin even with an unverified email", () => {
  const {api} = loadClient();
  const user = microsoftUser();
  assert.equal(api.isMasterAdminUser(user, {masterAdmin: true}), true);
  assert.equal(api.isMasterAdminUser({...user, email: "ops@example.com"}, {superAdmin: true}), true);
  assert.equal(api.isMasterAdminUser(user, {masterAdmin: "true"}), false);
});

test("client: listed email needs email_verified; super-admin list alone is no longer the gate", () => {
  const {api} = loadClient();
  assert.equal(api.isMasterAdminUser(microsoftUser(), {}), false);
  assert.equal(api.isMasterAdminUser(microsoftUser({emailVerified: true}), {}), true);
  assert.equal(api.isMasterAdminUser({uid: "o", email: "bans.don@gmail.com", emailVerified: true}, {}), true);
  assert.equal(api.isMasterAdminUser({uid: "x", email: "someone@example.com", emailVerified: true}, {}), false);
  // Patron-editable profile flags never count.
  assert.equal(api.isMasterAdminUser({uid: "x", email: "someone@example.com", emailVerified: true, superAdmin: true}, {}), false);
});

test("client: requireUnlock reads the token claim and shows the Request SOS2FA Code button to a claim holder", async () => {
  let forced = null;
  const user = microsoftUser({getIdTokenResult: async force => { forced = force; return {claims: {masterAdmin: true}}; }});
  const {api, el, recovery} = loadClient({currentUser: user});
  const unlocked = await api.requireUnlock("entityManagement");
  assert.equal(unlocked, false);
  assert.equal(forced, true, "claims must come from a forced token refresh");
  assert.equal(el("sos2faSendBtn").classList.contains("hidden"), false);
  assert.equal(el("sos2faActions").classList.contains("hidden"), false);
  // Server recovery path refuses unverified emails, so the recovery box stays hidden.
  assert.equal(recovery.classList.contains("hidden"), true);
  assert.equal(api.canUseRecoveryCode(user), false);
});

test("client: a signed-in non-admin keeps the request button hidden", async () => {
  const user = {uid: "p1", email: "patron@example.com", emailVerified: true, getIdTokenResult: async () => ({claims: {}})};
  const {api, el} = loadClient({currentUser: user});
  assert.equal(await api.requireUnlock("entityManagement"), false);
  assert.equal(el("sos2faSendBtn").classList.contains("hidden"), true);
  assert.match(el("sos2faStatus").textContent, /Only a Master Admin/);
});

test("client: claim holder can request a code; recovery is offered only to verified listed emails", async () => {
  const user = microsoftUser();
  const {api, calls, recovery} = loadClient({currentUser: user});
  await api.sendCode();
  assert.deepEqual(calls.map(c => c.name), ["requestSos2faCode"]);
  await assert.rejects(() => api.verifyRecoveryCode(), /limited to the listed Super Admin/);

  const owner = {uid: "o", email: "bans.don@gmail.com", emailVerified: true, getIdTokenResult: async () => ({claims: {}})};
  const ownerClient = loadClient({currentUser: owner});
  await ownerClient.api.requireUnlock("entityManagement");
  assert.equal(ownerClient.recovery.classList.contains("hidden"), false);
  assert.equal(recovery.classList.contains("hidden"), true);
});

test("server: admin-trust accepts a masterAdmin claim with an unverified email, not a bare listed email", () => {
  assert.equal(isServerAdminAuth({token: {masterAdmin: true, email: "don.b@jadzholdings.com", email_verified: false}}), true);
  assert.equal(isServerAdminAuth({token: {email: "don.b@jadzholdings.com", email_verified: false}}), false);
  assert.equal(isServerAdminAuth({token: {email: "don.b@jadzholdings.com", email_verified: true}}), true);
});

test("server: request / verify / session use admin-trust and mail the code to the signed-in token email", () => {
  const src = read("functions/sos2fa-functions.js");
  const body = name => {
    const start = src.indexOf(`exports.${name} = onCall(`);
    assert.ok(start > 0, `${name} must exist`);
    const next = src.indexOf("\nexports.", start + 10);
    return src.slice(start, next > 0 ? next : undefined);
  };
  assert.match(src, /async function assertSuperAdmin\(request\)[\s\S]*?const email = emailOf\(request\.auth\);\s*if \(isServerAdminAuth\(request\.auth\)\) return email;/);
  assert.match(src, /async function assertSos2faSession\(request\) \{\s*const email = await assertSuperAdmin\(request\);/);
  for (const name of ["requestSos2faCode", "verifySos2faCode"]) {
    const fn = body(name);
    assert.match(fn, /const email = await assertSuperAdmin\(request\);/);
    assert.doesNotMatch(fn, /email_verified/, `${name} must not require a verified email beyond admin-trust`);
  }
  assert.match(body("requestSos2faCode"), /sendgridMailSos2fa\(\{to: email, code\}\)/);
  // Break-glass recovery stays limited to listed + verified accounts (design-notes-sos2fa-recovery.mdc).
  assert.match(body("verifySos2faRecoveryCode"), /email_verified !== true/);
});

test("pages load the s3.1.28 SOS2FA client", () => {
  assert.match(read("master-admin.html"), /sos2fa\.js\?v=s3\.1\.28/);
  assert.match(read("seed-v29-09-14.html"), /sos2fa\.js\?v=s3\.1\.28/);
});
