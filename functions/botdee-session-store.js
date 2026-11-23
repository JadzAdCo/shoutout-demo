/* Firestore I/O for BOT DEE Mingl sessions. Functions-write. No client IP. */
"use strict";

const admin = require("firebase-admin");
const core = require("./botdee-session-core");
const dc = require("./data-classification-core");

const JOB = "botDeeSession";

function db() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

function systemCollection(name) {
  dc.systemJob(JOB, name);
  return db().collection(name);
}

function FieldValue() {
  return admin.firestore.FieldValue;
}

function roomRef(roomId) {
  return systemCollection("botDeeRooms").doc(core.text(roomId, 80));
}

function memberRef(roomId, uid) {
  return systemCollection("botDeeRoomMembers").doc(core.memberDocId(roomId, uid));
}

function inviteRef(inviteId) {
  return systemCollection("botDeeRoomInvites").doc(core.text(inviteId, 80));
}

function tabRef(roomId) {
  return systemCollection("botDeeRoomTabs").doc(core.text(roomId, 80));
}

function auditCol() {
  return systemCollection("botDeeRoomAudit");
}

function throttleRef(kind, id) {
  const col = kind === "invite" ? "botDeeRoomInviteThrottle" : "botDeeRoomTurnThrottle";
  return systemCollection(col).doc(core.text(id, 80));
}

async function writeAudit(row) {
  const nowMs = Number(row.nowMs || Date.now());
  await auditCol().add({
    eventType: core.text(row.eventType, 80),
    outcome: core.text(row.outcome || "success", 20),
    actorUid: core.text(row.actorUid, 80),
    actorEmail: core.text(row.actorEmail, 120),
    actorRole: core.text(row.actorRole || "patron", 40),
    targetType: core.text(row.targetType || "botDeeRoom", 40),
    targetId: core.text(row.targetId, 80),
    reason: core.text(row.reason, 80),
    detail: row.detail && typeof row.detail === "object" ? row.detail : {},
    createdAtMs: nowMs,
    createdAtIso: new Date(nowMs).toISOString(),
    createdAt: FieldValue().serverTimestamp()
  });
}

async function loadRoom(roomId) {
  const id = core.text(roomId, 80);
  if (!id) return null;
  const snap = await roomRef(id).get();
  if (!snap.exists) return null;
  return {id: snap.id, data: snap.data() || {}};
}

async function viewerMayReadRoom(live, uid) {
  if (!live) return false;
  if (core.isCurrentMember(live.data, uid)) return true;
  if (core.text(live.data.hostUid, 80) === core.text(uid, 80)) return true;
  const pending = await findPendingInvite({uid, roomId: live.id});
  return !!(pending && pending.exists);
}

async function loadMember(roomId, uid) {
  const snap = await memberRef(roomId, uid).get();
  if (!snap.exists) return null;
  return snap.data() || {};
}

async function isMutualMinglFriend(uidA, uidB) {
  const a = core.text(uidA, 80);
  const b = core.text(uidB, 80);
  if (!a || !b || a === b) return false;
  const id = core.pairId(a, b);
  const snap = await systemCollection("minglConnections").doc(id).get();
  return core.isMutualConnection(snap.exists ? snap.data() : null, a, b);
}

async function isBlockedPair(uidA, uidB) {
  const a = core.text(uidA, 80);
  const b = core.text(uidB, 80);
  if (!a || !b || a === b) return false;
  const id = core.pairId(a, b);
  const [blockSnap, connSnap] = await Promise.all([
    systemCollection("userBlocks").doc(id).get(),
    systemCollection("minglConnections").doc(id).get()
  ]);
  if (core.isBlockedRow(blockSnap.exists ? blockSnap.data() : null, a, b)) return true;
  const conn = connSnap.exists ? connSnap.data() : null;
  return core.text(conn?.status, 20).toLowerCase() === "blocked";
}

async function friendGate(actorUid, targetUid) {
  if (await isBlockedPair(actorUid, targetUid)) return {ok: false, reason: "not_friend"};
  if (!(await isMutualMinglFriend(actorUid, targetUid))) return {ok: false, reason: "not_friend"};
  return {ok: true, reason: ""};
}

async function consumeRate(kind, id, {nowMs, windowMs, max}) {
  const ref = throttleRef(kind, id);
  return db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const verdict = core.rateLimitOk(snap.exists ? snap.data() : {}, {nowMs, windowMs, max});
    if (verdict.ok) {
      tx.set(ref, {
        ...verdict.next,
        updatedAtMs: nowMs
      }, {merge: true});
    }
    return verdict.ok;
  });
}

async function publicMemberList(room) {
  const uids = core.currentMembers(room);
  if (!uids.length) return [];
  const snaps = await db().getAll(...uids.map(uid => systemCollection("users").doc(uid)));
  return snaps.map((snap, index) => core.publicPerson(uids[index], snap.exists ? snap.data() : {}));
}

async function listMinglFriends(uid) {
  const self = core.text(uid, 80);
  const snap = await systemCollection("minglConnections").where("participants", "array-contains", self).limit(500).get();
  const friendUids = [];
  snap.docs.forEach(doc => {
    const row = doc.data() || {};
    if (!core.isMutualConnection(row, self, (row.participants || []).find(id => id !== self))) return;
    const other = (row.participants || []).map(id => core.text(id, 80)).find(id => id && id !== self);
    if (other) friendUids.push(other);
  });
  const unique = [...new Set(friendUids)].slice(0, 80);
  if (!unique.length) return [];
  const blocked = [];
  for (const other of unique) {
    if (await isBlockedPair(self, other)) blocked.push(other);
  }
  const allowed = unique.filter(id => !blocked.includes(id));
  if (!allowed.length) return [];
  const users = await db().getAll(...allowed.map(id => systemCollection("users").doc(id)));
  return users.map((snap, index) => core.publicPerson(allowed[index], snap.exists ? snap.data() : {}));
}

