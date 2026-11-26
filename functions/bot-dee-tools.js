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
const people = require("./people-directory-core");
const headless = require("./headless-shoutout-core");
const templateInputs = require("./shoutout-template-inputs");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PUBLIC_PROFILE_SCAN = 400;
const PUBLIC_PROFILE_MAX = 8;

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

/** Human club names patrons type in chat → Firestore clubLocations doc ids. */
const CLUB_NAME_ALIASES = Object.freeze({
  aurelia: "temp-democlub-1",
  "aurelia demo": "temp-democlub-1",
  "aurelia demo club": "temp-democlub-1",
  "demo club": "temp-democlub-1",
  decades: "decades-washington-dc",
  "decades washington": "decades-washington-dc",
  "decades washington dc": "decades-washington-dc",
  "lima twist": "lima-twist-washington-dc",
  "lima twist club": "lima-twist-washington-dc",
  "lima twist washington": "lima-twist-washington-dc",
  "lima twist washington dc": "lima-twist-washington-dc",
  heist: "heist-washington-dc",
  "heist dc": "heist-washington-dc",
  "heist washington": "heist-washington-dc",
  "heist washington dc": "heist-washington-dc",
  shoko: "shoko-barcelona-spain",
  "shoko barcelona": "shoko-barcelona-spain",
  "shoko barcelona spain": "shoko-barcelona-spain",
  "shôko": "shoko-barcelona-spain",
  "shôko barcelona": "shoko-barcelona-spain"
});

function normalizeClubNeedle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a clubLocationId or human venue name (e.g. "Aurelia") to a clubLocations doc id.
 * Gemini often passes the display name; Firestore keys are slugs like temp-democlub-1.
 */
async function resolveClubLocationId(raw) {
  const id = text(raw, 120);
  if (!id) return "";
  const direct = await db.collection("clubLocations").doc(id).get();
  if (direct.exists) return id;

  const needle = normalizeClubNeedle(id);
  if (!needle) return "";

  const alias = CLUB_NAME_ALIASES[needle];
  if (alias) {
    const aliasSnap = await db.collection("clubLocations").doc(alias).get();
    if (aliasSnap.exists) return alias;
  }

  const slug = needle.replace(/\s+/g, "-");
  if (slug && slug !== id) {
    const slugSnap = await db.collection("clubLocations").doc(slug).get();
    if (slugSnap.exists) return slug;
  }

  const snap = await db.collection("clubLocations").limit(250).get();
  let bestId = "";
  let bestScore = 0;
  snap.forEach(doc => {
    const row = doc.data() || {};
    const names = [doc.id, row.locationName, row.brandName, row.displayName]
      .map(normalizeClubNeedle)
      .filter(Boolean);
    names.forEach(name => {
      let score = 0;
      if (name === needle) score = 100;
      else if (name.startsWith(needle) || needle.startsWith(name)) score = 80;
      else if (name.includes(needle) || (needle.length >= 4 && name.includes(needle))) score = 60;
      if (score > bestScore) {
        bestScore = score;
        bestId = doc.id;
      }
    });
  });
  return bestScore >= 60 ? bestId : "";
}

async function requireClubLocationId(raw) {
  const resolved = await resolveClubLocationId(raw);
  if (!resolved) {
    throw new HttpsError(
      "not-found",
      `Club not found for "${text(raw, 80)}". Try the venue slug (e.g. temp-democlub-1 for Aurelia) or open Search.`
    );
  }
  return resolved;
}

async function loadTemplateCollectableRow(templateId) {
  const resolved = headless.resolveTemplateId(templateId)
    || String(templateId || "").trim()
    || headless.DEFAULT_TEMPLATE_ID;
  const packaged = headless.catalogShapeFor(resolved);
  try {
    const snap = await db.collection("templates").doc(resolved).get();
    if (snap.exists) {
      return templateInputs.stampTemplate({...packaged, ...(snap.data() || {}), id: resolved});
    }
  } catch (_) {}
  return packaged;
}

async function loadCollectableTemplateCards(ids, options = {}) {
  const listed = Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))] : null;
  const fallbackAll = options.fallbackAll === true || (options.fallbackAll !== false && listed == null);
  const wanted = listed && listed.length
    ? listed
    : (fallbackAll ? Object.keys(headless.HEADLESS_TEXT_TEMPLATES) : []);
  if (!wanted.length) return [];
  const packagedById = {};
  wanted.forEach(id => {
    packagedById[id] = headless.catalogShapeFor(id);
  });
  try {
    const refs = wanted.map(id => db.collection("templates").doc(id));
    if (refs.length && typeof db.getAll === "function") {
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap, i) => {
        const id = wanted[i];
        if (snap.exists) {
          packagedById[id] = templateInputs.stampTemplate({
            ...packagedById[id],
            ...(snap.data() || {}),
            id
          });
        }
      });
    } else {
      for (const id of wanted) {
        packagedById[id] = await loadTemplateCollectableRow(id);
      }
    }
  } catch (_) {}
  return wanted.map(id => templateInputs.collectableFields(packagedById[id]));
}

async function listShoutOutTemplates(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "shoutOut", sessionRequest);
  await featureGates.assertPatronFeature(sessionRequest.auth, "shoutOut");
  const rawClub = text(args?.clubLocationId || args?.locationId || args?.locationName, 120);
  const clubLocationId = rawClub ? await requireClubLocationId(rawClub) : "";
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
  const href = clubLocationId
    ? `./shoutout-search.html?from=botdee&location=${encodeURIComponent(clubLocationId)}`
    : "./shoutout-search.html?from=botdee";
  const templates = await loadCollectableTemplateCards(venueTemplateIds, {
    fallbackAll: !clubLocationId
  });
  return {
    ok: true,
    tool: "listShoutOutTemplates",
    clubLocationId: clubLocationId || null,
    venueName: venueName || null,
    templateIds: templates.map(row => row.id),
    templateCount: templates.length,
    templates,
    composeHref: href,
    note: "Each template has collectableInput1..N {fieldId, required 0|1, prompt}. Fill those from conversation context. Ask only the next missing required slot. Never invent a canned throw phrase. Do not say LED copy — say shoutout text or sign verbiage. Use startShoutOutCheckout after required slots are filled (optional templateId / screenFormatId). Paid templates return checkoutUrl; free boards submit pending. Open composeHref only when a required photo slot cannot be filled in chat."
  };
}

function clientIpFromRequest(sessionRequest) {
  const req = sessionRequest?.rawRequest || {};
  const headers = req.headers || {};
  const xf = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
  const real = String(headers["x-real-ip"] || "").trim();
  let ip = xf || real || req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return String(ip || "").trim().slice(0, 80);
}

async function notifyClubPendingHeadlessShoutOut({
  clubLocationId,
  venue = {},
  shoutoutId,
  mainText,
  referenceNumber,
  locationName
} = {}) {
  const uids = new Set([
    ...(Array.isArray(venue.adminUids) ? venue.adminUids : []),
    ...(Array.isArray(venue.masterAdminUids) ? venue.masterAdminUids : [])
  ].map(value => text(value, 160)).filter(Boolean));
  try {
    const snap = await db.collection("clubEmployeeDesignations")
      .where("clubLocationId", "==", clubLocationId)
      .limit(80)
      .get();
    snap.forEach(doc => {
      const row = doc.data() || {};
      if (text(row.status, 40).toLowerCase() === "rejected") return;
      const roles = `${row.roleElectionType || ""} ${(row.workerRoles || []).join(" ")}`;
      if (/club\s*admin/i.test(roles) && row.workerUid) uids.add(text(row.workerUid, 160));
    });
  } catch (_error) {
    /* designation query optional */
  }
  const recipients = [...uids];
  if (!recipients.length) return {ok: false, skipped: "no-admin-recipients"};
  const snippet = text(mainText, 80);
  const body = [
    `FloqR: ShoutOut pending at ${locationName || clubLocationId}.`,
    snippet ? `"${snippet}"` : "",
    `Ref ${referenceNumber || shoutoutId}.`,
    "Open Club Admin → Pending ShoutOuts to Approve & Push Live."
  ].filter(Boolean).join(" ");
  const link = `./admin.html?location=${encodeURIComponent(clubLocationId)}&panel=panelQueue`;
  const id = text(shoutoutId, 120);
  await Promise.all(recipients.map(uid => {
    const note = {
      type: "pendingShoutout",
      title: "Pending ShoutOut",
      body,
      clubLocationId,
      locationName: locationName || clubLocationId,
      shoutoutId: id,
      referenceNumber: referenceNumber || "",
      senderUid: "system",
      senderName: "System Message",
      messageCategory: "system",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      link,
      recipientUid: uid
    };
    if (!id) return db.collection("inboxNotifications").add(note);
    return db.collection("inboxNotifications").doc(`pendingShoutout_${uid}_${id}`).set(note, {merge: true});
  }));
  return {ok: true, recipients: recipients.length};
}

async function submitFreeHeadlessShoutOut({clubLocationId, shoutout, venue, auth, sessionRequest, templateRow} = {}) {
  const uid = text(auth?.uid, 120);
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const templateId = text(shoutout?.template || shoutout?.templateId, 80);
  const overlay = templateRow && typeof templateRow === "object"
    ? templateRow
    : await loadTemplateCollectableRow(templateId);
  if (headless.isComposerOnlyTemplate(templateId, overlay) || Math.max(0, Math.round(Number(shoutout?.priceCents || 0))) > 0) {
    throw new HttpsError("failed-precondition", "This ShoutOut template does not submit as a free board.");
  }
  const email = text(auth?.token?.email || shoutout.submittedBy, 200).toLowerCase();
  const referenceNumber = headless.newReferenceNumber();
  const locationName = text(shoutout.locationName || venue?.locationName || clubLocationId, 160);
  let profile = {};
  try {
    const userSnap = await db.collection("users").doc(uid).get();
    profile = userSnap.exists ? userSnap.data() || {} : {};
  } catch (_error) {
    profile = {};
  }
  const clientIp = clientIpFromRequest(sessionRequest);
  const actor = require("./shoutout-compliance-functions").actorFieldsFromSources({
    submittedByUid: uid,
    submittedBy: email,
    actorEmail: email,
    clientIp,
    ipSource: clientIp ? "headless-submit" : ""
  }, profile);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const doc = {
    ...shoutout,
    clubLocationId,
    location: clubLocationId,
    club: clubLocationId,
    locationName,
    status: "pending",
    editable: true,
    paymentRequired: false,
    paymentStatus: "unpaid",
    headless: true,
    source: "headless",
    onboardingSource: "headless-shoutout",
    submittedByUid: uid,
    submittedBy: actor.submittedBy || email,
    actorEmail: actor.actorEmail || email,
    actorPhone: actor.actorPhone || "",
    actorIdentifier: actor.actorIdentifier || email,
    clientIp: actor.clientIp || "",
    ipSource: actor.ipSource || "",
    referenceNumber,
    createdAt: now,
    submittedAt: now,
    updatedAt: now
  };
  const ref = await db.collection("shoutouts").add(doc);
  await db.collection("shoutoutAudit").add({
    shoutoutId: ref.id,
    action: "submitted",
    referenceNumber,
    ownerUid: uid,
    actorUid: uid,
    actorEmail: actor.actorEmail || email,
    clientIp: actor.clientIp || "",
    ipSource: actor.ipSource || "",
    source: "headless",
    createdAt: now
  });
  try {
    await notifyClubPendingHeadlessShoutOut({
      clubLocationId,
      venue,
      shoutoutId: ref.id,
      mainText: text(shoutout.mainText, 200),
      referenceNumber,
      locationName
    });
  } catch (error) {
    console.warn("headless pending club inbox skipped", error?.message || error);
  }
  return {
    shoutoutId: ref.id,
    referenceNumber,
    portalHref: headless.portalShoutOutHref(ref.id),
    venueName: locationName,
    templateId: text(shoutout.template, 80),
    screenFormatId: text(shoutout.screenFormatId, 40),
    mainText: text(shoutout.mainText, 200)
  };
}

