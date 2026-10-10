const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const owners = require("../scheduling-owner-picker.js");

test("deep link owner=type:id parses; unknown types and empty ids are ignored", () => {
  assert.deepEqual(owners.parseOwnerParam("club:zebbies-garden-washington-dc"), {ownerType: "club", ownerId: "zebbies-garden-washington-dc"});
  assert.deepEqual(owners.parseOwnerParam("promoterCompany:Apex Promotions"), {ownerType: "promoterCompany", ownerId: "Apex Promotions"});
  assert.deepEqual(owners.parseOwnerParam("dj:uid:with:colons"), {ownerType: "dj", ownerId: "uid:with:colons"});
  assert.equal(owners.parseOwnerParam("venue:abc"), null);
  assert.equal(owners.parseOwnerParam("club:"), null);
  assert.equal(owners.parseOwnerParam(""), null);
});

test("stored ownerId format is unchanged: DJ = uid, club = location id, company = company name", () => {
  assert.equal(owners.resolveOwnerId("dj", "ignored", "uid123"), "uid123");
  assert.equal(owners.resolveOwnerId("club", "heist-dc", "uid123"), "heist-dc");
  assert.equal(owners.resolveOwnerId("promoterCompany", "Apex Promotions", "uid123"), "Apex Promotions");
  assert.equal(owners.resolveOwnerId("club", "", "uid123"), "");
  assert.equal(owners.resolveOwnerId("other", "x", "uid123"), "");
});

test("Master Admin hint: claim or verified listed email; unverified listed email is not enough", () => {
  assert.equal(owners.isMasterAdminViewer({email: "x@example.com", claims: {masterAdmin: true}}), true);
  assert.equal(owners.isMasterAdminViewer({email: "x@example.com", claims: {superAdmin: true}}), true);
  assert.equal(owners.isMasterAdminViewer({email: "Bans.Don@gmail.com", emailVerified: true, claims: {}}), true);
  assert.equal(owners.isMasterAdminViewer({email: "bans.don@gmail.com", emailVerified: false, claims: {}}), false);
  assert.equal(owners.isMasterAdminViewer({email: "x@example.com", emailVerified: true, claims: {masterAdmin: "true"}}), false);
});

test("managed clubs follow the server's canManageOwner club rules", () => {
  const ids = owners.managedClubIds({
    profile: {clubAdminLocationIds: ["club-a"]},
    assignments: [{clubId: "club-b", status: "active"}, {clubId: "club-x", status: "revoked"}],
    clubsByUid: ["club-c"],
    clubsByEmail: ["club-a"],
    designations: [
      {clubLocationId: "club-d", roleElectionType: "Club Admin", status: "approved"},
      {clubLocationId: "club-e", rolePermissions: ["manageSchedules"], status: "pending"},
      {clubLocationId: "club-y", roleElectionType: "Club Admin", status: "rejected"},
      {clubLocationId: "club-z", roleElectionType: "Bartender", status: "approved"}
    ]
  });
  assert.deepEqual(ids, ["club-a", "club-b", "club-c", "club-d", "club-e"]);
});

test("promoting companies need an active promoter designation; names dedupe case-insensitively", () => {
  const options = owners.companyOptions([
    {promoterCompany: "Apex Promotions", roleElectionType: "Promoter", status: "approved"},
    {promoterCompany: "apex promotions", workerRoles: ["promoter"], status: "active"},
    {promoterCompany: "Night Owls", roleElectionType: "Promoter", status: "rejected"},
    {promoterCompany: "Door Co", roleElectionType: "Door", status: "approved"},
    {promoterCompany: "", roleElectionType: "Promoter", status: "approved"}
  ]);
  assert.deepEqual(options, [{value: "Apex Promotions", label: "Apex Promotions"}]);
  const all = owners.companyOptions([{promoterCompany: "Night Owls", status: "rejected"}], {anyStatus: true});
  assert.deepEqual(all.map(o => o.value), ["Night Owls"]);
});

test("club options show names (not raw ids), sorted, with city when it adds information", () => {
  const options = owners.clubOptions([
    {id: "zebbies-garden-washington-dc", data: {locationName: "Zebbies Garden", city: "Washington DC"}},
    {id: "aurelia", data: {clubName: "Aurelia"}},
    {id: "no-name-id", data: {}}
  ]);
  assert.deepEqual(options.map(o => o.label), ["Aurelia", "no-name-id", "Zebbies Garden · Washington DC"]);
  assert.equal(options.find(o => o.label.startsWith("Zebbies")).value, "zebbies-garden-washington-dc");
});

