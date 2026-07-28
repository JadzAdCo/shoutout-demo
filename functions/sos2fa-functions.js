/**
 * SOS2FA — Super Admin SMS one-time codes for Entity Management access.
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

const SOS2FA_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, SOS2FA_PEPPER];
const SESSION_TTL_MS = 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const SUPER_ADMIN_EMAILS = String(process.env.FLOQR_SUPER_ADMIN_EMAILS || "bands.don@gmail.com,bans.don@gmail.com")
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
      if (value) return String(value);
    } catch (_) {}
    return String(process.env[envName] || "");
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
    throw new HttpsError("permission-denied", "Entity Management requires a valid SOS2FA session. Request a code via SMS.");
  }
  const snap = await db.collection("sos2faSessions").doc(sessionId).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "SOS2FA session not found. Request a new code via SMS.");
  }
  const row = snap.data() || {};
  if (row.uid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "SOS2FA session does not match the signed-in Super Admin.");
  }
  if ((row.expiresAtMs || 0) < Date.now()) {
    throw new HttpsError("permission-denied", "SOS2FA session expired. Request a new code via SMS.");
  }
  return {email, sessionId};
}

exports.requestSos2faCode = onCall({region: "us-central1", secrets: SOS2FA_SECRETS, timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  const profile = userSnap.exists ? userSnap.data() || {} : {};
  const phone = resolveProfilePhone(profile);
  if (!phone) {
    throw new HttpsError("failed-precondition", "Add a mobile number to your Super Admin profile before requesting SOS2FA.");
  }

  const ref = db.collection("sos2faChallenges").doc(uid);
  const previous = await ref.get();
  const previousData = previous.exists ? previous.data() || {} : {};
  const lastRequestedMs = previousData.requestedAt?.toMillis?.() || 0;
  if (Date.now() - lastRequestedMs < RESEND_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "Wait one minute before requesting another SOS2FA code.");
  }

  const code = createSmsCode();
  const twilio = twilioConfig();
  const smsBody = `FloqR SOS2FA: Your Entity Management access code is ${code}. It expires in 10 minutes.`;
  const sms = await sendTwilioSms({
    accountSid: twilio.accountSid,
    authToken: twilio.authToken,
    fromNumber: twilio.fromNumber,
    to: phone,
    body: smsBody
  });

  if (!sms.ok) {
    const dry = sms.dryRun || sms.status === "missing-config";
    if (dry) {
      console.warn("requestSos2faCode dry-run", {uid, phoneLast4: phone.slice(-4)});
    } else {
      throw new HttpsError("internal", "Could not send SOS2FA SMS. Check Twilio configuration.");
    }
  }

  await ref.set({
    uid,
    email,
    phoneLast4: phone.slice(-4),
    codeHash: codeHash(uid, code),
    attempts: 0,
    used: false,
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + CODE_TTL_MS)
  });

  await writeEntityManagementAudit({
    uid,
    email,
    action: "sos2fa_code_requested",
    detail: {phoneLast4: phone.slice(-4), delivery: sms.ok ? "sms" : sms.status || "dry-run"}
  });

  return {
    ok: true,
    phoneLast4: phone.slice(-4),
    expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
    delivery: sms.ok ? "sms" : sms.status || "dry-run"
  };
});

exports.verifySos2faCode = onCall({region: "us-central1", secrets: [SOS2FA_PEPPER], timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const code = String(request.data?.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    throw new HttpsError("invalid-argument", "Enter the six-digit SOS2FA SMS code.");
  }

  const ref = db.collection("sos2faChallenges").doc(uid);
  const sessionId = crypto.randomBytes(24).toString("hex");
  const sessionRef = db.collection("sos2faSessions").doc(sessionId);
  const expiresAtMs = Date.now() + SESSION_TTL_MS;

  try {
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Request a SOS2FA code via SMS first.");
      const data = snap.data() || {};
      if (data.used) throw new HttpsError("permission-denied", "This SOS2FA code was already used. Request a new code via SMS.");
      if ((data.expiresAt?.toMillis?.() || 0) < Date.now()) {
        throw new HttpsError("deadline-exceeded", "This SOS2FA code expired. Request a new code via SMS.");
      }
      if (Number(data.attempts || 0) >= MAX_ATTEMPTS) {
        throw new HttpsError("resource-exhausted", "Too many attempts. Request a new SOS2FA code via SMS.");
      }
      const expected = String(data.codeHash || "");
      const actual = codeHash(uid, code);
      if (!expected || expected.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
        transaction.update(ref, {attempts: admin.firestore.FieldValue.increment(1)});
        throw new HttpsError("permission-denied", "Wrong code entered, please enter the correct code to proceed");
      }
      transaction.update(ref, {used: true, verifiedAt: admin.firestore.FieldValue.serverTimestamp()});
      transaction.set(sessionRef, {
        uid,
        email,
        scope: "entityManagement",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAtMs
      });
    });
  } catch (error) {
    if (error instanceof HttpsError && error.message === "Wrong code entered, please enter the correct code to proceed") {
      await writeEntityManagementAudit({uid, email, action: "sos2fa_verify_failed", detail: {reason: "wrong_code"}});
    }
    throw error;
  }

  await writeEntityManagementAudit({uid, email, action: "sos2fa_verified", detail: {sessionId}, sessionId});

  return {ok: true, sessionId, expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000)};
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

exports.assertSos2faSession = assertSos2faSession;
exports.writeEntityManagementAudit = writeEntityManagementAudit;
