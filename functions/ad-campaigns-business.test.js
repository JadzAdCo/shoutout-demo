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

test("patron portal and Club Admin mount the shared server-backed ad composer", () => {
  const html = fs.readFileSync(path.join(root, "patron-portal.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "patron-portal-app.js"), "utf8");
  const module = fs.readFileSync(path.join(root, "patron-ad-campaigns.js"), "utf8");
  const composer = fs.readFileSync(path.join(root, "floqr-ad-composer.js"), "utf8");
  const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const adminAds = fs.readFileSync(path.join(root, "admin-spot-ads.js"), "utf8");
  assert.match(html, /id="editAccountType"/);
  assert.match(html, /id="portalAdCampaignsTab"/);
  assert.match(html, /id="adComposerHost"/);
  assert.match(html, /floqr-ad-composer\.js\?v=s3\.\d+\.\d+/);
  assert.match(html, /patron-ad-campaigns\.js\?v=s3\.\d+\.\d+/);
  assert.match(html, /id="privacyDoNotSell"/);
  assert.match(app, /IsBusinessAccount/);
  assert.match(app, /FLOQRPatronAdCampaigns/);
  assert.match(module, /FLOQRAdComposer/);
  assert.match(module, /FLOQRTabGates/);
  assert.match(composer, /MAX_VIDEO_SECONDS = 30/);
  assert.match(composer, /createAdCampaign/);
  assert.match(composer, /getAdPostingIdentities/);
  assert.doesNotMatch(composer, /collection\("spotAdCampaigns"\)\.(add|doc)/);
  assert.match(adminHtml, /id="spotAdComposerHost"/);
  assert.match(adminHtml, /floqr-ad-composer\.js\?v=s3\.\d+\.\d+/);
  assert.match(adminAds, /mountClubPosters/);
  assert.doesNotMatch(adminAds, /status:\s*"active"/);
});

test("master admin Ad Management tab group wires queue, live, stats, intake and settings", () => {
  const html = fs.readFileSync(path.join(root, "master-admin.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "master-admin-app.js"), "utf8");
  const mgmt = fs.readFileSync(path.join(root, "master-ad-management.js"), "utf8");
  const sos = fs.readFileSync(path.join(root, "sos2fa.js"), "utf8");
  const ads = fs.readFileSync(path.join(root, "ad-campaigns.js"), "utf8");
  assert.match(html, /data-tab-group="adManagement"/);
  ["adApprovalQueue", "adLiveCampaigns", "adStatsPanel", "adIntakePanel", "adSettingsPanel", "adCampaignManagement"].forEach(id => {
    assert.match(html, new RegExp(`<section id="${id}"`));
    assert.match(html, new RegExp(`data-panel="${id}"`));
  });
  assert.match(html, /master-ad-management\.js\?v=s3\.\d+\.\d+/);
  assert.match(html, /ad-campaigns\.js\?v=s3\.\d+\.\d+/);
  ["approveAdCampaign", "rejectAdCampaign", "setAdCampaignState", "resetAdStats", "purgeAdIntake", "setAdSettings", "setAdInvoiceAccount", "markAdInvoicePaid", "updateAdCampaign"].forEach(name => {
    assert.match(mgmt, new RegExp(`"${name}"`));
  });
  assert.match(sos, /adApprovalQueue/);
  assert.match(app, /FLOQRMasterAdManagement/);
  assert.doesNotMatch(app, /Math\.max\(10000/);
  assert.doesNotMatch(app, /0\.035/);
  assert.match(ads, /approveAdCampaign/);
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
  assert.match(ads, /allowsPersonalizedAds/);
  assert.doesNotMatch(ads, /Campaign datapoints JSON/);
  assert.doesNotMatch(ads, /Required target groups JSON/);
});

function loadAdCampaigns() {
  const prefs = fs.readFileSync(path.join(root, "floqr-privacy-prefs.js"), "utf8");
  const code = fs.readFileSync(path.join(root, "ad-campaigns.js"), "utf8");
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
  vm.runInNewContext(prefs, sandbox);
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

function rulesBlock(rules, collection) {
  const start = rules.indexOf(`match /${collection}/{id}`);
  assert.ok(start >= 0, `missing rules block for ${collection}`);
  return rules.slice(start, rules.indexOf("}", rules.indexOf("allow", start)) + 1);
}

test("ad rules are server-only: no client can create, edit or activate an ad", () => {
  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  const storage = fs.readFileSync(path.join(root, "storage.rules"), "utf8");
  const campaigns = rulesBlock(rules, "spotAdCampaigns");
  assert.match(campaigns, /allow create, update, delete: if false;/);
  assert.match(campaigns, /resource\.data\.status == "active"/);
  assert.match(campaigns, /publishedByUid == request\.auth\.uid/);
  ["adCampaignPrivate", "adInvoices", "adSettings", "adStats", "adStatsDaily", "adIntakeSubmissions", "adInvoiceAccounts", "adAuditLogs", "promotionGroups"].forEach(name => {
    assert.match(rulesBlock(rules, name), /allow write: if false;/, `${name} must be Functions-only`);
  });
  assert.match(rulesBlock(rules, "adStats"), /allow read: if isMasterAdmin\(\);/);
  assert.match(rulesBlock(rules, "adIntakeSubmissions"), /allow read: if isMasterAdmin\(\);/);
  assert.match(storage, /match \/spotAds\/\{userId\}\/\{allPaths=\*\*\}/);
  assert.match(storage, /match \/adMedia\/\{userId\}\/\{allPaths=\*\*\}/);
  assert.match(storage, /match \/adIntake\/\{allPaths=\*\*\}/);
});

test("search splash rotates a real campaign again and records measured impressions", () => {
  const app = fs.readFileSync(path.join(root, "patron-app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const tracking = fs.readFileSync(path.join(root, "floqr-ad-tracking.js"), "utf8");
  assert.match(app, /function renderSplashAd\(/);
  assert.match(app, /pickCampaign\(/);
  assert.match(app, /FLOQRAdTracking/);
  assert.match(html, /id="adCreative"/);
  assert.match(html, /floqr-ad-tracking\.js\?v=s3\.\d+\.\d+/);
  assert.match(tracking, /recordAdEvent/);
});

test("rotation serves only approved Firestore ads and honours age, gender and settings", () => {
  const api = loadAdCampaigns();
  const base = {firestore: true, title: "Flyer", slots: ["default", "events"], placementType: "inline", targetMode: "all", paymentStatus: "paid"};
  assert.ok(api.scoreCampaign({...base, status: "awaiting_payment"}, {}, "events") <= -999);
  assert.ok(api.scoreCampaign({...base, status: "pending_approval"}, {}, "events") <= -999);
  assert.ok(api.scoreCampaign({...base, status: "paused"}, {}, "events") <= -999);
  const live = api.scoreCampaign({...base, status: "active"}, {}, "events");
  assert.ok(live > -100);
  assert.ok(api.scoreCampaign({...base, status: "active", genders: ["female"]}, {gender: "male"}, "events") <= -999);
  assert.ok(api.scoreCampaign({...base, status: "active", genders: ["female"]}, {gender: "female"}, "events") > -100);
  assert.ok(api.scoreCampaign({...base, status: "active", minimumAge: 25}, {}, "events") <= -999);
  const unpaid = api.scoreCampaign({...base, status: "active", paymentStatus: "unpaid"}, {}, "events");
  assert.ok(live > unpaid, "paid ads outrank unpaid");
  assert.equal(api.settings().splashSeconds, 5);
});
