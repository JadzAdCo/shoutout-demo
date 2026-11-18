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
    summary: "",
    personalization: prefs.normalizePersonalization({}),
    retrievalFromSeq: 0,
    sessionReset: false,
    chatTitles: {},
    [prefs.LAST_USED_FIELD]: 0,
    [prefs.SESSION_RESET_FIELD]: 0
  };
}

const CHAT_TITLE_MAX = 80;
const STABLE_CHAT_ID_RE = /^c_[0-9a-f]{16}$/;
const SLOT_CHAT_ID_RE = /^(live|current|archive)$/;
const CHAT_ID_RE = STABLE_CHAT_ID_RE;

function clipChatTitle(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_TITLE_MAX);
}

function fnv1a(str, seed) {
  let h = (Number(seed) >>> 0) || 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function normalizeFirstUserLine(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Stable id from first user text so titles follow a slice across live/current/archive. */
function conversationIdFromFirstUser(text) {
  const line = normalizeFirstUserLine(text);
  if (!line) return "";
  const a = fnv1a(line, 2166136261).toString(16).padStart(8, "0");
  const b = fnv1a(line, 0x811c9dc5 ^ 0x01000193).toString(16).padStart(8, "0");
  return `c_${a}${b}`;
}

function firstUserTextFromTurns(turns) {
  const row = (Array.isArray(turns) ? turns : []).find(
    item => item && (item.role === "user" || item.role === "User") && String(item.text || "").trim()
  );
  return row ? String(row.text).trim() : "";
}

function conversationIdFromTurns(turns) {
  return conversationIdFromFirstUser(firstUserTextFromTurns(turns));
}

function clipTitleRow(row) {
  const title = clipChatTitle(typeof row === "string" ? row : row?.title);
  if (!title) return null;
  return {
    title,
    updatedAtMs: Math.max(0, Math.floor(Number(row?.updatedAtMs) || 0))
  };
}

/** Display labels for + Chats rows. Never sent to Gemini. Keeps legacy slot keys until migrate. */
function normalizeChatTitles(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  Object.keys(src).forEach(id => {
    if (!STABLE_CHAT_ID_RE.test(id) && !SLOT_CHAT_ID_RE.test(id)) return;
    const row = clipTitleRow(src[id]);
    if (!row) return;
    out[id] = row;
  });
  return out;
}

function migrateChatTitles(raw, slices) {
  const src = normalizeChatTitles(raw);
  const map = slices && typeof slices === "object" ? slices : {};
  const out = {};
  Object.keys(src).forEach(id => {
    if (STABLE_CHAT_ID_RE.test(id)) out[id] = src[id];
  });
  const slotSlices = {
    live: map.live || map.current,
    current: map.current,
    archive: map.archive
  };
  ["live", "current", "archive"].forEach(slot => {
    const row = src[slot];
    if (!row) return;
    const id = conversationIdFromTurns(slotSlices[slot]);
    if (!id || out[id]) return;
    out[id] = row;
  });
  return out;
}

function chatTitlesNeedWrite(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return Object.keys(src).some(id => SLOT_CHAT_ID_RE.test(id));
}

async function persistChatTitles(uid, titles, nowMs) {
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Number(nowMs) || Date.now();
  const next = migrateChatTitles(titles, {});
  await ref.set({
    uid,
    threadId: bot.threadIdForUid(uid),
    chatTitles: next,
    updatedAtMs: now
  }, {merge: true});
  return {ok: true, chatTitles: next};
}

async function renameChat(uid, chatId, title, nowMs, opts) {
  const extra = opts && typeof opts === "object" && !Array.isArray(opts) ? opts : {};
  const fromText = conversationIdFromFirstUser(extra.firstUserText);
  let id = fromText || String(chatId || "").trim();
  if (SLOT_CHAT_ID_RE.test(id)) {
    if (!fromText) return {ok: false, error: "invalid_chat_id"};
    id = fromText;
  }
  if (!STABLE_CHAT_ID_RE.test(id)) return {ok: false, error: "invalid_chat_id"};
  const clipped = clipChatTitle(title);
  if (!clipped) return {ok: false, error: "empty_title"};
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Number(nowMs) || Date.now();
  let titles = {};
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() || {} : {};
    if (prev.uid && prev.uid !== uid) {
      const err = new Error("owner_mismatch");
      err.code = "permission-denied";
      throw err;
    }
    titles = migrateChatTitles(prev.chatTitles, extra.slices || {});
    titles[id] = {title: clipped, updatedAtMs: now};
    tx.set(ref, {
      uid,
      threadId: bot.threadIdForUid(uid),
      chatTitles: titles,
      updatedAtMs: now,
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1
    }, {merge: true});
  });
  return {ok: true, chatId: id, title: clipped, chatTitles: titles};
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
  const clockIdle = bot.isThreadIdle(lastMessageAtMs, settings.conversationIdleSeconds, nowMs);
  const farewellLease = String(data.status || "") === "idle_ended" && !lastMessageAtMs;
  const idleEnded = clockIdle || farewellLease;
  const consent = memory.normalizeConsent(data.consent);
  const personalization = prefs.fromThread(data);
  const staleGeneration = prefs.needsSessionReset(data);
  // Idle ends the session lease (pause UX) — it must not empty the retrieval cursor.
  const retrievalTurns = staleGeneration ? [] : bot.clipStoredTurns(data.turns);
  return {
    durable: true,
    status: staleGeneration ? "fresh" : (idleEnded ? "idle_ended" : (retrievalTurns.length ? "active" : "fresh")),
    threadId,
    turns: retrievalTurns,
    history: retrievalTurns.map(row => ({role: row.role, text: row.text})),
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
    summary: staleGeneration ? "" : String(data.summary || data.lastSummary || "").trim(),
    retrievalFromSeq: staleGeneration ? 0 : Math.max(0, Math.floor(Number(data.retrievalFromSeq) || 0)),
    sessionReset: staleGeneration,
    chatTitles: staleGeneration ? {} : normalizeChatTitles(data.chatTitles),
    [prefs.LAST_USED_FIELD]: staleGeneration ? 0 : (Number(data[prefs.LAST_USED_FIELD]) || 0),
    [prefs.SESSION_RESET_FIELD]: staleGeneration ? 0 : prefs.sessionResetVersionOf(data)
  };
}

