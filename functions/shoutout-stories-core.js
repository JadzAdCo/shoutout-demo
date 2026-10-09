/* Mingl Gist ShoutOut stories — projection without the submitter's contact details.
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
"use strict";

const MAX_STORIES = 40;
const SCAN_LIMIT = 120;
const SHOWN_STATUSES = ["approved", "paid", "displayed", "displaying", "live", "completed"];
const PAID_STATES = ["paid", "succeeded", "complete", "completed"];

function text(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isShown(row = {}) {
  if (row.deleted === true || row.complianceArchived === true) return false;
  if (row.displayed === true || row.onDisplay === true) return true;
  if (SHOWN_STATUSES.includes(String(row.status || "").toLowerCase())) return true;
  return PAID_STATES.includes(String(row.paymentStatus || row.payment || "").toLowerCase());
}

/** A name is public only when it cannot be an email address or phone number. */
function publicName(value) {
  const name = text(value, 80);
  if (!name || name.includes("@") || /^\+?[\d\s().-]{6,}$/.test(name)) return "";
  return name;
}

function publicUrl(value) {
  const url = text(value, 1000);
  return /^https:\/\//i.test(url) ? url : "";
}

function story(id, row = {}) {
  return {
    id,
    submittedByUid: text(row.submittedByUid, 128),
    authorName: publicName(row.submittedByName) || publicName(row.displayName) || publicName(row.submittedByDisplayName) || "ShoutOut",
    avatarUrl: publicUrl(row.submitterPhotoURL || row.photoURL),
    mediaUrl: publicUrl(row.mediaUrl || row.image || row.enhancedMediaUrl || row.originalMediaUrl),
    mediaType: text(row.mediaType, 40),
    mainText: text(row.mainText || row.main, 200),
    subText: text(row.subText || row.sub, 200),
    clubLocationId: text(row.clubLocationId || row.location || row.club, 128),
    locationName: text(row.locationName || row.clubName, 120),
    city: text(row.city, 80),
    eventTag: text(row.eventTag || row.eventName || row.eventLabel, 80),
    createdAtMs: toMillis(row.submittedAt || row.approvedAt || row.createdAt)
  };
}

function project(docs = []) {
  return docs
    .filter(doc => isShown(doc.data))
    .map(doc => story(doc.id, doc.data))
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, MAX_STORIES);
}

module.exports = {MAX_STORIES, SCAN_LIMIT, isShown, publicName, story, project};
