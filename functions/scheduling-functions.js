/* FLOQR Staff & Talent Scheduling — $20 subscription + shift notify/approve. */
"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  normalizeShiftStatus,
  publishedShiftStatus,
  parseShiftBounds,
  nextStatusForShiftUpdate,
  canDeleteShiftStatus,
  sanitizeShiftIds,
  isPublishedShiftStatus,
  publicShiftView,
  touchesPublicScheduleCache,
  workerAllowsNotifyChannel,
  clubAllowsNotifyChannel,
  shiftApproveUrl,
  buildShiftInviteBody,
  DEFAULT_ORIGIN
} = require("./scheduling-core");

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

async function bumpPublicScheduleRevision(ownerType, ownerId, previousStatus, nextStatus) {
  if (ownerType !== "club" || !ownerId) return;
  if (!touchesPublicScheduleCache(previousStatus, nextStatus)) return;
  await db.collection("clubLocations").doc(ownerId).set({
    publicScheduleRevision: admin.firestore.FieldValue.increment(1),
    publicScheduleUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
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

/** Explicit venue/portal gate: staffSchedulingPaid === 1 means calendar unlocked (no Subscribe CTA). */
function paidFlagFromValue(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return null;
}

function isDemoFirebaseProject() {
  const project = String(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "").toLowerCase();
  try {
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG || "{}");
    const id = String(cfg.projectId || project || "").toLowerCase();
    return id.includes("shoutoutdemo");
  } catch (_error) {
    return project.includes("shoutoutdemo");
  }
}

function looksLikeDemoClub(club = {}, ownerId = "") {
  if (club.demo === true || club.isDemo === true) return true;
  if (paidFlagFromValue(club.staffSchedulingPaid) === 1 && text(club.schedulingEntitlementSource, 40) === "demo") return true;
  const blob = [
    ownerId,
    club.id,
    club.activityStatus,
    club.onboardingSource,
    club.brand,
    club.locationName,
    club.clubName
  ].map(v => String(v || "")).join(" ").toLowerCase();
  if (/\bdemo\b/.test(blob) || /shoutout-demo|floqr demo|active demo location/.test(blob)) return true;
  // Entire shoutoutdemo Firebase catalog is demo-entitled until production cutover.
  if (isDemoFirebaseProject() && club && Object.keys(club).length) return true;
  return false;
}

const MONTH_STATUS_PAID = "paid this month";
const MONTH_STATUS_UNPAID = "not paid this month";

function currentBillingMonthKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function hasEverSubscribed(sub = {}, club = null) {
  if (sub.everSubscribed === true || sub.wasSubscriber === true) return true;
  if (sub.activatedAt || sub.lastPaidAt || sub.stripeSubscriptionId || sub.serviceOrderId) return true;
  if (text(sub.status, 80) === MONTH_STATUS_PAID || text(sub.status, 80) === MONTH_STATUS_UNPAID) return true;
  if (["active", "trialing", "canceled", "past_due", "unpaid"].includes(text(sub.status, 40).toLowerCase()) && Object.keys(sub).length > 2) {
    return true;
  }
  if (club && (club.schedulingEverSubscribed === true || club.schedulingLastPaidAt)) return true;
  return false;
}

function monthStatusForPaid(paid) {
  return paid === 1 ? MONTH_STATUS_PAID : MONTH_STATUS_UNPAID;
}

async function writeStaffSchedulingPaid(ownerType, ownerId, paid, extra = {}) {
  const key = ownerKey(ownerType, ownerId);
  const flag = paid ? 1 : 0;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const monthStatus = text(extra.status, 80) || monthStatusForPaid(flag);
  const subPayload = {
    ownerKey: key,
    ownerType,
    ownerId,
    paid: flag,
    staffSchedulingPaid: flag,
    status: monthStatus,
    monthStatus,
    billingMonthKey: text(extra.billingMonthKey, 20) || (flag === 1 ? currentBillingMonthKey() : text(extra.priorBillingMonthKey, 20) || ""),
    everSubscribed: flag === 1 ? true : (extra.everSubscribed === false ? false : true),
    updatedAt: now,
    ...extra,
    status: monthStatus,
    monthStatus
  };
  if (flag === 1) {
    subPayload.lastPaidAt = now;
    subPayload.lastPaidMonthKey = currentBillingMonthKey();
    subPayload.everSubscribed = true;
  }
  await db.collection("schedulingSubscriptions").doc(key).set(subPayload, {merge: true});
  if (ownerType === "club" && ownerId) {
    const clubPayload = {
      staffSchedulingPaid: flag,
      schedulingMonthStatus: monthStatus,
      schedulingEntitlementSource: text(extra.source || extra.schedulingEntitlementSource, 40) || (flag === 1 ? "subscription" : "none"),
      schedulingPaidUpdatedAt: now
    };
    if (flag === 1) {
      clubPayload.schedulingEverSubscribed = true;
      clubPayload.schedulingLastPaidAt = now;
      clubPayload.schedulingLastPaidMonthKey = currentBillingMonthKey();
    } else if (extra.everSubscribed !== false) {
      clubPayload.schedulingEverSubscribed = true;
    }
    await db.collection("clubLocations").doc(ownerId).set(clubPayload, {merge: true});
  }
  return {key, paid: flag, status: monthStatus};
}

/**
 * Entitlement source of truth:
 * 1) clubLocations.staffSchedulingPaid (0|1) for clubs
 * 2) schedulingSubscriptions.paid + status "paid this month" | "not paid this month"
 * 3) demo venues → auto-set staffSchedulingPaid=1 once
 *
 * CTA: paid=1 → calendar; paid=0 + everSubscribed → Resubscribe; else Subscribe
 */
async function resolveSchedulingEntitlement(ownerType, ownerId) {
  const key = ownerKey(ownerType, ownerId);
  const subRef = db.collection("schedulingSubscriptions").doc(key);
  const subSnap = await subRef.get();
  const sub = subSnap.exists ? subSnap.data() || {} : {};
  const subPaid = paidFlagFromValue(sub.paid ?? sub.staffSchedulingPaid);
  const legacyActive = ["active", "trialing"].includes(text(sub.status, 40).toLowerCase());
  const monthPaid = text(sub.status, 80) === MONTH_STATUS_PAID
    || text(sub.monthStatus, 80) === MONTH_STATUS_PAID
    || (subPaid === 1)
    || legacyActive;

  let clubPaid = null;
  let club = null;
  if (ownerType === "club" && ownerId) {
    const clubSnap = await db.collection("clubLocations").doc(ownerId).get();
    if (clubSnap.exists) {
      club = clubSnap.data() || {};
      clubPaid = paidFlagFromValue(club.staffSchedulingPaid);
    }
  }

  const ever = hasEverSubscribed(sub, club);

  // Explicit venue/sub unpaid → Resubscribe if they were ever on the plan.
  if (clubPaid === 0 || (subPaid === 0 && clubPaid !== 1) || ((text(sub.status, 80) === MONTH_STATUS_UNPAID || text(sub.monthStatus, 80) === MONTH_STATUS_UNPAID) && clubPaid !== 1)) {
    return {
      key,
      paid: 0,
      subscribed: false,
      status: MONTH_STATUS_UNPAID,
      monthStatus: MONTH_STATUS_UNPAID,
      everSubscribed: ever,
      cta: ever ? "resubscribe" : "subscribe",
      source: ever ? "not-paid-this-month" : "never-subscribed",
      data: sub,
      club
    };
  }

  if (clubPaid === 1 || monthPaid) {
    if (ownerType === "club" && clubPaid !== 1) {
      await writeStaffSchedulingPaid(ownerType, ownerId, true, {
        source: legacyActive ? "subscription" : "backfill",
        status: MONTH_STATUS_PAID,
        stripeSubscriptionId: text(sub.stripeSubscriptionId, 160),
        ownerName: text(sub.ownerName || club?.locationName || club?.clubName, 160),
        everSubscribed: true
      });
    } else if (subPaid !== 1 || text(sub.status, 80) !== MONTH_STATUS_PAID) {
      await subRef.set({
        paid: 1,
        staffSchedulingPaid: 1,
        status: MONTH_STATUS_PAID,
        monthStatus: MONTH_STATUS_PAID,
        everSubscribed: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
    }
    return {
      key,
      paid: 1,
      subscribed: true,
      status: MONTH_STATUS_PAID,
      monthStatus: MONTH_STATUS_PAID,
      everSubscribed: true,
      cta: "none",
      source: clubPaid === 1 ? "clubLocations.staffSchedulingPaid" : "schedulingSubscriptions.paid",
      data: sub,
      club
    };
  }

  // Demo venues: entitle once so portal shows calendar (not Subscribe $20).
  if (ownerType === "club" && club && looksLikeDemoClub(club, ownerId)) {
    await writeStaffSchedulingPaid(ownerType, ownerId, true, {
      source: "demo",
      schedulingEntitlementSource: "demo",
      status: MONTH_STATUS_PAID,
      ownerName: text(club.locationName || club.clubName || club.brandName, 160),
      priceCents: SCHEDULING_PRICE_CENTS,
      billingInterval: "month",
      everSubscribed: true,
      activatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
      key,
      paid: 1,
      subscribed: true,
      status: MONTH_STATUS_PAID,
      monthStatus: MONTH_STATUS_PAID,
      everSubscribed: true,
      cta: "none",
      source: "demo",
      data: sub,
      club
    };
  }

  return {
    key,
    paid: 0,
    subscribed: false,
    status: MONTH_STATUS_UNPAID,
    monthStatus: MONTH_STATUS_UNPAID,
    everSubscribed: ever,
    cta: ever ? "resubscribe" : "subscribe",
    source: "unpaid",
    data: sub,
    club
  };
}

async function requireActiveSubscription(ownerType, ownerId) {
  const entitlement = await resolveSchedulingEntitlement(ownerType, ownerId);
  if (!entitlement.subscribed || entitlement.paid !== 1) {
    throw new HttpsError("failed-precondition", "Staff Scheduling requires an active $20/month subscription (staffSchedulingPaid=1).");
  }
  return {key: entitlement.key, data: entitlement.data || {}, paid: 1};
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

async function writeScheduleAudit(entry = {}) {
  try {
    await db.collection("scheduleShiftAudit").add({
      action: text(entry.action, 40),
      shiftId: text(entry.shiftId, 120),
      ownerKey: text(entry.ownerKey, 220),
      ownerType: text(entry.ownerType, 40),
      ownerId: text(entry.ownerId, 160),
      clubLocationId: text(entry.clubLocationId, 160),
      actorUid: text(entry.actorUid, 160),
      actorEmail: text(entry.actorEmail, 200).toLowerCase(),
      assigneeUid: text(entry.assigneeUid, 160),
      assigneeName: text(entry.assigneeName, 120),
      status: text(entry.status, 40),
      source: text(entry.source, 80),
      channels: Array.isArray(entry.channels) ? entry.channels.map(v => text(v, 20)).filter(Boolean).slice(0, 8) : [],
      message: text(entry.message, 500),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now()
    });
  } catch (error) {
    console.error("scheduleShiftAudit write failed", error?.message || error);
  }
}

async function notifyAssigneeChannels(shift, purpose = "schedule-invite") {
  const origin = process.env.FLOQR_PUBLIC_ORIGIN || DEFAULT_ORIGIN;
  const approveUrl = shiftApproveUrl({...shift, id: shift.id}, origin);
  const body = buildShiftInviteBody({...shift, id: shift.id}, origin);
  const results = {inApp: false, channelsQueued: false, approveUrl};

  let worker = {};
  if (text(shift.assigneeUid, 160)) {
    try {
      const snap = await db.collection("users").doc(text(shift.assigneeUid, 160)).get();
      worker = snap.exists ? snap.data() || {} : {};
    } catch (_error) {
      worker = {};
    }
  }

  let clubSettings = {};
  const clubLocationId = text(shift.clubLocationId, 160);
  if (clubLocationId) {
    try {
      const settingsSnap = await db.collection("clubNotificationSettings").doc(clubLocationId).get();
      clubSettings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    } catch (_error) {
      clubSettings = {};
    }
  }

  const channels = [];
  if (workerAllowsNotifyChannel(worker, "inapp") && clubAllowsNotifyChannel(clubSettings, "inapp")) {
    await writeInbox(shift.assigneeUid, {
      title: normalizeShiftStatus(shift.status) === "pending" ? "New shift needs your confirmation" : "Schedule update",
      body,
      link: `./scheduling.html?shift=${encodeURIComponent(shift.id || "")}&from=schedule-notify&v=29.09.114`,
      shiftId: shift.id,
      ownerKey: shift.ownerKey
    });
    results.inApp = true;
    channels.push("inapp");
  }

  const phone = text(shift.assigneePhone || worker.phone || worker.phoneNumber || worker.mobile, 40);
  const email = text(shift.assigneeEmail || worker.email, 200).toLowerCase();
  if (phone && workerAllowsNotifyChannel(worker, "sms") && clubAllowsNotifyChannel(clubSettings, "sms")) channels.push("sms");
  if (phone && workerAllowsNotifyChannel(worker, "whatsapp") && clubAllowsNotifyChannel(clubSettings, "whatsapp")) channels.push("whatsapp");
  if (email && workerAllowsNotifyChannel(worker, "email") && clubAllowsNotifyChannel(clubSettings, "email")) channels.push("email");
  if (workerAllowsNotifyChannel(worker, "push")) channels.push("push");

  if (channels.includes("sms") || channels.includes("whatsapp") || channels.includes("email")) {
    await db.collection("scheduleNotifyQueue").add({
      shiftId: text(shift.id, 120),
      ownerKey: text(shift.ownerKey, 220),
      ownerType: text(shift.ownerType, 40),
      ownerId: text(shift.ownerId, 160),
      clubLocationId,
      assigneeUid: text(shift.assigneeUid, 160),
      assigneeEmail: email,
      assigneePhone: phone,
      purpose: text(purpose, 80),
      body,
      approveUrl,
      status: "queued",
      channels,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    results.channelsQueued = true;
  }
  results.channels = channels;
  await writeScheduleAudit({
    action: purpose === "schedule-cancelled" ? "notified-cancel" : "notified",
    shiftId: shift.id,
    ownerKey: shift.ownerKey,
    ownerType: shift.ownerType,
    ownerId: shift.ownerId,
    clubLocationId,
    actorUid: text(shift.createdByUid || shift.publishedByUid, 160),
    assigneeUid: shift.assigneeUid,
    assigneeName: shift.assigneeName,
    status: shift.status,
    source: "notify",
    channels,
    message: `${purpose} via ${channels.join("/") || "none"}`
  });
  return results;
}

exports.getSchedulingAccess = onCall({region: "us-central1", timeoutSeconds: 20, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const ownerType = text(request.data?.ownerType, 40);
  const ownerId = text(request.data?.ownerId, 160);
  if (!OWNER_TYPES.has(ownerType) || !ownerId) throw new HttpsError("invalid-argument", "ownerType and ownerId are required.");
  const entitlement = await resolveSchedulingEntitlement(ownerType, ownerId);
  const canManage = await canManageOwner(ownerType, ownerId, request.auth);
  return {
    ownerKey: entitlement.key,
    ownerType,
    ownerId,
    canManage,
    /** Portal/UI gate: paid===1 → calendar; paid===0 → Subscribe or Resubscribe */
    staffSchedulingPaid: entitlement.paid,
    paid: entitlement.paid,
    subscribed: entitlement.subscribed === true && entitlement.paid === 1,
    status: entitlement.status,
    monthStatus: entitlement.monthStatus || entitlement.status,
    everSubscribed: entitlement.everSubscribed === true,
    cta: entitlement.cta || (entitlement.paid === 1 ? "none" : (entitlement.everSubscribed ? "resubscribe" : "subscribe")),
    entitlementSource: entitlement.source,
    priceCents: SCHEDULING_PRICE_CENTS,
    currentPeriodEnd: entitlement.data?.currentPeriodEnd || null
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
  const asDraft = request.data?.asDraft === true || request.data?.draft === true || text(request.data?.status, 40) === "draft";
  const notify = asDraft ? false : request.data?.notify !== false;

  const ref = db.collection("scheduleShifts").doc();
  const key = sub.key;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const status = publishedShiftStatus({asDraft, assigneeUid});
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
    status,
    published: !asDraft,
    requireApproval: true,
    assignMode: text(request.data?.assignMode, 40) || (asDraft ? "manual" : "manual"),
    createdByUid: request.auth.uid,
    createdByEmail: text(request.auth.token?.email, 200).toLowerCase(),
    createdAt: now,
    updatedAt: now
  };
  await ref.set(shift);

  await bumpPublicScheduleRevision(ownerType, ownerId, "", status);

  await writeScheduleAudit({
    action: "created",
    shiftId: ref.id,
    ownerKey: key,
    ownerType,
    ownerId,
    clubLocationId: shift.clubLocationId,
    actorUid: request.auth.uid,
    actorEmail: request.auth.token?.email,
    assigneeUid,
    assigneeName,
    status: shift.status,
    source: asDraft ? "draft" : "create",
    message: `${assigneeName} ${roleLabel} ${asDraft ? "draft" : "pending"}`
  });

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

exports.updateScheduleShift = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const shiftId = text(request.data?.shiftId, 120);
  if (!shiftId) throw new HttpsError("invalid-argument", "shiftId is required.");
  const ref = db.collection("scheduleShifts").doc(shiftId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Shift not found.");
  const existing = snap.data() || {};
  const ownerType = text(existing.ownerType, 40);
  const ownerId = text(existing.ownerId, 160);
  if (!OWNER_TYPES.has(ownerType) || !ownerId) {
    throw new HttpsError("failed-precondition", "This shift is missing owner data.");
  }
  if (!await canManageOwner(ownerType, ownerId, request.auth)) {
    throw new HttpsError("permission-denied", "You cannot update this shift.");
  }
  await requireActiveSubscription(ownerType, ownerId);

  const bounds = parseShiftBounds(request.data?.startsAt, request.data?.endsAt);
  if (!bounds) throw new HttpsError("invalid-argument", "Shift end must be after start.");

  const assigneeUid = text(request.data?.assigneeUid, 160) || text(existing.assigneeUid, 160);
  const asDraft = request.data?.asDraft === true || request.data?.draft === true || text(request.data?.status, 40) === "draft";
  const status = nextStatusForShiftUpdate({
    asDraft,
    assigneeUid,
    previousStatus: existing.status,
    startMs: bounds.startMs,
    endMs: bounds.endMs,
    previousStartMs: Number(existing.startsAtMs || 0),
    previousEndMs: Number(existing.endsAtMs || 0),
    previousAssigneeUid: text(existing.assigneeUid, 160)
  });
  const now = admin.firestore.FieldValue.serverTimestamp();
  const patch = {
    roleLabel: text(request.data?.roleLabel || request.data?.role, 80) || text(existing.roleLabel, 80) || "Shift",
    assigneeUid,
    assigneeName: text(request.data?.assigneeName, 120) || text(existing.assigneeName, 120) || "Team member",
    assigneeEmail: text(request.data?.assigneeEmail, 200).toLowerCase() || text(existing.assigneeEmail, 200).toLowerCase(),
    assigneePhone: text(request.data?.assigneePhone, 40) || text(existing.assigneePhone, 40),
    startsAt: bounds.startsAt,
    endsAt: bounds.endsAt,
    startsAtMs: bounds.startMs,
    endsAtMs: bounds.endMs,
    startsAtLabel: text(request.data?.startsAtLabel, 80) || new Date(bounds.startMs).toLocaleString(),
    endsAtLabel: text(request.data?.endsAtLabel, 80) || new Date(bounds.endMs).toLocaleString(),
    venueName: text(request.data?.venueName, 160) || text(existing.venueName, 160),
    notes: text(request.data?.notes, 1000),
    status,
    published: status !== "draft",
    assignMode: text(request.data?.assignMode, 40) || text(existing.assignMode, 40) || "manual",
    updatedAt: now,
    updatedByUid: request.auth.uid
  };
  await ref.set(patch, {merge: true});

  await bumpPublicScheduleRevision(ownerType, ownerId, existing.status, status);

  const prevStatus = normalizeShiftStatus(existing.status);
  const shouldNotify = status === "pending" && prevStatus !== "pending" && assigneeUid && request.data?.notify !== false;
  let notifyResult = null;
  if (shouldNotify) {
    const merged = {...existing, ...patch, id: shiftId};
    notifyResult = await notifyAssigneeChannels(merged, "schedule-invite");
    await ref.set({
      notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      notifyResult
    }, {merge: true});
  }

  return {shiftId, status, notifyResult, updated: true};
});

exports.publishScheduleShifts = onCall({region: "us-central1", timeoutSeconds: 60, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const ownerType = text(request.data?.ownerType, 40);
  const ownerId = text(request.data?.ownerId, 160);
  if (!OWNER_TYPES.has(ownerType) || !ownerId) throw new HttpsError("invalid-argument", "ownerType and ownerId are required.");
  if (!await canManageOwner(ownerType, ownerId, request.auth)) {
    throw new HttpsError("permission-denied", "You cannot publish schedules for this member.");
  }
  await requireActiveSubscription(ownerType, ownerId);
  const key = ownerKey(ownerType, ownerId);
  const ids = Array.isArray(request.data?.shiftIds)
    ? request.data.shiftIds.map(id => text(id, 120)).filter(Boolean).slice(0, 80)
    : [];
  const weekStartMs = Number(request.data?.weekStartMs || 0);
  const weekEndMs = Number(request.data?.weekEndMs || 0);
  const snap = await db.collection("scheduleShifts").where("ownerKey", "==", key).limit(120).get();
  const candidates = snap.docs.map(doc => ({id: doc.id, ...doc.data()})).filter(row => {
    if (text(row.status, 40) !== "draft") return false;
    if (ids.length) return ids.includes(row.id);
    if (Number.isFinite(weekStartMs) && Number.isFinite(weekEndMs) && weekEndMs > weekStartMs) {
      const start = Number(row.startsAtMs || 0);
      return start >= weekStartMs && start < weekEndMs;
    }
    return false;
  });
  if (!candidates.length) return {published: 0, results: []};
  const results = [];
  for (const shift of candidates) {
    const nextStatus = text(shift.assigneeUid, 160) ? "pending" : "open";
    const ref = db.collection("scheduleShifts").doc(shift.id);
    await ref.set({
      status: nextStatus,
      published: true,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedByUid: request.auth.uid,
      publishedByEmail: text(request.auth.token?.email, 200).toLowerCase(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    await writeScheduleAudit({
      action: "published",
      shiftId: shift.id,
      ownerKey: key,
      ownerType,
      ownerId,
      clubLocationId: text(shift.clubLocationId, 160) || (ownerType === "club" ? ownerId : ""),
      actorUid: request.auth.uid,
      actorEmail: request.auth.token?.email,
      assigneeUid: shift.assigneeUid,
      assigneeName: shift.assigneeName,
      status: nextStatus,
      source: "publish-week",
      message: `Published ${shift.roleLabel || "shift"} for ${shift.assigneeName || "staff"}`
    });
    let notifyResult = null;
    if (text(shift.assigneeUid, 160)) {
      notifyResult = await notifyAssigneeChannels({...shift, status: nextStatus}, "schedule-invite");
      await ref.set({
        notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        notifyResult
      }, {merge: true});
    }
    results.push({shiftId: shift.id, status: nextStatus, notifyResult});
  }
  return {published: results.length, results};
});

async function deleteManagedShift(shiftId, authContext, {throwOnError = true} = {}) {
  const id = text(shiftId, 120);
  if (!id) {
    if (throwOnError) throw new HttpsError("invalid-argument", "shiftId is required.");
    return {shiftId: "", deleted: false, error: "shiftId is required."};
  }
  const ref = db.collection("scheduleShifts").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    if (throwOnError) throw new HttpsError("not-found", "Shift not found.");
    return {shiftId: id, deleted: false, error: "Shift not found."};
  }
  const shift = snap.data() || {};
  if (!await canManageOwner(text(shift.ownerType, 40), text(shift.ownerId, 160), authContext)) {
    if (throwOnError) throw new HttpsError("permission-denied", "You cannot delete this shift.");
    return {shiftId: id, deleted: false, error: "You cannot delete this shift."};
  }
  const status = normalizeShiftStatus(shift.status) || text(shift.status, 40);
  if (!canDeleteShiftStatus(status)) {
    if (throwOnError) throw new HttpsError("failed-precondition", "This shift cannot be deleted.");
    return {shiftId: id, deleted: false, error: "This shift cannot be deleted."};
  }
  const wasPublished = status === "pending" || status === "confirmed";
  await ref.delete();
  await bumpPublicScheduleRevision(text(shift.ownerType, 40), text(shift.ownerId, 160), status, "deleted");
  if (wasPublished && text(shift.assigneeUid, 160)) {
    try {
      await notifyAssigneeChannels({
        ...shift,
        id,
        status: "cancelled",
        roleLabel: `${shift.roleLabel || "Shift"} (cancelled)`
      }, "schedule-cancelled");
    } catch (_error) {
      /* Deletion still succeeds if notify fails. */
    }
  }
  return {shiftId: id, deleted: true};
}

exports.deleteScheduleShift = onCall({region: "us-central1", timeoutSeconds: 20, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  return deleteManagedShift(request.data?.shiftId, request.auth, {throwOnError: true});
});

exports.deleteScheduleShifts = onCall({region: "us-central1", timeoutSeconds: 120, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const ids = sanitizeShiftIds(request.data?.shiftIds, 80);
  if (!ids.length) throw new HttpsError("invalid-argument", "shiftIds is required.");
  const results = [];
  for (const id of ids) {
    results.push(await deleteManagedShift(id, request.auth, {throwOnError: false}));
  }
  return {
    deleted: results.filter(row => row.deleted).length,
    failed: results.filter(row => !row.deleted).length,
    results
  };
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
  const current = normalizeShiftStatus(shift.status) || text(shift.status, 40);
  if (current === "draft") {
    throw new HttpsError("failed-precondition", "Draft shifts must be published before workers can respond.");
  }
  if (current !== "pending" && !isManager) {
    throw new HttpsError("failed-precondition", "This shift is no longer awaiting confirmation.");
  }
  const nextStatus = decision === "approve" ? "confirmed" : "declined";
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    status: nextStatus,
    responseDecision: decision,
    respondedByUid: uid,
    respondedByEmail: text(request.auth.token?.email, 200).toLowerCase(),
    respondedAt: now,
    updatedAt: now
  }, {merge: true});

  await bumpPublicScheduleRevision(text(shift.ownerType, 40), text(shift.ownerId, 160), current, nextStatus);

  await writeScheduleAudit({
    action: nextStatus,
    shiftId,
    ownerKey: shift.ownerKey,
    ownerType: shift.ownerType,
    ownerId: shift.ownerId,
    clubLocationId: shift.clubLocationId,
    actorUid: uid,
    actorEmail: request.auth.token?.email,
    assigneeUid: shift.assigneeUid,
    assigneeName: shift.assigneeName,
    status: nextStatus,
    source: text(request.data?.from, 80) || "callable",
    message: `${shift.assigneeName || "Worker"} ${nextStatus} after notify`
  });

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
    const shifts = snap.docs.map(doc => {
      const row = {id: doc.id, ...doc.data()};
      row.status = normalizeShiftStatus(row.status) || row.status || "";
      return row;
    }).sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0));
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
    const shifts = snap.docs.map(doc => {
      const row = {id: doc.id, ...doc.data()};
      row.status = normalizeShiftStatus(row.status) || row.status || "";
      return row;
    }).filter(row => text(row.assigneeUid, 160) === uid);
    return {shifts, canManage: false};
  }
  const snap = await db.collection("scheduleShifts")
    .where("ownerKey", "==", key)
    .limit(120)
    .get();
  const shifts = snap.docs.map(doc => {
    const row = {id: doc.id, ...doc.data()};
    row.status = normalizeShiftStatus(row.status) || row.status || "";
    return row;
  }).sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0));
  return {shifts, canManage: true};
});

exports.listScheduleShiftAudit = onCall({region: "us-central1", timeoutSeconds: 20, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const ownerType = text(request.data?.ownerType, 40);
  const ownerId = text(request.data?.ownerId, 160);
  if (!OWNER_TYPES.has(ownerType) || !ownerId) throw new HttpsError("invalid-argument", "ownerType and ownerId are required.");
  if (!await canManageOwner(ownerType, ownerId, request.auth)) {
    throw new HttpsError("permission-denied", "You cannot read this schedule log.");
  }
  const key = ownerKey(ownerType, ownerId);
  const snap = await db.collection("scheduleShiftAudit").where("ownerKey", "==", key).limit(120).get();
  const events = snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
    .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
  return {events};
});

async function isElectedClubWorker(ownerId, authContext = {}) {
  const uid = authContext.uid || "";
  if (!uid || !ownerId) return false;
  if (await canManageOwner("club", ownerId, authContext)) return true;
  const safeId = `${ownerId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const designation = await db.collection("clubEmployeeDesignations").doc(safeId).get();
  if (designation.exists && text(designation.data()?.status, 40).toLowerCase() !== "rejected") return true;
  const snap = await db.collection("clubEmployeeDesignations")
    .where("clubLocationId", "==", ownerId)
    .limit(200)
    .get();
  return snap.docs.some(doc => {
    const row = doc.data() || {};
    return text(row.workerUid, 160) === uid && text(row.status, 40).toLowerCase() !== "rejected";
  });
}

async function listMyElectedVenues(uid) {
  const venues = [];
  const seen = new Set();
  try {
    const mine = await db.collection("clubEmployeeDesignations")
      .where("workerUid", "==", uid)
      .limit(40)
      .get();
    mine.docs.forEach(doc => {
      const row = doc.data() || {};
      if (text(row.status, 40).toLowerCase() === "rejected") return;
      const id = text(row.clubLocationId, 160);
      if (!id || seen.has(id)) return;
      seen.add(id);
      venues.push({
        locationId: id,
        locationName: text(row.clubLocationName, 160) || id,
        role: text(row.roleElectionType, 80)
      });
    });
  } catch (_error) {}
  return venues;
}

exports.listStaffWorksheet = onCall({region: "us-central1", timeoutSeconds: 30, memory: "256MiB"}, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const venues = await listMyElectedVenues(uid);
  let ownerId = text(request.data?.ownerId || request.data?.locationId, 160);
  if (!ownerId && venues.length) ownerId = venues[0].locationId;
  if (!ownerId) {
    throw new HttpsError("permission-denied", "Only elected service members can open the Work Sheet.");
  }
  if (!await isElectedClubWorker(ownerId, request.auth)) {
    throw new HttpsError("permission-denied", "Only elected service members at this venue can open the Work Sheet.");
  }
  const key = ownerKey("club", ownerId);
  const [desigSnap, shiftSnap, clubSnap] = await Promise.all([
    db.collection("clubEmployeeDesignations").where("clubLocationId", "==", ownerId).limit(200).get(),
    db.collection("scheduleShifts").where("ownerKey", "==", key).limit(120).get(),
    db.collection("clubLocations").doc(ownerId).get()
  ]);
  const workers = [];
  const seenUid = new Set();
  desigSnap.docs.forEach(doc => {
    const row = doc.data() || {};
    if (text(row.status, 40).toLowerCase() === "rejected") return;
    const workerUid = text(row.workerUid, 160);
    if (!workerUid || seenUid.has(workerUid)) return;
    seenUid.add(workerUid);
    workers.push({
      uid: workerUid,
      name: text(row.workerName, 120) || workerUid,
      role: text(row.roleElectionType, 80) || "Staff",
      photoURL: ""
    });
  });
  await Promise.all(workers.slice(0, 80).map(async worker => {
    try {
      const userSnap = await db.collection("users").doc(worker.uid).get();
      if (!userSnap.exists) return;
      const user = userSnap.data() || {};
      worker.name = text(user.displayName || user.fullName || worker.name, 120);
      worker.photoURL = text(user.photoURL || user.profilePhotoUrl || user.publicPhotoUrl, 500);
    } catch (_error) {}
  }));
  workers.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const shifts = shiftSnap.docs.map(doc => {
    const row = {id: doc.id, ...doc.data()};
    row.status = normalizeShiftStatus(row.status) || row.status || "";
    return row;
  }).filter(row => isPublishedShiftStatus(row.status))
    .map(row => ({
      ...publicShiftView(row, {includeNotes: true}),
      assigneeUid: text(row.assigneeUid, 160)
    }))
    .sort((a, b) => Number(a.startsAtMs || 0) - Number(b.startsAtMs || 0));
  const club = clubSnap.exists ? clubSnap.data() || {} : {};
  return {
    locationId: ownerId,
    locationName: text(club.locationName || club.brandName, 160) || ownerId,
    workers,
    shifts,
    viewerUid: uid,
    venues: venues.length ? venues : [{locationId: ownerId, locationName: text(club.locationName || club.brandName, 160) || ownerId, role: ""}]
  };
});