/** Overlay skip hides events before this seq. Events stay on disk for diagnostics. */
function nextRetrievalFromSeq(prev, eventCount) {
  const row = prev && typeof prev === "object" ? prev : {};
  if (prefs.needsSessionReset(row)) {
    return Math.max(0, Math.floor(Number(eventCount) || 0)) + 1;
  }
  return Math.max(0, Math.floor(Number(row.retrievalFromSeq) || 0));
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
      patch.retrievalFromSeq = nextRetrievalFromSeq(prev, prev.eventCount);
      patch.summary = "";
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

/** Idle rotation uses when the patron sent the message, not when Gemini finished.
 *  Idle / farewell bump the lease epoch but keep the transcript cursor. */
function nextTranscript(prev, settings, receivedAtMs) {
  const row = prev && typeof prev === "object" ? prev : {};
  const last = Number(row.lastMessageAtMs) || 0;
  let epoch = Math.max(1, Math.floor(Number(row.conversationEpoch) || 1));
  let turns = Array.isArray(row.turns) ? row.turns : [];
  const staleGeneration = prefs.needsSessionReset(row);
  const clockIdle = bot.isThreadIdle(last, settings.conversationIdleSeconds, receivedAtMs);
  const farewellLease = String(row.status || "") === "idle_ended" && !last;
  if (staleGeneration) {
    epoch += last ? 1 : 0;
    turns = [];
  } else if (clockIdle || farewellLease) {
    epoch += 1;
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
      [prefs.SESSION_RESET_FIELD]: prefs.CURRENT_VERSION,
      retrievalFromSeq: nextRetrievalFromSeq(prev, prev.eventCount)
    }, {merge: true});
  });
  return {ok: true};
}

/** Farewell or explicit idle: end the session lease. Do not wipe turns, events, memories, or workflows. */
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
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1,
      updatedAtMs: now
    }, {merge: true});
  });
  return {ok: true};
}

