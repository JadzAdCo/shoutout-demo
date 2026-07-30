/**
 * SOS2FA â€” Super Admin second factor for Entity Management
 * (SMS and/or email OTP, plus optional authenticator TOTP).
 */
"use strict";

const crypto = require("crypto");
const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {normalizeE164} = require("./messaging-core");
const {sendTwilioSms} = require("./receipt-delivery");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");
const SOS2FA_PEPPER = defineSecret("CLUB_AUTH_CODE_PEPPER");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

const SOS2FA_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, SOS2FA_PEPPER, SENDGRID_API_KEY];
const SOS2FA_TOTP_SECRETS = [SOS2FA_PEPPER];
const SESSION_TTL_MS = 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_FROM = process.env.FLOQR_EMAIL_OTP_FROM || "bans.don@gmail.com";
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/* Master Admin = Super Admin */
const SUPER_ADMIN_EMAILS = String(
  process.env.FLOQR_SUPER_ADMIN_EMAILS ||
  process.env.FLOQR_MASTER_ADMIN_EMAILS ||
  "bans.don@gmail.com,don.b@jadzholdings.com"
)
  .split(",")
  .map(x => x.trim().toLowerCase())
  .filter(Boolean);

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function emailOf(authContext = {}) {
  return text(authContext.token?.email, 200).toLowerCase();
}

function pepper() {
  try {
    const fromSecret = SOS2FA_PEPPER.value();
    if (fromSecret) return String(fromSecret);
  } catch (_) {}
  return String(process.env.CLUB_AUTH_CODE_PEPPER || process.env.SOS2FA_PEPPER || "");
}

