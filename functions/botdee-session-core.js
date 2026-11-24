/* BOT DEE + Mingl shared session — rooms, Mingl-only invites, shared thread, itinerary, tab.
   Design: botdee-session-invite-design.md. No IP. No private thread copy. No last4 on other members. */
"use strict";

const crypto = require("crypto");

const MEMBER_CAP = 8;
const TOKEN_BYTES = 32;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const ROOM_TTL_MS = 4 * 60 * 60 * 1000;
const INVITE_RATE_PER_HOUR = 12;
const TURN_RATE_PER_MIN = 20;
const INVITE_PREFIX = "floqr-botdee-room-invite:";
const PII_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PII_PHONE = /\+?\d[\d\s().-]{8,}\d/g;
const PII_WORDS = /\b(smartsummary|smart summary|dating profile|hide flags?|email|phone|gps|ip address)\b/gi;

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function pairId(a, b) {
  return [text(a, 80), text(b, 80)].filter(Boolean).sort().join("_");
}

function memberDocId(roomId, uid) {
  return `${text(roomId, 80)}_${text(uid, 80)}`;
}

function mintInviteToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function isValidInviteToken(token) {
  return /^[A-Za-z0-9_-]{43}$/.test(String(token || ""));
}

function inviteIdFor(token) {
  return crypto.createHash("sha256").update(`${INVITE_PREFIX}${token}`).digest("hex");
}

function hashInviteToken(token) {
  return inviteIdFor(token);
}

function publicOrigin() {
  return String(process.env.FLOQR_PUBLIC_ORIGIN || "https://jadzadco.github.io/shoutout-demo").replace(/\/$/, "");
}

function inviteHref(roomId, token) {
  const room = encodeURIComponent(text(roomId, 80));
  const t = encodeURIComponent(String(token || ""));
  return `${publicOrigin()}/botdee.html?room=${room}&t=${t}`;
}

function isMutualConnection(row, uidA, uidB) {
  const a = text(uidA, 80);
  const b = text(uidB, 80);
  if (!row || !a || !b || a === b) return false;
  const status = text(row.status, 20).toLowerCase();
  if (status !== "mutual") return false;
  const parts = Array.isArray(row.participants) ? row.participants.map(id => text(id, 80)) : [];
  return parts.includes(a) && parts.includes(b);
}

function isBlockedRow(row, uidA, uidB) {
  if (!row) return false;
  if (row.active === false) return false;
  const a = text(uidA, 80);
  const b = text(uidB, 80);
  const parts = Array.isArray(row.participants) ? row.participants.map(id => text(id, 80)) : [];
  if (parts.includes(a) && parts.includes(b)) return true;
  const blocker = text(row.blockedBy || row.blockedByUid, 80);
  const blocked = text(row.blockedUid, 80);
  return (blocker === a && blocked === b) || (blocker === b && blocked === a);
}

function evaluateInvite(invite, {uid = "", nowMs = Date.now(), roomId = ""} = {}) {
  if (!invite) return {ok: false, reason: "not_found"};
  if (text(invite.status, 20) === "accepted" || Number(invite.usesRemaining) === 0) {
    return {ok: false, reason: "used"};
  }
  if (text(invite.status, 20) === "revoked") return {ok: false, reason: "revoked"};
  if (text(invite.status, 20) === "expired") return {ok: false, reason: "expired"};
  if (text(invite.status, 20) !== "pending") return {ok: false, reason: "not_found"};
  if (Number(invite.expiresAtMs || 0) <= nowMs) return {ok: false, reason: "expired"};
  if (roomId && text(invite.roomId, 80) && text(invite.roomId, 80) !== text(roomId, 80)) {
    return {ok: false, reason: "not_found"};
  }
  if (!uid || text(invite.targetUid, 80) !== text(uid, 80)) return {ok: false, reason: "wrong_account"};
  return {ok: true, reason: ""};
}

