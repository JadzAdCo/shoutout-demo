/* FLOQR in-app ads: posting, payment, approval, measurement, SMS/WhatsApp intake, invoices.
   Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc */
"use strict";

const admin = require("firebase-admin");
const crypto = require("crypto");
const Stripe = require("stripe");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");
const core = require("./ad-core");
const {normalizeE164, sanitizeTwilioSecret, twilioWhatsAppAddress, describeTwilioAccountSid, explainTwilioDeliveryError} = require("./messaging-core");
const {sendTwilioMessagesApi, maskPhone, hashPhone} = require("./twilio-log");
const {buildInvoicePdfBase64, sendgridMailWithAttachment} = require("./receipt-delivery");
const {assertSos2faSession} = require("./sos2fa-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");
const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");
const TWILIO_SECRETS = [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM];

const STRIPE_API_VERSION = "2026-06-24.dahlia";
const DEFAULT_ORIGIN = process.env.FLOQR_PUBLIC_ORIGIN || "https://jadzadco.github.io/shoutout-demo";
const RETURN_ORIGINS = [DEFAULT_ORIGIN, "https://jadzadco.github.io/shoutout-demo", "https://www.floqr.com"];
const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
const APP_V = "s3.1.0";
const DEFAULT_SETTINGS = Object.freeze({
  splashEnabled: 1,
  splashSeconds: 5,
  showDemoAds: 1,
  packagedAdsEnabled: 1,
  intakeEnabled: 1,
  maxIntakePerPhonePerDay: 5
});
const IMPRESSION_DEDUPE_MS = 30 * 60 * 1000;
const CLICK_DEDUPE_MS = 5 * 60 * 1000;
const EVENT_THROTTLE_WINDOW_MS = 10 * 60 * 1000;
const EVENT_THROTTLE_MAX = 120;
const PACKAGED_ID_RE = /^[a-z0-9][a-z0-9_-]{2,80}$/i;

const text = core.text;

/* ---------- shared helpers ---------- */

function secretValue(secret, envName) {
  try {
    const v = secret && typeof secret.value === "function" ? secret.value() : "";
    if (v) return String(v);
  } catch (_) { /* not bound in this runtime */ }
  return String(process.env[envName] || "");
}

