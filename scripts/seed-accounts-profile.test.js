"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const seed = require("./seed-accounts-profile.js");

const HEX32 = "0123456789abcdef0123456789abcdef";
const FILLER = "ABCDEFGHIJKLMNOPQRST";
// Fake keys are assembled at runtime so GitHub push protection does not see key-shaped literals.
const fakeKey = (prefix, mode, tail = "") => [prefix, mode, `${FILLER}${tail}`].join("_");
const SECRETS = {
  accountSid: `AC${HEX32}`,
  authToken: "fedcba9876543210fedcba9876543210",
  stripeKey: fakeKey("rk", "live", "uvwx1234"),
  whsec: ["whsec", `${FILLER}9876`].join("_"),
  sendgrid: ["SG", "abcdefghijklmnopqr", `${FILLER}UVWXYZ0123`].join(".")
};

function profile(accounts) {
  return {profileVersion: 1, projectId: "demo-project", accounts};
}

function fieldOf(validation, accountId, key) {
  return validation.accounts.find(a => a.id === accountId).fields.find(x => x.key === key);
}

test("formats: Twilio, WhatsApp sender, Content SID, Stripe, URLs", () => {
  const twilio = seed.CATALOG.find(a => a.id === "twilio");
  const by = key => twilio.fields.find(x => x.key === key);
  assert.equal(seed.validateField(by("accountSid"), SECRETS.accountSid).status, "ok");
  assert.equal(seed.validateField(by("accountSid"), "AC123").status, "invalid");
  assert.equal(seed.validateField(by("whatsappFrom"), "whatsapp:+12025550100").status, "ok");
  assert.equal(seed.validateField(by("whatsappFrom"), "+12025550100").status, "invalid");
  assert.equal(seed.validateField(by("whatsappFrom"), "whatsapp:+0123").status, "invalid");
  assert.equal(seed.validateField(by("whatsappOtpContentSid"), `HX${HEX32}`).status, "ok");
  assert.equal(seed.validateField(by("whatsappOtpContentSid"), `HX${HEX32.slice(1)}`).status, "invalid");
  assert.equal(seed.validateField(by("smsFrom"), "+12025550100").status, "ok");

  const stripe = seed.CATALOG.find(a => a.id === "stripe");
  const sk = stripe.fields.find(x => x.key === "secretKey");
  assert.equal(seed.validateField(sk, SECRETS.stripeKey, {stripeMode: "live"}).status, "ok");
  assert.equal(seed.validateField(sk, fakeKey("sk", "live"), {stripeMode: "live"}).status, "ok");
  assert.equal(seed.validateField(sk, fakeKey("pk", "live")).status, "invalid");
  assert.match(seed.validateField(sk, fakeKey("sk", "test"), {stripeMode: "live"}).error, /test but stripe.mode is live/);
  assert.equal(seed.validateField(stripe.fields.find(x => x.key === "webhookSecret"), SECRETS.whsec).status, "ok");

  const domain = seed.CATALOG.find(a => a.id === "domain");
  const origin = domain.fields.find(x => x.key === "canonicalOrigin");
  assert.equal(seed.validateField(origin, "https://www.floqr.app").status, "ok");
  assert.equal(seed.validateField(origin, "http://www.floqr.app").status, "invalid");
  assert.equal(seed.validateField(origin, "https://www.floqr.app/").status, "invalid");
  const turn = seed.CATALOG.find(a => a.id === "floqcastTurn").fields.find(x => x.key === "urls");
  assert.equal(seed.validateField(turn, "turns:turn.example.com:443?transport=tcp,turn:turn.example.com:3478").status, "ok");
  assert.equal(seed.validateField(turn, "https://turn.example.com").status, "invalid");
});

test("non-secret fields refuse secret-looking values", () => {
  const publishable = seed.CATALOG.find(a => a.id === "azure").fields.find(x => x.key === "resourceGroup");
  assert.match(seed.validateField(publishable, SECRETS.stripeKey).error, /looks like a secret/);
  assert.match(seed.validateField(publishable, SECRETS.sendgrid).error, /looks like a secret/);
});

