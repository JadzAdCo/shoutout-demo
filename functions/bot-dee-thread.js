/* BOT DEE durable threads — Firestore botDeeThreads/{uid} + events.
   One thread per uid. Functions-write; owner may read. No LangGraph / SQL / Redis.
   Opt-in archive lives under archive/ and is not cleared by the 300s idle pause. */
"use strict";

const crypto = require("crypto");
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
    currentConversationId: "",
    archiveConversationId: "",
    joinedRoomId: "",
    joinedRoomConversationId: "",
    [prefs.LAST_USED_FIELD]: 0,
    [prefs.SESSION_RESET_FIELD]: 0
  };
}

const CHAT_TITLE_MAX = 80;
const CONVERSATION_ID_RE = bot.CONVERSATION_ID_RE;
const LEGACY_HASH_ID_RE = /^c_[0-9a-f]{16}$/;
const SLOT_CHAT_ID_RE = /^(live|current|archive)$/;
const CHAT_ID_RE = CONVERSATION_ID_RE;
const STABLE_CHAT_ID_RE = CONVERSATION_ID_RE;

function clipChatTitle(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_TITLE_MAX);
}

function clipConversationId(raw) {
  return bot.clipConversationId(raw);
}

function mintConversationId() {
  return `cv_${crypto.randomBytes(16).toString("hex")}`;
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

/** Legacy hash of first user text. Kept only to migrate leftover c_ keys onto conversationId. */
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
  const list = Array.isArray(turns) ? turns : [];
  for (let i = 0; i < list.length; i += 1) {
    const id = clipConversationId(list[i] && list[i].conversationId);
    if (id) return id;
  }
  return "";
}

function stampConversation(turn, conversationId) {
  const id = clipConversationId(conversationId);
  if (!turn || !id) return turn;
  turn.conversationId = id;
  return turn;
}

function eventFields(base, conversationId) {
  const id = clipConversationId(conversationId);
  return id ? {...base, conversationId: id} : base;
}

function resolveConversationIds(prev, nextEpoch, clientId) {
  const row = prev && typeof prev === "object" ? prev : {};
  const prevEpoch = Math.max(1, Math.floor(Number(row.conversationEpoch) || 1));
  let current = clipConversationId(row.currentConversationId);
  let archive = clipConversationId(row.archiveConversationId);
  const client = clipConversationId(clientId);
  if (nextEpoch > prevEpoch) {
    archive = current || archive;
    current = client && client !== archive ? client : mintConversationId();
    return {currentConversationId: current, archiveConversationId: archive};
  }
  if (!current) current = client || mintConversationId();
  return {currentConversationId: current, archiveConversationId: archive};
}

function threadConversationPatch(ids) {
  const patch = {};
  const current = clipConversationId(ids && ids.currentConversationId);
  const archive = clipConversationId(ids && ids.archiveConversationId);
  if (current) patch.currentConversationId = current;
  if (archive) patch.archiveConversationId = archive;
  return patch;
}

function titleSlicesFrom(ids, currentTurns, archiveTurns) {
  const current = clipConversationId(ids && ids.currentConversationId);
  const archive = clipConversationId(ids && ids.archiveConversationId);
  return {
    currentConversationId: current,
    archiveConversationId: archive,
    liveConversationId: current,
    currentTurns: currentTurns || [],
    archiveTurns: archiveTurns || []
  };
}

function clipTitleRow(row) {
  const title = clipChatTitle(typeof row === "string" ? row : row?.title);
  if (!title) return null;
  return {
    title,
    updatedAtMs: Math.max(0, Math.floor(Number(row?.updatedAtMs) || 0))
  };
}

function isTitleMapKey(id) {
  return CONVERSATION_ID_RE.test(id) || LEGACY_HASH_ID_RE.test(id) || SLOT_CHAT_ID_RE.test(id);
}

/** Display labels for + Chats rows. Never sent to Gemini. Keeps leftover slot / hash keys until migrate. */
function normalizeChatTitles(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  Object.keys(src).forEach(id => {
    if (!isTitleMapKey(id)) return;
    const row = clipTitleRow(src[id]);
    if (!row) return;
    out[id] = row;
  });
  return out;
}