function roomIsOpen(row, nowMs = Date.now()) {
  if (!row) return false;
  if (text(row.status, 20) !== "open") return false;
  const expires = Number(row.expiresAtMs || 0);
  if (expires && expires <= nowMs) return false;
  return true;
}

function currentMembers(row) {
  const members = Array.isArray(row?.memberUids) ? row.memberUids.map(id => text(id, 80)).filter(Boolean) : [];
  const host = text(row?.hostUid, 80);
  if (host && !members.includes(host)) members.unshift(host);
  return [...new Set(members)].slice(0, MEMBER_CAP);
}

function isCurrentMember(row, uid) {
  return currentMembers(row).includes(text(uid, 80));
}

function canInviteMore(row, actorUid, memberRow) {
  const actor = text(actorUid, 80);
  if (!roomIsOpen(row)) return {ok: false, reason: "closed"};
  if (!isCurrentMember(row, actor)) return {ok: false, reason: "not_member"};
  if (currentMembers(row).length >= MEMBER_CAP) return {ok: false, reason: "full"};
  const isHost = text(row.hostUid, 80) === actor;
  if (isHost) return {ok: true, reason: ""};
  const canInvite = memberRow
    ? memberRow.canInvite !== false && memberRow.canInvite !== 0
    : true;
  if (!canInvite) return {ok: false, reason: "invite_disabled"};
  return {ok: true, reason: ""};
}

function inviteeAllowed({friendsWithInviter, blockedWithHost} = {}) {
  if (blockedWithHost) return {ok: false, reason: "not_friend"};
  if (!friendsWithInviter) return {ok: false, reason: "not_friend"};
  return {ok: true, reason: ""};
}

function classifyInviteTarget({actorUid = "", targetUid = "", memberUids = []} = {}) {
  const actor = text(actorUid, 80);
  const target = text(targetUid, 80);
  if (!target) return {ok: false, reason: "not_found"};
  if (actor && target === actor) return {ok: false, reason: "self"};
  const members = (Array.isArray(memberUids) ? memberUids : []).map(id => text(id, 80)).filter(Boolean);
  if (members.includes(target)) return {ok: false, reason: "already_member"};
  return {ok: true, reason: "invite"};
}

function decorateFriendInviteState(friends, {actorUid = "", memberUids = []} = {}) {
  const actor = text(actorUid, 80);
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(friends) ? friends : []) {
    const uid = text(row && row.uid, 80);
    if (!uid || uid === actor || seen.has(uid)) continue;
    seen.add(uid);
    const state = classifyInviteTarget({actorUid: actor, targetUid: uid, memberUids});
    out.push({
      uid,
      displayName: text(row.displayName, 80),
      handle: text(row.handle, 40),
      inviteState: state.ok ? "invite" : state.reason
    });
  }
  return out;
}

function matchNamedInvitees(friends, needles) {
  const names = (Array.isArray(needles) ? needles : [])
    .map(row => text(row && (row.displayName || row), 40).toLowerCase())
    .filter(Boolean);
  if (!names.length) return [];
  const scored = [];
  for (const row of Array.isArray(friends) ? friends : []) {
    if (!row || !text(row.uid, 80)) continue;
    const display = text(row.displayName, 80).toLowerCase();
    const handle = text(row.handle, 40).toLowerCase();
    let best = 0;
    for (const name of names) {
      if (display === name || handle === name) best = Math.max(best, 3);
      else if (display.startsWith(`${name} `) || display.endsWith(` ${name}`)) best = Math.max(best, 2);
      else if (display.includes(name) || handle.includes(name)) best = Math.max(best, 1);
    }
    if (best) scored.push({row, best});
  }
  scored.sort((a, b) => b.best - a.best);
  if (!scored.length) return [];
  const top = scored[0].best;
  return scored.filter(item => item.best === top).map(item => item.row);
}