async function loadPatronShoutOutAttribution(uid) {
  const id = text(uid, 80);
  if (!id) return "";
  const snap = await db.collection("users").doc(id).get();
  const data = snap.exists ? (snap.data() || {}) : {};
  return headless.formatHandle(
    data.floqrHandle || data.username || data.minglHandle || data.displayName || data.publicName
  );
}

async function startShoutOutCheckout(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "shoutOut", sessionRequest);
  await featureGates.assertPatronFeature(sessionRequest.auth, "shoutOut");
  const payload = args?.payload && typeof args.payload === "object" ? args.payload : {};
  const existing = payload.shoutout && typeof payload.shoutout === "object"
    ? payload.shoutout
    : (args?.shoutout && typeof args.shoutout === "object" ? args.shoutout : null);
  const userPrompt = text(args?.userPrompt || payload.userPrompt, 2000);
  const parsed = headless.parseShoutOutExecute(userPrompt);
  const rawClub = text(
    payload.clubLocationId
      || args?.clubLocationId
      || args?.locationName
      || args?.locationId
      || existing?.clubLocationId
      || existing?.location
      || parsed.clubQuery,
    120
  );
  const message = text(
    existing?.mainText
    || args?.mainText
    || args?.message
    || args?.text
    || payload.mainText
    || payload.message
    || parsed.message
    || args?.playerName
    || args?.jerseyName
    || parsed.playerName
    || parsed.jerseyName,
    400
  );
  const templateId = text(
    existing?.template || existing?.templateId || args?.templateId || payload.templateId || parsed.templateId,
    80
  );
  const screenFormatId = text(
    existing?.screenFormatId || args?.screenFormatId || payload.screenFormatId || parsed.screenFormatId,
    40
  );
  if (!rawClub || !message) {
    const needs = [];
    if (!rawClub) needs.push("club");
    if (!message) needs.push("message");
    return {
      ok: false,
      tool: "startShoutOutCheckout",
      needs,
      composeHref: headless.shoutOutComposeHref(rawClub),
      error: headless.missingAsk(needs)
    };
  }
  let clubLocationId = "";
  try {
    clubLocationId = await requireClubLocationId(rawClub);
  } catch (error) {
    return {
      ok: false,
      tool: "startShoutOutCheckout",
      needs: ["club"],
      composeHref: headless.shoutOutComposeHref(""),
      error: error.message || `Club not found for "${rawClub}".`
    };
  }
  await featureGates.assertClubFeature(clubLocationId, "shoutOut");
  const snap = await db.collection("clubLocations").doc(clubLocationId).get();
  const venue = snap.exists ? {id: clubLocationId, ...(snap.data() || {})} : {id: clubLocationId};
  const includeAttribution = args?.includeAttribution === true
    || args?.includeAttribution === 1
    || args?.includeAttribution === "1"
    || existing?.includeAttribution === true;
  const attribution = text(
    args?.attribution || payload.attribution || existing?.attribution || parsed.attribution,
    80
  );
  const mediaUrl = text(args?.mediaUrl || payload.mediaUrl || existing?.mediaUrl || parsed.mediaUrl, 500);
  const mediaType = text(args?.mediaType || payload.mediaType || existing?.mediaType, 20);
  const templateRow = await loadTemplateCollectableRow(templateId);
  const composed = headless.composeShoutOutPayload({
    clubLocationId,
    venue,
    message,
    templateId,
    screenFormatId,
    userPrompt,
    includeAttribution,
    attribution,
    attributionChoice: text(args?.attributionChoice || existing?.attributionChoice, 40),
    mediaUrl,
    mediaType,
    templateRow,
    jerseyTeamId: text(args?.jerseyTeamId || existing?.jerseyTeamId || parsed.jerseyTeamId, 80),
    jerseyName: text(args?.jerseyName || existing?.jerseyPatronName || parsed.jerseyName, 16),
    jerseyNumber: text(args?.jerseyNumber || existing?.jerseyNumber || parsed.jerseyNumber, 4),
    playerName: text(args?.playerName || existing?.playerName || parsed.playerName, 40),
    facePhotoUrl: text(args?.facePhotoUrl || existing?.facePhotoUrl, 500)
  });
  if (!composed.ok) {
    return {
      ok: false,
      tool: "startShoutOutCheckout",
      needs: composed.missing && composed.missing.length ? composed.missing : ["compose"],
      composerOnly: !!composed.composerOnly,
      templateId: composed.templateId || templateId,
      composeHref: composed.composeHref || headless.shoutOutComposeHref(clubLocationId),
      error: composed.reason || headless.missingAsk(composed.missing)
    };
  }
  const shoutout = {
    ...composed.shoutout,
    submittedByUid: sessionRequest.auth?.uid || "",
    submittedBy: text(sessionRequest.auth?.token?.email, 200).toLowerCase()
  };
  const venueName = text(shoutout.locationName || venue.locationName || clubLocationId, 160);
  if (composed.priceCents > 0) {
    const result = await checkout.runCreateFloqrCheckoutSession(asRequest(sessionRequest, {
      orderType: "shoutout",
      payload: {clubLocationId, shoutout, priceCents: composed.priceCents},
      returnBase: args?.returnBase,
      correlationId: args?.correlationId
    }));
    return {
      ok: true,
      tool: "startShoutOutCheckout",
      mode: "checkout",
      clubLocationId,
      venueName,
      templateId: shoutout.template,
      screenFormatId: shoutout.screenFormatId,
      mainText: shoutout.mainText,
      ...result
    };
  }
  const submitted = await submitFreeHeadlessShoutOut({
    clubLocationId,
    shoutout,
    venue,
    auth: sessionRequest.auth,
    sessionRequest,
    templateRow
  });
  return {
    ok: true,
    tool: "startShoutOutCheckout",
    mode: "pending",
    clubLocationId,
    venueName,
    ...submitted
  };
}

async function getVipFloorStatus(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "vipReservations", sessionRequest);
  const clubLocationId = await requireClubLocationId(args?.clubLocationId || args?.locationName);
  const headlessVip = require("./headless-vip-core");
  const night = headlessVip.parseNight(args?.night) || headlessVip.tonightIso();
  const vipFns = require("./vip-functions").__vipHelpers;
  const result = await vipFns.runGetVipAvailability(asRequest(sessionRequest, {clubLocationId, night}));
  return {ok: true, tool: "getVipFloorStatus", ...result};
}

async function getVipAvailability(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "vipReservations", sessionRequest);
  const clubLocationId = await requireClubLocationId(args?.clubLocationId || args?.locationName);
  const headlessVip = require("./headless-vip-core");
  const sectionQuery = String(args?.sectionQuery || args?.area || args?.sectionId || "").trim();
  const listed = sectionQuery
    ? headlessVip.resolveSectionQuery(clubLocationId, sectionQuery)
    : {ok: false, matches: headlessVip.listSections(clubLocationId, ""), reason: "list"};
  return {
    ok: true,
    tool: "getVipAvailability",
    clubLocationId,
    night: String(args?.night || headlessVip.tonightIso()),
    sectionQuery,
    matchReason: listed.reason || (listed.ok ? "exact" : "list"),
    sections: listed.matches || [],
    note: listed.ok
      ? "Use this sectionId with createVipHold."
      : (listed.matches && listed.matches.length
        ? "Several tables match. Ask the patron to pick a label, then createVipHold with that sectionId."
        : "No matching table. Ask for V1 / C10 / a printed label, not only the area name.")
  };
}

async function createVipHold(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "vipReservations", sessionRequest);
  const clubLocationId = await requireClubLocationId(args?.clubLocationId || args?.locationName);
  const headlessVip = require("./headless-vip-core");
  const wanted = String(args?.sectionId || args?.sectionQuery || args?.area || "").trim();
  const match = headlessVip.resolveSectionQuery(clubLocationId, wanted);
  if (!match.ok) {
    return {
      ok: false,
      tool: "createVipHold",
      clubLocationId,
      error: match.reason === "area" || match.reason === "ambiguous"
        ? "That name is an area with several tables. Pick one sectionId from the list."
        : "That table section was not found.",
      sections: match.matches || [],
      sectionQuery: wanted
    };
  }
  try {
    const result = await vip.runCreateVipHold(asRequest(sessionRequest, {
      clubLocationId,
      night: headlessVip.parseNight(args?.night) || args?.night || headlessVip.tonightIso(),
      sectionId: match.matches[0].id,
      partySize: args?.partySize || headlessVip.DEFAULT_PARTY
    }));
    return {ok: true, tool: "createVipHold", clubLocationId, sectionId: match.matches[0].id, ...result};
  } catch (error) {
    const message = String(error?.message || error || "").trim()
      || "That table could not be held. Pick another section.";
    return {
      ok: false,
      tool: "createVipHold",
      clubLocationId,
      error: message,
      sectionId: match.matches[0].id
    };
  }
}

async function releaseVipHold(args, sessionRequest) {
  const holdId = text(args?.holdId, 120);
  if (!holdId) return {ok: false, tool: "releaseVipHold", error: "holdId is required."};
  try {
    await featureAccess.assertFeatureAccess(sessionRequest.auth, "vipReservations", sessionRequest);
    const result = await vip.runReleaseVipHold(asRequest(sessionRequest, {holdId}));
    return {ok: true, tool: "releaseVipHold", ...result};
  } catch (error) {
    return toolError(error);
  }
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
  const holdSnap = await db.collection("vipHolds").doc(holdId).get();
  if (!holdSnap.exists) throw new HttpsError("not-found", "VIP hold not found.");
  const hold = holdSnap.data() || {};
  const vipPos = require("./vip-pos-functions").__vipPosHelpers;
  const paySettings = await vipPos.loadClubPaymentSettings(text(hold.clubLocationId, 120));
  const collector = text(hold.paymentCollector || paySettings.paymentCollector, 40) || "floqrStripe";
  const payReq = asRequest(sessionRequest, {holdId, consentId});

  // Same dynamic path as vip-terms-app: Club POS (Toast/SpotOn) → confirm for POS; no card URL.
  if (collector === "clubPos") {
    const result = await vipPos.runConfirmVipReservationForClubPos(payReq);
    return {
      ok: true,
      tool: "createVipCheckout",
      paymentCollector: "clubPos",
      checkoutMode: "clubPos",
      checkoutUrl: null,
      passHref: result.reservationId
        ? `./botdee-vip-popout.html?kind=paid&collector=clubPos&reservationId=${encodeURIComponent(result.reservationId)}`
        : "./botdee-vip-popout.html?kind=paid&collector=clubPos",
      ...result
    };
  }

  const depositRequired = Number(hold.depositRequired) === 0
    ? false
    : (Number(hold.depositRequired) === 1
      || Number(hold.amounts?.chargedCents || hold.amounts?.depositCents || 0) > 0);

  // No deposit (or zero-charge manual CSV) → confirm without Stripe — never invent a checkoutUrl.
  if (!depositRequired || (collector === "manualCsv" && Number(hold.amounts?.chargedCents || 0) <= 0)) {
    if (!depositRequired) {
      const result = await vip.runConfirmVipReservationWithoutDeposit(payReq);
      return {
        ok: true,
        tool: "createVipCheckout",
        paymentCollector: collector,
        checkoutMode: "noDeposit",
        checkoutUrl: null,
        passHref: "./botdee-vip-popout.html?kind=paid",
        ...result
      };
    }
  }

  // floqrStripe / clubStripe (and charged manual CSV) → FloqR Checkout Session URL.
  const result = await checkout.runCreateFloqrCheckoutSession(asRequest(sessionRequest, {
    orderType: "vipReservation",
    payload: {holdId, consentId, botDeePopout: true},
    returnBase: args?.returnBase,
    correlationId: args?.correlationId
  }));
  return {
    ok: true,
    tool: "createVipCheckout",
    paymentCollector: collector,
    checkoutMode: collector === "clubStripe" ? "clubStripe" : "floqrStripe",
    ...result
  };
}

