/**
 * Display Security Cloud Functions
 * Features:
 *  1) checkDisplayAccess — public callable used by display.html/display2.html.
 *     Observes client public IP, validates optional allowlist + per-board ?k= token, writes displayAccessLogs.
 *     On deny: notifies Master Admins (inboxNotifications + Master Admin system messages feed).
 *  2) setVenueDisplayIps — Master Admin saves IP allowlist + token-required flag.
 *  3) provisionVenueDisplayTokens — club onboarding creates Display 1/2 secrets; cleartext returned once.
 *  4) getVenueDisplayTokens — Master Admin Security portal; obfuscated tokens only.
 *  5) rotateVenueDisplayToken — issues a new secret; cleartext URL returned once for Xibo paste.
 *  6) listDisplayAccessLogs — per-venue access history for Master Admin.
 *  7) reportDisplayLoadError — public callable from display-error.html (Xibo page-load fallback).
 *     Writes diagnostic appLogs (30-day retention). Not a security deny event.
 * Secrets collection: displayBoardSecrets/{locationId} (not publicly readable).
 */
const crypto = require("crypto");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const MASTER_ADMIN_EMAILS = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

const PUBLIC_DISPLAY_BASE = String(process.env.FLOQR_DISPLAY_BASE_URL || "https://jadzadco.github.io/shoutout-demo").replace(/\/$/, "");

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function emailOf(authContext = {}) {
  return text(authContext.token?.email, 200).toLowerCase();
}

async function assertMasterAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Master Admin sign-in is required.");
  const email = emailOf(request.auth);
  if (request.auth.token?.masterAdmin === true || MASTER_ADMIN_EMAILS.includes(email)) return email;
  const snap = await db.collection("users").doc(request.auth.uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  if (data.masterAdmin === true || (data.roles || []).includes("masterAdmin")) return email;
  throw new HttpsError("permission-denied", "Master Admin access is required.");
}

function normalizeIp(raw = "") {
  let ip = String(raw || "").trim().toLowerCase();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  return ip.slice(0, 80);
}

function parseAllowlist(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || "").split(/[\n,;]+/);
  const out = [];
  const seen = new Set();
  list.forEach((entry) => {
    const ip = normalizeIp(entry);
    if (!ip || seen.has(ip)) return;
    seen.add(ip);
    out.push(ip);
  });
  return out.slice(0, 64);
}

function displayDeviceDocId(ip = "") {
  return normalizeIp(ip)
    .replace(/[^a-z0-9.:_-]/g, "-")
    .replace(/\.+/g, "_")
    .slice(0, 120);
}

/** Expand IPv6 (:: shorthand) to 8 hextets for stable compare / CIDR checks. */
function expandIpv6(raw = "") {
  let ip = normalizeIp(raw);
  if (!ip || !ip.includes(":")) return "";
  if (ip.startsWith("::ffff:") && ip.includes(".")) return ""; // mapped v4 handled separately
  const sides = ip.split("::");
  let head = (sides[0] ? sides[0].split(":") : []).filter(Boolean);
  let tail = sides.length > 1 ? (sides[1] ? sides[1].split(":") : []).filter(Boolean) : [];
  if (sides.length === 1) {
    head = ip.split(":").filter(Boolean);
    tail = [];
  }
  const missing = 8 - (head.length + tail.length);
  if (missing < 0) return "";
  const mid = Array(missing).fill("0");
  const full = [...head, ...mid, ...tail].map((p) => p.padStart(4, "0").toLowerCase());
  if (full.length !== 8) return "";
  return full.join(":");
}

function ipv6ToBigInt(expanded = "") {
  const parts = String(expanded || "").split(":");
  if (parts.length !== 8) return null;
  let n = 0n;
  for (const p of parts) {
    n = (n << 16n) + BigInt(parseInt(p, 16) || 0);
  }
  return n;
}

function isIpv4(ip = "") {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(normalizeIp(ip));
}

function isIpv6(ip = "") {
  const v = normalizeIp(ip);
  return v.includes(":") && !isIpv4(v.replace(/^::ffff:/, ""));
}

/**
 * Feature: Display Security IP allowlist matching.
 * Supports: exact IPv4/IPv6, trailing * prefix, IPv4 /24, IPv6 /64 (and other prefix lengths).
 * Xibo players often rotate within a venue IPv6 /64 — prefer that over a single host address.
 */
