"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const bot = require("./bot-dee-core");
const threads = require("./bot-dee-thread");
const execution = require("./botdee-execution");
const prefs = require("./botdee-personalization");
const memory = require("./botdee-memory");

const YESTERDAY = 1_700_000_000_000;
const NEXT_DAY = YESTERDAY + 86_400_000 + 12_000;
const SETTINGS = {durableThreads: 1, conversationIdleSeconds: 300};
const CURRENT = {
  personalization: {botDeePersonalizationVersion: prefs.CURRENT_VERSION},
  [prefs.SESSION_RESET_FIELD]: prefs.CURRENT_VERSION
};

function mykonosEvents() {
  return [
    {seq: 1, epoch: 1, role: "user", text: "Ca va?", atMs: YESTERDAY},
    {seq: 2, epoch: 1, role: "model", text: "Ca va bien !", atMs: YESTERDAY + 1_000},
    {seq: 3, epoch: 1, role: "user", text: "Book me a VIP spot in Mykonos", atMs: YESTERDAY + 2_000},
    {
      seq: 4,
      epoch: 1,
      role: "model",
      text: "Cavo Paradiso and Nammos are options. What date, party size, and section?",
      atMs: YESTERDAY + 3_000
    }
  ];
}

function mykonosTurns() {
  return mykonosEvents().map(row => ({role: row.role, text: row.text, seq: row.seq, atMs: row.atMs}));
}

test("previous-day Mykonos synthetic is retrieved after idle without cueing the venue", () => {
  const events = mykonosEvents();
  const retrieved = threads.eventsToTurns(events, 12);
  assert.equal(retrieved.length, 4);
  assert.ok(retrieved.some(row => /Mykonos/.test(row.text)));
  const idleSnap = threads.snapshotToState({
    exists: true,
    data: () => ({
      uid: "uid-synthetic",
      turns: mykonosTurns(),
      lastMessageAtMs: YESTERDAY + 3_000,
      conversationEpoch: 1,
      eventCount: 4,
      ...CURRENT
    })
  }, "uid-synthetic", SETTINGS, NEXT_DAY);
  assert.equal(idleSnap.idleEnded, true);
  assert.equal(idleSnap.status, "idle_ended");
  assert.ok(idleSnap.turns.some(row => /Mykonos/.test(row.text)), "doc turns stay retrievable after 300s");
  const history = threads.assembleRetrievalTurns({
    docTurns: [],
    events,
    archiveTurns: [],
    idleEnded: true,
    archiveConsent: false
  });
  assert.ok(history.some(row => /Mykonos/.test(row.text)));
  const contents = bot.contextToContents(
    execution.buildModelContext({turns: history, summary: "", memories: []}),
    "Tell me where we left off on vip reservations"
  );
  const blob = JSON.stringify(contents);
  assert.match(blob, /Mykonos/);
  assert.match(blob, /Cavo Paradiso/);
  assert.doesNotMatch(blob, /Yesterday, I mentioned about Mykonos/);
});

test("pause / resume: Hey is local chitchat; lease bumps epoch; transcript stays", () => {
  assert.equal(bot.isChitchatPrompt("Hey"), true);
  const fns = require("./bot-dee-functions");
  const local = fns.__botDeeHelpers.localSession("patron", "Hey", {
    active: false,
    personalization: {preferredAddressName: "Don", demeanor: "sociallyCool"}
  });
  assert.equal(local.provider, "local-chitchat");
  assert.match(local.reply, /Wassup, Don/i);
  const afterIdle = threads.nextTranscript({
    lastMessageAtMs: YESTERDAY + 3_000,
    conversationEpoch: 1,
    turns: mykonosTurns(),
    ...CURRENT
  }, SETTINGS, NEXT_DAY);
  assert.equal(afterIdle.epoch, 2);
  assert.equal(afterIdle.turns.length, 4);
  assert.ok(afterIdle.turns.some(row => /Mykonos/.test(row.text)));
  assert.match(read("functions/bot-dee-thread.js"), /keep the transcript cursor/);
  const markIdle = read("functions/bot-dee-thread.js");
  const start = markIdle.indexOf("async function markIdleEnded");
  const end = markIdle.indexOf("function eventsToTurns");
  assert.doesNotMatch(markIdle.slice(start, end), /turns:\s*\[\]/);
});

