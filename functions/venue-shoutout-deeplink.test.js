"use strict";

// Design notes: .cursor/rules/design-notes-search-shoutout-entry.mdc (venue / event ShoutOut deep link)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const PAGES = "https://jadzadco.github.io/shoutout-demo/";

function loadNav(href = `${PAGES}club-profile.html?location=aurelia-dc&v=s3.1.40`) {
  const sandbox = {URL, console, location: {href}};
  sandbox.window = sandbox;
  vm.runInNewContext(read("floqr-nav.js"), sandbox, {filename: "floqr-nav.js"});
  return sandbox.FLOQRNav;
}

function sliceFn(src, start, end) {
  const from = src.indexOf(start);
  const to = src.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `${start} … ${end} present`);
  return src.slice(from, to);
}

test("shoutoutLink builds the venue / event deep link with no v= and no current-page params", () => {
  const nav = loadNav();
  assert.equal(nav.shoutoutLink({locationId: "temp-democlub-1"}), "./?start=shoutout&location=temp-democlub-1");
  assert.equal(
    nav.shoutoutLink({locationId: "zebbies-garden-washington-dc", eventId: "evt 7"}),
    "./?start=shoutout&location=zebbies-garden-washington-dc&event=evt+7"
  );
  assert.equal(nav.shoutoutLink({eventId: "evt-9"}), "./?start=shoutout&event=evt-9");
  assert.equal(nav.shoutoutLink({}), "./?start=search");
  assert.equal(nav.shoutoutLink(), "./?start=search");
  assert.doesNotMatch(nav.shoutoutLink({locationId: "a"}), /[?&]v=/);
});

test("shoutoutUrl is absolute on the current host so club-website iframes open FLOQR", () => {
  const nav = loadNav(`${PAGES}club-embed.html?location=aurelia-dc&secret=x`);
  assert.equal(nav.shoutoutUrl({locationId: "aurelia-dc", eventId: "e1"}), `${PAGES}?start=shoutout&location=aurelia-dc&event=e1`);
  const prod = loadNav("https://www.floqr.com/club-profile.html?location=x");
  assert.equal(prod.shoutoutUrl({locationId: "x"}), "https://www.floqr.com/?start=shoutout&location=x");
});

function directHarness({packaged = {}, live = {}, events = {}, firestoreEvents = {}} = {}) {
  const src = read("patron-app.js");
  const fns = sliceFn(src, "async function loadEventById", "async function selectLocationForShoutOut");
  const calls = [];
  const sandbox = {
    console: {warn() {}},
    window: {SHOUTOUT_CLUB_LOCATIONS: packaged, SHOUTOUT_EVENTS: {}},
    locations: {...live},
    events: {...events},
    pendingDirectLocation: "",
    pendingDirectEvent: "",
    directVenueShoutoutOpened: false,
    selectedLocationId: null,
    db: {collection: () => ({doc: id => ({get: async () => (firestoreEvents[id]
      ? {exists: true, id, data: () => firestoreEvents[id]}
      : {exists: false})})})},
    resolveLocationAlias: async id => String(id || "").toLowerCase(),
    loadLocationById: async id => sandbox.locations[id] || packaged[id] || packaged["zebbies-garden-washington-dc"],
    visibleLocationEntry: ([, loc]) => !!loc && loc.publicVisible !== false,
    tt: (key, vars, fallback) => fallback,
    showPage: page => calls.push(["showPage", page]),
    setStatus: text => calls.push(["status", text]),
    showAdSplash: (type, next, options) => calls.push(["splash", type, options, next]),
    selectLocationForShoutOut: (id, options) => calls.push(["select", id, options])
  };
  vm.runInNewContext(`${fns}; this.openDirectVenueShoutout = openDirectVenueShoutout;`, sandbox);
  return {sandbox, calls};
}

test("venue deep link: venue ad splash first, then straight to that venue's template selection", async () => {
  const {sandbox, calls} = directHarness({live: {"temp-democlub-1": {locationName: "Aurelia"}}});
  sandbox.pendingDirectLocation = "Temp-DemoClub-1";
  await sandbox.openDirectVenueShoutout();
  assert.equal(calls.length, 1, "nothing but the splash happens before the ad ends (no Choose Location page)");
  const [kind, type, options, next] = calls[0];
  assert.equal(kind, "splash");
  assert.equal(type, "shoutout");
  assert.equal(options.venue, true, "venue header, not the FloqMedia house card");
  assert.equal(sandbox.selectedLocationId, "temp-democlub-1");
  next();
  assert.deepEqual(calls[1].slice(0, 2), ["select", "temp-democlub-1"]);
  assert.equal(calls[1][2].event, null);
  await sandbox.openDirectVenueShoutout();
  assert.equal(calls.length, 2, "a second auth callback does not replay the splash");
});

test("event deep link resolves the event's venue and carries the event to template selection", async () => {
  const {sandbox, calls} = directHarness({
    packaged: {"zebbies-garden-washington-dc": {locationName: "Zebbies Garden"}},
    firestoreEvents: {"evt-1": {eventName: "Afro Night", eventDate: "2026-10-17", locationId: "zebbies-garden-washington-dc"}}
  });
  sandbox.pendingDirectEvent = "evt-1";
  await sandbox.openDirectVenueShoutout();
  assert.equal(calls[0][0], "splash");
  assert.equal(calls[0][2].venue, true);
  calls[0][3]();
  assert.equal(calls[1][1], "zebbies-garden-washington-dc");
  assert.equal(calls[1][2].event.eventName, "Afro Night");
});

