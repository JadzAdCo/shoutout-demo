"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeE164,
  normalizeChannelPreference,
  channelsForPreference,
  clubDayKey,
  generateDailyAuthCode,
  hashDailyAuthCode,
  parseOpsReply,
  buildPendingShoutoutMessage,
  twilioWhatsAppAddress,
  selectOutboundTargets
} = require("./messaging-core");

test("normalizes E.164 phone numbers", () => {
  assert.equal(normalizeE164("+1 (202) 555-0123"), "+12025550123");
  assert.equal(normalizeE164("2025550123"), "+12025550123");
  assert.equal(normalizeE164("12025550123"), "+12025550123");
  assert.equal(normalizeE164("bad"), "");
});

test("channel preference maps to outbound channels", () => {
  assert.equal(normalizeChannelPreference("WA"), "whatsapp");
  assert.deepEqual(channelsForPreference("both"), ["sms", "whatsapp"]);
  assert.deepEqual(channelsForPreference("sms"), ["sms"]);
});

test("club day key is YYYY-MM-DD in club timezone", () => {
  assert.match(clubDayKey(new Date("2026-07-18T12:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("daily auth codes are alphabet-safe and hash stably", () => {
  const code = generateDailyAuthCode(6);
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.equal(hashDailyAuthCode("ab12cd", "pepper"), hashDailyAuthCode("AB12CD", "pepper"));
  assert.notEqual(hashDailyAuthCode("AB12CD", "pepper"), hashDailyAuthCode("AB12CD", "other"));
});

test("parses APPROVE/REJECT ops replies", () => {
  assert.deepEqual(parseOpsReply("APPROVE K7M2PQ"), {action: "approve", code: "K7M2PQ", raw: "APPROVE K7M2PQ"});
  assert.equal(parseOpsReply("reject xyz9").action, "reject");
  assert.equal(parseOpsReply("hello").action, null);
});

test("builds pending shoutout alert copy", () => {
  const body = buildPendingShoutoutMessage({
    clubName: "Zebbies",
    mainText: "Happy Birthday!",
    referenceNumber: "REF1",
    previewUrl: "https://example.com/preview"
  });
  assert.match(body, /Zebbies/);
  assert.match(body, /APPROVE/);
  assert.match(body, /Preview:/);
});

test("selectOutboundTargets honors paid SMS and WhatsApp flags", () => {
  assert.deepEqual(selectOutboundTargets({alertPhone: "+12025550123"}), []);
  assert.deepEqual(
    selectOutboundTargets({alertPhone: "2025550123", smsEnabled: true, smsPaidAt: "x"}),
    [{channel: "sms", to: "+12025550123"}]
  );
  assert.deepEqual(
    selectOutboundTargets({
      alertPhone: "+12025550123",
      whatsappEnabled: true,
      channelPreference: "whatsapp"
    }),
    [{channel: "whatsapp", to: "+12025550123"}]
  );
  assert.deepEqual(
    selectOutboundTargets({
      alertPhone: "+12025550123",
      smsEnabled: true,
      smsPaidAt: "paid",
      whatsappEnabled: true,
      channelPreference: "both"
    }),
    [
      {channel: "sms", to: "+12025550123"},
      {channel: "whatsapp", to: "+12025550123"}
    ]
  );
});

test("twilio WhatsApp address prefix", () => {
  assert.equal(twilioWhatsAppAddress("+12025550123"), "whatsapp:+12025550123");
  assert.equal(twilioWhatsAppAddress(""), "");
});