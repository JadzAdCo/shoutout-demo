/* Features & Services — Master Admin flags, beta testers, code promotion log, audit chain.
   Design notes: .cursor/rules/design-notes-feature-services.mdc */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {assertSos2faSession} = require("./sos2fa-functions");
const core = require("./feature-services-core");
const pkg = require("./package.json");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;
const C = core.COLLECTIONS;

const PACKAGE_VERSION = `s${pkg.version}`;
const PROMOTION_WORKFLOW_URL = process.env.FLOQR_PROMOTION_WORKFLOW_URL
  || "https://github.com/JadzAdCo/shoutout-demo/actions/workflows/promote-test-to-main.yml";
const {isServerAdminAuth, isServerAdminEmail} = require("./admin-trust");
const CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};
const UNAVAILABLE_MESSAGE = "This feature isn't available on your account yet.";

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function requestContext(request) {
  const headers = request.rawRequest?.headers || {};
  return {
    ip: String(headers["x-forwarded-for"] || "").split(",")[0].trim() || String(request.rawRequest?.ip || ""),
    userAgent: String(headers["user-agent"] || "")
  };
}

function headRef() {
  return db.collection(C.auditHead).doc("current");
}

/** Chained append inside a caller's transaction. Call after all tx reads (pass the head snapshot). */
function appendChainedAudit(tx, headSnap, record) {
  const ref = db.collection(C.audit).doc();
  const head = headSnap.exists ? headSnap.data() || {} : {};
  const body = {...record, eventId: ref.id, seq: Number(head.seq || 0) + 1, prevHash: head.hash || core.GENESIS_HASH};
  const hash = core.chainHash(body.prevHash, body);
  tx.set(ref, {...body, hash, chained: true, createdAt: FieldValue.serverTimestamp()});
  tx.set(headRef(), {hash, seq: body.seq, eventId: ref.id, updatedAtMs: record.createdAtMs});
  return ref.id;
}

async function writeChainedAudit(record) {
  return db.runTransaction(async tx => appendChainedAudit(tx, await tx.get(headRef()), record));
}

/** Denials and patron access checks are logged outside the chain so they cannot contend on the head doc. */
async function writeUnchainedAudit(record) {
  try {
    const ref = db.collection(C.audit).doc();
    await ref.set({...record, eventId: ref.id, chained: false, createdAt: FieldValue.serverTimestamp()});
  } catch (error) {
    console.error("feature-services audit write failed", error.message);
  }
}

function auditRecord(request, fields) {
  return core.buildAuditRecord({
    ...requestContext(request),
    actor: {uid: request.auth?.uid || "", email: request.auth?.token?.email || "", role: fields.role || "masterAdmin"},
    ...fields
  });
}

/** SOS2FA-gated Master Admin; failed privileged attempts are logged (AU-2 / AC-6(9)). */
async function assertAdmin(request, eventType) {
  try {
    return await assertSos2faSession(request);
  } catch (error) {
    await writeUnchainedAudit(auditRecord(request, {
      eventType: `${eventType}.denied`,
      outcome: "denied",
      role: request.auth ? "unverified" : "anonymous",
      detail: {message: text(error.message, 200)}
    }));
    throw error;
  }
}

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  if (error?.code === "invalid-argument") return new HttpsError("invalid-argument", error.message);
  return new HttpsError("internal", "Features & Services request failed. Try again.");
}

/** Invite target check: Auth custom claims + server email list. users/{uid} fields are patron-editable and ignored. */
async function isPrivilegedProfile(uid, email) {
  if (isServerAdminEmail(email)) return true;
  try {
    const record = await admin.auth().getUser(uid);
    return isServerAdminAuth({token: {...(record.customClaims || {}), email: record.email || "", email_verified: record.emailVerified === true}});
  } catch (_) {
    return false;
  }
}

async function isPrivilegedAuth(auth) {
  return isServerAdminAuth(auth);
}

/** Master Admins are never beta testers, even if a betaTesters doc exists for them. */
async function viewerFor(auth) {
  if (!auth) return {isMasterAdmin: false, isBetaTester: false, betaFeatures: {}};
  const [privileged, betaSnap] = await Promise.all([
    isPrivilegedAuth(auth),
    db.collection(C.betaTesters).doc(auth.uid).get()
  ]);
  const row = betaSnap.exists ? betaSnap.data() : null;
  const isBetaTester = !privileged && core.isActiveBetaTester(row);
  return {isMasterAdmin: privileged, isBetaTester, betaFeatures: isBetaTester ? core.betaGrantsFrom(row) : {}};
}

