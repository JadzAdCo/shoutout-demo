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

test("selectOutboundTargets honors enabled channels and paid-but-paused SMS", () => {
  assert.deepEqual(selectOutboundTargets({alertPhone: "+12025550123"}), []);
  assert.deepEqual(
    selectOutboundTargets({alertPhone: "2025550123", smsEnabled: true, smsPaidAt: "x"}),
    [{channel: "sms", to: "+12025550123"}]
  );
  assert.deepEqual(
    selectOutboundTargets({alertPhone: "+12025550123", smsPaidAt: "paid", smsSubscribed: true, smsEnabled: false}),
    []
  );
  assert.deepEqual(
    selectOutboundTargets({alertPhone: "+12025550123", smsPaidAt: "paid", smsSubscribed: true}),
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

test("describeOutboundSkip explains missing phone vs paused channels", () => {
  const {describeOutboundSkip} = require("./messaging-core");
  assert.equal(describeOutboundSkip({smsEnabled: true}), "missing-phone");
  assert.equal(describeOutboundSkip({alertPhone: "+12025550123", smsSubscribed: true, smsEnabled: false}), "channels-paused");
  assert.equal(describeOutboundSkip({alertPhone: "+12025550123", smsEnabled: true}), "");
});

test("selectedClubAlertChannels follows test checkboxes and saved settings", () => {
  const {selectedClubAlertChannels} = require("./messaging-core");
  assert.deepEqual(
    selectedClubAlertChannels({inApp: true, email: false, smsEnabled: true, alertPhone: "+12025550123"}),
    {inApp: true, push: false, email: false, sms: true, whatsapp: false}
  );
  assert.deepEqual(
    selectedClubAlertChannels(
      {smsEnabled: true, whatsappEnabled: true},
      {inApp: true, push: false, email: true, sms: false, whatsapp: true}
    ),
    {inApp: true, push: false, email: true, sms: false, whatsapp: true}
  );
});

test("sanitizes Twilio secrets and explains invalid Account SID", () => {
  const {
    sanitizeTwilioSecret,
    describeTwilioAccountSid,
    explainTwilioDeliveryError,
    twilioCredentialHealth
  } = require("./messaging-core");
  assert.equal(sanitizeTwilioSecret('  "ACabc"  '), "ACabc");
  assert.equal(describeTwilioAccountSid('"ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"').looksLikeAccountSid, true);
  assert.equal(describeTwilioAccountSid("ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").looksLikeAccountSid, true);
  assert.equal(describeTwilioAccountSid("SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").looksLikeApiKey, true);
  assert.match(
    explainTwilioDeliveryError("Authentication Error - invalid username", describeTwilioAccountSid("SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")),
    /API Key/
  );
  assert.match(
    explainTwilioDeliveryError("Authentication Error - invalid username", describeTwilioAccountSid("ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")),
    /Account SID/
  );
  const health = twilioCredentialHealth({
    accountSid: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    authToken: "x".repeat(32),
    fromNumber: "+12025550123",
    whatsappFrom: "whatsapp:+12025550123"
  });
  assert.equal(health.looksLikeApiKey, true);
  assert.equal(health.accountSidPrefix, "SK");
  assert.equal(health.fromNumberSet, true);
});