"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const dc = require("./data-classification-core");
const stories = require("./shoutout-stories-core");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const rules = read("firestore.rules");

function block(name) {
  const start = rules.indexOf(`match /${name}/`);
  assert.ok(start >= 0, `rules block ${name}`);
  let depth = 0;
  for (let i = rules.indexOf("{", rules.indexOf("}", start) + 1); i < rules.length; i += 1) {
    if (rules[i] === "{") depth += 1;
    if (rules[i] === "}") depth -= 1;
    if (depth === 0) return rules.slice(start, i + 1);
  }
  throw new Error(`unclosed ${name}`);
}

const STAGES_2_3 = [
  "clubAdminNotifications", "clubEmployeeDesignations", "clubMarketingCampaigns", "clubNotificationSettings",
  "entityFollows", "guestListRequests", "notifications", "pickupRequests", "roleRequests", "shoutouts",
  "workerAssociationRequests", "clubLocationAliases", "clubMedia", "clubMessagingCredits", "clubRoleActivity",
  "clubRolePolicies", "clubs", "clubTemplateVariants", "displayDevices", "djProfiles", "events",
  "guestListCampaigns", "liveContent", "promoterProfiles"
];

test("Stages 2-3: the exposure report is empty", () => {
  const rows = dc.COLLECTIONS.map(collection => dc.normalize(collection, null));
  const issues = dc.exposureReport(rows, dc.parseRulesAccess(rules));
  assert.deepEqual(issues.map(issue => `${issue.collection}:${issue.kind}`), []);
});

test("no Stage 2-3 collection keeps a bare signedIn() write, or a bare signedIn() read on non-public data", () => {
  const publicCatalog = new Set(["clubTemplateVariants"]);
  STAGES_2_3.forEach(name => {
    const body = block(name);
    assert.ok(!/allow (create|update|delete|write)[a-z, ]*: if signedIn\(\);/.test(body), `${name} still lets any signed-in member write`);
    if (!publicCatalog.has(name)) assert.ok(!/allow [a-z, ]+: if signedIn\(\);/.test(body), `${name} still lets any signed-in member read`);
  });
});

test("club data is scoped to that club's managers / staff", () => {
  assert.ok(block("shoutouts").includes("isClubStaff(resource.data.clubLocationId)"));
  assert.ok(block("guestListRequests").includes("isClubStaff(resource.data.clubLocationId)"));
  assert.ok(block("workerAssociationRequests").includes("isClubManager(resource.data.clubLocationId)"));
  assert.ok(block("clubNotificationSettings").includes("isClubManager(id)"));
  assert.ok(block("clubMessagingCredits").includes("isClubManager(id)"));
  assert.ok(block("clubRolePolicies").includes("isClubStaff(id)"));
  assert.ok(block("liveContent").includes("isClubManager(id)"));
  const designations = block("clubEmployeeDesignations");
  assert.ok(designations.includes("resource.data.isCSR == true"), "customer service staff stay reachable");
  assert.ok(designations.includes("isClubStaff(resource.data.clubLocationId)"));
  const worker = rules.slice(rules.indexOf("function isClubWorker"), rules.indexOf("function isClubStaff"));
  assert.ok(worker.includes('clubId + "_" + request.auth.uid') && worker.includes('"rejected"'));
});

test("owners: patrons see and edit only their own records", () => {
  const owns = rules.slice(rules.indexOf("function ownsSubmission"), rules.indexOf("function keepsField"));
  assert.ok(owns.includes("data[uidField] == request.auth.uid"), "direct field access so owner queries can be proven");
  const edit = rules.slice(rules.indexOf("function isOwnerShoutoutEdit"), rules.indexOf("match /shoutouts/"));
  ["paymentStatus", "approvedByUid", "serviceOrderId"].forEach(field => assert.ok(edit.includes(`"${field}"`), field));
  assert.ok(edit.includes('["pending", "cancelled"]'));
  assert.ok(block("pickupRequests").includes("resource.data.ownerUid == request.auth.uid"));
  assert.ok(block("entityFollows").includes("resource.data.followerUid == request.auth.uid"));
  assert.ok(block("roleRequests").includes("request.resource.data.uid == request.auth.uid"));
  assert.ok(block("workerAssociationRequests").includes("request.resource.data.workerUid == request.auth.uid"));
  assert.match(block("djProfiles"), /isSelf\(id\) \|\| isMasterAdmin\(\)/);
  assert.match(block("promoterProfiles"), /isSelf\(id\) \|\| isMasterAdmin\(\)/);
  ["clubs", "clubLocationAliases", "displayDevices", "notifications"].forEach(name => assert.ok(/isMasterAdmin\(\);/.test(block(name)), name));
});

