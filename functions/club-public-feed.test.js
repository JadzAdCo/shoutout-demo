"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const feed = require("./club-public-feed-core");
const clientStaff = require("../floqr-featured-staff.js");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const featured = [
  {uid: "u1", name: "Priya", role: "Waitress", photoUrl: "https://cdn.example/p.jpg", instagram: "priya"},
  {name: "Marco", role: "Barman"}
];

test("server photo signature matches the Club Admin consent signature", () => {
  assert.equal(feed.photoSignature(featured), clientStaff.photoSignature(featured));
  assert.equal(feed.photoSignature([{name: "No Photo"}]), "");
});

test("staff photos only publish when consent covers the current photos", () => {
  const sig = feed.photoSignature(featured);
  const consented = feed.staffView({featuredStaff: featured, featuredStaffPhotoConsent: {photoSignature: sig}});
  assert.equal(consented[0].photoUrl, "https://cdn.example/p.jpg");
  assert.equal(consented[0].instagram, "@priya");
  assert.equal(consented[1].photoUrl, "");

  const noConsent = feed.staffView({featuredStaff: featured});
  assert.equal(noConsent.length, 2);
  assert.ok(noConsent.every(row => row.photoUrl === ""), "no consent → names only");

  const stale = feed.staffView({
    featuredStaff: [{...featured[0], photoUrl: "https://cdn.example/new.jpg"}],
    featuredStaffPhotoConsent: {photoSignature: sig}
  });
  assert.equal(stale[0].photoUrl, "", "changed photo needs fresh consent");
});

test("feed honours Public page controls and publish flag", () => {
  const club = {featuredStaff: featured, featuredDjs: [{name: "DJ Nova"}], telephone: "+1 202", email: "a@b.co", publicProfileSections: {featuredStaff: false, contact: false, gallery: false, upcomingEvents: false}};
  assert.deepEqual(feed.staffView(club), []);
  assert.equal(feed.djsView(club)[0].role, "DJ");
  assert.equal(feed.profileView(club, "x").phone, "");
  assert.equal(feed.profileView(club, "x").email, "");
  assert.deepEqual(feed.galleryView([{mediaUrl: "https://cdn.example/g.jpg"}], club), []);
  assert.deepEqual(feed.eventsView([{id: "e", eventName: "Night"}], Date.now(), club), []);
  assert.equal(feed.isProfilePublished({publicProfilePublished: false}), false);
  assert.equal(feed.isProfilePublished({offboarded: true}), false);
  assert.equal(feed.isProfilePublished({}), true);
});

test("profile reads the fields Club Admin actually saves", () => {
  const view = feed.profileView({locationName: "Aurelia", officialWebsite: "https://aurelia.example", telephone: "+1 202 555 0100", socialMediaHandles: {instagram: "@aurelia"}}, "aurelia", "https://www.floqr.com/");
  assert.equal(view.website, "https://aurelia.example");
  assert.equal(view.phone, "+1 202 555 0100");
  assert.equal(view.socials.instagram, "@aurelia");
  assert.equal(view.publicPageUrl, "https://www.floqr.com/club-profile.html?location=aurelia");
  assert.equal(feed.profileView({website: "javascript:alert(1)"}).website, "");
});

test("events: upcoming only, sorted, hidden statuses dropped, RSS escapes", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  const events = feed.eventsView([
    {id: "late", eventName: "Late", eventDate: "2026-10-20"},
    {id: "past", eventName: "Past", eventDate: "2026-09-01"},
    {id: "soon", eventName: "Soon <b>", eventDate: "2026-10-12", eventTime: "22:00", artists: ["DJ A"], ticketUrl: "https://t.example"},
    {id: "gone", eventName: "Gone", eventDate: "2026-10-15", status: "deleted"}
  ], now);
  assert.deepEqual(events.map(e => e.id), ["soon", "late"]);
  const rss = feed.buildEventsRss({venueName: "Aurelia", pageUrl: "https://www.floqr.com/club-profile.html?location=a", events});
  assert.match(rss, /<rss version="2.0">/);
  assert.match(rss, /Soon &lt;b&gt;/);
  assert.match(rss, /<link>https:\/\/t\.example<\/link>/);
});

test("gallery skips main/logo slots, non-https and duplicates", () => {
  const gallery = feed.galleryView([
    {mediaUrl: "https://cdn.example/2.jpg", galleryOrder: 2},
    {mediaUrl: "https://cdn.example/1.jpg", galleryOrder: 1},
    {mediaUrl: "https://cdn.example/main.jpg", slotType: "main"},
    {mediaUrl: "http://insecure.example/x.jpg"}
  ], {publicGallery: [{url: "https://cdn.example/1.jpg"}]});
  assert.deepEqual(gallery.map(item => item.url), ["https://cdn.example/1.jpg", "https://cdn.example/2.jpg"]);
});

test("feed handler + Club Admin card + public iframe are wired", () => {
  const fn = read("functions/venue-ingest-functions.js");
  assert.match(fn, /require\("\.\/club-public-feed-core"\)/);
  assert.match(fn, /CLUB_DATASETS = new Set\(\["profile", "staff", "djs", "events", "gallery", "club", "all"\]\)/);
  assert.match(fn, /isProfilePublished\(club\)/);
  assert.match(fn, /clubIframeSnippet/);
  const html = read("admin.html");
  assert.match(html, /id="websiteFeedGenerateBtn"/);
  assert.match(html, /data-floqr-help-id="help-club-website-feed"/);
  const app = read("admin-app.js");
  assert.match(app, /httpsCallable\("rotateVenueIngestSecret"\)/);
  assert.match(app, /httpsCallable\("getVenueIngestEndpoints"\)/);
  assert.match(app, /window\.confirm\(websiteFeedText\("rotateWarning"/);
  const embed = read("club-embed.html");
  assert.match(embed, /data-floqr-public/);
  assert.match(embed, /club-embed\.js/);
  assert.doesNotMatch(embed, /firebase-config/);
  assert.match(read("club-embed.js"), /dataset=club/);
  assert.match(read("floqai-help-repository.js"), /id: "help-club-website-feed"/);
});
