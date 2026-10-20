/**
 * Past-event lifecycle for crawl + public venue pages.
 *
 * Policy:
 * - Upcoming events stay on venue/DJ/promoter public "upcoming" rails.
 * - When eventStartIso (or eventDate end-of-day) is in the past, mark
 *   lifecycleStatus="past" — still visible under publicProfileSections.pastEvents
 *   unless explicitly retired/removed.
 * - retirePastCrawledEvents moves past items to lifecycleStatus="retired"
 *   (hidden from public rails, retained for audit) or hard-deletes when asked.
 */

"use strict";

const {toIsoStart} = require("./discovery-crawl-core");

function eventStartMs(record = {}) {
  const iso = toIsoStart(record.eventStartIso || record.startsAt || "");
  if (iso) return new Date(iso).getTime();
  const dateOnly = String(record.eventDate || record.proposedDate || record.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return new Date(`${dateOnly}T23:59:59.000Z`).getTime();
  }
  return NaN;
}

function classifyLifecycle(record = {}, now = Date.now()) {
  const start = eventStartMs(record);
  if (!Number.isFinite(start)) {
    return record.lifecycleStatus || (record.entityKind === "event" || record.proposedDate ? "undated" : "active");
  }
  if (String(record.lifecycleStatus || "") === "retired") return "retired";
  if (String(record.lifecycleStatus || "") === "removed") return "removed";
  return start < now ? "past" : "upcoming";
}

function publicEventVisible(record = {}, section = "upcoming") {
  const life = classifyLifecycle(record);
  if (life === "retired" || life === "removed" || String(record.status || "") === "deleted") return false;
  if (section === "upcoming") return life === "upcoming";
  if (section === "past") return life === "past";
  return false;
}

/**
 * Mark crawler date provenance on a record (human-readable + machine fields).
 */
function stampCrawlerDateSource(record = {}, source = "") {
  const eventStartIso = toIsoStart(record.eventStartIso || `${record.proposedDate || ""}T12:00:00.000Z`);
  return {
    ...record,
    eventStartIso: eventStartIso || record.eventStartIso || "",
    crawlerDateSource: source || record.crawlerDateSource || "manual-or-unknown",
    lifecycleStatus: classifyLifecycle({...record, eventStartIso}),
    dateMarkedByCrawler: true
  };
}

async function markPastInCollection(db, collection, {limit = 200, now = Date.now()} = {}) {
  const snap = await db.collection(collection).limit(limit).get();
  let marked = 0;
  const batch = db.batch();
  let ops = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const life = classifyLifecycle(data, now);
    if (life === "past" && data.lifecycleStatus !== "past") {
      batch.set(doc.ref, {
        lifecycleStatus: "past",
        markedPastAt: new Date().toISOString(),
        updatedAt: adminTimestamp(db)
      }, {merge: true});
      marked += 1;
      ops += 1;
    }
    if (ops >= 400) break;
  }
  if (ops) await batch.commit();
  return {collection, marked, scanned: snap.size};
}

function adminTimestamp(db) {
  try {
    const admin = require("firebase-admin");
    return admin.firestore.FieldValue.serverTimestamp();
  } catch (_e) {
    return new Date();
  }
}

/**
 * Retire or remove past events from events + discovery queue.
 * @param {"retire"|"remove"} mode retire = soft-hide; remove = status deleted
 */
async function retirePastCrawledEvents(db, {
  mode = "retire",
  olderThanHours = 0,
  limit = 300,
  now = Date.now()
} = {}) {
  const cutoff = now - Math.max(0, Number(olderThanHours) || 0) * 3600 * 1000;
  const collections = ["events", "aiDiscoveryQueue"];
  const summary = {mode, retired: 0, removed: 0, markedPast: 0, scanned: 0};

  for (const collection of collections) {
    const snap = await db.collection(collection).limit(limit).get();
    summary.scanned += snap.size;
    const batch = db.batch();
    let ops = 0;
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const isEventish = collection === "events"
        || data.entityKind === "event"
        || !!data.eventStartIso
        || !!data.proposedDate
        || !!data.eventDate;
      if (!isEventish) continue;
      const start = eventStartMs(data);
      if (!Number.isFinite(start) || start >= cutoff) continue;
      const life = classifyLifecycle(data, now);
      if (life === "upcoming") continue;

      // Only soft-retire / remove when the event start is older than cutoff
      // (olderThanHours=0 → anything already past; use markPastInCollection to stamp "past" without hiding).
      if (mode === "remove") {
        batch.set(doc.ref, {
          lifecycleStatus: "removed",
          status: "deleted",
          active: false,
          visibility: "hidden",
          removedAt: new Date().toISOString(),
          updatedAt: adminTimestamp(db)
        }, {merge: true});
        summary.removed += 1;
      } else if (life === "past" || life === "retired") {
        if (data.lifecycleStatus === "retired" || data.lifecycleStatus === "removed") continue;
        batch.set(doc.ref, {
          lifecycleStatus: "retired",
          active: false,
          visibility: collection === "events" ? "past-archive" : data.visibility || "public",
          retiredAt: new Date().toISOString(),
          updatedAt: adminTimestamp(db)
        }, {merge: true});
        summary.retired += 1;
      } else {
        continue;
      }
      ops += 1;
      if (ops >= 400) break;
    }
    if (ops) await batch.commit();
  }
  return summary;
}

module.exports = {
  eventStartMs,
  classifyLifecycle,
  publicEventVisible,
  stampCrawlerDateSource,
  markPastInCollection,
  retirePastCrawledEvents
};