function eventsToTurns(rows, limit, minSeq) {
  const cap = Math.max(2, Math.min(24, Number(limit) || 12));
  const min = Math.max(0, Math.floor(Number(minSeq) || 0));
  return (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
    .map(row => ({
      role: row?.role === "model" || row?.role === "assistant" ? "model" : "user",
      text: String(row?.text || row?.sanitizedContent || ""),
      seq: Math.max(0, Math.floor(Number(row?.seq) || 0)),
      atMs: Number(row?.atMs) || 0
    }))
    .filter(row => row.text && (min === 0 || row.seq >= min))
    .slice(-cap)
    .map(row => ({role: row.role, text: row.text, seq: row.seq, atMs: row.atMs}));
}

/** Last 12 events win over in-doc turns. Archive is fallback only when both are empty.
 *  Session reset hides pre-reset events without deleting them. */
function assembleRetrievalTurns({
  docTurns,
  events,
  archiveTurns,
  idleEnded,
  archiveConsent,
  sessionReset,
  retrievalFromSeq
}) {
  if (sessionReset) return [];
  const minSeq = Math.max(0, Math.floor(Number(retrievalFromSeq) || 0));
  const fromEvents = eventsToTurns(events, 12, minSeq);
  if (fromEvents.length) return fromEvents.map(row => ({role: row.role, text: row.text}));
  const fromDoc = bot.clipStoredTurns(docTurns).filter(row => passesRetrievalCursor(row, minSeq, true));
  if (fromDoc.length) return fromDoc.map(row => ({role: row.role, text: row.text}));
  if (idleEnded && archiveConsent && Array.isArray(archiveTurns) && archiveTurns.length) {
    return bot.clipStoredTurns(archiveTurns)
      .filter(row => passesRetrievalCursor(row, minSeq, false))
      .map(row => ({role: row.role, text: row.text}));
  }
  return [];
}

/** Live doc turns after overlay skip are post-reset even if seq was stripped historically.
 *  Archive without seq stays hidden once retrievalFromSeq is set. */
function passesRetrievalCursor(row, minSeq, allowMissingSeq) {
  if (!minSeq) return true;
  const seq = Math.max(0, Math.floor(Number(row?.seq) || 0));
  if (seq) return seq >= minSeq;
  return !!allowMissingSeq;
}

async function loadEventHistory(uid, limit) {
  const ref = threadRef(uid);
  if (!ref) return [];
  const cap = Math.max(2, Math.min(24, Number(limit) || 12));
  const snap = await ref.collection("events").orderBy("seq", "desc").limit(cap).get();
  return eventsToTurns(snap.docs.map(doc => doc.data()), cap);
}

async function loadExecutionReceipts(uid, limit) {
  const owner = String(uid || "").trim();
  if (!owner) return [];
  const cap = Math.max(1, Math.min(24, Number(limit) || 12));
  try {
    const snap = await db().collection("botDeeExecutions")
      .where("ownerUid", "==", owner)
      .limit(cap)
      .get();
    return snap.docs.map(doc => doc.data() || {});
  } catch (err) {
    console.warn("BOT DEE execution load failed", err?.message || err);
    return [];
  }
}

async function loadArchiveHistory(uid, limit) {
  const ref = threadRef(uid);
  if (!ref) return [];
  const cap = Math.max(2, Math.min(24, Number(limit) || 12));
  const snap = await ref.collection("archive").orderBy("seq", "desc").limit(cap).get();
  return snap.docs
    .map(doc => doc.data())
    .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
    .map(row => {
      const item = {
        role: row.role === "model" ? "model" : "user",
        text: String(row.sanitizedContent || row.text || "")
      };
      const seq = Math.max(0, Math.floor(Number(row.seq) || 0));
      if (seq) item.seq = seq;
      const atMs = Number(row.atMs) || 0;
      if (atMs) item.atMs = atMs;
      return item;
    })
    .filter(row => row.text);
}

async function loadAuthorizedMemories(uid, consent, nowMs) {
  if (!memory.consentAllows(consent, "memory")) return [];
  const ref = threadRef(uid);
  if (!ref) return [];
  const snap = await ref.collection("memories").limit(50).get();
  const rows = snap.docs.map(doc => doc.data());
  return memory.authorizedMemories(rows, consent, nowMs || Date.now());
}

async function loadLatestSummary(uid) {
  const ref = threadRef(uid);
  if (!ref) return "";
  try {
    const snap = await ref.collection("summaries").orderBy("createdAtMs", "desc").limit(1).get();
    const row = snap.docs[0]?.data() || {};
    return String(row.text || row.summary || "").trim();
  } catch (_) {
    return "";
  }
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
      [prefs.SESSION_RESET_FIELD]: prefs.CURRENT_VERSION,
      retrievalFromSeq: nextRetrievalFromSeq(prev, prev.eventCount)
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
  const modelStored = bot.sanitizeBotReply(modelText, {allowEmpty: options.allowEmpty});
  const mediaEarly = bot.clipStoredMedia(options.media);
  if (options.allowEmpty && !String(modelStored || "").trim() && !mediaEarly.length) {
    return {ok: true, skipped: true, reason: "empty_card_only"};
  }
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
  loadEventHistory,
  loadExecutionReceipts,
  loadAuthorizedMemories,
  loadLatestSummary,
  eventsToTurns,
  assembleRetrievalTurns,
  nextRetrievalFromSeq,
  writeExecutionReceipt,
  markIdleEnded,
  readHasUsedBotDee,
  markHasUsedBotDee,
  savePersonalization,
  snapshotToState,
  nextTranscript,
  emptyState,
  clipChatTitle,
  normalizeChatTitles,
  migrateChatTitles,
  chatTitlesNeedWrite,
  persistChatTitles,
  conversationIdFromFirstUser,
  conversationIdFromTurns,
  firstUserTextFromTurns,
  renameChat,
  CHAT_TITLE_MAX,
  CHAT_ID_RE,
  STABLE_CHAT_ID_RE,
  SLOT_CHAT_ID_RE
};
