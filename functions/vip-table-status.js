/* Per-table booking status on onboarded clubs.
   Path: clubLocations/{clubLocationId}/vipNights/{night}/tables/{tableNumber}
   Doc id = table number. After booking completes: isBooked = "1" (yes). */
"use strict";

const {
  text,
  tableNumberFromSection,
  sanitizeTableNumberKey,
  normalizeIsBooked,
  upcomingNights,
  validateNight
} = require("./vip-core");

function tablesCollection(db, clubLocationId, night) {
  const club = text(clubLocationId, 120);
  const n = validateNight(night) || text(night, 20);
  return db.collection("clubLocations").doc(club)
    .collection("vipNights").doc(n)
    .collection("tables");
}

function tableDocRef(db, clubLocationId, night, tableNumber) {
  return tablesCollection(db, clubLocationId, night).doc(sanitizeTableNumberKey(tableNumber));
}

function publicTableRow(tableNumber, row = {}) {
  const isBooked = normalizeIsBooked(row.isBooked);
  return {
    tableNumber: tableNumber || row.tableNumber || "",
    night: row.night || "",
    clubLocationId: row.clubLocationId || "",
    sectionId: row.sectionId || "",
    sectionLabel: row.sectionLabel || "",
    isBooked,
    isBookedYes: isBooked === "1" ? "yes" : "no",
    isReserved: isBooked === "1" ? 1 : 0,
    status: row.status || (isBooked === "1" ? "booked" : "available"),
    reservationId: row.reservationId || "",
    updatedAtMs: Number(row.updatedAtMs || 0) || 0
  };
}

/**
 * Ensure every bookable section has a table doc for the night (isBooked "0" if new).
 * Call for VIP-onboarded clubs when availability loads or after seed.
 */
async function ensureVipTablesForNight(db, {clubLocationId, night, sections = [], now = Date.now()} = {}) {
  const club = text(clubLocationId, 120);
  const n = validateNight(night);
  if (!club || !n || !Array.isArray(sections) || !sections.length) {
    return {ok: false, ensured: 0};
  }
  const col = tablesCollection(db, club, n);
  const batch = db.batch();
  let ensured = 0;
  sections.forEach(section => {
    const tableNumber = tableNumberFromSection(section);
    const ref = col.doc(tableNumber);
    batch.set(ref, {
      tableNumber,
      clubLocationId: club,
      night: n,
      sectionId: text(section.id, 80),
      sectionLabel: text(section.label || tableNumber, 40),
      // Do not overwrite isBooked if already set — merge keeps existing booked state.
      isBooked: "0",
      isBookedYes: "no",
      status: "available",
      ensuredAtMs: now,
      updatedAtMs: now
    }, {merge: true});
    ensured += 1;
  });
  // Firestore batch limit 500
  if (ensured > 0) await batch.commit();
  return {ok: true, clubLocationId: club, night: n, ensured};
}

/**
 * IMPORTANT: ensure must not clobber booked tables. Use set with merge but only
 * default isBooked when creating. Firestore merge still overwrites fields we pass.
 * So ensure reads first for booked docs, or only writes isBooked when creating.
 */
