"use strict";

const { describe, test, before, after, beforeEach } = require("node:test");
const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = require("firebase/firestore");
const { createEnv, contexts, seed } = require("./helpers");

let env;
let who;

before(async () => {
  env = await createEnv();
  who = contexts(env);
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const msgRef = (ctx, id = "dm1") => doc(ctx.firestore(), `messages/${id}`);

describe("messages (direct messages) — create", () => {
  test("alice can send a direct message to bob as herself", async () => {
    await assertSucceeds(setDoc(msgRef(who.alice, "new1"), {
      senderUid: "alice",
      recipientUid: "bob",
      body: "hello bob",
      createdAt: serverTimestamp()
    }));
  });

  test("alice cannot send a message as senderUid system (requesterUid alice)", async () => {
    await assertFails(setDoc(msgRef(who.alice, "sys1"), {
      senderUid: "system",
      requesterUid: "alice",
      recipientUid: "bob",
      body: "Official notice"
    }));
  });

  test("alice cannot send a message as senderUid bob", async () => {
    await assertFails(setDoc(msgRef(who.alice, "spoof1"), {
      senderUid: "bob",
      recipientUid: "alice",
      body: "spoofed"
    }));
  });

  test("anonymous cannot send a direct message", async () => {
    await assertFails(setDoc(msgRef(who.anon, "anon1"), { senderUid: "alice", recipientUid: "bob", body: "x" }));
  });
});

describe("messages (direct messages) — read/update of an existing message", () => {
  beforeEach(() => seed(env, {
    "messages/dm1": {
      senderUid: "alice",
      recipientUid: "bob",
      participants: ["alice", "bob"],
      senderEmail: "alice@example.com",
      body: "x"
    }
  }));

  test("bob (recipient) can read the message", async () => {
    await assertSucceeds(getDoc(msgRef(who.bob)));
  });

  test("mallory cannot read the message", async () => {
    await assertFails(getDoc(msgRef(who.mallory)));
  });

  test("bob can mark the message read", async () => {
    await assertSucceeds(updateDoc(msgRef(who.bob), { read: true }));
  });

  test("bob cannot change participants to [bob, mallory]", async () => {
    await assertFails(updateDoc(msgRef(who.bob), { participants: ["bob", "mallory"] }));
  });

  test("bob cannot change senderEmail", async () => {
    await assertFails(updateDoc(msgRef(who.bob), { senderEmail: "mallory@example.com" }));
  });

  test("bob cannot change senderUid", async () => {
    await assertFails(updateDoc(msgRef(who.bob), { senderUid: "bob" }));
  });
});
