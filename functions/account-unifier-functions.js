/* Patron phone unifier + Master Admin account merge.
   claimPatronPhone: signed-in profile complete. preview/merge: SOS2FA Master Admin.
   Never deletes Firebase Auth. Never stores client IP on users docs. */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {assertSos2faSession} = require("./sos2fa-functions");
const featureCore = require("./feature-services-core");
const core = require("./account-unifier-core");
const dc = require("./data-classification-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;
const C = featureCore.COLLECTIONS;
const JOB = "patronAccountUnifier";
const CALL_OPTS = {region: "us-central1", timeoutSeconds: 120, memory: "256MiB"};
const PATRON_CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};
const BATCH_LIMIT = 400;

function systemCollection(name) {
  dc.systemJob(JOB, name);
  return db.collection(name);
}

function text(value, max = 200) {
  return core.text(value, max);
}

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  if (error?.code === "invalid-argument") return new HttpsError("invalid-argument", error.message);
  if (error?.code === "failed-precondition") return new HttpsError("failed-precondition", error.message);
  return new HttpsError("internal", "Account request failed. Try again.");
}

function isAgentClient(request) {
  const data = request?.data || {};
  const kind = text(data.clientKind || data.actorKind || "", 40).toLowerCase();
  if (kind === "agent") return true;
  const headers = request?.rawRequest?.headers || {};
  if (text(headers["x-floqr-client"], 40).toLowerCase() === "agent") return true;
  const ua = String(headers["user-agent"] || "");
  return /^(curl\/|wget\/|python-requests\/)|HeadlessChrome|Playwright|Puppeteer|Cursor|FLOQR-Agent|cloud.?agent/i.test(ua);
}

function auditActor(request, roleFallback) {
  if (isAgentClient(request)) {
    return {uid: request?.auth?.uid || "", email: "agent", role: "agent"};
  }
  return {
    uid: request?.auth?.uid || "",
    email: request?.auth?.token?.email || "",
    role: roleFallback || "patron"
  };
}

function auditRecord(request, fields) {
  const roleFallback = fields.role || "masterAdmin";
  const actor = auditActor(request, roleFallback);
  const rest = {...fields};
  delete rest.role;
  return featureCore.buildAuditRecord({
    ip: "",
    userAgent: String(request?.rawRequest?.headers?.["user-agent"] || ""),
    actor,
    ...rest
  });
}

function headRef() {
  return systemCollection(C.auditHead).doc("current");
}

function appendChainedAudit(tx, headSnap, record) {
  const ref = systemCollection(C.audit).doc();
  const head = headSnap.exists ? headSnap.data() || {} : {};
  const body = {...record, eventId: ref.id, seq: Number(head.seq || 0) + 1, prevHash: head.hash || featureCore.GENESIS_HASH};
  const hash = featureCore.chainHash(body.prevHash, body);
  tx.set(ref, {...body, hash, chained: true, createdAt: FieldValue.serverTimestamp()});
  tx.set(headRef(), {hash, seq: body.seq, eventId: ref.id, updatedAtMs: record.createdAtMs});
  return ref.id;
}

async function writeUnchainedAudit(record) {
  try {
    const ref = systemCollection(C.audit).doc();
    await ref.set({...record, eventId: ref.id, chained: false, createdAt: FieldValue.serverTimestamp()});
  } catch (error) {
    console.error("account-unifier audit write failed", error.message);
  }
}

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

async function commitBatches(writes) {
  const chunks = [];
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) chunks.push(writes.slice(i, i + BATCH_LIMIT));
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach(write => write(batch));
    await batch.commit();
  }
}

async function authRecord(uid) {
  try {
    return await admin.auth().getUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }
}