function roomSeed({hostUid, conversationId, title, authorizedTitle, authorizedDescription, now, status, scheduledStartMs, scheduledTimeZone, smartNotification}) {
  const uid = core.text(hostUid, 80);
  const live = status === "open";
  const start = Number(scheduledStartMs || 0) || 0;
  const row = {
    hostUid: uid,
    memberUids: [uid],
    status,
    conversationId: core.text(conversationId, 80),
    title: core.text(title || authorizedTitle, 80) || "BOT DEE group session",
    authorizedTitle: core.text(authorizedTitle || title, 80) || "BOT DEE group session",
    authorizedDescription: core.text(authorizedDescription, 240),
    minglFriendsOnly: true,
    guestsCanInvite: true,
    sharedIntent: core.publicIntent({}),
    scheduledStartMs: status === "scheduled" ? start : 0,
    scheduledTimeZone: status === "scheduled" ? core.text(scheduledTimeZone, 80) : "",
    liveOpenedAtMs: live ? now : 0,
    smartNotification: smartNotification === 1 ? 1 : 0,
    lastPresenceAtMs: live ? now : 0,
    closeReason: "",
    createdAtMs: now,
    updatedAtMs: now,
    expiresAtMs: core.ttlExpiresAtMs({
      liveOpenedAtMs: live ? now : 0,
      scheduledStartMs: status === "scheduled" ? start : 0
    }, now)
  };
  return row;
}

async function createRoom({hostUid, conversationId, title, authorizedTitle, authorizedDescription, nowMs}) {
  const uid = core.text(hostUid, 80);
  if (!uid) return {ok: false, error: "missing_host"};
  const roomId = `br_${cryptoRandom(8)}`;
  const now = Number(nowMs || Date.now());
  const row = roomSeed({
    hostUid: uid,
    conversationId,
    title,
    authorizedTitle,
    authorizedDescription,
    now,
    status: "open",
    smartNotification: 0
  });
  const batch = db().batch();
  batch.set(roomRef(roomId), row);
  batch.set(memberRef(roomId, uid), {
    roomId,
    uid,
    role: "host",
    canInvite: true,
    rsvp: "accepted",
    joinedAtMs: now,
    leftAtMs: null,
    lastPresenceAtMs: now,
    displayName: "",
    handle: ""
  });
  await batch.commit();
  await appendSystemEvent(roomId, uid, `${uid} opened this BOT DEE session.`);
  return {ok: true, room: core.publicRoom(roomId, row)};
}

function cryptoRandom(bytes) {
  return require("crypto").randomBytes(bytes).toString("hex");
}

async function appendSystemEvent(roomId, uid, body) {
  return appendTurn(roomId, uid, "model", body, {system: true});
}

async function appendTurn(roomId, uid, role, body, extra = {}) {
  const id = core.text(roomId, 80);
  const textBody = extra.system ? core.text(body, 2000) : core.stripPrivateSignals(body);
  if (!id || !textBody) return {ok: false};
  const snap = await roomRef(id).get();
  if (!snap.exists) return {ok: false, error: "not_found"};
  const row = snap.data() || {};
  if (!core.roomIsOpen(row)) return {ok: false, error: "closed"};
  const member = core.text(uid, 80);
  if (!core.isCurrentMember(row, member)) return {ok: false, error: "not_member"};
  const payload = {
    uid: member,
    role: role === "user" ? "user" : "model",
    text: textBody,
    system: extra.system === true,
    createdAtMs: Date.now()
  };
  const room = snap.ref;
  await Promise.all([
    room.collection("turns").add(payload),
    room.collection("events").add(payload)
  ]);
  return {ok: true};
}

async function loadTurns(roomId, limit = 12) {
  const id = core.text(roomId, 80);
  if (!id) return [];
  const roomSnap = await roomRef(id).get();
  if (!roomSnap.exists) return [];
  const row = roomSnap.data() || {};
  if (!core.roomIsOpen(row)) return [];
  let snap = await roomRef(id).collection("events").orderBy("createdAtMs", "desc").limit(Math.max(1, Math.min(24, Number(limit) || 12))).get();
  if (snap.empty) {
    snap = await roomRef(id).collection("turns").orderBy("createdAtMs", "desc").limit(Math.max(1, Math.min(24, Number(limit) || 12))).get();
  }
  return core.sanitizeRoomTurns(snap.docs.map(doc => doc.data()).reverse());
}

async function createInvite({roomId, actorUid, targetUid, actorEmail, actorRole, nowMs}) {
  const now = Number(nowMs || Date.now());
  const roomSnap = await loadRoom(roomId);
  if (!roomSnap) return {ok: false, error: "not_found"};
  const row = roomSnap.data;
  const member = await loadMember(roomSnap.id, actorUid);
  const inviteOk = core.canInviteMore(row, actorUid, member);
  if (!inviteOk.ok) return {ok: false, error: inviteOk.reason};
  const targetState = core.classifyInviteTarget({
    actorUid,
    targetUid,
    memberUids: core.currentMembers(row)
  });
  if (!targetState.ok) return {ok: false, error: targetState.reason};
  const friends = await friendGate(actorUid, targetUid);
  const hostUid = core.text(row.hostUid, 80);
  const blockedHost = hostUid && hostUid !== core.text(targetUid, 80)
    ? await isBlockedPair(hostUid, targetUid)
    : false;
  const admit = core.inviteeAllowed({
    friendsWithInviter: friends.ok,
    blockedWithHost: blockedHost
  });
  if (!admit.ok) return {ok: false, error: admit.reason};
  const limited = await consumeRate("invite", actorUid, {
    nowMs: now,
    windowMs: 60 * 60 * 1000,
    max: core.INVITE_RATE_PER_HOUR
  });
  if (!limited) return {ok: false, error: "rate_limited"};
  const token = core.mintInviteToken();
  const inviteId = core.inviteIdFor(token);
  const target = await systemCollection("users").doc(core.text(targetUid, 80)).get();
  const person = core.publicPerson(targetUid, target.exists ? target.data() : {});
  const href = core.inviteHref(roomSnap.id, token);
  await inviteRef(inviteId).set({
    inviteId,
    roomId: roomSnap.id,
    targetUid: core.text(targetUid, 80),
    invitedByUid: core.text(actorUid, 80),
    status: "pending",
    usesRemaining: 1,
    createdAtMs: now,
    expiresAtMs: core.inviteExpiresAtMs(row, now),
    createdAt: FieldValue().serverTimestamp()
  });
  const scheduled = core.roomIsScheduled(row, now);
  const when = scheduled && Number(row.scheduledStartMs || 0)
    ? ` Scheduled for ${new Date(Number(row.scheduledStartMs)).toISOString()}.`
    : "";
  await systemCollection("inboxNotifications").add({
    recipientUid: core.text(targetUid, 80),
    type: "botDeeRoomInvite",
    title: scheduled ? "You're invited to a scheduled BOT DEE session" : "You're invited to a BOT DEE session",
    body: `A Mingl friend invited you to join their BOT DEE session.${when} Review the invite while signed in as this account. Joining does not charge anyone.`,
    link: href,
    read: false,
    createdAt: FieldValue().serverTimestamp()
  });
  await writeAudit({
    eventType: "botdee.room_invite_created",
    actorUid,
    actorEmail,
    actorRole,
    targetId: roomSnap.id,
    reason: "invite",
    detail: {targetUid: person.uid, inviteIdPrefix: inviteId.slice(0, 12)},
    nowMs: now
  });
  return {
    ok: true,
    invitePath: href,
    expiresAtMs: core.inviteExpiresAtMs(row, now),
    target: person,
    room: core.publicRoom(roomSnap.id, row)
  };
}

