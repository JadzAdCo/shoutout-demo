const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const core = require("./ad-core");

function box(type, payload) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + payload.length, 0);
  head.write(type, 4, "latin1");
  return Buffer.concat([head, payload]);
}

function mvhdV0(timescale, duration) {
  const p = Buffer.alloc(100);
  p[0] = 0;
  p.writeUInt32BE(timescale, 12);
  p.writeUInt32BE(duration, 16);
  return box("mvhd", p);
}

function mvhdV1(timescale, duration) {
  const p = Buffer.alloc(112);
  p[0] = 1;
  p.writeUInt32BE(timescale, 20);
  p.writeBigUInt64BE(BigInt(duration), 24);
  return box("mvhd", p);
}

function mp4(mvhd, brand = "isom", moovFirst = true) {
  const ftyp = box("ftyp", Buffer.concat([Buffer.from(brand, "latin1"), Buffer.alloc(8)]));
  const moov = box("moov", mvhd);
  const mdat = box("mdat", Buffer.alloc(64));
  return moovFirst ? Buffer.concat([ftyp, moov, mdat]) : Buffer.concat([ftyp, mdat, moov]);
}

test("pricing table covers both placements and every run length", () => {
  assert.equal(core.priceFor("inline", 7), 4500);
  assert.equal(core.priceFor("minglGist", 7), 2500);
  assert.equal(core.priceFor("inline", 31), 17000);
  assert.equal(core.priceFor("inline", 10), 0);
  assert.equal(core.priceFor("default", 7), 0);
  for (const placement of core.PLACEMENTS) {
    for (const days of core.RUN_DAY_OPTIONS) assert.ok(core.priceFor(placement, days) > 0);
  }
});

test("client pricing mirror matches the server price table", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "floqr-ad-pricing.js"), "utf8");
  const sandbox = {window: {}};
  vm.runInNewContext(src, sandbox);
  const client = sandbox.window.FLOQRAdPricing;
  for (const placement of core.PLACEMENTS) {
    for (const days of core.RUN_DAY_OPTIONS) {
      assert.equal(client.priceFor(placement, days), core.priceFor(placement, days), `${placement} ${days}`);
    }
  }
});

test("mp4 / mov duration parser reads mvhd v0 and v1, moov first or last", () => {
  assert.equal(core.parseMp4DurationSeconds(mp4(mvhdV0(1000, 15000))), 15);
  assert.equal(core.parseMp4DurationSeconds(mp4(mvhdV1(600, 600 * 42))), 42);
  assert.equal(core.parseMp4DurationSeconds(mp4(mvhdV0(90000, 90000 * 29), "qt  ", false)), 29);
  assert.equal(core.parseMp4DurationSeconds(Buffer.from("not a video at all")), null);
});

test("inspectAdMedia enforces the 30 second video cap", () => {
  const ok = core.inspectAdMedia(mp4(mvhdV0(1000, 30000)), "video/mp4");
  assert.equal(ok.ok, true);
  assert.equal(ok.kind, "video");
  const tooLong = core.inspectAdMedia(mp4(mvhdV0(1000, 31000)), "video/mp4");
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.error, /30 seconds/);
  const mov = core.inspectAdMedia(mp4(mvhdV0(600, 600 * 10), "qt  "));
  assert.equal(mov.mime, "video/quicktime");
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  assert.equal(core.inspectAdMedia(png, "image/png").kind, "image");
  assert.equal(core.inspectAdMedia(Buffer.from("<html><script>x</script></html>")).ok, false);
});

test("validateCampaignInput requires headline, media and https links", () => {
  const bad = core.validateCampaignInput({ctaUrl: "javascript:alert(1)", runDays: 9});
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 3);
  const good = core.validateCampaignInput({
    title: "Friday Hip Hop",
    mediaUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/a.png",
    ctaUrl: "https://example.com/tickets",
    runDays: 14,
    placementType: "minglGist",
    demographics: {ageMin: 40, ageMax: 21, genders: ["female", "robot"], cities: "Washington, Washington, Paris"}
  });
  assert.equal(good.ok, true);
  assert.equal(good.value.demographics.ageMin, 21);
  assert.equal(good.value.demographics.ageMax, 40);
  assert.deepEqual(good.value.demographics.genders, ["female"]);
  assert.deepEqual(good.value.demographics.cities, ["Washington", "Paris"]);
});

