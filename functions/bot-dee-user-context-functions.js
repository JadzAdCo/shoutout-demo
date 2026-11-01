/* BOT DEE own-user context callables.
   getBotDeeUserContext — signed-in patron, own users/{uid} only, consent-gated, throttled, audited (names only).
   setBotDeeFieldAccess — Master Admin (SOS2FA + reason) switches which eligible fields BOT DEE may read.
   Design notes: .cursor/rules/design-notes-bot-dee-user-context.mdc */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const dc = require("./data-classification-core");
const ctxCore = require("./bot-dee-user-context-core");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");
const {__floqAiHelpers} = require("./data-classification-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;

const JOB = "botDeeUserContext";
const CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};
const HTTPS_CODES = new Set(["unauthenticated", "invalid-argument", "failed-precondition", "resource-exhausted", "permission-denied"]);

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  if (HTTPS_CODES.has(error?.code)) return new HttpsError(error.code, error.message);
  console.error("BOT DEE user context failed", error?.message || error);
  return new HttpsError("internal", "BOT DEE could not load your profile context. Try again.");
}

/** System reads are allowlisted per job (least privilege). */
function systemCollection(collection) {
  dc.systemJob(JOB, collection);
  return db.collection(collection);
}

function configRef() {
  return systemCollection(dc.COLLECTION).doc(dc.BOT_DEE_CONFIG_DOC);
}

async function readOwnUser(uid) {
  const snap = await systemCollection("users").doc(uid).get();
  return snap.exists ? snap.data() || {} : null;
}

async function readPolicy() {
  const snap = await configRef().get();
  return snap.exists ? snap.data() || {} : null;
}

async function throttle(uid, nowMs) {
  const ref = systemCollection("botDeeContextThrottle").doc(uid);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const {allowed, next} = ctxCore.evaluateThrottle(snap.exists ? snap.data() : null, nowMs);
    if (allowed) tx.set(ref, next);
    return allowed;
  });
}

async function resolveRole(auth) {
  return dc.resolveViewerRole(await __floqAiHelpers.roleFactsFor(auth)).role;
}

/** Shared with executeBotSession: the caller's own context, no throttle / audit row (session log carries names). */
async function loadOwnUserContext(uid, role) {
  const [userDoc, saved] = await Promise.all([readOwnUser(uid), readPolicy()]);
  return ctxCore.buildUserContext({userDoc, role, policy: dc.botDeeFieldPolicy(saved)});
}

function deps(request) {
  return {
    assertFeature: (auth, req) => audit.assertFeatureAccess(auth, "floqAi", req),
    throttle,
    resolveRole,
    readOwnUser,
    readPolicy,
    writeAudit: ({uid, role, detail, nowMs}) => audit.writeUnchainedAudit(audit.auditRecord(request, {
      role,
      eventType: "botDee.user_context",
      outcome: "success",
      target: {type: "users", id: uid},
      detail,
      nowMs
    })),
    log: row => console.info(JSON.stringify({...row, job: JOB}))
  };
}

exports.getBotDeeUserContext = onCall(CALL_OPTS, async request => {
  try {
    return await ctxCore.handleGetUserContext(request, deps(request));
  } catch (error) {
    throw asHttps(error);
  }
});

function allowedMap(policy) {
  return Object.fromEntries(policy.map(row => [row.field, row.botDeeAllowed]));
}

exports.setBotDeeFieldAccess = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await audit.assertAdmin(request, "dataClass.botDee");
  try {
    const {fields, reason} = dc.validateBotDeeFieldChange(request.data || {});
    const nowMs = Date.now();
    return await db.runTransaction(async tx => {
      const ref = configRef();
      const snap = await tx.get(ref);
      const head = await tx.get(audit.headRef());
      const saved = snap.exists ? snap.data() || {} : {};
      const before = allowedMap(dc.botDeeFieldPolicy(saved));
      const nextFields = {...(saved.fields || {}), ...fields};
      const after = allowedMap(dc.botDeeFieldPolicy({fields: nextFields}));
      const changed = Object.keys(after).filter(key => after[key] !== before[key]);
      if (!changed.length) throw new HttpsError("failed-precondition", "Nothing changed — BOT DEE already has those field switches.");
      const revision = Number(saved.revision || 0) + 1;
      tx.set(ref, {
        fields: Object.fromEntries(Object.entries(nextFields).filter(([key]) => Object.prototype.hasOwnProperty.call(after, key))),
        revision,
        lastChangeReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: nowMs,
        updatedByUid: request.auth.uid,
        updatedByEmail: email || ""
      }, {merge: true});
      const eventId = audit.appendChainedAudit(tx, head, audit.auditRecord(request, {
        eventType: "dataClass.botDeeFieldsChanged",
        target: {type: "dataClassification", id: dc.BOT_DEE_CONFIG_DOC},
        before,
        after,
        detail: {changed, revision},
        reason,
        sessionId,
        nowMs
      }));
      return {ok: true, eventId, changed, revision, fields: after};
    });
  } catch (error) {
    throw asHttps(error);
  }
});

exports.__botDeeUserContextHelpers = {loadOwnUserContext, JOB};
