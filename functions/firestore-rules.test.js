"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rulesPath = path.resolve(__dirname, "..", "firestore.rules");
const rules = fs.readFileSync(rulesPath, "utf8");

function blockFor(matchPath) {
  const start = rules.indexOf(`match ${matchPath}`);
  assert.notEqual(start, -1, `Missing Firestore block: ${matchPath}`);
  const brace = rules.indexOf("{", start + "match ".length + matchPath.length);
  let depth = 0;
  for (let index = brace; index < rules.length; index += 1) {
    if (rules[index] === "{") depth += 1;
    if (rules[index] === "}") depth -= 1;
    if (depth === 0) return rules.slice(start, index + 1);
  }
  throw new Error(`Unclosed Firestore block: ${matchPath}`);
}

test("Firestore rules have balanced braces", () => {
  let depth = 0;
  for (const character of rules) {
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    assert.ok(depth >= 0, "Firestore rules contain an unexpected closing brace");
  }
  assert.equal(depth, 0);
});

test("Stripe bindings and webhook claims are backend-only", () => {
  for (const matchPath of ["/stripeConnectAccounts/{id}", "/stripeWebhookEvents/{id}"]) {
    const block = blockFor(matchPath);
    assert.match(block, /allow read, write: if false;/);
  }
});

test("service orders cannot be created or deleted by browser clients", () => {
  const block = blockFor("/serviceOrders/{id}");
  assert.match(block, /allow create, delete: if false;/);
  assert.match(block, /allow read: if isServiceOrderReader\(\);/);
  assert.doesNotMatch(block, /allow read, create, update, delete: if signedIn\(\);/);
});

test("browser-created ShoutOuts use the reviewed Black and White display limits", () => {
  const block = blockFor("/shoutouts/{id}");
  assert.match(block, /allow create: if validPatronShoutoutCreate\(\) \|\| validFreePatronShoutoutCreate\(\);/);
  assert.match(rules, /request\.resource\.data\.template == 'blackwhite'/);
  assert.match(rules, /request\.resource\.data\.maxCharactersPerLine == 15/);
  assert.match(rules, /request\.resource\.data\.screenFormatId == 'led-64x32'/);
  assert.match(rules, /validFreePatronShoutoutCreate/);
});

test("commerce products use seller-scoped creation and updates", () => {
  const block = blockFor("/commerceProducts/{id}");
  assert.match(block, /allow create: if validNewCommerceProduct\(\);/);
  assert.match(block, /allow update: if isCommerceProductUpdate\(\);/);
  assert.doesNotMatch(block, /stripeConnectAccountId/);
});

test("identity and club updates preserve backend Stripe fields", () => {
  assert.match(blockFor("/users/{userId}"), /preservesBackendOnlyIdentityFields\(\)/);
  assert.match(blockFor("/clubLocations/{id}"), /preservesStripeBindingFields\(\)/);
  assert.match(rules, /clubAdminAssignments.*status == "active"/s);
  assert.match(rules, /FLOQR FIRESTORE RULES VERSION: v29\.09\.5-floqr-platform-payments/);
});

test("recommendation moderation is Master Admin controlled", () => {
  const block = blockFor("/shoutoutRecommendations/{id}");
  assert.match(block, /resource\.data\.status == "approved"/);
  assert.match(block, /request\.resource\.data\.status == "pending"/);
  assert.match(block, /allow update, delete: if isMasterAdmin\(\);/);
  assert.doesNotMatch(block, /allow create, read, update, delete: if signedIn\(\);/);
});

test("shared template writes require Master Admin access", () => {
  const block = blockFor("/templates/{id}");
  assert.match(block, /allow write: if isMasterAdmin\(\);/);
});
