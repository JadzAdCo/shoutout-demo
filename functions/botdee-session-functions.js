/* BOT DEE Mingl session callables. Auth + botDee + mingl. Membership re-checked every call. */
"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const core = require("./botdee-session-core");
const store = require("./botdee-session-store");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");

const CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  console.error("BOT DEE session callable failed", error?.message || error);
  return new HttpsError("internal", "BOT DEE could not complete that request. Try again.");
}

function actorFrom(request) {
  const helpers = audit;
  if (typeof helpers.auditActorFromRequest === "function") {
    return helpers.auditActorFromRequest(request, "patron");
  }
  const agent = request?.data?.clientKind === "agent" || request?.data?.actorKind === "agent";
  return {
    uid: request?.auth?.uid || "",
    email: agent ? "agent" : (request?.auth?.token?.email || ""),
    role: agent ? "agent" : "patron"
  };
}

async function requireSessionAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to use BOT DEE with Mingl friends.");
  await audit.assertFeatureAccess(request.auth, "botDee", request);
  await audit.assertFeatureAccess(request.auth, "mingl", request);
  return request.auth.uid;
}

function fail(reason) {
  const code = reason === "rate_limited" ? "resource-exhausted"
    : reason === "wrong_account" || reason === "not_host" || reason === "not_member" || reason === "not_assignee" ? "permission-denied"
      : reason === "full" || reason === "closed" || reason === "unpaid_tab" || reason === "no_opt_in" || reason === "not_friend" || reason === "invite_disabled" || reason === "expired" || reason === "revoked" || reason === "used" || reason === "self" || reason === "already_member" || reason === "past" || reason === "already_open" || reason === "not_scheduled" || reason === "not_live" || reason === "no_choice" || reason === "stale_choice" || reason === "no_ballot" || reason === "choice_not_ready" ? "failed-precondition"
        : "not-found";
  throw new HttpsError(code, core.denialMessage(reason), {reason});
}

function unwrap(result) {
  if (!result || result.ok) return result;
  fail(result.error || "not_found");
}

exports.createBotDeeRoom = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    const created = unwrap(await store.createRoom({
      hostUid: uid,
      conversationId: core.text(request.data?.conversationId, 80),
      title: core.text(request.data?.title, 80)
    }));
    await store.writeAudit({
      eventType: "botdee.room_created",
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetId: created.room.roomId,
      reason: "create"
    });
    return created;
  } catch (error) {
    throw asHttps(error);
  }
});