async function createFloqCastRequest(args, sessionRequest) {
  // createFloqCastRequest asserts club floqCast; also require patron floqCast feature for BOT DEE.
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "floqCast", sessionRequest);
  const clubLocationId = await requireClubLocationId(
    args?.locationId || args?.clubLocationId || args?.locationName
  );
  const result = await floqCast.runCreateFloqCastRequest(asRequest(sessionRequest, {
    locationId: clubLocationId,
    clubLocationId,
    locationName: args?.locationName,
    displayBoard: args?.displayBoard || "secondary"
  }));
  return {ok: true, tool: "createFloqCastRequest", clubLocationId, ...result};
}

async function createFloqCastCheckout(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "floqCast", sessionRequest);
  const requestId = text(args?.requestId, 120);
  if (!requestId) throw new HttpsError("invalid-argument", "createFloqCastCheckout needs requestId.");
  const rawClub = text(args?.clubLocationId || args?.locationId || args?.locationName, 120);
  const clubLocationId = rawClub ? await requireClubLocationId(rawClub) : "";
  const result = await checkout.runCreateFloqrCheckoutSession(asRequest(sessionRequest, {
    orderType: "suprstarRequest",
    payload: {requestId, clubLocationId: clubLocationId || undefined},
    returnBase: args?.returnBase,
    correlationId: args?.correlationId
  }));
  return {ok: true, tool: "createFloqCastCheckout", clubLocationId: clubLocationId || null, ...result};
}

