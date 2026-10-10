"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const writes = [];
const fakeFirestore = () => ({
  collection: (name) => ({
    doc: (id) => ({
      set: async (payload) => { writes.push({collection: name, id, payload}); }
    })
  })
});
fakeFirestore.FieldValue = {serverTimestamp: () => "ts", delete: () => "del"};
require.cache[require.resolve("firebase-admin")] = {
  id: "firebase-admin",
  filename: require.resolve("firebase-admin"),
  loaded: true,
  exports: {apps: [{}], initializeApp() {}, firestore: fakeFirestore}
};

const {MASK, redactDeep} = require("./secret-redaction");
const twilioLog = require("./twilio-log");
const {generateDailyAuthCode, buildPendingShoutoutMessage} = require("./messaging-core");

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

function mixedClubCode() {
  for (;;) {
    const code = generateDailyAuthCode(6);
    if (/\d/.test(code) && /[A-Z]/.test(code)) return code;
  }
}

async function storedRows(options) {
  writes.length = 0;
  await twilioLog.sendTwilioMessagesApi({from: "", to: "+12025550143", ...options});
  assert.ok(writes.length >= 1, "twilio log row written");
  return writes;
}

const testAlertBody = (code) => `FloqR test alert for Heist DC. Today's club code is ${code}. Reply APPROVE {code} or REJECT {code} on real pending ShoutOuts.`;

test("club daily code in an SMS test alert never reaches twilioSmsLogs or twilioComplianceLogs", async () => {
  for (let i = 0; i < 100; i += 1) {
    const code = generateDailyAuthCode(6);
    const rows = await storedRows({channel: "sms", purpose: "test", body: testAlertBody(code)});
    const json = JSON.stringify(rows);
    assert.ok(!json.includes(code), `club code ${code} stored in clear`);
    assert.ok(rows.some((row) => row.collection === "twilioSmsLogs"));
    assert.ok(rows.some((row) => row.collection === "twilioComplianceLogs"));
    assert.match(rows[0].payload.diagnostic.body, /club code is ••••••\./);
  }
});

test("club daily code in a WhatsApp alert never reaches twilioWhatsAppLogs", async () => {
  for (let i = 0; i < 100; i += 1) {
    const code = generateDailyAuthCode(6);
    const rows = await storedRows({channel: "whatsapp", to: "whatsapp:+447700900123", purpose: "test", body: testAlertBody(code), extra: {note: `code: ${code}`}});
    const json = JSON.stringify(rows);
    assert.ok(!json.includes(code), `club code ${code} stored in clear`);
    assert.equal(rows[0].collection, "twilioWhatsAppLogs");
  }
});

test("unlabelled mixed club codes and APPROVE / REJECT / YES replies are masked", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = mixedClubCode();
    assert.ok(!twilioLog.redactSecrets(`Heads up ${code} tonight`).includes(code));
    assert.ok(!twilioLog.redactSecrets(`APPROVE ${code}`).includes(code));
    assert.ok(!twilioLog.redactSecrets(`reject: ${code.toLowerCase()}`).includes(code.toLowerCase()));
    assert.ok(!twilioLog.redactSecrets(`yes ${code}`).includes(code));
  }
  assert.equal(twilioLog.redactSecrets("APPROVE ABCDEF"), `APPROVE ${MASK}`);
  assert.equal(twilioLog.redactSecrets("Today's club code (2026-10-09): QWERTY"), `Today's club code (2026-10-09): ${MASK}`);
});

