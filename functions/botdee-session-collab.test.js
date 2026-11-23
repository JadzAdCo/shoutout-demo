"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("./botdee-session-core");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function room(overrides = {}) {
  return {
    hostUid: "host-1",
    memberUids: ["host-1", "g1", "g2"],
    status: "open",
    expiresAtMs: Date.now() + 60_000,
    ...overrides
  };
}

test("votesNeeded is ceil of 60% of currently joined members", () => {
  assert.equal(core.HOST_ELECTION_RATIO, 0.6);
  assert.equal(core.votesNeeded(1), 1);
  assert.equal(core.votesNeeded(2), 2);
  assert.equal(core.votesNeeded(3), 2);
  assert.equal(core.votesNeeded(4), 3);
  assert.equal(core.votesNeeded(5), 3);
  assert.equal(core.votesNeeded(8), 5);
});

test("solo host auto-passes choice and self-nomination", () => {
  const solo = room({memberUids: ["host-1"]});
  const proposed = core.proposeSharedTransaction({
    room: solo,
    actorUid: "host-1",
    kind: "vip",
    snapshot: {clubLocationId: "aurelia", night: "2026-11-23", sectionId: "v1", sectionLabel: "V1", partySize: 4},
    nowMs: 1
  });
  assert.equal(proposed.ok, true);
  assert.equal(proposed.sharedTransaction.votes["host-1"], "yes");
  const gated = core.canCommitSharedChoice({...solo, sharedTransaction: proposed.sharedTransaction});
  assert.equal(gated.ok, true);
  const elected = core.nominateHost({room: solo, actorUid: "host-1", candidateUid: "host-1", nowMs: 1});
  assert.equal(elected.ok, true);
  assert.equal(elected.elected, true);
  assert.equal(elected.hostUid, "host-1");
});

test("three members need two yes votes; host change resets votes", () => {
  const live = room();
  const first = core.proposeSharedTransaction({
    room: live,
    actorUid: "host-1",
    kind: "vip",
    snapshot: {clubLocationId: "aurelia", night: "2026-11-23", sectionId: "v1", sectionLabel: "V1", partySize: 4},
    nowMs: 1
  });
  const afterHost = {...live, sharedTransaction: first.sharedTransaction};
  const g1 = core.voteSharedTransaction({room: afterHost, actorUid: "g1", ballot: "yes"});
  assert.equal(g1.tally.passed, true);
  assert.equal(g1.tally.needed, 2);
  const nextTable = core.proposeSharedTransaction({
    room: {...afterHost, sharedTransaction: g1.sharedTransaction},
    actorUid: "host-1",
    kind: "vip",
    snapshot: {clubLocationId: "aurelia", night: "2026-11-23", sectionId: "v2", sectionLabel: "V2", partySize: 4},
    nowMs: 2
  });
  assert.equal(nextTable.sharedTransaction.choiceId.includes("v2"), true);
  assert.equal(nextTable.sharedTransaction.votes.g1, undefined);
  assert.equal(nextTable.sharedTransaction.votes["host-1"], "yes");
  assert.equal(core.canCommitSharedChoice({...live, sharedTransaction: nextTable.sharedTransaction}).ok, false);
});

test("guest cannot propose; clip drops checkout secrets", () => {
  const live = room();
  const denied = core.proposeSharedTransaction({
    room: live,
    actorUid: "g1",
    kind: "vip",
    snapshot: {clubLocationId: "aurelia", checkoutUrl: "https://checkout.stripe.com/secret"},
    nowMs: 1
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "not_host");
  const clipped = core.clipSharedTransaction({
    kind: "vip",
    snapshot: {clubLocationId: "aurelia", checkoutUrl: "https://checkout.stripe.com/c", sectionId: "v1", partySize: 2},
    votes: {x: "yes"}
  });
  assert.equal(JSON.stringify(clipped.snapshot).includes("checkout"), false);
});

test("anyone can nominate; 60% of joined members elects", () => {
  const live = room({memberUids: ["host-1", "g1", "g2", "g3", "g4"]});
  const nom = core.nominateHost({room: live, actorUid: "g1", candidateUid: "g1", nowMs: 1});
  assert.equal(nom.elected, false);
  assert.equal(nom.tally.needed, 3);
  const mid = {...live, hostBallot: nom.hostBallot};
  const v2 = core.voteHost({room: mid, actorUid: "g2", ballot: "yes"});
  assert.equal(v2.elected, false);
  const v3 = core.voteHost({room: {...mid, hostBallot: v2.hostBallot}, actorUid: "g3", ballot: "yes"});
  assert.equal(v3.elected, true);
  assert.equal(v3.hostUid, "g1");
  assert.equal(v3.hostBallot.candidateUid, "");
});

test("host leave with others remaining does not end; last remaining becomes host", () => {
  const three = room();
  const exit = core.applyMemberExit(three, "host-1");
  assert.equal(exit.end, false);
  assert.equal(exit.hostUid, "");
  assert.deepEqual(exit.memberUids, ["g1", "g2"]);
  const last = core.applyMemberExit({...three, hostUid: "", memberUids: ["g1", "g2"]}, "g2");
  assert.equal(last.end, false);
  assert.equal(last.hostUid, "g1");
  const empty = core.applyMemberExit({...three, hostUid: "g1", memberUids: ["g1"]}, "g1");
  assert.equal(empty.end, true);
});

test("callables and client expose collab without vip.html", () => {
  const fns = read("functions/botdee-session-functions.js");
  assert.match(fns, /proposeBotDeeRoomTransaction/);
  assert.match(fns, /voteBotDeeRoomTransaction/);
  assert.match(fns, /nominateBotDeeRoomHost/);
  assert.match(fns, /voteBotDeeRoomHost/);
  assert.match(read("functions/index.js"), /nominateBotDeeRoomHost/);
  assert.match(read(".github/workflows/functions-ci.yml"), /voteBotDeeRoomHost/);
  const smart = read("botdee-smartview.js");
  assert.match(smart, /renderCollabStrip/);
  assert.match(smart, /voteBotDeeRoomTransaction/);
  assert.match(smart, /nominateBotDeeRoomHost/);
  assert.match(smart, /data-guest-mode/);
  assert.doesNotMatch(smart, /vip\.html/);
  assert.match(read("functions/bot-dee-functions.js"), /applyRoomCollabToOutcome/);
  assert.match(read("functions/bot-dee-functions.js"), /choice_not_ready/);
  assert.match(read("functions/data-classification-core.js"), /sharedTransaction/);
  assert.match(read("functions/data-classification-core.js"), /hostBallot/);
});
