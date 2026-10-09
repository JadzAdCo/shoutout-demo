"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dc = require("./data-classification-core");
const people = require("./people-directory-core");

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

function gaps() {
  const rows = dc.COLLECTIONS.map(collection => dc.normalize(collection, null));
  return dc.exposureReport(rows, dc.parseRulesAccess(rules));
}

const STAGE_1 = [
  "users", "messages", "inboxNotifications", "clubDailyAuthCodes", "suprstrSessions/calleeCandidates",
  "clubMessageDeliveries", "clubMessageInbound", "schedulingSubscriptions", "scheduleShifts",
  "scheduleNotifyQueue", "scheduleShiftAudit", "aiDiagnosticsReports", "aiRecommendations",
  "approvedShoutOutLibrary", "friendRequests", "friendships", "patronRanks", "translationSettings",
  "audienceCampaigns", "clubOnboardingRecords", "promoterOnboardingRecords"
];

test("Stage 1: every Stage 1 collection is off the exposure report and the total dropped from 69", () => {
  const issues = gaps();
  const open = new Set(issues.map(issue => issue.collection));
  STAGE_1.forEach(collection => assert.ok(!open.has(collection), `${collection} still exposed: ${issues.filter(i => i.collection === collection).map(i => i.kind).join(",")}`));
  assert.ok(issues.length <= 69 - 30, `exposure gaps ${issues.length}`);
});

test("users: only self and Master Admin read; other members come from getPeopleDirectory", () => {
  const users = block("users");
  assert.match(users, /allow read: if isSelf\(userId\) \|\| isMasterAdmin\(\);/);
  assert.ok(!/allow read: if signedIn\(\);/.test(users));
});

test("messages: parties read; senders create as themselves; parties cannot be rewritten", () => {
  const messages = block("messages");
  assert.match(messages, /allow read: if isMasterAdmin\(\) \|\| isMessageParty\(resource\.data\);/);
  assert.ok(messages.includes('request.resource.data.get("senderUid", "") == request.auth.uid'));
  assert.ok(!/== "system"/.test(messages), "clients cannot write senderUid \"system\" (Functions only)");
  assert.match(messages, /keepsMessageParties\(\)/);
  assert.ok(!/if signedIn\(\);/.test(messages));
});

test("inboxNotifications: recipient-only reads; creates are attributed, server kinds refused, links stay on FLOQR", () => {
  const inbox = block("inboxNotifications");
  assert.match(inbox, /allow read, update, delete: if isMasterAdmin\(\) \|\| isInboxRecipient\(resource\.data\);/);
  assert.match(inbox, /allow create: if isMasterAdmin\(\) \|\| isConstrainedInboxCreate\(\);/);
  const fn = rules.slice(rules.indexOf("function isConstrainedInboxCreate"), rules.indexOf("function suprstrSessionAcceptsCandidates"));
  ["betaInvite", "paidShoutoutReceipt", "adInvoice", "suprstarApproved", "entityCampaign"].forEach(kind => assert.ok(fn.includes(`"${kind}"`), kind));
  assert.ok(fn.includes('matches("^[.]/[A-Za-z0-9_-]+[.]html.*")'));
  assert.ok(fn.includes('d.get("createdByUid", "") == request.auth.uid'));
});

test("every client Inbox writer that notifies someone else stamps createdByUid or requesterUid", () => {
  const files = ["patron-app.js", "patron-portal-app.js", "admin-app.js", "admin-rep-extension.js", "floqr-blocks.js"];
  files.forEach(file => {
    const source = read(file);
    let at = source.indexOf('collection("inboxNotifications").add(');
    while (at >= 0) {
      const call = source.slice(at, source.indexOf("})", at) + 2);
      const self = /recipientUid:\s*(u|currentUser|user)\.uid\b/.test(call);
      assert.ok(self || /createdByUid|\.\.\.base/.test(call), `${file} @${at} lacks attribution`);
      at = source.indexOf('collection("inboxNotifications").add(', at + 1);
    }
  });
  assert.ok(read("patron-app.js").includes("requesterUid:currentUser.uid"), "Mingl request base carries requesterUid");
});

test("clubDailyAuthCodes and club message logs: server writes only; club managers of that club read", () => {
  [["clubDailyAuthCodes", true], ["clubMessageDeliveries", true], ["clubMessageInbound", false]].forEach(([name, club]) => {
    const body = block(name);
    assert.match(body, /allow create, update, delete: if false;/);
    if (club) assert.ok(body.includes("isClubManager(resource.data.clubLocationId)"));
  });
});

test("SupRstR display2 may add ICE candidates only to a live session, shape-checked, without a Display URL change", () => {
  const body = block("calleeCandidates");
  assert.match(body, /allow create: if suprstrSessionAcceptsCandidates\(sessionId\) && isIceCandidateShape\(\);/);
  assert.ok(!/allow create: if true;/.test(body));
  const fn = rules.slice(rules.indexOf("function suprstrSessionAcceptsCandidates"), rules.indexOf("function isDiagnosticResource"));
  assert.ok(fn.includes('["waiting", "offering", "connected"]') && fn.includes('duration.value(4, "h")'));
  assert.ok(fn.includes('hasOnly(["candidate", "sdpMid", "sdpMLineIndex", "usernameFragment"])'));
});

