"use strict";

const { describe, test, before, after, beforeEach } = require("node:test");
const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteField } = require("firebase/firestore");
const { createEnv, contexts, seed } = require("./helpers");

let env;
let who;

before(async () => {
  env = await createEnv();
  who = contexts(env);
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const aliceDoc = () => doc(who.alice.firestore(), "users/alice");

describe("users/{uid} — create", () => {
  test("alice creates her own profile with normal fields", async () => {
    await assertSucceeds(setDoc(aliceDoc(), { displayName: "Alice", uiLanguage: "en" }));
  });

  test("alice cannot create her profile with superAdmin: true", async () => {
    await assertFails(setDoc(aliceDoc(), { displayName: "Alice", superAdmin: true }));
  });

  test("alice cannot create bob's profile", async () => {
    await assertFails(setDoc(doc(who.alice.firestore(), "users/bob"), { displayName: "Bob" }));
  });
});

describe("users/{uid} — privileged fields are backend-only on update", () => {
  beforeEach(async () => {
    await seed(env, { "users/alice": { displayName: "Alice", uiLanguage: "en" } });
  });

  const privileged = [
    ["superAdmin: true", { superAdmin: true }],
    ["masterAdmin: true", { masterAdmin: true }],
    ["roles: [masterAdmin]", { roles: ["masterAdmin"] }],
    ["approvedRoles: [clubAdmin]", { approvedRoles: ["clubAdmin"] }],
    ["IsBetaTester: 1", { IsBetaTester: 1 }],
    ["stripeConnectAccountId", { stripeConnectAccountId: "acct_fake123" }]
  ];
  for (const [label, patch] of privileged) {
    test(`alice cannot add ${label} to her own profile`, async () => {
      await assertFails(updateDoc(aliceDoc(), patch));
    });
  }

  test("alice can edit displayName, bio and uiLanguage", async () => {
    await assertSucceeds(updateDoc(aliceDoc(), { displayName: "Alice B", bio: "Hi", uiLanguage: "fr" }));
  });

  test("alice can read her own profile", async () => {
    await assertSucceeds(getDoc(aliceDoc()));
  });

  test("bob cannot read alice's profile", async () => {
    await assertFails(getDoc(doc(who.bob.firestore(), "users/alice")));
  });

  test("master admin can read alice's profile", async () => {
    await assertSucceeds(getDoc(doc(who.owner.firestore(), "users/alice")));
  });
});

describe("users/{uid} — existing server-granted approvedRoles", () => {
  beforeEach(async () => {
    await seed(env, { "users/alice": { displayName: "Alice", uiLanguage: "en", approvedRoles: ["Barman"] } });
  });

  test("alice merge-edits displayName only and keeps approvedRoles", async () => {
    await assertSucceeds(setDoc(aliceDoc(), { displayName: "Alice Updated" }, { merge: true }));
  });

  test("alice cannot remove approvedRoles with deleteField()", async () => {
    await assertFails(updateDoc(aliceDoc(), { approvedRoles: deleteField() }));
  });

  test("alice cannot drop approvedRoles via a full (non-merge) set", async () => {
    await assertFails(setDoc(aliceDoc(), { displayName: "Alice", uiLanguage: "en" }));
  });

  test("alice cannot change approvedRoles", async () => {
    await assertFails(updateDoc(aliceDoc(), { approvedRoles: ["Barman", "clubAdmin"] }));
  });
});