function stripeClient() {
  const key = secretValue(STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
  if (!key) throw new HttpsError("failed-precondition", "Stripe checkout is not configured.");
  return new Stripe(key, {apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 20000});
}

function twilioCredentials() {
  const waRaw = sanitizeTwilioSecret(secretValue(TWILIO_WHATSAPP_FROM, "TWILIO_WHATSAPP_FROM"));
  return {
    accountSid: sanitizeTwilioSecret(secretValue(TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID")),
    authToken: sanitizeTwilioSecret(secretValue(TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN")),
    fromNumber: normalizeE164(sanitizeTwilioSecret(secretValue(TWILIO_FROM_NUMBER, "TWILIO_FROM_NUMBER"))),
    whatsappFrom: waRaw.startsWith("whatsapp:") ? waRaw : (twilioWhatsAppAddress(waRaw) || waRaw)
  };
}

function emailOf(auth) {
  return text(auth?.token?.email, 200).toLowerCase();
}

function isMasterAdminAuth(auth) {
  return !!auth && (auth.token?.masterAdmin === true || auth.token?.superAdmin === true || MASTER_ADMIN_EMAILS.includes(emailOf(auth)));
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  return request.auth;
}

function publicOrigin() {
  return DEFAULT_ORIGIN.replace(/\/+$/, "");
}

function safeReturnBase(request) {
  const candidate = text(request?.data?.returnBase || request?.rawRequest?.headers?.origin || "", 500);
  try {
    const url = new URL(candidate);
    const ok = RETURN_ORIGINS.some(origin => {
      const base = new URL(`${origin.replace(/\/+$/, "")}/`);
      return url.protocol === "https:" && url.origin === base.origin && (`${url.pathname}/`.startsWith(base.pathname) || url.pathname.startsWith(base.pathname));
    });
    const local = process.env.FUNCTIONS_EMULATOR === "true" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (ok || local) {
      url.search = "";
      url.hash = "";
      url.pathname = url.pathname.replace(/[^/]*$/, "");
      return url.href;
    }
  } catch (_) { /* fall through */ }
  return `${publicOrigin()}/`;
}

function sha16(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function clientIp(request) {
  const raw = request?.rawRequest || request;
  const fwd = String(raw?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(raw?.ip || "");
}

async function readSettings() {
  const snap = await db.collection("adSettings").doc("global").get();
  return {...DEFAULT_SETTINGS, ...(snap.exists ? snap.data() || {} : {})};
}

async function writeAdAudit({eventType, request = null, actorUid = "", actorEmail = "", campaignId = "", reason = "", before = null, after = null, detail = null, outcome = "success", sessionId = ""}) {
  try {
    await db.collection("adAuditLogs").add({
      eventType: text(eventType, 80),
      outcome,
      actorUid: text(actorUid || request?.auth?.uid, 128),
      actorEmail: text(actorEmail || emailOf(request?.auth), 200),
      campaignId: text(campaignId, 160),
      reason: text(reason, 500),
      before: before || null,
      after: after || null,
      detail: detail || null,
      sos2faSessionHash: sessionId ? sha16(sessionId) : "",
      sourceIpHash: request ? sha16(clientIp(request)) : "",
      createdAtMs: Date.now(),
      createdAtIso: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("adAuditLogs write failed", error?.message || error);
  }
}

async function masterAdminUids() {
  const uids = new Set();
  await Promise.all(MASTER_ADMIN_EMAILS.map(async email => {
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user?.uid) uids.add(user.uid);
    } catch (_) { /* account not created yet */ }
  }));
  return [...uids];
}

async function notifyMasterAdmins({title, body, campaignId, link}) {
  const uids = await masterAdminUids();
  await Promise.all(uids.map(uid => db.collection("inboxNotifications").add({
    recipientUid: uid,
    type: "adCampaignPending",
    title: text(title, 120),
    body: text(body, 1000),
    campaignId: text(campaignId, 160),
    link: text(link, 500),
    read: false,
    createdAt: FieldValue.serverTimestamp()
  }).catch(error => console.warn("ad admin inbox failed", error?.message || error))));
}

/* ---------- who may post ---------- */

async function managedClubsFor(uid, email) {
  const out = new Map();
  const add = (id, data = {}) => { if (id) out.set(id, {id, name: text(data.locationName || data.brandName || data.name || id, 80)}); };
  const queries = [
    db.collection("clubLocations").where("adminUids", "array-contains", uid).limit(40).get(),
    db.collection("clubLocations").where("masterAdminUids", "array-contains", uid).limit(40).get(),
    email ? db.collection("clubLocations").where("adminEmails", "array-contains", email).limit(40).get() : null,
    db.collection("clubAdminAssignments").where("patronUid", "==", uid).limit(40).get()
  ].filter(Boolean);
  const results = await Promise.allSettled(queries);
  const assignmentClubIds = [];
  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    result.value.docs.forEach(doc => {
      const data = doc.data() || {};
      if (index === queries.length - 1) {
        if (text(data.status, 20).toLowerCase() === "active") assignmentClubIds.push(text(data.clubId || data.clubLocationId, 160));
      } else {
        add(doc.id, data);
      }
    });
  });
  const missing = assignmentClubIds.filter(id => id && !out.has(id));
  const snaps = await Promise.all(missing.map(id => db.collection("clubLocations").doc(id).get()));
  snaps.forEach(snap => { if (snap.exists) add(snap.id, snap.data()); });
  return [...out.values()];
}

async function canManageClub(clubId, auth) {
  if (!clubId || !auth?.uid) return false;
  if (isMasterAdminAuth(auth)) return true;
  const clubs = await managedClubsFor(auth.uid, emailOf(auth));
  return clubs.some(c => c.id === clubId);
}

async function delegatedClubsFor(uid) {
  const snap = await db.collection("adPosterDelegations").where("uid", "==", uid).where("status", "==", "active").limit(40).get();
  return snap.docs.map(doc => ({id: text(doc.data().clubLocationId, 160), name: text(doc.data().clubName, 80)})).filter(c => c.id);
}

async function groupsFor(uid) {
  const snap = await db.collection("promotionGroups").where("memberUids", "array-contains", uid).limit(40).get();
  return snap.docs.map(doc => {
    const g = doc.data() || {};
    const member = (g.members || {})[uid] || {};
    const isOwner = g.ownerUid === uid;
    return {id: doc.id, name: text(g.name, 80), canPost: isOwner || member.canPostAds === true, via: isOwner ? "owner" : "elected", isOwner};
  });
}

async function postingContext(auth) {
  const uid = auth.uid;
  const email = emailOf(auth);
  const [profileSnap, managedClubs, delegatedClubs, groups] = await Promise.all([
    db.collection("users").doc(uid).get(),
    managedClubsFor(uid, email),
    delegatedClubsFor(uid),
    groupsFor(uid)
  ]);
  const profile = profileSnap.exists ? profileSnap.data() || {} : {};
  const identities = core.resolvePosterIdentities({
    uid,
    profile: {...profile, email},
    managedClubs,
    delegatedClubs,
    groups: groups.filter(g => g.canPost),
    isMasterAdmin: isMasterAdminAuth(auth)
  });
  return {uid, email, profile, identities, managedClubs, groups};
}

/* ---------- media verification ---------- */

async function verifyUploadedMedia(storagePath, uid) {
  const path = text(storagePath, 300);
  if (!path.startsWith(`adMedia/${uid}/`) || path.includes("..")) {
    throw new HttpsError("invalid-argument", "Upload the flyer or video from this page first.");
  }
  const file = admin.storage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "The uploaded file was not found. Upload it again.");
  const [metadata] = await file.getMetadata();
  if (Number(metadata.size || 0) > core.MAX_VIDEO_BYTES) throw new HttpsError("invalid-argument", "Videos must be under 60 MB.");
  const [buffer] = await file.download();
  const check = core.inspectAdMedia(buffer, metadata.contentType);
  if (!check.ok) {
    await file.delete().catch(() => {});
    throw new HttpsError("invalid-argument", check.error);
  }
  let token = text(metadata.metadata?.firebaseStorageDownloadTokens, 200).split(",")[0];
  if (!token) {
    token = crypto.randomUUID();
    await file.setMetadata({metadata: {firebaseStorageDownloadTokens: token}});
  }
  const bucketName = admin.storage().bucket().name;
  return {
    ...check,
    mediaUrl: `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`,
    mediaStoragePath: path
  };
}

async function saveBufferToStorage(path, buffer, contentType) {
  const token = crypto.randomUUID();
  const bucket = admin.storage().bucket();
  await bucket.file(path).save(buffer, {
    resumable: false,
    contentType,
    metadata: {metadata: {firebaseStorageDownloadTokens: token, floqrSource: "ad-intake"}}
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`;
}

/* ---------- campaign documents ---------- */

function slotsFor(placementType) {
  return placementType === "minglGist"
    ? ["mingl-gist", "mingl"]
    : ["default", "clubs", "events", "lounges", "lounge-club", "beach-clubs", "shoutout", "rydr", "mingl"];
}

function publicCampaignFields(value, media, poster) {
  const demo = value.demographics;
  const targetTags = core.demographicsToDatapoints(demo);
  return {
    title: value.title,
    body: value.body,
    advertiser: value.advertiser || poster.label,
    badge: "Sponsored",
    creativeType: media.kind === "video" ? "video" : "image",
    image: media.kind === "image" ? media.mediaUrl : "",
    videoUrl: media.kind === "video" ? media.mediaUrl : "",
    durationSeconds: media.durationSeconds || 0,
    mediaStoragePath: media.mediaStoragePath,
    sourceUrl: value.ticketUrl || value.ctaUrl || "",
    cta: value.ctaLabel || (value.ticketUrl ? "Get tickets" : "Learn more"),
    placementType: value.placementType,
    slots: slotsFor(value.placementType),
    targetMode: targetTags.length ? "targeted" : "all",
    targetTags,
    demographics: demo,
    minimumAge: demo.ageMin > 18 ? demo.ageMin : null,
    maximumAge: demo.ageMax < 99 ? demo.ageMax : null,
    genders: demo.genders,
    eventName: value.eventName,
    eventDate: value.eventDate,
    venueName: value.venueName,
    posterType: poster.posterType,
    posterId: poster.posterId,
    posterKey: poster.key,
    posterLabel: poster.label,
    clubLocationId: poster.posterType === "club" ? poster.posterId : ""
  };
}

function priceForValue(value) {
  const runDays = value.paymentMode === "subscription" ? 31 : value.runDays;
  return {runDays, amountCents: core.priceFor(value.placementType, runDays)};
}

/* ---------- Stripe checkout ---------- */

async function createAdCheckout({campaignId, campaign, ownerUid = "", ownerEmail = "", customerEmail = "", successUrl, cancelUrl, source}) {
  const orderRef = db.collection("serviceOrders").doc();
  const invoiceNumber = core.invoiceNumberFor(orderRef.id);
  const subscription = campaign.paymentMode === "subscription";
  const placementLabel = campaign.placementType === "minglGist" ? "Mingl Gist" : "Inline";
  const itemName = `FLOQR ${placementLabel} ad — ${subscription ? "monthly" : `${campaign.runDays} days`}`;
  const now = FieldValue.serverTimestamp();
  await orderRef.set({
    orderType: "adCampaign",
    ownerUid,
    ownerEmail: text(ownerEmail, 200),
    status: "checkout-created",
    paymentStatus: "unpaid",
    currency: "usd",
    amountCents: campaign.amountCents,
    unitAmountCents: campaign.amountCents,
    quantity: 1,
    itemName,
    description: "FLOQR reviews every ad before it runs. Rejected ads are refunded.",
    product: "adCampaign",
    paymentModel: "floqr-platform",
    checkoutMode: subscription ? "subscription" : "payment",
    campaignId,
    adSource: source,
    invoiceNumber,
    createdAt: now,
    updatedAt: now
  });
  const metadata = {orderId: orderRef.id, orderType: "adCampaign", ownerUid, campaignId};
  const params = {
    mode: subscription ? "subscription" : "payment",
    success_url: successUrl.replace("{ORDER_ID}", encodeURIComponent(orderRef.id)),
    cancel_url: cancelUrl.replace("{ORDER_ID}", encodeURIComponent(orderRef.id)),
    client_reference_id: orderRef.id,
    metadata,
    billing_address_collection: "auto",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: campaign.amountCents,
        ...(subscription ? {recurring: {interval: "month"}} : {}),
        product_data: {name: itemName, description: text(campaign.title, 200) || "FLOQR ad"}
      },
      quantity: 1
    }]
  };
  if (subscription) params.subscription_data = {metadata};
  else params.payment_intent_data = {metadata};
  if (customerEmail) params.customer_email = customerEmail;
  let session;
  try {
    session = await stripeClient().checkout.sessions.create(params, {idempotencyKey: `floqr-ad-checkout-${orderRef.id}`});
  } catch (error) {
    await orderRef.set({status: "checkout-failed", checkoutErrorCode: text(error?.code || error?.type || "stripe_error", 80), updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    console.error("ad checkout create failed", {campaignId, code: error?.code || error?.type});
    throw new HttpsError("internal", "Stripe could not create checkout. Please try again.");
  }
  await orderRef.set({stripeCheckoutSessionId: session.id, checkoutUrl: session.url, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
  await db.collection("spotAdCampaigns").doc(campaignId).set({serviceOrderId: orderRef.id, updatedAtMs: Date.now()}, {merge: true});
  return {orderId: orderRef.id, checkoutUrl: session.url, invoiceNumber};
}

/* ---------- fulfillment (called by commerce finalizePaidOrder + intake confirm) ---------- */

async function fulfillAdOrder(orderId, order = {}, session = {}) {
  const campaignId = text(order.campaignId || session?.metadata?.campaignId, 160);
  if (!campaignId) throw new Error("Ad fulfillment missing campaignId.");
  const ref = db.collection("spotAdCampaigns").doc(campaignId);
  const privateRef = db.collection("adCampaignPrivate").doc(campaignId);
  const invoiceNumber = text(order.invoiceNumber, 80) || core.invoiceNumberFor(orderId);
  const result = await db.runTransaction(async tx => {
    const [snap, privSnap] = await Promise.all([tx.get(ref), tx.get(privateRef)]);
    if (!snap.exists) throw new Error(`Ad campaign ${campaignId} not found for fulfillment.`);
    const campaign = snap.data() || {};
    const priv = privSnap.exists ? privSnap.data() || {} : {};
    if (campaign.paymentStatus === "paid" && campaign.serviceOrderId === orderId) return {already: true, campaign, priv};
    const status = campaign.status === "awaiting_payment" ? "pending_approval" : campaign.status;
    tx.set(ref, {
      paymentStatus: "paid",
      status,
      serviceOrderId: orderId,
      invoiceNumber,
      paidAtMs: Date.now(),
      updatedAtMs: Date.now()
    }, {merge: true});
    tx.set(privateRef, {
      stripeCheckoutSessionId: text(session?.id, 200),
      stripePaymentIntentId: text(session?.payment_intent, 200),
      stripeSubscriptionId: text(session?.subscription, 200),
      stripeCustomerId: text(session?.customer, 200),
      paidEmail: text(session?.customer_details?.email, 200)
    }, {merge: true});
    return {already: false, campaign: {...campaign, status}, priv};
  });
  if (result.already) return {campaignId, alreadyFulfilled: true};
  await writeInvoice({
    campaignId,
    campaign: result.campaign,
    priv: result.priv,
    invoiceNumber,
    amountCents: Number(order.amountCents || result.campaign.priceCents || 0),
    statusLabel: "Paid — awaiting FLOQR approval",
    paymentStatus: "paid",
    stripePaymentIntentId: text(session?.payment_intent, 200),
    billToEmail: text(session?.customer_details?.email, 200) || result.priv.contactEmail || ""
  });
  await notifyMasterAdmins({
    title: "Paid ad awaiting approval",
    body: `${result.campaign.posterLabel || "An advertiser"} paid for “${result.campaign.title || "an ad"}”. Review it in Master Admin → Ad Management.`,
    campaignId,
    link: `./master-admin.html?v=${APP_V}#adApprovalQueue`
  });
  await writeAdAudit({eventType: "ad.paid", actorUid: text(order.ownerUid, 128), campaignId, detail: {orderId, invoiceNumber}});
  return {campaignId, alreadyFulfilled: false};
}

async function writeInvoice({campaignId, campaign, priv, invoiceNumber, amountCents, statusLabel, paymentStatus, stripePaymentIntentId = "", billToEmail = ""}) {
  const ref = db.collection("adInvoices").doc(invoiceNumber);
  const existing = await ref.get();
  if (existing.exists) return invoiceNumber;
  const nowMs = Date.now();
  await ref.set({
    invoiceNumber,
    campaignId,
    ownerUid: text(campaign.publishedByUid, 128),
    posterKey: text(campaign.posterKey, 200),
    title: text(campaign.title, 80),
    placementType: text(campaign.placementType, 20),
    runDays: Number(campaign.runDays || 7),
    startDate: text(campaign.proposedStartDate, 10),
    paymentMode: text(campaign.paymentMode, 20),
    paymentStatus,
    statusLabel,
    amountCents: Math.max(0, Math.round(amountCents)),
    currency: "usd",
    billToName: text(priv.contactName || campaign.posterLabel, 120),
    billToEmail: text(billToEmail || priv.contactEmail, 200),
    billToPhoneMasked: priv.contactPhone ? maskPhone(priv.contactPhone) : "",
    deliverChannel: text(priv.contactChannel, 20),
    deliverPhone: text(priv.contactPhone, 40),
    intakeTokenHash: text(priv.intakeTokenHash, 80),
    stripePaymentIntentId: text(stripePaymentIntentId, 200),
    issuedAtMs: nowMs,
    issuedAtIso: new Date(nowMs).toISOString(),
    delivery: {status: "pending"},
    createdAt: FieldValue.serverTimestamp()
  });
  await db.collection("spotAdCampaigns").doc(campaignId).set({invoiceNumber}, {merge: true});
  return invoiceNumber;
}

async function syncAdSubscription(subscription = {}) {
  const meta = subscription.metadata || {};
  const campaignId = text(meta.campaignId, 160);
  if (!campaignId) return;
  const ref = db.collection("spotAdCampaigns").doc(campaignId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const status = text(subscription.status, 40).toLowerCase();
  const periodEndMs = Number(subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end || 0) * 1000;
  const patch = {subscriptionStatus: status, updatedAtMs: Date.now()};
  const campaign = snap.data() || {};
  if (["active", "trialing"].includes(status) && periodEndMs && campaign.status === "active" && periodEndMs > Number(campaign.endsAtMs || 0)) {
    patch.endsAtMs = periodEndMs;
  }
  await ref.set(patch, {merge: true});
}

/* ---------- portal callables ---------- */

exports.getAdPostingIdentities = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const auth = requireAuth(request);
  const ctx = await postingContext(auth);
  const invoiceSnaps = await Promise.all(ctx.identities.map(id => db.collection("adInvoiceAccounts").doc(id.key).get()));
  const settings = await readSettings();
  return {
    identities: ctx.identities.map((id, i) => ({...id, invoiceEnabled: invoiceSnaps[i].exists && invoiceSnaps[i].data()?.enabled === true})),
    managedClubs: ctx.managedClubs,
    groups: ctx.groups,
    pricing: core.PRICE_TABLE_CENTS,
    runDayOptions: core.RUN_DAY_OPTIONS,
    maxVideoSeconds: core.MAX_VIDEO_SECONDS,
    intakeEnabled: settings.intakeEnabled === 1 || settings.intakeEnabled === true
  };
});

exports.createAdCampaign = onCall({region: "us-central1", secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 120, memory: "1GiB"}, async request => {
  const auth = requireAuth(request);
  const ctx = await postingContext(auth);
  const poster = ctx.identities.find(id => id.key === core.posterKey(request.data?.posterType, request.data?.posterId));
  if (!poster) throw new HttpsError("permission-denied", "You cannot post ads for that club, group or role.");
  const check = core.validateCampaignInput(request.data?.campaign || {}, {requireMedia: false});
  if (!check.ok) throw new HttpsError("invalid-argument", check.errors.join(" "));
  const value = check.value;
  const media = await verifyUploadedMedia(request.data?.campaign?.mediaStoragePath, auth.uid);
  const {runDays, amountCents} = priceForValue(value);
  if (!amountCents) throw new HttpsError("invalid-argument", "Pick a valid placement and run length.");
  let paymentStatus = "unpaid";
  let status = "awaiting_payment";
  if (value.paymentMode === "invoice") {
    const account = await db.collection("adInvoiceAccounts").doc(poster.key).get();
    if (!account.exists || account.data()?.enabled !== true) {
      throw new HttpsError("failed-precondition", "Invoice billing is not enabled for this account. Pay by card, or ask FLOQR to open an invoice account.");
    }
    paymentStatus = "invoiced";
    status = "pending_approval";
  }
  const flight = core.computeFlight(value.startDate, runDays);
  const ref = db.collection("spotAdCampaigns").doc();
  const nowMs = Date.now();
  await ref.set({
    ...publicCampaignFields(value, media, poster),
    status,
    paymentStatus,
    paymentMode: value.paymentMode,
    runDays,
    priceCents: amountCents,
    proposedStartDate: flight.startDate,
    proposedStartsAtMs: flight.startsAtMs,
    proposedEndsAtMs: flight.endsAtMs,
    publishedByUid: auth.uid,
    source: "ad-portal",
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    createdAt: FieldValue.serverTimestamp()
  });
  await db.collection("adCampaignPrivate").doc(ref.id).set({
    campaignId: ref.id,
    ownerUid: auth.uid,
    contactEmail: ctx.email,
    contactName: text(ctx.profile.displayName || ctx.profile.username || ctx.email, 120),
    createdAtMs: nowMs
  });
  await writeAdAudit({eventType: "ad.created", request, campaignId: ref.id, detail: {posterKey: poster.key, paymentMode: value.paymentMode, amountCents}});
  if (value.paymentMode === "invoice") {
    const invoiceNumber = core.invoiceNumberFor(ref.id);
    const campaign = (await ref.get()).data() || {};
    await writeInvoice({
      campaignId: ref.id, campaign, priv: {contactEmail: ctx.email, contactName: ctx.profile.displayName || ctx.email},
      invoiceNumber, amountCents, statusLabel: "Invoice due — awaiting FLOQR approval", paymentStatus: "invoiced", billToEmail: ctx.email
    });
    await notifyMasterAdmins({
      title: "Invoiced ad awaiting approval",
      body: `${poster.label} submitted “${value.title}” on invoice terms.`,
      campaignId: ref.id,
      link: `./master-admin.html?v=${APP_V}#adApprovalQueue`
    });
    return {campaignId: ref.id, status, invoiceNumber};
  }
  const base = safeReturnBase(request);
  const checkout = await createAdCheckout({
    campaignId: ref.id,
    campaign: {title: value.title, placementType: value.placementType, runDays, paymentMode: value.paymentMode, amountCents},
    ownerUid: auth.uid,
    ownerEmail: ctx.email,
    customerEmail: ctx.email,
    successUrl: `${base}payment-return.html?v=${APP_V}&order={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}&kind=ad`,
    cancelUrl: `${base}payment-return.html?v=${APP_V}&order={ORDER_ID}&cancelled=1&kind=ad`,
    source: "ad-portal"
  });
  return {campaignId: ref.id, status, ...checkout};
});

exports.startAdCampaignCheckout = onCall({region: "us-central1", secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const auth = requireAuth(request);
  const campaignId = text(request.data?.campaignId, 160);
  const snap = await db.collection("spotAdCampaigns").doc(campaignId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Ad not found.");
  const campaign = snap.data() || {};
  if (campaign.publishedByUid !== auth.uid) throw new HttpsError("permission-denied", "Not your ad.");
  if (campaign.status !== "awaiting_payment") throw new HttpsError("failed-precondition", "This ad is already paid or closed.");
  const base = safeReturnBase(request);
  return startCheckoutForExisting(campaignId, campaign, auth, base);
});

async function startCheckoutForExisting(campaignId, campaign, auth, base) {
  return createAdCheckout({
    campaignId,
    campaign: {title: campaign.title, placementType: campaign.placementType, runDays: campaign.runDays, paymentMode: campaign.paymentMode, amountCents: Number(campaign.priceCents || 0)},
    ownerUid: auth.uid,
    ownerEmail: emailOf(auth),
    customerEmail: emailOf(auth),
    successUrl: `${base}payment-return.html?v=${APP_V}&order={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}&kind=ad`,
    cancelUrl: `${base}payment-return.html?v=${APP_V}&order={ORDER_ID}&cancelled=1&kind=ad`,
    source: "ad-portal"
  });
}

exports.listMyAdCampaigns = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const auth = requireAuth(request);
  const ctx = await postingContext(auth);
  const clubKeys = ctx.identities.filter(id => id.posterType === "club" || (id.posterType === "promotionGroup")).map(id => id.key).slice(0, 30);
  const [mine, shared] = await Promise.all([
    db.collection("spotAdCampaigns").where("publishedByUid", "==", auth.uid).limit(100).get(),
    clubKeys.length ? db.collection("spotAdCampaigns").where("posterKey", "in", clubKeys).limit(100).get() : Promise.resolve({docs: []})
  ]);
  const byId = new Map();
  [...mine.docs, ...shared.docs].forEach(doc => byId.set(doc.id, {id: doc.id, ...doc.data()}));
  const rows = [...byId.values()];
  const stats = await Promise.all(rows.map(row => db.collection("adStats").doc(row.id).get()));
  return {
    campaigns: rows.map((row, i) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      paymentStatus: row.paymentStatus,
      paymentMode: row.paymentMode,
      placementType: row.placementType,
      creativeType: row.creativeType,
      image: row.image,
      videoUrl: row.videoUrl,
      posterLabel: row.posterLabel,
      posterKey: row.posterKey,
      priceCents: row.priceCents,
      runDays: row.runDays,
      startsAtMs: row.startsAtMs || row.proposedStartsAtMs || null,
      endsAtMs: row.endsAtMs || row.proposedEndsAtMs || null,
      invoiceNumber: row.invoiceNumber || "",
      rejectReason: row.rejectReason || "",
      mine: row.publishedByUid === auth.uid,
      impressions: Number(stats[i].data()?.impressions || 0),
      clicks: Number(stats[i].data()?.clicks || 0),
      createdAtMs: row.createdAtMs || 0
    })).sort((a, b) => b.createdAtMs - a.createdAtMs)
  };
});