function ipMatches(clientIp, rule) {
  const ip = normalizeIp(clientIp);
  let r = normalizeIp(rule);
  if (!ip || !r) return false;

  // Exact (after normalize)
  if (ip === r) return true;

  // Trailing wildcard prefix (works for IPv4 and compressed IPv6 text forms)
  if (r.endsWith("*")) {
    const prefix = r.slice(0, -1);
    if (prefix && ip.startsWith(prefix)) return true;
    // Also compare expanded IPv6 against expanded prefix when possible
    if (isIpv6(ip) && prefix.includes(":")) {
      const expIp = expandIpv6(ip);
      const expPrefix = expandIpv6(prefix.endsWith(":") ? `${prefix}:` : prefix);
      // If prefix isn't a full address, fall back to string start on expanded form
      if (expIp && prefix && expIp.replace(/:/g, "").startsWith(prefix.replace(/:/g, "").slice(0, 4))) {
        // better: match first N hextets from rule before *
      }
      const hextets = prefix.replace(/::/g, ":").split(":").filter(Boolean);
      if (expIp && hextets.length) {
        const expParts = expIp.split(":");
        if (hextets.every((h, i) => expParts[i] === h.padStart(4, "0").toLowerCase())) return true;
      }
    }
  }

  // IPv4 /24 shorthand
  const cidr24 = r.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.0\/24$/);
  if (cidr24 && isIpv4(ip) && ip.startsWith(`${cidr24[1]}.`)) return true;

  // General CIDR: a.b.c.d/nn or IPv6/nn
  const cidr = r.match(/^(.+?)\/(\d{1,3})$/);
  if (cidr) {
    const base = normalizeIp(cidr[1]);
    const bits = Number(cidr[2]);
    if (isIpv4(ip) && isIpv4(base) && bits >= 0 && bits <= 32) {
      const toInt = (v) => v.split(".").reduce((a, o) => ((a << 8) + (Number(o) || 0)) >>> 0, 0);
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (toInt(ip) & mask) === (toInt(base) & mask);
    }
    if ((isIpv6(ip) || expandIpv6(ip)) && (isIpv6(base) || expandIpv6(base)) && bits >= 0 && bits <= 128) {
      const a = ipv6ToBigInt(expandIpv6(ip));
      const b = ipv6ToBigInt(expandIpv6(base));
      if (a == null || b == null) return false;
      const shift = BigInt(128 - bits);
      return bits === 0 ? true : (a >> shift) === (b >> shift);
    }
  }

  // Exact IPv6 after expansion (compressed vs full)
  if (isIpv6(ip) && isIpv6(r)) {
    const a = expandIpv6(ip);
    const b = expandIpv6(r);
    if (a && b && a === b) return true;
  }
  return false;
}

function ipAllowed(clientIp, allowlist = []) {
  return (allowlist || []).some((rule) => ipMatches(clientIp, rule));
}

function extractClientIp(request) {
  const req = request.rawRequest || {};
  const headers = req.headers || {};
  const xf = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
  const real = String(headers["x-real-ip"] || "").trim();
  const raw = xf || real || req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "";
  return normalizeIp(raw);
}

function normalizeBoard(raw = "") {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "secondary" || v === "2" || v === "display2" || v === "displays" || v === "suprstar") return "secondary";
  if (v === "primary" || v === "1" || v === "display" || v === "display1" || v === "shoutout") return "primary";
  if (v === "master-admin" || v === "ip-probe") return v;
  return "primary";
}

function newDisplayToken() {
  // Feature: Xibo board secret (?k=) — cryptographically random, URL-safe.
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Feature: Master Admin Display Security — never re-show full secrets after onboarding/rotate.
 * Keeps a short suffix so operators can confirm which token is active without leaking it.
 */
function obfuscateToken(token = "") {
  const t = String(token || "");
  if (!t) return "";
  if (t.length <= 4) return "••••";
  const visible = t.slice(-4);
  return `${"•".repeat(Math.min(20, Math.max(8, t.length - 4)))}${visible}`;
}

function timingSafeEqualText(a = "", b = "") {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function boardPagePath(board = "primary") {
  return board === "secondary" ? "display2.html" : "display.html";
}

/** Stable Xibo webpage URL. No ?v= cache-bust — Xibo configs must stay fixed. */
function buildDisplayUrl(locationId, board, token = "") {
  const page = boardPagePath(board);
  const params = new URLSearchParams();
  params.set("location", locationId);
  if (token) params.set("k", token);
  return `${PUBLIC_DISPLAY_BASE}/${page}?${params.toString()}`;
}

/** Public-facing URL preview with obfuscated k= (not usable as a real Xibo URL). */
function buildObfuscatedDisplayUrl(locationId, board, token = "") {
  if (!token) return buildDisplayUrl(locationId, board, "");
  return buildDisplayUrl(locationId, board, obfuscateToken(token));
}

function tokenFieldForBoard(board = "primary") {
  return board === "secondary" ? "secondaryToken" : "primaryToken";
}

async function writeAccessLog(entry = {}) {
  const ref = db.collection("displayAccessLogs").doc();
  const row = {
    locationId: text(entry.locationId, 120),
    locationName: text(entry.locationName, 200),
    displayBoard: text(entry.displayBoard, 40) || "primary",
    clientIp: normalizeIp(entry.clientIp),
    reportedIp: normalizeIp(entry.reportedIp),
    // Hostname via reverse DNS when available; MAC cannot be read from a webpage/Xibo HTML widget.
    hostname: text(entry.hostname, 200),
    macAddress: text(entry.macAddress, 80) || "n/a",
    allowed: entry.allowed === true,
    restrictionEnabled: entry.restrictionEnabled === true,
    tokenRequired: entry.tokenRequired === true,
    tokenProvided: entry.tokenProvided === true,
    tokenOk: entry.tokenOk === true,
    reason: text(entry.reason, 240),
    pageUrl: text(entry.pageUrl, 500),
    userAgent: text(entry.userAgent, 400),
    screenFormatId: text(entry.screenFormatId, 80),
    language: text(entry.language, 40),
    timezone: text(entry.timezone, 80),
    platform: text(entry.platform, 120),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    logCategory: "security",
    expireAtMs: Date.now() + (90 * 24 * 60 * 60 * 1000)
  };
  await ref.set(row);
  return {id: ref.id, ...row};
}

const DISPLAY_DENIAL_NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;

/** Resolve Master Admin UIDs (email allowlist + users flagged masterAdmin). */
async function resolveMasterAdminUids(extraUids = []) {
  const uids = new Set([...(Array.isArray(extraUids) ? extraUids : [])].filter(Boolean));
  await Promise.all(MASTER_ADMIN_EMAILS.map(async (email) => {
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user?.uid) uids.add(user.uid);
    } catch (_) {}
  }));
  try {
    const snap = await db.collection("users").where("masterAdmin", "==", true).limit(40).get();
    snap.forEach((doc) => uids.add(doc.id));
  } catch (_) {}
  return [...uids];
}

