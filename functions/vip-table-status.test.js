"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./vip-core");
const status = require("./vip-table-status");
const fs = require("node:fs");
const path = require("node:path");

test("tableNumberFromSection uses label as Firestore key", () => {
  assert.equal(core.tableNumberFromSection({label: "12"}), "12");
  assert.equal(core.tableNumberFromSection({label: "C1"}), "C1");
  assert.equal(core.tableNumberFromSection({}, "aurelia-t12"), "t12");
});

test("normalizeIsBooked accepts 1 and yes", () => {
  assert.equal(core.normalizeIsBooked("1"), "1");
  assert.equal(core.normalizeIsBooked("yes"), "1");
  assert.equal(core.normalizeIsBooked(true), "1");
  assert.equal(core.normalizeIsBooked("0"), "0");
  assert.equal(core.normalizeIsBooked("no"), "0");
  assert.equal(core.isTableBookedValue("yes"), true);
});

test("bookedTablePayload sets isBooked 1 and yes", () => {
  const row = status.bookedTablePayload({
    clubLocationId: "temp-democlub-1",
    night: "2026-10-20",
    tableNumber: "12",
    sectionId: "aurelia-t12",
    reservationId: "r1",
    now: 1
  });
  assert.equal(row.isBooked, "1");
  assert.equal(row.isBookedYes, "yes");
  assert.equal(row.tableNumber, "12");
  assert.equal(row.status, "booked");
});

test("availableTablePayload clears booking", () => {
  const row = status.availableTablePayload({
    clubLocationId: "temp-democlub-1",
    night: "2026-10-20",
    tableNumber: "12",
    now: 1
  });
  assert.equal(row.isBooked, "0");
  assert.equal(row.isBookedYes, "no");
});

test("VIP booking paths write table status under clubLocations/.../tables/{tableNumber}", () => {
  const read = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
  const fn = read("functions/vip-functions.js");
  assert.match(fn, /applyTableBooked/);
  assert.match(fn, /ensureVipTablesForNightSafe/);
  assert.match(fn, /exports\.listVipTables/);
  assert.match(fn, /exports\.ensureVipTables/);
  const pos = read("functions/vip-pos-functions.js");
  assert.match(pos, /applyTableBooked/);
  const rules = read("firestore.rules");
  assert.match(rules, /vipNights\/\{night\}\/tables\/\{tableNumber\}/);
  assert.match(rules, /isBooked/);
});

test("getVipAvailability uses Firestore isBooked as booking-status control", () => {
  const read = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
  const fn = read("functions/vip-functions.js");
  const avail = fn.slice(fn.indexOf("exports.getVipAvailability"), fn.indexOf("exports.createVipHold"));
  assert.match(avail, /tableBooked/);
  assert.match(avail, /isBooked is the booking-status control/);
  assert.match(avail, /Do not treat legacy vipInventory\.isReserved alone as booked/);
});
