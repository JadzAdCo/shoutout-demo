"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const threads = require("./bot-dee-thread");

test("clipChatTitle trims, caps length, and strips control chars", () => {
  assert.equal(threads.clipChatTitle("  Hello   world  "), "Hello world");
  assert.equal(threads.clipChatTitle("a".repeat(200)).length, threads.CHAT_TITLE_MAX);
  assert.equal(threads.clipChatTitle("Hi\u0000there"), "Hithere");
  assert.equal(threads.clipChatTitle("   "), "");
});

test("conversation ids are stable across live/current/archive slots", () => {
  const id = threads.conversationIdFromFirstUser("Who am I?");
  assert.match(id, threads.STABLE_CHAT_ID_RE);
  assert.equal(threads.conversationIdFromFirstUser("  WHO   AM I?  "), id);
  assert.equal(
    threads.conversationIdFromTurns([{role: "user", text: "Who am I?"}, {role: "model", text: "Hi"}]),
    id
  );
  assert.notEqual(threads.conversationIdFromFirstUser("Ver"), id);
  assert.equal(threads.conversationIdFromFirstUser("   "), "");
});

test("migrateChatTitles remaps slot keys onto the slice conversation id", () => {
  const currentTurns = [{role: "user", text: "Who am I?"}];
  const archiveTurns = [{role: "user", text: "hello there"}];
  const currentId = threads.conversationIdFromTurns(currentTurns);
  const archiveId = threads.conversationIdFromTurns(archiveTurns);
  const migrated = threads.migrateChatTitles({
    live: {title: "Night out", updatedAtMs: 9},
    current: {title: "Stale slot", updatedAtMs: 1},
    archive: {title: "Last week", updatedAtMs: 2},
    evil: {title: "nope"}
  }, {current: currentTurns, archive: archiveTurns});
  assert.equal(migrated.live, undefined);
  assert.equal(migrated.current, undefined);
  assert.equal(migrated.archive, undefined);
  assert.equal(migrated.evil, undefined);
  assert.equal(migrated[currentId].title, "Night out");
  assert.equal(migrated[archiveId].title, "Last week");
  assert.equal(threads.chatTitlesNeedWrite({live: {title: "x"}}), true);
  assert.equal(threads.chatTitlesNeedWrite(migrated), false);
});

test("CHAT_ID_RE accepts stable conversation ids only", () => {
  const id = threads.conversationIdFromFirstUser("Who am I?");
  assert.equal(threads.CHAT_ID_RE.test(id), true);
  assert.equal(threads.CHAT_ID_RE.test("live"), false);
  assert.equal(threads.CHAT_ID_RE.test("current"), false);
  assert.equal(threads.CHAT_ID_RE.test("archive"), false);
  assert.equal(threads.CHAT_ID_RE.test("epoch-12"), false);
  assert.equal(threads.CHAT_ID_RE.test("../users"), false);
});

test("renameBotDeeChat is owner-uid only and is not Gemini context", () => {
  const fns = read("functions/bot-dee-functions.js");
  const idx = fns.indexOf("exports.renameBotDeeChat");
  const execStart = fns.indexOf("exports.executeBotSession");
  const execEnd = fns.indexOf("exports.setBotDeeSettings");
  const executeSlice = fns.slice(execStart, execEnd);
  assert.ok(idx > 0);
  assert.match(fns, /request\.auth\?\.uid/);
  assert.match(fns, /firstUserText/);
  assert.match(read("functions/index.js"), /renameBotDeeChat:/);
  assert.match(executeSlice, /Never put them in Gemini/);
  assert.doesNotMatch(executeSlice, /chatTitles:/);
  assert.doesNotMatch(executeSlice, /buildModelContext\([\s\S]*chatTitles/);
  assert.doesNotMatch(read("functions/bot-dee-core.js"), /chatTitles/);
  assert.doesNotMatch(read("functions/botdee-execution.js"), /chatTitles/);
  assert.match(read("functions/bot-dee-thread.js"), /Never sent to Gemini/);
});

test("renameChat refuses missing uid / empty title / slot ids without firstUserText", async () => {
  const missing = await threads.renameChat("", "c_0123456789abcdef", "Hello");
  assert.equal(missing.ok, false);
  const empty = await threads.renameChat("uid-a", "c_0123456789abcdef", "   ");
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "empty_title");
  const badId = await threads.renameChat("uid-a", "live", "Hello");
  assert.equal(badId.ok, false);
  assert.equal(badId.error, "invalid_chat_id");
  assert.equal(threads.CHAT_ID_RE.test(threads.conversationIdFromFirstUser("Who am I?")), true);
});