function viewerRole(viewer) {
  if (viewer.isMasterAdmin) return "masterAdmin";
  return viewer.isBetaTester ? "betaTester" : "patron";
}

function grantedKeys(map) {
  return Object.keys(map || {}).filter(key => core.flag(map[key]) === 1);
}

function featureLabels(map) {
  return grantedKeys(map).map(key => core.catalogEntry(key)?.label || key).join(", ") || "new features";
}

async function loadFeature(featureKey) {
  const snap = await db.collection(C.features).doc(featureKey).get();
  return core.normalizeFeature(featureKey, snap.exists ? snap.data() : null);
}

/** Server-side enforcement for callables that belong to a feature (checkout, requests). */
async function assertFeatureAccess(auth, featureKey, request = null) {
  const feature = await loadFeature(featureKey);
  if (!feature) return true;
  const viewer = await viewerFor(auth);
  if (core.canAccessFeature(feature, viewer)) return true;
  await writeUnchainedAudit(core.buildAuditRecord({
    ...(request ? requestContext(request) : {}),
    eventType: "feature.access_denied",
    outcome: "denied",
    actor: {uid: auth?.uid || "", email: auth?.token?.email || "", role: viewerRole(viewer)},
    target: {type: "feature", id: featureKey},
    detail: {IsFeatureEnabled: feature.IsFeatureEnabled, IsTestFeature: feature.IsTestFeature, state: core.featureState(feature), surface: "server"}
  }));
  throw new HttpsError("failed-precondition", UNAVAILABLE_MESSAGE);
}

function featureDoc(feature, request, actorEmail, reason, nowMs) {
  return {
    featureKey: feature.key,
    label: feature.label,
    route: feature.route,
    sortOrder: feature.sortOrder,
    IsFeatureEnabled: feature.IsFeatureEnabled,
    IsTestFeature: feature.IsTestFeature,
    ...core.featureLinkFields(feature),
    revision: feature.revision,
    lastChangeReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: nowMs,
    updatedByUid: request.auth.uid,
    updatedByEmail: actorEmail
  };
}

exports.setFeatureServiceFlags = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await assertAdmin(request, "feature.change");
  try {
    const {featureKey, next, reason} = core.validateFlagChange(request.data || {});
    const nowMs = Date.now();
    const result = await db.runTransaction(async tx => {
      const ref = db.collection(C.features).doc(featureKey);
      const snap = await tx.get(ref);
      const head = await tx.get(headRef());
      const before = core.normalizeFeature(featureKey, snap.exists ? snap.data() : null);
      const flags = {...before, ...next};
      const after = {...flags, ...core.featureLinkFields(flags), revision: before.revision + 1};
      const eventType = core.flagEventType(before, after);
      if (!eventType) throw new HttpsError("failed-precondition", "Nothing changed — the feature already has those values.");
      tx.set(ref, featureDoc(after, request, email, reason, nowMs), {merge: true});
      const auditFields = row => ({
        IsFeatureEnabled: row.IsFeatureEnabled,
        IsTestFeature: row.IsTestFeature,
        enableFeatureLink: row.enableFeatureLink,
        enableBetaFeatureLink: row.enableBetaFeatureLink,
        revision: row.revision
      });
      const eventId = appendChainedAudit(tx, head, auditRecord(request, {
        eventType,
        target: {type: "feature", id: featureKey},
        before: auditFields(before),
        after: auditFields(after),
        reason,
        sessionId,
        nowMs
      }));
      return {feature: after, eventId, eventType};
    });
    return {ok: true, ...result};
  } catch (error) {
    throw asHttps(error);
  }
});

