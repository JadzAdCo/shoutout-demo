"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("./botdee-session-core");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function invite(overrides = {}) {
  return {
    status: "pending",
    targetUid: "friend-1",
    roomId: "br_room",
    usesRemaining: 1,
    expiresAtMs: Date.now() + 60_000,
    ...overrides
  };
}

function room(overrides = {}) {
  return {
    hostUid: "host-1",
    memberUids: ["host-1"],
    status: "open",
    expiresAtMs: Date.now() + 60_000,
    ...overrides
  };
}

function tab(overrides = {}) {
  return {
    roomId: "br_room",
    status: "open",
    optedInUids: ["host-1"],
    ...overrides
  };
}

test("invite token is 32-byte base64url and hashed, never stored as plaintext helper", () => {
  const token = core.mintInviteToken();
  assert.equal(core.isValidInviteToken(token), true);
  const hashed = core.hashInviteToken(token);
  assert.equal(hashed, core.inviteIdFor(token));
  assert.notEqual(hashed, token);
  assert.equal(hashed.length, 64);
  assert.match(core.inviteHref("br_abc", token), /botdee\.html\?room=br_abc&t=/);
  assert.doesNotMatch(core.inviteHref("br_abc", token), /[?&]v=/);
});

test("wrong-account / expired / revoked / used invites refuse", () => {
  const now = 1_700_000_000_000;
  assert.equal(core.evaluateInvite(invite(), {uid: "other", nowMs: now}).reason, "wrong_account");
  assert.equal(core.evaluateInvite(invite({expiresAtMs: now - 1}), {uid: "friend-1", nowMs: now}).reason, "expired");
  assert.equal(core.evaluateInvite(invite({status: "expired"}), {uid: "friend-1", nowMs: now}).reason, "expired");
  assert.equal(core.evaluateInvite(invite({status: "revoked"}), {uid: "friend-1", nowMs: now}).reason, "revoked");
  assert.equal(core.evaluateInvite(invite({status: "accepted", usesRemaining: 0}), {uid: "friend-1", nowMs: now}).reason, "used");
  assert.equal(core.evaluateInvite(invite({roomId: "other"}), {uid: "friend-1", nowMs: now, roomId: "br_room"}).reason, "not_found");
  assert.equal(core.evaluateInvite(invite(), {uid: "friend-1", nowMs: now, roomId: "br_room"}).ok, true);
});

test("self-invite and already-member are distinct from used/not_friend", () => {
  const members = ["host-1", "guest-1"];
  assert.equal(core.classifyInviteTarget({actorUid: "host-1", targetUid: "host-1", memberUids: members}).reason, "self");
  assert.equal(core.classifyInviteTarget({actorUid: "host-1", targetUid: "guest-1", memberUids: members}).reason, "already_member");
  assert.equal(core.classifyInviteTarget({actorUid: "host-1", targetUid: "friend-2", memberUids: members}).ok, true);
  assert.equal(core.denialMessage("self"), "That's you — you're already in this BOT DEE session.");
  assert.equal(core.denialMessage("already_member"), "That Mingl friend is already in this BOT DEE session.");
  const decorated = core.decorateFriendInviteState(
    [
      {uid: "host-1", displayName: "Don Bans"},
      {uid: "guest-1", displayName: "JuJu"},
      {uid: "friend-don", displayName: "Don"},
      {uid: "friend-don", displayName: "Don duplicate"}
    ],
    {actorUid: "host-1", memberUids: members}
  );
  assert.deepEqual(decorated.map(row => `${row.uid}:${row.inviteState}`), [
    "guest-1:already_member",
    "friend-don:invite"
  ]);
  const hits = core.matchNamedInvitees(decorated, [{displayName: "Don"}]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].uid, "friend-don");
  assert.equal(hits[0].inviteState, "invite");
  assert.equal(core.matchNamedInvitees(decorated, [{displayName: "Don Bans"}]).length, 0);
  assert.equal(core.ROOM_TTL_MS, 4 * 60 * 60 * 1000);
  assert.match(read("botdee-smartview.js"), /itineraryNotCalendar/);
  assert.match(read("botdee-smartview.js"), /permissionsNotSchedule/);
  assert.match(read("botdee-help-repository.js"), /Join Now or Set a schedule/);
  assert.match(read("functions/botdee-session-store.js"), /scheduledStartMs/);
  assert.match(read("functions/botdee-session-store.js"), /lastLogoutShouldClose/);
});