function migrateChatTitles(raw, slices) {
  const src = normalizeChatTitles(raw);
  const map = slices && typeof slices === "object" ? slices : {};
  const currentId = clipConversationId(map.currentConversationId)
    || conversationIdFromTurns(map.currentTurns || map.current);
  const archiveId = clipConversationId(map.archiveConversationId)
    || conversationIdFromTurns(map.archiveTurns || map.archive);
  const liveId = clipConversationId(map.liveConversationId)
    || conversationIdFromTurns(map.liveTurns || map.live)
    || currentId;
  const out = {};
  Object.keys(src).forEach(id => {
    if (CONVERSATION_ID_RE.test(id)) out[id] = src[id];
  });
  const slotIds = {live: liveId, current: currentId, archive: archiveId};
  ["live", "current", "archive"].forEach(slot => {
    const row = src[slot];
    const id = slotIds[slot];
    if (!row || !id || out[id]) return;
    out[id] = row;
  });
  const claimedHashes = new Set();
  const hashTargets = [
    [currentId, map.currentTurns || map.current, map.firstUserText],
    [archiveId, map.archiveTurns || map.archive, ""],
    [liveId, map.liveTurns || map.live, ""]
  ];
  hashTargets.forEach(([id, turns, extraText]) => {
    if (!id) return;
    const hashed = conversationIdFromFirstUser(firstUserTextFromTurns(turns) || extraText);
    if (hashed && src[hashed]) {
      if (!out[id]) out[id] = src[hashed];
      claimedHashes.add(hashed);
    }
  });
  const leftoverHashes = Object.keys(src).filter(id => LEGACY_HASH_ID_RE.test(id) && !claimedHashes.has(id));
  if (currentId && leftoverHashes.length === 1 && !out[currentId]) {
    out[currentId] = src[leftoverHashes[0]];
    claimedHashes.add(leftoverHashes[0]);
  }
  Object.keys(src).forEach(id => {
    if (LEGACY_HASH_ID_RE.test(id) && !claimedHashes.has(id)) out[id] = src[id];
  });
  return out;
}

function chatTitlesNeedWrite(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return Object.keys(src).some(id => SLOT_CHAT_ID_RE.test(id));
}

function chatTitlesNeedMigrate(raw, slices) {
  if (chatTitlesNeedWrite(raw)) return true;
  const src = normalizeChatTitles(raw);
  const next = migrateChatTitles(raw, slices);
  const srcHashes = Object.keys(src).filter(id => LEGACY_HASH_ID_RE.test(id));
  const nextHashes = Object.keys(next).filter(id => LEGACY_HASH_ID_RE.test(id));
  return nextHashes.length < srcHashes.length;
}

async function persistChatTitles(uid, titles, nowMs, slices) {
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Number(nowMs) || Date.now();
  const extra = slices && typeof slices === "object" ? slices : {};
  let next = migrateChatTitles(titles, extra);
  let skipped = false;
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      skipped = true;
      return;
    }
    const prev = snap.data() || {};
    if (prev.uid && prev.uid !== uid) {
      const err = new Error("owner_mismatch");
      err.code = "permission-denied";
      throw err;
    }
    if (!chatTitlesNeedWrite(prev.chatTitles)) {
      skipped = true;
      next = migrateChatTitles(prev.chatTitles, extra);
      return;
    }
    const ids = {
      currentConversationId: clipConversationId(prev.currentConversationId)
        || clipConversationId(extra.currentConversationId)
        || conversationIdFromTurns(extra.currentTurns || extra.current)
        || mintConversationId(),
      archiveConversationId: clipConversationId(prev.archiveConversationId)
        || clipConversationId(extra.archiveConversationId)
        || conversationIdFromTurns(extra.archiveTurns || extra.archive)
    };
    next = migrateChatTitles(prev.chatTitles, {...extra, ...ids});
    const patch = {
      chatTitles: next,
      updatedAtMs: now
    };
    if (!clipConversationId(prev.currentConversationId) && ids.currentConversationId) {
      patch.currentConversationId = ids.currentConversationId;
    }
    if (!clipConversationId(prev.archiveConversationId) && ids.archiveConversationId) {
      patch.archiveConversationId = ids.archiveConversationId;
    }
    tx.update(ref, patch);
  });
  return {ok: true, skipped, chatTitles: next};
}