test("idle does not wipe retrieval source; events win over empty live turns", () => {
  const events = mykonosEvents();
  const fromEmptyDoc = threads.assembleRetrievalTurns({
    docTurns: [],
    events,
    archiveTurns: [],
    idleEnded: true,
    archiveConsent: false
  });
  assert.equal(fromEmptyDoc.length, 4);
  assert.match(fromEmptyDoc[2].text, /Mykonos/);
  const archiveOnly = threads.assembleRetrievalTurns({
    docTurns: [],
    events: [],
    archiveTurns: [{role: "user", text: "saved copy"}],
    idleEnded: true,
    archiveConsent: true
  });
  assert.equal(archiveOnly[0].text, "saved copy");
  const noArchive = threads.assembleRetrievalTurns({
    docTurns: [],
    events: [],
    archiveTurns: [{role: "user", text: "saved copy"}],
    idleEnded: true,
    archiveConsent: false
  });
  assert.deepEqual(noArchive, []);
  const capped = threads.eventsToTurns(
    Array.from({length: 20}, (_, i) => ({seq: i + 1, role: "user", text: `t${i + 1}`})),
    12
  );
  assert.equal(capped.length, 12);
  assert.equal(capped[0].text, "t9");
});

test("disagreement vs verified history: recap uses retrieved turns, not the post-pause hello", () => {
  const retrieved = threads.eventsToTurns(mykonosEvents(), 12);
  const postPause = [
    {role: "user", text: "Hey"},
    {role: "model", text: "Wassup, Don! What's the move?"},
    {role: "user", text: "We're were we"}
  ];
  const recapRight = prefs.recapFromTurns(retrieved);
  const recapWrong = prefs.recapFromTurns(postPause);
  assert.match(recapRight, /Mykonos/);
  assert.match(recapRight, /Cavo Paradiso/);
  assert.doesNotMatch(recapRight, /Wassup/);
  assert.doesNotMatch(recapRight, /Hey/);
  assert.doesNotMatch(recapWrong, /Mykonos/);
  const mixed = prefs.recapFromTurns([
    ...retrieved,
    {role: "model", text: "I'll pause here for now. Say hi when you want to pick up again."},
    ...postPause
  ]);
  assert.match(mixed, /Mykonos/);
  assert.doesNotMatch(mixed, /Wassup/);
  const verified = bot.contextToContents(
    execution.buildModelContext({turns: retrieved, summary: "", memories: []}),
    "We did, check our chat history"
  );
  const fromHelloOnly = bot.historyToContents(postPause, "We did, check our chat history");
  assert.match(JSON.stringify(verified), /Mykonos/);
  assert.doesNotMatch(JSON.stringify(fromHelloOnly), /Mykonos/);
});

test("no confirmed booking without an execution record", () => {
  const turns = threads.eventsToTurns(mykonosEvents(), 12);
  assert.equal(execution.reservationClaimFromContext({turns, executions: []}), "discussed");
  assert.equal(
    execution.reservationClaimFromContext({
      turns,
      executions: [{toolName: "createVipHold", state: "succeeded"}]
    }),
    "confirmed"
  );
  assert.equal(
    execution.reservationClaimFromContext({
      turns: [{role: "user", text: "Hey"}],
      executions: []
    }),
    "none"
  );
  assert.match(bot.systemInstruction("patron"), /discussed vs booked/i);
  assert.match(bot.systemInstruction("patron"), /never claim a VIP reservation/i);
  assert.match(prefs.personalizationInstruction({remindWhereLeftOff: 1}), /retrieved turns/i);
  const discussedCtx = execution.buildModelContext({turns, executions: []});
  assert.equal(discussedCtx.reservationClaim, "discussed");
  const discussedContents = bot.contextToContents(discussedCtx, "did we book it");
  assert.match(JSON.stringify(discussedContents), /discussion only/);
  assert.doesNotMatch(JSON.stringify(discussedContents), /confirms a VIP hold/);
  const confirmedCtx = execution.buildModelContext({
    turns,
    executions: [{toolName: "createVipHold", state: "succeeded", resultCode: "ok"}]
  });
  assert.equal(confirmedCtx.reservationClaim, "confirmed");
  const confirmedContents = bot.contextToContents(confirmedCtx, "did we book it");
  assert.match(JSON.stringify(confirmedContents), /confirms a VIP hold/);
  const fns = read("functions/bot-dee-functions.js");
  assert.match(fns, /loadExecutionReceipts\(uid, 12\)/);
  assert.match(fns, /executions/);
});

