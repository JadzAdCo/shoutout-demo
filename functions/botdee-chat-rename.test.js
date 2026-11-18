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

test("normalizeChatTitles keeps only owner-row ids and titles", () => {
  const titles = threads.normalizeChatTitles({
    live: {title: "  Ver  ", updatedAtMs: 9},
    current: "Nov 18",
    archive: {title: ""},
    evil: {title: "nope"},
    "epoch-2": {title: "Who am I?"}
  });
  assert.equal(titles.live.title, "Ver");
  assert.equal(titles.current.title, "Nov 18");
  assert.equal(titles.archive, undefined);
  assert.equal(titles.evil, undefined);
  assert.equal(titles["epoch-2"].title, "Who am I?");
});

test("CHAT_ID_RE accepts Chats sheet ids only", () => {
  assert.equal(threads.CHAT_ID_RE.test("live"), true);
  assert.equal(threads.CHAT_ID_RE.test("current"), true);
  assert.equal(threads.CHAT_ID_RE.test("archive"), true);
  assert.equal(threads.CHAT_ID_RE.test("epoch-12"), true);
  assert.equal(threads.CHAT_ID_RE.test("../users"), false);
  assert.equal(threads.CHAT_ID_RE.test("master-admin"), false);
});

test("renameBotDeeChat is owner-uid only and is not Gemini context", () => {
  const fns = read("functions/bot-dee-functions.js");
  const idx = fns.indexOf("exports.renameBotDeeChat");
  const execStart = fns.indexOf("exports.executeBotSession");
  const execEnd = fns.indexOf("exports.setBotDeeSettings");
  const executeSlice = fns.slice(execStart, execEnd);
  assert.ok(idx > 0);
  assert.match(fns, /request\.auth\?\.uid/);
  assert.match(read("functions/index.js"), /renameBotDeeChat:/);
  assert.match(executeSlice, /Never put them in Gemini/);
  assert.doesNotMatch(executeSlice, /chatTitles:/);
  assert.doesNotMatch(executeSlice, /buildModelContext\([\s\S]*chatTitles/);
  assert.doesNotMatch(read("functions/bot-dee-core.js"), /chatTitles/);
  assert.doesNotMatch(read("functions/botdee-execution.js"), /chatTitles/);
  assert.match(read("functions/bot-dee-thread.js"), /Never sent to Gemini/);
});

test("renameChat refuses missing uid / empty title without writing", async () => {
  const missing = await threads.renameChat("", "live", "Hello");
  assert.equal(missing.ok, false);
  const empty = await threads.renameChat("uid-a", "live", "   ");
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "empty_title");
  const badId = await threads.renameChat("uid-a", "not-a-row", "Hello");
  assert.equal(badId.ok, false);
  assert.equal(badId.error, "invalid_chat_id");
});
