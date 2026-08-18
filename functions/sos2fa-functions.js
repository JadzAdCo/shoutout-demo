/**
 * SOS2FA — Super Admin one-time codes for Entity Management access.
 * Delivery uses the Super Admin's FloqR notification channel flags (Email / SMS),
 * not a hardcoded SMS-only path.
 */
"use strict";

const crypto = require("crypto");
const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {normalizeE164} = require("./messaging-core");
const {sendTwilioSms} = require("./receipt-delivery");
const {resolveSos2faChannels, formatDeliveryNotes, maskEmail} = require("./sos2fa-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");
const SOS2FA_PEPPER = defineSecret("CLUB_AUTH_CODE_PEPPER");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

const SOS2FA_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, SOS2FA_PEPPER, SENDGRID_API_KEY];
const SOS2FA_FROM_EMAIL = "login@floqr.com";
const SESSION_TTL_MS = 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

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
    throw new HttpsError("permission-denied", "Entity Management requires a valid SOS2FA session. Request a new SOS2FA code.");
  }
  const snap = await db.collection("sos2faSessions").doc(sessionId).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "SOS2FA session not found. Request a new SOS2FA code.");
  }
  const row = snap.data() || {};
  if (row.uid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "SOS2FA session does not match the signed-in Super Admin.");
  }
  if ((row.expiresAtMs || 0) < Date.now()) {
    throw new HttpsError("permission-denied", "SOS2FA session expired. Request a new SOS2FA code.");
  }
  return {email, sessionId};
}

async function sendgridMailSos2fa({to, code}) {
  const key = (() => {
    try {
      const value = SENDGRID_API_KEY.value();
      if (value) return String(value);
    } catch (_) {}
    return String(process.env.SENDGRID_API_KEY || "");
  })();
  if (!key) return {ok: false, status: "missing-config"};
  const body = `FloqR SOS2FA: Your Entity Management access code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.`;
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {authorization: `Bearer ${key}`, "content-type": "application/json"},
      body: JSON.stringify({
        personalizations: [{to: [{email: to}]}],
        from: {email: SOS2FA_FROM_EMAIL, name: "FLOQR"},
        reply_to: {email: SOS2FA_FROM_EMAIL},
        subject: "Your FLOQR SOS2FA code",
        content: [
          {type: "text/plain", value: body},
          {type: "text/html", value: `<p>${body}</p>`}
        ]
      })
    });
    return {ok: response.ok || response.status === 202, status: response.status};
  } catch (err) {
    return {ok: false, status: "sendgrid-error", error: String(err?.message || err).slice(0, 200)};
  }
}

function smsSucceeded(sms) {
  return !!(sms && (sms.ok || sms.dryRun || sms.status === "missing-config"));
}

exports.requestSos2faCode = onCall({region: "us-central1", secrets: SOS2FA_SECRETS, timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const email = await assertSuperAdmin(request);
  const uid = request.auth.uid;
  const userSnap = await db.collection("users").doc(uid).get();
  const profile = userSnap.exists ? userSnap.data() || {} : {};
  const phone = resolveProfilePhone(profile);
  const channels = resolveSos2faChannels(profile, email, phone);
  if (!channels.sms && !channels.email) {
    throw new HttpsError("failed-precondition", "Add a mobile number or email to your Super Admin profile, and keep Email or SMS enabled in FloqR notification settings.");
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
  const phoneLast5 = phone ? phone.slice(-5) : "";
  const smsBody = `FloqR SOS2FA: Your Entity Management access code is ${code}. It expires in 10 minutes.`;
  const delivery = {sms: null, email: null};

  if (channels.sms) {
    try {
      delivery.sms = await sendTwilioSms({
        accountSid: twilio.accountSid,
        authToken: twilio.authToken,
        fromNumber: twilio.fromNumber,
        to: phone,
        body: smsBody
      });
    } catch (err) {
      console.error("requestSos2faCode twilio threw", {
        uid,
        phoneLast5,
        message: String(err?.message || err).slice(0, 200)
      });
      delivery.sms = {ok: false, status: "twilio-threw", error: String(err?.message || err).slice(0, 200)};
    }
  }

  if (channels.email) {
    delivery.email = await sendgridMailSos2fa({to: email, code});
  }

  const smsOk = channels.sms ? smsSucceeded(delivery.sms) : false;
  const emailOk = channels.email ? !!(delivery.email && delivery.email.ok) : false;
  if (!smsOk && !emailOk) {
    throw new HttpsError("internal", "Could not send SOS2FA code. Check FloqR Email/SMS notification settings, Twilio, and SendGrid.", {
      phoneLast5,
      smsStatus: delivery.sms?.status || "",
      emailStatus: delivery.email?.status || ""
    });
  }

  await ref.set({
    uid,
    email,
    phoneLast4: phone ? phone.slice(-4) : "",
    phoneLast5,
    codeHash: codeHash(uid, code),
    attempts: 0,
    used: false,
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + CODE_TTL_MS),
    channels: {sms: channels.sms, email: channels.email}
  });

  const notes = formatDeliveryNotes({
    phone,
    email,
    sms: smsOk,
    mail: emailOk
  });

  await writeEntityManagementAudit({
    uid,
    email,
    action: "sos2fa_code_requested",
    detail: {
      phoneLast5,
      phoneLast4: phone ? phone.slice(-4) : "",
      delivery: notes,
      sms: delivery.sms?.status || (smsOk ? "sms" : "skipped"),
      email: delivery.email?.status || (emailOk ? "email" : "skipped")
    }
  });

  return {
    ok: true,
    phoneLast4: phone ? phone.slice(-4) : "",
    phoneLast5,
    emailMasked: maskEmail(email),
    expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
    channels: {sms: smsOk, email: emailOk},
    notes,
    delivery: notes
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
  const sessionId = crypto.randomBytes(24).toString("hex");
  const sessionRef = db.collection("sos2faSessions").doc(sessionId);
  const expiresAtMs = Date.now() + SESSION_TTL_MS;

  try {
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Request a SOS2FA code first.");
      const data = snap.data() || {};
      if (data.used) throw new HttpsError("permission-denied", "This SOS2FA code was already used. Request a new SOS2FA code.");
      if ((data.expiresAt?.toMillis?.() || 0) < Date.now()) {
        throw new HttpsError("deadline-exceeded", "This SOS2FA code expired. Request a new SOS2FA code.");
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
