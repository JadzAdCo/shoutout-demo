/* FLOQR SMS / WhatsApp club ops messaging (Firebase Functions v2).
   Additive to paid SMS checkout in commerce-functions — does not change Stripe SMS enablement. */
"use strict";

const admin = require("firebase-admin");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");
const {
  normalizeE164,
  clubDayKey,
  generateDailyAuthCode,
  hashDailyAuthCode,
  parseOpsReply,
  buildPendingShoutoutMessage,
  twilioWhatsAppAddress,
  selectOutboundTargets
} = require("./messaging-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const CLUB_AUTH_CODE_PEPPER = defineSecret("CLUB_AUTH_CODE_PEPPER");

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bands.don@gmail.com,bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

const DEFAULT_ORIGIN = process.env.FLOQR_PUBLIC_ORIGIN || "https://jadzadco.github.io/shoutout-demo";
const MESSAGING_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM, CLUB_AUTH_CODE_PEPPER];

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function secretValue(secret, envName = "") {
  try {
    const fromSecret = secret && typeof secret.value === "function" ? secret.value() : "";
    if (fromSecret) return String(fromSecret);
  } catch (error) {
    /* Secret not bound in this runtime (local dry-run / missing config). */
  }
  return envName ? String(process.env[envName] || "") : "";
}

