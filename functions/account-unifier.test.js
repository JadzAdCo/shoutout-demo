"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const core = require("./account-unifier-core");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

test("E.164 normalize rejects junk and accepts international mobiles", () => {
  assert.equal(core.normalizePhoneE164(""), "");
  assert.equal(core.normalizePhoneE164("202-733"), "");
  assert.equal(core.normalizePhoneE164("+12027330274"), "+12027330274");
  assert.equal(core.normalizePhoneE164("not-a-phone"), "");
  assert.equal(core.normalizePhoneE164("+1 (202) 733-0274"), "+12027330274");
  assert.equal(core.normalizePhoneE164("0012027330274"), "+12027330274");
  assert.equal(core.phoneIndexId("+12027330274"), "p12027330274");
  assert.equal(core.isPhoneRequired(""), true);
  assert.equal(core.isPhoneRequired("+12027330274"), false);
});

test("same phone is the same person; other uid is a duplicate", () => {
  assert.equal(core.otherUidOwnsPhone("uid-a", "uid-a"), false);
  assert.equal(core.otherUidOwnsPhone("uid-a", "uid-b"), true);
  assert.match(core.phoneInUseMessage(), /same person/i);
  assert.match(core.mergedAccountMessage(), /merged/i);
});

test("survivor recommendation prefers completed profile + Mingl grant", () => {
  const handle = {uid: "mslorna", profileCompleted: true, minglGrant: 0, minglCount: 0, inboxCount: 0};
  const gmail = {uid: "lorna-gmail", profileCompleted: true, minglGrant: 1, minglCount: 4, inboxCount: 2, botDeeUsed: true};
  const rec = core.recommendSurvivor(handle, gmail);
  assert.equal(rec.survivorUid, "lorna-gmail");
  assert.equal(rec.duplicateUid, "mslorna");
  assert.ok(rec.scores.right > rec.scores.left);
});

test("profile merge fills blanks and unions emails without inventing values", () => {
  const next = core.mergeProfileFields(
    {uid: "keep", email: "keep@example.com", displayName: "Lorna", phone: ""},
    {uid: "drop", email: "lorna@gmail.com", displayName: "", floqrHandle: "@MsLorna", phoneE164: "+12025550100"}
  );
  assert.equal(next.floqrHandle, "@MsLorna");
  assert.equal(next.phoneE164, "+12025550100");
  assert.ok(next.linkedEmails.includes("keep@example.com"));
  assert.ok(next.linkedEmails.includes("lorna@gmail.com"));
  assert.equal(next.displayName, undefined);
});

test("Mingl connection rewrite rekeys pair ids and closes self-pairs", () => {
  const rewrite = core.connectionMergePlan({
    id: "a_b",
    connectionId: "a_b",
    participants: ["a", "b"],
    requestedBy: "a",
    requestedTo: "b"
  }, "a", "c");
  assert.equal(rewrite.action, "rekey");
  assert.equal(rewrite.toId, "b_c");
  assert.deepEqual(rewrite.participants, ["b", "c"]);
  const self = core.connectionMergePlan({
    id: "a_c",
    participants: ["a", "c"]
  }, "a", "c");
  assert.equal(self.action, "close-self");
});

test("beta feature maps union mingl onto the survivor", () => {
  const merged = core.unionBetaFeatures({mingl: 0, botDee: 1}, {mingl: 1, bartr: 0});
  assert.equal(merged.mingl, 1);
  assert.equal(merged.botDee, 1);
  assert.equal(merged.bartr, 0);
});

test("callables, rules, classification, and Master Admin UI are wired", () => {
  const fns = read("functions/account-unifier-functions.js");
  assert.match(fns, /exports\.claimPatronPhone = onCall/);
  assert.match(fns, /exports\.lookupPatronAccounts = onCall/);
  assert.match(fns, /exports\.previewPatronAccountMerge = onCall/);
  assert.match(fns, /exports\.mergePatronAccounts = onCall/);
  assert.match(fns, /Never deletes Firebase Auth|authDeleted: false/);
  assert.doesNotMatch(fns, /deleteUser\(/);
  assert.doesNotMatch(fns, /clientIp|x-forwarded-for/);
  assert.match(fns, /assertSos2faSession/);
  assert.match(fns, /email: "agent"/);
  assert.match(fns, /role: "agent"/);
  const index = read("functions/index.js");
  ["claimPatronPhone", "lookupPatronAccounts", "previewPatronAccountMerge", "mergePatronAccounts"].forEach(name => {
    assert.match(index, new RegExp(`\\b${name}: accountUnifierFns\\.${name}\\b`), name);
  });
  const rules = read("firestore.rules");
  assert.match(rules, /match \/phoneIndex\/\{phoneId\}/);
  assert.match(rules, /"mergedInto"/);
  assert.match(rules, /"phoneE164"/);
  const dc = read("functions/data-classification-core.js");
  assert.match(dc, /\["phoneIndex"/);
  assert.match(dc, /patronAccountUnifier/);
  const html = read("master-admin.html");
  assert.match(html, /id="patronAccountMerge"/);
  assert.match(html, /patron-account-merge.js/);
  const ci = read(".github/workflows/functions-ci.yml");
  assert.match(ci, /firebase-deploy-accounts/);
  assert.match(ci, /claimPatronPhone/);
  const patron = read("patron-app.js");
  assert.match(patron, /claimRequiredPhone/);
  assert.match(patron, /required:\s*true/);
  const portal = read("patron-portal-app.js");
  assert.match(portal, /claimRequiredPhone/);
  assert.match(portal, /required:\s*true/);
  assert.match(read("profile-access-guard.js"), /mergedInto/);
  assert.match(read("floqr-account-unifier.js"), /claimPatronPhone/);
  assert.match(read("patron-account-merge.js"), /mergePatronAccounts/);
  assert.match(read("docs/FEATURE-WIRING.md"), /Patron phone unifier/);
});