async function resolvePatron(query) {
  const raw = text(query, 200);
  if (raw.length < 2) throw new HttpsError("invalid-argument", "Type at least 2 characters.");
  const people = [];
  const seen = new Set();
  const push = (uid, data = {}, extra = {}) => {
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    people.push(core.publicPatronCard(uid, data, extra));
  };
  const phone = core.normalizePhoneE164(raw);
  if (phone) {
    try {
      const record = await admin.auth().getUserByPhoneNumber(phone);
      const snap = await systemCollection("users").doc(record.uid).get();
      push(record.uid, snap.exists ? snap.data() : {}, {authEmail: record.email || "", authPhone: record.phoneNumber || phone});
    } catch (error) {
      if (error?.code !== "auth/user-not-found") console.error("lookupPatronAccounts getUserByPhoneNumber failed", error?.message || error);
    }
    const indexSnap = await systemCollection("phoneIndex").doc(core.phoneIndexId(phone)).get();
    if (indexSnap.exists) {
      const uid = text(indexSnap.data()?.uid, 128);
      if (uid) {
        const snap = await systemCollection("users").doc(uid).get();
        push(uid, snap.exists ? snap.data() : {}, {authPhone: phone});
      }
    }
    for (const field of ["phoneE164", "phone"]) {
      const snap = await systemCollection("users").where(field, "==", phone).limit(5).get();
      snap.docs.forEach(doc => push(doc.id, doc.data() || {}, {authPhone: phone}));
    }
  }
  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    try {
      const record = await admin.auth().getUserByEmail(email);
      const snap = await systemCollection("users").doc(record.uid).get();
      push(record.uid, snap.exists ? snap.data() : {}, {authEmail: record.email || email, authPhone: record.phoneNumber || ""});
    } catch (error) {
      if (error?.code !== "auth/user-not-found") console.error("lookupPatronAccounts getUserByEmail failed", error?.message || error);
    }
    const snap = await systemCollection("users").where("email", "==", email).limit(5).get();
    snap.docs.forEach(doc => push(doc.id, doc.data() || {}, {authEmail: email}));
  } else if (!phone) {
    const handle = raw.replace(/^@/, "");
    if (handle) {
      for (const field of ["floqrHandle", "username", "displayName"]) {
        for (const candidate of [...new Set([handle, `@${handle}`, handle.toLowerCase()])]) {
          const snap = await systemCollection("users").where(field, "==", candidate).limit(10).get();
          snap.docs.forEach(doc => push(doc.id, doc.data() || {}));
        }
      }
    }
  }
  return people.slice(0, 20);
}

