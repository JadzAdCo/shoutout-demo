"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function loadPricing() {
  const code = fs.readFileSync(path.join(root, "floqr-ad-pricing.js"), "utf8");
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox.FLOQRAdPricing;
}

test("ad pricing packages match DOOH-informed Inline $45 and Mingl Gist $25", () => {
  const pricing = loadPricing();
  assert.equal(pricing.packageFor("inline").priceCents, 4500);
  assert.equal(pricing.packageFor("inline").flightDays, 7);
  assert.equal(pricing.packageFor("minglGist").priceCents, 2500);
  assert.ok(pricing.packageFor("inline").slots.includes("rydr"));
  assert.ok(pricing.packageFor("minglGist").slots.includes("mingl-gist"));
  assert.ok(!pricing.packageFor("minglGist").slots.includes("default"));
});

test("patron portal wires business account election and Ad Campaigns module", () => {
  const html = fs.readFileSync(path.join(root, "patron-portal.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "patron-portal-app.js"), "utf8");
  const module = fs.readFileSync(path.join(root, "patron-ad-campaigns.js"), "utf8");
  assert.match(html, /id="editAccountType"/);
  assert.match(html, /id="portalAdCampaignsTab"/);
  assert.match(html, /patron-ad-campaigns\.js\?v=s3\.0\.76/);
  assert.match(html, /floqr-ad-pricing\.js\?v=s3\.0\.76/);
  assert.match(app, /IsBusinessAccount/);
  assert.match(app, /accountType/);
  assert.match(app, /FLOQRPatronAdCampaigns/);
  assert.match(module, /pending_approval/);
  assert.match(module, /placementType/);
  assert.match(module, /creativeType/);
  assert.match(module, /targetMode/);
});

test("master admin has pending ad approval queue", () => {
  const html = fs.readFileSync(path.join(root, "master-admin.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "master-admin-app.js"), "utf8");
  const ads = fs.readFileSync(path.join(root, "ad-campaigns.js"), "utf8");
  assert.match(html, /id="adCampaignPendingQueue"/);
  assert.match(html, /floqr-ad-pricing\.js\?v=s3\.0\.102/);
  assert.match(html, /ad-campaigns\.js\?v=s3\.0\.102/);
  assert.match(app, /renderPendingApprovalQueue/);
  assert.match(ads, /approveCampaign/);
  assert.match(ads, /loadPendingSpotAds/);
  assert.match(ads, /targetMode === "targeted"/);
  assert.match(ads, /floqrAdCampaignRotationAdvertiser/);
  assert.match(ads, /data-preview-ad/);
  assert.match(ads, /normalizeDatapoints/);
  assert.match(ads, /normalizeRequiredGroups/);
  assert.match(ads, /Demo \(not live\)/);
  assert.match(ads, /ShoutOut path/);
  assert.match(ads, /campaignBadgeHtml/);
  assert.doesNotMatch(ads, /Campaign datapoints JSON/);
  assert.doesNotMatch(ads, /Required target groups JSON/);
});

function loadAdCampaigns() {
  const code = fs.readFileSync(path.join(root, "ad-campaigns.js"), "utf8");
  const sandbox = {
    window: {},
    globalThis: {},
    localStorage: {
      _data: {},
      getItem(key) { return this._data[key] || null; },
      setItem(key, value) { this._data[key] = String(value); }
    },
    document: { getElementById() { return null; } },
    firebase: undefined,
    Date,
    Array,
    String,
    Number,
    Object,
    Set,
    CSS: { escape: (s) => String(s).replace(/"/g, '\\"') }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox.FLOQRAdCampaigns;
}

test("ad campaign form serializers build datapoints and required groups from plain fields", () => {
  const api = loadAdCampaigns();
  const datapoints = JSON.parse(JSON.stringify(api.normalizeDatapoints([
    {category: " Location ", tags: "Washington DC, DC"},
    {category: "", tags: "ignored"},
    {category: "Music", tags: []}
  ])));
  assert.deepEqual(datapoints, [
    {category: "Location", tags: ["Washington DC", "DC"]}
  ]);
  const groups = JSON.parse(JSON.stringify(api.normalizeRequiredGroups([
    {label: "DC music", fields: ["city", "musicInterests"], tags: "DC, Latin"},
    {label: "Incomplete", fields: ["city"], tags: ""},
    {label: "Also incomplete", fields: [], tags: "x"}
  ])));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "DC music");
  assert.deepEqual(groups[0].fields, ["city", "musicInterests"]);
  assert.deepEqual(groups[0].tags, ["DC", "Latin"]);
  assert.ok(api.PROFILE_FIELD_OPTIONS.some((f) => f.id === "musicInterests"));
  assert.equal(api.campaignStatusLabel("preview"), "Demo (not live)");
  assert.equal(api.campaignPathLabel({slots: ["shoutout", "clubs"]}), "ShoutOut path");
  assert.equal(api.campaignPathLabel({placementType: "inline"}), "Inline package");
  assert.match(api.campaignBadgeTitle({status: "preview", slots: ["shoutout"]}), /packaged demo/i);
});

test("firestore and storage rules allow spotAds uploads and owned campaign writes", () => {
  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  const storage = fs.readFileSync(path.join(root, "storage.rules"), "utf8");
  assert.match(rules, /match \/spotAdCampaigns\/\{id\}/);
  assert.match(rules, /publishedByUid == request\.auth\.uid/);
  assert.match(storage, /match \/spotAds\/\{userId\}\/\{allPaths=\*\*\}/);
});
