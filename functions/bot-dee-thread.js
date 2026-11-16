/* BOT DEE durable threads — Firestore botDeeThreads/{uid} + events.
   One thread per uid. Functions-write; owner may read. No LangGraph / SQL / Redis.
   Opt-in archive lives under archive/ and is not cleared by the 300s idle pause. */
"use strict";

const admin = require("firebase-admin");
const bot = require("./bot-dee-core");
const prefs = require("./botdee-personalization");
const memory = require("./botdee-memory");
const execution = require("./botdee-execution");

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
    revision: 0,
    consent: memory.normalizeConsent({}),
    archiveRetained: false,
    hasUsedBotDee: 0,
    personalization: prefs.normalizePersonalization({}),
    [prefs.LAST_USED_FIELD]: 0,
    [prefs.SESSION_RESET_FIELD]: 0
  };
}

function snapshotToState(snap, uid, settings, nowMs) {
  const threadId = bot.threadIdForUid(uid);
  if (!snap || !snap.exists) {
    return {
      ...emptyState(settings),
      threadId,
      durable: true,
      consent: memory.normalizeConsent({}),
      hasUsedBotDee: 0
    };
  }
  const data = snap.data() || {};
  const lastMessageAtMs = Number(data.lastMessageAtMs) || 0;
  const idleEnded = bot.isThreadIdle(lastMessageAtMs, settings.conversationIdleSeconds, nowMs);
  const turns = idleEnded ? [] : bot.clipStoredTurns(data.turns);
  const consent = memory.normalizeConsent(data.consent);
  const personalization = prefs.fromThread(data);
  const staleGeneration = prefs.needsSessionReset(data);
  const liveTurns = staleGeneration || idleEnded ? [] : turns;
  return {
    durable: true,
    status: staleGeneration ? "fresh" : (idleEnded ? "idle_ended" : (liveTurns.length ? "active" : "fresh")),
    threadId,
    turns: liveTurns,
    history: liveTurns.map(row => ({role: row.role, text: row.text})),
    conversationEpoch: Math.max(1, Math.floor(Number(data.conversationEpoch) || 1)),
    lastMessageAtMs: staleGeneration ? 0 : lastMessageAtMs,
    remainingMs: staleGeneration
      ? settings.conversationIdleSeconds * 1000
      : bot.remainingIdleMs(lastMessageAtMs, settings.conversationIdleSeconds, nowMs),
    idleEnded: staleGeneration ? false : idleEnded,
    revision: Math.max(0, Math.floor(Number(data.revision) || 0)),
    eventCount: Math.max(0, Math.floor(Number(data.eventCount) || 0)),
    firstSeq: Math.max(0, Math.floor(Number(data.firstSeq) || 0)),
    consent,
    archiveRetained: staleGeneration ? false : memory.consentAllows(consent, "archive"),
    hasUsedBotDee: staleGeneration ? 0 : memory.hasUsedFromThread(data),
    personalization,
    [prefs.LAST_USED_FIELD]: staleGeneration ? 0 : (Number(data[prefs.LAST_USED_FIELD]) || 0),
    [prefs.SESSION_RESET_FIELD]: staleGeneration ? 0 : prefs.sessionResetVersionOf(data)
  };
}

async function readHasUsedBotDee(uid) {
  const ref = threadRef(uid);
  if (!ref) return 0;
  const snap = await ref.get();
  if (!snap.exists) return 0;
  return memory.hasUsedFromThread(snap.data());
}

async function markHasUsedBotDee(uid, nowMs) {
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Number(nowMs) || Date.now();
  await ref.set({
    uid,
    threadId: bot.threadIdForUid(uid),
    hasUsedBotDee: 1,
    hasUsedBotDeeAtMs: now,
    updatedAtMs: now
  }, {merge: true});
  return {ok: true, hasUsedBotDee: 1};
}

async function savePersonalization(uid, input, nowMs) {
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Number(nowMs) || Date.now();
  const personalization = prefs.writePayload(input);
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    const resetSession = prefs.needsSessionReset(prev);
    const patch = {
      uid,
      threadId: bot.threadIdForUid(uid),
      personalization,
      updatedAtMs: now,
      [prefs.SESSION_RESET_FIELD]: prefs.CURRENT_VERSION
    };
    if (resetSession) {
      patch.status = "fresh";
      patch.turns = [];
      patch.lastMessageAtMs = 0;
      patch.conversationEpoch = Math.max(1, Math.floor(Number(prev.conversationEpoch) || 1)) + 1;
    }
    tx.set(ref, patch, {merge: true});
  });
  return {ok: true, personalization};
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