function twilioCredentials() {
  return {
    accountSid: secretValue(TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID"),
    authToken: secretValue(TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN"),
    fromNumber: normalizeE164(secretValue(TWILIO_FROM_NUMBER, "TWILIO_FROM_NUMBER")),
    whatsappFrom: secretValue(TWILIO_WHATSAPP_FROM, "TWILIO_WHATSAPP_FROM")
  };
}

function authCodePepper() {
  return secretValue(CLUB_AUTH_CODE_PEPPER, "CLUB_AUTH_CODE_PEPPER");
}

function twilioReady(creds = twilioCredentials()) {
  return !!(creds.accountSid && creds.authToken && (creds.fromNumber || creds.whatsappFrom));
}

function isMasterAdminAuth(authContext = {}) {
  const email = text(authContext.token?.email, 200).toLowerCase();
  return authContext.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email);
}

async function canManageClubMessaging(clubLocationId, authContext = {}) {
  const uid = authContext.uid || "";
  const email = text(authContext.token?.email, 200).toLowerCase();
  if (!uid || !clubLocationId) return false;
  if (isMasterAdminAuth(authContext)) return true;
  const clubSnap = await db.collection("clubLocations").doc(clubLocationId).get();
  if (clubSnap.exists) {
    const club = clubSnap.data() || {};
    if ([...(club.adminUids || []), ...(club.masterAdminUids || [])].includes(uid)) return true;
    if ((club.adminEmails || []).map(value => String(value).toLowerCase()).includes(email)) return true;
  }
  const assignmentId = `${clubLocationId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const [assignment, designation] = await Promise.all([
    db.collection("clubAdminAssignments").doc(assignmentId).get(),
    db.collection("clubEmployeeDesignations").doc(assignmentId).get()
  ]);
  if (assignment.exists && text(assignment.data()?.status, 40).toLowerCase() === "active") return true;
  if (designation.exists) {
    const worker = designation.data() || {};
    if (worker.status !== "rejected" && /club admin/i.test(worker.roleElectionType || "")) return true;
  }
  return false;
}

function authCodeDocId(clubLocationId, dayKey = clubDayKey()) {
  return `${clubLocationId}_${dayKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function ensureDailyAuthCode(clubLocationId, {forceNew = false} = {}) {
  const dayKey = clubDayKey();
  const ref = db.collection("clubDailyAuthCodes").doc(authCodeDocId(clubLocationId, dayKey));
  const snap = await ref.get();
  if (!forceNew && snap.exists && text(snap.data()?.code, 20)) {
    return {dayKey, code: text(snap.data().code, 20), created: false};
  }
  const code = generateDailyAuthCode(6);
  const pepper = authCodePepper();
  await ref.set({
    clubLocationId,
    dayKey,
    code,
    codeHash: hashDailyAuthCode(code, pepper),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  return {dayKey, code, created: true};
}

async function verifyDailyAuthCode(clubLocationId, code) {
  const dayKey = clubDayKey();
  const snap = await db.collection("clubDailyAuthCodes").doc(authCodeDocId(clubLocationId, dayKey)).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  const pepper = authCodePepper();
  const expected = text(data.codeHash, 128) || hashDailyAuthCode(data.code || "", pepper);
  const actual = hashDailyAuthCode(code, pepper);
  if (!expected || !actual || expected.length !== actual.length) return false;
  try {
    const crypto = require("crypto");
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(actual, "utf8"));
  } catch (error) {
    return expected === actual;
  }
}

async function logDelivery(entry = {}) {
  try {
    await db.collection("clubMessageDeliveries").add({
      clubLocationId: text(entry.clubLocationId, 160),
      channel: text(entry.channel, 40),
      to: text(entry.to, 40),
      body: text(entry.body, 1600),
      status: text(entry.status, 40) || "unknown",
      dryRun: entry.dryRun === true,
      provider: text(entry.provider, 40) || "twilio",
      providerSid: text(entry.providerSid, 80),
      error: text(entry.error, 500),
      shoutoutId: text(entry.shoutoutId, 160),
      purpose: text(entry.purpose, 80),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("clubMessageDeliveries write failed", error?.message || error);
  }
}

async function sendTwilioMessage({channel, to, body, clubLocationId, shoutoutId = "", purpose = "alert"}) {
  const creds = twilioCredentials();
  const phone = normalizeE164(to);
  if (!phone) {
    await logDelivery({clubLocationId, channel, to, body, status: "invalid-to", dryRun: true, purpose, shoutoutId});
    return {ok: false, dryRun: true, status: "invalid-to"};
  }

  const useWhatsApp = channel === "whatsapp";
  const fromRaw = useWhatsApp ? (creds.whatsappFrom || creds.fromNumber) : creds.fromNumber;
  const from = useWhatsApp
    ? (String(fromRaw || "").startsWith("whatsapp:") ? fromRaw : twilioWhatsAppAddress(fromRaw))
    : normalizeE164(fromRaw);
  const destination = useWhatsApp ? twilioWhatsAppAddress(phone) : phone;

  if (!twilioReady(creds) || !from || !destination) {
    console.info("messaging dry-run (Twilio secrets missing)", {clubLocationId, channel, purpose});
    await logDelivery({
      clubLocationId, channel, to: destination || phone, body, status: "dry-run", dryRun: true, purpose, shoutoutId
    });
    return {ok: true, dryRun: true, status: "dry-run"};
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`;
  const params = new URLSearchParams({To: destination, From: from, Body: String(body || "").slice(0, 1500)});
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = text(payload.message || `HTTP ${response.status}`, 500);
      await logDelivery({
        clubLocationId, channel, to: destination, body, status: "failed", dryRun: false, purpose, shoutoutId, error
      });
      return {ok: false, dryRun: false, status: "failed", error};
    }
    await logDelivery({
      clubLocationId,
      channel,
      to: destination,
      body,
      status: "sent",
      dryRun: false,
      purpose,
      shoutoutId,
      providerSid: text(payload.sid, 80)
    });
    return {ok: true, dryRun: false, status: "sent", sid: text(payload.sid, 80)};
  } catch (error) {
    const message = text(error?.message || error, 500);
    await logDelivery({
      clubLocationId, channel, to: destination, body, status: "failed", dryRun: false, purpose, shoutoutId, error: message
    });
    return {ok: false, dryRun: false, status: "failed", error: message};
  }
}

async function deliverToClubTargets(clubLocationId, settings, body, meta = {}) {
  const targets = selectOutboundTargets(settings || {});
  if (!targets.length) return {delivered: 0, results: [], skipped: "no-targets"};
  const results = [];
  for (const target of targets) {
    results.push(await sendTwilioMessage({
      channel: target.channel,
      to: target.to,
      body,
      clubLocationId,
      shoutoutId: meta.shoutoutId || "",
      purpose: meta.purpose || "alert"
    }));
  }
  return {delivered: results.filter(row => row.ok).length, results};
}

function previewUrlForShoutout(shoutout = {}, clubLocationId = "") {
  const location = text(shoutout.clubLocationId || clubLocationId, 160);
  const ref = text(shoutout.referenceNumber || shoutout.id, 120);
  const url = new URL(`${DEFAULT_ORIGIN.replace(/\/$/, "")}/display.html`);
  if (location) url.searchParams.set("location", location);
  if (ref) url.searchParams.set("ref", ref);
  url.searchParams.set("v", "29.09.10");
  return url.toString();
}

function parseFormBody(raw = "") {
  const params = new URLSearchParams(String(raw || ""));
  const out = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

async function findClubByAlertPhone(phone) {
  const e164 = normalizeE164(phone);
  if (!e164) return null;
  const snap = await db.collection("clubNotificationSettings").limit(400).get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const candidate = normalizeE164(data.alertPhone || data.smsPhone || data.phone || "");
    if (candidate && candidate === e164) return {id: doc.id, settings: data};
  }
  return null;
}

async function applyInboundDecision(clubLocationId, action, shoutoutHint = "") {
  const snap = await db.collection("shoutouts").where("clubLocationId", "==", clubLocationId).where("status", "==", "pending").limit(20).get();
  if (snap.empty) return {ok: false, reason: "no-pending"};
  let doc = snap.docs[0];
  const hint = text(shoutoutHint, 120).toUpperCase();
  if (hint) {
    const matched = snap.docs.find(row => {
      const data = row.data() || {};
      return text(data.referenceNumber, 120).toUpperCase() === hint || row.id.toUpperCase() === hint;
    });
    if (matched) doc = matched;
  } else {
    doc = snap.docs.slice().sort((a, b) => {
      const am = a.data()?.submittedAt?.toMillis?.() || 0;
      const bm = b.data()?.submittedAt?.toMillis?.() || 0;
      return bm - am;
    })[0];
  }
  const item = doc.data() || {};
  if (action === "reject") {
    await doc.ref.set({
      status: "rejected",
      rejectedVia: "messaging",
      rejectedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    await db.collection("shoutoutAudit").add({
      shoutoutId: doc.id,
      action: "rejected",
      clubLocationId,
      referenceNumber: text(item.referenceNumber, 120),
      actorUid: "messaging-inbound",
      actorEmail: "sms-whatsapp",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {ok: true, action: "reject", shoutoutId: doc.id};
  }

  await db.collection("liveContent").doc(clubLocationId).set({
    location: clubLocationId,
    clubLocationId,
    locationName: item.locationName || clubLocationId,
    brandName: item.brandName || item.locationName || clubLocationId,
    template: item.template || "blackwhite",
    templateName: item.templateName || "",
    mainText: text(item.mainText || "SHOUTOUT!", 200),
    subText: text(item.subText || "", 120),
    mediaUrl: item.mediaUrl || "",
    mediaType: item.mediaType || "",
    screenFormatId: item.screenFormatId || "led-96x48",
    status: "approved",
    displayDurationSeconds: 600,
    submittedBy: item.submittedBy || "unknown",
    approvedBy: "messaging-inbound",
    referenceNumber: item.referenceNumber || "",
    approvedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  await doc.ref.delete();
  await db.collection("shoutoutAudit").add({
    shoutoutId: doc.id,
    action: "approved",
    clubLocationId,
    referenceNumber: text(item.referenceNumber, 120),
    actorUid: "messaging-inbound",
    actorEmail: "sms-whatsapp",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return {ok: true, action: "approve", shoutoutId: doc.id};
}

exports.getClubDailyAuthCode = onCall({
  region: "us-central1",
  secrets: [CLUB_AUTH_CODE_PEPPER],
  timeoutSeconds: 30,
  memory: "256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const clubLocationId = text(request.data?.clubLocationId || request.data?.locationId, 160);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  if (!await canManageClubMessaging(clubLocationId, request.auth)) {
    throw new HttpsError("permission-denied", "Club Admin access is required to view today's code.");
  }
  const result = await ensureDailyAuthCode(clubLocationId);
  return {
    clubLocationId,
    dayKey: result.dayKey,
    code: result.code,
    created: result.created
  };
});

exports.sendClubTestMessage = onCall({
  region: "us-central1",
  secrets: MESSAGING_SECRETS,
  timeoutSeconds: 30,
  memory: "256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const clubLocationId = text(request.data?.clubLocationId || request.data?.locationId, 160);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  if (!await canManageClubMessaging(clubLocationId, request.auth)) {
    throw new HttpsError("permission-denied", "Club Admin access is required to send a test alert.");
  }
  const settingsSnap = await db.collection("clubNotificationSettings").doc(clubLocationId).get();
  const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
  const auth = await ensureDailyAuthCode(clubLocationId);
  const clubSnap = await db.collection("clubLocations").doc(clubLocationId).get();
  const clubName = text(clubSnap.data()?.locationName || clubSnap.data()?.brandName || clubLocationId, 80);
  const body = `FloqR test alert for ${clubName}. Today's club code is ${auth.code}. Reply APPROVE {code} or REJECT {code} on real pending ShoutOuts.`;
  const delivery = await deliverToClubTargets(clubLocationId, settings, body, {purpose: "test"});
  if (!delivery.delivered && delivery.skipped === "no-targets") {
    throw new HttpsError("failed-precondition", "Save an alert phone and enable SMS (paid) and/or WhatsApp before sending a test.");
  }
  return {
    clubLocationId,
    dayKey: auth.dayKey,
    delivered: delivery.delivered,
    dryRun: (delivery.results || []).some(row => row.dryRun),
    results: delivery.results
  };
});

exports.onShoutoutCreatedNotifyClub = onDocumentCreated({
  document: "shoutouts/{shoutoutId}",
  region: "us-central1",
  secrets: MESSAGING_SECRETS,
  timeoutSeconds: 60,
  memory: "256MiB"
}, async event => {
  const snap = event.data;
  if (!snap) return;
  const shoutout = snap.data() || {};
  const status = text(shoutout.status, 40).toLowerCase();
  if (status && status !== "pending") return;
  const clubLocationId = text(shoutout.clubLocationId || shoutout.locationId, 160);
  if (!clubLocationId) return;
  const settingsSnap = await db.collection("clubNotificationSettings").doc(clubLocationId).get();
  if (!settingsSnap.exists) return;
  const settings = settingsSnap.data() || {};
  if (!selectOutboundTargets(settings).length) return;
  await ensureDailyAuthCode(clubLocationId);
  const clubSnap = await db.collection("clubLocations").doc(clubLocationId).get();
  const clubName = text(shoutout.locationName || clubSnap.data()?.locationName || clubSnap.data()?.brandName || clubLocationId, 80);
  const body = buildPendingShoutoutMessage({
    clubName,
    mainText: shoutout.mainText || "",
    referenceNumber: shoutout.referenceNumber || "",
    shoutoutId: snap.id,
    previewUrl: previewUrlForShoutout({...shoutout, id: snap.id}, clubLocationId)
  });
  await deliverToClubTargets(clubLocationId, settings, body, {purpose: "pending-shoutout", shoutoutId: snap.id});
});

exports.rotateClubDailyAuthCodes = onSchedule({
  region: "us-central1",
  schedule: "5 0 * * *",
  timeZone: "America/New_York",
  secrets: [CLUB_AUTH_CODE_PEPPER],
  timeoutSeconds: 120,
  memory: "256MiB"
}, async () => {
  const snap = await db.collection("clubNotificationSettings").limit(500).get();
  let rotated = 0;
  for (const doc of snap.docs) {
    const settings = doc.data() || {};
    if (!selectOutboundTargets(settings).length) continue;
    await ensureDailyAuthCode(doc.id, {forceNew: true});
    rotated += 1;
  }
  console.info("rotateClubDailyAuthCodes complete", {rotated, dayKey: clubDayKey()});
});

exports.messagingInboundWebhook = onRequest({
  region: "us-central1",
  secrets: MESSAGING_SECRETS,
  timeoutSeconds: 60,
  memory: "256MiB"
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  const raw = typeof req.rawBody === "string"
    ? req.rawBody
    : Buffer.isBuffer(req.rawBody)
      ? req.rawBody.toString("utf8")
      : (typeof req.body === "string" ? req.body : new URLSearchParams(req.body || {}).toString());
  const form = Object.keys(req.body || {}).length && typeof req.body === "object" && !Buffer.isBuffer(req.body)
    ? req.body
    : parseFormBody(raw);
  const from = normalizeE164(String(form.From || "").replace(/^whatsapp:/i, ""));
  const body = String(form.Body || "");
  const parsed = parseOpsReply(body);

  await db.collection("clubMessageInbound").add({
    from,
    body: text(body, 1600),
    action: parsed.action || "",
    code: text(parsed.code, 20),
    provider: "twilio",
    messageSid: text(form.MessageSid || form.SmsSid, 80),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }).catch(error => console.error("clubMessageInbound write failed", error?.message || error));

  if (!from) {
    res.status(200).type("text/xml").send("<Response></Response>");
    return;
  }
  const club = await findClubByAlertPhone(from);
  if (!club) {
    res.status(200).type("text/xml").send("<Response></Response>");
    return;
  }
  if (!parsed.action || !parsed.code) {
    res.status(200).type("text/xml").send("<Response></Response>");
    return;
  }
  const valid = await verifyDailyAuthCode(club.id, parsed.code);
  if (!valid) {
    await deliverToClubTargets(club.id, club.settings, "FloqR: club code incorrect or expired. Check today's code in Club Admin REP.", {purpose: "inbound-invalid-code"});
    res.status(200).type("text/xml").send("<Response></Response>");
    return;
  }
  const result = await applyInboundDecision(club.id, parsed.action);
  if (result.ok) {
    await deliverToClubTargets(
      club.id,
      club.settings,
      `FloqR: ShoutOut ${result.action === "approve" ? "approved" : "rejected"} (${result.shoutoutId}).`,
      {purpose: "inbound-ack", shoutoutId: result.shoutoutId}
    );
  }
  res.status(200).type("text/xml").send("<Response></Response>");
});