async function findPendingInvite({uid, roomId}) {
  const target = core.text(uid, 80);
  const id = core.text(roomId, 80);
  if (!target || !id) return null;
  const snap = await systemCollection("botDeeRoomInvites")
    .where("roomId", "==", id)
    .where("targetUid", "==", target)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0];
}

async function acceptInvite({uid, token, roomId, actorEmail, actorRole, nowMs}) {
  const now = Number(nowMs || Date.now());
  let inviteSnap = null;
  if (core.isValidInviteToken(token)) {
    inviteSnap = await inviteRef(core.inviteIdFor(token)).get();
  } else if (roomId) {
    inviteSnap = await findPendingInvite({uid, roomId});
  }
  if (!inviteSnap || !inviteSnap.exists) return {ok: false, error: "not_found"};
  const inviteId = inviteSnap.id;
  const invite = inviteSnap.exists ? inviteSnap.data() : null;
  const verdict = core.evaluateInvite(invite, {uid, nowMs: now, roomId});
  if (!verdict.ok) {
    const liveMaybe = invite ? await loadRoom(invite.roomId) : null;
    if (verdict.reason === "used" && liveMaybe && core.roomIsInviteable(liveMaybe.data, now) && core.isCurrentMember(liveMaybe.data, uid)) {
      return {ok: true, alreadyMember: true, room: core.publicRoom(liveMaybe.id, liveMaybe.data)};
    }
    await writeAudit({
      eventType: "botdee.room_join_denied",
      outcome: "denied",
      actorUid: uid,
      actorEmail,
      actorRole,
      targetId: core.text(invite?.roomId || roomId, 80),
      reason: verdict.reason,
      detail: {inviteIdPrefix: inviteId.slice(0, 12)},
      nowMs: now
    });
    return {ok: false, error: verdict.reason};
  }
  const live = await loadRoom(invite.roomId);
  if (!live || !core.roomIsInviteable(live.data, now)) return {ok: false, error: "closed"};
  const scheduled = core.roomIsScheduled(live.data, now);
  const friends = await friendGate(invite.invitedByUid, uid);
  const hostUid = core.text(live.data.hostUid, 80);
  const blockedHost = hostUid && hostUid !== core.text(uid, 80)
    ? await isBlockedPair(hostUid, uid)
    : false;
  const admitGate = core.inviteeAllowed({
    friendsWithInviter: friends.ok,
    blockedWithHost: blockedHost
  });
  if (!admitGate.ok) return {ok: false, error: admitGate.reason};
  if (core.currentMembers(live.data).length >= core.MEMBER_CAP && !core.isCurrentMember(live.data, uid)) {
    return {ok: false, error: "full"};
  }
  let members = core.currentMembers(live.data);
  try {
    await db().runTransaction(async tx => {
      const invDoc = await tx.get(inviteSnap.ref);
      const roomDoc = await tx.get(roomRef(live.id));
      const inviteData = invDoc.exists ? invDoc.data() : null;
      const verdictTx = core.evaluateInvite(inviteData, {uid, nowMs: now, roomId});
      if (!verdictTx.ok) {
        const err = new Error(verdictTx.reason);
        err.code = verdictTx.reason;
        throw err;
      }
      if (!roomDoc.exists) {
        const err = new Error("not_found");
        err.code = "not_found";
        throw err;
      }
      const roomData = roomDoc.data() || {};
      if (!core.roomIsInviteable(roomData, now)) {
        const err = new Error("closed");
        err.code = "closed";
        throw err;
      }
      const admitted = core.admitMember(roomData, uid);
      if (!admitted.ok) {
        const err = new Error(admitted.reason);
        err.code = admitted.reason;
        throw err;
      }
      members = admitted.memberUids;
      tx.update(invDoc.ref, {
        status: "accepted",
        usesRemaining: 0,
        acceptedAtMs: now,
        acceptedUid: uid,
        rsvp: "accepted"
      });
      if (!admitted.alreadyMember) {
        tx.set(roomDoc.ref, {
          memberUids: members,
          updatedAtMs: now
        }, {merge: true});
      }
      tx.set(memberRef(live.id, uid), {
        roomId: live.id,
        uid,
        role: core.text(roomData.hostUid, 80) === uid ? "host" : "guest",
        canInvite: true,
        rsvp: "accepted",
        joinedAtMs: core.roomIsOpen(roomData, now) ? now : null,
        leftAtMs: null
      }, {merge: true});
    });
  } catch (error) {
    const reason = String((error && (error.code || error.message)) || "");
    if (reason === "used") {
      const latest = await loadRoom(live.id);
      if (latest && core.isCurrentMember(latest.data, uid)) {
        return {ok: true, alreadyMember: true, room: core.publicRoom(latest.id, latest.data)};
      }
    }
    if (["full", "closed", "used", "expired", "revoked", "wrong_account", "not_found"].includes(reason)) {
      return {ok: false, error: reason};
    }
    throw error;
  }
  if (core.roomIsOpen({...live.data, memberUids: members}, now)) {
    await appendSystemEvent(live.id, uid, `${uid} joined this BOT DEE session.`);
  }
  await writeAudit({
    eventType: scheduled ? "botdee.room_rsvp" : "botdee.room_joined",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "accept",
    nowMs: now
  });
  return {
    ok: true,
    room: core.publicRoom(live.id, {...live.data, memberUids: members})
  };
}