/** Idle rotation uses when the patron sent the message, not when Gemini finished. */
function nextTranscript(prev, settings, receivedAtMs) {
  const row = prev && typeof prev === "object" ? prev : {};
  const last = Number(row.lastMessageAtMs) || 0;
  let epoch = Math.max(1, Math.floor(Number(row.conversationEpoch) || 1));
  let turns = Array.isArray(row.turns) ? row.turns : [];
  const staleGeneration = prefs.needsSessionReset(row);
  if (staleGeneration || bot.isThreadIdle(last, settings.conversationIdleSeconds, receivedAtMs)) {
    epoch += (staleGeneration || last) ? 1 : 0;
    turns = [];
  }
  return {epoch, turns};
}

async function persistExchange(uid, settings, userText, modelText, opts) {
  if (!settings?.durableThreads) return {ok: true, skipped: true};
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const options = opts && typeof opts === "object" ? opts : {nowMs: opts};
  const now = Number(options.nowMs) || Date.now();
  const receivedAtMs = Number(options.receivedAtMs) || now;
  const userStored = bot.clipStoredText(userText, bot.MAX_MESSAGE_CHARS);
  const modelStored = bot.sanitizeBotReply(modelText);
  if (!userStored) return {ok: false, error: "empty_user"};

  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    let {epoch, turns} = nextTranscript(prev, settings, receivedAtMs);
    let eventCount = Math.max(0, Math.floor(Number(prev.eventCount) || 0));
    let firstSeq = Math.max(0, Math.floor(Number(prev.firstSeq) || 0));
    const userSeq = eventCount + 1;
    const modelSeq = eventCount + 2;
    const userTurn = {role: "user", text: userStored, seq: userSeq, atMs: receivedAtMs};
    const modelTurn = {role: "model", text: modelStored, seq: modelSeq, atMs: now};
    const media = bot.clipStoredMedia(options.media);
    if (media.length) modelTurn.media = media;
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
        atMs: receivedAtMs,
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
      lastMessageAtMs: receivedAtMs,
      lastMessageAtIso: new Date(receivedAtMs).toISOString(),
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1,
      turns: nextTurns,
      eventCount,
      firstSeq,
      hasUsedBotDee: 1,
      hasUsedBotDeeAtMs: now,
      updatedAtMs: now,
      [prefs.LAST_USED_FIELD]: prefs.nextLastUsed(prev[prefs.LAST_USED_FIELD], receivedAtMs),
      [prefs.SESSION_RESET_FIELD]: prefs.CURRENT_VERSION
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

async function loadArchiveHistory(uid, limit) {
  const ref = threadRef(uid);
  if (!ref) return [];
  const cap = Math.max(2, Math.min(24, Number(limit) || 12));
  const snap = await ref.collection("archive").orderBy("seq", "desc").limit(cap).get();
  return snap.docs
    .map(doc => doc.data())
    .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
    .map(row => ({role: row.role === "model" ? "model" : "user", text: String(row.sanitizedContent || row.text || "")}));
}

async function persistArchiveTurns(uid, consent, rows) {
  if (!memory.consentAllows(consent, "archive")) return {ok: true, skipped: true};
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const batch = db().batch();
  let writes = 0;
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const msg = memory.archiveMessage(row);
    if (!msg.messageId || !msg.sanitizedContent) return;
    batch.set(ref.collection("archive").doc(msg.messageId), {uid, ...msg}, {merge: true});
    writes += 1;
  });
  if (!writes) return {ok: true, skipped: true};
  await batch.commit();
  return {ok: true};
}