function foldNameChars(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201B\u2032`´]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function normalizeNeedle(value) {
  return foldNameChars(value)
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9@\s._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function squeezeNeedle(value) {
  return normalizeNeedle(value).replace(/\s+/g, "");
}

/** People search identity keys only — never bio, likes, drinks, genres, or SMARTview tags. */
const PEOPLE_IDENTITY_HANDLE_KEYS = Object.freeze([
  "floqrHandle", "minglHandle", "username",
  "instagram", "instagramHandle",
  "tiktok", "tiktokHandle",
  "xHandle", "twitter", "x",
  "facebook", "facebookHandle"
]);

function identityNameValues(data = {}) {
  const first = String(data.firstName || "").trim();
  const last = String(data.lastName || "").trim();
  return [
    first,
    last,
    [first, last].filter(Boolean).join(" "),
    data.displayName,
    data.publicName,
    data.fullName
  ].map(value => String(value || "").trim()).filter(Boolean);
}

function identityHandleValues(data = {}) {
  return PEOPLE_IDENTITY_HANDLE_KEYS
    .map(key => String(data[key] || "").replace(/^@+/, "").trim())
    .filter(Boolean);
}

function pushIdentityAlias(out, seen, raw) {
  const folded = normalizeNeedle(raw);
  const squeezed = squeezeNeedle(raw);
  [folded, squeezed].forEach(alias => {
    if (!alias || seen.has(alias)) return;
    seen.add(alias);
    out.push(alias);
  });
}

function identityAliases(data = {}) {
  const out = [];
  const seen = new Set();
  identityNameValues(data).forEach(raw => pushIdentityAlias(out, seen, raw));
  identityHandleValues(data).forEach(raw => pushIdentityAlias(out, seen, raw));
  return out;
}

function identityNameTokens(data = {}) {
  const tokens = new Set();
  identityNameValues(data).forEach(raw => {
    normalizeNeedle(raw).split(/\s+/).filter(token => token.length > 1).forEach(token => tokens.add(token));
  });
  return tokens;
}

function identityHandleSet(data = {}) {
  const set = new Set();
  identityHandleValues(data).forEach(raw => {
    const folded = normalizeNeedle(raw);
    const squeezed = squeezeNeedle(raw);
    if (folded) set.add(folded);
    if (squeezed) set.add(squeezed);
  });
  return set;
}

function scoreIdentity(data, needle, tokens) {
  const n = normalizeNeedle(needle);
  if (!n) return 0;
  const squeezed = squeezeNeedle(needle);
  const aliases = identityAliases(data);
  let points = 0;
  aliases.forEach(alias => {
    if (alias === n || (squeezed && alias === squeezed)) {
      points = Math.max(points, alias.length >= 4 || alias.includes(" ") ? 50 : 16);
    }
  });
  const queryTokens = (Array.isArray(tokens) && tokens.length
    ? tokens
    : n.split(/\s+/)).map(token => normalizeNeedle(token).replace(/^@+/, "")).filter(token => token.length > 1);
  if (!queryTokens.length) return points;
  const nameTokens = identityNameTokens(data);
  const handles = identityHandleSet(data);
  if (queryTokens.every(token => nameTokens.has(token))) {
    points = Math.max(points, queryTokens.length >= 2 ? 40 : 16);
  }
  if (queryTokens.length === 1 && (handles.has(queryTokens[0]) || handles.has(squeezed))) {
    points = Math.max(points, queryTokens[0].length >= 4 || squeezed.length >= 4 ? 50 : 16);
  }
  return points;
}

/** People lookup: identity fields only. Bios / likes / drinks never score. */
function scorePerson(data, needle, tokens) {
  return scoreIdentity(data, needle, tokens);
}

function scoreHay(hay, needle, tokens) {
  const h = normalizeNeedle(hay);
  if (!h || !needle) return 0;
  let points = 0;
  if (h === needle) points += 40;
  if (h.includes(needle)) points += 18;
  tokens.forEach(token => {
    if (token.length > 1 && h.includes(token)) points += token.length >= 4 ? 8 : 4;
  });
  return points;
}

function listish(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(item => String(item));
  if (value == null || value === "") return [];
  return String(value).split(/[,;/|]+/).map(item => item.trim()).filter(Boolean);
}

const PLACE_STOP = new Set([
  "my", "the", "a", "an", "of", "for", "with", "to", "and", "or", "on", "at",
  "in", "near", "around", "looking", "look", "show", "me", "some", "good", "best",
  "where", "can", "i", "get", "find", "search", "please", "any", "are", "there",
  "is", "what", "whats", "which", "who", "want", "wanna", "need", "recommend",
  "recommendation", "recommendations", "spot", "spots", "place", "places",
  "city", "cities", "open", "now", "tonight", "today", "this", "that", "you", "got", "have",
  "lets", "let", "talk", "talks", "talking", "chat", "chatting", "plan", "planning",
  "discuss", "discussing", "about", "hey", "hi", "hello", "howdy",
  "en", "dans", "sur", "chez", "im", "am", "zum", "zur", "bei", "di", "da", "nel",
  "em", "na", "w", "we", "и", "в", "на", "και", "στο", "στη", "في", "من", "على",
  "hola", "ciao", "salut", "hallo", "olá", "cześć", "γεια", "привет", "مرحبا"
]);

const DINING_CUES = new Set([
  "sushi", "sashimi", "omakase", "nigiri", "ramen", "izakaya",
  "japanese", "japan", "chinese", "korean", "thai", "indian", "italian",
  "mexican", "spanish", "peruvian", "american", "fusion", "asian", "tapas",
  "pizza", "taco", "tacos", "brunch", "dinner", "lunch", "breakfast",
  "restaurant", "restaurants", "dining", "eatery", "eateries", "cuisine",
  "steakhouse", "seafood", "cafe", "cafes", "bakery", "bistro",
  "restaurante", "restaurantes", "ristorante", "ristoranti", "restaurant",
  "ресторан", "рестораны", "εστιατόριο", "εστιατόρια", "مطعم", "مطاعم",
  "restauracja", "diner", "eten"
]);

const FOOD_GENERIC = new Set(["food", "foods", "eat", "eats", "eating"]);

const VENUE_CUES = new Set([
  "club", "clubs", "lounge", "lounges", "nightlife", "nightclub", "nightclubs",
  "venue", "venues", "bar", "bars", "disco", "discos",
  "reservation", "reservations", "reserve",
  "clubes", "discoteca", "discotecas", "boite", "boîte", "nachtclub", "nachtclubs",
  "клуб", "клубы", "клубъ", "κλαμπ", "κλαμπς", "نادي", "نوادي", "klub", "kluby"
]);

const PLACE_LEFTOVER_STOP = new Set([
  ...PLACE_STOP,
  "room", "rooms", "smart", "card", "cards", "smartview", "smartcard",
  "group", "reservation", "reservations", "reserve", "booking", "book",
  "together", "session",
  "lets", "let", "talk", "talks", "talking", "chat", "chatting", "plan", "planning",
  "discuss", "discussing", "about", "hey", "hi", "hello", "howdy"
]);

const CUISINE_ALIASES = Object.freeze({
  sushi: ["sushi", "sashimi", "omakase", "nigiri", "japanese", "japan", "asian", "tapas"],
  sashimi: ["sushi", "sashimi", "japanese"],
  omakase: ["sushi", "omakase", "japanese"],
  nigiri: ["sushi", "nigiri", "japanese"],
  ramen: ["ramen", "japanese", "japan"],
  japanese: ["japanese", "japan", "sushi", "ramen", "izakaya", "sashimi", "asian"],
  japan: ["japanese", "japan", "sushi", "asian"],
  asian: ["asian", "sushi", "japanese", "chinese", "korean", "thai", "fusion", "tapas"],
  tapas: ["tapas", "asian"],
  fusion: ["fusion", "asian"],
  chinese: ["chinese", "asian"],
  korean: ["korean", "asian"],
  thai: ["thai", "asian"],
  italian: ["italian", "pizza"],
  mexican: ["mexican", "taco", "tacos"],
  peruvian: ["peruvian", "lima"],
  american: ["american"],
  pizza: ["pizza", "italian"],
  seafood: ["seafood"],
  restaurant: ["restaurant", "restaurants", "dining"],
  restaurants: ["restaurant", "restaurants", "dining"],
  dining: ["dining", "restaurant", "restaurants"]
});

const PROFILE_DATAPOINT_ASK = /\b(my|public)\s+profile\b|\bprofile\s+(food|music|travel|hobbies|photos?)\b|\b(food|music|travel|hobbies)\s+(on|in)\s+(my|the)\s+(public\s+)?profile\b/i;

let cityCatalogCache = null;
let cityCatalogAtMs = 0;
const CITY_CATALOG_TTL_MS = 60 * 1000;

function activeCityCatalog() {
  const city = require("./botdee-city-tokens");
  return cityCatalogCache || city.mergeCatalog([]);
}

function invalidateCityCatalog() {
  cityCatalogCache = null;
  cityCatalogAtMs = 0;
}

async function primeCityCatalog() {
  const city = require("./botdee-city-tokens");
  if (cityCatalogCache && Date.now() - cityCatalogAtMs < CITY_CATALOG_TTL_MS) return cityCatalogCache;
  let docs = [];
  try {
    const snap = await db.collection("botDeeCityTokens").limit(400).get();
    docs = snap.docs.map(doc => ({placeId: doc.id, ...(doc.data() || {})}));
  } catch (_) { /* packaged catalog still matches */ }
  cityCatalogCache = city.mergeCatalog(docs);
  cityCatalogAtMs = Date.now();
  return cityCatalogCache;
}

function matchPlaces(needle) {
  const city = require("./botdee-city-tokens");
  return city.matchPlacesWithCatalog(needle, activeCityCatalog());
}

function extractPlaceTokens(needle) {
  return matchPlaces(needle).tokens;
}

function expandSearchTokens(tokens) {
  const out = [];
  tokens.forEach(token => {
    out.push(token);
    if (token.length > 4 && token.endsWith("s")) out.push(token.slice(0, -1));
    const aliases = CUISINE_ALIASES[token] || CUISINE_ALIASES[token.replace(/s$/, "")];
    if (aliases) aliases.forEach(alias => out.push(alias));
  });
  return [...new Set(out.filter(Boolean))];
}

const GENERIC_DINING = new Set([
  "restaurant", "restaurants", "dining", "eatery", "eateries", "cuisine",
  "brunch", "dinner", "lunch", "breakfast", "cafe", "cafes", "bakery", "bistro"
]);

function cuisineTokensFrom(tokens) {
  const out = [];
  tokens.forEach(token => {
    if (GENERIC_DINING.has(token) || FOOD_GENERIC.has(token) || VENUE_CUES.has(token)) return;
    const aliases = CUISINE_ALIASES[token] || CUISINE_ALIASES[token.replace(/s$/, "")];
    if (aliases) {
      out.push(token, ...aliases);
    } else if (DINING_CUES.has(token)) {
      out.push(token);
    }
  });
  return [...new Set(out)];
}

function leftoverQueryTokens(rawTokens, needle, placeTokens, cuisineTokens) {
  const consumed = new Set(matchPlaces(needle).consumed);
  const known = new Set([...(placeTokens || []), ...(cuisineTokens || []), ...consumed]);
  return (rawTokens || []).filter(token => {
    if (!token || token.length < 3) return false;
    if (PLACE_STOP.has(token) || PLACE_LEFTOVER_STOP.has(token) || GENERIC_DINING.has(token) || FOOD_GENERIC.has(token) || VENUE_CUES.has(token)) return false;
    if (CUISINE_ALIASES[token] || CUISINE_ALIASES[token.replace(/s$/, "")]) return false;
    if (known.has(token) || consumed.has(token.replace(/\./g, ""))) return false;
    if ((placeTokens || []).some(place => place.includes(token))) return false;
    return true;
  });
}

function emptyPlaceIntent() {
  return {intent: "none", needle: "", tokens: [], placeTokens: [], cuisineTokens: [], leftoverTokens: []};
}

function skipPlaceSearchPrompt(raw) {
  try {
    const bot = require("./bot-dee-core");
    return !!(bot.isChitchatPrompt(raw)
      || bot.isIdentityPrompt(raw)
      || bot.isHelpPrompt(raw)
      || bot.isPrivacyPrompt(raw)
      || bot.isVersionPrompt(raw)
      || bot.isPrivilegeAskPrompt(raw));
  } catch (_) {
    return false;
  }
}

function classifyPlaceSearchIntent(raw) {
  if (skipPlaceSearchPrompt(raw)) return emptyPlaceIntent();
  const people = require("./botdee-smartcard-core").classifyPeopleSearchIntent(raw);
  if (people.intent === "self" || people.intent === "person" || people.intent === "empty") {
    return emptyPlaceIntent();
  }
  if (PROFILE_DATAPOINT_ASK.test(String(raw || ""))) return emptyPlaceIntent();
  const city = require("./botdee-city-tokens");
  const needle = city.normalizePlaceNeedle(raw) || normalizeNeedle(raw);
  if (!needle || needle.length < 2) return emptyPlaceIntent();
  const rawTokens = needle.split(/\s+/).filter(token => token.length > 1 && !PLACE_STOP.has(token));
  const diningHit = rawTokens.some(token => DINING_CUES.has(token))
    || (rawTokens.some(token => FOOD_GENERIC.has(token)) && extractPlaceTokens(needle).length);
  const venueHit = rawTokens.some(token => VENUE_CUES.has(token));
  const placeTokens = extractPlaceTokens(needle);
  const destinationHit = placeTokens.length > 0;
  if (!diningHit && !venueHit && !destinationHit) return emptyPlaceIntent();
  const tokens = expandSearchTokens(rawTokens);
  const cuisineTokens = cuisineTokensFrom(rawTokens);
  const leftoverTokens = leftoverQueryTokens(rawTokens, needle, placeTokens, cuisineTokens);
  return {
    intent: diningHit ? "dining" : "venue",
    needle,
    tokens,
    placeTokens,
    cuisineTokens,
    leftoverTokens
  };
}

function clubHaystack(id, data = {}) {
  return [
    id, data.locationId, data.locationName, data.brandName, data.name, data.displayName,
    data.city, data.publicCity, data.state, data.region, data.country, data.neighborhood,
    data.streetAddress, data.addressLine1, data.fullAddress, data.address, data.locationLabel,
    data.description, data.publicBio, data.tagline, data.about, data.activityStatus,
    data.cuisine, data.food, data.menu, data.type,
    ...listish(data.cuisines),
    ...listish(data.categories),
    ...listish(data.amenities),
    ...listish(data.genres),
    ...listish(data.services),
    ...listish(data.artists),
    ...listish(data.djs)
  ].filter(Boolean).join(" ");
}

function hayHasPlace(hay, placeTokens) {
  if (!placeTokens.length) return true;
  return placeTokens.some(token => hay.includes(token));
}

function diningOverlap(hay, classified) {
  if (classified.cuisineTokens && classified.cuisineTokens.length) {
    return classified.cuisineTokens.some(token => hay.includes(token));
  }
  if ((classified.leftoverTokens || []).length) {
    return classified.leftoverTokens.every(token => hay.includes(token));
  }
  return ["restaurant", "dining", "cuisine", "food", "eatery", "tapas", "brunch", "dinner"].some(token => hay.includes(token));
}

function venueTypeOverlap(hay, data = {}) {
  const type = String(data.type || "").toLowerCase();
  if (["club", "lounge", "bar", "restaurant", "nightclub", "venue"].includes(type)) return true;
  return ["club", "lounge", "nightlife", "nightclub", "venue", "bar", "disco", "restaurant"].some(token => hay.includes(token));
}

function scoreClubForPlace(id, data, classified) {
  if (!classified || classified.intent === "none") return 0;
  if (!isClubPublic(data)) return 0;
  const hay = normalizeNeedle(clubHaystack(id, data));
  if (!hay) return 0;
  if (!hayHasPlace(hay, classified.placeTokens || [])) return 0;
  const leftover = classified.leftoverTokens || [];
  if (leftover.length && leftover.some(token => !hay.includes(token))) return 0;
  if (classified.intent === "dining" && !diningOverlap(hay, classified)) return 0;
  if (classified.intent === "venue" && !venueTypeOverlap(hay, data)) return 0;
  return scoreHay(hay, classified.needle, classified.tokens || []);
}

function rankPublicClubs(docs, classified, limit = 5) {
  const scored = [];
  (Array.isArray(docs) ? docs : []).forEach(doc => {
    const id = doc.id;
    const data = doc.data || {};
    const score = scoreClubForPlace(id, data, classified);
    if (score >= 8) scored.push({id, data, score});
  });
  scored.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  return scored.slice(0, Math.min(8, Math.max(1, Number(limit) || 5)));
}

function clubToResult(card) {
  const blurb = [card.city, card.cuisine, card.bio].filter(Boolean).join(" · ").slice(0, 180);
  return {
    id: card.id,
    sourceId: `club:${card.id}`,
    kind: "venue",
    label: card.displayName,
    blurb,
    href: card.profileHref
  };
}

function clubSmartView(card) {
  const cuisine = listish(card.cuisines && card.cuisines.length ? card.cuisines : card.cuisine).slice(0, 6);
  const payload = {
    kind: "venue",
    title: card.displayName,
    summary: card.bio || [card.city, card.brandName].filter(Boolean).join(" · "),
    images: [],
    floqrPublicData: {
      cuisine,
      cuisines: cuisine,
      city: card.city,
      country: card.country
    },
    canonicalFloqrPageId: card.id,
    actions: [{
      id: "open-public-page",
      href: card.profileHref,
      label: "Open FLOQR Public Page"
    }],
    sources: [{provider: "floqr", reuseRights: "club"}]
  };
  try {
    const visual = require("./smartvisuals-resolver").resolvePlaceCard(payload);
    if (visual && visual.backgroundId) payload.floqrPublicData.smartBackgroundId = visual.backgroundId;
    if (visual && visual.stencilId) payload.floqrPublicData.smartStencilId = visual.stencilId;
    if (visual && Array.isArray(visual.tags) && visual.tags.length) {
      payload.floqrPublicData.smartTags = visual.tags;
    }
  } catch (_) { /* catalog optional on this path */ }
  return payload;
}

function emptyPlaceVisualOverride() {
  return {backgroundId: "", stencilId: "", tags: [], generic: true, roomKey: ""};
}

function catalogPlaceIdFromTokens(placeTokens) {
  const tokens = Array.isArray(placeTokens) ? placeTokens.map(v => String(v || "").trim().toLowerCase()).filter(Boolean) : [];
  if (!tokens.length) return "";
  if (tokens.includes("miami") || tokens.includes("miami beach")) return "miami";
  try {
    const resolver = require("./smartvisuals-resolver");
    const out = resolver.resolve({
      title: tokens.join(" "),
      description: tokens.join(" "),
      sourceKind: "place-smartview"
    });
    if (out && Array.isArray(out.placeIds) && out.placeIds[0]) return String(out.placeIds[0]);
  } catch (_) { /* catalog optional */ }
  return tokens[0].replace(/\s+/g, "-");
}

async function loadPlaceVisualOverride(kind, placeId) {
  try {
    const resolver = require("./smartvisuals-resolver");
    const normalize = resolver.normalizeSmartViewTags;
    const keys = [];
    const place = String(placeId || "").trim();
    if (place) keys.push(`placeSmartView:${place}`);
    if (kind) keys.push(`placeSmartView:${kind}`);
    keys.push("placeSmartView");
    for (const key of keys) {
      const snap = await db.collection("smartVisualOverrides").doc(key).get();
      if (!snap.exists) continue;
      const data = snap.data() || {};
      const backgroundId = String(data.backgroundId || "").trim();
      const stencilId = String(data.stencilId || "").trim();
      const tags = typeof normalize === "function" ? normalize(data.tags) : [];
      if (backgroundId || stencilId || (tags && tags.length)) {
        const placeSpecific = !!(place && key === `placeSmartView:${place}`);
        return {backgroundId, stencilId, tags: tags || [], generic: !placeSpecific, roomKey: key};
      }
    }
  } catch (_) { /* overrides optional until Functions deploy */ }
  return emptyPlaceVisualOverride();
}

async function loadPlaceBackgroundOverride(kind) {
  const row = await loadPlaceVisualOverride(kind);
  return row.backgroundId || "";
}

function mergeSmartViewTags(...lists) {
  try {
    return require("./smartvisuals-resolver").normalizeSmartViewTags(lists.flat());
  } catch (_) {
    const out = [];
    const seen = new Set();
    lists.flat().forEach(tag => {
      const next = String(tag || "").trim().toLowerCase();
      if (!next || seen.has(next)) return;
      seen.add(next);
      out.push(next);
    });
    return out;
  }
}

function catalogTagsForBackground(backgroundId) {
  const id = String(backgroundId || "").trim();
  if (!id) return [];
  try {
    const resolver = require("./smartvisuals-resolver");
    const catalog = resolver.loadCatalog();
    const assets = catalog && Array.isArray(catalog.assets) ? catalog.assets : [];
    const bg = assets.find(row => row && row.id === id);
    return resolver.normalizeSmartViewTags(bg && bg.tags);
  } catch (_) {
    return [];
  }
}

function applyPlaceVisualOverride(payload, override) {
  if (!payload || !override) return payload;
  const publicData = payload.floqrPublicData || {};
  const classifiedId = String(publicData.smartBackgroundId || "").trim();
  let classifiedPlace = "";
  let overridePlace = "";
  try {
    const resolver = require("./smartvisuals-resolver");
    classifiedPlace = resolver.backgroundPlaceId(classifiedId) || "";
    overridePlace = resolver.backgroundPlaceId(override.backgroundId) || "";
  } catch (_) { /* catalog optional */ }
  const otherPlace = !!(classifiedPlace && override.backgroundId && overridePlace && overridePlace !== classifiedPlace);
  const keepClassified = !!(classifiedPlace && (override.generic || otherPlace || !override.backgroundId));
  const next = {};
  if (override.backgroundId && !keepClassified) next.smartBackgroundId = override.backgroundId;
  if (override.stencilId && !keepClassified) next.smartStencilId = override.stencilId;
  const winId = next.smartBackgroundId || classifiedId;
  const winPlace = keepClassified ? classifiedPlace : (overridePlace || classifiedPlace);
  const tags = mergeSmartViewTags(
    catalogTagsForBackground(winId),
    winPlace ? [`destination:${winPlace}`] : [],
    keepClassified ? [] : (Array.isArray(override.tags) ? override.tags : [])
  );
  if (tags.length) next.smartTags = tags;
  if (!Object.keys(next).length) return payload;
  payload.floqrPublicData = Object.assign({}, publicData, next);
  return payload;
}

const PUBLISHED_DATA_URL_MAX = 900000;

function publishedBackgroundDataUrl(row) {
  if (!row || String(row.approvalStatus || "") !== "published") return "";
  const type = String(row.contentType || "").trim();
  const raster = String(row.imageBase64 || "").replace(/\s+/g, "");
  if (raster && /^image\/(jpeg|png|webp)$/.test(type) && raster.length <= PUBLISHED_DATA_URL_MAX) {
    return `data:${type};base64,${raster}`;
  }
  const svg = String(row.svgXml || "").trim();
  if (svg && svg.length <= PUBLISHED_DATA_URL_MAX) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  return "";
}

function catalogBackgroundIdForTags(tags) {
  const set = new Set(mergeSmartViewTags(tags));
  const fashion = set.has("fashion-week") || set.has("runway")
    || (set.has("fashion") && (set.has("event") || set.has("milan") || set.has("paris") || set.has("london")));
  if (fashion) {
    if (set.has("paris")) return "bg-paris-fashion-week";
    if (set.has("london")) return "bg-london-fashion-week";
    if (set.has("new-york") || set.has("nyc") || set.has("new york")) return "bg-new-york-fashion-week";
    if (set.has("milan")) return "bg-milan-fashion-week";
  }
  return "";
}

function placeTagsOf(payload) {
  const publicData = payload && payload.floqrPublicData ? payload.floqrPublicData : {};
  return mergeSmartViewTags(publicData.smartTags, payload && payload.tags);
}

function applyTaggedCatalogBackground(payload) {
  if (!payload) return payload;
  const tagged = catalogBackgroundIdForTags(placeTagsOf(payload));
  if (!tagged) return payload;
  payload.floqrPublicData = Object.assign({}, payload.floqrPublicData || {}, {smartBackgroundId: tagged});
  return payload;
}

async function loadPublishedOverlay(id, tags) {
  const keys = [];
  const primary = String(id || "").trim();
  if (primary) keys.push(primary);
  const tagged = catalogBackgroundIdForTags(tags);
  if (tagged && !keys.includes(tagged)) keys.push(tagged);
  for (const key of keys) {
    try {
      const snap = await db.collection("smartVisualPublished").doc(key).get();
      if (!snap.exists) continue;
      const url = publishedBackgroundDataUrl(snap.data() || {});
      if (url) return {id: key, url};
    } catch (_) { /* overlay optional */ }
  }
  const wanted = mergeSmartViewTags(tags);
  const place = wanted.find(tag => ["milan", "paris", "london", "new-york", "miami", "bali"].includes(tag));
  const topic = wanted.find(tag => ["fashion-week", "runway", "fashion"].includes(tag));
  if (!place && !topic) return null;
  try {
    const field = place || topic;
    const snap = await db.collection("smartVisualPublished").where("tags", "array-contains", field).limit(24).get();
    let best = null;
    let bestScore = 0;
    snap.docs.forEach(doc => {
      const data = doc.data() || {};
      const have = mergeSmartViewTags(data.tags);
      const score = wanted.filter(tag => have.includes(tag)).length;
      const url = publishedBackgroundDataUrl(data);
      if (url && score > bestScore) {
        best = {id: doc.id, url};
        bestScore = score;
      }
    });
    if (bestScore >= 2) return best;
  } catch (_) { /* tag query optional if index missing */ }
  return null;
}

async function attachPublishedBackgroundUrl(payload) {
  if (!payload) return payload;
  applyTaggedCatalogBackground(payload);
  const publicData = payload.floqrPublicData || {};
  const id = String(publicData.smartBackgroundId || "").trim();
  const tags = placeTagsOf(payload);
  if (!id && !tags.length) return payload;
  try {
    const overlay = await loadPublishedOverlay(id, tags);
    if (!overlay || !overlay.url) return payload;
    payload.floqrPublicData = Object.assign({}, publicData, {
      smartBackgroundId: overlay.id || id,
      smartBackgroundUrl: overlay.url
    });
  } catch (_) { /* published overlay optional until Functions deploy */ }
  return payload;
}

async function stampPublishedPlaceViews(views, workflow) {
  const list = Array.isArray(views) ? views : [];
  const intent = (() => {
    try { return require("./botdee-session-intent"); } catch (_) { return null; }
  })();
  const out = [];
  for (const view of list) {
    if (!view || view.kind !== "venue") {
      out.push(view);
      continue;
    }
    let next = view;
    if (intent && workflow) next = intent.stampPlacePayload(next, workflow);
    applyTaggedCatalogBackground(next);
    out.push(await attachPublishedBackgroundUrl(next));
  }
  return out;
}

function applyPlaceBackgroundOverride(payload, backgroundId) {
  if (backgroundId && typeof backgroundId === "object") {
    return applyPlaceVisualOverride(payload, backgroundId);
  }
  return applyPlaceVisualOverride(payload, {backgroundId, stencilId: "", tags: []});
}

function cityQueryLabels(placeTokens) {
  const labels = [];
  const tokens = Array.isArray(placeTokens) ? placeTokens : [];
  if (tokens.includes("miami") || tokens.includes("miami beach")) labels.push("Miami", "Miami Beach");
  if (tokens.includes("washington") || tokens.includes("dc")) labels.push("Washington");
  if (tokens.includes("new york") || tokens.includes("nyc") || tokens.includes("manhattan")) labels.push("New York");
  tokens.forEach(token => {
    if (["dc", "washington", "nyc", "new york", "manhattan", "miami", "miami beach"].includes(token)) return;
    const label = String(token || "").split(/\s+/).filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    if (label) labels.push(label);
  });
  return [...new Set(labels)];
}

function titleCasePlace(token) {
  const raw = String(token || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "dc" || raw === "washington") return "Washington, DC";
  if (raw === "nyc" || raw === "new york" || raw === "manhattan") return "New York";
  if (raw === "vegas" || raw === "las vegas") return "Las Vegas";
  if (raw === "miami beach") return "Miami Beach";
  return raw.split(/\s+/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function placeSearchAlongsideRoom(classified) {
  return !!(classified && classified.intent && classified.intent !== "none" && (classified.placeTokens || []).length);
}

function userTextsFromHistory(history) {
  const rows = Array.isArray(history) ? history : [];
  const texts = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const role = String(row.role || "").toLowerCase();
    if (role && role !== "user") continue;
    const value = String(row.text || "").trim();
    if (value) texts.push(value);
  }
  return texts.slice(-12);
}

function classifyPlaceSearchFromConversation(currentPrompt, history) {
  if (skipPlaceSearchPrompt(currentPrompt)) return emptyPlaceIntent();
  const current = classifyPlaceSearchIntent(currentPrompt);
  if (placeSearchAlongsideRoom(current)) return current;
  const namedNow = extractPlaceTokens(normalizeNeedle(currentPrompt));
  if (namedNow.length) {
    return {
      intent: "venue",
      needle: normalizeNeedle(currentPrompt) || namedNow.join(" "),
      tokens: namedNow,
      placeTokens: namedNow,
      cuisineTokens: [],
      leftoverTokens: []
    };
  }
  const needle = String(currentPrompt || "").trim();
  const texts = userTextsFromHistory(history);
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    if (texts[i] === needle) continue;
    if (skipPlaceSearchPrompt(texts[i])) continue;
    const classified = classifyPlaceSearchIntent(texts[i]);
    if (placeSearchAlongsideRoom(classified)) return classified;
  }
  return current;
}

function placeAttachQuery(classified, fallbackPrompt) {
  if (placeSearchAlongsideRoom(classified) && classified.needle) return classified.needle;
  return fallbackPrompt;
}

function destinationSmartView(classified, workflow) {
  const token = (classified && classified.placeTokens || []).find(Boolean)
    || (workflow && workflow.places && workflow.places[0]);
  if (!token && !(workflow && workflow.topics && workflow.topics.length)) return null;
  const city = titleCasePlace(token || (workflow.topics || [])[0] || "Place");
  const payload = {
    kind: "venue",
    title: city,
    summary: "",
    images: [],
    floqrPublicData: {city, cuisine: [], cuisines: []},
    canonicalFloqrPageId: "",
    actions: [],
    sources: [{provider: "floqr", reuseRights: "place"}]
  };
  try {
    const visual = require("./smartvisuals-resolver").resolvePlaceCard(payload);
    if (visual && visual.backgroundId) payload.floqrPublicData.smartBackgroundId = visual.backgroundId;
    if (visual && visual.stencilId) payload.floqrPublicData.smartStencilId = visual.stencilId;
    if (visual && Array.isArray(visual.tags) && visual.tags.length) {
      payload.floqrPublicData.smartTags = visual.tags;
    }
  } catch (_) { /* catalog optional on this path */ }
  try {
    require("./botdee-session-intent").stampPlacePayload(payload, workflow);
  } catch (_) { /* workflow stamp optional */ }
  applyTaggedCatalogBackground(payload);
  return payload;
}

function destinationPlaceViews(query, overrideVisual, workflow) {
  const classified = classifyPlaceSearchIntent(query);
  const dest = destinationSmartView(classified, workflow);
  if (!dest) {
    if (workflow && (workflow.placeWithoutProduct || (workflow.places || []).length || (workflow.topics || []).length)) {
      const stamped = destinationSmartView({placeTokens: workflow.places || []}, workflow);
      return stamped ? [applyPlaceVisualOverride(stamped, overrideVisual || emptyPlaceVisualOverride())] : [];
    }
    return [];
  }
  if (!placeSearchAlongsideRoom(classified) && !(workflow && (workflow.placeWithoutProduct || workflow.productClear))) {
    return [];
  }
  return [applyPlaceVisualOverride(dest, overrideVisual || emptyPlaceVisualOverride())];
}

async function searchPublicClubs(classified, limit = 5) {
  const byId = new Map();
  const snap = await db.collection("clubLocations").limit(PUBLIC_PROFILE_SCAN).get();
  snap.docs.forEach(doc => byId.set(doc.id, {id: doc.id, data: doc.data() || {}}));
  const labels = cityQueryLabels(classified && classified.placeTokens);
  for (const label of labels.slice(0, 5)) {
    try {
      const extra = await db.collection("clubLocations").where("city", "==", label).limit(40).get();
      extra.docs.forEach(doc => {
        if (!byId.has(doc.id)) byId.set(doc.id, {id: doc.id, data: doc.data() || {}});
      });
    } catch (_) { /* city field query is a supplement; scan ranking still runs */ }
  }
  return rankPublicClubs([...byId.values()], classified, limit);
}

async function attachVenueSearch({query} = {}) {
  await primeCityCatalog();
  const classified = classifyPlaceSearchIntent(query);
  if (classified.intent === "none") return {handled: false, classified};
  let ranked = [];
  try {
    ranked = await searchPublicClubs(classified, 5);
  } catch (error) {
    console.warn("BOT DEE attachVenueSearch failed", error?.message || error);
    return {handled: false, classified, error: String(error?.message || error).slice(0, 180)};
  }
  const cards = ranked.map(row => publicClubCard(row.id, row.data, row.score));
  const names = cards.map(card => card.displayName).filter(Boolean);
  const found = cards.length > 0;
  const destCity = titleCasePlace((classified.placeTokens || []).find(Boolean));
  const reply = found
    ? (names.length ? `Here are FLOQR venues that match: ${names.join(", ")}.` : "Here are FLOQR venues that match.")
    : (placeSearchAlongsideRoom(classified) && destCity
      ? `${destCity} · Place SMARTview. I can look at onboarded FLOQR clubs there — say clubs or a venue name.`
      : "FLOQR doesn't list that kind of spot there yet. I only search onboarded venues — not a general restaurant guide.");
  const media = [];
  let overrideVisual = emptyPlaceVisualOverride();
  try {
    overrideVisual = await loadPlaceVisualOverride("venue", catalogPlaceIdFromTokens(classified.placeTokens));
  } catch (_) { /* packaged resolver still stamps a SMARTbackground */ }
  const smartViews = [];
  if (placeSearchAlongsideRoom(classified)) {
    const dest = destinationSmartView(classified);
    if (dest) smartViews.push(await attachPublishedBackgroundUrl(applyPlaceVisualOverride(dest, overrideVisual)));
  }
  for (const card of cards) {
    smartViews.push(await attachPublishedBackgroundUrl(applyPlaceVisualOverride(clubSmartView(card), overrideVisual)));
  }
  return {
    handled: true,
    classified,
    reply,
    replyKey: found ? "botdee.place.found" : "botdee.place.none",
    results: [],
    smartViews,
    media,
    venueSearch: {
      intent: classified.intent,
      replyKey: found ? "botdee.place.found" : "botdee.place.none",
      count: smartViews.length
    }
  };
}

function imageUrlsFromUser(data = {}) {
  const urls = [];
  const push = value => {
    const url = text(value, 500);
    if (url && /^(https?:\/\/|\.\/)/i.test(url) && !urls.includes(url) && urls.length < 8) urls.push(url);
  };
  const slots = Array.isArray(data.profileMediaSlots) ? data.profileMediaSlots : [];
  const fallback = data.photoURL || data.profilePhotoUrl || data.publicPhotoUrl || data.avatarUrl || data.mainPhotoUrl || "";
  for (let i = 0; i < 8; i += 1) {
    const previous = slots[i] || (i === 0 && fallback ? {url: fallback, type: "image"} : {});
    if (previous.type === "video") continue;
    push(previous.url || previous.mediaUrl);
  }
  push(data.photoURL);
  push(data.profilePhotoUrl);
  push(data.mainPhotoUrl);
  push(data.avatarUrl);
  push(data.publicPhotoUrl);
  (Array.isArray(data.galleryUrls) ? data.galleryUrls : []).forEach(item => {
    if (typeof item === "string") push(item);
    else push(item?.url || item?.mediaUrl);
  });
  (Array.isArray(data.publicGallery) ? data.publicGallery : []).forEach(item => {
    push(item?.url || item?.mediaUrl);
  });
  return urls;
}

function imageUrlsFromClub(data = {}) {
  const urls = [];
  const push = value => {
    const url = text(value, 500);
    if (url && /^https?:\/\//i.test(url) && !urls.includes(url) && urls.length < 10) urls.push(url);
  };
  push(data.coverPhotoUrl || data.coverImageUrl || data.mainPhotoUrl || data.mainMediaUrl || data.logoUrl || data.brandLogoUrl);
  (Array.isArray(data.publicGallery) ? data.publicGallery : []).forEach(item => {
    push(item?.url || item?.mediaUrl);
  });
  (Array.isArray(data.galleryUrls) ? data.galleryUrls : []).forEach(item => {
    if (typeof item === "string") push(item);
    else push(item?.url || item?.mediaUrl);
  });
  return urls;
}

/** Public identity chrome BOT DEE may summarize (never email/phone/payment/GPS). */
const PUBLIC_USER_FACT_KEYS = Object.freeze([
  "displayName", "publicName", "username", "floqrHandle", "minglHandle",
  "publicBio", "bio", "tagline", "about", "headline", "pronouns",
  "approvedRoles",
  "instagram", "instagramHandle", "tiktok", "facebook", "twitter", "xHandle", "x",
  "website", "publicWebsite"
]);

/** Same keys as My Profile → Privacy datapoint sharing / Mingl `PUBLIC_MINGL_DATAPOINTS`. */
const PUBLIC_MINGL_DATAPOINT_KEYS = Object.freeze([
  "location", "gender", "height", "music", "events", "travel", "hobbies", "food", "beverage", "meet", "media"
]);

const VOLUNTEERED_LIST_MAX = 40;
const VOLUNTEERED_ITEM_CHARS = 160;

function listField(value, maxItems = VOLUNTEERED_LIST_MAX, maxEach = VOLUNTEERED_ITEM_CHARS) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[,;|/]+/);
  return items.map(item => text(item, maxEach)).filter(Boolean).slice(0, maxItems);
}

function publicMinglKeys(data = {}) {
  // Missing field → default all. Explicit [] → share none (patron chose nothing).
  if (!Array.isArray(data.publicMinglDatapoints)) return PUBLIC_MINGL_DATAPOINT_KEYS.slice();
  const known = new Set(PUBLIC_MINGL_DATAPOINT_KEYS);
  return [...new Set(data.publicMinglDatapoints.map(key => String(key || "").trim()).filter(key => known.has(key)))];
}

function datapointAllowed(data, key) {
  return publicMinglKeys(data).includes(key);
}

function heightDisplay(data = {}) {
  const labeled = text(data.heightDisplay || data.height, 40);
  const unit = String(data.heightUnit || "").toLowerCase();
  if (labeled) {
    if ((unit === "m" || unit === "metric") && !/\bm\b/i.test(labeled)) return text(`${labeled} m`, 40);
    return labeled;
  }
  const feet = data.heightFeet;
  const inches = data.heightInches;
  if (feet != null && String(feet).trim() !== "") return text(`${feet}'${inches || 0}"`, 20);
  return "";
}

