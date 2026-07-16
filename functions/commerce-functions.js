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
const LIVE_SHOUTOUT_DURATION_MS = 10 * 60 * 1000;
const SPLIT_MEDIA_TEMPLATE_IDS = new Set(["birthdayMedia", "anniversaryMedia", "engagementMedia", "fianceMedia"]);
const CLASSIC_BOARD_TEMPLATE_IDS = new Set(["blackwhite", "graduation", "corporate"]);
const SHOUTOUT_TEXT_LIMITS = {
  full:{
    "p125-96x48":[3,16,48,28],"p125-64x48":[3,10,30,22],"p125-64x32":[3,14,42,24],
    "led-96x48":[3,16,48,28],"led-64x48":[3,10,30,22],"led-64x32":[3,12,36,20]
  },
  classicBoard:{
    "p125-96x48":[3,15,45,20],"p125-64x48":[3,12,36,18],"p125-64x32":[3,14,42,18],
    "led-96x48":[3,15,45,20],"led-64x48":[3,12,36,18],"led-64x32":[3,12,36,16]
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
    "p125-96x48":[2,14,28,20,3,18,54,14],"p125-64x48":[2,10,20,16,3,12,36,10],"p125-64x32":null,
    "led-96x48":[2,14,28,20,3,18,54,14],"led-64x48":[2,10,20,16,3,12,36,10],"led-64x32":null
  }
};
const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bands.don@gmail.com,bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

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
    playerName:values[7] || 0
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
  if (members.length !== 4) throw new HttpsError("invalid-argument", "The Zebbies football intro requires exactly four player photos.");
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
    const isDefault = ["blackwhite", "classic-black-white"].includes(templateId);
    if (isDefault) throw new HttpsError("failed-precondition", "The default ShoutOut does not require checkout.");
    const footballTeamIntro = templateId === FOOTBALL_TEAM_INTRO_TEMPLATE_ID;
    const video = text(shoutout.mediaType, 20).toLowerCase() === "video" || payload.videoEnabled === true;
    const amountCents = footballTeamIntro || video ? 3000 : 2000;
    const split = moneyParts(amountCents, 40);
    const clubId = text(shoutout.clubLocationId || shoutout.location || payload.clubLocationId, 120);
    if (!clubId) throw new HttpsError("invalid-argument", "A club is required for a paid ShoutOut.");
    if (footballTeamIntro && clubId !== ZEBBIES_GARDEN_DC_LOCATION_ID) throw new HttpsError("failed-precondition", "The four-player football intro is available only at Zebbies Garden DC.");
    const recipient = await trustedConnectRecipient("club", clubId);
    return {
      amountCents,
      itemName:footballTeamIntro ? "Zebbies four-player football intro ShoutOut" : video ? "FLOQR video-enabled ShoutOut" : "FLOQR picture-enabled ShoutOut",
      description:"Payment is required before the ShoutOut enters the club approval queue.",
      venueShareCents:split.venueShare,
      floqrShareCents:split.floqrShare,
      connectedAccountId:recipient.accountId,
      connectedAccountBindingId:recipient.bindingId,
      connectedAccountCapabilityStatus:recipient.capabilityStatus,
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
    if (!sellerEntityId || !sellerEntityType) throw new HttpsError("failed-precondition", "This product is missing a valid FLOQR seller.");
    const recipient = await trustedConnectRecipient(sellerEntityType, sellerEntityId);
    return {
      amountCents,
      venueShareCents:amountCents,
      sellerShareCents:amountCents,
      floqrShareCents:0,
      quantity,
      unitAmountCents,
      itemName:text(product.name || "FLOQR marketplace item", 120),
      description:text(product.description || "Sold through FLOQR Commerce", 300),
      sellerEntityId,
      sellerEntityType,
      sellerUid:text(product.sellerUid, 160),
      sellerName:text(product.sellerName || "FLOQR seller", 120),
      connectedAccountId:recipient.accountId,
      connectedAccountBindingId:recipient.bindingId,
      connectedAccountCapabilityStatus:recipient.capabilityStatus,
      productId,
      productType:text(product.productType || "physical", 40),
      mediaLicense:text(product.mediaLicense || "", 80),
      previewMediaType:text(product.previewMediaType || "image", 20),
      requiresShipping:product.requiresShipping !== false,
      productSnapshot:{
        name:text(product.name, 120),
        imageUrl:text(product.imageUrl, 500),
        productType:text(product.productType || "physical", 40),
        previewMediaType:text(product.previewMediaType || "image", 20),
        mediaLicense:text(product.mediaLicense || "", 80),
        sellerEntityId:text(product.sellerEntityId || product.sellerUid, 160),
        sellerName:text(product.sellerName, 120),
        priceCents:unitAmountCents
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

  if (type === "smsNotifications") {
    return {
      amountCents:1000,
      itemName:"Club Admin SMS notification service",
      description:"SMS notification service charge.",
      floqrShareCents:1000,
      venueShareCents:0,
      clubLocationId:text(payload.clubLocationId, 120)
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
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const type = text(request.data?.orderType, 80);
  const rawPayload = request.data?.payload && typeof request.data.payload === "object" ? request.data.payload : {};
  const payload = normalizeCheckoutPayload(type, rawPayload, request.auth);
  if (type === "audienceCampaign") await requirePublisher(text(payload.entityId, 160), request.auth);
  if (["targetedGuestList", "smsNotifications"].includes(type)) await requirePublisher(text(payload.clubLocationId, 160), request.auth);
  const summary = await describeOrder(type, payload);
  const orderRef = db.collection("serviceOrders").doc();
  const returnBase = safeReturnBase(request);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const order = {
    orderType:type,
    ownerUid:request.auth.uid,
    ownerEmail:text(request.auth.token?.email, 200),
    status:"checkout-created",
    paymentStatus:"unpaid",
    currency:"usd",
    ...summary,
    payload,
    invoiceNumber:`FLOQR-${new Date().toISOString().slice(0,10).replace(/-/g, "")}-${orderRef.id.slice(0,8).toUpperCase()}`,
    shippingStatus:type === "commerce" && summary.requiresShipping ? "awaiting-payment" : type === "commerce" && summary.productType !== "physical" ? "digital-delivery-pending" : "not-required",
    createdAt:now,
    updatedAt:now
  };
  await createOrderWithInventoryReservation(orderRef, order);

  const params = {
    mode:"payment",
    success_url:`${returnBase}payment-return.html?order=${encodeURIComponent(orderRef.id)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:`${returnBase}payment-return.html?order=${encodeURIComponent(orderRef.id)}&cancelled=1`,
    client_reference_id:orderRef.id,
    metadata:{orderId:orderRef.id, orderType:type, ownerUid:request.auth.uid},
    billing_address_collection:"auto",
    payment_intent_data:{metadata:{orderId:orderRef.id, orderType:type, ownerUid:request.auth.uid}},
    line_items:[stripeLineItem(order)]
  };
  if (order.ownerEmail) params.customer_email = order.ownerEmail;
  if (type === "commerce" && summary.requiresShipping) {
    params.shipping_address_collection = {allowed_countries:["US", "CA", "GB", "FR", "DE", "ES", "IT", "NL", "PT"]};
  }
  if (type === "commerce") params.expires_at = Math.floor(Date.now() / 1000) + COMMERCE_RESERVATION_SECONDS;
  if (summary.connectedAccountId) {
    params.payment_intent_data.transfer_data = {destination:summary.connectedAccountId};
    if (type === "shoutout") params.payment_intent_data.application_fee_amount = summary.floqrShareCents;
  }
  let session;
  try {
    session = await stripeClient().checkout.sessions.create(params, {idempotencyKey:`floqr-checkout-${orderRef.id}`});
  } catch (error) {
    if (type === "commerce") await releaseCommerceInventoryReservation(orderRef.id, "checkout-session-create-failed");
    await orderRef.set({status:"checkout-failed", checkoutErrorCode:text(error?.code || error?.type || "stripe_error", 80), updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
    throw new HttpsError("internal", "Stripe could not create checkout. Please try again.");
  }
  await orderRef.set({stripeCheckoutSessionId:session.id, checkoutUrl:session.url, updatedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
  return {orderId:orderRef.id, checkoutUrl:session.url, amountCents:summary.amountCents, currency:"usd"};
});

async function finalizePaidOrder(orderId, session) {
  const ref = db.collection("serviceOrders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const order = snap.data() || {};
  if (order.paymentStatus === "paid" && order.stripeFulfillmentComplete === true) return;
  const paidAt = order.paidAt || admin.firestore.FieldValue.serverTimestamp();
  const shipping = session?.shipping_details || session?.collected_information?.shipping_details || null;
  await ref.set({
    status:"paid",
    paymentStatus:"paid",
    paidAt,
    updatedAt:paidAt,
    stripeCheckoutSessionId:session?.id || order.stripeCheckoutSessionId || "",
    stripePaymentIntentId:session?.payment_intent || "",
    customerEmail:session?.customer_details?.email || order.ownerEmail || "",
    shippingDetails:shipping || null,
    shippingStatus:order.orderType === "commerce" && order.requiresShipping ? "paid-awaiting-fulfillment" : order.shippingStatus
  }, {merge:true});

  if (order.orderType === "shoutout" && order.payload?.shoutout) {
    const shoutout = {...order.payload.shoutout};
    const shoutoutRef = db.collection("shoutouts").doc(`stripe_${orderId}`);
    await shoutoutRef.set({
      ...shoutout,
      status:"pending",
      paymentRequired:true,
      paymentStatus:"paid",
      serviceOrderId:orderId,
      invoiceNumber:order.invoiceNumber || "",
      venueShareCents:order.venueShareCents || 0,
      floqrShareCents:order.floqrShareCents || 0,
      submittedAt:paidAt
    }, {merge:true});
    await ref.set({fulfilledRecordId:shoutoutRef.id, fulfillmentStatus:"submitted-for-club-approval"}, {merge:true});
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