/**
 * Feature: system message to Master Admin when a display page is denied.
 * Cooldown per venue+board+IP+reason so Xibo refresh loops do not flood FloqR Inbox.
 */
async function notifyMasterAdminsDisplayDenied(entry = {}) {
  const locationId = text(entry.locationId, 120);
  const displayBoard = text(entry.displayBoard, 40) || "primary";
  const clientIp = normalizeIp(entry.clientIp);
  const reason = text(entry.reason, 240) || "denied";
  if (!locationId) return {notified: false, reason: "missing_location"};

  const coolKey = crypto
    .createHash("sha1")
    .update(`${locationId}|${displayBoard}|${clientIp}|${reason}`)
    .digest("hex")
    .slice(0, 40);
  const coolRef = db.collection("displayDenialAlerts").doc(coolKey);
  const nowMs = Date.now();
  const coolSnap = await coolRef.get();
  const lastMs = Number(coolSnap.exists ? coolSnap.data()?.lastNotifiedAtMs || 0 : 0);
  if (lastMs && nowMs - lastMs < DISPLAY_DENIAL_NOTIFY_COOLDOWN_MS) {
    return {notified: false, reason: "cooldown", cooldownRemainingMs: DISPLAY_DENIAL_NOTIFY_COOLDOWN_MS - (nowMs - lastMs)};
  }

  const boardLabel = displayBoard === "secondary" ? "Display 2 (supRstar)" : "Display 1 (ShoutOut)";
  const locationName = text(entry.locationName, 200) || locationId;
  const title = "Display access denied";
  const body = [
    `${boardLabel} blocked for ${locationName}.`,
    clientIp ? `IP ${clientIp}.` : "",
    entry.hostname ? `Host ${text(entry.hostname, 120)}.` : "",
    `Reason: ${reason}.`,
    "Device was shown the Floq Media / FloqR not-configured message."
  ].filter(Boolean).join(" ");

  const recipientUids = await resolveMasterAdminUids(entry.masterAdminUids || []);
  if (!recipientUids.length) {
    await coolRef.set({
      locationId,
      displayBoard,
      clientIp,
      reason,
      lastNotifiedAtMs: nowMs,
      lastAttemptAtMs: nowMs,
      notifiedCount: 0,
      skipped: "no_master_admin_uids"
    }, {merge: true});
    return {notified: false, reason: "no_recipients"};
  }

  const note = {
    type: "displayAccessDenied",
    messageCategory: "security",
    title,
    subject: title,
    body,
    clubLocationId: locationId,
    locationName,
    displayBoard,
    clientIp,
    hostname: text(entry.hostname, 200),
    macAddress: text(entry.macAddress, 80) || "n/a",
    denialReason: reason,
    accessLogId: text(entry.logId, 120),
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: nowMs,
    link: `./master-admin.html#displaySecurity`
  };
  await Promise.all(recipientUids.map((uid) => db.collection("inboxNotifications").add({...note, recipientUid: uid})));
  await coolRef.set({
    locationId,
    displayBoard,
    clientIp,
    reason,
    lastNotifiedAtMs: nowMs,
    lastAttemptAtMs: nowMs,
    notifiedCount: admin.firestore.FieldValue.increment(1),
    recipientCount: recipientUids.length,
    skipped: ""
  }, {merge: true});
  return {notified: true, recipientCount: recipientUids.length};
}