function volunteeredLocation(data = {}) {
  const location = {
    city: text(data.city || data.publicCity || "", 80),
    region: text(data.state || data.region || data.province || data.stateRegionProvince || "", 80),
    country: text(data.country || data.publicCountry || "", 80)
  };
  Object.keys(location).forEach(key => {
    if (!location[key]) delete location[key];
  });
  return Object.keys(location).length ? location : null;
}

/** Full public volunteered keys + filled values (not PII/PCI). Empty opted-in keys stay in sharedDatapoints. */
function volunteeredPublicDatapoints(data = {}) {
  const sharedDatapoints = publicMinglKeys(data);
  const allowed = key => sharedDatapoints.includes(key);
  const datapoints = {};
  if (allowed("location")) {
    const location = volunteeredLocation(data);
    if (location) datapoints.location = location;
  }
  if (allowed("gender")) {
    const gender = text(data.gender || "", 40);
    if (gender) datapoints.gender = gender;
  }
  if (allowed("height")) {
    const height = heightDisplay(data);
    if (height) datapoints.height = height;
  }
  if (allowed("music")) {
    const music = listField(data.musicInterests || data.favoriteGenres);
    if (music.length) datapoints.music = music;
  }
  if (allowed("events")) {
    const nightlifeStyle = text(data.nightlifeStyle || "", 160);
    const events = listField(data.nightlifeInterests);
    if (nightlifeStyle) datapoints.nightlifeStyle = nightlifeStyle;
    if (events.length) datapoints.events = events;
  }
  if (allowed("travel")) {
    const prior = listField(data.priorTravels?.length ? data.priorTravels : data.travelInterests);
    const future = listField(data.futureTravelDestinations);
    const travel = [...prior, ...future.filter(name => !prior.includes(name))];
    if (prior.length) datapoints.travel = prior;
    if (future.length) datapoints.futureTravel = future;
    if (travel.length && !datapoints.travel) datapoints.travel = travel;
  }
  if (allowed("hobbies")) {
    const hobbies = listField(data.hobbies || data.generalHobbies);
    if (hobbies.length) datapoints.hobbies = hobbies;
  }
  if (allowed("food")) {
    const food = listField(data.foodChoices);
    if (food.length) datapoints.food = food;
  }
  if (allowed("beverage")) {
    const beverages = listField(data.favoriteBeverages);
    if (beverages.length) datapoints.beverages = beverages;
  }
  if (allowed("meet")) {
    const lookingToMeet = text(data.lookingToMeet || "", 200);
    if (lookingToMeet) datapoints.lookingToMeet = lookingToMeet;
  }
  const publicPhotos = imageUrlsFromUser(data);
  if (publicPhotos.length) datapoints.photoCount = publicPhotos.length;
  return {sharedDatapoints, datapoints};
}