function admitMember(row, uid) {
  const members = currentMembers(row);
  const id = text(uid, 80);
  if (!id) return {ok: false, reason: "not_found", alreadyMember: false, memberUids: members};
  if (members.includes(id)) return {ok: true, alreadyMember: true, memberUids: members};
  if (members.length >= MEMBER_CAP) return {ok: false, reason: "full", alreadyMember: false, memberUids: members};
  return {ok: true, alreadyMember: false, memberUids: members.concat([id])};
}

function matchGuests(members, hostUid, needles) {
  const host = text(hostUid, 80);
  const names = (Array.isArray(needles) ? needles : [])
    .map(row => text(row && (row.displayName || row), 40).toLowerCase())
    .filter(Boolean);
  if (!names.length) return [];
  return (Array.isArray(members) ? members : []).filter(row => {
    if (!row || text(row.uid, 80) === host) return false;
    const hay = `${text(row.displayName, 80)} ${text(row.handle, 40)}`.toLowerCase();
    return names.some(name => hay.includes(name));
  });
}

function canSetTabLineStatus({tab, line, uid, status, hostUid} = {}) {
  const actor = text(uid, 80);
  const next = text(status, 20);
  const current = text(line?.status, 20);
  if (!actor) return {ok: false, reason: "not_member"};
  if (current === "paid") return {ok: false, reason: "tab_closed"};
  if (next === "accepted") {
    if (current === "void") return {ok: false, reason: "tab_closed"};
    const assigned = text(line?.assignedUid || line?.addedByUid, 80);
    if (actor !== assigned) return {ok: false, reason: "not_assignee"};
    return canAttachLine(tab, assigned);
  }
  if (next === "void") {
    if (text(tab?.status, 20) === "paid") return {ok: false, reason: "tab_closed"};
    const assigned = text(line?.assignedUid, 80);
    const addedBy = text(line?.addedByUid, 80);
    const host = text(hostUid, 80);
    if (actor !== assigned && actor !== addedBy && actor !== host) return {ok: false, reason: "not_host"};
    return {ok: true, reason: ""};
  }
  return {ok: false, reason: "tab_closed"};
}

function publicPerson(uid, user) {
  const row = user && typeof user === "object" ? user : {};
  return {
    uid: text(uid, 80),
    displayName: text(row.displayName || row.fullName || row.preferredName || "", 80),
    handle: text(row.floqrHandle || row.handle || "", 40)
  };
}

