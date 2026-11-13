/* BOT DEE durable threads — Firestore botDeeThreads/{uid} + events.
   One thread per uid. Functions-write; owner may read. No LangGraph / SQL / Redis. */
"use strict";

const admin = require("firebase-admin");
const bot = require("./bot-dee-core");

function db() {
  return admin.firestore();
}

function threadRef(uid) {
  const threadId = bot.threadIdForUid(uid);
  if (!threadId) return null;
  return db().collection("botDeeThreads").doc(threadId);
}

function emptyState(settings) {
  return {
    durable: !!settings.durableThreads,
    status: "fresh",
    threadId: "",
    turns: [],
    history: [],
    conversationEpoch: 1,
    lastMessageAtMs: 0,
    remainingMs: settings.conversationIdleSeconds * 1000,
    idleEnded: false,
    revision: 0
  };
}

function snapshotToState(snap, uid, settings, nowMs) {
  const threadId = bot.threadIdForUid(uid);
  if (!snap || !snap.exists) {
    return {...emptyState(settings), threadId, durable: true};
  }
  const data = snap.data() || {};
  const lastMessageAtMs = Number(data.lastMessageAtMs) || 0;
  const idleEnded = bot.isThreadIdle(lastMessageAtMs, settings.conversationIdleSeconds, nowMs);
  const turns = idleEnded ? [] : bot.clipStoredTurns(data.turns);
  return {
    durable: true,
    status: idleEnded ? "idle_ended" : (turns.length ? "active" : "fresh"),
    threadId,
    turns,
    history: turns.map(row => ({role: row.role, text: row.text})),
    conversationEpoch: Math.max(1, Math.floor(Number(data.conversationEpoch) || 1)),
    lastMessageAtMs,
    remainingMs: bot.remainingIdleMs(lastMessageAtMs, settings.conversationIdleSeconds, nowMs),
    idleEnded,
    revision: Math.max(0, Math.floor(Number(data.revision) || 0)),
    eventCount: Math.max(0, Math.floor(Number(data.eventCount) || 0)),
    firstSeq: Math.max(0, Math.floor(Number(data.firstSeq) || 0))
  };
}

async function loadSettings() {
  const snap = await db().doc("botDeeSettings/default").get();
  return bot.normalizeBotDeeSettings(snap.exists ? snap.data() : {});
}

async function loadThreadState(uid, settings, nowMs) {
  const idle = settings || await loadSettings();
  if (!idle.durableThreads) return emptyState(idle);
  const ref = threadRef(uid);
  if (!ref) return emptyState(idle);
  const snap = await ref.get();
  return snapshotToState(snap, uid, idle, nowMs || Date.now());
}

async function persistExchange(uid, settings, userText, modelText, nowMs) {
  if (!settings?.durableThreads) return {ok: true, skipped: true};
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Number(nowMs) || Date.now();
  const userStored = bot.sanitizeUserPrompt(userText);
  const modelStored = bot.clipModelText(modelText);
  if (!userStored) return {ok: false, error: "empty_user"};

  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    const last = Number(prev.lastMessageAtMs) || 0;
    let epoch = Math.max(1, Math.floor(Number(prev.conversationEpoch) || 1));
    let turns = Array.isArray(prev.turns) ? prev.turns : [];
    if (bot.isThreadIdle(last, settings.conversationIdleSeconds, now)) {
      epoch += last ? 1 : 0;
      turns = [];
    }
    let eventCount = Math.max(0, Math.floor(Number(prev.eventCount) || 0));
    let firstSeq = Math.max(0, Math.floor(Number(prev.firstSeq) || 0));
    const userSeq = eventCount + 1;
    const modelSeq = eventCount + 2;
    const userTurn = {role: "user", text: userStored, seq: userSeq, atMs: now};
    const modelTurn = {role: "model", text: modelStored, seq: modelSeq, atMs: now};
    const nextTurns = bot.clipStoredTurns([...turns, userTurn, modelTurn]);
    const events = ref.collection("events");
    const userId = bot.eventDocId(userSeq);
    const modelId = bot.eventDocId(modelSeq);
    if (userId) {
      tx.set(events.doc(userId), {
        seq: userSeq,
        epoch,
        role: "user",
        text: userStored,
        atMs: now,
        uid
      });
    }
    if (modelId) {
      tx.set(events.doc(modelId), {
        seq: modelSeq,
        epoch,
        role: "model",
        text: modelStored,
        atMs: now,
        uid
      });
    }
    if (!firstSeq) firstSeq = userSeq;
    eventCount = modelSeq;
    while (eventCount - firstSeq + 1 > bot.MAX_STORED_EVENTS && firstSeq <= eventCount) {
      const staleId = bot.eventDocId(firstSeq);
      if (staleId) tx.delete(events.doc(staleId));
      firstSeq += 1;
    }
    tx.set(ref, {
      schemaVersion: bot.THREAD_SCHEMA_VERSION,
      uid,
      threadId: bot.threadIdForUid(uid),
      status: "active",
      conversationEpoch: epoch,
      lastMessageAtMs: now,
      lastMessageAtIso: new Date(now).toISOString(),
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1,
      turns: nextTurns,
      eventCount,
      firstSeq,
      updatedAtMs: now
    }, {merge: true});
  });
  return {ok: true};
}

/** Farewell or client idle: next restore starts a fresh conversation. */
async function markIdleEnded(uid, settings, nowMs) {
  if (!settings?.durableThreads) return {ok: true, skipped: true};
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Number(nowMs) || Date.now();
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const prev = snap.data() || {};
    const epoch = Math.max(1, Math.floor(Number(prev.conversationEpoch) || 1)) + 1;
    tx.set(ref, {
      status: "idle_ended",
      conversationEpoch: epoch,
      lastMessageAtMs: 0,
      lastMessageAtIso: new Date(now).toISOString(),
      turns: [],
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1,
      updatedAtMs: now
    }, {merge: true});
  });
  return {ok: true};
}

module.exports = {
  loadSettings,
  loadThreadState,
  persistExchange,
  markIdleEnded,
  snapshotToState,
  emptyState
};