async function renameChat(uid, chatId, title, nowMs, opts) {
  const extra = opts && typeof opts === "object" && !Array.isArray(opts) ? opts : {};
  let id = clipConversationId(chatId) || clipConversationId(extra.conversationId);
  if (!id && LEGACY_HASH_ID_RE.test(String(chatId || "").trim())) {
    id = String(chatId).trim();
  }
  if (!CONVERSATION_ID_RE.test(id) && !LEGACY_HASH_ID_RE.test(id)) {
    return {ok: false, error: "invalid_chat_id"};
  }
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
    const slices = extra.slices || titleSlicesFrom({
      currentConversationId: prev.currentConversationId,
      archiveConversationId: prev.archiveConversationId
    }, extra.currentTurns, extra.archiveTurns);
    titles = migrateChatTitles(prev.chatTitles, slices);
    if (LEGACY_HASH_ID_RE.test(id)) {
      const known = clipConversationId(slices.currentConversationId)
        || clipConversationId(slices.archiveConversationId);
      if (known) {
        titles[known] = {title: clipped, updatedAtMs: now};
        delete titles[id];
        id = known;
      } else {
        titles[id] = {title: clipped, updatedAtMs: now};
      }
    } else {
      titles[id] = {title: clipped, updatedAtMs: now};
    }
    const patch = {
      chatTitles: titles,
      updatedAtMs: now,
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1
    };
    if (snap.exists) {
      tx.update(ref, patch);
    } else {
      tx.set(ref, {
        uid,
        threadId: bot.threadIdForUid(uid),
        ...patch
      });
    }
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
  const state = {
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
    currentConversationId: staleGeneration ? "" : clipConversationId(data.currentConversationId),
    archiveConversationId: staleGeneration ? "" : clipConversationId(data.archiveConversationId),
    [prefs.LAST_USED_FIELD]: staleGeneration ? 0 : (Number(data[prefs.LAST_USED_FIELD]) || 0),
    [prefs.SESSION_RESET_FIELD]: staleGeneration ? 0 : prefs.sessionResetVersionOf(data),
    headlessShoutOutDraft: staleGeneration ? null : (data.headlessShoutOutDraft && typeof data.headlessShoutOutDraft === "object"
      ? data.headlessShoutOutDraft
      : null),
    headlessVipDraft: staleGeneration ? null : (data.headlessVipDraft && typeof data.headlessVipDraft === "object"
      ? data.headlessVipDraft
      : null),
    sessionWorkflow: staleGeneration ? null : (data.sessionWorkflow && typeof data.sessionWorkflow === "object"
      ? data.sessionWorkflow
      : null),
    joinedRoomConversationId: staleGeneration ? "" : clipConversationId(data.joinedRoomConversationId),
    joinedRoomId: staleGeneration ? "" : String(data.joinedRoomId || "").trim().slice(0, 80)
  };
  if (
    state.joinedRoomId
    && state.joinedRoomConversationId
    && state.currentConversationId
    && state.joinedRoomConversationId !== state.currentConversationId
  ) {
    state.joinedRoomId = "";
  }
  return state;
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
    const ids = resolveConversationIds(prev, epoch, options.conversationId);
    const userTurn = stampConversation(
      {role: "user", text: userStored, seq: userSeq, atMs: receivedAtMs},
      ids.currentConversationId
    );
    const modelTurn = stampConversation(
      {role: "model", text: modelStored, seq: modelSeq, atMs: now},
      ids.currentConversationId
    );
    const media = bot.clipStoredMedia(options.media);
    if (media.length) modelTurn.media = media;
    const nextTurns = bot.clipStoredTurns([...turns, userTurn, modelTurn]);
    const events = ref.collection("events");
    const userId = bot.eventDocId(userSeq);
    const modelId = bot.eventDocId(modelSeq);
    if (userId) {
      tx.set(events.doc(userId), eventFields({
        seq: userSeq,
        epoch,
        role: "user",
        text: userStored,
        atMs: receivedAtMs,
        uid
      }, ids.currentConversationId));
    }
    if (modelId) {
      tx.set(events.doc(modelId), eventFields({
        seq: modelSeq,
        epoch,
        role: "model",
        text: modelStored,
        atMs: now,
        uid
      }, ids.currentConversationId));
    }
    if (!firstSeq) firstSeq = userSeq;
    eventCount = modelSeq;
    while (eventCount - firstSeq + 1 > bot.MAX_STORED_EVENTS && firstSeq <= eventCount) {
      const staleId = bot.eventDocId(firstSeq);
      if (staleId) tx.delete(events.doc(staleId));
      firstSeq += 1;
    }
    const slices = titleSlicesFrom(ids, nextTurns, []);
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
      ...threadConversationPatch(ids),
      [prefs.LAST_USED_FIELD]: prefs.nextLastUsed(prev[prefs.LAST_USED_FIELD], receivedAtMs),
      [prefs.SESSION_RESET_FIELD]: prefs.CURRENT_VERSION,
      retrievalFromSeq: nextRetrievalFromSeq(prev, prev.eventCount)
    }, {merge: true});
    if (chatTitlesNeedMigrate(prev.chatTitles, slices)) {
      tx.update(ref, {chatTitles: migrateChatTitles(prev.chatTitles, slices)});
    }
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
    const current = clipConversationId(prev.currentConversationId);
    tx.set(ref, {
      status: "idle_ended",
      conversationEpoch: epoch,
      lastMessageAtMs: 0,
      lastMessageAtIso: new Date(now).toISOString(),
      revision: Math.max(0, Math.floor(Number(prev.revision) || 0)) + 1,
      updatedAtMs: now,
      ...(current ? {archiveConversationId: current} : {})
    }, {merge: true});
  });
  return {ok: true};
}

