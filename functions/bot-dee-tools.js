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
  const rawClub = text(payload.clubLocationId || args?.clubLocationId || args?.locationName, 120);
  const shoutout = payload.shoutout && typeof payload.shoutout === "object"
    ? payload.shoutout
    : (args?.shoutout && typeof args.shoutout === "object" ? args.shoutout : null);
  if (!rawClub || !shoutout) {
    throw new HttpsError("invalid-argument", "startShoutOutCheckout needs clubLocationId and shoutout payload.");
  }
  const clubLocationId = await requireClubLocationId(rawClub);
  const result = await checkout.runCreateFloqrCheckoutSession(asRequest(sessionRequest, {
    orderType: "shoutout",
    payload: {clubLocationId, shoutout, priceCents: args?.priceCents || payload.priceCents},
    returnBase: args?.returnBase,
    correlationId: args?.correlationId
  }));
  return {ok: true, tool: "startShoutOutCheckout", clubLocationId, ...result};
}

async function createVipHold(args, sessionRequest) {
  await featureAccess.assertFeatureAccess(sessionRequest.auth, "vipReservations", sessionRequest);
  const clubLocationId = await requireClubLocationId(args?.clubLocationId || args?.locationName);
  const result = await vip.runCreateVipHold(asRequest(sessionRequest, {
    clubLocationId,
    night: args?.night,
    sectionId: args?.sectionId,
    partySize: args?.partySize
  }));
  return {ok: true, tool: "createVipHold", clubLocationId, ...result};
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
        ? `./vip.html?vipPaid=1&collector=clubPos&reservationId=${encodeURIComponent(result.reservationId)}`
        : "./vip.html?vipPaid=1&collector=clubPos",
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
        passHref: "./vip.html?vipPaid=1",
        ...result
      };
    }
  }

  // floqrStripe / clubStripe (and charged manual CSV) → FloqR Checkout Session URL.
  const result = await checkout.runCreateFloqrCheckoutSession(asRequest(sessionRequest, {
    orderType: "vipReservation",
    payload: {holdId, consentId},
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

function normalizeNeedle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9@\s._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function imageUrlsFromUser(data = {}) {
  const urls = [];
  const push = value => {
    const url = text(value, 500);
    if (url && /^https?:\/\//i.test(url) && !urls.includes(url) && urls.length < 8) urls.push(url);
  };
  push(data.photoURL);
  push(data.profilePhotoUrl);
  push(data.mainPhotoUrl);
  push(data.avatarUrl);
  push(data.publicPhotoUrl);
  (Array.isArray(data.profileMediaSlots) ? data.profileMediaSlots : []).forEach(slot => {
    if (slot && slot.type !== "video") push(slot.url || slot.mediaUrl);
  });
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
  push(data.coverPhotoUrl || data.coverImageUrl || data.mainPhotoUrl || data.logoUrl || data.brandLogoUrl);
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
  if (labeled) return labeled;
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
    const travel = listField(data.travelInterests);
    if (travel.length) datapoints.travel = travel;
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
  if (allowed("media")) datapoints.photoCount = imageUrlsFromUser(data).length;
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
  const allowed = key => datapointAllowed(data, key);
  const images = allowed("media") ? imageUrlsFromUser(data) : [];
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
  if (dp.hobbies) card.hobbies = dp.hobbies;
  if (dp.food) card.food = dp.food;
  if (dp.beverages) card.beverages = dp.beverages;
  if (dp.lookingToMeet) card.lookingToMeet = dp.lookingToMeet;
  ["gender", "height", "nightlifeStyle", "lookingToMeet", "city", "region", "country", "instagram", "instagramHandle", "website"].forEach(key => {
    if (!card[key]) delete card[key];
  });
  ["music", "events", "travel", "hobbies", "food", "beverages", "roles", "imageUrls"].forEach(key => {
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

function hasPhrase(hay, phrase) {
  const p = normalizeNeedle(phrase);
  if (!p || p.length < 3) return false;
  return ` ${hay} `.includes(` ${p} `);
}

function isSelfQuery(needle, viewerData = {}) {
  const n = normalizeNeedle(needle);
  if (!n) return false;
  if (isSelfProfileQuery(n)) return true;
  if (/^(me|myself|mine)$/.test(n)) return true;
  const myAsk = /\b(my|mine)\b/.test(n);
  const profileAsk = /\b(profile|public|floqr|mingl)\b/.test(n);
  if (myAsk && profileAsk) return true;
  if (myAsk && /\b(food|music|travel|hobby|hobbies|eat|drink|beverage|handle|bio|photo)\b/.test(n)) {
    if (!/\b(at|for)\b/.test(n)) return true;
  }
  const handle = normalizeNeedle(viewerData.floqrHandle || viewerData.username || viewerData.minglHandle || "");
  const name = normalizeNeedle(viewerData.displayName || viewerData.publicName || "");
  if (handle && (n === handle || hasPhrase(n, handle))) return true;
  if (name && name.length >= 4 && hasPhrase(n, name)) return true;
  return false;
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
  return {
    kind: "club",
    id,
    displayName: name,
    brandName: text(data.brandName || "", 120),
    bio: text(data.description || data.publicBio || data.tagline || data.about || "", 400),
    city: text(data.city || "", 80),
    country: text(data.country || "", 80),
    genres: Array.isArray(data.genres) ? data.genres.filter(Boolean).slice(0, 8).map(g => text(g, 40)) : [],
    website: text(data.website || data.websiteUrl || "", 240),
    photoURL: images[0] || "",
    imageUrls: images,
    profileHref: `./club-profile.html?location=${encodeURIComponent(id)}`,
    score
  };
}

function userHaystack(data = {}) {
  const parts = [
    data.displayName, data.publicName, data.fullName, data.username,
    data.floqrHandle, data.minglHandle, data.publicBio, data.bio, data.tagline, data.about,
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
  if (datapointAllowed(data, "travel")) parts.push(...listField(data.travelInterests));
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
  const stop = new Set(["my", "friend", "buddy", "mate", "about", "know", "what", "you", "the", "do", "me", "named", "connection", "mingl"]);
  const viewerUid = sessionRequest.auth.uid;
  const scored = [];
  const seen = new Set();
  const wantPeople = kind === "any" || kind === "user" || kind === "patron" || kind === "people";
  const wantClubs = kind === "any" || kind === "club" || kind === "venue";
  let viewerData = null;
  try {
    const viewerSnap = await db.collection("users").doc(viewerUid).get();
    if (viewerSnap.exists) viewerData = viewerSnap.data() || {};
  } catch (error) {
    console.warn("BOT DEE lookupPublicProfiles viewer failed", error?.message || error);
  }
  const selfQuery = wantPeople && isSelfQuery(rawQuery, viewerData || {});
  const friendContext = wantPeople && isFriendContextQuery(rawQuery);
  const friendName = friendContext ? friendNameFromQuery(rawQuery) : "";
  // Friend prompts require a parseable person name — never fall back to leftover verbs
  // (“is”, “look”, …) that would substring-match unrelated public bios.
  const matchNeedle = friendContext ? friendName : needle;
  const tokens = String(matchNeedle || "")
    .split(/\s+/)
    .filter(t => t.length > 1 && !stop.has(t) && !FRIEND_NAME_STOPS.has(t));

  if (wantPeople && selfQuery && viewerData) {
    scored.push(selfProfileCard(viewerUid, viewerData, 100, {relation: "self"}));
    seen.add(viewerUid);
  }

  let connected = new Set();
  if (wantPeople && (friendContext || !selfQuery)) {
    connected = await loadConnectedUids(viewerUid);
  }

  if (wantPeople && connected.size && !selfQuery && matchNeedle) {
    try {
      const ids = [...connected].slice(0, 100);
      const refs = ids.map(id => db.collection("users").doc(id));
      const snaps = refs.length ? await db.getAll(...refs) : [];
      snaps.forEach(doc => {
        if (!doc.exists || seen.has(doc.id)) return;
        const data = doc.data() || {};
        // Connections: public profiles only — never private fields.
        if (!people.isPublic(data)) return;
        const base = scoreHay(userHaystack(data), matchNeedle, tokens);
        // Require a real name/handle match (threshold 8). No free pass for “friend” alone.
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
  if (wantPeople && !selfQuery && !friendContext && matchNeedle) {
    try {
      const snap = await db.collection("users")
        .where("publicProfileVisibility", "==", "public")
        .limit(PUBLIC_PROFILE_SCAN)
        .get();
      snap.docs.forEach(doc => {
        if (doc.id === viewerUid || seen.has(doc.id)) return;
        const data = doc.data() || {};
        if (!people.isPublic(data)) return;
        const base = scoreHay(userHaystack(data), matchNeedle, tokens);
        // Must match the query first — connection boost must not invent hits.
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

  if (wantClubs && !selfQuery && !friendContext) {
    const clubTokens = needle.split(/\s+/).filter(t => t.length > 1 && !stop.has(t));
    try {
      const snap = await db.collection("clubLocations").limit(PUBLIC_PROFILE_SCAN).get();
      snap.docs.forEach(doc => {
        const data = doc.data() || {};
        if (!isClubPublic(data)) return;
        const hay = [
          doc.id, data.locationName, data.brandName, data.name, data.city, data.country,
          data.description, data.publicBio, data.tagline,
          ...(Array.isArray(data.genres) ? data.genres : []),
          ...(Array.isArray(data.artists) ? data.artists : []),
          ...(Array.isArray(data.djs) ? data.djs : [])
        ].filter(Boolean).join(" ");
        const points = scoreHay(hay, needle, clubTokens) + (normalizeNeedle(doc.id) === needle ? 20 : 0);
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
  if (profiles.length) {
    note = "Viewer-context public volunteered datapoints (not PII/PCI — never email, phone, PAN, GPS). sharedDatapoints = keys this patron opted to publish. datapoints = every filled value for those keys — use ALL of them. A missing key is opted out or empty, not “FLOQR doesn’t track that.” photoCount photos are shown by the FLOQR app — never print URLs, tokens, or storage paths.";
  } else if (selfQuery) {
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
    selfQuery: !!selfQuery,
    friendContext: !!friendContext,
    count: profiles.length,
    profiles,
    note
  };
}

const TOOL_RUNNERS = {
  listShoutOutTemplates,
  startShoutOutCheckout,
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
  startShoutOutCheckout,
  createVipHold,
  recordVipConsent,
  createVipCheckout,
  createFloqCastRequest,
  createFloqCastCheckout,
  lookupPublicProfiles,
  isClubPublic,
  isSelfProfileQuery,
  isFriendContextQuery,
  friendNameFromQuery,
  publicUserCard,
  publicUserFacts,
  volunteeredPublicDatapoints,
  PUBLIC_MINGL_DATAPOINT_KEYS,
  publicMinglKeys,
  datapointAllowed,
  userHaystack,
  isSelfQuery,
  unpublishedSelfCard,
  selfProfileCard,
  injectSelfProfile,
  resolveClubLocationId,
  requireClubLocationId,
  normalizeClubNeedle,
  CLUB_NAME_ALIASES
};