test("session reset hides pre-reset events without deleting them", () => {
  const events = mykonosEvents();
  assert.equal(threads.nextRetrievalFromSeq({}, 4), 5);
  assert.equal(threads.nextRetrievalFromSeq(CURRENT, 4), 0);
  const pending = threads.snapshotToState({
    exists: true,
    data: () => ({
      uid: "uid-reset",
      turns: mykonosTurns(),
      lastMessageAtMs: YESTERDAY + 3_000,
      conversationEpoch: 1,
      eventCount: 4,
      personalization: {botDeePersonalizationVersion: 1}
    })
  }, "uid-reset", SETTINGS, NEXT_DAY);
  assert.equal(pending.sessionReset, true);
  assert.deepEqual(pending.turns, []);
  const hidden = threads.assembleRetrievalTurns({
    docTurns: [],
    events,
    archiveTurns: [{role: "user", text: "Mykonos archive", seq: 3}],
    idleEnded: true,
    archiveConsent: true,
    sessionReset: true,
    retrievalFromSeq: 0
  });
  assert.deepEqual(hidden, []);
  const afterSkip = threads.assembleRetrievalTurns({
    docTurns: [],
    events,
    archiveTurns: [],
    idleEnded: false,
    archiveConsent: false,
    sessionReset: false,
    retrievalFromSeq: 5
  });
  assert.deepEqual(afterSkip, []);
  const resumed = threads.assembleRetrievalTurns({
    docTurns: [{role: "user", text: "Nammos tonight?", seq: 5}],
    events: [
      ...events,
      {seq: 5, epoch: 2, role: "user", text: "Nammos tonight?", atMs: NEXT_DAY}
    ],
    archiveTurns: [],
    idleEnded: false,
    archiveConsent: false,
    sessionReset: false,
    retrievalFromSeq: 5
  });
  assert.equal(resumed.length, 1);
  assert.match(resumed[0].text, /Nammos tonight/);
  assert.doesNotMatch(JSON.stringify(resumed), /Cavo Paradiso/);
  const idleStillRecalls = threads.assembleRetrievalTurns({
    docTurns: [],
    events,
    archiveTurns: [],
    idleEnded: true,
    archiveConsent: false,
    sessionReset: false,
    retrievalFromSeq: 0
  });
  assert.ok(idleStillRecalls.some(row => /Mykonos/.test(row.text)));
  const clipped = bot.clipStoredTurns([{
    role: "user",
    text: "Nammos tonight?",
    seq: 5,
    atMs: NEXT_DAY
  }]);
  assert.equal(clipped[0].seq, 5);
  assert.equal(clipped[0].atMs, NEXT_DAY);
  const eventMiss = threads.assembleRetrievalTurns({
    docTurns: [{role: "user", text: "Nammos tonight?", seq: 5, atMs: NEXT_DAY}],
    events: [],
    archiveTurns: [],
    idleEnded: false,
    archiveConsent: false,
    sessionReset: false,
    retrievalFromSeq: 5
  });
  assert.equal(eventMiss.length, 1);
  assert.match(eventMiss[0].text, /Nammos tonight/);
  const strippedLive = threads.assembleRetrievalTurns({
    docTurns: [{role: "user", text: "Nammos tonight?"}],
    events: [],
    archiveTurns: [],
    idleEnded: false,
    archiveConsent: false,
    sessionReset: false,
    retrievalFromSeq: 5
  });
  assert.equal(strippedLive.length, 1, "post-reset live doc turns stay when seq was stripped");
  const archiveWithSeq = threads.assembleRetrievalTurns({
    docTurns: [],
    events: [],
    archiveTurns: [
      {role: "user", text: "old Mykonos", seq: 3},
      {role: "user", text: "Nammos tonight?", seq: 5}
    ],
    idleEnded: true,
    archiveConsent: true,
    sessionReset: false,
    retrievalFromSeq: 5
  });
  assert.equal(archiveWithSeq.length, 1);
  assert.match(archiveWithSeq[0].text, /Nammos tonight/);
  const archiveNoSeq = threads.assembleRetrievalTurns({
    docTurns: [],
    events: [],
    archiveTurns: [{role: "user", text: "old Mykonos"}],
    idleEnded: true,
    archiveConsent: true,
    sessionReset: false,
    retrievalFromSeq: 5
  });
  assert.deepEqual(archiveNoSeq, []);
  const saveSrc = read("functions/bot-dee-thread.js");
  const saveStart = saveSrc.indexOf("async function savePersonalization");
  const saveEnd = saveSrc.indexOf("async function loadSettings");
  assert.match(saveSrc.slice(saveStart, saveEnd), /retrievalFromSeq/);
  assert.doesNotMatch(saveSrc.slice(saveStart, saveEnd), /events\.doc\([^)]+\)\.delete/);
  assert.match(read("functions/bot-dee-functions.js"), /sessionReset/);
  assert.match(read("functions/bot-dee-functions.js"), /retrievalFromSeq/);
});

