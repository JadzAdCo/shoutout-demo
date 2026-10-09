"use strict";

const { describe, test, before, after, beforeEach } = require("node:test");
const { assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp
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

const ROOM_ID = "mingl_alice_bob";

const MUTUAL_CONNECTION = {
  participants: ["alice", "bob"],
  requestedBy: "alice",
  requestedTo: "bob",
  status: "mutual"
};

const ROOM = {
  id: ROOM_ID,
  type: "mingl",
  connectionId: "alice_bob",
  participants: ["alice", "bob"]
};

const MESSAGE = {
  roomId: ROOM_ID,
  roomType: "mingl",
  participants: ["alice", "bob"],
  senderUid: "alice",
  body: "hi"
};

async function seedMinglRoom(extra = {}) {
  await seed(env, {
    "minglConnections/alice_bob": MUTUAL_CONNECTION,
    [`chatRooms/${ROOM_ID}`]: ROOM,
    ...extra
  });
}

const roomRef = ctx => doc(ctx.firestore(), `chatRooms/${ROOM_ID}`);
const msgRef = (ctx, id = "m1") => doc(ctx.firestore(), `chatMessages/${id}`);

describe("chatRooms — read", () => {
  beforeEach(() => seedMinglRoom());

  test("mallory (not a participant) cannot read the Mingl room", async () => {
    await assertFails(getDoc(roomRef(who.mallory)));
  });

  test("alice (participant) can read the Mingl room", async () => {
    await assertSucceeds(getDoc(roomRef(who.alice)));
  });

  test("master admin can read any room", async () => {
    await assertSucceeds(getDoc(roomRef(who.owner)));
  });

  test("anonymous cannot read the Mingl room", async () => {
    await assertFails(getDoc(roomRef(who.anon)));
  });

  test("alice can query rooms where participants array-contains alice", async () => {
    const q = query(collection(who.alice.firestore(), "chatRooms"), where("participants", "array-contains", "alice"));
    await assertSucceeds(getDocs(q));
  });
});

describe("chatRooms — create", () => {
  beforeEach(() => seedMinglRoom({
    "minglConnections/alice_mallory": {
      participants: ["alice", "mallory"],
      requestedBy: "alice",
      requestedTo: "mallory",
      status: "pending"
    }
  }));

  test("mallory cannot create a non-Mingl room with no type", async () => {
    await assertFails(setDoc(doc(who.mallory.firestore(), "chatRooms/free_room"), {
      name: "free room",
      participants: ["mallory"]
    }));
  });

  test("mallory cannot create a room with type group", async () => {
    await assertFails(setDoc(doc(who.mallory.firestore(), "chatRooms/group_room"), {
      type: "group",
      participants: ["mallory", "alice"]
    }));
  });

  test("alice cannot create a Mingl room for a non-mutual (pending) connection", async () => {
    await assertFails(setDoc(doc(who.alice.firestore(), "chatRooms/mingl_alice_bob2"), {
      id: "mingl_alice_bob2",
      type: "mingl",
      connectionId: "alice_mallory",
      participants: ["alice", "mallory"]
    }));
  });

  test("alice cannot create a Mingl room that names a connection she is not mutual on (no connection doc)", async () => {
    await assertFails(setDoc(doc(who.alice.firestore(), "chatRooms/mingl_alice_ghost"), {
      id: "mingl_alice_ghost",
      type: "mingl",
      connectionId: "alice_ghost",
      participants: ["alice", "ghost"]
    }));
  });
});

describe("chatRooms — create control (extra: proves create is not denied wholesale)", () => {
  beforeEach(() => seed(env, { "minglConnections/alice_bob": MUTUAL_CONNECTION }));

  test("alice can create the Mingl room for her mutual connection", async () => {
    await assertSucceeds(setDoc(doc(who.alice.firestore(), `chatRooms/${ROOM_ID}`), {
      ...ROOM,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });
});

describe("chatRooms — update", () => {
  beforeEach(() => seedMinglRoom());

  test("alice cannot change participants to [alice, mallory]", async () => {
    await assertFails(updateDoc(roomRef(who.alice), { participants: ["alice", "mallory"] }));
  });

  test("alice cannot change room type to group", async () => {
    await assertFails(updateDoc(roomRef(who.alice), { type: "group" }));
  });

  test("alice cannot change connectionId", async () => {
    await assertFails(updateDoc(roomRef(who.alice), { connectionId: "alice_mallory" }));
  });

  test("alice can update lastMessage and updatedAt", async () => {
    await assertSucceeds(updateDoc(roomRef(who.alice), { lastMessage: "hello", updatedAt: serverTimestamp() }));
  });

  test("mallory cannot update the Mingl room", async () => {
    await assertFails(updateDoc(roomRef(who.mallory), { lastMessage: "pwned", updatedAt: serverTimestamp() }));
  });
});

describe("chatMessages — read", () => {
  beforeEach(() => seedMinglRoom({ "chatMessages/m1": MESSAGE }));

  test("mallory cannot read a Mingl message", async () => {
    await assertFails(getDoc(msgRef(who.mallory)));
  });

  test("bob (participant) can read the Mingl message", async () => {
    await assertSucceeds(getDoc(msgRef(who.bob)));
  });

  test("bob can query room messages filtered by roomId + participants array-contains bob", async () => {
    const q = query(
      collection(who.bob.firestore(), "chatMessages"),
      where("roomId", "==", ROOM_ID),
      where("participants", "array-contains", "bob")
    );
    await assertSucceeds(getDocs(q));
  });
});

describe("chatMessages — create", () => {
  beforeEach(() => seedMinglRoom());

  test("mallory cannot create a message without roomType into the Mingl room", async () => {
    await assertFails(setDoc(msgRef(who.mallory, "evil1"), {
      roomId: ROOM_ID,
      participants: ["alice", "bob"],
      senderUid: "alice",
      body: "injected"
    }));
  });

  test("bob cannot create a message spoofing senderUid alice", async () => {
    await assertFails(setDoc(msgRef(who.bob, "spoof1"), {
      roomId: ROOM_ID,
      roomType: "mingl",
      participants: ["alice", "bob"],
      senderUid: "alice",
      body: "spoofed"
    }));
  });

  test("bob can create his own Mingl message in the room", async () => {
    await assertSucceeds(setDoc(msgRef(who.bob, "ok1"), {
      roomId: ROOM_ID,
      roomType: "mingl",
      participants: ["alice", "bob"],
      senderUid: "bob",
      body: "hey alice",
      createdAt: serverTimestamp()
    }));
  });

  test("bob cannot create a message whose participants ([bob, mallory]) differ from the room", async () => {
    await assertFails(setDoc(msgRef(who.bob, "leak1"), {
      roomId: ROOM_ID,
      roomType: "mingl",
      participants: ["bob", "mallory"],
      senderUid: "bob",
      body: "leak"
    }));
  });

  test("master admin can create a non-Mingl diagnostic message (optional)", async () => {
    await assertSucceeds(setDoc(msgRef(who.owner, "diag1"), {
      roomId: "diag-room-1",
      senderUid: "owner",
      body: "rules smoke test",
      createdAt: serverTimestamp()
    }));
  });
});

describe("chatMessages — update and delete", () => {
  beforeEach(() => seedMinglRoom({ "chatMessages/m1": MESSAGE }));

  test("bob cannot edit the body of alice's message", async () => {
    await assertFails(updateDoc(msgRef(who.bob), { body: "edited by bob" }));
  });

  test("alice can edit her own message body/edited/editedAt/updatedAt", async () => {
    await assertSucceeds(updateDoc(msgRef(who.alice), {
      body: "hi (edited)",
      edited: true,
      editedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });

  test("alice cannot change roomType on her own message", async () => {
    await assertFails(updateDoc(msgRef(who.alice), { roomType: "x" }));
  });

  test("alice can mark her own message doNotForward", async () => {
    await assertSucceeds(updateDoc(msgRef(who.alice), { doNotForward: true, doNotForwardSetAt: serverTimestamp() }));
  });

  test("alice cannot change senderUid on her own message", async () => {
    await assertFails(updateDoc(msgRef(who.alice), { senderUid: "bob" }));
  });

  test("bob can write a read receipt (readBy/readAtBy/updatedAt) on alice's message", async () => {
    await assertSucceeds(updateDoc(msgRef(who.bob), {
      readBy: { bob: true },
      readAtBy: { bob: serverTimestamp() },
      updatedAt: serverTimestamp()
    }));
  });

  test("bob cannot delete alice's message", async () => {
    await assertFails(deleteDoc(msgRef(who.bob)));
  });

  test("alice can delete her own message", async () => {
    await assertSucceeds(deleteDoc(msgRef(who.alice)));
  });
});