/** Seeds missing feature docs and backfills enableFeatureLink / enableBetaFeatureLink on existing docs (flags and revision untouched). */
exports.seedFeatureServices = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await assertAdmin(request, "feature.seed");
  const nowMs = Date.now();
  const result = await db.runTransaction(async tx => {
    const refs = core.FEATURE_KEYS.map(key => db.collection(C.features).doc(key));
    const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
    const head = await tx.get(headRef());
    const missing = snaps.map((snap, i) => (snap.exists ? null : core.FEATURE_KEYS[i])).filter(Boolean);
    const drifted = snaps.map((snap, i) => (snap.exists && core.linkFieldsDrifted(snap.data()) ? core.FEATURE_KEYS[i] : null)).filter(Boolean);
    if (!missing.length && !drifted.length) return {created: [], backfilled: []};
    missing.forEach(key => {
      const feature = {...core.normalizeFeature(key, null), revision: 1};
      tx.set(db.collection(C.features).doc(key), featureDoc(feature, request, email, "Initial seed from packaged catalog", nowMs));
    });
    const backfill = Object.fromEntries(drifted.map(key => {
      const raw = snaps[core.FEATURE_KEYS.indexOf(key)].data() || {};
      return [key, {before: {enableFeatureLink: raw.enableFeatureLink ?? null, enableBetaFeatureLink: raw.enableBetaFeatureLink ?? null}, after: core.featureLinkFields(raw)}];
    }));
    Object.entries(backfill).forEach(([key, row]) => {
      tx.set(db.collection(C.features).doc(key), {...row.after, linkFieldsBackfilledAtMs: nowMs}, {merge: true});
    });
    const seeded = Object.fromEntries(missing.map(key => {
      const f = core.normalizeFeature(key, null);
      return [key, {IsFeatureEnabled: f.IsFeatureEnabled, IsTestFeature: f.IsTestFeature, ...core.featureLinkFields(f)}];
    }));
    const backfillBefore = Object.fromEntries(Object.entries(backfill).map(([key, row]) => [key, row.before]));
    const backfillAfter = Object.fromEntries(Object.entries(backfill).map(([key, row]) => [key, row.after]));
    // One chained event per call: the audit head doc is written once per transaction.
    appendChainedAudit(tx, head, auditRecord(request, missing.length ? {
      eventType: "feature.seeded",
      target: {type: "featureCatalog", id: C.features},
      after: seeded,
      reason: "Initial seed from packaged catalog",
      detail: drifted.length ? {linksBackfilled: {before: backfillBefore, after: backfillAfter}} : null,
      sessionId,
      nowMs
    } : {
      eventType: "feature.links_backfilled",
      target: {type: "featureCatalog", id: C.features},
      before: backfillBefore,
      after: backfillAfter,
      reason: "Derived link datapoints backfilled from IsFeatureEnabled / IsTestFeature",
      sessionId,
      nowMs
    }));
    return {created: missing, backfilled: drifted};
  });
  return {ok: true, ...result};
});

exports.createBetaInvite = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await assertAdmin(request, "beta.invite");
  const targetUid = text(request.data?.targetUid, 128);
  const note = text(request.data?.note, 300);
  if (!targetUid) throw new HttpsError("invalid-argument", "Choose a patron to invite.");
  let features;
  try { features = core.validateBetaFeatures(request.data?.featureKeys); } catch (error) { throw asHttps(error); }
  const [userSnap, betaSnap] = await Promise.all([
    db.collection("users").doc(targetUid).get(),
    db.collection(C.betaTesters).doc(targetUid).get()
  ]);
  if (!userSnap.exists) throw new HttpsError("not-found", "Patron not found.");
  const user = userSnap.data() || {};
  if (await isPrivilegedProfile(targetUid, user.email)) {
    await writeUnchainedAudit(auditRecord(request, {
      eventType: "beta.invite_denied",
      outcome: "denied",
      target: {type: "patron", id: targetUid},
      detail: {reason: "target-is-master-admin"},
      sessionId
    }));
    throw new HttpsError("failed-precondition", "Master Admins cannot be beta testers. They open test features from Features & Services.");
  }
  if (core.isActiveBetaTester(betaSnap.exists ? betaSnap.data() : null)) {
    throw new HttpsError("already-exists", "This patron is already a beta tester. Change their feature access in the beta tester list instead.");
  }
  const targetEmail = text(user.email, 200).toLowerCase();
  const targetName = text(user.displayName || user.fullName || user.floqrHandle || "", 120);
  const token = core.newInviteToken();
  const inviteId = core.inviteIdFor(token);
  const nowMs = Date.now();
  const expiresAtMs = nowMs + core.INVITE_TTL_MS;
  const invitePath = `./beta-invite.html?t=${token}&from=beta-invite`;

  await db.runTransaction(async tx => {
    const head = await tx.get(headRef());
    tx.set(db.collection(C.betaInvites).doc(inviteId), {
      inviteId,
      targetUid,
      targetEmail,
      targetEmailMasked: core.maskEmail(targetEmail),
      targetName,
      note,
      features,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: nowMs,
      expiresAtMs,
      createdByUid: request.auth.uid,
      createdByEmail: email
    });
    appendChainedAudit(tx, head, auditRecord(request, {
      eventType: "beta.invite_created",
      target: {type: "patron", id: targetUid},
      after: {status: "pending", expiresAtMs, features},
      reason: note || "Beta tester invitation",
      detail: {inviteIdPrefix: inviteId.slice(0, 12), targetEmailMasked: core.maskEmail(targetEmail)},
      sessionId,
      nowMs
    }));
  });

  await db.collection("inboxNotifications").add({
    recipientUid: targetUid,
    type: "betaInvite",
    title: "You're invited to test new FLOQR features",
    body: `FLOQR invited you to become a beta tester and try ${featureLabels(features)} before everyone else. Open the invitation to accept or decline. It expires in 7 days.`,
    link: invitePath,
    read: false,
    createdAt: FieldValue.serverTimestamp()
  });

  return {ok: true, invitePath, expiresAtMs, features, targetEmailMasked: core.maskEmail(targetEmail)};
});