test("Stage B: executeBotSession wires buildModelContext; memories require consent", () => {
  const fns = read("functions/bot-dee-functions.js");
  assert.match(fns, /loadEventHistory\(uid, 12\)/);
  assert.match(fns, /assembleRetrievalTurns/);
  assert.match(fns, /loadExecutionReceipts/);
  assert.match(fns, /execution\.buildModelContext/);
  assert.match(fns, /executions/);
  assert.match(fns, /contextToContents\(modelContext/);
  assert.match(fns, /consentAllows\(consent, "memory"\)/);
  assert.match(fns, /loadAuthorizedMemories/);
  const ctx = execution.buildModelContext({
    turns: mykonosTurns(),
    summary: "Earlier they asked about Mykonos VIP tables.",
    memories: [{value: "Prefers Nammos sunset"}],
    budget: {maxTurns: 12}
  });
  assert.equal(ctx.recentTurns.length, 4);
  assert.match(ctx.summary, /Mykonos/);
  assert.equal(ctx.memories.length, 1);
  const withSummary = bot.contextToContents(ctx, "where did we leave off");
  assert.match(JSON.stringify(withSummary), /Approved memories/);
  assert.match(JSON.stringify(withSummary), /Prefers Nammos sunset/);
  const mem = memory.memoryRecord({
    value: "Prefers Nammos sunset",
    explicitOrInferred: "explicit",
    approved: 1,
    nowMs: NEXT_DAY,
    expiresAtMs: NEXT_DAY + 86_400_000
  });
  assert.equal(memory.authorizedMemories([mem], {memory: 0}, NEXT_DAY).length, 0);
  assert.equal(memory.authorizedMemories([mem], {memory: 1}, NEXT_DAY).length, 1);
  const denied = execution.buildModelContext({
    turns: mykonosTurns(),
    memories: memory.authorizedMemories([mem], {memory: 0}, NEXT_DAY)
  });
  assert.equal(denied.memories.length, 0);
});

test("300s idle stays configurable; pause UX copy and client recap remain", () => {
  assert.equal(bot.DEFAULT_IDLE_SECONDS, 300);
  assert.equal(bot.clampIdleSeconds(15), 15);
  assert.equal(bot.clampIdleSeconds(600), 600);
  assert.match(bot.idleEndedReply(), /pause|Say hi/i);
  assert.match(read("bot-dee-chat.js"), /if \(durableEnabled\) maybeRecap\(recapTurns\)/);
  assert.match(read("bot-dee-chat.js"), /if \(!durableEnabled\) history\.length = 0/);
  assert.match(read("master-admin.html"), /id="botDeeIdleSeconds"[^>]*value="300"/);
  assert.match(read("master-admin.html"), /does not delete conversations, memories, or workflows/);
});