exports.createBotDeeRoomInvite = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.createInvite({
      roomId: core.text(request.data?.roomId, 80),
      actorUid: uid,
      targetUid: core.text(request.data?.targetUid, 80),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.inviteBotDeeRoomGuest = exports.createBotDeeRoomInvite;

exports.acceptBotDeeRoomInvite = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.acceptInvite({
      uid,
      token: String(request.data?.token || ""),
      roomId: core.text(request.data?.roomId, 80),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.leaveBotDeeRoom = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.leaveRoom({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.kickBotDeeRoomMember = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.kickMember({
      hostUid: uid,
      roomId: core.text(request.data?.roomId, 80),
      targetUid: core.text(request.data?.targetUid, 80),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.endBotDeeRoom = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.endRoom({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.listBotDeeRoomFriends = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const roomId = core.text(request.data?.roomId, 80);
    let memberUids = [];
    let roomFull = false;
    if (roomId) {
      const live = await store.loadRoom(roomId);
      if (live && core.isCurrentMember(live.data, uid)) {
        memberUids = core.currentMembers(live.data);
        roomFull = memberUids.length >= core.MEMBER_CAP;
      }
    }
    const friends = core.decorateFriendInviteState(await store.listMinglFriends(uid), {
      actorUid: uid,
      memberUids
    });
    return {
      ok: true,
      viewerUid: uid,
      friends,
      roomFull,
      memberCount: memberUids.length,
      participantCap: core.MEMBER_CAP
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.getBotDeeRoom = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const live = await store.loadRoom(core.text(request.data?.roomId, 80));
    if (!live || !(await store.viewerMayReadRoom(live, uid))) fail("not_member");
    const members = await store.publicMemberList(live.data);
    const loadedTab = await store.loadTab(live.id);
    return {
      ok: true,
      room: core.publicRoom(live.id, live.data),
      members,
      viewerIsHost: core.text(live.data.hostUid, 80) === uid,
      tab: loadedTab.tab ? core.publicTab(loadedTab.tab, loadedTab.lines, uid) : null
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.setBotDeeRoomItinerary = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    return unwrap(await store.setItinerary({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      intent: request.data?.intent || request.data || {}
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.optInBotDeeRoomTab = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    return unwrap(await store.optInTab({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      venueId: core.text(request.data?.venueId, 80),
      venueName: core.text(request.data?.venueName, 80)
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.addBotDeeRoomTabLine = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    return unwrap(await store.addTabLine({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      item: core.text(request.data?.item, 80),
      amountCents: request.data?.amountCents,
      assignedUid: core.text(request.data?.assignedUid, 80)
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.acceptBotDeeRoomTabLine = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    return unwrap(await store.setTabLineStatus({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      lineId: core.text(request.data?.lineId, 80),
      status: "accepted"
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.voidBotDeeRoomTabLine = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    return unwrap(await store.setTabLineStatus({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      lineId: core.text(request.data?.lineId, 80),
      status: "void"
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.closeBotDeeRoomTab = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const plan = unwrap(await store.planTabCheckout({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      mode: core.text(request.data?.mode, 20),
      confirmingUids: Array.isArray(request.data?.confirmingUids) ? request.data.confirmingUids : [uid]
    }));
    return {
      ok: true,
      orderType: "botDeeRoomTab",
      payload: {
        roomId: plan.roomId,
        closeId: plan.closeId,
        venueName: plan.venueName,
        venueId: plan.venueId,
        amountCents: plan.amountCents
      },
      amountCents: plan.amountCents,
      payMode: plan.payMode
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.postBotDeeRoomTurn = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const roomId = core.text(request.data?.roomId, 80);
    const limited = await store.consumeRate("turn", roomId, {
      nowMs: Date.now(),
      windowMs: 60 * 1000,
      max: core.TURN_RATE_PER_MIN
    });
    if (!limited) fail("rate_limited");
    return unwrap(await store.appendTurn(roomId, uid, "user", request.data?.text || request.data?.message));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.scheduleBotDeeRoom = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.scheduleRoom({
      hostUid: uid,
      conversationId: core.text(request.data?.conversationId, 80),
      title: core.text(request.data?.title, 80),
      authorizedTitle: core.text(request.data?.authorizedTitle || request.data?.title, 80),
      authorizedDescription: core.text(request.data?.authorizedDescription, 240),
      scheduledStartMs: request.data?.scheduledStartMs,
      scheduledTimeZone: core.text(request.data?.scheduledTimeZone, 80),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.startBotDeeRoom = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.startRoom({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      conversationId: core.text(request.data?.conversationId, 80),
      title: core.text(request.data?.title, 80),
      authorizedTitle: core.text(request.data?.authorizedTitle || request.data?.title, 80),
      authorizedDescription: core.text(request.data?.authorizedDescription, 240),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.rescheduleBotDeeRoom = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.rescheduleRoom({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      scheduledStartMs: request.data?.scheduledStartMs,
      scheduledTimeZone: core.text(request.data?.scheduledTimeZone, 80),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.touchBotDeeRoomPresence = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    return unwrap(await store.touchPresence({
      uid,
      roomId: core.text(request.data?.roomId, 80)
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.listBotDeeRoomNotifications = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    return unwrap(await store.listNotifications({uid}));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.rsvpBotDeeRoomInvite = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.rsvpRoom({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      token: String(request.data?.token || ""),
      rsvp: core.text(request.data?.rsvp, 20),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.expireBotDeeRooms = onSchedule({
  region: "us-central1",
  schedule: "every 15 minutes",
  timeZone: "UTC",
  timeoutSeconds: 120,
  memory: "256MiB"
}, async () => {
  const actor = {role: "system"};
  return store.expireRooms({actorRole: actor.role});
});

exports.proposeBotDeeRoomTransaction = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.proposeSharedTransaction({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      kind: core.text(request.data?.kind, 24),
      snapshot: request.data?.snapshot && typeof request.data.snapshot === "object" ? request.data.snapshot : {},
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.voteBotDeeRoomTransaction = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.voteSharedTransaction({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      ballot: core.text(request.data?.ballot || request.data?.vote, 8),
      choiceId: core.text(request.data?.choiceId, 80),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.nominateBotDeeRoomHost = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.nominateHost({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      candidateUid: core.text(request.data?.candidateUid, 80) || uid,
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.voteBotDeeRoomHost = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    const actor = actorFrom(request);
    return unwrap(await store.voteHost({
      uid,
      roomId: core.text(request.data?.roomId, 80),
      ballot: core.text(request.data?.ballot || request.data?.vote, 8),
      actorEmail: actor.email,
      actorRole: actor.role
    }));
  } catch (error) {
    throw asHttps(error);
  }
});


exports.revokeBotDeeRoomInvite = onCall(CALL_OPTS, async request => {
  try {
    const uid = await requireSessionAuth(request);
    return unwrap(await store.revokeInvite({
      hostUid: uid,
      inviteId: core.text(request.data?.inviteId, 80)
    }));
  } catch (error) {
    throw asHttps(error);
  }
});

exports.__botDeeSessionHelpers = {
  requireSessionAuth,
  actorFrom,
  core,
  store
};