async function syncHostRole(roomId, prevHost, nextHost) {
  const prev = core.text(prevHost, 80);
  const next = core.text(nextHost, 80);
  if (prev && prev !== next) {
    await memberRef(roomId, prev).set({role: "guest"}, {merge: true});
  }
  if (next) {
    await memberRef(roomId, next).set({role: "host"}, {merge: true});
  }
}

async function leaveRoom({uid, roomId, actorEmail, actorRole}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (!core.isCurrentMember(live.data, uid)) return {ok: false, error: "not_member"};
  const exit = core.applyMemberExit(live.data, uid);
  if (exit.end) {
    return endRoom({uid, roomId, actorEmail, actorRole, force: true});
  }
  const prevHost = core.text(live.data.hostUid, 80);
  const patch = {
    memberUids: exit.memberUids,
    hostUid: exit.hostUid,
    hostBallot: exit.hostBallot,
    updatedAtMs: Date.now()
  };
  if (exit.sharedTransaction) patch.sharedTransaction = exit.sharedTransaction;
  await roomRef(live.id).set(patch, {merge: true});
  await memberRef(live.id, uid).set({leftAtMs: Date.now(), role: "guest"}, {merge: true});
  if (exit.hostChanged) await syncHostRole(live.id, prevHost, exit.hostUid);
  await writeAudit({
    eventType: "botdee.room_left",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "leave"
  });
  return {
    ok: true,
    left: true,
    hostChanged: !!exit.hostChanged,
    room: core.publicRoom(live.id, {...live.data, ...patch}, {viewerUid: uid})
  };
}

async function kickMember({hostUid, roomId, targetUid, actorEmail, actorRole}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (!core.isHostActor(live.data, hostUid)) return {ok: false, error: "not_host"};
  const target = core.text(targetUid, 80);
  if (!target || target === core.text(hostUid, 80)) return {ok: false, error: "not_member"};
  if (!core.isCurrentMember(live.data, target)) return {ok: false, error: "not_member"};
  const exit = core.applyMemberExit(live.data, target);
  const patch = {
    memberUids: exit.memberUids,
    hostBallot: exit.hostBallot,
    updatedAtMs: Date.now()
  };
  if (exit.sharedTransaction) patch.sharedTransaction = exit.sharedTransaction;
  await roomRef(live.id).set(patch, {merge: true});
  await memberRef(live.id, target).set({leftAtMs: Date.now(), kickedAtMs: Date.now()}, {merge: true});
  try {
    const threads = require("./bot-dee-thread");
    await threads.persistJoinedRoomId(target, null);
  } catch (_) {}
  await appendSystemEvent(live.id, hostUid, "A guest left this BOT DEE session.");
  await writeAudit({
    eventType: "botdee.room_kicked",
    actorUid: hostUid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "kick",
    detail: {targetUid: target}
  });
  return {
    ok: true,
    kicked: true,
    targetUid: target,
    room: core.publicRoom(live.id, {...live.data, ...patch}, {viewerUid: hostUid})
  };
}

async function revokePendingInvites(roomId) {
  const pending = await systemCollection("botDeeRoomInvites").where("roomId", "==", roomId).where("status", "==", "pending").limit(40).get();
  if (pending.empty) return;
  const batch = db().batch();
  pending.docs.forEach(doc => batch.update(doc.ref, {status: "revoked", revokedAtMs: Date.now()}));
  await batch.commit();
}

async function closeRoomRow(live, {status, closeReason, actorUid, actorEmail, actorRole, eventType}) {
  const now = Date.now();
  const next = {...live.data, status, closeReason, smartNotification: 0, updatedAtMs: now};
  await roomRef(live.id).set({
    status,
    closeReason,
    smartNotification: 0,
    updatedAtMs: now
  }, {merge: true});
  await revokePendingInvites(live.id);
  await writeAudit({
    eventType,
    actorUid: actorUid || "system",
    actorEmail: actorEmail || "",
    actorRole: actorRole || "system",
    targetId: live.id,
    reason: closeReason
  });
  return {
    ok: true,
    closed: true,
    memberUids: core.currentMembers(live.data),
    room: core.publicRoom(live.id, next)
  };
}

async function endRoom({uid, roomId, actorEmail, actorRole, force, closeReason}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  const actor = core.text(uid, 80);
  const members = core.currentMembers(live.data);
  const lastMember = members.length <= 1 && core.isCurrentMember(live.data, actor);
  if (!core.isHostActor(live.data, actor) && !force && !lastMember) return {ok: false, error: "not_host"};
  const tabSnap = await tabRef(live.id).get();
  if (tabSnap.exists && !force) {
    const lineSnap = await tabRef(live.id).collection("lines").limit(40).get();
    const lines = lineSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    if (core.unpaidTabBlocksDelete(tabSnap.data(), lines)) {
      return {ok: false, error: "unpaid_tab"};
    }
  }
  const scheduled = core.roomIsScheduled(live.data);
  const reason = core.text(closeReason, 40) || (scheduled ? "cancelled" : "end");
  const status = scheduled && reason === "cancelled" ? "cancelled" : "ended";
  return closeRoomRow(live, {
    status,
    closeReason: reason,
    actorUid: uid,
    actorEmail,
    actorRole,
    eventType: scheduled ? "botdee.room_cancelled" : "botdee.room_ended"
  });
}

async function setItinerary({uid, roomId, intent}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (!core.roomIsInviteable(live.data) || !core.isCurrentMember(live.data, uid)) {
    return {ok: false, error: core.roomIsInviteable(live.data) ? "not_member" : "closed"};
  }
  const sharedIntent = core.publicIntent(intent);
  await roomRef(live.id).set({sharedIntent, updatedAtMs: Date.now()}, {merge: true});
  return {ok: true, room: core.publicRoom(live.id, {...live.data, sharedIntent})};
}

async function loadTab(roomId) {
  const snap = await tabRef(roomId).get();
  const lines = snap.exists
    ? (await tabRef(roomId).collection("lines").limit(80).get()).docs.map(doc => ({lineId: doc.id, id: doc.id, ...doc.data()}))
    : [];
  return {tab: snap.exists ? {roomId: core.text(roomId, 80), ...snap.data()} : null, lines};
}

