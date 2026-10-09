"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadSecurityCheck() {
  const source = read("master-admin-app.js");
  const start = source.indexOf("function getProviderIds(");
  const end = source.indexOf("function simpleRows(");
  assert.ok(start > 0 && end > start, "security check block must exist in master-admin-app.js");
  const sandbox = {
    MASTER_ADMIN_EMAILS: ["bans.don@gmail.com", "don.b@jadzholdings.com"],
    ALLOWED_PROVIDERS: ["google.com", "microsoft.com"],
    ENFORCE_DOMAINS: false,
    ALLOWED_DOMAINS: ["jadzadco.com", "jadzholdings.com"],
    TEMPORARY_EXCEPTION_EMAILS: [],
    REQUIRE_VERIFIED_EMAIL: true,
    safeUser: user => (user?.email || user?.phoneNumber || "unknown").toLowerCase()
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.masterSecurityCheck = masterSecurityCheck;`, sandbox);
  return sandbox.masterSecurityCheck;
}

const microsoftUser = (email, emailVerified) => ({
  email,
  emailVerified,
  providerData: [{providerId: "microsoft.com"}]
});

test("masterAdmin claim admits a Microsoft account whose IdP reports email_verified=false", () => {
  const check = loadSecurityCheck();
  const result = check(microsoftUser("don.b@jadzholdings.com", false), {masterAdmin: true});
  assert.equal(result.ok, true, result.reason);
});

test("superAdmin claim is also honored", () => {
  const check = loadSecurityCheck();
  assert.equal(check(microsoftUser("ops@example.com", false), {superAdmin: true}).ok, true);
});

test("listed email without a claim still requires a verified email", () => {
  const check = loadSecurityCheck();
  const denied = check(microsoftUser("don.b@jadzholdings.com", false), {});
  assert.equal(denied.ok, false);
  assert.match(denied.reason, /verified/);
  assert.equal(check(microsoftUser("don.b@jadzholdings.com", true), {}).ok, true);
});

test("only a boolean true claim counts and the provider rule still applies", () => {
  const check = loadSecurityCheck();
  assert.equal(check(microsoftUser("ops@example.com", false), {masterAdmin: "true"}).ok, false);
  assert.equal(check(microsoftUser("ops@example.com", true), undefined).ok, false);
  const passwordUser = {email: "ops@example.com", emailVerified: false, providerData: [{providerId: "password"}]};
  assert.equal(check(passwordUser, {masterAdmin: true}).ok, false);
});

test("auth state handler reads token claims before the security check", () => {
  const source = read("master-admin-app.js");
  assert.match(source, /getIdTokenResult\(true\)/);
  assert.match(source, /masterSecurityCheck\(user, claims\)/);
  assert.match(read("master-admin.html"), /master-admin-app\.js\?v=s3\.1\.27/);
});