test("Mingl friends only; blocked pairs cannot invite", () => {
  const mutual = {status: "mutual", participants: ["host-1", "friend-1"]};
  const pending = {status: "pending", participants: ["host-1", "stranger"]};
  assert.equal(core.isMutualConnection(mutual, "host-1", "friend-1"), true);
  assert.equal(core.isMutualConnection(pending, "host-1", "stranger"), false);
  assert.equal(core.isBlockedRow({participants: ["host-1", "blocked"], active: true}, "host-1", "blocked"), true);
  assert.equal(core.isBlockedRow({blockedBy: "host-1", blockedUid: "blocked"}, "host-1", "blocked"), true);
  assert.equal(core.inviteeAllowed({friendsWithInviter: true, blockedWithHost: true}).reason, "not_friend");
  assert.equal(core.inviteeAllowed({friendsWithInviter: false, blockedWithHost: false}).reason, "not_friend");
  assert.equal(core.inviteeAllowed({friendsWithInviter: true, blockedWithHost: false}).ok, true);
});

test("cap is host plus 7; guests can invite unless host disables", () => {
  const full = room({memberUids: ["host-1", "g1", "g2", "g3", "g4", "g5", "g6", "g7"]});
  assert.equal(core.currentMembers(full).length, 8);
  assert.equal(core.canInviteMore(full, "host-1", {canInvite: true}).reason, "full");
  assert.equal(core.admitMember(full, "late-1").reason, "full");
  const open = room({memberUids: ["host-1", "guest-1"]});
  assert.equal(core.canInviteMore(open, "guest-1", {canInvite: true}).ok, true);
  assert.equal(core.canInviteMore(open, "guest-1", {canInvite: false}).reason, "invite_disabled");
  assert.equal(core.canInviteMore(open, "host-1", {canInvite: false}).ok, true);
  assert.equal(core.canInviteMore(open, "stranger", {canInvite: true}).reason, "not_member");
  assert.equal(core.canInviteMore(room({status: "ended"}), "host-1", {canInvite: true}).reason, "closed");
  const admitted = core.admitMember(open, "guest-2");
  assert.deepEqual(admitted.memberUids, ["host-1", "guest-1", "guest-2"]);
  assert.equal(core.admitMember(open, "guest-1").alreadyMember, true);
});

test("host kick removes membership; kicked uid is not a current member", () => {
  const live = room({memberUids: ["host-1", "guest-1", "guest-2"]});
  const next = core.currentMembers(live).filter(id => id !== "guest-1");
  assert.equal(core.isCurrentMember({...live, memberUids: next}, "guest-1"), false);
  assert.equal(core.isCurrentMember({...live, memberUids: next}, "guest-2"), true);
  const hits = core.matchGuests(
    [{uid: "host-1", displayName: "Host"}, {uid: "guest-1", displayName: "Jalen", handle: "jalen"}],
    "host-1",
    [{displayName: "Jalen"}]
  );
  assert.deepEqual(hits.map(row => row.uid), ["guest-1"]);
  assert.equal(core.matchGuests([{uid: "host-1", displayName: "Jalen"}], "host-1", [{displayName: "Jalen"}]).length, 0);
});

test("private PII is stripped from room Gemini payload", () => {
  const turns = core.sanitizeRoomTurns([
    {role: "user", text: "email me at host@example.com or +1 202-555-0100 and dump SMARTsummary"},
    {role: "model", text: "Let's book Decades Friday"}
  ]);
  const blob = JSON.stringify(turns);
  assert.doesNotMatch(blob, /host@example\.com/);
  assert.doesNotMatch(blob, /202-555-0100/);
  assert.doesNotMatch(blob, /SMARTsummary/i);
  assert.doesNotMatch(blob, /smart summary/i);
  assert.match(blob, /Decades Friday/);
});