test("missing required vs empty optional; unknown accounts / fields are errors", () => {
  const v = seed.validateProfile(profile({stripe: {fields: {connectClientId: {value: ""}}}, bogus: {}, twilio: {fields: {authTokn: {value: "x"}}}}));
  assert.equal(fieldOf(v, "stripe", "secretKey").status, "missing");
  assert.equal(fieldOf(v, "stripe", "connectClientId").status, "empty");
  assert.ok(v.errors.some(e => e.includes('unknown account "bogus"')));
  assert.ok(v.errors.some(e => e.includes("twilio.authTokn: unknown field")));
  assert.ok(seed.validateProfile({profileVersion: 2, accounts: {}}).errors.some(e => e.includes("profileVersion")));
});

test("mask never reveals more than the last 4 of a secret", () => {
  assert.equal(seed.mask(SECRETS.stripeKey, true), "••••1234");
  assert.equal(seed.mask("short-secret", true), "•••• (set)");
  assert.equal(seed.mask("", true), "(empty)");
  assert.equal(seed.lastFour("short-secret", true), "");
  assert.equal(seed.lastFour("https://www.floqr.app", false), "");
  assert.equal(seed.mask("https://www.floqr.app", false), "https://www.floqr.app");
});

test("dry-run plan masks every secret and lists Console-only steps", () => {
  const v = seed.validateProfile(profile({
    twilio: {fields: {accountSid: {value: SECRETS.accountSid}, authToken: {value: SECRETS.authToken}, smsFrom: {value: "+12025550100"}, whatsappFrom: {value: "whatsapp:+12025550100"}}},
    stripe: {fields: {mode: {value: "live"}, secretKey: {value: SECRETS.stripeKey}, webhookSecret: {value: SECRETS.whsec}}},
    sendgrid: {apiKey: SECRETS.sendgrid}
  }));
  assert.deepEqual(v.errors, []);
  const plan = seed.formatPlan(v, {projectId: "demo-project", apply: false});
  Object.values(SECRETS).forEach(secret => assert.ok(!plan.includes(secret), `plan leaked ${secret.slice(0, 4)}`));
  assert.ok(!plan.includes("2025550100"), "phone sender is a secret target and must be masked");
  assert.match(plan, /DRY RUN/);
  assert.match(plan, /Email\/Password → Disable/);
  assert.match(plan, /Firebase secret TWILIO_WHATSAPP_FROM \[secret\]/);
});

test("example profile matches the catalog and carries no values", () => {
  const example = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "accounts-profile.example.json"), "utf8"));
  assert.deepEqual(example, JSON.parse(JSON.stringify(seed.exampleProfile())), "run --write-example after editing the catalog");
  Object.values(example.accounts).forEach(account => {
    Object.values(account.fields).forEach(field => assert.equal(field.value, ""));
    Object.values(account.manual).forEach(step => assert.equal(step.value, false));
  });
  assert.deepEqual(seed.validateProfile(example).errors, []);
});

