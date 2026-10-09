"use strict";

const { describe, test, before, after, beforeEach } = require("node:test");
const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp
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

describe("Master Admin email list requires a verified email", () => {
  beforeEach(() => seed(env, { "users/alice": { displayName: "Alice" } }));

  test("verified owner email can read another patron's profile", async () => {
    await assertSucceeds(getDoc(doc(who.owner.firestore(), "users/alice")));
  });

  test("unverified owner email cannot read another patron's profile", async () => {
    await assertFails(getDoc(doc(who.ownerUnverified.firestore(), "users/alice")));
  });

  test("unverified owner email cannot write aiIndex", async () => {
    await assertFails(setDoc(doc(who.ownerUnverified.firestore(), "aiIndex/x"), { visibility: "public" }));
  });

  test("unverified owner email cannot write platformSettings", async () => {
    await assertFails(setDoc(doc(who.ownerUnverified.firestore(), "platformSettings/patronFeatureGates"), { mingl: false }));
  });

  test("removed typo address (verified) is not a Master Admin", async () => {
    await assertFails(getDoc(doc(who.typo.firestore(), "users/alice")));
    await assertFails(setDoc(doc(who.typo.firestore(), "aiIndex/x"), { visibility: "public" }));
  });

  test("masterAdmin custom claim still grants Master Admin", async () => {
    await assertSucceeds(getDoc(doc(who.claimAdmin.firestore(), "users/alice")));
    await assertSucceeds(setDoc(doc(who.claimAdmin.firestore(), "aiIndex/x"), { visibility: "public" }));
  });
});

describe("aiIndex — patrons cannot write", () => {
  beforeEach(() => seed(env, { "aiIndex/pub1": { visibility: "public", ownerUid: "alice" } }));

  test("alice cannot overwrite an aiIndex entry she owns", async () => {
    await assertFails(updateDoc(doc(who.alice.firestore(), "aiIndex/pub1"), { title: "spam" }));
  });

  test("anonymous cannot create an aiIndex entry", async () => {
    await assertFails(setDoc(doc(who.anon.firestore(), "aiIndex/anon1"), { visibility: "public" }));
  });
});

describe("non-Mingl chatRooms / chatMessages are Master Admin only", () => {
  beforeEach(() => seed(env, {
    "chatRooms/group1": { id: "group1", type: "group", participants: ["alice", "bob"] },
    "chatRooms/legacy1": { id: "legacy1", participants: ["alice", "bob"] },
    "chatMessages/gm1": { roomId: "group1", roomType: "group", senderUid: "alice", body: "hi", participants: ["alice", "bob"] }
  }));

  test("mallory (non-member) cannot read a group room", async () => {
    await assertFails(getDoc(doc(who.mallory.firestore(), "chatRooms/group1")));
  });

  test("mallory cannot read a legacy room with no type", async () => {
    await assertFails(getDoc(doc(who.mallory.firestore(), "chatRooms/legacy1")));
  });

  test("mallory cannot update a group room", async () => {
    await assertFails(updateDoc(doc(who.mallory.firestore(), "chatRooms/group1"), { lastMessage: "x" }));
  });

  test("alice (member) cannot update a non-Mingl room", async () => {
    await assertFails(updateDoc(doc(who.alice.firestore(), "chatRooms/group1"), { participants: ["alice", "mallory"] }));
  });

  test("alice (member) cannot delete a non-Mingl room", async () => {
    await assertFails(deleteDoc(doc(who.alice.firestore(), "chatRooms/group1")));
  });

  test("mallory cannot read a non-Mingl message", async () => {
    await assertFails(getDoc(doc(who.mallory.firestore(), "chatMessages/gm1")));
  });

  test("mallory cannot create a message into a non-Mingl room", async () => {
    await assertFails(addDoc(collection(who.mallory.firestore(), "chatMessages"), {
      roomId: "group1", roomType: "group", senderUid: "mallory", body: "x", participants: ["mallory", "alice"]
    }));
  });

  test("bob (member) cannot edit alice's non-Mingl message", async () => {
    await assertFails(updateDoc(doc(who.bob.firestore(), "chatMessages/gm1"), { body: "edited" }));
  });

  test("bob (member) cannot delete alice's non-Mingl message", async () => {
    await assertFails(deleteDoc(doc(who.bob.firestore(), "chatMessages/gm1")));
  });
});

