/* FLOQR WhatsApp OTP sign-in (Twilio Messages API → whatsapp: sender).
   Design notes: .cursor/rules/design-notes-whatsapp-otp.mdc */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {sanitizeTwilioSecret, normalizeE164, twilioWhatsAppAddress, describeTwilioAccountSid, explainTwilioDeliveryError} = require("./messaging-core");
const {sendTwilioMessagesApi, fetchTwilioMessage, writeTwilioLog, maskPhone} = require("./twilio-log");
const core = require("./whatsapp-otp-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const OTP_PEPPER = defineSecret("CLUB_AUTH_CODE_PEPPER");

const SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM, OTP_PEPPER];
const CHALLENGES = "whatsappOtpChallenges";
const IP_LIMITS = "otpRateLimits";
const SOURCE = "whatsapp-otp-functions";
const CONSENT = {type: "user-initiated", surface: "index.html#landingPage", notice: "otp.whatsappNote"};
const STATUS_POLL_DELAYS_MS = [1200, 1800, 2500];

function secretValue(secret, envName) {
  try {
    const value = secret.value();
    if (value) return sanitizeTwilioSecret(value);
  } catch (_) { /* secret not bound in this runtime */ }
  return sanitizeTwilioSecret(process.env[envName] || "");
}

function whatsappSender() {
  const raw = secretValue(TWILIO_WHATSAPP_FROM, "TWILIO_WHATSAPP_FROM") || normalizeE164(secretValue(TWILIO_FROM_NUMBER, "TWILIO_FROM_NUMBER"));
  if (!raw) return "";
  return raw.startsWith("whatsapp:") ? raw : twilioWhatsAppAddress(raw);
}

function pepper() {
  const value = secretValue(OTP_PEPPER, "CLUB_AUTH_CODE_PEPPER");
  if (!value) throw new HttpsError("failed-precondition", "WhatsApp sign-in is not configured yet. Use another sign-in option.");
  return value;
}

// Optional until Meta approves the Authentication template; set in functions/.env.
function contentSid() {
  return String(process.env.TWILIO_WHATSAPP_OTP_CONTENT_SID || "").trim();
}

function clientIp(request) {
  const forwarded = String(request.rawRequest?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(request.rawRequest?.ip || "");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logAuthEvent({phone, status, purpose, actorUid = "", error = "", errorCode = "", providerSid = "", extra = {}}) {
  return writeTwilioLog({
    channel: "whatsapp",
    feature: purpose === "auth-otp-verify" ? "verify" : "whatsapp",
    purpose,
    source: SOURCE,
    trigger: "callable",
    actorUid,
    to: phone ? twilioWhatsAppAddress(phone) : "",
    body: "",
    status,
    sendOk: status === "sent" || status === "delivered" || status === "read" || status === "verified",
    providerSid,
    error,
    errorCode,
    forceSecurity: true,
    extra: {consent: CONSENT, ...extra}
  });
}

async function enforceIpLimit(request) {
  const ref = db.collection(IP_LIMITS).doc(core.rateKeyFor(clientIp(request)));
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const verdict = core.evaluateRateWindow(snap.exists ? snap.data() : {}, Date.now(), {max: core.IP_WINDOW_MAX, cooldownMs: 0});
    if (!verdict.allowed) throw new HttpsError("resource-exhausted", "Too many code requests from this network. Try again later.");
    tx.set(ref, {...verdict.next, channel: "whatsapp-otp", updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  });
}

async function openChallenge(phone, code) {
  const challengeId = core.challengeIdFor(phone);
  const ref = db.collection(CHALLENGES).doc(challengeId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const verdict = core.evaluateRateWindow(snap.exists ? snap.data() : {}, Date.now());
    if (!verdict.allowed) {
      throw new HttpsError("resource-exhausted", verdict.reason === "cooldown"
        ? "Wait one minute before requesting another code."
        : "Too many codes for this number. Try again in an hour.");
    }
    tx.set(ref, {
      ...verdict.next,
      phoneMasked: maskPhone(phone),
      codeHash: core.hashCode(phone, code, pepper()),
      attempts: 0,
      used: false,
      voided: false,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + core.CODE_TTL_MS)
    }, {merge: true});
  });
  return {challengeId, ref};
}

async function awaitDeliveryStatus(creds, messageSid) {
  let last = {status: "queued", errorCode: "", error: ""};
  for (const delay of STATUS_POLL_DELAYS_MS) {
    await sleep(delay);
    const result = await fetchTwilioMessage({...creds, messageSid});
    if (!result.status) continue;
    last = result;
    if (result.status === "sent" || core.isTerminalStatus(result.status)) break;
  }
  return last;
}