function stripPrivateSignals(value) {
  return String(value == null ? "" : value)
    .replace(PII_EMAIL, "[redacted]")
    .replace(PII_PHONE, "[redacted]")
    .replace(PII_WORDS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

function sanitizeRoomTurns(turns) {
  return (Array.isArray(turns) ? turns : []).slice(-12).map(row => ({
    role: row && row.role === "user" ? "user" : "model",
    text: stripPrivateSignals(row && (row.text || row.body || ""))
  })).filter(row => row.text);
}

function publicRoom(id, row, extra = {}) {
  const members = currentMembers(row);
  return {
    roomId: text(id, 80),
    hostUid: text(row.hostUid, 80),
    memberUids: members,
    participantCount: Math.min(MEMBER_CAP, members.length || 1),
    participantCap: MEMBER_CAP,
    status: roomIsOpen(row) ? "open" : (text(row.status, 20) || "ended"),
    conversationId: text(row.conversationId, 80),
    expiresAtMs: Number(row.expiresAtMs || 0) || 0,
    sharedIntent: publicIntent(row.sharedIntent),
    joinHref: extra.joinHref || "",
    roomsLive: true,
    minglFriendsOnly: true,
    guestsCanInvite: true,
    tabOptIn: extra.tabOptIn === true,
    charge: false
  };
}

function publicIntent(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return {
    venueId: text(row.venueId || row.clubLocationId, 80),
    venueName: text(row.venueName, 80),
    night: text(row.night || row.eventDate, 40),
    partySize: Math.max(0, Math.min(MEMBER_CAP, Number(row.partySize) || 0)),
    ticketUrl: text(row.ticketUrl, 240),
    vipSectionId: text(row.vipSectionId, 80),
    notes: stripPrivateSignals(row.notes || "").slice(0, 240)
  };
}

function publicTab(tab, lines, viewerUid) {
  const row = tab && typeof tab === "object" ? tab : {};
  const viewer = text(viewerUid, 80);
  const list = Array.isArray(lines) ? lines : [];
  return {
    roomId: text(row.roomId, 80),
    status: text(row.status, 20) || "open",
    venueId: text(row.venueId, 80),
    venueName: text(row.venueName, 80),
    collector: "floqrStripe",
    openedByUid: text(row.openedByUid, 80),
    participantUids: Array.isArray(row.participantUids) ? row.participantUids.map(id => text(id, 80)).filter(Boolean) : [],
    optedInUids: Array.isArray(row.optedInUids) ? row.optedInUids.map(id => text(id, 80)).filter(Boolean) : [],
    payMode: text(row.payMode, 20),
    viewerOptedIn: Array.isArray(row.optedInUids) && row.optedInUids.includes(viewer),
    lines: list.map(line => publicTabLine(line, viewer)),
    totalCents: list
      .filter(line => text(line.status, 20) === "accepted" || text(line.status, 20) === "paid")
      .reduce((sum, line) => sum + Math.max(0, Number(line.amountCents) || 0), 0)
  };
}

function publicTabLine(line, viewerUid) {
  const row = line && typeof line === "object" ? line : {};
  const status = text(row.status, 20) || "proposed";
  const payer = text(row.paidByUid, 80);
  const viewer = text(viewerUid, 80);
  return {
    lineId: text(row.lineId || row.id, 80),
    addedByUid: text(row.addedByUid, 80),
    assignedUid: text(row.assignedUid, 80),
    item: text(row.item, 80),
    amountCents: Math.max(0, Math.round(Number(row.amountCents) || 0)),
    status,
    payState: status === "paid" ? "paid" : (status === "void" ? "void" : "pending"),
    paidByUid: payer && payer === viewer ? payer : (status === "paid" ? "member" : ""),
    cardLast4: ""
  };
}

function optedIn(tab, uid) {
  const id = text(uid, 80);
  return Array.isArray(tab?.optedInUids) && tab.optedInUids.includes(id);
}

function canAttachLine(tab, assignedUid) {
  if (!tab || text(tab.status, 20) !== "open") return {ok: false, reason: "tab_closed"};
  if (!optedIn(tab, assignedUid)) return {ok: false, reason: "no_opt_in"};
  return {ok: true, reason: ""};
}

function closeTabPlan(tab, lines, {mode, payerUid, confirmingUids} = {}) {
  const payMode = text(mode, 20) === "split" ? "split" : "one_payer";
  const accepted = (Array.isArray(lines) ? lines : []).filter(line => text(line.status, 20) === "accepted");
  if (!accepted.length) return {ok: false, reason: "no_lines"};
  if (text(tab?.status, 20) !== "open" && text(tab?.status, 20) !== "closing") {
    return {ok: false, reason: "tab_closed"};
  }
  if (payMode === "one_payer") {
    const payer = text(payerUid, 80);
    if (!payer) return {ok: false, reason: "missing_payer"};
    if (!optedIn(tab, payer)) return {ok: false, reason: "no_opt_in"};
    const amountCents = accepted.reduce((sum, line) => sum + Math.max(0, Number(line.amountCents) || 0), 0);
    if (amountCents < 50) return {ok: false, reason: "amount"};
    return {
      ok: true,
      payMode,
      charges: [{uid: payer, amountCents, lineIds: accepted.map(line => text(line.lineId || line.id, 80))}]
    };
  }
  const confirmers = new Set((Array.isArray(confirmingUids) ? confirmingUids : []).map(id => text(id, 80)).filter(Boolean));
  const byUid = new Map();
  for (const line of accepted) {
    const uid = text(line.assignedUid || line.addedByUid, 80);
    if (!uid) return {ok: false, reason: "no_opt_in"};
    if (!optedIn(tab, uid)) return {ok: false, reason: "no_opt_in"};
    if (!confirmers.has(uid)) continue;
    const bucket = byUid.get(uid) || {uid, amountCents: 0, lineIds: []};
    bucket.amountCents += Math.max(0, Number(line.amountCents) || 0);
    bucket.lineIds.push(text(line.lineId || line.id, 80));
    byUid.set(uid, bucket);
  }
  const charges = [...byUid.values()].filter(row => row.amountCents >= 50);
  if (!charges.length) return {ok: false, reason: "no_confirming_uids"};
  return {ok: true, payMode, charges};
}

function unpaidTabBlocksDelete(tab, lines) {
  if (!tab) return false;
  const status = text(tab.status, 20);
  if (status === "paid" || status === "void") return false;
  return (Array.isArray(lines) ? lines : []).some(line => {
    const st = text(line.status, 20);
    return st === "proposed" || st === "accepted";
  });
}

function rateLimitOk(doc, {nowMs, windowMs, max}) {
  const start = Number(doc?.windowStartMs || 0);
  const count = Number(doc?.count || 0);
  if (!start || nowMs - start >= windowMs) return {ok: true, next: {windowStartMs: nowMs, count: 1}};
  if (count >= max) return {ok: false, next: {windowStartMs: start, count}};
  return {ok: true, next: {windowStartMs: start, count: count + 1}};
}

function denialMessage(reason) {
  const map = {
    not_found: "That BOT DEE invite isn't available.",
    expired: "That BOT DEE invite expired.",
    revoked: "That BOT DEE invite was revoked.",
    used: "That BOT DEE invite was already used.",
    wrong_account: "Sign in as the Mingl friend this invite was sent to.",
    not_friend: "Invites are Mingl friends only.",
    blocked: "Invites are Mingl friends only.",
    self: "That's you — you're already in this BOT DEE session.",
    already_member: "That Mingl friend is already in this BOT DEE session.",
    full: "This BOT DEE session is full (host plus 7 guests).",
    closed: "This BOT DEE session has ended.",
    not_member: "You are not in this BOT DEE session.",
    not_assignee: "Only the person on that tab line can accept it.",
    not_host: "Only the host can do that.",
    invite_disabled: "The host turned off invites for your seat.",
    no_opt_in: "Opt in to the shared tab before a line can attach to you. Nobody is charged without that OK.",
    tab_closed: "That shared tab is closed.",
    unpaid_tab: "Void or pay the shared tab before ending this session.",
    no_lines: "There are no accepted tab lines to pay.",
    missing_payer: "Choose who is paying.",
    amount: "That tab total is too small to check out.",
    rate_limited: "Slow down — try again in a minute.",
    mingl_required: "Mingl friends and BOT DEE access are required."
  };
  return map[reason] || map.not_found;
}

module.exports = {
  MEMBER_CAP,
  TOKEN_BYTES,
  INVITE_TTL_MS,
  ROOM_TTL_MS,
  INVITE_RATE_PER_HOUR,
  TURN_RATE_PER_MIN,
  INVITE_PREFIX,
  text,
  pairId,
  memberDocId,
  mintInviteToken,
  isValidInviteToken,
  inviteIdFor,
  hashInviteToken,
  publicOrigin,
  inviteHref,
  isMutualConnection,
  isBlockedRow,
  evaluateInvite,
  roomIsOpen,
  currentMembers,
  isCurrentMember,
  canInviteMore,
  inviteeAllowed,
  classifyInviteTarget,
  decorateFriendInviteState,
  matchNamedInvitees,
  admitMember,
  matchGuests,
  canSetTabLineStatus,
  publicPerson,
  stripPrivateSignals,
  sanitizeRoomTurns,
  publicRoom,
  publicIntent,
  publicTab,
  publicTabLine,
  optedIn,
  canAttachLine,
  closeTabPlan,
  unpaidTabBlocksDelete,
  rateLimitOk,
  denialMessage
};
