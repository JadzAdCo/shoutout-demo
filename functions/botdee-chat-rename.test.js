"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const threads = require("./bot-dee-thread");
const bot = require("./bot-dee-core");

test("clipChatTitle trims, caps length, and strips control chars", () => {
  assert.equal(threads.clipChatTitle("  Hello   world  "), "Hello world");
  assert.equal(threads.clipChatTitle("a".repeat(200)).length, threads.CHAT_TITLE_MAX);
  assert.equal(threads.clipChatTitle("Hi\u0000there"), "Hithere");
  assert.equal(threads.clipChatTitle("   "), "");
});

test("mintConversationId is a stable cv_ uuid, not a first-user hash", () => {
  const id = threads.mintConversationId();
  assert.match(id, threads.CONVERSATION_ID_RE);
  assert.notEqual(id, threads.mintConversationId());
  assert.equal(threads.CHAT_ID_RE.test(id), true);
  assert.equal(threads.CHAT_ID_RE.test("live"), false);
  assert.equal(threads.CHAT_ID_RE.test("current"), false);
  assert.equal(threads.CHAT_ID_RE.test("archive"), false);
  assert.equal(threads.CHAT_ID_RE.test("c_0123456789abcdef"), false);
  assert.equal(threads.CHAT_ID_RE.test("../users"), false);
});

test("title survives last-12 restore via conversationId not first user line", () => {
  const id = threads.mintConversationId();
  const events = [];
  for (let i = 0; i < 20; i += 1) {
    events.push({
      role: "user",
      text: i === 0 ? "Who am I?" : `Later line ${i}`,
      conversationId: id,
      seq: i * 2 + 1,
      atMs: 1000 + i
    });
    events.push({
      role: "model",
      text: "ok",
      conversationId: id,
      seq: i * 2 + 2,
      atMs: 1001 + i
    });
  }
  const last12 = threads.eventsToTurns(events, 12);
  assert.equal(last12.length, 12);
  assert.notEqual(threads.firstUserTextFromTurns(last12), "Who am I?");
  assert.notEqual(
    threads.conversationIdFromFirstUser(threads.firstUserTextFromTurns(last12)),
    threads.conversationIdFromFirstUser("Who am I?")
  );
  assert.equal(threads.conversationIdFromTurns(last12), id);
  const hashed = threads.conversationIdFromFirstUser("Who am I?");
  const migrated = threads.migrateChatTitles({
    [id]: {title: "Night out", updatedAtMs: 9},
    [hashed]: {title: "Old hash", updatedAtMs: 1}
  }, {
    currentConversationId: id,
    currentTurns: last12
  });
  assert.equal(migrated[id].title, "Night out");
  assert.equal(migrated.live, undefined);
  assert.equal(migrated.current, undefined);
  const restored = threads.assembleRetrievalTurns({
    docTurns: [],
    events,
    archiveTurns: [],
    idleEnded: false,
    archiveConsent: false
  });
  assert.equal(threads.conversationIdFromTurns(restored), id);
  assert.equal(threads.migrateChatTitles(
    {[id]: {title: "Night out", updatedAtMs: 9}},
    {currentConversationId: id, currentTurns: restored}
  )[id].title, "Night out");
});

test("migrateChatTitles remaps slot keys onto conversationId and drops leftover slots", () => {
  const currentId = threads.mintConversationId();
  const archiveId = threads.mintConversationId();
  const migrated = threads.migrateChatTitles({
    live: {title: "Night out", updatedAtMs: 9},
    current: {title: "Stale slot", updatedAtMs: 1},
    archive: {title: "Last week", updatedAtMs: 2},
    evil: {title: "nope"}
  }, {
    currentConversationId: currentId,
    archiveConversationId: archiveId
  });
  assert.equal(migrated.live, undefined);
  assert.equal(migrated.current, undefined);
  assert.equal(migrated.archive, undefined);
  assert.equal(migrated.evil, undefined);
  assert.equal(migrated[currentId].title, "Night out");
  assert.equal(migrated[archiveId].title, "Last week");
  assert.equal(threads.chatTitlesNeedWrite({live: {title: "x"}}), true);
  assert.equal(threads.chatTitlesNeedWrite(migrated), false);
});