async function respondToInvite(request, accept) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to respond to this invitation.");
  const token = text(request.data?.token, 64);
  const invalid = new HttpsError("failed-precondition", "This invitation link is invalid, expired, or was sent to a different account.");
  if (!core.isValidInviteToken(token)) throw invalid;
  const inviteId = core.inviteIdFor(token);
  const uid = request.auth.uid;
  const nowMs = Date.now();
  let denial = accept && await isPrivilegedAuth(request.auth) ? "master-admin" : "";
  let granted = {};
  if (!denial) await db.runTransaction(async tx => {
    const inviteRef = db.collection(C.betaInvites).doc(inviteId);
    const betaRef = db.collection(C.betaTesters).doc(uid);
    const inviteSnap = await tx.get(inviteRef);
    const head = await tx.get(headRef());
    const invite = inviteSnap.exists ? inviteSnap.data() : null;
    const verdict = core.evaluateInvite(invite, {uid, nowMs});
    if (!verdict.ok) {
      denial = verdict.reason;
      return;
    }
    granted = core.validateBetaFeatures(invite.features || {}, {requireOne: false});
    tx.update(inviteRef, {
      status: accept ? "accepted" : "declined",
      respondedAt: FieldValue.serverTimestamp(),
      respondedAtMs: nowMs,
      respondedUid: uid
    });
    if (accept) {
      tx.set(betaRef, {
        uid,
        IsBetaTester: 1,
        role: "betaTester",
        features: granted,
        status: "active",
        emailMasked: core.maskEmail(request.auth.token?.email),
        inviteId,
        invitedByEmail: invite.createdByEmail || "",
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedAtMs: nowMs,
        revokedAt: null,
        revokedByEmail: null
      }, {merge: true});
    }
    appendChainedAudit(tx, head, auditRecord(request, {
      role: "patron",
      eventType: accept ? "beta.accepted" : "beta.declined",
      target: {type: "patron", id: uid},
      before: {status: "pending"},
      after: {status: accept ? "accepted" : "declined", IsBetaTester: accept ? 1 : 0, features: accept ? granted : {}},
      detail: {inviteIdPrefix: inviteId.slice(0, 12), invitedByEmail: invite.createdByEmail || ""},
      nowMs
    }));
  });
  if (denial) {
    await writeUnchainedAudit(auditRecord(request, {
      role: "patron",
      eventType: accept ? "beta.accept_denied" : "beta.decline_denied",
      outcome: "denied",
      target: {type: "patron", id: uid},
      detail: {reason: denial, inviteIdPrefix: inviteId.slice(0, 12)}
    }));
    if (denial === "master-admin") {
      throw new HttpsError("failed-precondition", "Master Admins cannot be beta testers. Open test features from Features & Services.");
    }
    throw invalid;
  }
  return {ok: true, status: accept ? "accepted" : "declined", features: accept ? grantedKeys(granted) : []};
}

exports.acceptBetaInvite = onCall(CALL_OPTS, request => respondToInvite(request, true));
exports.declineBetaInvite = onCall(CALL_OPTS, request => respondToInvite(request, false));