async function optInTab({uid, roomId, venueId, venueName}) {
  const live = await loadRoom(roomId);
  if (!live || !core.roomIsOpen(live.data) || !core.isCurrentMember(live.data, uid)) {
    return {ok: false, error: live && core.roomIsOpen(live.data) ? "not_member" : "closed"};
  }
  const existing = await tabRef(live.id).get();
  const now = Date.now();
  const prev = existing.exists ? existing.data() || {} : {};
  const opted = Array.isArray(prev.optedInUids) ? prev.optedInUids.slice() : [];
  if (!opted.includes(uid)) opted.push(uid);
  const participants = Array.isArray(prev.participantUids) ? prev.participantUids.slice() : core.currentMembers(live.data);
  if (!participants.includes(uid)) participants.push(uid);
  const row = {
    roomId: live.id,
    status: core.text(prev.status, 20) || "open",
    venueId: core.text(venueId || prev.venueId || live.data.sharedIntent?.venueId, 80),
    venueName: core.text(venueName || prev.venueName || live.data.sharedIntent?.venueName, 80),
    collector: "floqrStripe",
    openedByUid: core.text(prev.openedByUid, 80) || uid,
    participantUids: participants,
    optedInUids: opted,
    updatedAtMs: now
  };
  if (!existing.exists) row.createdAtMs = now;
  await tabRef(live.id).set(row, {merge: true});
  await writeAudit({
    eventType: "botdee.room_tab_opt_in",
    actorUid: uid,
    targetId: live.id,
    reason: "opt_in"
  });
  const loaded = await loadTab(live.id);
  return {ok: true, tab: core.publicTab(loaded.tab, loaded.lines, uid)};
}

async function addTabLine({uid, roomId, item, amountCents, assignedUid}) {
  const live = await loadRoom(roomId);
  if (!live || !core.isCurrentMember(live.data, uid) || !core.roomIsOpen(live.data)) {
    return {ok: false, error: "not_member"};
  }
  const loaded = await loadTab(live.id);
  if (!loaded.tab) return {ok: false, error: "no_opt_in"};
  const assigned = core.text(assignedUid || uid, 80);
  const attach = core.canAttachLine(loaded.tab, assigned);
  if (!attach.ok) return {ok: false, error: attach.reason};
  const cents = Math.max(0, Math.round(Number(amountCents) || 0));
  if (cents < 50 || cents > 500000) return {ok: false, error: "amount"};
  const ref = tabRef(live.id).collection("lines").doc();
  await ref.set({
    addedByUid: uid,
    assignedUid: assigned,
    item: core.text(item, 80) || "Tab item",
    amountCents: cents,
    status: assigned === uid ? "accepted" : "proposed",
    createdAtMs: Date.now()
  });
  const next = await loadTab(live.id);
  return {ok: true, tab: core.publicTab(next.tab, next.lines, uid)};
}

async function setTabLineStatus({uid, roomId, lineId, status}) {
  const live = await loadRoom(roomId);
  if (!live || !core.isCurrentMember(live.data, uid)) return {ok: false, error: "not_member"};
  const st = core.text(status, 20);
  if (st !== "accepted" && st !== "void") return {ok: false, error: "tab_closed"};
  const lineRef = tabRef(live.id).collection("lines").doc(core.text(lineId, 80));
  const snap = await lineRef.get();
  if (!snap.exists) return {ok: false, error: "not_found"};
  const line = snap.data() || {};
  const loaded = await loadTab(live.id);
  const allowed = core.canSetTabLineStatus({
    tab: loaded.tab,
    line,
    uid,
    status: st,
    hostUid: live.data.hostUid
  });
  if (!allowed.ok) return {ok: false, error: allowed.reason};
  await lineRef.set({status: st, updatedAtMs: Date.now()}, {merge: true});
  const next = await loadTab(live.id);
  return {ok: true, tab: core.publicTab(next.tab, next.lines, uid)};
}

async function planTabCheckout({uid, roomId, mode, confirmingUids}) {
  const live = await loadRoom(roomId);
  if (!live || !core.isCurrentMember(live.data, uid)) return {ok: false, error: "not_member"};
  const loaded = await loadTab(live.id);
  if (!loaded.tab) return {ok: false, error: "no_opt_in"};
  const plan = core.closeTabPlan(loaded.tab, loaded.lines, {
    mode,
    payerUid: uid,
    confirmingUids: mode === "split" ? confirmingUids : [uid]
  });
  if (!plan.ok) return {ok: false, error: plan.reason};
  const mine = plan.charges.find(row => row.uid === uid);
  if (!mine) return {ok: false, error: "no_confirming_uids"};
  const closeId = `btc_${cryptoRandom(8)}`;
  await tabRef(live.id).set({
    status: "closing",
    payMode: plan.payMode,
    closeId,
    closeUid: uid,
    closeAmountCents: mine.amountCents,
    closeLineIds: mine.lineIds,
    updatedAtMs: Date.now()
  }, {merge: true});
  return {
    ok: true,
    closeId,
    amountCents: mine.amountCents,
    payMode: plan.payMode,
    venueName: loaded.tab.venueName || "FLOQR",
    venueId: loaded.tab.venueId || "",
    lineIds: mine.lineIds,
    roomId: live.id
  };
}

async function fulfillTabPayment({order, cardLast4}) {
  const roomId = core.text(order.payload?.roomId || order.roomId, 80);
  const closeId = core.text(order.payload?.closeId || order.closeId, 80);
  const payer = core.text(order.ownerUid, 80);
  const loaded = await loadTab(roomId);
  if (!loaded.tab || core.text(loaded.tab.closeId, 80) !== closeId) return {ok: false, error: "not_found"};
  if (core.text(loaded.tab.closeUid, 80) !== payer) return {ok: false, error: "not_member"};
  const lineIds = Array.isArray(loaded.tab.closeLineIds) ? loaded.tab.closeLineIds : [];
  const batch = db().batch();
  lineIds.forEach(id => {
    batch.set(tabRef(roomId).collection("lines").doc(core.text(id, 80)), {
      status: "paid",
      paidByUid: payer,
      receiptOrderId: core.text(order.id, 80),
      updatedAtMs: Date.now()
    }, {merge: true});
  });
  const remaining = loaded.lines.filter(line => {
    const st = core.text(line.status, 20);
    return (st === "proposed" || st === "accepted") && !lineIds.includes(line.lineId || line.id);
  });
  batch.set(tabRef(roomId), {
    status: remaining.length ? "open" : "paid",
    lastPaidByUid: payer,
    updatedAtMs: Date.now()
  }, {merge: true});
  await batch.commit();
  await writeAudit({
    eventType: "botdee.room_tab_paid",
    actorUid: payer,
    targetId: roomId,
    reason: "pay",
    detail: {closeId, hasLast4: !!cardLast4, last4OnPayerOnly: true}
  });
  return {ok: true, roomId, remaining: remaining.length};
}