describe("messages — no client System sender", () => {
  test("alice cannot create a System Message (senderUid system, no requesterUid)", async () => {
    await assertFails(addDoc(collection(who.alice.firestore(), "messages"), {
      senderUid: "system", recipientUid: "bob", body: "Your shift was cancelled"
    }));
  });

  test("anonymous cannot create a System Message", async () => {
    await assertFails(addDoc(collection(who.anon.firestore(), "messages"), {
      senderUid: "system", recipientUid: "bob", body: "x"
    }));
  });
});

describe("minglConnections — participants are fixed", () => {
  beforeEach(() => seed(env, {
    "minglConnections/alice_bob": { participants: ["alice", "bob"], requestedBy: "alice", requestedTo: "bob", status: "pending" }
  }));

  test("alice cannot swap bob out for mallory on her own pending request", async () => {
    await assertFails(updateDoc(doc(who.alice.firestore(), "minglConnections/alice_bob"), {
      participants: ["alice", "mallory"], requestedTo: "mallory"
    }));
  });

  test("mallory cannot create a mutual connection between alice and bob", async () => {
    await assertFails(setDoc(doc(who.mallory.firestore(), "minglConnections/alice_bob2"), {
      participants: ["alice", "bob"], requestedBy: "alice", requestedTo: "bob", status: "mutual"
    }));
  });
});

describe("userBlocks — the blocked patron cannot lift a block", () => {
  beforeEach(() => seed(env, {
    "userBlocks/alice_bob": { participants: ["alice", "bob"], blockedBy: "alice", blockedUid: "bob", active: true }
  }));

  test("bob (blocked) cannot rewrite blockedBy to himself", async () => {
    await assertFails(updateDoc(doc(who.bob.firestore(), "userBlocks/alice_bob"), { blockedBy: "bob", blockedUid: "alice" }));
  });

  test("mallory cannot read the block", async () => {
    await assertFails(getDoc(doc(who.mallory.firestore(), "userBlocks/alice_bob")));
  });
});

describe("suprstrSessions — anonymous and patrons cannot forge sessions", () => {
  const session = (extra = {}) => ({
    status: "waiting", broadcasterUid: "alice", locationId: "club1",
    offer: { type: "offer", sdp: "v=0" }, answer: null, createdAt: Timestamp.now(), ...extra
  });
  beforeEach(() => seed(env, { "suprstrSessions/s1": session() }));

  test("anonymous cannot create a session", async () => {
    await assertFails(setDoc(doc(who.anon.firestore(), "suprstrSessions/s2"), session()));
  });

  test("alice cannot create a session directly (server-only)", async () => {
    await assertFails(setDoc(doc(who.alice.firestore(), "suprstrSessions/s2"), session()));
  });

  test("anonymous cannot delete a session", async () => {
    await assertFails(deleteDoc(doc(who.anon.firestore(), "suprstrSessions/s1")));
  });

  test("anonymous cannot write an oversized answer", async () => {
    await assertFails(updateDoc(doc(who.anon.firestore(), "suprstrSessions/s1"), {
      answer: { type: "answer", sdp: "x".repeat(20001) }, status: "offering", updatedAt: serverTimestamp()
    }));
  });

  test("anonymous cannot write an answer with extra keys", async () => {
    await assertFails(updateDoc(doc(who.anon.firestore(), "suprstrSessions/s1"), {
      answer: { type: "answer", sdp: "v=0", relay: "evil" }, status: "offering", updatedAt: serverTimestamp()
    }));
  });

  test("mallory cannot change broadcasterUid", async () => {
    await assertFails(updateDoc(doc(who.mallory.firestore(), "suprstrSessions/s1"), { broadcasterUid: "mallory" }));
  });
});
