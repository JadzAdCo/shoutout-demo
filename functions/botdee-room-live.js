/* Live Room SMARTview join — Functions-write botDeeRooms.
   Shared tab / charge stay off. No client IP. */
"use strict";

const crypto = require("crypto");
const admin = require("firebase-admin");

const COLLECTION = "botDeeRooms";
const MEMBER_CAP = 8;
const TOKEN_BYTES = 16;

function db() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function mintToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function roomRef(roomId) {
  return db().collection(COLLECTION).doc(roomId);
}

function publicRoom(id, row, extra = {}) {
  const members = Array.isArray(row.memberUids) ? row.memberUids.map(uid => text(uid, 80)).filter(Boolean) : [];
  return {
    roomId: text(id, 80),
    hostUid: text(row.hostUid, 80),
    memberUids: members.slice(0, MEMBER_CAP),
    participantCount: Math.min(MEMBER_CAP, members.length || 1),
    participantCap: MEMBER_CAP,
    status: text(row.status, 20) || "open",
    conversationId: text(row.conversationId, 80),
    joinHref: extra.joinHref || "",
    roomsLive: true,
    tabOptIn: false,
    charge: false
  };
}

async function createRoom({hostUid, conversationId, title}) {
  const uid = text(hostUid, 80);
  if (!uid) return {ok: false, error: "missing_host"};
  const token = mintToken();
  const roomId = `br_${crypto.randomBytes(8).toString("hex")}`;
  const now = Date.now();
  const row = {
    hostUid: uid,
    memberUids: [uid],
    joinTokenHash: hashToken(token),
    status: "open",
    conversationId: text(conversationId, 80),
    title: text(title, 80) || "BOT DEE group session",
    createdAtMs: now,
    updatedAtMs: now
  };
  await roomRef(roomId).set(row);
  return {
    ok: true,
    room: publicRoom(roomId, row, {joinHref: `./botdee.html?join=${encodeURIComponent(token)}`}),
    joinToken: token
  };
}

async function joinRoom({uid, token}) {
  const member = text(uid, 80);
  const raw = text(token, 80);
  if (!member || !raw) return {ok: false, error: "missing_join"};
  const tokenHash = hashToken(raw);
  const snap = await db().collection(COLLECTION).where("joinTokenHash", "==", tokenHash).limit(2).get();
  if (snap.empty) return {ok: false, error: "not_found"};
  const doc = snap.docs[0];
  const row = doc.data() || {};
  if (row.status !== "open") return {ok: false, error: "closed"};
  const members = Array.isArray(row.memberUids) ? row.memberUids.slice() : [];
  if (!members.includes(member) && members.length >= MEMBER_CAP) {
    return {ok: false, error: "full"};
  }
  if (!members.includes(member)) members.push(member);
  await doc.ref.set({
    memberUids: members,
    updatedAtMs: Date.now()
  }, {merge: true});
  return {
    ok: true,
    room: publicRoom(doc.id, {...row, memberUids: members})
  };
}

async function loadRoom(roomId) {
  const id = text(roomId, 80);
  if (!id) return null;
  const snap = await roomRef(id).get();
  if (!snap.exists) return null;
  return publicRoom(id, snap.data() || {});
}

async function appendTurn(roomId, uid, role, body) {
  const id = text(roomId, 80);
  const textBody = text(body, 2000);
  if (!id || !textBody) return {ok: false};
  await roomRef(id).collection("turns").add({
    uid: text(uid, 80),
    role: role === "user" ? "user" : "model",
    text: textBody,
    createdAtMs: Date.now()
  });
  return {ok: true};
}

async function loadTurns(roomId, limit = 12) {
  const id = text(roomId, 80);
  if (!id) return [];
  const snap = await roomRef(id).collection("turns")
    .orderBy("createdAtMs", "desc")
    .limit(Math.max(1, Math.min(24, Number(limit) || 12)))
    .get();
  return snap.docs.map(doc => {
    const row = doc.data() || {};
    return {
      role: row.role === "user" ? "user" : "model",
      text: text(row.text, 2000)
    };
  }).reverse();
}

function memberOf(room, uid) {
  if (!room) return false;
  const id = text(uid, 80);
  return room.hostUid === id || (Array.isArray(room.memberUids) && room.memberUids.includes(id));
}

module.exports = {
  COLLECTION,
  MEMBER_CAP,
  hashToken,
  mintToken,
  publicRoom,
  createRoom,
  joinRoom,
  loadRoom,
  appendTurn,
  loadTurns,
  memberOf
};