async function revokeInvite({hostUid, inviteId}) {
  const snap = await inviteRef(inviteId).get();
  if (!snap.exists) return {ok: false, error: "not_found"};
  const invite = snap.data() || {};
  const live = await loadRoom(invite.roomId);
  if (!live || core.text(live.data.hostUid, 80) !== core.text(hostUid, 80)) {
    return {ok: false, error: "not_host"};
  }
  await snap.ref.set({status: "revoked", revokedAtMs: Date.now()}, {merge: true});
  return {ok: true};
}

function ianaZone(value) {
  const zone = core.text(value, 80) || "UTC";
  try {
    Intl.DateTimeFormat("en-US", {timeZone: zone});
    return zone;
  } catch (_) {
    return "UTC";
  }
}

async function refreshInviteExpiry(roomId, expiresAtMs) {
  const pending = await systemCollection("botDeeRoomInvites").where("roomId", "==", roomId).where("status", "==", "pending").limit(40).get();
  if (pending.empty) return;
  const batch = db().batch();
  pending.docs.forEach(doc => batch.update(doc.ref, {expiresAtMs: Number(expiresAtMs || 0)}));
  await batch.commit();
}

async function hostDisplayName(uid) {
  const snap = await systemCollection("users").doc(core.text(uid, 80)).get();
  return core.publicPerson(uid, snap.exists ? snap.data() : {}).displayName || "Host";
}

async function scheduleRoom({hostUid, conversationId, title, authorizedTitle, authorizedDescription, scheduledStartMs, scheduledTimeZone, actorEmail, actorRole, nowMs}) {
  const uid = core.text(hostUid, 80);
  const now = Number(nowMs || Date.now());
  if (!uid) return {ok: false, error: "not_host"};
  if (!core.scheduleStartValid(scheduledStartMs, now)) return {ok: false, error: "past"};
  const zone = ianaZone(scheduledTimeZone);
  const roomId = `br_${cryptoRandom(8)}`;
  const row = roomSeed({
    hostUid: uid,
    conversationId,
    title,
    authorizedTitle,
    authorizedDescription,
    now,
    status: "scheduled",
    scheduledStartMs,
    scheduledTimeZone: zone,
    smartNotification: 1
  });
  const batch = db().batch();
  batch.set(roomRef(roomId), row);
  batch.set(memberRef(roomId, uid), {
    roomId,
    uid,
    role: "host",
    canInvite: true,
    rsvp: "accepted",
    joinedAtMs: now,
    leftAtMs: null,
    lastPresenceAtMs: 0,
    displayName: "",
    handle: ""
  });
  await batch.commit();
  await writeAudit({
    eventType: "botdee.room_scheduled",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: roomId,
    reason: "schedule",
    detail: {scheduledStartMs: Number(scheduledStartMs), scheduledTimeZone: zone},
    nowMs: now
  });
  return {ok: true, room: core.publicRoom(roomId, row)};
}

async function startRoom({uid, roomId, conversationId, title, authorizedTitle, authorizedDescription, actorEmail, actorRole, nowMs}) {
  const now = Number(nowMs || Date.now());
  const actor = core.text(uid, 80);
  if (!actor) return {ok: false, error: "not_host"};
  if (!roomId) {
    const created = await createRoom({
      hostUid: actor,
      conversationId,
      title,
      authorizedTitle,
      authorizedDescription,
      nowMs: now
    });
    if (created.ok) {
      await writeAudit({
        eventType: "botdee.room_started",
        actorUid: actor,
        actorEmail,
        actorRole,
        targetId: created.room.roomId,
        reason: "join_now",
        nowMs: now
      });
    }
    return created;
  }
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (core.text(live.data.hostUid, 80) !== actor) return {ok: false, error: "not_host"};
  if (core.roomIsOpen(live.data, now)) {
    return {ok: true, room: core.publicRoom(live.id, live.data), alreadyOpen: true};
  }
  if (!core.roomIsScheduled(live.data, now) && core.roomStatus(live.data) !== "scheduled") {
    return {ok: false, error: "closed"};
  }
  const next = {
    ...live.data,
    status: "open",
    liveOpenedAtMs: now,
    lastPresenceAtMs: now,
    expiresAtMs: now + core.ROOM_TTL_MS,
    updatedAtMs: now
  };
  await roomRef(live.id).set({
    status: "open",
    liveOpenedAtMs: now,
    lastPresenceAtMs: now,
    expiresAtMs: now + core.ROOM_TTL_MS,
    updatedAtMs: now
  }, {merge: true});
  await memberRef(live.id, actor).set({lastPresenceAtMs: now, joinedAtMs: now, leftAtMs: null}, {merge: true});
  await appendSystemEvent(live.id, actor, `${actor} opened this BOT DEE session.`);
  await writeAudit({
    eventType: "botdee.room_started",
    actorUid: actor,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "start",
    nowMs: now
  });
  return {ok: true, room: core.publicRoom(live.id, next)};
}

async function rescheduleRoom({uid, roomId, scheduledStartMs, scheduledTimeZone, actorEmail, actorRole, nowMs}) {
  const now = Number(nowMs || Date.now());
  if (!core.scheduleStartValid(scheduledStartMs, now)) return {ok: false, error: "past"};
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (core.text(live.data.hostUid, 80) !== core.text(uid, 80)) return {ok: false, error: "not_host"};
  if (!core.roomIsScheduled(live.data, now)) return {ok: false, error: "not_scheduled"};
  const zone = ianaZone(scheduledTimeZone || live.data.scheduledTimeZone);
  const expiresAtMs = Number(scheduledStartMs) + core.ROOM_TTL_MS;
  const next = {
    ...live.data,
    scheduledStartMs: Number(scheduledStartMs),
    scheduledTimeZone: zone,
    expiresAtMs,
    smartNotification: 1,
    updatedAtMs: now
  };
  await roomRef(live.id).set({
    scheduledStartMs: Number(scheduledStartMs),
    scheduledTimeZone: zone,
    expiresAtMs,
    smartNotification: 1,
    updatedAtMs: now
  }, {merge: true});
  await refreshInviteExpiry(live.id, expiresAtMs);
  await writeAudit({
    eventType: "botdee.room_scheduled",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "reschedule",
    detail: {scheduledStartMs: Number(scheduledStartMs)},
    nowMs: now
  });
  return {ok: true, room: core.publicRoom(live.id, next)};
}

