"use strict";

// Design notes: .cursor/rules/design-notes-data-classification.mdc → "Security Phase 0 + 1 (s3.1.26)"
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const rules = read("firestore.rules");
const storage = read("storage.rules");

function braced(text, marker) {
  const start = text.indexOf(marker);
  assert.ok(start >= 0, `missing ${marker}`);
  const open = marker.startsWith("match ") ? text.indexOf(" {", start) + 1 : text.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}") depth -= 1;
    if (depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`unclosed ${marker}`);
}

const match = name => braced(rules, `match /${name}/`);
const fn = name => braced(rules, `function ${name}(`);

test("rules header carries the s3.1.26 marker", () => {
  assert.match(rules, /FLOQR FIRESTORE RULES VERSION: s3\.1\.26-security-phase-1/);
  assert.match(storage, /s3\.1\.26-mingl-media-members/);
});

test("diffs use affectedKeys so added or removed keys cannot slip through", () => {
  assert.doesNotMatch(rules, /changedKeys\(\)/);
  const identity = fn("preservesBackendOnlyIdentityFields");
  assert.match(identity, /affectedKeys\(\)/);
});

test("messages: no client-written system sender; parties and sender email are pinned", () => {
  const messages = match("messages");
  assert.doesNotMatch(messages, /== "system"/);
  const keeps = fn("keepsMessageParties");
  ["senderUid", "recipientUid", "senderEmail", "participants"].forEach(field => assert.match(keeps, new RegExp(`"${field}"`), field));
});

test("chatRooms / chatMessages: no non-Mingl escape branch, members only", () => {
  const rooms = match("chatRooms");
  const messages = match("chatMessages");
  [rooms, messages].forEach(block => {
    assert.doesNotMatch(block, /!isExistingMinglRoom\(\)|!isNewMinglRoom\(\)|!isExistingMinglMessage\(\)|!isNewMinglMessage\(\)/);
    assert.doesNotMatch(block, /allow (read|create|update|delete): if signedIn\(\);/);
  });
  assert.match(rooms, /allow read: if isMasterAdmin\(\) \|\| isParticipant\(\);/);
  assert.match(rooms, /allow create: if isMasterAdmin\(\) \|\| isValidNewMinglRoom\(roomId\);/);
  assert.match(rooms, /keepsMinglRoomIdentity\(\)/);
  const valid = fn("isValidNewMinglRoom");
  assert.match(valid, /roomId == "mingl_" \+ /);
  assert.match(valid, /isMutualMingl\(/);
  assert.match(messages, /senderUid == request\.auth\.uid/);
  assert.match(messages, /isMutualMingl\(/);
});

test("minglConnections: pending-only create, only requestedTo accepts, blocker owns a block", () => {
  const block = match("minglConnections");
  assert.match(block, /allow create: if isValidMinglConnectionCreate\(\);/);
  assert.match(block, /minglStatusTransitionOk\(\)/);
  assert.match(block, /minglRequestPartiesOk\(\)/);
  const create = fn("isValidMinglConnectionCreate");
  assert.match(create, /"requestedBy", ""\) == request\.auth\.uid/);
  assert.match(create, /"requestedTo", ""\) != request\.auth\.uid/);
  assert.match(create, /participants\.size\(\) == 2/);
  const transition = fn("minglStatusTransitionOk");
  assert.match(transition, /before == "pending" && resource\.data\.get\("requestedTo", ""\) == request\.auth\.uid/);
  assert.match(transition, /before == "blocked"/);
});

test("userBlocks: only the blocker changes an active block", () => {
  const block = match("userBlocks");
  assert.match(block, /blockedBy/);
  assert.match(block, /keepsField\("blockedBy"\)/);
});

test("aiIndex: writes are Master Admin (or Functions) only", () => {
  const block = match("aiIndex");
  assert.match(block, /allow create, update: if isMasterAdmin\(\)/);
  assert.match(block, /allow delete: if isMasterAdmin\(\);/);
  assert.doesNotMatch(block, /allow (create|update|delete|write)[^;]*signedIn\(\)/);
});

test("suprstrSessions: board answer is write-once with a fixed shape", () => {
  const block = match("suprstrSessions");
  assert.match(block, /resource\.data\.get\("answer", null\) == null/);
  assert.match(block, /hasOnly\(\["answer", "status", "answeredAt", "updatedAt"\]\)/);
  assert.match(block, /answer\.type == "answer"/);
  assert.match(block, /size\(\) <= 20000/);
});

test("supRstar session docs no longer publish the broadcaster email", () => {
  const src = read("functions/suprstr-functions.js");
  const start = src.indexOf("tx.set(sessionRef, {");
  assert.ok(start > 0);
  const session = src.slice(start, src.indexOf("});", start));
  assert.doesNotMatch(session, /broadcasterEmail/);
});

test("storage: Mingl chat media is limited to the room's participants", () => {
  const member = braced(storage, "function isChatRoomMember(");
  assert.match(member, /chatRooms\/\$\(roomId\)/);
  ["mingl-chat", "mingl-chat-backgrounds"].forEach(prefix => {
    const block = braced(storage, `match /${prefix}/{userId}/{roomId}`);
    assert.match(block, /canReadChatMedia\(userId, roomId\)/, prefix);
    assert.match(block, /canWriteChatMedia\(userId, roomId\)/, prefix);
  });
});

test("client fixes: Mingl request message carries senderUid; aiIndex upsert tolerates denial", () => {
  assert.match(read("patron-app.js"), /messageType:"mingl_request", senderUid:currentUser\.uid/);
  assert.match(read("ai-index-service.js"), /permission-denied/);
  assert.match(read("floqr-blocks.js"), /error\?\.code !== "permission-denied"/);
});
