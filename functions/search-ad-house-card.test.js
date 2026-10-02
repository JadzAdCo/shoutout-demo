"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadAdCampaigns() {
  const sandbox = {
    window: {},
    globalThis: {},
    navigator: {},
    localStorage: {
      _data: {},
      getItem(key) { return this._data[key] || null; },
      setItem(key, value) { this._data[key] = String(value); }
    },
    document: { getElementById() { return null; } },
    firebase: undefined,
    Date, Array, String, Number, Object, Set,
    CSS: { escape: (s) => String(s).replace(/"/g, '\\"') }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("floqr-privacy-prefs.js"), sandbox);
  vm.runInNewContext(read("ad-campaigns.js"), sandbox);
  return sandbox.FLOQRAdCampaigns;
}

test("Search splash ships the FloqMedia house card with corrected spelling and tappable contacts", () => {
  const html = read("index.html");
  const card = html.slice(html.indexOf('id="splashHouseCard"'), html.indexOf('id="adCreative"'));
  assert.ok(card.length > 0, "house card markup present");
  assert.match(card, /Ad Powered by FloqMedia/);
  assert.match(card, /Facebook &amp; Instagram/);
  assert.match(card, /@FloqMedia/);
  assert.match(card, /href="https:\/\/www\.floqmedia\.com"/);
  assert.match(card, /href="mailto:sales@floqmedia\.com"/);
  assert.match(card, /href="tel:\+18889335677"/);
  assert.match(card, /\+1 \(888\) WE-FLOQQ/);
  assert.doesNotMatch(html, /FlowMedia|FaceBook|www\/floq|WeFLOQq/);
});

test("only club-action buttons with a picked venue show the venue header; Search paths show the house card", () => {
  const app = read("patron-app.js");
  assert.match(app, /function showAdSplash\(type, nextFn, options = \{\}\)/);
  assert.match(app, /splashHouseCard/);
  ["clubShoutoutBtn", "reserveTableBtn", "joinGuestListBtn", "payVipEntryBtn", "payEventEntryBtn", "payStdEntryBtn"].forEach(id => {
    const re = new RegExp(`bind\\("${id}", \\(\\) => showAdSplash\\("[\\w-]+", \\(\\) => openCategoryAfterAd\\("[\\w:-]+"\\), \\{ venue: true \\}\\)\\)`);
    assert.match(app, re, `${id} keeps the venue header`);
  });
  assert.match(app, /showAdSplash\(type, \(\) => openCategoryAfterAd\(type\)\);/);
  assert.match(app, /showAdSplash\("mingl", \(\) => showMinglLanding\(\)\)/);
});

test("Zebbies demo campaign only rotates at Zebbies Garden", () => {
  const dc = read("dc-spot-ad-campaigns.js");
  const zebbies = dc.slice(dc.indexOf('id: "dc-zebbies-demo"'), dc.indexOf("eventTags", dc.indexOf('id: "dc-zebbies-demo"')));
  assert.match(zebbies, /venueOnly: true/);

  const api = loadAdCampaigns();
  const base = { firestore: true, status: "active", paymentStatus: "paid", title: "Venue", slots: ["clubs"], placementType: "inline", targetMode: "all", clubLocationId: "zebbies-garden-washington-dc", venueOnly: true };
  assert.ok(api.scoreCampaign(base, {}, "clubs") <= -999, "no venue context -> excluded");
  assert.ok(api.scoreCampaign(base, {}, "clubs", { locationId: "other-club" }) <= -999, "other venue -> excluded");
  assert.ok(api.scoreCampaign(base, {}, "clubs", { locationId: "zebbies-garden-washington-dc" }) > -100, "own venue -> served");
  assert.ok(api.scoreCampaign({ ...base, venueOnly: false }, {}, "clubs") > -100, "regular ads unaffected");
});

test("house card labels are localized in every supported language", () => {
  const code = read("floqr-i18n.js");
  ["ad.house.contactUs", "ad.house.web", "ad.house.email", "ad.house.tel", "ad.house.poweredBy"].forEach(key => {
    const count = code.split(`"${key}"`).length - 1;
    assert.ok(count >= 11, `${key} present in 11 packs (found ${count})`);
  });
});
