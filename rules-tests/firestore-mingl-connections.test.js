"use strict";

const { describe, test, before, after, beforeEach } = require("node:test");
const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const {
  doc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, serverTimestamp
} = require("firebase/firestore");
const { createEnv, contexts, seed } = require("./helpers");

let env;
let who;

before(async () => {
  env = await createEnv();
  who = contexts(env);
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const connRef = ctx => doc(ctx.firestore(), "minglConnections/alice_bob");
const blockRef = ctx => doc(ctx.firestore(), "userBlocks/alice_bob");

const BASE = { participants: ["alice", "bob"], requestedBy: "alice", requestedTo: "bob" };

describe("minglConnections — create", () => {
  test("alice cannot create a connection directly as mutual", async () => {
    await assertFails(setDoc(connRef(who.alice), { ...BASE, status: "mutual" }));
  });

  test("alice can create a pending request to bob", async () => {
    await assertSucceeds(setDoc(connRef(who.alice), { ...BASE, status: "pending", createdAt: serverTimestamp() }));
  });

  test("alice cannot create a request addressed to herself (requestedTo alice)", async () => {
    await assertFails(setDoc(connRef(who.alice), { ...BASE, requestedTo: "alice", status: "pending" }));
  });

  test("alice cannot create a request claiming requestedBy bob", async () => {
    await assertFails(setDoc(connRef(who.alice), { ...BASE, requestedBy: "bob", requestedTo: "alice", status: "pending" }));
  });

  test("alice cannot create a request whose participants [alice, mallory] disagree with requestedTo bob", async () => {
    await assertFails(setDoc(connRef(who.alice), {
      participants: ["alice", "mallory"],
      requestedBy: "alice",
      requestedTo: "bob",
      status: "pending"
    }));
  });

  test("alice can UnMingl a stranger (create blocked connection, spec fields)", async () => {
    await assertSucceeds(setDoc(connRef(who.alice), {
      participants: ["alice", "bob"],
      connectionId: "alice_bob",
      status: "blocked",
      blockedByUid: "alice"
    }));
  });

  test("alice can UnMingl a stranger (real client shape: floqr-blocks.js merge set)", async () => {
    await assertSucceeds(setDoc(connRef(who.alice), {
      connectionId: "alice_bob",
      participants: ["alice", "bob"],
      status: "blocked",
      blockedByUid: "alice",
      blockedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      userSummaries: {
        alice: { displayName: "Alice", photoURL: "" },
        bob: { displayName: "Bob", photoURL: "" }
      }
    }, { merge: true }));
  });

  test("alice cannot create a blocked connection naming bob as the blocker", async () => {
    await assertFails(setDoc(connRef(who.alice), {
      participants: ["alice", "bob"],
      connectionId: "alice_bob",
      status: "blocked",
      blockedByUid: "bob"
    }));
  });
});

describe("minglConnections — pending request updates", () => {
  beforeEach(() => seed(env, { "minglConnections/alice_bob": { ...BASE, status: "pending" } }));

  test("alice (requester) cannot accept her own request (status mutual)", async () => {
    await assertFails(updateDoc(connRef(who.alice), { status: "mutual", updatedAt: serverTimestamp() }));
  });

  test("bob (recipient) can accept: status mutual + acceptedByUid/acceptedAt/updatedAt", async () => {
    await assertSucceeds(setDoc(connRef(who.bob), {
      status: "mutual",
      acceptedByUid: "bob",
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true }));
  });

  test("bob (recipient) can deny the request", async () => {
    await assertSucceeds(updateDoc(connRef(who.bob), { status: "denied", updatedAt: serverTimestamp() }));
  });

  test("alice (requester) can cancel by setting status denied", async () => {
    await assertSucceeds(updateDoc(connRef(who.alice), { status: "denied", updatedAt: serverTimestamp() }));
  });

  test("mallory cannot update the connection", async () => {
    await assertFails(updateDoc(connRef(who.mallory), { status: "denied", updatedAt: serverTimestamp() }));
  });

  test("bob cannot swap participants to [bob, mallory]", async () => {
    await assertFails(updateDoc(connRef(who.bob), { participants: ["bob", "mallory"], status: "mutual" }));
  });

  test("bob cannot rewrite requestedBy to bob while pending", async () => {
    await assertFails(updateDoc(connRef(who.bob), { requestedBy: "bob", requestedTo: "alice" }));
  });

  test("participant order swap [bob, alice] is fine on an otherwise allowed accept (set equality)", async () => {
    await assertSucceeds(updateDoc(connRef(who.bob), {
      participants: ["bob", "alice"],
      status: "mutual",
      acceptedByUid: "bob",
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });
});

describe("minglConnections — blocked connection (alice blocked bob)", () => {
  beforeEach(() => seed(env, {
    "minglConnections/alice_bob": { ...BASE, status: "blocked", blockedByUid: "alice" }
  }));

  test("bob (blocked user) cannot set status mutual", async () => {
    await assertFails(updateDoc(connRef(who.bob), { status: "mutual", updatedAt: serverTimestamp() }));
  });

  test("bob (blocked user) cannot set status pending", async () => {
    await assertFails(updateDoc(connRef(who.bob), { status: "pending", updatedAt: serverTimestamp() }));
  });

  test("bob cannot rewrite blockedByUid to bob", async () => {
    await assertFails(updateDoc(connRef(who.bob), { blockedByUid: "bob", updatedAt: serverTimestamp() }));
  });

  test("alice (blocker) can lift the block by setting status denied", async () => {
    await assertSucceeds(updateDoc(connRef(who.alice), { status: "denied", updatedAt: serverTimestamp() }));
  });

  test("alice (blocker) cannot jump straight from blocked to mutual", async () => {
    await assertFails(updateDoc(connRef(who.alice), { status: "mutual", updatedAt: serverTimestamp() }));
  });
});

describe("minglConnections — mutual connection", () => {
  beforeEach(() => seed(env, { "minglConnections/alice_bob": { ...BASE, status: "mutual" } }));

  test("alice can query connections where participants array-contains alice (client list query)", async () => {
    const q = query(collection(who.alice.firestore(), "minglConnections"), where("participants", "array-contains", "alice"));
    await assertSucceeds(getDocs(q));
  });

  test("alice can block bob (status blocked, blockedByUid alice)", async () => {
    await assertSucceeds(updateDoc(connRef(who.alice), {
      status: "blocked",
      blockedByUid: "alice",
      blockedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });

  test("alice cannot block naming bob as blockedByUid", async () => {
    await assertFails(updateDoc(connRef(who.alice), {
      status: "blocked",
      blockedByUid: "bob",
      blockedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });
});

describe("minglConnections — denied connection re-request", () => {
  beforeEach(() => seed(env, { "minglConnections/alice_bob": { ...BASE, status: "denied" } }));

  test("bob can re-request (status pending, requestedBy bob, requestedTo alice)", async () => {
    await assertSucceeds(updateDoc(connRef(who.bob), {
      status: "pending",
      requestedBy: "bob",
      requestedTo: "alice",
      updatedAt: serverTimestamp()
    }));
  });

  test("bob cannot re-request straight to mutual", async () => {
    await assertFails(updateDoc(connRef(who.bob), {
      status: "mutual",
      requestedBy: "bob",
      requestedTo: "alice",
      updatedAt: serverTimestamp()
    }));
  });
});

describe("userBlocks — create", () => {
  test("alice can block bob (spec fields)", async () => {
    await assertSucceeds(setDoc(blockRef(who.alice), {
      participants: ["alice", "bob"],
      blockedBy: "alice",
      blockedUid: "bob",
      active: true
    }));
  });

  test("alice can block bob (real client shape: floqr-blocks.js merge set)", async () => {
    await assertSucceeds(setDoc(blockRef(who.alice), {
      blockId: "alice_bob",
      participants: ["alice", "bob"],
      blockedBy: "alice",
      blockedUid: "bob",
      active: true,
      reason: "unmingl",
      userSummaries: {
        alice: { displayName: "Alice", photoURL: "" },
        bob: { displayName: "Bob", photoURL: "" }
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true }));
  });

  test("bob cannot create a block that claims blockedBy alice", async () => {
    await assertFails(setDoc(blockRef(who.bob), {
      participants: ["alice", "bob"],
      blockedBy: "alice",
      blockedUid: "bob",
      active: true
    }));
  });
});

describe("userBlocks — active block by alice", () => {
  beforeEach(() => seed(env, {
    "userBlocks/alice_bob": { participants: ["alice", "bob"], blockedBy: "alice", blockedUid: "bob", active: true }
  }));

  test("bob can query blocks where participants array-contains bob (floqr-blocks.js list query)", async () => {
    const q = query(collection(who.bob.firestore(), "userBlocks"), where("participants", "array-contains", "bob"));
    await assertSucceeds(getDocs(q));
  });

  test("bob (blocked) cannot deactivate the block", async () => {
    await assertFails(updateDoc(blockRef(who.bob), { active: false, updatedAt: serverTimestamp() }));
  });

  test("bob (blocked) cannot delete the block", async () => {
    await assertFails(deleteDoc(blockRef(who.bob)));
  });

  test("alice (blocker) can unblock (active false, unblockedBy/unblockedAt/updatedAt)", async () => {
    await assertSucceeds(setDoc(blockRef(who.alice), {
      active: false,
      unblockedBy: "alice",
      unblockedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true }));
  });

  test("alice (blocker) can delete the block", async () => {
    await assertSucceeds(deleteDoc(blockRef(who.alice)));
  });
});

describe("userBlocks — inactive block previously set by alice", () => {
  beforeEach(() => seed(env, {
    "userBlocks/alice_bob": { participants: ["alice", "bob"], blockedBy: "alice", blockedUid: "bob", active: false }
  }));

  test("bob can re-block alice on the same pair doc", async () => {
    await assertSucceeds(setDoc(blockRef(who.bob), {
      blockedBy: "bob",
      blockedUid: "alice",
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true }));
  });
});
