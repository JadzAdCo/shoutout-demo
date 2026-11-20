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

async function createRoom({hostUid, conversationId, title, nowMs}) {
  const uid = core.text(hostUid, 80);
  if (!uid) return {ok: false, error: "missing_host"};
  const roomId = `br_${cryptoRandom(8)}`;
  const now = Number(nowMs || Date.now());
  const expiresAtMs = now + core.ROOM_TTL_MS;
  const row = {
    hostUid: uid,
    memberUids: [uid],
    status: "open",
    conversationId: core.text(conversationId, 80),
    title: core.text(title, 80) || "BOT DEE group session",
    minglFriendsOnly: true,
    guestsCanInvite: true,
    sharedIntent: core.publicIntent({}),
    createdAtMs: now,
    updatedAtMs: now,
    expiresAtMs
  };
  const batch = db().batch();
  batch.set(roomRef(roomId), row);
  batch.set(memberRef(roomId, uid), {
    roomId,
    uid,
    role: "host",
    canInvite: true,
    joinedAtMs: now,
    leftAtMs: null,
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
  if (core.isCurrentMember(row, targetUid)) return {ok: false, error: "used"};
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
    expiresAtMs: now + core.INVITE_TTL_MS,
    createdAt: FieldValue().serverTimestamp()
  });
  await systemCollection("inboxNotifications").add({
    recipientUid: core.text(targetUid, 80),
    type: "botDeeRoomInvite",
    title: "You're invited to a BOT DEE session",
    body: "A Mingl friend invited you to join their BOT DEE session. Review the invite while signed in as this account. Joining does not charge anyone.",
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
    expiresAtMs: now + core.INVITE_TTL_MS,
    target: person,
    room: core.publicRoom(roomSnap.id, row)
  };
}

async function acceptInvite({uid, token, roomId, actorEmail, actorRole, nowMs}) {
  const now = Number(nowMs || Date.now());
  if (!core.isValidInviteToken(token)) return {ok: false, error: "not_found"};
  const inviteId = core.inviteIdFor(token);
  const inviteSnap = await inviteRef(inviteId).get();
  const invite = inviteSnap.exists ? inviteSnap.data() : null;
  const verdict = core.evaluateInvite(invite, {uid, nowMs: now, roomId});
  if (!verdict.ok) {
    const liveMaybe = invite ? await loadRoom(invite.roomId) : null;
    if (verdict.reason === "used" && liveMaybe && core.roomIsOpen(liveMaybe.data, now) && core.isCurrentMember(liveMaybe.data, uid)) {
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
  if (!live || !core.roomIsOpen(live.data, now)) return {ok: false, error: "closed"};
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
      if (!core.roomIsOpen(roomData, now)) {
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
        acceptedUid: uid
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
        joinedAtMs: now,
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
  await appendSystemEvent(live.id, uid, `${uid} joined this BOT DEE session.`);
  await writeAudit({
    eventType: "botdee.room_joined",
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

async function leaveRoom({uid, roomId, actorEmail, actorRole}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (core.text(live.data.hostUid, 80) === core.text(uid, 80)) {
    return endRoom({uid, roomId, actorEmail, actorRole});
  }
  if (!core.isCurrentMember(live.data, uid)) return {ok: false, error: "not_member"};
  const next = core.currentMembers(live.data).filter(id => id !== core.text(uid, 80));
  await roomRef(live.id).set({memberUids: next, updatedAtMs: Date.now()}, {merge: true});
  await memberRef(live.id, uid).set({leftAtMs: Date.now()}, {merge: true});
  await writeAudit({
    eventType: "botdee.room_left",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "leave"
  });
  return {ok: true, left: true, room: core.publicRoom(live.id, {...live.data, memberUids: next})};
}

async function kickMember({hostUid, roomId, targetUid, actorEmail, actorRole}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (core.text(live.data.hostUid, 80) !== core.text(hostUid, 80)) return {ok: false, error: "not_host"};
  const target = core.text(targetUid, 80);
  if (!target || target === core.text(hostUid, 80)) return {ok: false, error: "not_member"};
  if (!core.isCurrentMember(live.data, target)) return {ok: false, error: "not_member"};
  const next = core.currentMembers(live.data).filter(id => id !== target);
  await roomRef(live.id).set({memberUids: next, updatedAtMs: Date.now()}, {merge: true});
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
  return {ok: true, kicked: true, targetUid: target, room: core.publicRoom(live.id, {...live.data, memberUids: next})};
}

async function endRoom({uid, roomId, actorEmail, actorRole, force}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (core.text(live.data.hostUid, 80) !== core.text(uid, 80)) return {ok: false, error: "not_host"};
  const tabSnap = await tabRef(live.id).get();
  if (tabSnap.exists && !force) {
    const lineSnap = await tabRef(live.id).collection("lines").limit(40).get();
    const lines = lineSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    if (core.unpaidTabBlocksDelete(tabSnap.data(), lines)) {
      return {ok: false, error: "unpaid_tab"};
    }
  }
  const members = core.currentMembers(live.data);
  await roomRef(live.id).set({status: "ended", updatedAtMs: Date.now()}, {merge: true});
  const pending = await systemCollection("botDeeRoomInvites").where("roomId", "==", live.id).where("status", "==", "pending").limit(40).get();
  const batch = db().batch();
  pending.docs.forEach(doc => batch.update(doc.ref, {status: "revoked", revokedAtMs: Date.now()}));
  await batch.commit();
  await writeAudit({
    eventType: "botdee.room_ended",
    actorUid: uid,
    actorEmail,
    actorRole,
    targetId: live.id,
    reason: "end"
  });
  return {
    ok: true,
    closed: true,
    memberUids: members,
    room: core.publicRoom(live.id, {...live.data, status: "ended"})
  };
}

async function setItinerary({uid, roomId, intent}) {
  const live = await loadRoom(roomId);
  if (!live) return {ok: false, error: "not_found"};
  if (!core.roomIsOpen(live.data) || !core.isCurrentMember(live.data, uid)) {
    return {ok: false, error: core.roomIsOpen(live.data) ? "not_member" : "closed"};
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

async function setGuestCanInvite({hostUid, roomId, targetUid, canInvite}) {
  const live = await loadRoom(roomId);
  if (!live || core.text(live.data.hostUid, 80) !== core.text(hostUid, 80)) {
    return {ok: false, error: "not_host"};
  }
  await memberRef(live.id, targetUid).set({canInvite: canInvite !== false}, {merge: true});
  return {ok: true};
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
  setGuestCanInvite
};