/** Best-effort reverse DNS for log “Hostname” column (often empty for residential/CGNAT IPs). */
async function lookupHostname(ip = "") {
  const addr = normalizeIp(ip);
  if (!addr) return "";
  try {
    const dns = require("dns").promises;
    const names = await Promise.race([
      dns.reverse(addr),
      new Promise((resolve) => setTimeout(() => resolve([]), 800))
    ]);
    return text(Array.isArray(names) && names[0] ? names[0] : "", 200);
  } catch (_) {
    return "";
  }
}

exports.checkDisplayAccess = onCall({
  region: "us-central1",
  timeoutSeconds: 20,
  memory: "256MiB",
  invoker: "public"
}, async (request) => {
  const data = request.data || {};
  const locationId = text(data.locationId, 120).toLowerCase();
  if (!locationId) throw new HttpsError("invalid-argument", "locationId is required.");
  const displayBoard = normalizeBoard(data.displayBoard);
  const reportedIp = normalizeIp(data.reportedIp);
  const clientIp = extractClientIp(request);
  const accessToken = text(data.accessToken || data.k || data.token, 120);
  // Optional operator-supplied identifiers (browsers cannot read MAC; Xibo may pass ?mac= / ?host= if configured).
  const reportedHostname = text(data.reportedHostname || data.host || data.hostname, 200);
  const reportedMac = text(data.reportedMac || data.mac || data.macAddress, 80);
  const clubSnap = await db.collection("clubLocations").doc(locationId).get();
  const club = clubSnap.exists ? clubSnap.data() || {} : {};
  const secretsSnap = await db.collection("displayBoardSecrets").doc(locationId).get();
  const secrets = secretsSnap.exists ? secretsSnap.data() || {} : {};

  // Master Admin IP probe — never require a board token.
  const isProbe = displayBoard === "master-admin" || displayBoard === "ip-probe";

  const allowlist = parseAllowlist(club.approvedDisplayIps || club.displayApprovedIps || []);
  // Feature: lock displays — IP gate only active when enabled AND at least one allowlist entry exists.
  const ipRestrictionWanted = club.displayIpRestrictionEnabled === true;
  const ipRestrictionEnabled = ipRestrictionWanted && allowlist.length > 0;
  let ipOk = true;
  let ipReason = "ip_off";
  if (!isProbe && ipRestrictionEnabled) {
    // Only the real request egress IP counts — never trust client ?ip= / reportedIp for allowlisting.
    ipOk = ipAllowed(clientIp, allowlist);
    ipReason = ipOk ? "ip_allowlisted" : "ip_denied";
  } else if (!isProbe && ipRestrictionWanted && !allowlist.length) {
    // Fail closed: "IP restriction" checked but no IPs saved → deny (do not show idle).
    ipOk = false;
    ipReason = "restriction_enabled_empty_allowlist";
  }

  const expectedToken = text(secrets[tokenFieldForBoard(displayBoard)] || "", 120);
  // Feature: token lock and IP allowlist are independent.
  // - Token OFF (displayTokenRequired === false): idle/live allowed without ?k= (IP rules still apply).
  // - Token ON (default / true): require ?k= for idle and live; deny if board token missing.
  const tokenRequiredFlag = !isProbe && club.displayTokenRequired !== false;
  const tokenRequired = tokenRequiredFlag && !!expectedToken;
  const tokenProvided = !!accessToken;
  let tokenOk = true;
  let tokenReason = "token_off";
  if (tokenRequiredFlag && !expectedToken) {
    // Locked mode but no token provisioned yet → deny (forces Master to re-issue tokens).
    tokenOk = false;
    tokenReason = "token_not_configured";
  } else if (tokenRequired) {
    tokenOk = timingSafeEqualText(accessToken, expectedToken);
    tokenReason = tokenOk ? "token_ok" : (tokenProvided ? "token_denied" : "token_missing");
  } else if (tokenProvided && expectedToken) {
    tokenReason = "token_ignored_not_required";
  }

  const allowed = isProbe ? true : (ipOk && tokenOk);
  let reason = "ok";
  if (isProbe) reason = "ip_probe";
  else if (!ipOk && !tokenOk) reason = `${ipReason}+${tokenReason}`;
  else if (!ipOk) reason = ipReason;
  else if (!tokenOk) reason = tokenReason;
  else if (ipRestrictionEnabled && tokenRequired) reason = "ip_and_token_ok";
  else if (ipRestrictionEnabled) reason = ipReason;
  else if (tokenRequired) reason = tokenReason;
  else reason = "open";

  const hostname = reportedHostname || await lookupHostname(clientIp);
  const macAddress = reportedMac || "n/a";

  const log = await writeAccessLog({
    locationId,
    locationName: club.locationName || club.brandName || locationId,
    displayBoard,
    clientIp,
    reportedIp,
    hostname,
    macAddress,
    allowed,
    restrictionEnabled: ipRestrictionEnabled,
    tokenRequired,
    tokenProvided,
    tokenOk,
    reason,
    pageUrl: data.pageUrl,
    userAgent: data.userAgent,
    screenFormatId: data.screenFormatId,
    language: data.language,
    timezone: data.timezone,
    platform: data.platform
  });

  let masterNotify = null;
  if (!isProbe && allowed === false) {
    try {
      masterNotify = await notifyMasterAdminsDisplayDenied({
        locationId,
        locationName: club.locationName || club.brandName || locationId,
        displayBoard,
        clientIp,
        hostname,
        macAddress,
        reason,
        logId: log.id,
        masterAdminUids: Array.isArray(club.masterAdminUids) ? club.masterAdminUids : []
      });
    } catch (notifyErr) {
      console.warn("display denial master notify failed", notifyErr?.message || notifyErr);
      masterNotify = {notified: false, reason: "notify_error"};
    }
  }

  return {
    ok: true,
    allowed,
    restrictionEnabled: ipRestrictionEnabled,
    tokenRequired: tokenRequiredFlag,
    tokenOk,
    reason,
    observedIp: clientIp,
    hostname,
    macAddress,
    allowlistCount: allowlist.length,
    locationId,
    locationName: club.locationName || club.brandName || locationId,
    displayBoard,
    logId: log.id,
    masterNotify,
    hint: (!isProbe && reason === "open")
      ? "IP restriction and token requirement were both off (or allowlist empty). Save approved IPs with Enable IP restriction, and/or require ?k= tokens."
      : undefined
  };
});

