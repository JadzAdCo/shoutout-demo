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

test("Mingl friends only; blocked pairs cannot invite", () => {
  const mutual = {status: "mutual", participants: ["host-1", "friend-1"]};
  const pending = {status: "pending", participants: ["host-1", "stranger"]};
  assert.equal(core.isMutualConnection(mutual, "host-1", "friend-1"), true);
  assert.equal(core.isMutualConnection(pending, "host-1", "stranger"), false);
  assert.equal(core.isBlockedRow({participants: ["host-1", "blocked"], active: true}, "host-1", "blocked"), true);
  assert.equal(core.isBlockedRow({blockedBy: "host-1", blockedUid: "blocked"}, "host-1", "blocked"), true);
});

test("cap is host plus 7; guests can invite unless host disables", () => {
  const full = room({memberUids: ["host-1", "g1", "g2", "g3", "g4", "g5", "g6", "g7"]});
  assert.equal(core.currentMembers(full).length, 8);
  assert.equal(core.canInviteMore(full, "host-1", {canInvite: true}).reason, "full");
  const open = room({memberUids: ["host-1", "guest-1"]});
  assert.equal(core.canInviteMore(open, "guest-1", {canInvite: true}).ok, true);
  assert.equal(core.canInviteMore(open, "guest-1", {canInvite: false}).reason, "invite_disabled");
  assert.equal(core.canInviteMore(open, "host-1", {canInvite: false}).ok, true);
  assert.equal(core.canInviteMore(open, "stranger", {canInvite: true}).reason, "not_member");
  assert.equal(core.canInviteMore(room({status: "ended"}), "host-1", {canInvite: true}).reason, "closed");
});

test("host kick removes membership; kicked uid is not a current member", () => {
  const live = room({memberUids: ["host-1", "guest-1", "guest-2"]});
  const next = core.currentMembers(live).filter(id => id !== "guest-1");
  assert.equal(core.isCurrentMember({...live, memberUids: next}, "guest-1"), false);
  assert.equal(core.isCurrentMember({...live, memberUids: next}, "guest-2"), true);
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

test("client join captures room=&t= and Inbox is not a ShoutOut CTA", () => {
  const chat = read("bot-dee-chat.js");
  assert.match(chat, /acceptBotDeeRoomInvite/);
  assert.match(chat, /searchParams\.get\("t"\)/);
  assert.match(chat, /searchParams\.get\("room"\)/);
  assert.match(chat, /joinToken/);
  assert.match(read("patron-portal-app.js"), /Review BOT DEE invite/);
  assert.match(read("patron-portal-app.js"), /botdeeroominvite/);
  assert.doesNotMatch(read("botdee-smartview.js"), /createBotDeeRoom\b/);
  assert.match(read("botdee-smartview.js"), /createBotDeeRoomInvite/);
  assert.match(read("botdee-smartview.js"), /listBotDeeRoomFriends/);
  assert.match(read("functions/index.js"), /acceptBotDeeRoomInvite/);
  assert.match(read("functions/commerce-functions.js"), /botDeeRoomTab/);
  assert.match(read("functions/commerce-functions.js"), /assertFeatureAccess\(request\.auth, "mingl"/);
});

test("callables re-check botDee + mingl; guests cannot end", () => {
  const fns = read("functions/botdee-session-functions.js");
  assert.match(fns, /assertFeatureAccess\(request\.auth, "botDee"/);
  assert.match(fns, /assertFeatureAccess\(request\.auth, "mingl"/);
  assert.match(fns, /inviteBotDeeRoomGuest/);
  assert.match(fns, /kickBotDeeRoomMember/);
  assert.match(fns, /endBotDeeRoom/);
  assert.match(read("functions/botdee-session-store.js"), /not_host/);
  assert.match(read("functions/botdee-session-store.js"), /unpaid_tab/);
});
