/* FLOQR marketing campaigns + messaging credit helpers (callable exports). */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {
  normalizeE164,
  sanitizeTwilioSecret,
  describeTwilioAccountSid,
  explainTwilioDeliveryError,
  twilioWhatsAppAddress
} = require("./messaging-core");
const {
  creditField: messagingCreditField,
  SMS_MESSAGES_PER_PACK,
  WHATSAPP_MESSAGES_PER_PACK,
  FLOQR_PROFIT_CENTS,
  TWILIO_BUDGET_CENTS
} = require("./messaging-credits");
const {sendTwilioMessagesApi} = require("./twilio-log");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const CLUB_AUTH_CODE_PEPPER = defineSecret("CLUB_AUTH_CODE_PEPPER");
const MESSAGING_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM, CLUB_AUTH_CODE_PEPPER];

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function fillPlaceholders(template, vars = {}) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) => (
    vars[key] != null && String(vars[key]).trim() !== "" ? String(vars[key]) : ""
  )).replace(/[ \t]{2,}/g, " ").trim();
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
    if ((club.adminEmails || []).map(value => String(value).toLowerCase()).includes(email)) return true;
  }
  const assignSnap = await db.collection("clubAdminAssignments")
    .where("clubLocationId", "==", clubLocationId)
    .where("uid", "==", uid)
    .limit(1)
    .get();
  return !assignSnap.empty;
}

function secretValue(secret, envName = "") {
  try {
    const fromSecret = secret && typeof secret.value === "function" ? secret.value() : "";
    if (fromSecret) return sanitizeTwilioSecret(fromSecret);
  } catch (error) { /* missing in local */ }
  return envName ? sanitizeTwilioSecret(process.env[envName] || "") : "";
}

