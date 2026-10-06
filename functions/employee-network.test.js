"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadNetwork() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("floqr-employee-network.js"), sandbox, { filename: "floqr-employee-network.js" });
  return sandbox.FLOQREmployeeNetwork;
}

const AURELIA = "temp-democlub-1";
const OTHER = "temp-democlub-2";

test("roster keeps only people linked to the open club", () => {
  const N = loadNetwork();
  const ctx = {
    locationId: AURELIA,
    designations: [
      { workerUid: "elected", clubLocationId: AURELIA, status: "elected" },
      { workerUid: "rejected", clubLocationId: AURELIA, status: "rejected" }
    ],
    club: { adminUids: ["adminUid"], adminEmails: ["Owner@Aurelia.com"] }
  };
  assert.equal(N.isLinkedToClub({ uid: "elected" }, ctx), true, "designation row here");
  assert.equal(N.isLinkedToClub({ uid: "rejected" }, ctx), false, "rejected designation is not a link");
  assert.equal(N.isLinkedToClub({ uid: "adminUid" }, ctx), true, "club admin uid");
  assert.equal(N.isLinkedToClub({ uid: "x", email: "owner@aurelia.com" }, ctx), true, "club admin email, case-insensitive");
  assert.equal(N.isLinkedToClub({ uid: "a", approvedLocations: [AURELIA] }, ctx), true);
  assert.equal(N.isLinkedToClub({ uid: "b", affiliatedClubId: AURELIA }, ctx), true);
  assert.equal(N.isLinkedToClub({ uid: "c", affiliatedClubLocationIds: [AURELIA] }, ctx), true);
  assert.equal(N.isLinkedToClub({ uid: "d", designatedCSRLocations: [AURELIA] }, ctx), true);
  assert.equal(N.isLinkedToClub({ uid: "e", approvedLocations: [OTHER], role: "dj" }, ctx), false, "staff at another club");
  assert.equal(N.isLinkedToClub({ uid: "f", requestedClubLocationId: AURELIA }, ctx), false, "pending request is not a link yet");
  assert.equal(N.isLinkedToClub({ uid: "g" }, { ...ctx, locationId: "" }), false, "no club open");
});

test("CSR count ignores elected/approved rows that were never made CSR", () => {
  const N = loadNetwork();
  assert.equal(N.isCsrDesignation({ status: "elected" }), false);
  assert.equal(N.isCsrDesignation({ status: "approved", roleElectionType: "DJ" }), false);
  assert.equal(N.isCsrDesignation({ isCSR: true }), true);
  assert.equal(N.isCsrDesignation({ isCSR: false, designationType: "customer_service_representative" }), false);
  assert.equal(N.isCsrDesignation({ designationType: "customer_service_representative" }), true, "legacy CSR row");
  assert.equal(N.isCsrDesignation({ isCSR: true, status: "rejected" }), false);
});

test("elect candidates need 2+ letters, match name/username/email, and flag club links", () => {
  const N = loadNetwork();
  const users = [
    { uid: "w1", displayName: "Marcus Hale", username: "marcus", email: "m@x.com", approvedLocations: [AURELIA] },
    { uid: "w2", displayName: "Marcus Stone", email: "stone@x.com" },
    { uid: "w3", displayName: "Jolène Dupont", email: "jd@x.com" },
    { displayName: "No uid Marcus" }
  ];
  const ctx = { locationId: AURELIA, designations: [], club: {} };
  const uids = (query) => Array.from(N.electionCandidates(users, query, ctx), c => c.uid);
  assert.equal(N.electionCandidates(users, "m", ctx).length, 0, "1 letter is too short");
  const marcus = N.electionCandidates(users, "marcus", ctx);
  assert.deepEqual(uids("marcus"), ["w1", "w2"], "every match is offered, not just the first; rows without uid skipped");
  assert.equal(marcus[0].handle, "@marcus");
  assert.equal(marcus[1].handle, "stone@x.com");
  assert.equal(marcus[0].linked, true);
  assert.equal(marcus[1].linked, false);
  assert.deepEqual(uids("jolene"), ["w3"], "accent-insensitive");
  assert.deepEqual(uids("stone@x"), ["w2"], "email match");
  const many = Array.from({ length: 20 }, (_, i) => ({ uid: `u${i}`, displayName: `Sam ${i}` }));
  assert.equal(N.electionCandidates(many, "sam", { ...ctx, limit: 8 }).length, 8);
});

test("pending requests from the same worker and role collapse into one row", () => {
  const N = loadNetwork();
  const groups = N.groupPendingRequests([
    { id: "r1", uid: "priya", serviceSubtype: "Waitress", status: "pending" },
    { id: "r2", workerUid: "priya", serviceSubtype: "Waitress" },
    { id: "r3", uid: "priya", serviceSubtype: "waitress", status: "pending" },
    { id: "r4", uid: "priya", serviceSubtype: "Bottle Girl", status: "pending" },
    { id: "r5", uid: "ale", serviceSubtype: "Bottle Girl", status: "approved" },
    { id: "r6", serviceSubtype: "DJ", status: "pending" }
  ]);
  const rows = Array.from(groups, g => ({ uid: g.uid, role: g.role, ids: Array.from(g.ids) }));
  assert.deepEqual(rows, [
    { uid: "priya", role: "Waitress", ids: ["r1", "r2", "r3"] },
    { uid: "priya", role: "Bottle Girl", ids: ["r4"] },
    { uid: "", role: "DJ", ids: ["r6"] }
  ]);
});