async function touchPresence({uid, roomId, nowMs}) {
  const now = Number(nowMs || Date.now());
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (!core.roomIsOpen(live.data, now)) return {ok: false, error: "not_live"};
  if (!core.isCurrentMember(live.data, uid)) return {ok: false, error: "not_member"};
  const last = Number(live.data.lastPresenceAtMs || 0);
  if (last && now - last < core.PRESENCE_TOUCH_MS / 2) {
    return {ok: true, room: core.publicRoom(live.id, live.data), throttled: true};
  }
  await memberRef(live.id, uid).set({lastPresenceAtMs: now, leftAtMs: null}, {merge: true});
  await roomRef(live.id).set({lastPresenceAtMs: now, updatedAtMs: now}, {merge: true});
  return {ok: true, room: core.publicRoom(live.id, {...live.data, lastPresenceAtMs: now})};
}

async function memberRowsFor(roomId, room) {
  const uids = core.currentMembers(room);
  if (!uids.length) return [];
  const snaps = await db().getAll(...uids.map(uid => memberRef(roomId, uid)));
  return snaps.map((snap, index) => ({uid: uids[index], ...(snap.exists ? snap.data() : {})}));
}

async function listNotifications({uid, nowMs}) {
  const viewer = core.text(uid, 80);
  const now = Number(nowMs || Date.now());
  if (!viewer) return {ok: true, notifications: []};
  const hosted = await systemCollection("botDeeRooms").where("hostUid", "==", viewer).limit(20).get();
  const invites = await systemCollection("botDeeRoomInvites").where("targetUid", "==", viewer).limit(40).get();
  const roomIds = new Map();
  hosted.docs.forEach(doc => roomIds.set(doc.id, {doc, via: "host"}));
  for (const inv of invites.docs) {
    const row = inv.data() || {};
    const st = core.text(row.status, 20);
    if (st !== "pending" && st !== "accepted") continue;
    const id = core.text(row.roomId, 80);
    if (id && !roomIds.has(id)) roomIds.set(id, {invite: row, via: "invitee"});
  }
  const notes = [];
  for (const [id, meta] of roomIds) {
    const live = meta.doc ? {id, data: meta.doc.data() || {}} : await loadRoom(id);
    if (!live) continue;
    const row = live.data || live;
    const roomId = live.id || id;
    if (!core.roomNotifiesSearch(row)) continue;
    if (core.roomStatus(row) === "open" && Number(row.expiresAtMs || 0) && Number(row.expiresAtMs) <= now) continue;
    const hostName = await hostDisplayName(row.hostUid);
    const viewerRole = core.text(row.hostUid, 80) === viewer ? "host" : "invitee";
    notes.push(core.publicNotification(roomId, row, {
      hostName,
      viewerRole,
      joinHref: core.roomHref(roomId, ""),
      rsvp: viewerRole === "host" ? "accepted" : core.text(meta.invite?.rsvp || meta.invite?.status, 20),
      scheduledLabel: Number(row.scheduledStartMs || 0)
        ? new Date(Number(row.scheduledStartMs)).toLocaleString("en-US", {timeZone: row.scheduledTimeZone || "UTC"})
        : ""
    }));
  }
  notes.sort((a, b) => Number(a.scheduledStartMs || 0) - Number(b.scheduledStartMs || 0));
  return {ok: true, notifications: notes.slice(0, 8)};
}

async function expireRooms({nowMs, actorRole} = {}) {
  const now = Number(nowMs || Date.now());
  const expiredSnap = await systemCollection("botDeeRooms").where("expiresAtMs", "<=", now).limit(80).get();
  const staleSnap = await systemCollection("botDeeRooms")
    .where("status", "==", "open")
    .where("lastPresenceAtMs", "<=", now - core.PRESENCE_STALE_MS)
    .limit(80)
    .get();
  const seen = new Set();
  let expired = 0;
  let lastLogout = 0;
  for (const doc of expiredSnap.docs) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const row = doc.data() || {};
    const st = core.roomStatus(row);
    if (st !== "open" && st !== "scheduled") continue;
    await closeRoomRow({id: doc.id, data: row}, {
      status: "expired",
      closeReason: "ttl",
      actorUid: "system",
      actorRole: actorRole || "system",
      eventType: "botdee.room_expired"
    });
    expired += 1;
  }
  for (const doc of staleSnap.docs) {
    if (seen.has(doc.id)) continue;
    const row = doc.data() || {};
    if (core.roomStatus(row) !== "open") continue;
    const members = await memberRowsFor(doc.id, row);
    if (!core.lastLogoutShouldClose(row, members, now)) continue;
    seen.add(doc.id);
    await closeRoomRow({id: doc.id, data: row}, {
      status: "ended",
      closeReason: "last_logout",
      actorUid: "system",
      actorRole: actorRole || "system",
      eventType: "botdee.room_last_logout"
    });
    lastLogout += 1;
  }
  return {ok: true, expired, lastLogout, scanned: seen.size};
}