test("unknown or hidden venue never falls back to Zebbies: Search with a status line", async () => {
  const {sandbox, calls} = directHarness({packaged: {"zebbies-garden-washington-dc": {locationName: "Zebbies Garden"}}});
  sandbox.pendingDirectLocation = "no-such-club";
  await sandbox.openDirectVenueShoutout();
  assert.deepEqual(calls.map(c => c[0]), ["showPage", "status"]);
  assert.equal(calls[0][1], "categoryPage");
  assert.equal(sandbox.pendingDirectLocation, "");
  const hidden = directHarness({live: {"gone-club": {locationName: "Gone", publicVisible: false}}});
  hidden.sandbox.pendingDirectLocation = "gone-club";
  await hidden.sandbox.openDirectVenueShoutout();
  assert.equal(hidden.calls.some(c => c[0] === "splash"), false);
});

test("Search entry uses the deep-link path instead of the old splash + 400 ms race", () => {
  const src = read("patron-app.js");
  const entry = sliceFn(src, "async function continueToMainCategories", "function rememberSignedInHint");
  assert.match(entry, /if \(pendingDirectLocation \|\| pendingDirectEvent\) \{\s*await openDirectVenueShoutout\(\);\s*return;/);
  assert.doesNotMatch(entry, /setTimeout\(\(\) => selectLocationForShoutOut/);
  assert.match(src, /let pendingDirectEvent = qs\("event", ""\);/);
  const select = sliceFn(src, "async function selectLocationForShoutOut", "function showTemplateSelection");
  assert.match(select, /showPage\("templateSelectPage"\)/);
});

test("signed-out round trip: sign-in returnTo keeps the club, and a ShoutOut link survives as returnTo", () => {
  const profile = read("club-profile-app.js");
  const appReturnPath = sliceFn(profile, "function appReturnPath", "function redirectForAccess");
  const profileBox = {URLSearchParams, window: {location: {search: "?location=temp-democlub-1&v=s3.1.40", pathname: "/shoutout-demo/club-profile.html", hash: ""}}};
  vm.runInNewContext(`${appReturnPath}; this.out = appReturnPath();`, profileBox);
  assert.equal(profileBox.out, "club-profile.html?location=temp-democlub-1");

  const patron = read("patron-app.js");
  const safeReturnTo = sliceFn(patron, "function safeReturnTo", "async function userLocationContext");
  const box = {URL, window: {location: {href: `${PAGES}?profileRequired=sign-in`, origin: "https://jadzadco.github.io", pathname: "/shoutout-demo/"}}};
  vm.runInNewContext(`${safeReturnTo}; this.fn = safeReturnTo;`, box);
  assert.equal(box.fn(profileBox.out), `${PAGES}club-profile.html?location=temp-democlub-1`);
  assert.equal(
    box.fn("./?start=shoutout&location=temp-democlub-1&event=e1&v=s3.1.40"),
    `${PAGES}?start=shoutout&location=temp-democlub-1&event=e1`
  );
});

test("every Throw a ShoutOut entry point goes through FLOQRNav.shoutoutLink / shoutoutUrl", () => {
  const profile = read("club-profile-app.js");
  assert.match(profile, /FLOQRNav\?\.shoutoutLink\?\.\(\{locationId, eventId\}\)/);
  assert.match(profile, /byId\("clubShoutoutLink"\)\.href = shoutoutHref\(\);/);
  assert.match(profile, /data-event-shoutout href="\$\{esc\(shoutoutHref\(event\.id\)\)\}"/);
  assert.doesNotMatch(profile, /`\.\/\?location=/);

  const embed = read("club-embed.js");
  assert.match(embed, /FLOQRNav\?\.shoutoutUrl\?\.\(\{locationId, eventId\}\)/);
  assert.match(embed, /byId\("clubEmbedShoutout"\)/);
  const embedHtml = read("club-embed.html");
  assert.ok(embedHtml.indexOf("floqr-nav.js") > 0 && embedHtml.indexOf("floqr-nav.js") < embedHtml.indexOf("club-embed.js"));
  assert.match(embedHtml, /id="clubEmbedShoutout"[^>]*target="_blank"/);

  const assistant = read("ai-assistant-ui.js");
  assert.match(assistant, /shoutoutLink\(\{locationId:item\.id\}\)/);
  assert.match(assistant, /shoutoutLink\(\{eventId:item\.id\}\)/);
  assert.doesNotMatch(assistant, /\.\/\?location=/);
  assert.doesNotMatch(read("intent-search.js"), /pageUrl\("\.\/", \{[^}]*\blocation:/, "FloqAi results never hand-build a Search ?location= link");

  assert.match(read("entity-management.js"), /shoutout: \{label: "ShoutOut link"[\s\S]*?FLOQRNav\?\.shoutoutUrl\?\.\(\{locationId: id\}\)/);
  assert.match(read("admin-app.js"), /FLOQRNav\?\.shoutoutUrl\?\.\(\{locationId\}\)/);
});

test("deep-link unavailable status is translated in all 11 chrome packs", () => {
  const i18n = read("floqr-i18n.js");
  assert.equal((i18n.match(/"app\.directShoutoutUnavailable":/g) || []).length, 11);
});