exports.revokeBetaTester = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await assertAdmin(request, "beta.revoke");
  const targetUid = text(request.data?.targetUid, 128);
  if (!targetUid) throw new HttpsError("invalid-argument", "Choose a beta tester.");
  let reason;
  try { reason = core.validateReason(request.data?.reason); } catch (error) { throw asHttps(error); }
  const nowMs = Date.now();
  await db.runTransaction(async tx => {
    const ref = db.collection(C.betaTesters).doc(targetUid);
    const snap = await tx.get(ref);
    const head = await tx.get(headRef());
    if (!core.isActiveBetaTester(snap.exists ? snap.data() : null)) throw new HttpsError("failed-precondition", "This patron is not an active beta tester.");
    tx.set(ref, {
      IsBetaTester: 0,
      status: "revoked",
      revokedAt: FieldValue.serverTimestamp(),
      revokedAtMs: nowMs,
      revokedByEmail: email,
      revokeReason: reason
    }, {merge: true});
    appendChainedAudit(tx, head, auditRecord(request, {
      eventType: "beta.revoked",
      target: {type: "patron", id: targetUid},
      before: {IsBetaTester: 1, status: "active"},
      after: {IsBetaTester: 0, status: "revoked"},
      reason,
      sessionId,
      nowMs
    }));
  });
  const pending = await db.collection(C.betaInvites).where("targetUid", "==", targetUid).where("status", "==", "pending").limit(20).get();
  if (!pending.empty) {
    const batch = db.batch();
    pending.docs.forEach(doc => batch.update(doc.ref, {status: "revoked", revokedAtMs: nowMs, revokedByEmail: email}));
    await batch.commit();
  }
  return {ok: true};
});

exports.revokeBetaInvite = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await assertAdmin(request, "beta.invite_revoke");
  const inviteId = text(request.data?.inviteId, 64);
  if (!/^[0-9a-f]{64}$/.test(inviteId)) throw new HttpsError("invalid-argument", "Unknown invitation.");
  const nowMs = Date.now();
  await db.runTransaction(async tx => {
    const ref = db.collection(C.betaInvites).doc(inviteId);
    const snap = await tx.get(ref);
    const head = await tx.get(headRef());
    if (!snap.exists || snap.data().status !== "pending") throw new HttpsError("failed-precondition", "Only pending invitations can be revoked.");
    tx.update(ref, {status: "revoked", revokedAtMs: nowMs, revokedByEmail: email});
    appendChainedAudit(tx, head, auditRecord(request, {
      eventType: "beta.invite_revoked",
      target: {type: "patron", id: snap.data().targetUid || ""},
      before: {status: "pending"},
      after: {status: "revoked"},
      detail: {inviteIdPrefix: inviteId.slice(0, 12)},
      sessionId,
      nowMs
    }));
  });
  return {ok: true};
});

exports.setBetaTesterFeatures = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await assertAdmin(request, "beta.features_change");
  const targetUid = text(request.data?.targetUid, 128);
  if (!targetUid) throw new HttpsError("invalid-argument", "Choose a beta tester.");
  let reason;
  let features;
  try {
    reason = core.validateReason(request.data?.reason);
    features = core.validateBetaFeatures(request.data?.featureKeys);
  } catch (error) {
    throw asHttps(error);
  }
  const nowMs = Date.now();
  const before = await db.runTransaction(async tx => {
    const ref = db.collection(C.betaTesters).doc(targetUid);
    const snap = await tx.get(ref);
    const head = await tx.get(headRef());
    const row = snap.exists ? snap.data() : null;
    if (!core.isActiveBetaTester(row)) throw new HttpsError("failed-precondition", "This patron is not an active beta tester.");
    const previous = core.validateBetaFeatures(row.features || {}, {requireOne: false});
    if (core.canonicalJson(previous) === core.canonicalJson(features)) {
      throw new HttpsError("failed-precondition", "Nothing changed — the tester already has that access.");
    }
    tx.set(ref, {features, role: "betaTester", featuresUpdatedAtMs: nowMs, featuresUpdatedByEmail: email}, {merge: true});
    appendChainedAudit(tx, head, auditRecord(request, {
      eventType: "beta.features_changed",
      target: {type: "patron", id: targetUid},
      before: {features: previous},
      after: {features},
      reason,
      sessionId,
      nowMs
    }));
    return previous;
  });
  return {ok: true, before: grantedKeys(before), features: grantedKeys(features)};
});

const ACCESS_LOG_WINDOW_MS = 10 * 60 * 1000;
const ACCESS_LOG_MAX = 20;