function twilioConfig() {
  const read = (secret, envName) => {
    try {
      const value = secret?.value?.();
      if (value) return String(value).trim();
    } catch (_) {}
    return String(process.env[envName] || "").trim();
  };
  return {
    accountSid: read(TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID"),
    authToken: read(TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN"),
    fromNumber: normalizeE164(read(TWILIO_FROM_NUMBER, "TWILIO_FROM_NUMBER"))
  };
}

function createSmsCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function codeHash(uid, code) {
  const secret = pepper();
  if (!secret) throw new HttpsError("failed-precondition", "SOS2FA is not configured.");
  return crypto.createHmac("sha256", secret).update(`${uid}:${String(code).trim()}`).digest("hex");
}

function isSuperAdminAuth(authContext = {}, profile = null) {
  const email = emailOf(authContext);
  if (SUPER_ADMIN_EMAILS.includes(email)) return true;
  if (authContext.token?.superAdmin === true) return true;
  if (profile?.superAdmin === true) return true;
  return false;
}

async function assertSuperAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Super Admin sign-in is required.");
  const email = emailOf(request.auth);
  if (isSuperAdminAuth(request.auth)) return email;
  const snap = await db.collection("users").doc(request.auth.uid).get();
  const profile = snap.exists ? snap.data() || {} : {};
  if (isSuperAdminAuth(request.auth, profile)) return email;
  throw new HttpsError("permission-denied", "Super Admin access is required.");
}

function resolveProfilePhone(profile = {}) {
  return normalizeE164(profile.phone || profile.smsPhone || profile.phoneNumber || profile.mobile || profile.telephone || "");
}

function maskEmail(email = "") {
  const value = text(email, 200).toLowerCase();
  const at = value.indexOf("@");
  if (at < 1) return "";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function normalizeChannel(raw) {
  const channel = text(raw, 20).toLowerCase();
  if (channel === "sms" || channel === "email" || channel === "both") return channel;
  return "both";
}

function toBase32(buf) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(value) {
  const cleaned = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let valueBits = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    valueBits = (valueBits << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((valueBits >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

function verifyTotpCode(secretBase32, token, window = 1) {
  const secret = fromBase32(secretBase32);
  if (!secret.length) return false;
  const expected = String(token || "").trim();
  if (!/^\d{6}$/.test(expected)) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i += 1) {
    if (hotp(secret, counter + i) === expected) return true;
  }
  return false;
}

function encryptTotpSecret(plain) {
  const key = crypto.createHash("sha256").update(`sos2fa-totp:${pepper()}`).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptTotpSecret(payload) {
  const raw = Buffer.from(String(payload || ""), "base64");
  if (raw.length < 29) throw new Error("invalid-totp-secret");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const key = crypto.createHash("sha256").update(`sos2fa-totp:${pepper()}`).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

async function sendSos2faEmail(toEmail, code) {
  let key = "";
  try {
    key = String(SENDGRID_API_KEY.value() || "").trim();
  } catch (_) {}
  if (!key) key = String(process.env.SENDGRID_API_KEY || "").trim();
  if (!key) {
    return {ok: false, status: "missing-config", error: "SENDGRID_API_KEY missing"};
  }
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {authorization: `Bearer ${key}`, "content-type": "application/json"},
    body: JSON.stringify({
      personalizations: [{to: [{email: toEmail}]}],
      from: {email: EMAIL_FROM, name: "FLOQR SOS2FA"},
      subject: "Your FloqR SOS2FA code",
      content: [{
        type: "text/plain",
        value: `FloqR SOS2FA: Your Entity Management access code is ${code}. It expires in 10 minutes. If you did not request this, lock Master Admin and contact security.`
      }]
    })
  });
  if (!(response.ok || response.status === 202)) {
    const errText = await response.text().catch(() => "");
    return {ok: false, status: response.status, error: errText.slice(0, 220)};
  }
  return {ok: true, status: response.status || 202};
}

async function createSos2faSession(transaction, {uid, email, method}) {
  const sessionId = crypto.randomBytes(24).toString("hex");
  const sessionRef = db.collection("sos2faSessions").doc(sessionId);
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  transaction.set(sessionRef, {
    uid,
    email,
    scope: "entityManagement",
    method: text(method, 40),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAtMs
  });
  return {sessionId, expiresAtMs};
}

async function writeEntityManagementAudit({uid = "", email = "", action = "", detail = null, sessionId = ""} = {}) {
  await db.collection("entityManagementAuditLogs").add({
    uid: text(uid, 120),
    email: text(email, 200).toLowerCase(),
    action: text(action, 120),
    detail: detail && typeof detail === "object" ? detail : {message: text(detail, 500)},
    sessionId: text(sessionId, 80),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now()
  });
}

async function assertSos2faSession(request) {
  const email = await assertSuperAdmin(request);
  const sessionId = text(request.data?.sos2faSessionId, 80);
  if (!sessionId) {
    throw new HttpsError("permission-denied", "Entity Management requires a valid SOS2FA session. Request a code or use your authenticator.");
  }
  const snap = await db.collection("sos2faSessions").doc(sessionId).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "SOS2FA session not found. Request a new code or use your authenticator.");
  }
  const row = snap.data() || {};
  if (row.uid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "SOS2FA session does not match the signed-in Super Admin.");
  }
  if ((row.expiresAtMs || 0) < Date.now()) {
    throw new HttpsError("permission-denied", "SOS2FA session expired. Request a new code or use your authenticator.");
  }
  return {email, sessionId};
}

exports.getSos2faMethods = onCall({region: "us-central1", timeoutSeconds: 15, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  const profile = userSnap.exists ? userSnap.data() || {} : {};
  const phone = resolveProfilePhone(profile);
  const totpSnap = await db.collection("sos2faTotp").doc(uid).get();
  const totp = totpSnap.exists ? totpSnap.data() || {} : {};
  return {
    ok: true,
    emailMasked: maskEmail(email),
    hasPhone: !!phone,
    phoneLast5: phone ? phone.slice(-5) : "",
    totpEnrolled: totp.enabled === true && !!totp.secretEnc,
    channels: ["both", "sms", "email"]
  };
});

exports.requestSos2faCode = onCall({region: "us-central1", secrets: SOS2FA_SECRETS, timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const channel = normalizeChannel(request.data?.channel);
  const userSnap = await db.collection("users").doc(uid).get();
  const profile = userSnap.exists ? userSnap.data() || {} : {};
  const phone = resolveProfilePhone(profile);
  const wantSms = channel === "sms" || channel === "both";
  const wantEmail = channel === "email" || channel === "both";

  if (wantSms && !phone && channel === "sms") {
    throw new HttpsError("failed-precondition", "Add a mobile number to your Super Admin profile before requesting SOS2FA via SMS.");
  }
  if (wantEmail && !email) {
    throw new HttpsError("failed-precondition", "Signed-in Super Admin email is required for email SOS2FA.");
  }

  const ref = db.collection("sos2faChallenges").doc(uid);
  const previous = await ref.get();
  const previousData = previous.exists ? previous.data() || {} : {};
  const lastRequestedMs = previousData.requestedAt?.toMillis?.() || 0;
  if (Date.now() - lastRequestedMs < RESEND_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "Wait one minute before requesting another SOS2FA code.");
  }

  const code = createSmsCode();
  const phoneLast5 = phone ? phone.slice(-5) : "";
  const emailMasked = maskEmail(email);
  const body = `FloqR SOS2FA: Your Entity Management access code is ${code}. It expires in 10 minutes.`;
  const delivery = {sms: null, email: null};
  const twilio = twilioConfig();

  if (wantSms && phone) {
    try {
      const sms = await sendTwilioSms({
        accountSid: twilio.accountSid,
        authToken: twilio.authToken,
        fromNumber: twilio.fromNumber,
        to: phone,
        body
      });
      if (!sms.ok && !(sms.dryRun || sms.status === "missing-config")) {
        let twilioHint = "";
        try {
          const parsed = JSON.parse(String(sms.error || "{}"));
          twilioHint = [parsed.code || parsed.status, String(parsed.message || "").slice(0, 160)].filter(Boolean).join(": ");
        } catch (_) {
          twilioHint = String(sms.error || sms.status || "twilio-error").slice(0, 160);
        }
        if (!twilioHint) {
          const sidLooksInvalid = !/^AC[a-zA-Z0-9]{32}$/.test(String(twilio.accountSid || ""));
          if (sidLooksInvalid) twilioHint = "TWILIO_ACCOUNT_SID appears invalid (expected AC...)";
        }
        delivery.sms = {ok: false, status: sms.status || "twilio-error", error: twilioHint || "twilio-error"};
        console.error("requestSos2faCode sms-failed", {uid, phoneLast5, error: delivery.sms.error});
      } else {
        delivery.sms = {ok: true, status: sms.status || (sms.ok ? "sent" : "dry-run")};
      }
    } catch (err) {
      delivery.sms = {ok: false, status: "exception", error: String(err?.message || err).slice(0, 160)};
      console.error("requestSos2faCode sms-threw", {uid, phoneLast5, message: delivery.sms.error});
    }
  } else if (wantSms && !phone) {
    delivery.sms = {ok: false, status: "no-phone", error: "No mobile on Super Admin profile"};
  }

  if (wantEmail) {
    try {
      const mail = await sendSos2faEmail(email, code);
      delivery.email = mail;
      if (!mail.ok) console.error("requestSos2faCode email-failed", {uid, emailMasked, status: mail.status, error: mail.error});
    } catch (err) {
      delivery.email = {ok: false, status: "exception", error: String(err?.message || err).slice(0, 160)};
      console.error("requestSos2faCode email-threw", {uid, emailMasked, message: delivery.email.error});
    }
  }

  const smsOk = delivery.sms?.ok === true;
  const emailOk = delivery.email?.ok === true;
  if (!smsOk && !emailOk) {
    const hints = [];
    if (delivery.sms?.error) hints.push(`SMS: ${delivery.sms.error}`);
    if (delivery.email?.error) hints.push(`Email: ${delivery.email.error}`);
    throw new HttpsError(
      "internal",
      `Could not deliver SOS2FA code. ${hints.join(" · ") || "Check Twilio and SendGrid configuration."}`,
      {phoneLast5, emailMasked, delivery}
    );
  }

  await ref.set({
    uid,
    email,
    phoneLast4: phone ? phone.slice(-4) : "",
    phoneLast5,
    emailMasked,
    channel,
    codeHash: codeHash(uid, code),
    attempts: 0,
    used: false,
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + CODE_TTL_MS),
    delivery
  });

  await writeEntityManagementAudit({
    uid,
    email,
    action: "sos2fa_code_requested",
    detail: {phoneLast5, emailMasked, channel, delivery: {sms: delivery.sms?.status || null, email: delivery.email?.status || null}}
  });

  return {
    ok: true,
    phoneLast4: phone ? phone.slice(-4) : "",
    phoneLast5,
    emailMasked,
    channel,
    delivery: {
      sms: smsOk ? "sent" : (delivery.sms?.status || "skipped"),
      email: emailOk ? "sent" : (delivery.email?.status || "skipped"),
      smsError: delivery.sms?.ok === false ? (delivery.sms.error || delivery.sms.status) : "",
      emailError: delivery.email?.ok === false ? (delivery.email.error || String(delivery.email.status || "")) : ""
    },
    expiresInSeconds: Math.floor(CODE_TTL_MS / 1000)
  };
});