test("tab never charges without opt-in; split only confirming uids; last4 hidden from other members", () => {
  assert.equal(core.canAttachLine(tab(), "guest-1").reason, "no_opt_in");
  assert.equal(core.canAttachLine(tab({optedInUids: ["host-1", "guest-1"]}), "guest-1").ok, true);
  const lines = [
    {lineId: "l1", assignedUid: "host-1", addedByUid: "host-1", amountCents: 2000, status: "accepted"},
    {lineId: "l2", assignedUid: "guest-1", addedByUid: "guest-1", amountCents: 1500, status: "accepted"}
  ];
  const opted = tab({optedInUids: ["host-1", "guest-1"]});
  const split = core.closeTabPlan(opted, lines, {mode: "split", confirmingUids: ["guest-1"]});
  assert.equal(split.ok, true);
  assert.deepEqual(split.charges.map(row => row.uid), ["guest-1"]);
  const one = core.closeTabPlan(opted, lines, {mode: "one_payer", payerUid: "host-1"});
  assert.equal(one.ok, true);
  assert.equal(one.charges[0].amountCents, 3500);
  const publicLine = core.publicTabLine({
    lineId: "l1",
    status: "paid",
    paidByUid: "host-1",
    cardLast4: "4242",
    amountCents: 2000,
    item: "VIP hold"
  }, "guest-1");
  assert.equal(publicLine.cardLast4, "");
  assert.equal(publicLine.paidByUid, "member");
  const payerView = core.publicTabLine({
    lineId: "l1",
    status: "paid",
    paidByUid: "host-1",
    amountCents: 2000,
    item: "VIP hold"
  }, "host-1");
  assert.equal(payerView.paidByUid, "host-1");
  assert.equal(core.unpaidTabBlocksDelete(opted, lines), true);
  assert.equal(core.unpaidTabBlocksDelete({status: "paid"}, lines), false);
  const lineA = {lineId: "l1", assignedUid: "guest-1", addedByUid: "host-1", status: "proposed"};
  assert.equal(core.canSetTabLineStatus({tab: opted, line: lineA, uid: "host-1", status: "accepted", hostUid: "host-1"}).reason, "not_assignee");
  assert.equal(core.canSetTabLineStatus({tab: opted, line: lineA, uid: "guest-1", status: "accepted", hostUid: "host-1"}).ok, true);
  assert.equal(core.canSetTabLineStatus({tab: {...opted, status: "closing"}, line: lineA, uid: "guest-1", status: "accepted", hostUid: "host-1"}).reason, "tab_closed");
  assert.equal(core.canSetTabLineStatus({tab: opted, line: lineA, uid: "guest-2", status: "void", hostUid: "host-1"}).reason, "not_host");
  assert.equal(core.canSetTabLineStatus({tab: opted, line: lineA, uid: "host-1", status: "void", hostUid: "host-1"}).ok, true);
});

test("Firestore: invites Functions-only; events member-read; no IP", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /s3\.3\.047-botdee-mingl-session/);
  const invites = rules.slice(rules.indexOf("match /botDeeRoomInvites/{inviteId}"));
  assert.match(invites, /allow read, write: if false;/);
  const roomsBlock = rules.slice(rules.indexOf("match /botDeeRooms/{roomId}"));
  assert.match(roomsBlock, /match \/events\/\{eventId\}/);
  assert.match(roomsBlock, /request\.auth\.uid in get\(\/databases\/\$\(database\)\/documents\/botDeeRooms\/\$\(roomId\)\)\.data\.memberUids/);
  assert.match(roomsBlock, /allow write: if false;/);
  assert.doesNotMatch(read("functions/botdee-session-store.js"), /clientIp|requestIp|sourceIp[^H]/);
  assert.doesNotMatch(read("functions/botdee-session-core.js"), /last4OnOther|cardLast4: text/);
});

test("BOT DEE subset deploy lists first-time session callables and tab checkout", () => {
  const workflow = read(".github/workflows/functions-ci.yml");
  assert.match(workflow, /createBotDeeRoomInvite/);
  assert.match(workflow, /acceptBotDeeRoomInvite/);
  assert.match(workflow, /kickBotDeeRoomMember/);
  assert.match(workflow, /nominateBotDeeRoomHost/);
  assert.match(workflow, /voteBotDeeRoomTransaction/);
  assert.match(workflow, /createFloqrCheckoutSession/);
  assert.match(workflow, /startBotDeeRoom/);
  assert.match(workflow, /scheduleBotDeeRoom/);
});

