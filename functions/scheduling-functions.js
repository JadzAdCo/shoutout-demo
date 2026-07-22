/* FLOQR Staff & Talent Scheduling — $20 subscription + shift notify/approve. */
"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SCHEDULING_PRICE_CENTS = 2000;
const OWNER_TYPES = new Set(["club", "promoterCompany", "dj"]);

function text(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}

function ownerKey(ownerType, ownerId) {
  return `${text(ownerType, 40)}:${text(ownerId, 160)}`;
}

function parseOwnerKey(key = "") {
  const raw = text(key, 220);
  const idx = raw.indexOf(":");
  if (idx < 1) return {ownerType: "", ownerId: ""};
  return {ownerType: raw.slice(0, idx), ownerId: raw.slice(idx + 1)};
}

async function isMasterAdminAuth(authContext = {}) {
  const email = String(authContext.token?.email || "").toLowerCase();
  if (!email) return false;
  const snap = await db.collection("platformSettings").doc("masterAdmins").get();
  const emails = snap.exists && Array.isArray(snap.data()?.emails) ? snap.data().emails.map(v => String(v).toLowerCase()) : [];
  return emails.includes(email);
}

async function canManageOwner(ownerType, ownerId, authContext = {}) {
  const uid = authContext.uid || "";
  if (!uid || !OWNER_TYPES.has(ownerType) || !ownerId) return false;
  if (await isMasterAdminAuth(authContext)) return true;
  if (ownerType === "dj") return ownerId === uid;
  if (ownerType === "promoterCompany") {
    const sub = await db.collection("schedulingSubscriptions").doc(ownerKey(ownerType, ownerId)).get();
    if (sub.exists && text(sub.data()?.ownerUid, 160) === uid) return true;
    const userSnap = await db.collection("users").doc(uid).get();
    const roles = userSnap.exists && Array.isArray(userSnap.data()?.approvedRoles) ? userSnap.data().approvedRoles : [];
    const company = text(userSnap.data()?.promoterCompany || userSnap.data()?.promotionCompany || "", 160).toLowerCase();
    return roles.some(r => /promot/i.test(String(r))) && company && company === ownerId.toLowerCase();
  }
  // club
  const email = String(authContext.token?.email || "").toLowerCase();
  const clubSnap = await db.collection("clubLocations").doc(ownerId).get();
  if (clubSnap.exists) {
    const club = clubSnap.data() || {};
    if ([...(club.adminUids || []), ...(club.masterAdminUids || [])].includes(uid)) return true;
    if ((club.adminEmails || []).map(v => String(v).toLowerCase()).includes(email)) return true;
  }
  const safeId = `${ownerId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const [assignment, designation] = await Promise.all([
    db.collection("clubAdminAssignments").doc(safeId).get(),
    db.collection("clubEmployeeDesignations").doc(safeId).get()
  ]);
  if (assignment.exists && text(assignment.data()?.status, 40).toLowerCase() === "active") return true;
  if (!designation.exists || designation.data()?.status === "rejected") return false;
  const worker = designation.data() || {};
  if (/club admin/i.test(worker.roleElectionType || "")) return true;
  return (worker.rolePermissions || []).some(permission => permission === "manageSchedules");
}

async function requireActiveSubscription(ownerType, ownerId) {
  const key = ownerKey(ownerType, ownerId);
  const snap = await db.collection("schedulingSubscriptions").doc(key).get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Staff Scheduling requires an active $20/month subscription.");
  const status = text(snap.data()?.status, 40).toLowerCase();
  if (!["active", "trialing"].includes(status)) {
    throw new HttpsError("failed-precondition", "Staff Scheduling subscription is not active. Renew the $20/month plan to continue.");
  }
  return {key, data: snap.data() || {}};
}

async function writeInbox(recipientUid, payload = {}) {
  if (!recipientUid) return;
  await db.collection("inboxNotifications").add({
    recipientUid,
    type: "scheduleShift",
    title: text(payload.title, 160) || "Schedule update",
    body: text(payload.body, 1500),
    link: text(payload.link, 500),
    shiftId: text(payload.shiftId, 120),
    ownerKey: text(payload.ownerKey, 220),
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function notifyAssigneeChannels(shift, purpose = "schedule-invite") {
  const body = text(
    `${shift.ownerName || "FLOQR"} schedule: ${shift.roleLabel || shift.role || "Shift"} ` +
    `${shift.startsAtLabel || ""} – ${shift.endsAtLabel || ""}. ` +
    `Open FLOQR Scheduling to ${shift.status === "pending" ? "Approve or Decline" : "View"}.`,
    900
  );
  const results = {inApp: false, channelsQueued: false};

  await writeInbox(shift.assigneeUid, {
    title: shift.status === "pending" ? "New shift needs your approval" : "Schedule update",
    body,
    link: `scheduling.html?owner=${encodeURIComponent(shift.ownerKey)}&shift=${encodeURIComponent(shift.id || "")}`,
    shiftId: shift.id,
    ownerKey: shift.ownerKey
  });
  results.inApp = true;

  // Queue for Notification Fabric (SMS/WhatsApp/email workers pick up; also visible in Club Admin).
  await db.collection("scheduleNotifyQueue").add({
    shiftId: text(shift.id, 120),
    ownerKey: text(shift.ownerKey, 220),
    ownerType: text(shift.ownerType, 40),
    ownerId: text(shift.ownerId, 160),
    clubLocationId: text(shift.clubLocationId, 160),
    assigneeUid: text(shift.assigneeUid, 160),
    assigneeEmail: text(shift.assigneeEmail, 200),
    assigneePhone: text(shift.assigneePhone, 40),
    purpose: text(purpose, 80),
    body,
    status: "queued",
    channels: ["email", "sms", "whatsapp"],
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  results.channelsQueued = true;
  return results;
}

exports.getSchedulingAccess = onCall({region: "us-central1", timeoutSeconds: 20, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const ownerType = text(request.data?.ownerType, 40);
  const ownerId = text(request.data?.ownerId, 160);
  if (!OWNER_TYPES.has(ownerType) || !ownerId) throw new HttpsError("invalid-argument", "ownerType and ownerId are required.");
  const key = ownerKey(ownerType, ownerId);
  const snap = await db.collection("schedulingSubscriptions").doc(key).get();
  const data = snap.exists ? snap.data() || {} : {};
  const canManage = await canManageOwner(ownerType, ownerId, request.auth);
  return {
    ownerKey: key,
    ownerType,
    ownerId,
    canManage,
    subscribed: ["active", "trialing"].includes(text(data.status, 40).toLowerCase()),
    status: text(data.status, 40) || "none",
    priceCents: SCHEDULING_PRICE_CENTS,
    currentPeriodEnd: data.currentPeriodEnd || null
  };
});

exports.createScheduleShift = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const ownerType = text(request.data?.ownerType, 40);
  const ownerId = text(request.data?.ownerId, 160);
  if (!OWNER_TYPES.has(ownerType) || !ownerId) throw new HttpsError("invalid-argument", "ownerType and ownerId are required.");
  if (!await canManageOwner(ownerType, ownerId, request.auth)) {
    throw new HttpsError("permission-denied", "You cannot create schedules for this member.");
  }
  const sub = await requireActiveSubscription(ownerType, ownerId);

  const startsAt = text(request.data?.startsAt, 40);
  const endsAt = text(request.data?.endsAt, 40);
  if (!startsAt || !endsAt) throw new HttpsError("invalid-argument", "Shift start and end times are required (ISO).");
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new HttpsError("invalid-argument", "Shift end must be after start.");
  }

  const assigneeUid = text(request.data?.assigneeUid, 160);
  const assigneeName = text(request.data?.assigneeName, 120) || "Team member";
  const roleLabel = text(request.data?.roleLabel || request.data?.role, 80) || "Shift";
  const notes = text(request.data?.notes, 1000);
  const venueName = text(request.data?.venueName, 160);
  const notify = request.data?.notify !== false;
  const requireApproval = request.data?.requireApproval !== false;

  const ref = db.collection("scheduleShifts").doc();
  const key = sub.key;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const shift = {
    id: ref.id,
    ownerKey: key,
    ownerType,
    ownerId,
    ownerName: text(request.data?.ownerName || sub.data.ownerName, 160),
    clubLocationId: ownerType === "club" ? ownerId : text(request.data?.clubLocationId, 160),
    roleLabel,
    assigneeUid,
    assigneeName,
    assigneeEmail: text(request.data?.assigneeEmail, 200).toLowerCase(),
    assigneePhone: text(request.data?.assigneePhone, 40),
    startsAt,
    endsAt,
    startsAtMs: startMs,
    endsAtMs: endMs,
    startsAtLabel: text(request.data?.startsAtLabel, 80) || new Date(startMs).toLocaleString(),
    endsAtLabel: text(request.data?.endsAtLabel, 80) || new Date(endMs).toLocaleString(),
    venueName,
    notes,
    status: requireApproval && assigneeUid ? "pending" : "confirmed",
    requireApproval: !!requireApproval,
    createdByUid: request.auth.uid,
    createdByEmail: text(request.auth.token?.email, 200).toLowerCase(),
    createdAt: now,
    updatedAt: now
  };
  await ref.set(shift);

  let notifyResult = null;
  if (notify && assigneeUid) {
    notifyResult = await notifyAssigneeChannels({...shift, id: ref.id}, "schedule-invite");
    await ref.set({
      notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      notifyResult
    }, {merge: true});
  }

  return {shiftId: ref.id, status: shift.status, notifyResult};
});

exports.respondToScheduleShift = onCall({region: "us-central1", timeoutSeconds: 20, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const shiftId = text(request.data?.shiftId, 120);
  const decision = text(request.data?.decision, 20).toLowerCase();
  if (!shiftId || !["approve", "decline"].includes(decision)) {
    throw new HttpsError("invalid-argument", "shiftId and decision (approve|decline) are required.");
  }
  const ref = db.collection("scheduleShifts").doc(shiftId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Shift not found.");
  const shift = snap.data() || {};
  const uid = request.auth.uid;
  const isAssignee = text(shift.assigneeUid, 160) === uid;
  const isManager = await canManageOwner(text(shift.ownerType, 40), text(shift.ownerId, 160), request.auth);
  if (!isAssignee && !isManager) throw new HttpsError("permission-denied", "Only the assigned worker or schedule manager can respond.");
  if (text(shift.status, 40) !== "pending" && !isManager) {
    throw new HttpsError("failed-precondition", "This shift is no longer awaiting approval.");
  }
  const nextStatus = decision === "approve" ? "approved" : "declined";
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    status: nextStatus,
    responseDecision: decision,
    respondedByUid: uid,
    respondedAt: now,
    updatedAt: now
  }, {merge: true});

  await writeInbox(shift.createdByUid, {
    title: `Shift ${nextStatus}`,
    body: `${shift.assigneeName || "Worker"} ${nextStatus} the ${shift.roleLabel || "shift"} on ${shift.startsAtLabel || shift.startsAt || ""}.`,
    link: `scheduling.html?owner=${encodeURIComponent(shift.ownerKey || "")}&shift=${encodeURIComponent(shiftId)}`,
    shiftId,
    ownerKey: shift.ownerKey
  });

  return {shiftId, status: nextStatus};
});

exports.listScheduleShifts = onCall({region: "us-central1", timeoutSeconds: 20, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const ownerType = text(request.data?.ownerType, 40);
  const ownerId = text(request.data?.ownerId, 160);
  const mineOnly = request.data?.mineOnly === true;
  const uid = request.auth.uid;

  if (mineOnly) {
    const snap = await db.collection("scheduleShifts")
      .where("assigneeUid", "==", uid)
      .limit(80)
      .get();
    const shifts = snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
      .sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0));
    return {shifts};
  }

  if (!OWNER_TYPES.has(ownerType) || !ownerId) throw new HttpsError("invalid-argument", "ownerType and ownerId are required.");
  const canManage = await canManageOwner(ownerType, ownerId, request.auth);
  const key = ownerKey(ownerType, ownerId);
  if (!canManage) {
    const snap = await db.collection("scheduleShifts")
      .where("ownerKey", "==", key)
      .limit(120)
      .get();
    const shifts = snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
      .filter(row => text(row.assigneeUid, 160) === uid);
    return {shifts, canManage: false};
  }
  const snap = await db.collection("scheduleShifts")
    .where("ownerKey", "==", key)
    .limit(120)
    .get();
  const shifts = snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
    .sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0));
  return {shifts, canManage: true};
});
