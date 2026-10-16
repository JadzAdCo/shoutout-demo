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

describe("aiIndex — server/Master Admin writes only", () => {
  beforeEach(() => seed(env, {
    "aiIndex/pub1": { visibility: "public", ownerUid: "owner", title: "Public venue" }
  }));

  test("alice cannot create an aiIndex entry", async () => {
    await assertFails(setDoc(doc(who.alice.firestore(), "aiIndex/alice1"), { visibility: "public", ownerUid: "alice" }));
  });

  test("alice cannot delete a seeded aiIndex entry", async () => {
    await assertFails(deleteDoc(doc(who.alice.firestore(), "aiIndex/pub1")));
  });

  test("master admin can create an aiIndex entry", async () => {
    await assertSucceeds(setDoc(doc(who.owner.firestore(), "aiIndex/admin1"), { visibility: "public", ownerUid: "owner" }));
  });

  test("anonymous can read a public aiIndex entry", async () => {
    await assertSucceeds(getDoc(doc(who.anon.firestore(), "aiIndex/pub1")));
  });

  test("signed-in alice can read a public aiIndex entry", async () => {
    await assertSucceeds(getDoc(doc(who.alice.firestore(), "aiIndex/pub1")));
  });
});

const OFFER = { type: "offer", sdp: "v=0" };

function waitingSession(extra = {}) {
  return {
    status: "waiting",
    broadcasterUid: "alice",
    locationId: "club1",
    offer: OFFER,
    answer: null,
    createdAt: Timestamp.now(),
    ...extra
  };
}

const sessionRef = ctx => doc(ctx.firestore(), "suprstrSessions/s1");

describe("suprstrSessions — display2 (anonymous) answers once", () => {
  beforeEach(() => seed(env, { "suprstrSessions/s1": waitingSession() }));

  test("anonymous display writes the first answer (answer/status/answeredAt/updatedAt)", async () => {
    await assertSucceeds(updateDoc(sessionRef(who.anon), {
      answer: { type: "answer", sdp: "v=0" },
      status: "offering",
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });

  test("anonymous cannot replace the offer", async () => {
    await assertFails(updateDoc(sessionRef(who.anon), { offer: { type: "offer", sdp: "v=0 hijack" }, updatedAt: serverTimestamp() }));
  });

  test("anonymous cannot add broadcasterUid alongside a valid answer", async () => {
    await assertFails(updateDoc(sessionRef(who.anon), {
      answer: { type: "answer", sdp: "v=0" },
      status: "offering",
      broadcasterUid: "mallory",
      updatedAt: serverTimestamp()
    }));
  });

  test("broadcaster alice can publish a new offer and clear the answer", async () => {
    await assertSucceeds(updateDoc(sessionRef(who.alice), {
      offer: { type: "offer", sdp: "v=0 renegotiated" },
      answer: null,
      status: "offering",
      updatedAt: serverTimestamp()
    }));
  });

  test("anonymous display can add a callee ICE candidate (valid shape, session < 4h old)", async () => {
    await assertSucceeds(addDoc(collection(who.anon.firestore(), "suprstrSessions/s1/calleeCandidates"), {
      candidate: "candidate:1 1 udp 2122260223 192.0.2.1 54321 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0
    }));
  });

  test("anonymous cannot add a callee ICE candidate with extra fields", async () => {
    await assertFails(addDoc(collection(who.anon.firestore(), "suprstrSessions/s1/calleeCandidates"), {
      candidate: "candidate:1 1 udp 2122260223 192.0.2.1 54321 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
      payload: "x".repeat(64)
    }));
  });
});

describe("suprstrSessions — answer is write-once", () => {
  beforeEach(() => seed(env, {
    "suprstrSessions/s1": waitingSession({ status: "offering", answer: { type: "answer", sdp: "old" } })
  }));

  test("anonymous cannot overwrite an existing answer", async () => {
    await assertFails(updateDoc(sessionRef(who.anon), {
      answer: { type: "answer", sdp: "v=0 hijack" },
      status: "offering",
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });

  // While answer is still null, the anonymous first-answer path accepts any caller (broadcaster included),
  // so "broadcaster may not set a non-null answer" is only enforceable once an answer exists.
  test("broadcaster alice cannot replace the existing answer with a different non-null map", async () => {
    await assertFails(updateDoc(sessionRef(who.alice), {
      answer: { type: "answer", sdp: "v=0 forged" },
      status: "offering",
      updatedAt: serverTimestamp()
    }));
  });

  test("broadcaster alice can clear the existing answer while publishing a new offer", async () => {
    await assertSucceeds(updateDoc(sessionRef(who.alice), {
      offer: { type: "offer", sdp: "v=0 renegotiated" },
      answer: null,
      status: "offering",
      updatedAt: serverTimestamp()
    }));
  });
});

describe("Display / kiosk public reads (unchanged behavior)", () => {
  beforeEach(() => seed(env, {
    "clubLocations/club1": { name: "Club One", city: "Washington" },
    "suprstrLive/club1__secondary": { status: "live", sessionId: "s1" },
    "suprstrSessions/s1": waitingSession()
  }));

  test("anonymous can read clubLocations/club1", async () => {
    await assertSucceeds(getDoc(doc(who.anon.firestore(), "clubLocations/club1")));
  });

  test("anonymous can read suprstrLive/club1__secondary", async () => {
    await assertSucceeds(getDoc(doc(who.anon.firestore(), "suprstrLive/club1__secondary")));
  });

  test("anonymous can read suprstrSessions/s1", async () => {
    await assertSucceeds(getDoc(doc(who.anon.firestore(), "suprstrSessions/s1")));
  });

  test("anonymous cannot write suprstrLive", async () => {
    await assertFails(setDoc(doc(who.anon.firestore(), "suprstrLive/club1__secondary"), { status: "idle" }));
  });
});