exports.verifySos2faCode = onCall({region: "us-central1", secrets: [SOS2FA_PEPPER], timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const code = String(request.data?.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    throw new HttpsError("invalid-argument", "Enter the six-digit SOS2FA code.");
  }

  const ref = db.collection("sos2faChallenges").doc(uid);
  let sessionPayload = null;

  try {
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Request a SOS2FA code first.");
      const data = snap.data() || {};
      if (data.used) throw new HttpsError("permission-denied", "This SOS2FA code was already used. Request a new code.");
      if ((data.expiresAt?.toMillis?.() || 0) < Date.now()) {
        throw new HttpsError("deadline-exceeded", "This SOS2FA code expired. Request a new code.");
      }
      if (Number(data.attempts || 0) >= MAX_ATTEMPTS) {
        throw new HttpsError("resource-exhausted", "Too many attempts. Request a new SOS2FA code.");
      }
      const expected = String(data.codeHash || "");
      const actual = codeHash(uid, code);
      if (!expected || expected.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
        transaction.update(ref, {attempts: admin.firestore.FieldValue.increment(1)});
        throw new HttpsError("permission-denied", "Wrong code entered, please enter the correct code to proceed");
      }
      transaction.update(ref, {used: true, verifiedAt: admin.firestore.FieldValue.serverTimestamp()});
      sessionPayload = await createSos2faSession(transaction, {uid, email, method: data.channel || "code"});
    });
  } catch (error) {
    if (error instanceof HttpsError && error.message === "Wrong code entered, please enter the correct code to proceed") {
      await writeEntityManagementAudit({uid, email, action: "sos2fa_verify_failed", detail: {reason: "wrong_code"}});
    }
    throw error;
  }

  await writeEntityManagementAudit({
    uid,
    email,
    action: "sos2fa_verified",
    detail: {sessionId: sessionPayload.sessionId, method: "code"},
    sessionId: sessionPayload.sessionId
  });

  return {ok: true, sessionId: sessionPayload.sessionId, expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000)};
});