/* ---------- club ad-poster delegation (RBAC role "Club Ad Poster") ---------- */

async function resolveUser({uid, email}) {
  const cleanUid = text(uid, 128);
  if (cleanUid) {
    const snap = await db.collection("users").doc(cleanUid).get();
    if (snap.exists) return {uid: cleanUid, email: text(snap.data()?.email, 200).toLowerCase(), name: text(snap.data()?.displayName || snap.data()?.username, 80)};
  }
  const cleanEmail = text(email, 200).toLowerCase();
  if (cleanEmail) {
    try {
      const user = await admin.auth().getUserByEmail(cleanEmail);
      return {uid: user.uid, email: cleanEmail, name: text(user.displayName, 80)};
    } catch (_) { /* fall through */ }
  }
  throw new HttpsError("not-found", "No FLOQR account matches that person. They must sign in to FLOQR once first.");
}

exports.setClubAdPoster = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const auth = requireAuth(request);
  const clubId = text(request.data?.clubLocationId, 160);
  if (!await canManageClub(clubId, auth)) throw new HttpsError("permission-denied", "Only this club's admins can choose who posts ads for it.");
  const person = await resolveUser({uid: request.data?.uid, email: request.data?.email});
  const enabled = request.data?.enabled !== false;
  const clubSnap = await db.collection("clubLocations").doc(clubId).get();
  const clubName = text(clubSnap.data()?.locationName || clubSnap.data()?.brandName || clubId, 80);
  const id = `${clubId}_${person.uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  await db.collection("adPosterDelegations").doc(id).set({
    clubLocationId: clubId,
    clubName,
    uid: person.uid,
    email: person.email,
    name: person.name,
    status: enabled ? "active" : "revoked",
    role: "Club Ad Poster",
    updatedByUid: auth.uid,
    updatedByEmail: emailOf(auth),
    updatedAtMs: Date.now()
  }, {merge: true});
  await db.collection("users").doc(person.uid).set({
    approvedRoles: enabled ? FieldValue.arrayUnion("Club Ad Poster") : FieldValue.arrayRemove("Club Ad Poster"),
    adPosterClubIds: enabled ? FieldValue.arrayUnion(clubId) : FieldValue.arrayRemove(clubId)
  }, {merge: true});
  await writeAdAudit({eventType: enabled ? "ad.poster_granted" : "ad.poster_revoked", request, detail: {clubId, uid: person.uid}});
  return {ok: true, uid: person.uid, status: enabled ? "active" : "revoked"};
});

exports.listClubAdPosters = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const auth = requireAuth(request);
  const clubId = text(request.data?.clubLocationId, 160);
  if (!await canManageClub(clubId, auth)) throw new HttpsError("permission-denied", "Club admins only.");
  const snap = await db.collection("adPosterDelegations").where("clubLocationId", "==", clubId).limit(100).get();
  return {posters: snap.docs.map(doc => ({id: doc.id, uid: doc.data().uid, email: doc.data().email, name: doc.data().name, status: doc.data().status}))};
});

/* ---------- promotion groups ---------- */

exports.upsertPromotionGroup = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const auth = requireAuth(request);
  const name = text(request.data?.name, 80);
  if (name.length < 2) throw new HttpsError("invalid-argument", "Give the promotion group a name.");
  const groupId = text(request.data?.groupId, 160);
  if (groupId) {
    const ref = db.collection("promotionGroups").doc(groupId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Group not found.");
    if (snap.data()?.ownerUid !== auth.uid && !isMasterAdminAuth(auth)) throw new HttpsError("permission-denied", "Only the group owner can edit it.");
    await ref.set({name, city: text(request.data?.city, 80), updatedAtMs: Date.now()}, {merge: true});
    return {groupId};
  }
  const ctx = await postingContext(auth);
  if (!ctx.identities.some(id => id.posterType === "promoter") && !isMasterAdminAuth(auth)) {
    throw new HttpsError("permission-denied", "Only approved promoters can create a promotion group.");
  }
  const ref = db.collection("promotionGroups").doc();
  await ref.set({
    name,
    city: text(request.data?.city, 80),
    ownerUid: auth.uid,
    ownerEmail: emailOf(auth),
    memberUids: [auth.uid],
    members: {[auth.uid]: {email: emailOf(auth), canPostAds: true, role: "owner", addedAtMs: Date.now()}},
    createdAtMs: Date.now(),
    updatedAtMs: Date.now()
  });
  await writeAdAudit({eventType: "group.created", request, detail: {groupId: ref.id, name}});
  return {groupId: ref.id};
});

exports.setPromotionGroupMember = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const auth = requireAuth(request);
  const groupId = text(request.data?.groupId, 160);
  const ref = db.collection("promotionGroups").doc(groupId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Group not found.");
  const group = snap.data() || {};
  if (group.ownerUid !== auth.uid && !isMasterAdminAuth(auth)) throw new HttpsError("permission-denied", "Only the group owner can manage members.");
  const person = await resolveUser({uid: request.data?.uid, email: request.data?.email});
  if (person.uid === group.ownerUid) throw new HttpsError("failed-precondition", "The owner always posts for the group.");
  if (request.data?.remove === true) {
    await ref.update({memberUids: FieldValue.arrayRemove(person.uid), [`members.${person.uid}`]: FieldValue.delete(), updatedAtMs: Date.now()});
  } else {
    await ref.update({
      memberUids: FieldValue.arrayUnion(person.uid),
      [`members.${person.uid}`]: {email: person.email, name: person.name, canPostAds: request.data?.canPostAds === true, role: "promoter", addedAtMs: Date.now()},
      updatedAtMs: Date.now()
    });
  }
  await writeAdAudit({eventType: "group.member_changed", request, detail: {groupId, uid: person.uid, canPostAds: request.data?.canPostAds === true, removed: request.data?.remove === true}});
  return {ok: true};
});

exports.listMyPromotionGroups = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const auth = requireAuth(request);
  const snap = await db.collection("promotionGroups").where("memberUids", "array-contains", auth.uid).limit(40).get();
  return {
    groups: snap.docs.map(doc => {
      const g = doc.data() || {};
      const isOwner = g.ownerUid === auth.uid;
      return {
        id: doc.id,
        name: g.name,
        city: g.city || "",
        isOwner,
        canPostAds: isOwner || g.members?.[auth.uid]?.canPostAds === true,
        members: isOwner ? Object.entries(g.members || {}).map(([uid, m]) => ({uid, email: m.email, name: m.name || "", canPostAds: m.canPostAds === true, role: m.role})) : []
      };
    })
  };
});

/* ---------- Master Admin (SOS2FA) ---------- */

async function loadCampaignForAdmin(campaignId) {
  const id = text(campaignId, 160);
  if (!id) throw new HttpsError("invalid-argument", "campaignId is required.");
  const ref = db.collection("spotAdCampaigns").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ad not found.");
  return {id, ref, campaign: snap.data() || {}};
}

function requireReason(request, min = 8) {
  const reason = text(request.data?.reason, 500);
  if (reason.length < min) throw new HttpsError("invalid-argument", `Give a reason (at least ${min} characters).`);
  return reason;
}

exports.approveAdCampaign = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const {email, sessionId} = await assertSos2faSession(request);
  const {id, ref, campaign} = await loadCampaignForAdmin(request.data?.campaignId);
  const waive = request.data?.waivePayment === true;
  const verdict = core.canApprove(campaign, {waive});
  if (!verdict.ok) throw new HttpsError("failed-precondition", verdict.reason);
  const reason = waive ? requireReason(request) : text(request.data?.reason, 500);
  const startDate = text(request.data?.startDate, 10) || campaign.proposedStartDate;
  const flight = core.computeFlight(startDate, campaign.runDays || 7);
  const endDate = text(request.data?.endDate, 10);
  const endsAtMs = /^\d{4}-\d{2}-\d{2}$/.test(endDate) && Date.parse(`${endDate}T23:59:59Z`) > flight.startsAtMs
    ? Date.parse(`${endDate}T23:59:59Z`)
    : flight.endsAtMs;
  const patch = {
    status: "active",
    startsAtMs: flight.startsAtMs,
    endsAtMs,
    approvedAtMs: Date.now(),
    approvedByEmail: email,
    updatedAtMs: Date.now(),
    ...(verdict.waived ? {paymentStatus: "waived", waiveReason: reason} : {})
  };
  await ref.set(patch, {merge: true});
  await writeAdAudit({eventType: "ad.approved", request, campaignId: id, reason, before: {status: campaign.status, paymentStatus: campaign.paymentStatus}, after: patch, sessionId});
  if (campaign.publishedByUid) {
    await db.collection("inboxNotifications").add({
      recipientUid: campaign.publishedByUid,
      type: "adCampaignApproved",
      title: "Your ad is approved",
      body: `“${campaign.title}” runs ${new Date(flight.startsAtMs).toISOString().slice(0, 10)} to ${new Date(endsAtMs).toISOString().slice(0, 10)}.`,
      campaignId: id,
      link: `./patron-portal.html?v=${APP_V}&tab=ad-campaigns`,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    }).catch(() => {});
  }
  return {ok: true, ...patch};
});

exports.rejectAdCampaign = onCall({region: "us-central1", secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 60, memory: "256MiB"}, async request => {
  const {sessionId} = await assertSos2faSession(request);
  const {id, ref, campaign} = await loadCampaignForAdmin(request.data?.campaignId);
  const reason = requireReason(request);
  let refund = {status: "not-applicable"};
  if (campaign.paymentStatus === "paid" && request.data?.refund !== false) {
    const priv = (await db.collection("adCampaignPrivate").doc(id).get()).data() || {};
    try {
      const stripe = stripeClient();
      if (priv.stripeSubscriptionId) await stripe.subscriptions.cancel(priv.stripeSubscriptionId);
      let paymentIntent = priv.stripePaymentIntentId;
      if (!paymentIntent && priv.stripeSubscriptionId) {
        const invoices = await stripe.invoices.list({subscription: priv.stripeSubscriptionId, limit: 1});
        paymentIntent = invoices.data?.[0]?.payment_intent || "";
      }
      if (paymentIntent) {
        const r = await stripe.refunds.create({payment_intent: paymentIntent, metadata: {campaignId: id, reason: "ad-rejected"}}, {idempotencyKey: `floqr-ad-refund-${id}`});
        refund = {status: r.status, refundId: r.id};
      } else {
        refund = {status: "manual-review"};
      }
    } catch (error) {
      refund = {status: "failed", error: text(error?.message, 200)};
    }
  }
  const patch = {
    status: "rejected",
    rejectReason: reason,
    rejectedAtMs: Date.now(),
    updatedAtMs: Date.now(),
    ...(refund.status === "succeeded" || refund.status === "pending" ? {paymentStatus: "refunded"} : {}),
    refundStatus: refund.status
  };
  await ref.set(patch, {merge: true});
  await writeAdAudit({eventType: "ad.rejected", request, campaignId: id, reason, before: {status: campaign.status}, after: patch, detail: refund, sessionId});
  if (campaign.publishedByUid) {
    await db.collection("inboxNotifications").add({
      recipientUid: campaign.publishedByUid,
      type: "adCampaignRejected",
      title: "Your ad was not approved",
      body: `“${campaign.title}”: ${reason}${patch.paymentStatus === "refunded" ? " Your payment is being refunded." : ""}`,
      campaignId: id,
      link: `./patron-portal.html?v=${APP_V}&tab=ad-campaigns`,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    }).catch(() => {});
  }
  return {ok: true, refund};
});

exports.updateAdCampaign = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const {sessionId} = await assertSos2faSession(request);
  const {id, ref, campaign} = await loadCampaignForAdmin(request.data?.campaignId);
  const input = request.data?.patch || {};
  const patch = {updatedAtMs: Date.now()};
  if (input.demographics) {
    const demo = core.normalizeDemographics(input.demographics);
    const tags = core.demographicsToDatapoints(demo);
    Object.assign(patch, {
      demographics: demo,
      genders: demo.genders,
      minimumAge: demo.ageMin > 18 ? demo.ageMin : null,
      maximumAge: demo.ageMax < 99 ? demo.ageMax : null,
      targetTags: Array.isArray(input.targetTags) ? input.targetTags.map(t => text(t, 80)).filter(Boolean).slice(0, 80) : tags,
      targetMode: (Array.isArray(input.targetTags) ? input.targetTags.length : tags.length) ? "targeted" : "all"
    });
  } else if (Array.isArray(input.targetTags)) {
    patch.targetTags = input.targetTags.map(t => text(t, 80)).filter(Boolean).slice(0, 80);
    patch.targetMode = patch.targetTags.length ? "targeted" : "all";
  }
  if (Array.isArray(input.requiredTargetGroups)) {
    patch.requiredTargetGroups = input.requiredTargetGroups.slice(0, 10).map(g => ({
      label: text(g?.label, 80),
      fields: (Array.isArray(g?.fields) ? g.fields : []).map(f => text(f, 40)).filter(Boolean).slice(0, 10),
      tags: (Array.isArray(g?.tags) ? g.tags : []).map(t => text(t, 80)).filter(Boolean).slice(0, 40)
    })).filter(g => g.fields.length && g.tags.length);
  }
  ["title", "body", "advertiser", "cta"].forEach(key => { if (typeof input[key] === "string") patch[key] = text(input[key], key === "body" ? 240 : 80); });
  if (typeof input.sourceUrl === "string") {
    if (input.sourceUrl && !core.isHttpsUrl(input.sourceUrl)) throw new HttpsError("invalid-argument", "Links must start with https://");
    patch.sourceUrl = text(input.sourceUrl, 600);
  }
  ["startDate", "endDate"].forEach(key => {
    const v = text(input[key], 10);
    if (!v) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpsError("invalid-argument", "Dates must be YYYY-MM-DD.");
    patch[key === "startDate" ? "startsAtMs" : "endsAtMs"] = key === "startDate" ? Date.parse(`${v}T00:00:00Z`) : Date.parse(`${v}T23:59:59Z`);
  });
  await ref.set(patch, {merge: true});
  await writeAdAudit({eventType: "ad.updated", request, campaignId: id, reason: text(request.data?.reason, 500), before: {targetTags: campaign.targetTags || [], demographics: campaign.demographics || null}, after: patch, sessionId});
  return {ok: true, patch};
});

exports.setAdCampaignState = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const {sessionId} = await assertSos2faSession(request);
  const {id, ref, campaign} = await loadCampaignForAdmin(request.data?.campaignId);
  const state = text(request.data?.state, 20);
  const map = {pause: "paused", resume: "active", end: "expired"};
  if (!map[state]) throw new HttpsError("invalid-argument", "state must be pause, resume or end.");
  if (state === "resume" && !core.PAID_STATUSES.includes(campaign.paymentStatus)) throw new HttpsError("failed-precondition", "Unpaid ads cannot be resumed.");
  const reason = requireReason(request);
  const patch = {status: map[state], updatedAtMs: Date.now(), ...(state === "end" ? {endsAtMs: Date.now()} : {})};
  await ref.set(patch, {merge: true});
  await writeAdAudit({eventType: `ad.${state}`, request, campaignId: id, reason, before: {status: campaign.status}, after: patch, sessionId});
  return {ok: true, status: patch.status};
});

exports.markAdInvoicePaid = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const {sessionId} = await assertSos2faSession(request);
  const {id, ref, campaign} = await loadCampaignForAdmin(request.data?.campaignId);
  const reference = text(request.data?.reference, 120);
  if (reference.length < 3) throw new HttpsError("invalid-argument", "Enter the payment reference (check number, wire id…).");
  await ref.set({paymentStatus: "paid", status: campaign.status === "awaiting_payment" ? "pending_approval" : campaign.status, paidAtMs: Date.now(), updatedAtMs: Date.now()}, {merge: true});
  if (campaign.invoiceNumber) {
    await db.collection("adInvoices").doc(campaign.invoiceNumber).set({paymentStatus: "paid", statusLabel: "Paid", paidReference: reference, paidAtMs: Date.now()}, {merge: true});
  }
  await writeAdAudit({eventType: "ad.invoice_paid", request, campaignId: id, reason: reference, before: {paymentStatus: campaign.paymentStatus}, after: {paymentStatus: "paid"}, sessionId});
  return {ok: true};
});

async function deleteQueryInBatches(query, max = 5000) {
  let deleted = 0;
  while (deleted < max) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  return deleted;
}

exports.resetAdStats = onCall({region: "us-central1", timeoutSeconds: 300, memory: "512MiB"}, async request => {
  const {sessionId} = await assertSos2faSession(request);
  const reason = requireReason(request);
  const campaignId = text(request.data?.campaignId, 160);
  let deleted = 0;
  if (campaignId && campaignId !== "all") {
    const before = (await db.collection("adStats").doc(campaignId).get()).data() || null;
    await db.collection("adStats").doc(campaignId).delete();
    deleted = 1 + await deleteQueryInBatches(db.collection("adStatsDaily").where("campaignId", "==", campaignId));
    await writeAdAudit({eventType: "ad.stats_reset", request, campaignId, reason, before: before ? {impressions: before.impressions || 0, clicks: before.clicks || 0} : null, detail: {deleted}, sessionId});
  } else {
    deleted = await deleteQueryInBatches(db.collection("adStats"));
    deleted += await deleteQueryInBatches(db.collection("adStatsDaily"));
    deleted += await deleteQueryInBatches(db.collection("adEventDedupe"));
    await writeAdAudit({eventType: "ad.stats_reset_all", request, reason, detail: {deleted}, sessionId});
  }
  return {ok: true, deleted};
});

exports.purgeAdIntake = onCall({region: "us-central1", timeoutSeconds: 300, memory: "512MiB"}, async request => {
  const {sessionId} = await assertSos2faSession(request);
  const reason = requireReason(request);
  const scope = text(request.data?.scope, 20) === "all-unpaid" ? "all-unpaid" : "expired";
  const snap = await db.collection("adIntakeSubmissions").limit(500).get();
  const now = Date.now();
  const bucket = admin.storage().bucket();
  let deleted = 0;
  for (const doc of snap.docs) {
    const row = doc.data() || {};
    const unpaid = !row.campaignId || row.status === "awaiting_details" || row.status === "checkout-started";
    const expired = Number(row.expiresAtMs || 0) < now;
    if (!(unpaid && (scope === "all-unpaid" || expired))) continue;
    if (row.mediaStoragePath) await bucket.file(row.mediaStoragePath).delete().catch(() => {});
    await doc.ref.delete();
    deleted += 1;
  }
  await writeAdAudit({eventType: "ad.intake_purged", request, reason, detail: {scope, deleted}, sessionId});
  return {ok: true, deleted};
});

exports.setAdSettings = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const {email, sessionId} = await assertSos2faSession(request);
  const input = request.data?.settings || {};
  const before = await readSettings();
  const bit = v => (v === true || v === 1 || v === "1") ? 1 : 0;
  const next = {
    splashEnabled: bit(input.splashEnabled ?? before.splashEnabled),
    splashSeconds: Math.min(10, Math.max(3, Math.round(Number(input.splashSeconds ?? before.splashSeconds) || 5))),
    showDemoAds: bit(input.showDemoAds ?? before.showDemoAds),
    packagedAdsEnabled: bit(input.packagedAdsEnabled ?? before.packagedAdsEnabled),
    intakeEnabled: bit(input.intakeEnabled ?? before.intakeEnabled),
    maxIntakePerPhonePerDay: Math.min(50, Math.max(1, Math.round(Number(input.maxIntakePerPhonePerDay ?? before.maxIntakePerPhonePerDay) || 5))),
    updatedByEmail: email,
    updatedAtMs: Date.now()
  };
  await db.collection("adSettings").doc("global").set(next, {merge: true});
  await writeAdAudit({eventType: "ad.settings_changed", request, reason: text(request.data?.reason, 500), before, after: next, sessionId});
  return {ok: true, settings: next};
});

exports.setAdInvoiceAccount = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const {email, sessionId} = await assertSos2faSession(request);
  const key = text(request.data?.posterKey, 200);
  if (!/^[a-zA-Z]+:[^/]{1,160}$/.test(key)) throw new HttpsError("invalid-argument", "posterKey looks like club:<id> or promoter:<uid>.");
  const reason = requireReason(request);
  const enabled = request.data?.enabled === true;
  const row = {
    posterKey: key,
    enabled,
    contractRef: text(request.data?.contractRef, 120),
    netDays: Math.min(90, Math.max(0, Math.round(Number(request.data?.netDays) || 30))),
    billingEmail: text(request.data?.billingEmail, 200).toLowerCase(),
    updatedByEmail: email,
    updatedAtMs: Date.now()
  };
  await db.collection("adInvoiceAccounts").doc(key).set(row, {merge: true});
  await writeAdAudit({eventType: "ad.invoice_account_changed", request, reason, after: row, sessionId});
  return {ok: true};
});

/* ---------- measurement ---------- */

exports.recordAdEvent = onCall({region: "us-central1", timeoutSeconds: 15, memory: "256MiB"}, async request => {
  const campaignId = text(request.data?.campaignId, 160);
  const event = text(request.data?.event, 20);
  const slot = text(request.data?.slot, 40).replace(/[^a-z0-9-]/gi, "") || "default";
  if (!campaignId || !["impression", "click"].includes(event)) throw new HttpsError("invalid-argument", "campaignId and event are required.");
  const packaged = request.data?.packaged === true;
  if (packaged && !PACKAGED_ID_RE.test(campaignId)) throw new HttpsError("invalid-argument", "Unknown campaign.");
  if (!packaged) {
    const snap = await db.collection("spotAdCampaigns").doc(campaignId).get();
    if (!snap.exists || !core.SERVABLE_STATUSES.includes(snap.data()?.status)) return {ok: true, counted: false};
  }
  const ua = text(request.rawRequest?.headers?.["user-agent"], 300);
  const viewer = request.auth?.uid ? `u:${request.auth.uid}` : `a:${sha16(`${clientIp(request)}|${ua}`)}`;
  const now = Date.now();
  const throttleRef = db.collection("adEventThrottle").doc(sha16(viewer));
  const windowMs = event === "impression" ? IMPRESSION_DEDUPE_MS : CLICK_DEDUPE_MS;
  const dedupeRef = db.collection("adEventDedupe").doc(sha16(`${campaignId}|${viewer}|${event}|${Math.floor(now / windowMs)}`));
  const counted = await db.runTransaction(async tx => {
    const [throttle, dedupe] = await Promise.all([tx.get(throttleRef), tx.get(dedupeRef)]);
    if (dedupe.exists) return false;
    const t = throttle.exists ? throttle.data() || {} : {};
    const fresh = now - Number(t.windowStartMs || 0) > EVENT_THROTTLE_WINDOW_MS;
    const count = fresh ? 0 : Number(t.count || 0);
    if (count >= EVENT_THROTTLE_MAX) return false;
    tx.set(throttleRef, {windowStartMs: fresh ? now : t.windowStartMs, count: count + 1, expireAtMs: now + EVENT_THROTTLE_WINDOW_MS}, {merge: true});
    tx.set(dedupeRef, {campaignId, event, expireAtMs: now + windowMs * 2});
    const inc = FieldValue.increment(1);
    const field = event === "impression" ? "impressions" : "clicks";
    tx.set(db.collection("adStats").doc(campaignId), {
      campaignId,
      packaged,
      [field]: inc,
      bySlot: {[slot]: {[field]: inc}},
      lastEventAtMs: now,
      ...(event === "impression" ? {lastImpressionAtMs: now} : {lastClickAtMs: now})
    }, {merge: true});
    const day = core.statsDayKey(now);
    tx.set(db.collection("adStatsDaily").doc(`${campaignId}_${day}`), {campaignId, day, packaged, [field]: inc}, {merge: true});
    return true;
  });
  return {ok: true, counted};
});

/* ---------- SMS / WhatsApp intake ---------- */

function candidateWebhookUrls(req, functionName) {
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "shoutoutdemo-5b402";
  const path = String(req.originalUrl || req.url || "/");
  const query = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  const hosts = [req.headers?.["x-forwarded-host"], req.headers?.host].filter(Boolean).map(h => String(h).split(",")[0].trim());
  const urls = new Set();
  if (process.env.FLOQR_AD_INTAKE_WEBHOOK_URL) urls.add(process.env.FLOQR_AD_INTAKE_WEBHOOK_URL);
  hosts.forEach(host => {
    urls.add(`https://${host}${path}`);
    urls.add(`https://${host}/${functionName}${query}`);
  });
  urls.add(`https://us-central1-${project}.cloudfunctions.net/${functionName}${query}`);
  return [...urls];
}