test("approval requires payment unless waived", () => {
  assert.equal(core.canApprove({status: "pending_approval", paymentStatus: "unpaid"}).ok, false);
  assert.equal(core.canApprove({status: "pending_approval", paymentStatus: "paid"}).ok, true);
  assert.equal(core.canApprove({status: "pending_approval", paymentStatus: "invoiced"}).ok, true);
  assert.equal(core.canApprove({status: "pending_approval", paymentStatus: "unpaid"}, {waive: true}).waived, true);
  assert.equal(core.canApprove({status: "active", paymentStatus: "paid"}).ok, false);
});

test("flight starts today or later and lasts runDays", () => {
  const now = Date.parse("2026-10-01T15:00:00Z");
  const past = core.computeFlight("2026-09-01", 7, now);
  assert.equal(past.startDate, "2026-10-01");
  assert.equal(past.endDate, "2026-10-07");
  const future = core.computeFlight("2026-10-10", 14, now);
  assert.equal(future.startDate, "2026-10-10");
  assert.equal(future.endsAtMs - future.startsAtMs, 14 * 86400000);
});

test("poster identities cover clubs, delegates, groups and service roles", () => {
  const ids = core.resolvePosterIdentities({
    uid: "u1",
    profile: {displayName: "Nyx", approvedRoles: ["Resident DJ", "Independent Promoter", "Photographer"], IsServiceMember: 1},
    managedClubs: [{id: "club-a", name: "Club A"}],
    delegatedClubs: [{id: "club-b", name: "Club B"}],
    groups: [{id: "grp1", name: "Night Crew"}]
  });
  const types = ids.map(i => `${i.posterType}:${i.posterId}`);
  for (const expected of ["club:club-a", "club:club-b", "promotionGroup:grp1", "promoter:u1", "dj:u1", "mediaCreator:u1", "serviceMember:u1"]) {
    assert.ok(types.includes(expected), expected);
  }
  assert.ok(!types.includes("floqq:floqq"));
  assert.ok(core.resolvePosterIdentities({uid: "m", profile: {}, isMasterAdmin: true}).some(i => i.posterType === "floqq"));
  assert.deepEqual(core.resolvePosterIdentities({uid: "p", profile: {}}), []);
});

test("intake commands and Twilio signatures", () => {
  assert.equal(core.parseIntakeCommand("stop"), "stop");
  assert.equal(core.parseIntakeCommand("AD Friday party"), "ad");
  assert.equal(core.parseIntakeCommand("hello"), "");
  assert.equal(core.isAdIntakeMessage({NumMedia: "1", Body: ""}), true);
  assert.equal(core.isAdIntakeMessage({NumMedia: "0", Body: "APPROVE 1234"}), false);
  const params = {From: "+12025550100", Body: "AD", NumMedia: "0"};
  const url = "https://example.com/hook";
  const sig = core.twilioSignature("secret", url, params);
  assert.equal(core.validateTwilioSignature("secret", sig, ["https://wrong", url], params), true);
  assert.equal(core.validateTwilioSignature("secret", sig, ["https://wrong"], params), false);
  assert.equal(core.validateTwilioSignature("other", sig, [url], params), false);
});

test("invoice lines include number, total and approval note", () => {
  const lines = core.buildInvoiceLines({invoiceNumber: "FLOQR-AD-1", amountCents: 4500, title: "Friday", runDays: 7, placementType: "inline"});
  assert.ok(lines.includes("Invoice: FLOQR-AD-1"));
  assert.ok(lines.some(l => l.startsWith("Total: $45.00")));
  assert.ok(!lines.includes(null));
  assert.match(core.invoiceNumberFor("abcDEF123456", Date.parse("2026-10-01T00:00:00Z")), /^FLOQR-AD-20261001-ABCDEF12$/);
});

test("demographics become scorer match tags", () => {
  const tags = core.demographicsToDatapoints({cities: ["Washington"], musicGenres: ["Hip Hop"]});
  assert.deepEqual(tags, ["washington", "hip hop"]);
});
