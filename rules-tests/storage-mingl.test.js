"use strict";

const { describe, test, before, after, beforeEach } = require("node:test");
const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { ref, uploadBytes, getMetadata, list } = require("firebase/storage");
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
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PNG_META = { contentType: "image/png" };
const ROOM_ID = "mingl_alice_bob";

async function seedRoomAndObjects(objectPaths) {
  await seed(env, {
    [`chatRooms/${ROOM_ID}`]: {
      id: ROOM_ID,
      type: "mingl",
      connectionId: "alice_bob",
      participants: ["alice", "bob"]
    },
    "minglConnections/alice_bob": {
      participants: ["alice", "bob"],
      requestedBy: "alice",
      requestedTo: "bob",
      status: "mutual"
    }
  });
  await env.withSecurityRulesDisabled(async ctx => {
    for (const p of objectPaths) {
      await uploadBytes(ref(ctx.storage(), p), PNG, PNG_META);
    }
  });
}

const objRef = (ctx, p) => ref(ctx.storage(), p);

for (const prefix of ["mingl-chat", "mingl-chat-backgrounds"]) {
  const seeded = `${prefix}/alice/${ROOM_ID}/a.png`;

  describe(`storage ${prefix}/{uid}/{roomId} — read`, () => {
    beforeEach(() => seedRoomAndObjects([seeded]));

    test(`${prefix}: bob (room participant) can read alice's upload`, async () => {
      await assertSucceeds(getMetadata(objRef(who.bob, seeded)));
    });

    test(`${prefix}: alice (owner) can read her upload`, async () => {
      await assertSucceeds(getMetadata(objRef(who.alice, seeded)));
    });

    test(`${prefix}: mallory (not a participant) cannot read alice's upload`, async () => {
      await assertFails(getMetadata(objRef(who.mallory, seeded)));
    });

    test(`${prefix}: anonymous cannot read alice's upload`, async () => {
      await assertFails(getMetadata(objRef(who.anon, seeded)));
    });

    test(`${prefix}: mallory cannot list ${prefix}/alice/`, async () => {
      await assertFails(list(objRef(who.mallory, `${prefix}/alice`)));
    });
  });

  describe(`storage ${prefix}/{uid}/{roomId} — upload`, () => {
    beforeEach(() => seedRoomAndObjects([]));

    test(`${prefix}: alice can upload a small PNG into her own room folder`, async () => {
      await assertSucceeds(uploadBytes(objRef(who.alice, `${prefix}/alice/${ROOM_ID}/b.png`), PNG, PNG_META));
    });

    test(`${prefix}: mallory cannot upload into a room she is not part of (own uid folder)`, async () => {
      await assertFails(uploadBytes(objRef(who.mallory, `${prefix}/mallory/${ROOM_ID}/x.png`), PNG, PNG_META));
    });

    test(`${prefix}: alice cannot upload into bob's uid folder`, async () => {
      await assertFails(uploadBytes(objRef(who.alice, `${prefix}/bob/${ROOM_ID}/c.png`), PNG, PNG_META));
    });

    test(`${prefix}: alice cannot upload a non-image/video content type`, async () => {
      await assertFails(uploadBytes(objRef(who.alice, `${prefix}/alice/${ROOM_ID}/d.txt`), PNG, { contentType: "text/plain" }));
    });
  });
}

describe("storage mingl-chat — Master Admin diagnostics", () => {
  test("master admin can upload a Diagnostics smoke-test image with no room doc", async () => {
    await assertSucceeds(uploadBytes(
      objRef(who.owner, "mingl-chat/owner/diag-run-1/rules-smoke-test.png"),
      PNG,
      PNG_META
    ));
  });
});

describe("storage shoutouts/ — unchanged (documented)", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await uploadBytes(ref(ctx.storage(), "shoutouts/alice/s1.png"), PNG, PNG_META);
    });
  });

  test("any signed-in user (bob) can read shoutouts/alice/*", async () => {
    await assertSucceeds(getMetadata(objRef(who.bob, "shoutouts/alice/s1.png")));
  });

  test("anonymous cannot read shoutouts/alice/*", async () => {
    await assertFails(getMetadata(objRef(who.anon, "shoutouts/alice/s1.png")));
  });
});