test("hasMadeElectionRequest gates the electedRequestMadeTo duplicate check", () => {
  const N = loadNetwork();
  const dupes = (profile, names) => Array.from(N.duplicateElectionVenues(profile, names));
  assert.deepEqual(dupes({ hasMadeElectionRequest: 0, electedRequestMadeTo: ["Aurelia"] }, ["Aurelia"]), [], "flag 0: list is not searched");
  assert.deepEqual(dupes({ electedRequestMadeTo: ["Aurelia"] }, ["Aurelia"]), [], "flag missing counts as 0");
  assert.deepEqual(dupes({ hasMadeElectionRequest: 1, electedRequestMadeTo: ["Aurelia", "Heist"] }, ["aurélia", "Zebbies Garden"]), ["aurélia"], "flag 1: case/accent-insensitive venue-name match");
  assert.deepEqual(dupes({ hasMadeElectionRequest: 1, electedRequestMadeTo: ["Aurelia", "Heist"] }, ["Heist", "Aurelia"]), ["Heist", "Aurelia"], "every repeated club is reported");
  assert.deepEqual(dupes({ hasMadeElectionRequest: 1 }, ["Aurelia"]), [], "flag 1 with an empty list");
});

test("both request forms block repeats and record the venue names", () => {
  for (const file of ["patron-portal-app.js", "role-request-app.js"]) {
    const src = read(file);
    assert.match(src, /duplicateElectionVenues\(/, `${file} checks for repeat requests`);
    assert.match(src, /statusAlreadyRequested/, `${file} shows which clubs were already requested`);
    assert.match(src, /hasMadeElectionRequest: 1,\s*electedRequestMadeTo: firebase\.firestore\.FieldValue\.arrayUnion\(\.\.\.venueNames\)/, `${file} writes both datapoints`);
    const check = src.indexOf("duplicateElectionVenues(");
    const write = src.indexOf('collection("workerAssociationRequests").doc()');
    assert.ok(check > 0 && check < write, `${file} checks before creating any request`);
  }
  for (const page of ["patron-portal.html", "role-request.html"]) {
    const html = read(page);
    assert.ok(html.indexOf("floqr-employee-network.js") > 0 && html.indexOf("floqr-employee-network.js") < html.indexOf(page === "role-request.html" ? "role-request-app.js" : "patron-portal-app.js"), `${page} loads the helper first`);
  }
  assert.match(read("floqr-venue-picker.js"), /function getSelectedVenues\(/);
});

test("Approve survives the patron-only users rule and reports the result in the card", () => {
  const app = read("admin-app.js");
  const portal = read("patron-portal-app.js");
  const html = read("admin.html");
  assert.match(app, /try \{\s*await db\.collection\("users"\)\.doc\(uid\)\.set\(\{approvedRoles/, "Club Admin approve must not fail on the users mirror");
  assert.match(portal, /try \{\s*await db\.collection\("users"\)\.doc\(uid\)\.set\(userPatch/, "Review & elect approve must not fail on the users mirror");
  assert.match(app, /group\.ids\.forEach\(id => batch\.set\(db\.collection\("workerAssociationRequests"\)/, "every duplicate request is closed");
  assert.match(app, /setText\("pendingWorkerStatus", employeeText\("requestFailed"/);
  assert.match(html, /id="pendingWorkerStatus"/);
  const panel = html.slice(html.indexOf('id="panelEmployees"'));
  assert.ok(panel.indexOf('id="pendingWorkerRequests"') < panel.indexOf('id="roleElectionSearch"'), "Pending Worker Requests is the first card");
});

test("Club Admin panel uses the club roster and a select + confirm election", () => {
  const app = read("admin-app.js");
  const html = read("admin.html");
  assert.match(app, /const roster = clubRoster\(\);/);
  assert.doesNotMatch(app, /adminUsers\s*\.filter\(isClubWorkerOrAffiliate\)/, "roster must not list every staff user site-wide");
  assert.doesNotMatch(app, /adminUsers\.find\(profile => contextualTextMatch\(query/, "elect must not silently take the first match");
  assert.match(app, /const match = electionProfile\(selectedElectionUid\);/);
  assert.match(app, /if \(!window\.confirm\(employeeText\("electConfirm"/);
  assert.match(app, /adminDesignations\.filter\(isCsrRow\)/);
  assert.match(html, /id="roleElectionMatches"/);
  assert.match(html, /id="electClubRoleBtn" type="button" disabled/);
  assert.match(html, /data-floqr-help-id="help-employee-network"/);
  assert.ok(html.indexOf("floqr-employee-network.js") < html.indexOf("admin-app.js"), "module loads before admin-app");
});