function twilioCredentials() {
  const whatsappFromRaw = secretValue(TWILIO_WHATSAPP_FROM, "TWILIO_WHATSAPP_FROM");
  return {
    accountSid: secretValue(TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID"),
    authToken: secretValue(TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN"),
    fromNumber: normalizeE164(secretValue(TWILIO_FROM_NUMBER, "TWILIO_FROM_NUMBER")),
    whatsappFrom: whatsappFromRaw.startsWith("whatsapp:")
      ? whatsappFromRaw
      : (twilioWhatsAppAddress(whatsappFromRaw) || whatsappFromRaw)
  };
}

async function sendTwilioMessage({
  channel,
  to,
  body,
  clubLocationId,
  purpose,
  campaignId,
  shoutoutId,
  actorUid,
  actorEmail
}) {
  const creds = twilioCredentials();
  const phone = normalizeE164(to);
  const useWhatsApp = channel === "whatsapp";
  const destination = useWhatsApp
    ? (phone ? twilioWhatsAppAddress(phone) : "")
    : phone;
  const from = useWhatsApp ? (creds.whatsappFrom || creds.fromNumber) : creds.fromNumber;

  const result = await sendTwilioMessagesApi({
    accountSid: creds.accountSid,
    authToken: creds.authToken,
    to: destination,
    from,
    body,
    channel: useWhatsApp ? "whatsapp" : "sms",
    purpose: purpose || "marketing-campaign",
    source: "sendClubMarketingCampaign",
    clubLocationId,
    campaignId: campaignId || shoutoutId || "",
    shoutoutId: shoutoutId || "",
    actorUid,
    actorEmail,
    describeInvalidSid: describeTwilioAccountSid,
    explainError: explainTwilioDeliveryError
  });

  // Keep legacy clubMessageDeliveries for Club Admin ops history.
  try {
    await db.collection("clubMessageDeliveries").add({
      clubLocationId: text(clubLocationId, 160),
      channel: useWhatsApp ? "whatsapp" : "sms",
      to: destination || text(to, 40),
      body: text(body, 1600),
      purpose: text(purpose, 80),
      shoutoutId: text(shoutoutId || campaignId, 120),
      status: text(result.status, 40),
      dryRun: result.dryRun === true,
      provider: "twilio",
      providerSid: text(result.sid, 80),
      error: text(result.error, 500),
      twilioLogId: text(result.logId, 80),
      twilioLogCollection: text(result.collection, 80),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("clubMessageDeliveries write failed", error?.message || error);
  }

  return result;
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
  const existing = await campaignRef.get();
  const prior = existing.exists ? existing.data() || {} : {};
  // Saving always returns to draft so Club Admin can edit and re-test after a prior send/test.
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
  if (!existing.exists) record.createdAt = now;
  if (prior.status === "sent" || prior.status === "tested") {
    record.priorStatus = prior.status;
  }
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

  // Club Admin "Send test" is always test mode unless broadcast:true.
  const broadcast = request.data?.broadcast === true;
  const allowRetest = request.data?.allowRetest !== false;
  if (broadcast && campaign.status === "sent") {
    throw new HttpsError("failed-precondition", "Campaign already sent. Save a new draft to broadcast again.");
  }
  if (!broadcast && campaign.status === "sent" && !allowRetest) {
    throw new HttpsError(
      "failed-precondition",
      "Campaign already sent. Save draft again (resets to draft) or send another test with allowRetest."
    );
  }

  const channel = text(campaign.channel, 20) || "sms";
  const recipients = Array.isArray(request.data?.recipients) ? request.data.recipients : [];
  const normalized = recipients
    .map(row => ({
      phone: normalizeE164(row?.phone || row),
      channel: text(row?.channel, 20) || (channel === "both" ? "sms" : channel)
    }))
    .filter(row => row.phone)
    .slice(0, broadcast ? 500 : 5);

  if (!normalized.length) {
    throw new HttpsError(
      "invalid-argument",
      "Provide recipients [{phone, channel?}]. Enter a test phone in E.164 (example +12025550123)."
    );
  }

  const smsNeed = channel === "sms" ? normalized.length : channel === "both"
    ? normalized.filter(r => r.channel === "sms").length
    : 0;
  const waNeed = channel === "whatsapp" ? normalized.length : channel === "both"
    ? normalized.filter(r => r.channel === "whatsapp").length
    : 0;

  const balances = await getMessagingCreditBalances(clubLocationId);
  if (smsNeed > balances.smsBalance) {
    throw new HttpsError("resource-exhausted", `Need ${smsNeed} SMS credits; balance is ${balances.smsBalance}. Buy a $10 SMS bundle.`);
  }
  if (waNeed > balances.whatsappBalance) {
    throw new HttpsError("resource-exhausted", `Need ${waNeed} WhatsApp credits; balance is ${balances.whatsappBalance}. Buy a $10 WhatsApp bundle.`);
  }

  const clubSnap = await db.collection("clubLocations").doc(clubLocationId).get();
  const club = clubSnap.exists ? clubSnap.data() || {} : {};
  const vars = {
    club: text(club.name || club.displayName || club.clubName || clubLocationId, 80),
    event: text(campaign.headline || campaign.name || "tonight", 120),
    cta: text(campaign.cta, 80),
    link: text(campaign.linkUrl, 500)
  };

  const composedSms = fillPlaceholders(
    text(campaign.smsBody, 480)
      || [campaign.eyebrow, campaign.headline, campaign.body, campaign.cta, campaign.linkUrl]
        .map(part => text(part, 200))
        .filter(Boolean)
        .join(" — ")
      || "FloqR update. Reply STOP to opt out.",
    vars
  );
  const smsBody = `${composedSms}${/stop/i.test(composedSms) ? "" : " Reply STOP to opt out."}`.slice(0, 480);
  const waBody = fillPlaceholders(
    text(campaign.whatsappBody || campaign.body, 1000) || smsBody,
    vars
  );

  const actorUid = text(request.auth.uid, 160);
  const actorEmail = text(request.auth.token?.email, 200).toLowerCase();
  const results = [];
  for (const row of normalized) {
    const useChannel = channel === "both" ? (row.channel === "whatsapp" ? "whatsapp" : "sms") : channel;
    results.push(await sendTwilioMessage({
      channel: useChannel,
      to: row.phone,
      body: useChannel === "whatsapp" ? waBody : smsBody,
      clubLocationId,
      purpose: broadcast ? "marketing-broadcast" : "marketing-test",
      campaignId,
      shoutoutId: campaignId,
      actorUid,
      actorEmail
    }));
  }

  const realSent = results.filter(r => r.ok && !r.dryRun);
  const dryRuns = results.filter(r => r.dryRun === true);
  const failed = results.filter(r => !r.ok && !r.dryRun);

  // Debit only for real Twilio accepts — never for dry-run / failed.
  let smsOk = 0;
  let waOk = 0;
  results.forEach((r, i) => {
    if (!(r.ok && !r.dryRun)) return;
    const useChannel = channel === "both"
      ? (normalized[i]?.channel === "whatsapp" ? "whatsapp" : "sms")
      : channel;
    if (useChannel === "whatsapp") waOk += 1;
    else smsOk += 1;
  });
  if (smsOk) await debitMessagingCredits(clubLocationId, "sms", smsOk);
  if (waOk) await debitMessagingCredits(clubLocationId, "whatsapp", waOk);

  const nextStatus = broadcast
    ? (realSent.length ? "sent" : (dryRuns.length && !failed.length ? "draft" : "draft"))
    : (realSent.length ? "tested" : "draft");

  await campaignRef.set({
    status: nextStatus,
    lastTestAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(broadcast && realSent.length ? {sentAt: admin.firestore.FieldValue.serverTimestamp()} : {}),
    sentCount: (Number(campaign.sentCount) || 0) + realSent.length,
    attemptedCount: (Number(campaign.attemptedCount) || 0) + results.length,
    lastSendResults: results.map(r => ({
      ok: !!r.ok,
      dryRun: !!r.dryRun,
      status: r.status || "",
      error: text(r.error, 200),
      sid: text(r.sid, 80),
      logId: text(r.logId, 80)
    })).slice(0, 20),
    lastSmsBody: smsBody,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});

  const remaining = await getMessagingCreditBalances(clubLocationId);
  const firstError = failed[0]?.error || dryRuns[0]?.error || "";

  if (!realSent.length && dryRuns.length) {
    return {
      campaignId,
      attempted: results.length,
      sent: 0,
      dryRun: true,
      failed: failed.length,
      status: nextStatus,
      remaining,
      message: firstError
        || "Twilio dry-run: secrets or From number missing on Functions. No SMS delivered; credits not debited.",
      results: results.slice(0, 5)
    };
  }

  if (!realSent.length && failed.length) {
    throw new HttpsError(
      "failed-precondition",
      firstError || "Twilio rejected the message. Check Master Admin → Twilio Logging."
    );
  }

  return {
    campaignId,
    attempted: results.length,
    sent: realSent.length,
    dryRun: false,
    failed: failed.length,
    status: nextStatus,
    remaining,
    message: `Delivered ${realSent.length}/${results.length} via Twilio.`,
    results: results.slice(0, 5)
  };
});
