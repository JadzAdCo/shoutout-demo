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
  assert.match(html, /floqr-ad-pricing\.js\?v=s3\.0\.76/);
  assert.match(app, /renderPendingApprovalQueue/);
  assert.match(ads, /approveCampaign/);
  assert.match(ads, /loadPendingSpotAds/);
  assert.match(ads, /targetMode === "targeted"/);
  assert.match(ads, /floqrAdCampaignRotationAdvertiser/);
});

test("firestore and storage rules allow spotAds uploads and owned campaign writes", () => {
  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  const storage = fs.readFileSync(path.join(root, "storage.rules"), "utf8");
  assert.match(rules, /match \/spotAdCampaigns\/\{id\}/);
  assert.match(rules, /publishedByUid == request\.auth\.uid/);
  assert.match(storage, /match \/spotAds\/\{userId\}\/\{allPaths=\*\*\}/);
});