async function persistUserTurn(uid, settings, userText, opts) {
  if (!settings?.durableThreads) return {ok: true, skipped: true};
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const options = opts && typeof opts === "object" ? opts : {};
  const now = Number(options.nowMs) || Date.now();
  const receivedAtMs = Number(options.receivedAtMs) || now;
  const userStored = bot.clipStoredText(userText, bot.MAX_MESSAGE_CHARS);
  if (!userStored) return {ok: false, error: "empty_user"};
  let written = null;
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    let {epoch, turns} = nextTranscript(prev, settings, receivedAtMs);
    let eventCount = Math.max(0, Math.floor(Number(prev.eventCount) || 0));
    let firstSeq = Math.max(0, Math.floor(Number(prev.firstSeq) || 0));
    const userSeq = eventCount + 1;
    const userTurn = {role: "user", text: userStored, seq: userSeq, atMs: receivedAtMs};
    const nextTurns = bot.clipStoredTurns([...turns, userTurn]);
    const userId = bot.eventDocId(userSeq);
    if (userId) {
      tx.set(ref.collection("events").doc(userId), {
        seq: userSeq,
        epoch,
        role: "user",
        text: userStored,
        atMs: receivedAtMs,
        uid,
        status: "pending_model"
      });
    }
    if (!firstSeq) firstSeq = userSeq;
    eventCount = userSeq;
    tx.set(ref, {
      schemaVersion: bot.THREAD_SCHEMA_VERSION,
      uid,
      threadId: bot.threadIdForUid(uid),
      status: "active",
      conversationEpoch: epoch,
      lastMessageAtMs: receivedAtMs,
      lastMessageAtIso: new Date(receivedAtMs).toISOString(),
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1,
      turns: nextTurns,
      eventCount,
      firstSeq,
      hasUsedBotDee: 1,
      hasUsedBotDeeAtMs: now,
      updatedAtMs: now,
      [prefs.LAST_USED_FIELD]: prefs.nextLastUsed(prev[prefs.LAST_USED_FIELD], receivedAtMs),
      [prefs.SESSION_RESET_FIELD]: prefs.CURRENT_VERSION
    }, {merge: true});
    written = {seq: userSeq, epoch, receivedAtMs, userStored};
  });
  const consent = memory.normalizeConsent(options.consent);
  if (written && memory.consentAllows(consent, "archive")) {
    await persistArchiveTurns(uid, consent, [{
      seq: written.seq,
      epoch: written.epoch,
      role: "user",
      text: written.userStored,
      atMs: written.receivedAtMs,
      idempotencyKey: bot.eventDocId(written.seq)
    }]);
  }
  return {ok: true, ...written};
}

async function persistModelTurn(uid, settings, modelText, opts) {
  if (!settings?.durableThreads) return {ok: true, skipped: true};
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const options = opts && typeof opts === "object" ? opts : {};
  const now = Number(options.nowMs) || Date.now();
  const modelStored = bot.sanitizeBotReply(modelText);
  let written = null;
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    const turns = Array.isArray(prev.turns) ? prev.turns : [];
    let eventCount = Math.max(0, Math.floor(Number(prev.eventCount) || 0));
    let firstSeq = Math.max(0, Math.floor(Number(prev.firstSeq) || 0));
    const epoch = Math.max(1, Math.floor(Number(prev.conversationEpoch) || 1));
    const modelSeq = eventCount + 1;
    const modelTurn = {role: "model", text: modelStored, seq: modelSeq, atMs: now};
    const media = bot.clipStoredMedia(options.media);
    if (media.length) modelTurn.media = media;
    const nextTurns = bot.clipStoredTurns([...turns, modelTurn]);
    const modelId = bot.eventDocId(modelSeq);
    if (modelId) {
      tx.set(ref.collection("events").doc(modelId), {
        seq: modelSeq,
        epoch,
        role: "model",
        text: modelStored,
        atMs: now,
        uid
      });
    }
    eventCount = modelSeq;
    while (eventCount - firstSeq + 1 > bot.MAX_STORED_EVENTS && firstSeq <= eventCount) {
      const staleId = bot.eventDocId(firstSeq);
      if (staleId) tx.delete(ref.collection("events").doc(staleId));
      firstSeq += 1;
    }
    tx.set(ref, {
      lastModelAtMs: now,
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1,
      turns: nextTurns,
      eventCount,
      firstSeq,
      updatedAtMs: now
    }, {merge: true});
    written = {seq: modelSeq, epoch, modelStored};
  });
  const consent = memory.normalizeConsent(options.consent);
  if (written && memory.consentAllows(consent, "archive")) {
    await persistArchiveTurns(uid, consent, [{
      seq: written.seq,
      epoch: written.epoch,
      role: "model",
      text: written.modelStored,
      atMs: now,
      idempotencyKey: bot.eventDocId(written.seq)
    }]);
  }
  return {ok: true, ...written};
}

async function writeExecutionReceipt(uid, toolName, args, result, nowMs) {
  const doc = execution.checkpointDoc({
    ownerUid: uid,
    threadId: uid,
    toolName,
    args,
    state: result && result.ok === false ? "failed" : "succeeded",
    nowMs,
    approvalRequired: execution.isConsequentialTool(toolName)
  });
  if (!doc.executionId) return {ok: false};
  const ref = db().collection("botDeeExecutions").doc(doc.executionId);
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const next = execution.applyReceipt(snap.exists ? snap.data() : doc, doc.state, result, nowMs);
    tx.set(ref, {...doc, ...next, uid}, {merge: true});
  });
  return {ok: true, executionId: doc.executionId};
}

module.exports = {
  loadSettings,
  loadThreadState,
  persistExchange,
  persistUserTurn,
  persistModelTurn,
  persistArchiveTurns,
  loadArchiveHistory,
  writeExecutionReceipt,
  markIdleEnded,
  readHasUsedBotDee,
  markHasUsedBotDee,
  savePersonalization,
  snapshotToState,
  nextTranscript,
  emptyState
};