async function sendIntakeReply({creds, channel, to, from, body, purpose = "ad-intake", campaignId = ""}) {
  const toAddr = channel === "whatsapp" ? `whatsapp:${to}` : to;
  const fromAddr = from || (channel === "whatsapp" ? creds.whatsappFrom : creds.fromNumber);
  return sendTwilioMessagesApi({
    accountSid: creds.accountSid,
    authToken: creds.authToken,
    to: toAddr,
    from: fromAddr,
    body,
    channel,
    purpose,
    source: "adIntake",
    campaignId,
    describeInvalidSid: describeTwilioAccountSid,
    explainError: explainTwilioDeliveryError,
    extra: {feature: "adIntake"}
  });
}

async function downloadTwilioMedia(url, creds) {
  if (!/^https:\/\/([a-z0-9-]+\.)*twilio\.com\//i.test(String(url || ""))) throw new Error("Unexpected media host.");
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
  const response = await fetch(url, {headers: {Authorization: `Basic ${auth}`}, redirect: "follow"});
  if (!response.ok) throw new Error(`Media download failed (${response.status}).`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > core.MAX_VIDEO_BYTES) throw new Error("Videos must be under 60 MB.");
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > core.MAX_VIDEO_BYTES) throw new Error("Videos must be under 60 MB.");
  return {buffer: Buffer.from(arrayBuffer), contentType: text(response.headers.get("content-type"), 80)};
}