function publicTurn(row) {
  const item = {role: row.role, text: row.text};
  const conversationId = clipConversationId(row && row.conversationId);
  if (conversationId) item.conversationId = conversationId;
  return item;
}

function eventsToTurns(rows, limit, minSeq) {
  const cap = Math.max(2, Math.min(24, Number(limit) || 12));
  const min = Math.max(0, Math.floor(Number(minSeq) || 0));
  return (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
    .map(row => {
      const item = {
        role: row?.role === "model" || row?.role === "assistant" ? "model" : "user",
        text: String(row?.text || row?.sanitizedContent || ""),
        seq: Math.max(0, Math.floor(Number(row?.seq) || 0)),
        atMs: Number(row?.atMs) || 0
      };
      const conversationId = clipConversationId(row?.conversationId);
      if (conversationId) item.conversationId = conversationId;
      return item;
    })
    .filter(row => row.text && (min === 0 || row.seq >= min))
    .slice(-cap)
    .map(row => {
      const item = {role: row.role, text: row.text, seq: row.seq, atMs: row.atMs};
      if (row.conversationId) item.conversationId = row.conversationId;
      return item;
    });
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
  if (fromEvents.length) return fromEvents.map(publicTurn);
  const fromDoc = bot.clipStoredTurns(docTurns).filter(row => passesRetrievalCursor(row, minSeq, true));
  if (fromDoc.length) return fromDoc.map(publicTurn);
  if (idleEnded && archiveConsent && Array.isArray(archiveTurns) && archiveTurns.length) {
    return bot.clipStoredTurns(archiveTurns)
      .filter(row => passesRetrievalCursor(row, minSeq, false))
      .map(publicTurn);
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
      const conversationId = clipConversationId(row.conversationId);
      if (conversationId) item.conversationId = conversationId;
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
    const conversationId = clipConversationId(row.conversationId);
    batch.set(
      ref.collection("archive").doc(msg.messageId),
      {uid, ...msg, ...(conversationId ? {conversationId} : {})},
      {merge: true}
    );
    writes += 1;
  });
  if (!writes) return {ok: true, skipped: true};
  await batch.commit();
  return {ok: true};
}

async function persistHeadlessShoutOutDraft(uid, draft) {
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Date.now();
  if (!draft) {
    await ref.set({
      headlessShoutOutDraft: admin.firestore.FieldValue.delete(),
      updatedAtMs: now
    }, {merge: true});
    return {ok: true, cleared: true};
  }
  const headless = require("./headless-shoutout-core");
  await ref.set({
    headlessShoutOutDraft: headless.clipInteractiveDraft(draft),
    updatedAtMs: now
  }, {merge: true});
  return {ok: true};
}

async function persistHeadlessVipDraft(uid, draft) {
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Date.now();
  if (!draft) {
    await ref.set({
      headlessVipDraft: admin.firestore.FieldValue.delete(),
      updatedAtMs: now
    }, {merge: true});
    return {ok: true, cleared: true};
  }
  const headless = require("./headless-vip-core");
  await ref.set({
    headlessVipDraft: headless.clipInteractiveDraft(draft),
    updatedAtMs: now
  }, {merge: true});
  return {ok: true};
}

