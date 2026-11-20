/* Live Room SMARTview join — Functions-write botDeeRooms.
   Mingl-friends-only invites (session store). Shared tab / charge stay off this module
   (charge: false). Legacy open-join used joinTokenHash; Mingl invites store SHA-256 on
   botDeeRoomInvites only. No client IP. */
"use strict";

const core = require("./botdee-session-core");
const store = require("./botdee-session-store");

const COLLECTION = "botDeeRooms";
const MEMBER_CAP = core.MEMBER_CAP;
const TOKEN_BYTES = core.TOKEN_BYTES;

function hashToken(token) {
  return core.hashInviteToken(token);
}

function mintToken() {
  return core.mintInviteToken();
}

function publicRoom(id, row, extra = {}) {
  return core.publicRoom(id, row, extra);
}

function memberOf(room, uid) {
  return core.isCurrentMember(room, uid);
}

async function createRoom({hostUid, conversationId, title}) {
  return store.createRoom({hostUid, conversationId, title});
}

async function joinRoom({uid, token, roomId}) {
  return store.acceptInvite({uid, token, roomId: roomId || ""});
}

async function loadRoom(roomId) {
  const live = await store.loadRoom(roomId);
  if (!live) return null;
  return publicRoom(live.id, live.data);
}

async function appendTurn(roomId, uid, role, body) {
  return store.appendTurn(roomId, uid, role, body);
}

async function loadTurns(roomId, limit = 12) {
  return store.loadTurns(roomId, limit);
}

async function rotateJoinToken({uid, roomId}) {
  const live = await store.loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (core.text(live.data.hostUid, 80) !== core.text(uid, 80)) return {ok: false, error: "not_host"};
  if (core.text(live.data.status, 20) !== "open") return {ok: false, error: "closed"};
  if (!core.roomIsOpen(live.data)) return {ok: false, error: "closed"};
  return {
    ok: true,
    room: publicRoom(live.id, live.data, {joinHref: ""})
  };
}

async function leaveRoom({uid, roomId}) {
  return store.leaveRoom({uid, roomId});
}

async function endRoom({uid, roomId}) {
  return store.endRoom({uid, roomId});
}

async function kickMember({hostUid, roomId, targetUid, actorEmail, actorRole}) {
  return store.kickMember({hostUid, roomId, targetUid, actorEmail, actorRole});
}

async function resolveKickTarget({roomId, needles}) {
  const live = await store.loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found", hits: []};
  const members = await store.publicMemberList(live.data);
  return {
    ok: true,
    hits: core.matchGuests(members, live.data.hostUid, needles),
    hostUid: core.text(live.data.hostUid, 80),
    room: publicRoom(live.id, live.data)
  };
}

module.exports = {
  COLLECTION,
  MEMBER_CAP,
  TOKEN_BYTES,
  hashToken,
  mintToken,
  publicRoom,
  createRoom,
  joinRoom,
  loadRoom,
  appendTurn,
  loadTurns,
  memberOf,
  rotateJoinToken,
  leaveRoom,
  endRoom,
  kickMember,
  resolveKickTarget
};