exports.setVenueDisplayIps = onCall({
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (request) => {
  const email = await assertMasterAdmin(request);
  const data = request.data || {};
  const locationId = text(data.locationId, 120).toLowerCase();
  if (!locationId) throw new HttpsError("invalid-argument", "locationId is required.");
  const approvedDisplayIps = parseAllowlist(data.approvedDisplayIps || data.ips || []);
  const displayIpRestrictionEnabled = data.displayIpRestrictionEnabled === true;
  const displayTokenRequired = data.displayTokenRequired === true;
  const notes = text(data.notes, 500);
  const clubRef = db.collection("clubLocations").doc(locationId);
  const clubSnap = await clubRef.get();
  const existing = clubSnap.exists ? clubSnap.data() || {} : {};
  const payload = {
    approvedDisplayIps,
    displayIpRestrictionEnabled,
    displayTokenRequired,
    displayIpNotes: notes,
    displayIpUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    displayIpUpdatedBy: email,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (!clubSnap.exists) {
    payload.locationName = text(data.locationName, 200) || locationId;
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await clubRef.set(payload, {merge: true});

  await db.collection("displayBoardSecrets").doc(locationId).set({
    locationId,
    tokenRequired: displayTokenRequired,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: email
  }, {merge: true});

  const batch = db.batch();
  approvedDisplayIps.forEach((ip) => {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && !ip.includes(":")) return;
    if (ip.includes("*") || ip.includes("/")) return;
    const id = displayDeviceDocId(ip);
    if (!id) return;
    batch.set(db.collection("displayDevices").doc(id), {
      ip,
      locationId,
      clubLocationId: locationId,
      location: locationId,
      displayBoard: text(data.displayBoard, 40) || "primary",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: email,
      source: "master_display_security"
    }, {merge: true});
  });
  await batch.commit();

  return {
    ok: true,
    locationId,
    locationName: existing.locationName || existing.brandName || locationId,
    approvedDisplayIps,
    displayIpRestrictionEnabled,
    displayTokenRequired,
    deviceBindings: approvedDisplayIps.filter((ip) => !ip.includes("*") && !ip.includes("/")).length
  };
});

/**
 * Feature: Master Admin Display Security portal.
 * Returns obfuscated tokens only — full cleartext is never re-fetched after provision/rotate.
 */
exports.getVenueDisplayTokens = onCall({
  region: "us-central1",
  timeoutSeconds: 20,
  memory: "256MiB"
}, async (request) => {
  await assertMasterAdmin(request);
  const locationId = text((request.data || {}).locationId, 120).toLowerCase();
  if (!locationId) throw new HttpsError("invalid-argument", "locationId is required.");
  const clubSnap = await db.collection("clubLocations").doc(locationId).get();
  const club = clubSnap.exists ? clubSnap.data() || {} : {};
  const secretsSnap = await db.collection("displayBoardSecrets").doc(locationId).get();
  const secrets = secretsSnap.exists ? secretsSnap.data() || {} : {};
  const primaryToken = text(secrets.primaryToken || "", 120);
  const secondaryToken = text(secrets.secondaryToken || "", 120);
  // Reflect Master Admin checkbox only — do not OR with IP restriction (gates are independent).
  const tokenRequired = club.displayTokenRequired !== false;
  return {
    ok: true,
    locationId,
    locationName: club.locationName || club.brandName || locationId,
    tokenRequired,
    // Obfuscated only — supports "confirm which token is live" without exposing secrets.
    primaryTokenObfuscated: obfuscateToken(primaryToken),
    secondaryTokenObfuscated: obfuscateToken(secondaryToken),
    primaryUrlObfuscated: buildObfuscatedDisplayUrl(locationId, "primary", primaryToken),
    secondaryUrlObfuscated: buildObfuscatedDisplayUrl(locationId, "secondary", secondaryToken),
    primaryBaseUrl: buildDisplayUrl(locationId, "primary", ""),
    secondaryBaseUrl: buildDisplayUrl(locationId, "secondary", ""),
    primaryHasToken: !!primaryToken,
    secondaryHasToken: !!secondaryToken,
    revealOnce: false
  };
});

/**
 * Feature: Club onboarding — create Display 1 + Display 2 secrets once.
 * Returns cleartext URLs for a one-time Xibo paste warning on the onboarding page.
 * onlyIfMissing=true avoids rotating secrets if the club is saved again.
 */
exports.provisionVenueDisplayTokens = onCall({
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (request) => {
  const email = await assertMasterAdmin(request);
  const data = request.data || {};
  const locationId = text(data.locationId, 120).toLowerCase();
  if (!locationId) throw new HttpsError("invalid-argument", "locationId is required.");
  const onlyIfMissing = data.onlyIfMissing !== false;
  const tokenRequired = data.tokenRequired !== false; // default ON for new clubs
  const secretsRef = db.collection("displayBoardSecrets").doc(locationId);
  const secretsSnap = await secretsRef.get();
  const existing = secretsSnap.exists ? secretsSnap.data() || {} : {};
  const hasBoth = !!(existing.primaryToken && existing.secondaryToken);

  let primaryToken = text(existing.primaryToken || "", 120);
  let secondaryToken = text(existing.secondaryToken || "", 120);
  let created = false;
  let revealOnce = false;

  if (!hasBoth || data.force === true) {
    if (!onlyIfMissing || !existing.primaryToken || data.force === true) {
      primaryToken = newDisplayToken();
      created = true;
    }
    if (!onlyIfMissing || !existing.secondaryToken || data.force === true) {
      secondaryToken = newDisplayToken();
      created = true;
    }
    revealOnce = created;
    await secretsRef.set({
      locationId,
      primaryToken,
      secondaryToken,
      tokenRequired,
      provisionedAt: admin.firestore.FieldValue.serverTimestamp(),
      provisionedBy: email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: email,
      primaryTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      secondaryTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    await db.collection("clubLocations").doc(locationId).set({
      displayTokenRequired: tokenRequired,
      displayTokensProvisionedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  } else {
    // Already provisioned — return obfuscated only (no second cleartext reveal).
    revealOnce = false;
  }

  const clubSnap = await db.collection("clubLocations").doc(locationId).get();
  const club = clubSnap.exists ? clubSnap.data() || {} : {};

  if (!revealOnce) {
    return {
      ok: true,
      locationId,
      locationName: club.locationName || club.brandName || locationId,
      created: false,
      revealOnce: false,
      tokenRequired: existing.tokenRequired === true || club.displayTokenRequired === true,
      primaryTokenObfuscated: obfuscateToken(primaryToken),
      secondaryTokenObfuscated: obfuscateToken(secondaryToken),
      primaryUrlObfuscated: buildObfuscatedDisplayUrl(locationId, "primary", primaryToken),
      secondaryUrlObfuscated: buildObfuscatedDisplayUrl(locationId, "secondary", secondaryToken),
      warning: "Tokens already exist for this venue. Full values are not shown again — use Display Security → Rotate to issue new Xibo URLs."
    };
  }

  return {
    ok: true,
    locationId,
    locationName: club.locationName || club.brandName || locationId,
    created: true,
    revealOnce: true,
    tokenRequired,
    // One-time cleartext for onboarding / rotate paste into Xibo.
    primaryToken,
    secondaryToken,
    primaryUrl: buildDisplayUrl(locationId, "primary", primaryToken),
    secondaryUrl: buildDisplayUrl(locationId, "secondary", secondaryToken),
    primaryTokenObfuscated: obfuscateToken(primaryToken),
    secondaryTokenObfuscated: obfuscateToken(secondaryToken),
    warning: "Copy these URLs into Xibo NOW. After you leave onboarding, Master Admin only shows obfuscated tokens unless you rotate."
  };
});

/**
 * Feature: Master Admin Display Security — rotate or clear one board token.
 * Returns the new cleartext URL once; afterward getVenueDisplayTokens is obfuscated-only.
 */
exports.rotateVenueDisplayToken = onCall({
  region: "us-central1",
  timeoutSeconds: 20,
  memory: "256MiB"
}, async (request) => {
  const email = await assertMasterAdmin(request);
  const data = request.data || {};
  const locationId = text(data.locationId, 120).toLowerCase();
  if (!locationId) throw new HttpsError("invalid-argument", "locationId is required.");
  const board = normalizeBoard(data.board || data.displayBoard || "primary");
  if (board !== "primary" && board !== "secondary") {
    throw new HttpsError("invalid-argument", "board must be primary or secondary.");
  }
  const token = newDisplayToken();
  const field = tokenFieldForBoard(board);
  const clear = data.clear === true;
  const secretsRef = db.collection("displayBoardSecrets").doc(locationId);
  const clubSnap = await db.collection("clubLocations").doc(locationId).get();
  const club = clubSnap.exists ? clubSnap.data() || {} : {};

  const patch = {
    locationId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: email,
    [`${field}UpdatedAt`]: admin.firestore.FieldValue.serverTimestamp(),
    [`${field}UpdatedBy`]: email
  };
  if (clear) {
    patch[field] = admin.firestore.FieldValue.delete();
  } else {
    patch[field] = token;
  }
  if (typeof data.tokenRequired === "boolean") {
    patch.tokenRequired = data.tokenRequired === true;
    await db.collection("clubLocations").doc(locationId).set({
      displayTokenRequired: data.tokenRequired === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  }
  await secretsRef.set(patch, {merge: true});

  const secretsSnap = await secretsRef.get();
  const secrets = secretsSnap.exists ? secretsSnap.data() || {} : {};
  const primaryToken = text(secrets.primaryToken || "", 120);
  const secondaryToken = text(secrets.secondaryToken || "", 120);
  const activeToken = clear ? "" : (board === "secondary" ? secondaryToken : primaryToken);

  return {
    ok: true,
    locationId,
    locationName: club.locationName || club.brandName || locationId,
    board,
    cleared: clear,
    revealOnce: !clear,
    token: activeToken,
    url: buildDisplayUrl(locationId, board, activeToken),
    tokenRequired: secrets.tokenRequired === true || club.displayTokenRequired === true,
    // Other board stays obfuscated in this response (not a reveal for that board).
    primaryTokenObfuscated: obfuscateToken(primaryToken),
    secondaryTokenObfuscated: obfuscateToken(secondaryToken),
    primaryUrlObfuscated: buildObfuscatedDisplayUrl(locationId, "primary", primaryToken),
    secondaryUrlObfuscated: buildObfuscatedDisplayUrl(locationId, "secondary", secondaryToken),
    warning: clear
      ? "Token cleared. Remove ?k= from Xibo or the board will fail when token requirement is ON."
      : "ONE-TIME REVEAL: paste this URL into Xibo now. It will not be shown in full again until the next rotate."
  };
});

exports.listDisplayAccessLogs = onCall({
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (request) => {
  await assertMasterAdmin(request);
  const data = request.data || {};
  const locationId = text(data.locationId, 120).toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(data.limit || 50)));
  let query = db.collection("displayAccessLogs").orderBy("createdAtMs", "desc").limit(limit);
  if (locationId) {
    query = db.collection("displayAccessLogs")
      .where("locationId", "==", locationId)
      .orderBy("createdAtMs", "desc")
      .limit(limit);
  }
  const snap = await query.get();
  const rows = snap.docs.map((doc) => {
    const row = doc.data() || {};
    return {
      id: doc.id,
      locationId: row.locationId || "",
      locationName: row.locationName || "",
      displayBoard: row.displayBoard || "",
      clientIp: row.clientIp || "",
      reportedIp: row.reportedIp || "",
      hostname: row.hostname || "",
      macAddress: row.macAddress || "n/a",
      allowed: row.allowed === true,
      restrictionEnabled: row.restrictionEnabled === true,
      tokenRequired: row.tokenRequired === true,
      tokenProvided: row.tokenProvided === true,
      tokenOk: row.tokenOk === true,
      reason: row.reason || "",
      pageUrl: row.pageUrl || "",
      userAgent: row.userAgent || "",
      screenFormatId: row.screenFormatId || "",
      platform: row.platform || "",
      language: row.language || "",
      timezone: row.timezone || "",
      createdAtMs: Number(row.createdAtMs || 0)
    };
  });
  return {ok: true, locationId, rows};
});

/**
 * Public: Xibo / player reports that display.html or display2.html failed to load
 * and the fallback display-error.html page was shown. Diagnostic only (not Security).
 */
exports.reportDisplayLoadError = onCall({
  region: "us-central1",
  timeoutSeconds: 15,
  memory: "256MiB",
  invoker: "public"
}, async (request) => {
  const data = request.data || {};
  const locationId = text(data.locationId || data.location || data.club, 120).toLowerCase();
  const displayBoard = text(data.displayBoard || data.board, 40) || "unknown";
  const reason = text(data.reason || data.error, 120) || "xibo_page_load_error";
  const httpCode = text(data.httpCode || data.code || data.status, 40);
  const fromUrl = text(data.fromUrl || data.from || data.src, 500);
  const pageUrl = text(data.pageUrl, 500);
  const userAgent = text(data.userAgent, 300);
  const platform = text(data.platform, 120);
  const clientIp = extractClientIp(request);
  const now = Date.now();
  const retentionMs = 30 * 24 * 60 * 60 * 1000;

  const details = {
    locationId,
    displayBoard,
    reason,
    httpCode,
    fromUrl,
    pageUrl,
    clientIp,
    platform,
    reportedAtMs: Number(data.reportedAtMs || now) || now
  };

  const ref = await db.collection("appLogs").add({
    level: "error",
    category: "displayFallback",
    action: "xibo_page_load_error",
    message: text(
      data.message || `Xibo/display load-error fallback shown${locationId ? ` for ${locationId}` : ""}.`,
      2000
    ),
    details,
    logCategory: "diagnostic",
    source: "display-error",
    uid: request.auth?.uid || "anonymous-display-player",
    email: text(request.auth?.token?.email, 200),
    href: pageUrl,
    userAgent,
    appVersion: text(data.appVersion, 40) || "29.09.90",
    correlationId: text(data.correlationId, 80) || `disp_err_${now.toString(36)}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: now,
    expireAtMs: now + retentionMs
  });

  return {ok: true, id: ref.id, locationId, displayBoard, reason};
});

const DAY_MS = 24 * 60 * 60 * 1000;
const DIAGNOSTIC_LOG_RETENTION_MS = 30 * DAY_MS;
const SECURITY_LOG_RETENTION_MS = 90 * DAY_MS;

async function deleteOldByCreatedAtMs(collectionName, olderThanMs, batchLimit = 400) {
  const snap = await db.collection(collectionName)
    .where("createdAtMs", "<", olderThanMs)
    .orderBy("createdAtMs", "asc")
    .limit(batchLimit)
    .get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

async function deleteOldAppLogsByTimestamp(olderThanMs, batchLimit = 400) {
  // appLogs typically use Firestore Timestamp createdAt (diagnostics).
  const cutoff = admin.firestore.Timestamp.fromMillis(olderThanMs);
  const snap = await db.collection("appLogs")
    .where("createdAt", "<", cutoff)
    .orderBy("createdAt", "asc")
    .limit(batchLimit)
    .get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

/**
 * Feature: retention sweeper
 * - Diagnostic appLogs: delete after 30 days
 * - Security displayAccessLogs: delete after 90 days
 * - Deleted/expired security system messages (soft-deleted) cleanup after 90 days
 */
exports.purgeLogRetention = onSchedule({
  region: "us-central1",
  schedule: "every 24 hours",
  timeZone: "UTC",
  timeoutSeconds: 300,
  memory: "512MiB"
}, async () => {
  const now = Date.now();
  let diagnosticDeleted = 0;
  let securityDeleted = 0;
  let securityMessagesDeleted = 0;

  for (let i = 0; i < 5; i += 1) {
    const n = await deleteOldAppLogsByTimestamp(now - DIAGNOSTIC_LOG_RETENTION_MS);
    diagnosticDeleted += n;
    if (n < 400) break;
  }
  for (let i = 0; i < 5; i += 1) {
    const n = await deleteOldByCreatedAtMs("displayAccessLogs", now - SECURITY_LOG_RETENTION_MS);
    securityDeleted += n;
    if (n < 400) break;
  }
  let entityMgmtAuditDeleted = 0;
  for (let i = 0; i < 5; i += 1) {
    const n = await deleteOldByCreatedAtMs("entityManagementAuditLogs", now - SECURITY_LOG_RETENTION_MS);
    entityMgmtAuditDeleted += n;
    if (n < 400) break;
  }

  // Hard-delete soft-deleted security inbox messages older than 90 days.
  try {
    const snap = await db.collection("inboxNotifications")
      .where("messageCategory", "==", "security")
      .where("deleted", "==", true)
      .where("deletedAtMs", "<", now - SECURITY_LOG_RETENTION_MS)
      .limit(400)
      .get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      securityMessagesDeleted = snap.size;
    }
  } catch (err) {
    // Fallback without composite index: scan recent deleted security notes by type.
    console.warn("security message retention query fallback", err?.message || err);
    const snap = await db.collection("inboxNotifications")
      .where("type", "==", "displayAccessDenied")
      .limit(400)
      .get();
    const batch = db.batch();
    let count = 0;
    snap.docs.forEach((doc) => {
      const row = doc.data() || {};
      const deletedAt = Number(row.deletedAtMs || 0);
      if (row.deleted === true && deletedAt && deletedAt < now - SECURITY_LOG_RETENTION_MS) {
        batch.delete(doc.ref);
        count += 1;
      }
    });
    if (count) await batch.commit();
    securityMessagesDeleted = count;
  }

  console.log("purgeLogRetention", {diagnosticDeleted, securityDeleted, securityMessagesDeleted, entityMgmtAuditDeleted});
  return {ok: true, diagnosticDeleted, securityDeleted, securityMessagesDeleted, entityMgmtAuditDeleted};
});

exports.__displaySecurityHelpers = {
  normalizeIp,
  parseAllowlist,
  ipAllowed,
  extractClientIp,
  normalizeBoard,
  buildDisplayUrl
};