test("client join captures room=&t= and Inbox is not a ShoutOut CTA", () => {
  const chat = read("bot-dee-chat.js");
  assert.match(chat, /acceptBotDeeRoomInvite/);
  assert.match(chat, /searchParams\.get\("t"\)/);
  assert.match(chat, /searchParams\.get\("room"\)/);
  assert.match(chat, /joinToken/);
  assert.doesNotMatch(chat, /acceptPendingInvite\(\)\.finally/);
  assert.match(chat, /if \(joined && joined\.ok\)/);
  assert.match(read("patron-portal-app.js"), /Review BOT DEE invite/);
  assert.match(read("patron-portal-app.js"), /botdeeroominvite/);
  assert.doesNotMatch(read("botdee-smartview.js"), /createBotDeeRoom\b/);
  assert.match(read("botdee-smartview.js"), /createBotDeeRoomInvite/);
  assert.match(read("botdee-smartview.js"), /listBotDeeRoomFriends/);
  assert.match(read("botdee-smartview.js"), /botdee\.room\.self/);
  assert.match(read("botdee-smartview.js"), /botdee\.room\.alreadyMember/);
  assert.match(read("botdee-smartview.js"), /botdee\.rs\.itineraryNotCalendar/);
  assert.match(read("botdee-smartview.js"), /botdee\.rs\.permissionsNotSchedule/);
  assert.match(read("botdee-smartview.js"), /data-rs-invite-state/);
  assert.match(read("botdee-smartview.js"), /data-rs-kick-uid/);
  assert.match(read("botdee-smartview.js"), /kickBotDeeRoomMember/);
  assert.match(read("functions/index.js"), /acceptBotDeeRoomInvite/);
  assert.match(read("functions/commerce-functions.js"), /botDeeRoomTab/);
  assert.match(read("functions/commerce-functions.js"), /assertFeatureAccess\(request\.auth, "mingl"/);
});

test("collab votes and host election are Functions-write", () => {
  assert.match(read("functions/botdee-session-core.js"), /HOST_ELECTION_RATIO = 0\.6/);
  assert.match(read("functions/botdee-session-store.js"), /proposeSharedTransaction/);
  assert.match(read("functions/botdee-session-store.js"), /nominateHost/);
  assert.match(read("functions/index.js"), /voteBotDeeRoomHost/);
  assert.match(read("botdee-smartview.js"), /Make me host/);
});

test("callables re-check botDee + mingl; guests cannot end", () => {
  const fns = read("functions/botdee-session-functions.js");
  assert.match(fns, /assertFeatureAccess\(request\.auth, "botDee"/);
  assert.match(fns, /assertFeatureAccess\(request\.auth, "mingl"/);
  assert.match(fns, /inviteBotDeeRoomGuest/);
  assert.match(fns, /already_member/);
  assert.match(fns, /decorateFriendInviteState/);
  assert.match(fns, /kickBotDeeRoomMember/);
  assert.match(fns, /endBotDeeRoom/);
  assert.match(fns, /viewerIsHost/);
  assert.match(read("functions/botdee-session-store.js"), /not_host/);
  assert.match(read("functions/botdee-session-store.js"), /unpaid_tab/);
  const store = read("functions/botdee-session-store.js");
  assert.match(store, /tx\.get\(inviteSnap\.ref\)/);
  assert.match(store, /tx\.get\(roomRef\(live\.id\)\)/);
  assert.match(store, /admitMember/);
  assert.match(store, /isBlockedPair\(hostUid/);
  assert.match(store, /canSetTabLineStatus/);
  assert.match(read("functions/bot-dee-functions.js"), /roomId: stored\.joinedRoomId/);
  assert.match(read("functions/bot-dee-functions.js"), /kickRoom && stored\.joinedRoomId/);
  assert.match(read("functions/bot-dee-functions.js"), /inviteRoom && stored\.joinedRoomId/);
  assert.match(read("functions/botdee-room-live.js"), /function inviteNamedGuests/);
  assert.match(read("functions/botdee-session-store.js"), /classifyInviteTarget/);
  assert.match(read("functions/botdee-room-live.js"), /function kickMember/);
  assert.match(read("functions/botdee-room-live.js"), /resolveKickTarget/);
});

test("Join Now does not notify Search; schedule does; TTL starts at live open", () => {
  const now = 1_700_000_000_000;
  const joinNow = room({
    status: "open",
    smartNotification: 0,
    liveOpenedAtMs: now,
    expiresAtMs: now + core.ROOM_TTL_MS
  });
  const scheduled = room({
    status: "scheduled",
    smartNotification: 1,
    scheduledStartMs: now + 60 * 60 * 1000,
    liveOpenedAtMs: 0,
    expiresAtMs: now + 60 * 60 * 1000 + core.ROOM_TTL_MS
  });
  assert.equal(core.roomNotifiesSearch(joinNow), false);
  assert.equal(core.roomNotifiesSearch(scheduled), true);
  assert.equal(core.roomIsInviteable(scheduled, now), true);
  assert.equal(core.scheduleStartValid(now - 1, now), false);
  assert.equal(core.scheduleStartValid(now + core.SCHEDULE_MIN_LEAD_MS + 1, now), true);
  assert.equal(core.ttlExpiresAtMs({liveOpenedAtMs: now, scheduledStartMs: now + 99_000}, now), now + core.ROOM_TTL_MS);
  assert.equal(core.ttlExpiresAtMs({scheduledStartMs: now + 3_600_000, liveOpenedAtMs: 0}, now), now + 3_600_000 + core.ROOM_TTL_MS);
  assert.equal(core.PRESENCE_STALE_MS, 15 * 60 * 1000);
  assert.equal(core.lastLogoutShouldClose(joinNow, [{uid: "host-1", lastPresenceAtMs: now}], now), false);
  assert.equal(core.lastLogoutShouldClose(joinNow, [{uid: "host-1", lastPresenceAtMs: now - core.PRESENCE_STALE_MS}], now), true);
  assert.equal(core.lastLogoutShouldClose(joinNow, [{uid: "host-1", leftAtMs: now}], now), true);
  assert.equal(core.lastLogoutShouldClose(scheduled, [{uid: "host-1", lastPresenceAtMs: 0}], now), false);
  assert.equal(core.denialMessage("past"), "Pick a future time for the BOT DEE room.");
  assert.equal(core.denialMessage("already_open"), "This BOT DEE session is already live.");
  assert.equal(core.denialMessage("not_scheduled"), "That BOT DEE room is not scheduled.");
  assert.equal(core.denialMessage("not_live"), "This BOT DEE room is not live yet.");
  const notify = core.publicNotification("br_room", scheduled, {hostName: "Don", token: "tok"});
  assert.equal(notify.smartNotification, 1);
  assert.match(notify.joinHref, /botdee\.html\?room=br_room/);
  assert.doesNotMatch(notify.joinHref, /mingl-chat\.html/);
  assert.doesNotMatch(notify.joinHref, /[?&]v=/);
});

test("schedule callables, Search list, and Join Now never open mingl-chat", () => {
  const store = read("functions/botdee-session-store.js");
  const fns = read("functions/botdee-session-functions.js");
  const index = read("functions/index.js");
  const workflow = read(".github/workflows/functions-ci.yml");
  const view = read("smartvisuals-view.js");
  const card = read("botdee-smartview.js");
  assert.match(store, /function scheduleRoom/);
  assert.match(store, /function startRoom/);
  assert.match(store, /function listNotifications/);
  assert.match(store, /smartNotification: 0/);
  assert.match(store, /smartNotification: 1/);
  assert.match(store, /expireRooms/);
  assert.match(fns, /scheduleBotDeeRoom/);
  assert.match(fns, /startBotDeeRoom/);
  assert.match(fns, /rescheduleBotDeeRoom/);
  assert.match(fns, /touchBotDeeRoomPresence/);
  assert.match(fns, /listBotDeeRoomNotifications/);
  assert.match(fns, /rsvpBotDeeRoomInvite/);
  assert.match(fns, /expireBotDeeRooms/);
  assert.match(fns, /expireBotDeeRooms = onSchedule/);
  assert.match(index, /scheduleBotDeeRoom/);
  assert.match(index, /listBotDeeRoomNotifications/);
  assert.match(index, /expireBotDeeRooms/);
  assert.match(workflow, /scheduleBotDeeRoom/);
  assert.match(workflow, /listBotDeeRoomNotifications/);
  assert.match(workflow, /expireBotDeeRooms/);
  assert.match(card, /startBotDeeRoom/);
  assert.match(card, /scheduleBotDeeRoom/);
  assert.match(card, /data-rs-join-now/);
  assert.match(card, /data-rs-set-schedule/);
  assert.match(card, /touchBotDeeRoomPresence/);
  assert.match(view, /listBotDeeRoomNotifications/);
  assert.match(view, /botdee\.html/);
  assert.doesNotMatch(view, /mingl-chat\.html\?/);
  assert.match(view, /if \(\/mingl-chat\\.html\/i\.test\(href\)\)/);
  assert.match(read("botdee-help-repository.js"), /help-botdee-room-smartview-schedule/);
  assert.match(read("docs/FEATURE-WIRING.md"), /s3\.3\.071-botdee-room-schedule/);
});