function publicUserFacts(data = {}) {
  const facts = {};
  PUBLIC_USER_FACT_KEYS.forEach(key => {
    const value = data[key];
    if (value == null || value === "") return;
    if (Array.isArray(value)) {
      const list = value.filter(Boolean).slice(0, VOLUNTEERED_LIST_MAX).map(item => text(item, VOLUNTEERED_ITEM_CHARS)).filter(Boolean);
      if (list.length) facts[key] = list;
      return;
    }
    const str = text(value, key === "publicBio" || key === "bio" || key === "about" ? 400 : 160);
    if (str) facts[key] = str;
  });
  return facts;
}

function publicUserCard(uid, data = {}, score, extras = {}) {
  const handle = text(data.floqrHandle || data.username || data.minglHandle, 80).replace(/^@+/, "");
  const images = imageUrlsFromUser(data);
  const instagram = text(data.instagram || data.instagramHandle, 80).replace(/^@+/, "");
  const volunteered = volunteeredPublicDatapoints(data);
  const relation = extras.relation === "self" || extras.relation === "connection" ? extras.relation : "public";
  const card = {
    kind: "user",
    id: uid,
    relation,
    displayName: text(data.displayName || data.publicName || data.fullName || handle || "Member", 120),
    handle: handle ? `@${handle}` : "",
    instagram: instagram ? `@${instagram}` : "",
    instagramHandle: instagram ? `@${instagram}` : "",
    bio: text(data.publicBio || data.publicProfileBioOriginal || data.publicProfileBioEnglish || data.bio || data.tagline || data.about || "", 400),
    roles: Array.isArray(data.approvedRoles) ? data.approvedRoles.filter(Boolean).slice(0, 12).map(r => text(r, 40)) : [],
    website: text(data.website || data.publicWebsite || "", 240),
    visibility: text(data.publicProfileVisibility || "followers", 24),
    sharedDatapoints: volunteered.sharedDatapoints,
    datapoints: volunteered.datapoints,
    facts: publicUserFacts(data),
    photoURL: images[0] || "",
    imageUrls: images,
    profileHref: handle ? `./?start=search&q=${encodeURIComponent("@" + handle)}` : "./",
    score,
    ...extras
  };
  const dp = volunteered.datapoints;
  if (dp.location) {
    if (dp.location.city) card.city = dp.location.city;
    if (dp.location.region) card.region = dp.location.region;
    if (dp.location.country) card.country = dp.location.country;
  }
  if (dp.gender) card.gender = dp.gender;
  if (dp.height) card.height = dp.height;
  if (dp.music) card.music = dp.music;
  if (dp.nightlifeStyle) card.nightlifeStyle = dp.nightlifeStyle;
  if (dp.events) card.events = dp.events;
  if (dp.travel) card.travel = dp.travel;
  if (dp.futureTravel) card.futureTravel = dp.futureTravel;
  if (dp.hobbies) card.hobbies = dp.hobbies;
  if (dp.food) card.food = dp.food;
  if (dp.beverages) card.beverages = dp.beverages;
  if (dp.lookingToMeet) card.lookingToMeet = dp.lookingToMeet;
  ["gender", "height", "nightlifeStyle", "lookingToMeet", "city", "region", "country", "instagram", "instagramHandle", "website"].forEach(key => {
    if (!card[key]) delete card[key];
  });
  ["music", "events", "travel", "futureTravel", "hobbies", "food", "beverages", "roles", "imageUrls"].forEach(key => {
    if (Array.isArray(card[key]) && !card[key].length) delete card[key];
  });
  return card;
}