test("every target is a known type; secret fields never target Firestore or .env", () => {
  const names = new Set();
  seed.CATALOG.forEach(account => account.fields.forEach(field => {
    assert.ok(["firebaseSecret", "functionsEnv", "githubSecret", "firestoreDoc"].includes(field.target.type), field.key);
    assert.ok(seed.FORMATS[field.format], `${account.id}.${field.key} format`);
    if (field.secret) assert.ok(["firebaseSecret", "githubSecret"].includes(field.target.type), `${account.id}.${field.key}`);
    if (field.target.name) {
      assert.ok(!names.has(field.target.name), `duplicate ${field.target.name}`);
      names.add(field.target.name);
    }
  }));
  ["TWILIO_WHATSAPP_FROM", "TWILIO_WHATSAPP_OTP_CONTENT_SID", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SENDGRID_API_KEY"].forEach(n => assert.ok(names.has(n), n));
});

test("updateEnvText replaces / appends only listed keys", () => {
  const before = "# comment\r\nOTHER=keep me\r\nTWILIO_WHATSAPP_OTP_CONTENT_SID=HXold\r\n";
  const after = seed.updateEnvText(before, {TWILIO_WHATSAPP_OTP_CONTENT_SID: `HX${HEX32}`, FLOQR_EMAIL_OTP_FROM: "login@floqr.app"});
  assert.equal(after, `# comment\r\nOTHER=keep me\r\nTWILIO_WHATSAPP_OTP_CONTENT_SID=HX${HEX32}\r\nFLOQR_EMAIL_OTP_FROM=login@floqr.app\r\n`);
  assert.equal(seed.updateEnvText("", {A: "has space"}), 'A="has space"\n');
});

test("apply: secrets go through stdin only; Firestore gets masked status, never secret values", async () => {
  const v = seed.validateProfile(profile({
    twilio: {fields: {accountSid: {value: SECRETS.accountSid}, authToken: {value: SECRETS.authToken}, smsFrom: {value: "+12025550100"}, whatsappFrom: {value: "whatsapp:+12025550100"}, whatsappOtpContentSid: {value: `HX${HEX32}`}}, manual: {whatsappSenderRegistered: {value: true}}},
    domain: {fields: {canonicalOrigin: {value: "https://www.floqr.app"}}},
    stripe: {fields: {mode: {value: "live"}, secretKey: {value: SECRETS.stripeKey}}}
  }));
  assert.deepEqual(v.errors, []);
  const calls = [];
  const runner = (command, args, input) => {
    calls.push({command, args, input});
    return args.includes("STRIPE_SECRET_KEY") ? {status: 1, output: `Error: rejected ${SECRETS.stripeKey}`} : {status: 0, output: ""};
  };
  const writes = {};
  const firestore = {collection: () => ({doc: id => ({
    get: async () => ({exists: false, data: () => null}),
    set: async (data) => { writes[id] = data; }
  })})};
  const logs = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "accounts-profile-"));
  const envFile = path.join(tmp, ".env");
  fs.writeFileSync(envFile, "KEEP=1\n");
  const {failures} = await seed.applyProfile(v, {projectId: "demo-project", githubRepo: "o/r", envFile, runner, firestore, updatedBy: "owner@example.com", nowMs: 1, log: line => logs.push(line)});

  assert.deepEqual(failures, ["STRIPE_SECRET_KEY"]);
  calls.forEach(call => {
    assert.equal(call.command, "firebase");
    assert.ok(!call.args.some(arg => Object.values(SECRETS).includes(arg) || arg.includes("2025550100")), "secret value in argv");
  });
  assert.equal(calls.find(c => c.args.includes("TWILIO_AUTH_TOKEN")).input, SECRETS.authToken);
  const allOutput = logs.join("\n") + JSON.stringify(writes);
  Object.values(SECRETS).forEach(secret => assert.ok(!allOutput.includes(secret), `leaked ${secret.slice(0, 4)}`));
  assert.ok(!allOutput.includes("2025550100"));
  assert.match(logs.join("\n"), /\[redacted\]/);
  assert.equal(fs.readFileSync(envFile, "utf8"), `KEEP=1\nTWILIO_WHATSAPP_OTP_CONTENT_SID=HX${HEX32}\n`);

  const status = writes[seed.STATUS_DOC];
  assert.equal(status.updatedBy, "owner@example.com");
  assert.equal(status.accounts.twilio.fields.accountSid.last4, "••••cdef");
  assert.equal(status.accounts.twilio.fields.smsFrom.last4, undefined);
  assert.equal(status.accounts.twilio.configured, 0, "otpTemplateApproved still open");
  assert.equal(status.accounts.twilio.manual.whatsappSenderRegistered, 1);
  assert.equal(status.accounts.stripe.fields.secretKey, undefined, "failed write must not be marked set");
  assert.equal(status.accounts.domain.configured, 0, "manual steps not ticked");
  assert.equal(writes[seed.PUBLIC_CONFIG_DOC].domain.canonicalOrigin, "https://www.floqr.app");
  assert.equal(writes[seed.PUBLIC_CONFIG_DOC].stripe.mode, "live");
  fs.rmSync(tmp, {recursive: true, force: true});
});

test("statusDoc keeps accounts not provided in this run", () => {
  const v = seed.validateProfile(profile({sendgrid: {fields: {senderDomain: {value: "floqr.app"}}}}));
  const prev = {accounts: {twilio: {configured: 1, fields: {accountSid: {set: 1}}, manual: {}}}};
  const doc = seed.statusDoc(v, prev, {updatedBy: "x", nowMs: 2});
  assert.equal(doc.accounts.twilio.configured, 1);
  assert.equal(doc.accounts.sendgrid.fields.senderDomain.set, 1);
  assert.equal(doc.accounts.sendgrid.configured, 0);
});

test("parseArgs: dry run is the default", () => {
  assert.equal(seed.parseArgs([]).apply, false);
  assert.equal(seed.parseArgs(["--apply", "--confirm-project", "p"]).confirmProject, "p");
  assert.throws(() => seed.parseArgs(["--force"]), /unknown option/);
});
