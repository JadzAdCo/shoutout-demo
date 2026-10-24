/* BOT DEE tool runners — each re-validates the product feature gate, then delegates
   to the same handlers VIP / ShoutOut / FloqCAST / checkout already use. */
"use strict";

const admin = require("firebase-admin");
const {HttpsError} = require("firebase-functions/v2/https");
const featureAccess = require("./feature-services-functions").__featureServiceHelpers;
const featureGates = require("./feature-gate-functions").__featureGateHelpers;
const vip = require("./vip-functions").__vipHelpers;
const floqCast = require("./floqcast-functions").__floqCastHelpers;
const checkout = require("./commerce-functions").__checkoutHelpers;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function asRequest(sessionRequest, data) {
  return {
    auth: sessionRequest.auth,
    data: data || {},
    rawRequest: sessionRequest.rawRequest || {},
    app: sessionRequest.app
  };
}

function toolError(error) {
  if (error instanceof HttpsError) {
    return {ok: false, error: error.message, code: error.code};
  }
  return {ok: false, error: String(error?.message || error).slice(0, 240), code: "internal"};
}

async function listShoutOutTemplates(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "shoutOut", sessionRequest);
  await featureGates.assertPatronFeature(sessionRequest.auth, "shoutOut");
  const clubLocationId = text(args?.clubLocationId || args?.locationId, 120);
  let venueTemplateIds = null;
  let venueName = "";
  if (clubLocationId) {
    await featureGates.assertClubFeature(clubLocationId, "shoutOut");
    const snap = await db.collection("clubLocations").doc(clubLocationId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Club not found.");
    const row = snap.data() || {};
    venueName = text(row.locationName || row.brandName || clubLocationId, 160);
    venueTemplateIds = Array.isArray(row.templates) ? row.templates.map(String) : [];
  }
  // Packaged catalog ids from shared-data (browser); server returns deep-link for compose.
  const href = clubLocationId
    ? `./shoutout-search.html?from=botdee&location=${encodeURIComponent(clubLocationId)}`
    : "./shoutout-search.html?from=botdee";
  return {
    ok: true,
    tool: "listShoutOutTemplates",
    clubLocationId: clubLocationId || null,
    venueName: venueName || null,
    templateIds: venueTemplateIds,
    templateCount: venueTemplateIds ? venueTemplateIds.length : null,
    composeHref: href,
    note: venueTemplateIds
      ? "Use startShoutOutCheckout with clubLocationId + shoutout payload, or open composeHref to pick a template on device."
      : "Pass clubLocationId to list venue templates, or open composeHref to choose a club."
  };
}

async function startShoutOutCheckout(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "shoutOut", sessionRequest);
  const payload = args?.payload && typeof args.payload === "object" ? args.payload : {};
  const clubLocationId = text(payload.clubLocationId || args?.clubLocationId, 120);
  const shoutout = payload.shoutout && typeof payload.shoutout === "object"
    ? payload.shoutout
    : (args?.shoutout && typeof args.shoutout === "object" ? args.shoutout : null);
  if (!clubLocationId || !shoutout) {
    throw new HttpsError("invalid-argument", "startShoutOutCheckout needs clubLocationId and shoutout payload.");
  }
  const result = await checkout.runCreateFloqrCheckoutSession(asRequest(sessionRequest, {
    orderType: "shoutout",
    payload: {clubLocationId, shoutout, priceCents: args?.priceCents || payload.priceCents},
    returnBase: args?.returnBase,
    correlationId: args?.correlationId
  }));
  return {ok: true, tool: "startShoutOutCheckout", ...result};
}

async function createVipHold(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "vipReservations", sessionRequest);
  const result = await vip.runCreateVipHold(asRequest(sessionRequest, {
    clubLocationId: args?.clubLocationId,
    night: args?.night,
    sectionId: args?.sectionId,
    partySize: args?.partySize
  }));
  return {ok: true, tool: "createVipHold", ...result};
}

async function recordVipConsent(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "vipReservations", sessionRequest);
  const result = await vip.runRecordVipConsent(asRequest(sessionRequest, {
    holdId: args?.holdId,
    checks: args?.checks || {terms: true}
  }));
  return {ok: true, tool: "recordVipConsent", ...result};
}

async function createVipCheckout(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "vipReservations", sessionRequest);
  const holdId = text(args?.holdId, 120);
  const consentId = text(args?.consentId, 120);
  if (!holdId || !consentId) {
    throw new HttpsError("invalid-argument", "VIP checkout needs holdId and consentId.");
  }
  const result = await checkout.runCreateFloqrCheckoutSession(asRequest(sessionRequest, {
    orderType: "vipReservation",
    payload: {holdId, consentId},
    returnBase: args?.returnBase,
    correlationId: args?.correlationId
  }));
  return {ok: true, tool: "createVipCheckout", ...result};
}

async function createFloqCastRequest(args, sessionRequest) {
  // createFloqCastRequest asserts club floqCast; also require patron floqCast feature for BOT DEE.
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "floqCast", sessionRequest);
  const result = await floqCast.runCreateFloqCastRequest(asRequest(sessionRequest, {
    locationId: args?.locationId || args?.clubLocationId,
    clubLocationId: args?.clubLocationId || args?.locationId,
    locationName: args?.locationName,
    displayBoard: args?.displayBoard || "secondary"
  }));
  return {ok: true, tool: "createFloqCastRequest", ...result};
}

async function createFloqCastCheckout(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "floqCast", sessionRequest);
  const requestId = text(args?.requestId, 120);
  if (!requestId) throw new HttpsError("invalid-argument", "createFloqCastCheckout needs requestId.");
  const result = await checkout.runCreateFloqrCheckoutSession(asRequest(sessionRequest, {
    orderType: "suprstarRequest",
    payload: {requestId, clubLocationId: args?.clubLocationId || args?.locationId},
    returnBase: args?.returnBase,
    correlationId: args?.correlationId
  }));
  return {ok: true, tool: "createFloqCastCheckout", ...result};
}

const TOOL_RUNNERS = {
  listShoutOutTemplates,
  startShoutOutCheckout,
  createVipHold,
  recordVipConsent,
  createVipCheckout,
  createFloqCastRequest,
  createFloqCastCheckout
};

async function runProductTool(name, args, sessionRequest) {
  const runner = TOOL_RUNNERS[name];
  if (!runner) return {ok: false, error: `Unknown tool: ${name}`};
  try {
    return await runner(args || {}, sessionRequest);
  } catch (error) {
    return toolError(error);
  }
}

module.exports = {
  TOOL_RUNNERS,
  runProductTool,
  listShoutOutTemplates,
  startShoutOutCheckout,
  createVipHold,
  recordVipConsent,
  createVipCheckout,
  createFloqCastRequest,
  createFloqCastCheckout
};