/**
 * Handle an inbound Twilio SMS / WhatsApp message that carries media or the AD keyword.
 * Returns true when the message was an ad-intake message (caller sends empty TwiML).
 */
async function handleAdIntakeMessage(req, form, {functionName = "messagingInboundWebhook", creds = twilioCredentials()} = {}) {
  const command = core.parseIntakeCommand(form.Body);
  const rawFrom = String(form.From || "");
  const channel = /^whatsapp:/i.test(rawFrom) ? "whatsapp" : "sms";
  const from = normalizeE164(rawFrom.replace(/^whatsapp:/i, ""));
  const replyFrom = text(form.To, 60);
  if (!from) return false;
  const phoneHash = hashPhone(from);
  const optOutRef = db.collection("adIntakeOptOuts").doc(phoneHash);
  const relevant = core.isAdIntakeMessage(form) || ["help", "stop", "start"].includes(command);
  if (!relevant) return false;
  if (command === "stop" || command === "start") {
    const optedOut = (await optOutRef.get()).exists;
    if (!optedOut && command === "start") return false;
    if (command === "stop" && optedOut) return true;
  }
  const signature = String(req.headers?.["x-twilio-signature"] || "");
  if (!core.validateTwilioSignature(creds.authToken, signature, candidateWebhookUrls(req, functionName), form)) {
    await writeAdAudit({eventType: "intake.signature_rejected", outcome: "denied", detail: {channel, phoneHash, functionName}});
    return true;
  }
  if (command === "stop" || command === "start") {
    if (command === "stop") await optOutRef.set({phoneHash, channel, createdAtMs: Date.now()}, {merge: true});
    else await optOutRef.delete();
    if (channel === "whatsapp") {
      await sendIntakeReply({creds, channel, to: from, from: replyFrom, body: command === "stop"
        ? "FLOQR: You will not get more ad messages from us. Reply START to undo."
        : "FLOQR: You can send ads again. Send your flyer or a video up to 30 seconds."});
    }
    return command === "stop";
  }
  if ((await optOutRef.get()).exists) return true;
  if (command === "help") {
    await sendIntakeReply({creds, channel, to: from, from: replyFrom, body: "FLOQR ads: send a flyer image (JPG/PNG) or a video up to 30 seconds with a short caption. We reply with a link to pick your audience and pay. Reply STOP to opt out."});
    return true;
  }
  const settings = await readSettings();
  if (!(settings.intakeEnabled === 1 || settings.intakeEnabled === true)) {
    await sendIntakeReply({creds, channel, to: from, from: replyFrom, body: "FLOQR: We are not taking ads by message right now. Please try again later."});
    return true;
  }
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = await db.collection("adIntakeSubmissions").where("phoneHash", "==", phoneHash).limit(100).get();
  const recentCount = recent.docs.filter(doc => Number(doc.data()?.createdAtMs || 0) >= dayAgo).length;
  if (recentCount >= Number(settings.maxIntakePerPhonePerDay || 5)) {
    await sendIntakeReply({creds, channel, to: from, from: replyFrom, body: "FLOQR: You have sent the daily maximum of ads. Please try again tomorrow."});
    return true;
  }
  const numMedia = Number(form.NumMedia || 0);
  if (!numMedia) {
    await sendIntakeReply({creds, channel, to: from, from: replyFrom, body: "FLOQR: Send your flyer image or a video up to 30 seconds to this number, with a short caption. We will reply with a link to finish and pay."});
    return true;
  }
  let media;
  try {
    const download = await downloadTwilioMedia(form.MediaUrl0, creds);
    media = core.inspectAdMedia(download.buffer, form.MediaContentType0 || download.contentType);
    if (media.ok) media.buffer = download.buffer;
  } catch (error) {
    media = {ok: false, error: text(error?.message, 200) || "We could not read that file."};
  }
  if (!media.ok) {
    await sendIntakeReply({creds, channel, to: from, from: replyFrom, body: `FLOQR: ${media.error}`});
    await writeAdAudit({eventType: "intake.media_rejected", outcome: "failure", detail: {channel, phoneHash, error: media.error}});
    return true;
  }
  const token = core.newToken();
  const id = core.hashToken(token);
  const storagePath = `adIntake/${id}/creative.${media.ext}`;
  const mediaUrl = await saveBufferToStorage(storagePath, media.buffer, media.mime);
  const nowMs = Date.now();
  await db.collection("adIntakeSubmissions").doc(id).set({
    status: "awaiting_details",
    channel,
    phoneHash,
    phoneMasked: maskPhone(from),
    replyTo: from,
    replyFrom,
    caption: text(form.Body, 500),
    creativeType: media.kind,
    contentType: media.mime,
    durationSeconds: media.durationSeconds || 0,
    bytes: media.bytes,
    mediaUrl,
    mediaStoragePath: storagePath,
    messageSid: text(form.MessageSid || form.SmsSid, 80),
    createdAtMs: nowMs,
    expiresAtMs: nowMs + core.INTAKE_TTL_MS,
    createdAt: FieldValue.serverTimestamp()
  });
  const link = `${publicOrigin()}/ad-submit.html?v=${APP_V}&t=${encodeURIComponent(token)}`;
  await sendIntakeReply({creds, channel, to: from, from: replyFrom, body: `FLOQR: Got your ${media.kind === "video" ? "video" : "flyer"}. Pick who should see it and pay here (link works for 72 hours): ${link} Reply STOP to opt out.`});
  return true;
}