async function findPhoneOwners(e164, selfUid) {
  const phone = core.normalizePhoneE164(e164);
  const owners = new Set();
  if (!phone) return {phone: "", owners};
  try {
    const record = await admin.auth().getUserByPhoneNumber(phone);
    if (record?.uid) owners.add(record.uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") console.error("claimPatronPhone getUserByPhoneNumber failed", error?.message || error);
  }
  const indexSnap = await systemCollection("phoneIndex").doc(core.phoneIndexId(phone)).get();
  if (indexSnap.exists) {
    const uid = text(indexSnap.data()?.uid, 128);
    if (uid) owners.add(uid);
  }
  for (const field of ["phoneE164", "phone"]) {
    const snap = await systemCollection("users").where(field, "==", phone).limit(8).get();
    snap.docs.forEach(doc => owners.add(doc.id));
  }
  if (selfUid) owners.delete(selfUid);
  const live = [];
  for (const uid of owners) {
    const snap = await systemCollection("users").doc(uid).get();
    const row = snap.exists ? snap.data() : {};
    if (text(row.mergedInto, 128) === selfUid || text(row.accountStatus, 20) === "merged") continue;
    live.push(uid);
  }
  return {phone, owners: new Set(live)};
}

async function countQuery(col, field, op, value) {
  const snap = await systemCollection(col).where(field, op, value).limit(200).get();
  return snap.size;
}

async function loadMergeSide(uid) {
  const [userSnap, betaSnap, auth, minglCount, inboxCount, threadSnap] = await Promise.all([
    systemCollection("users").doc(uid).get(),
    systemCollection("betaTesters").doc(uid).get(),
    authRecord(uid),
    countQuery("minglConnections", "participants", "array-contains", uid),
    countQuery("inboxNotifications", "recipientUid", "==", uid),
    systemCollection("botDeeThreads").doc(uid).get()
  ]);
  const data = userSnap.exists ? userSnap.data() : {};
  const beta = betaSnap.exists ? betaSnap.data() : {};
  const thread = threadSnap.exists ? threadSnap.data() : {};
  return core.publicPatronCard(uid, data, {
    authEmail: auth?.email || data.email || "",
    authPhone: auth?.phoneNumber || "",
    providers: (auth?.providerData || []).map(row => row.providerId).filter(Boolean),
    profileCompleted: data.profileCompleted === true,
    minglGrant: featureCore.flag(beta.features?.mingl) === 1,
    betaFeatures: featureCore.betaGrantsFrom(beta),
    isActiveBetaTester: featureCore.isActiveBetaTester(beta),
    minglCount,
    inboxCount,
    botDeeUsed: Number(thread.hasUsedBotDee) === 1,
    hasUsedBotDee: Number(thread.hasUsedBotDee) || 0,
    createdAtMs: Number(data.createdAtMs || 0),
    exists: userSnap.exists,
    accountStatus: text(data.accountStatus || "active", 20)
  });
}

async function copyThreadExtras(fromUid, toUid) {
  const fromRef = systemCollection("botDeeThreads").doc(fromUid);
  const toRef = systemCollection("botDeeThreads").doc(toUid);
  const [fromSnap, toSnap] = await Promise.all([fromRef.get(), toRef.get()]);
  const writes = [];
  if (fromSnap.exists) {
    const from = fromSnap.data() || {};
    const to = toSnap.exists ? toSnap.data() || {} : {};
    const patch = {};
    if (Number(from.hasUsedBotDee) === 1 && Number(to.hasUsedBotDee) !== 1) patch.hasUsedBotDee = 1;
    if (from.personalization && !to.personalization) patch.personalization = from.personalization;
    if (Object.keys(patch).length) {
      writes.push(batch => batch.set(toRef, patch, {merge: true}));
    }
  }
  for (const sub of ["memories", "archive"]) {
    const snap = await fromRef.collection(sub).limit(50).get();
    snap.docs.forEach(doc => {
      writes.push(batch => batch.set(toRef.collection(sub).doc(doc.id), doc.data() || {}, {merge: true}));
    });
  }
  const analysisFrom = systemCollection("usercharacter_analysis").doc(fromUid);
  const analysisTo = systemCollection("usercharacter_analysis").doc(toUid);
  const [aFrom, aTo] = await Promise.all([analysisFrom.get(), analysisTo.get()]);
  if (aFrom.exists && !aTo.exists) {
    writes.push(batch => batch.set(analysisTo, aFrom.data() || {}, {merge: true}));
  }
  return writes;
}

async function reassignInbox(fromUid, toUid) {
  const snap = await systemCollection("inboxNotifications").where("recipientUid", "==", fromUid).limit(500).get();
  return snap.docs.map(doc => batch => batch.update(doc.ref, {
    recipientUid: toUid,
    mergedFromUid: fromUid,
    mergedAtMs: Date.now()
  }));
}

async function reassignMingl(fromUid, toUid) {
  const snap = await systemCollection("minglConnections").where("participants", "array-contains", fromUid).limit(500).get();
  const writes = [];
  for (const doc of snap.docs) {
    const plan = core.connectionMergePlan({id: doc.id, ...doc.data()}, fromUid, toUid);
    if (plan.action === "close-self") {
      writes.push(batch => batch.set(doc.ref, {status: "merged", mergedInto: toUid, active: false, updatedAtMs: Date.now()}, {merge: true}));
      continue;
    }
    const existing = plan.action === "rekey" ? await systemCollection("minglConnections").doc(plan.toId).get() : {exists: false};
    if (plan.action === "rekey" && existing.exists) {
      writes.push(batch => batch.set(doc.ref, {status: "merged", mergedInto: plan.toId, active: false, updatedAtMs: Date.now()}, {merge: true}));
      continue;
    }
    const payload = {
      ...(doc.data() || {}),
      connectionId: plan.toId,
      participants: plan.participants,
      requestedBy: plan.requestedBy,
      requestedTo: plan.requestedTo,
      mergedFromUid: fromUid,
      updatedAtMs: Date.now()
    };
    if (plan.action === "rekey") {
      writes.push(batch => batch.set(systemCollection("minglConnections").doc(plan.toId), payload, {merge: true}));
      writes.push(batch => batch.set(doc.ref, {status: "merged", mergedInto: plan.toId, active: false, updatedAtMs: Date.now()}, {merge: true}));
    } else {
      writes.push(batch => batch.set(doc.ref, payload, {merge: true}));
    }
  }
  return writes;
}

async function reassignBotDeeRooms(fromUid, toUid) {
  const writes = [];
  const members = await systemCollection("botDeeRoomMembers").where("uid", "==", fromUid).limit(100).get();
  for (const doc of members.docs) {
    const row = doc.data() || {};
    const roomId = text(row.roomId, 80);
    if (!roomId) continue;
    const survivorRef = systemCollection("botDeeRoomMembers").doc(`${roomId}_${toUid}`);
    const survivorSnap = await survivorRef.get();
    if (!survivorSnap.exists) {
      writes.push(batch => batch.set(survivorRef, {...row, uid: toUid, mergedFromUid: fromUid}, {merge: true}));
    }
    writes.push(batch => batch.set(doc.ref, {leftAtMs: Date.now(), mergedInto: toUid}, {merge: true}));
    const roomRef = systemCollection("botDeeRooms").doc(roomId);
    writes.push(batch => batch.set(roomRef, {
      memberUids: FieldValue.arrayRemove(fromUid)
    }, {merge: true}));
    writes.push(batch => batch.set(roomRef, {
      memberUids: FieldValue.arrayUnion(toUid)
    }, {merge: true}));
  }
  const invites = await systemCollection("botDeeRoomInvites").where("targetUid", "==", fromUid).limit(100).get();
  invites.docs.forEach(doc => {
    writes.push(batch => batch.update(doc.ref, {targetUid: toUid, mergedFromUid: fromUid}));
  });
  return writes;
}

async function reassignPhoneIndexes(fromUid, toUid, extraPhones = []) {
  const writes = [];
  const snap = await systemCollection("phoneIndex").where("uid", "==", fromUid).limit(20).get();
  snap.docs.forEach(doc => {
    writes.push(batch => batch.set(doc.ref, {uid: toUid, updatedAtMs: Date.now()}, {merge: true}));
  });
  extraPhones.forEach(raw => {
    const e164 = core.normalizePhoneE164(raw);
    const id = core.phoneIndexId(e164);
    if (!id) return;
    writes.push(batch => batch.set(systemCollection("phoneIndex").doc(id), {
      uid: toUid,
      phoneE164: e164,
      updatedAtMs: Date.now()
    }, {merge: true}));
  });
  return writes;
}

async function reassignBlocks(fromUid, toUid) {
  const snaps = await Promise.all([
    systemCollection("userBlocks").where("blockedBy", "==", fromUid).limit(100).get(),
    systemCollection("userBlocks").where("blockedUid", "==", fromUid).limit(100).get()
  ]);
  const writes = [];
  snaps.forEach(snap => {
    snap.docs.forEach(doc => {
      const row = doc.data() || {};
      const next = {
        ...row,
        blockedBy: text(row.blockedBy, 128) === fromUid ? toUid : text(row.blockedBy, 128),
        blockedUid: text(row.blockedUid, 128) === fromUid ? toUid : text(row.blockedUid, 128),
        participants: core.rewriteParticipants(row.participants, fromUid, toUid),
        mergedFromUid: fromUid
      };
      if (next.blockedBy === next.blockedUid) {
        writes.push(batch => batch.delete(doc.ref));
        return;
      }
      writes.push(batch => batch.set(doc.ref, next, {merge: true}));
    });
  });
  return writes;
}

exports.claimPatronPhone = onCall(PATRON_CALL_OPTS, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const uid = request.auth.uid;
  const phone = core.normalizePhoneE164(request.data?.phoneE164 || request.data?.phone);
  if (!phone) throw new HttpsError("invalid-argument", "Enter a valid mobile number in international format.");
  const userRef = systemCollection("users").doc(uid);
  const userSnap = await userRef.get();
  const current = userSnap.exists ? userSnap.data() : {};
  if (text(current.mergedInto, 128) || text(current.accountStatus, 20) === "merged") {
    throw new HttpsError("failed-precondition", core.mergedAccountMessage(), {code: "account_merged"});
  }
  const {owners} = await findPhoneOwners(phone, uid);
  if (owners.size) {
    await writeUnchainedAudit(auditRecord(request, {
      eventType: "account.phone_denied",
      outcome: "denied",
      role: "patron",
      target: {type: "patron", id: uid},
      detail: {code: "phone_in_use"}
    }));
    throw new HttpsError("already-exists", core.phoneInUseMessage(), {code: "phone_in_use"});
  }
  const nowMs = Date.now();
  const indexRef = systemCollection("phoneIndex").doc(core.phoneIndexId(phone));
  await db.runTransaction(async tx => {
    const indexSnap = await tx.get(indexRef);
    if (indexSnap.exists) {
      const owner = text(indexSnap.data()?.uid, 128);
      if (owner && owner !== uid) {
        const ownerSnap = await tx.get(systemCollection("users").doc(owner));
        const ownerRow = ownerSnap.exists ? ownerSnap.data() || {} : {};
        const survivor = text(ownerRow.mergedInto, 128);
        if (survivor === uid) {
          /* Survivor reclaiming a phone left on a merged uid. */
        } else {
          throw new HttpsError("already-exists", core.phoneInUseMessage(), {code: "phone_in_use"});
        }
      }
    }
    tx.set(indexRef, {
      uid,
      phoneE164: phone,
      updatedAtMs: nowMs,
      createdAt: FieldValue.serverTimestamp()
    }, {merge: true});
    tx.set(userRef, {
      uid,
      phone,
      phoneE164: phone,
      phoneNormalized: phone,
      updatedAtMs: nowMs
    }, {merge: true});
  });
  await writeUnchainedAudit(auditRecord(request, {
    eventType: "account.phone_claimed",
    outcome: "success",
    role: "patron",
    target: {type: "patron", id: uid},
    detail: {phoneIndexId: core.phoneIndexId(phone)}
  }));
  return {ok: true, phoneE164: phone, claimed: true};
});

