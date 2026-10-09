"use strict";

const { describe, test, before, after, beforeEach } = require("node:test");
const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { ref, uploadBytes, getMetadata, deleteObject } = require("firebase/storage");
const { createEnv, contexts, seed } = require("./helpers");

let env;
let who;

before(async () => {
  env = await createEnv({ storage: true });
  who = contexts(env);
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seed(env, {
    "clubLocations/club1": { name: "Club One", adminUids: ["alice"] },
    "clubAdminAssignments/club1_bob": { status: "active" },
    "clubAdminAssignments/club1_mallory": { status: "revoked" }
  });
  await env.withSecurityRulesDisabled(async ctx => {
    await uploadBytes(ref(ctx.storage(), "clubMedia/club1/logo.png"), PNG, PNG_META);
  });
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PNG_META = { contentType: "image/png" };
const objRef = (ctx, p) => ref(ctx.storage(), p);

describe("storage clubMedia/{clubId} — writes by club admins / Master Admin only", () => {
  test("anonymous can read club media (public club pages)", async () => {
    await assertSucceeds(getMetadata(objRef(who.anon, "clubMedia/club1/logo.png")));
  });

  test("alice (adminUids) can upload", async () => {
    await assertSucceeds(uploadBytes(objRef(who.alice, "clubMedia/club1/hero.png"), PNG, PNG_META));
  });

  test("bob (active clubAdminAssignments) can upload", async () => {
    await assertSucceeds(uploadBytes(objRef(who.bob, "clubMedia/club1/gallery.png"), PNG, PNG_META));
  });

  test("mallory (revoked assignment) cannot upload", async () => {
    await assertFails(uploadBytes(objRef(who.mallory, "clubMedia/club1/x.png"), PNG, PNG_META));
  });

  test("mallory cannot overwrite or delete the club logo", async () => {
    await assertFails(uploadBytes(objRef(who.mallory, "clubMedia/club1/logo.png"), PNG, PNG_META));
    await assertFails(deleteObject(objRef(who.mallory, "clubMedia/club1/logo.png")));
  });

  test("anonymous cannot upload", async () => {
    await assertFails(uploadBytes(objRef(who.anon, "clubMedia/club1/y.png"), PNG, PNG_META));
  });

  test("verified owner email (Master Admin) can upload to any club", async () => {
    await assertSucceeds(uploadBytes(objRef(who.owner, "clubMedia/club1/owner.png"), PNG, PNG_META));
  });

  test("unverified owner email is not Master Admin in Storage", async () => {
    await assertFails(uploadBytes(objRef(who.ownerUnverified, "clubMedia/club1/z.png"), PNG, PNG_META));
  });

  test("removed typo address is not Master Admin in Storage", async () => {
    await assertFails(uploadBytes(objRef(who.typo, "clubMedia/club1/t.png"), PNG, PNG_META));
  });

  test("unverified owner email cannot upload Mingl diagnostics media without a room", async () => {
    await assertFails(uploadBytes(objRef(who.ownerUnverified, "mingl-chat/owner-unverified/diag-1/x.png"), PNG, PNG_META));
  });
});