exports.requestWhatsAppOtp = onCall({region: "us-central1", secrets: SECRETS}, async request => {
  const phone = core.normalizeWhatsAppPhone(request.data?.phone);
  if (!phone) throw new HttpsError("invalid-argument", "Enter your WhatsApp number with the country code.");
  await enforceIpLimit(request);

  const code = core.createNumericCode();
  const {challengeId, ref} = await openChallenge(phone, code);
  const creds = {
    accountSid: secretValue(TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID"),
    authToken: secretValue(TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN")
  };
  const params = core.buildTwilioParams({to: twilioWhatsAppAddress(phone), from: whatsappSender(), code, contentSid: contentSid()});
  const sent = await sendTwilioMessagesApi({
    ...creds,
    to: params.To,
    from: params.From,
    body: params.Body || "",
    contentSid: params.ContentSid || "",
    contentVariables: params.ContentVariables || "",
    channel: "whatsapp",
    purpose: "auth-otp",
    source: SOURCE,
    describeInvalidSid: describeTwilioAccountSid,
    explainError: explainTwilioDeliveryError,
    forceSecurity: true,
    extra: {consent: CONSENT, template: !!params.ContentSid}
  });

  if (!sent.ok) {
    await ref.set({voided: true, codeHash: admin.firestore.FieldValue.delete()}, {merge: true});
    const message = sent.dryRun
      ? "WhatsApp sign-in is not configured yet. Use another sign-in option."
      : core.explainWhatsAppError(sent.errorCode, "WhatsApp could not send the code. Try again or use another sign-in option.");
    throw new HttpsError("unavailable", message);
  }

  const delivery = await awaitDeliveryStatus(creds, sent.sid);
  await logAuthEvent({
    phone,
    status: delivery.status || "queued",
    purpose: "auth-otp-status",
    providerSid: sent.sid,
    error: delivery.error,
    errorCode: delivery.errorCode
  });
  if (core.isFailedStatus(delivery.status)) {
    await ref.set({voided: true, codeHash: admin.firestore.FieldValue.delete()}, {merge: true});
    throw new HttpsError("unavailable", core.explainWhatsAppError(delivery.errorCode));
  }
  return {
    challengeId,
    expiresInSeconds: core.CODE_TTL_MS / 1000,
    deliveryStatus: delivery.status || "queued",
    toMasked: maskPhone(phone)
  };
});

exports.verifyWhatsAppOtp = onCall({region: "us-central1", secrets: [OTP_PEPPER]}, async request => {
  const phone = core.normalizeWhatsAppPhone(request.data?.phone);
  const code = String(request.data?.code || "").trim();
  const challengeId = String(request.data?.challengeId || "");
  if (!phone || !core.isValidCode(code) || challengeId !== core.challengeIdFor(phone)) {
    throw new HttpsError("invalid-argument", "Enter the 6-digit code from WhatsApp.");
  }
  const ref = db.collection(CHALLENGES).doc(challengeId);
  const expected = core.hashCode(phone, code, pepper());
  let failure = null;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    if (!snap.exists || data.used || data.voided || !data.codeHash) {
      failure = {status: "rejected", error: new HttpsError("not-found", "This code cannot be used. Request a new code.")};
    } else if ((data.expiresAt?.toMillis?.() || 0) < Date.now()) {
      failure = {status: "expired", error: new HttpsError("deadline-exceeded", "This code expired. Request a new code.")};
    } else if (Number(data.attempts || 0) >= core.MAX_ATTEMPTS) {
      failure = {status: "locked", error: new HttpsError("resource-exhausted", "Too many attempts. Request a new code.")};
    } else if (!core.codesMatch(data.codeHash, expected)) {
      tx.update(ref, {attempts: admin.firestore.FieldValue.increment(1)});
      failure = {status: "rejected", error: new HttpsError("permission-denied", "The code is incorrect.")};
    } else {
      tx.update(ref, {used: true, codeHash: admin.firestore.FieldValue.delete(), verifiedAt: admin.firestore.FieldValue.serverTimestamp()});
    }
  });
  if (failure) {
    await logAuthEvent({phone, status: failure.status, purpose: "auth-otp-verify", error: failure.error.message});
    throw failure.error;
  }

  let user;
  try {
    user = await admin.auth().getUserByPhoneNumber(phone);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    user = await admin.auth().createUser({phoneNumber: phone});
  }
  await logAuthEvent({phone, status: "verified", purpose: "auth-otp-verify", actorUid: user.uid});
  return {customToken: await admin.auth().createCustomToken(user.uid, {whatsappOtp: true}), expiresInSeconds: 300};
});