async function rsvpRoom({uid, roomId, token, rsvp, actorEmail, actorRole, nowMs}) {
  const choice = core.text(rsvp, 20) === "declined" ? "declined" : "accepted";
  if (choice === "accepted") {
    return acceptInvite({uid, token, roomId, actorEmail, actorRole, nowMs});
  }
  const now = Number(nowMs || Date.now());
  const live = await loadRoom(roomId);
  if (!live || !core.roomIsScheduled(live.data, now)) return {ok: false, error: "not_scheduled"};
  const pending = await systemCollection("botDeeRoomInvites")
    .where("roomId", "==", live.id)
    .where("targetUid", "==", core.text(uid, 80))
    .where("status", "==", "pending")
    .limit(4)
    .get();
  if (pending.empty && token) {
    return acceptInvite({uid, token, roomId, actorEmail, actorRole, nowMs});
  }
  if (pending.empty) return {ok: false, error: "not_found"};
  const batch = db().batch();
  pending.docs.forEach(doc => batch.update(doc.ref, {rsvp: "declined", rsvpAtMs: now}));
  batch.set(memberRef(live.id, uid), {
    roomId: live.id,
    uid,
    role: "guest",
    rsvp: "declined",
    canInvite: false,
    leftAtMs: now
  }, {merge: true});
  await batch.commit();
  await writeAudit({
    eventType: "botdee.room_rsvp",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "declined",
    nowMs: now
  });
  return {ok: true, rsvp: "declined", room: core.publicRoom(live.id, live.data)};
}

async function setGuestCanInvite({hostUid, roomId, targetUid, canInvite}) {
  const live = await loadRoom(roomId);
  if (!live || !core.isHostActor(live.data, hostUid)) {
    return {ok: false, error: "not_host"};
  }
  await memberRef(live.id, targetUid).set({canInvite: canInvite !== false}, {merge: true});
  return {ok: true};
}

async function proposeSharedTransaction({uid, roomId, kind, snapshot, actorEmail, actorRole}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  const result = core.proposeSharedTransaction({
    room: live.data,
    actorUid: uid,
    kind,
    snapshot,
    nowMs: Date.now()
  });
  if (!result.ok) return {ok: false, error: result.reason};
  await roomRef(live.id).set({
    sharedTransaction: result.sharedTransaction,
    updatedAtMs: Date.now()
  }, {merge: true});
  await writeAudit({
    eventType: "botdee.choice_proposed",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "propose",
    detail: {kind: result.sharedTransaction.kind, choiceId: result.sharedTransaction.choiceId}
  });
  const next = {...live.data, sharedTransaction: result.sharedTransaction};
  return {
    ok: true,
    room: core.publicRoom(live.id, next, {viewerUid: uid}),
    collab: core.publicCollab(next, uid)
  };
}

async function voteSharedTransaction({uid, roomId, ballot, choiceId, actorEmail, actorRole}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  const result = core.voteSharedTransaction({
    room: live.data,
    actorUid: uid,
    ballot,
    choiceId
  });
  if (!result.ok) return {ok: false, error: result.reason};
  await roomRef(live.id).set({
    sharedTransaction: result.sharedTransaction,
    updatedAtMs: Date.now()
  }, {merge: true});
  await writeAudit({
    eventType: "botdee.choice_voted",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: result.tally.passed ? "passed" : "vote",
    detail: {choiceId: result.sharedTransaction.choiceId, ballot: core.text(ballot, 8), yes: result.tally.yes}
  });
  const next = {...live.data, sharedTransaction: result.sharedTransaction};
  return {
    ok: true,
    tally: result.tally,
    room: core.publicRoom(live.id, next, {viewerUid: uid}),
    collab: core.publicCollab(next, uid)
  };
}

async function nominateHost({uid, roomId, candidateUid, actorEmail, actorRole}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  const prevHost = core.text(live.data.hostUid, 80);
  const result = core.nominateHost({
    room: live.data,
    actorUid: uid,
    candidateUid,
    nowMs: Date.now()
  });
  if (!result.ok) return {ok: false, error: result.reason};
  await roomRef(live.id).set({
    hostUid: result.hostUid,
    hostBallot: result.hostBallot,
    updatedAtMs: Date.now()
  }, {merge: true});
  if (result.elected) await syncHostRole(live.id, prevHost, result.hostUid);
  await writeAudit({
    eventType: result.elected ? "botdee.host_elected" : "botdee.host_nominated",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: result.elected ? "elected" : "nominate",
    detail: {candidateUid: core.text(candidateUid || uid, 80), yes: result.tally.yes, needed: result.tally.needed}
  });
  const next = {...live.data, hostUid: result.hostUid, hostBallot: result.hostBallot};
  return {
    ok: true,
    elected: result.elected,
    tally: result.tally,
    room: core.publicRoom(live.id, next, {viewerUid: uid}),
    collab: core.publicCollab(next, uid)
  };
}

async function voteHost({uid, roomId, ballot, actorEmail, actorRole}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  const prevHost = core.text(live.data.hostUid, 80);
  const result = core.voteHost({
    room: live.data,
    actorUid: uid,
    ballot
  });
  if (!result.ok) return {ok: false, error: result.reason};
  await roomRef(live.id).set({
    hostUid: result.hostUid,
    hostBallot: result.hostBallot,
    updatedAtMs: Date.now()
  }, {merge: true});
  if (result.elected) await syncHostRole(live.id, prevHost, result.hostUid);
  await writeAudit({
    eventType: result.elected ? "botdee.host_elected" : "botdee.host_voted",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: result.elected ? "elected" : "vote",
    detail: {candidateUid: core.text(live.data.hostBallot?.candidateUid, 80), yes: result.tally.yes}
  });
  const next = {...live.data, hostUid: result.hostUid, hostBallot: result.hostBallot};
  return {
    ok: true,
    elected: result.elected,
    tally: result.tally,
    room: core.publicRoom(live.id, next, {viewerUid: uid}),
    collab: core.publicCollab(next, uid)
  };
}

module.exports = {
  JOB,
  db,
  systemCollection,
  roomRef,
  memberRef,
  inviteRef,
  tabRef,
  writeAudit,
  loadRoom,
  viewerMayReadRoom,
  loadMember,
  isMutualMinglFriend,
  isBlockedPair,
  friendGate,
  consumeRate,
  publicMemberList,
  listMinglFriends,
  createRoom,
  appendTurn,
  appendSystemEvent,
  loadTurns,
  createInvite,
  acceptInvite,
  leaveRoom,
  kickMember,
  endRoom,
  setItinerary,
  loadTab,
  optInTab,
  addTabLine,
  setTabLineStatus,
  planTabCheckout,
  fulfillTabPayment,
  revokeInvite,
  scheduleRoom,
  startRoom,
  rescheduleRoom,
  touchPresence,
  listNotifications,
  expireRooms,
  rsvpRoom,
  setGuestCanInvite,
  syncHostRole,
  proposeSharedTransaction,
  voteSharedTransaction,
  nominateHost,
  voteHost
};