test("deep-linked owners stay selectable; search filters by name or id", () => {
  const base = [{value: "aurelia", label: "Aurelia"}];
  assert.equal(owners.withRequested(base, "AURELIA").length, 1);
  const withLink = owners.withRequested(base, "heist-dc");
  assert.equal(withLink.length, 2);
  assert.equal(withLink[1].requested, true);
  assert.deepEqual(owners.filterOptions(withLink, "heist").map(o => o.value), ["heist-dc"]);
  assert.deepEqual(owners.filterOptions(withLink, "aur").map(o => o.value), ["aurelia"]);
  assert.equal(owners.filterOptions(withLink, "").length, 2);
});

test("default owner type: deep link, then clubs, then company, then DJ", () => {
  assert.equal(owners.defaultOwnerType({requested: "promoterCompany", clubCount: 3}), "promoterCompany");
  assert.equal(owners.defaultOwnerType({clubCount: 1, companyCount: 1}), "club");
  assert.equal(owners.defaultOwnerType({companyCount: 1}), "promoterCompany");
  assert.equal(owners.defaultOwnerType({}), "dj");
});

test("scheduling.html: satellite shell wiring, picker instead of free-text Owner id", () => {
  const html = read("scheduling.html");
  const order = ["firebase-config.js", "floqr-session-shell.js", "help-attach.js", "scheduling-owner-picker.js", "scheduling-portal.js"]
    .map(file => html.indexOf(`./${file}?v=`));
  order.forEach(index => assert.ok(index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "script order");
  assert.doesNotMatch(html, /<input id="portalOwnerId"/);
  assert.doesNotMatch(html, /Owner id|portalOwnerName|app\.googleSignIn/);
  assert.match(html, /<select id="portalOwnerId">/);
  ["dj", "club", "promoterCompany"].forEach(type => {
    assert.match(html, new RegExp(`name="portalOwnerType" value="${type}"`));
  });
  const chrome = html.match(/<div id="portalAuthChrome"[^>]*data-floqr-auth-chrome>([\s\S]*?)<\/div>/);
  assert.ok(chrome, "auth chrome element");
  assert.doesNotMatch(chrome[1], /portalSubBadge|portalBuySubBtn/, "shell hides auth chrome when signed in; subscription must not live inside it");
  assert.match(html, /data-floqr-help-id="help-scheduling-schedule-for"/);
  assert.doesNotMatch(html, /<h1[^>]*data-floqr-help/, "no help ? on the page h1");
});

test("scheduling-portal.js starts Firebase itself before firebase.auth() and never writes club docs", () => {
  const js = read("scheduling-portal.js");
  assert.match(js, /if \(!firebase\.apps\.length\) firebase\.initializeApp\(window\.firebaseConfig\);\s*auth = firebase\.auth\(\);/);
  assert.doesNotMatch(js, /signInWithPopup|GoogleAuthProvider/);
  assert.match(js, /redirectToLogin/);
  assert.doesNotMatch(js, /\.set\(\{\s*staffSchedulingPaid/);

  const calls = [];
  const fakeAuth = {currentUser: null, onAuthStateChanged() {}};
  const firebase = {
    apps: [],
    initializeApp(config) { calls.push(["init", config.projectId]); this.apps.push({}); },
    auth() { calls.push(["auth"]); if (!this.apps.length) throw new Error("No Firebase App"); return fakeAuth; }
  };
  const ctx = {
    firebase,
    firebaseConfig: {projectId: "shoutoutdemo-5b402"},
    FLOQRScheduleOwners: owners,
    document: {addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }},
    location: {href: "https://jadzadco.github.io/shoutout-demo/scheduling.html"},
    addEventListener() {},
    URL,
    console
  };
  ctx.window = ctx;
  vm.runInNewContext(js, ctx, {filename: "scheduling-portal.js"});
  assert.deepEqual(calls, [["init", "shoutoutdemo-5b402"], ["auth"]]);
});

test("Schedule for help is in the repository, every help locale, and the FloqAi content classes", () => {
  assert.match(read("floqai-help-repository.js"), /id: "help-scheduling-schedule-for"/);
  const help = read("floqr-i18n-help.js");
  assert.equal((help.match(/"help-scheduling-schedule-for": \{/g) || []).length, 10);
  const classes = JSON.parse(read("functions/floqai-content-classes.json"));
  assert.deepEqual(classes.help["help-scheduling-schedule-for"], ["serviceMember", "venueAdmin"]);
  const chrome = read("floqr-i18n.js");
  assert.equal((chrome.match(/"sched\.scheduleFor":/g) || []).length, 11);
});
