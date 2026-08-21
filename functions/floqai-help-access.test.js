"use strict";

/**
 * FloqAi help partition access contract (mirrors floqai-help-repository.js).
 * patronHelpverbiage / serviceMemberHelpverbiage / venueAdminHelpverbiage / masterAdminHelpverbiage
 */
const test = require("node:test");
const assert = require("node:assert/strict");

function flagOn(value) {
  return /^(1|true|yes)$/i.test(String(value ?? "").trim());
}

function canAccessPartition(audienceKey, flags = {}) {
  if (flagOn(flags.IsMasterAdmin)) return true;
  switch (audienceKey) {
    case "patron": return flagOn(flags.IsPatron);
    case "serviceMember": return flagOn(flags.IsServiceMember);
    case "venueAdmin": return flagOn(flags.IsVenueAdmin);
    case "masterAdmin": return false;
    default: return false;
  }
}

function canAccessHelpEntry(entry, flags) {
  const keys = (entry.audiences || ["patron"]);
  return keys.some(key => canAccessPartition(key, flags));
}

test("patronHelpverbiage: IsPatron or IsMasterAdmin", () => {
  assert.equal(canAccessPartition("patron", {IsPatron: 1}), true);
  assert.equal(canAccessPartition("patron", {IsMasterAdmin: 1}), true);
  assert.equal(canAccessPartition("patron", {IsServiceMember: 1}), false);
  assert.equal(canAccessPartition("patron", {}), false);
});

test("serviceMemberHelpverbiage: IsServiceMember or IsMasterAdmin", () => {
  assert.equal(canAccessPartition("serviceMember", {IsServiceMember: 1}), true);
  assert.equal(canAccessPartition("serviceMember", {IsMasterAdmin: 1}), true);
  assert.equal(canAccessPartition("serviceMember", {IsPatron: 1}), false);
});

test("venueAdminHelpverbiage: IsVenueAdmin or IsMasterAdmin", () => {
  assert.equal(canAccessPartition("venueAdmin", {IsVenueAdmin: 1}), true);
  assert.equal(canAccessPartition("venueAdmin", {IsMasterAdmin: 1}), true);
  assert.equal(canAccessPartition("venueAdmin", {IsPatron: 1}), false);
});

test("masterAdminHelpverbiage: IsMasterAdmin only", () => {
  assert.equal(canAccessPartition("masterAdmin", {IsMasterAdmin: 1}), true);
  assert.equal(canAccessPartition("masterAdmin", {IsVenueAdmin: 1}), false);
  assert.equal(canAccessPartition("masterAdmin", {IsPatron: 1}), false);
});

test("Heist 64x48 master entry blank for patron", () => {
  const entry = {audiences: ["masterAdmin"]};
  assert.equal(canAccessHelpEntry(entry, {IsPatron: 1}), false);
  assert.equal(canAccessHelpEntry(entry, {IsServiceMember: 1}), false);
  assert.equal(canAccessHelpEntry(entry, {IsMasterAdmin: 1}), true);
});
