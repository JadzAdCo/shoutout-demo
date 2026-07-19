/* FLOQR commerce, paid services, audience campaigns, and Pickup backend v29.08.4. */
const admin = require("firebase-admin");
const Stripe = require("stripe");
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const {
  buildAccountLinkParams,
  buildRecipientAccountParams,
  connectBindingId,
  connectStatus,
  normalizeConnectEntityType
} = require("./stripe-connect-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const DEFAULT_ORIGIN = "https://jadzadco.github.io/shoutout-demo";
const STRIPE_API_VERSION = "2026-06-24.dahlia";
// Stripe Checkout requires expires_at to be at least 30 minutes in the future.
const COMMERCE_RESERVATION_SECONDS = 31 * 60;
const FOOTBALL_TEAM_INTRO_TEMPLATE_ID = "zebbiesFootballTeamIntro";
const ZEBBIES_GARDEN_DC_LOCATION_ID = "zebbies-garden-washington-dc";
const HEIST_DC_LOCATION_ID = "heist-washington-dc";
const HEIST_ART_TEMPLATE_IDS = new Set(["heistVaultNight", "heistNeonMask", "heistDupontUnder", "heistRedLux"]);
const HEIST_ART_PRICE_CENTS = 4000;
const LIVE_SHOUTOUT_DURATION_MS = 10 * 60 * 1000;
const SPLIT_MEDIA_TEMPLATE_IDS = new Set(["birthdayMedia", "anniversaryMedia", "engagementMedia", "fianceMedia"]);
const CLASSIC_BOARD_TEMPLATE_IDS = new Set(["blackwhite", "graduation", "corporate", "heistVaultNight", "heistNeonMask", "heistDupontUnder", "heistRedLux"]);
const SHOUTOUT_TEXT_LIMITS = {
  full:{
    "p125-96x48":[3,16,48,28],"p125-64x48":[3,10,30,22],"p125-64x32":[3,14,42,24],
    "led-96x48":[3,16,48,28],"led-64x48":[3,10,30,22],"led-64x32":[3,10,30,16]
  },
  classicBoard:{
    "p125-96x48":[3,15,45,20],"p125-64x48":[3,12,36,18],"p125-64x32":[3,14,42,18],
    "led-96x48":[3,15,45,20],"led-64x48":[3,12,36,18],"led-64x32":[3,10,30,14]
  },
  splitMedia:{
    "p125-96x48":[3,10,30,20],"p125-64x48":[2,12,24,18],"p125-64x32":null,
    "led-96x48":[3,10,30,20],"led-64x48":[2,12,24,18],"led-64x32":null
  },
  car:{
    "p125-96x48":[2,14,28,22],"p125-64x48":[2,10,20,18],"p125-64x32":[2,12,24,18],
    "led-96x48":[2,14,28,22],"led-64x48":[2,10,20,18],"led-64x32":[2,12,24,16]
  },
  footballIntro:{
    "p125-96x48":[2,14,28,20,3,18,54,14,false],"p125-64x48":[2,10,20,16,3,12,36,10,false],"p125-64x32":[2,10,20,14,2,12,24,8,true],
    "led-96x48":[2,14,28,20,3,18,54,14,false],"led-64x48":[2,10,20,16,3,12,36,10,false],"led-64x32":[2,10,20,14,2,12,24,8,true]
  }
};
const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bands.don@gmail.com,bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);
const SHOUTOUT_CHECKOUT_EXPIRY_SECONDS = 31 * 60;
const SHOUTOUT_CLUB_SHARE_PERCENT = 20;
const UNPAID_CLEARABLE_STATUSES = new Set(["checkout-created", "checkout-failed", "checkout-expired", "payment-failed"]);