async function ensureVipTablesForNightSafe(db, {clubLocationId, night, sections = [], now = Date.now()} = {}) {
  const club = text(clubLocationId, 120);
  const n = validateNight(night);
  if (!club || !n || !Array.isArray(sections) || !sections.length) {
    return {ok: false, ensured: 0};
  }
  const col = tablesCollection(db, club, n);
  let ensured = 0;
  // Chunked writes
  const chunks = [];
  let batch = db.batch();
  let ops = 0;
  for (const section of sections) {
    const tableNumber = tableNumberFromSection(section);
    const ref = col.doc(tableNumber);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() || {} : null;
    const alreadyBooked = existing && normalizeIsBooked(existing.isBooked) === "1";
    const payload = {
      tableNumber,
      clubLocationId: club,
      night: n,
      sectionId: text(section.id, 80),
      sectionLabel: text(section.label || tableNumber, 40),
      ensuredAtMs: now,
      updatedAtMs: alreadyBooked ? (existing.updatedAtMs || now) : now
    };
    if (!snap.exists) {
      payload.isBooked = "0";
      payload.isBookedYes = "no";
      payload.status = "available";
      payload.reservationId = "";
    } else if (!alreadyBooked && !existing.status) {
      payload.isBooked = normalizeIsBooked(existing.isBooked);
      payload.isBookedYes = payload.isBooked === "1" ? "yes" : "no";
    }
    batch.set(ref, payload, {merge: true});
    ops += 1;
    ensured += 1;
    if (ops >= 400) {
      chunks.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) chunks.push(batch.commit());
  await Promise.all(chunks);
  return {ok: true, clubLocationId: club, night: n, ensured};
}

/** Mark table booked after payment / admin confirm / Club POS confirm. */
function bookedTablePayload({
  clubLocationId, night, tableNumber, sectionId, sectionLabel,
  reservationId, now = Date.now()
} = {}) {
  return {
    tableNumber: sanitizeTableNumberKey(tableNumber),
    clubLocationId: text(clubLocationId, 120),
    night: text(night, 20),
    sectionId: text(sectionId, 80),
    sectionLabel: text(sectionLabel || tableNumber, 40),
    isBooked: "1",
    isBookedYes: "yes",
    isReserved: 1,
    status: "booked",
    reservationId: text(reservationId, 120),
    bookedAtMs: now,
    updatedAtMs: now
  };
}

function availableTablePayload({
  clubLocationId, night, tableNumber, sectionId, sectionLabel, now = Date.now()
} = {}) {
  return {
    tableNumber: sanitizeTableNumberKey(tableNumber),
    clubLocationId: text(clubLocationId, 120),
    night: text(night, 20),
    sectionId: text(sectionId, 80),
    sectionLabel: text(sectionLabel || tableNumber, 40),
    isBooked: "0",
    isBookedYes: "no",
    isReserved: 0,
    status: "available",
    reservationId: "",
    updatedAtMs: now
  };
}

/** Transaction-friendly write: tx.set on table doc. */
function applyTableBooked(tx, db, fields) {
  const ref = tableDocRef(db, fields.clubLocationId, fields.night, fields.tableNumber);
  tx.set(ref, bookedTablePayload(fields), {merge: true});
  return ref;
}

function applyTableAvailable(tx, db, fields) {
  const ref = tableDocRef(db, fields.clubLocationId, fields.night, fields.tableNumber);
  tx.set(ref, availableTablePayload(fields), {merge: true});
  return ref;
}

async function setTableBooked(db, fields) {
  const ref = tableDocRef(db, fields.clubLocationId, fields.night, fields.tableNumber);
  await ref.set(bookedTablePayload(fields), {merge: true});
  return publicTableRow(fields.tableNumber, bookedTablePayload(fields));
}

async function setTableAvailable(db, fields) {
  const ref = tableDocRef(db, fields.clubLocationId, fields.night, fields.tableNumber);
  await ref.set(availableTablePayload(fields), {merge: true});
  return publicTableRow(fields.tableNumber, availableTablePayload(fields));
}

async function listTablesForNight(db, clubLocationId, night) {
  const snap = await tablesCollection(db, clubLocationId, night).get();
  return snap.docs.map(d => publicTableRow(d.id, d.data() || {}));
}

async function ensureUpcomingNights(db, {clubLocationId, sections = [], nights = 14} = {}) {
  const list = upcomingNights(nights);
  const results = [];
  for (const night of list) {
    results.push(await ensureVipTablesForNightSafe(db, {clubLocationId, night, sections}));
  }
  return results;
}

module.exports = {
  tablesCollection,
  tableDocRef,
  publicTableRow,
  ensureVipTablesForNight,
  ensureVipTablesForNightSafe,
  ensureUpcomingNights,
  bookedTablePayload,
  availableTablePayload,
  applyTableBooked,
  applyTableAvailable,
  setTableBooked,
  setTableAvailable,
  listTablesForNight
};