test("people directory strips private fields and scopes club contacts", () => {
  const ts = {toMillis: () => 1700000000000};
  const pub = people.publicProfile("u1", {
    displayName: "Nyx", email: "n@x.com", phone: "+1", phoneNumber: "+1", stripeCustomerId: "cus", sos2faHash: "h",
    marketingMediaConsent: {accepted: true}, homeAddress: "1 St", latitude: 1, musicInterests: ["hip hop"], city: "DC",
    nested: {contactEmail: "x"}, createdAt: ts, masterAdmin: true
  });
  ["email", "phone", "phoneNumber", "stripeCustomerId", "sos2faHash", "marketingMediaConsent", "homeAddress", "latitude", "masterAdmin"].forEach(key => assert.ok(!(key in pub), key));
  assert.deepEqual(pub.nested, {});
  assert.deepEqual(pub.createdAt, {__ms: 1700000000000});
  assert.equal(pub.city, "DC");
  assert.ok(!people.isPrivateKey("membershipLevel"), "keys ending in -ip are not mistaken for IP addresses");

  const rows = [
    {id: "me", data: {publicProfileVisibility: "public"}},
    {id: "public", data: {publicProfileVisibility: "public", email: "p@x"}},
    {id: "private", data: {displayName: "Hidden", email: "h@x", gender: "f"}},
    {id: "dj", data: {approvedRoles: ["dj"], email: "dj@x", phone: "+2"}},
    {id: "staff", data: {email: "s@x", phone: "+3"}},
    {id: "ref", data: {referredByPromoterId: "p1", email: "r@x"}}
  ];
  const ids = list => list.map(row => row.id);
  assert.deepEqual(ids(people.project("public", rows, {uid: "me"})), ["public"]);
  assert.deepEqual(ids(people.project("services", rows, {uid: "me"})), ["dj"]);
  const contacts = people.project("contacts", rows, {uid: "me", connectedUids: new Set(["private"])});
  assert.deepEqual(ids(contacts), ["public", "private", "dj"]);
  assert.deepEqual(Object.keys(contacts[1]).sort(), ["displayName", "id", "photoURL", "uid", "username"], "connected private member is a name card");
  const club = people.project("club", rows, {uid: "me", affiliatedUids: new Set(["staff"])});
  const byId = Object.fromEntries(club.map(row => [row.id, row]));
  assert.equal(byId.staff.email, "s@x");
  assert.equal(byId.staff.phone, "+3");
  assert.equal(byId.dj.email, "dj@x");
  assert.ok(!("phone" in byId.dj), "service members' phones stay private to unaffiliated clubs");
  assert.ok(!("email" in byId.private) && !("gender" in byId.private));
  assert.ok(!("email" in byId.public));
  const refs = people.project("referrals", rows, {uid: "me"});
  assert.deepEqual(refs, [{referredByPromoterId: "p1", createdAt: undefined, updatedAt: undefined}]);
});

test("people directory validates requests", () => {
  assert.throws(() => people.validateRequest({mode: "everyone"}), /Unknown directory mode/);
  assert.throws(() => people.validateRequest({mode: "uids", uids: []}), /member ids/);
  assert.throws(() => people.validateRequest({mode: "uids", uids: ["a/b"]}), /member ids/);
  assert.throws(() => people.validateRequest({mode: "club"}), /Club is required/);
  assert.deepEqual(people.validateRequest({mode: "uids", uids: ["a", "a", "b"]}).uids, ["a", "b"]);
  assert.equal(people.validateRequest({mode: "public", limit: 99999}).limit, people.MAX_ROWS);
});

test("getPeopleDirectory: auth required, club mode checks the club, reads only via its System job", () => {
  const fns = read("functions/people-directory-functions.js");
  assert.ok(fns.includes('throw new HttpsError("unauthenticated"'));
  assert.ok(fns.includes("isClubManager(req.auth, request.clubLocationId)") && fns.includes('"permission-denied"'));
  assert.equal((fns.match(/db\.collection\(/g) || []).length, 1, "all reads go through systemCollection (System-tier allow-list)");
  assert.ok(dc.SYSTEM_JOBS.peopleDirectory.collections.includes("users"));
  assert.ok(read("functions/index.js").includes('require("./people-directory-functions")'));
});

test("peer readers use FLOQRPeople instead of reading the users collection", () => {
  const pages = {
    "patron-app.js": "index.html", "patron-portal-app.js": "patron-portal.html", "services-app.js": "services.html",
    "admin-app.js": "admin.html", "promoter-admin-app.js": "promoter-admin.html", "mingl-chat-app.js": "mingl-chat.html"
  };
  Object.entries(pages).forEach(([app, page]) => {
    const source = read(app);
    assert.ok(source.includes("FLOQRPeople"), app);
    assert.ok(!/getCollectionSafe\("users"/.test(source) && !/collection\("users"\)\.limit/.test(source), `${app} still scans users`);
    const html = read(page);
    assert.ok(html.indexOf("floqr-people-directory.js") > html.indexOf("firebase-functions-compat.js"), `${page} loads the helper after the Functions SDK`);
    assert.ok(html.indexOf("floqr-people-directory.js") < html.indexOf(app), `${page} loads the helper before ${app}`);
  });
  assert.ok(!/db\.collection\("users"\)\.doc\(uid\)\.get/.test(read("mingl-chat-app.js")));
});