async function persistJoinedRoomId(uid, roomId, conversationId) {
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const now = Date.now();
  if (!roomId) {
    await ref.set({
      joinedRoomId: admin.firestore.FieldValue.delete(),
      joinedRoomConversationId: admin.firestore.FieldValue.delete(),
      updatedAtMs: now
    }, {merge: true});
    return {ok: true, cleared: true};
  }
  const convo = clipConversationId(conversationId);
  await ref.set({
    joinedRoomId: String(roomId).trim().slice(0, 80),
    joinedRoomConversationId: convo || admin.firestore.FieldValue.delete(),
    updatedAtMs: now
  }, {merge: true});
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
    const ids = resolveConversationIds(prev, epoch, options.conversationId);
    const userTurn = stampConversation(
      {role: "user", text: userStored, seq: userSeq, atMs: receivedAtMs},
      ids.currentConversationId
    );
    const nextTurns = bot.clipStoredTurns([...turns, userTurn]);
    const userId = bot.eventDocId(userSeq);
    if (userId) {
      tx.set(ref.collection("events").doc(userId), eventFields({
        seq: userSeq,
        epoch,
        role: "user",
        text: userStored,
        atMs: receivedAtMs,
        uid,
        status: "pending_model"
      }, ids.currentConversationId));
    }
    if (!firstSeq) firstSeq = userSeq;
    eventCount = userSeq;
    const slices = titleSlicesFrom(ids, nextTurns, []);
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
      ...threadConversationPatch(ids),
      [prefs.LAST_USED_FIELD]: prefs.nextLastUsed(prev[prefs.LAST_USED_FIELD], receivedAtMs),
      [prefs.SESSION_RESET_FIELD]: prefs.CURRENT_VERSION,
      retrievalFromSeq: nextRetrievalFromSeq(prev, prev.eventCount)
    }, {merge: true});
    if (chatTitlesNeedMigrate(prev.chatTitles, slices)) {
      tx.update(ref, {chatTitles: migrateChatTitles(prev.chatTitles, slices)});
    }
    written = {
      seq: userSeq,
      epoch,
      receivedAtMs,
      userStored,
      conversationId: ids.currentConversationId
    };
  });
  const consent = memory.normalizeConsent(options.consent);
  if (written && memory.consentAllows(consent, "archive")) {
    await persistArchiveTurns(uid, consent, [{
      seq: written.seq,
      epoch: written.epoch,
      role: "user",
      text: written.userStored,
      atMs: written.receivedAtMs,
      conversationId: written.conversationId,
      idempotencyKey: bot.eventDocId(written.seq)
    }]);
  }
  return {ok: true, ...written};
}

async function persistSessionWorkflow(uid, workflow, nowMs) {
  const ref = threadRef(uid);
  if (!ref) return {ok: false, error: "missing_uid"};
  const intent = require("./botdee-session-intent");
  const row = intent.clipWorkflow(workflow);
  const now = Number(nowMs) || Date.now();
  await ref.set({
    sessionWorkflow: row,
    sessionWorkflowAtMs: now,
    updatedAtMs: now
  }, {merge: true});
  return {ok: true, sessionWorkflow: row};
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
    const ids = resolveConversationIds(prev, epoch, options.conversationId);
    const modelSeq = eventCount + 1;
    const modelTurn = stampConversation(
      {role: "model", text: modelStored, seq: modelSeq, atMs: now},
      ids.currentConversationId
    );
    const media = bot.clipStoredMedia(options.media);
    if (media.length) modelTurn.media = media;
    const nextTurns = bot.clipStoredTurns([...turns, modelTurn]);
    const modelId = bot.eventDocId(modelSeq);
    if (modelId) {
      tx.set(ref.collection("events").doc(modelId), eventFields({
        seq: modelSeq,
        epoch,
        role: "model",
        text: modelStored,
        atMs: now,
        uid
      }, ids.currentConversationId));
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
      updatedAtMs: now,
      ...threadConversationPatch(ids)
    }, {merge: true});
    written = {seq: modelSeq, epoch, modelStored, conversationId: ids.currentConversationId};
  });
  const consent = memory.normalizeConsent(options.consent);
  if (written && memory.consentAllows(consent, "archive")) {
    await persistArchiveTurns(uid, consent, [{
      seq: written.seq,
      epoch: written.epoch,
      role: "model",
      text: written.modelStored,
      atMs: now,
      conversationId: written.conversationId,
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
  persistSessionWorkflow,
  persistHeadlessShoutOutDraft,
  persistHeadlessVipDraft,
  persistJoinedRoomId,
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
  mintConversationId,
  clipConversationId,
  renameChat,
  CHAT_TITLE_MAX,
  CHAT_ID_RE,
  CONVERSATION_ID_RE,
  STABLE_CHAT_ID_RE,
  SLOT_CHAT_ID_RE,
  LEGACY_HASH_ID_RE
};