exports.adIntakeWebhook = onRequest({region: "us-central1", secrets: TWILIO_SECRETS, timeoutSeconds: 120, memory: "1GiB"}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  const form = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
    ? req.body
    : Object.fromEntries(new URLSearchParams(Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.body || "")));
  try {
    await handleAdIntakeMessage(req, {...form, Body: form.Body || "AD"}, {functionName: "adIntakeWebhook"});
  } catch (error) {
    console.error("adIntakeWebhook failed", error?.message || error);
  }
  res.status(200).type("text/xml").send("<Response></Response>");
});

async function intakeByToken(token) {
  const clean = text(token, 120);
  if (clean.length < 20) throw new HttpsError("invalid-argument", "This link is not valid.");
  const id = core.hashToken(clean);
  const ref = db.collection("adIntakeSubmissions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "This link is not valid or was removed.");
  return {id, ref, row: snap.data() || {}};
}

exports.getAdIntake = onCall({region: "us-central1", timeoutSeconds: 15, memory: "256MiB"}, async request => {
  const {row} = await intakeByToken(request.data?.token);
  const expired = Number(row.expiresAtMs || 0) < Date.now() && !row.campaignId;
  let campaign = null;
  if (row.campaignId) {
    const snap = await db.collection("spotAdCampaigns").doc(row.campaignId).get();
    if (snap.exists) {
      const c = snap.data() || {};
      campaign = {title: c.title, status: c.status, paymentStatus: c.paymentStatus, invoiceNumber: c.invoiceNumber || "", startsAtMs: c.startsAtMs || c.proposedStartsAtMs || null, endsAtMs: c.endsAtMs || c.proposedEndsAtMs || null};
    }
  }
  return {
    expired,
    status: row.status,
    channel: row.channel,
    phoneMasked: row.phoneMasked,
    caption: row.caption,
    creativeType: row.creativeType,
    durationSeconds: row.durationSeconds,
    mediaUrl: row.mediaUrl,
    campaign,
    pricing: core.PRICE_TABLE_CENTS,
    runDayOptions: core.RUN_DAY_OPTIONS
  };
});

exports.startAdIntakeCheckout = onCall({region: "us-central1", secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const token = text(request.data?.token, 120);
  const {id, ref, row} = await intakeByToken(token);
  if (Number(row.expiresAtMs || 0) < Date.now()) throw new HttpsError("failed-precondition", "This link expired. Send your flyer or video again to get a new one.");
  if (row.campaignId) {
    const existing = (await db.collection("spotAdCampaigns").doc(row.campaignId).get()).data() || {};
    if (existing.paymentStatus === "paid") throw new HttpsError("failed-precondition", "This ad is already paid.");
  }
  const input = {...(request.data?.details || {}), mediaUrl: row.mediaUrl};
  if (input.paymentMode === "invoice") throw new HttpsError("invalid-argument", "Pay by card or monthly subscription.");
  const check = core.validateCampaignInput(input, {requireMedia: true});
  if (!check.ok) throw new HttpsError("invalid-argument", check.errors.join(" "));
  const value = check.value;
  const contactEmail = text(request.data?.email, 200).toLowerCase();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new HttpsError("invalid-argument", "Check the email address.");
  const contactName = text(request.data?.name, 120) || value.advertiser || row.phoneMasked;
  const {runDays, amountCents} = priceForValue(value);
  const flight = core.computeFlight(value.startDate, runDays);
  const poster = {posterType: "thirdParty", posterId: row.phoneHash, key: core.posterKey("thirdParty", row.phoneHash), label: value.advertiser || contactName};
  const media = {kind: row.creativeType, mediaUrl: row.mediaUrl, mediaStoragePath: row.mediaStoragePath, durationSeconds: row.durationSeconds};
  const campaignRef = row.campaignId ? db.collection("spotAdCampaigns").doc(row.campaignId) : db.collection("spotAdCampaigns").doc();
  const nowMs = Date.now();
  await campaignRef.set({
    ...publicCampaignFields(value, media, poster),
    status: "awaiting_payment",
    paymentStatus: "unpaid",
    paymentMode: value.paymentMode,
    runDays,
    priceCents: amountCents,
    proposedStartDate: flight.startDate,
    proposedStartsAtMs: flight.startsAtMs,
    proposedEndsAtMs: flight.endsAtMs,
    publishedByUid: "",
    source: "ad-intake",
    intakeChannel: row.channel,
    ...(row.campaignId ? {} : {createdAtMs: nowMs}),
    updatedAtMs: nowMs
  }, {merge: true});
  await db.collection("adCampaignPrivate").doc(campaignRef.id).set({
    campaignId: campaignRef.id,
    contactName,
    contactEmail,
    contactPhone: row.replyTo,
    contactChannel: row.channel,
    replyFrom: row.replyFrom,
    intakeTokenHash: id,
    createdAtMs: nowMs
  }, {merge: true});
  await ref.set({status: "checkout-started", campaignId: campaignRef.id, updatedAtMs: nowMs}, {merge: true});
  const base = safeReturnBase(request);
  const t = encodeURIComponent(token);
  const checkout = await createAdCheckout({
    campaignId: campaignRef.id,
    campaign: {title: value.title, placementType: value.placementType, runDays, paymentMode: value.paymentMode, amountCents},
    customerEmail: contactEmail,
    successUrl: `${base}ad-submit.html?v=${APP_V}&t=${t}&paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}ad-submit.html?v=${APP_V}&t=${t}&cancelled=1`,
    source: "ad-intake"
  });
  await ref.set({orderId: checkout.orderId}, {merge: true});
  await writeAdAudit({eventType: "intake.checkout_started", request, campaignId: campaignRef.id, detail: {amountCents, paymentMode: value.paymentMode}});
  return {campaignId: campaignRef.id, checkoutUrl: checkout.checkoutUrl, amountCents};
});

async function markAdOrderPaid(orderId, session) {
  const ref = db.collection("serviceOrders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snap.data() || {};
  if (order.orderType !== "adCampaign") throw new HttpsError("failed-precondition", "Not an ad order.");
  if (!(order.paymentStatus === "paid" && order.stripeFulfillmentComplete === true)) {
    await ref.set({
      status: "paid",
      paymentStatus: "paid",
      paidAt: order.paidAt || FieldValue.serverTimestamp(),
      stripeCheckoutSessionId: text(session?.id, 200),
      stripePaymentIntentId: text(session?.payment_intent, 200),
      customerEmail: text(session?.customer_details?.email, 200),
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
    await fulfillAdOrder(orderId, order, session);
    await ref.set({fulfillmentStatus: "ad-pending-approval", fulfilledRecordId: order.campaignId, stripeFulfillmentComplete: true, fulfilledAt: FieldValue.serverTimestamp()}, {merge: true});
  }
  return order;
}

exports.confirmAdIntakePayment = onCall({region: "us-central1", secrets: [STRIPE_SECRET_KEY], timeoutSeconds: 30, memory: "256MiB"}, async request => {
  const {ref, row} = await intakeByToken(request.data?.token);
  if (!row.orderId) throw new HttpsError("failed-precondition", "No checkout was started for this link.");
  const sessionId = text(request.data?.sessionId, 200);
  const order = (await db.collection("serviceOrders").doc(row.orderId).get()).data() || {};
  const session = await stripeClient().checkout.sessions.retrieve(sessionId || order.stripeCheckoutSessionId);
  if (text(session.metadata?.orderId || session.client_reference_id, 160) !== row.orderId) {
    throw new HttpsError("failed-precondition", "This payment does not belong to this link.");
  }
  const paid = session.payment_status === "paid" || (session.mode === "subscription" && ["paid", "no_payment_required"].includes(session.payment_status));
  if (!paid) return {ok: false, message: "Stripe has not confirmed the payment yet. Refresh in a moment."};
  await markAdOrderPaid(row.orderId, session);
  await ref.set({status: "paid", updatedAtMs: Date.now()}, {merge: true});
  const campaign = (await db.collection("spotAdCampaigns").doc(row.campaignId).get()).data() || {};
  return {ok: true, invoiceNumber: campaign.invoiceNumber || "", status: campaign.status};
});

exports.getAdInvoice = onCall({region: "us-central1", timeoutSeconds: 15, memory: "256MiB"}, async request => {
  let invoiceSnap = null;
  if (request.data?.token) {
    const {id, row} = await intakeByToken(request.data.token);
    const campaign = row.campaignId ? (await db.collection("spotAdCampaigns").doc(row.campaignId).get()).data() || {} : {};
    if (!campaign.invoiceNumber) throw new HttpsError("not-found", "No invoice yet. It appears once payment is confirmed.");
    invoiceSnap = await db.collection("adInvoices").doc(campaign.invoiceNumber).get();
    if (invoiceSnap.exists && invoiceSnap.data()?.intakeTokenHash !== id) throw new HttpsError("permission-denied", "This invoice belongs to a different link.");
  } else {
    const auth = requireAuth(request);
    const number = text(request.data?.invoiceNumber, 80);
    invoiceSnap = await db.collection("adInvoices").doc(number).get();
    if (invoiceSnap.exists && invoiceSnap.data()?.ownerUid !== auth.uid && !isMasterAdminAuth(auth)) throw new HttpsError("permission-denied", "Not your invoice.");
  }
  if (!invoiceSnap?.exists) throw new HttpsError("not-found", "Invoice not found.");
  const inv = invoiceSnap.data() || {};
  return {
    invoiceNumber: inv.invoiceNumber,
    title: inv.title,
    amountCents: inv.amountCents,
    currency: inv.currency,
    paymentStatus: inv.paymentStatus,
    statusLabel: inv.statusLabel,
    issuedAtIso: inv.issuedAtIso,
    lines: core.buildInvoiceLines(inv)
  };
});

/* ---------- invoice delivery ---------- */

exports.onAdInvoiceCreated = onDocumentCreated({
  document: "adInvoices/{invoiceNumber}",
  region: "us-central1",
  secrets: [SENDGRID_API_KEY, ...TWILIO_SECRETS],
  timeoutSeconds: 60,
  memory: "256MiB"
}, async event => {
  const snap = event.data;
  if (!snap) return;
  const inv = snap.data() || {};
  const delivery = {};
  const lines = core.buildInvoiceLines(inv);
  const link = inv.intakeTokenHash ? "" : `${publicOrigin()}/ad-invoice.html?v=${APP_V}&invoice=${encodeURIComponent(inv.invoiceNumber)}`;
  if (inv.deliverPhone && inv.deliverChannel) {
    const privSnap = await db.collection("adCampaignPrivate").doc(inv.campaignId).get();
    const replyFrom = text(privSnap.data()?.replyFrom, 60);
    const body = `FLOQR invoice ${inv.invoiceNumber}: ${core.money(inv.amountCents)} for “${inv.title}”. Status: ${inv.statusLabel}. FLOQR reviews your ad before it runs. Open your ad link to view the invoice.`;
    const result = await sendIntakeReply({creds: twilioCredentials(), channel: inv.deliverChannel, to: inv.deliverPhone, from: replyFrom, body, purpose: "ad-invoice", campaignId: inv.campaignId});
    delivery.message = {status: result.status, ok: result.ok === true};
  }
  if (inv.billToEmail) {
    try {
      const status = await sendgridMailWithAttachment({
        apiKey: secretValue(SENDGRID_API_KEY, "SENDGRID_API_KEY"),
        to: inv.billToEmail,
        from: process.env.FLOQR_RECEIPT_FROM || "login@floqr.com",
        subject: `FLOQR ad invoice ${inv.invoiceNumber}`,
        textBody: `${lines.join("\n")}${link ? `\n\nView online: ${link}` : ""}`,
        htmlBody: `<pre style="font-family:Arial,sans-serif">${lines.map(l => l.replace(/[&<>]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]))).join("\n")}</pre>`,
        filename: `${inv.invoiceNumber}.pdf`,
        pdfBase64: buildInvoicePdfBase64(lines)
      });
      delivery.email = {status: text(status, 40) || "sent"};
    } catch (error) {
      delivery.email = {status: "failed", error: text(error?.code || error?.message, 120)};
    }
  }
  if (inv.ownerUid) {
    await db.collection("inboxNotifications").add({
      recipientUid: inv.ownerUid,
      type: "adInvoice",
      title: `Ad invoice ${inv.invoiceNumber}`,
      body: lines.join("\n"),
      invoiceNumber: inv.invoiceNumber,
      campaignId: inv.campaignId,
      link,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
    delivery.inbox = {status: "sent"};
  }
  await snap.ref.set({delivery: {...delivery, status: "done", deliveredAtMs: Date.now()}}, {merge: true});
});

/* ---------- housekeeping ---------- */

exports.expireAdCampaigns = onSchedule({region: "us-central1", schedule: "every 60 minutes", timeZone: "UTC", timeoutSeconds: 120, memory: "256MiB"}, async () => {
  const now = Date.now();
  const active = await db.collection("spotAdCampaigns").where("status", "==", "active").limit(400).get();
  const batch = db.batch();
  let expired = 0;
  active.docs.forEach(doc => {
    const ends = Number(doc.data()?.endsAtMs || 0);
    if (ends && ends < now) {
      batch.set(doc.ref, {status: "expired", expiredAtMs: now}, {merge: true});
      expired += 1;
    }
  });
  if (expired) await batch.commit();
  const oldDedupe = await db.collection("adEventDedupe").where("expireAtMs", "<", now).limit(400).get();
  if (!oldDedupe.empty) {
    const b = db.batch();
    oldDedupe.docs.forEach(doc => b.delete(doc.ref));
    await b.commit();
  }
  const staleIntake = await db.collection("adIntakeSubmissions").where("expiresAtMs", "<", now - 7 * 24 * 60 * 60 * 1000).limit(100).get();
  const bucket = admin.storage().bucket();
  for (const doc of staleIntake.docs) {
    const row = doc.data() || {};
    if (row.campaignId && row.status !== "awaiting_details") continue;
    if (row.mediaStoragePath) await bucket.file(row.mediaStoragePath).delete().catch(() => {});
    await doc.ref.delete();
  }
  console.info("expireAdCampaigns", {expired, dedupeCleared: oldDedupe.size});
});

exports.__adHelpers = {fulfillAdOrder, syncAdSubscription, handleAdIntakeMessage, markAdOrderPaid};