async function writeAppLog(entry = {}) {
  try {
    await db.collection("appLogs").add({
      level:text(entry.level || "info", 20) || "info",
      category:text(entry.category || "functions", 80) || "functions",
      action:text(entry.action || "", 120),
      message:text(entry.message || "No message", 2000) || "No message",
      details:entry.details && typeof entry.details === "object" ? entry.details : null,
      correlationId:text(entry.correlationId || "", 80),
      sessionId:text(entry.sessionId || "", 80),
      uid:text(entry.uid || "system", 120) || "system",
      email:text(entry.email || "", 200),
      href:text(entry.href || "", 500),
      userAgent:text(entry.userAgent || "firebase-functions", 300),
      appVersion:text(entry.appVersion || "29.09.4", 40),
      source:text(entry.source || "functions", 40) || "functions",
      createdAt:admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("appLogs write failed", error?.message || error);
  }
}

function callableErrorFields(error) {
  return {
    code:error?.code || "",
    message:error?.message || String(error || ""),
    httpErrorCode:error?.httpErrorCode?.status || null
  };
}

function stripeClient() {
  const key = STRIPE_SECRET_KEY.value();
  if (!key) throw new HttpsError("failed-precondition", "Stripe checkout is not configured. Set STRIPE_SECRET_KEY in Firebase Functions.");
  return new Stripe(key, {
    apiVersion:STRIPE_API_VERSION,
    maxNetworkRetries:2,
    timeout:20000,
    appInfo:{name:"FLOQR", version:"29.08.4", url:DEFAULT_ORIGIN}
  });
}

function isStripeTestMode() {
  const key = String(STRIPE_SECRET_KEY.value() || "");
  return /^sk_test_/i.test(key) || !/^sk_live_/i.test(key);
}

function testPaymentFields(session = null, existing = {}) {
  const livemode = typeof session?.livemode === "boolean"
    ? session.livemode
    : (typeof existing.stripeLivemode === "boolean" ? existing.stripeLivemode : !isStripeTestMode());
  const isTestPayment = livemode === false || existing.isTestPayment === true || isStripeTestMode();
  return {
    isTestPayment,
    stripeLivemode:livemode === true,
    testPaymentMarker:isTestPayment ? "stripe-test" : "",
    environment:isTestPayment ? "test" : "live"
  };
}

function text(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}

function checkoutTextCaps(templateId = "", formatId = "") {
  const profileId = templateId === FOOTBALL_TEAM_INTRO_TEMPLATE_ID ? "footballIntro" : templateId === "car" ? "car" : SPLIT_MEDIA_TEMPLATE_IDS.has(templateId) ? "splitMedia" : CLASSIC_BOARD_TEMPLATE_IDS.has(templateId) ? "classicBoard" : "full";
  const values = SHOUTOUT_TEXT_LIMITS[profileId]?.[formatId];
  if (!values) throw new HttpsError("failed-precondition", "The selected template is not supported on this display size.");
  return {
    profileId,
    formatId,
    lineCount:values[0],
    perLine:values[1],
    main:values[2],
    sub:values[3],
    stadiumLineCount:values[4] || 0,
    stadiumPerLine:values[5] || 0,
    stadium:values[6] || 0,
    playerName:values[7] || 0,
    skipFinaleLineup:values[8] === true
  };
}

function fitCheckoutDisplayText(value = "", caps = {}, type = "main") {
  const limit = Math.max(0, Number(type === "sub" ? caps.sub : caps.main));
  const clean = String(value || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (type === "sub" || Number(caps.lineCount || 1) <= 1) return clean.slice(0, limit);
  const rows = [];
  let row = "";
  clean.slice(0, limit + caps.lineCount - 1).split(/\s+/).filter(Boolean).forEach(word => {
    const chunks = [];
    for (let i = 0; i < word.length; i += caps.perLine) chunks.push(word.slice(i, i + caps.perLine));
    chunks.forEach(chunk => {
      const next = row ? `${row} ${chunk}` : chunk;
      if (next.length <= caps.perLine) row = next;
      else if (rows.length < caps.lineCount) { rows.push(row); row = chunk; }
    });
  });
  if (row && rows.length < caps.lineCount) rows.push(row);
  return rows.slice(0, caps.lineCount).join("\n");
}

function safeHttpsMediaUrl(value = "") {
  const candidate = text(value, 1800);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.href : "";
  } catch (error) {
    return "";
  }
}

function normalizeFootballTeamMembers(value, ownerUid, nameLimit = 14) {
  const members = Array.isArray(value) ? value.slice(0, 4) : [];
  if (members.length !== 4) throw new HttpsError("invalid-argument", "Football Intro requires exactly four player photos.");
  return members.map((member, index) => {
    const originalMediaStoragePath = text(member?.originalMediaStoragePath || member?.mediaStoragePath, 500);
    if (!originalMediaStoragePath.startsWith(`shoutouts/${ownerUid}/`) || !originalMediaStoragePath.includes("/original/")) {
      throw new HttpsError("permission-denied", `Player ${index + 1} must use an original image uploaded by the signed-in patron.`);
    }
    const mediaUrl = safeHttpsMediaUrl(member?.mediaUrl || member?.enhancedMediaUrl || member?.originalMediaUrl);
    const originalMediaUrl = safeHttpsMediaUrl(member?.originalMediaUrl || member?.mediaUrl);
    if (!mediaUrl || !originalMediaUrl) throw new HttpsError("invalid-argument", `Player ${index + 1} is missing a valid uploaded image.`);
    const selectedMediaVersion = text(member?.selectedMediaVersion, 20) === "enhanced" ? "enhanced" : "original";
    return {
      slot:index + 1,
      identityType:text(member?.identityType || "displayName", 40),
      name:text(member?.name || `PLAYER ${index + 1}`, nameLimit) || `PLAYER ${index + 1}`,
      position:text(member?.position || "Team Member", 24) || "Team Member",
      mediaUrl,
      originalMediaUrl,
      enhancedMediaUrl:safeHttpsMediaUrl(member?.enhancedMediaUrl),
      mediaStoragePath:text(member?.mediaStoragePath || originalMediaStoragePath, 500),
      originalMediaStoragePath,
      enhancedMediaStoragePath:text(member?.enhancedMediaStoragePath, 500),
      selectedMediaVersion,
      aiEnhancementApplied:selectedMediaVersion === "enhanced" && member?.aiEnhancementApplied === true,
      aiEnhancementProvider:selectedMediaVersion === "enhanced" ? text(member?.aiEnhancementProvider, 40) : "",
      aiEnhancementModel:selectedMediaVersion === "enhanced" ? text(member?.aiEnhancementModel, 100) : "",
      aiMediaSafetyStatus:text(member?.aiMediaSafetyStatus || "notChecked", 40),
      aiMediaSafetyNotes:text(member?.aiMediaSafetyNotes, 240),
      mediaFileName:text(member?.mediaFileName, 180)
    };
  });
}

function normalizeCheckoutPayload(type, rawPayload = {}, authContext = {}) {
  if (type !== "shoutout") return rawPayload;
  const rawShoutout = rawPayload.shoutout && typeof rawPayload.shoutout === "object" ? rawPayload.shoutout : {};
  const templateId = text(rawShoutout.template || rawShoutout.templateId, 80);
  const screenFormatId = text(rawShoutout.screenFormatId, 40);
  const caps = checkoutTextCaps(templateId, screenFormatId);
  const shoutout = {
    ...rawShoutout,
    template:templateId,
    screenFormatId,
    textLayoutVersion:"29.08.4",
    textProfileId:caps.profileId,
    maxMainCharacters:caps.main,
    maxSubCharacters:caps.sub,
    lineCount:caps.lineCount,
    maxCharactersPerLine:caps.perLine,
    mainTextSizePercent:20.8,
    subTextSizePercent:7.8,
    mainText:fitCheckoutDisplayText(rawShoutout.mainText || "SHOUTOUT!", caps, "main"),
    subText:fitCheckoutDisplayText(rawShoutout.subText || "", caps, "sub"),
    submittedByUid:authContext.uid || "",
    submittedBy:text(authContext.token?.email || rawShoutout.submittedBy, 200).toLowerCase()
  };
  if (HEIST_ART_TEMPLATE_IDS.has(templateId)) {
    const heistClubId = text(rawShoutout.clubLocationId || rawShoutout.location || rawPayload.clubLocationId, 120);
    if (heistClubId !== HEIST_DC_LOCATION_ID) throw new HttpsError("failed-precondition", "Heist art templates are available only at Heist Washington DC.");
    return {
      ...rawPayload,
      clubLocationId:HEIST_DC_LOCATION_ID,
      shoutout:{
        ...shoutout,
        clubLocationId:HEIST_DC_LOCATION_ID,
        location:HEIST_DC_LOCATION_ID,
        screenFormatId:screenFormatId || "led-64x32",
        priceCents:HEIST_ART_PRICE_CENTS
      }
    };
  }
  if (templateId !== FOOTBALL_TEAM_INTRO_TEMPLATE_ID) return {...rawPayload, shoutout};
  const requestedClubId = text(rawShoutout.clubLocationId || rawShoutout.location || rawPayload.clubLocationId, 120);
  if (requestedClubId !== ZEBBIES_GARDEN_DC_LOCATION_ID) throw new HttpsError("failed-precondition", "The four-player football intro is available only at Zebbies Garden DC.");
  if (rawShoutout.photoPermissionConfirmed !== true) throw new HttpsError("failed-precondition", "Photo permission confirmation is required for all four people.");
  const teamMembers = normalizeFootballTeamMembers(rawShoutout.teamMembers, authContext.uid || "", caps.playerName || 14);
  return {
    ...rawPayload,
    clubLocationId:ZEBBIES_GARDEN_DC_LOCATION_ID,
    videoEnabled:false,
    shoutout:{
      ...shoutout,
      clubLocationId:ZEBBIES_GARDEN_DC_LOCATION_ID,
      location:ZEBBIES_GARDEN_DC_LOCATION_ID,
      mediaType:"team-intro",
      mediaUrl:teamMembers[0].mediaUrl,
      teamMembers,
      animationDurationSeconds:20,
      collaborationMode:"four-person-roster",
      stadiumMessage:text(rawShoutout.stadiumMessage || "TONIGHT, WE TAKE THE FIELD TOGETHER", caps.stadium || 54),
      skipFinaleLineup:rawShoutout.skipFinaleLineup === true || caps.skipFinaleLineup === true,
      colorTheme:text(rawShoutout.colorTheme, 40),
      themeAccent:text(rawShoutout.themeAccent, 20),
      backgroundColor:text(rawShoutout.backgroundColor, 20),
      backgroundUrl:safeHttpsMediaUrl(rawShoutout.backgroundUrl),
      photoPermissionConfirmed:true,
      priceCents:3000
    }
  };
}

function safeReturnBase(request) {
  const candidate = text(request?.data?.returnBase || request?.rawRequest?.headers?.origin || "", 500);
  try {
    const url = new URL(candidate);
    const production = new URL(`${DEFAULT_ORIGIN}/`);
    const productionPath = production.pathname.endsWith("/") ? production.pathname : `${production.pathname}/`;
    const hosted = url.protocol === "https:" && url.origin === production.origin && (url.pathname === productionPath.slice(0, -1) || url.pathname.startsWith(productionPath));
    const local = process.env.FUNCTIONS_EMULATOR === "true" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (hosted || local) {
      url.search = "";
      url.hash = "";
      if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
      return url.href;
    }
  } catch (error) {}
  return `${DEFAULT_ORIGIN}/`;
}

function moneyParts(amountCents, venuePercent = 0) {
  const gross = Math.max(0, Math.round(Number(amountCents || 0)));
  const venueShare = Math.round(gross * Math.max(0, Math.min(100, Number(venuePercent || 0))) / 100);
  return {gross, venueShare, floqrShare:gross - venueShare};
}

function normalizedServiceRole(value = "") {
  const role = String(value || "").toLowerCase();
  if (role.includes("promoter")) return "promoter";
  if (role.includes("dj")) return "dj";
  if (/hospitality|waitress|waiter|bottle|bartender/.test(role)) return "hospitality";
  if (/videographer|camera operator|cameraman|camera man|photographer|cinematographer|media ?creator/.test(role)) return "mediaCreator";
  return "";
}

async function isMasterAdminAuth(authContext = {}) {
  const uid = authContext.uid || "";
  const email = text(authContext.token?.email, 200).toLowerCase();
  if (!uid) return false;
  return authContext.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email);
}

async function canManageClubFinances(clubId, authContext = {}) {
  const uid = authContext.uid || "";
  const email = text(authContext.token?.email, 200).toLowerCase();
  if (!uid || !clubId) return false;
  if (await isMasterAdminAuth(authContext)) return true;
  const clubSnap = await db.collection("clubLocations").doc(clubId).get();
  if (!clubSnap.exists) return false;
  const club = clubSnap.data() || {};
  if ([...(club.adminUids || []), ...(club.masterAdminUids || [])].includes(uid)) return true;
  if ((club.adminEmails || []).map(value => String(value).toLowerCase()).includes(email)) return true;
  const assignmentId = `${clubId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const assignment = await db.collection("clubAdminAssignments").doc(assignmentId).get();
  return assignment.exists && text(assignment.data()?.status, 40).toLowerCase() === "active";
}

async function resolveConnectEntity(entityType, entityId, authContext) {
  const type = normalizeConnectEntityType(entityType);
  const id = text(entityId, 200);
  if (!type || !id) throw new HttpsError("invalid-argument", "Choose a valid FLOQR seller or club.");
  if (type === "member") {
    if (!authContext?.uid || id !== authContext.uid) throw new HttpsError("permission-denied", "Members can only configure their own payout account.");
    const snap = await db.collection("users").doc(id).get();
    if (!snap.exists) throw new HttpsError("failed-precondition", "Create your FLOQR profile before starting payout onboarding.");
    const row = snap.data() || {};
    return {
      entityType:type,
      entityId:id,
      displayName:text(row.commerceStoreName || row.displayName || row.fullName || "FLOQR member", 120),
      contactEmail:text(row.email || authContext.token?.email, 200)
    };
  }
  if (!await canManageClubFinances(id, authContext)) throw new HttpsError("permission-denied", "Club financial-admin access is required.");
  const snap = await db.collection("clubLocations").doc(id).get();
  if (!snap.exists) throw new HttpsError("not-found", "The FLOQR club record was not found.");
  const row = snap.data() || {};
  return {
    entityType:type,
    entityId:id,
    displayName:text(row.commerceStoreName || row.locationName || row.brandName || "FLOQR club", 120),
    contactEmail:text(row.email || authContext.token?.email, 200)
  };
}

function connectReturnUrls(request, entity) {
  const base = safeReturnBase(request);
  const page = entity.entityType === "club" ? "admin.html" : "patron-portal.html";
  const build = state => {
    const url = new URL(page, base);
    if (entity.entityType === "club") url.searchParams.set("location", entity.entityId);
    url.searchParams.set("connect", state);
    return url.href;
  };
  return {refreshUrl:build("refresh"), returnUrl:build("return")};
}

async function retrieveConnectAccount(accountId) {
  return stripeClient().v2.core.accounts.retrieve(accountId, {
    include:["configuration.recipient", "defaults", "identity", "requirements"]
  });
}

async function persistConnectStatus(bindingRef, entity, account, status) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  await bindingRef.set({
    accountId:account.id,
    entityType:entity.entityType,
    entityId:entity.entityId,
    capabilityStatus:status.capabilityStatus,
    transfersReady:status.transfersReady,
    requirementsDue:status.requirementsDue,
    livemode:status.livemode,
    updatedAt:now
  }, {merge:true});
}

async function trustedConnectRecipient(entityType, entityId) {
  const type = normalizeConnectEntityType(entityType);
  const id = text(entityId, 200);
  if (!type || !id) throw new HttpsError("invalid-argument", "A payout recipient is required for this purchase.");
  const bindingId = connectBindingId(type, id);
  const bindingRef = db.collection("stripeConnectAccounts").doc(bindingId);
  const bindingSnap = await bindingRef.get();
  const accountId = bindingSnap.exists ? text(bindingSnap.data()?.accountId, 160) : "";
  if (!accountId) throw new HttpsError("failed-precondition", "The recipient must finish Stripe payout onboarding before paid purchases can begin.");
  let account;
  try {
    account = await retrieveConnectAccount(accountId);
  } catch (error) {
    console.error("Stripe Connect account lookup failed", {bindingId, errorCode:error?.code || error?.type || "stripe_error"});
    throw new HttpsError("failed-precondition", "The recipient payout account could not be verified. Complete or refresh Stripe onboarding.");
  }
  if (account.metadata?.floqr_binding_id !== bindingId) {
    throw new HttpsError("failed-precondition", "The payout account binding could not be verified.");
  }
  const status = connectStatus(account);
  await persistConnectStatus(bindingRef, {entityType:type, entityId:id}, account, status);
  if (!status.transfersReady) {
    throw new HttpsError("failed-precondition", `The recipient Stripe transfer capability is ${status.capabilityStatus}. Complete payout onboarding before checkout.`);
  }
  return {accountId:account.id, bindingId, ...status};
}

async function canPublishForEntity(entityId, authContext = {}) {
  const uid = authContext.uid || "";
  const email = String(authContext.token?.email || "").toLowerCase();
  if (!uid || !entityId) return false;
  if (await isMasterAdminAuth(authContext)) return true;
  if (entityId.includes(":")) {
    const [memberUid, requestedRole] = entityId.split(":", 2);
    if (memberUid !== uid) return false;
    const userSnap = await db.collection("users").doc(uid).get();
    const approvedRoles = userSnap.exists && Array.isArray(userSnap.data()?.approvedRoles) ? userSnap.data().approvedRoles.map(normalizedServiceRole) : [];
    return approvedRoles.includes(normalizedServiceRole(requestedRole));
  }
  if (entityId === uid) return true;
  const clubSnap = await db.collection("clubLocations").doc(entityId).get();
  if (clubSnap.exists) {
    const club = clubSnap.data() || {};
    if ([...(club.adminUids || []), ...(club.masterAdminUids || [])].includes(uid)) return true;
    if ((club.adminEmails || []).map(value => String(value).toLowerCase()).includes(email)) return true;
  }
  const safeId = `${entityId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const [assignment, designation] = await Promise.all([
    db.collection("clubAdminAssignments").doc(safeId).get(),
    db.collection("clubEmployeeDesignations").doc(safeId).get()
  ]);
  if (assignment.exists && text(assignment.data()?.status, 40).toLowerCase() === "active") return true;
  if (!designation.exists || designation.data()?.status === "rejected") return false;
  const worker = designation.data() || {};
  return /club admin/i.test(worker.roleElectionType || "") || (worker.rolePermissions || []).some(permission => ["manageGuestLists", "postPublicContent"].includes(permission));
}

async function requirePublisher(entityId, authContext) {
  if (!await canPublishForEntity(entityId, authContext)) throw new HttpsError("permission-denied", "You are not approved to publish or purchase services for this entity.");
}

exports.getFloqrConnectStatus = onCall({
  region:"us-central1",
  secrets:[STRIPE_SECRET_KEY],
  timeoutSeconds:30,
  memory:"256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const entity = await resolveConnectEntity(request.data?.entityType, request.data?.entityId, request.auth);
  const bindingId = connectBindingId(entity.entityType, entity.entityId);
  const bindingRef = db.collection("stripeConnectAccounts").doc(bindingId);
  const bindingSnap = await bindingRef.get();
  const accountId = bindingSnap.exists ? text(bindingSnap.data()?.accountId, 160) : "";
  if (!accountId) return connectStatus(null);
  let account;
  try {
    account = await retrieveConnectAccount(accountId);
  } catch (error) {
    console.error("Stripe Connect status lookup failed", {bindingId, errorCode:error?.code || error?.type || "stripe_error"});
    throw new HttpsError("unavailable", "Stripe payout status is temporarily unavailable.");
  }
  if (account.metadata?.floqr_binding_id !== bindingId) throw new HttpsError("failed-precondition", "The payout account binding could not be verified.");
  const status = connectStatus(account);
  await persistConnectStatus(bindingRef, entity, account, status);
  return status;
});

exports.createFloqrConnectOnboardingLink = onCall({
  region:"us-central1",
  secrets:[STRIPE_SECRET_KEY],
  timeoutSeconds:30,
  memory:"256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const entity = await resolveConnectEntity(request.data?.entityType, request.data?.entityId, request.auth);
  const bindingId = connectBindingId(entity.entityType, entity.entityId);
  const bindingRef = db.collection("stripeConnectAccounts").doc(bindingId);
  const bindingSnap = await bindingRef.get();
  let accountId = bindingSnap.exists ? text(bindingSnap.data()?.accountId, 160) : "";
  let account;
  try {
    if (accountId) {
      account = await retrieveConnectAccount(accountId);
    } else {
      account = await stripeClient().v2.core.accounts.create(
        buildRecipientAccountParams({bindingId, ...entity}),
        {idempotencyKey:`floqr-connect-${bindingId}`}
      );
      accountId = account.id;
      await bindingRef.set({
        accountId,
        entityType:entity.entityType,
        entityId:entity.entityId,
        createdByUid:request.auth.uid,
        createdAt:admin.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }
  } catch (error) {
    console.error("Stripe Connect onboarding setup failed", {bindingId, errorCode:error?.code || error?.type || "stripe_error"});
    throw new HttpsError("internal", "Stripe could not start payout onboarding. Please try again.");
  }
  if (account.metadata?.floqr_binding_id !== bindingId) throw new HttpsError("failed-precondition", "The payout account binding could not be verified.");
  const status = connectStatus(account);
  await persistConnectStatus(bindingRef, entity, account, status);
  const urls = connectReturnUrls(request, entity);
  let link;
  try {
    link = await stripeClient().v2.core.accountLinks.create(buildAccountLinkParams({
      accountId,
      capabilityStatus:status.capabilityStatus,
      refreshUrl:urls.refreshUrl,
      returnUrl:urls.returnUrl
    }));
  } catch (error) {
    console.error("Stripe Connect account-link creation failed", {bindingId, errorCode:error?.code || error?.type || "stripe_error"});
    throw new HttpsError("internal", "Stripe could not create a secure onboarding link. Please try again.");
  }
  if (!link?.url || !/^https:\/\//i.test(link.url)) throw new HttpsError("internal", "Stripe did not return a secure onboarding link.");
  return {...status, onboardingUrl:link.url};
});

  async function describeOrder(type, payload = {}) {
  if (type === "shoutout") {
    const shoutout = payload.shoutout || {};
    const templateId = text(shoutout.template || shoutout.templateId, 80);
    const footballTeamIntro = templateId === FOOTBALL_TEAM_INTRO_TEMPLATE_ID;
    const heistArt = HEIST_ART_TEMPLATE_IDS.has(templateId);
    const pricedAmountCents = footballTeamIntro
      ? 3000
      : heistArt
        ? HEIST_ART_PRICE_CENTS
        : Math.max(0, Math.round(Number(shoutout.priceCents || payload.priceCents || 0)));
    if (!pricedAmountCents) {
      throw new HttpsError("failed-precondition", "This ShoutOut template does not require checkout. Submit it as a free ShoutOut.");
    }
    // Patron pays FloqR only. Clubs accrue a tracked share for reconciliation (not an instant Connect transfer).
    const split = moneyParts(pricedAmountCents, SHOUTOUT_CLUB_SHARE_PERCENT);
    const clubId = text(shoutout.clubLocationId || shoutout.location || payload.clubLocationId, 120);
    if (!clubId) throw new HttpsError("invalid-argument", "A club is required for a paid ShoutOut.");
    if (footballTeamIntro && clubId !== ZEBBIES_GARDEN_DC_LOCATION_ID) throw new HttpsError("failed-precondition", "The four-player football intro is available only at Zebbies Garden DC.");
    if (heistArt && clubId !== HEIST_DC_LOCATION_ID) throw new HttpsError("failed-precondition", "Heist art templates are available only at Heist Washington DC.");
    return {
      amountCents:pricedAmountCents,
      itemName:footballTeamIntro ? "Football Intro ShoutOut" : heistArt ? "Heist Art ShoutOut" : "FLOQR paid ShoutOut",
      description:"Payment is charged to FloqR. The host club accrues a 20% share for Account Reconciliation.",
      venueShareCents:split.venueShare,
      clubShareCents:split.venueShare,
      floqrShareCents:split.floqrShare,
      clubSharePercent:SHOUTOUT_CLUB_SHARE_PERCENT,
      paymentModel:"floqr-platform",
      settlementStatus:"accrued-pending-payout",
      clubLocationId:clubId
    };
  }

  if (type === "commerce") {
    const productId = text(payload.productId, 160);
    if (!productId) throw new HttpsError("invalid-argument", "A product is required.");
    const snap = await db.collection("commerceProducts").doc(productId).get();
    if (!snap.exists || snap.data()?.active === false) throw new HttpsError("not-found", "This product is unavailable.");
    const product = snap.data() || {};
    const quantity = Math.max(1, Math.min(10, Math.floor(Number(payload.quantity || 1))));
    const unitAmountCents = Math.max(50, Math.round(Number(product.priceCents || 0)));
    const amountCents = unitAmountCents * quantity;
    const sellerEntityId = text(product.sellerEntityId || product.sellerUid, 160);
    const sellerEntityType = normalizeConnectEntityType(product.sellerEntityType || (sellerEntityId === text(product.sellerUid, 160) ? "member" : "club"));
    if (!sellerEntityId || !sellerEntityType) throw new HttpsError("failed-precondition", "This product is missing a valid BartR seller.");
    const sellerCountry = text(product.sellerCountry || product.marketplaceCountry || "US", 80);
    const usOk = ["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america"].includes(sellerCountry.toLowerCase());
    if (product.marketplaceCountry && !usOk) throw new HttpsError("failed-precondition", "BartR marketplace selling is limited to U.S.-based vendors.");
    const {validateDjListing} = require("./dj-commerce-policy");
    const listingCheck = validateDjListing({
      productType: text(product.productType, 40),
      mixcloudUrl: text(product.mixcloudUrl, 500),
      externalPlaylistUrl: text(product.externalPlaylistUrl, 500),
      rightsCert: text(product.rightsCert, 80),
      downloadUrl: text(product.downloadUrl, 500)
    });
    if (!listingCheck.ok) {
      throw new HttpsError("failed-precondition", listingCheck.errors[0] || "This DJ/media listing is not eligible for checkout.");
    }
    // FloqR is MoR (same pattern as priced ShoutOuts). Vendor share accrues for payout; vendor fulfills.
    return {
      amountCents,
      venueShareCents:0,
      sellerShareCents:amountCents,
      floqrShareCents:0,
      quantity,
      unitAmountCents,
      itemName:text(product.name || "BartR marketplace item", 120),
      description:text(product.description || "Sold on BartR. FloqR collects payment; the vendor fulfills.", 300),
      sellerEntityId,
      sellerEntityType,
      sellerUid:text(product.sellerUid, 160),
      sellerName:text(product.sellerName || "BartR vendor", 120),
      paymentModel:"floqr-platform",
      settlementStatus:"accrued-pending-payout",
      marketplace:"bartr",
      productId,
      productType:text(product.productType || "physical", 40),
      mediaLicense:text(product.mediaLicense || "", 80),
      previewMediaType:text(product.previewMediaType || "image", 20),
      requiresShipping:product.requiresShipping !== false && text(product.productType, 40) === "physical",
      mixcloudUrl:text(product.mixcloudUrl, 500),
      externalPlaylistUrl:text(product.externalPlaylistUrl, 500),
      rightsCert:text(product.rightsCert, 80),
      productSnapshot:{
        name:text(product.name, 120),
        imageUrl:text(product.imageUrl, 500),
        productType:text(product.productType || "physical", 40),
        previewMediaType:text(product.previewMediaType || "image", 20),
        mediaLicense:text(product.mediaLicense || "", 80),
        mixcloudUrl:text(product.mixcloudUrl, 500),
        externalPlaylistUrl:text(product.externalPlaylistUrl, 500),
        sellerEntityId:text(product.sellerEntityId || product.sellerUid, 160),
        sellerName:text(product.sellerName, 120),
        priceCents:unitAmountCents,
        refundPolicy:text(product.refundPolicySnapshot || "", 500),
        contact:text(product.contactSnapshot || "", 200)
      }
    };
  }

  if (["targetedGuestList", "audienceCampaign"].includes(type)) {
    const targetUserCount = Math.max(1, Math.min(100000, Math.floor(Number(payload.targetUserCount || 0))));
    return {
      amountCents:targetUserCount * 10,
      itemName:type === "targetedGuestList" ? "Targeted FloqR guest-list distribution" : "Targeted FloqR campaign distribution",
      description:`Targeted delivery to ${targetUserCount.toLocaleString("en-US")} patrons at $0.10 per patron.`,
      targetUserCount,
      floqrShareCents:targetUserCount * 10,
      venueShareCents:0,
      clubLocationId:text(payload.clubLocationId, 120)
    };
  }

  if (type === "smsNotifications" || type === "smsMessageBundle") {
    const {packForOrderType} = require("./messaging-credits");
    const pack = packForOrderType(type);
    return {
      amountCents:pack.priceCents,
      itemName:type === "smsNotifications" ? "SMS Notification Services ($10)" : "SMS messaging bundle ($10)",
      description:pack.description,
      floqrShareCents:pack.floqrProfitCents,
      venueShareCents:0,
      messagingCredits:pack.messagesPerPack,
      messagingChannel:"sms",
      twilioBudgetCents:pack.twilioBudgetCents,
      clubLocationId:text(payload.clubLocationId, 120)
    };
  }

  if (type === "whatsappNotifications" || type === "whatsappMessageBundle") {
    const {packForOrderType} = require("./messaging-credits");
    const pack = packForOrderType(type);
    return {
      amountCents:pack.priceCents,
      itemName:type === "whatsappNotifications" ? "WhatsApp Notification Services ($10)" : "WhatsApp messaging bundle ($10)",
      description:pack.description,
      floqrShareCents:pack.floqrProfitCents,
      venueShareCents:0,
      messagingCredits:pack.messagesPerPack,
      messagingChannel:"whatsapp",
      twilioBudgetCents:pack.twilioBudgetCents,
      clubLocationId:text(payload.clubLocationId, 120)
    };
  }

  if (type === "rydrFare") {
    const fareCents = Math.max(50, Math.round(Number(payload.fareCents || 0)));
    if (!fareCents) throw new HttpsError("invalid-argument", "A RydR trip fare is required.");
    const clubId = text(payload.clubLocationId, 120);
    return {
      amountCents:fareCents,
      itemName:"RydR trip fare",
      description:"FLOQR RydR robotaxi trip fare. Payment is charged to FloqR via Stripe; vehicle dispatch remains simulated.",
      floqrShareCents:fareCents,
      venueShareCents:0,
      clubLocationId:clubId,
      paymentModel:"floqr-platform",
      pickupAddress:text(payload.pickupAddress, 300),
      destinationAddress:text(payload.destinationAddress, 300)
    };
  }
  throw new HttpsError("invalid-argument", "Unsupported FLOQR checkout type.");
}

function stripeLineItem(order) {
  const productData = {
    name:order.itemName,
    description:order.description || "FLOQR order"
  };
  if (order.productSnapshot?.imageUrl && /^https:\/\//i.test(order.productSnapshot.imageUrl)) {
    productData.images = [order.productSnapshot.imageUrl];
  }
  return {
    price_data:{currency:"usd", unit_amount:order.unitAmountCents || order.amountCents, product_data:productData},
    quantity:order.quantity || 1
  };
}

async function createOrderWithInventoryReservation(orderRef, order) {
  if (order.orderType !== "commerce") {
    await orderRef.set(order);
    return;
  }
  const productRef = db.collection("commerceProducts").doc(order.productId);
  const reservationExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + COMMERCE_RESERVATION_SECONDS * 1000);
  await db.runTransaction(async transaction => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists || productSnap.data()?.active === false) throw new HttpsError("not-found", "This product is unavailable.");
    const available = Math.max(0, Math.floor(Number(productSnap.data()?.inventory || 0)));
    const quantity = Math.max(1, Math.floor(Number(order.quantity || 1)));
    if (available < quantity) throw new HttpsError("resource-exhausted", "This item no longer has enough inventory for the requested quantity.");
    transaction.set(productRef, {
      inventory:available - quantity,
      reservedInventory:admin.firestore.FieldValue.increment(quantity),
      updatedAt:admin.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    transaction.set(orderRef, {
      ...order,
      inventoryReserved:true,
      inventoryCommitted:false,
      inventoryReservationStatus:"held",
      inventoryReservationExpiresAt:reservationExpiresAt
    });
  });
}

async function releaseCommerceInventoryReservation(orderId, reason) {
  const orderRef = db.collection("serviceOrders").doc(orderId);
  await db.runTransaction(async transaction => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) return;
    const order = orderSnap.data() || {};
    if (order.orderType !== "commerce" || order.inventoryReserved !== true || order.inventoryCommitted === true || order.inventoryReservationStatus === "released") return;
    const quantity = Math.max(1, Math.floor(Number(order.quantity || 1)));
    const productRef = db.collection("commerceProducts").doc(order.productId);
    const productSnap = await transaction.get(productRef);
    if (productSnap.exists) {
      const available = Math.max(0, Math.floor(Number(productSnap.data()?.inventory || 0)));
      const reserved = Math.max(0, Math.floor(Number(productSnap.data()?.reservedInventory || 0)));
      transaction.set(productRef, {
        inventory:available + quantity,
        reservedInventory:Math.max(0, reserved - quantity),
        updatedAt:admin.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }
    transaction.set(orderRef, {
      inventoryReserved:false,
      inventoryReservationStatus:"released",
      inventoryReleaseReason:text(reason, 80),
      inventoryReleasedAt:admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:admin.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  });
}

exports.createFloqrCheckoutSession = onCall({
  region:"us-central1",
  secrets:[STRIPE_SECRET_KEY],
  timeoutSeconds:30,
  memory:"256MiB"
}, async request => {
  const correlationId = text(request.data?.correlationId, 80) || `chk_${Date.now().toString(36)}`;
  const type = text(request.data?.orderType, 80);
  const logBase = {
    category:"checkout",
    correlationId,
    uid:request.auth?.uid || "",
    email:request.auth?.token?.email || "",
    details:{orderType:type}
  };
  try {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
    const rawPayload = request.data?.payload && typeof request.data.payload === "object" ? request.data.payload : {};
    const payload = normalizeCheckoutPayload(type, rawPayload, request.auth);
    if (type === "audienceCampaign") await requirePublisher(text(payload.entityId, 160), request.auth);
    if (["targetedGuestList", "smsNotifications", "smsMessageBundle", "whatsappNotifications", "whatsappMessageBundle"].includes(type)) {
      await requirePublisher(text(payload.clubLocationId, 160), request.auth);
    }
    const summary = await describeOrder(type, payload);
    const orderRef = db.collection("serviceOrders").doc();
    const returnBase = safeReturnBase(request);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const testFields = testPaymentFields(null, {});
    const order = {
      orderType:type,
      ownerUid:request.auth.uid,
      ownerEmail:text(request.auth.token?.email, 200),
      status:"checkout-created",
      paymentStatus:"unpaid",
      currency:"usd",
      ...summary,
      ...testFields,
      payload,
      correlationId,
      invoiceNumber:`FLOQR-${new Date().toISOString().slice(0,10).replace(/-/g, "")}-${orderRef.id.slice(0,8).toUpperCase()}`,
      shippingStatus:type === "commerce" && summary.requiresShipping ? "awaiting-payment" : type === "commerce" && summary.productType !== "physical" ? "digital-delivery-pending" : "not-required",
      createdAt:now,
      updatedAt:now
    };
    await createOrderWithInventoryReservation(orderRef, order);

    const rydrLoc = type === "rydrFare" ? text(payload.clubLocationId, 120) : "";
    const rydrLocQuery = rydrLoc ? `&location=${encodeURIComponent(rydrLoc)}` : "";
    const params = {
      mode:"payment",
      success_url:type === "rydrFare"
        ? `${returnBase}pickup.html?rydrPaid=1&order=${encodeURIComponent(orderRef.id)}${rydrLocQuery}&session_id={CHECKOUT_SESSION_ID}`
        : `${returnBase}payment-return.html?order=${encodeURIComponent(orderRef.id)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:type === "rydrFare"
        ? `${returnBase}pickup.html?rydrCancelled=1&order=${encodeURIComponent(orderRef.id)}${rydrLocQuery}`
        : `${returnBase}payment-return.html?order=${encodeURIComponent(orderRef.id)}&cancelled=1`,
      client_reference_id:orderRef.id,
      metadata:{orderId:orderRef.id, orderType:type, ownerUid:request.auth.uid, correlationId},
      billing_address_collection:"auto",
      payment_intent_data:{metadata:{orderId:orderRef.id, orderType:type, ownerUid:request.auth.uid, correlationId}},
      line_items:[stripeLineItem(order)]
    };
    if (order.ownerEmail) params.customer_email = order.ownerEmail;
    if (type === "commerce" && summary.requiresShipping) {
      params.shipping_address_collection = {allowed_countries:["US"]};
    }
    if (type === "commerce" || type === "shoutout") {
      params.expires_at = Math.floor(Date.now() / 1000) + (type === "commerce" ? COMMERCE_RESERVATION_SECONDS : SHOUTOUT_CHECKOUT_EXPIRY_SECONDS);
    }
    if (summary.connectedAccountId && type !== "commerce" && type !== "shoutout") {
      // Destination charges only for non-BartR / non-ShoutOut seller-billed products.
      params.payment_intent_data.transfer_data = {destination:summary.connectedAccountId};
      if (Number(summary.floqrShareCents || 0) > 0) {
        params.payment_intent_data.application_fee_amount = summary.floqrShareCents;
      }
    }
    let session;
    try {
      session = await stripeClient().checkout.sessions.create(params, {idempotencyKey:`floqr-checkout-${orderRef.id}`});
    } catch (error) {
      if (type === "commerce") await releaseCommerceInventoryReservation(orderRef.id, "checkout-session-create-failed");
      await orderRef.set({
        status:"checkout-failed",
        checkoutErrorCode:text(error?.code || error?.type || "stripe_error", 80),
        checkoutErrorMessage:text(error?.message || "stripe_error", 500),
        updatedAt:admin.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      await writeAppLog({
        ...logBase,
        level:"error",
        action:"stripe_session_create_failed",
        message:error?.message || "Stripe could not create checkout.",
        details:{...logBase.details, orderId:orderRef.id, ...callableErrorFields(error), stripeCode:error?.code || error?.type || ""}
      });
      throw new HttpsError("internal", "Stripe could not create checkout. Please try again.");
    }
    await orderRef.set({stripeCheckoutSessionId:session.id, checkoutUrl:session.url, updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
    await writeAppLog({
      ...logBase,
      level:"info",
      action:"checkout_session_created",
      message:`Checkout session created for ${summary.itemName || type}`,
      details:{...logBase.details, orderId:orderRef.id, amountCents:summary.amountCents, clubLocationId:summary.clubLocationId || "", template:text(payload?.shoutout?.template, 80)}
    });
    return {orderId:orderRef.id, checkoutUrl:session.url, amountCents:summary.amountCents, currency:"usd", correlationId};
  } catch (error) {
    if (!(error instanceof HttpsError)) {
      await writeAppLog({
        ...logBase,
        level:"error",
        action:"checkout_unexpected_failure",
        message:error?.message || "Unexpected checkout failure",
        details:{...logBase.details, ...callableErrorFields(error)}
      });
      throw new HttpsError("internal", "Checkout failed unexpectedly. Please try again.");
    }
    await writeAppLog({
      ...logBase,
      level:"error",
      action:"checkout_rejected",
      message:error.message,
      details:{...logBase.details, ...callableErrorFields(error), template:text(request.data?.payload?.shoutout?.template, 80), clubLocationId:text(request.data?.payload?.clubLocationId || request.data?.payload?.shoutout?.clubLocationId, 120)}
    });
    throw error;
  }
});

async function cancelUnpaidOrder(orderId, authContext, reason = "cancelled") {
  const id = text(orderId, 120);
  if (!id) throw new HttpsError("invalid-argument", "An order id is required.");
  const ref = db.collection("serviceOrders").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Checkout order was not found.");
  const order = snap.data() || {};
  const master = await isMasterAdminAuth(authContext);
  if (!master && order.ownerUid !== authContext.uid) throw new HttpsError("permission-denied", "You can only cancel your own unpaid checkout.");
  if (order.paymentStatus === "paid") throw new HttpsError("failed-precondition", "Paid orders cannot be cancelled from this tool.");
  if (!UNPAID_CLEARABLE_STATUSES.has(String(order.status || ""))) {
    throw new HttpsError("failed-precondition", `Order status ${order.status || "unknown"} cannot be cleared.`);
  }
  const sessionId = text(order.stripeCheckoutSessionId, 200);
  let stripeExpired = false;
  if (sessionId) {
    try {
      await stripeClient().checkout.sessions.expire(sessionId);
      stripeExpired = true;
    } catch (error) {
      // Already expired/completed sessions are fine to clear locally.
      console.warn("Stripe session expire skipped", {orderId:id, code:error?.code || error?.type || ""});
    }
  }
  if (order.orderType === "commerce" && order.inventoryReserved && !order.inventoryCommitted) {
    await releaseCommerceInventoryReservation(id, reason);
  }
  await ref.set({
    status:"checkout-cancelled",
    paymentStatus:"unpaid",
    cancelledAt:admin.firestore.FieldValue.serverTimestamp(),
    cancelledByUid:authContext.uid || "",
    cancelReason:text(reason, 120),
    stripeSessionExpired:stripeExpired,
    updatedAt:admin.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  await writeAppLog({
    level:"info",
    category:"checkout",
    action:"checkout_cancelled",
    message:`Cancelled unpaid checkout ${id}`,
    uid:authContext.uid || "",
    email:authContext.token?.email || "",
    details:{orderId:id, orderType:order.orderType || "", reason, stripeExpired, previousStatus:order.status || ""}
  });
  return {orderId:id, cancelled:true, stripeExpired};
}

exports.getFloqrClubCheckoutReadiness = onCall({
  region:"us-central1",
  secrets:[STRIPE_SECRET_KEY],
  timeoutSeconds:30,
  memory:"256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const clubLocationId = text(request.data?.clubLocationId, 120);
  if (!clubLocationId) throw new HttpsError("invalid-argument", "A club is required.");
  try {
    const recipient = await trustedConnectRecipient("club", clubLocationId);
    await writeAppLog({
      level:"info",
      category:"stripe",
      action:"club_checkout_readiness",
      message:`Club ${clubLocationId} is ready for paid checkout`,
      uid:request.auth.uid,
      email:request.auth.token?.email || "",
      details:{clubLocationId, capabilityStatus:recipient.capabilityStatus, transfersReady:true}
    });
    return {
      ready:true,
      transfersReady:true,
      capabilityStatus:recipient.capabilityStatus,
      livemode:!!recipient.livemode,
      clubLocationId
    };
  } catch (error) {
    const message = error?.message || "Club payouts are not ready.";
    await writeAppLog({
      level:"warn",
      category:"stripe",
      action:"club_checkout_not_ready",
      message,
      uid:request.auth.uid,
      email:request.auth.token?.email || "",
      details:{clubLocationId, ...callableErrorFields(error)}
    });
    return {
      ready:false,
      transfersReady:false,
      capabilityStatus:"unavailable",
      clubLocationId,
      message,
      code:error?.code || "failed-precondition"
    };
  }
});

exports.cancelFloqrCheckoutOrder = onCall({
  region:"us-central1",
  secrets:[STRIPE_SECRET_KEY],
  timeoutSeconds:30,
  memory:"256MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  return cancelUnpaidOrder(request.data?.orderId, request.auth, text(request.data?.reason, 120) || "user-cancelled");
});

exports.clearUnpaidFloqrCheckouts = onCall({
  region:"us-central1",
  secrets:[STRIPE_SECRET_KEY],
  timeoutSeconds:120,
  memory:"512MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (!await isMasterAdminAuth(request.auth)) throw new HttpsError("permission-denied", "Master admin access is required.");
  const snap = await db.collection("serviceOrders").where("paymentStatus", "==", "unpaid").limit(200).get();
  let cleared = 0;
  let skipped = 0;
  const errors = [];
  for (const doc of snap.docs) {
    const order = doc.data() || {};
    if (!UNPAID_CLEARABLE_STATUSES.has(String(order.status || ""))) {
      skipped += 1;
      continue;
    }
    try {
      await cancelUnpaidOrder(doc.id, request.auth, "master-admin-clear");
      cleared += 1;
    } catch (error) {
      skipped += 1;
      errors.push({orderId:doc.id, message:error?.message || String(error)});
    }
  }
  await writeAppLog({
    level:"info",
    category:"checkout",
    action:"bulk_clear_unpaid",
    message:`Master admin cleared ${cleared} unpaid checkout(s)`,
    uid:request.auth.uid,
    email:request.auth.token?.email || "",
    details:{cleared, skipped, errorCount:errors.length, errors:errors.slice(0, 20)}
  });
  return {cleared, skipped, errors:errors.slice(0, 20)};
});

exports.purgeFloqrTestPayments = onCall({
  region:"us-central1",
  secrets:[STRIPE_SECRET_KEY],
  timeoutSeconds:120,
  memory:"512MiB"
}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (!await isMasterAdminAuth(request.auth)) throw new HttpsError("permission-denied", "Master admin access is required.");

  const deleted = {paymentLedger:0, serviceOrders:0, shoutouts:0};
  const errors = [];
  const removedOrderIds = new Set();

  const ledgerSnap = await db.collection("paymentLedger").where("isTestPayment", "==", true).limit(300).get();
  for (const doc of ledgerSnap.docs) {
    try {
      const row = doc.data() || {};
      await doc.ref.delete();
      deleted.paymentLedger += 1;
      if (row.fulfilledRecordId) {
        try {
          await db.collection("shoutouts").doc(row.fulfilledRecordId).delete();
          deleted.shoutouts += 1;
        } catch (error) {
          errors.push({type:"shoutout", id:row.fulfilledRecordId, message:error?.message || String(error)});
        }
      }
      try {
        await db.collection("serviceOrders").doc(doc.id).delete();
        removedOrderIds.add(doc.id);
        deleted.serviceOrders += 1;
      } catch (error) {
        errors.push({type:"serviceOrder", id:doc.id, message:error?.message || String(error)});
      }
    } catch (error) {
      errors.push({type:"paymentLedger", id:doc.id, message:error?.message || String(error)});
    }
  }

  // Also clear unpaid/failed test checkouts that never reached the ledger.
  const unpaidSnap = await db.collection("serviceOrders").where("isTestPayment", "==", true).limit(300).get();
  for (const doc of unpaidSnap.docs) {
    if (removedOrderIds.has(doc.id)) continue;
    try {
      await doc.ref.delete();
      deleted.serviceOrders += 1;
    } catch (error) {
      errors.push({type:"serviceOrder", id:doc.id, message:error?.message || String(error)});
    }
  }

  await writeAppLog({
    level:"info",
    category:"checkout",
    action:"purge_test_payments",
    message:`Master admin purged Stripe test payments`,
    uid:request.auth.uid,
    email:request.auth.token?.email || "",
    details:{deleted, errorCount:errors.length, errors:errors.slice(0, 20)}
  });
  return {deleted, errors:errors.slice(0, 20)};
});

async function finalizePaidOrder(orderId, session) {
  const ref = db.collection("serviceOrders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const order = snap.data() || {};
  if (order.paymentStatus === "paid" && order.stripeFulfillmentComplete === true) return;
  const paidAt = order.paidAt || admin.firestore.FieldValue.serverTimestamp();
  const shipping = session?.shipping_details || session?.collected_information?.shipping_details || null;
  const testFields = testPaymentFields(session, order);
  await ref.set({
    status:"paid",
    paymentStatus:"paid",
    paidAt,
    updatedAt:paidAt,
    stripeCheckoutSessionId:session?.id || order.stripeCheckoutSessionId || "",
    stripePaymentIntentId:session?.payment_intent || "",
    customerEmail:session?.customer_details?.email || order.ownerEmail || "",
    shippingDetails:shipping || null,
    shippingStatus:order.orderType === "commerce" && order.requiresShipping ? "paid-awaiting-fulfillment" : order.shippingStatus,
    ...testFields
  }, {merge:true});

  if (order.orderType === "shoutout" && order.payload?.shoutout) {
    const shoutout = {...order.payload.shoutout};
    const shoutoutRef = db.collection("shoutouts").doc(`stripe_${orderId}`);
    const clubShareCents = Number(order.clubShareCents ?? order.venueShareCents ?? 0);
    const floqrShareCents = Number(order.floqrShareCents || 0);
    await shoutoutRef.set({
      ...shoutout,
      status:"pending",
      paymentRequired:true,
      paymentStatus:"paid",
      paymentModel:order.paymentModel || "floqr-platform",
      serviceOrderId:orderId,
      invoiceNumber:order.invoiceNumber || "",
      venueShareCents:clubShareCents,
      clubShareCents,
      floqrShareCents,
      clubSharePercent:Number(order.clubSharePercent || SHOUTOUT_CLUB_SHARE_PERCENT),
      submittedAt:paidAt,
      ...testFields
    }, {merge:true});
    await ref.set({
      fulfilledRecordId:shoutoutRef.id,
      fulfillmentStatus:"submitted-for-club-approval",
      clubShareCents,
      settlementStatus:order.settlementStatus || "accrued-pending-payout"
    }, {merge:true});
    await db.collection("paymentLedger").doc(orderId).set({
      orderId,
      orderType:"shoutout",
      paymentModel:order.paymentModel || "floqr-platform",
      clubLocationId:text(order.clubLocationId || shoutout.clubLocationId || shoutout.location, 120),
      ownerUid:text(order.ownerUid, 120),
      customerEmail:text(order.customerEmail || order.ownerEmail, 200),
      invoiceNumber:text(order.invoiceNumber, 80),
      itemName:text(order.itemName, 160),
      amountCents:Number(order.amountCents || 0),
      clubShareCents,
      floqrShareCents,
      clubSharePercent:Number(order.clubSharePercent || SHOUTOUT_CLUB_SHARE_PERCENT),
      currency:text(order.currency || "usd", 8) || "usd",
      paymentStatus:"paid",
      settlementStatus:order.settlementStatus || "accrued-pending-payout",
      fulfilledRecordId:shoutoutRef.id,
      stripeCheckoutSessionId:text(session?.id || order.stripeCheckoutSessionId, 200),
      stripePaymentIntentId:text(session?.payment_intent || order.stripePaymentIntentId, 200),
      paidAt,
      createdAt:paidAt,
      updatedAt:paidAt,
      ...testFields
    }, {merge:true});
  }

  if (order.orderType === "targetedGuestList" && order.payload?.campaign) {
    const campaignRef = db.collection("guestListCampaigns").doc(`stripe_${orderId}`);
    await campaignRef.set({
      ...order.payload.campaign,
      status:"enabled",
      active:true,
      audienceMode:"targetedFloqr",
      targetUserCount:order.targetUserCount || 0,
      distributionPriceCents:order.amountCents || 0,
      serviceOrderId:orderId,
      paidAt,
      createdAt:paidAt,
      updatedAt:paidAt
    }, {merge:true});
    await db.collection("audienceCampaigns").doc(`stripe_${orderId}`).set({
      campaignType:"guestList",
      sourceCampaignId:campaignRef.id,
      entityId:order.clubLocationId || "",
      ownerUid:order.ownerUid || "",
      audienceMode:"targetedFloqr",
      targetUserCount:order.targetUserCount || 0,
      amountCents:order.amountCents || 0,
      status:"paid-queued",
      createdAt:paidAt
    }, {merge:true});
    await ref.set({fulfilledRecordId:campaignRef.id, fulfillmentStatus:"targeting-queued"}, {merge:true});
  }

  if (order.orderType === "audienceCampaign") {
    const campaignRef = db.collection("audienceCampaigns").doc(`stripe_${orderId}`);
    await campaignRef.set({
      ...(order.payload?.campaign || {}),
      entityId:text(order.payload?.entityId, 160),
      ownerUid:order.ownerUid || "",
      audienceMode:"targetedFloqr",
      targetUserCount:order.targetUserCount || 0,
      amountCents:order.amountCents || 0,
      status:"paid-queued",
      serviceOrderId:orderId,
      createdAt:paidAt,
      updatedAt:paidAt
    }, {merge:true});
    await ref.set({fulfilledRecordId:campaignRef.id, fulfillmentStatus:"targeting-queued"}, {merge:true});
  }

  if (order.orderType === "commerce") {
    if (order.productId) {
      await db.runTransaction(async transaction => {
        const currentOrderSnap = await transaction.get(ref);
        const currentOrder = currentOrderSnap.data() || {};
        if (currentOrder.inventoryCommitted === true) return;
        const productRef = db.collection("commerceProducts").doc(order.productId);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists) {
          transaction.set(ref, {fulfillmentStatus:"inventory-review-required", inventoryCommitted:false}, {merge:true});
          return;
        }
        const stock = Number(productSnap.data()?.inventory || 0);
        const reserved = Number(productSnap.data()?.reservedInventory || 0);
        const quantity = Number(order.quantity || 1);
        if (currentOrder.inventoryReserved === true && currentOrder.inventoryReservationStatus === "held") {
          transaction.set(productRef, {reservedInventory:Math.max(0, reserved - quantity), updatedAt:paidAt}, {merge:true});
          transaction.set(ref, {
            fulfillmentStatus:"seller-action-required",
            inventoryCommitted:true,
            inventoryReserved:false,
            inventoryReservationStatus:"committed",
            inventoryStatus:"committed"
          }, {merge:true});
        } else {
          transaction.set(productRef, {inventory:Math.max(0, stock - quantity), updatedAt:paidAt}, {merge:true});
          transaction.set(ref, {fulfillmentStatus:"seller-action-required", inventoryCommitted:true, inventoryStatus:stock >= quantity ? "committed" : "oversold-review-required"}, {merge:true});
        }
      });
    } else await ref.set({fulfillmentStatus:"seller-action-required", inventoryCommitted:false}, {merge:true});
  }

  if (order.orderType === "smsNotifications" && order.clubLocationId) {
    await db.collection("clubNotificationSettings").doc(order.clubLocationId).set({smsEnabled:true, smsServiceOrderId:orderId, smsPaidAt:paidAt, updatedAt:paidAt}, {merge:true});
    await ref.set({fulfillmentStatus:"sms-enabled"}, {merge:true});
  }

  if (["smsNotifications", "smsMessageBundle", "whatsappNotifications", "whatsappMessageBundle"].includes(order.orderType) && order.clubLocationId) {
    const {packForOrderType, creditField, purchasedField} = require("./messaging-credits");
    const pack = packForOrderType(order.orderType);
    if (pack) {
      const credits = Math.max(0, Math.floor(Number(order.messagingCredits || pack.messagesPerPack || 0)));
      const balanceKey = creditField(pack.channel);
      const purchasedKey = purchasedField(pack.channel);
      const creditRef = db.collection("clubMessagingCredits").doc(order.clubLocationId);
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(creditRef);
        const data = snap.exists ? snap.data() || {} : {};
        if (data.lastCreditedOrderId === orderId) return;
        const nextBalance = Math.max(0, Math.floor(Number(data[balanceKey] || 0))) + credits;
        const nextPurchased = Math.max(0, Math.floor(Number(data[purchasedKey] || 0))) + credits;
        const patch = {
          clubLocationId:order.clubLocationId,
          [balanceKey]:nextBalance,
          [purchasedKey]:nextPurchased,
          lastCreditedOrderId:orderId,
          lastPackChannel:pack.channel,
          lastPackCredits:credits,
          updatedAt:paidAt
        };
        if (pack.channel === "sms") {
          patch.smsServiceEnabled = true;
          patch.smsLastPaidAt = paidAt;
        } else {
          patch.whatsappServiceEnabled = true;
          patch.whatsappLastPaidAt = paidAt;
        }
        transaction.set(creditRef, patch, {merge:true});
      });
      if (pack.channel === "whatsapp") {
        await db.collection("clubNotificationSettings").doc(order.clubLocationId).set({
          whatsappEnabled:true,
          whatsappServiceOrderId:orderId,
          whatsappPaidAt:paidAt,
          updatedAt:paidAt
        }, {merge:true});
      }
      await ref.set({
        fulfillmentStatus:pack.channel === "sms" ? "sms-credits-granted" : "whatsapp-credits-granted",
        messagingCreditsGranted:credits,
        messagingChannel:pack.channel
      }, {merge:true});
    }
  }
  await ref.set({stripeFulfillmentComplete:true, fulfilledAt:paidAt, updatedAt:paidAt}, {merge:true});
}

async function claimStripeWebhookEvent(event) {
  const eventId = text(event?.id, 160);
  if (!eventId) throw new Error("Stripe webhook event ID is missing.");
  const ref = db.collection("stripeWebhookEvents").doc(eventId);
  const now = admin.firestore.Timestamp.now();
  const claimed = await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const existing = snap.exists ? snap.data() || {} : {};
    if (existing.status === "processed") return false;
    const startedAt = existing.processingStartedAt?.toMillis?.() || 0;
    if (existing.status === "processing" && Date.now() - startedAt < 5 * 60 * 1000) return false;
    transaction.set(ref, {
      eventType:text(event.type, 120),
      stripeCreated:Number(event.created || 0),
      status:"processing",
      processingStartedAt:now,
      attempts:admin.firestore.FieldValue.increment(1),
      updatedAt:now
    }, {merge:true});
    return true;
  });
  return {claimed, ref};
}

async function updateCheckoutOrderStatus(session, patch = {}) {
  const orderId = text(session?.metadata?.orderId || session?.client_reference_id, 160);
  if (!orderId) return;
  const ref = db.collection("serviceOrders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.paymentStatus === "paid") return;
  await ref.set({...patch, stripeCheckoutSessionId:session?.id || "", updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
}

async function orderRefForStripeFinancialObject(object = {}) {
  const metadataOrderId = text(object.metadata?.orderId, 160);
  if (metadataOrderId) return db.collection("serviceOrders").doc(metadataOrderId);
  const paymentIntentId = text(object.payment_intent, 160);
  if (!paymentIntentId) return null;
  const snap = await db.collection("serviceOrders").where("stripePaymentIntentId", "==", paymentIntentId).limit(1).get();
  return snap.empty ? null : snap.docs[0].ref;
}

async function recordRefundEvent(charge = {}) {
  const ref = await orderRefForStripeFinancialObject(charge);
  if (!ref) return;
  const snap = await ref.get();
  if (!snap.exists) return;
  const order = snap.data() || {};
  const amount = Math.max(0, Math.round(Number(charge.amount || order.amountCents || 0)));
  const amountRefunded = Math.max(0, Math.round(Number(charge.amount_refunded || 0)));
  const fullyRefunded = charge.refunded === true || (amount > 0 && amountRefunded >= amount);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    status:fullyRefunded ? "refunded" : "partially-refunded",
    paymentStatus:fullyRefunded ? "refunded" : "partially-refunded",
    stripeChargeId:text(charge.id, 160),
    refundAmountCents:amountRefunded,
    refundStatus:fullyRefunded ? "full" : "partial",
    payoutRecoveryStatus:order.connectedAccountId ? "manual-transfer-reversal-review" : "not-applicable",
    refundedAt:now,
    updatedAt:now
  }, {merge:true});
}

async function recordDisputeEvent(dispute = {}, eventType = "") {
  const ref = await orderRefForStripeFinancialObject(dispute);
  if (!ref) return;
  const snap = await ref.get();
  if (!snap.exists) return;
  const order = snap.data() || {};
  const stripeStatus = text(dispute.status || "needs_response", 80);
  const closed = eventType === "charge.dispute.closed";
  const won = closed && stripeStatus === "won";
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    status:closed ? (won ? "paid" : "dispute-lost") : "disputed",
    paymentStatus:closed ? (won ? "paid" : "disputed") : "disputed",
    stripeDisputeId:text(dispute.id, 160),
    disputeAmountCents:Math.max(0, Math.round(Number(dispute.amount || 0))),
    disputeReason:text(dispute.reason, 120),
    disputeStatus:stripeStatus,
    payoutRecoveryStatus:order.connectedAccountId ? "manual-transfer-reversal-review" : "not-applicable",
    disputeUpdatedAt:now,
    updatedAt:now
  }, {merge:true});
}

exports.stripeFloqrWebhook = onRequest({
  region:"us-central1",
  secrets:[STRIPE_WEBHOOK_SECRET],
  timeoutSeconds:30,
  memory:"256MiB"
}, async (request, response) => {
  const raw = request.rawBody;
  const signature = request.headers["stripe-signature"];
  let event;
  try {
    if (!raw) throw new Error("Raw request body is unavailable.");
    event = Stripe.webhooks.constructEvent(raw, signature, STRIPE_WEBHOOK_SECRET.value(), 300);
  } catch (error) {
    response.status(400).send("Invalid Stripe signature");
    return;
  }
  const claim = await claimStripeWebhookEvent(event);
  if (!claim.claimed) {
    response.json({received:true, duplicate:true});
    return;
  }
  try {
    const session = event.data?.object || {};
    const orderId = text(session.metadata?.orderId || session.client_reference_id, 160);
    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      if (session.payment_status === "paid" && orderId) await finalizePaidOrder(orderId, session);
      else await updateCheckoutOrderStatus(session, {status:"payment-processing", paymentStatus:"processing"});
    } else if (event.type === "checkout.session.async_payment_failed") {
      await updateCheckoutOrderStatus(session, {status:"payment-failed", paymentStatus:"failed"});
      if (orderId) await releaseCommerceInventoryReservation(orderId, "async-payment-failed");
    } else if (event.type === "checkout.session.expired") {
      await updateCheckoutOrderStatus(session, {status:"checkout-expired", paymentStatus:"unpaid"});
      if (orderId) await releaseCommerceInventoryReservation(orderId, "checkout-session-expired");
    } else if (event.type === "charge.refunded") {
      await recordRefundEvent(session);
    } else if (["charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"].includes(event.type)) {
      await recordDisputeEvent(session, event.type);
    }
    await claim.ref.set({status:"processed", processedAt:admin.firestore.FieldValue.serverTimestamp(), updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
    response.json({received:true});
  } catch (error) {
    await claim.ref.set({status:"failed", errorCode:text(error?.code || error?.name || "processing_error", 80), updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
    console.error("Stripe webhook processing failed", {eventId:event.id, eventType:event.type, errorCode:error?.code || error?.name || "processing_error"});
    response.status(500).send("Webhook processing failed");
  }
});

exports.expireLiveShoutouts = onSchedule({
  region:"us-central1",
  schedule:"every 1 minutes",
  timeZone:"UTC",
  timeoutSeconds:60,
  memory:"256MiB"
}, async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - LIVE_SHOUTOUT_DURATION_MS);
  const expired = await db.collection("liveContent").where("approvedAt", "<=", cutoff).limit(200).get();
  if (expired.empty) return;
  const batch = db.batch();
  const expiredAt = admin.firestore.FieldValue.serverTimestamp();
  expired.docs.forEach(doc => {
    const data = doc.data() || {};
    const clubName = text(data.locationName || data.brandName || doc.id, 80).toUpperCase();
    const configuredDefault = text(data.defaultMain, 45).replace(/USE SHOUT\s*OUT/i, "USE SHOUTOUT");
    batch.set(doc.ref, {
      template:"blackwhite",
      templateName:"Traditional Black and White ShoutOut",
      mainText:configuredDefault || `USE SHOUTOUT @ ${clubName}`,
      subText:"",
      mediaUrl:"",
      mediaType:"",
      mediaFileName:"",
      mediaStoragePath:"",
      teamMembers:[],
      status:"default",
      source:"automaticTenMinuteReset",
      previousReferenceNumber:text(data.referenceNumber, 120),
      referenceNumber:"",
      approvedAt:admin.firestore.FieldValue.delete(),
      displayDurationSeconds:admin.firestore.FieldValue.delete(),
      expiredAt,
      updatedAt:expiredAt
    }, {merge:true});
  });
  await batch.commit();
});

exports.publishFloqrFollowerCampaign = onCall({region:"us-central1", timeoutSeconds:30, memory:"256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const entityId = text(request.data?.entityId, 160);
  const campaign = request.data?.campaign && typeof request.data.campaign === "object" ? request.data.campaign : {};
  if (!entityId || !text(campaign.title, 160)) throw new HttpsError("invalid-argument", "Entity and campaign title are required.");
  await requirePublisher(entityId, request.auth);
  const follows = await db.collection("entityFollows").where("entityId", "==", entityId).where("active", "==", true).limit(450).get();
  const campaignRef = db.collection("audienceCampaigns").doc();
  const batch = db.batch();
  const createdAt = admin.firestore.FieldValue.serverTimestamp();
  batch.set(campaignRef, {
    ...campaign,
    entityId,
    ownerUid:request.auth.uid,
    audienceMode:"followers",
    deliveredCount:follows.size,
    amountCents:0,
    status:"published",
    createdAt,
    updatedAt:createdAt
  });
  follows.docs.forEach(follow => {
    const data = follow.data() || {};
    if (!data.followerUid) return;
    const noteRef = db.collection("inboxNotifications").doc();
    batch.set(noteRef, {
      recipientUid:data.followerUid,
      type:"entityCampaign",
      title:text(campaign.title, 160),
      body:text(campaign.body || campaign.description, 1500),
      entityId,
      campaignId:campaignRef.id,
      link:text(campaign.link, 500),
      read:false,
      createdAt
    });
  });
  await batch.commit();
  return {campaignId:campaignRef.id, deliveredCount:follows.size, amountCents:0};
});

exports.requestTeslaRobotaxiPickup = onCall({region:"us-central1", timeoutSeconds:15, memory:"256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const pickupAddress = text(request.data?.pickupAddress, 300);
  const destinationAddress = text(request.data?.destinationAddress, 300);
  if (!pickupAddress || !destinationAddress) throw new HttpsError("invalid-argument", "Pickup and destination addresses are required.");
  const ref = await db.collection("pickupRequests").add({
    provider:"teslaRobotaxi",
    requesterUid:request.auth.uid,
    requesterEmail:text(request.auth.token?.email, 200),
    pickupAddress,
    destinationAddress,
    clubLocationId:text(request.data?.clubLocationId, 120),
    status:"provider-handoff-required",
    providerApiStatus:"no-public-ride-hailing-api",
    providerUrl:"https://www.tesla.com/robotaxi",
    createdAt:admin.firestore.FieldValue.serverTimestamp()
  });
  return {
    requestId:ref.id,
    status:"provider-handoff-required",
    message:"Tesla does not currently publish a third-party Robotaxi ride-booking API. Complete the ride request in Tesla's official Robotaxi app.",
    providerUrl:"https://www.tesla.com/robotaxi"
  };
});

exports.seedLucyCobraBartrCatalog = onCall({region:"us-central1", timeoutSeconds:60, memory:"512MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (!await isMasterAdminAuth(request.auth)) throw new HttpsError("permission-denied", "Master Admin required.");

  if (request.data?.sellerUid) {
    const forced = text(request.data.sellerUid, 160);
    const snap = await db.collection("users").doc(forced).get();
    if (!snap.exists) throw new HttpsError("not-found", "Forced sellerUid not found.");
    var seller = {uid: forced, ...snap.data()};
  } else {
    const needles = String(request.data?.query || "lucy|cobra").toLowerCase().split("|").map(x => x.trim()).filter(Boolean);
    const usersSnap = await db.collection("users").limit(500).get();
    const shoutoutsSnap = await db.collection("shoutouts").limit(500).get();
    seller = null;
    for (const doc of shoutoutsSnap.docs) {
      const row = doc.data() || {};
      const blob = `${row.submittedBy || ""} ${row.displayName || ""} ${row.patronName || ""} ${row.mainText || ""} ${row.subText || ""}`.toLowerCase();
      if (!needles.some(n => blob.includes(n))) continue;
      const uid = row.submittedByUid;
      if (!uid) continue;
      const userSnap = await db.collection("users").doc(uid).get();
      if (userSnap.exists) { seller = {uid, ...userSnap.data()}; break; }
    }
    if (!seller) {
      for (const doc of usersSnap.docs) {
        const row = {uid: doc.id, ...doc.data()};
        const blob = `${row.displayName || ""} ${row.fullName || ""} ${row.username || ""} ${row.email || ""}`.toLowerCase();
        if (needles.some(n => blob.includes(n))) { seller = row; break; }
      }
    }
    if (!seller?.uid) throw new HttpsError("not-found", "No user matching Lucy/Cobra found. Pass { sellerUid }.");
  }

  const storeName = text(seller.commerceStoreName || `${seller.displayName || seller.username || "Lucy Cobra"} Arts`, 120);
  await db.collection("users").doc(seller.uid).set({
    country: "United States",
    commerceEnabled: true,
    commerceStoreName: storeName,
    commerceContact: text(seller.email || request.auth.token?.email || "arts@floqr.app", 200),
    commerceRefundPolicy: "Unused physical art items may be returned within 14 days unused and in original packaging. Custom commissions are final sale.",
    publicProfileVisibility: seller.publicProfileVisibility || "public",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});

  const catalog = [
    {name:"Sunset Over Dupont (oil)", category:"Artwork", productType:"physical", priceCents:18500, desc:"Original oil painting, 16x20 framed."},
    {name:"Neon Corridor Study", category:"Artwork", productType:"physical", priceCents:9200, desc:"Acrylic on canvas nightlife study."},
    {name:"Mediterranean Rooftop Light", category:"Artwork", productType:"physical", priceCents:12400, desc:"Watercolor inspired by rooftop evenings."},
    {name:"Abstract Bassline #3", category:"Artwork", productType:"physical", priceCents:7800, desc:"Mixed media abstract for lounge walls."},
    {name:"Portrait: Midnight Patron", category:"Artwork", productType:"physical", priceCents:21000, desc:"Charcoal portrait series print + frame option."},
    {name:"Gold Leaf Mini Series (set of 3)", category:"Artwork", productType:"physical", priceCents:6500, desc:"Three small gold-leaf panels."},
    {name:"Club Geometry Print", category:"Artwork", productType:"physical", priceCents:4500, desc:"Limited giclee print, signed."},
    {name:"City Rain Reflections", category:"Artwork", productType:"physical", priceCents:9900, desc:"Oil on board, urban night rain."},
    {name:"Hammered Brass Cuff", category:"Jewelry", productType:"physical", priceCents:6800, desc:"Hand-hammered brass cuff bracelet."},
    {name:"Resin Drop Earrings", category:"Jewelry", productType:"physical", priceCents:3200, desc:"Lightweight resin and gold-tone earrings."},
    {name:"Beaded Night Collar", category:"Jewelry", productType:"physical", priceCents:5400, desc:"Statement beaded collar necklace."},
    {name:"Silver Stack Ring Set", category:"Jewelry", productType:"physical", priceCents:4100, desc:"Three textured sterling-finish rings."},
    {name:"Enamel Pin: Throw a ShoutOut", category:"Jewelry", productType:"physical", priceCents:1800, desc:"Hard enamel pin for jackets and bags."},
    {name:"Gallery Float Frame 16x20", category:"Art accessories", productType:"physical", priceCents:5200, desc:"Black gallery float frame, ready to hang."},
    {name:"Walnut Shadow Box Frame", category:"Art accessories", productType:"physical", priceCents:7400, desc:"Deep walnut shadow box for mixed media."},
    {name:"Pro Acrylic Brush Set (12)", category:"Art accessories", productType:"physical", priceCents:3600, desc:"Synthetic brush set for acrylic and oil."},
    {name:"Palette Knife Kit", category:"Art accessories", productType:"physical", priceCents:2800, desc:"Five stainless palette knives."},
    {name:"Artist Travel Case", category:"Art accessories", productType:"physical", priceCents:8900, desc:"Compact hard case for brushes and tubes."},
    {name:"Linen Canvas Pack (5)", category:"Art accessories", productType:"physical", priceCents:4700, desc:"Pre-stretched linen canvases, assorted."},
    {name:"Archival Print Sleeve Bundle", category:"Art accessories", productType:"physical", priceCents:2200, desc:"Acid-free sleeves for print editions."}
  ];

  const svgFor = (title, accent) => {
    const t = String(title || "Art").slice(0, 28).replace(/[<>&]/g, "");
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#14121c"/><circle cx="180" cy="160" r="140" fill="${accent}" opacity=".35"/><circle cx="420" cy="420" r="160" fill="#ff64d8" opacity=".25"/><text x="300" y="300" fill="#fff" font-size="28" text-anchor="middle" font-family="Georgia, serif">${t}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(raw)}`;
  };
  const accents = ["#dfff5a", "#7ad7ff", "#ffb347", "#c4a1ff", "#ff6b9d"];
  const existing = await db.collection("commerceProducts").where("sellerUid", "==", seller.uid).limit(50).get();
  const existingNames = new Set(existing.docs.map(d => String((d.data() || {}).name || "").toLowerCase()));
  const created = [];
  const now = admin.firestore.FieldValue.serverTimestamp();
  for (let i = 0; i < catalog.length; i += 1) {
    const item = catalog[i];
    if (existingNames.has(item.name.toLowerCase())) continue;
    const ref = db.collection("commerceProducts").doc();
    await ref.set({
      sellerEntityId: seller.uid,
      sellerEntityType: "member",
      sellerUid: seller.uid,
      sellerName: storeName,
      sellerCountry: "United States",
      marketplaceCountry: "US",
      marketplace: "bartr",
      name: item.name,
      category: item.category,
      productType: item.productType,
      previewMediaType: "image",
      mediaLicense: "",
      priceCents: item.priceCents,
      inventory: 8 + (i % 5),
      imageUrl: svgFor(item.name, accents[i % accents.length]),
      description: item.desc,
      requiresShipping: true,
      active: true,
      refundPolicySnapshot: "Unused physical art items may be returned within 14 days unused and in original packaging.",
      contactSnapshot: text(seller.email || "", 200),
      seededBy: "seedLucyCobraBartrCatalog",
      createdAt: now,
      updatedAt: now
    });
    created.push({id: ref.id, name: item.name, priceCents: item.priceCents});
  }

  return {
    sellerUid: seller.uid,
    sellerName: storeName,
    commerceEnabled: true,
    productsCreated: created.length,
    productsSkippedExisting: catalog.length - created.length,
    products: created
  };
});

exports.seedDcSpotAdPool = onCall({region:"us-central1", timeoutSeconds:60, memory:"256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  if (!await isMasterAdminAuth(request.auth)) throw new HttpsError("permission-denied", "Master Admin required.");
  const campaigns = Array.isArray(request.data?.campaigns) ? request.data.campaigns : [];
  if (!campaigns.length) throw new HttpsError("invalid-argument", "Pass campaigns[] from FLOQRDcSpotAds.");
  const batch = db.batch();
  let n = 0;
  for (const row of campaigns.slice(0, 40)) {
    const id = text(row.id, 120);
    if (!id) continue;
    batch.set(db.collection("spotAdCampaigns").doc(id), {
      ...row,
      status: "active",
      seededBy: "seedDcSpotAdPool",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    n += 1;
  }
  await batch.commit();
  return {seeded: n};
});

/** HTTP seed so BartR can be filled without a callable auth session. Creates demo seller if Lucy/Cobra missing. */
exports.seedLucyCobraBartrCatalogHttp = onRequest({
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "512MiB",
  cors: true
}, async (req, res) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({ok: false, error: "Method not allowed"});
      return;
    }
    const DEMO_UID = "lucy-cobra-arts";
    let seller = null;
    const needles = ["lucy", "cobra"];
    const shoutoutsSnap = await db.collection("shoutouts").limit(500).get();
    for (const doc of shoutoutsSnap.docs) {
      const row = doc.data() || {};
      const blob = `${row.submittedBy || ""} ${row.displayName || ""} ${row.patronName || ""} ${row.mainText || ""} ${row.subText || ""}`.toLowerCase();
      if (!needles.some(n => blob.includes(n))) continue;
      const uid = row.submittedByUid;
      if (!uid) continue;
      const userSnap = await db.collection("users").doc(uid).get();
      if (userSnap.exists) {
        seller = {uid, ...userSnap.data()};
        break;
      }
    }
    if (!seller) {
      const usersSnap = await db.collection("users").limit(500).get();
      for (const doc of usersSnap.docs) {
        const row = {uid: doc.id, ...doc.data()};
        const blob = `${row.displayName || ""} ${row.fullName || ""} ${row.username || ""} ${row.email || ""}`.toLowerCase();
        if (needles.some(n => blob.includes(n))) {
          seller = row;
          break;
        }
      }
    }
    if (!seller?.uid) {
      seller = {
        uid: DEMO_UID,
        displayName: "Lucy Cobra",
        username: "lucycobra",
        email: "bans.don@gmail.com"
      };
    }
    const storeName = text(seller.commerceStoreName || `${seller.displayName || "Lucy Cobra"} Arts`, 120);
    await db.collection("users").doc(seller.uid).set({
      displayName: seller.displayName || "Lucy Cobra",
      username: seller.username || "lucycobra",
      email: seller.email || "bans.don@gmail.com",
      country: "United States",
      commerceEnabled: true,
      commerceStoreName: storeName,
      commerceContact: text(seller.email || "bans.don@gmail.com", 200),
      commerceRefundPolicy: "Unused physical art items may be returned within 14 days unused and in original packaging. Custom commissions are final sale.",
      publicProfileVisibility: "public",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});

    const catalog = [
      {name:"Sunset Over Dupont (oil)", category:"Artwork", productType:"physical", priceCents:18500, desc:"Original oil painting, 16x20 framed."},
      {name:"Neon Corridor Study", category:"Artwork", productType:"physical", priceCents:9200, desc:"Acrylic on canvas nightlife study."},
      {name:"Mediterranean Rooftop Light", category:"Artwork", productType:"physical", priceCents:12400, desc:"Watercolor inspired by rooftop evenings."},
      {name:"Abstract Bassline #3", category:"Artwork", productType:"physical", priceCents:7800, desc:"Mixed media abstract for lounge walls."},
      {name:"Portrait: Midnight Patron", category:"Artwork", productType:"physical", priceCents:21000, desc:"Charcoal portrait series print + frame option."},
      {name:"Gold Leaf Mini Series (set of 3)", category:"Artwork", productType:"physical", priceCents:6500, desc:"Three small gold-leaf panels."},
      {name:"Club Geometry Print", category:"Artwork", productType:"physical", priceCents:4500, desc:"Limited giclee print, signed."},
      {name:"City Rain Reflections", category:"Artwork", productType:"physical", priceCents:9900, desc:"Oil on board, urban night rain."},
      {name:"Hammered Brass Cuff", category:"Jewelry", productType:"physical", priceCents:6800, desc:"Hand-hammered brass cuff bracelet."},
      {name:"Resin Drop Earrings", category:"Jewelry", productType:"physical", priceCents:3200, desc:"Lightweight resin and gold-tone earrings."},
      {name:"Beaded Night Collar", category:"Jewelry", productType:"physical", priceCents:5400, desc:"Statement beaded collar necklace."},
      {name:"Silver Stack Ring Set", category:"Jewelry", productType:"physical", priceCents:4100, desc:"Three textured sterling-finish rings."},
      {name:"Enamel Pin: Throw a ShoutOut", category:"Jewelry", productType:"physical", priceCents:1800, desc:"Hard enamel pin for jackets and bags."},
      {name:"Gallery Float Frame 16x20", category:"Art accessories", productType:"physical", priceCents:5200, desc:"Black gallery float frame, ready to hang."},
      {name:"Walnut Shadow Box Frame", category:"Art accessories", productType:"physical", priceCents:7400, desc:"Deep walnut shadow box for mixed media."},
      {name:"Pro Acrylic Brush Set (12)", category:"Art accessories", productType:"physical", priceCents:3600, desc:"Synthetic brush set for acrylic and oil."},
      {name:"Palette Knife Kit", category:"Art accessories", productType:"physical", priceCents:2800, desc:"Five stainless palette knives."},
      {name:"Artist Travel Case", category:"Art accessories", productType:"physical", priceCents:8900, desc:"Compact hard case for brushes and tubes."},
      {name:"Linen Canvas Pack (5)", category:"Art accessories", productType:"physical", priceCents:4700, desc:"Pre-stretched linen canvases, assorted."},
      {name:"Archival Print Sleeve Bundle", category:"Art accessories", productType:"physical", priceCents:2200, desc:"Acid-free sleeves for print editions."}
    ];

    const existing = await db.collection("commerceProducts").where("sellerUid", "==", seller.uid).limit(50).get();
    const existingNames = new Set(existing.docs.map(d => String((d.data() || {}).name || "").toLowerCase()));
    const created = [];
    const now = admin.firestore.FieldValue.serverTimestamp();
    for (let i = 0; i < catalog.length; i += 1) {
      const item = catalog[i];
      if (existingNames.has(item.name.toLowerCase())) continue;
      const ref = db.collection("commerceProducts").doc();
      const accent = encodeURIComponent(["dfff5a", "7ad7ff", "ffb347", "c4a1ff", "ff6b9d"][i % 5]);
      const label = encodeURIComponent(item.name.slice(0, 28));
      await ref.set({
        sellerEntityId: seller.uid,
        sellerEntityType: "member",
        sellerUid: seller.uid,
        sellerName: storeName,
        sellerCountry: "United States",
        marketplaceCountry: "US",
        marketplace: "bartr",
        name: item.name,
        category: item.category,
        productType: item.productType,
        previewMediaType: "image",
        mediaLicense: "",
        priceCents: item.priceCents,
        inventory: 8 + (i % 5),
        imageUrl: `https://placehold.co/600x600/${accent}/14121c/png?text=${label}`,
        description: item.desc,
        requiresShipping: true,
        active: true,
        refundPolicySnapshot: "Unused physical art items may be returned within 14 days unused and in original packaging.",
        contactSnapshot: text(seller.email || "bans.don@gmail.com", 200),
        seededBy: "seedLucyCobraBartrCatalogHttp",
        createdAt: now,
        updatedAt: now
      });
      created.push({id: ref.id, name: item.name, priceCents: item.priceCents});
    }

    res.status(200).json({
      ok: true,
      sellerUid: seller.uid,
      sellerName: storeName,
      productsCreated: created.length,
      productsSkippedExisting: catalog.length - created.length,
      commerceUrl: "https://jadzadco.github.io/shoutout-demo/commerce.html?v=29.09.14"
    });
  } catch (error) {
    res.status(500).json({ok: false, error: error?.message || String(error)});
  }
});