exports.lookupPatronAccounts = onCall(CALL_OPTS, async request => {
  await assertAdmin(request, "account.lookup");
  const people = await resolvePatron(request.data?.query);
  return {ok: true, people};
});

exports.previewPatronAccountMerge = onCall(CALL_OPTS, async request => {
  await assertAdmin(request, "account.merge_preview");
  let survivorUid = text(request.data?.survivorUid, 128);
  let duplicateUid = text(request.data?.duplicateUid, 128);
  if (!survivorUid && request.data?.survivorQuery) {
    const found = await resolvePatron(request.data.survivorQuery);
    survivorUid = found[0]?.uid || "";
  }
  if (!duplicateUid && request.data?.duplicateQuery) {
    const found = await resolvePatron(request.data.duplicateQuery);
    duplicateUid = found[0]?.uid || "";
  }
  const ids = core.assertDistinctUids(survivorUid, duplicateUid);
  const [left, right] = await Promise.all([loadMergeSide(ids.survivor), loadMergeSide(ids.duplicate)]);
  if (left.mergedInto || right.mergedInto || left.accountStatus === "merged" || right.accountStatus === "merged") {
    throw new HttpsError("failed-precondition", "One of these accounts is already merged.");
  }
  const rec = core.recommendSurvivor(left, right);
  const profilePatch = core.mergeProfileFields(left, right);
  return {
    ok: true,
    dryRun: true,
    authDeleted: false,
    recommendedSurvivorUid: rec.survivorUid,
    survivor: left,
    duplicate: right,
    scores: rec.scores,
    wouldMove: {
      profileFields: Object.keys(profilePatch),
      minglConnections: right.minglCount,
      inbox: right.inboxCount,
      betaFeatures: right.betaFeatures,
      botDee: right.botDeeUsed
    }
  };
});