function isSelfProfileQuery(raw) {
  const n = normalizeNeedle(raw);
  if (!n) return false;
  if (/^(me|myself|my profile|my account|my info|my information|about me|who am i)$/.test(n)) return true;
  if (/^(what (?:do you )?know about (?:me|myself)|tell me about (?:me|myself)|describe (?:me|myself))$/.test(n)) return true;
  return false;
}

/** Exclusive self: me / who am I / my profile. Shared first/last names never skip the directory. */
function isExclusiveSelfQuery(raw) {
  const n = normalizeNeedle(raw);
  if (!n) return false;
  if (isSelfProfileQuery(n)) return true;
  if (/^(me|myself|mine)$/.test(n)) return true;
  const myAsk = /\b(my|mine)\b/.test(n);
  const profileAsk = /\b(profile|public|floqr|mingl)\b/.test(n);
  if (myAsk && profileAsk) return true;
  if (myAsk && /\b(food|music|travel|hobby|hobbies|eat|drink|beverage|handle|bio|photo)\b/.test(n)) {
    if (!/\b(at|for)\b/.test(n)) return true;
  }
  return false;
}

function hasPhrase(hay, phrase) {
  const p = normalizeNeedle(phrase);
  if (!p || p.length < 3) return false;
  return ` ${hay} `.includes(` ${p} `);
}

function isSelfQuery(needle, viewerData = {}) {
  const n = normalizeNeedle(needle);
  if (!n) return false;
  if (isExclusiveSelfQuery(needle)) return true;
  const aliases = identityAliases(viewerData);
  const squeezed = squeezeNeedle(needle);
  if (aliases.some(alias => alias === n || (squeezed && alias === squeezed))) return true;
  if (aliases.some(alias => alias.length >= 4 && hasPhrase(n, alias))) return true;
  return false;
}

const PEOPLE_LOOKUP_STOPS = new Set([
  "my", "friend", "buddy", "mate", "about", "know", "what", "who", "is", "are", "was", "were",
  "this", "person", "you", "the", "do", "me", "named", "connection", "mingl"
]);

/**
 * Identity-only people ranking without Firestore. Exclusive self (me / who am I)
 * returns only the viewer. A shared first/last name still ranks other public hits.
 */
function rankPeopleIdentityHits({query, viewerUid, viewerData = {}, directory = []} = {}) {
  const rawQuery = text(query, 160);
  const exclusiveSelf = isExclusiveSelfQuery(rawQuery);
  const friendContext = isFriendContextQuery(rawQuery);
  const friendName = friendContext ? friendNameFromQuery(rawQuery) : "";
  const needle = normalizeNeedle(rawQuery);
  const matchNeedle = friendContext ? friendName : needle;
  const tokens = String(matchNeedle || "")
    .split(/\s+/)
    .filter(t => t.length > 1 && !PEOPLE_LOOKUP_STOPS.has(t) && !FRIEND_NAME_STOPS.has(t));
  const scored = [];
  const seen = new Set();
  const selfIdentityHit = !!(viewerUid && viewerData && !friendContext && matchNeedle
    && scorePerson(viewerData, matchNeedle, tokens) >= 8);
  // Exclusive self, or a shared name on a non-friend lookup. Friend asks stay on connections.
  if (viewerUid && viewerData && (exclusiveSelf || selfIdentityHit)) {
    scored.push(selfProfileCard(viewerUid, viewerData, 100, {relation: "self"}));
    seen.add(viewerUid);
  }
  if (!exclusiveSelf && matchNeedle) {
    directory.forEach(row => {
      const id = String(row && row.id || "").trim();
      const data = row && row.data || {};
      if (!id || seen.has(id)) return;
      if (!people.isPublic(data)) return;
      const base = scorePerson(data, matchNeedle, tokens);
      if (base < 8) return;
      const relation = row.relation === "connection" ? "connection" : "public";
      const bonus = relation === "connection" ? (friendContext ? 12 : 6) : 0;
      scored.push(publicUserCard(id, data, base + bonus, {relation}));
      seen.add(id);
    });
  }
  scored.sort((a, b) => b.score - a.score || String(a.displayName).localeCompare(String(b.displayName)));
  return {
    exclusiveSelf,
    selfQuery: exclusiveSelf,
    friendContext,
    ids: scored.map(row => row.id),
    profiles: scored
  };
}

function unpublishedSelfCard(uid, data = {}, score, extra = {}) {
  const handle = text(data.floqrHandle || data.username || data.minglHandle, 80).replace(/^@+/, "");
  return {
    kind: "user",
    id: uid,
    isSelf: true,
    relation: extra.relation || "self",
    published: false,
    visibility: text(data.publicProfileVisibility || "followers", 24),
    displayName: text(data.displayName || data.publicName || handle || "Member", 120),
    handle: handle ? `@${handle}` : "",
    note: "This FLOQR profile is not public. Other people cannot see volunteered public datapoints (music, food, travel, hobbies, location). Do not describe those fields as public.",
    score,
    ...extra
  };
}

function selfProfileCard(uid, data = {}, score, extra = {}) {
  if (people.isPublic(data)) {
    return publicUserCard(uid, data, score, {isSelf: true, published: true, ...extra});
  }
  return unpublishedSelfCard(uid, data, score, extra);
}

function injectSelfProfile(scored, viewerUid, viewerData, selfAsk) {
  if (!selfAsk || !viewerUid || !viewerData) return scored;
  if (scored.some(row => row.id === viewerUid)) return scored;
  scored.push(selfProfileCard(viewerUid, viewerData, 48, {relation: "self"}));
  return scored;
}

function isFriendContextQuery(raw) {
  // Do not treat bare “Mingl” as friend context — that blocked normal name lookups (e.g. “James on Mingl”).
  return /\b(?:my\s+)?(?:friend|buddy|mate|connection)\b/i.test(String(raw || ""));
}

const FRIEND_NAME_STOPS = new Set([
  "from", "at", "in", "the", "a", "an", "who", "that", "this", "with", "on", "of",
  "club", "venue", "here", "there", "someone", "anybody", "anyone", "named", "called"
]);

