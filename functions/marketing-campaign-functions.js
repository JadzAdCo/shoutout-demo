/* FLOQR marketing campaigns + messaging credit helpers (callable exports). */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {normalizeE164} = require("./messaging-core");
const {creditField: messagingCreditField, SMS_MESSAGES_PER_PACK, WHATSAPP_MESSAGES_PER_PACK, FLOQR_PROFIT_CENTS, TWILIO_BUDGET_CENTS} = require("./messaging-credits");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const CLUB_AUTH_CODE_PEPPER = defineSecret("CLUB_AUTH_CODE_PEPPER");
const MESSAGING_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM, CLUB_AUTH_CODE_PEPPER];

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bands.don@gmail.com,bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
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
    if (club.ownerUid === uid || club.adminUid === uid) return true;
    const admins = Array.isArray(club.adminUids) ? club.adminUids : [];
    if (admins.includes(uid)) return true;
  }
  const assignSnap = await db.collection("clubAdminAssignments").where("clubLocationId", "==", clubLocationId).where("uid", "==", uid).limit(1).get();
  return !assignSnap.empty;
}

function secretValue(secret, envName = "") {
  try {
    const fromSecret = secret && typeof secret.value === "function" ? secret.value() : "";
    if (fromSecret) return String(fromSecret);
  } catch (error) { /* missing in local */ }
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

async function sendTwilioMessage({channel, to, body, clubLocationId, purpose, shoutoutId}) {
  const creds = twilioCredentials();
  const destination = channel === "whatsapp"
    ? (String(to).startsWith("whatsapp:") ? to : `whatsapp:${to}`)
    : to;
  const from = channel === "whatsapp" ? creds.whatsappFrom : creds.fromNumber;
  const dryRun = !(creds.accountSid && creds.authToken && from);
  const delivery = {
    clubLocationId,
    channel,
    to: destination,
    body: text(body, 1600),
    purpose: text(purpose, 80),
    shoutoutId: text(shoutoutId, 120),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (dryRun) {
    await db.collection("clubMessageDeliveries").add({...delivery, status: "dry-run", dryRun: true});
    return {ok: true, dryRun: true, status: "dry-run"};
  }
  try {
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
    const params = new URLSearchParams({To: destination, From: from, Body: String(body || "").slice(0, 1500)});
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`, {
      method: "POST",
      headers: {Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded"},
      body: params.toString()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = text(payload.message || payload.error_message || `Twilio ${response.status}`, 500);
      await db.collection("clubMessageDeliveries").add({...delivery, status: "failed", dryRun: false, error});
      return {ok: false, dryRun: false, status: "failed", error};
    }
    await db.collection("clubMessageDeliveries").add({
      ...delivery,
      status: "sent",
      dryRun: false,
      providerSid: text(payload.sid, 80)
    });
    return {ok: true, dryRun: false, status: "sent", sid: text(payload.sid, 80)};
  } catch (error) {
    const message = text(error?.message || error, 500);
    await db.collection("clubMessageDeliveries").add({...delivery, status: "failed", dryRun: false, error: message});
    return {ok: false, dryRun: false, status: "failed", error: message};
  }
}

async function getMessagingCreditBalances(clubLocationId) {
  const snap = await db.collection("clubMessagingCredits").doc(clubLocationId).get();
  const data = snap.exists ? snap.data() || {} : {};
  return {
    smsBalance: Math.max(0, Math.floor(Number(data.smsBalance || 0))),
    whatsappBalance: Math.max(0, Math.floor(Number(data.whatsappBalance || 0))),
    smsPurchasedTotal: Math.max(0, Math.floor(Number(data.smsPurchasedTotal || 0))),
    whatsappPurchasedTotal: Math.max(0, Math.floor(Number(data.whatsappPurchasedTotal || 0))),
    smsServiceEnabled: data.smsServiceEnabled === true,
    whatsappServiceEnabled: data.whatsappServiceEnabled === true
  };
}

async function debitMessagingCredits(clubLocationId, channel, count) {
  const key = messagingCreditField(channel);
  const creditRef = db.collection("clubMessagingCredits").doc(clubLocationId);
  return db.runTransaction(async transaction => {
    const snap = await transaction.get(creditRef);
    const data = snap.exists ? snap.data() || {} : {};
    const balance = Math.max(0, Math.floor(Number(data[key] || 0)));
    const need = Math.max(1, Math.floor(Number(count || 0)));
    if (balance < need) {
      throw new HttpsError(
        "resource-exhausted",
        `${channel === "whatsapp" ? "WhatsApp" : "SMS"} credits exhausted (${balance} left, need ${need}). Buy another $10 messaging bundle.`
      );
    }
    transaction.set(creditRef, {
      [key]: balance - need,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastDebitChannel: channel,
      lastDebitCount: need
    }, {merge: true});
    return {remaining: balance - need, debited: need};
  });
}

exports.getClubMessagingCredits = onCall({
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const clubLocationId = text(request.data?.clubLocationId || request.data?.locationId, 160);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  if (!await canManageClubMessaging(clubLocationId, request.auth)) {
    throw new HttpsError("permission-denied", "Club Admin access is required.");
  }
  const balances = await getMessagingCreditBalances(clubLocationId);
  return {
    clubLocationId,
    ...balances,
    pack: {
      priceCents: 1000,
      floqrProfitCents: FLOQR_PROFIT_CENTS,
      twilioBudgetCents: TWILIO_BUDGET_CENTS,
      smsMessagesPerPack: SMS_MESSAGES_PER_PACK,
      whatsappMessagesPerPack: WHATSAPP_MESSAGES_PER_PACK
    }
  };
});

exports.saveClubMarketingCampaign = onCall({
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const clubLocationId = text(request.data?.clubLocationId, 160);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "clubLocationId is required.");
  if (!await canManageClubMessaging(clubLocationId, request.auth)) {
    throw new HttpsError("permission-denied", "Club Admin access is required to create marketing campaigns.");
  }
  const channel = text(request.data?.channel, 20) || "sms";
  if (!["sms", "whatsapp", "both"].includes(channel)) {
    throw new HttpsError("invalid-argument", "channel must be sms, whatsapp, or both.");
  }
  const estimatedRecipients = Math.max(1, Math.min(50000, Math.floor(Number(request.data?.estimatedRecipients || 1))));
  const campaignRef = request.data?.campaignId
    ? db.collection("clubMarketingCampaigns").doc(text(request.data.campaignId, 120))
    : db.collection("clubMarketingCampaigns").doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const record = {
    clubLocationId,
    ownerUid: request.auth.uid,
    status: "draft",
    channel,
    industry: text(request.data?.industry, 40),
    templateId: text(request.data?.templateId, 80),
    layoutId: text(request.data?.layoutId, 40),
    name: text(request.data?.name, 120) || "Marketing campaign",
    eyebrow: text(request.data?.eyebrow, 80),
    headline: text(request.data?.headline, 160),
    body: text(request.data?.body, 800),
    cta: text(request.data?.cta, 80),
    smsBody: text(request.data?.smsBody, 480),
    whatsappBody: text(request.data?.whatsappBody, 1000),
    backgroundImageUrl: text(request.data?.backgroundImageUrl, 500),
    imageUrls: Array.isArray(request.data?.imageUrls)
      ? request.data.imageUrls.map(url => text(url, 500)).filter(Boolean).slice(0, 6)
      : [],
    linkUrl: text(request.data?.linkUrl, 500),
    estimatedRecipients,
    updatedAt: now
  };
  const existing = await campaignRef.get();
  if (!existing.exists) record.createdAt = now;
  await campaignRef.set(record, {merge: true});
  return {campaignId: campaignRef.id, status: "draft", estimatedRecipients};
});

exports.sendClubMarketingCampaign = onCall({
  region: "us-central1",
  secrets: MESSAGING_SECRETS,
  timeoutSeconds: 120,
  memory: "512MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const clubLocationId = text(request.data?.clubLocationId, 160);
  const campaignId = text(request.data?.campaignId, 120);
  if (!clubLocationId || !campaignId) throw new HttpsError("invalid-argument", "clubLocationId and campaignId are required.");
  if (!await canManageClubMessaging(clubLocationId, request.auth)) {
    throw new HttpsError("permission-denied", "Club Admin access is required to send marketing campaigns.");
  }
  const campaignRef = db.collection("clubMarketingCampaigns").doc(campaignId);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) throw new HttpsError("not-found", "Campaign not found.");
  const campaign = campaignSnap.data() || {};
  if (campaign.clubLocationId !== clubLocationId) throw new HttpsError("permission-denied", "Campaign club mismatch.");
  if (campaign.status === "sent") throw new HttpsError("failed-precondition", "Campaign already sent.");

  const channel = text(campaign.channel, 20) || "sms";
  const recipients = Array.isArray(request.data?.recipients) ? request.data.recipients : [];
  const normalized = recipients
    .map(row => ({
      phone: normalizeE164(row?.phone || row),
      channel: text(row?.channel, 20) || (channel === "both" ? "sms" : channel)
    }))
    .filter(row => row.phone)
    .slice(0, 500);

  if (!normalized.length) {
    throw new HttpsError(
      "invalid-argument",
      "Provide recipients [{phone, channel?}]. Pass test recipients to send; opted-in patron lists expand later."
    );
  }

  const needSms = channel === "sms" || channel === "both"
    ? normalized.filter(r => channel === "sms" || r.channel === "sms").length
    : 0;
  const needWa = channel === "whatsapp" || channel === "both"
    ? normalized.filter(r => channel === "whatsapp" || r.channel === "whatsapp").length
    : 0;
  // For single-channel campaigns, every recipient uses that channel.
  const smsNeed = channel === "sms" ? normalized.length : channel === "both" ? needSms : 0;
  const waNeed = channel === "whatsapp" ? normalized.length : channel === "both" ? needWa : 0;

  const balances = await getMessagingCreditBalances(clubLocationId);
  if (smsNeed > balances.smsBalance) {
    throw new HttpsError("resource-exhausted", `Need ${smsNeed} SMS credits; balance is ${balances.smsBalance}. Buy a $10 SMS bundle.`);
  }
  if (waNeed > balances.whatsappBalance) {
    throw new HttpsError("resource-exhausted", `Need ${waNeed} WhatsApp credits; balance is ${balances.whatsappBalance}. Buy a $10 WhatsApp bundle.`);
  }

  if (smsNeed) await debitMessagingCredits(clubLocationId, "sms", smsNeed);
  if (waNeed) await debitMessagingCredits(clubLocationId, "whatsapp", waNeed);

  const smsBody = text(campaign.smsBody || campaign.body, 480) || "FloqR update. Reply STOP to opt out.";
  const waBody = text(campaign.whatsappBody || campaign.body, 1000) || smsBody;
  const results = [];
  for (const row of normalized) {
    const useChannel = channel === "both" ? (row.channel === "whatsapp" ? "whatsapp" : "sms") : channel;
    results.push(await sendTwilioMessage({
      channel: useChannel,
      to: row.phone,
      body: useChannel === "whatsapp" ? waBody : smsBody,
      clubLocationId,
      purpose: "marketing-campaign",
      shoutoutId: campaignId
    }));
  }

  const sent = results.filter(r => r.ok).length;
  await campaignRef.set({
    status: "sent",
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    sentCount: sent,
    attemptedCount: results.length,
    lastSendResults: results.slice(0, 20),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});

  return {
    campaignId,
    attempted: results.length,
    sent,
    remaining: await getMessagingCreditBalances(clubLocationId)
  };
});