test("legacy first-user hash migrates onto known conversationId", () => {
  const id = threads.mintConversationId();
  const hashed = threads.conversationIdFromFirstUser("Who am I?");
  const migrated = threads.migrateChatTitles({
    [hashed]: {title: "Night out", updatedAtMs: 4}
  }, {
    currentConversationId: id,
    currentTurns: [{role: "user", text: "Who am I?"}]
  });
  assert.equal(migrated[id].title, "Night out");
  assert.equal(migrated[hashed], undefined);
});

test("clipStoredTurns keeps conversationId through the last-12 window", () => {
  const id = threads.mintConversationId();
  const clipped = bot.clipStoredTurns(
    Array.from({length: 20}, (_, i) => ({
      role: i % 2 ? "model" : "user",
      text: `t${i}`,
      conversationId: id
    }))
  );
  assert.equal(clipped.length, bot.MAX_HISTORY);
  assert.ok(clipped.every(row => row.conversationId === id));
});

test("persistChatTitles replaces the chatTitles map and skips a clean concurrent rename", () => {
  const src = read("functions/bot-dee-thread.js");
  const start = src.indexOf("async function persistChatTitles");
  const end = src.indexOf("async function renameChat");
  const slice = src.slice(start, end);
  assert.match(slice, /chatTitles:\s*next/);
  assert.match(slice, /tx\.update\(ref,\s*patch\)/);
  assert.doesNotMatch(slice, /merge:\s*true/);
  assert.match(slice, /chatTitlesNeedWrite\(prev\.chatTitles\)/);
  const renameStart = src.indexOf("async function renameChat");
  const renameEnd = src.indexOf("function snapshotToState");
  const renameSlice = src.slice(renameStart, renameEnd);
  assert.match(renameSlice, /tx\.update\(ref,\s*patch\)/);
  const get = read("functions/bot-dee-functions.js");
  const getStart = get.indexOf("exports.getBotDeeThread");
  const getEnd = get.indexOf("exports.renameBotDeeChat");
  const getSlice = get.slice(getStart, getEnd);
  assert.match(getSlice, /chatTitlesNeedWrite/);
  assert.match(getSlice, /persistChatTitles/);
  assert.match(getSlice, /currentConversationId/);
});

test("renameBotDeeChat is owner-uid only and is not Gemini context", () => {
  const fns = read("functions/bot-dee-functions.js");
  const idx = fns.indexOf("exports.renameBotDeeChat");
  const execStart = fns.indexOf("exports.executeBotSession");
  const execEnd = fns.indexOf("exports.setBotDeeSettings");
  const executeSlice = fns.slice(execStart, execEnd);
  assert.ok(idx > 0);
  assert.match(fns, /request\.auth\?\.uid/);
  assert.match(fns, /conversationId/);
  assert.match(read("functions/index.js"), /renameBotDeeChat:/);
  assert.match(executeSlice, /Never put them in Gemini/);
  assert.doesNotMatch(executeSlice, /chatTitles:/);
  assert.doesNotMatch(executeSlice, /buildModelContext\([\s\S]*chatTitles/);
  assert.doesNotMatch(read("functions/bot-dee-core.js"), /chatTitles/);
  assert.doesNotMatch(read("functions/botdee-execution.js"), /chatTitles/);
  assert.match(read("functions/bot-dee-thread.js"), /Never sent to Gemini/);
  assert.match(read("bot-dee-chat.js"), /mintConversationId/);
  assert.match(read("bot-dee-chat.js"), /conversationId: liveConversationId/);
});

test("renameChat refuses missing uid / empty title / slot ids", async () => {
  const id = threads.mintConversationId();
  const missing = await threads.renameChat("", id, "Hello");
  assert.equal(missing.ok, false);
  const empty = await threads.renameChat("uid-a", id, "   ");
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "empty_title");
  const badId = await threads.renameChat("uid-a", "live", "Hello");
  assert.equal(badId.ok, false);
  assert.equal(badId.error, "invalid_chat_id");
});