test("labelled OTP / passcode / recovery / 8-char email codes and six-digit codes are masked", () => {
  const cases = [
    ["Your FLOQR WhatsApp code: 007311", "007311"],
    ["FLOQR sign-in code is 482913. Do not share it.", "482913"],
    ["Your FLOQR sign-in code is HJK2MN34.", "HJK2MN34"],
    ["OTP=99A1", "99A1"],
    ["passcode # 4417", "4417"],
    ["Your SOS2FA recovery code is floqr-recovery-7Kx91-ZZ", "floqr-recovery-7Kx91-ZZ"]
  ];
  cases.forEach(([input, secret]) => {
    assert.ok(!twilioLog.redactSecrets(input).includes(secret), `${input} leaked ${secret}`);
  });
  assert.match(twilioLog.redactSecrets(`AC${"0".repeat(32)}`), /AC\[redacted\]/);
  assert.match(twilioLog.redactSecrets(`SK${"f".repeat(32)}`), /SK\[redacted\]/);
  assert.equal(twilioLog.redactSecrets("Authorization: Bearer abc.def"), "Authorization: Bearer [redacted]");
});

test("non-secret SMS / WhatsApp copy (club names, prices, phone-safe text) is not over-masked", () => {
  const pending = buildPendingShoutoutMessage({
    clubName: "Heist DC",
    mainText: "Happy B-Day to my gorgeous Wife D' 👏",
    referenceNumber: "SO-4821937",
    previewUrl: "https://www.floqr.com/display.html?location=heist-dc"
  });
  const prose = [
    pending,
    "FloqR: club code incorrect or expired. Check today's code in Club Admin REP.",
    "FloqR: ShoutOut approved (Xq9vLm2PzR8sTn4bWc1d).",
    "Reply STOP to opt out. Msg & data rates may apply. HELP for help.",
    "SMS alerts $20.00/mo, WhatsApp $25. 96X48 LED at Zebbies, 1544 U St NW, Washington DC 20009. Call +1 202-555-0143.",
    "Ridin' Rari at Aurelia 10:30 PM. Approve selected shifts in Work Calendar.",
    "If you did not request this code, ignore this message. The code expires in 5 minutes."
  ];
  prose.forEach((line) => assert.equal(twilioLog.redactSecrets(line), line));
});

test("redactDeep masks codes inside Twilio debugger payloads without touching keys", () => {
  const code = mixedClubCode();
  const out = redactDeep({
    error_code: "11200",
    webhook: {request: {parameters: {Body: `APPROVE ${code}`, From: "+12025550143"}}},
    list: [`code is ${code}`, 42]
  });
  const json = JSON.stringify(out);
  assert.ok(!json.includes(code));
  assert.equal(out.error_code, "11200");
  assert.equal(out.list[1], 42);
  assert.equal(out.webhook.request.parameters.From, "+12025550143");
});

test("stored request headers never carry the full Twilio Account SID", async () => {
  const sid = `AC${"a1".repeat(16)}`;
  writes.length = 0;
  await twilioLog.writeTwilioLog({
    channel: "sms",
    status: "sent",
    sendOk: true,
    requestHeaders: {host: "api.twilio.com", path: `/2010-04-01/Accounts/${sid}/Messages.json`}
  });
  const json = JSON.stringify(writes);
  assert.ok(!json.includes(sid));
  assert.match(writes[0].payload.diagnostic.requestHeaders.path, /Accounts\/AC\[redacted\]\/Messages\.json/);
});

test("every Twilio body logger uses the shared secret-redaction module", () => {
  const log = read("twilio-log.js");
  assert.match(log, /require\("\.\/secret-redaction"\)/);
  assert.doesNotMatch(log, /\\d\{6\}/);
  const debuggerHook = read("twilio-debugger-webhook.js");
  assert.match(debuggerHook, /redactSecrets\(rawPayload\)/);
  assert.match(debuggerHook, /redactDeep\(rawParsed\)/);
  const messaging = read("messaging-functions.js");
  assert.match(messaging, /body: text\(redactSecrets\(entry\.body\), 1600\)/);
  assert.match(messaging, /body: text\(redactSecrets\(body\), 1600\)/);
  assert.match(messaging, /codeProvided: !!parsed\.code/);
  assert.doesNotMatch(messaging, /code: text\(parsed\.code/);
  assert.match(read("marketing-campaign-functions.js"), /body: text\(redactSecrets\(body\), 1600\)/);
});