test("loaders query only rows the new rules allow (no whole-collection scans)", () => {
  const admin = read("admin-app.js");
  assert.ok(admin.includes('queryCollectionWhere("shoutouts", "clubLocationId", locationId'));
  assert.ok(admin.includes('queryCollectionWhere("guestListRequests", "clubLocationId", locationId'));
  assert.ok(admin.includes('queryCollectionWhere("clubEmployeeDesignations", "clubLocationId", locationId'));
  assert.ok(admin.includes('.where("clubLocationId", "==", locationId).where("referenceNumber", "==", priorRef)'));
  ["shoutouts", "guestListRequests", "clubEmployeeDesignations"].forEach(name => assert.ok(!admin.includes(`getCollectionSafe("${name}"`), `admin ${name}`));

  const portal = read("patron-portal-app.js");
  ["shoutouts", "clubEmployeeDesignations", "workerAssociationRequests", "inboxNotifications"].forEach(name => assert.ok(!portal.includes(`getCollectionSafe("${name}"`), `portal ${name}`));
  assert.ok(portal.includes('queryCollectionSafe("clubEmployeeDesignations", "isCSR", true'));
  assert.ok(portal.includes('collection("workerAssociationRequests").doc(requestId).get()'));

  assert.ok(!read("patron-app.js").includes('getCollectionSafe("shoutouts"'));
  const gist = read("mingl-gist-app.js");
  assert.ok(gist.includes('httpsCallable("getShoutoutStories")') && !gist.includes('collection("shoutouts")'));
});

test("failed reads surface a visible notice instead of a silent empty list", () => {
  const helpers = {
    "admin-app.js": "admin.html", "patron-app.js": "index.html", "patron-portal-app.js": "patron-portal.html",
    "promoter-admin-app.js": "promoter-admin.html", "mingl-chat-app.js": "mingl-chat.html",
    "master-admin-app.js": "master-admin.html", "mingl-gist-app.js": "mingl-gist.html"
  };
  Object.entries(helpers).forEach(([app, page]) => {
    assert.ok(read(app).includes("FLOQRAccessNotice?.report("), `${app} reports failed reads`);
    const html = read(page);
    const at = html.indexOf("floqr-access-notice.js");
    assert.ok(at >= 0 && at < html.indexOf(`./${app}`), `${page} loads the notice before ${app}`);
  });
  assert.ok(!/catch\s*\(e\)\s*\{\s*return \[\];\s*\}/.test(read("patron-portal-app.js")), "portal helpers no longer swallow errors");
});

test("FLOQRAccessNotice tells denied from failed, keeps callers working, and is translated", () => {
  const appended = [];
  const el = () => ({style: {}, setAttribute() {}, appendChild(child) { appended.push(child); }, append(...kids) { appended.push(...kids); }, addEventListener() {}, remove() {}, textContent: ""});
  const document = {readyState: "complete", body: el(), getElementById: () => null, createElement: el, addEventListener() {}};
  const ctx = {console: {warn() {}}, document, FLOQRI18n: {t: key => `T:${key}`}};
  ctx.window = ctx;
  vm.runInNewContext(read("floqr-access-notice.js"), ctx);
  const api = ctx.FLOQRAccessNotice;
  assert.ok(api.isDenied({code: "permission-denied"}));
  assert.ok(api.isDenied({code: "firestore/permission-denied"}));
  assert.ok(api.isDenied({message: "Missing or insufficient permissions."}));
  assert.ok(!api.isDenied({code: "unavailable", message: "offline"}));
  const fallback = [];
  assert.equal(api.report("shoutouts", {code: "permission-denied"}, fallback), fallback);
  const text = JSON.stringify(appended.map(node => node.textContent));
  assert.ok(text.includes("T:access.denied") && text.includes("T:access.dismiss"), text);

  const i18n = read("floqr-i18n.js");
  ["access.denied", "access.failed", "access.dismiss"].forEach(key => {
    const hits = i18n.split(`"${key}"`).length - 1;
    assert.equal(hits, 11, `${key} in all 11 language packs`);
  });
});

test("Mingl Gist stories never carry the submitter's email or phone", () => {
  const docs = [
    {id: "a", data: {status: "approved", submittedBy: "pat@x.com", submittedByEmail: "pat@x.com", submittedByName: "pat@x.com", mainText: "Hi", submittedAt: {toMillis: () => 2}}},
    {id: "b", data: {status: "pending", submittedByName: "Nyx", mainText: "Hidden"}},
    {id: "c", data: {paymentStatus: "paid", displayName: "+1 202 555 0100", submittedByUid: "u3", mediaUrl: "http://insecure", submittedAt: {seconds: 3}}},
    {id: "d", data: {status: "live", submittedByName: "Nyx", complianceArchived: true}}
  ];
  const out = stories.project(docs);
  assert.deepEqual(out.map(row => row.id), ["c", "a"]);
  out.forEach(row => {
    const json = JSON.stringify(row);
    assert.ok(!json.includes("@") && !json.includes("555"), json);
    assert.equal(row.authorName, "ShoutOut");
  });
  assert.equal(out[0].mediaUrl, "", "only https media");
  assert.equal(stories.publicName("DJ Nyx"), "DJ Nyx");
  const fns = read("functions/shoutout-stories-functions.js");
  assert.ok(fns.includes('throw new HttpsError("unauthenticated"'));
  assert.equal((fns.match(/db\.collection\(/g) || []).length, 1, "reads go through the System job allow-list");
  assert.deepEqual(dc.SYSTEM_JOBS.shoutoutStories.collections, ["shoutouts"]);
  assert.ok(read("functions/index.js").includes('require("./shoutout-stories-functions")'));
});