exports.mergePatronAccounts = onCall(CALL_OPTS, async request => {
  const {email, sessionId} = await assertAdmin(request, "account.merge");
  let reason;
  try {
    reason = featureCore.validateReason(request.data?.reason);
  } catch (error) {
    throw asHttps(error);
  }
  const ids = core.assertDistinctUids(request.data?.survivorUid, request.data?.duplicateUid);
  const nowMs = Date.now();
  const [survivor, duplicate] = await Promise.all([loadMergeSide(ids.survivor), loadMergeSide(ids.duplicate)]);
  if (!survivor.exists && !duplicate.exists) throw new HttpsError("not-found", "Neither patron profile exists.");
  if (duplicate.mergedInto || duplicate.accountStatus === "merged") {
    throw new HttpsError("failed-precondition", "The duplicate account is already merged.");
  }
  const profilePatch = core.mergeProfileFields(
    {...(await systemCollection("users").doc(ids.survivor).get()).data(), uid: ids.survivor},
    {...(await systemCollection("users").doc(ids.duplicate).get()).data(), uid: ids.duplicate}
  );
  const betaUnion = core.unionBetaFeatures(survivor.betaFeatures, duplicate.betaFeatures);
  const phone = core.normalizePhoneE164(profilePatch.phoneE164 || survivor.phoneE164 || duplicate.phoneE164);

  await db.runTransaction(async tx => {
    const survivorRef = systemCollection("users").doc(ids.survivor);
    const duplicateRef = systemCollection("users").doc(ids.duplicate);
    const survivorBeta = systemCollection("betaTesters").doc(ids.survivor);
    const duplicateBeta = systemCollection("betaTesters").doc(ids.duplicate);
    const head = await tx.get(headRef());
    tx.set(survivorRef, {
      ...profilePatch,
      uid: ids.survivor,
      accountStatus: "active",
      mergedFromUids: FieldValue.arrayUnion(ids.duplicate),
      updatedAtMs: nowMs
    }, {merge: true});
    tx.set(duplicateRef, {
      accountStatus: "merged",
      mergedInto: ids.survivor,
      profileCompleted: false,
      updatedAtMs: nowMs
    }, {merge: true});
    if (survivor.isActiveBetaTester || duplicate.isActiveBetaTester) {
      tx.set(survivorBeta, {
        features: betaUnion,
        role: "betaTester",
        IsBetaTester: 1,
        status: "active",
        featuresUpdatedAtMs: nowMs,
        featuresUpdatedByEmail: email
      }, {merge: true});
    }
    if (duplicate.isActiveBetaTester) {
      tx.set(duplicateBeta, {status: "merged", mergedInto: ids.survivor, revokedAtMs: nowMs}, {merge: true});
    }
    if (phone) {
      tx.set(systemCollection("phoneIndex").doc(core.phoneIndexId(phone)), {
        uid: ids.survivor,
        phoneE164: phone,
        updatedAtMs: nowMs
      }, {merge: true});
    }
    appendChainedAudit(tx, head, auditRecord(request, {
      eventType: "account.merged",
      target: {type: "patron", id: ids.survivor},
      before: {duplicateUid: ids.duplicate, mingl: duplicate.minglCount, inbox: duplicate.inboxCount, beta: duplicate.betaFeatures},
      after: {survivorUid: ids.survivor, beta: betaUnion, authDeleted: false},
      reason,
      sessionId,
      nowMs
    }));
  });

  const writes = [
    ...(await reassignMingl(ids.duplicate, ids.survivor)),
    ...(await reassignInbox(ids.duplicate, ids.survivor)),
    ...(await reassignBotDeeRooms(ids.duplicate, ids.survivor)),
    ...(await reassignBlocks(ids.duplicate, ids.survivor)),
    ...(await copyThreadExtras(ids.duplicate, ids.survivor)),
    ...(await reassignPhoneIndexes(ids.duplicate, ids.survivor, [
      survivor.phoneE164,
      duplicate.phoneE164,
      profilePatch.phoneE164,
      phone
    ]))
  ];
  await commitBatches(writes);
  return {
    ok: true,
    survivorUid: ids.survivor,
    duplicateUid: ids.duplicate,
    authDeleted: false,
    moved: {
      mingl: duplicate.minglCount,
      inbox: duplicate.inboxCount,
      betaFeatures: betaUnion,
      botDee: duplicate.botDeeUsed
    }
  };
});