/** Extract the person name from “my friend James” / “my friend, Erny”. */
function friendNameFromQuery(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(
    /\b(?:my\s+)?(?:friend|buddy|mate|connection)(?:\s+named)?[,:\s]+([@A-Za-z][\w.\-']*(?:\s+[A-Za-z][\w.\-']*){0,2})\b/i
  ) || s.match(
    /\b(?:about|know about)\s+(?:my\s+)?(?:friend|buddy|mate)[,:\s]+([@A-Za-z][\w.\-']+)/i
  );
  if (!m) return "";
  const parts = normalizeNeedle(m[1])
    .split(/\s+/)
    .filter(part => part && !FRIEND_NAME_STOPS.has(part));
  if (!parts.length || FRIEND_NAME_STOPS.has(parts[0])) return "";
  return parts.join(" ");
}

async function loadConnectedUids(uid) {
  const ids = new Set();
  try {
    const [connections, rooms] = await Promise.all([
      db.collection("minglConnections").where("participants", "array-contains", uid).limit(500).get(),
      db.collection("chatRooms").where("participants", "array-contains", uid).limit(500).get()
    ]);
    [...connections.docs, ...rooms.docs].forEach(doc => {
      (doc.data()?.participants || []).forEach(other => {
        if (other && other !== uid) ids.add(String(other));
      });
    });
  } catch (error) {
    console.warn("BOT DEE loadConnectedUids failed", error?.message || error);
  }
  return ids;
}

/** Match club-profile / feature-gates public visibility — never leak offboarded or unpublished clubs. */
function isClubPublic(data = {}) {
  if (!data || typeof data !== "object") return false;
  if (data.offboarded === true) return false;
  const status = String(data.status || "").trim().toLowerCase();
  if (["offboarded", "deleted", "disabled"].includes(status)) return false;
  if (data.publicProfilePublished === false) return false;
  if (data.publicVisible === false || data.publicProfileEnabled === false) return false;
  if (data.active === false) return false;
  if (data.appEnabled === false) return false;
  const visibility = String(data.visibility || "public").trim().toLowerCase();
  if (visibility && visibility !== "public") return false;
  return true;
}

function publicClubCard(id, data = {}, score) {
  const images = imageUrlsFromClub(data);
  const name = text(data.locationName || data.brandName || data.name || id, 140);
  const cuisine = text(Array.isArray(data.cuisines) ? data.cuisines.join(" / ") : (data.cuisine || ""), 160);
  const cuisines = listish(data.cuisines && data.cuisines.length ? data.cuisines : data.cuisine)
    .slice(0, 8)
    .map(item => text(item, 40));
  return {
    kind: "club",
    id,
    displayName: name,
    brandName: text(data.brandName || "", 120),
    bio: text(data.description || data.publicBio || data.tagline || data.about || "", 400),
    city: text(data.city || data.publicCity || "", 80),
    country: text(data.country || "", 80),
    cuisine,
    cuisines,
    categories: listish(data.categories).slice(0, 8).map(item => text(item, 40)),
    genres: Array.isArray(data.genres) ? data.genres.filter(Boolean).slice(0, 8).map(g => text(g, 40)) : [],
    website: text(data.website || data.websiteUrl || data.officialWebsite || "", 240),
    photoURL: images[0] || "",
    imageUrls: images,
    profileHref: `./club-profile.html?location=${encodeURIComponent(id)}`,
    score
  };
}

/** Interest/bio blob for volunteered datapoints — NOT used to find people. */
function userHaystack(data = {}) {
  const parts = [
    data.displayName, data.publicName, data.fullName, data.firstName, data.lastName,
    data.username, data.floqrHandle, data.minglHandle, data.publicBio, data.bio, data.tagline, data.about,
    data.headline, data.instagram, data.instagramHandle, data.website, data.publicWebsite,
    ...(Array.isArray(data.approvedRoles) ? data.approvedRoles : []),
    ...(Array.isArray(data.genres) ? data.genres : []),
    ...(Array.isArray(data.interests) ? data.interests : [])
  ];
  if (datapointAllowed(data, "location")) {
    parts.push(data.city, data.publicCity, data.state, data.region, data.country, data.publicCountry);
  }
  if (datapointAllowed(data, "gender")) parts.push(data.gender);
  if (datapointAllowed(data, "height")) parts.push(heightDisplay(data));
  if (datapointAllowed(data, "music")) parts.push(...listField(data.musicInterests || data.favoriteGenres));
  if (datapointAllowed(data, "events")) parts.push(data.nightlifeStyle, ...listField(data.nightlifeInterests));
  if (datapointAllowed(data, "travel")) {
    parts.push(...listField(data.priorTravels?.length ? data.priorTravels : data.travelInterests));
    parts.push(...listField(data.futureTravelDestinations));
  }
  if (datapointAllowed(data, "hobbies")) parts.push(...listField(data.hobbies || data.generalHobbies));
  if (datapointAllowed(data, "food")) parts.push(...listField(data.foodChoices));
  if (datapointAllowed(data, "beverage")) parts.push(...listField(data.favoriteBeverages));
  if (datapointAllowed(data, "meet")) parts.push(data.lookingToMeet);
  return parts.filter(Boolean).join(" ");
}

/**
 * Authorized BOT DEE tool — public patron + club profiles (incl. image URLs) only.
 * Also answers "about me" (viewer's own public-facing fields) and prefers Mingl/chat
 * connections when the patron asks about a friend.
 */
async function lookupPublicProfiles(args = {}, sessionRequest) {
  if (!sessionRequest?.auth?.uid) {
    return {ok: false, error: "Sign in to look up public profiles.", code: "unauthenticated"};
  }
  const rawQuery = text(args.query, 160);
  const needle = normalizeNeedle(rawQuery);
  if (!needle || needle.length < 2) {
    return {ok: false, error: "Send a name, @handle, me, or club to look up.", code: "invalid-argument"};
  }
  const kind = String(args.kind || "any").trim().toLowerCase();
  const limit = Math.min(PUBLIC_PROFILE_MAX, Math.max(1, Number(args.limit) || 5));
  const viewerUid = sessionRequest.auth.uid;
  const scored = [];
  const seen = new Set();
  const place = classifyPlaceSearchIntent(rawQuery);
  const diningOrVenue = place.intent === "dining" || place.intent === "venue";
  const wantPeople = !diningOrVenue && (kind === "any" || kind === "user" || kind === "patron" || kind === "people");
  const wantClubs = diningOrVenue || kind === "any" || kind === "club" || kind === "venue";
  let viewerData = null;
  try {
    const viewerSnap = await db.collection("users").doc(viewerUid).get();
    if (viewerSnap.exists) viewerData = viewerSnap.data() || {};
  } catch (error) {
    console.warn("BOT DEE lookupPublicProfiles viewer failed", error?.message || error);
  }
  const exclusiveSelf = wantPeople && isExclusiveSelfQuery(rawQuery);
  const friendContext = wantPeople && isFriendContextQuery(rawQuery);
  const friendName = friendContext ? friendNameFromQuery(rawQuery) : "";
  // Friend prompts require a parseable person name — never fall back to leftover verbs
  // (“is”, “look”, …) that would substring-match unrelated public bios.
  const matchNeedle = friendContext ? friendName : needle;
  const tokens = String(matchNeedle || "")
    .split(/\s+/)
    .filter(t => t.length > 1 && !PEOPLE_LOOKUP_STOPS.has(t) && !FRIEND_NAME_STOPS.has(t));
  const selfIdentityHit = wantPeople && viewerData && !friendContext && matchNeedle
    && scorePerson(viewerData, matchNeedle, tokens) >= 8;
  // Shared first/last names include the viewer AND the public directory.
  // Friend asks stay on connections — never inject the signed-in namesake.
  if (wantPeople && viewerData && (exclusiveSelf || selfIdentityHit)) {
    scored.push(selfProfileCard(viewerUid, viewerData, 100, {relation: "self"}));
    seen.add(viewerUid);
  }

  let connected = new Set();
  if (wantPeople && (friendContext || !exclusiveSelf)) {
    connected = await loadConnectedUids(viewerUid);
  }

  if (wantPeople && connected.size && !exclusiveSelf && matchNeedle) {
    try {
      const ids = [...connected].slice(0, 100);
      const refs = ids.map(id => db.collection("users").doc(id));
      const snaps = refs.length ? await db.getAll(...refs) : [];
      snaps.forEach(doc => {
        if (!doc.exists || seen.has(doc.id)) return;
        const data = doc.data() || {};
        // Connections: public profiles only — never private fields.
        if (!people.isPublic(data)) return;
        const base = scorePerson(data, matchNeedle, tokens);
        // Require a real name/handle match (threshold 8). Identity-only. No free pass for “friend” alone.
        if (base < 8) return;
        const points = base + (friendContext ? 12 : 6);
        scored.push(publicUserCard(doc.id, data, points, {relation: "connection"}));
        seen.add(doc.id);
      });
    } catch (error) {
      console.warn("BOT DEE lookupPublicProfiles connections failed", error?.message || error);
    }
  }

  // Public directory for non-friend queries only. Friend asks stay on connections + parsed name.
  // Exclusive self (me / who am I) skips the directory; a shared first name does not.
  if (wantPeople && !exclusiveSelf && !friendContext && matchNeedle) {
    try {
      const snap = await db.collection("users")
        .where("publicProfileVisibility", "==", "public")
        .limit(PUBLIC_PROFILE_SCAN)
        .get();
      snap.docs.forEach(doc => {
        if (doc.id === viewerUid || seen.has(doc.id)) return;
        const data = doc.data() || {};
        if (!people.isPublic(data)) return;
        const base = scorePerson(data, matchNeedle, tokens);
        // Identity-only — bios / likes / drinks never invent hits.
        if (base < 8) return;
        const points = base + (connected.has(doc.id) ? 10 : 0);
        scored.push(publicUserCard(doc.id, data, points, {
          relation: connected.has(doc.id) ? "connection" : "public"
        }));
        seen.add(doc.id);
      });
    } catch (error) {
      console.warn("BOT DEE lookupPublicProfiles users failed", error?.message || error);
    }
  }

  if (wantClubs && !exclusiveSelf && !friendContext) {
    const clubTokens = needle.split(/\s+/).filter(t => t.length > 1 && !PEOPLE_LOOKUP_STOPS.has(t));
    try {
      const snap = await db.collection("clubLocations").limit(PUBLIC_PROFILE_SCAN).get();
      snap.docs.forEach(doc => {
        const data = doc.data() || {};
        if (!isClubPublic(data)) return;
        let points = 0;
        if (diningOrVenue) {
          points = scoreClubForPlace(doc.id, data, place);
        } else {
          const hay = clubHaystack(doc.id, data);
          points = scoreHay(hay, needle, clubTokens);
        }
        if (normalizeNeedle(doc.id) === needle) points += 20;
        if (points >= 8) scored.push(publicClubCard(doc.id, data, points));
      });
    } catch (error) {
      console.warn("BOT DEE lookupPublicProfiles clubs failed", error?.message || error);
    }
  }

  scored.sort((a, b) => b.score - a.score || String(a.displayName).localeCompare(String(b.displayName)));
  const profiles = scored.slice(0, limit).map(row => {
    const {score, ...rest} = row;
    return rest;
  });
  let note = "No public profiles matched. Ask the user to clarify the name or check spelling.";
  if (diningOrVenue && !profiles.length) {
    note = "No onboarded FLOQR venue matched this dining/place query. Say FLOQR does not list that kind of spot yet. Do not invent Google/Yelp restaurants. Do not look up patrons. Do not pitch ShoutOut, VIP reserV, or floqCast.";
  } else if (diningOrVenue && profiles.length) {
    note = "These are onboarded FLOQR venues (not patrons). Summarize name, city, cuisine, and point to the FLOQR public page. Never pitch ShoutOut, VIP reserV, or floqCast unless the user asked. Never print image URLs.";
  } else if (profiles.length) {
    note = "Viewer-context public volunteered datapoints (not PII/PCI — never email, phone, PAN, GPS). sharedDatapoints = keys this patron opted to publish. datapoints = every filled value for those keys — use ALL of them. A missing key is opted out or empty, not “FLOQR doesn’t track that.” photoCount photos are shown by the FLOQR app — never print URLs, tokens, or storage paths.";
  } else if (exclusiveSelf) {
    note = "Could not load the viewer's profile yet. Ask them to open My Profile.";
  } else if (friendContext) {
    note = friendName
      ? `No Mingl/chat connection matched "${friendName}" with a public profile. Ask them to check spelling, or that friend may not have a public profile.`
      : "Name a friend (for example: my friend James) so I can look up their public profile among your connections.";
  }
  return {
    ok: true,
    tool: "lookupPublicProfiles",
    query: rawQuery,
    kind: kind === "patron" || kind === "people" ? "user" : (kind === "venue" ? "club" : kind),
    selfQuery: !!exclusiveSelf,
    friendContext: !!friendContext,
    count: profiles.length,
    profiles,
    note
  };
}

const TOOL_RUNNERS = {
  listShoutOutTemplates,
  startShoutOutCheckout,
  getVipAvailability,
  createVipHold,
  recordVipConsent,
  createVipCheckout,
  createFloqCastRequest,
  createFloqCastCheckout,
  lookupPublicProfiles
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
  loadTemplateCollectableRow,
  loadCollectableTemplateCards,
  startShoutOutCheckout,
  getVipAvailability,
  getVipFloorStatus,
  createVipHold,
  releaseVipHold,
  recordVipConsent,
  createVipCheckout,
  createFloqCastRequest,
  createFloqCastCheckout,
  lookupPublicProfiles,
  classifyPlaceSearchIntent,
  classifyPlaceSearchFromConversation,
  primeCityCatalog,
  invalidateCityCatalog,
  matchPlaces,
  skipPlaceSearchPrompt,
  placeSearchAlongsideRoom,
  placeAttachQuery,
  destinationSmartView,
  destinationPlaceViews,
  clubHaystack,
  scoreClubForPlace,
  rankPublicClubs,
  attachVenueSearch,
  publicClubCard,
  clubSmartView,
  applyPlaceBackgroundOverride,
  applyPlaceVisualOverride,
  attachPublishedBackgroundUrl,
  stampPublishedPlaceViews,
  catalogPlaceIdFromTokens,
  catalogBackgroundIdForTags,
  applyTaggedCatalogBackground,
  publishedBackgroundDataUrl,
  loadPlaceBackgroundOverride,
  loadPlaceVisualOverride,
  clubToResult,
  isClubPublic,
  isSelfProfileQuery,
  isExclusiveSelfQuery,
  rankPeopleIdentityHits,
  isFriendContextQuery,
  friendNameFromQuery,
  publicUserCard,
  publicUserFacts,
  volunteeredPublicDatapoints,
  PUBLIC_MINGL_DATAPOINT_KEYS,
  publicMinglKeys,
  datapointAllowed,
  userHaystack,
  PEOPLE_IDENTITY_HANDLE_KEYS,
  identityAliases,
  identityNameValues,
  identityHandleValues,
  scoreIdentity,
  scorePerson,
  normalizeNeedle,
  foldNameChars,
  isSelfQuery,
  unpublishedSelfCard,
  selfProfileCard,
  injectSelfProfile,
  resolveClubLocationId,
  requireClubLocationId,
  loadPatronShoutOutAttribution,
  notifyClubPendingHeadlessShoutOut,
  normalizeClubNeedle,
  CLUB_NAME_ALIASES
};
