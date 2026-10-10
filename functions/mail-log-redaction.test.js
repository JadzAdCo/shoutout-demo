"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const writes = [];
const fakeFirestore = () => ({
  collection: () => ({
    doc: (id) => ({
      set: async (payload) => { writes.push({id, payload}); }
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

const {redactSecrets, plainPreview, OTP_ALPHABET, MASK} = require("./secret-redaction");
const mailLog = require("./mail-log");

function emailOtpCode() {
  return Array.from(crypto.randomBytes(8), (byte) => OTP_ALPHABET[byte % OTP_ALPHABET.length]).join("");
}

async function storedRow(options) {
  writes.length = 0;
  await assert.rejects(() => mailLog.sendSystemMail({apiKey: "", from: "login@floqr.com", to: "a@b.co", ...options}));
  assert.ok(writes.length >= 1, "mail log row written");
  return JSON.stringify(writes.map((row) => row.payload));
}

test("8-character email OTP codes from the createOtpCode alphabet are masked", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = emailOtpCode();
    const out = redactSecrets(`Your FLOQR sign-in code is ${code}. It expires in 6 minutes.`);
    assert.ok(!out.includes(code), "code leaked");
    assert.match(out, /••••••/);
  }
  assert.equal(redactSecrets("ABCDEFGH"), MASK);
  assert.equal(redactSecrets("ZZZZ2222 rest"), `${MASK} rest`);
});

test("labelled codes are masked in any shape (code:, code is, OTP, recovery code, HTML)", () => {
  const cases = [
    ["code: QW7R", "QW7R"],
    ["Your code is ab12cd34ef", "ab12cd34ef"],
    ["OTP=99A1", "99A1"],
    ["Your SOS2FA recovery code is floqr-recovery-7Kx91-ZZ", "floqr-recovery-7Kx91-ZZ"],
    ["passcode # 4417", "4417"],
    ["<p>Your FLOQR sign-in code is <b>HJK2MN34</b>.</p>", "HJK2MN34"],
    ["code is <strong>A9B8</strong>", "A9B8"]
  ];
  cases.forEach(([input, secret]) => {
    assert.ok(!redactSecrets(input).includes(secret), `${input} leaked ${secret}`);
  });
});

test("six-digit SOS2FA / WhatsApp / SMS codes and bearer tokens stay masked", () => {
  const sos = redactSecrets("FloqR SOS2FA: Your Entity Management access code is 482913. It expires in 10 minutes.");
  assert.ok(!sos.includes("482913"));
  const wa = redactSecrets("Your FLOQR WhatsApp code: 007311");
  assert.ok(!wa.includes("007311"));
  assert.equal(redactSecrets("Authorization: Bearer sk_live_abc.def"), "Authorization: Bearer [redacted]");
});

test("ordinary prose is not over-masked", () => {
  const prose = "If you did not request this code, ignore this email. The code expires soon. Continue with WhatsApp OTP sign-in.";
  assert.equal(redactSecrets(prose), prose);
  assert.equal(redactSecrets("ShoutOut @ Zebbies at 10:30 PM"), "ShoutOut @ Zebbies at 10:30 PM");
});

test("plainPreview strips tags, collapses whitespace and masks", () => {
  const out = plainPreview("<p>Your FLOQR sign-in code is <b>HJK2MN34</b>.</p>\n\n<p>Bye</p>");
  assert.match(out, /^Your FLOQR sign-in code is •••••• ?\. Bye$/);
  assert.ok(plainPreview("x".repeat(500)).length <= 200);
});

test("OTP mail (redactBody) stores no body: template id + masked preview only", async () => {
  const code = emailOtpCode();
  const body = `Demo sign-in for temp_waitress_1@floqr-demo.com. Your FLOQR sign-in code is ${code}. It expires in 6 minutes.`;
  const json = await storedRow({
    kind: "email-otp",
    subject: `Your FLOQR sign-in code ${code}`,
    textBody: body,
    htmlBody: `<p>${body}</p>`,
    redactBody: true
  });
  assert.ok(!json.includes(code), "email OTP code stored in clear");
  const row = writes[0].payload;
  assert.equal(row.bodyStored, false);
  assert.equal(row.bodyRedacted, true);
  assert.equal(row.bodyTemplateId, "email-otp");
  assert.match(row.bodyPreview, /sign-in code is ••••••/);
  const storedBodies = [row.textBody, row.htmlBody, row.diagnostic?.textBody, row.diagnostic?.htmlBody].filter((v) => v != null);
  storedBodies.forEach((value) => assert.equal(value, ""));
});

test("SOS2FA mail stores no code even with an explicit template id", async () => {
  const json = await storedRow({
    kind: "sos2fa",
    templateId: "sos2fa-code-v1",
    subject: "Your FLOQR SOS2FA code",
    textBody: "FloqR SOS2FA: Your Entity Management access code is 731904. It expires in 10 minutes.",
    htmlBody: "<p>FloqR SOS2FA: Your Entity Management access code is 731904.</p>",
    redactBody: true
  });
  assert.ok(!json.includes("731904"));
  assert.equal(writes[0].payload.bodyTemplateId, "sos2fa-code-v1");
});

test("non-OTP mail keeps its body but still masks any code in subject/body", async () => {
  const code = emailOtpCode();
  const json = await storedRow({
    kind: "club-ops-alert",
    subject: `Ops code: ${code}`,
    textBody: `Pending ShoutOut at Zebbies. code: ${code}. Recovery code is floqr-rc-9921.`,
    htmlBody: `<p>Your FLOQR sign-in code is <b>${code}</b></p>`
  });
  assert.ok(!json.includes(code));
  assert.ok(!json.includes("floqr-rc-9921"));
  assert.match(json, /Pending ShoutOut at Zebbies/);
  assert.equal(writes[0].payload.bodyStored, true);
});