/** Page-guard denials (signed-in viewers). The server re-evaluates access; the client verdict is never trusted. */
exports.logFeatureAccessAttempt = onCall(CALL_OPTS, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const featureKey = text(request.data?.featureKey, 60);
  if (!core.catalogEntry(featureKey)) throw new HttpsError("invalid-argument", "Unknown feature.");
  const page = text(request.data?.page, 80).replace(/[^A-Za-z0-9._-]/g, "");
  const nowMs = Date.now();
  const throttleRef = db.collection("featureServiceAccessThrottle").doc(request.auth.uid);
  const allowed = await db.runTransaction(async tx => {
    const snap = await tx.get(throttleRef);
    const row = snap.exists ? snap.data() || {} : {};
    const fresh = nowMs - Number(row.windowStartMs || 0) > ACCESS_LOG_WINDOW_MS;
    const count = fresh ? 0 : Number(row.count || 0);
    if (count >= ACCESS_LOG_MAX) return false;
    tx.set(throttleRef, {windowStartMs: fresh ? nowMs : Number(row.windowStartMs), count: count + 1, updatedAtMs: nowMs});
    return true;
  });
  if (!allowed) return {ok: true, logged: false};
  const [feature, viewer] = await Promise.all([loadFeature(featureKey), viewerFor(request.auth)]);
  const permitted = core.canAccessFeature(feature, viewer);
  if (permitted) return {ok: true, logged: false, allowed: true};
  await writeUnchainedAudit(auditRecord(request, {
    role: viewerRole(viewer),
    eventType: "feature.page_denied",
    outcome: "denied",
    target: {type: "feature", id: featureKey},
    detail: {page, state: core.featureState(feature), IsFeatureEnabled: feature.IsFeatureEnabled, IsTestFeature: feature.IsTestFeature, surface: "page-guard"},
    nowMs
  }));
  return {ok: true, logged: true, allowed: false};
});

exports.logFeatureCodePromotion = onCall(CALL_OPTS, async request => {
  const {sessionId} = await assertAdmin(request, "code.promotion");
  let reason;
  try { reason = core.validateReason(request.data?.reason); } catch (error) { throw asHttps(error); }
  const featureKeys = (Array.isArray(request.data?.featureKeys) ? request.data.featureKeys : [])
    .map(key => text(key, 60))
    .filter(key => core.FEATURE_KEYS.includes(key));
  const eventId = await writeChainedAudit(auditRecord(request, {
    eventType: "code.promotion_requested",
    target: {type: "gitBranch", id: "test→main"},
    reason,
    detail: {featureKeys, workflowUrl: PROMOTION_WORKFLOW_URL, packageVersion: PACKAGE_VERSION},
    sessionId
  }));
  return {ok: true, eventId, workflowUrl: PROMOTION_WORKFLOW_URL};
});

exports.verifyFeatureServiceAuditChain = onCall(CALL_OPTS, async request => {
  await assertAdmin(request, "audit.verify");
  const limit = Math.min(Math.max(Number(request.data?.limit) || 500, 1), 2000);
  const [snap, head] = await Promise.all([
    db.collection(C.audit).orderBy("seq", "desc").limit(limit).get(),
    headRef().get()
  ]);
  const rows = snap.docs.map(doc => doc.data()).reverse();
  const verdict = core.verifyChain(rows);
  const headData = head.exists ? head.data() || {} : {};
  const newest = rows[rows.length - 1];
  const headMatches = !newest ? !head.exists : headData.hash === newest.hash && Number(headData.seq) === Number(newest.seq);
  const ok = verdict.ok && headMatches;
  await writeUnchainedAudit(auditRecord(request, {
    eventType: "audit.chain_verified",
    outcome: ok ? "success" : "failure",
    target: {type: "auditLog", id: C.audit},
    detail: {checked: verdict.checked, brokenAt: verdict.brokenAt, issue: verdict.issue || (headMatches ? "" : "head-mismatch")}
  }));
  return {ok, checked: verdict.checked, brokenAt: verdict.brokenAt, issue: verdict.issue || (headMatches ? "" : "head-mismatch"), headSeq: Number(headData.seq || 0)};
});

exports.__featureServiceHelpers = {
  assertFeatureAccess, viewerFor, loadFeature, UNAVAILABLE_MESSAGE,
  assertAdmin, auditRecord, appendChainedAudit, writeChainedAudit, writeUnchainedAudit, headRef
};