exports.startSos2faTotpEnrollment = onCall({region: "us-central1", secrets: SOS2FA_TOTP_SECRETS, timeoutSeconds: 20, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const secret = toBase32(crypto.randomBytes(20));
  const issuer = encodeURIComponent("FLOQR SOS2FA");
  const label = encodeURIComponent(email || uid);
  const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  await db.collection("sos2faTotp").doc(uid).set({
    uid,
    email,
    secretEnc: encryptTotpSecret(secret),
    enabled: false,
    pending: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  await writeEntityManagementAudit({uid, email, action: "sos2fa_totp_enroll_started", detail: {}});
  return {ok: true, secret, otpauthUrl};
});

exports.confirmSos2faTotpEnrollment = onCall({region: "us-central1", secrets: SOS2FA_TOTP_SECRETS, timeoutSeconds: 20, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const code = String(request.data?.code || "").trim();
  const snap = await db.collection("sos2faTotp").doc(uid).get();
  if (!snap.exists) throw new HttpsError("not-found", "Start authenticator enrollment first.");
  const row = snap.data() || {};
  let secret = "";
  try {
    secret = decryptTotpSecret(row.secretEnc);
  } catch (_) {
    throw new HttpsError("failed-precondition", "Authenticator enrollment is corrupt. Start again.");
  }
  if (!verifyTotpCode(secret, code, 1)) {
    throw new HttpsError("permission-denied", "Wrong authenticator code. Try the current 6-digit code.");
  }
  await snap.ref.set({
    enabled: true,
    pending: false,
    enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  await writeEntityManagementAudit({uid, email, action: "sos2fa_totp_enrolled", detail: {}});
  return {ok: true, totpEnrolled: true};
});

exports.verifySos2faTotp = onCall({region: "us-central1", secrets: SOS2FA_TOTP_SECRETS, timeoutSeconds: 20, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const code = String(request.data?.code || "").trim();
  if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Enter the six-digit authenticator code.");

  const snap = await db.collection("sos2faTotp").doc(uid).get();
  const row = snap.exists ? snap.data() || {} : {};
  if (!row.enabled || !row.secretEnc) {
    throw new HttpsError("failed-precondition", "Authenticator app is not enrolled for this Super Admin.");
  }
  let secret = "";
  try {
    secret = decryptTotpSecret(row.secretEnc);
  } catch (_) {
    throw new HttpsError("failed-precondition", "Authenticator secret could not be read. Re-enroll SOS2FA authenticator.");
  }
  if (!verifyTotpCode(secret, code, 1)) {
    await writeEntityManagementAudit({uid, email, action: "sos2fa_totp_verify_failed", detail: {reason: "wrong_code"}});
    throw new HttpsError("permission-denied", "Wrong code entered, please enter the correct code to proceed");
  }

  let sessionPayload = null;
  await db.runTransaction(async transaction => {
    sessionPayload = await createSos2faSession(transaction, {uid, email, method: "totp"});
  });
  await writeEntityManagementAudit({
    uid,
    email,
    action: "sos2fa_verified",
    detail: {sessionId: sessionPayload.sessionId, method: "totp"},
    sessionId: sessionPayload.sessionId
  });
  return {ok: true, sessionId: sessionPayload.sessionId, expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000)};
});

exports.disableSos2faTotp = onCall({region: "us-central1", secrets: SOS2FA_TOTP_SECRETS, timeoutSeconds: 15, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  await db.collection("sos2faTotp").doc(uid).set({
    enabled: false,
    pending: false,
    secretEnc: admin.firestore.FieldValue.delete(),
    disabledAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  await writeEntityManagementAudit({uid, email, action: "sos2fa_totp_disabled", detail: {}});
  return {ok: true, totpEnrolled: false};
});

exports.logEntityManagementActivity = onCall({region: "us-central1", timeoutSeconds: 15, memory: "256MiB"}, async request => {
  const {email, sessionId} = await assertSos2faSession(request);
  const action = text(request.data?.action, 120);
  if (!action) throw new HttpsError("invalid-argument", "action is required.");
  await writeEntityManagementAudit({
    uid: request.auth.uid,
    email,
    action,
    detail: request.data?.detail || null,
    sessionId
  });
  return {ok: true};
});
const STAFF_ROLE_CANONICAL = {
  "club admin": "Club Admin",
  "promoter": "Promoter",
  "dj": "DJ",
  "bottle girl": "Bottle Girl",
  "bus boy": "Bus Boy",
  "security": "Security",
  "waiter / waitress": "Waiter / Waitress",
  "bartender / barman": "Bartender / Barman",
  "hospitality": "Hospitality",
  "videographer / camera operator": "Videographer / Camera Operator"
};

const STAFF_ROLE_SLUGS = {
  "Club Admin": "clubAdmin",
  "Promoter": "promoter",
  "DJ": "dj",
  "Bottle Girl": "hospitality",
  "Bus Boy": "hospitality",
  "Security": "security",
  "Waiter / Waitress": "hospitality",
  "Bartender / Barman": "bartender",
  "Hospitality": "hospitality",
  "Videographer / Camera Operator": "mediaCreator"
};

function normalizeStaffRole(raw = "") {
  const label = text(raw, 80);
  if (!label) return "";
  return STAFF_ROLE_CANONICAL[label.toLowerCase()] || label;
}

function staffRoleSlug(roleLabel = "") {
  return STAFF_ROLE_SLUGS[roleLabel] || "staff";
}

async function resolvePatronByEmailOrUid({patronUid = "", patronEmail = ""} = {}) {
  const uid = text(patronUid, 128);
  const email = text(patronEmail, 200).toLowerCase();
  if (uid) {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) throw new HttpsError("not-found", "Patron uid was not found. The person must register as a FLOQR patron first.");
    return {uid, profile: snap.data() || {}};
  }
  if (!email) throw new HttpsError("invalid-argument", "patronEmail or patronUid is required.");
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) throw new HttpsError("not-found", "No patron profile matches that email. They must register as a FLOQR patron first.");
  const doc = snap.docs[0];
  return {uid: doc.id, profile: doc.data() || {}};
}

exports.assignVenueEmployee = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const actorEmail = await assertSuperAdmin(request);
  const clubLocationId = text(request.data?.clubLocationId || request.data?.clubId, 120);
  const role = normalizeStaffRole(request.data?.role);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  if (!role) throw new HttpsError("invalid-argument", "role is required.");

  const clubSnap = await db.collection("clubLocations").doc(clubLocationId).get();
  if (!clubSnap.exists) throw new HttpsError("not-found", "Venue / business was not found.");
  const club = clubSnap.data() || {};

  const {uid: patronUid, profile: patron} = await resolvePatronByEmailOrUid({
    patronUid: request.data?.patronUid,
    patronEmail: request.data?.patronEmail
  });
  if (patron.profileCompleted !== true) {
    throw new HttpsError("failed-precondition", "The selected patron must complete patron registration first.");
  }

  const email = text(patron.email || request.data?.patronEmail, 200).toLowerCase();
  const assignmentId = `${clubLocationId}_${patronUid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const slug = staffRoleSlug(role);
  const batch = db.batch();

  batch.set(db.collection("clubEmployeeDesignations").doc(assignmentId), {
    clubLocationId,
    clubLocationName: club.locationName || club.name || clubLocationId,
    workerUid: patronUid,
    workerEmail: email,
    workerName: patron.displayName || patron.fullName || email || "Staff",
    workerUsername: patron.username || patron.floqrHandle || "",
    workerRoles: admin.firestore.FieldValue.arrayUnion(role),
    roleElectionType: role,
    status: "active",
    assignedByUid: request.auth.uid,
    assignedByEmail: actorEmail,
    assignedWithoutSelfElection: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});

  const userUpdate = {
    approvedRoles: admin.firestore.FieldValue.arrayUnion(role),
    roles: admin.firestore.FieldValue.arrayUnion(slug),
    approvedLocations: admin.firestore.FieldValue.arrayUnion(clubLocationId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (role === "Club Admin") {
    batch.set(db.collection("clubAdminAssignments").doc(assignmentId), {
      clubId: clubLocationId,
      patronUid,
      patronEmail: email,
      status: "active",
      assignedByUid: request.auth.uid,
      assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      assignedWithoutSelfElection: true
    }, {merge: true});
    batch.set(db.collection("clubLocations").doc(clubLocationId), {
      adminUids: admin.firestore.FieldValue.arrayUnion(patronUid),
      adminEmails: admin.firestore.FieldValue.arrayUnion(email),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    userUpdate.roles = admin.firestore.FieldValue.arrayUnion("clubAdmin");
    userUpdate.clubAdminLocationIds = admin.firestore.FieldValue.arrayUnion(clubLocationId);
  }

  batch.set(db.collection("users").doc(patronUid), userUpdate, {merge: true});
  await batch.commit();

  await writeEntityManagementAudit({
    uid: request.auth.uid,
    email: actorEmail,
    action: "assign_venue_employee",
    detail: {clubLocationId, patronUid, patronEmail: email, role, withoutSelfElection: true}
  });

  return {ok: true, assignmentId, clubLocationId, patronUid, patronEmail: email, role, status: "active"};
});

exports.removeVenueEmployee = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const actorEmail = await assertSuperAdmin(request);
  const clubLocationId = text(request.data?.clubLocationId || request.data?.clubId, 120);
  const patronUid = text(request.data?.patronUid, 128);
  const role = normalizeStaffRole(request.data?.role);
  if (!clubLocationId || !patronUid) {
    throw new HttpsError("invalid-argument", "clubLocationId and patronUid are required.");
  }
  const assignmentId = `${clubLocationId}_${patronUid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ref = db.collection("clubEmployeeDesignations").doc(assignmentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "No staff assignment found for that patron at this venue.");
  const row = snap.data() || {};
  const batch = db.batch();

  if (role && Array.isArray(row.workerRoles) && row.workerRoles.length > 1) {
    batch.set(ref, {
      workerRoles: admin.firestore.FieldValue.arrayRemove(role),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      removedRoleByUid: request.auth.uid
    }, {merge: true});
  } else {
    batch.delete(ref);
  }

  if (role === "Club Admin" || String(row.roleElectionType || "") === "Club Admin") {
    batch.set(db.collection("clubLocations").doc(clubLocationId), {
      adminUids: admin.firestore.FieldValue.arrayRemove(patronUid),
      adminEmails: admin.firestore.FieldValue.arrayRemove(text(row.workerEmail, 200).toLowerCase()),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    batch.delete(db.collection("clubAdminAssignments").doc(assignmentId));
    batch.set(db.collection("users").doc(patronUid), {
      clubAdminLocationIds: admin.firestore.FieldValue.arrayRemove(clubLocationId),
      roles: admin.firestore.FieldValue.arrayRemove("clubAdmin"),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  }

  if (role) {
    batch.set(db.collection("users").doc(patronUid), {
      approvedRoles: admin.firestore.FieldValue.arrayRemove(role),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  }

  await batch.commit();
  await writeEntityManagementAudit({
    uid: request.auth.uid,
    email: actorEmail,
    action: "remove_venue_employee",
    detail: {clubLocationId, patronUid, role: role || row.roleElectionType || ""}
  });
  return {ok: true, clubLocationId, patronUid};
});

exports.assertSos2faSession = assertSos2faSession;
exports.writeEntityManagementAudit = writeEntityManagementAudit;
exports.assertSuperAdmin = assertSuperAdmin;
